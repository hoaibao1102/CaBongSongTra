# CÁ BỐNG SÔNG TRÀ — UI/UX v1.1: GIỮ LAYOUT LANDING CŨ, THAY DESIGN SYSTEM, MOBILE-FIRST

> **Phiên bản cập nhật:** 11/10/2026 · **Mục đích:** Một tài liệu triển khai thống nhất cho Google Antigravity.  
> **QUY TẮC ƯU TIÊN:** Phần **A – Layout Preservation Override** bên dưới có hiệu lực cao nhất đối với bố cục landing; phần thiết kế hệ thống / dashboard / kỹ thuật phía sau vẫn áp dụng nếu không xung đột. SRS v2.0 ưu tiên cho nghiệp vụ, auth, tài chính, kho.  
> **Landing tham chiếu:** https://ca-bong-song-tra.vercel.app/ — trạng thái nội dung quan sát ngày 11/10/2026. Đây là nguồn tham chiếu **bố cục và phân cấp**, không phải nguồn màu sắc, font hoặc design tokens. Chưa có ảnh chụp layout pixel-perfect từ trình duyệt trong tài liệu; Antigravity phải chụp baseline desktop/mobile trực tiếp trước khi sửa.  
> **Chú ý:** Không sao chép CSS/colors hiện có từ trang cũ. **Không redesign bố cục theo sở thích của AI.**

## A. LAYOUT PRESERVATION OVERRIDE — BẮT BUỘC ĐỌC TRƯỚC KHI CODE

### A1. Quyết định mới của chủ dự án

1. **GIỮ layout landing cũ** trên website đang chạy: nhịp section, thứ tự các khối, ý tưởng hero, sản phẩm, bảng so sánh ảnh, hương vị, bảo quản, cách đặt, FAQ và footer.
2. **KHÔNG GIỮ màu của giao diện cũ**: thay theo design tokens mới ở mục 3; không học/đo màu trực tiếp từ CSS trang cũ; ảnh thật vẫn giữ màu gốc (nắp đỏ, màu cá, màu poster).
3. Desktop: giữ bố cục được chủ dự án ưng ý, chỉ tinh chỉnh spacing, typography, responsive, contrast, căn chỉnh, hover/focus và bố cục các thành phần con nếu có vấn đề sử dụng.
4. Mobile: **mobile-first về chất lượng trải nghiệm**, không bắt buộc sao chép cách co layout cũ gây chật. Cho phép chuyển cột thành hàng dọc, card swipe nếu thật sự thuận tiện, thu gọn nav và FAQ; **không đổi thứ tự section và câu chuyện trang**.
5. Đây là **UI/UX refactor trên code hiện có**, không viết lại landing, không xóa module chức năng hay ngắt kết nối NestJS/MongoDB. Ưu tiên tận dụng DOM/components/routing đang chạy.
6. **Phạm vi thay đổi**: màu, typography, tokens, component skins, padding/gap, responsive breakpoints, mobile nav, touch targets, loading/skeleton, ảnh responsive, sticky CTA và accessibility. Nếu cần đổi vị trí section, phải hỏi phê duyệt riêng.

### A2. Layout thực tế của landing cũ — nguồn tham chiếu

Đã truy xuất cấu trúc nội dung public của URL. Thứ tự hiện tại:

| Thứ tự | Khối ở landing cũ | Điều PHẢI giữ | Tối ưu đề xuất, không thay ý tưởng |
|---|---|---|---|
| 0 | Header với các mục Trang chủ / Sản phẩm / Bảng giá & Size / Hương vị / Bảo quản / Cách đặt mua / FAQ | Navigation dạng anchor, hiện diện rõ tên thương hiệu | Desktop header gọn, mobile hamburger/drawer accessible, CTA dễ chạm |
| 1 | Hero: eyebrow đặc sản/có hàng, H1 “Cá Bống Sông Trà – Hương vị Quảng Ngãi trong bữa cơm nhà”, đoạn giới thiệu, 2 CTA, 3 trust facts, **ảnh bộ 3 size** | Giữ bố cục text + ảnh bộ hũ và các CTA; không biến thành slideshow | Mobile text trước ảnh, ảnh nổi bật và giữ tỉ lệ; CTA 1 chính, 1 phụ; 3 trust facts thành chip/wrapped text |
| 2 | Dải thông tin lợi ích: ba size rõ ràng / đậm vị quê nhà / giao tại TP.HCM / tư vấn Zalo | Giữ dạng mini trust/feature strip | Mobile 2 cột hoặc danh sách dọc, tránh icon lớn |
| 3 | `01 / DANH MỤC SẢN PHẨM`: 3 hũ 300/400/600g với ảnh/giá/mô tả | 3 product cards; thông tin khối lượng tịnh, SKU, giá | Mobile ưu tiên card dọc dễ đọc; có thể xem 1 card mỗi hàng để tránh bị nhỏ; nút chọn mua rõ |
| 4 | `02 / BẢNG SO SÁNH & BẢNG GIÁ`: tab/hình Bảng Kích Thước và Bảng Giá 3 Hũ | **Giữ cả hai ảnh bảng size và bảng giá**, lightbox | Mobile 1 cột, tab hoặc hai panel lớn, zoom pan được, chú thích/alt dễ hiểu |
| 5 | Interlude/trích dẫn “Một món mặn quen thuộc...” | Giữ cảm xúc như điểm nghỉ giữa sections | Typography đẹp, không cần sticker hoặc decorative noise |
| 6 | `03 / HƯƠNG VỊ QUÊ NHÀ`: câu chuyện quê, gợi ý món ăn cơm trắng/rau luộc/mâm cơm | Giữ storytelling và các card gợi ý món | Mobile text ngắn, card đồng nhất, không tạo ảnh món ăn giả |
| 7 | `04 / BẢO QUẢN & AN TOÀN THỰC PHẨM`: HSD lô, bảo quản, sau mở nắp | Giữ section và tính trung thực về nhãn | Mobile accordion hoặc 3 info cards dễ đọc; không thêm hạn dùng định lượng chưa xác minh |
| 8 | `05 / CÁCH ĐẶT HÀNG`: 3 bước, mẫu tin nhắn chọn size, nút copy, QR Zalo, thông tin người tư vấn | Giữ 3 bước, bộ soạn lời nhắn, Zalo QR, điện thoại | Mobile QR là phụ (khách đang dùng điện thoại); ưu tiên nút mở Zalo và gọi, nút copy dễ bấm |
| 9 | `06 / FAQ`: 10 câu hỏi | Giữ FAQ với nội dung cần thiết | Accordion chạm 44px+, 1 câu mở tại một thời điểm là tùy chọn |
| 10 | Footer: giới thiệu, link nhanh, hỗ trợ, thông tin liên hệ, sticky tư vấn Zalo | Giữ đầy đủ nội dung thật, anchor links | Mobile footer 1 cột + sticky bar không che cuối trang |

**Ghi chú xác thực:** Bảng trên bám theo nội dung/section và anchor public; kích thước pixel, khoảng cách gốc, animation và bố cục hai cột cụ thể cần Antigravity kiểm tra DOM/CSS + screenshot trực tiếp trong repo/browser. Không được tự khẳng định đã thấy pixel-perfect.

### A3. Những thay đổi KHÔNG được phép

- Không thay hero bằng một hero landing mẫu chung, banner toàn màn hình, carousel autoplay, hero chỉ 1 hũ hoặc splash intro.
- Không thay thứ tự section 01→02→03→04→05→06; không xóa bảng ảnh size/giá hoặc phần hướng dẫn bảo quản để “gọn hơn”.
- Không biến landing thành e-commerce storefront hoàn toàn mới với grid/catalog/filter khổng lồ.
- Không lấy bảng màu cũ của website làm nguồn sự thật; không bê toàn bộ texture/poster nền vào giao diện.
- Không chỉnh/sửa nội dung của 5 ảnh thật để hòa màu với web; không làm sai nhãn, tỷ lệ hũ và con số in trong hình.
- Không tạo feedback giả, mác bán chạy nhất hoặc tiết kiệm nhất khi chưa có dữ liệu chứng minh; nhãn đang có ở trang cũ phải được audit và gỡ/đổi nếu không chứng minh được.
- Không tự biến flow đặt hàng qua Zalo hiện tại thành checkout hoàn toàn bắt buộc; nếu form order đã có trong code thì giữ và tối ưu, nếu chưa có thì xem như **đề xuất riêng, cần xác nhận** trước khi thêm.
- Không làm đổi tính chính xác của 300/400/600g (khối lượng tịnh gồm cá + nước kho, không gồm hũ).

### A4. Wireframe bảo toàn desktop

```text
[HEADER: BRAND] [Trang chủ | Sản phẩm | Bảng giá & Size | Hương vị | Bảo quản | Cách đặt | FAQ] [CTA]

[HERO: HEADLINE + TEXT + 2 CTA + TRUST FACTS]   [ẢNH THẬT BỘ 3 HŨ]
[TRUST/FEATURE STRIP — các thông tin dịch vụ đã xác nhận]

[01 SẢN PHẨM: HEADING]
[HŨ 300g]                    [HŨ 400g]                    [HŨ 600g]
[Chú giải trọng lượng và phí vận chuyển]

[02 SO SÁNH & GIÁ: HEADING]
[BẢNG SIZE - ẢNH THẬT]         [BẢNG GIÁ - ẢNH THẬT]

[INTERLUDE: MỘT MÓN MẶN QUEN THUỘC...]

[03 HƯƠNG VỊ: STORYTELLING]
[GỢI Ý CƠM NÓNG]              [RAU LUỘC]              [MÂM CƠM]

[04 BẢO QUẢN: HSD LÔ | BẢO QUẢN THEO NHÃN | SAU MỞ NẮP]

[05 ĐẶT HÀNG: 3 BƯỚC]
[TIN NHẮN MẪU CHỌN SIZE + COPY] [QR ZALO / LIÊN HỆ]

[06 FAQ: 10 CÂU HỎI]
[FOOTER: INFO + NAV + CONTACT]
```

### A5. Mobile wireframe — ƯU TIÊN SỐ 1 (360px, 375px, 390px, 414px, 430px)

```text
┌─────────────────────────────┐
│ [LOGO/TÊN]      [MENU ≡]    │  header sticky nhỏ, không che nội dung
├─────────────────────────────┤
│ ĐẶC SẢN QUẢNG NGÃI          │
│ H1 (2–4 dòng dễ đọc)        │
│ Subcopy 2–4 dòng            │
│ [KHÁM PHÁ 3 SIZE]           │  CTA rõ ràng, full width nếu cần
│ [XEM BẢNG GIÁ]              │
│ [ẢNH THẬT CẢ 3 HŨ]          │  contain, không crop hũ
│ [trust facts dạng wrap]     │
├─────────────────────────────┤
│ 01 / SẢN PHẨM               │
│ Hũ 300g                     │
│ [ẢNH] [GIÁ] [CTA]           │
│ Hũ 400g                     │
│ [ẢNH] [GIÁ] [CTA]           │
│ Hũ 600g                     │
│ [ẢNH] [GIÁ] [CTA]           │
├─────────────────────────────┤
│ 02 / SO SÁNH & BẢNG GIÁ     │
│ [Tab SIZE | BẢNG GIÁ]       │
│ [ẢNH FULL WIDTH + ZOOM]     │
├─────────────────────────────┤
│ [INTERLUDE QUÊ NHÀ]         │
│ 03 / HƯƠNG VỊ               │
│ [STORY + 3 GỢI Ý]           │
├─────────────────────────────┤
│ 04 / BẢO QUẢN               │
│ [3 THÔNG TIN NGẮN RÕ]       │
├─────────────────────────────┤
│ 05 / CÁCH ĐẶT              │
│ [BƯỚC 1, 2, 3]             │
│ [CHỌN SIZE → LỜI NHẮN]     │
│ [NHẮN ZALO] [GỌI]           │
│ [QR nhỏ tùy chọn]           │
├─────────────────────────────┤
│ 06 / FAQ                   │
│ [ACCORDION]                 │
│ FOOTER                      │
├─────────────────────────────┤
│ [NHẮN ZALO] [GỌI NGAY]      │  sticky bar safe-area-aware
└─────────────────────────────┘
```

### A6. Mobile-first specification — định lượng và hành vi

| Chủ đề | Tiêu chí kiểm tra | Cách xử lý |
|---|---|---|
| Viewport | 320, 360, 375, 390, 414, 430, 768px; desktop 1280/1440 | Không có scroll ngang trang; text không cắt |
| Header | Mobile header 56–64px mục tiêu, hamburger có label | Drawer trap focus, Escape close, backdrop, trả focus khi đóng |
| Hero | H1 khoảng clamp(1.9rem, 7vw, 2.65rem) tùy font | Không ép H1 nằm một dòng; ưu tiên ảnh hũ sau mô tả |
| Product images | `object-fit: contain`, `aspect-ratio` phù hợp ảnh gốc | Không crop sản phẩm; `sizes` responsive, width/height hợp lý |
| Cards | Một cột mobile mặc định | Nếu carousel: snap rõ, không giấu CTA, không autoplay, vẫn keyboard accessible |
| Actions | Tap target >=44×44 CSS px; phân biệt primary/secondary | Sticky bottom 2 nút Zalo/Gọi, hoặc thêm đặt hàng nếu flow tồn tại |
| Sticky bottom | `padding-bottom: env(safe-area-inset-bottom)` và footer padding bù | Không che FAQ, nút gửi form, toast hay bàn phím |
| Zalo | Mở link đang tồn tại và đã xác minh; có fallback copy số | QR chủ yếu cho desktop; mobile nhấn trực tiếp |
| Phone | Dùng `tel:` chính xác từ cấu hình shop | Tạo CTA gọi nhanh không buộc người dùng copy số |
| Bảng giá poster | Ảnh được zoom (dialog), zoom/pan nếu cần | Không hiển thị poster rất nhỏ rồi bắt người dùng tự zoom cả trang |
| Readability | body 15–16px, line-height 1.55–1.7 | Tránh text < 12px, nút nhiều chữ bị tràn |
| Forms | Keyboard type `tel`, autocomplete phù hợp | Giữ focus, inline errors, chống double-submit nếu form hiện có |
| Speed | Mục tiêu p75 mobile LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 | Đo trên dữ liệu thật, không tuyên bố đạt trước khi test |
| Layout shifts | Reserve space cho ảnh/cards/fonts | No sudden jumps khi load/scroll |
| Motion | Không dùng parallax nặng, autoplay video/slider | prefers-reduced-motion và animate tiết chế |

