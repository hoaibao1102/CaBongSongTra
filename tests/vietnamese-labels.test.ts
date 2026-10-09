import { describe, expect, it } from "vitest";
import {
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
});
