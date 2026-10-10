"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createCheckout } from "../lib/checkout-retry";
import {
  ownerProductInitial,
  paymentDue,
  returnChoices,
} from "../lib/owner-views";
import {
  actions,
  apiRequest,
  ApiError,
  buildPayload,
  checkoutPayload,
  createMutation,
  sectionsFor,
  skus,
  transitions,
  type Field,
} from "../lib/commerce";
import { errorText, label, money, text } from "../lib/i18n";
import type { Actor, Lang, Order, Product, RecordRow } from "../lib/types";
const productName = (product: Product, lang: Lang) =>
  lang === "vi" ? product.name : `Song Tra goby ${product.netWeightG}g`;

function ErrorNotice({ error, lang }: { error: unknown; lang: Lang }) {
  return error ? (
    <p className="notice error" role="alert">
      {errorText(error, lang)}
      {error instanceof ApiError && error.requestId ? (
        <small>
          {label("requestId", lang)}: {error.requestId}
        </small>
      ) : null}
    </p>
  ) : null;
}

function Input({
  field,
  lang,
  value,
  onChange,
}: {
  field: Field;
  lang: Lang;
  value?: unknown;
  onChange?: (value: string) => void;
}) {
  const title = field[lang];
  return (
    <label className={field.type === "checkbox" ? "check" : ""}>
      <span>
        {title}
        {field.optional ? text(lang, " (không bắt buộc)", " (optional)") : " *"}
      </span>
      {field.options ? (
        <select
          name={field.name}
          defaultValue={String(value ?? field.options[0] ?? "")}
          onChange={(event) => onChange?.(event.target.value)}
          required={!field.optional}
        >
          {field.options.map((option) => (
            <option key={option} value={option}>
              {label(option, lang)}
            </option>
          ))}
        </select>
      ) : field.type === "checkbox" ? (
        <input
          name={field.name}
          type="checkbox"
          defaultChecked={value === true}
          required={!field.optional}
        />
      ) : (
        <input
          name={field.name}
          type={field.type ?? "text"}
          defaultValue={String(value ?? "")}
          min={field.min}
          max={field.max}
          step={field.type === "number" ? 1 : undefined}
          minLength={field.minLength}
          maxLength={field.maxLength}
          pattern={field.pattern}
          required={!field.optional}
          autoComplete={
            field.type === "password"
              ? "current-password"
              : field.type === "email"
                ? "email"
                : undefined
          }
        />
      )}
    </label>
  );
}

