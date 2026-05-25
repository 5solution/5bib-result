"use client";

/**
 * F-062 Wave 1 (Manager Adjustment #3 v3) — Period Selector component.
 *
 * Tách từ `PeriodCompareSelector.tsx` cũ thành component RIÊNG BIỆT cho concern
 * "time range filter" (separate from granularity + compare).
 *
 * Type: `PeriodKind = '7d' | '30d' | 'quarter' | 'year' | 'rolling12m' | 'custom'`
 *       (GIỮ NGUYÊN F-026 6 values per BR-SA-01 v3).
 * UI: Select dropdown 6 options. Custom mode → inline date range picker.
 * Default: '30d'.
 * Position: Header bar, SAU GranularityToggle, TRƯỚC CompareSelector.
 * URL params: `?period=7d|30d|quarter|year|rolling12m|custom&from=YYYY-MM-DD&to=YYYY-MM-DD`.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { PERIOD_LABEL, type PeriodKind } from "@/lib/analytics-labels";

interface Props {
  value: PeriodKind;
  onChange: (v: PeriodKind) => void;
  /** Custom from date YYYY-MM-DD — only used when value === 'custom' */
  customFrom?: string;
  customTo?: string;
  onCustomRangeChange?: (from: string, to: string) => void;
  disabled?: boolean;
}

const OPTIONS: PeriodKind[] = ["7d", "30d", "quarter", "year", "rolling12m", "custom"];

export function PeriodSelector({
  value,
  onChange,
  customFrom = "",
  customTo = "",
  onCustomRangeChange,
  disabled = false,
}: Props) {
  return (
    <div className="inline-flex items-center gap-2">
      <Select
        value={value}
        onValueChange={(v) => onChange(v as PeriodKind)}
        disabled={disabled}
      >
        <SelectTrigger
          className="w-[170px] h-9 text-sm bg-white"
          aria-label="Chọn khoảng thời gian"
        >
          {/* Render prop pattern để hiển thị VN label thay vì raw enum */}
          <SelectValue>{PERIOD_LABEL[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {PERIOD_LABEL[opt]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value === "custom" && (
        <div className="inline-flex items-center gap-1">
          <Input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomRangeChange?.(e.target.value, customTo)}
            disabled={disabled}
            className="w-[140px] h-9 text-sm"
            aria-label="Từ ngày"
            max={customTo || undefined}
          />
          <span className="text-stone-400 text-xs">→</span>
          <Input
            type="date"
            value={customTo}
            onChange={(e) => onCustomRangeChange?.(customFrom, e.target.value)}
            disabled={disabled}
            className="w-[140px] h-9 text-sm"
            aria-label="Đến ngày"
            min={customFrom || undefined}
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>
      )}
    </div>
  );
}
