import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ClientSession } from "mongoose";
import { isOrderTransitionAllowed } from "../domain";
import { hashPassword } from "../auth/password";
import { MongoRepository } from "./repository";
import { commissionTarget, orderProjection, orderScope, paymentDue, type Actor } from "./policy";
import type { AdjustmentDto, CheckoutDto, CreateUserDto, ExpenseDto, PaymentDto, ProductDto, ReceiptDto, RefundDto, TransitionDto } from "./dto";
import type { Batch, Ledger, Order } from "./models";
import type { AssignOrderDto, CreateProductDto, EditOrderDto, ReturnDto } from "./dto";

@Injectable()
export class CommerceService {
  constructor(private readonly db: MongoRepository) {}
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
    return this.db.products.find({ active: true }, { _id: 0, sku: 1, name: 1, netWeightG: 1, retailPriceVnd: 1 }).sort({ netWeightG: 1 }).lean();
  }
  async ownerProducts(actor: Actor) {
    this.owner(actor);
    return this.db.products.find({}, { _id: 0, id: 1, sku: 1, name: 1, netWeightG: 1, retailPriceVnd: 1, active: 1, version: 1 }).sort({ netWeightG: 1 }).lean();
  }
  async createProduct(actor: Actor, dto: CreateProductDto, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:create-product`, key, dto, async session => {
      const product = { id: randomUUID(), sku: dto.sku, name: dto.name.trim(), netWeightG: Number(dto.sku.slice(5)), retailPriceVnd: dto.retailPriceVnd, active: dto.active, version: 0 };
      await this.db.products.create([product], { session });
      await this.audit(actor, "PRODUCT_CREATED", product.id, requestId, session);
      return product;
    });
  }
  async product(sku: string) {
    const product = await this.db.products.findOne({ sku, active: true }, { _id: 0, sku: 1, name: 1, netWeightG: 1, retailPriceVnd: 1 }).lean();
    if (!product) throw new NotFoundException("RESOURCE_NOT_FOUND"); return product;
  }
  async updateProduct(actor: Actor, sku: string, dto: ProductDto, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:product:${sku}`, key, dto, async session => {
      const product = await this.db.products.findOneAndUpdate({ sku, version: dto.expectedVersion }, { $set: { retailPriceVnd: dto.retailPriceVnd, active: dto.active, ...(dto.name !== undefined ? { name: dto.name.trim() } : {}) }, $inc: { version: 1 } }, { session, new: true, runValidators: true, projection: { _id: 0, id: 1, sku: 1, name: 1, netWeightG: 1, retailPriceVnd: 1, active: 1, version: 1 } }).lean();
      if (!product) throw new ConflictException("VERSION_CONFLICT");
      await this.audit(actor, "PRODUCT_UPDATED", sku, requestId, session); return product;
    });
  }
  async checkout(actor: Actor | null, guestScope: string, dto: CheckoutDto, key: string, requestId: string) {
    if (!actor && process.env.PUBLIC_CHECKOUT_ENABLED !== "true") throw new ServiceUnavailableException("CHECKOUT_DISABLED_PENDING_TRANSACTION_VERIFICATION");
    const effectiveActor: Actor = actor ?? { id: "guest", role: "MEMBER" };
    return this.db.idempotent(`${actor?.id ?? guestScope}:checkout`, key, dto, async session => {
      const items: Order["items"] = [];
      for (const item of dto.items) {
        const product = await this.db.products.findOne({ sku: item.sku, active: true }).session(session).lean();
        if (!product) throw new BadRequestException("PRODUCT_UNAVAILABLE");
        const stock = await this.db.batches.aggregate<{ available: number }>([{ $match: { sku: item.sku, status: "AVAILABLE", expiresAt: { $gt: new Date() } } }, { $group: { _id: null, available: { $sum: { $subtract: ["$onHand", "$reserved"] } } } }]).session(session);
        if ((stock[0]?.available ?? 0) < item.qty) throw new ConflictException("OUT_OF_STOCK");
        items.push({ sku: item.sku, qty: item.qty, unitPriceVnd: product.retailPriceVnd });
      }
      const id = randomUUID();
      const order: Order = { id, orderCode: `CBST-${id}`, responsibleMemberId: actor?.role === "MEMBER" ? actor.id : null, status: "PENDING", version: 0,
        customer: { ...dto.customer, phone: dto.customer.phone.replace(/^0/, "+84") }, consentAt: new Date(), source: dto.source, notes: dto.notes, items, allocations: [],
        totalVnd: items.reduce((sum, item) => sum + item.qty * item.unitPriceVnd, 0), receiptsVnd: 0, refundsVnd: 0, cogsVnd: 0, directCostsVnd: 0,
        costsFinalized: false, commissionRateBps: 4000, commissionVnd: 0, createdAt: new Date() };
      await this.db.orders.create([order], { session });
      await this.audit(effectiveActor, "ORDER_CREATED", id, requestId, session);
      // Persist only the safe checkout receipt in the replay record, never customer PII.
      return { id, orderCode: order.orderCode, status: order.status, totalVnd: order.totalVnd, version: 0 };
    });
  }
  async listOrders(actor: Actor, page: number, limit: number) {
    const fields = "id orderCode responsibleMemberId status version customer items totalVnd receiptsVnd refundsVnd returnValueVnd returnRefundsVnd createdAt" + (actor.role === "OWNER_ADMIN" ? " cogsVnd directCostsVnd costsFinalized commissionVnd" : "");
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
      if (!order.shippedAt || !["RETURN_REQUESTED", "PARTIALLY_RETURNED", "DELIVERY_FAILED"].includes(order.status)) throw new ConflictException("RETURN_NOT_ALLOWED");
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
        allocation.returnedQty = (allocation.returnedQty ?? 0) + line.qty;
        credit += item.unitPriceVnd * line.qty;
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
      if (!isOrderTransitionAllowed(order.status, dto.status)) throw new ConflictException("INVALID_STATE_TRANSITION");
      if (["PARTIALLY_RETURNED", "RETURNED"].includes(dto.status)) throw new ConflictException("PHYSICAL_RETURN_REQUIRED");
      if (["RETURN_REQUESTED", "PARTIALLY_RETURNED", "RETURNED"].includes(dto.status)) this.owner(actor);
      const from = order.status;
      const now = new Date();
      if (dto.status === "CONFIRMED") {
        await this.reserve(order, actor, session, dto.reason);
      }
      if ((dto.status === "SHIPPING" && !order.shippedAt) || (dto.status === "CANCELLED" && from !== "PENDING")) {
        for (const allocation of order.allocations) {
          const batch = await this.db.batches.findOne({ id: allocation.batchId }).session(session).lean();
          if (!batch) throw new ConflictException("BATCH_MISSING");
          const shipping = dto.status === "SHIPPING";
          if (shipping && (batch.status !== "AVAILABLE" || !batch.expiresAt || batch.expiresAt <= now)) throw new ConflictException("BATCH_UNSAFE");
          await this.move(actor, batch, shipping ? -allocation.qty : 0, -allocation.qty, shipping ? "STOCK_OUT" : "RELEASE", session, dto.reason, id, shipping ? now : undefined);
        }
        if (dto.status === "SHIPPING") order.shippedAt = now;
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
  async finalizeCosts(actor: Actor, id: string, expectedVersion: number, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:finalize-costs:${id}`, key, { expectedVersion }, async session => {
      const order = await this.db.scopedOrder(id, {}, session); this.version(order, expectedVersion);
      order.costsFinalized = true; await this.reconcile(order, actor, session); await this.db.saveOrder(order, expectedVersion, session);
      await this.audit(actor, "COSTS_FINALIZED", id, requestId, session); return { id, version: order.version };
    });
  }
  async payout(actor: Actor, memberId: string, reference: string, key: string, requestId: string) {
    this.owner(actor);
    return this.db.idempotent(`${actor.id}:payout`, key, { memberId, reference }, async session => {
      const balance = await this.db.balances.findOne({ memberId }).session(session).lean();
      if (!balance || balance.balanceVnd <= 0) throw new ConflictException("NO_PAYABLE_COMMISSION");
      const result = await this.db.balances.updateOne({ memberId, balanceVnd: balance.balanceVnd }, { $set: { balanceVnd: 0 } }, { session });
      if (result.modifiedCount !== 1) throw new ConflictException("PAYOUT_CONFLICT");
      const entry = await this.entry(actor, { kind: "PAYOUT", memberId, amountVnd: balance.balanceVnd, reference }, session);
      await this.audit(actor, "PAYOUT", entry.id, requestId, session); return { id: entry.id, amountVnd: entry.amountVnd, memberId };
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
    const match = { ...orderScope(actor), deliveredAt: { $exists: true } };
    const [totals] = await this.db.orders.aggregate([{ $match: match }, { $group: { _id: null, deliveredOrders: { $sum: 1 }, revenueVnd: { $sum: { $subtract: [{ $add: ["$totalVnd", { $ifNull: ["$returnRefundsVnd", 0] }] }, { $add: ["$refundsVnd", { $ifNull: ["$returnValueVnd", 0] }] }] } }, cogsVnd: { $sum: "$cogsVnd" }, directCostsVnd: { $sum: "$directCostsVnd" }, commissionVnd: { $sum: "$commissionVnd" }, pendingCostOrders: { $sum: { $cond: ["$costsFinalized", 0, 1] } } } }]);
    const [cash] = actor.role === "OWNER_ADMIN" ? await this.db.ledger.aggregate([{ $group: { _id: null, cashMovementVnd: { $sum: { $switch: { branches: [{ case: { $eq: ["$kind", "PAYMENT"] }, then: "$amountVnd" }, { case: { $in: ["$kind", ["REFUND", "EXPENSE", "PAYOUT"]] }, then: { $multiply: ["$amountVnd", -1] } }], default: 0 } } }, overheadVnd: { $sum: { $cond: [{ $and: [{ $eq: ["$kind", "EXPENSE"] }, { $eq: ["$scope", "OVERHEAD"] }] }, "$amountVnd", 0] } } } }]) : [];
    const [losses] = actor.role === "OWNER_ADMIN" ? await this.db.orders.aggregate([{ $match: { deliveredAt: { $exists: false }, status: "RETURNED", shippedAt: { $exists: true } } }, { $group: { _id: null, inventoryLossVnd: { $sum: "$cogsVnd" }, directCostsVnd: { $sum: "$directCostsVnd" } } }]) : [];
    const failedDeliveryLossVnd = (losses?.inventoryLossVnd ?? 0) + (losses?.directCostsVnd ?? 0);
    return { asOf: new Date().toISOString(), timezone: "Asia/Ho_Chi_Minh", deliveredOrders: totals?.deliveredOrders ?? 0, revenueVnd: totals?.revenueVnd ?? 0, commissionVnd: totals?.commissionVnd ?? 0, pendingCostOrders: totals?.pendingCostOrders ?? 0,
      ...(actor.role === "OWNER_ADMIN" ? { failedDeliveryLossVnd, failedDeliveryInventoryLossVnd: losses?.inventoryLossVnd ?? 0, failedDeliveryDirectCostsVnd: losses?.directCostsVnd ?? 0, cogsVnd: totals?.cogsVnd ?? 0, directCostsVnd: totals?.directCostsVnd ?? 0, overheadVnd: cash?.overheadVnd ?? 0, operatingCashMovementVnd: cash?.cashMovementVnd ?? 0, netProfitVnd: (totals?.revenueVnd ?? 0) - (totals?.cogsVnd ?? 0) - (totals?.directCostsVnd ?? 0) - (totals?.commissionVnd ?? 0) - (cash?.overheadVnd ?? 0) - failedDeliveryLossVnd } : {}) };
  }
}
