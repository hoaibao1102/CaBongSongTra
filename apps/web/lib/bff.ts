import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
type Config = {
  apiUrl?: string;
  webOrigin?: string;
  timeoutMs?: number;
  sharedSecret?: string;
};
const routes: [RegExp, string[]][] = [
  [/^owner\/products$/, ["GET"]],
  [/^products(?:\/CBST-(?:300|400|600))?$/, ["GET", "PATCH"]],
  [/^auth\/(?:login|logout|reset-password)$/, ["POST"]],
  [/^auth\/me$/, ["GET"]],
  [/^checkout\/orders$/, ["POST"]],
  [/^orders$/, ["GET", "POST"]],
  [/^orders\/[0-9a-f-]{36}$/, ["GET", "PATCH"]],
  [
    /^orders\/[0-9a-f-]{36}\/(?:transitions|payments|refunds|finalize-costs|assignment|returns)$/,
    ["POST"],
  ],
  [/^inventory\/(?:receipts|adjustments)$/, ["POST"]],
  [/^inventory\/(?:batches|movements)$/, ["GET"]],
  [/^users$/, ["GET", "POST"]],
  [/^users\/[0-9a-f-]{36}$/, ["PATCH"]],
  [/^users\/[0-9a-f-]{36}\/password-reset$/, ["POST"]],
  [/^expenses$/, ["GET", "POST"]],
  [/^commissions(?:\/me)?$/, ["GET"]],
  [/^commissions\/payouts$/, ["POST"]],
  [/^(?:audit-logs|dashboard\/overview|dashboard\/members\/me)$/, ["GET"]],
];
export async function proxy(
  request: Request,
  segments: string[],
  config: Config,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  let identityCookie: string | undefined;
  const fail = (status: number, code: string) =>
    Response.json(
      { error: { code } },
      {
        status,
        headers: {
          "cache-control": "no-store",
          ...(identityCookie ? { "set-cookie": identityCookie } : {}),
        },
      },
    );
  let base: URL, origin: URL;
  try {
    base = new URL(config.apiUrl!);
    origin = new URL(config.webOrigin!);
    if (
      !/^https?:$/.test(base.protocol) ||
      !/^https?:$/.test(origin.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname.replace(/\/$/, "") !== "/api/v1" ||
      config.webOrigin !== origin.origin ||
      !config.sharedSecret ||
      config.sharedSecret.length < 32
    )
      throw new Error();
  } catch {
    return fail(503, "API_NOT_CONFIGURED");
  }
  const path = segments.slice(1).join("/");
  if (
    segments[0] !== "v1" ||
    segments.some((part) => !/^[A-Za-z0-9-]+$/.test(part))
  )
    return fail(404, "NOT_FOUND");
  const route = routes.find(([pattern]) => pattern.test(path));
  if (!route) return fail(404, "NOT_FOUND");
  if (
    !route[1].includes(request.method) ||
    (request.method === "PATCH" && path === "products")
  )
    return fail(405, "METHOD_NOT_ALLOWED");
  const url = new URL(request.url);
  for (const [key, value] of url.searchParams) {
    if (
      !(
        (key === "page" && /^\d{1,6}$/.test(value)) ||
        (key === "limit" && /^(?:[1-9]|[1-9]\d|100)$/.test(value))
      ) ||
      url.searchParams.getAll(key).length !== 1
    )
      return fail(400, "INVALID_QUERY");
  }
  const mutation = request.method !== "GET";
  if (
    mutation &&
    (request.headers.get("origin") !== origin.origin ||
      request.headers.get("sec-fetch-site") === "cross-site")
  )
    return fail(403, "ORIGIN_REJECTED");
  if (
    mutation &&
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
      "application/json"
  )
    return fail(415, "JSON_REQUIRED");
  const headers = new Headers({ accept: "application/json" });
  for (const name of ["idempotency-key", "x-guest-session"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const session = request.headers
    .get("cookie")
    ?.split(";")
    .map((value) => value.trim())
    .find((value) => /^cbst_session=[A-Za-z0-9_-]+$/.test(value));
  if (session) headers.set("cookie", session);
  if (mutation) {
    headers.set("origin", origin.origin);
    headers.set("content-type", "application/json");
  }
  let body: string | undefined;
  if (mutation) {
    try {
      if (Number(request.headers.get("content-length")) > 65536)
        return fail(413, "BODY_TOO_LARGE");
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 65536) {
            await reader.cancel();
            return fail(413, "BODY_TOO_LARGE");
          }
          chunks.push(value);
        }
      }
      body = new TextDecoder().decode(Buffer.concat(chunks));
      try {
        JSON.parse(body);
      } catch {
        return fail(400, "INVALID_JSON");
      }
    } catch {
      return fail(400, "INVALID_BODY");
    }
  }
  const signCookie = (client: string) =>
    createHmac("sha256", config.sharedSecret!)
      .update(`cbst-client-cookie:v1:${client}`)
      .digest("hex");
  const candidates = (request.headers.get("cookie") ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter((value) => value.startsWith("__Host-cbst_client="));
  const parts =
    candidates.length === 1
      ? /^__Host-cbst_client=([A-Za-z0-9_-]{43})\.([a-f0-9]{64})$/.exec(
          candidates[0],
        )
      : null;
  const valid =
    parts &&
    timingSafeEqual(
      Buffer.from(parts[2], "hex"),
      Buffer.from(signCookie(parts[1]), "hex"),
    );
  const client = valid ? parts![1] : randomBytes(32).toString("base64url");
  if (!valid)
    identityCookie = `__Host-cbst_client=${client}.${signCookie(client)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  headers.set("X-CBST-Client", client);
  headers.set("X-CBST-Timestamp", timestamp);
  headers.set(
    "X-CBST-Signature",
    createHmac("sha256", config.sharedSecret!)
      .update(`${timestamp}:${client}`)
      .digest("hex"),
  );
  const controller = new AbortController();
  const timeout = new Promise<never>((_resolve, reject) =>
    controller.signal.addEventListener(
      "abort",
      () => reject(new Error("UPSTREAM_TIMEOUT")),
      { once: true },
    ),
  );
  const timer = setTimeout(() => controller.abort(), config.timeoutMs ?? 10000);
  try {
    const upstream = await Promise.race([
      fetcher(`${base.href.replace(/\/$/, "")}/${path}${url.search}`, {
        method: request.method,
        headers,
        body,
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      }),
      timeout,
    ]);
    if (upstream.status >= 300 && upstream.status < 400)
      return fail(502, "UPSTREAM_ERROR");
    const output = new Headers({
      "cache-control": "no-store",
      "content-type": "application/json",
      "x-content-type-options": "nosniff",
    });
    if (identityCookie) output.append("set-cookie", identityCookie);
    for (const name of ["x-request-id", "retry-after"]) {
      const value = upstream.headers.get(name);
      if (value) output.set(name, value);
    }
    const cookies = upstream.headers.getSetCookie();
    for (const cookie of cookies)
      if (cookie.startsWith("cbst_session="))
        output.append("set-cookie", cookie);
    const data = await Promise.race([upstream.json(), timeout]);
    if (!upstream.ok) {
      const code =
        typeof data?.error?.code === "string" &&
        /^[A-Z0-9_]{1,100}$/.test(data.error.code)
          ? data.error.code
          : "REQUEST_REJECTED";
      if (
        upstream.status >= 500 &&
        !(
          upstream.status === 503 &&
          code === "CHECKOUT_DISABLED_PENDING_TRANSACTION_VERIFICATION"
        )
      )
        return fail(502, "UPSTREAM_ERROR");
      return Response.json(
        { error: { code, requestId: output.get("x-request-id") ?? undefined } },
        { status: upstream.status, headers: output },
      );
    }
    return Response.json(data, { status: upstream.status, headers: output });
  } catch {
    return fail(
      controller.signal.aborted ? 504 : 502,
      controller.signal.aborted ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR",
    );
  } finally {
    clearTimeout(timer);
  }
}
