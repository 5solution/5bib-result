/**
 * FEATURE-056 — Pace distribution bell curve (SVG static, Server Component).
 *
 * Render a smoothed line over 10 histogram bins. Vendor backend produces
 * `distribution: number[10]` via `paceStats[].distribution`. Empty array →
 * render flat baseline (graceful degrade).
 *
 * DATA INTEGRITY: bins rendered AS-IS — no smoothing that alters underlying counts.
 */

export interface PaceDistributionChartProps {
  distribution: number[];
  width?: number;
  height?: number;
  /** Velocity orange accent for curve stroke. */
  accent?: string;
}

export function PaceDistributionChart({
  distribution,
  width = 540,
  height = 220,
  accent = '#ea580c',
}: PaceDistributionChartProps) {
  const bins = distribution.length > 0 ? distribution : new Array(10).fill(0);
  const max = Math.max(...bins, 1);
  const padX = 24;
  const padY = 18;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const stepX = innerW / Math.max(bins.length - 1, 1);

  // Build smooth path via quadratic curves between bin midpoints.
  const points = bins.map((v, i) => ({
    x: padX + i * stepX,
    y: padY + innerH * (1 - v / max),
  }));

  const path = points
    .map((p, i) => {
      if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
      const prev = points[i - 1];
      const midX = (prev.x + p.x) / 2;
      return `Q ${midX.toFixed(1)} ${prev.y.toFixed(1)} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    })
    .join(' ');

  const baseline = padY + innerH;
  const areaPath = `${path} L ${points[points.length - 1].x.toFixed(1)} ${baseline} L ${padX} ${baseline} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Phân bố pace bell curve"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <defs>
        <linearGradient id="paceArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Baseline guide */}
      <line
        x1={padX}
        x2={width - padX}
        y1={baseline}
        y2={baseline}
        stroke="#e7e5e4"
        strokeWidth={1}
      />
      <path d={areaPath} fill="url(#paceArea)" />
      <path d={path} fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill={accent} opacity={bins[i] > 0 ? 1 : 0.2} />
      ))}
    </svg>
  );
}
