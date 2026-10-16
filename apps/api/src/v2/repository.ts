import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { ClientSession, Connection } from "mongoose";
import type { AuthRepository, StoredSession } from "../auth/auth.service";
import { fingerprint } from "./policy";
import * as schemas from "./models";

@Injectable()
export class MongoRepository implements AuthRepository {
  readonly users; readonly sessions; readonly products; readonly orders; readonly batches; readonly movements; readonly ledger; readonly audit; readonly keys; readonly balances; readonly rates;
  readonly resets; readonly mediaAssets; readonly mediaSlots; readonly purchaseReceipts;
  readonly promotions; readonly vouchers; readonly voucherRedemptions; readonly voucherCustomerCounters;
  readonly kpiPolicies; readonly kpiPeriods; readonly kpiAwards;
  constructor(@InjectConnection() private readonly connection: Connection) {
    this.users = connection.model("V2User", schemas.userSchema, "users");
    this.sessions = connection.model("V2Session", schemas.sessionSchema, "sessions");
    this.products = connection.model("V2Product", schemas.productSchema, "products");
    this.orders = connection.model("V2Order", schemas.orderSchema, "orders");
    this.batches = connection.model("V2Batch", schemas.batchSchema, "inventoryBatches");
    this.movements = connection.model("V2Movement", schemas.movementSchema, "inventoryMovements");
    this.ledger = connection.model("V2Ledger", schemas.ledgerSchema, "financialLedger");
    this.audit = connection.model("V2Audit", schemas.auditSchema, "auditLogs");
    this.keys = connection.model("V2Idempotency", schemas.idempotencySchema, "idempotencyRecords");
    this.balances = connection.model("V2Balance", schemas.balanceSchema, "commissionBalances");
    this.rates = connection.model("V2Rate", schemas.rateSchema, "rateLimits");
    this.resets = connection.model("V2Reset", schemas.resetSchema, "passwordResetTokens");
    this.mediaAssets = connection.model("V2MediaAsset", schemas.mediaAssetSchema, "mediaAssets");
    this.mediaSlots = connection.model("V2MediaSlot", schemas.mediaSlotSchema, "mediaSlots");
    this.purchaseReceipts = connection.model("V2PurchaseReceipt", schemas.purchaseReceiptSchema, "purchaseReceipts");
    this.promotions = connection.model("V2Promotion", schemas.promotionSchema, "promotions");
    this.vouchers = connection.model("V2Voucher", schemas.voucherSchema, "vouchers");
    this.voucherRedemptions = connection.model("V2VoucherRedemption", schemas.voucherRedemptionSchema, "voucherRedemptions");
    this.voucherCustomerCounters = connection.model("V2VoucherCustomerCounter", schemas.voucherCustomerCounterSchema, "voucherCustomerCounters");
    this.kpiPolicies = connection.model("V2KpiPolicy", schemas.kpiPolicySchema, "kpiPolicies");
    this.kpiPeriods = connection.model("V2KpiPeriod", schemas.kpiPeriodSchema, "kpiPeriods");
    this.kpiAwards = connection.model("V2KpiAward", schemas.kpiAwardSchema, "kpiAwards");
  }
  async transaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      return await session.withTransaction(() => work(session), { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary" });
    } finally { await session.endSession(); }
  }
  async idempotent<T>(scope: string, key: string, payload: unknown, work: (session: ClientSession) => Promise<T>): Promise<T> {
    const query = { scope, keyHash: fingerprint(key) };
    const requestHash = fingerprint(payload);
    const replay = (entry: schemas.Idempotency) => {
      if (entry.requestHash !== requestHash) throw new ConflictException("IDEMPOTENCY_CONFLICT");
      return entry.response as T;
    };
    try {
      return await this.transaction(async session => {
        const existing = await this.keys.findOne(query).session(session).lean();
        if (existing) return replay(existing);
        // The unique key, response, journal and business writes commit together.
        const response = await work(session);
        await this.keys.create([{ ...query, requestHash, response }], { session });
        return response;
      });
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === 11000) {
        const existing = await this.keys.findOne(query).lean();
        if (existing) return replay(existing);
        throw new ConflictException("UNIQUE_CONFLICT");
      }
      throw error;
    }
  }
  async saveOrder(order: schemas.Order, expectedVersion: number, session: ClientSession) {
    const { id, ...fields } = order;
    const result = await this.orders.updateOne({ id, version: expectedVersion }, { $set: { ...fields, version: expectedVersion + 1 } }, { session, runValidators: true });
    if (result.modifiedCount !== 1) throw new ConflictException("VERSION_CONFLICT");
    order.version = expectedVersion + 1;
  }
  async scopedOrder(id: string, scope: object, session?: ClientSession) {
    const order = await this.orders.findOne({ id, ...scope }, { _id: 0 }).session(session ?? null).lean();
    if (!order) throw new NotFoundException("RESOURCE_NOT_FOUND");
    return order;
  }
  findUserByEmail(emailNormalized: string) { return this.users.findOne({ emailNormalized }).select("+passwordHash").lean().exec(); }
  findUserById(id: string) { return this.users.findOne({ id }).lean().exec(); }
  async createSession(session: StoredSession) { await this.sessions.create(session); }
  findSessionByHash(tokenHash: string) { return this.sessions.findOne({ tokenHash }).lean().exec(); }
  async touchSession(tokenHash: string, idleExpiresAt: Date) { await this.sessions.updateOne({ tokenHash, revokedAt: null }, { $max: { idleExpiresAt } }); }
  async revokeSession(tokenHash: string) { await this.sessions.updateOne({ tokenHash, revokedAt: null }, { $set: { revokedAt: new Date() } }); }
  async revokeAllUserSessions(userId: string) { await this.sessions.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } }); }
}
