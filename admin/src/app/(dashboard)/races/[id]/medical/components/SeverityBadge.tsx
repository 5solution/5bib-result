'use client';

/**
 * F-018 BR-MI-03 — accessibility-paired severity badge.
 * Color + numeric `[N]` per WCAG AA (color must NEVER be sole indicator).
 */
import { Severity, SEVERITY_COLORS } from '../medical.constant';
import { SEVERITY_SHORT_VN } from '../medical.microcopy';
import { cn } from '@/lib/utils';

interface SeverityBadgeProps {
  severity: Severity;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  pulsing?: boolean;
}

export function SeverityBadge({
  severity,
  size = 'md',
  showLabel = true,
  pulsing = false,
}: SeverityBadgeProps) {
  const colors = SEVERITY_COLORS[severity];
  const sizeClass =
    size === 'sm'
      ? 'px-2 py-0.5 text-xs'
      : size === 'lg'
      ? 'px-4 py-2 text-base'
      : 'px-3 py-1 text-sm';

  return (
    <span
      role="status"
      aria-label={`Severity ${severity} - ${SEVERITY_SHORT_VN[severity]}`}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md font-semibold',
        colors.bg,
        colors.text,
        sizeClass,
        pulsing && severity === 5 && 'animate-pulse ring-2',
        pulsing && severity === 5 && colors.ring,
      )}
    >
      <span className="font-mono tabular-nums">[{severity}]</span>
      {showLabel ? <span>{SEVERITY_SHORT_VN[severity]}</span> : null}
    </span>
  );
}
