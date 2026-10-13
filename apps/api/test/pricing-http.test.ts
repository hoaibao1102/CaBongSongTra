/* eslint-disable @typescript-eslint/no-explicit-any */
import "reflect-metadata";
import { describe, it, expect, vi } from "vitest";
import { ValidationPipe, RequestMethod, ConflictException, HttpException } from "@nestjs/common";
import { CommerceController } from "../src/v2/controller";
import { ApiErrorFilter, ApiGuard } from "../src/v2/http";
import { Reflector } from "@nestjs/core";
import * as dto from "../src/v2/dto";

const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
const items = [{ sku: "CBST-300", qty: 1 }];
const customer = { name: "Test", phone: "0901234567", address: "123 Street", area: "City" };
const guards = { clientExpectedTotalVnd: 100, pricingFingerprint: "abc123" };
const validate = (name: string, value: unknown) => {
  const metatype = (dto as Record<string, any>)[name];
  expect(metatype).toBeTypeOf("function");
  return pipe.transform(value, { type: "body", metatype });
};
describe("pricing HTTP DTO contracts", () => {
  it("strictly separates public and internal quote inputs", async () => {
    await expect(validate("PublicQuoteDto", { items })).resolves.toMatchObject({ items });
    for (const extra of [{ voucherCode: "SECRET" }, { customerPhone: customer.phone }, { customer }, { totalVnd: 1 }]) {
      await expect(validate("PublicQuoteDto", { items, ...extra })).rejects.toThrow();
    }
    await expect(validate("InternalQuoteDto", { items, voucherCode: "SAVE", customerPhone: customer.phone })).resolves.toMatchObject({ voucherCode: "SAVE" });
    await expect(validate("InternalQuoteDto", { items, customer })).rejects.toThrow();
    await expect(validate("PublicQuoteDto", { items: [{ ...items[0], price: 1 }] })).rejects.toThrow();
  });
  it("requires checkout guards and public consent without accepting public vouchers", async () => {
    const input = { customer, items, source: "DIRECT", ...guards };
    await expect(validate("CheckoutDto", { ...input, consent: true })).resolves.toBeDefined();
    await expect(validate("InternalCheckoutDto", { ...input, voucherCode: "SAVE" })).resolves.toBeDefined();
    await expect(validate("CheckoutDto", input)).rejects.toThrow();
    await expect(validate("CheckoutDto", { ...input, consent: true, voucherCode: "SAVE" })).rejects.toThrow();
    for (const name of ["CheckoutDto", "InternalCheckoutDto"]) {
      for (const field of Object.keys(guards)) {
        const missing: Record<string, unknown> = { ...input, ...(name === "CheckoutDto" ? { consent: true } : {}) };
        delete missing[field];
        await expect(validate(name, missing)).rejects.toThrow();
      }
    }
  });
  it("requires full discount configuration plus expectedVersion for patches", async () => {
    const config = { name: "Sale", active: true, kind: "PERCENT", value: 1000, maxDiscountVnd: 10000, startAt: "2026-01-01T00:00:00Z", endAt: "2027-01-01T00:00:00Z" };
    for (const [name, fields] of [["UpdatePromotionDto", { sku: "CBST-300" }], ["UpdateVoucherDto", { code: "SAVE", minSubtotalVnd: 0, maxUsageTotal: 10, maxUsagePerCustomer: 1, assignedMemberIds: [] }]] as const) {
      await expect(validate(name, { ...config, ...fields, expectedVersion: 0 })).resolves.toBeDefined();
      await expect(validate(name, { ...config, ...fields })).rejects.toThrow();
      await expect(validate(name, { active: false, expectedVersion: 0 })).rejects.toThrow();
      await expect(validate(name, { ...config, ...fields, expectedVersion: 0, reservedCount: 10 })).rejects.toThrow();
    }
  });
});

