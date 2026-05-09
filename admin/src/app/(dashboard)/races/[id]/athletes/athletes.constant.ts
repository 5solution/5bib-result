/**
 * F-014 Athletes tab — shared constants.
 *
 * 9-status enum (BR-AS-01) — derived client-side from existing race-result
 * fields (Option C, Danny APPROVED). NO backend schema migration in F-014.
 *
 * Status priority (BR-AS-07 static priority sort):
 *   LIVE → DNF → MED → CUT → DSQ → FIN → PICKED → REG → DNS
 *
 * Color tokens align with `frontend/app/globals.css` Velocity palette:
 *   energy orange (#ea580c) for live/danger
 *   trail green (#166534) for finishers
 *   blue accent (#1d4ed8) for picked
 *   slate for neutral/registered
 */

export const ATHLETE_STATUSES = [
  'REG',
  'PICKED',
  'DNS',
  'LIVE',
  'FIN',
  'DNF',
  'CUT',
  'DSQ',
  'MED',
] as const;

export type AthleteStatus = (typeof ATHLETE_STATUSES)[number];

/** Display tone for StatusBadge — maps to Tailwind utility classes. */
export interface StatusTone {
  /** Vietnamese short label (≤8 chars for table cell). */
  label: string;
  /** Tailwind background utility. */
  bg: string;
  /** Tailwind text-color utility. */
  text: string;
  /** Tailwind border utility. */
  border: string;
  /** True for pulsing dot (LIVE). */
  pulse?: boolean;
}

export const STATUS_TONES: Record<AthleteStatus, StatusTone> = {
  REG: {
    label: 'Đã đăng ký',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-300',
  },
  PICKED: {
    label: 'Đã nhận BIB',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-300',
  },
  DNS: {
    label: 'Không xuất phát',
    bg: 'bg-zinc-100',
    text: 'text-zinc-600',
    border: 'border-zinc-300',
  },
  LIVE: {
    label: 'Đang chạy',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-300',
    pulse: true,
  },
  FIN: {
    label: 'Hoàn thành',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-300',
  },
  DNF: {
    label: 'Bỏ cuộc',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-300',
  },
  CUT: {
    label: 'Quá COT',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-300',
  },
  DSQ: {
    label: 'Truất quyền',
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-300',
  },
  MED: {
    label: 'Y tế',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-300',
  },
};

/** BR-AS-07 — static priority sort order. Lower index = renders first. */
export const STATUS_PRIORITY: Record<AthleteStatus, number> = {
  LIVE: 0,
  DNF: 1,
  MED: 2,
  CUT: 3,
  DSQ: 4,
  FIN: 5,
  PICKED: 6,
  REG: 7,
  DNS: 8,
};

/** BR-AS-08 — 4 view-mode toggles (URL `?view=`). */
export const ATHLETE_VIEWS = ['default', 'live-now', 'finishers', 'incidents'] as const;
export type AthleteView = (typeof ATHLETE_VIEWS)[number];

export const VIEW_LABELS: Record<AthleteView, string> = {
  default: 'Tất cả',
  'live-now': 'Đang chạy',
  finishers: 'Hoàn thành',
  incidents: 'Sự cố (DNF/CUT/DSQ/MED)',
};

/** Statuses each view-toggle filters to (client-derived). */
export const VIEW_STATUS_FILTER: Record<AthleteView, AthleteStatus[] | null> = {
  default: null,
  'live-now': ['LIVE'],
  finishers: ['FIN'],
  incidents: ['DNF', 'CUT', 'DSQ', 'MED'],
};

/** BR-AS-06 — server-pagination default page size. */
export const ATHLETES_PAGE_SIZE = 50;

/** BR-AS-09/52 — search debounce window. */
export const SEARCH_DEBOUNCE_MS = 300;

/** BR-AS-03 — minimum reason length for status changes (DSQ/DNF/CUT/MED). */
export const REASON_MIN_LENGTH = 10;
export const REASON_MAX_LENGTH = 500;

/** BR-AS-17 — bulk-select cap (UX guard). */
export const BULK_ACTION_CAP = 500;

/** Statuses that REQUIRE a reason on change (BR-AS-03). */
export const REASON_REQUIRED_STATUSES: AthleteStatus[] = ['DSQ', 'DNF', 'CUT', 'MED'];
