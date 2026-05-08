"use client";

/**
 * F-012 — Surface 3 (BR-FH-07): "Tại sao preset này?" rationale panel.
 *
 * QC Round 1 BLOCKER #1 fix: render ALL 3 paragraphs (ROAD/TRAIL/ULTRA)
 * when panel is open. Current preset paragraph highlighted via border-left
 * accent + subtle bg. Trigger always visible (does NOT return null when
 * currentPreset === null).
 *
 * Content verbatim from PRD BR-FH-07.
 * Citation per PRD: "Nguồn: Race Ops Expert + Sports Domain Expert F-010
 * advisory (2026-05-07)".
 */

import { useState } from "react";
import type { CourseType } from "./timing-presets.constant";

const PRESET_HEADERS: Record<CourseType, string> = {
  ROAD: "ROAD (Đường nhựa)",
  TRAIL: "TRAIL (Trail)",
  ULTRA: "ULTRA (Siêu dài)",
};

const PRESET_ICONS: Record<CourseType, string> = {
  ROAD: "🛣️",
  TRAIL: "🥾",
  ULTRA: "🏔️",
};

const PRESET_RATIONALE: Record<CourseType, string> = {
  ROAD:
    "Đường phẳng asphalt → pace BTC dự kiến chính xác. Variance chủ yếu do back-of-pack runners (25-35% chậm hơn elite). Dùng paceBuffer 1.10 (chấp nhận 10% chậm) + paceAlertThreshold 0.80 (alert nếu pace drop 20% giữa splits). Overdue 30 phút sufficient cho road events.",
  TRAIL:
    "Địa hình dốc + technical → pace variance >50% legitimate trên climb sections. Sports Domain Expert recommend paceBuffer 1.40-1.50 cho trail thực tế, Danny chốt 1.35 (mid-range compromise). paceAlertThreshold 0.45 cho phép drop 55% trên climb mà không trigger false-alert. Overdue 60 phút buffer cho weather + slow pace.",
  ULTRA:
    "Distance >50km → fatigue cumulative + aid station stops 15-20 phút avg. paceBuffer 1.50 (Danny upper bound) chấp nhận pace tụt 50% late race. paceAlertThreshold 0.40 cho phép drop 60% (walk break + sleep deprivation). Overdue 120 phút accommodate aid station stops + medical check.",
};

const PRESET_ORDER: CourseType[] = ["ROAD", "TRAIL", "ULTRA"];

interface Props {
  currentPreset: CourseType | null;
}

export default function TimingPresetRationalePanel({ currentPreset }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="text-xs font-medium text-amber-700 transition-colors hover:text-amber-900 hover:underline"
        aria-expanded={open}
      >
        {currentPreset
          ? `Tại sao có 3 preset? (Hiện tại: ${PRESET_HEADERS[currentPreset]})`
          : "Tại sao có 3 preset?"}
      </button>
      {open && (
        <div className="mt-2 space-y-2 rounded-md border border-stone-200 bg-white p-3">
          {PRESET_ORDER.map((preset) => {
            const isCurrent = currentPreset === preset;
            return (
              <div
                key={preset}
                className={
                  isCurrent
                    ? "border-l-4 border-amber-500 bg-amber-50/70 px-3 py-2"
                    : "border-l-4 border-stone-200 bg-stone-50/40 px-3 py-2"
                }
              >
                <p
                  className={`mb-1 text-xs font-semibold ${
                    isCurrent ? "text-amber-900" : "text-stone-700"
                  }`}
                >
                  <span className="mr-1.5" aria-hidden="true">
                    {PRESET_ICONS[preset]}
                  </span>
                  {PRESET_HEADERS[preset]}
                  {isCurrent && (
                    <span className="ml-1.5 text-[10px] font-normal text-amber-700">
                      (đang chọn)
                    </span>
                  )}
                </p>
                <p
                  className={`text-xs leading-relaxed ${
                    isCurrent ? "text-stone-800" : "text-stone-600"
                  }`}
                >
                  {PRESET_RATIONALE[preset]}
                </p>
              </div>
            );
          })}
          <p className="pt-1 text-[10px] uppercase tracking-wide text-stone-500">
            Nguồn: Race Ops Expert + Sports Domain Expert F-010 advisory
            (2026-05-07)
          </p>
        </div>
      )}
    </div>
  );
}
