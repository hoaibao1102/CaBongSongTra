"use client";
import { useState, useRef, useEffect } from "react";
import { products } from "@/data/site";
import { ProductCard } from "./product-card";

export function ProductSlider() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const scrollToCard = (index: number) => {
    setActiveIndex(index);
    const target = cardRefs.current[index];
    if (target && containerRef.current) {
      target.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Only track on mobile horizontal scroll
      if (window.innerWidth > 768) return;
      const scrollLeft = container.scrollLeft;
      const cardWidth = container.clientWidth * 0.82;
      const newIndex = Math.round(scrollLeft / (cardWidth + 14));
      if (newIndex >= 0 && newIndex < products.length && newIndex !== activeIndex) {
        setActiveIndex(newIndex);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [activeIndex]);

  return (
    <div className="product-slider-wrapper">
      {/* Mobile-only tab pills for instant 1-tap switching */}
      <div className="product-mobile-pills" role="tablist" aria-label="Chọn quy cách hũ">
        {products.map((p, idx) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={activeIndex === idx}
            className={`product-pill-btn ${activeIndex === idx ? "active" : ""}`}
            onClick={() => scrollToCard(idx)}
          >
            <span>{p.shortName}</span>
            <small>{idx === 0 ? "109k" : idx === 1 ? "139k" : "199k"}</small>
          </button>
        ))}
      </div>

      {/* Horizontal Swipe Container on Mobile / 3-Col Grid on Desktop */}
      <div className="product-grid" ref={containerRef}>
        {products.map((item, index) => (
          <div
            key={item.id}
            ref={(el) => {
              cardRefs.current[index] = el;
            }}
            className="product-grid-item"
          >
            <ProductCard product={item} index={index} />
          </div>
        ))}
      </div>

      {/* Mobile-only Swipe Indicator Bar & Dots */}
      <div className="product-mobile-footer-nav">
        <div className="product-swipe-hint">
          <span>← Vuốt ngang xem 3 hũ →</span>
        </div>
        <div className="product-dots" aria-hidden="true">
          {products.map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`product-dot ${activeIndex === idx ? "active" : ""}`}
              onClick={() => scrollToCard(idx)}
              aria-label={`Xem sản phẩm ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
