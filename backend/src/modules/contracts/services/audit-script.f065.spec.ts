/**
 * F-065 — Audit script extension tests (TC-65-01 through TC-65-12).
 *
 * Verifies 7 forbidden legal-text patterns are absent from ALL 6 contract +
 * acceptance templates post-fix:
 *
 *   1. `Q11)`                                     — Bug #3 typo
 *   2. `theo Điều 4 của Hợp đồng`                 — Bug #6 wrong cross-ref
 *   3. `quy định tại Điều 7`                      — Bug #7 wrong cross-ref
 *   4. `chịu phạt giống điều 5`                   — Bug #8 wrong cross-ref
 *   5. `lãi suất bằng quy định tại Điều 5`        — Bug #9 wrong cross-ref
 *   6. `Bên tác động trở`                         — Bug #10 semantic error
 *   7. `Bên B thanh toán cho Bên A`               — Bug #11 redundant tax line
 *
 * Also positively asserts the 7 fixed-wording patterns are present in each of
 * the 3 contract templates (3 contracts × 7 = 21 wording assertions).
 *
 * REUSES F-044/F-045 inline-regex pattern (no subprocess) for deterministic +
 * fast test execution against actual DOCX binaries on disk.
 *
 * Acceptance: PRD AC-65-1, AC-65-2, FR-65-2.
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

const F065_FORBIDDEN_PATTERNS: Array<{ name: string; needle: string }> = [
  { name: 'B3 QH11) typo', needle: 'QH11)' },
  { name: 'B6 Điều 4 wrong-ref', needle: 'theo Điều 4 của Hợp đồng' },
  { name: 'B7 Điều 7 wrong-ref', needle: 'quy định tại Điều 7' },
  { name: 'B8 điều 5 wrong-ref', needle: 'chịu phạt giống điều 5' },
  { name: 'B9 Điều 5 lãi suất wrong-ref', needle: 'lãi suất bằng quy định tại Điều 5' },
  { name: 'B10 force-majeure semantic', needle: 'Bên tác động trở' },
  { name: 'B11 tax-clause redundancy', needle: 'Bên B thanh toán cho Bên A' },
];

const F065_CONTRACT_TEMPLATES = [
  'contract-operations.docx',
  'contract-racekit.docx',
  'contract-timing.docx',
];

/**
 * Acceptance templates verified clean by BA pre-flight audit (PRD Section 0).
 * Run F-065 forbidden-pattern guard against them anyway to defend against
 * future content drift.
 */
const F065_ACCEPTANCE_TEMPLATES = [
  'acceptance-operations.docx',
  'acceptance-racekit.docx',
  'acceptance-timing.docx',
];

const F065_ALL_TEMPLATES = [
  ...F065_CONTRACT_TEMPLATES,
  ...F065_ACCEPTANCE_TEMPLATES,
];

/**
 * 7 fixed wordings expected to appear in each of the 3 modified contract
 * templates post-F-065. Acceptance templates are NOT expected to contain
 * these (they were always clean and don't reference these articles).
 */
const F065_FIXED_WORDINGS_PER_CONTRACT: Array<{ bug: string; needle: string }> = [
  { bug: 'B3', needle: '77/2006/QH11 ngày 29/11/2006' },
  // B6 only applies to contract-operations.docx — racekit + timing pre-existed
  // with the corrected wording; handled in dedicated TC below.
  { bug: 'B7', needle: 'bị xử lý theo quy định tại Điều 8' },
  { bug: 'B8', needle: 'áp dụng theo quy định tại Điều 6' },
  { bug: 'B9', needle: 'theo quy định pháp luật hiện hành' },
  { bug: 'B10', needle: 'tạm ngừng trong thời gian xảy ra sự kiện bất khả kháng' },
  { bug: 'B11', needle: 'Mỗi Bên chịu trách nhiệm thực hiện các nghĩa vụ thuế của mình' },
];

