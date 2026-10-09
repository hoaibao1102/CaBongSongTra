"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { envelope } from "./errors";
import type { Result } from "./types";
import { createSupabaseServerClient, hasSupabaseEnv } from "./supabase-server";

const uuidSchema = z.string().uuid();
const moneySchema = z.coerce.number().int().positive();

async function callRpc<T>(name: string, params: Record<string, unknown>, refreshPath?: string): Promise<Result<T>> {
  return envelope(async () => {
    if (!hasSupabaseEnv()) throw new Error("Supabase environment is not configured.");
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(name, params);
    if (error) throw new Error(error.message);
    if (refreshPath) revalidatePath(refreshPath);
    return data as T;
  });
}

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=invalid");
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function receiveBatchAction(formData: FormData) {
  const input = z.object({
    productId: uuidSchema,
    lotCode: z.string().min(1),
    receivedQty: z.coerce.number().int().positive(),
    purchaseUnitCost: moneySchema,
    inboundCostTotal: z.coerce.number().int().nonnegative(),
    expiresAt: z.string().min(1),
    labelEvidencePath: z.string().min(1),
    idempotencyKey: uuidSchema,
  }).parse(Object.fromEntries(formData));
  await callRpc("receive_batch", {
    p_product_id: input.productId,
    p_lot_code: input.lotCode,
    p_received_qty: input.receivedQty,
    p_purchase_unit_cost: input.purchaseUnitCost,
    p_inbound_cost_total: input.inboundCostTotal,
    p_expires_at: input.expiresAt,
    p_label_evidence_path: input.labelEvidencePath,
    p_idempotency_key: input.idempotencyKey,
  }, "/admin/inventory");
}

export async function createDraftOrderAction(formData: FormData) {
  const input = z.object({ customerName: z.string().min(2), customerPhone: z.string().min(9), customerArea: z.string().optional(), customerAddress: z.string().optional(), productId: uuidSchema, quantity: z.coerce.number().int().positive(), customerShippingFee: z.coerce.number().int().nonnegative().default(0), idempotencyKey: uuidSchema }).parse(Object.fromEntries(formData));
  await callRpc("create_draft_order", { p_customer_name: input.customerName, p_customer_phone: input.customerPhone, p_customer_area: input.customerArea || null, p_customer_address: input.customerAddress || null, p_product_id: input.productId, p_quantity: input.quantity, p_customer_shipping_fee: input.customerShippingFee, p_idempotency_key: input.idempotencyKey }, "/admin/orders");
}

export async function createPriceVersionAction(formData: FormData) {
  const input = z.object({ productId: uuidSchema, retailPrice: moneySchema, effectiveFrom: z.string().min(1), reason: z.string().min(3), idempotencyKey: uuidSchema }).parse(Object.fromEntries(formData));
  await callRpc("create_price_version", { p_product_id: input.productId, p_retail_price: input.retailPrice, p_effective_from: input.effectiveFrom, p_reason: input.reason, p_idempotency_key: input.idempotencyKey }, "/admin/products");
}

export async function confirmOrderAction(orderId: string, expectedVersion: number, idempotencyKey: string) {
  return callRpc("confirm_order", { p_order_id: orderId, p_expected_version: expectedVersion, p_idempotency_key: idempotencyKey }, "/admin/orders");
}

export async function transitionOrderAction(orderId: string, to: string, expectedVersion: number, idempotencyKey: string, reason?: string) {
  return callRpc("transition_order", { p_order_id: orderId, p_to: to, p_expected_version: expectedVersion, p_idempotency_key: idempotencyKey, p_reason: reason ?? null }, "/admin/orders");
}

export async function recordPaymentAction(formData: FormData) {
  const input = z.object({ orderId: uuidSchema, kind: z.enum(["RECEIPT", "REFUND"]), method: z.enum(["BANK_TRANSFER", "CASH_COD"]), amount: moneySchema, reference: z.string().optional(), reversesPaymentId: z.string().optional(), idempotencyKey: uuidSchema }).parse(Object.fromEntries(formData));
  await callRpc("record_payment", { p_order_id: input.orderId, p_kind: input.kind, p_method: input.method, p_amount: input.amount, p_reference: input.reference || null, p_reverses_payment_id: input.reversesPaymentId || null, p_idempotency_key: input.idempotencyKey }, "/admin/finance");
}

export async function upsertOrderCostAction(formData: FormData) {
  const input = z.object({ orderId: uuidSchema, costId: z.string().optional(), type: z.enum(["SHOP_SHIPPING", "PACKAGING", "PAYMENT_FEE", "OTHER_DIRECT", "MEMBER_ADVANCE_REIMBURSEMENT"]), payer: z.enum(["SHOP", "CUSTOMER", "ADVANCED_BY_MEMBER"]), amount: moneySchema, note: z.string().optional(), idempotencyKey: uuidSchema }).parse(Object.fromEntries(formData));
  await callRpc("upsert_order_cost", { p_order_id: input.orderId, p_cost_id: input.costId || null, p_type: input.type, p_payer: input.payer, p_amount: input.amount, p_note: input.note || null, p_idempotency_key: input.idempotencyKey }, "/admin/finance");
}

export async function approveCommissionAction(commissionRecordId: string, idempotencyKey: string) {
  return callRpc("approve_commission", { p_commission_record_id: commissionRecordId, p_idempotency_key: idempotencyKey }, "/admin/finance");
}

export async function createPayoutAction(formData: FormData) {
  const input = z.object({ memberId: uuidSchema, periodStart: z.string().min(1), periodEnd: z.string().min(1), method: z.string().optional(), proofPath: z.string().optional(), idempotencyKey: uuidSchema }).parse(Object.fromEntries(formData));
  await callRpc("create_payout", { p_member_id: input.memberId, p_period_start: input.periodStart, p_period_end: input.periodEnd, p_method: input.method || null, p_proof_path: input.proofPath || null, p_idempotency_key: input.idempotencyKey }, "/admin/finance");
}


export async function processReturnAction(formData: FormData) {
  const input = z.object({ orderId: uuidSchema, refundAmount: z.coerce.number().int().nonnegative(), reason: z.string().min(3), idempotencyKey: uuidSchema }).parse(Object.fromEntries(formData));
  await callRpc("process_return", { p_order_id: input.orderId, p_refund_amount: input.refundAmount, p_reason: input.reason, p_idempotency_key: input.idempotencyKey }, "/admin/orders");
}
