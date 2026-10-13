"use client";
import { apiRequest } from "../commerce";
import { safeQuote, type PricingQuote } from "../pricing";
import { money, text } from "../i18n";
import type { Lang } from "../types";
export async function requestQuote(payload: { items: unknown; customer?: { phone?: string } }, internal: boolean, voucherCode?: string, fetcher: typeof fetch = fetch) {
  const value = await apiRequest(internal ? "internal/pricing/quote" : "pricing/quote", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: payload.items, ...(internal ? { customerPhone: payload.customer?.phone, ...(voucherCode ? { voucherCode } : {}) } : {}) }),
  }, fetcher);
  const quote = safeQuote(value);
  if (!quote) throw new Error("INVALID_PRICING_QUOTE");
  return quote;
}
export function guardedPayload(payload: { customer: unknown; items: unknown; consent: boolean; source: unknown; notes: string }, quote: PricingQuote, internal: boolean, voucherCode?: string) {
  return { customer: payload.customer, items: payload.items, source: payload.source, notes: payload.notes,
    ...(!internal ? { consent: payload.consent } : voucherCode ? { voucherCode } : {}),
    clientExpectedTotalVnd: quote.totalVnd, pricingFingerprint: quote.pricingFingerprint };
}
export function PricingReview({ quote, lang, stale, onConfirm }: { quote: PricingQuote; lang: Lang; stale?: boolean; onConfirm?: () => void }) {
  return <section className="panel" aria-live="polite">
    <h3>{stale ? text(lang, "Gia da thay doi", "Price changed") : text(lang, "Bao gia tu he thong", "Server quote")}</h3>
    {quote.items.map(i => <p key={i.sku}>{i.sku} x {i.qty}: {money(i.finalLineTotalVnd, lang)}</p>)}
    <p>{text(lang, "Tien hang", "Subtotal")}: {money(quote.merchandiseSubtotalVnd, lang)}</p>
    <p>{text(lang, "Giam gia", "Discount")}: {money(quote.discountVnd, lang)}</p>
    <strong>{text(lang, "Tong cong", "Total")}: {money(quote.totalVnd, lang)}</strong>
    {onConfirm && <button type="button" onClick={onConfirm}>{text(lang, "Xac nhan gia nay", "Confirm this price")}</button>}
  </section>;
}
