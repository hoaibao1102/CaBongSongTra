import { describe, expect, it } from "vitest";
import {
  assertActorCanAccessOrder,
  assertExpectedVersion,
  assertTransition,
} from "../src/orders/order-policy";

describe("order authorization policy", () => {
  const order = { responsibleMemberId: "member-a", version: 3, status: "PENDING" as const };

  it("allows owner and responsible member", () => {
    expect(() => assertActorCanAccessOrder({ id: "owner", role: "OWNER_ADMIN" }, order)).not.toThrow();
    expect(() => assertActorCanAccessOrder({ id: "member-a", role: "MEMBER" }, order)).not.toThrow();
  });

  it("hides another member order", () => {
    expect(() => assertActorCanAccessOrder({ id: "member-b", role: "MEMBER" }, order)).toThrow("RESOURCE_NOT_FOUND");
  });

  it("rejects stale versions and transition shortcuts", () => {
    expect(() => assertExpectedVersion(order, 2)).toThrow("VERSION_CONFLICT");
    expect(() => assertTransition("PENDING", "DELIVERED")).toThrow("INVALID_STATE_TRANSITION");
  });
});
