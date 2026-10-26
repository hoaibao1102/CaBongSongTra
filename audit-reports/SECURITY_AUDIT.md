# Full System Audit — Cá Bống Sông Trà

**Kết luận: NO-GO production.** Snapshot Git `1c4d7693d98e5e22d517ce15db41cd8adb2236c7`; audit cục bộ theo mã nguồn, unit/mock tests và build. Không kết nối database/user accounts/Cloudinary thật, không chạy migration hoặc thay cấu hình production. Windows, Node v26.7.0, pnpm 10.18.3; CI khai báo Node 22 nên chưa coi local run là parity CI.

Phạm vi repository thực: 142 tracked files; 60 dưới apps/api, 69 dưới apps/web. Review theo trust boundary và workflow, không chứng nhận từng dòng hoặc mọi tổ hợp endpoint đã kiểm thử HTTP. Đường dẫn trong báo cáo tương đối project root. Bằng chứng runtime lưu trong `evidence/`; chi tiết độc lập lưu trong `working/`.

## Phát hiện bổ sung do kiểm chứng hợp nhất

### AUTH-01 — HIGH — MFA production fail-open theo flag tùy chọn
- **Confidence:** cao; 2 regression tests hiện có thất bại trước và sau audit.
- **File/function:** `apps/api/src/auth/auth.service.ts:67-82,85-107`, login/authenticate; `test/owner-blockers.test.ts:61-79`; `README.md:191-197`.
- **Root cause:** chặn Owner chỉ khi OWNER_MFA_ENABLED === true; production tự nó không bắt buộc gate. Không có MFA challenge thực.
- **Repro:** NODE_ENV=production, không bật flag; user Owner ACTIVE và password đúng → createSession; session Owner hợp lệ → authenticate thành công. Hai test production owner MFA gate thực thi đúng chuỗi này.
- **Impact:** password-only Owner access trái acceptance fail-closed. Không khẳng định kẻ không có password đã đăng nhập.
- **Fix / P0:** triển khai MFA được review hoặc khôi phục fail-closed gate production ở cả login/authenticate. Phải phê duyệt vì sẽ chặn toàn bộ Owner operations khi chưa có MFA; không tự thay NODE_ENV để né.
- **Tests:** production flag unset/false/true, session cũ/new, MEMBER không bị chặn, revoked/status/authVersion; HTTP 403 OWNER_MFA_REQUIRED; real HTTPS persona E2E.
- **Trạng thái:** chưa sửa; cần phê duyệt thay đổi availability/authentication.

### DEP-01 — HIGH — Production dependency advisories còn mở
- **Confidence:** cao về package/advisory; exploitability phụ thuộc cấu hình, chưa chạy exploit.
- **Evidence:** `package.json:1`, `apps/api/package.json:1`, `apps/web/package.json:14-20`, pnpm-lock.yaml; `evidence/audit.json` (pnpm audit --prod --json, exit 1).
- Registry báo 4 advisories: 1 critical Next.js GHSA-2464-fhr4-w9xw; 3 high: Next Server Actions GHSA-p3m5-59mp-jv5r, body-parser GHSA-27r3-jxmh-p828, multer GHSA-q7qp-rjg7-q26m.
- **Đối chiếu:** Next 15.5.27 có sharp 0.35.5 (`pnpm --filter @cbst/web why sharp`): đáp ứng workaround RCE >=0.35.5. Không coi registry critical là RCE đã chứng minh trên app. Server Actions DoS cần ít nhất một Server Action; chưa chứng minh điều kiện. Multer cần async fileFilter; chưa chứng minh route Nest dùng. body-parser 2.3.0 trong Nest mặc định parse trước routing là bề mặt cần ưu tiên.
- **Root cause/impact:** dependency tree theo lockfile còn bị advisory đánh dấu; nguy cơ process DoS tại API và rủi ro khi cấu hình khác đi.
- **Fix / P0 trước go-live:** nâng Next >=15.5.28, body-parser >=2.4.0, multer >=2.5.0 theo compatibility tree; frozen install, audit lại và full tests/build. Không chạy audit --fix hoặc override hàng loạt mà chưa review lockfile.
- **Tests:** compressed request negative tests trên process test cô lập; upload abort lifecycle nếu có middleware; build/router/image regression. Không gửi payload phá hoại vào production.

