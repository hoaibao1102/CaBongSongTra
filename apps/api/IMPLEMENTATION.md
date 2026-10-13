# V2 API Implementation

Canonical interpretation: Decision Log V2, then SRS V2. FEFO precedes FIFO;
reservation occurs at CONFIRMED, physical stock-out at SHIPPING, recognition at
DELIVERED. No database or external credentials were used during implementation.

## Runtime

- Required: `MONGODB_URI` (replica set), `SESSION_SECRET` (32+ characters),
  `CORS_ALLOWED_ORIGINS` (comma-separated exact browser/BFF origins).
- All routes use `/api/v1`. Liveness is `/api/v1/health/live`.
- `PUBLIC_CHECKOUT_ENABLED` defaults to disabled. Enable only after replica-set
  concurrency, rollback, indexes and operational acceptance gates pass.
- Mutations require JSON and an allowlisted `Origin`. Business mutations require
  `Idempotency-Key` containing 16-128 alphanumeric, underscore or hyphen characters.
- Guest checkout additionally requires `X-Guest-Session`, a client-generated
  cryptographically random 32-128 character base64url identifier. It scopes retries,
  not authorization; the response contains no customer PII.
- Session cookie: `cbst_session`, Secure, HttpOnly, SameSite Strict, path `/api/v1`.
  Use HTTPS and a same-origin BFF that forwards Origin, cookies and Set-Cookie.
- Proxy IP headers are not trusted by default. Configure a deployment-specific
  trusted proxy before relying on per-client IP limits behind a reverse proxy.
- No automatic production seeds. After building, run `node dist/src/provision-cli.js`
  explicitly with `PROVISION_CONFIRM=CREATE_FIRST_OWNER`, `PROVISION_EMAIL`,
  `PROVISION_PASSWORD`, `PROVISION_NAME` and `MONGODB_URI` supplied securely through
  the process environment, not command-line password arguments. The CLI validates
  inputs before connecting, initializes required indexes, refuses an existing Owner,
  creates the singleton Owner and inserts only missing approved products in one
  transaction. It never seeds inventory/costs or overwrites existing product prices.
  The CLI was built and unit-tested but was NOT run against a database.
- Run `pnpm build`, then `pnpm start` from this directory. Swagger is exposed only
  outside production; full OpenAPI response-schema conformance remains outstanding.

## Implemented

- API-local domain types, FEFO, payment status and integer commission rules;
  shared contract dependency and TypeScript path alias removed.
- Mongoose repositories for users, sessions, products, orders, inventory batches,
  movements, financial ledger, commission balances, audit, idempotency and rates.
- Database-backed catalog and owner price updates; server-side checkout pricing.
- Opaque HMAC-hashed sessions, Argon2id passwords, idle/absolute expiry, logout,
  session rotation at login, inactive-user checks and transactional member disabling.
- Strict nested class-validator DTOs; no implicit numeric coercion; bounded lists,
  request keys, quantities, money and text; no raw client Mongo queries.
- Owner/member guards, ownership predicates in order queries, explicit response
  projections including nested item/customer fields, no member COGS/global finance.
- Guest/internal PENDING orders, scoped list/detail, versioned transitions,
  FEFO reservations, cancellation release, shipping safety checks and stock-out.
- Transactions include business mutations, movements, ledger, audit and replay
  records. Keys are actor/operation scoped, payload-bound, unique and non-expiring.
  A duplicate-key race rechecks the committed replay record.
- Receipt quarantine for missing expiry/label; append-only movement routes;
  negative adjustments cannot consume reserved stock. Positive adjustments fail
  closed until a proper inspected return-intake workflow is available.
- Payments/refunds, ORDER/OVERHEAD cash expenses, explicit cost finalization,
  commission accrual/clawbacks and owner payouts. Payouts and adjustments contend
  on a common member balance document in the transaction; debt remains negative
  after a clawback against an already-paid commission.
- Owner audit/list routes, scoped commissions, basic aggregate dashboards.
- Persistent Mongo-backed login IP/account and checkout IP rate counters;
  Origin enforcement, Helmet, no-store headers and sanitized error responses.

## Important Semantics

- PENDING is an order request, not a stock reservation. Stock is checked at
  checkout and reserved atomically at confirmation; confirmation can fail for a
  later request competing for the final unit.
- Delivery never records a payment. COD_SETTLEMENT means actual shop receipt,
  not money still held by a courier.
- Commission is pending until delivered, fully received and costs finalized.
  Rate is snapshotted at 4000 basis points. Owner/guest direct orders accrue none.
