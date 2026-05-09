/**
 * F-019 BR-AG-05 — 5 default AG presets ship Phase 1.
 *
 * Source: 00-manager-init.md §3 + 01-ba-prd.md Section 3 BR-AG-05.
 * Danny chốt 2026-05-09: VN road default 42K/21K = Nam/Nữ × 5 brackets.
 */

export type GenderKey = 'M' | 'F';

export interface AGBracket {
  /** Stable key — used as podium document key (vd "M_30-39"). */
  key: string;
  /** Display label VN (e.g. "Nam 30-39"). */
  label: string;
  /** Inclusive lower bound. */
  min: number;
  /** Inclusive upper bound. -1 = no cap (60+, 65+). */
  max: number;
}

export interface AGPreset {
  presetKey: string;
  label: string;
  description: string;
  brackets: Record<GenderKey, AGBracket[]>;
  /** WA TR9 default — đúng tuổi 30 → bracket 30-39. 'lower' = override VN-local. */
  boundaryMode: 'upper' | 'lower';
}

const VN_ROAD_BRACKETS_BY_RANGE = [
  { min: 18, max: 29 },
  { min: 30, max: 39 },
  { min: 40, max: 49 },
  { min: 50, max: 59 },
  { min: 60, max: -1 },
];

function vnBracket(prefix: 'Nam' | 'Nữ', gender: GenderKey): AGBracket[] {
  return VN_ROAD_BRACKETS_BY_RANGE.map((r) => {
    const range = r.max === -1 ? `${r.min}+` : `${r.min}-${r.max}`;
    return {
      key: `${gender}_${range}`,
      label: `${prefix} ${range}`,
      min: r.min,
      max: r.max,
    };
  });
}

export const VN_ROAD_DEFAULT_PRESET: AGPreset = {
  presetKey: 'vn_road_default',
  label: 'VN Road Default (5 brackets × 2 gender)',
  description:
    'Default cho road race VN 42K/21K. Nam/Nữ × {18-29, 30-39, 40-49, 50-59, 60+}. Danny chốt 2026-05-09.',
  brackets: {
    M: vnBracket('Nam', 'M'),
    F: vnBracket('Nữ', 'F'),
  },
  boundaryMode: 'upper',
};

const ROAD_5_YEAR_RANGES = [
  { min: 18, max: 19 },
  { min: 20, max: 24 },
  { min: 25, max: 29 },
  { min: 30, max: 34 },
  { min: 35, max: 39 },
  { min: 40, max: 44 },
  { min: 45, max: 49 },
  { min: 50, max: 54 },
  { min: 55, max: 59 },
  { min: 60, max: 64 },
  { min: 65, max: 69 },
  { min: 70, max: -1 },
];

function road5YearBracket(
  prefix: 'M' | 'W',
  gender: GenderKey,
): AGBracket[] {
  return ROAD_5_YEAR_RANGES.map((r) => {
    const range = r.max === -1 ? `${r.min}+` : `${r.min}-${r.max}`;
    return {
      key: `${gender}_${range}`,
      label: `${prefix}${range}`,
      min: r.min,
      max: r.max,
    };
  });
}

export const ROAD_5_YEAR_PRESET: AGPreset = {
  presetKey: 'road_5_year',
  label: 'Road 5-year (WMA international)',
  description:
    'WMA chuẩn quốc tế cho giải international ≥1000 finishers (M/W 18-19, 20-24, ..., 70+).',
  brackets: {
    M: road5YearBracket('M', 'M'),
    F: road5YearBracket('W', 'F'),
  },
  boundaryMode: 'upper',
};

const TRAIL_ITRA_RANGES = [
  { key: 'Espoir', min: 18, max: 22, label: 'Espoir/U23' },
  { key: 'Senior', min: 23, max: 39, label: 'Senior 23-39' },
  { key: 'V1', min: 40, max: 49, label: 'V1 40-49' },
  { key: 'V2', min: 50, max: 59, label: 'V2 50-59' },
  { key: 'V3', min: 60, max: -1, label: 'V3 60+' },
];

function trailItraBracket(
  prefix: 'Nam' | 'Nữ',
  gender: GenderKey,
): AGBracket[] {
  return TRAIL_ITRA_RANGES.map((r) => ({
    key: `${gender}_${r.key}`,
    label: `${prefix} ${r.label}`,
    min: r.min,
    max: r.max,
  }));
}

export const TRAIL_ITRA_PRESET: AGPreset = {
  presetKey: 'trail_itra',
  label: 'Trail ITRA (Espoir/Senior/V1/V2/V3)',
  description:
    'ITRA standard placeholder Phase 1 cho trail VMM/VTM/DLUT/Cát Tiên. Race Ops Expert verify Phase 2.',
  brackets: {
    M: trailItraBracket('Nam', 'M'),
    F: trailItraBracket('Nữ', 'F'),
  },
  boundaryMode: 'upper',
};

export const TRAIL_LITE_PRESET: AGPreset = {
  presetKey: 'trail_lite',
  label: 'Trail Lite (Open + 50+)',
  description:
    'Cho giải trail nhỏ Cát Tiên-class. Open 18-49 + Master 50+.',
  brackets: {
    M: [
      { key: 'M_Open', label: 'Nam Open', min: 18, max: 49 },
      { key: 'M_50+', label: 'Nam 50+', min: 50, max: -1 },
    ],
    F: [
      { key: 'F_Open', label: 'Nữ Open', min: 18, max: 49 },
      { key: 'F_50+', label: 'Nữ 50+', min: 50, max: -1 },
    ],
  },
  boundaryMode: 'upper',
};

export const OPEN_ONLY_PRESET: AGPreset = {
  presetKey: 'open_only',
  label: 'Open Only (5K/10K fun-run)',
  description: 'Không AG, chỉ Open Nam/Nữ — cho 5K/10K fun-run.',
  brackets: {
    M: [{ key: 'M_Open', label: 'Nam Open', min: 0, max: -1 }],
    F: [{ key: 'F_Open', label: 'Nữ Open', min: 0, max: -1 }],
  },
  boundaryMode: 'upper',
};

export const AG_PRESETS: Record<string, AGPreset> = {
  vn_road_default: VN_ROAD_DEFAULT_PRESET,
  road_5_year: ROAD_5_YEAR_PRESET,
  trail_itra: TRAIL_ITRA_PRESET,
  trail_lite: TRAIL_LITE_PRESET,
  open_only: OPEN_ONLY_PRESET,
};

export const AG_PRESET_KEYS = Object.keys(AG_PRESETS) as Array<
  keyof typeof AG_PRESETS
>;

/** Default selector cho course chưa set preset. */
export function defaultPresetFor(courseType?: string): AGPreset {
  const t = (courseType ?? '').toLowerCase();
  if (t.includes('trail') || t.includes('ultra')) {
    return TRAIL_ITRA_PRESET;
  }
  return VN_ROAD_DEFAULT_PRESET;
}
