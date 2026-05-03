'use client';

/**
 * Timing Miss Alert — Admin Dashboard
 *
 * URL: `/races/{raceId}/timing-alerts`
 *
 * Phase 2 minimal viable UI:
 * - Status header (active monitoring + last poll)
 * - Stats by severity
 * - Alerts list grouped by severity với resolve actions
 * - SSE realtime: alerts mới push trực tiếp + sound 880Hz cho CRITICAL
 * - Force poll button (debug + race day emergency)
 *
 * KHÔNG có config form ở page này — link sang `/timing-alerts/config`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  getTimingAlertConfig,
  listTimingAlerts,
  patchTimingAlert,
  forcePollTimingAlert,
  timingAlertSseUrl,
  type TimingAlert,
  type TimingAlertSeverity,
  type TimingAlertStatus,
} from '@/lib/timing-alert-api';

const SEVERITY_COLORS: Record<TimingAlertSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  WARNING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  INFO: 'bg-blue-100 text-blue-800 border-blue-300',
};

const SEVERITY_ORDER: TimingAlertSeverity[] = [
  'CRITICAL',
  'HIGH',
  'WARNING',
  'INFO',
];

export default function TimingAlertsPage() {
  const params = useParams();
  const raceId = String(
    Array.isArray(params?.id) ? params.id[0] : (params?.id ?? ''),
  );
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<TimingAlertStatus>('OPEN');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const config = useQuery({
    queryKey: ['timing-alert-config', raceId],
    queryFn: () => getTimingAlertConfig(raceId),
    enabled: isAuthenticated && !!raceId,
  });

  const alerts = useQuery({
    queryKey: ['timing-alerts', raceId, statusFilter],
    queryFn: () => listTimingAlerts(raceId, { status: statusFilter, pageSize: 100 }),
    enabled: isAuthenticated && !!raceId,
    refetchInterval: 30_000,
  });

  const forcePoll = useMutation({
    mutationFn: () => forcePollTimingAlert(raceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timing-alerts', raceId] });
    },
  });

  const resolveAction = useMutation({
    mutationFn: (input: {
      alertId: string;
      action: 'RESOLVE' | 'FALSE_ALARM' | 'REOPEN';
      note: string;
    }) => patchTimingAlert(raceId, input.alertId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timing-alerts', raceId] });
    },
  });

  // ─────────── SSE realtime ───────────
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!raceId || !isAuthenticated) return;
    const url = timingAlertSseUrl(raceId);
    const es = new EventSource(url, { withCredentials: true });

    es.addEventListener('alert.created', (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data);
        if (soundEnabled && data.severity === 'CRITICAL') {
          playAlarm();
          if (Notification.permission === 'granted') {
            new Notification(`🔴 CRITICAL — BIB ${data.bib_number}`, {
              body: `${data.athlete_name ?? ''} miss ${data.missing_point}`,
            });
          }
        }
        qc.invalidateQueries({ queryKey: ['timing-alerts', raceId] });
      } catch {
        /* ignore malformed event */
      }
    });

    es.addEventListener('alert.resolved', () => {
      qc.invalidateQueries({ queryKey: ['timing-alerts', raceId] });
    });

    es.addEventListener('alert.updated', () => {
      qc.invalidateQueries({ queryKey: ['timing-alerts', raceId] });
    });

    es.onerror = () => {
      // EventSource auto-reconnects unless `es.close()`. Browser handles backoff.
    };

    return () => es.close();
  }, [raceId, isAuthenticated, soundEnabled, qc]);

  // Browser notification permission prompt khi user enable sound
  useEffect(() => {
    if (soundEnabled && 'Notification' in window && Notification.permission === 'default') {
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
              Cấu hình RaceResult API key + course checkpoints để bật phát hiện
              miss timing realtime cho race này.
            </p>
            <Link href={`/races/${raceId}/timing-alerts/config`}>
              <Button>Tạo cấu hình</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const alertsByGroup = useMemo(() => {
    const grouped: Record<TimingAlertSeverity, TimingAlert[]> = {
      CRITICAL: [],
      HIGH: [],
      WARNING: [],
      INFO: [],
    };
    for (const a of alerts.data?.items ?? []) {
      grouped[a.severity].push(a);
    }
    return grouped;
  }, [alerts.data]);

  return (
    <div className="space-y-4">
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
            >
              {soundEnabled ? '🔊 Sound ON' : '🔇 Sound OFF'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => forcePoll.mutate()}
              disabled={forcePoll.isPending}
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
          </div>
        </CardContent>
      </Card>

      {/* ─── Stats by severity ─── */}
      {alerts.data?.stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {SEVERITY_ORDER.map((sev) => (
            <Card key={sev} className={SEVERITY_COLORS[sev].split(' ')[0]}>
              <CardContent className="p-4">
                <div className={`text-xs font-semibold ${SEVERITY_COLORS[sev]}`}>
                  {sev}
                </div>
                <div className="mt-1 text-2xl font-bold">
                  {alerts.data.stats.by_severity[sev]}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Filter ─── */}
      <div className="flex gap-2">
        {(['OPEN', 'RESOLVED', 'FALSE_ALARM'] as TimingAlertStatus[]).map((s) => (
          <Button
            key={s}
            variant={statusFilter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      {/* ─── Alert list grouped ─── */}
      {alerts.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        SEVERITY_ORDER.map((sev) => {
          const list = alertsByGroup[sev];
          if (list.length === 0) return null;
          return (
            <Card key={sev}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge className={SEVERITY_COLORS[sev]}>{sev}</Badge>
                  <span className="text-base">{list.length} alerts</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {list.map((alert) => (
                  <AlertRow
                    key={alert._id}
                    alert={alert}
                    onAction={(action, note) =>
                      resolveAction.mutate({ alertId: alert._id, action, note })
                    }
                    busy={resolveAction.isPending}
                  />
                ))}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Hidden audio element for alarm — Web Audio bypasses HTML element complexity */}
      <audio ref={audioRef} preload="auto" />
    </div>
  );
}

// ─────────── Alarm sound (Web Audio 880Hz) ───────────

function playAlarm(): void {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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

// ─────────── Alert row ───────────

function AlertRow({
  alert,
  onAction,
  busy,
}: {
  alert: TimingAlert;
  onAction: (action: 'RESOLVE' | 'FALSE_ALARM' | 'REOPEN', note: string) => void;
  busy: boolean;
}) {
  const [note, setNote] = useState('');

  return (
    <div className="rounded-md border border-stone-200 bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-[300px]">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold">BIB {alert.bib_number}</span>
            <span className="text-sm">·</span>
            <span className="text-sm text-stone-600">{alert.contest}</span>
            <span className="text-sm">·</span>
            <span className="text-sm text-stone-600">{alert.age_group}</span>
            <span className="text-sm">·</span>
            <span className="text-sm font-medium">
              {alert.athlete_name ?? '?'}
            </span>
          </div>
          <div className="mt-1 text-sm text-stone-700">
            Last seen <strong>{alert.last_seen_point}</strong> (
            {alert.last_seen_time}) → Miss <strong>{alert.missing_point}</strong>
          </div>
          {alert.projected_finish_time && (
            <div className="mt-1 text-sm text-stone-700">
              Projected finish: <strong>{alert.projected_finish_time}</strong>
              {alert.projected_age_group_rank !== null &&
                ` · Top ${alert.projected_age_group_rank} age group`}
              {alert.projected_overall_rank !== null &&
                ` / ${alert.projected_overall_rank} overall`}
              {alert.projected_confidence !== null &&
                ` · ${Math.round((alert.projected_confidence ?? 0) * 100)}% conf`}
            </div>
          )}
          {alert.reason && (
            <div className="mt-1 text-xs text-stone-500">{alert.reason}</div>
          )}
        </div>
        {alert.status === 'OPEN' && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Resolution note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded border border-stone-300 px-2 py-1 text-sm"
            />
            <Button
              size="sm"
              variant="default"
              disabled={busy || !note.trim()}
              onClick={() => onAction('RESOLVE', note.trim())}
            >
              ✅ Resolve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !note.trim()}
              onClick={() => onAction('FALSE_ALARM', note.trim())}
            >
              ❌ False alarm
            </Button>
          </div>
        )}
        {alert.status !== 'OPEN' && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onAction('REOPEN', 'Reopen')}
          >
            ↩ Reopen
          </Button>
        )}
      </div>
    </div>
  );
}
