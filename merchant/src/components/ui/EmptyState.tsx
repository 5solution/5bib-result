/**
 * F-007 Item #3 (PAUSE-M3) — Reusable empty state.
 *
 * 4-element pattern per PRD section 3.3:
 *   icon + title + (optional) description + (optional) CTA button.
 *
 * Used across 6 surfaces: F-006 CourseMapTab (no GPX, save first), drag-drop
 * dropzone, manual-mode wait state, plus public-facing race detail. Frontend
 * public side mirrors the layout inline (no shared component cross app).
 */

'use client';

import type { ReactElement, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  cta?: {
    label: string;
    onClick: () => void;
  };
  /** Optional className for outer container fine-tuning (size, height). */
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  cta,
  className,
}: EmptyStateProps): ReactElement {
  return (
    <div
      className={[
        'flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center',
        className ?? '',
      ].join(' ')}
    >
      <div
        className="text-4xl"
        aria-hidden="true"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {icon}
      </div>
      <p className="text-sm font-semibold text-stone-700">{title}</p>
      {description ? (
        <p className="max-w-md text-xs text-stone-500">{description}</p>
      ) : null}
      {cta ? (
        <Button size="sm" onClick={cta.onClick} className="mt-2">
          {cta.label}
        </Button>
      ) : null}
    </div>
  );
}
