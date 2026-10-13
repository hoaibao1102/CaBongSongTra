import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { PromotionManager, promotionPayload } from "./PromotionManager";
import { sectionsFor } from "../commerce";
it("provides owner CRUD fields and member assigned vouchers without owner controls", () => {
  const owner = renderToStaticMarkup(<PromotionManager kind="vouchers" owner lang="en" />);
  for (const name of ["code", "name", "kind", "value", "maxDiscountVnd", "minSubtotalVnd", "maxUsageTotal", "maxUsagePerCustomer", "assignedMemberIds", "startAt", "endAt", "active"]) expect(owner).toContain(`name="${name}"`);
  const member = renderToStaticMarkup(<PromotionManager kind="vouchers" owner={false} lang="en" />);
  expect(member).toContain("Assigned vouchers");
  expect(member).not.toContain("Create voucher");
  expect(sectionsFor("MEMBER")).toContain("vouchers");
  expect(sectionsFor("MEMBER")).not.toContain("promotions");
  expect(sectionsFor("OWNER_ADMIN")).toContain("promotions");
});
it("builds integer/date/version payloads and rejects invalid percentages and windows", () => {
  const input = { name: "Sale", sku: "CBST-300", kind: "PERCENT", value: "1500", maxDiscountVnd: "10000", startAt: "2026-10-12T10:00", endAt: "2026-10-13T10:00", active: "on" };
  const result = promotionPayload("promotions", input, 3);
  expect(result).toMatchObject({ value: 1500, maxDiscountVnd: 10000, active: true, expectedVersion: 3 });
  expect(result.startAt).toBe(new Date(input.startAt).toISOString());
  expect(() => promotionPayload("promotions", { ...input, value: "10001" })).toThrow();
  expect(() => promotionPayload("promotions", { ...input, endAt: input.startAt })).toThrow();
  expect(() => promotionPayload("promotions", { ...input, maxDiscountVnd: "" })).toThrow();
});
