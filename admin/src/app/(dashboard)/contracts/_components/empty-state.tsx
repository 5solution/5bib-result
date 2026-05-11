"use client";

/**
 * F-024 UX-31 — Empty state với icon centered + CTA.
 *
 * Replaces 4 plain-text empty states (contract list, partners list, service
 * catalog, line-items empty).
 */
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Optional primary CTA — React node to render below text. */
  cta?: React.ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Icon className="size-12 text-stone-300" aria-hidden />
      <p className="mt-3 text-sm font-medium text-[var(--text,#1c1917)]">
        {title}
      </p>
      {description && (
        <p className="mt-1 max-w-md text-xs text-[var(--text-muted,#78716C)]">
          {description}
        </p>
      )}
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}
