'use client';

/**
 * F-014 BR-AS-01 — 9-status renderer with WCAG AA contrast tones.
 *
 * Tones live in `athletes.constant.ts` to keep color+label sync. Pulse
 * indicator on LIVE only (BR-AS-01 race-day visual signal).
 *
 * Usage:
 *   <StatusBadge status="LIVE" />
 *   <StatusBadge status={derivedStatus} className="ml-2" />
 */

import { STATUS_TONES, type AthleteStatus } from '../athletes.constant';
import { ATHLETES_VN } from '../athletes.microcopy';

interface StatusBadgeProps {
  status: AthleteStatus;
  /** Optional override Tailwind classes (e.g., size variants in dense tables). */
  className?: string;
  /** When true, render only the dot + short label (compact table cells). */
  compact?: boolean;
}

export function StatusBadge({ status, className, compact }: StatusBadgeProps) {
  const tone = STATUS_TONES[status];
  if (!tone) {
    // Defensive — should never hit if deriveAthleteStatus respects enum.
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-slate-100 text-slate-600 border-slate-300"
        title={status}
      >
        {status}
      </span>
    );
  }
  return (
    <span
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border',
        tone.bg,
        tone.text,
        tone.border,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      title={ATHLETES_VN.statusFullLabel[status]}
      aria-label={ATHLETES_VN.statusFullLabel[status]}
      data-testid={`status-badge-${status}`}
    >
      {tone.pulse && (
        <span
          className="size-1.5 rounded-full bg-current animate-pulse"
          aria-hidden="true"
        />
      )}
      <span>{compact ? status : tone.label}</span>
    </span>
  );
}

export default StatusBadge;
