# DECISION LOG V2 — CÁ BỐNG SÔNG TRÀ

> Trạng thái: **APPROVED FOR IMPLEMENTATION**  
> Nguồn: lựa chọn của Owner trong `BANG_CAU_HOI_CHOT_PHUONG_AN_REFACTOR_V2.md`.  
> Thứ tự ưu tiên: Decision Log V2 → SRS V2 → contracts/schema → runbooks → archive.

## Quyết định kiến trúc

| ID | Quyết định |
|---|---|
| DEC-V2-001 | Refactor thành pnpm monorepo gồm `apps/web`, `apps/api`, `packages/contracts`, `packages/config`. |
| DEC-V2-002 | NestJS modular monolith + REST `/api/v1`; OpenAPI là contract canonical; `class-validator` là validation chính. |
| DEC-V2-003 | MongoDB Atlas/Mongoose là source of truth; môi trường chạy transaction phải dùng replica set. |
| DEC-V2-004 | Frontend dùng BFF/proxy same-origin; session opaque server-side bằng HttpOnly cookie. |
| DEC-V2-005 | Production dùng gói hosting thương mại phù hợp; Vercel Hobby bị cấm cho production. |
| DEC-V2-006 | Argon2id; không import mật khẩu plaintext; Owner MFA là gate production. |
| DEC-V2-007 | V2 khởi tạo production trắng; Google Sheets không được import và chỉ giữ archive read-only theo nghĩa vụ lưu trữ. |
| DEC-V2-008 | Code cũ chỉ xóa khi không còn caller, replacement tests pass và đã có snapshot Git/backup. |

## Quyết định nghiệp vụ

| ID | Quyết định |
|---|---|
| DEC-V2-ORD-01 | State machine: `PENDING → CONFIRMED → PACKING → SHIPPING → DELIVERED`; có CANCELLED, DELIVERY_FAILED, RETURN_REQUESTED, PARTIALLY_RETURNED, RETURNED và refund ledger. |
| DEC-V2-INV-01 | Reserve khi CONFIRMED; FEFO theo HSD rồi FIFO; stock-out khi SHIPPING; revenue khi DELIVERED. |
| DEC-V2-INV-02 | Một kho chung; batch thiếu nhãn/HSD bị QUARANTINED; mọi thay đổi kho qua movement append-only. |
| DEC-V2-FIN-01 | Tiền là integer VND; payment/refund/expense/commission/payout là ledger; không sửa lịch sử tài chính. |
| DEC-V2-FIN-02 | Member nhận 40% phần distributable profit dương; đơn Owner không tạo commission Member; lỗ được giữ số âm thật. |
| DEC-V2-AUTH-01 | Chỉ OWNER_ADMIN và MEMBER; Member chỉ truy cập đơn/PII của mình; export chỉ Owner và phải audit. |
| DEC-V2-PROD-01 | SKU `CBST-300/400/600`, giá 109.000/139.000/199.000đ; cost opening 65.000/95.000/140.000đ chỉ là seed dev/staging. |

## Gate bắt buộc

- Vertical TDD, integration MongoDB replica set, concurrency và IDOR tests.
- Local/dev, staging và production tách DB/secrets.
- CI: lint, typecheck, unit, integration, build, security/dependency checks.
- Production: backup/restore drill, UAT Owner + 1–2 Member, MFA, monitoring và owner sign-off.