function extractAllText(file: string): string {
  const absPath = path.join(TEMPLATES_DIR, file);
  const buf = fs.readFileSync(absPath);
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

describe('F-065 — Legal text correctness audit', () => {
  describe('TC-65-11 — All 6 templates: 0 forbidden legal-text patterns', () => {
    for (const file of F065_ALL_TEMPLATES) {
      it(`${file} — no F-065 forbidden patterns`, () => {
        const text = extractAllText(file);
        const violations: string[] = [];
        for (const { name, needle } of F065_FORBIDDEN_PATTERNS) {
          if (text.includes(needle)) {
            violations.push(`[${name}] still present: "${needle}"`);
          }
        }
        if (violations.length > 0) {
          throw new Error(
            `Forbidden F-065 patterns leaked in ${file}:\n  ${violations.join('\n  ')}`,
          );
        }
      });
    }
  });

  describe('TC-65-01 → TC-65-08 — Contract templates: fixed wordings present', () => {
    for (const file of F065_CONTRACT_TEMPLATES) {
      it(`${file} — contains all 6 cross-template fixed wordings`, () => {
        const text = extractAllText(file);
        const missing: string[] = [];
        for (const { bug, needle } of F065_FIXED_WORDINGS_PER_CONTRACT) {
          if (!text.includes(needle)) {
            missing.push(`[${bug}] missing fixed wording: "${needle}"`);
          }
        }
        if (missing.length > 0) {
          throw new Error(
            `Fixed wordings missing from ${file}:\n  ${missing.join('\n  ')}`,
          );
        }
      });
    }

    it('contract-operations.docx — Bug #6 "theo Điều 3 của Hợp đồng" present', () => {
      const text = extractAllText('contract-operations.docx');
      expect(text).toContain('theo Điều 3 của Hợp đồng');
    });
  });

  describe('TC-65-09 — Bug #12: duplicate dispute block removed from contract templates', () => {
    /**
     * Pre-fix: each contract had TWO "Tòa án" mentions:
     *   1. Primary "Tòa án nhân dân có thẩm quyền theo quy định của pháp luật"
     *      in GIẢI QUYẾT TRANH CHẤP HỢP ĐỒNG section (kept).
     *   2. Duplicate "Tòa án Nhân dân có thẩm quyền của Việt Nam" in
     *      ĐIỀU KHOẢN CHUNG section (removed by Bug #12).
     * Post-fix: exactly ONE "Tòa án" mention per contract template.
     */
    for (const file of F065_CONTRACT_TEMPLATES) {
      it(`${file} — exactly one "Tòa án" reference remains`, () => {
        const text = extractAllText(file);
        const count = (text.match(/Tòa án/g) || []).length;
        expect(count).toBe(1);
      });

      it(`${file} — primary dispute paragraph still present`, () => {
        const text = extractAllText(file);
        // The keep-block uses "Trong quá trình thực hiện Hợp đồng này, nếu
        // có bất kỳ tranh chấp" as its anchor — untouched by F-065.
        expect(text).toContain(
          'Trong quá trình thực hiện Hợp đồng này, nếu có bất kỳ tranh chấp',
        );
      });
    }
  });

  describe('TC-65-12 — Regression bridge: F-065 edits did not reintroduce F-044/F-045 leak patterns', () => {
    /**
     * Defense-in-depth: confirm F-065 wording fixes did not accidentally
     * introduce hardcoded VND amounts / contract numbers / in-words leaks
     * that F-044 + F-045 guard against. F-044/F-045 specs have their own
     * full coverage — this is a smoke check on the 3 templates we touched.
     */
    const SMOKE_LEAK_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
      { name: 'vi-VN currency (F-042)', pattern: /[0-9]{1,3}\.[0-9]{3}\.[0-9]{3}/ },
      {
        name: 'CN slash format',
        pattern: /\d{2}\.\d{2}\/\d{4}\/H[ĐD]+V?\/[A-Z\-0-9]+/,
      },
    ];

    for (const file of F065_CONTRACT_TEMPLATES) {
      it(`${file} — no hardcoded financial / contract-number leak smoke patterns`, () => {
        const text = extractAllText(file);
        for (const { name, pattern } of SMOKE_LEAK_PATTERNS) {
          const found = text.match(pattern);
          if (found) {
            throw new Error(
              `${file} — ${name} leak reintroduced: "${found[0]}"`,
            );
          }
        }
      });
    }
  });
});
