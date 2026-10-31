import "reflect-metadata";
import { afterEach, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { clientIdentity } from "../src/v2/http";
import { orderProjection } from "../src/v2/policy";
import { CommerceService } from "../src/v2/service";
afterEach(() => vi.unstubAllEnvs());
it("authenticates bounded BFF identities and rejects tampering, stale and partial headers", () => {
  vi.stubEnv("BFF_SHARED_SECRET", "s".repeat(32));
  const timestamp = String(Math.floor(Date.now() / 1000)); const client = "203.0.113.42";
  const headers: Record<string, string> = { "X-CBST-Client": client, "X-CBST-Timestamp": timestamp, "X-CBST-Signature": createHmac("sha256", "s".repeat(32)).update(`${timestamp}:${client}`).digest("hex") };
  const req = { get: (name: string) => headers[name], ip: "proxy" };
  expect(clientIdentity(req as never)).toBe(`bff:${client}`);
  headers["X-CBST-Client"] = "spoof";
  expect(() => clientIdentity(req as never)).toThrow("BFF_IDENTITY_INVALID");
  headers["X-CBST-Client"] = client; headers["X-CBST-Timestamp"] = "1";
  expect(() => clientIdentity(req as never)).toThrow("BFF_IDENTITY_INVALID");
  delete headers["X-CBST-Signature"];
  expect(() => clientIdentity(req as never)).toThrow("BFF_IDENTITY_INVALID");
  expect(clientIdentity({ get: () => undefined, ip: "direct" } as never)).toBe("ip:direct");
});
it("projects server payment due for members and owners without internal return details", () => {
  const order = { id: "o", status: "PARTIALLY_RETURNED", version: 1, items: [], totalVnd: 218000, receiptsVnd: 50000, refundsVnd: 10000, returnValueVnd: 109000, returnRefundsVnd: 0 };
  for (const role of ["MEMBER", "OWNER_ADMIN"] as const) expect(orderProjection(order, { id: "u", role })).toMatchObject({ paymentDueVnd: 59000 });
});
it("reclassifies prior goodwill transactionally when a full return would double-reduce revenue", async () => {
  const order = { id: "o", status: "RETURN_REQUESTED", version: 0, shippedAt: new Date(), deliveredAt: new Date(), items: [{ sku: "CBST-300", qty: 1, unitPriceVnd: 109000 }], allocations: [{ batchId: "b", sku: "CBST-300", qty: 1, landedUnitCostVnd: 65000 }], totalVnd: 109000, receiptsVnd: 109000, refundsVnd: 10000, cogsVnd: 65000, directCostsVnd: 0, commissionVnd: 0, commissionRateBps: 4000, costsFinalized: true };
  const db = { scopedOrder: async () => order, idempotent: async (_s: string, _k: string, _p: unknown, work: (s: unknown) => unknown) => work("s"), movements: { create: vi.fn() }, ledger: { create: vi.fn() }, audit: { create: vi.fn() }, saveOrder: vi.fn() };
  await new CommerceService(db as never).receiveReturn({ id: "owner", role: "OWNER_ADMIN" }, "o", { expectedVersion: 0, lines: [{ batchId: "b", qty: 1, disposition: "DISCARD" }], reason: "damaged", inspectionReference: "photo" }, "key", "request");
  expect(order).toMatchObject({ returnValueVnd: 109000, returnRefundsVnd: 10000, refundsVnd: 10000 });
  expect(db.ledger.create).toHaveBeenCalledWith([expect.objectContaining({ kind: "REFUND_RECLASSIFICATION", amountVnd: 10000 })], { session: "s" });
});
it("subtracts failed-delivery inventory losses and direct costs from owner net profit", async () => {
  const aggregate = vi.fn().mockResolvedValueOnce([{ revenueVnd: 100000, cogsVnd: 50000 }]).mockResolvedValueOnce([{ inventoryLossVnd: 65000, directCostsVnd: 15000 }]);
  const db = { orders: { aggregate, countDocuments: vi.fn(async () => 0) }, ledger: { aggregate: vi.fn(async () => []) } };
  const result = await new CommerceService(db as never).dashboard({ id: "owner", role: "OWNER_ADMIN" });
  expect(result).toMatchObject({ failedDeliveryLossVnd: 80000, netProfitVnd: -30000 });
});
it("excludes delivered orders from a member's processing dashboard count", async () => {
  const countDocuments = vi.fn(async () => 2);
  const db = {
    orders: { aggregate: vi.fn(async () => []), countDocuments },
    ledger: { aggregate: vi.fn(async () => []) },
  };
  const result = await new CommerceService(db as never).dashboard({ id: "member", role: "MEMBER" });
  expect(countDocuments).toHaveBeenCalledWith({
    responsibleMemberId: "member",
    status: { $nin: ["DELIVERED", "CANCELLED", "RETURNED"] },
  });
  expect(result.pendingCostOrders).toBe(2);
});
it("includes deliveredUnits and totalUnits in dashboard aggregation result", async () => {
  const aggregate = vi.fn().mockResolvedValueOnce([{ deliveredOrders: 5, deliveredUnits: 25, revenueVnd: 500000 }]).mockResolvedValueOnce([]);
  const db = { orders: { aggregate, countDocuments: vi.fn(async () => 0) }, ledger: { aggregate: vi.fn(async () => []) } };
  const result = await new CommerceService(db as never).dashboard({ id: "owner", role: "OWNER_ADMIN" });
  expect(result.deliveredUnits).toBe(25);
  expect(result.totalUnits).toBe(25);
});