### QC-01 — MEDIUM — Release verification hiện thất bại
- **Evidence:** root package.json verify; `.github/workflows/ci.yml:23-28`; `evidence/lint.json`, `final-lint.json`, `web-lint.json`, `final-api-tests.json`.
- **Confidence:** cao. API lint 4 lỗi, web lint 7 lỗi; 2 API tests fail AUTH-01. pnpm verify dừng tại lint nên build riêng thành công không tương đương verify pass.
- **Root cause:** unused imports/parameters, explicit any và drift security gate; không được bỏ validation/test/lint rule để làm xanh.
- **Impact:** code không qua pipeline khai báo; acceptance security chưa đạt.
- **Fix / P1:** cleanup đúng chỗ và giải quyết AUTH-01 theo policy phê duyệt; rerun full verify Node22 frozen install. Test audit mới đã typecheck sạch.
- **Tests:** lint/typecheck/test/build/audit CI trên cùng commit; không thay test mong muốn chỉ để né lỗi.

## Cách đọc mức tin cậy / ưu tiên

- Mock characterization PASS = cơ chế lỗi đã tái hiện, **không phải bug đã sửa**.
- Static proof = code path có bằng chứng, không thay cho transaction/network test.
- Policy-dependent = cần owner xác nhận; không tự nâng thành exploit chắc chắn.
- P0: release blocker, P1: correctness trước go-live, P2: hardening/scale; priority khác severity.
- Không có CRITICAL exploit application đã được chứng minh. Critical chỉ là mức advisory dependency, có workaround như nêu trên.

## Thứ tự ưu tiên áp dụng cho findings bên dưới

| Nhóm | Ưu tiên | Trạng thái |
|---|---|---|
| AUTH-01, BUS-01/02/04/05/06/08, FE-01/02, DEP-01 | P0 release-blocker | Open; policy-sensitive cần phê duyệt |
| BUS-03, SEC-01/02/03, FE-03/04/05/06/07, QC-01 | P1 trước production | Open |
| BUS-07/09 | P0 quyết định policy; sau đó remediation P1 | Decision required, không đổi công thức tự ý |
| SEC-04, FE-08/09 | P2 hoặc trước đổi deployment/domain | Open |

# Audit bảo mật độc lập — bằng chứng tĩnh và tái hiện mock

## Phạm vi và giới hạn

- Repository: `D:/BANHANG/web/ca-bong-song-tra-nextjs-v1/ca-bong-song-tra-v1`; HEAD `1c4d7693d98e5e22d517ce15db41cd8adb2236c7`.
- Đọc luồng AuthService/password/session, guard/controller/DTO/repository/models V2, reset mật khẩu, BFF, upload/media và các sink frontend liên quan.
- Không sửa source/config production, không commit, không đọc `.env` thực tế, không in secret, không mở kết nối DB, không gọi Cloudinary hoặc deployment thật.
- Kiểm chứng bằng local static trace và unit/mock test. Không chạy app qua AppModule vì module đó tự khởi tạo MongoDB. Không coi mock là kiểm thử tích hợp DB hay pentest production.
- Mức độ dưới đây phản ánh điều kiện khai thác thực sự nhìn thấy; không có finding Critical/High đã chứng minh. Có 4 finding: 3 Medium, 1 Low có điều kiện. Các test cố ý chứng minh hành vi hiện tại, không có nghĩa hành vi đó an toàn.

## Kết quả thực thi

File tái hiện: `apps/api/test/audit-security-boundaries.test.ts`.

Lệnh chạy từ `apps/api`:

```text
pnpm exec vitest run test/audit-security-boundaries.test.ts test/auth-security.test.ts test/auth-service.test.ts test/media.test.ts test/v2-boundaries.test.ts --maxWorkers=1 --reporter=verbose
Test Files  5 passed (5)
Tests       26 passed (26)
Duration    7.37s
```

