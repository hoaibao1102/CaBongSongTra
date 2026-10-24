import { describe, expect, it, vi } from "vitest";
import {
  actions,
  buildPayload,
  checkoutPayload,
  transitions,
  sectionsFor,
  createMutation,
  apiRequest,
} from "./commerce";

describe("local API contract and forms", () => {
  it("builds checkout using qty, server pricing, consent and nested customer", () => {
    const result = checkoutPayload(
      {
        name: "Lan",
        phone: "0912345678",
        address: "12 Tran Phu",
        area: "Quang Ngai",
        consent: true,
        source: "WEBSITE",
        notes: "",
      },
      { "CBST-300": 2, "CBST-400": 0 },
    );
    expect(result).toEqual({
      customer: {
        name: "Lan",
        phone: "0912345678",
        address: "12 Tran Phu",
        area: "Quang Ngai",
      },
      consent: true,
      source: "WEBSITE",
      notes: "",
      items: [{ sku: "CBST-300", qty: 2 }],
    });
  });
  it.each([{ consent: false }, { phone: "123" }, { name: " " }])(
    "rejects invalid checkout %s",
    (values) => {
      expect(() =>
        checkoutPayload(
          {
            name: "Lan",
            phone: "0912345678",
            address: "12 Tran Phu",
            area: "QN",
            consent: true,
            source: "WEBSITE",
            ...values,
          },
          { "CBST-300": 1 },
        ),
      ).toThrow();
    },
  );
  it.each<Record<string, number>>([
    {},
    { "CBST-300": 1.5 },
    { "CBST-300": 101 },
    { BAD: 1 },
  ])("rejects invalid carts %s", (cart) => {
    expect(() =>
      checkoutPayload(
        {
          name: "Lan",
          phone: "0912345678",
          address: "12 Tran Phu",
          area: "QN",
          consent: true,
          source: "WEBSITE",
        },
        cart,
      ),
    ).toThrow();
  });
  it("restricts member navigation and return transitions", () => {
    expect(sectionsFor("MEMBER")).toEqual([
      "dashboard",
      "create-order",
      "orders",
      "vouchers",
      "commissions",
    ]);
    expect(sectionsFor("OWNER_ADMIN")).toContain("audit");
    expect(transitions("SHIPPING", "MEMBER")).toEqual([
      "DELIVERED",
      "DELIVERY_FAILED",
    ]);
    expect(transitions("DELIVERED", "OWNER_ADMIN")).toEqual([
      "RETURN_REQUESTED",
    ]);
    expect(transitions("CANCELLED", "OWNER_ADMIN")).toEqual([]);
    expect(transitions("RETURN_REQUESTED", "OWNER_ADMIN")).toEqual([]);
    expect(transitions("DELIVERY_FAILED", "OWNER_ADMIN")).toEqual(["SHIPPING"]);
  });
  it.each([
    [
      "transition",
      { status: "CONFIRMED", reason: "Approved", expectedVersion: "2" },
      { status: "CONFIRMED", reason: "Approved", expectedVersion: 2 },
    ],
    [
      "payment",
      { amountVnd: "1000", method: "CASH", expectedVersion: "2" },
      { amountVnd: 1000, method: "CASH", expectedVersion: 2 },
    ],
    [
      "refund",
      {
        amountVnd: "1000",
        method: "BANK_TRANSFER",
        reason: "Returned",
        expectedVersion: "2",
      },
      {
        amountVnd: 1000,
        method: "BANK_TRANSFER",
        reason: "Returned",
        expectedVersion: 2,
      },
    ],
    [
      "costs",
      { expectedVersion: "2", finalized: true },
      { expectedVersion: 2, finalized: true },
    ],
    [
      "adjustment",
      {
        batchId: "123e4567-e89b-42d3-a456-426614174000",
        qtyDelta: "-2",
        reason: "Damaged",
      },
      {
        batchId: "123e4567-e89b-42d3-a456-426614174000",
        qtyDelta: -2,
        reason: "Damaged",
      },
    ],
    [
      "product",
      { expectedVersion: "0", retailPriceVnd: "109000", active: false },
      { expectedVersion: 0, retailPriceVnd: 109000, active: false },
    ],
    ["userStatus", { status: "INACTIVE" }, { status: "INACTIVE" }],
    [
      "payout",
      {
        memberId: "123e4567-e89b-42d3-a456-426614174000",
        reference: "Bank 123",
      },
      {
        memberId: "123e4567-e89b-42d3-a456-426614174000",
        reference: "Bank 123",
      },
    ],
  ])("builds %s DTO without extra properties", (action, values, expected) => {
    expect(buildPayload(action, { ...values, injected: "no" })).toEqual(
      expected,
    );
  });
  it("builds receipt with numeric costs, ISO dates and omitted optional fields", () => {
    expect(
      buildPayload("receipt", {
        sku: "CBST-300",
        lotCode: "LOT1",
        qty: "10",
        landedUnitCostVnd: "0",
        receivedAt: "2026-01-01T10:00",
        expiresAt: "",
        labelReference: "",
      }),
    ).toMatchObject({
      qty: 10,
      landedUnitCostVnd: 0,
      receivedAt: new Date("2026-01-01T10:00").toISOString(),
    });
    expect(
      buildPayload("receipt", {
        sku: "CBST-300",
        lotCode: "LOT1",
        qty: "10",
        landedUnitCostVnd: "0",
        receivedAt: "2026-01-01",
      }),
    ).not.toHaveProperty("expiresAt");
  });
  it("creates members without accepting a role and enforces password length", () => {
    expect(
      buildPayload("user", {
        email: "lan@example.test",
        password: "long-test-password",
        displayName: "Lan",
        role: "OWNER_ADMIN",
      }),
    ).not.toHaveProperty("role");
    expect(() =>
      buildPayload("user", {
        email: "lan@example.test",
        password: "short",
        displayName: "Lan",
      }),
    ).toThrow();
  });
  it("omits order fields on overhead and requires order version for order expenses", () => {
    const values = {
      scope: "OVERHEAD",
      amountVnd: "2000",
      category: "OTHER",
      reason: "Rent",
      orderId: "old",
      expectedVersion: "4",
    };
    expect(buildPayload("expense", values)).toEqual({
      scope: "OVERHEAD",
      amountVnd: 2000,
      category: "OTHER",
      reason: "Rent",
    });
    expect(() =>
      buildPayload("expense", { ...values, scope: "ORDER", orderId: "" }),
    ).toThrow();
  });
  it.each([
    ["payment", { amountVnd: "1.5" }],
    ["adjustment", { qtyDelta: "1" }],
    ["product", { retailPriceVnd: "0" }],
  ])("rejects invalid %s fields", (action, values) =>
    expect(() => buildPayload(action, values)).toThrow(),
  );
  it("maps each mutation to the implemented API", () => {
    expect(
      Object.fromEntries(
        Object.entries(actions).map(([key, action]) => [
          key,
          action.path("id"),
        ]),
      ),
    ).toMatchObject({
      login: "auth/login",
      transition: "orders/id/transitions",
      payment: "orders/id/payments",
      refund: "orders/id/refunds",
      costs: "orders/id/finalize-costs",
      receipt: "inventory/receipts",
      adjustment: "inventory/adjustments",
      user: "users",
      userStatus: "users/id",
      product: "products/id",
      expense: "expenses",
      payout: "commissions/payouts",
      assignment: "orders/id/assignment",
      resetPassword: "auth/reset-password",
      returnIntake: "orders/id/returns",
      editOrder: "orders/id",
    });
  });
  it("builds inspected return lines and explicit refund purpose", () => {
    expect(
      buildPayload("returnIntake", {
        expectedVersion: "3",
        batchId: "123e4567-e89b-42d3-a456-426614174000",
        qty: "2",
        disposition: "DISCARD",
        inspectionReference: "Inspection 12",
        reason: "Damaged",
      }),
    ).toEqual({
      expectedVersion: 3,
      lines: [
        {
          batchId: "123e4567-e89b-42d3-a456-426614174000",
          qty: 2,
          disposition: "DISCARD",
        },
      ],
      inspectionReference: "Inspection 12",
      reason: "Damaged",
    });
    expect(
      buildPayload("refund", {
        expectedVersion: "3",
        amountVnd: "1000",
        method: "CASH",
        reason: "Return credit",
        purpose: "RETURN",
      }),
    ).toHaveProperty("purpose", "RETURN");
  });
  it("builds versioned order edits with numeric SKU quantities", () => {
    expect(
      buildPayload("editOrder", {
        expectedVersion: "4",
        "CBST-300": "2",
        "CBST-400": "0",
        "CBST-600": "1",
        reason: "Customer request",
      }),
    ).toEqual({
      expectedVersion: 4,
      items: [
        { sku: "CBST-300", qty: 2 },
        { sku: "CBST-600", qty: 1 },
      ],
      reason: "Customer request",
    });
  });
});

