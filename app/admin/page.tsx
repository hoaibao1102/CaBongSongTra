import { AdminCard, EmptyState } from "../admin-shell";
import {
  hasSupabaseEnv,
  createSupabaseServerClient,
} from "@/lib/p0a/supabase-server";

async function counts() {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createSupabaseServerClient();
  const [orders, stock, commissions] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("stock_available_by_product").select("available_qty"),
    supabase.from("commission_records").select("member_amount,status"),
  ]);
  return {
    orders: orders.count ?? 0,
    stock:
      stock.data?.reduce(
        (sum, row) => sum + Number(row.available_qty ?? 0),
        0,
      ) ?? 0,
    payable:
      commissions.data
        ?.filter((row) => row.status === "APPROVED")
        .reduce((sum, row) => sum + Number(row.member_amount ?? 0), 0) ?? 0,
  };
}

export default async function AdminDashboard() {
  const data = await counts();
  return (
    <>
      <div className="p0a-page-head">
        <div>
          <h1>Tổng quan vận hành</h1>
          <p>Theo dõi đơn hàng, tồn kho và hoa hồng.</p>
        </div>
      </div>
      {!data ? (
        <EmptyState
          title="Chưa cấu hình Supabase"
          body="Hãy cấu hình kết nối Supabase và áp dụng migration trước khi sử dụng."
        />
      ) : (
        <div className="p0a-grid">
          <AdminCard title="Tổng số đơn hàng">
            <div className="p0a-kpi">{data.orders}</div>
          </AdminCard>
          <AdminCard title="Số hũ có thể bán">
            <div className="p0a-kpi">{data.stock}</div>
          </AdminCard>
          <AdminCard title="Hoa hồng đã duyệt">
            <div className="p0a-kpi">
              {data.payable.toLocaleString("vi-VN")}đ
            </div>
          </AdminCard>
        </div>
      )}
    </>
  );
}
