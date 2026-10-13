"use client";

import React, { useState, useMemo } from "react";
import {
  Boxes,
  Package,
  CalendarDays,
  Plus,
  SlidersHorizontal,
  History,
  Trash2,
  Truck,
  DollarSign,
  Search,
} from "lucide-react";
import { Modal } from "./Modal";
import { CurrencyInput } from "./CurrencyInput";
import { SearchableSelect } from "./SearchableSelect";
import { KpiCard } from "./KpiCard";
import { apiRequest, ApiError, createMutation } from "../commerce";
const durableMutation = createMutation();
import { money, text } from "../i18n";
import type { Lang, Batch, PurchaseReceipt } from "../types";

export interface InventoryManagerProps {
  batches: Batch[];
  lang: Lang;
  onRefresh: () => void;
  onUnauthorized?: () => void;
}

interface NewReceiptItem {
  id: string;
  sku: string;
  qty: number;
  purchasePriceVnd: number;
  expiresAt: string;
  supplierLotCode: string;
}

export function InventoryManager({
  batches,
  lang,
  onRefresh,
  onUnauthorized,
}: InventoryManagerProps) {
  // Filters
  const [skuFilter, setSkuFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modals
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isReceiptsHistoryOpen, setIsReceiptsHistoryOpen] = useState(false);
  const [receiptsList, setReceiptsList] = useState<PurchaseReceipt[]>([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);

  // Quick Adjustment on a specific batch
  const [adjustBatchId, setAdjustBatchId] = useState<string>("");
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>("DAMAGED");
  const [adjustNote, setAdjustNote] = useState<string>("");
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // New Multi-SKU Receipt Form
  const defaultItems: NewReceiptItem[] = [
    { id: "1", sku: "CBST-300", qty: 0, purchasePriceVnd: 65000, expiresAt: "", supplierLotCode: "" },
    { id: "2", sku: "CBST-400", qty: 0, purchasePriceVnd: 95000, expiresAt: "", supplierLotCode: "" },
    { id: "3", sku: "CBST-600", qty: 0, purchasePriceVnd: 140000, expiresAt: "", supplierLotCode: "" },
  ];
  const [receiptItems, setReceiptItems] = useState<NewReceiptItem[]>(defaultItems);
  const [shippingFeeVnd, setShippingFeeVnd] = useState<number>(0);
  const [receivedDate, setReceivedDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [receiptNotes, setReceiptNotes] = useState<string>("");
  const [documentRef, setDocumentRef] = useState<string>("");
  const [receiptSubmitting, setReceiptSubmitting] = useState(false);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  // Calculations for KPIs
  const kpis = useMemo(() => {
    let totalOnHand = 0;
    let totalReserved = 0;
    let totalCostValue = 0;
    const sizeCounts: Record<string, number> = { "CBST-300": 0, "CBST-400": 0, "CBST-600": 0 };
    let expiringSoonCount = 0;
    const now = new Date();
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (const b of batches) {
      totalOnHand += b.onHand;
      totalReserved += b.reserved;
      totalCostValue += b.onHand * b.landedUnitCostVnd;
      if (sizeCounts[b.sku] !== undefined) {
        sizeCounts[b.sku] += b.onHand;
      }
      if (b.expiresAt) {
        const exp = new Date(b.expiresAt);
        if (exp > now && exp <= thirtyDaysAhead && b.onHand > 0) {
          expiringSoonCount += b.onHand;
        }
      }
    }

    return {
      totalOnHand,
      available: Math.max(0, totalOnHand - totalReserved),
      totalReserved,
      totalCostValue,
      sizeCounts,
      expiringSoonCount,
    };
  }, [batches]);

  // Filtered Batches
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (skuFilter !== "ALL" && b.sku !== skuFilter) return false;
      if (statusFilter !== "ALL" && b.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const lotMatch = b.lotCode.toLowerCase().includes(q);
        const receiptMatch = b.receiptCode?.toLowerCase().includes(q);
        const supplierMatch = b.supplierLotCode?.toLowerCase().includes(q);
        if (!lotMatch && !receiptMatch && !supplierMatch) return false;
      }
      return true;
    });
  }, [batches, skuFilter, statusFilter, searchQuery]);

  // Preview allocation of shipping fee in multi-SKU modal
  const allocationPreview = useMemo(() => {
    const validLines = receiptItems.filter((item) => item.qty > 0);
    const lineTotals = validLines.map((item) => item.qty * item.purchasePriceVnd);
    const subtotal = lineTotals.reduce((sum, val) => sum + val, 0);

    if (subtotal === 0 || shippingFeeVnd === 0) {
      return validLines.map((item, idx) => ({
        ...item,
        lineTotal: lineTotals[idx],
        allocatedShipping: 0,
        landedUnitCost: item.purchasePriceVnd,
      }));
    }

    let allocatedSum = 0;
    const shares = lineTotals.map((lineTotal) => {
      const share = Math.floor((shippingFeeVnd * lineTotal) / subtotal);
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
    shares[maxIdx] += remainder;

    return validLines.map((item, idx) => {
      const allocatedShipping = shares[idx];
      const unitShipping = Math.floor(allocatedShipping / item.qty);
      return {
        ...item,
        lineTotal: lineTotals[idx],
        allocatedShipping,
        landedUnitCost: item.purchasePriceVnd + unitShipping,
      };
    });
  }, [receiptItems, shippingFeeVnd]);

  const receiptSubtotal = useMemo(() => {
    return receiptItems.reduce(
      (sum, item) => sum + Math.max(0, item.qty) * item.purchasePriceVnd,
      0,
    );
  }, [receiptItems]);

  const handleUpdateItem = (
    id: string,
    field: keyof NewReceiptItem,
    val: unknown,
  ) => {
    setReceiptItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: val } : item)),
    );
  };

  const handleAddItem = () => {
    setReceiptItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        sku: "CBST-300",
        qty: 1,
        purchasePriceVnd: 65000,
        expiresAt: "",
        supplierLotCode: "",
      },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (receiptItems.length <= 1) return;
    setReceiptItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Submit Multi-SKU Receipt
  const handleSubmitReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setReceiptError(null);

    const validLines = receiptItems.filter((item) => item.qty > 0);
    if (validLines.length === 0) {
      setReceiptError("Vui lòng nhập số lượng cho ít nhất 1 sản phẩm.");
      return;
    }

    setReceiptSubmitting(true);
    try {
      const payload = {
        receivedAt: new Date(receivedDate).toISOString(),
        shippingFeeVnd,
        notes: receiptNotes.trim() || undefined,
        documentRef: documentRef.trim() || undefined,
        items: validLines.map((line) => ({
          sku: line.sku,
          qty: line.qty,
          purchasePriceVnd: line.purchasePriceVnd,
          expiresAt: line.expiresAt
            ? new Date(line.expiresAt).toISOString()
            : undefined,
          supplierLotCode: line.supplierLotCode.trim() || undefined,
        })),
      };

      await durableMutation("inventory/purchase-receipts", payload);

      setIsReceiptModalOpen(false);
      setReceiptItems(defaultItems);
      setShippingFeeVnd(0);
      setReceiptNotes("");
      setDocumentRef("");
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401 && onUnauthorized) {
        onUnauthorized();
      } else if (err instanceof ApiError) {
        setReceiptError(err.message || "Không thể tạo phiếu nhập.");
      } else {
        setReceiptError("Đã xảy ra lỗi không xác định.");
      }
    } finally {
      setReceiptSubmitting(false);
    }
  };

  // Submit Adjustment
  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdjustError(null);

    const targetBatch = batches.find((b) => b.id === adjustBatchId);
    if (!targetBatch) {
      setAdjustError("Vui lòng chọn một lô hàng cần giảm.");
      return;
    }
    const maxReducible = Math.max(0, targetBatch.onHand - targetBatch.reserved);
    if (adjustQty > maxReducible) {
      setAdjustError(`Số lượng giảm tối đa là ${maxReducible} hũ (tồn khả dụng).`);
      return;
    }
    if (adjustQty <= 0) {
      setAdjustError("Số lượng giảm phải lớn hơn 0.");
      return;
    }

    setAdjustSubmitting(true);
    try {
      const payload = {
        batchId: adjustBatchId,
        qtyDelta: -adjustQty,
        reason: `${adjustReason}${adjustNote.trim() ? `: ${adjustNote.trim()}` : ""}`,
      };

      await durableMutation("inventory/adjustments", payload);

      setIsAdjustmentModalOpen(false);
      setAdjustBatchId("");
      setAdjustQty(1);
      setAdjustNote("");
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401 && onUnauthorized) {
        onUnauthorized();
      } else if (err instanceof ApiError) {
        setAdjustError(err.message || "Không thể điều chỉnh kho.");
      } else {
        setAdjustError("Đã xảy ra lỗi không xác định.");
      }
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Fetch receipts history
  const loadReceipts = async () => {
    setLoadingReceipts(true);
    try {
      const data = await apiRequest<PurchaseReceipt[]>(
        "inventory/purchase-receipts?limit=50",
      );
      setReceiptsList(data || []);
    } catch {
      setReceiptsList([]);
    } finally {
      setLoadingReceipts(false);
    }
  };

  const openReceiptsHistory = () => {
    setIsReceiptsHistoryOpen(true);
    loadReceipts();
  };

  return (
    <div className="cbst-inventory-container">
      {/* KPI Cards Header */}
      <div className="cbst-kpi-grid">
        <KpiCard
          title={text(lang, "Tổng hũ đang có", "Total on hand")}
          value={kpis.totalOnHand.toLocaleString("vi-VN")}
          subtext={text(
            lang,
            `Khả dụng: ${kpis.available} · Đang giữ: ${kpis.totalReserved}`,
            `Available: ${kpis.available} · Reserved: ${kpis.totalReserved}`,
          )}
          icon={Boxes}
          variant="brand"
        />
        <KpiCard
          title={text(lang, "Tồn kho theo size", "Stock by size")}
          value={`${kpis.sizeCounts["CBST-300"]} / ${kpis.sizeCounts["CBST-400"]} / ${kpis.sizeCounts["CBST-600"]}`}
          subtext={text(lang, "300g / 400g / 600g", "300g / 400g / 600g")}
          icon={Package}
          variant="amber"
        />
        <KpiCard
          title={text(lang, "Giá trị kho (Giá vốn)", "Inventory Value (COGS)")}
          value={money(kpis.totalCostValue, lang)}
          subtext={text(
            lang,
            "Tính theo đơn giá vốn nhập thực tế",
            "Based on landed unit costs",
          )}
          icon={DollarSign}
          variant="emerald"
        />
        <KpiCard
          title={text(lang, "Cận hạn (<30 ngày)", "Expiring soon (<30d)")}
          value={kpis.expiringSoonCount.toLocaleString("vi-VN")}
          subtext={
            kpis.expiringSoonCount > 0
              ? text(lang, "Cần ưu tiên xuất bán", "Priority dispatch")
              : text(lang, "Kho an toàn", "Safe condition")
          }
          icon={CalendarDays}
          variant={kpis.expiringSoonCount > 0 ? "red" : "neutral"}
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
              placeholder={text(
                lang,
                "Tìm mã lô, mã phiếu...",
                "Search lot, receipt code...",
              )}
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
            value={skuFilter}
            onChange={(e) => setSkuFilter(e.target.value)}
            className="cbst-select-filter"
            style={{
              width: "auto",
              minWidth: 148,
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
            <option value="ALL">{text(lang, "Tất cả quy cách", "All sizes")}</option>
            <option value="CBST-300">Hũ 300g</option>
            <option value="CBST-400">Hũ 400g</option>
            <option value="CBST-600">Hũ 600g</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="cbst-select-filter"
            style={{
              width: "auto",
              minWidth: 148,
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
            <option value="ALL">{text(lang, "Tất cả trạng thái", "All status")}</option>
            <option value="AVAILABLE">{text(lang, "Khả dụng", "Available")}</option>
            <option value="QUARANTINED">{text(lang, "Cách ly", "Quarantined")}</option>
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
            onClick={() => setIsReceiptModalOpen(true)}
          >
            <Plus size={16} />
            <span>{text(lang, "Nhập kho (Đa SKU)", "Multi-SKU Receipt")}</span>
          </button>
          <button
            type="button"
            className="button secondary"
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
              setAdjustBatchId("");
              setAdjustError(null);
              setIsAdjustmentModalOpen(true);
            }}
          >
            <SlidersHorizontal size={16} />
            <span>{text(lang, "Điều chỉnh kho", "Adjust stock")}</span>
          </button>
          <button
            type="button"
            className="button secondary"
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
            onClick={openReceiptsHistory}
          >
            <History size={16} />
            <span>{text(lang, "Phiếu nhập đã lưu", "Receipts history")}</span>
          </button>
        </div>
      </div>

      {/* Batches Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>{text(lang, "Mã lô nội bộ", "Lot Code")}</th>
              <th>{text(lang, "Mã phiếu", "Receipt")}</th>
              <th>{text(lang, "Sản phẩm", "Product")}</th>
              <th style={{ textAlign: "right" }}>{text(lang, "Tồn kho", "On Hand")}</th>
              <th style={{ textAlign: "right" }}>{text(lang, "Đang giữ", "Reserved")}</th>
              <th style={{ textAlign: "right" }}>{text(lang, "Khả dụng", "Available")}</th>
              <th style={{ textAlign: "right" }}>{text(lang, "Đơn giá vốn", "Unit Cost")}</th>
              <th>{text(lang, "Hạn sử dụng", "Expires at")}</th>
              <th>{text(lang, "Trạng thái", "Status")}</th>
              <th style={{ textAlign: "center" }}>{text(lang, "Thao tác", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredBatches.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", padding: "32px", color: "#a8a29e" }}>
                  {text(lang, "Không tìm thấy lô hàng nào phù hợp", "No batches found")}
                </td>
              </tr>
            ) : (
              filteredBatches.map((b) => {
                const available = Math.max(0, b.onHand - b.reserved);
                const isQuarantined = b.status === "QUARANTINED";
                const isExpiringSoon =
                  b.expiresAt &&
                  new Date(b.expiresAt) <=
                    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

                return (
                  <tr key={b.id}>
                    <td>
                      <strong style={{ color: "#1c1917" }}>{b.lotCode}</strong>
                      {b.supplierLotCode && (
                        <div style={{ fontSize: "0.78rem", color: "#78716c" }}>
                          NSX: {b.supplierLotCode}
                        </div>
                      )}
                    </td>
                    <td>
                      {b.receiptCode ? (
                        <span className="cbst-code-badge">{b.receiptCode}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <strong>{b.sku.replace("CBST-", "")}g</strong>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{b.onHand}</td>
                    <td style={{ textAlign: "right", color: b.reserved > 0 ? "#d97706" : "#78716c" }}>
                      {b.reserved}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: available > 0 ? "#15803d" : "#dc2626" }}>
                      {available}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {money(b.landedUnitCostVnd, lang)}
                    </td>
                    <td>
                      {b.expiresAt ? (
                        <span style={{ color: isExpiringSoon ? "#dc2626" : "inherit", fontWeight: isExpiringSoon ? 600 : 400 }}>
                          {new Date(b.expiresAt).toLocaleDateString("vi-VN")}
                        </span>
                      ) : (
                        <span style={{ color: "#d97706", fontSize: "0.82rem" }}>
                          {text(lang, "Chưa ghi hạn", "No expiry")}
                        </span>
                      )}
                    </td>
                    <td>
                      {isQuarantined ? (
                        <span className="badge danger">
                          {text(lang, "Cách ly", "Quarantined")}
                        </span>
                      ) : (
                        <span className="badge success">
                          {text(lang, "Khả dụng", "Available")}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {available > 0 && (
                        <button
                          type="button"
                          className="button secondary"
                          style={{ padding: "4px 8px", fontSize: "0.82rem" }}
                          onClick={() => {
                            setAdjustBatchId(b.id);
                            setAdjustQty(1);
                            setAdjustError(null);
                            setIsAdjustmentModalOpen(true);
                          }}
                        >
                          {text(lang, "Giảm kho", "Reduce")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: Multi-SKU Purchase Receipt */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        title={text(lang, "Phiếu nhập kho hàng mới", "New Purchase Receipt")}
        subtitle={text(
          lang,
          "Nhập nhiều quy cách trong một phiếu, tự động phân bổ cước vận chuyển theo giá trị",
          "Receive multiple sizes, automatically allocate shipping cost proportionally",
        )}
        size="lg"
      >
        <form onSubmit={handleSubmitReceipt}>
          {receiptError && (
            <div className="notice error" role="alert" style={{ marginBottom: 16 }}>
              {receiptError}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Ngày nhận hàng", "Received date")} *</span>
              <input
                type="date"
                required
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
              />
            </label>
            <label>
              <span>{text(lang, "Số chứng từ / Hóa đơn gốc", "Invoice / Document Ref")}</span>
              <input
                type="text"
                placeholder={text(lang, "VD: HD-0012, Vận đơn...", "e.g. INV-0012...")}
                value={documentRef}
                onChange={(e) => setDocumentRef(e.target.value)}
              />
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <strong style={{ fontSize: "0.95rem", color: "#1c1917" }}>
                {text(lang, "Danh sách hàng nhập", "Items received")}
              </strong>
              <button
                type="button"
                className="button secondary"
                style={{ padding: "4px 10px", fontSize: "0.84rem" }}
                onClick={handleAddItem}
              >
                <Plus size={14} />
                <span>{text(lang, "Thêm dòng", "Add line")}</span>
              </button>
            </div>

            <div className="cbst-receipt-table-wrap">
              <table className="cbst-receipt-table">
                <thead>
                  <tr>
                    <th style={{ width: 140 }}>{text(lang, "Sản phẩm", "Product")}</th>
                    <th style={{ width: 90 }}>{text(lang, "Số lượng", "Quantity")}</th>
                    <th style={{ width: 140 }}>{text(lang, "Giá mua/hũ", "Purchase price")}</th>
                    <th style={{ width: 130 }}>{text(lang, "Hạn dùng", "Expires at")}</th>
                    <th>{text(lang, "Mã lô NSX", "Lot code")}</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {receiptItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <select
                          value={item.sku}
                          onChange={(e) => handleUpdateItem(item.id, "sku", e.target.value)}
                        >
                          <option value="CBST-300">Hũ 300g</option>
                          <option value="CBST-400">Hũ 400g</option>
                          <option value="CBST-600">Hũ 600g</option>
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          max={100000}
                          value={item.qty || ""}
                          placeholder="0"
                          onChange={(e) =>
                            handleUpdateItem(item.id, "qty", parseInt(e.target.value, 10) || 0)
                          }
                          style={{ textAlign: "right" }}
                        />
                      </td>
                      <td>
                        <CurrencyInput
                          value={item.purchasePriceVnd}
                          onChange={(val) => handleUpdateItem(item.id, "purchasePriceVnd", val)}
                        />
                      </td>
                      <td>
                        <input
                          type="date"
                          value={item.expiresAt}
                          onChange={(e) => handleUpdateItem(item.id, "expiresAt", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder={text(lang, "In trên nhãn...", "On label...")}
                          value={item.supplierLotCode}
                          onChange={(e) => handleUpdateItem(item.id, "supplierLotCode", e.target.value)}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {receiptItems.length > 1 && (
                          <button
                            type="button"
                            className="cbst-btn-icon-danger"
                            onClick={() => handleRemoveItem(item.id)}
                            title="Xóa dòng"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Shipping Fee and Allocation Summary */}
          <div className="cbst-receipt-summary-box">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label>
                  <span>
                    <Truck size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                    {text(lang, "Tổng cước vận chuyển (Quảng Ngãi → TP.HCM)", "Total Inbound Shipping Fee")}
                  </span>
                  <CurrencyInput
                    value={shippingFeeVnd}
                    onChange={(val) => setShippingFeeVnd(val)}
                    placeholder="0"
                  />
                </label>
                <div style={{ marginTop: 12 }}>
                  <label>
                    <span>{text(lang, "Ghi chú phiếu nhập", "Receipt notes")}</span>
                    <textarea
                      rows={2}
                      value={receiptNotes}
                      onChange={(e) => setReceiptNotes(e.target.value)}
                      placeholder={text(lang, "Thông tin người giao, tình trạng kiện hàng...", "Delivery info...")}
                    />
                  </label>
                </div>
              </div>

              <div className="cbst-calculation-panel">
                <div className="cbst-calc-row">
                  <span>{text(lang, "Tổng tiền mua hàng:", "Goods subtotal:")}</span>
                  <strong>{money(receiptSubtotal, lang)}</strong>
                </div>
                <div className="cbst-calc-row">
                  <span>{text(lang, "Cước vận chuyển phân bổ:", "Allocated shipping:")}</span>
                  <strong>{money(shippingFeeVnd, lang)}</strong>
                </div>
                <div className="cbst-calc-divider" />
                <div className="cbst-calc-row total">
                  <span>{text(lang, "Tổng giá vốn phiếu nhập:", "Total landed cost:")}</span>
                  <span className="cbst-calc-total-val">
                    {money(receiptSubtotal + shippingFeeVnd, lang)}
                  </span>
                </div>

                {allocationPreview.length > 0 && shippingFeeVnd > 0 && (
                  <div className="cbst-preview-allocations">
                    <small style={{ fontWeight: 600, color: "#78716c", display: "block", marginBottom: 4 }}>
                      {text(lang, "Dự kiến giá vốn sau cước:", "Projected unit cost with shipping:")}
                    </small>
                    {allocationPreview.map((item) => (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem" }}>
                        <span>
                          {item.sku.replace("CBST-", "")}g ({item.qty} hũ):
                        </span>
                        <span>
                          +{(item.landedUnitCost - item.purchasePriceVnd).toLocaleString("vi-VN")}đ/hũ →{" "}
                          <strong>{money(item.landedUnitCost, lang)}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="cbst-modal-actions" style={{ marginTop: 20 }}>
            <button
              type="button"
              className="button secondary"
              onClick={() => setIsReceiptModalOpen(false)}
              disabled={receiptSubmitting}
            >
              {text(lang, "Hủy bỏ", "Cancel")}
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={receiptSubmitting}
            >
              {receiptSubmitting
                ? text(lang, "Đang xử lý...", "Processing...")
                : text(lang, "Xác nhận nhập kho", "Confirm Receipt")}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Stock Adjustment (Negative only) */}
      <Modal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        title={text(lang, "Điều chỉnh giảm tồn kho", "Reduce Inventory")}
        subtitle={text(
          lang,
          "Chỉ hỗ trợ giảm tồn do hao hụt, hỏng hóc hoặc kiểm kê; không tự nhập ngược hàng trả",
          "Only negative adjustments are permitted for loss, spoilage or audit discrepancies",
        )}
        size="md"
      >
        <form onSubmit={handleSubmitAdjustment}>
          {adjustError && (
            <div className="notice error" role="alert" style={{ marginBottom: 16 }}>
              {adjustError}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Chọn lô hàng cần giảm", "Select batch")} *</span>
              <SearchableSelect
                options={batches
                  .filter((b) => b.onHand - b.reserved > 0)
                  .map((b) => ({
                    value: b.id,
                    label: `${b.lotCode} — ${b.sku.replace("CBST-", "")}g`,
                    badge: `${b.onHand - b.reserved} hũ khả dụng`,
                    sublabel: b.expiresAt
                      ? `HSD: ${new Date(b.expiresAt).toLocaleDateString("vi-VN")}`
                      : "Chưa ghi HSD",
                  }))}
                value={adjustBatchId}
                onChange={(val) => setAdjustBatchId(val)}
                placeholder={text(lang, "Tìm theo mã lô hoặc chọn...", "Search lot code...")}
                required
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Số lượng giảm", "Quantity to reduce")} *</span>
              <input
                type="number"
                min={1}
                required
                value={adjustQty}
                onChange={(e) => setAdjustQty(parseInt(e.target.value, 10) || 1)}
              />
            </label>

            <label>
              <span>{text(lang, "Lý do điều chỉnh", "Reason")} *</span>
              <select
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              >
                <option value="DAMAGED">{text(lang, "Hỏng vỡ / Bể nắp", "Damaged / Broken")}</option>
                <option value="EXPIRED">{text(lang, "Hết hạn sử dụng", "Expired")}</option>
                <option value="LOST">{text(lang, "Thất lạc / Mất mát", "Lost / Missing")}</option>
                <option value="AUDIT_DISCREPANCY">{text(lang, "Kiểm kê định kỳ lệch", "Audit discrepancy")}</option>
                <option value="OTHER">{text(lang, "Lý do khác", "Other")}</option>
              </select>
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Ghi chú chi tiết", "Detailed note")}</span>
              <textarea
                rows={2}
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                placeholder={text(lang, "Mô tả cụ thể biên bản kiểm kê hoặc tình trạng hàng...", "Specific explanation...")}
              />
            </label>
          </div>

          <div className="cbst-modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setIsAdjustmentModalOpen(false)}
              disabled={adjustSubmitting}
            >
              {text(lang, "Hủy bỏ", "Cancel")}
            </button>
            <button
              type="submit"
              className="button danger"
              disabled={adjustSubmitting}
            >
              {adjustSubmitting
                ? text(lang, "Đang xử lý...", "Processing...")
                : text(lang, "Xác nhận giảm tồn", "Confirm reduction")}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Purchase Receipts History */}
      <Modal
        isOpen={isReceiptsHistoryOpen}
        onClose={() => setIsReceiptsHistoryOpen(false)}
        title={text(lang, "Lịch sử Phiếu nhập kho", "Purchase Receipts History")}
        size="lg"
      >
        {loadingReceipts ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#a8a29e" }}>
            {text(lang, "Đang tải dữ liệu...", "Loading receipts...")}
          </div>
        ) : receiptsList.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#a8a29e" }}>
            {text(lang, "Chưa có phiếu nhập kho nào được tạo.", "No purchase receipts created yet.")}
          </div>
        ) : (
          <div className="table-wrapper" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>{text(lang, "Mã phiếu", "Receipt Code")}</th>
                  <th>{text(lang, "Ngày nhập", "Received At")}</th>
                  <th>{text(lang, "Chi tiết hàng", "Items")}</th>
                  <th style={{ textAlign: "right" }}>{text(lang, "Cước ship", "Shipping")}</th>
                  <th style={{ textAlign: "right" }}>{text(lang, "Tổng giá vốn", "Total Cost")}</th>
                  <th>{text(lang, "Chứng từ / Ghi chú", "Ref / Notes")}</th>
                </tr>
              </thead>
              <tbody>
                {receiptsList.map((pr) => (
                  <tr key={pr.id}>
                    <td>
                      <strong className="cbst-code-badge">{pr.receiptCode}</strong>
                    </td>
                    <td>{new Date(pr.receivedAt).toLocaleDateString("vi-VN")}</td>
                    <td>
                      {pr.items?.map((it, idx) => (
                        <div key={idx} style={{ fontSize: "0.85rem" }}>
                          {it.sku.replace("CBST-", "")}g: {it.qty} hũ × {money(it.landedUnitCostVnd, lang)}
                        </div>
                      ))}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "var(--font-mono)" }}>
                      {money(pr.shippingFeeVnd, lang)}
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 700, fontFamily: "var(--font-mono)", color: "#1c1917" }}>
                      {money(pr.totalCostVnd, lang)}
                    </td>
                    <td>
                      {pr.documentRef && <span className="cbst-code-badge">{pr.documentRef}</span>}
                      {pr.notes && <div style={{ fontSize: "0.8rem", color: "#78716c" }}>{pr.notes}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
