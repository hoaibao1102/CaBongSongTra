import type { OrderStatus, Role } from "./types";
import { safeQuote, type PricingQuote } from "./pricing";
export const skus = ["CBST-300", "CBST-400", "CBST-600"];
export type FieldOption = string | { value: string; label: string };
export type Field = {
  name: string;
  vi: string;
  en: string;
  type?: string;
  options?: FieldOption[];
  min?: number;
  max?: number;
  maxLength?: number;
  minLength?: number;
  optional?: boolean;
  pattern?: string;
};
const field = (
  name: string,
  vi: string,
  en: string,
  extra: Partial<Field> = {},
): Field => ({ name, vi, en, ...extra });
const version = field(
  "expectedVersion",
  "Phiên bản hiện tại",
  "Current version",
  { type: "number", min: 0, max: 2147483647 },
);
const reason = field("reason", "Lý do", "Reason", { maxLength: 300 });
const amount = field("amountVnd", "Số tiền (VND)", "Amount (VND)", {
  type: "number",
  min: 1,
  max: 1000000000,
});
const method = field("method", "Phương thức", "Method", {
  options: ["CASH", "BANK_TRANSFER", "COD_SETTLEMENT"],
});
const uuid = {
  pattern:
    "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
};
const email = field("email", "Email", "Email", {
  type: "email",
  maxLength: 254,
});
const password = field("password", "Mật khẩu", "Password", {
  type: "password",
  maxLength: 128,
});
const graph: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKING", "CANCELLED"],
  PACKING: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["DELIVERED", "DELIVERY_FAILED", "RETURN_REQUESTED"],
  DELIVERED: ["RETURN_REQUESTED"],
  CANCELLED: [],
  DELIVERY_FAILED: ["SHIPPING", "RETURNED"],
  RETURN_REQUESTED: ["PARTIALLY_RETURNED", "RETURNED"],
  PARTIALLY_RETURNED: ["RETURN_REQUESTED", "RETURNED"],
  RETURNED: [],
};
export const transitions = (status: OrderStatus, role: Role) =>
  (graph[status] ?? []).filter(
    (next) =>
      !["PARTIALLY_RETURNED", "RETURNED"].includes(next) &&
      (role === "OWNER_ADMIN" || next !== "RETURN_REQUESTED"),
  );
export const sectionsFor = (role: Role) =>
  role === "OWNER_ADMIN"
    ? [
        "dashboard",
        "create-order",
        "orders",
        "inventory",
        "users",
        "products",
        "promotions",
        "vouchers",
        "media",
        "expenses",
        "commissions",
        "audit",
      ]
    : ["dashboard", "create-order", "orders", "vouchers", "commissions"];
