/**
 * F-045 — Audit script Class 5+6 verification (TC-45-08).
 *
 * BR-45-12 (Class 5 bank account + Class 6 bank branch + provider name regex
 * extension). Post-fix gate: zero hardcoded across ALL 6 pattern classes
 * (F-042+F-044+F-045 superset).
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

const F045_LEAK_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Class 5 bank account 5BIB', pattern: /\b110398986\b/ },
  { name: 'Class 5 bank account 5SOLUTION', pattern: /\b111213998\b/ },
  {
    name: 'Class 6 bank branch hardcoded',
    pattern: /MB chi nhánh (Thụy Khuê|Hai Bà Trưng)/,
  },
  {
    name: 'Class 6 long bank format',
    pattern: /Ngân hàng TMCP Quân Đội \(MB\) – Chi nhánh/,
  },
  { name: 'Class 6 provider 5BIB UPPER', pattern: /CÔNG TY CỔ PHẦN 5BIB(?!\s+KHÔNG)/ },
  { name: 'Class 6 provider 5SOLUTION', pattern: /CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION/ },
  { name: 'Class 6 provider 5BIB proper', pattern: /Công ty Cổ phần 5BIB/ },
  { name: 'Class 6 provider 5BIB no-diacritic', pattern: /CONG TY CO PHAN 5BIB/ },
];

// All templates affected by F-045 (4 BA inventory + 1 Manager Adjustment extension)
const F045_TEMPLATES = [
  'acceptance-racekit.docx',
  'acceptance-timing.docx',
  'acceptance-operations.docx',
  'contract-ticket-sales.docx',
  'contract-operations.docx', // Manager scope extension 2026-05-19
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

describe('F-045 — Audit script Class 5+6 post-fix verification', () => {
  describe('TC-45-08: All F-045 templates have ZERO Class 5+6 hardcoded leaks', () => {
    for (const file of F045_TEMPLATES) {
      it(`${file} — no Class 5+6 hardcoded patterns`, () => {
        const text = extractAllText(file);
        const violations: string[] = [];
        for (const { name, pattern } of F045_LEAK_PATTERNS) {
          const found = text.match(pattern);
          if (found) {
            violations.push(`[${name}] → "${found[0]}"`);
          }
        }
        if (violations.length > 0) {
          throw new Error(
            `Found F-045 hardcoded leaks in ${file}:\n  ${violations.join('\n  ')}`,
          );
        }
      });
    }
  });

  describe('Audit script source contains Class 5+6 patterns', () => {
    const scriptPath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'scripts',
      'audit-template-placeholders.ts',
    );
    const scriptSrc = fs.readFileSync(scriptPath, 'utf-8');

    const REQUIRED_PATTERNS = [
      '\\b110398986\\b',
      '\\b111213998\\b',
      'MB chi nhánh (Thụy Khuê|Hai Bà Trưng)',
      'CÔNG TY CỔ PHẦN 5BIB',
      'CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION',
      'CONG TY CO PHAN 5BIB',
    ];

    for (const pat of REQUIRED_PATTERNS) {
      it(`audit script contains pattern: ${pat}`, () => {
        expect(scriptSrc).toContain(pat);
      });
    }
  });
});
