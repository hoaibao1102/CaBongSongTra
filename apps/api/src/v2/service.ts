import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import type { ClientSession } from "mongoose";
import { hashPassword } from "../auth/password";
import { MongoRepository } from "./repository";
import { computePricing, returnCredit, safeQuote } from "./pricing";
import { DiscountsService } from "./discounts";
import { commissionTarget, orderProjection, orderScope, paymentDue, type Actor } from "./policy";
import type { AdjustmentDto, CheckoutDto, CreateUserDto, ExpenseDto, PaymentDto, ProductDto, ReceiptDto, RefundDto, TransitionDto, CreatePurchaseReceiptDto, UpdateCommissionRateDto, UpdateBankInfoDto, CreateKpiPolicyDto, CreateKpiPeriodDto, SettleKpiPeriodDto } from "./dto";
import type { Batch, Ledger, Order, Product, PurchaseReceipt, PurchaseReceiptItem, KpiPolicy, KpiPeriod, KpiAward, KpiTier } from "./models";
import type { InternalCheckoutDto, InternalQuoteDto, PublicQuoteDto } from "./dto";
import type { AssignOrderDto, CreateProductDto, EditOrderDto, ReturnDto } from "./dto";

export function allocateReceiptShipping<T extends { sku: string; qty: number; purchasePriceVnd: number }>(
  items: T[],
  shippingFeeVnd: number,
) {
  const lineTotals = items.map(item => item.qty * item.purchasePriceVnd);
  const subtotalVnd = lineTotals.reduce((sum, val) => sum + val, 0);
  if (subtotalVnd === 0 || shippingFeeVnd === 0) {
    return items.map((item, idx) => ({
      ...item,
      lineTotalVnd: lineTotals[idx],
      allocatedShippingVnd: 0,
      landedUnitCostVnd: item.purchasePriceVnd,
    }));
  }
  let allocatedSum = 0;
  const allocations = lineTotals.map(lineTotal => {
    const share = Math.floor((shippingFeeVnd * lineTotal) / subtotalVnd);
    allocatedSum += share;
    return share;
  });
  const remainder = shippingFeeVnd - allocatedSum;
  let maxIdx = 0;
  let maxVal = lineTotals[0];
  for (let i = 1; i < lineTotals.length; i++) {
    if (lineTotals[i] > maxVal) {
      maxVal = lineTotals[i];
      maxIdx = i;
    }
  }
  allocations[maxIdx] += remainder;
  return items.map((item, idx) => {
    const allocatedShippingVnd = allocations[idx];
    const unitShipping = Math.floor(allocatedShippingVnd / item.qty);
    const landedUnitCostVnd = item.purchasePriceVnd + unitShipping;
    return {
      ...item,
      lineTotalVnd: lineTotals[idx],
      allocatedShippingVnd,
      landedUnitCostVnd,
    };
  });
}

