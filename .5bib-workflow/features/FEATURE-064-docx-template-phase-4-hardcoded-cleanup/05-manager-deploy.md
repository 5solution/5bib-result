# FEATURE-064: Manager Deploy & Memory Sync

**Status:** ✅ DONE (PROD verified)
**Deployed:** 2026-05-26
**Release:** `release/v1.9.9` (superseded bởi v1.10.0 deploy success)
**PROD image:** `f7f6c5d` (post F-065 rebase)
**Linked:** 00 → 04

---

## 📊 Deploy summary

| Metric | Value |
|--------|-------|
| QC final | ✅ APPROVED (post-rework P0+P1+P2) |
| F-064 tests | 64/64 PASS |
| Module regression | 323/323 PASS |
| F-044/F-045 regression | 93/93 PASS |
| Audit script | 5 templates × 11+ forbidden patterns = 0 match |
| Files | 13 Scope Lock (3 NEW + 10 MODIFY) + 5 docs |
| Branch | `feat/F-064-docx-phase-4-hardcoded-cleanup` (10 commits + 3 rework + 1 merge) |

---

## 🔬 Manager Independent Code Review (5 critical paths post-QC)

### 1. `utils/event-date-derive.ts` (NEW helper)
- ✅ 5 functions: `deriveSetupDate(raceDate, days=3)`, `deriveExpoDate(raceDate, days=1)`, `deriveAthleteCount(lineItems, override)`, `formatVnDate()`, `parseRaceDateIso()`
- ✅ 22 unit tests cover edge: null/undefined/invalid/free-form Vietnamese raceDate → returns null (NOT hardcoded fallback). F-044 lesson honored.

### 2. `contracts.service.ts:buildRenderContext` extend (+80 LoC)
- ✅ 8 NEW flat keys (eventStartDate/End/setupDate/expoDate/eventLocation/athleteCount/contractSignDate/acceptanceSignDate)
- ✅ Anti-leak: free-form raceDate → null → render empty (KHÔNG hardcoded "29/05/2026" fallback)

### 3. 5 DOCX templates edit
- ✅ contract-operations: 6 hardcoded fields + phụ lục 7→8 cells (Chiết khấu column inserted) + provider address scrub
- ✅ 3 acceptance templates: contractSignDate/event/acceptanceSignDate variables + literal `……..` → `{acceptanceSignDate}` (3 templates × 3 locations)
- ✅ contract-racekit: location + athleteCount placeholders
- ✅ Audit script 0 match cho 11+ forbidden patterns

### 4. `audit-script.f064.spec.ts` (NEW)
- ✅ 15 tests verify rendered DOCX KHÔNG leak hardcoded
- ✅ Per-template forbidden pattern grep
- ✅ Acceptance templates loop verify {acceptanceSignDate} present + literal absent

### 5. Admin wizard step 3 UI
- ✅ 3 date pickers + eventLocation field + 2 optional date hints
- ✅ Submit empty → undefined (NOT empty string)

**Final Manager Review: ✅ APPROVED — production-ready.**

---

## 📝 Memory diff applied (combined với F-065/F-066/F-067)

Xem `feature-log.md` + `change-history.md` + `conventions.md` + `known-issues.md` cuối Q2 Contract Revamp ship.

---

## ✅ Status

🎉 **FEATURE-064 DONE** — Q2 Contract Revamp Phase 4 hardcoded cleanup + phụ lục column fix + admin UI extend shipped.
