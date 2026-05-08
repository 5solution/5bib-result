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

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Info, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  forceRefreshCommandCenter,
  getDashboardSnapshot,
  HttpError,
  type ForceRefreshResponse,
} from '@/lib/timing-alert-api';
import { vnLabel } from '@/lib/vn-microcopy';
import { LiveLeaderboardTable } from './command-center/LiveLeaderboardTable';
import { SummaryCardsRow } from './command-center/SummaryCardsRow';
import { AthleteFlowChart } from './command-center/AthleteFlowChart';
import { AlertFeedPanel } from './command-center/AlertFeedPanel';

/**
 * F-007 Item #5 — Force Refresh inline-feedback state machine.
 * idle → loading → success(2s flash) → idle
 *      → rateLimited(countdown N s) → idle
 *      → racing(message) → idle
 *      → serverError(toast fallback) → idle
 */
type RefreshState =
  | 'idle'
  | 'loading'
  | 'success'
  | 'rateLimited'
  | 'racing'
  | 'serverError';

export function CockpitTab({ raceId }: { raceId: string }) {
  const router = useRouter();
  const [pollInterval, setPollInterval] = useState<number>(30);

  // F-007 Item #5 — inline feedback state instead of toast for 4xx outcomes.
  // 5xx still falls back to toast (rare, noisy by design).
  const [refreshState, setRefreshState] = useState<RefreshState>('idle');
  const [retryAfterSec, setRetryAfterSec] = useState(0);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [lastSyncTs, setLastSyncTs] = useState<number | null>(null);
  const successFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const qc = useQueryClient();

  const snapshot = useQuery({
    queryKey: ['dashboard-snapshot', raceId],
    queryFn: () => getDashboardSnapshot(raceId),
    enabled: !!raceId,
    refetchInterval: pollInterval * 1000,
  });

  /**
   * F-005 BR-CC-10 / F-007 Item #5 — Force Refresh mutation with inline
   * feedback. 4xx outcomes (409 racing, 429 rate-limit) render inline next to
   * the button with a 1Hz countdown; 5xx falls back to a toast.
   */
  const forceRefreshMutation = useMutation<ForceRefreshResponse, unknown>({
    mutationFn: () => {
      setRefreshState('loading');
      setRefreshMessage(null);
      return forceRefreshCommandCenter(raceId);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
      setLastSyncTs(Date.now());
      if (data.refreshed) {
        setRefreshState('success');
        setRefreshMessage(data.message);
        // 2s flash → revert to idle (BR-UX-17 inline success window).
        if (successFlashRef.current) clearTimeout(successFlashRef.current);
        successFlashRef.current = setTimeout(() => {
          setRefreshState('idle');
          setRefreshMessage(null);
        }, 2000);
      } else {
        setRefreshState('idle');
        setRefreshMessage(data.message);
      }
    },
    onError: (err) => {
      if (err instanceof HttpError && err.status === 429) {
        // HttpError currently doesn't expose Retry-After header — fall back
        // to BR-CC-10 default cooldown of 30s. (Future enhancement: enrich
        // HttpError with response headers.)
        setRefreshState('rateLimited');
        setRetryAfterSec(30);
        setRefreshMessage(null);
        return;
      }
      if (err instanceof HttpError && err.status === 409) {
        setRefreshState('racing');
        setRefreshMessage('Race đang refresh, đợi…');
        return;
      }
      // 5xx fallback toast (rare).
      const msg =
        err instanceof Error ? err.message : 'Force Refresh thất bại';
      setRefreshState('serverError');
      toast.error(`Lỗi: ${msg}`);
      setTimeout(() => setRefreshState('idle'), 4000);
    },
  });

  // F-007 Item #5 — 1Hz rate-limit countdown. Exit when reaches 0.
  useEffect(() => {
    if (refreshState !== 'rateLimited' || retryAfterSec <= 0) return;
    const id = setInterval(() => {
      setRetryAfterSec((s) => {
        if (s <= 1) {
          setRefreshState('idle');
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [refreshState, retryAfterSec]);

  // Cleanup success-flash timer on unmount.
  useEffect(() => {
    return () => {
      if (successFlashRef.current) clearTimeout(successFlashRef.current);
    };
  }, []);

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
      {/* F-008 v2 BR-CC2-31 — Deprecation banner cho F-005 sub-page tree
          (Cockpit + Alerts + Trao giải). 30-day window before hard-delete.
          Middleware redirects /timing-alerts/cockpit → /command-center,
          /timing-alerts/alerts → /command-center?view=alerts,
          /timing-alerts/podium → /awards. Banner shown when sub-tabs mounted
          via the legacy 3-tab page. */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border px-4 py-3"
        style={{
          background: '#FEF3C7',
          borderColor: '#FCD34D',
          color: '#92400E',
        }}
        role="status"
        aria-live="polite"
        data-testid="f008-v2-cockpit-deprecation-banner"
      >
        <div className="flex items-start gap-2.5 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <strong className="font-bold">Trang này sẽ được thay thế.</strong>{' '}
            Chuyển sang tab <strong>Command Center</strong> trên shell race-ops
            9-tab — đã có Sound toggle, Reset modal, SSE realtime, Fullscreen
            mode, và drill-in alerts qua Alert Feed.
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 border-amber-700 bg-white text-amber-900 hover:bg-amber-100"
          onClick={() => router.push(`/races/${raceId}/command-center`)}
        >
          Chuyển ngay
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ─── Unified Header ─── */}
      <CommandHeader
        race={race}
        elapsedSec={elapsedSec}
        stale={stale}
        pollInterval={pollInterval}
        setPollInterval={setPollInterval}
        onForceRefresh={() => forceRefreshMutation.mutate()}
        refreshing={forceRefreshMutation.isPending}
        refreshState={refreshState}
        retryAfterSec={retryAfterSec}
        refreshMessage={refreshMessage}
        lastSyncTs={lastSyncTs}
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

      {/* F-007 Item #8 — REMOVED dead Discovery dialog per BR-CC-10. The
          original `<CheckpointDiscoveryDialog>` was wired to a `discoveryCourse`
          state that no other code ever set → the dialog could never open. The
          live discovery flow now lives in the race detail edit form via
          `DiscoverPreviewPanel`. */}
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
  // F-007 Item #5 — inline feedback props.
  refreshState: RefreshState;
  retryAfterSec: number;
  refreshMessage: string | null;
  lastSyncTs: number | null;
}

function CommandHeader({
  race,
  elapsedSec,
  stale,
  pollInterval,
  setPollInterval,
  onForceRefresh,
  refreshing,
  refreshState,
  retryAfterSec,
  refreshMessage,
  lastSyncTs,
}: CommandHeaderProps) {
  // F-007 Item #5 — countdown-driven UI: when next auto-sync is, derived from
  // pollInterval and lastSyncTs (or generatedAt elapsedSec as a proxy).
  const nextAutoSyncIn = Math.max(
    0,
    pollInterval -
      (lastSyncTs
        ? Math.floor((Date.now() - lastSyncTs) / 1000)
        : elapsedSec),
  );
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
        <div className="flex flex-col items-end gap-1">
          <Button
            onClick={onForceRefresh}
            disabled={refreshing || refreshState === 'rateLimited'}
            variant="outline"
            size="sm"
            className="h-9 gap-2"
            title={vnLabel('force-refresh')}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
            />
            {refreshing ? 'Đang cập nhật…' : vnLabel('force-refresh')}
          </Button>
          {/* F-007 Item #5 — inline feedback: replaces toasts for 4xx outcomes
              and provides ambient "next auto-sync in" countdown so MC always
              knows freshness. */}
          <span
            className="text-[11px]"
            style={{
              fontFamily: 'var(--font-mono)',
              color:
                refreshState === 'rateLimited' || refreshState === 'racing'
                  ? 'var(--5s-magenta, #FF0E65)'
                  : refreshState === 'success'
                    ? 'var(--5s-success, #16A34A)'
                    : 'var(--5s-text-muted, #78716c)',
            }}
            aria-live="polite"
          >
            {refreshState === 'rateLimited'
              ? `Đợi ${retryAfterSec}s rồi thử lại`
              : refreshState === 'racing'
                ? (refreshMessage ?? 'Race đang refresh, đợi…')
                : refreshState === 'success'
                  ? `✓ ${refreshMessage ?? 'Đã cập nhật'}`
                  : `Tự động sau ${nextAutoSyncIn}s`}
          </span>
        </div>
      </div>
    </header>
  );
}

// ─────────── Status pill ───────────

function StatusPill({ status }: { status: string }) {
  // F-007 Item #4 — VN labels via vnLabel() (single source of truth).
  const map: Record<
    string,
    { bg: string; fg: string; border: string; live?: boolean }
  > = {
    live: { bg: '#FEE2E2', fg: '#991B1B', border: '#FCA5A5', live: true },
    ended: { bg: '#E7E5E4', fg: '#44403C', border: '#D6D3D1' },
    pre_race: { bg: '#FEF3C7', fg: '#92400E', border: '#FCD34D' },
    draft: { bg: '#F3F0EB', fg: '#44403C', border: '#D6D3D1' },
  };
  const styleCfg = map[status] ?? {
    bg: '#F3F0EB',
    fg: '#44403C',
    border: '#D6D3D1',
  };
  const cfg = {
    ...styleCfg,
    label: vnLabel(status, status.toUpperCase()),
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
