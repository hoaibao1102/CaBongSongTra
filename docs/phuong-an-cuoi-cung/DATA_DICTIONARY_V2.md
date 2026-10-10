# DATA DICTIONARY V2

## Quy ước chung

- API dùng opaque `id`; Mongo `_id`/`__v` không xuất ra client.
- Tiền: integer VND; tỷ lệ: basis points; timestamp UTC; hiển thị `Asia/Ho_Chi_Minh`.
- Mọi document nghiệp vụ có `createdAt`, `updatedAt`; aggregate nhạy cảm có `version`.

## Collections

| Collection | Trường lõi | Index/bất biến |
|---|---|---|
| users | id, emailNormalized, passwordHash, role, status, commissionPolicyId | unique email; không plaintext |
| sessions | tokenHash, userId, idleExpiresAt, absoluteExpiresAt, revokedAt | unique tokenHash; TTL + auth check |
| products | id, sku, netWeightG, status | unique sku |
| priceVersions | productId, priceVnd, effectiveFrom, createdBy | productId+effectiveFrom |
| customers | id, phoneNormalized, name, addresses, consent | partial unique phone |
| orders | id, orderCode, customerId, items[], status, paymentStatus, responsibleMemberId, totals, version | unique orderCode; conditional version updates |
| inventoryBatches | id, sku, lotCode, receivedQty, onHandQty, reservedQty, expiresAt, landedUnitCostVnd, status | nonnegative; sku+expiry+received |
| inventoryAllocations | orderId, batchId, sku, qty, status, costSnapshotVnd | unique order+batch+status policy |
| inventoryMovements | idempotencyKey, orderId, batchId, type, qtyDelta, actorId | append-only; unique idempotency scope |
| payments | orderId, kind, method, amountVnd, status, idempotencyKey, settlementRef | append-only; unique key |
| expenses | scope, orderId?, batchId?, category, payer, amountVnd | append-only |
| commissionAccruals | orderId, memberId, baseVnd, rateBps, amountVnd, status, formulaVersion | unique order/member/version/sequence |
| commissionPayouts | memberId, period, accrualIds[], amountVnd, status | idempotent approval/payment |
| returns | orderId, lines[], status, refundAmountVnd, inspection | append-only transitions |
| idempotencyRecords | scope, keyHash, requestHash, status, responseSafe, expiresAt | unique scope+keyHash |
| auditLogs | actorId, requestId, action, entityType, entityId, redactedDiff, reason, createdAt | append-only |

## Enum canonical

- Role: `OWNER_ADMIN | MEMBER`
- OrderStatus: `PENDING | CONFIRMED | PACKING | SHIPPING | DELIVERED | CANCELLED | DELIVERY_FAILED | RETURN_REQUESTED | PARTIALLY_RETURNED | RETURNED`
- PaymentStatus: `UNPAID | PARTIALLY_PAID | PAID | PARTIALLY_REFUNDED | REFUNDED`
- BatchStatus: `AVAILABLE | QUARANTINED | DEPLETED | EXPIRED`
