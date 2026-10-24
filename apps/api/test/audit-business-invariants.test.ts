import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { CommerceService, allocateReceiptShipping } from "../src/v2/service";
import type { Order } from "../src/v2/models";
import { commissionTarget } from "../src/v2/policy";

// Remediated invariants + explicitly retained BUS-07/09 policy characterizations.
// No Mongo connection, app bootstrap, network or environment credentials.
const owner = { id: "owner", role: "OWNER_ADMIN" as const };
const query = (value: unknown) => ({ session: () => query(value), lean: async () => value, sort: () => query(value) });
const policy = { id: "policy", name: "P", periodType: "CUSTOM", metric: "PRODUCT_QTY", active: true, tiers: [{ minQty: 1, bonusVnd: 50000 }] };
function fixture(status = "RETURNED") {
  const order = { id: "o", status, version: 0, shippedAt: new Date("2026-01-01"), deliveredAt: new Date("2026-01-02"), responsibleMemberId: "member", items: [{ sku: "CBST-300", qty: 1, unitPriceVnd: 100000 }], allocations: [{ batchId: "b", sku: "CBST-300", qty: 1, returnedQty: 1, landedUnitCostVnd: 60000 }], totalVnd: 100000, receiptsVnd: 100000, refundsVnd: 100000, returnValueVnd: 100000, returnRefundsVnd: 100000, cogsVnd: 0, directCostsVnd: 0, costsFinalized: true, commissionVnd: 0, commissionRateBps: 4000 } as Order;
  const db = { scopedOrder: async () => order, idempotent: async (_s: string, _k: string, _p: unknown, work: (s: unknown) => unknown) => work({ inTransaction: () => true }), saveOrder: vi.fn(async () => { order.version++; }), audit: { create: vi.fn() }, ledger: { create: vi.fn() }, balances: { updateOne: vi.fn() }, batches: { findOne: vi.fn(), updateOne: vi.fn() }, movements: { create: vi.fn() } };
  return { order, db, service: new CommerceService(db as never) };
}
describe("Independent audit business defect characterizations", () => {
  it("B10 commission is payable before payment/finalized costs despite V2.2 acceptance", () => {
    const { order } = fixture("DELIVERED");
    Object.assign(order, { totalVnd: 100000, receiptsVnd: 0, refundsVnd: 0, returnValueVnd: 0, returnRefundsVnd: 0, cogsVnd: 60000, directCostsVnd: 10000, costsFinalized: false });
    expect(commissionTarget(order)).toBe(16000);
    Object.assign(order, { receiptsVnd: 100000, returnValueVnd: 50000, cogsVnd: 30000 });
    expect(commissionTarget(order)).toBe(8000); // outstanding return refund does not gate accrual
  });
  it("B01 returned/restocked order cannot be marked delivered without new fulfillment", async () => {
    const { service, db, order } = fixture();
    await expect(service.transition(owner, "o", { expectedVersion: 0, status: "DELIVERED", reason: "resend" }, "key", "request")).rejects.toThrow("PHYSICAL_RETURN_REQUIRES_NEW_ORDER");
    expect(order.status).toBe("RETURNED");
    expect(order.allocations[0].returnedQty).toBe(1);
    expect(db.movements.create).not.toHaveBeenCalled();
  });
  it("B02 correction without a physical return preserves original delivery date", async () => {
    const { service, order } = fixture("DELIVERED");
    order.allocations[0].returnedQty = 0;
    const original = order.deliveredAt!.getTime();
    await service.transition(owner, "o", { expectedVersion: 0, status: "RETURN_REQUESTED", reason: "inspect" }, "k1", "r");
    await service.transition(owner, "o", { expectedVersion: 1, status: "DELIVERED", reason: "correction" }, "k2", "r");
    expect(order.deliveredAt!.getTime()).toBe(original);
  });
  it("B03 allocation helper exposes lower bucket cost; persistence conserves remainder (bus03-costing suite)", () => {
    const [line] = allocateReceiptShipping([{ sku: "CBST-300", qty: 3, purchasePriceVnd: 100 }], 2);
    expect(line.allocatedShippingVnd).toBe(2);
    expect(line.landedUnitCostVnd * line.qty).toBe(300);
    expect(line.lineTotalVnd + line.allocatedShippingVnd).toBe(302);
  });
  it("B04 free goods with freight require an approved allocation policy", () => {
    expect(() => allocateReceiptShipping([{ sku: "CBST-300", qty: 3, purchasePriceVnd: 0 }], 90000)).toThrow("ZERO_VALUE_FREIGHT_ALLOCATION_POLICY_REQUIRED");
  });
  it("B05 CANCELLED cannot reopen after physical shipment/return without reconciliation", async () => {
    const { service, db, order } = fixture("CANCELLED");
    await expect(service.transition({ id: "member", role: "MEMBER" }, "o", { expectedVersion: 0, status: "PENDING", reason: "reopen" }, "k", "r")).rejects.toThrow("PHYSICAL_RETURN_REQUIRES_NEW_ORDER");
    expect(order.status).toBe("CANCELLED");
    expect(order.shippedAt).toBeDefined();
    expect(db.movements.create).not.toHaveBeenCalled();
  });
  it("B06 unsupported REVENUE KPI is rejected, not evaluated as quantity", () => {
    const service = new CommerceService({} as never);
    expect(() => service.evaluateKpi({ ...policy, metric: "REVENUE" } as never, 1)).toThrow("KPI_METRIC_UNSUPPORTED");
    expect(service.evaluateKpi(policy as never, 1).bonusVnd).toBe(50000);
  });
  it("B07 future period cannot settle early", async () => {
    const { service, db } = fixture();
    const period = { id: "p", policyId: "policy", name: "Future", status: "OPEN", startDate: new Date("2098-01-01"), endDate: new Date("2099-01-01") };
    const kpiAwards = { create: vi.fn() };
    Object.assign(db, { kpiPeriods: { findOne: () => query(period), updateOne: vi.fn() }, kpiPolicies: { findOne: () => query(policy) }, users: { find: () => query([{ id: "member" }]) }, orders: { find: () => query([]) }, kpiAwards });
    await expect(service.settleKpiPeriod(owner, "p", {}, "k", "r")).rejects.toThrow("KPI_PERIOD_NOT_CLOSED");
    expect(kpiAwards.create).not.toHaveBeenCalled();
  });
  it("B08 legacy settled period without complete snapshot fails closed", async () => {
    const { service, db } = fixture();
    const period = { id: "p", policyId: "policy", status: "SETTLED", startDate: new Date("2026-01-01"), endDate: new Date("2026-02-01") };
    Object.assign(db, { kpiPeriods: { findOne: () => query(period) }, kpiPolicies: { findOne: () => query(policy) }, users: { find: () => query([{ id: "member" }]) }, orders: { find: () => query([{ items: [{ qty: 1 }], allocations: [] }]) }, kpiAwards: { find: () => query([]) } });
    await expect(service.previewKpiPeriod(owner, "p")).rejects.toThrow("KPI_SETTLEMENT_SNAPSHOT_INCOMPLETE");
  });
  it("B09 return does not claw back already settled KPI bonus", async () => {
    const { service, db, order } = fixture("RETURN_REQUESTED");
    order.returnValueVnd = 0; order.refundsVnd = 0; order.returnRefundsVnd = 0; order.allocations[0].returnedQty = 0; order.cogsVnd = 60000;
    const kpiAwards = { find: vi.fn(), updateOne: vi.fn() };
    Object.assign(db, { kpiAwards });
    await service.receiveReturn(owner, "o", { expectedVersion: 0, reason: "return", inspectionReference: "doc", lines: [{ batchId: "b", qty: 1, disposition: "DISCARD" }] }, "k", "r");
    expect(order.status).toBe("RETURNED");
    expect(kpiAwards.find).not.toHaveBeenCalled();
    expect(db.balances.updateOne).not.toHaveBeenCalled();
  });
});
