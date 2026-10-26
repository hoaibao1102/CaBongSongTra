# Independent review fixes — R1 and R2

## Outcome

- R1 fixed: settlement snapshots explicitly copy KPI business fields (`id`, name, period type, metric, active flag, tier min/bonus values, and copied creation/update dates). Mongo `_id`/metadata is not cloned into the snapshot.
- R2 fixed: every dispatch writes a fresh random durable `attempt` ownership token while preserving the original idempotency key/fingerprint. The existing compare-before-remove cleanup now cannot erase a newer replay's record. Legacy records without an attempt remain readable; malformed attempt values fail closed. No actor identifier, path or payload is added to storage.
- No DB connection, network request, `.env` read, app bootstrap, policy decision or commit. BUS07/BUS09/overlap/free-freight policy untouched. Parent owns R3; no lifecycle changes made by this worker.

## Strict test-first evidence

All Node commands used:

`NODE_OPTIONS='--require="C:/Users/MSI PC/AppData/Local/hermes/cache/scratch/business-remediation-no-network.cjs"'`

Commands ran in the respective `apps/api` or `apps/web` directory using the installed local Vitest/TypeScript, not a package download.

### R1 RED → GREEN

1. Added `apps/api/test/review-r1-kpi-casting.test.ts` before changing snapshot code.
2. RED: `node node_modules/vitest/vitest.mjs run test/review-r1-kpi-casting.test.ts` exited 1: actual period update `_castUpdate` threw `Cast to ObjectId failed ... because of BSONError` (see `r1-red.log`).
3. Replaced only `structuredClone(policy)` snapshot construction in `service.ts` with selected business fields.
4. GREEN: new casting test plus `remediation-kpi.test.ts`: **2 files, 12 tests passed** (`r1-green.log`).

The test creates a disconnected Mongoose instance and actual policy/period models from production schemas. The policy's `toObject()` includes a real BSON ObjectId. The service runs against in-memory dependency doubles, and its captured `$set` is cast synchronously by the actual period model without executing a query. `overwriteImmutable: true` is used only on the nonexecuted test query so casting cannot silently omit the immutable snapshot. It also validates an actual period document synchronously, asserts snapshot business identity/tiers/dates/window/zero-member roster, and verifies tier/date mutation isolation.

During GREEN verification, the test initially checked absence of `_id` after Mongoose casting had mutated the captured update and supplied its own embedded ObjectId default. The assertion was moved before casting, keeping the intended service-boundary assertion. This does not suppress or weaken the original RED casting assertion.

### R2 RED → GREEN

1. Added `apps/web/lib/review-r2-concurrent-retry.test.ts` before changing retry behavior.
2. RED: `node node_modules/vitest/vitest.mjs run lib/review-r2-concurrent-retry.test.ts` exited 1: **both 400 and 401 schedules incorrectly dispatched/resolved an edited third request** instead of rejecting (`r2-red.log`).
3. Added the per-dispatch durable ownership token in `commerce.ts`; no closure-local locking or hook changes.
4. GREEN: new deferred tests plus existing `financial-retry.test.ts` and `commerce.test.ts`: **3 files, 45 tests passed** (`r2-green.log`).

Deferred mock responses enforce: A dispatches; B dispatches identical payload from a new `createMutation` instance; A rejects definitively while B stays pending; edited C must not dispatch. Tests verify same-key replay, a changed ownership record, privacy of persisted state, independent other-actor success, and cleanup/new-key submission once B succeeds. Fresh mutation instances exercise the render/remount reconstruction boundary, not an actual React renderer. During GREEN verification a mock reused a consumed `Response`; it was corrected to create a fresh response per call.

## Final regression verification

- API command: `node node_modules/vitest/vitest.mjs run test/review-r1-kpi-casting.test.ts test/remediation-kpi.test.ts test/kpi.test.ts test/bus03-costing.test.ts test/business-order-remediation.test.ts` — **5 files, 41 tests passed**, exit 0 (`review-api-regression.log`). This includes parent-owned tests in the moving worktree, not a frozen commit certification.
- Web command above — **3 files, 45 tests passed**, exit 0 (`r2-green.log`).
- Both app directories: `node ../../node_modules/typescript/bin/tsc --noEmit` — exit 0 (`review-api-typecheck.log`, `review-web-typecheck.log`). Initial API invocation used an absent app-local TypeScript path, then reran against the installed root package. Initial web typecheck found a test-only unknown-value access; changed that assertion to `toMatchObject` and reran successfully.
- `git diff --check -- apps/api/src/v2/service.ts apps/web/lib/commerce.ts` — exit 0.

## Files owned by this fix

- Modified only the KPI snapshot block in `apps/api/src/v2/service.ts` (shared file, targeted patch).
- Modified only durable retry state/ownership in `apps/web/lib/commerce.ts` (targeted patches).
- Added `apps/api/test/review-r1-kpi-casting.test.ts`.
- Added `apps/web/lib/review-r2-concurrent-retry.test.ts`.
- Added this report and the named verification logs under `audit-reports/remediation-working/`.

No claim of Mongo transaction durability, replica-set races, live integration, actual React lifecycle rendering or browser cross-tab synchronization. Existing unrelated working-tree changes were preserved.
