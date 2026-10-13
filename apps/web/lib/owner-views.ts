import type { RecordRow } from "./types";
export function ownerProductInitial(product: RecordRow) {
  if (
    !Number.isSafeInteger(product.version) ||
    typeof product.active !== "boolean" ||
    !Number.isSafeInteger(product.retailPriceVnd)
  )
    throw new Error("INVALID_PRODUCT_RESPONSE");
  return {
    expectedVersion: product.version,
    retailPriceVnd: product.retailPriceVnd,
    active: product.active,
  };
}
export const returnChoices = <T extends { returnableQty: number }>(
  allocations: T[],
) => allocations.filter((line) => line.returnableQty > 0);
export const paymentDue = (order: {
  paymentDueVnd?: number;
  totalVnd: number;
  receiptsVnd: number;
  returnValueVnd?: number;
  returnRefundsVnd?: number;
}) =>
  typeof order.paymentDueVnd === "number" &&
  Number.isSafeInteger(order.paymentDueVnd) &&
  order.paymentDueVnd >= 0
    ? order.paymentDueVnd
    : null;
