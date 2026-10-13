# 🚀 HƯỚNG DẪN TRIỂN KHAI TOÀN BỘ TRÊN VERCEL (100% VERCEL DEPLOYMENT)
## Dự án: Cá Bống Sông Trà (CBST v2 - Monorepo)

Tài liệu này hướng dẫn chi tiết cách triển khai **toàn bộ hệ thống (cả Backend NestJS và Frontend Next.js)** trên **cùng một nền tảng Vercel duy nhất**.

---

## 📌 KIẾN TRÚC 100% VERCEL (ARCHITECTURE)

Trong cùng 1 tài khoản Vercel và 1 GitHub repository, bạn sẽ tạo **2 Projects Vercel độc lập**:

```mermaid
graph TD
    User[Khách hàng / Quản trị viên] -->|HTTPS: cbst-shop.vercel.app| VercelWeb["Vercel Project 1: cbst-web (Next.js 15)"]
    VercelWeb -->|HTTPS Server-to-Server: cbst-api.vercel.app| VercelAPI["Vercel Project 2: cbst-api (NestJS Serverless)"]
    VercelAPI -->|TLS Mongoose| MongoDBAtlas[(MongoDB Atlas Cloud)]
    VercelWeb -->|REST API| Cloudinary[(Cloudinary Media CDN)]
```

- **Vercel Project 1 (`cbst-api`)**: Chạy Backend NestJS dưới dạng Serverless Functions (`apps/api/api/index.ts` + `apps/api/vercel.json`).
- **Vercel Project 2 (`cbst-web`)**: Chạy Frontend Next.js 15 (`apps/web`).
- **Ưu điểm**:
  - Không cần tạo tài khoản Railway / Render / VPS.
  - Hoàn toàn **Miễn phí** (Vercel Hobby hỗ trợ nhiều project trên 1 repo).
  - Tự động cấp SSL HTTPS, tự động CI/CD khi push code lên GitHub.

---

## BƯỚC 1: PUSH TOÀN BỘ MÃ NGUỒN LÊN GITHUB

Mở terminal tại thư mục gốc của dự án (`ca-bong-song-tra-v1`):

```powershell
# 1. Kiểm tra trạng thái file
git status

# 2. Thêm toàn bộ thay đổi (file .env đã được .gitignore bảo vệ an toàn)
git add .

# 3. Tạo commit
git commit -m "feat: configure full vercel serverless deployment for both api and web"

# 4. Đẩy lên nhánh chính trên GitHub
git push origin main
```
*(Nếu nhánh của bạn là `master`, hãy đổi `main` thành `master`).*

---

## BƯỚC 2: DEPLOY BACKEND (`cbst-api`) TRÊN VERCEL

> **Lưu ý**: Cần deploy Backend trước để lấy URL API cấp cho Frontend ở Bước 3.

