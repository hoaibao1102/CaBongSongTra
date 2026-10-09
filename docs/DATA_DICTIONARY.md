# DATA DICTIONARY — P0a CÁ BỐNG SÔNG TRÀ

> Phiên bản: 1.0 — 09/10/2026  
> Trạng thái: Canonical schema contract cho P0a.  
> Quy ước: PostgreSQL/Supabase; UUID PK; timestamp UTC; tiền là `bigint` VND; ID là opaque string ở client.

## 1. Quy ước bất biến

- Mọi bảng business có `created_at`; bảng mutable có `updated_at`.
- Không dùng floating point cho tiền/tỷ lệ. Commission rate lưu basis points (`4000` = 40%).
- Không hard-delete order, payment, ledger, commission, payout hoặc audit log.
- Giá, vốn, promotion và commission được snapshot trên đơn/bản ghi tài chính.
- `inventory_ledger`, `payments`, `commission_adjustments`, `audit_logs` là append-only.
- Tenant model P0a là một organization duy nhất; vẫn có `organization_id` trên bảng business để tránh migration phá vỡ khi mở rộng.
- Mọi query server phải lấy `organization_id` từ session/profile, không nhận tenant tin cậy từ client.

## 2. Enum canonical

```ts
type Role = "OWNER_ADMIN" | "MEMBER";
type ProductStatus = "DRAFT" | "ACTIVE" | "HIDDEN" | "DISCONTINUED";
type BatchStatus = "AVAILABLE" | "QUARANTINED" | "DEPLETED" | "EXPIRED";
type ReservationStatus = "ACTIVE" | "CONSUMED" | "RELEASED" | "EXPIRED";
type OrderStatus =
  | "DRAFT" | "CONFIRMED" | "PREPARING" | "SHIPPING" | "DELIVERED"
  | "CANCELLED" | "RETURN_REQUESTED" | "PARTIALLY_RETURNED" | "RETURNED";
type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED";
type PaymentMethod = "BANK_TRANSFER" | "CASH_COD";
type PaymentKind = "RECEIPT" | "REFUND";
type LedgerReason = "RECEIVE" | "FULFILL" | "RETURN_RESTOCK" | "RETURN_QUARANTINE" | "DAMAGE" | "ADJUST" | "EXPIRE";
type CostType = "SHOP_SHIPPING" | "PACKAGING" | "PAYMENT_FEE" | "OTHER_DIRECT" | "MEMBER_ADVANCE_REIMBURSEMENT";
type CostPayer = "SHOP" | "CUSTOMER" | "ADVANCED_BY_MEMBER";
type CommissionStatus = "ESTIMATED" | "ELIGIBLE" | "APPROVED" | "PAID" | "ADJUSTED" | "REVERSED";
type PayoutStatus = "DRAFT" | "APPROVED" | "PAID" | "VOID";
```

Không tạo alias như `completed`, `delivering`, `stock_movements`, `order_payments`, `order_expenses` trong schema mới.

## 3. State machines

### 3.1 Order

| From | Action | To | Actor | Điều kiện/side effect |
|---|---|---|---|---|
| — | create draft | `DRAFT` | Member/Admin | Không reserve; server snapshot giá chỉ để preview |
| `DRAFT` | confirm | `CONFIRMED` | Owner đơn/Admin | Transaction: validate giá/quyền → snapshot → reserve → audit |
| `CONFIRMED` | prepare | `PREPARING` | Owner đơn/Admin | Reservation active; reservation không auto-expire từ đây |
| `PREPARING` | ship | `SHIPPING` | Owner đơn/Admin | Ghi thời điểm bàn giao |
| `SHIPPING` | deliver | `DELIVERED` | Owner đơn/Admin | Transaction: consume reservation, ghi `FULFILL`, chốt COGS |
| `DRAFT` | cancel | `CANCELLED` | Owner đơn/Admin | Không có stock side effect |
| `CONFIRMED` | cancel | `CANCELLED` | Owner đơn/Admin | Release reservation |
| `SHIPPING` | request return | `RETURN_REQUESTED` | Owner đơn/Admin | Không tự nhập lại kho |
| `DELIVERED` | request return | `RETURN_REQUESTED` | Owner đơn/Admin | Freeze commission eligibility |
| `RETURN_REQUESTED` | approve partial | `PARTIALLY_RETURNED` | Admin | Refund/stock/commission adjustment nguyên tử theo item |
| `RETURN_REQUESTED` | approve full | `RETURNED` | Admin | Refund/stock/commission adjustment nguyên tử |

