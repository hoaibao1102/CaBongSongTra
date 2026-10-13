import { expect, it, vi } from "vitest";
import { proxy } from "./bff";
import { requestQuote } from "./components/PricingReview";
import { safeQuote } from "./pricing";
import { quote } from "./pricing-fixture";

it("allows verify and counters only with the existing BFF controls", async () => {
  const origin = "https://shop.example";
  const config = { apiUrl: "http://api.internal/api/v1", webOrigin: origin, sharedSecret: "test-only-secret-at-least-32-characters" };
  for (const [path, allowed] of [["vouchers/verify", "POST"], ["vouchers/12345678-1234-1234-1234-123456789abc/counters", "GET"]]) {
    for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
      const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true }));
      const request = new Request(`${origin}/api/v1/${path}`, { method, headers: { origin, "content-type": "application/json", cookie: "cbst_session=abc; unrelated=secret" }, ...(method === "GET" ? {} : { body: "{}" }) });
      const response = await proxy(request, ["v1", ...path.split("/")], config, fetcher);
      expect(response.status).toBe(method === allowed ? 200 : 405);
      expect(response.headers.get("cache-control")).toBe("no-store");
      if (method === allowed) expect(new Headers(fetcher.mock.calls[0][1].headers).get("cookie")).toBe("cbst_session=abc");
      else expect(fetcher).not.toHaveBeenCalled();
    }
  }
  const fetcher = vi.fn();
  expect((await proxy(new Request(`${origin}/api/v1/vouchers/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }), ["v1", "vouchers", "verify"], config, fetcher)).status).toBe(403);
  expect(fetcher).not.toHaveBeenCalled();
});

it("sends only customerPhone for internal quotes and no customer or voucher publicly", async () => {
  const fetcher = vi.fn().mockImplementation(async () => Response.json(quote));
  const payload = { items: [{ sku: "CBST-300", qty: 1 }], customer: { phone: "0901234567", name: "Private" } };
  await requestQuote(payload, true, "SAVE", fetcher);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ items: payload.items, customerPhone: payload.customer.phone, voucherCode: "SAVE" });
  await requestQuote(payload, false, "SAVE", fetcher);
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ items: payload.items });
});

it("rejects unsafe numeric unit prices in stale quotes", () => {
  expect(safeQuote({ ...quote, items: [{ ...quote.items[0], unitPriceVnd: Number.MAX_VALUE }] })).toBeUndefined();
});
it("normalizes the implemented service quote without inventing a timestamp", async () => {
  const { pricingMode, totalVnd, ...fields } = quote;
  const wire = { ...fields, mode: pricingMode, orderTotalVnd: totalVnd };
  expect(safeQuote(wire)).toEqual({ ...fields, pricingMode, totalVnd });
  const fetcher = vi.fn().mockResolvedValue(Response.json(wire));
  await expect(requestQuote({ items: [{ sku: "CBST-300", qty: 1 }] }, false, undefined, fetcher)).resolves.toMatchObject({ totalVnd });
});
