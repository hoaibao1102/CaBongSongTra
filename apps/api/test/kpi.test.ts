import { describe, expect, it, vi } from "vitest";
import type { ClientSession } from "mongoose";
import { CommerceService } from "../src/v2/service";
import type { MongoRepository } from "../src/v2/repository";

const owner = { id: "owner", role: "OWNER_ADMIN" as const, displayName: "Owner" };
const member = { id: "member1", role: "MEMBER" as const, displayName: "Member 1" };
const session = { inTransaction: () => true } as ClientSession;

const query = (value: unknown) => ({
  session: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
  sort: vi.fn().mockReturnThis(),
});

function setup() {
  const collection = () => ({
    find: vi.fn(() => query([])),
    findOne: vi.fn(() => query(null)),
    create: vi.fn().mockResolvedValue([]),
    updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  });

  const db = {
    users: collection(),
    orders: collection(),
    ledger: collection(),
    balances: collection(),
    audit: collection(),
    kpiPolicies: collection(),
    kpiPeriods: collection(),
    kpiAwards: collection(),
    idempotent: vi.fn(async (_scope, _key, _payload, work) => work(session)),
  };

  const service = new CommerceService(db as unknown as MongoRepository);
  return { db, service };
}

describe("KPI Service & Milestone Rewards", () => {
  const policy = {
    id: "policy-1",
    name: "Thưởng doanh số tháng",
    periodType: "MONTHLY" as const,
    metric: "PRODUCT_QTY" as const,
    tiers: [
      { minQty: 20, bonusVnd: 50000 },
      { minQty: 30, bonusVnd: 80000 },
      { minQty: 50, bonusVnd: 150000 },
    ],
    active: true,
  };

  const period = {
    id: "period-1",
    policyId: "policy-1",
    name: "Kỳ Tháng 10/2026",
    startDate: new Date("2026-10-01T00:00:00.000Z"),
    endDate: new Date("2026-10-31T23:59:59.999Z"),
    status: "OPEN" as const,
  };

  it("evaluates correct milestone tier based on highest delivered product quantity achieved", () => {
    const { service } = setup();
    expect(service.evaluateKpi(policy as never, 15)).toEqual({ achievedTier: null, bonusVnd: 0 });
    expect(service.evaluateKpi(policy as never, 20)).toEqual({
      achievedTier: { minQty: 20, bonusVnd: 50000 },
      bonusVnd: 50000,
    });
    expect(service.evaluateKpi(policy as never, 28)).toEqual({
      achievedTier: { minQty: 20, bonusVnd: 50000 },
      bonusVnd: 50000,
    });
    expect(service.evaluateKpi(policy as never, 35)).toEqual({
      achievedTier: { minQty: 30, bonusVnd: 80000 },
      bonusVnd: 80000,
    });
    expect(service.evaluateKpi(policy as never, 60)).toEqual({
      achievedTier: { minQty: 50, bonusVnd: 150000 },
      bonusVnd: 150000,
    });
  });

  it("computes net delivered quantity excluding returned items", async () => {
    const { db, service } = setup();
    db.orders.find.mockReturnValue(query([
      {
        responsibleMemberId: member.id,
        status: "DELIVERED",
        items: [{ sku: "CBST-300", qty: 25 }],
        allocations: [],
      },
      {
        responsibleMemberId: member.id,
        status: "PARTIALLY_RETURNED",
        items: [{ sku: "CBST-300", qty: 10 }],
        allocations: [{ batchId: "b1", sku: "CBST-300", qty: 10, returnedQty: 3 }],
      },
    ]));

    const { totalDeliveredQty } = await service.computeDeliveredQty(
      member.id,
      period.startDate,
      period.endDate,
    );
    // 25 + (10 - 3) = 32
    expect(totalDeliveredQty).toBe(32);
  });

  it("denies non-owner from creating policies or settling periods", async () => {
    const { service } = setup();
    await expect(service.createKpiPolicy(member, { name: "P", periodType: "MONTHLY", tiers: [{ minQty: 10, bonusVnd: 10000 }] }, "k", "r")).rejects.toThrow("OWNER_REQUIRED");
    await expect(service.settleKpiPeriod(member, "p1", {}, "k", "r")).rejects.toThrow("OWNER_REQUIRED");
  });

  it("settles KPI period: writes KPI_BONUS to ledger, updates member balance and creates awards", async () => {
    const { db, service } = setup();
    db.kpiPeriods.findOne.mockReturnValue(query({ ...period, endDate: new Date("2020-02-01") }));
    db.kpiPeriods.updateOne.mockResolvedValue({ modifiedCount: 1, matchedCount: 1 } as never);
    db.kpiPolicies.findOne.mockReturnValue(query(policy));
    db.users.find.mockReturnValue(query([
      { id: "member1", displayName: "Member 1", emailNormalized: "m1@example.com", role: "MEMBER" },
      { id: "member2", displayName: "Member 2", emailNormalized: "m2@example.com", role: "MEMBER" },
    ]));

    // Member 1 delivered 25 (reaches tier 20 -> 50k bonus)
    // Member 2 delivered 10 (reaches 0 tier -> 0 bonus)
    (db.orders.find as unknown as { mockImplementation: (fn: (filter: { responsibleMemberId: string }) => unknown) => unknown }).mockImplementation((filter: { responsibleMemberId: string }) => {
      if (filter?.responsibleMemberId === "member1") {
        return query([{ items: [{ sku: "A", qty: 25 }], allocations: [] }]);
      }
      return query([{ items: [{ sku: "A", qty: 10 }], allocations: [] }]);
    });

    const result = await service.settleKpiPeriod(owner, "period-1", {}, "key", "req");

    expect(result.status).toBe("SETTLED");
    expect(result.awardsCount).toBe(2); // zero-result members are settlement facts too
    expect(result.totalBonusVnd).toBe(50000);

    // Verify Ledger entry for member1 with kind: KPI_BONUS
    expect(db.ledger.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          kind: "KPI_BONUS",
          memberId: "member1",
          amountVnd: 50000,
        }),
      ],
      { session },
    );

    // Verify Member 1 balance increment
    expect(db.balances.updateOne).toHaveBeenCalledWith(
      { memberId: "member1" },
      { $inc: { balanceVnd: 50000 } },
      { session, upsert: true },
    );

    // Verify Period status updated
    expect(db.kpiPeriods.updateOne).toHaveBeenCalledWith(
      { id: "period-1", status: "OPEN", settlementSnapshot: { $exists: false } },
      expect.objectContaining({
        $set: expect.objectContaining({ status: "SETTLED", settlementSnapshot: expect.objectContaining({ version: 1, totalBonusVnd: 50000, members: expect.arrayContaining([expect.objectContaining({ memberId: "member2", bonusVnd: 0 })]) }) }),
      }),
      { session, runValidators: true, overwriteImmutable: true },
    );
  });

  it("prevents double-settling an already settled period", async () => {
    const { db, service } = setup();
    db.kpiPeriods.findOne.mockReturnValue(query({ ...period, status: "SETTLED" }));
    await expect(service.settleKpiPeriod(owner, "period-1", {}, "k", "r")).rejects.toThrow("KPI_PERIOD_ALREADY_SETTLED");
  });

  it("calculates member progress against active period", async () => {
    const { db, service } = setup();
    db.kpiPeriods.findOne.mockReturnValue(query(period));
    db.kpiPolicies.findOne.mockReturnValue(query(policy));
    db.orders.find.mockReturnValue(query([{ items: [{ sku: "A", qty: 22 }], allocations: [] }]));

    const progress = await service.getMyKpiProgress(member);

    expect(progress.hasActivePeriod).toBe(true);
    expect(progress.currentQty).toBe(22);
    expect(progress.achievedTier).toEqual({ minQty: 20, bonusVnd: 50000 });
    expect(progress.currentBonusVnd).toBe(50000);
    expect(progress.nextTier).toEqual({ minQty: 30, bonusVnd: 80000 });
    expect(progress.remainingQtyToNextTier).toBe(8);
  });
});
