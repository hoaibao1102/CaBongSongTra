import { describe, expect, it } from "vitest";
import { canonicalProducts } from "../lib/p0a/catalog";
import { P0aError } from "../lib/p0a/errors";
import { assertAdmin, assertExpectedVersion, assertOrderAccess, assertPaymentAllowed, assertValidOrderTransition, calculateCommission, derivePaymentStatus, maskPhone, selectReservationBatches, shouldReleaseReservation, toCsv } from "../lib/p0a/domain";
import type { Actor, OrderProjection } from "../lib/p0a/types";

const admin: Actor = { id: "admin", organizationId: "org", role: "OWNER_ADMIN", active: true };
const memberA: Actor = { id: "member-a", organizationId: "org", role: "MEMBER", active: true };
const memberB: Actor = { id: "member-b", organizationId: "org", role: "MEMBER", active: true };
const order: OrderProjection = { id: "order", organizationId: "org", ownerMemberId: "member-a", status: "DRAFT", paymentStatus: "UNPAID", grossDue: 199_000, grossCollected: 0, directCosts: 0, cogs: 0, version: 1 };

function codeOf(work: () => unknown) {
  try { work(); return "NO_ERROR"; } catch (error) { return error instanceof P0aError ? error.code : "UNKNOWN"; }
}

describe("S1 identity and authorization", () => {
  it("AC-AUTH-001 rejects unauthenticated internal mutations", () => {
    expect(codeOf(() => assertAdmin(null))).toBe("UNAUTHENTICATED");
  });

  it("AC-AUTH-002 rejects member-only access to admin resources", () => {
    expect(codeOf(() => assertAdmin(memberA))).toBe("FORBIDDEN");
  });

  it("AC-AUTH-003 hides another member's order", () => {
    expect(() => assertOrderAccess(memberA, order)).not.toThrow();
    expect(codeOf(() => assertOrderAccess(memberB, order))).toBe("RESOURCE_NOT_FOUND");
  });
});

describe("S2 products, pricing, and inventory", () => {
  it("AC-PROD-001 seeds only canonical 300/400/600g SKUs", () => {
    expect(canonicalProducts.map((product) => product.sku)).toEqual(["CBST-300", "CBST-400", "CBST-600"]);
    expect(canonicalProducts.map((product) => product.labelNetWeightG)).toEqual([300, 400, 600]);
    expect(canonicalProducts.map((product) => product.retailPrice)).toEqual([109_000, 139_000, 199_000]);
  });

  it("AC-INV-006/007 reserves sellable batches by FEFO then FIFO only", () => {
    expect(selectReservationBatches([
      { id: "blocked", productId: "p", available: 99, expiresAt: "2027-01-01", receivedAt: "2026-10-01", status: "QUARANTINED", labelEvidencePath: "label.jpg" },
      { id: "missing-label", productId: "p", available: 99, expiresAt: "2027-01-01", receivedAt: "2026-10-01", status: "AVAILABLE", labelEvidencePath: null },
      { id: "old-expiry", productId: "p", available: 1, expiresAt: "2027-01-01", receivedAt: "2026-10-03", status: "AVAILABLE", labelEvidencePath: "label.jpg" },
      { id: "fifo-old", productId: "p", available: 2, expiresAt: "2027-03-01", receivedAt: "2026-10-01", status: "AVAILABLE", labelEvidencePath: "label.jpg" },
      { id: "fifo-new", productId: "p", available: 2, expiresAt: "2027-03-01", receivedAt: "2026-10-02", status: "AVAILABLE", labelEvidencePath: "label.jpg" },
    ], 4, new Date("2026-10-09T00:00:00Z"))).toEqual([
      { batchId: "old-expiry", quantity: 1 },
      { batchId: "fifo-old", quantity: 2 },
      { batchId: "fifo-new", quantity: 1 },
    ]);
  });

  it("AC-INV-001 reports OUT_OF_STOCK instead of overselling", () => {
    expect(codeOf(() => selectReservationBatches([{ id: "one", productId: "p", available: 1, expiresAt: "2027-01-01", receivedAt: "2026-10-01", status: "AVAILABLE", labelEvidencePath: "label.jpg" }], 2, new Date("2026-10-09T00:00:00Z")))).toBe("OUT_OF_STOCK");
  });

  it("AC-INV-008 releases only unpaid confirmed expired reservations", () => {
    const now = new Date("2026-10-10T00:00:00Z");
    expect(shouldReleaseReservation({ orderStatus: "CONFIRMED", paymentStatus: "UNPAID", reservationExpiresAt: new Date("2026-10-09T00:00:00Z"), now })).toBe(true);
    expect(shouldReleaseReservation({ orderStatus: "PREPARING", paymentStatus: "UNPAID", reservationExpiresAt: new Date("2026-10-09T00:00:00Z"), now })).toBe(false);
    expect(shouldReleaseReservation({ orderStatus: "CONFIRMED", paymentStatus: "PARTIALLY_PAID", reservationExpiresAt: new Date("2026-10-09T00:00:00Z"), now })).toBe(false);
  });
});

