import { isOrderTransitionAllowed, type OrderStatus, type Role } from "../domain";

type Actor = { id: string; role: Role };
type ScopedOrder = { responsibleMemberId: string; version: number };

export function assertActorCanAccessOrder(actor: Actor, order: ScopedOrder) {
  if (actor.role !== "OWNER_ADMIN" && actor.id !== order.responsibleMemberId) {
    throw new Error("RESOURCE_NOT_FOUND");
  }
}

export function assertExpectedVersion(order: ScopedOrder, expectedVersion: number) {
  if (order.version !== expectedVersion) throw new Error("VERSION_CONFLICT");
}

export function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!isOrderTransitionAllowed(from, to)) throw new Error("INVALID_STATE_TRANSITION");
}