export function ActionForm({
  action,
  lang,
  id = "",
  initial = {},
  statusOptions,
  fieldOverrides = {},
  onSuccess,
  onUnauthorized,
}: {
  action: string;
  lang: Lang;
  id?: string;
  initial?: RecordRow;
  statusOptions?: string[];
  fieldOverrides?: Record<string, Partial<Field>>;
  onSuccess: (result: unknown) => void | Promise<void>;
  onUnauthorized?: () => void;
}) {
  const definition = actions[action];
  const mutate = useRef(createMutation());
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState(false);
  const [scope, setScope] = useState(String(initial.scope ?? "OVERHEAD"));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setError(null);
    setSuccess(false);
    setBusy(true);
    busyRef.current = true;
    try {
      const payload = buildPayload(action, values);
      const result = await mutate.current(
        definition.path(id),
        payload,
        definition.method ?? "POST",
      );
      form.reset();
      setSuccess(true);
      await onSuccess(result);
    } catch (caught) {
      setError(caught);
      if (caught instanceof ApiError && caught.status === 401)
        onUnauthorized?.();
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  return (
    <form onSubmit={submit} className="action-form">
      <h3>{definition[lang]}</h3>
      <fieldset disabled={busy}>
        <div className="form-grid">
          {definition.fields
            .filter(
              (f) =>
                !(
                  action === "expense" &&
                  scope !== "ORDER" &&
                  ["orderId", "expectedVersion"].includes(f.name)
                ),
            )
            .map((f) => (
              <Input
                key={f.name}
                field={{
                  ...f,
                  ...fieldOverrides[f.name],
                  ...(f.name === "status" && statusOptions
                    ? { options: statusOptions }
                    : {}),
                  ...(action === "expense" &&
                  scope === "ORDER" &&
                  ["orderId", "expectedVersion"].includes(f.name)
                    ? { optional: false }
                    : {}),
                }}
                lang={lang}
                value={initial[f.name]}
                onChange={f.name === "scope" ? setScope : undefined}
              />
            ))}
        </div>
        <button type="submit">
          {busy ? text(lang, "Đang xử lý…", "Processing…") : definition[lang]}
        </button>
      </fieldset>
      <ErrorNotice error={error} lang={lang} />
      {success && (
        <p className="notice" role="status">
          {text(lang, "Đã ghi nhận thành công.", "Recorded successfully.")}
        </p>
      )}
      {!!error && (
        <p className="muted">
          {text(
            lang,
            "Nếu chưa rõ kết quả, thử lại với nội dung không đổi. Không tải lại trang hoặc tạo yêu cầu mới.",
            "If the result is uncertain, retry unchanged. Do not reload the page or start a new request.",
          )}
        </p>
      )}
    </form>
  );
}

export function Storefront({
  lang,
  products,
  actor,
  onCreated,
}: {
  lang: Lang;
  products: Product[];
  actor?: Actor | null;
  onCreated: (result: RecordRow) => void;
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<RecordRow | null>(null);
  const mutate = useRef<ReturnType<typeof createCheckout> | null>(null);
  const busyRef = useRef(false);
  const total = products.reduce(
    (sum, product) => sum + product.retailPriceVnd * (cart[product.sku] ?? 0),
    0,
  );
  async function checkout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const form = event.currentTarget;
    setError(null);
    setBusy(true);
    busyRef.current = true;
    try {
      const payload = checkoutPayload(
        {
          ...Object.fromEntries(new FormData(form)),
          source: actor ? new FormData(form).get("source") : "WEBSITE",
        },
        cart,
      );
      if (!mutate.current) {
        try {
          mutate.current = createCheckout(window.sessionStorage);
        } catch {
          throw new Error("RETRY_STORAGE_UNAVAILABLE");
        }
      }
      const result = (await mutate.current(payload, actor?.id)) as RecordRow;
      setReceipt(result);
      setCart({});
      form.reset();
      onCreated(result);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">QUẢNG NGÃI · VIỆT NAM</p>
          <h1>{text(lang, "Cá Bống\nSông Trà", "A taste of\nSong Tra")}</h1>
          <p className="intro">
            {text(
              lang,
              "Hương vị quê nhà, trọn vẹn trong từng bữa cơm.",
              "From the heart of Quang Ngai to your family table.",
            )}
          </p>
          <a className="button" href="#checkout">
            {text(lang, "Chọn vị quê nhà", "Shop the collection")}
          </a>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="seal">
            SÔNG TRÀ<span>QUẢNG NGÃI</span>
          </div>
          <div className="river" />
          <p>300g / 400g / 600g</p>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">
            {text(lang, "BỘ SƯU TẬP", "THE COLLECTION")}
          </p>
          <h2>
            {text(lang, "Chọn hộp cho bữa cơm nhà", "Made for your table")}
          </h2>
        </div>
        <p>
          {text(
            lang,
            "Giá và tình trạng được kiểm tra lại khi gửi đơn.",
            "Prices and availability are checked when you submit.",
          )}
        </p>
      </div>
      <section
        className="product-grid"
        aria-label={text(lang, "Sản phẩm", "Products")}
      >
        {products.map((product, index) => (
          <article className="product" key={product.sku}>
            <div className={`pack pack-${index}`} aria-hidden="true">
              <span>
                CÁ BỐNG
                <br />
                SÔNG TRÀ
              </span>
              <b>{product.netWeightG}g</b>
            </div>
            <p className="eyebrow">{product.sku}</p>
            <h3>
              <a href={`/products/${product.sku}`}>
                {productName(product, lang)}
              </a>
            </h3>
            <strong>{money(product.retailPriceVnd, lang)}</strong>
            <label>
              {text(lang, "Số lượng", "Quantity")}
              <input
                aria-label={`${text(lang, "Số lượng", "Quantity")} ${product.sku}`}
                type="number"
                min="0"
                max="100"
                step="1"
                value={cart[product.sku] ?? 0}
                disabled={busy}
                onChange={(event) => {
                  setReceipt(null);
                  setCart({
                    ...cart,
                    [product.sku]: Number(event.target.value),
                  });
                }}
              />
            </label>
          </article>
        ))}
      </section>
      {!products.length && (
        <p className="notice">
          {text(
            lang,
            "Chưa có sản phẩm để đặt. Không sử dụng giá minh họa.",
            "No products are available to order. No sample prices are used.",
          )}
        </p>
      )}
      <section className="checkout" id="checkout">
        <p className="notice wide">
          {text(
            lang,
            "Dữ liệu kỹ thuật thử lại được giữ trong phiên tab, không lưu thông tin khách hàng. Sau khi tải lại, nhập đúng nội dung và dùng tài khoản ban đầu để thử lại. Khi còn yêu cầu chưa rõ kết quả, hệ thống chặn nội dung hoặc tài khoản khác. Không xóa dữ liệu phiên hoặc đóng tab để bỏ qua kiểm tra.",
            "Technical retry metadata stays in this tab session, without customer details. After reload, restore the original details and account to retry. Changed details or accounts are blocked while a checkout is unresolved. Do not clear session storage or close the tab to bypass this check.",
          )}
        </p>
        <aside>
          <p className="eyebrow">{text(lang, "ĐẶT HÀNG", "CHECKOUT")}</p>
          <h2>
            {actor
              ? text(lang, "Tạo đơn nội bộ", "Create an internal order")
              : text(lang, "Gửi yêu cầu đặt hàng", "Your order request")}
          </h2>
          <p>
            {text(
              lang,
              "Đơn mới ở trạng thái chờ xác nhận, chưa giữ hàng. Cửa hàng sẽ kiểm tra tồn kho khi xác nhận.",
              "New orders are pending requests, not stock reservations. Stock is reserved only when the shop confirms.",
            )}
          </p>
          <ul className="cart-lines">
            {products
              .filter((p) => (cart[p.sku] ?? 0) > 0)
              .map((p) => (
                <li key={p.sku}>
                  {productName(p, lang)} × {cart[p.sku]}{" "}
                  <b>{money(p.retailPriceVnd * cart[p.sku], lang)}</b>
                </li>
              ))}
          </ul>
          <p>{text(lang, "Tạm tính", "Estimated total")}</p>
          <strong className="total">{money(total, lang)}</strong>
          <small>
            {text(
              lang,
              "Không thanh toán thẻ tại đây. Chỉ ghi nhận yêu cầu đặt hàng.",
              "No card payment is taken here. This submits an order request only.",
            )}
          </small>
        </aside>
        <form onSubmit={checkout}>
          <fieldset disabled={busy}>
            <div className="form-grid">
              <Input
                field={{
                  name: "name",
                  vi: "Họ tên",
                  en: "Full name",
                  maxLength: 100,
                }}
                lang={lang}
              />
              <Input
                field={{
                  name: "phone",
                  vi: "Số điện thoại",
                  en: "Vietnamese phone number",
                  type: "tel",
                  pattern: "(?:0|\\+84)[35789][0-9]{8}",
                }}
                lang={lang}
              />
              <Input
                field={{
                  name: "address",
                  vi: "Địa chỉ nhận hàng",
                  en: "Delivery address",
                  minLength: 5,
                  maxLength: 500,
                }}
                lang={lang}
              />
              <Input
                field={{
                  name: "area",
                  vi: "Khu vực / Tỉnh thành",
                  en: "Area / Province",
                  maxLength: 100,
                }}
                lang={lang}
              />
              {actor && (
                <Input
                  field={{
                    name: "source",
                    vi: "Nguồn đơn",
                    en: "Order source",
                    options: ["DIRECT", "WEBSITE", "FACEBOOK_GROUP", "OTHER"],
                  }}
                  lang={lang}
                />
              )}
              <label className="wide">
                {text(lang, "Ghi chú (không bắt buộc)", "Notes (optional)")}
                <textarea name="notes" maxLength={1000} rows={3} />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" name="consent" required />
              {text(
                lang,
                "Tôi đồng ý cung cấp thông tin trên để cửa hàng liên hệ và xử lý đơn hàng.",
                "I consent to the shop using these details to contact me and fulfill my order.",
              )}
            </label>
            <button type="submit" disabled={!products.length || !total}>
              {busy
                ? text(lang, "Đang gửi…", "Submitting…")
                : text(lang, "Gửi yêu cầu đặt hàng", "Submit order request")}
            </button>
          </fieldset>
          <ErrorNotice error={error} lang={lang} />
          {!!error && (
            <p className="muted">
              {text(
                lang,
                "Thử lại với cùng nội dung nếu kết quả chưa rõ để tránh tạo đơn trùng.",
                "If the result is uncertain, retry with unchanged details to avoid duplicate orders.",
              )}
            </p>
          )}
          {receipt && (
            <div className="notice" role="status">
              <h3>{text(lang, "Đã nhận yêu cầu", "Request received")}</h3>
              <p>{String(receipt.orderCode)}</p>
              <p>
                {label(String(receipt.status), lang)} ·{" "}
                {money(Number(receipt.totalVnd), lang)}
              </p>
              <p>
                {text(
                  lang,
                  "Lưu mã đơn để trao đổi với cửa hàng. Đây chưa phải xác nhận giữ hàng.",
                  "Keep this order code when contacting the shop. Stock is not yet reserved.",
                )}
              </p>
            </div>
          )}
        </form>
      </section>
    </>
  );
}

function display(value: unknown, key: string, lang: Lang): string {
  if (value === undefined || value === null) return "-";
  if (typeof value === "boolean")
    return value ? text(lang, "Có", "Yes") : text(lang, "Không", "No");
  if (typeof value === "number")
    return key.endsWith("Vnd")
      ? money(value, lang)
      : new Intl.NumberFormat(lang === "vi" ? "vi-VN" : "en-US").format(value);
  if (typeof value === "object") {
    const entry = value as RecordRow;
    return typeof entry[lang] === "string"
      ? String(entry[lang])
      : Object.values(entry)
          .filter((v) => typeof v !== "object")
          .join(" · ");
  }
  if (key.endsWith("At") || key === "asOf") {
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime()))
      return new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(date);
  }
  return label(String(value), lang);
}
export function ResetIssue({ id, lang }: { id: string; lang: Lang }) {
  const [result, setResult] = useState<RecordRow | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(
        await apiRequest<RecordRow>(`users/${id}/password-reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      );
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="action-form" onSubmit={issue}>
      <h3>{text(lang, "Cấp mã khôi phục", "Issue reset token")}</h3>
      <p>
        {text(
          lang,
          "Mã dùng một lần trong 15 phút. Cấp lại sẽ hủy mã cũ. Chỉ giao mã qua kênh an toàn.",
          "Single-use token, valid for 15 minutes. Reissuing invalidates the old token. Deliver only through a secure channel.",
        )}
      </p>
      <fieldset disabled={busy}>
        <label className="check">
          <input type="checkbox" required />
          {text(
            lang,
            "Tôi đã xác minh danh tính thành viên.",
            "I have verified the member's identity.",
          )}
        </label>
        <button>{text(lang, "Cấp mã khôi phục", "Issue reset token")}</button>
      </fieldset>
      <ErrorNotice error={error} lang={lang} />
      {result && (
        <div className="notice">
          <label>
            {text(
              lang,
              "Mã bí mật (không lưu trên trình duyệt)",
              "Secret token (not saved in browser storage)",
            )}
            <input
              readOnly
              value={String(result.token ?? "")}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <p>{String(result.expiresAt ?? "")}</p>
          <button
            type="button"
            className="secondary"
            onClick={() => setResult(null)}
          >
            {text(lang, "Ẩn mã", "Hide token")}
          </button>
        </div>
      )}
    </form>
  );
}
export function Records({
  rows,
  lang,
  onSelect,
}: {
  rows: RecordRow[];
  lang: Lang;
  onSelect?: (row: RecordRow) => void;
}) {
  if (!rows.length)
    return (
      <p className="empty">{text(lang, "Chưa có bản ghi.", "No records.")}</p>
    );
  const columns = [...new Set(rows.flatMap(Object.keys))].filter(
    (key) => !["customer", "items", "allocations"].includes(key),
  );
  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label={text(lang, "Danh sách bản ghi", "Records")}
    >
      <table>
        <thead>
          <tr>
            {columns.map((key) => (
              <th scope="col" key={key}>
                {label(key, lang)}
              </th>
            ))}
            {onSelect && (
              <th scope="col">{text(lang, "Thao tác", "Action")}</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id ?? row.sku ?? index)}>
              {columns.map((key) => (
                <td key={key}>{display(row[key], key, lang)}</td>
              ))}
              {onSelect && (
                <td>
                  <button className="secondary" onClick={() => onSelect(row)}>
                    {text(lang, "Mở", "Open")}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrderDetail({
  id,
  actor,
  lang,
  onUnauthorized,
  onChanged,
}: {
  id: string;
  actor: Actor;
  lang: Lang;
  onUnauthorized?: () => void;
  onChanged: () => void;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setOrder(null);
    setError(null);
    apiRequest<Order>(`orders/${id}`)
      .then((value) => {
        if (alive) setOrder(value);
      })
      .catch((caught) => {
        if (alive) {
          setError(caught);
          if (caught instanceof ApiError && caught.status === 401)
            onUnauthorized?.();
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, revision, onUnauthorized]);
  const refresh = () => {
    setRevision((value) => value + 1);
    onChanged();
  };
  return (
    <section className="detail">
      <div className="section-heading">
        <h2>{text(lang, "Chi tiết đơn hàng", "Order details")}</h2>
        <button
          className="secondary"
          onClick={() => setRevision((value) => value + 1)}
        >
          {text(lang, "Tải lại phiên bản", "Reload current version")}
        </button>
      </div>
      <ErrorNotice error={error} lang={lang} />
      {loading && <p role="status">{text(lang, "Đang tải…", "Loading…")}</p>}
      {order && (
        <>
          <h3>{order.orderCode}</h3>
          <span className="badge">
            {label(order.status, lang)} · v{order.version}
          </span>
          <address>
            {order.customer.name}
            <br />
            {order.customer.phone}
            <br />
            {order.customer.address}, {order.customer.area}
          </address>
          <Records rows={order.items} lang={lang} />
          <dl className="metrics">
            {[
              "totalVnd",
              "receiptsVnd",
              "refundsVnd",
              "paymentDueVnd",
              ...(actor.role === "OWNER_ADMIN"
                ? [
                    "cogsVnd",
                    "directCostsVnd",
                    "commissionVnd",
                    "costsFinalized",
                    "returnValueVnd",
                    "returnRefundsVnd",
                    "returnCreditBalanceVnd",
                    "refundableVnd",
                    "returnRefundDueVnd",
                  ]
                : []),
            ].map((key) => (
              <div key={key}>
                <dt>{label(key, lang)}</dt>
                <dd>
                  {key === "paymentDueVnd" && paymentDue(order) === null
                    ? text(lang, "Chưa có dữ liệu", "Unavailable")
                    : display(order[key as keyof Order], key, lang)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="notice">
            {text(
              lang,
              "Giao hàng không tự ghi nhận tiền. COD chỉ ghi khi tiền đã về cửa hàng. Trả hàng không tự hoàn tiền hoặc nhập lại kho.",
              "Delivery never records payment. Record COD only after the shop receives it. Returns do not automatically refund or restock.",
            )}
          </p>
          <div className="action-grid" key={`${order.id}-${order.version}`}>
            {paymentDue(order) === null && (
              <p className="notice" role="alert">
                {text(
                  lang,
                  "Chưa có số tiền phải thu hợp lệ từ máy chủ. Không thể ghi thu tiền; tải lại đơn hoặc liên hệ người vận hành.",
                  "The server payment amount is unavailable or invalid. Payment entry is disabled; reload the order or contact an operator.",
                )}
              </p>
            )}
            {["PENDING", "CONFIRMED", "PACKING"].includes(order.status) && (
              <ActionForm
                action="editOrder"
                lang={lang}
                id={id}
                initial={{
                  expectedVersion: order.version,
                  ...Object.fromEntries(
                    skus.map((sku) => [
                      sku,
                      order.items.find((item) => item.sku === sku)?.qty ?? 0,
                    ]),
                  ),
                }}
                onSuccess={refresh}
                onUnauthorized={onUnauthorized}
              />
            )}
            {transitions(order.status, actor.role).length > 0 && (
              <ActionForm
                action="transition"
                lang={lang}
                id={id}
                initial={{ expectedVersion: order.version }}
                statusOptions={transitions(order.status, actor.role)}
                onSuccess={refresh}
                onUnauthorized={onUnauthorized}
              />
            )}
            {!["CANCELLED", "RETURNED"].includes(order.status) &&
              (paymentDue(order) ?? 0) > 0 && (
                <ActionForm
                  action="payment"
                  lang={lang}
                  id={id}
                  initial={{
                    expectedVersion: order.version,
                    amountVnd: paymentDue(order),
                  }}
                  onSuccess={refresh}
                  onUnauthorized={onUnauthorized}
                />
              )}
            {actor.role === "OWNER_ADMIN" && (
              <>
                {["PENDING", "CONFIRMED", "PACKING"].includes(order.status) && (
                  <ActionForm
                    action="assignment"
                    lang={lang}
                    id={id}
                    initial={{ expectedVersion: order.version }}
                    onSuccess={refresh}
                    onUnauthorized={onUnauthorized}
                  />
                )}
                {[
                  "RETURN_REQUESTED",
                  "PARTIALLY_RETURNED",
                  "DELIVERY_FAILED",
                ].includes(order.status) && (
                  <div>
                    <p className="notice">
                      {text(
                        lang,
                        "Chọn một lô còn số lượng trả mỗi lần. Kiểm tra hàng trước khi chọn nhập lại kho. Hoàn tiền riêng với mục đích RETURN.",
                        "Select one remaining allocated batch per intake. Inspect goods before choosing restock. Record a separate RETURN-purpose refund.",
                      )}
                    </p>
                    <Records rows={order.allocations ?? []} lang={lang} />
                    {returnChoices(order.allocations ?? []).map((line) => (
                      <ActionForm
                        key={line.batchId}
                        action="returnIntake"
                        lang={lang}
                        id={id}
                        initial={{
                          expectedVersion: order.version,
                          batchId: line.batchId,
                          qty: line.returnableQty,
                        }}
                        fieldOverrides={{
                          batchId: { options: [line.batchId] },
                          qty: { max: line.returnableQty },
                        }}
                        onSuccess={refresh}
                        onUnauthorized={onUnauthorized}
                      />
                    ))}
                  </div>
                )}
                {order.receiptsVnd > order.refundsVnd && (
                  <ActionForm
                    action="refund"
                    lang={lang}
                    id={id}
                    initial={{
                      expectedVersion: order.version,
                      amountVnd: order.returnRefundDueVnd
                        ? Math.min(
                            order.returnRefundDueVnd,
                            order.refundableVnd ?? 0,
                          )
                        : order.receiptsVnd - order.refundsVnd,
                      purpose: order.returnRefundDueVnd ? "RETURN" : "GOODWILL",
                    }}
                    onSuccess={refresh}
                    onUnauthorized={onUnauthorized}
                  />
                )}
                {!order.costsFinalized && (
                  <ActionForm
                    action="costs"
                    lang={lang}
                    id={id}
                    initial={{ expectedVersion: order.version }}
                    onSuccess={refresh}
                    onUnauthorized={onUnauthorized}
                  />
                )}
                <ActionForm
                  action="expense"
                  lang={lang}
                  initial={{
                    scope: "ORDER",
                    orderId: id,
                    expectedVersion: order.version,
                  }}
                  onSuccess={refresh}
                  onUnauthorized={onUnauthorized}
                />
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export function Admin({
  actor,
  lang,
  onUnauthorized,
}: {
  actor: Actor;
  lang: Lang;
  onUnauthorized?: () => void;
}) {
  const [section, setSection] = useState("dashboard");
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [dashboard, setDashboard] = useState<RecordRow | null>(null);
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [inventoryTab, setInventoryTab] = useState("batches");
  const [sku, setSku] = useState(skus[0]);
  const owner = actor.role === "OWNER_ADMIN";
  const endpoints: Record<string, string> = {
    dashboard: owner ? "dashboard/overview" : "dashboard/members/me",
    orders: "orders",
    inventory: `inventory/${inventoryTab}`,
    users: "users",
    products: "owner/products",
    expenses: "expenses",
    commissions: owner ? "commissions" : "commissions/me",
    audit: "audit-logs",
  };
  const endpoint = endpoints[section];
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setRows([]);
    setDashboard(null);
    apiRequest<RecordRow[] | RecordRow>(
      `${endpoint}${section === "dashboard" || section === "products" ? "" : `?page=${page}&limit=25`}`,
    )
      .then((data) => {
        if (alive) {
          if (Array.isArray(data)) setRows(data);
          else setDashboard(data);
        }
      })
      .catch((caught) => {
        if (alive) {
          setError(caught);
          if (caught instanceof ApiError && caught.status === 401)
            onUnauthorized?.();
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [endpoint, section, page, revision, onUnauthorized]);
  const refresh = () => {
    setRevision((value) => value + 1);
  };
  const form = (action: string, initial: RecordRow = {}, id = "") => (
    <ActionForm
      key={`${action}-${id}`}
      action={action}
      initial={initial}
      id={id}
      lang={lang}
      onUnauthorized={onUnauthorized}
      onSuccess={refresh}
    />
  );
  return (
    <div className="workspace">
      <aside className="sidebar">
        <p className="eyebrow">{label(actor.role, lang)}</p>
        <h2>
          {actor.displayName ?? text(lang, "Không gian quản lý", "Workspace")}
        </h2>
        <nav aria-label={text(lang, "Quản lý", "Administration")}>
          {sectionsFor(actor.role).map((item) => (
            <button
              key={item}
              className={section === item ? "active" : ""}
              aria-current={section === item ? "page" : undefined}
              onClick={() => {
                setSection(item);
                setPage(0);
                setSelected(null);
              }}
            >
              {label(item, lang)}
            </button>
          ))}
        </nav>
      </aside>
      <div className="workspace-content">
        <div className="section-heading">
          <div>
            <p className="eyebrow">SÔNG TRÀ / {label(actor.role, lang)}</p>
            <h1 className="page-title">{label(section, lang)}</h1>
          </div>
          <button className="secondary" onClick={refresh}>
            {text(lang, "Tải lại", "Refresh")}
          </button>
        </div>
        <ErrorNotice error={error} lang={lang} />
        {section === "inventory" && (
          <div className="tabs">
            {["batches", "movements"].map((tab) => (
              <button
                className={inventoryTab === tab ? "" : "secondary"}
                key={tab}
                onClick={() => {
                  setInventoryTab(tab);
                  setPage(0);
                  setSelected(null);
                }}
              >
                {tab === "batches"
                  ? text(lang, "Các lô hàng", "Batches")
                  : text(lang, "Lịch sử kho", "Movements")}
              </button>
            ))}
          </div>
        )}
        {loading ? (
          <p role="status">
            {text(lang, "Đang tải dữ liệu…", "Loading records…")}
          </p>
        ) : section === "dashboard" ? (
          dashboard && (
            <>
              <dl className="metrics">
                {Object.entries(dashboard).map(([key, value]) => (
                  <div key={key}>
                    <dt>{label(key, lang)}</dt>
                    <dd>{display(value, key, lang)}</dd>
                  </div>
                ))}
              </dl>
              <p className="notice">
                {text(
                  lang,
                  "Số liệu toàn thời gian. Biến động tiền hoạt động không phải số dư ngân hàng. Hoa hồng chỉ đủ điều kiện khi đã giao, thu đủ tiền và chốt chi phí.",
                  "All-time figures. Operating cash movement is not a bank balance. Commission requires delivery, full receipt of payment, and finalized costs.",
                )}
              </p>
            </>
          )
        ) : (
          <Records
            rows={rows}
            lang={lang}
            onSelect={
              ["orders", "users", "products"].includes(section) ||
              (section === "inventory" && inventoryTab === "batches")
                ? (row) => {
                    setSelected(row);
                    if (row.sku) setSku(String(row.sku));
                  }
                : undefined
            }
          />
        )}
        {!["dashboard", "products"].includes(section) && (
          <div className="pagination">
            <button
              className="secondary"
              disabled={loading || page === 0}
              onClick={() => {
                setPage((value) => value - 1);
                setSelected(null);
              }}
            >
              {text(lang, "Trang trước", "Previous")}
            </button>
            <span>
              {text(lang, "Trang", "Page")} {page + 1}
            </span>
            <button
              className="secondary"
              disabled={loading || rows.length < 25}
              onClick={() => {
                setPage((value) => value + 1);
                setSelected(null);
              }}
            >
              {text(lang, "Trang sau", "Next")}
            </button>
          </div>
        )}
        {section === "orders" && (
          <>
            <p className="muted">
              {text(
                lang,
                "Tạo đơn mới tại mục Cửa hàng. Mở một đơn để xử lý trạng thái và tiền thực thu.",
                "Create new orders in the Store. Open an order to manage its status and received payments.",
              )}
            </p>
            {selected && (
              <OrderDetail
                id={String(selected.id)}
                actor={actor}
                lang={lang}
                onUnauthorized={onUnauthorized}
                onChanged={refresh}
              />
            )}
          </>
        )}
        {owner && section === "inventory" && (
          <>
            <p className="notice">
              {text(
                lang,
                "Thiếu hạn dùng hoặc nhãn: lô được cách ly. Chỉ hỗ trợ điều chỉnh giảm; không tự nhập lại hàng trả.",
                "Missing expiry or label quarantines the batch. Only negative adjustments are supported; returns are not automatically restocked.",
              )}
            </p>
            <div className="action-grid">
              {form("receipt")}
              {form(
                "adjustment",
                { batchId: selected?.id ?? "" },
                String(selected?.id ?? ""),
              )}
            </div>
          </>
        )}
        {owner && section === "users" && (
          <div className="action-grid">
            {form("user")}
            {selected && selected.role === "MEMBER" && (
              <div>
                <p>
                  {String(selected.displayName)} ·{" "}
                  {String(selected.emailNormalized)}
                </p>
                <p className="muted">
                  {text(
                    lang,
                    "Thay đổi trạng thái sẽ thu hồi phiên đăng nhập của thành viên.",
                    "Changing status revokes the member's sessions.",
                  )}
                </p>
                {form(
                  "userStatus",
                  { status: selected.status },
                  String(selected.id),
                )}
                <ResetIssue
                  key={String(selected.id)}
                  id={String(selected.id)}
                  lang={lang}
                />
              </div>
            )}
          </div>
        )}
        {owner && section === "products" && (
          <div className="panel">
            <p className="notice">
              {text(
                lang,
                "Danh mục chủ cửa hàng gồm sản phẩm ngừng bán và phiên bản hiện tại. Chọn sản phẩm để cập nhật. Chưa có API tạo sản phẩm.",
                "The owner catalog includes inactive products and current versions. Select a product to update. Product creation has no API endpoint.",
              )}
            </p>
            <label>
              {text(lang, "Sản phẩm cần cập nhật", "Product to update")}
              <select
                value={sku}
                onChange={(event) => {
                  setSku(event.target.value);
                  setSelected(null);
                }}
              >
                {skus.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            {!loading &&
              rows
                .filter(
                  (row) =>
                    row.sku === sku &&
                    Number.isSafeInteger(row.version) &&
                    typeof row.active === "boolean",
                )
                .map((row) => (
                  <ActionForm
                    key={`${sku}-${row.version}`}
                    action="product"
                    lang={lang}
                    id={sku}
                    initial={ownerProductInitial(row)}
                    onSuccess={refresh}
                    onUnauthorized={onUnauthorized}
                  />
                ))}
          </div>
        )}
        {owner && section === "expenses" && (
          <div className="panel">
            {form("expense")}
            <p className="muted">
              {text(
                lang,
                "Chi phí đơn hàng cần ID và phiên bản hiện tại; có thể ghi ngay trong chi tiết đơn.",
                "Order expenses require the current order ID and version; you can record them from order details.",
              )}
            </p>
          </div>
        )}
        {section === "commissions" && (
          <>
            <p className="notice">
              {text(
                lang,
                "Bút toán có thể âm khi thu hồi hoa hồng. Chi hoa hồng thanh toán toàn bộ số dư khả dụng, không phải tổng của trang hiện tại.",
                "Clawbacks may be negative. A payout pays the full available balance, not the sum of this page.",
              )}
            </p>
            {owner && <div className="panel">{form("payout")}</div>}
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState<Lang>("vi");
  const [view, setView] = useState("store");
  const [actor, setActor] = useState<Actor | null>(null);
  const [checking, setChecking] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogError, setCatalogError] = useState<unknown>(null);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [authError, setAuthError] = useState<unknown>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem("cbst-language");
    if (saved === "en" || saved === "vi") setLang(saved);
    apiRequest<Actor>("auth/me")
      .then(setActor)
      .catch((caught) => {
        if (!(caught instanceof ApiError && caught.status === 401))
          setAuthError(caught);
      })
      .finally(() => setChecking(false));
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("cbst-language", lang);
  }, [lang]);
  useEffect(() => {
    let alive = true;
    setCatalogLoading(true);
    setCatalogError(null);
    apiRequest<Product[]>("products")
      .then((value) => {
        if (alive) setProducts(value);
      })
      .catch((caught) => {
        if (alive) {
          setProducts([]);
          setCatalogError(caught);
        }
      })
      .finally(() => {
        if (alive) setCatalogLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [catalogRevision]);
  const unauthorized = useRef(() => {
    setActor(null);
    setView("login");
    setAuthError(new ApiError("SESSION_INVALID", 401));
  }).current;
  async function logout() {
    setLoggingOut(true);
    setAuthError(null);
    try {
      await apiRequest("auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      setActor(null);
      setView("store");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        setActor(null);
        setView("store");
      } else setAuthError(caught);
    } finally {
      setLoggingOut(false);
    }
  }
  return (
    <>
      <a className="skip" href="#main">
        {text(lang, "Đến nội dung", "Skip to content")}
      </a>
      <header className="site-header">
        <a className="brand" href="#" onClick={() => setView("store")}>
          CÁ BỐNG <span>SÔNG TRÀ</span>
        </a>
        <nav aria-label={text(lang, "Điều hướng chính", "Main navigation")}>
          <button className="nav-link" onClick={() => setView("store")}>
            {text(lang, "Cửa hàng", "Store")}
          </button>
          {actor && (
            <button className="nav-link" onClick={() => setView("admin")}>
              {text(lang, "Quản lý", "Workspace")}
            </button>
          )}
          {actor ? (
            <button className="nav-link" disabled={loggingOut} onClick={logout}>
              {text(lang, "Đăng xuất", "Sign out")}
            </button>
          ) : (
            <button
              className="nav-link"
              disabled={checking}
              onClick={() => setView("login")}
            >
              {checking
                ? text(lang, "Đang kiểm tra…", "Checking…")
                : text(lang, "Đăng nhập", "Sign in")}
            </button>
          )}
          <button
            className="language"
            aria-label={text(
              lang,
              "Switch to English",
              "Chuyển sang tiếng Việt",
            )}
            onClick={() => setLang(lang === "vi" ? "en" : "vi")}
          >
            {lang === "vi" ? "EN" : "VI"}
          </button>
        </nav>
      </header>
      <main id="main">
        <ErrorNotice error={authError} lang={lang} />
        {view === "store" && (
          <>
            <ErrorNotice error={catalogError} lang={lang} />
            {catalogLoading && (
              <p role="status">
                {text(lang, "Đang tải sản phẩm…", "Loading products…")}
              </p>
            )}
            {catalogError && (
              <button
                className="secondary"
                onClick={() => setCatalogRevision((value) => value + 1)}
              >
                {text(lang, "Thử tải lại sản phẩm", "Retry catalog")}
              </button>
            )}
            <Storefront
              key={actor?.id ?? "guest"}
              lang={lang}
              products={products}
              actor={actor}
              onCreated={() => {}}
            />
          </>
        )}
        {view === "login" && (
          <section className="login">
            <div>
              <p className="eyebrow">
                SÔNG TRÀ / {text(lang, "NỘI BỘ", "TEAM")}
              </p>
              <h1 className="page-title">
                {text(lang, "Chào mừng trở lại", "Welcome back")}
              </h1>
              <p>
                {text(
                  lang,
                  "Dành cho chủ cửa hàng và thành viên được cấp tài khoản. Không có đăng ký công khai.",
                  "For the owner and provisioned members. Public registration is not available.",
                )}
              </p>
              <details>
                <summary>
                  {text(
                    lang,
                    "Có mã khôi phục mật khẩu?",
                    "Have a password reset token?",
                  )}
                </summary>
                <ActionForm
                  action="resetPassword"
                  lang={lang}
                  onSuccess={() => {
                    setActor(null);
                    setAuthError(null);
                  }}
                />
                <p>
                  {text(
                    lang,
                    "Sau khi đổi mật khẩu, đăng nhập lại bằng mật khẩu mới.",
                    "After resetting, sign in with your new password.",
                  )}
                </p>
              </details>
            </div>
            <ActionForm
              action="login"
              lang={lang}
              onSuccess={async () => {
                const profile = await apiRequest<Actor>("auth/me");
                setActor(profile);
                setAuthError(null);
                setView("admin");
              }}
            />
          </section>
        )}
        {view === "admin" && actor && (
          <Admin
            key={actor.id}
            actor={actor}
            lang={lang}
            onUnauthorized={unauthorized}
          />
        )}
      </main>
      <footer>
        <nav aria-label="Thông tin / Information">
          <a href="/privacy">Quyền riêng tư / Privacy</a>
          {" · "}
          <a href="/terms">Điều kiện / Terms</a>
          {" · "}
          <a href="/contact">Liên hệ / Contact</a>
          {" · "}
          <a href="/label-safety">Nhãn & an toàn / Label safety</a>
        </nav>
        <span className="brand">CÁ BỐNG SÔNG TRÀ</span>
        <p>
          {text(
            lang,
            "Hương vị Quảng Ngãi. Thông tin đơn hàng được xử lý an toàn qua cùng tên miền.",
            "The taste of Quang Ngai. Order information is handled through this same-origin service.",
          )}
        </p>
        <span>VI / EN · VND</span>
      </footer>
    </>
  );
}
