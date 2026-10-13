import { describe, expect, it, vi } from "vitest";
import { createConnection, model, type ClientSession } from "mongoose";
import { DiscountsService } from "../src/v2/discounts";
import { promotionSchema, voucherSchema, voucherRedemptionSchema, voucherCustomerCounterSchema, orderSchema } from "../src/v2/models";
import { MongoRepository } from "../src/v2/repository";

const owner = { id: "owner", role: "OWNER_ADMIN" as const };
const member = { id: "member", role: "MEMBER" as const };
const session = { inTransaction: () => true } as ClientSession;
const now = new Date("2026-06-01");
const promotion = { name: "Summer", sku: "CBST-300", kind: "PERCENT" as const, value: 1000, maxDiscountVnd: 10000, startAt: new Date("2026-01-01"), endAt: new Date("2027-01-01"), active: true };
const voucher = { name: "Internal", code: "HELLO", kind: "FIXED" as const, value: 1000, minSubtotalVnd: 10000, maxUsageTotal: 2, maxUsagePerCustomer: 1, assignedMemberIds: [member.id], startAt: promotion.startAt, endAt: promotion.endAt, active: true, id: "v1", version: 0, reservedCount: 0, consumedCount: 0, createdAt: now, updatedAt: now };
const query = (value: unknown) => ({ session: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue(value), sort: vi.fn().mockReturnThis() });
function fixture() {
  const collection = () => ({ find: vi.fn(() => query([])), findOne: vi.fn(() => query(null)), create: vi.fn().mockResolvedValue([]), updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }), deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }) });
  const db = { promotions: collection(), vouchers: collection(), voucherRedemptions: collection(), voucherCustomerCounters: collection(), products: collection(), audit: collection(), idempotent: vi.fn(async (_scope, _key, _payload, work) => work(session)) };
  db.vouchers.findOne.mockImplementation(() => query(voucher));
  return { db, service: new DiscountsService(db as unknown as MongoRepository) };
}

describe("discount persistence schemas", () => {
  const Promotion = model("DiscountTestPromotion", promotionSchema);
  const Voucher = model("DiscountTestVoucher", voucherSchema);
  it("validates interval, integer basis points and mandatory percentage cap", () => {
    const valid = { ...promotion, id: "p", version: 0, createdAt: now, updatedAt: now };
    expect(new Promotion(valid).validateSync()).toBeUndefined();
    for (const change of [{ value: 10001 }, { value: 1.5 }, { maxDiscountVnd: undefined }, { endAt: valid.startAt }]) {
      expect(new Promotion({ ...valid, ...change }).validateSync()).toBeDefined();
    }
  });
  it("validates counters, total ceiling, phone and unique identities", () => {
    expect(new Voucher(voucher).validateSync()).toBeUndefined();
    for (const change of [{ reservedCount: -1 }, { consumedCount: 3 }, { maxUsagePerCustomer: 0 }, { code: "hello" }]) expect(new Voucher({ ...voucher, ...change }).validateSync()).toBeDefined();
    expect(voucherSchema.indexes()).toContainEqual([{ code: 1 }, expect.objectContaining({ unique: true })]);
    expect(voucherRedemptionSchema.indexes()).toContainEqual([{ orderId: 1 }, expect.objectContaining({ unique: true })]);
    expect(voucherCustomerCounterSchema.indexes()).toContainEqual([{ voucherId: 1, customerPhoneNormalized: 1 }, expect.objectContaining({ unique: true })]);
    const Counter = model("DiscountTestCounter", voucherCustomerCounterSchema);
    expect(new Counter({ voucherId: "v", customerPhoneNormalized: "bad", reservedCount: 0, consumedCount: 0 }).validateSync()).toBeDefined();
  });
  it("persists optional pricing snapshots without defaulting old orders to v2", () => {
    expect(orderSchema.path("pricingSchemaVersion")).toBeDefined();
    expect(orderSchema.path("pricingSchemaVersion").options.default).toBeUndefined();
    for (const path of ["pricingMode", "merchandiseSubtotalVnd", "discountVnd", "pricedAt", "voucherId"]) expect(orderSchema.path(path)).toBeDefined();
    for (const path of ["retailUnitPriceVnd", "grossLineTotalVnd", "lineDiscountVnd", "finalLineTotalVnd", "discountSourceType", "discountSourceId", "discountLabelSnapshot"]) expect(orderSchema.path(`items.${path}`)).toBeDefined();
  });
});

