"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface MerchantStatusEntry {
  tenantId: number;
  merchantName: string;
  monthsSinceLastRace: number;
  lastRaceDate: string | null;
  totalRaces: number;
}

export interface MerchantChurnData {
  churnRate: number;
  totalMerchants: number;
  churnedCount: number;
  atRiskCount: number;
  atRiskList: MerchantStatusEntry[];
  churnedList: MerchantStatusEntry[];
}

interface Props {
  data: MerchantChurnData | null;
  loading: boolean;
}

function fmtMonths(n: number) {
  return `${n.toFixed(1)}m`;
}

export function MerchantChurnTable({ data, loading }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Merchant Churn</CardTitle>
        <p className="text-xs text-muted-foreground">≥6 tháng = churn · 4–6 tháng = nguy cơ</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-24" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : !data ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Chưa có dữ liệu</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold tabular-nums">{data.churnRate.toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground">
                {data.churnedCount} đã churn / {data.totalMerchants} merchant
              </span>
            </div>

            {data.atRiskList.length > 0 && (
              <section>
                <h4 className="mb-1 text-xs font-semibold text-amber-700">
                  Nguy cơ ({data.atRiskCount})
                </h4>
                <ul className="flex flex-col gap-1 text-xs">
                  {data.atRiskList.slice(0, 5).map((m) => (
                    <li key={m.tenantId} className="flex justify-between">
                      <span className="truncate">{m.merchantName}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {fmtMonths(m.monthsSinceLastRace)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.churnedList.length > 0 && (
              <section>
                <h4 className="mb-1 text-xs font-semibold text-red-700">
                  Đã churn ({data.churnedCount})
                </h4>
                <ul className="flex flex-col gap-1 text-xs">
                  {data.churnedList.slice(0, 5).map((m) => (
                    <li key={m.tenantId} className="flex justify-between">
                      <span className="truncate">{m.merchantName}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {fmtMonths(m.monthsSinceLastRace)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