describe("pricing HTTP routes", () => {
  const routes = [
    ["publicQuote", "pricing/quote", "POST", "public"],
    ["internalQuote", "internal/pricing/quote", "POST", "authenticated"],
    ["promotions", "promotions", "GET", "owner"],
    ["createPromotion", "promotions", "POST", "owner"],
    ["updatePromotion", "promotions/:id", "PATCH", "owner"],
    ["deletePromotion", "promotions/:id", "DELETE", "owner"],
    ["vouchers", "vouchers", "GET", "authenticated"],
    ["createVoucher", "vouchers", "POST", "owner"],
    ["updateVoucher", "vouchers/:id", "PATCH", "owner"],
    ["deleteVoucher", "vouchers/:id", "DELETE", "owner"],
    ["verifyVoucher", "vouchers/verify", "POST", "authenticated"],
    ["voucherRedemptions", "vouchers/:id/redemptions", "GET", "owner"],
    ["voucherCounters", "vouchers/:id/counters", "GET", "owner"],
  ] as const;
  it.each(routes)("registers %s with the correct access boundary", (name, path, method, access) => {
    const handler = (CommerceController.prototype as any)[name];
    expect(handler).toBeTypeOf("function");
    expect(Reflect.getMetadata("path", handler)).toBe(path);
    expect(Reflect.getMetadata("method", handler)).toBe(RequestMethod[method]);
    expect(Reflect.getMetadata("public", handler)).toBe(access === "public" ? true : undefined);
    expect(Reflect.getMetadata("owner", handler)).toBe(access === "owner" ? true : undefined);
  });
  it("delegates quotes and verify to quote, and CRUD to the real discounts signatures", async () => {
    const discounts = Object.fromEntries(["listPromotions", "createPromotion", "updatePromotion", "deletePromotion", "listVouchers", "createVoucher", "updateVoucher", "deleteVoucher", "listRedemptions", "listCustomerCounters"].map(name => [name, vi.fn().mockResolvedValue({ ok: true })]));
    const service = { discounts, quote: vi.fn().mockResolvedValue({ totalVnd: 100 }) };
    const controller = new CommerceController(service as any, {} as any, {} as any, {} as any) as any;
    const req = { actor: { id: "actor", role: "OWNER_ADMIN" }, requestId: "request", get: () => "idempotency-key-123" };
    const input = { items, customerPhone: customer.phone, voucherCode: "SAVE" };
    await controller.publicQuote({ items });
    expect(service.quote).toHaveBeenLastCalledWith(null, { items });
    for (const method of ["internalQuote", "verifyVoucher"]) {
      expect(await controller[method](req, input)).toEqual({ totalVnd: 100 });
      expect(service.quote).toHaveBeenLastCalledWith(req.actor, input);
    }
    for (const entity of ["Promotion", "Voucher"]) {
      await controller[`create${entity}`](req, input);
      expect(discounts[`create${entity}`]).toHaveBeenCalledWith(req.actor, input, req.get(), req.requestId);
      for (const action of ["update", "delete"]) {
        await controller[`${action}${entity}`](req, "id", input);
        expect(discounts[`${action}${entity}`]).toHaveBeenCalledWith(req.actor, "id", input, req.get(), req.requestId);
      }
    }
    for (const [handler, method, args] of [["promotions", "listPromotions", []], ["vouchers", "listVouchers", []], ["voucherRedemptions", "listRedemptions", ["id"]], ["voucherCounters", "listCustomerCounters", ["id"]]] as const) {
      await controller[handler](req, ...args);
      expect(discounts[method]).toHaveBeenCalledWith(req.actor, ...args);
    }
  });
});

