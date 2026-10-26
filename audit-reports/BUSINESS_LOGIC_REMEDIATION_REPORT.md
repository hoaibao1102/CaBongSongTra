# BUSINESS_LOGIC_REMEDIATION_REPORT

## Scope và kết luận
Đã triển khai source fixes, unit/regression tests theo RED→GREEN. **Không kết nối, không chạy test trên database thật của người dùng.** Không Mongo replica-set integration, browser E2E, production deployment/data migration, provisioning hoặc rewrite financial ledger. Các lượt regression/build cuối chạy dưới Node preload guard chặn TCP/TLS/DNS/real fetch; disconnected Mongoose schema casting không execute query. Build tự đọc .env.local theo Next nhưng không xuất secret và network bị chặn. Node26.7.0/pnpm10.18.3 khác CI Node22, chưa chứng nhận parity.

Trạng thái FIXED_UNIT_VERIFIED chỉ có nghĩa logic source được unit/mock/offline-schema tests kiểm chứng, **không** có nghĩa Mongo transaction/concurrency/durability an toàn. Không chứng nhận production-ready.

## Business invariants
1. Physical returns và shipment/cancellation facts không bị xóa bằng status correction; resend không thể giả bằng trạng thái.
2. First deliveredAt bất biến trong cùng fulfillment, không chuyển KPI bucket do correction.
3. Tổng cost receipt = tổng quantity × integer batch cost; returned COGS đảo đúng original allocation; không bỏ phần dư.
4. Unsupported KPI metric không được âm thầm dùng công thức khác; chốt chỉ sau end và window [start,end).
5. SETTLED historical view chỉ dùng complete frozen policy/window/roster/results/ledger-reference snapshot, bao gồm zero members.
6. KPI accrued compensation trừ profit đúng một lần; PAYOUT chỉ thanh toán liability/cash, không expense lần hai.
7. Ambiguous operation giữ key/fingerprint/actor scope qua reload/remount; edited operation không tạo key mới; concurrent replay không xóa fence của attempt khác.
8. Không tự quyết BUS07/BUS09, overlap stacking hoặc all-zero freight allocation policy; không sửa ledger cũ.

## Finding-by-finding remediation

