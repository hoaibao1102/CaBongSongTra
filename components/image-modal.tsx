"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { X, ZoomIn } from "lucide-react";

type ImageModalProps = {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
};

export function ImageModal({ src, alt, isOpen, onClose, title }: ImageModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Xem ảnh lớn"}
    >
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h4>{title || "Hình ảnh sản phẩm thực tế"}</h4>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          <Image
            src={src}
            alt={alt}
            width={1200}
            height={1550}
            className="modal-image"
            priority
          />
        </div>
        <div className="modal-footer">
          <p>
            * Ảnh chụp bảng thông tin thực tế. Vui lòng đối chiếu thêm thông tin trên nhãn khi nhận hàng.
          </p>
        </div>
      </div>
    </div>
  );
}

export function ImagePreviewTrigger({
  src,
  alt,
  title,
  children,
  className = "",
}: {
  src: string;
  alt: string;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div
        className={`image-preview-wrapper ${className}`}
        onClick={() => setIsOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        title="Bấm để xem ảnh lớn"
      >
        {children}
        <span className="zoom-hint">
          <ZoomIn size={14} /> Phóng to xem rõ
        </span>
      </div>
      <ImageModal
        src={src}
        alt={alt}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
      />
    </>
  );
}
