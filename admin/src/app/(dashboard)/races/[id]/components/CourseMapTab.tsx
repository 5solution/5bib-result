'use client';

/**
 * F-006 CourseMapTab — admin Course dialog "Map" tab.
 *
 * Server-safe wrapper around the dynamically-imported Leaflet inner.
 * Handles all state UI (empty / uploading / ready / error) per PRD lines
 * 168-176. Fires the upload/delete mutations from `course-map-hooks` and
 * polls `useCourseMapData` for the live preview.
 */
import dynamic from 'next/dynamic';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ElevationChart } from '@/components/course-map/ElevationChart';
import {
  useCourseMapData,
  useDeleteCourseGpx,
  useUploadCourseGpx,
} from '@/lib/course-map-hooks';
import type { GpxParsedDto } from '@/lib/course-map-api';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.gpx,.kml';

const CourseMapTabInner = dynamic(() => import('./CourseMapTabInner'), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] w-full animate-pulse rounded-lg bg-stone-100 md:h-[400px]" />
  ),
});

interface CourseMapTabProps {
  raceId: string;
  /** When null/undefined the course hasn't been saved yet. */
  courseId: string | null | undefined;
}

/** Build a synthetic elevation profile from gpxParsed totals when full points
 *  aren't bundled in the response (Phase 3 may fetch the GeoJSON for richer
 *  curves; for now we just plot a 2-point summary so the section isn't empty). */
function profileFromGpxParsed(
  parsed: GpxParsedDto | undefined,
): { distanceKm: number; elevation: number }[] {
  if (!parsed) return [];
  const min = parsed.minElevation;
  const max = parsed.maxElevation;
  if (typeof min !== 'number' || typeof max !== 'number') return [];
  return [
    { distanceKm: 0, elevation: min },
    { distanceKm: parsed.totalDistanceKm, elevation: max },
  ];
}

