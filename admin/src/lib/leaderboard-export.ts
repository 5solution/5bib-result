/**
 * F-007 Item #6 — Quick export helpers for LiveLeaderboardTable.
 *
 * Three browser-side export modes for the MC / Comms team:
 *   - `copyTopNToClipboard()` — tab-separated text → Excel-paste-friendly.
 *   - `downloadTopNAsCsv()` — UTF-8 BOM + CRLF + RFC 4180 escape (BR-UX-23).
 *   - `printTopN()` — open print-friendly window (A4 portrait default).
 *
 * Browser-only (uses `navigator.clipboard`, `Blob`, `window.open`). Caller
 * MUST invoke from a user-gesture handler (security: SEC-01).
 *
 * Perf target: <200ms for 50-row export (BR-UX-30).
 */

export interface LeaderboardEntry {
  rank: number;
  bib: string;
  athleteName: string;
  chipTime?: string;
  gunTime?: string;
}

/**
 * Copy the top-N rows to clipboard as tab-separated text.
 * Header: Rank \t Bib \t Tên \t Chip Time \t Gun Time
 */
export async function copyTopNToClipboard(
  entries: LeaderboardEntry[],
  n: number,
): Promise<void> {
  const top = entries.slice(0, n);
  const header = ['Hạng', 'Bib', 'Tên', 'Chip Time', 'Gun Time'].join('\t');
  const rows = top.map((e) =>
    [e.rank, e.bib, e.athleteName, e.chipTime ?? '', e.gunTime ?? ''].join('\t'),
  );
  const text = [header, ...rows].join('\n');
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('Clipboard API không khả dụng');
  }
  await navigator.clipboard.writeText(text);
}

/**
 * Download the top-N rows as CSV.
 * Includes UTF-8 BOM so Excel renders Vietnamese characters correctly.
 * Uses CRLF line endings + RFC 4180 escape for fields containing , " \r \n.
 */
