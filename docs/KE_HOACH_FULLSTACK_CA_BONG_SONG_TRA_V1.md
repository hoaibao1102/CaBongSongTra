# MASTER PLAN — CÁ BỐNG SÔNG TRÀ
## Nâng cấp Landing Page Next.js thành hệ thống quản lý bán hàng nội bộ, tối ưu tốc độ, bảo mật và KPI

> **Phiên bản:** 1.1 — 09/10/2026  
> **Trạng thái:** **READY FOR IMPLEMENTATION** cho P0a theo baseline tại `DOCS_DECISION_LOG.md`; thay đổi nghiệp vụ phải cập nhật Decision Log trước khi code.  
> **Tài liệu canonical:** `DOCS_DECISION_LOG.md` · `DATA_DICTIONARY.md` · `API_CONTRACTS.md` · `TRACEABILITY_MATRIX.md`.  
> **Website hiện tại:** https://ca-bong-song-tra.vercel.app/  
> **Nguyên tắc:** *Giữ nguyên website đang chạy; bổ sung từng phần an toàn; một nguồn dữ liệu; dòng tiền và tồn kho phải đúng; không over-engineer.*

---

## 0. TÓM TẮT ĐIỀU HÀNH

### 0.1. Kết quả cuối cùng cần đạt

1. Khách mở trang chủ nhanh trên điện thoại; xem **3 sản phẩm**, giá chính xác, thông tin đúng nhãn, nhấn **Zalo** để liên hệ; **không bắt khách đăng nhập**.
2. Admin quản lý sản phẩm, giá, nội dung công khai, tồn kho theo lô, chiến dịch khuyến mãi, đơn hàng, chi phí, KPI và đối soát tiền trong `/admin`.
3. Thành viên đăng nhập, tạo và theo dõi đơn được giao, xem kết quả/KPI và commission của chính mình; **không tự sửa giá hoặc duyệt chiết khấu**.
4. Dữ liệu giá/khuyến mãi cập nhật không cần deploy; thay đổi không làm sai giá lịch sử của đơn.
5. **Không oversell** khi hai người cùng bán hũ cuối; không ghi nhận hoa hồng cho đơn chưa đủ điều kiện.
6. Có đối soát, xuất CSV/XLSX, sao lưu và khả năng khôi phục khi gặp sự cố.
7. Có bảo vệ nhiều lớp: xác thực, phân quyền, kiểm soát request, bot/rate limiting, audit log, backup, cảnh báo.

### 0.2. Quy mô và giới hạn kinh doanh

- Vốn thử nghiệm **3.000.000đ**; đợt nhập đề xuất **28 hũ**: 15 nhỏ, 8 vừa, 5 lớn; vốn hàng **2.435.000đ**, dự phòng **565.000đ**.
- Chưa tự sản xuất; bán hàng nhập từ Quảng Ngãi, giao ưu tiên TP Thủ Đức / Quận 9; không có mặt bằng; một kho chung.
- Giá gốc hũ nhỏ/vừa/lớn: **65.000 / 95.000 / 140.000đ**.
- Giá bán ưu tiên: **109.000 / 139.000 / 199.000đ**.
- Chia lợi nhuận đủ điều kiện **Admin/Chủ 60% — Người phụ trách 40%**, **không chia trên doanh thu**.
- KPI tháng: dự kiến mốc 10/20/30/50 hũ nhưng **chưa chốt số tiền thưởng**; KPI thưởng **khác** commission đơn.
- Không mở đại lý, phân kho riêng, chia cổ phần, checkout online, loyalty engine hoặc hạch toán kế toán tổng hợp trong V1.

### 0.3. Phân biệt phạm vi V1 và mở rộng

| Mức | Phạm vi | Tình trạng |
|---|---|---|
| **P0 / MVP vận hành** | Auth, role, sản phẩm/giá, kho theo lô, khách, đơn, chi phí, commission, dashboard cơ bản, audit, backup | Bắt buộc |
| **P1 / Sau khi P0 ổn** | Chiến dịch khuyến mãi, KPI, nguồn khách, báo cáo, analytics, import dữ liệu, kiểm thử tải | Triển khai tiếp |
| **P2 / Sau có dữ liệu thực** | Notifications, tự động chăm sóc khách, nhiều điểm kho, giao vận tích hợp, nâng cấp BI | Hoãn |

### 0.4. Cổng chặn ra mắt (GO/NO-GO)

**Không cho team dùng hệ thống chính thức** nếu còn một trong các lỗi: giao dịch trừ kho chưa nguyên tử; member đọc được lợi nhuận người khác; đơn hủy vẫn được commission; đổi giá làm thay đổi đơn cũ; chưa có bản sao lưu khôi phục thử; chính sách bảo quản/khối lượng tịnh không rõ nguồn từ nhãn.

---

## 1. HIỆN TRẠNG — NHỮNG GÌ ĐÃ XÁC MINH VÀ CHƯA XÁC MINH

### 1.1. Đã kiểm tra từ website công khai ngày 09/10/2026

Website đang hiển thị: Hero, ba sản phẩm, bảng giá/size, câu chuyện, bảo quản, hướng dẫn đặt mua, FAQ, Zalo và hình ảnh sản phẩm. Website đang công khai giá **109k, 139k, 199k**.

**Baseline quy cách đã chốt:** Ba SKU canonical là **300g/400g/600g khối lượng tịnh**, gồm cá và nước kho, không gồm hũ/bao bì. Quy cách 250/300/500g là dữ liệu bản thảo lỗi thời và không được dùng trong seed, UI, metadata hoặc API. Trước khi tiếp tục công bố như thông tin nhãn, vẫn phải lưu bằng chứng ảnh nhãn/nhà cung cấp cho cả ba SKU theo `DEC-PROD-01`; nếu bằng chứng thực tế khác, dừng publish và mở decision mới thay vì tự sửa âm thầm.

### 1.2. Baseline source đã xác minh ngày 09/10/2026

Repository local đã được kiểm tra tại thư mục dự án. Baseline hiện tại:

- Next.js **15.5.27** khi build, React **19.1.x**, TypeScript **5.7.x**, Tailwind CSS **4.1.x**.
- App Router nằm trong `app/`; dữ liệu landing page đang hardcode tại `data/site.ts`; component dùng thư mục `components/`.
- Landing page hiện prerender static. Production build thành công; route `/` có First Load JS khoảng **117 kB** trong lần đo baseline này.
- `npm run typecheck` và `npm run build` pass; `npm run lint` không có error, còn một warning anonymous default export tại `postcss.config.mjs`.
- Git remote local trỏ tới `https://github.com/hoaibao1102/CaBongSongTra.git`; truy cập ẩn danh trả 404 nên quyền/visibility remote vẫn cần owner xác nhận.
- Chưa có Supabase, route `/admin`, migrations, RLS hoặc test suite nghiệp vụ trong baseline hiện tại.

### 1.3. Khảo sát còn lại trước khi thay đổi production

- Kiểm kê ảnh/QR thật trong `public/`, dung lượng, kích thước và quyền sử dụng.
- Xác nhận Vercel project, domain, environment variables, gói dịch vụ, build logs và analytics.
- Chạy Lighthouse mobile/desktop, Web Vitals, network waterfall và screenshot breakpoint; không tuyên bố đạt performance nếu chưa đo.
- Kiểm kê mọi hardcode giá, quy cách, Zalo và nội dung an toàn thực phẩm; đối chiếu với tài liệu public canonical.
- Backup source/data hiện tại và xác nhận rollback trước migration.

---

## 2. QUYẾT ĐỊNH KIẾN TRÚC

### 2.1. Stack ưu tiên

| Lớp | Chọn | Vì sao |
|---|---|---|
| UI công khai | Next.js App Router, TypeScript | Giữ codebase đang có, SEO, server render |
| Admin | Cùng Next.js dưới `/admin` | Một nguồn code, ít deployment |
| UI | Tailwind + shadcn/ui nếu source tương thích | Mobile-first, dễ quản trị |
| Backend | Next.js Server Actions/Route Handlers + service layer | Tránh server NestJS riêng ở quy mô nhỏ |
| Database | Supabase PostgreSQL | Giao dịch/constraint, SQL báo cáo |
| Auth | Supabase Auth, user do admin mời | Không public signup cho team |
| Authorization | RLS + kiểm quyền trong server DAL/action | Defense in depth |
| Files | Supabase Storage hoặc ảnh tĩnh tối ưu | Kiểm soát upload và quyền |
| Deploy | Vercel cho Next.js; Supabase riêng | Dễ triển khai, theo dõi |
| Cache | Chiến lược phù hợp **phiên bản Next.js đang dùng** | Tránh cấu hình sai giữa các phiên bản |
| Observability | Vercel logs/Web Analytics + bảng audit | Đủ cho giai đoạn test |
| Backup | `pg_dump`/Supabase CLI + xuất dữ liệu off-site | Có phương án khôi phục |

> **Lưu ý hosting:** Vercel **Hobby** theo điều khoản công bố giới hạn mục đích cá nhân, phi thương mại. Bản test kỹ thuật có thể tiếp tục trên môi trường hiện tại, nhưng trước khi vận hành bán hàng thật cần chuyển gói phù hợp (ví dụ Pro) **hoặc** hosting cho phép thương mại. Không mặc định gói Free dùng được cho hoạt động kinh doanh.

