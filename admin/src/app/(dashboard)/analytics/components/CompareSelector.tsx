"use client";

/**
 * F-062 Wave 1 (Manager Adjustment #3 v3) — Compare Selector component.
 *
 * Tách từ `PeriodCompareSelector.tsx` cũ thành component RIÊNG BIỆT cho concern
 * "period-over-period delta type" (separate from period range + granularity).
 *
 * Type: `CompareKind = 'none' | 'prev' | 'wow' | 'mom' | 'yoy' | 'custom'`
 *       per BR-SA-01 v3 (extend F-026 thêm 'wow' / 'mom', giữ 'prev' / 'yoy' / 'none' / 'custom').
 * UI: Select dropdown 5 options (skip 'custom' v1 — defer Phase 2).
 * Default: 'mom'.
 * Position: Header bar, SAU PeriodSelector, TRƯỚC Export button.
 * URL params: `?compare=none|prev|wow|mom|yoy`.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMPARE_LABEL, type CompareKind } from "@/lib/analytics-labels";

interface Props {
  value: CompareKind;
  onChange: (v: CompareKind) => void;
  disabled?: boolean;
}

// v1 skip 'custom' per BR-SA-14 design intent (defer Phase 2).
const OPTIONS: CompareKind[] = ["none", "prev", "wow", "mom", "yoy"];

export function CompareSelector({ value, onChange, disabled = false }: Props) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as CompareKind)}
      disabled={disabled}
    >
      <SelectTrigger
        className="w-[200px] h-9 text-sm bg-white"
        aria-label="Chọn loại so sánh kỳ"
      >
        <SelectValue>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-xs text-stone-500">vs</span>
            <span>{COMPARE_LABEL[value]}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {COMPARE_LABEL[opt]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
