# FEATURE-044: Plan Review — Contract DOCX Phase 2 Text Hardcoded Fix

**Status:** ✅ APPROVED (với 3 Critical Adjustments mandatory cho Coder)
**Reviewed:** 2026-05-19
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check (Manager)

- [x] Đã đọc `00-manager-init.md` (3 bug classes + 7 PAUSE + F-042 missed patterns inventory)
- [x] Đã đọc `01-ba-prd.md` (18 BR-44-* + 6 Mapping Tables A-F + 14 TC + 6 E2E + 7 PAUSE answers)
- [x] Đã đọc memory: `architecture.md` (no impact), `conventions.md` (F-042 patterns to extend), `known-issues.md` (F-042 8 TDs)
- [x] **MANDATORY spot-check code thật (skill 2026-05-17) — 4 critical files:**
  - `admin/src/lib/contracts-api.ts streamDownloadBlob()` — verified discards Content-Disposition (only returns blob)
  - `admin/src/app/(dashboard)/contracts/_components/document-download-btn.tsx:75` — confirmed `a.download` override
  - `acceptance-racekit.docx` document.xml grep `{advancePaid}` — found 4 occurrences, 3 mis-used
  - `backend/scripts/audit-template-placeholders.ts` — confirmed CONTEXT_KEYS Set hardcoded list F-042 stale

---

## ✓ PRD Validation Checklist

### Completeness — ⚠️ 2 gaps found
- [x] User Stories đầy đủ (5 personas)
- [x] 18 BR-44-01..18 có ID, testable
- [x] All 7 PAUSE-44-* answered
- [x] Mapping Tables A-F explicit cho 6 templates
- [⚠️] **MISSING:** BR-44-03 mentions 1 `{advancePaid}` typo trong acceptance-racekit. **Manager grep found 3 typo locations**. → Adjustment #1.
- [⚠️] **MISSING:** BR-44-11 Option 1 (remove `a.download`) → `streamDownloadBlob()` impl không expose response headers, Option 1 invalid. → Adjustment #2.
- [x] 14 TC-44-XX backend + 6 E2E-44-XX

