'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getChipStats } from '@/lib/chip-verification-api';

interface Props {
  raceId: number;
}

export function ChipMappingStats({ raceId }: Props) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['chip-stats', raceId],
    queryFn: () => getChipStats(raceId),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-700">
          Lỗi tải stats: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  const stats = data ?? {
    total_mappings: 0,
    total_verified: 0,
    total_attempts: 0,
    recent_5m: 0,
  };

  const items = [
    { label: 'Total mappings', value: stats.total_mappings, hint: 'Chip ↔ BIB' },
    {
      label: 'Verified athletes',
      value: stats.total_verified,
      hint: 'Distinct quẹt thành công',
    },
    {
      label: 'Total attempts',
      value: stats.total_attempts,
      hint: 'Bao gồm trùng',
    },
    {
      label: 'Last 5 min',
      value: stats.recent_5m,
      hint: 'Velocity check',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {it.label}
            </p>
            <p className="mt-1 text-3xl font-bold">{it.value.toLocaleString('vi-VN')}</p>
            <p className="text-xs text-muted-foreground">{it.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
