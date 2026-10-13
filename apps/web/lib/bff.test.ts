import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "./bff";
import { createHmac } from "node:crypto";
import { quote } from "./pricing-fixture";

const origin = "https://shop.example";
const config = {
  apiUrl: "http://api.internal:4000/api/v1",
  webOrigin: origin,
  timeoutMs: 20,
  sharedSecret: "test-only-not-a-credential-1234567890",
};
const request = (
  path = "products",
  method = "GET",
  headers = {},
  body?: string,
) => new Request(`${origin}/api/v1/${path}`, { method, headers, body });
afterEach(() => vi.restoreAllMocks());
describe("same-origin BFF", () => {
  it("allowlists pricing and promotion/voucher methods with mutation controls", async () => {
    const id = "12345678-1234-1234-1234-123456789abc";
    for (const [path, methods] of [
      ["pricing/quote", ["POST"]], ["internal/pricing/quote", ["POST"]],
      ["promotions", ["GET", "POST"]], [`promotions/${id}`, ["PATCH", "DELETE"]],
      ["vouchers", ["GET", "POST"]], [`vouchers/${id}`, ["PATCH", "DELETE"]],
      [`vouchers/${id}/redemptions`, ["GET"]],
    ] as const) {
      for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
        const fetcher = vi.fn().mockResolvedValue(Response.json([]));
        const response = await proxy(request(path, method, { origin, "content-type": "application/json", "idempotency-key": "key" }, method === "GET" ? undefined : "{}"), ["v1", ...path.split("/")], config, fetcher);
        expect(response.status).toBe((methods as readonly string[]).includes(method) ? 200 : 405);
        if (fetcher.mock.calls.length) expect(new Headers(fetcher.mock.calls[0][1].headers).get("idempotency-key")).toBe("key");
      }
      if (methods.includes("POST" as never) || methods.includes("DELETE" as never)) {
        const method = methods.includes("POST" as never) ? "POST" : "DELETE";
        expect((await proxy(request(path, method, { "content-type": "application/json" }, "{}"), ["v1", ...path.split("/")], config, vi.fn())).status).toBe(403);
      }
    }
  });
  it("forwards only safe stale quotes on explicit order price rejection", async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ error: { code: "PRICE_STALE_CONFIRMATION_REQUIRED", quote: { ...quote, voucherCode: "SECRET", reservedCount: 9 }, stack: "SECRET" } }, { status: 409 })));
    const response = await proxy(request("checkout/orders", "POST", { origin, "content-type": "application/json" }, "{}"), ["v1", "checkout", "orders"], config, fetcher);
    const data = await response.json();
    expect(data.error.quote).toEqual(quote);
    expect(JSON.stringify(data)).not.toContain("SECRET");
  });
  it("rejects modified and duplicate signed cookies without forwarding them", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() => Promise.resolve(Response.json({ ok: true })));
    const first = await proxy(request(), ["v1", "products"], config, fetcher);
    const cookie = first.headers
      .getSetCookie()
      .find((value) => value.startsWith("__Host-cbst_client="))!
      .split(";")[0];
    const original = new Headers(fetcher.mock.calls[0][1].headers).get(
      "x-cbst-client",
    );
    const tampered = cookie.replace(/=./, (match) =>
      match === "=a" ? "=b" : "=a",
    );
    for (const value of [tampered, `${cookie}; ${cookie}`]) {
      await proxy(
        request("products", "GET", { cookie: value }),
        ["v1", "products"],
        config,
        fetcher,
      );
      const headers = new Headers(fetcher.mock.calls.at(-1)![1].headers);
      expect(headers.get("x-cbst-client")).not.toBe(original);
      expect(headers.get("cookie")).toBeNull();
    }
  });
  it.each([undefined, "short"])(
    "fails closed with invalid identity secret %s",
    async (sharedSecret) => {
      const fetcher = vi.fn();
      expect(
        (
          await proxy(
            request(),
            ["v1", "products"],
            { ...config, sharedSecret },
            fetcher,
          )
        ).status,
      ).toBe(503);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it("authenticates a stable cookie across login and checkout and signs only server-generated identity", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(
          Response.json(
            { ok: true },
            {
              headers: {
                "x-cbst-client": "leak",
                "x-cbst-timestamp": "leak",
                "x-cbst-signature": "leak",
              },
            },
          ),
        ),
      );
    const first = await proxy(
      request(
        "auth/login",
        "POST",
        {
          origin,
          "content-type": "application/json",
          "x-forwarded-for": "attacker",
          "x-cbst-client": "chosen",
          "x-cbst-signature": "chosen",
        },
        "{}",
      ),
      ["v1", "auth", "login"],
      config,
      fetcher,
    );
    const cookie = first.headers
      .getSetCookie()
      .find((value) => value.startsWith("__Host-cbst_client="))!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Strict");
    expect(cookie).toContain("Path=/");
    expect(cookie).not.toContain("Domain=");
    await proxy(
      request(
        "checkout/orders",
        "POST",
        {
          origin,
          "content-type": "application/json",
          cookie: `${cookie.split(";")[0]}; cbst_session=session`,
        },
        "{}",
      ),
      ["v1", "checkout", "orders"],
      config,
      fetcher,
    );
    const one = new Headers(fetcher.mock.calls[0][1].headers),
      two = new Headers(fetcher.mock.calls[1][1].headers);
    expect(one.get("x-cbst-client")).toMatch(/^[A-Za-z0-9._:-]{1,128}$/);
    expect(one.get("x-cbst-client")).not.toBe("chosen");
    expect(two.get("x-cbst-client")).toBe(one.get("x-cbst-client"));
    expect(one.get("x-cbst-timestamp")).toMatch(/^\d{10}$/);
    expect(one.get("x-cbst-signature")).toBe(
      createHmac("sha256", config.sharedSecret)
        .update(`${one.get("x-cbst-timestamp")}:${one.get("x-cbst-client")}`)
        .digest("hex"),
    );
    expect(two.get("cookie")).toBe("cbst_session=session");
    expect(one.get("x-forwarded-for")).toBeNull();
    for (const name of [
      "x-cbst-client",
      "x-cbst-timestamp",
      "x-cbst-signature",
    ])
      expect(first.headers.get(name)).toBeNull();
  });
  it("replaces forged identity cookies and issues identity on upstream failures", async () => {
    const chosen = "a".repeat(43);
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await proxy(
      request("products", "GET", {
        cookie: `__Host-cbst_client=${chosen}.${"0".repeat(64)}`,
      }),
      ["v1", "products"],
      config,
      fetcher,
    );
    expect(result.status).toBe(502);
    expect(result.headers.get("set-cookie")).toContain("__Host-cbst_client=");
    expect(
      new Headers(fetcher.mock.calls[0][1].headers).get("x-cbst-client"),
    ).not.toBe(chosen);
  });
  it("sanitizes failed incoming body streams rather than throwing a server error", async () => {
    const broken = request(
      "auth/login",
      "POST",
      { origin, "content-type": "application/json" },
      "{}",
    );
    vi.spyOn(broken.body!, "getReader").mockImplementation(() => {
      throw new Error("private transport details");
    });
    const response = await proxy(
      broken,
      ["v1", "auth", "login"],
      config,
      vi.fn(),
    );
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("private");
  });
  it("allows only GET for the new owner catalog", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json([]));
    expect(
      (
        await proxy(
          request("owner/products"),
          ["v1", "owner", "products"],
          config,
          fetcher,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await proxy(
          request("owner/products", "PATCH"),
          ["v1", "owner", "products"],
          config,
          fetcher,
        )
      ).status,
    ).toBe(405);
  });
  it.each([
    undefined,
    "null",
    "https://evil.example",
    "https://shop.example.evil",
    "https://shop.example/",
  ])("rejects mutation origin %s before fetching", async (value) => {
    const fetcher = vi.fn();
    const response = await proxy(
      request(
        "auth/login",
        "POST",
        {
          ...(value ? { origin: value } : {}),
          "content-type": "application/json",
        },
        "{}",
      ),
      ["v1", "auth", "login"],
      config,
      fetcher,
    );
    expect(response.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("fails closed without configured API or canonical browser origin", async () => {
    expect(
      (await proxy(request(), ["v1", "products"], {}, vi.fn())).status,
    ).toBe(503);
  });
  it.each([
    { path: ["v1", "..", "auth"] },
    { path: ["v1", "products%2fsecret"] },
    { path: ["v1", "health"] },
    { path: ["v2", "products"] },
  ])("rejects unallowlisted path $path", async ({ path }) => {
    expect((await proxy(request(), path, config, vi.fn())).status).toBe(404);
  });
  it("rejects unknown query parameters and unsupported methods", async () => {
    expect(
      (
        await proxy(
          request("orders?filter=secret"),
          ["v1", "orders"],
          config,
          vi.fn(),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await proxy(
          request("products", "DELETE"),
          ["v1", "products"],
          config,
          vi.fn(),
        )
      ).status,
    ).toBe(405);
  });
  it("requires JSON and limits mutation bodies", async () => {
    expect(
      (
        await proxy(
          request("auth/login", "POST", { origin }, "{}"),
          ["v1", "auth", "login"],
          config,
          vi.fn(),
        )
      ).status,
    ).toBe(415);
    expect(
      (
        await proxy(
          request(
            "auth/login",
            "POST",
            { origin, "content-type": "application/json" },
            "x".repeat(65537),
          ),
          ["v1", "auth", "login"],
          config,
          vi.fn(),
        )
      ).status,
    ).toBe(413);
  });
  it("only forwards allowed headers and the session cookie, never trusts proxy headers", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response('{"ok":true}', {
        headers: {
          "content-type": "application/json",
          "set-cookie":
            "cbst_session=abc; Path=/; HttpOnly; Secure; SameSite=Strict",
          "x-secret": "hidden",
          "access-control-allow-origin": "*",
        },
      }),
    );
    const result = await proxy(
      request(
        "auth/login",
        "POST",
        {
          origin,
          "content-type": "application/json",
          cookie: "other=private; cbst_session=abc",
          authorization: "secret",
          "x-forwarded-for": "spoof",
          "idempotency-key": "a".repeat(32),
          "x-guest-session": "b".repeat(32),
        },
        "{}",
      ),
      ["v1", "auth", "login"],
      config,
      fetcher,
    );
    const [url, init] = fetcher.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(url).toBe("http://api.internal:4000/api/v1/auth/login");
    expect(headers.get("cookie")).toBe("cbst_session=abc");
    expect(headers.get("origin")).toBe(origin);
    expect(headers.get("authorization")).toBeNull();
    expect(headers.get("x-forwarded-for")).toBeNull();
    expect(headers.get("idempotency-key")).toBe("a".repeat(32));
    expect(headers.get("x-guest-session")).toBe("b".repeat(32));
    expect(init.redirect).toBe("manual");
    expect(init.cache).toBe("no-store");
    expect(result.headers.get("set-cookie")).toContain("Path=/");
    expect(result.headers.get("cache-control")).toBe("no-store");
    expect(result.headers.get("x-secret")).toBeNull();
    expect(result.headers.get("access-control-allow-origin")).toBeNull();
  });
  it("preserves safe API error codes, request IDs and retry-after", async () => {
    const result = await proxy(
      request(),
      ["v1", "products"],
      config,
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: "RATE_LIMITED", message: "private details" },
          }),
          {
            status: 429,
            headers: { "retry-after": "60", "x-request-id": "request-1" },
          },
        ),
      ),
    );
    expect(result.status).toBe(429);
    expect(result.headers.get("retry-after")).toBe("60");
    expect(await result.json()).toEqual({
      error: { code: "RATE_LIMITED", requestId: "request-1" },
    });
  });
  it.each([302, 500])(
    "sanitizes redirects and server errors (%s)",
    async (status) => {
      const result = await proxy(
        request(),
        ["v1", "products"],
        config,
        vi.fn().mockResolvedValue(
          new Response("internal secret", {
            status,
            headers: { location: "https://evil.example" },
          }),
        ),
      );
      expect(result.status).toBe(502);
      expect(await result.text()).not.toContain("secret");
      expect(result.headers.get("location")).toBeNull();
    },
  );
  it("sanitizes network failures and times out stalled upstream calls", async () => {
    expect(
      (
        await proxy(
          request(),
          ["v1", "products"],
          config,
          vi.fn().mockRejectedValue(new Error("secret")),
        )
      ).status,
    ).toBe(502);
    const fetcher: typeof fetch = async (_url, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("abort")),
        ),
      );
    expect(
      (await proxy(request(), ["v1", "products"], config, fetcher)).status,
    ).toBe(504);
  });
  it("rejects invalid JSON from upstream", async () => {
    expect(
      (
        await proxy(
          request(),
          ["v1", "products"],
          config,
          vi.fn().mockResolvedValue(new Response("<html>oops</html>")),
        )
      ).status,
    ).toBe(502);
  });
  it("does not expose PATCH on catalog list or POST on product detail", async () => {
    for (const [path, method] of [
      ["products", "PATCH"],
      ["products/CBST-300", "POST"],
    ]) {
      expect(
        (
          await proxy(
            request(
              path,
              method,
              { origin, "content-type": "application/json" },
              "{}",
            ),
            ["v1", ...path.split("/")],
            config,
            vi.fn(),
          )
        ).status,
      ).toBe(405);
    }
  });
  it.each([
    "orders/123e4567-e89b-42d3-a456-426614174000/returns",
    "orders/123e4567-e89b-42d3-a456-426614174000/assignment",
    "users/123e4567-e89b-42d3-a456-426614174000/password-reset",
    "auth/reset-password",
  ])("forwards new controller endpoint %s", async (path) => {
    expect(
      (
        await proxy(
          request(
            path,
            "POST",
            { origin, "content-type": "application/json" },
            "{}",
          ),
          ["v1", ...path.split("/")],
          config,
          vi.fn().mockResolvedValue(Response.json({ ok: true })),
        )
      ).status,
    ).toBe(200);
  });
  it("preserves the explicit checkout-disabled response", async () => {
    const response = await proxy(
      request(),
      ["v1", "products"],
      config,
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              code: "CHECKOUT_DISABLED_PENDING_TRANSACTION_VERIFICATION",
            },
          },
          { status: 503 },
        ),
      ),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("CHECKOUT_DISABLED");
  });
  it("times out even when upstream response body never completes", async () => {
    const response = new Response(new ReadableStream({ start() {} }));
    const result = await proxy(
      request(),
      ["v1", "products"],
      config,
      vi.fn().mockResolvedValue(response),
    );
    expect(result.status).toBe(504);
  }, 1000);
});
