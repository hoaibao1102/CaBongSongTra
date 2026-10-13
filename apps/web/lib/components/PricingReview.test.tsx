import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PricingReview, requestQuote, guardedPayload } from "./PricingReview";
import { quote } from "../pricing-fixture";
it("requests server quotes with no-store and builds distinct guarded order DTOs", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(quote));
  const payload = { items: [{ sku: "CBST-300", qty: 1 }], customer: { phone: "0912345678" }, consent: true, source: "DIRECT", notes: "" };
  const result = await requestQuote(payload, true, "MEMBER10", fetcher);
  expect(fetcher.mock.calls[0][0]).toBe("/api/v1/internal/pricing/quote");
  expect(fetcher.mock.calls[0][1].cache).toBe("no-store");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ items: payload.items, customerPhone: payload.customer.phone, voucherCode: "MEMBER10" });
  expect(guardedPayload(payload, result, true, "MEMBER10")).toEqual({ customer: payload.customer, items: payload.items, source: "DIRECT", notes: "", voucherCode: "MEMBER10", clientExpectedTotalVnd: 90, pricingFingerprint: "abc123" });
  expect(guardedPayload(payload, result, false, "SECRET")).not.toHaveProperty("voucherCode");
});
it("shows a deliberate price confirmation including zero totals", () => {
  const html = renderToStaticMarkup(<PricingReview quote={{ ...quote, totalVnd: 0 } as never} lang="en" stale onConfirm={() => {}} />);
  expect(html).toContain("Price changed");
  expect(html).toContain("Confirm this price");
  expect(html).toContain("Discount");
});
