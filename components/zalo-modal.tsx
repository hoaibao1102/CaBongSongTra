"use client";
import { useState, createContext, useContext, ReactNode } from "react";
import Image from "next/image";
import { X, ArrowUpRight, MessageCircle } from "lucide-react";
import { site } from "@/data/site";
import { zaloLink } from "@/lib/zalo";

type ZaloModalContextType = {
  openModal: () => void;
};

const ZaloModalContext = createContext<ZaloModalContextType>({
  openModal: () => {},
});

export function useZaloModal() {
  return useContext(ZaloModalContext);
}

export function ZaloModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const href = zaloLink();

  return (
    <ZaloModalContext.Provider value={{ openModal: () => setIsOpen(true) }}>
      {children}

      {isOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Liên hệ Zalo Hoài Bảo"
        >
          <div
            className="zalo-popup-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="zalo-popup-header">
              <div className="zalo-popup-title">
                <MessageCircle size={20} className="text-emerald-600" />
                <span>Liên hệ Zalo — {site.contactName}</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="zalo-popup-body">
              <div className="zalo-qr-display-box">
                <Image
                  src={site.zaloQrImage}
                  alt={`Mã QR Zalo kết bạn với ${site.contactName}`}
                  width={260}
                  height={396}
                  className="zalo-qr-popup-img"
                  priority
                />
              </div>

              <div className="zalo-popup-instructions">
                <h4>Quét mã hoặc mở ứng dụng Zalo</h4>
                <p>
                  Mở ứng dụng Zalo trên điện thoại, chọn biểu tượng <strong>Quét mã QR</strong> để kết bạn trực tiếp với <strong>{site.contactName}</strong> và được tư vấn mẻ cá bống mới nhất.
                </p>

                <div className="zalo-popup-actions">
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="zalo-popup-direct-btn"
                  >
                    Mở Zalo kết bạn ngay <ArrowUpRight size={16} />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ZaloModalContext.Provider>
  );
}