### Technical correctness — ✅ với 2 mandatory fixes
- [x] ZERO DB schema/migration
- [x] Reuse F-042 audit + regen scripts pattern
- [x] Backward compat F-024 build-filename fallback
- [x] BACKUP_DIRNAME pattern preserved
- [⚠️] streamDownloadBlob refactor needed (Adjustment #2)

### Security — ✅ PASS
- [x] LogtoStaffGuard unchanged
- [x] Filename sanitize prevents path traversal
- [x] No new endpoint, no auth surface change

### Performance — ✅ PASS
- [x] DOCX gen p95 < 30s (unchanged)
- [x] Audit script extended regex runtime budget OK

### Testability — ⚠️ 1 fix
- [x] 14 TC + 6 E2E cover bug classes
- [⚠️] TC-44-04 only covers 1 typo location — extend to verify all 3 fixed (Adjustment #1)

---

## 🚨 3 Critical Adjustments — Coder MANDATORY follow

### Adjustment #1 (MANDATORY): Fix ALL 3× `{advancePaid}` → `{remainingBalance}` typo locations trong `acceptance-racekit.docx`

> BA PRD BR-44-03 nói 1 typo. Manager grep found **3 typo locations** + 1 correct usage.

**Verified positions (grep against /tmp/ba-f044/acceptance-racekit/word/document.xml):**

| # | Context | Current | Should be |
|---|---------|---------|-----------|
| 1 | "Giá trị Bên A tạm ứng cho Bên B: `{advancePaid}` đ" | `{advancePaid}` | ✅ KEEP (correct) |
| 2 | "Giá trị Bên A còn phải thanh toán cho Bên B: `{advancePaid}` VNĐ" | `{advancePaid}` | ❌ FIX → `{remainingBalance}` |
| 3 | Điều 4 "thanh toán số tiền còn lại cho Bên B là `{advancePaid}` VNĐ" | `{advancePaid}` | ❌ FIX → `{remainingBalance}` |
| 4 | "thanh toán cho chúng tôi giá trị còn lại của hợp đồng... là: `{advancePaid}` VNĐ" | `{advancePaid}` | ❌ FIX → `{remainingBalance}` |

**Coder PHẢI:**
- Replace 3 typo occurrences (2nd, 3rd, 4th) via context-aware regex (ordinal-based replacement, KEEP 1st occurrence which is "tạm ứng")
- Verify post-edit: only 1 `{advancePaid}` placeholder remaining (the "tạm ứng" line). 3 new `{remainingBalance}` placeholders added.
- Update TC-44-04 assertion: post-fix DOCX should contain `{remainingBalance}` resolved value **≥3 times** in "còn lại" contexts + `{advancePaid}` resolved value **1 time** in "tạm ứng" context. Test với asymmetric split (advancePaid ≠ remainingBalance) to expose bug surfacing.

**Impact if missed:** Same bug class repeats — racekit BBNT vẫn hiển thị wrong amount for "còn lại" sentences when non-50/50 split.

---

### Adjustment #2 (MANDATORY): `streamDownloadBlob()` refactor to expose Content-Disposition filename

> BA PRD BR-44-11 Option 1 ("Remove `a.download` line → browser uses Content-Disposition") **INVALID**. Current `streamDownloadBlob()` implementation:

```typescript
// admin/src/lib/contracts-api.ts
export async function streamDownloadBlob(id, s3Key): Promise<Blob> {
  const res = await fetch(`/api/contracts/${id}/download/stream${...}`);
  if (!res.ok) throw ...;
  return await res.blob();  // ← Discards response headers, returns Blob only
}
```

`res.blob()` đóng response → caller KHÔNG có access to `Content-Disposition` header. Browser fetch API + blob() doesn't auto-apply Content-Disposition like `<a href>` does.

**Coder PHẢI refactor:**

```typescript
// Option A (Recommended): Return blob + extracted filename
export async function streamDownloadBlob(
  id: string,
  s3Key: string,
): Promise<{ blob: Blob; filename: string | null }> {
  const res = await fetch(`/api/contracts/${id}/download/stream${...}`);
  if (!res.ok) { /* error handling */ }
  
  // Extract filename from Content-Disposition (RFC 5987 escape — backend uses it)
  const contentDisp = res.headers.get('Content-Disposition') ?? '';
  const filename = parseFilenameFromContentDisposition(contentDisp);
  
  return { blob: await res.blob(), filename };
}

// Caller updated:
// admin/src/app/(dashboard)/contracts/_components/document-download-btn.tsx:75
const { blob, filename } = await streamDownloadBlob(contractId, key);
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = filename ?? `${DOCTYPE_LABEL[docType]}-${contractId}.${format.toLowerCase()}`;  // fallback
// ...
```

**Helper `parseFilenameFromContentDisposition`:**
- Parse RFC 5987 `filename*=UTF-8''<encoded>` first (preferred for Unicode/VN diacritics)
- Fallback `filename="..."` plain
- Return null nếu không parse được → caller uses fallback

**Update BR-44-11:** Pattern: `a.download = filename from header` instead of "remove a.download line".

**Coder verify post-fix:** Network tab response includes `Content-Disposition: attachment; filename="..."`; downloaded file actually uses header filename.

---

### Adjustment #3 (MANDATORY): Coder must run extended audit script BEFORE commit

> Prevent F-044 from missing more hidden bugs like Adjustment #1.

**Coder PHẢI:**

1. **Implement audit script extension FIRST** per BR-44-13 (regex extend) + BR-44-14 (CONTEXT_KEYS update)
2. **Run extended audit BEFORE template edits** → capture baseline hardcoded count
3. **Edit templates per Mapping Tables**
4. **Run extended audit AFTER edits** → verify "Hardcoded leaks (unique): 0" across ALL 4 pattern classes:
   - Numeric financial `[0-9]{1,3}\.[0-9]{3}\.[0-9]{3}` (F-042)
   - Contract number slash `\d{2}\.\d{2}/\d{4}/H[DĐ]+V?/[A-Z\-0-9]+` (F-044 NEW)
   - Contract number dash `\d{2}\.\d{2}-HDDV-[A-Z0-9\-]+` (F-044 NEW)
   - VN in-words `(Một|Hai|...|Chín|Mười)\s+(trăm|mươi|triệu|tỷ|nghìn|ngàn)\s+` (F-044 NEW)
5. **Coder ALSO grep `{advancePaid}` ALL templates** post-edit để confirm typo not regenerated elsewhere

**Report in 03-coder-implementation.md:** Pre-edit + post-edit audit script outputs side-by-side.

---

## 📊 Cross-check với memory

### Architecture impact
- ✅ ZERO change. F-044 = pure template binary fix + minor service/utility extend + 1 frontend line.

### Convention impact
- ⚠️ Extend F-042 audit pattern (Adjustment #3) — Manager sẽ update `conventions.md` post-deploy:
  - Section "DOCX template fix workflow" — add regex pattern checklist for future template fixes (numeric + contract number + in-words)
  - Section "Audit + regen pattern" — emphasize pre-edit baseline + post-edit verification

### Known issues impact
- **TD-F042-MULTI-VIEWER-VERIFY-DEFERRED** — F-044 inherits. Same risk class.
- **TD-F042-TEMPLATE-PLACEHOLDER-STATIC-AUDIT** — F-044 RESOLVES via BR-44-13 + BR-44-14 (extend regex + CONTEXT_KEYS).
- **TD-F042-COMM-STRATEGY-PHASE2** (HIGH business) — Combined F-042+F-044 batch (BR-44-16) reduces 2-strikes communication risk.
- **TD-F042-AUDIT-OUTPUT-GITIGNORE** — Inherit + extend cho F-044 output files.

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ được thay đổi các file/folder dưới đây.

### Backend modify (3 files)

- ✏️ `backend/src/modules/contracts/services/contracts.service.ts:1265-1300` — Add 1 new flatten key `remainingBalanceInWords` (~2 LoC)
- ✏️ `backend/src/modules/contracts/services/contracts.service.ts:1448` — `downloadDocument()` pass `contractNumber` + `raceName` to `buildDocumentFilename`
- ✏️ `backend/src/modules/contracts/utils/build-filename.ts` — Add 2 new input fields + HYBRID pattern branch + `sanitizeContractNumber()` helper (~30 LoC)
- ✏️ `backend/scripts/audit-template-placeholders.ts` — Extend HARDCODED_LEAK_REGEX (4 patterns) + CONTEXT_KEYS Set (+1 key)

### DOCX templates modify (5 files) + bonus typo fix

- ✏️ `backend/assets/contract-templates/contract-racekit.docx` — Mapping Table A (1 CN + 1 in-words)
- ✏️ `backend/assets/contract-templates/contract-operations.docx` — Mapping Table B (1 in-words)
- ✏️ `backend/assets/contract-templates/contract-ticket-sales.docx` — Mapping Table C (2 CN)
- ✏️ `backend/assets/contract-templates/acceptance-timing.docx` — Mapping Table D (2 in-words)
- ✏️ `backend/assets/contract-templates/acceptance-racekit.docx` — Mapping Table E (6 CN + 3 in-words + **3× `{advancePaid}`→`{remainingBalance}` typo fix per Adjustment #1**)
- ✏️ `backend/assets/contract-templates/acceptance-operations.docx` — Mapping Table F (2 in-words)

### Admin modify (2 files)

- ✏️ `admin/src/lib/contracts-api.ts` — Refactor `streamDownloadBlob()` return type `{ blob, filename }` per Adjustment #2
- ✏️ `admin/src/app/(dashboard)/contracts/_components/document-download-btn.tsx:75` — Apply filename from streamDownloadBlob response

### Backups (6 files NEW)

- ➕ `backend/assets/contract-templates/.backup/<type>-20260519-pre-f044.docx` × 6 per F-024 BACKUP_DIRNAME pattern

### Tests NEW (2 files)

- ➕ `backend/src/modules/contracts/services/document-generator.service.f044.spec.ts` — TC-44-01..09 (template content + in-words verification)
- ➕ `backend/src/modules/contracts/utils/build-filename.f044.spec.ts` — TC-44-07..09 (HYBRID filename pattern)
- ⚪ Extend existing `contracts.service.f042-context.spec.ts` — add TC-44-12..14 (remainingBalanceInWords flatten)

### ABSOLUTELY OUT OF SCOPE

- ❌ `payment-request.docx` (verified clean, NO changes)
- ❌ `quotation.xlsx` (different render path)
- ❌ `contract-timing.docx` (clean from F-044 patterns)
- ❌ DB schema/migration
- ❌ Reconciliation module (F-043 scope, separate branch)
- ❌ F-024 `audit-template-placeholders.ts` CORE structure — only extend regex + CONTEXT_KEYS Set, KHÔNG refactor whole file

**Estimated total: 9 modify + 2 NEW spec + 6 backup = 17 files**

---

## 🔧 Tech approach (Coder may refine)

### Template edit methodology — Python XML manipulation (F-042 pattern reuse)

```python
# F-044 fix_templates_phase2.py — extend F-042 fix_templates.py
REPLACEMENTS = {
    'contract-racekit': [
        # F-044 Mapping Table A
        (r'10\.04/2026/HĐDV/TAM-5BIB', '{contractNumber}', 0),
        (r'Ba mươi sáu triệu một trăm tám mươi nghìn đồng', '{totalAmountInWords}', 0),
    ],
    'acceptance-racekit': [
        # F-044 Mapping Table E (Adjustment #1 includes 3 typo fixes)
        (r'10\.04/2026/HĐDV/TAM-5BIB', '{contractNumber}', 0),  # 6 occurrences global
        (r'Ba mươi sáu triệu một trăm tám mươi nghìn đồng', '{totalAmountInWords}', 0),
        (r'Mười tám triệu không trăm chín mươi ngàn', '{remainingBalanceInWords}', 0),
        # Adjustment #1: typo fix (ordinal — 1st = keep, 2nd/3rd/4th = fix)
        # First replace ALL with {remainingBalance}, then revert 1st occurrence to {advancePaid}
        # Or use context-aware regex
        (r'tạm ứng cho Bên B: \{remainingBalance\}', 'tạm ứng cho Bên B: {advancePaid}', 0),  # revert tạm ứng
        # ↑ This requires first doing global {advancePaid}→{remainingBalance} then this revert
    ],
    # ... other tables
}
```

**Alternative cleaner approach for Adjustment #1:**

```python
# Use context-aware regex (specific sentence prefix)
'acceptance-racekit': [
    # Replace ONLY {advancePaid} in "còn lại" sentences (3 occurrences)
    (r'(còn phải thanh toán cho Bên B: )\{advancePaid\}', r'\1{remainingBalance}', 0),
    (r'(số tiền còn lại cho Bên B là )\{advancePaid\}', r'\1{remainingBalance}', 0),
    (r'(giá trị còn lại của hợp đồng[^{]*là: )\{advancePaid\}', r'\1{remainingBalance}', 0),
    # KEEP {advancePaid} in "tạm ứng cho Bên B" sentence (no change)
]
```

### Backend code change

- `buildRenderContext()` line 1265-1300 — add `remainingBalanceInWords: vndAmountInWords(...)` (1 line)
- `build-filename.ts` — extend Input interface + HYBRID branch + sanitize helper (~30 LoC)
- `downloadDocument()` line 1448 — pass new fields (3 LoC)

### Admin frontend change

- `streamDownloadBlob` refactor return shape (~10 LoC)
- `document-download-btn.tsx:75` apply filename (~3 LoC)

### Audit script extension

- Extend HARDCODED_LEAK_REGEX array với 3 new patterns
- Extend CONTEXT_KEYS Set với `remainingBalanceInWords`
- Output schema unchanged

---

## 🛑 PAUSE points cho Coder

- 🛑 **Trước commit template edits** — Run extended audit script (Adjustment #3) MUST report 0 hardcoded across 4 pattern classes. Nếu found any → STOP, investigate.
- 🛑 **Trước commit `streamDownloadBlob` refactor** — Verify với Network tab on local DEV: response Content-Disposition header preserved end-to-end via fetch.
- 🛑 **Nếu phát hiện thêm template với hardcoded text patterns KHÔNG trong Mapping Tables A-F** — STOP, escalate to Manager (extend scope).
- 🛑 **PROD audit + regen batch** (combined F-042+F-044) — Inherits F-042 PAUSE: Danny + Finance sign-off mandatory.

---

## 🧪 Unit test BẮT BUỘC (Coder phải viết)

Coder không được mark `READY_FOR_QC` nếu thiếu:

### `document-generator.service.f044.spec.ts`
- [ ] TC-44-01: Contract DOCX RACEKIT — contractNumber từ DB resolved, không có hardcoded
- [ ] TC-44-02: Contract DOCX OPERATIONS in-words computed
- [ ] TC-44-03: Contract DOCX TICKET_SALES — 2 CN positions both resolved
- [ ] TC-44-04: BBNT RACEKIT — 6 CN resolved + **3× remainingBalance typo fix verify với asymmetric split** (advancePaid=15M, remainingBalance=21M — 70/30 split → "còn lại" sentences show 21M not 15M)
- [ ] TC-44-05: BBNT TIMING — remainingBalanceInWords replaces hardcoded
- [ ] TC-44-06: BBNT OPERATIONS — remainingBalanceInWords resolved
- [ ] TC-44-07: Filename HYBRID happy path (Danny contract number `10.05/2026/HDDV/CTTFA-5BIB-6` + raceName + DocType → `10.05.2026.HDDV.CTTFA-5BIB-6 - <Race> - Hợp đồng.docx`)
- [ ] TC-44-08: Filename backward compat F-024 (contractNumber null → fallback pattern)
- [ ] TC-44-09: Filename sanitize edge cases (slash, long names, control chars)
- [ ] TC-44-10: Audit script post-fix grep zero hardcoded across 4 pattern classes
- [ ] TC-44-11: Audit script CONTEXT_KEYS verifies all flatten keys present
- [ ] TC-44-12: Context flatten remainingBalanceInWords resolves correctly
- [ ] TC-44-13: Context flatten edge remainingBalance = 0
- [ ] TC-44-14: Context flatten edge acceptanceReport null

### NEW Adjustment #1 specific
- [ ] TC-44-15 (MANDATORY): BBNT RACEKIT with asymmetric split — verify ALL "còn lại" sentences resolve to `{remainingBalance}` value (NOT `{advancePaid}`). Test fixture: totalAmount=100M, advancePaid=30M, remainingBalance=70M. Verify 3 "còn lại" occurrences show 70M.

### NEW Adjustment #2 specific
- [ ] TC-44-16 (MANDATORY): `streamDownloadBlob` returns `{ blob, filename }` — mock fetch response với Content-Disposition header → assert filename extracted correctly. Edge: missing header → filename = null. Edge: RFC 5987 `filename*=UTF-8''<vn-encoded>` → decoded VN preserved.

---

## 📊 Verdict

> ### ✅ APPROVED với 3 Critical Adjustments mandatory

**Lý do APPROVE:**

✅ Root cause identification thorough — extract document.xml × 6 templates produced exact position mapping
✅ Bug class taxonomy clear (4 distinct: numeric F-042 + contract number text + in-words + filename + placeholder typo)
✅ Pattern reuse F-042 (XML manipulation + audit + regen + extractDocxText) → fast Coder execution
✅ 18 BR + 6 Mapping Tables + 14 TC concrete
✅ ZERO breaking change, backward compat preserved
✅ Combined F-042+F-044 regenerate strategy resolves communication risk
✅ Manager Code Review post-spot-check found 2 gaps → resolvable via Adjustments (not full BA re-write)

**Lý do KHÔNG NEEDS_REVISION:**

- 2 gaps (Adjustment #1 + #2) are CONCRETE + actionable, NOT scope deficiency
- BA missed deeper grep (3 `{advancePaid}` typos) + streamDownloadBlob impl detail
- Adjustments add ~30 min Coder work, KHÔNG block fundamental plan
- F-044 is HIGH severity time-sensitive (legal/finance) — Adjustment path faster than NEEDS_REVISION cycle

**Coder PHẢI follow:**
- Adjustment #1: 3 `{advancePaid}` → `{remainingBalance}` typo fixes (not just 1)
- Adjustment #2: `streamDownloadBlob` refactor return `{blob, filename}` from Content-Disposition
- Adjustment #3: Run extended audit pre + post edit, report side-by-side in 03

---

## 🧷 Tech debt to track post-deploy (Manager note)

> Append to `known-issues.md` post-deploy:

- **TD-F044-MULTI-VIEWER-VERIFY-DEFERRED** (MED) — Inherit F-042 pattern, manual MS Word + LibreOffice + Google Docs check post-deploy
- **TD-F044-COMM-STRATEGY-PHASE2-COMBINED** (HIGH business) — F-042+F-044 combined batch + Finance team chốt re-send strategy trong 1 tuần
- **TD-F044-PROD-AUDIT-REGEN-DEFERRED** — Run extended audit + combined regen batch post-deploy (Danny + Finance sign-off)
- **TD-F044-RFC5987-FILENAME-CROSS-BROWSER** (LOW) — Verify Safari + Firefox + Edge handle `filename*=UTF-8''<encoded>` correctly cho VN diacritics. Edge cases like `Cát Tiên` may need special encoding.
- **TD-F042-TEMPLATE-PLACEHOLDER-STATIC-AUDIT** — F-044 RESOLVES (close this TD via BR-44-13/14)

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] **Yes** — Coder có thể bắt đầu với Scope Lock (17 files) + 3 Critical Adjustments mandatory + 4 PAUSE points + 16 unit tests
- 📝 **Note cho Coder:** Self-Review Pipeline 10 bước (Manager 2026-05-14 directive) MANDATORY. Đặc biệt:
  - Bước 3 anti-pattern scan: KHÔNG bỏ qua `{advancePaid}` audit (Adjustment #1)
  - Bước 7 real-world data: Use Danny contract `6a0bcab66042f47bde4eb9d7` semantic for TC-44-04 + TC-44-15 asymmetric split
  - Bước 8 Files Changed vs Scope Lock: 17 files maximum

---

## 🔗 Next step

Danny chạy: `/5bib-code FEATURE-044-contract-docx-phase-2-text-hardcoded-fix`

Coder (5bib-fullstack-engineer) sẽ:
1. Đọc 00 + 01 + 02 (this file) + memory + F-042 artifacts
2. Run extended audit script BASELINE (pre-edit) — capture report
3. Edit 6 DOCX templates via Python pattern (extending F-042 fix_templates.py) — include Adjustment #1 typo fixes
4. Backend `buildRenderContext()` flatten + `buildDocumentFilename` HYBRID + `downloadDocument` call extension
5. Admin `streamDownloadBlob` refactor + `document-download-btn.tsx` filename apply (Adjustment #2)
6. Audit script extension (regex + CONTEXT_KEYS)
7. Run extended audit POST-edit — verify zero hardcoded across 4 pattern classes
8. Write 16 unit tests (TC-44-01..16)
9. Self-Review Pipeline 10 bước
10. Output `03-coder-implementation.md` status `🟠 READY_FOR_QC`

**Estimated Coder workload:** ~3-4 hours (F-042 pattern reuse fast)
- ~15 min: Run baseline audit + capture report
- ~45 min: Edit 6 DOCX templates (include 3× typo context-aware regex)
- ~30 min: Backend code (flatten 1 LoC + filename ~30 LoC + service call 3 LoC)
- ~30 min: Admin `streamDownloadBlob` refactor + caller update + Content-Disposition parser helper
- ~20 min: Audit script extension
- ~1h: Unit tests (16 TC)
- ~20 min: Self-Review Pipeline + documentation
