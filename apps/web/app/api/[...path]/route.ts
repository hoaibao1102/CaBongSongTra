import { proxy } from "../../../lib/bff";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handler(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxy(request, (await context.params).path, {
    apiUrl: process.env.API_INTERNAL_URL,
    webOrigin: process.env.WEB_ORIGIN,
    sharedSecret: process.env.BFF_SHARED_SECRET,
  });
}
export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
