import { Schema } from "mongoose";
import type { StoredSession, StoredUser } from "../auth/auth.service";
import type { OrderStatus } from "../domain";
export interface Product { id: string; sku: string; name: string; netWeightG: number; retailPriceVnd: number; active: boolean; version: number }
export interface Order {
  id: string; orderCode: string; responsibleMemberId: string | null; status: OrderStatus; version: number;
  customer: { name: string; phone: string; address: string; area: string }; consentAt: Date; source: string; notes?: string;
  items: Array<{ sku: string; qty: number; unitPriceVnd: number }>;
  allocations: Array<{ batchId: string; sku: string; qty: number; landedUnitCostVnd: number; returnedQty?: number }>;
  returnValueVnd?: number; returnRefundsVnd?: number;
  totalVnd: number; receiptsVnd: number; refundsVnd: number; cogsVnd: number; directCostsVnd: number;
  costsFinalized: boolean; commissionRateBps: number; commissionVnd: number; shippedAt?: Date; deliveredAt?: Date; createdAt: Date;
}
export interface Batch { id: string; sku: string; lotCode: string; receivedAt: Date; expiresAt?: Date; labelReference?: string; onHand: number; reserved: number; landedUnitCostVnd: number; status: "AVAILABLE" | "QUARANTINED" }
export interface Movement { id: string; batchId: string; sku: string; orderId?: string; type: string; reason: string; qtyDelta: number; reservedDelta: number; actorId: string; createdAt: Date }
export interface Ledger { id: string; kind: "PAYMENT" | "REFUND" | "EXPENSE" | "COMMISSION" | "PAYOUT" | "RETURN_CREDIT" | "COGS_REVERSAL" | "REFUND_RECLASSIFICATION"; orderId?: string; memberId?: string; amountVnd: number; scope?: string; category?: string; method?: string; reference?: string; reason?: string; actorId: string; createdAt: Date }
export interface Audit { id: string; actorId: string; action: string; entityId: string; requestId: string; from?: string; to?: string; createdAt: Date }
export interface Idempotency { scope: string; keyHash: string; requestHash: string; response: unknown }
export interface Balance { memberId: string; balanceVnd: number }
export interface Rate { key: string; count: number; expiresAt: Date }
const integer = { type: Number, required: true, validate: Number.isSafeInteger };
const nonnegative = { ...integer, min: 0 };
const id = { type: String, required: true, unique: true };
const options = { strict: "throw" as const, versionKey: false as const };
export const userSchema = new Schema<StoredUser>({ id, emailNormalized: { type: String, required: true, unique: true }, displayName: { type: String, required: true }, passwordHash: { type: String, required: true, select: false }, role: { type: String, enum: ["MEMBER", "OWNER_ADMIN"], required: true }, status: { type: String, enum: ["ACTIVE", "INACTIVE"], required: true } }, options);
export const sessionSchema = new Schema<StoredSession>({ tokenHash: { type: String, unique: true, required: true }, userId: { type: String, required: true, index: true }, idleExpiresAt: { type: Date, required: true }, absoluteExpiresAt: { type: Date, required: true }, revokedAt: { type: Date, default: null } }, options);
sessionSchema.index({ absoluteExpiresAt: 1 }, { expireAfterSeconds: 0 });
userSchema.add({ authVersion: { ...nonnegative, default: 0 } });
sessionSchema.add({ authVersion: { ...nonnegative, default: 0 } });
export const productSchema = new Schema<Product>({ id, sku: { type: String, unique: true, required: true, enum: ["CBST-300", "CBST-400", "CBST-600"] }, name: { type: String, required: true }, netWeightG: { type: Number, enum: [300, 400, 600], required: true }, retailPriceVnd: nonnegative, active: { type: Boolean, required: true }, version: nonnegative }, options);
const itemSchema = new Schema({ sku: { type: String, required: true }, qty: { ...integer, min: 1 }, unitPriceVnd: nonnegative }, { _id: false, strict: "throw" });
const allocationSchema = new Schema({ batchId: { type: String, required: true }, sku: { type: String, required: true }, qty: { ...integer, min: 1 }, landedUnitCostVnd: nonnegative, returnedQty: { ...nonnegative, default: 0 } }, { _id: false, strict: "throw" });
const customerSchema = new Schema({ name: { type: String, required: true }, phone: { type: String, required: true }, address: { type: String, required: true }, area: { type: String, required: true } }, { _id: false, strict: "throw" });
export const orderSchema = new Schema<Order>({ id, orderCode: { type: String, required: true, unique: true }, responsibleMemberId: { type: String, default: null }, status: { type: String, required: true, enum: ["PENDING", "CONFIRMED", "PACKING", "SHIPPING", "DELIVERED", "CANCELLED", "DELIVERY_FAILED", "RETURN_REQUESTED", "PARTIALLY_RETURNED", "RETURNED"] }, version: nonnegative, customer: { type: customerSchema, required: true }, consentAt: { type: Date, required: true }, source: { type: String, required: true }, notes: String, items: { type: [itemSchema], required: true }, allocations: { type: [allocationSchema], default: [] }, totalVnd: nonnegative, receiptsVnd: nonnegative, refundsVnd: nonnegative, cogsVnd: nonnegative, directCostsVnd: nonnegative, costsFinalized: { type: Boolean, required: true }, commissionRateBps: { ...nonnegative, max: 10000 }, commissionVnd: nonnegative, shippedAt: Date, deliveredAt: Date, createdAt: { type: Date, required: true } }, options);
orderSchema.index({ responsibleMemberId: 1, createdAt: -1, id: 1 });
orderSchema.add({ returnValueVnd: { ...nonnegative, default: 0 }, returnRefundsVnd: { ...nonnegative, default: 0 } });
orderSchema.index({ status: 1, deliveredAt: -1 });
export const batchSchema = new Schema<Batch>({ id, sku: { type: String, required: true }, lotCode: { type: String, required: true }, receivedAt: { type: Date, required: true }, expiresAt: Date, labelReference: String, onHand: nonnegative, reserved: nonnegative, landedUnitCostVnd: nonnegative, status: { type: String, enum: ["AVAILABLE", "QUARANTINED"], required: true } }, options);
batchSchema.index({ sku: 1, lotCode: 1 }, { unique: true });
batchSchema.index({ sku: 1, status: 1, expiresAt: 1, receivedAt: 1, id: 1 });
export const movementSchema = new Schema<Movement>({ id, batchId: { type: String, required: true, index: true }, sku: { type: String, required: true }, orderId: { type: String, index: true }, type: { type: String, required: true }, reason: { type: String, required: true }, qtyDelta: integer, reservedDelta: integer, actorId: { type: String, required: true }, createdAt: { type: Date, required: true } }, options);
export const ledgerSchema = new Schema<Ledger>({ id, kind: { type: String, required: true, enum: ["PAYMENT", "REFUND", "EXPENSE", "COMMISSION", "PAYOUT"] }, orderId: String, memberId: String, amountVnd: integer, scope: String, category: String, method: String, reference: String, reason: String, actorId: { type: String, required: true }, createdAt: { type: Date, required: true } }, options);
ledgerSchema.index({ memberId: 1, kind: 1, createdAt: -1 });
(ledgerSchema.path("kind") as Schema.Types.String).enum({ values: ["PAYMENT", "REFUND", "EXPENSE", "COMMISSION", "PAYOUT", "RETURN_CREDIT", "COGS_REVERSAL", "REFUND_RECLASSIFICATION"] });
ledgerSchema.index({ orderId: 1, createdAt: -1 });
ledgerSchema.index({ kind: 1, createdAt: -1 });
export const auditSchema = new Schema<Audit>({ id, actorId: { type: String, required: true }, action: { type: String, required: true }, entityId: { type: String, required: true }, requestId: { type: String, required: true }, from: String, to: String, createdAt: { type: Date, required: true } }, options);
auditSchema.index({ createdAt: -1, id: 1 });
export const idempotencySchema = new Schema<Idempotency>({ scope: { type: String, required: true }, keyHash: { type: String, required: true }, requestHash: { type: String, required: true }, response: { type: Schema.Types.Mixed, required: true } }, options);
// Financial operation keys do not expire: expiry would allow an old retry to execute twice.
idempotencySchema.index({ scope: 1, keyHash: 1 }, { unique: true });
export const balanceSchema = new Schema<Balance>({ memberId: { type: String, required: true, unique: true }, balanceVnd: integer }, options);
export const rateSchema = new Schema<Rate>({ key: { type: String, required: true, unique: true }, count: nonnegative, expiresAt: { type: Date, required: true } }, options);
rateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export interface ResetToken { tokenHash: string; userId: string; expiresAt: Date }
export const resetSchema = new Schema<ResetToken>({ tokenHash: { type: String, required: true, unique: true }, userId: { type: String, required: true, unique: true }, expiresAt: { type: Date, required: true } }, options);
resetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
// Singleton owner is an explicit provisioning invariant, also under concurrent CLI runs.
userSchema.index({ role: 1 }, { unique: true, partialFilterExpression: { role: "OWNER_ADMIN" } });
