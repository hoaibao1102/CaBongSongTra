# FE-01 / FE-02 remediation

## Outcome
- Removed internal-checkout discard action and exported clearCheckoutRetry helper; ambiguous checkout cannot be replaced by editing, closing/remounting or reloading. Null/corrupt retry state fails closed. A later rejection after an ambiguous checkout no longer clears its identity.
- Generic mutations now require authenticated actor scope except login/reset-password. Actor-scoped durable sessionStorage journal stores salted SHA-256 request fingerprint, random key and uncertainty marker only, not request bodies, passwords, names, addresses, bank info or other PII payload.
- Same canonical payload/method/path/actor replays the same key across remount/reload. Any different operation for an actor is blocked until original succeeds or an initial definitive rejection is observed. Storage read/write/corruption failures block transport.
- React OperationActorContext wraps both Admin entry paths, keyed by actor ID. ActionForm, leaderboard recalculation and all six mutation managers consume useActorMutation. No manager module singleton shares operation identity between accounts. Missing provider fails closed. Login/reset remain in-memory and outside financial journal.
- Manager generic failures expose recovery guidance. Payout blank reference is deterministic MANUAL-PAYOUT rather than Date.now() on each retry.
- audit-frontend FE-01/02 characterization assertions converted to safety invariants only after observed RED. Other findings unchanged. Existing commerce tests retain same-key retry/guest headers and now assert edit blocking rather than permitting multiple ambiguous payloads.

## Executed evidence
- frontend-red-01.log: lost-response edit incorrectly reached transport (expected reconciliation rejection); exit 1. frontend-green-01.log: first durable-operation slice passes.
- frontend-red-02.log: actual UI escape hatch + unscoped manager wiring caught. Initial frontend-green-02.log is deliberately retained as a failed intermediate run: helper removal tool timed out. Corrected before final suite.
- frontend-red-03.log: checkout later rejection erased identity; helper removal still outstanding. Fixed conservative retention and removed helper.
- frontend-red-04.log: unscoped non-auth mutation reached transport; then fail-closed enforcement.
- frontend-red-05.log: null checkout storage replaced and operation recovery guidance absent; then fixed.
- frontend-red-06.log: manager recovery guidance absent; then fixed along with nondeterministic blank payout reference.
- Final frontend-green-all.log: 19 files, 178 tests PASS; mocked transport only.
- frontend-typecheck.log: web typecheck PASS.
- frontend-target-lint.log: targeted changed-file lint PASS (CommissionManager excluded due existing unused declarations).
- frontend-lint.log: full web lint remains blocked by seven unused-declaration errors in CommissionManager and MemberCommissions. Not suppressed or disabled; parent owns other overlapping fixes.

## Compatibility / policy / recovery limitations
- Conservative policy: a first parsed 4xx rejection other than 408/409/425/429 may release a generic operation; network loss, malformed response, 5xx, conflict/throttle/timeout retain it. Once an attempt is uncertain, even a later parsed rejection does not prove that earlier attempts or server retries did not commit: only successful same-key replay releases it. Checkout allows first explicit stale-price rejection, retaining original pricing guard otherwise.
- One unresolved generic operation blocks ALL generic writes for that actor in the tab, intentionally not merely one endpoint. This is safer but can block unrelated administrative work. Other actors have independent journals, not permission to repeat the same underlying business transaction under another account.
- sessionStorage durability is tab/remount/reload scope, not browser/device/global-account coordination; new tabs, storage deletion, browser crashes losing session data or another device cannot be made duplicate-safe by this client journal. No backend lookup/resolve contract introduced, no journal TTL or user clear escape hatch. Existing backend same-key idempotency remains required, and no DB behavior is certified here.
- Recovery: retain the original tab/account and reconstruct exact original request (including expectedVersion and optional fields) to replay the same key. No private payload is stored for automatic recovery. If data cannot be reconstructed, operator must reconcile against authoritative existing order/ledger/inventory records; unresolved state remains blocked. No automated reconciliation/override is claimed. Do not delete session data, change account or generate a new key as recovery. A definitive operational reconciliation workflow needs separate reviewed backend/client contract if later required.
- Persisting journal is compare-before-write/readback guarded within a tab's synchronous storage after asynchronous hashing. This is not a distributed lock and does not claim atomic cross-tab storage transactions.
- Initial validation errors from older/intermediary infrastructure may not guarantee noncommit beyond the API's stated rejection contract. After any prior uncertainty we retain the journal regardless. No client-only guarantee can cover arbitrary proxy semantics.
- Blank payout references now use MANUAL-PAYOUT for replay stability; reference is not a globally unique business-reference guarantee and operators should enter the real reference. Same payload after confirmed success is a new operation by design.
- Existing pre-remediation generic mutations had in-memory keys only: lost historical keys cannot be reconstructed. New state uses cbst-operation-v1 actor-hash slots; existing checkout slots/records preserved and treated conservatively.
- No .env read, real network/account/Cloudinary/DB calls, E2E, deployment/config changes or commits. Source ownership limited to web; sibling API edits belong to parent/other agents.
