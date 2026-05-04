'use client';

/**
 * Tab "Alerts" — danh sách miss-timing alerts (giữ nguyên UX cũ).
 *
 * Tách ra component để page chính chỉ chứa tab routing + SSE listener.
 * Logic resolve / false alarm / reopen như cũ.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  listTimingAlerts,
  patchTimingAlert,
  type TimingAlert,
  type TimingAlertSeverity,
  type TimingAlertStatus,
} from '@/lib/timing-alert-api';
import { AlertDetailDialog } from './AlertDetailDialog';

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

export function AlertsTab({ raceId }: { raceId: string }) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TimingAlertStatus>('OPEN');
  const [detailAlertId, setDetailAlertId] = useState<string | null>(null);

  const alerts = useQuery({
    queryKey: ['timing-alerts', raceId, statusFilter],
    queryFn: () =>
      listTimingAlerts(raceId, { status: statusFilter, pageSize: 100 }),
    enabled: !!raceId,
    refetchInterval: 30_000,
  });

  const resolveAction = useMutation({
    mutationFn: (input: {
      alertId: string;
      action: 'RESOLVE' | 'FALSE_ALARM' | 'REOPEN';
      note: string;
    }) => patchTimingAlert(raceId, input.alertId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timing-alerts', raceId] });
      qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
    },
  });

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
      {/* Stats by severity */}
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

      {/* Filter */}
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

      {/* Alert list grouped */}
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
                      resolveAction.mutate({
                        alertId: alert._id,
                        action,
                        note,
                      })
                    }
                    onClickDetail={() => setDetailAlertId(alert._id)}
                    busy={resolveAction.isPending}
                  />
                ))}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Detail dialog */}
      <AlertDetailDialog
        raceId={raceId}
        alertId={detailAlertId}
        open={!!detailAlertId}
        onOpenChange={(o) => {
          if (!o) setDetailAlertId(null);
        }}
      />
    </div>
  );
}

function AlertRow({
  alert,
  onAction,
  onClickDetail,
  busy,
}: {
  alert: TimingAlert;
  onAction: (action: 'RESOLVE' | 'FALSE_ALARM' | 'REOPEN', note: string) => void;
  onClickDetail: () => void;
  busy: boolean;
}) {
  const [note, setNote] = useState('');

  return (
    <div
      className="cursor-pointer rounded-md border border-stone-200 bg-white p-3 transition-all hover:border-blue-400 hover:shadow-sm"
      onClick={(e) => {
        // Don't trigger detail if click on button/input
        const target = e.target as HTMLElement;
        if (target.closest('button, input, label')) return;
        onClickDetail();
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-[300px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold">BIB {alert.bib_number}</span>
            <span className="text-sm">·</span>
            <span className="text-sm text-stone-600">{alert.contest}</span>
            <span className="text-sm">·</span>
            <span className="text-sm text-stone-600">{alert.age_group}</span>
            <span className="text-sm">·</span>
            <span className="text-sm font-medium">
              {alert.athlete_name ?? '?'}
            </span>
            {alert.detection_type === 'MIDDLE_GAP' && (
              <Badge
                variant="outline"
                className="border-purple-300 bg-purple-50 text-purple-800"
                title="Athlete đã qua CP sau missing point — chip miss giữa course, không phải dừng"
              >
                🌀 Gap giữa
              </Badge>
            )}
            {alert.detection_type === 'PHANTOM' && (
              <Badge
                variant="outline"
                className="border-stone-300 bg-stone-50 text-stone-700"
                title="Athlete chậm/dừng sau lastSeen, chưa qua nextCp"
              >
                👻 Phantom
              </Badge>
            )}
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
          <div className="mt-1 text-xs text-blue-600">
            👆 Click để xem chi tiết hành trình + audit log
          </div>
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
