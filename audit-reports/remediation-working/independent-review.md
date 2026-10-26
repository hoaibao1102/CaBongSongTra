# Independent remediation review

## Verdict: changes required

Reviewed tracked remediation diff and the requested untracked actor/retry, costing, KPI and order tests. No source or test edits. No DB connection, network request or `.env` access. All reproductions below use in-memory objects, mocked fetch, or local Mongoose schema casting; **transaction integration is not verified**.

## Blockers

### R1 — High: settlement snapshot cannot cast a real lean policy ObjectId

- `apps/api/src/v2/service.ts:840-847`; embedded schema `apps/api/src/v2/models.ts:315`.
- The policy query includes Mongo `_id`. `structuredClone(policy)` strips the BSON ObjectId prototype, producing `{ buffer: Uint8Array(...) }`. Embedding that clone in `kpiPolicySchema` attempts to cast this object as an ObjectId and fails. The service mocks have no `_id`, so all new settlement tests miss the failure. A real normal policy therefore prevents settlement, including a zero-member period.
- Offline evidence: constructed a policy with the actual Mongoose policy model, cloned its `toObject()` result, and passed it into the actual period model/update. `validateSync()` reported `settlementSnapshot.policy._id: Cast to ObjectId failed`; `updateOne(...)._castUpdate(...)` likewise threw `Cast to ObjectId failed ... because of BSONError`. No query executed.
- Minimal regression: obtain a policy-shaped lean object containing `new mongoose.Types.ObjectId()`; exercise snapshot construction through `settleKpiPeriod`, then cast its captured `$set` with the real period schema without connecting to Mongo. Assert no casting error and preserved policy identity/tiers/dates. Prefer an explicitly selected business-field snapshot or exclude `_id` before cloning; test the actual update casting boundary rather than only `Object.assign` mocks.

### R2 — High: concurrent actor operations can clear uncertainty belonging to another in-flight replay

- `apps/web/lib/commerce.ts:488-518`; hook `apps/web/lib/operation-actor.tsx:7-9`.
- There is no shared per-actor in-flight lock. A second invocation with the identical payload can send the same key while the first is pending; its persisted record is byte-identical. The first invocation retains `retry.uncertain === false`. If that invocation gets a definitive 400/401, `release()` removes the common record even though the second invocation is still in flight and could commit. Edited submission then receives a new key and is dispatched instead of failing closed. The React hook creates separate mutation functions on every render, so a closure-local guard alone would not coordinate all consumers/remounts.
- Offline mock-fetch reproduction: start A for expense amount 1, wait for dispatch; start B with the same actor/path/payload, wait for dispatch; resolve A with JSON 401 `SESSION_INVALID`, leave B pending; storage becomes empty; invoke amount 2. Fetch receives all three calls, with keys `[K, K, NEW_K]` and bodies `[1,1,2]` while B remains unresolved. This violates the intended unresolved-operation fence. A 401 can be followed by another successful request after session refresh; 400 responses can also differ between concurrent requests.
- Minimal regression: deferred promises for the above schedule across two distinct `createMutation` instances, assert either B is blocked before fetch or C cannot dispatch until B is resolved. Also cover component rerender/remount and actor A/B separation. Coordinate in-flight ownership across the actor boundary, and do not permit a first-attempt rejection to release a record shared by an unresolved replay.

### R3 — High: shipped-cancellation reconciliation fence is bypassable through a workflow-only status

- `apps/api/src/v2/service.ts:293-300,326-327`.
- The cancellation fence examines only the immediate `from === "CANCELLED"`. A shipped cancelled order with no physical returns can transition to `RETURN_REQUESTED` (not in `reactivating`) and then `SHIPPING` or `DELIVERED`; the second transition no longer sees cancellation. The root reconciliation condition is therefore erased by a normal status update. No actual reconciliation is required and no new outbound is recorded.
- Offline service reproduction with `shippedAt`, zero returned quantities, status CANCELLED: both `CANCELLED -> RETURN_REQUESTED` and `RETURN_REQUESTED -> SHIPPING` were accepted (versions 1 and 2).
- Minimal regression: start a shipped CANCELLED order and attempt reactivation through each allowed non-reactivating intermediate status (at least RETURN_REQUESTED and RETURNED), with fresh expected versions/keys. Assert a reconciliation error before save/ledger/inventory side effects. Persist a historical reconciliation requirement or prevent the intermediate escape; do not rely only on the current status.

## Tests and cost-conservation observations

- Latest focused rerun: API `bus03-costing`, `remediation-kpi`, `business-order-remediation`: **3 files, 30 tests passed**. Web `financial-retry`: **1 file, 11 tests passed**.
- Earlier run caught a moving-worktree mismatch: the costing test had already changed to require `ZERO_VALUE_FREIGHT_ALLOCATION_POLICY_REQUIRED`, while the source still distributed free-goods freight by quantity. On reread the source had been updated to reject that case; the latest rerun passed. This reviewer did not change either file. The worktree was being edited concurrently, so this report is not a frozen-commit certification.
- Integer-cost receipt splitting conserves the tested receipt freight, batch value and quantities; partial outbound/restock preserves the tested combined inventory value plus COGS. No additional concrete cost-conservation blocker established in the bounded DTO cases inspected. Zero-value freight is now explicitly blocked rather than silently selecting a policy.
- Financial tests cover storage corruption/failure, actor namespace separation, lost-response replay and uncertainty on later error, but omit concurrent identical invocations. Their source-string assertions do not prove React context/rerender lifecycle behavior.
- KPI tests cover frozen zero-result roster, historical windows and unsupported metrics, but their plain-object policy and update mocks bypass Mongoose casting and cannot establish persistence or transaction rollback.
- Order tests cover direct cancellation and physical-return reactivation, but omit multi-step status laundering.

## Scope boundaries

BUS07 clawback, BUS09 commission policy and overlapping-period stacking remain blocked business decisions; this review does not authorize policy choices. Baseline MFA/API failures and existing lint errors are outside this review. No transaction, replica-set concurrency, durable ledger atomicity, browser multi-tab authentication behavior or live integration claim is made.
