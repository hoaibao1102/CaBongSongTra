# Business Logic Audit

## Thứ tự ưu tiên áp dụng cho findings bên dưới

| Nhóm | Ưu tiên | Trạng thái |
|---|---|---|
| AUTH-01, BUS-01/02/04/05/06/08, FE-01/02, DEP-01 | P0 release-blocker | Open; policy-sensitive cần phê duyệt |
| BUS-03, SEC-01/02/03, FE-03/04/05/06/07, QC-01 | P1 trước production | Open |
| BUS-07/09 | P0 quyết định policy; sau đó remediation P1 | Decision required, không đổi công thức tự ý |
| SEC-04, FE-08/09 | P2 hoặc trước đổi deployment/domain | Open |

# Audit độc lập business / database / backend

## Kết luận và phạm vi chứng cứ

**Chưa nên coi tài chính/KPI là đã được đối soát để production.** Có lỗi lifecycle làm thay đổi sự kiện giao hàng, lệch cost inventory, sai metric KPI, thiếu snapshot đầy đủ và thiếu ghi nhận thưởng KPI trong profit. Không sửa source, không commit, không khởi động app, không đọc credentials, không kết nối database thật.

Root được chỉ định: `D:/BANHANG/web/ca-bong-song-tra-nextjs-v1/ca-bong-song-tra-v1`. Mọi `file:line` bên dưới tương đối root này. Đã đọc toàn bộ `apps/api/src/v2/{service,models,dto,repository,discounts,pricing,policy,controller,http,module}.ts`, domain, order-policy/workflow và finance-ledger; đối chiếu tests và tài liệu V2.2. Auth/reset/media security do luồng audit security phụ trách; báo cáo này không chứng nhận security.

Chứng cứ runtime riêng: `pnpm exec vitest run test/audit-business-invariants.test.ts` tại `apps/api`: **1 file passed; 10 tests passed; exit 0; duration 1.10s**. Đây là **characterization tests**: pass xác nhận hành vi rủi ro hiện tại, KHÔNG có nghĩa bug đã được sửa. Không giả lập kết quả replica-set, commit/rollback hoặc race DB. Parent thực hiện baseline/build/lint toàn dự án.

## Danh sách phát hiện

### BUS-01 — State correction mở lại hàng đã nhập trả nhưng không stock-out lại
- **Severity High; confidence High** (repro service mock, B01/B05).
- Evidence: `apps/api/src/v2/service.ts:278-314`, đặc biệt `287-290,304,307-310`; `238-275` ghi nhận hoàn vật lý. `dto.ts:71-74` chỉ kiểm enum, không invariant lifecycle. Controller gọi thẳng service ở `controller.ts:81`.
- Repro: giao 1 sản phẩm → nhận trả RESTOCK toàn bộ (stock tăng lại; allocation.returnedQty=qty; shippedAt vẫn giữ) → transition RETURNED→DELIVERED hoặc CANCELLED→PENDING→DELIVERED. `wasShipped=true` bỏ qua mọi reservation/stock-out. MEMBER cũng có khả năng correction mọi enum trên order thuộc mình (`test/v2-workflow.test.ts:47-60`).
- Impact: order hiển thị giao lại dù hàng vẫn nằm trong tồn bán được; có thể thu tiền/ghi KPI cho đơn không có outbound mới. Không nhất thiết làm âm stock ngay nhưng phá quan hệ fulfilled quantity ↔ outbound ↔ returns.
- Root cause: mutable status được coi là toàn bộ workflow; shippedAt boolean vừa là historical fact vừa là khóa chống duplicate outbound. `domain/index.ts:4-9` và `orders/order-policy.ts:16-18` có state machine nhưng không dùng tại service. **Lưu ý:** correction tự do được tests hiện tại chủ động cho phép, nên không kết luận chỉ vì thiếu strict transition table; lỗi là correction không có compensation/reconciliation về physical facts.
- Fix: tách correction hành chính và command fulfillment; không cho resend sau physical return bằng sửa status, phải tạo fulfillment/outbound generation mới có quantities còn được giao. Guard terminal resume, shipped allocations và return quantities.
- Regression: RESTOCK/DISCARD toàn phần và từng phần; MEMBER/OWNER; cancel trước/sau ship; resend từ RETURNED phải bị chặn hoặc có outbound mới chính xác; retry command không trừ stock hai lần.

