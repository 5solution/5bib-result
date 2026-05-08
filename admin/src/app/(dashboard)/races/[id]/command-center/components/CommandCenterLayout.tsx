'use client';

/**
 * F-008 — Command Center orchestrator.
 *
 * Composes 7 sections into responsive grid (Tailwind grid-cols-1 lg:grid-cols-2):
 *   1. PageHero (server component, passed as prop)
 *   2. CommandCenterTopBar (Last sync + Poll dropdown + Force Refresh + Export CSV)
 *   3. SummaryCardsRow (6 cards: Racekit / Started / Finished / DNS / Miss Rate / Throughput)
 *   4. AthleteFlowChart LEFT (carryover F-005)
 *   5. LiveLeaderboardTable RIGHT (modified — MISS badge, no Top N toolbar)
 *   6. AlertFeedPanel BOTTOM-LEFT (carryover F-005 + VN labels)
 *   7. CheckpointHealthMatrix BOTTOM-RIGHT (NEW)
 *
 * Polling: TanStack Query `refetchInterval = pollIntervalSec * 1000` (BR-CC-20).
 * Cache key `['dashboard-snapshot', raceId]` REUSES F-005 (BR-CC-15 backward compat).
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  forceRefreshCommandCenter,
  getDashboardSnapshot,
  getLiveLeaderboard,
  HttpError,
  type ForceRefreshResponse,
} from '@/lib/timing-alert-api';
import {
  buildFullExportFilename,
  downloadFullCSV,
  type FullLeaderboardRow,
} from '@/lib/leaderboard-export';
import { SummaryCardsRow } from '../../timing-alerts/components/command-center/SummaryCardsRow';
import { AthleteFlowChart } from '../../timing-alerts/components/command-center/AthleteFlowChart';
import { LiveLeaderboardTable } from '../../timing-alerts/components/command-center/LiveLeaderboardTable';
import { AlertFeedPanel } from '../../timing-alerts/components/command-center/AlertFeedPanel';
import {
  CommandCenterTopBar,
  usePersistedPollInterval,
} from './CommandCenterTopBar';
import { CheckpointHealthMatrix } from './CheckpointHealthMatrix';
// F-008 v2 EXTEND additive imports
import { AlertsListView } from './AlertsListView';
import { RaceStatusPill } from './RaceStatusPill';
// F-010 BR-FC-05/06 — DNS sub-state breakdown card (additive)
import DnsBreakdownCard from './DnsBreakdownCard';
import { CheckpointDiscoveryDialog } from './CheckpointDiscoveryDialogWrapper';
import { useTimingAlertSse } from '@/lib/use-timing-alert-sse';
import { isSoundEnabled, play880Hz } from '@/lib/sound-alarm';

interface CommandCenterLayoutProps {
  raceId: string;
  raceSlug?: string;
  /** F-008 v2 — `?view=alerts` from search params triggers drill-in render. */
  viewMode?: 'dashboard' | 'alerts';
  /** F-008 v2 — race title for ResetConfirmModal. */
  raceTitle?: string;
  /** F-008 v2 — race status for ResetConfirmModal + RaceStatusPill. */
  raceStatus?: 'draft' | 'pre_race' | 'live' | 'ended';
}

