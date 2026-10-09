"use client";
import { MessageCircle } from "lucide-react";
import { site } from "@/data/site";
import type { ReactNode } from "react";

type Props = {
  product?: string;
  message?: string;
  className?: string;
  children?: ReactNode;
  floating?: boolean;
};

export function ZaloLink({
  product,
  className = "",
  children,
  floating = false,
}: Props) {
  const classNames = `${floating ? "floating-zalo" : "button-primary"} ${className}`;

  return (
    <a
      href={site.zaloDirectLink}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={product ? `Mở Zalo để hỏi về ${product}` : "Liên hệ qua Zalo"}
      className={classNames}
    >
      <MessageCircle size={18} strokeWidth={1.9} />
      {children ?? "Nhắn Zalo"}
    </a>
  );
}
