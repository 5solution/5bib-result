"use client";

/**
 * @deprecated F-062 v3 (Manager Adjustment #3 v3, 2026-05-22) —
 * Combined Period + Compare selector đã split thành 3 components RIÊNG BIỆT:
 *   - `PeriodSelector.tsx` — 6 PeriodKind values + custom date range
 *   - `CompareSelector.tsx` — 5 CompareKind values (none/prev/wow/mom/yoy)
 *   - `GranularityToggle.tsx` — 3 GranularityKind values (daily/weekly/monthly)
 *
 * Reason: PRD v2 conflate Period vs Granularity vào 1 union — semantic flaw.
 * F-062 v3 PRD tách Period (time range) / Granularity (bucket size) / Compare (delta)
 * thành 3 concept rõ ràng. Component cũ duy trì BACKWARD COMPAT cho file in-flight
 * vẫn import — sẽ XOÁ sau Phase 2 verify zero refs trong codebase.
 *
 * Migration path: Tab 1+2+3+4+5 page.tsx switch sang 3 NEW selectors qua
 * shared `analytics/layout.tsx` (NEW per BR-SA-12 v3).
 *
 * TODO Phase 2: grep ref + remove import + delete file.
 */

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type PeriodKind = "7d" | "30d" | "quarter" | "year" | "rolling12m";
export type CompareKind = "none" | "prev" | "yoy";

interface Props {
  period: PeriodKind;
  compareWith: CompareKind;
  onPeriodChange: (p: PeriodKind) => void;
  onCompareChange: (c: CompareKind) => void;
}

const PERIODS: { value: PeriodKind; label: string }[] = [
  { value: "7d", label: "7 ngày qua" },
  { value: "30d", label: "30 ngày qua" },
  { value: "quarter", label: "Quý này" },
  { value: "year", label: "Năm nay" },
  { value: "rolling12m", label: "12 tháng rolling" },
];

const COMPARES: { value: CompareKind; label: string }[] = [
  { value: "prev", label: "Kỳ trước" },
  { value: "yoy", label: "Cùng kỳ năm trước" },
  { value: "none", label: "Không so sánh" },
];

export function PeriodCompareSelector({ period, compareWith, onPeriodChange, onCompareChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={period} onValueChange={(v) => onPeriodChange(v as PeriodKind)}>
        <SelectTrigger className="w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIODS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span className="text-xs text-muted-foreground">so sánh với</span>

      <Select value={compareWith} onValueChange={(v) => onCompareChange(v as CompareKind)}>
        <SelectTrigger className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COMPARES.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
