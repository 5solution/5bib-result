'use client';

import { useQuery } from '@tanstack/react-query';
import { getKioskStats } from '@/lib/chip-verify-api';

interface Props {
  token: string;
}

export function StatsCounter({ token }: Props) {
  const { data } = useQuery({
    queryKey: ['chip-stats-public', token],
    queryFn: () => getKioskStats(token),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const stats = data ?? {
    total_mappings: 0,
    total_verified: 0,
    total_attempts: 0,
    recent_5m: 0,
  };

  const pct = stats.total_mappings > 0
    ? Math.round((stats.total_verified / stats.total_mappings) * 100)
    : 0;

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Card label="Đã verify" value={stats.total_verified} accent="green" />
      <Card label="Tổng" value={stats.total_mappings} />
      <Card label="Tiến độ" value={`${pct}%`} accent="green" />
      <Card label="5 phút qua" value={stats.recent_5m} accent="blue" />
    </section>
  );
}

function Card({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: 'green' | 'blue';
}) {
  const color =
    accent === 'green'
      ? 'text-green-700'
      : accent === 'blue'
        ? 'text-blue-700'
        : 'text-stone-900';
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold tabular-nums ${color}`}>
        {typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
      </p>
    </div>
  );
}