**Lưu ý:** Chiều cao/size là mục tiêu thiết kế, cần kiểm thử với nội dung thật và trình duyệt thật. Không dùng số liệu đo giả.

### A7. Giữ layout nhưng dùng palette MỚI

Màu sắc tuyệt đối theo **design tokens tại Mục 3 của tài liệu dưới đây**; khi có khác biệt tên token, ưu tiên CSS semantic tokens:

```css
/* Palette đề xuất mới — KHÔNG sample màu CSS cũ */
:root {
  --brand-primary: #D84012;
  --brand-primary-hover: #B93410;
  --brand-primary-soft: #FFF1E8;
  --brand-brown: #633C2D;
  --surface-page: #FFFCF8;
  --surface-card: #FFFFFF;
  --surface-admin: #F7F8FA;
  --text-primary: #2B211D;
  --text-secondary: #665A53;
  --border-subtle: #E9E2DC;
  --state-success: #15803D;
  --state-warning: #B45309;
  --state-error: #B91C1C;
  --state-info: #1D4ED8;
}
```

- Không chuyển màu nguyên liệu, nắp hũ hoặc các poster marketing sang palette mới; đó là nội dung ảnh thật, không phải skin UI.
- Landing dùng cream/white + cam điểm nhấn + nâu text; dashboard dùng neutral sáng và màu semantic có kiểm soát.
- Bỏ background cam kín màn hình nếu đang có; giới hạn accent vào CTA/eyebrow/badge hợp lý.
- Không dùng ảnh bảng giá làm background phủ kín hero hoặc làm chữ khó đọc.
- Font Be Vietnam Pro / system fallback có hỗ trợ dấu; chỉ thêm font nếu không gây CLS hoặc tăng tải không cần thiết.

### A8. Mapping nội dung và hành vi hiện có

- Anchor navigation hiện hành cần giữ logic click/scroll; khi header sticky, dùng `scroll-margin-top` để tiêu đề không bị che.
- Hero 2 CTA đang dẫn tới danh mục và bảng giá; **giữ chức năng** này. Có thể tinh chỉnh nhãn CTA nhưng không tự đổi destination sang checkout.
- Image/lightbox hiện cho 3 ảnh sản phẩm và 2 poster bảng; giữ phóng to bằng tap/click, hỗ trợ đóng bằng Escape và nút rõ.
- Chọn size trong mẫu tin nhắn hiện cho 300/400/600g: nhãn/giá phải đúng API/catalog; copy text hoạt động, có trạng thái thành công/thất bại.
- Navigation đến Zalo đã tồn tại; không tự thay bằng Zalo OA/shop khác; dùng URL được repo cấu hình.
- Footer và bảng FAQ phải tiếp tục xuất hiện và không bị ẩn để giảm chiều cao trang.
- Nếu hiện trên trang có claim `Bán chạy nhất`, `Tiết kiệm`, `săn chắc`, `chuẩn vị` hoặc hứa hẹn giao/hạn dùng, kiểm tra chứng cứ và thông tin nhãn; chỉ chỉnh copy sau khi đối chiếu và được duyệt nếu thay đổi ý nghĩa.

### A9. Quy trình Antigravity bắt buộc — Two-pass + visual diff

**PASS 1: Audit only, không sửa code.**
1. Khởi chạy/đọc repo, tìm đúng landing route, CSS, components, data sources, hình ảnh, Zalo link và tracking.
2. Mở trang live tham chiếu và local app bằng browser nếu công cụ hỗ trợ; lưu screenshot ở **360, 390, 768, 1280, 1440px**, ghi rõ URL và thời gian chụp.
3. Vẽ section map theo A2, DOM/component map, đánh dấu vị trí màu cũ và cách thay token mới.
4. Ghi bảng `MUST KEEP | CAN RESTYLE | NEED APPROVAL`, đồng thời inventory các event handlers/anchor/CTA/lightbox.
5. Kế hoạch patch theo file + list regression tests. **Dừng và chờ người dùng duyệt** trước khi code.

**PASS 2: Triển khai sau duyệt.**
1. Tạo semantic tokens, component styles; tránh rewrite lớn.
2. Refactor mobile header + hero + product cards + bảng giá zoom + story/bảo quản/order/FAQ/footer đúng thứ tự.
3. Desktop fidelity: đối chiếu screenshot giữ bố cục trang cũ; mobile tối ưu theo A5/A6.
4. Test lint/typecheck/build; e2e smoke cho CTA, anchor, Zalo/tel, copy mẫu, lightbox và nghiệp vụ đặt hàng hiện có.
5. Chụp screenshot after, so sánh trước/sau, báo thay đổi được duyệt và những hạng mục chưa xác minh.
6. Trả báo cáo đường dẫn files đã sửa, test thực chạy, ảnh before/after và tác động performance đo được.

### A10. MASTER PROMPT v1.1 — DÁN NGUYÊN VĂN VÀO ANTIGRAVITY

```text
You are the lead UI/UX designer, senior Next.js engineer, responsive design specialist,
accessibility auditor, and performance engineer for the EXISTING production project
'Cá Bống Sông Trà'.

CRITICAL CHANGE OF REQUIREMENTS:
The owner LOVES the CURRENT LANDING PAGE LAYOUT at:
https://ca-bong-song-tra.vercel.app/
KEEP ITS LAYOUT, SECTION ORDER, NAVIGATION STRUCTURE AND OVERALL INFORMATION HIERARCHY.
DO NOT COPY ANY OF THE OLD WEBSITE'S COLORS OR CSS THEME.
Apply the NEW design system tokens from section 3 and section A7 of this Markdown.

PRIORITY ORDER:
1) Preserve existing confirmed business logic and backend contracts (SRS v2.0).
2) Preserve current landing layout/section order/behavior per section A2.
3) Achieve excellent mobile UX; mobile usability overrides literal pixel scaling.
4) Apply NEW brand color tokens/typography/component skins.
5) Keep desktop fidelity to old layout and improve performance/accessibility.

FIRST read the entire file docs/CA_BONG_SONG_TRA_UI_UX_DESIGN_SYSTEM_ANTIGRAVITY_V1_1_LAYOUT_PRESERVED.md
(or locate the file if named differently), then SRS v2.0 and the actual repository.
Sections A1-A10 OVERRIDE any contradictory landing-page layout, wireframe or CTA
recommendation in older sections of the UI spec. Dashboard/admin specs remain valid.

CONFIRMED OLD LANDING SECTIONS (DO NOT REORDER/DELETE):
0 Header with anchor navigation.
1 Hero: headline/subtext, two anchor CTAs, trust facts, genuine 3-jar image.
2 Mini trust/features strip.
3 Section 01: 3 product cards for 300g/400g/600g.
4 Section 02: genuine size-comparison and price-poster images, image zoom.
5 Emotional quote/interlude.
6 Section 03: Quang Ngai flavor story and meal suggestions.
7 Section 04: storage and food-safety information from manufacturer label.
8 Section 05: Zalo-based ordering steps, size-based suggested message, copy,
  QR/contact. Preserve actual flow; do not invent required checkout.
9 Section 06: 10 FAQ questions.
10 Footer, contact info, link navigation and existing customer CTA.

MOBILE FIRST: design and verify widths 320/360/375/390/414/430/768px.
Keep menu accessible; make product cards readable as one-column by default;
use full-width mobile comparisons with a usable zoom modal; preserve 3-size image
without cropping; provide tap-friendly anchors and a safe-area-aware sticky CTA;
prioritize direct Zalo/call actions on phones; keep scrolling smooth and avoid
horizontal overflow, layout shifts and expensive animations.

BRAND AND TRUTH:
- Product: Cá bống Sông Trà, Quảng Ngãi.
- 300g=109,000 VND; 400g=139,000 VND; 600g=199,000 VND nominal prices,
  but render actual approved catalog/API values if dynamic.
- These values describe NET WEIGHT of fish + braising liquid, excluding jars.
- Use only genuine approved images. No fake testimonials, ratings, badges or labels.
- Do not promise exact delivery times, storage durations or certifications not verified.

ENGINEERING GUARDRAILS:
- Project uses Next.js FE, NestJS BE, MongoDB Atlas DB and existing deployment.
- Modify frontend presentation first. Do not rewrite backend, DB, auth, inventory,
  financial calculations, member permissions or checkout/order flows.
- Reuse existing components and installed packages where possible.
- Avoid new heavy UI libraries; use existing Tailwind/CSS approach as appropriate.
- Keep TypeScript strict, responsive semantic CSS variables and keyboard accessibility.
- Do not hardcode phone/Zalo URLs when sourced from existing shop settings.

TWO-PASS PROCEDURE:
PASS 1 = AUDIT AND PLAN ONLY. DO NOT EDIT CODE.
Inspect current repo and original URL on desktop/mobile; generate screenshot
baselines, section/component inventory, exact changes, risks, and test plan.
Ask for approval before implementation.
PASS 2 = IMPLEMENT ONLY AFTER APPROVAL.
Make incremental patches, produce before/after screenshots at requested widths,
run lint/typecheck/build and smoke tests for CTA anchors, Zalo/tel, image zoom,
size-selector/copy, FAQ, checkout if it exists; report actual results honestly.

OUTPUT LANGUAGE: Vietnamese for UI labels, documentation and final status report.
START WITH PASS 1 NOW. DO NOT DESIGN A NEW LANDING PAGE FROM SCRATCH.
```

### A11. Prompt riêng cho giai đoạn mobile (dùng sau khi duyệt audit)

```text
Continue the approved landing redesign using section A in the project's UI spec.
Scope ONLY existing landing-page mobile responsiveness, no backend changes.
The old landing layout and its section order are immutable.
Implement robust screens at 320, 360, 375, 390, 414, 430 and 768px.
Audit mobile navigation, hero 3-size art, product cards, price image zoom,
flavor/story, storage guidance, Zalo message builder/copy, FAQ and sticky CTA.
Use NEW semantic brand tokens, never old website colors.
Prioritize correct tap targets, safe area, Vietnamese text wrap, image aspect ratio,
low layout shift, accessible dialogs and quick Zalo/call.
Test every touch action and deliver screenshot comparison plus measured findings.
Do not make scope changes or invent checkout/reviews.
```

### A12. Acceptance checklist — landing giữ layout cũ

- [ ] Các section 0–10 ở A2 tồn tại đúng thứ tự.
- [ ] Hero giữ cụm text/CTA và ảnh 3 size, không thành layout quảng cáo khác.
- [ ] 3 product cards dùng đúng hình/khối lượng tịnh/giá theo data source.
- [ ] Giữ cả ảnh bảng size và bảng giá, modal/lightbox chạm hoạt động.
- [ ] Giữ section cảm xúc, hương vị, bảo quản, đặt Zalo và FAQ 10 câu.
- [ ] 100% màu UI dùng palette/tokens mới; không chủ động lấy màu CSS cũ.
- [ ] Mobile 320–430px không tràn ngang, các nút bấm/CTA dễ chạm.
- [ ] Sticky bar không che input, FAQ, toast, footer và safe area.
- [ ] QR Zalo trên desktop dễ quét; mobile có deep link và fallback hợp lệ.
- [ ] Screenshot baseline và bản sau có so sánh cả desktop/mobile.
- [ ] Không thay đổi BE, kho, lợi nhuận, quyền hạn hoặc API contract.
- [ ] Kiểm tra thực tế trước khi ghi các mức LCP/INP/CLS là “đã đạt”.

---

# PHẦN B — DESIGN SYSTEM, DASHBOARD, TRIỂN KHAI VÀ CÁC PROMPT BỔ SUNG

> Các mục 0–21 bên dưới được giữ từ bản v1.0 làm hướng dẫn bổ sung. **Mọi đề xuất landing trong phần B khác với layout cũ phải nhường chỗ cho phần A**, bao gồm IA mới, CTA checkout bắt buộc, hero wireframe và thứ tự section. Dashboard vẫn giữ yêu cầu thiết kế ở phần B.

# CÁ BỐNG SÔNG TRÀ — UI/UX REDESIGN MASTER SPECIFICATION & ANTIGRAVITY PROMPT PACK

> **Phiên bản:** UI/UX v1.0 · 11/10/2026  
> **Trạng thái:** Tài liệu thiết kế, yêu cầu triển khai và tiêu chí nghiệm thu; **không phải** mô tả những gì mã nguồn hiện tại đã đạt.  
> **Phạm vi:** Website khách hàng (landing/storefront/checkout), Admin Dashboard và Member Portal, design system, hướng dẫn AI agent Antigravity, kiểm thử, triển khai an toàn.  
> **Tài liệu nghiệp vụ tham chiếu:** `SRS_CA_BONG_SONG_TRA_V2_0.md` (đã cung cấp). Nếu tài liệu này xung đột với SRS về nghiệp vụ tài chính, tồn kho, auth, bảo mật, **SRS và hành vi nghiệp vụ đã được xác nhận ưu tiên**; báo cáo xung đột để chủ dự án duyệt.  
> **Thông điệp định hướng:** *Warm Minimal Vietnamese Food Commerce* — “Mộc mạc có chủ đích, hiện đại vừa đủ, thực phẩm là nhân vật chính, một thao tác là hiểu và đặt hàng.”

---

## 0. Bắt đầu nhanh — HƯỚNG DẪN SỬ DỤNG FILE NÀY

