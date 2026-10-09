import { AdminCard, EmptyState } from "../../admin-shell";
import {
  createPayoutAction,
  recordPaymentAction,
  upsertOrderCostAction,
} from "@/lib/p0a/actions";
import {
  createSupabaseServerClient,
  hasSupabaseEnv,
} from "@/lib/p0a/supabase-server";
import { translateStatus } from "@/lib/p0a/vi";

export default async function FinancePage() {
  const supabase = hasSupabaseEnv() ? await createSupabaseServerClient() : null;
  const commissions = supabase
    ? (
        await supabase
          .from("commission_records")
          .select(
            "id,order_id,member_id,status,base_profit,member_amount,owner_amount,eligible_at",
          )
          .order("eligible_at", { ascending: false })
          .limit(50)
      ).data
    : null;
  const payouts = supabase
    ? (
        await supabase
          .from("commission_payouts")
          .select("id,member_id,period_start,period_end,amount,status,paid_at")
          .order("period_start", { ascending: false })
          .limit(20)
      ).data
    : null;
  return (
    <>
      <div className="p0a-page-head">
        <div>
          <h1>Thanh toán, chi phí & hoa hồng</h1>
          <p>
            Ghi nhận thu/hoàn tiền, chi phí trực tiếp, chia lợi nhuận 40/60 và
            chi trả hàng tháng.
          </p>
        </div>
      </div>
      {!supabase ? (
        <EmptyState
          title="Chưa có dữ liệu tài chính"
          body="Các biểu mẫu tài chính sẽ hoạt động sau khi kết nối Supabase."
        />
      ) : null}
      <AdminCard title="Ghi nhận thu tiền hoặc hoàn tiền">
        <form action={recordPaymentAction} className="p0a-form">
          <label>
            Mã định danh đơn hàng
            <input name="orderId" required />
          </label>
          <label>
            Loại giao dịch
            <select name="kind">
              <option value="RECEIPT">Thu tiền</option>
              <option value="REFUND">Hoàn tiền</option>
            </select>
          </label>
          <label>
            Phương thức
            <select name="method">
              <option value="BANK_TRANSFER">Chuyển khoản</option>
              <option value="CASH_COD">Tiền mặt / COD</option>
            </select>
          </label>
          <label>
            Số tiền (đồng)
            <input name="amount" type="number" min="1" required />
          </label>
          <label>
            Mã tham chiếu
            <input name="reference" />
          </label>
          <input
            type="hidden"
            name="idempotencyKey"
            value={crypto.randomUUID()}
          />
          <button type="submit">Ghi nhận giao dịch</button>
        </form>
      </AdminCard>
      <AdminCard title="Chi phí trực tiếp của đơn hàng">
        <form action={upsertOrderCostAction} className="p0a-form">
          <label>
            Mã định danh đơn hàng
            <input name="orderId" required />
          </label>
          <label>
            Loại chi phí
            <select name="type">
              <option value="SHOP_SHIPPING">Phí vận chuyển shop chịu</option>
              <option value="PACKAGING">Chi phí đóng gói</option>
              <option value="PAYMENT_FEE">Phí thanh toán</option>
              <option value="OTHER_DIRECT">Chi phí trực tiếp khác</option>
              <option value="MEMBER_ADVANCE_REIMBURSEMENT">
                Hoàn tiền thành viên đã ứng
              </option>
            </select>
          </label>
          <label>
            Người chịu chi phí
            <select name="payer">
              <option value="SHOP">Cửa hàng</option>
              <option value="CUSTOMER">Khách hàng</option>
              <option value="ADVANCED_BY_MEMBER">Thành viên ứng trước</option>
            </select>
          </label>
          <label>
            Số tiền (đồng)
            <input name="amount" type="number" min="1" required />
          </label>
          <label>
            Ghi chú
            <input name="note" />
          </label>
          <input
            type="hidden"
            name="idempotencyKey"
            value={crypto.randomUUID()}
          />
          <button type="submit">Lưu chi phí</button>
        </form>
      </AdminCard>
      {commissions ? (
        <AdminCard title="Bảng hoa hồng">
          <table className="p0a-table">
            <thead>
              <tr>
                <th>Đơn hàng</th>
                <th>Trạng thái</th>
                <th>Lợi nhuận tính chia</th>
                <th>Thành viên</th>
                <th>Chủ sở hữu</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id}>
                  <td>{String(c.order_id).slice(0, 8)}</td>
                  <td>{translateStatus(c.status)}</td>
                  <td>{Number(c.base_profit).toLocaleString("vi-VN")}đ</td>
                  <td>{Number(c.member_amount).toLocaleString("vi-VN")}đ</td>
                  <td>{Number(c.owner_amount).toLocaleString("vi-VN")}đ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      ) : null}
      <AdminCard title="Tạo đợt chi trả hàng tháng">
        <form action={createPayoutAction} className="p0a-form">
          <label>
            Mã thành viên
            <input name="memberId" required />
          </label>
          <label>
            Từ ngày
            <input name="periodStart" type="date" required />
          </label>
          <label>
            Đến ngày
            <input name="periodEnd" type="date" required />
          </label>
          <label>
            Phương thức chi trả
            <input name="method" />
          </label>
          <label>
            Đường dẫn bằng chứng thanh toán
            <input name="proofPath" />
          </label>
          <input
            type="hidden"
            name="idempotencyKey"
            value={crypto.randomUUID()}
          />
          <button type="submit">Tạo đợt chi trả</button>
        </form>
      </AdminCard>
      {payouts ? (
        <AdminCard title="Các đợt chi trả">
          <table className="p0a-table">
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.period_start} đến {p.period_end}
                  </td>
                  <td>{Number(p.amount).toLocaleString("vi-VN")}đ</td>
                  <td>{translateStatus(p.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      ) : null}
    </>
  );
}
