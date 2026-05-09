'use client';
import { Badge } from '@/components/ui/badge';
import type { PodiumState } from '../awards.constant';
import { VN } from '../awards.microcopy';

const TONES: Record<PodiumState, string> = {
  RAW_RESULT: 'bg-stone-100 text-stone-700',
  AG_COMPUTED: 'bg-blue-100 text-blue-800',
  WARNINGS_GENERATED: 'bg-amber-100 text-amber-800',
  BTC_REVIEW: 'bg-amber-100 text-amber-800',
  PODIUM_DRAFT: 'bg-orange-100 text-orange-800',
  PODIUM_LOCKED: 'bg-violet-100 text-violet-800',
  PODIUM_PUBLISHED: 'bg-emerald-100 text-emerald-800',
  DISPUTE_OPEN: 'bg-red-100 text-red-800',
  PODIUM_FINAL: 'bg-emerald-200 text-emerald-900 font-bold',
};

export function StateBadge({ state }: { state: PodiumState }) {
  return (
    <Badge variant="outline" className={`${TONES[state]} border-none`}>
      {VN.STATE_LABELS[state]}
    </Badge>
  );
}
