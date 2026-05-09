'use client';

/**
 * F-014 BR-AS-23..26 — Settings sectioned-scroll layout.
 *
 * Sticky left rail with anchor links + main scrollable section area.
 * Active section highlight via `useUrlHashScroll` (IntersectionObserver).
 *
 * Mobile: rail collapses to top horizontal scroll under 1024px (BR-AS-25).
 *
 * Children are passed as section bodies; this component does NOT render
 * the section content itself — pure shell.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useUrlHashScroll } from './hooks/useUrlHashScroll';

export interface SettingsSectionDef {
  id: string;
  label: string;
  /** Vietnamese subtitle for left-rail (1-line). */
  hint?: string;
  /** Bằng `true` khi section có thay đổi chưa lưu (chấm cam BR-AS-28). */
  dirty?: boolean;
}

interface SettingsLayoutProps {
  sections: SettingsSectionDef[];
  children: ReactNode;
}

export function SettingsLayout({ sections, children }: SettingsLayoutProps) {
  const { activeId } = useUrlHashScroll(sections.map((s) => s.id));

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[200px_1fr] lg:gap-6">
      {/* ─── Sticky left rail (desktop) / horizontal scroll (mobile) ─── */}
      <aside
        className="lg:sticky lg:top-20 lg:self-start"
        aria-label="Cài đặt — danh mục"
      >
        <nav
          className="flex flex-row gap-1 overflow-x-auto rounded-xl border bg-background p-2 lg:flex-col lg:overflow-visible"
          role="tablist"
        >
          {sections.map((s) => {
            const active = activeId === s.id;
            return (
              <Link
                key={s.id}
                href={`#${s.id}`}
                role="tab"
                aria-selected={active}
                className={`flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-900'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                data-testid={`nav-${s.id}`}
              >
                <span>{s.label}</span>
                {s.dirty && (
                  <span
                    aria-label="Chưa lưu"
                    className="size-1.5 shrink-0 rounded-full bg-orange-500"
                    data-testid={`dirty-dot-${s.id}`}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ─── Main scrollable area ─── */}
      <main className="flex flex-col gap-8">{children}</main>
    </div>
  );
}

export default SettingsLayout;
