# FEATURE-032: Coder Implementation — Partner Excel Import

**Status:** 🟠 READY_FOR_QC
**Started:** 2026-05-13
**Completed:** 2026-05-13
**Pattern:** Mirror F-031 ServiceCatalog Import — proven 2-step Preview→Confirm UX.

---

## ✅ Pre-flight checklist

- [x] 00-manager-init.md đọc
- [x] 02-manager-plan.md APPROVED đọc (Scope Lock + 7 PAUSE-32-* defaults)
- [x] memory/conventions.md đọc (F-021 route ordering convention + F-031 2-step pattern)
- [x] memory/codebase-map.md đọc
- [x] Code thật của partners.controller.ts + contracts.module.ts + partner.schema.ts đọc

---

## 🔍 Impact Assessment

**Backend:**
- MongoDB Partner collection: `insertMany {ordered: false}` for partial-fail handling. No new index — `taxId` already sparse unique candidate per F-024 schema design.
- Aggregation `findByTaxIdsOrNames`: single `$or` query với `$in` arrays, projection `{entityName: 1, taxId: 1, _id: 0}` — hits existing indexes, batch dedup avoid N+1.
- NestJS DI: register `PartnersImportService` provider; controller adds 3 new endpoints.
- API contract: 4 NEW DTOs (`PartnerImportPreviewDto`, `PartnerImportConfirmDto`, `PartnerImportResultDto`, `ParsedPartnerRowDto`, `InvalidPartnerRowDto`). Non-breaking — adds endpoints, no rename/remove.
- Redis: no new keys. No cache invalidation needed (partner list isn't cached aggressively).

**Admin Frontend:**
- New Client Component dialog (`partner-import-dialog.tsx`) — `'use client'` justified (state machine + file picker).
- Partners page `/contracts/partners` adds header button + dialog mount.
- 3 helpers + 4 interfaces in `contracts-api.ts` (raw fetch via Next proxy — same pattern as F-031, NOT generated SDK to avoid backlog regen).

**Boundary:**
- Auth: class-level `@UseGuards(LogtoStaffGuard)` inherited — all 3 import routes protected.
- Route ordering: literal `import-excel/preview`, `import-excel/confirm`, `import-template` declared BEFORE `:id` routes (F-021 PROD lesson).

---

## ⚠️ Edge Cases Covered

1. **Empty entityName row** → invalid row report, KHÔNG block batch (PAUSE-32-06).
2. **Invalid email format** (e.g. `foo@bar`) → invalid row report (mirror F-024 CreatePartnerDto `@IsEmail`).
3. **Duplicate by taxId** → Skip+report, even if entityName differs (taxId primary, MST stable).
4. **Duplicate by entityName** (row without taxId) → Skip+report (fallback dedup).
5. **Max 200 rows** → rows 201+ flagged as invalid row, KHÔNG batch fail (PAUSE-32-04).
6. **File >5MB** → Multer FileInterceptor rejects 400 before parsing.
7. **Race condition** (admin individual POST between preview + confirm) → server RE-VALIDATES dedup at confirm step.
8. **insertMany partial fail** → catch BulkWriteError, return `inserted` + `failed` counts.
9. **Empty file** → toast "File rỗng — KHÔNG có dòng dữ liệu nào để import".
10. **Excel parse error** (corrupted file) → 400 BadRequest with VN message.

---

## 🧠 Logic & Architecture

**Dual-key dedup (PAUSE-32-02):**
- `taxId` is primary key (MST is government-issued, stable, unique candidate in real-world data).
- Fallback: rows without `taxId` match by `entityName` exact (case-sensitive trim).
- For dedup safety, partner with taxId in DB also dedupes against new rows by entityName (defensive — prevents creating "Co A" twice if 1 has MST, 1 doesn't).

**2-step Preview→Confirm (PAUSE-32-03):**
- Step 1 client-side: upload file → POST `/import-excel/preview` → render badge OK/Trùng/Lỗi.
- Step 2 client-side: user confirms → POST `/import-excel/confirm` với valid rows. Server RE-VALIDATES (race window). Skips become `skipped_duplicate` in result.

**Server trust boundary:**
- DON'T trust FE-passed validated rows. `class-validator` on DTO + `findByTaxIdsOrNames` re-check at confirm step.
- `bulkInsert {ordered: false}` so 1 bad doc doesn't abort the batch.

**Pattern reuse from F-031:**
- ExcelJS for parse + generate. Same workbook reader code.
- FileInterceptor 5MB limit. Same multipart MIME handling.
- `Buffer.from(buf.buffer.slice(...))` for ExcelJS load (TypeScript-friendly ArrayBuffer cast).

---

## 📁 Files Changed (per 02-manager-plan.md Scope Lock)

### Backend (6 files = 3 NEW + 3 modify)
- ➕ `backend/src/modules/contracts/dto/import-partner.dto.ts` (96 LOC) — 5 DTOs
- ➕ `backend/src/modules/contracts/services/partners-import.service.ts` (370 LOC) — parseExcel + validateRow + bulkInsert + generateTemplate
- ➕ `backend/src/modules/contracts/services/partners-import.service.spec.ts` (305 LOC) — 9 TC-IM-* PASS
- ✏️ `backend/src/modules/contracts/partners.controller.ts` — 3 import routes literal BEFORE `:id`
- ✏️ `backend/src/modules/contracts/contracts.module.ts` — register PartnersImportService provider
- ✏️ `backend/src/modules/contracts/services/partners.service.ts` — added `findByTaxIdsOrNames` batch query

### Admin (3 files = 1 NEW + 2 modify)
- ➕ `admin/src/app/(dashboard)/contracts/_components/partner-import-dialog.tsx` (~370 LOC) — Dialog mirror F-031
- ✏️ `admin/src/app/(dashboard)/contracts/partners/page.tsx` — Import Excel button + dialog mount
- ✏️ `admin/src/lib/contracts-api.ts` — 3 helpers + 4 interfaces appended

**Scope creep:** NONE. All files match Scope Lock.

---

## 🧪 Tests Written

```
PASS src/modules/contracts/services/partners-import.service.spec.ts
  PartnersImportService — FEATURE-032
    ✓ TC-IM-01: happy path 5 valid rows → all valid, 0 duplicate, 0 invalid (31 ms)
    ✓ TC-IM-02: email strict — accept "a@b.com", reject "not-email" (10 ms)
    ✓ TC-IM-03: empty entityName → invalid row report (6 ms)
    ✓ TC-IM-04: duplicate by taxId → Skip+report (PAUSE-32-02 primary key) (5 ms)
    ✓ TC-IM-05: duplicate by entityName (no taxId) → Skip+report (PAUSE-32-02 fallback) (8 ms)
    ✓ TC-IM-06: mixed valid + dup (taxId) + dup (name) + invalid → preview shape (6 ms)
    ✓ TC-IM-07: bulkInsert — createdBy assertion + server re-validate dedup (race) (1 ms)
    ✓ TC-IM-08 (defensive): generateTemplate returns valid XLSX buffer parse-able (6 ms)
    ✓ TC-IM-09 (defensive): Max 200 rows enforcement — row 201+ flagged invalid (27 ms)

Test Suites: 1 passed, 1 total
Tests:       9 passed, 9 total
Time:        3.318 s
```

**Partners domain regression:**
```
PASS src/modules/contracts/services/partners.service.spec.ts (5 tests)
PASS src/modules/contracts/services/partners-import.service.spec.ts (9 tests)

Test Suites: 2 passed, 2 total
Tests:       14 passed, 14 total
```

Zero break trên `partners.service.spec.ts` (5 existing tests still PASS).

---

## 🛑 PAUSE/Confirmation log

- PAUSE-32-CODER-01 verify `findByTaxIdsOrNames` existed: KHÔNG existed → added new (per Scope Lock).
- PAUSE-32-CODER-02 server RE-VALIDATES dedup at confirm: DONE (`bulkInsert` calls `findByTaxIdsOrNames` again).
- PAUSE-32-CODER-03 SDK regen defer: SKIPPED — admin uses raw fetch via contracts-api.ts helpers (consistent F-031 pattern, NOT blocking runtime).
- PAUSE-32-CODER-04 KHÔNG `pnpm install` / KHÔNG file ngoài Scope Lock: COMPLIED. ExcelJS already in deps from F-031.
- PAUSE-32-CODER-05 Route ordering literal BEFORE `:id`: COMPLIED with explicit comment block reminding of F-021 lesson.

**Danny confirmations (from session start):** auto-confirmed F-031 defaults per option "a":
- 11 cols VN headers ⭐
- Dedup taxId primary + entityName fallback ⭐
- 2-step Preview→Confirm ⭐
- Max 200 rows ⭐
- createdBy = userId admin ⭐
- Empty/invalid skip + collect ⭐
- Template download ⭐

---

## 🔮 Known limitations / Tech debt

- TD-F032-SDK-REGEN (LOW): Same as TD-F031-SDK-REGEN. Admin uses raw fetch via `contracts-api.ts` helpers, not generated SDK. Pattern consistent với F-031; will regenerate at SDK rev batch.
- TD-F032-VN-DIACRITIC (LOW): entityName dedup is case-sensitive + trim only. No diacritic normalization. Real-world risk LOW because admin typically copies-pastes names verbatim. If needed, follow-up feature can add NFD normalize.
- TD-F032-RELEASE-BRANCH (FYI): release/v1.8.0 currently behind main by F-030 + F-031 commits. Manager phải rebase release/v1.8.0 onto main HEAD (4f07d1b) trước khi commit F-032 + push. Otherwise PROD deploy lacks F-030/F-031.

---

## ✅ Final Status: READY_FOR_QC

Checklist PASS:
- [x] All Scope Lock files implemented
- [x] 9/9 mandatory TC-IM-* tests PASS
- [x] 5/5 existing partners.service tests still PASS (zero regression)
- [x] tsc clean for all F-032 files (pre-existing kiosk spec errors unrelated)
- [x] Route ordering follows F-021 convention
- [x] Server RE-VALIDATES dedup at confirm step
