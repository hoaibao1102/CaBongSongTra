# TRACEABILITY & READINESS MATRIX — P0a

> Phiên bản: 1.0 — 09/10/2026  
> Kết luận tài liệu: **READY FOR IMPLEMENTATION**.  
> Kết luận production: **NOT READY FOR GO-LIVE** cho tới khi các gate evidence ở mục 5 pass.

## 1. Scope P0a — vertical slice

### In scope

1. Invite-only auth, role `OWNER_ADMIN/MEMBER`, RLS và IDOR protection.
2. Ba sản phẩm và lịch sử giá.
3. Nhập lô, landed cost, ledger, reservation, tồn khả dụng.
4. Khách hàng tối thiểu, tạo/confirm/ship/deliver/cancel/return đơn.
5. Receipt/refund, chi phí trực tiếp, COGS snapshot.
6. Commission 60/40, approval và payout tháng.
7. Dashboard cơ bản, CSV export, audit.
8. Backup/restore, staging, migration và rollout song song Excel.

### P0b/P1 — không chặn P0a

Promotions, KPI thưởng, marketing/content calendar, image upload, PWA/offline, shipper API, notifications, nhiều kho, BI, lead CRM đầy đủ, realtime và checkout online.

## 2. Requirement → decision → contract → acceptance

| Requirement | Decision | Contract/schema | Acceptance |
|---|---|---|---|
| R-AUTH-01 Invite-only và role | DEC-AUTH-01 | `profiles`, RLS matrix | AC-AUTH-001..004 |
| R-PROD-01 Ba SKU canonical | DEC-PROD-01/02 | `products`, `product_prices` | AC-PROD-001..003 |
| R-INV-01 Không oversell | DEC-INV-01/04 | reservation + ledger; `confirmOrder` | AC-INV-001..005 |
| R-INV-02 FEFO/FIFO và HSD | DEC-INV-03 | batches, batch selection | AC-INV-006..008 |
| R-ORD-01 State machine | DEC-ORD-01/02 | `OrderStatus`, `transitionOrder` | AC-ORD-001..006 |
| R-PAY-01 Tiền thực thu/refund | DEC-PAY-01 | `payments`, derived status | AC-PAY-001..004 |
| R-FIN-01 Lợi nhuận và commission | DEC-FIN-01..06 | costs, commission, payout | AC-FIN-001..008 |
| R-PII-01 Phạm vi dữ liệu | DEC-PII-01 | read projections, RLS | AC-AUTH-003/004 |
| R-OPS-01 Backup/rollout | DEC-OPS-01/02 | runbook, export | AC-OPS-001..004 |
| R-PUBLIC-01 Nội dung có bằng chứng | DEC-CONTENT-01 | public DTO/content gate | AC-PUB-001..004 |

## 3. Acceptance criteria canonical

### Auth/security

- **AC-AUTH-001** — Given public user, when gọi mutation nội bộ, then nhận `UNAUTHENTICATED` và không có side effect.
- **AC-AUTH-002** — Given Member, when cố sửa price/batch/refund/payout, then nhận `FORBIDDEN`.
- **AC-AUTH-003** — Given Member A, when dùng ID order của Member B ở list/detail/mutation, then không đọc hoặc sửa được; detail trả `RESOURCE_NOT_FOUND` hoặc `FORBIDDEN` theo contract thống nhất.
- **AC-AUTH-004** — Export toàn hệ thống chỉ Admin thực hiện được và có audit record.

### Product/content

- **AC-PROD-001** — Seed chỉ có `CBST-300/400/600`; scan canonical/current docs không có 250/300/500g như dữ liệu hiện hành.
- **AC-PROD-002** — Tạo price version mới không đổi order snapshot đã confirm.
- **AC-PROD-003** — Khoảng hiệu lực giá cùng product không chồng nhau.
- **AC-PUB-001** — Public DTO không chứa giá vốn, tồn theo lô, commission, PII hoặc secret.
- **AC-PUB-002** — Khi chưa có kiểm kê, storefront không khẳng định “có hàng sẵn”.
- **AC-PUB-003** — HSD/bảo quản/độ cay/thành phần chỉ xuất hiện trong public copy khi có evidence được duyệt.
- **AC-PUB-004** — Mọi nút/QR Zalo đọc cùng một config và pass test mobile trước production.

### Inventory

- **AC-INV-001** — Given available=1, when hai confirm chạy đồng thời, then đúng một success và một `OUT_OF_STOCK`; tồn/reservation không âm.
- **AC-INV-002** — Retry confirm cùng idempotency key không tạo reservation/order side effect thứ hai.
- **AC-INV-003** — Cancel `CONFIRMED` release đúng reservation một lần.
- **AC-INV-004** — `DELIVERED` consume reservation và ghi đúng một ledger `FULFILL`.
- **AC-INV-005** — Rollback giữa transaction confirm/deliver không để order và stock lệch nhau.
- **AC-INV-006** — Batch hết hạn/quarantine không được reserve.
- **AC-INV-007** — Có HSD khác nhau thì batch gần hết hạn hợp lệ được chọn trước; bằng nhau thì FIFO.
- **AC-INV-008** — Reservation đủ điều kiện hết 24h được release idempotently; đơn đã payment/preparing không bị job tự release.

