"use client";

/**
 * F-012 — Surface 2 (BR-FH-06): Preset comparison expandable inline collapsible table.
 *
 * Toggle "So sánh preset" → reveals 4 config rows × 3 cols (ROAD/TRAIL/ULTRA)
 *   + 2 footer rows (Race type + Sports Expert note).
 *
 * Current preset column highlighted via accent border + subtle bg.
 *
 * QC Round 1 fixes:
 *   - Values sourced from shared TIMING_PRESETS (timing-presets.constant.ts)
 *     to prevent drift with form (BLOCKER #2 fix).
 *   - "(Danny chốt)" annotations moved out of data cells into legend
 *     footnote below table (MINOR-2 fix).
 *   - Citation footer uses verbatim PRD wording (MINOR-3 fix).
 */

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  TIMING_PRESETS,
  type CourseType,
} from "./timing-presets.constant";

const PRESET_HEADERS: Record<CourseType, string> = {
  ROAD: "ROAD (Đường nhựa)",
  TRAIL: "TRAIL (Trail)",
  ULTRA: "ULTRA (Siêu dài)",
};

const COMPARISON_ROWS: Array<{
  label: string;
  values: Record<CourseType, string>;
}> = [
  {
    label: "Pace buffer",
    values: {
      ROAD: TIMING_PRESETS.ROAD.paceBuffer.toFixed(2),
      TRAIL: TIMING_PRESETS.TRAIL.paceBuffer.toFixed(2),
      ULTRA: TIMING_PRESETS.ULTRA.paceBuffer.toFixed(2),
    },
  },
  {
    label: "Pace alert threshold",
    values: {
      ROAD: TIMING_PRESETS.ROAD.paceAlertThreshold.toFixed(2),
      TRAIL: TIMING_PRESETS.TRAIL.paceAlertThreshold.toFixed(2),
      ULTRA: TIMING_PRESETS.ULTRA.paceAlertThreshold.toFixed(2),
    },
  },
  {
    label: "Overdue threshold (phút)",
    values: {
      ROAD: String(TIMING_PRESETS.ROAD.overdueMinutes),
      TRAIL: String(TIMING_PRESETS.TRAIL.overdueMinutes),
      ULTRA: String(TIMING_PRESETS.ULTRA.overdueMinutes),
    },
  },
  {
    label: "Confidence multiplier",
    values: {
      ROAD: TIMING_PRESETS.ROAD.confidenceMultiplier.toFixed(2),
      TRAIL: TIMING_PRESETS.TRAIL.confidenceMultiplier.toFixed(2),
      ULTRA: TIMING_PRESETS.ULTRA.confidenceMultiplier.toFixed(2),
    },
  },
];

const FOOTER_ROWS: Array<{
  label: string;
  values: Record<CourseType, string>;
}> = [
  {
    label: "Race type",
    values: {
      ROAD: "Đường phẳng, pace ổn định",
      TRAIL: "Địa hình dốc, pace variance cao",
      ULTRA: "Distance dài, fatigue + aid station",
    },
  },
  {
    label: "Sports Expert note",
    values: {
      ROAD: "Back-of-pack 25-35% variance OK",
      TRAIL: "Steep terrain 30%+ grade legitimate",
      ULTRA: "Aid station stops 15-20min avg",
    },
  },
];

interface Props {
  currentPreset: CourseType | null;
}

export default function TimingPresetComparisonTable({ currentPreset }: Props) {
  const [open, setOpen] = useState(false);

  const colHighlight = (preset: CourseType): string =>
    currentPreset === preset
      ? "bg-amber-50 ring-1 ring-amber-300"
      : "bg-white";

  return (
    <div className="border-t border-stone-200 pt-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 transition-colors hover:text-stone-900"
        aria-expanded={open}
      >
        {open ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )}
        So sánh preset (ROAD / TRAIL / ULTRA)
      </button>
      {open && (
        <div className="mt-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border border-stone-200 bg-stone-50 px-2 py-1.5 text-left font-medium text-stone-600">
                    Thông số
                  </th>
                  {(Object.keys(PRESET_HEADERS) as CourseType[]).map((preset) => (
                    <th
                      key={preset}
                      className={`border border-stone-200 px-2 py-1.5 text-left font-medium text-stone-700 ${colHighlight(preset)}`}
                    >
                      {PRESET_HEADERS[preset]}
                      {currentPreset === preset && (
                        <span className="ml-1 text-[10px] font-normal text-amber-700">
                          (hiện tại)
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label}>
                    <td className="border border-stone-200 bg-stone-50/60 px-2 py-1.5 font-medium text-stone-700">
                      {row.label}
                    </td>
                    {(Object.keys(PRESET_HEADERS) as CourseType[]).map((preset) => (
                      <td
                        key={preset}
                        className={`border border-stone-200 px-2 py-1.5 font-mono text-stone-800 ${colHighlight(preset)}`}
                      >
                        {row.values[preset]}
                      </td>
                    ))}
                  </tr>
                ))}
                {FOOTER_ROWS.map((row) => (
                  <tr key={row.label}>
                    <td className="border border-stone-200 bg-stone-100/80 px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-600">
                      {row.label}
                    </td>
                    {(Object.keys(PRESET_HEADERS) as CourseType[]).map((preset) => (
                      <td
                        key={preset}
                        className={`border border-stone-200 px-2 py-1.5 text-[11px] italic leading-relaxed text-stone-600 ${colHighlight(preset)}`}
                      >
                        {row.values[preset]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 space-y-1 text-[10px] leading-relaxed text-stone-500">
            <p>
              Giá trị TRAIL/ULTRA điều chỉnh bởi Danny dựa trên Sports Domain
              Expert advisory (F-010 expert review).
            </p>
            <p className="italic">
              Nguồn giá trị: F-010 expert review consolidated (Race Operation
              Expert + Sports Domain Expert)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
