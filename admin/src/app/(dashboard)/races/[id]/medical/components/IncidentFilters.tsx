'use client';

/**
 * F-018 — list filters: severity multi + state multi + category + time range.
 */
import {
  Category,
  CATEGORIES,
  IncidentState,
  STATES,
  Severity,
  SEVERITIES,
} from '../medical.constant';
import {
  CATEGORY_VN,
  SEVERITY_SHORT_VN,
  STATE_VN,
} from '../medical.microcopy';
import { SeverityBadge } from './SeverityBadge';
import { cn } from '@/lib/utils';

export interface FilterState {
  severity: Severity[];
  state: IncidentState[];
  category: Category | null;
  since: string | null;
}

interface IncidentFiltersProps {
  value: FilterState;
  onChange: (next: FilterState) => void;
  totalCount: number;
}

const TIME_RANGES = [
  { key: '1h', label: '1 giờ', minutes: 60 },
  { key: '4h', label: '4 giờ', minutes: 240 },
  { key: '24h', label: '24 giờ', minutes: 1440 },
  { key: 'all', label: 'Toàn race', minutes: -1 },
] as const;

export function IncidentFilters({
  value,
  onChange,
  totalCount,
}: IncidentFiltersProps) {
  const toggleSev = (s: Severity) => {
    onChange({
      ...value,
      severity: value.severity.includes(s)
        ? value.severity.filter((x) => x !== s)
        : [...value.severity, s],
    });
  };

  const toggleState = (st: IncidentState) => {
    onChange({
      ...value,
      state: value.state.includes(st)
        ? value.state.filter((x) => x !== st)
        : [...value.state, st],
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-stone-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-stone-900">Bộ lọc</h3>
        <span className="text-xs text-stone-500">{totalCount} kết quả</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-stone-500">Mức:</span>
        {SEVERITIES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggleSev(s)}
            aria-pressed={value.severity.includes(s)}
            className={cn(
              'rounded-md px-2 py-1 text-xs',
              value.severity.includes(s) ? 'ring-2 ring-offset-1' : 'opacity-70',
            )}
            title={SEVERITY_SHORT_VN[s]}
          >
            <SeverityBadge severity={s} size="sm" showLabel={false} />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-stone-500">Trạng thái:</span>
        {STATES.map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => toggleState(st)}
            aria-pressed={value.state.includes(st)}
            className={cn(
              'rounded-md border px-2 py-1 text-[11px]',
              value.state.includes(st)
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-300 bg-white text-stone-700',
            )}
          >
            {STATE_VN[st]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-stone-500">Loại:</span>
        <select
          value={value.category ?? ''}
          onChange={(e) =>
            onChange({
              ...value,
              category: (e.target.value as Category) || null,
            })
          }
          className="rounded border border-stone-300 px-2 py-1 text-xs"
        >
          <option value="">— Tất cả —</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_VN[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-stone-500">Khoảng thời gian:</span>
        {TIME_RANGES.map((t) => {
          const since =
            t.minutes < 0
              ? null
              : new Date(Date.now() - t.minutes * 60_000).toISOString();
          const isActive =
            (since === null && value.since === null) ||
            (since && value.since && Math.abs(
              new Date(since).getTime() - new Date(value.since).getTime(),
            ) < 60_000);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange({ ...value, since })}
              aria-pressed={isActive ?? false}
              className={cn(
                'rounded-md border px-2 py-1 text-[11px]',
                isActive
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-300 bg-white',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
