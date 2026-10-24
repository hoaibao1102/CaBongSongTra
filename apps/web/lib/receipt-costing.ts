type ReceiptCostItem = { sku: string; qty: number; purchasePriceVnd: number };

export function previewReceiptCost<T extends ReceiptCostItem>(items: T[], shippingFeeVnd: number) {
  const lines = items.filter(item => item.qty > 0).map(item => ({
    ...item,
    lineTotalVnd: item.qty * item.purchasePriceVnd,
    allocatedShippingVnd: 0,
    totalCostVnd: item.qty * item.purchasePriceVnd,
    buckets: [{ qty: item.qty, landedUnitCostVnd: item.purchasePriceVnd }],
  }));
  const subtotalVnd = lines.reduce((sum, line) => sum + line.lineTotalVnd, 0);
  if (lines.length && subtotalVnd === 0 && shippingFeeVnd > 0) {
    return { lines: [] as typeof lines, subtotalVnd, totalCostVnd: shippingFeeVnd,
      policyError: "ZERO_VALUE_FREIGHT_ALLOCATION_POLICY_REQUIRED" as const };
  }
  if (lines.length && shippingFeeVnd > 0) {
    // Match BUS03 value weights and first-largest remainder tie breaking.
    const weights = lines.map(line => line.lineTotalVnd);
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    const shares = weights.map(weight => Math.floor(shippingFeeVnd * weight / totalWeight));
    const remainder = shippingFeeVnd - shares.reduce((sum, share) => sum + share, 0);
    const largest = weights.indexOf(Math.max(...weights));
    shares[largest] += remainder;
    lines.forEach((line, index) => {
      const freight = shares[index];
      const lowerCost = line.purchasePriceVnd + Math.floor(freight / line.qty);
      const higherQty = freight % line.qty;
      line.allocatedShippingVnd = freight;
      line.totalCostVnd += freight;
      line.buckets = [{ qty: line.qty - higherQty, landedUnitCostVnd: lowerCost }];
      if (higherQty) line.buckets.push({ qty: higherQty, landedUnitCostVnd: lowerCost + 1 });
    });
  }
  return { lines, subtotalVnd, totalCostVnd: subtotalVnd + shippingFeeVnd, policyError: null };
}
