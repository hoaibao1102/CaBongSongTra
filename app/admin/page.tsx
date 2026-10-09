import { AdminCard, EmptyState } from "../admin-shell";
import { hasSupabaseEnv, createSupabaseServerClient } from "@/lib/p0a/supabase-server";

async function counts() {
  if (!hasSupabaseEnv()) return null;
  const supabase = await createSupabaseServerClient();
  const [orders, stock, commissions] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("stock_available_by_product").select("available_qty"),
    supabase.from("commission_records").select("member_amount,status"),
  ]);
  return { orders: orders.count ?? 0, stock: stock.data?.reduce((sum, row) => sum + Number(row.available_qty ?? 0), 0) ?? 0, payable: commissions.data?.filter((row) => row.status === "APPROVED").reduce((sum, row) => sum + Number(row.member_amount ?? 0), 0) ?? 0 };
}

export default async function AdminDashboard() {
  const data = await counts();
  return <><div className="p0a-page-head"><div><h1>Operations dashboard</h1><p>Money, stock, and commission controls for P0a.</p></div></div>{!data ? <EmptyState title="Supabase not configured" body="Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then apply migrations." /> : <div className="p0a-grid"><AdminCard title="Orders"><div className="p0a-kpi">{data.orders}</div></AdminCard><AdminCard title="Available jars"><div className="p0a-kpi">{data.stock}</div></AdminCard><AdminCard title="Approved payout"><div className="p0a-kpi">{data.payable.toLocaleString("vi-VN")}d</div></AdminCard></div>}</>;
}
