'use client';

/**
 * F-009 GpxUploadSection — standalone upload card (port from F-006 CourseMapTab
 * upload UI). State machine 5 states (BR-CM2-08):
 *   - Empty       → drag-drop zone + workflow hint
 *   - Uploading   → progress bar
 *   - Parsing     → handled server-side; same Uploading visual
 *   - MapReady    → file info card + Replace/Delete buttons
 *   - ParseError  → red banner + retry zone
 *
 * Reuses F-006 hooks (useUploadCourseGpx, useDeleteCourseGpx) — no new
 * endpoints, no SDK regen.
 */

import * as React from 'react';
import { toast } from 'sonner';
import { UploadCloud, FileCheck2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useDeleteCourseGpx,
  useUploadCourseGpx,
} from '@/lib/course-map-hooks';
import type { CourseMapDataDto } from '@/lib/course-map-api';

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = '.gpx,.kml';

export interface GpxUploadSectionProps {
  raceId: string;
  courseId: string;
  /** Current map-data — drives Empty vs MapReady decision. */
  mapData: CourseMapDataDto | null | undefined;
  isLoading?: boolean;
  /** Optional: when course.checkpoints[] is empty, surface the discovery hint. */
  hasNoCheckpointsConfigured?: boolean;
}

export function GpxUploadSection({
  raceId,
  courseId,
  mapData,
  isLoading,
  hasNoCheckpointsConfigured,
}: GpxUploadSectionProps): React.ReactElement {
  const [parseError, setParseError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const upload = useUploadCourseGpx(raceId, courseId);
  const remove = useDeleteCourseGpx(raceId, courseId);

  const onFile = React.useCallback(
    (file: File) => {
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
    },
    [upload],
  );

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = '';
  };

  const onDelete = () => {
    if (
      !window.confirm(
        'Xoá GPX/KML đã upload? Vị trí checkpoint thủ công sẽ được giữ lại.',
      )
    ) {
      return;
    }
    remove.mutate(undefined, {
      onSuccess: () => toast.success('Đã xoá file GPX'),
      onError: (err) => toast.error(err.message),
    });
  };

  const hasGpx = Boolean(mapData?.hasGpx);
  const isUploading = upload.isPending;
  const isDeleting = remove.isPending;

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4"
      data-testid="gpx-upload-section"
      aria-label="Upload GPX/KML"
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <h2
            className="text-sm font-bold tracking-tight text-stone-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            File GPX / KML
          </h2>
          <p className="text-xs text-stone-500">
            Tối đa 10MB. Hỗ trợ tracks + waypoints. Auto-match waypoint name → checkpoint key.
          </p>
        </div>
      </header>

      {parseError && (
        <div
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          <p className="font-semibold">File GPX không hợp lệ</p>
          <p className="text-xs">{parseError}</p>
        </div>
      )}

      {isUploading && (
        <div className="space-y-2" data-testid="gpx-uploading">
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
          {hasNoCheckpointsConfigured && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
              <p className="font-semibold">📋 Workflow gợi ý:</p>
              <ol className="mt-1 space-y-0.5">
                <li>
                  1️⃣ Settings → Cự ly → paste API URL → discover checkpoint keys
                </li>
                <li>
                  2️⃣ Tab này → upload GPX → auto-match waypoint name
                </li>
                <li>3️⃣ Bật drag mode → kéo CP chưa match</li>
              </ol>
            </div>
          )}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
            className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 bg-stone-50 p-6 text-center transition-colors hover:border-[#FF0E65] hover:bg-[#FFE0EC]"
            data-testid="gpx-dropzone"
          >
            <UploadCloud
              className="size-8 text-stone-400 group-hover:text-[#FF0E65]"
              aria-hidden="true"
            />
            <p
              className="text-sm font-semibold text-stone-700"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Kéo .gpx hoặc .kml vào đây hoặc bấm để chọn file
            </p>
            <p className="text-xs text-stone-500">
              Hệ thống sẽ simplify polyline (Douglas-Peucker) và auto-match
              waypoint với checkpoint keys.
            </p>
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

      {hasGpx && mapData && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-stone-50 p-3"
          data-testid="gpx-ready"
        >
          <div className="flex items-center gap-3">
            <FileCheck2 className="size-5 text-emerald-600" aria-hidden="true" />
            <div className="flex flex-col">
              <span
                className="text-sm font-semibold text-stone-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                GPX đã được tải lên
              </span>
              <span
                className="text-xs text-stone-600"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {mapData.gpxParsed?.trackPoints ?? 0} →{' '}
                {mapData.gpxParsed?.simplifiedPoints ?? 0} điểm ·{' '}
                {(mapData.gpxParsed?.totalDistanceKm ?? 0).toFixed(2)} km
              </span>
            </div>
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
              disabled={isDeleting}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              <Trash2 className="mr-1 size-3.5" aria-hidden="true" />
              {isDeleting ? 'Đang xoá...' : 'Xoá'}
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
      )}

      {isLoading && !isUploading && (
        <div className="h-[140px] w-full animate-pulse rounded-lg bg-stone-100" />
      )}
    </section>
  );
}