Transition ngoài bảng trả `INVALID_STATE_TRANSITION`. Việc sửa item/qty sau confirm không phải update thường; Admin phải cancel/release rồi tạo revision hoặc adjustment có audit.

### 3.2 Payment

`UNPAID → PARTIALLY_PAID → PAID → PARTIALLY_REFUNDED → REFUNDED`.

Trạng thái là giá trị derived từ tổng `RECEIPT` thành công trừ `REFUND` thành công so với amount due. Không cho client ghi trực tiếp `payment_status`.

### 3.3 Reservation

`ACTIVE → CONSUMED | RELEASED | EXPIRED`. Chỉ một terminal state; transition idempotent. Reservation 24h chỉ áp dụng đơn `CONFIRMED`, chưa có payment thành công và chưa `PREPARING`.

### 3.4 Commission

`ESTIMATED → ELIGIBLE → APPROVED → PAID`; return/refund tạo adjustment và trạng thái tổng hợp `ADJUSTED` hoặc `REVERSED`. Không sửa amount của record đã `PAID`.

## 4. Bảng canonical P0a

### `organizations`
`id`, `name`, `timezone`, `active`.

### `profiles`
`id` FK `auth.users`, `organization_id`, `display_name`, `role`, `active`, `joined_at`, `disabled_at`.

### `products`
`id`, `organization_id`, `sku` unique/org, `slug` unique/org, `name`, `label_net_weight_g`, `description_public`, `status`, `hero_image_path`, `sort_order`.

Constraints: `label_net_weight_g > 0`; seed SKU đúng `DEC-PROD-01`.

### `product_prices`
`id`, `organization_id`, `product_id`, `retail_price`, `effective_from`, `effective_to`, `created_by`, `reason`.

Constraints: price > 0; exclusion/transaction check không chồng khoảng hiệu lực của cùng product.

### `inventory_batches`
`id`, `organization_id`, `product_id`, `lot_code`, `supplier`, `received_at`, `manufactured_at?`, `expires_at?`, `purchase_unit_cost`, `inbound_cost_total`, `landed_unit_cost`, `received_qty`, `status`, `label_evidence_path?`, `notes`.

`landed_unit_cost = purchase_unit_cost + allocated inbound cost/unit`; không tính lại lô cũ khi giá nhập đổi.

### `inventory_ledger`
`id`, `organization_id`, `batch_id`, `product_id`, `order_item_id?`, `qty_delta`, `reason`, `reference_type`, `reference_id`, `actor_id`, `idempotency_key`, `created_at`.

Append-only; unique `(organization_id, idempotency_key)`; tổng theo batch không được âm sau transaction.

### `inventory_reservations`
`id`, `organization_id`, `order_id`, `order_item_id`, `batch_id`, `quantity`, `status`, `reserved_at`, `expires_at`, `released_at?`, `consumed_at?`, `idempotency_key`.

Active quantity không vượt stock on hand; partial item có thể được chia qua nhiều batch.

### `customers`
`id`, `organization_id`, `display_name`, `phone_e164?`, `phone_hash?`, `area`, `address?`, `zalo_id?`, `marketing_opt_in`, `consent_notes`, `created_by`.

Unique phone khi có số: `(organization_id, phone_e164)`; list projection mask PII theo quyền.

