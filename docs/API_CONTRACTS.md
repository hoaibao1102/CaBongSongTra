# API / SERVER ACTION CONTRACTS — P0a

> Phiên bản: 1.0 — 09/10/2026  
> Trạng thái: Canonical implementation contract.  
> Transport: Next.js Server Actions cho UI nội bộ; Route Handlers chỉ khi cần integration/download. Cả hai gọi cùng service/DAL.

## 1. Envelope và nguyên tắc chung

### Success

```ts
type Success<T> = { ok: true; data: T; requestId: string };
```

### Failure

```ts
type Failure = {
  ok: false;
  error: { code: ErrorCode; message: string; fieldErrors?: Record<string, string[]> };
  requestId: string;
};
```

- FE xử lý theo `error.code`, không parse `message`.
- Không trả stack trace, SQL error, secret hoặc PII vượt quyền.
- Mutation nhận `idempotencyKey` UUID và, với entity mutable, `expectedVersion`.
- Server lấy actor, role và organization từ session; không tin `actorId`, `role`, `organizationId`, giá, tổng tiền hoặc commission từ client.
- Mọi mutation tiền/kho/role có audit và transaction phù hợp.

## 2. Error catalog

| Code | HTTP tương đương | Khi dùng |
|---|---:|---|
| `UNAUTHENTICATED` | 401 | Không có/expired session |
| `FORBIDDEN` | 403 | Actor không có quyền |
| `RESOURCE_NOT_FOUND` | 404 | Không tồn tại hoặc cố ý che resource ngoài scope |
| `VALIDATION_ERROR` | 422 | Payload/schema invalid |
| `CONFLICT` | 409 | Version/idempotency/state conflict chung |
| `INVALID_STATE_TRANSITION` | 409 | Transition không có trong state machine |
| `OUT_OF_STOCK` | 409 | Không đủ tồn khả dụng trong transaction |
| `BATCH_NOT_SELLABLE` | 409 | Lô hết hạn/quarantine/thiếu evidence bắt buộc |
| `PRICE_CHANGED` | 409 | Giá hiện hành khác preview; trả snapshot mới được phép xem |
| `RESERVATION_EXPIRED` | 409 | Reservation đã hết hạn/release |
| `PAYMENT_EXCEEDS_BALANCE` | 422 | Receipt/refund vượt giới hạn |
| `RETURN_ALREADY_PROCESSED` | 409 | Retry khác idempotency trên return đã xử lý |
| `COMMISSION_NOT_ELIGIBLE` | 409 | Chưa giao/thu đủ/đối soát hoặc có return mở |
| `VERSION_CONFLICT` | 409 | `expectedVersion` cũ |
| `RATE_LIMITED` | 429 | Vượt ngưỡng; có `Retry-After` khi phù hợp |
| `INTERNAL_ERROR` | 500 | Lỗi không công khai chi tiết |

## 3. Read projections

| Query | Admin | Owner member | Member khác |
|---|---|---|---|
| Public products | Public fields | Public fields | Public fields |
| Available stock | Full batch | Tổng hợp theo product | Tổng hợp theo product |
| Order list | Tất cả | Đơn mình, PII mask ở list | Không thấy đơn người khác |
| Order detail | Tất cả | Đơn mình, full PII cần giao | `RESOURCE_NOT_FOUND` |
| Customer search | Tất cả theo mục đích | Chỉ khách của đơn mình hoặc kết quả mask để dedupe | Không browse toàn bộ |
| Commission | Tất cả | Của mình | Không thấy người khác |
| Audit/export | Tất cả theo quyền | Không | Không |

## 4. Mutation contracts

### `createDraftOrder(input)`

```ts
type CreateDraftOrderInput = {
  idempotencyKey: string;
  customer: { id?: string; displayName: string; phone?: string; area?: string; address?: string };
  sourceId?: string;
  items: Array<{ productId: string; quantity: number }>;
  customerShippingFee?: number;
  note?: string;
};
```

Server normalize phone, dedupe có kiểm soát, đọc giá hiện hành và tạo `DRAFT`. Không reserve; không nhận unit price/total từ client.

### `confirmOrder(input)`

```ts
type ConfirmOrderInput = { orderId: string; expectedVersion: number; idempotencyKey: string };
```

Trong một DB transaction:

1. Authz owner/Admin và lock order.
2. Validate state `DRAFT`, đọc giá hiện hành; nếu đổi so với draft trả `PRICE_CHANGED` và không mutate.
3. Chọn batch FEFO/FIFO, lock/update có điều kiện.
4. Tạo active reservations 24h, snapshot giá/discount và chuyển `CONFIRMED`.
5. Audit + commit.

### `transitionOrder(input)`

```ts
type TransitionOrderInput = {
  orderId: string;
  to: "PREPARING" | "SHIPPING" | "DELIVERED" | "CANCELLED" | "RETURN_REQUESTED";
  expectedVersion: number;
  idempotencyKey: string;
  reason?: string;
};
```

- `DELIVERED`: transaction consume reservation, ghi ledger `FULFILL`, snapshot COGS.
- `CANCELLED`: release reservation nếu có; reason bắt buộc sau confirm.
- Không cho client gửi from-state.

