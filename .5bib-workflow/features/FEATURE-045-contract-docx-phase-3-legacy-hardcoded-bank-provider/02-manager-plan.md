# FEATURE-045: Plan Review — Contract DOCX Phase 3 Legacy Hardcoded Bank+Provider Fix

**Status:** ✅ APPROVED với 3 Adjustments mandatory
**Reviewed:** 2026-05-19
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check (Manager)

- [x] Đọc `00-manager-init.md` + `01-ba-prd.md` đầy đủ
- [x] Đọc memory: `architecture.md` (no impact), `conventions.md` (F-044 DOCX content review protocol applies), `known-issues.md` (TD-F044-LEGACY-HARDCODED-BANK-PROVIDER → F-045 resolves)
- [x] **MANDATORY spot-check code thật (skill 2026-05-17):**
  - `provider-entities.ts` F-030 registry — verified `bankAccount` + `bankName` + `entityName` + `taxId` + `address` + `representative` + `position` shape đầy đủ cho 5BIB + 5SOLUTION
  - `contracts.service.ts:1242-1243` — verified `provider: contract.provider` spread đầy đủ ProviderEntity → `{provider.*}` placeholders render correctly
  - 4 template document.xml grep — verified Mapping Tables A-D positions exact
  - **Bonus discovery beyond BA inventory:** `acceptance-operations.docx` HARDCODES `Mã số thuế: 0111213998` (1 occurrence) while other 3 affected templates đã dùng `{provider.taxId}` correctly

---

## ✓ PRD Validation Checklist

| Item | Status |
|------|--------|
| User Stories đầy đủ (5 personas + multi-provider context) | ✅ |
| 15 BR-45-01..15 có ID, testable | ✅ |
| 5 Mapping Tables A-E concrete với positions exact | ✅ |
| 10 TC-45-XX backend + 4 E2E-45-XX | ✅ |
| Multi-provider TC-45-03/04 (override scenarios) | ✅ critical |
| Backward compat F-024+F-042+F-044 preserved (BR-45-06) | ✅ |
| ZERO DB schema/migration | ✅ |
| F-030 registry unchanged (BR-45-07) | ✅ |
| Audit script Class 5+6 extension | ✅ |
| 3 PAUSE answers (service label, regex precision, scope expansion BR-45-09/10) | ✅ |

---

## 🚨 3 Adjustments — Coder MANDATORY

### Adjustment #1: Add taxId hardcoded fix to scope (Manager spot-check bonus)

Manager grep phát hiện `acceptance-operations.docx` có:
```
Bên B: ... Mã số thuế: 0111213998. Đại diện: {provider.representative} - Chức vụ: ...
```

Hardcoded `Mã số thuế: 0111213998` (taxId 5SOLUTION). Other 3 affected templates đã dùng `{provider.taxId}` correctly. Extension scope: thêm 1 replacement.

**Coder PHẢI:**
- Add `Mã số thuế: 0111213998` → `Mã số thuế: {provider.taxId}` to REPLACEMENTS map for acceptance-operations
- New BR-45-16 (implicit): taxId hardcoded eliminate
- Test in TC-45-02 add assertion: contain `0111213998` (rendered from {provider.taxId}) AT POSITION "Mã số thuế:" only — NOT bank account (different field).

### Adjustment #2: taxId substring collision regex SAFETY (PAUSE-45-02)

**Risk verified:** `acceptance-operations.docx` text:
- Position 1: `Mã số thuế: 0111213998` (taxId field — embedded 9-digit `111213998`)
- Position 2: `Tài khoản: 111213998 - tại MB chi nhánh Hai Bà Trưng`
- Position 3: `Số tài khoản: 111213998 Tại ngân hàng: ...`

**Coder PHẢI dùng context-anchored regex:**

```python
'acceptance-operations': [
    # Adjustment #1: taxId fix FIRST (replace `0111213998` → `{provider.taxId}`)
    # Pattern: 'Mã số thuế: 0111213998' → 'Mã số thuế: {provider.taxId}'
    (r'Mã số thuế: 0111213998', 'Mã số thuế: {provider.taxId}', 0),
    # Bank account fix — context-anchored (Tài khoản: + Số tài khoản:)
    (r'Tài khoản: 111213998', 'Tài khoản: {provider.bankAccount}', 0),
    (r'Số tài khoản: 111213998', 'Số tài khoản: {provider.bankAccount}', 0),
    # NOT use bare `\b111213998\b` — would also replace taxId substring
    # ... other replacements
],
```

