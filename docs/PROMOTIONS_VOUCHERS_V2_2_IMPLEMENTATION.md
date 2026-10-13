# Phân hệ Khuyến mãi & Voucher nội bộ V2.2

## 1. Mục tiêu và phạm vi

V2.2 bổ sung hai cơ chế giảm giá nhưng giữ MongoDB là nguồn sự thật và giữ nguyên các bất biến kho, thanh toán, hoàn hàng, hoa hồng:

1. **Promotion công khai:** giá ưu đãi theo SKU và khoảng thời gian `[startAt, endAt)`; mỗi SKU chỉ có tối đa một promotion đang hiệu lực tại một thời điểm.
2. **Voucher nội bộ:** chỉ Owner/Member đăng nhập được sử dụng; Member chỉ thấy voucher được cấp cho mình; voucher không cộng dồn promotion.

Không thuộc V2.2: phí ship khách trả, COD custody, worker tự hết hạn reservation, promotion stacking, voucher công khai, xóa/sửa lịch sử giá của order.

## 2. Quyết định ràng buộc

- Tiền là integer VND; tỷ lệ phần trăm là basis points.
- Thời gian lưu UTC; khoảng hiệu lực là `startAt <= now < endAt`.
- Backend luôn là nguồn tính giá cuối cùng.
- `pricingMode`: `BASE_PRICE | PUBLIC_PROMOTIONS | INTERNAL_VOUCHER`.
- Voucher đưa toàn bộ giỏ về retail price trước khi giảm; không cộng dồn promotion.
- Reservation voucher **không tự hết hạn** trong V2.2. Nó kết thúc khi order được xác nhận hoặc hủy.
- `DELIVERY_FAILED` không giải phóng voucher vì order có thể giao lại.
- Voucher đã `CONSUMED` không được hoàn lượt sau khi đã stock-out/giao/return/refund.
- Promotion/voucher đã được snapshot vào order không bị sửa ngược khi cấu hình nguồn thay đổi.
- Public checkout không nhận `voucherCode`; internal order dùng DTO riêng.
- V2.2 không thêm `shippingFeeVnd`; `orderTotalVnd` chỉ là tổng hàng sau giảm.

## 3. Mô hình tài chính

```text
merchandiseSubtotalVnd = Σ grossLineTotalVnd
discountVnd            = Σ lineDiscountVnd
orderTotalVnd          = merchandiseSubtotalVnd - discountVnd
collectedVnd           = receiptsVnd - refundsVnd
recognizedRevenueVnd   = orderTotalVnd - returnValueVnd - refundsVnd + returnRefundsVnd
returnRefundDueVnd      = max(0, receiptsVnd - orderTotalVnd + returnValueVnd - returnRefundsVnd)
baseProfitVnd           = recognizedRevenueVnd - cogsVnd - directCostsVnd
```

Hoa hồng chỉ được ghi nhận nếu:

- order đã từng DELIVERED;
- chi phí đã finalized;
- `collectedVnd >= recognizedRevenueVnd`;
- `returnRefundDueVnd === 0`;
- `baseProfitVnd > 0`;
- có `responsibleMemberId`.

## 4. Snapshot giá trên order

Mỗi order mới lưu `pricingSchemaVersion: 2`, `pricingMode`, `merchandiseSubtotalVnd`, `discountVnd`, `totalVnd`, `pricedAt` và trên từng dòng:

```ts
{
  sku: string;
  qty: number;
  retailUnitPriceVnd: number;
  unitPriceVnd: number;          // giá hiệu lực trung bình dùng tương thích projection cũ
  grossLineTotalVnd: number;
  lineDiscountVnd: number;
  finalLineTotalVnd: number;
  discountSourceType: "NONE" | "PROMOTION" | "VOUCHER";
  discountSourceId?: string;
  discountLabelSnapshot?: string;
}
```

Order cũ thiếu `pricingSchemaVersion` được đọc tương thích như version 1; không backfill và không tính lại.

## 5. Phân bổ và partial return

Giảm giá được phân bổ theo Largest Remainder bằng số nguyên. Khi trả `k` sản phẩm của một dòng có `q` sản phẩm, credit tích lũy là:

```text
cumulativeCredit(k) = floor(finalLineTotalVnd × k / q)
creditThisReturn = cumulativeCredit(returnedAfter) - cumulativeCredit(returnedBefore)
```

Lần trả cuối tự nhận phần dư; tổng return credit không bao giờ vượt `finalLineTotalVnd`.

