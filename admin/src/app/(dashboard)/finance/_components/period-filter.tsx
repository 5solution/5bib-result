"use client";

/**
 * F-028 Phase 2 — Period filter cho dashboard.
 *
 * Preset 5 option + custom range. Pattern simpler hơn F-026 PeriodCompareSelector
 * vì dashboard P&L KHÔNG cần compare baseline (Phase 2 scope-locked).
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DashboardPeriod } from "@/lib/finance-api";
import { PERIOD_LABEL } from "@/lib/finance-labels";

export function PeriodFilter({
  period,
  dateFrom,
  dateTo,
  onChange,
}: {
  period: DashboardPeriod;
  dateFrom: string;
  dateTo: string;
  onChange: (p: { period: DashboardPeriod; dateFrom: string; dateTo: string }) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-stone-600">Khoảng thời gian</Label>
        <Select
          value={period}
          onValueChange={(v) =>
            onChange({ period: (v as DashboardPeriod) ?? period, dateFrom, dateTo })
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Chọn khoảng">
              {PERIOD_LABEL[period] ?? period}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABEL) as DashboardPeriod[]).map((k) => (
              <SelectItem key={k} value={k}>
                {PERIOD_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {period === "custom" && (
        <>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-stone-600">Từ ngày</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) =>
                onChange({ period, dateFrom: e.target.value, dateTo })
              }
              className="w-[160px]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-stone-600">Đến ngày</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) =>
                onChange({ period, dateFrom, dateTo: e.target.value })
              }
              className="w-[160px]"
            />
          </div>
        </>
      )}
    </div>
  );
}
