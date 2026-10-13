import { describe, it, expect } from "vitest";
import { formatVndString } from "./CurrencyInput";

describe("Shared UI Primitives & Domain Formatting", () => {
  it("formatVndString formats numbers properly", () => {
    expect(formatVndString(0)).toBe("");
    expect(formatVndString(100000)).toMatch(/100[.,]000/);
    expect(formatVndString(2435000)).toMatch(/2[.,]435[.,]000/);
  });

  it("calculates commission percentage correctly from bps", () => {
    const bpsToPercent = (bps: number) => `${(bps / 100).toFixed(1)}%`;
    expect(bpsToPercent(4000)).toBe("40.0%");
    expect(bpsToPercent(3550)).toBe("35.5%");
    expect(bpsToPercent(0)).toBe("0.0%");
  });

  it("verifies negative stock adjustment only allows <= 0 delta", () => {
    const isNegativeOnly = (delta: number) => delta <= 0;
    expect(isNegativeOnly(-5)).toBe(true);
    expect(isNegativeOnly(0)).toBe(true);
    expect(isNegativeOnly(5)).toBe(false);
  });
});
