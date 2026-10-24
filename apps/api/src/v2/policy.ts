import { createHash } from "node:crypto";
import { calculateCommission, type Role } from "../domain";
import type { Order } from "./models";
export type Actor = { id: string; role: Role; displayName?: string; commissionRateBps?: number };
export function orderScope(actor: Actor) { return actor.role === "OWNER_ADMIN" ? {} : { responsibleMemberId: actor.id }; }
export function fingerprint(value: unknown): string {
  const canonical = (item: unknown): unknown => Array.isArray(item) ? item.map(canonical) : item && typeof item === "object" ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)])) : item;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
export type OrderView = {
  id: string; orderCode?: string; status: string; version: number; customer?: { name: string; phone: string; address: string; area: string }; items: Order["items"];
  pricingSchemaVersion?: number; pricingMode?: Order["pricingMode"]; merchandiseSubtotalVnd?: number; discountVnd?: number; pricedAt?: Date;
  totalVnd?: number; receiptsVnd?: number; refundsVnd?: number; responsibleMemberId?: string | null; createdAt?: Date; cogsVnd?: number; directCostsVnd?: number; costsFinalized?: boolean; commissionVnd?: number;
  shippedAt?: Date; deliveredAt?: Date; returnValueVnd?: number; returnRefundsVnd?: number;
  allocations?: Array<{ batchId: string; sku: string; qty: number; returnedQty?: number; landedUnitCostVnd: number }>;
};
export function orderProjection(order: OrderView, actor: Actor) {
  return {
    id: order.id, orderCode: order.orderCode, status: order.status, version: order.version,
    customer: order.customer ? { name: order.customer.name, phone: order.customer.phone, address: order.customer.address, area: order.customer.area } : undefined,
    items: order.items.map(item => ({ sku: item.sku, qty: item.qty, unitPriceVnd: item.unitPriceVnd,
      ...(order.pricingSchemaVersion === 2 ? { retailUnitPriceVnd: item.retailUnitPriceVnd, grossLineTotalVnd: item.grossLineTotalVnd, lineDiscountVnd: item.lineDiscountVnd, finalLineTotalVnd: item.finalLineTotalVnd, discountSourceType: item.discountSourceType, discountLabelSnapshot: item.discountLabelSnapshot } : {}) })),
    ...(order.pricingSchemaVersion === 2 ? { pricingSchemaVersion: 2, pricingMode: order.pricingMode, merchandiseSubtotalVnd: order.merchandiseSubtotalVnd, discountVnd: order.discountVnd, pricedAt: order.pricedAt } : {}),
    totalVnd: order.totalVnd, receiptsVnd: order.receiptsVnd, refundsVnd: order.refundsVnd, responsibleMemberId: order.responsibleMemberId, createdAt: order.createdAt,
    paymentDueVnd: paymentDue(order),
    commissionVnd: order.commissionVnd,
    ...(actor.role === "OWNER_ADMIN" ? { cogsVnd: order.cogsVnd, directCostsVnd: order.directCostsVnd, costsFinalized: order.costsFinalized, commissionVnd: order.commissionVnd,
      shippedAt: order.shippedAt, deliveredAt: order.deliveredAt,
      ...(order.allocations ? { allocations: order.allocations.map(line => ({ batchId: line.batchId, sku: line.sku, qty: line.qty, returnedQty: line.returnedQty ?? 0, returnableQty: Math.max(0, line.qty - (line.returnedQty ?? 0)), landedUnitCostVnd: line.landedUnitCostVnd })) } : {}),
      returnValueVnd: order.returnValueVnd ?? 0, returnRefundsVnd: order.returnRefundsVnd ?? 0,
      returnCreditBalanceVnd: Math.max(0, (order.returnValueVnd ?? 0) - (order.returnRefundsVnd ?? 0)),
      refundableVnd: Math.max(0, (order.receiptsVnd ?? 0) - (order.refundsVnd ?? 0)),
      returnRefundDueVnd: Math.max(0, (order.receiptsVnd ?? 0) - (order.totalVnd ?? 0) + (order.returnValueVnd ?? 0) - (order.returnRefundsVnd ?? 0)),
    } : {}),
  };
}
export function paymentDue(order: { status: string; totalVnd?: number; receiptsVnd?: number; returnValueVnd?: number; returnRefundsVnd?: number }) {
  if (["CANCELLED", "RETURNED"].includes(order.status)) return 0;
  return Math.max(0, (order.totalVnd ?? 0) - (order.returnValueVnd ?? 0) - (order.receiptsVnd ?? 0) + (order.returnRefundsVnd ?? 0));
}
export function commissionTarget(order: { status: string; deliveredAt?: Date; returnValueVnd?: number; returnRefundsVnd?: number; responsibleMemberId?: string | null; totalVnd: number; receiptsVnd: number; refundsVnd: number; cogsVnd: number; directCostsVnd: number; costsFinalized: boolean; commissionRateBps: number }) {
  if (order.status === "RETURNED") return 0;
  const revenue = order.totalVnd - (order.returnValueVnd ?? 0) - order.refundsVnd + (order.returnRefundsVnd ?? 0);
  const recognized = order.status === "DELIVERED" || (!!order.deliveredAt && ["PARTIALLY_RETURNED", "RETURNED"].includes(order.status));
  return calculateCommission({ ownerRole: order.responsibleMemberId ? "MEMBER" : "OWNER_ADMIN", sellingPriceVnd: revenue, originalCostVnd: order.cogsVnd,
    eligible: recognized, memberRateBps: order.commissionRateBps }).memberAmountVnd;
}
