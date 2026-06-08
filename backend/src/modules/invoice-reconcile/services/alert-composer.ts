/**
 * F-076 BR-25 → BR-31 — pure HTML composer cho 7 loại Telegram alert.
 *
 * Telegram `parse_mode=HTML` allowlist: `<b>`, `<i>`, `<u>`, `<s>`, `<a>`, `<code>`, `<pre>`.
 * KHÔNG dùng tag khác → Telegram reject với 400 Bad Request.
 *
 * MUST escape user-controlled text trước khi nhúng vào HTML (TC-23b).
 * Body length cap 4096 chars (Telegram limit).
 *
 * Pure function — KHÔNG side effect. Caller (InvoiceAlertService) tự gửi.
 */
import { ReconcileReportDto } from '../dto/reconcile-report.dto';
import { MissingInvoiceRowDto } from '../dto/missing-invoice-row.dto';
import { DiffEvent } from './diff-computer';

const TELEGRAM_MAX_LEN = 4096;

/** Escape HTML special chars cho Telegram parse_mode=HTML. */
export function escapeHtml(s: string | number | null | undefined): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format VND amount with vi-VN locale + 'đ' suffix. */
export function formatVnd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' đ';
}

/** Truncate text to fit Telegram 4096-char limit. Suffix cảnh báo nếu cắt. */
export function truncate(text: string, max: number = TELEGRAM_MAX_LEN): string {
  if (text.length <= max) return text;
  const suffix = '\n…(đã cắt — xem dashboard)';
  return text.slice(0, max - suffix.length) + suffix;
}

/** Truncate missing list để vừa Telegram 4096-char limit. */
export function truncateRows(
  rows: string[],
  max: number,
): { lines: string[]; truncated: number } {
  let acc = 0;
  const out: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (acc + rows[i].length + 1 > max) {
      return { lines: out, truncated: rows.length - i };
    }
    out.push(rows[i]);
    acc += rows[i].length + 1;
  }
  return { lines: out, truncated: 0 };
}

