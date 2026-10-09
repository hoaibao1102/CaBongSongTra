# Cá Bống Sông Trà — Landing Page V1

Website giới thiệu sản phẩm một trang, Next.js App Router + TypeScript + Tailwind CSS v4. Không database, không giỏ hàng.

## 1. Chạy tại máy

Cài Node.js **>=20.9**, sau đó mở terminal tại thư mục này:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Windows PowerShell: `Copy-Item .env.example .env.local` thay cho lệnh `cp`.
Mở http://localhost:3000.

## 2. Cấu hình trước khi công bố

Mở `.env.local` và thay:

```env
NEXT_PUBLIC_ZALO_PHONE=84901234567
NEXT_PUBLIC_SITE_URL=https://ten-mien-cua-ban.vercel.app
# NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

**Quan trọng:** 84901234567 chỉ là số ví dụ, không phải Zalo bán hàng thật. Để trống thì các nút Zalo hiển thị trạng thái chưa cấu hình, tránh chuyển khách sang người lạ. Mở lại dev server sau khi sửa env.

- `data/site.ts`: đổi lời giới thiệu, khu vực phục vụ, giá và trọng lượng **tịnh theo nhãn**.
- `public/images/`: thay **ảnh minh họa SVG** bằng ảnh thật bạn đã chốt. Đặt file `hu-nho.webp`, `hu-vua.webp`, `hu-lon.webp`, `hero.webp`; sau đó sửa đường dẫn tương ứng tại `data/site.ts` và `app/page.tsx`. Đừng công bố các SVG minh họa như ảnh sản phẩm thật.
- `app/page.tsx`: sửa lời giới thiệu, bảo quản, nguồn gốc theo thông tin được nhà sản xuất xác nhận.
- `NEXT_PUBLIC_SITE_URL`: đổi sang domain thật để sitemap và Open Graph đúng.
- Nút Zalo dùng `https://zalo.me/<số điện thoại>` để mở hồ sơ, **không hứa tự điền tin nhắn**; hãy thử trên iOS, Android và desktop.

## 3. Kiểm tra

```bash
npm run typecheck
npm run lint
npm run build
npm run start
```

## 4. Deploy lên Vercel

1. Đẩy thư mục lên GitHub repository (không commit `.env.local`).
2. Vào https://vercel.com/new → Import repository → Framework: Next.js.
3. Trong Project Settings → Environment Variables thêm `NEXT_PUBLIC_ZALO_PHONE` và `NEXT_PUBLIC_SITE_URL` (sau lần deploy đầu, sửa URL thành domain chính xác và redeploy). Có thể thêm `NEXT_PUBLIC_GA_ID` nếu cần.
4. Bấm Deploy; thử các nút Zalo và giao diện mobile.
5. Nếu có domain riêng: Project → Settings → Domains → Add Domain, rồi cập nhật `NEXT_PUBLIC_SITE_URL` và deploy lại.

## 5. Theo dõi hiệu quả

Khi cấu hình `NEXT_PUBLIC_GA_ID`, site gửi event `contact_zalo_click` kèm thuộc tính `product` và `channel`. Chỉ ghi nhận **lượt nhấn**, không phải số inbox, đơn hoặc doanh thu. Nếu cần UTM, đăng link dạng `https://domain/?utm_source=facebook&utm_medium=group&utm_campaign=launch_v1`.

## 6. Kiểm tra trước launch

- [ ] Thay 4 ảnh SVG minh họa bằng ảnh sản phẩm thật.
- [ ] Kiểm tra khối lượng tịnh 250g/300g/500g theo nhãn thực tế; không gộp nước/hũ vào quy cách tịnh.
- [ ] Xác minh giá 109k/139k/199k, tồn kho và khu vực giao.
- [ ] Kiểm tra hạn dùng, cách bảo quản và thông tin pháp lý/nhãn hàng với nhà cung cấp.
- [ ] Nhập số Zalo thật và thử mọi CTA.
- [ ] Xem responsive mobile, SEO thumbnail, link chia sẻ.

## Ghi chú

Website không có chức năng nhận đơn tự động; khách chốt trực tiếp qua Zalo. Không thêm dữ liệu khách hàng cá nhân trên website.
