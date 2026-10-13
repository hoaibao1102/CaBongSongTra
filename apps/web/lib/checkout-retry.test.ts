import { describe, expect, it, vi } from "vitest";
import { createCheckout } from "./checkout-retry";
import { apiRequest, ApiError } from "./commerce";
import { quote } from "./pricing-fixture";
const payload = {
  customer: {
    name: "Private Name",
    phone: "0912345678",
    address: "Private Address",
  },
  items: [{ sku: "CBST-300", qty: 1 }],
};
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
    values,
  };
}
describe("tab-scoped checkout retries", () => {
  it("transports a sanitized stale quote and releases only explicit stale rejection", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ error: {
      code: "PRICE_STALE_CONFIRMATION_REQUIRED", quote: { ...quote, voucherCode: "SECRET" }, requestId: "req-1",
    } }, { status: 409 })));
    const error: unknown = await apiRequest("checkout/orders", undefined, fetcher).catch(e => e);
    expect(error).toBeInstanceOf(ApiError);
    if (!(error instanceof ApiError)) throw new Error("Expected ApiError");
    expect(error.quote).toEqual(quote);
    const store = storage();
    await createCheckout(store, fetcher)(payload).catch(() => {});
    expect(store.values.size).toBe(0);
    fetcher.mockResolvedValue(Response.json({ id: "confirmed" }));
    await expect(createCheckout(store, fetcher)({ ...payload, clientExpectedTotalVnd: 90, pricingFingerprint: "new" })).resolves.toEqual({ id: "confirmed" });
  });
  it("does not release retry identity for stale code on an ambiguous gateway status", async () => {
    const store = storage();
    const fetcher = vi.fn().mockResolvedValue(Response.json({ error: { code: "PRICE_STALE_CONFIRMATION_REQUIRED", quote } }, { status: 504 }));
    await createCheckout(store, fetcher)(payload).catch(() => {});
    expect(store.values.size).toBe(1);
    await expect(createCheckout(store, fetcher)({ ...payload, pricingFingerprint: "changed" })).rejects.toThrow("CHECKOUT_RECONCILIATION_REQUIRED");
  });
  it("replays the original pricing guard after reload when the same cart receives a new quote", async () => {
    const store = storage();
    const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Response.json({ id: "original-order" }));
    const original = { ...payload, clientExpectedTotalVnd: 90, pricingFingerprint: "original" };
    await createCheckout(store, fetcher)(original).catch(() => {});
    await expect(createCheckout(store, fetcher)({ ...payload, clientExpectedTotalVnd: 100, pricingFingerprint: "fresh" })).resolves.toEqual({ id: "original-order" });
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toMatchObject({ clientExpectedTotalVnd: 90, pricingFingerprint: "original" });
    expect(fetcher.mock.calls[0][1].headers).toEqual(fetcher.mock.calls[1][1].headers);
  });
  it("does not let concurrent mounted forms overwrite an unresolved identity during hashing", async () => {
    const store = storage();
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    await Promise.allSettled([
      createCheckout(store, fetcher)(payload),
      createCheckout(store, fetcher)({ ...payload, notes: "different" }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("reuses key and guest scope after remount/reload without persisting PII", async () => {
    const store = storage();
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    await createCheckout(store, fetcher)(payload).catch(() => {});
    await createCheckout(store, fetcher)(payload).catch(() => {});
    expect(fetcher.mock.calls[0][1].headers).toEqual(
      fetcher.mock.calls[1][1].headers,
    );
    const saved = JSON.stringify([...store.values]);
    for (const value of [
      "Private Name",
      "0912345678",
      "Private Address",
      "customer",
    ])
      expect(saved).not.toContain(value);
  });
  it("blocks changed payloads until the unresolved original succeeds, including after reload", async () => {
    const store = storage();
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    const submit = createCheckout(store, fetcher);
    await submit(payload).catch(() => {});
    const first = JSON.stringify([...store.values]);
    await expect(
      createCheckout(store, fetcher)({ ...payload, notes: "changed" }),
    ).rejects.toThrow("CHECKOUT_RECONCILIATION_REQUIRED");
    expect(JSON.stringify([...store.values])).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await createCheckout(store, fetcher)(payload).catch(() => {});
    expect(fetcher.mock.calls[0][1].headers).toEqual(
      fetcher.mock.calls[1][1].headers,
    );
    expect(store.values.size).toBe(1);
    fetcher.mockResolvedValue(Response.json({ id: "order" }));
    await submit(payload);
    expect(store.values.size).toBe(0);
  });
  it("fails closed if retry state cannot be saved or is corrupt", async () => {
    const fetcher = vi.fn();
    const store = storage();
    store.setItem("cbst-checkout-retry", "broken");
    await expect(createCheckout(store, fetcher)(payload)).rejects.toThrow(
      "RETRY_STORAGE_UNAVAILABLE",
    );
    await expect(
      createCheckout(
        {
          ...store,
          getItem: () => null,
          setItem: () => {
            throw new Error();
          },
        },
        fetcher,
      )(payload),
    ).rejects.toThrow("RETRY_STORAGE_UNAVAILABLE");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("blocks actor changes without discarding the original actor's unresolved identity", async () => {
    const store = storage();
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    await createCheckout(store, fetcher)(payload, "member-a").catch(() => {});
    await expect(
      createCheckout(store, fetcher)(payload, "member-b"),
    ).rejects.toThrow("CHECKOUT_RECONCILIATION_REQUIRED");
    await expect(createCheckout(store, fetcher)(payload)).rejects.toThrow(
      "CHECKOUT_RECONCILIATION_REQUIRED",
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    await createCheckout(store, fetcher)(payload, "member-a").catch(() => {});
    expect(fetcher.mock.calls[0][0]).toBe("/api/v1/orders");
    expect(fetcher.mock.calls[0][1].headers["Idempotency-Key"]).toBe(
      fetcher.mock.calls[1][1].headers["Idempotency-Key"],
    );
    expect(fetcher.mock.calls[1][1].headers).not.toHaveProperty(
      "X-Guest-Session",
    );
  });
});
