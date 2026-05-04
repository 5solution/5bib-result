'use client';

/**
 * Timing Miss Alert — Operation Dashboard (Phase 2 v1.1).
 *
 * URL: `/races/{raceId}/timing-alerts`
 *
 * **Refactor 03/05/2026 (Danny user feedback):**
 * - Tab routing: Cockpit (default) | Alerts | Trao giải
 * - Cockpit = Hero stats + Course grid + Progression chart + Activity feed
 * - SSE listener chung cho cả 3 tab — invalidate cả `dashboard-snapshot` +
 *   `timing-alerts` queries khi có event
 * - Sound alarm 880Hz CRITICAL giữ nguyên ở root page (không tab-specific)
 *
 * Decisions locked (2026-05-03):
 * - Auth: LogtoAdminGuard (vào được admin.5bib.com là xem được)
 * - Multi-day race: 1 dashboard, không tách
 * - DNF: chỉ flag, không auto-mark
 * - Anomaly: auto Telegram tới channel riêng (TIMING_ALERT_ANOMALY_CHAT_ID)
 */

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  getTimingAlertConfig,
  forcePollTimingAlert,
  resetRaceData,
  timingAlertSseUrl,
} from '@/lib/timing-alert-api';
import { CockpitTab } from './components/CockpitTab';
import { AlertsTab } from './components/AlertsTab';
import { PodiumTab } from './components/PodiumTab';

type TabKey = 'cockpit' | 'alerts' | 'podium';

const VALID_TABS: TabKey[] = ['cockpit', 'alerts', 'podium'];

