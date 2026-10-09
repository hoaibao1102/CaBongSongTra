import { AdminCard, EmptyState } from "../../admin-shell";
import {
  createSupabaseServerClient,
  hasSupabaseEnv,
} from "@/lib/p0a/supabase-server";
import { translateAuditAction, translateEntity } from "@/lib/p0a/vi";

export default async function AuditPage() {
  const logs = hasSupabaseEnv()
    ? (
        await (
          await createSupabaseServerClient()
        )
          .from("audit_logs")
          .select("id,action,entity_type,entity_id,reason,created_at")
          .order("created_at", { ascending: false })
          .limit(100)
      ).data
    : null;
  return (
    <>
      <div className="p0a-page-head">
        <div>
          <h1>Nhật ký & xuất dữ liệu</h1>
          <p>Theo dõi thao tác quản trị và xuất danh sách đơn hàng an toàn.</p>
        </div>
        <a className="p0a-button" href="/admin/export/orders.csv">
          Tải danh sách đơn hàng CSV
        </a>
      </div>
      {!logs ? (
        <EmptyState
          title="Chưa có dữ liệu nhật ký"
          body="Các thao tác đã xác thực sẽ xuất hiện tại đây."
        />
      ) : (
        <AdminCard title="Hoạt động gần đây">
          <table className="p0a-table">
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Thao tác</th>
                <th>Đối tượng</th>
                <th>Lý do</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString("vi-VN")}</td>
                  <td>{translateAuditAction(log.action)}</td>
                  <td>
                    {translateEntity(log.entity_type)}:{" "}
                    {String(log.entity_id).slice(0, 8)}
                  </td>
                  <td>{log.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      )}
    </>
  );
}
