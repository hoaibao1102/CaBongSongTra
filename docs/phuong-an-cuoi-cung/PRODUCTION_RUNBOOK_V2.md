# PRODUCTION RUNBOOK V2

## Gate

CI xanh; Atlas transaction/concurrency pass; IDOR pass; Owner MFA; backup mã hóa và restore staging pass; UAT Owner + 1–2 Member; hosting thương mại; nội dung nhãn/chính sách được duyệt.

## Hằng ngày

Kiểm PENDING quá hạn, SHIPPING/COD chưa đối soát, batch gần hết hạn, return mở, commission pending cost, 5xx/checkout failures.

## Sự cố

1. Chặn mutation nhạy cảm hoặc bật maintenance.
2. Thu thập requestId, deployment, actor, DB state; không retry write thủ công nếu thiếu idempotency.
3. Rollback app tương thích schema; restore DB vào môi trường tách biệt trước.
4. Đối soát order/inventory/payment/commission trước cutover phục hồi.
5. Lập postmortem và corrective actions.

## Mục tiêu

RPO ≤24h, RTO ≤4h chỉ được tuyên bố sau restore drill thực tế.
