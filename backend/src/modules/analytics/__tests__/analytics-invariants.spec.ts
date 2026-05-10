import * as fs from 'fs';
import * as path from 'path';

/**
 * F-026 — Invariant integration spec.
 *
 * Verify 5 RED LINE business invariants được enforce ở SQL/code level
 * cho 6 service mới — bằng cách scan source file.
 *
 * BR-01 paid only — Refund/Cancel + Time-to-Fill: count theo financial_status.
 * BR-04 draft exclude — toàn bộ 5 service touching `races` phải có
 *        `status != 'draft'` + `is_delete = 0`.
 * BR-05 dedupe athletes_id — RepeatAthlete + GeoDemo + TimeToFill dùng
 *        `athletes_id` (KHÔNG `bib_number` cho dedup).
 */

const SVC_DIR = path.resolve(__dirname, '..', 'services');

function readSvc(name: string): string {
  return fs.readFileSync(path.join(SVC_DIR, name), 'utf-8');
}

/** Lọc comment block + line khỏi source để regex chỉ match code thực sự. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\*.*$/gm, '')
    .replace(/\/\/.*$/gm, '');
}

describe('F-026 invariants compliance (5 RED LINE)', () => {
  const services = [
    'repeat-athlete.service.ts',
    'merchant-churn.service.ts',
    'time-to-fill.service.ts',
    'geographic-demographic.service.ts',
    'refund-cancel.service.ts',
  ];

  it('BR-04 draft exclude: tất cả service touching races đều có status != draft + is_delete = 0', () => {
    for (const f of services) {
      const src = readSvc(f);
      expect(src).toMatch(/status\s*!=\s*'draft'/);
      expect(src).toMatch(/is_delete\s*=\s*0/);
    }
  });

  it('BR-05 dedupe athletes_id: RepeatAthlete dùng GROUP BY a.athletes_id', () => {
    const src = stripComments(readSvc('repeat-athlete.service.ts'));
    expect(src).toMatch(/GROUP BY\s+a\.athletes_id/);
    expect(src).not.toMatch(/GROUP BY [^\n]*\bbib_number\b/);
  });

  it('BR-05 dedupe athletes_id: GeoDemo dùng athletes_id', () => {
    const src = stripComments(readSvc('geographic-demographic.service.ts'));
    expect(src).toMatch(/athletes_id/);
    expect(src).not.toMatch(/GROUP BY [^\n]*\bbib_number\b/);
  });

  it('BR-05 dedupe athletes_id: TimeToFill paid count distinct theo athletes_id', () => {
    const src = readSvc('time-to-fill.service.ts');
    expect(src).toMatch(/COUNT\(DISTINCT[^)]+athletes_id/i);
  });

  it('BR-01 paid only: RefundCancel phân loại theo financial_status', () => {
    const src = readSvc('refund-cancel.service.ts');
    expect(src).toMatch(/financial_status/);
    // Tổng các trạng thái non-pending
    expect(src).toMatch(/'paid'/);
    expect(src).toMatch(/'refunded'/);
    expect(src).toMatch(/'cancelled'/);
  });
});
