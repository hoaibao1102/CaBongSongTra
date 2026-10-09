# DECISION LOG — CÁ BỐNG SÔNG TRÀ

> Phiên bản: 1.0 — 09/10/2026  
> Trạng thái: **APPROVED BASELINE FOR P0a**  
> Người duyệt baseline: Owner dự án, thông qua yêu cầu đưa bộ docs qua gate “Ready for implementation”.  
> Múi giờ nghiệp vụ: `Asia/Ho_Chi_Minh`; timestamp lưu UTC.

## 1. Quy tắc quản trị quyết định

- Đây là nguồn canonical cho business decision. Tài liệu khác không tạo lại danh sách Q01–Q23.
- Trạng thái: `APPROVED`, `OPEN-NONBLOCKING`, `BLOCKED`, `SUPERSEDED`.
- Thay đổi một quyết định phải cập nhật đồng thời `DATA_DICTIONARY.md`, `API_CONTRACTS.md`, `TRACEABILITY_MATRIX.md` và test bị ảnh hưởng.
- Quyết định `OPEN-NONBLOCKING` dùng default ghi trong bảng để triển khai P0a; chỉ được đổi bằng decision mới.
- Dữ liệu staging không được tự chuyển thành dữ liệu production.

## 2. Baseline P0a đã chốt

