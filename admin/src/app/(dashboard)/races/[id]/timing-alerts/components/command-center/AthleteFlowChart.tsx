'use client';

/**
 * FEATURE-005 — Athlete Flow Chart component (Command Center).
 *
 * Reuse `checkpointProgression` từ F-002 snapshot. Per design canvas Artboard 3:
 * - Course tabs ở top
 * - Bar colors theo health (good blue / warn amber / critical magenta)
 * - Vertical horizontal bars per checkpoint (consistent với F-002 style)
 *
 * Note: F-002 đã dùng pure Tailwind bars trong CockpitTab `ProgressionRow`.
 * Component này extract layout đó + thêm course tab navigation theo F-005 design.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { CheckpointProgression } from '@/lib/timing-alert-api';

interface AthleteFlowChartProps {
  progression: CheckpointProgression[];
}

export function AthleteFlowChart({ progression }: AthleteFlowChartProps) {
  const [activeCourseId, setActiveCourseId] = useState<string>(
    progression[0]?.courseId ?? '',
  );

  if (progression.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-stone-600">
          Chưa có course nào có checkpoints config — chưa render được chart flow.
        </CardContent>
      </Card>
    );
  }

  const active =
    progression.find((p) => p.courseId === activeCourseId) ?? progression[0];

  return (
    <Card>
      <CardContent className="p-0">
        {/* Course tabs */}
        <div className="flex flex-wrap gap-1 border-b border-stone-200 bg-stone-50 px-3 py-2">
          {progression.map((p) => {
            const isActive = p.courseId === active.courseId;
            return (
              <button
                key={p.courseId}
                type="button"
                onClick={() => setActiveCourseId(p.courseId)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-stone-700 hover:bg-stone-200'
                }`}
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                {p.courseName}
                {p.distanceKm !== null && (
                  <span className="ml-1 opacity-75">{p.distanceKm}km</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          {active.points.length === 0 ? (
            <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              ⚠ Course chưa config checkpoints. Mở tab Course settings để
              auto-derive.
            </div>
          ) : active.startedCount === 0 ? (
            <div className="rounded border border-stone-200 bg-stone-50 p-3 text-sm text-stone-600">
              ⏳ Chưa có athlete nào qua điểm nào.
            </div>
          ) : (
            <div className="space-y-2">
              <div
                className="text-xs text-stone-600"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                {active.startedCount.toLocaleString('vi-VN')} VĐV đã xuất phát
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[480px] space-y-2">
                  {active.points.map((pt, idx) => {
                    const ratio = pt.passedRatio;
                    const prevRatio =
                      idx > 0 ? active.points[idx - 1].passedRatio : ratio;
                    const drop = prevRatio - ratio;
                    const isAnomaly =
                      idx > 0 &&
                      drop > 0.3 &&
                      idx < active.points.length - 1;
                    const barColor = isAnomaly
                      ? 'bg-[#FF0E65]'
                      : ratio >= 0.95
                        ? 'bg-emerald-600'
                        : ratio >= 0.7
                          ? 'bg-blue-600'
                          : 'bg-amber-500';

                    return (
                      <div
                        key={pt.key}
                        className="flex items-center gap-3 text-sm"
                      >
                        <div
                          className="w-32 shrink-0 truncate font-medium"
                          title={pt.name}
                          style={{ fontFamily: 'var(--font-sans)' }}
                        >
                          {pt.name}
                          {pt.distanceKm !== null && (
                            <span
                              className="ml-1 text-xs text-stone-500"
                              style={{ fontFamily: 'var(--font-mono)' }}
                            >
                              {pt.distanceKm}km
                            </span>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="h-5 w-full overflow-hidden rounded bg-stone-200">
                            <div
                              className={`h-full transition-all ${barColor}`}
                              style={{
                                width: `${Math.max(2, Math.round(ratio * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div
                          className="w-32 shrink-0 text-right text-xs text-stone-700"
                          style={{ fontFamily: 'var(--font-mono)' }}
                        >
                          {pt.passedCount.toLocaleString('vi-VN')} /{' '}
                          {pt.expectedCount.toLocaleString('vi-VN')}
                          <span className="ml-1 text-stone-500">
                            ({(ratio * 100).toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
