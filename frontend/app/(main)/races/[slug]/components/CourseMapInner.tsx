'use client';

/**
 * F-006 CourseMapInner — public Leaflet preview for race detail page.
 *
 * Imported via `next/dynamic({ ssr: false })` from CourseMapSection so SSR
 * doesn't choke on Leaflet's `window` references. Read-only view: no manual
 * drag, no upload, no delete (admin-only). Uses `scrollWheelZoom: false` to
 * avoid scroll-hijack on the long race detail page (BR-CM-08 design intent).
 */
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import * as React from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';

import type {
  CheckpointWithPositionDto,
  GpxBoundsDto,
} from '@/lib/api-generated/types.gen';

interface CourseMapInnerProps {
  /** Public S3 URL of simplified GeoJSON (LineString FeatureCollection). */
  gpxSimplifiedUrl: string;
  /** WGS84 bounds for fitBounds (BR-CM-04). */
  bounds: GpxBoundsDto;
  /** Course checkpoints with optional lat/lng (BR-CM-05). */
  checkpoints: CheckpointWithPositionDto[];
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

function cpIcon(label: string, hasAid: boolean): L.DivIcon {
  // TD-F006-07 — `label` falls back to `cp.key` (admin-controlled string).
  // Escape before interpolating into innerHTML to prevent stored XSS.
  const safeLabel = escapeHtml(String(label));
  const aidBadge = hasAid
    ? '<span style="position:absolute;top:-6px;right:-6px;width:14px;height:14px;border-radius:50%;background:#166534;color:#fff;font-size:9px;display:flex;align-items:center;justify-content:center;border:2px solid #fff;">+</span>'
    : '';
  return L.divIcon({
    className: '5bib-cm-cp',
    html: `<div style="position:relative;width:26px;height:26px;border-radius:50%;background:#1D49FF;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;box-shadow:0 2px 6px rgba(0,0,0,0.25);">${safeLabel}${aidBadge}</div>`,
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
  const s = services as Record<string, unknown>;
  return Boolean(s.water || s.food || s.medical || s.dropBag || s.sleep);
}

/** Lightweight bounds-fitter that hooks into the map instance once on mount. */
function FitBounds({ bounds }: { bounds: GpxBoundsDto }): null {
  const map = useMap();
  React.useEffect(() => {
    map.fitBounds(
      [
        [bounds.south, bounds.west],
        [bounds.north, bounds.east],
      ],
      { padding: [20, 20] },
    );
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

export default function CourseMapInner({
  gpxSimplifiedUrl,
  bounds,
  checkpoints,
}: CourseMapInnerProps): React.ReactElement {
  const [polylineLatLngs, setPolylineLatLngs] = React.useState<[number, number][]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setPolylineLatLngs([]);
    fetch(gpxSimplifiedUrl)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as GeoJsonFC | GeoJsonLineString;
      })
      .then((data) => {
        if (cancelled) return;
        const feature: GeoJsonLineString | undefined =
          'features' in data
            ? data.features.find(isLineStringFeature)
            : isLineStringFeature(data)
              ? data
              : undefined;
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
  }, [gpxSimplifiedUrl]);

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
          Không tải được route: {loadError}
        </div>
      )}
      <MapContainer
        bounds={[
          [bounds.south, bounds.west],
          [bounds.north, bounds.east],
        ]}
        boundsOptions={{ padding: [20, 20] }}
        scrollWheelZoom={false}
        touchZoom
        keyboard
        className="h-[300px] w-full overflow-hidden rounded-lg md:h-[400px]"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <FitBounds bounds={bounds} />
        {polylineLatLngs.length > 1 && (
          <Polyline
            positions={polylineLatLngs}
            pathOptions={{ color: '#1D49FF', weight: 4, opacity: 0.85 }}
          />
        )}
        {checkpoints.map((cp) => {
          if (typeof cp.lat !== 'number' || typeof cp.lng !== 'number') return null;
          const icon = isStartKey(cp.key)
            ? startIcon
            : isFinishKey(cp.key)
              ? finishIcon
              : cpIcon(String(cpCounter[cp.key] ?? cp.key), hasAidServices(cp));
          return (
            <Marker
              key={cp.key}
              position={[cp.lat, cp.lng]}
              icon={icon}
              title={cp.name}
              alt={cp.name}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
