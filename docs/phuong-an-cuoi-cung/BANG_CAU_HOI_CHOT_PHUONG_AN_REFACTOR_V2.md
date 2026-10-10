# BẢNG CÂU HỎI CHỐT PHƯƠNG ÁN REFACTOR & TÁI CẤU TRÚC TOÀN HỆ THỐNG

> **Dự án:** Cá Bống Sông Trà  
> **Trạng thái:** ĐÃ TRẢ LỜI — CÁC MỤC KỸ THUẬT MƠ HỒ ĐƯỢC CHỐT THEO PHƯƠNG ÁN TỐI ƯU  
> **Mục đích:** khóa toàn bộ quyết định cần thiết trước khi thay backend Google Sheets bằng NestJS + MongoDB, tái cấu trúc repository, di chuyển dữ liệu, loại bỏ code/tài liệu cũ và đưa hệ thống qua các gate staging/production.  
> **Tài liệu mục tiêu:** `SRS_CA_BONG_SONG_TRA_V2_0.md`

---

## 0. Cách trả lời

- Mỗi câu có mã cố định `Qxxx`.
- Chọn **một phương án**, trừ câu có ghi “chọn nhiều”.
- Trả lời nhanh theo mẫu:

```text
Q001=B
Q002=A
Q003=A,C
Q004=KHÁC: ...
```

- `⭐ Khuyến nghị` là phương án kỹ thuật đề xuất, **không được xem là đã duyệt**.
- Câu đánh dấu **🔴 BLOCKER** phải được trả lời trước khi bắt đầu nhánh refactor.
- Câu đánh dấu **🟠 TRƯỚC STAGING** có thể chốt trong giai đoạn foundation nhưng phải hoàn tất trước staging.
- Câu đánh dấu **🟡 TRƯỚC PRODUCTION** không chặn dựng code nhưng chặn go-live.

---

# PHẦN A — MỤC TIÊU, PHẠM VI VÀ CHIẾN LƯỢC CHUYỂN ĐỔI

### Q001 — 🔴 Mức độ thay đổi mong muốn

- [ ] A. Chỉ đổi Google Sheets sang MongoDB, giữ cấu trúc Next.js hiện tại
- [x] B. Refactor toàn bộ thành monorepo Next.js FE + NestJS BE + MongoDB
- [ ] C. Viết lại hoàn toàn từ đầu, không tái sử dụng code
- [ ] D. Khác

**⭐ Khuyến nghị:** B — tái cấu trúc toàn diện nhưng tái sử dụng có chọn lọc các phần đã kiểm chứng.

### Q002 — 🔴 Chiến lược triển khai

- [ ] A. Sửa trực tiếp trên nhánh hiện tại
- [ ] B. Dựng hệ thống V2 song song, nghiệm thu rồi cutover
- [x] C. Tắt hệ thống cũ, viết xong V2 mới mở lại
- [ ] D. Khác

**⭐ Khuyến nghị:** B.

### Q003 — 🔴 Baseline nghiệp vụ canonical

- [ ] A. Chỉ SRS V2.0 là nguồn chuẩn mới
- [x] B. SRS V2.0 + Decision Log V2 mới
- [ ] C. SRS V2.0 + tài liệu Google Sheets cũ cùng có hiệu lực
- [ ] D. Chưa quyết định

**⭐ Khuyến nghị:** B; mọi tài liệu cũ chỉ là nguồn migration/lịch sử.

### Q004 — Phạm vi release đầu tiên

- [x] A. Toàn bộ P0 + P1 trong một lần
- [ ] B. P0 lõi trước, P1 sau
- [ ] C. Chỉ storefront + đơn hàng
- [ ] D. Chỉ admin nội bộ

**⭐ Khuyến nghị:** B.

### Q005 — Mức downtime chấp nhận khi cutover

- [ ] A. Không downtime
- [ ] B. Tối đa 15 phút
- [ ] C. Tối đa 1 giờ
- [x] D. Tối đa 1 ngày
- [ ] E. Chưa xác định

**⭐ Khuyến nghị:** C cho quy mô hiện tại, kèm trang bảo trì và rollback.

### Q006 — Có tiếp tục phát triển tính năng trên backend Google Sheets trong lúc làm V2 không?

- [ ] A. Dừng feature mới, chỉ sửa lỗi critical
- [ ] B. Vẫn phát triển bình thường
- [x] C. Đóng băng hoàn toàn

**⭐ Khuyến nghị:** A.

### Q007 — Mức tương thích giao diện cũ

- [ ] A. Giữ gần như nguyên giao diện, chỉ đổi backend
- [ ] B. Giữ nhận diện và flow tốt, tái cấu trúc UI bên trong
- [x] C. Thiết kế lại toàn bộ UI/UX

**⭐ Khuyến nghị:** B.

### Q008 — Ngôn ngữ hệ thống

- [ ] A. Chỉ tiếng Việt
- [ ] B. Tiếng Việt trước, chuẩn bị kiến trúc i18n
- [x] C. Song ngữ Việt/Anh ngay V2

**⭐ Khuyến nghị:** B.

### Q009 — Ưu tiên thành công cao nhất

- [ ] A. Ra mắt nhanh
- [x] B. An toàn dữ liệu và tính đúng tiền/kho
- [ ] C. Giao diện đẹp
- [ ] D. Chi phí hạ tầng thấp nhất

**⭐ Khuyến nghị:** B.

### Q010 — Tiêu chí kết thúc refactor

- [ ] A. Build thành công
- [ ] B. Feature parity với hệ thống cũ
- [x] C. P0 pass test + migration đối soát + restore drill + owner UAT
- [ ] D. Deploy production là xong

**⭐ Khuyến nghị:** C.

---

# PHẦN B — GIỮ, VIẾT LẠI VÀ LOẠI BỎ CODE CŨ

### Q011 — 🔴 Chính sách xóa code cũ

- [ ] A. Xóa ngay khi tạo skeleton V2
- [x] B. Chỉ xóa sau khi dependency audit và flow thay thế đã pass
- [ ] C. Không xóa, giữ song song vô thời hạn

**⭐ Khuyến nghị:** B.

### Q012 — Storefront hiện tại

- [ ] A. Giữ và di chuyển vào `apps/web`
- [x] B. Viết lại hoàn toàn
- [ ] C. Bỏ storefront, chỉ dùng Zalo

**⭐ Khuyến nghị:** A, sau đó sửa nội dung và nối catalog API.

### Q013 — CSS/UI admin hiện tại

- [ ] A. Giữ toàn bộ
- [x] B. Giữ token/nhận diện và component hữu ích, bỏ CSS trùng/lỗi thời
- [ ] C. Bỏ toàn bộ, dùng UI library mới

**⭐ Khuyến nghị:** B.

### Q014 — Pure domain helpers đã có test (`lib/p0a/domain.ts`)

- [ ] A. Giữ nguyên vị trí
- [ ] B. Chuyển vào package domain/contracts và bổ sung test
- [x] C. Viết lại không tái sử dụng

