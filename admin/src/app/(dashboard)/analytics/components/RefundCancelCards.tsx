"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart } from "@/components/charts/AreaChart";

export interface RefundCancelData {
  totalOrders: number;
  refundedOrders: number;
  cancelledOrders: number;
  refundRate: number;
  cancelRate: number;
  refundOverThreshold: boolean;
  refundTrend: { bucket: string; rate: number }[];
  cancelTrend: { bucket: string; rate: number }[];
}

interface Props {
  data: RefundCancelData | null;
  loading: boolean;
}

export function RefundCancelCards({ data, loading }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Refund + Cancel Rate</CardTitle>
        <p className="text-xs text-muted-foreground">Đỏ = refund &gt; 3%</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !data ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Chưa có dữ liệu</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p
                className={`text-xl font-bold tabular-nums ${
                  data.refundOverThreshold ? "text-red-600" : "text-stone-900"
                }`}
              >
                {data.refundRate.toFixed(2)}%
              </p>
              <p className="text-xs text-muted-foreground">
                Refund — {data.refundedOrders}/{data.totalOrders}
              </p>
              <AreaChart
                data={data.refundTrend.map((t) => ({ date: t.bucket, value: t.rate }))}
                height={70}
                color="#B91C1C"
              />
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">
                {data.cancelRate.toFixed(2)}%
              </p>
              <p className="text-xs text-muted-foreground">
                Cancel — {data.cancelledOrders}/{data.totalOrders}
              </p>
              <AreaChart
                data={data.cancelTrend.map((t) => ({ date: t.bucket, value: t.rate }))}
                height={70}
                color="#B45309"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
