"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAgEligibility,
  type AGEligibilityReport,
} from "../../awards/awards-api";

/**
 * F-019 v2 — TanStack Query hook for AG Eligibility Report.
 *
 * Cache TTL Redis 60s + client `staleTime: 30_000` cho avoid refetch spam.
 * Refetch on window focus disabled — pre-race data không thay đổi nhanh.
 */
export function useAgEligibility(raceId: string) {
  return useQuery<AGEligibilityReport>({
    queryKey: ["awards", "ag-eligibility", raceId],
    queryFn: () => getAgEligibility(raceId),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    enabled: !!raceId,
  });
}