### `customer_sources`
`id`, `organization_id`, `label`, `channel`, `campaign_tag?`, `active`.

### `orders`
`id`, `organization_id`, `order_code`, `customer_id`, `owner_member_id`, `source_id?`, `status`, `payment_status` (derived/cache được server duy trì), `currency`, `item_subtotal`, `discount_total`, `customer_shipping_fee`, `gross_due`, `gross_collected`, `placed_at?`, `confirmed_at?`, `fulfilled_at?`, `cancelled_at?`, `cancellation_reason?`, `version`, `created_by`, `idempotency_key`.

Unique `order_code`, unique create `idempotency_key`; `version` phục vụ optimistic concurrency.

### `order_items`
`id`, `organization_id`, `order_id`, `product_id`, `qty`, `unit_list_price_snapshot`, `unit_sell_price_snapshot`, `discount_allocated`, `unit_cogs_snapshot?`, `subtotal`.

COGS null trước fulfill, được chốt từ batch thực xuất khi deliver.

### `payments`
`id`, `organization_id`, `order_id`, `kind`, `method`, `amount`, `status`, `received_at`, `reference?`, `reverses_payment_id?`, `actor_id`, `idempotency_key`.

Amount > 0; refund phải tham chiếu order và không vượt net receipt.

### `order_costs`
`id`, `organization_id`, `order_id`, `type`, `payer`, `amount`, `reconciled`, `evidence_path?`, `note?`, `entered_by`, `approved_by?`.

### `commission_records`
`id`, `organization_id`, `order_id`, `member_id`, `base_profit`, `member_rate_bps`, `member_amount`, `owner_amount`, `policy_version`, `status`, `eligible_at?`, `approved_at?`, `payout_id?`.

Unique `(organization_id, order_id)` trong P0a; owner-admin order có thể không có record.

### `commission_adjustments`
`id`, `organization_id`, `commission_record_id`, `amount_delta`, `reason`, `source_type`, `source_id`, `effective_period`, `created_by`.

### `commission_payouts`
`id`, `organization_id`, `member_id`, `period_start`, `period_end`, `amount`, `status`, `paid_at?`, `method?`, `proof_path?`, `approved_by?`, `idempotency_key`.

### `audit_logs`
`id`, `organization_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `before_json`, `after_json`, `reason`, `request_id`, `ip_hash?`, `created_at`.

Không lưu token, full password, service key hoặc PII không cần thiết.

### `system_settings`
`organization_id`, `name`, `value_json`, `updated_by`, `updated_at`; chỉ Admin ghi. Không dùng cho secret.

## 5. Derived views

- `stock_on_hand_by_batch`: sum ledger.
- `stock_reserved_by_batch`: sum reservation `ACTIVE`.
- `stock_available_by_batch = on_hand - active_reserved`.
- `stock_available_by_product`: tổng batch `AVAILABLE`, chưa hết hạn.
- `order_payment_summary`: receipts − refunds và derived status.
- `member_commission_summary`: estimated/eligible/approved/paid/adjustment theo kỳ.

## 6. Index tối thiểu

- `orders(organization_id, owner_member_id, created_at desc)`
- `orders(organization_id, status, created_at desc)`
- `orders(organization_id, customer_id, fulfilled_at desc)`
- `inventory_batches(organization_id, product_id, status, expires_at, received_at)`
- `inventory_reservations(organization_id, batch_id, status, expires_at)`
- `inventory_ledger(organization_id, batch_id, created_at)`
- `payments(organization_id, order_id, received_at)`
- `commission_records(organization_id, member_id, status, eligible_at)`
- `audit_logs(organization_id, entity_type, entity_id, created_at desc)`

## 7. Migration và compatibility

- Migration versioned SQL, review trước merge.
- Expand/contract; không drop/rename cột khi deployment cũ còn dùng.
- Backfill idempotent và có count/checksum đối chiếu.
- Backup trước migration production; rollback frontend không thay thế rollback dữ liệu.