- Return workflow states do not silently restore stock or refund money. Owner-only
  `POST /orders/:id/returns` requires inspection evidence, batch quantities and a
  RESTOCK/DISCARD decision. Cumulative returned quantities cannot exceed shipped
  allocations. Restocking requires an available, labelled, unexpired original batch;
  discarded goods do not restore stock or reverse COGS. Direct transitions to
  PARTIALLY_RETURNED/RETURNED are blocked; intake derives those states.
- Intake appends RETURN_CREDIT and (for restocked goods) COGS_REVERSAL entries using
  historical price/cost snapshots. Cash refund remains separate. Set refund
  `purpose=RETURN` to settle issued return credit without double-reducing revenue;
  omitted purpose remains GOODWILL for the previously shipped refund behavior.
  Commission remains suspended while return cash obligations are unresolved and
  resumes on eligible retained profit after settlement. Previously paid commission
  is adjusted by append-only accrual/clawback entries, never by deleting payouts.
- If a return overlaps prior goodwill refunds, intake appends a non-cash
  REFUND_RECLASSIFICATION entry for the overlap and increases returnRefundsVnd.
  Original refunds are never edited, cash totals do not change, and merchandise
  credit no longer double-reduces revenue or blocks full physical return.
- Financial history is one discriminated append-only `financialLedger` collection,
  not separate collections per entry kind. Commission balance is a transactional
  concurrency projection; entries remain the accounting source.
- Dashboard cash is explicitly *operating cash movement*, not bank balance: opening
  balances, stock purchase disbursements and courier-held cash are not modeled.
- Records have no edit/delete ledger or audit HTTP routes. Database privileges
  must also prevent unauthorized direct journal mutation in deployment.

## Remaining Work / Not Production Ready

- Real replica-set transaction, concurrency, timeout-after-commit, rollback and
  unique-index verification. Unit mocks do not prove Mongo isolation or durability.
- Email/invitation delivery and Owner MFA remain absent. Owner MFA remains a
  production gate. Lost sole-Owner credentials require a separate audited operator
  recovery procedure; provisioning deliberately cannot overwrite an existing Owner.
- Rich order filters/customer matching, owner-direct unassignment and reassignment
  after shipment/accrual are absent. Assignment intentionally fails closed there.
- Shipping fees, discounts, COD custody/settlement reconciliation, BATCH expenses,
  purchase cash and unresolved/partial failed-delivery inventory loss reporting
  remain incomplete. Mixed RESTOCK/DISCARD quantities from the same
  batch require separate versioned intake requests.
- Commission policy effective dates, accrual-linked payout reconciliation exports,
  and full formula/version/reason-rich financial audit history.
- Complete audit redacted before/after diffs, entity types and auth event audit.
  Current audit records only safe identifiers/actions and transition states;
  movement and expense reasons remain in their journals.
- Dashboard date windows, SKU/channel breakdowns, returning-customer metrics,
  inventory aggregates, exports, promotions, challenge-based abuse defense.
- Production-grade OpenAPI schemas, HTTP end-to-end persona tests, dependency/
  security scanning, monitoring, backup/restore and deployment approval gates.
- Root lockfile intentionally untouched per scope. Removing the API workspace
  dependency requires a later authorized workspace lockfile refresh before a
  frozen-lockfile install can be relied on.

## Verification

Tests were written and run red before the initial implementation. Additional
regression tests were run red for missing nested customer validation, nested
projection leakage and missing inventory movement reasons before their fixes.
API tests run without DB credentials or a Mongo process. Existing pure helper
tests are retained; legacy scaffold schemas/catalog are not wired into runtime.

Commands from `apps/api`: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Second Implementation Pass

- Added owner-issued, 15-minute single-use password reset tokens:
  `POST /users/:id/password-reset` returns the raw secret once for secure manual
  delivery; it is never cached in idempotency or audit records. A repeated issuance
  invalidates the previous token. `POST /auth/reset-password` consumes the token,
  updates Argon2id credentials and revokes sessions in one transaction. Persistent
  public-route throttling counts both IP and hashed token. Authentication versions
  invalidate stale sessions even when login races reset/disable. No automatic login
  follows reset. Owner issuance requires a current session and an allowlisted Origin.
- Added owner-only `POST /orders/:id/assignment` for active members before shipping,
  with expectedVersion, idempotency and audit. Existing financial obligations are
  not silently reassigned.
- Added scoped `PATCH /orders/:id` for PENDING/CONFIRMED/PACKING. Existing SKU prices
  retain snapshots, new SKUs use current DB prices, confirmed stock is released and
  FEFO re-reserved within the same transaction. Failure rolls the transaction back.
  Edits after shipment, after refunds or below received payment totals fail closed.
- Added explicit Swagger metadata for checkout/customer/item/login/version and new
  reset/edit/assignment/return DTOs and request bodies. Other legacy DTOs and response
  schemas still need complete OpenAPI coverage. Guard/controller metadata and unit
  tests are improved, but these are not full network-level HTTP integration tests.
