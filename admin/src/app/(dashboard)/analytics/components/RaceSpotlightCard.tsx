"use client";

/**
 * F-062 Wave 3-2 NEW — Race Spotlight Card (BR-SA-21b v3).
 *
 * Top GMV race với auto-generated VN insight text from backend.
 * Returns null gracefully nếu period không có race nào.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import Link from "next/link";
import { useRaceSpotlight } from "@/lib/analytics-hooks";

interface Props {
  from?: string;
  to?: string;
  month?: string;
  tenantId?: number;
}

function fmtVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " ₫";
}

const RACE_TYPE_LABEL: Record<string, string> = {
  ROAD_MARATHON: "Road Marathon",
  ROAD_HALF_MARATHON: "Road HM",
  ULTRA_TRAIL_RACE: "Ultra Trail",
  TRAIL_RACE: "Trail",
  OTHER: "Khác",
};

export function RaceSpotlightCard(props: Props) {
  const { data, isLoading, error } = useRaceSpotlight(props);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="h-32 animate-pulse bg-stone-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-sm text-red-700">
            Không tải được spotlight: {(error as Error)?.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-stone-500">
          <Trophy className="h-8 w-8 mx-auto mb-2 text-stone-300" />
          <p className="text-sm">Chưa có race nào có doanh thu trong kỳ này.</p>
        </CardContent>
      </Card>
    );
  }

  const r = data as {
    raceId: number;
    raceName: string;
    merchant: string;
    type: string;
    date: string | null;
    gmv: number;
    orders: number;
    avgPerOrder: number;
    platformFee: number;
    insight: string;
  };

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-600" />
          <CardTitle className="text-base">Race Spotlight</CardTitle>
          <span className="text-xs text-stone-500 ml-auto">
            BR-SA-21b — Top GMV
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Link
            href={`/analytics/races/${r.raceId}`}
            className="text-lg font-bold text-stone-900 hover:text-blue-700 transition-colors block"
          >
            {r.raceName}
          </Link>
          <div className="text-xs text-stone-500 flex flex-wrap gap-2 mt-1">
            <span>{r.merchant}</span>
            <span>·</span>
            <span>{RACE_TYPE_LABEL[r.type] ?? r.type}</span>
            {r.date && (
              <>
                <span>·</span>
                <span>{r.date}</span>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-stone-50 rounded p-2">
            <div className="text-xs text-stone-500">GMV</div>
            <div className="font-bold text-stone-900 text-sm tabular-nums">
              {fmtVnd(r.gmv)}
            </div>
          </div>
          <div className="bg-stone-50 rounded p-2">
            <div className="text-xs text-stone-500">Đơn</div>
            <div className="font-bold text-stone-900 text-sm tabular-nums">
              {new Intl.NumberFormat("vi-VN").format(r.orders)}
            </div>
          </div>
          <div className="bg-stone-50 rounded p-2">
            <div className="text-xs text-stone-500">TB/đơn</div>
            <div className="font-bold text-stone-900 text-sm tabular-nums">
              {fmtVnd(r.avgPerOrder)}
            </div>
          </div>
          <div className="bg-stone-50 rounded p-2">
            <div className="text-xs text-stone-500">Phí 5BIB</div>
            <div className="font-bold text-stone-900 text-sm tabular-nums">
              {fmtVnd(r.platformFee)}
            </div>
          </div>
        </div>

        <div className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 italic">
          {r.insight}
        </div>
      </CardContent>
    </Card>
  );
}
