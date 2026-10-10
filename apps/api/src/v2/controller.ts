import { Body, Controller, ForbiddenException, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res, UnauthorizedException } from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "../auth/auth.service";
import { CommerceService } from "./service";
import { MongoRepository } from "./repository";
import { AdjustmentDto, CheckoutDto, CostsDto, CreateUserDto, ExpenseDto, LoginDto, PageDto, PaymentDto, PayoutDto, ProductDto, ReceiptDto, RefundDto, TransitionDto, UserStatusDto } from "./dto";
import { Owner, Public, requestKey, type ApiRequest } from "./http";
import { AssignOrderDto, CreateProductDto, EditOrderDto, ResetPasswordDto, ReturnDto } from "./dto";
import { PasswordResetService } from "./password-reset";
import { ApiBody, ApiCookieAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
const cookie = { httpOnly: true, secure: true, sameSite: "strict" as const, path: "/api/v1" };
const pagination = (query: PageDto) => ({ page: Math.max(0, Number(query.page ?? 0)), limit: Number(query.limit ?? 25) });
@Controller()
@ApiTags("commerce")
@ApiCookieAuth("cbst_session")
export class CommerceController {
  constructor(private readonly service: CommerceService, private readonly auth: AuthService, private readonly db: MongoRepository, private readonly resets: PasswordResetService) {}
  @Owner() @Post("users/:id/password-reset") @ApiOperation({ summary: "Issue a 15-minute single-use reset token; securely deliver out of band" })
  issueReset(@Req() req: ApiRequest, @Param("id", new ParseUUIDPipe()) id: string) { return this.resets.issue(req.actor, id, req.requestId); }
  @Public() @Post("auth/reset-password") @ApiBody({ type: ResetPasswordDto })
  resetPassword(@Req() req: ApiRequest, @Body() dto: ResetPasswordDto) { return this.resets.consume(dto, req.requestId); }
  @Owner() @Post("orders/:id/assignment") @ApiBody({ type: AssignOrderDto }) @ApiHeader({ name: "Idempotency-Key", required: true })
  assignOrder(@Req() req: ApiRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: AssignOrderDto) { return this.service.assignOrder(req.actor, id, dto, requestKey(req), req.requestId); }
  @Patch("orders/:id") @ApiBody({ type: EditOrderDto }) @ApiHeader({ name: "Idempotency-Key", required: true })
  editOrder(@Req() req: ApiRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: EditOrderDto) { return this.service.editOrder(req.actor, id, dto, requestKey(req), req.requestId); }
  @Owner() @Post("orders/:id/returns") @ApiBody({ type: ReturnDto }) @ApiHeader({ name: "Idempotency-Key", required: true })
  receiveReturn(@Req() req: ApiRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: ReturnDto) { return this.service.receiveReturn(req.actor, id, dto, requestKey(req), req.requestId); }
  @Public() @Get("products") products() { return this.service.products(); }
  @Owner() @Get("owner/products") @ApiOperation({ summary: "Owner catalog including inactive products and optimistic versions" })
  ownerProducts(@Req() req: ApiRequest) { return this.service.ownerProducts(req.actor); }
  @Owner() @Post("products") @ApiBody({ type: CreateProductDto }) @ApiHeader({ name: "Idempotency-Key", required: true })
  createProduct(@Req() req: ApiRequest, @Body() dto: CreateProductDto) { return this.service.createProduct(req.actor, dto, requestKey(req), req.requestId); }
  @Public() @Get("products/:sku") product(@Param("sku") sku: string) { return this.service.product(sku); }
  @Owner() @Patch("products/:sku") updateProduct(@Req() req: ApiRequest, @Param("sku") sku: string, @Body() dto: ProductDto) { return this.service.updateProduct(req.actor, sku, dto, requestKey(req), req.requestId); }
  @Public() @Post("auth/login") async login(@Body() dto: LoginDto, @Req() req: ApiRequest, @Res({ passthrough: true }) res: Response) {
    try {
      const result = await this.auth.login(dto.email, dto.password);
      if (typeof req.cookies?.cbst_session === "string") await this.auth.logout(req.cookies.cbst_session);
      res.cookie("cbst_session", result.token, { ...cookie, maxAge: 12 * 60 * 60 * 1000 }); return result.profile;
    } catch (error) { if (error instanceof Error && error.message === "OWNER_MFA_REQUIRED") throw new ForbiddenException("OWNER_MFA_REQUIRED"); if (error instanceof Error && error.message === "INVALID_CREDENTIALS") throw new UnauthorizedException("INVALID_CREDENTIALS"); throw error; }
  }
  @Post("auth/logout") async logout(@Req() req: ApiRequest, @Res({ passthrough: true }) res: Response) { await this.auth.logout(req.cookies.cbst_session); res.clearCookie("cbst_session", cookie); return { ok: true }; }
  @Get("auth/me") me(@Req() req: ApiRequest) { return req.actor; }
  @Public() @Post("checkout/orders") checkout(@Req() req: ApiRequest, @Body() dto: CheckoutDto) { return this.service.checkout(null, req.guestScope, dto, requestKey(req), req.requestId); }
  @Post("orders") createOrder(@Req() req: ApiRequest, @Body() dto: CheckoutDto) { return this.service.checkout(req.actor, "", dto, requestKey(req), req.requestId); }
  @Get("orders") orders(@Req() req: ApiRequest, @Query() query: PageDto) { const { page, limit } = pagination(query); return this.service.listOrders(req.actor, page, limit); }
  @Get("orders/:id") order(@Req() req: ApiRequest, @Param("id", new ParseUUIDPipe()) id: string) { return this.service.getOrder(req.actor, id); }
  @Post("orders/:id/transitions") transition(@Req() req: ApiRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: TransitionDto) { return this.service.transition(req.actor, id, dto, requestKey(req), req.requestId); }
  @Post("orders/:id/payments") payment(@Req() req: ApiRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: PaymentDto) { return this.service.payment(req.actor, id, dto, requestKey(req), req.requestId); }
  @Owner() @Post("orders/:id/refunds") refund(@Req() req: ApiRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: RefundDto) { return this.service.payment(req.actor, id, dto, requestKey(req), req.requestId, true); }
  @Owner() @Post("orders/:id/finalize-costs") costs(@Req() req: ApiRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: CostsDto) { return this.service.finalizeCosts(req.actor, id, dto.expectedVersion, requestKey(req), req.requestId); }
  @Owner() @Post("inventory/receipts") receipt(@Req() req: ApiRequest, @Body() dto: ReceiptDto) { return this.service.receipt(req.actor, dto, requestKey(req), req.requestId); }
  @Owner() @Post("inventory/adjustments") adjustment(@Req() req: ApiRequest, @Body() dto: AdjustmentDto) { return this.service.adjustment(req.actor, dto, requestKey(req), req.requestId); }
  @Owner() @Get("inventory/batches") batches(@Query() query: PageDto) { const { page, limit } = pagination(query); return this.db.batches.find({}, { _id: 0, id: 1, sku: 1, lotCode: 1, receivedAt: 1, expiresAt: 1, onHand: 1, reserved: 1, landedUnitCostVnd: 1, status: 1 }).sort({ receivedAt: -1, id: 1 }).skip(page * limit).limit(limit).lean(); }
  @Owner() @Get("inventory/movements") movements(@Query() query: PageDto) { const { page, limit } = pagination(query); return this.db.movements.find({}, { _id: 0, id: 1, batchId: 1, sku: 1, orderId: 1, type: 1, qtyDelta: 1, reservedDelta: 1, actorId: 1, createdAt: 1 }).sort({ createdAt: -1, id: 1 }).skip(page * limit).limit(limit).lean(); }
  @Owner() @Get("users") users(@Query() query: PageDto) { const { page, limit } = pagination(query); return this.db.users.find({}, { _id: 0, id: 1, displayName: 1, emailNormalized: 1, role: 1, status: 1 }).sort({ id: 1 }).skip(page * limit).limit(limit).lean(); }
  @Owner() @Post("users") createUser(@Req() req: ApiRequest, @Body() dto: CreateUserDto) { return this.service.createUser(req.actor, dto, requestKey(req), req.requestId); }
  @Owner() @Patch("users/:id") userStatus(@Req() req: ApiRequest, @Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UserStatusDto) { return this.service.userStatus(req.actor, id, dto.status, requestKey(req), req.requestId); }
  @Owner() @Post("expenses") expense(@Req() req: ApiRequest, @Body() dto: ExpenseDto) { return this.service.expense(req.actor, dto, requestKey(req), req.requestId); }
  @Owner() @Get("expenses") expenses(@Query() query: PageDto) { const { page, limit } = pagination(query); return this.db.ledger.find({ kind: "EXPENSE" }, { _id: 0, id: 1, orderId: 1, amountVnd: 1, scope: 1, category: 1, reason: 1, createdAt: 1, actorId: 1 }).sort({ createdAt: -1, id: 1 }).skip(page * limit).limit(limit).lean(); }
  @Get("commissions/me") commissionsMe(@Req() req: ApiRequest, @Query() query: PageDto) { const { page, limit } = pagination(query); return this.db.ledger.find({ memberId: req.actor.id, kind: { $in: ["COMMISSION", "PAYOUT"] } }, { _id: 0, id: 1, orderId: 1, kind: 1, amountVnd: 1, createdAt: 1 }).sort({ createdAt: -1, id: 1 }).skip(page * limit).limit(limit).lean(); }
  @Owner() @Get("commissions") commissions(@Query() query: PageDto) { const { page, limit } = pagination(query); return this.db.ledger.find({ kind: { $in: ["COMMISSION", "PAYOUT"] } }, { _id: 0, id: 1, memberId: 1, orderId: 1, kind: 1, amountVnd: 1, createdAt: 1 }).sort({ createdAt: -1, id: 1 }).skip(page * limit).limit(limit).lean(); }
  @Owner() @Post("commissions/payouts") payout(@Req() req: ApiRequest, @Body() dto: PayoutDto) { return this.service.payout(req.actor, dto.memberId, dto.reference, requestKey(req), req.requestId); }
  @Owner() @Get("audit-logs") audit(@Query() query: PageDto) { const { page, limit } = pagination(query); return this.db.audit.find({}, { _id: 0, id: 1, actorId: 1, action: 1, entityId: 1, requestId: 1, from: 1, to: 1, createdAt: 1 }).sort({ createdAt: -1, id: 1 }).skip(page * limit).limit(limit).lean(); }
  @Owner() @Get("dashboard/overview") dashboard(@Req() req: ApiRequest) { return this.service.dashboard(req.actor); }
  @Get("dashboard/members/me") memberDashboard(@Req() req: ApiRequest) { return this.service.dashboard({ ...req.actor, role: "MEMBER" }); }
}
