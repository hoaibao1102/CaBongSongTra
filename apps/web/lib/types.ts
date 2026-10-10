export type Lang = "vi" | "en";
export type Role = "OWNER_ADMIN" | "MEMBER";
export type Actor = { id: string; role: Role; displayName?: string };
export type Product = {
  sku: string;
  name: string;
  netWeightG: number;
  retailPriceVnd: number;
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
