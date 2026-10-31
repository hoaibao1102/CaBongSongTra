import type { Lang } from "./types";
export const text = (lang: Lang, vi: string, en: string) =>
  lang === "vi" ? vi : en;
const labels: Record<string, [string, string]> = {
  promotions: ["Khuyến mãi", "Promotions"],
  vouchers: ["Voucher", "Vouchers"],
  paymentDueVnd: ["Còn phải thu", "Payment due"],
  returnValueVnd: ["Giá trị hàng trả", "Return value"],
  returnRefundsVnd: ["Đã hoàn theo hàng trả", "Return refunds"],
  returnCreditBalanceVnd: [
    "Tín dụng hàng trả còn lại",
    "Remaining return credit",
  ],
  refundableVnd: ["Số tiền có thể hoàn", "Refundable cash"],
  returnRefundDueVnd: ["Tiền hàng trả cần hoàn", "Return refund due"],
  returnableQty: ["Số lượng còn được trả", "Returnable quantity"],
  returnedQty: ["Số lượng đã trả", "Returned quantity"],
  qty: ["Số lượng", "Quantity"],
  active: ["Đang bán", "Active"],
  GOODWILL: ["Thiện chí / giảm trừ", "Goodwill"],
  RETURN: ["Thanh toán tín dụng hàng trả", "Settle return credit"],
  RESTOCK: ["Nhập lại kho sau kiểm tra", "Restock after inspection"],
  DISCARD: ["Loại bỏ", "Discard"],
  dashboard: ["Tổng quan", "Dashboard"],
  "create-order": ["Tạo đơn nội bộ", "Create Order"],
  orders: ["Đơn hàng", "Orders"],
  inventory: ["Kho hàng", "Inventory"],
  users: ["Thành viên", "Users"],
  products: ["Sản phẩm", "Products"],
  expenses: ["Chi phí", "Expenses"],
  commissions: ["Hoa hồng", "Commissions"],
  audit: ["Nhật ký", "Audit log"],
  media: ["Kho hình ảnh", "Media Library"],
  PENDING: ["Chờ xác nhận", "Pending"],
  CONFIRMED: ["Đã xác nhận", "Confirmed"],
  PACKING: ["Đang đóng gói", "Packing"],
  SHIPPING: ["Đang giao", "Shipping"],
  DELIVERED: ["Đã giao", "Delivered"],
  CANCELLED: ["Đã hủy", "Cancelled"],
  DELIVERY_FAILED: ["Giao thất bại", "Delivery failed"],
  RETURN_REQUESTED: ["Yêu cầu trả hàng", "Return requested"],
  PARTIALLY_RETURNED: ["Trả một phần", "Partially returned"],
  RETURNED: ["Đã trả hàng", "Returned"],
  CASH: ["Tiền mặt", "Cash"],
  BANK_TRANSFER: ["Chuyển khoản", "Bank transfer"],
  COD_SETTLEMENT: ["COD đã về cửa hàng", "COD received by shop"],
  ACTIVE: ["Hoạt động", "Active"],
  INACTIVE: ["Ngừng hoạt động", "Inactive"],
  AVAILABLE: ["Có thể bán", "Available"],
  QUARANTINED: ["Cách ly", "Quarantined"],
  OVERHEAD: ["Chi phí chung", "Overhead"],
  ORDER: ["Theo đơn hàng", "Order"],
  PACKAGING: ["Đóng gói", "Packaging"],
  MARKETING: ["Tiếp thị", "Marketing"],
  OTHER: ["Khác", "Other"],
  WEBSITE: ["Website", "Website"],
  FACEBOOK_GROUP: ["Nhóm Facebook", "Facebook group"],
  DIRECT: ["Trực tiếp", "Direct"],
  OWNER_ADMIN: ["Chủ cửa hàng", "Owner"],
  MEMBER: ["Thành viên", "Member"],
  PAYMENT: ["Thu tiền", "Payment"],
  REFUND: ["Hoàn tiền", "Refund"],
  COMMISSION: ["Hoa hồng", "Commission"],
  PAYOUT: ["Chi hoa hồng", "Payout"],
  id: ["ID", "ID"],
  orderCode: ["Mã đơn", "Order code"],
  status: ["Trạng thái", "Status"],
  version: ["Phiên bản", "Version"],
  totalVnd: ["Tổng tiền", "Total"],
  receiptsVnd: ["Đã thu", "Received"],
  refundsVnd: ["Đã hoàn", "Refunded"],
  cogsVnd: ["Giá vốn", "Cost of goods"],
  directCostsVnd: ["Chi phí trực tiếp", "Direct costs"],
  commissionVnd: ["Hoa hồng", "Commission"],
  costsFinalized: ["Đã chốt chi phí", "Costs finalized"],
  sku: ["Mã sản phẩm", "SKU"],
  name: ["Tên", "Name"],
  netWeightG: ["Khối lượng (g)", "Weight (g)"],
  retailPriceVnd: ["Giá bán", "Retail price"],
  lotCode: ["Mã lô", "Lot code"],
  receivedAt: ["Ngày nhập", "Received at"],
  expiresAt: ["Hạn dùng", "Expires at"],
  onHand: ["Tồn thực tế", "On hand"],
  reserved: ["Đã giữ", "Reserved"],
  landedUnitCostVnd: ["Giá vốn mỗi hộp", "Landed unit cost"],
  batchId: ["ID lô", "Batch ID"],
  orderId: ["ID đơn", "Order ID"],
  type: ["Loại", "Type"],
  qtyDelta: ["Thay đổi tồn", "Stock delta"],
  reservedDelta: ["Thay đổi giữ hàng", "Reservation delta"],
  actorId: ["Người thực hiện", "Actor ID"],
  createdAt: ["Thời điểm", "Created at"],
  displayName: ["Tên hiển thị", "Display name"],
  emailNormalized: ["Email", "Email"],
  role: ["Vai trò", "Role"],
  amountVnd: ["Số tiền", "Amount"],
  scope: ["Phạm vi", "Scope"],
  category: ["Loại chi phí", "Category"],
  reason: ["Lý do", "Reason"],
  kind: ["Loại bút toán", "Entry kind"],
  memberId: ["Thành viên phụ trách", "Responsible member"],
  action: ["Thao tác", "Action"],
  entityId: ["ID đối tượng", "Entity ID"],
  requestId: ["ID yêu cầu", "Request ID"],
  from: ["Từ", "From"],
  to: ["Đến", "To"],
  asOf: ["Cập nhật lúc", "As of"],
  timezone: ["Múi giờ", "Timezone"],
  deliveredOrders: ["Đơn đã giao", "Delivered orders"],
  deliveredUnits: ["Tổng số hũ bán được", "Total jars sold"],
  totalUnits: ["Tổng số hũ bán được", "Total jars sold"],
  revenueVnd: ["Doanh thu", "Revenue"],
  pendingCostOrders: ["Đơn chưa chốt chi phí", "Orders awaiting costs"],
  overheadVnd: ["Chi phí chung", "Overhead"],
  operatingCashMovementVnd: [
    "Biến động tiền hoạt động",
    "Operating cash movement",
  ],
  netProfitVnd: ["Lợi nhuận ròng", "Net profit"],
  responsibleMemberId: ["Thành viên phụ trách", "Responsible member"],
};
export const label = (key: string, lang: Lang) =>
  labels[key]?.[lang === "vi" ? 0 : 1] ?? key;
