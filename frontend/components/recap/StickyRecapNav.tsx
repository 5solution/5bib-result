'use client';

/**
 * FEATURE-056 — Sticky Recap Pill Nav (client island).
 *
 * IntersectionObserver scroll-spy → active state per section.
 * BR-56-08: sticky pill nav as 'use client' island; rest of page stays Server Component.
 * Bundle target <5KB gzipped (Perf SLA 5.4).
 */

import { useEffect, useRef, useState } from 'react';

export interface StickyRecapNavSection {
  id: string;
  label: string;
}

export interface StickyRecapNavCourse {
  /** Display label (e.g., "21KM" or "Trail 50Km"). */
  label: string;
  /** Anchor ID to scroll to (e.g., "course-21K"). Set by page when rendering
   * per-course podium blocks. */
  anchorId: string;
}

export interface StickyRecapNavProps {
  sections: StickyRecapNavSection[];
  /**
   * Optional course pills. Pre-2026-05-21: read-only visual (v1 BR-56-07).
   * 2026-05-21+: clickable, scroll to per-course anchor in podium section.
   * Pass legacy `string[]` for visual-only fallback (no scroll wiring).
   */
  courses?: StickyRecapNavCourse[] | string[];
  /** Top offset for sticky position (matches header height). */
  stickyTop?: number;
}

export function StickyRecapNav({
  sections,
  courses,
  stickyTop = 56,
}: StickyRecapNavProps) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '');
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const visibleMap = new Map<string, number>();

    const updateActive = (): void => {
      let bestId = '';
      let bestRatio = 0;
      visibleMap.forEach((ratio, id) => {
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestId = id;
        }
      });
      if (bestId && bestId !== activeId) setActiveId(bestId);
    };

    // Build merged list of IDs to track: top-level sections + course anchors
    // so course pills highlight when scrolled into view.
    const courseAnchors: string[] = (() => {
      if (!courses || courses.length === 0) return [];
      if (typeof courses[0] === 'string') {
        return (courses as string[]).map((l) => `course-${l}`);
      }
      return (courses as StickyRecapNavCourse[]).map((c) => c.anchorId);
    })();
    const idsToObserve: string[] = [
      ...sections.map((s) => s.id),
      ...courseAnchors,
    ];

    idsToObserve.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            visibleMap.set(id, e.intersectionRatio);
          });
          updateActive();
        },
        {
          rootMargin: `-${stickyTop + 80}px 0px -40% 0px`,
          threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
        },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => {
      observers.forEach((o) => o.disconnect());
    };
    // activeId intentionally omitted — updates trigger from observer callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, courses, stickyTop]);

  const handleClick = (
    e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>,
    id: string,
  ): void => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      const top =
        el.getBoundingClientRect().top + window.scrollY - (stickyTop + 12);
      window.scrollTo({ top, behavior: 'smooth' });
      setActiveId(id);
    }
  };

  // Normalize courses prop: legacy string[] → no-op visual; new object[]
  // → clickable. Strings get pseudo-anchor `course-${label}` for graceful
  // upgrade if podium has matching id (page wires id="course-${label}").
  const normalizedCourses: StickyRecapNavCourse[] | null = (() => {
    if (!courses || courses.length === 0) return null;
    if (typeof courses[0] === 'string') {
      return (courses as string[]).map((label) => ({
        label,
        anchorId: `course-${label}`,
      }));
    }
    return courses as StickyRecapNavCourse[];
  })();

  return (
    <div
      ref={containerRef}
      className="sticky z-30 border-b border-stone-200"
      style={{
        top: stickyTop,
        background: 'rgba(250,248,245,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 md:px-8 py-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        {sections.map((s) => {
          const active = s.id === activeId;
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => handleClick(e, s.id)}
              className={`px-4 py-1.5 rounded-full font-body font-extrabold text-[12px] tracking-wide whitespace-nowrap transition-all duration-150 ${
                active
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'text-stone-500 border border-stone-300 hover:text-stone-900 hover:border-stone-500'
              }`}
            >
              {s.label}
            </a>
          );
        })}
        {normalizedCourses ? (
          <>
            <div className="flex-1" />
            <div
              className="hidden sm:flex items-center gap-1 p-1 rounded-full bg-stone-100"
              aria-label="Cự ly trong giải"
            >
              {normalizedCourses.map((c, i) => {
                // 2026-05-21: pills are clickable — scroll to course anchor.
                // Active state: ID matches scroll-spy current OR first pill
                // default until user scrolls.
                const isActive = activeId === c.anchorId || (i === 0 && !normalizedCourses.some((x) => activeId === x.anchorId));
                return (
                  <button
                    type="button"
                    key={`${c.label}-${i}`}
                    onClick={(e) => handleClick(e, c.anchorId)}
                    className={`px-3 py-1 rounded-full font-mono font-bold text-[11px] whitespace-nowrap transition-all duration-150 cursor-pointer ${
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
          </>
        ) : null}
      </div>
    </div>
  );
}
