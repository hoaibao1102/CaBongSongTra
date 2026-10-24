"use client";
import { useActorMutation } from "../operation-actor";

import React, { useState, useMemo, useEffect } from "react";
import {
  BadgePercent,
  Banknote,
  Wallet,
  CheckCircle2,
  Search,
  Target,
  Plus,
  Trash2,
  Eye,
  Calendar,
  CheckCircle,
} from "lucide-react";
import { Modal } from "./Modal";
import { CurrencyInput } from "./CurrencyInput";
import { SearchableSelect } from "./SearchableSelect";
import { KpiCard } from "./KpiCard";
import { ApiError } from "../commerce";
import { money, text, errorText } from "../i18n";
import type { Lang, MemberUser, KpiPolicy, KpiPeriod, KpiTier } from "../types";



export interface CommissionLedgerEntry {
  id: string;
  orderId?: string;
  memberId?: string;
  kind: "COMMISSION" | "PAYOUT" | "KPI_BONUS";
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
  const durableMutation = useActorMutation();
  const [activeTab, setActiveTab] = useState<"PAYOUTS" | "KPI">("PAYOUTS");

  // Filters for Payouts Tab
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

  // KPI Data
  const [kpiPolicies, setKpiPolicies] = useState<KpiPolicy[]>([]);
  const [kpiPeriods, setKpiPeriods] = useState<KpiPeriod[]>([]);
  const [, setKpiLoading] = useState(false);

