# Ca Bong Song Tra V2

Two-application pnpm workspace: `apps/web` (Next.js App Router and same-origin
BFF) and `apps/api` (NestJS modular monolith, REST `/api/v1`, Mongoose).
MongoDB replica set/Atlas is the source of truth. There is no shared contracts
package or legacy root application. API-local domain types and web adapters live
in their respective apps.

**Not production ready.** Passing compilation and credential-free tests does not
prove database transactions, deployed authentication, operational safety or full
SRS completion. Detailed implementation evidence and limitations remain in
[API implementation](apps/api/IMPLEMENTATION.md) and
[web implementation](apps/web/IMPLEMENTATION.md).

## Binding Decisions

This summary preserves the former V2 Decision Log, SRS, contracts, traceability
matrix and migration/production runbooks. Decision Log V2 overrides conflicting
SRS proposals and all older Supabase/Sheets documents. The explicit cleanup
instruction supersedes the proposed `packages/contracts`/`packages/config`
layout. Historical source and documents are recoverable from tracked snapshot
`df84d7be8e7d13775237ff4cf22105ddc1cf0545` using Git; that snapshot does not include
the later uncommitted application implementations or ignored secrets.

- NestJS owns authorization and strict class-validator validation. OpenAPI is
  the intended canonical machine-readable contract; complete response schemas
  and conformance tests are still outstanding.
- Use opaque server-side sessions, Argon2id passwords and a same-origin BFF.
  Roles are only `OWNER_ADMIN` and `MEMBER`. Members see only their assigned
  orders/necessary PII and own commissions, not COGS or global finance. Exports
  must be Owner-only and audited. Owner MFA is a production gate.
- Order flow is `PENDING -> CONFIRMED -> PACKING -> SHIPPING -> DELIVERED`, with
  `CANCELLED`, `DELIVERY_FAILED`, `RETURN_REQUESTED`, `PARTIALLY_RETURNED` and
  `RETURNED` branches. State changes require authorization, version checks and
  idempotency, not arbitrary status updates.
- One shared warehouse: reserve at CONFIRMED, allocate FEFO by expiry then FIFO,
  stock out exactly once at SHIPPING, recognize revenue at DELIVERED. PENDING
  requests do not reserve stock. Missing label/expiry quarantines a batch;
  expired stock cannot be reserved. All stock changes use append-only movements.
- Delivery does not imply payment. Inspected returns, stock intake, revenue
  adjustments and cash refunds are separate events. Never restore stock merely
  because an order failed delivery or entered a return state.
- Money is integer VND, rates are basis points, timestamps UTC, reporting timezone
  `Asia/Ho_Chi_Minh`. Preserve price/cost/rate snapshots and append-only payment,
  refund, expense, commission and payout history. Round commission half up to
  VND; the remainder belongs to the Owner share.
- Member commission is the member's snapshotted percentage of positive product
  margin (order selling price minus actual batch COGS); zero/negative margin creates no positive
  commission. Preserve real losses. Owner-direct orders create no Member
  commission. Eligibility begins when the order is successfully delivered;
  later refunds/returns require adjustments, never deletion of previous payouts.
- Approved packs are `CBST-300/400/600`, retail 109000/139000/199000 VND. Net weight
  includes fish and sauce, not packaging. Opening costs 65000/95000/140000 VND
  are development/staging examples only. Storage/expiry claims require approved
  manufacturer labels, not assumptions.
- Start production empty. Do not import old customers, orders, stock, payments,
  passwords or ledgers. Sheets remains an encrypted, access-controlled read-only
  archive under verified retention obligations, never a dual-write backend.
  Opening stock requires real receipts; never seed the planned 28 jars.
- Local, staging and production must have isolated databases/secrets. Multi-record
  money/stock writes require verified replica-set transactions. No process-local
  lock/rate counter may be the global authority; no resident serverless workers.
  Use commercial hosting appropriate to the business, not Vercel Hobby.

## Setup And Environment

Use Node.js 22 and pnpm 10.18.3 (the pinned package manager).