**⭐ Khuyến nghị:** B.

### Q015 — Test hiện tại

- [ ] A. Xóa toàn bộ
- [x] B. Giữ test đúng nghiệp vụ, sửa import và bổ sung integration/E2E
- [ ] C. Giữ nguyên không chỉnh

**⭐ Khuyến nghị:** B.

### Q016 — Hình ảnh và nội dung public hiện tại

- [ ] A. Giữ tất cả
- [x] B. Chỉ giữ asset đã được owner xác minh quyền sử dụng/nội dung
- [ ] C. Xóa toàn bộ

**⭐ Khuyến nghị:** B.

### Q017 — Module Google Sheets runtime

- [ ] A. Xóa ngay
- [x] B. Di chuyển thành migration adapter tạm thời; xóa sau cutover và đối soát
- [ ] C. Giữ làm backend dự phòng ghi hai chiều

**⭐ Khuyến nghị:** B; không ghi hai chiều.

### Q018 — Module Supabase cũ

- [ ] A. Khôi phục để tham khảo runtime
- [ ] B. Giữ tài liệu trong archive, loại khỏi runtime/build
- [x] C. Xóa vĩnh viễn ngay

**⭐ Khuyến nghị:** B cho đến khi V2 production ổn định.

### Q019 — Thư mục tài liệu/export ngoài source như `Khởi Nghiệp Bằng Cá Bống/`

- [ ] A. Giữ trong repository và cho ESLint quét
- [x] B. Chuyển ra `docs/archive/assets/` và exclude khỏi lint/build
- [ ] C. Xóa ngay

**⭐ Khuyến nghị:** B sau khi kiểm tra nội dung/nguồn gốc.

### Q020 — Tài liệu cũ

- [ ] A. Xóa hết
- [x] B. Chuyển `docs/archive/google-sheets` và `docs/archive/supabase`, gắn nhãn `SUPERSEDED`
- [ ] C. Để nguyên cạnh tài liệu V2

**⭐ Khuyến nghị:** B.

### Q021 — Git history

- [x] A. Giữ nguyên lịch sử trong repository hiện tại
- [ ] B. Tạo repository mới cho V2
- [ ] C. Squash toàn bộ thành một commit

**⭐ Khuyến nghị:** A, dùng nhánh/refactor commits có checkpoint.

### Q022 — Code chưa commit hiện tại

- [ ] A. Dùng trực tiếp làm baseline
- [ ] B. Review, phân loại, commit/tag snapshot riêng trước refactor
- [x] C. Bỏ toàn bộ thay đổi

**⭐ Khuyến nghị:** B; không được tự bỏ thay đổi chưa xác minh.

---

# PHẦN C — KIẾN TRÚC REPOSITORY VÀ CÔNG NGHỆ

### Q023 — 🔴 Cấu trúc repository

- [ ] A. Một Next.js app duy nhất
- [x] B. Monorepo `apps/web`, `apps/api`, `packages/contracts`, `packages/config`
- [ ] C. Hai repository FE/BE độc lập

**⭐ Khuyến nghị:** B.

### Q024 — Package manager

- [ ] A. npm workspaces
- [x] B. pnpm workspaces
- [ ] C. Yarn

**⭐ Khuyến nghị:** B theo SRS; chốt lockfile duy nhất.

### Q025 — Backend framework

- [ ] A. Next.js Route Handlers
- [x] B. NestJS modular monolith
- [ ] C. Express thuần
- [ ] D. Khác

**⭐ Khuyến nghị:** B.

### Q026 — Database production

- [x] A. MongoDB Atlas
- [ ] B. PostgreSQL/Supabase
- [ ] C. Google Sheets
- [ ] D. Khác

**⭐ Khuyến nghị:** A theo SRS V2.

### Q027 — ODM/database access

- [x] A. Mongoose
- [ ] B. MongoDB native driver
- [ ] C. Prisma MongoDB

**⭐ Khuyến nghị:** A để khớp SRS và NestJS ecosystem.

### Q028 — Validation backend

- [x] A. `class-validator` + `ValidationPipe`
- [ ] B. Zod
- [ ] C. Dùng cả hai tùy module

**⭐ Khuyến nghị:** A hoặc B đều được, nhưng chỉ chọn một convention chính. Đề xuất A ở NestJS, generate contract qua OpenAPI.

### Q029 — Hợp đồng FE/BE

- [ ] A. Viết type thủ công hai bên
- [x] B. OpenAPI là canonical, generate typed client
- [ ] C. Chia sẻ trực tiếp DTO backend sang frontend

**⭐ Khuyến nghị:** B.

### Q030 — API style

- [x] A. REST `/api/v1`
- [ ] B. GraphQL
- [ ] C. tRPC

**⭐ Khuyến nghị:** A.

### Q031 — Kiến trúc backend

- [ ] A. Microservices ngay từ đầu
- [x] B. Modular monolith
- [ ] C. Serverless functions rời rạc

**⭐ Khuyến nghị:** B.

### Q032 — Frontend data fetching

- [ ] A. Server Components + fetch chuẩn là chính
- [x] B. TanStack Query cho màn hình tương tác, Server Components cho initial load
- [ ] C. Redux cho mọi dữ liệu server

**⭐ Khuyến nghị:** B.

### Q033 — Form frontend

- [ ] A. HTML form/Server Action
- [x] B. React Hook Form + schema validation
- [ ] C. Tự quản lý toàn bộ bằng `useState`

**⭐ Khuyến nghị:** B cho admin/checkout phức tạp.

### Q034 — Shared domain logic

- [ ] A. Đặt tất cả trong frontend
- [x] B. Backend là authority; chỉ chia sẻ contract/constants an toàn
- [ ] C. Copy-paste logic FE/BE

**⭐ Khuyến nghị:** B.

### Q035 — Kiểu ID public

- [ ] A. Mongo ObjectId trực tiếp
- [x] B. Opaque ID/UUID public, Mongo `_id` là chi tiết persistence
- [ ] C. Sequential integer

**⭐ Khuyến nghị:** B.

### Q036 — Tiền và tỷ lệ

- [ ] A. Floating point
- [x] B. Integer VND + basis points
- [ ] C. Chuỗi văn bản

**⭐ Khuyến nghị:** B.

---

# PHẦN D — TOPOLOGY, HOSTING VÀ GIAO TIẾP FE/BE

### Q037 — 🔴 Topology xác thực

- [ ] A. FE gọi trực tiếp API khác origin bằng cookie cross-site
- [x] B. FE BFF/proxy same-origin tới NestJS
- [ ] C. Bearer token lưu localStorage
- [ ] D. Chưa quyết định

**⭐ Khuyến nghị:** B; tránh localStorage token.

### Q038 — Deploy FE và BE

- [x] A. Hai Vercel Project trong monorepo
- [ ] B. FE Vercel, BE host khác phù hợp long-running Node
- [ ] C. Cả hai chung một Vercel Project
- [ ] D. VPS/Docker cho cả hai

