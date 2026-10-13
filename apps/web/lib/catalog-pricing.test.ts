import { expect, it, vi } from "vitest";
import { effectivePrice, watchPricing } from "./catalog-pricing";
it("uses effective prices including zero and refreshes on expiry/foreground with cleanup", () => {
  expect(effectivePrice({ retailPriceVnd: 100, effectivePriceVnd: 0 })).toBe(0);
  expect(effectivePrice({ retailPriceVnd: 100 })).toBe(100);
  vi.useFakeTimers();
  const target = new EventTarget();
  const refresh = vi.fn();
  const stop = watchPricing([new Date(Date.now() + 1000).toISOString()], refresh, target, () => true);
  vi.advanceTimersByTime(1000);
  expect(refresh).toHaveBeenCalledTimes(1);
  target.dispatchEvent(new Event("visibilitychange"));
  expect(refresh).toHaveBeenCalledTimes(2);
  stop();
  target.dispatchEvent(new Event("visibilitychange"));
  expect(refresh).toHaveBeenCalledTimes(2);
  vi.useRealTimers();
});
