/**
 * F-062 Wave 3-2 NEW — TanStack Query hooks wrapping 17 NEW Wave 2 SDK functions.
 *
 * Centralized hooks for analytics dashboard pages. Reads filter context from URL
 * via `useSearchParams()` upstream — pages pass relevant fields to each hook.
 *
 * Convention: each hook = 1 NEW Wave 2 endpoint. Stale 60s default (analytics
 * data refreshes <= 15min server-side via cachedQuery TTL).
 */

"use client";

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import {
  analyticsControllerGetWeeklyRevenue,
  analyticsControllerGetMonthlyRevenue,
  analyticsControllerGetRevenueComparison,
  analyticsControllerGetMerchantScatter,
  analyticsControllerGetMerchantHealthDistribution,
  analyticsControllerGetMerchantComparisonTable,
  analyticsControllerGetRaceTypeDistribution,
  analyticsControllerGetRaceSpotlight,
  analyticsControllerGetRacePerformanceList,
  analyticsControllerGetRunnerBookingHeatmap,
  analyticsControllerGetRunnerLeadTime,
  analyticsControllerGetRunnerRepeatCohort,
  analyticsControllerGetRunnerDemographics,
  analyticsControllerGetRunnerGeographic,
  analyticsControllerGetRunnerSummaryKpi,
  analyticsControllerGetGa4Overview,
} from "@/lib/api-generated";

const DEFAULT_STALE = 60_000;

interface BaseQuery {
  from?: string;
  to?: string;
  month?: string;
  tenantId?: number;
}

const buildKey = (metric: string, q: BaseQuery & Record<string, unknown>) => [
  "analytics",
  metric,
  q.from ?? "",
  q.to ?? "",
  q.month ?? "",
  q.tenantId ?? "",
  ...Object.entries(q)
    .filter(([k]) => !["from", "to", "month", "tenantId"].includes(k))
    .flat()
    .map((v) => String(v ?? "")),
];

// ─── Revenue (BR-SA-02/03/04) ────────────────────────────────────────────────

export function useWeeklyRevenue(query: BaseQuery, opts?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: buildKey("weekly-revenue", query),
    queryFn: async () => {
      const res = await analyticsControllerGetWeeklyRevenue({
        query: query as never,
      });
      return res.data;
    },
    staleTime: DEFAULT_STALE,
    ...(opts as object),
  });
}

export function useMonthlyRevenue(query: BaseQuery, opts?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: buildKey("monthly-revenue", query),
    queryFn: async () => {
      const res = await analyticsControllerGetMonthlyRevenue({
        query: query as never,
      });
      return res.data;
    },
    staleTime: DEFAULT_STALE,
    ...(opts as object),
  });
}

export function useRevenueComparison(
  query: BaseQuery & { compareWith?: "wow" | "mom" | "yoy" },
  opts?: Partial<UseQueryOptions>,
) {
  return useQuery({
    queryKey: buildKey("comparison", query),
    queryFn: async () => {
      const res = await analyticsControllerGetRevenueComparison({
        query: query as never,
      });
      return res.data;
    },
    staleTime: DEFAULT_STALE,
    ...(opts as object),
  });
}

// ─── Merchant (BR-SA-22) ─────────────────────────────────────────────────────

export function useMerchantScatter(query: BaseQuery, opts?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: buildKey("merchant-scatter", query),
    queryFn: async () => {
      const res = await analyticsControllerGetMerchantScatter({
        query: query as never,
      });
      return res.data;
    },
    staleTime: DEFAULT_STALE,
    ...(opts as object),
  });
}

export function useMerchantHealthDistribution(query: BaseQuery, opts?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: buildKey("merchant-health-dist", query),
    queryFn: async () => {
      const res = await analyticsControllerGetMerchantHealthDistribution({
        query: query as never,
      });
      return res.data;
    },
    staleTime: DEFAULT_STALE,
    ...(opts as object),
  });
}

export function useMerchantComparisonTable(query: BaseQuery, opts?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: buildKey("merchant-comp-table", query),
    queryFn: async () => {
      const res = await analyticsControllerGetMerchantComparisonTable({
        query: query as never,
      });
      return res.data;
    },
    staleTime: DEFAULT_STALE,
    ...(opts as object),
  });
}

// ─── Race Performance (BR-SA-21) ─────────────────────────────────────────────