/** Format ICT time HH:mm cho header. */
export function formatTimeIct(iso: string): string {
  const d = new Date(iso);
  // ICT = UTC+7
  const ict = new Date(d.getTime() + 7 * 3_600_000);
  const hh = String(ict.getUTCHours()).padStart(2, '0');
  const mm = String(ict.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

const SEVERITY_EMOJI: Record<string, string> = {
  INFO: '🟢',
  WARN: '🟡',
  CRITICAL: '🔴',
};

const BUCKET_EMOJI: Record<string, string> = {
  OK: '🟢',
  SYNC_LAG: '🟡',
  UNISSUED: '🔴',
  DUPLICATE: '🔥',
};

/**
 * BR-25 Loại 1 — INFO Hourly Recap. Gửi tiếng tròn 08:00-20:00.
 */
export function composeHourlyRecap(
  report: ReconcileReportDto,
  diffEvents: DiffEvent[],
  dashboardUrl: string,
): string {
  const time = formatTimeIct(report.runAt);
  const lines: string[] = [];
  lines.push(`📊 <b>5BIB Invoice Recap — ${time} ICT ${report.date}</b>`);
  lines.push('');
  lines.push(`🟢 OK:        <b>${report.issuedCount}</b> đơn (đã xuất + match MISA)`);

  const syncLag = report.missing.filter((m) => m.bucket === 'SYNC_LAG').length;
  const unissued = report.missing.filter((m) => m.bucket === 'UNISSUED').length;
  const duplicate = report.duplicateCount;
  const maxAge = report.missing.reduce(
    (max, m) => (m.ageHours > max ? m.ageHours : max),
    0,
  );

  lines.push(`🟡 SYNC_LAG:  <b>${syncLag}</b> đơn (DB chưa update vat_ref)`);
  lines.push(
    `🔴 UNISSUED:  <b>${unissued}</b> đơn${
      unissued > 0 ? ` (max age ${maxAge}h)` : ''
    }`,
  );
  lines.push(`🔥 DUPLICATE: <b>${duplicate}</b> đơn`);

  if (diffEvents.length > 0) {
    lines.push('');
    lines.push('<b>Diff vs 1h trước:</b>');
    let count = 0;
    for (const ev of diffEvents) {
      if (count >= 10) {
        lines.push(`  … và ${diffEvents.length - 10} events nữa`);
        break;
      }
      lines.push(`  ${formatDiffEvent(ev)}`);
      count++;
    }
  }

  lines.push('');
  lines.push(
    `📌 Cần action: <b>${report.atRiskCount}</b> critical (age ≥ 20h)`,
  );
  lines.push(`🔗 <a href="${escapeHtml(dashboardUrl)}">Mở dashboard</a>`);
  return truncate(lines.join('\n'));
}

function formatDiffEvent(ev: DiffEvent): string {
  switch (ev.type) {
    case 'PAID_NEW':
      return `+ Đơn mới <code>${escapeHtml(ev.orderCode)}</code> (race ${
        ev.raceId
      }, ${formatVnd(ev.totalPrice)})`;
    case 'ISSUED':
      return `✅ Đã xuất <code>${escapeHtml(ev.orderCode)}</code>${
        ev.misaInvNo ? ` → InvNo ${escapeHtml(ev.misaInvNo)}` : ''
      }`;
    case 'BUCKET_ESCALATED':
      return `⚠️ <code>${escapeHtml(ev.orderCode)}</code> age ${
        ev.ageHoursPrev
      }h → ${ev.ageHoursNow}h (${ev.severityPrev}→${ev.severityNow})`;
    case 'DUPLICATE_NEW':
      return `🔥 DUPLICATE <code>${escapeHtml(ev.orderCode)}</code> race ${
        ev.raceId
      } — ${ev.duplicateCount} hóa đơn gốc`;
  }
}

/**
 * BR-26 Loại 2 — WARN Bucket Escalation (đơn vừa chạm 12h).
 */
export function composeWarnAlert(
  row: MissingInvoiceRowDto,
  dashboardUrl: string,
  ageWarnHours: number,
  ageBreachedHours: number,
): string {
  const remaining = ageBreachedHours - row.ageHours;
  const lines: string[] = [];
  lines.push('🟡 <b>WARN — Đơn sắp đến deadline xuất hóa đơn</b>');
  lines.push('');
  lines.push(
    `Race ${row.raceId} — order <code>${escapeHtml(
      row.orderCode,
    )}</code> — ${formatVnd(row.totalPrice)}`,
  );
  lines.push(`  • Paid: ${formatPaymentTimeIct(row.paymentOn)}`);
  lines.push(
    `  • Age:  ${row.ageHours}h (còn ${Math.max(0, remaining)}h trước phạt)`,
  );
  lines.push('  • Status: Chưa có vat_ref + MISA chưa thấy hóa đơn');
  lines.push('');
  lines.push('→ Báo DEV check legacy webhook MISA');
  lines.push(`🔗 <a href="${escapeHtml(dashboardUrl)}">Mở dashboard</a>`);
  return truncate(lines.join('\n'));
}

/**
 * BR-27 Loại 3 — CRITICAL (đơn vừa chạm 20h).
 */
export function composeCriticalAlert(
  row: MissingInvoiceRowDto,
  dashboardUrl: string,
  ageBreachedHours: number,
): string {
  const remaining = ageBreachedHours - row.ageHours;
  const lines: string[] = [];
  lines.push(
    `🔴 <b>CRITICAL — Còn &lt;${Math.max(
      0,
      remaining,
    )}h trước khi bị phạt 6tr</b>`,
  );
  lines.push('');
  lines.push(
    `Race ${row.raceId} — order <code>${escapeHtml(
      row.orderCode,
    )}</code> — ${formatVnd(row.totalPrice)}`,
  );
  lines.push(`  • Paid: ${formatPaymentTimeIct(row.paymentOn)}`);
  lines.push(`  • Age:  <b>${row.ageHours}h</b>`);
  lines.push('');
  lines.push(
    '→ XỬ LÝ NGAY: DEV trigger publish thủ công hoặc Finance liên hệ MISA support',
  );
  lines.push(`🔗 <a href="${escapeHtml(dashboardUrl)}">Mở dashboard</a>`);
  return truncate(lines.join('\n'));
}

/**
 * BR-28 Loại 4 — BREACHED (đơn vượt 24h, đã phạt).
 */
export function composeBreachedAlert(
  row: MissingInvoiceRowDto,
  dashboardUrl: string,
): string {
  const lines: string[] = [];
  lines.push('🔥 <b>BREACHED — Đã quá deadline, dự kiến phạt 6.000.000 đ</b>');
  lines.push('');
  lines.push(
    `Race ${row.raceId} — order <code>${escapeHtml(
      row.orderCode,
    )}</code> — ${formatVnd(row.totalPrice)}`,
  );
  lines.push(`  • Paid: ${formatPaymentTimeIct(row.paymentOn)}`);
  lines.push(`  • Age:  <b>${row.ageHours}h</b> (đã quá ${row.ageHours - 24}h)`);
  lines.push('  • Phí phạt dự kiến: 6.000.000 đ (NĐ 125/2020 Art. 24)');
  lines.push('');
  lines.push('→ Finance team document case + báo Danny cho audit Q');
  lines.push(`🔗 <a href="${escapeHtml(dashboardUrl)}">Mở dashboard</a>`);
  return truncate(lines.join('\n'));
}

/**
 * BR-29 Loại 5 — DUPLICATE (MISA có ≥2 invoice gốc cùng orderId).
 */
export function composeDuplicateAlert(
  row: MissingInvoiceRowDto,
  dashboardUrl: string,
): string {
  const lines: string[] = [];
  lines.push(
    '🔥 <b>DUPLICATE INVOICE — MISA có nhiều hóa đơn gốc cùng order</b>',
  );
  lines.push('');
  lines.push(
    `Order <code>${escapeHtml(row.orderCode)}</code> — race ${
      row.raceId
    } — ${formatVnd(row.totalPrice)}`,
  );
  lines.push(
    `  • <b>${row.duplicateCount ?? 2}</b> hóa đơn gốc trong MISA`,
  );
  lines.push('  • Khả năng: DEV test local push thẳng PROD, hoặc legacy retry bug');
  lines.push('');
  lines.push('→ Báo DEV check NGAY + xuất hóa đơn HỦY cho các bản dư');
  lines.push(`🔗 <a href="${escapeHtml(dashboardUrl)}">Mở dashboard</a>`);
  return truncate(lines.join('\n'));
}

/**
 * BR-30 Loại 6 — MISA Health UNAVAILABLE.
 */
export function composeMisaUnavailableAlert(
  lastError: string,
  dashboardUrl: string,
): string {
  const lines: string[] = [];
  lines.push('⚠️ <b>CRITICAL — MISA Meinvoice API không kết nối được</b>');
  lines.push('');
  lines.push('  • 3 lần retry liên tiếp fail trong 15p qua');
  lines.push(`  • Last error: <code>${escapeHtml(lastError)}</code>`);
  lines.push(
    '  • Impact: Layer 2 cross-check OFFLINE, có thể miss SYNC_LAG case',
  );
  lines.push('');
  lines.push('→ DEV check VPS network / MISA status (https://meinvoice.vn)');
  lines.push(
    `→ Dashboard hiển thị banner "MISA UNREACHABLE": <a href="${escapeHtml(
      dashboardUrl,
    )}">Mở</a>`,
  );
  return truncate(lines.join('\n'));
}

/**
 * BR-30 Loại 6 — MISA Auth FAIL (env credentials sai).
 */
export function composeMisaAuthFailAlert(
  errorBody: string,
  dashboardUrl: string,
): string {
  const lines: string[] = [];
  lines.push('⚠️ <b>CRITICAL — MISA token bị reject (AUTH_FAIL)</b>');
  lines.push('');
  lines.push(
    '  • 401 từ MISA API, KHÔNG phải TokenExpiredCode (env credentials sai?)',
  );
  lines.push(`  • Last error: <code>${escapeHtml(errorBody)}</code>`);
  lines.push('');
  lines.push(
    '→ Kiểm tra env <code>MISA_USERNAME</code>, <code>MISA_PASSWORD</code>, <code>MISA_TAX_CODE</code> trên VPS',
  );
  lines.push(`🔗 <a href="${escapeHtml(dashboardUrl)}">Mở dashboard</a>`);
  return truncate(lines.join('\n'));
}

/**
 * BR-31 Loại 7 — EOD Daily Recap (21:00 hằng ngày).
 */
export function composeEodRecap(
  report: ReconcileReportDto,
  /** Counters Redis hash: total scan ticks, MISA calls, alerts sent per loại. */
  dailyCounters: Record<string, number>,
  dashboardUrl: string,
): string {
  const lines: string[] = [];
  lines.push(`🌙 <b>5BIB Invoice EOD Recap — ${report.date} (21:00 ICT)</b>`);
  lines.push('');
  lines.push('📊 <b>Tổng kết ngày:</b>');
  lines.push(
    `  • Đơn cần xuất:        <b>${report.expectedCount}</b> đơn`,
  );
  lines.push(
    `  • Đã xuất thành công:  <b>${report.issuedCount}</b> đơn (${
      report.expectedCount > 0
        ? Math.round((report.issuedCount / report.expectedCount) * 100)
        : 0
    }%)`,
  );
  lines.push(`  • Còn pending:         <b>${report.missingCount}</b> đơn`);

  const syncLag = report.missing.filter((m) => m.bucket === 'SYNC_LAG').length;
  const unissued = report.missing.filter((m) => m.bucket === 'UNISSUED').length;
  lines.push(`    - 🟡 SYNC_LAG:  ${syncLag} đơn`);
  lines.push(`    - 🔴 UNISSUED:  ${unissued} đơn`);
  lines.push(`    - 🔥 DUPLICATE: ${report.duplicateCount} đơn`);
  lines.push(
    `  • 🔥 BREACHED:           <b>${report.breachedCount}</b> đơn${
      report.breachedCount === 0 ? ' ✅' : ' (cần audit Q)'
    }`,
  );

  lines.push('');
  lines.push('🔧 <b>System Health:</b>');
  lines.push(
    `  • Scan ticks chạy: ${dailyCounters['scan-ticks'] ?? 0}`,
  );
  lines.push(
    `  • MISA calls:      OK ${dailyCounters['misa-ok'] ?? 0} / DEGRADED ${
      dailyCounters['misa-degraded'] ?? 0
    } / FAIL ${dailyCounters['misa-fail'] ?? 0}`,
  );
  lines.push(`  • Layer 2 status:  ${report.layer2Status}`);

  lines.push('');
  lines.push('🚨 <b>Alerts đã gửi hôm nay:</b>');
  lines.push(`  • WARN:      ${dailyCounters['alert-warn'] ?? 0} lần`);
  lines.push(`  • CRITICAL:  ${dailyCounters['alert-critical'] ?? 0} lần`);
  lines.push(`  • BREACHED:  ${dailyCounters['alert-breached'] ?? 0} lần`);
  lines.push(`  • DUPLICATE: ${dailyCounters['alert-duplicate'] ?? 0} lần`);

  if (unissued > 0) {
    lines.push('');
    lines.push('📌 <b>Action cho ngày mai:</b>');
    lines.push(
      `  • ${unissued} đơn UNISSUED chưa xử lý — sáng mai 08:00 sẽ alert CRITICAL nếu vẫn pending`,
    );
    if (syncLag > 0) {
      lines.push(`  • ${syncLag} đơn SYNC_LAG kéo dài → DEV check sync bug`);
    }
  }

  lines.push('');
  lines.push(`🔗 <a href="${escapeHtml(dashboardUrl)}">Mở dashboard</a>`);
  return truncate(lines.join('\n'));
}

/** Helper format payment_on string sang HH:mm DD/MM ICT. */
function formatPaymentTimeIct(iso: string): string {
  const d = new Date(iso);
  const ict = new Date(d.getTime() + 7 * 3_600_000);
  const hh = String(ict.getUTCHours()).padStart(2, '0');
  const mm = String(ict.getUTCMinutes()).padStart(2, '0');
  const dd = String(ict.getUTCDate()).padStart(2, '0');
  const mo = String(ict.getUTCMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} ${dd}/${mo} ICT`;
}
