/**
 * F-024 — Comprehensive Placeholder Audit
 *
 * Mục đích:
 *   - Parse 9 template trong `backend/assets/contract-templates/`
 *   - Extract ALL `{placeholder}` patterns
 *   - Compare vs context built bởi `ContractsService.buildRenderContext`
 *   - Detect:
 *      • placeholder file dùng nhưng context KHÔNG cung cấp
 *      • context có nhưng KHÔNG file nào dùng (overkill)
 *      • hardcoded text leak còn sót (đáng nghi)
 *
 * Run: `cd backend && npx ts-node scripts/audit-template-placeholders.ts`
 */
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PizZip = require('pizzip');

const TEMPLATES_DIR = path.join(__dirname, '..', 'assets', 'contract-templates');

const ALL_TEMPLATES = [
  'contract-timing.docx',
  'contract-racekit.docx',
  'contract-operations.docx',
  'contract-ticket-sales.docx',
  'acceptance-timing.docx',
  'acceptance-racekit.docx',
  'acceptance-operations.docx',
  'payment-request.docx',
  'quotation.xlsx',
];

// Context shape (mirror keys returned by ContractsService.buildRenderContext).
// Dot-notation cho nested access (client.entityName).
const CONTEXT_KEYS = new Set<string>([
  'contractNumber',
  'contractType',
  'documentType',
  'signDate', 'signDay', 'signMonth', 'signYear',
  'effectiveDate', 'endDate',
  'provider.entityName', 'provider.taxId', 'provider.address',
  'provider.representative', 'provider.position',
  'provider.bankAccount', 'provider.bankName',
  'provider.phone', 'provider.email',
  'client.entityName', 'client.taxId', 'client.address',
  'client.representative', 'client.position',
  'client.bankAccount', 'client.bankName',
  'client.phone', 'client.email',
  'raceName', 'raceDate', 'raceLocation',
  'lineItems',
  'revenueShare.feePercentage', 'revenueShare.feePerAthlete',
  'revenueShare.estimatedAthletes', 'revenueShare.avgTicketPrice',
  'revenueShare.estimatedFee',
  'ticketFeePercent',
  'subtotal', 'vatRate', 'vatAmount', 'totalAmount', 'totalAmountInWords',
  'paymentTerms.advancePercentage', 'paymentTerms.advanceAmount',
  'paymentTerms.remainderPercentage', 'paymentTerms.remainderAmount',
  'paymentTerms.latePenaltyRate', 'paymentTerms.latePenaltyUnit',
  'paymentTerms.paymentDeadlineDays',
  'articles',
  'acceptanceReport',
  'acceptanceReport.reportDate', 'acceptanceReport.actualSubtotal',
  'acceptanceReport.actualVatAmount', 'acceptanceReport.actualTotalWithVat',
  'acceptanceReport.contractSubtotal', 'acceptanceReport.diffAmount',
  'acceptanceReport.advancePaid', 'acceptanceReport.remainingBalance',
  'acceptanceReport.verdict', 'acceptanceReport.notes',
  'acceptanceReport.actualValues',
  'paymentRequest', 'paymentRequest.requestDate', 'paymentRequest.totalAmount',
  'paymentRequest.advancePaid', 'paymentRequest.amountDue',
  'paymentRequest.amountDueInWords',
  'paymentRequest.paymentDeadline', 'paymentRequest.notes',
  'paymentRequest.requestNumber',
  'requestDay', 'requestMonth', 'requestYear',
  'generatedAt',
  // Loop-internal — luôn available bên trong {#lineItems}...{/lineItems}.
  'stt', 'description', 'descriptionEn', 'unit', 'quantity', 'unitPrice',
  'discount', 'amount', 'note', 'selected', 'actualAmount',
  // Article-loop fields
  'key', 'title', 'body', 'heading',
  // Actual-values loop fields (acceptance)
  'actualQuantity', 'actualUnitPrice',
]);

// Patterns suspicious as hardcoded leaks from sample (e.g., still present after inject).
const HARDCODED_LEAK_PATTERNS = [
  /Hành Trình Theo Chân Bác/i,
  /THÀNH AN MEDIA/i,
  /Vũ Phan Anh/i,
  /Nguyễn Bình Minh/i,
  /0110446252/,
  /0110398986/,
  /0985\s?737\s?168/,
  /TM01-22/i,
  /Hồ Gươm Plaza/i,
  /Vinhomes West Point/i,
  /11\.04\/2026\/H[ĐD]DV/i,
  /14\.04\/2026\/H[ĐD]DV/i,
  /164\.160\.000/,
];

