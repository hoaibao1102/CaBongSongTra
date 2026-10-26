# BUS03 purchase-receipt preview remediation

## Delivered
- Extracted pure `apps/web/lib/receipt-costing.ts`; InventoryManager consumes it instead of duplicating allocation math.
- Positive-subtotal freight uses purchase-value weights, floor shares, and remainder assigned to the first largest weight, matching the inspected backend algorithm.
- Preview displays each floor/ceil bucket as quantity × integer landed unit cost, plus exact line and receipt totals. Example: 3 × 100 purchase price + 2 freight becomes 1 × 100 + 2 × 101 = 302, not a misleading canonical unit cost of 100.
- Latest policy correction supersedes the initial quantity-weight behavior: all-zero subtotal plus positive freight returns `ZERO_VALUE_FREIGHT_ALLOCATION_POLICY_REQUIRED`, no allocated lines, and the truthful overall cost. UI shows a bilingual blocking notice, disables submit, and guards submission before mutation. Free goods with zero freight remain allowed.
- Preserved the pre-existing `useActorMutation` integration and `errorText` changes; no mutation-hook or payload changes.

## Strict TDD evidence
Command (from apps/web): `node node_modules/vitest/vitest.mjs run lib/receipt-costing.test.ts`.
- `preview-red-1.txt`: missing helper import, initial feature absence (not sufficient behavioral evidence alone).
- `preview-red-2.txt`: behavioral RED, expected split buckets versus a single purchase-cost bucket.
- `preview-green-1.txt`: first behavior GREEN.
- `preview-red-zero-subtotal.txt`: historical behavioral RED for initial quantity-weight instruction; that policy was subsequently withdrawn and is NOT delivered.
- `preview-red-policy.txt`: behavioral RED for corrected blocking policy, expected stable error versus undefined.
- `preview-green-policy.txt`: both split and corrected blocking behaviors GREEN.
- `preview-green-final.txt`: 4 pure tests passed, including additional regression checks for zero-freight free goods, ignored zero-quantity rows, mixed free/paid rows, deterministic remainder ties, quantity conservation, and exact cost conservation. Those added regression assertions exercised existing implementation; no further production behavior was added for them.
- `preview-typecheck.txt`: `node ../../node_modules/typescript/bin/tsc --noEmit --incremental false` exited 0, no diagnostics.

## Scope and remaining verification
Only InventoryManager.tsx, the owned helper/test, and evidence under this directory were written. No commits, database, environment, network, provider, or account access. Tests invoke only pure costing code; no backend services are imported. Parent owns backend policy changes and full-system verification. No browser/UI interaction or full test-suite run was performed in this isolated subtask.
