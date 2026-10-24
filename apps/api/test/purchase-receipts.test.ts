import { describe, it, expect, vi } from "vitest";
import { allocateReceiptShipping, CommerceService } from "../src/v2/service";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { PurchaseReceiptItemDto } from "../src/v2/dto";

describe("Inventory Purchase Receipts - Shipping Fee Allocation", () => {
  it("allocates shipping fee proportionally by line total with deterministic integer remainder", () => {
    const items = [
      { sku: "CBST-300", qty: 15, purchasePriceVnd: 65000 },
      { sku: "CBST-400", qty: 8, purchasePriceVnd: 95000 },
      { sku: "CBST-600", qty: 5, purchasePriceVnd: 140000 },
    ];
    const shippingFeeVnd = 100000;

    const allocated = allocateReceiptShipping(items, shippingFeeVnd);

    // Sum of allocated shipping fees must match total shipping fee exactly
    const sumAllocated = allocated.reduce((sum, item) => sum + item.allocatedShippingVnd, 0);
    expect(sumAllocated).toBe(shippingFeeVnd);

    // Check individual allocated amounts (300g has largest share, receives 1 VND remainder)
    expect(allocated[0].lineTotalVnd).toBe(975000);
    expect(allocated[0].allocatedShippingVnd).toBe(40042);
    expect(allocated[0].landedUnitCostVnd).toBe(65000 + Math.floor(40042 / 15));

    expect(allocated[1].lineTotalVnd).toBe(760000);
    expect(allocated[1].allocatedShippingVnd).toBe(31211);
    expect(allocated[1].landedUnitCostVnd).toBe(95000 + Math.floor(31211 / 8));

    expect(allocated[2].lineTotalVnd).toBe(700000);
    expect(allocated[2].allocatedShippingVnd).toBe(28747);
    expect(allocated[2].landedUnitCostVnd).toBe(140000 + Math.floor(28747 / 5));
  });

  it("handles zero shipping fee cleanly", () => {
    const items = [
      { sku: "CBST-300", qty: 10, purchasePriceVnd: 60000 },
      { sku: "CBST-400", qty: 5, purchasePriceVnd: 90000 },
    ];
    const allocated = allocateReceiptShipping(items, 0);

    expect(allocated[0].allocatedShippingVnd).toBe(0);
    expect(allocated[0].landedUnitCostVnd).toBe(60000);
    expect(allocated[1].allocatedShippingVnd).toBe(0);
    expect(allocated[1].landedUnitCostVnd).toBe(90000);
  });

  it("handles single-item receipt allocating 100% of shipping", () => {
    const items = [{ sku: "CBST-400", qty: 20, purchasePriceVnd: 95000 }];
    const allocated = allocateReceiptShipping(items, 50000);

    expect(allocated[0].allocatedShippingVnd).toBe(50000);
    expect(allocated[0].landedUnitCostVnd).toBe(95000 + 2500);
  });
});

describe("Inventory Purchase Receipts - Label Safety", () => {
  it("rejects a whitespace-only supplier label", async () => {
    const errors = await validate(plainToInstance(PurchaseReceiptItemDto, { sku: "CBST-300", qty: 1, purchasePriceVnd: 65000, supplierLotCode: "   " }));
    expect(errors.length).toBeGreaterThan(0);
  });
  it("defaults imported batches to AVAILABLE status and receipt code labelReference", async () => {
    const created: Array<Record<string, unknown>> = [];
    const db = {
      idempotent: async (_scope: string, _key: string, _dto: unknown, work: (session: unknown) => unknown) => work("session"),
      batches: { create: vi.fn(async ([batch]) => { created.push(batch); }) },
      movements: { create: vi.fn() }, purchaseReceipts: { create: vi.fn() }, audit: { create: vi.fn() },
    };
    await new CommerceService(db as never).createPurchaseReceipt(
      { id: "owner", role: "OWNER_ADMIN" },
      { receivedAt: "2026-10-01T00:00:00.000Z", shippingFeeVnd: 0, items: [{ sku: "CBST-300", qty: 1, purchasePriceVnd: 65000, expiresAt: "2027-10-01T00:00:00.000Z" }] } as never,
      "receipt-key-123456", "request",
    );
    expect(created[0]).toMatchObject({ status: "AVAILABLE" });
    expect(created[0].labelReference).toMatch(/^PN-20261001-/);
  });
});
