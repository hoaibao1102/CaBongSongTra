# Web Implementation

## Signed BFF Identity

Latest verification for this pass: tests PASS (104 tests in 7 files), lint PASS,
typecheck PASS, production build PASS (including information pages, product detail,
sitemap and BFF). Identity and authoritative-payment regressions ran red before
implementation. Tests use a test-only secret, no deployment credentials or database.

`BFF_SHARED_SECRET` is required on web and API, identical, server-only and at least
32 characters (provision a high-entropy random secret, not the test fixture).
Missing/short secrets fail closed before upstream access. Rotation invalidates
existing client identity cookies. Never expose this value with `NEXT_PUBLIC_`.

The BFF generates a random 256-bit opaque client ID and authenticates its cookie
with HMAC-SHA256 over `cbst-client-cookie:v1:${client}`. The host-only
`__Host-cbst_client` cookie uses Path=/, Secure, HttpOnly, SameSite=Strict and a
30-day lifetime. Malformed, forged or duplicate cookies receive a new identity.
Valid cookies retain the same identity across login, checkout and other API calls.
The API receives X-CBST-Client, a 10-digit Unix-second X-CBST-Timestamp, and a
lowercase hex X-CBST-Signature = HMAC-SHA256(`${timestamp}:${client}`).
API and web clocks must be synchronized for API timestamp validation.

Browser-supplied signature/client headers and IP forwarding headers are ignored.
Only the authentication session cookie is forwarded upstream, not the identity
cookie. Signed upstream headers are never copied to browser response headers.
Identity cookies are also issued on upstream failures to retain subsequent rate
identity. HTTPS is required; there is no insecure development cookie exception.

This prevents choosing an arbitrary authenticated ID, NOT creation of unlimited
new identities: attackers can clear cookies, use fresh clients or make concurrent
first requests. Trusted ingress IP enforcement/rate limits remain required, including
before BFF body parsing. No trusted-header override is implemented; Vercel or other
deployment headers must not be trusted without an explicit sanitized-edge design.

Payment entry now requires a valid nonnegative integer `paymentDueVnd`. Missing or
invalid amounts display Unavailable and disable the payment form; no member or
owner amount is reconstructed from totals or hidden return details.

## Follow-up Verification and Superseding Notes

The follow-up adds sessionStorage-backed checkout retries, public product detail
routes, bilingual privacy/terms/contact/label-safety pages and a canonical-origin
sitemap. Tests were run red before retry persistence, public content, owner API
projection integration and incoming-body error sanitization implementations.

Latest verification: `pnpm test` PASS (94 tests, 7 files), `pnpm typecheck` PASS,
`pnpm lint` PASS. No production build was run in this follow-up, deliberately
avoiding contention with the root agent's build. Earlier build/smoke results below
apply to the previous revision, not these new routes.

The following supersedes the older gap descriptions below:

- Checkout retry state survives same-tab reload/navigation. One sessionStorage
  entry contains a salted SHA-256 payload/actor fingerprint, random idempotency key,
  salt and guest scope. It contains no customer fields, cart, notes or raw actor ID.
  Changed payloads and actor changes are blocked while the entry is unresolved;
  they never replace the prior identity. Confirmed success removes the entry.
  Unsubmitted field changes do not erase protection for an uncertain request.
  Re-entering the same details is necessary after reload because PII is not restored.
  Corrupt/unavailable storage blocks sending. Closing the tab or clearing storage
  loses protection for the previous request; reconcile uncertain outcomes first.
  There is no automatic expiry/eviction or UI reset bypass. Retry the original to
  obtain its result; manual operator reconciliation is needed if that is impossible.
  If cleanup alone fails after success, the safe replay
  entry remains rather than falsely reporting the confirmed order as failed.
- Other admin mutations still retain retries only within the mounted form.
- `GET owner/products` now provides active/inactive records and versions. Owner
  updates use those real values and remount the form after version changes.
- Owner order projections now expose allocations, remaining return quantities and
  return balances. Return intake offers a bounded form per remaining batch; refund
  defaults use projected return obligations. Payment defaults account for returns.
  `paymentDueVnd`, when supplied for either role, takes precedence including zero;
  member payment defaults do not require owner-only return details. The API projection
  was verified present; missing or invalid values now fail closed without fallback.
  The API remains authoritative for concurrent quantity and money validation.
- Product detail uses the same-origin BFF and never falls back to illustrative prices.
- Contact identity, support channel, ingredients/storage specifics, seller legal
  details and approved policies remain unverified and are explicitly marked so.
  The information pages are not legal approval or verified food certification.
- Sitemap emits no URLs without a valid canonical `WEB_ORIGIN`. Product details
  load live data client-side; server-rendered product metadata/SEO remains limited.
- Browser interaction/device tests, live API/DB verification, and a fresh production
  build of this follow-up remain outstanding. No root/API/package files were edited.

## Scope and Runtime

All implementation changes are under `apps/web`. No root, API, shared package,
workspace lockfile, database, or credentials were changed. No commit was created.
The pre-existing API changes were read, not modified. The API controllers, DTOs,
service projections, and `IMPLEMENTATION.md` were rechecked during development
because a second API implementation pass appeared while web work was in progress.

