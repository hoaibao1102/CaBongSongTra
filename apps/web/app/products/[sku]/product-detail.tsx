"use client";
import { useEffect, useState } from "react";
import { apiRequest } from "../../../lib/commerce";
import { errorText, money } from "../../../lib/i18n";
import type { Product } from "../../../lib/types";
import { effectivePrice, watchPricing } from "../../../lib/catalog-pricing";
export default function ProductDetail({ sku }: { sku: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    setProduct(null);
    apiRequest<Product>(`products/${sku}`)
      .then((value) => {
        if (alive) setProduct(value);
      })
      .catch((value) => {
        if (alive) setError(value);
      });
    return () => {
      alive = false;
    };
  }, [sku, revision]);
  useEffect(() => watchPricing([product?.promotionEndsAt], () => setRevision(v => v + 1)), [product?.promotionEndsAt]);
  return (
    <main>
      <a href="/">Cá Bống Sông Trà / Store</a>
      <section className="panel">
        <p className="eyebrow">{sku}</p>
        <h1 className="page-title">{product?.name ?? sku}</h1>
        {product ? (
          <>
            <p lang="en">Song Tra goby · {product.netWeightG}g</p>
            <strong className="total">
              {money(effectivePrice(product), "vi")}
            </strong>
            <a className="button" href="/#checkout">
              Chọn số lượng tại cửa hàng / Choose quantity in store
            </a>
          </>
        ) : error ? (
          <div role="alert">
            <p>{errorText(error, "vi")}</p>
            <p lang="en">{errorText(error, "en")}</p>
            <button onClick={() => setRevision((value) => value + 1)}>
              Thử lại / Retry
            </button>
          </div>
        ) : (
          <p role="status">Đang tải / Loading…</p>
        )}
        <p>
          Giá và tồn kho được kiểm tra khi gửi đơn. / Price and stock are
          checked on submission.
        </p>
        <p>
          Hình minh họa không thay thế nhãn thực tế. / Illustrations do not
          replace the actual product label.
        </p>
        <a href="/label-safety">
          Nhãn, thành phần và dị ứng / Label, ingredients and allergens
        </a>
      </section>
    </main>
  );
}
