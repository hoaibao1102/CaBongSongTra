export type Role = "OWNER_ADMIN" | "MEMBER";
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
export type PaymentStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKING", "CANCELLED"],
  PACKING: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["DELIVERED", "DELIVERY_FAILED", "RETURN_REQUESTED"],
  DELIVERED: ["RETURN_REQUESTED"],
  CANCELLED: [],
  DELIVERY_FAILED: ["SHIPPING", "RETURNED"],
  RETURN_REQUESTED: ["PARTIALLY_RETURNED", "RETURNED"],
  PARTIALLY_RETURNED: ["RETURN_REQUESTED", "RETURNED"],
  RETURNED: [],
};

export function isOrderTransitionAllowed(from: OrderStatus, to: OrderStatus) {
  return transitions[from].includes(to);
}

export function derivePaymentStatus(
  amountDueVnd: number,
  receiptsVnd: number,
  refundsVnd: number,
): PaymentStatus {
  if ([amountDueVnd, receiptsVnd, refundsVnd].some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error("INVALID_MONEY");
  }
  const netVnd = receiptsVnd - refundsVnd;
  if (receiptsVnd === 0) return "UNPAID";
  if (refundsVnd >= receiptsVnd) return "REFUNDED";
  if (refundsVnd > 0) return "PARTIALLY_REFUNDED";
  return netVnd >= amountDueVnd ? "PAID" : "PARTIALLY_PAID";
}

export type ReservationBatch = {
  id: string;
  available: number;
  expiresAt: string;
  receivedAt: string;
  status: "AVAILABLE" | "QUARANTINED" | "DEPLETED" | "EXPIRED";
};

export function selectReservationBatches(
  batches: ReservationBatch[],
  requested: number,
  now: Date,
) {
  if (!Number.isInteger(requested) || requested <= 0) throw new Error("INVALID_QUANTITY");
  if (batches.some((batch) => !Number.isInteger(batch.available) || batch.available < 0)) {
    throw new Error("INVALID_BATCH_QUANTITY");
  }
  const candidates = batches
    .filter((batch) => batch.status === "AVAILABLE" && batch.available > 0)
    .filter((batch) => new Date(batch.expiresAt).getTime() > now.getTime())
    .sort(
      (left, right) =>
        new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime() ||
        new Date(left.receivedAt).getTime() - new Date(right.receivedAt).getTime(),
    );
  let remaining = requested;
  const allocations: Array<{ batchId: string; quantity: number }> = [];
  for (const batch of candidates) {
    if (remaining === 0) break;
    const quantity = Math.min(remaining, batch.available);
    allocations.push({ batchId: batch.id, quantity });
    remaining -= quantity;
  }
  if (remaining > 0) throw new Error("OUT_OF_STOCK");
  return allocations;
}

export function calculateCommission(input: {
  ownerRole: Role;
  collectedVnd: number;
  cogsVnd: number;
  directCostsVnd: number;
  eligible: boolean;
  memberRateBps?: number;
}) {
  if (
    !Number.isInteger(input.collectedVnd) ||
    !Number.isInteger(input.cogsVnd) ||
    !Number.isInteger(input.directCostsVnd)
  ) {
    throw new Error("INVALID_MONEY");
  }
  const memberRateBps = input.memberRateBps ?? 4_000;
  if (!Number.isInteger(memberRateBps) || memberRateBps < 0 || memberRateBps > 10_000) {
    throw new Error("INVALID_RATE");
  }
  const baseProfitVnd = input.collectedVnd - input.cogsVnd - input.directCostsVnd;
  if (!input.eligible || input.ownerRole === "OWNER_ADMIN") {
    return { baseProfitVnd, memberAmountVnd: 0, ownerAmountVnd: baseProfitVnd };
  }
  const memberAmountVnd =
    baseProfitVnd > 0 ? Math.round((baseProfitVnd * memberRateBps) / 10_000) : 0;
  return {
    baseProfitVnd,
    memberAmountVnd,
    ownerAmountVnd: baseProfitVnd - memberAmountVnd,
  };
}
