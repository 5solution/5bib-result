'use client';

/**
 * F-005 — Race Day Command Center (was Cockpit, F-002).
 *
 * Visual polish round 2026-05-05 — applies design canvas Artboard 3:
 * - 1 unified header (eyebrow + race title + status pill + sync info + poll + refresh)
 * - SummaryCardsRow (5 metrics)
 * - 2-col grid: AthleteFlowChart (60%) + LiveLeaderboardTable (40%)
 * - AlertFeedPanel full width
 *
 * REMOVED in polish round (3 duplicates):
 * - Hero Stats grid (5 cards) — duplicate of SummaryCardsRow
 * - Freshness blue strip + RaceElapsedClock standalone — consolidated into unified header
 * - Course breakdown grid ("Cài đặt theo cự ly") — deferred per F-006 Course Map
 *
 * **Note:** Component file name kept as `CockpitTab.tsx` per Manager directive.
 *
 * **Data:** `dashboard-snapshot` endpoint gộp tất cả sources, refetch 30s + on SSE.
 * Query key `['dashboard-snapshot', raceId]` GIỮ NGUYÊN — backward compat F-002.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  forceRefreshCommandCenter,
  getDashboardSnapshot,
  HttpError,
  type ForceRefreshResponse,
} from '@/lib/timing-alert-api';
import { CheckpointDiscoveryDialog } from './CheckpointDiscoveryDialog';
import { LiveLeaderboardTable } from './command-center/LiveLeaderboardTable';
import { SummaryCardsRow } from './command-center/SummaryCardsRow';
import { AthleteFlowChart } from './command-center/AthleteFlowChart';
import { AlertFeedPanel } from './command-center/AlertFeedPanel';

export function CockpitTab({ raceId }: { raceId: string }) {
  const [discoveryCourse, setDiscoveryCourse] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [pollInterval, setPollInterval] = useState<number>(30);

  const qc = useQueryClient();

  const snapshot = useQuery({
    queryKey: ['dashboard-snapshot', raceId],
    queryFn: () => getDashboardSnapshot(raceId),
    enabled: !!raceId,
    refetchInterval: pollInterval * 1000,
  });

  /**
   * F-005 BR-CC-10 — Force Refresh mutation.
   * onSuccess: invalidate dashboard-snapshot query → fresh leaderboard + summary.
   * onError 409: magenta toast (PRD `--5sport-magenta` #FF0E65) — user spam guard 30s.
   * onError other: red destructive toast.
   */
  const forceRefreshMutation = useMutation<ForceRefreshResponse, unknown>({
    mutationFn: () => forceRefreshCommandCenter(raceId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
      if (data.refreshed) {
        toast.success(data.message);
      } else {
        toast(data.message, { duration: 4000 });
      }
    },
    onError: (err) => {
      if (err instanceof HttpError && err.status === 409) {
        toast.error('Bạn vừa refresh, đợi 30s rồi thử lại', {
          style: { background: '#FF0E65', color: '#fff' },
        });
        return;
      }
      const msg =
        err instanceof Error ? err.message : 'Force Refresh thất bại';
      toast.error(`Lỗi: ${msg}`);
    },
  });

  if (snapshot.isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }
  if (snapshot.isError || !snapshot.data) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-800">
          ❌ Không lấy được dashboard snapshot:{' '}
          {(snapshot.error as Error)?.message ?? 'unknown'}
        </CardContent>
      </Card>
    );
  }

  // recentActivity vẫn còn trên snapshot.data nhưng KHÔNG destructure ở đây —
  // AlertFeedPanel refactor 2026-05-05 tự fetch listTimingAlerts(OPEN) thay vì
  // dùng recentActivity (poll noise spam mỗi 30s × N courses).
  const {
    race,
    checkpointProgression,
    liveLeaderboard,
    summary,
  } = snapshot.data;

  const generatedAt = snapshot.data.generatedAt;
  const elapsedSec = generatedAt
    ? Math.floor((Date.now() - new Date(generatedAt).getTime()) / 1000)
    : 0;
  const stale = elapsedSec > 300;

  return (
    <div
      className="-mx-4 -mt-4 space-y-4 px-4 pt-4 pb-8"
      style={{ background: 'var(--5s-bg)' }}
    >
      {/* ─── Unified Header ─── */}
      <CommandHeader
        race={race}
        elapsedSec={elapsedSec}
        stale={stale}
        pollInterval={pollInterval}
        setPollInterval={setPollInterval}
        onForceRefresh={() => forceRefreshMutation.mutate()}
        refreshing={forceRefreshMutation.isPending}
      />

      {/* ─── Summary Cards Row (5 metrics) ─── */}
      <SummaryCardsRow summary={summary} />

      {/* ─── Main 2-col grid ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AthleteFlowChart progression={checkpointProgression} />
        </div>
        <div className="lg:col-span-2">
          <LiveLeaderboardTable leaderboard={liveLeaderboard} />
        </div>
      </div>

      {/* ─── Timing Alert Feed ─── */}
      <AlertFeedPanel raceId={raceId} />

      {/* Discovery dialog — KEEP for F-002 auto-derive (TODO F-006 Course Map sẽ thay) */}
      <CheckpointDiscoveryDialog
        raceId={raceId}
        courseId={discoveryCourse?.id ?? null}
        courseName={discoveryCourse?.name ?? ''}
        open={!!discoveryCourse}
        onOpenChange={(o) => {
          if (!o) setDiscoveryCourse(null);
        }}
      />
    </div>
  );
}

// ─────────── Unified header ───────────