### `recordPayment(input)`

```ts
type RecordPaymentInput = {
  orderId: string;
  kind: "RECEIPT" | "REFUND";
  method: "BANK_TRANSFER" | "CASH_COD";
  amount: number;
  reference?: string;
  reversesPaymentId?: string;
  idempotencyKey: string;
};
```

Admin hoặc owner đơn ghi receipt; refund chỉ Admin. Server derive payment status; amount integer > 0; refund không vượt net receipt.

### `upsertOrderCost(input)`

```ts
type UpsertOrderCostInput = {
  orderId: string;
  costId?: string;
  type: "SHOP_SHIPPING" | "PACKAGING" | "PAYMENT_FEE" | "OTHER_DIRECT" | "MEMBER_ADVANCE_REIMBURSEMENT";
  payer: "SHOP" | "CUSTOMER" | "ADVANCED_BY_MEMBER";
  amount: number;
  note?: string;
  expectedVersion?: number;
  idempotencyKey: string;
};
```

Member chỉ thêm chi phí đơn mình trước reconciliation; Admin duyệt/reconcile. Thay đổi sau commission approval tạo financial adjustment.

### `processReturn(input)`

```ts
type ProcessReturnInput = {
  orderId: string;
  items: Array<{ orderItemId: string; quantity: number; disposition: "RESTOCK" | "QUARANTINE" }>;
  refundAmount: number;
  reason: string;
  idempotencyKey: string;
};
```

Admin-only. Một transaction ghi return state, ledger phù hợp, refund và commission adjustment. Không mặc định thực phẩm trả lại là sellable.

### `adjustInventory(input)`

```ts
type AdjustInventoryInput = {
  batchId: string;
  quantityDelta: number;
  reason: "DAMAGE" | "ADJUST" | "EXPIRE";
  note: string;
  idempotencyKey: string;
};
```

Admin-only; không cho tồn âm; audit before/after. Nhập lô dùng action riêng `receiveBatch`.

### `receiveBatch(input)`

Nhận `productId`, `lotCode`, ngày, quantity, purchase cost, inbound cost, label evidence và idempotency key. Tính `landed_unit_cost` server-side; transaction tạo batch + ledger `RECEIVE`.

### `createPriceVersion(input)`

Admin-only; nhận product, price, effective range, reason, idempotency. Chặn khoảng hiệu lực chồng nhau. Không update order snapshot cũ.

### `recalculateCommission(orderId)`

Internal service, không public client action. Tạo/cập nhật record chưa paid từ dữ liệu authoritative. Chỉ chuyển `ELIGIBLE` theo `DEC-FIN-01`.

### `approveCommission(input)` / `createPayout(input)`

Admin-only; payout theo member và tháng, idempotent. Chỉ include commission `APPROVED`, chưa thuộc payout khác. Mark `PAID` cùng transaction khi ghi bằng chứng thanh toán.

### `exportData(input)`

Admin-only, audit bắt buộc, giới hạn date range/row count, CSV chống formula injection. File dùng URL ký ngắn hạn hoặc stream authenticated; không lưu public bucket.

## 5. RLS và authorization matrix

| Resource/action | OWNER_ADMIN | MEMBER owner | MEMBER non-owner | Public |
|---|---:|---:|---:|---:|
| Product public read | ✅ | ✅ | ✅ | ✅ qua view/DTO |
| Product/price write | ✅ | ❌ | ❌ | ❌ |
| Batch/ledger full read | ✅ | ❌ | ❌ | ❌ |
| Stock aggregate read | ✅ | ✅ | ✅ | ❌ mặc định |
| Draft/create order | ✅ | ✅ | ✅ | ❌ |
| Read/update own order | ✅ | ✅ giới hạn field/state | ❌ | ❌ |
| Reassign/financial edit | ✅ | ❌ | ❌ | ❌ |
| Record receipt | ✅ | ✅ own order | ❌ | ❌ |
| Refund/return approval | ✅ | ❌ | ❌ | ❌ |
| Own commission read | ✅ | ✅ | ❌ | ❌ |
| Approve/pay commission | ✅ | ❌ | ❌ | ❌ |
| Full customer export | ✅ + audit | ❌ | ❌ | ❌ |
| Audit log read | ✅ | ❌ | ❌ | ❌ |

RLS là lớp chặn cuối; service layer vẫn kiểm quyền và field-level mutation. List, detail và mutation đều có IDOR test riêng.

## 6. Idempotency và concurrency

- Key unique theo `(organization_id, operation, idempotency_key)` hoặc bảng đích tương đương.
- Cùng key + cùng payload trả lại kết quả cũ; cùng key + payload khác trả `CONFLICT`.
- Order mutable dùng `version`; update `WHERE id=? AND version=?`, tăng version sau success.
- Reserve, fulfill, return, refund, payout phải transaction atomic.
- Không gửi notification/success response trước commit.

## 7. Logging và privacy

Log: `requestId`, operation, duration, status, actor pseudonymous ID, entity ID. Redact phone/address/token/service key. Audit business event tách khỏi application log và không phụ thuộc log retention của hosting.
