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
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { AlertDetailDialog } from './AlertDetailDialog';

const SEVERITY_COLORS: Record<TimingAlertSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  WARNING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  INFO: 'bg-blue-100 text-blue-800 border-blue-300',
};

/** C4 fix — separate bg + text classes (split() trước render lỗi) */
const SEVERITY_BG: Record<TimingAlertSeverity, string> = {
  CRITICAL: 'border-red-300 bg-red-50',
  HIGH: 'border-orange-300 bg-orange-50',
  WARNING: 'border-yellow-300 bg-yellow-50',
  INFO: 'border-blue-300 bg-blue-50',
};

const SEVERITY_TEXT: Record<TimingAlertSeverity, string> = {
  CRITICAL: 'text-red-700',
  HIGH: 'text-orange-700',
  WARNING: 'text-yellow-700',
  INFO: 'text-blue-700',
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
  const [bibSearch, setBibSearch] = useState('');

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
    const search = bibSearch.trim().toLowerCase();
    for (const a of alerts.data?.items ?? []) {
      // C6 — Search by BIB or athlete name
      if (search) {
        const bibMatch = a.bib_number.toLowerCase().includes(search);
        const nameMatch = (a.athlete_name ?? '').toLowerCase().includes(search);
        if (!bibMatch && !nameMatch) continue;
      }
      grouped[a.severity].push(a);
    }
    return grouped;
  }, [alerts.data, bibSearch]);

  return (
    <div className="space-y-4">
      {/* Stats by severity — C4 fix: parse class string properly */}
      {alerts.data?.stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {SEVERITY_ORDER.map((sev) => {
            const count = alerts.data.stats.by_severity[sev];
            return (
              <Card key={sev} className={SEVERITY_BG[sev]}>
                <CardContent className="p-4">
                  <div className={`text-xs font-semibold ${SEVERITY_TEXT[sev]}`}>
                    {sev}
                  </div>
                  <div className="mt-1 text-2xl font-bold text-stone-900">
                    {count}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filter + Search BIB row */}
      <div className="flex flex-wrap items-center gap-2">
        {(['OPEN', 'RESOLVED', 'FALSE_ALARM'] as TimingAlertStatus[]).map((s) => {
          const count =
            s === 'OPEN' ? alerts.data?.stats.open_count ?? 0 : null;
          return (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s}
              {count !== null && count > 0 && (
                <span className="ml-1.5 rounded-full bg-stone-200 px-1.5 text-xs text-stone-800">
                  {count}
                </span>
              )}
            </Button>
          );
        })}
        {/* C6 — Search by BIB / name */}
        <div className="relative ml-auto flex w-full min-w-[200px] max-w-sm items-center">
          <Search className="pointer-events-none absolute left-2.5 size-4 text-stone-400" />
          <Input
            value={bibSearch}
            onChange={(e) => setBibSearch(e.target.value)}
            placeholder="Tìm BIB hoặc tên VĐV..."
            className="pl-8"
            inputMode="search"
          />
          {bibSearch && (
            <button
              type="button"
              onClick={() => setBibSearch('')}
              className="absolute right-2 text-stone-400 hover:text-stone-700"
              aria-label="Clear"
            >
              ×
            </button>
          )}
        </div>
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
  // C1 fix — note KHÔNG required, default fallback string nếu BTC quick-resolve
  // C2 fix — toàn bộ row clickable mở detail dialog (note input đã move vào dialog)
  // Action buttons gọi quick action với default note. BTC muốn note chi tiết → mở dialog.

  const handleQuick = (
    e: React.MouseEvent,
    action: 'RESOLVE' | 'FALSE_ALARM' | 'REOPEN',
    defaultNote: string,
  ) => {
    e.stopPropagation();
    onAction(action, defaultNote);
  };

  // Note: KHÔNG dùng <button> bao quanh vì action buttons nested → invalid HTML.
  // Dùng div role="button" + tabIndex + Enter/Space handler.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClickDetail();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClickDetail}
      onKeyDown={onKeyDown}
      className="block w-full cursor-pointer rounded-md border border-stone-200 bg-white p-3 text-left transition-all hover:border-blue-400 hover:shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-[280px]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold">BIB {alert.bib_number}</span>
            <span className="text-sm text-stone-400">·</span>
            <span className="text-sm text-stone-600">{alert.contest}</span>
            {alert.age_group && (
              <>
                <span className="text-sm text-stone-400">·</span>
                <span className="text-sm text-stone-600">{alert.age_group}</span>
              </>
            )}
            <span className="text-sm text-stone-400">·</span>
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
                ` · Top ${alert.projected_age_group_rank} AG`}
              {alert.projected_overall_rank !== null &&
                ` / ${alert.projected_overall_rank} overall`}
            </div>
          )}
          {alert.reason && (
            <div className="mt-1 text-xs text-stone-500">{alert.reason}</div>
          )}
        </div>
        {alert.status === 'OPEN' && (
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="default"
              disabled={busy}
              onClick={(e) =>
                handleQuick(
                  e,
                  'RESOLVE',
                  'Quick-resolve (chi tiết → mở detail dialog)',
                )
              }
              title="Resolve nhanh — note default. Để note chi tiết, click row mở dialog."
              className="min-w-[100px]"
            >
              ✅ Resolve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={(e) =>
                handleQuick(
                  e,
                  'FALSE_ALARM',
                  'Quick false-alarm — DNF confirmed',
                )
              }
              className="min-w-[100px]"
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
            onClick={(e) => handleQuick(e, 'REOPEN', 'Reopen')}
          >
            ↩ Reopen
          </Button>
        )}
      </div>
    </div>
  );
}
