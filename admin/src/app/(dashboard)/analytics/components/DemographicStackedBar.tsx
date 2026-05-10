"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { GeoDemoData } from "./GeographicDonut";

interface Props {
  data: GeoDemoData | null;
  loading: boolean;
}

const AGE_BUCKETS = ["<25", "25-34", "35-44", "45-54", "55+", "UNKNOWN"];
const GENDER_COLORS: Record<string, string> = {
  MALE: "#1D49FF",
  FEMALE: "#FF0E65",
  OTHER: "#5B21B6",
  UNKNOWN: "#A8A29E",
};

export function DemographicStackedBar({ data, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Demographic Split</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Group counts by age bucket then gender
  const byBucket = new Map<string, Map<string, number>>();
  for (const b of AGE_BUCKETS) byBucket.set(b, new Map());
  if (data) {
    for (const e of data.demographic.genderAge) {
      const map = byBucket.get(e.ageGroup) ?? byBucket.get("UNKNOWN")!;
      map.set(e.gender, (map.get(e.gender) ?? 0) + e.count);
    }
  }

  const bucketTotals = AGE_BUCKETS.map((b) => {
    const m = byBucket.get(b)!;
    let t = 0;
    for (const v of m.values()) t += v;
    return t;
  });
  const maxTotal = Math.max(1, ...bucketTotals);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Demographic Split</CardTitle>
        <p className="text-xs text-muted-foreground">
          Coverage DOB: {data?.demographic.dobCoverage.toFixed(1) ?? "—"}%
        </p>
      </CardHeader>
      <CardContent>
        {!data || data.totalAthletes === 0 ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Chưa có dữ liệu</p>
        ) : (
          <div className="flex flex-col gap-2">
            {AGE_BUCKETS.map((bucket, i) => {
              const m = byBucket.get(bucket)!;
              const total = bucketTotals[i];
              const widthPct = (total / maxTotal) * 100;
              const segments = Array.from(m.entries()).filter(([, c]) => c > 0);
              return (
                <div key={bucket} className="flex items-center gap-2">
                  <span className="w-12 text-xs text-muted-foreground tabular-nums">
                    {bucket}
                  </span>
                  <div className="relative h-5 flex-1 rounded bg-stone-100 overflow-hidden">
                    <div
                      className="flex h-full"
                      style={{ width: `${widthPct}%` }}
                    >
                      {segments.map(([gender, count]) => (
                        <div
                          key={gender}
                          style={{
                            width: `${(count / Math.max(1, total)) * 100}%`,
                            backgroundColor: GENDER_COLORS[gender] ?? "#A8A29E",
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                    {total}
                  </span>
                </div>
              );
            })}
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {Object.entries(GENDER_COLORS).map(([g, c]) => (
                <span key={g} className="flex items-center gap-1">
                  <span
                    className="size-2.5 rounded-sm"
                    style={{ backgroundColor: c }}
                  />
                  {g}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
