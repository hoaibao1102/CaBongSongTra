import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { CommerceService } from "../src/v2/service";
import type { Promotion } from "../src/v2/models";
import { orderProjection } from "../src/v2/policy";
import { computePricing } from "../src/v2/pricing";

const actor = { id: "member", role: "MEMBER" as const };
const session = { inTransaction: () => true };
function fixture() {
  const product = { id: "product", sku: "CBST-300", name: "Fish", netWeightG: 300, retailPriceVnd: 101, active: true, version: 0 };
  const promotion: Promotion = { id: "promo", sku: product.sku, name: "Sale", kind: "PERCENT", value: 5000, maxDiscountVnd: 100, active: true, startAt: new Date(0), endAt: new Date("2099-01-01"), version: 0, createdAt: new Date(), updatedAt: new Date() };
  const sessions: unknown[] = [];
  const query = (value: unknown) => ({ session: (s: unknown) => { sessions.push(s); return query(value); }, lean: async () => value, sort: () => query(value) });
  const db = { products: { findOne: () => query(product), find: () => query([product]) }, users: { findOne: () => query({ id: actor.id, role: "MEMBER", status: "ACTIVE", commissionRateBps: 1750 }) }, promotions: { find: () => query([promotion]) },
    idempotent: async (_scope: string, _key: string, _dto: unknown, work: (s: unknown) => unknown) => work(session),
    batches: { aggregate: () => ({ session: async () => [{ available: 100 }] }) }, orders: { create: vi.fn() }, audit: { create: vi.fn() } };
  return { service: new CommerceService(db as never), db, product, promotion, sessions };
}

