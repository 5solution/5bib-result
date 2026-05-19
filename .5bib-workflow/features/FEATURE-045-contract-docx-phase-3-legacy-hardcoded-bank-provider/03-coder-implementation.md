# FEATURE-045: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC
**Started + Completed:** 2026-05-19
**Author:** 5bib-fullstack-engineer (run by Manager orchestrator)
**Linked:** `00-manager-init.md`, `01-ba-prd.md`, `02-manager-plan.md`

---

## 📌 Pre-flight check

- [x] Read all 00/01/02 + memory `conventions.md` (F-044 DOCX Content Review Protocol) + `codebase-map.md`
- [x] Spot-check `provider-entities.ts` F-030 registry — verified ProviderEntity shape (bankAccount + bankName + entityName + taxId all present cho 5BIB + 5SOLUTION)
- [x] Spot-check `contracts.service.ts:1242` — verified `provider: contract.provider` spread chain → `{provider.*}` placeholders render correctly
- [x] Read code thật 5 template document.xml via Python pizzip extract

---

## 🔍 Impact Assessment

### Backend
- ❌ NO code change in service/util — `{provider.*}` placeholders đã wired in F-024 buildRenderContext
- ✅ Audit script `audit-template-placeholders.ts` extended +24 LoC (Class 5+6 regex patterns)

### Frontend
- ❌ NO admin change — F-044 streamDownloadBlob + HYBRID filename unchanged

### API Contract
- ❌ NO DTO/endpoint change — zero SDK regen needed

### Templates (binary)
- 5 DOCX files modified (4 BA inventory + 1 Manager Adjustment extension: `contract-operations.docx`)
- 5 backup files at `.backup/<type>-20260519-pre-f045.docx`

---

## ⚠️ Edge Cases Covered