### 2.2. Phân vùng web công khai / admin

```text
Browser khách ──> Vercel CDN ──> cached/prerendered Public Page
                       │
                       └─> Server data access ──> Supabase (chỉ dữ liệu công khai)

Browser team ──> /login ──> /admin (authenticated, uncached/private)
                                    │
                             Server Actions/Routes
                                    │
                            Service / DAL + validation
                                    │
                              Postgres transactions
                                    │
                              RLS + audit log
```

- Chỉ một PostgreSQL làm **source of truth**; không tính tồn kho từ một biến lưu client.
- Client **không có** Supabase service role key; mọi thao tác đặc quyền phải ở server và có authz.
- Nghiệp vụ kho, hoàn tiền/đảo commission dùng **DB transaction/RPC** thay vì chuỗi nhiều request độc lập.
- Dữ liệu bán hàng nội bộ không đưa vào payload HTML/Client Component trang công khai.

### 2.3. Cấu trúc thư mục đích

```text
src/
  app/
    (public)/page.tsx
    (public)/san-pham/[slug]/page.tsx       # tùy chọn V1
    (auth)/login/page.tsx
    admin/layout.tsx
    admin/page.tsx
    admin/products/page.tsx
    admin/inventory/page.tsx
    admin/inventory/batches/page.tsx
    admin/orders/page.tsx
    admin/orders/[id]/page.tsx
    admin/customers/page.tsx
    admin/promotions/page.tsx
    admin/kpi/page.tsx
    admin/reports/page.tsx
    admin/settings/page.tsx
    api/health/route.ts
    api/analytics/zalo-click/route.ts        # chỉ nếu cần server tracking
  components/public/
  components/admin/
  lib/auth/
  lib/supabase/{browser,server,admin}.ts
  lib/dal/
  lib/services/{orders,inventory,promotions,commissions,kpi}.ts
  lib/validation/
  lib/cache/
  lib/observability/
  types/
supabase/
  migrations/
  seed.sql
  tests/{unit,integration,e2e,security,load}/
docs/
  ADR/
  RUNBOOK.md
  DATA_DICTIONARY.md
```

### 2.4. ADR (Architecture Decision Records)

Tạo tài liệu quyết định ngắn: `ADR-001-monolith-nextjs`, `ADR-002-supabase-rls`, `ADR-003-stock-reservation`, `ADR-004-commission-eligibility`, `ADR-005-public-cache`. Mỗi ADR: bối cảnh, lựa chọn, lựa chọn loại bỏ, tác động, ngày và người duyệt.

---

## 3. PHÂN QUYỀN VÀ ĐỊNH DANH

### 3.1. Vai trò

- **Owner/Admin:** sản phẩm, giá, chương trình, lô nhập, điều chỉnh kho, đơn của mọi người, chi phí, KPI, trả commission, quản lý team, báo cáo, backup.
- **Member:** xem tồn khả dụng, tạo đơn, cập nhật trạng thái trong phạm vi phân công, xem khách được phép truy cập, xem thu nhập/KPI bản thân; **không** thấy lợi nhuận của đồng đội và **không** sửa giá niêm yết.
- **Viewer/Auditor (tuỳ chọn sau):** đọc báo cáo, không ghi dữ liệu.

### 3.2. Ma trận quyền tóm tắt

| Nghiệp vụ | Admin | Member |
|---|---|---|
| Xem giá và tồn khả dụng | Có | Có |
| Sửa giá vốn/giá bán | Có | Không |
| Nhập/điều chỉnh/huỷ lô | Có | Không |
| Tạo đơn | Có | Có |
| Sửa đơn của người khác | Có | Không mặc định |
| Duyệt khuyến mãi/giảm ngoài chính sách | Có | Không |
| Xem P&L toàn đội | Có | Không |
| Xem commission cá nhân | Có | Có |
| Xác nhận payout | Có | Không |
| Xuất dữ liệu khách toàn hệ thống | Có, có log | Không |

### 3.3. Tiêu chuẩn auth

- Chỉ Admin mời email đăng nhập, vô hiệu hóa tự đăng ký public.
- MFA ít nhất cho tài khoản Admin; session cookie an toàn; logout; reset password.
- Route guard để tối ưu UX **không thay thế** kiểm tra quyền ở từng Server Action/Route Handler và RLS.
- Tài khoản nghỉ team: disable/revoke sessions; lịch sử vẫn giữ user ID bất biến.
- Trường nhạy cảm như địa chỉ, SĐT khách: chỉ trả về khi có mục đích công việc; ẩn một phần ở danh sách nếu không cần.
- Thao tác nhạy cảm (đổi giá vốn, điều chỉnh kho, payout) ghi `audit_logs` trước/sau, actor, thời gian, lý do.

---

## 4. THIẾT KẾ DATABASE CHI TIẾT

### 4.1. Quy ước

- UUID primary keys; `created_at`, `updated_at` UTC; frontend hiển thị Asia/Ho_Chi_Minh.
- Tiền dùng `BIGINT` VND hoặc `NUMERIC(14,0)`; không dùng floating point cho tiền.
- Có `CHECK quantity > 0`, `NOT NULL`, unique, foreign keys, index phù hợp.
- Không xoá vật lý đơn đã chốt hoặc ledger đã post; dùng trạng thái/void và bút toán đảo.
- Snapshot giá/giảm/giá vốn/commission của từng đơn để giữ lịch sử.
- `idempotency_key` cho các lệnh ghi có nguy cơ lặp.

### 4.2. Danh sách bảng và trường cốt lõi

| Bảng | Trường chính / chú ý |
|---|---|
| `profiles` | `id auth.users`, display_name, role, active, joined_at |
| `products` | id, sku, slug, name, label_net_weight_g, description, status, hero_image_path, sort_order |
| `product_prices` | product_id, retail_price, effective_from/to, created_by, reason; không chồng khoảng hiệu lực |
| `inventory_batches` | id, product_id, supplier, lot_code, received_at, mfg_date, expiry_date, unit_cost, received_qty, notes |
| `inventory_ledger` | id, batch_id, product_id, order_item_id?, qty_delta, reason, actor_id, created_at, reference_id; append-only |
| `inventory_reservations` | id, order_id, order_item_id, batch_id, quantity, status, reserved_at, released_at |
| `customers` | id, display_name, normalized_phone?, area, address?, zalo_id?, consent_notes, created_at |
| `customer_sources` | id, label, channel, campaign_tag, active |
| `orders` | id, order_code, customer_id, owner_member_id, source_id, status, payment_status, item_subtotal, discount_total, customer_shipping_fee, shop_shipping_cost, other_direct_cost, gross_collected, placed_at, fulfilled_at, cancellation_reason |
| `order_items` | id, order_id, product_id, qty, unit_list_price_snapshot, unit_sell_price_snapshot, discount_allocated, unit_cogs_snapshot, assigned_batch_id?, subtotal |
| `payments` | order_id, method, amount, status, received_at, reference; hỗ trợ partial và refund |
| `promotions` | id, name, code?, type, value, starts_at, ends_at, max_uses, max_budget, status, combinable, created_by |
| `promotion_rules` | promo_id, product_id?, min_qty?, min_cart_value?, per_customer_limit?, eligible_channels? |
| `promotion_redemptions` | promo_id, order_id, customer_id, allocated_discount, redeemed_at; unique theo rule |
| `order_costs` | order_id, type, amount, evidence_url?, note, entered_by; ads per-order chỉ ghi nếu có quy tắc phân bổ rõ |
| `commission_records` | order_id, member_id, base_profit, owner_amount, member_amount, policy_snapshot, status, eligible_at, payout_id? |
| `commission_payouts` | id, member_id, period, amount, paid_at, method, proof, approved_by |
| `kpi_policies` | id, period_start/end, metric, threshold, reward_amount?, active, approved_by |
| `kpi_results` | member_id, period, qualifying_units, qualifying_orders, eligible_profit, reward_amount, status, calculated_at |
| `marketing_spend` | source/campaign, amount, date, owner, note; theo dõi ads không nhập chung lãi gộp |
| `audit_logs` | actor_id, action, entity_type/id, before_json, after_json, ip_hash?, created_at, reason |
| `system_settings` | name, value_json, updated_at; chỉ admin ghi |

**Cân nhắc đơn giản hóa ở MVP:** vẫn giữ được ledger, nhưng có thể gộp `promotion_rules` với `promotions` dạng cấu hình kiểm soát tốt nếu chỉ vài rule. Không gộp `inventory_ledger` vào một trường quantity đơn lẻ.

### 4.3. Derived data / materialized views

- `stock_on_hand` = SUM(ledger qty_delta) theo sản phẩm/lô.
- `stock_reserved` = SUM(reservations đang active).
- `stock_available` = `on_hand - reserved - damaged/quarantined` (nếu hàng hỏng đã xuất kho bằng ledger thì **không trừ lần hai**).
- `stock_expiring` theo `expiry_date` và tồn còn lại.
- `sales_summary_daily`, `member_sales_monthly` có thể làm view trước, cache/aggregate sau khi cần.
- Không lưu `stock_available` như nguồn sự thật độc lập nếu thiếu cơ chế transaction đồng bộ.

### 4.4. Index đề xuất

