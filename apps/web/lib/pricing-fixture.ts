export const quote = {
  pricingFingerprint: "abc123", pricingMode: "PUBLIC_PROMOTIONS" as const,
  items: [{ sku: "CBST-300", qty: 1, retailUnitPriceVnd: 100, unitPriceVnd: 90,
    grossLineTotalVnd: 100, lineDiscountVnd: 10, finalLineTotalVnd: 90,
    discountSourceType: "PROMOTION" as const }],
  merchandiseSubtotalVnd: 100, discountVnd: 10, totalVnd: 90,
  pricedAt: "2026-10-12T00:00:00.000Z",
};
