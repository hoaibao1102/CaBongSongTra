import { AdminCard, EmptyState } from "../../admin-shell";
import { receiveBatchAction } from "@/lib/p0a/actions";
import { translateStatus } from "@/lib/p0a/vi";
import {
  createSupabaseServerClient,
  hasSupabaseEnv,
} from "@/lib/p0a/supabase-server";

export default async function InventoryPage() {
  const supabase = hasSupabaseEnv() ? await createSupabaseServerClient() : null;
  const batches = supabase
    ? (
        await supabase
          .from("inventory_batches")
          .select(
            "id,lot_code,status,received_qty,expires_at,landed_unit_cost,products(sku)",
          )
          .order("received_at", { ascending: false })
          .limit(50)
      ).data
    : null;
  const stock = supabase
    ? (
        await supabase
          .from("stock_available_by_product")
          .select("sku,name,available_qty,reserved_qty,on_hand_qty")
      ).data
    : null;
  const products = supabase
    ? ((
        await supabase
          .from("products")
          .select("id,sku,name")
          .eq("status", "ACTIVE")
          .order("sort_order")
      ).data ?? [])
    : [];
  return (
    <>
      <div className="p0a-page-head">
        <div>
          <h1>Kho & lô hàng</h1>
          <p>
            Quản lý tồn kho, giá vốn thực nhập, hạn sử dụng và lượng hàng đang
            giữ cho đơn.
          </p>
        </div>
      </div>
      {!supabase ? (
        <EmptyState
          title="Chưa kết nối dữ liệu"
          body="Tồn kho thực tế sẽ xuất hiện sau khi cấu hình Supabase và áp dụng migration."
        />
      ) : null}
      <div className="p0a-grid">
        {stock?.map((row) => (
          <AdminCard key={row.sku} title={row.sku}>
            <div className="p0a-kpi">{row.available_qty}</div>
            <p>
              {row.name} · tồn thực tế {row.on_hand_qty} · đang giữ{" "}
              {row.reserved_qty}
            </p>
          </AdminCard>
        ))}
      </div>
      <AdminCard title="Nhập lô hàng">
        <form action={receiveBatchAction} className="p0a-form">
          <label>
            Sản phẩm
            <select name="productId" required>
              <option value="">-- Chọn sản phẩm --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Mã lô
            <input name="lotCode" required />
          </label>
          <label>
            Số lượng nhập
            <input name="receivedQty" type="number" min="1" required />
          </label>
          <label>
            Giá mua mỗi hũ (đồng)
            <input name="purchaseUnitCost" type="number" min="1" required />
          </label>
          <label>
            Tổng chi phí nhập hàng (đồng)
            <input
              name="inboundCostTotal"
              type="number"
              min="0"
              defaultValue="0"
            />
          </label>
          <label>
            Hạn sử dụng
            <input name="expiresAt" type="date" required />
          </label>
          <label>
            Đường dẫn ảnh nhãn / bằng chứng
            <input
              name="labelEvidencePath"
              placeholder="URL hoặc đường dẫn ảnh nhãn"
              required
            />
          </label>
          <input
            type="hidden"
            name="idempotencyKey"
            value={crypto.randomUUID()}
          />
          <button type="submit">Xác nhận nhập lô</button>
        </form>
      </AdminCard>
      {batches ? (
        <AdminCard title="Các lô nhập gần đây">
          <table className="p0a-table">
            <thead>
              <tr>
                <th>Mã lô</th>
                <th>SKU</th>
                <th>Trạng thái</th>
                <th>Số lượng</th>
                <th>Hạn sử dụng</th>
                <th>Giá vốn thực nhập</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>{b.lot_code}</td>
                  <td>{(b.products as { sku?: string } | null)?.sku}</td>
                  <td>{translateStatus(b.status)}</td>
                  <td>{b.received_qty}</td>
                  <td>{b.expires_at}</td>
                  <td>{Number(b.landed_unit_cost).toLocaleString("vi-VN")}đ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      ) : null}
    </>
  );
}
