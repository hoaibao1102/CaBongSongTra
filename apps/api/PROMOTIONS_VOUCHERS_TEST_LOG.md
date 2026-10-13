# Partial V2.2 Implementation Test Log

All commands below ran from `apps/api` on 2026-10-12. This is a partial implementation, not end-to-end acceptance.

## Red / Green

1. Added focused largest-remainder allocation test.
   Command: `npm test -- --run test/pricing.test.ts`
   Red: `Cannot find module '../src/v2/pricing'`.
   Added integer allocation using BigInt intermediate products and stable input-order tie breaking.
   Same command green: 1 file passed, 1 test passed.
2. Added cumulative snapshot return and legacy unit-price compatibility test.
   Command: `npm test -- --run test/pricing.test.ts`
   Red: 1 failed, 1 passed; `TypeError: returnCredit is not a function`.
   Added cumulative floor-difference credit calculation.
   Same command green: 1 file passed, 2 tests passed.
3. Added transactional service return test for a SKU split across batches.
   Command: `npm test -- --run test/pricing.test.ts`
   Red: tool reported `Error: INVALID_MONEY` from the fractional legacy multiplication path.
   Integrated cumulative SKU-level credit into receiveReturn, with optional snapshot typing.
   Same command green: 1 file passed, 3 tests passed.

## Checks

After step 2:

- `npm run typecheck`: passed.
- `npm run lint`: passed, max warnings 0.
- `npm test`: 17 files passed, 84 tests passed.
- `npm run build`: passed.

After step 3:

- `npm run typecheck`: passed.
- `npm run lint`: passed, max warnings 0.
- `npm test`: 17 files passed, 85 tests passed.
- `npm run build`: passed.

## Remaining Scope

Snapshot persistence schemas and creation, pricing quotes and fingerprint guards, DTO/controller/policy transport, catalog effective prices, promotion CRUD/serialization, voucher CRUD/RBAC/counters/redemptions/lifecycle, and stable V2 edit rejection remain unimplemented. No web contract has been changed or delivered. No real MongoDB replica-set concurrency tests were run. Service tests use repository doubles. Existing dirty changes were preserved; no media/upload code was edited.
