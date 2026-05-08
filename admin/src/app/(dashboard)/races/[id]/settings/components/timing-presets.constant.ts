/**
 * F-012 — Shared TIMING_PRESETS constants (TD-F012-02 RESOLVED)
 *
 * Single source of truth cho preset values across:
 *   - TimingDetectionConfigSection.tsx (form applyPreset())
 *   - TimingPresetComparisonTable.tsx (Surface 2 table values)
 *
 * Values per PRD BR-FH-06 (Race Operation Expert + Sports Domain Expert
 * F-010 expert review consolidated). Danny-locked.
 *
 * Why a shared module: QC round-1 BLOCKER #2 — table values diverged from
 * form's TIMING_PRESETS (TRAIL overdue=45 vs table=60, etc.). Extracting to
 * shared constant prevents future drift; table reads via this module.
 */

export type CourseType = "ROAD" | "TRAIL" | "ULTRA";

export interface TimingPreset {
  paceBuffer: number;
  paceAlertThreshold: number;
  overdueMinutes: number;
  confidenceMultiplier: number;
}

/**
 * Preset values per PRD BR-FH-06 (verbatim).
 *   ROAD    1.10 / 0.80 / 30  / 0.20
 *   TRAIL   1.35 / 0.45 / 60  / 0.15
 *   ULTRA   1.50 / 0.40 / 120 / 0.10
 */
export const TIMING_PRESETS: Record<CourseType, TimingPreset> = {
  ROAD: {
    paceBuffer: 1.1,
    paceAlertThreshold: 0.8,
    overdueMinutes: 30,
    confidenceMultiplier: 0.2,
  },
  TRAIL: {
    paceBuffer: 1.35,
    paceAlertThreshold: 0.45,
    overdueMinutes: 60,
    confidenceMultiplier: 0.15,
  },
  ULTRA: {
    paceBuffer: 1.5,
    paceAlertThreshold: 0.4,
    overdueMinutes: 120,
    confidenceMultiplier: 0.1,
  },
};

export const PRESET_LABELS_VI: Record<CourseType, string> = {
  ROAD: "Đường nhựa (ROAD)",
  TRAIL: "Trail (TRAIL)",
  ULTRA: "Siêu dài (ULTRA)",
};