1. Đặt file Markdown này vào thư mục `docs/` trong repository hiện tại; cung cấp cả ảnh sản phẩm thật vào `public/images/products/` (hoặc chỉ rõ vị trí ảnh hiện có).
2. Mở **Google Antigravity** tại repository đang chạy, đọc **Mục 15: MASTER PROMPT**, dán nguyên prompt vào agent. Cho agent đọc thêm toàn bộ file này và SRS v2.0.
3. Bắt buộc agent chạy **audit + plan + inventory file/route** trước khi sửa. Không cho viết lại từ đầu hoặc thay đổi backend vì đây là dự án *đang hoạt động*.
4. Thực hiện **lần lượt theo pha** ở Mục 13; review screenshot desktop/mobile trước khi merge.
5. Prompt theo pha ở Mục 16 giúp tối ưu chất lượng nếu agent làm từng phần thay vì làm một lượt quá lớn.
6. Không copy cả tài liệu này vào một *Antigravity Workflow* giới hạn kích thước; dùng file tại repo được agent tham chiếu hoặc chia thành task nhỏ.

### Trạng thái quyết định

| Hạng mục | Quyết định | Ghi chú |
|---|---|---|
| Phong cách | **Mộc mạc + hiện đại** | Không premium/luxury quá đà, không kiểu poster nhiều lớp |
| Màu | **Điểm nhấn vừa phải, nền sáng** | Landing ấm; dashboard trung tính hơn |
| Tác động cảm xúc | **Ngon + tin + quê nhà + tiện đặt** | Cả 4 mục tiêu nhưng giữ thứ tự rõ |
| Hero | **Ảnh thật cả 3 size** | 300g, 400g, 600g; không thay ảnh theo trí tưởng tượng |
| Sản phẩm | **3 card size riêng biệt** | CTA theo SKU, nổi bật giá và khối lượng tịnh |
| CTA | **Form nhanh + Zalo + gọi điện** | Phân cấp Primary/Secondary, không 3 CTA giành nhau |
| Feedback | **Chưa hiện ở giai đoạn đầu** | Không thêm đánh giá giả hoặc placeholder đánh giá như thật |
| Dashboard | **Tổng quan, tài chính là điểm nhấn** | Số chính có giải thích cách tính và trạng thái |
| Điều hướng | **Sidebar trái, collapse, mobile drawer** | Giữ menu/permissions theo role |
| Dashboard components | **Card + chart + table cân bằng** | Hạn chế hiệu ứng, thông tin có thứ bậc |
| Font | **Gọn, hiện đại, thân thiện** | Ưu tiên Be Vietnam Pro, có thể dùng riêng weight cho heading |
| Texture | **Chỉ landing, rất nhẹ** | Dashboard tuyệt đối nền sạch |
| Icon | **Outline** | Một bộ Lucide, stroke thống nhất |
| Output | **Prompt + wireframe + token + cấu trúc + UI copy + kế hoạch** | Tất cả gói trong một file Markdown |
| Coding agent | **Google Antigravity** | Hướng dẫn agent thực thi có gate kiểm thử |

---

## 1. Context và phạm vi giữ nguyên

### 1.1 Thương hiệu & kinh doanh

- Sản phẩm: **Cá bống Sông Trà – đặc sản Quảng Ngãi**, đang nhập hàng bán lại tại TP.HCM, ưu tiên Thủ Đức/Quận 9, Lò Lu, Võ Văn Hát và Dĩ An.
- Định vị: giá hợp lý, có hàng tại TP.HCM, thuận tiện mua và giao, hương vị quê nhà.
- Quy cách **khối lượng tịnh cá và nước kho, không bao gồm hũ/bao bì**: 300g, 400g, 600g; không gọi theo quy cách cũ.
- Giá bán mặc định hiện tại: **300g — 109.000đ; 400g — 139.000đ; 600g — 199.000đ**. Trong sản phẩm chạy thật, **giá hiển thị phải lấy từ API/product catalog**, không hardcode khi dữ liệu quản trị đã có.
- Hình ảnh người dùng cung cấp gồm: `Bảng giá.png`, `Bảng size.png`, `Giá size lớn.png`, `Giá size nhỏ.png`, `Giá size vừa.png`.
- SĐT xuất hiện trong ảnh: **070 2478 561**. Trước khi hardcode hotline hay link Zalo, **xác nhận đây là hotline/Zalo chính thức đang dùng**; trong code lấy từ cấu hình shop hiện có.
- Chưa có feedback được xác thực để đưa lên landing; **không tạo review/đơn ảo, không bịa chứng nhận, không tự cam kết thời hạn dùng hoặc vận chuyển**.

### 1.2 Giữ nguyên stack và phạm vi thay đổi

- **Frontend:** Next.js + React + TypeScript; tận dụng routing và thư viện đang dùng, không tự nâng version vô cớ.
- **Backend:** NestJS REST API; **không đổi API contract** chỉ để phục vụ thay đổi giao diện nếu không thực sự cần.
- **Database:** MongoDB Atlas; không chỉnh schema/indexes khi chưa cần và chưa review.
- **Deploy:** Vercel frontend/backend theo cấu hình đã được lựa chọn; GitHub Actions CI/CD.
- Ưu tiên tối đa **refactor giao diện (FE)**, giữ nguyên auth, checkout, order status, tiền tệ, hoa hồng, FIFO/FEFO, inventory reservation, reconciliation, member permissions và flows nghiệp vụ.
- Nếu cần sửa API vì thiếu dữ liệu dashboard hoặc ảnh sản phẩm: đề xuất cụ thể trước, xác định ảnh hưởng và test regression.

### 1.3 Những gì không thuộc redesign

- Không đổi bảng giá, size, giá vốn, tỷ lệ chia hoa hồng, công thức lợi nhuận, luồng thanh toán/kho.
- Không phát triển fanpage, ads, affiliate, loyalty, vouchers, điểm thưởng, chatbot, thông báo realtime hoặc tính năng mới không được yêu cầu.
- Không viết lại ứng dụng, không di chuyển framework, không thay DB, không cài quá nhiều thư viện UI cùng chức năng.
- Không ép tạo feedback, hình kho, thực phẩm, chứng từ, cam kết vệ sinh nếu chưa có dữ liệu thật.
- Không thay thương hiệu thành “Cá bống kho tộ”, “Cá bống rim”, “100% nguyên chất” hoặc các tuyên bố chưa được xác nhận trên nhãn.

---

## 2. Design philosophy và các nguyên tắc không thỏa hiệp

1. **Product-first:** ảnh hũ cá thật, giá và size là trọng tâm thị giác.
2. **Conversion-first:** người mua biết bán gì, giá bao nhiêu, đặt thế nào, được giao khu vực nào trong vài giây đầu tiên.
3. **One primary action per context:** landing ưu tiên `Chọn mua`/`Đặt hàng`; gọi/Zalo là lựa chọn phụ nhưng dễ thấy.
4. **Mobile-first storefront:** 360–430px đẹp và dễ chạm trước; sau đó mở rộng desktop.
5. **Desktop-first information density for admin:** dashboard đọc số liệu nhanh; tablet/mobile không bị bảng tràn ngang khó hiểu.
6. **Warm but calm:** tối đa 1–2 điểm cam nổi bật trên một viewport; UI không trở thành poster quảng cáo.
7. **Human and local:** tiếng Việt tự nhiên, thân thiện, không khoa trương, không hàng loạt từ “premium / số 1 / chuẩn 100%”.
8. **Clarity before effects:** chuyển động nhẹ, có hỗ trợ prefers-reduced-motion; không slider tự chạy.
9. **Truthful data:** không trộn số dự kiến/số thực, không bịa rating, lượt bán, tồn kho, giao nhanh trong bao nhiêu phút.
10. **Stable engineering:** skin redesign không làm sai API, pagination, role, calculate, form validation, tracking.
11. **Accessible by default:** contrast, keyboard, label, error message, focus ring, screen reader.
12. **Optimize measurable outcomes:** dữ liệu thực mới quyết định thay đổi sau này; thiết kế tốt không tự bảo đảm tăng chuyển đổi.

### Thứ tự hiển thị thông tin trên landing

`Sản phẩm là gì → 3 size/giá → Lợi ích đã xác thực → Cách đặt → Độ tin cậy/hướng dẫn → FAQ`.

### Thứ tự hiển thị thông tin trên dashboard

`Ngày/khoảng thời gian → KPI tiền/đơn → trend → breakdown → hành động cần xử lý → dữ liệu chi tiết`.

---

## 3. Design system foundations

### 3.1 Nguyên tắc màu từ ảnh thương hiệu

Ảnh quảng bá thể hiện cam đỏ tươi, đỏ nắp hũ, nâu đậm của món ăn và nền trắng ngà có texture. Các màu dưới đây là **token đề xuất cho giao diện**, **không phải số đo pixel được trích xuất chính xác** từ tài sản thương hiệu. Có thể tinh chỉnh sau khi so trực tiếp trên browser.

#### Brand orange

| Token | HEX | Vai trò |
|---|---|---|
| `brand-50` | `#FFF6EF` | Nền hero rất nhạt, hover |
| `brand-100` | `#FFE9D9` | Chip nhạt, tint |
| `brand-200` | `#FFD0B1` | Viền trang trí nhẹ |
| `brand-300` | `#FFAD7E` | Trang trí nhỏ |
| `brand-400` | `#FF7941` | Accent phụ |
| `brand-500` | `#F4511E` | Brand accent/illustration |
| `brand-600` | `#D84012` | Nền CTA chính, badge riêng |
| `brand-700` | `#AF330F` | Hover CTA |
| `brand-800` | `#84290F` | Text trên nền sáng khi cần |
| `brand-900` | `#5C2114` | Ít dùng |

> Dùng brand-600 cho nút chữ trắng nhằm dễ đạt contrast hơn cam sáng. Không dùng brand-500 làm văn bản nhỏ trên nền trắng nếu chưa kiểm tra contrast.

#### Brown / appetizing earth

| Token | HEX | Vai trò |
|---|---|---|
| `earth-50` | `#FAF6F1` | Background warm |
| `earth-100` | `#F0E6DB` | Surface phụ |
| `earth-200` | `#DFCABB` | Border ấm |
| `earth-400` | `#A57B63` | Decorative |
| `earth-600` | `#79503E` | Heading phụ |
| `earth-700` | `#633C2D` | Heading/tên thương hiệu |
| `earth-900` | `#35241D` | Text đậm |

#### Neutral + semantic

| Semantic token | Light HEX | Diễn giải |
|---|---|---|
| `canvas` | `#FFFCF8` | Landing nền sáng ấm |
| `admin-canvas` | `#F7F8FA` | Dashboard nền sạch |
| `surface` | `#FFFFFF` | Card, modal |
| `surface-muted` | `#F8F6F3` | Section nhẹ |
| `text-primary` | `#27201C` | Text chính |
| `text-secondary` | `#675E57` | Text phụ |
| `text-muted` | `#756C66` | Caption có độ tương phản đủ |
| `border` | `#E8E3DE` | Viền nhẹ |
| `border-strong` | `#D1C8C0` | Viền input |
| `focus` | `#D84012` | Focus outline |
| `success` | `#15803D` | Thành công (không chỉ dựa màu) |
| `warning` | `#A16207` | Chờ xử lý |
| `danger` | `#B91C1C` | Thất bại/hủy |
| `info` | `#1D4ED8` | Thông tin |

#### Phân bổ và giới hạn màu

- Landing: khoảng 70–80% nền sáng/trắng, 10–20% nâu/chữ, 5–10% cam thương hiệu; **không phải quy tắc đo cứng**.
- Admin: ≥85% UI trung tính theo cảm quan; brand chỉ xuất hiện ở logo, CTA, trạng thái active, và một series chart chính.
- Tuyệt đối không dùng cùng lúc nền cam, chữ cam và badge cam ở 3 vùng cạnh nhau.
- Red dùng cho lỗi; tránh dùng đỏ brand làm trạng thái “nguy hiểm” nếu có thể gây lẫn.
- Biểu đồ thể hiện danh mục/đơn vị bằng nhiều dấu hiệu: chú thích + hình thức + màu, không dựa màu đơn độc.

### 3.2 Typography

- **Primary font:** `Be Vietnam Pro` (ưu tiên font sẵn có hoặc cấu hình `next/font`; giảm font weights về 400, 500, 600, 700, 800 nếu thật sự dùng).
- **Display:** vẫn `Be Vietnam Pro`, 700–800, có thể tracking `-0.025em` cho heading lớn để gọn hiện đại nhưng không lạnh lùng.
- Tránh font poster phá cách trên text dài; nếu đưa font vui nhộn vào tagline nghệ thuật, chỉ ở vùng không ảnh hưởng readability và bắt buộc hỗ trợ dấu tiếng Việt.
- Fallback: `Arial, sans-serif`.

| Style | Desktop | Mobile | Line-height | Weight |
|---|---|---|---|---|
| Hero display | 52–60px | 32–38px | 1.1–1.17 | 800 |
| H1 page | 36–42px | 28–32px | 1.2 | 700 |
| H2 section | 28–32px | 23–27px | 1.25 | 700 |
| H3 / card heading | 20–24px | 18–20px | 1.3 | 700 |
| Body large | 18px | 16px | 1.65 | 400 |
| Body | 16px | 15–16px | 1.55 | 400 |
| Small / label | 14px | 14px | 1.45 | 500 |
| Caption | 12–13px | 12–13px | 1.45 | 500 |
| KPI metric | 30–36px | 24–30px | 1.2 | 700 |

**Rules:** không body dưới 14px trừ ghi chú thực sự phụ, không all-caps quá dài tiếng Việt, dùng `font-variant-numeric: tabular-nums` cho tiền/KPI/bảng.

### 3.3 Spacing / dimensions / grid

- Base unit: **4px**; scale: `4,8,12,16,20,24,32,40,48,64,80,96`.
- Landing max-width content: `1200px` (có thể 1240px theo layout existing); padding mobile 16–20px, tablet 24px, desktop 32px.
- Landing section spacing: desktop 72–96px, tablet 56–72px, mobile 40–56px.
- Product grid: mobile 1 cột, tablet 2 cột (nếu phù hợp), desktop 3 cột; ưu tiên card cao cân đối.
- Admin main padding: desktop 24–32px, mobile 16px; sidebar desktop 248px expanded, 72px collapsed; topbar 64px.
- Breakpoints tham chiếu: mobile `<640`, tablet `640–1023`, desktop `>=1024`; dùng breakpoints có sẵn của project nếu khác, không bắt ép.
- Touch target: mục tiêu ≥44×44px; khoảng cách tap targets tránh bấm nhầm.

