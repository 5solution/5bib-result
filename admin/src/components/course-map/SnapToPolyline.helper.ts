/**
 * F-007 Item #2 — Snap-to-polyline helper for manual checkpoint drag.
 *
 * Pure functions (no React, no Leaflet types) — testable in isolation.
 * Implements **nearest-vertex** algorithm per BR-UX-07 (NOT segment projection):
 *   - For each polyline vertex, compute haversine distance to dragged point.
 *   - Return nearest vertex if within `thresholdMeters`, else `null`.
 *
 * Why nearest-vertex (not segment): GPX/KML polylines are densified at
 * 5-15m spacing on bicycle GPS tracks → vertex-distance ≈ segment-distance
 * within 0.5m on real fixtures. Algorithm is O(n) instead of O(n) projection
 * cost, simpler and avoids floating-point edge cases on degenerate segments.
 *
 * SLA: <50ms for 5,000-vertex polyline (42K race) per BR-UX-30.
 */

export interface SnapResult {
  /** [lat, lng] of the snapped polyline vertex. */
  snappedLatLng: [number, number];
  /** Distance from input point to the nearest vertex, in metres. */
  distanceMeters: number;
  /** True iff `distanceMeters <= thresholdMeters` (caller can branch). */
  snapped: boolean;
  /** Index of the nearest vertex in the polyline array. */
  vertexIndex: number;
}

/**
 * Find nearest polyline vertex to `point` and indicate whether it is within
 * the snap threshold.
 *
 * @param point Input lat/lng (e.g. dragged marker position).
 * @param polyline Ordered array of [lat, lng] tuples (course track).
 * @param thresholdMeters Snap radius — default 50m per PRD UAT-04 / BR-UX-07.
 * @returns SnapResult, or `null` if `polyline` is empty (EC-02).
 */
export function findNearestPolylinePoint(
  point: [number, number],
  polyline: [number, number][],
  thresholdMeters = 50,
): SnapResult | null {
  if (!polyline.length) return null;

  let bestIdx = 0;
  let bestDist = haversineDistance(point, polyline[0]);
  for (let i = 1; i < polyline.length; i++) {
    const d = haversineDistance(point, polyline[i]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }

  const snappedLatLng = polyline[bestIdx];
  return {
    snappedLatLng,
    distanceMeters: bestDist,
    snapped: bestDist <= thresholdMeters,
    vertexIndex: bestIdx,
  };
}

/**
 * Great-circle distance between two lat/lng points using the haversine
 * formula. Earth radius = 6,371,008.8 m (mean Earth radius per WGS-84).
 *
 * Accuracy ±0.5% over 5K-50K range — sufficient for snap UI, NOT for race
 * timing distances.
 */
export function haversineDistance(
  a: [number, number],
  b: [number, number],
): number {
  const R = 6_371_008.8; // metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}
