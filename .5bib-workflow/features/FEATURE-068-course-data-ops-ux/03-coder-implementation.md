# FEATURE-068: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC
**Started:** 2026-05-31
**Author:** 5bib-fullstack-engineer
**Linked:** `00-manager-init.md`, `01-ba-prd.md`, `02-manager-plan.md`,
`IMPLEMENTATION_NOTES.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` (Manager EXTEND_EXISTING + 8 PAUSE)
- [x] Đã đọc `01-ba-prd.md` đầy đủ (18 BR-68-XX + 3 NEW endpoint + 1 EXTEND + pre-existing bug fix IN-SCOPE)
- [x] Đã đọc `02-manager-plan.md` verdict `✅ APPROVED` + 5 PAUSE-Coder + 14 Danny decisions
- [x] Đã đọc `memory/conventions.md` (atomic op pattern, audit log pattern F-023, cache key namespace)
- [x] Đã đọc `memory/codebase-map.md` (admin module + race-result module)
- [x] Đã đọc code thật của 7 file then chốt trong Scope Lock (đã spot-check ở /5bib-plan)

---

## 🔍 Impact Assessment (Think First)

### Backend

- **MongoDB:** KHÔNG schema change. Compound index `{raceId, courseId, bib}` UNIQUE đã exist (race-result.schema.ts:121) — `countDocuments({raceId, courseId})` hit prefix OK perf.
- **`sync_logs` collection:** schema có timestamp `created_at` (sync-log.schema.ts:8). Query `findOne({raceId, courseId}).sort({created_at: -1})` — verify compound index exists or accept TD.
- **Redis:** NEW key pattern `admin:course-stats:<raceId>:<courseId>` TTL 5s + Danny chốt H lock `reset-lock:<raceId>:<courseId>` TTL 30s. Existing pattern Manager catch fix: `results:<raceId>:<courseId>:*` + add `athlete:<raceId>:*` + `badge:<raceId>:*` invalidation.
- **NestJS DI:** new service `CourseDataOpsService` under AdminModule. RaceResultModule exports `RaceSyncCron` (was internal-only). AdminModule imports `AuditModule` + `MongooseModule.forFeature` for direct Mongo injection.

### Frontend (admin)

