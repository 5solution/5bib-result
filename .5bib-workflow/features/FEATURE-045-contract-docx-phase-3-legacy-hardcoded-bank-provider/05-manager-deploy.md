# FEATURE-045: Deploy & Memory Sync

**Status:** ✅ DONE (code-level)
**Deployed:** 2026-05-19
**Author:** 5bib-manager
**Linked:** 00–04 + this 05

---

## 📌 Pre-flight check (Manager)

- [x] `04-qc-report.md` verdict = ✅ APPROVED
- [x] Coder unit tests PASS (21/21 F-045 + 259/259 module regression)
- [x] Files changed match Manager Plan Scope Lock + 1 approved scope extension (contract-operations)
- [x] Tech debt tracked in `04-qc-report.md` for known-issues.md sync

---

## 📊 Deploy summary

| Metric | Value |
|--------|-------|
| **QC verdict** | ✅ APPROVED |
| **Unit tests** | 259/259 PASS (26 suites — 21 NEW F-045 + 238 F-024/F-042/F-044 regression) |
| **Audit script** | `Hardcoded leaks (unique): 0` across **6 pattern classes** (Class 1 legacy + Class 2 vi-VN currency + Class 3 CN slash + Class 3 CN dash + Class 4 in-words + **Class 5 bank account NEW** + **Class 6 bank branch + provider name NEW**) |
| **Manager render review** | 10 outputs (5 templates × 2 provider variants) — all PASS eyeball |
| **Multi-provider override scenarios** | TC-45-03/04 verified ZERO residual cross-leak |
| **Branch** | `feat/F-044-contract-docx-phase-2` (extended with F-045 commits) |
| **PROD deploy** | Pending Danny push + combined F-042+F-044+F-045 regen batch with Finance team |

---

## 🔬 Manager Independent Code Review

> Skill MANDATE 2026-05-17 — Manager review 5 critical paths independently.

### 1. `backend/scripts/audit-template-placeholders.ts` (+24 LoC)

**Reviewed:** Class 5+6 regex extension
- ✅ Class 5 bank account: `\b110398986\b` + `\b111213998\b` (exact match F-030 values — KHÔNG generic `\d{9}` để avoid false-positive với phone/MST)
- ✅ Class 6 bank branch: `MB chi nhánh (Thụy Khuê|Hai Bà Trưng)` + `Ngân hàng TMCP Quân Đội \(MB\) – Chi nhánh`
- ✅ Class 6 provider name: 4 variant exact match với negative lookahead `(?!\s+KHÔNG)` để avoid placeholder default articles
- ✅ Pattern ordering preserved — Class 1-4 (F-042/F-044) before Class 5-6 (F-045)
- ✅ No regression: existing 9 templates audit still works

**Verdict:** ✅ APPROVED

### 2. `backend/assets/contract-templates/acceptance-racekit.docx` (binary, 10 replacements)

**Reviewed:** Render output `acceptance-racekit-5BIB.txt` + `acceptance-racekit-5SOLUTION-override.txt`
- ✅ 5BIB variant: `CÔNG TY CỔ PHẦN 5BIB` × 7 + bank `110398986` + branch `MB - Chi nhánh Thụy Khuê` + service label `vận hành racekit`
- ✅ 5SOLUTION override variant: ALL fields swap correctly, ZERO 5BIB residual
- ✅ F-044 Adjustment #1 typo fix preserved (3× `{remainingBalance}` "còn lại" sentences render 39M not 15M)
- ✅ F-044 BR-44-03 placeholder typo fix preserved

**Verdict:** ✅ APPROVED

### 3. `backend/assets/contract-templates/acceptance-operations.docx` (binary, 13 replacements)

**Reviewed:** Adjustment #1 taxId fix + Adjustment #2 regex order + service label fix
- ✅ Adjustment #1: `Mã số thuế: 0111213998` → `{provider.taxId}` resolved → renders correct taxId per provider (0111213998 5SOLUTION, 0110398986 5BIB)
- ✅ Adjustment #2: taxId fix run BEFORE bank account regex → ZERO collision
- ✅ Service label BR-45-09: `về dịch vụ tính giờ Hôm nay` → `về vận hành Hôm nay` applied via XML run-split workaround
- ✅ 7 provider name occurrences → `{provider.entityName}`

**Verdict:** ✅ APPROVED

### 4. `backend/assets/contract-templates/contract-operations.docx` (binary, 7 replacements — Manager scope extension)

