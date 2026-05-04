'use client';

/**
 * Phase 2.2-2.5 — Race Timing Operation Dashboard cockpit.
 *
 * Sections:
 * 1. Hero stats — race-level KPI bar
 * 2. Course breakdown grid — 1 card / cự ly với "Auto-derive checkpoints" CTA
 * 3. Checkpoint progression — Tailwind bar chart per course
 * 4. Live activity feed — timeline alerts + poll completes
 *
 * **Data:** `dashboard-snapshot` endpoint gộp 4 sources, refetch 30s + on SSE.
 * **Note:** SSE invalidation handled bởi parent page (page.tsx) — listener
 * chung cho tab Cockpit + Alerts.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  getDashboardSnapshot,
  type CourseStats,
  type CheckpointProgression,
  type RecentActivityItem,
} from '@/lib/timing-alert-api';
import { CheckpointDiscoveryDialog } from './CheckpointDiscoveryDialog';

export function CockpitTab({ raceId }: { raceId: string }) {
  const [discoveryCourse, setDiscoveryCourse] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const snapshot = useQuery({
    queryKey: ['dashboard-snapshot', raceId],
    queryFn: () => getDashboardSnapshot(raceId),
    enabled: !!raceId,
    refetchInterval: 30_000,
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

  const { raceStats, courses, checkpointProgression, recentActivity } =
    snapshot.data;

  return (
    <div className="space-y-4">
      {/* ─── Section 1: Hero Stats ─── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <HeroCard
          label="Started"
          value={raceStats.started.toLocaleString('vi-VN')}
          accent="blue"
        />
        <HeroCard
          label="Finished"
          value={raceStats.finished.toLocaleString('vi-VN')}
          accent="green"
          subtitle={`${(raceStats.progress * 100).toFixed(1)}% progress`}
        />
        <HeroCard
          label="On-course"
          value={raceStats.onCourse.toLocaleString('vi-VN')}
          accent="amber"
          subtitle="đang trên đường"
        />
        <HeroCard
          label="Suspect"
          value={raceStats.suspectOpen.toString()}
          accent={raceStats.criticalOpen > 0 ? 'red' : 'stone'}
          subtitle={
            raceStats.criticalOpen > 0
              ? `${raceStats.criticalOpen} CRITICAL`
              : 'no critical'
          }
        />
        <HeroCard
          label="Race progress"
          value={`${(raceStats.progress * 100).toFixed(0)}%`}
          accent="stone"
          progressBar={raceStats.progress}
        />
      </div>

      {/* ─── Section 2: Course breakdown ─── */}
      <div>
        <h2 className="mb-2 text-lg font-semibold">📊 Theo cự ly</h2>
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

      {/* ─── Section 3: Checkpoint progression ─── */}
      <div>
        <h2 className="mb-2 text-lg font-semibold">📈 Tiến độ qua checkpoint</h2>
        {checkpointProgression.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-stone-600">
              Chưa có course nào có checkpoints config. Click 🪄 Auto-derive
              ở mỗi card cự ly trên kia.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {checkpointProgression.map((p) => (
              <ProgressionRow key={p.courseId} progression={p} />
            ))}
          </div>
        )}
      </div>

      {/* ─── Section 5: Live activity feed ─── */}
      <div>
        <h2 className="mb-2 text-lg font-semibold">🔔 Hoạt động gần đây</h2>
        <ActivityFeed items={recentActivity} />
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
          <Mini label="Started" value={course.started} />
          <Mini label="Finished" value={course.finished} accent="green" />
          <Mini label="On-course" value={course.onCourse} accent="amber" />
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

