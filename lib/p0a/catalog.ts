import type { ProductSeed } from "./types";

export const canonicalProducts: ProductSeed[] = [
  { sku: "CBST-300", slug: "ca-bong-song-tra-300g", name: "Ca bong Song Tra 300g", labelNetWeightG: 300, retailPrice: 109_000, openingUnitCost: 65_000 },
  { sku: "CBST-400", slug: "ca-bong-song-tra-400g", name: "Ca bong Song Tra 400g", labelNetWeightG: 400, retailPrice: 139_000, openingUnitCost: 95_000 },
  { sku: "CBST-600", slug: "ca-bong-song-tra-600g", name: "Ca bong Song Tra 600g", labelNetWeightG: 600, retailPrice: 199_000, openingUnitCost: 140_000 },
];

export const adminNav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products & pricing" },
  { href: "/admin/inventory", label: "Inventory & batches" },
  { href: "/admin/orders", label: "Customers & orders" },
  { href: "/admin/finance", label: "Payments & commission" },
  { href: "/admin/audit", label: "Audit & export" },
];
