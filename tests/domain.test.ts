import { describe, expect, it } from "vitest";
import {
  calculateCommission,
  derivePaymentStatus,
  isValidOrderTransition,
  selectFulfillmentBatches,
} from "../lib/domain";

describe("order state machine", () => {
  it("allows only canonical transitions", () => {
    expect(isValidOrderTransition("DRAFT", "CONFIRMED")).toBe(true);
    expect(isValidOrderTransition("CONFIRMED", "PREPARING")).toBe(true);
    expect(isValidOrderTransition("PREPARING", "SHIPPING")).toBe(true);
    expect(isValidOrderTransition("SHIPPING", "DELIVERED")).toBe(true);
    expect(isValidOrderTransition("DRAFT", "DELIVERED")).toBe(false);
    expect(isValidOrderTransition("DELIVERED", "CANCELLED")).toBe(false);
  });
});

describe("payment status", () => {
  it("derives status from receipts and refunds", () => {
    expect(derivePaymentStatus(199_000, 0, 0)).toBe("UNPAID");
    expect(derivePaymentStatus(199_000, 100_000, 0)).toBe("PARTIALLY_PAID");
    expect(derivePaymentStatus(199_000, 199_000, 0)).toBe("PAID");
    expect(derivePaymentStatus(199_000, 199_000, 50_000)).toBe("PARTIALLY_REFUNDED");
    expect(derivePaymentStatus(199_000, 199_000, 199_000)).toBe("REFUNDED");
  });
});

describe("commission", () => {
  it("splits positive profit 40/60 while preserving total", () => {
    expect(calculateCommission({ collected: 199_000, cogs: 140_000, directCosts: 15_000, refunds: 0 })).toEqual({
      baseProfit: 44_000,
      memberAmount: 17_600,
      ownerAmount: 26_400,
    });
  });

  it("does not create positive member commission for a loss", () => {
    expect(calculateCommission({ collected: 100_000, cogs: 140_000, directCosts: 15_000, refunds: 0 })).toEqual({
      baseProfit: -55_000,
      memberAmount: 0,
      ownerAmount: 0,
    });
  });
});

describe("batch allocation", () => {
  it("uses FEFO then FIFO and excludes non-sellable batches", () => {
    const result = selectFulfillmentBatches(
      [
        { id: "newer", available: 3, expiresAt: "2027-04-01", receivedAt: "2026-10-02", status: "AVAILABLE" },
        { id: "earlier-expiry", available: 1, expiresAt: "2027-01-01", receivedAt: "2026-10-03", status: "AVAILABLE" },
        { id: "older", available: 3, expiresAt: "2027-04-01", receivedAt: "2026-10-01", status: "AVAILABLE" },
        { id: "blocked", available: 99, expiresAt: "2026-12-01", receivedAt: "2026-09-01", status: "QUARANTINED" },
      ],
      4,
      new Date("2026-10-09T00:00:00Z"),
    );
    expect(result).toEqual([
      { batchId: "earlier-expiry", quantity: 1 },
      { batchId: "older", quantity: 3 },
    ]);
  });

  it("throws OUT_OF_STOCK when allocation is insufficient", () => {
    expect(() => selectFulfillmentBatches([], 1, new Date())).toThrow("OUT_OF_STOCK");
  });
});
