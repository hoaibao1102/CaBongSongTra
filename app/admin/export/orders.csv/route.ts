import { NextResponse } from "next/server";
import { toCsv } from "@/lib/p0a/domain";
import { createSupabaseServerClient, getCurrentProfile, hasSupabaseEnv } from "@/lib/p0a/supabase-server";

export async function GET() {
  if (!hasSupabaseEnv()) return new NextResponse("Supabase environment is not configured.", { status: 503 });
  const profile = await getCurrentProfile();
  if (!profile) return new NextResponse("Unauthenticated", { status: 401 });
  if (profile.role !== "OWNER_ADMIN") return new NextResponse("Forbidden", { status: 403 });
  const supabase = await createSupabaseServerClient();
  await supabase.from("audit_logs").insert({ organization_id: profile.organization_id, actor_id: profile.id, action: "EXPORT_ORDERS_CSV", entity_type: "orders", entity_id: profile.organization_id, reason: "Admin CSV export" });
  const { data, error } = await supabase.from("orders").select("order_code,status,payment_status,gross_due,gross_collected,created_at,customers(display_name,phone_e164)").order("created_at", { ascending: false }).limit(5000);
  if (error) return new NextResponse("Export failed", { status: 500 });
  const rows = [["order_code", "status", "payment_status", "gross_due", "gross_collected", "customer", "phone", "created_at"], ...(data ?? []).map((row) => [row.order_code, row.status, row.payment_status, row.gross_due, row.gross_collected, (row.customers as { display_name?: string } | null)?.display_name, (row.customers as { phone_e164?: string } | null)?.phone_e164, row.created_at])];
  return new NextResponse(toCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=orders.csv" } });
}
