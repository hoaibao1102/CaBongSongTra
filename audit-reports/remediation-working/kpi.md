# KPI/dashboard remediation — BUS-04/05/06/08

## Outcome and boundaries

Source-only remediation plus pure/service-mock unit regressions. Read audit report set and relevant service/models/DTO/repository/tests before editing. No .env read, Mongo connection, AppModule/main/provision bootstrap, Cloudinary request, database test, backfill execution or commit. Parent lifecycle and sibling costing patches preserved through narrow patches only.

- **BUS-04 implemented:** DTO advertises/validates only PRODUCT_QTY; policy creation and calculator throw `KPI_METRIC_UNSUPPORTED` for REVENUE. Existing REVENUE policies fail explicit in settlement (including empty roster) and member progress rather than receiving invented quantity-based revenue calculations. Stored schema retains REVENUE for legacy readability, not new API support.
- **BUS-05 partially implemented:** settlement rejects before endDate with `KPI_PERIOD_NOT_CLOSED`; performance is `[startDate,endDate)` using deliveredAt only. No createdAt proxy for missing recognition event. Member progress selects only currently active half-open periods; no arbitrary OPEN fallback. **Overlap/duplicate-window/stacking rules remain BLOCKED_POLICY_DECISION**, not silently redefined or purportedly concurrency-safe.
- **BUS-06 implemented for new settlements:** all MEMBER records in the transaction's roster (including inactive and zero-bonus members, preserving existing roster eligibility) receive persisted award facts. Only positive bonuses create ledger/balance entries. Period stores versioned immutable embedded policy/tiers/metric/window/roster/results/ledger-reference/total snapshot. Settled preview reads this snapshot only, without policy/users/orders reads. Missing legacy snapshots, missing windows, duplicate snapshot roster, missing positive ledger references or inconsistent total fail `KPI_SETTLEMENT_SNAPSHOT_INCOMPLETE`. No live historical recomputation.
- **BUS-08 implemented:** dashboard separately exposes owner-only `kpiBonusVnd`, sums signed KPI_BONUS accruals once, subtracts them once in netProfit. PAYOUT remains cash/liability settlement only, never another compensation expense. Existing COMMISSION, ledger taxonomy and return policy unchanged. Dashboard is existing lifetime/asOf report, not a newly invented period report.
- **BUS-07/09 untouched:** no clawback/finality/commission-policy decision; no invented KPI reversal kind or migration of historical money.

## Files

- `apps/api/src/v2/service.ts`: dashboard and KPI sections; unused KPI type import cleanup only outside sections.
- `apps/api/src/v2/models.ts`: KPI period snapshot type/schema only; schema field immutable. Initial transactional set explicitly allows immutable initialization and requires OPEN plus absent snapshot; a later settlement cannot overwrite it through this service.
- `apps/api/src/v2/dto.ts`: KPI metric validation/docs only.
- `apps/api/test/remediation-kpi.test.ts`: 11 new service/pure-contract tests.
- `apps/api/test/kpi.test.ts`: existing settlement fixture is closed rather than wall-clock future; now expects complete two-member snapshots and compare-and-set update options. This is compatibility maintenance for the intended new semantics, not weakening the close guard.
- This report and `kpi-*.txt` execution evidence in this directory. Parent-owned `audit-business-invariants.test.ts` not edited by this stream.

## RED → GREEN evidence

All commands executed from `apps/api`, `pnpm exec vitest run ... --maxWorkers=1 --reporter=verbose`.

