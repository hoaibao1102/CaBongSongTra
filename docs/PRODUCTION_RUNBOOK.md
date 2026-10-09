# PRODUCTION RUNBOOK — P0a

## Trạng thái hiện tại

Code, UI, migration và CI đã sẵn sàng để kết nối hạ tầng. Chưa được coi là production-ready cho tới khi hoàn tất toàn bộ checklist cuối tài liệu.

## 1. Tạo Supabase project

1. Tạo project production tại region gần Vercel runtime.
2. Trong SQL Editor, áp dụng `supabase/migrations/202610090001_p0a_core.sql`.
3. Trong Authentication:
   - tắt public signup;
   - bật email/password;
   - bật MFA cho Owner/Admin;
   - cấu hình Site URL và Redirect URLs theo domain production.
4. Tạo user Owner/Admin bằng chức năng invite/create user trong dashboard.
5. Lấy UUID của user và chạy bằng SQL Editor, thay `<AUTH_USER_UUID>`:

```sql
insert into public.profiles(id, organization_id, display_name, role, active)
values (
  '<AUTH_USER_UUID>',
  '00000000-0000-4000-8000-000000000001',
  'Hoài Bảo',
  'OWNER_ADMIN',
  true
);
```

Không dùng service-role key trong browser hoặc biến `NEXT_PUBLIC_*`.

## 2. Cấu hình Vercel

Thiết lập cho Preview và Production:

```text
NEXT_PUBLIC_SUPABASE_URL=<project URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable/anon key>
NEXT_PUBLIC_SITE_URL=<production URL>
NEXT_PUBLIC_ZALO_PHONE=<số đã được owner xác nhận>
```

Chỉ cấu hình `SUPABASE_SERVICE_ROLE_KEY` nếu có server-only scheduled job thật sự cần; P0a web không cần key này cho thao tác người dùng.

## 3. Scheduled reservation release

RPC `release_expired_reservations()` chỉ cấp cho `service_role`. Gọi bằng Supabase Cron/pg_cron hoặc một Vercel Cron server-only mỗi 5–15 phút. Không expose RPC này cho browser.

## 4. Verification sau migration

- Đăng nhập Owner/Admin và xác nhận `/admin` tải thành công.
- Ba SKU phải là `CBST-300`, `CBST-400`, `CBST-600`.
- Nhập một lô staging có ảnh nhãn, HSD và số lượng thử.
- Tạo đơn nháp → confirm → preparing → shipping → delivered.
- Ghi receipt và direct costs; kiểm tra commission 40/60.
- Kiểm tra Member khác không đọc được order detail/PII.
- Retry cùng idempotency key không tạo bản ghi trùng.
- Hai confirm đồng thời với tồn 1 chỉ một request thành công.
- Export CSV không thực thi công thức bắt đầu bằng `=`, `+`, `-`, `@`.

## 5. Backup/restore

1. Dump database production bằng Supabase CLI hoặc `pg_dump` và lưu off-site mã hóa.
2. Restore dump vào project staging riêng.
3. Đối chiếu row count các bảng `orders`, `inventory_ledger`, `payments`, `commission_records`.
4. Ghi ngày, người thực hiện và kết quả restore. Không go-live nếu chưa restore thành công.

## 6. Gate bắt buộc trước go-live

- [ ] Ảnh nhãn và HSD/bảo quản của đủ ba SKU đã được duyệt.
- [ ] Tồn đầu kỳ đã kiểm kê vật lý; không lấy fixture 28 hũ làm tồn thật.
- [ ] Số/link/QR Zalo chính thức đã xác nhận và kiểm thử mobile.
- [ ] Gói hosting cho phép sử dụng thương mại.
- [ ] Admin MFA đã bật.
- [ ] Migration production đã áp dụng thành công.
- [ ] IDOR/RLS và concurrent reservation đã test trên staging.
- [ ] 20 golden finance cases đối chiếu Excel pass.
- [ ] Backup off-site và restore staging pass.
- [ ] Chạy song song Excel 1–2 tuần, chênh tiền/tồn được xử lý.
- [ ] `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` pass trong CI.
- [ ] `npm audit` đã được review; không chấp nhận lỗ hổng runtime chưa có biện pháp xử lý.
