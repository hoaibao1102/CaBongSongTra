import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "public", "data");
const SETTINGS_FILE = path.join(DATA_DIR, "media-settings.json");

function rejectUnsafeMutation(request: Request) {
  const urlOrigin = new URL(request.url).origin.replace(/\/+$/, "");
  const configuredOrigin = process.env.WEB_ORIGIN?.trim().replace(/\/+$/, "");
  const reqOrigin = (request.headers.get("origin") || "").trim().replace(/\/+$/, "");
  const isOriginMatch = Boolean(reqOrigin && (reqOrigin === urlOrigin || (configuredOrigin && reqOrigin === configuredOrigin)));
  if (!isOriginMatch || request.headers.get("sec-fetch-site") === "cross-site")
    return NextResponse.json({ error: "ORIGIN_REJECTED" }, { status: 403 });
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    return NextResponse.json({ error: "JSON_REQUIRED" }, { status: 415 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 65536) return NextResponse.json({ error: "BODY_TOO_LARGE" }, { status: 413 });
  return null;
}

async function readJsonLimited(request: Request, limit = 65536) {
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error("INVALID_JSON"); }
}

async function requireOwner(request: Request) {
  let apiUrl = (process.env.API_INTERNAL_URL ?? "").trim().replace(/\/+$/, "");
  if (!apiUrl) return NextResponse.json({ error: "API_NOT_CONFIGURED" }, { status: 503 });
  if (!apiUrl.endsWith("/api/v1")) apiUrl += "/api/v1";
  const session = request.headers.get("cookie")?.split(";").map((value) => value.trim()).find((value) => /^cbst_session=[A-Za-z0-9_-]+$/.test(value));
  if (!session) return NextResponse.json({ error: "SESSION_INVALID" }, { status: 401 });
  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/me`, { headers: { Accept: "application/json", Cookie: session }, cache: "no-store", redirect: "manual" });
    if (!response.ok) return NextResponse.json({ error: "SESSION_INVALID" }, { status: response.status === 403 ? 403 : 401 });
    const actor = await response.json();
    if (actor?.role !== "OWNER_ADMIN") return NextResponse.json({ error: "OWNER_REQUIRED" }, { status: 403 });
    return { apiUrl: apiUrl.replace(/\/$/, ""), session };
  } catch {
    return NextResponse.json({ error: "UPSTREAM_ERROR" }, { status: 502 });
  }
}

function getStoredData() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const content = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Failed to read fallback media-settings.json:", err);
  }
  return null;
}

export async function GET() {
  const apiUrl = process.env.API_INTERNAL_URL;
  if (apiUrl) {
    try {
      const res = await fetch(`${apiUrl}/media`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && data.images && Object.keys(data.images).length > 0) {
          return NextResponse.json(data);
        }
      }
    } catch {
      // Fallback to local snapshot if API server is initializing
    }
  }

  const fallback = getStoredData();
  return NextResponse.json({
    success: true,
    images: fallback?.images || {},
    gallery: fallback?.gallery || [],
    source: "snapshot",
  });
}

export async function POST(request: Request) {
  try {
    const unsafe = rejectUnsafeMutation(request);
    if (unsafe) return unsafe;
    const body = await readJsonLimited(request);
    if (!body) return NextResponse.json({ success: false, error: "BODY_TOO_LARGE" }, { status: 413 });
    const auth = await requireOwner(request);
    if (auth instanceof Response) return auth;
    const { images, gallery } = body;

    const persisted = await fetch(`${auth.apiUrl}/media/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: auth.session, Origin: process.env.WEB_ORIGIN ?? "" },
      body: JSON.stringify({ images, gallery }),
      cache: "no-store",
    });
    if (!persisted.ok) return NextResponse.json({ success: false, error: "MEDIA_PERSIST_FAILED" }, { status: 502 });
    const durable = await persisted.json();

    return NextResponse.json(durable);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