### 3.4 Radius, border, shadows, imagery

| Token | Giá trị | Dùng cho |
|---|---|---|
| `radius-sm` | 10px | Input nhỏ, chip |
| `radius-md` | 14px | Button, input, chart tooltip |
| `radius-lg` | 18px | Admin card |
| `radius-xl` | 24px | Product card, section featured |
| `radius-2xl` | 28px | Hero image frame |
| `radius-pill` | 999px | Badge, CTA có chủ đích |
| `shadow-sm` | `0 1px 3px rgb(34 25 20 / .06)` | Surface admin |
| `shadow-md` | `0 8px 24px rgb(54 34 24 / .08)` | Hover product card |
| `shadow-lg` | `0 16px 48px rgb(54 34 24 / .12)` | Modal lớn / hero image |

- 1px border ưu tiên hơn đổ bóng dày trên dashboard.
- Hero/product ảnh thật, nền trắng ngà sạch; có thể có vòng tròn màu brand-50 phía sau hũ nhưng không thay shape/label sản phẩm.
- Texture nhẹ chỉ ở **một mảng hero/CTA landing**, overlay rất thấp, không chạy liên tục toàn trang; dashboard không texture.
- Không tạo hiệu ứng glassmorphism, neumorphism, 3D charts, parallax nặng.

### 3.5 Iconography

- Dùng **Lucide** outline thống nhất: `strokeWidth` 1.75–2, 18–20px control, 20–24px menu/feature.
- Ví dụ: `ShoppingBag`, `Phone`, `MessageCircle`, `Truck`, `Package`, `Wallet`, `ChartNoAxesCombined`, `Users`, `Settings`, `ChevronDown`, `Filter`, `Search`, `CircleHelp`, `AlertTriangle`.
- Không phối trộn 3 loại icon pack; emoji chỉ dùng trong content marketing không dùng làm icon hệ thống.

### 3.6 Interaction / motion

- Microtransition 150–220ms ease-out (hover/focus/press), không animation kéo dài không cần thiết.
- Drawer/dialog 180–260ms; skeleton khi request đang chạy; button loading disable submit lặp.
- Hover: nâng card nhẹ (tối đa 2–3px) hoặc đổi border, không lật/zoom sản phẩm thái quá.
- `prefers-reduced-motion: reduce` tắt transform/transition không thiết yếu.
- Không autoplay hero slider, không popup chặn khách ngay khi mở site.

### 3.7 Tokens mẫu cho Tailwind v4 / CSS variables

> Agent **phải xem phiên bản Tailwind hiện tại** trước khi chọn syntax. Dưới đây là tham chiếu token ở CSS, không bắt buộc copy nguyên nếu project dùng Tailwind v3.

```css
:root {
  --brand-50: #fff6ef;
  --brand-100: #ffe9d9;
  --brand-500: #f4511e;
  --brand-600: #d84012;
  --brand-700: #af330f;
  --earth-700: #633c2d;
  --canvas: #fffcf8;
  --admin-canvas: #f7f8fa;
  --surface: #ffffff;
  --text-primary: #27201c;
  --text-secondary: #675e57;
  --border-default: #e8e3de;
  --focus-ring: #d84012;
  --status-success: #15803d;
  --status-warning: #a16207;
  --status-danger: #b91c1c;
  --status-info: #1d4ed8;
  --radius-control: 14px;
  --radius-card: 18px;
  --radius-product: 24px;
  --shadow-card: 0 1px 3px rgb(34 25 20 / 0.06);
  --shadow-product: 0 8px 24px rgb(54 34 24 / 0.08);
}
```

Nếu dùng Tailwind v4:

```css
@import "tailwindcss";
@theme inline {
  --color-brand: var(--brand-600);
  --color-brand-soft: var(--brand-50);
  --color-earth: var(--earth-700);
  --color-page: var(--canvas);
  --color-admin-page: var(--admin-canvas);
  --color-ink: var(--text-primary);
  --color-ink-muted: var(--text-secondary);
  --color-ui-border: var(--border-default);
  --radius-ui-card: var(--radius-card);
}
```

**Lưu ý kỹ thuật:** Dùng alias `--radius-ui-card` để tránh custom property tự tham chiếu.

Nếu dự án dùng Tailwind v3 hãy mở rộng `theme.extend.colors` bằng `var(--...)` trong config tương ứng, thay vì nâng Tailwind chỉ để sử dụng ví dụ trên.

### 3.8 Status tokens & semantic mapping

| Business state | Nhãn UI | Chỉ báo | Không dùng |
|---|---|---|---|
| `PENDING` | Chờ xác nhận | warning soft + icon đồng hồ | đỏ lỗi |
| `CONFIRMED` | Đã xác nhận | info soft + icon check | xanh success nếu chưa hoàn tất |
| `DELIVERED` | Đã giao | success soft | chỉ icon màu không text |
| `CANCELLED` | Đã hủy | neutral/danger soft | icon giao hàng |
| `PAID` | Đã thanh toán | success + text | gộp với delivered |
| `UNPAID` | Chưa thanh toán | warning | tự suy ra đã trả |
| `PARTIAL` (nếu backend có) | Thanh toán một phần | warning/info | tự thêm enum vào API |
| `REFUNDED` (nếu backend có) | Đã hoàn tiền | neutral/info | hiện như đơn thành công thu tiền |
| `LOW_STOCK` (UI derived) | Sắp hết hàng | warning | khẳng định số tồn khi API chưa trả |
| `NEAR_EXPIRY` (UI derived) | Gần hết hạn | warning | cố định hạn dùng không theo lô |

Dùng **trạng thái thực sự backend định nghĩa**; không tạo state mới chỉ vì muốn badge đẹp.

---

## 4. Component library specification

### 4.1 Tiêu chuẩn chung

- Các thành phần phải có variants/type-safe, tránh 5 phiên bản nút khác nhau trên từng màn hình.
- Sử dụng component library có sẵn trong repo nếu đủ tốt; **có thể dùng shadcn/ui + Radix nếu đang phù hợp**, nhưng không cần cài mới toàn bộ khi app đã có thư viện tương đương.
- Support loading, disabled, invalid/error, empty, read-only, focus, keyboard.
- Form error xuất hiện gần field, có thông báo tổng nếu submit lỗi; không dùng `alert()` tràn lan.
- Bắt buộc `aria-label` cho icon-only button; dialog focus trap; Escape closes khi an toàn.

### 4.2 Danh mục component cần chuẩn hóa

| Component | Variants | Quy tắc |
|---|---|---|
| `Button` | primary, secondary, outline, ghost, destructive | 44–48px, spinner và disabled khi submit |
| `IconButton` | default, ghost, destructive | >=44px hit area, tooltip/aria label |
| `Badge` | status, SKU, stock | Không dùng cho header thường |
| `Input` | default, error, readOnly | Có label và hint |
| `Select` | single | Searchable nếu list dài, clear nếu phù hợp |
| `Textarea` | standard | Giới hạn ký tự nếu có schema |
| `NumberInput` | VND, qty | Locale vi-VN, validate input |
| `PhoneInput` | VN | Chuẩn hóa hiển thị/trước submit đúng API |
| `FormField` | label, hint, error | Error dưới input |
| `Card` | marketing, KPI, content | Landing bo tròn nhiều hơn admin |
| `KpiCard` | neutral, warning, loading | label, value, date range, delta có baseline |
| `TrendDelta` | positive, negative, flat | Không gán tăng = tốt trong mọi metric |
| `ChartCard` | chart+title+filters | Loading/empty/error; tooltip tiền đúng định dạng |
| `DataTable` | sortable, paginated | Header, no-data, error, responsive |
| `FilterBar` | date range, status, member, search | Sync URL nếu routing hiện có phù hợp |
| `Sheet/Drawer` | mobile nav, filter, quick form | Trap focus, scroll lock |
| `Modal/Dialog` | create/edit/confirm | Tránh lồng dialog |
| `Toast` | success, info, error | Không tiết lộ dữ liệu nhạy cảm |
| `EmptyState` | no-data, filtered-out, no-permission | CTA hợp lệ tùy role |
| `Skeleton` | KPI, card, table | Giữ layout để hạn chế CLS |
| `ProductCard` | 300/400/600 | SKU, net weight, price, real image, CTA |
| `OrderStatusBadge` | enum từ API | Nhãn nhất quán mọi trang |
| `Money` | VND | Intl.NumberFormat('vi-VN') |
| `DateTime` | Asia/Ho_Chi_Minh | Date/time nhất quán |
| `ConfirmActionDialog` | destructive | Hỏi xác nhận và mô tả hậu quả |

### 4.3 Button hierarchy thực tế

- Landing product card: **Primary = `Chọn mua`**; hotline/Zalo dưới hero dùng secondary/outline.
- Trong quick order drawer: **Primary = `Xác nhận đặt hàng`**; secondary = `Tiếp tục xem`.
- Admin order table: **Primary action theo trạng thái được phép**, không hiển thị hành động gây lầm như “Đã thanh toán” nếu chưa xử lý payment.
- Không có nút “Đặt hàng ngay” mà chỉ scroll vô nghĩa nếu yêu cầu mở form/checkout.
- Nút Zalo: chỉ mở official verified URL, không tạo URL giả; hotline `tel:` phải lấy từ config.

### 4.4 Chuẩn hiển thị dữ liệu

```ts
export const moneyVnd = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: 'VND', maximumFractionDigits: 0
  }).format(value);

export const qty = (value: number) =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
```

- Bảng tài chính không ghi `Lợi nhuận` chung chung khi số thực là `Lợi nhuận chia theo đơn` hay `Phần chủ shop (trước chi phí chung)`.
- Tiền có dấu phân cách hàng nghìn: `109.000đ` / `109.000 ₫`, nhất quán.
- Khi so sánh kỳ trước phải hiển thị đủ khoảng thời gian, điều kiện lọc, cách tính và trường hợp thiếu baseline.
- Mọi chart có unit labels; các dữ liệu chưa có phải báo **Chưa có dữ liệu**, không ngụy tạo số 0 như thực tế.

---

## 5. Landing page — UX specification

### 5.1 Mục tiêu và nguyên tắc chuyển đổi

Người dùng mới có thể trả lời trong 5–8 giây: *Sản phẩm gì? Từ đâu? Size/giá? Mua bằng cách nào?*. 5–8 giây là mục tiêu thiết kế cần usability test, không phải số liệu đã được chứng minh.

**1 CTA ưu tiên trên mỗi khu vực:** `Chọn size / Đặt hàng nhanh` → mở checkout có thông tin sản phẩm/số lượng prefill. Hai kênh hỗ trợ `Zalo` và `Gọi ngay` luôn có lối đi rõ, nhưng không tranh hierarchy.

### 5.2 Information architecture landing

1. Sticky header tối giản: logo/tên, Sản phẩm, Cách đặt, FAQ, CTA `Đặt hàng`.
2. Hero: câu headline cảm xúc, subhead giá trị thật, 3 size ảnh thật, 1 CTA chính + 1 CTA tư vấn.
3. Product cards: 3 size, giá nổi bật, net weight, giá ưu tiên API, ảnh thật.
4. Mini benefits/trust: có sẵn tại TP.HCM (chỉ khi tồn thực), 3 size rõ ràng, món mặn tiện bữa cơm; không cam kết giao nhanh cố định.
5. “Cách đặt hàng”: chọn size, nhập thông tin, xác nhận, shop liên hệ/giao theo thỏa thuận.
6. “Ăn ngon cùng cơm”: tối đa một section dùng ảnh thật, không tuyên bố chất lượng chưa xác thực.
7. FAQ 4–6 câu: size, phí ship, khu vực giao, bảo quản theo nhãn, đặt qua Zalo/gọi, thanh toán.
8. CTA cuối trang: đặt nhanh hoặc liên hệ.
9. Footer: thông tin shop đã xác nhận, hotline, link chính sách nếu có, social có thật.
10. Mobile sticky action bar: `Đặt hàng` (primary), `Zalo`, `Gọi` (secondary/icon). Không che input, không đè toast/keyboard.

**Không thêm section feedback** cho đến khi có đánh giá được phép sử dụng.

### 5.3 Hero copy — lựa chọn ưu tiên

**Eyebrow:** `Đặc sản Quảng Ngãi • Có hàng tại TP.HCM` (vế “Có hàng” phải phản ánh tồn kho thực tế nếu public).

**H1:** `Cá bống Sông Trà — Đậm đà đưa cơm`

**Supporting text:** `Một chút hương vị Quảng Ngãi cho bữa cơm nhà. Dễ chọn với 3 hũ 300g, 400g và 600g, xem giá rõ ràng và đặt hàng nhanh.`

**CTA chính:** `Chọn hũ cá phù hợp` → scroll có focus/anchor `#san-pham`.

**CTA phụ:** `Nhắn Zalo tư vấn` → link xác nhận.

**Trust line:** `300g • 400g • 600g` + `Giao tại khu vực hỗ trợ` (chi tiết không khẳng định quá mức).

Các phương án H1 phụ:

- `Đậm vị Quảng Ngãi, tròn vị bữa cơm nhà`
- `Một hũ cá bống, thêm thương nhớ vị quê`
- `Cá bống Sông Trà — Vừa mở hũ, đã muốn ăn cơm`

Tránh lời khẳng định “sạch tuyệt đối”, “chuẩn vị 100%”, “bảo quản 4 tháng” nếu nhà sản xuất chưa ghi xác nhận.

