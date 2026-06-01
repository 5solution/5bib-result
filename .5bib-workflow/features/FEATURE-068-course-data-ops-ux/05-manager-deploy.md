# FEATURE-068: Deploy & Memory Sync

**Status:** ✅ DONE (Coder + QC approved, Manager close)
**Deployed:** 2026-06-01
**Author:** 5bib-manager
**Linked:** `00`, `01`, `02`, `03`, `04`, `IMPLEMENTATION_NOTES.md`

---

## 📌 Pre-flight check (Manager bắt buộc làm)

- [x] `04-qc-report.md` verdict = ✅ APPROVED WITH MINOR FOLLOW-UPS (acceptable — gaps documented as deploy mandates, not hidden risks)
- [x] Unit tests trong `03` đều PASS (40/40 NEW F-068)
- [x] File thay đổi trong `03` khớp với Scope Lock trong `02` — 0 scope creep (3 Deviations documented, all in-scope)
- [x] Đã đọc Tech debt còn lại trong `03` + `04` (8 TD logged)
- [x] **`IMPLEMENTATION_NOTES.md` tồn tại với 4 sections đầy đủ** (Deviations 4 + Forced 3 + Tradeoffs 8 + Reviewer Notes) — Danny 2026-05-19 mandate satisfied

---

## 📊 Deploy summary

