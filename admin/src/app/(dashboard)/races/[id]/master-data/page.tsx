'use client';

/**
 * Race Master Data — Admin Overview
 *
 * URL: /races/{mongoRaceId}/master-data
 *
 * Single source of truth cho athlete pre-race data. Page resolve mongoRaceId
 * → mysql_race_id qua `chip_race_configs` (cùng pattern chip-mappings).
 * Nếu race chưa link mysql_race_id → hiển thị message yêu cầu link qua trang
 * Chip Verify trước.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { getChipConfigByMongoId } from '@/lib/chip-verification-api';
import {
  getMasterDataStats,
  triggerMasterDataSync,
  listMasterDataSyncLogs,
} from '@/lib/race-master-data-api';
import { MasterDataStatsCard } from './components/MasterDataStatsCard';
import { MasterDataAthletesTable } from './components/MasterDataAthletesTable';

export default function MasterDataPage() {
  const params = useParams();
  const mongoRaceIdRaw = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const mongoRaceId = String(mongoRaceIdRaw ?? '');
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();

  const link = useQuery({
    queryKey: ['chip-config-by-mongo', mongoRaceId],
    queryFn: () => getChipConfigByMongoId(mongoRaceId),
    enabled: Boolean(mongoRaceId) && isAuthenticated,
    staleTime: 5_000,
  });

  const mysqlRaceId = link.data?.mysql_race_id ?? null;

  const stats = useQuery({
    queryKey: ['master-data-stats', mysqlRaceId],
    queryFn: () => getMasterDataStats(mysqlRaceId!),
    enabled: Boolean(mysqlRaceId) && isAuthenticated,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const syncLogs = useQuery({
    queryKey: ['master-data-sync-logs', mysqlRaceId, 5],
    queryFn: () => listMasterDataSyncLogs(mysqlRaceId!, 5),
    enabled: Boolean(mysqlRaceId) && isAuthenticated,
    refetchInterval: 30_000,
  });

  const triggerSync = useMutation({
    mutationFn: (syncType: 'ATHLETE_FULL' | 'ATHLETE_DELTA') =>
      triggerMasterDataSync(mysqlRaceId!, syncType),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['master-data-stats', mysqlRaceId] });
      void qc.invalidateQueries({
        queryKey: ['master-data-sync-logs', mysqlRaceId],
      });
      void qc.invalidateQueries({
        queryKey: ['master-data-athletes', mysqlRaceId],
      });
    },
  });

  if (authLoading || link.isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <div className="p-6">Cần đăng nhập admin.</div>;
  }

  if (!mysqlRaceId) {
    return (
      <div className="space-y-4 p-6">
        <h1 className="text-2xl font-semibold">Race Master Data</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-stone-600">
              Race này chưa link tới MySQL <code>race_id</code>. Master data
              cần link để pull athletes từ 5BIB legacy DB.
            </p>
            <p className="mt-4">
              <Link
                href={`/races/${mongoRaceId}/chip-mappings`}
                className="text-blue-600 hover:underline"
              >
                → Đến trang Chip Verify để link MySQL race_id
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lastSyncLog = syncLogs.data?.items?.[0] ?? null;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Race Master Data</h1>
          <p className="text-sm text-stone-500">
            mysql_race_id={mysqlRaceId} · single source of truth cho athlete data
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => triggerSync.mutate('ATHLETE_DELTA')}
            disabled={triggerSync.isPending}
          >
            🔄 Delta sync
          </Button>
          <Button
            onClick={() => triggerSync.mutate('ATHLETE_FULL')}
            disabled={triggerSync.isPending}
          >
            {triggerSync.isPending ? 'Đang sync…' : '⚡ Full sync now'}
          </Button>
          <Link href={`/races/${mongoRaceId}/master-data/sync-logs`}>
            <Button variant="ghost">📜 Sync logs</Button>
          </Link>
        </div>
      </div>

      {triggerSync.isError && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">
            ❌ {(triggerSync.error as Error).message}
          </CardContent>
        </Card>
      )}

      {triggerSync.isSuccess && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="py-3 text-sm text-green-700">
            ✅ Sync hoàn tất ·{' '}
            {triggerSync.data.log.rows_fetched} rows · status{' '}
            {triggerSync.data.log.status}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sync Status</CardTitle>
        </CardHeader>
        <CardContent>
          {lastSyncLog ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-stone-500">Last sync:</span>
                <span>{new Date(lastSyncLog.started_at).toLocaleString('vi-VN')}</span>
                <Badge variant={badgeVariantOf(lastSyncLog.status)}>
                  {lastSyncLog.status}
                </Badge>
                <span className="text-stone-500">
                  {lastSyncLog.sync_type} · triggered by {lastSyncLog.triggered_by}
                </span>
              </div>
              <div className="text-stone-600">
                Fetched {lastSyncLog.rows_fetched} · upsert{' '}
                {lastSyncLog.rows_inserted} · update {lastSyncLog.rows_updated} ·{' '}
                {lastSyncLog.duration_ms}ms
              </div>
              {lastSyncLog.error_message && (
                <div className="text-red-600">⚠ {lastSyncLog.error_message}</div>
              )}
            </div>
          ) : (
            <p className="text-stone-500">
              Chưa có sync log. Click "Full sync now" để khởi tạo lần đầu.
            </p>
          )}
        </CardContent>
      </Card>

      <MasterDataStatsCard stats={stats.data} loading={stats.isLoading} />

      <MasterDataAthletesTable mysqlRaceId={mysqlRaceId} />
    </div>
  );
}

function badgeVariantOf(
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED',
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'SUCCESS':
      return 'default';
    case 'RUNNING':
      return 'secondary';
    case 'PARTIAL':
      return 'outline';
    case 'FAILED':
      return 'destructive';
  }
}
