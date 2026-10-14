import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionForm, Records, Storefront, Admin, ResetIssue, InternalOrderCreator, MemberLeaderboardWidget } from "./screens";
import { actions } from "../lib/commerce";
import ProductDetail from "./products/[sku]/product-detail";

describe("bilingual usable screens", () => {
  it("does not fabricate internal catalog prices and exposes voucher verification", () => {
    const html = renderToStaticMarkup(<InternalOrderCreator actor={{ id: "member", role: "MEMBER" }} lang="en" />);
    expect(html).not.toContain("109,000");
    expect(html).toContain('name="voucherCode"');
    expect(html).toContain("Review price");
  });
  it("starts a new internal order with every product quantity at zero", () => {
    const products = [
      { sku: "CBST-300", name: "300g", netWeightG: 300, retailPriceVnd: 109000 },
      { sku: "CBST-400", name: "400g", netWeightG: 400, retailPriceVnd: 139000 },
      { sku: "CBST-600", name: "600g", netWeightG: 600, retailPriceVnd: 199000 },
    ];
    const html = renderToStaticMarkup(
      <InternalOrderCreator actor={{ id: "member", role: "MEMBER" }} lang="vi" products={products} />,
    );

    expect(html.match(/class="stepper-input"[^>]*value="0"/g)).toHaveLength(3);
    expect(html).not.toContain("product-picker-item active");
  });
  it("provides product detail loading and safety links without fabricated product data", () => {
    const html = renderToStaticMarkup(<ProductDetail sku="CBST-300" />);
    expect(html).toContain('href="/label-safety"');
    expect(html).toContain('role="status"');
    expect(html).not.toContain("109.000");
  });
  it("renders the actual string product name returned by the API", () => {
    const html = renderToStaticMarkup(
      <Storefront
        lang="vi"
        products={[
          {
            sku: "CBST-300",
            name: "Ca bong API name",
            netWeightG: 300,
            retailPriceVnd: 123000,
          },
        ]}
        onCreated={() => {}}
      />,
    );
    expect(html).toContain("Ca bong API name");
    expect(html).toContain("123.000");
  });
  it.each(["vi", "en"] as const)(
    "renders storefront and checkout in %s without invented prices",
    (lang) => {
      const html = renderToStaticMarkup(
        <Storefront lang={lang} products={[]} onCreated={() => {}} />,
      );
      expect(html).toContain('name="phone"');
      expect(html).toContain('name="consent"');
      expect(html).toContain('name="address"');
      expect(html).not.toContain("109.000");
      expect(html).toContain("disabled");
    },
  );
  it.each(Object.keys(actions))(
    "renders labeled, validated %s form",
    (action) => {
      const html = renderToStaticMarkup(
        <ActionForm action={action} lang="en" onSuccess={() => {}} />,
      );
      expect(html).toContain("<label");
      expect(html).toContain("<button");
      expect(html).not.toContain('textarea name="json"');
    },
  );
  it("shows every updateable order status in the transition dropdown", () => {
    const html = renderToStaticMarkup(
      <ActionForm action="transition" lang="en" onSuccess={() => {}} />,
    );
    for (const status of [
      "CONFIRMED",
      "PACKING",
      "SHIPPING",
      "DELIVERED",
      "CANCELLED",
      "DELIVERY_FAILED",
      "RETURN_REQUESTED",
      "PARTIALLY_RETURNED",
      "RETURNED",
    ]) {
      expect(html).toContain(`value="${status}"`);
    }
  });
  it("shows member names and includes the admin's directly managed orders in KPI", () => {
    const html = renderToStaticMarkup(
      <MemberLeaderboardWidget
        lang="vi"
        actor={{ id: "admin-id", role: "OWNER_ADMIN" }}
        users={[
          {
            id: "member-id",
            displayName: "Nguyễn Văn An",
            emailNormalized: "an@example.com",
            role: "MEMBER",
            status: "ACTIVE",
          },
        ]}
        orders={[
          { id: "one", responsibleMemberId: "member-id", status: "DELIVERED", totalVnd: 109000 },
          { id: "two", responsibleMemberId: null, status: "DELIVERED", totalVnd: 139000 },
        ]}
      />,
    );
    expect(html).toContain("Nguyễn Văn An");
    expect(html).toContain("Lê Phạm Hoài Bảo");
    expect(html).not.toContain("member-id");
  });
  it("hides owner-only screens and forms from members", () => {
    const html = renderToStaticMarkup(
      <Admin actor={{ id: "member", role: "MEMBER" }} lang="en" />,
    );
    expect(html).toContain("Orders");
    expect(html).toContain("Commissions");
    expect(html).not.toContain("Inventory");
    expect(html).not.toContain("Audit log");
  });
  it("renders all owner navigation", () => {
    const html = renderToStaticMarkup(
      <Admin actor={{ id: "owner", role: "OWNER_ADMIN" }} lang="en" />,
    );
    for (const text of [
      "Inventory",
      "Users",
      "Products",
      "Expenses",
      "Commissions",
      "Audit log",
    ])
      expect(html).toContain(text);
  });
  it("requires deliberate owner confirmation before issuing a reset token", () => {
    const html = renderToStaticMarkup(<ResetIssue id="member" lang="en" />);
    expect(html).toContain("required");
    expect(html).toContain("Issue reset token");
    expect(html).not.toContain("localStorage");
  });
  it("renders empty state and accessible tabular records rather than raw JSON", () => {
    expect(renderToStaticMarkup(<Records rows={[]} lang="en" />)).toContain(
      "No records",
    );
    const html = renderToStaticMarkup(
      <Records
        rows={[{ id: "1", amountVnd: 1000, kind: "PAYMENT" }]}
        lang="en"
      />,
    );
    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
    expect(html).toContain("1,000");
  });
});
