# System Overview

## Snapshot và phạm vi
Root: `D:/BANHANG/web/ca-bong-song-tra-nextjs-v1/ca-bong-song-tra-v1`.
Git HEAD: `1c4d7693d98e5e22d517ce15db41cd8adb2236c7`. Working tree ban đầu sạch. 142 tracked files, 60 API và 69 web. Audit risk-based toàn các lớp, không tuyên bố exhaustive mọi dòng/HTTP combinations. Không mở raw .env; build tự đọc app env như scripts hiện có.

## Architecture/data flow
```text
Browser (untrusted input, cookie/session, retry identity)
  → Next App Router screens + React Query
  → same-origin /api/[...path] BFF (allowlisted method/path, signed client identity)
  → Nest /api/v1 ApiGuard (origin/json, rate buckets, session/role)
  → controller + ValidationPipe DTO
  → CommerceService / DiscountService / PasswordResetService
  → MongoRepository → Mongoose collections / replica-set transaction

Owner upload → Next upload route → Cloudinary (external trust boundary)
Owner media state → Next media route → API media collections
```

Next.js 15.5.27/React19 frontend; Nest11/Mongoose8 backend. Runtime module imports HealthModule và CommerceModule (`apps/api/src/app.module.ts:6`). CommerceModule dùng monolithic CommerceService/MongoRepository, không gọi legacy products/order/finance modules làm authority. Legacy helpers có tests riêng không chứng minh V2 HTTP workflow.

### Modules và workflow
- Auth: Argon2id, opaque HMAC-hashed session, status/authVersion revocation, password reset one-use. Production Owner MFA gate hiện sai điều kiện (AUTH-01).
- Catalog/pricing: approved SKUs, integer VND, pricing fingerprint, promotion intervals, internal vouchers/limits/customer counters.
- Orders: guest gate hoặc internal actor, PENDING không giữ kho; confirm reserve FEFO; ship outbound; deliver recognition. Service cho correction tự do, có physical lifecycle mismatch (BUS-01/02).
- Inventory: receipts/purchase receipts, landed cost, quarantine theo label/expiry, append-only movements; unit rounding làm mất cost remainder (BUS-03).
- Finance: payment/refund/expense/commission/payout ledger, balance doc; return inspection và cash refund tách sự kiện. Formula acceptance drift cần chốt.
- KPI: policy→period→preview→settle→KPI_BONUS. Metric, window/finality, snapshots/reporting có release blockers.
- Media: asset/slot sync Cloudinary; inline type-only DTO làm yếu validation boundary.
- UI: screens.tsx chung storefront/admin/auth, component managers, query cache, checkout retry. Có busy/ref checks nhưng ambiguous-operation identity chưa đủ chặt.

### Persistence/integrity
`v2/repository.ts:14-36` đăng ký users, sessions, products, orders, inventoryBatches, inventoryMovements, financialLedger, auditLogs, idempotencyRecords, commissionBalances, rateLimits, passwordResetTokens, mediaAssets/mediaSlots, purchaseReceipts, promotions/vouchers/redemptions/customerCounters, kpiPolicies/Periods/Awards.
`repository.ts:38-67` majority/snapshot transaction và atomic idempotency response; `69-73` order version CAS. Unique schema indexes gồm idempotency scope/key, product SKU và award period/member; TTL cho auth/reset/rate theo models. Đây là **schema definitions**, chưa xác minh indexes thật trên DB.
Không có DB FK như relational; reference/cross-field invariants chủ yếu trong service. Không có kết quả restore/backfill/migration rehearsal. Không chạy provisioning.

## Trust boundaries / high risk
1. Browser→BFF: actor cannot be trusted from payload, retry identities có thể bị xóa.
2. BFF→API: restricted cookie/origin forwarding, signed client cookie không ổn định như network identity.
3. MEMBER→OWNER: scoped orders/projections/owner guard; không có IDOR được chứng minh trong reviewed paths, nhưng chưa network persona E2E.
4. Service→Mongo: multi-document transaction/idempotency dựa replica set/index thực tế. Mocks không chứng minh durability/isolation.
5. API/media→Cloudinary: timeouts/upload format/operational quotas chưa xác minh thực tế.
6. Code/config→deployment: 2 API entrypoints main.ts và api/index.ts; duplicate bootstrap dễ policy drift; serverless cold-start initialization race tiềm ẩn chưa load-test.

## Architecture/code quality/reliability assessment
- Modular monolith phù hợp quy mô hơn microservices, nhưng CommerceService 916 dòng và screens.tsx khoảng 7k dòng gây coupling cao. Tách bounded domain services và route entries, giữ transaction orchestration rõ; không cần rewrite toàn bộ.
- Duplicate bootstrap/origin và legacy pure workflows làm policy drift. Hợp nhất bootstrap và định nghĩa nguồn contract authority trước xóa code.
- KPI preview/settle chạy computeDeliveredQty theo từng member (`service.ts:772-797,820-822`), mỗi lần đọc toàn orders phù hợp: N queries theo member + materialization; cần batch aggregation/projection/index explain trong staging. Chưa có benchmark/heap/load evidence, không gán latency giả.
- Dashboard nhiều aggregate độc lập không cùng snapshot; cần thống nhất consistency semantics. Media gallery unbounded; directory UI cắt ở 100; chưa load-tested.
- Request IDs/no-store/error redaction có; logging/metrics/tracing và alert/restore evidence chưa có. Liveness chỉ trả static status, không phải DB readiness.
- CI Node22 frozen install/lint/typecheck/tests/build/audit; local Node26 khác CI. SHA pinning/actions protection và actual deploy unknown. Build skips lint nên không thể thay release verify.

## Coverage limitations
Xem map endpoint ở BUSINESS_LOGIC_AUDIT: 66 CommerceController route/method được static-review, không phải 66 HTTP tests. Health live được đọc riêng. Frontend managers targeted theo workflow, không line-by-line mọi component. Không chứng nhận responsive/a11y/CWV, Mongo failure/concurrency, cloud ACL/TLS/secret rotation/backup, network auth, full OpenAPI response conformance hoặc UAT.