type Action = {
  vi: string;
  en: string;
  path: (id: string) => string;
  method?: "PATCH";
  fields: Field[];
};
export const actions: Record<string, Action> = {
  login: {
    vi: "Đăng nhập",
    en: "Sign in",
    path: () => "auth/login",
    fields: [email, password],
  },
  transition: {
    vi: "Chuyển trạng thái",
    en: "Change status",
    path: (id) => `orders/${id}/transitions`,
    fields: [
      version,
      field("status", "Trạng thái mới", "New status", {
        options: Object.keys(graph),
      }),
      reason,
    ],
  },
  payment: {
    vi: "Ghi nhận thực thu",
    en: "Record received payment",
    path: (id) => `orders/${id}/payments`,
    fields: [version, amount, method],
  },
  refund: {
    vi: "Hoàn tiền",
    en: "Record refund",
    path: (id) => `orders/${id}/refunds`,
    fields: [
      version,
      amount,
      method,
      reason,
      field("purpose", "Mục đích hoàn tiền", "Refund purpose", {
        options: ["GOODWILL", "RETURN"],
        optional: true,
      }),
    ],
  },
  costs: {
    vi: "Chốt chi phí",
    en: "Finalize costs",
    path: (id) => `orders/${id}/finalize-costs`,
    fields: [
      version,
      field(
        "finalized",
        "Xác nhận đã đủ chi phí",
        "Confirm all costs recorded",
        { type: "checkbox" },
      ),
    ],
  },
  receipt: {
    vi: "Nhập kho",
    en: "Receive inventory",
    path: () => "inventory/receipts",
    fields: [
      field("sku", "Sản phẩm", "Product", { options: skus }),
      field("lotCode", "Mã lô", "Lot code", { maxLength: 100 }),
      field("qty", "Số lượng", "Quantity", {
        type: "number",
        min: 1,
        max: 100000,
      }),
      field(
        "landedUnitCostVnd",
        "Giá vốn mỗi hộp (VND)",
        "Landed unit cost (VND)",
        { type: "number", min: 0, max: 10000000 },
      ),
      field("receivedAt", "Ngày nhập", "Received at", {
        type: "datetime-local",
      }),
      field("expiresAt", "Hạn dùng", "Expires at", {
        type: "datetime-local",
        optional: true,
      }),
      field("labelReference", "Tham chiếu nhãn", "Label reference", {
        optional: true,
        maxLength: 500,
      }),
    ],
  },
  adjustment: {
    vi: "Điều chỉnh giảm kho",
    en: "Reduce inventory",
    path: () => "inventory/adjustments",
    fields: [
      field("batchId", "ID lô", "Batch ID", uuid),
      field("qtyDelta", "Số lượng giảm (số âm)", "Quantity delta (negative)", {
        type: "number",
        min: -100000,
        max: -1,
      }),
      reason,
    ],
  },
  user: {
    vi: "Tạo thành viên",
    en: "Create member",
    path: () => "users",
    fields: [
      field("displayName", "Tên hiển thị", "Display name", { maxLength: 100 }),
      email,
      { ...password, minLength: 12 },
    ],
  },
  userStatus: {
    vi: "Cập nhật tài khoản",
    en: "Update account status",
    path: (id) => `users/${id}`,
    method: "PATCH",
    fields: [
      field("status", "Trạng thái", "Status", {
        options: ["ACTIVE", "INACTIVE"],
      }),
    ],
  },
  product: {
    vi: "Cập nhật sản phẩm",
    en: "Update product",
    path: (id) => `products/${id}`,
    method: "PATCH",
    fields: [
      version,
      field("retailPriceVnd", "Giá bán (VND)", "Retail price (VND)", {
        type: "number",
        min: 1,
        max: 10000000,
      }),
      field("active", "Đang bán", "Active", {
        type: "checkbox",
        optional: true,
      }),
    ],
  },
  expense: {
    vi: "Ghi chi phí",
    en: "Record expense",
    path: () => "expenses",
    fields: [
      field("scope", "Phạm vi", "Scope", { options: ["OVERHEAD", "ORDER"] }),
      field("orderId", "ID đơn hàng", "Order ID", { ...uuid, optional: true }),
      { ...version, optional: true },
      amount,
      field("category", "Loại chi phí", "Category", {
        options: ["SHIPPING", "PACKAGING", "MARKETING", "OTHER"],
      }),
      reason,
    ],
  },
  payout: {
    vi: "Chi toàn bộ hoa hồng khả dụng",
    en: "Pay full available commission",
    path: () => "commissions/payouts",
    fields: [
      field("memberId", "Thành viên nhận", "Recipient member", uuid),
      field("reference", "Tham chiếu thanh toán", "Payment reference", {
        maxLength: 100,
      }),
    ],
  },
  assignment: {
    vi: "Giao đơn cho thành viên",
    en: "Assign order to member",
    path: (id) => `orders/${id}/assignment`,
    fields: [
      version,
      field("memberId", "Thành viên phụ trách", "Responsible member", uuid),
      reason,
    ],
  },
  resetPassword: {
    vi: "Đặt lại mật khẩu",
    en: "Reset password",
    path: () => "auth/reset-password",
    fields: [
      field("token", "Mã khôi phục", "Reset token", {
        type: "password",
        pattern: "[A-Za-z0-9_-]{43}",
        minLength: 43,
        maxLength: 43,
      }),
      { ...password, minLength: 12 },
    ],
  },
  returnIntake: {
    vi: "Tiếp nhận hàng trả đã kiểm tra",
    en: "Receive inspected return",
    path: (id) => `orders/${id}/returns`,
    fields: [
      version,
      field("batchId", "ID lô xuất ban đầu", "Original shipped batch ID", uuid),
      field("qty", "Số lượng trả", "Returned quantity", {
        type: "number",
        min: 1,
        max: 100,
      }),
      field("disposition", "Xử lý hàng", "Disposition", {
        options: ["DISCARD", "RESTOCK"],
      }),
      field(
        "inspectionReference",
        "Bằng chứng kiểm tra",
        "Inspection reference",
        { maxLength: 500 },
      ),
      reason,
    ],
  },
  editOrder: {
    vi: "Sửa số lượng đơn hàng",
    en: "Edit order quantities",
    path: (id) => `orders/${id}`,
    method: "PATCH",
    fields: [
      version,
      ...skus.map((sku) =>
        field(sku, `Số lượng ${sku}`, `Quantity ${sku}`, {
          type: "number",
          min: 0,
          max: 100,
        }),
      ),
      reason,
    ],
  },
};
export function buildPayload(
  action: string,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const f of actions[action].fields) {
    if (
      action === "expense" &&
      values.scope === "OVERHEAD" &&
      ["orderId", "expectedVersion"].includes(f.name)
    )
      continue;
    const raw = values[f.name];
    if (f.type === "checkbox") {
      output[f.name] = raw === true || raw === "on";
      if (!f.optional && !output[f.name]) throw new Error("VALIDATION_FAILED");
      continue;
    }
    if (raw === undefined || raw === "") {
      if (f.optional) continue;
      throw new Error("VALIDATION_FAILED");
    }
    if (f.type === "number") {
      const n = Number(raw);
      if (
        !Number.isSafeInteger(n) ||
        n < (f.min ?? 0) ||
        n > (f.max ?? Number.MAX_SAFE_INTEGER)
      )
        throw new Error("VALIDATION_FAILED");
      output[f.name] = n;
    } else {
      const value = f.type === "password" ? String(raw) : String(raw).trim();
      if (
        !value ||
        value.length < (f.minLength ?? 1) ||
        value.length > (f.maxLength ?? 1000) ||
        (f.options &&
          !f.options
            .map((opt) => (typeof opt === "object" ? opt.value : opt))
            .includes(value)) ||
        (f.pattern && !new RegExp(`^${f.pattern}$`).test(value)) ||
        (f.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      )
        throw new Error("VALIDATION_FAILED");
      output[f.name] =
        f.type === "datetime-local" ? new Date(value).toISOString() : value;
    }
  }
  if (
    action === "expense" &&
    output.scope === "ORDER" &&
    (!output.orderId || output.expectedVersion === undefined)
  )
    throw new Error("VALIDATION_FAILED");
  if (action === "returnIntake") {
    output.lines = [
      {
        batchId: output.batchId,
        qty: output.qty,
        disposition: output.disposition,
      },
    ];
    delete output.batchId;
    delete output.qty;
    delete output.disposition;
  }
  if (action === "editOrder") {
    output.items = skus
      .filter((sku) => Number(output[sku]) > 0)
      .map((sku) => ({ sku, qty: output[sku] }));
    for (const sku of skus) delete output[sku];
    if (!(output.items as unknown[]).length)
      throw new Error("VALIDATION_FAILED");
  }
  return output;
}
export function checkoutPayload(
  values: Record<string, unknown>,
  cart: Record<string, number>,
) {
  const customer = Object.fromEntries(
    ["name", "phone", "address", "area"].map((key) => [
      key,
      String(values[key] ?? "").trim(),
    ]),
  );
  if (
    !customer.name ||
    customer.name.length > 100 ||
    !/^(?:0|\+84)[35789]\d{8}$/.test(customer.phone) ||
    customer.address.length < 5 ||
    customer.address.length > 500 ||
    !customer.area ||
    customer.area.length > 100 ||
    !(values.consent === true || values.consent === "on")
  )
    throw new Error("VALIDATION_FAILED");
  const items = Object.entries(cart)
    .filter(([, qty]) => qty !== 0)
    .map(([sku, qty]) => {
      if (!skus.includes(sku) || !Number.isInteger(qty) || qty < 1 || qty > 100)
        throw new Error("VALIDATION_FAILED");
      return { sku, qty };
    });
  if (
    !items.length ||
    !["WEBSITE", "FACEBOOK_GROUP", "DIRECT", "OTHER"].includes(
      String(values.source),
    ) ||
    String(values.notes ?? "").length > 1000
  )
    throw new Error("VALIDATION_FAILED");
  return {
    customer,
    items,
    consent: true,
    source: values.source,
    notes: String(values.notes ?? ""),
  };
}
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    public requestId?: string,
    public quote?: PricingQuote,
  ) {
    super(code);
  }
}
export async function apiRequest<T = unknown>(
  path: string,
  init?: RequestInit,
  fetcher: typeof fetch = fetch,
): Promise<T> {
  if (
    !/^[A-Za-z0-9/-]+(?:\?[A-Za-z0-9=&]+)?$/.test(path) ||
    path.startsWith("/") ||
    path.includes("//")
  )
    throw new Error("INVALID_API_PATH");
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetcher(`/api/v1/${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data?.error?.code ?? "REQUEST_REJECTED",
      response.status,
      data?.error?.requestId,
      response.status === 409 && data?.error?.code === "PRICE_STALE_CONFIRMATION_REQUIRED"
        ? safeQuote(data.error.quote) : undefined,
    );
  return data as T;
}
export function createMutation(fetcher: typeof fetch = fetch) {
  const pending = new Map<string, string>();
  return async (
    path: string,
    payload: unknown,
    method = "POST",
    guest?: string,
  ) => {
    const body = JSON.stringify(payload);
    const signature = `${method}:${path}:${guest ?? ""}:${body}`;
    const key = pending.get(signature) ?? crypto.randomUUID();
    pending.set(signature, key);
    const result = await apiRequest(
      path,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
          ...(guest ? { "X-Guest-Session": guest } : {}),
        },
        body,
      },
      fetcher,
    );
    pending.delete(signature);
    return result;
  };
}
