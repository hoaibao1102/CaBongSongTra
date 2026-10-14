"use client";

import {
  QueryClient,
  type DefaultOptions,
} from "@tanstack/react-query";
import type { Actor, MemberUser, RecordRow } from "./types";
import { apiRequest } from "./commerce";

export type CacheSection =
  | "dashboard"
  | "orders"
  | "dashboardOrders"
  | "inventory"
  | "users"
  | "products"
  | "promotions"
  | "vouchers"
  | "media"
  | "expenses"
  | "commissions"
  | "audit";

export type MutationAction =
  | "order_created"
  | "order_updated"
  | "order_transition"
  | "inventory_receipt"
  | "inventory_adjustment"
  | "product_created"
  | "product_updated"
  | "promotion_changed"
  | "voucher_changed"
  | "expense_created"
  | "commission_payout"
  | "commission_rate_updated"
  | "user_changed"
  | "media_changed";

/**
 * Smart Cache Policies per Business Module
 * - Fast-changing operational data (orders, dashboard): 30s staleTime
 * - Moderate data (inventory, expenses, commissions): 45s-60s staleTime
 * - Stable reference data (products, users, media): 2-5m staleTime
 */
export const CACHE_POLICIES: Record<
  string,
  { staleTime: number; gcTime: number }
> = {
  dashboard: { staleTime: 30 * 1000, gcTime: 10 * 60 * 1000 },
  orders: { staleTime: 30 * 1000, gcTime: 10 * 60 * 1000 },
  dashboardOrders: { staleTime: 30 * 1000, gcTime: 10 * 60 * 1000 },
  inventory: { staleTime: 45 * 1000, gcTime: 15 * 60 * 1000 },
  products: { staleTime: 5 * 60 * 1000, gcTime: 30 * 60 * 1000 },
  users: { staleTime: 3 * 60 * 1000, gcTime: 20 * 60 * 1000 },
  promotions: { staleTime: 2 * 60 * 1000, gcTime: 15 * 60 * 1000 },
  vouchers: { staleTime: 2 * 60 * 1000, gcTime: 15 * 60 * 1000 },
  media: { staleTime: 3 * 60 * 1000, gcTime: 15 * 60 * 1000 },
  expenses: { staleTime: 2 * 60 * 1000, gcTime: 15 * 60 * 1000 },
  commissions: { staleTime: 60 * 1000, gcTime: 15 * 60 * 1000 },
  audit: { staleTime: 60 * 1000, gcTime: 10 * 60 * 1000 },
};

export function getCachePolicy(section: string) {
  return CACHE_POLICIES[section] ?? { staleTime: 60 * 1000, gcTime: 10 * 60 * 1000 };
}

/**
 * Builds isolated query keys segmented by actor identity & role.
 * Guarantees zero data leakage between Members and Owners.
 */
export function makeAdminQueryKey(
  actor: { id: string; role: string },
  section: string,
  params?: Record<string, unknown>,
) {
  return ["admin", actor.id, actor.role, section, ...(params ? [params] : [])];
}

/**
 * Targeted Cache Invalidation
 * Only invalidates queries genuinely impacted by the specific mutation.
 */
export function invalidateAdminQueries(
  queryClient: QueryClient,
  actor: Actor,
  action: MutationAction,
) {
  const prefix = ["admin", actor.id, actor.role];

  switch (action) {
    case "order_created":
    case "order_updated":
    case "order_transition":
      void queryClient.invalidateQueries({ queryKey: [...prefix, "commissions"] });
      void queryClient.invalidateQueries({ queryKey: [...prefix, "orders"] });
      void queryClient.invalidateQueries({ queryKey: [...prefix, "dashboardOrders"] });
      void queryClient.invalidateQueries({ queryKey: [...prefix, "dashboard"] });
      void queryClient.invalidateQueries({ queryKey: [...prefix, "inventory"] });
      break;

    case "inventory_receipt":
    case "inventory_adjustment":
      void queryClient.invalidateQueries({ queryKey: [...prefix, "inventory"] });
      void queryClient.invalidateQueries({ queryKey: [...prefix, "dashboard"] });
      break;

    case "product_created":
    case "product_updated":
      void queryClient.invalidateQueries({ queryKey: [...prefix, "products"] });
      void queryClient.invalidateQueries({ queryKey: [...prefix, "dashboard"] });
      break;

    case "promotion_changed":
      void queryClient.invalidateQueries({ queryKey: [...prefix, "promotions"] });
      void queryClient.invalidateQueries({ queryKey: [...prefix, "products"] });
      break;

    case "voucher_changed":
      void queryClient.invalidateQueries({ queryKey: [...prefix, "vouchers"] });
      break;

    case "expense_created":
      void queryClient.invalidateQueries({ queryKey: [...prefix, "expenses"] });
      void queryClient.invalidateQueries({ queryKey: [...prefix, "dashboard"] });
      break;

    case "commission_payout":
    case "commission_rate_updated":
      void queryClient.invalidateQueries({ queryKey: [...prefix, "commissions"] });
      void queryClient.invalidateQueries({ queryKey: [...prefix, "dashboard"] });
      void queryClient.invalidateQueries({ queryKey: [...prefix, "users"] });
      break;

    case "user_changed":
      void queryClient.invalidateQueries({ queryKey: [...prefix, "users"] });
      break;

    case "media_changed":
      void queryClient.invalidateQueries({ queryKey: [...prefix, "media"] });
      break;
  }
}

