"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg" | "xl";
  children: React.ReactNode;
  footer?: React.ReactNode;
  keepMounted?: boolean;
  zIndex?: number;
}

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  size = "md",
  children,
  footer,
  keepMounted = false,
  zIndex,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen && !keepMounted) return null;

  const sizeClasses: Record<string, string> = {
    sm: "cbst-modal-sm",
    md: "cbst-modal-md",
    lg: "cbst-modal-lg",
    xl: "cbst-modal-xl",
  };

  return (
    <div
      className="cbst-modal-overlay"
      style={{
        ...(!isOpen ? { display: "none" } : {}),
        ...(zIndex ? { zIndex } : {}),
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cbst-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className={`cbst-modal-card ${sizeClasses[size] || "cbst-modal-md"}`}
      >
        <div className="cbst-modal-header">
          <div>
            <h3 id="cbst-modal-title" className="cbst-modal-title">
              {title}
            </h3>
            {subtitle && (
              <p className="cbst-modal-subtitle">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            className="cbst-modal-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        <div className="cbst-modal-body">{children}</div>

        {footer && <div className="cbst-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
