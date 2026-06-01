'use client';

/**
 * F-068 — Inline stats badge for the CourseTable "Tình trạng" column.
 *
 * Renders a 3-row badge stack:
 *  - rowCount badge (📊 N rows)
 *  - last sync time badge (⏱️ Sync 2 phút trước) — color green=success, red=failed
 *  - cron status badge (🔄 Auto-sync ON / 🔌 OFF / 🔵 Đang sync... / ⚠️ Sync stuck)
 *
 * Polling state shows a transient `📊 Đang xác nhận... (attempt/total)` when a
 * post-reset snapshot is in progress (BR-68-18).
 *
 * Loading state shows 3 skeleton bars per Danny chốt #6 (placeholder, never
 * flash empty).
 */
import { useEffect, useState } from 'react';
import type { CourseDataStatsDto } from '@/lib/course-data-ops-api';

export interface CourseDataStatsBadgeProps {
  stats: CourseDataStatsDto | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Optional post-reset poll progress label per BR-68-18. */
  pollProgress?: { attempt: number; total: number } | null;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Chưa sync';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Chưa sync';
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s trước`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h trước`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay} ngày trước`;
}

function formatHHmmUtcPlus7(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  // Display in Vietnam timezone (UTC+7)
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
  }).format(d);
}

export function CourseDataStatsBadge(props: CourseDataStatsBadgeProps) {
  const { stats, isLoading, isError, pollProgress } = props;

  // Re-render every 30s so "X phút trước" stays fresh while data is cached.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (isError) {
    return (
      <div className="flex flex-col gap-1 text-xs">
        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-amber-800">
          ⚠️ Lỗi tải
        </span>
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col gap-1">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const rowCountLabel = pollProgress
    ? `📊 Đang xác nhận... (${pollProgress.attempt}/${pollProgress.total})`
    : `📊 ${stats.rowCount.toLocaleString('vi-VN')} rows`;

  const syncBadgeColor =
    stats.lastSyncStatus === 'success'
      ? 'bg-emerald-100 text-emerald-800'
      : stats.lastSyncStatus === 'failed'
        ? 'bg-rose-100 text-rose-800'
        : 'bg-muted text-muted-foreground';

  let cronBadgeText: string;
  let cronBadgeColor: string;
  if (stats.cronStatus === 'in_progress') {
    cronBadgeText = '🔵 Đang sync...';
    cronBadgeColor = 'bg-sky-100 text-sky-800 animate-pulse';
  } else if (stats.cronStatus === 'disabled') {
    cronBadgeText = '🔌 Auto-sync OFF';
    cronBadgeColor = 'bg-muted text-muted-foreground';
  } else {
    cronBadgeText = '🔄 Auto-sync ON';
    cronBadgeColor = 'bg-emerald-100 text-emerald-800';
  }

  const cronTooltip =
    stats.cronStatus === 'scheduled' && stats.nextCronAt
      ? `Sync tiếp theo: ${formatHHmmUtcPlus7(stats.nextCronAt)} UTC+7`
      : stats.cronStatus === 'in_progress'
        ? 'Cron đang chạy — chờ xong'
        : stats.cronStatus === 'disabled'
          ? 'Course không có apiUrl, sẽ không được sync tự động'
          : '';

  return (
    <div
      className={`flex flex-col gap-1 text-xs ${pollProgress ? 'opacity-90' : ''}`}
    >
      <span
        className={`inline-flex w-fit items-center gap-1 rounded px-2 py-0.5 font-medium ${
          pollProgress
            ? 'bg-sky-100 text-sky-800 animate-pulse'
            : 'bg-muted text-muted-foreground'
        }`}
        title={pollProgress ? 'Polling sau reset để xác nhận data = 0' : undefined}
      >
        {rowCountLabel}
      </span>
      <span
        className={`inline-flex w-fit items-center gap-1 rounded px-2 py-0.5 ${syncBadgeColor}`}
        title={stats.lastSyncedAt ? new Date(stats.lastSyncedAt).toLocaleString('vi-VN') : 'Chưa từng sync'}
      >
        ⏱️ Sync {formatRelativeTime(stats.lastSyncedAt)}
      </span>
      <span
        className={`inline-flex w-fit items-center gap-1 rounded px-2 py-0.5 ${cronBadgeColor}`}
        title={cronTooltip}
      >
        {cronBadgeText}
      </span>
    </div>
  );
}

export default CourseDataStatsBadge;