### BUS-02 — deliveredAt bị viết lại, thay đổi bucket KPI lịch sử
- **Severity High; confidence High** (B02).
- Evidence: `service.ts:307` luôn gán `deliveredAt=now`; `733-740` KPI chọn theo deliveredAt; correction không khóa sự kiện lịch sử (`278-314`).
- Repro: DELIVERED tháng trước → RETURN_REQUESTED → DELIVERED trong tháng sau. deliveredAt đổi dù không có giao vật lý mới.
- Impact: doanh số định lượng bị chuyển kỳ; chốt KPI trước/sau correction trả kết quả khác. Nhiều kỳ có thể đã chốt trên dữ liệu trước đó.
- Root cause: overwrite recognition timestamp thay vì first delivery/event ledger có explicit correction.
- Fix: immutable firstDeliveredAt cho cùng fulfillment, lịch sử sự kiện và quy tắc correction có audit reason riêng; KPI dùng canonical event/correction ledger.
- Regression: delivered→correction→delivered giữ recognition date hoặc tạo reversal/rebooking được phê duyệt; same-state replay không đổi date.

### BUS-03 — Phân bổ shipping làm mất vốn khi chia lẻ hoặc hàng miễn phí
- **Severity Medium; confidence High** (B03/B04).
- Evidence: `service.ts:18-26,44-47`; ghi unit cost xuống batch ở `379-394`; COGS lấy qty×unitCost ở `202-206`.
- Repro: qty=3, purchasePrice=100, shipping=2: receipt total=302, allocatedShipping=2 nhưng landedUnitCost=100 và inventory value=300. Nếu mọi purchasePrice=0, shipping=90000 thì tất cả allocations/unitCost=0.
- Impact: inventory valuation/COGS thấp hơn acquisition cost; margin/commission/profit cao sai. Sai số có thể lớn khi qty cao hoặc free samples có shipping thực.
- Root cause: phân bổ theo dòng đúng nhưng floor lần hai ở đơn vị làm rơi remainder; zero-subtotal branch bỏ phí thay vì chọn quantity weights.
- Fix: lưu total landed cost + deterministic cumulative unit-cost consumption, hoặc split batch thành cost buckets; zero subtotal phân bổ theo qty. Không làm tròn độc lập rồi bỏ phần dư.
- Regression: tổng vốn mọi outbound + giá trị tồn còn lại = receipt total từng đồng; zero-cost nhiều SKU, qty lớn, shipping nhỏ hơn qty, full/partial return phải đảo đúng historical cost.

### BUS-04 — DTO cho REVENUE KPI nhưng engine luôn dùng số lượng
- **Severity High; confidence High** (B06).
- Evidence: `dto.ts:208-212`; `models.ts:240-248,287`; `service.ts:733-758,820-822,888-890`.
- Repro: tạo policy metric=REVENUE với tier minQty=1, bonus=50000; 1 sản phẩm đạt thưởng y hệt PRODUCT_QTY, không sử dụng totalVnd/revenue bất kỳ.
- Impact: cấu hình doanh thu được API chấp nhận nhưng settlement trả thưởng theo đơn vị hàng, có thể underpay/overpay.
- Root cause: metric lưu trong schema nhưng không tham gia calculator; contract còn gọi threshold là minQty cho mọi metric.
- Fix: tạm reject REVENUE bằng stable error nếu chưa hỗ trợ, hoặc implement threshold units và recognized-net-revenue calculator riêng, snapshot metric+threshold.
- Regression: cùng quantity nhưng revenue khác; same revenue qty khác; discounts, returns, goodwill, rounding; DTO không chấp nhận unsupported metric.