`orders(owner_member_id, placed_at DESC)`, `orders(status, placed_at DESC)`, `orders(customer_id, fulfilled_at)`, `inventory_batches(product_id, expiry_date, received_at)`, `inventory_reservations(batch_id, status)`, `inventory_ledger(batch_id, created_at)`, `commission_records(member_id, eligible_at, status)`, `promotions(status, starts_at, ends_at)`, unique `order_code`, unique `idempotency_key` theo operation.

### 4.5. Supabase RLS

- Enable RLS trên **mọi bảng chứa dữ liệu business**; `profiles` không tin role do client tự cung cấp.
- Public chỉ có thể đọc **view/DTO white-list** như product, giá công khai và chương trình đang hiệu lực; không đọc `inventory_batches`, `orders`, `customers`, `unit_cost`.
- Member read/write các đơn được phân công theo chính sách; cập nhật `fulfilled/payment/approved` cần server validate thêm.
- Dùng `SECURITY DEFINER` SQL functions chỉ khi cần nghiệp vụ nguyên tử, `SET search_path` an toàn, explicit authorization, least privilege; test kỹ trước khi phát hành.
- Không expose service role key dưới `NEXT_PUBLIC_*` hoặc trong client bundle/log.

---

## 5. NGHIỆP VỤ SẢN PHẨM VÀ NỘI DUNG

### 5.1. Seed data ban đầu

| SKU canonical | Tên | Khối lượng tịnh baseline | Giá bán | Giá vốn lịch sử khởi điểm |
|---|---|---:|---:|---:|
| CBST-300 | Hũ nhỏ | 300g | 109.000đ | 65.000đ |
| CBST-400 | Hũ vừa | 400g | 139.000đ | 95.000đ |
| CBST-600 | Hũ lớn | 600g | 199.000đ | 140.000đ |

Khối lượng trên là baseline đã chốt cho implementation; ảnh nhãn của từng SKU là evidence gate trước go-live. Seed production chỉ được tạo sau kiểm kê vật lý; con số 28 hũ chỉ được dùng làm test fixture ở local/staging cho đến khi có biên bản tồn đầu kỳ.

### 5.2. Tính năng quản lý sản phẩm

- CRUD tên, SKU, slug, ảnh, SEO title/meta, mô tả, giá, status (`draft/active/hidden/discontinued`).
- Thay ảnh qua UI: giới hạn file type, kích thước, xử lý tối ưu, preview, alt text, path an toàn.
- Không thay giá vốn của **lô cũ** khi nhập lô mới giá khác.
- Không ghi đè giá lịch sử: tạo effective price mới, giữ lịch sử và log người sửa.
- Trạng thái sản phẩm hết hàng: hiển thị **Hết hàng/Tạm hết** thay nút đặt mua nếu muốn; Zalo vẫn có thể là nút hỏi thông tin.
- Nội dung hướng dẫn bảo quản/hạn dùng lấy từ thông tin **đã xác minh trên nhãn**; nếu chưa có thì chỉ công bố 'xem nhãn lô thực tế và hỏi shop'.

---

## 6. KHO HÀNG — NGUỒN SỰ THẬT QUAN TRỌNG NHẤT

### 6.1. Đơn vị quản lý

Đơn vị tồn kho = **hũ**; 3 sản phẩm có đơn vị hũ; kho trung tâm duy nhất. Mỗi lần nhập phải xác định số lượng, chi phí mua, chi phí vận chuyển đầu vào, mã lô và NSX/HSD (nếu nhãn cung cấp).

### 6.2. FIFO hay FEFO

- Nền tảng FIFO (nhập trước xuất trước) theo nguyên tắc kinh doanh hiện tại.
- **Nếu các lô có hạn sử dụng khác nhau**, đề xuất **FEFO** (hết hạn sớm xuất trước), không xuất hàng đã hết hạn; nếu không có HSD đáng tin cậy phải đánh dấu **CẦN KIỂM TRA**.
- Cho Admin override chọn lô với lý do bắt buộc và audit log.

### 6.3. Trạng thái kho và biến động

`RECEIVE`, `RESERVE`, `RELEASE`, `FULFILL`, `RETURN_RESTOCK`, `RETURN_QUARANTINE`, `DAMAGE`, `ADJUST`, `EXPIRE`.

**Lưu ý:** `RESERVE` là giữ chỗ, **không** ghi ledger xuất kho; `FULFILL` mới ghi xuất kho. Nếu muốn trừ kho lúc xác nhận đơn, phải chọn nhất quán mô hình khác, không làm cả hai.

### 6.4. Transaction tránh oversell

Trong **một** PostgreSQL transaction / RPC:

1. Xác thực actor, quyền tạo/xác nhận đơn.
2. Khoá dòng lô liên quan (`FOR UPDATE`) hoặc thực hiện update có điều kiện an toàn.
3. Tính `available` trong transaction và chọn lô khả dụng theo FEFO/FIFO.
4. Kiểm tra hàng chưa hết hạn, số hũ đủ, tránh giữ hàng vượt tồn.
5. Insert order/order items + reservation + audit + idempotency cùng transaction.
6. Commit hoặc rollback tất cả. Không gửi thông báo chốt thành công trước commit.

Hai request đồng thời mua hũ cuối: **chỉ một request được giữ hàng**, request còn lại nhận lỗi hợp lệ `OUT_OF_STOCK` và UI hướng dẫn chọn số lượng khác.

### 6.5. Huỷ, hoàn và trả hàng

- Huỷ trước giao: release reservation; không ghi xuất kho; không commission.
- Giao thành công: ghi xuất ledger đúng lô, tiêu thụ reservation.
- Hoàn sau giao: kiểm tra thực trạng hàng; nếu đạt tiêu chuẩn nhập lại thì `RETURN_RESTOCK`, nếu không thì `RETURN_QUARANTINE`/loại bỏ; không mặc định đưa thực phẩm trả lại vào kho bán.
- Hoàn tiền tạo payment refund và reversal commission; nếu hoa hồng đã payout thì ghi khoản điều chỉnh kỳ tiếp theo, không sửa lịch sử payout.
- Bất kỳ điều chỉnh kho nào cũng có lý do, actor, thời điểm, số trước/sau và giới hạn quyền.

### 6.6. Cảnh báo kho

- Hết hàng (`available = 0`), tồn thấp (mức gợi ý: nhỏ ≤ 3, vừa ≤ 2, lớn ≤ 1; **chỉ là default**, sửa được trong Dashboard).
- Hàng sắp hết hạn: cảnh báo 30/14/7 ngày theo cấu hình; không khẳng định bất kỳ hũ nào an toàn sử dụng chỉ từ công thức.
- Lô thiếu dữ liệu NSX/HSD: cảnh báo cần xử lý thủ công, có thể khóa bán.
- Tồn âm: ngăn ở DB, báo lỗi có cấu trúc.

---

## 7. QUY TRÌNH ĐƠN HÀNG TỪ ZALO ĐẾN ĐỐI SOÁT

### 7.1. State machine đơn

```text
DRAFT -> PENDING_CONFIRMATION -> CONFIRMED/RESERVED -> PREPARING
                                                   -> SHIPPING -> DELIVERED
DRAFT/PENDING_CONFIRMATION/CONFIRMED -> CANCELLED
SHIPPING/DELIVERED -> RETURN_REQUESTED -> RETURNED / PARTIALLY_RETURNED
```

Tách `order_status` khỏi `payment_status`: `UNPAID`, `PARTIALLY_PAID`, `PAID`, `PARTIALLY_REFUNDED`, `REFUNDED`. Không suy luận đã thu tiền từ trạng thái giao hàng.

### 7.2. Form tạo đơn (mobile-first)

- Người phụ trách (auto = người đăng nhập, Admin có thể đổi).
- Khách: tên/điện thoại, khu vực, địa chỉ giao, ghi chú; gợi ý khách trùng bằng số điện thoại chuẩn hoá.
- Nguồn khách: Facebook Group (tên group), Fanpage, Zalo, giới thiệu, trực tiếp, khác; có mã campaign/UTM nếu biết.
- Chọn sản phẩm + số lượng; giá niêm yết được server trả về.
- Khuyến mãi chỉ chọn từ campaign hợp lệ; thành viên không tự ý đặt discount.
- Ship khách trả, ship shop trả, phí trực tiếp khác **là các trường riêng**.
- Tổng khách phải trả, lợi nhuận ước tính, người giao, ghi chú.
- Nút `Lưu nháp`, `Xác nhận và giữ hàng`; hiển thị rõ thay đổi trạng thái.

### 7.3. Server luôn tính lại

Frontend chỉ gửi product ID, quantity, promo ID, các phí có quyền nhập và thông tin khách. Server đọc giá đang hiệu lực, kiểm tra promo, tính tiền, xác minh giữ kho. Không tin `total`, `unit_price`, `owner_share` gửi từ client.

### 7.4. Định nghĩa tài chính chuẩn

Cần phân biệt:

