'use client';
import { useAgPodium } from '../hooks/useAgPodium';
import { useAnomalyWarnings } from '../hooks/useAnomalyWarnings';
import { AGPodiumCard } from './AGPodiumCard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { VN } from '../awards.microcopy';
import type { PodiumState } from '../awards.constant';

interface Props {
  raceId: string;
  filter: { courseId?: string; gender?: 'M' | 'F'; state?: PodiumState };
}

export function AGPodiumGrid({ raceId, filter }: Props) {
  const { data, isLoading, isError, error } = useAgPodium(raceId, filter);
  const { data: anomalies } = useAnomalyWarnings(raceId, { courseId: filter.courseId });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-64 w-full" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-800">
          {VN.ERROR_LOAD}: {(error as Error)?.message ?? 'unknown'}
        </CardContent>
      </Card>
    );
  }
  if (!data || data.items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-stone-600">
          {VN.EMPTY_NO_ATHLETES}
        </CardContent>
      </Card>
    );
  }

  const blocking = anomalies?.blockingCount ?? 0;
  const blockingMessage = blocking > 0 ? VN.LOCK_DISABLED_TIP(blocking) : undefined;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.items.map((p) => (
        <AGPodiumCard
          key={p.id}
          podium={p}
          raceId={raceId}
          blockingMessage={blockingMessage}
        />
      ))}
    </div>
  );
}
