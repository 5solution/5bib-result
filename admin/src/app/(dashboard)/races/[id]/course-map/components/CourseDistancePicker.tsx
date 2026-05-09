'use client';

/**
 * F-009 CourseDistancePicker — multi-distance pills with 4-state status badge.
 *
 * Carryover Command Center course-pill pattern (BR-CC-01) + URL query param sync
 * (deep-link friendly). PAUSE-CM2-06: pill NOT disabled when no GPX — body
 * surfaces empty state instead so admin can navigate to upload section.
 *
 * Status badges (BR-CM2-04):
 *   ✅ complete   — gpxParsed + all CPs have lat/lng
 *   ⚠ partial    — gpxParsed + some CPs unmatched
 *   ❌ no-gpx    — no gpxParsed yet
 *   🔴 error     — backend reports parse error (future; treated as no-gpx for MVP)
 */

import * as React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export interface CoursePickerEntry {
  courseId: string;
  name: string;
  /** Distance label like "42K" / "21K" / "10K". Optional fallback. */
  distance?: string;
}

export type CourseStatus = 'complete' | 'partial' | 'no-gpx' | 'error';

export interface CourseDistancePickerProps {
  courses: CoursePickerEntry[];
  /** Map<courseId, status> precomputed by parent (uses cached map-data
   *  queries — avoids one query per pill). */
  statusByCourse: Record<string, CourseStatus>;
  /** Currently selected courseId (controlled). */
  selectedCourseId: string;
  /** Optional callback fires AFTER URL update so parent can sync local state. */
  onSelect?: (courseId: string) => void;
}

const STATUS_META: Record<
  CourseStatus,
  { badge: string; label: string; ringClass: string }
> = {
  complete: { badge: '✅', label: 'Đầy đủ', ringClass: 'ring-emerald-300' },
  partial: { badge: '⚠', label: 'Thiếu CP', ringClass: 'ring-amber-300' },
  'no-gpx': { badge: '❌', label: 'Chưa GPX', ringClass: 'ring-stone-300' },
  error: { badge: '🔴', label: 'Lỗi', ringClass: 'ring-red-400' },
};

export function CourseDistancePicker({
  courses,
  statusByCourse,
  selectedCourseId,
  onSelect,
}: CourseDistancePickerProps): React.ReactElement {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSelect = React.useCallback(
    (courseId: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('course', courseId);
      // shallow URL replace — do not scroll to top, do not refetch RSC tree.
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      onSelect?.(courseId);
    },
    [router, pathname, searchParams, onSelect],
  );

  if (courses.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Race chưa có cự ly nào. Vào tab Settings → Cự ly để tạo.
      </p>
    );
  }

  return (
    <div
      role="tablist"
      aria-label="Chọn cự ly"
      className="flex flex-wrap items-center gap-2 overflow-x-auto md:overflow-visible"
      data-testid="course-distance-picker"
    >
      {courses.map((c) => {
        const status = statusByCourse[c.courseId] ?? 'no-gpx';
        const meta = STATUS_META[status];
        const isActive = c.courseId === selectedCourseId;
        return (
          <button
            key={c.courseId}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`${c.name} — ${meta.label}`}
            onClick={() => handleSelect(c.courseId)}
            className={[
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
              isActive
                ? 'border-[#FF0E65] bg-[#FF0E65] text-white shadow-md'
                : 'border-stone-300 bg-white text-stone-700 hover:border-[#FF0E65] hover:bg-stone-50',
              `ring-2 ring-offset-1 ${meta.ringClass}`,
            ].join(' ')}
            data-status={status}
          >
            <span aria-hidden="true">{meta.badge}</span>
            <span>{c.name}</span>
            {c.distance ? (
              <span
                className={[
                  'ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-stone-100 text-stone-500',
                ].join(' ')}
              >
                {c.distance}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
