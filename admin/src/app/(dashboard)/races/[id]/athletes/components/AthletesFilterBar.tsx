'use client';

/**
 * F-014 BR-AS-10/11 — Filter bar.
 *
 * Composition:
 *   [search input] [view toggle 4-way] [status chips multi-select]
 *   [course pills multi-select] [gender drop] [age drop] [paid drop]
 *   [reset]
 *
 * URL-sync delegated to `useAthleteFilters`. Search uses `useAthletesSearch`
 * for 300ms debounce; on flush the parent passes debouncedQuery to the list
 * hook.
 */

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import {
  ATHLETE_STATUSES,
  ATHLETE_VIEWS,
  STATUS_TONES,
  VIEW_LABELS,
  type AthleteStatus,
  type AthleteView,
} from '../athletes.constant';
import { ATHLETES_VN } from '../athletes.microcopy';
import type { AthleteFilters } from '../athletes.types';

interface CourseOption {
  courseId: string;
  name: string;
}

interface AthletesFilterBarProps {
  filters: AthleteFilters;
  view: AthleteView;
  query: string;
  onQueryChange: (q: string) => void;
  onSetFilter: <K extends keyof AthleteFilters>(
    key: K,
    value: AthleteFilters[K],
  ) => void;
  onSetView: (next: AthleteView) => void;
  onReset: () => void;
  courseOptions: CourseOption[];
  ageGroupOptions: string[];
}

export function AthletesFilterBar(props: AthletesFilterBarProps) {
  const {
    filters,
    view,
    query,
    onQueryChange,
    onSetFilter,
    onSetView,
    onReset,
    courseOptions,
    ageGroupOptions,
  } = props;

  const toggleStatus = (s: AthleteStatus) => {
    const next = filters.statuses.includes(s)
      ? filters.statuses.filter((x) => x !== s)
      : [...filters.statuses, s];
    onSetFilter('statuses', next);
  };

  const toggleCourse = (cid: string) => {
    const next = filters.courseIds.includes(cid)
      ? filters.courseIds.filter((x) => x !== cid)
      : [...filters.courseIds, cid];
    onSetFilter('courseIds', next);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-background p-4 shadow-xs">
      {/* Row 1: search + view toggles */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={ATHLETES_VN.searchPlaceholder}
            className="pl-9"
            data-testid="athletes-search-input"
          />
        </div>
        <div
          className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1"
          role="tablist"
          aria-label="View"
        >
          {ATHLETE_VIEWS.map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => onSetView(v)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                view === v
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              data-testid={`view-toggle-${v}`}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: status chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {ATHLETES_VN.filterStatus}:
        </span>
        {ATHLETE_STATUSES.map((s) => {
          const tone = STATUS_TONES[s];
          const active = filters.statuses.includes(s);
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border transition-all ${
                active
                  ? `${tone.bg} ${tone.text} ${tone.border} ring-2 ring-offset-1 ring-current/20`
                  : 'bg-background text-muted-foreground border-input hover:bg-muted'
              }`}
              data-testid={`status-chip-${s}`}
              aria-pressed={active}
            >
              {tone.label}
            </button>
          );
        })}
      </div>

      {/* Row 3: course pills + dropdowns + reset */}
      <div className="flex flex-wrap items-center gap-2">
        {courseOptions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {ATHLETES_VN.filterCourse}:
            </span>
            {courseOptions.map((c) => {
              const active = filters.courseIds.includes(c.courseId);
              return (
                <button
                  key={c.courseId}
                  onClick={() => toggleCourse(c.courseId)}
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold border transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700 border-blue-300'
                      : 'bg-background text-muted-foreground border-input hover:bg-muted'
                  }`}
                  data-testid={`course-pill-${c.courseId}`}
                  aria-pressed={active}
                >
                  {c.name || c.courseId}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <Select
            value={filters.gender}
            onValueChange={(v) =>
              onSetFilter(
                'gender',
                (v ?? 'all') as AthleteFilters['gender'],
              )
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder={ATHLETES_VN.filterGender} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="M">Nam</SelectItem>
              <SelectItem value="F">Nữ</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={filters.ageGroup}
            onValueChange={(v) => onSetFilter('ageGroup', v ?? 'all')}
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder={ATHLETES_VN.filterAgeGroup} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả AG</SelectItem>
              {ageGroupOptions.map((ag) => (
                <SelectItem key={ag} value={ag}>
                  {ag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.paid}
            onValueChange={(v) =>
              onSetFilter(
                'paid',
                (v ?? 'all') as AthleteFilters['paid'],
              )
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder={ATHLETES_VN.filterPaid} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="yes">Đã thanh toán</SelectItem>
              <SelectItem value="no">Chưa thanh toán</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="ghost" size="sm" onClick={onReset} data-testid="filter-reset">
            <X className="size-4 mr-1" />
            {ATHLETES_VN.resetFilters}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AthletesFilterBar;
