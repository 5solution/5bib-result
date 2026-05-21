/**
 * FEATURE-056 — Age Group breakdown accordion (Server Component).
 *
 * Uses native <details> element for no-JS toggle. Top-5 finishers per bracket.
 * DATA INTEGRITY:
 *  - finisherCount, names, chipTime AS-IS from vendor.
 *  - AG category formatted VN ("M30-39" → "Nam 30-39"); falls back to raw.
 */

function formatAg(raw: string): string {
  const m = raw.trim().match(/^([MFmf])(\d+)[-–](\d+)$/);
  if (!m) return raw;
  const prefix = m[1].toUpperCase() === 'M' ? 'Nam' : 'Nữ';
  return `${prefix} ${m[2]}-${m[3]}`;
}

export interface AGTop5Cell {
  name: string;
  bib: string;
  chipTime: string;
}

export interface AGBucket {
  category: string;
  finisherCount: number;
  top5: AGTop5Cell[];
}

export interface AGBreakdownAccordionProps {
  buckets: AGBucket[];
  /** Open first N brackets by default (BR-56-12). */
  defaultOpen?: number;
}

export function AGBreakdownAccordion({
  buckets,
  defaultOpen = 1,
}: AGBreakdownAccordionProps) {
  if (buckets.length === 0) {
    return (
      <p className="text-sm text-stone-500 italic font-body">
        Chưa có dữ liệu phân loại theo nhóm tuổi.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {buckets.map((b, i) => (
        <details
          key={b.category}
          open={i < defaultOpen}
          className="bg-white border border-stone-200 rounded-2xl overflow-hidden group"
          style={{ boxShadow: 'var(--shadow-xs)' }}
        >
          <summary
            className="flex items-center justify-between px-5 py-3 cursor-pointer select-none list-none gap-2"
            style={{ background: 'var(--color-stone-50, #fafaf9)' }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase text-stone-700 whitespace-nowrap"
                style={{ background: 'rgba(214,211,209,0.5)' }}
              >
                {formatAg(b.category)}
              </span>
              <span
                className="font-mono text-[12px] text-stone-500 whitespace-nowrap"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {b.finisherCount.toLocaleString('vi-VN')} finisher
              </span>
            </div>
            <span
              aria-hidden
              className="text-stone-400 group-open:rotate-180 transition-transform duration-200 ease-out"
              style={{ display: 'inline-flex' }}
            >
              {/* chevron-down */}
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </summary>
          <div className="py-1">
            {b.top5.map((p, idx) => (
              <div
                key={`${p.bib}-${idx}`}
                className="flex items-center gap-3 px-5 py-2 border-t border-stone-100 first:border-t-0"
              >
                <span
                  className="font-heading font-black"
                  style={{
                    fontSize: 18,
                    color: idx === 0 ? '#D97706' : '#a8a29e',
                    minWidth: 26,
                    lineHeight: 1,
                  }}
                >
                  #{idx + 1}
                </span>
                <span className="font-body font-bold text-[14px] text-stone-900 flex-1 min-w-0 truncate">
                  {p.name}
                </span>
                <span
                  className="font-mono text-[13px] font-bold text-stone-800 whitespace-nowrap"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {p.chipTime}
                </span>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
