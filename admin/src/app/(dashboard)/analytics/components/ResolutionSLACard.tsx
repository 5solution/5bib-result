"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart } from "@/components/charts/AreaChart";
import type { ClaimRateData } from "./ClaimRateTable";

interface Props {
  data: ClaimRateData | null;
  loading: boolean;
}

export function ResolutionSLACard({ data, loading }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Resolution SLA 24h</CardTitle>
        <p className="text-xs text-muted-foreground">Mục tiêu ≥80%</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !data ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Chưa có dữ liệu</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold tabular-nums ${
                  data.slaPercentage >= 80 ? "text-green-700" : "text-amber-700"
                }`}
              >
                {data.slaPercentage.toFixed(1)}%
              </span>
              <span className="text-xs text-muted-foreground">
                {data.resolvedWithinSla}/{data.totalResolved} resolved
              </span>
            </div>
            <AreaChart
              data={data.slaTrend.map((t) => ({ date: t.bucket, value: t.slaPercentage }))}
              height={100}
              color="#15803D"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
