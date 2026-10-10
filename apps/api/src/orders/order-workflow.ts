import { selectReservationBatches, type OrderStatus } from "../domain";

export type OrderAggregate = {
  id: string;
  status: OrderStatus;
  version: number;
  items: Array<{ sku: string; quantity: number }>;
  allocations: Array<{ batchId: string; sku: string; quantity: number }>;
};

export type WorkflowBatch = {
  id: string;
  sku: string;
  available: number;
  reserved: number;
  onHand: number;
  expiresAt: string;
  receivedAt: string;
  status: "AVAILABLE" | "QUARANTINED" | "DEPLETED" | "EXPIRED";
};

export interface UnitOfWork {
  transaction<T>(work: () => Promise<T>): Promise<T>;
  getOrder(orderId: string): Promise<OrderAggregate>;
  saveOrder(order: OrderAggregate): Promise<void>;
  listBatches(sku: string): Promise<WorkflowBatch[]>;
  saveBatch(batch: WorkflowBatch): Promise<void>;
  appendMovement(movement: {
    type: "STOCK_OUT";
    batchId: string;
    quantity: number;
    idempotencyKey: string;
    orderId: string;
  }): Promise<void>;
}

export async function confirmOrder(
  uow: UnitOfWork,
  orderId: string,
  expectedVersion: number,
  _idempotencyKey: string,
  now: Date,
) {
  return uow.transaction(async () => {
    const order = await uow.getOrder(orderId);
    if (order.version !== expectedVersion) throw new Error("VERSION_CONFLICT");
    if (order.status !== "PENDING") throw new Error("INVALID_STATE_TRANSITION");
    const allocations: OrderAggregate["allocations"] = [];
    for (const item of order.items) {
      const batches = await uow.listBatches(item.sku);
      const selected = selectReservationBatches(batches, item.quantity, now);
      for (const allocation of selected) {
        const batch = batches.find((candidate) => candidate.id === allocation.batchId);
        if (!batch) throw new Error("BATCH_NOT_FOUND");
        batch.available -= allocation.quantity;
        batch.reserved += allocation.quantity;
        await uow.saveBatch(batch);
        allocations.push({ ...allocation, sku: item.sku });
      }
    }
    order.allocations = allocations;
    order.status = "CONFIRMED";
    order.version += 1;
    await uow.saveOrder(order);
    return order;
  });
}

export async function shipOrder(
  uow: UnitOfWork,
  orderId: string,
  expectedVersion: number,
  idempotencyKey: string,
) {
  return uow.transaction(async () => {
    const order = await uow.getOrder(orderId);
    if (order.version !== expectedVersion) throw new Error("VERSION_CONFLICT");
    if (order.status !== "PACKING") throw new Error("INVALID_STATE_TRANSITION");
    for (const allocation of order.allocations) {
      const batches = await uow.listBatches(allocation.sku);
      const batch = batches.find((candidate) => candidate.id === allocation.batchId);
      if (!batch || batch.reserved < allocation.quantity || batch.onHand < allocation.quantity) {
        throw new Error("INVENTORY_INVARIANT_BROKEN");
      }
      batch.reserved -= allocation.quantity;
      batch.onHand -= allocation.quantity;
      if (batch.onHand === 0) batch.status = "DEPLETED";
      await uow.saveBatch(batch);
      await uow.appendMovement({
        type: "STOCK_OUT",
        batchId: batch.id,
        quantity: allocation.quantity,
        idempotencyKey,
        orderId,
      });
    }
    order.status = "SHIPPING";
    order.version += 1;
    await uow.saveOrder(order);
    return order;
  });
}