**Reviewed:** Out-of-BA-inventory scope extension
- ✅ Discovered by Manager spot-check audit (`Hardcoded leaks: 2` initial post-edit)
- ✅ Patterns context-anchored using XML run boundaries (`<w:t>MST: 0111213998</w:t>` exact)
- ✅ 2 provider name positions (Bên B + Chủ tài khoản) + 2 taxId positions (logo MST + Mã số thuế field) + 2 bank account positions + 1 bank name position
- ✅ Render verify `contract-operations-5BIB-override.txt` + `contract-operations-5SOLUTION.txt`: ALL provider data swaps correctly

**Verdict:** ✅ APPROVED

### 5. `backend/assets/contract-templates/contract-ticket-sales.docx` (binary, 1 complex line)

**Reviewed:** Single complex line rewrite
- ✅ XML run structure: text in single run `<w:t>110398986 tại Ngân hàng TMCP Quân Đội (MB) – Chi nhánh Thụy Khuê – Chủ tài khoản: CONG TY CO PHAN 5BIB</w:t>`
- ✅ Pattern dropped prefix `Tài khoản số :` (lives in separate run upstream) — matches starting at `110398986`
- ✅ Render verify `contract-ticket-sales-5BIB.txt`: line renders `{provider.bankAccount} tại {provider.bankName} – Chủ tài khoản: {provider.entityName}` → correct provider data

**Verdict:** ✅ APPROVED

### Manager Code Review Summary

| Area | LoC | Verdict |
|------|----:|---------|
| Audit script | +24 | ✅ APPROVED |
| 5 DOCX templates | binary | ✅ APPROVED |
| 3 NEW spec files | ~600 | ✅ APPROVED (multi-provider TC + audit verify + render verify) |

**Final Manager Code Review verdict:** ✅ APPROVED — production-ready. No red flags.

---

## 📝 Memory diff (applied)

### `feature-log.md`
- ✏️ Counter: `FEATURE-046` → `FEATURE-046` (no increment — F-045 was already initialized)
- ➕ F-045 entry appended to TOP of Shipped table

### `change-history.md`
- ➕ Full F-045 entry với files + tests + Adjustments + lessons learned

### `codebase-map.md`
- (No structural change — F-045 pure template + audit script extension)

### `architecture.md`
- (No change — no service decomposition)

### `conventions.md`
- ✏️ Reaffirms DOCX Content Review Protocol (F-044 lesson) — F-045 demonstrates protocol works
- ➕ NEW pattern: Multi-provider DOCX render verify (asymmetric provider override scenarios mandatory)
- ➕ NEW pattern: Audit script Class 5+6 reusable regex set (bank account + bank branch + provider name)

### `known-issues.md`
- ✅ RESOLVED: TD-F044-LEGACY-HARDCODED-BANK-PROVIDER (F-045 closes)
- ➕ 4 TDs tracked: PROD-AUDIT-REGEN, MULTI-VIEWER-VERIFY, PYTHON-FIX-NOT-COMMITTED, CONTRACT-OPERATIONS-ROW-FORMAT
- ✏️ TD-F044-COMM-STRATEGY-PHASE2-COMBINED — extended scope to F-042+F-044+F-045 single comm cycle

---

## 🔮 Follow-up cho feature kế tiếp

### Combined F-042+F-044+F-045 deploy (Option B chốt 2026-05-19)

Single release branch `release/v1.8.8` cover all 3 phases:
1. F-042: numeric financial bug fix (already PROD via v1.8.7)
2. F-044: TEXT hardcoded fix + BUGFIX#1 số ≠ chữ + Adjustment #1 typo
3. F-045: legacy provider data hardcoded fix + multi-provider verify

Combined regen batch = 1 merchant communication cycle. Audit script extended catches superset of affected contracts (Classes 2-6).

### F-043 stashed — Reconciliation upgrade

Resume sau khi F-044+F-045 ship PROD. `git stash pop` retrieve init.

### Future Manager protocol enforcement

DOCX Content Review Protocol (F-044 lesson) reaffirmed by F-045:
- Render verify spec với asymmetric/multi-provider fixture MANDATORY
- Manager eyeball read output `.txt` files post-Coder phase
- Audit script regex extension cho mỗi feature class

### Audit script regex library

Class 1-6 patterns now established. Future template features có thể extend Class 7+ pattern khi cần. Document trong `conventions.md` post-deploy.

---

## ✅ Status

🎉 **FEATURE-045 CODE-LEVEL DONE** — Memory sync complete. Combined F-042+F-044+F-045 ready for PROD release branch + regen batch.

Danny next decision:
1. Push merge `feat/F-044-contract-docx-phase-2` (now extended with F-045) → main → `release/v1.8.8`
2. Coordinate combined regen batch + merchant communication với Finance team (HIGH biz TD-F044-COMM-STRATEGY-PHASE2-COMBINED-F045)
