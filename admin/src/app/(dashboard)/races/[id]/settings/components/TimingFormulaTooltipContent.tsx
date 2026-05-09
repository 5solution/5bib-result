"use client";

/**
 * F-012 — Inline formula tooltip content cho 4 timing detection fields.
 *
 * Surface 1 (BR-FH-01..05): Click `<Info />` icon → reveal popover với:
 *   - Layer 1: Formula `<code>` (math notation OK)
 *   - Layer 2: VN explanation
 *   - Layer 3: 1 example (italic)
 *
 * Click-to-reveal pattern (PAUSE-FH-01 resolution):
 *   - Hover-only tooltips fail trên touch (mobile/tablet) — BTC race-day device mix
 *   - Click toggle works universal (desktop + mobile + tablet) + accessible (aria-expanded)
 *   - NO base-ui Tooltip primitive needed — keeps deps untouched (PAUSE-MGR-01)
 */

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";

export type TimingField =
  | "pace_buffer"
  | "pace_alert_threshold"
  | "overdue_threshold"
  | "confidence_multiplier";

interface FieldHint {
  formula: string;
  explanation: string;
  example: string;
  ariaLabel: string;
}

/**
 * Verbatim per PRD BR-FH-01..04 (QC Round 1 MINOR-1 fix).
 * Content fidelity P0 — race marshals tinker with values based on these
 * tooltips, abbreviated formulas can mislead.
 */
const FIELD_HINTS: Record<TimingField, FieldHint> = {
  pace_buffer: {
    formula: "pace_threshold = expected_pace × pace_buffer",
    explanation:
      "Hệ số nhân với pace dự kiến để xác định ngưỡng pace chậm. VD ROAD 1.10 = chấp nhận chậm 10% so với pace dự kiến. Càng cao càng dễ tha (ít alert), càng thấp càng khắt khe.",
    example:
      "VD pace dự kiến 5:00/km × 1.10 = 5:30/km threshold (chậm hơn 5:30/km mới flag)",
    ariaLabel: "Giải thích pace buffer",
  },
  pace_alert_threshold: {
    formula:
      "pace_drop_ratio = current_split_pace / previous_split_pace; flag IF ratio < threshold",
    explanation:
      "Tỷ lệ pace split hiện tại / split trước. Dưới ngưỡng này → flag pace drop bất thường. VD ROAD 0.80 = pace tụt xuống 80% (chậm 20%) so với split trước. Trail/Ultra dùng giá trị thấp hơn vì pace variance cao tự nhiên.",
    example: "VD ROAD 0.80 → split trước 5:00/km, hiện tại > 6:15/km → alert",
    ariaLabel: "Giải thích pace alert threshold",
  },
  overdue_threshold: {
    formula:
      "elapsed_since_expected = now() - expected_arrival_at_CP; flag PHANTOM IF elapsed > overdue_threshold",
    explanation:
      "Số phút BTC chấp nhận chờ kể từ thời gian dự kiến athlete tới CP. Quá ngưỡng này → flag PHANTOM (athlete có thể đã bỏ cuộc/lạc đường). ROAD 30 phút = wait 30 phút sau ETA.",
    example:
      "VD ROAD 30 phút → ETA tới TM1 lúc 8:00, không qua mat đến 8:30 → flag PHANTOM",
    ariaLabel: "Giải thích overdue threshold",
  },
  confidence_multiplier: {
    formula:
      "confidence_pct = (athletes_passed_CP / total_registered) × confidence_multiplier × 100; capped at 100%",
    explanation:
      "Hệ số tin cậy projected rank. Cao = projected rank đáng tin cậy ngay từ ít data; thấp = cần nhiều athletes pass CP mới đáng tin. ROAD 0.20 = cần 20% athletes pass mới có 100% confidence.",
    example:
      "VD ROAD 0.20, total 1000 athletes, 200 pass CP → confidence 100%",
    ariaLabel: "Giải thích confidence multiplier",
  },
};

interface Props {
  field: TimingField;
}

export default function TimingFormulaTooltipContent({ field }: Props) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const hint = FIELD_HINTS[field];

  // Close on outside click + Escape (a11y)
  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex size-4 items-center justify-center rounded-full text-stone-400 transition-colors hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        aria-label={hint.ariaLabel}
        aria-expanded={open}
      >
        <Info className="size-3.5" />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute left-0 top-6 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-stone-200 bg-white p-3 shadow-lg"
        >
          <code className="mb-2 block rounded bg-stone-100 px-2 py-1 font-mono text-[11px] leading-snug text-stone-800 break-words">
            {hint.formula}
          </code>
          <p className="mb-1.5 text-xs leading-relaxed text-stone-700">
            {hint.explanation}
          </p>
          <p className="text-[11px] italic leading-relaxed text-stone-500">
            {hint.example}
          </p>
        </div>
      )}
    </span>
  );
}