1. **taxId substring collision** (Adjustment #2): `0111213998` taxId contains `111213998` bank account substring. Mitigated bằng context-anchored regex (taxId fix FIRST, then bank account with context prefix `Tài khoản:` / `Số tài khoản:`).
2. **XML run-split for service label**: Word splits `về dịch vụ tính giờ` ↔ `Hôm nay` across `</w:p>` paragraph boundary. Workaround: pattern `về dịch vụ tính giờ</w:t>` (match within run only).
3. **XML run-split for contract-ticket-sales complex line**: Prefix `Tài khoản số : ` lives in separate run from bank info. Pattern starts at `110398986` (drop prefix).
4. **Multi-provider OVERRIDE scenarios**: TC-45-03/04 verify RACEKIT contract with override 5SOLUTION → ZERO 5BIB residual; OPERATIONS contract with override 5BIB → ZERO 5SOLUTION residual.
5. **acceptance-timing TIMING service label preserved**: BR-45-11 — KEEP `dịch vụ tính giờ` (correct for TIMING template).
6. **Manager scope extension**: `contract-operations.docx` discovered có 5SOLUTION hardcoded out of BA inventory → added to Coder scope.

---

## 🧠 Logic & Architecture

**Why Python XML manipulation (reuse F-044 pattern):** docxtemplater can't be used to modify templates themselves (it renders them); pizzip extract → regex → repack is established F-042/F-044 workflow.

**Why context-anchored regex over bare `\b\d{9}\b`:** Avoid taxId `0111213998` substring collision với bank `111213998`. Order critical: taxId fix MUST run BEFORE bank account fix.

**Why match within `<w:t>...</w:t>` boundary:** Word XML often splits text across multiple `<w:r>` runs (formatting changes). Match within run = guaranteed atomic replacement, no cross-run issues.

**Why extend audit Class 5+6 separate from Class 1-4:** Class 1 catches legacy F-024 sample text (different domain); Class 5+6 specifically targets F-045 provider data leaks. Granular detection enables debugging.

---

## 💻 Files Changed

### Backend modify (1 file)
- ✏️ `backend/scripts/audit-template-placeholders.ts` (+24 LoC) — Class 5+6 regex patterns

### DOCX templates modify (5 files)
- ✏️ `backend/assets/contract-templates/acceptance-racekit.docx` — 10 replacements (5 provider + 2 bank acct + 2 branch + 1 service label fix)
- ✏️ `backend/assets/contract-templates/acceptance-timing.docx` — 9 replacements (same as racekit MINUS service label, TIMING preserves "dịch vụ tính giờ")
- ✏️ `backend/assets/contract-templates/acceptance-operations.docx` — 13 replacements (7 provider + 2 bank acct + 2 branch + 1 service label + 1 taxId Adjustment #1)
- ✏️ `backend/assets/contract-templates/contract-ticket-sales.docx` — 1 complex line rewrite (bank acct + branch + entity)
- ✏️ `backend/assets/contract-templates/contract-operations.docx` (Manager scope extension) — 7 replacements (2 provider + 2 bank acct + 1 branch + 2 taxId)

### Backups (5 NEW files)
- ➕ `backend/assets/contract-templates/.backup/<type>-20260519-pre-f045.docx` × 5

### Tests NEW (3 files)
- ➕ `backend/src/modules/contracts/services/document-generator.service.f045.spec.ts` — TC-45-01..07 + regression TC-45-09/10 (9 test cases)
- ➕ `backend/src/modules/contracts/services/audit-script.f045.spec.ts` — TC-45-08 across 5 templates + audit script source verification (11 it() blocks)
- ➕ `backend/src/modules/contracts/services/f045-multi-provider-render-verify.spec.ts` — Manager content review tool: render 5 × 2 = 10 outputs

### Ops scripts (not committed, per F-042/F-044 convention)
- 🐍 `/tmp/docx-extract/fix_templates_f045.py` — Python XML manipulation script

---

## 🧪 Tests Written + PASS output

### F-045 spec suites
```
PASS src/modules/contracts/services/document-generator.service.f045.spec.ts
PASS src/modules/contracts/services/audit-script.f045.spec.ts
PASS src/modules/contracts/services/f045-multi-provider-render-verify.spec.ts

Test Suites: 3 passed, 3 total
Tests:       21 passed, 21 total
Time:        2.425 s
```

### Full contracts module regression
```
Test Suites: 26 passed, 26 total
Tests:       259 passed, 259 total
Time:        7.366 s
```

→ **259/259 tests PASS** (21 NEW F-045 + 238 F-024/F-042/F-044 regression — ZERO regression)

### Audit verification (extended Class 5+6)
```
Missing in context: 0
Extra in context: 52
Hardcoded leaks (unique): 0
```

→ **Zero hardcoded leaks across ALL 6 pattern classes** (F-042 numeric + F-044 CN slash + F-044 CN dash + F-044 in-words + F-045 bank account + F-045 bank branch + F-045 provider name).

### Manager render review (10 outputs)

Renderer wrote `/tmp/f045-render-verify/output/*.txt` × 10. Key verified per output:

| Template | Provider | Status |
|----------|----------|--------|
| acceptance-racekit | 5BIB (default) | ✅ Service label "vận hành racekit" + 5BIB data |
| acceptance-racekit | 5SOLUTION (override) | ✅ 5SOLUTION data, ZERO 5BIB residual |
| acceptance-timing | 5BIB | ✅ "dịch vụ tính giờ" PRESERVED + 5BIB data |
| acceptance-timing | 5SOLUTION (override) | ✅ 5SOLUTION data, ZERO 5BIB residual |
| acceptance-operations | 5SOLUTION (default) | ✅ Service label "vận hành" + 5SOLUTION data + taxId 0111213998 |
| acceptance-operations | 5BIB (override) | ✅ 5BIB data, ZERO 5SOLUTION residual |
| contract-ticket-sales | 5BIB | ✅ Bank line "110398986 tại MB - Chi nhánh Thụy Khuê – Chủ tài khoản: CÔNG TY CỔ PHẦN 5BIB" |
| contract-ticket-sales | 5SOLUTION (override) | ✅ 5SOLUTION variant correct |
| contract-operations | 5SOLUTION | ✅ MST 0111213998 + bank 111213998 + provider 5SOLUTION |
| contract-operations | 5BIB (override) | ✅ Override 5BIB data correct |

---

## 🛑 PAUSE/Confirmation log

| Date | What | Outcome |
|------|------|---------|
| 2026-05-19 | Manager Adjustment #1 taxId fix | Applied (acceptance-operations `Mã số thuế: 0111213998`) |
| 2026-05-19 | Manager Adjustment #2 regex order/context | Applied (taxId BEFORE bank account, context-anchored patterns) |
| 2026-05-19 | Manager Adjustment #3 multi-provider render verify | Applied (`f045-multi-provider-render-verify.spec.ts` 10 outputs) |
| 2026-05-19 | Manager scope extension: contract-operations | Applied (+1 template, +7 replacements) |
| Pending | Combined F-042+F-044+F-045 regen batch | Defer to /5bib-deploy + Finance sign-off |

---

## 🚧 Scope creep / Out-of-Scope changes

- ✅ Manager-approved scope extension: `contract-operations.docx` added (NOT in BA original inventory, discovered by Manager spot-check audit). Documented as Adjustment in `02-manager-plan.md`.
- ✅ ALL other changes within Manager Plan Scope Lock.

---

## 🐛 Known limitations / Tech debt

- **TD-F045-PROD-AUDIT-REGEN-DEFERRED** — Combined F-042+F-044+F-045 regen batch on PROD (HIGH biz priority, inherited from F-044 + extended scope)
- **TD-F045-MULTI-VIEWER-VERIFY** — Manual MS Word + LibreOffice + Google Docs verify post-deploy (inherited from F-044 pattern)
- **TD-F045-CONTRACT-OPERATIONS-ROW-FORMAT** (LOW) — In Phương thức thanh toán section, line "Tài khoản: {provider.bankAccount}" có trailing space original. Not visible bug, ignored.

---

## ✅ Self-Review Pipeline (Manager 2026-05-14 mandatory)

- [x] Bước 1: tsc + lint clean cho Scope Lock files
- [x] Bước 2: PRD strict adherence audit (15 BR-45-* matched + 5 Mapping Tables + 10 TC + 4 E2E)
- [x] Bước 3: Anti-pattern scan clean (no console.log/any/as unknown in F-045 spec files)
- [x] Bước 4: Hand-pick field mapping audit (N/A — no new schema field)
- [x] Bước 5: PROD-readiness — 259/259 tests PASS, audit zero hardcoded
- [x] Bước 6: UI/UX self-inspection (N/A — no UI change)
- [x] Bước 7: Real-world data — fixtures use F-030 registry + asymmetric 30/70 split + multi-provider variants
- [x] Bước 8: Files Changed vs Scope Lock — 17 files (5 modify + 1 audit script + 3 NEW spec + 5 backup + 1 ops + 2 mgmt docs), all justified
- [x] Bước 9: Generated SDK regen — N/A (zero DTO change)
- [x] Bước 10: Unit tests PASS output paste — DONE

→ Status: 🟠 READY_FOR_QC

---

## 🔗 Next step

QC `/5bib-qc FEATURE-045-...` sẽ run independent verification + Manager render review + deploy gate.
