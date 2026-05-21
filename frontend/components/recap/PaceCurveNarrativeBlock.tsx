/**
 * FEATURE-056 — Pace Curve + Narrative Block (Variation A bottom).
 *
 * Server Component — bell curve SVG + editorial "THE PUSH" story.
 * PAUSE-56-10 SKIP: NO 5BIB Pix count + NO Strava sync count (cross-platform sync deferred).
 */

export interface PaceCurveNarrativeBlockProps {
  distribution: number[];
  medianPace: string;
  p10Pace: string;
  p90Pace: string;
  finisherCount: number;
  storyHeadline: string;
  storyBody: string;
}

const CHART_W = 460;
const CHART_H = 200;
const PAD_X = 16;
const PAD_Y = 18;

export default function PaceCurveNarrativeBlock({
  distribution,
  medianPace,
  p10Pace,
  p90Pace,
  finisherCount,
  storyHeadline,
  storyBody,
}: PaceCurveNarrativeBlockProps) {
  const safe = distribution.length > 0 ? distribution : [0];
  const max = safe.reduce((acc, v) => (v > acc ? v : acc), 1);
  const innerW = CHART_W - PAD_X * 2;
  const innerH = CHART_H - PAD_Y * 2;
  const stepX = safe.length > 1 ? innerW / (safe.length - 1) : innerW;

  const points = safe
    .map((v, i) => {
      const x = PAD_X + i * stepX;
      const y = PAD_Y + innerH - (v / max) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const areaPath = `M ${PAD_X},${PAD_Y + innerH} L ${points
    .split(' ')
    .join(' L ')} L ${(PAD_X + innerW).toFixed(1)},${PAD_Y + innerH} Z`;

  // marker positions: p10 left, p50 mid, p90 right
  const p10X = PAD_X + innerW * 0.1;
  const p50X = PAD_X + innerW * 0.5;
  const p90X = PAD_X + innerW * 0.9;

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 md:p-8">
      <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-8 md:gap-12">
        <div>
          <div
            className="font-mono uppercase tracking-widest text-stone-500"
            style={{ fontSize: 10 }}
          >
            THE SHAPE OF THE RACE
          </div>
          <h3
            className="font-heading font-bold text-stone-900 mt-1"
            style={{ fontSize: 22 }}
          >
            PACE CURVE
          </h3>

          <div className="mt-4 w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              width="100%"
              style={{ maxWidth: CHART_W, height: 'auto' }}
              aria-label="Race pace distribution curve"
            >
              <defs>
                <linearGradient id="paceAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1d4ed8" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.03" />
                </linearGradient>
              </defs>

              <path d={areaPath} fill="url(#paceAreaFill)" />
              <polyline
                points={points}
                fill="none"
                stroke="#1d4ed8"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {[
                { x: p10X, label: 'P10', value: p10Pace, color: '#94A3B8' },
                { x: p50X, label: 'P50', value: medianPace, color: '#ea580c' },
                { x: p90X, label: 'P90', value: p90Pace, color: '#94A3B8' },
              ].map((m) => (
                <g key={m.label}>
                  <line
                    x1={m.x}
                    y1={PAD_Y}
                    x2={m.x}
                    y2={PAD_Y + innerH}
                    stroke={m.color}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  <text
                    x={m.x}
                    y={PAD_Y - 6}
                    fontSize={9}
                    textAnchor="middle"
                    fill={m.color}
                    fontFamily="ui-monospace, SFMono-Regular, monospace"
                    style={{ letterSpacing: '0.08em' }}
                  >
                    {m.label}
                  </text>
                  <text
                    x={m.x}
                    y={PAD_Y + innerH + 14}
                    fontSize={10}
                    textAnchor="middle"
                    fill={m.color}
                    fontFamily="ui-monospace, SFMono-Regular, monospace"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {m.value}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div
            className="font-mono text-stone-500 mt-2"
            style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
          >
            {finisherCount} finishers
          </div>
        </div>

        <div>
          <div
            className="font-mono uppercase tracking-widest text-stone-500"
            style={{ fontSize: 10 }}
          >
            STORY ANGLE
          </div>
          <h3
            className="font-heading font-bold text-stone-900 mt-1"
            style={{ fontSize: 22 }}
          >
            THE PUSH
          </h3>
          <p
            className="font-heading italic text-stone-900 mt-3"
            style={{ fontSize: 18, lineHeight: 1.4 }}
          >
            {storyHeadline}
          </p>
          <p
            className="font-body text-stone-600 mt-2"
            style={{ fontSize: 14, lineHeight: 1.55 }}
          >
            {storyBody}
          </p>
        </div>
      </div>
    </section>
  );
}