export function downloadTopNAsCsv(
  entries: LeaderboardEntry[],
  n: number,
  filename: string,
): void {
  const top = entries.slice(0, n);
  const headers = ['Hạng', 'Bib', 'Tên', 'Chip Time', 'Gun Time'];
  const rows = top.map((e) => [
    String(e.rank),
    e.bib,
    e.athleteName,
    e.chipTime ?? '',
    e.gunTime ?? '',
  ]);
  const allRows = [headers, ...rows];
  const csvBody = allRows
    .map((cols) => cols.map(csvEscape).join(','))
    .join('\r\n');
  const BOM = '﻿';
  const blob = new Blob([BOM + csvBody], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke to next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * RFC 4180 field escape: wrap in `"..."` if contains comma, double-quote,
 * CR, LF, or tab; double internal quotes.
 */
function csvEscape(field: string): string {
  if (/[",\r\n\t]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Open a print-friendly window with the top-N rows formatted for A4 portrait.
 * After the new window prints (or user cancels), it closes itself.
 */
export function printTopN(
  entries: LeaderboardEntry[],
  n: number,
  courseName: string,
): void {
  const top = entries.slice(0, n);
  const dateStr = new Date().toLocaleString('vi-VN');
  const rowsHtml = top
    .map(
      (e) => `
        <tr>
          <td class="num">${e.rank}</td>
          <td class="num">${escapeHtml(e.bib)}</td>
          <td>${escapeHtml(e.athleteName)}</td>
          <td class="num mono">${escapeHtml(e.chipTime ?? '')}</td>
          <td class="num mono">${escapeHtml(e.gunTime ?? '')}</td>
        </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <title>Top ${n} — ${escapeHtml(courseName)}</title>
  <style>
    @page { size: A4 portrait; margin: 16mm; }
    body { font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #1c1917; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { font-size: 12px; color: #57534e; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #d6d3d1; padding: 8px 6px; text-align: left; }
    th { font-weight: 700; background: #f5f5f4; }
    .num { text-align: right; }
    .mono { font-family: "SF Mono", Menlo, monospace; }
    tbody tr:nth-child(even) { background: #fafaf9; }
  </style>
</head>
<body>
  <h1>Top ${n} — ${escapeHtml(courseName)}</h1>
  <div class="meta">In lúc ${escapeHtml(dateStr)}</div>
  <table>
    <thead>
      <tr>
        <th class="num">Hạng</th>
        <th class="num">Bib</th>
        <th>Tên</th>
        <th class="num">Chip Time</th>
        <th class="num">Gun Time</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <script>
    window.addEventListener('load', () => {
      window.focus();
      window.print();
      // Most browsers fire afterprint sync — close to keep tab list tidy.
      window.addEventListener('afterprint', () => window.close());
    });
  </script>
</body>
</html>`;

  const w = window.open('', '_blank', 'noopener=yes,noreferrer=yes');
  if (!w) {
    throw new Error('Trình duyệt chặn popup — cho phép popup để in');
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/**
 * Minimal HTML escape — caller-supplied athlete names go through this before
 * embedding into the print template.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─────────── F-008 BR-CC-12/13 — Full Export CSV (Command Center) ───────────

/**
 * Full row shape for F-008 Export CSV (BR-CC-12).
 *
 * Columns canonical order: rank, BIB, name, age_group, last_CP, chip_time,
 * gun_time, gap, status. `status` ∈ {FINISHED, MISS, DNS} per BR-CC-12.
 */
export interface FullLeaderboardRow {
  rank: number;
  bib: string;
  athleteName: string;
  ageGroup: string | null;
  lastCheckpoint: string;
  chipTime: string | null;
  gunTime: string | null;
  gap: string | null;
  status: 'FINISHED' | 'MISS' | 'DNS';
}

/**
 * Download a full leaderboard export as CSV (F-008 BR-CC-12/13).
 *
 * Format: UTF-8 BOM + CRLF + RFC-4180 escape + formula-injection guard
 * (leading `=` `+` `-` `@` prefixed with `'`). Vietnamese-friendly headers.
 *
 * Filename pattern: `command-center-{course}-{ISO timestamp}.csv` per BR-CC-13.
 */
export function downloadFullCSV(
  rows: FullLeaderboardRow[],
  courseName: string,
): void {
  const headers = [
    'Hạng',
    'BIB',
    'VĐV',
    'Cự ly tuổi',
    'CP gần nhất',
    'Chip Time',
    'Gun Time',
    'Gap',
    'Trạng thái',
  ];
  const dataRows = rows.map((r) => [
    String(r.rank),
    r.bib,
    r.athleteName,
    r.ageGroup ?? '',
    r.lastCheckpoint,
    r.chipTime ?? '',
    r.gunTime ?? '',
    r.gap ?? '',
    r.status,
  ]);
  const csvBody = [headers, ...dataRows]
    .map((cols) => cols.map(csvEscapeSafe).join(','))
    .join('\r\n');
  const BOM = '﻿';
  const blob = new Blob([BOM + csvBody], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildFullExportFilename(courseName);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * RFC-4180 escape + formula-injection guard. CSV cells beginning with `=`,
 * `+`, `-`, `@` are prefixed with a single quote so spreadsheet apps treat
 * them as text instead of formulas (BR-CC-13 / Section 8.3 sanitize).
 */
function csvEscapeSafe(field: string): string {
  let v = field;
  if (/^[=+\-@]/.test(v)) v = `'${v}`;
  if (/[",\r\n\t]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/** F-008 BR-CC-13 filename: `command-center-{course}-{ISO}.csv`. */
export function buildFullExportFilename(courseName: string): string {
  const safe = courseName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'course';
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `command-center-${safe}-${ts}.csv`;
}

/**
 * Build a download filename like `top-10-42km-Full-Marathon-2026-05-06T12-30-15.csv`.
 * Strips unsafe characters from the course name and uses an ISO timestamp
 * with `:` replaced by `-` (Windows filename safety).
 */
export function buildExportFilename(
  topN: number,
  courseName: string,
  ext: 'csv' | 'txt' = 'csv',
): string {
  const safeCourse = courseName
    .normalize('NFKD')
    // strip accents
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'course';
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `top-${topN}-${safeCourse}-${ts}.${ext}`;
}
