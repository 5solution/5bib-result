# FEATURE-065: Manager Plan Review

**Reviewed:** 2026-05-25
**Reviewer:** 5bib-manager
**Verdict:** ✅ **APPROVED** (scope narrowed sau pre-flight audit)
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check (Manager)

- [x] Đọc `00-manager-init.md` (5 PAUSE locked + Danny "Theo Manager đề xuất tất cả")
- [x] Đọc `01-ba-prd.md` (11 sections, 770 lines, 11 bugs + 15 TC)
- [x] Verify BA pre-flight audit findings:
  - ✅ `acceptance-operations.docx`: 0 bugs
  - ✅ `acceptance-racekit.docx`: 0 bugs
  - ✅ `acceptance-timing.docx`: 0 bugs
  - ✅ `contract-ticket-sales.docx`: 0 bugs (out scope)
  - ⚠️ `contract-timing.docx` KHÔNG có Bug #3 → 1 fewer edit
  
→ **Final scope: 21 text edits (giảm từ 22) across 3 contract templates only.**

---

## ✓ PRD Validation Checklist

12/12 items PASS. PRD comprehensive với 11 sections + 15 TC + 8 risks identified.

---

## 📋 Scope Lock (DỨT KHOÁT)

### ✏️ MODIFY (3 DOCX templates)

| # | File | Bugs to fix | Edits count |
|---|------|-------------|-------------|
| 1 | `backend/assets/contract-templates/contract-operations.docx` | #3, #6, #7, #8, #9, #10, #11, #12 | 8 edits |
| 2 | `backend/assets/contract-templates/contract-racekit.docx` | #3, #7, #8, #9, #10, #11, #12 | 7 edits |
| 3 | `backend/assets/contract-templates/contract-timing.docx` | #7, #8, #9, #10, #11, #12 | 6 edits |

### 🆕 NEW (3 files)

| # | File | Mục đích | LoC |
|---|------|----------|-----|
| 4 | `backend/scripts/fix-f065-templates.ts` | One-shot script dùng pizzip raw text replace XML | ~250 |
| 5 | `backend/src/modules/contracts/services/audit-script.f065.spec.ts` | Test verify 7 forbidden patterns = 0 match (REUSE F-044/F-045/F-064 pattern) | ~200 |
| 6 | `backend/assets/contract-templates/backups/legacy-pre-f065/` | Backup directory (3 files copied trước khi edit) | N/A (binary copy) |

**Tổng:** 3 NEW + 3 MODIFY = **6 deliverables** (~450 LoC + 3 binary DOCX edits + 3 backups).

**KHÔNG được đụng:**
- ❌ `acceptance-*.docx` (pre-flight verified clean)
- ❌ `contract-ticket-sales.docx` (clean)
- ❌ F-044/F-045/F-064 audit scripts (REUSE only)
- ❌ Backend service code (text-only fix)
- ❌ Historical contracts data (forward-only)

---

## 🔧 Tech Approach

### 1. Backup-first strategy

```typescript
// backend/scripts/fix-f065-templates.ts
import * as fs from 'fs';
import * as path from 'path';

const TEMPLATES_DIR = path.join(__dirname, '..', 'assets', 'contract-templates');
const BACKUP_DIR = path.join(TEMPLATES_DIR, 'backups', 'legacy-pre-f065');

const TEMPLATES_TO_FIX = ['contract-operations.docx', 'contract-racekit.docx', 'contract-timing.docx'];

// Step 1: Backup
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
for (const tmpl of TEMPLATES_TO_FIX) {
  fs.copyFileSync(
    path.join(TEMPLATES_DIR, tmpl),
    path.join(BACKUP_DIR, `${tmpl.replace('.docx', '')}-pre-f065.docx`),
  );
}
```

### 2. Replacement table (7 forbidden patterns × wording)

```typescript
const REPLACEMENTS = [
  { 
    bug: '#3',
    find: '77/2006/QH11)',
    replace: '77/2006/QH11',
    templates: ['contract-operations.docx', 'contract-racekit.docx'],
  },
  {
    bug: '#6',
    find: 'theo Điều 4 của Hợp đồng',
    replace: 'theo Điều 3 của Hợp đồng',
    templates: ['contract-operations.docx'],
  },
  {
    bug: '#7',
    find: 'sẽ bị xử lý theo quy định tại Điều 7',
    replace: 'sẽ bị xử lý theo quy định tại Điều 8',
    templates: ['contract-operations.docx', 'contract-racekit.docx', 'contract-timing.docx'],
  },
  {
    bug: '#8',
    find: '(Trừ trường hợp đơn phương chấm dứt hợp đồng thì chịu phạt giống điều 5)',
    replace: '(Trừ trường hợp đơn phương chấm dứt hợp đồng thì áp dụng theo quy định tại Điều 6)',
    templates: ['contract-operations.docx', 'contract-racekit.docx', 'contract-timing.docx'],
  },
  {
    bug: '#9',
    find: 'lãi suất bằng quy định tại Điều 5',
    replace: 'lãi suất chậm trả theo quy định pháp luật hiện hành',
    templates: ['contract-operations.docx', 'contract-racekit.docx', 'contract-timing.docx'],
  },
  {
    bug: '#10',
    find: 'các nghĩa vụ của Bên tác động trở sẽ bị tạm ngừng thực hiện vụ',
    replace: 'việc thực hiện các nghĩa vụ bị ảnh hưởng sẽ được tạm ngừng trong thời gian xảy ra sự kiện bất khả kháng',
    templates: ['contract-operations.docx', 'contract-racekit.docx', 'contract-timing.docx'],
  },
  {
    bug: '#11',
    find: 'Và khoản tiền này được khấu trừ vào khoản tiền Bên B thanh toán cho Bên A',
    replace: 'Trường hợp pháp luật quy định một Bên có nghĩa vụ khấu trừ, kê khai, nộp thay bất kỳ khoản thuế nào liên quan đến khoản thanh toán theo Hợp đồng này, Bên đó sẽ thực hiện theo đúng quy định pháp luật và thông báo cho Bên còn lại',
    templates: ['contract-operations.docx', 'contract-racekit.docx', 'contract-timing.docx'],
  },
  // Bug #12: delete Điều 11.5 paragraph entirely — complex, handle separately
];
```

