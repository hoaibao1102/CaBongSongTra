import { site } from "@/data/site";

/**
 * Tạo liên kết trực tiếp vào trang cá nhân / khung chat Zalo của Hoài Bảo:
 * https://zalo.me/0702478561
 */
export function zaloLink(): string {
  if (site.zaloDirectLink) {
    return site.zaloDirectLink;
  }
  const raw = site.zaloPhone?.trim() || "0702478561";
  return `https://zalo.me/${raw}`;
}
