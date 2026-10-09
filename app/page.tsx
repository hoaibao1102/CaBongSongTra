import Image from "next/image";
import {
  ArrowDownRight,
  ArrowUpRight,
  MapPin,
  MessageCircle,
  PackageCheck,
  ShieldCheck,
  Truck,
  Sparkles,
  UtensilsCrossed,
  Info,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  site,
  servingSuggestions,
} from "@/data/site";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ProductSlider } from "@/components/product-slider";
import { PosterGallery } from "@/components/poster-gallery";
import { ImagePreviewTrigger } from "@/components/image-modal";
import { OrderGuide } from "@/components/order-guide";
import { FaqAccordion } from "@/components/faq-accordion";
import { ContactCard } from "@/components/contact-card";

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#noi-dung">
        Bỏ qua đến nội dung chính
      </a>
      <div id="dau-trang" />
      <Header />

      <main id="noi-dung">
        {/* HERO SECTION */}
        <section className="hero container">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="eyebrow-line" />
              {site.eyebrow}
            </div>

            <h1 className="hero-title">
              Cá Bống Sông Trà
              <span className="hero-subline">
                - Hương vị Quảng Ngãi trong <em>bữa cơm nhà.</em>
              </span>
            </h1>

            <p className="hero-description">{site.intro}</p>

            <div className="hero-buttons">
              <a className="button-dark" href="#san-pham">
                Khám phá 3 quy cách <ArrowDownRight size={18} />
              </a>
              <a className="button-light" href="#bang-gia">
                Xem bảng giá & size
              </a>
            </div>

            <div className="hero-meta-badges">
              <div className="meta-badge-item">
                <MapPin size={16} className="badge-icon" />
                <span>Có hàng tại TP.HCM (ưu tiên TP Thủ Đức)</span>
              </div>
              <div className="meta-badge-item">
                <CheckCircle2 size={16} className="badge-icon" />
                <span>Đối chiếu HSD theo từng lô thực tế</span>
              </div>
              <div className="meta-badge-item">
                <ShieldCheck size={16} className="badge-icon" />
                <span>Giá bán công khai, minh bạch</span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-card-display">
              <div className="hero-card-header">
                <span className="hero-card-kicker">ẢNH BỘ SẢN PHẨM THỰC TẾ</span>
                <span className="hero-card-tag">3 KÍCH CỠ HŨ</span>
              </div>

              <ImagePreviewTrigger
                src="/images/bang-size.png"
                alt="Bảng kích thước 3 hũ cá bống Sông Trà Quảng Ngãi thực tế"
                title="Bảng so sánh kích thước 3 hũ thực tế"
                className="hero-image-wrap"
              >
                <Image
                  src="/images/bang-size.png"
                  alt="Ảnh thực tế bảng size 3 hũ cá bống Sông Trà"
                  width={680}
                  height={880}
                  priority
                  className="hero-art-img"
                />
              </ImagePreviewTrigger>

              <div className="hero-card-footer">
                <div className="hero-card-prices">
                  <span>Hũ nhỏ: <strong>109.000đ</strong></span>
                  <span>·</span>
                  <span>Hũ vừa: <strong>139.000đ</strong></span>
                  <span>·</span>
                  <span>Hũ lớn: <strong>199.000đ</strong></span>
                </div>
                <small className="hero-card-note">Bấm vào ảnh để phóng to xem rõ nét</small>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES BANNER */}
        <section className="features-section">
          <div className="container features-grid">
            <div className="feature-item">
              <div className="feature-icon-box">
                <PackageCheck size={24} />
              </div>
              <div className="feature-info">
                <strong>Ba quy cách rõ ràng</strong>
                <span>300g · 400g · 600g chuẩn xác theo sản phẩm</span>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon-box">
                <Sparkles size={24} />
              </div>
              <div className="feature-info">
                <strong>Kho đậm vị quê nhà</strong>
                <span>Thơm ngon, săn chắc và hao cơm</span>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon-box">
                <Truck size={24} />
              </div>
              <div className="feature-info">
                <strong>Giao tại TP.HCM</strong>
                <span>Thủ Đức & các quận tùy đơn thực tế</span>
              </div>
            </div>

            <div className="feature-item">
              <div className="feature-icon-box">
                <MessageCircle size={24} />
              </div>
              <div className="feature-info">
                <strong>Tư vấn Zalo trực tiếp</strong>
                <span>Kiểm tra tồn kho & báo phí trước khi giao</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: PRODUCTS */}
        <section id="san-pham" className="section container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">01 / DANH MỤC SẢN PHẨM</span>
              <h2>
                Chọn hũ vừa với
                <br />
                <em>bữa cơm của bạn.</em>
              </h2>
            </div>
            <p>
              Ba lựa chọn hũ từ nhỏ đến lớn. Giá niêm yết rõ ràng, thông tin quy cách chuẩn xác và tư vấn hạn dùng cụ thể trước khi gửi hàng.
            </p>
          </div>

          <ProductSlider />

          <div className="product-disclaimer-box">
            <ShieldCheck size={20} className="disclaimer-icon" />
            <div className="disclaimer-text">
              <strong>Lưu ý quan trọng về khối lượng & giá bán:</strong>
              <p>
                Khối lượng 3 size hũ chuẩn xác lần lượt là <strong>300 g / 400 g / 600 g</strong> theo thông số sản phẩm.
                Giá bán công khai minh bạch (109.000đ / 139.000đ / 199.000đ), chưa mặc định bao gồm phí vận chuyển; Hoài Bảo sẽ báo phí giao hàng cụ thể theo khu vực trước khi bạn xác nhận đơn.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 2: COMPARISON & PRICE POSTERS */}
        <section id="bang-gia" className="section compare-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="section-kicker">02 / BẢNG SO SÁNH & BẢNG GIÁ</span>
                <h2>
                  Xem ảnh thực tế &
                  <br />
                  <em>bảng giá niêm yết.</em>
                </h2>
              </div>
              <p>
                Đối chiếu trực quan kích thước và mức giá của cả 3 loại hũ. Bạn có thể bấm vào từng ảnh để phóng to và xem rõ từng chi tiết trên bao bì.
              </p>
            </div>

            <PosterGallery />
          </div>
        </section>

        {/* SECTION 3: STORY & SERVING SUGGESTIONS */}
        <section id="cau-chuyen" className="story-section">
          <div className="container">
            <div className="story-grid">
              <div className="story-art-card">
                <div className="story-visual-bg">
                  <div className="story-badge-top">ĐẶC SẢN MIỀN TRUNG</div>
                  <div className="story-quote">
                    “Một món mặn quen thuộc,
                    <br />
                    cho bữa cơm phố thị thêm ấm lòng.”
                  </div>
                  <div className="story-location-tag">
                    <span>QUẢNG NGÃI</span>
                    <small>SÔNG TRÀ</small>
                  </div>
                </div>
              </div>

              <div className="story-copy">
                <span className="section-kicker">03 / HƯƠNG VỊ QUÊ NHÀ</span>
                <h2>
                  Một món ngon.
                  <br />
                  <em>Một chút nhớ quê hương.</em>
                </h2>
                <p>
                  Giữa những ngày bận rộn ở TP.HCM, đôi khi chỉ cần một món mặn quen thuộc là bữa cơm đã trở nên ấm áp và tròn vị hơn.
                </p>
                <p>
                  Cá bống Sông Trà là món đặc sản gắn liền với mảnh đất Quảng Ngãi. Cá kho đậm đà, săn chắc, hòa quyện hương thơm tiêu ớt ấm nồng. Chúng tôi giới thiệu sản phẩm đóng hũ tiện lợi để quý khách tại TP.HCM dễ dàng thưởng thức hương vị quê nhà bất cứ lúc nào.
                </p>
                <div className="story-actions">
                  <a href="#cach-mua" className="text-link">
                    Xem quy trình đặt hàng nhanh <ArrowUpRight size={17} />
                  </a>
                </div>
              </div>
            </div>

            {/* Serving suggestions */}
            <div className="serving-block">
              <div className="serving-heading">
                <UtensilsCrossed size={20} />
                <h3>Gợi ý thưởng thức trong bữa ăn gia đình</h3>
              </div>

              <div className="serving-grid">
                {servingSuggestions.map((item, idx) => (
                  <div key={idx} className="serving-card">
                    <span className="serving-tag">{item.tag}</span>
                    <h4>{item.title}</h4>
                    <p>{item.desc}</p>
                  </div>
                ))}
              </div>
              <p className="serving-note">
                * Gợi ý món ăn là ý tưởng phục vụ món ngon; vui lòng tuân thủ chỉ dẫn bảo quản và an toàn từ nhãn của nhà sản xuất.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 4: STORAGE & SAFETY */}
        <section id="bao-quan" className="section container storage-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">04 / BẢO QUẢN & AN TOÀN THỰC PHẨM</span>
              <h2>
                Bảo quản đúng cách,
                <br />
                <em>thưởng thức an tâm.</em>
              </h2>
            </div>
            <p>
              Chúng tôi luôn đề cao tính trung thực và minh bạch về thông tin sản phẩm và an toàn cho khách hàng.
            </p>
          </div>

          <div className="storage-cards-grid">
            <div className="storage-card">
              <div className="storage-icon-wrap">
                <Clock size={24} />
              </div>
              <h4>Hạn sử dụng theo lô</h4>
              <p>
                Ngày sản xuất và hạn sử dụng được in cụ thể trên từng lô hàng theo nhãn nhà sản xuất. Shop đối chiếu hạn sử dụng còn lại trước khi xác nhận gửi hàng.
              </p>
            </div>

            <div className="storage-card">
              <div className="storage-icon-wrap">
                <ShieldCheck size={24} />
              </div>
              <h4>Hướng dẫn bảo quản</h4>
              <p>
                Vui lòng xem chỉ dẫn nhiệt độ và vị trí bảo quản (ngăn mát tủ lạnh) ghi rõ trên nhãn chai hũ. Quý khách có thể nhắn Zalo để nhận hình ảnh chụp nhãn thực tế.
              </p>
            </div>

            <div className="storage-card">
              <div className="storage-icon-wrap">
                <Info size={24} />
              </div>
              <h4>Sau khi mở nắp</h4>
              <p>
                Nên bảo quản lạnh sau khi mở nắp. Sử dụng muỗng, đũa khô sạch để lấy cá; đậy chặt nắp sau mỗi lần dùng. Nếu phát hiện mùi, màu sắc bất thường hoặc bao bì phồng rò rỉ, không sử dụng.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 5: ORDER GUIDE */}
        <section id="cach-mua" className="section container order-section">
          <div className="section-heading">
            <div>
              <span className="section-kicker">05 / CÁCH ĐẶT HÀNG</span>
              <h2>
                Thích hũ nào,
                <br />
                <em>nhắn Zalo là xong.</em>
              </h2>
            </div>
            <p>
              Không cần tạo tài khoản hay thanh toán phức tạp trên website. Mỗi đơn hàng đều được trao đổi và xác nhận trực tiếp qua Zalo.
            </p>
          </div>

          <OrderGuide />

          <ContactCard />
        </section>

        {/* SECTION 6: FAQ ACCORDION */}
        <section id="faq" className="section faq-section">
          <div className="container">
            <div className="section-heading">
              <div>
                <span className="section-kicker">06 / HỎI ĐÁP KHÁCH HÀNG</span>
                <h2>
                  Những thắc mắc
                  <br />
                  <em>thường gặp nhất.</em>
                </h2>
              </div>
              <p>
                Tổng hợp 10 câu hỏi đáp chi tiết về quy cách hũ, giá bán, bảo quản, mức độ cay và phương thức giao hàng.
              </p>
            </div>

            <FaqAccordion />
          </div>
        </section>

        {/* FINAL CONTACT CTA BANNER */}
        <section className="container contact-banner-wrap">
          <div className="contact-banner">
            <div>
              <span className="contact-kicker">CÓ HÀNG SẴN TẠI TP.HCM</span>
              <h3>
                Đặc sản quê nhà,
                <br />
                gần bạn hơn một tin nhắn.
              </h3>
              <p>
                Khu vực phục vụ: {site.region}. Nhắn Zalo ngay để được tư vấn kích thước hũ phù hợp và nhận hàng nhanh chóng.
              </p>
            </div>
            <a href="#cach-mua" className="contact-cta">
              Xem cách đặt hàng <ArrowDownRight size={18} />
            </a>
          </div>
        </section>
      </main>

      <Footer />
      <a
        href={site.zaloDirectLink}
        target="_blank"
        rel="noopener noreferrer"
        className="floating-zalo"
        aria-label={`Nhắn Zalo tư vấn với ${site.contactName}`}
      >
        <MessageCircle size={18} strokeWidth={1.9} />
        <span>Nhắn Zalo tư vấn</span>
      </a>
    </>
  );
}