/**
 * Security: Purges all cached in-memory data on logout or auth failure.
 */
export function clearAdminCache(queryClient: QueryClient) {
  queryClient.clear();
}

/**
 * Creates a configured QueryClient with resilient retry & deduplication options.
 */
export function createAdminQueryClient(): QueryClient {
  const defaultOptions: DefaultOptions = {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        if (error && typeof error === "object" && "status" in error) {
          const status = (error as { status: number }).status;
          if (status === 401 || status === 403 || status === 404) return false;
        }
        return failureCount < 2;
      },
    },
  };

  return new QueryClient({ defaultOptions });
}

let sharedQueryClient: QueryClient | null = null;

export function getSharedQueryClient(): QueryClient {
  if (!sharedQueryClient) {
    sharedQueryClient = createAdminQueryClient();
  }
  return sharedQueryClient;
}

/**
 * Builds the API endpoint URL for an admin section & query parameters.
 */
export function getSectionEndpoint(
  section: string,
  owner: boolean,
  page: number,
): string | null {
  const endpoints: Record<string, string> = {
    dashboard: owner ? "dashboard/overview" : "dashboard/members/me",
    "create-order": "",
    orders: "orders",
    inventory: "inventory/batches",
    users: "users",
    products: "owner/products",
    expenses: "expenses",
    commissions: owner ? "commissions" : "commissions/me",
    audit: "audit-logs",
  };

  const base = endpoints[section];
  if (!base) return null;

  const querySuffix =
    section === "dashboard" || section === "products"
      ? ""
      : ["inventory", "expenses", "commissions", "users"].includes(section)
        ? "?page=0&limit=100"
        : `?page=${page}&limit=25`;

  return `${base}${querySuffix}`;
}

/**
 * Standard fetcher for an admin section.
 */
export async function fetchSectionData(
  section: string,
  owner: boolean,
  page: number,
  fetcher: typeof fetch = fetch,
): Promise<RecordRow[] | RecordRow | null> {
  const path = getSectionEndpoint(section, owner, page);
  if (!path) return null;
  if (section === "commissions") {
    const entries: RecordRow[] = [];
    const endpoint = owner ? "commissions" : "commissions/me";
    for (let ledgerPage = 0; ; ledgerPage++) {
      const batch = await apiRequest<RecordRow[]>(`${endpoint}?page=${ledgerPage}&limit=100`, undefined, fetcher);
      entries.push(...batch);
      if (batch.length < 100) return entries;
    }
  }
  const data = await apiRequest<RecordRow[] | RecordRow>(path, undefined, fetcher);
  return section === "orders" && !owner && Array.isArray(data)
    ? fillMemberOrderCommissions(data, fetcher)
    : data;
}

/** Older API deployments omit commissionVnd in member order projections. */
export async function fillMemberOrderCommissions(orders: RecordRow[], fetcher: typeof fetch = fetch): Promise<RecordRow[]> {
  if (!orders.some((order) => order.commissionVnd == null)) return orders;
  const ledger = await fetchSectionData("commissions", false, 0, fetcher) as RecordRow[];
  const totals = new Map<string, number>();
  for (const entry of ledger) {
    if (entry.kind !== "COMMISSION" || !entry.orderId) continue;
    const id = String(entry.orderId);
    totals.set(id, (totals.get(id) ?? 0) + Number(entry.amountVnd));
  }
  return orders.map((order) => ({ ...order, commissionVnd: order.commissionVnd ?? totals.get(String(order.id)) ?? 0 }));
}

/**
 * Fetcher for 100 recent orders used in dashboard charts & metric widgets.
 */
export async function fetchDashboardOrders(
  fetcher: typeof fetch = fetch,
): Promise<RecordRow[]> {
  const data = await apiRequest<RecordRow[]>("orders?page=0&limit=100", undefined, fetcher);
  return Array.isArray(data) ? fillMemberOrderCommissions(data, fetcher) : [];
}

/**
 * Fetcher for users list used in commission management and order responsible mapping.
 */
export async function fetchUsersList(
  fetcher: typeof fetch = fetch,
): Promise<MemberUser[]> {
  const data = await apiRequest<MemberUser[]>("users?page=0&limit=100", undefined, fetcher);
  return Array.isArray(data) ? data : [];
}
