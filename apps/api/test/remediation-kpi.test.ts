import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { CommerceService } from "../src/v2/service";
import { CreateKpiPolicyDto } from "../src/v2/dto";
import { validate } from "class-validator";
const owner = { id: "owner", role: "OWNER_ADMIN" as const };
const q = (v: unknown) => ({ session: () => q(v), lean: async () => v, sort: () => q(v) });
const policy = { id: "policy", name: "P", periodType: "CUSTOM", metric: "PRODUCT_QTY", active: true, tiers: [{ minQty: 1, bonusVnd: 50 }], createdAt: new Date(0), updatedAt: new Date(0) };
function setup() {
 const period = { id: "p", policyId: "policy", name: "January", status: "OPEN", startDate: new Date("2020-01-01"), endDate: new Date("2020-02-01"), createdAt: new Date(0) };
 const awards: unknown[] = [];
 const db = { idempotent: async (_s: string, _k: string, _d: unknown, work: (s: unknown) => unknown) => work({}), kpiPolicies: { findOne: vi.fn(() => q(policy)), create: vi.fn() }, kpiPeriods: { findOne: vi.fn(() => q(period)), updateOne: vi.fn(async (_f: unknown, u: { $set: object }) => { Object.assign(period, u.$set); return { matchedCount: 1 }; }) }, users: { find: vi.fn(() => q([{ id: "m", displayName: "Original", emailNormalized: "m@example.test", status: "ACTIVE" }])) }, orders: { find: vi.fn(() => q([])) }, kpiAwards: { create: vi.fn(async (a: unknown[]) => awards.push(...a)), find: vi.fn(() => q(awards)) }, balances: { updateOne: vi.fn() }, ledger: { create: vi.fn() }, audit: { create: vi.fn() } };
 return { db, period, awards, service: new CommerceService(db as never) };
}
describe("KPI remediation (pure/service mocks; no database)", () => {
 it("rejects malformed settled snapshots rather than silently trusting missing windows or duplicate roster", async () => {
  for (const corrupt of ["window", "duplicate"] as const) {
   const { service, period } = setup(); await service.settleKpiPeriod(owner, "p", {}, "k", "r");
   const snapshot = (period as unknown as { settlementSnapshot: { startDate?: Date; members: unknown[] } }).settlementSnapshot;
   if (corrupt === "window") delete snapshot.startDate;
   else snapshot.members.push(snapshot.members[0]);
   await expect(service.previewKpiPeriod(owner, "p")).rejects.toThrow("KPI_SETTLEMENT_SNAPSHOT_INCOMPLETE");
  }
 });
 it("rejects REVENUE settlement even when no members exist", async () => {
  const { service, db } = setup(); db.users.find.mockImplementation(() => q([])); db.kpiPolicies.findOne.mockImplementation(() => q({ ...policy, metric: "REVENUE" }));
  await expect(service.settleKpiPeriod(owner, "p", {}, "k", "r")).rejects.toThrow("KPI_METRIC_UNSUPPORTED");
 });
 it("accrues KPI expense once, while payout only moves cash (aggregation expression contract)", async () => {
  const rows: Array<{ kind: string; amountVnd: number }> = [];
  const evaluate = (expr: unknown, row: Record<string, unknown>): unknown => {
   if (typeof expr === "string" && expr.startsWith("$")) return row[expr.slice(1)];
   if (Array.isArray(expr)) return expr.map(e => evaluate(e, row));
   if (!expr || typeof expr !== "object") return expr;
   const e = expr as Record<string, unknown>;
   if ("$eq" in e) { const a = evaluate(e.$eq, row) as unknown[]; return a[0] === a[1]; }
   if ("$in" in e) { const a = evaluate(e.$in, row) as [unknown, unknown[]]; return a[1].includes(a[0]); }
   if ("$and" in e) return (evaluate(e.$and, row) as unknown[]).every(Boolean);
   if ("$multiply" in e) return (evaluate(e.$multiply, row) as number[]).reduce((a, b) => a * b, 1);
   if ("$cond" in e) { const a = e.$cond as unknown[]; return evaluate(a[evaluate(a[0], row) ? 1 : 2], row); }
   if ("$switch" in e) { const s = e.$switch as { branches: Array<{ case: unknown; then: unknown }>; default: unknown }; return evaluate(s.branches.find(b => evaluate(b.case, row))?.then ?? s.default, row); }
   throw new Error("Unsupported test expression");
  };
  const ledger = { aggregate: vi.fn(async (pipeline: Array<{ $group: Record<string, { $sum: unknown }> }>) => [Object.fromEntries(Object.entries(pipeline[0].$group).filter(([k]) => k !== "_id").map(([k, e]) => [k, rows.reduce((sum, row) => sum + Number(evaluate(e.$sum, row)), 0)]))]) };
  const service = new CommerceService({ orders: { aggregate: vi.fn().mockResolvedValueOnce([{ revenueVnd: 1000 }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ revenueVnd: 1000 }]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ revenueVnd: 1000 }]).mockResolvedValueOnce([]), countDocuments: async () => 0 }, ledger } as never);
  expect((await service.dashboard(owner)).netProfitVnd).toBe(1000);
  rows.push({ kind: "KPI_BONUS", amountVnd: 50 });
  const accrued = await service.dashboard(owner); expect(accrued.netProfitVnd).toBe(950); expect(accrued).toMatchObject({ kpiBonusVnd: 50, operatingCashMovementVnd: 0 });
  rows.push({ kind: "PAYOUT", amountVnd: 50 });
  expect(await service.dashboard(owner)).toMatchObject({ netProfitVnd: 950, kpiBonusVnd: 50, operatingCashMovementVnd: -50 });
 });
 it("refuses a legacy REVENUE policy in member progress", async () => {
  const { service, db } = setup(); db.kpiPolicies.findOne.mockImplementation(() => q({ ...policy, metric: "REVENUE" }));
  await expect(service.getMyKpiProgress({ id: "m", role: "MEMBER" })).rejects.toThrow("KPI_METRIC_UNSUPPORTED");
 });
 it("freezes the complete settled roster, policy, zero results and window without any live reads", async () => {
  const { service, db, awards } = setup();
  const settled = await service.settleKpiPeriod(owner, "p", {}, "k", "r");
  expect(settled.awardsCount).toBe(1); expect(awards).toHaveLength(1);
  expect(awards[0]).toMatchObject({ memberId: "m", bonusVnd: 0, totalDeliveredQty: 0 });
  db.users.find.mockImplementation(() => { throw new Error("LIVE_ROSTER"); });
  db.kpiPolicies.findOne.mockImplementation(() => { throw new Error("LIVE_POLICY"); });
  db.orders.find.mockImplementation(() => { throw new Error("LIVE_ORDERS"); });
  const preview = await service.previewKpiPeriod(owner, "p");
  expect(preview.members).toEqual([expect.objectContaining({ memberId: "m", displayName: "Original", bonusVnd: 0, settled: true })]);
  expect(preview.policy).toEqual(policy); expect(preview.totalBonusVnd).toBe(0);
  expect(db.ledger.create).not.toHaveBeenCalled();
 });
 it("fails explicitly for legacy incomplete settled history instead of live recomputation", async () => {
  const { service, period, db } = setup(); period.status = "SETTLED";
  await expect(service.previewKpiPeriod(owner, "p")).rejects.toThrow("KPI_SETTLEMENT_SNAPSHOT_INCOMPLETE");
  expect(db.orders.find).not.toHaveBeenCalled(); expect(db.users.find).not.toHaveBeenCalled();
 });
 it("persists a positive award tied to its ledger and does not settle twice", async () => {
  const { service, db, awards } = setup(); db.orders.find.mockImplementation(() => q([{ items: [{ qty: 1 }], allocations: [] }]));
  expect((await service.settleKpiPeriod(owner, "p", {}, "k", "r")).totalBonusVnd).toBe(50);
  expect(awards[0]).toMatchObject({ bonusVnd: 50, ledgerEntryId: expect.any(String) });
  expect(db.ledger.create).toHaveBeenCalledTimes(1); expect(db.balances.updateOne).toHaveBeenCalledTimes(1);
  await expect(service.settleKpiPeriod(owner, "p", {}, "other", "r")).rejects.toThrow("KPI_PERIOD_ALREADY_SETTLED");
  expect(db.ledger.create).toHaveBeenCalledTimes(1);
 });
 it("blocks settlement while a period has not closed", async () => {
  const { service, period, db } = setup(); period.endDate = new Date("2099-01-01");
  await expect(service.settleKpiPeriod(owner, "p", {}, "k", "r")).rejects.toThrow("KPI_PERIOD_NOT_CLOSED");
  expect(db.ledger.create).not.toHaveBeenCalled(); expect(db.kpiPeriods.updateOne).not.toHaveBeenCalled();
 });
 it("queries delivered performance with half-open event boundaries only", async () => {
  const { service, period, db } = setup();
  await service.computeDeliveredQty("m", period.startDate, period.endDate);
  expect(db.orders.find).toHaveBeenCalledWith({ responsibleMemberId: "m", status: { $in: ["DELIVERED", "PARTIALLY_RETURNED"] }, deliveredAt: { $gte: period.startDate, $lt: period.endDate } });
 });
 it("selects active progress half-open without falling back to a future or ended period", async () => {
  const { service, db } = setup(); db.kpiPeriods.findOne.mockImplementation(() => q(null));
  expect(await service.getMyKpiProgress({ id: "m", role: "MEMBER" })).toEqual({ hasActivePeriod: false });
  expect(db.kpiPeriods.findOne).toHaveBeenCalledTimes(1);
  expect(db.kpiPeriods.findOne.mock.calls[0]).toEqual([{ status: "OPEN", startDate: { $lte: expect.any(Date) }, endDate: { $gt: expect.any(Date) } }]);
 });
 it("rejects unsupported REVENUE at DTO and service/calculator boundaries", async () => {
  const { service, db } = setup();
  const dto = Object.assign(new CreateKpiPolicyDto(), { name: "P", periodType: "CUSTOM", metric: "REVENUE", tiers: [{ minQty: 1, bonusVnd: 50 }] });
  expect((await validate(dto)).some(e => e.property === "metric")).toBe(true);
  await expect(service.createKpiPolicy(owner, dto, "k", "r")).rejects.toThrow("KPI_METRIC_UNSUPPORTED");
  expect(() => service.evaluateKpi({ ...policy, metric: "REVENUE" } as never, 1)).toThrow("KPI_METRIC_UNSUPPORTED");
  expect(db.kpiPolicies.create).not.toHaveBeenCalled();
 });
});
