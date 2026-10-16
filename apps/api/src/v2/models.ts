import { Schema } from "mongoose";
import type { StoredSession, StoredUser } from "../auth/auth.service";
import type { OrderStatus } from "../domain";
export interface Product { id: string; sku: string; name: string; netWeightG: number; retailPriceVnd: number; active: boolean; version: number; promotionRevision?: number }
export interface Order {
  id: string; orderCode: string; responsibleMemberId: string | null; status: OrderStatus; version: number;
  customer: { name: string; phone: string; address: string; area: string }; consentAt: Date; source: string; notes?: string;
  pricingSchemaVersion?: number;
  pricingMode?: "BASE_PRICE" | "PUBLIC_PROMOTIONS" | "INTERNAL_VOUCHER";
  merchandiseSubtotalVnd?: number; discountVnd?: number; pricedAt?: Date; voucherId?: string;
  items: Array<{ sku: string; qty: number; unitPriceVnd: number; retailUnitPriceVnd?: number; grossLineTotalVnd?: number; lineDiscountVnd?: number; finalLineTotalVnd?: number; discountSourceType?: "NONE" | "PROMOTION" | "VOUCHER"; discountSourceId?: string; discountLabelSnapshot?: string }>;
  allocations: Array<{ batchId: string; sku: string; qty: number; landedUnitCostVnd: number; returnedQty?: number }>;
  returnValueVnd?: number; returnRefundsVnd?: number;
  totalVnd: number; receiptsVnd: number; refundsVnd: number; cogsVnd: number; directCostsVnd: number;
  costsFinalized: boolean; commissionRateBps: number; commissionVnd: number; shippedAt?: Date; deliveredAt?: Date; createdAt: Date;
}
export interface Batch { id: string; sku: string; lotCode: string; receivedAt: Date; expiresAt?: Date; labelReference?: string; onHand: number; reserved: number; landedUnitCostVnd: number; status: "AVAILABLE" | "QUARANTINED"; receiptId?: string; receiptCode?: string; supplierLotCode?: string; purchasePriceVnd?: number; allocatedShippingVnd?: number; }
export interface PurchaseReceiptItem {
  sku: string;
  qty: number;
  purchasePriceVnd: number;
  lineTotalVnd: number;
  allocatedShippingVnd: number;
  landedUnitCostVnd: number;
  batchId: string;
  lotCode: string;
  supplierLotCode?: string;
  expiresAt?: Date;
}
export interface PurchaseReceipt {
  id: string;
  receiptCode: string;
  receivedAt: Date;
  shippingFeeVnd: number;
  subtotalVnd: number;
  totalCostVnd: number;
  items: PurchaseReceiptItem[];
  notes?: string;
  documentRef?: string;
  actorId: string;
  createdAt: Date;
}
export interface Movement { id: string; batchId: string; sku: string; orderId?: string; type: string; reason: string; qtyDelta: number; reservedDelta: number; actorId: string; createdAt: Date }
export interface Ledger { id: string; kind: "PAYMENT" | "REFUND" | "EXPENSE" | "COMMISSION" | "PAYOUT" | "RETURN_CREDIT" | "COGS_REVERSAL" | "REFUND_RECLASSIFICATION" | "KPI_BONUS"; orderId?: string; memberId?: string; amountVnd: number; scope?: string; category?: string; method?: string; reference?: string; reason?: string; actorId: string; createdAt: Date }
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
userSchema.add({
  authVersion: { ...nonnegative, default: 0 },
  commissionRateBps: { type: Number, min: 0, max: 10000, default: 4000 },
  bankInfo: {
    bankName: String,
    accountNumber: String,
    accountHolder: String,
    note: String,
  },
  commissionRateHistory: [
    {
      rateBps: { type: Number, min: 0, max: 10000, required: true },
      changedBy: { type: String, required: true },
      changedAt: { type: Date, required: true },
      reason: String,
    },
  ],
});
sessionSchema.add({ authVersion: { ...nonnegative, default: 0 } });
export const productSchema = new Schema<Product>({ id, sku: { type: String, unique: true, required: true }, name: { type: String, required: true }, netWeightG: { ...nonnegative, default: 0 }, retailPriceVnd: nonnegative, active: { type: Boolean, required: true }, version: nonnegative }, options);
const itemSchema = new Schema({ sku: { type: String, required: true }, qty: { ...integer, min: 1 }, unitPriceVnd: nonnegative }, { _id: false, strict: "throw" });
productSchema.add({ promotionRevision: { ...nonnegative, required: false } });
itemSchema.add({ retailUnitPriceVnd: { ...nonnegative, required: false }, grossLineTotalVnd: { ...nonnegative, required: false }, lineDiscountVnd: { ...nonnegative, required: false }, finalLineTotalVnd: { ...nonnegative, required: false }, discountSourceType: { type: String, enum: ["NONE", "PROMOTION", "VOUCHER"] }, discountSourceId: String, discountLabelSnapshot: String });
const allocationSchema = new Schema({ batchId: { type: String, required: true }, sku: { type: String, required: true }, qty: { ...integer, min: 1 }, landedUnitCostVnd: nonnegative, returnedQty: { ...nonnegative, default: 0 } }, { _id: false, strict: "throw" });
const customerSchema = new Schema({ name: { type: String, required: true }, phone: { type: String, required: true }, address: { type: String, required: true }, area: { type: String, required: true } }, { _id: false, strict: "throw" });
export const orderSchema = new Schema<Order>({ id, orderCode: { type: String, required: true, unique: true }, responsibleMemberId: { type: String, default: null }, status: { type: String, required: true, enum: ["PENDING", "CONFIRMED", "PACKING", "SHIPPING", "DELIVERED", "CANCELLED", "DELIVERY_FAILED", "RETURN_REQUESTED", "PARTIALLY_RETURNED", "RETURNED"] }, version: nonnegative, customer: { type: customerSchema, required: true }, consentAt: { type: Date, required: true }, source: { type: String, required: true }, notes: String, items: { type: [itemSchema], required: true }, allocations: { type: [allocationSchema], default: [] }, totalVnd: nonnegative, receiptsVnd: nonnegative, refundsVnd: nonnegative, cogsVnd: nonnegative, directCostsVnd: nonnegative, costsFinalized: { type: Boolean, required: true }, commissionRateBps: { ...nonnegative, max: 10000 }, commissionVnd: nonnegative, shippedAt: Date, deliveredAt: Date, createdAt: { type: Date, required: true } }, options);
orderSchema.index({ responsibleMemberId: 1, createdAt: -1, id: 1 });
orderSchema.add({ returnValueVnd: { ...nonnegative, default: 0 }, returnRefundsVnd: { ...nonnegative, default: 0 } });
orderSchema.index({ status: 1, deliveredAt: -1 });
orderSchema.add({ pricingSchemaVersion: { ...integer, required: false, enum: [1, 2] }, pricingMode: { type: String, enum: ["BASE_PRICE", "PUBLIC_PROMOTIONS", "INTERNAL_VOUCHER"] }, merchandiseSubtotalVnd: { ...nonnegative, required: false }, discountVnd: { ...nonnegative, required: false }, pricedAt: Date, voucherId: String });
export const batchSchema = new Schema<Batch>({ id, sku: { type: String, required: true }, lotCode: { type: String, required: true }, receivedAt: { type: Date, required: true }, expiresAt: Date, labelReference: String, onHand: nonnegative, reserved: nonnegative, landedUnitCostVnd: nonnegative, status: { type: String, enum: ["AVAILABLE", "QUARANTINED"], required: true } }, options);
batchSchema.add({
  receiptId: String,
  receiptCode: String,
  supplierLotCode: String,
  purchasePriceVnd: Number,
  allocatedShippingVnd: Number,
});
batchSchema.index({ sku: 1, lotCode: 1 }, { unique: true });
batchSchema.index({ sku: 1, status: 1, expiresAt: 1, receivedAt: 1, id: 1 });

