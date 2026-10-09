import { MapPin, ShieldCheck, User, PhoneCall } from "lucide-react";
import { site } from "@/data/site";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-main">
        <div className="footer-col-brand">
          <div className="footer-brand footer-wordmark">
            <span className="wordmark-title">Cá Bống Sông Trà</span>
            <span className="wordmark-sub">ĐẶC SẢN QUẢNG NGÃI</span>
          </div>
          <p className="footer-tagline">
            Hương vị quê nhà, tiện cho bữa cơm gia đình. Có hàng tại TP.HCM.
          </p>
          <div className="footer-region-info">
            <MapPin size={15} />
            <span>Phục vụ: {site.region}</span>
          </div>
          <div className="footer-contact-person">
            <User size={15} />
            <span>Phụ trách tư vấn: <strong>{site.contactName} (0702.478.561)</strong></span>
          </div>
        </div>

        <div className="footer-col-links">
          <h4>Danh mục nhanh</h4>
          <div className="footer-links-grid">
            <a href="#san-pham">3 Loại hũ cá bống</a>
            <a href="#bang-gia">Bảng size & Bảng giá</a>
            <a href="#cau-chuyen">Gợi ý mâm cơm ngon</a>
            <a href="#bao-quan">Hướng dẫn bảo quản</a>
            <a href="#cach-mua">Quy trình đặt mua Zalo</a>
            <a href="#faq">10 Câu hỏi đáp (FAQ)</a>
          </div>
        </div>

        <div className="footer-col-contact">
          <h4>Đặt mua & Tư vấn trực tiếp</h4>
          <p>
            Liên hệ trực tiếp với <strong>{site.contactName} (0702.478.561)</strong> qua Zalo để xem ảnh nhãn thực tế, kiểm tra hạn sử dụng của từng lô và báo phí ship nhanh nhất.
          </p>
          <div className="footer-phone-tag">
            <PhoneCall size={15} />
            <span>Số điện thoại / Zalo: <strong>0702.478.561</strong></span>
          </div>
        </div>
      </div>

      <div className="container footer-compliance">
        <div className="compliance-inner">
          <ShieldCheck size={18} />
          <p>
            * Thông tin minh bạch: Ba quy cách chuẩn của sản phẩm lần lượt là 300 g, 400 g và 600 g. Hạn sử dụng và ngày sản xuất được đối chiếu theo từng lô thực tế trước khi xác nhận đơn.
          </p>
        </div>
      </div>

      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} {site.fullName}. Tất cả quyền được bảo lưu.</span>
        <span>Phục vụ thực khách yêu ẩm thực miền Trung tại TP.HCM.</span>
      </div>
    </footer>
  );
}