interface CommandHeaderProps {
  race: {
    title: string;
    status: string;
    startedAt: string | null;
    startedAtSource:
      | 'status_history'
      | 'course_start_time'
      | 'recent_history'
      | null;
  };
  elapsedSec: number;
  stale: boolean;
  pollInterval: number;
  setPollInterval: (v: number) => void;
  onForceRefresh: () => void;
  refreshing: boolean;
}

function CommandHeader({
  race,
  elapsedSec,
  stale,
  pollInterval,
  setPollInterval,
  onForceRefresh,
  refreshing,
}: CommandHeaderProps) {
  return (
    <header
      className="flex flex-wrap items-center justify-between gap-4 rounded-[14px] border bg-white p-4"
      style={{
        borderColor: 'var(--5s-border)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      <div className="min-w-[280px] flex-1">
        <div
          className="text-[11px] font-extrabold uppercase tracking-[.14em] text-stone-500"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Race · Command Center
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1
            className="text-2xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {race.title}
          </h1>
          <StatusPill status={race.status} />
        </div>
        <ElapsedClockInline
          startedAt={race.startedAt}
          startedAtSource={race.startedAtSource}
          status={race.status}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className="inline-flex items-center gap-2 text-xs"
          style={{
            color: stale ? 'var(--5s-magenta)' : 'var(--5s-text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: stale ? 'var(--5s-magenta)' : 'var(--5s-success)',
              animation: stale ? 'none' : 'ro-blink 2s infinite',
            }}
          />
          Last sync: {elapsedSec}s ago
        </span>
        <label
          className="inline-flex items-center gap-2 rounded-md border bg-white px-3 text-xs"
          style={{
            height: 34,
            borderColor: 'var(--5s-border)',
          }}
        >
          <span className="text-stone-500">Poll</span>
          <select
            value={pollInterval}
            onChange={(e) => setPollInterval(Number(e.target.value))}
            className="cursor-pointer border-none bg-transparent text-xs font-bold outline-none"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            <option value={60}>60s</option>
            <option value={90}>90s</option>
            <option value={120}>120s</option>
            <option value={300}>300s</option>
          </select>
        </label>
        <Button
          onClick={onForceRefresh}
          disabled={refreshing}
          variant="outline"
          size="sm"
          className="h-9 gap-2"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
          />
          {refreshing ? 'Đang refresh...' : 'Force Refresh'}
        </Button>
      </div>
    </header>
  );
}

// ─────────── Status pill ───────────

function StatusPill({ status }: { status: string }) {
  const map: Record<
    string,
    { bg: string; fg: string; border: string; label: string; live?: boolean }
  > = {
    live: {
      bg: '#FEE2E2',
      fg: '#991B1B',
      border: '#FCA5A5',
      label: 'LIVE',
      live: true,
    },
    ended: {
      bg: '#E7E5E4',
      fg: '#44403C',
      border: '#D6D3D1',
      label: 'ENDED',
    },
    pre_race: {
      bg: '#FEF3C7',
      fg: '#92400E',
      border: '#FCD34D',
      label: 'PRE-RACE',
    },
    draft: {
      bg: '#F3F0EB',
      fg: '#44403C',
      border: '#D6D3D1',
      label: 'DRAFT',
    },
  };
  const cfg = map[status] ?? {
    bg: '#F3F0EB',
    fg: '#44403C',
    border: '#D6D3D1',
    label: status.toUpperCase(),
  };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider"
      style={{
        background: cfg.bg,
        color: cfg.fg,
        borderColor: cfg.border,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: cfg.fg,
          animation: cfg.live ? 'ro-blink 1.4s infinite' : 'none',
        }}
      />
      {cfg.label}
    </span>
  );
}

// ─────────── Elapsed clock inline ───────────

/**
 * Inline elapsed clock ticking 1Hz from race.startedAt.
 * Compact display embedded in unified header (replaces standalone block).
 */
function ElapsedClockInline({
  startedAt,
  startedAtSource,
  status,
}: {
  startedAt: string | null;
  startedAtSource:
    | 'status_history'
    | 'course_start_time'
    | 'recent_history'
    | null;
  status: string;
}) {
  const [tickCount, setTickCount] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    if (status === 'ended') return;
    const interval = setInterval(() => setTickCount((c) => c + 1), 1000);
    return () => clearInterval(interval);
  }, [startedAt, status]);
  void tickCount;

  if (!startedAt) {
    const isLiveButMissing = status === 'live' || status === 'ended';
    return (
      <div className="mt-2 text-xs text-stone-600">
        {isLiveButMissing
          ? '⚠️ Race live nhưng chưa config startedAt — set race.startDate + course.startTime'
          : '⏳ Race chưa bắt đầu'}
      </div>
    );
  }

  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const hh = Math.floor(elapsedSec / 3600);
  const mm = Math.floor((elapsedSec % 3600) / 60);
  const ss = elapsedSec % 60;
  const formatted = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

  const sourceLabel =
    startedAtSource === 'status_history'
      ? '✓ Admin transition'
      : startedAtSource === 'course_start_time'
        ? '≈ Theo giờ start course'
        : startedAtSource === 'recent_history'
          ? '⚠️ Ước tính từ history'
          : '';

  return (
    <div className="mt-2 flex items-center gap-3 text-xs text-stone-600">
      <span className="text-stone-500">⏱ Elapsed</span>
      <span
        className="text-base font-bold tracking-tight text-stone-900"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {formatted}
      </span>
      {sourceLabel && (
        <span className="text-[11px] text-stone-500">{sourceLabel}</span>
      )}
    </div>
  );
}