### 5.4 Layout wireframe — desktop

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ [Logo Cá bống Sông Trà]     Sản phẩm   Cách đặt   FAQ         [Đặt hàng] │
├────────────────────────────────────────────────────────────────────────────┤
│  Đặc sản Quảng Ngãi • Có hàng tại TP.HCM                                 │
│                                                                            │
│  CÁ BỐNG SÔNG TRÀ                [ẢNH THẬT CẢ 3 SIZE]                    │
│  ĐẬM ĐÀ ĐƯA CƠM                  ảnh gọn, clean, không chữ chồng lên hũ   │
│  Quê nhà trong bữa cơm...                                                 │
│  [Chọn hũ cá phù hợp]  [Nhắn Zalo]                                         │
│                                                                            │
│  3 size rõ ràng • Giá minh bạch • Đặt nhanh                                │
├────────────────────────────────────────────────────────────────────────────┤
│  Chọn size phù hợp                                                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│  │ [HŨ 300g]        │  │ [HŨ 400g]        │  │ [HŨ 600g]        │         │
│  │ 300g khối lượng  │  │ 400g khối lượng  │  │ 600g khối lượng  │         │
│  │ tịnh             │  │ tịnh             │  │ tịnh             │         │
│  │ 109.000đ         │  │ 139.000đ         │  │ 199.000đ         │         │
│  │ [Chọn mua]       │  │ [Chọn mua]       │  │ [Chọn mua]       │         │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘         │
├────────────────────────────────────────────────────────────────────────────┤
│  Vị quê nhà • Món mặn tiện bữa cơm • Liên hệ giao hàng                   │
├────────────────────────────────────────────────────────────────────────────┤
│  Cách đặt: 1 Chọn size → 2 Nhập thông tin → 3 Xác nhận                   │
├────────────────────────────────────────────────────────────────────────────┤
│  [ẢNH MÓN ĂN THẬT]           Bữa cơm thêm đậm đà                          │
├────────────────────────────────────────────────────────────────────────────┤
│  FAQ accordion  |  CTA cuối trang  |  Footer                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### 5.5 Layout wireframe — mobile

```text
┌──────────────────────────────┐
│ LOGO                     ☰   │
├──────────────────────────────┤
│ Đặc sản Quảng Ngãi           │
│ CÁ BỐNG SÔNG TRÀ             │
│ Đậm đà đưa cơm               │
│ Giới thiệu 2-3 dòng          │
│ [ẢNH CẢ 3 SIZE - đầy đủ]     │
│ [Chọn hũ cá phù hợp]         │
│ [Nhắn Zalo tư vấn]           │
├──────────────────────────────┤
│ 3 HŨ CÁ — GIÁ RÕ RÀNG        │
│ ┌──────────────────────────┐ │
│ │ [Ảnh 300g]   109.000đ    │ │
│ │ Hũ 300g · khối lượng tịnh │ │
│ │ [Chọn mua]               │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ [Ảnh 400g]   139.000đ    │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ [Ảnh 600g]   199.000đ    │ │
│ └──────────────────────────┘ │
│ Cách đặt / FAQ / Footer      │
├──────────────────────────────┤
│ [Đặt hàng] [Zalo] [Gọi]      │ <- fixed; chừa safe-area
└──────────────────────────────┘
```

### 5.6 Product card chi tiết

- Ảnh 1:1 hoặc 4:5 từ asset thực, `object-fit: contain`, nền không quá lố; ưu tiên bản ảnh đã cắt hũ khỏi poster nếu **đã có file gốc**.
- `Tên`: `Cá bống Sông Trà — Hũ 300g`.
- `Định lượng`: `Khối lượng tịnh: 300g (cá và nước kho)` (không chỉ 300g cá).
- `Giá`: kích thước nổi bật, lấy API.
- Optional thông tin size/gợi ý chọn: chỉ đưa mô tả nếu được xác thực; không gán “3–4 người ăn” khi chưa có căn cứ.
- `CTA`: `Chọn mua` → checkout drawer/form với SKU selected; xử lý tồn kho/validation ở API.
- Nếu backend báo hết hàng: `Tạm hết hàng` không cho tạo đơn vượt tồn, có thể hiển thị liên hệ nếu shop chấp nhận.
- Không gắn “Bán chạy nhất” khi chưa có dữ liệu thực về số lượng bán.
- Tránh đánh dấu giá 199k là “giảm 30%” vì không có giá gốc hợp lệ.

### 5.7 Checkout/order UX

**Ưu tiên:** quick order drawer (desktop right sheet) hoặc full-screen/sheet mobile; không tạo checkout mới nếu hiện tại đã có flow ổn định.

Trường tối thiểu (phụ thuộc API): sản phẩm và số lượng, họ tên, số điện thoại, địa chỉ, ghi chú, phí ship nếu đã biết và cách liên hệ.

Luồng:

1. Click `Chọn mua 400g` → form mở với SKU=400g, qty=1.
2. Người dùng thay đổi số lượng → hiển thị tạm tính sản phẩm; nếu phí ship chưa xác nhận ghi rõ `Phí vận chuyển được xác nhận khi shop liên hệ`.
3. Validate client để hỗ trợ UX, **server vẫn là nguồn xác minh cuối cùng**.
4. Submit disable khi đang gửi; thông báo thành công chỉ khi API trả success.
5. Khi lỗi mạng không tự tuyên bố đã nhận đơn; cho phép thử lại an toàn theo cơ chế chống trùng của backend.
6. Success state có mã đơn nếu backend trả, nhắc shop sẽ liên hệ nếu đúng quy trình; không hứa giao trong N phút.

**Lưu ý:** Không hiển thị “Thanh toán thành công” nếu mới gửi order request; không lấy doanh thu dashboard từ đơn pending.

### 5.8 FAQ chuẩn đề xuất

**Có mấy size?** 3 hũ: 300g, 400g, 600g; đây là khối lượng tịnh của cá và nước kho, không gồm bao bì.

**Giá từng size là bao nhiêu?** 300g 109.000đ; 400g 139.000đ; 600g 199.000đ (lấy giá hiện hành từ hệ thống).

**Shop giao ở đâu?** Ưu tiên khu vực Thủ Đức/Quận 9, Dĩ An và vùng lân cận; khu vực cụ thể và phí ship xác nhận khi đặt hàng.

**Bảo quản ra sao?** Xem và thực hiện theo hướng dẫn/hạn sử dụng trên nhãn sản phẩm của lô hàng thực tế; không tự đưa ra cam kết bảo quản cố định trên website.

**Có thể đặt qua Zalo/gọi điện?** Có, khi đường dẫn/số liên hệ chính thức đã được cấu hình và kiểm tra.

**Khối lượng 300g/400g/600g là khối lượng cá riêng?** Không; là khối lượng tịnh của cá và nước kho.

### 5.9 SEO / social / metadata

- Title trang tự nhiên, ví dụ: `Cá bống Sông Trà Quảng Ngãi | 3 size 300g, 400g, 600g`.
- Meta description ngắn với sản phẩm, giá và khu vực nếu đúng thực tế.
- H1 duy nhất, H2 theo section, canonical nếu cấu hình có.
- OG image ưu tiên ảnh product thật, không gắn thông tin chưa xác minh.
- JSON-LD Product/Offer chỉ khi dữ liệu chính xác, giá và availability được cập nhật; không fake rating/Review.
- Links điều hướng có text rõ, ảnh có alt đúng size, không keyword stuffing.

---

## 6. Dashboard & admin/member portal — UX specification

### 6.1 Dashboard owner — câu hỏi phải trả lời nhanh

1. Hôm nay/tháng này có bao nhiêu doanh thu **đã ghi nhận**?
2. Bao nhiêu đơn thành công, bao nhiêu hũ theo từng size?
3. Lợi nhuận gộp, lợi nhuận chia, phần chủ shop, chi phí chung, lợi nhuận ròng và dòng tiền khác nhau thế nào?
4. Tồn kho khả dụng còn bao nhiêu, có lô gần hết hạn không?
5. Thành viên nào bán tốt, hoa hồng đã phát sinh và đã thanh toán là bao nhiêu?
6. Khách mới, số đơn mua lại, số khách duy nhất quay lại là bao nhiêu?
7. Có đơn nào cần xử lý ngay?

**Không được hiển thị các trường là một metric duy nhất “lợi nhuận”**; API và SRS quy định cách ghi nhận.

### 6.2 Role-based dashboards

**Owner/Admin:** overview doanh thu/lợi nhuận, order, inventory, customers, team, commissions, promotion (nếu đã có), expenses/finance, settings.

**Member:** đơn của chính mình, hũ đã bán theo kỳ, KPI của bản thân, hoa hồng phát sinh/chưa nhận/đã nhận theo quyền; không có giá vốn, lợi nhuận toàn shop, đơn thành viên khác hoặc kho bí mật nếu RBAC không cho phép.

**Không chỉ ẩn UI:** backend luôn phải kiểm tra role/ownership. Nếu API từ chối 403, hiển thị trạng thái quyền phù hợp, không cố tải lại vô hạn.

### 6.3 Sidebar IA đề xuất

```text
[Brand mini / Logo]        [Collapse]

TỔNG QUAN
  Dashboard

KINH DOANH
  Đơn hàng
  Khách hàng
  Sản phẩm
  Kho hàng

ĐỘI NGŨ
  Thành viên
  KPI & Hoa hồng

TÀI CHÍNH
  Thu chi / Tài chính
  Khuyến mãi   (chỉ khi module đang triển khai)

HỆ THỐNG
  Cài đặt
  Nhật ký hoạt động (owner nếu có)

[Hồ sơ] [Đăng xuất]
```

- Sidebar fixed desktop, collapse 248→72px, tooltips ở trạng thái collapsed.
- Với viewport tablet hoặc nhỏ hơn có thể auto-drawer; mobile luôn drawer.
- Active state có left accent bar nho nhỏ + background nhẹ, không nền cam đậm cả dòng.
- Header có breadcrumb, filter thời gian (dashboard), thông tin account, quick action hợp lệ.
- Cấp menu dựa trên role và route hiện có, **không tạo route trống giả**.

### 6.4 Owner dashboard desktop wireframe

```text
┌───────────────┬─────────────────────────────────────────────────────────────┐
│ LOGO  ◀       │ Tổng quan                           [Kỳ ▼] [Tạo đơn] [Me] │
│               ├─────────────────────────────────────────────────────────────┤
│ Dashboard     │ Tổng quan hoạt động • dữ liệu tính theo kỳ đã chọn         │
│ Đơn hàng      │                                                             │
│ Khách hàng    │ [Doanh thu] [Lợi nhuận ròng*] [Đơn thành công] [Hũ bán]  │
│ Sản phẩm      │  * tooltip công thức, pending/unknown nếu thiếu dữ liệu     │
│ Kho hàng      │                                                             │
│ Thành viên    │ ┌─────────────────────────────┐ ┌────────────────────────┐ │
│ KPI/HH        │ │ Biểu đồ doanh thu / ngày    │ │ Hũ bán theo size      │ │
│ Tài chính     │ │ line/bar                    │ │ bar (300/400/600)     │ │
│ Cài đặt       │ └─────────────────────────────┘ └────────────────────────┘ │
│               │                                                             │
│               │ ┌──────────────────────┐ ┌───────────────────────────────┐ │
│               │ │ Đơn cần xử lý        │ │ Cảnh báo kho / gần hết hạn    │ │
│               │ └──────────────────────┘ └───────────────────────────────┘ │
│               │                                                             │
│               │ ┌─────────────────────────────────────────────────────────┐ │
│               │ │ Đơn hàng gần đây [Lọc] [Xem tất cả]                     │ │
│               │ │ Mã • Ngày • Khách (phân quyền) • Tiền • Trạng thái       │ │
│               │ └─────────────────────────────────────────────────────────┘ │
└───────────────┴─────────────────────────────────────────────────────────────┘
```

### 6.5 Dashboard mobile wireframe

```text
┌─────────────────────────────────┐
│ ☰ Tổng quan              Avatar │
│ [7 ngày ▼]                     │
├─────────────────────────────────┤
│ ┌────────────┐ ┌──────────────┐ │
│ │ Doanh thu  │ │ Lợi nhuận    │ │
│ │  ...       │ │  ...         │ │
│ └────────────┘ └──────────────┘ │
│ ┌────────────┐ ┌──────────────┐ │
│ │ Đơn thành  │ │ Hũ đã bán    │ │
│ │ công       │ │              │ │
│ └────────────┘ └──────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Doanh thu theo ngày         │ │
│ │ [chart responsive]          │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ Đơn cần xử lý [Xem thêm]    │ │
│ │ #CBST... · Chờ xác nhận     │ │
│ └─────────────────────────────┘ │
│ Kho, khách, thành viên...       │
└─────────────────────────────────┘
```

### 6.6 KPI cards chuẩn

**Dòng 1 (owner):** `Doanh thu thực hiện`, `Lợi nhuận ròng`, `Đơn giao thành công`, `Tổng hũ đã bán`. Nếu không có dữ liệu tính lợi nhuận ròng tin cậy, thay bằng `Lợi nhuận chia theo đơn` và đánh dấu rõ.

**Dòng 2:** `Đơn chờ xử lý`, `Tồn kho khả dụng`, `Khách quay lại`, `Hoa hồng chưa thanh toán` hoặc `Tiền đã thu` (tùy dữ liệu API).

Mỗi card:

- Label ngắn rõ, value to và số VND đúng locale.
- Thời gian áp dụng từ filter.
- Delta so với kỳ trước **chỉ khi tồn tại baseline hợp lệ**, không thêm “+12%” giả.
- Tooltip/help icon giải thích công thức tính.
- Chart sparkline chỉ nếu data đủ; không bắt buộc.
- Loading skeleton, error state và no-data state riêng.

### 6.7 Chart specifications

| Chart | Kiểu | Nguồn | Yêu cầu |
|---|---|---|---|
| Doanh thu theo ngày | Line/area nhẹ | API analytics theo kỳ | Không tính đơn hủy/pending; tooltip VND |
| Lợi nhuận theo ngày | Line | API profit breakdown | Chỉ hiển thị đúng loại profit |
| Hũ đã bán theo size | Bar | Delivered items by SKU | 300g/400g/600g + count, không parsing text summary nếu data chuẩn |
| Nguồn khách | Horizontal bar | Analytics order attribution | Không tạo nguồn chưa có |
| KPI thành viên | Horizontal bar/table | API phân quyền owner | Member xem chỉ mình |
| Đơn theo trạng thái | Donut hoặc segmented metric | Order statuses | Tránh chart quá nhiều phần nhỏ |
| Khách quay lại | Trend + KPI | Customer identity normalized | Repeat orders ≠ unique returning customers |

