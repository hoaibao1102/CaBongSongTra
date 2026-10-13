import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateProductDto, ProductDto } from "../src/v2/dto";
import { CommerceService } from "../src/v2/service";
import { orderProjection, commissionTarget } from "../src/v2/policy";
import { AuthService } from "../src/auth/auth.service";
import { hashPassword } from "../src/auth/password";
import { ApiErrorFilter } from "../src/v2/http";
import { ForbiddenException } from "@nestjs/common";
const owner = { id: "o", role: "OWNER_ADMIN" as const };
afterEach(() => vi.unstubAllEnvs());
describe("owner catalog", () => {
  it("creates the canonical weight without trusting client weight and journals in the same transaction", async () => {
    const db = { idempotent: async (_s: string, _k: string, _p: unknown, work: (s: unknown) => unknown) => work("session"), products: { create: vi.fn() }, audit: { create: vi.fn() } };
    const result = await new CommerceService(db as never).createProduct(owner, { sku: "CBST-400", name: " Product ", retailPriceVnd: 139000, active: false }, "key", "request");
    expect(result).toMatchObject({ sku: "CBST-400", name: "Product", netWeightG: 400, active: false, version: 0 });
    expect(db.products.create).toHaveBeenCalledWith([result], { session: "session" });
    expect(db.audit.create).toHaveBeenCalledWith([expect.objectContaining({ action: "PRODUCT_CREATED" })], { session: "session" });
  });
  it("lists inactive products with version using an explicit projection", async () => {
    const find = vi.fn(() => ({ sort: () => ({ lean: async () => [] }) }));
    await new CommerceService({ products: { find } } as never).ownerProducts(owner);
    expect(find).toHaveBeenCalledWith({}, { _id: 0, id: 1, sku: 1, name: 1, netWeightG: 1, retailPriceVnd: 1, active: 1, version: 1 });
    await expect(new CommerceService({} as never).ownerProducts({ id: "m", role: "MEMBER" })).rejects.toThrow("OWNER_REQUIRED");
  });
  it("rejects unknown fields, arbitrary SKUs, fractional prices and string booleans", async () => {
    const good = { sku: "CBST-300", name: "Product", retailPriceVnd: 109000, active: false };
    expect(await validate(plainToInstance(CreateProductDto, good), { whitelist: true, forbidNonWhitelisted: true })).toHaveLength(0);
    for (const patch of [{ sku: "OTHER" }, { sku: "CBST-500" }, { sku: "CBST-XYZ" }, { cost: 1 }, { retailPriceVnd: 1.5 }, { active: "true" }, { netWeightG: 600 }]) expect((await validate(plainToInstance(CreateProductDto, { ...good, ...patch }), { whitelist: true, forbidNonWhitelisted: true })).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(ProductDto, { expectedVersion: 0, retailPriceVnd: 1, active: true, sku: "CBST-600" }), { whitelist: true, forbidNonWhitelisted: true })).length).toBeGreaterThan(0);
  });
});
describe("owner return view", () => {
  it("exposes whitelisted allocations and bounded balances only to owners", () => {
    const order = { id: "order", status: "PARTIALLY_RETURNED", version: 2, items: [], totalVnd: 218000, receiptsVnd: 218000, refundsVnd: 50000, returnValueVnd: 109000, returnRefundsVnd: 50000, allocations: [{ batchId: "b", sku: "CBST-300", qty: 2, returnedQty: 1, landedUnitCostVnd: 65000, secret: "hidden" }] };
    expect(orderProjection(order, owner)).toMatchObject({ returnValueVnd: 109000, returnRefundsVnd: 50000, returnCreditBalanceVnd: 59000, refundableVnd: 168000, allocations: [{ batchId: "b", qty: 2, returnedQty: 1, returnableQty: 1, landedUnitCostVnd: 65000 }] });
    const member = JSON.stringify(orderProjection(order, { id: "m", role: "MEMBER" }));
    expect(member).not.toMatch(/allocations|65000|returnCreditBalance|returnValueVnd/);
    expect(JSON.stringify(orderProjection(order, owner))).not.toContain("hidden");
  });
  it("does not demand a cash refund when an unpaid returned item only cancels receivable", () => {
    expect(commissionTarget({ status: "PARTIALLY_RETURNED", deliveredAt: new Date(), responsibleMemberId: "m", totalVnd: 218000, receiptsVnd: 109000, refundsVnd: 0, returnValueVnd: 109000, returnRefundsVnd: 0, cogsVnd: 65000, directCostsVnd: 0, costsFinalized: true, commissionRateBps: 4000 })).toBe(17600);
  });
});
describe("assignment commission snapshot", () => {
  it("snapshots the newly assigned member rate", async () => {
    const order = { id: "order", status: "PENDING", version: 0, responsibleMemberId: null, commissionRateBps: 0 };
    const query = (value: unknown) => ({ session: () => query(value), lean: async () => value });
    const db = {
      scopedOrder: async () => order,
      idempotent: async (_scope: string, _key: string, _dto: unknown, work: (session: unknown) => unknown) => work("session"),
      users: { findOne: () => query({ id: "member", role: "MEMBER", status: "ACTIVE", commissionRateBps: 2250 }) },
      saveOrder: vi.fn(async () => { order.version++; }), audit: { create: vi.fn() },
    };
    await new CommerceService(db as never).assignOrder(owner, "order", { memberId: "member", expectedVersion: 0, reason: "Assign" }, "key", "request");
    expect(order).toMatchObject({ responsibleMemberId: "member", commissionRateBps: 2250 });
  });
});
describe("production owner MFA gate", () => {
  it("returns a stable MFA error code through the HTTP filter", () => {
    const json = vi.fn(); const status = vi.fn(() => ({ json }));
    new ApiErrorFilter().catch(new ForbiddenException("OWNER_MFA_REQUIRED"), { switchToHttp: () => ({ getRequest: () => ({ requestId: "r" }), getResponse: () => ({ status }) }) } as never);
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ error: { code: "OWNER_MFA_REQUIRED", message: "OWNER_MFA_REQUIRED", requestId: "r", details: [] } });
  });
  it("blocks password-only owner login without creating a session", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const db = { findUserByEmail: async () => ({ id: "o", role: "OWNER_ADMIN", status: "ACTIVE", passwordHash: await hashPassword("password") }), createSession: vi.fn() };
    await expect(new AuthService(db as never, "s".repeat(32)).login("o@example.com", "password")).rejects.toThrow("OWNER_MFA_REQUIRED");
    expect(db.createSession).not.toHaveBeenCalled();
  });
  it("revokes existing owner sessions in production instead of trusting a stored MFA flag", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const db = { findSessionByHash: async () => ({ userId: "o", idleExpiresAt: new Date(Date.now() + 10000), absoluteExpiresAt: new Date(Date.now() + 10000), mfaVerified: true }), findUserById: async () => ({ id: "o", role: "OWNER_ADMIN", status: "ACTIVE", mfaEnabled: true }), revokeSession: vi.fn(), touchSession: vi.fn() };
    await expect(new AuthService(db as never, "s".repeat(32)).authenticate("token")).rejects.toThrow("OWNER_MFA_REQUIRED");
    expect(db.revokeSession).toHaveBeenCalledOnce(); expect(db.touchSession).not.toHaveBeenCalled();
  });
});
