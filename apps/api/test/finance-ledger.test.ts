import { describe, expect, it } from "vitest";
import { FinanceLedger } from "../src/finance/finance-ledger";

describe("finance ledger", () => {
  it("derives partial/full/refund status from append-only entries", () => {
    const ledger = new FinanceLedger(199_000);
    ledger.receipt({ id: "r1", amountVnd: 100_000, idempotencyKey: "k1" });
    expect(ledger.snapshot().paymentStatus).toBe("PARTIALLY_PAID");
    ledger.receipt({ id: "r2", amountVnd: 99_000, idempotencyKey: "k2" });
    expect(ledger.snapshot().paymentStatus).toBe("PAID");
    ledger.refund({ id: "x1", amountVnd: 50_000, idempotencyKey: "k3" });
    expect(ledger.snapshot()).toMatchObject({ paymentStatus: "PARTIALLY_REFUNDED", collectedVnd: 149_000 });
  });

  it("replays duplicate idempotency keys without applying money twice", () => {
    const ledger = new FinanceLedger(199_000);
    ledger.receipt({ id: "r1", amountVnd: 199_000, idempotencyKey: "same" });
    ledger.receipt({ id: "r2", amountVnd: 199_000, idempotencyKey: "same" });
    expect(ledger.snapshot().collectedVnd).toBe(199_000);
    expect(ledger.entries).toHaveLength(1);
  });

  it("blocks refunds above net receipts", () => {
    const ledger = new FinanceLedger(199_000);
    ledger.receipt({ id: "r1", amountVnd: 100_000, idempotencyKey: "k1" });
    expect(() => ledger.refund({ id: "x1", amountVnd: 100_001, idempotencyKey: "k2" })).toThrow("PAYMENT_EXCEEDS_BALANCE");
  });
});