export function useRaceTypeDistribution(query: BaseQuery, opts?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: buildKey("race-type-dist", query),
    queryFn: async () => {
      const res = await analyticsControllerGetRaceTypeDistribution({
        query: query as never,
      });
      return res.data;
    },
    staleTime: DEFAULT_STALE,
    ...(opts as object),
  });
}

export function useRaceSpotlight(query: BaseQuery, opts?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: buildKey("race-spotlight", query),
    queryFn: async () => {
      const res = await analyticsControllerGetRaceSpotlight({
        query: query as never,
      });
      return res.data;
    },
    staleTime: DEFAULT_STALE,
    ...(opts as object),
  });
}

export function useRacePerformanceList(
  query: BaseQuery & {
    raceType?: "ROAD_MARATHON" | "ROAD_HALF_MARATHON" | "ULTRA_TRAIL_RACE" | "TRAIL_RACE";
    sortBy?: "gmv" | "orders" | "fee" | "avgPerOrder" | "voidedPct";
    sortOrder?: "asc" | "desc";
    page?: number;
    limit?: number;
  },
  opts?: Partial<UseQueryOptions>,
) {
  return useQuery({
    queryKey: buildKey("race-perf-list", query),
    queryFn: async () => {
      const res = await analyticsControllerGetRacePerformanceList({
        query: query as never,
      });
      return res.data;
    },
    staleTime: DEFAULT_STALE,
    ...(opts as object),
  });
}

// ─── Runner Analytics (BR-SA-20 a-f) ─────────────────────────────────────────

export function useRunnerBookingHeatmap(query: BaseQuery, opts?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: buildKey("runner-heatmap", query),
    queryFn: async () => {
      const res = await analyticsControllerGetRunnerBookingHeatmap({
        query: query as never,
      });
      return res.data;
    },
    staleTime: DEFAULT_STALE,
    ...(opts as object),
  });
}

export function useRunnerLeadTime(query: BaseQuery, opts?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: buildKey("runner-leadtime", query),
    queryFn: async () => {
      const res = await analyticsControllerGetRunnerLeadTime({
        query: query as never,
      });
      return res.data;
    },
    staleTime: DEFAULT_STALE,
    ...(opts as object),
  });
}

export function useRunnerRepeatCohort(query: BaseQuery, opts?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: buildKey("runner-repeat", query),
    queryFn: async () => {
      const res = await analyticsControllerGetRunnerRepeatCohort({
        query: query as never,
      });
      return res.data;
    },
    staleTime: DEFAULT_STALE,
    ...(opts as object),
  });
}

export function useRunnerDemographics(query: BaseQuery, opts?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: buildKey("runner-demo", query),
    queryFn: async () => {
      const res = await analyticsControllerGetRunnerDemographics({
        query: query as never,
      });
      return res.data;
    },
    staleTime: DEFAULT_STALE,
    ...(opts as object),
  });
}

export function useRunnerGeographic(query: BaseQuery, opts?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: buildKey("runner-geo", query),
    queryFn: async () => {
      const res = await analyticsControllerGetRunnerGeographic({
        query: query as never,
      });
      return res.data;
    },
    staleTime: DEFAULT_STALE,
    ...(opts as object),
  });
}

export function useRunnerSummaryKpi(query: BaseQuery, opts?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: buildKey("runner-summary", query),
    queryFn: async () => {
      const res = await analyticsControllerGetRunnerSummaryKpi({
        query: query as never,
      });
      return res.data;
    },
    staleTime: DEFAULT_STALE,
    ...(opts as object),
  });
}

// ─── GA4 Integration (BR-SA-11) ──────────────────────────────────────────────

export function useGa4Overview(query: BaseQuery, opts?: Partial<UseQueryOptions>) {
  return useQuery({
    queryKey: buildKey("ga4-overview", query),
    queryFn: async () => {
      const res = await analyticsControllerGetGa4Overview({
        query: query as never,
      });
      return res.data;
    },
    staleTime: 5 * 60_000, // GA4 lower refresh — backend TTL 600s
    ...(opts as object),
  });
}

/**
 * Helper: convert URL searchParams → BaseQuery shape.
 * Pages call `useSearchParams()` then pass through `searchParamsToQuery(sp)`.
 */
export function searchParamsToQuery(sp: URLSearchParams): BaseQuery {
  const query: BaseQuery = {};
  const from = sp.get("from");
  const to = sp.get("to");
  const month = sp.get("month");
  const tenantId = sp.get("tenantId");
  if (from) query.from = from;
  if (to) query.to = to;
  if (month) query.month = month;
  if (tenantId) query.tenantId = Number(tenantId);
  return query;
}