**Order critical:** taxId fix MUST run BEFORE bank account fix (else "0" prefix collision). After taxId replacement, `0111213998` → `{provider.taxId}` → only `111213998` (bare 9-digit) remains in bank-account contexts.

### Adjustment #3: Multi-provider render verify spec MANDATORY (F-044 lesson)

Per `conventions.md` "DOCX Template Content Review Protocol":
- Coder MUST extend `f044-manager-render-verify.spec.ts` (rename → `f045-multi-provider-verify.spec.ts` OR add new spec) với render 4 templates × 2 provider variants = 8 outputs
- Output files `.txt` to `/tmp/f045-render-verify/output/`
- Manager eyeball read POST-Coder phase

**Test fixtures:**
- 5BIB provider variant: `getProviderEntity('5BIB')` — bank `110398986`, branch `MB - Chi nhánh Thụy Khuê`, entity `CÔNG TY CỔ PHẦN 5BIB`, taxId `0110398986`
- 5SOLUTION provider variant: `getProviderEntity('5SOLUTION')` — bank `111213998`, branch `MB - Chi nhánh Hai Bà Trưng`, entity `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION`, taxId `0111213998`

**Critical verifications:**
- TC-45-03/04 OVERRIDE scenarios: RACEKIT contract với providerId override 5SOLUTION → verify 5SOLUTION data rendered, NO 5BIB residual leak
- All rendered output `.txt` files Manager đọc qua trước `/5bib-deploy` close

---

## 📋 Files được phép thay đổi (Scope Lock)

### Backend modify (1 file)
- ✏️ `backend/scripts/audit-template-placeholders.ts` — Extend HARDCODED_LEAK_PATTERNS với Class 5+6 (bank account + bank branch + provider name 4 variants) + verify Class 6 negative-lookahead pattern avoid false-positive