- Verification after this pass: lint PASS, typecheck PASS, test PASS (65 tests in
  12 files), build PASS. No external DB connection, root/web/package edits or commits.

## Owner UI Contract Additions

- `GET /api/v1/owner/products` is Owner-only and includes inactive records. Each
  record explicitly includes `id`, `sku`, `name`, `netWeightG`, `retailPriceVnd`,
  `active`, `version`. Public `GET /products` remains active-only and unchanged.
- `POST /api/v1/products` is Owner-only, requires Idempotency-Key and strictly
  accepts `{ sku, name, retailPriceVnd, active }`. Only the three approved SKUs are
  accepted. Weight is derived from SKU; clients cannot provide weight/cost/version.
  Unique SKU conflicts are HTTP 409. Returns the owner product shape at version 0.
- `PATCH /api/v1/products/:sku` keeps required `expectedVersion`, `retailPriceVnd`,
  `active` and adds optional `name`. Returns the full owner product shape with the
  incremented version. SKU and weight cannot be changed through this endpoint.
- Owner `GET /api/v1/orders/:id` now includes `allocations` with `batchId`, `sku`,
  `qty`, `returnedQty`, `returnableQty`, `landedUnitCostVnd`; plus `shippedAt`,
  `deliveredAt`, `returnValueVnd`, `returnRefundsVnd`, `returnCreditBalanceVnd`,
  `refundableVnd`, `returnRefundDueVnd`. All new fields remain absent for Members.
  `returnableQty` is the allocation quantity remaining, not authorization to return
  before shipping. Intake still enforces state, version and safety checks.
- `returnCreditBalanceVnd` is outstanding merchandise credit; `refundableVnd` is
  net cash received; `returnRefundDueVnd` is overpayment due to merchandise returns.
  The latter excludes unpaid receivable cancelled by the return. Commission now
  handles that partially-paid case without requiring an unnecessary cash refund.

## Production Owner Authentication Gate

**TOTP/MFA is NOT implemented.** With `NODE_ENV=production`, password-only Owner
login fails with HTTP 403 `OWNER_MFA_REQUIRED`, and existing Owner sessions are
revoked and rejected with the same code. Stored/client MFA flags cannot bypass the
gate; there is no opt-out environment variable. Members retain normal authentication.
Development/test Owner workflows remain available. Production Owner operations are
intentionally unavailable until a reviewed MFA implementation replaces this gate.
Do not change NODE_ENV to evade the production gate.

## Signed BFF Identity And Finance Review Fixes

The web BFF must derive client identity from its hosting provider's trusted ingress
IP metadata, never browser input or an arbitrary forwarded header. Strip/overwrite
incoming identity headers and sign each outgoing public mutation:

- `X-CBST-Client`: canonical client IP or stable ingress-derived identifier matching
  `[A-Za-z0-9._:-]{1,128}`. IPv6 colons are supported.
- `X-CBST-Timestamp`: decimal Unix seconds, exactly 10 digits.
- `X-CBST-Signature`: lowercase hex HMAC-SHA256 over the exact UTF-8 string
  `${timestamp}:${client}` using shared server-only `BFF_SHARED_SECRET` (32+ chars).
- API accepts at most 60 seconds clock difference, checks signatures with
  timingSafeEqual, and rejects malformed/partial/expired signatures with HTTP 403
  BFF_IDENTITY_INVALID. It never silently downgrades a bad signature to IP trust.
- Requests without all three headers use the direct socket/request IP, not arbitrary
  forwarding headers. A BFF must sign requests to avoid its users sharing this IP
  bucket. Login account and reset-token counters continue in addition to identity.
- Signatures establish rate-limit identity only, not authentication/authorization.
  Use TLS; headers are replayable within the short timestamp window and should not
  be exposed to browsers or logs. Keep API proxy trust deployment-specific.

Both member and owner order list/detail responses now include `paymentDueVnd`,
computed on the server as max(0, total - merchandise credits - receipts + return
refunds), or zero for CANCELLED/RETURNED. Payment writes use the same function.
The member query fetches internal credit counters for calculation but never exposes
them or costs/allocations in the response.

Owner dashboard adds `failedDeliveryInventoryLossVnd`,
`failedDeliveryDirectCostsVnd`, and their sum `failedDeliveryLossVnd`, subtracting
that sum from netProfitVnd. These cover never-delivered, shipped orders whose
physical intake is complete (RETURNED). Remaining COGS reflects discarded goods;
restocked goods already reversed COGS. Delivered-order costs are not counted again.
Unresolved DELIVERY_FAILED and partial intake are not yet recognized as final losses.
