import "reflect-metadata";
import mongoose from "mongoose";
import { describe, expect, it, vi } from "vitest";
import { CommerceService } from "../src/v2/service";
import { kpiPeriodSchema, kpiPolicySchema } from "../src/v2/models";

const q = (value: unknown) => ({ session: () => q(value), lean: async () => value });

describe("R1 offline settlement schema boundary", () => {
  it("casts the real lean policy snapshot through the actual period update without BSON metadata", async () => {
    // Disconnected models only: no connection, query execution, app bootstrap or env loader.
    const local = new mongoose.Mongoose();
    const Policy = local.model("ReviewR1Policy", kpiPolicySchema);
    const Period = local.model("ReviewR1Period", kpiPeriodSchema);
    const policy = new Policy({ id: "policy", name: "Frozen policy", periodType: "CUSTOM", metric: "PRODUCT_QTY", active: true,
      tiers: [{ minQty: 1, bonusVnd: 50 }], createdAt: new Date(0), updatedAt: new Date(1000) }).toObject();
    expect(policy._id).toBeInstanceOf(mongoose.Types.ObjectId);
    const period = { id: "period", policyId: policy.id, name: "Past", status: "OPEN", startDate: new Date("2020-01-01"), endDate: new Date("2020-02-01"), createdAt: new Date(0) };
    let captured: Record<string, unknown> | undefined;
    const db = { idempotent: async (_s: string, _k: string, _d: unknown, work: (session: unknown) => unknown) => work({}),
      kpiPolicies: { findOne: () => q(policy) }, users: { find: () => q([]) },
      kpiPeriods: { findOne: () => q(period), updateOne: vi.fn(async (_filter: unknown, update: { $set: Record<string, unknown> }) => { captured = update.$set; return { matchedCount: 1 }; }) },
      kpiAwards: { create: vi.fn() }, audit: { create: vi.fn() } };
    await new CommerceService(db as never).settleKpiPeriod({ id: "owner", role: "OWNER_ADMIN" }, period.id, {}, "key", "request");
    expect(captured).toBeDefined();
    expect((captured!.settlementSnapshot as { policy: object }).policy).not.toHaveProperty("_id");
    const update = { $set: captured! };
    // _castUpdate is synchronous and never executes this query. Preserve immutable
    // fields so the test cannot pass merely because Mongoose stripped the snapshot.
    const query = Period.updateOne({ id: period.id }, update, { overwriteImmutable: true });
    const cast = () => (query as unknown as { _castUpdate(value: unknown): { $set: { settlementSnapshot: { policy: { toObject(): Record<string, unknown> } } } } })._castUpdate(update);
    expect(cast).not.toThrow();
    const snapshotPolicy = cast().$set.settlementSnapshot.policy.toObject();
    const { _id: mongoId, ...businessPolicy } = policy;
    expect(mongoId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(snapshotPolicy).toMatchObject(businessPolicy);
    expect(captured!.settlementSnapshot).toMatchObject({ policy: businessPolicy, members: [], totalBonusVnd: 0, startDate: period.startDate, endDate: period.endDate });
    expect(new Period({ ...period, ...captured }).validateSync()).toBeUndefined();
    policy.tiers[0].bonusVnd = 999;
    policy.updatedAt.setTime(9999);
    expect(snapshotPolicy.tiers).toEqual([{ minQty: 1, bonusVnd: 50 }]);
    expect(snapshotPolicy.updatedAt).toEqual(new Date(1000));
    expect(local.connection.readyState).toBe(0);
  });
});
