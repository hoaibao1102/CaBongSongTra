import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { CommerceService } from "../src/v2/service";
import type { Order, Batch } from "../src/v2/models";

const owner = { id: "owner", role: "OWNER_ADMIN" as const };
function setup(status: Order["status"] = "PENDING") {
  const order: Order = { id: "order", orderCode: "code", responsibleMemberId: "member", status, version: 0, customer: { name: "Test", phone: "+84912345678", address: "Address", area: "Area" }, consentAt: new Date(), source: "DIRECT", items: [{ sku: "CBST-300", qty: 1, unitPriceVnd: 109000 }], allocations: [{ batchId: "batch", sku: "CBST-300", qty: 1, landedUnitCostVnd: 65000 }], totalVnd: 109000, receiptsVnd: 0, refundsVnd: 0, cogsVnd: 65000, directCostsVnd: 0, costsFinalized: false, commissionRateBps: 4000, commissionVnd: 0, createdAt: new Date() };
  const batch: Batch = { id: "batch", sku: "CBST-300", lotCode: "lot", receivedAt: new Date("2026-01-01"), expiresAt: new Date("2099-01-01"), labelReference: "label", onHand: 1, reserved: status === "PENDING" ? 0 : 1, landedUnitCostVnd: 65000, status: "AVAILABLE" };
  const session = { id: "session" };
  const db = {
    scopedOrder: vi.fn(async () => structuredClone(order)),
    idempotent: vi.fn(async (_scope: string, _key: string, _payload: unknown, work: (session: unknown) => Promise<unknown>) => work(session)),
    saveOrder: vi.fn(async (value: Order) => { value.version++; }),
    batches: {
      find: vi.fn(() => ({ sort: vi.fn(() => ({ session: vi.fn(() => ({ lean: vi.fn(async () => [structuredClone(batch)]) })) })) })),
      findOne: vi.fn(() => ({ session: vi.fn(() => ({ lean: vi.fn(async () => structuredClone(batch)) })) })),
      updateOne: vi.fn(async () => ({ modifiedCount: 1 })),
    },
    movements: { create: vi.fn() }, audit: { create: vi.fn() }, ledger: { create: vi.fn() }, balances: { updateOne: vi.fn() },
  };
  return { service: new CommerceService(db as never), db, order, batch, session };
}
describe("transactional commerce workflow", () => {
  it("reserves on confirmation and journals with the transaction session", async () => {
    const { service, db, session } = setup();
    expect(await service.transition(owner, "order", { status: "CONFIRMED", expectedVersion: 0, reason: "Confirmed" }, "key", "request")).toEqual({ id: "order", status: "CONFIRMED", version: 1 });
    expect(db.batches.find).toHaveBeenCalledWith(expect.objectContaining({ status: "AVAILABLE", expiresAt: { $gt: expect.any(Date) } }));
    expect(db.batches.updateOne).toHaveBeenCalledWith(expect.objectContaining({ id: "batch", onHand: 1, reserved: 0 }), { $inc: { onHand: 0, reserved: 1 } }, { session, runValidators: true });
    expect(db.movements.create).toHaveBeenCalledWith([expect.objectContaining({ type: "RESERVE", reservedDelta: 1, qtyDelta: 0, reason: "Confirmed" })], { session });
    expect(db.saveOrder).toHaveBeenCalledWith(expect.objectContaining({ cogsVnd: 65000 }), 0, session);
  });
  it("refuses a lost inventory compare-and-swap without recording success", async () => {
    const { service, db } = setup(); db.batches.updateOne.mockResolvedValue({ modifiedCount: 0 });
    await expect(service.transition(owner, "order", { status: "CONFIRMED", expectedVersion: 0, reason: "Confirm" }, "key", "request")).rejects.toThrow("INVENTORY_CONFLICT");
    expect(db.movements.create).not.toHaveBeenCalled(); expect(db.saveOrder).not.toHaveBeenCalled();
  });
  it("releases held stock on cancellation", async () => {
    const { service, db, session } = setup("CONFIRMED");
    await service.transition(owner, "order", { status: "CANCELLED", expectedVersion: 0, reason: "Cancelled" }, "key", "request");
    expect(db.movements.create).toHaveBeenCalledWith([expect.objectContaining({ type: "RELEASE", qtyDelta: 0, reservedDelta: -1 })], { session });
  });
  it("blocks shipping expired allocated stock", async () => {
    const { service, db, batch } = setup("PACKING"); batch.expiresAt = new Date("2020-01-01");
    await expect(service.transition(owner, "order", { status: "SHIPPING", expectedVersion: 0, reason: "Ship" }, "key", "request")).rejects.toThrow("BATCH_UNSAFE");
    expect(db.batches.updateOne).not.toHaveBeenCalled();
  });
  it("does not stock-out again on delivery retry from delivery failure", async () => {
    const { service, db, order } = setup("DELIVERY_FAILED"); order.shippedAt = new Date();
    await service.transition(owner, "order", { status: "SHIPPING", expectedVersion: 0, reason: "Retry delivery" }, "key", "request");
    expect(db.batches.updateOne).not.toHaveBeenCalled(); expect(db.movements.create).not.toHaveBeenCalled();
  });
  it("does not infer payment or stock movement from delivery", async () => {
    const { service, db } = setup("SHIPPING");
    await service.transition(owner, "order", { status: "DELIVERED", expectedVersion: 0, reason: "Delivered" }, "key", "request");
    expect(db.movements.create).not.toHaveBeenCalled(); expect(db.ledger.create).not.toHaveBeenCalled();
    expect(db.saveOrder).toHaveBeenCalledWith(expect.objectContaining({ receiptsVnd: 0, commissionVnd: 0 }), 0, expect.anything());
  });
  it("accrues commission only after delivery, full settlement and cost finalization", async () => {
    const { service, db, order, session } = setup("DELIVERED"); order.costsFinalized = true;
    await service.payment(owner, "order", { amountVnd: 109000, method: "CASH", expectedVersion: 0 }, "key", "request");
    expect(db.ledger.create).toHaveBeenCalledWith([expect.objectContaining({ kind: "COMMISSION", amountVnd: 17600, memberId: "member" })], { session });
    expect(db.balances.updateOne).toHaveBeenCalledWith({ memberId: "member" }, { $inc: { balanceVnd: 17600 } }, { session, upsert: true });
  });
  it("appends a clawback on refund without changing old payouts", async () => {
    const { service, db, order, session } = setup("DELIVERED");
    order.receiptsVnd = 109000; order.costsFinalized = true; order.commissionVnd = 17600;
    await service.payment(owner, "order", { amountVnd: 10000, method: "CASH", expectedVersion: 0, reason: "Partial refund" }, "key", "request", true);
    expect(db.ledger.create).toHaveBeenCalledWith([expect.objectContaining({ kind: "COMMISSION", amountVnd: -4000 })], { session });
    expect(db.balances.updateOne).toHaveBeenCalledWith({ memberId: "member" }, { $inc: { balanceVnd: -4000 } }, { session, upsert: true });
  });
  it("rejects overpayments and stale order versions", async () => {
    const { service, db } = setup();
    await expect(service.payment(owner, "order", { amountVnd: 109001, method: "CASH", expectedVersion: 0 }, "key", "req")).rejects.toThrow("PAYMENT_EXCEEDS_BALANCE");
    await expect(service.transition(owner, "order", { status: "CONFIRMED", expectedVersion: 1, reason: "Confirm" }, "key", "req")).rejects.toThrow("VERSION_CONFLICT");
    expect(db.ledger.create).not.toHaveBeenCalled(); expect(db.saveOrder).not.toHaveBeenCalled();
  });
});
