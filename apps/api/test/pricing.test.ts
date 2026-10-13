import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { allocateDiscount, returnCredit } from "../src/v2/pricing";
import { CommerceService } from "../src/v2/service";

describe("integer pricing", () => {
  it("allocates every dong by largest remainder with stable input-order ties", () => {
    expect(allocateDiscount([10, 20, 30], 7)).toEqual([1, 2, 4]);
    expect(allocateDiscount([1, 1, 1], 2)).toEqual([1, 1, 0]);
    expect(allocateDiscount([0, 0], 0)).toEqual([0, 0]);
    expect(allocateDiscount([Number.MAX_SAFE_INTEGER - 1, 1], 3)).toEqual([3, 0]);
  });
  it("credits cumulative snapshot fractions and preserves legacy unit-price returns", () => {
    const item = { qty: 3, unitPriceVnd: 100 / 3, finalLineTotalVnd: 100 };
    expect([0, 1, 2].map(before => returnCredit(2, item, before, 1))).toEqual([33, 33, 34]);
    expect(returnCredit(undefined, { qty: 3, unitPriceVnd: 37 }, 1, 2)).toBe(74);
    expect(() => returnCredit(2, item, 2, 2)).toThrow("RETURN_EXCEEDS_SHIPPED");
  });
  it("uses cumulative SKU returns across batches in the transactional service", async () => {
    const order = { id: "o", pricingSchemaVersion: 2, status: "RETURN_REQUESTED", version: 0, shippedAt: new Date(), items: [{ sku: "CBST-300", qty: 3, unitPriceVnd: 100 / 3, finalLineTotalVnd: 100 }], allocations: [{ batchId: "a", sku: "CBST-300", qty: 1, returnedQty: 1, landedUnitCostVnd: 0 }, { batchId: "b", sku: "CBST-300", qty: 2, returnedQty: 0, landedUnitCostVnd: 0 }], totalVnd: 100, returnValueVnd: 33, receiptsVnd: 0, refundsVnd: 0, cogsVnd: 0, directCostsVnd: 0, commissionVnd: 0 };
    const db = { scopedOrder: async () => order, idempotent: async (_s: string, _k: string, _p: unknown, work: (s: unknown) => unknown) => work("session"), movements: { create: async () => undefined }, ledger: { create: async () => undefined }, audit: { create: async () => undefined }, saveOrder: async () => undefined };
    await new CommerceService(db as never).receiveReturn({ id: "owner", role: "OWNER_ADMIN" }, "o", { expectedVersion: 0, lines: [{ batchId: "b", qty: 2, disposition: "DISCARD" }], reason: "Inspected", inspectionReference: "photo" }, "key", "request");
    expect(order.returnValueVnd).toBe(100);
  });
});
