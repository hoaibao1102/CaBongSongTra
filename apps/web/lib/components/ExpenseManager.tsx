"use client";

import React, { useState, useMemo } from "react";
import {
  Wallet,
  TrendingDown,
  ShoppingBag,
  Plus,
  Search,
} from "lucide-react";
import { Modal } from "./Modal";
import { CurrencyInput } from "./CurrencyInput";
import { SearchableSelect } from "./SearchableSelect";
import { KpiCard } from "./KpiCard";
import { ApiError, createMutation } from "../commerce";
import { money, text } from "../i18n";
import type { Lang, Order } from "../types";
const durableMutation = createMutation();

export interface ExpenseRecord {
  id: string;
  orderId?: string;
  amountVnd: number;
  scope?: "ORDER" | "OVERHEAD";
  category?: string;
  reason?: string;
  createdAt: string;
  actorId?: string;
}

export interface ExpenseManagerProps {
  expenses: ExpenseRecord[];
  orders: Order[];
  lang: Lang;
  onRefresh: () => void;
  onUnauthorized?: () => void;
}

export function ExpenseManager({
  expenses,
  orders,
  lang,
  onRefresh,
  onUnauthorized,
}: ExpenseManagerProps) {
  // Filters
  const [scopeFilter, setScopeFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scope, setScope] = useState<"ORDER" | "OVERHEAD">("ORDER");
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [category, setCategory] = useState<string>("SHIPPING");
  const [amountVnd, setAmountVnd] = useState<number>(0);
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // KPIs
  const kpis = useMemo(() => {
    let totalDirect = 0;
    let totalOverhead = 0;

    for (const exp of expenses) {
      if (exp.scope === "ORDER") {
        totalDirect += exp.amountVnd;
      } else {
        totalOverhead += exp.amountVnd;
      }
    }

    return {
      totalAll: totalDirect + totalOverhead,
      totalDirect,
      totalOverhead,
    };
  }, [expenses]);

  // Order Map for easy display
  const orderMap = useMemo(() => {
    const map = new Map<string, Order>();
    for (const o of orders) {
      map.set(o.id, o);
    }
    return map;
  }, [orders]);

  // Filtered List
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (scopeFilter !== "ALL" && exp.scope !== scopeFilter) return false;
      if (categoryFilter !== "ALL" && exp.category !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const reasonMatch = exp.reason?.toLowerCase().includes(q);
        const order = exp.orderId ? orderMap.get(exp.orderId) : null;
        const codeMatch = order?.orderCode.toLowerCase().includes(q);
        const customerMatch = order?.customer.name.toLowerCase().includes(q);
        if (!reasonMatch && !codeMatch && !customerMatch) return false;
      }
      return true;
    });
  }, [expenses, scopeFilter, categoryFilter, searchQuery, orderMap]);

  // Submit Expense
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (amountVnd <= 0) {
      setError("Số tiền chi phí phải lớn hơn 0.");
      return;
    }

    if (scope === "ORDER" && !selectedOrderId) {
      setError("Vui lòng chọn đơn hàng có liên quan.");
      return;
    }

    const targetOrder = scope === "ORDER" ? orderMap.get(selectedOrderId) : null;
    if (scope === "ORDER" && !targetOrder) {
      setError("Không tìm thấy thông tin đơn hàng đã chọn.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        scope,
        amountVnd,
        category,
        reason: reason.trim(),
        orderId: scope === "ORDER" ? selectedOrderId : undefined,
        expectedVersion: scope === "ORDER" ? targetOrder?.version : undefined,
      };

      await durableMutation("expenses", payload);

      setIsModalOpen(false);
      setAmountVnd(0);
      setReason("");
      setSelectedOrderId("");
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401 && onUnauthorized) {
        onUnauthorized();
      } else if (err instanceof ApiError) {
        setError(
          err.status === 409
            ? text(
                lang,
                "Đơn hàng vừa có thay đổi phiên bản. Vui lòng tải lại trang và thử lại.",
                "Order version conflict. Please refresh and try again.",
              )
            : err.message || "Không thể ghi nhận chi phí.",
        );
      } else {
        setError("Đã xảy ra lỗi không xác định.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const categoryName = (cat?: string) => {
    switch (cat) {
      case "SHIPPING":
        return text(lang, "Cước giao hàng", "Shipping");
      case "PACKAGING":
        return text(lang, "Hộp & Đóng gói", "Packaging");
      case "MARKETING":
        return text(lang, "Quảng cáo / Marketing", "Marketing");
      case "OTHER":
      default:
        return text(lang, "Khác", "Other");
    }
  };

  return (
    <div className="cbst-expense-manager">
      {/* KPI Cards */}
      <div className="cbst-kpi-grid">
        <KpiCard
          title={text(lang, "Tổng chi phí đã ghi", "Total Expenses")}
          value={money(kpis.totalAll, lang)}
          subtext={text(
            lang,
            `Trực tiếp: ${money(kpis.totalDirect, lang)} · Chung: ${money(kpis.totalOverhead, lang)}`,
            `Direct: ${money(kpis.totalDirect, lang)} · Overhead: ${money(kpis.totalOverhead, lang)}`,
          )}
          icon={Wallet}
          variant="brand"
        />
        <KpiCard
          title={text(lang, "Chi phí trực tiếp theo đơn", "Direct Order Costs")}
          value={money(kpis.totalDirect, lang)}
          subtext={text(
            lang,
            "Trừ trực tiếp vào lợi nhuận chia của đơn",
            "Deducted from order profit pool",
          )}
          icon={ShoppingBag}
          variant="amber"
        />
        <KpiCard
          title={text(lang, "Chi phí vận hành chung", "Operating Overhead")}
          value={money(kpis.totalOverhead, lang)}
          subtext={text(
            lang,
            "Marketing, công cụ, vật tư (không trừ vào đơn)",
            "General shop expenses",
          )}
          icon={TrendingDown}
          variant="purple"
        />
      </div>

      {/* Control Bar */}
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
            minWidth: 280,
          }}
        >
          <div
            className="cbst-search-input-wrap"
            style={{
              position: "relative",
              display: "inline-flex",
              alignItems: "center",
              width: 260,
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
              placeholder={text(lang, "Tìm mã đơn, lý do...", "Search order, reason...")}
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
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
            className="cbst-select-filter"
            style={{
              width: "auto",
              minWidth: 154,
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
            <option value="ALL">{text(lang, "Tất cả nhóm chi phí", "All scopes")}</option>
            <option value="ORDER">{text(lang, "Trực tiếp theo đơn", "Direct Order")}</option>
            <option value="OVERHEAD">{text(lang, "Chi phí chung (Overhead)", "Overhead")}</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="cbst-select-filter"
            style={{
              width: "auto",
              minWidth: 154,
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
            <option value="ALL">{text(lang, "Tất cả loại chi", "All categories")}</option>
            <option value="SHIPPING">{text(lang, "Cước giao hàng", "Shipping")}</option>
            <option value="PACKAGING">{text(lang, "Đóng gói", "Packaging")}</option>
            <option value="MARKETING">{text(lang, "Marketing", "Marketing")}</option>
            <option value="OTHER">{text(lang, "Khác", "Other")}</option>
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
              setError(null);
              setIsModalOpen(true);
            }}
          >
            <Plus size={16} />
            <span>{text(lang, "Ghi chi phí mới", "Record Expense")}</span>
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>{text(lang, "Thời gian", "Date & Time")}</th>
              <th>{text(lang, "Nhóm chi phí", "Scope")}</th>
              <th>{text(lang, "Loại chi phí", "Category")}</th>
              <th style={{ textAlign: "right" }}>{text(lang, "Số tiền", "Amount")}</th>
              <th>{text(lang, "Đơn hàng liên quan", "Related Order")}</th>
              <th>{text(lang, "Lý do / Diễn giải", "Reason")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "#a8a29e" }}>
                  {text(lang, "Không tìm thấy khoản chi phí nào", "No expenses found")}
                </td>
              </tr>
            ) : (
              filteredExpenses.map((exp) => {
                const order = exp.orderId ? orderMap.get(exp.orderId) : null;
                const isOrderDirect = exp.scope === "ORDER";

                return (
                  <tr key={exp.id}>
                    <td>{new Date(exp.createdAt).toLocaleDateString("vi-VN")}</td>
                    <td>
                      {isOrderDirect ? (
                        <span className="badge warning">
                          {text(lang, "Trực tiếp đơn", "Direct Order")}
                        </span>
                      ) : (
                        <span className="badge neutral">
                          {text(lang, "Chi phí chung", "Overhead")}
                        </span>
                      )}
                    </td>
                    <td>
                      <strong>{categoryName(exp.category)}</strong>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, fontFamily: "var(--font-mono)", color: "#b91c1c" }}>
                      -{money(exp.amountVnd, lang)}
                    </td>
                    <td>
                      {order ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          <span className="cbst-code-badge">{order.orderCode}</span>
                          <small style={{ color: "#78716c" }}>{order.customer.name}</small>
                        </div>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <span>{exp.reason || "—"}</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Record Expense Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={text(lang, "Ghi nhận khoản chi phí", "Record Expense")}
        subtitle={text(
          lang,
          "Phân loại chính xác để hệ thống tính đúng lợi nhuận chia và hoa hồng",
          "Categorize accurately for exact profit sharing and commission calculations",
        )}
        size="md"
      >
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="notice error" role="alert" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Nhóm chi phí", "Expense Scope")} <span className="required-mark" aria-hidden="true">*</span></span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 6 }}>
                <button
                  type="button"
                  className={`cbst-scope-card ${scope === "ORDER" ? "selected" : ""}`}
                  onClick={() => setScope("ORDER")}
                >
                  <ShoppingBag size={20} />
                  <div>
                    <strong>{text(lang, "Trực tiếp theo đơn", "Direct Order")}</strong>
                    <small>{text(lang, "Phí ship shop chịu, đóng gói...", "Shop-paid shipping, packing...")}</small>
                  </div>
                </button>
                <button
                  type="button"
                  className={`cbst-scope-card ${scope === "OVERHEAD" ? "selected" : ""}`}
                  onClick={() => setScope("OVERHEAD")}
                >
                  <TrendingDown size={20} />
                  <div>
                    <strong>{text(lang, "Chi phí chung (Overhead)", "General Overhead")}</strong>
                    <small>{text(lang, "Marketing, công cụ, vật tư...", "Marketing, tools, utilities...")}</small>
                  </div>
                </button>
              </div>
            </label>
          </div>

          {scope === "ORDER" && (
            <div style={{ marginBottom: 16 }}>
              <label>
                <span>{text(lang, "Chọn đơn hàng liên quan", "Select order")} <span className="required-mark" aria-hidden="true">*</span></span>
                <SearchableSelect
                  options={orders.map((o) => ({
                    value: o.id,
                    label: `${o.orderCode} — ${o.customer.name}`,
                    badge: `${money(o.totalVnd, lang)}`,
                    sublabel: `SĐT: ${o.customer.phone} · Trạng thái: ${o.status}`,
                  }))}
                  value={selectedOrderId}
                  onChange={(val) => setSelectedOrderId(val)}
                  placeholder={text(lang, "Tìm mã đơn, tên khách hoặc SĐT...", "Search order code...")}
                  required
                />
              </label>
              <small style={{ color: "#78716c", marginTop: 4, display: "block" }}>
                {text(
                  lang,
                  "Chi phí này sẽ được tính vào chi phí trực tiếp của đơn và trừ vào lợi nhuận chia 60/40.",
                  "This cost will be added to order direct costs and deducted from 60/40 profit pool.",
                )}
              </small>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Loại chi phí", "Category")} <span className="required-mark" aria-hidden="true">*</span></span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="SHIPPING">{text(lang, "Cước giao hàng (Ship)", "Shipping")}</option>
                <option value="PACKAGING">{text(lang, "Đóng gói & Hộp", "Packaging")}</option>
                <option value="MARKETING">{text(lang, "Marketing / Quảng cáo", "Marketing")}</option>
                <option value="OTHER">{text(lang, "Chi phí khác", "Other")}</option>
              </select>
            </label>

            <label>
              <span>{text(lang, "Số tiền chi (VND)", "Amount (VND)")} <span className="required-mark" aria-hidden="true">*</span></span>
              <CurrencyInput
                value={amountVnd}
                onChange={(val) => setAmountVnd(val)}
                min={1}
                required
              />
            </label>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label>
              <span>{text(lang, "Lý do / Diễn giải", "Reason / Description")} <span className="required-mark" aria-hidden="true">*</span></span>
              <textarea
                rows={2}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={text(lang, "Mô tả chi tiết mục đích chi...", "Explain purpose of this expense...")}
              />
            </label>
          </div>

          <div className="cbst-modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              {text(lang, "Hủy bỏ", "Cancel")}
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={submitting}
            >
              {submitting
                ? text(lang, "Đang xử lý...", "Processing...")
                : text(lang, "Ghi nhận chi phí", "Save Expense")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
