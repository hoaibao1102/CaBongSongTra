export const adminSections = [
  "dashboard", "create-order", "orders", "inventory", "users", "products",
  "promotions", "vouchers", "media", "expenses", "commissions", "audit",
] as const;

export function adminSection(pathname: string): string | null {
  if (pathname === "/admin" || pathname === "/admin/") return "dashboard";
  const match = /^\/admin\/([^/]+)\/?$/.exec(pathname);
  return match && adminSections.some((section) => section === match[1]) ? match[1] : null;
}

export function navigate(path: string, replace = false) {
  if (typeof window === "undefined") return;
  if (window.location.pathname + window.location.search + window.location.hash === path) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", path);
  window.dispatchEvent(new Event("app:navigate"));
}
