/**
 * FEATURE-065 — One-shot script to fix legal text correctness in 3 contract
 * templates. Committed for audit trail (NOT runtime code).
 *
 * Scope: 21 edits across 3 templates (operations / racekit / timing).
 *   - 7 forbidden wording patterns → fixed wording per Manager APPROVE
 *   - Bug #12 = full block delete (dispute duplicate)
 *
 * Approach: raw `pizzip` XML text replace inside `word/document.xml`. Anchors
 * have been verified against actual DOCX binaries (BA pre-flight + Coder
 * verify-only dry run). NO split-runs issue → straight `.replace()` works.
 *
 * Modes:
 *   - `--dry-run` / `--verify`: parse each template, check every applicable
 *     anchor present, report match counts. Does NOT mutate files.
 *   - default (no flag): apply edits in-place, verify post-conditions
 *     (forbidden pattern absent, fixed wording present), exit non-zero on any
 *     failure.
 *
 * Backups: `backend/assets/contract-templates/backups/legacy-pre-f065/` is
 * populated as a one-time copy before this script ever ran (Coder C1 commit).
 * Script does NOT touch the backup directory.
 *
 * Run from backend/:
 *   `npx ts-node scripts/fix-f065-templates.ts --dry-run`
 *   `npx ts-node scripts/fix-f065-templates.ts`
 *
 * Reversibility: re-copy from `backups/legacy-pre-f065/` to restore originals.
 */
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PizZip = require('pizzip');

const TEMPLATES_DIR = path.join(__dirname, '..', 'assets', 'contract-templates');
const BACKUP_DIR = path.join(TEMPLATES_DIR, 'backups', 'legacy-pre-f065');

type TemplateFile =
  | 'contract-operations.docx'
  | 'contract-racekit.docx'
  | 'contract-timing.docx';

const TEMPLATES_TO_FIX: TemplateFile[] = [
  'contract-operations.docx',
  'contract-racekit.docx',
  'contract-timing.docx',
];

interface Replacement {
  bug: string;
  find: string;
  replace: string;
  templates: TemplateFile[];
  /**
   * Optional post-fix presence check (must appear once fix applied). For empty
   * `replace` (Bug #12 delete), set to undefined.
   */
  postFixContains?: string;
}

/**
 * 7 wording fixes (Manager APPROVE — PRD Section 3.2).
 * Anchors verified against actual DOCX `word/document.xml` (BA pre-flight).
 */
