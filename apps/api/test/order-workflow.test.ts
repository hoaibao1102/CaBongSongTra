import { describe, expect, it } from "vitest";
import { confirmOrder, shipOrder, type OrderAggregate, type UnitOfWork } from "../src/orders/order-workflow";

class MemoryUnitOfWork implements UnitOfWork {
  order: OrderAggregate = { id: "order-1", status: "PENDING", version: 1, items: [{ sku: "CBST-300", quantity: 1 }], allocations: [] };
  batches = [{ id: "batch-1", sku: "CBST-300", available: 1, reserved: 0, onHand: 1, expiresAt: "2027-01-01", receivedAt: "2026-01-01", status: "AVAILABLE" as const }];
  movements: Array<{ type: string; batchId: string; quantity: number }> = [];
  async transaction<T>(work: () => Promise<T>) { return work(); }
  async getOrder() { return structuredClone(this.order); }
  async saveOrder(order: OrderAggregate) { this.order = structuredClone(order); }
  async listBatches() { return structuredClone(this.batches); }
  async saveBatch(batch: typeof this.batches[number]) { this.batches[this.batches.findIndex((item) => item.id === batch.id)] = structuredClone(batch); }
  async appendMovement(movement: { type: string; batchId: string; quantity: number }) { this.movements.push(movement); }
}

describe("order inventory workflow", () => {
  it("reserves FEFO stock exactly once when confirming", async () => {
    const uow = new MemoryUnitOfWork();
    await confirmOrder(uow, "order-1", 1, "confirm-key", new Date("2026-10-10"));
    expect(uow.order).toMatchObject({ status: "CONFIRMED", version: 2, allocations: [{ batchId: "batch-1", sku: "CBST-300", quantity: 1 }] });
    expect(uow.batches[0]).toMatchObject({ available: 0, reserved: 1, onHand: 1 });
    await expect(confirmOrder(uow, "order-1", 1, "confirm-key", new Date("2026-10-10"))).rejects.toThrow("VERSION_CONFLICT");
  });

  it("stock-outs reserved allocations at shipping and records movement", async () => {
    const uow = new MemoryUnitOfWork();
    await confirmOrder(uow, "order-1", 1, "confirm-key", new Date("2026-10-10"));
    uow.order.status = "PACKING";
    await shipOrder(uow, "order-1", 2, "ship-key");
    expect(uow.batches[0]).toMatchObject({ available: 0, reserved: 0, onHand: 0 });
    expect(uow.movements).toEqual([
      {
        type: "STOCK_OUT",
        batchId: "batch-1",
        quantity: 1,
        idempotencyKey: "ship-key",
        orderId: "order-1",
      },
    ]);
    expect(uow.order.status).toBe("SHIPPING");
  });
});
