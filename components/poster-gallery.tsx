"use client";
import { useState } from "react";
import Image from "next/image";
import { FileText, SlidersHorizontal, Tag } from "lucide-react";
import { comparisonImages } from "@/data/site";
import { ImagePreviewTrigger } from "./image-modal";

export function PosterGallery() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="poster-gallery-wrapper">
      {/* Mobile-only tab switcher */}
      <div className="poster-mobile-tabs" role="tablist" aria-label="Chọn xem poster">
        {comparisonImages.map((poster, idx) => (
          <button
            key={poster.id}
            type="button"
            role="tab"
            aria-selected={activeTab === idx}
            className={`poster-tab-btn ${activeTab === idx ? "active" : ""}`}
            onClick={() => setActiveTab(idx)}
          >
            {idx === 0 ? <SlidersHorizontal size={14} /> : <Tag size={14} />}
            <span>{idx === 0 ? "Bảng Kích Thước" : "Bảng Giá 3 Hũ"}</span>
          </button>
        ))}
      </div>

      {/* Grid container: on desktop shows all; on mobile toggles via active tab */}
      <div className="posters-grid">
        {comparisonImages.map((poster, idx) => {
          const isHiddenOnMobile = activeTab !== idx;
          return (
            <div
              key={poster.id}
              className={`poster-card ${isHiddenOnMobile ? "mobile-hidden" : ""}`}
            >
              <div className="poster-header">
                <h3>{poster.title}</h3>
                <p>{poster.subtitle}</p>
              </div>

              <ImagePreviewTrigger
                src={poster.image}
                alt={poster.alt}
                title={poster.title}
                className="poster-image-wrap"
              >
                <Image
                  src={poster.image}
                  alt={poster.alt}
                  width={770}
                  height={1000}
                  className="poster-img"
                />
              </ImagePreviewTrigger>

              <div className="poster-footer">
                <span className="poster-tag">
                  <FileText size={14} /> Ảnh chụp thực tế niêm yết
                </span>
                <small className="poster-hint-text">Chạm ảnh để phóng to</small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
