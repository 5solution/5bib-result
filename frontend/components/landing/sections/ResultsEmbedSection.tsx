import type { SectionProps } from '../types';
import styles from './results-embed.module.css';

/** A single result row in the embedded leaderboard widget. */
interface ResultRow {
  rank: number;
  name: string;
  cat?: string;
  bib: string;
  chip: string;
  pace?: string;
}

/** Narrowed view of section.data for the Results Embed section. */
interface ResultsEmbedData {
  resultUrl?: string;
  courseLabel?: string;
  rows?: ResultRow[];
}

const RANK_CLASS: Record<number, string> = {
  1: styles.m1,
  2: styles.m2,
  3: styles.m3,
};

/** Lock SVG icon shown inside the browser-chrome url chip. */
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function ResultsEmbedSection({ section }: SectionProps) {
  const d = section.data as ResultsEmbedData;

  const resultUrl = d.resultUrl;
  const urlLabel = resultUrl ?? 'result.5bib.com';
  const rows = Array.isArray(d.rows) ? d.rows : [];
  const hasRows = rows.length > 0;

  return (
    <section className="landing-sec" id={section.anchor ?? 'results'} data-section="results">
      <div className="landing-shell">
        <span className="landing-kicker">Kết quả · Live results</span>
        <h2 className="landing-h2">
          Kết quả <em>trực tiếp</em>
        </h2>
        <p className="landing-lead">
          Nhúng trực tiếp từ <b>result.5bib.com</b> — chip time, pace, tra cứu theo BIB, cập nhật
          real-time ngay trên trang giải.
        </p>

        <div className={styles.frame}>
          {/* browser-chrome bar */}
          <div className={styles.frbar}>
            <span className={styles.dots} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span className={styles.url}>
              <LockIcon />
              {urlLabel}
            </span>
            <span className={styles.embedchip}>
              <span className={styles.live} aria-hidden="true" />
              LIVE
            </span>
          </div>

          {/* body */}
          <div className={styles.frbody}>
            {d.courseLabel ? (
              <div className={styles.rtabs}>
                <span className={`${styles.rtab} ${styles.on}`}>{d.courseLabel}</span>
              </div>
            ) : null}

            {hasRows ? (
              <div className={styles.tableWrap}>
                <table className={styles.res}>
                  <thead>
                    <tr>
                      <th>Hạng</th>
                      <th>VĐV</th>
                      <th>BIB</th>
                      <th>Chip time</th>
                      <th>Pace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${row.bib}-${row.rank}`} className={RANK_CLASS[row.rank] ?? ''}>
                        <td>
                          <span className={styles.rk}>{row.rank}</span>
                        </td>
                        <td className={styles.nm}>
                          {row.name}
                          {row.cat ? <small>{row.cat}</small> : null}
                        </td>
                        <td className={styles.pc}>{row.bib}</td>
                        <td className={styles.tm}>{row.chip}</td>
                        <td className={styles.pc}>{row.pace ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.empty}>Kết quả sẽ cập nhật khi giải diễn ra</div>
            )}
          </div>

          {/* footer link */}
          <div className={styles.frfoot}>
            <a
              href={resultUrl ?? 'https://result.5bib.com'}
              target="_blank"
              rel="noopener noreferrer"
            >
              Xem toàn bộ trên result.5bib.com →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