### BUS-05 — Chốt KPI tương lai/đang mở và kỳ trùng nhau không bị chặn
- **Severity High; confidence High cho thiếu guard, Medium cho chính sách overlapping** (B07 xác nhận future settle).
- Evidence: `service.ts:708-729,808-815`; `models.ts:297-311` chỉ index status/startDate, không uniqueness/overlap guard. `computeDeliveredQty` dùng `$gte` và `$lte` hai đầu (`738-739`).
- Repro: tạo kỳ 2098→2099 rồi settle ngay; API trả SETTLED. Tạo hai period cùng policy/window rồi settle riêng: mỗi period tạo award riêng (unique ở `models.ts:326` chỉ periodId/memberId). Kỳ liền kề có chung exact boundary timestamp cũng đều bao gồm order ở boundary.
- Impact: chốt sớm bỏ mất doanh số còn phát sinh; duplicate/overlapping windows có thể trả thưởng nhiều lần cho cùng performance.
- Root cause: OPEN/SETTLED là guard duy nhất, thiếu close-date/effective-window policy. Chưa có bằng chứng business cho phép stacking nhiều period nên overlap là decision gap cần owner xác nhận, không khẳng định mọi overlap đều sai.
- Fix: explicit allowEarlyClose có reason/permission nếu cần; mặc định now>=endDate; half-open [start,end); định nghĩa period uniqueness/stacking và serialization trước tạo kỳ trùng.
- Regression: future, current, closed, same instant boundary, duplicate create khác idempotency key, intentional stacking được khai báo.

### BUS-06 — Snapshot KPI chốt thiếu người không được thưởng; preview SETTLED thay đổi theo dữ liệu sống
- **Severity High; confidence High** (B07/B08).
- Evidence: `service.ts:824-848` chỉ push award khi bonus>0; `769-787` chỉ dùng snapshot nếu tìm được award, còn lại compute lại orders; `models.ts:263-271` không có policy/metric/window snapshot trong award.
- Repro: chốt member qty=0 → không có award. Sau đó có order backdated hoặc correction thay delivery date → preview period SETTLED hiển thị bonus>0, settled=false và totalBonusVnd tăng, nhưng ledger không được credit.
- Impact: màn hình kỳ đã chốt không đối soát được với ledger; thay đổi member roster còn làm thay đổi tập hiển thị của lịch sử.
- Root cause: award thưởng dương bị dùng như settlement snapshot đầy đủ.
- Fix: lưu result cho mọi member kể cả zero, snapshot policy/tiers/metric/window và roster tại settle; preview SETTLED chỉ đọc snapshot; total settled phải khớp ledgerEntryId.
- Regression: zero→positive sau close vẫn giữ lịch sử; member inactive/new sau close; policy/correction changes không sửa settled display; sum awards = sum bonus ledger.

### BUS-07 — Return sau settlement không reconcile KPI bonus
- **Severity High; confidence Medium về policy, High về cơ chế thiếu** (B09).
- Evidence: `service.ts:257-274` return chỉ reconcile commission (`87-97`); settle ghi KPI_BONUS/balance (`824-846`), không có reversal kind/award adjustment (`models.ts:44,263-271`).
- Repro: member chạm tier rồi settle, balance được credit KPI_BONUS; sau đó return làm net qty xuống dưới tier. receiveReturn không đọc/điều chỉnh award hoặc balance KPI.
- Impact: nếu business muốn KPI theo net retained delivered qty (calculator hiện trừ returnedQty ở `745-747`), đã settle được hưởng thưởng cho hàng trả mà chưa settle thì không. Có thể payout trước return.
- Root cause: settlement chưa định nghĩa finality/clawback/return window; commissioner delta có nhưng KPI delta không.
- Fix: owner quyết định immutable closed bonus hay net-of-return adjustment. Nếu cần net: append negative KPI adjustment, đối soát balance debt sau payout, không sửa ledger cũ; idempotency theo award/order return event.
- Regression: full/partial return trước/sau close/payout, tier drop, retry, multiple returns, negative balance; nếu finality cố ý phải document rõ và UI phân biệt live performance/settled earned bonus.

### BUS-08 — Dashboard netProfit bỏ chi phí thưởng KPI
- **Severity High; confidence High (source proof, chưa execute Mongo aggregation)**.
- Evidence: `service.ts:824-835` KPI_BONUS là khoản phải trả thật, `502-512` payout tiêu balance này; `568` cash chỉ trừ PAYOUT (hợp lý cash basis), nhưng `571-572` netProfit chỉ trừ order commission + overhead + delivery losses, không trừ KPI_BONUS. `controller.ts:102-104` gộp bonus vào commission ledger.
- Repro: giữ orders/expenses y nguyên, settle 50000 bonus. liability/balance tăng 50000 nhưng dashboard netProfitVnd không thay đổi. Payout sau đó cash giảm, profit vẫn không phản ánh bonus.
- Impact: báo cáo lợi nhuận vận hành cao hơn chi phí compensation thực; cash/profit reconciliation không giải thích được chênh lệch.
- Root cause: KPI được thêm như ledger kind mới nhưng reporting revenue/expense taxonomy chưa cập nhật.
- Fix: aggregate KPI accrued/adjustment expense và trừ đúng một lần trong accrual profit; payout là settlement liability, không expense lần hai. Hiển thị riêng thưởng và commission.
- Regression: settle→payout profit giảm ở settle và không giảm lại ở payout; refund bonus reversal; zero bonus; owner/member projection; tổng profit từ ledger đối soát theo window.