### 3. Text-split-across-runs MITIGATION (Risk #1 BA flag)

```typescript
// Verify anchor match trước script chạy real edit
import PizZip = require('pizzip');

async function verifyAnchorsExist(tmplPath: string, replacements: typeof REPLACEMENTS): Promise<string[]> {
  const buf = fs.readFileSync(tmplPath);
  const zip = new PizZip(buf);
  const xml = zip.file('word/document.xml').asText();
  const failed: string[] = [];
  for (const r of replacements) {
    if (r.templates.includes(path.basename(tmplPath))) {
      // Check raw XML — may have <w:t> split
      if (!xml.includes(r.find)) {
        // Try strip-tag fuzzy match
        const stripText = xml.replace(/<[^>]+>/g, '');
        if (stripText.includes(r.find)) {
          failed.push(`SPLIT-RUNS bug ${r.bug}: text exists but split across <w:t> runs — manual edit needed`);
        } else {
          failed.push(`NOT-FOUND bug ${r.bug}: anchor "${r.find.slice(0,50)}..." không tìm thấy`);
        }
      }
    }
  }
  return failed;
}
```

→ Coder MUST run verify-only mode TRƯỚC khi commit edit. Nếu split-runs detected → manual fix in Word/LibreOffice.

### 4. Audit test (REUSE F-064 pattern)

```typescript
// audit-script.f065.spec.ts
const FORBIDDEN_F065 = [
  'QH11)',
  'theo Điều 4 của Hợp đồng',
  'quy định tại Điều 7',  // Bug #7
  'chịu phạt giống điều 5',
  'lãi suất bằng quy định tại Điều 5',
  'Bên tác động trở',
  'Bên B thanh toán cho Bên A',
];

for (const template of ['contract-operations', 'contract-racekit', 'contract-timing']) {
  it(`Template ${template}: 0 F-065 forbidden patterns`, async () => {
    const buffer = await renderDocx(`${template}.docx`, mockSafeContext);
    const text = extractTextFromDocx(buffer);
    for (const f of FORBIDDEN_F065) {
      expect(text).not.toContain(f);
    }
  });
}
```

### 5. Bug #12 — Delete Điều 11.5 (separate handling)

Search paragraph chứa Điều 11.5 → identify w:p element → remove entire w:p tag from word/document.xml. Risk: paragraph numbering subsequent có thể shift. Mitigation: verify rendered DOCX numbering vẫn đúng (manual check).

---

## 🛑 PAUSE Coder

- 🛑 **MANDATORY**: Run `fix-f065-templates.ts --dry-run` (verify-only mode) TRƯỚC khi commit. Paste output verify all anchors found
- 🛑 **MANDATORY**: Verify Word + LibreOffice mở rendered DOCX no error/warning (format intact)
- 🛑 **MANDATORY**: F-044/F-045/F-064 audit tests vẫn PASS 100% post-edit
- 🛑 **Bug #12 Điều 11.5 delete** — Verify paragraph numbering, render output xem Điều 11.5 → Điều 11.4 còn lại đúng order

---

## 🧪 Unit test bắt buộc

15 TC-65-01..15 từ PRD. Critical:
- Per bug per template render verify
- Audit script 0 match
- F-044/F-045/F-064 regression PASS
- Performance render ≤5s
- Format preservation (no style break)

---

## ⚠️ Manager Risk Notes

### TD-F065-TEXT-SPLIT-RUNS (MED — possible)

DOCX có thể split text across multiple `<w:t>` runs (cùng paragraph, different formatting). Raw string replace FAIL nếu anchor split. Mitigation: verify-only dry run + fallback manual Word/LibreOffice edit cho cases fail.

### TD-F065-PARAGRAPH-NUMBERING (LOW — Bug #12)

Delete Điều 11.5 có thể shift numbering. Mitigation: manual verify rendered output.

---

## ✅ Sẵn sàng cho `/5bib-code`

**Manager verdict:** ✅ **APPROVED — Coder bắt đầu.**

### Branch strategy

- F-065 base `origin/main` (v1.9.6)
- Independent của F-064/F-066/F-067 (different files)
- Cut release/v1.10.0 sau khi 4 features F-064/F-065/F-066/F-067 đều ship (bundle major release Q2 2026 contract revamp)

**Estimate:** 2 ngày dev + 1 QC + 0.5 deploy = **~3-4 ngày**.
