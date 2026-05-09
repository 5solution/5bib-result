'use client';

/**
 * F-009 CheckpointConfigGrid — read-only inline grid (port from F-006
 * CourseDialog Checkpoints tab) showing CP key / name / distance / lat,lng.
 *
 * BR-CM2-10 — Distance field READ-ONLY in F-009 grid (preserves F-008 v2
 * Health Matrix dependency on cp.distanceKm). Editing distance still happens
 * via Settings → Cự ly dialog (CourseDialog Checkpoints tab) per the modal
 * preservation window.
 *
 * NOTE: this grid READS from F-006 CourseMapDataDto (which already exposes
 * checkpoints with lat/lng). We do NOT mutate `key` / `name` / `services`
 * here — those edits remain in CourseDialog. Goal of F-009 grid is
 * a glanceable status table next to the map.
 */

import * as React from 'react';
import { CheckCircle2, AlertCircle, MapPin } from 'lucide-react';
import type { CheckpointWithPositionDto } from '@/lib/course-map-api';
import { EmptyState } from '@/components/ui/EmptyState';

export interface CheckpointConfigGridProps {
  checkpoints: CheckpointWithPositionDto[];
  /** Current Drag mode flag — when on, hint copy changes to "Kéo trên map". */
  manualMode: boolean;
  /** True if course has no GPX yet — hide grid and show empty state. */
  noGpx?: boolean;
}

function formatLatLng(lat?: number, lng?: number): string {
  if (typeof lat !== 'number' || typeof lng !== 'number') return '—';
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function CheckpointConfigGrid({
  checkpoints,
  manualMode,
  noGpx,
}: CheckpointConfigGridProps): React.ReactElement {
  if (noGpx) {
    return (
      <EmptyState
        icon={<MapPin className="size-6 text-stone-400" />}
        title="Cần GPX để định vị checkpoint"
        description="Upload GPX/KML trước, hệ thống sẽ auto-match waypoints với checkpoint keys."
      />
    );
  }

  if (checkpoints.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="Course chưa có checkpoint"
        description="Vào Settings → Cự ly → paste API URL và discover checkpoint keys trước khi quay lại đây."
      />
    );
  }

  return (
    <section
      className="flex flex-col gap-2 rounded-2xl border border-stone-200 bg-white p-4"
      data-testid="checkpoint-config-grid"
      aria-label="Cấu hình checkpoint"
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2
            className="text-sm font-bold tracking-tight text-stone-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Checkpoints ({checkpoints.length})
          </h2>
          <p className="text-xs text-stone-500">
            {manualMode
              ? 'Kéo marker trên bản đồ để cập nhật vị trí. Tự động lưu khi thả.'
              : 'Bật drag mode để chỉnh vị trí. Distance chỉnh ở Settings → Cự ly.'}
          </p>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-left text-[11px] font-semibold uppercase tracking-wider text-stone-500"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <th className="pb-2 pr-3">Trạng thái</th>
              <th className="pb-2 pr-3">Key</th>
              <th className="pb-2 pr-3">Tên</th>
              <th className="pb-2 pr-3">Distance (km)</th>
              <th className="pb-2 pr-3">Vị trí (lat, lng)</th>
            </tr>
          </thead>
          <tbody>
            {checkpoints.map((cp) => {
              const positioned =
                typeof cp.lat === 'number' && typeof cp.lng === 'number';
              return (
                <tr
                  key={cp.key}
                  className="border-t border-stone-100"
                  data-testid={`cp-row-${cp.key}`}
                >
                  <td className="py-2 pr-3">
                    {positioned ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                        title="Đã định vị"
                      >
                        <CheckCircle2 className="size-3" aria-hidden="true" />
                        Đã match
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                        title="Cần kéo thủ công"
                      >
                        <AlertCircle className="size-3" aria-hidden="true" />
                        Chưa match
                      </span>
                    )}
                  </td>
                  <td
                    className="py-2 pr-3 font-mono text-xs text-stone-700"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {cp.key}
                  </td>
                  <td className="py-2 pr-3 text-stone-900">{cp.name}</td>
                  <td className="py-2 pr-3">
                    {/* BR-CM2-10 — READ-ONLY. Distance edited via Settings → Cự ly */}
                    <input
                      type="number"
                      value={typeof cp.distanceKm === 'number' ? cp.distanceKm : ''}
                      disabled
                      readOnly
                      tabIndex={-1}
                      title="Distance chỉ chỉnh được ở Settings → Cự ly dialog (preserve modal use case + Health Matrix dependency)"
                      placeholder="—"
                      className="w-20 cursor-not-allowed rounded border border-stone-200 bg-stone-50 px-2 py-1 text-right text-xs text-stone-600 opacity-70"
                      aria-readonly="true"
                    />
                  </td>
                  <td
                    className="py-2 pr-3 text-xs text-stone-600"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {formatLatLng(cp.lat, cp.lng)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
