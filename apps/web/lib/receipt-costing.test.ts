import { describe, expect, it } from "vitest";
import { previewReceiptCost } from "./receipt-costing";

describe("purchase receipt costing preview (BUS03)", () => {
  it("allows free goods with zero freight and ignores unreceived rows", () => {
    const preview = previewReceiptCost([
      { sku: "CBST-300", qty: 3, purchasePriceVnd: 0 },
      { sku: "CBST-400", qty: 0, purchasePriceVnd: 100 },
    ], 0);
    expect(preview.policyError).toBeNull();
    expect(preview.totalCostVnd).toBe(0);
    expect(preview.lines).toHaveLength(1);
    expect(preview.lines[0].buckets).toEqual([{ qty: 3, landedUnitCostVnd: 0 }]);
  });
  it("uses value weights and assigns rounding remainder to the first maximum", () => {
    const preview = previewReceiptCost([
      { sku: "CBST-300", qty: 3, purchasePriceVnd: 100 },
      { sku: "CBST-400", qty: 1, purchasePriceVnd: 300 },
      { sku: "CBST-600", qty: 2, purchasePriceVnd: 0 },
    ], 3);
    expect(preview.lines.map(line => line.allocatedShippingVnd)).toEqual([2, 1, 0]);
    expect(preview.totalCostVnd).toBe(603);
    expect(preview.lines.reduce((sum, line) => sum + line.totalCostVnd, 0)).toBe(603);
    for (const line of preview.lines) {
      expect(line.buckets.reduce((sum, bucket) => sum + bucket.qty, 0)).toBe(line.qty);
      expect(line.buckets.reduce((sum, bucket) => sum + bucket.qty * bucket.landedUnitCostVnd, 0)).toBe(line.totalCostVnd);
    }
  });
  it("blocks free-goods freight until an allocation policy is approved", () => {
    const preview = previewReceiptCost([
      { sku: "CBST-300", qty: 3, purchasePriceVnd: 0 },
      { sku: "CBST-400", qty: 1, purchasePriceVnd: 0 },
    ], 7);
    expect(preview.policyError).toBe("ZERO_VALUE_FREIGHT_ALLOCATION_POLICY_REQUIRED");
    expect(preview.lines).toEqual([]);
    expect(preview.totalCostVnd).toBe(7);
  });
  it("represents indivisible freight as exact integer-cost buckets", () => {
    const preview = previewReceiptCost([{ id: "a", sku: "CBST-300", qty: 3, purchasePriceVnd: 100 }], 2);
    expect(preview.subtotalVnd).toBe(300);
    expect(preview.totalCostVnd).toBe(302);
    expect(preview.lines[0].buckets).toEqual([
      { qty: 1, landedUnitCostVnd: 100 },
      { qty: 2, landedUnitCostVnd: 101 },
    ]);
    expect(preview.lines[0].totalCostVnd).toBe(302);
  });
});