- **Tiền hàng sau giảm:** `SUM(qty × đơn giá niêm yết tại lúc chốt) − giảm giá hợp lệ`.
- **Tổng khách phải thanh toán:** `tiền hàng sau giảm + phí ship thu khách + phụ thu hợp lệ`.
- **Doanh thu đã thu:** từ giao dịch thu tiền thành công, không chỉ từ đơn tạo.
- **Giá vốn hàng bán (COGS):** `SUM(qty × unit_cost của lô thực xuất)`; snapshot sau khi xuất hàng; trước đó là ước tính.
- **Chi phí trực tiếp:** `ship shop thực trả + bao bì + phí thanh toán + chi phí trực tiếp đơn khác`, sau khi trừ phần ship khách đã trả nếu xử lý shipping như dòng thu/chi; tránh trừ ship 2 lần.
- **Lợi nhuận đơn để chia** = `tổng tiền thực thu từ khách − giá vốn của hàng đã giao − chi phí trực tiếp thực tế − các khoản hoàn/giảm bổ sung`; không cộng lại voucher nếu đã giảm trong số tiền thu.
- **Commission member** = `40% × MAX(0, lợi nhuận đơn đủ điều kiện)` theo chính sách mặc định V1.
- **Phần chủ sở hữu** = `60% × MAX(0, lợi nhuận đơn đủ điều kiện)`.
- Nếu đơn lỗ: ghi nhận lỗ thật; **không tự động biến lợi nhuận kinh doanh thành 0** — `MAX` chỉ áp dụng trên khoản được chia, lỗ chịu theo chính sách do Admin phê duyệt.
- **Lợi nhuận kinh doanh sau cùng** = Tổng lợi nhuận đơn trước chia − commission đã/ phải trả − ads phân bổ − KPI thưởng − chi phí chung − hỏng/hao hụt ngoài đơn (khi phát sinh). Không cộng phần 60% thành 'lợi nhuận mới' thêm một lần.

**Ví dụ hũ lớn:** 199.000 − 140.000 vốn − 15.000 ship shop chịu = **44.000đ** lợi nhuận để chia; chủ **26.400đ**, thành viên **17.600đ**. Chưa gồm ads, KPI và chi phí ngoài đơn.

### 7.5. Snapshot và chính sách

- `order_items` lưu giá/giảm/chính sách tại lúc confirm; đơn quá khứ không biến đổi khi bảng giá mới được tạo.
- Chốt COGS từ lô thực xuất để không giả định mọi lô giá giống nhau.
- Những điều chỉnh hậu giao tạo bản ghi delta/reconciliation thay vì xoá dữ liệu đã chốt.
- Làm tròn tiền VND ở cấp **đơn**, quy tắc phần lẻ xác định trước; ví dụ owner = total distributable − member share để bảo toàn tổng.
- Lưu policy version (`60/40`) trên commission record; thay chính sách chỉ có hiệu lực đơn tương lai trừ khi có quy định duyệt điều chỉnh.

### 7.6. Điều kiện đủ trả commission [CẦN CHỐT]

**Default đề xuất:** đơn `DELIVERED` **và** thanh toán `PAID` **và** chi phí thực đã được đối soát **và** không có yêu cầu hoàn đang mở. Commission ở trạng thái `ESTIMATED` → `ELIGIBLE` → `APPROVED` → `PAID`, có `ADJUSTED/REVERSED` khi hoàn tiền.

---

## 8. PROMOTIONS / CAMPAIGN ENGINE — KHÔNG SỬA CODE MỖI LẦN CHẠY

### 8.1. V1 cho 4 dạng

1. Giảm **số tiền cố định** trên sản phẩm/đơn.
2. Giảm **phần trăm** có `max_discount_amount`.
3. Combo chọn 2+ hũ với giá gộp được Admin duyệt.
4. Hỗ trợ một phần/freeship theo vùng và giá trị đơn (**là chi phí thực**, không tự bỏ qua khi tính lãi).

### 8.2. Thuộc tính phải có

Tên, mã campaign, đối tượng SKU, kênh, ngày giờ bắt đầu/kết thúc Asia/Ho_Chi_Minh nhưng lưu UTC, giới hạn lượt, mỗi khách, ngân sách giảm tối đa, trạng thái `DRAFT/SCHEDULED/ACTIVE/PAUSED/EXPIRED`, quyền duyệt, chính sách cộng dồn.

### 8.3. Rule evaluation (server)

- Chỉ duyệt promotion active **tại thời điểm chốt**, đúng SKU, min spend/qty, quota/budget còn.
- Một đơn không được áp voucher hai lần; redemptions idempotent.
- Tại transaction chốt đơn: kiểm tra/giữ quota promo + giữ kho để tránh oversubscribe.
- Không cho giảm quá giá trị hàng; mức tối đa giảm phải cấu hình; nếu projected distributable profit < 0 thì báo đỏ và **yêu cầu Admin override**, không để member tự phê duyệt.
- Với chương trình hết hạn theo giờ: cache sản phẩm có thể dài, nhưng **giá promo phải có TTL đến mốc thời gian hoặc dùng server authoritative**; invalidate khi admin đổi, không chỉ invalidate khi tạo.
- Khi campaign pause/hết hạn, đơn đã confirm vẫn giữ giảm cũ; đơn mới không dùng được.

### 8.4. Báo cáo campaign

Lượt xem/click Zalo có UTM, số inbox tự ghi hoặc nhập tay, đơn phát sinh, số hũ, doanh thu thực thu, tổng discount, ads spend, gross profit, commission, lợi nhuận sau ads/KPI, CAC/cost per order khi đủ dữ liệu. Không suy diễn **click Zalo = đơn mua**.

---

## 9. KPI TEAM — THIẾT KẾ ĐỦ CÔNG BẰNG VÀ KHÔNG DẪN ĐẾN PHÁ GIÁ

### 9.1. Nguyên tắc

- Commission **theo từng đơn**; KPI **theo tháng** là khoản thưởng riêng nếu được duyệt.
- Chỉ tính hiệu quả thực của đơn hoàn tất/đã thu tiền và sau trừ hoàn huỷ; hạn chế thưởng ảo.
- Không lấy **doanh thu thuần** làm KPI duy nhất vì có thể khuyến khích discount/ship lỗ.
- Minh bạch định nghĩa attribution, một đơn có **một owner nhận 40%** mặc định. Case nhiều người cùng làm cần quy tắc trước, không tự chia ngầm.
- Thành viên xem tiến độ riêng; Admin xem tổng.

### 9.2. Bộ KPI đề xuất

| KPI | Cách tính | Hiển thị | Ghi chú |
|---|---|---|---|
| Hũ đủ điều kiện | Tổng qty hàng đã giao, thanh toán đủ, không hoàn | Member/Admin | Gốc cho 10/20/30/50 |
| Đơn hoàn tất | COUNT order đủ điều kiện | Member/Admin | Chống count đơn hủy |
| Doanh thu thực thu | Thu tiền thực tế trừ refund | Member/Admin | Không nhầm giá niêm yết |
| Lợi nhuận tạo ra trước chia | SUM(distributable_profit) | Member/Admin theo quyền | Ưu tiên chất lượng đơn |
| Commission được duyệt | SUM(member_amount approved) | Member/Admin | Không phải tiền đã trả |
| Commission đã trả | SUM(payouts settled) | Member/Admin | Tách công nợ |
| Khách mới | Số khách lần đầu có đơn đủ điều kiện | Member/Admin | Dedupe khách |
| Khách mua lại | Khách có ≥2 đơn đủ điều kiện ở các thời điểm khác nhau | Member/Admin | Theo attribution rõ |
| Tỷ lệ chốt | Đơn đủ điều kiện / lead hợp lệ được ghi nhận | Member/Admin | Chỉ tin khi team ghi lead nhất quán |
| Tỷ lệ huỷ/hoàn | Đơn huỷ, hoàn / tổng đơn tạo trong kỳ | Member/Admin | Cảnh báo hành vi bất thường |
| Phí ship shop chịu bình quân | SUM(ship net shop) / đơn đủ điều kiện | Member/Admin | Theo dõi hiệu quả giao |
| Số feedback tích cực | Đánh giá hợp lệ sau mua | Member/Admin | Không ép người bán tạo review giả |

### 9.3. Chu kỳ, điều kiện và khóa KPI

- Kỳ theo **tháng lịch VN**; timestamp UTC, query theo ngày VN.
- Kỳ `OPEN` (tự cập nhật) → `REVIEW` (Admin đối soát) → `LOCKED` (không sửa tự do) → `PAID`.
- Nếu hoàn hàng sau khi kỳ lock, ghi **điều chỉnh kỳ sau**, không xóa dữ liệu lịch sử.
- Mốc **10/20/30/50 hũ** nên có trạng thái milestone, **chưa điền tiền thưởng** trước khi có dữ liệu lợi nhuận thật.
- Đặt **trần quỹ KPI** trên lợi nhuận thực đã trừ commission, ads, chi phí khác. Ví dụ chính sách ban đầu có thể là không chi KPI nếu kỳ không có tiền lãi sau chi phí; tỷ lệ ngân sách cần Admin quyết định.

### 9.4. Kịch bản attribution cần chốt

1. Một người marketing, một người chốt/giao: ai nhận 40%? Default MVP: chỉ một `order_owner`; người hỗ trợ ghi `contributors` để review, chưa tự chia nhiều người.
2. Khách quay lại do nhân viên B nhưng khách gốc của A: default người trực tiếp phụ trách đơn quay lại nhận 40%, không có hoa hồng vĩnh viễn cho người tìm khách đầu tiên.
3. Admin tự bán: vẫn ghi owner=Admin; doanh thu, lợi nhuận phản ánh đầy đủ; không tạo commission member 40% giả. Có thể tách `owner_operating_share` khỏi commission trả bên ngoài.
4. Đơn giá âm hoặc lỗ: không thưởng theo số hũ nếu phát sinh lỗ do sai chính sách; cảnh báo và duyệt.
5. Quá hạn thanh toán: chưa đủ điều kiện commission/KPI tài chính dù hàng đã giao.

