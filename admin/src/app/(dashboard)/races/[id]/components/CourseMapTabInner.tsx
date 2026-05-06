'use client';

/**
 * F-006 CourseMapTabInner — Leaflet preview inside the admin Course dialog.
 *
 * Imported via `next/dynamic({ ssr: false })` from CourseMapTab so SSR
 * doesn't choke on Leaflet's `window` references. Renders the simplified
 * GeoJSON polyline + numbered checkpoint markers; in "manual mode" markers
 * are draggable and `dragend` fires `useUpdateCheckpointPosition`.
 */
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import * as React from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import { toast } from 'sonner';

import type { CheckpointWithPositionDto, GpxBoundsDto } from '@/lib/course-map-api';
import { useUpdateCheckpointPosition } from '@/lib/course-map-hooks';
import { findNearestPolylinePoint } from '@/components/course-map/SnapToPolyline.helper';

interface CourseMapTabInnerProps {
  raceId: string;
  courseId: string;
  /** Public S3 URL of simplified GeoJSON (LineString FeatureCollection). Used as
   *  fallback when `geoJson` (inlined by backend, BR-CM-11b) is unavailable. */
  gpxSimplifiedUrl: string;
  /** Backend-inlined simplified GeoJSON (BR-CM-11b — bypasses S3 CORS). When
   *  present, no client-side S3 fetch is needed. */
  geoJson?: Record<string, unknown> | null;
  /** WGS84 bounds for fitBounds (BR-CM-04). */
  bounds: GpxBoundsDto;
  /** Total race distance from GPX parse — used to estimate placeholder
   *  position for unmatched CPs along polyline (manual mode UX). */
  totalDistanceKm?: number;
  /** Course checkpoints with optional lat/lng (BR-CM-05). */
  checkpoints: CheckpointWithPositionDto[];
  /** When true, markers are draggable and dragend fires PATCH. */
  manualMode: boolean;
  /** Bug 4/7 — checkpoint keys with no lat/lng yet. When manualMode is on, the
   *  matching markers gain a pulse glow + cursor-grab styling so admins know
   *  which markers need their attention. */
  unmatchedKeys?: string[];
}

/**
 * Escape HTML special characters before interpolating user-controlled strings
 * into Leaflet `divIcon({ html })`. Without this, an admin-controlled checkpoint
 * `key` like `<img src=x onerror=...>` would execute JS on every public race
 * page (TD-F006-07 stored XSS).
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** ─────────── Custom Leaflet DivIcons (per design canvas Artboard 2) ─────────── */