```bash
pnpm install --frozen-lockfile
pnpm dev
```

The root is an orchestrator, not an application. App-local environment files or
secure process environment injection configure each process. Existing env files,
including root `.env.local`, are preserved; root secrets are not automatically
configuration for both apps. Do not overwrite existing env files or commit secrets.
Use app implementation notes as the authority for current variable names; older
root examples may contain unused legacy suggestions.

| Process | Variable | Requirement |
| --- | --- | --- |
| API | `MONGODB_URI` | Dedicated replica-set URI, server-only |
| API | `SESSION_SECRET` | At least 32 characters, server-only |
| API | `CORS_ALLOWED_ORIGINS` | Comma-separated exact allowed browser origins |
| API | `PUBLIC_CHECKOUT_ENABLED` | Disabled by default; do not enable before acceptance gates |
| Web | `API_INTERNAL_URL` | API base URL ending in `/api/v1`, no credentials/query |
| Web | `WEB_ORIGIN` | Exact browser origin without trailing slash; must be API-allowlisted |

Defaults are web port 3000 and API port 4000. Configure trusted local HTTPS or
an HTTPS reverse proxy for authenticated development: `cbst_session` is Secure,
HttpOnly, SameSite Strict, path `/api/v1`. Plain HTTP is not an authenticated
deployment test. Never expose DB/session credentials through `NEXT_PUBLIC_*`.
Missing BFF configuration fails closed with 503. Browser requests use the web
origin's `/api/v1/*`; the BFF forwards the restricted cookie/Origin headers.

API mutations require JSON and an allowlisted Origin. Business writes use an
`Idempotency-Key` of 16-128 alphanumeric/underscore/hyphen characters, with
`expectedVersion` where required. Guest checkout also requires a cryptographically
random 32-128 character base64url `X-Guest-Session`. The web UI keeps retry context
only while its form is mounted: after an ambiguous outcome, reconcile before
reloading or issuing a new request. Caller-provided proxy IP headers are not
trusted; deployment-specific ingress limits and trusted proxies need configuration.

Build and start explicitly with `pnpm build`, then in separate processes:

```bash
pnpm --filter @cbst/api start
pnpm --filter @cbst/web start
```

First-Owner provisioning is an explicit operator action, never part of build or
CI. From `apps/api` after building, `node dist/src/provision-cli.js` requires
`PROVISION_CONFIRM=CREATE_FIRST_OWNER`, `PROVISION_EMAIL`, `PROVISION_PASSWORD`,
`PROVISION_NAME` and `MONGODB_URI` supplied securely through process environment,
not password command-line arguments. It refuses an existing Owner, initializes
indexes and inserts only missing approved products transactionally; it does not
seed inventory/costs or overwrite prices. This CLI has not been database-verified.
Secure credential handover/change, MFA and sole-Owner recovery must be resolved
before production; provisioning cannot reset an existing Owner.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`pnpm verify` runs these gates in order. Root build explicitly builds API then web,
avoiding concurrent Next builds. Root TypeScript configuration is a workspace
index; use `pnpm typecheck` to invoke each app's own compiler configuration, not
`tsc --build` on non-composite apps. Next's embedded lint is disabled, so the
separate lint gate is required. Tests use mocks/pure logic, not a live database.

GitHub Actions uses Node 22, frozen pnpm installation, these four gates and a
high-severity dependency audit. This is not a complete security pipeline: real
replica-set integration/concurrency, secret scanning and browser E2E gates remain
to be added. Action SHA pinning and protected-branch enforcement remain deployment
administration work. App implementation notes describing a pending root lockfile
refresh are historical; the root cleanup refreshes the lockfile separately.

## Runtime Acceptance

Do not enable public checkout or claim go-live until evidence exists for all gates:

- Actual target replica-set transactions/indexes, final-unit concurrency,
  duplicate checkout/stock-out/payout, timeout-after-commit replay and rollback
  under injected failure; mocks cannot prove isolation or durability.