| ID | Trạng thái | Quyết định canonical | Tác động |
|---|---|---|---|
| DEC-PROD-01 | APPROVED | Ba SKU là `CBST-300`, `CBST-400`, `CBST-600`; khối lượng tịnh 300/400/600g gồm cá và nước kho, không gồm bao bì. 250/300/500g là dữ liệu lỗi thời. Ảnh nhãn đủ ba SKU là gate go-live. | Product seed, UI, metadata, API |
| DEC-PROD-02 | APPROVED | Giá bán baseline 109.000/139.000/199.000đ; giá vốn mở đầu 65.000/95.000/140.000đ. Giá mới tạo version mới, không ghi đè lịch sử. | Pricing, order snapshot |
| DEC-CONTENT-01 | APPROVED | Không công bố HSD, thành phần, độ cay, bảo quản, chứng nhận hoặc tuyên bố “có hàng sẵn” nếu chưa có bằng chứng/kiểm kê. | Storefront, QA content |
| DEC-CONTACT-01 | OPEN-NONBLOCKING | P0a dùng một cấu hình Zalo duy nhất. Baseline tạm thời là số hiện có trong source; owner phải xác nhận trước production. Không hardcode link/QR ở nhiều nơi. | Env, CTA, QR; gate go-live |
| DEC-INV-01 | APPROVED | Một kho chung. Đơn `DRAFT` không giữ hàng; action confirm tạo reservation nguyên tử. | Schema, confirm API |
| DEC-INV-02 | APPROVED | Reservation P0a hết hạn sau 24 giờ nếu đơn chưa thanh toán và chưa chuyển `PREPARING`; job release idempotent. Admin có thể gia hạn kèm lý do/audit. Không tự hủy đơn đã có payment thành công. | Reservation job, audit |
| DEC-INV-03 | APPROVED | Xuất FEFO khi có HSD; nếu cùng HSD hoặc thiếu HSD hợp lệ thì FIFO. Lô hết hạn hoặc thiếu HSD bị `QUARANTINED` và không reserve; Admin chỉ mở lại sau khi bổ sung bằng chứng. | Batch selection, validation |
| DEC-INV-04 | APPROVED | `RESERVE` không ghi xuất kho; `FULFILL` khi chuyển sang `DELIVERED` mới ghi ledger âm và consume reservation. | Inventory ledger |
| DEC-ORD-01 | APPROVED | State machine canonical: `DRAFT → CONFIRMED → PREPARING → SHIPPING → DELIVERED`; `DRAFT/CONFIRMED → CANCELLED`; `SHIPPING/DELIVERED → RETURN_REQUESTED → PARTIALLY_RETURNED/RETURNED`. | API, UI, tests |
| DEC-ORD-02 | APPROVED | Sau confirm, Member chỉ được sửa thông tin giao không ảnh hưởng tiền/kho và chuyển trạng thái hợp lệ của đơn mình; đổi item, qty, giá, discount, owner hoặc financial fields cần Admin action có lý do/audit. | Authz, DTO |
| DEC-ORD-03 | APPROVED | Người tạo là `owner_member_id` mặc định; Admin có thể reassign kèm audit. Mỗi đơn P0a chỉ có một owner nhận commission. | Attribution |
| DEC-PAY-01 | APPROVED | Hỗ trợ `BANK_TRANSFER` và `CASH_COD`; payment tách khỏi order status, cho phép partial payment và refund bằng bản ghi mới, không ghi đè giao dịch. | Payments |
| DEC-FIN-01 | APPROVED | Commission chỉ `ELIGIBLE` khi order `DELIVERED`, payment `PAID`, chi phí trực tiếp đã đối soát và không có return mở. | Commission service |
| DEC-FIN-02 | APPROVED | Profit-share base = tiền thực thu từ khách − COGS thực xuất − chi phí trực tiếp − refund/giảm bổ sung. Member = 40% phần dương; owner = phần còn lại để bảo toàn tổng. Nếu base ≤ 0, commission member = 0 và vẫn ghi lỗ thật. | Finance formulas |
| DEC-FIN-03 | APPROVED | Đơn do Owner/Admin trực tiếp phụ trách không tạo khoản commission member 40% phải trả. | Commission |
| DEC-FIN-04 | APPROVED | Ship thu khách và ship shop trả là hai dòng riêng. Thành viên ứng hộ được ghi `ADVANCED_BY_MEMBER`; payout hoàn ứng tách khỏi commission. | Order costs, reconciliation |
| DEC-FIN-05 | APPROVED | Cước nhập phân bổ theo số hũ của lô vào `landed_unit_cost`; không đồng thời ghi lại cùng khoản đó như chi phí kỳ. | Batch cost, COGS |
| DEC-FIN-06 | APPROVED | Payout commission theo tháng; Admin duyệt và đánh dấu paid. Hoàn sau payout tạo adjustment âm kỳ sau, không sửa payout cũ. | Payout ledger |
| DEC-PROMO-01 | APPROVED | Promotion nằm ngoài P0a, thuộc P0b/P1. Bản đầu hỗ trợ amount, percentage có cap và freeship; mỗi đơn tối đa một promotion; chỉ Admin kích hoạt/tạm dừng. | Scope, future schema |
| DEC-KPI-01 | APPROVED | P0a chỉ báo cáo mô tả. Theo dõi mốc 10/20/30/50 hũ nhưng không tự sinh thưởng tiền. | Dashboard, no payout |
| DEC-AUTH-01 | APPROVED | Invite-only email/password; không public signup. MFA bắt buộc cho Admin trước go-live. Role canonical: `OWNER_ADMIN`, `MEMBER`. | Auth, RLS |
| DEC-PII-01 | APPROVED | Full phone/address chỉ Owner/Admin và owner của đơn được xem; Member khác không xem. Export toàn hệ thống chỉ Owner/Admin và phải audit. | RLS, projections |
| DEC-TECH-01 | APPROVED | Một Next.js App Router repo + Supabase PostgreSQL/Auth/Storage khi cần; không tạo backend thứ hai. | Architecture |
| DEC-TECH-02 | APPROVED | Local, staging và production tách DB/secrets. Production không dùng dữ liệu seed. | CI/CD |
| DEC-OPS-01 | APPROVED | Chạy song song Excel 1–2 tuần; đối soát hằng ngày; sau sign-off mới khóa Excel thành read-only/reference. | Rollout |
| DEC-OPS-02 | APPROVED | Go-live yêu cầu backup off-site và một lần restore thành công trên staging. | Operations |
| DEC-HOST-01 | BLOCKED | Owner phải xác nhận gói/host cho phép hoạt động thương mại trước production. Development/staging có thể tiếp tục. | Go-live gate |
| DEC-SCOPE-01 | APPROVED | P0a là vertical slice tiền/kho/quyền; promotions, KPI thưởng, content calendar, upload ảnh, PWA/offline, shipper API và analytics nâng cao không chặn P0a. | Backlog |

## 3. Gate trước production

Các mục sau không chặn code/staging nhưng chặn production:

- [ ] `DEC-PROD-01`: có ảnh nhãn và đối chiếu đủ ba SKU.
- [ ] Kiểm kê tồn vật lý; không mặc định 28 hũ là tồn thật.
- [ ] `DEC-CONTACT-01`: owner xác nhận số/link/QR Zalo.
- [ ] `DEC-HOST-01`: hosting/gói hợp lệ cho sử dụng thương mại.
- [ ] Admin MFA, RLS/IDOR tests, backup và restore staging pass.
- [ ] Đối chiếu tối thiểu 20 case tài chính với Excel.

## 4. Quy trình thay đổi

Decision mới dùng mẫu:

```text
ID: DEC-<DOMAIN>-<NN>
Trạng thái: APPROVED | OPEN-NONBLOCKING | BLOCKED | SUPERSEDED
Bối cảnh:
Quyết định:
Lựa chọn loại bỏ:
Tài liệu/schema/API/test bị tác động:
Người duyệt và ngày:
```
