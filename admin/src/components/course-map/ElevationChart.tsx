/**
 * F-006 ElevationChart — pure SVG (no recharts).
 *
 * Decision (PRD line 186-192): elevation chart is a hand-rolled <svg> so we
 * can ship without adding a charting library to admin. Phase 3 will copy
 * this component to `frontend/components/course-map/ElevationChart.tsx`.
 *
 * Up to 200 sample points are rendered for perf. Checkpoint markers draw
 * vertical dotted lines at their `distanceKm` ratio.
 */
import * as React from 'react';

export interface ElevationPoint {
  /** Cumulative distance from start (km). */
  distanceKm: number;
  /** Elevation above sea level (metres). */
  elevation: number;
}

export interface ElevationCheckpoint {
  /** Cumulative distance from start (km). */
  distanceKm: number;
  /** Display name (e.g. "CP1") — used as accessible label. */
  name: string;
}

export interface ElevationChartProps {
  elevationProfile: ElevationPoint[];
  checkpoints?: ElevationCheckpoint[];
  /** SVG render height in px (viewBox-locked at 800x{height}). Default 200. */
  height?: number;
  /** Optional ARIA label override. */
  ariaLabel?: string;
}

const VIEW_W = 800;
const PAD_X = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;
const SAMPLE_LIMIT = 200;

function downsample(points: ElevationPoint[], limit: number): ElevationPoint[] {
  if (points.length <= limit) return points;
  const step = points.length / limit;
  const out: ElevationPoint[] = [];
  for (let i = 0; i < limit; i++) {
    out.push(points[Math.floor(i * step)]);
  }
  // Always include last point so the chart reaches the right edge cleanly.
  if (out[out.length - 1] !== points[points.length - 1]) {
    out.push(points[points.length - 1]);
  }
  return out;
}

interface Stats {
  totalKm: number;
  gainM: number;
  lossM: number;
  maxM: number;
  minM: number;
}

function computeStats(points: ElevationPoint[]): Stats {
  if (points.length === 0) {
    return { totalKm: 0, gainM: 0, lossM: 0, maxM: 0, minM: 0 };
  }
  let gain = 0;
  let loss = 0;
  let max = points[0].elevation;
  let min = points[0].elevation;
  for (let i = 1; i < points.length; i++) {
    const delta = points[i].elevation - points[i - 1].elevation;
    if (delta > 0.5) gain += delta;
    else if (delta < -0.5) loss += Math.abs(delta);
    if (points[i].elevation > max) max = points[i].elevation;
    if (points[i].elevation < min) min = points[i].elevation;
  }
  return {
    totalKm: points[points.length - 1].distanceKm,
    gainM: Math.round(gain),
    lossM: Math.round(loss),
    maxM: Math.round(max),
    minM: Math.round(min),
  };
}

export function ElevationChart({
  elevationProfile,
  checkpoints = [],
  height = 200,
  ariaLabel = 'Biểu đồ độ cao theo cự ly',
}: ElevationChartProps): React.ReactElement {
  const gradientId = React.useId().replace(/:/g, '-') + '-elev-fill';
  const empty = elevationProfile.length === 0;

  if (empty) {
    return (
      <div
        role="img"
        aria-label="Không có dữ liệu độ cao"
        className="flex items-center justify-center rounded-md border border-dashed border-stone-300 text-sm text-stone-500"
        style={{ height }}
      >
        Không có dữ liệu độ cao
      </div>
    );
  }

  const sampled = downsample(elevationProfile, SAMPLE_LIMIT);
  const stats = computeStats(elevationProfile);

  const xs = sampled.map((p) => p.distanceKm);
  const ys = sampled.map((p) => p.elevation);
  const xMin = xs[0];
  const xMax = xs[xs.length - 1] || xs[0] + 1;
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yRange = Math.max(yMax - yMin, 1);

  const innerW = VIEW_W - PAD_X * 2;
  const innerH = height - PAD_TOP - PAD_BOTTOM;

  const xToSvg = (km: number): number =>
    PAD_X + ((km - xMin) / Math.max(xMax - xMin, 1e-6)) * innerW;
  const yToSvg = (ele: number): number =>
    PAD_TOP + (1 - (ele - yMin) / yRange) * innerH;

  const linePath = sampled
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xToSvg(p.distanceKm).toFixed(2)} ${yToSvg(p.elevation).toFixed(2)}`)
    .join(' ');

  const baseY = PAD_TOP + innerH;
  const fillPath =
    `M ${xToSvg(sampled[0].distanceKm).toFixed(2)} ${baseY} ` +
    sampled
      .map((p) => `L ${xToSvg(p.distanceKm).toFixed(2)} ${yToSvg(p.elevation).toFixed(2)}`)
      .join(' ') +
    ` L ${xToSvg(sampled[sampled.length - 1].distanceKm).toFixed(2)} ${baseY} Z`;

  return (
    <div className="flex w-full flex-col gap-2">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${VIEW_W} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1D49FF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#1D49FF" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Filled area */}
        <path d={fillPath} fill={`url(#${gradientId})`} />

        {/* Stroked outline */}
        <path
          d={linePath}
          fill="none"
          stroke="#1D49FF"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Checkpoint dotted lines */}
        {checkpoints.map((cp, idx) => {
          if (cp.distanceKm < xMin || cp.distanceKm > xMax) return null;
          const x = xToSvg(cp.distanceKm);
          return (
            <g key={`${cp.name}-${idx}`}>
              <line
                x1={x}
                y1={PAD_TOP}
                x2={x}
                y2={baseY}
                stroke="#FF0E65"
                strokeWidth={1}
                strokeDasharray="2,2"
                opacity={0.7}
              />
              <text
                x={x}
                y={height - 4}
                fontSize="10"
                textAnchor="middle"
                fill="#57534e"
                style={{ fontFamily: 'var(--font-mono, monospace)' }}
              >
                {cp.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-stone-600">
        <span>Total: <span className="font-semibold text-stone-900">{stats.totalKm.toFixed(2)}km</span></span>
        <span>↑ <span className="font-semibold text-stone-900">{stats.gainM}m</span></span>
        <span>↓ <span className="font-semibold text-stone-900">{stats.lossM}m</span></span>
        <span>Max: <span className="font-semibold text-stone-900">{stats.maxM}m</span></span>
        <span>Min: <span className="font-semibold text-stone-900">{stats.minM}m</span></span>
      </div>
    </div>
  );
}
