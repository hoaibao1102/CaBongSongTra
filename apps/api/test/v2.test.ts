import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CheckoutDto, PaymentDto, TransitionDto } from "../src/v2/dto";
import { orderProjection, orderScope, fingerprint, commissionTarget } from "../src/v2/policy";
import { MongoRepository } from "../src/v2/repository";
import { FinanceLedger } from "../src/finance/finance-ledger";

const options = { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true };
describe("V2 input boundary", () => {
  const checkout = { customer: { name: "Customer", phone: "0912345678", address: "123 Thu Duc", area: "Thu Duc" }, items: [{ sku: "CBST-300", qty: 1 }], consent: true, source: "WEBSITE", clientExpectedTotalVnd: 109000, pricingFingerprint: "test-fingerprint" };
  it("accepts a minimal checkout and rejects price/member injection recursively", async () => {
    expect(await validate(plainToInstance(CheckoutDto, checkout), options)).toHaveLength(0);
    for (const input of [{ ...checkout, responsibleMemberId: "other" }, { ...checkout, items: [{ ...checkout.items[0], priceVnd: 1 }] }, { ...checkout, consent: false }]) {
      expect((await validate(plainToInstance(CheckoutDto, input), options)).length).toBeGreaterThan(0);
    }
  });
  it("rejects fractional money, coerced quantities and unbounded payloads", async () => {
    for (const amountVnd of [0, -1, 1.5, Number.MAX_SAFE_INTEGER, "1000"]) {
      expect((await validate(plainToInstance(PaymentDto, { amountVnd, method: "CASH", expectedVersion: 0 }), options)).length).toBeGreaterThan(0);
    }
    expect((await validate(plainToInstance(CheckoutDto, { ...checkout, items: [{ sku: "CBST-300", qty: "1" }] }), options)).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(TransitionDto, { status: "PAID", expectedVersion: 0 }), options)).length).toBeGreaterThan(0);
  });
});

describe("V2 ownership and explicit projections", () => {
  it("always puts member scope into the database query", () => {
    expect(orderScope({ id: "a", role: "MEMBER" })).toEqual({ responsibleMemberId: "a" });
    expect(orderScope({ id: "owner", role: "OWNER_ADMIN" })).toEqual({});
  });
  it("does not serialize internal fields, costs, or future secret fields for members", () => {
    const stored = { id: "o", status: "PENDING", version: 0, items: [{ sku: "CBST-300", qty: 1, unitPriceVnd: 109000, landedUnitCostVnd: 65000 }], cogsVnd: 65000, secret: "secret", allocations: [{ batchId: "b", sku: "CBST-300", qty: 1, landedUnitCostVnd: 65000 }] };
    const result = orderProjection(stored, { id: "a", role: "MEMBER" });
    expect(JSON.stringify(result)).not.toMatch(/65000|secret|allocations|landedUnitCost/);
  });
  it("projects nested customer fields rather than forwarding a stored object", () => {
    const stored = { id: "o", status: "PENDING", version: 0, items: [], customer: { name: "Customer", phone: "+84912345678", address: "Address", area: "Area", internalRiskNote: "secret" } };
    expect(JSON.stringify(orderProjection(stored, { id: "m", role: "MEMBER" }))).not.toContain("secret");
  });
  it("shows earned commission to the assigned member without exposing costs", () => {
    const result = orderProjection({ id: "o", status: "DELIVERED", version: 1, items: [], commissionVnd: 51026, cogsVnd: 259434 }, { id: "m", role: "MEMBER" });
    expect(result.commissionVnd).toBe(51026);
    expect(result).not.toHaveProperty("cogsVnd");
  });
  it("canonicalizes object keys but binds idempotency to values and array order", () => {
    expect(fingerprint({ b: 2, a: 1 })).toBe(fingerprint({ a: 1, b: 2 }));
    expect(fingerprint({ a: 1 })).not.toBe(fingerprint({ a: 2 }));
  });
  it("calculates commission from delivered product margin at the member's rate", () => {
    const order = { status: "DELIVERED", responsibleMemberId: "m", totalVnd: 199000, receiptsVnd: 199000, refundsVnd: 0, cogsVnd: 140000, directCostsVnd: 15000, costsFinalized: true, commissionRateBps: 4000 };
    expect(commissionTarget(order)).toBe(23600);
    expect(commissionTarget({ ...order, costsFinalized: false })).toBe(23600);
    expect(commissionTarget({ ...order, status: "SHIPPING" })).toBe(0);
    expect(commissionTarget({ ...order, responsibleMemberId: null })).toBe(0);
    expect(commissionTarget({ ...order, refundsVnd: 50000 })).toBe(3600);
  });
});

describe("V2 transaction envelope", () => {
  it("ends sessions even when a write fails and does not execute writes outside a transaction", async () => {
    const endSession = vi.fn();
    const session = { withTransaction: vi.fn(async (work: () => Promise<unknown>) => work()), endSession };
    const connection = { startSession: vi.fn(async () => session), models: {}, model: vi.fn(() => ({})) };
    const repository = new MongoRepository(connection as never);
    await expect(repository.transaction(async () => { throw new Error("failure"); })).rejects.toThrow("failure");
    expect(session.withTransaction).toHaveBeenCalledOnce();
    expect(endSession).toHaveBeenCalledOnce();
  });
});

describe("ledger retry regression", () => {
  it("replays a full refund before checking the remaining balance", () => {
    const ledger = new FinanceLedger(100);
    ledger.receipt({ id: "p", amountVnd: 100, idempotencyKey: "p" });
    const input = { id: "r", amountVnd: 100, idempotencyKey: "r" };
    expect(ledger.refund(input)).toEqual(ledger.refund(input));
    expect(ledger.entries).toHaveLength(2);
  });
  it("rejects reusing a key with a different payload or ledger kind", () => {
    const ledger = new FinanceLedger(100);
    ledger.receipt({ id: "p", amountVnd: 100, idempotencyKey: "key" });
    expect(() => ledger.receipt({ id: "p", amountVnd: 50, idempotencyKey: "key" })).toThrow("IDEMPOTENCY_CONFLICT");
    expect(() => ledger.refund({ id: "p", amountVnd: 100, idempotencyKey: "key" })).toThrow("IDEMPOTENCY_CONFLICT");
  });
});