| Finding | Root cause / invariant | Code và regression | Module impact / compatibility | Status |
|---|---|---|---|---|
| BUS-01 | Status mutable thay physical facts; shipped cancellation guard chỉ nhìn immediate status | CommerceService.transition guards returnedQty/prefulfillment; optional shippedCancellationAt persisted; 18 order tests +33 workflow tests, 51 PASS | New 409 codes; resend cần separate order/fulfillment; giữ return inspection. Optional schema field, historical laundering cần reconciliation riêng | FIXED_UNIT_VERIFIED; DB persistence PENDING_INTEGRATION_VERIFICATION |
| BUS-02 | deliveredAt overwritten mỗi lần DELIVERED | Set only when absent; correction/no-op/retry tests | Không schema đổi; KPI giữ first-recognition date; không phục hồi dates lịch sử bằng suy đoán | FIXED_UNIT_VERIFIED |
| BUS-03 positive subtotal | Floor unit freight bỏ remainder | Split receipt input thành tối đa 2 integer floor/ceil cost buckets + matching receipt items; bus03-costing 5 tests, partial outbound/restock exact conservation | Output items có thể gấp đôi input; batch IDs/lot trace riêng; existing cost allocations unchanged; web preview helper cùng bucket math, 4 tests | FIXED_UNIT_VERIFIED |
| BUS-03 all-zero subtotal + positive freight | Value allocation không có basis được phê duyệt | ZERO_VALUE_FREIGHT_ALLOCATION_POLICY_REQUIRED trước mọi write; preview chặn submit; zero freight/free goods vẫn hợp lệ | Không tự mặc định quantity/weight policy; alternatives bên dưới | BLOCKED_POLICY_DECISION (fail-closed guard unit verified) |
| BUS-04 | metric được lưu nhưng engine bỏ qua | DTO create chỉ PRODUCT_QTY; service/calculator/member progress/settlement reject legacy REVENUE KPI_METRIC_UNSUPPORTED | Intentional rejection thay sai formula; stored schema giữ legacy readability; không migrate policies | FIXED_UNIT_VERIFIED |
| BUS-05 close/window | Thiếu time guard, inclusive end và arbitrary period fallback | Reject KPI_PERIOD_NOT_CLOSED; deliveredAt-only [start,end); remove future fallback; remediation-kpi suite | API end instant exclusive, cần communication/approved legacy boundary plan; no createdAt substitute | FIXED_UNIT_VERIFIED cho guards; overlap/stacking BLOCKED_POLICY_DECISION |
| BUS-06 | Chỉ award dương làm snapshot; zero/missing lấy live orders/roster | Version1 immutable embedded settlementSnapshot, zero awards, complete roster/policy/window/total, OPEN CAS; settled preview no live reads; missing legacy snapshot explicit 409 | Optional schema addition; legacy settled view unavailable until approved evidence reconstruction, không fabricate history; embedded roster capacity unverified | FIXED_UNIT_VERIFIED; persistence/CAS PENDING_INTEGRATION_VERIFICATION |
| BUS-08 | KPI_BONUS thiếu trong profit taxonomy | Owner dashboard kpiBonusVnd signed accrual aggregation trừ một lần; payout cash only; expression-contract tests | Additive owner field, corrected lifetime profit; no historical ledger rewrite | FIXED_UNIT_VERIFIED; actual aggregation PENDING_INTEGRATION_VERIFICATION |
| FE-01 | UI discard unresolved checkout xóa identity | Remove discard/helper; retain uncertainty on later server rejection; storage validation/readback | Existing checkout slots retained; unreconstructable payload needs operational reconciliation, no unsafe clear escape | FIXED_UNIT_VERIFIED trong tab/reload scope |
| FE-02 | Mutation RAM/body-key, unscoped managers; concurrent cleanup race | Actor context across ActionForm/managers; salted fingerprints/key sessionStorage no private payload; per-dispatch ownership token; deferred 400/401 replay tests | One unresolved generic write blocks actor writes in tab; auth login/reset excluded; no distributed cross-tab/device guarantee | FIXED_UNIT_VERIFIED trong documented client scope; end-to-end PENDING_INTEGRATION_VERIFICATION |
| BUS-07 | KPI bonus finality/clawback chưa định nghĩa | Không thay return→bonus policy/ledger | Decide immutable earned closed bonus vs append-only negative adjustment/debt after return/payout | BLOCKED_POLICY_DECISION |
| BUS-09 | Commission implementation/tests và V2.2 acceptance trái nhau | commissionTarget unchanged; characterization giữ explicit | Decide margin-based delivered eligibility vs collected/finalized/net-profit/refund-due contract; cần liability/backfill plan nếu đổi | BLOCKED_POLICY_DECISION |

## Independent review và corrective RED→GREEN
Review `remediation-working/independent-review.md` yêu cầu 3 corrections, không coi review ban đầu PASS.
- R1 BSON ObjectId structuredClone prototype loss: test thực actual disconnected Mongoose update cast đỏ, fix explicit business-field policy snapshot (tiers/dates copy) không Mongo metadata; xanh. `review-r1-kpi-casting.test.ts` xác nhận schema/update casting, không DB persist.
- R2 concurrent identical operations: deferred A400/401 trong khi replay B pending từng cho C edited/new key; per-dispatch attempt token giữ ownership của record nên A không xóa B. `review-r2-concurrent-retry.test.ts` xanh 2 schedules.
- R3 CANCELLED→RETURN_REQUESTED/RETURNED/PARTIALLY_RETURNED→SHIPPING: 4 new failing tests trước fix; optional shippedCancellationAt giữ fact qua status; 51 order/workflow PASS sau fix. Schema field không immutable at Mongoose vì normal update cần initialize; application không xóa/overwrite. Direct DB writes không được chứng nhận.
Evidence review-fixes.md, r1/r2 red-green logs và remediation-evidence/orders-review-red/green.json. Parent reran full suite và focused 19 review/order tests sau cleanup mới nhất.

## Test results cuối
| Gate | Kết quả | Evidence |
|---|---|---|
| API full unit/mock suite | 233 PASS, 2 FAIL /235; 27 files | remediation-evidence/final-api.json |
| Web full unit/mock suite | 184 PASS /184; 21 files | remediation-evidence/final-web.json |
| Typecheck API+web | PASS | final-typecheck.json |
| Build API+web | PASS | final-build.json |
| API lint | FAIL 1 baseline explicit any tại test/kpi.test.ts:129 | api-lint-confirmed.json |
| Web lint | FAIL 7 baseline unused declarations | final-web-lint.json |
| Review/order focused sau final cleanup | 19 PASS | review-final.json |
| git diff --check | PASS | command output verified |