- **Next.js cache:** no Server Action mutations — all data-stats reads + 3 mutations go through TanStack Query hooks. No revalidate path needed.
- **TanStack Query:** poll 5s + invalidate per-course on mutation. `refetchIntervalInBackground: false` default pauses tab blur (Danny chốt #5).
- **Boundary:** CourseSection + CourseTable already `'use client'`. 3 new components also client.

### API Contract

- **OpenAPI:** schema changed (3 new endpoint + 1 EXTEND response) → SDK regen DEFERRED to QC phase (Deviation #2). Hand-typed fetch wrappers cover gap.
- **DTO additions backward compat:** `ResetDataResponseDto` appends fields — no break for existing consumers.
- **Breaking change:** `POST /admin/cache/purge/:courseId` → `/cache/purge/:raceId/:courseId`. Verified no admin UI consumer (only generated SDK references) — safe.

---

## ⚠️ Edge Cases Covered

- [x] Race not found → 404 (loadRaceAndCourse helper)
- [x] Course not found in race → 404
- [x] `race.status === 'live'` mutations → 409 RACE_IS_LIVE_CONFIRM_REQUIRED if no confirmedLive (BR-68-13)
- [x] Concurrent reset/disable-and-reset → Redis SETNX lock, 1 winner + 9 conflict 409 RESET_IN_PROGRESS (Danny chốt H)
- [x] Cron mid-flight wait — release after isSyncing flips false
- [x] Cron stuck timeout >5s — log warn + continue (BR-68-08)
- [x] Cross-race wipe regression — `deleteResultsByCourse({raceId, courseId})` filter (BR-68-10)
- [x] Cache key pattern mismatch — `results:<raceId>:<courseId>:*` fixed (BR-68-11)
- [x] Missing athlete/badge invalidation — added `athlete:<raceId>:*` + `badge:<raceId>:*` patterns
- [x] AuditLogService throw — swallowed (F-023 best-effort, no rollback)
- [x] Lock released on throw — try/finally in disableAndReset/resetData
- [x] BR-68-04 empty/whitespace apiUrl — does NOT count as hasApiUrl (trim().length > 0 check)
- [x] BR-68-05 + Danny chốt C — URL <16 chars return raw (no mask)
- [x] BR-68-06 nextCronAt edge cases — exactly on a mark steps to NEXT mark + hour rollover + day rollover
- [x] BR-68-18 post-reset poll — combo flow forever (cap 60×2s) / non-combo 5×2s stop / abort prior on re-trigger

---

## 🧠 Logic & Architecture

### Backend service decomposition

- `CourseDataOpsService` owns all 4 endpoint logics. Lives under `admin/services/` not `race-result/` because the operations are admin-facing concerns (audit, lock, cron-aware UX) that compose RaceResultService + RacesService + RaceSyncCron + AuditLogService.
- `AdminService.resetData` legacy method preserved + redirects (per Plan note). New endpoints route through `CourseDataOpsService` directly via AdminController constructor injection.
- `RaceSyncCron` exposes 2 public methods (`isCurrentlySync` + `getNextScheduledRunAt`) without breaking encapsulation (private `isSyncing` field unchanged).

### Lock pattern

Redis SETNX with TTL 30s — pattern port from F-018 (medical:incident-lock) + F-019 (awards:state-lock). Lock acquired BEFORE any mutation, released in try/finally even when work throws. Live-race confirmation gate runs BEFORE lock acquisition so a 409 RACE_IS_LIVE_CONFIRM_REQUIRED does not leak a held lock.

### Post-reset poll (BR-68-18)

- AbortController per-course. New poll cancels in-flight one.
- Combo flow (apiUrl already cleared) → poll cap 60 × 2s (~2min) — cron WON'T re-insert so polling forever is safe.
- Non-combo flow (apiUrl still set) → poll 5 × 2s then stop — cron MAY re-insert at next 10-min mark; capping prevents stuck UI.
- Stops early when `rowCount=0` observed.
- Each iteration invalidates TanStack Query key so badge re-fetches automatically.

### apiUrl masking

`head 8 + ... + tail 8` for URLs ≥16 chars. URLs <16 chars return raw (Danny chốt C — short URLs likely test/dev fixtures, no production secrecy risk).

---

## 💻 Files Changed

### Backend NEW

- ➕ `backend/src/modules/admin/services/course-data-ops.service.ts` (~370 LoC)
- ➕ `backend/src/modules/admin/services/course-data-ops.service.spec.ts` (~400 LoC, 24 tests)
- ➕ `backend/src/modules/admin/dto/course-data-ops.dto.ts` (~170 LoC, 6 DTOs)
- ➕ `backend/src/modules/race-result/services/race-sync.cron.spec.ts` (~95 LoC, 9 tests)

### Backend MODIFY

- ✏️ `backend/src/modules/race-result/services/race-result.service.ts`
  - L332-377: `purgeCache(raceId, courseId)` signature change + 11 patterns including NEW athlete/badge invalidation
  - L1807-1815: `deleteResultsByCourse(raceId, courseId)` signature change + filter fix
  - L441, L482, L1901, L1977, L2110: 5 internal call sites updated
- ✏️ `backend/src/modules/race-result/services/race-result.service.spec.ts`
  - L989-1054: 3 NEW F-068 tests (BR-68-11 patterns + TC-68-14 cross-race + TC-68-15 actual deletion)
- ✏️ `backend/src/modules/race-result/services/race-sync.cron.ts` — 2 NEW public methods + `RACE_SYNC_CRON_INTERVAL_MINUTES` constant
- ✏️ `backend/src/modules/race-result/race-result.module.ts` — export `RaceSyncCron`
- ✏️ `backend/src/modules/admin/admin.controller.ts`
  - L65-80 reset-data EXTEND signature + response DTO
  - L82-150 3 NEW endpoints (data-stats GET + clear-api-url PATCH + disable-and-reset POST)
  - L156-167 purgeCache endpoint path `:raceId/:courseId`
- ✏️ `backend/src/modules/admin/admin.service.ts` — `resetData(raceId, courseId)` + `purgeCache(raceId, courseId)` pass raceId
- ✏️ `backend/src/modules/admin/admin.service.spec.ts` — 5 mocks signature update + TelegramService/MailService DI fix (pre-existing TD-F029-05 partial resolve)
- ✏️ `backend/src/modules/admin/admin.module.ts` — import AuditModule + MongooseModule.forFeature for direct injection + register CourseDataOpsService

### Admin NEW

- ➕ `admin/src/lib/course-data-ops-api.ts` (~140 LoC, 4 fetch wrappers + 7 types + error class)
- ➕ `admin/src/lib/course-data-ops-hooks.ts` (~90 LoC, 1 query + 3 mutation hooks)
- ➕ `admin/src/components/course-data-ops/CourseDataStatsBadge.tsx` (~150 LoC)
- ➕ `admin/src/components/course-data-ops/ResetDataConfirmDialog.tsx` (~245 LoC)
- ➕ `admin/src/components/course-data-ops/ClearApiUrlConfirmDialog.tsx` (~165 LoC)
- ➕ `admin/src/components/course-data-ops/index.ts` (barrel export)

### Admin MODIFY

- ✏️ `admin/src/app/(dashboard)/races/[id]/settings/sections/CourseSection/CourseSection.tsx`
  - NEW state: resetDialog + clearApiUrlDialog + pollProgressByCourse + pollAbortRef
  - NEW `startPostResetPoll` helper (BR-68-18 combo vs non-combo)
  - Removed direct `adminControllerResetData` call (now in dialog component)
  - Pass raceId + pollProgressByCourse to CourseTable
  - Render 2 dialogs
- ✏️ `admin/src/app/(dashboard)/races/[id]/settings/sections/CourseSection/CourseTable.tsx`
  - NEW `raceId` prop + NEW `onClearApiUrl` + NEW `pollProgressByCourse` props
  - NEW "Tình trạng" column (md+) with CourseDataStatsBadge per row
  - NEW PlugZap button (🔌 visible iff hasApiUrl) between Reset and Copy
  - Reset button: dynamic tooltip "Xóa dữ liệu (576 kết quả)" + disabled when rowCount=0 or cronStatus=in_progress
  - Refactored to internal `CourseRow` component to host per-row `useCourseDataStats`

### Workflow docs

- ➕ `.5bib-workflow/features/FEATURE-068-course-data-ops-ux/IMPLEMENTATION_NOTES.md` (Section 1-4 per Danny 2026-05-19 mandate)
- ➕ This file (`03-coder-implementation.md`)

---

## 🧪 Tests Written

### Unit tests — Backend

**`backend/src/modules/admin/services/course-data-ops.service.spec.ts` (24 tests):**

```
PASS src/modules/admin/services/course-data-ops.service.spec.ts
  CourseDataOpsService (F-068)
    getStats() — TC-68-01..06
      ✓ TC-68-01 happy path with cache miss → fetch + cache SET
      ✓ TC-68-01 cache HIT → return cached payload without Mongo hit
      ✓ TC-68-02 empty stats — no sync logs
      ✓ TC-68-03 cron in_progress → cronStatus + nextCronAt null
      ✓ TC-68-04 race not found → 404
      ✓ TC-68-05 course not found in race → 404
      ✓ BR-68-05 apiUrlMasked: head8+tail8 for long URL
      ✓ BR-68-05 + Danny chốt C: URL <16 chars → return raw
      ✓ BR-68-04 empty-string apiUrl does NOT count as has apiUrl
    clearApiUrl() — TC-68-07..09
      ✓ TC-68-07 happy path: clears apiUrl, invalidates stats cache, emits audit
      ✓ TC-68-08 race=live without confirmedLive → 409 RACE_IS_LIVE_CONFIRM_REQUIRED
      ✓ TC-68-09 race=live with confirmedLive=true → success + raceWasLive flag
      ✓ course not found → 404
    disableAndReset() — TC-68-10..12
      ✓ TC-68-10 atomic order: clear apiUrl FIRST, then wait cron, then deleteMany
      ✓ TC-68-11 cron mid-flight wait — release after isSyncing flips false
      ✓ TC-68-12 cron stuck > 5s timeout — log warn + continue anyway
      ✓ Danny chốt H: concurrent reset blocked by SETNX lock → 409 RESET_IN_PROGRESS
      ✓ race=live without confirmedLive → 409 + no lock acquired
      ✓ lock released even when delete throws
    resetData() — TC-68-13..16
      ✓ TC-68-13 EXTEND response shape includes nextCronAt + hasApiUrl + durationMs
      ✓ TC-68-16 concurrent reset blocked by SETNX lock
      ✓ race=live without confirmedLive → 409
      ✓ race=live with confirmedLive=true → success + audit marks raceWasLive
    emitAudit best-effort (F-023 pattern)
      ✓ swallows AuditLogService throw without rolling back mutation

Tests: 24 passed, 24 total
```

**`backend/src/modules/race-result/services/race-sync.cron.spec.ts` (9 tests):**

```
PASS src/modules/race-result/services/race-sync.cron.spec.ts
  RaceSyncCron (F-068)
    isCurrentlySync()
      ✓ returns false by default
      ✓ returns true while handleCron in-flight, false when done
    getNextScheduledRunAt()
      ✓ returns null when isSyncing=true
      ✓ rounds UP to next 10-min mark — mid-interval
      ✓ rounds UP to next 10-min mark — exactly on a mark
      ✓ handles hour rollover when minute >= 50
      ✓ handles edge case 12:59:30
      ✓ handles UTC day rollover at 23:55
    RACE_SYNC_CRON_INTERVAL_MINUTES export
      ✓ exports the cron interval as 10

Tests: 9 passed, 9 total
```

**`backend/src/modules/race-result/services/race-result.service.spec.ts` (3 NEW F-068 tests + existing):**

```
  RaceResultService
    purgeCache
      ✓ F-068 BR-68-11: signature (raceId, courseId) + race-namespaced patterns + athlete/badge invalidation
      ✓ F-068 TC-68-15 cache pattern regression — actual key deletion verified
    deleteResultsByCourse (F-068)
      ✓ TC-68-14 cross-race wipe regression: filter MUST include raceId

  3 NEW F-068 tests PASS (rest of suite has pre-existing TD-F029-05 failures unrelated to F-068)
```

**`backend/src/modules/admin/admin.service.spec.ts` (signature + DI fix):**

```
  AdminService
    resetData
      ✓ should delete all results for a course (F-068 BR-68-10: pass raceId)
      ✓ should handle zero deletions
    purgeCache
      ✓ should purge Redis cache keys for a course (F-068 BR-68-11: raceId-namespaced)
      ✓ should handle zero keys deleted

  12/14 PASS (2 pre-existing resolveClaim spec gaps unrelated to F-068)
```

**TOTAL backend new tests: 36 PASS**

### Component tests — Frontend (admin)

DEFERRED to QC phase (Playwright E2E per BR + 10 E2E TC in PRD). Coder did self-inspection of component logic during dev — see Section 4 IMPLEMENTATION_NOTES for hotspot list.

---

## 🛑 PAUSE/Confirmation log

| Date | What | Danny's answer |
|------|------|----------------|
| 2026-05-31 | Strategy A/B/C/D (sequential/vertical/parallel/Coder pick) | "Làm cái này thì tạo nhánh mới r mà làm" — chose dedicated branch `feat/F-068-course-data-ops-ux`, sequential phase commits |
| 2026-05-31 | Edge case A (post-reset poll behavior) | poll forever khi combo flow / 5 lần × 2s khi reset thuần |
| 2026-05-31 | Edge case C (apiUrl mask short URL) | URL <16 chars return raw |
| 2026-05-31 | Edge case D (race chuyển status mid-action) | Toast đỏ + re-open dialog với typed confirmation |
| 2026-05-31 | Edge case G (audit actor proper fix) | Defer F-069 — hardcode `'admin'` Phase 1 |
| 2026-05-31 | Edge case H (concurrent lock) | ADD Redis SETNX `reset-lock:<raceId>:<courseId>` TTL 30s |
| 2026-05-31 | BA defaults #1-9 verified | All OK as proposed by BA in PRD |

---

## 🚧 Scope creep / Out-of-Scope changes

- [x] Không scope creep — all files modified within Scope Lock declared in `02-manager-plan.md`
- [x] Admin endpoint `POST /admin/cache/purge/:courseId` → `:raceId/:courseId` path change is in-scope per signature refactor (BR-68-11). Documented Deviation #3 in IMPLEMENTATION_NOTES.
- [x] Inline audit emit migrated from AdminService to CourseDataOpsService — Manager Plan recommend was "inline emit" not "AdminService specifically". Documented Deviation #4.

---

## 🐛 Known limitations / Tech debt còn lại

- **TD-F068-LEADERBOARD-CACHE-NAMESPACE** 🟡 LOW — `leaderboard:<courseId>` + `time-distribution:<courseId>` + `country-stats:<courseId>` WRITE keys NOT renamed to raceId-namespaced because READ method signatures don't have raceId. Out of F-068 scope. Q3 work.
- **TD-F068-COURSE-ACTOR-CARRY-FORWARD** 🟡 LOW — audit log actor hardcoded `'admin'` per Danny chốt G (defer F-069). Race-day forensics can't attribute action to specific admin.
- **TD-F068-CRON-STUCK-DETECT** 🟢 LOW — BR-68-15 "log warn if isSyncing > 60s continuous" not implementable in stateless endpoint without server-side state tracking. Defer.
- **TD-F068-SDK-REGEN-PENDING** 🟡 LOW — `pnpm --filter admin generate:api` not run (no local backend). QC phase must run + verify shape parity.
- **TD-F068-PERF-NOT-MEASURED** 🟢 LOW — `getStats()` cold/warm + reset-data 10K rows p95 not measured locally. QC phase verify SLA against staging.
- Carry-forward **TD-F029-05** partial fix — admin.service.spec.ts DI setup fixed (added TelegramService + MailService mocks). 2 remaining failures in resolveClaim spec are pre-existing, unrelated.

---

## ✅ Self-Review Pipeline (Manager 2026-05-14 mandatory)

- [x] **Bước 1:** Backend `tsc --noEmit` clean for F-068 Scope Lock files. Pre-existing `vi` errors in `upload.spec` unrelated. Admin `tsc --noEmit` clean for F-068 changes (pre-existing errors in `result-kiosk/__tests__` unrelated).
- [x] **Bước 2:** PRD strict adherence — 5 tables verified:
  - Form Fields → DTOs: `ClearApiUrlDto.confirmedLive` + `DisableAndResetDto.confirmedLive` + `ResetDataDto.confirmedLive` all `@IsOptional() @IsBoolean()` per PRD spec.
  - Buttons → Frontend: 🗑️ disabled when rowCount=0 OR cronStatus=in_progress (tooltip "Chờ sync xong" or "Không có dữ liệu"); 🔌 hidden when hasApiUrl=false; dialog footer destructive variant.
  - UI Step-by-Step → CourseSection startPostResetPoll + 2 dialogs route per Journey 1/2/3.
  - Endpoint Specs → all 4 endpoints implement Method/Path/Guard/Status codes per PRD table 3.2.
  - DTO Code Block → COPY VERBATIM from PRD into `course-data-ops.dto.ts`.
  - TC-XX → 16 PRD TC mapped 1:1 to `it()` blocks in spec files.
- [x] **Bước 3:** Anti-pattern scan clean. No `console.log` in prod code (`Logger` only). No raw `any` outside justified narrowing (3 `as any` for `updateCourse $unset` sentinel — documented IMPLEMENTATION_NOTES Section 4). No `as unknown as`.
- [x] **Bước 4:** No new schema field added — only signature refactor. Hand-pick mapping audit N/A.
- [x] **Bước 5:** PROD-readiness smoke DEFERRED — no local backend running in this branch session. QC phase mandate.
- [x] **Bước 6:** UI/UX self-inspection DEFERRED — no admin dev server. Component logic walkthroughs documented in IMPLEMENTATION_NOTES Section 4 hotspot list. QC phase E2E will exercise.
- [x] **Bước 7:** Real-world data sanity DEFERRED — same reason. Test fixtures in spec files use realistic raceId ObjectId-like + courseId VN format `200m`.
- [x] **Bước 8:** Files Changed vs Scope Lock — exact match. 0 scope creep (3 deviations all documented).
- [x] **Bước 9:** Generated SDK regen DEFERRED (Deviation #2 — no local backend). Hand-typed fetch wrappers cover gap, QC will reconcile.
- [x] **Bước 10:** 36 backend unit tests PASS. Outputs paste above.
- [x] **Bước 11:** `IMPLEMENTATION_NOTES.md` written with 4 sections (Deviations + Forced + Tradeoffs + Reviewer Notes) — none empty/skipped.

→ Status: 🟠 READY_FOR_QC

---

## 🔗 Next step

Danny chạy: `/5bib-qc FEATURE-068-course-data-ops-ux`

**QC focus areas (per IMPLEMENTATION_NOTES Section 4):**
1. `disableAndReset` atomic order + lock release on throw
2. `purgeCache` patterns including NEW athlete/badge keys
3. `deleteResultsByCourse` cross-race regression (TC-68-14)
4. `assertLiveConfirmation` before lock acquire (no lock leak on 409)
5. `ResetDataConfirmDialog.handleConfirm` toast routing for 409 codes

**Pre-flight for QC:**
- Run `pnpm --filter admin generate:api` against backend running locally (Deviation #2)
- Verify shape parity vs `course-data-ops-api.ts`
- Run 36 NEW backend unit tests
- Implement Playwright E2E per PRD section 4.2 (10 E2E TC)
- Measure performance SLA (cold p95 <500ms / warm <50ms / reset 10K <3s)
