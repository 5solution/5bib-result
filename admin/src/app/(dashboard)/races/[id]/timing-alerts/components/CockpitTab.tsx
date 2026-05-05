'use client';

/**
 * F-005 — Race Day Command Center (was Cockpit, F-002).
 *
 * Sections (per design canvas Artboard 3):
 * 1. Race elapsed clock + freshness indicator (F-002 base)
 * 2. Hero stats — race-level KPI bar (F-002 base)
 * 3. Athlete Flow Monitor (chart per checkpoint)
 * 4. Live Leaderboard (top N per course) — F-005 NEW
 * 5. Timing Alert Feed (recent activity)
 * 6. Summary Cards Row (racekit / started / finished / dns / miss%) — F-005 NEW
 * 7. Course breakdown grid (F-002 retained for auto-derive CTA)
 *
 * **Note:** Component file name kept as `CockpitTab.tsx` per Manager directive
 * (giảm git diff noise; UI label đổi "Cockpit" → "Command Center").
 *
 * **Data:** `dashboard-snapshot` endpoint gộp tất cả sources, refetch 30s + on SSE.
 * Query key `['dashboard-snapshot', raceId]` GIỮ NGUYÊN — backward compat F-002.
 */

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  forceRefreshCommandCenter,
  getDashboardSnapshot,
  HttpError,
  type CourseStats,
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

  const qc = useQueryClient();

  const snapshot = useQuery({
    queryKey: ['dashboard-snapshot', raceId],
    queryFn: () => getDashboardSnapshot(raceId),
    enabled: !!raceId,
    refetchInterval: 30_000,
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

  const {
    raceStats,
    courses,
    checkpointProgression,
    recentActivity,
    liveLeaderboard,
    summary,
  } = snapshot.data;

  const generatedAt = snapshot.data.generatedAt;
  const elapsedSec = generatedAt
    ? Math.floor((Date.now() - new Date(generatedAt).getTime()) / 1000)
    : 0;

  return (
    <div className="space-y-4">
      {/* Race elapsed clock — ticks 1Hz client-side từ race.startedAt */}
      <RaceElapsedClock
        startedAt={snapshot.data.race.startedAt}
        startedAtSource={snapshot.data.race.startedAtSource}
        status={snapshot.data.race.status}
      />

      {/* Data freshness indicator + F-005 BR-CC-10 Force Refresh button */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
        <span>
          📊 Data live từ timing-alert poll cache (cập nhật mỗi 30s).{' '}
          {elapsedSec < 60
            ? `Snapshot ${elapsedSec}s trước`
            : `Snapshot ${Math.floor(elapsedSec / 60)} phút trước`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => forceRefreshMutation.mutate()}
            disabled={forceRefreshMutation.isPending}
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                forceRefreshMutation.isPending ? 'animate-spin' : ''
              }`}
            />
            {forceRefreshMutation.isPending
              ? 'Đang refresh...'
              : 'Force Refresh'}
          </Button>
          <span className="text-blue-700">
            Auto-refresh 30s + push qua SSE
          </span>
        </div>
      </div>

      {/* ─── Section 1: Hero Stats ─── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <HeroCard
          label="VĐV xuất phát"
          value={raceStats.started.toLocaleString('vi-VN')}
          accent="blue"
          subtitle="có time tại Start"
        />
        <HeroCard
          label="VĐV về đích"
          value={raceStats.finished.toLocaleString('vi-VN')}
          accent="green"
          subtitle={`${(raceStats.progress * 100).toFixed(1)}% xong`}
        />
        <HeroCard
          label="Đang trên đường"
          value={raceStats.onCourse.toLocaleString('vi-VN')}
          accent="amber"
          subtitle="started − finished"
        />
        <HeroCard
          label="Nghi vấn miss chip"
          value={raceStats.suspectOpen.toString()}
          accent={raceStats.criticalOpen > 0 ? 'red' : 'stone'}
          subtitle={
            raceStats.criticalOpen > 0
              ? `${raceStats.criticalOpen} CRITICAL`
              : 'không có CRITICAL'
          }
        />
        <HeroCard
          label="Tiến độ giải"
          value={`${(raceStats.progress * 100).toFixed(0)}%`}
          accent="stone"
          progressBar={raceStats.progress}
          subtitle="finished / started"
        />
      </div>

      {/* ─── F-005 Section: Summary Cards Row ─── */}
      <div>
        <h2
          className="mb-2 text-lg font-semibold"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          📊 Tổng quan giải
        </h2>
        <SummaryCardsRow summary={summary} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* ─── F-005 Section A: Athlete Flow Monitor (60%) ─── */}
        <div className="lg:col-span-3">
          <h2
            className="mb-2 text-lg font-semibold"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            📈 Athlete Flow Monitor
          </h2>
          <AthleteFlowChart progression={checkpointProgression} />
        </div>

        {/* ─── F-005 Section B: Live Leaderboard (40%) ─── */}
        <div className="lg:col-span-2">
          <h2
            className="mb-2 text-lg font-semibold"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            🏁 Live Leaderboard
          </h2>
          <LiveLeaderboardTable leaderboard={liveLeaderboard} />
        </div>
      </div>

      {/* ─── F-005 Section C: Timing Alert Feed ─── */}
      <div>
        <h2
          className="mb-2 text-lg font-semibold"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          🔔 Timing Alert Feed
        </h2>
        <AlertFeedPanel items={recentActivity} />
      </div>

      {/* ─── F-002 retained: Course breakdown grid (Auto-derive CTA) ─── */}
      <div>
        <h2
          className="mb-2 text-lg font-semibold"
          style={{ fontFamily: 'var(--font-sans)' }}
        >
          ⚙ Cài đặt theo cự ly
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <CourseCard
              key={c.courseId}
              course={c}
              onAutoDerive={() =>
                setDiscoveryCourse({ id: c.courseId, name: c.name })
              }
            />
          ))}
        </div>
      </div>

      {/* Discovery dialog */}
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

// ─────────── Sub-components ───────────

function HeroCard({
  label,
  value,
  accent,
  subtitle,
  progressBar,
}: {
  label: string;
  value: string;
  accent: 'blue' | 'green' | 'amber' | 'red' | 'stone';
  subtitle?: string;
  progressBar?: number;
}) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    green: 'border-green-200 bg-green-50 text-green-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    stone: 'border-stone-200 bg-stone-50 text-stone-900',
  };
  return (
    <Card className={colorMap[accent]}>
      <CardContent className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wide opacity-70">
          {label}
        </div>
        <div className="mt-1 text-3xl font-bold">{value}</div>
        {subtitle && (
          <div className="mt-1 text-xs opacity-70">{subtitle}</div>
        )}
        {progressBar !== undefined && (
          <div className="mt-2 h-2 w-full overflow-hidden rounded bg-stone-200">
            <div
              className="h-full bg-blue-600 transition-all"
              style={{ width: `${Math.round(progressBar * 100)}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CourseCard({
  course,
  onAutoDerive,
}: {
  course: CourseStats;
  onAutoDerive: () => void;
}) {
  const finishRatio =
    course.started > 0 ? course.finished / course.started : 0;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{course.name}</span>
          {course.distanceKm !== null && (
            <Badge variant="outline">{course.distanceKm}km</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Mini label="Xuất phát" value={course.started} />
          <Mini label="Về đích" value={course.finished} accent="green" />
          <Mini label="Đang chạy" value={course.onCourse} accent="amber" />
        </div>

        <div className="h-2 w-full overflow-hidden rounded bg-stone-200">
          <div
            className="h-full bg-green-600 transition-all"
            style={{ width: `${Math.round(finishRatio * 100)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-stone-600">
          {course.leadingChipTime ? (
            <span>🥇 {course.leadingChipTime}</span>
          ) : (
            <span className="text-stone-400">chưa có finisher</span>
          )}
          {course.suspectCount > 0 && (
            <Badge
              variant="outline"
              className="border-red-300 bg-red-50 text-red-800"
            >
              {course.suspectCount} suspect
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2">
          {course.hasCheckpoints ? (
            <Badge
              variant="outline"
              className="border-green-300 bg-green-50 text-green-800"
            >
              ✓ Checkpoints OK
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-amber-800"
            >
              ⚠ Chưa có checkpoints
            </Badge>
          )}
          {course.apiUrl ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onAutoDerive}
              className="text-xs"
            >
              🪄 Auto-derive
            </Button>
          ) : (
            <span className="text-xs text-stone-400">No apiUrl</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Mini({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'green' | 'amber';
}) {
  const colorMap: Record<string, string> = {
    green: 'text-green-700',
    amber: 'text-amber-700',
  };
  return (
    <div>
      <div className="text-[10px] uppercase text-stone-500">{label}</div>
      <div className={`text-lg font-bold ${accent ? colorMap[accent] : ''}`}>
        {value.toLocaleString('vi-VN')}
      </div>
    </div>
  );
}

// F-005 — Inline ProgressionRow / ActivityFeed / iconForType / ActivityLine /
// formatRelative đã được REMOVED. Logic moved sang components/command-center/
// (AthleteFlowChart + AlertFeedPanel) để follow design canvas Artboard 3.

/**
 * Race elapsed clock — ticks 1Hz client-side từ `startedAt` ISO timestamp.
 *
 * 3 modes hiển thị:
 * - **Race chưa start** (`startedAt=null`, status=draft/pre_race): hiển thị
 *   "⏳ Race chưa bắt đầu" + scheduled startDate nếu có
 * - **Race live** (status=live): big clock HH:MM:SS xanh + animated pulse
 * - **Race ended** (status=ended): clock đứng tại giờ kết thúc + màu xám
 *
 * Source label hiển thị nhỏ bên cạnh để BTC biết startedAt từ đâu:
 * - `status_history` → "✓ Admin transition" (most accurate)
 * - `course_start_time` → "≈ Theo giờ start course" (fallback estimate)
 */
function RaceElapsedClock({
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
  // Tick state — increment counter mỗi 1s để force re-render. Dùng counter
  // thay vì store elapsed string để tránh re-render lúc null/ended.
  const [tickCount, setTickCount] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    if (status === 'ended') return; // race over — no need ticking
    const interval = setInterval(() => setTickCount((c) => c + 1), 1000);
    return () => clearInterval(interval);
  }, [startedAt, status]);
  // Reference tickCount in JSX để TS không drop dependency
  void tickCount;

  // Race chưa start hoặc thiếu data config
  if (!startedAt) {
    const isLiveButMissing = status === 'live' || status === 'ended';
    return (
      <div
        className={`rounded-lg border p-4 text-center ${
          isLiveButMissing
            ? 'border-amber-300 bg-amber-50'
            : 'border-stone-200 bg-stone-50'
        }`}
      >
        <div
          className={`text-xs uppercase tracking-wide ${
            isLiveButMissing ? 'text-amber-700' : 'text-stone-500'
          }`}
        >
          {isLiveButMissing
            ? '⚠️ Race đang live nhưng chưa config startTime'
            : '⏳ Race chưa bắt đầu'}
        </div>
        <div className="mt-1 text-sm text-stone-700">
          {isLiveButMissing ? (
            <>
              BTC vào <strong>/admin/races/[id]/edit</strong> và set{' '}
              <code className="rounded bg-stone-200 px-1">race.startDate</code> +{' '}
              <code className="rounded bg-stone-200 px-1">course.startTime</code>{' '}
              để clock chạy đúng. (Status: <strong>{status}</strong>)
            </>
          ) : (
            <>
              Status hiện tại: <strong>{status}</strong>. Đổi sang{' '}
              <code className="rounded bg-stone-200 px-1">live</code> để bắt đầu
              tracking.
            </>
          )}
        </div>
      </div>
    );
  }

  const elapsedMs = Date.now() - new Date(startedAt).getTime();
  const elapsedSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const hh = Math.floor(elapsedSec / 3600);
  const mm = Math.floor((elapsedSec % 3600) / 60);
  const ss = elapsedSec % 60;
  const formatted = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

  const isLive = status === 'live';
  const isEnded = status === 'ended';
  const startedAtLocal = new Date(startedAt).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });

  return (
    <div
      className={`rounded-lg border p-4 ${
        isLive
          ? 'border-emerald-300 bg-emerald-50'
          : isEnded
            ? 'border-stone-300 bg-stone-100'
            : 'border-blue-300 bg-blue-50'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <div
            className={`text-xs font-semibold uppercase tracking-wide ${
              isLive ? 'text-emerald-700' : 'text-stone-600'
            }`}
          >
            {isLive ? '🟢 Race đang diễn ra' : isEnded ? '⏹ Race đã kết thúc' : '⏱ Elapsed'}
            {isLive && (
              <span className="ml-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            )}
          </div>
          <div
            className={`mt-1 font-mono text-3xl font-bold tracking-tight md:text-4xl ${
              isLive
                ? 'text-emerald-900'
                : isEnded
                  ? 'text-stone-700'
                  : 'text-blue-900'
            }`}
          >
            {formatted}
          </div>
        </div>
        <div className="text-right text-xs text-stone-600">
          <div>
            Started: <strong>{startedAtLocal}</strong>
          </div>
          <div className="mt-0.5 text-stone-500">
            {startedAtSource === 'status_history'
              ? '✓ Theo lịch sử admin transition'
              : startedAtSource === 'course_start_time'
                ? '≈ Theo giờ start course (BTC chưa transition status)'
                : startedAtSource === 'recent_history'
                  ? '⚠️ Ước tính từ entry history gần nhất — BTC nên config startDate'
                  : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