const REPLACEMENTS: Replacement[] = [
  {
    bug: 'F065-B3',
    find: '77/2006/QH11) ngày 29/11/2006',
    replace: '77/2006/QH11 ngày 29/11/2006',
    templates: ['contract-operations.docx', 'contract-racekit.docx'],
    postFixContains: '77/2006/QH11 ngày 29/11/2006',
  },
  {
    bug: 'F065-B6',
    find: 'theo Điều 4 của Hợp đồng',
    replace: 'theo Điều 3 của Hợp đồng',
    templates: ['contract-operations.docx'],
    postFixContains: 'theo Điều 3 của Hợp đồng',
  },
  {
    bug: 'F065-B7',
    find: 'bị xử lý theo quy định tại Điều 7',
    replace: 'bị xử lý theo quy định tại Điều 8',
    templates: [
      'contract-operations.docx',
      'contract-racekit.docx',
      'contract-timing.docx',
    ],
    postFixContains: 'bị xử lý theo quy định tại Điều 8',
  },
  {
    bug: 'F065-B8',
    find: 'chịu phạt giống điều 5',
    replace: 'áp dụng theo quy định tại Điều 6',
    templates: [
      'contract-operations.docx',
      'contract-racekit.docx',
      'contract-timing.docx',
    ],
    postFixContains: 'áp dụng theo quy định tại Điều 6',
  },
  {
    bug: 'F065-B9',
    find: 'với lãi suất bằng quy định tại Điều 5.',
    replace: 'theo quy định pháp luật hiện hành.',
    templates: [
      'contract-operations.docx',
      'contract-racekit.docx',
      'contract-timing.docx',
    ],
    postFixContains: 'theo quy định pháp luật hiện hành.',
  },
  {
    bug: 'F065-B10',
    find: 'Sự kiện bất khả kháng tác động lên một trong hai Bên hoặc cả hai Bên thì các nghĩa vụ của Bên tác động trở sẽ bị tạm ngừng thực hiện vụ mà không bị coi là vi phạm Hợp đồng này.',
    replace:
      'Khi sự kiện bất khả kháng tác động đến một trong hai Bên hoặc cả hai Bên, việc thực hiện các nghĩa vụ bị ảnh hưởng sẽ được tạm ngừng trong thời gian xảy ra sự kiện bất khả kháng và không bị coi là vi phạm Hợp đồng này.',
    templates: [
      'contract-operations.docx',
      'contract-racekit.docx',
      'contract-timing.docx',
    ],
    postFixContains: 'tạm ngừng trong thời gian xảy ra sự kiện bất khả kháng',
  },
  {
    bug: 'F065-B11',
    find: 'Mỗi Bên chịu trách nhiệm thanh toán nghĩa vụ thuế của mỗi bên phát sinh từ giao dịch theo Hợp đồng này. Nếu có bất kỳ khoản thuế nào thuộc nghĩa vụ của Bên A mà Bên B có trách nhiệm khấu trừ và nộp hộ theo pháp luật Việt Nam thì Bên B phải tính và khấu trừ, nộp hộ cho Bên A theo đúng quy định của pháp luật. Và khoản tiền này được khấu trừ vào khoản tiền Bên B thanh toán cho Bên A.',
    replace:
      'Mỗi Bên chịu trách nhiệm thực hiện các nghĩa vụ thuế của mình phát sinh từ giao dịch theo Hợp đồng này theo quy định pháp luật. Trường hợp pháp luật quy định một Bên có nghĩa vụ khấu trừ, kê khai, nộp thay bất kỳ khoản thuế nào liên quan đến khoản thanh toán theo Hợp đồng này, Bên đó sẽ thực hiện theo đúng quy định pháp luật và thông báo cho Bên còn lại.',
    templates: [
      'contract-operations.docx',
      'contract-racekit.docx',
      'contract-timing.docx',
    ],
    postFixContains:
      'Mỗi Bên chịu trách nhiệm thực hiện các nghĩa vụ thuế của mình',
  },
  {
    bug: 'F065-B12',
    find: 'Bất kỳ tranh chấp nào phát sinh từ hoặc liên quan đến Hợp Đồng này trước tiên sẽ giải quyết thông qua thương lượng và hòa giải giữa Các Bên. Trong trường hợp giữa Các Bên có tranh chấp mà không thể giải quyết bằng thương lượng và hòa giải thì mọi tranh chấp phát sinh từ hoặc liên quan đến Hợp Đồng này sẽ được giải quyết tại Tòa án Nhân dân có thẩm quyền của Việt Nam.',
    replace: '',
    templates: [
      'contract-operations.docx',
      'contract-racekit.docx',
      'contract-timing.docx',
    ],
    // No postFixContains for delete — Bug #12 has explicit absence assertion below.
  },
];

interface VerifyResult {
  template: TemplateFile;
  ok: boolean;
  details: string[];
}

function readDocumentXml(absPath: string): { zip: any; xml: string } {
  const buf = fs.readFileSync(absPath);
  const zip = new PizZip(buf);
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) {
    throw new Error(`Missing word/document.xml in ${absPath}`);
  }
  return { zip, xml: xmlFile.asText() };
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while (true) {
    const found = haystack.indexOf(needle, idx);
    if (found === -1) break;
    count += 1;
    idx = found + needle.length;
  }
  return count;
}

/**
 * Verify-only mode (`--dry-run`). For each template, for each applicable
 * replacement, report whether the `find` anchor exists in raw XML.
 *
 * Detects 3 outcomes per anchor:
 *   - FOUND (count >= 1): straight replace will work.
 *   - SPLIT (count = 0 but text exists with tags stripped): runs split — needs
 *     manual normalization in Word/LibreOffice OR XML-aware rewrite.
 *   - NOT-FOUND: anchor genuinely absent — PRD wording does NOT match DOCX.
 */
function verifyAnchors(): VerifyResult[] {
  const results: VerifyResult[] = [];
  for (const template of TEMPLATES_TO_FIX) {
    const absPath = path.join(TEMPLATES_DIR, template);
    const { xml } = readDocumentXml(absPath);
    const stripped = xml.replace(/<[^>]+>/g, '');
    const details: string[] = [];
    let ok = true;
    for (const r of REPLACEMENTS) {
      if (!r.templates.includes(template)) continue;
      const rawCount = countOccurrences(xml, r.find);
      if (rawCount >= 1) {
        details.push(`  ✓ ${r.bug}: FOUND (raw count=${rawCount})`);
      } else if (stripped.includes(r.find)) {
        ok = false;
        details.push(
          `  ⚠ ${r.bug}: SPLIT-RUNS — anchor exists in stripped text but split across <w:t> runs`,
        );
      } else {
        ok = false;
        details.push(
          `  ✗ ${r.bug}: NOT-FOUND — anchor "${r.find.slice(0, 60)}..." absent`,
        );
      }
    }
    results.push({ template, ok, details });
  }
  return results;
}

