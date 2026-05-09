'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAnomalyWarnings } from '../hooks/useAnomalyWarnings';
import { AnomalyWarningRow } from './AnomalyWarningRow';
import type { Tier } from '../awards.constant';

interface Props {
  raceId: string;
  courseId?: string;
  onClose?: () => void;
}

/**
 * F-019 anomaly inbox (drawer / panel). Groups by tier with collapse Mức 3.
 * Pattern reference: F-018 IncidentList.
 */
export function AnomalyInbox({ raceId, courseId, onClose }: Props) {
  const [filterTier, setFilterTier] = useState<Tier | 'all'>('all');
  const { data, isLoading } = useAnomalyWarnings(raceId, {
    courseId,
    tier: filterTier === 'all' ? undefined : filterTier,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-base">
          Cảnh báo bất thường ({data?.total ?? 0})
        </CardTitle>
        <div className="flex flex-wrap gap-1">
          {(['all', 1, 2, 3] as const).map((t) => (
            <Button
              key={String(t)}
              size="sm"
              variant={filterTier === t ? 'default' : 'outline'}
              onClick={() => setFilterTier(t)}
            >
              {t === 'all' ? 'Tất cả' : `Mức ${t}`}
            </Button>
          ))}
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              Đóng
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <div className="text-sm text-stone-500">Đang tải...</div>}
        {!isLoading && data && data.items.length === 0 && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            Không có cảnh báo bất thường — sẵn sàng lock podium ✓
          </div>
        )}
        {data?.items.map((w) => (
          <AnomalyWarningRow key={w.id} warning={w} raceId={raceId} />
        ))}
      </CardContent>
    </Card>
  );
}
