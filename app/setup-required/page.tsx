import Link from "next/link";

export default function SetupRequiredPage() {
  return (
    <main style={{ maxWidth: 720, margin: "64px auto", padding: 24 }}>
      <h1>Admin chưa được cấu hình</h1>
      <p>Khu vực quản trị cần Supabase URL và publishable/anon key. Storefront công khai vẫn hoạt động bình thường.</p>
      <p>Thiết lập biến môi trường theo <code>.env.example</code>, áp dụng migration rồi tạo tài khoản Owner/Admin trước khi sử dụng.</p>
      <Link href="/">Quay lại trang chủ</Link>
    </main>
  );
}
