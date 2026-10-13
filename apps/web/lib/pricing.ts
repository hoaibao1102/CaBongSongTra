export type PricingItem = {
  sku: string; qty: number; retailUnitPriceVnd: number; unitPriceVnd: number;
  grossLineTotalVnd: number; lineDiscountVnd: number; finalLineTotalVnd: number;
  discountSourceType: "NONE" | "PROMOTION" | "VOUCHER";
  discountLabelSnapshot?: string;
};
export type PricingQuote = {
  pricingFingerprint: string;
  pricingMode: "BASE_PRICE" | "PUBLIC_PROMOTIONS" | "INTERNAL_VOUCHER";
  items: PricingItem[];
  merchandiseSubtotalVnd: number; discountVnd: number; totalVnd: number; pricedAt?: string;
};
const money = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
export function safeQuote(value: unknown): PricingQuote | undefined {
  if (!value || typeof value !== "object") return;
  const raw = value as PricingQuote & { mode?: PricingQuote["pricingMode"]; orderTotalVnd?: number };
  const q = { ...raw, pricingMode: raw.mode ?? raw.pricingMode, totalVnd: raw.orderTotalVnd ?? raw.totalVnd };
  if (typeof q.pricingFingerprint !== "string" || !/^[A-Za-z0-9:_-]{1,256}$/.test(q.pricingFingerprint) ||
    !["BASE_PRICE", "PUBLIC_PROMOTIONS", "INTERNAL_VOUCHER"].includes(q.pricingMode) ||
    (q.pricedAt !== undefined && (typeof q.pricedAt !== "string" || !Number.isFinite(Date.parse(q.pricedAt)))) ||
    ![q.merchandiseSubtotalVnd, q.discountVnd, q.totalVnd].every(money) ||
    q.merchandiseSubtotalVnd - q.discountVnd !== q.totalVnd ||
    !Array.isArray(q.items) || !q.items.length || q.items.length > 100) return;
  const items: PricingItem[] = [];
  for (const i of q.items) {
    if (!i || typeof i.sku !== "string" || !/^CBST-[A-Z0-9-]+$/.test(i.sku) ||
      !Number.isSafeInteger(i.qty) || i.qty < 1 || i.qty > 100 ||
      ![i.retailUnitPriceVnd, i.grossLineTotalVnd, i.lineDiscountVnd, i.finalLineTotalVnd].every(money) ||
      !Number.isFinite(i.unitPriceVnd) || i.unitPriceVnd < 0 || i.unitPriceVnd > Number.MAX_SAFE_INTEGER ||
      i.grossLineTotalVnd - i.lineDiscountVnd !== i.finalLineTotalVnd ||
      !["NONE", "PROMOTION", "VOUCHER"].includes(i.discountSourceType)) return;
    items.push({ sku: i.sku, qty: i.qty, retailUnitPriceVnd: i.retailUnitPriceVnd,
      unitPriceVnd: i.unitPriceVnd, grossLineTotalVnd: i.grossLineTotalVnd,
      lineDiscountVnd: i.lineDiscountVnd, finalLineTotalVnd: i.finalLineTotalVnd,
      discountSourceType: i.discountSourceType });
  }
  if (new Set(items.map(i => i.sku)).size !== items.length ||
    items.reduce((s, i) => s + i.grossLineTotalVnd, 0) !== q.merchandiseSubtotalVnd ||
    items.reduce((s, i) => s + i.lineDiscountVnd, 0) !== q.discountVnd) return;
  return { pricingFingerprint: q.pricingFingerprint, pricingMode: q.pricingMode,
    items, merchandiseSubtotalVnd: q.merchandiseSubtotalVnd, discountVnd: q.discountVnd,
    totalVnd: q.totalVnd, ...(q.pricedAt === undefined ? {} : { pricedAt: q.pricedAt }) };
}
