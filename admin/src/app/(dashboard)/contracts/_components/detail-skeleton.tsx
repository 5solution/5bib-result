"use client";

/**
 * F-024 UX-10 — Detail page loading skeleton.
 *
 * Replaces 5 plain "Đang tải..." text với skeleton matching detail layout.
 * Configurable section count.
 */
import { Skeleton } from "@/components/ui/skeleton";

interface DetailSkeletonProps {
  /** Number of skeleton sections (default 3). */
  sections?: number;
  /** Show header skeleton (back button + title)? Default true. */
  showHeader?: boolean;
}

export function DetailSkeleton({
  sections = 3,
  showHeader = true,
}: DetailSkeletonProps) {
  return (
    <div className="space-y-6 p-6">
      {showHeader && (
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-32" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      )}
      {Array.from({ length: sections }).map((_, i) => (
        <div
          key={i}
          className="space-y-3 rounded-lg border border-[var(--border,#E7E2D9)] bg-white p-4"
        >
          <Skeleton className="h-3 w-32" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
