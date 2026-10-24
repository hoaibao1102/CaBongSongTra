/* eslint-disable @typescript-eslint/no-explicit-any */
import "reflect-metadata";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Reflector } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ApiGuard, clientIdentity } from "../src/v2/http";
import { PasswordResetService } from "../src/v2/password-reset";
import { hashPassword } from "../src/auth/password";
import { proxy } from "../../web/lib/bff";
import { CommerceController } from "../src/v2/controller";
import { CommerceService } from "../src/v2/service";
import ts from "typescript";
import { readFileSync } from "node:fs";

vi.mock("../src/auth/password", () => ({ hashPassword: vi.fn().mockResolvedValue("mock-hash-not-a-secret") }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const origin = "https://audit.example";
function fixture(path = "/api/v1/pricing/quote") {
  const counts = new Map<string, number>();
  const db = { rates: { findOneAndUpdate: vi.fn((q: any) => ({ lean: async () => {
    const count = (counts.get(q.key) ?? 0) + 1;
    counts.set(q.key, count); return { count };
  } })) } };
  const guard = new ApiGuard({ getAllAndOverride: (key: string) => key === "public" } as unknown as Reflector, {} as any, db as any);
  const activate = async (headers: Headers) => {
    const req = { method: "POST", path, ip: "192.0.2.25", body: {}, get: (key: string) => headers.get(key) ?? undefined, is: () => true };
    const context = { switchToHttp: () => ({ getRequest: () => req, getResponse: () => ({ setHeader: () => {} }) }), getHandler: () => CommerceController.prototype.publicQuote, getClass: () => CommerceController };
    return guard.canActivate(context as any);
  };
  return { activate, counts, db };
}
function env() {
  vi.stubEnv("SESSION_SECRET", "audit-placeholder-session-secret-00000000");
  vi.stubEnv("BFF_SHARED_SECRET", "audit-placeholder-shared-secret-000000000");
  vi.stubEnv("CORS_ALLOWED_ORIGINS", origin);
}

describe("independent audit: reproduced security boundaries (mocked only)", () => {
  it("SEC-01: 21 cookie-less BFF requests from the same mock network source evade the 20/min quote bucket", async () => {
    env();
    const f = fixture();
    const identities = new Set<string>();
    for (let n = 0; n < 21; n++) {
      const response = await proxy(new Request(`${origin}/api/v1/pricing/quote`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: "{}" }), ["v1", "pricing", "quote"], { apiUrl: "https://api.audit.example", webOrigin: origin, sharedSecret: process.env.BFF_SHARED_SECRET }, async (_url, init) => {
        const headers = new Headers(init?.headers);
        identities.add(clientIdentity({ get: (key: string) => headers.get(key) ?? undefined } as any));
        await f.activate(headers);
        return Response.json({ ok: true });
      });
      expect(response.status).toBe(200);
    }
    expect(identities.size).toBe(21);
    expect([...f.counts.values()]).toEqual(Array(21).fill(1));
  });
  it("SEC-01 control: stable identity is actually blocked at request 21", async () => {
    env(); const f = fixture();
    const headers = new Headers({ origin });
    for (let n = 0; n < 20; n++) await expect(f.activate(headers)).resolves.toBe(true);
    await expect(f.activate(headers)).rejects.toMatchObject({ status: 429 });
  });
  it("SEC-02: invalid reset tokens still invoke password hashing before the failed token lookup", async () => {
    const events: string[] = [];
    vi.mocked(hashPassword).mockImplementationOnce(async () => { events.push("hash"); return "mock-hash"; });
    const db = { transaction: (work: any) => work({}), resets: { findOneAndDelete: () => ({ session: () => ({ lean: async () => { events.push("lookup"); return null; } }) }) } };
    await expect(new PasswordResetService(db as any).consume({ token: "A".repeat(43), password: "audit-placeholder-password" }, "audit")).rejects.toMatchObject({ status: 401 });
    expect(events).toEqual(["hash", "lookup"]);
  });
  it("SEC-03: compiled inline-import media DTO becomes Object, bypassing global DTO validation", async () => {
    const source = readFileSync("src/v2/controller.ts", "utf8");
    const output = ts.transpileModule(source, { compilerOptions: { experimentalDecorators: true, emitDecoratorMetadata: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    const start = output.indexOf('Post("media/slots")');
    const end = output.indexOf('"assignMediaSlot", null)', start);
    expect(start).toBeGreaterThan(0);
    expect(output.slice(start, end)).toContain('__metadata("design:paramtypes", [Object, Object])');
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true, transform: true });
    const payload = { slotKey: { $ne: "" }, url: { unvalidated: true }, unexpected: "accepted" };
    await expect(pipe.transform(payload, { type: "body", metatype: Object })).resolves.toEqual(payload);
    const updateOne = vi.fn().mockResolvedValue({});
    const service = new CommerceService({ mediaSlots: { updateOne } } as any);
    await service.assignMediaSlot(payload as any, { id: "audit-owner", role: "OWNER_ADMIN" });
    expect(updateOne.mock.calls[0][0]).toEqual({ slotKey: { $ne: "" } });
  });
  it("SEC-04: excluded hardcoded deployment origin remains trusted even when allowlist is another host", async () => {
    env(); const f = fixture();
    await expect(f.activate(new Headers({ origin: "https://ca-bong-song-tra.vercel.app" }))).resolves.toBe(true);
    await expect(f.activate(new Headers({ origin: "https://untrusted.audit.example" }))).rejects.toMatchObject({ status: 403 });
  });
});