const PLACEHOLDER_RE = /\{([#/]?[\w.\-]+)\}/g;

function extractFromXml(xml: string): { placeholders: string[]; hardcodedLeaks: string[] } {
  const placeholders: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = PLACEHOLDER_RE.exec(xml)) !== null) {
    placeholders.push(m[1]);
  }
  // strip XML tags for hardcoded leak scan (simple)
  const text = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const hardcodedLeaks: string[] = [];
  for (const pat of HARDCODED_LEAK_PATTERNS) {
    const found = text.match(pat);
    if (found) hardcodedLeaks.push(found[0]);
  }
  return { placeholders, hardcodedLeaks };
}

function auditDocx(file: string): { placeholders: Set<string>; hardcodedLeaks: Set<string> } {
  const buf = fs.readFileSync(path.join(TEMPLATES_DIR, file));
  const zip = new PizZip(buf);
  const placeholders = new Set<string>();
  const hardcodedLeaks = new Set<string>();
  const targets = Object.keys(zip.files).filter(
    (n) =>
      n === 'word/document.xml' ||
      n.startsWith('word/header') ||
      n.startsWith('word/footer'),
  );
  for (const name of targets) {
    const xml = zip.files[name].asText();
    const { placeholders: ps, hardcodedLeaks: hs } = extractFromXml(xml);
    ps.forEach((p) => placeholders.add(p));
    hs.forEach((h) => hardcodedLeaks.add(h));
  }
  return { placeholders, hardcodedLeaks };
}

function auditXlsx(file: string): { placeholders: Set<string>; hardcodedLeaks: Set<string> } {
  const buf = fs.readFileSync(path.join(TEMPLATES_DIR, file));
  const zip = new PizZip(buf);
  const placeholders = new Set<string>();
  const hardcodedLeaks = new Set<string>();
  const targets = Object.keys(zip.files).filter(
    (n) => n === 'xl/sharedStrings.xml' || n.startsWith('xl/worksheets/'),
  );
  for (const name of targets) {
    const xml = zip.files[name].asText();
    const { placeholders: ps, hardcodedLeaks: hs } = extractFromXml(xml);
    ps.forEach((p) => placeholders.add(p));
    hs.forEach((h) => hardcodedLeaks.add(h));
  }
  return { placeholders, hardcodedLeaks };
}

function main() {
  const lines: string[] = [];
  lines.push('# F-024 Placeholder Audit Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  const allUsedPlaceholders = new Set<string>();
  const perFileUsed = new Map<string, Set<string>>();
  const perFileLeaks = new Map<string, Set<string>>();

  for (const file of ALL_TEMPLATES) {
    const fullPath = path.join(TEMPLATES_DIR, file);
    if (!fs.existsSync(fullPath)) {
      lines.push(`## ${file}`);
      lines.push('');
      lines.push(`**MISSING** — file not found at ${fullPath}`);
      lines.push('');
      continue;
    }
    const { placeholders, hardcodedLeaks } = file.endsWith('.xlsx')
      ? auditXlsx(file)
      : auditDocx(file);
    perFileUsed.set(file, placeholders);
    perFileLeaks.set(file, hardcodedLeaks);
    placeholders.forEach((p) => {
      // Strip loop prefix
      const bare = p.replace(/^[#/]/, '');
      allUsedPlaceholders.add(bare);
    });
  }

  // Per-file detail
  for (const file of ALL_TEMPLATES) {
    const placeholders = perFileUsed.get(file);
    const leaks = perFileLeaks.get(file);
    lines.push(`## ${file}`);
    lines.push('');
    if (!placeholders) {
      lines.push('Missing file.');
      lines.push('');
      continue;
    }
    lines.push(`**Placeholders used (${placeholders.size}):**`);
    lines.push('');
    const sorted = Array.from(placeholders).sort();
    for (const p of sorted) {
      const bare = p.replace(/^[#/]/, '');
      const inCtx = CONTEXT_KEYS.has(bare);
      const flag = p.startsWith('#') || p.startsWith('/') ? 'LOOP' : inCtx ? 'OK' : 'MISSING';
      lines.push(`- \`{${p}}\` — ${flag}`);
    }
    lines.push('');
    if (leaks && leaks.size > 0) {
      lines.push(`**Hardcoded leaks detected (${leaks.size}):**`);
      lines.push('');
      for (const l of Array.from(leaks).sort()) {
        lines.push(`- \`${l}\``);
      }
      lines.push('');
    } else {
      lines.push('**Hardcoded leaks:** NONE ✓');
      lines.push('');
    }
  }

  // Cross-file summary
  lines.push('## Summary');
  lines.push('');
  lines.push('### Missing in context (placeholder used by file but NOT in buildRenderContext)');
  lines.push('');
  const missingInCtx = Array.from(allUsedPlaceholders)
    .filter((p) => !p.startsWith('#') && !p.startsWith('/') && !CONTEXT_KEYS.has(p))
    .sort();
  if (missingInCtx.length === 0) {
    lines.push('NONE ✓');
  } else {
    for (const p of missingInCtx) {
      const files: string[] = [];
      for (const [f, ps] of perFileUsed.entries()) {
        if (ps.has(p)) files.push(f);
      }
      lines.push(`- \`{${p}}\` — used in: ${files.join(', ')}`);
    }
  }
  lines.push('');
  lines.push('### Extra in context (context provides but NO file uses)');
  lines.push('');
  const extraInCtx = Array.from(CONTEXT_KEYS).filter((k) => !allUsedPlaceholders.has(k)).sort();
  if (extraInCtx.length === 0) {
    lines.push('NONE ✓');
  } else {
    for (const k of extraInCtx) {
      lines.push(`- \`${k}\``);
    }
  }
  lines.push('');
  lines.push('### Hardcoded leaks aggregate');
  lines.push('');
  const allLeaks = new Map<string, string[]>();
  for (const [file, leaks] of perFileLeaks.entries()) {
    for (const l of leaks) {
      if (!allLeaks.has(l)) allLeaks.set(l, []);
      allLeaks.get(l)!.push(file);
    }
  }
  if (allLeaks.size === 0) {
    lines.push('NONE ✓');
  } else {
    for (const [l, files] of Array.from(allLeaks.entries()).sort()) {
      lines.push(`- \`${l}\` — in: ${files.join(', ')}`);
    }
  }
  lines.push('');
  const out = '/tmp/F024-placeholder-audit.md';
  fs.writeFileSync(out, lines.join('\n'));
  console.log(`Audit written to ${out}`);
  console.log(`Missing in context: ${missingInCtx.length}`);
  console.log(`Extra in context: ${extraInCtx.length}`);
  console.log(`Hardcoded leaks (unique): ${allLeaks.size}`);
}

main();