### BUS-09 — Code hoa hồng trái tài liệu acceptance V2.2; không được tự chọn một công thức để sửa
- **Severity High nếu tài liệu V2.2 là contract; confidence High về inconsistency** (B10).
- Evidence: `docs/PROMOTIONS_VOUCHERS_V2_2_IMPLEMENTATION.md:33-45,158` yêu cầu finalized costs, collected>=revenue, hết refund due và profit sau direct costs. `apps/api/src/v2/policy.ts:41-46` bỏ receipts/costsFinalized/directCosts khỏi logic; `domain/index.ts:33-39` chỉ margin sellingPrice-originalCost. `test/v2.test.ts:51-57` và `test/v2-workflow.test.ts:89-94` lại chủ động khẳng định commission không cần payment/finalized costs.
- Repro: delivered total=100000, cogs=60000, directCosts=10000, receipts=0, finalized=false vẫn có commission=16000. Đổi returnValue=50000/cogs=30000, receipts=100000 chưa refund vẫn accrues 8000.
- Impact: tiền thưởng có thể payout trước thu tiền/hoàn tiền hoặc dựa margin khác contract; triển khai và tài liệu cung cấp hai tiêu chuẩn nghiệm thu trái nhau.
- Root cause: policy drift giữa implementation/test và tài liệu V2.2, không phải lỗi số học.
- Fix: owner chốt công thức, sự kiện recognition và return-refund gate. Nếu margin-based intentionally giữ nguyên thì sửa contract/acceptance và ghi nhận liability risk; nếu V2.2 đúng thì implement guards, recalc/migration và debt reconciliation. Không đơn giản “trừ directCosts” mà bỏ safety conditions.
- Regression: matrix paid/unpaid/partially paid, finalized/unfinalized, owner-direct/member, profit/loss, return-refund due, goodwill/linked refund và payout-before-clawback.

## Rủi ro/giới hạn không nâng thành lỗi đã chứng minh

- **Checkout stock là availability check, không reservation**: `service.ts:150-153` aggregate đọc, PENDING không write batch; reserve thật tại confirmation `192-206`. Hai PENDING có thể nhận success trên cùng lượng stock; confirm thứ hai phải OUT_OF_STOCK. Không gọi đây là oversell của confirmed stock vì CAS/transaction có guard. Cần UX định nghĩa rõ “đã nhận đơn” không phải “đã giữ hàng”; nếu business hứa giữ kho tại checkout phải đổi transaction boundary.
- **Voucher pending không TTL cố ý**: tài liệu `:19` và scope `:10` xác nhận không worker hết hạn; không báo bug reservation leak chỉ vì chưa có TTL. Vẫn cần vận hành list/cancel pending cũ.
- **Voucher cancelled resume**: `discounts.ts:207` RELEASED không consume lại; unrestricted transition CANCELLED→PENDING có thể thành đơn trông active nhưng confirm bị VOUCHER_STATE_CONFLICT. Counter không bị tái dùng đồng thời qua đường confirm hiện tại. Nên chặn resume hoặc bắt recreate với quote/quota mới; cần regression cross-product.
- **Purchase receipt không cash ledger**: `service.ts:437-438` không ghi payment supplier; dashboard đặt tên operating cash, không phải cash toàn doanh nghiệp. Cần quyết định scope trước gọi là sai cash balance.
- **Payment method/reference**: DTO `75-81` có method, không receipt external reference; payout reference `120-125` không unique trong ledger schema. Different idempotency key vẫn có thể tạo nghiệp vụ mới. Đây là gap business-reference dedupe, không phải hỏng same-key idempotency; cần quyết định unique bank transaction/provider reference, scope và correction flow.
- **Schema validators không thay thế invariant**: models có safe integers/min nhưng không cross-field stock reserved<=onHand, sums pricing, refunds<=receipts trên mọi direct write. Current service có guards; không tìm thấy public direct-write bypass trong phạm vi đọc. Cần offline reconciliation/migration validators và prohibit ngoài service.
- **Legacy helper không phải runtime V2**: `orders/order-workflow.ts`, `orders/order-policy.ts`, `finance/finance-ledger.ts` có unit tests riêng nhưng CommerceModule wiring (`module.ts:10-14`) dùng CommerceService/MongoRepository. Không lấy test legacy làm bằng chứng endpoint an toàn. FinanceLedger.receipt không cap overpayment (`finance-ledger.ts:19-20,31-36`) là rủi ro nếu tái sử dụng, chưa phải live endpoint bug.