**⭐ Khuyến nghị:** cần spike trước. Nếu NestJS serverless đáp ứng transaction/connection/latency thì A; nếu không thì B.

### Q039 — Gói production

- [ ] A. Vercel Hobby
- [x] B. Vercel Pro hoặc gói thương mại phù hợp
- [ ] C. Hosting khác
- [ ] D. Chưa có ngân sách

**⭐ Khuyến nghị:** B/C; A không được dùng làm mặc định production thương mại.

### Q040 — Region ưu tiên

- [x] A. Gần Việt Nam nhất có thể cho FE, BE, Atlas
- [ ] B. Region mặc định không cần đo
- [ ] C. Chọn nơi rẻ nhất

**⭐ Khuyến nghị:** A và benchmark thực tế.

### Q041 — Custom domain

- [ ] A. Một domain, `/api` proxy
- [ ] B. `shop.domain` + `api.domain`
- [x] C. Chỉ dùng `vercel.app`

**⭐ Khuyến nghị:** A hoặc B same-site; ưu tiên A cho auth đơn giản.

### Q042 — File/object storage cho ảnh nhãn/chứng từ

- [ ] A. Chưa hỗ trợ upload ở P0
- [x] B. Cloudinary
- [ ] C. S3-compatible/R2
- [ ] D. MongoDB/GridFS
- [ ] E. Khác

**⭐ Khuyến nghị:** A trong P0a nếu ảnh chưa bắt buộc qua app; nếu cần upload, chọn C.

### Q043 — Email reset/invite

- [ ] A. Chưa có, owner cấp mật khẩu thủ công
- [x] B. Dịch vụ email giao dịch ngay P0
- [ ] C. Chỉ magic link

**⭐ Khuyến nghị:** B nếu đưa Member vào production.

### Q044 — Scheduler/job định kỳ

- [x] A. Vercel Cron gọi endpoint idempotent
- [ ] B. Worker thường trú trong API
- [ ] C. Không có job; owner xử lý tay
- [ ] D. Queue ngoài

**⭐ Khuyến nghị:** A cho release reservation/báo cáo nhỏ; D khi nhu cầu tăng.

---

# PHẦN E — XÁC THỰC, PHÂN QUYỀN VÀ BẢO MẬT

### Q045 — 🔴 Cách lưu mật khẩu

- [ ] A. Plaintext như hiện tại
- [x] B. Argon2id
- [ ] C. bcrypt
- [ ] D. Không dùng password, chỉ magic link

**⭐ Khuyến nghị:** B.

### Q046 — 🔴 Xử lý mật khẩu cũ trong Google Sheets

- [ ] A. Import nguyên plaintext
- [x] B. Không import; tạo invitation/reset bắt buộc
- [ ] C. Hash plaintext trong lúc import rồi cho dùng tiếp

**⭐ Khuyến nghị:** B.

### Q047 — Loại session

- [x] A. Opaque server-side session, cookie HttpOnly
- [ ] B. JWT dài hạn không revoke
- [ ] C. JWT access + refresh có rotation/revoke

**⭐ Khuyến nghị:** A cho hệ thống nhỏ.

### Q048 — Thời hạn phiên

- [ ] A. 12 giờ cố định
- [x] B. Idle 30 phút, absolute 12 giờ
- [ ] C. 7 ngày
- [ ] D. Khác

**⭐ Khuyến nghị:** B cho admin; có thể nới với Member sau đánh giá UX.

### Q049 — Khi Member bị khóa

- [ ] A. Chờ cookie hết hạn
- [x] B. Thu hồi tất cả session ngay
- [ ] C. Chỉ chặn đăng nhập mới

**⭐ Khuyến nghị:** B.

### Q050 — MFA cho Owner/Admin

- [x] A. Bắt buộc trước production
- [ ] B. Tùy chọn
- [ ] C. Không cần

**⭐ Khuyến nghị:** A.

### Q051 — Public signup

- [ ] A. Cho mọi người đăng ký Member
- [x] B. Invite-only bởi Owner
- [ ] C. Không có Member account

**⭐ Khuyến nghị:** B.

### Q052 — Vai trò V2

- [x] A. Chỉ `OWNER_ADMIN`, `MEMBER`
- [ ] B. Thêm `MANAGER`, `ACCOUNTANT`, `WAREHOUSE`
- [ ] C. Permission-based hoàn toàn ngay từ đầu

**⭐ Khuyến nghị:** A cho P0; schema chuẩn bị capability nhưng không over-engineer.

### Q053 — Member xem đơn

- [ ] A. Tất cả đơn
- [x] B. Chỉ đơn do mình phụ trách/được giao
- [ ] C. Đơn cùng nhóm

**⭐ Khuyến nghị:** B.

### Q054 — Member xem kho

- [ ] A. Không xem gì
- [x] B. Chỉ xem `available` tổng theo SKU, không giá vốn/lô nhạy cảm
- [ ] C. Xem toàn bộ batch và cost

**⭐ Khuyến nghị:** B.

### Q055 — Member xem thông tin khách

- [ ] A. Xem tất cả khách
- [x] B. Chỉ full PII trên đơn mình phụ trách; dữ liệu khác bị ẩn
- [ ] C. Chỉ Owner xem PII

**⭐ Khuyến nghị:** B.

### Q056 — Export dữ liệu

- [ ] A. Owner và Member đều được export
- [x] B. Chỉ Owner, có audit và giới hạn phạm vi
- [ ] C. Tắt export P0

**⭐ Khuyến nghị:** B.

### Q057 — Rate limit đăng nhập/checkout

- [ ] A. In-memory
- [x] B. Shared persistent/edge rate limit
- [ ] C. Không cần

**⭐ Khuyến nghị:** B.

### Q058 — CAPTCHA/challenge checkout

- [ ] A. Luôn bật
- [x] B. Bật theo rủi ro sau honeypot/rate limit
- [ ] C. Không bao giờ dùng

**⭐ Khuyến nghị:** B.

### Q059 — Audit bảo mật

- [ ] A. Chỉ ghi action/reason
- [x] B. Ghi actor, requestId, entity, redacted diff, timestamp, reason
- [ ] C. Ghi toàn bộ request kể cả password/token

**⭐ Khuyến nghị:** B.

---

# PHẦN F — SẢN PHẨM, KHÁCH HÀNG VÀ CHECKOUT

### Q060 — 🔴 SKU canonical

- [x] A. `CBST-300`, `CBST-400`, `CBST-600`
- [ ] B. 250g/300g/500g
- [ ] C. Cho admin tự thêm SKU ngay P0

**⭐ Khuyến nghị:** A.

### Q061 — Giá bán baseline

- [x] A. 109.000 / 139.000 / 199.000đ
- [ ] B. Giá khác — ghi rõ
- [ ] C. Chưa chốt

**⭐ Khuyến nghị:** A theo SRS, nhưng owner xác nhận trước seed production.

### Q062 — Giá vốn mở đầu

