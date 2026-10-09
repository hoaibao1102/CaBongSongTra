import type { ProductSeed } from "./types";

export const canonicalProducts: ProductSeed[] = [
  {
    sku: "CBST-300",
    slug: "ca-bong-song-tra-300g",
    name: "Ca bong Song Tra 300g",
    labelNetWeightG: 300,
    retailPrice: 109_000,
    openingUnitCost: 65_000,
  },
  {
    sku: "CBST-400",
    slug: "ca-bong-song-tra-400g",
    name: "Ca bong Song Tra 400g",
    labelNetWeightG: 400,
    retailPrice: 139_000,
    openingUnitCost: 95_000,
  },
  {
    sku: "CBST-600",
    slug: "ca-bong-song-tra-600g",
    name: "Ca bong Song Tra 600g",
    labelNetWeightG: 600,
    retailPrice: 199_000,
    openingUnitCost: 140_000,
  },
];

export const adminNav = [
  { href: "/admin", label: "Tổng quan" },
  { href: "/admin/products", label: "Sản phẩm & giá bán" },
  { href: "/admin/inventory", label: "Kho & lô hàng" },
  { href: "/admin/orders", label: "Khách hàng & đơn hàng" },
  { href: "/admin/finance", label: "Tài chính & hoa hồng" },
  { href: "/admin/audit", label: "Nhật ký & xuất dữ liệu" },
];
