'use client';

/**
 * F-014 BR-AS-19 — Empty states.
 *
 * Two flavors:
 *   1. `variant="zero-data"` — no athletes at all (post-fetch).
 *   2. `variant="zero-match"` — filters returned no matches.
 *   3. `variant="draft-guard"` — race in draft, soft-block per F-011.
 */

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Users, FileX, Lock } from 'lucide-react';
import { ATHLETES_VN } from '../athletes.microcopy';

interface AthletesEmptyStateProps {
  variant: 'zero-data' | 'zero-match' | 'draft-guard';
  raceId: string;
  onResetFilters?: () => void;
}

export function AthletesEmptyState({
  variant,
  raceId,
  onResetFilters,
}: AthletesEmptyStateProps) {
  if (variant === 'draft-guard') {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center"
        data-testid="empty-state-draft-guard"
      >
        <Lock className="size-10 text-muted-foreground" />
        <h3 className="text-base font-semibold">{ATHLETES_VN.guardDraftTitle}</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          {ATHLETES_VN.guardDraftDescription}
        </p>
        <Link href={`/races/${raceId}/settings#race-meta`}>
          <Button size="sm" variant="outline">
            Mở cài đặt giải
          </Button>
        </Link>
      </div>
    );
  }
  if (variant === 'zero-match') {
    return (
      <div
        role="status"
        className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center"
        data-testid="empty-state-zero-match"
      >
        <FileX className="size-10 text-muted-foreground" />
        <h3 className="text-base font-semibold">{ATHLETES_VN.zeroMatchTitle}</h3>
        <p className="max-w-md text-sm text-muted-foreground">
          {ATHLETES_VN.zeroMatchDescription}
        </p>
        {onResetFilters && (
          <Button size="sm" variant="outline" onClick={onResetFilters}>
            {ATHLETES_VN.zeroMatchAction}
          </Button>
        )}
      </div>
    );
  }
  // zero-data
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 px-6 py-16 text-center"
      data-testid="empty-state-zero-data"
    >
      <Users className="size-10 text-muted-foreground" />
      <h3 className="text-base font-semibold">{ATHLETES_VN.emptyTitle}</h3>
      <p className="max-w-md text-sm text-muted-foreground">
        {ATHLETES_VN.emptyDescription}
      </p>
      <Link href={`/races/${raceId}/master-data`}>
        <Button size="sm" variant="outline">
          {ATHLETES_VN.emptyActionMaster}
        </Button>
      </Link>
    </div>
  );
}

export default AthletesEmptyState;
