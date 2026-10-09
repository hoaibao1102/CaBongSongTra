"use client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="p0a-card" role="alert">
      <h1>Không thể hoàn tất thao tác</h1>
      <p>
        Dữ liệu chưa được thay đổi. Hãy kiểm tra thông tin, trạng thái đơn hàng
        và tồn kho rồi thử lại.
      </p>
      <details>
        <summary>Chi tiết kỹ thuật</summary>
        <code>{error.message || "Lỗi không xác định"}</code>
      </details>
      <button className="p0a-button" type="button" onClick={reset}>
        Thử lại
      </button>
    </section>
  );
}