## 6. Voucher

Voucher có `reservedCount`, `consumedCount`; invariant:

```text
reservedCount >= 0
consumedCount >= 0
reservedCount + consumedCount <= maxUsageTotal
```

Vòng đời:

```text
Create internal PENDING with voucher:
  NONE -> RESERVED
  reservedCount + 1

PENDING -> CONFIRMED:
  RESERVED -> CONSUMED
  reservedCount - 1; consumedCount + 1

PENDING -> CANCELLED:
  RESERVED -> RELEASED
  reservedCount - 1

CONFIRMED/PACKING -> CANCELLED before stock-out:
  CONSUMED -> RELEASED
  consumedCount - 1

DELIVERY_FAILED / SHIPPING / DELIVERED / returns:
  remains CONSUMED
```

Giới hạn theo khách được bảo vệ bằng projection có unique key `(voucherId, customerPhoneNormalized)` và atomic counters trong cùng transaction.

## 7. Promotion

V2.2 hỗ trợ CRUD Owner với optimistic `version` và idempotency. Mỗi SKU chỉ có tối đa một promotion có khoảng thời gian giao nhau. Mutation phải kiểm tra conflict trong transaction và có storage-level serialization phù hợp với ba SKU; không dùng date-slot theo ngày hoặc mutex TTL mơ hồ.

Promotion hỗ trợ:

- `FIXED_PER_UNIT`: số VND giảm trên mỗi đơn vị, không thấp hơn 0đ.
- `PERCENT`: basis points, bắt buộc có `maxDiscountVnd` cấp dòng.

## 8. Price guard

Quote trả `pricingFingerprint`, pricing mode, các dòng và total. Create order nhận `clientExpectedTotalVnd` và `pricingFingerprint`; backend tính lại trong transaction. Nếu khác, trả `409 PRICE_STALE_CONFIRMATION_REQUIRED` cùng quote an toàn không chứa dữ liệu nội bộ.

Catalog giữ `no-store` trong V2.2. Client refetch tại `promotionEndsAt` và khi tab trở lại foreground. Chưa thêm CDN cache/revalidatePath.

## 9. RBAC

- Guest: chỉ xem catalog/effective public prices và public checkout.
- Member: xem voucher được cấp cho mình, verify voucher, tạo internal order của mình.
- Owner: CRUD promotion/voucher, xem toàn bộ redemption/counters.
- BFF dùng allowlist route/method; backend là authorization boundary.
- Public response không lộ voucher code, assignment, usage limits/counters hoặc redemption.

## 10. Migration và rollback

- Không sửa document order cũ.
- Reader dùng fallback từ `totalVnd/items.unitPriceVnd` cho schema version 1.
- Trước production: backup toàn database, checksum, restore staging và reconciliation.
- Rollback code chỉ được phép sau compatibility test; nếu không, chuyển maintenance/read-only.

## 11. Acceptance

- AC-PRICE-001: tổng discount dòng bằng discount order chính xác từng đồng.
- AC-RETURN-001: partial returns tuần tự cộng lại đúng final line total.
- AC-VOUCHER-001: tranh lượt cuối chỉ đúng một order thành công trên replica set thật.
- AC-VOUCHER-002: same idempotency key/same payload replay một order, một redemption, một counter delta.
- AC-VOUCHER-003: same key/different payload trả `IDEMPOTENCY_CONFLICT`.
- AC-VOUCHER-004: cancel/retry không release hai lần; counter không âm.
- AC-VOUCHER-005: `DELIVERY_FAILED` không release voucher.
- AC-CUSTOMER-001: giới hạn theo phone normalized không bị vượt khi concurrent.
- AC-PROMO-001: promotion overlap cùng SKU bị 409; khác SKU hoặc boundary `endAt == startAt` hợp lệ.
- AC-STALE-001: quote cũ bị 409 và không tạo order/counter side effect.
- AC-RBAC-001: guest không thấy voucher; Member không thấy voucher người khác; Owner thấy toàn bộ.
- AC-MIG-001: order version 1 đọc đúng và không bị ghi lại.
- AC-FIN-001: order lỗ hoặc còn return refund due có commission 0.
- AC-EDIT-001: edit order chạy lại pricing atomically hoặc bị chặn bằng stable error.
- AC-BFF-001: route/method allowlist cho promotion/voucher đúng và mutation giữ Origin/JSON/idempotency controls.
- AC-QUALITY-001: lint 0 warning, typecheck pass, toàn bộ test pass, production build pass.