Trong đó test audit mới: **5/5 pass** (SEC-01 có thêm negative/control test). Sau khi sửa riêng test để tương thích CommonJS (bỏ import.meta) và cast mock Reflector qua unknown, đã chạy lại `pnpm exec tsc --noEmit` **PASS**, `pnpm exec eslint test/audit-security-boundaries.test.ts --max-warnings=0` **PASS**, audit test **5/5 PASS** (2.16s). Không sửa production source. Đây không phải tuyên bố toàn bộ lint repository sạch; baseline do parent quản lý. Chạy lần đầu mặc định worker bị timeout sau 90 giây, không có verdict; chạy lại giới hạn worker hoàn tất. Không dùng output timeout làm bằng chứng pass.

## SEC-01 — Rate limit theo cookie định danh có thể reset bằng bỏ cookie

**Medium — CWE-799 / CWE-770. Đã tái hiện local mock.**

**Bằng chứng:**
- `apps/web/lib/bff.ts:171-193`: không có cookie hợp lệ thì sinh client ngẫu nhiên mới và ký cookie.
- `apps/web/lib/bff.ts:194-201`: mỗi request được ký danh tính client đó để chuyển lên API.
- `apps/api/src/v2/http.ts:45-52`: danh tính ký hợp lệ trở thành `bff:<client>`, không kết hợp địa chỉ mạng.
- `apps/api/src/v2/http.ts:86-99`: bucket public POST theo danh tính này, quota login 10/phút, route khác 20/phút; email login/reset token chỉ là bucket phụ ở dòng 94-95.

**Root cause:** chữ ký xác thực nguồn phát hành danh tính nhưng không đảm bảo tính ổn định của chủ thể. Chính BFF cấp lại danh tính miễn phí cho mỗi request không mang cookie. Không có quota theo nguồn mạng hoặc ngân sách route bên cạnh quota cookie.

**Repro an toàn đã chạy:** gọi hàm `proxy()` 21 lần POST pricing/quote không Cookie; fetcher mock đưa header sang `ApiGuard` thật và bộ đếm Map mock, cùng `ip=192.0.2.25`. Cả 21 response 200, 21 danh tính khác nhau, mỗi bucket count=1. Control gọi guard cùng danh tính 21 lần thì lần 21 bị 429. Không phát request mạng.

**Impact có căn cứ:** client tự động có thể né quota chủ thể qua BFF trên public quote, checkout (nếu bật), reset. Login vẫn có quota theo cùng email nên **không kết luận** brute force không giới hạn một tài khoản; luân chuyển nhiều email có thể tránh quota client. Rate record và công việc backend có thể bị khuếch đại. Chưa đo DoS hay chứng minh cạn tài nguyên production.

**Fix:** giữ danh tính cookie cho telemetry/UX nhưng thêm quota mạng ở ingress đáng tin cậy hoặc định danh server-side theo IP được proxy xác nhận, quota tổng route và ngân sách hash. Không tin trực tiếp X-Forwarded-For người dùng gửi. Nếu cần ký IP từ BFF, lấy từ metadata hạ tầng đã xác minh, không từ header tùy ý.

**Tests cần sau sửa:** 21 request không Cookie cùng nguồn vẫn bị chặn; cookie sai/luân chuyển không reset quota mạng; khác IP không vô tình chung bucket; quota email tiếp tục có tác dụng; boundary phút và concurrency.

## SEC-02 — Token reset không hợp lệ vẫn kích hoạt Argon2 trước kiểm tra token

**Medium — CWE-400 / CWE-770. Đã tái hiện thứ tự gọi bằng mock.**

**Bằng chứng:** `apps/api/src/v2/password-reset.ts:28-35`: `hashPassword()` tại dòng 30 chạy trước lookup `findOneAndDelete` dòng 32. `apps/api/src/auth/password.ts:3-11` dùng Argon2id memoryCost 19.456 KiB, timeCost=2. Endpoint public ở `apps/api/src/v2/controller.ts:53-54`; rate limit có điểm yếu SEC-01.