describe("DiscountsService", () => {
  it("allows only Owner to inspect redemptions and customer counters", async () => {
    const { db, service } = fixture();
    await expect(service.listRedemptions(member, "v1")).rejects.toThrow("OWNER_REQUIRED");
    await expect(service.listCustomerCounters(member, "v1")).rejects.toThrow("OWNER_REQUIRED");
    await service.listRedemptions(owner, "v1");
    await service.listCustomerCounters(owner, "v1");
    expect(db.voucherRedemptions.find).toHaveBeenCalledWith({ voucherId: "v1" }, { _id: 0 });
    expect(db.voucherCustomerCounters.find).toHaveBeenCalledWith({ voucherId: "v1" }, { _id: 0 });
  });
  it("requires Owner for mutations and scopes Member voucher reads", async () => {
    const { db, service } = fixture();
    await expect(service.createPromotion(member, promotion, "key", "req")).rejects.toThrow("OWNER_REQUIRED");
    await expect(service.listVouchers(null)).rejects.toThrow("AUTH_REQUIRED");
    await service.listVouchers(member);
    expect(db.vouchers.find).toHaveBeenCalledWith({ assignedMemberIds: member.id }, expect.anything());
  });
  it("takes a storage write lock before checking half-open promotion overlap", async () => {
    const { db, service } = fixture();
    const result = await service.createPromotion(owner, promotion, "key", "req");
    expect(result.version).toBe(0);
    expect(db.products.updateOne).toHaveBeenCalledWith({ sku: promotion.sku }, { $inc: { promotionRevision: 1 } }, { session });
    expect(db.products.updateOne.mock.invocationCallOrder[0]).toBeLessThan(db.promotions.findOne.mock.invocationCallOrder[0]);
    expect(db.promotions.findOne).toHaveBeenCalledWith(expect.objectContaining({ sku: promotion.sku, startAt: { $lt: promotion.endAt }, endAt: { $gt: promotion.startAt } }));
    db.promotions.findOne.mockImplementation(() => query({ id: "other" }));
    await expect(service.createPromotion(owner, promotion, "key2", "req")).rejects.toThrow("PROMOTION_OVERLAP");
  });
  it("rejects stale versions and invalid configuration", async () => {
    const { db, service } = fixture();
    db.promotions.findOne.mockImplementation(() => query({ ...promotion, id: "p", version: 2 }));
    await expect(service.updatePromotion(owner, "p", { ...promotion, expectedVersion: 1 }, "k", "r")).rejects.toThrow("VERSION_CONFLICT");
    await expect(service.createPromotion(owner, { ...promotion, value: 10001 }, "k", "r")).rejects.toThrow("DISCOUNT_INVALID");
    await expect(service.updateVoucher(owner, "v1", { ...voucher, maxUsageTotal: 0, expectedVersion: 0 }, "k", "r")).rejects.toThrow("DISCOUNT_INVALID");
  });
  it("normalizes voucher code and phone and checks assignment, time, minimum and limits", async () => {
    const { db, service } = fixture();
    const input = { code: " hello ", customerPhone: "0901234567", subtotalVnd: 10000, now };
    expect((await service.verifyVoucher(member, input)).id).toBe("v1");
    expect(db.vouchers.findOne).toHaveBeenCalledWith({ code: "HELLO", assignedMemberIds: member.id }, expect.anything());
    expect(db.voucherCustomerCounters.findOne).toHaveBeenCalledWith({ voucherId: "v1", customerPhoneNormalized: "+84901234567" });
    await expect(service.verifyVoucher(member, { ...input, subtotalVnd: 1 })).rejects.toThrow("VOUCHER_MIN_SUBTOTAL");
    await expect(service.verifyVoucher(member, { ...input, now: voucher.endAt })).rejects.toThrow("VOUCHER_UNAVAILABLE");
    db.vouchers.findOne.mockImplementation(() => query(null));
    await expect(service.verifyVoucher(member, input)).rejects.toThrow("VOUCHER_UNAVAILABLE");
  });
  it("reserves using guarded global/customer updates and one redemption in the caller transaction", async () => {
    const { db, service } = fixture();
    const result = await service.reserveVoucher(member, { orderId: "o", code: "HELLO", customerPhone: "0901234567", subtotalVnd: 10000, now }, session);
    expect(result.state).toBe("RESERVED");
    expect(db.vouchers.updateOne).toHaveBeenCalledWith(expect.objectContaining({ id: "v1", $expr: expect.anything() }), { $inc: { reservedCount: 1 } }, { session });
    expect(db.voucherCustomerCounters.updateOne).toHaveBeenLastCalledWith(expect.objectContaining({ voucherId: "v1", $expr: expect.anything() }), { $inc: { reservedCount: 1 } }, { session });
    expect(db.voucherRedemptions.create).toHaveBeenCalledWith([expect.objectContaining({ orderId: "o", state: "RESERVED" })], { session });
    db.vouchers.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(service.reserveVoucher(member, { orderId: "o2", code: "HELLO", customerPhone: "0901234567", subtotalVnd: 10000, now }, session)).rejects.toThrow("VOUCHER_LIMIT_REACHED");
  });
  it("consumes once and releases only before stock-out, never DELIVERY_FAILED", async () => {
    const { db, service } = fixture();
    const redemption = { id: "r", voucherId: "v1", orderId: "o", customerPhoneNormalized: "+84901234567", state: "RESERVED" };
    db.voucherRedemptions.findOne.mockImplementation(() => query(redemption));
    await service.consumeVoucher({ id: "o", status: "PENDING" }, session);
    expect(db.vouchers.updateOne).toHaveBeenCalledWith(expect.objectContaining({ reservedCount: { $gte: 1 } }), { $inc: { reservedCount: -1, consumedCount: 1 } }, { session });
    db.voucherRedemptions.findOne.mockImplementation(() => query({ ...redemption, state: "CONSUMED" }));
    db.vouchers.updateOne.mockClear();
    await service.consumeVoucher({ id: "o", status: "CONFIRMED" }, session);
    await service.releaseVoucher({ id: "o", status: "DELIVERY_FAILED", shippedAt: now }, session);
    expect(db.vouchers.updateOne).not.toHaveBeenCalled();
    await service.releaseVoucher({ id: "o", status: "PACKING" }, session);
    expect(db.vouchers.updateOne).toHaveBeenCalledWith(expect.objectContaining({ consumedCount: { $gte: 1 } }), { $inc: { consumedCount: -1 } }, { session });
    db.voucherRedemptions.findOne.mockImplementation(() => query({ ...redemption, state: "RELEASED" }));
    db.vouchers.updateOne.mockClear();
    await service.releaseVoucher({ id: "o", status: "CANCELLED" }, session);
    expect(db.vouchers.updateOne).not.toHaveBeenCalled();
  });
  it("scopes Owner lists and rejects Member voucher mutations", async () => {
    const { db, service } = fixture();
    await service.listPromotions(owner);
    await service.listVouchers(owner);
    expect(db.promotions.find).toHaveBeenCalledWith({ deletedAt: { $exists: false } }, { _id: 0 });
    expect(db.vouchers.find).toHaveBeenCalledWith({}, { _id: 0 });
    await expect(service.listPromotions(member)).rejects.toThrow("OWNER_REQUIRED");
    await expect(service.createVoucher(member, voucher, "k", "r")).rejects.toThrow("OWNER_REQUIRED");
    await expect(service.updateVoucher(member, "v1", { ...voucher, expectedVersion: 0 }, "k", "r")).rejects.toThrow("OWNER_REQUIRED");
    await expect(service.deleteVoucher(member, "v1", { expectedVersion: 0 }, "k", "r")).rejects.toThrow("OWNER_REQUIRED");
  });
  it("creates normalized vouchers with audit and immutable server counters", async () => {
    const { db, service } = fixture();
    const result = await service.createVoucher(owner, { ...voucher, code: " hello ", reservedCount: 10 } as typeof voucher, "k", "r");
    expect(result).toMatchObject({ code: "HELLO", reservedCount: 0, consumedCount: 0, version: 0 });
    expect(db.audit.create).toHaveBeenCalledWith([expect.objectContaining({ actorId: owner.id, action: "VOUCHER_CREATED", requestId: "r" })], { session });
  });
  it("locks both SKUs in stable order on a promotion move and unsets obsolete caps", async () => {
    const { db, service } = fixture();
    db.promotions.findOne.mockImplementationOnce(() => query({ ...promotion, id: "p", sku: "CBST-600", version: 0 }));
    const result = await service.updatePromotion(owner, "p", { ...promotion, kind: "FIXED_PER_UNIT", maxDiscountVnd: undefined, expectedVersion: 0 }, "k", "r");
    expect(result.version).toBe(1);
    expect(db.products.updateOne.mock.calls.map(call => call[0])).toEqual([{ sku: "CBST-300" }, { sku: "CBST-600" }]);
    expect(db.promotions.updateOne).toHaveBeenCalledWith({ id: "p", version: 0 }, expect.objectContaining({ $unset: { maxDiscountVnd: 1 } }), { session });
    expect(db.promotions.findOne).toHaveBeenLastCalledWith(expect.objectContaining({ id: { $ne: "p" } }));
  });
  it("soft deletes configurations without destroying redemptions or counters", async () => {
    const { db, service } = fixture();
    db.promotions.findOne.mockImplementation(() => query({ ...promotion, id: "p", version: 0 }));
    expect(await service.deletePromotion(owner, "p", { expectedVersion: 0 }, "k", "r")).toEqual({ id: "p", version: 1 });
    expect(await service.deleteVoucher(owner, "v1", { expectedVersion: 0 }, "k", "r")).toEqual({ id: "v1", version: 1 });
    expect(db.vouchers.updateOne).toHaveBeenCalledWith({ id: "v1", version: 0 }, expect.objectContaining({ $set: expect.objectContaining({ active: false, deletedAt: expect.any(Date) }) }), { session });
    expect(db.voucherRedemptions.deleteOne).not.toHaveBeenCalled();
    expect(db.voucherCustomerCounters.deleteOne).not.toHaveBeenCalled();
  });
  it("rejects missing products, missing configurations and failed optimistic writes", async () => {
    const { db, service } = fixture();
    db.products.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(service.createPromotion(owner, promotion, "k", "r")).rejects.toThrow("PRODUCT_UNAVAILABLE");
    expect(db.promotions.create).not.toHaveBeenCalled();
    await expect(service.deletePromotion(owner, "missing", { expectedVersion: 0 }, "k", "r")).rejects.toThrow("RESOURCE_NOT_FOUND");
    db.vouchers.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(service.deleteVoucher(owner, "v1", { expectedVersion: 0 }, "k", "r")).rejects.toThrow("VERSION_CONFLICT");
  });
  it("rejects usage ceiling reductions below global or customer counts", async () => {
    const { db, service } = fixture();
    db.vouchers.findOne.mockImplementation(() => query({ ...voucher, reservedCount: 2 }));
    await expect(service.updateVoucher(owner, "v1", { ...voucher, maxUsageTotal: 1, expectedVersion: 0 }, "k", "r")).rejects.toThrow("VOUCHER_LIMIT_BELOW_USAGE");
    db.vouchers.findOne.mockImplementation(() => query(voucher));
    db.voucherCustomerCounters.findOne.mockImplementation(() => query({ reservedCount: 2 }));
    await expect(service.updateVoucher(owner, "v1", { ...voucher, expectedVersion: 0 }, "k", "r")).rejects.toThrow("VOUCHER_LIMIT_BELOW_USAGE");
    expect(db.vouchers.updateOne).not.toHaveBeenCalled();
  });
  it("updates voucher configuration without resetting usage", async () => {
    const { db, service } = fixture();
    db.vouchers.findOne.mockImplementation(() => query({ ...voucher, consumedCount: 1 }));
    const result = await service.updateVoucher(owner, "v1", { ...voucher, name: "New", expectedVersion: 0 }, "k", "r");
    expect(result).toMatchObject({ name: "New", consumedCount: 1, version: 1 });
    expect(db.vouchers.updateOne).toHaveBeenCalledWith({ id: "v1", version: 0 }, expect.objectContaining({ $set: expect.not.objectContaining({ consumedCount: expect.anything() }) }), { session });
  });
  it.each([
    [{ active: false }, "VOUCHER_UNAVAILABLE"],
    [{ deletedAt: now }, "VOUCHER_UNAVAILABLE"],
    [{ reservedCount: 2 }, "VOUCHER_LIMIT_REACHED"],
    [{ consumedCount: 2 }, "VOUCHER_LIMIT_REACHED"],
  ])("checks voucher eligibility %j", async (change, error) => {
    const { db, service } = fixture();
    db.vouchers.findOne.mockImplementation(() => query({ ...voucher, ...change }));
    await expect(service.verifyVoucher(member, { code: "HELLO", customerPhone: "+84901234567", subtotalVnd: 10000, now })).rejects.toThrow(error);
  });
  it("includes start boundary and enforces phone-based customer usage", async () => {
    const { db, service } = fixture();
    const input = { code: "HELLO", customerPhone: "090 123 4567", subtotalVnd: 10000, now: voucher.startAt };
    expect((await service.verifyVoucher(owner, input)).id).toBe("v1");
    db.voucherCustomerCounters.findOne.mockImplementation(() => query({ reservedCount: 0, consumedCount: 1 }));
    await expect(service.verifyVoucher(owner, input)).rejects.toThrow("VOUCHER_LIMIT_REACHED");
    await expect(service.verifyVoucher(owner, { ...input, customerPhone: "bad" })).rejects.toThrow("CUSTOMER_PHONE_INVALID");
  });
  it("requires transaction lifecycle and rejects failed customer reservation", async () => {
    const { db, service } = fixture();
    const input = { orderId: "o", code: "HELLO", customerPhone: "0901234567", subtotalVnd: 10000, now };
    await expect(service.reserveVoucher(member, input, { inTransaction: () => false } as ClientSession)).rejects.toThrow("TRANSACTION_REQUIRED");
    db.voucherCustomerCounters.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(service.reserveVoucher(member, input, session)).rejects.toThrow("VOUCHER_LIMIT_REACHED");
    expect(db.voucherRedemptions.create).not.toHaveBeenCalled();
  });
  it("replays existing redemption without deltas and rejects mismatched reuse", async () => {
    const { db, service } = fixture();
    const redemption = { id: "r", orderId: "o", voucherId: "v1", actorId: member.id, customerPhoneNormalized: "+84901234567", state: "RESERVED" };
    db.voucherRedemptions.findOne.mockImplementation(() => query(redemption));
    const input = { orderId: "o", code: "HELLO", customerPhone: "0901234567", subtotalVnd: 10000, now };
    expect(await service.reserveVoucher(member, input, session)).toEqual(redemption);
    expect(db.vouchers.updateOne).not.toHaveBeenCalled();
    await expect(service.reserveVoucher(member, { ...input, code: "OTHER" }, session)).rejects.toThrow("VOUCHER_REDEMPTION_CONFLICT");
  });
  it("guards transitions and refuses to decrement missing counters", async () => {
    const { db, service } = fixture();
    const redemption = { id: "r", orderId: "o", voucherId: "v1", customerPhoneNormalized: "+84901234567", state: "RESERVED" };
    db.voucherRedemptions.findOne.mockImplementation(() => query(redemption));
    db.voucherRedemptions.updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    await expect(service.consumeVoucher({ id: "o", status: "PENDING" }, session)).rejects.toThrow("VOUCHER_STATE_CONFLICT");
    expect(db.vouchers.updateOne).not.toHaveBeenCalled();
    db.voucherCustomerCounters.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(service.releaseVoucher({ id: "o", status: "PENDING" }, session)).rejects.toThrow("VOUCHER_COUNTER_INCONSISTENT");
    expect(db.vouchers.updateOne).toHaveBeenCalledWith({ id: "v1", reservedCount: { $gte: 1 } }, { $inc: { reservedCount: -1 } }, { session });
  });
});