describe("pricing HTTP safe errors", () => {
  const quote = { pricingFingerprint: "abc123", pricingMode: "PUBLIC_PROMOTIONS", pricedAt: "2026-10-12T00:00:00Z", merchandiseSubtotalVnd: 100, discountVnd: 10, totalVnd: 90,
    items: [{ sku: "CBST-300", qty: 1, retailUnitPriceVnd: 100, unitPriceVnd: 90, grossLineTotalVnd: 100, lineDiscountVnd: 10, finalLineTotalVnd: 90, discountSourceType: "PROMOTION" }] };
  function envelope(error: unknown) {
    const response = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    new ApiErrorFilter().catch(error, { switchToHttp: () => ({ getRequest: () => ({ requestId: "request" }), getResponse: () => response }) } as any);
    return response.json.mock.calls[0][0];
  }
  it("preserves only allowlisted stale quote fields at error.quote", () => {
    const result = envelope(new ConflictException({ message: "PRICE_STALE_CONFIRMATION_REQUIRED", quote: { ...quote, voucherCode: "SECRET", customerPhone: "SECRET", items: [{ ...quote.items[0], landedUnitCostVnd: 12, discountLabelSnapshot: "SECRET" }] }, stack: "SECRET" }));
    expect(result.error.quote).toEqual(quote);
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(result.error.code).toBe("PRICE_STALE_CONFIRMATION_REQUIRED");
  });
  it("accepts the service code envelope and quote wire shape", () => {
    const { pricingMode, totalVnd, ...fields } = quote;
    const wire = { ...fields, mode: pricingMode, orderTotalVnd: totalVnd };
    const result = envelope(new ConflictException({ code: "PRICE_STALE_CONFIRMATION_REQUIRED", quote: wire }));
    expect(result.error.code).toBe("PRICE_STALE_CONFIRMATION_REQUIRED");
    expect(result.error.quote).toEqual(wire);
  });
  it("drops malformed quotes and quotes on unrelated errors", () => {
    for (const invalid of [{ ...quote, totalVnd: Infinity }, { ...quote, totalVnd: -1 }, { ...quote, discountVnd: 0.5 }, { ...quote, items: [{ ...quote.items[0], qty: 0 }] }, { ...quote, items: [{ ...quote.items[0], unitPriceVnd: Number.MAX_VALUE }] }]) {
      expect(envelope(new ConflictException({ message: "PRICE_STALE_CONFIRMATION_REQUIRED", quote: invalid })).error.quote).toBeUndefined();
    }
    expect(envelope(new ConflictException({ message: "VERSION_CONFLICT", quote })).error.quote).toBeUndefined();
    expect(envelope(new HttpException({ message: "PRICE_STALE_CONFIRMATION_REQUIRED", quote }, 500)).error.quote).toBeUndefined();
    expect(JSON.stringify(envelope(new Error("SECRET")))).not.toContain("SECRET");
  });
  it("rejects object-valued enum fields instead of echoing their secrets", () => {
    const mode = { toString: () => "PUBLIC_PROMOTIONS", secret: "SECRET" };
    const source = { toString: () => "PROMOTION", secret: "SECRET" };
    for (const invalid of [{ ...quote, pricingMode: mode }, { ...quote, items: [{ ...quote.items[0], discountSourceType: source }] }]) {
      expect(envelope(new ConflictException({ message: "PRICE_STALE_CONFIRMATION_REQUIRED", quote: invalid })).error.quote).toBeUndefined();
    }
  });
  it("sets no-store for public catalog and quote requests through the guard", async () => {
    const old = { origin: process.env.CORS_ALLOWED_ORIGINS, secret: process.env.SESSION_SECRET };
    process.env.CORS_ALLOWED_ORIGINS = "https://shop.example";
    process.env.SESSION_SECRET = "test-secret";
    try {
      for (const name of ["products", "product", "publicQuote"]) {
        const response = { setHeader: vi.fn() };
        const request = { method: name === "publicQuote" ? "POST" : "GET", path: "/pricing/quote", ip: "127.0.0.1", is: () => true, get: (key: string) => key === "Origin" ? "https://shop.example" : undefined };
        const guard = new ApiGuard(new Reflector(), {} as any, { rates: { findOneAndUpdate: () => ({ lean: async () => ({ count: 1 }) }) } } as any);
        await expect(guard.canActivate({ getHandler: () => (CommerceController.prototype as any)[name], getClass: () => CommerceController, switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) } as any)).resolves.toBe(true);
        expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
      }
    } finally {
      if (old.origin === undefined) delete process.env.CORS_ALLOWED_ORIGINS; else process.env.CORS_ALLOWED_ORIGINS = old.origin;
      if (old.secret === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = old.secret;
    }
  });
});
