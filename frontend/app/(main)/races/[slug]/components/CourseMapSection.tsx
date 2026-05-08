'use client';

/**
 * F-006 CourseMapSection — public race detail "Course Map" section.
 *
 * Renders course pills picker + stats line + Leaflet map (lazy GeoJSON
 * fetch from `gpxSimplifiedUrl`) + ElevationChart + checkpoint horizontal
 * flow. Gated by BR-CM-07 (caller must not render this section when race
 * status === 'draft' — this component handles 404 / hasGpx=false states
 * defensively but skips render when data is null).
 */
import dynamic from 'next/dynamic';
import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Mountain, Route, MapPin } from 'lucide-react';

import { ElevationChart } from '@/components/course-map/ElevationChart';
import type { ElevationCheckpoint, ElevationPoint } from '@/components/course-map/ElevationChart';
import { racesControllerGetCourseMapData } from '@/lib/api-generated/sdk.gen';
import type {
  CheckpointWithPositionDto,
  CourseMapDataDto,
  GpxParsedDto,
} from '@/lib/api-generated/types.gen';

const CourseMapInner = dynamic(() => import('./CourseMapInner'), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] w-full animate-pulse rounded-lg bg-stone-100 md:h-[400px]" />
  ),
});

interface CoursePill {
  /** Course id (DB courseId) — used for API call. */
  id: string;
  /** Display label, e.g. "21K". */
  label: string;
  /** Optional full course name. */
  name?: string;
}

interface CourseMapSectionProps {
  raceId: string;
  courses: CoursePill[];
}

const PILL_COLORS = [
  { active: 'bg-blue-600 text-white border-blue-600', idle: 'bg-white text-slate-700 border-slate-300 hover:border-blue-400' },
  { active: 'bg-orange-600 text-white border-orange-600', idle: 'bg-white text-slate-700 border-slate-300 hover:border-orange-400' },
  { active: 'bg-emerald-600 text-white border-emerald-600', idle: 'bg-white text-slate-700 border-slate-300 hover:border-emerald-400' },
  { active: 'bg-purple-600 text-white border-purple-600', idle: 'bg-white text-slate-700 border-slate-300 hover:border-purple-400' },
  { active: 'bg-rose-600 text-white border-rose-600', idle: 'bg-white text-slate-700 border-slate-300 hover:border-rose-400' },
];

/**
 * Build elevation profile from a GeoJSON LineString. Prefers the backend-
 * inlined `geoJson` (BR-CM-11b — no CORS) and falls back to fetching
 * `gpxSimplifiedUrl` directly for backward compat.
 *
 * Phase 1 backend returns `gpxParsed.{totalDistanceKm, elevationGain/Loss}`
 * aggregates only — we derive the sampled elevation profile here so the chart
 * matches the actual track without bloating the API payload further.
 */
function useElevationProfile(
  geoJson: Record<string, unknown> | null | undefined,
  gpxSimplifiedUrl: string | undefined,
): ElevationPoint[] {
  const [profile, setProfile] = React.useState<ElevationPoint[]>([]);

  React.useEffect(() => {
    const buildFromData = (data: unknown): ElevationPoint[] => {
      const features =
        data && typeof data === 'object' && 'features' in data
          ? (data as { features: Array<{ geometry?: { type?: string; coordinates?: [number, number, number?][] } }> }).features
          : null;
      const lineCoords = features?.find((f) => f.geometry?.type === 'LineString')?.geometry?.coordinates;
      if (!Array.isArray(lineCoords) || lineCoords.length < 2) return [];
      const out: ElevationPoint[] = [];
      let cumKm = 0;
      let prevLat: number | null = null;
      let prevLng: number | null = null;
      for (const [lng, lat, ele] of lineCoords) {
        if (typeof lng !== 'number' || typeof lat !== 'number') continue;
        if (prevLat !== null && prevLng !== null) {
          cumKm += haversineKm(prevLat, prevLng, lat, lng);
        }
        out.push({ distanceKm: cumKm, elevation: typeof ele === 'number' ? ele : 0 });
        prevLat = lat;
        prevLng = lng;
      }
      if (out.every((p) => p.elevation === 0)) return [];
      return out;
    };

    // BR-CM-11b — backend pre-inlined GeoJSON; no CORS round-trip needed.
    if (geoJson) {
      setProfile(buildFromData(geoJson));
      return;
    }
    if (!gpxSimplifiedUrl) {
      setProfile([]);
      return;
    }
    let cancelled = false;
    fetch(gpxSimplifiedUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (cancelled || !data) return;
        setProfile(buildFromData(data));
      })
      .catch(() => {
        if (!cancelled) setProfile([]);
      });
    return () => {
      cancelled = true;
    };
  }, [geoJson, gpxSimplifiedUrl]);

  return profile;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function checkpointEmoji(cp: CheckpointWithPositionDto): string {
  const services = cp.services as Record<string, unknown> | undefined;
  if (!services) return '';
  const parts: string[] = [];
  if (services.water) parts.push('💧');
  if (services.food) parts.push('🍌');
  if (services.medical) parts.push('🏥');
  return parts.join(' ');
}

