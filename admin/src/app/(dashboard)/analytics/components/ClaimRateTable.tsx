"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface ClaimRatePerRace {
  raceId: string;
  raceName: string;
  finishers: number;
  claims: number;
  claimRate: number;
  isOverThreshold: boolean;
}

export interface ClaimRateData {
  perRace: ClaimRatePerRace[];
  slaPercentage: number;
  totalClaims: number;
  totalResolved: number;
  resolvedWithinSla: number;
  slaTrend: { bucket: string; slaPercentage: number }[];
}

interface Props {
  data: ClaimRateData | null;
  loading: boolean;
}

export function ClaimRateTable({ data, loading }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Claim Rate per Race</CardTitle>
        <p className="text-xs text-muted-foreground">Đỏ = vượt 5%</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : !data || data.perRace.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Chưa có claim</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 font-medium">Race</th>
                <th className="py-1 text-right font-medium">Claim/Finishers</th>
                <th className="py-1 text-right font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.perRace.slice(0, 8).map((r) => (
                <tr key={r.raceId} className="border-t border-stone-200">
                  <td className="py-1.5 truncate">{r.raceName}</td>
                  <td className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {r.claims}/{r.finishers}
                  </td>
                  <td
                    className={`py-1.5 text-right font-semibold tabular-nums ${
                      r.isOverThreshold ? "text-red-600" : "text-stone-900"
                    }`}
                  >
                    {r.claimRate.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
