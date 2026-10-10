# Cá Bống Sông Trà V2

Monorepo V2 đang thay thế runtime cũ bằng:

- `apps/web`: Next.js App Router, BFF same-origin.
- `apps/api`: NestJS modular monolith, OpenAPI, Mongoose.
- `packages/contracts`: quy tắc domain và contract dùng chung.
- MongoDB replica set/Atlas là source of truth.

## Chạy local

Yêu cầu Node.js 22+, pnpm 10.18.3 và MongoDB replica set.

```bash
pnpm install
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
pnpm dev
```

Trên Windows PowerShell dùng `Copy-Item` thay cho `cp`. Mỗi workspace đọc file môi trường trong chính thư mục ứng dụng; không commit các file này. Web mặc định ở `http://localhost:3000`; API ở `http://localhost:4000/api/v1`.

## Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Tài liệu canonical

Đọc `docs/phuong-an-cuoi-cung/README_V2.md`. Tài liệu và runtime Supabase/Google Sheets cũ không còn là nguồn triển khai V2.

## Trạng thái

Foundation đã có monorepo, NestJS/Mongoose bootstrap, OpenAPI, BFF, catalog song ngữ và các pure-domain tests. Các vertical slice auth/order/inventory/payment/finance vẫn phải hoàn thiện và vượt integration/concurrency/UAT gates trước production.