- [x] A. 65.000 / 95.000 / 140.000đ
- [ ] B. 65.000 / 83.000 / 119.000đ
- [ ] C. Không seed giá vốn; chỉ nhập theo lô thật

**⭐ Khuyến nghị:** C cho production; A chỉ là tham chiếu/import reconciliation.

### Q063 — Giá đơn hàng

- [ ] A. Lấy từ payload browser
- [x] B. Server lấy price version hiện hành và snapshot vào order item
- [ ] C. Tính lại theo giá hiện tại mỗi lần xem

**⭐ Khuyến nghị:** B.

### Q064 — Checkout public

- [x] A. Tạo `PENDING`
- [ ] B. Tạo `DRAFT`
- [ ] C. Tạo `CONFIRMED` và reserve ngay

**⭐ Khuyến nghị:** A; owner/member xác nhận mới reserve.

### Q065 — Checkout có cần tài khoản khách?

- [ ] A. Bắt buộc đăng ký
- [x] B. Guest checkout
- [ ] C. Chỉ đặt qua Zalo

**⭐ Khuyến nghị:** B.

### Q066 — Số điện thoại khách

- [ ] A. Bắt buộc và chuẩn hóa
- [ ] B. Không bắt buộc
- [x] C. Bắt buộc với public, đơn nội bộ có thể ngoại lệ kèm lý do

**⭐ Khuyến nghị:** C.

### Q067 — Định danh khách quay lại

- [ ] A. Theo tên
- [x] B. Theo phone chuẩn hóa/customer ID
- [ ] C. Theo địa chỉ

**⭐ Khuyến nghị:** B.

### Q068 — Đơn đa SKU

- [ ] A. Chuỗi `items_summary`
- [x] B. `items[]` chuẩn hóa; summary chỉ là projection hiển thị
- [ ] C. Mỗi SKU là một đơn

**⭐ Khuyến nghị:** B.

### Q069 — Mã đơn

- [ ] A. Random 3–4 số
- [x] B. Opaque unique ID + orderCode dễ đọc có unique index
- [ ] C. Mongo ObjectId hiển thị cho khách

**⭐ Khuyến nghị:** B.

### Q070 — Phí giao ở checkout

- [ ] A. Tính chính xác tự động ngay
- [x] B. Cho nhập/dự kiến và ghi rõ sẽ xác nhận
- [ ] C. Không hiển thị

**⭐ Khuyến nghị:** B khi chưa tích hợp hãng vận chuyển.

### Q071 — Consent dữ liệu cá nhân

- [ ] A. Không cần
- [x] B. Checkbox/thông báo mục đích xử lý và chính sách
- [ ] C. Chỉ ghi trong footer

**⭐ Khuyến nghị:** B.

### Q072 — Ảnh và thông tin nhãn

- [ ] A. Cho publish nội dung ước đoán
- [x] B. Chỉ publish nội dung có bằng chứng/owner duyệt
- [ ] C. Không hiển thị thông tin bảo quản/HSD

**⭐ Khuyến nghị:** B.

---

# PHẦN G — ĐƠN HÀNG, TRẠNG THÁI VÀ TRẢ HÀNG

### Q073 — 🔴 State machine đơn canonical

- [x] A. `PENDING → CONFIRMED → PACKING → SHIPPING → DELIVERED`, cộng các nhánh cancel/fail/return/refund
- [ ] B. `DRAFT → CONFIRMED → PREPARING → SHIPPING → DELIVERED`, cộng return
- [ ] C. Chỉ `PENDING/DELIVERED/CANCELLED`
- [ ] D. Khác

**⭐ Khuyến nghị:** A để khớp SRS V2; cần thống nhất tên `PACKING` và bỏ `PREPARING` cũ.

### Q074 — Ai được xác nhận đơn public?

- [ ] A. Owner בלבד
- [x] B. Owner hoặc Member được giao đơn
- [ ] C. Bất kỳ Member nào

**⭐ Khuyến nghị:** B.

### Q075 — Member được sửa đơn sau confirm

- [ ] A. Mọi trường
- [x] B. Chỉ thông tin giao không ảnh hưởng tiền/kho theo policy
- [ ] C. Không được sửa gì

**⭐ Khuyến nghị:** B.

### Q076 — Thay item/qty sau confirm

- [ ] A. Ghi đè trực tiếp
- [x] B. Transaction release/re-reserve chênh lệch, version check và audit
- [ ] C. Buộc hủy đơn và tạo đơn mới

**⭐ Khuyến nghị:** B; có thể dùng C ở P0a nếu muốn giảm scope.

### Q077 — Fast action “Đã giao + đã thu”

- [ ] A. Một click bỏ qua kiểm tra
- [x] B. Một UI action nhưng backend thực hiện hai nghiệp vụ có xác nhận và transaction phù hợp
- [ ] C. Tách hai thao tác bắt buộc

**⭐ Khuyến nghị:** B nếu đủ contract; nếu chưa, C.

### Q078 — Giao thất bại

- [ ] A. Chuyển thẳng `CANCELLED`
- [x] B. `DELIVERY_FAILED`, sau đó retry hoặc `RETURNED`
- [ ] C. Vẫn giữ `SHIPPING`

**⭐ Khuyến nghị:** B.

### Q079 — Hủy khi đang SHIPPING

- [ ] A. Cho hủy và cộng kho ngay
- [x] B. Không cancel trực tiếp; xử lý giao thất bại/trả về, kiểm hàng rồi mới restock
- [ ] C. Không hỗ trợ

**⭐ Khuyến nghị:** B.

### Q080 — Return sau DELIVERED

- [ ] A. Sửa order cũ về CANCELLED
- [x] B. Tạo return/refund/adjustment records, giữ lịch sử
- [ ] C. Xóa order

**⭐ Khuyến nghị:** B.

### Q081 — Partial return

- [ ] A. Không hỗ trợ P0
- [x] B. Hỗ trợ theo từng line/qty ngay P0
- [ ] C. Chỉ hỗ trợ hoàn toàn bộ đơn

**⭐ Khuyến nghị:** B nếu nghiệp vụ thực tế có đổi/trả từng hũ; nếu rất hiếm, C cho P0a.

### Q082 — Optimistic concurrency

- [ ] A. Không dùng version
- [x] B. Mọi mutation order nhận `expectedVersion`, conflict trả 409
- [ ] C. Lock toàn bộ đơn bằng in-memory mutex

**⭐ Khuyến nghị:** B.

### Q083 — Idempotency

- [ ] A. Chỉ checkout
- [x] B. Checkout, transition nhạy cảm, payment, refund, payout và webhook
- [ ] C. Không cần

**⭐ Khuyến nghị:** B.

---

# PHẦN H — TỒN KHO, LÔ VÀ HẠN DÙNG

### Q084 — 🔴 Chính sách chọn lô

- [ ] A. FIFO tuyệt đối
- [x] B. FEFO theo HSD, cùng HSD thì FIFO
- [ ] C. Owner chọn tay từng lần