## Invariants đã truy vết và controls tích cực

| Invariant | Evidence | Giới hạn kiểm chứng |
|---|---|---|
| Same key/request commit response + business + journal cùng nhau | repository.ts:38-67; models.ts:138-140 | Chưa chạy DB replica-set, commit timeout, process kill; index phải tồn tại thật |
| Mọi update order có expectedVersion/CAS | repository.ts:69-73; service.ts:79 | Direct DB writers ngoài app không được chứng nhận |
| Confirm/ship stock không âm, reserved trong onHand | service.ts:192-206,298-321 | Snapshot/write conflict retry chưa test với Mongo thật |
| Ship không giao lô hết hạn; return RESTOCK cần label/expiry/status | service.ts:249-253,300-302,319 | Không có nghiệp vụ quarantine release trong API hiện tại |
| Partial discount/return chính xác từng đồng | pricing.ts:10-16,35-43,51-74; service.ts:257-259 | Cumulative returnedQty theo SKU là đúng; unitPrice floor chỉ tương thích, finalLineTotal mới canonical |
| Public/internal voucher DTO tách biệt | dto.ts:15-34; controller.ts:25-28,77-78 | HTTP guard/BFF security audit riêng |
| Promotion overlap serialize bằng product write trước overlap read | discounts.ts:60-71,77-115 | DB race/index rollout chưa thực chứng |
| Voucher total/per-customer atomic counters, redemption state | discounts.ts:182-225; models.ts:180-182 | Same-phone last slot race cần replica set |
| Payment/refund balance và return/goodwill separation | service.ts:262-267,323-344; policy.ts:37-39 | Không external payment provider/cash custody/chargeback model |
| Commission clawback và payout cùng balance doc | service.ts:87-97,502-512 | Cho balance âm sau clawback là debt intentional, không tự kết luận invariant lỗi |

## Endpoint coverage map và gaps

Đếm bằng parse decorator source: **66 route/method trong CommerceController**. Coverage dưới đây là **static source review + tests đã đọc**, không phải 66 HTTP tests đã chạy. Prefix deploy chưa suy diễn; paths là chuỗi controller.

