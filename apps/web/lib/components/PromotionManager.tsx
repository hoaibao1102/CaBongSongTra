"use client";
import { useActorMutation } from "../operation-actor";

import React, { useEffect, useRef, useState, useMemo, type FormEvent } from "react";
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { apiRequest, skus } from "../commerce";
import { errorText, text } from "../i18n";
import { Modal } from "./Modal";
import type { Lang, RecordRow } from "../types";

type Kind = "promotions" | "vouchers";

const numeric = ["value", "maxDiscountVnd", "minSubtotalVnd", "maxUsageTotal", "maxUsagePerCustomer"];

export function promotionPayload(kind: Kind, values: RecordRow, version?: number): RecordRow {
  const result: RecordRow = {
    name: String(values.name ?? "").trim(),
    kind: values.kind,
    active: values.active === "on" || values.active === true,
  };

  if (!result.name || !["PERCENT", kind === "promotions" ? "FIXED_PER_UNIT" : "FIXED"].includes(String(result.kind))) {
    throw new Error("VALIDATION_FAILED");
  }

  for (const key of numeric) {
    if (kind === "promotions" && !["value", "maxDiscountVnd"].includes(key)) continue;
    if (values[key] === "" || values[key] === undefined) {
      if (
        key === "value" ||
        (key === "maxDiscountVnd" && result.kind === "PERCENT") ||
        ["maxUsageTotal", "maxUsagePerCustomer"].includes(key)
      ) {
        throw new Error("VALIDATION_FAILED");
      }
      continue;
    }
    const value = Number(values[key]);
    if (
      !Number.isSafeInteger(value) ||
      value < (key.startsWith("maxUsage") ? 1 : 0) ||
      (key === "value" && result.kind === "PERCENT" && value > 10000)
    ) {
      throw new Error("VALIDATION_FAILED");
    }
    result[key] = value;
  }

  const start = new Date(String(values.startAt));
  const end = new Date(String(values.endAt));
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || +start >= +end) {
    throw new Error("VALIDATION_FAILED");
  }
  result.startAt = start.toISOString();
  result.endAt = end.toISOString();

  if (kind === "promotions") {
    if (!skus.includes(String(values.sku))) throw new Error("VALIDATION_FAILED");
    result.sku = values.sku;
  } else {
    result.code = String(values.code ?? "").trim();
    if (!result.code) throw new Error("VALIDATION_FAILED");
    result.assignedMemberIds = String(values.assignedMemberIds ?? "")
      .split(/[\s,]+/)
      .filter(Boolean);
  }

  if (version !== undefined) result.expectedVersion = version;
  return result;
}

