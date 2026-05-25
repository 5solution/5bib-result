"use client";

/**
 * F-062 Wave 3-2 NEW — Merchant Health Distribution horizontal bars (BR-SA-22b).
 *
 * 5 tiers (EXCELLENT/GOOD/AVERAGE/WEAK/AT_RISK_SCORE) — bar width proportional
 * to count, count badge bên phải. Tailwind color theo `tier.color` from backend.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMerchantHealthDistribution } from "@/lib/analytics-hooks";

interface Props {
  from?: string;
  to?: string;
  month?: string;
  tenantId?: number;
}

// Map backend color (Tailwind class fragment) → resolved bg class
const COLOR_BG: Record<string, string> = {
  "green-600": "bg-green-600",
  "blue-600": "bg-blue-600",
  "amber-500": "bg-amber-500",
  "orange-500": "bg-orange-500",
  "red-500": "bg-red-500",
};

export function MerchantHealthDistribution(props: Props) {
  const { data, isLoading, error } = useMerchantHealthDistribution(props);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Phân bố Health Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 animate-pulse bg-stone-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data || !Array.isArray(data)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Phân bố Health Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-700">
            Không tải được: {(error as Error)?.message ?? "Empty data"}
          </div>
        </CardContent>
      </Card>
    );
  }

  const tiers = data as Array<{
    tier: string;
    label: string;
    min: number;
    max: number;
    count: number;
    color: string;
  }>;
  const max = Math.max(1, ...tiers.map((t) => t.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Phân bố Health Score</CardTitle>
        <p className="text-xs text-stone-500">5-tier RFM (BR-SA-07 + BR-SA-22b)</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {tiers.map((t) => {
          const widthPct = (t.count / max) * 100;
          return (
            <div key={t.tier} className="flex items-center gap-3">
              <div className="w-24 text-sm font-medium text-stone-700 shrink-0">
                {t.label}
              </div>
              <div className="flex-1 h-6 bg-stone-100 rounded overflow-hidden">
                <div
                  className={`h-full rounded transition-all ${COLOR_BG[t.color] ?? "bg-stone-400"}`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <div className="w-12 text-right text-sm font-bold tabular-nums text-stone-900">
                {t.count}
              </div>
              <div className="w-16 text-right text-xs text-stone-400 tabular-nums">
                {t.min}-{t.max === 100 ? 100 : t.max}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
