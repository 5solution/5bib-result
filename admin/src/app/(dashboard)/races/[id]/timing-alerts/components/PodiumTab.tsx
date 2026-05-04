'use client';

/**
 * Tab "Trao giải" — Top 10 per course.
 *
 * BTC dùng tab này để chuẩn bị trao giải khi race gần kết thúc.
 * Realtime cập nhật khi athlete mới finish.
 */

import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { getPodium, type PodiumCourse } from '@/lib/timing-alert-api';

export function PodiumTab({ raceId }: { raceId: string }) {
  const podium = useQuery({
    queryKey: ['podium', raceId],
    queryFn: () => getPodium(raceId),
    enabled: !!raceId,
    refetchInterval: 60_000, // chậm hơn cockpit vì podium ít thay đổi nhanh
  });

  if (podium.isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (podium.isError || !podium.data) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-4 text-sm text-red-800">
          ❌ Không lấy được podium:{' '}
          {(podium.error as Error)?.message ?? 'unknown'}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 text-sm">
          <p className="font-semibold">🏆 Top 10 per course</p>
          <p className="mt-1 text-stone-700">
            BTC chuẩn bị trao giải. Top 10 cập nhật mỗi 60 giây từ
            race_results MongoDB. DNF/DNS/DSQ đã filter (rank ≥ 900000).
          </p>
        </CardContent>
      </Card>

      {podium.data.courses.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-stone-600">
            Race chưa có courses.
          </CardContent>
        </Card>
      ) : (
        podium.data.courses.map((c) => <PodiumCard key={c.courseId} course={c} />)
      )}
    </div>
  );
}

function PodiumCard({ course }: { course: PodiumCourse }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {course.courseName}
          {course.distanceKm !== null && (
            <Badge variant="outline">{course.distanceKm}km</Badge>
          )}
          <span className="text-sm font-normal text-stone-500">
            · {course.finishersCount} top finishers
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {course.podium.length === 0 ? (
          <div className="text-sm text-stone-500">
            Chưa có athlete nào finish course này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-stone-200 text-left text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">BIB</th>
                  <th className="px-2 py-2">Tên VĐV</th>
                  <th className="px-2 py-2">Chip time</th>
                  <th className="px-2 py-2">Pace</th>
                  <th className="px-2 py-2">Age group</th>
                  <th className="px-2 py-2">Quốc tịch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {course.podium.map((entry) => (
                  <tr
                    key={entry.bib}
                    className={
                      entry.rank <= 3
                        ? 'bg-amber-50 font-semibold'
                        : 'hover:bg-stone-50'
                    }
                  >
                    <td className="px-2 py-2 font-bold">
                      {entry.rank === 1 && '🥇'}
                      {entry.rank === 2 && '🥈'}
                      {entry.rank === 3 && '🥉'}
                      {entry.rank > 3 && entry.rank}
                    </td>
                    <td className="px-2 py-2 font-mono">{entry.bib}</td>
                    <td className="px-2 py-2">{entry.name ?? '?'}</td>
                    <td className="px-2 py-2 font-mono">
                      {entry.chipTime ?? '—'}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {entry.pace ?? '—'}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {entry.ageGroup ?? '—'}
                      {entry.ageGroupRank !== null && (
                        <span className="ml-1 text-stone-500">
                          (#{entry.ageGroupRank})
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {entry.nationality ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