**⭐ Khuyến nghị:** B.

### Q085 — 🔴 Thời điểm reserve

- [ ] A. Khi tạo DRAFT/PENDING
- [x] B. Khi CONFIRMED
- [ ] C. Khi SHIPPING

**⭐ Khuyến nghị:** B.

### Q086 — 🔴 Thời điểm stock-out

- [ ] A. CONFIRMED
- [x] B. SHIPPING, khi hàng thực sự rời kho
- [ ] C. DELIVERED

**⭐ Khuyến nghị:** B.

### Q087 — Thời điểm ghi nhận doanh thu

- [ ] A. CONFIRMED
- [ ] B. SHIPPING
- [x] C. DELIVERED
- [ ] D. PAID bất kể giao hàng

**⭐ Khuyến nghị:** C.

### Q088 — Reservation expiry

- [ ] A. Không hết hạn
- [x] B. 24 giờ nếu chưa thanh toán/chưa packing
- [ ] C. 2 giờ
- [ ] D. Owner cấu hình

**⭐ Khuyến nghị:** D với default 24 giờ, release idempotent.

### Q089 — Lô thiếu HSD hoặc bằng chứng nhãn

- [ ] A. Cho bán bình thường
- [x] B. `QUARANTINED`, owner bổ sung bằng chứng mới mở
- [ ] C. Xóa lô

**⭐ Khuyến nghị:** B.

### Q090 — Lô hết hạn

- [ ] A. Tự động cho xuất nếu owner bấm
- [x] B. Chặn reserve/xuất; xử lý hủy/điều chỉnh theo quy trình
- [ ] C. Chỉ cảnh báo

**⭐ Khuyến nghị:** B.

### Q091 — Trả hàng về kho

- [ ] A. Tự cộng kho ngay
- [x] B. Kiểm hàng; chọn `RETURN_RESTOCK` hoặc `RETURN_QUARANTINE`
- [ ] C. Không nhận trả hàng

**⭐ Khuyến nghị:** B.

### Q092 — Điều chỉnh tồn

- [ ] A. Sửa trực tiếp `onHand`
- [x] B. Tạo movement append-only có reason/actor/idempotency
- [ ] C. Chỉnh trực tiếp DB bằng admin tool

**⭐ Khuyến nghị:** B.

### Q093 — COGS

- [ ] A. Giá vốn baseline theo SKU
- [x] B. Landed unit cost thực tế của batch allocation
- [ ] C. Giá vốn hiện tại tại lúc xem report

**⭐ Khuyến nghị:** B.

### Q094 — Cước nhập

- [ ] A. Chi phí kỳ
- [x] B. Phân bổ theo số hũ vào landed cost lô
- [ ] C. Vừa landed cost vừa expense

**⭐ Khuyến nghị:** B, tuyệt đối không chọn C.

### Q095 — Nhiều kho

- [x] A. Một kho chung trong V2
- [ ] B. Nhiều kho ngay P0
- [ ] C. Một kho nhưng schema có `warehouseId` dự phòng

**⭐ Khuyến nghị:** A; chỉ thêm hook khi có nhu cầu rõ.

---

# PHẦN I — THANH TOÁN, COD, CHI PHÍ VÀ TÀI CHÍNH

### Q096 — 🔴 Phương thức thanh toán P0

- [x] A. `BANK_TRANSFER`, `CASH_COD`
- [ ] B. Thêm tiền mặt trực tiếp
- [ ] C. Tích hợp cổng thanh toán ngay

**⭐ Khuyến nghị:** A và cân nhắc `CASH` nếu thực tế giao trực tiếp.

### Q097 — Thanh toán một phần

- [x] A. Hỗ trợ partial payment
- [ ] B. Chỉ PAID/UNPAID
- [ ] C. Chỉ hỗ trợ nội bộ, không public

**⭐ Khuyến nghị:** A.

### Q098 — Payment storage

- [ ] A. Một field trên order
- [x] B. Ledger append-only, order giữ projection tổng
- [ ] C. Ghi trong audit log

**⭐ Khuyến nghị:** B.

### Q099 — COD hãng vận chuyển đang giữ

- [ ] A. Xem là doanh thu đã thu
- [x] B. Theo dõi receivable/settlement riêng, chỉ cash-in khi shop nhận
- [ ] C. Không theo dõi

**⭐ Khuyến nghị:** B.

### Q100 — Phí ship khách trả

- [ ] A. Luôn là doanh thu shop
- [x] B. Tách phần shop giữ và phần pass-through cho hãng ship
- [ ] C. Luôn loại khỏi đơn

**⭐ Khuyến nghị:** B.

### Q101 — Chi phí trực tiếp

- [ ] A. Một tổng số duy nhất
- [x] B. Ledger/dòng chi phí có category, payer, scope và bằng chứng
- [ ] C. Ghi trong notes

**⭐ Khuyến nghị:** B.

### Q102 — Chi phí do Member ứng

- [ ] A. Trừ thẳng vào commission
- [x] B. Theo dõi reimbursement riêng, không trộn commission
- [ ] C. Không hỗ trợ

**⭐ Khuyến nghị:** B.

### Q103 — Hoàn tiền

- [ ] A. Giảm `grossCollected` và xóa payment cũ
- [x] B. Ghi refund transaction tham chiếu payment/order
- [ ] C. Chỉ sửa payment status

**⭐ Khuyến nghị:** B.

### Q104 — Lỗ đơn hàng

- [ ] A. Ép lợi nhuận về 0
- [x] B. Ghi số âm thật; commission Member bằng 0
- [ ] C. Chuyển phần lỗ cho Member

**⭐ Khuyến nghị:** B.

### Q105 — Báo cáo doanh thu

- [ ] A. Tổng mọi đơn chưa hủy
- [x] B. Chỉ recognized revenue của DELIVERED, tách cash collected
- [ ] C. Tổng đơn PAID dù chưa giao

**⭐ Khuyến nghị:** B.

### Q106 — Chi phí chung/overhead

- [x] A. Đưa vào P0 tối thiểu
- [ ] B. Để P1
- [ ] C. Không quản lý

**⭐ Khuyến nghị:** A ở mức ledger đơn giản để net profit không bị gọi sai.

### Q107 — Điều chỉnh sau khi kỳ đã chốt

- [ ] A. Sửa bản ghi cũ
- [x] B. Tạo adjustment ở kỳ hiện tại, tham chiếu nguồn
- [ ] C. Xóa payout rồi tính lại

**⭐ Khuyến nghị:** B.

---

# PHẦN J — HOA HỒNG, THÀNH VIÊN VÀ KPI

### Q108 — 🔴 Công thức hoa hồng

- [ ] A. 40% doanh thu
- [x] B. 40% phần lợi nhuận phân phối dương sau COGS và direct costs
- [ ] C. Mức cố định theo hũ
- [ ] D. Khác

**⭐ Khuyến nghị:** B.

### Q109 — Đơn Owner trực tiếp phụ trách

