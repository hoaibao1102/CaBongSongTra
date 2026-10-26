# Audit frontend — phát hiện có bằng chứng

## Scope, cách kiểm chứng và giới hạn

- Root: `D:/BANHANG/web/ca-bong-song-tra-nextjs-v1/ca-bong-song-tra-v1` (root được giao, không phải thư mục TVS không có Git).
- Rà soát routes storefront/login/reset/admin/info/product detail; các luồng `screens.tsx` (storefront, ActionForm, OrderDetail, InternalOrderCreator, Admin/App); commerce/query-cache/checkout-retry; API DTO, controller, service liên quan. Kiểm tra targeted các manager inventory/product/expense/user/commission/promotion và primitive Modal/SearchableSelect. Đây là audit theo luồng/rủi ro, không khẳng định kiểm từng dòng của mọi manager.
- Chỉ thêm báo cáo này và `apps/web/lib/audit-frontend.test.ts`; không sửa source, không commit. Không truy cập tài khoản/DB thật, không chạy endpoint giao dịch.
- Đã chạy riêng: `cd apps/web && npx vitest run lib/audit-frontend.test.ts` → **1 file, 4 tests passed**, exit 0; duration 2.78s, tests 86ms. Đây là characterization tests: PASS xác nhận hành vi lỗi tồn tại, không phải lỗi đã sửa. Transport dùng mock, không phải bằng chứng đã tạo giao dịch thật.
- Build/baseline thuộc parent. Chỉ đọc artifact `.next` đang có để đo byte; không bảo đảm artifact khớp HEAD. Không có Lighthouse/CWV, browser interaction, screen reader, responsive hay cross-browser verification. Không tuyên bố đã test responsive/WCAG compliance.
- Severity: High = có khả năng nhân đôi giao dịch/mất tính toàn vẹn; Medium = sai dữ liệu vận hành hoặc chặn thao tác nhóm người dùng; Low = contract/UX/performance risk có giới hạn. Confidence là độ chắc của cơ chế code, không phải tần suất production.

## FE-01 — High / High confidence — Nút “bỏ qua phiên dở dang” bỏ hàng rào idempotency của đơn chưa rõ kết quả

**Evidence:** `apps/web/app/screens.tsx:3495-3513` xóa cả `cbst-checkout-retry` và `cbst-internal-checkout-retry`, rồi cho gửi đơn mới; `apps/web/lib/checkout-retry.ts:72-83,101-110` cố ý giữ identity chưa giải quyết và chỉ bảo vệ theo key. `apps/api/src/v2/models.ts:138-140` lưu unique scope/keyHash, keys không hết hạn để tránh retry thực thi hai lần.

**Repro:** Backend nhận đơn A/commit, response bị mất → sửa nội dung → submit báo reconciliation → nhấn nút bỏ phiên → submit lại. Key mới khác key đã commit; server không thể coi đây là retry của A. Test `discarding an ambiguous checkout...` tái hiện chuỗi key bằng mock transport, 2 key khác nhau.

**Root cause:** UI có escape hatch xóa identity mà không tra cứu/reconcile đơn ban đầu. Đồng thời xóa cả slot guest không liên quan.

**Impact:** Có thể sinh hai đơn cho một ý định mua; sai giao hàng, hoa hồng, giữ kho. Đây là nguy cơ logic được chứng minh bằng key, chưa tạo duplicate trên DB thật.

**Fix:** Không cho bỏ identity khi chưa xác minh outcome; có lookup trạng thái bằng identity/operation ID, hiển thị đơn đã tạo hoặc cho retry nguyên request. Chỉ reset slot đúng scope sau khi xác nhận không commit.

**Regression tests:** Mô phỏng commit-then-timeout, đổi nội dung/tài khoản, remount; không key mới trước reconciliation; lookup thấy đơn cũ phải mở đơn đó. Hai checkout slots phải độc lập.

## FE-02 — High / High confidence — Mutation tiền/kho chỉ giữ retry theo body trong RAM, vẫn cho đổi body khi outcome chưa rõ

**Evidence:** `apps/web/lib/commerce.ts:486-512` map signature gồm path/method/guest/body; body thay đổi sinh key mới; map mất khi reload. `apps/web/lib/components/ExpenseManager.tsx:18,108-145` dùng module-level `durableMutation`, không khóa request chưa rõ kết quả sau lỗi; `InventoryManager.tsx:21,216-251,266-299` dùng cùng mô hình. `ActionForm` có busyRef (`screens.tsx:235-267`) nhưng busy chỉ ngăn đồng thời, không reconcile ambiguous result.

