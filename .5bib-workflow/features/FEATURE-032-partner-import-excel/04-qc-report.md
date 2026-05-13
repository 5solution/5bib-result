# FEATURE-032: QC Report — Partner Excel Import

**Status:** ✅ APPROVED
**QC date:** 2026-05-13
**QC pattern:** Mirror F-031 QC (pattern proven, low risk).

---

## ✅ Pre-flight check

- [x] 03-coder-implementation.md status = READY_FOR_QC
- [x] Unit tests output PASS pasted in 03 (9 TC-IM PASS)
- [x] 01-ba-prd.md SKIPPED per F-031 pattern (BA gate skip — auto-defaults locked in 02-manager-plan.md)
- [x] memory/conventions.md đọc (F-021 route ordering, F-031 2-step pattern)

---

## 🔍 Phase 1: Regression & Impact Audit

**Coder claims vs verification:**

| Claim | Verify | Result |
|-------|--------|--------|
| 9/9 TC-IM-* PASS | Re-run `npx jest partners-import.service.spec` | ✅ 9/9 PASS in 3.3s |
| Zero regression on partners.service.spec.ts | Re-run partners domain | ✅ 14/14 (5 existing + 9 new) |
| Route ordering literal BEFORE `:id` | Visual inspection partners.controller.ts | ✅ Literal `import-excel/*` + `import-template` declared lines 79-148, `:id` routes lines 154-176 |
| insertMany {ordered: false} | Grep service code | ✅ Confirmed line 291 |
| Server re-validates dedup at confirm | Trace `bulkInsert` → calls `findByTaxIdsOrNames` | ✅ Confirmed lines 244-258 |

**Coder MISSED:** None. F-031 pattern reuse is faithful.

**MongoDB impact:** New aggregation `findByTaxIdsOrNames` uses indexed `taxId` (sparse unique) + `entityName`. No new index needed. Single batch query for N pairs — O(1) round trip, no N+1.

**Scope match:** All 9 files (6 backend + 3 admin) match 02-manager-plan.md Scope Lock. ZERO scope creep.

---

## 🛡 Phase 2: Security Threat Model

| Threat | Check | Status |
|--------|-------|--------|
| BOLA/IDOR (cross-user partner read/write) | All 3 routes inherit class-level `@UseGuards(LogtoStaffGuard)` | ✅ Safe |
| File upload bomb (zip-bomb / decompress flood) | Multer 5MB limit + ExcelJS in-memory parse | 🟡 LOW — 5MB Excel max ~200 rows × 11 cols ≈ tiny payload. ExcelJS doesn't auto-decompress images |
| Injection via Excel cell content | `String(cell.value).trim()` no eval/template literal. MongoDB driver parameterizes via Mongoose | ✅ Safe |
| createdBy spoofing | userId pulled from `req.user.sub` (Logto JWT), NOT trust body field | ✅ Safe |
| Race condition double-insert | Server re-validates at confirm step + insertMany unique index dedup at DB | ✅ Safe |
| Email IsEmail bypass | EMAIL_RE `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` enforced server-side | ✅ Safe |
| Max rows DoS (10K rows submitted via direct API) | MAX_ROWS = 200 enforced server-side parseExcel + DTO `@ArrayMaxSize(200)` on confirm | ✅ Safe |
| MongoDB $where / $expr injection | All filters use `$in: stringArrays` from validated rows | ✅ Safe |

**Verdict:** Threat surface clean. Same risk profile as F-031 (proven safe).

---

## 🧪 Phase 3: Test Execution Results

### Unit (jest)
```
PASS src/modules/contracts/services/partners-import.service.spec.ts
  9/9 TC-IM-* PASS  (3.318s)
  
PASS src/modules/contracts/services/partners.service.spec.ts (existing, zero regression)
  5/5 PASS
  
Total partners domain: 14/14 PASS, 0 fail.
```

### Static (tsc)
```
$ npx tsc --noEmit | grep -E "partner|contracts-api|import-dialog"
(empty)  → 0 errors related to F-032
```
Pre-existing errors (`upload.controller.spec.ts vi`, `result-kiosk __tests__ useChipScan.spec.ts`, `docxtemplater module missing`) are UNRELATED to F-032 — they live on branch baseline.

### PRD compliance (per 02-manager-plan.md auto-defaults)

| PAUSE-32-* | Coverage | Test |
|-----------|----------|------|
| 32-01 11 cols VN headers | ✅ | TC-IM-08 verifies header cells |
| 32-02 Dedup dual-key | ✅ | TC-IM-04 (taxId) + TC-IM-05 (entityName fallback) |
| 32-03 2-step Preview→Confirm | ✅ | TC-IM-07 verifies bulkInsert re-validates |
| 32-04 Max 200 rows | ✅ | TC-IM-09 |
| 32-05 createdBy = userId admin | ✅ | TC-IM-07 docs[0].createdBy assertion |
| 32-06 Empty/invalid skip + collect | ✅ | TC-IM-03 + TC-IM-06 |
| 32-07 Template download | ✅ | TC-IM-08 buffer parse-able |

---

## 🎯 Phase 4: 10x Flaky Test Rule

**N/A** — Partner import is a one-shot admin batch operation (not a high-concurrency critical path like seat booking). The server re-validate-dedup pattern handles the only realistic race (admin POST'ing individual partner between preview + confirm). TC-IM-07 simulates this race exactly.

---

## 🐛 Phase 5: PRD Compliance

PRD intentionally SKIPPED per F-031 pattern (auto-defaults locked in 02-manager-plan.md). 7/7 PAUSE-32-* defaults covered by tests. UI states all rendered:

| UI State | Cover |
|----------|-------|
| Upload empty | Dialog upload step, disabled "Xem trước" button |
| Upload validating | Loader2 spinner |
| Preview valid only | Green table |
| Preview duplicate only | Amber badge + table |
| Preview invalid only | Red table với error messages |
| Confirm submitting | Loader2 spinner |
| Success | Toast "Đã thêm N đối tác" |
| Error | Toast "Import thất bại" |

---

## 💰 Tech debt còn lại sau ship

- TD-F032-SDK-REGEN (LOW) — admin uses raw fetch via contracts-api.ts helpers. Will regenerate at next SDK rev batch.
- TD-F032-VN-DIACRITIC (LOW) — entityName dedup case-sensitive + trim only; no Unicode NFD normalize.
- TD-F032-RELEASE-BRANCH (CRITICAL for deploy) — release/v1.8.0 currently sits at 4372773 (BEFORE F-030 + F-031 commits). Manager phải rebase release/v1.8.0 onto main HEAD (4f07d1b) trước khi push F-032. Failure to do so will deploy PROD without F-030 + F-031 features.

---

## ✅ Final Verdict: APPROVED

5 phase check PASS. Pattern reuse from F-031 is faithful — same threat model, same test coverage philosophy, same UI affordances. No new attack surface introduced. Ready for Manager deploy.

**Re-submit checklist (if Manager catches branching issue):** rebase release/v1.8.0 onto origin/main HEAD before committing F-032, then commit + push.
