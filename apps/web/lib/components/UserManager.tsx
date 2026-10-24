"use client";
import { useActorMutation } from "../operation-actor";

import React, { useState, useMemo } from "react";
import {
  CreditCard,
  Percent,
  KeyRound,
  Plus,
  Search,
} from "lucide-react";
import { Modal } from "./Modal";
import { apiRequest, ApiError } from "../commerce";
import { text, errorText } from "../i18n";
import type { Lang, MemberUser } from "../types";


export interface UserManagerProps {
  users: MemberUser[];
  lang: Lang;
  onRefresh: () => void;
  onUnauthorized?: () => void;
}

export function UserManager({
  users,
  lang,
  onRefresh,
  onUnauthorized,
}: UserManagerProps) {
  const durableMutation = useActorMutation();
  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Edit Rate Modal
  const [rateUser, setRateUser] = useState<MemberUser | null>(null);
  const [newRatePercent, setNewRatePercent] = useState<number>(40);
  const [rateReason, setRateReason] = useState("");
  const [rateSubmitting, setRateSubmitting] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  // Edit Bank Info Modal
  const [bankUser, setBankUser] = useState<MemberUser | null>(null);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [bankNote, setBankNote] = useState("");
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);

  // Reset Token Modal
  const [resetTokenUser, setResetTokenUser] = useState<MemberUser | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [tokenSubmitting, setTokenSubmitting] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Submit Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSubmitting(true);

    try {
      await durableMutation("users", {
          displayName: createName.trim(),
          email: createEmail.trim(),
          password: createPassword,
      });

      setIsCreateOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401 && onUnauthorized) {
        onUnauthorized();
      } else if (err instanceof ApiError) {
        setCreateError(err.message || "Không thể tạo thành viên.");
      } else {
        setCreateError(errorText(err, lang));
      }
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Submit Update Rate
  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateUser) return;
    setRateError(null);
    setRateSubmitting(true);

    try {
      const rateBps = Math.round(newRatePercent * 100);
      await durableMutation(`users/${rateUser.id}/commission-rate`, {
          rateBps,
          reason: rateReason.trim() || undefined,
      }, "PATCH");

      setRateUser(null);
      setRateReason("");
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401 && onUnauthorized) {
        onUnauthorized();
      } else if (err instanceof ApiError) {
        setRateError(err.message || "Không thể cập nhật tỷ lệ hoa hồng.");
      } else {
        setRateError(errorText(err, lang));
      }
    } finally {
      setRateSubmitting(false);
    }
  };

  // Submit Update Bank Info
  const handleUpdateBankInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankUser) return;
    setBankError(null);
    setBankSubmitting(true);

    try {
      await durableMutation(`users/${bankUser.id}/bank-info`, {
        bankInfo: {
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountHolder: accountHolder.trim().toUpperCase(),
          note: bankNote.trim() || undefined,
        },
      }, "PATCH");

      setBankUser(null);
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401 && onUnauthorized) {
        onUnauthorized();
      } else if (err instanceof ApiError) {
        setBankError(err.message || "Không thể cập nhật thông tin ngân hàng.");
      } else {
        setBankError(errorText(err, lang));
      }
    } finally {
      setBankSubmitting(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (user: MemberUser) => {
    const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await durableMutation(`users/${user.id}`, { status: nextStatus }, "PATCH");
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401 && onUnauthorized) {
        onUnauthorized();
      }
    }
  };

  // Issue reset token
  const handleIssueToken = async (userId: string) => {
    setTokenError(null);
    setIssuedToken(null);
    setTokenSubmitting(true);
    try {
      const res = await apiRequest<{ token: string }>(
        `users/${userId}/password-reset`,
        { method: "POST" },
      );
      setIssuedToken(res.token);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401 && onUnauthorized) {
        onUnauthorized();
      } else if (err instanceof ApiError) {
        setTokenError(err.message || "Không thể cấp token.");
      } else {
        setTokenError(errorText(err, lang));
      }
    } finally {
      setTokenSubmitting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (statusFilter !== "ALL" && u.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = u.displayName.toLowerCase().includes(q);
        const emailMatch = u.emailNormalized.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch) return false;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  const maskAccount = (num?: string) => {
    if (!num) return "—";
    if (num.length <= 4) return num;
    return `**** ${num.slice(-4)}`;
  };

  return (
    <div className="cbst-user-manager">
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
              placeholder={text(lang, "Tìm theo tên, email...", "Search name, email...")}
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
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
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
            <option value="ALL">{text(lang, "Tất cả vai trò", "All roles")}</option>
            <option value="MEMBER">{text(lang, "Cộng tác viên (MEMBER)", "Member")}</option>
            <option value="OWNER_ADMIN">{text(lang, "Chủ cửa hàng (OWNER)", "Owner")}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
            <option value="ALL">{text(lang, "Tất cả trạng thái", "All status")}</option>
            <option value="ACTIVE">{text(lang, "Hoạt động", "Active")}</option>
            <option value="INACTIVE">{text(lang, "Ngừng hoạt động", "Inactive")}</option>
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
              setCreateError(null);
              setIsCreateOpen(true);
            }}
          >
            <Plus size={16} />
            <span>{text(lang, "Thêm thành viên", "Add Member")}</span>
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>{text(lang, "Tên hiển thị", "Display Name")}</th>
              <th>{text(lang, "Email đăng nhập", "Email")}</th>
              <th>{text(lang, "Vai trò", "Role")}</th>
              <th style={{ textAlign: "center" }}>{text(lang, "Tỷ lệ hoa hồng", "Commission Rate")}</th>
              <th>{text(lang, "Tài khoản ngân hàng", "Bank Account")}</th>
              <th style={{ textAlign: "center" }}>{text(lang, "Trạng thái", "Status")}</th>
              <th style={{ textAlign: "center" }}>{text(lang, "Thao tác", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((u) => {
              const isOwner = u.role === "OWNER_ADMIN";
              const ratePercent = (u.commissionRateBps ?? 4000) / 100;

              return (
                <tr key={u.id}>
                  <td>
                    <strong style={{ color: "#1c1917" }}>{u.displayName}</strong>
                  </td>
                  <td>{u.emailNormalized}</td>
                  <td>
                    {isOwner ? (
                      <span className="badge warning">
                        {text(lang, "Chủ shop", "Owner Admin")}
                      </span>
                    ) : (
                      <span className="badge neutral">
                        {text(lang, "Cộng tác viên", "Member")}
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {!isOwner ? (
                      <button
                        type="button"
                        className="cbst-rate-chip"
                        onClick={() => {
                          setRateUser(u);
                          setNewRatePercent(ratePercent);
                          setRateError(null);
                        }}
                        title="Bấm để đổi tỷ lệ"
                      >
                        <Percent size={13} />
                        <span>{ratePercent}%</span>
                      </button>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div>
                        {u.bankInfo?.bankName ? (
                          <>
                            <strong>{u.bankInfo.bankName}</strong> ·{" "}
                            <span>{maskAccount(u.bankInfo.accountNumber)}</span>
                            <div style={{ fontSize: "0.78rem", color: "#78716c" }}>
                              {u.bankInfo.accountHolder}
                            </div>
                          </>
                        ) : (
                          <span className="muted">{text(lang, "Chưa cập nhật", "Not set")}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="cbst-btn-icon"
                        onClick={() => {
                          setBankUser(u);
                          setBankName(u.bankInfo?.bankName || "");
                          setAccountNumber(u.bankInfo?.accountNumber || "");
                          setAccountHolder(u.bankInfo?.accountHolder || "");
                          setBankNote(u.bankInfo?.note || "");
                          setBankError(null);
                        }}
                        title="Chỉnh sửa thông tin ngân hàng"
                      >
                        <CreditCard size={15} />
                      </button>
                    </div>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {u.status === "ACTIVE" ? (
                      <span className="badge success">{text(lang, "Hoạt động", "Active")}</span>
                    ) : (
                      <span className="badge danger">{text(lang, "Đã khóa", "Inactive")}</span>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {!isOwner && (
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <button
                          type="button"
                          className="button secondary"
                          style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                          onClick={() => handleToggleStatus(u)}
                        >
                          {u.status === "ACTIVE"
                            ? text(lang, "Khóa", "Deactivate")
                            : text(lang, "Mở khóa", "Activate")}
                        </button>
                        <button
                          type="button"
                          className="button secondary"
                          style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                          onClick={() => {
                            setResetTokenUser(u);
                            setIssuedToken(null);
                            setTokenError(null);
                          }}
                          title="Cấp mã đổi mật khẩu"
                        >
                          <KeyRound size={13} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: Create Member */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={text(lang, "Thêm tài khoản thành viên mới", "Add Member")}
        size="md"
      >
        <form onSubmit={handleCreateUser}>
          {createError && (
            <div className="notice error" role="alert" style={{ marginBottom: 16 }}>
              {createError}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Tên hiển thị / Họ tên CTV", "Full name")} <span className="required-mark" aria-hidden="true">*</span></span>
              <input
                type="text"
                required
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
              />
            </label>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>
              <span>{text(lang, "Email đăng nhập", "Email address")} <span className="required-mark" aria-hidden="true">*</span></span>
              <input
                type="email"
                required
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="ctv@gmail.com"
              />
            </label>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label>
              <span>{text(lang, "Mật khẩu khởi tạo (tối thiểu 12 ký tự)", "Initial password")} <span className="required-mark" aria-hidden="true">*</span></span>
              <input
                type="password"
                required
                minLength={12}
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
              />
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
                ? text(lang, "Đang xử lý...", "Creating...")
                : text(lang, "Tạo thành viên", "Create Member")}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Edit Commission Rate */}
      <Modal
        isOpen={!!rateUser}
        onClose={() => setRateUser(null)}
        title={text(lang, "Cập nhật tỷ lệ hoa hồng CTV", "Update Commission Rate")}
        subtitle={rateUser ? `${rateUser.displayName} (${rateUser.emailNormalized})` : ""}
        size="sm"
      >
        {rateUser && (
          <form onSubmit={handleUpdateRate}>
            {rateError && (
              <div className="notice error" role="alert" style={{ marginBottom: 16 }}>
                {rateError}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label>
                <span>{text(lang, "Tỷ lệ hoa hồng (%)", "Commission Rate (%)")} <span className="required-mark" aria-hidden="true">*</span></span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  required
                  value={newRatePercent}
                  onChange={(e) => setNewRatePercent(parseFloat(e.target.value) || 0)}
                  style={{ fontSize: "1.2rem", fontWeight: 700 }}
                />
              </label>
              <small style={{ color: "#78716c", marginTop: 4, display: "block" }}>
                {text(
                  lang,
                  "Mặc định là 40%. Thay đổi sẽ áp dụng cho các đơn hàng tạo từ thời điểm này trở đi.",
                  "Default is 40%. Applies to orders created from this point forward.",
                )}
              </small>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label>
                <span>{text(lang, "Lý do thay đổi", "Reason")}</span>
                <input
                  type="text"
                  value={rateReason}
                  onChange={(e) => setRateReason(e.target.value)}
                  placeholder={text(lang, "VD: Khen thưởng doanh số cao...", "e.g. Performance bonus...")}
                />
              </label>
            </div>

            <div className="cbst-modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setRateUser(null)}
                disabled={rateSubmitting}
              >
                {text(lang, "Hủy bỏ", "Cancel")}
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={rateSubmitting}
              >
                {rateSubmitting ? text(lang, "Đang lưu...", "Saving...") : text(lang, "Cập nhật", "Save")}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 3: Edit Bank Info */}
      <Modal
        isOpen={!!bankUser}
        onClose={() => setBankUser(null)}
        title={text(lang, "Thông tin tài khoản nhận tiền", "Bank Account Info")}
        subtitle={bankUser ? `${bankUser.displayName}` : ""}
        size="md"
      >
        {bankUser && (
          <form onSubmit={handleUpdateBankInfo}>
            {bankError && (
              <div className="notice error" role="alert" style={{ marginBottom: 16 }}>
                {bankError}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label>
                <span>{text(lang, "Tên ngân hàng", "Bank Name")} <span className="required-mark" aria-hidden="true">*</span></span>
                <input
                  type="text"
                  required
                  placeholder="VD: Vietcombank, Techcombank, MB Bank..."
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <label>
                <span>{text(lang, "Số tài khoản", "Account Number")} <span className="required-mark" aria-hidden="true">*</span></span>
                <input
                  type="text"
                  required
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </label>

              <label>
                <span>{text(lang, "Tên chủ tài khoản", "Account Holder")} <span className="required-mark" aria-hidden="true">*</span></span>
                <input
                  type="text"
                  required
                  placeholder="NGUYEN VAN A"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value.toUpperCase())}
                />
              </label>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label>
                <span>{text(lang, "Ghi chú thanh toán", "Payment Note")}</span>
                <input
                  type="text"
                  placeholder="Chi nhánh, cú pháp chuyển khoản..."
                  value={bankNote}
                  onChange={(e) => setBankNote(e.target.value)}
                />
              </label>
            </div>

            <div className="cbst-modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setBankUser(null)}
                disabled={bankSubmitting}
              >
                {text(lang, "Hủy bỏ", "Cancel")}
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={bankSubmitting}
              >
                {bankSubmitting ? text(lang, "Đang lưu...", "Saving...") : text(lang, "Lưu thông tin", "Save")}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL 4: Reset Password Token */}
      <Modal
        isOpen={!!resetTokenUser}
        onClose={() => setResetTokenUser(null)}
        title={text(lang, "Cấp mã đặt lại mật khẩu", "Issue Reset Token")}
        subtitle={resetTokenUser ? `${resetTokenUser.displayName}` : ""}
        size="sm"
      >
        <div>
          {tokenError && (
            <div className="notice error" role="alert" style={{ marginBottom: 16 }}>
              {tokenError}
            </div>
          )}

          <p style={{ fontSize: "0.92rem", color: "#44403c" }}>
            {text(
              lang,
              "Mã khôi phục có hiệu lực trong vòng 15 phút và chỉ sử dụng được 1 lần. Hãy gửi mã này trực tiếp cho thành viên qua kênh an toàn.",
              "This single-use reset token is valid for 15 minutes. Securely deliver it out of band.",
            )}
          </p>

          {issuedToken ? (
            <div style={{ margin: "16px 0", padding: 12, background: "#f5f5f4", borderRadius: 8 }}>
              <div style={{ fontSize: "0.8rem", color: "#78716c", marginBottom: 4 }}>
                {text(lang, "Mã khôi phục mật khẩu:", "Reset Token:")}
              </div>
              <code style={{ fontSize: "0.95rem", wordBreak: "break-all", color: "#d84012", fontWeight: 700 }}>
                {issuedToken}
              </code>
            </div>
          ) : (
            <div style={{ margin: "16px 0" }}>
              <button
                type="button"
                className="button primary"
                style={{ width: "100%" }}
                onClick={() => resetTokenUser && handleIssueToken(resetTokenUser.id)}
                disabled={tokenSubmitting}
              >
                {tokenSubmitting ? text(lang, "Đang tạo mã...", "Generating...") : text(lang, "Tạo mã khôi phục ngay", "Generate Token")}
              </button>
            </div>
          )}

          <div className="cbst-modal-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setResetTokenUser(null)}
            >
              {text(lang, "Đóng", "Close")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