const startIcon = L.divIcon({
  className: '5bib-cm-start',
  html: '<div style="width:28px;height:28px;border-radius:50%;background:#166534;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.25);">▶</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const finishIcon = L.divIcon({
  className: '5bib-cm-finish',
  html: '<div style="width:28px;height:28px;border-radius:4px;background:#FF0E65;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,0.25);">🏁</div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function cpIcon(label: string, hasAid: boolean, pulse: boolean): L.DivIcon {
  // TD-F006-07 — `label` falls back to `cp.key` (admin-controlled string).
  // Escape before interpolating into innerHTML to prevent stored XSS.
  const safeLabel = escapeHtml(String(label));
  const aidBadge = hasAid
    ? '<span style="position:absolute;top:-6px;right:-6px;width:14px;height:14px;border-radius:50%;background:#166534;color:#fff;font-size:9px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;">+</span>'
    : '';
  // Bug 7 — pulse animation + cursor-grab for unmatched markers when admin
  // is in manual mode. Class `cm-pulse` is defined in the inline <style> below.
  const pulseClass = pulse ? ' cm-pulse cm-grab' : '';
  return L.divIcon({
    className: `5bib-cm-cp${pulseClass}`,
    html: `<div style="position:relative;width:26px;height:26px;border-radius:50%;background:#FF0E65;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.25);">${safeLabel}${aidBadge}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function isStartKey(key: string): boolean {
  return key.toLowerCase() === 'start';
}

function isFinishKey(key: string): boolean {
  return key.toLowerCase() === 'finish';
}

function hasAidServices(cp: CheckpointWithPositionDto): boolean {
  const services = cp.services;
  if (!services) return false;
  return Boolean(
    services.water || services.food || services.medical || services.dropBag || services.sleep,
  );
}

/**
 * Estimate a placeholder position for an unmatched checkpoint so it can be
 * rendered (and dragged) in manual mode. Strategy:
 *   1. If we have BOTH cp.distanceKm AND polyline → place at proportional
 *      ratio along polyline (best UX — marker appears near where the user
 *      probably wants to drop it).
 *   2. Otherwise → place at race bounds center (fallback).
 *
 * Without this, unmatched CPs never render → user has no marker to drag →
 * manual mode is unusable for unmatched waypoints.
 */
function estimatePlaceholderPosition(
  distanceKm: number | undefined,
  totalDistanceKm: number | undefined,
  polyline: [number, number][],
  bounds: GpxBoundsDto,
): [number, number] {
  if (
    typeof distanceKm === 'number' &&
    typeof totalDistanceKm === 'number' &&
    totalDistanceKm > 0 &&
    polyline.length > 1
  ) {
    const ratio = Math.max(0, Math.min(1, distanceKm / totalDistanceKm));
    const idx = Math.round(ratio * (polyline.length - 1));
    const point = polyline[Math.min(idx, polyline.length - 1)];
    if (point) return point;
  }
  // Fallback: bounds center
  return [
    (bounds.north + bounds.south) / 2,
    (bounds.east + bounds.west) / 2,
  ];
}

/**
 * BR-CM-13 — Sovereignty safeguard.
 * Lock map view to race bounds + small padding so user cannot pan/zoom out
 * to surrounding regions. OpenStreetMap default tiles do NOT label Hoàng Sa
 * & Trường Sa as Vietnamese sovereign — Vietnamese law requires correct
 * sovereignty labelling on public-facing maps. By restricting `maxBounds` +
 * `minZoom`, the user can only view the race area, never the contested
 * island regions. Future: switch tile provider to Goong Maps (Vietnamese,
 * sovereignty-correct) — see TD-F006.
 */
function FitBounds({ bounds }: { bounds: GpxBoundsDto }): null {
  const map = useMap();
  React.useEffect(() => {
    const sw: [number, number] = [bounds.south, bounds.west];
    const ne: [number, number] = [bounds.north, bounds.east];
    // Pad bounds 5% so race route doesn't touch viewport edge but user can't
    // see surrounding region.
    const latPad = (bounds.north - bounds.south) * 0.05;
    const lngPad = (bounds.east - bounds.west) * 0.05;
    const maxBounds: [[number, number], [number, number]] = [
      [bounds.south - latPad, bounds.west - lngPad],
      [bounds.north + latPad, bounds.east + lngPad],
    ];
    map.fitBounds([sw, ne], { padding: [20, 20] });
    // Hard-lock pan within race area + record current zoom as minZoom so
    // user cannot zoom out beyond the race region.
    map.setMaxBounds(maxBounds);
    map.options.maxBoundsViscosity = 1.0;
    // After fitBounds, current zoom is minimum allowed.
    const currentZoom = map.getZoom();
    map.setMinZoom(Math.max(currentZoom - 1, 0));
  }, [map, bounds]);
  return null;
}

interface GeoJsonLineString {
  type: 'Feature';
  geometry: { type: 'LineString'; coordinates: [number, number, number?][] };
  properties?: Record<string, unknown>;
}
interface GeoJsonFC {
  type: 'FeatureCollection';
  features: GeoJsonLineString[];
}

function isLineStringFeature(feature: unknown): feature is GeoJsonLineString {
  if (!feature || typeof feature !== 'object') return false;
  const f = feature as { geometry?: { type?: unknown; coordinates?: unknown } };
  return f.geometry?.type === 'LineString' && Array.isArray(f.geometry?.coordinates);
}

function extractLineString(
  data: GeoJsonFC | GeoJsonLineString | Record<string, unknown>,
): GeoJsonLineString | undefined {
  if ('features' in data && Array.isArray((data as GeoJsonFC).features)) {
    return (data as GeoJsonFC).features.find(isLineStringFeature);
  }
  return isLineStringFeature(data) ? data : undefined;
}

export default function CourseMapTabInner({
  raceId,
  courseId,
  gpxSimplifiedUrl,
  geoJson,
  bounds,
  totalDistanceKm,
  checkpoints,
  manualMode,
  unmatchedKeys,
}: CourseMapTabInnerProps): React.ReactElement {
  const unmatchedSet = React.useMemo(
    () => new Set(unmatchedKeys ?? []),
    [unmatchedKeys],
  );
  const [polylineLatLngs, setPolylineLatLngs] = React.useState<[number, number][]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  // F-007 Item #2 — snap-to-polyline toggle. Default ON for accuracy goal
  // ≥95% per UAT-04. Admin can disable for off-route placements (e.g. CP
  // intentionally a few metres off the line at a building entrance).
  const [snapEnabled, setSnapEnabled] = React.useState(true);
  const updateCp = useUpdateCheckpointPosition(raceId, courseId);

  React.useEffect(() => {
    let cancelled = false;
    setLoadError(null);

    // BR-CM-11b — prefer inlined geoJson from backend (no CORS).
    if (geoJson) {
      const feature = extractLineString(geoJson);
      if (!feature) {
        setLoadError('GeoJSON không chứa LineString.');
        return;
      }
      const coords = feature.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
      setPolylineLatLngs(coords);
      return;
    }

    // Fallback — direct S3 fetch (legacy path; only reached if backend
    // inline failed). Same-origin in dev because admin proxies; production
    // S3 must allow CORS.
    fetch(gpxSimplifiedUrl)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as GeoJsonFC | GeoJsonLineString;
      })
      .then((data) => {
        if (cancelled) return;
        const feature = extractLineString(data);
        if (!feature) {
          setLoadError('GeoJSON không chứa LineString.');
          return;
        }
        // GeoJSON [lng, lat, ele?] → Leaflet [lat, lng]
        const coords = feature.geometry.coordinates.map(
          ([lng, lat]) => [lat, lng] as [number, number],
        );
        setPolylineLatLngs(coords);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Không tải được GeoJSON');
      });
    return () => {
      cancelled = true;
    };
  }, [gpxSimplifiedUrl, geoJson]);

  const handleDragEnd = React.useCallback(
    (cpKey: string, rawLat: number, rawLng: number) => {
      // F-007 Item #2 — snap to nearest polyline vertex within 50m. Pure UX
      // helper; only applies when snapEnabled and we have polyline data.
      let finalLat = rawLat;
      let finalLng = rawLng;
      let snapNote = '';
      if (snapEnabled && polylineLatLngs.length > 1) {
        const result = findNearestPolylinePoint(
          [rawLat, rawLng],
          polylineLatLngs,
          50,
        );
        if (result) {
          if (result.snapped) {
            finalLat = result.snappedLatLng[0];
            finalLng = result.snappedLatLng[1];
            snapNote = ` · Bám đường (${Math.round(result.distanceMeters)}m)`;
          } else {
            snapNote = ` · Lệch đường ${Math.round(result.distanceMeters)}m`;
          }
        }
      }
      updateCp.mutate(
        { key: cpKey, lat: finalLat, lng: finalLng },
        {
          onSuccess: () => toast.success(`Đã lưu vị trí ${cpKey}${snapNote}`),
          onError: (err) => toast.error(err.message ?? 'Lưu vị trí thất bại'),
        },
      );
    },
    [updateCp, snapEnabled, polylineLatLngs],
  );

  // Number CP markers excluding start/finish for readable 1, 2, 3...
  const cpCounter: Record<string, number> = {};
  let cpIdx = 0;
  for (const cp of checkpoints) {
    if (!isStartKey(cp.key) && !isFinishKey(cp.key)) {
      cpIdx += 1;
      cpCounter[cp.key] = cpIdx;
    }
  }

  return (
    <div className="relative">
      {loadError && (
        <div className="mb-2 rounded-md border border-red-300 bg-red-50 p-2 text-xs text-red-700">
          Không tải được route GeoJSON: {loadError}
        </div>
      )}
      <MapContainer
        bounds={[
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ]}
        boundsOptions={{ padding: [20, 20] }}
        scrollWheelZoom
        className="h-[300px] w-full overflow-hidden rounded-lg md:h-[400px]"
        maxBoundsViscosity={1.0}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <FitBounds bounds={bounds} />
        {polylineLatLngs.length > 1 && (
          <Polyline positions={polylineLatLngs} pathOptions={{ color: '#FF0E65', weight: 4, opacity: 0.85 }} />
        )}
        {checkpoints.map((cp) => {
          // Bug fix — unmatched CPs (no lat/lng) MUST still render in manual
          // mode so user can DRAG them. Place at estimated position along
          // polyline based on distanceKm proportional ratio. Without this
          // fallback the catch-22 bites: manual mode → markers don't render
          // → user has nothing to drag.
          let lat: number | undefined = cp.lat;
          let lng: number | undefined = cp.lng;
          const isPlaceholder = typeof lat !== 'number' || typeof lng !== 'number';
          if (isPlaceholder) {
            // Skip placeholder markers when manual mode is OFF — keeps the
            // map clean for normal viewing. Only show when admin opts in.
            if (!manualMode) return null;
            const placeholderPos = estimatePlaceholderPosition(
              cp.distanceKm,
              totalDistanceKm,
              polylineLatLngs,
              bounds,
            );
            lat = placeholderPos[0];
            lng = placeholderPos[1];
          }
          const isUnmatchedNeedingAttention = manualMode && unmatchedSet.has(cp.key);
          const icon = isStartKey(cp.key)
            ? startIcon
            : isFinishKey(cp.key)
              ? finishIcon
              : cpIcon(
                  String(cpCounter[cp.key] ?? cp.key),
                  hasAidServices(cp),
                  isUnmatchedNeedingAttention,
                );
          return (
            <Marker
              // Force re-mount when manualMode toggles. React-leaflet does
              // NOT sync the `draggable` prop to the underlying Leaflet
              // marker after mount — without keying on manualMode the marker
              // stays in its mounted draggable state, so dragend never
              // fires and the PATCH endpoint is never hit.
              key={`${cp.key}-${manualMode ? 'drag' : 'static'}`}
              position={[lat as number, lng as number]}
              icon={icon}
              opacity={isPlaceholder ? 0.7 : 1}
              draggable={manualMode}
              eventHandlers={
                manualMode
                  ? {
                      dragend: (e) => {
                        const target = e.target as L.Marker;
                        const ll = target.getLatLng();
                        handleDragEnd(cp.key, ll.lat, ll.lng);
                      },
                    }
                  : undefined
              }
              title={
                manualMode
                  ? isPlaceholder
                    ? `${cp.name} — chưa khớp GPX, kéo thả để định vị`
                    : `${cp.name} — Kéo thả để định vị marker`
                  : cp.name
              }
            />
          );
        })}
      </MapContainer>
      {/* Bug 7 — pulse keyframes + grab cursor for unmatched markers in
          manual mode. Scoped via class so other Leaflet markers stay still. */}
      <style jsx global>{`
        .leaflet-marker-icon.cm-grab,
        .leaflet-marker-icon.cm-grab > div {
          cursor: grab;
        }
        .leaflet-marker-icon.cm-grab:active,
        .leaflet-marker-icon.cm-grab:active > div {
          cursor: grabbing;
        }
        .leaflet-marker-icon.cm-pulse {
          animation: cm-pulse-anim 1.4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          border-radius: 50%;
        }
        @keyframes cm-pulse-anim {
          0%,
          100% {
            box-shadow: 0 0 0 0 rgba(255, 14, 101, 0.6);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(255, 14, 101, 0);
          }
        }
        .leaflet-container.cm-cursor-grab {
          cursor: grab;
        }
      `}</style>
      {manualMode && (
        <>
          <div
            className="absolute right-3 top-3 z-[1000] rounded-md px-2.5 py-1 text-xs font-medium text-white shadow-md"
            style={{ background: '#FF0E65' }}
          >
            Drag mode active — kéo marker để di chuyển
          </div>
          {/* F-007 Item #2 — snap toggle. Sits below the drag-mode badge so
              both controls cluster top-right. */}
          <label
            className="absolute right-3 top-12 z-[1000] flex cursor-pointer items-center gap-1.5 rounded-md bg-white px-2.5 py-1 text-xs font-medium text-stone-700 shadow-md ring-1 ring-stone-200"
            title="Khi bật, marker thả ra sẽ tự động bám vào đường đi gần nhất nếu trong vòng 50m"
          >
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={(e) => setSnapEnabled(e.target.checked)}
              className="size-3.5 cursor-pointer accent-[#FF0E65]"
            />
            Bám đường tự động (50m)
          </label>
        </>
      )}
    </div>
  );
}
