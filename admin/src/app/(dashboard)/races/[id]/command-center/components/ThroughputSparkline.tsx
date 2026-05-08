'use client';

/**
 * F-008 — Throughput Sparkline (Command Center summary card slot 6).
 *
 * Pure SVG sparkline render từ 12 buckets (last 60 min × 5 min per BR-CC-03).
 * Display: latest bucket count "+N" + sparkline 12-point polyline. Dark
 * background `#1c1917` + brand magenta accent `#FF0E65` per Canvas 03.
 *
 * NO chart library — pure SVG (BR-CC scope OUT npm packages).
 */

import type { ThroughputBucket } from '@/lib/timing-alert-api';

interface ThroughputSparklineProps {
  history: ThroughputBucket[];
}

export function ThroughputSparkline({ history }: ThroughputSparklineProps) {
  const points = history ?? [];
  const latest = points.length > 0 ? points[points.length - 1] : null;
  const latestCount = latest?.finishersCount ?? 0;

  // Compute sparkline path. Empty → flat line at midline.
  const width = 140;
  const height = 36;
  const padX = 2;
  const padY = 4;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const counts = points.map((p) => p.finishersCount);
  const maxCount = Math.max(1, ...counts);
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

  const polylineCoords =
    points.length === 0
      ? ''
      : points
          .map((p, i) => {
            const x = padX + i * stepX;
            const y =
              padY + innerH - (p.finishersCount / maxCount) * innerH;
            return `${x.toFixed(2)},${y.toFixed(2)}`;
          })
          .join(' ');

  return (
    <div
      className="flex min-w-[140px] flex-col rounded-[14px] border p-4"
      style={{
        borderColor: 'var(--5s-border)',
        boxShadow: 'var(--shadow-xs)',
        background: '#1c1917',
        color: '#fafaf9',
      }}
      data-testid="throughput-sparkline"
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 rounded"
          style={{ background: '#FF0E65' }}
        />
        <div
          className="text-[10px] font-extrabold uppercase tracking-[.12em]"
          style={{ fontFamily: 'var(--font-display)', color: '#a8a29e' }}
        >
          Throughput · Last 60min
        </div>
      </div>
      <div
        className="text-2xl font-bold leading-none"
        style={{ fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}
        data-testid="throughput-latest-count"
      >
        +{latestCount.toLocaleString('vi-VN')}
      </div>
      <div className="mt-1 text-[11px]" style={{ color: '#a8a29e' }}>
        finishers / 5min
      </div>
      <svg
        className="mt-2"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Throughput sparkline last 60 minutes"
        data-testid="throughput-svg"
      >
        {points.length === 0 ? (
          <line
            x1={padX}
            y1={padY + innerH / 2}
            x2={padX + innerW}
            y2={padY + innerH / 2}
            stroke="#FF0E65"
            strokeWidth={1.5}
            strokeOpacity={0.4}
          />
        ) : (
          <polyline
            fill="none"
            stroke="#FF0E65"
            strokeWidth={1.75}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={polylineCoords}
          />
        )}
      </svg>
    </div>
  );
}
