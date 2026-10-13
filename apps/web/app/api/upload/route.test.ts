import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const ownerResponse = () => new Response('{"role":"OWNER_ADMIN"}', {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

describe("Cloudinary Upload Route (/api/upload)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("API_INTERNAL_URL", "http://api.test/api/v1");
    vi.stubEnv("WEB_ORIGIN", "https://shop.test");
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "test-cloud");
    vi.stubEnv("CLOUDINARY_API_KEY", "test-key");
    vi.stubEnv("CLOUDINARY_API_SECRET", "test-secret");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("rejects unauthenticated configuration reads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 401 }));
    const res = await GET(new Request("https://shop.test/api/upload"));
    expect(res.status).toBe(401);
  });

  it("GET returns configuration status to an owner without exposing credentials", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(ownerResponse());
    const res = await GET(new Request("https://shop.test/api/upload", { headers: { cookie: "cbst_session=test" } }));
    expect(await res.json()).toEqual({ configured: true, cloudName: "test-cloud", hasApiKey: true, hasSecret: true });
  });

  it("POST fails closed when Cloudinary credentials are missing", async () => {
    vi.stubEnv("CLOUDINARY_CLOUD_NAME", "");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(ownerResponse());
    const res = await POST(new Request("https://shop.test/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: "cbst_session=test", origin: "https://shop.test" },
      body: JSON.stringify({ file: "data:image/png;base64,test" }),
    }));
    expect(res.status).toBe(503);
  });

  it("POST uploads successfully for an authenticated owner", async () => {
    const cloudinary = { secure_url: "https://res.cloudinary.com/test-cloud/image/upload/v123/cbst/sample.webp", public_id: "cbst/sample", width: 800, height: 600, format: "webp", bytes: 12345 };
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(ownerResponse())
      .mockResolvedValueOnce(new Response(JSON.stringify(cloudinary), { status: 200, headers: { "Content-Type": "application/json" } }));
    const res = await POST(new Request("https://shop.test/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: "cbst_session=test", origin: "https://shop.test" },
      body: JSON.stringify({ file: "data:image/png;base64,abc123mockdata" }),
    }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, url: cloudinary.secure_url, publicId: cloudinary.public_id });
    expect(fetchSpy.mock.calls[1][0]).toBe("https://api.cloudinary.com/v1_1/test-cloud/image/upload");
  });

  it("rejects unauthenticated uploads before contacting Cloudinary", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 401 }));
    const res = await POST(new Request("https://shop.test/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://shop.test" },
      body: JSON.stringify({ file: "data:image/png;base64,test" }),
    }));
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects cross-origin uploads", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(new Request("https://shop.test/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "cbst_session=test", origin: "https://evil.test" },
      body: JSON.stringify({ file: "data:image/png;base64,test" }),
    }));
    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects oversized uploads before parsing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(new Request("https://shop.test/api/upload", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "9000001", cookie: "cbst_session=test", origin: "https://shop.test" },
      body: JSON.stringify({ file: "data:image/png;base64,test" }),
    }));
    expect(res.status).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a chunked oversized upload without Content-Length", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const chunk = new Uint8Array(1024 * 1024).fill(65);
    let sent = 0;
    const body = new ReadableStream({ pull(controller) { if (sent++ < 9) controller.enqueue(chunk); else controller.close(); } });
    const res = await POST(new Request("https://shop.test/api/upload", {
      method: "POST", duplex: "half",
      headers: { "content-type": "application/json", cookie: "cbst_session=test", origin: "https://shop.test" }, body,
    } as RequestInit & { duplex: string }));
    expect(res.status).toBe(413);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});