- Network-level authentication/IDOR for both roles, inactive/reset session
  revocation, HTTPS cookie/BFF behavior, abuse controls and PII/secret review.
- Owner MFA, secure recovery, commercial hosting, least-privilege Atlas access,
  network policy, separate environments, budget alerts and deploy smoke tests.
- Encrypted backups with separately protected keys, verified restore into staging,
  stock/payment/commission reconciliation, monitoring and alert exercises.
- Owner plus 1-2 Member UAT on mobile and critical flows; approved product labels,
  shipping/returns/privacy/shop information and applicable legal/tax obligations.
- Owner sign-off on actual opening stock, cash/debts, team responsibility and
  release readiness. RPO <=24h and RTO <=4h are targets, not promises before a drill.

For separate FE/BE deployments use app roots `apps/web` and `apps/api`, verify
Nest entrypoint/bundling and function limits on the chosen host, and select one
primary deployment mechanism. Production deployment compatibility has not been
verified merely by local build success.

## Operations And Cutover

Daily: review aged PENDING orders, SHIPPING/COD reconciliation, near-expiry
batches, open returns, pending commission costs, login abuse and checkout/5xx
failures. Weekly: reconcile physical inventory against movements, delivered
revenue against receipts/COD receivables, commissions against payouts/refunds,
and inspect backup retention, hosting/database usage and budget alerts.

Cutover: preserve the source snapshot and encrypted legacy archive/checksums,
freeze legacy writes, provision approved configuration/products and actual stock
receipts, complete auth/catalog/order/reserve/shipping/payment/refund/audit smoke
tests, then switch traffic in an approved maintenance window of at most one day.
Local source cleanup is not evidence that a legacy data archive was created.

Incident response: block sensitive writes or enter maintenance, collect request
IDs/deployment/timestamps and safe DB evidence, avoid blind non-idempotent retries,
and roll back only to compatible app/schema versions. Restore into an isolated
environment first and reconcile orders, stock, payments and commissions before
cutover. Record a postmortem and corrective owners. Traffic rollback to the old
system is allowed only within the agreed window, with no dual-write or reverse
Mongo-to-Sheets synchronization; V2 transactions require an exception report and
Owner-signed manual reconciliation. Deleted source is recoverable through Git,
not an automatically runnable production rollback.

## Known Gaps

- Owner MFA, email invitations/reset delivery and audited sole-Owner recovery
  remain absent. Reset tokens require secure manual delivery. In production,
  Owner password login and existing Owner sessions fail closed with
  `OWNER_MFA_REQUIRED`; Owner operations are unavailable until reviewed MFA is
  implemented. Do not change `NODE_ENV` to bypass this gate.
- Full OpenAPI response schemas, HTTP/browser persona E2E, real database failure/
  concurrency tests, deployed-cookie verification, accessibility/device audits,
  performance measurements, backup drills and monitoring are not demonstrated.
- Shipping fees/discounts, courier-held COD reconciliation, batch/purchase cash,
  goodwill-to-return reclassification, failed-delivery inventory loss reporting,
  commission policy effective dates and complete payout reconciliation are incomplete.
- Financial history uses one discriminated append-only ledger, not all proposed
  separate collections. Dashboard cash means operating cash movement, not bank
  balance. Full reason-rich before/after audit and auth event coverage are incomplete.
- Rich order filters/customer matching, post-shipment assignment, promotions,
  dated/SKU/channel reports, returning-customer metrics and exports remain incomplete.
- The latest API additions expose Owner-only versioned/inactive products, approved
  SKU creation and order allocation/return-credit projections. Earlier web gap
  notes predate these additions; end-to-end UI integration still needs verification.
  Payment journals and payout balance previews are not available through dedicated
  read endpoints. Dashboards are all-time; pagination uses next-page heuristics,
  not totals.
- Responsive and accessible UI patterns are implemented but not device/screenshot
  or full accessibility verified. Unit/render tests do not replace interactive UAT.

See both app implementation files for narrower endpoint and workflow limitations;
do not interpret this consolidation or removal of legacy code as full completion.
