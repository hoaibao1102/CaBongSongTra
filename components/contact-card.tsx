"use client";
import Image from "next/image";
import { ArrowUpRight, QrCode, Sparkles, UserCheck, MessageSquare, Phone } from "lucide-react";
import { site } from "@/data/site";
import { ImagePreviewTrigger } from "./image-modal";

export function ContactCard() {
  return (
    <div className="contact-profile-card">
      <div className="contact-card-badge">
        <Sparkles size={14} />
        <span>KẾT NỐI TRỰC TIẾP</span>
      </div>

      <div className="contact-card-grid">
        <div className="contact-card-qr-box">
          <ImagePreviewTrigger
            src={site.zaloQrImage}
            alt={`Mã QR Zalo kết bạn với ${site.contactName}`}
            title={`Mã QR Zalo - ${site.contactName}`}
            className="qr-image-wrapper"
          >
            <Image
              src={site.zaloQrImage}
              alt={`Mã QR Zalo - ${site.contactName}`}
              width={340}
              height={518}
              className="qr-card-img"
              priority
            />
          </ImagePreviewTrigger>
          <div className="qr-hint-text">
            <QrCode size={14} />
            <span>Quét bằng ứng dụng Zalo trên điện thoại</span>
          </div>
        </div>

        <div className="contact-card-info">
          <div className="contact-person-header">
            <div className="contact-person-avatar-badge">
              <UserCheck size={20} />
            </div>
            <div>
              <span className="contact-role">Người bán & Tư vấn trực tiếp</span>
              <h3 className="contact-person-name">
                {site.contactName}
                <span className="contact-phone-sub"> · 0702.478.561</span>
              </h3>
            </div>
          </div>

          <p className="contact-person-desc">
            Bạn có thể bấm nút bên dưới để mở trực tiếp trang cá nhân Zalo của <strong>{site.contactName} (0702.478.561)</strong> hoặc quét mã QR bên cạnh. Mình sẽ hỗ trợ kiểm tra mẻ cá thực tế, hạn sử dụng trên nhãn và báo phí ship nhanh nhất!
          </p>

          <div className="contact-badges-list">
            <div className="contact-badge-chip">
              <Phone size={14} />
              <span>Zalo: 0702.478.561</span>
            </div>
            <div className="contact-badge-chip">
              <MessageSquare size={14} />
              <span>Tư vấn chọn hũ phù hợp</span>
            </div>
            <div className="contact-badge-chip">
              <span>Gửi ảnh nhãn & mẻ cá thực tế</span>
            </div>
          </div>

          <div className="contact-card-buttons">
            <a
              href="https://zalo.me/0702478561"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-zalo-main-btn"
            >
              Mở Zalo kết bạn với {site.contactName} <ArrowUpRight size={17} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
