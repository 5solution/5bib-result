'use client';

/**
 * Alert Detail Dialog — click 1 alert row → modal trajectory + audit log.
 *
 * Hiển thị:
 * - Header: BIB + name + severity badge
 * - Trajectory timeline: mỗi checkpoint với status (passed/missing/pending)
 *   - ✅ passed: time + distance
 *   - ❌ missing: chấm đỏ + label "MISS"
 *   - ⏳ pending: xám
 * - 2 cột: time at first detect (frozen) vs time now (current)
 *   → BTC thấy VĐV đã qua thêm CP nào sau khi alert fire
 * - Pace + projected finish + projected rank
 * - Audit log: detection events, resolution actions
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  getAlertDetail,
  patchTimingAlert,
  type TimingAlertSeverity,
  type AlertDetailResponse,
} from '@/lib/timing-alert-api';

const SEVERITY_COLORS: Record<TimingAlertSeverity, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-300',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
  WARNING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  INFO: 'bg-blue-100 text-blue-800 border-blue-300',
};

interface Props {
  raceId: string;
  alertId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function AlertDetailDialog({ raceId, alertId, open, onOpenChange }: Props) {
  const detail = useQuery({
    queryKey: ['alert-detail', raceId, alertId],
    queryFn: () => {
      if (!alertId) throw new Error('alertId missing');
      return getAlertDetail(raceId, alertId);
    },
    enabled: open && !!alertId && !!raceId,
    staleTime: 0,
    refetchInterval: open ? 10_000 : false,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[95vw] flex-col overflow-hidden sm:!max-w-[760px]">
        <DialogHeader className="border-b border-stone-200 pb-3">
          <DialogTitle>Chi tiết alert</DialogTitle>
          <DialogDescription>
            Trajectory + audit log của VĐV bị flag miss timing.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-2">
          {detail.isLoading && <Skeleton className="h-96 w-full" />}

          {detail.isError && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              ❌ {(detail.error as Error)?.message ?? 'Load detail thất bại'}
            </div>
          )}

          {detail.data && (
            <DetailContent data={detail.data} />
          )}
        </div>

        {/* Sticky action panel ở bottom — race day muscle memory */}
        {detail.data && (
          <ActionFooter
            data={detail.data}
            raceId={raceId}
            onAfterAction={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetailContent({ data }: { data: AlertDetailResponse }) {
  const { alert, trajectory } = data;

  return (
    <div className="space-y-5">
      {/* Header — BIG BIB + name */}
      <div className="rounded-lg border border-stone-200 bg-gradient-to-br from-stone-50 to-white p-4">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span className="text-3xl font-bold tracking-tight">BIB {alert.bib_number}</span>
          <span className="text-xl text-stone-700">{alert.athlete_name ?? '?'}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge className={SEVERITY_COLORS[alert.severity]}>{alert.severity}</Badge>
          <Badge variant="outline">{alert.contest ?? '—'}</Badge>
          {alert.age_group && <Badge variant="outline">{alert.age_group}</Badge>}
          <Badge
            variant="outline"
            className={
              alert.status === 'OPEN'
                ? 'border-amber-300 bg-amber-50 text-amber-800'
                : alert.status === 'RESOLVED'
                  ? 'border-green-300 bg-green-50 text-green-800'
                  : 'border-stone-300 bg-stone-50 text-stone-700'
            }
          >
            {alert.status}
          </Badge>
          {alert.detection_type === 'MIDDLE_GAP' && (
            <Badge
              variant="outline"
              className="border-purple-300 bg-purple-50 text-purple-800"
            >
              🌀 Middle gap
            </Badge>
          )}
          {alert.detection_type === 'PHANTOM' && (
            <Badge
              variant="outline"
              className="border-stone-300 bg-stone-50 text-stone-700"
            >
              👻 Phantom
            </Badge>
          )}
        </div>

        {/* Reason inline */}
        {alert.reason && (
          <p className="mt-3 text-sm text-stone-700">
            <strong>Lý do:</strong> {alert.reason}
          </p>
        )}

        {/* Type-specific instruction */}
        {alert.detection_type === 'MIDDLE_GAP' && (
          <p className="mt-2 text-xs text-purple-800">
            🌀 Athlete đã qua <strong>{alert.last_seen_point}</strong> nhưng
            KHÔNG có time tại <strong>{alert.missing_point}</strong> — chip miss
            giữa course. VĐV vẫn fine, chỉ mất data → BTC ghi note rectify
            rank post-race.
          </p>
        )}
        {alert.detection_type === 'PHANTOM' && (
          <p className="mt-2 text-xs text-stone-700">
            👻 Athlete đã qua <strong>{alert.last_seen_point}</strong> nhưng
            quá lâu chưa qua <strong>{alert.missing_point}</strong> (overdue ≥
            threshold) → cần verify với BTC tại trạm xem VĐV có thật ở đó không.
          </p>
        )}
      </div>

      {/* Stats grid — 8 boxes responsive (2 mobile, 4 tablet, 8 desktop) */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-4">
        <StatBox
          label="Last seen"
          value={`${alert.last_seen_point}`}
          subtitle={alert.last_seen_time}
          accent="green"
        />
        <StatBox label="Missing" value={alert.missing_point} accent="red" />
        <StatBox label="Overdue" value={`${alert.overdue_minutes} phút`} accent="amber" />
        <StatBox label="Detection count" value={String(alert.detection_count)} />
        {alert.projected_finish_time && (
          <StatBox
            label="Projected finish"
            value={alert.projected_finish_time}
            accent="blue"
          />
        )}
        {alert.projected_overall_rank !== null && (
          <StatBox
            label="Overall rank"
            value={`#${alert.projected_overall_rank}`}
            accent="blue"
          />
        )}
        {alert.projected_age_group_rank !== null && (
          <StatBox
            label="Age group rank"
            value={`#${alert.projected_age_group_rank}`}
            accent="blue"
          />
        )}
        {alert.projected_confidence !== null && (
          <StatBox
            label="Confidence"
            value={`${Math.round((alert.projected_confidence ?? 0) * 100)}%`}
          />
        )}
      </div>

      {/* Trajectory timeline */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase text-stone-500">
          🗺 Hành trình qua checkpoint
        </h3>
        {trajectory.length === 0 ? (
          <Card>
            <CardContent className="p-3 text-sm text-stone-600">
              Chưa có data trajectory — không tìm được course match cho alert này.
              <span className="mt-1 block text-xs text-stone-400">
                Có thể do: (1) alert legacy với contest=null chưa backfill, hoặc
                (2) checkpoint set không match course nào trong race document.
              </span>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded border border-stone-200">
            <table className="w-full text-sm">
              <thead className="bg-stone-100 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Checkpoint</th>
                  <th className="px-3 py-2 text-left">Distance</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Time khi fire alert</th>
                  <th className="px-3 py-2 text-left">Time hiện tại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {trajectory.map((cp) => (
                  <tr
                    key={cp.key}
                    className={
                      cp.isMissingPoint
                        ? 'bg-red-50'
                        : cp.isLastSeen
                          ? 'bg-green-50'
                          : ''
                    }
                  >
                    <td className="px-3 py-2 font-mono text-xs text-stone-500">
                      {cp.orderIndex + 1}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{cp.name}</div>
                      <div className="font-mono text-xs text-stone-500">
                        key: {cp.key}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {cp.distanceKm !== null ? `${cp.distanceKm} km` : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge cp={cp} />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {cp.timeAtFirstDetect ?? (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {cp.timeNow ? (
                        <span
                          className={
                            cp.timeNow !== cp.timeAtFirstDetect
                              ? 'font-semibold text-blue-700'
                              : ''
                          }
                        >
                          {cp.timeNow}
                          {cp.timeNow !== cp.timeAtFirstDetect && ' ✨'}
                        </span>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-stone-500">
          ✨ = data mới so với lúc alert fire — VĐV đã qua thêm checkpoint
          (có thể auto-resolve trong poll cycle tới).
        </p>
      </div>

      {/* Audit log */}
      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase text-stone-500">
          📜 Audit log
        </h3>
        {(alert.audit_log ?? []).length === 0 ? (
          <p className="text-xs text-stone-500">Chưa có audit entry.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-stone-100">
                {alert.audit_log.map((entry, idx) => (
                  <li key={idx} className="flex items-start gap-3 px-4 py-2 text-xs">
                    <Badge
                      variant="outline"
                      className="shrink-0 font-mono text-[10px]"
                    >
                      {entry.action}
                    </Badge>
                    <div className="flex-1">
                      <div className="text-stone-700">{entry.note ?? ''}</div>
                      <div className="text-stone-500">
                        by {entry.by} · {new Date(entry.at).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Resolution if any */}
      {alert.status !== 'OPEN' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-3 text-sm">
            <p>
              <strong>Resolved by:</strong> {alert.resolved_by ?? '?'} ·{' '}
              {alert.resolved_at
                ? new Date(alert.resolved_at).toLocaleString('vi-VN')
                : '—'}
            </p>
            {alert.resolution_note && (
              <p className="mt-1 text-stone-700">
                <strong>Note:</strong> {alert.resolution_note}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Timestamps */}
      <div className="text-xs text-stone-500">
        First detected: {new Date(alert.first_detected_at).toLocaleString('vi-VN')}
        {' · '}
        Last checked: {new Date(alert.last_checked_at).toLocaleString('vi-VN')}
      </div>
    </div>
  );
}

/**
 * Sticky action panel ở DialogFooter (bottom) — race day muscle memory.
 * BTC click 100 alerts liên tiếp, button luôn ở same position → no scroll.
 */
function ActionFooter({
  data,
  raceId,
  onAfterAction,
}: {
  data: AlertDetailResponse;
  raceId: string;
  onAfterAction: () => void;
}) {
  const { alert } = data;
  const qc = useQueryClient();
  const [note, setNote] = useState('');

  const action = useMutation({
    mutationFn: (input: {
      action: 'RESOLVE' | 'FALSE_ALARM' | 'REOPEN';
      note: string;
    }) => patchTimingAlert(raceId, alert._id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timing-alerts', raceId] });
      qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
      qc.invalidateQueries({ queryKey: ['alert-detail', raceId, alert._id] });
      onAfterAction();
    },
  });

  if (alert.status !== 'OPEN') {
    return (
      <div className="flex items-center justify-between gap-3 border-t border-stone-200 bg-stone-50 px-6 py-3">
        <div className="text-xs text-stone-600">
          Status: <strong>{alert.status}</strong>
          {alert.resolved_by && ` · by ${alert.resolved_by}`}
        </div>
        <Button
          variant="outline"
          onClick={() =>
            action.mutate({ action: 'REOPEN', note: 'Reopened by admin' })
          }
          disabled={action.isPending}
        >
          ↩ Reopen
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-stone-200 bg-stone-50 px-6 py-3">
      <div className="min-w-[280px] flex-1">
        <label className="mb-1 block text-xs font-semibold uppercase text-stone-500">
          Ghi chú (optional)
        </label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="VD: Đã verify với BTC tại trạm, chip reader lỗi"
          className="text-sm"
        />
        {action.isError && (
          <div className="mt-1 text-xs text-red-700">
            ❌ {(action.error as Error)?.message ?? 'Action failed'}
          </div>
        )}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          onClick={() =>
            action.mutate({
              action: 'RESOLVE',
              note: note.trim() || 'Resolved (no detail note)',
            })
          }
          disabled={action.isPending}
          size="lg"
          className="min-w-[120px]"
        >
          ✅ Resolve
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            action.mutate({
              action: 'FALSE_ALARM',
              note: note.trim() || 'False alarm — DNF confirmed',
            })
          }
          disabled={action.isPending}
          size="lg"
          className="min-w-[120px]"
        >
          ❌ False alarm
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({
  cp,
}: {
  cp: AlertDetailResponse['trajectory'][number];
}) {
  if (cp.isMissingPoint) {
    return (
      <Badge className="border-red-300 bg-red-100 text-red-800">
        ❌ MISS (đang flag)
      </Badge>
    );
  }
  if (cp.status === 'passed') {
    if (cp.isLastSeen) {
      return (
        <Badge className="border-green-300 bg-green-100 text-green-800">
          ✅ Last seen
        </Badge>
      );
    }
    return (
      <Badge className="border-green-300 bg-green-100 text-green-800">
        ✅ Passed
      </Badge>
    );
  }
  if (cp.status === 'pending') {
    return (
      <Badge variant="outline" className="text-stone-500">
        ⏳ Pending
      </Badge>
    );
  }
  return null;
}

function StatBox({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string;
  subtitle?: string;
  accent?: 'red' | 'blue' | 'green' | 'amber';
}) {
  const colorMap: Record<string, string> = {
    red: 'border-red-200 bg-red-50',
    blue: 'border-blue-200 bg-blue-50',
    green: 'border-green-200 bg-green-50',
    amber: 'border-amber-200 bg-amber-50',
  };
  return (
    <Card className={accent ? colorMap[accent] : 'border-stone-200 bg-stone-50'}>
      <CardContent className="p-3">
        <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          {label}
        </div>
        <div className="mt-1 truncate text-base font-bold text-stone-900" title={value}>
          {value}
        </div>
        {subtitle && (
          <div className="mt-0.5 truncate font-mono text-xs text-stone-600">
            {subtitle}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