**Chart standards:** responsive container; không 3D; không cần quá 2 chart trên một hàng; axis gọn; tooltip rõ đơn vị; zero/empty cases; lazy load chart code nếu nặng; không dùng animation vô tận.

### 6.8 Bảng đơn hàng — quy định bắt buộc

- Columns desktop: Mã đơn, Thời gian, Khách, Số hũ, Tổng tiền, Trạng thái đơn, Thanh toán, Phụ trách, Actions.
- Toolbar: search mã/tên/SĐT theo quyền; status, date range, member filter (owner only); pagination server-side khi cần.
- Sort nhất quán, hiển thị timezone VN, đừng client-side sort dữ liệu mới tải một trang rồi gọi là toàn bộ.
- Row actions không vi phạm workflow: xem chi tiết, sửa khi hợp lệ, xác nhận, giao thành công, hủy khi đúng quyền.
- Mobile: compact order card (mã + trạng thái + người mua/truncated + tiền + hành động), không ép bảng rộng 1200px.
- PII: mask SĐT nếu role không được xem; không log hoặc hiển thị thông tin khách cho member khác.
- Mọi mutation hiển thị pending, xử lý 409 conflict/422 validation/403 forbidden, invalidate cache/refresh chính xác.

### 6.9 Inventory page

- Summary cards: tồn khả dụng, đang giữ, số lô, hàng cận hạn.
- Danh sách theo SKU và theo batch (lotCode, nhận, còn, reserve, hết hạn, trạng thái).
- Date warnings là dữ liệu theo lô; không tự suy luận hạn chung.
- Có filter hết hàng/gần hạn, disabled action nếu chưa đủ quyền.
- Không đổi quy tắc trừ kho/giữ kho; không cho phép sửa số tồn thủ công không có log.

### 6.10 Member KPI page

- KPI cá nhân: đơn giao thành công, tổng hũ, 300g/400g/600g, doanh thu hợp lệ, hoa hồng phát sinh, đã thanh toán, còn phải trả.
- Người quản trị xem toàn team có filter theo thời gian/member.
- Không dùng `ownerShare` như lợi nhuận ròng của shop.
- Tooltip tính toán: `Lợi nhuận chia = tiền thu hợp lệ – giá vốn thực tế – chi phí trực tiếp; hoa hồng 40% theo policy được chốt trên đơn`.
- Nếu giá trị khác nhau do lô/chi phí/discount, cho phép xem breakdown read-only đối với role được phép.

### 6.11 Finance page

- Chia KPI thành nhóm có tên chính xác: Bán hàng, Lãi theo đơn, Chi phí chung, Dòng tiền.
- Ví dụ các nhãn: `Doanh thu đã ghi nhận`, `Giá vốn`, `Chi phí trực tiếp`, `Hoa hồng phát sinh`, `Phần chủ shop trước chi phí chung`, `Chi phí vận hành`, `Lợi nhuận ròng`, `Tiền thực thu`, `Tiền thực chi`.
- Khi expense data chưa đầy đủ, **không khẳng định chính xác lợi nhuận ròng**; hiển thị cảnh báo “Chưa đủ dữ liệu chi phí để tính lợi nhuận ròng”.

### 6.12 Các màn hình còn lại

- `Customers`: người mua, mã/SĐT nếu quyền cho phép, số đơn, lần gần nhất, mua lại. Search, sort, empty.
- `Products`: 3 SKU, hình, giá đang áp dụng, trạng thái; admin sửa giá phải có xác nhận nếu SRS cho phép.
- `Promotions`: chỉ redesign nếu module đã có, không tự triển khai chính sách mới.
- `Settings`: cấu hình hotline/Zalo, thông tin shop, thành viên/quyền tùy RBAC; không để cấu hình quan trọng lộ cho guest.
- `Login`: form sạch, responsive, branded nhẹ, error không tiết lộ tài khoản có tồn tại hay không.

---

## 7. Nội dung tiếng Việt & microcopy ready-to-use

### Landing

| Khu vực | Text đề xuất |
|---|---|
| Eyebrow | `Hương vị Quảng Ngãi, gần hơn với bữa cơm nhà` |
| Hero H1 | `Cá bống Sông Trà — Đậm đà đưa cơm` |
| Hero desc | `Chọn hũ 300g, 400g hoặc 600g. Giá rõ ràng, dễ đặt, phù hợp những bữa cơm cần thêm món mặn đậm vị.` |
| Primary CTA | `Chọn hũ cá` |
| Secondary CTA | `Nhắn Zalo tư vấn` |
| Product section | `Chọn size phù hợp với bạn` |
| Product subtitle | `Ba quy cách khối lượng tịnh, dễ chọn theo nhu cầu.` |
| Order process | `Đặt nhanh trong vài bước` |
| FAQ title | `Bạn cần biết thêm điều gì?` |
| CTA footer | `Thêm một chút vị quê vào bữa cơm hôm nay` |
| Order success | `Shop đã nhận yêu cầu đặt hàng` (chỉ khi API xác nhận thành công) |
| Order pending ship | `Phí vận chuyển sẽ được xác nhận trước khi giao` |
| Out of stock | `Hũ này đang tạm hết hàng` |
| Error order | `Chưa gửi được đơn. Vui lòng thử lại hoặc liên hệ shop.` |

### Dashboard

| Context | Copy đề xuất |
|---|---|
| Heading | `Tổng quan kinh doanh` |
| Time range | `Khoảng thời gian` |
| Revenue | `Doanh thu đã ghi nhận` |
| Net profit | `Lợi nhuận ròng (sau chi phí)` |
| Delivered | `Đơn giao thành công` |
| Units sold | `Số hũ đã bán` |
| Needs action | `Đơn cần xử lý` |
| Pending payout | `Hoa hồng chưa thanh toán` |
| Low stock | `Sản phẩm sắp hết` |
| Returning unique | `Khách quay lại (duy nhất)` |
| Empty data | `Chưa có dữ liệu trong khoảng thời gian này` |
| Filter no match | `Không tìm thấy kết quả phù hợp` |
| Permission | `Bạn không có quyền xem nội dung này` |
| Save success | `Đã lưu thay đổi` (chỉ sau API success) |
| Conflict | `Dữ liệu đã thay đổi ở thiết bị khác. Tải lại trước khi tiếp tục.` |
| Loading | `Đang tải dữ liệu...` |

**Tone rules:** câu ngắn, xưng hô tự nhiên, tránh “siêu phẩm”, “duy nhất”, “cam kết tuyệt đối”, “đặt là giao ngay” nếu chưa có bằng chứng.

---

## 8. Design asset handling & image workflow

### 8.1 Asset inventory từ user

| File | Vai trò khuyến nghị | Ghi chú |
|---|---|---|
| `Bảng size.png` | Reference brand / section 3 sizes | Poster đã có chữ giá nên **không** dùng nguyên poster làm hero và overlay thêm text |
| `Bảng giá.png` | Reference CTA, bảng giá offline | Nhiều text; không dùng làm card responsive |
| `Giá size nhỏ.png` | Source ảnh 300g | Muốn crop hũ riêng nên xin ảnh hũ gốc hoặc crop cẩn thận |
| `Giá size vừa.png` | Source ảnh 400g | Tránh để chữ 400G/139k cũ lẫn nội dung API |
| `Giá size lớn.png` | Source ảnh 600g | Không dùng label in ảnh như price source of truth |

### 8.2 Cách dùng ảnh đúng

- **Ưu tiên 1:** ảnh sản phẩm gốc đã tách nền / đã crop từ bộ ảnh gốc (nếu đã tồn tại trong repo).
- **Ưu tiên 2:** dùng poster như hình tham chiếu trong trang/FAQ, nhưng tránh card có chữ trùng giá và không bóp méo/ghép thiếu chính xác.
- **Ưu tiên 3:** đề xuất tạo bộ ảnh sản phẩm **từ ảnh thật** sau khi chủ shop duyệt; không yêu cầu agent tự vẽ cá hoặc tự tái tạo hũ sai nhãn.
- Quy định rõ source asset path; không tạo ảnh từ remote CDN không rõ giấy phép.
- Dùng `next/image`, `sizes` phù hợp từng vùng, WebP/AVIF khi pipeline hiện có hỗ trợ; ảnh hero preload có cân nhắc, ảnh dưới fold lazy load.
- Nên có `public/images/products/300g.webp`, `400g.webp`, `600g.webp`, `group-3-sizes.webp` **nếu đã xuất ảnh tối ưu thực sự**; không tự dựng ảnh trống ở tên này.
- Alt text: `Hũ cá bống Sông Trà 300g, khối lượng tịnh cá và nước kho`.
- Không tự chỉnh nhãn, logo, thành phần trên hũ; không đổi màu sản phẩm làm sai thực tế.

### 8.3 Asset quality gates

- Ảnh đúng loại hũ/size/giá theo metadata.
- Không xóa phần sản phẩm quan trọng khi crop; không chèn giá trong hình do gây stale price.
- Ảnh sắc nét ở mobile và desktop, dung lượng tối ưu; kiểm tra bằng network tab.
- Hero LCP image có width/height hoặc aspect ratio đúng, tránh layout shift.
- Không sử dụng ảnh người mua hoặc feedback không được cho phép.

---

## 9. Accessibility & responsive requirements

### 9.1 Accessibility

- Mục tiêu WCAG 2.2 AA cho UX lõi; check tương phản text thường ≥4.5:1, text lớn ≥3:1; kiểm tra thực tế palette khi triển khai.
- H1/H2/H3 theo thứ bậc; không dùng heading chỉ vì cần font to.
- Keyboard tab qua nav, cards, buttons, form, modal, sidebar; `focus-visible` rõ ràng.
- Modal/dialog focus trap và focus return; drawer mobile đóng bằng Escape và nút Close.
- Link Zalo/gọi có tên screen reader rõ; icon không đơn độc truyền đạt chức năng.
- Form input với label, autocomplete (`name`, `tel`, `street-address` nếu phù hợp), hiển thị lỗi bằng text.
- Bảng có heading/caption phù hợp, chart có summary text hoặc table hỗ trợ; không chỉ biểu đồ màu.
- Zoom 200%/400% không cắt nội dung quan trọng; kiểm tra cả font lớn.
- Trạng thái loading/error/success được thông báo hỗ trợ assistive tech có chủ đích.

### 9.2 Screen matrix để QC

| Viewport | Landing | Admin | Kiểm thử |
|---|---|---|---|
| 360×800 | Hero 3-size không bị cắt, CTA bar | KPI 1–2 cột, drawer | Không tràn ngang |
| 390×844 | Card 1 cột | Chart responsive | Tap targets ≥44 |
| 430×932 | Layout thoáng | Order cards | Sticky footer không đè input |
| 768×1024 | 2 cột khi hợp lý | Sidebar drawer/compact | Tables/filter |
| 1024×768 | Hero split | Sidebar collapse | Chart legibility |
| 1280×800 | 3 card | KPI 4-up nếu vừa | Above-fold density |
| 1440×900 | Max width 1200 | Charts side-by-side | White space hợp lý |
| 1920×1080 | Content không kéo quá rộng | Dashboard tối ưu | Ultrawide readability |

### 9.3 Empty/loading/error states bắt buộc

- Trang chủ khi catalog API lỗi: không hiển thị giá cũ từ hardcode không kiểm soát; show fallback hợp lệ và contact.
- Card hết hàng: disable chọn mua phù hợp thực tế stock.
- Order submit lỗi: giữ giá trị đã nhập, không mất form.
- Admin dashboard chưa có dữ liệu: no-data, không default số tổng thành “0 đ” khi API failed.
- Chart nhận data rỗng: empty state trong card với chiều cao ổn định.
- Khi expired session: login redirect an toàn, không lộ data nhạy cảm cũ từ cache.

---

## 10. Performance, SEO, engineering guardrails

### 10.1 Performance targets — *mục tiêu kiểm thử*, không phải kết quả cam kết

- Landing trên mobile: LCP p75 ≤2.5s, INP p75 ≤200ms, CLS p75 ≤0.1 **trong điều kiện đo phù hợp**.
- Lighthouse mobile đề xuất target: Performance ≥85 sau tối ưu, Accessibility ≥90; không ép agent báo đạt khi chưa chạy thật.
- Hero image ưu tiên tải hợp lý, font self-host qua Next nếu phù hợp, không block render bằng animation/chart.
- Admin charts tải ở route admin, tránh package chart nằm trong bundle landing.
- Data fetching: fetch song song nơi độc lập, request cancellation khi đổi filter, debounce 250–400ms cho search.
- SSR/ISR/cache chỉ dùng với dữ liệu phù hợp; financial/customer data luôn tuân quyền và tính tươi dữ liệu theo SRS.
- Không dùng preload tất cả ảnh; không dùng `priority` cho 3–5 ảnh cùng lúc.

### 10.2 Tối ưu UI/UX khi làm việc với NestJS

- FE dùng API clients hiện tại (type safe nếu đã có). Không gọi DB trực tiếp từ FE.
- `SWR` hoặc TanStack Query nếu project đã có; không thêm mới vô cớ; cache keys gắn date range/filter/role.
- Trạng thái loading/optimistic update chỉ áp dụng nơi an toàn; **không optimistic xác nhận đã thu tiền, giao hàng hoặc trừ kho**.
- Auth: không expose access token trong localStorage nếu hệ thống dùng cookie phiên; giữ nguyên chiến lược bảo mật hiện có.
- API errors được map thống nhất và không làm mất form.
- CORS, rate limit, idempotency xử lý ở backend hiện tại; redesign không được bypass.

### 10.3 Phụ thuộc thư viện

