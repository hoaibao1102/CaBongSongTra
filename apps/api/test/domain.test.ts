import { describe, expect, it } from "vitest";
import { calculateCommission, derivePaymentStatus, isOrderTransitionAllowed, selectReservationBatches } from "../src/domain";

describe("local domain contract", () => {
  it("supports approved transitions, not shortcuts", () => {
    for (const [from, to] of [["PENDING", "CONFIRMED"], ["CONFIRMED", "PACKING"], ["PACKING", "SHIPPING"], ["SHIPPING", "DELIVERED"]] as const) expect(isOrderTransitionAllowed(from, to)).toBe(true);
    expect(isOrderTransitionAllowed("PENDING", "DELIVERED")).toBe(false);
  });
  it("uses FEFO then FIFO, excluding quarantined and expired stock", () => {
    const batch = { available: 1, expiresAt: "2027-03-01", receivedAt: "2026-02-01", status: "AVAILABLE" as const };
    expect(selectReservationBatches([{ ...batch, id: "late" }, { ...batch, id: "early", receivedAt: "2026-01-01" }, { ...batch, id: "first", expiresAt: "2027-01-01" }, { ...batch, id: "blocked", status: "QUARANTINED" }, { ...batch, id: "expired", expiresAt: "2020-01-01" }], 3, new Date("2026-10-10"))).toEqual([{ batchId: "first", quantity: 1 }, { batchId: "early", quantity: 1 }, { batchId: "late", quantity: 1 }]);
    expect(() => selectReservationBatches([], 1, new Date())).toThrow("OUT_OF_STOCK");
    expect(() => selectReservationBatches([], 0.5, new Date())).toThrow("INVALID_QUANTITY");
    expect(() => selectReservationBatches([{ ...batch, id: "bad", available: 0.5 }], 1, new Date())).toThrow("INVALID_BATCH_QUANTITY");
  });
  it("derives payment status and preserves genuine losses", () => {
    expect(derivePaymentStatus(199000, 100000, 0)).toBe("PARTIALLY_PAID");
    expect(derivePaymentStatus(199000, 199000, 50000)).toBe("PARTIALLY_REFUNDED");
    expect(calculateCommission({ ownerRole: "MEMBER", sellingPriceVnd: 100000, originalCostVnd: 140000, eligible: true })).toEqual({ baseProfitVnd: -40000, memberAmountVnd: 0, ownerAmountVnd: -40000 });
    expect(calculateCommission({ ownerRole: "MEMBER", sellingPriceVnd: 199000, originalCostVnd: 140000, eligible: true })).toEqual({ baseProfitVnd: 59000, memberAmountVnd: 23600, ownerAmountVnd: 35400 });
    expect(() => calculateCommission({ ownerRole: "MEMBER", sellingPriceVnd: 0.5, originalCostVnd: 0, eligible: true })).toThrow("INVALID_MONEY");
    expect(() => calculateCommission({ ownerRole: "MEMBER", sellingPriceVnd: 1, originalCostVnd: 0, eligible: true, memberRateBps: -1 })).toThrow("INVALID_RATE");
  });
});
