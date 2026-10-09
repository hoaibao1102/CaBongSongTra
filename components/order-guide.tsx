"use client";
import { useState } from "react";
import { Copy, Check, MessageSquare, ArrowRight } from "lucide-react";

const templates = [
  {
    label: "Hũ vừa (400g)",
    text: "Chào shop, mình muốn hỏi mua 1 hũ cá bống Sông Trà loại 400 g giá 139.000đ. Mình ở [khu vực/quận], shop báo giúp phí giao và hạn sử dụng còn lại của lô hàng nhé.",
  },
  {
    label: "Hũ nhỏ (300g)",
    text: "Chào shop, mình muốn hỏi mua 1 hũ cá bống Sông Trà loại nhỏ 300 g giá 109.000đ để dùng thử. Mình ở [khu vực/quận], shop báo giúp phí giao và hạn sử dụng nhé.",
  },
  {
    label: "Hũ lớn (600g)",
    text: "Chào shop, mình muốn hỏi mua 1 hũ cá bống Sông Trà loại lớn 600 g giá 199.000đ cho gia đình. Mình ở [khu vực/quận], shop báo giúp phí giao và hạn sử dụng nhé.",
  },
];

export function OrderGuide() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(templates[selectedIdx].text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="order-guide-container">
      <div className="steps-cards">
        <div className="step-card">
          <span className="step-num">01</span>
          <h4>Chọn loại hũ</h4>
          <p>Tham khảo 3 quy cách (300g, 400g, 600g) và giá bán công khai phù hợp với nhu cầu.</p>
        </div>

        <div className="step-divider">
          <ArrowRight size={20} />
        </div>

        <div className="step-card">
          <span className="step-num">02</span>
          <h4>Nhắn qua Zalo</h4>
          <p>Bấm nút Zalo để gửi loại hũ, số lượng và khu vực nhận hàng (TP.HCM / Thủ Đức).</p>
        </div>

        <div className="step-divider">
          <ArrowRight size={20} />
        </div>

        <div className="step-card">
          <span className="step-num">03</span>
          <h4>Xác nhận & Giao hàng</h4>
          <p>Shop kiểm tra tồn kho, đối chiếu hạn sử dụng lô hàng, báo phí ship và chốt đơn giao tận nơi.</p>
        </div>
      </div>

      <div className="sample-message-box">
        <div className="sample-message-header">
          <div className="sample-message-title">
            <MessageSquare size={18} />
            <span>Tin nhắn mẫu gửi Zalo tiện lợi:</span>
          </div>
          <div className="sample-tabs">
            {templates.map((tpl, i) => (
              <button
                key={i}
                type="button"
                className={`sample-tab-btn ${selectedIdx === i ? "active" : ""}`}
                onClick={() => setSelectedIdx(i)}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sample-message-content">
          <p>“{templates[selectedIdx].text}”</p>
        </div>

        <div className="sample-message-actions">
          <button
            type="button"
            className="copy-sample-btn"
            onClick={handleCopy}
            aria-label="Sao chép nội dung tin nhắn mẫu"
          >
            {copied ? (
              <>
                <Check size={16} /> Đã sao chép nội dung tin nhắn!
              </>
            ) : (
              <>
                <Copy size={16} /> Sao chép tin nhắn mẫu
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