export const money = (value: number, lang: Lang) =>
  new Intl.NumberFormat(lang === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
export function errorText(error: unknown, lang: Lang) {
  if (
    error instanceof Error &&
    error.message === "CHECKOUT_RECONCILIATION_REQUIRED"
  )
    return text(
      lang,
      "Còn yêu cầu chưa rõ kết quả trong tab này. Nội dung hoặc tài khoản mới chưa được gửi. Khôi phục đúng nội dung và tài khoản ban đầu để thử lại; nếu không thể, liên hệ cửa hàng xác minh. Không xóa dữ liệu phiên để bỏ qua kiểm tra.",
      "This tab has an unresolved checkout. Changed details or a different account were not sent. Restore the original details and account to retry, or contact the shop for reconciliation. Do not clear session storage to bypass this check.",
    );
  if (error instanceof Error && error.message === "OPERATION_RECONCILIATION_REQUIRED")
    return text(lang,
      "Giao dịch trước chưa rõ kết quả. Khôi phục nội dung và tài khoản ban đầu để thử lại cùng mã; nếu không thể, cần đối soát với quản trị viên. Không xóa dữ liệu phiên hoặc đổi tài khoản để gửi thay thế.",
      "A previous operation is unresolved. Restore the original payload and account to retry with the same key, or contact an administrator for reconciliation. Do not clear session storage or switch accounts to submit a replacement.");
  if (error instanceof Error && error.message === "RETRY_STORAGE_UNAVAILABLE")
    return text(
      lang,
      "Không thể lưu dữ liệu kỹ thuật thử lại trong phiên. Chưa gửi đơn. Bật sessionStorage; nếu có yêu cầu chưa rõ kết quả, xác minh với cửa hàng trước khi xóa dữ liệu.",
      "Checkout was not sent: tab retry storage is unavailable or invalid. Enable sessionStorage; reconcile any uncertain earlier order before clearing storage.",
    );
  const code = error instanceof Error ? error.message : "REQUEST_REJECTED";
  const errors: Record<string, [string, string]> = {
    INVALID_STATE_TRANSITION: [
      "Tài khoản này không được chuyển sang trạng thái đã chọn. Hãy nhờ admin điều chỉnh trạng thái.",
      "Your account cannot make this transition. Ask an admin to correct the status.",
    ],
    VOUCHER_STATE_CONFLICT: [
      "Voucher của đơn đã được giải phóng hoặc không còn hợp lệ để sử dụng lại. Kiểm tra voucher trước khi mở lại đơn.",
      "The order voucher has been released or cannot be reused. Review the voucher before reopening the order.",
    ],
    VALIDATION_FAILED: [
      "Vui lòng kiểm tra các trường bắt buộc và giá trị nhập.",
      "Check required fields and entered values.",
    ],
    VERSION_CONFLICT: [
      "Dữ liệu đã thay đổi. Tải lại bản ghi, kiểm tra và gửi lại.",
      "This record changed. Reload it, review, then submit again.",
    ],
    OUT_OF_STOCK: [
      "Không đủ hàng để xử lý. Kiểm tra lại số lượng.",
      "There is not enough stock. Review quantities.",
    ],
    CHECKOUT_DISABLED_PENDING_TRANSACTION_VERIFICATION: [
      "Đặt hàng trực tuyến chưa được mở. Chưa có đơn hàng nào được xác nhận.",
      "Online checkout is not enabled yet. No order has been confirmed.",
    ],
    SESSION_INVALID: [
      "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
      "Your session expired. Please sign in again.",
    ],
    INVALID_CREDENTIALS: [
      "Email hoặc mật khẩu không đúng.",
      "Email or password is incorrect.",
    ],
    OWNER_REQUIRED: [
      "Chỉ chủ cửa hàng được thực hiện thao tác này.",
      "This action requires the owner.",
    ],
    API_NOT_CONFIGURED: [
      "Dịch vụ chưa được cấu hình. Vui lòng thử lại sau.",
      "The service is not configured. Please try later.",
    ],
    RATE_LIMITED: [
      "Quá nhiều yêu cầu. Đợi một phút trước khi thử lại.",
      "Too many requests. Wait a minute before retrying.",
    ],
    UPSTREAM_TIMEOUT: [
      "Chưa rõ kết quả xử lý. Giữ nguyên nội dung và thử lại để tránh ghi trùng.",
      "The result is uncertain. Retry unchanged to avoid a duplicate entry.",
    ],
    UPSTREAM_ERROR: [
      "Không thể kết nối dịch vụ. Giữ nguyên nội dung nếu thử lại.",
      "The service is unavailable. Keep the same values when retrying.",
    ],
    NO_PAYABLE_COMMISSION: [
      "Thành viên không có hoa hồng khả dụng để chi.",
      "This member has no payable commission.",
    ],
    MEMBER_UNAVAILABLE: [
      "Đơn hàng chỉ được giao cho tài khoản Thành viên / Cộng tác viên (Member) đang hoạt động. Không thể giao đơn cho tài khoản Quản trị viên (Admin).",
      "Orders can only be assigned to an active Member account. Admin accounts cannot be assigned as sales members.",
    ],
  };
  const message =
    errors[code]?.[lang === "vi" ? 0 : 1] ??
    text(
      lang,
      "Không thể hoàn tất yêu cầu. Kiểm tra dữ liệu hoặc thử lại.",
      "The request could not be completed. Review the values or retry.",
    );
  return `${message} (${/^[A-Z_]+$/.test(code) ? code : "NETWORK_ERROR"})`;
}
