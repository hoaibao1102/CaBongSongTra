import { derivePaymentStatus } from "@cbst/contracts";

type Entry = {
  id: string;
  kind: "RECEIPT" | "REFUND";
  amountVnd: number;
  idempotencyKey: string;
};

type Input = Omit<Entry, "kind">;

export class FinanceLedger {
  readonly entries: Entry[] = [];

  constructor(private readonly amountDueVnd: number) {
    if (!Number.isInteger(amountDueVnd) || amountDueVnd < 0) throw new Error("INVALID_MONEY");
  }

  receipt(input: Input) {
    return this.append({ ...input, kind: "RECEIPT" });
  }

  refund(input: Input) {
    const current = this.snapshot();
    if (input.amountVnd > current.collectedVnd) throw new Error("PAYMENT_EXCEEDS_BALANCE");
    return this.append({ ...input, kind: "REFUND" });
  }

  private append(entry: Entry) {
    if (!Number.isInteger(entry.amountVnd) || entry.amountVnd <= 0) throw new Error("INVALID_MONEY");
    const replay = this.entries.find((item) => item.idempotencyKey === entry.idempotencyKey);
    if (replay) return replay;
    this.entries.push(entry);
    return entry;
  }

  snapshot() {
    const receiptsVnd = this.entries
      .filter((entry) => entry.kind === "RECEIPT")
      .reduce((total, entry) => total + entry.amountVnd, 0);
    const refundsVnd = this.entries
      .filter((entry) => entry.kind === "REFUND")
      .reduce((total, entry) => total + entry.amountVnd, 0);
    return {
      amountDueVnd: this.amountDueVnd,
      receiptsVnd,
      refundsVnd,
      collectedVnd: receiptsVnd - refundsVnd,
      paymentStatus: derivePaymentStatus(this.amountDueVnd, receiptsVnd, refundsVnd),
    };
  }
}