describe("repository integration without a database", () => {
  it("registers real strict runtime models and replays service mutations using repository idempotency", async () => {
    const connection = createConnection();
    const db = new MongoRepository(connection);
    expect(db.promotions.schema).toBe(promotionSchema);
    expect(db.vouchers.schema).toBe(voucherSchema);
    expect(db.voucherRedemptions.schema).toBe(voucherRedemptionSchema);
    expect(db.voucherCustomerCounters.schema).toBe(voucherCustomerCounterSchema);
    vi.spyOn(db, "transaction").mockImplementation(async work => work(session));
    const entries: Array<{ scope: string; keyHash: string; requestHash: string; response: unknown }> = [];
    vi.spyOn(db.keys, "findOne").mockImplementation(filter => {
      const fields = filter as { scope: string; keyHash: string };
      return query(entries.find(entry => entry.scope === fields.scope && entry.keyHash === fields.keyHash) ?? null) as never;
    });
    vi.spyOn(db.keys, "create").mockImplementation((async (values: typeof entries) => { entries.push(...values); return values; }) as never);
    vi.spyOn(db.products, "updateOne").mockResolvedValue({ modifiedCount: 1 } as never);
    vi.spyOn(db.promotions, "findOne").mockImplementation(() => query(null) as never);
    const create = vi.spyOn(db.promotions, "create").mockResolvedValue([] as never);
    vi.spyOn(db.audit, "create").mockResolvedValue([] as never);
    const service = new DiscountsService(db);
    const first = await service.createPromotion(owner, promotion, "same", "req1");
    expect(await service.createPromotion(owner, promotion, "same", "req2")).toEqual(first);
    expect(create).toHaveBeenCalledTimes(1);
    await expect(service.createPromotion(owner, { ...promotion, endAt: new Date("2028-01-01") }, "same", "req3")).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await connection.close();
  });
});
