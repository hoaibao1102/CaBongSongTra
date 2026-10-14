"use client";

import { useState, type ImgHTMLAttributes } from "react";
import { ImageOff } from "lucide-react";

export function LandingImage({ src, alt, className, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  if (!src || src === failedSource) {
    return <span className={`landing-image-placeholder ${className ?? ""}`} role="img" aria-label={alt || "Ảnh chưa khả dụng"}><ImageOff size={32} aria-hidden="true" /><span>{alt}</span></span>;
  }
  return <img {...props} src={src} alt={alt} className={className} onError={() => setFailedSource(String(src))} />;
}
