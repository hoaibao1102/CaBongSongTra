"use client";

import React, { useState, useMemo } from "react";
import { Edit3, CheckCircle2, XCircle, Tag, Plus, Search } from "lucide-react";
import { Modal } from "./Modal";
import { CurrencyInput } from "./CurrencyInput";
import { ApiError, createMutation } from "../commerce";
import { money, text } from "../i18n";
import type { Lang } from "../types";
const durableMutation = createMutation();

export interface OwnerProductRow {
  id: string;
  sku: string;
  name: string;
  netWeightG: number;
  retailPriceVnd: number;
  active: boolean;
  version: number;
}

export interface ProductManagerProps {
  products: OwnerProductRow[];
  lang: Lang;
  onRefresh: () => void;
  onUnauthorized?: () => void;
}

export function ProductManager({
  products,
  lang,
  onRefresh,
  onUnauthorized,
}: ProductManagerProps) {
  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState<OwnerProductRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editActive, setEditActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create Product Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSkuSuffix, setCreateSkuSuffix] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPrice, setCreatePrice] = useState(0);
  const [createActive, setCreateActive] = useState(true);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  const openEdit = (p: OwnerProductRow) => {
    setEditingProduct(p);
    setEditName(p.name);
    setEditPrice(p.retailPriceVnd);
    setEditActive(p.active);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setError(null);
    setSubmitting(true);

    try {
      const payload = {
        name: editName.trim(),
        retailPriceVnd: editPrice,
        active: editActive,
        expectedVersion: editingProduct.version,
      };

      await durableMutation(`products/${editingProduct.sku}`, payload, "PATCH");

      setEditingProduct(null);
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401 && onUnauthorized) {
        onUnauthorized();
      } else if (err instanceof ApiError) {
        setError(
          err.status === 409
            ? text(
                lang,
                "Dữ liệu sản phẩm vừa bị thay đổi bởi người khác. Vui lòng tải lại và thử lại.",
                "Product version conflict. Please refresh and try again.",
              )
            : err.message || "Không thể cập nhật sản phẩm.",
        );
      } else {
        setError("Đã xảy ra lỗi không xác định.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    const cleanSuffix = createSkuSuffix.replace(/^CBST-?/i, "").trim();
    if (!cleanSuffix) {
      setCreateError(text(lang, "Vui lòng nhập mã định danh SKU.", "Please enter SKU identifier."));
      return;
    }
    if (!createName.trim()) {
      setCreateError(text(lang, "Vui lòng nhập tên sản phẩm.", "Please enter product name."));
      return;
    }
    if (createPrice <= 0) {
      setCreateError(text(lang, "Giá bán niêm yết phải lớn hơn 0đ.", "Retail price must be greater than 0."));
      return;
    }

    setCreateSubmitting(true);
    try {
      const fullSku = `CBST-${cleanSuffix}`;
      await durableMutation("products", {
          sku: fullSku,
          name: createName.trim(),
          retailPriceVnd: createPrice,
          active: createActive,
      });

      setIsCreateOpen(false);
      setCreateSkuSuffix("");
      setCreateName("");
      setCreatePrice(0);
      setCreateActive(true);
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401 && onUnauthorized) {
        onUnauthorized();
      } else if (err instanceof ApiError) {
        setCreateError(
          err.status === 409
            ? text(lang, "Mã SKU này đã tồn tại trong hệ thống.", "This SKU already exists.")
            : err.message || text(lang, "Không thể tạo sản phẩm mới.", "Failed to create product.")
        );
      } else {
        setCreateError(text(lang, "Đã xảy ra lỗi không xác định.", "An unknown error occurred."));
      }
    } finally {
      setCreateSubmitting(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (statusFilter === "ACTIVE" && !p.active) return false;
      if (statusFilter === "INACTIVE" && p.active) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSku = p.sku.toLowerCase().includes(q);
        const matchName = p.name.toLowerCase().includes(q);
        if (!matchSku && !matchName) return false;
      }
      return true;
    });
  }, [products, statusFilter, searchQuery]);

  return (
    <div className="cbst-product-manager">
      <div style={{ marginBottom: 16 }}>
        <p className="notice" style={{ margin: 0 }}>
          {text(
            lang,
            "Quản lý danh mục sản phẩm và giá niêm yết. Giá bán cập nhật hoặc sản phẩm mới sẽ áp dụng cho các đơn hàng mới mà không làm thay đổi giá của đơn hàng cũ.",
            "Manage product catalog and list prices. Updated prices or new products apply to new orders without altering historical snapshots.",
          )}
        </p>
      </div>

      {/* Single-row Filter & Controls Bar */}
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
              placeholder={text(lang, "Tìm theo SKU hoặc tên...", "Search by SKU or name...")}
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
            <option value="ACTIVE">{text(lang, "Đang bán", "Active only")}</option>
            <option value="INACTIVE">{text(lang, "Ngừng bán", "Inactive only")}</option>
          </select>
        </div>

        <button
          type="button"
          className="button primary"
          onClick={() => {
            setIsCreateOpen(true);
            setCreateError(null);
          }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}
        >
          <Plus size={16} />
          <span>{text(lang, "Thêm sản phẩm mới", "Add new product")}</span>
        </button>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style={{ width: 64 }}>{text(lang, "Ảnh", "Image")}</th>
              <th>{text(lang, "Mã SKU", "SKU")}</th>
              <th>{text(lang, "Tên sản phẩm", "Product Name")}</th>
              <th style={{ textAlign: "right" }}>{text(lang, "Khối lượng tịnh", "Net Weight")}</th>
              <th style={{ textAlign: "right" }}>{text(lang, "Giá niêm yết", "Retail Price")}</th>
              <th style={{ textAlign: "center" }}>{text(lang, "Trạng thái", "Status")}</th>
              <th style={{ textAlign: "center", width: 120 }}>{text(lang, "Thao tác", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "32px 16px", color: "#78716c" }}>
                  {text(lang, "Không tìm thấy sản phẩm nào phù hợp điều kiện.", "No matching products found.")}
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => {
                const weightStr = p.netWeightG > 0 ? `${p.netWeightG}g` : "-";
                return (
                  <tr key={p.sku}>
                    <td>
                      <div className="cbst-product-thumb">
                        <Tag size={18} />
                      </div>
                    </td>
                    <td>
                      <strong className="cbst-code-badge">{p.sku}</strong>
                    </td>
                    <td>
                      <strong style={{ color: "#1c1917" }}>{p.name}</strong>
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{weightStr}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, fontFamily: "var(--font-mono)", color: "#d84012" }}>
                      {money(p.retailPriceVnd, lang)}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {p.active ? (
                        <span className="badge success">
                          <CheckCircle2 size={13} style={{ marginRight: 4 }} />
                          {text(lang, "Đang bán", "Active")}
                        </span>
                      ) : (
                        <span className="badge danger">
                          <XCircle size={13} style={{ marginRight: 4 }} />
                          {text(lang, "Ngừng bán", "Inactive")}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        className="button secondary"
                        style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                        onClick={() => openEdit(p)}
                      >
                        <Edit3 size={14} />
                        <span>{text(lang, "Chỉnh sửa", "Edit")}</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create Product Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={text(lang, "Thêm sản phẩm mới", "Add New Product")}
        subtitle={text(lang, "Khai báo mã SKU, tên hiển thị và giá bán niêm yết", "Define SKU, display name and retail price")}
        size="md"
      >
        <form onSubmit={handleCreate}>
          {createError && (
            <div className="notice error" role="alert" style={{ marginBottom: 16 }}>
              {createError}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Mã SKU", "SKU Code")} <span className="required-mark" aria-hidden="true">*</span></span>
              <div style={{ display: "flex", alignItems: "center", marginTop: 4 }}>
                <span
                  style={{
                    background: "#f5f5f4",
                    padding: "8px 12px",
                    border: "1px solid #d6d3d1",
                    borderRight: "none",
                    borderRadius: "6px 0 0 6px",
                    fontWeight: 700,
                    color: "#57534e",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "0.95rem",
                    userSelect: "none",
                  }}
                >
                  CBST-
                </span>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 500 hoặc TET-VIP"
                  value={createSkuSuffix}
                  onChange={(e) =>
                    setCreateSkuSuffix(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
                  }
                  style={{
                    borderRadius: "0 6px 6px 0",
                    fontFamily: "var(--font-mono, monospace)",
                    textTransform: "uppercase",
                  }}
                />
              </div>
              <small style={{ color: "#78716c", marginTop: 4, display: "block" }}>
                {text(
                  lang,
                  "Mã định danh duy nhất (ví dụ nhập 500 sẽ thành SKU CBST-500, tự động suy ra khối lượng 500g).",
                  "Unique SKU identifier (e.g. entering 500 becomes CBST-500 and derives 500g net weight).",
                )}
              </small>
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Tên hiển thị sản phẩm", "Product display name")} <span className="required-mark" aria-hidden="true">*</span></span>
              <input
                type="text"
                required
                placeholder={text(lang, "Ví dụ: Cá Bống Sông Trà Hũ 500g", "E.g. Ca Bong Song Tra 500g")}
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Giá bán niêm yết (VND)", "Retail Price (VND)")} <span className="required-mark" aria-hidden="true">*</span></span>
              <CurrencyInput
                value={createPrice}
                onChange={(val) => setCreatePrice(val)}
                min={1000}
              />
            </label>
            <small style={{ color: "#78716c", marginTop: 4, display: "block" }}>
              {text(
                lang,
                "Giá này sẽ hiển thị trên Storefront và tính cho các đơn hàng tạo mới.",
                "This price will display on Storefront and be charged on new orders.",
              )}
            </small>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={createActive}
                onChange={(e) => setCreateActive(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#d84012" }}
              />
              <span style={{ fontWeight: 600, color: "#1c1917" }}>
                {text(lang, "Cho phép bán sản phẩm này ngay (Kích hoạt)", "Enable product for sales immediately (Active)")}
              </span>
            </label>
          </div>

          <div className="cbst-modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setIsCreateOpen(false)}
              disabled={createSubmitting}
            >
              {text(lang, "Hủy bỏ", "Cancel")}
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={createSubmitting}
            >
              {createSubmitting
                ? text(lang, "Đang tạo...", "Creating...")
                : text(lang, "Thêm sản phẩm", "Add Product")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Product Edit Modal */}
      <Modal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title={text(lang, "Chỉnh sửa thông tin sản phẩm", "Edit Product")}
        subtitle={editingProduct ? `${editingProduct.sku} (${editingProduct.netWeightG}g)` : ""}
        size="md"
      >
        {editingProduct && (
          <form onSubmit={handleSave}>
            {error && (
              <div className="notice error" role="alert" style={{ marginBottom: 16 }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label>
                <span>{text(lang, "Tên hiển thị sản phẩm", "Product display name")} <span className="required-mark" aria-hidden="true">*</span></span>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label>
                <span>{text(lang, "Giá bán niêm yết (VND)", "Retail Price (VND)")} <span className="required-mark" aria-hidden="true">*</span></span>
                <CurrencyInput
                  value={editPrice}
                  onChange={(val) => setEditPrice(val)}
                  min={1000}
                />
              </label>
              <small style={{ color: "#78716c", marginTop: 4, display: "block" }}>
                {text(
                  lang,
                  "Giá này sẽ hiển thị trên Storefront và tính cho các đơn hàng tạo mới.",
                  "This price will display on Storefront and be charged on new orders.",
                )}
              </small>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: "#d84012" }}
                />
                <span style={{ fontWeight: 600, color: "#1c1917" }}>
                  {text(lang, "Cho phép bán sản phẩm này (Kích hoạt)", "Enable product for sales (Active)")}
                </span>
              </label>
            </div>

            <div className="cbst-modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setEditingProduct(null)}
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
                  ? text(lang, "Đang lưu...", "Saving...")
                  : text(lang, "Lưu thay đổi", "Save changes")}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