describe("browser requests and safe retries", () => {
  it("uses same-origin BFF and never browser bearer tokens", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('{"role":"MEMBER"}'));
    await apiRequest("auth/me", undefined, fetcher);
    expect(fetcher.mock.calls[0][0]).toBe("/api/v1/auth/me");
    expect(fetcher.mock.calls[0][1].credentials).toBe("same-origin");
  });
  it("reuses a key for failed identical requests, changes it after success or payload edits", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(new Response('{"id":"1"}'));
    const mutate = createMutation(fetcher, mutationOptions());
    await expect(mutate("orders", { a: 1 })).rejects.toThrow();
    await mutate("orders", { a: 1 });
    const key = (index: number) =>
      new Headers(fetcher.mock.calls[index][1].headers).get("Idempotency-Key");
    expect(key(0)).toBe(key(1));
    fetcher.mockResolvedValue(new Response("{}"));
    await mutate("orders", { a: 2 });
    expect(key(2)).not.toBe(key(1));
  });
  it("includes guest scope only for public checkout", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response("{}")));
    await createMutation(fetcher, mutationOptions())(
      "checkout/orders",
      {},
      "POST",
      "a".repeat(32),
    );
    expect(
      new Headers(fetcher.mock.calls[0][1].headers).get("X-Guest-Session"),
    ).toBe("a".repeat(32));
  });
  it("reports API error status/code for session and conflict handling", async () => {
    await expect(
      apiRequest(
        "orders",
        undefined,
        vi
          .fn()
          .mockResolvedValue(
            new Response(
              '{"error":{"code":"VERSION_CONFLICT","requestId":"r1"}}',
              { status: 409 },
            ),
          ),
      ),
    ).rejects.toMatchObject({
      status: 409,
      code: "VERSION_CONFLICT",
      requestId: "r1",
    });
  });
  it("rejects absolute URLs and traversal in browser API calls", async () => {
    const fetcher = vi.fn();
    await expect(
      apiRequest("https://evil.example", undefined, fetcher),
    ).rejects.toThrow();
    await expect(
      apiRequest("../private", undefined, fetcher),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("blocks edits while retaining the original failed payload key", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    const mutate = createMutation(fetcher, mutationOptions());
    await mutate("orders", { qty: 1 }).catch(() => {});
    await expect(mutate("orders", { qty: 2 })).rejects.toThrow("OPERATION_RECONCILIATION_REQUIRED");
    await mutate("orders", { qty: 1 }).catch(() => {});
    expect(
      new Headers(fetcher.mock.calls[0][1].headers).get("Idempotency-Key"),
    ).toBe(
      new Headers(fetcher.mock.calls[1][1].headers).get("Idempotency-Key"),
    );
  });
});

function mutationOptions() { const values = new Map<string,string>(); return { actorId:"test-owner", store:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);},removeItem:(k:string)=>{values.delete(k);}} }; }
