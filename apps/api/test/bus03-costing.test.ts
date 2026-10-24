import { describe, expect, it, vi } from "vitest";
import type { Batch, Ledger, Order } from "../src/v2/models";
import { CommerceService, allocateReceiptShipping } from "../src/v2/service";

type Item = { sku: string; qty: number; purchasePriceVnd: number; expiresAt?: string; supplierLotCode?: string };
async function receive(items: Item[], shippingFeeVnd: number) {
  const batches: Batch[] = [];
  const movements: Array<{ batchId: string; qtyDelta: number; type: string }> = [];
  const db = {
    idempotent: async (_scope: string, _key: string, _dto: unknown, work: (session: unknown) => unknown) => work("mock-session"),
    batches: { create: vi.fn(async (docs) => batches.push(...docs)) },
    movements: { create: vi.fn(async (docs) => movements.push(...docs)) },
    purchaseReceipts: { create: vi.fn() }, audit: { create: vi.fn() },
  };
  const receipt = await new CommerceService(db as never).createPurchaseReceipt(
    { id: "owner", role: "OWNER_ADMIN" },
    { receivedAt: "2020-01-01T00:00:00.000Z", items, shippingFeeVnd }, "mock-key", "request",
  );
  return { receipt, batches, movements };
}

describe("BUS-03 exact purchase receipt inventory cost", () => {
  it("blocks zero-value freight until allocation policy is approved, before any writes", async () => {
    const items = [{ sku: "CBST-300", qty: 2, purchasePriceVnd: 0 }, { sku: "CBST-400", qty: 3, purchasePriceVnd: 0 }];
    const create = vi.fn();
    const db = { idempotent: async (_s: string, _k: string, _d: unknown, work: (s: unknown) => unknown) => work({}), batches: { create }, movements: { create }, purchaseReceipts: { create }, audit: { create } };
    expect(() => allocateReceiptShipping(items, 7)).toThrow("ZERO_VALUE_FREIGHT_ALLOCATION_POLICY_REQUIRED");
    await expect(new CommerceService(db as never).createPurchaseReceipt({ id: "owner", role: "OWNER_ADMIN" }, { receivedAt: "2020-01-01T00:00:00.000Z", items, shippingFeeVnd: 7 }, "k", "r")).rejects.toThrow("ZERO_VALUE_FREIGHT_ALLOCATION_POLICY_REQUIRED");
    expect(create).not.toHaveBeenCalled();
    expect(allocateReceiptShipping(items, 0).every(i => i.landedUnitCostVnd === 0)).toBe(true);
  });
  it("retains exact bucket costs through partial allocation, outbound and inspected return", async () => {
    const actor = { id: "owner", role: "OWNER_ADMIN" as const };
    const { batches, receipt } = await receive([{ sku: "CBST-300", qty: 3, purchasePriceVnd: 10, supplierLotCode: "SUP", expiresAt: "2099-01-01T00:00:00.000Z" }], 2);
    const order: Order = { id: "order", orderCode: "TEST", customer: { name: "Test", phone: "+84901234567", address: "Test address", area: "Test" }, consentAt: new Date(0), source: "DIRECT", createdAt: new Date(0), status: "PENDING", version: 1, items: [{ sku: "CBST-300", qty: 2, unitPriceVnd: 100 }], allocations: [], totalVnd: 200, receiptsVnd: 0, refundsVnd: 0, cogsVnd: 0, directCostsVnd: 0, commissionVnd: 0, commissionRateBps: 0, costsFinalized: false, responsibleMemberId: null } as Order;
    const entries: Ledger[] = [];
    const db = {
      idempotent: async (_s: string, _k: string, _d: unknown, work: (s: unknown) => unknown) => work("mock-session"),
      scopedOrder: async () => order,
      saveOrder: async () => { order.version++; },
      batches: {
        find: () => ({ sort: () => ({ session: () => ({ lean: async () => batches.filter(b => b.onHand > b.reserved) }) }) }),
        findOne: ({ id }: { id: string }) => ({ session: () => ({ lean: async () => batches.find(b => b.id === id) }) }),
        updateOne: async ({ id }: { id: string }, { $inc }: { $inc: { onHand: number; reserved: number } }) => { const b = batches.find(b => b.id === id)!; b.onHand += $inc.onHand; b.reserved += $inc.reserved; return { modifiedCount: 1 }; },
      },
      movements: { create: vi.fn() }, audit: { create: vi.fn() }, ledger: { create: async (docs: Ledger[]) => entries.push(...docs) },
    };
    const service = new CommerceService(db as never);
    await service.transition(actor, order.id, { status: "CONFIRMED", expectedVersion: 1, reason: "test" }, "confirm", "request");
    expect(order.allocations.map((a) => [a.qty, a.landedUnitCostVnd])).toEqual([[1, 10], [1, 11]]);
    expect(order.cogsVnd).toBe(21);
    await service.transition(actor, order.id, { status: "PACKING", expectedVersion: 2, reason: "test" }, "pack", "request");
    await service.transition(actor, order.id, { status: "SHIPPING", expectedVersion: 3, reason: "test" }, "ship", "request");
    expect(batches.reduce((s, b) => s + b.onHand * b.landedUnitCostVnd, 0) + order.cogsVnd).toBe(receipt.totalCostVnd);
    order.status = "RETURN_REQUESTED";
    await service.receiveReturn(actor, order.id, { expectedVersion: 4, reason: "inspection", inspectionReference: "INSPECT", lines: [{ batchId: order.allocations[1].batchId, qty: 1, disposition: "RESTOCK" }] }, "return", "request");
    expect(order.cogsVnd).toBe(10);
    expect(entries.find(e => e.kind === "COGS_REVERSAL")!.amountVnd).toBe(11);
    expect(batches.reduce((s, b) => s + b.onHand * b.landedUnitCostVnd, 0) + order.cogsVnd).toBe(receipt.totalCostVnd);
  });
  it("keeps divisible and zero freight as single batches", async () => {
    for (const shipping of [0, 6]) {
      const { receipt, batches } = await receive([{ sku: "CBST-300", qty: 3, purchasePriceVnd: 10 }], shipping);
      expect(batches).toHaveLength(1);
      expect(batches[0].onHand * batches[0].landedUnitCostVnd).toBe(receipt.totalCostVnd);
    }
  });
  it("conserves line money and traceability for mixed SKUs, duplicate SKUs and free lines", async () => {
    const source = [
      { sku: "CBST-300", qty: 15, purchasePriceVnd: 65000, supplierLotCode: "SUP-1", expiresAt: "2099-01-01T00:00:00.000Z" },
      { sku: "CBST-400", qty: 8, purchasePriceVnd: 95000 },
      { sku: "CBST-300", qty: 5, purchasePriceVnd: 0 },
    ];
    const { receipt, batches, movements } = await receive(source, 100000);
    expect(batches.reduce((s, b) => s + b.onHand * b.landedUnitCostVnd, 0)).toBe(receipt.totalCostVnd);
    expect(receipt.items.reduce((s, i) => s + i.allocatedShippingVnd, 0)).toBe(100000);
    expect(new Set(batches.map(b => b.lotCode)).size).toBe(batches.length);
    for (const item of receipt.items) {
      const batch = batches.find(b => b.id === item.batchId);
      expect(batch).toMatchObject({ sku: item.sku, onHand: item.qty, landedUnitCostVnd: item.landedUnitCostVnd, allocatedShippingVnd: item.allocatedShippingVnd, receiptId: receipt.id });
      expect(item.qty * item.landedUnitCostVnd).toBe(item.lineTotalVnd + item.allocatedShippingVnd);
      expect(movements.find(m => m.batchId === item.batchId)).toMatchObject({ qtyDelta: item.qty, type: "RECEIPT" });
      expect(batch!.status).toBe("AVAILABLE");
    }
    expect(batches.filter(b => b.labelReference === "SUP-1").every(b => b.expiresAt!.getUTCFullYear() === 2099)).toBe(true);
  });
  it("conserves every VND in integer-cost batches when shipping is indivisible", async () => {
    const { receipt, batches, movements } = await receive([{ sku: "CBST-300", qty: 3, purchasePriceVnd: 10 }], 2);
    expect(batches.reduce((sum, b) => sum + b.onHand * b.landedUnitCostVnd, 0)).toBe(receipt.totalCostVnd);
    expect(batches.map(b => [b.onHand, b.landedUnitCostVnd])).toEqual([[1, 10], [2, 11]]);
    expect(receipt.items.map(i => [i.qty, i.landedUnitCostVnd])).toEqual([[1, 10], [2, 11]]);
    expect(movements.reduce((sum, m) => sum + m.qtyDelta, 0)).toBe(3);
  });
});
