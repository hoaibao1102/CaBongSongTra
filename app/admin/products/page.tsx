import { AdminCard, EmptyState } from "../../admin-shell";
import { canonicalProducts } from "@/lib/p0a/catalog";
import { createPriceVersionAction } from "@/lib/p0a/actions";
import { findCurrentPrice, translateStatus } from "@/lib/p0a/vi";
import {
  createSupabaseServerClient,
  hasSupabaseEnv,
} from "@/lib/p0a/supabase-server";

export default async function ProductsPage() {
  const products = hasSupabaseEnv()
    ? (
        await (
          await createSupabaseServerClient()
        )
          .from("products")
          .select(
            "id,sku,name,label_net_weight_g,status,product_prices(retail_price,effective_from,effective_to)",
          )
          .order("sort_order")
      ).data
    : null;
  return (
    <>
      <div className="p0a-page-head">
        <div>
          <h1>Sản phẩm & giá bán</h1>
          <p>
            Quản lý sản phẩm chuẩn, trạng thái kinh doanh và lịch sử giá bán.
          </p>
        </div>
      </div>
      <AdminCard title="Danh mục sản phẩm chuẩn">
        <table className="p0a-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Khối lượng tịnh</th>
              <th>Giá bán tham chiếu</th>
              <th>Giá vốn ban đầu</th>
            </tr>
          </thead>
          <tbody>
            {canonicalProducts.map((p) => (
              <tr key={p.sku}>
                <td>{p.sku}</td>
                <td>{p.labelNetWeightG}g</td>
                <td>{p.retailPrice.toLocaleString("vi-VN")}đ</td>
                <td>{p.openingUnitCost.toLocaleString("vi-VN")}đ</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminCard>
      {!products ? (
        <EmptyState
          title="Chưa có dữ liệu Supabase"
          body="Hãy áp dụng migration và đăng nhập để quản lý sản phẩm thực tế."
        />
      ) : (
        <AdminCard title="Sản phẩm đang quản lý">
          <div className="p0a-table-wrap">
            <table className="p0a-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Tên sản phẩm</th>
                  <th>Khối lượng</th>
                  <th>Giá đang áp dụng</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const currentPrice = findCurrentPrice(p.product_prices);
                  return (
                    <tr key={p.id}>
                      <td>{p.sku}</td>
                      <td>{p.name}</td>
                      <td>{p.label_net_weight_g}g</td>
                      <td>
                        {currentPrice
                          ? `${Number(currentPrice.retail_price).toLocaleString("vi-VN")}đ`
                          : "Chưa có giá"}
                      </td>
                      <td>
                        <span className="p0a-pill">
                          {translateStatus(p.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminCard>
      )}
      <AdminCard title="Tạo phiên bản giá mới">
        <form action={createPriceVersionAction} className="p0a-form">
          <label>
            Sản phẩm
            <select name="productId" required>
              <option value="">-- Chọn sản phẩm --</option>
              {products?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Giá bán (đồng)
            <input name="retailPrice" type="number" min="1" required />
          </label>
          <label>
            Có hiệu lực từ
            <input name="effectiveFrom" type="datetime-local" required />
          </label>
          <label>
            Lý do thay đổi
            <input name="reason" required />
          </label>
          <input
            type="hidden"
            name="idempotencyKey"
            value={crypto.randomUUID()}
          />
          <button type="submit">Lưu giá bán</button>
        </form>
      </AdminCard>
    </>
  );
}
