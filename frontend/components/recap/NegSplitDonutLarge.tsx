/**
 * FEATURE-056 — Negative Split Donut (Large) for Variation B Dashboard.
 *
 * Server Component — bigger donut + half-time table.
 * Color flips orange when percent > benchmark (better than reference field).
 */

export interface NegSplitDonutLargeProps {
  percent: number;
  benchmark: number;
  avgFirstHalf?: string;
  avgSecondHalf?: string;
  deltaSeconds?: number;
  finishersAnalyzed: number;
  interpretation: string;
}

function formatDelta(seconds: number | undefined): string {
  if (seconds === undefined || Number.isNaN(seconds)) return '—';
  const abs = Math.abs(Math.round(seconds));
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const body = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  if (seconds === 0) return body;
  return `${seconds > 0 ? '+' : '−'}${body}`;
}

export default function NegSplitDonutLarge({
  percent,
  benchmark,
  avgFirstHalf,
  avgSecondHalf,
  deltaSeconds,
  finishersAnalyzed,
  interpretation,
}: NegSplitDonutLargeProps) {
  const safePercent = Math.max(0, Math.min(100, percent));
  const ringColor = percent > benchmark ? '#ea580c' : '#1d4ed8';
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const dash = (safePercent / 100) * circumference;

  const deltaColor =
    deltaSeconds === undefined
      ? '#1c1917'
      : deltaSeconds > 0
        ? '#ea580c'
        : deltaSeconds < 0
          ? '#166534'
          : '#1c1917';

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 md:p-8">
      <header>
        <div
          className="font-mono uppercase tracking-widest text-stone-500"
          style={{ fontSize: 10 }}
        >
          PACING STRATEGY
        </div>
        <h3
          className="font-heading font-bold text-stone-900 mt-1"
          style={{ fontSize: 22 }}
        >
          Negative split %
        </h3>
      </header>

      <div className="grid grid-cols-[120px_1fr] gap-6 md:gap-8 mt-6 items-center">
        <div className="relative" style={{ width: 120, height: 120 }}>
          <svg viewBox="0 0 120 120" width={120} height={120}>
            <circle
              cx={60}
              cy={60}
              r={radius}
              fill="none"
              stroke="#E7E5E4"
              strokeWidth={12}
            />
            <circle
              cx={60}
              cy={60}
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={circumference / 4}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="font-mono font-black"
              style={{
                fontSize: 28,
                color: '#1c1917',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {Math.round(percent)}%
            </div>
            <div
              className="font-mono tracking-widest text-stone-500 mt-1"
              style={{ fontSize: 9 }}
            >
              NEG SPLIT
            </div>
            <div
              className="font-mono text-stone-400 mt-0.5"
              style={{ fontSize: 9 }}
            >
              vs {benchmark}% bench
            </div>
          </div>
        </div>

        <div>
          <p
            className="text-stone-600"
            style={{ fontSize: 14, lineHeight: 1.5 }}
          >
            {interpretation}
          </p>
          <div
            className="text-stone-400 mt-1"
            style={{ fontSize: 11 }}
          >
            {finishersAnalyzed} finishers analyzed
          </div>

          <dl className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <dt
                className="font-mono uppercase tracking-widest text-stone-500"
                style={{ fontSize: 10 }}
              >
                AVG 1ST HALF
              </dt>
              <dd
                className="font-mono font-bold text-stone-900"
                style={{
                  fontSize: 13,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {avgFirstHalf ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt
                className="font-mono uppercase tracking-widest text-stone-500"
                style={{ fontSize: 10 }}
              >
                AVG 2ND HALF
              </dt>
              <dd
                className="font-mono font-bold text-stone-900"
                style={{
                  fontSize: 13,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {avgSecondHalf ?? '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt
                className="font-mono uppercase tracking-widest text-stone-500"
                style={{ fontSize: 10 }}
              >
                Δ
              </dt>
              <dd
                className="font-mono font-bold"
                style={{
                  fontSize: 13,
                  color: deltaColor,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatDelta(deltaSeconds)}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
