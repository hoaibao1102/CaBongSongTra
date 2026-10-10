import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { MongoRepository } from "../src/v2/repository";
import { ApiGuard, requestKey } from "../src/v2/http";
import { CommerceService } from "../src/v2/service";
import { fingerprint } from "../src/v2/policy";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { CheckoutDto } from "../src/v2/dto";

describe("repository idempotency", () => {
  function setup(existing: unknown) {
    const session = { withTransaction: vi.fn(async (work: () => Promise<unknown>) => work()), endSession: vi.fn() };
    const keys = { findOne: vi.fn(() => ({ session: vi.fn(() => ({ lean: vi.fn(async () => existing) })) })), create: vi.fn() };
    const connection = { startSession: vi.fn(async () => session), model: vi.fn((name: string) => name === "V2Idempotency" ? keys : {}) };
    return { repository: new MongoRepository(connection as never), session, keys };
  }
  it("replays without invoking business writes", async () => {
    const { repository, keys } = setup({ requestHash: fingerprint({ amount: 1 }), response: { id: "first" } });
    const work = vi.fn();
    expect(await repository.idempotent("actor:payment:order", "key", { amount: 1 }, work)).toEqual({ id: "first" });
    expect(work).not.toHaveBeenCalled(); expect(keys.create).not.toHaveBeenCalled();
  });
  it("rejects payload mismatch before invoking business writes", async () => {
    const { repository } = setup({ requestHash: fingerprint({ amount: 1 }), response: { id: "first" } });
    const work = vi.fn();
    await expect(repository.idempotent("scope", "key", { amount: 2 }, work)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    expect(work).not.toHaveBeenCalled();
  });
  it("stores a successful response using the exact transaction session", async () => {
    const { repository, session, keys } = setup(null);
    const work = vi.fn(async () => ({ id: "created" }));
    await repository.idempotent("scope", "key", { amount: 1 }, work);
    expect(work).toHaveBeenCalledWith(session);
    expect(keys.create).toHaveBeenCalledWith([expect.objectContaining({ scope: "scope", keyHash: fingerprint("key"), response: { id: "created" } })], { session });
  });
  it("does not persist a success response after a failed mutation", async () => {
    const { repository, keys, session } = setup(null);
    await expect(repository.idempotent("scope", "key", {}, async () => { throw new Error("write failed"); })).rejects.toThrow("write failed");
    expect(keys.create).not.toHaveBeenCalled(); expect(session.endSession).toHaveBeenCalledOnce();
  });
});
describe("service authorization", () => {
  it("denies refund and payout to members before opening a transaction", async () => {
    const db = { idempotent: vi.fn() };
    const service = new CommerceService(db as never);
    const member = { id: "a", role: "MEMBER" as const };
    await expect(service.payout(member, "b", "ref", "key", "req")).rejects.toThrow("OWNER_REQUIRED");
    await expect(service.payment(member, "order", { amountVnd: 1, method: "CASH", expectedVersion: 0 }, "key", "req", true)).rejects.toThrow("OWNER_REQUIRED");
    expect(db.idempotent).not.toHaveBeenCalled();
  });
  it("checks current ownership before an idempotency replay", async () => {
    const db = { scopedOrder: vi.fn(async () => { throw new Error("RESOURCE_NOT_FOUND"); }), idempotent: vi.fn() };
    const service = new CommerceService(db as never);
    await expect(service.transition({ id: "a", role: "MEMBER" }, "b-order", { expectedVersion: 0, status: "CONFIRMED", reason: "confirm" }, "key", "req")).rejects.toThrow("RESOURCE_NOT_FOUND");
    expect(db.scopedOrder).toHaveBeenCalledWith("b-order", { responsibleMemberId: "a" });
    expect(db.idempotent).not.toHaveBeenCalled();
  });
});
describe("HTTP security boundary", () => {
  it("requires a bounded idempotency key", () => {
    for (const value of [undefined, "short", "x".repeat(129), "$".repeat(32)]) expect(() => requestKey({ get: () => value } as never)).toThrow("INVALID_IDEMPOTENCY_KEY");
  });
  it("rejects a cookie mutation without Origin before authenticating", async () => {
    const auth = { authenticate: vi.fn() };
    const guard = new ApiGuard({ getAllAndOverride: () => false } as never, auth as never, {} as never);
    const request = { method: "POST", get: () => undefined };
    const context = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ setHeader: vi.fn() }) }) };
    await expect(guard.canActivate(context as never)).rejects.toThrow("ORIGIN_REJECTED");
    expect(auth.authenticate).not.toHaveBeenCalled();
  });
  it("requires the nested customer object", async () => {
    const input = { items: [{ sku: "CBST-300", qty: 1 }], consent: true, source: "WEBSITE" };
    expect((await validate(plainToInstance(CheckoutDto, input), { whitelist: true, forbidNonWhitelisted: true })).length).toBeGreaterThan(0);
  });
});
