import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { CommerceService } from "../src/v2/service";
import type { Order } from "../src/v2/models";

const owner = { id: "owner", role: "OWNER_ADMIN" as const };
function setup(status: Order["status"], returnedQty = 0) {
  const order = { id: "o", status, version: 0, shippedAt: new Date("2026-01-01"), deliveredAt: new Date("2026-01-02"), responsibleMemberId: "member", items: [{ sku: "CBST-300", qty: 2, unitPriceVnd: 100000 }], allocations: [{ batchId: "b", sku: "CBST-300", qty: 2, returnedQty, landedUnitCostVnd: 60000 }], totalVnd: 200000, receiptsVnd: 0, refundsVnd: 0, cogsVnd: 120000, directCostsVnd: 0, costsFinalized: false, commissionVnd: 0, commissionRateBps: 4000 } as Order;
  const db = { scopedOrder: vi.fn(async () => order), idempotent: async (_s: string, _k: string, _p: unknown, work: (s: unknown) => unknown) => work({}), saveOrder: vi.fn(async () => { order.version++; }), audit: { create: vi.fn() }, ledger: { create: vi.fn() }, balances: { updateOne: vi.fn() }, batches: { updateOne: vi.fn() }, movements: { create: vi.fn() } };
  return { order, db, service: new CommerceService(db as never) };
}
describe("BUS-01/02 physical fulfillment and historical delivery invariants", () => {
  it.each(["PENDING", "CONFIRMED", "PACKING", "SHIPPING", "DELIVERED", "DELIVERY_FAILED"] as const)("rejects reactivating a physically returned order to %s", async status => {
    const { order, db, service } = setup("RETURNED", 2);
    await expect(service.transition(owner, "o", { expectedVersion: 0, status, reason: "resend" }, "key", "r")).rejects.toThrow("PHYSICAL_RETURN_REQUIRES_NEW_ORDER");
    expect(order.status).toBe("RETURNED");
    expect(db.saveOrder).not.toHaveBeenCalled();
    expect(db.ledger.create).not.toHaveBeenCalled();
    expect(db.movements.create).not.toHaveBeenCalled();
  });
  it("blocks partial-return reactivation even after an administrative status correction", async () => {
    const { order, service } = setup("PARTIALLY_RETURNED", 1);
    await service.transition(owner, "o", { expectedVersion: 0, status: "RETURN_REQUESTED", reason: "inspect" }, "a", "r");
    await expect(service.transition(owner, "o", { expectedVersion: 1, status: "DELIVERED", reason: "resend" }, "b", "r")).rejects.toThrow("PHYSICAL_RETURN_REQUIRES_NEW_ORDER");
    expect(order.allocations[0].returnedQty).toBe(1);
  });
  it("blocks reopening a shipped cancelled order for a member before any side effects", async () => {
    const { order, db, service } = setup("CANCELLED");
    await expect(service.transition({ id: "member", role: "MEMBER" }, "o", { expectedVersion: 0, status: "PENDING", reason: "reopen" }, "k", "r")).rejects.toThrow("SHIPPED_CANCELLATION_REQUIRES_RECONCILIATION");
    expect(order.status).toBe("CANCELLED");
    expect(db.saveOrder).not.toHaveBeenCalled();
  });
  it.each(["RETURN_REQUESTED", "RETURNED", "PARTIALLY_RETURNED"] as const)("does not launder shipped cancellation through %s", async status => {
    const { order, db, service } = setup("CANCELLED");
    await service.transition(owner, "o", { expectedVersion: 0, status, reason: "inspection" }, "a", "r");
    db.saveOrder.mockClear();
    await expect(service.transition(owner, "o", { expectedVersion: 1, status: "SHIPPING", reason: "resend" }, "b", "r")).rejects.toThrow("SHIPPED_CANCELLATION_REQUIRES_RECONCILIATION");
    expect(order.status).toBe(status);
    expect(db.saveOrder).not.toHaveBeenCalled();
  });
  it("retains cancellation fact after cancelling a shipped order and entering return inspection", async () => {
    const { order, service } = setup("SHIPPING");
    await service.transition(owner, "o", { expectedVersion: 0, status: "CANCELLED", reason: "cancel" }, "a", "r");
    await service.transition(owner, "o", { expectedVersion: 1, status: "RETURN_REQUESTED", reason: "inspect" }, "b", "r");
    await expect(service.transition(owner, "o", { expectedVersion: 2, status: "DELIVERED", reason: "resend" }, "c", "r")).rejects.toThrow("SHIPPED_CANCELLATION_REQUIRES_RECONCILIATION");
    expect(order.status).toBe("RETURN_REQUESTED");
  });
  it.each(["PENDING", "CONFIRMED", "PACKING"] as const)("cannot erase shipment history by correcting shipped orders to %s", async status => {
    const { db, service } = setup("RETURN_REQUESTED");
    await expect(service.transition(owner, "o", { expectedVersion: 0, status, reason: "correction" }, "a", "r")).rejects.toThrow("SHIPPED_ORDER_CANNOT_RETURN_TO_PREFULFILLMENT");
    expect(db.saveOrder).not.toHaveBeenCalled();
  });
  it("preserves the first deliveredAt across correction and subsequent delivery", async () => {
    const { order, service } = setup("DELIVERED");
    const first = order.deliveredAt!.getTime();
    await service.transition(owner, "o", { expectedVersion: 0, status: "RETURN_REQUESTED", reason: "inspect" }, "a", "r");
    await service.transition(owner, "o", { expectedVersion: 1, status: "DELIVERED", reason: "no physical return" }, "b", "r");
    expect(order.deliveredAt!.getTime()).toBe(first);
  });
  it("records the first delivery once and no duplicate outbound on delivery retry", async () => {
    const { order, db, service } = setup("SHIPPING");
    delete order.deliveredAt;
    await service.transition(owner, "o", { expectedVersion: 0, status: "DELIVERED", reason: "deliver" }, "a", "r");
    expect(order.deliveredAt).toBeInstanceOf(Date);
    const first = order.deliveredAt!.getTime();
    await service.transition(owner, "o", { expectedVersion: 1, status: "DELIVERED", reason: "retry" }, "b", "r");
    expect(order.deliveredAt!.getTime()).toBe(first);
    expect(db.movements.create).not.toHaveBeenCalled();
    expect(db.saveOrder).toHaveBeenCalledTimes(1);
  });
  it("still permits shipment retry before any physical return", async () => {
    const { order, db, service } = setup("DELIVERY_FAILED");
    delete order.deliveredAt;
    await service.transition(owner, "o", { expectedVersion: 0, status: "SHIPPING", reason: "retry delivery" }, "a", "r");
    expect(order.status).toBe("SHIPPING");
    expect(db.movements.create).not.toHaveBeenCalled();
  });
});
