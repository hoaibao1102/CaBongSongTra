import { describe, it, expect, vi } from "vitest";
import { createCheckout } from "./checkout-retry";
import { createMutation } from "./commerce";
import { createAdminQueryClient, makeAdminQueryKey, invalidateAdminQueries, getSectionEndpoint } from "./query-cache";

// FE-01/02 assert remediated guarantees; other findings remain characterization.
describe("frontend audit characterization (mock transport only)", () => {
  it("ambiguous checkout cannot be discarded and same payload reuses its key", async () => {
    const values = new Map<string, string>();
    const store = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k,v); }, removeItem: (k: string) => { values.delete(k); } };
    const committedKeys: string[] = [];
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      committedKeys.push(new Headers(init?.headers).get("Idempotency-Key")!);
      if (committedKeys.length === 1) throw new TypeError("response lost after commit");
      return Response.json({ id: "second-order" });
    }) as typeof fetch;
    const checkout = createCheckout(store, fetcher, "internal");
    const payload = { items: [{ sku: "CBST-300", qty: 1 }] };
    await expect(checkout(payload, "owner")).rejects.toThrow("response lost");
    await expect(checkout({ ...payload, notes: "edited" }, "owner")).rejects.toThrow("CHECKOUT_RECONCILIATION_REQUIRED");
    await checkout(payload, "owner");
    expect(committedKeys).toHaveLength(2);
    expect(committedKeys[0]).toBe(committedKeys[1]);
  });
  it("user_changed misses the actual allUsers query key", () => {
    const client = createAdminQueryClient();
    const actor = { id: "owner", role: "OWNER_ADMIN" as const };
    const actual = makeAdminQueryKey(actor, "allUsers");
    client.setQueryData(actual, [{ id: "member", status: "ACTIVE" }]);
    invalidateAdminQueries(client, actor, "user_changed");
    expect(client.getQueryState(actual)?.isInvalidated).toBe(false);
    client.clear();
  });
  it("inventory/users/expenses pagination ignores requested page", () => {
    for (const section of ["inventory", "users", "expenses"]) {
      expect(getSectionEndpoint(section, true, 1)).toBe(getSectionEndpoint(section, true, 0));
    }
  });
  it("generic mutation blocks edits of ambiguous financial operations", async () => {
    const keys: string[] = [];
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      keys.push(new Headers(init?.headers).get("Idempotency-Key")!);
      if (keys.length === 1) throw new TypeError("response lost after commit");
      return Response.json({ id: "second-expense" });
    }) as typeof fetch;
    const values = new Map<string,string>();
    const store = { getItem:(k:string)=>values.get(k)??null, setItem:(k:string,v:string)=>{values.set(k,v);}, removeItem:(k:string)=>{values.delete(k);} };
    const mutate = createMutation(fetcher, {store,actorId:"owner"});
    await expect(mutate("expenses", { amountVnd: 100, reason: "a" })).rejects.toThrow();
    await expect(mutate("expenses", { amountVnd: 100, reason: "a " })).rejects.toThrow("OPERATION_RECONCILIATION_REQUIRED");
    expect(keys).toHaveLength(1);
  });
});
