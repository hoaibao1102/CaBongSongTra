export type Lang = "vi" | "en";
export type Role = "OWNER_ADMIN" | "MEMBER";
export type Actor = { id: string; role: Role; displayName?: string; commissionRateBps?: number };
export type InventoryAvailability = Record<string, { available: number; nearestExpiry: string | null; estimatedUnitCostVnd?: number }>;
export type Product = {
  sku: string;
  name: string;
  netWeightG: number;
  retailPriceVnd: number;
  effectivePriceVnd?: number;
  promotionEndsAt?: string;
};
export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PACKING"
  | "SHIPPING"
  | "DELIVERED"
  | "CANCELLED"
  | "DELIVERY_FAILED"
  | "RETURN_REQUESTED"
  | "PARTIALLY_RETURNED"
  | "RETURNED";
export type Order = {
  paymentDueVnd?: number;
  allocations?: {
    batchId: string;
    sku: string;
    qty: number;
    returnedQty: number;
    returnableQty: number;
    landedUnitCostVnd: number;
  }[];
  returnValueVnd?: number;
  returnRefundsVnd?: number;
  returnCreditBalanceVnd?: number;
  refundableVnd?: number;
  returnRefundDueVnd?: number;
  id: string;
  orderCode: string;
  status: OrderStatus;
  version: number;
  responsibleMemberId?: string | null;
  customer: { name: string; phone: string; address: string; area: string };
  items: { sku: string; qty: number; unitPriceVnd: number }[];
  totalVnd: number;
  receiptsVnd: number;
  refundsVnd: number;
  costsFinalized?: boolean;
  cogsVnd?: number;
  directCostsVnd?: number;
  commissionVnd?: number;
};
export type RecordRow = Record<string, unknown>;

export type Batch = {
  id: string;
  sku: string;
  lotCode: string;
  receivedAt: string;
  expiresAt?: string;
  labelReference?: string;
  onHand: number;
  reserved: number;
  landedUnitCostVnd: number;
  status: "AVAILABLE" | "QUARANTINED";
  receiptCode?: string;
  supplierLotCode?: string;
  purchasePriceVnd?: number;
  allocatedShippingVnd?: number;
};

export type PurchaseReceiptItem = {
  sku: string;
  qty: number;
  purchasePriceVnd: number;
  lineTotalVnd: number;
  allocatedShippingVnd: number;
  landedUnitCostVnd: number;
  batchId: string;
  lotCode: string;
  supplierLotCode?: string;
  expiresAt?: string;
};

export type PurchaseReceipt = {
  id: string;
  receiptCode: string;
  receivedAt: string;
  shippingFeeVnd: number;
  subtotalVnd: number;
  totalCostVnd: number;
  items: PurchaseReceiptItem[];
  notes?: string;
  documentRef?: string;
  actorId: string;
  createdAt: string;
};

export type MemberUser = {
  id: string;
  displayName: string;
  emailNormalized: string;
  role: Role;
  status: "ACTIVE" | "INACTIVE";
  commissionRateBps?: number;
  bankInfo?: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    note?: string;
  };
};

export type KpiTier = {
  minQty: number;
  bonusVnd: number;
};

export type KpiPolicy = {
  id: string;
  name: string;
  periodType: "MONTHLY" | "WEEKLY" | "CUSTOM";
  metric: "PRODUCT_QTY" | "REVENUE";
  tiers: KpiTier[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type KpiPeriod = {
  id: string;
  policyId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "OPEN" | "SETTLED";
  settledAt?: string;
  settledBy?: string;
  createdAt: string;
};

export type KpiProgress = {
  hasActivePeriod: boolean;
  period?: KpiPeriod;
  policy?: {
    id: string;
    name: string;
    periodType: "MONTHLY" | "WEEKLY" | "CUSTOM";
    tiers: KpiTier[];
  };
  currentQty?: number;
  achievedTier?: KpiTier | null;
  currentBonusVnd?: number;
  nextTier?: KpiTier | null;
  remainingQtyToNextTier?: number;
  progressPercent?: number;
};