**Repro:** Ghi overhead expense 100, server commit nhưng response mất; sửa reason rồi submit. Test `generic mutation allows changing...` cho thấy hai key khác nhau. Reload sau timeout cũng mất key. Test chỉ xác nhận cơ chế request identity; không tuyên bố double-click luôn tạo hai giao dịch (request trùng body đang pending có dùng chung key).

**Root cause:** Tên `durableMutation` không đồng nghĩa durable storage; không ràng buộc operation identity vào thao tác đang unresolved.

**Impact:** Retry sau chỉnh sửa/reload có thể ghi trùng expense, receipt, payout khi nghiệp vụ cho phép thêm giao dịch.

**Fix:** Durable operation record scoped actor/action, lưu canonical payload/key trước gửi; khóa chỉnh sửa hoặc require reconcile outcome; không chỉ thêm disabled vào nút. Phân loại lỗi definitive vs ambiguous.

**Regression tests:** Commit-then-network-error → unchanged retry, edited retry, close/open modal, reload; phải dùng lại operation cũ hoặc chặn để reconcile. Thêm concurrency tests, không suy diễn từ setState/busy sang duplicate chắc chắn.

## FE-03 — Medium / High confidence — Invalidation không khớp key `allUsers`

**Evidence:** Query thật dùng `allUsers` ở `screens.tsx:2038-2044,5448-5453`; `query-cache.ts:128-137` chỉ invalidates `users` cho user_changed/commission actions. UserManager gọi `refresh("user_changed")` tại `screens.tsx:6209-6214`. `allUsers` policy staleTime 3 phút; refetchOnWindowFocus false (`query-cache.ts:55,160`).

**Repro:** Đã cache users directory → đổi status/tên/bank/rate hoặc tạo user ở Users → quay Orders/Commissions trước staleTime. Directory cũ vẫn fresh; assignment options/recipient và bảng ánh xạ không cập nhật. Test `user_changed misses...` chứng minh isInvalidated=false ở đúng key.

**Root cause:** Dùng hai tên logical resource không có shared invalidation prefix.

**Impact:** Không thấy thành viên mới; còn hiển thị thành viên inactive như active; người vận hành chọn dữ liệu cũ (backend vẫn cần enforce status).

**Fix:** Chung key factory/prefix users; invalidate cả section và directory, bao gồm commission rate/bank updates.

**Regression tests:** QueryObserver active và inactive cho cả users/allUsers, mutate user → đều invalidated/refetch; actor khác không bị chia sẻ dữ liệu.

## FE-04 — Medium / High confidence — Bỏ pagination làm mất bản ghi ngoài 100 đầu và không thể chọn đơn cũ để ghi chi phí

**Evidence:** `query-cache.ts:207-214` ép inventory/expenses/users page=0 limit=100 bất kể page; `269-273` directory chỉ 100 đầu. `screens.tsx:6187-6224` manager không được truyền page/next callback. `apps/api/src/v2/controller.ts:91,93,101` backend thực sự skip/limit. `query-cache.ts:259-263` dashboardOrders chỉ 100 đơn mới; `screens.tsx:6202-6204` dùng snapshot ấy làm tất cả orders cho ExpenseManager; `ExpenseManager.tsx:122-125` không có order trong map thì không ghi expense được.

**Repro:** Seed/mock >100 users/batches/expenses hoặc >100 orders; bản ghi thứ 101 không nằm trong danh sách, filter/search client không tìm được; đơn cũ không chọn để ghi expense qua manager. Test `inventory/users/expenses pagination...` xác nhận page 1 trả cùng URL page 0. Đây không phải bug commissions ledger: `fetchSectionData` đã loop tất cả pages ở `query-cache.ts:228-235`.

**Root cause:** Dùng bounded dashboard/reference snapshots như toàn bộ dữ liệu, không có server search/pagination trong manager.

**Impact:** UI thiếu kho/người dùng/chi phí; thống kê từ snapshot và khả năng vận hành bị giới hạn theo quy mô; không thể xử lý chi phí của đơn cũ ở màn này.

**Fix:** Server pagination/search có total/hasMore; tách query chọn order khỏi dashboard snapshot và fetch theo id. Không fetch toàn DB để chữa mọi danh sách.

**Regression tests:** Dataset 101/201 rows, tìm bản ghi cuối; chọn order ngoài 100 gần nhất; đảm bảo query key chứa filter/page và endpoint dùng đúng params.

## FE-05 — Medium / High confidence — Ghi expense theo đơn không invalidate các dữ liệu tài chính phụ thuộc

