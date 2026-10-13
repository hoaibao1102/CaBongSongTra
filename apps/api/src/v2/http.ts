import { ArgumentsHost, BadRequestException, CanActivate, Catch, ExceptionFilter, ExecutionContext, ForbiddenException, HttpException, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { AuthService } from "../auth/auth.service";
import { MongoRepository } from "./repository";
import type { Actor } from "./policy";
export type ApiRequest = Request & { actor: Actor; requestId: string; guestScope: string };
export const Public = () => SetMetadata("public", true);
export const Owner = () => SetMetadata("owner", true);
function safeQuote(value: unknown) {
  if (!value || typeof value !== "object") return;
  const raw = value as Record<string, unknown>;
  const wire = "mode" in raw;
  const q: Record<string, unknown> = { ...raw, pricingMode: wire ? raw.mode : raw.pricingMode, totalVnd: wire ? raw.orderTotalVnd : raw.totalVnd };
  const money = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
  if (typeof q.pricingFingerprint !== "string" || !/^[A-Za-z0-9:_-]{1,256}$/.test(q.pricingFingerprint) ||
    typeof q.pricingMode !== "string" || !["BASE_PRICE", "PUBLIC_PROMOTIONS", "INTERNAL_VOUCHER"].includes(q.pricingMode) ||
    (q.pricedAt !== undefined && (typeof q.pricedAt !== "string" || !Number.isFinite(Date.parse(q.pricedAt)))) ||
    !money(q.merchandiseSubtotalVnd) || !money(q.discountVnd) || !money(q.totalVnd) ||
    q.merchandiseSubtotalVnd - q.discountVnd !== q.totalVnd ||
    !Array.isArray(q.items) || !q.items.length || q.items.length > 100) return;
  const items = [];
  for (const value of q.items) {
    if (!value || typeof value !== "object") return;
    const i = value as Record<string, unknown>;
    if (typeof i.sku !== "string" || !/^CBST-[A-Z0-9-]+$/.test(i.sku) ||
      !money(i.qty) || i.qty < 1 || i.qty > 100 ||
      !money(i.retailUnitPriceVnd) || !money(i.grossLineTotalVnd) || !money(i.lineDiscountVnd) || !money(i.finalLineTotalVnd) ||
      typeof i.unitPriceVnd !== "number" || !Number.isFinite(i.unitPriceVnd) || i.unitPriceVnd < 0 || i.unitPriceVnd > Number.MAX_SAFE_INTEGER ||
      i.grossLineTotalVnd - i.lineDiscountVnd !== i.finalLineTotalVnd ||
      typeof i.discountSourceType !== "string" || !["NONE", "PROMOTION", "VOUCHER"].includes(i.discountSourceType)) return;
    items.push({ sku: i.sku, qty: i.qty, retailUnitPriceVnd: i.retailUnitPriceVnd, unitPriceVnd: i.unitPriceVnd,
      grossLineTotalVnd: i.grossLineTotalVnd, lineDiscountVnd: i.lineDiscountVnd, finalLineTotalVnd: i.finalLineTotalVnd,
      discountSourceType: i.discountSourceType });
  }
  if (new Set(items.map(i => i.sku)).size !== items.length ||
    items.reduce((sum, i) => sum + i.grossLineTotalVnd, 0) !== q.merchandiseSubtotalVnd ||
    items.reduce((sum, i) => sum + i.lineDiscountVnd, 0) !== q.discountVnd) return;
  return { pricingFingerprint: q.pricingFingerprint,
    ...(wire ? { mode: q.pricingMode, orderTotalVnd: q.totalVnd } : { pricingMode: q.pricingMode, totalVnd: q.totalVnd }),
    ...(q.pricedAt === undefined ? {} : { pricedAt: q.pricedAt }),
    merchandiseSubtotalVnd: q.merchandiseSubtotalVnd, discountVnd: q.discountVnd, items };
}
export function clientIdentity(request: Request, now = Date.now()) {
  const client = request.get("X-CBST-Client"), timestamp = request.get("X-CBST-Timestamp"), signature = request.get("X-CBST-Signature");
  if (client === undefined && timestamp === undefined && signature === undefined) return `ip:${request.ip ?? request.socket?.remoteAddress ?? "unknown"}`;
  const secret = process.env.BFF_SHARED_SECRET;
  if (!secret || secret.length < 32 || !client || !/^[A-Za-z0-9._:-]{1,128}$/.test(client) || !timestamp || !/^\d{10}$/.test(timestamp) || Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 60 || !signature || !/^[a-f0-9]{64}$/.test(signature)) throw new ForbiddenException("BFF_IDENTITY_INVALID");
  const expected = createHmac("sha256", secret).update(`${timestamp}:${client}`).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new ForbiddenException("BFF_IDENTITY_INVALID");
  return `bff:${client}`;
}
export function requestKey(request: Request) {
  const key = request.get("Idempotency-Key");
  if (!key || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) throw new BadRequestException("INVALID_IDEMPOTENCY_KEY");
  return key;
}
@Injectable()
export class ApiGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService, private readonly db: MongoRepository) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    request.requestId = randomUUID();
    context.switchToHttp().getResponse<Response>().setHeader("X-Request-Id", request.requestId);
    context.switchToHttp().getResponse<Response>().setHeader("Cache-Control", "no-store");
    const publicRoute = this.reflector.getAllAndOverride<boolean>("public", [context.getHandler(), context.getClass()]);
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      const reqOrigin = request.get("Origin")?.trim().replace(/\/+$/, "");
      const allowed = (process.env.CORS_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map(value => value.trim().replace(/\/+$/, ""))
        .filter(Boolean);
      if (!reqOrigin || (!allowed.includes(reqOrigin) && !allowed.includes("*")))
        throw new ForbiddenException("ORIGIN_REJECTED");
      if (!request.is("application/json")) throw new BadRequestException("JSON_REQUIRED");
    }
    if (publicRoute) {
      if (request.method === "POST") {
        const hash = (value: string) => createHmac("sha256", process.env.SESSION_SECRET!).update(value).digest("hex");
        // Do not trust forwarded headers unless the deployment explicitly configures a trusted proxy.
        const ip = clientIdentity(request);
        const bucket = Math.floor(Date.now() / 60000);
        const route = request.path;
        const subjects = [hash(ip)];
        if (route.endsWith("/auth/login") && typeof request.body?.email === "string") subjects.push(hash(request.body.email.trim().toLowerCase()));
        if (route.endsWith("/auth/reset-password") && typeof request.body?.token === "string") subjects.push(hash(request.body.token));
        for (const subject of subjects) {
          const result = await this.db.rates.findOneAndUpdate({ key: `${route}:${subject}:${bucket}` }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 60000) } }, { upsert: true, new: true }).lean();
          if (!result || result.count > (route.endsWith("/auth/login") ? 10 : 20)) throw new HttpException("RATE_LIMITED", 429);
        }
        const guest = request.get("X-Guest-Session");
        if (route.endsWith("/checkout/orders") && (!guest || !/^[A-Za-z0-9_-]{32,128}$/.test(guest))) throw new BadRequestException("GUEST_SESSION_REQUIRED");
        request.guestScope = `guest:${hash(guest ?? ip)}`;
      }
      return true;
    }
    const token: unknown = request.cookies?.cbst_session;
    if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new UnauthorizedException("SESSION_INVALID");
    try { request.actor = await this.auth.authenticate(token); } catch (error) {
      if (error instanceof Error && error.message === "OWNER_MFA_REQUIRED") throw new ForbiddenException("OWNER_MFA_REQUIRED");
      if (error instanceof Error && error.message === "SESSION_INVALID") throw new UnauthorizedException("SESSION_INVALID");
      throw error;
    }
    if (this.reflector.getAllAndOverride<boolean>("owner", [context.getHandler(), context.getClass()]) && request.actor.role !== "OWNER_ADMIN") throw new ForbiddenException("OWNER_REQUIRED");
    return true;
  }
}
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<ApiRequest>();
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const body = error instanceof HttpException ? error.getResponse() : undefined;
    const message = typeof body === "string" ? body : body && typeof body === "object" ? "code" in body ? body.code : "message" in body ? body.message : undefined : undefined;
    const code = status < 500 && typeof message === "string" && /^[A-Z][A-Z0-9_]{2,100}$/.test(message) ? message : status === 400 ? "VALIDATION_FAILED" : status >= 500 ? "INTERNAL_ERROR" : "REQUEST_REJECTED";
    const quote = status === 409 && code === "PRICE_STALE_CONFIRMATION_REQUIRED" && body && typeof body === "object" && "quote" in body ? safeQuote(body.quote) : undefined;
    response.status(status).json({ error: { code, message: status === 500 ? "Request could not be completed" : code, requestId: request.requestId ?? randomUUID(), details: [], ...(quote ? { quote } : {}) } });
  }
}
