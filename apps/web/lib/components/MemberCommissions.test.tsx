import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemberCommissions } from "./MemberCommissions";

describe("member commission view", () => {
  it("shows personal accruals, adjustments and payouts without admin actions or other members", () => {
    const html = renderToStaticMarkup(<MemberCommissions
      actor={{ id: "me", role: "MEMBER", displayName: "Nguyễn Thành Tài" }} lang="en"
      ledger={[
        { id: "a", kind: "COMMISSION", amountVnd: 68174, createdAt: "2026-10-14T00:00:00Z" },
        { id: "b", kind: "PAYOUT", amountVnd: 10000, createdAt: "2026-10-14T00:00:00Z" },
        { id: "c", kind: "COMMISSION", amountVnd: -1000, createdAt: "2026-10-14T00:00:00Z" },
        { id: "d", memberId: "other", orderId: "secret-order", kind: "COMMISSION", amountVnd: 999999, createdAt: "2026-10-14T00:00:00Z" },
      ]}
    />);
    expect(html).toContain("67,174");
    expect(html).toContain("57,174");
    expect(html).not.toContain("secret-order");
    expect(html).not.toContain("<button");
  });
});