### Order/payment

- **AC-ORD-001** — Mọi transition ngoài bảng canonical trả `INVALID_STATE_TRANSITION` và không mutate.
- **AC-ORD-002** — Member không sửa item/qty/price/discount/owner sau confirm.
- **AC-ORD-003** — Admin override/reassign yêu cầu reason và tạo audit before/after.
- **AC-ORD-004** — Partial return nhiều SKU điều chỉnh đúng quantity, refund, COGS/ledger và commission.
- **AC-ORD-005** — Hàng trả chỉ `RESTOCK` khi Admin duyệt disposition; mặc định quarantine.
- **AC-ORD-006** — Concurrent update với version cũ trả `VERSION_CONFLICT`.
- **AC-PAY-001** — Delivered nhưng chưa paid không làm commission eligible.
- **AC-PAY-002** — Receipt partial derive `PARTIALLY_PAID`; đủ tiền derive `PAID`.
- **AC-PAY-003** — Refund vượt net receipt bị chặn.
- **AC-PAY-004** — Payment/refund là append-only và retry idempotent.

### Finance/commission

- **AC-FIN-001** — 20 case golden đối chiếu Excel pass, gồm ship khách trả, shop trả, giảm giá, lỗ, partial refund và hoàn sau payout.
- **AC-FIN-002** — Base ≤ 0 tạo commission member = 0 nhưng báo cáo giữ lỗ thật.
- **AC-FIN-003** — Làm tròn ở cấp đơn; owner amount = positive base − member amount.
- **AC-FIN-004** — Order do Owner/Admin trực tiếp phụ trách không tạo commission member giả.
- **AC-FIN-005** — Chi phí member ứng hộ tách hoàn ứng khỏi commission.
- **AC-FIN-006** — Cước nhập đã phân bổ landed cost không bị trừ lần hai trong P&L kỳ.
- **AC-FIN-007** — Payout double-submit tạo đúng một payout.
- **AC-FIN-008** — Refund sau payout tạo adjustment kỳ sau, không sửa payout lịch sử.

### Operations

- **AC-OPS-001** — `lint`, `typecheck`, unit/integration/E2E critical và production build pass trong CI.
- **AC-OPS-002** — Backup production-like được restore thành công vào staging và đối chiếu row counts/checksum chính.
- **AC-OPS-003** — Migration backward-compatible; rollback frontend đã được diễn tập.
- **AC-OPS-004** — Chạy song song Excel 1–2 tuần, chênh tiền/tồn bằng 0 hoặc có adjustment được duyệt trước cut-over.

## 4. Delivery slices theo dependency

| Slice | Deliverable | Gate |
|---|---|---|
| S0 Baseline | Decisions, data dictionary, content audit, env/staging | Docs consistency checks pass |
| S1 Identity | Supabase, migrations, auth, profiles, RLS | AC-AUTH-001..004 |
| S2 Product/inventory | Products, prices, batches, ledger, reserve RPC | AC-PROD + AC-INV |
| S3 Order/payment | Customer, order state machine, payment/cost | AC-ORD + AC-PAY |
| S4 Finance | Commission, payout, export, dashboard | AC-FIN |
| S5 Hardening | Audit, rate limit, backup/restore, E2E, UAT | AC-OPS + go-live gates |

Không xây UI queue/order trước khi API/RLS scope của slice tương ứng có test.

## 5. Readiness gates

### Gate A — Ready for implementation: PASS

- [x] Business baseline có Decision Log duy nhất.
- [x] SKU/quy cách canonical.
- [x] Schema và enum canonical.
- [x] Order/payment/reservation/commission state machines.
- [x] API envelope, stable error codes, authz matrix.
- [x] Acceptance IDs và traceability.
- [x] P0a/P0b scope tách rõ.
- [x] Baseline source/build được ghi nhận.

### Gate B — Ready for staging UAT: chưa đạt

- [ ] Migrations/RLS/RPC đã implement và test.
- [ ] 20 golden finance cases pass.
- [ ] Concurrent inventory tests pass.
- [ ] Mobile E2E critical path pass.
- [ ] Content audit source hiện tại hoàn tất.

### Gate C — Ready for production: chưa đạt

- [ ] Ảnh nhãn ba SKU và nội dung an toàn thực phẩm được duyệt.
- [ ] Kiểm kê tồn đầu kỳ thực tế.
- [ ] Zalo chính thức/QR/config được owner xác nhận.
- [ ] Hosting/gói thương mại được xác nhận.
- [ ] Admin MFA; secrets/PII audit pass.
- [ ] Backup/restore staging pass.
- [ ] Chạy song song Excel và UAT sign-off.

## 6. Definition of Done mỗi feature

Feature chỉ Done khi có: migration/schema; service authorization; RLS; validation; stable error; idempotency/concurrency khi cần; UI loading/empty/error; audit nếu nhạy cảm; unit/integration test; acceptance ID pass; docs cập nhật; staging/mobile review.
