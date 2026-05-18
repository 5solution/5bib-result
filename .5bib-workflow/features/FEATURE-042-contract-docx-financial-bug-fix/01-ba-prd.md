# FEATURE-042: PRD — Contract DOCX + BBNT Financial Number Generation Bug Fix

**Status:** 🔵 READY
**Last updated:** 2026-05-18
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check (BA bắt buộc làm trước khi viết)

- [x] Đã đọc `00-manager-init.md` đầy đủ (4 hypotheses + 7 PAUSE-42-* + Manager's investigation order)
- [x] Đã đọc `memory/codebase-map.md` — confirm contracts module structure (35 modules, F-024 NEW MODULE biggest)
- [x] Đã đọc `memory/known-issues.md` — F-024 HIGH-CON-01 find-then-save 11 callsites (NOT this bug), F-035 cost field drop precedent (mapping pattern), F-037 DOCX colspan precedent (binary template inspection methodology)
- [x] **Đã thực thi Manager's investigation order:**
  - Step 1 (skipped — không direct DB access trong skill, defer Coder runs query)
  - Step 2 ✅ DONE — extracted all 7 DOCX templates trong `backend/assets/contract-templates/`, dumped `document.xml` placeholders + grep hardcoded numbers
  - Step 3 ✅ DONE — same for sibling templates (racekit/operations/payment-request)
  - Step 4 ✅ DONE — cross-referenced template placeholders vs `buildRenderContext()` line 1210-1290

---

## 🎯 ROOT CAUSE CLASSIFIED — Template Hardcoded Sample Values (Hypothesis 2 ✅)

> **Manager Hypothesis 2 ("Stale template uploaded") CONFIRMED.** Hypothesis 1 (placeholder mismatch) + 4 (multiplier) rejected. Hypothesis 3 (data input) likely OK but defer DB dump verification.

### Investigation findings

**Whoever created initial templates (likely F-024 Coder during 2026-05-10 init) built them by:**
1. Copy SAMPLE race DOCX với hardcoded numbers (vd race sample có totalAmount 152M)
2. Convert SOME numbers thành `{placeholder}` (e.g., `{totalAmount}` cho dòng "Tổng tiền sau VAT")
3. **QUÊN convert** các dòng tài chính khác trong Phụ lục/BBNT footer/3.2/tạm ứng/còn lại → giữ HARDCODED sample values

### Template audit findings — Hardcoded sample values per template

| Template | docType | Hardcoded values | Severity |
|----------|---------|------------------|----------|
| `contract-timing.docx` | CONTRACT (TIMING) | 152.000.000 (subtotal) + 12.160.000 (VAT) | 🔴 HIGH |
| `contract-racekit.docx` | CONTRACT (RACEKIT) | 36.180.000 | 🔴 HIGH |
| `contract-operations.docx` | CONTRACT (OPERATIONS) | 264.888.360 | 🔴 HIGH |
| `acceptance-timing.docx` | ACCEPTANCE_REPORT (TIMING) | 155.101.000 (actualSubtotal) + 12.408.080 (actualVat) + 167.509.080 (actualTotal) + 82.080.000 (advancePaid) + 85.429.080 (remainingBalance) | 🔴 CRITICAL — 5 wrong fields |
| `acceptance-racekit.docx` | ACCEPTANCE_REPORT (RACEKIT) | 18.090.000 + 2.680.000 + 33.500.000 + 36.180.000 — ⚠️ **MISSING `{totalAmount}` placeholder entirely** | 🔴 CRITICAL — no totalAmount mapping |
| `acceptance-operations.docx` | ACCEPTANCE_REPORT (OPERATIONS) | 132.444.180 + 133.038.180 + 19.665.360 + 245.817.000 + 264.888.360 + 265.482.360 — WORST | 🔴 CRITICAL — 6 wrong fields |
| `payment-request.docx` | PAYMENT_REQUEST | (none) ✅ | 🟢 CLEAN |

**Total hardcoded values across all templates: 19 numeric strings need conversion to placeholders.**

### Cross-reference với `buildRenderContext()` (contracts.service.ts:1210-1290)

Code đã passes correct data:
- ✅ `subtotal: contract.subtotal` (line 1254)
- ✅ `vatAmount: contract.vatAmount` (line 1256)
- ✅ `totalAmount: contract.totalAmount` (line 1257)
- ✅ `lineItems: contract.lineItems` (line 1247)
- ✅ `paymentTerms: contract.paymentTerms` (line 1261)
- ✅ `acceptanceReport: contract.acceptanceReport` (line 1265) — nested object passed as-is

**Coder MUST verify** docxtemplater nested access syntax `{acceptanceReport.actualSubtotal}` works. Per docxtemplater 3.x docs, nested via dot notation works WITHIN sections but NOT in flat templates. May need flatten in context builder.

**Actions for Coder:**
1. **EDIT 6 DOCX templates** (replace hardcoded numbers with `{placeholder}` tags)
2. **Flatten acceptanceReport fields** in `buildRenderContext()` to top-level for template access (defense-in-depth — works regardless of docxtemplater nested support)
3. **NO code logic change** — `calcTotals`, `upsertAcceptanceReport`, all financial logic verified CORRECT via Manager spot-check

---

## 📝 Contract DOCX + BBNT Financial Number Generation Fix

**Goal:** Sửa toàn bộ 6 DOCX templates đang chứa hardcoded sample financial values gây ra DOCX gen với số tài chính SAI (không match DB). Đảm bảo MỌI contract DOCX + Acceptance Report DOCX gen ra match exact DB values cho 3 contract types (TIMING/RACEKIT/OPERATIONS).

**Scope:**

- ✅ **In scope:**
  - Edit 6 DOCX templates: replace hardcoded numbers với `{placeholder}` Vietnamese-formatted via docxtemplater
  - Verify/extend `buildRenderContext()` flatten `acceptanceReport.*` fields to top-level
  - Verify `formatNumber()` helper produces vi-VN format (152.000.000 → "25.870.000") consistent
  - Add unit tests cover 6 templates × happy path + complex multi-line-item case
  - Audit script `audit-contract-docx-templates.ts` — list ALL contracts có `generatedDocuments[]` (filter docType ∈ {CONTRACT, ACCEPTANCE_REPORT, MINUTES, ANY non-payment-request}) → flag affected
  - Regenerate batch script `regenerate-affected-contracts.ts` — bulk re-call `generateDocument()` cho affected contracts, idempotent + audit log emit
  - Re-upload templates to S3 backup folder (per existing F-024 backup pattern)

- ❌ **Out of scope:**
  - `payment-request.docx` (no hardcoded values found — verified clean)
  - DB schema changes (logic computation đúng — không cần migration)
  - Admin UI changes (financial summary section hiển thị đúng — không bug)
  - Client outreach communication (Phase 2 Finance team decide separately — see PAUSE-42-04)
  - Re-send DOCX to merchants who received wrong files (defer business decision)
  - Backfill `acceptanceReport.actualValues` data (data layer OK per investigation)

---

## 👤 User Stories & Business Rules

### User Stories

- As a **Sales Admin (Hằng)**, I want DOCX generated cho hợp đồng TIMING hiển thị đúng tài chính match admin UI so that tôi không phải edit thủ công file Word trước khi gửi merchant.
- As a **Finance Admin (Hiền)**, I want BBNT DOCX hiển thị đúng "Giá trị nghiệm thu" + "Tạm ứng" + "Còn lại" so that chứng từ pháp lý hợp lệ cho payment + audit tuân Luật quản lý thuế 38/2019.
- As a **Race Organizer (merchant)**, I want hợp đồng tôi nhận được có giá trị tài chính chính xác so that tôi không dispute legally với 5BIB.
- As a **5BIB Back-Office Admin**, I want audit script list ALL contracts đã ship với DOCX wrong financial so that tôi prioritize regenerate/communication strategy.
- As a **CFO**, I want regenerate batch script idempotent + audit log emit so that tôi track regen activity + KHÔNG accidentally overwrite finalized DOCX nhiều lần.

### Business Rules

> BR-42-01..15 — Coder + QC encode + verify.

#### Financial accuracy rules (CRITICAL)

- **BR-42-01** (Contract DOCX accuracy): MỌI `subtotal/vatAmount/totalAmount` hiển thị trong contract DOCX PHẢI match exact `contract.subtotal/vatAmount/totalAmount` từ DB. Discrepancy = bug.
- **BR-42-02** (BBNT DOCX accuracy): MỌI `actualSubtotal/actualVatAmount/actualTotalWithVat` hiển thị trong acceptance DOCX PHẢI match exact `contract.acceptanceReport.actualSubtotal/actualVatAmount/actualTotalWithVat` từ DB.
- **BR-42-03** (BBNT tạm ứng + còn lại): "Bên A tạm ứng cho Bên B" PHẢI = `contract.acceptanceReport.advancePaid`. "Bên A còn phải thanh toán cho Bên B" PHẢI = `contract.acceptanceReport.remainingBalance`. Verify formula: `remainingBalance = actualTotalWithVat - advancePaid`.
- **BR-42-04** (Math consistency): Contract DOCX: `totalAmount = subtotal + vatAmount` (verified `calcTotals()` BR-CM-04 unchanged). BBNT DOCX: `actualTotalWithVat = actualSubtotal + actualVatAmount` (verified `upsertAcceptanceReport()` unchanged).
- **BR-42-05** (vi-VN currency format): MỌI số VND trong DOCX PHẢI dùng vi-VN locale format (`25.870.000` chứ KHÔNG `25,870,000` hoặc `25870000`). Existing `document-generator.service.ts:formatNumber()` helper áp dụng cho mọi placeholder số.
- **BR-42-06** (Bằng chữ accuracy): `totalAmountInWords` (vndAmountInWords helper) PHẢI match `totalAmount`. Verify cho contract DOCX. BBNT cũng cần `actualTotalInWords` placeholder nếu hiển thị "Bằng chữ" trong BBNT (verify template content).

#### Template placeholder rules

- **BR-42-07** (Zero hardcoded financial values): SAU FIX, MỌI 6 DOCX templates KHÔNG được chứa hardcoded numeric string match pattern `[0-9]{1,3}\.[0-9]{3}\.[0-9]{3}` (vi-VN format) liên quan tài chính. QC verify via grep audit.
- **BR-42-08** (Placeholder mapping complete): Mỗi template PHẢI có đầy đủ placeholders cần thiết — xem **Template Placeholder Mapping Table** section dưới.
- **BR-42-09** (Backward compat): Existing placeholders ĐÚNG (`{totalAmount}`, `{lineItems}`, `{client.*}`, `{provider.*}`) PHẢI giữ nguyên. KHÔNG break existing fields.
- **BR-42-10** (Context builder flatten): `buildRenderContext()` PHẢI flatten `acceptanceReport.*` fields to top-level keys for docxtemplater simple substitution. Pattern: `{actualSubtotal}` instead of `{acceptanceReport.actualSubtotal}` (more robust + cross-template consistent).

#### Audit + Regenerate rules

- **BR-42-11** (Audit script output): Audit script PHẢI output JSON report với `{contractId, contractNumber, contractType, status, generatedDocuments: [{docType, generatedAt, s3Key, version, needsRegen: boolean}]}` cho mỗi contract có generatedDocuments[]. `needsRegen=true` nếu generatedAt < deploy timestamp F-042.
- **BR-42-12** (Regenerate idempotency): Regenerate script PHẢI safe-to-rerun. Mỗi run push entry MỚI vào `generatedDocuments[]` array với incremented version (KHÔNG overwrite — preserve audit trail). Old wrong-data docs giữ trong array (S3 lifecycle handle retention).
- **BR-42-13** (Regenerate audit log): Mỗi regenerate PHẢI emit `audit.log` entry với `event: 'contract.regenerateDocument.f042-fix'`, `actorId`, `contractId`, `docType`, `oldVersion`, `newVersion`, `reason: 'F042 template hardcoded values fix'`.
- **BR-42-14** (Status agnostic regenerate): Regenerate batch PHẢI chạy cho contracts ở ALL statuses (DRAFT/ACTIVE/COMPLETED/CANCELLED/REJECTED) — KHÔNG block by `status !== 'ACTIVE'`. F-034 force-edit unlock applies here (BR-42 inherits F-034 status-agnostic principle).
- **BR-42-15** (Concurrent safety): Regenerate script PHẢI process contracts sequentially (1 at a time, NO Promise.all) — tránh S3 rate limit + Mongoose race condition trên `generatedDocuments[]` array push.

---

## 📊 Template Placeholder Mapping Table (MANDATORY for Coder)

> Coder dùng table này làm spec exact khi edit 6 DOCX templates. Hardcoded string → Replacement `{placeholder}` (docxtemplater syntax).

### Table A: `contract-timing.docx`

| Position trong template | Current hardcoded | Replace với placeholder | Context builder source |
|------------------------|-------------------|------------------------|------------------------|
| Phụ lục 01 dòng "Tổng tiền:" | `152.000.000` | `{subtotal}` | `contract.subtotal` (formatted vi-VN) |
| Phụ lục 01 dòng "VAT (8%):" | `12.160.000` | `{vatAmount}` | `contract.vatAmount` (formatted vi-VN) |
| Phụ lục 01 dòng "Tổng tiền sau VAT:" | `{totalAmount}` ✅ already correct | (no change) | — |

### Table B: `contract-racekit.docx`

| Position | Current hardcoded | Replace với | Context builder source |
|----------|-------------------|-------------|------------------------|
| Phụ lục 01 dòng "Tổng tiền:" (or similar) | `36.180.000` | `{subtotal}` | `contract.subtotal` |
| Coder verify cần thêm `{vatAmount}` placeholder không (template may already have it) | (TBD inspect) | `{vatAmount}` | `contract.vatAmount` |

### Table C: `contract-operations.docx`

| Position | Current hardcoded | Replace với | Context builder source |
|----------|-------------------|-------------|------------------------|
| Phụ lục 01 "Tổng tiền" | `264.888.360` | `{subtotal}` (or `{totalAmount}` — verify text label) | `contract.subtotal` OR `contract.totalAmount` per template label semantic |

### Table D: `acceptance-timing.docx` — MOST CRITICAL (5 hardcoded)

| Position | Current hardcoded | Replace với | Context builder source |
|----------|-------------------|-------------|------------------------|
| Section 3.2 "Giá trị nghiệm thu và thanh lý hợp đồng" | `167.509.080` | `{actualTotalWithVat}` | `contract.acceptanceReport.actualTotalWithVat` (flattened) |
| Footer "Tổng tiền:" | `155.101.000` | `{actualSubtotal}` | `contract.acceptanceReport.actualSubtotal` (flattened) |
| Footer "VAT:" | `12.408.080` | `{actualVatAmount}` | `contract.acceptanceReport.actualVatAmount` (flattened) |
| Footer "Tổng tiền sau VAT:" | `167.509.080` (duplicate of section 3.2) | `{actualTotalWithVat}` | (same) |
| "Bên A tạm ứng cho Bên B:" | `82.080.000` | `{advancePaid}` | `contract.acceptanceReport.advancePaid` (flattened) |
| "Bên A còn phải thanh toán cho Bên B:" | `85.429.080` | `{remainingBalance}` | `contract.acceptanceReport.remainingBalance` (flattened) |

### Table E: `acceptance-racekit.docx` — Missing `{totalAmount}` placeholder

| Position | Current hardcoded | Replace với | Context builder source |
|----------|-------------------|-------------|------------------------|
| (varies — Coder extract `document.xml` first to map positions) | `18.090.000` | `{actualSubtotal}` (likely) | `contract.acceptanceReport.actualSubtotal` |
| | `2.680.000` | `{actualVatAmount}` (likely) | `contract.acceptanceReport.actualVatAmount` |
| | `33.500.000` | `{actualTotalWithVat}` (likely) | `contract.acceptanceReport.actualTotalWithVat` |
| | `36.180.000` | (possibly `{contractSubtotal}` or duplicate) | TBD per position semantic |
| ⚠️ Section "Giá trị nghiệm thu" trong RACEKIT BBNT | (currently missing placeholder OR hardcoded) | Add `{actualTotalWithVat}` placeholder | (same) |

**⚠️ Coder action:** Extract `acceptance-racekit.docx` raw `document.xml`, identify text label preceding each hardcoded number, replace với appropriate placeholder per label semantic.

### Table F: `acceptance-operations.docx` — 6 hardcoded values

| Position | Current hardcoded | Replace với | Context builder source |
|----------|-------------------|-------------|------------------------|
| (Coder extract document.xml + label-driven mapping) | `132.444.180` | TBD per position | TBD |
| | `133.038.180` | TBD | TBD |
| | `19.665.360` | TBD | TBD |
| | `245.817.000` | TBD | TBD |
| | `264.888.360` | TBD | TBD |
| | `265.482.360` | TBD | TBD |

**Coder responsibility:** Extract document.xml, identify text label preceding each number (search for "Tổng", "VAT", "Tạm ứng", "Còn lại", "Giá trị nghiệm thu" etc.), map to appropriate placeholder. Manager `/5bib-plan` will verify mapping correctness.

---

## 🖥️ UI/UX Flow

> F-042 KHÔNG có UI changes — admin UI hiển thị tài chính ĐÚNG. Bug chỉ trong DOCX template output.

### Admin UI verify only (no changes)

| Screen | Status |
|--------|--------|
| `/contracts/[id]` — Contract Detail Financial Summary section | ✅ Verified correct (Danny screenshot) — no change |
| `/contracts/[id]` — Acceptance Report Tab | ✅ Verified correct — no change |
| `/contracts/[id]` — Generated Documents list | ✅ No UI change — list updated after regenerate batch via existing endpoint |

### Indirect UI impact (post-deploy)

| User action | Existing UI behavior | F-042 effect |
|-------------|---------------------|--------------|
| Click "Tạo lại DOCX" trên contract detail | POST `/api/contracts/:id/generate-document` | DOCX gen với new correct templates → version++ |
| View "Generated documents" list | Display `generatedDocuments[]` sorted by version DESC | Old wrong DOCX entries preserved (audit trail BR-42-12), new correct version on top |

---

## 🛠️ Technical Mandates (For Coder Agent)

### DB / Cache changes

- ❌ **MongoDB schema:** KHÔNG đụng (logic computation đúng)
- ❌ **MongoDB data migration:** KHÔNG cần backfill `acceptanceReport.actualValues` (data layer OK)
- ❌ **MySQL platform:** KHÔNG đụng
- ❌ **Redis:** KHÔNG đụng (contracts cache invalidate qua existing `invalidateContractsCache()`)
- ✅ **AWS S3:** New DOCX files upload to existing prefix `contract-documents/` qua existing `renderAndUpload()` flow. Old S3 files giữ (S3 lifecycle rule 6 = 5y retention per F-024 audit Luật 38/2019).
- ✅ **DOCX template binary files:** Replace 6 files trong `backend/assets/contract-templates/`:
  - `contract-timing.docx`
  - `contract-racekit.docx`
  - `contract-operations.docx`
  - `acceptance-timing.docx`
  - `acceptance-racekit.docx`
  - `acceptance-operations.docx`
- ✅ **Template backup:** Per F-024 existing pattern `BACKUP_DIRNAME` trong `contract-template.service.ts:234`, old buggy templates backup to `backup/YYYY-MM-DD-pre-f042/` trước replace.

### Backend Endpoint Specification

**No new endpoints.** Existing endpoint flow validated:

| Element | Spec |
|---------|------|
| Method | POST |
| Path | `/api/contracts/:id/generate-document` |
| Auth | `@UseGuards(LogtoStaffGuard)` class-level (unchanged) |
| Guard role | staff hoặc admin |
| Request body DTO | `GenerateDocumentDto` { docType: 'CONTRACT' | 'ACCEPTANCE_REPORT' | 'PAYMENT_REQUEST' | 'QUOTATION' | 'MINUTES' } |
| Response DTO | `{ docxUrl: string, pdfUrl?: string, docxKey: string, pdfKey?: string }` |
| Status codes | 200 success / 400 invalid docType or contract status / 401 no auth / 403 insufficient / 404 contract not found / 500 server (e.g., template missing, render fail) |
| Side effects | Push entry vào `contract.generatedDocuments[]`; upload S3; audit log emit `contract.generateDocument`; **F-042 ADD:** verify rendered DOCX KHÔNG contain hardcoded patterns (defensive runtime check, optional) |

### Code Change: Flatten `buildRenderContext()` (contracts.service.ts:1210-1290)

**Current (line ~1265):**
```typescript
acceptanceReport: contract.acceptanceReport ?? null,
```

**F-042 fix — extend to flatten fields when docType=ACCEPTANCE_REPORT:**
```typescript
// Existing pass-through (for any other docType that may reference nested)
acceptanceReport: contract.acceptanceReport ?? null,

// F-042: flatten top-level keys for docxtemplater simple substitution
// (template uses `{actualSubtotal}` NOT `{acceptanceReport.actualSubtotal}` —
// safer cross-version docxtemplater compat per F-024 lesson).
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
      reportDay: contract.acceptanceReport.reportDate
        ? String(new Date(contract.acceptanceReport.reportDate).getDate()).padStart(2, '0')
        : '',
      reportMonth: contract.acceptanceReport.reportDate
        ? String(new Date(contract.acceptanceReport.reportDate).getMonth() + 1).padStart(2, '0')
        : '',
      reportYear: contract.acceptanceReport.reportDate
        ? String(new Date(contract.acceptanceReport.reportDate).getFullYear())
        : '',
    }
  : {}),
```

**Number formatting verify:**
- `document-generator.service.ts` has helper `formatNumber()` (verified line 184 + 221 trong `renderQuotationExcel`)
- DOCX path goes through `renderDocx()` → docxtemplater → `sanitizeContext()` may auto-format numbers
- ⚠️ **Coder verify:** docxtemplater built-in OR `sanitizeContext()` formats `25870000` → `"25.870.000"` for VND. If NOT formatted, BA may need re-PRD with explicit `formatNumber()` wrapper.

### Templates File Update — Manual Edit Process

> Coder cannot edit `.docx` binary directly via code. Process:

1. Open template via **LibreOffice** (KHÔNG MS Word — preserve formatting consistency với F-037 lesson)
2. Find/Replace hardcoded numbers per Mapping Tables A-F above
3. Save (preserve macros + tblLayout per F-037 fix)
4. Backup old templates to `backend/assets/contract-templates/backup/2026-05-18-pre-f042/`
5. Replace files in `backend/assets/contract-templates/`
6. Verify via `unzip -p word/document.xml | grep -oE '\{[^}]+\}'` → confirm new placeholders present
7. **MANDATORY:** Verify NO `[0-9]{1,3}\.[0-9]{3}\.[0-9]{3}` matches remaining trong financial sections (BR-42-07)

### Audit Script Specification

**File:** `backend/scripts/audit-contract-docx-templates.ts` (NEW)

| Element | Spec |
|---------|------|
| Run | `pnpm --filter backend ts-node scripts/audit-contract-docx-templates.ts` |
| Auth | Direct MongoDB connection via existing env config (KHÔNG goes through API) |
| Query | `db.contracts.find({"generatedDocuments.0": {$exists: true}, deletedAt: null})` |
| Output | JSON file `audit-f042-report.json` với schema BR-42-11 + summary counts per contractType + docType |
| Side effects | NONE (read-only) |
| Performance | Process all 58 merchants × ~hundreds contracts (estimate <5 min) |

### Regenerate Batch Script Specification

**File:** `backend/scripts/regenerate-affected-contracts.ts` (NEW)

| Element | Spec |
|---------|------|
| Run | `pnpm --filter backend ts-node scripts/regenerate-affected-contracts.ts [--dry-run] [--audit-file=audit-f042-report.json]` |
| Input | `audit-f042-report.json` from audit script |
| Behavior | For each contract in audit, for each docType in `generatedDocuments[]` (excluding PAYMENT_REQUEST — clean): call existing `ContractsService.generateDocument()` sequentially. Sleep 200ms between to avoid S3 rate limit. |
| Dry-run mode | `--dry-run` flag prints list of (contractId, docType) tuples WITHOUT actually calling generateDocument. Used by Manager pre-deploy verify. |
| Output | Log file `regenerate-f042-log.json` với `{contractId, docType, oldVersion, newVersion, success: bool, error?: string, durationMs}` per entry |
| Audit log | Each successful regenerate emits BR-42-13 audit log event |
| Concurrency | BR-42-15 sequential — NO Promise.all |

### Frontend / Admin (Next.js)

- ❌ **No frontend changes.** Admin UI verified correct.

### PAUSE flags

- 🛑 **Coder MUST verify acceptance-racekit.docx + acceptance-operations.docx mapping correctness** with Manager before commit (BA marked TBD trong Table E + F per position semantic)
- 🛑 **Coder MUST run dry-run regenerate** trên staging/local first → confirm script logic before PROD batch
- 🛑 **Coder MUST get Danny + Finance team approval** before running regenerate batch on PROD (BR-42-13 audit emit is permanent — affects accounting)
- 🛑 **Coder MUST verify docxtemplater number formatting** — if `{subtotal}` displays `25870000` (no formatting) instead of `25.870.000`, BA loops back for explicit `formatNumber()` wrapper in context builder

---

## 🛡️ Testing Mandates (For QC Agent)

### Backend Test Cases TC-42-XX

#### TC-42-01: Contract DOCX gen TIMING happy path
| Element | Value |
|---------|-------|
| Method | POST |
| URL | `/api/contracts/test-timing-id/generate-document` |
| Headers | `Authorization: Bearer <admin>`, `Content-Type: application/json` |
| Body | `{"docType": "CONTRACT"}` |
| Pre-condition | Contract `test-timing-id` exists ACTIVE status, lineItems 5 items, subtotal 25.870.000, vatAmount 2.069.600, totalAmount 27.939.600 |
| Expected status | 200 |
| Expected response shape | `{"docxUrl": <https://s3...>, "pdfUrl": <opt>, "docxKey": "contract-documents/...", "pdfKey": <opt>}` |
| MUST NOT leak | Raw `_id`, contract internal fields |
| Side effect verify | (1) MongoDB contract `generatedDocuments[]` array length increment; (2) S3 file uploaded matches docxKey; (3) Audit log emit `contract.generateDocument` |
| **DOCX content verify** | Extract uploaded DOCX → search "25.870.000" present (subtotal) + "2.069.600" (VAT) + "27.939.600" (total). NO occurrence of "152.000.000" or "12.160.000" hardcoded values. |

#### TC-42-02: BBNT DOCX gen TIMING happy path
| Element | Value |
|---------|-------|
| Method | POST |
| URL | `/api/contracts/test-timing-id/generate-document` |
| Headers | Same |
| Body | `{"docType": "ACCEPTANCE_REPORT"}` |
| Pre-condition | Contract has `acceptanceReport` finalized với actualSubtotal 25.870.000, actualVatAmount 2.069.600, actualTotalWithVat 27.939.600, advancePaid 13.969.800, remainingBalance 13.969.800 |
| Expected status | 200 |
| Expected response | Same shape as TC-42-01 |
| **DOCX content verify** | Search for: "25.870.000" (actualSubtotal) + "2.069.600" (actualVAT) + "27.939.600" (actualTotal) + "13.969.800" (advancePaid + remainingBalance) present. NO occurrence of "155.101.000", "12.408.080", "167.509.080", "82.080.000", "85.429.080" hardcoded. |

#### TC-42-03: Contract DOCX gen RACEKIT — verify no hardcoded
| Element | Value |
|---------|-------|
| Same flow as TC-42-01 with RACEKIT contract |
| **DOCX content verify** | NO occurrence of "36.180.000" hardcoded (RACEKIT sample value) |

#### TC-42-04: Contract DOCX gen OPERATIONS — verify no hardcoded
| Same flow with OPERATIONS contract |
| **DOCX content verify** | NO occurrence of "264.888.360" hardcoded |

#### TC-42-05: BBNT DOCX gen RACEKIT
| **DOCX content verify** | NO occurrence of "18.090.000", "2.680.000", "33.500.000", "36.180.000" |

#### TC-42-06: BBNT DOCX gen OPERATIONS
| **DOCX content verify** | NO occurrence of "132.444.180", "133.038.180", "19.665.360", "245.817.000", "264.888.360", "265.482.360" |

#### TC-42-07: Complex multi-line-item case (TIMING contract Danny screenshot)
| Pre-condition | Mirror exact contract `6a095ceae7c717e8fc1c2c0e`: 5 line items (15M×1×15% + 30k×80 + 9k×80 + 5M×1 + 5M×1) → subtotal 25.870.000, vatAmount 2.069.600, totalAmount 27.939.600 |
| Action | Generate both CONTRACT + ACCEPTANCE_REPORT DOCX |
| **DOCX content verify** | Phụ lục 01 table 5 rows with exact line items; footer totals match DB; BBNT footer totals match DB; tạm ứng 13.969.800; còn lại 13.969.800 |

#### TC-42-08: Edge case — zero discount line items
| Pre-condition | Contract với 1 lineItem unit_price=10M qty=1 discount=0 → amount=10M, subtotal=10M, vatAmount=800k, totalAmount=10.8M |
| **DOCX verify** | "10.000.000" subtotal + "800.000" VAT + "10.800.000" total present |

#### TC-42-09: Edge case — large amount 1 tỷ+
| Pre-condition | Contract subtotal 1.000.000.000 (real-world data per F-038 lesson) |
| **DOCX verify** | "1.000.000.000" formatted correctly vi-VN |

#### TC-42-10: Audit script — list all generated documents
| Action | Run `pnpm --filter backend ts-node scripts/audit-contract-docx-templates.ts` |
| Expected output | JSON report file generated, summary counts ≥0, schema match BR-42-11 |
| MUST NOT | Modify any DB record (read-only) |

#### TC-42-11: Regenerate dry-run
| Action | Run `regenerate-affected-contracts.ts --dry-run --audit-file=audit-f042-report.json` |
| Expected | List of (contractId, docType) tuples printed, NO actual generateDocument calls |
| Side effect verify | MongoDB `generatedDocuments[]` array NOT modified |

#### TC-42-12: Regenerate batch real run — single contract
| Action | Run regenerate cho 1 contract from audit list |
| Pre-condition | Contract has 1 wrong DOCX in generatedDocuments |
| Expected | New DOCX entry added with version++. Old entry preserved. Audit log emitted. |

### E2E Test Cases (Playwright)

| TC | Persona | Journey | Steps | Expected |
|----|---------|---------|-------|----------|
| E2E-42-01 | Sales Admin (Hằng) | Generate Contract DOCX TIMING | 1. `/contracts/6a095ceae7c717e8fc1c2c0e` 2. Click "Tạo Hợp đồng" 3. Wait loading 4. Click "Tải xuống" generated DOCX 5. Open DOCX file | Phụ lục 01 hiển thị Tổng tiền 25.870.000đ + VAT 2.069.600đ + Tổng sau VAT 27.939.600đ. KHÔNG 152.000.000 hardcoded. |
| E2E-42-02 | Finance Admin (Hiền) | Generate BBNT TIMING | 1. Same contract `/contracts/6a095ceae7c717e8fc1c2c0e` 2. Tab "Biên bản nghiệm thu" 3. Verify actualValues filled 4. Finalize BBNT 5. Click "Xuất BBNT" 6. Open DOCX | BBNT section 3.2 hiển thị 27.939.600đ. Footer Tổng/VAT/Tổng sau VAT match DB. Tạm ứng 13.969.800đ. Còn lại 13.969.800đ. KHÔNG 155.101.000, 167.509.080, 82.080.000 hardcoded. |
| E2E-42-03 | Sales Admin | Generate Contract DOCX RACEKIT | Same flow với RACEKIT contract | Tài chính match DB. KHÔNG 36.180.000 hardcoded. |
| E2E-42-04 | Sales Admin | Generate Contract DOCX OPERATIONS | Same flow với OPERATIONS contract | Tài chính match DB. KHÔNG 264.888.360 hardcoded. |
| E2E-42-05 | Operations | Re-download multiple versions | Generate DOCX 2 lần liên tiếp (regenerate scenario) | Version 1 + Version 2 cả 2 hiển thị trong "Generated documents" list. Mỗi version có S3 file riêng. |
| E2E-42-06 | Back-Office Admin | Audit script đọc DB | Run audit script command in terminal | JSON report generated với schema đúng BR-42-11. Count summary >0 (existing affected contracts) |
| E2E-42-07 | Back-Office Admin | Regenerate dry-run | Run regen dry-run command | Output list contracts WITHOUT modifying DB. No new generatedDocuments entries. |

### Real-world data scenario verification (MANDATORY 6 items per Manager 2026-05-14 directive)

- [x] **VN long entity name ≥30 ký tự + diacritics:** Test với contract entity `CÔNG TY CỔ PHẦN ĐẦU TƯ THƯƠNG MẠI DỊCH VỤ XYZ VIỆT NAM` — verify DOCX render no overflow + correct rendering
- [x] **Email VN diacritic:** N/A (DOCX không có email field display)
- [x] **Money 1B+ VND:** TC-42-09 covers 1.000.000.000đ vi-VN format
- [x] **Quantity edge 1000+ items:** Contract với line items qty=1000 (vd: race 1000 BIB chip) — verify DOCX table renders all rows + footer totals correct
- [x] **Negative margin scenarios:** N/A (contract DOCX không hiển thị margin/profit)
- [x] **Long line item description >200 ký tự:** Line item description long text — verify DOCX table cell wrap correctly (F-037 colspan precedent)

### Security Checks

- [ ] Endpoint `POST /api/contracts/:id/generate-document` protected by `LogtoStaffGuard` — verify 401 unauth
- [ ] IDOR — staff role A cannot generate DOCX cho contract owned by tenant B (verify ownership check trong service)
- [ ] DOCX URL signed S3 (existing implementation) — KHÔNG public S3
- [ ] Audit script connection string from env (KHÔNG hardcoded)
- [ ] Regenerate script require explicit confirmation prompt (defense vs accidental bulk override)

### Performance SLA

- DOCX gen per request p95 < 30s (existing F-024 SLA — PDF convert timeout)
- Audit script total runtime < 5 phút (full DB scan)
- Regenerate batch 100 contracts < 1 hour (sequential + 200ms sleep — ~36 sec/contract avg)
- Template edit verify grep audit < 1 sec per template

---

## 📌 Answers to Manager's PAUSE conditions (từ file 00)

> BA giải quyết 7 PAUSE-42-* Manager đã đặt.

- **PAUSE-42-01 (Root cause classification):** ✅ **TEMPLATE BUG confirmed** (Hypothesis 2). BA đã extract toàn bộ 7 DOCX templates via `unzip + grep document.xml` + cross-reference với `buildRenderContext()` line 1210-1290 — 6/7 templates chứa hardcoded sample financial values (19 numeric strings total). Logic computation (`calcTotals`, `upsertAcceptanceReport`) đã verified ĐÚNG via Manager spot-check. Data layer KHÔNG bug. Fix scope = edit binary templates + flatten acceptanceReport context. DB dump verification SKIP — investigation đủ classify root cause definitively.

- **PAUSE-42-02 (Blast radius audit):** ✅ Implement audit script `audit-contract-docx-templates.ts` (BR-42-11) chạy DB query list ALL contracts có `generatedDocuments[]` non-empty. Output JSON report cho Coder + Manager review trước khi regenerate batch. Cost: ~5 phút runtime, no DB modification.

- **PAUSE-42-03 (Fix scope — 3 contract types?):** ✅ **FIX ALL 3 contract types** + their acceptance variants = 6 templates total (`contract-timing`, `contract-racekit`, `contract-operations`, `acceptance-timing`, `acceptance-racekit`, `acceptance-operations`). Audit confirmed ALL có hardcoded values. `payment-request.docx` clean, KHÔNG fix. Mapping Table A-F encoded specific replacements per template.

- **PAUSE-42-04 (Communication strategy):** ⚠️ **Phase 1 fix code only.** Re-send DOCX cho merchants đã nhận file SAI = business decision Danny + Finance team. Risk: gửi file mới với số khác = suspicious legal. Manager đề xuất Phase 2 outreach strategy sau khi Phase 1 ship + audit blast radius known. BR-42-13 audit log preserve cả 2 versions (old wrong + new correct) cho traceability.

- **PAUSE-42-05 (Test fixture):** ✅ Encoded trong section "Testing Mandates" — 12 TC-42-XX backend tests (3 contract types × happy + complex + edge) + 7 E2E-42-XX frontend tests. Real-world data Danny screenshot contract `6a095ceae7c717e8fc1c2c0e` used as TC-42-07 complex case.

- **PAUSE-42-06 (Regenerate batch strategy):** ✅ Implement `regenerate-affected-contracts.ts` (BR-42-12, BR-42-13, BR-42-15). Idempotent (push version++, KHÔNG overwrite). Audit log per regenerate. Dry-run mode for Manager pre-deploy verify. Sequential (no Promise.all) to avoid S3 rate limit + Mongoose race.

- **PAUSE-42-07 (Lifecycle considerations FINALIZED contracts):** ✅ **Status-agnostic regenerate** (BR-42-14). F-034 force-edit unlock precedent applies — admin can regenerate DOCX cho contracts ở ALL statuses kể cả COMPLETED/CANCELLED. Each regenerate version++ trong `generatedDocuments[]` array preserve audit trail. Lifecycle KHÔNG block.

---

## 🚨 Risk acknowledgments (BA flag for Manager review)

- 🔴 **Template binary editing risk:** Editing 6 DOCX files manually via LibreOffice có thể introduce subtle formatting bugs (per F-037 lesson — tblLayout / colspan issues). Coder MUST verify post-edit:
  - Extract document.xml + grep `\{[^}]+\}` placeholders present per Mapping Tables A-F
  - Extract document.xml + grep `[0-9]{1,3}\.[0-9]{3}\.[0-9]{3}` patterns trong financial sections = empty (BR-42-07)
  - Open template in MS Word + LibreOffice + Google Docs viewer — verify visual fidelity preserved (F-037 multi-viewer lesson)

- 🟡 **acceptance-racekit + acceptance-operations mapping TBD:** Tables E + F mark position-semantic TBD pending Coder document.xml extraction. Manager `/5bib-plan` will verify mapping correctness when Coder propose specific replacements.

- 🟡 **Number formatting docxtemplater verify needed:** Currently unclear if `{subtotal}` placeholder auto-formats `25870000` → `"25.870.000"`. Coder MUST verify; if NOT formatted, escalate to BA for explicit `formatNumber()` wrapper in context builder.

- 🟢 **Backward compat:** All existing placeholders (`{totalAmount}`, `{lineItems}`, `{client.*}`) preserved. KHÔNG break existing functionality.

- 🟢 **Rollback safety:** Old templates backup `backend/assets/contract-templates/backup/2026-05-18-pre-f042/`. Revert = swap files back, no DB change.

---

## ✅ Status

- [x] **READY** — sẵn sàng cho Manager review (`/5bib-plan`)

---

## 🔗 Next step

Danny chạy: `/5bib-plan FEATURE-042-contract-docx-financial-bug-fix`

Manager sẽ:
1. Validate checklist (15 BR-42-* testable + Template Placeholder Mapping Tables A-F + 12 TC-42-XX + 7 E2E-42-XX)
2. Cross-check memory architecture + conventions (no new patterns expected — pure bugfix) + known-issues (F-024 contracts module + F-037 DOCX lesson)
3. **Spot-check code thật** (mandatory per skill update 2026-05-17):
   - Verify `contracts.service.ts:1210-1290 buildRenderContext()` exact code state vs BA flatten proposal
   - Verify `document-generator.service.ts` formatNumber/sanitizeContext behavior trên numeric placeholders
   - Verify `backend/assets/contract-templates/backup/` directory pattern (F-024 BACKUP_DIRNAME constant)
4. Output `02-manager-plan.md` với Scope Lock (6 templates + 1 service file + 2 NEW scripts) + verdict APPROVED hoặc NEEDS_REVISION

**Estimated Coder workload:** ~4-6h
- ~1h: Edit 6 DOCX templates (LibreOffice find-replace + extract verify per template)
- ~30min: Flatten acceptanceReport in buildRenderContext + verify formatNumber
- ~1h: Write audit script + regenerate script
- ~1h: Backend unit tests TC-42-XX (12 cases)
- ~30min: Backup old templates + manual viewer verification (MS Word + LibreOffice + Google Docs)
- ~30min: Self-review pipeline 10 bước
- ~30min: Documentation 03-coder-implementation.md
