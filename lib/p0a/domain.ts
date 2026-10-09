import { P0aError } from "./errors";
import type { Actor, BatchProjection, CommissionStatus, CostPayer, CsvCell, OrderProjection, OrderStatus, PaymentInput, PaymentStatus, Role } from "./types";

export const orderTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
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

export function assertActiveActor(actor: Actor | null | undefined): asserts actor is Actor {
  if (!actor) throw new P0aError("UNAUTHENTICATED", "Sign in is required.");
  if (actor.active === false) throw new P0aError("FORBIDDEN", "This profile is disabled.");
}

export function isAdmin(actor: Pick<Actor, "role">) {
  return actor.role === "OWNER_ADMIN";
}

export function assertAdmin(actor: Actor | null | undefined): asserts actor is Actor & { role: "OWNER_ADMIN" } {
  assertActiveActor(actor);
  if (!isAdmin(actor)) throw new P0aError("FORBIDDEN", "Owner/Admin role is required.");
}

export function assertOrderAccess(actor: Actor | null | undefined, order: Pick<OrderProjection, "organizationId" | "ownerMemberId">) {
  assertActiveActor(actor);
  if (actor.organizationId !== order.organizationId) throw new P0aError("RESOURCE_NOT_FOUND", "Order was not found.");
  if (!isAdmin(actor) && actor.id !== order.ownerMemberId) throw new P0aError("RESOURCE_NOT_FOUND", "Order was not found.");
}

export function assertValidOrderTransition(from: OrderStatus, to: OrderStatus) {
  if (!orderTransitions[from].includes(to)) throw new P0aError("INVALID_STATE_TRANSITION", "Cannot move order from " + from + " to " + to + ".");
}

export function assertExpectedVersion(order: Pick<OrderProjection, "version">, expectedVersion: number) {
  if (order.version !== expectedVersion) throw new P0aError("VERSION_CONFLICT", "Order version is no longer current.");
}

export function derivePaymentStatus(amountDue: number, receipts: number, refunds: number): PaymentStatus {
  if (amountDue < 0 || receipts < 0 || refunds < 0) throw new P0aError("VALIDATION_ERROR", "Money values must be positive.");
  const net = receipts - refunds;
  if (receipts <= 0) return "UNPAID";
  if (refunds >= receipts) return "REFUNDED";
  if (refunds > 0) return "PARTIALLY_REFUNDED";
  if (net >= amountDue) return "PAID";
  return "PARTIALLY_PAID";
}

export function assertPaymentAllowed(actor: Actor | null | undefined, order: OrderProjection, payment: PaymentInput, netReceipts: number) {
  assertOrderAccess(actor, order);
  if (!Number.isInteger(payment.amount) || payment.amount <= 0) throw new P0aError("VALIDATION_ERROR", "Payment amount must be a positive VND integer.", { amount: ["Must be a positive integer"] });
  if (payment.kind === "REFUND") {
    assertAdmin(actor);
    if (payment.amount > netReceipts) throw new P0aError("PAYMENT_EXCEEDS_BALANCE", "Refund cannot exceed net receipts.");
  }
}

export function calculateCommission(input: { orderOwnerRole: Role; delivered: boolean; paymentStatus: PaymentStatus; directCostsReconciled: boolean; hasOpenReturn: boolean; collected: number; cogs: number; directCosts: number; refunds: number; memberRateBps?: number }): { status: CommissionStatus; baseProfit: number; memberAmount: number; ownerAmount: number; eligible: boolean } {
  const baseProfit = input.collected - input.cogs - input.directCosts - input.refunds;
  const eligible = input.delivered && input.paymentStatus === "PAID" && input.directCostsReconciled && !input.hasOpenReturn;
  if (input.orderOwnerRole === "OWNER_ADMIN") return { status: eligible ? "ELIGIBLE" : "ESTIMATED", baseProfit, memberAmount: 0, ownerAmount: Math.max(baseProfit, 0), eligible };
  if (baseProfit <= 0) return { status: eligible ? "ELIGIBLE" : "ESTIMATED", baseProfit, memberAmount: 0, ownerAmount: 0, eligible };
  const memberAmount = Math.round((baseProfit * (input.memberRateBps ?? 4000)) / 10_000);
  return { status: eligible ? "ELIGIBLE" : "ESTIMATED", baseProfit, memberAmount, ownerAmount: baseProfit - memberAmount, eligible };
}

export function selectReservationBatches(batches: BatchProjection[], requested: number, now: Date): Array<{ batchId: string; quantity: number }> {
  if (!Number.isInteger(requested) || requested <= 0) throw new P0aError("VALIDATION_ERROR", "Requested quantity must be a positive integer.");
  const nowMs = now.getTime();
  const candidates = batches
    .filter((batch) => batch.status === "AVAILABLE" && batch.available > 0)
    .filter((batch) => Boolean(batch.labelEvidencePath))
    .filter((batch) => batch.expiresAt !== null && new Date(batch.expiresAt).getTime() > nowMs)
    .sort((a, b) => {
      const expiryA = new Date(a.expiresAt as string).getTime();
      const expiryB = new Date(b.expiresAt as string).getTime();
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
  if (remaining > 0) throw new P0aError("OUT_OF_STOCK", "Not enough sellable stock is available.");
  return allocations;
}

export function shouldReleaseReservation(input: { orderStatus: OrderStatus; paymentStatus: PaymentStatus; reservationExpiresAt: Date; now: Date }) {
  return input.orderStatus === "CONFIRMED" && input.paymentStatus === "UNPAID" && input.reservationExpiresAt.getTime() <= input.now.getTime();
}

export function directCostAffectsCommission(payer: CostPayer) {
  return payer === "SHOP" || payer === "ADVANCED_BY_MEMBER";
}

export function maskPhone(phone: string | null | undefined, canViewFull: boolean) {
  if (!phone) return "";
  if (canViewFull) return phone;
  const visible = phone.slice(-3);
  return "*".repeat(Math.max(phone.length - 3, 0)) + visible;
}

export function sanitizeCsvCell(cell: CsvCell) {
  const value = cell == null ? "" : String(cell);
  const protectedValue = /^[=+\-@\t\r]/.test(value) ? "'" + value : value;
  if (/[",\n\r]/.test(protectedValue)) return '"' + protectedValue.replaceAll('"', '""') + '"';
  return protectedValue;
}

export function toCsv(rows: CsvCell[][]) {
  return rows.map((row) => row.map(sanitizeCsvCell).join(",")).join("\n");
}
