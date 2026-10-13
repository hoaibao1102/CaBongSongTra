import { proxy } from "../../../lib/bff";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const reqOrigin = new URL(request.url).origin.replace(/\/+$/, "");
  const originHeader = request.headers.get("origin")?.trim().replace(/\/+$/, "");
  const configuredOrigin = process.env.WEB_ORIGIN?.trim().replace(/\/+$/, "");
  const webOrigin =
    originHeader && originHeader === reqOrigin
      ? reqOrigin
      : (configuredOrigin || reqOrigin);
  return proxy(request, (await context.params).path, {
    apiUrl: process.env.API_INTERNAL_URL,
    webOrigin,
    sharedSecret: process.env.BFF_SHARED_SECRET,
  });
}
export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
