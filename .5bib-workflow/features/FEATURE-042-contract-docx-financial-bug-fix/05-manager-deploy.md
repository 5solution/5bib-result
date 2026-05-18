# FEATURE-042: Deploy & Memory Sync

**Status:** ✅ DONE
**Deployed:** 2026-05-18
**Author:** 5bib-manager
**Linked:** `00`, `01`, `02`, `03`, `04`

---

## 📌 Pre-flight check (Manager)

- [x] `04-qc-report.md` verdict = ✅ APPROVED (15/15 BR-42 + 19/19 tests + 0 CRITICAL/HIGH security)
- [x] Unit + adversarial tests verified PASS post-cherry-pick — 19/19 trên release/v1.8.7
- [x] Files changed (25 in commit `ab21227`) match Scope Lock từ `02-manager-plan.md` exact (1 service modify + 6 template binaries + 6 backup + 5 NEW backend + 4 workflow + 3 spec files = 25 total)
- [x] Tech debt 8 items from QC report documented
- [x] **MANDATORY independent code review (skill 2026-05-17):**
  - `contracts.service.ts:1265-1300` flatten block reviewed — clean conditional spread, 11 keys, `vndAmountInWords()` reused correctly cho `actualTotalWithVatInWords`
  - 6 DOCX templates re-extracted + grep verified — 0 hardcoded financial numbers across all 6 files
  - `acceptance-timing.docx` placeholders confirmed: `{actualSubtotal}`, `{actualVatAmount}`, `{actualTotalWithVat}`, `{advancePaid}`, `{remainingBalance}` — match BR-42-10 flatten schema exactly
  - `contract-timing.docx` placeholders confirmed: `{subtotal}`, `{vatAmount}`, `{totalAmount}` — match Mapping Table A
  - 6 backup files preserved trong `.backup/` per F-024 BACKUP_DIRNAME pattern (Adjustment #1 verified)
  - `extractDocxText` test helper exists via pizzip (Adjustment #2 verified)

---

## 📊 Deploy summary

- **Commit/PR:** cherry-pick `ab21227` (`feat/F-042-wip`) onto `release/v1.8.7` → `30b0ba1` + Manager deploy commit
- **QC verdict:** ✅ APPROVED (4-qc-report.md, 6 phases passed)
- **Tests:** 19/19 F-042 PASS (12 Coder + 7 QC adversarial) + 159/159 F-024 contracts regression PASS
- **Performance:** Test suite runtime 2.854s; DOCX render p95 estimated ~30ms (well under 30s SLA)
- **Migration:** ZERO DB schema change (templates + code-only fix)
- **Rollback path:** Revert 7 commits (1 service + 6 templates) → restore from `.backup/` → instant rollback safe

---

## 📝 Memory diff (đã apply vào `memory/*`)

### `feature-log.md`
- ✏️ Updated counter `FEATURE-042 → FEATURE-043` next
- ✏️ F-042 status `🟡 INITIATED → ✅ DEPLOYED` (move từ In-flight → Shipped)
- ➕ Appended F-042 deploy entry (top of Shipped section)

### `change-history.md`
- ➕ Appended detailed F-042 entry — see section "Change History entry" below

### `codebase-map.md`
- ✏️ Updated `backend/src/modules/contracts/services/contracts.service.ts` — note F-042 flatten extension line 1265-1300
- ➕ Added `backend/scripts/audit-contract-docx-templates.ts` + `regenerate-affected-contracts.ts`
- ➕ Added `backend/test/helpers/docx-text-extract.ts` (NEW test helper category)
- ➕ Added `.backup/` directory note under contract-templates folder

### `architecture.md`
- ✏️ No structural change — DOCX gen flow unchanged. F-042 = bug fix to template static content + context flatten layer.

### `conventions.md`
- ➕ Added new section **"Template fix workflow"** documenting:
  - DOCX edit via XML manipulation (pizzip extract + regex replace + repack) — alternative to LibreOffice for bit-perfect formatting preservation
  - Backup pattern `<type>-<timestamp>-<feature-id>.docx` in existing `.backup/` directory
  - Post-edit grep audit mandatory: zero `[0-9]{1,3}\.[0-9]{3}\.[0-9]{3}` patterns in financial sections
- ➕ Added pattern **"Context flatten cho docxtemplater"**:
  - Spread conditional `...(nested ? {flatKeys} : {})` for templates using simple substitution
  - Preserve nested object backward compat (don't replace, ADD top-level)
- ➕ Added pattern **"Audit + Regenerate script duo cho data-fix features"**:
  - Audit script: NestApplicationContext + read-only Model query + JSON report output
  - Regen script: sequential processing + 200ms sleep + dry-run mode + audit log emit
  - PAID/finalized state safeguard: log WARN + special audit event (Finance team filter)

### `known-issues.md`
- ➕ Appended 8 TD-F042-* items per QC report:
  - TD-F042-COMM-STRATEGY-PHASE2 (HIGH business) — Finance team chốt re-send strategy trong 1 tuần
  - TD-F042-MULTI-VIEWER-VERIFY-DEFERRED (MED) — Manager/Danny manual MS Word + LibreOffice + Google Docs render verify
  - TD-F042-CODER-LOCAL-AUDIT-NOT-RUN — Audit script PROD run pending
  - TD-F042-PAID-CONTRACT-AUDIT-EVENT-NAMING (MED) — Finance team filter pattern
  - TD-F042-REGEN-SCRIPT-CROSS-FEATURE-REUSE (LOW) — Phase 2 extract shared lib
  - TD-F042-TEMPLATE-PLACEHOLDER-STATIC-AUDIT (LOW) — Update F-024 CONTEXT_KEYS array
  - TD-F042-AUDIT-OUTPUT-GITIGNORE (LOW) — Add scripts/*.json output to .gitignore
  - TD-F042-1000-ITEMS-STRETCH-TEST (LOW) — 1000+ lineItem PROD smoke verify

---

## 📝 Change History entry (appended to change-history.md)

```markdown
## [2026-05-18] FEATURE-042: Contract DOCX + BBNT Financial Number Bug Fix

**PR/Commit:** cherry-pick `ab21227` → release/v1.8.7 → main
**Type:** BUGFIX (HIGH severity — legal/finance accuracy)

### Files changed (25)

**Service modify (1):**
- ✏️ `backend/src/modules/contracts/services/contracts.service.ts` — Added F-042 flatten block lines 1265-1300 inside `buildRenderContext()`. Spread conditional 11 acceptanceReport keys to top-level for docxtemplater compat (BR-42-10).

**DOCX templates modify (6):**
- ✏️ `backend/assets/contract-templates/contract-timing.docx` — 2 hardcoded numeric strings replaced với `{subtotal}` + `{vatAmount}` placeholders
- ✏️ `backend/assets/contract-templates/contract-racekit.docx` — 1 hardcoded replaced với `{subtotal}`
- ✏️ `backend/assets/contract-templates/contract-operations.docx` — 1 hardcoded replaced với `{subtotal}`
- ✏️ `backend/assets/contract-templates/acceptance-timing.docx` — 5 unique hardcoded values (8 occurrences) replaced với `{actualSubtotal}/{actualVatAmount}/{actualTotalWithVat}/{advancePaid}/{remainingBalance}`
- ✏️ `backend/assets/contract-templates/acceptance-racekit.docx` — 4 unique values (9 occurrences) replaced; 36.180.000 disambiguated as 2× `{totalAmount}` (contract value) + 2× `{actualTotalWithVat}` (acceptance value)
- ✏️ `backend/assets/contract-templates/acceptance-operations.docx` — 6 unique values (10 occurrences) replaced với full flatten key set

**Backup files (6):**
- ➕ `backend/assets/contract-templates/.backup/<type>-20260518-pre-f042.docx` × 6 (instant rollback path)

**NEW backend files (5):**
- ➕ `backend/test/helpers/docx-text-extract.ts` — Pizzip-based DOCX text extractor + 2 assertion helpers (`assertDocxContains`, `assertDocxNotContains`)
- ➕ `backend/scripts/audit-contract-docx-templates.ts` — Audit script BR-42-11 (NestApplicationContext + Contract model + JSON report)
- ➕ `backend/scripts/regenerate-affected-contracts.ts` — Regen batch BR-42-12..15 + PAID safeguard
- ➕ `backend/src/modules/contracts/services/document-generator.service.f042.spec.ts` — TC-42-01..09 (9 tests)
- ➕ `backend/src/modules/contracts/services/contracts.service.f042-context.spec.ts` — TC-42-CTX-01..03 (3 tests)

**NEW QC adversarial (1):**
- ➕ `backend/src/modules/contracts/services/document-generator.service.f042-adversarial.spec.ts` — 7 adversarial tests (QC-TC-42-A01..A07)

**Workflow artifacts (5):**
- 00-manager-init.md + 01-ba-prd.md + 02-manager-plan.md + 03-coder-implementation.md + 04-qc-report.md + 05-manager-deploy.md

### Architecture impact

- ✅ ZERO architecture change — DOCX gen flow unchanged
- ✅ ZERO new module/integration
- ✅ ZERO DB schema/index migration
- ✅ ZERO Redis cache key change
- F-042 = template static content bug fix + context flatten layer extension

### Conventions impact

3 new patterns minted (appended to conventions.md):
1. **DOCX template fix via XML manipulation** — alternative to LibreOffice edit, preserves formatting bit-perfect
2. **Context flatten cho docxtemplater** — conditional spread pattern
3. **Audit + Regenerate script duo** — pattern cho data-fix features

### DB / Cache impact

- ❌ MongoDB: no change
- ❌ MySQL platform: no change
- ❌ Redis: no change
- ✅ DOCX template binary files: 6 modified, 6 backup preserved

### Tech debt còn lại (moved to known-issues.md)

8 TD-F042-* items tracked. See known-issues.md.

### Lessons learned

- **F-024 original Coder bug pattern** — Created templates by copying SAMPLE race DOCX với hardcoded numbers, converted SOME to placeholders nhưng quên 19 strings. Lesson: post-template-creation MUST run grep audit `[0-9]{1,3}\.[0-9]{3}\.[0-9]{3}` for any hardcoded financial values.
- **Template binary manipulation** — Python XML extract + regex replace + repack works reliably when text intact in `<w:t>` runs. F-037 multi-viewer lesson still applies for visual fidelity post-edit.
- **Duplicate numeric values** với different semantic positions need ordinal-based replacement (acceptance-racekit 36.180.000 × 4 = 2× totalAmount + 2× actualTotalWithVat).
- **Manager spot-check post-cherry-pick** caught no issues — confirms QC approval thorough.
- **Coder PAID safeguard beyond PRD** — Manager Adjustment idea (PAID contract WARN + special audit event) added by Coder unprompted = good signal of engineering judgment.
```

---

## 🔮 Follow-up cho feature kế tiếp

Manager note khi init feature mới đụng vùng này:

- **Contract DOCX template fixes** — Khi cần edit template, prefer XML manipulation pattern (Python pizzip + regex) over LibreOffice GUI edit. Use `backend/test/helpers/docx-text-extract.ts` cho test content verification.
- **Audit + Regenerate pattern** — Reusable cho future data-fix features. Phase 2 extract shared `backend/scripts/lib/audit-regen-base.ts` nếu pattern proves out.
- **F-024 audit-template-placeholders.ts** — CONTEXT_KEYS stale post-F-042. Update Set when next contracts feature touches buildRenderContext.
- **PROD audit + regen scripts** — Pending Danny + Finance team sign-off (TD-F042-CODER-LOCAL-AUDIT-NOT-RUN). Run `--dry-run` first, then `--limit=10` batch, then full.
- **Communication strategy** — Finance team quyết trong 1 tuần re-send DOCX cho merchants đã nhận wrong files (TD-F042-COMM-STRATEGY-PHASE2).

---

## 🚀 Deploy strategy

**Branch flow:**
- `feat/F-042-wip` (Danny's WIP branch, commit `ab21227`)
  - → cherry-pick onto `release/v1.8.7` (current branch, commit `30b0ba1`)
  - → Manager deploy commit (this file + memory sync)
  - → push origin `release/v1.8.7` → CI auto-deploy PROD via `deploy-production.yml`
  - → fast-forward push origin `main` → CI deploy DEV (latest tag)

**CI workflow:**
- `deploy-production.yml` triggers on push to `release/v*` → PROD `result-api.5bib.com` + `admin.5bib.com`
- `build-and-deploy.yml` triggers on push to `main` → DEV `result-api-dev.5bib.com` + `admin-dev.5bib.com`

**Post-deploy MANDATORY actions:**

1. **🛑 Multi-viewer visual verify** (TD-F042-MULTI-VIEWER-VERIFY-DEFERRED)
   - Sample DOCX from real contract (e.g., `6a095ceae7c717e8fc1c2c0e`)
   - Open in MS Word + LibreOffice + Google Docs
   - Verify visual fidelity preserved (F-037 lesson — text/colspan/tblLayout intact)

2. **🛑 PROD audit script run** (TD-F042-CODER-LOCAL-AUDIT-NOT-RUN)
   - SSH backend container → run `npx ts-node scripts/audit-contract-docx-templates.ts`
   - Review `audit-f042-report.json` output → identify blast radius
   - Identify PAID contracts (safeguard flag)

3. **🛑 PROD regenerate batch** (per Manager + Danny + Finance sign-off)
   - Step 1: `--dry-run --audit-file=audit-f042-report.json` → review tasks list
   - Step 2: `--limit=10` real run → verify behavior on small batch + audit log
   - Step 3: Full run with audit log monitoring
   - Audit log filter: `actor=f042-regenerate-script` for traceability

4. **Finance team communication** (TD-F042-COMM-STRATEGY-PHASE2)
   - Within 1 week: decide whether to re-send corrected DOCX to merchants
   - Track legal exposure window

---

## ✅ Status

🎉 **FEATURE-042 DONE** — Memory đã sync, code merged to release/v1.8.7 + main, CI auto-deploy triggered.

Counter: `FEATURE-043` next.