Total **417 PASS, 2 FAIL, 419 tests**. Hai failures là production Owner MFA gate đã có trước remediation (owner-blockers.test.ts:71,77); auth source không thuộc business fixes lần này, không disable hoặc đổi mong đợi test để xanh. Lint hiện còn 8 baseline errors, không tăng lỗi mới; ba unused service declarations đã được cleanup khi sửa KPI. Những lỗi any/unused mới trong audit tests đã sửa, rerun targeted và final lint xác nhận. Logs intermediate failures được giữ, không thay thế final verdict. Full pnpm verify vẫn không PASS vì baseline lint/MFA, build riêng PASS không có nghĩa verify PASS.

## Policy decisions cần người dùng duyệt
- BUS07: (A) finality tại close, không clawback nhưng phải document bonus retained dù return; (B) net-of-return bonus append-only adjustment, debt sau payout; (C) maturity/return-window trước eligible settle. Không chọn thay user.
- BUS09: (A) giữ margin-on-delivery và sửa acceptance; (B) paid+finalized+refund-due gate/net profit theo V2.2, với reconciliation liabilities; không tự trừ direct costs hoặc thu hồi payout.
- BUS05 overlap: allow explicit stacking vs prohibit same-policy overlapping windows; scope uniqueness/serialization và handling existing periods cần approval, chưa thay.
- BUS03 zero-value freight: quantity weighting, actual weight/volume hoặc explicit per-line allocation. Current DTO không có approved basis nên reject an toàn, không drop cost. Mixed paid/free value weighting hiện giữ nguyên contract hiện có.

## Compatibility / migration-backfill proposal ONLY — NOT EXECUTED
1. Optional order.shippedCancellationAt: new cancels/observed shipped CANCELLED ghi marker; records đã laundered trước patch không có authoritative marker, cần review audit/movement/history. Không default infer từ status khác. Old code rollback có thể không enforce field nên cần release compatibility review.
2. First deliveredAt lịch sử overwrite không phục hồi từ createdAt; dry-run authoritative delivery/audit events và owner signoff trước correction.
3. Cost bucket splitting prospective only, schema không đổi; old idempotency snapshots replay giữ nguyên. Old consumed/reserved/returned batch cost không rewrite. Dry-run receipt freight vs items/batch original quantities + COGS/returns; ambiguous depletion phải manual finance decision.
4. KPI snapshot optional schema addition, new settlements only. Legacy settled missing snapshot fail explicit; reconstruct từ historic policy/roster/award/ledger evidence, không live recompute hoặc re-settle. Expand-contract rollout, expected-state predicates/manifest/rollback phải được duyệt riêng. End-exclusive dates không silently convert legacy windows.
5. Unsupported REVENUE policy giữ stored readability nhưng evaluation fail; muốn hỗ trợ phải approve threshold units/net revenue/discount/refund rules trước implementation.
6. SessionStorage journals tab-scoped, không plaintext payload. Browser tab close/loss, manual clearing, new tab/device hoặc actor khác có thể bypass client-only durability; no exactly-once global business intent guarantee. Original payload mất thì giữ blocked và reconcile authoritative records, chưa có server lookup/resolution endpoint. Blank payout reference stable MANUAL-PAYOUT chỉ retry stability, không unique bank-reference contract.
7. Không backfill/migration được chạy, không ledger deletion/update hoặc production config/deploy. Operational safety/infrastructure vẫn ngoài scope.

## Follow-up integration
Xem `INTEGRATION_TESTS_NEXT_PHASE.md`: isolated test replica set only, last-unit/concurrent payouts, all-or-nothing failure injection, uncertain commit replay, snapshot actual persistence/CAS, real aggregation, integer costing/readback, API lost-response/client journal. **Tất cả NOT RUN**; tuyệt đối không dùng database thật của user.

## Artifacts và source review scope
Detailed group reports ở remediation-working/orders.md, kpi.md, preview.md, review-fixes.md. Original worker costing/frontend reports ở project-root remediation-working/; mọi mô tả quantity-default freight trong evidence cũ đã bị superseded bởi policy reject ở báo cáo này. Old audit reports là baseline snapshot, không chứng nhận trạng thái sau sửa. No commits.
