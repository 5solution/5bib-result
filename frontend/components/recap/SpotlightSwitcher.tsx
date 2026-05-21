'use client';

/**
 * FEATURE-056 scope expansion 2026-05-21 — Spotlight Switcher (client island).
 *
 * Per Danny mandate 2026-05-21 "cân bằng + nút đổi cự ly":
 * - Tab pills per course (click → switch active)
 * - 2 big gold cards SIDE-BY-SIDE (NAM + NỮ) — fair gender representation,
 *   no sidebar bias of original Variation A single-winner spotlight
 * - Both genders get identical card treatment (same gold gradient, same size,
 *   same metadata fields)
 */

import { useState } from 'react';
import SpotlightWinCard from './SpotlightWinCard';

export interface SpotlightSwitcherPodiumCell {
  name: string;
  bib: string;
  chipTime: string;
  /**
   * Winner's INDIVIDUAL pace (chipTime / distance), e.g. "4:06/km".
   * F-056 bugfix 2026-05-21: trước đây dùng chung `medianPace` của course
   * → cả NAM + NỮ + finisher cuối đều show identical pace (7:09/km cho 10KM
   * race), không đại diện hiệu năng winner. Giờ pass pace per-cell.
   */
  pace?: string;
  category?: string;
  city?: string;
}

export interface SpotlightSwitcherCourse {
  courseId: string;
  label: string;            // "70KM" / "Trail 50Km"
  male?: SpotlightSwitcherPodiumCell;     // Top 1 NAM
  female?: SpotlightSwitcherPodiumCell;   // Top 1 NỮ
}

export interface SpotlightSwitcherProps {
  courses: SpotlightSwitcherCourse[];
  /** Index of course shown by default (typically longest). Default 0. */
  defaultIndex?: number;
}

export default function SpotlightSwitcher({
  courses,
  defaultIndex = 0,
}: SpotlightSwitcherProps) {
  const [activeIdx, setActiveIdx] = useState<number>(
    Math.min(Math.max(defaultIndex, 0), Math.max(courses.length - 1, 0)),
  );

  if (courses.length === 0) return null;
  const active = courses[activeIdx];

  return (
    <div>
      {/* Tab pills (only show if >1 course) */}
      {courses.length > 1 ? (
        <div
          className="inline-flex items-center gap-1 p-1 rounded-full bg-stone-100 mb-6 md:mb-7 overflow-x-auto scrollbar-hide"
          role="tablist"
          aria-label="Chọn cự ly để xem winners"
        >
          {courses.map((c, i) => {
            const isActive = i === activeIdx;
            return (
              <button
                key={c.courseId}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveIdx(i)}
                className={`px-4 py-1.5 rounded-full font-mono font-bold text-[12px] whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-stone-500 hover:text-stone-900 hover:bg-white/60'
                }`}
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Two big spotlight cards side by side — NAM + NỮ equal */}
      <div className="grid gap-4 md:gap-5 md:grid-cols-2">
        {active.male ? (
          <SpotlightWinCard
            courseLabel={`OVERALL · NAM · ${active.label}`}
            name={active.male.name}
            bib={active.male.bib}
            city={active.male.city}
            ageGroup={active.male.category}
            chipTime={active.male.chipTime}
            pace={active.male.pace}
          />
        ) : (
          <EmptyCard label={`OVERALL · NAM · ${active.label}`} />
        )}
        {active.female ? (
          <SpotlightWinCard
            courseLabel={`OVERALL · NỮ · ${active.label}`}
            name={active.female.name}
            bib={active.female.bib}
            city={active.female.city}
            ageGroup={active.female.category}
            chipTime={active.female.chipTime}
            pace={active.female.pace}
          />
        ) : (
          <EmptyCard label={`OVERALL · NỮ · ${active.label}`} />
        )}
      </div>
    </div>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <article
      className="relative overflow-hidden p-8 md:p-10 rounded-3xl bg-stone-100 border border-stone-200 flex flex-col justify-center items-center min-h-[280px]"
    >
      <div
        className="font-mono uppercase tracking-widest"
        style={{ fontSize: 11, color: 'rgba(120, 53, 15, 0.55)' }}
      >
        {label}
      </div>
      <div className="mt-3 font-body italic text-stone-400">
        Chưa có finisher cho nhóm này.
      </div>
    </article>
  );
}