| Nhóm / endpoint methods | Source controller.ts | Phủ business | Gaps cần test |
|---|---|---|---|
| POST pricing/quote; POST internal/pricing/quote | 25-28 | computePricing, snapshot, stale fingerprint, voucher override promotion | quote→price mutation race; equal total nhưng source version khác; transaction snapshot old price decision |
| GET/POST promotions; PATCH/DELETE promotions/:id | 29-36 | date half-open, SKU serialization, optimistic version, soft delete | concurrent overlap insert/update/move SKU trên replica set; write-conflict retry |
| GET vouchers; POST vouchers/verify; POST vouchers; PATCH/DELETE vouchers/:id; GET vouchers/:id/redemptions; GET vouchers/:id/counters | 37-50 | assignment, limits, counter lifecycle, tombstones | last global/customer slot; cancel/confirm concurrent; RELEASED resume; normalized phone; timeout-after-commit |
| POST users/:id/password-reset; POST auth/reset-password | 51-54 | handoff security; not business settlement | real token/password lifecycle not exercised here |
| POST orders/:id/assignment; PATCH orders/:id; POST orders/:id/returns | 55-60 | rate snapshots, legacy edit, V2 edit blocked, cost recovery, cumulative credit | BUS-01/03/07; return vs payout/refund concurrent; legacy-to-V2 reads |
| GET products; GET owner/products; POST products; GET products/:sku; PATCH products/:sku | 61-67 | active catalog, supported SKU DTO, integer retail, optimistic update | deactivation during checkout, config snapshot policy, imported legacy malformed data |
| POST auth/login; POST auth/logout; GET auth/me | 68-76 | handoff security | no auth integration execution by this child |
| POST checkout/orders; POST orders; GET orders; GET orders/:id | 77-80 | server pricing, pending stock check, responsibility/rate, projections | guest gate transaction verification, checkout pending oversubscription semantics, scope replay concurrent assignment |
| POST orders/:id/transitions | 81 | stock movement, version/idempotency, commission recognition | BUS-01/02, facts-vs-status model, voucher terminal resume |
| POST orders/:id/payments; POST orders/:id/refunds | 82-83 | balance cap, linked/goodwill credit, journal | parallel payment/refund/return + reference uniqueness; external bank reconciliation |
| POST orders/:id/finalize-costs; POST orders/:id/recalculate-commission | 84-85 | finalized flag/reconcile delta | BUS-09 contract; backfill migration audit |
| POST inventory/receipts; POST/GET inventory/purchase-receipts; POST inventory/adjustments; GET inventory/batches; GET inventory/movements | 86-92 | dates, label quarantine, negative adjustment guard, FEFO cost flow | BUS-03; cost reconciliation; quarantined batch release process absent; CAS on real Mongo |
| GET/POST users; PATCH users/:id; PATCH users/:id/commission-rate; PATCH users/:id/bank-info | 93-99 | member creation/status, bank/rate update, snapshot on assignment | inactive member open orders decision, rate changes concurrent create, no historical rate migration |
| POST/GET expenses | 100-101 | order expense version + reconcile, overhead separation | cancellation/failed/return nonterminal expense reporting scope; expense correction/reversal absent |
| GET commissions/me; GET commissions; POST commissions/payouts | 102-104 | mixed bonus/commission ledger, atomic balance debit | refund/return vs payout conflicts; reference dedupe; over-request silently clamped at service.ts:507 needs contract |
| GET/POST kpi/policies; GET/POST kpi/periods; GET kpi/periods/:id/preview; POST kpi/periods/:id/settle; GET kpi/me | 105-111 | complete calculator/settlement walk | BUS-02/04/05/06/07; concurrent settle vs delivery/return; inactive policies; duplicate/nonmonotonic tiers; current-period fallback future period at service.ts:873-899 |
| GET audit-logs; GET dashboard/overview; GET dashboard/members/me | 112-114 | audit projections, aggregate money/profit definitions | BUS-08/09; snapshot consistency across independent dashboard queries; date filtering absent |
| GET media; POST media; POST media/slots; POST media/sync; DELETE media/:id | 115-119 | read/write boundary only, no money/stock | no business transaction/idempotency on media; detailed security/frontend owned elsewhere |

## Regression ưu tiên và điều kiện nghiệm thu còn thiếu

1. **P0 quyết định contract**: state correction vs new physical fulfillment; margin commission vs V2.2 paid/finalized/refund-due gated contract; KPI return finality; allowed overlapping periods. Không tự sửa công thức theo một tài liệu khi tests mô tả chính sách khác.
2. **P1 unit/service**: chuyển tests B01–B10 từ characterization thành desired-invariant assertions sau quyết định; thêm dashboard KPI cost, zero/member snapshots, REVENUE reject/calculate, quantity-cost remainder exact conservation.
3. **P1 integration isolated replica set (không DB thật của user)**: transactions all-or-nothing; fail ledger/audit after stock mutation; last slot stock/voucher/customer race; same key same/different payload; uncertain commit replay; competing payout vs clawback; concurrent settle retry. Assert query-visible state, journal counts và index definitions, không chỉ mocked call counts.
4. **P2 reconciliation**: mỗi order total/discount/return balances; stock onHand/reserved↔movement↔allocations; landed acquisition total↔remaining inventory+COGS; member ledger→balance→payout; period award snapshot→bonus journal→dashboard expense. Cần script read-only/export trên staging được user cho phép, không chạy trong audit này.

## Artifacts

- `audit-reports/working/business-findings.md` (báo cáo này).
- `apps/api/test/audit-business-invariants.test.ts` (10 tests riêng, không bootstrap app/DB/network).

Chỉ hai artifact trên do child business tạo/sửa; không sửa production source. Baseline/lint/typecheck/build và audit children khác do parent hợp nhất. Không có bảo đảm mọi business rule đã đúng chỉ từ static review/mock tests; các gaps được liệt kê rõ thay vì bịa kết quả DB.
## Frontend → API integrity

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