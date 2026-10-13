import { expect, it } from "vitest";
import { ownerProductInitial, returnChoices, paymentDue } from "./owner-views";
it("prefers authoritative payment due for members without exposing return details, including zero", () => {
  expect(
    paymentDue({ totalVnd: 100, receiptsVnd: 20, paymentDueVnd: 15 }),
  ).toBe(15);
  expect(paymentDue({ totalVnd: 100, receiptsVnd: 20, paymentDueVnd: 0 })).toBe(
    0,
  );
});
it("uses actual owner product version and inactive state", () => {
  expect(
    ownerProductInitial({ version: 7, retailPriceVnd: 123000, active: false }),
  ).toEqual({ expectedVersion: 7, retailPriceVnd: 123000, active: false });
  expect(() => ownerProductInitial({ retailPriceVnd: 123000 })).toThrow();
});
it("offers only remaining allocated quantities and adjusts payment due for returns", () => {
  expect(
    returnChoices([
      { batchId: "a", qty: 4, returnedQty: 3, returnableQty: 1 },
      { batchId: "b", qty: 2, returnedQty: 2, returnableQty: 0 },
    ]),
  ).toEqual([{ batchId: "a", qty: 4, returnedQty: 3, returnableQty: 1 }]);
  expect(
    paymentDue({
      totalVnd: 100,
      receiptsVnd: 70,
      returnValueVnd: 40,
      returnRefundsVnd: 10,
    }),
  ).toBeNull();
});
it.each([undefined, -1, 1.5, NaN, Infinity])(
  "fails closed for unavailable or invalid authoritative due %s",
  (value) => {
    expect(
      paymentDue({ paymentDueVnd: value, totalVnd: 100, receiptsVnd: 0 }),
    ).toBeNull();
  },
);
