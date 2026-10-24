import { describe, it, expect, vi } from "vitest";
import { createMutation } from "./commerce";
import { errorText } from "./i18n";
import { createCheckout } from "./checkout-retry";
import { readFileSync } from "node:fs";
function storage() { const values = new Map<string,string>(); return { values, getItem:(k:string)=>values.get(k)??null, setItem:(k:string,v:string)=>{values.set(k,v);}, removeItem:(k:string)=>{values.delete(k);} }; }
describe("durable actor scoped operations", () => {
  it("does not generate a new payout reference on each retry and managers explain recovery", () => {
    for (const name of ["CommissionManager","InventoryManager","ExpenseManager","UserManager","ProductManager"]) {
      const source=readFileSync(new URL(`./components/${name}.tsx`,import.meta.url),"utf8");
      expect(source.includes("errorText(err, lang)")).toBe(true);
      if (name === "CommissionManager") expect(source.includes("`PAY-${Date.now()}`")).toBe(false);
    }
  });

  it("explains recovery for unresolved financial operations", () => {
    expect(errorText(new Error("OPERATION_RECONCILIATION_REQUIRED"),"en")).toContain("original");
    expect(errorText(new Error("OPERATION_RECONCILIATION_REQUIRED"),"en")).toContain("Do not clear");
  });
  it("rejects corrupt checkout null state instead of replacing it", async () => {
    const store=storage();store.setItem("cbst-checkout-retry","null");const fetcher=vi.fn();
    await expect(createCheckout(store,fetcher)({qty:1})).rejects.toThrow("RETRY_STORAGE_UNAVAILABLE");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed for unscoped non-auth mutations", async () => {
    const fetcher=vi.fn();
    await expect(createMutation(fetcher)("expenses",{amountVnd:1})).rejects.toThrow("OPERATION_ACTOR_REQUIRED");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("separates actors and preserves each unresolved operation", async () => {
    const store=storage(); const fetcher=vi.fn().mockRejectedValue(new Error("lost"));
    await createMutation(fetcher,{store,actorId:"a"})("expenses",{amountVnd:1}).catch(()=>{});
    await createMutation(fetcher,{store,actorId:"b"})("expenses",{amountVnd:2}).catch(()=>{});
    await expect(createMutation(fetcher,{store,actorId:"a"})("expenses",{amountVnd:2})).rejects.toThrow("OPERATION_RECONCILIATION_REQUIRED");
    expect(store.values.size).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("fails closed on storage failure and malformed durable state", async () => {
    const store=storage(); const fetcher=vi.fn().mockRejectedValue(new Error("lost"));
    await createMutation(fetcher,{store,actorId:"a"})("expenses",{}).catch(()=>{});
    for (const key of store.values.keys()) store.values.set(key,"null");
    await expect(createMutation(fetcher,{store,actorId:"a"})("expenses",{})).rejects.toThrow("RETRY_STORAGE_UNAVAILABLE");
    const broken={...storage(),setItem:()=>{throw new Error("quota");}};
    await expect(createMutation(fetcher,{store:broken,actorId:"a"})("expenses",{})).rejects.toThrow("RETRY_STORAGE_UNAVAILABLE");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("releases a first definitive validation rejection but retains a rejection after uncertainty", async () => {
    const store=storage(); const fetcher=vi.fn().mockResolvedValue(Response.json({error:{code:"VALIDATION_ERROR"}},{status:400}));
    await createMutation(fetcher,{store,actorId:"a"})("expenses",{}).catch(()=>{});
    expect(store.values.size).toBe(0);
    fetcher.mockRejectedValueOnce(new Error("lost"));
    await createMutation(fetcher,{store,actorId:"a"})("expenses",{}).catch(()=>{});
    await createMutation(fetcher,{store,actorId:"a"})("expenses",{}).catch(()=>{});
    expect(store.values.size).toBe(1);
  });

  it("does not erase ambiguous checkout identity on a later server rejection", async () => {
    const store=storage();
    const fetcher=vi.fn().mockRejectedValueOnce(new Error("lost"))
      .mockResolvedValueOnce(Response.json({error:{code:"VERSION_CONFLICT"}},{status:409}));
    await createCheckout(store,fetcher)({qty:1}).catch(()=>{});
    await createCheckout(store,fetcher)({qty:1}).catch(()=>{});
    await expect(createCheckout(store,fetcher)({qty:2})).rejects.toThrow("CHECKOUT_RECONCILIATION_REQUIRED");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("has no checkout discard escape hatch in the UI or helper", () => {
    const screens=readFileSync(new URL("../app/screens.tsx",import.meta.url),"utf8");
    expect(screens).not.toContain('removeItem("cbst-checkout-retry")');
    expect(screens).not.toContain('removeItem("cbst-internal-checkout-retry")');
    const helper=readFileSync(new URL("./checkout-retry.ts",import.meta.url),"utf8");
    expect(helper).not.toContain("export function clearCheckoutRetry");
  });
  it("wires manager and action operations to the authenticated actor, not module singletons", () => {
    const screens=readFileSync(new URL("../app/screens.tsx",import.meta.url),"utf8");
    expect(screens).toContain("OperationActorContext.Provider");
    expect(screens).toContain("useActorMutation()");
    for (const name of ["CommissionManager","InventoryManager","ExpenseManager","UserManager","ProductManager","PromotionManager"]) {
      const source=readFileSync(new URL(`./components/${name}.tsx`,import.meta.url),"utf8");
      expect(source).not.toMatch(/createMutation\(\)/);
      expect(source).toContain("useActorMutation()");
    }
  });
  it("blocks edits after a lost response across remount and reload, replays the same key without storing private payload", async () => {
    const store=storage(); const fetcher=vi.fn().mockRejectedValue(new Error("response lost"));
    const options={store, actorId:"owner-a"}; const payload={amountVnd:100, reason:"private payroll"};
    await createMutation(fetcher, options)("expenses",payload).catch(()=>{});
    await expect(createMutation(fetcher,options)("expenses",{...payload,amountVnd:101})).rejects.toThrow("OPERATION_RECONCILIATION_REQUIRED");
    await createMutation(fetcher,options)("expenses",payload).catch(()=>{});
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(new Headers(fetcher.mock.calls[0][1].headers).get("Idempotency-Key")).toBe(new Headers(fetcher.mock.calls[1][1].headers).get("Idempotency-Key"));
    expect(JSON.stringify([...store.values])).not.toContain("private payroll");
  });
});
