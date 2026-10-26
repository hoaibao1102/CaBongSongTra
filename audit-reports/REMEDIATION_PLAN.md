# Remediation Plan

## Change policy
Audit này chỉ thêm reports và 19 characterization tests; **không sửa source production, API contract, database hay cấu hình**. Các sửa chính ảnh hưởng availability/auth, historical money/stock, idempotency protocol hoặc policy nên cần phê duyệt. Không chạy migration, delete dữ liệu, provisioning, dependency auto-fix hoặc deployment. Cleanup lint là việc còn mở, không coi đã giải quyết.

## P0 — Không deploy trước khi xử lý
| Finding | Hành động root cause | Tác động cần phê duyệt | Acceptance |
|---|---|---|---|
| AUTH-01 | Production Owner MFA thật hoặc fail-closed cả login/session | Fail-closed khi chưa MFA làm Owner không dùng được | 2 failing tests xanh + HTTPS personas |
| BUS-01/02 | Tách physical facts khỏi status correction, canonical delivery event | Chặn workflow cũ; historical reporting/backfill | Return→redeliver không sai outbound/date/KPI |
| BUS-04/05/06 | Reject unsupported metric hoặc calculator đúng; close-window guard; complete immutable settlement snapshot | API behavior, award schema/history | Future close blocked, metric correctness, settled ledger=preview |
| BUS-08 | Recognize KPI accrued expense đúng một lần | Profit definition/report history | Settle giảm profit, payout không expense lần hai |
| FE-01/02 | Durable unresolved operation record + reconciliation, không xóa identity tùy ý | Client storage + lookup contract/privacy | Commit-timeout/edit/reload không double intent |
| DEP-01 | Controlled patched dependency/lockfile upgrade | Compatibility/build/deploy regression | Frozen install + audit/exposure review + tests/build |
| BUS-07/09 | Owner chốt KPI finality/clawback và commission authority | Liability, payouts, possible reconciliation/backfill | Decision log + acceptance matrix trước code |

## P1 — Correctness/security/operations trước go-live
- BUS-03: exact cost conservation, bao gồm zero purchase cost/shipping remainder. Đổi cost representation cần migration read-only assessment và owner approval; không vá bằng price rounding bỏ dư.
- SEC-01/02: network/route quota từ trusted ingress, precheck token trước KDF, atomic consume sau KDF; test concurrency và hash budget. Không tin X-Forwarded-For tùy ý.
- SEC-03: runtime value DTO imports, nested DTO limits/allowlist, scalar query boundary; test malformed payload 400 và valid sync. Không disable guard.
- FE-03/05: resource key factories và invalidation dependency graph; 2 ORDER expenses liên tiếp dùng version mới.
- FE-04: backend pagination/search/query chọn order độc lập dashboard; dataset 101/201 bản ghi.
- FE-06/07: accessible select/dialog primitive, keyboard/focus/unique title IDs; browser test, không chỉ render snapshots.
- QC-01: sửa 11 lint errors đúng bản chất, giữ rules/tests; full pnpm verify Node22.
- Release infrastructure: isolated replica set test DB, index validation, auth personas, backup/restore drill, secrets/ACL/network policy, monitoring/alerts, Owner+Member UAT.

## P2 — Refactor/hardening có giới hạn
SEC-04 bỏ implicit trusted deployment host trước đổi domain; FE-08 align SKU form; FE-09 split client entry/dynamic manager chunks, budget đo trên cùng build. Hợp nhất API bootstrap, tách pricing/order/inventory/finance/KPI services giữ transactional coordinator; không tự chọn microservices. Batch KPI queries; structured logging/redaction/request correlation, readiness, upload deadlines/quotas.

## Rollout/regression
1. Chốt source-of-truth requirements và các policy decisions; backup branch/snapshot, baseline output có sẵn trong evidence.
2. Mỗi fix: desired-invariant test đỏ → minimal fix → focused test xanh → full suite/typecheck/lint/build; characterization tests phải được chuyển assertions khi bug được sửa, không chỉ xóa test.
3. Staging DB cô lập: last-unit stock/voucher/counter, payment/return/payout race, fault injection sau stock trước ledger, duplicate key payload conflict, uncertain commit replay. Kiểm read-back state/counts/sums thực.
4. Data-sensitive changes: read-only reconciliation export trước; expand-contract/backfill có dry-run, owner-approved rollback; không rewrite ledger cũ.
5. Production gate chỉ mở khi auth/MFA, financial/stock invariants, dependency review, UAT và restore/monitoring có evidence. Chưa có timeline/owner assignment được người dùng phê duyệt.
