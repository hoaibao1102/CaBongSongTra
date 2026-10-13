"use client";

import React, { useState, useMemo } from "react";
import {
  BadgePercent,
  Banknote,
  Wallet,
  CheckCircle2,
  Search,
  CreditCard,
  History,
} from "lucide-react";
import { Modal } from "./Modal";
import { CurrencyInput } from "./CurrencyInput";
import { SearchableSelect } from "./SearchableSelect";
import { KpiCard } from "./KpiCard";
import { ApiError, createMutation } from "../commerce";
import { money, text } from "../i18n";
import type { Lang, MemberUser } from "../types";
const durableMutation = createMutation();

export interface CommissionLedgerEntry {
  id: string;
  orderId?: string;
  memberId?: string;
  kind: "COMMISSION" | "PAYOUT";
  amountVnd: number;
  reference?: string;
  reason?: string;
  createdAt: string;
}

export interface CommissionManagerProps {
  users: MemberUser[];
  ledger: CommissionLedgerEntry[];
  lang: Lang;
  onRefresh: () => void;
  onUnauthorized?: () => void;
}

export function CommissionManager({
  users,
  ledger,
  lang,
  onRefresh,
  onUnauthorized,
}: CommissionManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<"ALL" | "HAS_BALANCE">("ALL");

  // Payout Modal
  const [isPayoutOpen, setIsPayoutOpen] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [isFullPayout, setIsFullPayout] = useState(true);
  const [payoutAmount, setPayoutAmount] = useState(0);
  const [method, setMethod] = useState<"BANK_TRANSFER" | "CASH">("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [period, setPeriod] = useState(
    `Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
  );
  const [payoutNote, setPayoutNote] = useState("");
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  // Member Detail Drawer/Modal
  const [detailUser, setDetailUser] = useState<MemberUser | null>(null);

  // Per-member calculation
  const memberSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        totalAccrued: number;
        totalPaid: number;
        balance: number;
        entries: CommissionLedgerEntry[];
      }
    >();

    for (const u of users) {
      if (u.role === "MEMBER") {
        map.set(u.id, { totalAccrued: 0, totalPaid: 0, balance: 0, entries: [] });
      }
    }

    for (const entry of ledger) {
      if (!entry.memberId) continue;
      let rec = map.get(entry.memberId);
      if (!rec) {
        rec = { totalAccrued: 0, totalPaid: 0, balance: 0, entries: [] };
        map.set(entry.memberId, rec);
      }
      rec.entries.push(entry);
      if (entry.kind === "COMMISSION") {
        rec.totalAccrued += entry.amountVnd;
        rec.balance += entry.amountVnd;
      } else if (entry.kind === "PAYOUT") {
        rec.totalPaid += entry.amountVnd;
        rec.balance -= entry.amountVnd;
      }
    }

    return map;
  }, [users, ledger]);

  // Overall KPIs
  const kpis = useMemo(() => {
    let totalAccrued = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    memberSummaries.forEach((val) => {
      totalAccrued += val.totalAccrued;
      totalPaid += val.totalPaid;
      totalBalance += Math.max(0, val.balance);
    });

    return {
      totalAccrued,
      totalPaid,
      totalBalance,
    };
  }, [memberSummaries]);

  // Selected Member for Payout
  const selectedMemberSummary = selectedMemberId
    ? memberSummaries.get(selectedMemberId)
    : null;
  const availableBalance = Math.max(0, selectedMemberSummary?.balance ?? 0);

  // Filtered members list
  const memberList = useMemo(() => {
    return users
      .filter((u) => u.role === "MEMBER")
      .filter((u) => {
        if (balanceFilter === "HAS_BALANCE") {
          const sum = memberSummaries.get(u.id);
          if ((sum?.balance ?? 0) <= 0) return false;
        }
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
          u.displayName.toLowerCase().includes(q) ||
          u.emailNormalized.toLowerCase().includes(q)
        );
      });
  }, [users, memberSummaries, balanceFilter, searchQuery]);

  // Open payout for a specific member
  const openPayoutForMember = (member: MemberUser) => {
    setSelectedMemberId(member.id);
    const sum = memberSummaries.get(member.id);
    const bal = Math.max(0, sum?.balance ?? 0);
    setPayoutAmount(bal);
    setIsFullPayout(true);
    setReference(`PAY-${member.displayName.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`);
    setPayoutError(null);
    setIsPayoutOpen(true);
  };

  // Submit Payout
  const handlePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutError(null);

    if (!selectedMemberId) {
      setPayoutError("Vui lòng chọn thành viên cần chi trả.");
      return;
    }

    const payVal = isFullPayout ? availableBalance : payoutAmount;
    if (payVal <= 0) {
      setPayoutError("Số tiền chi trả phải lớn hơn 0.");
      return;
    }
    if (payVal > availableBalance) {
      setPayoutError(`Số tiền chi trả tối đa là ${money(availableBalance, lang)}.`);
      return;
    }

    setPayoutSubmitting(true);
    try {
      const payload = {
        memberId: selectedMemberId,
        reference: reference.trim() || `PAY-${Date.now()}`,
        amountVnd: payVal,
        period: period.trim() || undefined,
        note: payoutNote.trim() || undefined,
      };

      await durableMutation("commissions/payouts", payload);

      setIsPayoutOpen(false);
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401 && onUnauthorized) {
        onUnauthorized();
      } else if (err instanceof ApiError) {
        setPayoutError(err.message || "Không thể thực hiện chi trả.");
      } else {
        setPayoutError("Đã xảy ra lỗi không xác định.");
      }
    } finally {
      setPayoutSubmitting(false);
    }
  };

  return (
    <div className="cbst-commission-manager">
      {/* KPI Cards */}
      <div className="cbst-kpi-grid">
        <KpiCard
          title={text(lang, "Tổng hoa hồng phát sinh", "Total Accrued")}
          value={money(kpis.totalAccrued, lang)}
          subtext={text(
            lang,
            "Tính trên các đơn đã giao và thu đủ tiền",
            "Eligible delivered & paid orders",
          )}
          icon={BadgePercent}
          variant="brand"
        />
        <KpiCard
          title={text(lang, "Đã chi trả cho CTV", "Total Paid Out")}
          value={money(kpis.totalPaid, lang)}
          subtext={text(
            lang,
            "Đã thực hiện lệnh thanh toán",
            "Executed payouts",
          )}
          icon={Banknote}
          variant="emerald"
        />
        <KpiCard
          title={text(lang, "Còn phải thanh toán", "Outstanding Balance")}
          value={money(kpis.totalBalance, lang)}
          subtext={text(
            lang,
            "Số dư hoa hồng khả dụng của đội ngũ CTV",
            "Available member balances",
          )}
          icon={Wallet}
          variant={kpis.totalBalance > 0 ? "amber" : "neutral"}
        />
      </div>

      {/* Control Bar */}
      <div
        className="cbst-table-controls"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          margin: "18px 0 16px 0",
        }}
      >
        <div
          className="cbst-filter-group"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            flex: 1,
            minWidth: 260,
          }}
        >
          <div
            className="cbst-search-input-wrap"
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              width: 280,
              maxWidth: "100%",
            }}
          >
            <Search
              size={16}
              className="cbst-search-icon"
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#94a3b8",
                pointerEvents: "none",
                zIndex: 2,
              }}
            />
            <input
              type="text"
              placeholder={text(lang, "Tìm thành viên...", "Search member...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="cbst-table-search"
              style={{
                width: "100%",
                height: 38,
                padding: "0 12px 0 36px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 13.5,
                background: "#ffffff",
                color: "#1e293b",
                margin: 0,
              }}
            />
          </div>

          <select
            value={balanceFilter}
            onChange={(e) => setBalanceFilter(e.target.value as "ALL" | "HAS_BALANCE")}
            className="cbst-select-filter"
            style={{
              width: "auto",
              minWidth: 160,
              height: 38,
              padding: "0 28px 0 12px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 13,
              fontWeight: 500,
              background: "#ffffff",
              color: "#334155",
              margin: 0,
              cursor: "pointer",
            }}
          >
            <option value="ALL">{text(lang, "Tất cả CTV", "All members")}</option>
            <option value="HAS_BALANCE">{text(lang, "Có số dư khả dụng", "Has available balance")}</option>
          </select>
        </div>

        <div
          className="cbst-action-group"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginLeft: "auto",
          }}
        >
          <button
            type="button"
            className="button primary"
            style={{
              height: 38,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "0 14px",
              fontSize: 13.5,
              fontWeight: 600,
              borderRadius: 8,
              whiteSpace: "nowrap",
              margin: 0,
            }}
            onClick={() => {
              if (memberList.length > 0) {
                openPayoutForMember(memberList[0]);
              }
            }}
          >
            <Banknote size={16} />
            <span>{text(lang, "Tạo lệnh chi trả", "Payout Commission")}</span>
          </button>
        </div>
      </div>

      {/* Members Commission Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>{text(lang, "Thành viên (CTV)", "Member")}</th>
              <th style={{ textAlign: "center" }}>{text(lang, "Tỷ lệ", "Rate")}</th>
              <th style={{ textAlign: "right" }}>{text(lang, "Hoa hồng phát sinh", "Total Accrued")}</th>
              <th style={{ textAlign: "right" }}>{text(lang, "Đã thanh toán", "Paid")}</th>
              <th style={{ textAlign: "right" }}>{text(lang, "Còn phải trả", "Available Balance")}</th>
              <th>{text(lang, "Tài khoản nhận tiền", "Bank Account")}</th>
              <th style={{ textAlign: "center" }}>{text(lang, "Thao tác", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {memberList.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "#a8a29e" }}>
                  {text(lang, "Chưa có thành viên nào", "No members found")}
                </td>
              </tr>
            ) : (
              memberList.map((m) => {
                const summary = memberSummaries.get(m.id) || {
                  totalAccrued: 0,
                  totalPaid: 0,
                  balance: 0,
                  entries: [],
                };
                const ratePercent = (m.commissionRateBps ?? 4000) / 100;
                const canPayout = summary.balance > 0;

                return (
                  <tr key={m.id}>
                    <td>
                      <strong style={{ color: "#1c1917" }}>{m.displayName}</strong>
                      <div style={{ fontSize: "0.8rem", color: "#78716c" }}>
                        {m.emailNormalized}
                      </div>
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>{ratePercent}%</td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {money(summary.totalAccrued, lang)}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: "#15803d" }}>
                      {money(summary.totalPaid, lang)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, fontFamily: "var(--font-mono)", color: summary.balance > 0 ? "#d97706" : "#78716c" }}>
                      {money(Math.max(0, summary.balance), lang)}
                    </td>
                    <td>
                      {m.bankInfo?.bankName ? (
                        <div style={{ fontSize: "0.85rem" }}>
                          <strong>{m.bankInfo.bankName}</strong> ·{" "}
                          <span>{m.bankInfo.accountNumber}</span>
                          <div style={{ color: "#78716c", fontSize: "0.78rem" }}>
                            {m.bankInfo.accountHolder}
                          </div>
                        </div>
                      ) : (
                        <span className="muted">{text(lang, "Chưa có", "None")}</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        {canPayout && (
                          <button
                            type="button"
                            className="button primary"
                            style={{ padding: "4px 10px", fontSize: "0.82rem" }}
                            onClick={() => openPayoutForMember(m)}
                          >
                            {text(lang, "Chi trả", "Payout")}
                          </button>
                        )}
                        <button
                          type="button"
                          className="button secondary"
                          style={{ padding: "4px 8px", fontSize: "0.82rem" }}
                          onClick={() => setDetailUser(m)}
                          title="Xem lịch sử"
                        >
                          <History size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Payout Modal */}
      <Modal
        isOpen={isPayoutOpen}
        onClose={() => setIsPayoutOpen(false)}
        title={text(lang, "Lập lệnh chi trả hoa hồng", "Commission Payout")}
        subtitle={text(
          lang,
          "Ghi nhận thanh toán hoa hồng cho cộng tác viên, hỗ trợ thanh toán toàn bộ hoặc từng phần",
          "Record payout to member, supports full or partial settlements",
        )}
        size="md"
      >
        <form onSubmit={handlePayoutSubmit}>
          {payoutError && (
            <div className="notice error" role="alert" style={{ marginBottom: 16 }}>
              {payoutError}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Thành viên nhận tiền", "Member recipient")} *</span>
              <SearchableSelect
                options={memberList.map((m) => {
                  const bal = Math.max(0, memberSummaries.get(m.id)?.balance ?? 0);
                  return {
                    value: m.id,
                    label: m.displayName,
                    badge: `Khả dụng: ${money(bal, lang)}`,
                    sublabel: m.bankInfo?.bankName
                      ? `${m.bankInfo.bankName} - ${m.bankInfo.accountNumber}`
                      : "Chưa có tài khoản ngân hàng",
                  };
                })}
                value={selectedMemberId}
                onChange={(val) => {
                  setSelectedMemberId(val);
                  const bal = Math.max(0, memberSummaries.get(val)?.balance ?? 0);
                  setPayoutAmount(bal);
                }}
                placeholder={text(lang, "Chọn thành viên...", "Select member...")}
                required
              />
            </label>
          </div>

          <div className="cbst-payout-balance-box" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{text(lang, "Số dư khả dụng hiện tại:", "Available balance:")}</span>
              <strong style={{ fontSize: "1.15rem", color: "#d84012", fontFamily: "var(--font-mono)" }}>
                {money(availableBalance, lang)}
              </strong>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Hình thức thanh toán", "Payout option")} *</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 6 }}>
                <button
                  type="button"
                  className={`cbst-scope-card ${isFullPayout ? "selected" : ""}`}
                  onClick={() => {
                    setIsFullPayout(true);
                    setPayoutAmount(availableBalance);
                  }}
                >
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>{text(lang, "Toàn bộ số dư", "Full Balance")}</strong>
                    <small>{money(availableBalance, lang)}</small>
                  </div>
                </button>
                <button
                  type="button"
                  className={`cbst-scope-card ${!isFullPayout ? "selected" : ""}`}
                  onClick={() => setIsFullPayout(false)}
                >
                  <Wallet size={18} />
                  <div>
                    <strong>{text(lang, "Thanh toán một phần", "Partial Payout")}</strong>
                    <small>{text(lang, "Nhập số tiền tùy chọn", "Custom amount")}</small>
                  </div>
                </button>
              </div>
            </label>
          </div>

          {!isFullPayout && (
            <div style={{ marginBottom: 16 }}>
              <label>
                <span>{text(lang, "Số tiền muốn chi trả (VND)", "Amount to pay (VND)")} *</span>
                <CurrencyInput
                  value={payoutAmount}
                  onChange={(val) => setPayoutAmount(val)}
                  max={availableBalance}
                  min={1}
                  required
                />
              </label>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Phương thức", "Method")} *</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as "BANK_TRANSFER" | "CASH")}
              >
                <option value="BANK_TRANSFER">{text(lang, "Chuyển khoản ngân hàng", "Bank transfer")}</option>
                <option value="CASH">{text(lang, "Tiền mặt", "Cash")}</option>
              </select>
            </label>

            <label>
              <span>{text(lang, "Kỳ đối soát", "Accounting Period")}</span>
              <input
                type="text"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="VD: Tháng 10/2026"
              />
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Mã tham chiếu / Mã giao dịch", "Transaction Reference")} *</span>
              <input
                type="text"
                required
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="VD: FT261012-0012, PAY-01..."
              />
            </label>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label>
              <span>{text(lang, "Ghi chú chi trả", "Payout Note")}</span>
              <textarea
                rows={2}
                value={payoutNote}
                onChange={(e) => setPayoutNote(e.target.value)}
                placeholder={text(lang, "Thông tin thêm về đợt chuyển khoản...", "Additional transfer details...")}
              />
            </label>
          </div>

          <div className="cbst-modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setIsPayoutOpen(false)}
              disabled={payoutSubmitting}
            >
              {text(lang, "Hủy bỏ", "Cancel")}
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={payoutSubmitting || availableBalance <= 0}
            >
              {payoutSubmitting
                ? text(lang, "Đang xử lý...", "Processing...")
                : text(lang, "Xác nhận chi trả", "Execute Payout")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Member Details Drawer */}
      <Modal
        isOpen={!!detailUser}
        onClose={() => setDetailUser(null)}
        title={text(lang, "Chi tiết hoa hồng thành viên", "Member Commission Details")}
        subtitle={detailUser ? `${detailUser.displayName} (${detailUser.emailNormalized})` : ""}
        size="lg"
      >
        {detailUser && (
          <div>
            {/* Bank Card */}
            <div style={{ padding: 16, background: "#fafaf9", borderRadius: 12, marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <CreditCard size={18} color="#d84012" />
                <strong style={{ color: "#1c1917" }}>{text(lang, "Tài khoản nhận tiền", "Bank account")}</strong>
              </div>
              {detailUser.bankInfo?.bankName ? (
                <div style={{ fontSize: "0.92rem", color: "#44403c" }}>
                  <span>{detailUser.bankInfo.bankName}</span> ·{" "}
                  <strong>{detailUser.bankInfo.accountNumber}</strong> ·{" "}
                  <span>{detailUser.bankInfo.accountHolder}</span>
                  {detailUser.bankInfo.note && (
                    <div style={{ fontSize: "0.82rem", color: "#78716c", marginTop: 4 }}>
                      Ghi chú: {detailUser.bankInfo.note}
                    </div>
                  )}
                </div>
              ) : (
                <span className="muted">{text(lang, "Chưa cập nhật tài khoản ngân hàng.", "No bank info set.")}</span>
              )}
            </div>

            {/* History Table */}
            <div style={{ marginBottom: 12 }}>
              <strong style={{ color: "#1c1917" }}>{text(lang, "Lịch sử biến động hoa hồng & chi trả", "Ledger History")}</strong>
            </div>

            <div className="table-wrapper" style={{ maxHeight: "40vh", overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>{text(lang, "Thời gian", "Date")}</th>
                    <th>{text(lang, "Nghiệp vụ", "Kind")}</th>
                    <th style={{ textAlign: "right" }}>{text(lang, "Số tiền", "Amount")}</th>
                    <th>{text(lang, "Đơn / Mã tham chiếu", "Order / Reference")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(memberSummaries.get(detailUser.id)?.entries ?? []).map((entry) => {
                    const isAccrual = entry.kind === "COMMISSION";
                    return (
                      <tr key={entry.id}>
                        <td>{new Date(entry.createdAt).toLocaleDateString("vi-VN")}</td>
                        <td>
                          {isAccrual ? (
                            <span className="badge success">{text(lang, "Phát sinh (+)", "Accrual")}</span>
                          ) : (
                            <span className="badge warning">{text(lang, "Chi trả (-)", "Payout")}</span>
                          )}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 700,
                            fontFamily: "var(--font-mono)",
                            color: isAccrual ? "#15803d" : "#d97706",
                          }}
                        >
                          {isAccrual ? "+" : "-"}{money(Math.abs(entry.amountVnd), lang)}
                        </td>
                        <td>
                          {entry.reference ? (
                            <span className="cbst-code-badge">{entry.reference}</span>
                          ) : entry.orderId ? (
                            <span className="cbst-code-badge">Đơn: {entry.orderId.slice(0, 8)}...</span>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="cbst-modal-actions" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setDetailUser(null)}
              >
                {text(lang, "Đóng", "Close")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