  // KPI Policy Modal
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [policyName, setPolicyName] = useState("Thưởng KPI Doanh số");
  const [periodType, setPeriodType] = useState<"MONTHLY" | "WEEKLY" | "CUSTOM">("MONTHLY");
  const [tiers, setTiers] = useState<KpiTier[]>([
    { minQty: 20, bonusVnd: 50000 },
    { minQty: 30, bonusVnd: 80000 },
    { minQty: 50, bonusVnd: 150000 },
  ]);
  const [policySubmitting, setPolicySubmitting] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  // KPI Period Modal
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [periodPolicyId, setPeriodPolicyId] = useState("");
  const [periodName, setPeriodName] = useState(`Kỳ Tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}`);
  const [startDateStr, setStartDateStr] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
  });
  const [endDateStr, setEndDateStr] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0];
  });
  const [periodSubmitting, setPeriodSubmitting] = useState(false);
  const [periodError, setPeriodError] = useState<string | null>(null);

  // Preview / Settle Modal
  const [previewPeriod, setPreviewPeriod] = useState<KpiPeriod | null>(null);
  const [previewData, setPreviewData] = useState<{
    period: KpiPeriod;
    policy: KpiPolicy;
    members: {
      memberId: string;
      displayName: string;
      email: string;
      deliveredQty: number;
      achievedTierQty: number | null;
      bonusVnd: number;
      settled: boolean;
    }[];
    totalBonusVnd: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleSuccess, setSettleSuccess] = useState<string | null>(null);

  // Fetch KPI data on tab switch or mount
  const fetchKpiData = async () => {
    setKpiLoading(true);
    try {
      const [policiesRes, periodsRes] = await Promise.all([
        fetch("/api/v1/kpi/policies"),
        fetch("/api/v1/kpi/periods"),
      ]);
      if (policiesRes.ok) {
        const pols: KpiPolicy[] = await policiesRes.json();
        setKpiPolicies(pols);
        if (pols.length > 0 && !periodPolicyId) {
          setPeriodPolicyId(pols[0].id);
        }
      }
      if (periodsRes.ok) {
        setKpiPeriods(await periodsRes.json());
      }
    } catch {
      // ignore
    } finally {
      setKpiLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "KPI") {
      fetchKpiData();
    }
  }, [activeTab]);

  // Per-member calculation (Accruals, KPI Bonuses, Payouts, Balance)
  const memberSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        totalAccrued: number;
        totalBonus: number;
        totalPaid: number;
        balance: number;
        entries: CommissionLedgerEntry[];
      }
    >();

    for (const u of users) {
      if (u.role === "MEMBER") {
        map.set(u.id, { totalAccrued: 0, totalBonus: 0, totalPaid: 0, balance: 0, entries: [] });
      }
    }

    for (const entry of ledger) {
      if (!entry.memberId) continue;
      let rec = map.get(entry.memberId);
      if (!rec) {
        rec = { totalAccrued: 0, totalBonus: 0, totalPaid: 0, balance: 0, entries: [] };
        map.set(entry.memberId, rec);
      }
      rec.entries.push(entry);
      if (entry.kind === "COMMISSION") {
        rec.totalAccrued += entry.amountVnd;
        rec.balance += entry.amountVnd;
      } else if (entry.kind === "KPI_BONUS") {
        rec.totalBonus += entry.amountVnd;
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
    let totalBonus = 0;
    let totalPaid = 0;
    let totalBalance = 0;

    memberSummaries.forEach((val) => {
      totalAccrued += val.totalAccrued;
      totalBonus += val.totalBonus;
      totalPaid += val.totalPaid;
      totalBalance += Math.max(0, val.balance);
    });

    return {
      totalAccrued,
      totalBonus,
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
        reference: reference.trim() || "MANUAL-PAYOUT",
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
        setPayoutError(errorText(err, lang));
      }
    } finally {
      setPayoutSubmitting(false);
    }
  };

  // Save KPI Policy
  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setPolicyError(null);
    if (!tiers.length) {
      setPolicyError("Cần ít nhất một mốc thưởng.");
      return;
    }
    setPolicySubmitting(true);
    try {
      const payload = {
        name: policyName.trim(),
        periodType,
        metric: "PRODUCT_QTY",
        tiers: [...tiers].sort((a, b) => a.minQty - b.minQty),
        active: true,
      };
      await durableMutation("kpi/policies", payload);
      setIsPolicyModalOpen(false);
      await fetchKpiData();
    } catch (err: unknown) {
      if (err instanceof ApiError) setPolicyError(err.message);
      else setPolicyError("Không thể lưu chính sách KPI.");
    } finally {
      setPolicySubmitting(false);
    }
  };

  // Create KPI Period
  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setPeriodError(null);
    if (!periodPolicyId) {
      setPeriodError("Vui lòng chọn chính sách KPI.");
      return;
    }
    setPeriodSubmitting(true);
    try {
      const payload = {
        policyId: periodPolicyId,
        name: periodName.trim(),
        startDate: new Date(`${startDateStr}T00:00:00.000Z`).toISOString(),
        endDate: new Date(`${endDateStr}T23:59:59.999Z`).toISOString(),
      };
      await durableMutation("kpi/periods", payload);
      setIsPeriodModalOpen(false);
      await fetchKpiData();
    } catch (err: unknown) {
      if (err instanceof ApiError) setPeriodError(err.message);
      else setPeriodError("Không thể tạo kỳ KPI.");
    } finally {
      setPeriodSubmitting(false);
    }
  };

  // Open Preview Modal
  const openPreview = async (p: KpiPeriod) => {
    setPreviewPeriod(p);
    setPreviewLoading(true);
    setSettleError(null);
    setSettleSuccess(null);
    try {
      const res = await fetch(`/api/v1/kpi/periods/${p.id}/preview`);
      if (res.ok) {
        setPreviewData(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setPreviewLoading(false);
    }
  };

  // Settle Period
  const handleSettlePeriod = async () => {
    if (!previewPeriod) return;
    setSettling(true);
    setSettleError(null);
    try {
      await durableMutation(`kpi/periods/${previewPeriod.id}/settle`, {});
      setSettleSuccess(text(lang, "Đã chốt thưởng và cộng tiền vào ví CTV thành công!", "Period settled and bonuses credited to members!"));
      onRefresh();
      await fetchKpiData();
      await openPreview(previewPeriod);
    } catch (err: unknown) {
      if (err instanceof ApiError) setSettleError(err.message);
      else setSettleError("Không thể chốt kỳ KPI.");
    } finally {
      setSettling(false);
    }
  };

  return (
    <div className="cbst-commission-manager">
      {/* KPI Overview Cards */}
      <div className="cbst-kpi-grid">
        <KpiCard
          title={text(lang, "Hoa hồng đơn hàng phát sinh", "Total Accrued")}
          value={money(kpis.totalAccrued, lang)}
          subtext={text(
            lang,
            "Tính trên phần chênh lệch giá bán và giá vốn của đơn đã giao",
            "Delivered-order selling price minus product cost",
          )}
          icon={BadgePercent}
          variant="brand"
        />
        <KpiCard
          title={text(lang, "Thưởng KPI đã duyệt", "Total KPI Bonus")}
          value={money(kpis.totalBonus, lang)}
          subtext={text(
            lang,
            "Tiền thưởng đạt mốc sản phẩm các kỳ đã chốt",
            "Milestone bonuses achieved across periods",
          )}
          icon={Target}
          variant="purple"
        />
        <KpiCard
          title={text(lang, "Đã chi trả cho CTV", "Total Paid Out")}
          value={money(kpis.totalPaid, lang)}
          subtext={text(
            lang,
            "Đã thực hiện lệnh thanh toán chuyển khoản",
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
            "Tổng số dư khả dụng (Hoa hồng + Thưởng KPI)",
            "Available member balances (Commission + KPI Bonus)",
          )}
          icon={Wallet}
          variant={kpis.totalBalance > 0 ? "amber" : "neutral"}
        />
      </div>

      {/* Sub-tabs Navigation */}
      <div style={{ display: "flex", gap: 10, margin: "24px 0 16px 0", borderBottom: "1px solid #e2e8f0", paddingBottom: 10 }}>
        <button
          type="button"
          onClick={() => setActiveTab("PAYOUTS")}
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 14,
            border: "none",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: activeTab === "PAYOUTS" ? "#ea580c" : "#f1f5f9",
            color: activeTab === "PAYOUTS" ? "#ffffff" : "#475569",
            transition: "all 0.2s",
          }}
        >
          <Wallet size={16} />
          <span>{text(lang, "Bảng số dư & Chi trả CTV", "Member Balances & Payouts")}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("KPI")}
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 14,
            border: "none",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: activeTab === "KPI" ? "#ea580c" : "#f1f5f9",
            color: activeTab === "KPI" ? "#ffffff" : "#475569",
            transition: "all 0.2s",
          }}
        >
          <Target size={16} />
          <span>{text(lang, "Chính sách & Kỳ thưởng KPI", "KPI Policies & Periods")}</span>
        </button>
      </div>

      {activeTab === "PAYOUTS" && (
        <>
          {/* Control Bar */}
          <div
            className="cbst-table-controls"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              margin: "0 0 16px 0",
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
                  padding: "0 12px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 13.5,
                  background: "#ffffff",
                  color: "#1e293b",
                  margin: 0,
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

          {/* Members Commission & KPI Table */}
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{text(lang, "Thành viên (CTV)", "Member")}</th>
                  <th style={{ textAlign: "center" }}>{text(lang, "Tỷ lệ", "Rate")}</th>
                  <th style={{ textAlign: "right" }}>{text(lang, "Hoa hồng đơn", "Commissions")}</th>
                  <th style={{ textAlign: "right" }}>{text(lang, "Thưởng KPI", "KPI Bonus")}</th>
                  <th style={{ textAlign: "right" }}>{text(lang, "Đã thanh toán", "Paid")}</th>
                  <th style={{ textAlign: "right" }}>{text(lang, "Còn phải trả", "Available Balance")}</th>
                  <th>{text(lang, "Tài khoản nhận tiền", "Bank Account")}</th>
                  <th style={{ textAlign: "center" }}>{text(lang, "Thao tác", "Actions")}</th>
                </tr>
              </thead>
              <tbody>
                {memberList.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "#a8a29e" }}>
                      {text(lang, "Chưa có thành viên nào", "No members found")}
                    </td>
                  </tr>
                ) : (
                  memberList.map((m) => {
                    const summary = memberSummaries.get(m.id) || {
                      totalAccrued: 0,
                      totalBonus: 0,
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
                        <td style={{ textAlign: "right", fontFamily: "var(--font-mono)", color: summary.totalBonus > 0 ? "#16a34a" : "#64748b", fontWeight: summary.totalBonus > 0 ? 700 : 400 }}>
                          {summary.totalBonus > 0 ? `+${money(summary.totalBonus, lang)}` : "0₫"}
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
                              style={{ padding: "4px 10px", fontSize: "0.82rem" }}
                              onClick={() => setDetailUser(m)}
                            >
                              {text(lang, "Chi tiết", "Details")}
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
        </>
      )}

      {activeTab === "KPI" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Section 1: KPI Policy & Tiers */}
          <div className="apex-card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, color: "#1e293b" }}>
                  {text(lang, "Chính sách KPI & Mức thưởng bậc thang", "KPI Policy & Tiers")}
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>
                  {text(lang, "Các mức thưởng sản phẩm áp dụng cho thành viên khi hoàn thành kỳ", "Milestone bonuses granted to members for delivered products in period")}
                </p>
              </div>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  if (kpiPolicies.length > 0) {
                    const p = kpiPolicies[0];
                    setPolicyName(p.name);
                    setPeriodType(p.periodType);
                    setTiers(p.tiers);
                  }
                  setPolicyError(null);
                  setIsPolicyModalOpen(true);
                }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
              >
                <Plus size={15} />
                <span>{text(lang, "Cấu hình chính sách KPI", "Configure KPI Policy")}</span>
              </button>
            </div>

            {kpiPolicies.length === 0 ? (
              <p style={{ color: "#94a3b8", fontStyle: "italic" }}>
                {text(lang, "Chưa có chính sách KPI nào. Hãy bấm 'Cấu hình chính sách KPI' để tạo.", "No KPI policy yet. Click configure to create one.")}
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {kpiPolicies.map((p) => (
                  <div key={p.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, background: "#f8fafc" }}>
                    <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                      {text(lang, "Chu kỳ:", "Cycle:")} <strong>{p.periodType}</strong> · {text(lang, "Tiêu chí:", "Metric:")} <strong>{p.metric === "PRODUCT_QTY" ? "Số lượng sản phẩm" : "Doanh thu"}</strong>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {p.tiers.map((t, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, background: "#ffffff", padding: "6px 10px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                          <span>&ge; <strong>{t.minQty}</strong> {text(lang, "sản phẩm", "items")}</span>
                          <strong style={{ color: "#16a34a" }}>+{money(t.bonusVnd, lang)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: KPI Periods */}
          <div className="apex-card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, color: "#1e293b" }}>
                  {text(lang, "Danh sách các kỳ KPI", "KPI Periods")}
                </h3>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#64748b" }}>
                  {text(lang, "Theo dõi tiến độ, xem bảng thành tích và chốt thưởng kết chuyển vào ví CTV", "Track progress, preview achievements and settle bonuses into wallet")}
                </p>
              </div>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  setPeriodError(null);
                  setIsPeriodModalOpen(true);
                }}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}
              >
                <Calendar size={15} />
                <span>{text(lang, "Mở kỳ KPI mới", "Open KPI Period")}</span>
              </button>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>{text(lang, "Tên kỳ KPI", "Period Name")}</th>
                    <th>{text(lang, "Từ ngày", "Start Date")}</th>
                    <th>{text(lang, "Đến ngày", "End Date")}</th>
                    <th style={{ textAlign: "center" }}>{text(lang, "Trạng thái", "Status")}</th>
                    <th style={{ textAlign: "center" }}>{text(lang, "Thao tác", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiPeriods.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "#a8a29e" }}>
                        {text(lang, "Chưa có kỳ KPI nào được mở.", "No KPI periods created.")}
                      </td>
                    </tr>
                  ) : (
                    kpiPeriods.map((p) => {
                      const isSettled = p.status === "SETTLED";
                      return (
                        <tr key={p.id}>
                          <td><strong>{p.name}</strong></td>
                          <td>{new Date(p.startDate).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US")}</td>
                          <td>{new Date(p.endDate).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US")}</td>
                          <td style={{ textAlign: "center" }}>
                            {isSettled ? (
                              <span style={{ padding: "4px 10px", borderRadius: 20, background: "#dcfce7", color: "#166534", fontSize: 12, fontWeight: 700 }}>
                                {text(lang, "Đã chốt thưởng", "Settled")}
                              </span>
                            ) : (
                              <span style={{ padding: "4px 10px", borderRadius: 20, background: "#fed7aa", color: "#9a3412", fontSize: 12, fontWeight: 700 }}>
                                {text(lang, "Đang diễn ra", "In Progress")}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              className="button secondary"
                              style={{ padding: "4px 12px", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: 5 }}
                              onClick={() => openPreview(p)}
                            >
                              <Eye size={14} />
                              <span>{text(lang, "Bảng thành tích & Chốt", "Achievements & Settle")}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Payout Execution Modal */}
      <Modal
        isOpen={isPayoutOpen}
        onClose={() => !payoutSubmitting && setIsPayoutOpen(false)}
        title={text(lang, "Tạo lệnh chi trả thu nhập cho CTV", "Create Member Payout")}
      >
        <form onSubmit={handlePayoutSubmit} className="cbst-form">
          {payoutError && <div className="cbst-form-error">{payoutError}</div>}

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Thành viên nhận", "Recipient")} <span className="required-mark" aria-hidden="true">*</span></span>
              <SearchableSelect
                options={memberList.map((m) => {
                  const sum = memberSummaries.get(m.id);
                  const bal = Math.max(0, sum?.balance ?? 0);
                  return {
                    value: m.id,
                    label: `${m.displayName} (${m.emailNormalized}) - Khả dụng: ${money(bal, lang)}`,
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

          <div className="cbst-payout-balance-box" style={{ marginBottom: 16, background: "#f8fafc", padding: "12px 16px", borderRadius: 8, border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#475569" }}>{text(lang, "Tổng số dư khả dụng (Hoa hồng + Thưởng KPI):", "Total available balance:")}</span>
              <strong style={{ fontSize: "1.2rem", color: "#d84012", fontFamily: "var(--font-mono)" }}>
                {money(availableBalance, lang)}
              </strong>
            </div>
            {selectedMemberSummary && (
              <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: "0.82rem", color: "#64748b" }}>
                <span>{text(lang, "Hoa hồng đơn:", "Commission:")} <strong>{money(selectedMemberSummary.totalAccrued, lang)}</strong></span>
                <span>{text(lang, "Thưởng KPI:", "KPI Bonus:")} <strong style={{ color: "#16a34a" }}>{money(selectedMemberSummary.totalBonus, lang)}</strong></span>
                <span>{text(lang, "Đã chi trả:", "Paid:")} <strong>{money(selectedMemberSummary.totalPaid, lang)}</strong></span>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#374151" }}>
                {text(lang, "Hình thức thanh toán", "Payout option")} <span className="required-mark" aria-hidden="true">*</span>
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
          </div>

          {!isFullPayout && (
            <div style={{ marginBottom: 16 }}>
              <label>
                <span>{text(lang, "Số tiền muốn chi trả (VND)", "Amount to pay (VND)")} <span className="required-mark" aria-hidden="true">*</span></span>
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
              <span>{text(lang, "Phương thức", "Method")} <span className="required-mark" aria-hidden="true">*</span></span>
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
              <span>{text(lang, "Mã tham chiếu / Mã giao dịch", "Transaction Reference")} <span className="required-mark" aria-hidden="true">*</span></span>
              <input
                type="text"
                required
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="VD: PAY-20261016-001"
              />
            </label>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label>
              <span>{text(lang, "Ghi chú nội bộ", "Internal Note")}</span>
              <textarea
                value={payoutNote}
                onChange={(e) => setPayoutNote(e.target.value)}
                placeholder={text(lang, "Ghi chú chi trả hoa hồng và thưởng KPI...", "Note for this payout...")}
                rows={2}
              />
            </label>
          </div>

          <div className="cbst-modal-actions">
            <button
              type="button"
              className="button secondary"
              disabled={payoutSubmitting}
              onClick={() => setIsPayoutOpen(false)}
            >
              {text(lang, "Hủy", "Cancel")}
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={payoutSubmitting || availableBalance <= 0}
            >
              {payoutSubmitting ? text(lang, "Đang xử lý...", "Processing...") : text(lang, "Xác nhận chi trả", "Execute Payout")}
            </button>
          </div>
        </form>
      </Modal>

      {/* KPI Policy Configuration Modal */}
      <Modal
        isOpen={isPolicyModalOpen}
        onClose={() => !policySubmitting && setIsPolicyModalOpen(false)}
        title={text(lang, "Cấu hình Chính sách KPI & Bậc thang", "Configure KPI Policy & Tiers")}
      >
        <form onSubmit={handleSavePolicy} className="cbst-form">
          {policyError && <div className="cbst-form-error">{policyError}</div>}

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Tên chính sách", "Policy Name")} <span className="required-mark" aria-hidden="true">*</span></span>
              <input
                type="text"
                required
                value={policyName}
                onChange={(e) => setPolicyName(e.target.value)}
                placeholder="VD: Thưởng doanh số hũ Cá Bống theo tháng"
              />
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Chu kỳ", "Period Type")} <span className="required-mark" aria-hidden="true">*</span></span>
              <select
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value as "MONTHLY" | "WEEKLY" | "CUSTOM")}
              >
                <option value="MONTHLY">{text(lang, "Theo tháng (Monthly)", "Monthly")}</option>
                <option value="WEEKLY">{text(lang, "Theo tuần (Weekly)", "Weekly")}</option>
                <option value="CUSTOM">{text(lang, "Tùy chỉnh (Custom)", "Custom")}</option>
              </select>
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>{text(lang, "Các mức mốc thưởng (Bậc thang)", "Milestone Tiers")}</span>
              <button
                type="button"
                className="button secondary"
                style={{ padding: "4px 8px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                onClick={() => {
                  const lastQty = tiers.length ? tiers[tiers.length - 1].minQty + 10 : 10;
                  const lastBonus = tiers.length ? tiers[tiers.length - 1].bonusVnd + 30000 : 30000;
                  setTiers([...tiers, { minQty: lastQty, bonusVnd: lastBonus }]);
                }}
              >
                <Plus size={13} />
                <span>{text(lang, "Thêm mốc", "Add Tier")}</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {tiers.map((t, idx) => (
                <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ margin: 0 }}>
                      <span style={{ fontSize: 11.5, color: "#64748b" }}>{text(lang, "Mức sản phẩm tối thiểu", "Min Products")}</span>
                      <input
                        type="number"
                        min={1}
                        value={t.minQty}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10) || 1;
                          const copy = [...tiers];
                          copy[idx].minQty = val;
                          setTiers(copy);
                        }}
                        required
                      />
                    </label>
                  </div>
                  <div style={{ flex: 1.5 }}>
                    <label style={{ margin: 0 }}>
                      <span style={{ fontSize: 11.5, color: "#64748b" }}>{text(lang, "Tiền thưởng (VND)", "Bonus VND")}</span>
                      <CurrencyInput
                        value={t.bonusVnd}
                        onChange={(val) => {
                          const copy = [...tiers];
                          copy[idx].bonusVnd = val;
                          setTiers(copy);
                        }}
                        min={0}
                        required
                      />
                    </label>
                  </div>
                  {tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setTiers(tiers.filter((_, i) => i !== idx))}
                      style={{ border: "none", background: "transparent", color: "#ef4444", cursor: "pointer", marginTop: 18 }}
                      title="Xóa mốc"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="cbst-modal-actions">
            <button type="button" className="button secondary" onClick={() => setIsPolicyModalOpen(false)}>
              {text(lang, "Hủy", "Cancel")}
            </button>
            <button type="submit" className="button primary" disabled={policySubmitting}>
              {policySubmitting ? text(lang, "Đang lưu...", "Saving...") : text(lang, "Lưu chính sách", "Save Policy")}
            </button>
          </div>
        </form>
      </Modal>

      {/* KPI Open Period Modal */}
      <Modal
        isOpen={isPeriodModalOpen}
        onClose={() => !periodSubmitting && setIsPeriodModalOpen(false)}
        title={text(lang, "Mở kỳ đánh giá KPI mới", "Open New KPI Period")}
      >
        <form onSubmit={handleCreatePeriod} className="cbst-form">
          {periodError && <div className="cbst-form-error">{periodError}</div>}

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Chính sách KPI áp dụng", "KPI Policy")} <span className="required-mark" aria-hidden="true">*</span></span>
              <select
                value={periodPolicyId}
                onChange={(e) => setPeriodPolicyId(e.target.value)}
                required
              >
                {kpiPolicies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.tiers.length} mốc)
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Tên kỳ KPI", "Period Name")} <span className="required-mark" aria-hidden="true">*</span></span>
              <input
                type="text"
                required
                value={periodName}
                onChange={(e) => setPeriodName(e.target.value)}
                placeholder="VD: Kỳ Tháng 10/2026"
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
            <label>
              <span>{text(lang, "Ngày bắt đầu", "Start Date")} <span className="required-mark" aria-hidden="true">*</span></span>
              <input
                type="date"
                required
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
              />
            </label>
            <label>
              <span>{text(lang, "Ngày kết thúc", "End Date")} <span className="required-mark" aria-hidden="true">*</span></span>
              <input
                type="date"
                required
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
              />
            </label>
          </div>

          <div className="cbst-modal-actions">
            <button type="button" className="button secondary" onClick={() => setIsPeriodModalOpen(false)}>
              {text(lang, "Hủy", "Cancel")}
            </button>
            <button type="submit" className="button primary" disabled={periodSubmitting}>
              {periodSubmitting ? text(lang, "Đang mở kỳ...", "Creating...") : text(lang, "Tạo kỳ KPI", "Create Period")}
            </button>
          </div>
        </form>
      </Modal>

      {/* KPI Preview & Settle Modal */}
      <Modal
        isOpen={Boolean(previewPeriod)}
        onClose={() => setPreviewPeriod(null)}
        title={previewPeriod ? `${text(lang, "Bảng thành tích:", "Achievements:")} ${previewPeriod.name}` : ""}
      >
        <div style={{ minWidth: 480 }}>
          {settleError && <div className="cbst-form-error" style={{ marginBottom: 14 }}>{settleError}</div>}
          {settleSuccess && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: "#dcfce7", color: "#166534", marginBottom: 14, fontWeight: 600 }}>
              {settleSuccess}
            </div>
          )}

          {previewLoading ? (
            <p style={{ textAlign: "center", padding: 24, color: "#64748b" }}>{text(lang, "Đang tính toán kết quả...", "Computing results...")}</p>
          ) : previewData ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, background: "#f8fafc", padding: "10px 14px", borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{text(lang, "Tổng tiền thưởng dự kiến", "Total Bonus")}</div>
                  <strong style={{ fontSize: 18, color: "#16a34a" }}>{money(previewData.totalBonusVnd, lang)}</strong>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{text(lang, "Trạng thái kỳ", "Period Status")}</div>
                  <strong>{previewData.period.status === "SETTLED" ? text(lang, "Đã chốt & chuyển vào ví", "Settled into wallet") : text(lang, "Đang diễn ra (Chưa chốt)", "In progress (Unsettled)")}</strong>
                </div>
              </div>

              <div className="table-wrapper" style={{ maxHeight: 300, overflowY: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th>{text(lang, "Thành viên", "Member")}</th>
                      <th style={{ textAlign: "center" }}>{text(lang, "SP đã giao", "Delivered")}</th>
                      <th style={{ textAlign: "center" }}>{text(lang, "Mốc đạt", "Achieved Tier")}</th>
                      <th style={{ textAlign: "right" }}>{text(lang, "Tiền thưởng", "Bonus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.members.map((m) => (
                      <tr key={m.memberId}>
                        <td>
                          <strong>{m.displayName}</strong>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{m.email}</div>
                        </td>
                        <td style={{ textAlign: "center", fontWeight: 700 }}>{m.deliveredQty} sp</td>
                        <td style={{ textAlign: "center" }}>
                          {m.achievedTierQty ? (
                            <span style={{ padding: "3px 8px", borderRadius: 12, background: "#dcfce7", color: "#166534", fontSize: 12, fontWeight: 700 }}>
                              &ge; {m.achievedTierQty} sp
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: m.bonusVnd > 0 ? "#16a34a" : "#64748b" }}>
                          {m.bonusVnd > 0 ? `+${money(m.bonusVnd, lang)}` : "0₫"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="cbst-modal-actions" style={{ marginTop: 20 }}>
                <button type="button" className="button secondary" onClick={() => setPreviewPeriod(null)}>
                  {text(lang, "Đóng", "Close")}
                </button>
                {previewData.period.status === "OPEN" && (
                  <button
                    type="button"
                    className="button primary"
                    disabled={settling}
                    onClick={handleSettlePeriod}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#16a34a" }}
                  >
                    <CheckCircle size={16} />
                    <span>{settling ? text(lang, "Đang kết chuyển...", "Settling...") : text(lang, "Chốt thưởng & Kết chuyển vào ví CTV", "Settle & Credit into Wallet")}</span>
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      {/* Member Details Drawer */}
      <Modal
        isOpen={Boolean(detailUser)}
        onClose={() => setDetailUser(null)}
        title={detailUser ? `${text(lang, "Chi tiết thu nhập:", "Earnings Detail:")} ${detailUser.displayName}` : ""}
      >
        {detailUser && (
          <div className="cbst-member-detail-modal">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>{text(lang, "Email:", "Email:")}</span>
                <div style={{ fontWeight: 600 }}>{detailUser.emailNormalized}</div>
              </div>
              <div style={{ background: "#f8fafc", padding: 12, borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: "#64748b" }}>{text(lang, "Tỷ lệ hoa hồng:", "Rate:")}</span>
                <div style={{ fontWeight: 600 }}>{(detailUser.commissionRateBps ?? 4000) / 100}%</div>
              </div>
            </div>

            {/* Financial Summary */}
            {(() => {
              const sum = memberSummaries.get(detailUser.id) || {
                totalAccrued: 0,
                totalBonus: 0,
                totalPaid: 0,
                balance: 0,
                entries: [],
              };
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
                  <div style={{ background: "#f0fdf4", padding: 10, borderRadius: 8, border: "1px solid #bbf7d0" }}>
                    <div style={{ fontSize: 11, color: "#166534" }}>{text(lang, "Hoa hồng đơn", "Commissions")}</div>
                    <strong style={{ fontSize: 14, color: "#166534" }}>{money(sum.totalAccrued, lang)}</strong>
                  </div>
                  <div style={{ background: "#eef2ff", padding: 10, borderRadius: 8, border: "1px solid #c7d2fe" }}>
                    <div style={{ fontSize: 11, color: "#3730a3" }}>{text(lang, "Thưởng KPI", "KPI Bonus")}</div>
                    <strong style={{ fontSize: 14, color: "#3730a3" }}>{money(sum.totalBonus, lang)}</strong>
                  </div>
                  <div style={{ background: "#f1f5f9", padding: 10, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: 11, color: "#475569" }}>{text(lang, "Đã chi trả", "Paid out")}</div>
                    <strong style={{ fontSize: 14, color: "#475569" }}>{money(sum.totalPaid, lang)}</strong>
                  </div>
                  <div style={{ background: "#fffbeb", padding: 10, borderRadius: 8, border: "1px solid #fde68a" }}>
                    <div style={{ fontSize: 11, color: "#92400e" }}>{text(lang, "Số dư khả dụng", "Balance")}</div>
                    <strong style={{ fontSize: 14, color: "#b45309" }}>{money(Math.max(0, sum.balance), lang)}</strong>
                  </div>
                </div>
              );
            })()}

            {/* Ledger Transactions */}
            <h4>{text(lang, "Lịch sử biến động số dư", "Transaction History")}</h4>
            <div className="table-wrapper" style={{ maxHeight: 240, overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>{text(lang, "Thời gian", "Date")}</th>
                    <th>{text(lang, "Loại", "Type")}</th>
                    <th style={{ textAlign: "right" }}>{text(lang, "Số tiền", "Amount")}</th>
                    <th>{text(lang, "Nội dung / Tham chiếu", "Reason / Ref")}</th>
                  </tr>
                </thead>
                <tbody>
                  {memberSummaries.get(detailUser.id)?.entries.map((entry) => {
                    const isAccrual = entry.kind === "COMMISSION";
                    const isBonus = entry.kind === "KPI_BONUS";
                    return (
                      <tr key={entry.id}>
                        <td>{new Date(entry.createdAt).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-US")}</td>
                        <td>
                          {isBonus ? (
                            <span style={{ color: "#16a34a", fontWeight: 700 }}>Thưởng KPI</span>
                          ) : isAccrual ? (
                            <span style={{ color: "#2563eb" }}>Hoa hồng</span>
                          ) : (
                            <span style={{ color: "#d97706" }}>Chi trả</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: isBonus || isAccrual ? "#16a34a" : "#dc2626" }}>
                          {isBonus || isAccrual ? "+" : "-"}{money(Math.abs(entry.amountVnd), lang)}
                        </td>
                        <td>{entry.reason || entry.reference || (entry.orderId ? `CBST-${entry.orderId}` : "—")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="cbst-modal-actions" style={{ marginTop: 20 }}>
              <button type="button" className="button secondary" onClick={() => setDetailUser(null)}>
                {text(lang, "Đóng", "Close")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
