"use client";

import { adminSection, navigate } from "../lib/navigation";
import { ContactButtons } from "../lib/components/ContactButtons";
import { LandingImage } from "../lib/components/LandingImage";
import { MemberCommissions } from "../lib/components/MemberCommissions";

import { useContext, useEffect, useRef, useState, type FormEvent } from "react";
import {
  useQuery,
  useQueryClient,
  QueryClientProvider,
  QueryClientContext,
} from "@tanstack/react-query";
import {
  getSharedQueryClient,
  makeAdminQueryKey,
  getCachePolicy,
  invalidateAdminQueries,
  clearAdminCache,
  fetchSectionData,
  fetchDashboardOrders,
  fetchUsersList,
  type MutationAction,
} from "../lib/query-cache";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Wallet,
  BadgePercent,
  Users,
  ScrollText,
  Plus,
  Search,
  Bell,
  RefreshCw,
  Banknote,
  TrendingUp,
  CalendarDays,
  LogOut,
  ChevronDown,
  ChevronLeft,
  Check,
  Copy,
  Flame,
  Truck,
  MessageCircle,
  PhoneCall,
  UtensilsCrossed,
  Salad,
  HeartHandshake,
  ShieldCheck,
  Snowflake,
  ZoomIn,
  Eye,
  X,
  BarChart3,
  PieChart,
  Award,
  Layers,
  ShoppingBag,
  AlertCircle,
  KeyRound,
  PackagePlus,
  CheckCircle2,
  Clock,
  Menu,
  ChevronRight,
  SlidersHorizontal,
  Image as ImageIcon,
  UploadCloud,
  ExternalLink,
  Link as LinkIcon,
  Trash2,
  Settings,
  RotateCcw,
  Sparkles,
  Tag,
  Ticket,
} from "lucide-react";
import { createCheckout } from "../lib/checkout-retry";
import { PricingReview, requestQuote, guardedPayload } from "../lib/components/PricingReview";
import type { PricingQuote } from "../lib/pricing";
import { PromotionManager } from "../lib/components/PromotionManager";
import { Modal } from "../lib/components/Modal";
import { effectivePrice, watchPricing } from "../lib/catalog-pricing";
import {
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
  type Field,
} from "../lib/commerce";
import { errorText, label, money, text } from "../lib/i18n";
import type { Actor, Batch, Lang, MemberUser, Order, Product, RecordRow } from "../lib/types";
import { InventoryManager } from "../lib/components/InventoryManager";
import { ProductManager, type OwnerProductRow } from "../lib/components/ProductManager";
import { ExpenseManager, type ExpenseRecord } from "../lib/components/ExpenseManager";
import { UserManager } from "../lib/components/UserManager";
import { CommissionManager, type CommissionLedgerEntry } from "../lib/components/CommissionManager";
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
  if (field.type === "hidden") {
    return (
      <input
        type="hidden"
        name={field.name}
        defaultValue={String(value ?? "")}
      />
    );
  }
  const title = field[lang];
  return (
    <label className={field.type === "checkbox" ? "check" : ""}>
      <span>
        {title}
        {field.optional ? text(lang, " (không bắt buộc)", " (optional)") : <> <span className="required-mark" aria-hidden="true">*</span></>}
      </span>
      {field.options ? (
        <select
          name={field.name}
          defaultValue={String(
            value ??
              (typeof field.options[0] === "object"
                ? field.options[0].value
                : field.options[0]) ??
              "",
          )}
          onChange={(event) => onChange?.(event.target.value)}
          required={!field.optional}
        >
          {field.options.map((option) => {
            const optVal =
              typeof option === "object" ? option.value : option;
            const optLabel =
              typeof option === "object" ? option.label : label(option, lang);
            return (
              <option key={optVal} value={optVal}>
                {optLabel}
              </option>
            );
          })}
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
  hideTitle = false,
  onCancel,
  onSuccess,
  onUnauthorized,
}: {
  action: string;
  lang: Lang;
  id?: string;
  initial?: RecordRow;
  statusOptions?: string[];
  fieldOverrides?: Record<string, Partial<Field>>;
  hideTitle?: boolean;
  onCancel?: () => void;
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
      await onSuccess(result);
      setSuccess(true);
    } catch (caught) {
      setSuccess(false);
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
      {!hideTitle && <h3>{definition[lang]}</h3>}
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
        {onCancel ? (
          <div className="cbst-modal-actions" style={{ marginTop: 16, justifyContent: "flex-end" }}>
            <button
              type="button"
              className="secondary"
              onClick={onCancel}
              disabled={busy}
            >
              {text(lang, "Hủy / Đóng", "Cancel / Close")}
            </button>
            <button type="submit" disabled={busy}>
              {busy ? text(lang, "Đang xử lý…", "Processing…") : definition[lang]}
            </button>
          </div>
        ) : (
          <button type="submit">
            {busy ? text(lang, "Đang xử lý…", "Processing…") : definition[lang]}
          </button>
        )}
      </fieldset>
      <ErrorNotice error={error} lang={lang} />
      {success && !error && (
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

/** Matches BE MediaAsset schema (models.ts) */
export interface MediaItem {
  id: string;
  url: string;
  title: string;
  tag: string;
  description?: string;
  /** Cloudinary public_id — populated after upload */
  publicId?: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  createdAt: string;
  updatedAt?: string;
}

/**
 * No hardcoded local-path fallbacks.
 * All image URLs must come from the BE (MongoDB mediaSlots via /api/media).
 * Keeping the export so referencing code compiles; it returns an empty map.
 */
export const DEFAULT_PRODUCT_IMAGES: Record<string, string> = {};

/**
 * Gallery is seeded from BE (GET /api/media → gallery[]).
 * No hardcoded local paths — start empty so stale local data never masks BE data.
 */
export const INITIAL_MEDIA_ITEMS: MediaItem[] = [];

export const MEDIA_SLOTS = [
  { key: "hero-banner", labelVi: "Banner chính đầu trang (Hero)", labelEn: "Hero Main Banner", descVi: "Ảnh lớn xuất hiện ngay đầu trang bên cạnh lời chào và nút đặt mua", descEn: "Large prominent image at the top hero section of the landing page" },
  { key: "CBST-300", labelVi: "Hũ nhỏ 300g (Thẻ sản phẩm)", labelEn: "Small 300g Jar", descVi: "Ảnh thẻ sản phẩm hũ 300g trong danh mục sản phẩm", descEn: "Product card image for 300g jar" },
  { key: "CBST-400", labelVi: "Hũ vừa 400g (Thẻ sản phẩm)", labelEn: "Medium 400g Jar", descVi: "Ảnh thẻ sản phẩm hũ 400g trong danh mục sản phẩm", descEn: "Product card image for 400g jar" },
  { key: "CBST-600", labelVi: "Hũ lớn 600g (Thẻ sản phẩm)", labelEn: "Large 600g Jar", descVi: "Ảnh thẻ sản phẩm hũ 600g trong danh mục sản phẩm", descEn: "Product card image for 600g jar" },
  { key: "group-3", labelVi: "Ảnh thật bộ 3 hũ (So sánh)", labelEn: "Group 3 Jars Photo", descVi: "Ảnh chụp thực tế bộ 3 hũ trong khung So sánh quy cách & phóng to", descEn: "Real photo of 3 jars in specs comparison & zoom banner" },
  { key: "bang-size", labelVi: "Bảng quy cách kích thước", labelEn: "Size & Dimensions poster", descVi: "Ảnh hiển thị khi khách bấm nút 'Xem Bảng kích thước'", descEn: "Dimensions poster in comparison section" },
  { key: "bang-gia", labelVi: "Bảng giá niêm yết", labelEn: "Official Price Table", descVi: "Ảnh hiển thị khi khách bấm nút 'Xem Bảng giá niêm yết'", descEn: "Official price table poster" },
  { key: "zalo-qr", labelVi: "Mã QR Zalo Hoài Bảo", labelEn: "Zalo QR Code", descVi: "Mã QR kết nối Zalo 070 2478 561 trong khung liên hệ", descEn: "Zalo chat connection QR code" },
];

export function Storefront({
  lang,
  products: initialProducts,
  actor,
  onCreated,
  onGoToAdmin,
  initialImages,
}: {
  lang: Lang;
  products: Product[];
  actor?: Actor | null;
  onCreated: (result: RecordRow) => void;
  onGoToAdmin?: () => void;
  initialImages?: Record<string, string>;
}) {
  const [products, setProducts] = useState(initialProducts);
  useEffect(() => { setProducts(initialProducts); }, [initialProducts]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<RecordRow | null>(null);
  const [pricing, setPricing] = useState<{ quote: PricingQuote; signature: string; confirmed: boolean; stale?: boolean } | null>(null);
  const unresolved = useRef<{ payload: ReturnType<typeof guardedPayload>; signature: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (!unresolved.current) setPricing(null);
      apiRequest<Product[]>("products").then(data => { if (alive) setProducts(data); }).catch(e => { if (alive) setError(e); });
    };
    const stop = watchPricing(products.map(p => p.promotionEndsAt), refresh);
    return () => { alive = false; stop(); };
  }, [products]);
  const mutate = useRef<ReturnType<typeof createCheckout> | null>(null);
  const busyRef = useRef(false);

  // Interactive Zalo Message Builder State
  const [msgSize, setMsgSize] = useState<"300" | "400" | "600" | "combo">("400");
  const [copiedMsg, setCopiedMsg] = useState(false);

  // Lightbox Modal State
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // Dynamic Product & Landing Page Image Repository State
  // Source of truth: BE mediaSlots (fetched via /api/media).
  // initialImages (SSR-injected) takes priority; localStorage is a read-through cache.
  const [productImages, setProductImages] = useState<Record<string, string>>(() => {
    if (initialImages && Object.keys(initialImages).length > 0) {
      return { ...initialImages };
    }
    return {};
  });

  useEffect(() => {
    // Refresh from BE first — BE is authoritative, localStorage is just a cache.
    fetch("/api/media")
      .then((res) => res.json())
      .then((resData) => {
        if (resData?.success && resData?.images && Object.keys(resData.images).length > 0) {
          setProductImages((prev) => ({ ...prev, ...resData.images }));
          try {
            localStorage.setItem("cbst_product_images", JSON.stringify(resData.images));
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {});

    const handleUpdate = () => {
      try {
        const saved = localStorage.getItem("cbst_product_images");
        if (saved) setProductImages(JSON.parse(saved));
      } catch {
        /* ignore */
      }
    };

    window.addEventListener("cbst_images_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("cbst_images_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Mobile Product Carousel & Compare Tabs State
  const [activeProductTab, setActiveProductTab] = useState<string>("CBST-300");
  const [selectedCompareSku, setSelectedCompareSku] = useState<string>("CBST-400");
  const [showDimensionDetails, setShowDimensionDetails] = useState<boolean>(false);

  const total = products.reduce(
    (sum, product) => sum + effectivePrice(product) * (cart[product.sku] ?? 0),
    0,
  );

  const p300 = products.find((p) => p.sku === "CBST-300" || p.netWeightG === 300);
  const p400 = products.find((p) => p.sku === "CBST-400" || p.netWeightG === 400);
  const p600 = products.find((p) => p.sku === "CBST-600" || p.netWeightG === 600);

  const getGeneratedMessage = () => {
    if (lang === "vi") {
      switch (msgSize) {
        case "300":
          return `Chào Shop Cá Bống Sông Trà, mình muốn đặt 1 hũ 300g${p300 ? ` (${money(p300.retailPriceVnd, lang)})` : ""}. Tư vấn phí ship và thời gian giao giúp mình nhé!`;
        case "400":
          return `Chào Shop Cá Bống Sông Trà, mình muốn đặt 1 hũ 400g${p400 ? ` (${money(p400.retailPriceVnd, lang)})` : ""}. Tư vấn phí ship và thời gian giao giúp mình nhé!`;
        case "600":
          return `Chào Shop Cá Bống Sông Trà, mình muốn đặt 1 hũ 600g${p600 ? ` (${money(p600.retailPriceVnd, lang)})` : ""}. Tư vấn phí ship và thời gian giao giúp mình nhé!`;
        case "combo":
          return "Chào Shop Cá Bống Sông Trà, mình muốn đặt combo trải nghiệm 3 hũ (300g + 400g + 600g). Tư vấn phí ship giúp mình nhé!";
      }
    } else {
      switch (msgSize) {
        case "300":
          return `Hello Ca Bong Song Tra Shop, I would like to order 1 jar 300g${p300 ? ` (${money(p300.retailPriceVnd, lang)})` : ""}. Please advise on delivery fee and schedule!`;
        case "400":
          return `Hello Ca Bong Song Tra Shop, I would like to order 1 jar 400g${p400 ? ` (${money(p400.retailPriceVnd, lang)})` : ""}. Please advise on delivery fee and schedule!`;
        case "600":
          return `Hello Ca Bong Song Tra Shop, I would like to order 1 jar 600g${p600 ? ` (${money(p600.retailPriceVnd, lang)})` : ""}. Please advise on delivery fee and schedule!`;
        case "combo":
          return "Hello Ca Bong Song Tra Shop, I would like to order a 3-jar combo (300g + 400g + 600g). Please advise on delivery!";
      }
    }
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(getGeneratedMessage());
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2200);
    } catch {
      setCopiedMsg(false);
    }
  };

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
      const signature = JSON.stringify(payload);
      if (!unresolved.current && (!pricing || pricing.signature !== signature || !pricing.confirmed)) {
        setPricing({ quote: await requestQuote(payload, false), signature, confirmed: false });
        return;
      }
      const guarded = unresolved.current?.payload ?? guardedPayload(payload, pricing!.quote, false);
      if (unresolved.current && unresolved.current.signature !== signature) throw new Error("CHECKOUT_RECONCILIATION_REQUIRED");
      if (!mutate.current) {
        try {
          mutate.current = createCheckout(window.sessionStorage);
        } catch {
          throw new Error("RETRY_STORAGE_UNAVAILABLE");
        }
      }
      unresolved.current = { payload: guarded, signature };
      const result = (await mutate.current(guarded)) as RecordRow;
      unresolved.current = null;
      setPricing(null);
      setReceipt(result);
      setCart({});
      form.reset();
      onCreated(result);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409 && caught.code === "PRICE_STALE_CONFIRMATION_REQUIRED") {
        const signature = unresolved.current?.signature ?? "";
        unresolved.current = null;
        setPricing(caught.quote ? { quote: caught.quote, signature, confirmed: false, stale: true } : null);
      }
      if (caught instanceof Error && caught.message === "CHECKOUT_RECONCILIATION_REQUIRED") {
        unresolved.current = null;
      }
      setError(caught);
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }

  return (
    <>
      {/* SECTION 1: HERO */}
      <section className="hero" id="hero">
        <div>
          <div className="eyebrow-pill">
            <span>✦</span> {text(lang, "Đặc sản Quảng Ngãi • Có hàng tại TP.HCM", "Quang Ngai Specialty • In Stock in HCMC")}
          </div>
          <h1>{text(lang, "Cá bống Sông Trà —\nĐậm đà đưa cơm", "Song Tra Goby —\nRich & Authentic Flavor")}</h1>
          <p className="intro">
            {text(
              lang,
              "Một món mặn quen thuộc trong bữa cơm gia đình xứ Quảng. Dễ chọn với 3 hũ 300g, 400g và 600g, xem giá rõ ràng và đặt hàng nhanh chóng.",
              "A cherished traditional delicacy of Quang Ngai home dining. Easy to choose with 3 jars 300g, 400g, and 600g, clear pricing, and fast delivery.",
            )}
          </p>
          <div className="hero-actions">
            <a className="button" href="#products">
              <span>{text(lang, "Khám phá 3 size", "Explore 3 sizes")}</span>
              <span aria-hidden="true">↓</span>
            </a>
            <a className="button secondary" href="#pricing-compare">
              <span>{text(lang, "Xem bảng giá & kích thước", "View size & price table")}</span>
            </a>
          </div>
          <div className="hero-trust">
            <div className="trust-item">
              <span className="icon"><Check size={16} strokeWidth={2.5} /></span>
              <span>{text(lang, "300g • 400g • 600g", "300g • 400g • 600g")}</span>
            </div>
            <div className="trust-item">
              <span className="icon"><Check size={16} strokeWidth={2.5} /></span>
              <span>{text(lang, "Khối lượng tịnh cá và nước kho", "Net weight: fish & braising sauce")}</span>
            </div>
            <div className="trust-item">
              <span className="icon"><Check size={16} strokeWidth={2.5} /></span>
              <span>{text(lang, "Ưu tiên giao Thủ Đức, Q.9, Dĩ An", "Fast delivery in Thu Duc, D9, Di An")}</span>
            </div>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <LandingImage
            src={
              productImages["hero-banner"] ||
              productImages["group-3"]
            }
            alt="Cá bống Sông Trà Quảng Ngãi"
            className="hero-art-img"
            fetchPriority="high"
          />
        </div>
      </section>

      {/* SECTION 2: MINI TRUST / FEATURE STRIP */}
      <section className="mini-trust-strip" aria-label={text(lang, "Cam kết chất lượng", "Quality commitments")}>
        <div className="strip-grid">
          <div className="strip-item">
            <span className="strip-icon"><Package size={20} strokeWidth={1.8} /></span>
            <div>
              <strong>{text(lang, "Ba size rõ ràng", "3 Clear Sizes")}</strong>
              <p>{text(lang, "300g, 400g và 600g dễ chọn theo khẩu phần gia đình.", "300g, 400g, and 600g for every family size.")}</p>
            </div>
          </div>
          <div className="strip-item">
            <span className="strip-icon"><Flame size={20} strokeWidth={1.8} /></span>
            <div>
              <strong>{text(lang, "Đậm vị quê nhà", "Authentic Heritage Taste")}</strong>
              <p>{text(lang, "Cá bống sông kho tiêu ớt săn chắc, đậm đà đưa cơm.", "Firm river goby braised with pepper and chili.")}</p>
            </div>
          </div>
          <div className="strip-item">
            <span className="strip-icon"><Truck size={20} strokeWidth={1.8} /></span>
            <div>
              <strong>{text(lang, "Giao tại TP.HCM", "Stock in HCMC")}</strong>
              <p>{text(lang, "Hàng có sẵn, ưu tiên giao nhanh Thủ Đức, Q.9, Dĩ An.", "In stock, fast delivery in Thu Duc, D9, Di An.")}</p>
            </div>
          </div>
          <div className="strip-item">
            <span className="strip-icon"><MessageCircle size={20} strokeWidth={1.8} /></span>
            <div>
              <strong>{text(lang, "Tư vấn Zalo trực tiếp", "Direct Zalo Support")}</strong>
              <p>{text(lang, "Hỗ trợ nhanh, chu đáo qua số 070 2478 561.", "Fast and friendly support via 070 2478 561.")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: 01 / DANH MỤC SẢN PHẨM */}
      <div className="section-heading" id="products">
        <div>
          <p className="eyebrow">
            {text(lang, "01 / DANH MỤC SẢN PHẨM", "01 / PRODUCT CATALOG")}
          </p>
          <h2>
            {text(lang, "Chọn hũ phù hợp cho bữa cơm nhà", "Choose the right size for your meal")}
          </h2>
        </div>
        <p>
          {text(
            lang,
            "Khối lượng tịnh cá và nước kho (không bao gồm bao bì/vỏ hũ). Giá niêm yết rõ ràng từ hệ thống cửa hàng.",
            "Net weight includes fish and sauce (excluding jar). Transparent pricing verified by the shop system.",
          )}
        </p>
      </div>

      {products.length > 0 && (
        <div className="product-mobile-pills" role="tablist" aria-label="Chọn quy cách hũ">
          {products.map((p) => {
            const shortLabel =
              p.netWeightG === 300
                ? text(lang, "Hũ nhỏ 300g", "Small 300g")
                : p.netWeightG === 400
                  ? text(lang, "Hũ vừa 400g", "Medium 400g")
                  : text(lang, "Hũ lớn 600g", "Large 600g");
            const priceAbbr = Math.round(p.retailPriceVnd / 1000) + "k";
            const isActive = activeProductTab === p.sku;
            return (
              <button
                key={p.sku}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`product-pill-btn ${isActive ? "active" : ""}`}
                onClick={() => {
                  setActiveProductTab(p.sku);
                  const el = document.getElementById(`prod-card-${p.sku}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                }}
              >
                <span>{shortLabel}</span>
                <small>{priceAbbr}</small>
              </button>
            );
          })}
        </div>
      )}

      <section
        className="product-grid"
        aria-label={text(lang, "Sản phẩm", "Products")}
      >
        {products.map((product) => {
          const imgSrc =
            productImages[product.sku] ||
            DEFAULT_PRODUCT_IMAGES[product.sku] || "";

          return (
            <article className="product" key={product.sku} id={`prod-card-${product.sku}`}>
              <div
                className="product-image-container"
                onClick={() => setLightboxImg(imgSrc)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setLightboxImg(imgSrc);
                }}
                aria-label={text(
                  lang,
                  `Xem ảnh lớn ${productName(product, lang)}`,
                  `View large photo of ${productName(product, lang)}`,
                )}
                title={text(lang, "Nhấn để phóng to ảnh chi tiết", "Click to enlarge photo")}
              >
                <LandingImage
                  src={imgSrc}
                  alt={productName(product, lang)}
                  className="product-card-img"
                  loading="lazy"
                />
                <span className="zoom-hint">
                  <ZoomIn size={14} strokeWidth={2} />
                  {text(lang, "Phóng to", "Zoom")}
                </span>
                <span className="product-weight-badge">{product.netWeightG}g</span>
              </div>
            <p className="eyebrow">{product.sku}</p>
            <h3>
              <a href={`/products/${product.sku}`}>
                {productName(product, lang)}
              </a>
            </h3>
            <p className="net-weight">
              {text(
                lang,
                `Khối lượng tịnh: ${product.netWeightG}g (cá & nước kho)`,
                `Net weight: ${product.netWeightG}g (fish & sauce)`,
              )}
            </p>
            {effectivePrice(product) < product.retailPriceVnd && <del>{money(product.retailPriceVnd, lang)}</del>}
            <strong>{money(effectivePrice(product), lang)}</strong>
            {product.promotionEndsAt && <small>{text(lang, "Ket thuc", "Ends")}: {new Date(product.promotionEndsAt).toLocaleString(lang)}</small>}
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
            <button
              type="button"
              className="button"
              style={{ marginTop: 12, width: "100%" }}
              disabled={busy}
              onClick={() => {
                setReceipt(null);
                setCart((prev) => ({
                  ...prev,
                  [product.sku]: (prev[product.sku] ?? 0) > 0 ? prev[product.sku] : 1,
                }));
                const checkoutElem = document.getElementById("checkout");
                if (checkoutElem) checkoutElem.scrollIntoView({ behavior: "smooth" });
              }}
            >
              {text(lang, "Chọn mua", "Order this size")}
            </button>
          </article>
          );
        })}
      </section>

      {products.length > 0 && (
        <div className="product-mobile-footer-nav">
          <div className="product-swipe-hint">
            <span>{text(lang, "← Vuốt ngang xem 3 hũ →", "← Swipe to see 3 jars →")}</span>
          </div>
          <div className="product-dots" aria-hidden="true">
            {products.map((p) => (
              <button
                key={p.sku}
                type="button"
                className={`product-dot ${activeProductTab === p.sku ? "active" : ""}`}
                onClick={() => {
                  setActiveProductTab(p.sku);
                  const el = document.getElementById(`prod-card-${p.sku}`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                }}
                aria-label={`Xem sản phẩm ${p.sku}`}
              />
            ))}
          </div>
        </div>
      )}

      {!products.length && (
        <p className="notice">
          {text(
            lang,
            "Chưa có sản phẩm để đặt. Không sử dụng giá minh họa.",
            "No products are available to order. No sample prices are used.",
          )}
        </p>
      )}

      {/* SECTION 4: 02 / BẢNG SO SÁNH & BẢNG GIÁ */}
      {(() => {
        const compareItems = [
          {
            sku: "CBST-300",
            weightG: 300,
            labelVi: "Hũ nhỏ 300g",
            labelEn: "Small 300g Jar",
            tagVi: "Hũ nhỏ",
            tagEn: "Small",
            priceVnd: p300?.retailPriceVnd,
            mealsVi: "~2 – 3 bữa ăn",
            mealsEn: "~2 - 3 meals",
            heightCm: "~9.5 cm",
            diameterCm: "~8.5 cm",
            bestForVi: "Người độc thân, ăn thử",
            bestForEn: "Single person, first taste",
            msgKey: "300" as const,
          },
          {
            sku: "CBST-400",
            weightG: 400,
            labelVi: "Hũ vừa 400g",
            labelEn: "Medium 400g Jar",
            tagVi: "Hũ vừa",
            tagEn: "Medium",
            priceVnd: p400?.retailPriceVnd,
            mealsVi: "~4 – 5 bữa ăn",
            mealsEn: "~4 - 5 meals",
            heightCm: "~11.5 cm",
            diameterCm: "~8.5 cm",
            bestForVi: "Gia đình nhỏ 2 – 3 người",
            bestForEn: "Small family 2-3 people",
            msgKey: "400" as const,
          },
          {
            sku: "CBST-600",
            weightG: 600,
            labelVi: "Hũ lớn 600g",
            labelEn: "Large 600g Jar",
            tagVi: "Hũ lớn",
            tagEn: "Large",
            priceVnd: p600?.retailPriceVnd,
            mealsVi: "~6 – 8 bữa ăn",
            mealsEn: "~6 - 8 meals",
            heightCm: "~13.5 cm",
            diameterCm: "~9.5 cm",
            bestForVi: "Gia đình 4 – 6 người, làm quà",
            bestForEn: "Family 4-6 people, gifting",
            msgKey: "600" as const,
          },
        ];

        const selectedCompare =
          compareItems.find((item) => item.sku === selectedCompareSku) || compareItems[1];

        return (
          <section className="compare-section" id="pricing-compare">
            <div className="section-heading">
              <div>
                <p className="eyebrow">{text(lang, "02 / SO SÁNH KÍCH THƯỚC HŨ", "02 / JAR SIZE COMPARISON")}</p>
                <h2>{text(lang, "So sánh kích thước hũ & bảng giá chi tiết", "Compare jar sizes & detailed pricing")}</h2>
              </div>
              <p>
                {text(
                  lang,
                  "Hình ảnh thực tế 3 kích thước hũ giúp bạn dễ dàng chọn đúng khẩu phần vừa vặn nhất cho bữa cơm gia đình.",
                  "Authentic photographs of the 3 jar sizes help you easily pick the right portion for your dining table.",
                )}
              </p>
            </div>

            <div className="compare-showcase">
              {/* CỘT TRÁI (Desktop 60-65% / Mobile Trước): ẢNH THẬT 3 HŨ LỚN & RÕ NÉT */}
              <div className="compare-visual-stage">
                <div
                  className="compare-image-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setLightboxImg(productImages["group-3"] || null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setLightboxImg(productImages["group-3"] || null);
                  }}
                  title={text(lang, "Nhấn để phóng to ảnh chụp thực tế 3 hũ", "Click to enlarge 3-jar photo")}
                >
                  <LandingImage
                    src={productImages["group-3"]}
                    alt="Ảnh thật bộ 3 hũ cá bống Sông Trà 300g, 400g, 600g"
                    className="compare-stage-img"
                    loading="lazy"
                  />
                  <span className="compare-zoom-pill">
                    <ZoomIn size={15} strokeWidth={2} />
                    {text(lang, "Nhấn để phóng to ảnh", "Click to enlarge")}
                  </span>
                  <div className="compare-stage-size-tags">
                    <span className={`stage-tag ${selectedCompareSku === "CBST-300" ? "active" : ""}`}>300g</span>
                    <span className={`stage-tag ${selectedCompareSku === "CBST-400" ? "active" : ""}`}>400g</span>
                    <span className={`stage-tag ${selectedCompareSku === "CBST-600" ? "active" : ""}`}>600g</span>
                  </div>
                </div>

                {/* Các nút xem nhanh: Bảng kích thước / Bảng giá / Ảnh chụp thật */}
                <div className="compare-quick-actions">
                  <button
                    type="button"
                    className="compare-quick-btn"
                    onClick={() => {
                      setLightboxImg(productImages[selectedCompare.sku] || null);
                    }}
                  >
                    <Eye size={14} strokeWidth={2} />
                    <span>{text(lang, `Xem ảnh riêng hũ ${selectedCompare.weightG}g`, `View ${selectedCompare.weightG}g jar`)}</span>
                  </button>
                  <button
                    type="button"
                    className="compare-quick-btn"
                    onClick={() => setLightboxImg(productImages["group-3"] || null)}
                  >
                    <ZoomIn size={14} strokeWidth={2} />
                    <span>{text(lang, "Ảnh thực tế 3 hũ", "3-Jar Photo")}</span>
                  </button>
                  <button
                    type="button"
                    className="compare-quick-btn"
                    onClick={() => setLightboxImg(productImages["bang-size"] || "/images/bang-size.png")}
                  >
                    <SlidersHorizontal size={14} strokeWidth={2} />
                    <span>{text(lang, "Bảng kích thước (cm)", "Dimensions (cm)")}</span>
                  </button>
                  <button
                    type="button"
                    className="compare-quick-btn"
                    onClick={() => setLightboxImg(productImages["bang-gia"] || "/images/bang-gia.png")}
                  >
                    <ScrollText size={14} strokeWidth={2} />
                    <span>{text(lang, "Bảng giá niêm yết", "Official Pricing")}</span>
                  </button>
                </div>
              </div>

              {/* CỘT PHẢI (Desktop 35-40% / Mobile Sau): BẢNG CHỌN SIZE GỌN GÀNG & 1 NÚT ĐẶT HÀNG */}
              <div className="compare-picker-panel">
                <div className="picker-header">
                  <span className="picker-eyebrow">{text(lang, "LỰA CHỌN KHẨU PHẦN", "PORTION SELECTION")}</span>
                  <h3 className="picker-title">{text(lang, "Chọn kích thước phù hợp", "Choose your jar size")}</h3>
                </div>

                {/* 3 Nút chọn size nhỏ gọn, dễ bấm */}
                <div className="compare-size-selector" role="radiogroup" aria-label={text(lang, "Chọn kích thước hũ", "Select jar size")}>
                  {compareItems.map((item) => {
                    const isSelected = selectedCompareSku === item.sku;
                    return (
                      <button
                        key={item.sku}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`compare-size-pill ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedCompareSku(item.sku)}
                      >
                        <span className="pill-size">{item.weightG}g</span>
                        {item.priceVnd !== undefined && (
                          <span className="pill-price">{money(item.priceVnd, lang)}</span>
                        )}
                        {isSelected && <span className="pill-check"><Check size={14} strokeWidth={2.5} /></span>}
                      </button>
                    );
                  })}
                </div>

                {/* Card thông tin chi tiết của size đang chọn */}
                <div className="compare-selected-card">
                  <div className="selected-card-header">
                    <div>
                      <h4 className="selected-size-name">{lang === "vi" ? selectedCompare.labelVi : selectedCompare.labelEn}</h4>
                      <p className="selected-weight-note">
                        {text(lang, "Khối lượng tịnh cá & nước kho (không bao gồm hũ)", "Net weight: fish & sauce (excludes jar)")}
                      </p>
                    </div>
                    {selectedCompare.priceVnd !== undefined && (
                      <div className="selected-price-tag">
                        {money(selectedCompare.priceVnd, lang)}
                      </div>
                    )}
                  </div>

                  <div className="selected-specs-grid">
                    <div className="spec-pill-item">
                      <span className="spec-label">{text(lang, "Khẩu phần ước tính", "Estimated meals")}</span>
                      <strong className="spec-value">{lang === "vi" ? selectedCompare.mealsVi : selectedCompare.mealsEn}</strong>
                    </div>
                    <div className="spec-pill-item">
                      <span className="spec-label">{text(lang, "Phù hợp nhất", "Best suited for")}</span>
                      <strong className="spec-value">{lang === "vi" ? selectedCompare.bestForVi : selectedCompare.bestForEn}</strong>
                    </div>
                  </div>

                  {/* Mục mở rộng thông số kỹ thuật (Chiều cao, đường kính) */}
                  <div className="compare-dimension-toggle">
                    <button
                      type="button"
                      className="dimension-toggle-btn"
                      onClick={() => setShowDimensionDetails(!showDimensionDetails)}
                      aria-expanded={showDimensionDetails}
                    >
                      <span>
                        {showDimensionDetails
                          ? text(lang, "Thu gọn thông số kích thước ▲", "Hide dimension details ▲")
                          : text(lang, "Xem kích thước chi tiết (chiều cao, đường kính) ▼", "View jar dimensions (height, diameter) ▼")}
                      </span>
                      <ChevronDown
                        size={16}
                        strokeWidth={2}
                        style={{ transform: showDimensionDetails ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}
                      />
                    </button>

                    {showDimensionDetails && (
                      <div className="dimension-details-table">
                        <div className="dim-row">
                          <span>{text(lang, "Chiều cao hũ", "Jar height")}:</span>
                          <b>{selectedCompare.heightCm}</b>
                        </div>
                        <div className="dim-row">
                          <span>{text(lang, "Đường kính đáy", "Base diameter")}:</span>
                          <b>{selectedCompare.diameterCm}</b>
                        </div>
                        <div className="dim-row">
                          <span>{text(lang, "Quy cách đóng gói", "Packaging")}:</span>
                          <b>{text(lang, "Hũ thủy tinh tiệt trùng, nắp đỏ", "Sterilized glass jar, red cap")}</b>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Duy nhất 1 nút đặt hàng ngay theo size đã chọn */}
                  <button
                    type="button"
                    className="button compare-order-cta"
                    onClick={() => {
                      setReceipt(null);
                      setCart((prev) => ({
                        ...prev,
                        [selectedCompare.sku]: (prev[selectedCompare.sku] ?? 0) > 0 ? prev[selectedCompare.sku] : 1,
                      }));
                      setMsgSize(selectedCompare.msgKey);
                      const checkoutElem = document.getElementById("checkout");
                      if (checkoutElem) checkoutElem.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    <ShoppingCart size={18} strokeWidth={2} />
                    <span>
                      {selectedCompare.priceVnd !== undefined
                        ? text(
                            lang,
                            `Đặt hàng ngay hũ ${selectedCompare.weightG}g • ${money(selectedCompare.priceVnd, lang)}`,
                            `Order now ${selectedCompare.weightG}g • ${money(selectedCompare.priceVnd, lang)}`,
                          )
                        : text(
                            lang,
                            `Đặt hàng ngay hũ ${selectedCompare.weightG}g`,
                            `Order now ${selectedCompare.weightG}g`,
                          )}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* SECTION 5: EMOTIONAL INTERLUDE QUOTE */}
      <section className="interlude-section" aria-label={text(lang, "Cảm xúc quê nhà", "Heritage interlude")}>
        <div className="interlude-container">
          <span className="interlude-mark" aria-hidden="true">“</span>
          <blockquote className="interlude-quote">
            {text(
              lang,
              "Một món mặn quen thuộc trong bữa cơm gia đình xứ Quảng — vị bùi béo của cá bống tự nhiên quyện cùng nước mắm cá cơm Sa Huỳnh và tiêu sọ cay nồng, ăn cùng bát cơm trắng nóng hổi giữa những chiều mưa.",
              "A cherished savory dish of Quang Ngai home dining — wild goby simmered slowly with artisanal Sa Huynh fish sauce and pungent pepper, best served with steaming white rice.",
            )}
          </blockquote>
          <p className="interlude-author">— {text(lang, "Hương vị quê nhà Quảng Ngãi", "Quang Ngai Heritage Flavor")}</p>
        </div>
      </section>

      {/* SECTION 6: 03 / HƯƠNG VỊ QUÊ NHÀ */}
      <section className="flavor-section" id="flavor">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{text(lang, "03 / HƯƠNG VỊ QUÊ NHÀ", "03 / AUTHENTIC FLAVOR")}</p>
            <h2>{text(lang, "Món ngon đưa cơm trong mọi mâm cơm nhà", "Delicious & hearty in every family meal")}</h2>
          </div>
          <p>
            {text(
              lang,
              "Cá bống sông Trà được chế biến theo công thức gia truyền, săn chắc và đậm đà, dễ dàng kết hợp cùng nhiều món ăn hàng ngày.",
              "Traditional river goby braised with heritage craft, firm and richly seasoned, pairing naturally with daily meals.",
            )}
          </p>
        </div>

        <div className="meal-grid">
          <div className="meal-card">
            <div className="meal-emoji"><UtensilsCrossed size={24} strokeWidth={1.8} /></div>
            <div className="card-content">
              <h4>{text(lang, "Cơm trắng nóng hổi", "Steaming White Rice")}</h4>
              <p>
                {text(
                  lang,
                  "Thịt cá bống săn chắc, bùi ngậy ngấm tiêu ớt, ăn cùng bát cơm gạo mới nóng hổi là cảm nhận trọn vẹn hương vị mặn ngọt đậm đà nhất.",
                  "Firm and savory river goby paired with piping hot steamed rice creates the ultimate comforting home dining experience.",
                )}
              </p>
            </div>
          </div>
          <div className="meal-card">
            <div className="meal-emoji"><Salad size={24} strokeWidth={1.8} /></div>
            <div className="card-content">
              <h4>{text(lang, "Rau luộc chấm nước kho", "Boiled Greens & Dip")}</h4>
              <p>
                {text(
                  lang,
                  "Nước kho cá kẹo sánh màu nâu cánh gián tự nhiên, đậm đà vị cá, dùng làm nước chấm cho đĩa rau lang, rau muống luộc thanh mát.",
                  "The rich caramel-hued braising reduction makes a flavorful dip for freshly boiled morning glory or sweet potato leaves.",
                )}
              </p>
            </div>
          </div>
          <div className="meal-card">
            <div className="meal-emoji"><HeartHandshake size={24} strokeWidth={1.8} /></div>
            <div className="card-content">
              <h4>{text(lang, "Mâm cơm sum vầy tiện lợi", "Convenient Family Dinner")}</h4>
              <p>
                {text(
                  lang,
                  "Những ngày bận rộn không kịp đi chợ nấu nướng, chỉ cần mở nắp hũ là gia đình đã có ngay món mặn chất lượng, đậm vị quê nhà.",
                  "For busy workdays, simply open a jar to have an authentic, ready-to-eat savory centerpiece without extra cooking.",
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: 04 / BẢO QUẢN & AN TOÀN THỰC PHẨM */}
      <section className="storage-section" id="storage">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{text(lang, "04 / BẢO QUẢN & AN TOÀN THỰC PHẨM", "04 / STORAGE & FOOD SAFETY")}</p>
            <h2>{text(lang, "Hướng dẫn bảo quản & an toàn sử dụng", "Storage instructions & safety guidelines")}</h2>
          </div>
          <p>
            {text(
              lang,
              "Tuân thủ đúng chỉ dẫn nhãn mác của nhà sản xuất để giữ trọn vẹn hương vị thơm ngon và an toàn thực phẩm.",
              "Follow manufacturer label instructions carefully to preserve optimal flavor and quality.",
            )}
          </p>
        </div>

        <div className="storage-grid">
          <div className="storage-card">
            <div className="storage-icon"><CalendarDays size={24} strokeWidth={1.8} /></div>
            <div className="card-content">
              <h4>{text(lang, "Hạn sử dụng in trên nắp", "Expiry printed on lid")}</h4>
              <p>
                {text(
                  lang,
                  "Hạn sử dụng và ngày sản xuất được in rõ ràng trên nắp từng hũ cá khi xuất xưởng. Vui lòng kiểm tra ngày in thực tế trên nhãn.",
                  "Expiration date and production batch are clearly stamped on each jar lid. Please check the actual date on the package.",
                )}
              </p>
            </div>
          </div>
          <div className="storage-card">
            <div className="storage-icon"><ShieldCheck size={24} strokeWidth={1.8} /></div>
            <div className="card-content">
              <h4>{text(lang, "Bảo quản nơi thoáng mát", "Store in a cool dry place")}</h4>
              <p>
                {text(
                  lang,
                  "Khi chưa mở nắp, bảo quản hũ cá ở nhiệt độ phòng nơi khô ráo, thoáng mát, tránh ánh nắng mặt trời chiếu trực tiếp.",
                  "Before opening, keep jars at room temperature in a dry, ventilated area away from direct sunlight.",
                )}
              </p>
            </div>
          </div>
          <div className="storage-card">
            <div className="storage-icon"><Snowflake size={24} strokeWidth={1.8} /></div>
            <div className="card-content">
              <h4>{text(lang, "Sau khi mở nắp giữ ngăn mát", "Refrigerate after opening")}</h4>
              <p>
                {text(
                  lang,
                  "Sau khi mở nắp, nên đậy kín và bảo quản trong ngăn mát tủ lạnh. Sử dụng đũa sạch khi gắp cá để giữ chất lượng tốt nhất.",
                  "Once opened, tightly seal and keep refrigerated. Always use clean utensils to maintain pristine product quality.",
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 8: 05 / CÁCH ĐẶT HÀNG & CHECKOUT */}
      <section className="order-guide-section" id="order-guide">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{text(lang, "05 / CÁCH ĐẶT HÀNG", "05 / HOW TO ORDER")}</p>
            <h2>{text(lang, "Đặt hàng nhanh chóng & thuận tiện", "Quick & convenient ordering")}</h2>
          </div>
          <p>
            {text(
              lang,
              "Bạn có thể nhắn tin Zalo với lời nhắn soạn sẵn hoặc gửi thông tin qua form đặt trực tiếp bên dưới.",
              "Message us on Zalo with a pre-formatted message or submit your order directly via the web form below.",
            )}
          </p>
        </div>

        <div className="order-steps-grid">
          <div className="order-step-item">
            <div className="step-badge">1</div>
            <div className="card-content">
              <h4>{text(lang, "Chọn size hũ", "1. Choose size")}</h4>
              <p>{text(lang, "Chọn hũ 300g, 400g hoặc 600g phù hợp nhu cầu.", "Select 300g, 400g, or 600g jar to fit your needs.")}</p>
            </div>
          </div>
          <div className="order-step-item">
            <div className="step-badge">2</div>
            <div className="card-content">
              <h4>{text(lang, "Nhắn Zalo hoặc điền form", "2. Message Zalo or Form")}</h4>
              <p>{text(lang, "Nhắn tin qua Zalo số 070 2478 561 hoặc điền form nhanh.", "Chat via Zalo 070 2478 561 or fill the fast form.")}</p>
            </div>
          </div>
          <div className="order-step-item">
            <div className="step-badge">3</div>
            <div className="card-content">
              <h4>{text(lang, "Xác nhận & Giao hàng", "3. Confirm & Deliver")}</h4>
              <p>{text(lang, "Shop kiểm tra tồn kho, liên hệ xác nhận phí ship và giao.", "Shop checks stock, confirms delivery fee, and ships.")}</p>
            </div>
          </div>
        </div>

        {/* Interactive Zalo Message Builder Card */}
        <div className="zalo-builder-card">
          <div className="builder-header">
            <div>
              <span className="builder-tag" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <MessageCircle size={14} strokeWidth={1.8} />
                {text(lang, "BỘ SOẠN LỜI NHẮN ZALO NHANH", "FAST ZALO MESSAGE BUILDER")}
              </span>
              <h3>{text(lang, "Chọn size để tạo lời nhắn gửi Zalo", "Select a size to build your Zalo order message")}</h3>
            </div>
            <div className="builder-phone">
              <span>Hotline / Zalo:</span>
              <a href="tel:0702478561"><b>070 2478 561</b></a>
            </div>
          </div>

          <div className="size-selector-pills" role="radiogroup" aria-label={text(lang, "Chọn size hũ", "Choose jar size")}>
            <button
              type="button"
              className={`pill-btn ${msgSize === "300" ? "active" : ""}`}
              onClick={() => setMsgSize("300")}
              role="radio"
              aria-checked={msgSize === "300"}
            >
              Hũ 300g{p300 ? ` (${money(p300.retailPriceVnd, lang)})` : ""}
            </button>
            <button
              type="button"
              className={`pill-btn ${msgSize === "400" ? "active" : ""}`}
              onClick={() => setMsgSize("400")}
              role="radio"
              aria-checked={msgSize === "400"}
            >
              Hũ 400g{p400 ? ` (${money(p400.retailPriceVnd, lang)})` : ""}
            </button>
            <button
              type="button"
              className={`pill-btn ${msgSize === "600" ? "active" : ""}`}
              onClick={() => setMsgSize("600")}
              role="radio"
              aria-checked={msgSize === "600"}
            >
              Hũ 600g{p600 ? ` (${money(p600.retailPriceVnd, lang)})` : ""}
            </button>
            <button
              type="button"
              className={`pill-btn ${msgSize === "combo" ? "active" : ""}`}
              onClick={() => setMsgSize("combo")}
              role="radio"
              aria-checked={msgSize === "combo"}
            >
              {text(lang, "Combo 3 hũ (300g + 400g + 600g)", "Combo 3 jars (300g + 400g + 600g)")}
            </button>
          </div>

          <div className="message-box-container">
            <p className="message-box-label">{text(lang, "Nội dung lời nhắn mẫu:", "Sample message content:")}</p>
            <div className="message-box-preview">
              <code>{getGeneratedMessage()}</code>
            </div>
            <div className="message-actions">
              <button
                type="button"
                className="button secondary copy-btn"
                onClick={copyMessage}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {copiedMsg ? (
                    <>
                      <Check size={16} strokeWidth={2} />
                      {text(lang, "Đã sao chép!", "Copied!")}
                    </>
                  ) : (
                    <>
                      <Copy size={16} strokeWidth={1.8} />
                      {text(lang, "Sao chép lời nhắn", "Copy message")}
                    </>
                  )}
                </span>
              </button>
              <a
                className="button btn-zalo"
                href="https://zalo.me/0702478561"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <MessageCircle size={16} strokeWidth={1.8} />
                  {text(lang, "Mở Zalo nhắn ngay", "Open Zalo chat")}
                </span>
              </a>
              <a className="button secondary btn-call" href="tel:0702478561">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <PhoneCall size={16} strokeWidth={1.8} />
                  {text(lang, "Gọi hotline", "Call hotline")}
                </span>
              </a>
            </div>
            <div className="zalo-qr-connect-block">
              <div
                className="zalo-qr-thumb"
                onClick={() => setLightboxImg(productImages["zalo-qr"] || "/images/zalo-qr.png")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setLightboxImg(productImages["zalo-qr"] || "/images/zalo-qr.png");
                }}
                title={text(lang, "Bấm để phóng to mã QR Zalo", "Click to enlarge Zalo QR")}
                aria-label={text(lang, "Mã QR Zalo Hoài Bảo", "Zalo QR Code")}
              >
                <img
                  src={productImages["zalo-qr"] || "/images/zalo-qr.png"}
                  alt="Mã QR Zalo Hoài Bảo"
                />
                <span className="qr-zoom-tag">
                  <ZoomIn size={12} strokeWidth={2} />
                  QR
                </span>
              </div>
              <div className="zalo-qr-info">
                <strong>{text(lang, "Quét mã QR kết nối Zalo", "Scan QR to connect Zalo")}</strong>
                <p>
                  {text(
                    lang,
                    "Mở ứng dụng Zalo và quét mã này để nhắn tin trao đổi trực tiếp với Hoài Bảo nhận tư vấn nhanh.",
                    "Open Zalo app and scan this QR to chat directly with Hoai Bao for fast order consultation.",
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DIRECT CHECKOUT FORM (Preserved & Integrated) */}
      <section className="checkout" id="checkout">
        <div className="consultation-banner wide">
          <div className="consultation-banner-icon">
            <PhoneCall size={20} strokeWidth={2} />
          </div>
          <div className="consultation-banner-text">
            <strong>
              {text(
                lang,
                "Tư vấn trực tiếp 24/7 & Hỗ trợ đặt hàng tận tình",
                "24/7 Direct Consultation & Dedicated Ordering Support",
              )}
            </strong>
            <span>
              {text(
                lang,
                "Quý khách để lại thông tin bên dưới hoặc liên hệ Hotline/Zalo: 070 2478 561 để được tư vấn vị cá, quy cách hũ và phí ship nhanh chóng nhất.",
                "Leave your contact information below or contact Hotline/Zalo: 070 2478 561 to receive immediate consultation on flavors, sizes, and shipping.",
              )}
            </span>
          </div>
        </div>
        <aside>
          {actor && (
            <div className="storefront-member-banner">
              <PackagePlus size={16} strokeWidth={2} />
              <span>
                {text(
                  lang,
                  `Đang đăng nhập: ${actor.displayName ?? actor.role}. Để lên đơn nội bộ hoặc quản lý hoa hồng:`,
                  `Logged in as ${actor.displayName ?? actor.role}. To create internal orders:`,
                )}
              </span>
              <button
                type="button"
                className="admin-link-pill"
                onClick={() => onGoToAdmin?.()}
              >
                {text(lang, "Vào Dashboard →", "Go to Dashboard →")}
              </button>
            </div>
          )}
          <p className="eyebrow">{text(lang, "TƯ VẤN & ĐẶT HÀNG TRỰC TIẾP", "CONSULTATION & DIRECT ORDER")}</p>
          <h2>{text(lang, "Gửi thông tin nhận tư vấn ngay", "Request consultation & advice")}</h2>
          <p>
            {text(
              lang,
              "Để lại thông tin, đội ngũ Cá Bống Sông Trà sẽ liên hệ ngay để giải đáp thắc mắc, tư vấn chọn hũ phù hợp (300g, 400g, 600g) và hỗ trợ giao nhanh.",
              "Leave your details, our team will reach out promptly to answer questions, guide jar selection, and coordinate fast delivery.",
            )}
          </p>

          {products.filter((p) => (cart[p.sku] ?? 0) > 0).length > 0 ? (
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
          ) : (
            <div className="quick-sizes-container">
              <span className="quick-sizes-label">
                {text(
                  lang,
                  "Bạn đang quan tâm hũ nào? (Bấm chọn nhanh)",
                  "Which jar are you interested in? (Quick select)",
                )}
              </span>
              <div className="quick-sizes-pills">
                {products.map((p) => (
                  <button
                    key={p.sku}
                    type="button"
                    className="quick-size-pill"
                    onClick={() =>
                      setCart({ ...cart, [p.sku]: (cart[p.sku] ?? 0) + 1 })
                    }
                  >
                    <span>+ {productName(p, lang)}</span>
                    <small>({money(p.retailPriceVnd, lang)})</small>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p>{text(lang, "Tạm tính dự kiến", "Estimated total")}</p>
          <strong className="total">{money(pricing?.quote.totalVnd ?? total, lang)}</strong>
          {pricing && <PricingReview quote={pricing.quote} lang={lang} stale={pricing.stale} onConfirm={!pricing.confirmed ? () => setPricing({ ...pricing, confirmed: true }) : undefined} />}

          <div className="consultation-perks">
            <span className="consultation-perk-item">
              <Check size={14} strokeWidth={2.5} />
              {text(
                lang,
                "Tư vấn miễn phí 100%, không mua không sao",
                "100% Free consultation, no pressure",
              )}
            </span>
            <span className="consultation-perk-item">
              <Check size={14} strokeWidth={2.5} />
              {text(
                lang,
                "Kiểm tra hàng đúng chuẩn đặc sản mới thanh toán (COD)",
                "Check package upon delivery before COD payment",
              )}
            </span>
            <span className="consultation-perk-item">
              <Check size={14} strokeWidth={2.5} />
              {text(
                lang,
                "Hỗ trợ giao nhanh trong ngày tại TP.HCM & lân cận",
                "Same-day delivery support in HCMC & nearby",
              )}
            </span>
          </div>
        </aside>
        <form onSubmit={checkout}>
          <fieldset disabled={busy}>
            <div className="form-grid">
              <Input
                field={{
                  name: "name",
                  vi: "Họ tên của bạn",
                  en: "Your full name",
                  maxLength: 100,
                }}
                lang={lang}
              />
              <Input
                field={{
                  name: "phone",
                  vi: "Số điện thoại / Zalo",
                  en: "Phone number / Zalo",
                  type: "tel",
                  pattern: "(?:0|\\+84)[35789][0-9]{8}",
                }}
                lang={lang}
              />
              <Input
                field={{
                  name: "address",
                  vi: "Địa chỉ nhận hàng (hoặc khu vực)",
                  en: "Delivery address (or area)",
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
                {text(
                  lang,
                  "Nhu cầu cần tư vấn thêm (khẩu vị, số lượng, thời gian nhận...)",
                  "Questions or notes (flavor preference, quantity, delivery time...)",
                )}
                <textarea
                  name="notes"
                  maxLength={1000}
                  rows={3}
                  placeholder={text(
                    lang,
                    "Ví dụ: Tư vấn giúp mình hũ ăn thử cho 2 người, hoặc giao vào buổi chiều...",
                    "E.g.: Recommend a jar size for 2 people, deliver in afternoon...",
                  )}
                />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" name="consent" required />
              {text(
                lang,
                "Tôi đồng ý để cửa hàng liên hệ tư vấn hương vị, quy cách đóng gói và xác nhận đơn qua số điện thoại này.",
                "I agree to let the shop contact me for taste consultation, packaging details, and order confirmation via this phone number.",
              )}
            </label>
            <button
              type="submit"
              className="consultation-submit-btn"
              disabled={!products.length || !Object.values(cart).some(qty => qty > 0)}
            >
              {busy ? (
                <>
                  <RefreshCw size={18} className="spin" />
                  {text(lang, "Đang gửi thông tin…", "Sending details…")}
                </>
              ) : (
                <>
                  <PhoneCall size={18} strokeWidth={2} />
                  {text(
                    lang,
                    "Gửi thông tin nhận tư vấn ngay",
                    "Send info to get consultation now",
                  )}
                </>
              )}
            </button>
            {!total && products.length > 0 && (
              <p
                className="field-hint"
                style={{
                  marginTop: 8,
                  textAlign: "center",
                  color: "var(--brand-700)",
                }}
              >
                {text(
                  lang,
                  "💡 Vui lòng bấm chọn ít nhất 1 quy cách hũ ở bên trái để nhận tư vấn báo giá chính xác nhất.",
                  "💡 Please click at least 1 jar size on the left to receive accurate pricing consultation.",
                )}
              </p>
            )}
          </fieldset>
          <ErrorNotice error={error} lang={lang} />
          {!!error && (
            <p className="muted">
              {text(
                lang,
                "Thử lại với cùng nội dung nếu kết quả chưa rõ để tránh gửi trùng thông tin.",
                "If the result is uncertain, retry with unchanged details to avoid duplicate submissions.",
              )}
            </p>
          )}
          {receipt && (
            <div
              className="notice"
              role="status"
              style={{ borderLeftColor: "var(--status-success)" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <CheckCircle2 size={20} color="var(--status-success)" />
                <h3 style={{ margin: 0 }}>
                  {text(
                    lang,
                    "Đã gửi thông tin nhận tư vấn thành công!",
                    "Consultation request sent successfully!",
                  )}
                </h3>
              </div>
              <p>
                {text(lang, "Mã yêu cầu:", "Request code:")}{" "}
                <b>{String(receipt.orderCode)}</b>
              </p>
              <p>
                {label(String(receipt.status), lang)} ·{" "}
                {money(Number(receipt.totalVnd), lang)}
              </p>
              <p>
                {text(
                  lang,
                  "Cảm ơn bạn! Đội ngũ Cá Bống Sông Trà sẽ liên hệ lại qua số điện thoại/Zalo trong ít phút để giải đáp và hỗ trợ chu đáo nhất.",
                  "Thank you! The Ca Bong Song Tra team will reach out via phone/Zalo in a few minutes to assist you attentively.",
                )}
              </p>
            </div>
          )}
        </form>
      </section>

      {/* SECTION 9: 06 / CÂU HỎI THƯỜNG GẶP (FAQ) */}
      <section className="faq-section" id="faq">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{text(lang, "06 / CÂU HỎI THƯỜNG GẶP", "06 / FAQ")}</p>
            <h2>{text(lang, "Giải đáp thắc mắc về sản phẩm", "Frequently Asked Questions")}</h2>
          </div>
          <p>
            {text(
              lang,
              "Những điều cần biết về quy cách đóng gói, giá cả và bảo quản cá bống Sông Trà.",
              "Key information regarding packaging, pricing, and storage.",
            )}
          </p>
        </div>
        <div className="faq-list">
          <details className="faq-item" open>
            <summary>{text(lang, "Có mấy size hũ cá bống?", "How many jar sizes are available?")}</summary>
            <p>
              {text(
                lang,
                "Hiện có 3 size: hũ 300g, 400g và 600g. Đây là khối lượng tịnh của cá và nước kho, không bao gồm khối lượng vỏ hũ.",
                "There are 3 sizes: 300g, 400g, and 600g jars. This is the net weight of fish and sauce, excluding packaging.",
              )}
            </p>
          </details>
          <details className="faq-item">
            <summary>{text(lang, "Giá từng size là bao nhiêu?", "What is the price for each size?")}</summary>
            <p>
              {text(
                lang,
                "Giá của từng size hũ (300g, 400g, 600g) được hiển thị trực tiếp và cập nhật tự động từ hệ thống quản lý cửa hàng ở mục sản phẩm phía trên.",
                "Prices for each jar size (300g, 400g, 600g) are displayed and updated automatically from the catalog system in the products section above.",
              )}
            </p>
          </details>
          <details className="faq-item">
            <summary>{text(lang, "Shop giao hàng ở những khu vực nào?", "Where does the shop deliver?")}</summary>
            <p>
              {text(
                lang,
                "Cửa hàng ưu tiên giao nhanh tại TP.HCM (đặc biệt khu vực Thủ Đức, Quận 9, Dĩ An và lân cận). Phí vận chuyển cụ thể và thời gian giao sẽ được shop thông báo xác nhận khi liên hệ.",
                "Priority delivery in HCMC (especially Thu Duc, District 9, Di An). Delivery fee and schedule confirmed upon phone contact.",
              )}
            </p>
          </details>
          <details className="faq-item">
            <summary>{text(lang, "Bảo quản cá bống như thế nào?", "How should the fish be stored?")}</summary>
            <p>
              {text(
                lang,
                "Khách hàng vui lòng xem và thực hiện đúng theo hướng dẫn bảo quản và hạn sử dụng in trên nhãn sản phẩm của lô hàng thực tế.",
                "Please follow the storage instructions and expiration date printed on the actual product label.",
              )}
            </p>
          </details>
          <details className="faq-item">
            <summary>{text(lang, "Tôi có thể đặt qua Zalo hoặc gọi điện trực tiếp không?", "Can I order via Zalo or call directly?")}</summary>
            <p>
              {text(
                lang,
                "Hoàn toàn được! Bạn có thể nhắn tin qua Zalo số 070 2478 561 hoặc bấm nút Gọi điện để được phục vụ và tư vấn nhanh nhất.",
                "Yes! You can message us on Zalo at 070 2478 561 or call directly for quick support.",
              )}
            </p>
          </details>
          <details className="faq-item">
            <summary>{text(lang, "Khối lượng 300g/400g/600g là khối lượng cá riêng hay cả nước kho?", "Is the weight fish only or includes sauce?")}</summary>
            <p>
              {text(
                lang,
                "Khối lượng được ghi là khối lượng tịnh của cá và nước kho cô đặc, không bao gồm trọng lượng hũ thủy tinh.",
                "The stated weight is the net weight of both fish and braising sauce, excluding the glass jar.",
              )}
            </p>
          </details>
        </div>
      </section>

      {/* LIGHTBOX MODAL */}
      {lightboxImg && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxImg(null)}
          role="dialog"
          aria-modal="true"
          aria-label={text(lang, "Ảnh phóng to", "Enlarged image")}
        >
          <div className="lightbox-dialog" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setLightboxImg(null)}
              aria-label={text(lang, "Đóng", "Close")}
            >
              <X size={20} strokeWidth={2} />
            </button>
            <img
              src={lightboxImg}
              alt="Ảnh phóng to cá bống Sông Trà"
              className="lightbox-image"
            />
            <p className="lightbox-caption">
              {text(
                lang,
                "Ảnh thật sản phẩm cá bống Sông Trà — 300g, 400g và 600g.",
                "Genuine product photograph — 300g, 400g, and 600g jars.",
              )}
            </p>
          </div>
        </div>
      )}
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
    if (!Number.isNaN(date.getTime())) {
      const timePart = new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-GB", {
        timeStyle: "short",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(date);
      const datePart = new Intl.DateTimeFormat(lang === "vi" ? "vi-VN" : "en-GB", {
        dateStyle: "medium",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(date);
      return `${timePart} · ${datePart}`;
    }
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
              {columns.map((key) => {
                const val = row[key];
                const rendered = display(val, key, lang);
                const isId =
                  key === "id" ||
                  key.endsWith("Id") ||
                  key === "sku" ||
                  key === "requestId";
                const isActionOrStatus = key === "action" || key === "status";
                return (
                  <td key={key}>
                    {isId ? (
                      <span className="mono-badge" title={String(val ?? "")}>
                        {rendered}
                      </span>
                    ) : isActionOrStatus ? (
                      <span
                        className={`status-pill status-${String(val)
                          .toLowerCase()
                          .replace(/_/g, "-")}`}
                      >
                        {rendered}
                      </span>
                    ) : (
                      rendered
                    )}
                  </td>
                );
              })}
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
  users: propUsers,
  onClose,
  onUnauthorized,
  onChanged,
}: {
  id: string;
  actor: Actor;
  lang: Lang;
  users?: MemberUser[];
  onClose?: () => void;
  onUnauthorized?: () => void;
  onChanged: () => void;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const usersPolicy = getCachePolicy("users");
  const usersQuery = useQuery({
    queryKey: makeAdminQueryKey(actor, "allUsers"),
    queryFn: () => fetchUsersList(),
    staleTime: usersPolicy.staleTime,
    gcTime: usersPolicy.gcTime,
    enabled: actor.role === "OWNER_ADMIN" && (!propUsers || propUsers.length === 0),
  });
  const allUsers = propUsers?.length ? propUsers : ((usersQuery.data as MemberUser[]) || []);
  const activeMembers = allUsers.filter(
    (u) => u.role === "MEMBER" && (u.status === "ACTIVE" || !u.status),
  );
  const memberOptions =
    activeMembers.length > 0
      ? activeMembers.map((u) => ({
          value: u.id,
          label: `${u.displayName} (${u.emailNormalized})`,
        }))
      : [
          {
            value: "",
            label: text(
              lang,
              "Chưa có tài khoản Thành viên (CTV) nào — Vui lòng tạo tại tab Thành viên",
              "No Member accounts available — Please create in Users tab",
            ),
          },
        ];

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
    setActiveModal(null);
    setRevision((value) => value + 1);
    onChanged();
  };

  const canEditOrder =
    !!order && ["PENDING", "CONFIRMED", "PACKING"].includes(order.status);
  const canTransition = !!order;
  const canPayment =
    !!order &&
    !["CANCELLED", "RETURNED"].includes(order.status) &&
    (paymentDue(order) ?? 0) > 0;
  const canAssign =
    !!order &&
    actor.role === "OWNER_ADMIN" &&
    ["PENDING", "CONFIRMED", "PACKING"].includes(order.status);
  const canReturnIntake =
    !!order &&
    actor.role === "OWNER_ADMIN" &&
    ["RETURN_REQUESTED", "PARTIALLY_RETURNED", "RETURNED", "DELIVERY_FAILED"].includes(
      order.status,
    );
  const canRefund =
    !!order &&
    actor.role === "OWNER_ADMIN" &&
    order.receiptsVnd > order.refundsVnd;
  const canFinalizeCosts =
    !!order && actor.role === "OWNER_ADMIN" && !order.costsFinalized;
  const canExpense = !!order && actor.role === "OWNER_ADMIN";

  const actionModals = (
    <>
      {canTransition && order && (
        <Modal
          zIndex={1100}
          isOpen={activeModal === "transition"}
          onClose={() => setActiveModal(null)}
          title={text(lang, "Chuyển trạng thái đơn hàng", "Change Order Status")}
          subtitle={text(
            lang,
            `Đơn hàng: ${order.orderCode} (Hiện tại: ${label(order.status, lang)})`,
            `Order: ${order.orderCode} (Current: ${label(order.status, lang)})`,
          )}
          size="md"
        >
          {actor.role === "OWNER_ADMIN" && (
            <p className="notice">
              {text(lang,
                "Có thể chuyển trực tiếp hoặc điều chỉnh lại trạng thái. Đổi trạng thái không tự thu/hoàn tiền hay nhập lại hàng; hãy dùng thao tác tương ứng để ghi nhận thực tế.",
                "You can skip steps or correct the status. Status changes do not collect/refund payments or restock returns; record those using the corresponding actions.")}
            </p>
          )}
          <ActionForm
            action="transition"
            lang={lang}
            id={id}
            initial={{ expectedVersion: order.version, status: order.status }}
            fieldOverrides={{
              expectedVersion: { type: "hidden" },
            }}
            hideTitle
            onCancel={() => setActiveModal(null)}
            onSuccess={refresh}
            onUnauthorized={onUnauthorized}
          />
        </Modal>
      )}

      {canEditOrder && order && (
        <Modal
          zIndex={1100}
          isOpen={activeModal === "editOrder"}
          onClose={() => setActiveModal(null)}
          title={text(lang, "Sửa số lượng đơn hàng", "Edit Order Quantities")}
          subtitle={text(
            lang,
            `Điều chỉnh số lượng các sản phẩm cho đơn ${order.orderCode}`,
            `Adjust SKU quantities for order ${order.orderCode}`,
          )}
          size="md"
        >
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
            fieldOverrides={{
              expectedVersion: { type: "hidden" },
            }}
            hideTitle
            onCancel={() => setActiveModal(null)}
            onSuccess={refresh}
            onUnauthorized={onUnauthorized}
          />
        </Modal>
      )}

      {canPayment && order && (
        <Modal
          zIndex={1100}
          isOpen={activeModal === "payment"}
          onClose={() => setActiveModal(null)}
          title={text(lang, "Ghi nhận thực thu (COD)", "Record Payment Received")}
          subtitle={text(
            lang,
            `Số tiền còn phải thu: ${money(paymentDue(order) ?? 0, lang)}`,
            `Outstanding balance: ${money(paymentDue(order) ?? 0, lang)}`,
          )}
          size="md"
        >
          <ActionForm
            action="payment"
            lang={lang}
            id={id}
            initial={{
              expectedVersion: order.version,
              amountVnd: paymentDue(order),
            }}
            fieldOverrides={{
              expectedVersion: { type: "hidden" },
            }}
            hideTitle
            onCancel={() => setActiveModal(null)}
            onSuccess={refresh}
            onUnauthorized={onUnauthorized}
          />
        </Modal>
      )}

      {canAssign && order && (
        <Modal
          zIndex={1100}
          isOpen={activeModal === "assignment"}
          onClose={() => setActiveModal(null)}
          title={text(lang, "Giao đơn cho thành viên", "Assign Order to Member")}
          subtitle={text(
            lang,
            `Chỉ định thành viên (Cộng tác viên) phụ trách đơn hàng ${order.orderCode} để ghi nhận hoa hồng`,
            `Assign responsible member (affiliate) for order ${order.orderCode} to track commission`,
          )}
          size="md"
        >
          {activeMembers.length === 0 && (
            <p className="notice" style={{ marginBottom: 16 }}>
              {text(
                lang,
                "Hệ thống hiện chưa có tài khoản Thành viên / Cộng tác viên (Member) nào. Bạn vui lòng vào tab \"Thành viên\" tạo tài khoản CTV trước khi thực hiện giao đơn.",
                "No active Member accounts exist yet. Please navigate to the \"Users\" tab to create a Member account first.",
              )}
            </p>
          )}
          <ActionForm
            action="assignment"
            lang={lang}
            id={id}
            initial={{
              expectedVersion: order.version,
              memberId: order.responsibleMemberId || (activeMembers.length > 0 ? activeMembers[0]?.id : ""),
            }}
            fieldOverrides={{
              expectedVersion: { type: "hidden" },
              memberId: {
                vi: "Chọn thành viên phụ trách",
                en: "Select responsible member",
                options: memberOptions,
              },
            }}
            hideTitle
            onCancel={() => setActiveModal(null)}
            onSuccess={refresh}
            onUnauthorized={onUnauthorized}
          />
        </Modal>
      )}

      {canReturnIntake && order && (
        <Modal
          zIndex={1100}
          isOpen={activeModal === "returnIntake"}
          onClose={() => setActiveModal(null)}
          title={text(lang, "Tiếp nhận hàng trả", "Receive Inspected Return")}
          subtitle={text(
            lang,
            "Chọn một lô còn số lượng trả mỗi lần. Kiểm tra hàng trước khi chọn nhập lại kho. Hoàn tiền riêng với mục đích RETURN.",
            "Select one remaining allocated batch per intake. Inspect goods before choosing restock. Record a separate RETURN-purpose refund.",
          )}
          size="lg"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                  expectedVersion: { type: "hidden" },
                  batchId: { options: [line.batchId] },
                  qty: { max: line.returnableQty },
                }}
                hideTitle
                onCancel={() => setActiveModal(null)}
                onSuccess={refresh}
                onUnauthorized={onUnauthorized}
              />
            ))}
          </div>
        </Modal>
      )}

      {canRefund && order && (
        <Modal
          zIndex={1100}
          isOpen={activeModal === "refund"}
          onClose={() => setActiveModal(null)}
          title={text(lang, "Hoàn tiền đơn hàng", "Record Refund")}
          subtitle={text(
            lang,
            `Thực thu: ${money(order.receiptsVnd, lang)} · Đã hoàn: ${money(order.refundsVnd, lang)}`,
            `Received: ${money(order.receiptsVnd, lang)} · Refunded: ${money(order.refundsVnd, lang)}`,
          )}
          size="md"
        >
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
            fieldOverrides={{
              expectedVersion: { type: "hidden" },
            }}
            hideTitle
            onCancel={() => setActiveModal(null)}
            onSuccess={refresh}
            onUnauthorized={onUnauthorized}
          />
        </Modal>
      )}

      {canFinalizeCosts && order && (
        <Modal
          zIndex={1100}
          isOpen={activeModal === "costs"}
          onClose={() => setActiveModal(null)}
          title={text(lang, "Chốt chi phí đơn hàng", "Finalize Order Costs")}
          subtitle={text(
            lang,
            "Xác nhận đơn hàng đã ghi nhận đầy đủ chi phí trực tiếp và giá vốn",
            "Confirm all direct costs and cogs are recorded",
          )}
          size="md"
        >
          <ActionForm
            action="costs"
            lang={lang}
            id={id}
            initial={{ expectedVersion: order.version }}
            fieldOverrides={{
              expectedVersion: { type: "hidden" },
            }}
            hideTitle
            onCancel={() => setActiveModal(null)}
            onSuccess={refresh}
            onUnauthorized={onUnauthorized}
          />
        </Modal>
      )}

      {canExpense && order && (
        <Modal
          zIndex={1100}
          isOpen={activeModal === "expense"}
          onClose={() => setActiveModal(null)}
          title={text(lang, "Ghi chi phí đơn hàng", "Record Order Expense")}
          subtitle={text(
            lang,
            `Ghi nhận chi phí phát sinh cho đơn hàng ${order.orderCode}`,
            `Record direct expense for order ${order.orderCode}`,
          )}
          size="md"
        >
          <ActionForm
            action="expense"
            lang={lang}
            initial={{
              scope: "ORDER",
              orderId: id,
              expectedVersion: order.version,
            }}
            fieldOverrides={{
              expectedVersion: { type: "hidden" },
            }}
            hideTitle
            onCancel={() => setActiveModal(null)}
            onSuccess={refresh}
            onUnauthorized={onUnauthorized}
          />
        </Modal>
      )}
    </>
  );

  const detailBody = (
    <>
      <ErrorNotice error={error} lang={lang} />
      {loading && <p role="status">{text(lang, "Đang tải…", "Loading…")}</p>}
      {order && (
        <>
          {/* Thông tin người nhận và điều phối */}
          <div className="order-detail-grid-two">
            <div className="order-detail-info-card">
              <h5 className="order-detail-section-title">
                <Truck size={16} />
                <span>{text(lang, "Thông tin người nhận & Địa chỉ giao hàng", "Customer & Delivery")}</span>
              </h5>
              <address>
                <strong style={{ fontSize: "1rem", color: "#1c1917" }}>{order.customer.name}</strong>
                <br />
                📞 {order.customer.phone}
                <br />
                📍 {order.customer.address}, {order.customer.area}
              </address>
            </div>

            <div className="order-detail-info-card">
              <h5 className="order-detail-section-title">
                <Users size={16} />
                <span>{text(lang, "Thông tin quản lý & Phân công", "Management & Assignment")}</span>
              </h5>
              <div style={{ fontSize: "0.9rem", lineHeight: 1.8, color: "#44403c" }}>
                <div>
                  <span style={{ color: "#78716c" }}>{text(lang, "Trạng thái:", "Status:")} </span>
                  <span className="badge" style={{ verticalAlign: "middle" }}>
                    {label(order.status, lang)}
                  </span>
                </div>
                <div>
                  <span style={{ color: "#78716c" }}>{text(lang, "Thành viên phụ trách:", "Responsible member:")} </span>
                  <strong>
                    {order.responsibleMemberId
                      ? (() => {
                          const mem = allUsers.find((u) => u.id === order.responsibleMemberId);
                          return mem ? `${mem.displayName} (${mem.emailNormalized})` : order.responsibleMemberId;
                        })()
                      : text(lang, "Chưa phân công (Cửa hàng trực tiếp)", "Direct store (Unassigned)")}
                  </strong>
                </div>
                <div>
                  <span style={{ color: "#78716c" }}>{text(lang, "Phiên bản dữ liệu:", "Data version:")} </span>
                  <code>v{order.version}</code>
                </div>
              </div>
            </div>
          </div>

          {/* Danh sách sản phẩm */}
          <div className="order-detail-section-block">
            <h5 className="order-detail-section-title">
              <Package size={16} />
              <span>{text(lang, "Danh sách sản phẩm trong đơn hàng", "Ordered Items")}</span>
            </h5>
            <Records rows={order.items} lang={lang} />
          </div>

          {/* Chỉ số tài chính & Kế toán */}
          <div className="order-detail-section-block">
            <h5 className="order-detail-section-title">
              <Banknote size={16} />
              <span>{text(lang, "Chỉ số tài chính & Kế toán", "Financial Metrics")}</span>
            </h5>
            <dl className="order-detail-metrics-grid">
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
              ].map((key) => {
                const isHighlight = key === "paymentDueVnd" && (paymentDue(order) ?? 0) > 0;
                return (
                  <div key={key} className={`order-detail-metric-box ${isHighlight ? "highlight" : ""}`}>
                    <dt>{label(key, lang)}</dt>
                    <dd>
                      {key === "paymentDueVnd" && paymentDue(order) === null
                        ? text(lang, "Chưa có dữ liệu", "Unavailable")
                        : display(order[key as keyof Order], key, lang)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>

          <p className="notice" style={{ fontSize: "0.85rem", marginTop: 8 }}>
            {text(
              lang,
              "Giao hàng không tự ghi nhận tiền. COD chỉ ghi khi tiền đã về cửa hàng. Trả hàng không tự hoàn tiền hoặc nhập lại kho.",
              "Delivery never records payment. Record COD only after the shop receives it. Returns do not automatically refund or restock.",
            )}
          </p>

          {paymentDue(order) === null && (
            <p className="notice" role="alert">
              {text(
                lang,
                "Chưa có số tiền phải thu hợp lệ từ máy chủ. Không thể ghi thu tiền; tải lại đơn hoặc liên hệ người vận hành.",
                "The server payment amount is unavailable or invalid. Payment entry is disabled; reload the order or contact an operator.",
              )}
            </p>
          )}

          {/* Thanh công cụ Thao tác nhanh cho đơn hàng */}
          <div className="order-actions-card" key={`${order.id}-${order.version}`}>
            <div className="order-actions-card-header">
              <div className="order-actions-header-left">
                <div className="order-actions-icon-badge">
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <h4 className="order-actions-heading">
                    {text(lang, "Thao tác nghiệp vụ đơn hàng", "Order Actions")}
                  </h4>
                  <p className="order-actions-sub">
                    {text(
                      lang,
                      "Chọn thao tác để mở cửa sổ xử lý nghiệp vụ tương ứng",
                      "Select an action to open the corresponding workflow popup",
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="order-actions-btn-group">
              {canTransition && (
                <button
                  type="button"
                  className="cbst-btn-action cbst-btn-action-primary"
                  onClick={() => setActiveModal("transition")}
                >
                  <RefreshCw size={15} />
                  <span>{text(lang, "Chuyển trạng thái", "Change Status")}</span>
                </button>
              )}

              {canPayment && (
                <button
                  type="button"
                  className="cbst-btn-action cbst-btn-action-success"
                  onClick={() => setActiveModal("payment")}
                >
                  <Banknote size={15} />
                  <span>{text(lang, "Ghi thu tiền COD", "Record Payment")}</span>
                  <span className="cbst-action-pill">
                    {money(paymentDue(order) ?? 0, lang)}
                  </span>
                </button>
              )}

              {canEditOrder && (
                <button
                  type="button"
                  className="cbst-btn-action cbst-btn-action-secondary"
                  onClick={() => setActiveModal("editOrder")}
                >
                  <SlidersHorizontal size={15} />
                  <span>{text(lang, "Sửa số lượng", "Edit Quantities")}</span>
                </button>
              )}

              {canAssign && (
                <button
                  type="button"
                  className="cbst-btn-action cbst-btn-action-secondary"
                  onClick={() => setActiveModal("assignment")}
                >
                  <Users size={15} />
                  <span>{text(lang, "Giao đơn", "Assign Member")}</span>
                </button>
              )}

              {canReturnIntake && (
                <button
                  type="button"
                  className="cbst-btn-action cbst-btn-action-warning"
                  onClick={() => setActiveModal("returnIntake")}
                >
                  <Package size={15} />
                  <span>{text(lang, "Tiếp nhận hàng trả", "Return Intake")}</span>
                </button>
              )}

              {canRefund && (
                <button
                  type="button"
                  className="cbst-btn-action cbst-btn-action-danger"
                  onClick={() => setActiveModal("refund")}
                >
                  <RotateCcw size={15} />
                  <span>{text(lang, "Hoàn tiền", "Refund")}</span>
                </button>
              )}

              {canExpense && (
                <button
                  type="button"
                  className="cbst-btn-action cbst-btn-action-secondary"
                  onClick={() => setActiveModal("expense")}
                >
                  <Wallet size={15} />
                  <span>{text(lang, "Ghi chi phí đơn", "Record Expense")}</span>
                </button>
              )}

              {canFinalizeCosts && (
                <button
                  type="button"
                  className="cbst-btn-action cbst-btn-action-secondary"
                  onClick={() => setActiveModal("costs")}
                >
                  <CheckCircle2 size={15} />
                  <span>{text(lang, "Chốt chi phí", "Finalize Costs")}</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );

  if (onClose) {
    return (
      <Modal
        isOpen={true}
        onClose={onClose}
        title={
          order
            ? `${text(lang, "Chi tiết đơn hàng", "Order Details")} · ${order.orderCode}`
            : text(lang, "Chi tiết đơn hàng", "Order Details")
        }
        subtitle={
          order
            ? `${label(order.status, lang)} · Phiên bản v${order.version}`
            : undefined
        }
        size="xl"
        footer={
          <div
            className="cbst-modal-actions"
            style={{
              justifyContent: "space-between",
              width: "100%",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <button
              type="button"
              className="secondary"
              onClick={() => setRevision((value) => value + 1)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={14} />
              <span>{text(lang, "Tải lại phiên bản", "Reload current version")}</span>
            </button>
            <button type="button" className="secondary" onClick={onClose}>
              {text(lang, "Đóng", "Close")}
            </button>
          </div>
        }
      >
        {detailBody}
        {actionModals}
      </Modal>
    );
  }

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
      {detailBody}
      {actionModals}
    </section>
  );
}

export function Sparkline({
  points = [],
  color = "#D84012",
}: {
  points?: number[];
  color?: string;
}) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const coords = points.map((p, i) => {
    const x = Math.round((i / (points.length - 1)) * 240);
    const y = Math.round(26 - ((p - min) / range) * 20);
    return `${x},${y}`;
  });
  const d = `M${coords.join(" L")}`;
  return (
    <svg
      viewBox="0 0 240 30"
      className="metric-sparkline"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SalesOverviewChart({
  orders = [],
  revenue = 0,
  deliveredOrders = 0,
  lang,
}: {
  orders?: RecordRow[];
  revenue?: number;
  deliveredOrders?: number;
  cogs?: number;
  directCosts?: number;
  lang: Lang;
}) {
  const [tab, setTab] = useState<"revenue" | "orders" | "profit">("revenue");
  const deliveredList = orders.filter((o) => o.status === "DELIVERED");

  // Group delivered orders by date
  const dateMap: Record<string, { date: string; revenue: number; orders: number; profit: number }> = {};
  for (const o of deliveredList) {
    const dStr = o.deliveredAt || o.createdAt;
    const dateKey = dStr
      ? new Date(String(dStr)).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
      : "Hôm nay";
    if (!dateMap[dateKey]) {
      dateMap[dateKey] = { date: dateKey, revenue: 0, orders: 0, profit: 0 };
    }
    const orderRev = Number(o.totalVnd ?? 0);
    const orderCost = Number(o.cogsVnd ?? 0) + Number(o.directCostsVnd ?? 0);
    dateMap[dateKey].revenue += orderRev;
    dateMap[dateKey].orders += 1;
    dateMap[dateKey].profit += orderRev - orderCost;
  }
  const points = Object.values(dateMap);
  const hasRealData = deliveredList.length > 0 || revenue > 0 || deliveredOrders > 0;

  return (
    <div className="apex-card sales-overview-card">
      <div className="card-header-flex">
        <div>
          <h3>{text(lang, "Hiệu suất kinh doanh", "Sales Overview")}</h3>
          <p className="card-subtitle">
            {text(
              lang,
              "Doanh số theo chu kỳ hoạt động tháng",
              "Daily performance for the current month",
            )}
          </p>
        </div>
        <div className="chart-pill-tabs">
          <button
            type="button"
            className={tab === "revenue" ? "active" : ""}
            onClick={() => setTab("revenue")}
          >
            {text(lang, "Doanh thu", "Revenue")}
          </button>
          <button
            type="button"
            className={tab === "orders" ? "active" : ""}
            onClick={() => setTab("orders")}
          >
            {text(lang, "Đơn hàng", "Orders")}
          </button>
          <button
            type="button"
            className={tab === "profit" ? "active" : ""}
            onClick={() => setTab("profit")}
          >
            {text(lang, "Lợi nhuận", "Profit")}
          </button>
        </div>
      </div>

      {!hasRealData || points.length === 0 ? (
        <div className="chart-empty-state">
          <BarChart3 size={38} strokeWidth={1.5} className="chart-empty-icon" />
          <h4>{text(lang, "Chưa có dữ liệu bán hàng", "No sales data yet")}</h4>
          <p>
            {text(
              lang,
              "Biểu đồ sẽ hiển thị khi có đơn hàng đủ điều kiện ghi nhận.",
              "Charts will display once qualifying delivered orders are recorded.",
            )}
          </p>
        </div>
      ) : (
        <div className="area-chart-container">
          {(() => {
            const values = points.map((p) => p[tab]);
            const maxVal = Math.max(...values, 1);
            const minVal = Math.min(...values, 0);
            const ticks = [maxVal, (maxVal + minVal) / 2, minVal];
            const formatTick = (value: number) => tab === "orders" ? String(Math.round(value)) : money(Math.round(value), lang);
            const left = Math.max(90, ...ticks.map((value) => formatTick(value).length * 7 + 20));
            const right = 580;
            const yFor = (value: number) => 190 - ((value - minVal) / (maxVal - minVal)) * 150;
            const baseline = yFor(0);
            const svgPoints = points.map((p, i) => {
              const x = points.length === 1 ? (left + right) / 2 : left + (i / (points.length - 1)) * (right - left);
              const y = yFor(p[tab]);
              return { x, y, val: p[tab], label: p.date };
            });
            const pathD = `M ${svgPoints.map((pt) => `${pt.x} ${pt.y}`).join(" L ")}`;
            const areaD = `${pathD} L ${svgPoints[svgPoints.length - 1].x} ${baseline} L ${svgPoints[0].x} ${baseline} Z`;

            return (
              <svg
                viewBox="0 0 600 230"
                className="area-chart-svg"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D84012" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#D84012" stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                {ticks.map((value, index) => (
                  <g key={index}>
                    <line x1={left} y1={yFor(value)} x2={right} y2={yFor(value)} stroke="#e2e8f0" strokeDasharray="4 4" />
                    <text x={left - 12} y={yFor(value) + 4} textAnchor="end" className="chart-axis-label">{formatTick(value)}</text>
                  </g>
                ))}
                {svgPoints.length === 1 && (
                  <rect x={svgPoints[0].x - 24} y={Math.min(svgPoints[0].y, baseline)} width="48" height={Math.max(2, Math.abs(baseline - svgPoints[0].y))} rx="4" fill="#D84012" fillOpacity="0.2" />
                )}

                <path d={areaD} fill="url(#areaGradient)" />
                <path
                  d={pathD}
                  fill="none"
                  stroke="#D84012"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {svgPoints.map((pt, idx) => (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={pt.y}
                    r="4"
                    fill="#D84012"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                ))}

                {svgPoints.filter((_, idx) => idx % Math.max(1, Math.ceil(svgPoints.length / 7)) === 0 || idx === svgPoints.length - 1).map((pt, idx) => (
                  <text key={idx} x={pt.x} y="215" textAnchor="middle" className="chart-axis-label">
                    {pt.label}
                  </text>
                ))}
              </svg>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function OrderStatusDonut({
  orders = [],
  lang,
}: {
  orders?: RecordRow[];
  lang: Lang;
}) {
  const total = orders.length;
  const completed = orders.filter((o) => o.status === "DELIVERED").length;
  const processing = orders.filter((o) =>
    ["CONFIRMED", "PACKING", "SHIPPING"].includes(String(o.status)),
  ).length;
  const pending = orders.filter((o) => o.status === "PENDING").length;
  const cancelled = orders.filter((o) =>
    [
      "CANCELLED",
      "RETURN_REQUESTED",
      "PARTIALLY_RETURNED",
      "RETURNED",
      "DELIVERY_FAILED",
    ].includes(String(o.status)),
  ).length;

  const circumference = 339.29; // 2 * PI * 54
  const completedDash = total > 0 ? (completed / total) * circumference : 0;
  const processingDash = total > 0 ? (processing / total) * circumference : 0;
  const pendingDash = total > 0 ? (pending / total) * circumference : 0;
  const cancelledDash = total > 0 ? (cancelled / total) * circumference : 0;

  return (
    <div className="apex-card order-status-card">
      <div className="card-header">
        <h3>{text(lang, "Trạng thái đơn hàng", "Order Status")}</h3>
        <p className="card-subtitle">
          {text(lang, "Phân bổ số lượng đơn", "Distribution of current orders")}
        </p>
      </div>

      {total === 0 ? (
        <div className="chart-empty-state">
          <PieChart size={38} strokeWidth={1.5} className="chart-empty-icon" />
          <h4>{text(lang, "Chưa có đơn hàng nào", "No orders yet")}</h4>
          <p>
            {text(
              lang,
              "Chưa có đơn hàng nào trong khoảng thời gian đã chọn.",
              "No orders placed in the selected period.",
            )}
          </p>
        </div>
      ) : (
        <>
          <div className="donut-center-wrap">
            <svg viewBox="0 0 160 160" className="donut-svg" aria-hidden="true">
              <circle cx="80" cy="80" r="54" fill="none" stroke="#f8fafc" strokeWidth="18" />
              {completedDash > 0 && (
                <circle
                  cx="80"
                  cy="80"
                  r="54"
                  fill="none"
                  stroke="#16A34A"
                  strokeWidth="18"
                  strokeDasharray={`${completedDash} ${circumference}`}
                  strokeDashoffset="0"
                />
              )}
              {processingDash > 0 && (
                <circle
                  cx="80"
                  cy="80"
                  r="54"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="18"
                  strokeDasharray={`${processingDash} ${circumference}`}
                  strokeDashoffset={`${-completedDash}`}
                />
              )}
              {pendingDash > 0 && (
                <circle
                  cx="80"
                  cy="80"
                  r="54"
                  fill="none"
                  stroke="#D97706"
                  strokeWidth="18"
                  strokeDasharray={`${pendingDash} ${circumference}`}
                  strokeDashoffset={`${-(completedDash + processingDash)}`}
                />
              )}
              {cancelledDash > 0 && (
                <circle
                  cx="80"
                  cy="80"
                  r="54"
                  fill="none"
                  stroke="#DC2626"
                  strokeWidth="18"
                  strokeDasharray={`${cancelledDash} ${circumference}`}
                  strokeDashoffset={`${-(completedDash + processingDash + pendingDash)}`}
                />
              )}
            </svg>
            <div className="donut-center-text">
              <div className="donut-number">{total}</div>
              <div className="donut-label">{text(lang, "Đơn hàng", "Orders")}</div>
            </div>
          </div>

          <div className="donut-legend">
            <div className="legend-row">
              <span className="legend-label">
                <span className="dot dot-green" />
                {text(lang, "Hoàn tất", "Completed")}
              </span>
              <span className="legend-val">{completed}</span>
            </div>
            <div className="legend-row">
              <span className="legend-label">
                <span className="dot dot-blue" />
                {text(lang, "Đang xử lý / giao", "Processing")}
              </span>
              <span className="legend-val">{processing}</span>
            </div>
            <div className="legend-row">
              <span className="legend-label">
                <span className="dot dot-amber" />
                {text(lang, "Chờ xác nhận", "Pending")}
              </span>
              <span className="legend-val">{pending}</span>
            </div>
            <div className="legend-row">
              <span className="legend-label">
                <span className="dot dot-red" />
                {text(lang, "Đã hủy / Hoàn", "Cancelled")}
              </span>
              <span className="legend-val">{cancelled}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function TopProductsWidget({
  orders = [],
  lang,
}: {
  orders?: RecordRow[];
  lang: Lang;
}) {
  const validOrders = orders.filter(
    (o) => !["CANCELLED", "DELIVERY_FAILED"].includes(String(o.status)),
  );
  const skuMap: Record<string, { sku: string; name: string; sold: number; revenue: number }> = {
    "CBST-300": { sku: "CBST-300", name: "Cá Bống Sông Trà Kho Tiêu 300g", sold: 0, revenue: 0 },
    "CBST-400": { sku: "CBST-400", name: "Cá Bống Sông Trà Kho Tiêu 400g", sold: 0, revenue: 0 },
    "CBST-600": { sku: "CBST-600", name: "Cá Bống Sông Trà Kho Tiêu 600g", sold: 0, revenue: 0 },
  };

  for (const o of validOrders) {
    if (Array.isArray(o.items)) {
      for (const it of o.items) {
        const sku = String(it.sku || "");
        if (!skuMap[sku]) {
          skuMap[sku] = { sku, name: `Cá Bống Sông Trà ${sku}`, sold: 0, revenue: 0 };
        }
        const qty = Number(it.qty || 0);
        const price = Number(it.unitPriceVnd || 0);
        skuMap[sku].sold += qty;
        skuMap[sku].revenue += qty * price;
      }
    }
  }

  const items = Object.values(skuMap)
    .filter((it) => it.sold > 0)
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="apex-card top-products-card">
      <div className="card-header-flex">
        <div>
          <h3>{text(lang, "Sản phẩm bán chạy nhất", "Top Selling Products")}</h3>
          <p className="card-subtitle">
            {text(lang, "Sản lượng và doanh số quy cách", "Best performers this month")}
          </p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="chart-empty-state" style={{ minHeight: 180 }}>
          <Award size={36} strokeWidth={1.5} className="chart-empty-icon" />
          <h4>{text(lang, "Chưa có dữ liệu bán hàng", "No sales data yet")}</h4>
          <p>
            {text(
              lang,
              "Sản phẩm bán chạy sẽ xuất hiện khi có đơn hàng phát sinh.",
              "Top selling products will appear once orders are placed.",
            )}
          </p>
        </div>
      ) : (
        <table className="mini-data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>{text(lang, "Sản phẩm", "Product")}</th>
              <th style={{ textAlign: "right" }}>{text(lang, "Đã bán", "Sold")}</th>
              <th style={{ textAlign: "right" }}>{text(lang, "Doanh thu", "Revenue")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={it.sku}>
                <td className="text-muted">{idx + 1}</td>
                <td>
                  <div className="prod-name-bold">{it.name}</div>
                  <div className="prod-sub-tag">{it.sku}</div>
                </td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{it.sold}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{money(it.revenue, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CategoryBarWidget({
  orders = [],
  lang,
}: {
  orders?: RecordRow[];
  lang: Lang;
}) {
  const validOrders = orders.filter(
    (o) => !["CANCELLED", "DELIVERY_FAILED"].includes(String(o.status)),
  );
  let rev300 = 0;
  let rev400 = 0;
  let rev600 = 0;

  for (const o of validOrders) {
    if (Array.isArray(o.items)) {
      for (const it of o.items) {
        const sku = String(it.sku || "");
        const price = Number(it.unitPriceVnd || 0) * Number(it.qty || 0);
        if (sku.includes("300")) rev300 += price;
        else if (sku.includes("400")) rev400 += price;
        else if (sku.includes("600")) rev600 += price;
      }
    }
  }

  const totalRev = rev300 + rev400 + rev600;
  const bars = [
    {
      label: text(lang, "Hũ thủy tinh 300g", "300g Jars"),
      pct: totalRev > 0 ? Math.round((rev300 / totalRev) * 100) : 0,
      val: money(rev300, lang),
    },
    {
      label: text(lang, "Hũ thủy tinh 400g", "400g Jars"),
      pct: totalRev > 0 ? Math.round((rev400 / totalRev) * 100) : 0,
      val: money(rev400, lang),
    },
    {
      label: text(lang, "Hũ quà biếu 600g", "600g Gift"),
      pct: totalRev > 0 ? Math.round((rev600 / totalRev) * 100) : 0,
      val: money(rev600, lang),
    },
  ];

  return (
    <div className="apex-card category-bar-card">
      <div className="card-header">
        <h3>{text(lang, "Phân bổ theo quy cách", "Sales by Category")}</h3>
        <p className="card-subtitle">
          {text(lang, "Tỷ trọng doanh số các dòng sản phẩm", "Revenue distribution across product types")}
        </p>
      </div>
      {totalRev === 0 ? (
        <div className="chart-empty-state" style={{ minHeight: 180 }}>
          <Layers size={36} strokeWidth={1.5} className="chart-empty-icon" />
          <h4>{text(lang, "Chưa có dữ liệu quy cách", "No category breakdown yet")}</h4>
          <p>
            {text(
              lang,
              "Tỷ trọng doanh số sẽ hiển thị khi có phát sinh doanh thu.",
              "Category distribution will appear once revenue is generated.",
            )}
          </p>
        </div>
      ) : (
        <div className="cat-bars-list">
          {bars.map((b) => (
            <div key={b.label} className="cat-bar-item">
              <div className="cat-bar-label-row">
                <span>{b.label}</span>
                <strong>{b.val}</strong>
              </div>
              <div className="cat-progress-track">
                <div className="cat-progress-fill" style={{ width: `${b.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function InternalOrderCreator({
  actor,
  lang,
  products = [],
  onOrderCreated,
  onGoToOrders,
}: {
  actor: Actor;
  lang: Lang;
  products?: Product[];
  onOrderCreated?: (order: RecordRow) => void;
  onGoToOrders?: () => void;
}) {
  const [cart, setCart] = useState<Record<string, number>>({
    "CBST-300": 0,
    "CBST-400": 0,
    "CBST-600": 0,
  });
  const [customer, setCustomer] = useState({
    name: "",
    phone: "",
    address: "",
    area: "TP. Hồ Chí Minh",
    source: "DIRECT",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [createdOrder, setCreatedOrder] = useState<RecordRow | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [pricing, setPricing] = useState<{ quote: PricingQuote; signature: string; confirmed: boolean; stale?: boolean } | null>(null);
  const unresolved = useRef<{ payload: ReturnType<typeof guardedPayload>; signature: string } | null>(null);
  const mutate = useRef<ReturnType<typeof createCheckout> | null>(null);

  const availableProducts = products;

  const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const totalAmount = availableProducts.reduce(
    (sum, p) => sum + p.retailPriceVnd * (cart[p.sku] ?? 0),
    0,
  );

  const updateQty = (sku: string, delta: number) => {
    setCart((prev) => {
      const current = prev[sku] ?? 0;
      const next = Math.max(0, Math.min(100, current + delta));
      return { ...prev, [sku]: next };
    });
  };

  const handleQtyInput = (sku: string, val: string) => {
    const num = parseInt(val, 10);
    const valid = isNaN(num) ? 0 : Math.max(0, Math.min(100, num));
    setCart((prev) => ({ ...prev, [sku]: valid }));
  };

  const [checkingQuote, setCheckingQuote] = useState(false);

  const subtotalToDisplay = pricing?.quote.merchandiseSubtotalVnd ?? totalAmount;
  const discountToDisplay = pricing?.quote.discountVnd ?? 0;
  const totalToDisplay = pricing?.quote.totalVnd ?? totalAmount;

  const handleCheckQuote = async () => {
    if (totalItems === 0) return;
    setError(null);
    setCheckingQuote(true);
    try {
      const payload = {
        items: Object.entries(cart)
          .filter(([, qty]) => qty > 0)
          .map(([sku, qty]) => ({ sku, qty })),
        customer: { phone: customer.phone },
      };
      const quote = await requestQuote(payload, true, voucherCode || undefined);
      const signature = JSON.stringify({
        payload: {
          customer: { name: customer.name, phone: customer.phone, address: customer.address, area: customer.area },
          items: payload.items,
          source: customer.source,
          notes: customer.notes,
          consent: true,
        },
        voucherCode,
      });
      setPricing({ quote, signature, confirmed: true });
    } catch (err) {
      setError(err);
    } finally {
      setCheckingQuote(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);

    try {
      const payload = checkoutPayload(
        {
          name: customer.name,
          phone: customer.phone,
          address: customer.address,
          area: customer.area,
          source: customer.source,
          notes: customer.notes,
          consent: true,
        },
        cart,
      );

      const signature = JSON.stringify({ payload, voucherCode });

      if (pricing?.stale && !pricing.confirmed) {
        throw new Error("PRICE_CONFIRMATION_REQUIRED");
      }

      let quote = pricing && pricing.signature === signature && !pricing.stale ? pricing.quote : null;
      if (!quote) {
        quote = await requestQuote(payload, true, voucherCode || undefined);
        setPricing({ quote, signature, confirmed: true });
      }

      if (unresolved.current && unresolved.current.signature !== signature) throw new Error("CHECKOUT_RECONCILIATION_REQUIRED");
      const guarded = unresolved.current?.payload ?? guardedPayload(payload, quote, true, voucherCode || undefined);
      if (!mutate.current) {
        mutate.current = createCheckout(window.sessionStorage, fetch, "cbst-internal-checkout-retry");
      }

      unresolved.current = { payload: guarded, signature };
      const result = (await mutate.current(guarded, actor.id)) as RecordRow;
      unresolved.current = null;
      setPricing(null);
      setCreatedOrder(result);
      onOrderCreated?.(result);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === "PRICE_STALE_CONFIRMATION_REQUIRED") {
        const signature = unresolved.current?.signature ?? "";
        unresolved.current = null;
        setPricing(err.quote ? { quote: err.quote, signature, confirmed: false, stale: true } : null);
      }
      if (err instanceof Error && err.message === "CHECKOUT_RECONCILIATION_REQUIRED") {
        unresolved.current = null;
      }
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  if (createdOrder) {
    return (
      <div className="internal-order-container">
        <div className="order-success-banner">
          <div className="order-success-icon">
            <CheckCircle2 size={32} strokeWidth={2.2} />
          </div>
          <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#166534", margin: "0 0 8px" }}>
            {text(lang, "Tạo đơn hàng nội bộ thành công!", "Internal order created successfully!")}
          </h2>
          <p style={{ color: "#4B5563", fontSize: "0.95rem", maxWidth: 500, margin: "0 auto 20px" }}>
            {text(
              lang,
              "Đơn hàng đã được lưu vào hệ thống, gắn trách nhiệm cho tài khoản của bạn và sẵn sàng chuyển tiếp sang khâu chuẩn bị hàng.",
              "Order has been logged, assigned to your account, and ready for fulfillment.",
            )}
          </p>

          <div
            style={{
              background: "#F9FAFB",
              border: "1px solid #E5E7EB",
              borderRadius: 12,
              padding: "16px 20px",
              maxWidth: 480,
              margin: "0 auto 24px",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#6B7280" }}>{text(lang, "Mã đơn hàng", "Order code")}:</span>
              <strong style={{ color: "#111827", fontFamily: "monospace" }}>
                #{String(createdOrder.orderCode ?? createdOrder.id ?? "").slice(0, 8).toUpperCase()}
              </strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#6B7280" }}>{text(lang, "Khách hàng", "Customer")}:</span>
              <strong>{customer.name} ({customer.phone})</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "#6B7280" }}>{text(lang, "Tổng tiền COD", "COD total")}:</span>
              <strong style={{ color: "#D84012" }}>{money(Number(createdOrder.totalVnd ?? totalAmount), lang)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#6B7280" }}>{text(lang, "Trạng thái", "Status")}:</span>
              <span className="status-badge pending">{text(lang, "Chờ xác nhận (PENDING)", "Pending")}</span>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
            <button
              type="button"
              className="admin-refresh-btn"
              style={{ background: "#D84012", color: "#fff", borderColor: "#D84012", padding: "10px 20px" }}
              onClick={() => {
                setCreatedOrder(null);
                setCart({
                  "CBST-300": 0,
                  "CBST-400": 0,
                  "CBST-600": 0,
                });
                setCustomer({
                  name: "",
                  phone: "",
                  address: "",
                  area: "TP. Hồ Chí Minh",
                  source: "DIRECT",
                  notes: "",
                });
              }}
            >
              <PackagePlus size={16} strokeWidth={2} style={{ marginRight: 6 }} />
              {text(lang, "+ Tạo thêm đơn khác", "+ Create another order")}
            </button>
            {onGoToOrders && (
              <button
                type="button"
                className="admin-refresh-btn"
                style={{ padding: "10px 20px" }}
                onClick={onGoToOrders}
              >
                <ShoppingCart size={16} strokeWidth={1.8} style={{ marginRight: 6 }} />
                {text(lang, "Xem danh sách Đơn hàng", "View orders list")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="internal-order-container">
      <div className="dash-heading-row" style={{ marginBottom: 20 }}>
        <div>
          <h1 className="dash-hero-title">
            {text(lang, "Tạo đơn hàng nội bộ", "Create Internal Order")}
          </h1>
          <p className="dash-hero-sub">
            {text(
              lang,
              "Lên đơn nhanh cho khách hàng, hệ thống tự động ghi nhận doanh số và tính hoa hồng cho tài khoản của bạn.",
              "Create orders for customers with automatic attribution and commission calculation.",
            )}
          </p>
        </div>
      </div>

      <ErrorNotice error={error} lang={lang} />
      {error instanceof Error && error.message === "CHECKOUT_RECONCILIATION_REQUIRED" && (
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            className="button secondary"
            style={{ fontSize: "0.85rem", padding: "6px 14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            onClick={() => {
              try {
                window.sessionStorage.removeItem("cbst-checkout-retry");
                window.sessionStorage.removeItem("cbst-internal-checkout-retry");
              } catch {
                /* ignore */
              }
              unresolved.current = null;
              setError(null);
            }}
          >
            <RotateCcw size={14} />
            <span>{text(lang, "↺ Bỏ qua phiên dở dang và bắt đầu gửi lại đơn này", "↺ Discard pending session and retry new order")}</span>
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="internal-card-section" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
            <label htmlFor="internal-voucher-code" style={{ fontSize: "0.9rem", fontWeight: 700, color: "#1F2937", margin: 0 }}>
              {text(lang, "Mã voucher nội bộ (tuỳ chọn)", "Internal voucher code (optional)")}
            </label>
            <span style={{ fontSize: "0.8rem", color: "#6B7280" }}>
              {text(lang, "Xem báo giá trước khi xác nhận tạo đơn.", "Review price before confirming order creation.")}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="internal-voucher-code"
              name="voucherCode"
              placeholder={text(lang, "Nhập mã voucher nội bộ nếu có...", "Enter voucher code...")}
              value={voucherCode}
              onChange={(e) => {
                setVoucherCode(e.target.value.trim());
                if (pricing) setPricing(null);
              }}
              disabled={busy}
              style={{ flex: 1, padding: "9px 12px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: "0.9rem" }}
            />
            {voucherCode && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                disabled={busy || checkingQuote}
                onClick={handleCheckQuote}
                style={{ padding: "8px 14px", borderRadius: 8, fontWeight: 600, fontSize: "0.85rem" }}
              >
                {checkingQuote ? text(lang, "Đang kiểm tra…", "Checking…") : text(lang, "Kiểm tra giá", "Check quote")}
              </button>
            )}
          </div>
          <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: "#6B7280" }}>
            {text(lang, "Voucher khong cong don khuyen mai. Kiem tra gia truoc khi tao don.", "Vouchers replace public promotions. Review the quote before creating the order.")}
          </p>
          {pricing?.stale && (
            <div style={{ marginTop: 14 }}>
              <PricingReview
                quote={pricing.quote}
                lang={lang}
                stale={true}
                onConfirm={() => setPricing({ ...pricing, confirmed: true, stale: false })}
              />
            </div>
          )}
        </div>
        <div className="internal-order-grid">
          {/* Left Column: Products & Customer Details */}
          <div>
            {/* Step 1: Product Picker */}
            <div className="internal-card-section">
              <h3 className="internal-card-title">
                <Boxes size={18} strokeWidth={2} color="#D84012" />
                {text(lang, "1. Chọn sản phẩm & số lượng", "1. Select products & quantity")}
              </h3>
              <div className="product-picker-list">
                {availableProducts.map((p) => {
                  const qty = cart[p.sku] ?? 0;
                  return (
                    <div
                      key={p.sku}
                      className={`product-picker-item ${qty > 0 ? "active" : ""}`}
                    >
                      <div className="product-picker-info">
                        <span className="product-picker-name">{productName(p, lang)}</span>
                        <span className="product-picker-meta">
                          {p.sku} · {p.netWeightG}g
                        </span>
                        <span className="product-picker-price">
                          {money(p.retailPriceVnd, lang)}
                        </span>
                      </div>
                      <div className="stepper-control">
                        <button
                          type="button"
                          className="stepper-btn"
                          disabled={qty <= 0}
                          onClick={() => updateQty(p.sku, -1)}
                          aria-label="Decrease"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          className="stepper-input"
                          value={qty}
                          min={0}
                          max={100}
                          onChange={(e) => handleQtyInput(p.sku, e.target.value)}
                        />
                        <button
                          type="button"
                          className="stepper-btn"
                          disabled={qty >= 100}
                          onClick={() => updateQty(p.sku, 1)}
                          aria-label="Increase"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Customer Information */}
            <div className="internal-card-section">
              <h3 className="internal-card-title">
                <Users size={18} strokeWidth={2} color="#D84012" />
                {text(lang, "2. Thông tin người nhận", "2. Customer details")}
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#44403C", marginBottom: 6 }}>
                    {text(lang, "Họ và tên khách hàng", "Customer name")} <span className="required-mark" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder={text(lang, "Ví dụ: Nguyễn Văn A", "e.g. John Doe")}
                    value={customer.name}
                    onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #D6D3D1", fontSize: "0.92rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#44403C", marginBottom: 6 }}>
                    {text(lang, "Số điện thoại", "Phone number")} <span className="required-mark" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="0901234567"
                    value={customer.phone}
                    onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #D6D3D1", fontSize: "0.92rem" }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#44403C", marginBottom: 6 }}>
                  {text(lang, "Địa chỉ nhận hàng (Số nhà, tên đường, phường/xã)", "Shipping address")} <span className="required-mark" aria-hidden="true">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={5}
                  maxLength={500}
                  placeholder={text(lang, "Ví dụ: 123 Đường Nguyễn Trãi, Phường Bến Thành", "Street address")}
                  value={customer.address}
                  onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #D6D3D1", fontSize: "0.92rem" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#44403C", marginBottom: 6 }}>
                    {text(lang, "Khu vực / Tỉnh thành", "City / Province")} <span className="required-mark" aria-hidden="true">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    placeholder="TP. Hồ Chí Minh"
                    value={customer.area}
                    onChange={(e) => setCustomer({ ...customer, area: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #D6D3D1", fontSize: "0.92rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#44403C", marginBottom: 6 }}>
                    {text(lang, "Nguồn đơn hàng", "Order source")}
                  </label>
                  <select
                    value={customer.source}
                    onChange={(e) => setCustomer({ ...customer, source: e.target.value })}
                    style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #D6D3D1", fontSize: "0.92rem", background: "#fff" }}
                  >
                    <option value="DIRECT">{text(lang, "Trực tiếp", "Direct")}</option>
                    <option value="FACEBOOK_GROUP">{text(lang, "Facebook / Hội nhóm", "Facebook / Group")}</option>
                    <option value="WEBSITE">{text(lang, "Website", "Website")}</option>
                    <option value="OTHER">{text(lang, "Khác (Zalo/Giới thiệu)", "Other / Referral")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "#44403C", marginBottom: 6 }}>
                  {text(lang, "Ghi chú giao hàng (tuỳ chọn)", "Notes (optional)")}
                </label>
                <textarea
                  maxLength={1000}
                  rows={2}
                  placeholder={text(lang, "Ví dụ: Giao giờ hành chính, gọi trước khi giao...", "Delivery notes...")}
                  value={customer.notes}
                  onChange={(e) => setCustomer({ ...customer, notes: e.target.value })}
                  style={{ width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #D6D3D1", fontSize: "0.92rem", resize: "vertical" }}
                />
              </div>
            </div>
          </div>

          {/* Right Column: Order Summary & Action */}
          <div>
            <div className="order-summary-card">
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#1C1917", margin: "0 0 14px" }}>
                {text(lang, "Tóm tắt đơn nội bộ", "Order Summary")}
              </h3>

              <div style={{ fontSize: "0.88rem", color: "#6B7280", marginBottom: 12 }}>
                {text(lang, "Người lên đơn", "Created by")}: <b style={{ color: "#111827" }}>{actor.displayName ?? actor.role}</b>
              </div>

              <div className="summary-rows">
                <div className="summary-row">
                  <span>{text(lang, "Tổng số lượng", "Total items")}</span>
                  <b>{totalItems} {text(lang, "hũ", "jars")}</b>
                </div>
                <div className="summary-row">
                  <span>{text(lang, "Tạm tính hàng hoá", "Products subtotal")}</span>
                  <b>{money(subtotalToDisplay, lang)}</b>
                </div>
                {discountToDisplay > 0 && (
                  <div className="summary-row" style={{ color: "#16A34A" }}>
                    <span>{text(lang, "Giảm giá", "Discount")}</span>
                    <b>-{money(discountToDisplay, lang)}</b>
                  </div>
                )}
                <div className="summary-row">
                  <span>{text(lang, "Phí vận chuyển", "Shipping fee")}</span>
                  <span style={{ color: "#16A34A", fontWeight: 600 }}>{text(lang, "Miễn phí", "Free")}</span>
                </div>
                <div className="summary-row total-row">
                  <span>{text(lang, "Thu hộ COD", "Total COD")}</span>
                  <span style={{ color: "#D84012" }}>{money(totalToDisplay, lang)}</span>
                </div>
                <div className="summary-row commission-estimate">
                  <span>{text(lang, "Hoa hồng dự kiến", "Est. Commission")}</span>
                  <span>{money(Math.round(totalToDisplay * 0.1), lang)}</span>
                </div>
              </div>

              <button
                type="submit"
                className="order-submit-btn"
                disabled={busy || totalItems === 0 || !customer.name || !customer.phone || !customer.address}
              >
                <PackagePlus size={18} strokeWidth={2} />
                {busy
                  ? text(lang, "Đang gửi đơn…", "Submitting…")
                  : text(lang, "Xác nhận tạo đơn nội bộ", "Confirm & Create Order")}
              </button>

              <p style={{ fontSize: "0.78rem", color: "#78716C", marginTop: 12, textAlign: "center", lineHeight: 1.4 }}>
                {text(
                  lang,
                  "Đơn tạo xong sẽ ở trạng thái PENDING. Sau khi giao hàng thành công và thu tiền, hoa hồng sẽ tự động cộng vào tài khoản của bạn.",
                  "Created order is PENDING. Commission will be credited once delivered and settled.",
                )}
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export function MyOrdersWidget({
  orders,
  lang,
  onGoToCreate,
  onGoToAllOrders,
}: {
  orders: RecordRow[];
  lang: Lang;
  onGoToCreate?: () => void;
  onGoToAllOrders?: () => void;
}) {
  const [filter, setFilter] = useState<string>("ALL");

  const filteredOrders = orders.filter((o) => {
    if (filter === "ALL") return true;
    const status = String(o.status ?? "");
    if (filter === "PENDING") return status === "PENDING";
    if (filter === "SHIPPING") return ["CONFIRMED", "PACKING", "SHIPPING"].includes(status);
    if (filter === "DELIVERED") return status === "DELIVERED";
    if (filter === "RETURNED") return ["RETURN_REQUESTED", "PARTIALLY_RETURNED", "RETURNED", "CANCELLED", "DELIVERY_FAILED"].includes(status);
    return true;
  });

  return (
    <div className="my-orders-card">
      <div className="card-header-flex">
        <div>
          <h3>{text(lang, "Đơn hàng của tôi", "My Assigned Orders")}</h3>
          <p className="card-subtitle">
            {text(
              lang,
              "Theo dõi tiến độ giao hàng và hoa hồng thực nhận của các đơn do bạn đảm nhiệm.",
              "Track fulfillment progress and commission for your orders.",
            )}
          </p>
        </div>
        {onGoToCreate && (
          <button
            type="button"
            className="admin-refresh-btn"
            style={{ background: "#D84012", color: "#fff", borderColor: "#D84012" }}
            onClick={onGoToCreate}
          >
            <PackagePlus size={14} strokeWidth={2} style={{ marginRight: 6 }} />
            {text(lang, "+ Tạo đơn mới", "+ Create Order")}
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="filter-tab-bar">
        {[
          { key: "ALL", vi: "Tất cả", en: "All" },
          { key: "PENDING", vi: "Chờ xác nhận", en: "Pending" },
          { key: "SHIPPING", vi: "Đang xử lý / Đang giao", en: "In Transit" },
          { key: "DELIVERED", vi: "Đã giao & chốt hoa hồng", en: "Delivered & Settled" },
          { key: "RETURNED", vi: "Hoàn / Huỷ", en: "Returned / Cancelled" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`filter-tab-btn ${filter === tab.key ? "active" : ""}`}
            onClick={() => setFilter(tab.key)}
          >
            {text(lang, tab.vi, tab.en)}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="empty-orders-view">
          <Package size={36} strokeWidth={1.5} color="#A8A29E" style={{ margin: "0 auto 8px" }} />
          <p>
            {orders.length === 0
              ? text(lang, "Bạn chưa có đơn hàng nào trong danh sách.", "You have no orders yet.")
              : text(lang, "Không có đơn hàng nào trong trạng thái này.", "No orders match this filter.")}
          </p>
          {onGoToCreate && orders.length === 0 && (
            <button
              type="button"
              className="admin-refresh-btn"
              style={{ background: "#D84012", color: "#fff", borderColor: "#D84012" }}
              onClick={onGoToCreate}
            >
              <PackagePlus size={14} strokeWidth={2} style={{ marginRight: 6 }} />
              {text(lang, "Lên đơn hàng đầu tiên ngay", "Create your first order")}
            </button>
          )}
        </div>
      ) : (
        <div className="member-orders-table-wrap">
          <table className="member-orders-table">
            <thead>
              <tr>
                <th>{text(lang, "Mã đơn", "Order Code")}</th>
                <th>{text(lang, "Ngày tạo", "Date")}</th>
                <th>{text(lang, "Khách hàng", "Customer")}</th>
                <th>{text(lang, "Số điện thoại", "Phone")}</th>
                <th>{text(lang, "Tổng tiền", "Total")}</th>
                <th>{text(lang, "Trạng thái", "Status")}</th>
                <th>{text(lang, "Hoa hồng", "Commission")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.slice(0, 10).map((o) => {
                const status = String(o.status ?? "");
                const statusClass =
                  status === "DELIVERED"
                    ? "delivered"
                    : ["CONFIRMED", "PACKING", "SHIPPING"].includes(status)
                      ? "shipping"
                      : ["RETURNED", "CANCELLED", "DELIVERY_FAILED"].includes(status)
                        ? "returned"
                        : "pending";

                const cust = typeof o.customer === "object" && o.customer !== null ? o.customer as Record<string, unknown> : {};
                return (
                  <tr key={String(o.id)}>
                    <td style={{ fontFamily: "monospace", fontWeight: 700 }}>
                      #{String(o.orderCode ?? o.id ?? "").slice(0, 8).toUpperCase()}
                    </td>
                    <td>
                      {o.createdAt ? new Date(String(o.createdAt)).toLocaleDateString("vi-VN") : "—"}
                    </td>
                    <td>{String(cust.name ?? "Khách vãng lai")}</td>
                    <td>{String(cust.phone ?? "—")}</td>
                    <td style={{ fontWeight: 700 }}>
                      {money(Number(o.totalVnd ?? 0), lang)}
                    </td>
                    <td>
                      <span className={`status-badge ${statusClass}`}>
                        {label(status, lang)}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: o.commissionVnd ? "#7E22CE" : "#9CA3AF" }}>
                      {o.commissionVnd
                        ? money(Number(o.commissionVnd), lang)
                        : text(lang, "Chờ chốt", "Pending")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {onGoToAllOrders && (
            <div style={{ textAlign: "right", marginTop: 14 }}>
              <button
                type="button"
                className="admin-link-pill"
                style={{ background: "transparent", color: "#D84012", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.85rem" }}
                onClick={onGoToAllOrders}
              >
                {text(lang, "Xem toàn bộ danh sách đơn hàng →", "View all orders →")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MemberLeaderboardWidget({
  orders,
  users,
  actor,
  onChanged,
  lang,
}: {
  orders: RecordRow[];
  users: MemberUser[];
  actor: Actor;
  onChanged?: () => void;
  commissionTotal?: number;
  lang: Lang;
}) {
  const [recalculating, setRecalculating] = useState(false);
  const [commissionError, setCommissionError] = useState<unknown>(null);
  const mutation = useRef(createMutation());
  const recalculate = async () => {
    if (recalculating) return;
    setRecalculating(true);
    setCommissionError(null);
    try {
      for (const order of orders.filter((order) => order.responsibleMemberId && ["DELIVERED", "PARTIALLY_RETURNED", "RETURNED"].includes(String(order.status)))) {
        await mutation.current(`orders/${order.id}/recalculate-commission`, { expectedVersion: order.version });
      }
    } catch (error) {
      setCommissionError(error);
    } finally {
      onChanged?.();
      setRecalculating(false);
    }
  };
  const memberStats: Record<string, { memberId: string; totalOrders: number; deliveredOrders: number; revenue: number; commission: number }> = {};

  for (const o of orders) {
    const memberId = String(o.responsibleMemberId ?? "").trim() || actor.id;
    if (!memberStats[memberId]) {
      memberStats[memberId] = {
        memberId,
        totalOrders: 0,
        deliveredOrders: 0,
        revenue: 0,
        commission: 0,
      };
    }
    memberStats[memberId].totalOrders += 1;
    if (o.status === "DELIVERED") {
      memberStats[memberId].deliveredOrders += 1;
      memberStats[memberId].revenue += Number(o.totalVnd ?? 0);
      memberStats[memberId].commission += Number(o.commissionVnd ?? 0);
    }
  }

  const memberList = Object.values(memberStats).sort((a, b) => b.revenue - a.revenue);
  const memberName = (memberId: string) => {
    if (memberId === actor.id) {
      return users.find((user) => user.id === actor.id)?.displayName?.trim() || actor.displayName?.trim() || "Lê Phạm Hoài Bảo";
    }
    const user = users.find((candidate) => candidate.id === memberId);
    return user?.displayName || user?.emailNormalized || memberId;
  };

  return (
    <div className="apex-card" style={{ marginBottom: 24 }}>
      <div className="card-header-flex">
        <div>
          <h3>{text(lang, "Hiệu suất & KPI Thành viên", "Member Performance & Sales KPI")}</h3>
          <p className="card-subtitle">
            {text(
              lang,
              "Đóng góp doanh thu và hoa hồng đạt được của từng thành viên/CTV.",
              "Revenue contribution and commissions earned per sales member.",
            )}
          </p>
        </div>
      </div>

      {actor.role === "OWNER_ADMIN" && onChanged && (
        <button type="button" disabled={recalculating} onClick={recalculate}>
          {recalculating ? text(lang, "Đang cập nhật…", "Updating…") : text(lang, "Cập nhật hoa hồng các đơn đang hiển thị", "Recalculate commissions for displayed orders")}
        </button>
      )}
      <ErrorNotice error={commissionError} lang={lang} />
      {memberList.length === 0 ? (
        <div className="chart-empty-state">
          <Users size={32} strokeWidth={1.5} color="#A8A29E" style={{ margin: "0 auto 8px" }} />
          <p>
            {text(
              lang,
              "Chưa có dữ liệu hiệu suất thành viên (chưa phát sinh đơn hàng do thành viên đảm nhiệm).",
              "No member performance data yet (no member-assigned orders).",
            )}
          </p>
        </div>
      ) : (
        <div className="member-orders-table-wrap">
          <table className="member-orders-table">
            <thead>
              <tr>
                <th>{text(lang, "Thành viên / CTV", "Member")}</th>
                <th>{text(lang, "Tổng đơn", "Total Orders")}</th>
                <th>{text(lang, "Đơn thành công", "Delivered")}</th>
                <th>{text(lang, "Doanh số đem về", "Revenue")}</th>
                <th>{text(lang, "Hoa hồng đạt được", "Commission")}</th>
              </tr>
            </thead>
            <tbody>
              {memberList.map((m, idx) => (
                <tr key={m.memberId}>
                  <td style={{ fontWeight: 600 }}>
                    <span style={{ marginRight: 8, color: idx === 0 ? "#D84012" : "#78716C" }}>
                      #{idx + 1}
                    </span>
                    {memberName(m.memberId)}
                  </td>
                  <td>{m.totalOrders}</td>
                  <td style={{ fontWeight: 700, color: "#16A34A" }}>{m.deliveredOrders}</td>
                  <td style={{ fontWeight: 700 }}>{money(m.revenue, lang)}</td>
                  <td style={{ fontWeight: 700, color: "#7E22CE" }}>{money(m.commission, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function MediaManager({ lang }: { lang: Lang }) {
  const [gallery, setGallery] = useState<MediaItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cbst_media_gallery");
        if (saved) return JSON.parse(saved);
      } catch {
        /* ignore */
      }
    }
    return INITIAL_MEDIA_ITEMS; // [] — seeded from BE on mount
  });

  const [assignedMap, setAssignedMap] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cbst_product_images");
        if (saved) return JSON.parse(saved);
      } catch {
        /* ignore */
      }
    }
    return {}; // seeded from BE on mount
  });

  const [cloudName, setCloudName] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("cbst_cloudinary_cloud_name") || "cbst-media";
    }
    return "cbst-media";
  });

  const [uploadPreset] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("cbst_cloudinary_preset") || "";
    }
    return "";
  });

  useEffect(() => {
    fetch("/api/upload")
      .then((res) => res.json())
      .then((data) => {
        if (data?.cloudName) {
          setCloudName(data.cloudName);
        }
      })
      .catch(() => {});

    fetch("/api/media")
      .then((res) => res.json())
      .then((resData) => {
        if (resData?.success) {
          if (resData.images && Object.keys(resData.images).length > 0) {
            // BE is authoritative — overwrite local cache entirely
            setAssignedMap(resData.images);
            try {
              localStorage.setItem("cbst_product_images", JSON.stringify(resData.images));
            } catch {
              /* ignore */
            }
          }
          if (resData.gallery && resData.gallery.length > 0) {
            // BE gallery wins — merge with any locally-created items not yet persisted
            setGallery((prev) => {
              const ids = new Set<string>(resData.gallery.map((g: MediaItem) => g.id));
              return [...resData.gallery, ...prev.filter((p) => !ids.has(p.id))];
            });
            try {
              localStorage.setItem("cbst_media_gallery", JSON.stringify(resData.gallery));
            } catch {
              /* ignore */
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  const [tab, setTab] = useState<"slots" | "gallery" | "upload" | "settings">("slots");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("ALL");
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Upload & Add Form State
  const [uploadMode, setUploadMode] = useState<"url" | "file">("file");
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newTag, setNewTag] = useState("CBST-300");
  const [newDesc, setNewDesc] = useState("");
  const [assignTarget, setAssignTarget] = useState<string>("CBST-300");
  const [fileData, setFileData] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const saveAssigned = (next: Record<string, string>) => {
    setAssignedMap(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("cbst_product_images", JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("cbst_images_updated", { detail: { assignedMap: next } }));
      } catch {
        /* ignore */
      }
    }
    fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: next }),
    }).catch(() => {});
  };

  const saveGallery = (next: MediaItem[]) => {
    setGallery(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("cbst_media_gallery", JSON.stringify(next));
      } catch {
        /* ignore */
      }
    }
    fetch("/api/media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gallery: next }),
    }).catch(() => {});
  };

  const handleAssign = (slotKey: string, url: string) => {
    const next = { ...assignedMap, [slotKey]: url };
    saveAssigned(next);
    const slot = MEDIA_SLOTS.find((s) => s.key === slotKey);
    setNotice({
      type: "success",
      msg: text(
        lang,
        `Đã gán ảnh thành công cho: ${slot ? slot.labelVi : slotKey}`,
        `Image assigned to: ${slot ? slot.labelEn : slotKey}`,
      ),
    });
  };

  const handleResetSlot = (slotKey: string) => {
    // Remove the slot assignment — leave it empty so the UI shows a placeholder
    const next = { ...assignedMap };
    delete next[slotKey];
    saveAssigned(next);
    setNotice({
      type: "success",
      msg: text(lang, "Đã xóa ảnh khỏi vị trí này.", "Slot image removed."),
    });
  };

  const handleResetAll = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        text(
          lang,
          "Bạn có chắc chắn muốn xóa toàn bộ ảnh đã gán và bể chứa?",
          "Are you sure you want to clear all assigned images and the media pool?",
        ),
      )
    ) {
      return;
    }
    saveAssigned({});
    saveGallery([]);
    setNotice({
      type: "success",
      msg: text(lang, "Đã xóa toàn bộ ảnh đã gán và bể chứa.", "Cleared all media."),
    });
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      setCopiedUrl(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    if (!newTitle) {
      setNewTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setFileData(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAddMedia = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    setUploading(true);

    try {
      let finalUrl = newUrl.trim();

      if (uploadMode === "file") {
        if (!fileData) {
          throw new Error(text(lang, "Vui lòng chọn 1 tệp ảnh để tải lên.", "Please select an image file to upload."));
        }

        // fileData is a base64 data-URL string from FileReader.readAsDataURL.
        // The upload route's JSON path accepts { file: "data:image/...;base64,..." }
        // directly. Using FormData here would send a plain string (not a Blob) which
        // fails the route's `file instanceof Blob` check → INVALID_IMAGE.
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file: fileData }),
        });

        const cdnData = await res.json().catch(() => ({}));
        if (!res.ok || !cdnData.success) {
          throw new Error(cdnData.error || text(lang, "Tải ảnh lên Cloudinary thất bại.", "Cloudinary upload failed."));
        }

        finalUrl = cdnData.url;
      }

      if (!finalUrl) {
        throw new Error(text(lang, "Vui lòng cung cấp URL ảnh hoặc tải tệp lên.", "Please provide an image URL or upload a file."));
      }

      const now = new Date().toISOString();
      const newItem: MediaItem = {
        id: `media-${Date.now()}`,
        url: finalUrl,
        title: newTitle.trim() || text(lang, "Ảnh tải lên", "Uploaded Image"),
        tag: newTag,
        description: newDesc.trim(),
        createdAt: now.slice(0, 10),
        updatedAt: now,
      };

      // Persist MediaAsset to BE immediately (aligns with BE MediaAsset schema)
      await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gallery: [newItem],
          // Also assign slot if requested so mediaSlots is updated in the same call
          ...(assignTarget && assignTarget !== "none"
            ? { images: { ...assignedMap, [assignTarget]: finalUrl } }
            : {}),
        }),
      }).catch(() => {});

      const nextGallery = [newItem, ...gallery];
      setGallery(nextGallery);
      try { localStorage.setItem("cbst_media_gallery", JSON.stringify(nextGallery)); } catch { /* ignore */ }

      if (assignTarget && assignTarget !== "none") {
        handleAssign(assignTarget, finalUrl);
      }

      setNewUrl("");
      setNewTitle("");
      setNewDesc("");
      setFileData(null);
      setFileName("");
      setNotice({
        type: "success",
        msg: text(lang, "Đã thêm ảnh vào bể chứa thành công!", "Added image to media pool successfully!"),
      });
      setTab("slots");
    } catch (err: unknown) {
      setNotice({
        type: "error",
        msg: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMedia = (id: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(text(lang, "Xác nhận xóa ảnh này khỏi bể chứa?", "Remove this photo from the media pool?"))
    ) {
      return;
    }
    const nextGallery = gallery.filter((item) => item.id !== id);
    saveGallery(nextGallery);
    setNotice({
      type: "success",
      msg: text(lang, "Đã xóa ảnh khỏi bể chứa.", "Image removed from pool."),
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      localStorage.setItem("cbst_cloudinary_cloud_name", cloudName.trim());
      localStorage.setItem("cbst_cloudinary_preset", uploadPreset.trim());
    }
    setNotice({
      type: "success",
      msg: text(lang, "Đã lưu thông tin cấu hình Cloudinary!", "Cloudinary settings saved successfully!"),
    });
  };

  const filteredGallery = gallery.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.tag.toLowerCase().includes(search.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(search.toLowerCase()));
    const matchesTag = tagFilter === "ALL" || item.tag === tagFilter;
    return matchesSearch && matchesTag;
  });

  return (
    <div className="media-manager-container">
      {/* 1. Header Row */}
      <div className="dash-heading-row" style={{ marginBottom: 20 }}>
        <div>
          <div className="admin-eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={14} color="#D84012" />
            {text(lang, "HỆ THỐNG / KHO HÌNH ẢNH & BỂ CHỨA MEDIA", "SYSTEM / MEDIA & IMAGE REPOSITORY")}
          </div>
          <h1 className="dash-hero-title">
            {text(lang, "Kho hình ảnh & Bể chứa Media", "Media Library & CDN Pool")}
          </h1>
          <p className="dash-hero-sub">
            {text(
              lang,
              "Quản lý bể chứa hình ảnh và gán ảnh trực tiếp lên các vị trí trên Landing Page (hũ 300g, 400g, 600g, bảng size, bảng giá, mã Zalo). Hỗ trợ tải tệp hoặc Cloudinary CDN.",
              "Manage image pool and map product photos, size & price posters, and QR codes to the Landing Page with Cloudinary CDN support.",
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            className="admin-refresh-btn"
            style={{ background: "#D84012", color: "#fff", borderColor: "#D84012" }}
            onClick={() => setTab("upload")}
          >
            <UploadCloud size={16} strokeWidth={2} style={{ marginRight: 6 }} />
            {text(lang, "+ Thêm ảnh mới", "+ Add Photo")}
          </button>
          <button
            type="button"
            className="admin-refresh-btn"
            onClick={() => setTab("settings")}
            title="Cấu hình Cloudinary"
          >
            <Settings size={16} strokeWidth={1.8} style={{ marginRight: 6 }} />
            Cloudinary
          </button>
          <button
            type="button"
            className="admin-refresh-btn"
            onClick={handleResetAll}
            title="Khôi phục ảnh mặc định"
          >
            <RotateCcw size={14} strokeWidth={1.8} style={{ marginRight: 6 }} />
            {text(lang, "Đặt lại gốc", "Reset")}
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div
          className="notice"
          role="status"
          style={{
            borderLeftColor: notice.type === "success" ? "#16A34A" : "#DC2626",
            background: notice.type === "success" ? "#F0FDF4" : "#FEF2F2",
            color: notice.type === "success" ? "#15803D" : "#991B1B",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 18px",
            borderRadius: "10px",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {notice.type === "success" ? (
              <CheckCircle2 size={18} color="#16A34A" />
            ) : (
              <AlertCircle size={18} color="#DC2626" />
            )}
            <span>{notice.msg}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Cloudinary Status Bar */}
      <div className="media-cloudinary-status-bar">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="media-status-pill">
            <span className="dot dot-green" />
            {cloudName ? `Cloudinary Cloud: ${cloudName}` : "Cloudinary: Direct Mode"}
          </span>
          <span className="media-status-pill">
            <Boxes size={14} strokeWidth={2} />
            {text(lang, `${MEDIA_SLOTS.length}/8 Vị trí đã áp dụng`, `${MEDIA_SLOTS.length}/8 Active Slots`)}
          </span>
          <span className="media-status-pill">
            <ImageIcon size={14} strokeWidth={2} />
            {text(lang, `${gallery.length} Hình ảnh trong bể chứa`, `${gallery.length} Photos in Pool`)}
          </span>
        </div>
        <div style={{ fontSize: "0.82rem", color: "#64748b" }}>
          {text(
            lang,
            "Tự động nén WebP / AVIF & tải nhanh trên toàn cầu qua CDN",
            "Auto WebP / AVIF compression & global CDN delivery",
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="media-tab-bar">
        <button
          type="button"
          className={`media-tab-btn ${tab === "slots" ? "active" : ""}`}
          onClick={() => setTab("slots")}
        >
          <Boxes size={16} strokeWidth={2} />
          <span>{text(lang, "1. Vị trí hiển thị (Live Slots)", "1. Live Slots")}</span>
          <span className="tab-badge">{MEDIA_SLOTS.length}</span>
        </button>
        <button
          type="button"
          className={`media-tab-btn ${tab === "gallery" ? "active" : ""}`}
          onClick={() => setTab("gallery")}
        >
          <ImageIcon size={16} strokeWidth={2} />
          <span>{text(lang, "2. Bể chứa Media (Gallery)", "2. Media Pool Gallery")}</span>
          <span className="tab-badge">{gallery.length}</span>
        </button>
        <button
          type="button"
          className={`media-tab-btn ${tab === "upload" ? "active" : ""}`}
          onClick={() => setTab("upload")}
        >
          <UploadCloud size={16} strokeWidth={2} />
          <span>{text(lang, "3. Thêm ảnh vào bể chứa", "3. Add New Photo")}</span>
        </button>
        <button
          type="button"
          className={`media-tab-btn ${tab === "settings" ? "active" : ""}`}
          onClick={() => setTab("settings")}
        >
          <Settings size={16} strokeWidth={2} />
          <span>{text(lang, "4. Cấu hình Cloudinary", "4. Cloudinary Settings")}</span>
        </button>
      </div>

      {/* TAB 1: LIVE SLOTS */}
      {tab === "slots" && (
        <div>
          <div className="media-section-header">
            <div>
              <h3>{text(lang, "Vị trí hình ảnh trên Landing Page", "Landing Page Image Slots")}</h3>
              <p className="media-section-sub">
                {text(
                  lang,
                  "Mỗi vị trí hiển thị hình ảnh tương ứng trên website. Chọn ảnh từ bể chứa để thay đổi ngay lập tức.",
                  "Each slot maps to a key section on the storefront. Select any photo from your pool to switch instantly.",
                )}
              </p>
            </div>
            <button
              type="button"
              className="admin-refresh-btn"
              onClick={() => setTab("upload")}
              style={{ background: "#D84012", color: "#fff", borderColor: "#D84012" }}
            >
              <Plus size={14} strokeWidth={2} style={{ marginRight: 6 }} />
              {text(lang, "Tải thêm ảnh mới", "Upload New Photo")}
            </button>
          </div>

          <div className="media-slots-grid">
            {MEDIA_SLOTS.map((slot) => {
              const currentUrl = assignedMap[slot.key] || DEFAULT_PRODUCT_IMAGES[slot.key] || "";
              const isDefault = currentUrl === DEFAULT_PRODUCT_IMAGES[slot.key];

              return (
                <div key={slot.key} className="media-slot-card">
                  <div className="media-slot-header">
                    <div>
                      <h4 className="media-slot-title">
                        {lang === "vi" ? slot.labelVi : slot.labelEn}
                      </h4>
                      <span className="media-slot-key">{slot.key}</span>
                    </div>
                    <span className={`media-slot-badge ${isDefault ? "default" : "custom"}`}>
                      {isDefault
                        ? text(lang, "Mặc định", "Default")
                        : text(lang, "Tùy chỉnh", "Custom")}
                    </span>
                  </div>

                  <div
                    className="media-slot-thumb"
                    onClick={() => setLightboxImg(currentUrl)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setLightboxImg(currentUrl);
                    }}
                    title={text(lang, "Nhấn để xem ảnh phóng to", "Click to enlarge photo")}
                  >
                    <img src={currentUrl} alt={slot.labelVi} loading="lazy" />
                    <span className="zoom-hint">
                      <ZoomIn size={14} strokeWidth={2} />
                      {text(lang, "Phóng to", "Zoom")}
                    </span>
                  </div>

                  <p className="media-slot-desc">
                    {lang === "vi" ? slot.descVi : slot.descEn}
                  </p>

                  <div className="media-slot-actions">
                    <label className="media-select-label">
                      <span>{text(lang, "Đổi ảnh:", "Change:")}</span>
                      <select
                        value={currentUrl}
                        onChange={(e) => handleAssign(slot.key, e.target.value)}
                        className="media-select-input"
                      >
                        {gallery.map((g) => (
                          <option key={g.id} value={g.url}>
                            {g.title} ({g.tag})
                          </option>
                        ))}
                      </select>
                    </label>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                      <button
                        type="button"
                        className="media-btn-text"
                        onClick={() => copyUrl(currentUrl)}
                      >
                        <Copy size={13} strokeWidth={2} />
                        {copiedUrl === currentUrl
                          ? text(lang, "Đã chép!", "Copied!")
                          : text(lang, "Sao chép link", "Copy URL")}
                      </button>

                      {!isDefault && (
                        <button
                          type="button"
                          className="media-btn-text danger"
                          onClick={() => handleResetSlot(slot.key)}
                        >
                          <RotateCcw size={13} strokeWidth={2} />
                          {text(lang, "Về mặc định", "Revert")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: GALLERY POOL */}
      {tab === "gallery" && (
        <div>
          <div className="media-section-header">
            <div>
              <h3>{text(lang, "Bể chứa Media (Image Gallery Pool)", "Image Gallery Pool")}</h3>
              <p className="media-section-sub">
                {text(
                  lang,
                  "Tất cả hình ảnh đã lưu trong hệ thống. Bạn có thể xem lớn, sao chép link CDN hoặc gán trực tiếp vào bất kỳ vị trí nào.",
                  "All stored media assets. Preview, copy CDN links, or map directly to any storefront slot.",
                )}
              </p>
            </div>
            <button
              type="button"
              className="admin-refresh-btn"
              onClick={() => setTab("upload")}
              style={{ background: "#D84012", color: "#fff", borderColor: "#D84012" }}
            >
              <UploadCloud size={14} strokeWidth={2} style={{ marginRight: 6 }} />
              {text(lang, "+ Thêm ảnh", "+ Add Photo")}
            </button>
          </div>

          {/* Search & Tag Filter Bar */}
          <div className="media-filter-bar">
            <div className="media-search-input-wrap">
              <Search size={16} strokeWidth={2} color="#94A3B8" />
              <input
                type="text"
                placeholder={text(lang, "Tìm kiếm theo tên ảnh, tag...", "Search by title or tag...")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="media-search-input"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "#94a3b8" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="media-tags-row">
              {[
                { tag: "ALL", label: text(lang, "Tất cả", "All") },
                { tag: "CBST-300", label: "300g" },
                { tag: "CBST-400", label: "400g" },
                { tag: "CBST-600", label: "600g" },
                { tag: "bang-size", label: text(lang, "Bảng size", "Size poster") },
                { tag: "bang-gia", label: text(lang, "Bảng giá", "Price list") },
                { tag: "zalo-qr", label: "Zalo QR" },
                { tag: "group-3", label: text(lang, "Bộ 3 hũ", "3 Jars") },
                { tag: "hero-pot", label: text(lang, "Niêu cá", "Claypot") },
              ].map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  className={`media-tag-pill ${tagFilter === t.tag ? "active" : ""}`}
                  onClick={() => setTagFilter(t.tag)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {filteredGallery.length === 0 ? (
            <div className="media-empty-card">
              <ImageIcon size={44} strokeWidth={1.5} color="#94A3B8" />
              <h4>{text(lang, "Không tìm thấy hình ảnh phù hợp", "No matching photos found")}</h4>
              <p>
                {text(
                  lang,
                  "Thử đổi từ khóa tìm kiếm hoặc bấm nút bên dưới để thêm hình ảnh mới vào bể chứa.",
                  "Try another keyword or add a new image to the pool.",
                )}
              </p>
              <button
                type="button"
                className="admin-refresh-btn"
                style={{ background: "#D84012", color: "#fff", borderColor: "#D84012" }}
                onClick={() => setTab("upload")}
              >
                <Plus size={14} strokeWidth={2} style={{ marginRight: 6 }} />
                {text(lang, "Thêm ảnh mới ngay", "Add photo now")}
              </button>
            </div>
          ) : (
            <div className="media-gallery-grid">
              {filteredGallery.map((item) => {
                // Find all slots currently using this image
                const activeInSlots = MEDIA_SLOTS.filter((s) => assignedMap[s.key] === item.url);

                return (
                  <div key={item.id} className="media-gallery-card">
                    <div
                      className="media-gallery-thumb"
                      onClick={() => setLightboxImg(item.url)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setLightboxImg(item.url);
                      }}
                      title={text(lang, "Nhấn để phóng to ảnh", "Click to enlarge")}
                    >
                      <img src={item.url} alt={item.title} loading="lazy" />
                      <span className="zoom-hint">
                        <ZoomIn size={14} strokeWidth={2} />
                        {text(lang, "Phóng to", "Zoom")}
                      </span>
                    </div>

                    <div className="media-gallery-meta">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <strong className="media-item-title">{item.title}</strong>
                        <span className="media-item-tag">{item.tag}</span>
                      </div>

                      {item.description && (
                        <p className="media-item-desc">{item.description}</p>
                      )}

                      {activeInSlots.length > 0 && (
                        <div className="media-active-slots-strip">
                          <Check size={12} strokeWidth={2.5} color="#16A34A" />
                          <span>
                            {text(lang, "Đang dùng cho:", "Live on:")}{" "}
                            <b>{activeInSlots.map((s) => (lang === "vi" ? s.labelVi : s.labelEn)).join(", ")}</b>
                          </span>
                        </div>
                      )}

                      <div className="media-gallery-toolbar">
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", width: "100%" }}>
                          <button
                            type="button"
                            className="media-action-pill"
                            onClick={() => copyUrl(item.url)}
                          >
                            <Copy size={13} strokeWidth={2} />
                            {copiedUrl === item.url
                              ? text(lang, "Đã chép!", "Copied!")
                              : text(lang, "Chép link", "Copy link")}
                          </button>

                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="media-action-pill"
                            title="Mở tab mới"
                          >
                            <ExternalLink size={13} strokeWidth={2} />
                            {text(lang, "Mở gốc", "Open")}
                          </a>

                          <button
                            type="button"
                            className="media-action-pill danger"
                            onClick={() => handleDeleteMedia(item.id)}
                            title="Xóa khỏi bể chứa"
                          >
                            <Trash2 size={13} strokeWidth={2} />
                            {text(lang, "Xóa", "Delete")}
                          </button>
                        </div>

                        {/* Quick Assign Dropdown */}
                        <div style={{ width: "100%", marginTop: 8 }}>
                          <label className="media-assign-label">
                            <span>{text(lang, "Gán ảnh này vào vị trí:", "Assign photo to:")}</span>
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAssign(e.target.value, item.url);
                                  e.target.value = "";
                                }
                              }}
                              className="media-select-input"
                              defaultValue=""
                            >
                              <option value="" disabled>
                                {text(lang, "— Chọn vị trí để áp dụng —", "— Choose slot to apply —")}
                              </option>
                              {MEDIA_SLOTS.map((s) => (
                                <option key={s.key} value={s.key}>
                                  {lang === "vi" ? s.labelVi : s.labelEn} ({s.key})
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ADD NEW PHOTO */}
      {tab === "upload" && (
        <div className="media-form-container">
          <div className="media-section-header">
            <div>
              <h3>{text(lang, "Thêm hình ảnh vào bể chứa Media", "Add Photo to Media Pool")}</h3>
              <p className="media-section-sub">
                {text(
                  lang,
                  "Bạn có thể dán đường dẫn URL Cloudinary CDN (hoặc bất kỳ liên kết ảnh trực tiếp nào) hoặc tải tệp trực tiếp từ thiết bị.",
                  "Paste a Cloudinary CDN link (or any direct image URL) or upload a file directly from your device.",
                )}
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="media-mode-switcher">
            <button
              type="button"
              className={`media-mode-btn ${uploadMode === "url" ? "active" : ""}`}
              onClick={() => setUploadMode("url")}
            >
              <LinkIcon size={16} strokeWidth={2} />
              <span>{text(lang, "Dán liên kết URL (Cloudinary / CDN)", "Paste URL Link (Cloudinary / CDN)")}</span>
            </button>
            <button
              type="button"
              className={`media-mode-btn ${uploadMode === "file" ? "active" : ""}`}
              onClick={() => setUploadMode("file")}
            >
              <UploadCloud size={16} strokeWidth={2} />
              <span>{text(lang, "Tải tệp từ máy tính / điện thoại", "Upload from Device")}</span>
            </button>
          </div>

          <form onSubmit={handleAddMedia} className="media-form">
            <div className="form-grid">
              {uploadMode === "url" ? (
                <label className="wide">
                  <span>{text(lang, "URL hình ảnh (Cloudinary, Web CDN...)", "Image URL (Cloudinary, CDN...)")} <span className="required-mark" aria-hidden="true">*</span></span>
                  <input
                    type="url"
                    required
                    placeholder="https://res.cloudinary.com/.../cbst-300.webp hoặc /images/gia-size-nho.png"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                  />
                  <small style={{ color: "#64748b", marginTop: 4 }}>
                    {text(
                      lang,
                      "Mẹo Cloudinary: Thêm f_auto,q_auto vào đường dẫn Cloudinary để tự động nén WebP/AVIF tối ưu tốc độ.",
                      "Cloudinary Tip: Add f_auto,q_auto to your Cloudinary URL for auto WebP/AVIF compression.",
                    )}
                  </small>
                </label>
              ) : (
                <label className="wide">
                  <span>{text(lang, "Chọn tệp hình ảnh", "Select Image File")} <span className="required-mark" aria-hidden="true">*</span></span>
                  <input
                    type="file"
                    accept="image/*"
                    required={!fileData}
                    onChange={handleFileChange}
                  />
                  {fileName && (
                    <small style={{ color: "#16A34A", marginTop: 4, fontWeight: 600 }}>
                      ✓ {fileName}
                    </small>
                  )}
                  <small style={{ color: "#64748b", marginTop: 4 }}>
                    {cloudName && uploadPreset
                      ? text(lang, "✓ Sẽ tự động tải lên Cloudinary CDN của bạn.", "✓ Will upload directly to your Cloudinary CDN.")
                      : text(lang, "Hệ thống sẽ lưu trữ và hiển thị ảnh ngay lập tức.", "Will store and render photo instantly.")}
                  </small>
                </label>
              )}

              <label>
                <span>{text(lang, "Tiêu đề hình ảnh", "Image Title")} <span className="required-mark" aria-hidden="true">*</span></span>
                <input
                  type="text"
                  required
                  placeholder={text(lang, "Ví dụ: Hũ cá bống 300g chụp cận cảnh", "E.g.: 300g Jar close-up")}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </label>

              <label>
                <span>{text(lang, "Phân loại / Tag", "Category / Tag")}</span>
                <select value={newTag} onChange={(e) => setNewTag(e.target.value)}>
                  <option value="CBST-300">Hũ 300g (CBST-300)</option>
                  <option value="CBST-400">Hũ 400g (CBST-400)</option>
                  <option value="CBST-600">Hũ 600g (CBST-600)</option>
                  <option value="bang-size">Bảng quy cách (bang-size)</option>
                  <option value="bang-gia">Bảng giá niêm yết (bang-gia)</option>
                  <option value="zalo-qr">Mã QR Zalo (zalo-qr)</option>
                  <option value="group-3">Bộ 3 hũ thực tế (group-3)</option>
                  <option value="hero-pot">Niêu cá kho quê (hero-pot)</option>
                  <option value="other">{text(lang, "Khác (Other)", "Other")}</option>
                </select>
              </label>

              <label className="wide">
                <span>{text(lang, "Ghi chú / Mô tả ngắn", "Description / Notes")}</span>
                <input
                  type="text"
                  placeholder={text(lang, "Mô tả chất lượng, góc chụp, dung tích...", "Short description...")}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </label>

              <label className="wide" style={{ background: "#F8FAFC", padding: 14, borderRadius: 10, border: "1px dashed #CBD5E1" }}>
                <span style={{ fontWeight: 700, color: "#D84012" }}>
                  ✦ {text(lang, "Gán ngay vào vị trí Landing Page sau khi lưu", "Assign immediately to Landing Page slot")}
                </span>
                <select
                  value={assignTarget}
                  onChange={(e) => setAssignTarget(e.target.value)}
                  style={{ marginTop: 6 }}
                >
                  <option value="none">{text(lang, "— Chỉ lưu vào bể chứa, không gán ngay —", "— Store in pool only, do not map —")}</option>
                  {MEDIA_SLOTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {lang === "vi" ? s.labelVi : s.labelEn} ({s.key})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Preview Box */}
            {(newUrl || fileData) && (
              <div style={{ marginTop: 16, padding: 16, background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0" }}>
                <strong style={{ fontSize: "0.85rem", color: "#64748B", display: "block", marginBottom: 8 }}>
                  {text(lang, "Xem trước hình ảnh:", "Image Preview:")}
                </strong>
                <div style={{ maxHeight: 180, display: "flex", justifyContent: "center" }}>
                  <img
                    src={uploadMode === "file" ? (fileData || "") : newUrl}
                    alt="Preview"
                    style={{ maxHeight: 180, objectFit: "contain", borderRadius: 8 }}
                  />
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
              <button
                type="submit"
                disabled={uploading || (uploadMode === "url" && !newUrl) || (uploadMode === "file" && !fileData)}
                style={{ background: "#D84012", borderColor: "#D84012", color: "#fff", padding: "12px 28px" }}
              >
                {uploading ? (
                  <>
                    <RefreshCw size={16} className="spin" style={{ marginRight: 6 }} />
                    {text(lang, "Đang xử lý tải lên…", "Uploading…")}
                  </>
                ) : (
                  <>
                    <Check size={16} strokeWidth={2.5} style={{ marginRight: 6 }} />
                    {text(lang, "Lưu vào bể chứa & Áp dụng ngay", "Save to Pool & Apply")}
                  </>
                )}
              </button>

              <button
                type="button"
                className="secondary"
                onClick={() => setTab("slots")}
              >
                {text(lang, "Quay lại danh sách", "Cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 4: CLOUDINARY SETTINGS */}
      {tab === "settings" && (
        <div className="media-form-container">
          <div className="media-section-header">
            <div>
              <h3>{text(lang, "Cấu hình tài khoản Cloudinary CDN", "Cloudinary CDN Settings")}</h3>
              <p className="media-section-sub">
                {text(
                  lang,
                  "Kết nối tài khoản Cloudinary miễn phí (25GB storage & băng thông) để tối ưu hóa hình ảnh WebP/AVIF và tốc độ tải trang.",
                  "Connect your free Cloudinary account (25GB storage & bandwidth) for automatic WebP/AVIF optimization.",
                )}
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="media-form">
            <div className="form-grid">
              <label>
                <span>{text(lang, "Cloudinary Cloud Name", "Cloudinary Cloud Name")} <span className="required-mark" aria-hidden="true">*</span></span>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: cbst-media hoặc tên cloud của bạn"
                  value={cloudName}
                  onChange={(e) => setCloudName(e.target.value)}
                />
                <small style={{ color: "#64748b", marginTop: 4 }}>
                  {text(lang, "Lấy tại Cloudinary Dashboard (Dashboard -> Cloud Name)", "From Cloudinary Dashboard -> Cloud Name")}
                </small>
              </label>

              <label>
                <span>{text(lang, "API Key", "API Key")}</span>
                <input
                  type="text"
                  readOnly
                  value="Configured on server"
                  style={{ background: "#F1F5F9", cursor: "default", color: "#334155" }}
                />
                <small style={{ color: "#16A34A", marginTop: 4, fontWeight: 600 }}>
                  ✓ {text(lang, "Đã tích hợp trong Server ENV", "Configured in Server ENV")}
                </small>
              </label>

              <label>
                <span>{text(lang, "API Secret", "API Secret")}</span>
                <input
                  type="password"
                  readOnly
                  value="configured-on-server"
                  style={{ background: "#F1F5F9", cursor: "default", color: "#334155" }}
                />
                <small style={{ color: "#16A34A", marginTop: 4, fontWeight: 600 }}>
                  ✓ {text(lang, "Đã bảo mật trong Server ENV (Signed Upload)", "Secured in Server ENV (Signed Upload)")}
                </small>
              </label>
            </div>

            {/* Cloudinary Perks Callout */}
            <div className="media-info-card" style={{ marginTop: 20 }}>
              <h4 style={{ margin: "0 0 8px", color: "#1E293B", display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={18} color="#D84012" />
                {text(lang, "Lợi ích khi kết nối Cloudinary CDN cho Cá Bống Sông Trà:", "Why Cloudinary for Ca Bong Song Tra:")}
              </h4>
              <ul style={{ margin: 0, paddingLeft: 20, color: "#475569", lineHeight: 1.7, fontSize: "0.88rem" }}>
                <li>
                  <b>{text(lang, "Tự động tối ưu WebP/AVIF:", "Auto WebP/AVIF:")}</b>{" "}
                  {text(
                    lang,
                    "Tự động chuyển đổi sang định dạng nhẹ nhất tùy theo trình duyệt của khách hàng, tiết kiệm 70% dung lượng.",
                    "Converts images automatically to optimal formats, reducing load time and data by 70%.",
                  )}
                </li>
                <li>
                  <b>{text(lang, "Tốc độ tải trang cực nhanh:", "Blazing fast delivery:")}</b>{" "}
                  {text(
                    lang,
                    "Hình ảnh được lưu trên mạng lưới CDN toàn cầu, khách hàng bấm vào mở xem ngay lập tức.",
                    "Images are distributed globally via high-speed CDN servers.",
                  )}
                </li>
                <li>
                  <b>{text(lang, "Dung lượng miễn phí lớn:", "Generous free tier:")}</b>{" "}
                  {text(lang, "25GB lưu trữ và 25GB băng thông hàng tháng hoàn toàn miễn phí.", "25GB monthly storage & bandwidth free forever.")}
                </li>
              </ul>
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
              <button
                type="submit"
                style={{ background: "#D84012", borderColor: "#D84012", color: "#fff", padding: "12px 28px" }}
              >
                <Check size={16} strokeWidth={2.5} style={{ marginRight: 6 }} />
                {text(lang, "Lưu cài đặt Cloudinary", "Save Cloudinary Settings")}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setTab("slots")}
              >
                {text(lang, "Xong / Quay lại", "Done")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LIGHTBOX PREVIEW MODAL */}
      {lightboxImg && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxImg(null)}
          role="dialog"
          aria-modal="true"
          aria-label={text(lang, "Xem ảnh phóng to", "Enlarge image")}
        >
          <div
            className="lightbox-dialog lightbox-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 840 }}
          >
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setLightboxImg(null)}
              aria-label={text(lang, "Đóng", "Close")}
            >
              <X size={20} strokeWidth={2} />
            </button>
            <div style={{ background: "#faf8f5", padding: 20, display: "flex", justifyContent: "center" }}>
              <img
                src={lightboxImg}
                alt="Ảnh phóng to"
                style={{ maxHeight: "72vh", maxWidth: "100%", objectFit: "contain", borderRadius: 8 }}
              />
            </div>
            <div className="lightbox-footer" style={{ padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.85rem", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 450 }}>
                <code>{lightboxImg}</code>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="button secondary"
                  style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                  onClick={() => copyUrl(lightboxImg)}
                >
                  <Copy size={13} strokeWidth={2} style={{ marginRight: 4 }} />
                  {copiedUrl === lightboxImg ? text(lang, "Đã chép!", "Copied!") : text(lang, "Chép link", "Copy link")}
                </button>
                <a
                  href={lightboxImg}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button"
                  style={{ padding: "6px 14px", fontSize: "0.82rem", background: "#D84012", borderColor: "#D84012", color: "#fff" }}
                >
                  <ExternalLink size={13} strokeWidth={2} style={{ marginRight: 4 }} />
                  {text(lang, "Mở tab mới", "Open")}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersTable({
  orders,
  allUsers,
  owner,
  lang,
  onSelect,
  onCreateNew,
}: {
  orders: RecordRow[];
  allUsers: MemberUser[];
  owner: boolean;
  lang: Lang;
  onSelect: (order: RecordRow) => void;
  onCreateNew: () => void;
}) {
  if (!orders.length) {
    return (
      <div style={{ textAlign: "center", padding: "48px 20px", background: "#FAF8F5", borderRadius: 12, border: "1px dashed #D6D3D1", margin: "16px 0" }}>
        <ShoppingCart size={40} strokeWidth={1.5} color="#9CA3AF" style={{ margin: "0 auto 12px" }} />
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#374151", margin: "0 0 6px" }}>
          {text(lang, "Chưa có đơn hàng nào", "No orders found")}
        </h3>
        <p style={{ fontSize: "0.9rem", color: "#6B7280", maxWidth: 450, margin: "0 auto 16px" }}>
          {owner
            ? text(lang, "Hệ thống chưa ghi nhận đơn hàng nào. Bấm nút bên dưới để tạo đơn hàng nội bộ mới.", "No orders recorded yet. Click below to create a new order.")
            : text(lang, "Bạn chưa có đơn hàng nào. Hãy lên đơn mới để bắt đầu tích lũy doanh số và hoa hồng.", "You don't have any orders yet. Create an order to start earning commissions.")}
        </p>
        <button
          type="button"
          onClick={onCreateNew}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, padding: "9px 18px", borderRadius: 8, background: "#D84012", color: "#fff", border: "none", cursor: "pointer" }}
        >
          <PackagePlus size={16} strokeWidth={2} />
          <span>{text(lang, "+ Tạo đơn hàng ngay", "+ Create order now")}</span>
        </button>
      </div>
    );
  }

  const getMemberName = (memberId?: string | null) => {
    if (!memberId) return text(lang, "Chủ cửa hàng (Admin)", "Owner (Direct)");
    const user = allUsers.find((u) => u.id === memberId);
    return user ? (user.displayName || user.emailNormalized) : memberId;
  };

  const statusColors: Record<string, { bg: string; color: string; border: string }> = {
    PENDING: { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
    CONFIRMED: { bg: "#DBEAFE", color: "#1E40AF", border: "#BFDBFE" },
    PACKING: { bg: "#EDE9FE", color: "#5B21B6", border: "#DDD6FE" },
    SHIPPING: { bg: "#E0F2FE", color: "#0369A1", border: "#BAE6FD" },
    DELIVERED: { bg: "#DCFCE7", color: "#166534", border: "#BBF7D0" },
    CANCELLED: { bg: "#F3F4F6", color: "#4B5563", border: "#E5E7EB" },
    RETURN_REQUESTED: { bg: "#FFEDD5", color: "#9A3412", border: "#FED7AA" },
    RETURNED: { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
  };

  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label={text(lang, "Danh sách đơn hàng", "Orders list")}>
      <table>
        <thead>
          <tr>
            <th scope="col">{text(lang, "Mã đơn hàng", "Order code")}</th>
            <th scope="col">{text(lang, "Khách hàng", "Customer")}</th>
            <th scope="col">{text(lang, "Sản phẩm", "Items")}</th>
            <th scope="col">{text(lang, "Tổng tiền COD", "Total COD")}</th>
            <th scope="col">{text(lang, "Trạng thái", "Status")}</th>
            {owner ? (
              <th scope="col">{text(lang, "Người phụ trách", "Responsible member")}</th>
            ) : (
              <th scope="col">{text(lang, "Hoa hồng", "Commission")}</th>
            )}
            <th scope="col">{text(lang, "Ngày tạo", "Date")}</th>
            <th scope="col">{text(lang, "Thao tác", "Action")}</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => {
            const customer = (o.customer as { name?: string; phone?: string; area?: string }) ?? {};
            const items = (o.items as Array<{ sku?: string; qty?: number }>) ?? [];
            const st = String(o.status ?? "PENDING");
            const style = statusColors[st] ?? { bg: "#F3F4F6", color: "#374151", border: "#E5E7EB" };
            return (
              <tr key={String(o.id ?? o.orderCode)}>
                <td>
                  <span className="mono-badge">{String(o.orderCode ?? o.id)}</span>
                </td>
                <td>
                  <div style={{ fontWeight: 600, color: "#1F2937" }}>{customer.name || "—"}</div>
                  <div style={{ fontSize: "0.8rem", color: "#6B7280" }}>{customer.phone} {customer.area ? `· ${customer.area}` : ""}</div>
                </td>
                <td>
                  <span style={{ fontSize: "0.85rem", color: "#374151" }}>
                    {items.length > 0 ? items.map((i) => `${i.qty ?? 1}x ${String(i.sku ?? "").replace("CBST-", "")}g`).join(", ") : "—"}
                  </span>
                </td>
                <td>
                  <span style={{ fontWeight: 700, color: "#D84012" }}>{money(Number(o.totalVnd ?? 0), lang)}</span>
                </td>
                <td>
                  <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 9999, fontSize: "0.78rem", fontWeight: 700, background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
                    {label(st, lang)}
                  </span>
                </td>
                {owner ? (
                  <td>
                    <span style={{ fontSize: "0.85rem", color: o.responsibleMemberId ? "#1E40AF" : "#6B7280", fontWeight: o.responsibleMemberId ? 600 : 400 }}>
                      {getMemberName(o.responsibleMemberId ? String(o.responsibleMemberId) : null)}
                    </span>
                  </td>
                ) : (
                  <td>
                    <span style={{ fontWeight: 600, color: "#166534", fontSize: "0.85rem" }}>
                      {money(Number(o.commissionVnd ?? 0), lang)}
                    </span>
                  </td>
                )}
                <td style={{ fontSize: "0.82rem", color: "#6B7280" }}>
                  {o.createdAt ? new Date(String(o.createdAt)).toLocaleDateString("vi-VN") : "—"}
                </td>
                <td>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onSelect(o)}
                  >
                    {text(lang, "Mở đơn", "Open")}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AdminInner({
  actor,
  lang,
  initialSection = "dashboard",
  products = [],
  onUnauthorized,
  onLogout,
  onExitToStore,
  onToggleLang,
}: {
  actor: Actor;
  lang: Lang;
  initialSection?: string;
  products?: Product[];
  onUnauthorized?: () => void;
  onLogout?: () => void;
  onExitToStore?: () => void;
  onToggleLang?: () => void;
}) {
  const queryClient = useQueryClient();
  const [section, updateSection] = useState(initialSection);
  const setSection = (next: string) => {
    updateSection(next);
    navigate(`/admin/${next}`);
  };
  useEffect(() => {
    const syncSection = () => {
      const requested = adminSection(window.location.pathname);
      if (!requested) return;
      const next = sectionsFor(actor.role).includes(requested) ? requested : "dashboard";
      updateSection(next);
      setPage(0);
      setSelected(null);
      navigate(`/admin/${next}`, true);
    };
    syncSection();
    window.addEventListener("popstate", syncSection);
    window.addEventListener("app:navigate", syncSection);
    return () => {
      window.removeEventListener("popstate", syncSection);
      window.removeEventListener("app:navigate", syncSection);
    };
  }, [actor.role]);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const owner = actor.role === "OWNER_ADMIN";
  const endpoints: Record<string, string> = {
    dashboard: owner ? "dashboard/overview" : "dashboard/members/me",
    "create-order": "",
    orders: "orders",
    inventory: "inventory/batches",
    users: "users",
    products: "owner/products",
    expenses: "expenses",
    commissions: owner ? "commissions" : "commissions/me",
    audit: "audit-logs",
  };
  const endpoint = endpoints[section];

  // TanStack Query for the current section with business-specific cache policy
  const sectionPolicy = getCachePolicy(section);
  const sectionQuery = useQuery({
    queryKey: makeAdminQueryKey(actor, section, { page }),
    queryFn: () => fetchSectionData(section, owner, page),
    staleTime: sectionPolicy.staleTime,
    gcTime: sectionPolicy.gcTime,
    enabled: Boolean(endpoint && section !== "create-order"),
  });

  // TanStack Query for 100 recent orders used in metric badges & financial summaries
  const ordersPolicy = getCachePolicy("orders");
  const dashboardOrdersQuery = useQuery({
    queryKey: makeAdminQueryKey(actor, "dashboardOrders"),
    queryFn: () => fetchDashboardOrders(),
    staleTime: ordersPolicy.staleTime,
    gcTime: ordersPolicy.gcTime,
    enabled: ["dashboard", "orders", "expenses", "commissions"].includes(section),
  });

  // TanStack Query for user directory in commission management and order owner matching
  const usersPolicy = getCachePolicy("users");
  const usersQuery = useQuery({
    queryKey: makeAdminQueryKey(actor, "allUsers"),
    queryFn: () => fetchUsersList(),
    staleTime: usersPolicy.staleTime,
    gcTime: usersPolicy.gcTime,
    enabled: owner && ["dashboard", "orders", "commissions"].includes(section),
  });

  const rows: RecordRow[] = Array.isArray(sectionQuery.data)
    ? (sectionQuery.data as RecordRow[])
    : [];
  const dashboard: RecordRow | null =
    !Array.isArray(sectionQuery.data) && sectionQuery.data
      ? (sectionQuery.data as RecordRow)
      : null;
  const loading = sectionQuery.isLoading && !sectionQuery.data;
  const error = sectionQuery.error;
  const isBackgroundFetching = sectionQuery.isFetching;
  const dashboardOrders = (dashboardOrdersQuery.data as RecordRow[]) || [];
  const allUsers = (usersQuery.data as MemberUser[]) || [];

  // Security: Handle session expiration and 401s by wiping cache
  useEffect(() => {
    if (sectionQuery.error instanceof ApiError && sectionQuery.error.status === 401) {
      clearAdminCache(queryClient);
      onUnauthorized?.();
    }
  }, [sectionQuery.error, onUnauthorized, queryClient]);

  const refresh = (action?: MutationAction | React.SyntheticEvent | unknown) => {
    if (typeof action === "string") {
      invalidateAdminQueries(queryClient, actor, action as MutationAction);
    } else {
      void sectionQuery.refetch();
      if (["dashboard", "orders", "expenses", "commissions"].includes(section)) {
        void dashboardOrdersQuery.refetch();
      }
    }
  };

  const handleLogout = () => {
    clearAdminCache(queryClient);
    onLogout?.();
  };

  const availableSections = sectionsFor(actor.role);
  const overviewGroup = ["dashboard", "orders", "inventory"].filter((s) =>
    availableSections.includes(s),
  );
  const commerceGroup = ["products", "promotions", "vouchers", "media", "expenses", "commissions"].filter((s) =>
    availableSections.includes(s),
  );
  const systemGroup = ["users", "audit"].filter((s) =>
    availableSections.includes(s),
  );

  const navIcons: Record<string, React.ReactNode> = {
    dashboard: <LayoutDashboard size={18} strokeWidth={1.8} />,
    "create-order": <PackagePlus size={18} strokeWidth={1.8} />,
    orders: <ShoppingCart size={18} strokeWidth={1.8} />,
    inventory: <Package size={18} strokeWidth={1.8} />,
    users: <Users size={18} strokeWidth={1.8} />,
    products: <Boxes size={18} strokeWidth={1.8} />,
    promotions: <Tag size={18} strokeWidth={1.8} />,
    vouchers: <Ticket size={18} strokeWidth={1.8} />,
    media: <ImageIcon size={18} strokeWidth={1.8} />,
    expenses: <Wallet size={18} strokeWidth={1.8} />,
    commissions: <BadgePercent size={18} strokeWidth={1.8} />,
    audit: <ScrollText size={18} strokeWidth={1.8} />,
  };

  const navItem = (item: string) => (
    <button
      key={item}
      className={`admin-nav-item ${section === item ? "active" : ""}`}
      aria-current={section === item ? "page" : undefined}
      onClick={() => {
        setSection(item);
        setPage(0);
        setSelected(null);
      }}
    >
      <span className="admin-nav-icon" aria-hidden="true">
        {navIcons[item] ?? <Package size={18} strokeWidth={1.8} />}
      </span>
      <span className="admin-nav-label">{label(item, lang)}</span>
      {item === "orders" && dashboardOrders.length > 0 && (
        <span className="nav-count-badge">{dashboardOrders.length}</span>
      )}
    </button>
  );

  return (
    <div className="admin-shell">
      {/* 1. Dark Modern Sidebar (Apex Style) */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="admin-brand-text">
            <div className="admin-brand-title">Cá Bống Sông Trà</div>
            <div className="admin-brand-subtitle">
              {text(lang, "ĐẶC SẢN QUẢNG NGÃI", "QUANG NGAI SPECIALTY")}
            </div>
          </div>
          <button
            type="button"
            className="sidebar-toggle-btn"
            aria-label="Toggle sidebar"
            onClick={onExitToStore}
            title={text(lang, "Về cửa hàng", "Storefront")}
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
        </div>

        <nav
          className="admin-nav"
          aria-label={text(lang, "Quản lý", "Administration")}
        >
          {overviewGroup.length > 0 && (
            <div className="nav-group">
              <div className="admin-nav-group-title">
                <span>{text(lang, "TỔNG QUAN", "OVERVIEW")}</span>
                <span className="group-chevron"><ChevronDown size={14} strokeWidth={2} /></span>
              </div>
              {overviewGroup.map(navItem)}
            </div>
          )}

          {commerceGroup.length > 0 && (
            <div className="nav-group">
              <div className="admin-nav-group-title">
                <span>{text(lang, "THƯƠNG MẠI", "COMMERCE")}</span>
                <span className="group-chevron"><ChevronDown size={14} strokeWidth={2} /></span>
              </div>
              {commerceGroup.map(navItem)}
            </div>
          )}

          {systemGroup.length > 0 && (
            <div className="nav-group">
              <div className="admin-nav-group-title">
                <span>{text(lang, "HỆ THỐNG", "SYSTEM")}</span>
                <span className="group-chevron"><ChevronDown size={14} strokeWidth={2} /></span>
              </div>
              {systemGroup.map(navItem)}
            </div>
          )}
        </nav>

        {/* Sidebar Bottom Profile (Apex style) */}
        <div className="admin-sidebar-profile">
          <div className="profile-avatar-circle" aria-hidden="true">
            {owner ? "HB" : "AD"}
          </div>
          <div className="profile-info-wrap">
            <div className="profile-name">
              {actor.displayName ?? (owner ? "Hoài Bảo" : "Admin")}
            </div>
            <div className="profile-role-sub">{label(actor.role, lang)}</div>
          </div>
          {owner && (
            <button
              type="button"
              className="profile-exit-btn"
              onClick={() => {
                setSection("users");
                setSelected({
                  id: actor.id,
                  displayName: actor.displayName ?? "Hoài Bảo",
                  emailNormalized: "hoaibaole.qng@gmail.com",
                  role: actor.role,
                });
              }}
              title={text(lang, "Cấp mã đặt lại mật khẩu", "Issue password reset token")}
              aria-label={text(lang, "Cấp mã đặt lại mật khẩu", "Issue password reset token")}
              style={{ marginRight: 6 }}
            >
              <KeyRound size={16} strokeWidth={1.8} />
            </button>
          )}
          {onLogout && (
            <button
              type="button"
              className="profile-exit-btn"
              onClick={handleLogout}
              title={text(lang, "Đăng xuất", "Sign out")}
              aria-label={text(lang, "Đăng xuất", "Sign out")}
            >
              <LogOut size={16} strokeWidth={1.8} />
            </button>
          )}
        </div>
      </aside>

      {/* 2. Top Header & Workspace Canvas */}
      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-search-box">
            <span aria-hidden="true" style={{ color: "#94a3b8", display: "inline-flex", alignItems: "center" }}>
              <Search size={16} strokeWidth={1.8} />
            </span>
            <input
              type="text"
              placeholder={text(lang, "Tìm kiếm đơn hàng, khách hàng, mã vận đơn...", "Search anything...")}
              readOnly
            />
            <span className="kbd-shortcut">⌘K</span>
          </div>

          <div className="admin-topbar-actions">
            <button
              type="button"
              className="btn-new-order"
              onClick={() => {
                setSection("orders");
                setShowCreateOrderModal(true);
              }}
              title={text(lang, "Tạo đơn hàng nội bộ mới", "Create new order")}
            >
              <Plus size={16} strokeWidth={2} />
              <span>{text(lang, "Tạo đơn hàng", "New Order")}</span>
            </button>

            {onToggleLang && (
              <button
                type="button"
                className="admin-lang-btn"
                aria-label={text(
                  lang,
                  "Switch to English",
                  "Chuyển sang tiếng Việt",
                )}
                onClick={onToggleLang}
              >
                {lang === "vi" ? "EN" : "VI"}
              </button>
            )}

            <div className="notification-bell-wrap" aria-label="Notifications">
              <span className="bell-icon" style={{ display: "inline-flex", alignItems: "center" }}>
                <Bell size={18} strokeWidth={1.8} />
              </span>
              <span className="notification-dot" />
            </div>

            <div className="topbar-user-avatar">
              {owner ? "HB" : "AD"}
            </div>
          </div>
        </header>

        <main className="admin-content-body">
          {section === "promotions" || section === "vouchers" ? (
            <PromotionManager key={section} kind={section} owner={owner} lang={lang} />
          ) : section === "create-order" ? (
            <InternalOrderCreator
              actor={actor}
              lang={lang}
              products={products}
              onOrderCreated={() => {
                refresh("order_created");
              }}
              onGoToOrders={() => {
                setSection("orders");
                setPage(0);
              }}
            />
          ) : section === "media" ? (
            <MediaManager lang={lang} />
          ) : section === "dashboard" ? (
            owner ? (
              <div className="dashboard-apex-view">
                <div className="dash-heading-row">
                  <div>
                    <h1 className="dash-hero-title">
                      {text(lang, "Tổng quan kinh doanh", "eCommerce")}
                    </h1>
                    <p className="dash-hero-sub">
                      {text(
                        lang,
                        "Theo dõi hiệu suất bán hàng, hoa hồng thành viên và các chỉ số kinh doanh Cá Bống Sông Trà.",
                        "Track your sales performance, member commissions, and commerce metrics.",
                      )}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      className="admin-refresh-btn"
                      style={{ background: "#D84012", color: "#fff", borderColor: "#D84012" }}
                      onClick={() => setSection("create-order")}
                    >
                      <PackagePlus size={14} strokeWidth={2} style={{ marginRight: 6 }} />
                      {text(lang, "+ Tạo đơn nội bộ", "+ Create Order")}
                    </button>
                    <button
                      type="button"
                      className="admin-refresh-btn"
                      onClick={() => refresh()}
                      title={isBackgroundFetching ? text(lang, "Đang đồng bộ ngầm...", "Syncing...") : undefined}
                    >
                      <RefreshCw
                        size={14}
                        strokeWidth={1.8}
                        style={{ marginRight: 6 }}
                        className={isBackgroundFetching ? "spin-animation" : ""}
                      />
                      {text(lang, "Tải lại", "Refresh")}
                    </button>
                  </div>
                </div>

                {sectionQuery.isError && dashboard && (
                  <p className="notice" style={{ background: "#fff7ed", color: "#c2410c", borderColor: "#fed7aa" }} role="status">
                    {text(
                      lang,
                      "Dữ liệu đang hiển thị từ bộ nhớ đệm (phiên bản trước đó do kết nối mạng hoặc máy chủ đang bận).",
                      "Displaying cached snapshot (latest sync delayed due to connection or server busy).",
                    )}
                  </p>
                )}

                {loading ? (
                  <p role="status">{text(lang, "Đang tải dữ liệu…", "Loading records…")}</p>
                ) : (
                  dashboard && (
                    <>
                      {/* 6 Hero KPI Metric Cards for Owner */}
                      <div className="apex-hero-metrics apex-hero-metrics-6">
                        {/* Card 1: Total Sales */}
                        <div className="apex-metric-card">
                          <div className="apex-metric-top">
                            <div>
                              <div className="apex-metric-title">
                                {text(lang, "Doanh thu thuần", "Net Realized Revenue")}
                              </div>
                              <div className="apex-metric-val">
                                {money(Number(dashboard.revenueVnd ?? 0), lang)}
                              </div>
                              <div className="apex-metric-trend text-muted">
                                <span>{text(lang, "Doanh số thực thu", "Total sales volume")}</span>
                              </div>
                            </div>
                            <div className="apex-metric-icon bg-brand-light">
                              <Banknote size={20} strokeWidth={1.8} />
                            </div>
                          </div>
                        </div>

                        {/* Card 2: Avg Order Value */}
                        <div className="apex-metric-card">
                          <div className="apex-metric-top">
                            <div>
                              <div className="apex-metric-title">
                                {text(lang, "Giá trị TB đơn", "Avg Order Value")}
                              </div>
                              <div className="apex-metric-val">
                                {dashboard.deliveredOrders && Number(dashboard.deliveredOrders) > 0
                                  ? money(
                                      Math.round(
                                        Number(dashboard.revenueVnd ?? 0) /
                                          Number(dashboard.deliveredOrders),
                                      ),
                                      lang,
                                    )
                                  : "—"}
                              </div>
                              <div className="apex-metric-trend text-muted">
                                <span>{text(lang, "Trung bình trên mỗi đơn", "Per delivered order")}</span>
                              </div>
                            </div>
                            <div className="apex-metric-icon bg-amber-light">
                              <TrendingUp size={20} strokeWidth={1.8} />
                            </div>
                          </div>
                        </div>

                        {/* Card 3: Delivered Orders */}
                        <div className="apex-metric-card">
                          <div className="apex-metric-top">
                            <div>
                              <div className="apex-metric-title">
                                {text(lang, "Đơn thành công", "Delivered Orders")}
                              </div>
                              <div className="apex-metric-val">
                                {Number(dashboard.deliveredOrders ?? 0)}
                              </div>
                              <div className="apex-metric-trend text-muted">
                                <span>{text(lang, "Đơn hoàn tất giao hàng", "Fulfillment completed")}</span>
                              </div>
                            </div>
                            <div className="apex-metric-icon bg-blue-light">
                              <ShoppingBag size={20} strokeWidth={1.8} />
                            </div>
                          </div>
                        </div>

                        {/* Card 4: Member Commission */}
                        <div className="apex-metric-card">
                          <div className="apex-metric-top">
                            <div>
                              <div className="apex-metric-title">
                                {text(lang, "Hoa hồng thành viên", "Member Commissions")}
                              </div>
                              <div className="apex-metric-val">
                                {money(Number(dashboard.commissionVnd ?? 0), lang)}
                              </div>
                              <div className="apex-metric-trend text-muted">
                                <span>{text(lang, "Phân bổ cho đội ngũ CTV", "Incurred for members")}</span>
                              </div>
                            </div>
                            <div className="apex-metric-icon bg-purple-light">
                              <BadgePercent size={20} strokeWidth={1.8} />
                            </div>
                          </div>
                        </div>

                        {/* Card 5: Loss / Return Rate */}
                        <div className="apex-metric-card">
                          <div className="apex-metric-top">
                            <div>
                              <div className="apex-metric-title">
                                {text(lang, "Chi phí thất thoát", "Loss / Return Rate")}
                              </div>
                              <div className="apex-metric-val">
                                {money(Number(dashboard.failedDeliveryLossVnd ?? 0), lang)}
                              </div>
                              <div className="apex-metric-trend text-muted">
                                <span>{text(lang, "Hoàn đơn & giao thất bại", "Returns & failure losses")}</span>
                              </div>
                            </div>
                            <div className="apex-metric-icon bg-red-light">
                              <AlertCircle size={20} strokeWidth={1.8} />
                            </div>
                          </div>
                        </div>

                        {/* Card 6: Owner Net Profit */}
                        <div className="apex-metric-card">
                          <div className="apex-metric-top">
                            <div>
                              <div className="apex-metric-title">
                                {text(lang, "Lợi nhuận ròng", "Net Realized Profit")}
                              </div>
                              <div className="apex-metric-val">
                                {money(Number(dashboard.netProfitVnd ?? 0), lang)}
                              </div>
                              <div className="apex-metric-trend text-muted">
                                <span>{text(lang, "Sau trừ vốn, phí & hoa hồng", "After COGS, costs & commissions")}</span>
                              </div>
                            </div>
                            <div className="apex-metric-icon bg-emerald-light">
                              <TrendingUp size={20} strokeWidth={1.8} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Middle Row: Area Chart + Donut Status */}
                      <div className="apex-charts-grid-2-1">
                        <SalesOverviewChart
                          orders={dashboardOrders}
                          revenue={Number(dashboard.revenueVnd ?? 0)}
                          deliveredOrders={Number(dashboard.deliveredOrders ?? 0)}
                          cogs={Number(dashboard.cogsVnd ?? 0)}
                          directCosts={Number(dashboard.directCostsVnd ?? 0)}
                          lang={lang}
                        />
                        <OrderStatusDonut orders={dashboardOrders} lang={lang} />
                      </div>

                      {/* Bottom Row: Top Products + Category Bars */}
                      <div className="apex-charts-grid-2-1">
                        <TopProductsWidget orders={dashboardOrders} lang={lang} />
                        <CategoryBarWidget orders={dashboardOrders} lang={lang} />
                      </div>

                      {/* Member Performance Breakdown */}
                      <MemberLeaderboardWidget
                        orders={dashboardOrders}
                        users={allUsers}
                        actor={actor}
                        onChanged={() => {
                          invalidateAdminQueries(queryClient, actor, "order_updated");
                          invalidateAdminQueries(queryClient, actor, "commission_payout");
                        }}
                        commissionTotal={Number(dashboard.commissionVnd ?? 0)}
                        lang={lang}
                      />

                      {/* Full Accounting Metrics Transparency */}
                      <details className="accounting-metrics-accordion">
                        <summary>
                          {text(lang, "Chi tiết số liệu kiểm toán tài chính (Toàn bộ thời gian)", "Full Financial Audit Ledger Breakdown (All-time)")}
                        </summary>
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
                            "Số liệu toàn thời gian. Biến động tiền hoạt động không phải số dư ngân hàng. Hoa hồng được tính khi giao thành công, dựa trên chênh lệch giá bán và giá vốn.",
                            "All-time figures. Operating cash movement is not a bank balance. Commission accrues on successful delivery from selling price minus product cost.",
                          )}
                        </p>
                      </details>
                    </>
                  )
                )}
              </div>
            ) : (
              /* MEMBER DASHBOARD VIEW */
              <div className="dashboard-apex-view">
                <div className="dash-heading-row">
                  <div>
                    <h1 className="dash-hero-title">
                      {text(lang, "Tổng quan hiệu suất bán hàng", "Sales & Commission Dashboard")}
                    </h1>
                    <p className="dash-hero-sub">
                      {text(
                        lang,
                        "Theo dõi doanh số, hoa hồng tích luỹ và tiến độ các đơn hàng do bạn đảm nhiệm.",
                        "Track personal sales, earned commissions, and assigned order progress.",
                      )}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      className="admin-refresh-btn"
                      style={{ background: "#D84012", color: "#fff", borderColor: "#D84012" }}
                      onClick={() => setSection("create-order")}
                    >
                      <PackagePlus size={14} strokeWidth={2} style={{ marginRight: 6 }} />
                      {text(lang, "+ Tạo đơn nội bộ mới", "+ Create Internal Order")}
                    </button>
                    <button className="admin-refresh-btn" onClick={refresh}>
                      <RefreshCw size={14} strokeWidth={1.8} style={{ marginRight: 6 }} />
                      {text(lang, "Tải lại", "Refresh")}
                    </button>
                  </div>
                </div>

                {loading ? (
                  <p role="status">{text(lang, "Đang tải dữ liệu…", "Loading records…")}</p>
                ) : (
                  dashboard && (
                    <>
                      {/* 4 Hero KPI Metric Cards for Member */}
                      <div className="apex-hero-metrics">
                        {/* Member Card 1: Commission Earned */}
                        <div className="apex-metric-card">
                          <div className="apex-metric-top">
                            <div>
                              <div className="apex-metric-title">
                                {text(lang, "Hoa hồng tích luỹ (Đã chốt)", "Earned Commissions")}
                              </div>
                              <div className="apex-metric-val">
                                {money(Number(dashboard.commissionVnd ?? 0), lang)}
                              </div>
                              <div className="apex-metric-trend text-muted">
                                <span>{text(lang, "Từ các đơn đã giao thành công", "Delivered & settled orders")}</span>
                              </div>
                            </div>
                            <div className="apex-metric-icon bg-purple-light">
                              <BadgePercent size={20} strokeWidth={1.8} />
                            </div>
                          </div>
                        </div>

                        {/* Member Card 2: Personal Sales Volume */}
                        <div className="apex-metric-card">
                          <div className="apex-metric-top">
                            <div>
                              <div className="apex-metric-title">
                                {text(lang, "Doanh số cá nhân", "Personal Sales Volume")}
                              </div>
                              <div className="apex-metric-val">
                                {money(Number(dashboard.revenueVnd ?? 0), lang)}
                              </div>
                              <div className="apex-metric-trend text-muted">
                                <span>{text(lang, "Tổng giá trị đơn hoàn thành", "Delivered volume")}</span>
                              </div>
                            </div>
                            <div className="apex-metric-icon bg-brand-light">
                              <Banknote size={20} strokeWidth={1.8} />
                            </div>
                          </div>
                        </div>

                        {/* Member Card 3: Delivered Orders */}
                        <div className="apex-metric-card">
                          <div className="apex-metric-top">
                            <div>
                              <div className="apex-metric-title">
                                {text(lang, "Đơn giao thành công", "Delivered Orders")}
                              </div>
                              <div className="apex-metric-val">
                                {Number(dashboard.deliveredOrders ?? 0)}
                              </div>
                              <div className="apex-metric-trend text-muted">
                                <span>{text(lang, "Đã giao hàng & hoàn tất", "Completed orders")}</span>
                              </div>
                            </div>
                            <div className="apex-metric-icon bg-emerald-light">
                              <ShoppingBag size={20} strokeWidth={1.8} />
                            </div>
                          </div>
                        </div>

                        {/* Member Card 4: In Progress / Pending Cost Finalization */}
                        <div className="apex-metric-card">
                          <div className="apex-metric-top">
                            <div>
                              <div className="apex-metric-title">
                                {text(lang, "Đơn đang xử lý / Chờ chốt", "Processing / In Transit")}
                              </div>
                              <div className="apex-metric-val">
                                {Number(dashboard.pendingCostOrders ?? 0)}
                              </div>
                              <div className="apex-metric-trend text-muted">
                                <span>{text(lang, "Đang vận chuyển hoặc chờ duyệt", "In transit or pending cost")}</span>
                              </div>
                            </div>
                            <div className="apex-metric-icon bg-amber-light">
                              <Clock size={20} strokeWidth={1.8} />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Middle Row: Member Charts */}
                      <div className="apex-charts-grid-2-1">
                        <SalesOverviewChart
                          orders={dashboardOrders}
                          revenue={Number(dashboard.revenueVnd ?? 0)}
                          deliveredOrders={Number(dashboard.deliveredOrders ?? 0)}
                          cogs={0}
                          directCosts={0}
                          lang={lang}
                        />
                        <OrderStatusDonut orders={dashboardOrders} lang={lang} />
                      </div>

                      {/* My Orders Widget with Tabs */}
                      <MyOrdersWidget
                        orders={dashboardOrders}
                        lang={lang}
                        onGoToCreate={() => setSection("create-order")}
                        onGoToAllOrders={() => {
                          setSection("orders");
                          setPage(0);
                        }}
                      />
                    </>
                  )
                )}
              </div>
            )
          ) : (
            <>
              <div className="admin-content-header">
                <div>
                  <p className="admin-eyebrow">
                    SÔNG TRÀ / {label(actor.role, lang)}
                  </p>
                  <h1 className="admin-page-title">{label(section, lang)}</h1>
                  {section === "orders" && (
                    <p style={{ margin: "4px 0 0", fontSize: "0.88rem", color: "#6B7280" }}>
                      {owner
                        ? text(
                            lang,
                            "Toàn bộ đơn hàng trong hệ thống. Theo dõi tiến độ, người phụ trách và xử lý trạng thái.",
                            "All orders across the system. Track fulfillment, responsible members, and statuses.",
                          )
                        : text(
                            lang,
                            "Danh sách đơn hàng bạn phụ trách. Theo dõi tiến độ giao hàng và hoa hồng của bạn.",
                            "Orders assigned to you. Track delivery progress and your commissions.",
                          )}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {section === "orders" && (
                    <button
                      type="button"
                      className="btn-new-order"
                      onClick={() => setShowCreateOrderModal(true)}
                      style={{
                        background: "#D84012",
                        color: "#fff",
                        border: "none",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontWeight: 700,
                        padding: "8px 16px",
                        borderRadius: 8,
                      }}
                    >
                      <Plus size={16} strokeWidth={2} />
                      <span>{text(lang, "Tạo đơn hàng", "New Order")}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="admin-refresh-btn"
                    onClick={() => refresh()}
                    title={isBackgroundFetching ? text(lang, "Đang đồng bộ ngầm...", "Syncing...") : undefined}
                  >
                    <RefreshCw
                      size={14}
                      strokeWidth={1.8}
                      style={{ marginRight: 6 }}
                      className={isBackgroundFetching ? "spin-animation" : ""}
                    />
                    {text(lang, "Tải lại", "Refresh")}
                  </button>
                </div>
              </div>

              {sectionQuery.isError && rows.length > 0 && (
                <p className="notice" style={{ background: "#fff7ed", color: "#c2410c", borderColor: "#fed7aa" }} role="status">
                  {text(
                    lang,
                    "Dữ liệu đang hiển thị từ bộ nhớ đệm (phiên bản trước đó do kết nối mạng hoặc máy chủ đang bận).",
                    "Displaying cached snapshot (latest sync delayed due to connection or server busy).",
                  )}
                </p>
              )}

              <ErrorNotice error={error} lang={lang} />
              {section === "inventory" ? (
                <InventoryManager
                  batches={rows as unknown as Batch[]}
                  lang={lang}
                  onRefresh={() => refresh("inventory_receipt")}
                  onUnauthorized={onUnauthorized}
                />
              ) : section === "products" ? (
                <ProductManager
                  products={rows as unknown as OwnerProductRow[]}
                  lang={lang}
                  onRefresh={() => refresh("product_updated")}
                  onUnauthorized={onUnauthorized}
                />
              ) : section === "expenses" ? (
                <ExpenseManager
                  expenses={rows as unknown as ExpenseRecord[]}
                  orders={dashboardOrders as unknown as Order[]}
                  lang={lang}
                  onRefresh={() => refresh("expense_created")}
                  onUnauthorized={onUnauthorized}
                />
              ) : section === "users" ? (
                <UserManager
                  users={rows as unknown as MemberUser[]}
                  lang={lang}
                  onRefresh={() => refresh("user_changed")}
                  onUnauthorized={onUnauthorized}
                />
              ) : section === "commissions" ? (
                owner ? (
                <CommissionManager
                  users={allUsers}
                  ledger={rows as unknown as CommissionLedgerEntry[]}
                  lang={lang}
                  onRefresh={() => refresh("commission_payout")}
                  onUnauthorized={onUnauthorized}
                />
                ) : (
                  <MemberCommissions actor={actor} ledger={rows as unknown as CommissionLedgerEntry[]} lang={lang} />
                )
              ) : section === "promotions" || section === "vouchers" ? (
                <PromotionManager
                  kind={section}
                  owner={owner}
                  lang={lang}
                />
              ) : section === "orders" ? (
                <>
                  <OrdersTable
                    orders={rows}
                    allUsers={allUsers}
                    owner={owner}
                    lang={lang}
                    onSelect={(row) => setSelected(row)}
                    onCreateNew={() => setShowCreateOrderModal(true)}
                  />
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
                  {selected && (
                    <OrderDetail
                      id={String(selected.id)}
                      actor={actor}
                      lang={lang}
                      users={allUsers}
                      onClose={() => setSelected(null)}
                      onUnauthorized={onUnauthorized}
                      onChanged={() => refresh("order_updated")}
                    />
                  )}
                </>
              ) : (
                <>
                  <Records
                    rows={rows}
                    lang={lang}
                  />
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
                </>
              )}
            </>
          )}

          <Modal
            isOpen={showCreateOrderModal}
            onClose={() => setShowCreateOrderModal(false)}
            title={text(lang, "Tạo đơn hàng nội bộ", "Create Internal Order")}
            subtitle={text(
              lang,
              "Lên đơn cho khách hàng với tính hoa hồng tự động.",
              "Create internal order with automated commission calculation.",
            )}
            size="xl"
          >
            <InternalOrderCreator
              actor={actor}
              lang={lang}
              products={products}
              onOrderCreated={() => {
                refresh("order_created");
              }}
              onGoToOrders={() => {
                setShowCreateOrderModal(false);
                setSection("orders");
                setPage(0);
                refresh("order_created");
              }}
            />
          </Modal>
        </main>
      </div>
    </div>
  );
}

export function Admin(props: {
  actor: Actor;
  lang: Lang;
  initialSection?: string;
  products?: Product[];
  onUnauthorized?: () => void;
  onLogout?: () => void;
  onExitToStore?: () => void;
  onToggleLang?: () => void;
}) {
  const existingClient = useContext(QueryClientContext);
  if (!existingClient) {
    return (
      <QueryClientProvider client={getSharedQueryClient()}>
        <AdminInner {...props} />
      </QueryClientProvider>
    );
  }
  return <AdminInner {...props} />;
}

export const STORE_NAV_ITEMS = [
  { id: "hero", labelVi: "Trang chủ", labelEn: "Home" },
  { id: "products", labelVi: "Sản phẩm", labelEn: "Products" },
  { id: "pricing-compare", labelVi: "Bảng giá & Size", labelEn: "Pricing & Size" },
  { id: "flavor", labelVi: "Hương vị", labelEn: "Flavor" },
  { id: "storage", labelVi: "Bảo quản", labelEn: "Storage" },
  { id: "order-guide", labelVi: "Cách đặt", labelEn: "How to Order" },
  { id: "checkout", labelVi: "Tư vấn ngay", labelEn: "Consultation" },
  { id: "faq", labelVi: "FAQ", labelEn: "FAQ" },
] as const;

export default function App({
  initialView = "store",
  initialImages,
  initialAdminSection = "dashboard",
}: {
  initialView?: string;
  initialImages?: Record<string, string>;
  initialAdminSection?: string;
} = {}) {
  const [lang, setLang] = useState<Lang>("vi");
  const [view, updateView] = useState(initialView === "reset" ? "login" : initialView);
  const setView = (next: string) => {
    navigate(next === "admin" ? (adminSection(window.location.pathname) ? window.location.pathname : "/admin/dashboard") : next === "login" ? "/login" : "/");
    updateView(next);
  };
  const [authTab, updateAuthTab] = useState<"login" | "reset">(
    initialView === "reset" ? "reset" : "login",
  );
  const setAuthTab = (next: "login" | "reset") => {
    updateAuthTab(next);
    navigate(next === "reset" ? "/reset-password" : "/login");
  };
  const [actor, setActor] = useState<Actor | null>(null);
  useEffect(() => {
    const syncView = () => {
      const pathname = window.location.pathname;
      if (adminSection(pathname)) {
        updateView(actor ? "admin" : "login");
        updateAuthTab("login");
      } else if (pathname === "/login" || pathname === "/reset-password") {
        updateView("login");
        updateAuthTab(pathname === "/reset-password" ? "reset" : "login");
      } else if (pathname === "/") updateView("store");
    };
    window.addEventListener("popstate", syncView);
    window.addEventListener("app:navigate", syncView);
    return () => {
      window.removeEventListener("popstate", syncView);
      window.removeEventListener("app:navigate", syncView);
    };
  }, [actor]);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogError, setCatalogError] = useState<unknown>(null);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [authError, setAuthError] = useState<unknown>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("hero");

  useEffect(() => {
    if (view !== "store") return;

    const sectionIds = [
      "hero",
      "products",
      "pricing-compare",
      "flavor",
      "storage",
      "order-guide",
      "checkout",
      "faq",
    ];

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      if (scrollY + windowHeight >= docHeight - 80) {
        setActiveSection("faq");
        return;
      }

      const offsetTop = 140;
      let current = "hero";

      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.offsetTop - offsetTop;
          const height = el.offsetHeight;
          if (scrollY >= top && scrollY < top + height) {
            current = id;
            break;
          } else if (scrollY >= top) {
            current = id;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [view]);

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setActiveSection(id);
    setMobileMenuOpen(false);
    const target = document.getElementById(id);
    if (target) {
      const headerOffset = 80;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      if (typeof window !== "undefined" && window.history) {
        window.history.pushState(null, "", `#${id}`);
      }
    }
  };
  useEffect(() => {
    const saved = localStorage.getItem("cbst-language");
    if (saved === "en" || saved === "vi") setLang(saved);
    if (typeof window !== "undefined") {
      const pathname = window.location.pathname;
      const hash = window.location.hash;
      const search = window.location.search;
      if (
        pathname === "/reset-password" ||
        hash === "#reset" ||
        search.includes("reset")
      ) {
        setView("login");
        setAuthTab("reset");
      } else if (
        pathname === "/login" ||
        adminSection(pathname) !== null ||
        hash === "#login" ||
        search.includes("view=login") ||
        search.includes("login")
      ) {
        updateView("login");
        updateAuthTab("login");
      }
    }
    apiRequest<Actor>("auth/me")
      .then((me) => {
        setActor(me);
        if (typeof window !== "undefined") {
          const pathname = window.location.pathname;
          if (adminSection(pathname) || window.location.hash === "#admin") {
            updateView("admin");
          }
        }
      })
      .catch((caught) => {
        if (!(caught instanceof ApiError && caught.status === 401))
          setAuthError(caught);
      });
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
    clearAdminCache(getSharedQueryClient());
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
      clearAdminCache(getSharedQueryClient());
      setActor(null);
      setView("store");
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        clearAdminCache(getSharedQueryClient());
        setActor(null);
        setView("store");
      } else setAuthError(caught);
    } finally {
      setLoggingOut(false);
    }
  }
  if (view === "admin" && actor) {
    return (
      <Admin
        key={actor.id}
        initialSection={typeof window !== "undefined" ? adminSection(window.location.pathname) ?? initialAdminSection : initialAdminSection}
        actor={actor}
        lang={lang}
        products={products}
        onUnauthorized={unauthorized}
        onLogout={logout}
        onExitToStore={() => setView("store")}
        onToggleLang={() => setLang(lang === "vi" ? "en" : "vi")}
      />
    );
  }
  if (view === "admin" && !actor) {
    return (
      <>
        <header className="site-header">
          <a className="brand" href="/" onClick={(event) => { event.preventDefault(); setView("store"); }}>
            <span className="brand-main">Cá Bống Sông Trà</span>
            <span className="brand-sub">
              {text(lang, "ĐẶC SẢN QUẢNG NGÃI", "QUANG NGAI SPECIALTY")}
            </span>
          </a>
          <nav aria-label={text(lang, "Điều hướng", "Navigation")}>
            <button className="nav-link" onClick={() => setView("store")}>
              {text(lang, "← Cửa hàng", "← Store")}
            </button>
            <button
              className="language"
              aria-label={text(lang, "Switch to English", "Chuyển sang tiếng Việt")}
              onClick={() => setLang(lang === "vi" ? "en" : "vi")}
            >
              {lang === "vi" ? "EN" : "VI"}
            </button>
          </nav>
        </header>
        <main id="main">
          <section className="login">
            <div>
              <p className="eyebrow">SÔNG TRÀ / {text(lang, "NỘI BỘ", "TEAM")}</p>
              <h1 className="page-title">{text(lang, "Chào mừng trở lại", "Welcome back")}</h1>
              <p>{text(lang, "Dành cho chủ cửa hàng và thành viên được cấp tài khoản.", "For owner and provisioned members.")}</p>
            </div>
            <ActionForm
              action="login"
              lang={lang}
              onSuccess={async (result) => {
                let profile =
                  result && typeof result === "object" && "role" in result
                    ? (result as Actor)
                    : null;
                if (!profile) {
                  profile = await apiRequest<Actor>("auth/me");
                }
                setActor(profile);
                setAuthError(null);
                setView("admin");
              }}
            />
          </section>
        </main>
      </>
    );
  }
  return (
    <>
      <a className="skip" href="#main">
        {text(lang, "Đến nội dung", "Skip to content")}
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand"
            href="#"
            onClick={() => {
              setView("store");
              setMobileMenuOpen(false);
            }}
          >
            <span className="brand-main">Cá Bống Sông Trà</span>
            <span className="brand-sub">
              {text(lang, "ĐẶC SẢN QUẢNG NGÃI", "QUANG NGAI SPECIALTY")}
            </span>
          </a>
          <nav aria-label={text(lang, "Điều hướng chính", "Main navigation")} className="desktop-nav">
            {view === "store" ? (
              <>
                {STORE_NAV_ITEMS.map((item) => {
                  const isActive = activeSection === item.id;
                  return (
                    <a
                      key={item.id}
                      className={`nav-link ${isActive ? "active" : ""}`}
                      href={`#${item.id}`}
                      onClick={(e) => scrollToSection(e, item.id)}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {lang === "vi" ? item.labelVi : item.labelEn}
                    </a>
                  );
                })}
              </>
            ) : (
              <button className="nav-link" onClick={() => setView("store")}>
                {text(lang, "← Cửa hàng", "← Store")}
              </button>
            )}
            {actor && view !== "admin" && (
              <button className="nav-link" onClick={() => setView("admin")}>
                {text(lang, "Quản lý", "Workspace")}
              </button>
            )}
            {actor && (
              <button className="nav-link" disabled={loggingOut} onClick={logout}>
                {text(lang, "Đăng xuất", "Sign out")}
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
          <div className="header-actions">
            <button
              type="button"
              className="language-pill-btn"
              onClick={() => setLang(lang === "vi" ? "en" : "vi")}
              aria-label={text(lang, "Chuyển ngôn ngữ", "Toggle language")}
            >
              {lang === "vi" ? "EN" : "VI"}
            </button>
            {actor && view !== "admin" && (
              <button
                type="button"
                className="admin-header-pill"
                onClick={() => setView("admin")}
              >
                {text(lang, "Dashboard", "Dashboard")}
              </button>
            )}
            <button
              type="button"
              className="mobile-menu-toggle"
              aria-label={
                mobileMenuOpen
                  ? text(lang, "Đóng menu", "Close menu")
                  : text(lang, "Mở menu", "Open menu")
              }
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X size={22} strokeWidth={2} />
              ) : (
                <Menu size={22} strokeWidth={2} />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="mobile-nav-drawer">
            <nav
              className="mobile-nav-inner"
              aria-label={text(lang, "Menu di động", "Mobile navigation")}
            >
              {view === "store" ? (
                <>
                  {STORE_NAV_ITEMS.map((item) => {
                    const isActive = activeSection === item.id;
                    const isHot = item.id === "checkout";
                    return (
                      <a
                        key={item.id}
                        className={`mobile-nav-link ${isActive ? "active" : ""} ${isHot ? "highlight" : ""}`}
                        href={`#${item.id}`}
                        onClick={(e) => scrollToSection(e, item.id)}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          {isHot && <PhoneCall size={16} strokeWidth={2} />}
                          {lang === "vi" ? item.labelVi : item.labelEn}
                        </span>
                        {isActive ? (
                          <span className="mobile-active-badge active-marker">
                            {text(lang, "Đang xem", "Viewing")}
                          </span>
                        ) : isHot ? (
                          <span className="mobile-active-badge">Hot</span>
                        ) : (
                          <ChevronRight size={16} strokeWidth={2} />
                        )}
                      </a>
                    );
                  })}
                </>
              ) : (
                <button
                  type="button"
                  className="mobile-nav-link"
                  onClick={() => {
                    setView("store");
                    setMobileMenuOpen(false);
                  }}
                >
                  <span>{text(lang, "← Quay lại Cửa hàng", "← Back to Store")}</span>
                  <ChevronRight size={16} strokeWidth={2} />
                </button>
              )}

              {actor && view !== "admin" && (
                <button
                  type="button"
                  className="mobile-nav-link"
                  onClick={() => {
                    setView("admin");
                    setMobileMenuOpen(false);
                  }}
                >
                  <span>{text(lang, "Vào Dashboard quản lý", "Go to Dashboard")}</span>
                  <ChevronRight size={16} strokeWidth={2} />
                </button>
              )}
              {actor && (
                <button
                  type="button"
                  className="mobile-nav-link logout-link"
                  disabled={loggingOut}
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                >
                  <span>{text(lang, "Đăng xuất tài khoản", "Sign out")}</span>
                  <LogOut size={16} strokeWidth={2} />
                </button>
              )}

              <div className="mobile-nav-footer">
                <a
                  className="mobile-hotline-btn"
                  href="tel:0702478561"
                >
                  <PhoneCall size={15} strokeWidth={2} />
                  <span>070 2478 561 (Hotline / Zalo)</span>
                </a>
              </div>
            </nav>
          </div>
        )}
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
              initialImages={initialImages}
              onCreated={() => {}}
              onGoToAdmin={() => setView("admin")}
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
                {authTab === "login"
                  ? text(lang, "Chào mừng trở lại", "Welcome back")
                  : text(lang, "Đặt lại mật khẩu", "Reset password")}
              </h1>
              <p>
                {authTab === "login"
                  ? text(
                      lang,
                      "Dành cho chủ cửa hàng và thành viên được cấp tài khoản. Không có đăng ký công khai.",
                      "For the owner and provisioned members. Public registration is not available.",
                    )
                  : text(
                      lang,
                      "Nhập mã khôi phục (43 ký tự) được cấp từ hệ thống quản trị và thiết lập mật khẩu mới (tối thiểu 12 ký tự).",
                      "Enter the 43-character token issued from administration and choose a new password (min 12 characters).",
                    )}
              </p>
            </div>
            {authTab === "login" ? (
              <div>
                <ActionForm
                  action="login"
                  lang={lang}
                  onSuccess={async (result) => {
                    let profile =
                      result && typeof result === "object" && "role" in result
                        ? (result as Actor)
                        : null;
                    if (!profile) {
                      profile = await apiRequest<Actor>("auth/me");
                    }
                    setActor(profile);
                    setAuthError(null);
                    setView("admin");
                  }}
                />
                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <button
                    type="button"
                    className="secondary"
                    style={{
                      fontSize: "0.875rem",
                      padding: "6px 12px",
                      border: "none",
                      background: "transparent",
                      color: "#D84012",
                      textDecoration: "underline",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                    onClick={() => setAuthTab("reset")}
                  >
                    {text(
                      lang,
                      "Quên mật khẩu? Đặt lại bằng mã khôi phục →",
                      "Forgot password? Reset with token →",
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <ActionForm
                  action="resetPassword"
                  lang={lang}
                  onSuccess={() => {
                    setActor(null);
                    setAuthError(null);
                    setAuthTab("login");
                  }}
                />
                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <button
                    type="button"
                    className="secondary"
                    style={{
                      fontSize: "0.875rem",
                      padding: "6px 12px",
                      border: "none",
                      background: "transparent",
                      color: "#78716C",
                      textDecoration: "underline",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                    onClick={() => setAuthTab("login")}
                  >
                    {text(
                      lang,
                      "← Quay lại form Đăng nhập",
                      "← Back to Sign in",
                    )}
                  </button>
                </div>
              </div>
            )}
          </section>
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
          {" · "}
          <a href="/login">{text(lang, "Nội bộ", "Portal")}</a>
        </nav>
        <div className="brand" style={{ margin: "16px auto", alignItems: "center" }}>
          <span className="brand-main">Cá Bống Sông Trà</span>
          <span className="brand-sub">
            {text(lang, "ĐẶC SẢN QUẢNG NGÃI", "QUANG NGAI SPECIALTY")}
          </span>
        </div>
        <p>
          {text(
            lang,
            "Hương vị Quảng Ngãi. Thông tin đơn hàng được xử lý an toàn qua cùng tên miền.",
            "The taste of Quang Ngai. Order information is handled through this same-origin service.",
          )}
        </p>
        <span>VI / EN · VND</span>
      </footer>
      {view === "store" && (
        <ContactButtons lang={lang} floating />
      )}
    </>
  );
}
