'use client';

/**
 * F-018 BR-MI-19..22 — GPS source priority picker.
 *  1. Course-pin (F-006 SnapToPolyline standalone reuse)
 *  2. Manual lat/lng entry
 *  3. Aid-station GPS dropdown
 *  4. Device geolocation (NEVER default — only when BTC operator mobile)
 *
 * F-006 reuse: imports `findNearestPolylinePoint` from
 * `@/components/course-map/SnapToPolyline.helper`. Pure function — no Leaflet
 * required.
 */
import { useState } from 'react';
import { findNearestPolylinePoint } from '@/components/course-map/SnapToPolyline.helper';
import type { GpsLocation } from '../medical.types';

interface GpsLocationPickerProps {
  value: GpsLocation | null;
  /** Course polyline tuples (lat, lng) — fetched from F-006 cached endpoint. */
  coursePolyline?: [number, number][];
  /** Pre-defined aid stations on this race. */
  aidStations?: { id: string; name: string; lat: number; lng: number }[];
  onChange: (loc: GpsLocation) => void;
}

export function GpsLocationPicker({
  value,
  coursePolyline,
  aidStations,
  onChange,
}: GpsLocationPickerProps) {
  const [mode, setMode] = useState<'manual' | 'course-pin' | 'aid-station' | 'device'>(
    value?.source ?? 'manual',
  );

  const handleManualLat = (lat: number) => {
    onChange({
      lat,
      lng: value?.lng ?? 0,
      source: 'manual',
    });
  };

  const handleManualLng = (lng: number) => {
    onChange({
      lat: value?.lat ?? 0,
      lng,
      source: 'manual',
    });
  };

  const handleCoursePinSnap = (lat: number, lng: number) => {
    if (!coursePolyline?.length) {
      onChange({ lat, lng, source: 'manual' });
      return;
    }
    const snap = findNearestPolylinePoint([lat, lng], coursePolyline, 200);
    if (snap?.snapped) {
      onChange({
        lat: snap.snappedLatLng[0],
        lng: snap.snappedLatLng[1],
        source: 'course-pin',
        accuracyMeters: Math.round(snap.distanceMeters),
      });
    } else {
      onChange({ lat, lng, source: 'manual' });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(['course-pin', 'manual', 'aid-station', 'device'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={`min-h-[40px] rounded-md border px-3 py-2 text-xs ${
              mode === m
                ? 'border-stone-900 bg-stone-900 text-white'
                : 'border-stone-300 bg-white text-stone-700'
            }`}
          >
            {m === 'course-pin' && 'Pin trên course (F-006)'}
            {m === 'manual' && 'Nhập tọa độ'}
            {m === 'aid-station' && 'Trạm tiếp tế'}
            {m === 'device' && 'GPS thiết bị (rủi ro!)'}
          </button>
        ))}
      </div>

      {mode === 'manual' ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">
            Lat
            <input
              type="number"
              step="0.000001"
              value={value?.lat ?? ''}
              onChange={(e) => handleManualLat(parseFloat(e.target.value))}
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs">
            Lng
            <input
              type="number"
              step="0.000001"
              value={value?.lng ?? ''}
              onChange={(e) => handleManualLng(parseFloat(e.target.value))}
              className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      ) : null}

      {mode === 'course-pin' ? (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          {coursePolyline?.length
            ? `Course polyline có ${coursePolyline.length} điểm — kéo pin trên bản đồ để snap.`
            : 'Không có course polyline — chọn chế độ "Nhập tọa độ".'}
          {value?.source === 'course-pin' ? (
            <p className="mt-1 font-mono">
              Snapped: {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
              {value.accuracyMeters ? ` (±${value.accuracyMeters}m)` : ''}
            </p>
          ) : null}
          {/* In a fuller build, embed Leaflet here (F-006 CourseMapLayout reuse).
              For Phase 1 we surface manual snap function — the Leaflet integration
              lives in IncidentMap component (deferred to detail drawer). */}
          <button
            type="button"
            className="mt-2 rounded bg-blue-600 px-2 py-1 text-white"
            onClick={() => {
              if (value?.lat && value?.lng) {
                handleCoursePinSnap(value.lat, value.lng);
              }
            }}
          >
            Snap toạ độ hiện tại
          </button>
        </div>
      ) : null}

      {mode === 'aid-station' && aidStations?.length ? (
        <select
          value={value?.aidStationId ?? ''}
          onChange={(e) => {
            const station = aidStations.find((a) => a.id === e.target.value);
            if (station) {
              onChange({
                lat: station.lat,
                lng: station.lng,
                source: 'aid-station',
                aidStationId: station.id,
              });
            }
          }}
          className="w-full rounded border border-stone-300 px-2 py-2 text-sm"
        >
          <option value="">— chọn trạm —</option>
          {aidStations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      ) : null}

      {mode === 'device' ? (
        <button
          type="button"
          onClick={() => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                onChange({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                  source: 'device',
                  accuracyMeters: pos.coords.accuracy,
                });
              },
              () => undefined,
              { enableHighAccuracy: true, timeout: 10_000 },
            );
          }}
          className="rounded bg-amber-100 px-3 py-2 text-xs text-amber-900"
        >
          Lấy GPS thiết bị (chú ý: vị trí lều, không phải sự cố)
        </button>
      ) : null}
    </div>
  );
}
