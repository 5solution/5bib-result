# Verification Log — Timing Miss Alert System v1.0

> **Branch:** `5bib_racemonitor_v1`
> **PR scope:** Phase 0 (refactor) + Phase 1A (skeleton)
> **Spec ref:** `5BIB_PRD_TimingMissAlert_v1.0.md` (final v1.0.2)
> **Coder:** 5bib-fullstack-engineer

---

## Phase 0 — Refactor `RaceResultApiService` shared

### ✅ TA-Phase0-Build: BE build clean sau refactor

**Method:** `cd backend && npm run build`
**Result:**
```
> 5bib-result@0.0.1 build
> nest build
[no errors]
```

### ✅ TA-Phase0-NewSpec: `race-result-api.service.spec.ts` 7 tests PASS

**Method:** `npx jest --testPathPattern='race-result-api.service.spec'`
**Coverage:**
- Happy path 200 → returns parsed array
- Non-array body guard → returns `[]`
- Null body → returns `[]`
- Axios timeout (`ECONNABORTED`) → throws `Error` with "RR API fetch failed"
- HTTP 5xx → throws with status in message
- Custom timeout override respected
- API token (32-char) **masked** in error log (no credentials leak)

**Output:**
```
PASS src/modules/race-result/services/race-result-api.service.spec.ts
  RaceResultApiService
    fetchRaceResults()
      ✓ returns array on happy path 200
      ✓ returns empty array when response.data is non-array
      ✓ returns empty array when response.data is null
      ✓ throws Error on axios timeout
      ✓ throws Error on 5xx with HTTP status in message
      ✓ respects custom timeout override
      ✓ masks 32-char API token in error log
Tests: 7 passed, 7 total
```

### ✅ TA-Phase0-RelatedTests: BadgeService + DTO + Templates tests still PASS (no regression)

**Method:** `npx jest --testPathPattern='race-result'`
**Result:** `4 passed, 117 tests total` (badge, dto, templates, new api service)

### ⚠ TA-Phase0-PreExistingBug: `race-result.service.spec.ts` fails — **NOT regression**

**Issue:** Pre-existing Jest config bug — `mail.service.ts` uses `import { env } from 'src/config'` (TS baseUrl path). Jest `rootDir: 'src'` doesn't resolve `src/...` absolute imports because rootDir IS src/.

**Verified pre-existing:** `git stash` → run on origin/main → same failure (`Cannot find module 'src/config' from 'modules/notification/mail.service.ts'`).

**Scope:** Out of Phase 0. Fix requires `moduleNameMapper: { '^src/(.*)$': '<rootDir>/$1' }` in jest config — affects ALL specs that touch notification/mail/upload chain. Manager-level decision.

**Mitigation Phase 0:** Functional regression verified via:
- (a) Code diff minimal: only `axios.get<RaceResultApiItem[]>(apiUrl, {timeout: 30000})` replaced by `this.apiService.fetchRaceResults(apiUrl)`. Service preserves 30s timeout + non-array body guard + error throw → identical observable behavior.
- (b) Public method signature `syncRaceResult` unchanged.
- (c) `bulkOps.map()` consumer code untouched.

**Recommendation:** File QC ticket cho Manager fix `moduleNameMapper` separately — unblocks ~15+ broken specs.

### ✅ TA-Phase0-Manual: docker compose / VPS DEV regression verify (deferred)

**Method:** Sau merge → DEV CI deploy → check `docker logs 5bib-result-backend | grep RaceResult` mỗi 10 phút trong 30 phút.
**Expected:** RaceSyncCron tick OK, sync logs status='success', resultCount > 0 cho race active.
**Status:** PENDING merge → DEV deploy.

---

## Phase 1A — Module skeleton + crypto + config CRUD

### TA-1: Module conditional load
*(Pending Phase 1A code — em update sau khi implement)*

### TA-2: API key encrypted at rest (AES-256-GCM)
*(Pending)*

### TA-3: Config validate missing Finish in checkpoints
*(Pending)*

### TA-19: KHÔNG ĐỤNG MySQL legacy
**Method:** `grep -rn "InjectRepository.*'platform'\|TypeOrmModule.forRoot.*platform" backend/src/modules/timing-alert/`
**Expected:** 0 matches. Module 100% MongoDB + RR API HTTP.
*(Pending Phase 1A — em verify sau khi implement)*

---

## Files Changed — Phase 0

| File | Status | Lines |
|------|--------|-------|
| `backend/src/modules/race-result/types/race-result-api.types.ts` | NEW | 56 |
| `backend/src/modules/race-result/services/race-result-api.service.ts` | NEW | 78 |
| `backend/src/modules/race-result/services/race-result-api.service.spec.ts` | NEW | 95 |
| `backend/src/modules/race-result/services/race-result.service.ts` | MODIFIED | -52/+10 (extract inline interface + delegate fetch) |
| `backend/src/modules/race-result/race-result.module.ts` | MODIFIED | +5/-0 (provider + export `RaceResultApiService`) |

**Public method signatures preserved:** `RaceResultService.syncRaceResult/syncSingleCourse/syncAllRaceResults` — zero break for callers.

**Behavior preserved:** axios timeout 30s, non-array body returns 0 results, error throws with message → marks SyncLog FAILED.

**New behavior:** API token masked in error log (security improvement, side-effect positive).

---

## PAUSE / Confirmation log — Phase 0

- ✅ Danny confirmed plan A/B/C/D/E (5 PAUSE points) — proceed with default
- ✅ Danny confirmed PAUSE #1 (RR rate limit): use polling interval baseline same as race-result (default 90s per race-day Timing Alert config, validator [60, 300]s)
- ⚠ PAUSE #8 still open (Telegram chat_id) — block Phase 1C, NOT Phase 0/1A

## Scope creep — Phase 0

**None.** Phase 0 scope = extract HTTP layer only. Did not extract bulkWrite/Mongo logic. Did not touch other services. Did not modify Mongo schema.

## Known limitations / Tech debt

1. **Pre-existing Jest config bug** — `moduleNameMapper` missing for `src/...` paths. Blocks ~15 specs. Out of Phase 0 scope. Recommend Manager file fix ticket.
2. **API token masking** in error log uses regex `/\/[A-Z0-9]{32}(\/|$|\?)/g` — works for current RR Simple API token format (32-char base64 uppercase + digits). Future RR API key format change → masking may fail silent. Document in module README Phase 1A.

---
