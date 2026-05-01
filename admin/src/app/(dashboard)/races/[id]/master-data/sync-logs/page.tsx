'use client';

/**
 * Race Master Data — Sync Logs (audit history).
 *
 * URL: /races/{mongoRaceId}/master-data/sync-logs
 *
 * Hiển thị 100 sync log entries gần nhất cho race. Audit immutable —
 * không có button edit/delete.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getChipConfigByMongoId } from '@/lib/chip-verification-api';
import { listMasterDataSyncLogs } from '@/lib/race-master-data-api';

export default function MasterDataSyncLogsPage() {
  const params = useParams();
  const mongoRaceIdRaw = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const mongoRaceId = String(mongoRaceIdRaw ?? '');
  const { isAuthenticated } = useAuth();

  const link = useQuery({
    queryKey: ['chip-config-by-mongo', mongoRaceId],
    queryFn: () => getChipConfigByMongoId(mongoRaceId),
    enabled: Boolean(mongoRaceId) && isAuthenticated,
  });

  const mysqlRaceId = link.data?.mysql_race_id ?? null;

  const logs = useQuery({
    queryKey: ['master-data-sync-logs', mysqlRaceId, 100],
    queryFn: () => listMasterDataSyncLogs(mysqlRaceId!, 100),
    enabled: Boolean(mysqlRaceId) && isAuthenticated,
    refetchInterval: 30_000,
  });

  if (!mysqlRaceId) {
    return (
      <div className="space-y-4 p-6">
        <p>Race chưa link MySQL race_id.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sync Logs</h1>
          <p className="text-sm text-stone-500">
            Audit history (immutable) cho race mysql_race_id={mysqlRaceId}
          </p>
        </div>
        <Link href={`/races/${mongoRaceId}/master-data`}>
          <Button variant="ghost">← Back</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent {logs.data?.total ?? 0} entries</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : logs.data && logs.data.items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Fetched</TableHead>
                  <TableHead className="text-right">Inserted</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="text-right">ms</TableHead>
                  <TableHead>Triggered by</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.data.items.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">
                      {new Date(l.started_at).toLocaleString('vi-VN')}
                    </TableCell>
                    <TableCell>{l.sync_type}</TableCell>
                    <TableCell>
                      <Badge variant={badgeVariantOf(l.status)}>
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {l.rows_fetched}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {l.rows_inserted}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {l.rows_updated}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {l.duration_ms}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {l.triggered_by}
                    </TableCell>
                    <TableCell className="text-xs text-red-600">
                      {l.error_message ? l.error_message.slice(0, 80) : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="py-8 text-center text-stone-500">
              Chưa có sync log nào.
            </p>
          )}
        </CardContent>
      </Card>
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
