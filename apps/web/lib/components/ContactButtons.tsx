import { MessageCircle, PhoneCall } from "lucide-react";
import type { Lang } from "../types";

export function ContactButtons({ lang, floating = false }: { lang: Lang; floating?: boolean }) {
  const zaloLabel = lang === "vi" ? "Nhắn Zalo" : "Chat on Zalo";
  const callLabel = lang === "vi" ? "Gọi 070 2478 561" : "Call 070 2478 561";
  return (
    <div className={`contact-buttons${floating ? " contact-buttons--floating" : ""}`} role="group" aria-label={lang === "vi" ? "Liên hệ tư vấn" : "Contact us"}>
      <a className="contact-icon contact-icon--zalo" href="https://zalo.me/0702478561" target="_blank" rel="noopener noreferrer" aria-label={zaloLabel}>
        <span className="contact-icon-art" aria-hidden="true"><MessageCircle size={31} strokeWidth={1.7} /><span className="contact-zalo-word">Zalo</span></span>
        <span className="contact-tooltip" aria-hidden="true">{zaloLabel}</span>
      </a>
      <a className="contact-icon contact-icon--phone" href="tel:0702478561" aria-label={callLabel}>
        <PhoneCall className="contact-phone-art" size={25} strokeWidth={2} aria-hidden="true" />
        <span className="contact-tooltip" aria-hidden="true">{callLabel}</span>
      </a>
    </div>
  );
}
