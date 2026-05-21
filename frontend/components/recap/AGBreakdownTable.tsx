/**
 * FEATURE-056 — Age-Group Breakdown Table (Variation B Dashboard).
 *
 * Server Component — v1 renders all rows (filter tabs are static visual only).
 * Filter tab interactivity is deferred to a future iteration.
 */

export interface AGTopAthlete {
  name: string;
  bib: string;
  chipTime: string;
  medal?: 'gold' | 'silver' | 'bronze';
}

export interface AGBucket {
  courseId: string;
  courseName: string;
  bucket: {
    category: string;
    finisherCount: number;
    top5: AGTopAthlete[];
  };
  medianPace?: string;
}

export interface AGBreakdownTableProps {
  rows: AGBucket[];
}

function AthleteCell({ athlete }: { athlete?: AGTopAthlete }) {
  if (!athlete) {
    return (
      <td className="py-3 px-2 text-stone-400 font-mono" style={{ fontSize: 12 }}>
        —
      </td>
    );
  }
  return (
    <td className="py-3 px-2">
      <div className="font-medium text-stone-900" style={{ fontSize: 13 }}>
        {athlete.name}
      </div>
      <div
        className="font-mono text-stone-500 mt-0.5"
        style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
      >
        {athlete.chipTime}
      </div>
    </td>
  );
}

export default function AGBreakdownTable({ rows }: AGBreakdownTableProps) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 md:p-8">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <div
            className="font-mono uppercase tracking-widest text-stone-500"
            style={{ fontSize: 10 }}
          >
            AGE GROUP BREAKDOWN
          </div>
          <h3
            className="font-heading font-bold text-stone-900 mt-1"
            style={{ fontSize: 22 }}
          >
            Top 3 mỗi bracket
          </h3>
        </div>
        <div
          className="inline-flex items-center rounded-full border border-stone-200 p-1"
          role="group"
          aria-label="Filter age group by gender (visual only)"
        >
          <span
            className="px-3 py-1 rounded-full bg-stone-900 text-white font-medium"
            style={{ fontSize: 12 }}
          >
            Tất cả
          </span>
          <span
            className="px-3 py-1 rounded-full text-stone-500"
            style={{ fontSize: 12 }}
          >
            Nam
          </span>
          <span
            className="px-3 py-1 rounded-full text-stone-500"
            style={{ fontSize: 12 }}
          >
            Nữ
          </span>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-200">
              <th
                className="text-left font-mono uppercase tracking-widest text-stone-500 py-3 px-2"
                style={{ fontSize: 10 }}
              >
                AG
              </th>
              <th
                className="text-left font-mono uppercase tracking-widest text-stone-500 py-3 px-2"
                style={{ fontSize: 10 }}
              >
                TOTAL
              </th>
              <th
                className="text-left font-mono uppercase tracking-widest text-stone-500 py-3 px-2"
                style={{ fontSize: 10 }}
              >
                #1
              </th>
              <th
                className="text-left font-mono uppercase tracking-widest text-stone-500 py-3 px-2"
                style={{ fontSize: 10 }}
              >
                #2
              </th>
              <th
                className="text-left font-mono uppercase tracking-widest text-stone-500 py-3 px-2"
                style={{ fontSize: 10 }}
              >
                #3
              </th>
              <th
                className="text-right font-mono uppercase tracking-widest text-stone-500 py-3 px-2"
                style={{ fontSize: 10 }}
              >
                MEDIAN PACE
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const top3 = row.bucket.top5.slice(0, 3);
              return (
                <tr
                  key={`${row.courseId}-${row.bucket.category}-${idx}`}
                  className="border-b border-stone-100 hover:bg-stone-50 transition-colors"
                >
                  <td className="py-3 px-2">
                    <span
                      className="inline-flex px-2 py-1 rounded font-mono"
                      style={{
                        background: '#FEF3C7',
                        color: '#78350F',
                        fontSize: 11,
                      }}
                    >
                      {row.bucket.category}
                    </span>
                  </td>
                  <td
                    className="py-3 px-2 font-mono text-stone-900"
                    style={{
                      fontSize: 13,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {row.bucket.finisherCount}
                  </td>
                  <AthleteCell athlete={top3[0]} />
                  <AthleteCell athlete={top3[1]} />
                  <AthleteCell athlete={top3[2]} />
                  <td
                    className="py-3 px-2 font-mono text-stone-700 text-right"
                    style={{
                      fontSize: 13,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {row.medianPace ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
