'use client';

/**
 * Poll logs audit table — debug + post-race retrospective.
 * URL: `/races/{raceId}/timing-alerts/poll-logs`
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { listTimingAlertPollLogs } from '@/lib/timing-alert-api';

const STATUS_COLORS: Record<string, string> = {
  SUCCESS: 'bg-green-100 text-green-800',
  PARTIAL: 'bg-yellow-100 text-yellow-800',
  FAILED: 'bg-red-100 text-red-800',
};

export default function PollLogsPage() {
  const params = useParams();
  const raceId = String(
    Array.isArray(params?.id) ? params.id[0] : (params?.id ?? ''),
  );

  const logs = useQuery({
    queryKey: ['timing-alert-poll-logs', raceId],
    queryFn: () => listTimingAlertPollLogs(raceId, 100),
    refetchInterval: 30_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href={`/races/${raceId}/timing-alerts`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Quay lại Alerts dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold">📋 Poll logs audit</h1>
          <p className="text-sm text-stone-600">
            Mỗi cycle 1 race × 1 course = 1 entry. TTL 90 ngày auto-DELETE.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => logs.refetch()}
          disabled={logs.isFetching}
        >
          {logs.isFetching ? 'Loading...' : '🔄 Refresh'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {logs.data?.length ?? 0} entries gần nhất
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.isLoading ? (
            <Skeleton className="h-32" />
          ) : (logs.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-stone-500">
              Chưa có poll nào. Cron sẽ chạy mỗi 30s khi config enabled=true.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-stone-200 text-left text-xs uppercase text-stone-500">
                  <tr>
                    <th className="py-2 pr-3">Started</th>
                    <th className="py-2 pr-3">Course</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3 text-right">Athletes</th>
                    <th className="py-2 pr-3 text-right">Created</th>
                    <th className="py-2 pr-3 text-right">Resolved</th>
                    <th className="py-2 pr-3 text-right">Duration</th>
                    <th className="py-2 pr-3">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.data?.map((log) => (
                    <tr
                      key={log._id}
                      className="border-b border-stone-100 hover:bg-stone-50"
                    >
                      <td className="py-2 pr-3 font-mono text-xs">
                        {new Date(log.started_at).toLocaleTimeString()}
                      </td>
                      <td className="py-2 pr-3">{log.course_name}</td>
                      <td className="py-2 pr-3">
                        <Badge className={STATUS_COLORS[log.status] ?? ''}>
                          {log.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {log.athletes_fetched}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {log.alerts_created > 0 ? (
                          <span className="font-bold text-orange-700">
                            +{log.alerts_created}
                          </span>
                        ) : (
                          <span className="text-stone-400">0</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {log.alerts_resolved > 0 ? (
                          <span className="text-green-700">
                            -{log.alerts_resolved}
                          </span>
                        ) : (
                          <span className="text-stone-400">0</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-xs">
                        {log.duration_ms}ms
                      </td>
                      <td className="py-2 pr-3 text-xs text-red-700">
                        {log.error_message ?? ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
