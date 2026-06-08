/**
 * F-076 TC-23a..c — alert composer (pure HTML) tests.
 */
import {
  composeBreachedAlert,
  composeCriticalAlert,
  composeDuplicateAlert,
  composeEodRecap,
  composeHourlyRecap,
  composeMisaUnavailableAlert,
  composeMisaAuthFailAlert,
  composeWarnAlert,
  escapeHtml,
  formatVnd,
  truncate,
} from '../services/alert-composer';
import { MissingInvoiceRowDto } from '../dto/missing-invoice-row.dto';
import { ReconcileReportDto } from '../dto/reconcile-report.dto';

function row(
  overrides: Partial<MissingInvoiceRowDto>,
): MissingInvoiceRowDto {
  return {
    orderId: 200029416,
    orderCode: '#5B200029416IB',
    raceId: 220,
    email: 'test@5bib.com',
    buyerName: 'Hiền Nghiêm',
    totalPrice: 1200000,
    paymentOn: '2026-06-08T22:00:00Z',
    orderCategory: 'ORDINARY',
    ageHours: 22,
    bucket: 'UNISSUED',
    severity: 'CRITICAL',
    breached: false,
    misaInvNo: null,
    duplicateCount: undefined,
    ...overrides,
  };
}

function report(
  overrides: Partial<ReconcileReportDto>,
): ReconcileReportDto {
  return {
    date: '2026-06-09',
    runAt: '2026-06-09T07:00:00Z',
    mode: 'cron',
    raceIdsScanned: [140, 220],
    expectedCount: 48,
    issuedCount: 45,
    missingCount: 3,
    atRiskCount: 1,
    duplicateCount: 0,
    breachedCount: 0,
    missing: [],
    misaOrphan: [],
    layer2Status: 'OK',
    maxSeverity: 'CRITICAL',
    alertSent: false,
    ...overrides,
  };
}

describe('alert-composer — helpers', () => {
  // TC-23b — HTML escape
  it('TC-23b: escapeHtml prevents injection', () => {
    expect(escapeHtml('evil<script>alert(1)</script>@x.com')).toBe(
      'evil&lt;script&gt;alert(1)&lt;/script&gt;@x.com',
    );
    expect(escapeHtml('a&b')).toBe('a&amp;b');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(1234)).toBe('1234');
  });

  it('formatVnd renders vi-VN locale', () => {
    expect(formatVnd(1200000)).toBe('1.200.000 đ');
    expect(formatVnd(0)).toBe('0 đ');
    expect(formatVnd(null)).toBe('0 đ');
    expect(formatVnd(undefined)).toBe('0 đ');
  });

  // TC-23c — Truncate
  it('TC-23c: truncate caps to Telegram 4096 limit with suffix', () => {
    const huge = 'a'.repeat(5000);
    const out = truncate(huge);
    expect(out.length).toBeLessThanOrEqual(4096);
    expect(out.endsWith('xem dashboard)')).toBe(true);
  });

  it('truncate does NOT touch short text', () => {
    const small = 'hello';
    expect(truncate(small)).toBe(small);
  });
});

describe('alert-composer — render snapshot tests', () => {
  it('BR-26 composeWarnAlert renders order code + age + remaining hours', () => {
    const out = composeWarnAlert(
      row({ ageHours: 12, severity: 'WARN' }),
      'https://admin.5bib.com',
      12,
      24,
    );
    expect(out).toContain('🟡 <b>WARN');
    expect(out).toContain('<code>#5B200029416IB</code>');
    expect(out).toContain('Age:  12h');
    expect(out).toContain('còn 12h trước phạt');
    expect(out).toContain('1.200.000 đ');
  });

  it('BR-27 composeCriticalAlert mentions remaining < 4h', () => {
    const out = composeCriticalAlert(
      row({ ageHours: 20 }),
      'https://admin.5bib.com',
      24,
    );
    expect(out).toContain('🔴 <b>CRITICAL');
    expect(out).toContain('4h trước khi bị phạt');
    expect(out).toContain('Age:  <b>20h</b>');
  });

  it('BR-28 composeBreachedAlert mentions 6.000.000 đ penalty', () => {
    const out = composeBreachedAlert(
      row({ ageHours: 25, breached: true }),
      'https://admin.5bib.com',
    );
    expect(out).toContain('🔥 <b>BREACHED');
    expect(out).toContain('6.000.000 đ');
    expect(out).toContain('NĐ 125/2020');
  });

  it('BR-29 composeDuplicateAlert mentions count', () => {
    const out = composeDuplicateAlert(
      row({ bucket: 'DUPLICATE', duplicateCount: 5 }),
      'https://admin.5bib.com',
    );
    expect(out).toContain('🔥 <b>DUPLICATE');
    expect(out).toContain('<b>5</b> hóa đơn gốc');
    expect(out).toContain('DEV test local');
  });

  it('BR-30 composeMisaUnavailableAlert mentions error', () => {
    const out = composeMisaUnavailableAlert(
      'ECONNREFUSED https://api.meinvoice.vn',
      'https://admin.5bib.com',
    );
    expect(out).toContain('MISA Meinvoice API không kết nối được');
    expect(out).toContain('ECONNREFUSED');
  });

  it('BR-30 composeMisaAuthFailAlert mentions env keys', () => {
    const out = composeMisaAuthFailAlert(
      'token rejected',
      'https://admin.5bib.com',
    );
    expect(out).toContain('AUTH_FAIL');
    expect(out).toContain('MISA_USERNAME');
    expect(out).toContain('MISA_PASSWORD');
  });

  it('BR-25 composeHourlyRecap renders 4 buckets + diff', () => {
    const r = report({
      issuedCount: 45,
      missing: [row({ bucket: 'SYNC_LAG', severity: 'WARN' })],
    });
    const out = composeHourlyRecap(r, [], 'https://admin.5bib.com');
    expect(out).toContain('5BIB Invoice Recap');
    expect(out).toContain('🟢 OK:');
    expect(out).toContain('🟡 SYNC_LAG');
    expect(out).toContain('🔴 UNISSUED');
    expect(out).toContain('🔥 DUPLICATE');
    expect(out).toContain('<b>45</b>');
  });

  it('BR-31 composeEodRecap renders daily counters', () => {
    const r = report({
      issuedCount: 45,
      missing: [],
      missingCount: 0,
      expectedCount: 48,
    });
    const counters = {
      'scan-ticks': 180,
      'misa-ok': 179,
      'misa-degraded': 1,
      'alert-warn': 2,
      'alert-critical': 1,
    };
    const out = composeEodRecap(r, counters, 'https://admin.5bib.com');
    expect(out).toContain('🌙 <b>5BIB Invoice EOD Recap');
    expect(out).toContain('Đơn cần xuất:');
    expect(out).toContain('Scan ticks chạy: 180');
    expect(out).toContain('WARN:      2 lần');
    expect(out).toContain('CRITICAL:  1 lần');
  });
});