**Root cause:** tác vụ KDF đắt được thực hiện trước xác nhận reset token tồn tại/chưa hết hạn. DTO regex chỉ đảm bảo hình thức token, không giá trị.

**Repro đã chạy:** gọi PasswordResetService với token giả đúng dạng 43 ký tự và password giả; mock hàm hash ghi event, mock repository trả không tìm thấy. Kết quả 401 và chuỗi event chính xác `[hash, lookup]`. Không chạy flood hay benchmark hash trong repro này.

**Impact:** mọi token bịa đúng dạng có thể yêu cầu một lượt KDF; kết hợp SEC-01 tăng nguy cơ CPU/memory exhaustion. Không chứng minh bypass reset hoặc đổi mật khẩu trái phép; không có số đo outage.

**Fix:** lookup nhẹ token hash + expiry trước KDF; sau KDF vẫn consume token một lần trong transaction bằng điều kiện phù hợp để tránh race. Giới hạn concurrency KDF, quota route/network toàn cục, không giữ transaction DB mở lâu chỉ để hash.

**Tests cần:** token không tồn tại/hết hạn không gọi hash; token hợp lệ gọi một lần; hai request đồng thời chỉ một thành công; rollback/disable/authVersion vẫn đúng; chặn công việc trước khi vượt ngân sách.

## SEC-03 — Media DTO inline-import mất runtime metadata, input object lọt vào query

**Medium (chỉ OWNER_ADMIN) — CWE-20; luồng có đặc tính CWE-943, chưa xác minh DB. Đã tái hiện metadata/ValidationPipe/query mock.**

**Bằng chứng:**
- `apps/api/src/v2/controller.ts:116-118`: `@Body() dto: import("./dto").CreateMediaAssetDto/AssignMediaSlotDto/BulkAssignMediaSlotsDto` không dùng imported constructor runtime.
- `apps/api/src/main.ts:24`: Global ValidationPipe có whitelist/forbid flags nhưng không validate metatype Object.
- `apps/api/src/v2/service.ts:622-628`: `dto.slotKey` đi trực tiếp vào `{ slotKey: dto.slotKey }` trong updateOne; `dto.url` vào `$set`.
- `apps/api/src/v2/dto.ts:179-200`: DTO class có validator nhưng bulk chỉ IsOptional, chưa kiểm tra shape/nested field hay allowlist URL ngay cả nếu sửa metadata.

**Root cause:** TypeScript inline import type không tạo constructor cho decorator metadata; compiler emit `design:paramtypes: [Object, Object]` ở assignMediaSlot. Global pipe bỏ qua Object; type TypeScript không phải runtime validation. Input không được thu hẹp lại trong service.

**Repro đã chạy:** transpile controller thật bằng TypeScript với experimentalDecorators và emitDecoratorMetadata, assert block `Post("media/slots")` chứa metadata Object. Dùng ValidationPipe cấu hình tương đương main.ts cho payload `{slotKey: {$ne: ""}, url: {unvalidated:true}, unexpected:"accepted"}` với metatype Object: payload được chấp nhận nguyên vẹn. Gọi service thật với OWNER_ADMIN, assert updateOne mock nhận filter `{slotKey: {$ne:""}}`.

**Impact được chứng minh:** input sai kiểu/field ngoài hợp đồng vượt boundary và tới repository, có thể làm hỏng state hoặc cập nhật slot khác dự định nếu DB chấp nhận operator. Chưa chạy Mongo nên không khẳng định tác động query thật/cast/sanitization; không khẳng định sửa mọi slot. Guard OWNER vẫn tồn tại: **không phải unauthenticated NoSQL injection, không chứng minh leo quyền hoặc XSS**. URL chưa restrict protocol/host; hiện frontend hiển thị bằng img nên không suy diễn javascript URL thành thực thi script.

**Fix:** import DTO class bằng value import, dùng constructor trực tiếp ở annotation, thêm ApiBody khi cần; typed nested DTO cho images/gallery, array limits/slot enum, allowlist https URL hoặc CDN; service kiểm tra scalar trước build query, cân nhắc sanitizeFilter defense-in-depth và runValidators khi update.