### DOCX templates modify (4 files)
- ✏️ `backend/assets/contract-templates/acceptance-racekit.docx` — Mapping Table A (10 replacements + BR-45-10 service label)
- ✏️ `backend/assets/contract-templates/acceptance-timing.docx` — Mapping Table B (9 replacements — no service label fix)
- ✏️ `backend/assets/contract-templates/acceptance-operations.docx` — Mapping Table C (12 replacements + Adjustment #1 taxId + BR-45-09 service label)
- ✏️ `backend/assets/contract-templates/contract-ticket-sales.docx` — Mapping Table D (3 replacements — single complex line rewrite)

### Backups (4 NEW files)
- ➕ `backend/assets/contract-templates/.backup/<type>-20260519-pre-f045.docx` × 4

### Tests NEW (3 files)
- ➕ `backend/src/modules/contracts/services/document-generator.service.f045.spec.ts` — TC-45-01..07 (multi-provider rendering + override scenarios)
- ➕ `backend/src/modules/contracts/services/audit-script.f045.spec.ts` — TC-45-08 (Class 5+6 audit verify post-edit)
- ➕ `backend/src/modules/contracts/services/f045-multi-provider-render-verify.spec.ts` — Manager content review tool: render 4 × 2 = 8 outputs

### ABSOLUTELY OUT OF SCOPE
- ❌ `contract-timing.docx` (verified CLEAN, no F-045 hardcoded)
- ❌ `contract-racekit.docx` + `contract-operations.docx` (F-044 already done)
- ❌ `payment-request.docx` (verify clean — out of scope)
- ❌ `quotation.xlsx` (Excel separate render path)
- ❌ `provider-entities.ts` F-030 registry (no change)
- ❌ Backend service/util code (NO change needed — `{provider.*}` placeholders already wired in F-024 buildRenderContext line 1242)
- ❌ Admin frontend (NO change)
- ❌ DB schema, migration

**Estimated total: 1 modify (audit script) + 4 modify (templates) + 4 backup + 3 NEW spec = 12 files**

---

## 🔧 Tech approach (Coder refine)

### Python XML manipulation (F-044 pattern reuse)

`/tmp/docx-extract/fix_templates_f045.py` extends F-044 pattern. **Order critical:**

```python
REPLACEMENTS = {
    'acceptance-racekit': [
        # 1. Bank account FIRST (no taxId collision in this template)
        (r'110398986', '{provider.bankAccount}', 0),
        # 2. Bank branch
        (r'MB chi nhánh Thụy Khuê', '{provider.bankName}', 0),
        # 3. Provider name UPPER-case (2 positions)
        (r'CÔNG TY CỔ PHẦN 5BIB', '{provider.entityName}', 0),
        # 4. Provider name proper-case (3 positions)
        (r'Công ty Cổ phần 5BIB', '{provider.entityName}', 0),
        # 5. Service label fix BR-45-10
        (r'về dịch vụ tính giờ Hôm nay', 'về vận hành racekit Hôm nay', 0),
    ],
    'acceptance-timing': [
        # Same as racekit MINUS service label fix
        (r'110398986', '{provider.bankAccount}', 0),
        (r'MB chi nhánh Thụy Khuê', '{provider.bankName}', 0),
        (r'CÔNG TY CỔ PHẦN 5BIB', '{provider.entityName}', 0),
        (r'Công ty Cổ phần 5BIB', '{provider.entityName}', 0),
        # KHÔNG đụng "dịch vụ tính giờ" (CORRECT for TIMING)
    ],
    'acceptance-operations': [
        # Adjustment #1: taxId FIRST (avoid collision with bank account regex)
        (r'Mã số thuế: 0111213998', 'Mã số thuế: {provider.taxId}', 0),
        # Bank account context-anchored (Adjustment #2)
        (r'Tài khoản: 111213998', 'Tài khoản: {provider.bankAccount}', 0),
        (r'Số tài khoản: 111213998', 'Số tài khoản: {provider.bankAccount}', 0),
        # Bank branch
        (r'MB chi nhánh Hai Bà Trưng', '{provider.bankName}', 0),
        # Provider name (7 positions)
        (r'CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION', '{provider.entityName}', 0),
        # Service label fix BR-45-09
        (r'về dịch vụ tính giờ Hôm nay', 'về vận hành Hôm nay', 0),
    ],
    'contract-ticket-sales': [
        # Single complex line rewrite (Table D)
        (r'Tài khoản số : 110398986 tại Ngân hàng TMCP Quân Đội \(MB\) – Chi nhánh Thụy Khuê – Chủ tài khoản: CONG TY CO PHAN 5BIB',
         'Tài khoản số : {provider.bankAccount} tại {provider.bankName} – Chủ tài khoản: {provider.entityName}', 0),
    ],
}
```

### Audit script extension

```typescript
// Class 5 (bank account exact match)
/\b110398986\b/,
/\b111213998\b/,
// Class 6 (bank branch + provider name)
/MB chi nhánh (Thụy Khuê|Hai Bà Trưng)/,
/Ngân hàng TMCP Quân Đội \(MB\) – Chi nhánh/,
/CÔNG TY CỔ PHẦN 5BIB(?!\s+KH)/,  // negative lookahead exclude false-positive
/CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION/,
/Công ty Cổ phần 5BIB/,
/CONG TY CO PHAN 5BIB/,
```

**Note:** `\b111213998\b` will match Class 5 — but Class 5 is for POST-fix audit (templates after edit should have ZERO bare `111213998` outside placeholder). Class 5 must NOT trigger on `0111213998` taxId substring → use `\b` word boundary which won't match inside `0111213998` (digit-to-digit no boundary). Verified safe.

---

## 🛑 PAUSE points cho Coder

- 🛑 **Order critical:** acceptance-operations replacements MUST run in declared order (taxId before bank account). Verify post-fix grep: `0111213998` count = 0 AND `111213998` count = 0 AND `{provider.taxId}` count ≥ 1 AND `{provider.bankAccount}` count ≥ 2.
- 🛑 **Multi-provider render verify MANDATORY** — Manager will reject deploy nếu thiếu render spec với 5BIB + 5SOLUTION variants per template.
- 🛑 **F-042+F-044 regression preserved** — Coder run `npx jest --testPathPattern="modules/contracts"` MUST PASS 238+/238+ (no regression).
- 🛑 **Combined F-042+F-044+F-045 regen batch** — Danny + Finance team approve scope before PROD execution (inherited PAUSE).

---

## 🧪 Unit test BẮT BUỘC (Coder phải viết)

Coder không được mark `READY_FOR_QC` nếu thiếu:

### `document-generator.service.f045.spec.ts`
- [ ] TC-45-01: acceptance-racekit RACEKIT 5BIB → render 5BIB data correctly
- [ ] TC-45-02: acceptance-operations OPERATIONS 5SOLUTION → render 5SOLUTION data + Mã số thuế 0111213998 (from {provider.taxId}) + Tài khoản 111213998 (from {provider.bankAccount})
- [ ] TC-45-03: acceptance-racekit RACEKIT với provider OVERRIDDEN 5SOLUTION → render 5SOLUTION data, NO 5BIB residual
- [ ] TC-45-04: acceptance-operations OPERATIONS với provider OVERRIDDEN 5BIB → render 5BIB data, NO 5SOLUTION residual
- [ ] TC-45-05: acceptance-timing TIMING 5BIB → render 5BIB data + service label "dịch vụ tính giờ" PRESERVED
- [ ] TC-45-06: contract-ticket-sales TICKET_SALES 5BIB → single complex line renders correctly
- [ ] TC-45-07: Edge contract.provider field incomplete → empty render gracefully (no crash)

### `audit-script.f045.spec.ts`
- [ ] TC-45-08: Audit script post-fix reports 0 hardcoded across Class 5+6 (bank account + bank branch + provider name 4 variants)
- [ ] Class 5+6 patterns explicit in audit script source

### `f045-multi-provider-render-verify.spec.ts`
- [ ] Render 4 templates × 2 providers = 8 outputs → write `/tmp/f045-render-verify/output/*.txt`
- [ ] Manager content review file count assertion

### F-042+F-044 regression
- [ ] TC-45-09: F-044 HYBRID filename pattern preserved
- [ ] TC-45-10: F-042+F-044 BUGFIX#1 (số khớp chữ) + Adjustment #1 typo fix preserved
- [ ] Full contracts module test suite: 238+ tests PASS (zero regression)

---

## 📊 Cross-check với memory

### Architecture impact
- ✅ ZERO change. F-045 = template binary fix + audit script regex extension.

### Convention impact
- ⚠️ Reaffirms F-044 DOCX Content Review Protocol (multi-provider mandatory) — Manager sẽ update `conventions.md` post-deploy:
  - Section "Audit script regex extension protocol" — add Class 5+6 patterns to reusable list
  - Section "DOCX provider data render verification" — multi-provider fixture mandatory

### Known issues impact
- **TD-F044-LEGACY-HARDCODED-BANK-PROVIDER** — F-045 RESOLVES (close TD post-deploy)
- **TD-F044-COMM-STRATEGY-PHASE2-COMBINED** — F-045 inherits HIGH biz priority (combined F-042+F-044+F-045 regen batch + merchant comm)
- **TD-F044-PROD-AUDIT-REGEN-DEFERRED** — F-045 expands scope (Class 5+6 audit detects superset of providers)

---

## 📊 Verdict

> ### ✅ APPROVED với 3 Adjustments mandatory

**Lý do APPROVE:**
- ✅ PRD comprehensive — 15 BR + 5 Mapping Tables + 10 TC + 4 E2E
- ✅ Multi-provider critical TC-45-03/04 catches override scenarios
- ✅ ZERO DB/architecture impact — pure template + audit extension
- ✅ Pattern reuse F-044 fast execution
- ✅ Backward compat preserved

**3 Adjustments are concrete + actionable:**
- #1: taxId fix bonus scope (+1 replacement in acceptance-operations)
- #2: Regex order/context-anchored to avoid taxId substring collision
- #3: Multi-provider render verify spec mandatory (F-044 lesson enforce)

**Estimated Coder workload:** ~2-3h (F-044 pattern reuse compound)
- ~10 min: Run baseline audit + capture pre-edit count
- ~30 min: Python XML manipulation 4 templates (with order-critical fixes)
- ~15 min: Audit script Class 5+6 extension
- ~30 min: Multi-provider render verify spec (8 outputs)
- ~45 min: F-045 spec files (TC-45-01..07 + TC-45-08 + regression)
- ~15 min: Manager content review post-Coder
- ~15 min: Self-Review Pipeline

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] **Yes** — Coder bắt đầu với Scope Lock (12 files) + 3 Adjustments mandatory + 4 PAUSE points + 10+ unit tests

---

## 🔗 Next step

Danny chạy: `/5bib-code FEATURE-045-contract-docx-phase-3-legacy-hardcoded-bank-provider`
