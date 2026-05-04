'use client';

/**
 * Tab "Alerts" — danh sách miss-timing alerts (giữ nguyên UX cũ).
 *
 * Tách ra component để page chính chỉ chứa tab routing + SSE listener.
 * Logic resolve / false alarm / reopen như cũ.
 */

import { useMemo, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
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

const PAGE_SIZE = 20;

export function AlertsTab({ raceId }: { raceId: string }) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<TimingAlertStatus>('OPEN');
  const [detailAlertId, setDetailAlertId] = useState<string | null>(null);
  const [bibSearch, setBibSearch] = useState('');

  // 1 stats query — pageSize=1 chỉ lấy by_severity + open_count.
  // Tách khỏi 4 severity queries vì stats cần FULL count, không filter severity.
  const statsQuery = useQuery({
    queryKey: ['timing-alerts-stats', raceId, statusFilter],
    queryFn: () =>
      listTimingAlerts(raceId, { status: statusFilter, page: 1, pageSize: 1 }),
    enabled: !!raceId,
    staleTime: 15_000,
  });
  const stats = statsQuery.data?.stats;

  // 4 separate infinite queries — 1 per severity. BTC chỉ load thêm severity
  // họ care, không phải kéo qua 299 CRITICAL mới đụng WARNING. KHÔNG có
  // refetchInterval — rely on SSE invalidation (page.tsx wired) + manual reload.
  // Hooks calls fixed at 4 → tuân Rules of Hooks.
  const criticalQ = useInfiniteQuery({
    queryKey: ['timing-alerts', raceId, statusFilter, 'CRITICAL'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      listTimingAlerts(raceId, {
        status: statusFilter,
        severity: 'CRITICAL',
        page: pageParam as number,
        pageSize: PAGE_SIZE,
      }),
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    enabled: !!raceId,
    staleTime: 15_000,
  });
  const highQ = useInfiniteQuery({
    queryKey: ['timing-alerts', raceId, statusFilter, 'HIGH'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      listTimingAlerts(raceId, {
        status: statusFilter,
        severity: 'HIGH',
        page: pageParam as number,
        pageSize: PAGE_SIZE,
      }),
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    enabled: !!raceId,
    staleTime: 15_000,
  });
  const warningQ = useInfiniteQuery({
    queryKey: ['timing-alerts', raceId, statusFilter, 'WARNING'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      listTimingAlerts(raceId, {
        status: statusFilter,
        severity: 'WARNING',
        page: pageParam as number,
        pageSize: PAGE_SIZE,
      }),
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    enabled: !!raceId,
    staleTime: 15_000,
  });
  const infoQ = useInfiniteQuery({
    queryKey: ['timing-alerts', raceId, statusFilter, 'INFO'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      listTimingAlerts(raceId, {
        status: statusFilter,
        severity: 'INFO',
        page: pageParam as number,
        pageSize: PAGE_SIZE,
      }),
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    enabled: !!raceId,
    staleTime: 15_000,
  });
  const queryBySev: Record<TimingAlertSeverity, typeof criticalQ> = {
    CRITICAL: criticalQ,
    HIGH: highQ,
    WARNING: warningQ,
    INFO: infoQ,
  };

  const resolveAction = useMutation({
    mutationFn: (input: {
      alertId: string;
      action: 'RESOLVE' | 'FALSE_ALARM' | 'REOPEN';
      note: string;
    }) => patchTimingAlert(raceId, input.alertId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['timing-alerts', raceId] });
      qc.invalidateQueries({ queryKey: ['timing-alerts-stats', raceId] });
      qc.invalidateQueries({ queryKey: ['dashboard-snapshot', raceId] });
    },
  });

  // Apply BIB/name search filter PER severity (in-memory on loaded items).
  const filteredBySev = useMemo(() => {
    const search = bibSearch.trim().toLowerCase();
    const result: Record<TimingAlertSeverity, TimingAlert[]> = {
      CRITICAL: [],
      HIGH: [],
      WARNING: [],
      INFO: [],
    };
    for (const sev of SEVERITY_ORDER) {
      const items = queryBySev[sev].data?.pages.flatMap((p) => p.items) ?? [];
      result[sev] = !search
        ? items
        : items.filter((a) => {
            const bibMatch = a.bib_number.toLowerCase().includes(search);
            const nameMatch = (a.athlete_name ?? '')
              .toLowerCase()
              .includes(search);
            return bibMatch || nameMatch;
          });
    }
    return result;
  }, [criticalQ.data, highQ.data, warningQ.data, infoQ.data, bibSearch]);

  const isInitialLoading =
    criticalQ.isLoading ||
    highQ.isLoading ||
    warningQ.isLoading ||
    infoQ.isLoading;

  return (
    <div className="space-y-4">
      {/* Stats by severity — C4 fix: parse class string properly */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {SEVERITY_ORDER.map((sev) => {
            const count = stats.by_severity[sev];
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
            s === 'OPEN' ? stats?.open_count ?? 0 : null;
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

      {/* Alert list grouped — 4 cards độc lập, mỗi card có Load more riêng */}
      {isInitialLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        SEVERITY_ORDER.map((sev) => {
          const q = queryBySev[sev];
          const list = filteredBySev[sev];
          const totalForSev = stats?.by_severity[sev] ?? 0;
          // Hiển thị card kể cả 0 alert nếu stats > 0 (BTC biết có sev này).
          // Nếu stats=0 và search filter đã loại hết → ẩn card.
          if (totalForSev === 0 && list.length === 0) return null;
          const totalLoadedSev = q.data?.pages.flatMap((p) => p.items).length ?? 0;
          const truncated = list.length < totalLoadedSev; // search hidden some
          return (
            <Card key={sev}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Badge className={SEVERITY_COLORS[sev]}>{sev}</Badge>
                  <span className="text-base">
                    {bibSearch && truncated
                      ? `${list.length} match (${totalLoadedSev} loaded / ${totalForSev} total)`
                      : `${totalLoadedSev} loaded / ${totalForSev} total`}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {list.length === 0 ? (
                  <div className="py-2 text-sm text-stone-500">
                    {bibSearch
                      ? 'Không có alert match BIB/tên đã loaded.'
                      : 'Chưa load alert nào trong nhóm này.'}
                  </div>
                ) : (
                  list.map((alert) => (
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
                  ))
                )}
                {/* Per-severity Load more — chỉ load thêm sev này, không touch các sev khác */}
                {q.hasNextPage && (
                  <div className="flex justify-center pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={q.isFetchingNextPage}
                      onClick={() => q.fetchNextPage()}
                    >
                      {q.isFetchingNextPage
                        ? 'Đang tải…'
                        : `Load thêm ${sev} (${totalLoadedSev}/${totalForSev})`}
                    </Button>
                  </div>
                )}
                {!q.hasNextPage && totalForSev > 0 && (
                  <div className="pt-1 text-center text-xs text-stone-400">
                    Đã load đủ {totalLoadedSev}/{totalForSev} {sev}
                  </div>
                )}
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
