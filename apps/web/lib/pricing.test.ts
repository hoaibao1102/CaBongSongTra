import { expect, it } from "vitest";
import { safeQuote } from "./pricing";

import { quote } from "./pricing-fixture";
it("projects a safe quote and rejects invalid monetary totals", () => {
  expect(safeQuote({ ...quote, voucherCode: "SECRET", items: [{ ...quote.items[0], assignedMemberIds: ["secret"] }] })).toEqual(quote);
  expect(safeQuote({ ...quote, totalVnd: -1 })).toBeUndefined();
  expect(safeQuote({ ...quote, discountVnd: 9 })).toBeUndefined();
});
