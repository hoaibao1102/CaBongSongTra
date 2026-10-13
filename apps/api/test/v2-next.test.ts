import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { PasswordResetService } from "../src/v2/password-reset";
import { provisioningInput, provision } from "../src/v2/provision";
import { CommerceService } from "../src/v2/service";
import { commissionTarget } from "../src/v2/policy";
import { ApiGuard } from "../src/v2/http";
import { CommerceController } from "../src/v2/controller";
import { Reflector } from "@nestjs/core";
import { ReturnDto, ResetPasswordDto } from "../src/v2/dto";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { AuthService } from "../src/auth/auth.service";

const owner = { id: "owner", role: "OWNER_ADMIN" as const };
const query = (value: unknown) => ({ session: () => ({ lean: async () => value }) });
describe("single-use owner-issued password reset", () => {
  it("rejects a session created by an old credential version even if revocation raced login", async () => {
    const db = { findSessionByHash: async () => ({ userId: "u", authVersion: 1, revokedAt: null, idleExpiresAt: new Date(Date.now() + 60000), absoluteExpiresAt: new Date(Date.now() + 60000) }), findUserById: async () => ({ id: "u", status: "ACTIVE", authVersion: 2 }), revokeSession: vi.fn(), touchSession: vi.fn() };
    await expect(new AuthService(db as never, "s".repeat(32)).authenticate("token")).rejects.toThrow("SESSION_INVALID");
    expect(db.touchSession).not.toHaveBeenCalled();
  });
  it("rejects members before issuing secrets", async () => {
    await expect(new PasswordResetService({} as never).issue({ id: "m", role: "MEMBER" }, "u", "r")).rejects.toThrow("OWNER_REQUIRED");
  });
  it("stores only a hash, replaces previous tokens and returns the secret once", async () => {
    const db = { transaction: async (fn: (s: unknown) => unknown) => fn("session"), users: { findOne: () => query({ id: "u" }), updateOne: vi.fn(async () => ({ matchedCount: 1 })) }, resets: { deleteMany: vi.fn(), create: vi.fn() }, sessions: { updateMany: vi.fn() }, audit: { create: vi.fn() } };
    const result = await new PasswordResetService(db as never).issue(owner, "u", "request");
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(db.resets.create.mock.calls)).not.toContain(result.token);
    expect(db.resets.deleteMany).toHaveBeenCalledWith({ userId: "u" }, { session: "session" });
    expect(JSON.stringify(db.audit.create.mock.calls)).not.toContain(result.token);
  });
  it("rejects consumed/expired tokens before password or session writes", async () => {
    const db = { transaction: async (fn: (s: unknown) => unknown) => fn("session"), resets: { findOneAndDelete: () => query(null) }, users: { updateOne: vi.fn() }, sessions: { updateMany: vi.fn() } };
    await expect(new PasswordResetService(db as never).consume({ token: "a".repeat(43), password: "new-strong-password" }, "r")).rejects.toThrow("RESET_INVALID");
    expect(db.users.updateOne).not.toHaveBeenCalled(); expect(db.sessions.updateMany).not.toHaveBeenCalled();
  });
});
describe("explicit provisioning", () => {
  it("requires explicit confirmation and validates credentials before connecting", async () => {
    await expect(provisioningInput({})).rejects.toThrow();
    await expect(provisioningInput({ PROVISION_CONFIRM: "CREATE_FIRST_OWNER", PROVISION_EMAIL: "invalid", PROVISION_PASSWORD: "short", PROVISION_NAME: "Owner" })).rejects.toThrow();
  });
  it("refuses existing owners without changing catalog prices", async () => {
    const db = { transaction: async (fn: (s: unknown) => unknown) => fn("s"), users: { findOne: () => query({ id: "owner" }) }, products: { updateOne: vi.fn() } };
    await expect(provision(db as never, { email: "owner@example.com", password: "strong-password-123", displayName: "Owner" })).rejects.toThrow("OWNER_ALREADY_EXISTS");
    expect(db.products.updateOne).not.toHaveBeenCalled();
  });
});
describe("order mutation locks", () => {
  it("restocks inspected goods and records credit plus exact historical COGS reversal", async () => {
    const order = { id: "o", status: "RETURN_REQUESTED", version: 0, shippedAt: new Date(), deliveredAt: new Date(), items: [{ sku: "CBST-300", qty: 2, unitPriceVnd: 109000 }], allocations: [{ batchId: "b", sku: "CBST-300", qty: 2, landedUnitCostVnd: 65000 }], totalVnd: 218000, receiptsVnd: 218000, refundsVnd: 0, cogsVnd: 130000, directCostsVnd: 0, costsFinalized: true, commissionVnd: 0, commissionRateBps: 4000, responsibleMemberId: "m" };
    const db = { scopedOrder: async () => order, idempotent: async (_s: string, _k: string, _p: unknown, fn: (s: unknown) => unknown) => fn("s"), batches: { findOne: () => query({ id: "b", sku: "CBST-300", onHand: 0, reserved: 0, status: "AVAILABLE", expiresAt: new Date("2099-01-01"), labelReference: "label" }), updateOne: vi.fn(async () => ({ modifiedCount: 1 })) }, movements: { create: vi.fn() }, ledger: { create: vi.fn() }, audit: { create: vi.fn() }, saveOrder: vi.fn(), balances: { updateOne: vi.fn() } };
    await new CommerceService(db as never).receiveReturn(owner, "o", { expectedVersion: 0, lines: [{ batchId: "b", qty: 1, disposition: "RESTOCK" }], reason: "Sealed and inspected", inspectionReference: "photo" }, "key", "r");
    expect(order.cogsVnd).toBe(65000);
    expect(order.status).toBe("PARTIALLY_RETURNED");
    expect(db.ledger.create).toHaveBeenCalledWith([expect.objectContaining({ kind: "RETURN_CREDIT", amountVnd: 109000 })], { session: "s" });
    expect(db.ledger.create).toHaveBeenCalledWith([expect.objectContaining({ kind: "COGS_REVERSAL", amountVnd: 65000 })], { session: "s" });
    expect(db.batches.updateOne).toHaveBeenCalledWith(expect.objectContaining({ onHand: 0, reserved: 0 }), { $inc: { onHand: 1, reserved: 0 } }, { session: "s", runValidators: true });
  });
  it("preserves snapshot prices and releases before reserving edited confirmed orders", async () => {
    const order = { id: "o", status: "CONFIRMED", version: 0, items: [{ sku: "CBST-300", qty: 1, unitPriceVnd: 109000 }], allocations: [{ batchId: "b", sku: "CBST-300", qty: 1, landedUnitCostVnd: 65000 }], receiptsVnd: 0, refundsVnd: 0 };
    const batch = { id: "b", sku: "CBST-300", onHand: 3, reserved: 1, landedUnitCostVnd: 65000, expiresAt: new Date("2099-01-01"), status: "AVAILABLE" };
    const db = { scopedOrder: async () => order, idempotent: async (_s: string, _k: string, _p: unknown, fn: (s: unknown) => unknown) => fn("s"), batches: { findOne: () => query(batch), find: () => ({ sort: () => query([{ ...batch, reserved: 0 }]) }), updateOne: vi.fn(async () => ({ modifiedCount: 1 })) }, movements: { create: vi.fn() }, audit: { create: vi.fn() }, saveOrder: vi.fn() };
    await new CommerceService(db as never).editOrder(owner, "o", { expectedVersion: 0, items: [{ sku: "CBST-300", qty: 2 }], reason: "Change quantity" }, "key", "r");
    expect(order.items).toEqual([{ sku: "CBST-300", qty: 2, unitPriceVnd: 109000 }]);
    expect(db.movements.create.mock.calls.map(call => call[0][0].type)).toEqual(["RELEASE", "RESERVE"]);
  });
  it("rejects member assignment before accessing the repository", async () => {
    await expect(new CommerceService({} as never).assignOrder({ id: "m", role: "MEMBER" }, "o", { memberId: "m", expectedVersion: 0, reason: "assign" }, "key", "req")).rejects.toThrow("OWNER_REQUIRED");
  });
  it("rejects edits after shipping", async () => {
    const db = { scopedOrder: async () => ({ status: "SHIPPING", version: 0 }), idempotent: async (_s: string, _k: string, _p: unknown, fn: (s: unknown) => unknown) => fn("s") };
    await expect(new CommerceService(db as never).editOrder(owner, "o", { expectedVersion: 0, items: [{ sku: "CBST-300", qty: 1 }], reason: "edit" }, "key", "req")).rejects.toThrow("ORDER_LOCKED");
  });
  it("blocks return quantities exceeding original shipment", async () => {
    const db = { scopedOrder: async () => ({ status: "RETURN_REQUESTED", version: 0, shippedAt: new Date(), allocations: [{ batchId: "b", qty: 1, returnedQty: 1 }] }), idempotent: async (_s: string, _k: string, _p: unknown, fn: (s: unknown) => unknown) => fn("s") };
    await expect(new CommerceService(db as never).receiveReturn(owner, "o", { expectedVersion: 0, lines: [{ batchId: "b", qty: 1, disposition: "RESTOCK" }], reason: "inspected", inspectionReference: "photo-1" }, "key", "req")).rejects.toThrow("RETURN_EXCEEDS_SHIPPED");
  });
});
describe("return financial recognition", () => {
  it("uses recovered COGS and returned revenue without deducting linked refunds twice", () => {
    expect(commissionTarget({ status: "PARTIALLY_RETURNED", deliveredAt: new Date(), responsibleMemberId: "m", totalVnd: 218000, receiptsVnd: 218000, refundsVnd: 109000, returnValueVnd: 109000, returnRefundsVnd: 109000, cogsVnd: 65000, directCostsVnd: 0, costsFinalized: true, commissionRateBps: 4000 })).toBe(17600);
  });
});
describe("controller and guard contracts", () => {
  it("marks reset consumption public and reset issuance/returns owner-only", () => {
    const reflector = new Reflector();
    expect(reflector.get("public", CommerceController.prototype.resetPassword)).toBe(true);
    expect(reflector.get("owner", CommerceController.prototype.issueReset)).toBe(true);
    expect(reflector.get("owner", CommerceController.prototype.receiveReturn)).toBe(true);
    expect(reflector.get("public", CommerceController.prototype.editOrder)).toBeUndefined();
  });
  it("rejects an authenticated member from owner routes", async () => {
    const reflector = { getAllAndOverride: (key: string) => key === "owner" };
    const auth = { authenticate: vi.fn(async () => ({ id: "m", role: "MEMBER" })) };
    const req = { method: "GET", cookies: { cbst_session: "a".repeat(43) } };
    const context = { getHandler: () => ({}), getClass: () => ({}), switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ setHeader: vi.fn() }) }) };
    await expect(new ApiGuard(reflector as never, auth as never, {} as never).canActivate(context as never)).rejects.toThrow("OWNER_REQUIRED");
  });
  it("rejects duplicate return batch lines and short reset passwords", async () => {
    const line = { batchId: "123e4567-e89b-42d3-a456-426614174000", qty: 1, disposition: "RESTOCK" };
    expect((await validate(plainToInstance(ReturnDto, { expectedVersion: 0, lines: [line, line], reason: "return", inspectionReference: "photo" }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(ResetPasswordDto, { token: "a".repeat(43), password: "short" }))).length).toBeGreaterThan(0);
  });
});