function isStartKey(key: string): boolean {
  return key.toLowerCase() === 'start';
}
function isFinishKey(key: string): boolean {
  return key.toLowerCase() === 'finish';
}

export function CourseMapSection({ raceId, courses }: CourseMapSectionProps): React.ReactElement | null {
  const [selectedId, setSelectedId] = React.useState<string>(() => courses[0]?.id ?? '');

  React.useEffect(() => {
    // If parent course list changes (race re-fetch), realign selection.
    if (courses.length === 0) return;
    if (!courses.some((c) => c.id === selectedId)) {
      setSelectedId(courses[0].id);
    }
  }, [courses, selectedId]);

  const { data, isLoading, isError } = useQuery<CourseMapDataDto | null>({
    queryKey: ['course-map-data', raceId, selectedId],
    queryFn: async () => {
      const res = await racesControllerGetCourseMapData({
        path: { raceId, courseId: selectedId },
      });
      if (res.error) {
        // 404 → race draft (BR-CM-07) or course missing → render nothing
        const status = res.response?.status;
        if (status === 404) return null;
        throw new Error(`HTTP ${status ?? 0}`);
      }
      return (res.data ?? null) as CourseMapDataDto | null;
    },
    enabled: Boolean(raceId) && Boolean(selectedId),
    staleTime: 60_000,
  });

  // BR-CM-11b — backend inlines geoJson in the response so we don't need a
  // second CORS-y fetch to S3 from the browser.
  const inlinedGeoJson = (data?.geoJson ?? null) as Record<string, unknown> | null;
  const elevationProfile = useElevationProfile(inlinedGeoJson, data?.gpxSimplifiedUrl);
  const elevationCheckpoints: ElevationCheckpoint[] = (data?.checkpoints ?? [])
    .filter((cp): cp is CheckpointWithPositionDto & { distanceKm: number } => typeof cp.distanceKm === 'number')
    .map((cp) => ({ distanceKm: cp.distanceKm, name: cp.name || cp.key }));

  // Hide entire section when no courses or backend says draft (404)
  if (courses.length === 0) return null;
  if (!isLoading && data === null) return null;

  return (
    <section
      aria-label="Course map"
      className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6"
      style={{ background: '#FAF8F5' }}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2
          className="text-xl md:text-2xl font-black text-slate-900"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <Route className="inline-block w-5 h-5 mr-2 text-blue-600" />
          Course Map
        </h2>

        {/* Course pills picker */}
        <div role="tablist" aria-label="Chọn cự ly" className="flex flex-wrap gap-2">
          {courses.map((c, i) => {
            const active = c.id === selectedId;
            const palette = PILL_COLORS[i % PILL_COLORS.length];
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={active}
                aria-controls="course-map-panel"
                onClick={() => setSelectedId(c.id)}
                className={`px-3 py-1.5 text-sm font-bold border rounded-full transition-all ${active ? palette.active : palette.idle}`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div id="course-map-panel" role="tabpanel">
        {isLoading && (
          <div className="h-[300px] w-full animate-pulse rounded-lg bg-stone-100 md:h-[400px]" />
        )}
        {isError && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            Không tải được dữ liệu bản đồ. Vui lòng thử lại.
          </div>
        )}
        {!isLoading && !isError && data && !data.hasGpx && (
          // F-007 Item #3 — public empty-state mirroring the admin EmptyState
          // pattern (icon + title + description, no CTA for athletes since
          // they can't fix it themselves).
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center"
          >
            <Mountain className="h-10 w-10 text-stone-400" aria-hidden="true" />
            <p className="text-sm font-semibold text-stone-700">
              Chưa có bản đồ cự ly
            </p>
            <p className="max-w-md text-xs text-stone-500">
              BTC sẽ cập nhật bản đồ chi tiết và độ cao trước race day.
            </p>
          </div>
        )}
        {!isLoading && !isError && data && data.hasGpx && data.gpxSimplifiedUrl && data.bounds && (
          <div className="flex flex-col gap-4">
            {/* Stats line */}
            <StatsLine parsed={data.gpxParsed} />

            {/* Map */}
            <CourseMapInner
              gpxSimplifiedUrl={data.gpxSimplifiedUrl}
              geoJson={inlinedGeoJson}
              bounds={data.bounds}
              checkpoints={data.checkpoints}
            />

            {/* Elevation chart */}
            <ElevationChart
              elevationProfile={elevationProfile}
              checkpoints={elevationCheckpoints}
              height={150}
            />

            {/* Checkpoint horizontal flow */}
            <CheckpointFlow checkpoints={data.checkpoints} />
          </div>
        )}
      </div>
    </section>
  );
}

function StatsLine({ parsed }: { parsed: GpxParsedDto | undefined }): React.ReactElement | null {
  if (!parsed) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-sm text-slate-700">
      <span className="flex items-center gap-1.5">
        <Route className="h-4 w-4 text-slate-500" />
        <span className="font-bold text-slate-900">{parsed.totalDistanceKm.toFixed(2)}km</span>
      </span>
      {typeof parsed.elevationGain === 'number' && (
        <span className="flex items-center gap-1">
          <span className="text-emerald-600">↑</span>
          <span className="font-bold text-slate-900">{Math.round(parsed.elevationGain)}m</span>
        </span>
      )}
      {typeof parsed.elevationLoss === 'number' && (
        <span className="flex items-center gap-1">
          <span className="text-rose-600">↓</span>
          <span className="font-bold text-slate-900">{Math.round(parsed.elevationLoss)}m</span>
        </span>
      )}
    </div>
  );
}

function CheckpointFlow({ checkpoints }: { checkpoints: CheckpointWithPositionDto[] }): React.ReactElement | null {
  if (checkpoints.length === 0) return null;

  // Bug 5 — sort by distanceKm ascending so Start (≈0km) is first and Finish
  // (≈totalKm) is last. When distanceKm is missing we anchor Start to 0 and
  // Finish to +Infinity (so it stays last) — vendors regularly omit Start km.
  const distFor = (cp: CheckpointWithPositionDto): number => {
    if (typeof cp.distanceKm === 'number') return cp.distanceKm;
    if (isStartKey(cp.key)) return 0;
    if (isFinishKey(cp.key)) return Number.POSITIVE_INFINITY;
    return Number.MAX_SAFE_INTEGER;
  };
  const sorted = [...checkpoints].sort((a, b) => distFor(a) - distFor(b));

  return (
    <div
      className="flex items-stretch gap-2 overflow-x-auto pb-2"
      role="list"
      aria-label="Các điểm trên đường đua"
    >
      {sorted.map((cp, idx) => {
        const start = isStartKey(cp.key);
        const finish = isFinishKey(cp.key);
        const emoji = checkpointEmoji(cp);
        const distanceLabel =
          typeof cp.distanceKm === 'number' ? `${cp.distanceKm.toFixed(1)}km` : cp.distance ?? '';
        return (
          <React.Fragment key={cp.key}>
            <div
              role="listitem"
              className={`min-w-[110px] shrink-0 rounded-lg border p-2 text-center ${
                start
                  ? 'border-emerald-500 bg-emerald-50'
                  : finish
                    ? 'border-rose-500 bg-rose-50'
                    : 'border-slate-200 bg-white'
              }`}
            >
              <div className="text-base">
                {start ? '★' : finish ? '🏁' : <MapPin className="inline h-4 w-4 text-blue-600" />}
              </div>
              <div className="mt-0.5 text-xs font-bold text-slate-900 truncate">{cp.name || cp.key}</div>
              {distanceLabel && (
                <div className="mt-0.5 font-mono text-[11px] text-slate-500">{distanceLabel}</div>
              )}
              {emoji && <div className="mt-0.5 text-sm leading-none">{emoji}</div>}
            </div>
            {idx < sorted.length - 1 && (
              <div className="flex items-center text-slate-400" aria-hidden="true">
                →
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default CourseMapSection;