export function CourseMapTab({ raceId, courseId }: CourseMapTabProps): React.ReactElement {
  const [manualMode, setManualMode] = React.useState(false);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const courseIdSafe = courseId ?? '';
  const upload = useUploadCourseGpx(raceId, courseIdSafe);
  const remove = useDeleteCourseGpx(raceId, courseIdSafe);
  const mapData = useCourseMapData(raceId, courseIdSafe);

  // Bug 4 — compute unmatched checkpoints (no lat/lng) so we can show a
  // banner above the map prompting the admin to enable manual mode.
  // ⚠️ MUST be called BEFORE any early return — Rules of Hooks: hooks must
  // run in the same order every render. Moving this below the `!courseId`
  // early return causes "Rendered fewer hooks than expected" runtime error.
  const unmatchedCheckpoints = React.useMemo(() => {
    const list = mapData.data?.checkpoints ?? [];
    return list.filter(
      (cp) => typeof cp.lat !== 'number' || typeof cp.lng !== 'number',
    );
  }, [mapData.data?.checkpoints]);

  // ── Empty state for not-yet-saved course ──
  // F-007 Item #3 — reusable EmptyState component (4-element pattern).
  if (!courseId) {
    return (
      <EmptyState
        icon="💾"
        title="Lưu cự ly trước để tải GPX/KML"
        description="Tab Map chỉ khả dụng sau khi cự ly đã được lưu (cần courseId)."
      />
    );
  }

  const onFile = (file: File) => {
    setParseError(null);
    if (file.size > MAX_BYTES) {
      setParseError('File vượt quá 10MB');
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.gpx') && !lower.endsWith('.kml')) {
      setParseError('Chỉ chấp nhận .gpx hoặc .kml');
      return;
    }
    upload.mutate(file, {
      onSuccess: (res) => {
        toast.success(
          `Đã tải lên (${res.gpxParsed.trackPoints} → ${res.gpxParsed.simplifiedPoints} điểm). ` +
            `${res.autoMatchedCheckpoints.length} CP khớp tự động.`,
        );
      },
      onError: (err) => {
        setParseError(err.message);
      },
    });
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = ''; // allow re-uploading same filename
  };

  const onDelete = () => {
    if (!confirm('Xoá GPX/KML đã upload? Vị trí checkpoint thủ công sẽ được giữ lại.')) return;
    remove.mutate(undefined, {
      onSuccess: () => toast.success('Đã xoá file GPX'),
      onError: (err) => toast.error(err.message),
    });
  };

  const isLoading = mapData.isLoading;
  const hasGpx = Boolean(mapData.data?.hasGpx);
  const isUploading = upload.isPending;
  // Bug 8 — when GPX uploaded but course.checkpoints[] is empty (BTC chưa
  // discover từ RR API), nothing can auto-match. Surface a warning banner so
  // admin understands why the map renders polyline-only with no markers.
  const hasNoCheckpointsConfigured = (mapData.data?.checkpoints?.length ?? 0) === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Bug 3 — title + manual-mode toggle inline at TOP of the tab so admin
          doesn't have to scroll past elevation chart to find it. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-stone-900">
          Bản đồ cự ly
        </h3>
        {hasGpx && mapData.data && (
          <Button
            type="button"
            variant={manualMode ? 'default' : 'outline'}
            size="sm"
            onClick={() => setManualMode((v) => !v)}
            style={
              manualMode
                ? { background: '#FF0E65', borderColor: '#FF0E65' }
                : undefined
            }
          >
            {manualMode ? 'Tắt manual mode' : 'Bật manual mode (kéo CP)'}
          </Button>
        )}
      </div>

      {parseError && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          File GPX không hợp lệ: {parseError}
        </div>
      )}

      {isUploading && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-stone-600">Đang xử lý...</div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full animate-pulse"
              style={{ width: '60%', background: '#FF0E65' }}
            />
          </div>
        </div>
      )}

      {!hasGpx && !isLoading && !isUploading && (
        <>
          {/* Bug 10 — 2-step workflow hint above empty drag-drop zone. Helps
              admin discover the API-discover → upload → manual-drag flow before
              they upload a GPX with no checkpoints configured. */}
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            <p className="font-semibold">📋 Workflow:</p>
            <ol className="mt-1 space-y-0.5">
              <li>1️⃣ Tab &quot;Cơ bản&quot; → paste API URL → discover checkpoint keys (TM1, TM2, ...)</li>
              <li>2️⃣ Tab này → upload GPX → hệ thống auto-match waypoint name → checkpoint key</li>
              <li>3️⃣ Bật manual mode → kéo các CP chưa match vào vị trí thật trên map</li>
            </ol>
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 p-6 text-center transition-colors hover:border-[#FF0E65] hover:bg-[#FFE0EC]"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
          >
            <p className="font-display text-sm font-semibold text-stone-700">
              Kéo .gpx hoặc .kml vào đây hoặc bấm chọn file
            </p>
            <p className="text-xs text-stone-500">Tối đa 10MB. Hỗ trợ tracks + waypoints.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={onSelectFile}
            />
          </div>
        </>
      )}

      {hasGpx && mapData.data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-white p-3">
            <div className="flex flex-col">
              <span className="font-display text-sm font-semibold text-stone-900">
                GPX đã được tải lên
              </span>
              <span className="font-mono text-xs text-stone-600">
                {mapData.data.gpxParsed?.trackPoints ?? 0} →{' '}
                {mapData.data.gpxParsed?.simplifiedPoints ?? 0} điểm ·{' '}
                {(mapData.data.gpxParsed?.totalDistanceKm ?? 0).toFixed(2)} km
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                Replace
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDelete}
                disabled={remove.isPending}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                {remove.isPending ? 'Đang xoá...' : 'Delete'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={onSelectFile}
              />
            </div>
          </div>

          {/* Bug 4 — banner above map listing checkpoints needing manual drag.
              Pills are clickable to enable manual mode (visual focus is handled
              by Leaflet's marker pulse in CourseMapTabInner).
              Bug 9 — sub-label clarifies that GPX waypoints (e.g. TP42.1.2) are
              reference-only; RR API is the source-of-truth for checkpoint keys. */}
          {unmatchedCheckpoints.length > 0 && (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-amber-900">
                  ⚠️ Cần kéo thủ công:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {unmatchedCheckpoints.map((cp) => (
                    <span
                      key={cp.key}
                      className="rounded-full border border-amber-400 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-amber-900"
                    >
                      {cp.key}
                    </span>
                  ))}
                </div>
                {!manualMode && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setManualMode(true)}
                    className="ml-auto border-amber-500 text-amber-900 hover:bg-amber-100"
                  >
                    Bật manual mode để kéo thả
                  </Button>
                )}
              </div>
              <span className="text-xs text-stone-500">
                Waypoints khác trong GPX (TP42.1.2, ...) chỉ để tham khảo, không tạo
                checkpoint mới — RR API là source-of-truth cho checkpoint keys.
              </span>
            </div>
          )}

          {/* Bug 8 — banner displayed BELOW the unmatched banner (priority lower)
              when course.checkpoints[] is empty: GPX uploads polyline + bounds
              but cannot auto-match anything because there are no checkpoint keys
              from the RR API. */}
          {hasNoCheckpointsConfigured && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-md border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900"
            >
              <p className="font-semibold">
                💡 Course chưa có checkpoint từ RR API. Map sẽ render polyline + bounds
                nhưng KHÔNG có marker nào auto-match.
              </p>
              <p className="mt-1 text-xs text-blue-800">
                → Vào tab &quot;Cơ bản&quot; paste API URL → discover checkpoints trước khi
                upload GPX để hệ thống auto-match lat/lng.
              </p>
            </div>
          )}

          {mapData.data.gpxSimplifiedUrl && mapData.data.bounds && (
            <CourseMapTabInner
              raceId={raceId}
              courseId={courseId}
              gpxSimplifiedUrl={mapData.data.gpxSimplifiedUrl}
              geoJson={
                (mapData.data.geoJson ?? null) as Record<string, unknown> | null
              }
              bounds={mapData.data.bounds}
              totalDistanceKm={mapData.data.gpxParsed?.totalDistanceKm}
              checkpoints={mapData.data.checkpoints}
              manualMode={manualMode}
              unmatchedKeys={unmatchedCheckpoints.map((cp) => cp.key)}
            />
          )}

          <ElevationChart
            elevationProfile={profileFromGpxParsed(mapData.data.gpxParsed)}
            checkpoints={mapData.data.checkpoints
              .filter((cp) => typeof cp.distanceKm === 'number')
              .map((cp) => ({ distanceKm: cp.distanceKm as number, name: cp.key }))}
            height={150}
          />

          {manualMode && (
            <span className="text-xs text-stone-600">
              Kéo marker trên bản đồ để cập nhật vị trí — tự động lưu khi thả.
            </span>
          )}
        </>
      )}

      {isLoading && !isUploading && (
        <div className="h-[160px] w-full animate-pulse rounded-lg bg-stone-100" />
      )}
    </div>
  );
}
