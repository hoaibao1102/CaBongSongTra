import { describe, expect, it } from "vitest";
import { OrderSchema } from "../src/orders/order.schema";
import { InventoryBatchSchema } from "../src/inventory/inventory-batch.schema";
import { SessionSchema } from "../src/auth/session.schema";

describe("MongoDB integrity schema", () => {
  it("uses optimistic concurrency and a unique public order code", () => {
    expect(OrderSchema.get("optimisticConcurrency")).toBe(true);
    expect(OrderSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { orderCode: 1 },
          expect.objectContaining({ unique: true }),
        ],
      ]),
    );
  });

  it("indexes FEFO allocation and prevents negative batch counters", () => {
    expect(InventoryBatchSchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ sku: 1, expiresAt: 1, receivedAt: 1 }, expect.any(Object)],
      ]),
    );
    const path = InventoryBatchSchema.path("onHandQty");
    expect(path.options.min).toBe(0);
  });

  it("expires opaque sessions by absolute expiry", () => {
    expect(SessionSchema.indexes()).toEqual(
      expect.arrayContaining([
        [
          { absoluteExpiresAt: 1 },
          expect.objectContaining({ expireAfterSeconds: 0 }),
        ],
      ]),
    );
  });
});