**Evidence:** `ExpenseManager.tsx:130-145` submit scope ORDER + expectedVersion; `screens.tsx:6202-6206` luôn gửi event expense_created; `query-cache.ts:123-126` chỉ invalidates expenses/dashboard, bỏ orders/dashboardOrders/commissions. Order snapshot dùng lại làm expectedVersion (`ExpenseManager.tsx:122-136`). Backend `apps/api/src/v2/service.ts:469-479` xác nhận ORDER expense đổi directCosts, reconcile commission và saveOrder theo expectedVersion.

**Repro:** Mở Orders/Commissions để cache → ghi ORDER expense → quay trước staleTime: dữ liệu đơn/hoa hồng cache không bị invalidate. Ghi tiếp expense cùng đơn dùng snapshot dashboardOrders chưa refresh có thể gặp version conflict khi expense backend tăng version.

**Root cause:** Invalidation theo tên màn/loại request thay vì dependency nghiệp vụ.

**Impact:** Hiển thị số liệu đơn/lợi nhuận/hoa hồng cũ; stale optimistic version làm thao tác kế tiếp bị reject. Không coi staleTime là polling: mounted query không tự refetch chỉ vì đã hết staleTime.

**Fix:** Phân biệt overhead vs order expense, invalidate order/detail/dashboardOrders/commissions khi liên quan, hoặc cập nhật authoritative result; await các refresh quan trọng trước thao tác tiếp.

**Regression tests:** Spy tất cả dependency keys sau ORDER expense; overhead không invalidates quá rộng; 2 expense liên tiếp lấy version mới.

## FE-06 — Medium / High confidence — SearchableSelect không thể chọn option bằng bàn phím

**Evidence:** `apps/web/lib/components/SearchableSelect.tsx:85-95` trigger div chỉ xử lý Enter/Space; `143-187` options là div chỉ onClick, không tabIndex/keyboard; không combobox/listbox/option roles, expanded/controls/activedescendant. Search field không có label ở `147-154`; `id` prop gắn container div (`80-84`) chứ không input. Hidden required text input `133-140` có thể nhận focus vô hình.

**Repro thủ công đề xuất (chưa chạy browser):** Tab vào select → Enter mở → gõ lọc → ArrowDown/Enter hoặc Tab không chọn được option; chỉ chuột có handler chọn. Cơ chế thiếu keyboard xác định từ source, không phải đã test screen reader.

**Root cause:** Custom select không triển khai native select hoặc APG combobox interaction model.

**Impact:** Chặn keyboard-only chọn lô/đơn/thành viên ở các form dùng primitive; liên quan WCAG 2.1.1/4.1.2/3.3.2.

**Fix:** Native select nếu phù hợp; hoặc accessible combobox/listbox với focus/active option, Arrow/Home/End/Enter/Escape, semantic labeling và required state.

**Regression tests:** Testing Library + user-event/real browser: chỉ bàn phím chọn/clear/cancel, focus visible, accessible name/role/state, required focus tới control hữu hình.

## FE-07 — Medium / High confidence — Modal có aria-modal nhưng thiếu quản lý focus và id duy nhất

**Evidence:** `apps/web/lib/components/Modal.tsx:29-48` chỉ Escape + body overflow, không focus vào dialog, trap Tab, inert background hoặc restore focus. `66-79` mọi modal dùng `aria-labelledby="cbst-modal-title"` và cùng heading id. OrderDetail có nhiều Modal đồng thời/stack ở `screens.tsx:2120+`.

**Repro thủ công đề xuất:** Focus nút mở → mở → Tab đi tiếp ra nền vì không trap; screen reader được khai aria-modal nhưng focus thực vẫn ngoài. Nếu nhiều modal mở, duplicated heading id trỏ nhầm title; Escape listeners có thể đóng nhiều lớp. Chưa đo trong browser nên không khẳng định số modal bị đóng thực tế.

**Root cause:** Visual overlay được dùng thay cho dialog focus model; id hardcoded thay vì useId.

**Impact:** Keyboard/screen reader khó thao tác modal và có thể kích hoạt giao diện bên dưới; WCAG 2.4.3/4.1.2.

**Fix:** Dialog primitive đã kiểm chứng hoặc native dialog; unique ids, initial/trapped/returned focus, inert nền, chỉ topmost xử lý Escape. Không tự làm modal đóng trong lúc request ambiguous mà mất identity.

**Regression tests:** Open từ trigger → focus trong → Tab/ShiftTab wrap → Escape đóng lớp trên → focus trở lại trigger; hai dialog IDs khác nhau.

## FE-08 — Low / High confidence — Form tạo sản phẩm quảng bá SKU tùy ý nhưng contract chỉ cho ba SKU