const purchaseReceiptItemSchema = new Schema(
  {
    sku: { type: String, required: true },
    qty: { ...integer, min: 1 },
    purchasePriceVnd: nonnegative,
    lineTotalVnd: nonnegative,
    allocatedShippingVnd: nonnegative,
    landedUnitCostVnd: nonnegative,
    batchId: { type: String, required: true },
    lotCode: { type: String, required: true },
    supplierLotCode: String,
    expiresAt: Date,
  },
  { _id: false, strict: "throw" }
);

export const purchaseReceiptSchema = new Schema<PurchaseReceipt>(
  {
    id,
    receiptCode: { type: String, required: true, unique: true },
    receivedAt: { type: Date, required: true },
    shippingFeeVnd: nonnegative,
    subtotalVnd: nonnegative,
    totalCostVnd: nonnegative,
    items: { type: [purchaseReceiptItemSchema], required: true },
    notes: String,
    documentRef: String,
    actorId: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  options
);
purchaseReceiptSchema.index({ receivedAt: -1, createdAt: -1 });
export const movementSchema = new Schema<Movement>({ id, batchId: { type: String, required: true, index: true }, sku: { type: String, required: true }, orderId: { type: String, index: true }, type: { type: String, required: true }, reason: { type: String, required: true }, qtyDelta: integer, reservedDelta: integer, actorId: { type: String, required: true }, createdAt: { type: Date, required: true } }, options);
export const ledgerSchema = new Schema<Ledger>({ id, kind: { type: String, required: true, enum: ["PAYMENT", "REFUND", "EXPENSE", "COMMISSION", "PAYOUT"] }, orderId: String, memberId: String, amountVnd: integer, scope: String, category: String, method: String, reference: String, reason: String, actorId: { type: String, required: true }, createdAt: { type: Date, required: true } }, options);
ledgerSchema.index({ memberId: 1, kind: 1, createdAt: -1 });
(ledgerSchema.path("kind") as Schema.Types.String).enum({ values: ["PAYMENT", "REFUND", "EXPENSE", "COMMISSION", "PAYOUT", "RETURN_CREDIT", "COGS_REVERSAL", "REFUND_RECLASSIFICATION", "KPI_BONUS"] });
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

export interface DiscountConfiguration {
  id: string; name: string; value: number; maxDiscountVnd?: number; startAt: Date; endAt: Date; active: boolean;
  version: number; createdAt: Date; updatedAt: Date; deletedAt?: Date;
}
export interface Promotion extends DiscountConfiguration { sku: string; kind: "FIXED_PER_UNIT" | "PERCENT" }
export interface Voucher extends DiscountConfiguration {
  code: string; kind: "FIXED" | "PERCENT"; minSubtotalVnd: number; maxUsageTotal: number; maxUsagePerCustomer: number;
  assignedMemberIds: string[]; reservedCount: number; consumedCount: number;
}
export interface VoucherRedemption {
  id: string; voucherId: string; orderId: string; actorId: string; customerPhoneNormalized: string;
  state: "RESERVED" | "CONSUMED" | "RELEASED"; createdAt: Date; updatedAt: Date;
}
export interface VoucherCustomerCounter { voucherId: string; customerPhoneNormalized: string; reservedCount: number; consumedCount: number }
const discountFields = {
  id, name: { type: String, required: true, trim: true }, value: { ...nonnegative, validate: { validator(this: Promotion | Voucher, value: number) { return Number.isSafeInteger(value) && (this.kind !== "PERCENT" || value <= 10000); } } },
  maxDiscountVnd: { ...nonnegative, required(this: Promotion | Voucher) { return this.kind === "PERCENT"; } },
  startAt: { type: Date, required: true }, endAt: { type: Date, required: true, validate: { validator(this: Promotion | Voucher, value: Date) { return value > this.startAt; } } },
  active: { type: Boolean, required: true }, version: nonnegative, createdAt: { type: Date, required: true }, updatedAt: { type: Date, required: true }, deletedAt: Date,
};
export const promotionSchema = new Schema<Promotion>({ ...discountFields, sku: { type: String, required: true }, kind: { type: String, required: true, enum: ["FIXED_PER_UNIT", "PERCENT"] } }, options);
promotionSchema.index({ sku: 1, active: 1, startAt: 1, endAt: 1 });
export const voucherSchema = new Schema<Voucher>({
  ...discountFields, code: { type: String, required: true, unique: true, match: /^[A-Z0-9][A-Z0-9_-]{0,63}$/ }, kind: { type: String, required: true, enum: ["FIXED", "PERCENT"] },
  minSubtotalVnd: nonnegative, maxUsageTotal: { ...integer, min: 1 }, maxUsagePerCustomer: { ...integer, min: 1 },
  assignedMemberIds: { type: [String], required: true, default: undefined }, reservedCount: nonnegative,
  consumedCount: { ...nonnegative, validate: { validator(this: Voucher, value: number) { return Number.isSafeInteger(value) && value + this.reservedCount <= this.maxUsageTotal; } } },
}, options);
voucherSchema.index({ assignedMemberIds: 1, active: 1 });
const phoneNormalized = { type: String, required: true, match: /^\+84[35789]\d{8}$/ };
export const voucherRedemptionSchema = new Schema<VoucherRedemption>({ id, voucherId: { type: String, required: true, index: true }, orderId: { type: String, required: true, unique: true }, actorId: { type: String, required: true }, customerPhoneNormalized: phoneNormalized, state: { type: String, required: true, enum: ["RESERVED", "CONSUMED", "RELEASED"] }, createdAt: { type: Date, required: true }, updatedAt: { type: Date, required: true } }, options);
export const voucherCustomerCounterSchema = new Schema<VoucherCustomerCounter>({ voucherId: { type: String, required: true }, customerPhoneNormalized: phoneNormalized, reservedCount: nonnegative, consumedCount: nonnegative }, options);
voucherCustomerCounterSchema.index({ voucherId: 1, customerPhoneNormalized: 1 }, { unique: true });

export interface MediaAsset {
  id: string;
  url: string;
  title: string;
  tag: string;
  description?: string;
  publicId?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaSlot {
  slotKey: string;
  url: string;
  mediaAssetId?: string;
  updatedAt: Date;
}

export const mediaAssetSchema = new Schema<MediaAsset>(
  {
    id,
    url: { type: String, required: true },
    title: { type: String, required: true },
    tag: { type: String, required: true },
    description: String,
    publicId: String,
    width: Number,
    height: Number,
    format: String,
    bytes: Number,
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  options,
);
mediaAssetSchema.index({ tag: 1, createdAt: -1 });

export const mediaSlotSchema = new Schema<MediaSlot>(
  {
    slotKey: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    mediaAssetId: String,
    updatedAt: { type: Date, required: true },
  },
  options,
);

export interface KpiTier {
  minQty: number;
  bonusVnd: number;
}

export interface KpiPolicy {
  id: string;
  name: string;
  periodType: "MONTHLY" | "WEEKLY" | "CUSTOM";
  metric: "PRODUCT_QTY" | "REVENUE";
  tiers: KpiTier[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface KpiPeriod {
  id: string;
  policyId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: "OPEN" | "SETTLED";
  settledAt?: Date;
  settledBy?: string;
  createdAt: Date;
}

export interface KpiAward {
  id: string;
  periodId: string;
  memberId: string;
  totalDeliveredQty: number;
  achievedTierQty?: number;
  bonusVnd: number;
  ledgerEntryId?: string;
  createdAt: Date;
}

const kpiTierSchema = new Schema(
  {
    minQty: { ...integer, min: 1 },
    bonusVnd: nonnegative,
  },
  { _id: false, strict: "throw" },
);

export const kpiPolicySchema = new Schema<KpiPolicy>(
  {
    id,
    name: { type: String, required: true },
    periodType: { type: String, required: true, enum: ["MONTHLY", "WEEKLY", "CUSTOM"] },
    metric: { type: String, required: true, enum: ["PRODUCT_QTY", "REVENUE"], default: "PRODUCT_QTY" },
    tiers: { type: [kpiTierSchema], required: true },
    active: { type: Boolean, required: true, default: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
  },
  options,
);
kpiPolicySchema.index({ active: 1, createdAt: -1 });

export const kpiPeriodSchema = new Schema<KpiPeriod>(
  {
    id,
    policyId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: { type: String, required: true, enum: ["OPEN", "SETTLED"], default: "OPEN" },
    settledAt: Date,
    settledBy: String,
    createdAt: { type: Date, required: true },
  },
  options,
);
kpiPeriodSchema.index({ status: 1, startDate: -1 });

export const kpiAwardSchema = new Schema<KpiAward>(
  {
    id,
    periodId: { type: String, required: true, index: true },
    memberId: { type: String, required: true, index: true },
    totalDeliveredQty: nonnegative,
    achievedTierQty: { ...nonnegative, required: false },
    bonusVnd: nonnegative,
    ledgerEntryId: String,
    createdAt: { type: Date, required: true },
  },
  options,
);
kpiAwardSchema.index({ periodId: 1, memberId: 1 }, { unique: true });

