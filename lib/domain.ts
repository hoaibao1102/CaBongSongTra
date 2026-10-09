export type OrderStatus =
  | "DRAFT"
  | "CONFIRMED"
  | "PREPARING"
  | "SHIPPING"
  | "DELIVERED"
  | "CANCELLED"
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
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["SHIPPING"],
  SHIPPING: ["DELIVERED", "RETURN_REQUESTED"],
  DELIVERED: ["RETURN_REQUESTED"],
  CANCELLED: [],
  RETURN_REQUESTED: ["PARTIALLY_RETURNED", "RETURNED"],
  PARTIALLY_RETURNED: [],
  RETURNED: [],
};

export function isValidOrderTransition(from: OrderStatus, to: OrderStatus) {
  return transitions[from].includes(to);
}

export function derivePaymentStatus(
  amountDue: number,
  receipts: number,
  refunds: number,
): PaymentStatus {
  const net = receipts - refunds;
  if (receipts <= 0) return "UNPAID";
  if (refunds >= receipts) return "REFUNDED";
  if (refunds > 0) return "PARTIALLY_REFUNDED";
  if (net >= amountDue) return "PAID";
  return "PARTIALLY_PAID";
}

export function calculateCommission(input: {
  collected: number;
  cogs: number;
  directCosts: number;
  refunds: number;
}) {
  const baseProfit = input.collected - input.cogs - input.directCosts - input.refunds;
  if (baseProfit <= 0) return { baseProfit, memberAmount: 0, ownerAmount: 0 };
  const memberAmount = Math.round(baseProfit * 0.4);
  return { baseProfit, memberAmount, ownerAmount: baseProfit - memberAmount };
}

type Batch = {
  id: string;
  available: number;
  expiresAt: string | null;
  receivedAt: string;
  status: "AVAILABLE" | "QUARANTINED" | "DEPLETED" | "EXPIRED";
};

export function selectFulfillmentBatches(batches: Batch[], requested: number, now: Date) {
  if (!Number.isInteger(requested) || requested <= 0) throw new Error("VALIDATION_ERROR");
  const nowMs = now.getTime();
  const candidates = batches
    .filter((batch) => batch.status === "AVAILABLE" && batch.available > 0)
    .filter((batch) => !batch.expiresAt || new Date(batch.expiresAt).getTime() > nowMs)
    .sort((a, b) => {
      const expiryA = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      const expiryB = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.MAX_SAFE_INTEGER;
      return expiryA - expiryB || new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
    });

  let remaining = requested;
  const allocations: Array<{ batchId: string; quantity: number }> = [];
  for (const batch of candidates) {
    if (remaining === 0) break;
    const quantity = Math.min(batch.available, remaining);
    allocations.push({ batchId: batch.id, quantity });
    remaining -= quantity;
  }
  if (remaining > 0) throw new Error("OUT_OF_STOCK");
  return allocations;
}