- **Branch:** `feat/F-068-course-data-ops-ux` (8 commits + 0 rework)
- **PR:** https://github.com/5solution/5bib-result/pull/new/feat/F-068-course-data-ops-ux
- **Last commit:** `14b3346` (QC report)
- **QC verdict:** ✅ APPROVED WITH MINOR FOLLOW-UPS
- **Unit tests:** 40/40 NEW PASS (24 CourseDataOpsService + 9 RaceSyncCron + 3 race-result purge/regression + 4 admin signature)
- **Pre-existing TD-F029-05:** Partial fix — admin.service.spec.ts DI setup (added Telegram+Mail mocks)
- **E2E tests:** Declarative-only (Backend Supertest + Playwright authored, NOT executed — Coder+QC deferred to staging per IMPLEMENTATION_NOTES Deviation #2/Section 4)
- **Performance:** DEFERRED — no local backend during QC. **Staging measure mandatory before PROD release.**
- **Migration:** N/A — no schema change

---

## 🔬 Manager Independent Code Review (MANDATE 2026-05-17 + Danny 2026-05-19)

> Manager đọc IMPLEMENTATION_NOTES Section 4 priority list TRƯỚC, sau đó spot-check 5 file critical với line range. KHÔNG rubber-stamp Coder/QC.

### #1 `backend/src/modules/admin/services/course-data-ops.service.ts:139-197` (assertLiveConfirmation + acquireResetLock + waitForCronIdle)

**File reviewed:** Lines 131-197 (helpers section)

**Findings:**
- ✅ **L139-147 `assertLiveConfirmation`**: throws `ConflictException` với structured payload `{ statusCode: 409, code: 'RACE_IS_LIVE_CONFIRM_REQUIRED', message }`. VN message exact match BR-68-13 PRD literal.
- ✅ **L153-179 `acquireResetLock`**: Redis `SET key '1' EX 30 NX` atomic. Returns release function for try/finally pattern. Throws 409 `RESET_IN_PROGRESS` on lock conflict — Danny chốt H pattern port from F-018/F-019 ✓.
- ✅ **L186-197 `waitForCronIdle`**: poll 200ms, 5s timeout. On timeout `logger.warn` + `return` (continue anyway per BR-68-08 spec). Matches CRON_WAIT_TIMEOUT_MS constant.
- 🟢 **Independent verification**: `assertLiveConfirmation` runs BEFORE `acquireResetLock` (L370-373 disableAndReset flow) — confirmed test "race=live without confirmedLive → 409 + no lock acquired" passing. No lock leak on confirm gate rejection.

**Verdict:** ✅ GREEN — atomic order + lock encapsulation đúng spec.

### #2 `backend/src/modules/race-result/services/race-result.service.ts:351-383` (purgeCache patterns)

**File reviewed:** Lines 332-383

**Findings:**
- ✅ **L355-358 race-namespaced patterns** (Manager catch 2026-05-31 fix):
  - `results:${raceId}:${courseId}:*` ✓ (matches WRITE format line 618)
  - `stats:${raceId}:${courseId}` ✓ (matches WRITE format line 991)
  - `country-rank:${raceId}:*` ✓ (was wasteful `*:*` pattern)
  - `percentile:v3:${raceId}:*` ✓ (was wasteful `v3:*:*`)
- ✅ **L360-361 NEW BR-68-11 invalidations**: `athlete:${raceId}:*` + `badge:${raceId}:*` — fixes silent stale (Manager catch 2026-05-31).
- 🟡 **L363-366 legacy single-courseId**: `leaderboard:${courseId}` + `time-distribution:${courseId}` + `country-stats:${courseId}` kept matching WRITE site signatures. Out-of-scope per IMPLEMENTATION_NOTES Deviation #1. Documented TD-F068-LEADERBOARD-CACHE-NAMESPACE.
- 🟢 **L368-369 orphan legacy**: `percentile:*:*` + `percentile:v2:*:*` housekeeping patterns. QC flagged TD-F068-ORPHAN-PERCENTILE (wasteful KEYS scan, no functional bug).
- ✅ **L379-381 error handling**: try/catch + `logger.warn` + return 0 (best-effort cache invalidation, never throws).

**Verdict:** ✅ GREEN với 2 documented TD acceptable.

### #3 `backend/src/modules/race-result/services/race-result.service.ts:1829-1833` (deleteResultsByCourse)

**File reviewed:** Lines 1820-1833

**Findings:**
- ✅ **L1829-1833**: signature `(raceId, courseId)` — filter `deleteMany({ raceId, courseId })`. **Pre-existing cross-race wipe bug ELIMINATED** (Manager catch 2026-05-31). Unique index `{raceId, courseId, bib}` confirms courseId NOT globally unique — fix is correct.
- ✅ **L1831**: chained `purgeCache(raceId, courseId)` with both args — caller doesn't need to manually invalidate.
- ✅ **TC-68-14 regression test** verifies cross-race safety: race A reset → race B's same-courseId rows UNCHANGED.

**Verdict:** ✅ GREEN — critical bug fix verified.

### #4 `backend/src/modules/admin/services/course-data-ops.service.ts:363-411` (disableAndReset atomic order)

**File reviewed:** Lines 363-415

**Findings:**
- ✅ **L370 `loadRaceAndCourse`**: 404 check trước
- ✅ **L371 `assertLiveConfirmation`**: 409 check trước (no lock yet)
- ✅ **L373 `acquireResetLock`**: SETNX
- ✅ **L374 `try { ... } finally { release() }`**: lock release on throw — test "lock released even when delete throws" passing
- ✅ **Step 1 L380-385**: `racesService.updateCourse(raceId, courseId, { apiUrl: undefined } as any)` — uses existing `$unset` pattern from `races.service.ts:293-334` (verified). `as any` documented Section 4 Reviewer Notes.
- ✅ **Step 2 L388**: `await waitForCronIdle()` — 5s poll OR timeout-continue
- ✅ **Step 3 L391-394**: `deleteResultsByCourse(raceId, courseId)` — new signature
- ✅ **Step 4 L398**: `invalidateStatsCache(raceId, courseId)` — DEL `admin:course-stats:<raceId>:<courseId>`
- ✅ **Step 5 L402-409**: `emitAudit('course.disabled_and_reset', ...)` — F-023 swallow-throw
- 🟡 **Cron mid-flight race window**: cron's `getRacesWithApiUrls()` snapshot may read race.courses BEFORE Step 1 + write rows AFTER Step 3. Mitigated by `waitForCronIdle` 5s; residual race window exists. QC documented as acceptable per BR-68-08 timeout-continue contract.

**Verdict:** ✅ GREEN — atomic order exactly matches BR-68-08 spec.

### #5 `admin/src/components/course-data-ops/ResetDataConfirmDialog.tsx:112-155` (handleConfirm toast routing)

**File reviewed:** Lines 108-155

**Findings:**
- ✅ **L114-121 combo flow**: `disableAutoSync && hasApiUrl` → `disableAndResetMut.mutateAsync` + toast "Đã tắt auto-sync + xóa N kết quả..." + `onResetComplete?.(true)` triggers parent poll FOREVER.
- ✅ **L122-140 non-combo flow**: `resetMut.mutateAsync` + 2 toast variants based on `hasApiUrl + nextCronAt` + `onResetComplete?.(false)` triggers parent poll 5×2s.
- ✅ **L142-153 error toast routing** (Danny chốt D + H):
  - L145-148: `RACE_IS_LIVE_CONFIRM_REQUIRED` → toast đỏ "Race vừa chuyển LIVE, vui lòng xác nhận lại" + `return` (KEEP dialog open per Danny chốt D)
  - L149-152: `RESET_IN_PROGRESS` → toast đỏ "Đang có người khác xóa, chờ vài giây" + `return` (KEEP dialog open)
  - L153: generic fallback `err.message`
- ✅ **L116 + L124 `confirmedLive` payload**: only sent when `isLive`, else `undefined` (avoid noise in audit metadata for non-live races).
- ✅ **L141 `onOpenChange(false)`**: closes dialog ONLY on success path — error paths keep dialog open per spec.

**Verdict:** ✅ GREEN — toast routing exact match Danny chốt D + H spec.

### Manager Code Review SUMMARY

**5/5 hotspot files verified independently** — no red flags. Line ranges align with IMPLEMENTATION_NOTES Section 4. Coder/QC claims confirmed via own code reading (defense-in-depth preserved).

**Files reviewed:**
1. `course-data-ops.service.ts:139-197` (helpers — confirm gate + lock + cron wait)
2. `race-result.service.ts:351-383` (purgeCache 11 patterns)
3. `race-result.service.ts:1829-1833` (deleteResultsByCourse signature)
4. `course-data-ops.service.ts:363-411` (disableAndReset atomic order)
5. `ResetDataConfirmDialog.tsx:112-155` (handleConfirm toast routing)

**Common verification checklist:**
- [x] Business logic encode đúng BR-68-XX từ PRD verbatim (BR-68-08/10/11/13 spot-checked)
- [x] Type safety: 5 `as any` documented justified (3 for `updateCourse $unset` sentinel + 2 for Mongoose `.lean()` untyped)
- [x] Error handling: try/catch + `logger.warn` fallback + best-effort swallow đầy đủ (purgeCache, emitAudit, invalidateStatsCache all swallow Redis throws)
- [x] Cache invalidation hook fired đúng mutation site (purgeCache delegate inside deleteResultsByCourse; invalidateStatsCache called in 3 mutation paths)
- [x] No SQL injection (MongoDB string literal match only, no `$where`/`eval`/`$exec`)
- [x] Guard `@UseGuards(LogtoAdminGuard)` class-level inherited bởi 4 NEW endpoints (verified controller line 39)
- [x] `@ApiResponse` 200/401/403/404/409 đầy đủ cho cả 4 endpoints
- [x] NestJS DI patterns + Mongoose model injection + Redis InjectRedis convention adherence

**0 red flag. ✅ APPROVED for deploy.**

---

## 📝 Memory diff (đã apply vào `memory/*`)

### `feature-log.md`

✏️ Updated:
- **Counter:** `FEATURE-068` → `FEATURE-069`
- **Removed from In-flight:** F-068
- **Appended to Shipped (top):** F-068 entry với date + summary

### `change-history.md`

✏️ Appended (top): full entry — xem section dưới

### `codebase-map.md`

✏️ Updated admin module section:
```diff
 backend/src/modules/admin/
+  services/
+    course-data-ops.service.ts      # F-068 NEW: 4 admin course ops + lock + audit
+    course-data-ops.service.spec.ts # F-068 NEW: 24 unit tests
   dto/
+    course-data-ops.dto.ts          # F-068 NEW: 6 DTOs (stats + 3 mutation DTOs + EXTEND)
```

✏️ Updated admin frontend section:
```diff
 admin/src/lib/
+  course-data-ops-api.ts            # F-068 NEW: fetch wrappers + 7 types
+  course-data-ops-hooks.ts          # F-068 NEW: TanStack hooks (1 query + 3 mutation)

 admin/src/components/
+  course-data-ops/                  # F-068 NEW directory
+    CourseDataStatsBadge.tsx        # 3-stack badge
+    ResetDataConfirmDialog.tsx      # cron-aware + race-live typed confirm
+    ClearApiUrlConfirmDialog.tsx
+    index.ts                        # barrel export
```

### `architecture.md`

✏️ Updated Service Decomposition diagram:
```diff
 AdminModule
+├── CourseDataOpsService    # F-068 — 4 endpoints (data-stats, clear-apiUrl,
+│                           #         disable-and-reset, reset-data EXTEND)
+│                           # Composes RaceResultService + RacesService +
+│                           # RaceSyncCron + AuditLogService
 ├── AdminService            # Legacy methods
 └── ...
```

✏️ Updated Performance Critical Paths table:
```diff
| `GET /admin/.../data-stats` | Admin polling 5s × N courses × M admins | Redis 5min TTL, key: `admin:course-stats:<raceId>:<courseId>` |
| `POST /admin/.../disable-and-reset` | Atomic 5-step combo race-day | Redis SETNX lock `reset-lock:<raceId>:<courseId>` TTL 30s |
```

### `conventions.md`

✏️ Added 3 NEW patterns (Manager 2026-06-01 mint from F-068):

```markdown
### Redis SETNX lock pattern for concurrent mutation

When need to serialize concurrent admin/user mutation on the same resource:
- Key: `<domain>-lock:<resourceId>` (vd: `reset-lock:<raceId>:<courseId>`,
  `awards:state-lock:<podiumId>`, `medical:incident-lock:<incidentId>`)
- `redis.set(key, '1', 'EX', TTL_SECONDS, 'NX')` atomic acquire
- Throw `ConflictException` with `{ code: '<DOMAIN>_IN_PROGRESS', message }`
  when SETNX returns `null`
- Release in `try/finally` block — never leak on throw
- TTL chọn theo expected mutation duration (5s for short, 30s for medium)
- Ports F-018 medical / F-019 awards / F-068 course-data-ops

### Cron lifecycle expose for UI feedback

When admin UI needs to display "next scheduled run" or "currently running":
- Cron service expose 2 public getters: `isCurrentlySync(): boolean` +
  `getNextScheduledRunAt(now?: Date): Date | null`
- KHÔNG đổi `isSyncing` field thành public — giữ encapsulation, expose method
- `getNextScheduledRunAt` compute từ `CronExpression` constant + `Math.ceil`
  for predictable UTC rounding (handle hour/day rollover edge)
- Return `null` khi `isSyncing=true` so caller can mark `cronStatus: 'in_progress'`

### Admin polling endpoint with short TTL Redis cache wrap

When admin UI polls per-resource stats (vd: course row count, sync status):
- Cache layer: `redis.set(key, json, 'EX', SHORT_TTL_SECONDS)` — default 5s
- Cache key: `admin:<domain>-stats:<resourceId>`
- Always re-fetch on mutation (DEL key in mutation service)
- TTL chọn để bound multi-admin polling cost: 5s × N admins → max N hits/5s
  per resource regardless of admin count
- Skeleton loading state on cache miss/cold; cached payload returned immediately
  on hit
```

### `known-issues.md`

✏️ Appended 8 TDs + 1 RESOLVED:

```markdown
## RESOLVED (F-068)

- ✅ Pre-existing `deleteResultsByCourse(courseId)` cross-race wipe bug
  (Manager catch 2026-05-31 audit `lets-run-2026`) — RESOLVED via BR-68-10
  signature change `(raceId, courseId)`. Regression test TC-68-14 covers.
- ✅ Pre-existing `purgeCache(courseId)` pattern mismatch (Manager catch
  2026-05-31) — RESOLVED via BR-68-11 race-namespaced patterns + NEW
  `athlete:` + `badge:` invalidation. Regression test TC-68-15 covers.
- 🟡 PARTIAL: TD-F029-05 admin.service.spec.ts DI setup — F-068 added
  Telegram + Mail mocks. 2 remaining resolveClaim spec failures (unrelated).

## NEW Tech Debt (F-068)

| ID | Severity | Module | Issue | Plan |
|----|----------|--------|-------|------|
| TD-F068-LEADERBOARD-CACHE-NAMESPACE | 🟡 LOW | race-result.service | leaderboard/time-distribution/country-stats WRITE keys not raceId-namespaced (READ methods don't carry raceId) | Q3 2026 — REFACTOR endpoint shape |
| TD-F068-COURSE-ACTOR-CARRY-FORWARD | 🟡 LOW | admin / audit | 3 audit actions log `actor: 'admin'` hardcode (Danny chốt G defer) | F-069 — proper JWT actor extraction |
| TD-F068-CRON-STUCK-DETECT | 🟢 LOW | race-sync.cron + admin | BR-68-15 ">60s log warn" stateless endpoint cannot track continuous duration | Defer until ops surfaces concrete need |
| TD-F068-SDK-REGEN-PENDING | 🟡 LOW | admin / api-generated | Hand-typed wrappers in `course-data-ops-api.ts` — needs `pnpm --filter admin generate:api` against running backend | **Deploy day mandate before PROD ship** |
| TD-F068-PERF-NOT-MEASURED | 🟢 LOW | course-data-ops.service | Cold/warm p95 + reset 10K rows not benchmarked locally | Staging smoke before PROD |
| TD-F068-ORPHAN-PERCENTILE | 🟢 LOW | race-result.service | purgeCache keeps `percentile:*:*` + `v2:*:*` legacy patterns (orphaned post-F-029) — wastes Redis KEYS scan | Q3 2026 housekeeping |
| TD-F068-LOCK-TOKEN-LITERAL | 🟢 LOW | course-data-ops.service | Lock value `'1'` literal — no safe-release Lua. Crash recovery relies on 30s TTL | F-070+ if multi-instance backend |
| TD-F068-CRON-MID-FLIGHT-RACE | 🟢 LOW | course-data-ops.service.disableAndReset | Cron snapshot race.courses BEFORE clear apiUrl + write AFTER deleteMany. Mitigated by 5s waitForCronIdle; residual race window | Acceptable per BR-68-08 timeout-continue contract |
```

### CLAUDE.md Redis Keys Registry

✏️ Appended 2 NEW keys:
```diff
+| `admin:course-stats:<raceId>:<courseId>` | F-068 admin CourseDataOpsService getStats() — bound multi-admin polling cost (Redis 5s wrap). DEL on reset-data/clear-apiUrl/disable-and-reset mutation + force-sync. | 5s |
+| `reset-lock:<raceId>:<courseId>` | F-068 Danny chốt H — SETNX serializes concurrent reset-data/disable-and-reset (1 winner, others 409 RESET_IN_PROGRESS). Port pattern F-018/F-019. | 30s |
```

---

## 🔮 Follow-up cho feature kế tiếp

Manager notes for future feature touching admin/course-ops:

1. **SDK regen mandate** — F-068 Coder deferred to staging. Future admin endpoints MUST regen ngay sau merge to avoid drift.
2. **Course Health Dashboard (Option C)** — F-068 ship Option A only. If ops surface need for cross-course inspection / multi-tab "tình trạng" overview, mở F-070+ với scope dashboard tab.
3. **Async job + progress streaming (Option B)** — Reset 100K rows trên race lớn vẫn chậm. Future enhancement: BullMQ + SSE progress stream cho real-time UI.
4. **F-069 candidate: JWT actor attribution** — Resolves TD-F068-COURSE-ACTOR-CARRY-FORWARD + TD-CONTRACTS-ACTOR-001 carry-forward (F-066/F-067/F-068 all hardcode `'admin'`). Effort ~30 min extract JWT user → spread across 3 audit emit sites.

---

## ✅ Status

🎉 **FEATURE-068 DONE** — Memory synced. Ready for staging smoke + PROD release.

### Deploy mandate (Manager enforce)

Before merging `feat/F-068-course-data-ops-ux` to `main`:

1. **MANDATORY post-merge to main:**
   - [ ] Run `pnpm --filter admin generate:api` against running backend
   - [ ] Verify generated DTO shapes match `course-data-ops-api.ts` (shape parity)

2. **MANDATORY staging smoke:**
   - [ ] autocannon 60s GET data-stats → cold p95 <500ms / warm <50ms
   - [ ] k6 100 iter POST disable-and-reset on race 10K rows → p95 <3500ms
   - [ ] Manual UI 4-persona walkthrough (Hằng/Tùng/Hiền/Operations)
   - [ ] Real race `lets-run-2026` 200m: reset → verify 0 rows in <12s

3. **Counter advance:** F-068 → F-069 (next feature)