**Evidence:** `ProductManager.tsx:103-128` chỉ kiểm cleanSuffix nonempty rồi ghép `CBST-${cleanSuffix}`; `apps/api/src/v2/dto.ts:145-149` @IsIn(SKUS); `apps/api/test/owner-blockers.test.ts:28-32` explicitly rejects CBST-500/XYZ. Public checkout cũng giới hạn `commerce.ts:3,424`.

**Repro:** Điền suffix 500 + tên + giá hợp lệ → UI gửi request, backend trả validation error. Không phải lỗ hổng cho phép tạo SKU tùy ý; backend đã chặn.

**Root cause:** UI và API không chung schema/catalog policy.

**Impact:** Tính năng tạo SKU tùy ý không hoạt động như form gợi ý, mất thời gian nhập; tránh báo sai là data corruption.

**Fix:** Nếu chỉ 3 SKU được duyệt, select eligible/missing SKU và mô tả rõ; nếu cần SKU động phải thay contract thống nhất toàn stack, không chỉ frontend.

**Regression tests:** UI không gửi SKU ngoài approved catalog, lỗi server map đúng field; approved missing SKU tạo được qua mock contract.

## FE-09 — Low / Medium confidence về tác động — Shared client module kéo manager admin vào storefront/login

**Evidence:** `screens.tsx:1-110` use client, static imports các manager và TanStack; cùng App được import bởi `app/page.tsx:1`, `app/login/page.tsx:1`, `app/admin/page.tsx:1`, `app/admin/[section]/page.tsx:2`. Không dynamic boundary cho các managers trong module này.

**Đo thực tế trên artifact sẵn có, không rebuild:** `.next/app-build-manifest.json` liệt kê chunk `static/chunks/88-00059f75a0f019aa.js` dùng chung home/admin/login: **319404 bytes raw; 75701 bytes gzip** (gzip Python). Các chunk chung khác gồm 14=26110/7890, 911=34121/10420, 736=20566/8033 bytes raw/gzip. Không dùng các số này làm Lighthouse/network transferred size; artifact có thể từ build khác, gzip không gồm HTTP/protocol overhead.

**Repro:** Build production sạch và kiểm client-reference/bundle analyzer; so sánh network/home trước sau split. Rủi ro dependency từ static import được xác định từ source, không kết luận home đang vi phạm CWV.

**Root cause:** Storefront và workspace chung một client entry lớn (screens.tsx 7017 lines đo từ file); route split riêng không chia module nội bộ.

**Impact:** Tăng JS parse/download cho khách chỉ mua hàng/login; mức tác động chưa có thiết bị/network measurements.

**Fix:** Tách storefront/auth/admin entry; dynamic import màn manager/chart/media khi cần; cân nhắc Server Components cho nội dung tĩnh. Đặt bundle budget rồi đo lại production.

**Regression tests/measurements:** Build analyzer cùng commit, cold navigation home/login/admin, raw+compressed route bytes, Lighthouse lab với cấu hình cố định; không đặt số cải thiện giả định.

## Điểm đã kiểm tra không nên báo nhầm

- Storefront checkout có busyRef chống submit đồng thời (`screens.tsx:418,520-526,567-570`); createCheckout có busy lock, hash canonical actor/payload và so sánh storage sau async hash (`checkout-retry.ts:23-26,53-74,88-99`). Không báo “không có idempotency” chung chung.
- Price stale 409 được parse bằng safeQuote (`commerce.ts:477-483`), retry giữ pricing guard cho ambiguous request (`checkout-retry.ts:85-87`) và chỉ clear storage với definitive errors theo code. Rủi ro FE-01 là UI bypass cơ chế đó.
- API error có role=alert + requestId (`screens.tsx:114-124`); ActionForm labels và constraints được dựng từ Field; checkout validate số lượng/phone/consent (`commerce.ts:400-442`).
- OrderDetail fetch dùng alive cleanup (`screens.tsx:2066-2088`); ProductDetail dùng alive guard (`app/products/[sku]/product-detail.tsx:11-25`). Không tự kết luận mọi request đều race/stale.
- OwnerProductDto có optional name (`dto.ts:140-144`), nên ProductManager gửi name khi edit không phải contract violation.

## Follow-up chưa xác minh

- Browser mocked E2E cho checkout price-confirmation khi thay giỏ, timeout/reload, nested dialog và keyboard; audit responsive/zoom/contrast/screen reader phải làm riêng.
- MediaManager upload/delete/slot contracts và KPI policy/settlement cần đối chiếu sâu hơn với backend specialist; không biến nội dung chưa xác minh thành finding chắc chắn.
- Việc đổi product/promotion không cập nhật catalog trong App (`screens.tsx:6541-6561` chỉ theo catalogRevision) cần test end-to-end để phân biệt stale preview với authoritative quote (server guard đã có).
