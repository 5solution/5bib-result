"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart } from "@/components/charts/AreaChart";
import { TrendingUp, TrendingDown } from "lucide-react";

export interface RepeatAthleteData {
  rate: number;
  totalAthletes: number;
  repeatAthletes: number;
  trend: { bucket: string; rate: number }[];
  compare: { rate: number; deltaPercent: number | null } | null;
}

interface Props {
  data: RepeatAthleteData | null;
  loading: boolean;
}

export function RepeatAthleteRateCard({ data, loading }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">VĐV trung thành (Repeat)</CardTitle>
        <p className="text-xs text-muted-foreground">12 tháng rolling — VĐV ≥2 race</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !data ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Chưa có dữ liệu</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">
                {data.rate.toFixed(1)}%
              </span>
              {data.compare?.deltaPercent != null && (
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium ${
                    data.compare.deltaPercent >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {data.compare.deltaPercent >= 0 ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  {data.compare.deltaPercent.toFixed(1)}%
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.repeatAthletes.toLocaleString("vi-VN")} / {data.totalAthletes.toLocaleString("vi-VN")} VĐV
            </p>
            <AreaChart
              data={data.trend.map((t) => ({ date: t.bucket, value: t.rate }))}
              height={120}
              color="#1D49FF"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
