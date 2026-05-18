# FEATURE-042: Plan Review — Contract DOCX + BBNT Financial Bug Fix

**Status:** ✅ APPROVED (với 2 minor adjustments mandatory cho Coder)
**Reviewed:** 2026-05-18
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check (Manager)

- [x] Đã đọc `00-manager-init.md` đầy đủ (4 hypotheses + 7 PAUSE-42-* + investigation order)
- [x] Đã đọc `01-ba-prd.md` đầy đủ (15 BR-42-* + Template Mapping Tables A-F + 12 TC-42-XX + 7 E2E + 7 PAUSE answers)
- [x] Đã đọc memory: `architecture.md` (Order/Contract domain), `conventions.md` (DOCX gen patterns), `known-issues.md` (F-024 + F-035 + F-037 precedents)
- [x] **Đã spot-check code thật (MANDATORY per skill update 2026-05-17) — 4 critical files:**
  - `document-generator.service.ts:413-435 sanitizeContext()` — verified RECURSES nested objects
  - `document-generator.service.ts:445-448 formatNumber()` — verified `Intl.NumberFormat('vi-VN')` ✅ auto-satisfies BR-42-05
  - `contract-template.service.ts:47 BACKUP_DIRNAME = '.backup'` — existing F-024 pattern
  - `contracts.service.ts:1208 buildRenderContext()` — takes docType param, articles read from template override
- [x] **Đã verify BA investigation findings independently:**
  - Re-extracted 7 DOCX templates → 19 hardcoded numeric strings confirmed across 6 templates
  - payment-request.docx clean confirmed

---

## ✓ PRD Validation Checklist

### Completeness — ✅ PASS
- [x] User Stories đầy đủ với 5 Personas (Sales Admin Hằng / Finance Admin Hiền / Race Organizer merchant / Back-Office Admin / CFO)
- [x] 15 Business Rules có ID (BR-42-01..15) — testable, financial accuracy rules concrete
- [x] Tất cả 7 PAUSE-42-* Manager đã được BA trả lời (Root cause classified Hypothesis 2 confirmed)
- [x] Template Placeholder Mapping Tables A-D explicit, E+F TBD acceptable (Coder document.xml extract step documented)

### Technical correctness vs codebase — ✅ PASS với 1 deviation note
- [x] Logic computation (`calcTotals`, `upsertAcceptanceReport`) verified ĐÚNG — KHÔNG đụng
- [x] `buildRenderContext()` flatten approach feasible — extends existing structure, backward compat OK
- [x] No DB schema change, no Mongoose model change
- [x] No new endpoint — reuse existing `POST /api/contracts/:id/generate-document`
- [x] No SDK regen needed — DTO unchanged
- [⚠️] **BA proposed backup dir `backend/assets/contract-templates/backup/2026-05-18-pre-f042/` — DEVIATES from existing `BACKUP_DIRNAME = '.backup'` pattern (line 47).** Adjustment #1 below.

### Security — ✅ PASS
- [x] Endpoint `POST /api/contracts/:id/generate-document` existing `@UseGuards(LogtoStaffGuard)` preserved
- [x] No new auth surface
- [x] Audit script + regenerate script direct DB access — proper env config (BR-42-13)
- [x] Audit log emit BR-42-13 preserves traceability of regenerate activity

### Performance — ✅ PASS
- [x] SLA cụ thể (p95 < 30s DOCX gen, <5 phút audit, <1 hour regen 100 contracts)
- [x] Sequential regenerate (no Promise.all) prevents S3 rate limit (BR-42-15)
- [x] 200ms sleep between batch ops

### Testability — ✅ PASS với 1 gap
- [x] 12 TC-42-XX backend tests cover 3 contract types × happy + complex + edge
- [x] 7 E2E-42-XX Playwright cases
- [x] Real-world data 6/6 items (VN long names + 1B+ money + 1000+ qty)
- [⚠️] **DOCX content extraction in test assertions** — TC-42-01..07 require parsing DOCX to verify "25.870.000" present + hardcoded values absent. BA doesn't specify HOW Coder extracts text. Adjustment #2 below.