### 9.5. Dashboard thành viên mẫu

- **Hôm nay:** đơn đang xử lý, hũ đã giao, việc cần làm.
- **Tháng này:** hũ đủ điều kiện / mốc kế tiếp; đơn hoàn tất; tiền hàng đã thu; lợi nhuận tạo ra; commission dự kiến / đủ điều kiện / đã nhận.
- **Tỷ lệ chốt và khách mua lại:** chỉ hiện nếu dữ liệu lead/customer đủ.
- **Lịch sử thay đổi:** vì sao đơn A bị điều chỉnh commission, kèm chứng từ nếu có.
- **Không có bảng xếp hạng công khai bắt buộc** trong V1; tránh tạo áp lực phá giá hoặc tranh khách.

---

## 10. UX/UI THỰC TẾ CHO NHÓM NHỎ

### 10.1. Website khách (Mobile First)

- Giữ visual style A: nền sáng, logo chữ, ảnh thật, nút Zalo rõ ràng.
- Header nhẹ, sticky vừa phải, không che nội dung; tránh ảnh/animation nặng.
- Above-the-fold có thông điệp, ảnh sản phẩm, CTA chính trong màn hình điện thoại.
- Giá và quy cách chính xác; thông báo ship chưa gồm nếu đúng; CTA nhắn Zalo cạnh từng hũ.
- Zalo deep link có fallback và nút copy tin nhắn; đo clicks không chứa SĐT khách trong URL query analytics.
- Ảnh có kích thước tường minh để tránh CLS; phóng to ảnh mượt; hỗ trợ vuốt và bàn phím.
- Không bật modal quảng cáo ngay khi mở trang; khuyến mãi hiện tiết chế.
- Loading/error/empty states rõ ràng; lỗi kết nối không làm biến mất toàn bộ sản phẩm công khai nếu cache còn phù hợp.
- Accessibility: contrast, font ≥ 16px input, hit target đủ lớn, aria-label, focus states, keyboard navigation, alt ảnh, reduced motion.

### 10.2. Admin trên điện thoại

- Sidebar desktop, bottom navigation hoặc drawer mobile: **Tổng quan / Đơn / Kho / KPI / Thêm**.
- Form đơn chia 3 bước: Khách → Hàng & giá → Ship & xác nhận, với sticky summary và không mất dữ liệu khi chuyển bước.
- Dropdown danh mục/nguồn khách/nhân viên; tìm khách theo số điện thoại; preset ship; tự điền date.
- Confirm dialog cho thao tác huỷ đơn, trả kho, thay giá, payout; toast kết quả và mã đơn.
- Skeleton cho đọc dữ liệu; disable nút khi submit; tránh double click bằng idempotency.
- Nếu ghi thất bại, hiển thị lỗi có thể hiểu và giữ dữ liệu form; **không dùng optimistic success** cho tồn kho/thanh toán.
- Table responsive chuyển card/list; filter đơn theo owner/trạng thái/date, search, pagination.
- Tình trạng mất mạng: banner offline, không giả vờ lưu thành công; cân nhắc lưu nháp cục bộ **không chứa PII nhạy cảm** nếu triển khai sau.

### 10.3. UI component checklist

`AppShell`, `MobileNav`, `RoleGuard`, `DataTable`, `EmptyState`, `ErrorState`, `Skeleton`, `OrderWizard`, `CustomerSelector`, `ProductPicker`, `PriceBreakdown`, `StockBadge`, `BatchSelector`, `PromotionEditor`, `KpiProgress`, `AuditTimeline`, `ConfirmDangerDialog`, `AccessibleToast`, `DateRangePicker`, `ExportButton`.

---

## 11. PERFORMANCE — CHIẾN LƯỢC CỤ THỂ

### 11.1. Định nghĩa KPI performance (đo ở p75 người dùng thật)

| Metric | Mục tiêu | Phạm vi |
|---|---|---|
| LCP | ≤ 2.5s | Mobile public |
| INP | ≤ 200ms | Mobile public |
| CLS | ≤ 0.1 | Public/Admin |
| Lighthouse Performance | Phấn đấu ≥ 90 (lab, không thay RUM) | Public |
| Admin initial usable | Mục tiêu nội bộ ≤ 3s với mạng kiểm thử định nghĩa rõ | Sau auth |
| Tạo đơn/giữ kho | p95 API ≤ 1.5s **khi hệ thống bình thường**, phải đo | Internal |
| Tỷ lệ lỗi | < 1% với request hợp lệ trong điều kiện chuẩn | App |

Các con số admin/API là **mục tiêu đề xuất cần hiệu chỉnh theo baseline**, không phải SLA được chứng minh.

### 11.2. Public rendering/cache

- Render public bằng Server Components; dùng build-time prerender/cached HTML khi thích hợp.
- Cache dữ liệu công khai sản phẩm/giới thiệu, **không cache dữ liệu user/session**.
- Nếu Next.js hỗ trợ Cache Components và đang sử dụng: cân nhắc `use cache` + `cacheLife` + `cacheTag`; `updateTag` trong Server Action để người vừa sửa đọc mới ngay, `revalidateTag` cho cơ chế làm mới thích hợp khi mutate từ route ngoài. **API thay đổi theo phiên bản**, đọc docs đúng version trước implement.
- Không giả định `revalidateTag(..., 'max')` là cập nhật tức thì cho mọi khách: đó là stale-while-revalidate. Với giá đang thay đổi hoặc promo bắt đầu/kết thúc đúng giờ, dùng **cache TTL chặt hơn/chiến lược atomic publication** và server validate lúc chốt.
- Phương án đơn giản nhất nếu chỉ ba sản phẩm: TTL ngắn 30–60 giây cho giá công khai và invalidation khi Admin sửa; content/ảnh TTL dài. Đánh đổi sự trễ hiển thị tối đa cần chốt.
- Không fetch public content từ client trong `useEffect` nếu có thể render server; tránh spinner và waterfall ban đầu.

### 11.3. Images/fonts/JS

- Dùng ảnh thật tối ưu WebP/AVIF, đúng chiều hiển thị, `sizes` chính xác; ưu tiên một ảnh Hero, lazy load còn lại.
- Không preload mọi ảnh sản phẩm; không gửi ảnh gốc 5–10MB cho viewport mobile.
- Next/Image hoặc cơ chế CDN image optimization phù hợp; kiểm tra quota image transform.
- Font system hoặc `next/font`; hạn chế nhiều weight/subsets.
- Client boundary nhỏ nhất; tránh biến toàn bộ `page.tsx` thành `use client`.
- Bundle analyzer; dynamic import charts/editor nặng chỉ trên trang cần; table dùng pagination 20–50 records.
- Không tải thư viện biểu đồ vào website khách chỉ để hiển thị giá.

### 11.4. DB và location

- Chọn region Supabase gần region server đang thực thi; đo RTT thực từ Vercel tới DB. Không giả định chọn một region luôn nhanh nhất.
- Tránh N+1 queries; `select` trường cần thiết; phân trang server; index theo query plan `EXPLAIN ANALYZE`.
- Đặt giới hạn connection/pooling theo khuyến nghị của nhà cung cấp; serverless không mở connection không giới hạn.
- Cache dữ liệu dashboard không nhạy hoặc aggregate ngắn hạn nếu có tải; đơn/kho/quyền phải authoritative.
- Tối ưu report bằng view/materialized aggregate khi dữ liệu lớn; chưa cần từ V1.

### 11.5. Đo và quy trình kiểm soát hồi quy

- Lighthouse mobile ở cùng profile/mạng trước và sau merge; kiểm tra Web Vitals với dữ liệu thực khi có traffic.
- Chrome DevTools performance/network: HTML TTFB, LCP element, transfer images, JS long tasks, hydration, CLS shifts.
- Giới hạn performance budget CI gợi ý: không tăng JS public > 20% không lý do; hero image mục tiêu < 250KB trên mobile nếu chất lượng phù hợp; không để third-party nặng trong critical path.
- Kiểm tra 360, 390, 430, 768, 1024, 1440 px; Android tầm trung, Safari iOS nếu có.

---

## 12. SECURITY / CHỐNG DDoS / RATE LIMIT / ABUSE

### 12.1. Threat model

Rủi ro thực tế: bot spam login/analytics/lead, brute force tài khoản team, scraping, DDoS làm tăng chi phí/gián đoạn, thao tác lặp tạo hai đơn, member gọi API vượt quyền, SQL injection/XSS, CSRF, upload file độc hại, lộ service role key, lộ PII khách, thao tác nội bộ gian lận, thay giá và trừ kho cạnh tranh.

### 12.2. Defense in depth

**Lớp A — CDN/Platform (Vercel):**

- Bật/kiểm tra Vercel Firewall và DDoS mitigation sẵn có theo gói; theo dõi Firewall Analytics.
- Rule rate limiting cho đường dẫn có nguy cơ; bước đầu chế độ log/challenge hợp lý rồi tăng chặn dựa trên false-positive.
- Under attack: áp challenge/IP block có mục tiêu, xem Usage, log; đừng bật challenge toàn site dài hạn làm mất khách thật.
- Vercel WAF rate limiting và DDoS mitigation được tài liệu chính thức mô tả hỗ trợ trên các gói, **nhưng tính năng/quota thực tế phải kiểm tra trong dashboard và gói đang dùng**.

