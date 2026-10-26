# Test Report — evidence-backed

## Environment
Windows; Node v26.7.0, pnpm10.18.3, Vitest4.1.11; repository HEAD 1c4d7693d98e5e22d517ce15db41cd8adb2236c7. CI dùng Node22; chưa rerun đúng CI version/frozen install. Không DB thật/network transactions. Build scripts có đọc .env.local nội bộ; không xuất credentials.

## Baseline và final
| Gate | Baseline trước audit tests | Final | Evidence |
|---|---|---|---|
| pnpm verify | FAIL tại lint | Không PASS; các gate chạy riêng | lint.json và gate logs |
| lint API | FAIL 4 errors | FAIL 4 errors | final-lint.json |
| lint web | FAIL 7 errors | FAIL 7 errors | web-lint.json |
| typecheck | PASS trước audit tests | PASS | final-typecheck.json |
| API tests | 183 PASS, 2 FAIL /185 | 198 PASS, 2 FAIL /200; 23 files | final-api-tests.json |
| Web tests | 163 PASS /163 | 167 PASS /167; 18 files | final-web-tests.json |
| build API+web | PASS | PASS | final-build.json |
| production dependency audit | FAIL 4 advisory | Chưa nâng dependency | audit.json |

Final test totals: **365 passed, 2 failed, 367 tests**. Hai failing tests vẫn là Owner MFA login/session tại owner-blockers.test.ts:71,77. pnpm recursive wrapper có thêm thông báo “vitest not found” sau failure, nhưng Vitest thực đã chạy và xuất 2 assertion failures; không nhầm thành thiếu framework.

## Added audit reproductions: 19/19 PASS
- API `test/audit-business-invariants.test.ts`: 10 tests, B01/B05 returned/cancelled resume without outbound; B02 deliveredAt overwrite; B03/B04 cost remainder/free goods; B06 metric ignored; B07 early settle/zero snapshot; B08 mutable settled preview; B09 no KPI clawback; B10 commission contract divergence.
- API `test/audit-security-boundaries.test.ts`: 5 tests, resettable client bucket + quota control, invalid reset hash-before-lookup, media metadata/input query boundary, hardcoded origin acceptance.
- Web `lib/audit-frontend.test.ts`: 4 tests, clear unresolved checkout produces new key, allUsers missing invalidation, ignored page, changed financial body produces new key.
- Parent reran all 19: `evidence/audit-api-tests.json` (15/15), `audit-web-tests.json` (4/4).

**PASS ở đây xác nhận lỗi/hành vi hiện tại có thể tái hiện, không xác nhận an toàn hay đã sửa.** BUS-08 static source proof chưa Mongo aggregation test; keyboard/modal code-level proof chưa browser reproduction; BUS-07/09 cần policy decision.

## Transient audit-test regression
Trong lúc nhánh security tạo test, cast Reflector và import.meta không tương thích CommonJS gây 2 compile errors. `typecheck.json` và `build.json` lưu lần fail trung gian; nhánh đã sửa riêng test (không đổi production source). `final-typecheck.json` và `final-build.json` mới là verdict cuối. Không xóa log thất bại hoặc coi lần đó PASS.

## Tests chưa chạy / vì sao
- Mongo replica-set transaction isolation/durability, rollback/failure injection, indexes thật, parallel stock/voucher/payout: chưa có DB test cô lập đã xác nhận; tránh tự kết nối DB trong env thật.
- HTTP/network/browser Owner/Member/guest, HTTPS cookie/SameSite/BFF integration, login/reset/revoke race: tests hiện pure/mock, không có staging credentials/approved isolated environment.
- Cloudinary upload validation/timeout, provider errors: không tác động dịch vụ thực.
- A11y keyboard/screen reader, responsive/device, load/CWV/heap: chưa có test browser/device/load trong scope thực thi này.
- Backup restore, deployment smoke, cloud ACL/secrets rotation, CI Node22 parity: không có bằng chứng quyền/môi trường; không ghi PASS.

## Mandatory regression matrix
Stock onHand/reserved/movement conservation; exact receipt cost=remaining+COGS; return dispositions/refunds/payment bounds; idempotent same/different payload and lost response; authorization current ownership before replay; KPI historical date/metric/window/settled snapshot/bonus accounting; commission paid/unpaid/finalized/return-due matrix; 101+ rows UI; user/expense invalidation; keyboard modal/select. Xem REMEDIATION_PLAN và từng finding cho assertion cụ thể.

## Source remediation status
Không bug production nào đã sửa trong audit này. Không che 2 failures hoặc sửa tests để hợp thức hóa policy drift. Chỉ test-harness compile issues đã sửa và verified bằng final typecheck/build. Working tree chỉ thêm 3 test files và audit reports, không commit.