Configure the web server with:

- `API_INTERNAL_URL`: API base URL ending in `/api/v1`, without query or credentials.
- `WEB_ORIGIN`: exact canonical browser origin, without a trailing slash.

The API's `CORS_ALLOWED_ORIGINS` must contain that same browser origin. HTTPS is
required for the API's Secure session cookie. No cookie security attribute is
weakened for development. Missing configuration fails closed with HTTP 503.
Browser traffic uses `/api/v1/*` on the web origin, matching the upstream session
cookie path. No bearer token or session secret is stored in browser storage.
Only the language preference is saved in localStorage.

## Implemented Screens

- Vietnamese/English storefront, API-priced catalog, quantity selection, order
  estimate, customer/contact/address/area fields, consent, notes, pending receipt.
- Same storefront creates authenticated internal orders with a source selector.
- Login, session lookup, logout, session-expiry feedback, password reset consumption.
- Owner and member navigation, scoped dashboards, paginated orders and commissions.
- Order detail, versioned allowed transitions, quantity edits, owner assignment,
  received payments, owner refunds with RETURN/GOODWILL purpose, cost finalization,
  and order-linked expenses.
- Inspected owner return intake with batch, quantity, disposition, evidence and reason.
- Inventory batches/movements, receipts, quarantine guidance, negative adjustments.
- Member creation/status, owner-issued reset tokens with deliberate identity confirmation.
- Product price/active-state update, overhead/order expense entry, full-balance payouts,
  audit list, empty/loading/error/retry states.
- Responsive cream/rust/green visual language, labeled forms, keyboard focus, skip
  navigation, semantic record tables, scrollable wide tables, reduced-motion support.

## BFF and Retry Behavior

The BFF uses an explicit route/method allowlist, exact configured Origin checking
for mutations, JSON validation, a 64 KiB request-body limit, restricted pagination,
request-header allowlisting, session-cookie filtering, response-header allowlisting,
no-store responses, manual redirect rejection, sanitized errors and a 10-second
upstream timeout covering both headers and body. Authorization, forwarded IP/host,
and arbitrary browser headers are not forwarded. API request IDs and Retry-After
are retained. Checkout-disabled is preserved as an actionable 503 code.

Mutation keys are cryptographically generated and reused for failed identical
requests within the mounted form, including switching back to an earlier failed
payload. Successful requests clear their key. Guest scope is random and retained
for the mounted checkout. Double submissions are blocked while pending.
No customer information, passwords, or reset tokens are persisted in browser
storage. A page reload or leaving/unmounting a form loses its retry context; do not
reload or start a new request after an ambiguous outcome without reconciliation.

## Exact Gaps

- Public checkout remains disabled by default in the API. The UI reports this,
  does not invent successful orders, and does not bypass the production gate.
- Product GET returns only active products and omits `version`/`active`; product
  updates require a manually verified version. Inactive products are selectable by
  approved SKU, but their current values cannot be read. There is no product-create API.
- Order detail omits batch allocations, returned quantities and return-credit totals.
  Return intake therefore requires a verified shipped batch ID from movements and
  submits one batch per versioned request. It cannot present a complete remaining
  return entitlement or infer the correct refund credit. API validation is authoritative.
- Order edits currently expose quantities, not the optional customer-edit DTO fields.
- Payment/refund submission is supported, but there is no dedicated payment-history
  GET endpoint; detail displays projected received/refunded totals, not a full journal.
- Payouts use a verified member ID; no available-balance lookup or payout preview is
  exposed by the API. The UI never mistakes a paginated journal sum for the balance.
- Lists use page/limit and next-page heuristics because no total count is returned.
  There are no invented search/date/export endpoints. Dashboards are all-time.
- Known workflow enums and fields are translated. Unknown audit action codes remain
  literal technical identifiers; API product names are strings, with local English
  names for the three approved pack sizes.
- Reset tokens require secure manual delivery. No email delivery, public registration,
  owner MFA, or sole-owner recovery is implemented in web.
- Test coverage is unit/request logic plus server-rendered component markup, not
  interactive browser end-to-end coverage. No browser automation runtime was available.
  Mobile CSS is implemented but not screenshot/device-verified.
- No live API, replica-set DB, transaction, deployed HTTPS-cookie, accessibility audit,
  or production security verification was performed. Unit mocks cannot prove these.
- The root lockfile intentionally remains untouched. The removed web
  `@cbst/contracts` dependency requires an authorized workspace lockfile refresh
  before relying on a fresh frozen-lockfile installation.
- BFF ingress upload time/rate limits and deployment-specific trusted proxy/rate
  limiting remain deployment responsibilities; no caller-supplied IP header is trusted.

## Tests-First Verification

Tests were added and run red before the initial BFF, form/request logic and screens.
Additional tests ran red before fixes for stalled upstream bodies, retry-key reuse,
API string product names, inspected-return transitions, and the newly added API routes.
Tests require no credentials, database, or network API.

Commands from this directory: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
Current unit result: 81 passing tests in 4 files. Build and smoke results are reported
in the task completion response. Next build skips embedded lint per the existing
configuration; lint was run independently.