- [ ] A. Vẫn tạo commission Member 40%
- [x] B. Không tạo nghĩa vụ commission Member
- [ ] C. Chia đều team

**⭐ Khuyến nghị:** B.

### Q110 — Điều kiện commission eligible

- [ ] A. Đơn được tạo
- [ ] B. DELIVERED
- [x] C. DELIVERED + PAID/đối soát + đủ direct cost + không có return mở

**⭐ Khuyến nghị:** C.

### Q111 — Tỷ lệ commission thay đổi

- [ ] A. Ghi đè mọi đơn lịch sử
- [x] B. Effective-dated policy và snapshot trên đơn/accrual
- [ ] C. Chỉ cho một tỷ lệ vĩnh viễn

**⭐ Khuyến nghị:** B.

### Q112 — Payout

- [ ] A. Theo từng đơn ngay lập tức
- [x] B. Theo tháng, Owner approve và mark paid
- [ ] C. Tự động chuyển khoản

**⭐ Khuyến nghị:** B.

### Q113 — Hoa hồng đã trả nhưng có refund

- [ ] A. Sửa payout cũ
- [x] B. Adjustment/clawback kỳ sau
- [ ] C. Shop tự chịu, không ghi nhận

**⭐ Khuyến nghị:** B.

### Q114 — KPI mốc 10/20/30/50 hũ

- [x] A. Chỉ báo cáo mô tả
- [ ] B. Tự sinh thưởng tiền
- [ ] C. Bỏ khỏi hệ thống

**⭐ Khuyến nghị:** A.

### Q115 — Attribution đơn

- [x] A. Chỉ một `responsibleMemberId`
- [ ] B. Nhiều người chia commission ngay P0
- [ ] C. Người tạo đơn luôn nhận commission

**⭐ Khuyến nghị:** A; lưu thêm leadSource/creator/deliverer để báo cáo nhưng không tự chia.

### Q116 — Tranh chấp người phụ trách

- [ ] A. Member tự sửa
- [x] B. Owner reassign có reason/audit; nếu payout locked thì adjustment
- [ ] C. Đơn bị hủy

**⭐ Khuyến nghị:** B.

---

# PHẦN K — MIGRATION GOOGLE SHEETS → MONGODB

### Q117 — 🔴 Nguồn dữ liệu migration

- [ ] A. Google Sheets hiện tại
- [ ] B. Excel song song
- [ ] C. Cả hai, có source precedence rõ ràng
- [x] D. Bỏ dữ liệu cũ, production trắng

**⭐ Khuyến nghị:** C nếu Excel thực sự còn được dùng; phải chốt nguồn ưu tiên.

### Q118 — Dữ liệu nào phải import? (chọn nhiều)

- [ ] A. Sản phẩm và lịch sử giá
- [ ] B. Lô/tồn kho
- [ ] C. Đơn hàng và khách
- [ ] D. Payment/COD
- [ ] E. Chi phí
- [ ] F. Commission/payout
- [ ] G. Audit log
- [ ] H. Member profile, không import password plaintext
- [ ] I. Chỉ dữ liệu opening balance
- [x] J. Không import dữ liệu cũ; production V2 khởi tạo trắng theo Q117=D

**⭐ Khuyến nghị:** A–H khi dữ liệu đủ tin cậy; phần thiếu đánh dấu reconciliation.

### Q119 — Dữ liệu thiếu giá vốn/lô/payment

- [ ] A. Tự đoán từ baseline
- [x] B. Gắn `NEEDS_RECONCILIATION`, không cho payout/chốt báo cáo
- [ ] C. Bỏ record

**⭐ Khuyến nghị:** B.

### Q120 — `items_summary` cũ

- [ ] A. Giữ chuỗi làm nguồn thật
- [x] B. Parse dry-run thành `items[]`, đưa record không chắc vào exception report
- [ ] C. Bỏ toàn bộ đơn đa SKU

**⭐ Khuyến nghị:** B.

### Q121 — ID cũ

- [ ] A. Tạo ID mới và bỏ mapping
- [x] B. Giữ `legacyId/legacyOrderCode` và bảng mapping
- [ ] C. Dùng nguyên row number làm ID

**⭐ Khuyến nghị:** B.

### Q122 — Mật khẩu Member cũ

- [ ] A. Import plaintext
- [x] B. Không import; invite/reset
- [ ] C. Dùng password mặc định chung

**⭐ Khuyến nghị:** B.

### Q123 — Dry-run migration

- [ ] A. Bỏ qua
- [x] B. Chạy staging, xuất báo cáo sai lệch, owner sign-off
- [ ] C. Chạy thẳng production rồi sửa

**⭐ Khuyến nghị:** B.

### Q124 — Tiêu chí đối soát bắt buộc (chọn nhiều)

- [x] A. Số đơn theo trạng thái
- [x] B. Số hũ theo SKU/lô
- [x] C. Tồn on-hand/reserved/available
- [x] D. Tổng gross due/collected/refund/COD receivable
- [x] E. COGS/direct costs
- [x] F. Commission accrued/approved/paid
- [x] G. Số khách và duplicate phone
- [x] H. Hash/checksum snapshot nguồn

**⭐ Khuyến nghị:** A–H.

### Q125 — Freeze writes khi cutover

- [ ] A. Không freeze, ghi hai nơi
- [x] B. Freeze Sheets, import delta cuối, verify rồi switch traffic
- [ ] C. Chỉ thông báo team không sửa

**⭐ Khuyến nghị:** B.

### Q126 — Rollback

- [ ] A. Không cần
- [x] B. Có deadline rollback, snapshot nguồn/đích, tiêu chí rollback và owner quyết định
- [ ] C. Rollback bằng cách ghi ngược MongoDB vào Sheets

**⭐ Khuyến nghị:** B; không thiết kế dual-write ngược nếu chưa có nhu cầu bắt buộc.

### Q127 — Google Sheets sau cutover

- [ ] A. Vẫn cho sửa và sync hai chiều
- [x] B. Read-only archive/export
- [ ] C. Xóa ngay

**⭐ Khuyến nghị:** B.

### Q128 — Thời gian giữ archive

- [ ] A. 30 ngày
- [ ] B. 1 năm
- [x] C. Theo nghĩa vụ kế toán/pháp lý được owner xác minh
- [ ] D. Vĩnh viễn

**⭐ Khuyến nghị:** C.

---

# PHẦN L — API, UI VÀ TRẢI NGHIỆM VẬN HÀNH

### Q129 — Routes public/admin

- [ ] A. Giữ route hiện tại khi có thể
- [ ] B. Đổi toàn bộ route
- [x] C. Chốt route map V2 và redirect URL public cũ

**⭐ Khuyến nghị:** C.

### Q130 — Admin UI trên mobile

- [ ] A. Desktop-only
- [x] B. Responsive đầy đủ cho thao tác đơn/kho nhanh
- [ ] C. Làm app mobile native

**⭐ Khuyến nghị:** B.