describe("S3 orders and payments", () => {
  it("AC-ORD-001 rejects transitions outside the canonical state machine", () => {
    expect(() => assertValidOrderTransition("DRAFT", "CONFIRMED")).not.toThrow();
    expect(codeOf(() => assertValidOrderTransition("DRAFT", "DELIVERED"))).toBe("INVALID_STATE_TRANSITION");
    expect(codeOf(() => assertValidOrderTransition("DELIVERED", "CANCELLED"))).toBe("INVALID_STATE_TRANSITION");
  });

  it("AC-ORD-006 rejects stale expectedVersion", () => {
    expect(codeOf(() => assertExpectedVersion(order, 0))).toBe("VERSION_CONFLICT");
  });

  it("AC-PAY-002 derives partial and full payment status", () => {
    expect(derivePaymentStatus(199_000, 100_000, 0)).toBe("PARTIALLY_PAID");
    expect(derivePaymentStatus(199_000, 199_000, 0)).toBe("PAID");
    expect(derivePaymentStatus(199_000, 199_000, 50_000)).toBe("PARTIALLY_REFUNDED");
    expect(derivePaymentStatus(199_000, 199_000, 199_000)).toBe("REFUNDED");
  });

  it("AC-PAY-003 blocks refund above net receipt and restricts refund to admin", () => {
    expect(codeOf(() => assertPaymentAllowed(memberA, order, { kind: "REFUND", method: "BANK_TRANSFER", amount: 1, idempotencyKey: "k" }, 100))).toBe("FORBIDDEN");
    expect(codeOf(() => assertPaymentAllowed(admin, order, { kind: "REFUND", method: "BANK_TRANSFER", amount: 101, idempotencyKey: "k" }, 100))).toBe("PAYMENT_EXCEEDS_BALANCE");
  });
});

describe("S4 finance, commission, payout, and export", () => {
  it("AC-PAY-001 and AC-FIN-001 make commission eligible only after delivered, paid, reconciled, no open return", () => {
    expect(calculateCommission({ orderOwnerRole: "MEMBER", delivered: true, paymentStatus: "PARTIALLY_PAID", directCostsReconciled: true, hasOpenReturn: false, collected: 100_000, cogs: 65_000, directCosts: 10_000, refunds: 0 }).eligible).toBe(false);
    expect(calculateCommission({ orderOwnerRole: "MEMBER", delivered: true, paymentStatus: "PAID", directCostsReconciled: true, hasOpenReturn: false, collected: 199_000, cogs: 140_000, directCosts: 15_000, refunds: 0 })).toMatchObject({ eligible: true, baseProfit: 44_000, memberAmount: 17_600, ownerAmount: 26_400 });
  });

  it("AC-FIN-002 and AC-FIN-004 keep loss real and owner-admin orders without member payable", () => {
    expect(calculateCommission({ orderOwnerRole: "MEMBER", delivered: true, paymentStatus: "PAID", directCostsReconciled: true, hasOpenReturn: false, collected: 100_000, cogs: 140_000, directCosts: 15_000, refunds: 0 })).toMatchObject({ baseProfit: -55_000, memberAmount: 0, ownerAmount: 0 });
    expect(calculateCommission({ orderOwnerRole: "OWNER_ADMIN", delivered: true, paymentStatus: "PAID", directCostsReconciled: true, hasOpenReturn: false, collected: 199_000, cogs: 140_000, directCosts: 15_000, refunds: 0 }).memberAmount).toBe(0);
  });

  it("AC-AUTH-004 masks PII and escapes CSV formula injection", () => {
    expect(maskPhone("84901234567", false)).toBe("********567");
    expect(toCsv([["name", "phone"], ["=IMPORTXML(1)", "84901234567"]])).toContain("'=IMPORTXML(1)");
  });
});
