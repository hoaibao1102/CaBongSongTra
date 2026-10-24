"use client";

import React, { useEffect, useState } from "react";
import type { Actor, Lang, KpiProgress } from "../types";
import type { CommissionLedgerEntry } from "./CommissionManager";
import { money, text } from "../i18n";
import { Target, CheckCircle, Gift } from "lucide-react";

export function MemberCommissions({ actor, ledger, lang }: { actor: Actor; ledger: CommissionLedgerEntry[]; lang: Lang }) {
  // /commissions/me is scoped by the authenticated session, not a supplied user ID.
  const entries = ledger.filter((entry) => !entry.memberId || entry.memberId === actor.id);
  const accrued = entries.filter((entry) => entry.kind === "COMMISSION").reduce((sum, entry) => sum + entry.amountVnd, 0);
  const bonus = entries.filter((entry) => entry.kind === "KPI_BONUS").reduce((sum, entry) => sum + entry.amountVnd, 0);
  const paid = entries.filter((entry) => entry.kind === "PAYOUT").reduce((sum, entry) => sum + entry.amountVnd, 0);
  const balance = accrued + bonus - paid;

  const [kpiData, setKpiData] = useState<KpiProgress | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/v1/kpi/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: KpiProgress | null) => {
        if (active && data?.hasActivePeriod) {
          setKpiData(data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-label={text(lang, "Hoa hồng của tôi", "My commissions")}>
      <div style={{ marginBottom: 20 }}>
        <h2>{text(lang, "Thu nhập & Thưởng KPI", "Earnings & KPI Bonuses")}</h2>
        <p style={{ color: "var(--muted, #64748b)", margin: "4px 0 0 0" }}>{actor.displayName}</p>
      </div>

      {/* KPI Progress Gamification Card */}
      {kpiData && kpiData.hasActivePeriod && kpiData.period && kpiData.policy && (
        <div
          className="apex-card"
          style={{
            marginBottom: 24,
            padding: "20px 24px",
            background: "linear-gradient(135deg, rgba(235, 94, 40, 0.08) 0%, rgba(37, 99, 235, 0.05) 100%)",
            border: "1px solid rgba(235, 94, 40, 0.2)",
            borderRadius: 14,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: "#ea580c", color: "#ffffff", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
                <Target size={14} />
                <span>{kpiData.period.name}</span>
              </div>
              <h3 style={{ margin: "4px 0 6px 0", fontSize: 18, color: "#1e293b" }}>
                {text(lang, "Tiến độ đạt thưởng KPI kỳ này", "Current Period KPI Target")}
              </h3>
              <p style={{ margin: 0, fontSize: 13.5, color: "#475569" }}>
                {text(lang, "Chính sách:", "Policy:")} <strong>{kpiData.policy.name}</strong>
              </p>
            </div>

            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#64748b" }}>{text(lang, "Đã giao thành công", "Delivered Products")}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#ea580c", fontFamily: "var(--font-mono)" }}>
                {kpiData.currentQty ?? 0} <span style={{ fontSize: 14, fontWeight: 600 }}>{text(lang, "sản phẩm", "items")}</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ margin: "18px 0 12px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span>
                {kpiData.achievedTier ? (
                  <span style={{ color: "#15803d", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle size={15} />
                    {text(lang, `Đã đạt mốc ${kpiData.achievedTier.minQty} sp: Thưởng ${money(kpiData.achievedTier.bonusVnd, lang)}`, `Achieved ${kpiData.achievedTier.minQty} items: ${money(kpiData.achievedTier.bonusVnd, lang)} bonus`)}
                  </span>
                ) : (
                  <span style={{ color: "#64748b" }}>{text(lang, "Chưa đạt mốc thưởng đầu tiên", "No tier reached yet")}</span>
                )}
              </span>
              {kpiData.nextTier && (
                <span style={{ color: "#c2410c", fontWeight: 600 }}>
                  {text(lang, `Còn thiếu ${kpiData.remainingQtyToNextTier} sp để nhận ${money(kpiData.nextTier.bonusVnd, lang)}`, `${kpiData.remainingQtyToNextTier} more items to reach ${money(kpiData.nextTier.bonusVnd, lang)}`)}
                </span>
              )}
            </div>

            <div style={{ height: 10, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${kpiData.progressPercent ?? 0}%`,
                  background: "linear-gradient(90deg, #ea580c 0%, #16a34a 100%)",
                  borderRadius: 999,
                  transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                }}
              />
            </div>
          </div>

          {/* Tier Milestones list */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            {(kpiData.policy.tiers || []).map((t) => {
              const achieved = (kpiData.currentQty ?? 0) >= t.minQty;
              return (
                <div
                  key={t.minQty}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: achieved ? "#dcfce7" : "#f1f5f9",
                    color: achieved ? "#166534" : "#475569",
                    border: achieved ? "1px solid #86efac" : "1px solid #e2e8f0",
                    fontWeight: achieved ? 700 : 500,
                  }}
                >
                  <Gift size={13} />
                  <span>
                    &ge; {t.minQty} sp &rarr; <strong>{money(t.bonusVnd, lang)}</strong>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="cbst-kpi-grid">
        {[
          [text(lang, "Hoa hồng đơn hàng", "Accrued commission"), accrued],
          [text(lang, "Thưởng KPI đã chốt", "KPI Bonus"), bonus],
          [text(lang, "Đã nhận thanh toán", "Paid to you"), paid],
          [text(lang, "Số dư khả dụng", "Available balance"), balance],
        ].map(([title, val]) => (
          <div className="apex-card" key={String(title)}>
            <p>{title}</p>
            <strong>{money(Number(val), lang)}</strong>
          </div>
        ))}
      </div>

      <h3 style={{ marginTop: 28 }}>{text(lang, "Lịch sử hoa hồng, thưởng KPI & chi trả", "Commission and payout history")}</h3>
      {!entries.length ? (
        <p>{text(lang, "Bạn chưa có hoa hồng phát sinh.", "You have no commission entries yet.")}</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{text(lang, "Ngày", "Date")}</th>
                <th>{text(lang, "Tham chiếu / Đơn", "Reference / Order")}</th>
                <th>{text(lang, "Nội dung", "Description")}</th>
                <th>{text(lang, "Số tiền", "Amount")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isBonus = entry.kind === "KPI_BONUS";
                const isPayout = entry.kind === "PAYOUT";
                return (
                  <tr key={entry.id}>
                    <td>{new Date(entry.createdAt).toLocaleString(lang === "vi" ? "vi-VN" : "en-US", { timeZone: "Asia/Ho_Chi_Minh" })}</td>
                    <td>{entry.orderId ? `CBST-${entry.orderId}` : entry.reference || "—"}</td>
                    <td>
                      {isBonus ? (
                        <span style={{ color: "#16a34a", fontWeight: 600 }}>
                          {entry.reason || text(lang, "Thưởng đạt KPI", "KPI Bonus")}
                        </span>
                      ) : isPayout ? (
                        text(lang, "Chi trả hoa hồng", "Commission payout")
                      ) : entry.amountVnd < 0 ? (
                        text(lang, "Điều chỉnh giảm", "Commission adjustment")
                      ) : (
                        text(lang, "Hoa hồng đơn hàng", "Order commission")
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: isPayout ? "#dc2626" : isBonus ? "#16a34a" : undefined }}>
                      {isPayout ? `-${money(entry.amountVnd, lang)}` : `+${money(entry.amountVnd, lang)}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