### Q131 — Trạng thái UI bắt buộc

- [ ] A. Chỉ success
- [x] B. Loading, empty, validation, conflict, offline/network error, retry-safe
- [ ] C. Dùng alert mặc định cho mọi lỗi

**⭐ Khuyến nghị:** B.

### Q132 — Khi nhận 409 version conflict

- [ ] A. Ghi đè
- [x] B. Refresh dữ liệu, hiển thị khác biệt và yêu cầu xác nhận lại
- [ ] C. Im lặng retry

**⭐ Khuyến nghị:** B.

### Q133 — Polling/live sync

- [ ] A. Poll toàn DB mỗi 30 giây
- [ ] B. Query invalidation sau write; polling giới hạn cho màn hình cần thiết
- [x] C. WebSocket ngay P0

**⭐ Khuyến nghị:** B.

### Q134 — Dashboard Member

- [x] A. Chỉ đơn cá nhân và commission/KPI cá nhân
- [ ] B. Xem số liệu toàn team
- [ ] C. Không có dashboard

**⭐ Khuyến nghị:** A.

### Q135 — Dashboard Owner P0

- [ ] A. Tất cả analytics nâng cao
- [x] B. Đơn, tồn, revenue recognized, cash, COGS, direct profit, commission, pending reconciliation
- [ ] C. Chỉ số đơn

**⭐ Khuyến nghị:** B.

### Q136 — Export

- [ ] A. CSV P0, XLSX P1
- [ ] B. CSV và XLSX ngay
- [x] C. Không export

**⭐ Khuyến nghị:** A.

### Q137 — Notification

- [ ] A. Không có P0
- [x] B. In-app alerts P0; email/Zalo sau
- [ ] C. Tích hợp Zalo automation ngay

**⭐ Khuyến nghị:** B.

---

# PHẦN M — TEST, QC VÀ ACCEPTANCE GATES

### Q138 — 🔴 Phương pháp phát triển

- [ ] A. Code trước, test sau
- [x] B. Vertical TDD theo module/flow
- [ ] C. Chỉ manual test

**⭐ Khuyến nghị:** B.

### Q139 — Test database

- [ ] A. Mock toàn bộ MongoDB
- [x] B. Unit mock + integration trên MongoDB test replica set/Atlas staging
- [ ] C. Test trực tiếp production

**⭐ Khuyến nghị:** B.

### Q140 — Concurrency test hũ cuối

- [ ] A. Không cần
- [x] B. Bắt buộc trước staging
- [ ] C. Chỉ sau khi có lỗi thật

**⭐ Khuyến nghị:** B.

### Q141 — IDOR/RBAC test

- [ ] A. Chỉ test UI ẩn nút
- [x] B. Integration test list/detail/mutation/export cho từng role
- [ ] C. Manual test một lần

**⭐ Khuyến nghị:** B.

### Q142 — E2E browser

- [x] A. Không dùng
- [ ] B. Playwright cho hero flows Guest/Member/Owner
- [ ] C. Test mọi pixel

**⭐ Khuyến nghị:** B.

### Q143 — Coverage

- [ ] A. Đặt 100% toàn repo
- [x] B. Không dùng con số duy nhất; bắt buộc coverage cao ở money/state/inventory/auth
- [ ] C. Không đo

**⭐ Khuyến nghị:** B.

### Q144 — CI gates

- [ ] A. Build בלבד
- [x] B. Format/lint/typecheck/unit/integration/build/security/dependency checks
- [ ] C. Chạy test thủ công

**⭐ Khuyến nghị:** B.

### Q145 — Cảnh báo lint

- [ ] A. Cho phép tăng tùy ý
- [x] B. Baseline về 0 trong source product-owned; archive/generated bị exclude rõ
- [ ] C. Tắt ESLint

**⭐ Khuyến nghị:** B.

### Q146 — UAT

- [ ] A. Developer tự duyệt
- [x] B. Owner + 1–2 Member test trên điện thoại với script và dữ liệu staging
- [ ] C. Dùng production làm UAT

**⭐ Khuyến nghị:** B.

### Q147 — Gate production

- [ ] A. CI xanh là deploy
- [x] B. CI + security + concurrency + migration reconciliation + restore drill + UAT + owner sign-off
- [ ] C. Đủ giao diện là deploy

**⭐ Khuyến nghị:** B.

---

# PHẦN N — VẬN HÀNH, BACKUP, OBSERVABILITY VÀ CHI PHÍ

### Q148 — Môi trường

- [ ] A. Dev và production dùng chung DB
- [x] B. Local/dev, staging, production tách DB/secrets
- [ ] C. Chỉ production

**⭐ Khuyến nghị:** B.

### Q149 — Seed

- [ ] A. Tự seed production khi deploy
- [x] B. Seed chỉ local/staging; production dùng migration/import được duyệt
- [ ] C. Seed mọi môi trường như nhau

**⭐ Khuyến nghị:** B.

### Q150 — Backup production

- [ ] A. Chỉ tin Atlas mặc định
- [x] B. Backup managed/independent phù hợp tier, mã hóa, retention và restore drill
- [ ] C. Export JSON thủ công khi nhớ

**⭐ Khuyến nghị:** B.

### Q151 — RPO/RTO mục tiêu

- [x] A. RPO 24h / RTO 4h
- [ ] B. RPO 1h / RTO 1h
- [ ] C. Chưa chốt; đo chi phí trước

**⭐ Khuyến nghị:** A cho MVP nếu restore drill chứng minh đạt được.

### Q152 — Logging

- [ ] A. `console.log` tự do
- [x] B. Structured logs có requestId, redact secrets/PII
- [ ] C. Log toàn bộ payload

**⭐ Khuyến nghị:** B.

### Q153 — Error monitoring

- [ ] A. Không dùng
- [x] B. Sentry hoặc dịch vụ tương đương
- [ ] C. Chỉ xem Vercel logs khi có lỗi

**⭐ Khuyến nghị:** B.

### Q154 — Business alerts

- [ ] A. Chỉ lỗi 5xx
- [x] B. 5xx, DB/backup failure, checkout failure, payment mismatch, negative inventory attempt
- [ ] C. Không có

**⭐ Khuyến nghị:** B.

### Q155 — Budget alerts

- [ ] A. Không cần
- [x] B. Vercel/Atlas/storage/email có ngưỡng và người nhận cảnh báo
- [ ] C. Kiểm tra cuối năm

**⭐ Khuyến nghị:** B.

### Q156 — Deployment

- [x] A. Vercel Git Integration là nguồn deploy duy nhất
- [ ] B. GitHub Actions deploy là nguồn duy nhất
- [ ] C. Cả hai cùng deploy production

**⭐ Khuyến nghị:** A hoặc B, nhưng không C. Đề xuất A cho deploy, GitHub Actions làm quality gates.

### Q157 — Database migration

- [ ] A. Breaking migration cùng lúc với deploy
- [x] B. Expand → deploy compatible code → backfill → contract
- [ ] C. Sửa tay production

