import { AdminCard, EmptyState } from "../../admin-shell";
import { createSupabaseServerClient, hasSupabaseEnv } from "@/lib/p0a/supabase-server";

export default async function AuditPage() {
  const logs = hasSupabaseEnv() ? (await (await createSupabaseServerClient()).from("audit_logs").select("id,action,entity_type,entity_id,reason,created_at").order("created_at", { ascending: false }).limit(100)).data : null;
  return <><div className="p0a-page-head"><div><h1>Audit & CSV export</h1><p>Admin-only export is audited and CSV cells are formula-injection safe.</p></div><a className="p0a-button" href="/admin/export/orders.csv">Download orders CSV</a></div>{!logs ? <EmptyState title="No audit database" body="Audit events will appear after Supabase migrations and authenticated actions." /> : <AdminCard title="Recent audit events"><table className="p0a-table"><thead><tr><th>When</th><th>Action</th><th>Entity</th><th>Reason</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString("vi-VN")}</td><td>{log.action}</td><td>{log.entity_type}:{String(log.entity_id).slice(0, 8)}</td><td>{log.reason}</td></tr>)}</tbody></table></AdminCard>}</>;
}