describe("V2.2 pricing integration", () => {
  it("handles fixed reductions, half-open promotion windows, zero prices, and invalid amounts", () => {
    const { product, promotion } = fixture();
    promotion.kind = "FIXED_PER_UNIT"; promotion.value = 200;
    promotion.startAt = new Date("2030-01-01"); promotion.endAt = new Date("2030-02-01");
    const lines = [{ sku: product.sku, qty: 3 }];
    expect(computePricing(lines, [product], [promotion], undefined, promotion.startAt).orderTotalVnd).toBe(0);
    expect(computePricing(lines, [product], [promotion], undefined, promotion.endAt)).toMatchObject({ mode: "BASE_PRICE", orderTotalVnd: 303 });
    expect(() => computePricing([...lines, ...lines], [product], [])).toThrow("INVALID_PRICING_ITEMS");
    expect(() => computePricing([{ ...lines[0], qty: 0 }], [product], [])).toThrow("INVALID_PRICING_ITEMS");
    expect(() => computePricing(lines, [{ ...product, retailPriceVnd: Number.MAX_SAFE_INTEGER }], [])).toThrow("INVALID_PRICING_AMOUNT");
  });
  it("allocates percentage vouchers across all retail lines exactly and binds product/voucher versions", () => {
    const { product, promotion } = fixture();
    const products = [product, { ...product, sku: "CBST-400", retailPriceVnd: 202 }];
    const lines = products.map(value => ({ sku: value.sku, qty: 1 }));
    const voucher = { id: "v", version: 0, kind: "PERCENT", value: 5000, maxDiscountVnd: 100, name: "Half" } as const;
    const quote = computePricing(lines, products, [promotion], voucher as never, new Date(1));
    expect(quote.items.map(item => item.lineDiscountVnd)).toEqual([33, 67]);
    expect(quote.orderTotalVnd).toBe(203);
    expect(computePricing(lines, products, [promotion], voucher as never, new Date(2)).pricingFingerprint).toBe(quote.pricingFingerprint);
    expect(computePricing(lines, products, [promotion], { ...voucher, version: 1 } as never).pricingFingerprint).not.toBe(quote.pricingFingerprint);
    product.version++;
    expect(computePricing(lines, products, [promotion], voucher as never).pricingFingerprint).not.toBe(quote.pricingFingerprint);
  });
  it.each([ ["PENDING", "CONFIRMED", "consumeVoucher"], ["PENDING", "CANCELLED", "releaseVoucher"], ["CONFIRMED", "CANCELLED", "releaseVoucher"], ["PACKING", "CANCELLED", "releaseVoucher"] ] as const)("moves voucher lifecycle %s -> %s in the same session", async (from, to, method) => {
    const { service, db } = fixture();
    const order = { id: "o", status: from, version: 0, voucherId: "v", items: [], allocations: [], totalVnd: 0, receiptsVnd: 0, refundsVnd: 0, cogsVnd: 0, directCostsVnd: 0, commissionVnd: 0 };
    Object.assign(db, { scopedOrder: async () => order, saveOrder: vi.fn() });
    const move = vi.spyOn(service.discounts, method).mockResolvedValue(null);
    await service.transition(actor, "o", { status: to, expectedVersion: 0, reason: "test" }, "key", "r");
    expect(move).toHaveBeenCalledWith(order, session);
  });
  it("leaves delivery-failed vouchers consumed and blocks V2 edits with a stable error", async () => {
    const { service, db } = fixture();
    const order = { id: "o", pricingSchemaVersion: 2, status: "SHIPPING", shippedAt: new Date(), version: 0, voucherId: "v", items: [], allocations: [], totalVnd: 0, receiptsVnd: 0, refundsVnd: 0, cogsVnd: 0, directCostsVnd: 0, commissionVnd: 0 };
    Object.assign(db, { scopedOrder: async () => order, saveOrder: vi.fn() });
    const release = vi.spyOn(service.discounts, "releaseVoucher");
    await service.transition(actor, "o", { status: "DELIVERY_FAILED", expectedVersion: 0, reason: "test" }, "key", "r");
    expect(release).not.toHaveBeenCalled();
    await expect(service.editOrder(actor, "o", { items: [], expectedVersion: 0, reason: "test" }, "edit", "r")).rejects.toThrow("PRICED_ORDER_EDIT_REQUIRES_RECREATE");
  });
  it("projects authoritative V2 totals without source IDs and leaves legacy item shapes intact", () => {
    const legacy = { id: "o", status: "PENDING", version: 0, items: [{ sku: "s", qty: 3, unitPriceVnd: 33 }] };
    expect(orderProjection(legacy, actor).items).toEqual(legacy.items);
    const view = orderProjection({ ...legacy, pricingSchemaVersion: 2, merchandiseSubtotalVnd: 120, discountVnd: 20, items: [{ ...legacy.items[0], finalLineTotalVnd: 100, discountSourceId: "secret" }] }, actor);
    expect(view).toMatchObject({ pricingSchemaVersion: 2, merchandiseSubtotalVnd: 120, discountVnd: 20, items: [{ finalLineTotalVnd: 100 }] });
    expect(JSON.stringify(view)).not.toContain("secret");
  });
  it("exposes effective catalog prices without source identifiers", async () => {
    const { service } = fixture();
    expect((await service.products())[0]).toMatchObject({ retailPriceVnd: 101, effectivePriceVnd: 51, promotionLabel: "Sale", promotionEndsAt: new Date("2099-01-01") });
    expect(await service.product("CBST-300")).toMatchObject({ effectivePriceVnd: 51 });
  });
  it("recomputes guards in the transaction before writes and persists exact V2 snapshots", async () => {
    const { service, db, product, sessions } = fixture();
    const items = [{ sku: product.sku, qty: 3 }];
    const quote = await service.quote(actor, { items });
    const dto = { items, customer: { name: "Customer", phone: "0901234567", address: "Home", area: "City" }, source: "INTERNAL", clientExpectedTotalVnd: quote.orderTotalVnd, pricingFingerprint: quote.pricingFingerprint };
    await expect(service.checkout(actor, "", { ...dto, clientExpectedTotalVnd: 1 } as never, "stale", "r")).rejects.toMatchObject({ response: { code: "PRICE_STALE_CONFIRMATION_REQUIRED", quote } });
    await expect(service.checkout(actor, "", { ...dto, pricingFingerprint: "old" } as never, "stale-fingerprint", "r")).rejects.toMatchObject({ response: { code: "PRICE_STALE_CONFIRMATION_REQUIRED", quote } });
    expect(db.orders.create).not.toHaveBeenCalled();
    await service.checkout(actor, "", dto as never, "fresh", "r");
    expect(sessions).toContain(session);
    expect(db.orders.create.mock.calls[0][0][0]).toMatchObject({ pricingSchemaVersion: 2, totalVnd: 203, discountVnd: 100, commissionRateBps: 1750, items: [{ unitPriceVnd: 67, finalLineTotalVnd: 203, discountSourceId: "promo" }] });
  });
  it("reserves vouchers in the checkout session", async () => {
    const { service, product } = fixture();
    vi.spyOn(service.discounts, "verifyVoucher").mockResolvedValue({ id: "v", name: "Private", kind: "FIXED", value: 2, version: 0 } as never);
    const reserve = vi.spyOn(service.discounts, "reserveVoucher").mockResolvedValue({} as never);
    const items = [{ sku: product.sku, qty: 3 }];
    const quote = await service.quote(actor, { items, voucherCode: "V", customerPhone: "0901234567" });
    await service.checkout(actor, "", { items, voucherCode: "V", customer: { name: "C", phone: "0901234567", address: "H", area: "C" }, source: "INTERNAL", clientExpectedTotalVnd: quote.orderTotalVnd, pricingFingerprint: quote.pricingFingerprint } as never, "key", "r");
    expect(reserve).toHaveBeenCalledWith(actor, expect.objectContaining({ code: "V", subtotalVnd: 303, customerPhone: "0901234567" }), session);
  });
  it("quotes capped percentage lines safely and fingerprints configuration, not time", async () => {
    const { service, promotion, product } = fixture();
    const dto = { items: [{ sku: product.sku, qty: 3 }] };
    const quote = await service.quote(null, dto);
    expect(quote).toMatchObject({ mode: "PUBLIC_PROMOTIONS", merchandiseSubtotalVnd: 303, discountVnd: 100, orderTotalVnd: 203 });
    expect(quote.items[0]).toMatchObject({ unitPriceVnd: 67, grossLineTotalVnd: 303, lineDiscountVnd: 100, finalLineTotalVnd: 203 });
    expect(JSON.stringify(quote)).not.toContain('"discountSourceId"');
    expect((await service.quote(null, dto)).pricingFingerprint).toBe(quote.pricingFingerprint);
    promotion.version++;
    expect((await service.quote(null, dto)).pricingFingerprint).not.toBe(quote.pricingFingerprint);
  });
  it("uses retail whole-cart voucher allocation without promotion stacking", async () => {
    const { service, product } = fixture();
    vi.spyOn(service.discounts, "verifyVoucher").mockResolvedValue({ id: "voucher", name: "Private", kind: "FIXED", value: 2, version: 0 } as never);
    const quote = await service.quote(actor, { items: [{ sku: product.sku, qty: 3 }], voucherCode: "PRIVATE", customerPhone: "0901234567" }, session as never);
    expect(quote).toMatchObject({ mode: "INTERNAL_VOUCHER", merchandiseSubtotalVnd: 303, discountVnd: 2, orderTotalVnd: 301 });
    expect(quote.items[0].unitPriceVnd).toBe(100);
    expect(JSON.stringify(quote)).not.toContain("voucher");
    await expect(service.quote(null, { items: [{ sku: product.sku, qty: 1 }], voucherCode: "PRIVATE" })).rejects.toThrow("AUTH_REQUIRED");
  });
});