### 2.1. Tạo Project Backend
1. Đăng nhập vào [Vercel Dashboard](https://vercel.com/dashboard).
2. Bấm nút **Add New...** (góc trên bên phải) ➔ chọn **Project**.
3. Tìm repository `ca-bong-song-tra-nextjs-v1` và bấm **Import**.

### 2.2. Cấu hình Project Backend
Tại màn hình **Configure Project**:
- **Project Name**: Đặt tên dễ nhớ, ví dụ: `cbst-api` (hoặc `ca-bong-song-tra-api`).
- **Framework Preset**: Chọn **Other**.
- **Root Directory**: Bấm nút **Edit** ➔ chọn thư mục **`apps/api`** ➔ bấm **Continue**.
- **Build & Development Settings**:
  - *Build Command*: Bật Override và nhập: `pnpm run build`
  - *Output Directory*: Giữ mặc định.
  - *Install Command*: Giữ mặc định (`pnpm install`).

### 2.3. Cài đặt biến môi trường cho Backend (Environment Variables)
Mở rộng mục **Environment Variables** và dán các biến sau:

| Tên biến (Key) | Giá trị (Value) | Ghi chú |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Chế độ Production |
| `PORT` | `4000` | Port mặc định |
| `MONGODB_URI` | `mongodb+srv://hoaibaoleqng_db_user:LOK8Yg1xsXaA8IQj@cbst-cluster.ccdzlj1.mongodb.net/?appName=cbst-cluster` | Chuỗi kết nối MongoDB Atlas |
| `SESSION_SECRET` | `6590498ee9f5ce898edce1becd199450c1a5dd4d10247ae20912891d3834545c` | Khóa bí mật hash session (>=32 ký tự) |
| `BFF_SHARED_SECRET` | `6590498ee9f5ce898edce1becd199450c1a5dd4d10247ae20912891d3834545c` | Khóa bí mật đồng bộ với Frontend |
| `CORS_ALLOWED_ORIGINS`| `https://cbst-shop.vercel.app` *(hoặc tạm thời để `*`, lát cập nhật lại)* | Domain frontend |
| `PUBLIC_CHECKOUT_ENABLED`| `true` | Cho phép đặt hàng |

4. Bấm nút **Deploy**.
5. Chờ Vercel build xong (khoảng 30-45 giây). Khi thành công, Vercel sẽ cấp cho bạn một URL, ví dụ: `https://cbst-api.vercel.app`.
   > **Lưu ý**: Hãy copy URL này lại (ví dụ: `https://cbst-api.vercel.app`).

---

## BƯỚC 3: DEPLOY FRONTEND (`cbst-web`) TRÊN VERCEL

### 3.1. Tạo Project Frontend
1. Quay lại trang [Vercel Dashboard](https://vercel.com/dashboard).
2. Bấm **Add New...** ➔ chọn **Project**.
3. Chọn lại chính repository `ca-bong-song-tra-nextjs-v1` và bấm **Import**.

### 3.2. Cấu hình Project Frontend
Tại màn hình **Configure Project**:
- **Project Name**: Đặt tên, ví dụ: `cbst-shop` (hoặc `ca-bong-song-tra-web`).
- **Framework Preset**: Vercel sẽ tự nhận diện là **Next.js**.
- **Root Directory**: Bấm nút **Edit** ➔ chọn thư mục **`apps/web`** ➔ bấm **Continue**.

### 3.3. Cài đặt biến môi trường cho Frontend (Environment Variables)
Mở rộng mục **Environment Variables** và nhập các biến sau:

| Tên biến (Key) | Giá trị (Value) | Ghi chú |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Chế độ Production |
| `API_INTERNAL_URL` | `https://cbst-api.vercel.app/api/v1` | **URL của Backend ở Bước 2 + `/api/v1`** |
| `WEB_ORIGIN` | `https://cbst-shop.vercel.app` | Domain của Project Frontend này |
| `BFF_SHARED_SECRET` | `6590498ee9f5ce898edce1becd199450c1a5dd4d10247ae20912891d3834545c` | **Phải khớp 100%** với Backend |
| `CLOUDINARY_CLOUD_NAME` | `dbqaiybhl` | Cloudinary Name |
| `CLOUDINARY_API_KEY` | `759923462277159` | Cloudinary Key |
| `CLOUDINARY_API_SECRET` | `xUZ-DX-Ta_QnGKAPaLtj2QU-YMg` | Cloudinary Secret |

4. Bấm nút **Deploy**.
5. Vercel sẽ build Next.js (khoảng 1 phút). Khi xong, bạn có trang web chính thức chạy tại `https://cbst-shop.vercel.app`.

---

## BƯỚC 4: ĐỒNG BỘ CUỐI CÙNG (CORS & ORIGIN SYNC)

Sau khi cả 2 project đã có domain chính thức:
1. Vào Project Backend (`cbst-api`) trên Vercel:
   - Vào **Settings** ➔ **Environment Variables**.
   - Cập nhật biến `CORS_ALLOWED_ORIGINS` = domain chính thức của Frontend (ví dụ: `https://cbst-shop.vercel.app`).
2. Vào Project Frontend (`cbst-web`) trên Vercel:
   - Kiểm tra biến `WEB_ORIGIN` đã khớp đúng domain chính thức của Frontend chưa (ví dụ: `https://cbst-shop.vercel.app`).
   - Kiểm tra `API_INTERNAL_URL` đã trỏ đúng vào `https://cbst-api.vercel.app/api/v1`.
3. Nếu có cập nhật biến nào, vào tab **Deployments** của project đó, bấm biểu tượng 3 chấm ở bản deploy mới nhất ➔ chọn **Redeploy** để nạp cấu hình mới.

---

## BƯỚC 5: KIỂM TRA VẬN HÀNH THỰC TẾ (SMOKE TEST)

Mở trình duyệt truy cập domain frontend vừa deploy (`https://cbst-shop.vercel.app`):

1. **Khách hàng đặt hàng**:
   - Thử chọn size ➔ Thêm vào giỏ / Đặt hàng.
   - Nhập thông tin khách hàng và bấm đặt hàng. Đơn hàng được tạo thành công vào MongoDB.
2. **Đăng nhập quản trị**:
   - Truy cập `https://cbst-shop.vercel.app/login` (hoặc `/admin`).
   - Đăng nhập bằng tài khoản Admin:
     - Email: `hoaibaole.qng@gmail.com`
     - Mật khẩu: *(Mật khẩu tài khoản của bạn)*
   - Đăng nhập thành công và vào thẳng **Admin Workspace** quản lý đơn hàng, kho lô, doanh thu.
3. **Thử tải ảnh lên Cloudinary**:
   - Vào mục Quản lý Media / Ảnh sản phẩm trong Admin ➔ Tải lên 1 ảnh mới.
   - Ảnh hiển thị ngay lập tức từ CDN Cloudinary.

---

## 🛠 XỬ LÝ SỰ CỐ NHANH

- **Lỗi 503 `API_NOT_CONFIGURED`**: Do `API_INTERNAL_URL` thiếu `/api/v1` ở đuôi, hoặc `BFF_SHARED_SECRET` không khớp giữa 2 project.
- **Lỗi 403 `ORIGIN_REJECTED`**: Do `WEB_ORIGIN` trên Frontend không khớp với domain bạn đang gõ trên thanh địa chỉ, hoặc `CORS_ALLOWED_ORIGINS` trên Backend chưa thêm domain Frontend.
- **Lỗi 401 `SESSION_INVALID`**: Kiểm tra đảm bảo URL truy cập có giao thức `https://`.