**Lớp B — ứng dụng:**

- Mọi mutation POST/server action có auth, authorization, schema validation (Zod), idempotency.
- Rate limit API/server action dùng **shared/distributed store hoặc managed WAF**; **không** dùng `Map` in-memory trong serverless để tưởng là giới hạn toàn hệ thống.
- Challenge/CAPTCHA sau ngưỡng bất thường cho login hoặc form public có thật; không đặt CAPTCHA lên nút Zalo bình thường.
- Ràng buộc body size, mime type, file size, pagination cap, timeouts, no dynamic SQL, safe errors.

**Lớp C — dữ liệu:**

- Auth + RLS; permission server side; DB constraints/transactions; khóa bí mật trong Vercel env private; least privilege.
- Không ghi token, full SĐT, địa chỉ vào logs/analytics; giới hạn retention.
- Backup, audit và alert.

### 12.3. Bảng rate limit khởi điểm [PHẢI ĐO/ĐIỀU CHỈNH]

| Endpoint/action | Gợi ý ban đầu | Key/đối tượng | Hành vi |
|---|---|---|---|
| `/login` / auth attempts | 5 lần / 10 phút | IP + tài khoản (ẩn danh định danh) | 429/challenge, tránh enumeration |
| Request reset password | 3 / giờ | IP + tài khoản | 429, response chung |
| Gửi event Zalo click nếu có | 30 / phút | IP/session | Drop event thừa, không chặn liên hệ |
| Admin tạo đơn | 20 / phút | authenticated user | 429/feedback; idempotency vẫn bắt buộc |
| Admin sửa tồn kho | 10 / phút | authenticated admin | 429 + audit |
| Admin upload ảnh | 10 / 10 phút | authenticated admin | 429 + quota file |
| Search khách/đơn | 60 / phút | authenticated user | 429 + debounce client |
| Public GET trang sản phẩm | **Không chặn cứng quá thấp** | WAF/traffic signals | CDN cache, challenge bot khi cần |

**Không coi đây là số tuyệt đối**: một IP mạng công ty/cafe/4G dùng chung nhiều người; không chỉ dựa vào IP; tránh chặn Googlebot và khách thật. `429 Too Many Requests` kèm `Retry-After` khi phù hợp. Đánh giá hành vi và false-positive sau khi có traffic.

### 12.4. Auth/API hardening checklist

- [ ] Không public signup; invite only.
- [ ] Admin MFA, session expiry/revoke, chính sách mật khẩu.
- [ ] Kiểm tra `user.id` và role **bên trong** mọi Server Action/Route Handler.
- [ ] Input validation + output DTO; reject unknown fields quan trọng.
- [ ] Không tin giá, kho, commission, role do client gửi.
- [ ] Không expose service role/env bí mật qua `NEXT_PUBLIC_*`.
- [ ] Server Actions **là endpoint gọi được**, không tin chỉ ẩn component là an toàn.
- [ ] Kiểm tra CORS/Origin/CSRF theo kiến trúc; không mở wildcard tùy tiện.
- [ ] Header an toàn: CSP phù hợp, `nosniff`, referrer policy; kiểm tra tương thích Zalo/image/font.
- [ ] Upload: max size, file type thực, path random, không chạy thực thi; admin only.
- [ ] Logging: request id, latency, status, actor pseudonym; redact PII.
- [ ] Dependency audit, secret scanning, branch protection.
- [ ] Test IDOR: member thay order ID không xem/sửa được đơn người khác.
- [ ] Không có mutation qua GET; không ghi trực tiếp DB từ browser bằng quyền admin.
- [ ] Các thao tác nhạy cảm có audit log và xác nhận.

### 12.5. Sự cố tấn công — runbook

1. Xác định tăng traffic, đường dẫn, user agents, source, error rate, function usage.
2. Kích hoạt challenge/rate limit có mục tiêu, bật attack mode tạm thời nếu nghiêm trọng.
3. Nếu lộ token: rotate secrets/revoke sessions ngay; không chỉ chặn IP.
4. Nếu spam tạo đơn: tạm khoá mutation endpoint, kiểm tra ledger/idempotency, đối soát trước mở lại.
5. Thông báo nhóm nội bộ, ghi incident timeline, rà soát rule, phục hồi và postmortem.
6. Không cam kết chống **100% DDoS**; đo khả năng chịu tải và giới hạn chi phí.

---

## 13. OBSERVABILITY, BACKUP, DATA PRIVACY

### 13.1. Dashboard vận hành và cảnh báo

- HTTP 5xx, auth failures, 429 surge, DB query slow, transaction conflicts, upload errors, cache invalidation errors.
- Tài chính: đơn lợi nhuận âm, shipping > margin, refund spike, chi phí chưa đối soát, payout pending lâu.
- Kho: tồn âm (phải không thể xảy ra), over-reservation, hàng gần HSD, lô thiếu HSD.
- Audit thay giá, sửa vốn, sửa hạn dùng, điều chỉnh kho, manual override khuyến mãi.

### 13.2. Backup/restore

- Supabase Free: chủ động export bằng Supabase CLI `db dump`/`pg_dump`, lưu **ngoài** chính project/database. Gói Free không nên giả định có lịch backup tự động được đảm bảo.
- Lịch mặc định khi chạy thật: backup logic **hằng ngày** hoặc sau batch quan trọng; xuất orders/inventory/payments/commissions ra CSV cuối tuần; giữ nhiều phiên bản theo chính sách.
- Mã hóa backup, hạn chế người được đọc, không push backup dữ liệu khách lên GitHub.
- Diễn tập restore lên **database staging riêng** ít nhất trước launch và định kỳ mỗi tháng.
- RPO/RTO đề xuất giai đoạn đầu: RPO mục tiêu ≤ 24h với backup ngày; RTO mục tiêu 4–8 giờ **chỉ khi đã thử restore**, chưa hứa trước.

### 13.3. Quyền riêng tư

- Chỉ thu dữ liệu cần giao hàng và chăm sóc khách; hiển thị thông báo mục đích sử dụng, giới hạn truy cập.
- Không tự động gửi marketing khách chưa đồng ý; có khả năng đánh dấu opt-out.
- Thiết lập retention, quy trình xử lý yêu cầu truy cập/xoá phù hợp luật áp dụng, lưu dữ liệu đơn bắt buộc theo yêu cầu pháp lý trước khi xóa PII.
- Xem xét yêu cầu hiện hành về dữ liệu cá nhân và bán hàng thực phẩm **trước go-live**, không coi tài liệu này là tư vấn pháp lý.

---

## 14. TESTING — CẦN CÓ TRƯỚC KHI TEAM DÙNG

### 14.1. Unit tests

- `calculateOrderTotals()`: nhiều item, promo cố định/%, free ship, rounding.
- `calculateProfit()`: ship khách thu/shop trả, refund, order loss, cost allocation.
- `calculateCommission()`: 60/40, 0 profit, negative profit, policy snapshot, payout adjustment.
- `calculateKPI()`: ngày VN, 10/20/30/50 hũ, đơn hoàn, khách mua lại, late refund.
- `validatePromotion()`: hết hạn, vượt lượt/budget, combo, stack rules.

### 14.2. Integration (Supabase staging DB)

- Concurrent reservation 2 requests, available=1 → đúng 1 success, 1 out of stock.
- Rollback atomic khi tạo order thất bại giữa chừng.
- Admin sửa giá → đơn cũ không đổi.
- Thanh toán chưa đủ → commission chưa eligible.
- Huỷ trước giao → release; hoàn sau giao → ledger + financial adjustment.
- Promo quota 1 → hai request cùng lúc chỉ một áp dụng.
- RLS/IDOR: Member A không đọc/update đơn/PII Member B.
- Payout double-click → chỉ 1 record nhờ idempotency.

### 14.3. E2E (Playwright)

1. Khách mở trang → xem giá/size chính xác → mở Zalo, mobile viewport.
2. Admin login → tạo sản phẩm/giá → thay đổi public sau khoảng trễ cache chấp nhận.
3. Member login → tạo đơn → reserve → shipping → delivered → paid → commission eligible.
4. Admin nhập lô mới → kiểm tồn → hàng near-expiry cảnh báo.
5. Admin tạo promo → test start/end, ngân sách → báo cáo.
6. Admin payout → Member thấy đã trả; thay giá sau payout không làm đổi record.
7. Logout/session expire → route admin và actions trả 401/redirect đúng.
8. Form lỗi/mạng chập chờn → không tạo 2 đơn và không mất dữ liệu chưa lưu.

### 14.4. Security/load tests

- OWASP Top 10 cơ bản, dependency audit, secret scan, kiểm thử role/access.
- k6/Artillery trên **staging và giới hạn tải an toàn**; không gây load flood vào production hoặc dịch vụ bên thứ ba.
- Profile: 5 thành viên đồng thời tạo/xem đơn + lượng khách công khai giả định; đo p95, error rate, DB saturation.
- Kiểm tra 429, Retry-After, WAF challenge đúng; đo false positives.
- Không coi bài stress test là bằng chứng chống mọi DDoS.

### 14.5. Checklist nghiệm thu mẫu

