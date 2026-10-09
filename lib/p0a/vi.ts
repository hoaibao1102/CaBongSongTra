const statusLabels: Record<string, string> = {
  DRAFT: "Đơn nháp",
  ACTIVE: "Đang hoạt động",
  HIDDEN: "Đang ẩn",
  DISCONTINUED: "Ngừng kinh doanh",
  AVAILABLE: "Có thể bán",
  QUARANTINED: "Tạm cách ly",
  DEPLETED: "Đã hết",
  EXPIRED: "Đã hết hạn",
  CONFIRMED: "Đã xác nhận",
  PREPARING: "Đang chuẩn bị",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
  RETURN_REQUESTED: "Yêu cầu hoàn hàng",
  RETURNED: "Đã hoàn hàng",
  UNPAID: "Chưa thanh toán",
  PARTIALLY_PAID: "Thanh toán một phần",
  PAID: "Đã thanh toán",
  OVERPAID: "Thanh toán dư",
  PARTIALLY_REFUNDED: "Hoàn tiền một phần",
  REFUNDED: "Đã hoàn tiền",
  PARTIALLY_RETURNED: "Hoàn hàng một phần",
  ESTIMATED: "Tạm tính",
  ELIGIBLE: "Đủ điều kiện",
  APPROVED: "Đã duyệt",
  ADJUSTED: "Đã điều chỉnh",
  REVERSED: "Đã thu hồi",
  PAID_OUT: "Đã chi trả",
  VOID: "Đã hủy hiệu lực",
  VOIDED: "Đã hủy hiệu lực",
  PENDING: "Đang chờ",
};

const auditActionLabels: Record<string, string> = {
  EXPORT_ORDERS_CSV: "Xuất danh sách đơn hàng",
  RECEIVE_BATCH: "Nhập lô hàng",
  CREATE_DRAFT_ORDER: "Tạo đơn nháp",
  CONFIRM_ORDER: "Xác nhận đơn hàng",
  TRANSITION_ORDER: "Chuyển trạng thái đơn hàng",
  PROCESS_RETURN: "Xử lý hoàn hàng",
  RECORD_PAYMENT: "Ghi nhận thanh toán",
  UPSERT_ORDER_COST: "Ghi nhận chi phí đơn hàng",
  CREATE_PRICE_VERSION: "Tạo phiên bản giá",
  APPROVE_COMMISSION: "Duyệt hoa hồng",
  CREATE_PAYOUT: "Tạo đợt chi trả",
};

const entityLabels: Record<string, string> = {
  orders: "Đơn hàng",
  order: "Đơn hàng",
  products: "Sản phẩm",
  product: "Sản phẩm",
  inventory_batches: "Lô hàng",
  inventory_batch: "Lô hàng",
  payments: "Thanh toán",
  payment: "Thanh toán",
  commission_records: "Hoa hồng",
  commission_record: "Hoa hồng",
  commission_payouts: "Đợt chi trả",
  commission_payout: "Đợt chi trả",
};

export function translateStatus(value: string | null | undefined) {
  if (!value) return "—";
  return statusLabels[value] ?? value;
}

export function translateAuditAction(value: string | null | undefined) {
  if (!value) return "—";
  return auditActionLabels[value] ?? value;
}

export function translateEntity(value: string | null | undefined) {
  if (!value) return "—";
  return entityLabels[value] ?? value;
}

const nextOrderStatuses: Record<string, readonly string[]> = {
  DRAFT: [],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["SHIPPING"],
  SHIPPING: ["DELIVERED", "RETURN_REQUESTED"],
  DELIVERED: ["RETURN_REQUESTED"],
  CANCELLED: [],
  RETURN_REQUESTED: [],
  PARTIALLY_RETURNED: [],
  RETURNED: [],
};

export function getNextOrderStatuses(status: string | null | undefined) {
  if (!status) return [];
  return [...(nextOrderStatuses[status] ?? [])];
}

export type PriceVersion = {
  retail_price: number;
  effective_from: string;
  effective_to: string | null;
};

export function findCurrentPrice(
  prices: PriceVersion[] | null | undefined,
  now = new Date(),
) {
  const nowMs = now.getTime();
  return [...(prices ?? [])]
    .filter((price) => {
      const startsAt = new Date(price.effective_from).getTime();
      const endsAt = price.effective_to
        ? new Date(price.effective_to).getTime()
        : Number.POSITIVE_INFINITY;
      return startsAt <= nowMs && nowMs < endsAt;
    })
    .sort(
      (a, b) =>
        new Date(b.effective_from).getTime() -
        new Date(a.effective_from).getTime(),
    )[0];
}
