'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { RaceAthleteStatsDto } from '@/lib/race-master-data-api';

interface Props {
  stats: RaceAthleteStatsDto | undefined;
  loading: boolean;
}

export function MasterDataStatsCard({ stats, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const courseEntries = Object.entries(stats.byCourse).sort(
    (a, b) => b[1] - a[1],
  );
  const statusEntries = Object.entries(stats.byStatus).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stats</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <div className="text-3xl font-semibold">{stats.total.toLocaleString('vi-VN')}</div>
            <div className="text-sm text-stone-500">Total athletes</div>
          </div>
          <div>
            <div className="text-3xl font-semibold">
              {stats.withBib.toLocaleString('vi-VN')}
              <span className="ml-2 text-sm font-normal text-stone-500">
                ({stats.total > 0 ? ((stats.withBib / stats.total) * 100).toFixed(1) : 0}%)
              </span>
            </div>
            <div className="text-sm text-stone-500">With BIB assigned</div>
          </div>
          <div>
            <div className="text-sm text-stone-500">Last synced</div>
            <div className="text-sm">
              {stats.lastSyncedAt
                ? new Date(stats.lastSyncedAt).toLocaleString('vi-VN')
                : '—'}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium">By course</h3>
            <ul className="space-y-1 text-sm">
              {courseEntries.length === 0 && (
                <li className="text-stone-400">Chưa có data</li>
              )}
              {courseEntries.map(([course, count]) => (
                <li key={course} className="flex justify-between">
                  <span>{course}</span>
                  <span className="font-mono text-stone-700">{count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium">By status</h3>
            <ul className="space-y-1 text-sm">
              {statusEntries.length === 0 && (
                <li className="text-stone-400">Chưa có data</li>
              )}
              {statusEntries.map(([status, count]) => (
                <li key={status} className="flex justify-between">
                  <span>{status}</span>
                  <span className="font-mono text-stone-700">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