- [ ] Local/staging có test fixture 28 hũ; production chỉ ghi tồn đầu kỳ theo kiểm kê vật lý được owner duyệt.
- [ ] Không có dữ liệu mẫu/test trong production.
- [ ] Tất cả tính năng P0 chạy trên mobile.
- [ ] Không oversell sau test 100 lần concurrent với tồn 1.
- [ ] P&L/commission đối chiếu Excel bằng ≥ 20 case mẫu (bao gồm lỗ/hoàn).
- [ ] Khách xem thông tin đúng nhãn, HSD/bảo quản có nguồn.
- [ ] Backup và restore staging thành công.
- [ ] Đã test phân quyền server và RLS.
- [ ] Không có secrets xuất hiện ở browser/source maps public.
- [ ] Có rollback deploy/migration an toàn.

---

## 15. CI/CD, MÔI TRƯỜNG, DEPLOY VÀ ROLLBACK

### 15.1. Ba môi trường

- **Local:** Supabase local hoặc dự án dev riêng; dữ liệu giả.
- **Preview/Staging:** Vercel Preview + Supabase staging **không dùng DB prod**; test migrations, E2E.
- **Production:** Vercel đúng điều khoản thương mại + Supabase prod; chỉ secrets production.

### 15.2. Biến môi trường (tên tham khảo)

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...     # hoặc publishable key theo SDK
SUPABASE_SERVICE_ROLE_KEY=...         # server ONLY, nếu thực sự cần
NEXT_PUBLIC_SITE_URL=...
NEXT_PUBLIC_ZALO_PHONE=...
# RATE_LIMIT_REDIS_URL / RATE_LIMIT_TOKEN nếu dùng distributed store
# SENTRY_DSN, analytics keys nếu chọn tích hợp
```

- Dùng SDK/env đúng phiên bản đang cài; **không** commit `.env.local`.
- Phân vùng secret staging/prod; rotate khi thành viên rời dự án hoặc nghi ngờ leak.

### 15.3. Quy trình pull request

1. Feature branch, issue và acceptance criteria rõ.
2. Code + migration + unit test + authz test + cập nhật docs.
3. CI: lint, typecheck, unit, migration check, build, e2e quan trọng trên staging.
4. Preview review giao diện mobile, screenshot diff với landing page cũ.
5. Staging smoke test + backup.
6. Merge/deploy prod ngoài giờ cao điểm; kiểm logs 15–30 phút đầu.
7. Nếu lỗi: rollback frontend bằng deployment cũ; **DB migration phải backward compatible**. Không `DROP COLUMN` ngay khi frontend cũ còn dùng.

### 15.4. Migration strategy

- Migration versioned SQL, chạy một lần, có kiểm tra idempotency; không thao tác bảng prod bằng tay không log.
- Expand/contract: thêm cột mới → code tương thích hai version → backfill → chuyển đọc/ghi → bỏ cột cũ sau.
- Backup trước thay đổi schema quan trọng; test restore.

### 15.5. Domain và pháp lý hosting

- Landing page hiện deploy trên Vercel URL; không bắt buộc mua domain V1.
- Trước bán chính thức, giải quyết **điều kiện non-commercial của Vercel Hobby**: nâng cấp gói hoặc chuyển nền tảng hợp lệ.
- Nếu chuyển host sau này, tách infra dependencies/URL secrets để migrate dễ; performance phải benchmark, không đoán Cloudflare/Vercel nhanh hơn.

---

## 16. LỘ TRÌNH TRIỂN KHAI — WORK BREAKDOWN STRUCTURE

> **Ước lượng** là công sức tương đối để lên backlog, **không phải cam kết ngày hoàn thành**. Ưu tiên theo dependency, một dev có thể chia sprint 1–2 tuần tùy năng lực và thời gian.

| ID | Ưu tiên | Hạng mục | Deliverable | Phụ thuộc | Chấp nhận khi |
|---|---|---|---|---|---|
| F0.1 | P0 | Audit repo/site + performance baseline | AUDIT.md, screenshots, risks | Source | Liệt kê mọi chỗ hardcode giá/size |
| F0.2 | P0 | Xác minh nhãn sản phẩm | Product truth table | Nhà cung cấp | 3 hũ đúng khối lượng, bảo quản, HSD |
| F0.3 | P0 | ADR và business rules | ADR + DATA_DICTIONARY | F0.1 | Owner duyệt order/stock/commission rules |
| F1.1 | P0 | Supabase projects, migrations, seeds | Schema SQL | F0.3 | Local/staging/prod tách biệt |
| F1.2 | P0 | Auth + RBAC + RLS | Login, invite, policies | F1.1 | Member không xem đơn người khác |
| F1.3 | P0 | Admin shell/mobile UX | `/admin`, navigation | F1.2 | Responsive, loading/error states |
| F2.1 | P0 | Product CRUD + price versions | Admin products | F1.1–3 | Giá mới không sửa đơn cũ |
| F2.2 | P0 | Batch/ledger/reservation | Admin inventory + RPC | F1.1–3 | Không oversell trong concurrent test |
| F3.1 | P0 | Customer/source master | Select/search | F1.2 | Dedupe, access protected |
| F3.2 | P0 | Order wizard + state machine | Create/list/detail/edit | F2.1–2, F3.1 | Không double submit, trừ kho đúng |
| F3.3 | P0 | Payment, cost, financial snapshot | Payment/cost UI | F3.2 | Đối chiếu các case Excel |
| F3.4 | P0 | Commission 6/4 + payout ledger | Member/admin commissions | F3.3 | Refund reversal đúng |
| F4.1 | P0 | Dashboard cơ bản | Counters+filters | F3.4 | Metrics bám dữ liệu đã xác nhận |
| F4.2 | P0 | Backup/audit/monitoring | RUNBOOK + alerts | F1.1–F3 | Restore staging thành công |
| F5.1 | P1 | Promo rules + budget/quota | Promotion module | F3.2 | Promo concurrent đúng quota |
| F5.2 | P1 | KPI policies + reports | KPI team/month | F3.4 | Reconcile, lock kỳ, export |
| F5.3 | P1 | Public data integration/cache | Site lấy dữ liệu từ DB | F2.1, F5.1 | Website nhanh, giá đúng sau update |
| F5.4 | P1 | Zalo event & marketing attribution | Click tracking/UTM | F3.1 | Không nhầm click thành đơn |
| F6.1 | P1 | Rate limiting/WAF, kiểm thử bảo mật cơ bản | Rules + test logs | F1–F5 | 429, authz, false positive được test |
| F6.2 | P1 | Performance regression & load test | Before/after metrics | F5.3 | Core Web Vitals mục tiêu hoặc action plan |
| F6.3 | P1 | UAT, import dữ liệu thật, rollout | Checklist + SOP team | Tất cả P0 | Team thao tác đơn thật an toàn |

### 16.1. Gợi ý chia sprint

**Sprint 0 — Khảo sát và chốt nghiệp vụ:** Audit repo, nhãn sản phẩm, quy tắc giao hàng/đơn/commission/KPI, metrics baseline, quyết định hosting thương mại.

**Sprint 1 — Nền tảng an toàn:** Supabase schemas/migrations, auth, RBAC/RLS, admin shell, logging, staging.

**Sprint 2 — Sản phẩm và kho:** CRUD, ảnh, giá theo hiệu lực, batch, ledger, giữ tồn, test concurrent.

**Sprint 3 — Đơn hàng và tiền:** Khách, nguồn, order workflow, thanh toán, ship, chi phí, commission, payout; đối soát Excel.

**Sprint 4 — Khuyến mãi/KPI/public sync:** Promo, hiệu lực theo thời gian, KPI, dashboard, cached public products, Zalo tracking.

**Sprint 5 — Hardening/go-live:** WAF/rate limits, load/security/E2E, backup/restore, mobile UAT, vận hành song song với Excel, đưa vào sử dụng theo giai đoạn.

### 16.2. Triển khai an toàn theo từng bước

- **Bước A:** Giữ landing page hiện tại nguyên trạng; dev trên branch, staging Supabase riêng.
- **Bước B:** Team thử tạo đơn **giả**; không trừ kho thật, không payout.
- **Bước C:** Import tồn đầu kỳ đã kiểm đếm (số hũ thực, không mặc định đủ 28 nếu đã bán) + đơn cần quản lý; đối chiếu báo cáo.
- **Bước D:** Chạy 1–2 tuần song song Excel với hệ thống, đối soát hàng ngày; quy định một nơi là master khi bắt đầu cut-over để tránh nhập hai nơi bất nhất.
- **Bước E:** Khóa Excel ở chế độ tham chiếu sau khi pass nghiệm thu; vẫn xuất định kỳ.
- **Bước F:** Bật đồng bộ public giá/khuyến mãi sau khi cache và độ chính xác đã test; không chuyển tất cả cùng một lần.

---

### 16.3. Baseline P0a có thể triển khai

Để tránh P0 trở thành một đợt xây dựng quá rộng, baseline bắt đầu bằng **P0a vertical slice**:

1. Invite-only auth, hai role và RLS/IDOR tests.
2. Ba SKU, price versions, batch/landed cost, ledger và reservation.
3. Customer tối thiểu, order state machine, receipt/refund và direct costs.
4. Commission 60/40, approval/payout tháng, audit và CSV export.
5. Backup/restore staging và chạy song song Excel.

Promotion, KPI thưởng, marketing calendar, upload ảnh, offline/PWA, shipper API và analytics nâng cao thuộc P0b/P1; không chặn P0a. Contract chi tiết và acceptance IDs nằm trong `API_CONTRACTS.md` và `TRACEABILITY_MATRIX.md`.

---

## 17. BACKLOG TÍNH NĂNG DƯỚI GÓC NHÌN USER STORY

1. **Là khách**, tôi muốn xem chính xác giá/size/HSD theo lô để ra quyết định trước khi nhắn Zalo.
2. **Là khách**, tôi muốn nhấn Zalo một lần, không phải lập tài khoản.
3. **Là thành viên**, tôi muốn tạo đơn trong tối đa vài bước trên điện thoại mà không nhập lại giá vốn.
4. **Là thành viên**, tôi muốn biết còn mấy hũ khả dụng trước khi hứa giao cho khách.
5. **Là thành viên**, tôi muốn biết khoản hoa hồng *dự kiến*, *đã duyệt*, *đã trả* khác nhau thế nào.
6. **Là chủ shop**, tôi muốn tạo promotion, nhìn thấy ngay tác động lợi nhuận trước khi bật.
7. **Là chủ shop**, tôi muốn biết nguồn khách/size/người bán hiệu quả thật sau khi trừ chi phí.
8. **Là chủ shop**, tôi muốn đổi giá trên Dashboard mà không deploy source.
9. **Là chủ shop**, tôi muốn biết lý do từng lần sửa kho/sửa đơn để tránh tranh cãi.
10. **Là chủ shop**, tôi muốn có backup khôi phục được nếu vô tình xoá dữ liệu.
11. **Là người quản trị**, tôi muốn chặn bot spam mà khách thật vẫn vào web/Zalo thuận tiện.
12. **Là người nhận commission**, tôi muốn KPI được tính công khai theo luật rõ ràng, không đổi hồi tố tùy ý.

---

## 18. NHỮNG ĐIỀU KHÔNG NÊN LÀM Ở V1

- Không xây NestJS/Express backend thứ hai chỉ vì muốn 'full-stack chuyên nghiệp'.
- Không Redis/microservice/event bus nếu không có số liệu cần.
- Không dùng realtime subscriptions cho mọi bảng; poll/refresh sau mutation là đủ với team ít người.
- Không checkout/thanh toán online khi chỉ cần liên hệ Zalo và chốt tay.
- Không tích hợp shipper APIs khi chưa chứng minh cần thiết.
- Không tự động chia commission cho nhiều contributor trước khi có chính sách thống nhất.
- Không công bố hạn dùng 1 tháng ngoài tủ/3–4 tháng lạnh khi chưa xác minh nhãn và điều kiện.
- Không đưa số tiền KPI thưởng vào code trước khi chốt chính sách và budget.
- Không đặt mục tiêu '0ms, bảo mật tuyệt đối, chống DDoS 100%' như cam kết.

---

## 19. RỦI RO VÀ PHƯƠNG ÁN GIẢM THIỂU

| Rủi ro | Tác động | Giải pháp |
|---|---|---|
| Mất thời gian code hơn bán hàng | Trễ test 28 hũ | P0 timebox, cắt P2, vẫn bán qua Zalo song song |
| Site chậm do DB | Khách rời trang | Server Components, cache public, optimize assets, DB near app |
| Promo làm đơn lỗ | Mất biên lợi nhuận | Server preview net profit, admin approval, campaign budget cap |
| Race tồn kho | Oversell | Transaction + row lock/conditional updates + tests |
| Giá sửa làm đổi đơn cũ | Sai công nợ/commission | Snapshot/order ledger, immutable history |
| Member tự xem data người khác | Lộ dữ liệu khách/tiền | Authz DAL + RLS + IDOR tests |
| DDoS/bot | Tăng usage, gián đoạn | Vercel Firewall, rules, shared rate limits, observability |
| Free plan pause/backup gap | Mất truy cập/dữ liệu | Backup off-site, monitor, upgrade khi cần |
| Vercel Hobby dùng cho bán hàng | Vi phạm điều khoản | Chọn gói/host phù hợp trước vận hành thương mại |
| Dữ liệu sai HSD/khối lượng | Mất uy tín/rủi ro tuân thủ | Nhãn thật là nguồn chuẩn, duyệt nội dung trước publish |
| Hoa hồng mâu thuẫn | Team mất niềm tin | Policy version, attribution rõ, payout & audit |
| Team bỏ cập nhật đơn | Data đẹp nhưng sai | UI đơn giản, quy trình hằng ngày, audit và đối soát |

---

## 20. QUẢN LÝ QUYẾT ĐỊNH TRIỂN KHAI

Danh sách Q01–Q23 cũ đã được thay bằng `DOCS_DECISION_LOG.md` để tránh trùng ID và mâu thuẫn với Project Context. Baseline P0a dùng các quyết định `DEC-*`; developer không tự thay đổi bằng suy đoán.

1. Mỗi thay đổi business rule phải có một `DEC-*`, người duyệt, ngày và tài liệu bị tác động.
2. Nếu bằng chứng nhãn, kiểm kê hoặc điều khoản dịch vụ trái baseline, đặt decision liên quan về `BLOCKED`, dừng phần triển khai chịu ảnh hưởng và cập nhật đồng bộ schema/API/AC.
3. Các quyết định `OPEN-NONBLOCKING` không được làm rộng P0a; giữ default trong Decision Log cho tới khi owner đổi bằng văn bản.
4. Không dùng lại mã `Q01…Q23` trong tài liệu hoặc ticket mới.

### 20.1. Baseline đã biết, không hỏi lại

- Ba SKU `CBST-300/400/600`; giá bán 109/139/199k; giá nhập baseline 65/95/140k.
- Một kho chung; team không tự nhập làm đại lý; bảng giá chung và khuyến mãi cần Admin duyệt.
- Chia 60/40 sau khi trừ giá vốn và chi phí trực tiếp; không phát sinh commission dương nếu profit-share base không dương.
- Website V1 chuyển đổi qua Zalo, không checkout online.
- P0a ưu tiên Auth/RLS → sản phẩm/giá → lô/ledger/reservation → đơn/thanh toán/chi phí → commission/payout → audit/export/backup.

---

## 21. DEFINITION OF DONE VÀ CHECKLIST BÀN GIAO

**Feature Done** = có migration, UI, server authorization, validation, error states, audit (nếu nhạy), unit/integration test, doc, staging review, mobile test.

**Project handoff** gồm:

- [ ] Repository và README: setup local/env/build/test/deploy.
- [ ] Database migration + seed sản phẩm đã xác minh.
- [ ] ERD và Data Dictionary.
- [ ] RBAC/RLS matrix và test cases.
- [ ] Process diagram: tạo đơn, giữ kho, xuất kho, huỷ/hoàn, đối soát, payout.
- [ ] API/Server Actions contract + Zod schemas.
- [ ] Danh sách keys/env, backup/restore SOP.
- [ ] KPI policy sheet + ví dụ tính mẫu.
- [ ] Promo policy + margin approval rules.
- [ ] UX flows/screenshots desktop/mobile.
- [ ] Test evidence + baseline/performance after.
- [ ] Vercel/Supabase monitoring và WAF/rate limits cấu hình.
- [ ] UAT sign-off, rollback plan, owner SOP 1 trang.
- [ ] Import/export và dữ liệu đối soát Excel chính xác.

---

## 22. TÀI LIỆU THAM KHẢO KỸ THUẬT (KIỂM TRA 09/10/2026)

1. Website đang chạy: https://ca-bong-song-tra.vercel.app/
2. Next.js caching/revalidation: https://nextjs.org/docs/app/getting-started/revalidating
3. Next.js `cacheComponents`: https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents
4. Next.js `revalidateTag`: https://nextjs.org/docs/app/api-reference/functions/revalidateTag
5. Next.js `updateTag`: https://nextjs.org/docs/app/api-reference/functions/updateTag
6. Next.js authentication: https://nextjs.org/docs/app/guides/authentication
7. Next.js data security: https://nextjs.org/docs/app/guides/data-security
8. Vercel DDoS mitigation: https://vercel.com/docs/vercel-firewall/ddos-mitigation
9. Vercel WAF rate limiting: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting
10. Vercel Hobby plan: https://vercel.com/docs/plans/hobby
11. Supabase backup: https://supabase.com/docs/guides/platform/backups
12. Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security

**Chú ý:** Documentation và quota các dịch vụ có thể thay đổi. Khi code thực tế, pin phiên bản package và kiểm tra tài liệu đúng version/plan; không copy nguyên cấu hình cache, WAF từ một phiên bản khác.

---

## 23. CHỐT KHUYẾN NGHỊ

**Xây P0 ngay, nhưng không dừng bán hàng để xây một hệ thống quá lớn.** Giữ codebase Next.js đang chạy; thêm Supabase, đơn/kho/tiền trước, promo + KPI sau; tối ưu public bằng cache và ảnh; bảo mật Server Actions/RLS/rate limit ngay từ nền tảng. Khi P0 đã thực sự chạy và đối soát đúng, mới chuyển Excel từ sổ chính sang công cụ export/backup. Quyết định mở rộng phải đi theo dữ liệu thật: số hũ bán, tốc độ quay vòng, khách mua lại, P&L sau chi phí và hiệu quả team.
