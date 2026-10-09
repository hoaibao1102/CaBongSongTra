"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { faqs } from "@/data/site";

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="faq-list">
      {faqs.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={index}
            className={`faq-item ${isOpen ? "faq-item-open" : ""}`}
          >
            <button
              type="button"
              className="faq-question"
              onClick={() => toggle(index)}
              aria-expanded={isOpen}
            >
              <span className="faq-num">{String(index + 1).padStart(2, "0")}</span>
              <span className="faq-q-text">{item.q}</span>
              <ChevronDown
                size={18}
                className={`faq-icon ${isOpen ? "faq-icon-rotated" : ""}`}
              />
            </button>
            {isOpen && (
              <div className="faq-answer">
                <p>{item.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
