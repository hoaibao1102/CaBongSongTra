export type Role = "OWNER_ADMIN" | "MEMBER";
export type OrderStatus = "PENDING" | "CONFIRMED" | "PACKING" | "SHIPPING" | "DELIVERED" | "CANCELLED" | "DELIVERY_FAILED" | "RETURN_REQUESTED" | "PARTIALLY_RETURNED" | "RETURNED";
export type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PACKING", "CANCELLED"], PACKING: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["DELIVERED", "DELIVERY_FAILED", "RETURN_REQUESTED"], DELIVERED: ["RETURN_REQUESTED"], CANCELLED: [],
  DELIVERY_FAILED: ["SHIPPING", "RETURNED"], RETURN_REQUESTED: ["PARTIALLY_RETURNED", "RETURNED"], PARTIALLY_RETURNED: ["RETURN_REQUESTED", "RETURNED"], RETURNED: [],
};
export function isOrderTransitionAllowed(from: OrderStatus, to: OrderStatus) { return transitions[from]?.includes(to) ?? false; }
export function derivePaymentStatus(amountDueVnd: number, receiptsVnd: number, refundsVnd: number): PaymentStatus {
  if ([amountDueVnd, receiptsVnd, refundsVnd].some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error("INVALID_MONEY");
  if (receiptsVnd === 0) return "UNPAID";
  if (refundsVnd >= receiptsVnd) return "REFUNDED";
  if (refundsVnd > 0) return "PARTIALLY_REFUNDED";
  return receiptsVnd >= amountDueVnd ? "PAID" : "PARTIALLY_PAID";
}
export type ReservationBatch = { id: string; available: number; expiresAt: string; receivedAt: string; status: "AVAILABLE" | "QUARANTINED" | "DEPLETED" | "EXPIRED" };
export function selectReservationBatches(batches: ReservationBatch[], requested: number, now: Date) {
  if (!Number.isSafeInteger(requested) || requested <= 0) throw new Error("INVALID_QUANTITY");
  if (batches.some(batch => !Number.isSafeInteger(batch.available) || batch.available < 0)) throw new Error("INVALID_BATCH_QUANTITY");
  const candidates = batches.filter(batch => batch.status === "AVAILABLE" && batch.available > 0 && new Date(batch.expiresAt).getTime() > now.getTime())
    .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt) || Date.parse(a.receivedAt) - Date.parse(b.receivedAt) || a.id.localeCompare(b.id));
  let remaining = requested;
  const allocations: Array<{ batchId: string; quantity: number }> = [];
  for (const batch of candidates) {
    if (!remaining) break;
    const quantity = Math.min(remaining, batch.available);
    allocations.push({ batchId: batch.id, quantity }); remaining -= quantity;
  }
  if (remaining) throw new Error("OUT_OF_STOCK");
  return allocations;
}
export function calculateCommission(input: { ownerRole: Role; collectedVnd: number; cogsVnd: number; directCostsVnd: number; eligible: boolean; memberRateBps?: number }) {
  if ([input.collectedVnd, input.cogsVnd, input.directCostsVnd].some(value => !Number.isSafeInteger(value))) throw new Error("INVALID_MONEY");
  const rate = input.memberRateBps ?? 4000;
  if (!Number.isInteger(rate) || rate < 0 || rate > 10000) throw new Error("INVALID_RATE");
  const baseProfitVnd = input.collectedVnd - input.cogsVnd - input.directCostsVnd;
  const memberAmountVnd = input.eligible && input.ownerRole === "MEMBER" && baseProfitVnd > 0 ? Number((BigInt(baseProfitVnd) * BigInt(rate) + 5000n) / 10000n) : 0;
  return { baseProfitVnd, memberAmountVnd, ownerAmountVnd: baseProfitVnd - memberAmountVnd };
}