| Slice | RED evidence | GREEN evidence |
|---|---|---|
| Unsupported metric | `kpi-red-04.txt`: DTO accepts REVENUE, 1 failure | `kpi-green-04.txt`: 1 passed |
| Close/event boundaries | `kpi-red-05.txt`: early settlement resolves, inclusive query, fallback query; 3 failures | `kpi-green-05.txt`: 4 passed |
| Complete snapshots | `kpi-red-06.txt`: zero member omitted and legacy settled recomputed; 2 failures | `kpi-green-06.txt`: 7 passed |
| Expense/progress | `kpi-red-08.txt`: profit 1000 instead of 950 and REVENUE progress accepted; 2 failures | `kpi-green-08.txt`: 9 passed |
| Snapshot/empty-roster safety | `kpi-red-hardening.txt`: malformed history and empty REVENUE roster accepted; 2 failures | `kpi-green-final.txt`: 11 passed |

From snapshot GREEN onward, Vitest ran under parent-provided `NODE_OPTIONS='--require="C:/Users/MSI PC/AppData/Local/hermes/cache/scratch/business-remediation-no-network.cjs"'` guard. Initial RED/GREEN slices used mocks only without that additional guard.

Final regression command: `vitest run test/remediation-kpi.test.ts test/kpi.test.ts test/v2.test.ts test/v2-boundaries.test.ts test/schemas.test.ts --maxWorkers=1 --reporter=verbose` with network guard: **5 files, 40 tests passed, exit 0**; evidence `kpi-regression-green.txt`. Prior compatibility run had 39 pass / 1 expected obsolete future-close fixture failure, retained in `kpi-regression.txt` rather than concealed.

`pnpm exec tsc --noEmit`: exit 0 (`kpi-typecheck.txt`, empty successful output). Targeted eslint for new test/service/models/DTO: exit 0 (`kpi-lint.txt`, empty successful output). Parent owns full project build/full-suite verification.

## Transaction and evidence limits

Award facts, positive KPI ledger entries, shared member balance increments, final OPEN-to-SETTLED CAS/snapshot, audit and idempotency response stay inside the existing repository transaction. A zero-member roster still gets an explicit empty snapshot and metric validation. Existing unique period/member award index remains. Mock tests prove service ordering/output/contracts and a small pure evaluator checks the actual dashboard ledger aggregation expressions; they do **not** prove Mongo aggregation execution, immutable-update casting, document-size limits, transaction rollback, retry/write-conflict behavior, race serialization or index deployment. Database verification remains explicitly NOT RUN. Complete embedded rosters must be capacity-reviewed before deployment (Mongo document size remains a scale limit).

## Compatibility/backfill plan — proposal only, NEVER EXECUTED

1. Obtain explicit approval for overlap/stacking policy, settlement roster eligibility and BUS-07 finality/BUS-09 commission policy independently. Keep overlap release risk BLOCKED_POLICY_DECISION until approved. Decide serialization/index rollout only after those rules exist.
2. Export read-only evidence in a separately authorized offline/reconciliation environment: settled periods, historical policy versions/tiers/windows, roster at settlement, every award and linked KPI_BONUS ledger fact, and idempotency/audit records. Do not infer historical zero-member roster or policy from today's live state.
3. Legacy SETTLED periods without authoritative complete evidence stay unavailable with the explicit snapshot-incomplete error. Never silently re-settle, pay missing bonuses, rewrite ledger, recalculate from current orders, or fabricate missing zero awards. An operator must review and label unresolved history.
4. Produce a dry-run mapping per period, unique roster list, zero results, exact linked positive awards, ledger totals and source provenance. Obtain owner approval for each reconstructed snapshot; preserve prior inclusive boundary semantics as historical provenance rather than silently shifting old awards. Current periods must use exclusive end instants; UI legacy end-of-day values require an approved conversion/communication plan, not an automatic financial backfill.
5. If separately authorized later, use a one-time audited migration with backup, explicit expected-state predicates and reconciliation manifest to add snapshots only when absent, never changing settled ledger/balances. Immutable fields require a tightly controlled migration path; no general API override. Dry run, independent review, rollback plan, then separately approved execution. None performed here.
6. In a separately authorized isolated DB environment, verify transaction atomicity, CAS races/retries, immutable snapshot persistence, BSON size capacity and financial-ledger reconciliation before production certification. No real-DB tests are implied by this report.
