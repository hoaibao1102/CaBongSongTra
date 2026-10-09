"use client";
import Image from "next/image";
import { Scale, Info } from "lucide-react";
import { type Product, formatVnd } from "@/data/site";
import { ImagePreviewTrigger } from "./image-modal";

export function ProductCard({
  product,
  index,
}: {
  product: Product;
  index: number;
}) {
  return (
    <article className="product-card">
      <div className="product-image-container">
        <div className="product-card-top-tags">
          <span className="product-index-badge">{product.code}</span>
          {product.badge && (
            <span className="product-featured-badge">{product.badge}</span>
          )}
        </div>

        <ImagePreviewTrigger
          src={product.image}
          alt={`Ảnh thực tế ${product.name} - quy cách ${product.netWeight}`}
          title={`${product.name} (${product.netWeight})`}
          className="product-image-wrap"
        >
          <Image
            src={product.image}
            alt={`Ảnh thực tế ${product.name} - quy cách ${product.netWeight}`}
            width={770}
            height={1000}
            className="product-image"
            priority={index === 0}
          />
        </ImagePreviewTrigger>
      </div>

      <div className="product-body">
        <div className="product-meta-header">
          <span className="product-caption">{product.caption}</span>
          <span className="product-net-weight">
            <Scale size={13} /> Tịnh: <strong>{product.netWeight}</strong>
          </span>
        </div>

        <div className="product-title-row">
          <h3>{product.name}</h3>
          <div className="product-price-tag">
            <b>{formatVnd(product.price)}</b>
          </div>
        </div>

        <div className="gross-weight-hint">
          <Info size={13} />
          <span>{product.grossWeightEstimate}</span>
        </div>

        <p className="product-description">{product.description}</p>
      </div>
    </article>
  );
}
