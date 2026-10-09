import { describe, expect, it } from "vitest";
import {
  findCurrentPrice,
  getNextOrderStatuses,
  translateAuditAction,
  translateEntity,
  translateStatus,
} from "../lib/p0a/vi";

describe("nhãn tiếng Việt trong trang quản trị", () => {
  it("dịch trạng thái nhưng không thay đổi giá trị nghiệp vụ", () => {
    expect(translateStatus("DRAFT")).toBe("Đơn nháp");
    expect(translateStatus("DELIVERED")).toBe("Đã giao");
    expect(translateStatus("PAID")).toBe("Đã thanh toán");
    expect(translateStatus("ACTIVE")).toBe("Đang hoạt động");
  });

  it("dịch thao tác và đối tượng trong nhật ký", () => {
    expect(translateAuditAction("EXPORT_ORDERS_CSV")).toBe(
      "Xuất danh sách đơn hàng",
    );
    expect(translateEntity("orders")).toBe("Đơn hàng");
  });

  it("giữ nguyên mã chưa được định nghĩa để không làm mất thông tin", () => {
    expect(translateStatus("CUSTOM_STATE")).toBe("CUSTOM_STATE");
  });

  it("chỉ hiển thị các bước chuyển được RPC hỗ trợ trực tiếp", () => {
    expect(getNextOrderStatuses("DRAFT")).toEqual([]);
    expect(getNextOrderStatuses("CONFIRMED")).toEqual([
      "PREPARING",
      "CANCELLED",
    ]);
    expect(getNextOrderStatuses("PREPARING")).toEqual(["SHIPPING"]);
    expect(getNextOrderStatuses("DELIVERED")).toEqual(["RETURN_REQUESTED"]);
    expect(getNextOrderStatuses("RETURN_REQUESTED")).toEqual([]);
    expect(getNextOrderStatuses("RETURNED")).toEqual([]);
  });

  it("chọn đúng giá đang có hiệu lực thay vì giá tương lai", () => {
    const prices = [
      {
        retail_price: 120000,
        effective_from: "2026-01-01T00:00:00Z",
        effective_to: "2027-01-01T00:00:00Z",
      },
      {
        retail_price: 150000,
        effective_from: "2027-01-01T00:00:00Z",
        effective_to: null,
      },
    ];
    expect(
      findCurrentPrice(prices, new Date("2026-10-10T00:00:00Z"))?.retail_price,
    ).toBe(120000);
  });
});