export function CommandCenterLayout({
  raceId,
  raceSlug,
  viewMode = 'dashboard',
  raceTitle,
  raceStatus,
}: CommandCenterLayoutProps) {
  const [pollIntervalSec, setPollIntervalSec] = usePersistedPollInterval();
  const [retryAfterSec, setRetryAfterSec] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [activeCourseId, setActiveCourseId] = useState<string>('');
  // F-008 v2 — Discovery dialog state (course-scoped)
  const [discoveryCourse, setDiscoveryCourse] = useState<{
    courseId: string;
    courseName: string;
  } | null>(null);

  // F-008 v2 BR-CC2-17 — SSE listener body-scoped. Sound bridge: only fire
  // 880Hz when localStorage cc-sound-enabled === '1' (default ON).
  useTimingAlertSse(raceId, {
    onCriticalAlert: () => {
      if (isSoundEnabled()) play880Hz();
    },
  });

  const qc = useQueryClient();

  const snapshot = useQuery({
    queryKey: ['dashboard-snapshot', raceId],
    queryFn: () => getDashboardSnapshot(raceId),
    enabled: !!raceId,
    refetchInterval: pollIntervalSec * 1000,
  });

  // Sync activeCourseId on first data load
  useEffect(() => {
    if (
      !activeCourseId &&
      snapshot.data?.liveLeaderboard?.length &&
      snapshot.data.liveLeaderboard[0]
    ) {
      setActiveCourseId(snapshot.data.liveLeaderboard[0].courseId);
    }
  }, [snapshot.data?.liveLeaderboard, activeCourseId]);

  const forceRefreshMutation = useMutation<ForceRefreshResponse, unknown>({
    mutationFn: () => forceRefreshCommandCenter(raceId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
      if (data.refreshed) {
        toast.success(data.message || 'Đã cập nhật');
      } else {
        toast.message(data.message || 'Đang đồng bộ');
      }
    },
    onError: (err) => {
      if (err instanceof HttpError && err.status === 429) {
        setRetryAfterSec(30);
        toast.error('Bạn vừa refresh, đợi 30s rồi thử lại.');
        return;
      }
      if (err instanceof HttpError && err.status === 409) {
        toast.message('Hệ thống đang đồng bộ, dữ liệu sẽ tự cập nhật');
        return;
      }
      toast.error(
        err instanceof Error ? err.message : 'Force Refresh thất bại',
      );
    },
  });

  // 1Hz countdown for retryAfterSec
  useEffect(() => {
    if (retryAfterSec <= 0) return;
    const id = setInterval(() => {
      setRetryAfterSec((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [retryAfterSec]);

  // Force a 1Hz tick to keep "Last sync N s ago" fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const handleExportCSV = async () => {
    if (exporting) return;
    if (!activeCourseId) {
      toast.error('Chưa chọn cự ly để export');
      return;
    }
    setExporting(true);
    try {
      // Fetch full leaderboard for active course (BR-CC-11 current course pill).
      // Use generous limit covering MAX 3000 athletes (BR-CC scope).
      const courseData = await getLiveLeaderboard(raceId, activeCourseId, 3000);
      if (!courseData.entries || courseData.entries.length === 0) {
        toast.message('Không có VĐV để export');
        return;
      }
      const rows: FullLeaderboardRow[] = courseData.entries.map((e) => ({
        rank: e.rank,
        bib: e.bib,
        athleteName: e.athleteName,
        ageGroup: e.ageGroup,
        lastCheckpoint: e.lastCheckpoint,
        chipTime: e.finishTime,
        gunTime: null,
        gap: e.gap,
        status: e.hasMissingFinish
          ? 'MISS'
          : e.finishTime
            ? 'FINISHED'
            : 'DNS',
      }));
      downloadFullCSV(rows, courseData.courseName);
      toast.success(
        `Đã tải ${rows.length.toLocaleString('vi-VN')} VĐV — ${buildFullExportFilename(courseData.courseName)}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export CSV thất bại');
    } finally {
      setExporting(false);
    }
  };

  const handleActiveCourseChange = (courseId: string) => {
    setActiveCourseId(courseId);
  };

  if (snapshot.isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }
  if (snapshot.isError || !snapshot.data) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-800">
          Không tải được dashboard snapshot:{' '}
          {(snapshot.error as Error)?.message ?? 'unknown'}
        </CardContent>
      </Card>
    );
  }

  const data = snapshot.data;
  const generatedAt = data.generatedAt;
  const elapsedSec = generatedAt
    ? Math.max(
        0,
        Math.floor((Date.now() - new Date(generatedAt).getTime()) / 1000),
      )
    : 0;

  // F-008 v2 — derive raceMeta for Reset modal (only when full race info available).
  const raceMetaForTopBar =
    raceSlug && raceTitle && raceStatus
      ? {
          raceId,
          raceTitle,
          raceSlug,
          raceStatus,
        }
      : undefined;

  // First course as default Discovery target (parent could expose finer control later).
  const firstCourse = data.checkpointHealthMatrix?.[0];
  const handleOpenDiscovery = firstCourse
    ? () =>
        setDiscoveryCourse({
          courseId: firstCourse.courseId,
          courseName: firstCourse.courseName,
        })
    : undefined;

  return (
    <div className="flex flex-col gap-4">
      <CommandCenterTopBar
        elapsedSec={elapsedSec}
        pollIntervalSec={pollIntervalSec}
        onPollIntervalChange={setPollIntervalSec}
        onForceRefresh={() => forceRefreshMutation.mutate()}
        refreshing={forceRefreshMutation.isPending}
        retryAfterSec={retryAfterSec}
        onExportCSV={() => void handleExportCSV()}
        exporting={exporting}
        raceMeta={raceMetaForTopBar}
        onOpenDiscovery={handleOpenDiscovery}
        showDiscoveryTrigger={!!firstCourse}
      />

      {/* F-008 v2 BR-CC2-19 — RaceStatusPill inline above SummaryCardsRow */}
      {raceStatus && (
        <div
          className="flex items-center gap-2"
          data-testid="race-status-pill-row"
        >
          <RaceStatusPill status={raceStatus} />
          {data.lastPollAt && (
            <span
              className="text-[11px] text-stone-500"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              Last poll: {new Date(data.lastPollAt).toLocaleTimeString('vi-VN')}
            </span>
          )}
        </div>
      )}

      {viewMode === 'alerts' ? (
        // F-008 v2 BR-CC2-32 / BR-CC2-36 — drill-in alerts list
        <AlertsListView raceId={raceId} />
      ) : (
        <>
          <SummaryCardsRow
            summary={data.summary}
            dnsCount={data.dnsCount}
            throughputHistory={data.throughputHistory}
          />

          {/* F-010 BR-FC-05/06 — DNS sub-state breakdown card.
              Additive — KHÔNG đổi SummaryCardsRow shape. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DnsBreakdownCard
              breakdown={data.dnsBreakdown}
              totalFallback={data.dnsCount ?? 0}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3">
              {/* F-011 BR-PB-09 — `raceStatus` prop pass-through enables pre-race
                  status guard inside AthleteFlowChart (additive, coexists w/ F-010 DNS card). */}
              <AthleteFlowChart
                progression={data.checkpointProgression}
                raceStatus={raceStatus}
              />
            </div>
            <div className="lg:col-span-2">
              <LiveLeaderboardTable
                leaderboard={data.liveLeaderboard}
                raceSlug={raceSlug}
                activeCourseId={activeCourseId}
                onActiveCourseChange={handleActiveCourseChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AlertFeedPanel raceId={raceId} />
            <CheckpointHealthMatrix matrix={data.checkpointHealthMatrix} />
          </div>
        </>
      )}

      {/* F-008 v2 — Discovery dialog mounted body-level so it remains accessible
          across drill-in views without re-mount cost. */}
      <CheckpointDiscoveryDialog
        raceId={raceId}
        courseId={discoveryCourse?.courseId ?? null}
        courseName={discoveryCourse?.courseName ?? ''}
        open={!!discoveryCourse}
        onOpenChange={(o) => {
          if (!o) setDiscoveryCourse(null);
        }}
      />
    </div>
  );
}
