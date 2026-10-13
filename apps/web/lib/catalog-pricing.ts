export const effectivePrice = (product: { retailPriceVnd: number; effectivePriceVnd?: number }) => product.effectivePriceVnd ?? product.retailPriceVnd;
export function watchPricing(ends: (string | undefined)[], refresh: () => void, target: EventTarget = document, visible = () => document.visibilityState === "visible") {
  const timers = ends.filter((end): end is string => !!end).map(end => Date.parse(end) - Date.now()).filter(ms => ms > 0).map(ms => setTimeout(refresh, Math.min(ms, 2147483647)));
  const foreground = () => { if (visible()) refresh(); };
  target.addEventListener("visibilitychange", foreground);
  return () => { timers.forEach(clearTimeout); target.removeEventListener("visibilitychange", foreground); };
}
