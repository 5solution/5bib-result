/**
 * F-007 Item #1 — Reusable wizard step indicator.
 *
 * Pure presentational Server Component (no client hooks). Render N steps
 * with state-coloured circles + connector lines. Designed for CourseDialog
 * (Cơ bản → Discover RR → Upload GPX → Manual drag) and reusable by future
 * F-008 Readiness / F-009 Kiosk wizards.
 *
 * Perf budget: <16ms render (BR-UX-30) — Tailwind only, no framer-motion.
 */

import type { ReactElement } from 'react';

export type StepState = 'done' | 'pending' | 'active' | 'blocked';

export interface Step {
  /** VN display label, e.g. "Cơ bản". */
  label: string;
  /** Visual state — drives colour + icon. */
  state: StepState;
  /** Optional helper / tooltip text under the label. */
  hint?: string;
}

export interface StepIndicatorProps {
  steps: Step[];
  /** Optional aria-label for the entire group (defaults to "Tiến trình"). */
  ariaLabel?: string;
}

const stateStyles: Record<
  StepState,
  { bg: string; fg: string; border: string; icon: string; ring?: string }
> = {
  done: {
    bg: 'bg-emerald-500',
    fg: 'text-white',
    border: 'border-emerald-500',
    icon: '✓',
  },
  pending: {
    bg: 'bg-stone-100',
    fg: 'text-stone-500',
    border: 'border-stone-300',
    icon: '·',
  },
  active: {
    bg: 'bg-blue-600',
    fg: 'text-white',
    border: 'border-blue-600',
    icon: '▶',
    ring: 'ring-2 ring-blue-200',
  },
  blocked: {
    bg: 'bg-amber-500',
    fg: 'text-white',
    border: 'border-amber-500',
    icon: '⚠',
  },
};

const connectorColor: Record<StepState, string> = {
  done: 'bg-emerald-500',
  pending: 'bg-stone-200',
  active: 'bg-blue-200',
  blocked: 'bg-amber-200',
};

export function StepIndicator({
  steps,
  ariaLabel = 'Tiến trình',
}: StepIndicatorProps): ReactElement {
  return (
    <ol
      aria-label={ariaLabel}
      className="flex w-full flex-wrap items-center gap-x-1 gap-y-2 py-2"
    >
      {steps.map((step, i) => {
        const s = stateStyles[step.state];
        const isLast = i === steps.length - 1;
        // Connector inherits colour from PRIOR step (ie. `step.state`) so that
        // a "done" step paints its trailing line green even if the next step
        // is still pending.
        const connector = connectorColor[step.state];
        return (
          <li
            key={`${i}-${step.label}`}
            className="flex items-center gap-1"
            aria-current={step.state === 'active' ? 'step' : undefined}
          >
            <div className="flex items-center gap-2">
              <span
                className={[
                  'inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition-colors',
                  s.bg,
                  s.fg,
                  s.border,
                  s.ring ?? '',
                ].join(' ')}
                aria-hidden="true"
              >
                {step.state === 'done' || step.state === 'blocked' || step.state === 'active'
                  ? s.icon
                  : i + 1}
              </span>
              <div className="flex flex-col leading-tight">
                <span
                  className={[
                    'text-xs font-semibold',
                    step.state === 'pending'
                      ? 'text-stone-500'
                      : 'text-stone-800',
                  ].join(' ')}
                >
                  {`${i + 1}. ${step.label}`}
                </span>
                {step.hint ? (
                  <span className="text-[11px] text-stone-500">{step.hint}</span>
                ) : null}
              </div>
            </div>
            {!isLast ? (
              <span
                aria-hidden="true"
                className={[
                  'mx-2 hidden h-[2px] w-10 rounded sm:inline-block',
                  connector,
                ].join(' ')}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
