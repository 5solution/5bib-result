/**
 * FEATURE-056 — Negative-split donut block (Variation A).
 *
 * Server Component. Render SVG donut showing % vs benchmark.
 * DATA INTEGRITY:
 *  - Percent rendered AS-IS from backend (BR-56-09 source-of-truth).
 *  - Benchmark hardcoded 40 (BR-56-02 VN average).
 *  - avgFirstHalf / avgSecondHalf / deltaSeconds hidden when undefined (BR-56-09 fallback).
 */

export interface NegSplitDonutProps {
  /** % finishers running negative split (0-100). */
  value: number;
  /** Vietnam benchmark — typically 40 (BR-56-02). */
  benchmark?: number;
  size?: number;
  accent?: string;
  /** Vietnamese narrative computed backend (BR-56-09 + Clarification #3). */
  interpretation?: string;
  /** F-056 GAP #2 fields — optional. */
  avgFirstHalf?: string;
  avgSecondHalf?: string;
  deltaSeconds?: number;
  finishersAnalyzed?: number;
}

function formatDelta(s: number | undefined): string | null {
  if (s === undefined || s === null) return null;
  const sign = s >= 0 ? '+' : '-';
  const abs = Math.abs(s);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const sec = Math.floor(abs % 60);
  if (h > 0) return `${sign}${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${sign}${m}:${String(sec).padStart(2, '0')}`;
}

export function NegSplitDonut({
  value,
  benchmark = 40,
  size = 220,
  accent = '#ea580c',
  interpretation,
  avgFirstHalf,
  avgSecondHalf,
  deltaSeconds,
  finishersAnalyzed,
}: NegSplitDonutProps) {
  const radius = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * circumference;
  const benchmarkDash = (benchmark / 100) * circumference;

  const delta = formatDelta(deltaSeconds);
  const deltaColor = (deltaSeconds ?? 0) >= 0 ? '#DC2626' : '#16a34a';

  return (
    <div
      className="relative grid gap-10 items-center overflow-hidden rounded-3xl p-9 md:p-10 md:grid-cols-[0.85fr_1fr]"
      style={{ background: 'linear-gradient(120deg, #1B2238, #2A3354)', color: '#fff' }}
    >
      {/* Subtle topo backdrop */}
      <svg
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.08 }}
        viewBox="0 0 600 400"
        preserveAspectRatio="none"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <path
            key={i}
            d={`M 0 ${50 + i * 28} Q 200 ${20 + i * 30} 400 ${60 + i * 26} T 800 ${50 + i * 28}`}
            fill="none"
            stroke="#fff"
            strokeWidth={1}
          />
        ))}
      </svg>

      <div className="relative flex items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut negative split">
          {/* Track */}
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={14} />
          {/* Benchmark indicator (dashed) */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.45)"
            strokeWidth={2}
            strokeDasharray={`${benchmarkDash.toFixed(1)} ${(circumference - benchmarkDash).toFixed(1)}`}
            strokeDashoffset={circumference * 0.25}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          {/* Actual value */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={accent}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${dash.toFixed(1)} ${(circumference - dash).toFixed(1)}`}
            strokeDashoffset={circumference * 0.25}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
          <text
            x={cx}
            y={cy + 6}
            textAnchor="middle"
            fontFamily="var(--font-heading)"
            fontWeight={900}
            fontSize={42}
            fill="#fff"
            style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em' }}
          >
            {clamped}%
          </text>
          <text
            x={cx}
            y={cy + 28}
            textAnchor="middle"
            fontFamily="var(--font-mono)"
            fontWeight={700}
            fontSize={10}
            fill="rgba(255,255,255,0.55)"
            style={{ letterSpacing: '0.18em' }}
          >
            BENCH {benchmark}%
          </text>
        </svg>
      </div>

      <div className="relative">
        <div
          className="font-bold uppercase text-[11px] tracking-[0.22em]"
          style={{ color: accent }}
        >
          Chỉ {clamped}% chạy negative split
        </div>
        {interpretation ? (
          <h3
            className="font-heading font-black tracking-tight mt-3 mb-3 text-[24px] md:text-[32px]"
            style={{ lineHeight: 1.15 }}
          >
            {interpretation}
          </h3>
        ) : null}
        <p
          className="text-[14px] leading-[1.7]"
          style={{ color: 'rgba(255,255,255,0.78)' }}
        >
          Benchmark Vietnam là ~{benchmark}% finisher chạy negative split. Tại
          race này, chỉ {clamped}% giữ được pace nửa sau nhanh hơn nửa đầu.
          {typeof finishersAnalyzed === 'number' && finishersAnalyzed > 0
            ? ` Dữ liệu phân tích trên ${finishersAnalyzed.toLocaleString('vi-VN')} finisher có data đủ.`
            : null}
        </p>
        {avgFirstHalf || avgSecondHalf || delta ? (
          <div className="flex flex-wrap gap-5 mt-6">
            {avgFirstHalf ? (
              <Stat label="Average 1st half" value={avgFirstHalf} />
            ) : null}
            {avgSecondHalf ? (
              <Stat label="Average 2nd half" value={avgSecondHalf} />
            ) : null}
            {delta ? (
              <Stat
                label={(deltaSeconds ?? 0) >= 0 ? 'Δ (positive)' : 'Δ (negative)'}
                value={delta}
                color={deltaColor}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div
        className="font-mono font-bold text-[20px]"
        style={{ color: color ?? '#fff', letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </div>
      <div
        className="font-bold uppercase mt-1 text-[10px]"
        style={{ letterSpacing: '0.18em', color: 'rgba(255,255,255,0.55)' }}
      >
        {label}
      </div>
    </div>
  );
}
