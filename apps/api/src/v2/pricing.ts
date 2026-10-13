import { BadRequestException, ConflictException } from "@nestjs/common";
import type { Order, Product, Promotion, Voucher } from "./models";
import { fingerprint } from "./policy";

export function computePricing(lines: Array<{ sku: string; qty: number }>, products: Product[], promotions: Promotion[], voucher?: Voucher, pricedAt = new Date()) {
  const amount = (value: number) => {
    if (!Number.isSafeInteger(value) || value < 0) throw new BadRequestException("INVALID_PRICING_AMOUNT");
    return value;
  };
  const reduction = (gross: number, source: Promotion | Voucher, qty: number) => {
    amount(source.value);
    if (source.kind === "PERCENT") {
      if (source.value > 10000 || source.maxDiscountVnd === undefined) throw new BadRequestException("INVALID_PRICING_AMOUNT");
      return Math.min(gross, amount(source.maxDiscountVnd), Number(BigInt(gross) * BigInt(source.value) / 10000n));
    }
    return Number(BigInt(gross) < BigInt(source.value) * BigInt(qty) ? BigInt(gross) : BigInt(source.value) * BigInt(qty));
  };
  if (!lines.length || new Set(lines.map(line => line.sku)).size !== lines.length) throw new BadRequestException("INVALID_PRICING_ITEMS");
  const bindings: unknown[] = [];
  const items = lines.map(line => {
    if (!Number.isSafeInteger(line.qty) || line.qty < 1) throw new BadRequestException("INVALID_PRICING_ITEMS");
    const product = products.find(value => value.sku === line.sku && value.active);
    if (!product) throw new BadRequestException("PRODUCT_UNAVAILABLE");
    const grossLineTotalVnd = amount(amount(product.retailPriceVnd) * line.qty);
    const active = voucher ? [] : promotions.filter(value => value.sku === line.sku && value.active && !value.deletedAt && value.startAt <= pricedAt && pricedAt < value.endAt);
    if (active.length > 1) throw new ConflictException("PROMOTION_OVERLAP");
    const source = voucher ?? active[0];
    bindings.push({ sku: line.sku, version: product.version, promotionRevision: product.promotionRevision ?? 0, sourceId: source?.id, sourceVersion: source?.version });
    const lineDiscountVnd = !voucher && source ? reduction(grossLineTotalVnd, source, line.qty) : 0;
    return { ...line, retailUnitPriceVnd: product.retailPriceVnd, unitPriceVnd: 0, grossLineTotalVnd, lineDiscountVnd, finalLineTotalVnd: grossLineTotalVnd - lineDiscountVnd,
      discountSourceType: (voucher ? "VOUCHER" : source ? "PROMOTION" : "NONE") as "VOUCHER" | "PROMOTION" | "NONE",
      ...(source ? { discountSourceId: source.id, discountLabelSnapshot: source.name } : {}) };
  });
  const merchandiseSubtotalVnd = amount(items.reduce((sum, item) => sum + item.grossLineTotalVnd, 0));
  if (voucher) {
    const shares = allocateDiscount(items.map(item => item.grossLineTotalVnd), reduction(merchandiseSubtotalVnd, voucher, 1));
    items.forEach((item, index) => { item.lineDiscountVnd = shares[index]; item.finalLineTotalVnd = item.grossLineTotalVnd - shares[index]; });
  }
  items.forEach(item => { item.unitPriceVnd = Math.floor(item.finalLineTotalVnd / item.qty); });
  const discountVnd = amount(items.reduce((sum, item) => sum + item.lineDiscountVnd, 0));
  const mode: NonNullable<Order["pricingMode"]> = voucher ? "INTERNAL_VOUCHER" : items.some(item => item.discountSourceType === "PROMOTION") ? "PUBLIC_PROMOTIONS" : "BASE_PRICE";
  const totals = { mode, merchandiseSubtotalVnd, discountVnd, orderTotalVnd: merchandiseSubtotalVnd - discountVnd };
  return { ...totals, items, pricedAt, ...(voucher ? { voucherId: voucher.id } : {}), pricingFingerprint: fingerprint({ schemaVersion: 2, ...totals, items, bindings }) };
}

export function safeQuote(quote: ReturnType<typeof computePricing>) {
  return { items: quote.items.map(({ sku, qty, unitPriceVnd, retailUnitPriceVnd, grossLineTotalVnd, lineDiscountVnd, finalLineTotalVnd, discountSourceType, discountLabelSnapshot }) => ({ sku, qty, unitPriceVnd, retailUnitPriceVnd, grossLineTotalVnd, lineDiscountVnd, finalLineTotalVnd, discountSourceType, discountLabelSnapshot })),
    mode: quote.mode, merchandiseSubtotalVnd: quote.merchandiseSubtotalVnd, discountVnd: quote.discountVnd, orderTotalVnd: quote.orderTotalVnd, pricingFingerprint: quote.pricingFingerprint };
}

export function returnCredit(schemaVersion: number | undefined, item: { qty: number; unitPriceVnd: number; finalLineTotalVnd?: number }, returnedBefore: number, qty: number): number {
  if (!Number.isSafeInteger(returnedBefore) || !Number.isSafeInteger(qty) || returnedBefore < 0 || qty < 1 || returnedBefore + qty > item.qty) throw new Error("RETURN_EXCEEDS_SHIPPED");
  if (schemaVersion !== 2) return item.unitPriceVnd * qty;
  if (!Number.isSafeInteger(item.finalLineTotalVnd) || item.finalLineTotalVnd! < 0) throw new Error("INVALID_PRICING_SNAPSHOT");
  const total = BigInt(item.finalLineTotalVnd!);
  return Number(total * BigInt(returnedBefore + qty) / BigInt(item.qty) - total * BigInt(returnedBefore) / BigInt(item.qty));
}

export function allocateDiscount(weights: number[], discount: number): number[] {
  if (!Number.isSafeInteger(discount) || discount < 0 || weights.some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error("INVALID_PRICING_AMOUNT");
  const total = weights.reduce((sum, value) => sum + BigInt(value), 0n);
  if (BigInt(discount) > total) throw new Error("INVALID_PRICING_AMOUNT");
  if (!total) return weights.map(() => 0);
  const shares = weights.map((value, index) => {
    const numerator = BigInt(value) * BigInt(discount);
    return { index, amount: Number(numerator / total), remainder: numerator % total };
  });
  let remaining = discount - shares.reduce((sum, share) => sum + share.amount, 0);
  const ranked = [...shares].sort((a, b) => a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1);
  for (const share of ranked) {
    if (!remaining) break;
    share.amount++; remaining--;
  }
  return shares.map(share => share.amount);
}