export default function TimingAlertsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const raceId = String(
    Array.isArray(params?.id) ? params.id[0] : (params?.id ?? ''),
  );
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();

  // Tab state — sync với URL `?tab=`
  const tabFromQuery = searchParams?.get('tab') as TabKey | null;
  const initialTab: TabKey =
    tabFromQuery && VALID_TABS.includes(tabFromQuery) ? tabFromQuery : 'cockpit';
  const [tab, setTab] = useState<TabKey>(initialTab);

  // Replace URL khi tab thay đổi (no scroll, no history bloat)
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('tab') !== tab) {
      sp.set('tab', tab);
      router.replace(`/races/${raceId}/timing-alerts?${sp.toString()}`, {
        scroll: false,
      });
    }
  }, [tab, raceId, router]);

  const [soundEnabled, setSoundEnabled] = useState(true);

  const config = useQuery({
    queryKey: ['timing-alert-config', raceId],
    queryFn: () => getTimingAlertConfig(raceId),
    enabled: isAuthenticated && !!raceId,
  });

  const [forcePollMessage, setForcePollMessage] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetIncludeResults, setResetIncludeResults] = useState(true);
  const reset = useMutation({
    mutationFn: () => resetRaceData(raceId, resetIncludeResults),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['timing-alerts', raceId] });
      qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
      qc.invalidateQueries({ queryKey: ['podium', raceId] });
      setForcePollMessage(
        `🧹 Reset xong: ${data.alertsDeleted} alerts, ${data.pollsDeleted} poll logs, ${data.raceResultsDeleted} results, ${data.redisKeysDeleted} cache keys xóa`,
      );
      setTimeout(() => setForcePollMessage(null), 6000);
      setResetOpen(false);
    },
    onError: (err: Error) => {
      setForcePollMessage(`❌ Reset fail: ${err.message}`);
      setTimeout(() => setForcePollMessage(null), 6000);
    },
  });

  const forcePoll = useMutation({
    mutationFn: () => forcePollTimingAlert(raceId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['timing-alerts', raceId] });
      qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
      const courses = data.courses ?? [];
      const created = courses.reduce((s, c) => s + c.alerts_created, 0);
      const resolved = courses.reduce((s, c) => s + c.alerts_resolved, 0);
      const skipped = courses.filter((c) => c.error === 'lock-held').length;
      const failed = courses.filter((c) => c.status === 'FAILED').length;
      const parts: string[] = [];
      if (created > 0) parts.push(`+${created} alerts mới`);
      if (resolved > 0) parts.push(`-${resolved} resolved`);
      if (skipped > 0) parts.push(`${skipped} course skip`);
      if (failed > 0) parts.push(`${failed} FAILED`);
      setForcePollMessage(
        parts.length > 0 ? parts.join(', ') : 'Poll OK, không có thay đổi',
      );
      setTimeout(() => setForcePollMessage(null), 5000);
    },
    onError: (err: Error) => {
      setForcePollMessage(`❌ ${err.message}`);
      setTimeout(() => setForcePollMessage(null), 5000);
    },
  });

  // ─────────── SSE realtime — listener chung cho mọi tab ───────────
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!raceId || !isAuthenticated) return;
    const url = timingAlertSseUrl(raceId);
    const es = new EventSource(url, { withCredentials: true });

    const invalidateAll = () => {
      qc.invalidateQueries({ queryKey: ['timing-alerts', raceId] });
      qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
    };

    es.addEventListener('alert.created', (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data);
        if (soundEnabled && data.severity === 'CRITICAL') {
          playAlarm();
          if (
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted'
          ) {
            new Notification(`🔴 CRITICAL — BIB ${data.bib_number}`, {
              body: `${data.athlete_name ?? ''} miss ${data.missing_point}`,
            });
          }
        }
        invalidateAll();
      } catch {
        /* ignore malformed event */
      }
    });

    es.addEventListener('alert.resolved', invalidateAll);
    es.addEventListener('alert.updated', invalidateAll);
    es.addEventListener('poll.completed', () => {
      qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
      qc.invalidateQueries({ queryKey: ['podium', raceId] });
    });

    es.onerror = () => {
      // EventSource auto-reconnects unless es.close()
    };

    return () => es.close();
  }, [raceId, isAuthenticated, soundEnabled, qc]);

  // Browser notification permission prompt
  useEffect(() => {
    if (
      soundEnabled &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission().catch(() => undefined);
    }
  }, [soundEnabled]);

  // ─────────── UI ───────────
  if (authLoading) return <Skeleton className="h-64 w-full" />;
  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="p-6">Vui lòng đăng nhập.</CardContent>
      </Card>
    );
  }

  if (!config.data) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Timing Miss Alert chưa được cấu hình</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-stone-600">
              Cấu hình behavior knobs (poll interval, ngưỡng overdue, top N
              CRITICAL) để bật phát hiện miss timing realtime cho race này.
              Race-domain config (apiUrl, checkpoints, cutoff) đọc trực tiếp
              từ race document — không cần config 2 lần.
            </p>
            <Link href={`/races/${raceId}/timing-alerts/config`}>
              <Button>Tạo cấu hình</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ─── Page header ─── */}
      <div>
        <h1 className="text-2xl font-bold">⚠ Race Timing Operation</h1>
        <p className="text-sm text-stone-600">
          Theo dõi giải đấu realtime — VĐV đang chạy, suspect chip miss, mat
          failure. Poll mỗi {config.data.poll_interval_seconds}s.
        </p>
      </div>

      {/* ─── Status header ─── */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <Badge
              variant={config.data.enabled ? 'default' : 'secondary'}
              className={
                config.data.enabled ? 'bg-green-600' : 'bg-stone-400'
              }
            >
              {config.data.enabled ? '🟢 MONITORING' : '⏸ DISABLED'}
            </Badge>
            <span className="text-sm text-stone-600">
              Last poll:{' '}
              {config.data.last_polled_at
                ? new Date(config.data.last_polled_at).toLocaleString()
                : 'never'}
            </span>
            <span className="text-sm text-stone-600">
              Interval: {config.data.poll_interval_seconds}s
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled((s) => !s)}
              title="Bật/tắt chuông 880Hz khi có CRITICAL alert mới"
            >
              {soundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => forcePoll.mutate()}
              disabled={forcePoll.isPending}
              title="Trigger 1 poll cycle ngay (bypass cron 30s)"
            >
              {forcePoll.isPending ? 'Polling...' : '🔄 Force poll'}
            </Button>
            <Link href={`/races/${raceId}/timing-alerts/config`}>
              <Button variant="outline" size="sm">
                ⚙ Config
              </Button>
            </Link>
            <Link href={`/races/${raceId}/timing-alerts/poll-logs`}>
              <Button variant="outline" size="sm">
                📋 Poll logs
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setResetOpen(true)}
              className="border-red-300 text-red-700 hover:bg-red-50"
              title="Xóa alerts + poll logs + cache để re-test (giữ config + race document)"
            >
              🧹 Reset test data
            </Button>
          </div>
        </CardContent>
        {forcePollMessage && (
          <CardContent className="border-t border-stone-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
            {forcePollMessage}
          </CardContent>
        )}
      </Card>

      {/* ─── Tabs ─── */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="cockpit">🎯 Cockpit</TabsTrigger>
          <TabsTrigger value="alerts">⚠ Alerts</TabsTrigger>
          <TabsTrigger value="podium">🏆 Trao giải</TabsTrigger>
        </TabsList>

        <TabsContent value="cockpit" className="mt-4">
          <CockpitTab raceId={raceId} />
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <AlertsTab raceId={raceId} />
        </TabsContent>

        <TabsContent value="podium" className="mt-4">
          <PodiumTab raceId={raceId} />
        </TabsContent>
      </Tabs>

      {/* Hidden audio element — Web Audio bypasses HTML element complexity */}
      <audio ref={audioRef} preload="auto" />

      {/* Reset confirmation dialog */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>🧹 Reset test data?</AlertDialogTitle>
            <AlertDialogDescription>
              Xóa toàn bộ data test cho race này. KHÔNG xóa config + race
              document — anh chạy lại ngay sau reset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 px-6 pb-4 text-sm">
            <ul className="ml-5 list-disc text-stone-700">
              <li>Tất cả timing alerts (mọi severity, mọi status)</li>
              <li>Tất cả poll logs (audit history)</li>
              <li>Redis cache: dashboard snapshot, podium, anomaly rate-limit</li>
            </ul>
            <label className="mt-3 flex cursor-pointer items-center gap-2 rounded border border-stone-200 bg-stone-50 p-2">
              <Checkbox
                checked={resetIncludeResults}
                onCheckedChange={(c) => setResetIncludeResults(!!c)}
              />
              <span>
                <strong>Xóa luôn race_results</strong> (synced từ
                RR/simulator) — recommend ON khi đổi simulation
              </span>
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reset.isPending}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                reset.mutate();
              }}
              disabled={reset.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {reset.isPending ? 'Đang xóa...' : 'Reset ngay'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────── Alarm sound (Web Audio 880Hz) ───────────

function playAlarm(): void {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    setTimeout(() => ctx.close(), 1000);
  } catch {
    /* browser blocked autoplay — user must interact first */
  }
}
