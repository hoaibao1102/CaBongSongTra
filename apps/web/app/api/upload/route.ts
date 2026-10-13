import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function rejectUnsafeMutation(request: Request) {
  const webOrigin = process.env.WEB_ORIGIN;
  if (!webOrigin || request.headers.get("origin") !== webOrigin || request.headers.get("sec-fetch-site") === "cross-site")
    return NextResponse.json({ error: "ORIGIN_REJECTED" }, { status: 403 });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > MAX_UPLOAD_BYTES)
    return NextResponse.json({ error: "BODY_TOO_LARGE" }, { status: 413 });
  return null;
}

async function readBodyLimited(request: Request, limit: number) {
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
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return body;
}

async function requireOwner(request: Request) {
  let apiUrl = (process.env.API_INTERNAL_URL ?? "").trim().replace(/\/+$/, "");
  if (!apiUrl) return NextResponse.json({ error: "API_NOT_CONFIGURED" }, { status: 503 });
  if (!apiUrl.endsWith("/api/v1")) apiUrl += "/api/v1";
  const cookie = request.headers.get("cookie");
  const session = cookie?.split(";").map((value) => value.trim()).find((value) => /^cbst_session=[A-Za-z0-9_-]+$/.test(value));
  if (!session) return NextResponse.json({ error: "SESSION_INVALID" }, { status: 401 });
  try {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/me`, {
      headers: { Accept: "application/json", Cookie: session },
      cache: "no-store",
      redirect: "manual",
    });
    if (!response.ok) return NextResponse.json({ error: response.status === 403 ? "OWNER_REQUIRED" : "SESSION_INVALID" }, { status: response.status === 403 ? 403 : 401 });
    const actor = await response.json();
    if (actor?.role !== "OWNER_ADMIN") return NextResponse.json({ error: "OWNER_REQUIRED" }, { status: 403 });
    return null;
  } catch {
    return NextResponse.json({ error: "UPSTREAM_ERROR" }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const denied = await requireOwner(request);
  if (denied) return denied;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  const hasSecret = Boolean(process.env.CLOUDINARY_API_SECRET);

  return NextResponse.json({
    configured: Boolean(cloudName && apiKey && hasSecret),
    cloudName: cloudName || null,
    hasApiKey: Boolean(apiKey),
    hasSecret,
  });
}

export async function POST(request: Request) {
  try {
    const unsafe = rejectUnsafeMutation(request);
    if (unsafe) return unsafe;
    const bytes = await readBodyLimited(request, MAX_UPLOAD_BYTES);
    if (!bytes) return NextResponse.json({ error: "BODY_TOO_LARGE" }, { status: 413 });
    const buffered = new Request(request.url, { method: "POST", headers: request.headers, body: bytes });
    const denied = await requireOwner(request);
    if (denied) return denied;
    const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
    const apiKey = (process.env.CLOUDINARY_API_KEY || "").trim();
    const apiSecret = (process.env.CLOUDINARY_API_SECRET || "").trim();

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Cloudinary chưa được cấu hình đầy đủ trên máy chủ." },
        { status: 503 },
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let filePayload: string | Blob;

    if (contentType.includes("multipart/form-data")) {
      const formData = await buffered.formData();
      const file = formData.get("file");
      if (!(file instanceof Blob) || file.size > MAX_UPLOAD_BYTES || !file.type.startsWith("image/")) {
        return NextResponse.json(
          { error: file instanceof Blob && file.size > MAX_UPLOAD_BYTES ? "BODY_TOO_LARGE" : "INVALID_IMAGE" },
          { status: file instanceof Blob && file.size > MAX_UPLOAD_BYTES ? 413 : 400 },
        );
      }
      filePayload = file as Blob;
    } else {
      const body = await buffered.json().catch(() => ({}));
      if (!body.file) {
        return NextResponse.json(
          { error: "Không tìm thấy dữ liệu ảnh (base64 hoặc URL)." },
          { status: 400 },
        );
      }
      if (typeof body.file !== "string" || body.file.length > MAX_UPLOAD_BYTES || !/^data:image\/(?:png|jpeg|webp|gif);base64,/.test(body.file))
        return NextResponse.json({ error: body.file?.length > MAX_UPLOAD_BYTES ? "BODY_TOO_LARGE" : "INVALID_IMAGE" }, { status: body.file?.length > MAX_UPLOAD_BYTES ? 413 : 400 });
      filePayload = body.file;
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = "cbst";

    // Ký xác thực tải lên an toàn (Signed upload)
    const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(toSign).digest("hex");

    const uploadData = new FormData();
    uploadData.append("file", filePayload);
    uploadData.append("api_key", apiKey);
    uploadData.append("timestamp", timestamp);
    uploadData.append("folder", folder);
    uploadData.append("signature", signature);

    const cloudinaryRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: uploadData,
      },
    );

    const result = await cloudinaryRes.json();

    if (!cloudinaryRes.ok) {
      const errorMsg = result?.error?.message || "Lỗi tải ảnh lên Cloudinary";
      return NextResponse.json(
        { error: errorMsg, details: result },
        { status: cloudinaryRes.status },
      );
    }

    return NextResponse.json({
      success: true,
      url: result.secure_url || result.url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Lỗi xử lý tải ảnh: ${message}` },
      { status: 500 },
    );
  }
}
