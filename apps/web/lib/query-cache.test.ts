import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  getCachePolicy,
  makeAdminQueryKey,
  invalidateAdminQueries,
  clearAdminCache,
  createAdminQueryClient,
  getSectionEndpoint,
  fetchSectionData,
} from "./query-cache";
import type { Actor } from "./types";

describe("Smart Cache & Data Fetching Architecture", () => {
  let queryClient: ReturnType<typeof createAdminQueryClient>;
  const ownerActor: Actor = { id: "owner-1", role: "OWNER_ADMIN", displayName: "Owner" };
  const memberActor: Actor = { id: "member-1", role: "MEMBER", displayName: "Member" };

  beforeEach(() => {
    queryClient = createAdminQueryClient();
    vi.restoreAllMocks();
  });

  describe("1. Differentiated Business Stale & GC Policies", () => {
    it("assigns fast-changing operational data 30s staleTime", () => {
      expect(getCachePolicy("dashboard").staleTime).toBe(30 * 1000);
      expect(getCachePolicy("orders").staleTime).toBe(30 * 1000);
      expect(getCachePolicy("dashboardOrders").staleTime).toBe(30 * 1000);
    });

    it("assigns inventory 45s staleTime and 15m gcTime", () => {
      const policy = getCachePolicy("inventory");
      expect(policy.staleTime).toBe(45 * 1000);
      expect(policy.gcTime).toBe(15 * 60 * 1000);
    });

    it("assigns stable product catalog 5 minutes staleTime", () => {
      const policy = getCachePolicy("products");
      expect(policy.staleTime).toBe(5 * 60 * 1000);
      expect(policy.gcTime).toBe(30 * 60 * 1000);
    });

    it("provides safe fallback policy for unknown sections", () => {
      const fallback = getCachePolicy("unknown-section");
      expect(fallback.staleTime).toBe(60 * 1000);
      expect(fallback.gcTime).toBe(10 * 60 * 1000);
    });
  });

  describe("2. Security & Role Cache Segmentation", () => {
    it("partitions cache keys strictly by actor id and role", () => {
      const ownerKey = makeAdminQueryKey(ownerActor, "dashboard", { page: 0 });
      const memberKey = makeAdminQueryKey(memberActor, "dashboard", { page: 0 });

      expect(ownerKey).toEqual(["admin", "owner-1", "OWNER_ADMIN", "dashboard", { page: 0 }]);
      expect(memberKey).toEqual(["admin", "member-1", "MEMBER", "dashboard", { page: 0 }]);
      expect(ownerKey).not.toEqual(memberKey);
    });

    it("isolates pagination and filter params in query keys", () => {
      const page0Key = makeAdminQueryKey(ownerActor, "orders", { page: 0 });
      const page1Key = makeAdminQueryKey(ownerActor, "orders", { page: 1 });

      expect(page0Key).not.toEqual(page1Key);
      expect(page0Key).toContainEqual({ page: 0 });
      expect(page1Key).toContainEqual({ page: 1 });
    });

    it("completely clears all cached data on logout or session reset", async () => {
      const key = makeAdminQueryKey(ownerActor, "orders");
      queryClient.setQueryData(key, [{ id: "order-123", totalVnd: 500000 }]);

      expect(queryClient.getQueryData(key)).toBeDefined();

      clearAdminCache(queryClient);

      expect(queryClient.getQueryData(key)).toBeUndefined();
    });
  });

  describe("3. Targeted Cache Invalidation per Business Action", () => {
    it("order_created invalidates orders, dashboard, and inventory but leaves products untouched", async () => {
      const ordersKey = makeAdminQueryKey(ownerActor, "orders");
      const dashKey = makeAdminQueryKey(ownerActor, "dashboard");
      const invKey = makeAdminQueryKey(ownerActor, "inventory");
      const prodKey = makeAdminQueryKey(ownerActor, "products");

      queryClient.setQueryData(ordersKey, [{ id: "order-1" }]);
      queryClient.setQueryData(dashKey, { revenueVnd: 100000 });
      queryClient.setQueryData(invKey, [{ batchCode: "B1" }]);
      queryClient.setQueryData(prodKey, [{ sku: "CBST-300" }]);

      invalidateAdminQueries(queryClient, ownerActor, "order_created");

      // Invalidated queries have stale status
      expect(queryClient.getQueryState(ordersKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(dashKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(invKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(prodKey)?.isInvalidated).toBe(false);
    });

    it("inventory_receipt invalidates inventory and dashboard without touching orders or users", async () => {
      const invKey = makeAdminQueryKey(ownerActor, "inventory");
      const dashKey = makeAdminQueryKey(ownerActor, "dashboard");
      const usersKey = makeAdminQueryKey(ownerActor, "users");

      queryClient.setQueryData(invKey, [{ batchCode: "B1" }]);
      queryClient.setQueryData(dashKey, { totalStock: 100 });
      queryClient.setQueryData(usersKey, [{ id: "user-1" }]);

      invalidateAdminQueries(queryClient, ownerActor, "inventory_receipt");

      expect(queryClient.getQueryState(invKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(dashKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(usersKey)?.isInvalidated).toBe(false);
    });

    it("product_updated invalidates products and dashboard", async () => {
      const prodKey = makeAdminQueryKey(ownerActor, "products");
      const dashKey = makeAdminQueryKey(ownerActor, "dashboard");
      const expKey = makeAdminQueryKey(ownerActor, "expenses");

      queryClient.setQueryData(prodKey, [{ sku: "CBST-300" }]);
      queryClient.setQueryData(dashKey, {});
      queryClient.setQueryData(expKey, []);

      invalidateAdminQueries(queryClient, ownerActor, "product_updated");

      expect(queryClient.getQueryState(prodKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(dashKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(expKey)?.isInvalidated).toBe(false);
    });

    it("promotion_changed invalidates promotions and products for instant pricing update", async () => {
      const promoKey = makeAdminQueryKey(ownerActor, "promotions");
      const prodKey = makeAdminQueryKey(ownerActor, "products");
      const ordersKey = makeAdminQueryKey(ownerActor, "orders");

      queryClient.setQueryData(promoKey, []);
      queryClient.setQueryData(prodKey, []);
      queryClient.setQueryData(ordersKey, []);

      invalidateAdminQueries(queryClient, ownerActor, "promotion_changed");

      expect(queryClient.getQueryState(promoKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(prodKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(ordersKey)?.isInvalidated).toBe(false);
    });
  });

  describe("4. Endpoint Resolution & Fetcher Logic", () => {
    it("routes dashboard correctly between Owner (overview) and Member (members/me)", () => {
      expect(getSectionEndpoint("dashboard", true, 0)).toBe("dashboard/overview");
      expect(getSectionEndpoint("dashboard", false, 0)).toBe("dashboard/members/me");
    });

    it("routes commissions correctly between Owner (all) and Member (me)", () => {
      expect(getSectionEndpoint("commissions", true, 0)).toBe("commissions?page=0&limit=100");
      expect(getSectionEndpoint("commissions", false, 0)).toBe("commissions/me?page=0&limit=100");
    });

    it("applies limit=25 pagination for orders and limit=100 for batches/expenses", () => {
      expect(getSectionEndpoint("orders", true, 2)).toBe("orders?page=2&limit=25");
      expect(getSectionEndpoint("inventory", true, 0)).toBe("inventory/batches?page=0&limit=100");
      expect(getSectionEndpoint("expenses", true, 0)).toBe("expenses?page=0&limit=100");
    });

    it("returns null for non-routable sections like create-order", () => {
      expect(getSectionEndpoint("create-order", true, 0)).toBeNull();
    });
  });

  describe("5. Query Deduplication & Instant Cache Retrieval (0ms tab switch)", () => {
    it("deduplicates simultaneous identical fetches into a single network call", async () => {
      let callCount = 0;
      const mockFetcher = async () => {
        callCount++;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => [{ id: "order-1" }],
        } as unknown as Response;
      };

      const key = makeAdminQueryKey(ownerActor, "orders", { page: 0 });

      // Run 2 queries in parallel with the same key
      const [res1, res2] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: key,
          queryFn: () => fetchSectionData("orders", true, 0, mockFetcher as typeof fetch),
        }),
        queryClient.fetchQuery({
          queryKey: key,
          queryFn: () => fetchSectionData("orders", true, 0, mockFetcher as typeof fetch),
        }),
      ]);

      expect(callCount).toBe(1); // Deduplicated!
      expect(res1).toEqual(res2);
    });

    it("serves cached data instantly without re-fetching within staleTime window", async () => {
      let callCount = 0;
      const mockFetcher = async () => {
        callCount++;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => [{ id: "cached-record" }],
        } as unknown as Response;
      };

      const key = makeAdminQueryKey(ownerActor, "products", { page: 0 });

      // First access -> fetches from API
      const firstFetch = await queryClient.fetchQuery({
        queryKey: key,
        queryFn: () => fetchSectionData("products", true, 0, mockFetcher as typeof fetch),
        staleTime: 5 * 60 * 1000,
      });

      expect(callCount).toBe(1);
      expect(firstFetch).toEqual([{ id: "cached-record" }]);

      // User navigates away and comes back immediately (within staleTime)
      const secondAccess = await queryClient.fetchQuery({
        queryKey: key,
        queryFn: () => fetchSectionData("products", true, 0, mockFetcher as typeof fetch),
        staleTime: 5 * 60 * 1000,
      });

      expect(callCount).toBe(1); // No new network call!
      expect(secondAccess).toEqual(firstFetch);
    });
  });

  describe("6. Resilient Retry Policies", () => {
    it("does not retry 401, 403, or 404 client errors", () => {
      const defaultOptions = queryClient.getDefaultOptions();
      const retryFn = defaultOptions.queries?.retry;

      expect(typeof retryFn).toBe("function");

      if (typeof retryFn === "function") {
        expect(retryFn(0, { status: 401 } as unknown as Error)).toBe(false);
        expect(retryFn(0, { status: 403 } as unknown as Error)).toBe(false);
        expect(retryFn(0, { status: 404 } as unknown as Error)).toBe(false);
        expect(retryFn(0, { status: 500 } as unknown as Error)).toBe(true);
        expect(retryFn(2, { status: 500 } as unknown as Error)).toBe(false); // Max 2 retries
      }
    });
  });
});