**Tests cần:** HTTP/compiled metadata thực dùng DTO constructor; object/operator ở slotKey và URL bị 400; extra keys bị chặn; gallery/images sai kiểu và URL ngoài allowlist bị chặn; MEMBER/guest bị 403/401 trước write; valid sync hoạt động.

## SEC-04 — Host deployment cố định luôn được tin dù không có trong allowlist cấu hình

**Low, phụ thuộc quyền kiểm soát host cố định — CWE-346. Đã tái hiện guard; chưa chứng minh CSRF exploit.**

**Bằng chứng:** `apps/api/src/v2/http.ts:74-80` luôn cho phép `https://ca-bong-song-tra.vercel.app`; `apps/api/src/main.ts:16-23` tự thêm host đó vào CORS với credentials=true dù operator cấu hình origin khác.

**Root cause:** cấu hình allowlist không phải nguồn policy duy nhất; một deployment host được hardcode ngoài cấu hình.

**Repro đã chạy:** CORS_ALLOWED_ORIGINS chỉ `https://audit.example`; guard vẫn nhận POST public quote từ origin host cố định. Origin thứ ba tùy ý bị 403. CORS bootstrap chỉ kiểm tra tĩnh, không khởi động app.

**Impact:** người vận hành không thể bỏ tin host cố định qua env. Nếu chuyển domain hoặc host cũ bị người khác kiểm soát, boundary Origin/CORS rộng hơn dự kiến. Chưa xác minh ai sở hữu host; cookie SameSite=Strict production và BFF same-origin vẫn giảm bề mặt, nên **không kết luận CSRF đánh cắp session khả thi**.

**Fix/tests:** bỏ implicit host, cấu hình danh sách explicit từng môi trường; production fail closed khi thiếu origin hoặc wildcard. Test host không trong cấu hình bị từ chối ở cả guard và CORS; chỉ host cấu hình được phép; missing/null/cross-site origin không bypass.

## Những boundary đã đọc nhưng chưa thấy bypass được chứng minh

| Hạng mục | Bằng chứng và nhận xét |
|---|---|
| IDOR orders | `v2/policy.ts:5`, `v2/repository.ts:75-78`, `v2/service.ts:171-176,208-211,278-282`: MEMBER scoped theo responsibleMemberId; check trước replay và trong transaction. Không có IDOR được chứng minh trong các đường này. |
| IDOR bank/commissions | `v2/service.ts:529-539` kiểm tra owner hoặc self trước idempotency; `v2/controller.ts:102-103` commissions/me filter actor.id, danh sách toàn bộ owner-only. |
| Owner APIs | Controller có @Owner và `v2/http.ts:113` thực thi. Module đăng ký global guard/filter (`v2/module.ts:10-12`). Media service actor optional là defense-in-depth yếu nhưng controller luôn truyền actor và guard owner; không gán bypass không xác thực chỉ từ signature service. |
| Session | `auth/auth.service.ts:48-60,72-81,85-106`: opaque token, HMAC hash, idle 30 phút/absolute 12 giờ, status/authVersion, revoke. `v2/models.ts:53-74` active schemas có authVersion; schema cũ riêng trong auth/session.schema.ts không phải schema repository dùng. Cookie HttpOnly/Secure/Strict tùy NODE_ENV (`v2/controller.ts:12-18,68-75`); chưa xác minh env thực tế/HTTPS proxy. |
| Password/reset | Argon2id; token random 32 byte; reset hash SHA-256, expiry 15 phút; consume transaction, revoke session/authVersion; token plaintext trả chỉ owner để giao out-of-band, không ghi vào idempotency (`v2/password-reset.ts:10-38`). Không coi đây tự động là secret leak. MFA flag hiện fail closed OWNER_MFA_REQUIRED, không phải MFA challenge triển khai đầy đủ. |
| CSRF | BFF exact origin, cross-site check, JSON-only (`web/lib/bff.ts:107-119`); API mutation origin + JSON check (`v2/http.ts:68-85`); upload/media origin và role checks. Ngoại lệ policy SEC-04. Không kiểm chứng browser/production end-to-end. |
| SSRF/BFF | `web/lib/bff.ts:58-95,214-220`: upstream từ server config, path/method allowlist, không follow redirect; query chỉ page/limit. Upload JSON chỉ data:image png/jpeg/webp/gif (`app/api/upload/route.ts:116-118`), không nhận URL tùy ý. Không thấy đường public chọn arbitrary upstream. Internal URL là trusted config, chưa xác minh giá trị thực tế. |
| XSS | Scan `apps/**/*.{ts,tsx}` không thấy dangerouslySetInnerHTML, innerHTML, eval hoặc Function sink. Media từ API được gắn img (LandingImage.tsx:11, screens.tsx:614-616,737-738); React text escaping thông thường. Không chứng minh stored/reflected XSS; metadata URL thiếu restriction không đủ làm PoC XSS. |
| Dữ liệu nhạy cảm | `v2/models.ts:53`: passwordHash select:false; `v2/controller.ts:93`: owner user projection rõ ràng; `auth/auth.service.ts:63-65`: profile allowlist; `v2/policy.ts:17-35` ẩn cost owner-only. Bank info/PII được lưu dạng trường string và idempotency response có thể chứa bank-info; chưa xác minh encryption-at-rest, retention, ACL DB/backups — không suy diễn là DB public. |

