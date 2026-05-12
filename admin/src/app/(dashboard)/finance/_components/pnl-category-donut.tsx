"use client";

/**
 * F-028 Phase 2 — Cost category breakdown donut (LABOR/MATERIAL/VENDOR/OUTSOURCE/OTHER).
 *
 * Reuse F-026 DonutChart (read-only).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DonutChart } from "@/components/charts/DonutChart";
import {
  COST_CATEGORY_LABELS,
  formatVnd,
  type CostCategory,
} from "@/lib/finance-api";

const CATEGORY_COLORS: Record<CostCategory, string> = {
  LABOR: "#3b82f6",
  MATERIAL: "#f59e0b",
  VENDOR: "#8b5cf6",
  OUTSOURCE: "#14b8a6",
  OTHER: "#737373",
};

export function PnLCategoryDonut({
  costByCategory,
  loading,
}: {
  costByCategory: Record<string, number>;
  loading?: boolean;
}) {
  const data = (Object.keys(COST_CATEGORY_LABELS) as CostCategory[])
    .map((k) => ({
      label: COST_CATEGORY_LABELS[k],
      value: costByCategory?.[k] ?? 0,
      color: CATEGORY_COLORS[k],
    }))
    .filter((d) => d.value > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          Phân bổ chi phí theo nhóm
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col items-center gap-3 pt-2">
            <Skeleton className="size-40 rounded-full" />
            <Skeleton className="h-3 w-48" />
          </div>
        ) : data.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Chưa có chi phí trong khoảng thời gian này
          </p>
        ) : (
          <DonutChart
            data={data}
            size={180}
            thickness={36}
            formatValue={formatVnd}
          />
        )}
      </CardContent>
    </Card>
  );
}