/**
 * Default mode: apply each applicable replacement in-place, then verify
 * post-conditions per template.
 */
function applyFixes(): VerifyResult[] {
  const results: VerifyResult[] = [];
  for (const template of TEMPLATES_TO_FIX) {
    const absPath = path.join(TEMPLATES_DIR, template);
    const { zip, xml: originalXml } = readDocumentXml(absPath);
    const details: string[] = [];
    let ok = true;
    let xml = originalXml;
    const applicable = REPLACEMENTS.filter((r) => r.templates.includes(template));
    for (const r of applicable) {
      const before = countOccurrences(xml, r.find);
      if (before === 0) {
        ok = false;
        details.push(`  ✗ ${r.bug}: anchor disappeared mid-script (count=0)`);
        continue;
      }
      // Apply ALL occurrences via split-join (replace only first by default).
      // For our edits each anchor expected to appear exactly once; using
      // split-join is safe + idempotent for that case AND covers accidental
      // duplicates without leaving stale ones behind.
      xml = xml.split(r.find).join(r.replace);
      const after = countOccurrences(xml, r.find);
      const applied = before - after;
      if (after > 0) {
        ok = false;
        details.push(
          `  ✗ ${r.bug}: residual ${after} occurrence(s) after replace`,
        );
      } else {
        details.push(`  ✓ ${r.bug}: replaced ${applied} occurrence(s)`);
      }
      if (r.postFixContains && !xml.includes(r.postFixContains)) {
        ok = false;
        details.push(
          `  ✗ ${r.bug}: post-fix wording "${r.postFixContains.slice(0, 60)}..." missing`,
        );
      }
    }
    // Final guard: no forbidden anchor must remain.
    for (const r of applicable) {
      if (xml.includes(r.find)) {
        ok = false;
        details.push(`  ✗ ${r.bug}: forbidden anchor STILL present post-write`);
      }
    }
    if (ok) {
      zip.file('word/document.xml', xml);
      // DEFLATE compression matches original DOCX format (Word default). Without
      // it pizzip emits STORE (no compression) and file size balloons ~7x →
      // breaks NFR-65-1 ≤ 5% size increase.
      const out = zip.generate({
        type: 'nodebuffer',
        compression: 'DEFLATE',
      });
      fs.writeFileSync(absPath, out);
      details.push(`  ✓ ${template}: written ${out.length} bytes`);
    } else {
      details.push(`  ✗ ${template}: SKIPPED write — fix verification failed`);
    }
    results.push({ template, ok, details });
  }
  return results;
}

function ensureBackupsExist(): void {
  for (const tmpl of TEMPLATES_TO_FIX) {
    const bak = path.join(BACKUP_DIR, tmpl);
    if (!fs.existsSync(bak)) {
      throw new Error(
        `Missing backup ${bak} — refuse to proceed. Re-run backup copy step from Coder C1.`,
      );
    }
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('--verify');

  console.log('--- FEATURE-065 fix-templates ---');
  console.log(`Templates dir: ${TEMPLATES_DIR}`);
  console.log(`Mode: ${dryRun ? 'VERIFY-ONLY (dry-run)' : 'APPLY-FIXES'}`);

  ensureBackupsExist();
  console.log(`Backups present: ✓ ${BACKUP_DIR}`);

  const results = dryRun ? verifyAnchors() : applyFixes();

  let failedCount = 0;
  for (const r of results) {
    console.log(`\n[${r.template}] ${r.ok ? '✓ OK' : '✗ FAILED'}`);
    for (const d of r.details) console.log(d);
    if (!r.ok) failedCount += 1;
  }

  if (failedCount > 0) {
    console.error(
      `\n✗ ${failedCount}/${results.length} template(s) FAILED. Exit non-zero.`,
    );
    process.exit(1);
  }
  console.log(
    `\n✓ All ${results.length} templates ${dryRun ? 'verified' : 'fixed'}.`,
  );
}

main();
