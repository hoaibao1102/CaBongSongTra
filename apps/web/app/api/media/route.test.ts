import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import fs from "fs";

const request = (cookie?: string) => new Request("https://shop.test/api/media", {
  method: "POST",
  headers: { "content-type": "application/json", origin: "https://shop.test", ...(cookie ? { cookie } : {}) },
  body: JSON.stringify({ images: { hero: "https://example.test/hero.webp" } }),
});

describe("media persistence route", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => {});
    vi.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    vi.stubEnv("API_INTERNAL_URL", "http://api.test/api/v1");
    vi.stubEnv("WEB_ORIGIN", "https://shop.test");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects unauthenticated writes", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects non-owner writes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response('{"role":"MEMBER"}', { status: 200 }));
    expect((await POST(request("cbst_session=test"))).status).toBe(403);
  });

  it("rejects cross-origin writes before authentication", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const response = await POST(new Request("https://shop.test/api/media", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.test", cookie: "cbst_session=test" },
      body: JSON.stringify({ images: {} }),
    }));
    expect(response.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a chunked oversized body without Content-Length", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const chunk = new Uint8Array(20000).fill(65);
    let sent = 0;
    const body = new ReadableStream({ pull(controller) { if (sent++ < 4) controller.enqueue(chunk); else controller.close(); } });
    const response = await POST(new Request("https://shop.test/api/media", {
      method: "POST", duplex: "half",
      headers: { "content-type": "application/json", origin: "https://shop.test", cookie: "cbst_session=test" }, body,
    } as RequestInit & { duplex: string }));
    expect(response.status).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not report success when durable API persistence fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response('{"role":"OWNER_ADMIN"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"error":{"code":"INTERNAL_ERROR"}}', { status: 500 }));
    expect((await POST(request("cbst_session=test"))).status).toBe(502);
  });

  it("reports success only after the API persists the update", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response('{"role":"OWNER_ADMIN"}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"success":true,"images":{"hero":"https://example.test/hero.webp"},"gallery":[]}', { status: 200 }));
    const response = await POST(request("cbst_session=test"));
    expect(response.status).toBe(200);
    expect(fetchSpy.mock.calls[1][0]).toBe("http://api.test/api/v1/media/sync");
    expect(await response.json()).toMatchObject({ success: true });
  });
});
