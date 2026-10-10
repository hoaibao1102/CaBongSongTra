# API CONTRACTS V2

Base path: `/api/v1`. OpenAPI phát sinh từ NestJS là machine-readable canonical contract.

## Envelope

Success: `{ "data": ..., "requestId": "uuid" }`  
Error: `{ "error": { "code": "VERSION_CONFLICT", "message": "...", "details": [] }, "requestId": "uuid" }`

## Endpoints P0/P1

| Method | Path | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/products` | Public | Projection public |
| POST | `/checkout/orders` | Public | PENDING + Idempotency-Key + anti-abuse |
| POST | `/auth/login` | Public | opaque session cookie |
| POST | `/auth/logout` | Auth | revoke session |
| GET | `/auth/me` | Auth | profile/capabilities |
| GET/POST | `/orders` | Scoped | Member query lấy actor từ session |
| GET/PATCH | `/orders/:id` | Scoped | `_id + actor scope`; expectedVersion |
| POST | `/orders/:id/transitions` | Scoped | state machine + transaction |
| POST | `/orders/:id/payments` | Scoped policy | append ledger; idempotent |
| POST | `/orders/:id/refunds` | Owner | append refund/adjustment |
| GET/POST | `/inventory/batches` | Owner | batch/HSD/evidence |
| POST | `/inventory/adjustments` | Owner | movement append-only |
| GET | `/inventory/availability` | Auth | Member chỉ tổng available/SKU |
| GET | `/commissions/me` | Member | dữ liệu cá nhân |
| GET/POST | `/commissions/payouts` | Owner | chốt theo tháng |
| GET | `/dashboard/owner` | Owner | recognized revenue/cash/profit |
| GET | `/dashboard/me` | Member | KPI cá nhân |
| GET | `/health/live` | Ops | không kiểm DB |
| GET | `/health/ready` | Ops | kiểm dependency an toàn |

Mutation nhạy cảm bắt buộc `Idempotency-Key` và/hoặc `expectedVersion`; lỗi conflict dùng HTTP 409.