- **Bắt buộc:** đánh giá thư viện project đang có trước khi add.
- Nếu chưa có icon library, có thể chọn `lucide-react`.
- Nếu chưa có chart library, cân nhắc `recharts` cho mức phức tạp hiện tại; lazy load trong admin.
- Nếu chưa có headless primitive, cân nhắc Radix cho dialog/dropdown/menu; không cài nhiều bộ tương đương.
- Không thêm Framer Motion/Motion chỉ cho vài hover cơ bản nếu CSS xử lý được.
- Không thêm theme switcher/dark mode giai đoạn đầu, trừ khi user yêu cầu.

### 10.4 Bảo mật ảnh và dữ liệu

- Không render HTML từ database không sanitize.
- Không nhúng secrets vào client/metadata/console.
- Không để public page fetch `/admin` data hay bundle chứa keys.
- Không để số điện thoại đầy đủ trong analytics events/logs.
- Cấu hình external Zalo/phone qua trusted config; không nối URL từ input người dùng.
- Không dùng third-party trackers mới nếu chưa phê duyệt chính sách dữ liệu.

---

## 11. Suggested FE component / folder architecture

> Đây là cấu trúc **đề xuất**, agent phải map theo code hiện có. Không chuyển toàn repo chỉ để đẹp folder.

```text
apps/web/
├── app/
│   ├── (storefront)/
│   │   ├── page.tsx
│   │   └── [nếu có routes hiện hành]
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── orders/
│   │   ├── inventory/
│   │   ├── customers/
│   │   ├── members/
│   │   └── finance/
│   └── globals.css
├── components/
│   ├── ui/                # button, badge, dialog, select, skeleton...
│   ├── storefront/        # Hero, ProductGrid, ProductCard, OrderDrawer, FAQ
│   ├── admin/             # AdminShell, Sidebar, Topbar, KpiCard, ChartCard
│   ├── orders/            # OrderList, OrderStatusBadge, OrderActions
│   ├── inventory/         # StockWarning, BatchTable
│   └── shared/            # Money, EmptyState, LoadingState, ErrorState
├── hooks/                 # useFilteredOrders, useDashboard (nếu cần)
├── lib/
│   ├── api/               # reuse existing backend contract
│   ├── format/            # date/money/qty
│   ├── permissions/       # FE convenience only; server is authority
│   └── design/            # semantic tokens / mappings
├── public/images/products/
└── tests/
    ├── storefront/
    ├── admin/
    └── visual/
```

**Component API gợi ý:**

```ts
export type ProductCardProps = {
  sku: 'CBST-300' | 'CBST-400' | 'CBST-600';
  name: string;
  netWeightG: 300 | 400 | 600;
  priceVnd: number;       // từ API
  imageSrc: string;       // asset thực được duyệt
  available?: boolean;   // chỉ set khi có dữ liệu tin cậy
  onSelect: (sku: ProductCardProps['sku']) => void;
};

export type KpiCardProps = {
  label: string;
  value: string;
  periodLabel?: string;
  helpText?: string;
  delta?: { value: number; comparisonLabel: string; trendIsGood?: boolean };
  state?: 'ready' | 'loading' | 'empty' | 'error' | 'incomplete';
};
```

**Đề xuất sơ bộ, không ép API:** tách `data layer` (query/fetch/transform) khỏi `presentation layer` (Card/Table/Chart); chart không tự tính doanh thu từ danh sách đơn nếu backend đã có analytics endpoint chính thức.

---

## 12. Acceptance criteria & QA checklists

### 12.1 Landing page (P0)

- [ ] Có H1 rõ ràng + hình 3 size thật, dễ nhìn trên 360px.
- [ ] 300g/400g/600g đi kèm **khối lượng tịnh** đúng và giá đúng API.
- [ ] Có 3 card sản phẩm, mỗi CTA preselect đúng SKU.
- [ ] Form quick order hoạt động end-to-end và không gửi trùng khi double-click.
- [ ] Zalo và `tel:` chỉ link tới thông tin đã xác nhận; không broken link.
- [ ] Không có feedback/rating giả, không claim hạn sử dụng hoặc chứng nhận chưa xác minh.
- [ ] Mobile sticky CTA không che input, safe area, bottom navigation hoặc keyboard.
- [ ] Console không lỗi/hydration warnings, không horizontal overflow.
- [ ] Không ảnh vỡ, không font lỗi dấu tiếng Việt.

### 12.2 Admin (P0)

- [ ] Sidebar desktop fixed/collapsible, mobile drawer, không che chart.
- [ ] Owner thấy đúng module; member chỉ thấy module được phép.
- [ ] KPI filter theo kỳ thực, labels đúng nghiệp vụ, không nhầm lãi chia với lãi ròng.
- [ ] Chart có loading/empty/error, tooltip chuẩn VND; không giả số liệu.
- [ ] Danh sách đơn status/action đúng role và backend workflow.
- [ ] Table dễ đọc desktop, order cards mobile; filter/search vẫn dùng được.
- [ ] Các mutation đúng như trước redesign, bao gồm trạng thái, permission, payout, inventory.
- [ ] Failed API hiển thị error state thay vì số 0 sai.

### 12.3 Tech/regression (P0)

- [ ] `lint`, `typecheck`, `build` chạy và **ghi rõ kết quả thực**.
- [ ] Các test đang có pass hoặc ghi chính xác test thất bại do đâu.
- [ ] Không thay đổi schema/API/auth/commission/inventory nếu không được duyệt.
- [ ] Test FE order placement → BE persisted → Admin thấy đúng → trạng thái đúng.
- [ ] 401/403/409/422/429/500 hiển thị UI phù hợp.
- [ ] Không xuất hiện secrets/PII trong client console và snapshots.
- [ ] Desktop/mobile screenshots review trước khi merge.
- [ ] Không tăng bundle landing vô lý do thư viện chart/admin.

### 12.4 Visual QA (P1)

- [ ] 5 kích thước tiêu biểu: 360, 390, 768, 1280, 1440.
- [ ] Buttons consistent; 3 card có cùng style, spacing, radius.
- [ ] Text contrast đã chạy check, focus states nhìn rõ.
- [ ] Hero ảnh sản phẩm không bị cắt/méo và không bị icon/trang trí che.
- [ ] Body dài không chồng chéo với sticky header/footer.
- [ ] Login/empty/loading/error thống nhất design system.

### 12.5 Usability tasks

- Task khách 1: từ landing chọn hũ 400g và thấy form đã chọn đúng trong ≤3 thao tác.
- Task khách 2: tìm hotline/Zalo trên mobile trong vài giây.
- Task admin 1: xem doanh thu theo 7 ngày, tìm đơn pending và mở chi tiết.
- Task admin 2: lọc KPI một thành viên theo tháng và phân biệt hoa hồng đã trả/chưa trả.
- Task member 1: xem đơn của chính mình; xác nhận không xem được đơn người khác bằng API.
- Task vận hành: xem cảnh báo tồn và lô gần hạn; hiểu rõ không có thông tin thì UI báo chưa có dữ liệu.

---

## 13. Roadmap triển khai theo pha / ưu tiên

### P0 — Audit & baseline (không sửa trước khi hoàn tất)

**Agent output bắt buộc:** file map, actual routes, UI inventory, component inventory, CSS/typography hiện có, API contracts, auth roles, screenshots baseline, dependency map, các lỗ hổng UX nổi bật, rủi ro regression.

**Done:** có kế hoạch patch nhỏ; xác định ảnh gốc dùng được ở đâu; không đụng backend nếu không bắt buộc.

### P1 — Design tokens & shared primitives

Thống nhất CSS variables, font, buttons, inputs, badge, empty/loading, card, focus ring, typography; audit các component cũ trước khi thay. **Done:** UI consistency, build pass, screenshot preview.

### P2 — Landing conversion redesign

Header, hero 3-size, 3 product cards, FAQ, process, footer, mobile sticky CTA; kết nối API/catalog/checkout thật. **Done:** test chọn mỗi SKU và submit, performance, accessibility, mobile QA.

### P3 — Admin shell

Sidebar fixed/collapsible/drawer, topbar, role-based nav, filter style, table/card layout, responsive; **không đổi permission logic**. **Done:** navigation consistency desktop/mobile.

### P4 — Dashboard overview

KPI cards, 2–3 charts chính, order action widget, stock warning widget; nối dữ liệu thật, có empty/error/loading. **Done:** finance labels chính xác, filter đồng bộ, member view không lộ data.

### P5 — Module polish

Orders, inventory, member KPI, customers, finance, settings (module có sẵn). **Done:** common design components, responsive, role tests.

### P6 — Performance + accessibility + regression + release

Lighthouse/LCP/CLS/INP tại môi trường test, optimize image/bundle, keyboard QA, cross-device screenshots, review diff, staging smoke test, phased production rollout/rollback. **Done:** report có bằng chứng, chưa có bằng chứng thì status `NOT VERIFIED`.

### Gate để tránh agent sửa quá rộng

- **Gate A:** trước coding: audit + plan, owner duyệt phạm vi.
- **Gate B:** sau design tokens: screenshot các primitives.
- **Gate C:** sau landing: screenshots mobile/desktop, test đặt hàng.
- **Gate D:** sau admin shell: role navigation + responsiveness.
- **Gate E:** sau dashboard: đối chiếu KPI với API, không bịa số.
- **Gate F:** trước merge: build/tests/accessibility/perf/rollback plan.

---

## 14. Hướng dẫn Google Antigravity / agent protocol

### 14.1 Thực hành phù hợp cho Antigravity

Antigravity hỗ trợ agent làm việc trên editor, terminal, browser và xuất artifacts để review. Có cơ chế **Rules** theo workspace/ thư mục, nên có thể dùng `AGENTS.md` / `.agents/rules/*.md` để giữ guardrails. **Không cần tạo Workflow cũ chỉ để chứa tài liệu này**: tài liệu chính thức đang thông báo thay đổi/migration Workflows sang Agent Skills; tránh phụ thuộc đường dẫn workflow có thể đổi.

**Nguồn chính thức để kiểm tra phiên bản đang dùng:**

- Rules: https://antigravity.google/docs/rules/
- IDE overview: https://www.antigravity.google/docs/ide/overview/
- Workflows/migration: https://www.antigravity.google/docs/ide/workflows/

### 14.2 Quy tắc nên đưa vào `AGENTS.md` (agent tạo sau khi audit, owner review)

```md
# Workspace rules — Cá Bống Sông Trà
- Project is LIVE. Preserve existing Next.js + NestJS + MongoDB contracts and domain behavior.
- Read docs/CA_BONG_SONG_TRA_UI_UX_DESIGN_SYSTEM_ANTIGRAVITY_V1_1_LAYOUT_PRESERVED.md and SRS v2.0 before UI changes.
- First inspect code; show concise plan, file map, and risks; do not rewrite app wholesale.
- UI changes must not alter order states, inventory reservation/deduction, payouts, profit formula, RBAC or payment handling.
- Product SKUs are CBST-300/400/600; weights are net weights of fish + braising liquid, excluding packaging.
- Prices display from canonical API. Never fabricate reviews, orders, badges, delivery promises or stock status.
- Use real approved product images; do not generate/reconstruct product jars or labels.
- Keep storefront mobile-first and admin information-first. Use tokens and accessible controls.
- Use existing libraries when sensible. Ask approval before new heavy dependencies or API changes.
- After each UI phase: run checks, show screenshots at mobile and desktop, report actual evidence and unresolved issues.
```

> Đây là **đề xuất nội dung rules**, không khẳng định agent đã tạo file này.

---

## 15. MASTER PROMPT — DÁN VÀO GOOGLE ANTIGRAVITY

> Prompt này thiết kế cho repo **đã chạy**. Sau khi dán, attach/đặt tài liệu này và SRS v2.0 vào workspace. **Yêu cầu agent thực hiện 2 lượt:** lượt 1 audit/plan, chờ duyệt; lượt 2 thực thi theo pha.

