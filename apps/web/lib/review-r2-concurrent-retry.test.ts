import { describe, expect, it, vi } from "vitest";
import { createMutation } from "./commerce";

function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe("R2 concurrent retry ownership across mutation instances", () => {
  it.each([400, 401])("keeps the fence when an earlier %i resolves while an identical replay is pending", async status => {
    const store = storage();
    const first = deferred<Response>();
    const replay = deferred<Response>();
    const firstDispatched = deferred<void>();
    const replayDispatched = deferred<void>();
    const fetcher = vi.fn<typeof fetch>()
      .mockImplementationOnce(() => { firstDispatched.resolve(); return first.promise; })
      .mockImplementationOnce(() => { replayDispatched.resolve(); return replay.promise; })
      .mockImplementation(async () => Response.json({ ok: true }));
    const options = { store, actorId: "owner-private-identity" };
    const payload = { amountVnd: 1, reason: "private financial note" };
    const a = createMutation(fetcher, options)("expenses", payload).catch(error => error);
    await firstDispatched.promise;
    const firstRecord = [...store.values.values()][0];
    // A fresh instance models the hook being reconstructed on render/remount.
    const b = createMutation(fetcher, options)("expenses", payload);
    await replayDispatched.promise;
    const replayRecord = [...store.values.values()][0];
    first.resolve(Response.json({ error: { code: status === 401 ? "SESSION_INVALID" : "VALIDATION_ERROR" } }, { status }));
    expect(await a).toMatchObject({ status });
    try {
      await expect(createMutation(fetcher, options)("expenses", { ...payload, amountVnd: 2 }))
        .rejects.toThrow("OPERATION_RECONCILIATION_REQUIRED");
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(store.values.size).toBe(1);
      expect(replayRecord).not.toBe(firstRecord);
      const keys = fetcher.mock.calls.slice(0, 2).map(([, init]) => new Headers(init?.headers).get("Idempotency-Key"));
      expect(keys[0]).toBeTruthy();
      expect(keys[1]).toBe(keys[0]);
      expect(JSON.stringify([...store.values])).not.toMatch(/owner-private-identity|private financial note|amountVnd|expenses/);
      // Another actor is independent while this actor remains fenced.
      await createMutation(fetcher, { store, actorId: "other-owner" })("expenses", { amountVnd: 7 });
      expect(fetcher).toHaveBeenCalledTimes(3);
      expect(store.values.size).toBe(1);
    } finally {
      replay.resolve(Response.json({ ok: true }));
      await b;
    }
    expect(store.values.size).toBe(0);
    await createMutation(fetcher, options)("expenses", { ...payload, amountVnd: 2 });
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(new Headers(fetcher.mock.calls[3][1]?.headers).get("Idempotency-Key"))
      .not.toBe(new Headers(fetcher.mock.calls[0][1]?.headers).get("Idempotency-Key"));
  });
});
