import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ClientSession } from "mongoose";
import type { Actor } from "./policy";
import type { Order, Promotion, Voucher, VoucherRedemption } from "./models";
import { MongoRepository } from "./repository";

type ConfigurationInput<T> = Omit<T, "id" | "version" | "createdAt" | "updatedAt" | "deletedAt" | "startAt" | "endAt" | "reservedCount" | "consumedCount"> & { startAt: string | Date; endAt: string | Date };
export type PromotionInput = ConfigurationInput<Promotion>;
export type VoucherInput = ConfigurationInput<Voucher>;
export type VersionInput = { expectedVersion: number };
export type VerifyVoucherInput = { code: string; customerPhone: string; subtotalVnd: number; now?: Date };
export type ReserveVoucherInput = VerifyVoucherInput & { orderId: string };
export type VoucherOrder = Pick<Order, "id" | "status" | "shippedAt">;

@Injectable()
export class DiscountsService {
  constructor(private readonly db: MongoRepository) {}
  private authenticated(actor: Actor | null): asserts actor is Actor {
    if (!actor || !["OWNER_ADMIN", "MEMBER"].includes(actor.role)) throw new ForbiddenException("AUTH_REQUIRED");
  }
  private owner(actor: Actor | null): asserts actor is Actor {
    this.authenticated(actor);
    if (actor.role !== "OWNER_ADMIN") throw new ForbiddenException("OWNER_REQUIRED");
  }
  private version(actual: number, expected: number) {
    if (!Number.isSafeInteger(expected) || expected < 0 || actual !== expected) throw new ConflictException("VERSION_CONFLICT");
  }
  private transaction(session: ClientSession) {
    if (!session.inTransaction()) throw new ConflictException("TRANSACTION_REQUIRED");
  }
  private phone(value: string) {
    const phone = value.replace(/[\s().-]/g, "").replace(/^0/, "+84");
    if (!/^\+84[35789]\d{8}$/.test(phone)) throw new BadRequestException("CUSTOMER_PHONE_INVALID");
    return phone;
  }
  private configuration(input: PromotionInput | VoucherInput, voucher: boolean) {
    const startAt = new Date(input.startAt), endAt = new Date(input.endAt);
    const validInteger = (value: number) => Number.isSafeInteger(value) && value >= 0;
    if (!input.name?.trim() || typeof input.active !== "boolean" || !Number.isFinite(+startAt) || !Number.isFinite(+endAt) || startAt >= endAt || !validInteger(input.value)
      || ![voucher ? "FIXED" : "FIXED_PER_UNIT", "PERCENT"].includes(input.kind)
      || (input.maxDiscountVnd !== undefined && !validInteger(input.maxDiscountVnd))
      || (input.kind === "PERCENT" && (input.value > 10000 || input.maxDiscountVnd === undefined))) throw new BadRequestException("DISCOUNT_INVALID");
    return { name: input.name.trim(), kind: input.kind, value: input.value, ...(input.maxDiscountVnd === undefined ? {} : { maxDiscountVnd: input.maxDiscountVnd }), startAt, endAt, active: input.active };
  }
  private promotionInput(input: PromotionInput): PromotionInput & { startAt: Date; endAt: Date } {
    if (!input.sku?.trim()) throw new BadRequestException("DISCOUNT_INVALID");
    return { ...this.configuration(input, false), kind: input.kind, sku: input.sku.trim() };
  }
  private voucherInput(input: VoucherInput): VoucherInput & { startAt: Date; endAt: Date } {
    const fields = this.configuration(input, true), code = input.code?.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,63}$/.test(code ?? "") || !Number.isSafeInteger(input.minSubtotalVnd) || input.minSubtotalVnd < 0
      || !Number.isSafeInteger(input.maxUsageTotal) || input.maxUsageTotal < 1 || !Number.isSafeInteger(input.maxUsagePerCustomer) || input.maxUsagePerCustomer < 1
      || !Array.isArray(input.assignedMemberIds) || input.assignedMemberIds.some(id => typeof id !== "string" || !id.trim())) throw new BadRequestException("DISCOUNT_INVALID");
    return { ...fields, kind: input.kind, code, minSubtotalVnd: input.minSubtotalVnd, maxUsageTotal: input.maxUsageTotal, maxUsagePerCustomer: input.maxUsagePerCustomer, assignedMemberIds: [...new Set(input.assignedMemberIds)] };
  }
  private async audit(actor: Actor, action: string, entityId: string, requestId: string, session: ClientSession) {
    await this.db.audit.create([{ id: randomUUID(), actorId: actor.id, action, entityId, requestId, createdAt: new Date() }], { session });
  }
  private async lockSkus(skus: string[], session: ClientSession) {
    // All promotion mutations write the product before reading overlaps. Snapshot
    // transactions on the same SKU must conflict and retry, including empty ranges.
    for (const sku of [...new Set(skus)].sort()) {
      const result = await this.db.products.updateOne({ sku }, { $inc: { promotionRevision: 1 } }, { session });
      if (result.modifiedCount !== 1) throw new BadRequestException("PRODUCT_UNAVAILABLE");
    }
  }
  private async overlap(input: PromotionInput & { startAt: Date; endAt: Date }, session: ClientSession, id?: string) {
    if (!input.active) return;
    const existing = await this.db.promotions.findOne({ sku: input.sku, active: true, deletedAt: { $exists: false }, ...(id ? { id: { $ne: id } } : {}), startAt: { $lt: input.endAt }, endAt: { $gt: input.startAt } }).session(session).lean();
    if (existing) throw new ConflictException("PROMOTION_OVERLAP");
  }
  async listPromotions(actor: Actor) {
    this.owner(actor);
    return this.db.promotions.find({ deletedAt: { $exists: false } }, { _id: 0 }).sort({ startAt: -1, id: 1 }).lean();
  }
  async createPromotion(actor: Actor, input: PromotionInput, key: string, requestId: string): Promise<Promotion> {
    this.owner(actor);
    const fields = this.promotionInput(input);
    return this.db.idempotent(`${actor.id}:create-promotion`, key, { ...fields, startAt: fields.startAt.toISOString(), endAt: fields.endAt.toISOString() }, async session => {
      await this.lockSkus([fields.sku], session);
      await this.overlap(fields, session);
      const value: Promotion = { ...fields, id: randomUUID(), version: 0, createdAt: new Date(), updatedAt: new Date() };
      await this.db.promotions.create([value], { session });
      await this.audit(actor, "PROMOTION_CREATED", value.id, requestId, session);
      return value;
    });
  }
  async updatePromotion(actor: Actor, id: string, input: PromotionInput & VersionInput, key: string, requestId: string): Promise<Promotion> {
    this.owner(actor);
    const fields = this.promotionInput(input);
    return this.db.idempotent(`${actor.id}:update-promotion:${id}`, key, { ...fields, startAt: fields.startAt.toISOString(), endAt: fields.endAt.toISOString(), expectedVersion: input.expectedVersion }, async session => {
      const old = await this.db.promotions.findOne({ id, deletedAt: { $exists: false } }).session(session).lean();
      if (!old) throw new NotFoundException("RESOURCE_NOT_FOUND");
      this.version(old.version, input.expectedVersion);
      await this.lockSkus([old.sku, fields.sku], session);
      await this.overlap(fields, session, id);
      const value: Promotion = { ...old, ...fields, maxDiscountVnd: fields.maxDiscountVnd, version: old.version + 1, updatedAt: new Date() };
      const result = await this.db.promotions.updateOne({ id, version: old.version }, { $set: { ...fields, version: value.version, updatedAt: value.updatedAt }, ...(fields.maxDiscountVnd === undefined ? { $unset: { maxDiscountVnd: 1 } } : {}) }, { session });
      if (result.modifiedCount !== 1) throw new ConflictException("VERSION_CONFLICT");
      await this.audit(actor, "PROMOTION_UPDATED", id, requestId, session);
      return value;
    });
  }
  async deletePromotion(actor: Actor, id: string, input: VersionInput, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:delete-promotion:${id}`, key, input, async session => {
      const old = await this.db.promotions.findOne({ id, deletedAt: { $exists: false } }).session(session).lean();
      if (!old) throw new NotFoundException("RESOURCE_NOT_FOUND");
      this.version(old.version, input.expectedVersion);
      await this.lockSkus([old.sku], session);
      const result = await this.db.promotions.updateOne({ id, version: old.version }, { $set: { active: false, deletedAt: new Date(), updatedAt: new Date() }, $inc: { version: 1 } }, { session });
      if (result.modifiedCount !== 1) throw new ConflictException("VERSION_CONFLICT");
      await this.audit(actor, "PROMOTION_DELETED", id, requestId, session);
      return { id, version: old.version + 1 };
    });
  }
  async listVouchers(actor: Actor | null) {
    this.authenticated(actor);
    const values = await this.db.vouchers.find(actor.role === "OWNER_ADMIN" ? {} : { assignedMemberIds: actor.id }, { _id: 0 }).sort({ createdAt: -1, id: 1 }).lean();
    return values.filter(value => !value.deletedAt);
  }
  async listRedemptions(actor: Actor, voucherId: string) {
    this.owner(actor);
    return this.db.voucherRedemptions.find({ voucherId }, { _id: 0 }).sort({ createdAt: -1, id: 1 }).lean();
  }
  async listCustomerCounters(actor: Actor, voucherId: string) {
    this.owner(actor);
    return this.db.voucherCustomerCounters.find({ voucherId }, { _id: 0 }).sort({ customerPhoneNormalized: 1 }).lean();
  }
  async createVoucher(actor: Actor, input: VoucherInput, key: string, requestId: string): Promise<Voucher> {
    this.owner(actor);
    const fields = this.voucherInput(input);
    return this.db.idempotent(`${actor.id}:create-voucher`, key, { ...fields, startAt: fields.startAt.toISOString(), endAt: fields.endAt.toISOString() }, async session => {
      const value: Voucher = { ...fields, id: randomUUID(), version: 0, reservedCount: 0, consumedCount: 0, createdAt: new Date(), updatedAt: new Date() };
      await this.db.vouchers.create([value], { session });
      await this.audit(actor, "VOUCHER_CREATED", value.id, requestId, session);
      return value;
    });
  }
  async updateVoucher(actor: Actor, id: string, input: VoucherInput & VersionInput, key: string, requestId: string): Promise<Voucher> {
    this.owner(actor);
    const fields = this.voucherInput(input);
    return this.db.idempotent(`${actor.id}:update-voucher:${id}`, key, { ...fields, startAt: fields.startAt.toISOString(), endAt: fields.endAt.toISOString(), expectedVersion: input.expectedVersion }, async session => {
      const old = await this.db.vouchers.findOne({ id, deletedAt: { $exists: false } }).session(session).lean();
      if (!old) throw new NotFoundException("RESOURCE_NOT_FOUND");
      this.version(old.version, input.expectedVersion);
      if (old.reservedCount + old.consumedCount > fields.maxUsageTotal) throw new ConflictException("VOUCHER_LIMIT_BELOW_USAGE");
      const excessive = await this.db.voucherCustomerCounters.findOne({ voucherId: id, $expr: { $gt: [{ $add: ["$reservedCount", "$consumedCount"] }, fields.maxUsagePerCustomer] } }).session(session).lean();
      if (excessive) throw new ConflictException("VOUCHER_LIMIT_BELOW_USAGE");
      const value: Voucher = { ...old, ...fields, maxDiscountVnd: fields.maxDiscountVnd, version: old.version + 1, updatedAt: new Date() };
      const result = await this.db.vouchers.updateOne({ id, version: old.version }, { $set: { ...fields, version: value.version, updatedAt: value.updatedAt }, ...(fields.maxDiscountVnd === undefined ? { $unset: { maxDiscountVnd: 1 } } : {}) }, { session });
      if (result.modifiedCount !== 1) throw new ConflictException("VERSION_CONFLICT");
      await this.audit(actor, "VOUCHER_UPDATED", id, requestId, session);
      return value;
    });
  }
  async deleteVoucher(actor: Actor, id: string, input: VersionInput, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:delete-voucher:${id}`, key, input, async session => {
      const old = await this.db.vouchers.findOne({ id, deletedAt: { $exists: false } }).session(session).lean();
      if (!old) throw new NotFoundException("RESOURCE_NOT_FOUND");
      this.version(old.version, input.expectedVersion);
      // Tombstones keep existing reservations consumable/releasable and codes unique.
      const result = await this.db.vouchers.updateOne({ id, version: old.version }, { $set: { active: false, deletedAt: new Date(), updatedAt: new Date() }, $inc: { version: 1 } }, { session });
      if (result.modifiedCount !== 1) throw new ConflictException("VERSION_CONFLICT");
      await this.audit(actor, "VOUCHER_DELETED", id, requestId, session);
      return { id, version: old.version + 1 };
    });
  }
  async verifyVoucher(actor: Actor | null, input: VerifyVoucherInput, session?: ClientSession): Promise<Voucher> {
    this.authenticated(actor);
    const phone = this.phone(input.customerPhone), now = input.now ?? new Date();
    if (!Number.isSafeInteger(input.subtotalVnd) || input.subtotalVnd < 0 || !Number.isFinite(+now)) throw new BadRequestException("DISCOUNT_INVALID");
    const voucher = await this.db.vouchers.findOne({ code: input.code.trim().toUpperCase(), ...(actor.role === "MEMBER" ? { assignedMemberIds: actor.id } : {}) }, { _id: 0 }).session(session ?? null).lean();
    if (!voucher || voucher.deletedAt || !voucher.active || now < voucher.startAt || now >= voucher.endAt) throw new ConflictException("VOUCHER_UNAVAILABLE");
    if (input.subtotalVnd < voucher.minSubtotalVnd) throw new ConflictException("VOUCHER_MIN_SUBTOTAL");
    const counter = await this.db.voucherCustomerCounters.findOne({ voucherId: voucher.id, customerPhoneNormalized: phone }).session(session ?? null).lean();
    if (voucher.reservedCount + voucher.consumedCount >= voucher.maxUsageTotal || (counter && counter.reservedCount + counter.consumedCount >= voucher.maxUsagePerCustomer)) throw new ConflictException("VOUCHER_LIMIT_REACHED");
    return voucher;
  }
  async reserveVoucher(actor: Actor, input: ReserveVoucherInput, session: ClientSession): Promise<VoucherRedemption> {
    this.authenticated(actor); this.transaction(session);
    const phone = this.phone(input.customerPhone);
    const existing = await this.db.voucherRedemptions.findOne({ orderId: input.orderId }).session(session).lean();
    if (existing) {
      const voucher = await this.db.vouchers.findOne({ id: existing.voucherId }).session(session).lean();
      if (existing.actorId !== actor.id || existing.customerPhoneNormalized !== phone || voucher?.code !== input.code.trim().toUpperCase() || existing.state === "RELEASED") throw new ConflictException("VOUCHER_REDEMPTION_CONFLICT");
      return existing;
    }
    const voucher = await this.verifyVoucher(actor, input, session);
    const total = await this.db.vouchers.updateOne({ id: voucher.id, version: voucher.version, active: true, $expr: { $lt: [{ $add: ["$reservedCount", "$consumedCount"] }, "$maxUsageTotal"] } }, { $inc: { reservedCount: 1 } }, { session });
    if (total.modifiedCount !== 1) throw new ConflictException("VOUCHER_LIMIT_REACHED");
    const identity = { voucherId: voucher.id, customerPhoneNormalized: phone };
    // The global voucher write serializes first-use counter upserts as well.
    await this.db.voucherCustomerCounters.updateOne(identity, { $setOnInsert: { ...identity, reservedCount: 0, consumedCount: 0 } }, { session, upsert: true });
    const customer = await this.db.voucherCustomerCounters.updateOne({ ...identity, $expr: { $lt: [{ $add: ["$reservedCount", "$consumedCount"] }, voucher.maxUsagePerCustomer] } }, { $inc: { reservedCount: 1 } }, { session });
    if (customer.modifiedCount !== 1) throw new ConflictException("VOUCHER_LIMIT_REACHED");
    const redemption: VoucherRedemption = { ...identity, id: randomUUID(), orderId: input.orderId, actorId: actor.id, state: "RESERVED", createdAt: new Date(), updatedAt: new Date() };
    await this.db.voucherRedemptions.create([redemption], { session });
    return redemption;
  }
  async consumeVoucher(order: VoucherOrder, session: ClientSession): Promise<VoucherRedemption | null> {
    this.transaction(session);
    const redemption = await this.db.voucherRedemptions.findOne({ orderId: order.id }).session(session).lean();
    if (!redemption || redemption.state === "CONSUMED") return redemption;
    if (redemption.state !== "RESERVED" || !["PENDING", "CONFIRMED"].includes(order.status)) throw new ConflictException("VOUCHER_STATE_CONFLICT");
    return this.moveRedemption(redemption, "CONSUMED", session);
  }
  async releaseVoucher(order: VoucherOrder, session: ClientSession): Promise<VoucherRedemption | null> {
    this.transaction(session);
    const redemption = await this.db.voucherRedemptions.findOne({ orderId: order.id }).session(session).lean();
    if (!redemption || redemption.state === "RELEASED" || order.shippedAt || !["PENDING", "CONFIRMED", "PACKING", "CANCELLED"].includes(order.status)) return redemption;
    return this.moveRedemption(redemption, "RELEASED", session);
  }
  private async moveRedemption(redemption: VoucherRedemption, state: "CONSUMED" | "RELEASED", session: ClientSession): Promise<VoucherRedemption> {
    const source = redemption.state === "RESERVED" ? "reservedCount" : "consumedCount";
    const delta = state === "CONSUMED" ? { reservedCount: -1, consumedCount: 1 } : { [source]: -1 };
    const updatedAt = new Date();
    const changed = await this.db.voucherRedemptions.updateOne({ id: redemption.id, state: redemption.state }, { $set: { state, updatedAt } }, { session });
    if (changed.modifiedCount !== 1) throw new ConflictException("VOUCHER_STATE_CONFLICT");
    const global = await this.db.vouchers.updateOne({ id: redemption.voucherId, [source]: { $gte: 1 } }, { $inc: delta }, { session });
    const customer = await this.db.voucherCustomerCounters.updateOne({ voucherId: redemption.voucherId, customerPhoneNormalized: redemption.customerPhoneNormalized, [source]: { $gte: 1 } }, { $inc: delta }, { session });
    if (global.modifiedCount !== 1 || customer.modifiedCount !== 1) throw new ConflictException("VOUCHER_COUNTER_INCONSISTENT");
    return { ...redemption, state, updatedAt };
  }
}