## Hardening / chưa đủ điều kiện đưa thành finding khai thác

1. Upload xác thực sau khi buffer tối đa 8 MiB (`web/app/api/upload/route.ts:79-83`), auth/me và Cloudinary fetch không có timeout (`46-50,135-141`); media owner/sync tương tự (`web/app/api/media/route.ts:49,111-116`). Nên auth trước đọc body khi khả thi, deadline và quota upload. Chưa đo tác động tài nguyên hoặc có outage.
2. Multipart upload chỉ tin file.type startsWith(image/) (`upload/route.ts:98-107`), rộng hơn JSON format allowlist; chưa sniff/decode hoặc giới hạn dimensions. Cloudinary có thể kiểm tra riêng; không gọi provider nên chưa xác minh bypass. Không tuyên bố SVG upload đồng nghĩa XSS trên origin ứng dụng.
3. Upload/media trả lỗi exception/upstream khá thô (`upload/route.ts:145-165`, `media/route.ts:121-123`); nên error-code allowlist/redaction nhất quán BFF. Chưa quan sát secret leak thực tế.
4. Public GET media trả gallery toàn bộ (`v2/service.ts:574-591`), không pagination. Nếu cần media nháp/nội bộ phải tách published state; chưa có bằng chứng dữ liệu gallery thực là riêng tư.
5. Không kiểm tra package CVE hiện thời qua network/audit registry; không đưa claim version dễ khai thác từ trí nhớ. Không kiểm tra TLS, CDN/WAF, deployment ownership, cloud ACL, index thực tế, dữ liệu DB, backup, token revocation concurrency qua DB thật, hoặc browser cookie behavior thật.

## Giao việc khuyến nghị

- Ưu tiên sửa SEC-01 + SEC-02 cùng nhau để chặn đường tiêu hao tài nguyên public.
- Sửa SEC-03 trước mở rộng endpoint media, giữ owner guard; thêm HTTP validation test chạy qua Nest compilation thực.
- Bỏ host hardcode SEC-04 trước chuyển deployment/domain.
- Sau sửa, chuyển repro hiện tại sang assertion hành vi an toàn (ví dụ cookie reset vẫn rate limited, invalid token không gọi KDF, payload media invalid bị 400); chạy lại suite auth/authorization và thêm integration môi trường DB test tách biệt khi được phép.
## Lưu ý hợp nhất
Mô tả MFA flag trong working report không đồng nghĩa production fail-closed: AUTH-01 ở trên và hai test thất bại là kết luận hợp nhất. Dependency đã kiểm qua registry ở DEP-01; giới hạn “chưa audit registry” của nhánh độc lập không áp dụng kết quả hợp nhất.
