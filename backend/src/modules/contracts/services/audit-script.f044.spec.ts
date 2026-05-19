/**
 * F-044 — Audit script extension tests (TC-44-10 + TC-44-11).
 *
 * BR-44-13/14 + Manager Adjustment #3:
 *   - TC-44-10: Post-fix audit reports 0 hardcoded leaks across 4 pattern classes
 *   - TC-44-11: CONTEXT_KEYS Set contains F-042 11 + F-044 1 flatten keys
 *
 * Re-implements the audit pattern check inline (not via subprocess) to keep
 * test fast + deterministic. Validates against ACTUAL template binaries on
 * disk in `backend/assets/contract-templates/` post-F-044 edit.
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

/** F-044 BR-44-13 — leak pattern classes 2+3+4 (financial + CN + in-words). */
const F044_LEAK_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'vi-VN currency (F-042)', pattern: /[0-9]{1,3}\.[0-9]{3}\.[0-9]{3}/ },
  {
    name: 'CN slash format',
    pattern: /\d{2}\.\d{2}\/\d{4}\/H[ĐD]+V?\/[A-Z\-0-9]+/,
  },
  { name: 'CN dash format', pattern: /\d{2}\.\d{2}-HDDV-[A-Z0-9\-]+/ },
  {
    name: 'VN in-words',
    pattern:
      /(?:Một|Hai|Ba|Bốn|Năm|Sáu|Bảy|Tám|Chín|Mười)\s+(?:trăm|mươi|triệu|tỷ|nghìn|ngàn)\s+/,
  },
];

const F044_TEMPLATES = [
  'contract-racekit.docx',
  'contract-operations.docx',
  'contract-ticket-sales.docx',
  'acceptance-timing.docx',
  'acceptance-racekit.docx',
  'acceptance-operations.docx',
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

describe('F-044 — Audit script extended regex post-edit verification', () => {
  describe('TC-44-10: Post-fix audit reports zero hardcoded leaks per 4 pattern classes', () => {
    for (const file of F044_TEMPLATES) {
      it(`${file} — no hardcoded patterns from any F-044 class`, () => {
        const text = extractAllText(file);
        const violations: string[] = [];
        for (const { name, pattern } of F044_LEAK_PATTERNS) {
          const found = text.match(pattern);
          if (found) {
            violations.push(`[${name}] → "${found[0]}"`);
          }
        }
        if (violations.length > 0) {
          throw new Error(
            `Found hardcoded leaks in ${file}:\n  ${violations.join('\n  ')}`,
          );
        }
      });
    }
  });

  describe('TC-44-11: CONTEXT_KEYS Set in audit script covers F-042 + F-044 flatten keys', () => {
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

    const F042_FLATTEN_KEYS = [
      'actualSubtotal',
      'actualVatAmount',
      'actualTotalWithVat',
      'contractSubtotal',
      'diffAmount',
      'advancePaid',
      'remainingBalance',
      'actualTotalWithVatInWords',
      'reportDay',
      'reportMonth',
      'reportYear',
    ];

    const F044_NEW_FLATTEN_KEYS = ['remainingBalanceInWords'];

    for (const key of [...F042_FLATTEN_KEYS, ...F044_NEW_FLATTEN_KEYS]) {
      it(`CONTEXT_KEYS contains '${key}'`, () => {
        expect(scriptSrc).toContain(`'${key}'`);
      });
    }
  });
});