**⭐ Khuyến nghị:** B.

### Q158 — Incident owner

- [ ] A. Chưa xác định
- [x] B. Owner nghiệp vụ + một người kỹ thuật chịu trách nhiệm, có escalation
- [ ] C. Mọi Member tự xử lý

**⭐ Khuyến nghị:** B.

---

# PHẦN O — TÀI LIỆU, ARCHIVE VÀ DỌN DẸP CUỐI

### Q159 — Bộ tài liệu canonical V2 (chọn nhiều)

- [x] A. SRS V2
- [x] B. Decision Log V2
- [x] C. Data Dictionary V2
- [x] D. OpenAPI/API Contracts
- [x] E. Traceability Matrix
- [x] F. Migration Runbook
- [x] G. Production Runbook
- [x] H. README triển khai

**⭐ Khuyến nghị:** A–H.

### Q160 — Quy tắc precedence

- [ ] A. Tài liệu mới nhất theo ngày luôn thắng
- [x] B. Decision Log → SRS → contracts/schema → runbooks → archive
- [ ] C. Code luôn thắng kể cả trái SRS

**⭐ Khuyến nghị:** B; mismatch code/docs phải được ghi nhận và sửa, không ngầm coi code đúng.

### Q161 — Tài liệu Google Sheets/Supabase

- [ ] A. Xóa ngay
- [x] B. Archive, thêm banner `SUPERSEDED — KHÔNG DÙNG TRIỂN KHAI`
- [ ] C. Giữ là hướng dẫn chính

**⭐ Khuyến nghị:** B.

### Q162 — Env cũ

- [ ] A. Giữ vô thời hạn
- [x] B. Xóa khỏi runtime sau cutover; giữ mapping migration trong runbook không chứa secret
- [ ] C. Commit `.env.local` để lưu

**⭐ Khuyến nghị:** B.

### Q163 — Dependency cũ

- [ ] A. Gỡ `googleapis` ngay khi bắt đầu
- [x] B. Chỉ gỡ sau khi migration adapter không còn caller và cutover pass
- [ ] C. Giữ dù không dùng

**⭐ Khuyến nghị:** B.

### Q164 — Generated/build artifacts

- [ ] A. Commit `.next`, logs, export cache
- [x] B. Ignore và xóa khỏi source control nếu lỡ theo dõi
- [ ] C. Giữ để deploy nhanh

**⭐ Khuyến nghị:** B.

### Q165 — Archive source legacy runtime

- [ ] A. Giữ code legacy trong `apps/web`
- [x] B. Tag Git trước khi xóa; code runtime cũ không nằm trong build V2
- [ ] C. Copy sang nhiều thư mục backup trong repo

**⭐ Khuyến nghị:** B.

### Q166 — Thời điểm xóa migration adapter

- [ ] A. Ngay sau lần import đầu
- [x] B. Sau production stabilization, hết rollback window và owner ký đối soát
- [ ] C. Không bao giờ xóa

**⭐ Khuyến nghị:** B.

### Q167 — Báo cáo kết thúc refactor

- [ ] A. Chỉ liệt kê file đổi
- [x] B. Có mapping old→new, dữ liệu migration, test evidence, known limitations, rollback/restore result
- [ ] C. Không cần

**⭐ Khuyến nghị:** B.

---

# PHẦN P — CÁC CỔNG PHÊ DUYỆT CUỐI

### Q168 — 🔴 Có cho phép bắt đầu refactor trước khi trả lời toàn bộ BLOCKER?

- [ ] A. Có
- [x] B. Không

**⭐ Khuyến nghị:** B.

### Q169 — Có cho phép tự áp dụng phương án ⭐ cho câu không phải BLOCKER nếu owner không chọn?

- [ ] A. Có, nhưng phải ghi Decision Log
- [ ] B. Không, mọi câu đều phải trả lời
- [x] C. Chỉ nhóm kỹ thuật được quyết định câu thuần kỹ thuật

**⭐ Khuyến nghị:** C; business policy vẫn cần owner duyệt.

### Q170 — Ai phê duyệt business rules?

- [x] A. Owner dự án
- [ ] B. Developer
- [ ] C. Member bất kỳ
- [ ] D. Khác — ghi rõ

**⭐ Khuyến nghị:** A.

### Q171 — Ai phê duyệt kiến trúc kỹ thuật?

- [ ] A. Owner một mình
- [x] B. Technical lead đề xuất, owner duyệt tác động chi phí/rủi ro
- [ ] C. Developer tự quyết hoàn toàn

**⭐ Khuyến nghị:** B.

### Q172 — Quy tắc khi phát hiện yêu cầu mới trong lúc code

- [ ] A. Làm luôn
- [x] B. Tạo change request/decision mới, đánh giá scope rồi mới làm
- [ ] C. Bỏ qua

**⭐ Khuyến nghị:** B.

### Q173 — Tiêu chí cho phép xóa code cũ

- [ ] A. Code mới đã tồn tại
- [x] B. Không còn caller + replacement tests pass + migration/rollback không cần module đó + đã tag Git
- [ ] C. File nhìn có vẻ không dùng

**⭐ Khuyến nghị:** B.

### Q174 — Tiêu chí cho phép production cutover

- [ ] A. Owner thấy giao diện ổn
- [x] B. Toàn bộ gate Q147 + đối soát và runbook được ký duyệt
- [ ] C. Build pass

**⭐ Khuyến nghị:** B.

---

# 1. Danh sách câu BLOCKER phải trả lời trước

```text
Q001, Q002, Q003, Q011, Q023, Q037, Q045, Q046,
Q060, Q073, Q084, Q085, Q086, Q096, Q108, Q117,
Q138, Q168
```

# 2. Mẫu trả lời rút gọn đề xuất

Có thể trả lời theo từng đợt để tránh quá tải:

1. **Đợt 1 — Foundation:** Q001–Q059
2. **Đợt 2 — Nghiệp vụ:** Q060–Q116
3. **Đợt 3 — Migration/QC/Ops:** Q117–Q174

Mẫu:

```text
ĐỢT 1
Q001=B
Q002=B
Q003=B
...

Ghi chú bổ sung:
- ...
```

# 3. Quy trình sau khi trả lời

1. Kiểm tra từng lựa chọn với SRS và code hiện tại.
2. Lập `DECISION_LOG_V2.md`, mỗi quyết định có trạng thái `APPROVED/OPEN/BLOCKED/SUPERSEDED`.
3. Sửa và harden SRS V2 theo quyết định đã duyệt.
4. Tạo Data Dictionary, API Contract, Traceability Matrix và Migration Runbook.
5. Lập implementation plan theo vertical slices và TDD.
6. Tag/commit baseline hiện tại; không xóa code khi chưa có replacement đã kiểm chứng.
7. Dựng V2 song song, migration dry-run, UAT và cutover theo gate.

---

**END — 174 CÂU HỎI CHỐT PHƯƠNG ÁN**
