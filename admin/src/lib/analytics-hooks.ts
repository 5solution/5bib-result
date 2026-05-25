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
 * Resolve PeriodKind ('7d' | '30d' | 'quarter' | 'year' | 'rolling12m' | 'custom')
 * → { from, to } YYYY-MM-DD theo timezone local (UTC+7 cho VN).
 *
 * BUG-002 fix: `?period=30d` không tự convert thành from/to. Now resolved
 * client-side trước khi pass vào backend Wave 2 endpoints (which accept from/to only).
 */
function ymdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function resolvePeriodToRange(
  period: string,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string } | null {
  const today = new Date();
  const to = ymdLocal(today);

  switch (period) {
    case "7d": {
      const from = new Date(today);
      from.setDate(from.getDate() - 6); // inclusive 7 days
      return { from: ymdLocal(from), to };
    }
    case "30d": {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from: ymdLocal(from), to };
    }
    case "quarter": {
      // Current quarter (Q1 = Jan-Mar, Q2 = Apr-Jun, etc.)
      const q = Math.floor(today.getMonth() / 3);
      const qStart = new Date(today.getFullYear(), q * 3, 1);
      return { from: ymdLocal(qStart), to };
    }
    case "year": {
      const yStart = new Date(today.getFullYear(), 0, 1);
      return { from: ymdLocal(yStart), to };
    }
    case "rolling12m": {
      const from = new Date(today);
      from.setFullYear(from.getFullYear() - 1);
      from.setDate(from.getDate() + 1);
      return { from: ymdLocal(from), to };
    }
    case "custom": {
      if (customFrom && customTo) return { from: customFrom, to: customTo };
      return null;
    }
    default:
      return null;
  }
}

/**
 * Helper: convert URL searchParams → BaseQuery shape.
 * BUG-002 fix 2026-05-25: resolve `?period=X` to from/to range client-side
 * (backend Wave 2 endpoints only accept from/to/month/tenantId).
 * BUG-003 fix: default period = "30d" (KHÔNG fall through to backend
 * default 12 tháng — quá rộng, include race from last year).
 */
export function searchParamsToQuery(sp: URLSearchParams): BaseQuery {
  const query: BaseQuery = {};
  // Default '30d' khi URL chưa có period (matches FilterBar default UI state)
  const period = sp.get("period") ?? "30d";
  const customFrom = sp.get("from") ?? undefined;
  const customTo = sp.get("to") ?? undefined;
  const month = sp.get("month");
  const tenantId = sp.get("tenantId");

  const range = resolvePeriodToRange(period, customFrom, customTo);
  if (range) {
    query.from = range.from;
    query.to = range.to;
  } else {
    // Period = custom but no from/to OR unknown period → leave query empty
    if (customFrom) query.from = customFrom;
    if (customTo) query.to = customTo;
  }
  if (month) query.month = month;
  if (tenantId) query.tenantId = Number(tenantId);
  return query;
}
