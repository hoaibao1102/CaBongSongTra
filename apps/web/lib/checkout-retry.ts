import { apiRequest, ApiError } from "./commerce";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type PricingGuard = { clientExpectedTotalVnd: number; pricingFingerprint: string };
type Retry = { salt: string; fingerprint: string; key: string; guest: string; pricingGuard?: PricingGuard };
function splitPricingGuard(payload: unknown): { base: unknown; guard?: PricingGuard } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { base: payload };
  const { clientExpectedTotalVnd, pricingFingerprint, ...base } = payload as Record<string, unknown>;
  const guard = Number.isSafeInteger(clientExpectedTotalVnd) && Number(clientExpectedTotalVnd) >= 0 &&
    typeof pricingFingerprint === "string" && /^[A-Za-z0-9:_-]{1,256}$/.test(pricingFingerprint)
    ? { clientExpectedTotalVnd: Number(clientExpectedTotalVnd), pricingFingerprint }
    : undefined;
  return guard ? { base, guard } : { base: payload };
}
export function createCheckout(store: Store, fetcher: typeof fetch = fetch, slotName = "cbst-checkout-retry") {
  let busy = false;
  return async (payload: unknown, actorId?: string) => {
    if (busy) throw new Error("CHECKOUT_IN_PROGRESS");
    busy = true;
    try {
      let previous: Retry | null;
      let saved: string | null;
      try {
        const raw = store.getItem(slotName);
        saved = raw;
        previous = raw ? JSON.parse(raw) : null;
        if (
          raw !== null &&
          (!previous || !/^[a-f0-9]{64}$/.test(previous.fingerprint) ||
            ![previous.salt, previous.key, previous.guest].every(
              (value) =>
                typeof value === "string" &&
                /^[A-Za-z0-9_-]{32,64}$/.test(value),
            ) ||
            (previous.pricingGuard !== undefined &&
              (!Number.isSafeInteger(previous.pricingGuard.clientExpectedTotalVnd) ||
                previous.pricingGuard.clientExpectedTotalVnd < 0 ||
                !/^[A-Za-z0-9:_-]{1,256}$/.test(previous.pricingGuard.pricingFingerprint))))
        )
          throw new Error();
      } catch {
        throw new Error("RETRY_STORAGE_UNAVAILABLE");
      }
      const wasUncertain = previous !== null;
      const salt = previous?.salt ?? crypto.randomUUID();
      const submitted = splitPricingGuard(payload);
      const canonical = (value: unknown): unknown =>
        Array.isArray(value)
          ? value.map(canonical)
          : value && typeof value === "object"
            ? Object.fromEntries(
                Object.entries(value)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([key, item]) => [key, canonical(item)]),
              )
            : value;
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
          `${salt}:${actorId ?? "guest"}:${JSON.stringify(canonical(submitted.base))}`,
        ),
      );
      const fingerprint = Array.from(new Uint8Array(bytes), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      // Never replace an unresolved identity, even after editing or switching accounts.
      if (previous && previous.fingerprint !== fingerprint)
        throw new Error("CHECKOUT_RECONCILIATION_REQUIRED");
      const retry: Retry =
        previous?.fingerprint === fingerprint
          ? previous
          : {
              salt,
              fingerprint,
              key: crypto.randomUUID(),
              guest: crypto.randomUUID().replaceAll("-", ""),
              ...(submitted.guard ? { pricingGuard: submitted.guard } : {}),
            };
      const requestPayload = previous?.pricingGuard && payload && typeof payload === "object" && !Array.isArray(payload)
        ? { ...(payload as Record<string, unknown>), ...previous.pricingGuard }
        : payload;
      try {
        // Another mounted checkout may have written while hashing was asynchronous.
        if (store.getItem(slotName) !== saved)
          throw new Error("CHECKOUT_RECONCILIATION_REQUIRED");
        store.setItem(slotName, JSON.stringify(retry));
        if (store.getItem(slotName) !== JSON.stringify(retry)) throw new Error();
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "CHECKOUT_RECONCILIATION_REQUIRED"
        )
          throw error;
        throw new Error("RETRY_STORAGE_UNAVAILABLE");
      }
      const result = await apiRequest(
        actorId ? "orders" : "checkout/orders",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": retry.key,
            ...(!actorId ? { "X-Guest-Session": retry.guest } : {}),
          },
          body: JSON.stringify(requestPayload),
        },
        fetcher,
      ).catch((error: unknown) => {
        if (
          !wasUncertain && error instanceof ApiError &&
          ((error.status === 409 && error.code === "PRICE_STALE_CONFIRMATION_REQUIRED") ||
           (error.status >= 400 && error.status < 500 && ![408, 409, 425, 429].includes(error.status)))
        ) {
          try {
            if (store.getItem(slotName) === JSON.stringify(retry)) store.removeItem(slotName);
          } catch {
            throw new Error("RETRY_STORAGE_UNAVAILABLE");
          }
        }
        throw error;
      });
      // Do not turn a confirmed success into an ambiguous failure if cleanup is blocked.
      try {
        if (store.getItem(slotName) === JSON.stringify(retry))
          store.removeItem(slotName);
      } catch {
        /* Retained key still safely replays the confirmed request. */
      }
      return result;
    } finally {
      busy = false;
    }
  };
}
