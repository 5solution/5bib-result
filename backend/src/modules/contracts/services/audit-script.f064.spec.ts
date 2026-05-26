/**
 * F-064 — Audit script for Phase 4 hardcoded cleanup.
 *
 * Validates 5 production templates contain ZERO forbidden hardcoded
 * patterns after F-064 edit:
 *   - Date stamps from race Nghệ An 01-02/05/2026 + setup 29/05 + acceptance 11/04 + 14/04
 *   - Location: Phường Vinh, Tỉnh Nghệ An, Quảng trường Hồ Chí Minh
 *   - Provider legacy address: số 23 Duy Tân, Phường Cầu Giấy
 *   - Athlete count hardcode: "Số lượng VĐV : 3000"
 *
 * REUSES F-044/F-045 audit pattern (`extractAllText` via PizZip strip
 * XML tags). Each template tested independently to localize failure.
 */
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PizZip = require('pizzip');

const TEMPLATES_DIR = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'assets',
  'contract-templates',
);

/** F-064 forbidden hardcoded patterns. */
const F064_FORBIDDEN: string[] = [
  // Date stamps from old race fixture
  '01/05/2026',
  '02/05/2026',
  '29/05/2026',
  '11/04/2026',
  '14/04/2026',
  // Location strings (Nghệ An venue from old race)
  'Phường Vinh',
  'Tỉnh Nghệ An',
  'Quảng trường Hồ Chí Minh - Nghệ An',
  // Provider legacy address (5BIB moved from Cầu Giấy → Hà Đông)
  'Phường Cầu Giấy',
  'số 23 Duy Tân',
  // Athlete count hardcode
  'Số lượng VĐV : 3000',
];

const F064_TEMPLATES = [
  'contract-operations.docx',
  'acceptance-operations.docx',
  'acceptance-racekit.docx',
  'acceptance-timing.docx',
  'contract-racekit.docx',
];

function extractAllText(file: string): string {
  const buf = fs.readFileSync(path.join(TEMPLATES_DIR, file));
  const zip = new PizZip(buf);
  let combined = '';
  const targets = Object.keys(zip.files).filter(
    (n) =>
      n === 'word/document.xml' ||
      n.startsWith('word/header') ||
      n.startsWith('word/footer'),
  );
  for (const name of targets) {
    const xml = zip.files[name].asText();
    combined += `\n${xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')}`;
  }
  return combined;
}

describe('F-064 — Audit: 5 templates post-Phase 4 cleanup', () => {
  for (const file of F064_TEMPLATES) {
    it(`${file} — 0 forbidden patterns`, () => {
      const text = extractAllText(file);
      const violations: string[] = [];
      for (const pat of F064_FORBIDDEN) {
        if (text.includes(pat)) {
          violations.push(pat);
        }
      }
      if (violations.length > 0) {
        throw new Error(
          `Found ${violations.length} F-064 hardcoded leaks in ${file}:\n  ${violations.join('\n  ')}`,
        );
      }
    });
  }

  it('contract-operations.docx — phụ lục table has new "Chiết khấu" column', () => {
    const text = extractAllText('contract-operations.docx');
    expect(text).toContain('Chiết khấu');
    // Header should be in order: ... Đơn giá ... Chiết khấu ... Thành tiền ... Ghi chú
    const m = text.match(/Đơn giá[\s\S]{0,200}?Chiết khấu[\s\S]{0,200}?Thành tiền[\s\S]{0,200}?Ghi chú/);
    expect(m).not.toBeNull();
  });

  it('contract-operations.docx — new template variables present', () => {
    const text = extractAllText('contract-operations.docx');
    expect(text).toContain('{eventStartDate}');
    expect(text).toContain('{eventEndDate}');
    expect(text).toContain('{setupDate}');
    expect(text).toContain('{expoDate}');
    expect(text).toContain('{eventLocation}');
    // Phụ lục data row should have {note} after {amount}
    expect(text).toContain('{note}');
  });

  // QC P2-TEST-02 rework: extend assertion to ALL 3 acceptance templates
  // (was masking P1-FUNC-01 bug where racekit + timing missing acceptanceSignDate).
  const ACCEPTANCE_TEMPLATES = [
    'acceptance-operations.docx',
    'acceptance-racekit.docx',
    'acceptance-timing.docx',
  ];

  for (const file of ACCEPTANCE_TEMPLATES) {
    it(`${file} — {acceptanceSignDate} placeholder present`, () => {
      const text = extractAllText(file);
      expect(text).toContain('{acceptanceSignDate}');
    });

    it(`${file} — no literal "…….." leftover (PAUSE-64-11)`, () => {
      const text = extractAllText(file);
      // Literal Vietnamese ellipsis used as placeholder before F-064 cleanup.
      expect(text).not.toContain('…….');
    });
  }

  it('acceptance-operations.docx — also has {contractSignDate}', () => {
    const text = extractAllText('acceptance-operations.docx');
    expect(text).toContain('{contractSignDate}');
  });

  it('contract-racekit.docx — athleteCount + eventLocation variables present', () => {
    const text = extractAllText('contract-racekit.docx');
    expect(text).toContain('{athleteCount}');
    expect(text).toContain('{eventLocation}');
  });
});