function ProgressionRow({
  progression,
}: {
  progression: CheckpointProgression;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {progression.courseName}
          <span className="ml-2 text-sm font-normal text-stone-500">
            · {progression.startedCount} started
            {progression.distanceKm && ` · ${progression.distanceKm}km`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {progression.points.length === 0 ? (
          <div className="text-sm text-stone-500">
            Chưa có checkpoint config. Click Auto-derive ở card trên.
          </div>
        ) : (
          /* B3 — overflow-x-auto + min-width đảm bảo chart không vỡ trên tablet/phone */
          <div className="overflow-x-auto">
            <div className="min-w-[640px] space-y-2">
              {progression.points.map((pt, idx) => {
                const ratio = pt.passedRatio;
                const prevRatio =
                  idx > 0 ? progression.points[idx - 1].passedRatio : ratio;
                const drop = prevRatio - ratio;
                const isAnomaly =
                  idx > 0 && drop > 0.3 && idx < progression.points.length - 1;
                return (
                  <div key={pt.key} className="flex items-center gap-3 text-sm">
                    <div className="w-32 shrink-0 truncate font-medium" title={pt.name}>
                      {pt.name}
                      {pt.distanceKm !== null && (
                        <span className="ml-1 text-xs text-stone-500">
                          {pt.distanceKm}km
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-[160px]">
                      <div className="h-5 w-full overflow-hidden rounded bg-stone-200">
                        <div
                          className={`h-full transition-all ${
                            isAnomaly
                              ? 'bg-red-500'
                              : ratio >= 0.95
                                ? 'bg-green-600'
                                : ratio >= 0.7
                                  ? 'bg-blue-600'
                                  : 'bg-amber-500'
                          }`}
                          style={{
                            width: `${Math.max(2, Math.round(ratio * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="w-36 shrink-0 text-right font-mono text-xs">
                      {pt.passedCount.toLocaleString('vi-VN')} /{' '}
                      {pt.expectedCount.toLocaleString('vi-VN')}
                      <span className="ml-1 text-stone-500">
                        ({(ratio * 100).toFixed(1)}%)
                      </span>
                    </div>
                    {isAnomaly && (
                      <Badge
                        variant="outline"
                        className="shrink-0 border-red-300 bg-red-50 text-red-800"
                        title={`Drop ${(drop * 100).toFixed(1)}% so với checkpoint trước`}
                      >
                        ⚠ Drop
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActivityFeed({ items }: { items: RecentActivityItem[] }) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-stone-600">
          Chưa có hoạt động.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="max-h-96 overflow-y-auto p-0">
        <ul className="divide-y divide-stone-200">
          {items.map((it, idx) => (
            <li key={idx} className="flex items-start gap-3 px-4 py-2 text-sm">
              <span className="mt-0.5 flex w-6 shrink-0 items-center justify-center">
                {iconForType(it.type)}
              </span>
              <div className="flex-1 min-w-0">
                <ActivityLine item={it} />
              </div>
              <span className="shrink-0 font-mono text-xs text-stone-500">
                {formatRelative(it.at)}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function iconForType(type: string): string {
  if (type === 'alert.created') return '🔴';
  if (type === 'alert.resolved') return '✅';
  if (type === 'poll.completed') return '🔄';
  return '•';
}

function ActivityLine({ item }: { item: RecentActivityItem }) {
  const p = item.payload;
  if (item.type === 'alert.created' || item.type === 'alert.resolved') {
    return (
      <span>
        <strong>BIB {String(p.bib ?? '?')}</strong>{' '}
        {String(p.name ?? '')} — {String(p.contest ?? '')}{' '}
        <Badge
          variant="outline"
          className={
            p.severity === 'CRITICAL'
              ? 'ml-1 border-red-300 bg-red-50 text-red-800'
              : 'ml-1'
          }
        >
          {String(p.severity ?? '')}
        </Badge>{' '}
        miss {String(p.missingPoint ?? '')}
        {item.type === 'alert.resolved' && (
          <span className="ml-2 text-stone-500">(resolved)</span>
        )}
      </span>
    );
  }
  if (item.type === 'poll.completed') {
    return (
      <span>
        Poll <strong>{String(p.course ?? '')}</strong> — fetched{' '}
        {Number(p.athletesFetched ?? 0).toLocaleString('vi-VN')}, +
        {String(p.alertsCreated ?? 0)} new, -{String(p.alertsResolved ?? 0)} resolved
      </span>
    );
  }
  return <span className="text-stone-500">{item.type}</span>;
}

function formatRelative(iso: string): string {
  try {
    const t = new Date(iso).getTime();
    const diff = Date.now() - t;
    if (diff < 60_000) return 'vừa xong';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
    return new Date(iso).toLocaleDateString('vi-VN');
  } catch {
    return iso;
  }
}
