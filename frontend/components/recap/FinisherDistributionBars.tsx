/**
 * FEATURE-056 — Finisher Distribution Bars (Variation B Dashboard).
 *
 * Server Component — pure CSS/SVG-free bar chart.
 * Renders proportional finisher counts per course (first bar orange, rest blue).
 */

export interface FinisherDistributionRow {
  courseId: string;
  courseName: string;
  distance?: string;
  finisherCount: number;
  medianPace?: string;
  bestChipTime?: string;
}

export interface FinisherDistributionBarsProps {
  rows: FinisherDistributionRow[];
  total: number;
}

const MAX_BAR_HEIGHT_PX = 240;

export default function FinisherDistributionBars({
  rows,
  total,
}: FinisherDistributionBarsProps) {
  const max = rows.reduce(
    (acc, r) => (r.finisherCount > acc ? r.finisherCount : acc),
    1,
  );

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 md:p-8">
      <header className="flex items-end justify-between mb-6">
        <div>
          <div
            className="font-mono uppercase tracking-widest text-stone-500"
            style={{ fontSize: 10 }}
          >
            FINISHER DISTRIBUTION
          </div>
          <h3 className="font-heading font-bold text-stone-900 mt-1" style={{ fontSize: 22 }}>
            Theo course
          </h3>
        </div>
        <div
          className="font-mono text-stone-500"
          style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
        >
          Total {total}
        </div>
      </header>

      <div className="flex items-end gap-6 justify-around" style={{ minHeight: MAX_BAR_HEIGHT_PX + 80 }}>
        {rows.map((row, idx) => {
          const isFirst = idx === 0;
          const color = isFirst ? '#ea580c' : '#1d4ed8';
          const heightPx = Math.max(
            12,
            Math.round((row.finisherCount / max) * MAX_BAR_HEIGHT_PX),
          );
          return (
            <div key={row.courseId} className="flex flex-col items-center" style={{ minWidth: 80 }}>
              <div
                className="font-mono font-bold mb-2"
                style={{
                  fontSize: 20,
                  color: '#1c1917',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {row.finisherCount}
              </div>
              <div
                className="rounded-t-lg w-full"
                style={{
                  height: heightPx,
                  width: 80,
                  background: color,
                }}
                aria-label={`${row.courseName} — ${row.finisherCount} finishers`}
              />
              <div
                className="font-mono font-bold mt-3"
                style={{
                  fontSize: 14,
                  color,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {row.distance ?? row.courseName}
              </div>
              {row.medianPace || row.bestChipTime ? (
                <div
                  className="font-mono text-stone-500 mt-1 text-center"
                  style={{
                    fontSize: 10,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {row.medianPace ? `${row.medianPace}/km` : ''}
                  {row.medianPace && row.bestChipTime ? ' · ' : ''}
                  {row.bestChipTime ? `best ${row.bestChipTime}` : ''}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
