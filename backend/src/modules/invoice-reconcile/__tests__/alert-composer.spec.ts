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
  composeRaceTag,
  composeWarnAlert,
  computeNextHeartbeatHour,
  escapeHtml,
  formatVnd,
  truncate,
} from '../services/alert-composer';
import type { DiffEvent } from '../services/diff-computer';
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

/**
 * F-079 — 3-state Heartbeat composer + race title resolver render tests.
 *
 * Coverage map (theo PRD `01-ba-prd.md`):
 *   TC-79-01 "All OK" state
 *   TC-79-02 "All OK + diff" state
 *   TC-79-03 "Có issue" state (regression BR-25 4-line stats intact)
 *   TC-79-04 computeNextHeartbeatHour mapping
 *   TC-79-15 race title truncate >80 char
 *   TC-79-16 multi-race title integration via raceTitlesByid Map
 *   TC-79-17 escape HTML diacritics + <script>
 */
describe('F-079 — Heartbeat composer 3-state + race title', () => {
  const TITLE_LCM = 'LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG';
  const TITLE_COROS = '5BIB x COROS';

  describe('TC-79-04 — computeNextHeartbeatHour', () => {
    it.each([
      [8, '10:00 ICT'],
      [10, '12:00 ICT'],
      [12, '14:00 ICT'],
      [14, '16:00 ICT'],
      [16, '18:00 ICT'],
      [18, '20:00 ICT'],
      [20, '22:00 ICT'],
      [22, '08:00 ICT (ngày hôm sau)'],
      [9, '08:00 ICT (ngày hôm sau)'], // not a heartbeat hour → fallback next-day
      [0, '08:00 ICT (ngày hôm sau)'],
    ])('hour %i → %s', (input, expected) => {
      expect(computeNextHeartbeatHour(input)).toBe(expected);
    });
  });

  describe('TC-79-15 — composeRaceTag truncate + escape + fallback', () => {
    it('returns "Race {id}" fallback when title undefined (BR-79-23)', () => {
      expect(composeRaceTag(undefined, 220)).toBe('Race 220');
    });

    it('renders {title} - {id} for short title (BR-79-20)', () => {
      expect(composeRaceTag(TITLE_COROS, 140)).toBe('5BIB x COROS - 140');
    });

    it('escapes HTML diacritics + <> (BR-79-24)', () => {
      expect(composeRaceTag('<script>alert(1)</script> Marathon', 99)).toContain(
        '&lt;script&gt;alert(1)&lt;/script&gt; Marathon',
      );
    });

    it('truncates title > 80 chars to slice(0,77) + "..." (BR-79-25)', () => {
      const longTitle = 'A'.repeat(100);
      const result = composeRaceTag(longTitle, 220);
      expect(result).toMatch(/^A{77}\.\.\. - 220$/);
    });

    it('keeps real PROD race 220 title (47 chars under threshold)', () => {
      const result = composeRaceTag(TITLE_LCM, 220);
      expect(result).toBe(`${TITLE_LCM} - 220`);
      expect(result.length).toBeLessThan(80);
    });
  });

  describe('TC-79-01 — "All OK" state (missing=0, diff=[])', () => {
    it('renders Heartbeat header + ✅ All OK status + stats block', () => {
      const r = report({
        missingCount: 0,
        issuedCount: 23,
        expectedCount: 23,
        skippedCount: 2,
        duplicateCount: 0,
        atRiskCount: 0,
        missing: [],
        raceIdsScanned: [220],
      });
      const titles = new Map<number, string>([[220, TITLE_LCM]]);
      const out = composeHourlyRecap(r, [], 'https://result.5bib.com/invoice-reconcile', titles);
      expect(out).toContain('5BIB Invoice Heartbeat');
      expect(out).not.toContain('5BIB Invoice Recap'); // heartbeat header, not recap
      expect(out).toContain(`Giải: <b>${TITLE_LCM} - 220</b>`);
      expect(out).toContain('✅ <b>All OK</b>');
      expect(out).toContain('23/23 đơn ORDINARY');
      expect(out).toContain('Expected:  <b>23</b>');
      expect(out).toContain('Skipped (INSURANCE/MANUAL): <b>2</b>');
      expect(out).not.toContain('🔴 UNISSUED');
      expect(out).not.toContain('🟡 SYNC_LAG');
      expect(out).toContain('🕐 Next heartbeat:');
    });
  });

  describe('TC-79-02 — "All OK + diff" state (missing=0, diff > 0)', () => {
    it('adds Diff block + Heartbeat header + ✅ All OK retained', () => {
      const r = report({
        missingCount: 0,
        issuedCount: 25,
        expectedCount: 25,
        skippedCount: 2,
        duplicateCount: 0,
        atRiskCount: 0,
        missing: [],
        raceIdsScanned: [220],
      });
      const diffEvents: DiffEvent[] = [
        {
          type: 'PAID_NEW',
          orderId: 200029534,
          orderCode: '#5B200029534IB',
          raceId: 220,
          totalPrice: 500000,
        },
        {
          type: 'ISSUED',
          orderId: 200029530,
          orderCode: '#5B200029530IB',
          misaInvNo: '00000043',
        },
      ];
      const titles = new Map<number, string>([[220, TITLE_LCM]]);
      const out = composeHourlyRecap(r, diffEvents, 'https://result.5bib.com', titles);
      expect(out).toContain('5BIB Invoice Heartbeat');
      expect(out).toContain('✅ <b>All OK</b>');
      expect(out).toContain('<b>Diff vs 2h trước:</b>');
      expect(out).toContain('#5B200029534IB');
      expect(out).toContain(`${TITLE_LCM} - 220`);
      expect(out).toContain('Đã xuất');
      expect(out).toContain('InvNo 00000043');
    });
  });

  describe('TC-79-03 — "Có issue" state (missing > 0) regression BR-25', () => {
    it('renders Recap header (NOT Heartbeat) + 4-line BR-25 stats intact', () => {
      const r = report({
        missingCount: 3,
        issuedCount: 20,
        expectedCount: 23,
        skippedCount: 2,
        duplicateCount: 0,
        atRiskCount: 1,
        missing: [
          row({ bucket: 'UNISSUED', severity: 'CRITICAL', ageHours: 22 }),
          row({ bucket: 'SYNC_LAG', severity: 'WARN', ageHours: 4 }),
          row({ bucket: 'UNISSUED', severity: 'WARN', ageHours: 14 }),
        ],
        raceIdsScanned: [220],
      });
      const titles = new Map<number, string>([[220, TITLE_LCM]]);
      const out = composeHourlyRecap(r, [], 'https://result.5bib.com', titles);
      expect(out).toContain('5BIB Invoice Recap');
      expect(out).not.toContain('5BIB Invoice Heartbeat');
      expect(out).toContain(`Giải: <b>${TITLE_LCM} - 220</b>`);
      expect(out).toContain('🟢 OK:');
      expect(out).toContain('🟡 SYNC_LAG');
      expect(out).toContain('🔴 UNISSUED');
      expect(out).toContain('🔥 DUPLICATE');
      expect(out).toContain('max age 22h');
      expect(out).toContain('Cần action');
      expect(out).not.toContain('✅ <b>All OK</b>');
    });
  });

  describe('TC-79-16 — multi-race title integration', () => {
    it('renders both race titles in Giải line for raceIdsScanned=[140,220]', () => {
      const r = report({
        missingCount: 0,
        issuedCount: 50,
        expectedCount: 50,
        skippedCount: 2,
        duplicateCount: 0,
        missing: [],
        raceIdsScanned: [140, 220],
      });
      const titles = new Map<number, string>([
        [140, TITLE_COROS],
        [220, TITLE_LCM],
      ]);
      const out = composeHourlyRecap(r, [], 'https://result.5bib.com', titles);
      expect(out).toContain(`${TITLE_COROS} - 140`);
      expect(out).toContain(`${TITLE_LCM} - 220`);
      // Both in same Giải line
      expect(out).toMatch(/Giải: <b>.*140.*220.*<\/b>/);
    });

    it('falls back Race {id} when raceTitlesByid empty Map (BR-79-23)', () => {
      const r = report({
        missingCount: 0,
        issuedCount: 23,
        expectedCount: 23,
        skippedCount: 2,
        duplicateCount: 0,
        missing: [],
        raceIdsScanned: [220],
      });
      const out = composeHourlyRecap(r, [], 'https://result.5bib.com');
      expect(out).toContain('Giải: <b>Race 220</b>');
    });
  });

  describe('TC-79-17 — escape HTML in race title (BR-79-24)', () => {
    it('escapes <script> tag from malicious race title', () => {
      const r = report({
        missingCount: 0,
        issuedCount: 5,
        expectedCount: 5,
        skippedCount: 0,
        missing: [],
        raceIdsScanned: [666],
      });
      const titles = new Map<number, string>([
        [666, '<script>alert(1)</script> Marathon'],
      ]);
      const out = composeHourlyRecap(r, [], 'https://result.5bib.com', titles);
      expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt; Marathon - 666');
      expect(out).not.toContain('<script>alert(1)</script>');
    });
  });

  describe('Backward compat — composeHourlyRecap without raceTitlesByid param', () => {
    it('still works with old 3-arg signature (default empty Map)', () => {
      const r = report({
        missingCount: 0,
        issuedCount: 10,
        expectedCount: 10,
        skippedCount: 0,
        missing: [],
        raceIdsScanned: [220],
      });
      // Call without 4th arg — backward compat
      const out = composeHourlyRecap(r, [], 'https://result.5bib.com');
      expect(out).toContain('Race 220'); // fallback
      expect(out).toContain('Heartbeat');
    });
  });
});