---

## 📊 Cross-check với memory

### Architecture impact
- ✅ ZERO architecture change. F-042 thuần BUGFIX template binary files + minor service layer flatten.
- KHÔNG có service/integration mới
- KHÔNG đụng MongoDB schema, Redis keys, S3 prefix patterns
- DOCX gen flow `buildRenderContext → renderDocx → renderBoth (PDF) → uploadToS3` unchanged

### Convention impact
- ✅ Reaffirm existing convention `formatNumber()` Intl.NumberFormat vi-VN
- ✅ Reaffirm `sanitizeContext()` recursive object pattern (BA's flatten = defense-in-depth, NOT new pattern)
- ⚠️ **Adjustment #1 enforces existing `BACKUP_DIRNAME = '.backup'` pattern** — không tạo new directory convention
- **NEW pattern** post-deploy: "Audit + Regenerate scripts cho data fix" — sẽ append vào conventions.md post-deploy nếu pattern reusable

### Known issues impact
- 🔴 F-024 HIGH-CON-01 find-then-save 11 callsites — **NOT this bug** (data layer OK). F-042 KHÔNG resolve nhưng KHÔNG aggravate.
- 🟡 F-035 cost field drop triple-quên — similar mapping precedent, applied lesson via Mapping Tables A-F
- 🟡 F-037 DOCX colspan precedent — applied lesson via multi-viewer verify in BA's risk acknowledgments

---

## 🚨 Critical Adjustments — Coder PHẢI follow

### Adjustment #1 (MANDATORY): Use existing `.backup/` directory pattern

> BA proposed `backend/assets/contract-templates/backup/2026-05-18-pre-f042/` — deviates from existing F-024 BACKUP_DIRNAME pattern.

**Coder PHẢI:**
- Use existing `contract-template.service.ts:234 getBackupDir()` helper → returns `backend/assets/contract-templates/.backup/`
- Backup file naming pattern: `<type>-<timestamp>-pre-f042.docx` (vd: `contract-timing-20260518-pre-f042.docx`)
- Existing `uploadTemplate()` method (line 303) ĐÃ có backup-before-replace logic — Coder MAY call this method programmatically OR replicate pattern in fix script
- **Reason:** Consistent với existing infra. Future template uploads via admin UI sẽ use same `.backup/` directory — F-042 backups co-located.

**Update BR-42 implicit:** Backup pattern `<existing .backup/> + <type>-<timestamp>-pre-f042.docx`.

### Adjustment #2 (MANDATORY): DOCX text extraction test helper

> TC-42-01..07 assertions need to parse DOCX content. BA doesn't specify extraction methodology.

**Coder PHẢI:**
- Create helper `backend/test/helpers/docx-text-extract.ts` (NEW file):
  ```typescript
  import * as JSZip from 'jszip';
  // Returns full text content of DOCX (word/document.xml stripped of XML tags)
  export async function extractDocxText(buffer: Buffer): Promise<string> {
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file('word/document.xml')!.async('string');
    return docXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  ```
- TC-42-01..07 assertion pattern: `expect(extractDocxText(docx)).toContain('25.870.000')` + `expect(...).not.toContain('152.000.000')`
- Existing `jszip` already in `backend/node_modules` (used by docxtemplater + pizzip). No `pnpm install` needed.

**Update BR-42 implicit:** Test infrastructure helper for DOCX content assertions.

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ được thay đổi các file/folder dưới đây. Đụng ngoài = scope creep.

### Backend (`backend/src/modules/contracts/`)

**MODIFY (1 file):**
- ✏️ `services/contracts.service.ts:1210-1290 buildRenderContext()` — flatten `acceptanceReport.*` to top-level keys (~30 LoC addition per BA's proposal). Add `actualSubtotal/actualVatAmount/actualTotalWithVat/contractSubtotal/diffAmount/advancePaid/remainingBalance/actualTotalWithVatInWords/reportDay/reportMonth/reportYear` keys.

**EDIT BINARY (6 DOCX files):**
- ✏️ `backend/assets/contract-templates/contract-timing.docx` — replace 2 hardcoded values per Mapping Table A
- ✏️ `backend/assets/contract-templates/contract-racekit.docx` — replace 1 hardcoded value per Mapping Table B
- ✏️ `backend/assets/contract-templates/contract-operations.docx` — replace 1 hardcoded value per Mapping Table C
- ✏️ `backend/assets/contract-templates/acceptance-timing.docx` — replace 5 hardcoded values per Mapping Table D
- ✏️ `backend/assets/contract-templates/acceptance-racekit.docx` — replace 4 hardcoded values + ADD missing `{totalAmount}` placeholder per Mapping Table E (Coder extract document.xml first to map positions)
- ✏️ `backend/assets/contract-templates/acceptance-operations.docx` — replace 6 hardcoded values per Mapping Table F (Coder extract document.xml first)

**ADD (6 NEW files):**
- ➕ `backend/scripts/audit-contract-docx-templates.ts` — audit script per BR-42-11
- ➕ `backend/scripts/regenerate-affected-contracts.ts` — regenerate batch script per BR-42-12..15
- ➕ `backend/test/helpers/docx-text-extract.ts` — DOCX text extraction helper (Adjustment #2)
- ➕ `backend/src/modules/contracts/services/document-generator.service.f042.spec.ts` — NEW test file với TC-42-01..07 (separate spec để KHÔNG conflict với existing `document-generator.service.spec.ts`)
- ➕ `backend/src/modules/contracts/services/contracts.service.f042-context.spec.ts` — NEW test file unit tests cho `buildRenderContext()` flatten verification (TC-42-08..09)
- ➕ `backend/assets/contract-templates/.backup/<type>-20260518-pre-f042.docx` × 6 (automatic via uploadTemplate flow OR manual cp by Coder)

**MODIFY existing tests (1 file, justified):**
- ✏️ `backend/src/modules/contracts/services/document-generator.service.spec.ts` — may need add 1-2 regression cases ensuring sanitizeContext flatten doesn't break existing TIMING/QUOTATION render

**ABSOLUTELY OUT OF SCOPE — KHÔNG được đụng:**
- ❌ `contracts.service.ts:calcTotals()` line 243 (data layer verified ĐÚNG)
- ❌ `contracts.service.ts:upsertAcceptanceReport()` line 1064 (logic ĐÚNG)
- ❌ `contracts.service.ts:calcPaymentTerms()` line 284 (logic ĐÚNG)
- ❌ `document-generator.service.ts:formatNumber()` line 445 (Intl.NumberFormat vi-VN OK)
- ❌ `document-generator.service.ts:sanitizeContext()` line 413 (recursion OK)
- ❌ Schema files (`contract.schema.ts`)
- ❌ Admin UI (verified correct, no change needed)
- ❌ `payment-request.docx` (clean per audit)
- ❌ Any frontend file

**Estimated total: 7 modify files (6 templates + 1 service) + 6 NEW files = 13 files**

---

## 🔧 Tech approach (đề xuất, Coder có thể tinh chỉnh)

### Template editing methodology

1. **Coder extract each template document.xml first** — use `unzip -p .docx word/document.xml > /tmp/<type>.xml` to identify exact text labels preceding hardcoded numbers
2. **Map each hardcoded → placeholder** per Mapping Tables A-F (Tables E + F require Coder semantic mapping based on label context)
3. **Edit via LibreOffice** (KHÔNG MS Word — F-037 lesson re: formatting drift):
   - Open `.docx` in LibreOffice
   - Find/Replace specific numeric strings → `{placeholder}` syntax
   - Save as `.docx` (preserve original formatting)
4. **Verify post-edit:**
   ```bash
   unzip -p backend/assets/contract-templates/<file>.docx word/document.xml | grep -oE '\{[^}]+\}' | sort -u
   ```
   Must show NEW placeholders + KHÔNG còn match `[0-9]{1,3}\.[0-9]{3}\.[0-9]{3}` pattern trong tài chính sections.
5. **Multi-viewer visual check** (F-037 lesson):
   - Open edited DOCX trong MS Word
   - Open trong LibreOffice
   - Open trong Google Docs viewer
   - Verify table layouts + colspans + tblLayout preserved

### Backend code change

`buildRenderContext()` flatten — minimal, defense-in-depth (since `sanitizeContext()` recurses):

```typescript
// After existing `acceptanceReport: contract.acceptanceReport ?? null,` line ~1265
// F-042: flatten for docxtemplater simple substitution (Coder may keep or
// rely on sanitizeContext recursion — verify TC-42 tests pass either way)
...(contract.acceptanceReport
  ? {
      actualSubtotal: contract.acceptanceReport.actualSubtotal,
      actualVatAmount: contract.acceptanceReport.actualVatAmount,
      actualTotalWithVat: contract.acceptanceReport.actualTotalWithVat,
      contractSubtotal: contract.acceptanceReport.contractSubtotal,
      diffAmount: contract.acceptanceReport.diffAmount,
      advancePaid: contract.acceptanceReport.advancePaid,
      remainingBalance: contract.acceptanceReport.remainingBalance,
      actualTotalWithVatInWords: vndAmountInWords(
        contract.acceptanceReport.actualTotalWithVat,
      ),
      reportDay: /* ... */,
      reportMonth: /* ... */,
      reportYear: /* ... */,
    }
  : {}),
```

**Note:** Since `sanitizeContext()` already recurses nested objects, docxtemplater CAN access `{acceptanceReport.actualSubtotal}`. BA's flatten is BELT-AND-SUSPENDERS approach making templates simpler to write (`{actualSubtotal}` vs `{acceptanceReport.actualSubtotal}`). Coder may decide based on template structure post-edit.

### Audit + Regenerate scripts

- Audit: Direct MongoDB connection via existing env config (`pnpm --filter backend ts-node scripts/...`). Output `audit-f042-report.json`.
- Regenerate: Sequential (no Promise.all) per BR-42-15. Reuse existing `ContractsService.generateDocument()` — KHÔNG re-implement logic.
- **Coder add safeguard NOT in BA PRD:** When regenerating contract có `paymentRequest.status === 'PAID'`, log WARN + emit special audit event `contract.regenerateDocument.f042-fix.paidContract` để Finance team aware. Do NOT block regen (regenerate of CONTRACT/ACCEPTANCE_REPORT doesn't invalidate paid payment — they're separate documents).

---

## 🛑 PAUSE points cho Coder

Trước khi làm các bước sau, Coder DỪNG và confirm với Danny:

- 🛑 **Trước khi RUN audit script trên PROD MongoDB** — Coder báo Danny + confirm DB access OK
- 🛑 **Trước khi RUN regenerate batch trên PROD** — Need explicit Danny approval (DỪ NG nếu script affects >50 contracts). Danny + Finance team sign-off required (BR-42-13 audit log permanent record).
- 🛑 **Nếu phát hiện scope creep cần đụng file ngoài Scope Lock** — phải hỏi Manager update plan
- 🛑 **Nếu Mapping Tables E + F semantic mapping unclear sau extract document.xml** — Coder DỪNG, propose specific replacements, Manager review trước commit
- 🛑 **Nếu `unzip` extract DOCX có XML namespace conflicts khi parse** — F-037 precedent: use exact same toolchain (docxtemplater + pizzip) for verification

---

## 🧪 Unit test BẮT BUỘC

Coder không được mark feature `READY_FOR_QC` nếu thiếu các test sau:

### `document-generator.service.f042.spec.ts` (NEW)
- [ ] TC-42-01: Contract DOCX gen TIMING happy path — `extractDocxText()` contains "25.870.000" + "2.069.600" + "27.939.600"; NOT contains "152.000.000" + "12.160.000"
- [ ] TC-42-02: BBNT DOCX gen TIMING happy path — same approach, 5 correct + 5 incorrect numbers
- [ ] TC-42-03: Contract DOCX RACEKIT — NOT contains "36.180.000"
- [ ] TC-42-04: Contract DOCX OPERATIONS — NOT contains "264.888.360"
- [ ] TC-42-05: BBNT RACEKIT — NOT contains "18.090.000", "2.680.000", "33.500.000", "36.180.000"
- [ ] TC-42-06: BBNT OPERATIONS — NOT contains 6 hardcoded values
- [ ] TC-42-07: Complex multi-line-item (mirror real contract `6a095ceae7c717e8fc1c2c0e`)
- [ ] TC-42-08: Edge case zero discount
- [ ] TC-42-09: Edge case 1B+ VND format vi-VN

### `contracts.service.f042-context.spec.ts` (NEW)
- [ ] Test `buildRenderContext()` returns flattened keys `actualSubtotal/actualVatAmount/actualTotalWithVat/advancePaid/remainingBalance` when contract has acceptanceReport
- [ ] Test `buildRenderContext()` returns no flattened keys when acceptanceReport null
- [ ] Test flatten doesn't break existing nested `acceptanceReport` object

### Audit + Regenerate script tests
- [ ] TC-42-10: Audit script — produces valid JSON report, NO DB mutation
- [ ] TC-42-11: Regenerate dry-run — list contracts WITHOUT modify DB
- [ ] TC-42-12: Regenerate single contract — version++ in `generatedDocuments[]`, audit log emit

**Total: 12 unit tests + 3 context spec tests = 15 NEW tests**

---

## 🆕 Patterns sẽ mint vào `conventions.md` post-deploy

1. **"DOCX template hardcoded value bug pattern"** — Anti-pattern: copy sample DOCX with hardcoded numbers + forget to replace với placeholders. Prevention: post-edit grep `[0-9]{1,3}\.[0-9]{3}\.[0-9]{3}` in financial sections must be empty.

2. **"DOCX content extraction test helper"** — `backend/test/helpers/docx-text-extract.ts` reusable for any future DOCX content assertion (reconciliation DOCX F-030, etc.)

3. **"Audit + Regenerate scripts pattern"** (if reusable beyond F-042) — Scripts directly access MongoDB via env config, sequential processing với sleep + audit log emit. Idempotent (version++, no overwrite).

4. **"Template backup naming convention"** — `<type>-<timestamp>-<feature-id>.docx` in existing `.backup/` directory.

---

## 🧷 Tech debt to track post-deploy (Manager note)

> Sau deploy, append vào `known-issues.md`:

- **TD-F042-COMM-STRATEGY-PHASE2** (HIGH business priority) — Danny + Finance team chốt strategy re-send DOCX cho merchants đã nhận wrong files. Manager flag NOW: cần decision trong 1 tuần post-deploy (legal exposure window).
- **TD-F042-MS-WORD-VISUAL-DRIFT** (LOW) — Per F-037 lesson, LibreOffice-saved DOCX MAY render slightly differently in MS Word. Coder verify post-edit multi-viewer.
- **TD-F042-RACEKIT-OPS-MAPPING-CODER-DECISION** — Tables E + F semantic mapping Coder làm. Document final replacements in 03-coder-implementation.md cho audit trail.
- **TD-F042-PAID-CONTRACT-REGEN-AUDIT** — Manager Adjustment safeguard for `paymentRequest.status === 'PAID'` contracts during regenerate batch — special audit event.
- **TD-F042-REGEN-SCRIPT-CROSS-FEATURE-REUSE** — If audit + regen scripts pattern proves reusable, extract to shared `backend/scripts/lib/audit-regen-base.ts` Phase 2.

---

## 📊 Verdict

> ### ✅ APPROVED — Coder có thể bắt đầu với 2 Critical Adjustments mandatory

**Lý do APPROVE:**
- Root cause classified definitively (Hypothesis 2) — BA investigation thorough
- 15 BR-42-* testable + 12 TC-42-XX + 7 E2E concrete
- 7 PAUSE-42-* all answered
- ZERO breaking change — backward compat preserved
- Backend code change minimal (~30 LoC flatten + 2 scripts)
- Rollback safe (revert template files, no DB migration)
- Real-world data verification 6/6 items
- Spot-check confirmed `sanitizeContext` + `formatNumber` already handle vi-VN auto

**Coder PHẢI follow:**
- Critical Adjustment #1: Use existing `.backup/` BACKUP_DIRNAME pattern (not new directory)
- Critical Adjustment #2: Create `extractDocxText()` test helper in `backend/test/helpers/`
- Scope Lock 13 files list above
- 5 PAUSE points trước thực hiện (especially: PROD regen batch + Mapping Tables E+F semantic)
- 15 unit tests minimum (12 TC-42 + 3 context spec)
- Safeguard for paymentRequest PAID contracts trong regen script

**Lý do KHÔNG NEEDS_REVISION:**
- 2 adjustments là minor (pattern reuse + test helper) — KHÔNG fundamental gap in PRD
- BA's flatten approach over-engineered nhưng acceptable (defense-in-depth)
- Tables E + F TBD is mechanical (Coder document.xml extract) — không cần re-PRD
- Communication strategy PAUSE-42-04 defer Phase 2 OK — Phase 1 fix code first đúng priority

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] **Yes** — Coder có thể bắt đầu với Scope Lock + Critical Adjustments #1, #2 + 5 PAUSE points
- 📝 **Note cho Coder:** Self-Review Pipeline 10 bước (Manager 2026-05-14 directive) MANDATORY trước khi mark `READY_FOR_QC`. Đặc biệt:
  - Bước 4 hand-pick mapping audit — N/A (no schema field added)
  - Bước 5 PROD-readiness smoke — start backend local + verify endpoint `POST /api/contracts/test-id/generate-document` returns 200 với fixture contract
  - Bước 6 UI/UX self-inspection — N/A (no UI changes)
  - Bước 7 Real-world data — TC-42-07 already covers real contract case
  - **Bước 8 Files Changed vs Scope Lock** — 0 scope creep, especially KHÔNG đụng `calcTotals/upsertAcceptanceReport/formatNumber/sanitizeContext` (verified correct)

---

## 🔗 Next step

Danny chạy: `/5bib-code FEATURE-042-contract-docx-financial-bug-fix`

Coder (5bib-fullstack-engineer) sẽ:
1. Đọc 00 + 01 + 02 (this file) + memory conventions/codebase-map
2. **Step 1:** Extract document.xml for `acceptance-racekit.docx` + `acceptance-operations.docx` → fill out Tables E + F semantic mapping with Manager review
3. **Step 2:** Edit 6 DOCX templates via LibreOffice + verify post-edit (grep audit)
4. **Step 3:** Implement `buildRenderContext()` flatten + audit + regenerate scripts + extractDocxText helper
5. **Step 4:** Write 15 unit tests TC-42-01..12 + 3 context spec
6. **Step 5:** Multi-viewer visual verify (MS Word + LibreOffice + Google Docs)
7. **Step 6:** Self-Review Pipeline 10 bước + paste checklist vào `03-coder-implementation.md`
8. Output `03-coder-implementation.md` status `🟠 READY_FOR_QC`

**Estimated Coder workload:** ~4-6 hours
- ~30 min: Extract document.xml for 6 templates + fill Tables E + F semantic mapping
- ~1h: Edit 6 DOCX templates (LibreOffice find-replace) + grep audit verify
- ~30 min: Backend `buildRenderContext()` flatten (~30 LoC) + sanity test
- ~1h: Audit + regenerate scripts với CLI args + dry-run mode + audit log
- ~30 min: Create `extractDocxText()` test helper
- ~1.5h: Write 15 unit tests
- ~30 min: Multi-viewer visual verify (3 viewers × 6 templates = 18 spot-checks)
- ~30 min: Self-Review Pipeline + documentation 03-coder-implementation.md

**Manager checkpoint sau Coder hand-off:** Verify Scope Lock compliance (13 files match plan) + 2 Critical Adjustments implemented + Tables E+F mapping correctness + grep audit confirms NO `[0-9]{1,3}\.[0-9]{3}\.[0-9]{3}` patterns remaining in financial sections of edited templates.