@Injectable()
export class CommerceService {
  readonly discounts: DiscountsService;
  constructor(private readonly db: MongoRepository) { this.discounts = new DiscountsService(db); }
  private async computeQuote(actor: Actor | null, dto: { items: Array<{ sku: string; qty: number }>; voucherCode?: string; customerPhone?: string }, session?: ClientSession) {
    if (dto.voucherCode !== undefined && !actor) throw new ForbiddenException("AUTH_REQUIRED");
    const now = new Date();
    const products = [];
    for (const item of dto.items) {
      const product = await this.db.products.findOne({ sku: item.sku, active: true }).session(session ?? null).lean();
      if (!product) throw new BadRequestException("PRODUCT_UNAVAILABLE");
      products.push(product);
    }
    const promotions = await this.db.promotions.find({ sku: { $in: dto.items.map(item => item.sku) }, active: true, deletedAt: { $exists: false }, startAt: { $lte: now }, endAt: { $gt: now } }).session(session ?? null).lean();
    const base = computePricing(dto.items, products, [], undefined, now);
    const voucher = dto.voucherCode === undefined ? undefined : await this.discounts.verifyVoucher(actor, { code: dto.voucherCode, customerPhone: dto.customerPhone ?? "", subtotalVnd: base.merchandiseSubtotalVnd, now }, session);
    return computePricing(dto.items, products, promotions, voucher, now);
  }
  async quote(actor: Actor | null, dto: PublicQuoteDto | InternalQuoteDto, session?: ClientSession) {
    return safeQuote(await this.computeQuote(actor, dto, session));
  }
  private owner(actor: Actor) { if (actor.role !== "OWNER_ADMIN") throw new ForbiddenException("OWNER_REQUIRED"); }
  private version(order: Order, expected: number) { if (order.version !== expected) throw new ConflictException("VERSION_CONFLICT"); }
  private async audit(actor: Actor, action: string, entityId: string, requestId: string, session: ClientSession, from?: string, to?: string) {
    await this.db.audit.create([{ id: randomUUID(), actorId: actor.id, action, entityId, requestId, from, to, createdAt: new Date() }], { session });
  }
  private async entry(actor: Actor, entry: Omit<Ledger, "id" | "actorId" | "createdAt">, session: ClientSession) {
    const value = { ...entry, id: randomUUID(), actorId: actor.id, createdAt: new Date() };
    await this.db.ledger.create([value], { session }); return value;
  }
  private async reconcile(order: Order, actor: Actor, session: ClientSession) {
    const target = commissionTarget(order);
    const delta = target - order.commissionVnd;
    if (delta && order.responsibleMemberId) {
      await this.entry(actor, { kind: "COMMISSION", orderId: order.id, memberId: order.responsibleMemberId, amountVnd: delta }, session);
      // Every accrual/clawback and payout writes the same member balance document,
      // forcing concurrent payout/refund transactions to conflict rather than overspend.
      await this.db.balances.updateOne({ memberId: order.responsibleMemberId }, { $inc: { balanceVnd: delta } }, { session, upsert: true });
    }
    order.commissionVnd = target;
  }
  async products() {
    const products = await this.db.products.find({ active: true }).sort({ netWeightG: 1 }).lean();
    return this.catalogPrices(products);
  }
  private async catalogPrices(products: Product[]) {
    const now = new Date();
    const promotions = await this.db.promotions.find({ sku: { $in: products.map(product => product.sku) }, active: true, deletedAt: { $exists: false }, startAt: { $lte: now }, endAt: { $gt: now } }).lean();
    return products.map(product => {
      const item = computePricing([{ sku: product.sku, qty: 1 }], [product], promotions, undefined, now).items[0];
      const promotion = promotions.find(value => value.id === item.discountSourceId);
      return { sku: product.sku, name: product.name, netWeightG: product.netWeightG, retailPriceVnd: product.retailPriceVnd, effectivePriceVnd: item.finalLineTotalVnd,
        ...(promotion ? { promotionLabel: promotion.name, promotionEndsAt: promotion.endAt } : {}) };
    });
  }
  async ownerProducts(actor: Actor) {
    this.owner(actor);
    return this.db.products.find({}, { _id: 0, id: 1, sku: 1, name: 1, netWeightG: 1, retailPriceVnd: 1, active: 1, version: 1 }).sort({ netWeightG: 1 }).lean();
  }
  async createProduct(actor: Actor, dto: CreateProductDto, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:create-product`, key, dto, async session => {
      if (typeof this.db.products.findOne === "function") {
        const existing = await this.db.products.findOne({ sku: dto.sku }).session(session);
        if (existing) throw new ConflictException("PRODUCT_ALREADY_EXISTS");
      }
      const weightMatch = dto.sku.match(/\d+/);
      const netWeightG = weightMatch ? parseInt(weightMatch[0], 10) : 0;
      const product = { id: randomUUID(), sku: dto.sku, name: dto.name.trim(), netWeightG, retailPriceVnd: dto.retailPriceVnd, active: dto.active, version: 0 };
      await this.db.products.create([product], { session });
      await this.audit(actor, "PRODUCT_CREATED", product.id, requestId, session);
      return product;
    });
  }
  async product(sku: string) {
    const product = await this.db.products.findOne({ sku, active: true }).lean();
    if (!product) throw new NotFoundException("RESOURCE_NOT_FOUND"); return (await this.catalogPrices([product]))[0];
  }
  async updateProduct(actor: Actor, sku: string, dto: ProductDto, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:product:${sku}`, key, dto, async session => {
      const product = await this.db.products.findOneAndUpdate({ sku, version: dto.expectedVersion }, { $set: { retailPriceVnd: dto.retailPriceVnd, active: dto.active, ...(dto.name !== undefined ? { name: dto.name.trim() } : {}) }, $inc: { version: 1 } }, { session, new: true, runValidators: true, projection: { _id: 0, id: 1, sku: 1, name: 1, netWeightG: 1, retailPriceVnd: 1, active: 1, version: 1 } }).lean();
      if (!product) throw new ConflictException("VERSION_CONFLICT");
      await this.audit(actor, "PRODUCT_UPDATED", sku, requestId, session); return product;
    });
  }
  async checkout(actor: Actor | null, guestScope: string, dto: CheckoutDto | InternalCheckoutDto, key: string, requestId: string) {
    if (!actor && process.env.PUBLIC_CHECKOUT_ENABLED !== "true") throw new ServiceUnavailableException("CHECKOUT_DISABLED_PENDING_TRANSACTION_VERIFICATION");
    const effectiveActor: Actor = actor ?? { id: "guest", role: "MEMBER" };
    return this.db.idempotent(`${actor?.id ?? guestScope}:checkout`, key, dto, async session => {
      const quote = await this.computeQuote(actor, { items: dto.items, ...("voucherCode" in dto ? { voucherCode: dto.voucherCode } : {}), customerPhone: dto.customer.phone }, session);
      if (dto.clientExpectedTotalVnd !== quote.orderTotalVnd || dto.pricingFingerprint !== quote.pricingFingerprint) throw new ConflictException({ code: "PRICE_STALE_CONFIRMATION_REQUIRED", quote: safeQuote(quote) });
      const items = quote.items;
      for (const item of dto.items) {
        const stock = await this.db.batches.aggregate<{ available: number }>([{ $match: { sku: item.sku, status: "AVAILABLE", expiresAt: { $gt: new Date() } } }, { $group: { _id: null, available: { $sum: { $subtract: ["$onHand", "$reserved"] } } } }]).session(session);
        if ((stock[0]?.available ?? 0) < item.qty) throw new ConflictException("OUT_OF_STOCK");
      }
      const id = randomUUID();
      if (quote.voucherId && actor && "voucherCode" in dto) await this.discounts.reserveVoucher(actor, { orderId: id, code: dto.voucherCode!, customerPhone: dto.customer.phone, subtotalVnd: quote.merchandiseSubtotalVnd, now: quote.pricedAt }, session);
      const responsibleMember = actor?.role === "MEMBER"
        ? await this.db.users.findOne({ id: actor.id, role: "MEMBER", status: "ACTIVE" }).session(session).lean()
        : null;
      if (actor?.role === "MEMBER" && !responsibleMember) throw new BadRequestException("MEMBER_UNAVAILABLE");
      const order: Order = { id, orderCode: `CBST-${id}`, responsibleMemberId: actor?.role === "MEMBER" ? actor.id : null, status: "PENDING", version: 0,
        customer: { ...dto.customer, phone: dto.customer.phone.replace(/^0/, "+84") }, consentAt: new Date(), source: dto.source, notes: dto.notes, items, allocations: [],
        pricingSchemaVersion: 2, pricingMode: quote.mode, merchandiseSubtotalVnd: quote.merchandiseSubtotalVnd, discountVnd: quote.discountVnd, pricedAt: quote.pricedAt, ...(quote.voucherId ? { voucherId: quote.voucherId } : {}),
        totalVnd: quote.orderTotalVnd, receiptsVnd: 0, refundsVnd: 0, cogsVnd: 0, directCostsVnd: 0,
        costsFinalized: false, commissionRateBps: responsibleMember?.commissionRateBps ?? 0, commissionVnd: 0, createdAt: new Date() };
      await this.db.orders.create([order], { session });
      await this.audit(effectiveActor, "ORDER_CREATED", id, requestId, session);
      // Persist only the safe checkout receipt in the replay record, never customer PII.
      return { id, orderCode: order.orderCode, status: order.status, totalVnd: order.totalVnd, version: 0 };
    });
  }
  async listOrders(actor: Actor, page: number, limit: number) {
    const fields = "id orderCode responsibleMemberId status version customer items totalVnd receiptsVnd refundsVnd returnValueVnd returnRefundsVnd createdAt commissionVnd pricingSchemaVersion pricingMode merchandiseSubtotalVnd discountVnd pricedAt" + (actor.role === "OWNER_ADMIN" ? " cogsVnd directCostsVnd costsFinalized" : "");
    const orders = await this.db.orders.find(orderScope(actor)).select(fields).sort({ createdAt: -1, id: 1 }).skip(page * limit).limit(limit).lean();
    return orders.map(order => orderProjection(order, actor));
  }
  async getOrder(actor: Actor, id: string) { return orderProjection(await this.db.scopedOrder(id, orderScope(actor)), actor); }
  async assignOrder(actor: Actor, id: string, dto: AssignOrderDto, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:assign:${id}`, key, dto, async session => {
      const order = await this.db.scopedOrder(id, {}, session); this.version(order, dto.expectedVersion);
      if (!["PENDING", "CONFIRMED", "PACKING"].includes(order.status) || order.shippedAt || order.commissionVnd) throw new ConflictException("ORDER_LOCKED");
      const member = await this.db.users.findOne({ id: dto.memberId, role: "MEMBER", status: "ACTIVE" }).session(session).lean();
      if (!member) throw new BadRequestException("MEMBER_UNAVAILABLE");
      const from = order.responsibleMemberId ?? "OWNER_DIRECT";
      order.responsibleMemberId = member.id;
      order.commissionRateBps = member.commissionRateBps ?? 4000;
      await this.db.saveOrder(order, dto.expectedVersion, session);
      await this.audit(actor, "ORDER_ASSIGNED", id, requestId, session, from, member.id);
      return { id, responsibleMemberId: member.id, version: order.version };
    });
  }
  private async reserve(order: Order, actor: Actor, session: ClientSession, reason: string) {
    order.allocations = [];
    const now = new Date();
    for (const item of order.items) {
      const batches = await this.db.batches.find({ sku: item.sku, status: "AVAILABLE", expiresAt: { $gt: now }, $expr: { $gt: ["$onHand", "$reserved"] } }).sort({ expiresAt: 1, receivedAt: 1, id: 1 }).session(session).lean();
      let remaining = item.qty;
      for (const batch of batches) {
        if (!remaining) break;
        const qty = Math.min(remaining, batch.onHand - batch.reserved);
        await this.move(actor, batch, 0, qty, "RESERVE", session, reason, order.id, now);
        order.allocations.push({ batchId: batch.id, sku: item.sku, qty, landedUnitCostVnd: batch.landedUnitCostVnd, returnedQty: 0 }); remaining -= qty;
      }
      if (remaining) throw new ConflictException("OUT_OF_STOCK");
    }
    order.cogsVnd = order.allocations.reduce((sum, allocation) => sum + allocation.qty * allocation.landedUnitCostVnd, 0);
  }
  async editOrder(actor: Actor, id: string, dto: EditOrderDto, key: string, requestId: string) {
    await this.db.scopedOrder(id, orderScope(actor));
    return this.db.idempotent(`${actor.id}:edit:${id}`, key, dto, async session => {
      const order = await this.db.scopedOrder(id, orderScope(actor), session); this.version(order, dto.expectedVersion);
      if (order.pricingSchemaVersion === 2) throw new ConflictException("PRICED_ORDER_EDIT_REQUIRES_RECREATE");
      if (!["PENDING", "CONFIRMED", "PACKING"].includes(order.status) || order.shippedAt) throw new ConflictException("ORDER_LOCKED");
      const items: Order["items"] = [];
      for (const item of dto.items) {
        const existing = order.items.find(line => line.sku === item.sku);
        const product = existing ? null : await this.db.products.findOne({ sku: item.sku, active: true }).session(session).lean();
        if (!existing && !product) throw new BadRequestException("PRODUCT_UNAVAILABLE");
        items.push({ sku: item.sku, qty: item.qty, unitPriceVnd: existing?.unitPriceVnd ?? product!.retailPriceVnd });
      }
      const totalVnd = items.reduce((sum, item) => sum + item.qty * item.unitPriceVnd, 0);
      if (order.refundsVnd || totalVnd < order.receiptsVnd) throw new ConflictException("EDIT_REQUIRES_PAYMENT_RECONCILIATION");
      if (order.status !== "PENDING") {
        for (const allocation of order.allocations) {
          const batch = await this.db.batches.findOne({ id: allocation.batchId }).session(session).lean();
          if (!batch) throw new ConflictException("BATCH_MISSING");
          await this.move(actor, batch, 0, -allocation.qty, "RELEASE", session, dto.reason, id);
        }
      }
      order.items = items; order.totalVnd = totalVnd; order.costsFinalized = false;
      if (dto.customer) order.customer = { ...dto.customer, phone: dto.customer.phone.replace(/^0/, "+84") };
      if (order.status !== "PENDING") await this.reserve(order, actor, session, dto.reason);
      await this.db.saveOrder(order, dto.expectedVersion, session);
      await this.audit(actor, "ORDER_EDITED", id, requestId, session);
      return { id, version: order.version, totalVnd };
    });
  }
  async receiveReturn(actor: Actor, id: string, dto: ReturnDto, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:return:${id}`, key, dto, async session => {
      const order = await this.db.scopedOrder(id, {}, session); this.version(order, dto.expectedVersion);
      if (!order.shippedAt || !["RETURN_REQUESTED", "PARTIALLY_RETURNED", "RETURNED", "DELIVERY_FAILED"].includes(order.status)) throw new ConflictException("RETURN_NOT_ALLOWED");
      let credit = 0, recoveredCost = 0;
      for (const line of dto.lines) {
        const allocation = order.allocations.find(value => value.batchId === line.batchId);
        if (!allocation || line.qty > allocation.qty - (allocation.returnedQty ?? 0)) throw new ConflictException("RETURN_EXCEEDS_SHIPPED");
        const item = order.items.find(value => value.sku === allocation.sku);
        if (!item) throw new ConflictException("ALLOCATION_INVALID");
        if (line.disposition === "RESTOCK") {
          const batch = await this.db.batches.findOne({ id: line.batchId }).session(session).lean();
          if (!batch || !batch.labelReference || !batch.expiresAt || batch.expiresAt <= new Date() || batch.status !== "AVAILABLE") throw new ConflictException("BATCH_UNSAFE");
          await this.move(actor, batch, line.qty, 0, "RETURN_RESTOCK", session, dto.reason, id, new Date());
          recoveredCost += line.qty * allocation.landedUnitCostVnd;
        } else {
          await this.db.movements.create([{ id: randomUUID(), batchId: line.batchId, sku: allocation.sku, orderId: id, type: "RETURN_DISCARD", reason: dto.reason, qtyDelta: 0, reservedDelta: 0, actorId: actor.id, createdAt: new Date() }], { session });
        }
        const returnedBefore = order.allocations.filter(value => value.sku === item.sku).reduce((sum, value) => sum + (value.returnedQty ?? 0), 0);
        credit += returnCredit(order.pricingSchemaVersion, item, returnedBefore, line.qty);
        allocation.returnedQty = (allocation.returnedQty ?? 0) + line.qty;
      }
      // Reclassify only the overlap with prior goodwill, preserving the original cash entries.
      const overlap = Math.max(0, credit + (order.returnValueVnd ?? 0) + order.refundsVnd - (order.returnRefundsVnd ?? 0) - order.totalVnd);
      if (overlap) {
        order.returnRefundsVnd = (order.returnRefundsVnd ?? 0) + overlap;
        await this.entry(actor, { kind: "REFUND_RECLASSIFICATION", orderId: id, amountVnd: overlap, reason: dto.reason, reference: dto.inspectionReference }, session);
      }
      order.returnValueVnd = (order.returnValueVnd ?? 0) + credit;
      order.cogsVnd -= recoveredCost;
      if (order.cogsVnd < 0) throw new ConflictException("COGS_INVARIANT_BROKEN");
      order.status = order.allocations.every(value => value.returnedQty === value.qty) ? "RETURNED" : "PARTIALLY_RETURNED";
      await this.entry(actor, { kind: "RETURN_CREDIT", orderId: id, amountVnd: credit, reason: dto.reason, reference: dto.inspectionReference }, session);
      if (recoveredCost) await this.entry(actor, { kind: "COGS_REVERSAL", orderId: id, amountVnd: recoveredCost, reference: dto.inspectionReference }, session);
      await this.reconcile(order, actor, session); await this.db.saveOrder(order, dto.expectedVersion, session);
      await this.audit(actor, "RETURN_INSPECTED", id, requestId, session);
      return { id, status: order.status, version: order.version, returnValueVnd: order.returnValueVnd };
    });
  }
  async transition(actor: Actor, id: string, dto: TransitionDto, key: string, requestId: string) {
    // Scope is checked before replay too: cached responses must never bypass current ownership.
    await this.db.scopedOrder(id, orderScope(actor));
    return this.db.idempotent(`${actor.id}:transition:${id}`, key, dto, async session => {
      const order = await this.db.scopedOrder(id, orderScope(actor), session);
      this.version(order, dto.expectedVersion);
      const from = order.status;
      if (from === dto.status) return { id, status: order.status, version: order.version };
      const now = new Date();
      const wasShipped = !!order.shippedAt;
      const ship = ["SHIPPING", "DELIVERED", "DELIVERY_FAILED"].includes(dto.status) && !wasShipped;
      const needsReservation = ["CONFIRMED", "PACKING", "SHIPPING", "DELIVERED", "DELIVERY_FAILED"].includes(dto.status);
      if (needsReservation && !wasShipped && !["CONFIRMED", "PACKING"].includes(from)) {
        await this.reserve(order, actor, session, dto.reason);
        if (order.voucherId) await this.discounts.consumeVoucher({ ...order, status: "PENDING" }, session);
      }
      if (dto.status === "CANCELLED" && !order.shippedAt && order.voucherId) await this.discounts.releaseVoucher(order, session);
      const release = ["PENDING", "CANCELLED", "RETURN_REQUESTED", "PARTIALLY_RETURNED", "RETURNED"].includes(dto.status) && !wasShipped && ["CONFIRMED", "PACKING"].includes(from);
      if (ship || release) {
        for (const allocation of order.allocations) {
          const batch = await this.db.batches.findOne({ id: allocation.batchId }).session(session).lean();
          if (!batch) throw new ConflictException("BATCH_MISSING");
          const shipping = ship;
          if (shipping && (batch.status !== "AVAILABLE" || !batch.expiresAt || batch.expiresAt <= now)) throw new ConflictException("BATCH_UNSAFE");
          await this.move(actor, batch, shipping ? -allocation.qty : 0, -allocation.qty, shipping ? "STOCK_OUT" : "RELEASE", session, dto.reason, id, shipping ? now : undefined);
        }
        if (ship) order.shippedAt = now;
        if (release) { order.allocations = []; order.cogsVnd = 0; }
      }
      if (dto.status === "DELIVERED") order.deliveredAt = now;
      // Returns change workflow only. Physical return receipt requires an explicit inspected adjustment.
      order.status = dto.status;
      await this.reconcile(order, actor, session);
      await this.db.saveOrder(order, dto.expectedVersion, session);
      await this.audit(actor, "ORDER_TRANSITION", id, requestId, session, from, dto.status);
      return { id, status: order.status, version: order.version };
    });
  }
  private async move(actor: Actor, batch: Batch, qtyDelta: number, reservedDelta: number, type: string, session: ClientSession, reason: string, orderId?: string, safeAt?: Date) {
    const onHand = batch.onHand + qtyDelta, reserved = batch.reserved + reservedDelta;
    if (onHand < 0 || reserved < 0 || reserved > onHand) throw new ConflictException("INVENTORY_INVARIANT_BROKEN");
    const changed = await this.db.batches.updateOne({ id: batch.id, onHand: batch.onHand, reserved: batch.reserved, ...(safeAt ? { status: "AVAILABLE", expiresAt: { $gt: safeAt } } : {}) }, { $inc: { onHand: qtyDelta, reserved: reservedDelta } }, { session, runValidators: true });
    if (changed.modifiedCount !== 1) throw new ConflictException("INVENTORY_CONFLICT");
    await this.db.movements.create([{ id: randomUUID(), batchId: batch.id, sku: batch.sku, orderId, type, reason, qtyDelta, reservedDelta, actorId: actor.id, createdAt: new Date() }], { session });
  }
  async payment(actor: Actor, id: string, dto: PaymentDto | RefundDto, key: string, requestId: string, refund = false) {
    if (refund) this.owner(actor);
    await this.db.scopedOrder(id, orderScope(actor));
    return this.db.idempotent(`${actor.id}:${refund ? "refund" : "payment"}:${id}`, key, dto, async session => {
      const order = await this.db.scopedOrder(id, orderScope(actor), session);
      this.version(order, dto.expectedVersion);
      if (refund) {
        if (dto.amountVnd > order.receiptsVnd - order.refundsVnd) throw new ConflictException("REFUND_EXCEEDS_BALANCE");
        const linkedReturn = "purpose" in dto && dto.purpose === "RETURN";
        if (linkedReturn) {
          if (dto.amountVnd > (order.returnValueVnd ?? 0) - (order.returnRefundsVnd ?? 0)) throw new ConflictException("REFUND_EXCEEDS_RETURN_CREDIT");
          order.returnRefundsVnd = (order.returnRefundsVnd ?? 0) + dto.amountVnd;
        } else if (dto.amountVnd > order.totalVnd - (order.returnValueVnd ?? 0) - order.refundsVnd + (order.returnRefundsVnd ?? 0)) throw new ConflictException("REFUND_EXCEEDS_REVENUE");
        order.refundsVnd += dto.amountVnd;
      } else {
        if (dto.amountVnd > paymentDue(order)) throw new ConflictException("PAYMENT_EXCEEDS_BALANCE");
        order.receiptsVnd += dto.amountVnd;
      }
      const entry = await this.entry(actor, { kind: refund ? "REFUND" : "PAYMENT", orderId: id, amountVnd: dto.amountVnd, method: dto.method, ...("reason" in dto ? { reason: dto.reason, category: dto.purpose ?? "GOODWILL" } : {}) }, session);
      await this.reconcile(order, actor, session); await this.db.saveOrder(order, dto.expectedVersion, session);
      await this.audit(actor, refund ? "REFUND" : "PAYMENT", id, requestId, session);
      return { id: entry.id, orderId: id, amountVnd: dto.amountVnd, version: order.version };
    });
  }

  async createPurchaseReceipt(actor: Actor, dto: CreatePurchaseReceiptDto, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:purchase-receipt`, key, dto, async session => {
      const receivedDate = new Date(dto.receivedAt);
      if (receivedDate > new Date()) throw new BadRequestException("INVALID_RECEIPT_DATE");
      for (const item of dto.items) {
        if (item.expiresAt && new Date(item.expiresAt) <= receivedDate) {
          throw new BadRequestException("INVALID_BATCH_DATES");
        }
      }
      const allocatedItems = allocateReceiptShipping(dto.items, dto.shippingFeeVnd);
      const subtotalVnd = allocatedItems.reduce((sum, item) => sum + item.lineTotalVnd, 0);
      const totalCostVnd = subtotalVnd + dto.shippingFeeVnd;

      const receiptId = randomUUID();
      const codeSuffix = randomBytes(2).toString("hex").toUpperCase();
      const y = receivedDate.getUTCFullYear();
      const m = String(receivedDate.getUTCMonth() + 1).padStart(2, "0");
      const d = String(receivedDate.getUTCDate()).padStart(2, "0");
      const receiptCode = `PN-${y}${m}${d}-${codeSuffix}`;

      const receiptItems: PurchaseReceiptItem[] = [];

      for (let i = 0; i < allocatedItems.length; i++) {
        const item = allocatedItems[i];
        const batchId = randomUUID();
        const weight = item.sku.replace("CBST-", "");
        const lotCode = `LOT-${y}${m}${d}-${codeSuffix}-${weight}-${i + 1}`;
        const expiresAt = item.expiresAt ? new Date(item.expiresAt) : undefined;
        const status = expiresAt && item.supplierLotCode ? "AVAILABLE" : "QUARANTINED";

        await this.db.batches.create([{
          id: batchId,
          sku: item.sku,
          lotCode,
          receivedAt: receivedDate,
          expiresAt,
          labelReference: item.supplierLotCode,
          onHand: item.qty,
          reserved: 0,
          landedUnitCostVnd: item.landedUnitCostVnd,
          status,
          receiptId,
          receiptCode,
          supplierLotCode: item.supplierLotCode,
          purchasePriceVnd: item.purchasePriceVnd,
          allocatedShippingVnd: item.allocatedShippingVnd,
        }], { session });

        await this.db.movements.create([{
          id: randomUUID(),
          batchId,
          sku: item.sku,
          type: "RECEIPT",
          reason: "GOODS_RECEIVED",
          qtyDelta: item.qty,
          reservedDelta: 0,
          actorId: actor.id,
          createdAt: new Date(),
        }], { session });

        receiptItems.push({
          sku: item.sku,
          qty: item.qty,
          purchasePriceVnd: item.purchasePriceVnd,
          lineTotalVnd: item.lineTotalVnd,
          allocatedShippingVnd: item.allocatedShippingVnd,
          landedUnitCostVnd: item.landedUnitCostVnd,
          batchId,
          lotCode,
          supplierLotCode: item.supplierLotCode,
          expiresAt,
        });
      }

      const receiptDoc: PurchaseReceipt = {
        id: receiptId,
        receiptCode,
        receivedAt: receivedDate,
        shippingFeeVnd: dto.shippingFeeVnd,
        subtotalVnd,
        totalCostVnd,
        items: receiptItems,
        notes: dto.notes,
        documentRef: dto.documentRef,
        actorId: actor.id,
        createdAt: new Date(),
      };

      await this.db.purchaseReceipts.create([receiptDoc], { session });
      await this.audit(actor, "INVENTORY_PURCHASE_RECEIPT", receiptId, requestId, session);
      return receiptDoc;
    });
  }
  async listPurchaseReceipts(actor: Actor, page: number, limit: number) {
    this.owner(actor);
    return this.db.purchaseReceipts.find({}, { _id: 0 }).sort({ receivedAt: -1, createdAt: -1 }).skip(page * limit).limit(limit).lean();
  }
  async receipt(actor: Actor, dto: ReceiptDto, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:receipt`, key, dto, async session => {
      if (new Date(dto.receivedAt) > new Date() || (dto.expiresAt && new Date(dto.expiresAt) <= new Date(dto.receivedAt))) throw new BadRequestException("INVALID_BATCH_DATES");
      const id = randomUUID();
      const status = dto.expiresAt && dto.labelReference ? "AVAILABLE" : "QUARANTINED";
      await this.db.batches.create([{ id, sku: dto.sku, lotCode: dto.lotCode, receivedAt: new Date(dto.receivedAt), expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined, labelReference: dto.labelReference, onHand: dto.qty, reserved: 0, landedUnitCostVnd: dto.landedUnitCostVnd, status }], { session });
      await this.db.movements.create([{ id: randomUUID(), batchId: id, sku: dto.sku, type: "RECEIPT", reason: "GOODS_RECEIVED", qtyDelta: dto.qty, reservedDelta: 0, actorId: actor.id, createdAt: new Date() }], { session });
      await this.audit(actor, "INVENTORY_RECEIPT", id, requestId, session); return { id, status };
    });
  }
  async adjustment(actor: Actor, dto: AdjustmentDto, key: string, requestId: string) {
    this.owner(actor);
    if (!dto.qtyDelta) throw new BadRequestException("ZERO_ADJUSTMENT");
    // Positive adjustments cannot reintroduce uninspected or expired returned food.
    if (dto.qtyDelta > 0) throw new BadRequestException("POSITIVE_ADJUSTMENT_REQUIRES_NEW_INSPECTED_RECEIPT");
    return this.db.idempotent(`${actor.id}:adjustment`, key, dto, async session => {
      const batch = await this.db.batches.findOne({ id: dto.batchId }).session(session).lean();
      if (!batch) throw new NotFoundException("RESOURCE_NOT_FOUND");
      await this.move(actor, batch, dto.qtyDelta, 0, "ADJUSTMENT", session, dto.reason);
      await this.audit(actor, "INVENTORY_ADJUSTMENT", batch.id, requestId, session); return { id: batch.id, qtyDelta: dto.qtyDelta };
    });
  }
  async expense(actor: Actor, dto: ExpenseDto, key: string, requestId: string) {
    this.owner(actor);
    if ((dto.scope === "ORDER" && (!dto.orderId || dto.expectedVersion === undefined)) || (dto.scope === "OVERHEAD" && (dto.orderId || dto.expectedVersion !== undefined))) throw new BadRequestException("INVALID_EXPENSE_SCOPE");
    return this.db.idempotent(`${actor.id}:expense`, key, dto, async session => {
      if (dto.scope === "ORDER") {
        const order = await this.db.scopedOrder(dto.orderId!, {}, session);
        this.version(order, dto.expectedVersion!); order.directCostsVnd += dto.amountVnd;
        await this.reconcile(order, actor, session); await this.db.saveOrder(order, dto.expectedVersion!, session);
      }
      const entry = await this.entry(actor, { kind: "EXPENSE", amountVnd: dto.amountVnd, scope: dto.scope, orderId: dto.orderId, category: dto.category, reason: dto.reason }, session);
      await this.audit(actor, "EXPENSE", entry.id, requestId, session); return { id: entry.id, amountVnd: entry.amountVnd };
    });
  }
  async recalculateCommission(actor: Actor, id: string, expectedVersion: number, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:recalculate-commission:${id}`, key, { expectedVersion }, async session => {
      const order = await this.db.scopedOrder(id, {}, session);
      this.version(order, expectedVersion);
      if (!["DELIVERED", "PARTIALLY_RETURNED", "RETURNED"].includes(order.status)) throw new ConflictException("INVALID_STATE_TRANSITION");
      await this.reconcile(order, actor, session);
      await this.db.saveOrder(order, expectedVersion, session);
      await this.audit(actor, "COMMISSION_RECALCULATED", id, requestId, session);
      return { id, version: order.version, commissionVnd: order.commissionVnd };
    });
  }
  async finalizeCosts(actor: Actor, id: string, expectedVersion: number, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:finalize-costs:${id}`, key, { expectedVersion }, async session => {
      const order = await this.db.scopedOrder(id, {}, session); this.version(order, expectedVersion);
      order.costsFinalized = true; await this.reconcile(order, actor, session); await this.db.saveOrder(order, expectedVersion, session);
      await this.audit(actor, "COSTS_FINALIZED", id, requestId, session); return { id, version: order.version };
    });
  }
  async payout(actor: Actor, memberId: string, reference: string, key: string, requestId: string, amountVnd?: number, period?: string, note?: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:payout`, key, { memberId, reference, amountVnd, period, note }, async session => {
      const balance = await this.db.balances.findOne({ memberId }).session(session).lean();
      if (!balance || balance.balanceVnd <= 0) throw new ConflictException("NO_PAYABLE_COMMISSION");
      const payAmount = (amountVnd && amountVnd > 0) ? Math.min(amountVnd, balance.balanceVnd) : balance.balanceVnd;
      if (payAmount <= 0) throw new BadRequestException("INVALID_PAYOUT_AMOUNT");
      const result = await this.db.balances.updateOne({ memberId, balanceVnd: { $gte: payAmount } }, { $inc: { balanceVnd: -payAmount } }, { session });
      if (result.modifiedCount !== 1) throw new ConflictException("PAYOUT_CONFLICT");
      const entry = await this.entry(actor, { kind: "PAYOUT", memberId, amountVnd: payAmount, reference, reason: note ? `${note}${period ? ` (${period})` : ""}` : period }, session);
      await this.audit(actor, "PAYOUT", entry.id, requestId, session); return { id: entry.id, amountVnd: entry.amountVnd, memberId, remainingBalanceVnd: balance.balanceVnd - payAmount };
    });
  }
  async updateCommissionRate(actor: Actor, memberId: string, dto: UpdateCommissionRateDto, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:commission-rate:${memberId}`, key, dto, async session => {
      const historyItem = { rateBps: dto.rateBps, changedBy: actor.id, changedAt: new Date(), reason: dto.reason };
      const user = await this.db.users.findOneAndUpdate(
        { id: memberId, role: "MEMBER" },
        { $set: { commissionRateBps: dto.rateBps }, $push: { commissionRateHistory: historyItem } },
        { session, new: true, projection: { _id: 0, id: 1, displayName: 1, emailNormalized: 1, role: 1, status: 1, commissionRateBps: 1 } }
      ).lean();
      if (!user) throw new NotFoundException("MEMBER_NOT_FOUND");
      await this.audit(actor, "COMMISSION_RATE_UPDATED", memberId, requestId, session);
      return user;
    });
  }
  async updateBankInfo(actor: Actor, memberId: string, dto: UpdateBankInfoDto, key: string, requestId: string) {
    if (actor.role !== "OWNER_ADMIN" && actor.id !== memberId) throw new ForbiddenException();
    return this.db.idempotent(`${actor.id}:bank-info:${memberId}`, key, dto, async session => {
      const user = await this.db.users.findOneAndUpdate(
        { id: memberId },
        { $set: { bankInfo: dto.bankInfo } },
        { session, new: true, projection: { _id: 0, id: 1, displayName: 1, emailNormalized: 1, role: 1, status: 1, bankInfo: 1 } }
      ).lean();
      if (!user) throw new NotFoundException("USER_NOT_FOUND");
      await this.audit(actor, "BANK_INFO_UPDATED", memberId, requestId, session);
      return user;
    });
  }
  async createUser(actor: Actor, dto: CreateUserDto, key: string, requestId: string) {
    this.owner(actor); const passwordHash = await hashPassword(dto.password);
    return this.db.idempotent(`${actor.id}:create-user`, key, dto, async session => {
      const id = randomUUID();
      await this.db.users.create([{ id, emailNormalized: dto.email.trim().toLowerCase(), displayName: dto.displayName, passwordHash, role: "MEMBER", status: "ACTIVE" }], { session });
      await this.audit(actor, "USER_CREATED", id, requestId, session); return { id, displayName: dto.displayName, role: "MEMBER", status: "ACTIVE" };
    });
  }
  async userStatus(actor: Actor, id: string, status: "ACTIVE" | "INACTIVE", key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:user-status:${id}`, key, { status }, async session => {
      const result = await this.db.users.updateOne({ id, role: "MEMBER" }, { $set: { status }, $inc: { authVersion: 1 } }, { session });
      if (!result.matchedCount) throw new NotFoundException("RESOURCE_NOT_FOUND");
      await this.db.sessions.updateMany({ userId: id, revokedAt: null }, { $set: { revokedAt: new Date() } }, { session });
      await this.db.resets.deleteMany({ userId: id }, { session });
      await this.audit(actor, "USER_STATUS", id, requestId, session); return { id, status };
    });
  }
  async dashboard(actor: Actor) {
    const scope = orderScope(actor);
    const match = { ...scope, deliveredAt: { $exists: true } };
    const [totals] = await this.db.orders.aggregate([{ $match: match }, { $group: { _id: null, deliveredOrders: { $sum: 1 }, revenueVnd: { $sum: { $subtract: [{ $add: ["$totalVnd", { $ifNull: ["$returnRefundsVnd", 0] }] }, { $add: ["$refundsVnd", { $ifNull: ["$returnValueVnd", 0] }] }] } }, cogsVnd: { $sum: "$cogsVnd" }, directCostsVnd: { $sum: "$directCostsVnd" }, commissionVnd: { $sum: "$commissionVnd" }, pendingCostOrders: { $sum: { $cond: ["$costsFinalized", 0, 1] } } } }]);
    const processingOrders = await this.db.orders.countDocuments({
      ...scope,
      status: { $nin: ["DELIVERED", "CANCELLED", "RETURNED"] },
    });
    const [cash] = actor.role === "OWNER_ADMIN" ? await this.db.ledger.aggregate([{ $group: { _id: null, cashMovementVnd: { $sum: { $switch: { branches: [{ case: { $eq: ["$kind", "PAYMENT"] }, then: "$amountVnd" }, { case: { $in: ["$kind", ["REFUND", "EXPENSE", "PAYOUT"]] }, then: { $multiply: ["$amountVnd", -1] } }], default: 0 } } }, overheadVnd: { $sum: { $cond: [{ $and: [{ $eq: ["$kind", "EXPENSE"] }, { $eq: ["$scope", "OVERHEAD"] }] }, "$amountVnd", 0] } } } }]) : [];
    const [losses] = actor.role === "OWNER_ADMIN" ? await this.db.orders.aggregate([{ $match: { deliveredAt: { $exists: false }, status: "RETURNED", shippedAt: { $exists: true } } }, { $group: { _id: null, inventoryLossVnd: { $sum: "$cogsVnd" }, directCostsVnd: { $sum: "$directCostsVnd" } } }]) : [];
    const failedDeliveryLossVnd = (losses?.inventoryLossVnd ?? 0) + (losses?.directCostsVnd ?? 0);
    return { asOf: new Date().toISOString(), timezone: "Asia/Ho_Chi_Minh", deliveredOrders: totals?.deliveredOrders ?? 0, revenueVnd: totals?.revenueVnd ?? 0, commissionVnd: totals?.commissionVnd ?? 0, pendingCostOrders: processingOrders,
      ...(actor.role === "OWNER_ADMIN" ? { failedDeliveryLossVnd, failedDeliveryInventoryLossVnd: losses?.inventoryLossVnd ?? 0, failedDeliveryDirectCostsVnd: losses?.directCostsVnd ?? 0, cogsVnd: totals?.cogsVnd ?? 0, directCostsVnd: totals?.directCostsVnd ?? 0, overheadVnd: cash?.overheadVnd ?? 0, operatingCashMovementVnd: cash?.cashMovementVnd ?? 0, netProfitVnd: (totals?.revenueVnd ?? 0) - (totals?.cogsVnd ?? 0) - (totals?.directCostsVnd ?? 0) - (totals?.commissionVnd ?? 0) - (cash?.overheadVnd ?? 0) - failedDeliveryLossVnd } : {}) };
  }
  async getMediaState() {
    const slots = await this.db.mediaSlots.find({}, { _id: 0 }).lean();
    const assets = await this.db.mediaAssets.find({}, { _id: 0 }).sort({ createdAt: -1 }).lean();
    const images: Record<string, string> = {};
    for (const slot of slots) {
      images[slot.slotKey] = slot.url;
    }
    return {
      success: true,
      images,
      gallery: assets.map((a) => ({
        id: a.id,
        url: a.url,
        title: a.title,
        tag: a.tag,
        description: a.description || "",
        createdAt: a.createdAt ? a.createdAt.toISOString().slice(0, 10) : "",
      })),
    };
  }
  async createMediaAsset(dto: import("./dto").CreateMediaAssetDto, actor?: Actor) {
    if (actor && actor.role !== "OWNER_ADMIN") throw new ForbiddenException("OWNER_ONLY");
    const id = randomUUID();
    const now = new Date();
    const asset = {
      id,
      url: dto.url,
      title: dto.title,
      tag: dto.tag,
      description: dto.description,
      publicId: dto.publicId,
      width: dto.width,
      height: dto.height,
      format: dto.format,
      bytes: dto.bytes,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.mediaAssets.create([asset]);
    if (dto.assignSlot && dto.assignSlot !== "none") {
      await this.db.mediaSlots.updateOne(
        { slotKey: dto.assignSlot },
        { $set: { url: dto.url, mediaAssetId: id, updatedAt: now } },
        { upsert: true },
      );
    }
    return { success: true, asset };
  }
  async assignMediaSlot(dto: import("./dto").AssignMediaSlotDto, actor?: Actor) {
    if (actor && actor.role !== "OWNER_ADMIN") throw new ForbiddenException("OWNER_ONLY");
    const now = new Date();
    await this.db.mediaSlots.updateOne(
      { slotKey: dto.slotKey },
      { $set: { url: dto.url, mediaAssetId: dto.mediaAssetId, updatedAt: now } },
      { upsert: true },
    );
    return { success: true, slotKey: dto.slotKey, url: dto.url };
  }
  async bulkSyncMedia(dto: import("./dto").BulkAssignMediaSlotsDto, actor?: Actor) {
    if (actor && actor.role !== "OWNER_ADMIN") throw new ForbiddenException("OWNER_ONLY");
    const now = new Date();
    if (dto.images) {
      for (const [slotKey, url] of Object.entries(dto.images)) {
        if (slotKey && url) {
          await this.db.mediaSlots.updateOne(
            { slotKey },
            { $set: { url, updatedAt: now } },
            { upsert: true },
          );
        }
      }
    }
    if (dto.gallery && Array.isArray(dto.gallery)) {
      for (const raw of dto.gallery) {
        const item = raw as Record<string, unknown>;
        if (item && item.url && item.title) {
          const itemUrl = String(item.url);
          const itemTag = String(item.tag || "general");
          const itemTitle = String(item.title);
          const itemDesc = item.description ? String(item.description) : undefined;
          const itemId = item.id ? String(item.id) : randomUUID();
          await this.db.mediaAssets.updateOne(
            { url: itemUrl },
            {
              $setOnInsert: {
                id: itemId,
                title: itemTitle,
                tag: itemTag,
                description: itemDesc,
                createdAt: now,
              },
              $set: { updatedAt: now },
            },
            { upsert: true },
          );
        }
      }
    }
    return this.getMediaState();
  }
  async deleteMediaAsset(id: string, actor?: Actor) {
    if (actor && actor.role !== "OWNER_ADMIN") throw new ForbiddenException("OWNER_ONLY");
    await this.db.mediaAssets.deleteOne({ id });
    return { success: true, id };
  }

  async getKpiPolicies(actor: Actor) {
    return this.db.kpiPolicies.find().sort({ createdAt: -1 }).lean();
  }

  async createKpiPolicy(actor: Actor, dto: CreateKpiPolicyDto, key: string, requestId: string) {
    this.owner(actor);
    const sortedTiers = [...dto.tiers].sort((a, b) => a.minQty - b.minQty);
    return this.db.idempotent(`${actor.id}:create-kpi-policy`, key, dto, async session => {
      const policy: KpiPolicy = {
        id: randomUUID(),
        name: dto.name.trim(),
        periodType: dto.periodType,
        metric: dto.metric || "PRODUCT_QTY",
        tiers: sortedTiers,
        active: dto.active !== false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await this.db.kpiPolicies.create([policy], { session });
      await this.audit(actor, "KPI_POLICY_CREATED", policy.id, requestId, session);
      return policy;
    });
  }

  async getKpiPeriods(actor: Actor) {
    return this.db.kpiPeriods.find().sort({ startDate: -1 }).lean();
  }

  async createKpiPeriod(actor: Actor, dto: CreateKpiPeriodDto, key: string, requestId: string) {
    this.owner(actor);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate >= endDate) {
      throw new BadRequestException("INVALID_DATE_RANGE");
    }
    return this.db.idempotent(`${actor.id}:create-kpi-period`, key, dto, async session => {
      const policy = await this.db.kpiPolicies.findOne({ id: dto.policyId }).session(session).lean();
      if (!policy) throw new NotFoundException("KPI_POLICY_NOT_FOUND");
      const period: KpiPeriod = {
        id: randomUUID(),
        policyId: dto.policyId,
        name: dto.name.trim(),
        startDate,
        endDate,
        status: "OPEN",
        createdAt: new Date(),
      };
      await this.db.kpiPeriods.create([period], { session });
      await this.audit(actor, "KPI_PERIOD_CREATED", period.id, requestId, session);
      return period;
    });
  }

  async computeDeliveredQty(memberId: string, startDate: Date, endDate: Date, session?: ClientSession) {
    const orders = await this.db.orders.find({
      responsibleMemberId: memberId,
      status: { $in: ["DELIVERED", "PARTIALLY_RETURNED"] },
      $or: [
        { deliveredAt: { $gte: startDate, $lte: endDate } },
        { deliveredAt: { $exists: false }, createdAt: { $gte: startDate, $lte: endDate } },
      ],
    }).session(session ?? null).lean();

    let totalDeliveredQty = 0;
    for (const order of orders) {
      const lineQty = (order.items || []).reduce((s: number, it: { qty?: number }) => s + (it.qty || 0), 0);
      const returnedQty = (order.allocations || []).reduce((s: number, al: { returnedQty?: number }) => s + (al.returnedQty || 0), 0);
      totalDeliveredQty += Math.max(0, lineQty - returnedQty);
    }
    return { totalDeliveredQty };
  }

  evaluateKpi(policy: KpiPolicy, totalQty: number) {
    const sorted = [...policy.tiers].sort((a, b) => b.minQty - a.minQty);
    const achieved = sorted.find(t => totalQty >= t.minQty) || null;
    return {
      achievedTier: achieved,
      bonusVnd: achieved ? achieved.bonusVnd : 0,
    };
  }

  async previewKpiPeriod(actor: Actor, periodId: string) {
    this.owner(actor);
    const period = await this.db.kpiPeriods.findOne({ id: periodId }).lean();
    if (!period) throw new NotFoundException("KPI_PERIOD_NOT_FOUND");
    const policy = await this.db.kpiPolicies.findOne({ id: period.policyId }).lean();
    if (!policy) throw new NotFoundException("KPI_POLICY_NOT_FOUND");

    const members = await this.db.users.find({ role: "MEMBER" }, { _id: 0, id: 1, displayName: 1, emailNormalized: 1, status: 1 }).lean();
    const awards = period.status === "SETTLED" ? await this.db.kpiAwards.find({ periodId }).lean() : [];
    const awardMap = new Map(awards.map(a => [a.memberId, a]));

    const memberResults = await Promise.all(
      members.map(async member => {
        const existingAward = awardMap.get(member.id);
        if (existingAward) {
          return {
            memberId: member.id,
            displayName: member.displayName,
            email: member.emailNormalized,
            deliveredQty: existingAward.totalDeliveredQty,
            achievedTierQty: existingAward.achievedTierQty ?? null,
            bonusVnd: existingAward.bonusVnd,
            settled: true,
          };
        }
        const { totalDeliveredQty } = await this.computeDeliveredQty(member.id, period.startDate, period.endDate);
        const { achievedTier, bonusVnd } = this.evaluateKpi(policy, totalDeliveredQty);
        return {
          memberId: member.id,
          displayName: member.displayName,
          email: member.emailNormalized,
          deliveredQty: totalDeliveredQty,
          achievedTierQty: achievedTier?.minQty ?? null,
          bonusVnd,
          settled: false,
        };
      })
    );

    return {
      period,
      policy,
      members: memberResults,
      totalBonusVnd: memberResults.reduce((s: number, m: { bonusVnd: number }) => s + m.bonusVnd, 0),
    };
  }

  async settleKpiPeriod(actor: Actor, periodId: string, dto: SettleKpiPeriodDto, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:settle-kpi:${periodId}`, key, dto, async session => {
      const period = await this.db.kpiPeriods.findOne({ id: periodId }).session(session).lean();
      if (!period) throw new NotFoundException("KPI_PERIOD_NOT_FOUND");
      if (period.status === "SETTLED") throw new ConflictException("KPI_PERIOD_ALREADY_SETTLED");
      const policy = await this.db.kpiPolicies.findOne({ id: period.policyId }).session(session).lean();
      if (!policy) throw new NotFoundException("KPI_POLICY_NOT_FOUND");

      const members = await this.db.users.find({ role: "MEMBER" }).session(session).lean();
      const awards: KpiAward[] = [];

      for (const member of members) {
        const { totalDeliveredQty } = await this.computeDeliveredQty(member.id, period.startDate, period.endDate, session);
        const { achievedTier, bonusVnd } = this.evaluateKpi(policy, totalDeliveredQty);

        if (bonusVnd > 0) {
          const entry = await this.entry(actor, {
            kind: "KPI_BONUS",
            memberId: member.id,
            amountVnd: bonusVnd,
            reason: dto?.note ? `${dto.note} (${period.name})` : `Thưởng KPI: ${period.name}`,
          }, session);

          await this.db.balances.updateOne(
            { memberId: member.id },
            { $inc: { balanceVnd: bonusVnd } },
            { session, upsert: true }
          );

          awards.push({
            id: randomUUID(),
            periodId: period.id,
            memberId: member.id,
            totalDeliveredQty,
            achievedTierQty: achievedTier?.minQty,
            bonusVnd,
            ledgerEntryId: entry.id,
            createdAt: new Date(),
          });
        }
      }

      if (awards.length > 0) {
        await this.db.kpiAwards.create(awards, { session });
      }

      await this.db.kpiPeriods.updateOne(
        { id: periodId },
        { $set: { status: "SETTLED", settledAt: new Date(), settledBy: actor.id } },
        { session }
      );

      await this.audit(actor, "KPI_PERIOD_SETTLED", periodId, requestId, session);
      return {
        periodId,
        status: "SETTLED",
        awardsCount: awards.length,
        totalBonusVnd: awards.reduce((s, a) => s + a.bonusVnd, 0),
      };
    });
  }

  async getMyKpiProgress(actor: Actor) {
    const now = new Date();
    const period = await this.db.kpiPeriods.findOne({
      status: "OPEN",
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).sort({ startDate: -1 }).lean() || await this.db.kpiPeriods.findOne({ status: "OPEN" }).sort({ startDate: -1 }).lean();

    if (!period) {
      return { hasActivePeriod: false };
    }

    const policy = await this.db.kpiPolicies.findOne({ id: period.policyId }).lean();
    if (!policy) {
      return { hasActivePeriod: false };
    }

    const { totalDeliveredQty } = await this.computeDeliveredQty(actor.id, period.startDate, period.endDate);
    const sortedTiers = [...policy.tiers].sort((a, b) => a.minQty - b.minQty);
    const achievedTier = [...sortedTiers].reverse().find(t => totalDeliveredQty >= t.minQty) || null;
    const nextTier = sortedTiers.find(t => t.minQty > totalDeliveredQty) || null;

    const remainingQtyToNextTier = nextTier ? nextTier.minQty - totalDeliveredQty : 0;
    const progressPercent = nextTier
      ? Math.min(100, Math.round((totalDeliveredQty / nextTier.minQty) * 100))
      : 100;

    return {
      hasActivePeriod: true,
      period,
      policy: {
        id: policy.id,
        name: policy.name,
        periodType: policy.periodType,
        tiers: sortedTiers,
      },
      currentQty: totalDeliveredQty,
      achievedTier,
      currentBonusVnd: achievedTier ? achievedTier.bonusVnd : 0,
      nextTier,
      remainingQtyToNextTier,
      progressPercent,
    };
  }
}