```text
You are the lead Product Designer, Design Systems Engineer, Senior Next.js Frontend Engineer,
Accessibility Reviewer and Performance Engineer for an existing production-minded Vietnamese
specialty-food commerce project called “Cá Bống Sông Trà”.

IMPORTANT CONTEXT
- The project already runs. You are REDESIGNING UI/UX in place, not building a greenfield app.
- Frontend: Next.js + TypeScript. Backend: NestJS REST API. Database: MongoDB Atlas.
- Hosting/CI: Vercel + GitHub Actions as configured in the current repository.
- Preserve all business logic, REST contracts, authentication/authorization, stock reservations,
  FIFO/expiry handling, commission split, finance calculations, state machine and checkout.
- Read these documents completely BEFORE coding:
  1) docs/CA_BONG_SONG_TRA_UI_UX_DESIGN_SYSTEM_ANTIGRAVITY_V1_1_LAYOUT_PRESERVED.md
  2) SRS_CA_BONG_SONG_TRA_V2_0.md (locate actual repository path)
- Audit the actual file tree, Next.js version, styling stack, dependencies, routes and API calls.
  Do NOT assume the repository exactly matches any sample path in the documents.

PRODUCT / BRAND TRUTH
- Real Vietnamese product: Cá bống Sông Trà, Quảng Ngãi.
- SKU CBST-300: jar of 300g net weight, nominal retail price 109,000 VND.
- SKU CBST-400: jar of 400g net weight, nominal retail price 139,000 VND.
- SKU CBST-600: jar of 600g net weight, nominal retail price 199,000 VND.
- Net weight includes fish and braising liquid, excluding jar/packaging.
- All live prices, stock, product status and order amounts must come from trusted APIs.
- User supplied 5 genuine marketing images. Locate approved assets in repository and
  reuse the real images. Never hallucinate packaging, label, product photos or reviews.
- Do not invent food-safety certification, expiry period, shipping duration, discounts,
  testimonials, ratings, fake sales data or 'best seller' labels.

USER-APPROVED DESIGN DIRECTION
- Combine rustic/quaint Quảng Ngãi specialty personality with modern clean UI.
- Warm minimal food-commerce style, warm ivory background, restrained orange-red accents,
  earthy brown typography, white cards, outline Lucide icons.
- Font: Be Vietnam Pro, friendly/modern; readable Vietnamese diacritics.
- LANDING should communicate appetizing product, trust, hometown warmth and easy purchase.
- LANDING hero MUST showcase genuine images of all 3 product sizes; product grid MUST have
  3 separate cards. Use form checkout as primary action; verified Zalo and telephone as secondary.
- Do not add customer feedback/testimonials until actual approved feedback exists.
- Light texture only in isolated landing sections; NEVER on admin dashboard.
- ADMIN should be neutral, information-dense but scannable, sidebar fixed left on desktop,
  collapsible on desktop, drawer on mobile; KPI cards, charts, and useful tables.
- Owner dashboard highlights revenue/profit first, then orders, sold jars, inventory,
  returning customers, team commissions. Respect RBAC on both frontend/backend.

DESIGN SYSTEM
- Follow the exact semantic tokens, typography, spacing, radius, shadows, responsive rules,
  component variants, status mappings, UX flows and accessibility specifications from the
  attached UI/UX Markdown document. Prefer existing component library; avoid needless packages.
- Buttons, inputs, dialogs, tables, badges, cards and feedback states must be consistent.
- KPI/finance labels must preserve definitions: revenue != gross profit != distributable profit
  != owner share != net profit != cash flow.
- Don't show fabricated KPI numbers. Loading, empty, error, forbidden and incomplete-data
  states must be intentional and accessible.

YOUR REQUIRED EXECUTION PROCESS
PHASE 0 — DISCOVER & PLAN, DO NOT EDIT CODE YET:
1. Inspect routes, layouts, key components, styling, dependencies and deployed architecture.
2. Map storefront checkout, API contracts, roles, dashboard finance metrics and existing assets.
3. Identify reusability opportunities and existing UX regressions.
4. Write a detailed incremental plan listing exact files/components to change, scope,
   performance/accessibility risks and testing checkpoints.
5. Propose visual wireframes for mobile landing and desktop admin; identify unclear assets.
6. Ask for owner approval before changing code.

PHASE 1 — DESIGN SYSTEM:
- Add semantic CSS variables/Tailwind mapping compatible with actual Tailwind version.
- Standardize Button, Input, Card, Badge, Modal, EmptyState, Skeleton, KPI styles.
- Preserve existing APIs, build, routes and behavior. Commit logically.

PHASE 2 — STOREFRONT:
- Redesign navbar, hero featuring all 3 real jars, 3 product cards, value propositions,
  ordering steps, FAQ, footer, and sticky mobile CTA.
- Connect product cards to existing data and checkout; selecting a card preselects its SKU.
- Keep Zalo/telephone destinations configurable and only use confirmed links.
- Optimize imagery/next/image, mobile 360px+, page semantics and interaction.

PHASE 3 — ADMIN SHELL:
- Clean collapsible desktop sidebar, mobile drawer, topbar, breadcrumbs, navigation by role.
- Maintain no unauthorized data access even when URL is manually entered.

PHASE 4 — DASHBOARD:
- True KPI cards, time filters, revenue chart, products-by-size chart, order queue,
  stock alerts, member performance where allowed, recent orders and proper empty/error states.
- Use actual analytics APIs; NEVER reconstruct sensitive finance data using guessed formulas.
- If fields/endpoints are missing, surface an API gap for approval. Do not fake data.

PHASE 5 — MODULE POLISH & QA:
- Harmonize orders, inventory, customers, members/KPI, finance, login and settings.
- Responsive desktop/tablet/mobile; keyboard/a11y; mobile table alternative.
- Run lint/typecheck/tests/build, visual comparisons and actual flow tests.
- Report measured performance (only if run), bundle impact, unresolved issues and rollback.

ENGINEERING GUARDRAILS
- Do not rewrite the project or redesign NestJS database/business logic as part of this task.
- Do not install a heavy UI suite without first checking existing dependencies.
- No stale hardcoded price, no fake review, no invented statuses, no giant hero poster with
  duplicated text/prices. Prefer cropped original product source images where available.
- No extra chart library in the customer storefront bundle.
- Do not optimistically mark an order paid/delivered; actual API response governs outcome.
- Don't log customer personal data. Don't expose secrets/client admin data.
- When ambiguous, list assumption and ask before implementing sensitive changes.

DELIVERABLES AFTER EACH PHASE
1. Changes summary, exact files edited and reasoning.
2. Before/after screenshots: mobile storefront (360/390px) and desktop (1280/1440px),
   mobile admin and desktop admin when applicable.
3. Link/reference to code diffs.
4. Actual test commands and pass/fail result; do not claim tests passed if not run.
5. Known limitations and next-step list.

START WITH PHASE 0 AUDIT/PLAN ONLY. STOP AND WAIT FOR APPROVAL.
```

---

## 16. PROMPT PACK — CHẠY THEO TỪNG PHA TRONG ANTIGRAVITY

### Prompt A — Audit repo + UX diagnosis

```text
Read UI/UX master specification and SRS v2.0. Inspect the current repository only.
Do not edit any files. Produce:
(1) Frontend routes and UI component map,
(2) existing styling, fonts, icon/chart/form libraries,
(3) storefront product/checkout API and image asset map,
(4) admin role/permissions/navigation/dashboard sources,
(5) top 15 specific UI/UX issues with severity,
(6) visual improvement proposal aligned with the approved design tokens,
(7) phase-by-phase file list, dependencies, rollback and regression risks,
(8) uncertainties that require owner confirmation.
Include screenshots of current desktop/mobile UI if browser tools are available.
Never invent findings when files or browser pages cannot be accessed.
STOP after the audit and wait for approval.
```

### Prompt B — Design tokens & components

```text
Implement ONLY design system foundations according to master specification section 3 and 4.
Audit existing components first. Add semantic tokens, Be Vietnam Pro, button/input/card/badge/
modal/skeleton/empty/error states, accessible focus and status colors, compatible with existing
Tailwind/CSS architecture. Avoid wholesale rewrites. Preserve public component APIs when
possible. Show component gallery or representative examples and screenshot mobile/desktop.
Run lint/typecheck/build and report actual results. STOP.
```

### Prompt C — Landing page / conversion UX

```text
Implement ONLY customer-facing landing page redesign using 3 genuine product photos,
3 separate SKU cards, verified API prices, hero with all 3 sizes, one primary CTA,
Zalo/phone secondary CTA, ordering steps, FAQ, footer and mobile sticky CTA.
Do not add feedback section, fake ratings, fake trust claims or shipping promises.
Preserve checkout flow and backend requests. Test 300g/400g/600g selection and form submission;
check mobile 360/390/430 and desktop 1280/1440 screenshots, image loading, CLS and keyboard.
Provide diff and test report. STOP.
```

### Prompt D — Admin shell

```text
Implement ONLY admin layout/nav redesign: fixed collapsible desktop sidebar, mobile drawer,
role-aware navigation, topbar, breadcrumbs, responsive content frame. Match token system.
Preserve current route/auth logic, member visibility, login/logout, role guards and API access.
Test owner vs member, keyboard navigation and tablet/mobile layout. Show screenshots. STOP.
```

### Prompt E — Owner/member dashboard

```text
Redesign dashboard with clear KPIs, data range filter, chart cards, recent orders,
stock warnings and member KPI where authorized. Source all metrics from actual API.
Keep financial definitions exact; clearly distinguish gross/net/profit share/cash flow.
Use proper loading/empty/error/permission states. No invented deltas or static mock KPI in
production UI. Lazy-load charts and keep dashboard code out of public landing bundle.
Review all dashboard calculations and test time filters, role isolation and mobile.
Show screenshots and tests. STOP.
```

### Prompt F — Final regression/a11y/performance/release

```text
Perform comprehensive UX and regression review per master spec section 12.
Run actual lint, TypeScript checks, build, relevant automated tests, checkout smoke tests,
role restrictions, mobile widths 360/390/430/768, desktop 1280/1440, keyboard navigation,
color contrast, image/SEO and bundle audit. Capture before/after screenshots and
performance numbers only when measured. Report failing tests, remaining risk, exact files,
recommended fixes and rollback notes. Do not claim production-ready without evidence.
STOP and request go-live approval.
```

---

## 17. Visual direction samples / mini style tiles

### Tile 1 — Landing hero

- Canvas: `#FFFCF8`.
- Eyebrow: text earth-700, small brand accent line.
- H1: text `#35241D`, 800 weight, dramatic but legible.
- Product 3-jar image: **largest focal element**, supported by minimal brand tint circle and no flashy sticker.
- Primary CTA: solid `#D84012` white text; secondary CTA white with brown border.
- Background decoration: at most 1 subtle abstract wave/texture with low contrast.

### Tile 2 — Product cards

- White card + border #E8E3DE, radius 24px.
- Background image panel ivory very light; consistent product crop across sizes.
- Weight/name at top or below photo; price dark brown or brand dark; button orange solid.
- Highlight one card only if justified by actual product goals/data; **không bịa “bán chạy”**.

### Tile 3 — Admin

- Canvas #F7F8FA, sidebar white, 1px border.
- Navigation text #675E57; selected row `brand-50` + left border `brand-600`.
- KPI white cards border, metric ink #27201C, label subdued.
- Orange reserved primarily for revenue series, action and active nav; green for truly positive finance status, blue for order-related series.
- Neutral chart grids minimal, no intense backgrounds.

---

## 18. Quyết định còn cần xác thực khi triển khai

Đây là **checklist unblock**, không phải lý do để dừng thiết kế:

- [ ] Hotline `070 2478 561` hiện trên poster có phải hotline chính thức?
- [ ] Zalo official URL là gì, và có được phép công khai trên website không?
- [ ] Repo hiện có các ảnh sản phẩm đã tách nền/chụp gốc hay mới có poster?
- [ ] Trang checkout thật đang là drawer/modal/page? API field/validation thế nào?
- [ ] Analytics backend có sẵn những metrics nào; có đủ tính lợi nhuận ròng chưa?
- [ ] Repo dùng Tailwind v3/v4, component lib gì, chart lib gì?
- [ ] Owner/member roles hiện có module/permissions cụ thể nào?
- [ ] Product availability hiển thị có lấy được stock real-time an toàn không?
- [ ] Có thống kê thời gian trước để tính kỳ so sánh chưa?
- [ ] Đơn chưa thanh toán/COD đang xử lý như thế nào trong dashboard hiện tại?

**Nếu chưa xác thực:** không hardcode hoặc bịa. Dùng cơ chế cấu hình/ẩn tính năng phụ cho đến khi được xác minh; vẫn tiến hành các phần UI không phụ thuộc.

---

## 19. Definition of Done (DoD) cuối dự án UI redesign

Một bản nâng cấp chỉ được xem là hoàn tất khi:

1. Landing đơn giản và cảm xúc: hero 3-size đúng, 3 card sản phẩm chính xác, CTA hoạt động, layout sạch.
2. Dashboard phân cấp thông tin rõ, owner/member dùng được và không thấy dữ liệu ngoài quyền.
3. Design tokens thống nhất mọi màn hình, typography tiếng Việt đẹp, trạng thái và control nhất quán.
4. Nghiệp vụ cũ **không thay đổi sai**: đơn/giá vốn/kho/hoa hồng/thanh toán/thu chi/khách quay lại.
5. Không review giả, giá giả, chứng nhận giả, ship cam kết sai, hạn sử dụng sai.
6. QA mobile/tablet/desktop, keyboard, role, checkout, error/loading/empty hoàn thành có bằng chứng.
7. Lint/typecheck/build và relevant tests được chạy, có báo cáo thực tế.
8. Đo performance trước/sau nếu có công cụ; không tuyên bố đạt ngưỡng khi chưa đo.
9. Changes reviewable, small PRs, rollback được nếu có lỗi, secrets và PII an toàn.
10. Chủ dự án đã review ảnh/screenshots và phê duyệt UI trước go-live.

---

## 20. Tài liệu và nguồn

### Nguồn của người dùng

- `SRS_CA_BONG_SONG_TRA_V2_0.md`: nguồn chính cho nghiệp vụ, module, stack, API conventions và safety constraints.
- Các ảnh do người dùng đính kèm trong hội thoại: `Bảng giá.png`, `Bảng size.png`, `Giá size lớn.png`, `Giá size nhỏ.png`, `Giá size vừa.png`.
- Các quyết định trong câu trả lời trắc nghiệm của người dùng: phong cách, màu sắc, hero, product cards, CTA, feedback, dashboard, sidebar, typography, texture, icon và công cụ Antigravity.

### Tham khảo bổ sung cho Antigravity

- Google Antigravity Rules: https://antigravity.google/docs/rules/
- Google Antigravity IDE overview: https://www.antigravity.google/docs/ide/overview/
- Google Antigravity Workflows / migration notice: https://www.antigravity.google/docs/ide/workflows/

### Giới hạn tài liệu

- Chưa audit repository thực tế trong lượt tạo tài liệu này; cấu trúc folder, phiên bản Tailwind, chart library và API UI phải xác nhận bằng mã nguồn.
- Token màu và wireframe là **đề xuất thiết kế**, không phải ảnh mockup đã dựng hoặc màu được đo bằng phần mềm từ ảnh.
- KPI/performance targets là điều kiện kiểm thử, không phải kết quả đo hay cam kết triển khai.
- Không được dùng file này như giấy chứng nhận sản phẩm hoặc chỉ dẫn pháp lý/bảo quản thực phẩm.

---

## 21. Summary quyết định cuối cùng

**Landing:** 3 size thật là hero, nền kem sạch, cam đỏ tiết chế, H1 đậm vị quê, 3 card giá rõ, CTA chọn hũ/đặt nhanh, Zalo/gọi hỗ trợ, chưa có feedback.

**Dashboard:** sidebar trái thu gọn, mobile drawer, typography nghiêm túc, nền xám/trắng sạch, KPI cards + charts + tables, ưu tiên doanh thu/lợi nhuận và các đơn cần xử lý, role-aware, không dữ liệu giả.

**Triển khai:** Antigravity **audit trước — plan — duyệt — nâng cấp từng pha — test — screenshot — merge**. Chỉ redesign UI, giữ nguyên nghiệp vụ của hệ thống đang chạy.

**Kết thúc tài liệu.**
