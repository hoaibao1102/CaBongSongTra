"use client";

import type { Actor, Lang } from "../types";
import type { CommissionLedgerEntry } from "./CommissionManager";
import { money, text } from "../i18n";

export function MemberCommissions({ actor, ledger, lang }: { actor: Actor; ledger: CommissionLedgerEntry[]; lang: Lang }) {
  // /commissions/me is scoped by the authenticated session, not a supplied user ID.
  const entries = ledger.filter((entry) => !entry.memberId || entry.memberId === actor.id);
  const accrued = entries.filter((entry) => entry.kind === "COMMISSION").reduce((sum, entry) => sum + entry.amountVnd, 0);
  const paid = entries.filter((entry) => entry.kind === "PAYOUT").reduce((sum, entry) => sum + entry.amountVnd, 0);
  return (
    <section aria-label={text(lang, "Hoa hồng của tôi", "My commissions")}>
      <h2>{text(lang, "Hoa hồng của tôi", "My commissions")}</h2>
      <p>{actor.displayName}</p>
      <div className="cbst-kpi-grid">
        {[
          [text(lang, "Hoa hồng phát sinh", "Accrued commission"), accrued],
          [text(lang, "Đã nhận", "Paid to you"), paid],
          [text(lang, "Số dư hoa hồng", "Commission balance"), accrued - paid],
        ].map(([title, value]) => <div className="apex-card" key={String(title)}><p>{title}</p><strong>{money(Number(value), lang)}</strong></div>)}
      </div>
      <h3>{text(lang, "Lịch sử hoa hồng và chi trả", "Commission and payout history")}</h3>
      {!entries.length ? <p>{text(lang, "Bạn chưa có hoa hồng phát sinh.", "You have no commission entries yet.")}</p> : (
        <div className="table-scroll">
          <table>
            <thead><tr>
              <th>{text(lang, "Ngày", "Date")}</th><th>{text(lang, "Đơn hàng", "Order")}</th>
              <th>{text(lang, "Nội dung", "Description")}</th><th>{text(lang, "Số tiền", "Amount")}</th>
            </tr></thead>
            <tbody>{entries.map((entry) => <tr key={entry.id}>
              <td>{new Date(entry.createdAt).toLocaleString(lang === "vi" ? "vi-VN" : "en-US", { timeZone: "Asia/Ho_Chi_Minh" })}</td>
              <td>{entry.orderId ? `CBST-${entry.orderId}` : "—"}</td>
              <td>{entry.kind === "PAYOUT" ? text(lang, "Chi trả hoa hồng", "Commission payout") : entry.amountVnd < 0 ? text(lang, "Điều chỉnh giảm", "Commission adjustment") : text(lang, "Hoa hồng đơn hàng", "Order commission")}</td>
              <td>{money(entry.amountVnd, lang)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
