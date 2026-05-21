/**
 * Shared types for /runners discover page components (F-056 Phase 5).
 * Mirrors backend DTO shape returned by /api/race-results/athletes(*) endpoints.
 */

export interface AthleteSummary {
  slug: string;
  canonicalName: string;
  primaryBib: string;
  gender?: 'male' | 'female' | 'other' | null;
  nationality?: string;
  ageGroup?: string;
  totalRaces: number;
  totalFinished: number;
  lastRaceDate?: string;
  avatarUrl?: string;
  specialty?: 'marathon' | 'hm' | 'trail' | 'ultra' | 'road' | null;
}

export interface AthletesStats {
  totalAthletes: number;
  totalRaces: number;
  totalProvinces: number;
  totalChipTimes: number;
}

export interface AthletesListResponse {
  data: AthleteSummary[];
  total: number;
  pageNo: number;
  pageSize: number;
  byLetter: Record<string, number>;
}

export interface AthletesSpotlight {
  topOne: AthleteSummary | null;
  topFive: AthleteSummary[];
  month: string;
}

export interface AthletesFeatured90d {
  items: AthleteSummary[];
  windowDays: number;
}

export type SortKey = 'az' | 'newest' | 'mostRaces' | 'fastestPR';
export type GenderFilter = 'male' | 'female';
export type SpecialtyFilter = 'road' | 'trail' | 'ultra' | 'marathon' | 'hm';

export interface RunnersSearchParams {
  letter?: string;
  province?: string;
  gender?: string;
  ageGroup?: string;
  specialty?: string;
  minRaces?: string;
  maxRaces?: string;
  sort?: string;
  page?: string;
}

/** Vietnamese label for specialty pill */
export const SPECIALTY_LABEL: Record<NonNullable<AthleteSummary['specialty']>, string> = {
  marathon: 'Marathon',
  hm: 'HM specialist',
  trail: 'Trail',
  ultra: 'Ultra',
  road: 'Road',
};

/** Tailwind class string for specialty pill bg/text */
export const SPECIALTY_PILL_CLASS: Record<
  NonNullable<AthleteSummary['specialty']>,
  string
> = {
  marathon: 'bg-blue-50 text-blue-700 border-blue-200',
  hm: 'bg-blue-50 text-blue-700 border-blue-200',
  trail: 'bg-orange-50 text-orange-700 border-orange-200',
  ultra: 'bg-blue-50 text-blue-700 border-blue-200',
  road: 'bg-slate-50 text-slate-700 border-slate-200',
};

/** Vietnamese label for sort key */
export const SORT_LABEL: Record<SortKey, string> = {
  az: 'A → Z',
  newest: 'Mới nhất',
  mostRaces: 'Nhiều race nhất',
  fastestPR: 'PR nhanh nhất',
};

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (
    (parts[0][0]?.toUpperCase() ?? '') +
    (parts[parts.length - 1][0]?.toUpperCase() ?? '')
  );
}

/** Format ISO date → DD/MM/YYYY (vi-VN), '—' if invalid */
export function formatVN(d?: string): string {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1)
    .toString()
    .padStart(2, '0')}/${date.getFullYear()}`;
}

/** Format YYYY-MM → "Tháng M/YYYY" (e.g., '2026-05' → 'tháng 5/2026') */
export function formatMonthVN(ym?: string): string {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  if (!y || !m) return ym;
  return `tháng ${parseInt(m, 10)}/${y}`;
}
