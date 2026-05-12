"use client";

/**
 * F-028 Phase 2 — Trend chart theo tháng. Reuse F-026 AreaChart (read-only).
 *
 * Map `byMonth` buckets → data points `{ date: YYYY-MM, value: totalProfit }`.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart } from "@/components/charts/AreaChart";
import type { DashboardGroupBucket } from "@/lib/finance-api";

export function PnLTrendChart({
  byMonth,
  loading,
}: {
  byMonth: DashboardGroupBucket[];
  loading?: boolean;
}) {
  const data = byMonth.map((b) => ({
    date: b.key.slice(5), // MM only (Y omit for compactness)
    value: b.totalProfit,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          Lãi/Lỗ theo tháng (anchor signDate fallback createdAt)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Chưa có dữ liệu để vẽ trend
          </p>
        ) : (
          <AreaChart data={data} height={220} color="#1d4ed8" />
        )}
      </CardContent>
    </Card>
  );
}
