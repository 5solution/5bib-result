"use client";

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
