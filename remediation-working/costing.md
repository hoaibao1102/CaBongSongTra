# BUS-03 — exact purchase-receipt cost conservation

## Outcome and scope

Implemented prospective conservation for new purchase receipts. Only `apps/api/src/v2/service.ts` shipping allocation and purchase-receipt construction changed. No model/schema, order allocation representation, financial history, ledger policy, migration, or backfill changes. No `.env` read, database connection, application bootstrap, provider/provision invocation or commit.

An input line is expanded into at most two actual receipt items/batches. For quantity q, purchase unit price p, allocated freight s: low unit cost is p + floor(s/q); high quantity is s modulo q; low quantity is q minus high quantity. The high bucket unit cost is low + 1. Each bucket stores its own quantity, purchase line total, freight, batch ID and unique lot code. Consequently every bucket satisfies `qty * landedUnitCostVnd = lineTotalVnd + allocatedShippingVnd`. Receipt totals and quantities are unchanged. Expiry, supplier lot, safety/quarantine state and receipt traceability are copied to both buckets.

`allocateReceiptShipping` remains a one-result-per-input-line helper (its landed unit cost remains the lower bucket cost, for existing helper/test compatibility). The persisted receipt boundary performs splitting before any stock/movement writes. No fractional cost or changing order allocations is necessary.

## Allocation policy and assumptions

Positive merchandise subtotal retains existing value-proportional allocation and deterministic remainder-to-largest-line (first input on ties). An all-zero merchandise subtotal now uses quantity-proportional weights, with the same largest-weight/first-tie remainder rule. This is an explicit fallback policy assumption, not weight/volume accounting: current DTO accepts zero purchase prices, positive integer quantities, positive freight, and has no per-line freight/weight allocation basis. Thus quantity allocation is mechanically supported and conserves freight without inventing a new input/API. Mixed paid/free receipts retain value weighting: free lines receive zero freight. Owner approval may replace the quantity policy in a future scoped change, but freight is no longer silently discarded.

## Compatibility assessment from actual source/tests

- `PurchaseReceiptItem` has one `batchId`, `lotCode`, integer unit cost and qty. Splitting receipt items alongside batches preserves this contract instead of claiming one item points to two batches. No schema change is needed. Response item count can increase to twice input item count; input validation limits do not constrain stored receipt output arrays.
- `InventoryManager.tsx:1047-1049` renders every persisted receipt item by array index and displays its own quantity/unit cost. Duplicate SKU rows already are legal in the API. Therefore saved receipt history can render both cost buckets correctly without a frontend data-shape change.
- Inventory valuation at `InventoryManager.tsx:94-96` sums each batch's `onHand * landedUnitCostVnd`, now exact.
- **Known UI discrepancy outside this exclusive backend scope:** the pre-submit allocation preview at `InventoryManager.tsx:139-176` duplicates the old floor/zero-subtotal algorithm. It still previews a single lower unit cost and zero freight for all-free goods, although the submitted payload contains original prices/quantities/freight and saved receipt history is exact. Parent should update preview to two cost buckets or clearly show an estimate/range; backend correctness is not contingent on preview values. No browser/live app was launched under the no-bootstrap constraint; this is source compatibility inspection plus mock service tests, not an end-to-end UI claim.
- Existing `purchase-receipts.test.ts` passed unchanged (including expected proportional freight and lower helper unit costs).
- Existing reservation snapshots unit cost per batch; outbound uses those allocations; inspected return reverses that exact allocation's integer cost. New mock integration regression exercises partial allocation across both buckets, outbound, then restocking the higher-cost unit and verifies inventory plus outstanding COGS equals original receipt cost. Bucket ordering within equal FEFO dates remains existing ID tie-breaking, not a new low/high FIFO policy.

## Strict TDD evidence

1. `bus03-red-buckets.txt`: one desired regression FAILED for the right reason, inventory value 30 vs receipt total 32. Saved before bucket implementation.
2. `bus03-green-buckets.txt`: same test PASS after minimal prospective splitting.
3. `bus03-red-zero-value.txt`: second desired regression FAILED for the right reason, inventory 0 vs freight 7; prior split regression PASS. Saved before quantity fallback.
4. `bus03-green-zero-value.txt`: own two tests plus existing purchase-receipt tests PASS after quantity fallback.
5. Additional preservation tests were added without requiring production changes: partial/outbound/return costing; divisible/zero freight; mixed/free/duplicate lines and traceability.
6. `bus03-green-final.txt`: 2 files, 10 tests PASS (5 new own tests plus 5 existing receipt tests).
7. `bus03-regression.txt`: 5 files, 48 tests PASS: bus03-costing, purchase-receipts, v2-workflow, order-workflow, order-policy. Mock/pure only.
8. `bus03-typecheck.txt`: `npx tsc --noEmit`, exit 0 (empty diagnostics).

Full API suite deliberately not invoked blindly: it includes provision-related tests, and parent owns audit-business-invariants characterization updates plus concurrent transition/KPI changes. This agent did not modify the parent's audit tests. Run coordinated approved pure/mock suite after siblings finish.

## Legacy compatibility and deferred backfill plan (not executed)

Existing receipts, batches, allocations, recognized COGS, returns and idempotency replay snapshots remain byte-for-byte unchanged. Replays of historical receipt keys continue returning historical snapshots. Historical undercapitalization is not magically repaired by this forward-only fix.

A separate approved exercise must first produce a read-only reconciliation: receipt freight versus receipt-item freight versus original received quantity times batch cost, grouped by receipt and consumed/reserved/returned state. Never infer original quantity from current onHand. For fully untouched/unreserved batches, any approved repair would require new cost buckets and reviewed traceability. For partially consumed/reserved/returned inventory, stop automatic repair: determine historical depletion, allocation cost snapshots, return reversals and approved opening/reconciliation adjustment treatment with finance; do not mutate historic allocations or ledger totals in place. Back up and dry-run with immutable evidence, explicit owner signoff, idempotent plan and rollback before applying any separately authorized migration. No such data access or migration occurred here.
