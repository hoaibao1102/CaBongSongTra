import { apiRequest } from "./commerce";
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const slot = "cbst-checkout-retry";
type Retry = { salt: string; fingerprint: string; key: string; guest: string };
export function createCheckout(store: Store, fetcher: typeof fetch = fetch) {
  let busy = false;
  return async (payload: unknown, actorId?: string) => {
    if (busy) throw new Error("CHECKOUT_IN_PROGRESS");
    busy = true;
    try {
      let previous: Retry | null;
      let saved: string | null;
      try {
        const raw = store.getItem(slot);
        saved = raw;
        previous = raw ? JSON.parse(raw) : null;
        if (
          previous &&
          (!/^[a-f0-9]{64}$/.test(previous.fingerprint) ||
            ![previous.salt, previous.key, previous.guest].every(
              (value) =>
                typeof value === "string" &&
                /^[A-Za-z0-9_-]{32,64}$/.test(value),
            ))
        )
          throw new Error();
      } catch {
        throw new Error("RETRY_STORAGE_UNAVAILABLE");
      }
      const salt = previous?.salt ?? crypto.randomUUID();
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
          `${salt}:${actorId ?? "guest"}:${JSON.stringify(canonical(payload))}`,
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
            };
      try {
        // Another mounted checkout may have written while hashing was asynchronous.
        if (store.getItem(slot) !== saved)
          throw new Error("CHECKOUT_RECONCILIATION_REQUIRED");
        store.setItem(slot, JSON.stringify(retry));
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
          body: JSON.stringify(payload),
        },
        fetcher,
      );
      // Do not turn a confirmed success into an ambiguous failure if cleanup is blocked.
      try {
        if (store.getItem(slot) === JSON.stringify(retry))
          store.removeItem(slot);
      } catch {
        /* Retained key still safely replays the confirmed request. */
      }
      return result;
    } finally {
      busy = false;
    }
  };
}