export function PromotionManager({ kind, owner, lang }: { kind: Kind; owner: boolean; lang: Lang }) {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [redemptions, setRedemptions] = useState<RecordRow[] | null>(null);
  const [redemptionVoucher, setRedemptionVoucher] = useState<RecordRow | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const actorMutation = useActorMutation();
  const mutate = useRef(actorMutation);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    setError(null);
    apiRequest<RecordRow[]>(`${kind}?page=${page}&limit=25`)
      .then((data) => {
        if (alive) setRows(data);
      })
      .catch((e) => {
        if (alive) setError(e);
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [kind, page, revision]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    setError(null);
    try {
      await mutate.current(
        selected ? `${kind}/${selected.id}` : kind,
        promotionPayload(kind, values, selected ? Number(selected.version) : undefined),
        selected ? "PATCH" : "POST",
      );
      setIsModalOpen(false);
      setSelected(null);
      setRevision((n) => n + 1);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(row: RecordRow) {
    if (
      !window.confirm(
        text(
          lang,
          `Bạn có chắc chắn muốn xóa ${kind === "promotions" ? "chương trình khuyến mãi" : "voucher"} này?`,
          "Are you sure you want to delete this configuration?",
        ),
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await mutate.current(`${kind}/${row.id}`, { expectedVersion: row.version }, "DELETE");
      setSelected(null);
      setRevision((n) => n + 1);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenRedemptions(row: RecordRow) {
    setBusy(true);
    setError(null);
    try {
      const data = await apiRequest<RecordRow[]>(`vouchers/${row.id}/redemptions?page=0&limit=100`);
      setRedemptions(data);
      setRedemptionVoucher(row);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const fields = [
    "name",
    ...(kind === "promotions" ? ["sku"] : ["code"]),
    "kind",
    "value",
    "maxDiscountVnd",
    ...(kind === "vouchers"
      ? ["minSubtotalVnd", "maxUsageTotal", "maxUsagePerCustomer", "assignedMemberIds"]
      : []),
    "startAt",
    "endAt",
    "active",
  ];

  const fieldLabels: Record<string, { vi: string; en: string; help?: { vi: string; en: string } }> = {
    name: {
      vi: kind === "promotions" ? "Tên chương trình khuyến mãi" : "Tên Voucher",
      en: kind === "promotions" ? "Promotion Name" : "Voucher Name",
    },
    sku: {
      vi: "Sản phẩm áp dụng",
      en: "Applicable Product SKU",
    },
    code: {
      vi: "Mã Voucher (In hoa)",
      en: "Voucher Code (Uppercase)",
      help: { vi: "Ví dụ: KHACHQUEN20, TET2026", en: "E.g. KHACHQUEN20, TET2026" },
    },
    kind: {
      vi: "Hình thức giảm giá",
      en: "Discount Type",
    },
    value: {
      vi: "Giá trị giảm",
      en: "Discount Value",
      help: {
        vi: "Nhập số tiền VND (nếu cố định) hoặc điểm cơ bản: 1000 = 10% (nếu theo %)",
        en: "Enter VND amount (if fixed) or basis points: 1000 = 10% (if percent)",
      },
    },
    maxDiscountVnd: {
      vi: "Mức giảm tối đa (VND - khi giảm theo %)",
      en: "Max Discount Amount (VND - for %)",
    },
    minSubtotalVnd: {
      vi: "Giá trị đơn hàng tối thiểu (VND)",
      en: "Minimum Order Subtotal (VND)",
    },
    maxUsageTotal: {
      vi: "Tổng số lượt sử dụng tối đa",
      en: "Total Usage Limit",
    },
    maxUsagePerCustomer: {
      vi: "Lượt dùng tối đa mỗi khách",
      en: "Usage Limit Per Customer",
    },
    assignedMemberIds: {
      vi: "ID Thành viên được phân quyền",
      en: "Assigned Member IDs",
      help: {
        vi: "Phân cách bởi dấu phẩy. Để trống nếu áp dụng cho tất cả thành viên.",
        en: "Comma-separated. Leave blank for all members.",
      },
    },
    startAt: {
      vi: "Thời điểm bắt đầu",
      en: "Start Date & Time",
    },
    endAt: {
      vi: "Thời điểm kết thúc",
      en: "End Date & Time",
    },
    active: {
      vi: "Kích hoạt hiệu lực ngay",
      en: "Active & Enabled",
    },
  };

  const localDate = (v: unknown) => {
    if (!v) return "";
    const d = new Date(String(v));
    return new Date(+d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(lang === "vi" ? "vi-VN" : "en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getWindowStatus = (startStr: string, endStr: string) => {
    const now = Date.now();
    const start = new Date(startStr).getTime();
    const end = new Date(endStr).getTime();
    if (now < start)
      return {
        label: text(lang, "Sắp diễn ra", "Upcoming"),
        cls: "neutral",
      };
    if (now >= end)
      return {
        label: text(lang, "Đã kết thúc", "Ended"),
        cls: "danger",
      };
    return {
      label: text(lang, "Đang chạy", "Ongoing"),
      cls: "success",
    };
  };

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter === "ACTIVE" && !r.active) return false;
      if (statusFilter === "INACTIVE" && r.active) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = String(r.name ?? "").toLowerCase().includes(q);
        const codeMatch = String(r.code ?? "").toLowerCase().includes(q);
        const skuMatch = String(r.sku ?? "").toLowerCase().includes(q);
        if (!nameMatch && !codeMatch && !skuMatch) return false;
      }
      return true;
    });
  }, [rows, statusFilter, searchQuery]);

  return (
    <div className="cbst-promotion-manager">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: "#1c1917" }}>
          {kind === "promotions"
            ? text(lang, "Khuyến mãi", "Promotions")
            : owner
              ? text(lang, "Voucher", "Vouchers")
              : text(lang, "Voucher được cấp", "Assigned vouchers")}
        </h2>
      </div>

      {/* Header Description Notice */}
      <div style={{ marginBottom: 16 }}>
        <p className="notice" style={{ margin: 0 }}>
          {kind === "promotions"
            ? text(
                lang,
                "Quản lý các chương trình khuyến mãi công khai theo thời gian. Giá ưu đãi sẽ tự động áp dụng trên Storefront trong khung giờ hiệu lực mà không cần sửa giá gốc sản phẩm.",
                "Manage time-based public promotions. Promotional prices automatically apply on Storefront during the active window without changing catalog base prices.",
              )
            : text(
                lang,
                "Quản lý mã Voucher nội bộ cấp cho thành viên để chốt đơn cho khách quen. Một đơn hàng chỉ áp dụng tối đa 1 hình thức ưu đãi (không cộng dồn voucher và khuyến mãi công khai).",
                "Manage internal vouchers assigned to members for repeat customer sales. Strictly one discount mode per order (no stacking public promotion and internal voucher).",
              )}
        </p>
      </div>

      {error ? (
        <div className="notice error" role="alert" style={{ marginBottom: 16 }}>
          <span>{errorText(error, lang)}</span>
          <button
            type="button"
            className="button secondary"
            style={{ marginLeft: 12, padding: "2px 8px", fontSize: "0.8rem" }}
            onClick={() => setRevision((n) => n + 1)}
          >
            {text(lang, "Tải lại", "Reload")}
          </button>
        </div>
      ) : null}

      {/* Control Bar: Search + Filter on Left, Action Button on Right */}
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
                color: "#a8a29e",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder={text(lang, "Tìm theo tên, mã...", "Search by name, code...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="cbst-search-input"
              style={{
                paddingLeft: 36,
                paddingRight: 12,
                paddingTop: 8,
                paddingBottom: 8,
                width: "100%",
                height: 38,
                fontSize: "0.9rem",
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
            style={{ width: "auto", minWidth: 150, height: 38, fontSize: "0.9rem" }}
          >
            <option value="ALL">{text(lang, "Tất cả trạng thái", "All statuses")}</option>
            <option value="ACTIVE">{text(lang, "Đang kích hoạt", "Active only")}</option>
            <option value="INACTIVE">{text(lang, "Đã tạm dừng", "Inactive only")}</option>
          </select>
        </div>

        {owner && (
          <button
            type="button"
            className="button primary"
            onClick={() => {
              setSelected(null);
              setIsModalOpen(true);
            }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
          >
            <Plus size={16} />
            <span>
              {kind === "promotions"
                ? text(lang, "Tạo khuyến mãi mới", "Create promotion")
                : text(lang, "Tạo voucher mới", "Create voucher")}
            </span>
          </button>
        )}
      </div>

      {/* Main Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>{kind === "promotions" ? text(lang, "Chương trình & SKU", "Promotion & SKU") : text(lang, "Mã & Tên Voucher", "Code & Name")}</th>
              <th>{text(lang, "Hình thức & Mức giảm", "Type & Discount")}</th>
              <th>{text(lang, "Thời gian hiệu lực", "Validity Window")}</th>
              <th style={{ textAlign: "center" }}>{text(lang, "Trạng thái", "Status")}</th>
              {owner && <th style={{ textAlign: "center", width: 180 }}>{text(lang, "Thao tác", "Actions")}</th>}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={owner ? 5 : 4}
                  style={{ textAlign: "center", padding: "36px 16px", color: "#78716c" }}
                >
                  {busy ? text(lang, "Đang tải dữ liệu...", "Loading records...") : text(lang, "Chưa có dữ liệu nào phù hợp.", "No records found.")}
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const windowStatus = getWindowStatus(String(row.startAt), String(row.endAt));
                const isPercent = row.kind === "PERCENT";
                const displayDiscount = isPercent
                  ? `${Number(row.value) / 100}%${row.maxDiscountVnd ? ` (Tối đa ${new Intl.NumberFormat("vi-VN").format(Number(row.maxDiscountVnd))}đ)` : ""}`
                  : `${new Intl.NumberFormat("vi-VN").format(Number(row.value))}đ${kind === "promotions" ? "/hũ" : ""}`;

                return (
                  <tr key={String(row.id)}>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <strong style={{ color: "#1c1917" }}>{String(row.name)}</strong>
                        <div>
                          {kind === "promotions" ? (
                            <span className="cbst-code-badge" style={{ fontSize: "0.8rem" }}>
                              {String(row.sku ?? "")}
                            </span>
                          ) : (
                            <span
                              className="cbst-code-badge"
                              style={{
                                fontSize: "0.85rem",
                                background: "#fef3c7",
                                color: "#b45309",
                                borderColor: "#fde68a",
                              }}
                            >
                              {String(row.code ?? "")}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong style={{ color: "#d84012" }}>{displayDiscount}</strong>
                        {kind === "vouchers" && row.minSubtotalVnd ? (
                          <div style={{ fontSize: "0.8rem", color: "#78716c", marginTop: 2 }}>
                            {text(lang, "Đơn từ: ", "Min: ")}
                            {new Intl.NumberFormat("vi-VN").format(Number(row.minSubtotalVnd))}đ
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <span className={`badge ${windowStatus.cls}`} style={{ alignSelf: "flex-start" }}>
                          {windowStatus.label}
                        </span>
                        <div style={{ fontSize: "0.8rem", color: "#57534e" }}>
                          <div>{formatDateDisplay(String(row.startAt))}</div>
                          <div style={{ color: "#a8a29e" }}>đến {formatDateDisplay(String(row.endAt))}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {row.active ? (
                        <span className="badge success">
                          <CheckCircle2 size={13} style={{ marginRight: 4 }} />
                          {text(lang, "Kích hoạt", "Active")}
                        </span>
                      ) : (
                        <span className="badge danger">
                          <XCircle size={13} style={{ marginRight: 4 }} />
                          {text(lang, "Tạm dừng", "Inactive")}
                        </span>
                      )}
                    </td>
                    {owner && (
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                          <button
                            type="button"
                            className="button secondary"
                            style={{ padding: "5px 10px", fontSize: "0.8rem" }}
                            onClick={() => {
                              setSelected(row);
                              setIsModalOpen(true);
                            }}
                            disabled={busy}
                          >
                            <Edit3 size={13} />
                            <span>{text(lang, "Sửa", "Edit")}</span>
                          </button>

                          {kind === "vouchers" && (
                            <button
                              type="button"
                              className="button secondary"
                              style={{ padding: "5px 10px", fontSize: "0.8rem" }}
                              onClick={() => handleOpenRedemptions(row)}
                              disabled={busy}
                              title={text(lang, "Xem lượt đã dùng", "View redemptions")}
                            >
                              <Eye size={13} />
                              <span>{`${Number(row.consumedCount ?? 0)}/${Number(row.maxUsageTotal ?? 0)}`}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="button danger"
                            style={{ padding: "5px 10px", fontSize: "0.8rem" }}
                            onClick={() => handleDelete(row)}
                            disabled={busy}
                          >
                            <Trash2 size={13} />
                            <span>{text(lang, "Xóa", "Delete")}</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
        <button
          type="button"
          className="button secondary"
          disabled={busy || page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          {text(lang, "Trang trước", "Previous")}
        </button>
        <span style={{ fontSize: "0.85rem", color: "#78716c" }}>
          {text(lang, `Trang ${page + 1}`, `Page ${page + 1}`)}
        </span>
        <button
          type="button"
          className="button secondary"
          disabled={busy || rows.length < 25}
          onClick={() => setPage((p) => p + 1)}
        >
          {text(lang, "Trang sau", "Next")}
        </button>
      </div>

      {/* Create / Edit Popup Modal */}
      {owner && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelected(null);
          }}
          title={
            selected
              ? text(lang, "Chỉnh sửa cấu hình", "Edit configuration")
              : kind === "vouchers"
                ? text(lang, "Tạo voucher mới", "Create voucher")
                : text(lang, "Tạo khuyến mãi mới", "Create promotion")
          }
          subtitle={text(
            lang,
            "Thiết lập thông tin giảm giá, thời gian và phạm vi áp dụng.",
            "Configure discount details, active window and scope.",
          )}
          size="lg"
          keepMounted={true}
        >
          <form
            key={`${kind}:${selected?.id ?? "new"}:${revision}`}
            className="action-form cbst-modal-form"
            onSubmit={submit}
          >
            <fieldset disabled={busy} style={{ border: "none", padding: 0, margin: 0 }}>
              <div
                className="form-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                {fields.map((key) => {
                  const meta = fieldLabels[key] || { vi: key, en: key };
                  const isSelect = key === "kind" || key === "sku";
                  const isCheck = key === "active";
                  const isDate = key.endsWith("At");
                  const isNum = numeric.includes(key);

                  return (
                    <div
                      key={key}
                      style={{
                        gridColumn: isCheck || key === "name" || key === "assignedMemberIds" ? "1 / -1" : "auto",
                      }}
                    >
                      <label style={{ display: "block", marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#374151" }}>
                          {text(lang, meta.vi, meta.en)}
                          {["name", "code", "value", "startAt", "endAt", "maxUsageTotal", "maxUsagePerCustomer"].includes(key) && (
                            <span style={{ color: "#d84012", marginLeft: 4 }}>*</span>
                          )}
                        </span>

                        {isSelect ? (
                          <select
                            name={key}
                            defaultValue={String(selected?.[key] ?? (key === "sku" ? skus[0] : "PERCENT"))}
                            style={{ width: "100%", marginTop: 4, height: 40 }}
                          >
                            {(key === "sku"
                              ? skus
                              : ["PERCENT", kind === "promotions" ? "FIXED_PER_UNIT" : "FIXED"]
                            ).map((v) => (
                              <option key={v} value={v}>
                                {v === "PERCENT"
                                  ? text(lang, "Giảm theo phần trăm (%)", "Percentage (%)")
                                  : v === "FIXED_PER_UNIT"
                                    ? text(lang, "Giảm số tiền cố định mỗi hũ (VND)", "Fixed per jar (VND)")
                                    : text(lang, "Giảm số tiền cố định toàn đơn (VND)", "Fixed per order (VND)")}
                              </option>
                            ))}
                          </select>
                        ) : isCheck ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                            <input
                              type="checkbox"
                              name={key}
                              defaultChecked={selected ? selected.active === true : true}
                              style={{ width: 18, height: 18, accentColor: "#d84012" }}
                            />
                            <span style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                              {text(
                                lang,
                                "Cho phép áp dụng chương trình này ngay trong thời gian hiệu lực",
                                "Enable this configuration immediately during active window",
                              )}
                            </span>
                          </div>
                        ) : (
                          <input
                            name={key}
                            type={isNum ? "number" : isDate ? "datetime-local" : "text"}
                            min={0}
                            step={isNum ? 1 : undefined}
                            required={["name", "code", "value", "startAt", "endAt", "maxUsageTotal", "maxUsagePerCustomer"].includes(key)}
                            defaultValue={
                              isDate
                                ? localDate(selected?.[key])
                                : Array.isArray(selected?.[key])
                                  ? (selected![key] as string[]).join(", ")
                                  : String(selected?.[key] ?? "")
                            }
                            placeholder={meta.help ? text(lang, meta.help.vi, meta.help.en) : undefined}
                            style={{
                              width: "100%",
                              marginTop: 4,
                              height: 40,
                              textTransform: key === "code" ? "uppercase" : "none",
                            }}
                          />
                        )}

                        {meta.help && !isCheck && (
                          <small style={{ color: "#9ca3af", display: "block", marginTop: 4, fontSize: "0.8rem" }}>
                            {text(lang, meta.help.vi, meta.help.en)}
                          </small>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>

              {/* Modal Action Buttons */}
              <div
                className="cbst-modal-actions"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                  paddingTop: 16,
                  borderTop: "1px solid #e5e7eb",
                }}
              >
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => {
                    setIsModalOpen(false);
                    setSelected(null);
                  }}
                  disabled={busy}
                >
                  {text(lang, "Hủy bỏ", "Cancel")}
                </button>
                <button type="submit" className="button primary" disabled={busy}>
                  {busy
                    ? text(lang, "Đang lưu...", "Saving...")
                    : selected
                      ? text(lang, "Lưu thay đổi", "Save changes")
                      : kind === "vouchers"
                        ? text(lang, "Tạo voucher", "Create voucher")
                        : text(lang, "Tạo khuyến mãi", "Create promotion")}
                </button>
              </div>
            </fieldset>
          </form>
        </Modal>
      )}

      {/* Redemptions History Modal */}
      {redemptionVoucher && (
        <Modal
          isOpen={!!redemptionVoucher}
          onClose={() => {
            setRedemptionVoucher(null);
            setRedemptions(null);
          }}
          title={text(lang, "Lịch sử sử dụng Voucher", "Voucher Redemptions")}
          subtitle={`${String(redemptionVoucher.code ?? "")} - ${String(redemptionVoucher.name ?? "")} (Đã dùng: ${String(redemptionVoucher.consumedCount ?? 0)} / Đang giữ: ${String(redemptionVoucher.reservedCount ?? 0)})`}
          size="md"
        >
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {!redemptions || redemptions.length === 0 ? (
              <p style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0" }}>
                {text(lang, "Chưa có lượt sử dụng nào cho voucher này.", "No redemptions for this voucher yet.")}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {redemptions.map((r, i) => (
                  <div
                    key={String(r.id ?? i)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: 8,
                      fontSize: "0.85rem",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: "#111827" }}>
                        {text(lang, "Đơn hàng: ", "Order: ")}
                        <span style={{ fontFamily: "monospace" }}>#{String(r.orderId ?? "").slice(0, 8)}</span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: 2 }}>
                        {formatDateDisplay(String(r.createdAt ?? ""))}
                      </div>
                    </div>
                    <div>
                      <span
                        className={`badge ${r.state === "CONSUMED" ? "success" : r.state === "RESERVED" ? "neutral" : "danger"}`}
                      >
                        {String(r.state ?? "")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ marginTop: 20, textAlign: "right" }}>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setRedemptionVoucher(null);
                setRedemptions(null);
              }}
            >
              {text(lang, "Đóng", "Close")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
