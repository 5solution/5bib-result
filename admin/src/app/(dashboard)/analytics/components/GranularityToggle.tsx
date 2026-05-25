"use client";

/**
 * F-062 Wave 1 (Manager Adjustment #3 v3) — Granularity Toggle component.
 *
 * Tách từ `PeriodCompareSelector.tsx` cũ thành component RIÊNG BIỆT cho concern
 * "bucket size cho chart aggregation" (separate from period filter + compare).
 *
 * Type: `GranularityKind = 'daily' | 'weekly' | 'monthly'` per BR-SA-01 v3.
 * UI: SegmentedControl 3 option.
 * Default: 'daily'.
 * Position: Header bar, TRƯỚC PeriodSelector.
 * URL params: `?granularity=daily|weekly|monthly` (persist across tab navigation).
 */

import { GRANULARITY_LABEL, type GranularityKind } from "@/lib/analytics-labels";

interface Props {
  value: GranularityKind;
  onChange: (v: GranularityKind) => void;
  disabled?: boolean;
}

const OPTIONS: GranularityKind[] = ["daily", "weekly", "monthly"];

export function GranularityToggle({ value, onChange, disabled = false }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Chọn độ chi tiết thời gian"
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-stone-200 bg-white shadow-sm"
    >
      {OPTIONS.map((opt) => {
        const isActive = opt === value;
        return (
          <button
            key={opt}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={`px-3 py-1 rounded-md text-xs font-semibold tracking-wide transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
              isActive
                ? "bg-[var(--5s-blue)] text-white shadow-sm"
                : "text-stone-600 hover:text-stone-900 hover:bg-stone-50"
            }`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {GRANULARITY_LABEL[opt]}
          </button>
        );
      })}
    </div>
  );
}
