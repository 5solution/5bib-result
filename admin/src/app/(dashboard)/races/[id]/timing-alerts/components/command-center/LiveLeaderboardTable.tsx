'use client';

/**
 * FEATURE-005 — Live Leaderboard Table component (Command Center).
 *
 * Per design canvas Artboard 3:
 * - Top 3 → blue-50 left border highlight
 * - Row click → external link athlete detail public page
 * - MISS-Finish row magenta + icon (BR-CC-09)
 * - Course tabs ở top
 */

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { LiveLeaderboardCourse } from '@/lib/timing-alert-api';

interface LiveLeaderboardTableProps {
  leaderboard: LiveLeaderboardCourse[];
  raceSlug?: string;
}

export function LiveLeaderboardTable({
  leaderboard,
  raceSlug,
}: LiveLeaderboardTableProps) {
  const [activeCourseId, setActiveCourseId] = useState<string>(
    leaderboard[0]?.courseId ?? '',
  );

  if (leaderboard.length === 0) {
    return (
      <CardShell>
        <div className="p-4 text-sm text-stone-600">
          Chưa có data leaderboard. Race có thể đang ở trạng thái draft / pre_race.
        </div>
      </CardShell>
    );
  }

  const activeCourse =
    leaderboard.find((c) => c.courseId === activeCourseId) ?? leaderboard[0];

  return (
    <CardShell>
      {/* Header: title + pill tabs */}
      <div
        className="flex items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: 'var(--5s-border)' }}
      >
        <h3
          className="text-[15px] font-extrabold tracking-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Live Leaderboard
        </h3>
        <div
          className="ml-auto flex items-center gap-1 rounded-full p-[3px]"
          style={{ background: 'var(--5s-surface)' }}
        >
          {leaderboard.map((course) => {
            const isActive = course.courseId === activeCourse.courseId;
            return (
              <button
                key={course.courseId}
                type="button"
                onClick={() => setActiveCourseId(course.courseId)}
                className="inline-flex items-center rounded-full px-3.5 text-[12px] font-bold transition-colors"
                style={{
                  height: 30,
                  background: isActive ? '#0F172A' : 'transparent',
                  color: isActive ? '#fff' : 'var(--5s-text-muted)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {course.courseName}
              </button>
            );
          })}
        </div>
      </div>
      <div className="p-0">

        {activeCourse.entries.length === 0 ? (
          <div className="p-6 text-center text-sm text-stone-600">
            Chưa có VĐV nào trên leaderboard cho cự ly này.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead className="w-16">BIB</TableHead>
                  <TableHead>VĐV</TableHead>
                  <TableHead className="hidden md:table-cell">Last CP</TableHead>
                  <TableHead className="text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                    Finish
                  </TableHead>
                  <TableHead className="hidden md:table-cell text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                    Gap
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeCourse.entries.map((entry) => {
                  const isTop3 = entry.rank <= 3;
                  const isMiss = entry.hasMissingFinish;
                  const href = raceSlug
                    ? `/api/races/slug/${raceSlug}/${entry.bib}`
                    : undefined;

                  return (
                    <TableRow
                      key={entry.bib}
                      className={`group ${
                        isMiss
                          ? 'border-l-4 border-l-[#FF0E65] bg-pink-50/40'
                          : isTop3
                            ? 'border-l-4 border-l-blue-600 bg-blue-50/40'
                            : ''
                      }`}
                    >
                      <TableCell
                        className="text-center font-bold"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {entry.rank}
                      </TableCell>
                      <TableCell
                        className="font-semibold"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {entry.bib}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-stone-900 hover:text-blue-700 hover:underline"
                          >
                            {entry.athleteName}
                          </a>
                        ) : (
                          <span>{entry.athleteName}</span>
                        )}
                        {isMiss && (
                          <Badge
                            variant="outline"
                            className="ml-2 border-[#FF0E65] bg-pink-50 text-[#FF0E65]"
                            title="MISS Finish — có intermediate time nhưng KHÔNG có Finish"
                          >
                            ⚠ MISS
                          </Badge>
                        )}
                        {entry.gender && (
                          <span className="ml-2 text-xs text-stone-500">
                            {entry.gender}
                            {entry.ageGroup ? ` · ${entry.ageGroup}` : ''}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-stone-600 text-sm">
                        {entry.lastCheckpoint}
                        {entry.lastCheckpointTime && (
                          <span
                            className="ml-1 text-xs text-stone-400"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          >
                            {entry.lastCheckpointTime}
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className="text-right text-sm"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {entry.finishTime ?? (
                          <span className="text-stone-400">—</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="hidden md:table-cell text-right text-xs text-stone-600"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        {entry.gap ?? <span className="text-stone-400">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </CardShell>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      className="overflow-hidden rounded-[14px] border bg-white"
      style={{
        borderColor: 'var(--5s-border)',
        boxShadow: 'var(--shadow-xs)',
      }}
    >
      {children}
    </section>
  );
}
