# MIGRATION RUNBOOK V2

## Phạm vi

Owner chọn **production V2 trắng**. Không nhập sản phẩm, đơn, kho, khách, payment, mật khẩu hay ledger cũ. Google Sheets chỉ là archive read-only theo thời hạn pháp lý được xác minh.

## Cutover

1. Chụp snapshot nguồn và kiểm kê non-secret identifiers.
2. Khóa ghi hệ thống cũ; xuất archive mã hóa; ghi checksum và quyền truy cập.
3. Seed production chỉ với cấu hình/SKU đã owner duyệt; tồn kho bắt đầu bằng phiếu nhập thực tế, không tự tạo 28 hũ.
4. Tạo Owner qua bootstrap bảo mật; bắt đổi mật khẩu và bật MFA.
5. Smoke test catalog, checkout, auth, order, reserve, stock-out, payment, refund và audit.
6. Switch traffic trong maintenance window tối đa một ngày.
7. Theo dõi error/payment/inventory alerts; rollback traffic nếu gate thất bại.

## Rollback

Rollback chỉ chuyển traffic/app version về hệ thống cũ trong cửa sổ đã định; không dual-write và không ghi ngược MongoDB vào Sheets. Mọi giao dịch phát sinh trong V2 trước rollback phải xuất exception report để nhập/đối soát thủ công có owner ký.
