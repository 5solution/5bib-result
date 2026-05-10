"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DonutChart } from "@/components/charts/DonutChart";

export interface GeoDemoData {
  totalAthletes: number;
  geographic: {
    regions: { region: string; count: number; percent: number }[];
    coverage: number;
  };
  demographic: {
    genderAge: { gender: string; ageGroup: string; count: number }[];
    dobCoverage: number;
  };
}

interface Props {
  data: GeoDemoData | null;
  loading: boolean;
}

const REGION_COLORS: Record<string, string> = {
  HCM: "#1D49FF",
  HN: "#FF0E65",
  DN: "#15803D",
  KHAC: "#A8A29E",
};

export function GeographicDonut({ data, loading }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Geographic Split</CardTitle>
        <p className="text-xs text-muted-foreground">
          Coverage province: {data?.geographic.coverage.toFixed(1) ?? "—"}%
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-2">
            <Skeleton className="size-40 rounded-full" />
          </div>
        ) : !data ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Chưa có dữ liệu</p>
        ) : (
          <DonutChart
            size={160}
            thickness={28}
            data={data.geographic.regions
              .filter((r) => r.count > 0)
              .map((r) => ({
                label: r.region,
                value: r.count,
                color: REGION_COLORS[r.region] ?? "#A8A29E",
              }))}
          />
        )}
      </CardContent>
    </Card>
  );
}
