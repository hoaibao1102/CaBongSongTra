# BUS-01/02 — order lifecycle remediation

## Scope/invariants
Không kết nối database hoặc khởi động AppModule. Pure/service mock tests chỉ chứng minh source behavior.
- returnedQty là physical fact, không thể xóa bằng sửa status; không quay lại pending/reserve/outbound/delivered sau nhận trả vật lý bằng transition này.
- shippedAt không thể được biến thành pre-fulfillment state, tránh UI coi hàng đã xuất là hàng chờ giữ mới.
- shipped CANCELLED không được re-activate trực tiếp bằng status-only; cần reconciliation/new fulfillment design riêng.
- deliveredAt ghi lần đầu, correction không chuyển bucket KPI lịch sử.
- Delivery retry trước physical return vẫn không double outbound; same-state retry không ghi lại timestamp hay journal.

## TDD evidence
`remediation-evidence/orders-red.json`: 9 FAIL /2 PASS trước source fix, sai behavior đúng cơ chế audit.
`orders-green.json`: 44 PASS focused (11 new + existing workflow).
Thêm guard prefulfillment tracer: `orders-prefill-red.json` 3 FAIL /11 PASS; `orders-prefill-green.json` 47 PASS (14 new +33 existing).
Code: CommerceService.transition trong service.ts. Tests: business-order-remediation.test.ts; v2-workflow.test.ts đổi assertions correction PENDING/CONFIRMED/PACKING sau shipment thành rejection (không disable test). Audit characterization B01/B02/B05 chuyển sang desired behavior.

## Compatibility/backfill
Không schema change. API thêm 409 stable codes PHYSICAL_RETURN_REQUIRES_NEW_ORDER, SHIPPED_CANCELLATION_REQUIRES_RECONCILIATION, SHIPPED_ORDER_CANNOT_RETURN_TO_PREFULFILLMENT. Old UI có thể vẫn đề nghị status correction bị reject; đây là intended safety restriction, không dựng fulfillment mới tự động.
Không sửa dữ liệu lịch sử. deliveredAt đã bị overwrite không thể suy ra nguyên bản bằng code; cần read-only audit-log/ledger/movement reconciliation và owner-approved backfill riêng, không chạy hiện tại. Existing impossible states không tự repair.

## Policy boundaries
Không thay commissionTarget/BUS09 hoặc KPI clawback/BUS07. Tất cả administrative correction semantics (reopen cancellation, recognition reversal/rebook, allowed state matrix) vẫn cần policy, không thay bằng strict graph mới toàn hệ thống. New physical resend workflow cần decision/contract riêng. Hai invariants chính BUS01/02 FIXED_UNIT_VERIFIED; Mongo transactions/concurrency/durability PENDING_INTEGRATION_VERIFICATION.
