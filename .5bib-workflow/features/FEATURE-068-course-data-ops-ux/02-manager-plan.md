# FEATURE-068: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-05-31
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` (Manager tự viết)
- [x] Đã đọc `01-ba-prd.md` toàn bộ (BA output, status 🔵 READY, 18 BR-68-XX)
- [x] Đã đọc memory: `codebase-map.md`, `architecture.md`, `conventions.md`, `known-issues.md` (TD-2026-05-12-CRIT-04 SSRF + TD-F029-05 race-result spec debt + TD-CONTRACTS-ACTOR-001 carry-forward)
- [x] Đã spot-check code thật cho 7 file then chốt (xem section "Spot-check findings" dưới)
- [x] Đã chốt 14 decisions với Danny (5 ops PAUSE A/C/D/G/H + 8 BA defaults #1-9) — Danny answer OK all

---

## ✓ PRD Validation Checklist

### Completeness
- [x] User Stories đầy đủ — 5 personas (Hằng Sales / Tùng Race Director / Hiền Finance)
- [x] Business Rules có ID — 18 BR (BR-68-01..18)
- [x] PAUSE conditions Manager (file 00) đã trả lời — 8/8
- [x] UI states đầy đủ — Loading initial / polling / Empty rowCount=0 / Empty hasApiUrl=false / Data normal / Error fetch / Submitting / Success / Validation error typed / Confirm dialog / Cron in_progress / Cron stuck / Race live (12 states)

### Technical correctness vs codebase
- [x] **File path verify:** `admin.controller.ts:65` (resetData endpoint) ✓, `admin.service.ts:66` ✓, `race-result.service.ts:1796` (deleteResultsByCourse) ✓, `race-result.service.ts:331` (purgeCache) ✓, `race-sync.cron.ts:8` (isSyncing flag) ✓, `races.service.ts:293` (updateCourse $unset) ✓, `CourseTable.tsx` (7 action buttons hiện tại) ✓, `sync-log.schema.ts:8` (timestamps `created_at`) ✓, `race.schema.ts:41` (apiUrl optional ✓), `RaceStatusHistoryEntry.status` enum `'draft' | 'pre_race' | 'live' | 'ended'` ✓
- [x] **DTO existence:** `UpdateCourseDto` + `add-course.dto.ts:100` (apiUrl optional) ✓ — Coder có thể reuse cho clear-apiUrl via $unset hoặc thêm endpoint mới (BA chốt option NEW endpoint)
- [x] **AuditLogService DI pattern:** F-067 ContractAuditService wrapper với `@Optional() private readonly auditLog?: AuditLogService` ✓ — Coder port pattern này cho `CourseAuditService` mới
- [x] **LogtoAdminGuard:** import path `../logto-auth` ✓ (class-level guard existing AdminController)
- [x] Cache key pattern `[resource]:[id]:[variant]` khớp ✓
- [x] Named connection `'platform'` — N/A (MongoDB only feature)
- [x] Generated SDK refresh `pnpm --filter admin generate:api` — Coder MUST run sau khi DTO ready

### Security
- [x] LogtoAdminGuard trên 4 endpoint (class-level inherited)
- [x] Cross-tenant 403/404 — BA chốt 1 trong 2, Coder verify
- [x] apiUrl mask response (BR-68-05) — không leak raw
- [x] AuditLog metadata `prevApiUrl` raw internal (admin-only read) ✓

### Performance
- [x] SLA cụ thể: cold p95 <500ms, warm <50ms, reset 10K <3s, disable-and-reset 10K <3.5s, hit ratio >80%, 10x stability 100%
- [x] Cache TTL 5s + invalidate strategy (DEL key cụ thể, không scanStream)
- [x] Migration plan — N/A (Redis key rename tự expire 60-300s)

### Testability
- [x] 17 backend TC + 10 E2E + 1 stability 10x + 2 regression TC (cross-race + cache pattern)
- [x] Concurrency test scenario rõ
- [x] 10x flaky test plan cho concurrent reset

---

## 🔬 Spot-check findings (Manager 2026-05-17 mandatory)

> Manager tự đọc code thật, ghi line range. KHÔNG rubber-stamp BA.

### 1. `backend/src/modules/admin/admin.controller.ts:65-75` (existing reset-data)
- ✅ Class-level `@UseGuards(LogtoAdminGuard)` line 29 — Coder reuse cho 3 endpoint mới
- ✅ `@Post('races/:raceId/courses/:courseId/reset-data')` — pattern khớp BA propose cho 3 endpoint mới
- ⚠️ **Pre-existing bug confirmed:** controller delegate `adminService.resetData(raceId, courseId)` — service line 67 `this.raceResultService.deleteResultsByCourse(courseId)` thiếu raceId. BA BR-68-10 fix.

### 2. `backend/src/modules/race-result/services/race-result.service.ts:1796-1800` (deleteResultsByCourse)
- ✅ `this.resultModel.deleteMany({ courseId })` — bug confirm, thiếu raceId filter
- ✅ Gọi `purgeCache(courseId)` sau deleteMany (line 1798) — Coder phải update cả 2 call sites khi đổi signature

### 3. `backend/src/modules/race-result/services/race-result.service.ts:331-356` (purgeCache pattern)
- ✅ Pattern `results:${courseId}:*` thiếu raceId — bug confirm
- ⚠️ Cache key thực tế (line 617): `results:${dto.raceId}:${dto.course_id}:${dto.pageNo}:${filtersHash}` → pattern hiện tại KHÔNG match → cache stale 24h
- ⚠️ Thiếu invalidate `athlete:`, `badge:` — Manager đã catch session 2026-05-31 audit
- ⚠️ Có call site khác `purgeCache(courseId)` ngoài deleteResultsByCourse: `syncSingleCourse` line 455, `syncAllRaceResults` line 414. Coder MUST update cả 3 call site khi đổi signature

### 4. `backend/src/modules/race-result/services/race-sync.cron.ts:8,14,20,26` (isSyncing flag)
- ✅ `private isSyncing = false` line 8 — current encapsulation
- ✅ Set true line 20 → finally false line 26
- ⚠️ Coder PHẢI add public getter `isCurrentlySync(): boolean` (KHÔNG đổi `private` → `public` field, giữ encapsulation)
- ⚠️ Add method `getNextScheduledRunAt(): Date | null` compute từ `CronExpression.EVERY_10_MINUTES` (= `*/10 * * * *` UTC). Logic BR-68-06: `Math.ceil(now.getMinutes() / 10) * 10` next mark. Mid-flight → null + cronStatus='in_progress'

### 5. `backend/src/modules/races/races.service.ts:293-334` (updateCourse $unset pattern)
- ✅ Đã support `$unset` qua undefined value (lines 297-310)
- ✅ Atomic `findOneAndUpdate({ _id: raceId, 'courses.courseId': courseId }, update)` — thread-safe
- ✅ Invalidate `master:course-map:${raceId}:${courseId}` line 329 — Coder port pattern cho admin:course-stats invalidation
- **Tech note:** Coder có 2 lựa chọn cho clear-apiUrl:
  - **(A) NEW endpoint** PATCH `/clear-api-url` (BA chốt) — invoke `racesService.updateCourse(raceId, courseId, { apiUrl: undefined })` internally + emit audit log
  - **(B) REUSE** trực tiếp existing endpoint — không có audit log dedicated
  - Manager confirm **(A)** vì BA đã chốt + Danny đã verify

### 6. `admin/src/app/(dashboard)/races/[id]/settings/sections/CourseSection/CourseTable.tsx`
- ✅ Đọc full file (194 lines)
- ✅ 7 action buttons hiện tại: Download / RefreshCw / RotateCcw / Copy / Pencil / Trash2 — Coder insert button **🔌 PlugZap** vị trí giữa RotateCcw và Copy (sau Reset, trước Clone)
- ✅ Existing pattern `onResetData(course.courseId)` (line 146) — Coder extend signature `onResetData(course.courseId, course.name, options)` để pass through cron-aware dialog params

### 7. `backend/src/modules/audit/services/audit-log.service.ts` + `contracts/services/contract-audit.service.ts` (F-067 pattern)
- ✅ `AuditLogService.emit({ actor, action, entity, metadata })` signature line 47 — best-effort no-throw
- ✅ F-067 wrapper pattern `@Optional() private readonly auditLog?: AuditLogService` line 51 — Coder port cho `CourseAuditService` mới (nếu nhiều call sites) hoặc inline emit nếu chỉ 3 call site
- **Manager recommend inline emit** trong AdminService cho F-068 — chỉ 3 emit site (clear-apiUrl + disable-and-reset + reset-data), không cần wrapper service

---

## 📊 Cross-check với memory

### Architecture impact

Feature thêm:
- 1 NEW service `CourseDataStatsService` (poll Mongo countDocuments + sync_logs + apiUrl + cron status, Redis 5s cache wrap)
- 3 NEW endpoint dưới AdminController (`/data-stats` GET + `/clear-api-url` PATCH + `/disable-and-reset` POST)
- 1 EXTEND response shape `/reset-data` POST (append-only)
- 2 NEW public method trên `RaceSyncCron` (isCurrentlySync + getNextScheduledRunAt)
- 2 signature CHANGE (deleteResultsByCourse + purgeCache: `(courseId)` → `(raceId, courseId)`)
- 1 NEW Redis key pattern `admin:course-stats:<raceId>:<courseId>` TTL 5s
- 5 RENAME legacy Redis keys (`leaderboard:<courseId>` → `leaderboard:<raceId>:<courseId>` + 4 keys khác)

Architecture diagram update sau ship: thêm node `CourseDataStatsService` dưới AdminModule, mũi tên đến RaceSyncCron + RaceResultService + RacesService.

### Convention impact

- ✅ Reuse atomic `findOneAndUpdate` pattern (conventions.md đã có) cho clear-apiUrl + reset
- 🆕 **NEW pattern:** Redis SETNX lock cho concurrent mutation (port từ F-018 medical / F-019 awards — `awards:state-lock:<podiumId>` TTL 5s pattern). F-068 dùng `reset-lock:<raceId>:<courseId>` TTL 30s
- 🆕 **NEW pattern:** Cron lifecycle expose helper `isCurrentlySync()` + `getNextScheduledRunAt()` — pattern này có thể tái sử dụng cho các cron khác cần UI feedback
- 🆕 **NEW pattern:** Admin polling endpoint với short TTL (5s) cache wrap — cost-control cho multi-admin scenario

Sau ship Manager add 3 pattern này vào conventions.md.

### Known issues impact

- 🔴 **Pre-existing bug Manager catch 2026-05-31** — `deleteResultsByCourse(courseId)` thiếu raceId + `purgeCache` pattern mismatch — F-068 BR-68-10 + BR-68-11 fix → RESOLVE in `/5bib-deploy` known-issues update
- 🟡 **TD-CONTRACTS-ACTOR-001 carry-forward** — F-068 chấp nhận hardcode 'admin' Phase 1 (Danny chốt G defer F-069). Manager append TD-F068-COURSE-ACTOR-CARRY-FORWARD vào known-issues
- 🟡 **TD-F029-05 race-result spec failures** — pre-existing 5 spec fail trong `race-result.service.spec.ts` (purgeCache spec broken). Coder MUST KHÔNG depend on broken specs. Khi đổi signature → có thể RESOLVE TD-F029-05 nếu Coder cover unit test mới chuẩn.

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ được thay đổi các file/folder sau. Đụng ngoài = scope creep, phải hỏi Manager.

### Backend (apps/api → repo `backend/`)

**NEW files:**
- ➕ `backend/src/modules/admin/services/course-data-stats.service.ts` — wrapper poll Mongo+Redis+cron status
- ➕ `backend/src/modules/admin/services/course-data-stats.service.spec.ts` — unit test
- ➕ `backend/src/modules/admin/dto/course-data-stats.dto.ts` — response DTO + DTOs cho clear-apiUrl + disable-and-reset
- ➕ `backend/src/modules/admin/admin.controller.f068.spec.ts` HOẶC extend existing spec — 3 endpoint test

**MODIFY:**
- ✏️ `backend/src/modules/admin/admin.controller.ts` — thêm 3 endpoint mới (data-stats GET + clear-api-url PATCH + disable-and-reset POST) + EXTEND reset-data response
- ✏️ `backend/src/modules/admin/admin.service.ts` — extend resetData() response + thêm method `clearApiUrl()`, `disableAndReset()`, `getCourseDataStats()` (hoặc delegate vào CourseDataStatsService)
- ✏️ `backend/src/modules/admin/admin.module.ts` — register CourseDataStatsService + import RaceSyncCron (transitive via RaceResultModule existing)
- ✏️ `backend/src/modules/race-result/services/race-result.service.ts` — **SIGNATURE CHANGE** lines 1796 + 331:
  - `deleteResultsByCourse(courseId: string)` → `deleteResultsByCourse(raceId: string, courseId: string)` — filter `{ raceId, courseId }`
  - `purgeCache(courseId: string)` → `purgeCache(raceId: string, courseId: string)` — patterns fix per BR-68-11
- ✏️ `backend/src/modules/race-result/services/race-sync.cron.ts` — thêm 2 method public:
  - `isCurrentlySync(): boolean` (return this.isSyncing)
  - `getNextScheduledRunAt(): Date | null` (compute next */10 minute mark UTC, return null nếu isSyncing)
- ✏️ `backend/src/modules/race-result/services/race-result.service.ts` — update internal callers of `deleteResultsByCourse` + `purgeCache` (lines 414, 455, 1798) cho signature mới
- ✏️ `backend/src/modules/race-result/services/race-result.service.spec.ts` — update mock signature (TD-F029-05 chỉ fix nếu Coder thấy nhanh, else defer)

### Admin frontend

**NEW components:**
- ➕ `admin/src/components/course-data-ops/CourseDataStatsBadge.tsx` — 3 sub-badge stack
- ➕ `admin/src/components/course-data-ops/ResetDataConfirmDialog.tsx` — AlertDialog cron-aware
- ➕ `admin/src/components/course-data-ops/ClearApiUrlConfirmDialog.tsx` — AlertDialog clear apiUrl
- ➕ `admin/src/components/course-data-ops/index.ts` — barrel export

**NEW hooks:**
- ➕ `admin/src/lib/hooks/use-course-data-stats.ts` — TanStack Query poll 5s + 3 mutation hooks

**MODIFY:**
- ✏️ `admin/src/app/(dashboard)/races/[id]/settings/sections/CourseSection/CourseTable.tsx` — extend column "Tình trạng" + button 🔌 + dialog integration
- ✏️ `admin/src/app/(dashboard)/races/[id]/settings/sections/CourseSection/CourseSection.tsx` — extend handler `onClearApiUrl`, `onResetData` signature pass `courseName` + dialog state

**SDK regen (auto):**
- 🔄 `admin/src/lib/api-generated/*.ts` (auto via `pnpm --filter admin generate:api`)

### Memory (Manager owns — Coder KHÔNG đụng)
- `.5bib-workflow/memory/conventions.md` — sau `/5bib-deploy` Manager append 3 NEW patterns
- `.5bib-workflow/memory/known-issues.md` — Manager append TD + RESOLVE pre-existing
- `.5bib-workflow/memory/architecture.md` — Manager add node CourseDataStatsService

---

## 🔧 Tech approach (đề xuất, Coder có thể tinh chỉnh)

### Backend implementation order (Coder follow)

1. **Phase 1 — Pre-existing bug fix (refactor, no new feature):**
   - Đổi signature `deleteResultsByCourse(raceId, courseId)` + `purgeCache(raceId, courseId)`
   - Update 3 call sites (admin.service line 67, race-result.service line 414 + 455 + 1798)
   - Update spec mocks (TD-F029-05 fix nếu thuận tiện)
   - Add 2 regression test (TC-68-14 cross-race + TC-68-15 cache pattern)
   - Sanity test: tsc clean + jest --testPathPattern=race-result PASS

2. **Phase 2 — Cron lifecycle expose:**
   - `RaceSyncCron.isCurrentlySync()` + `getNextScheduledRunAt()` (compute từ UTC)
   - Unit test: mock `Date.now()`, assert next 10-min mark + null khi syncing
   - Edge case: ngày chuyển tháng / năm — verify `Math.ceil` không break

3. **Phase 3 — CourseDataStatsService NEW:**
   - DI: `@InjectModel(RaceResult.name)` + `@InjectModel(SyncLog.name)` + `@Inject(REDIS_CLIENT)` + `RacesService` + `RaceSyncCron`
   - Method `getStats(raceId, courseId): Promise<CourseDataStatsResponseDto>`
   - Logic:
     - Cache GET `admin:course-stats:${raceId}:${courseId}` — hit → return
     - Cache miss → fetch parallel: countDocuments + sync_logs latest + race.findOne courses.$ — wrap Promise.all
     - Verify race exists + course in race.courses array → throw NotFoundException nếu không
     - Compute cronStatus + nextCronAt theo BR-68-06
     - Mask apiUrl (BR-68-05 + Danny chốt C: URL <16 chars return raw, KHÔNG mask)
     - Cache SET TTL 5s
   - Unit test: 5 case (hit cache, miss + data, miss + empty sync, course not found, cron in_progress)

4. **Phase 4 — Endpoint clear-api-url:**
   - DTO `ClearApiUrlDto { confirmedLive?: boolean }`
   - Service `clearApiUrl(raceId, courseId, dto)`:
     - Verify race + course exists (throw 404)
     - Check race.status === 'live' && !dto.confirmedLive → throw ConflictException 409 với code `RACE_IS_LIVE_CONFIRM_REQUIRED`
     - Save prevApiUrl raw (for audit metadata)
     - Call `racesService.updateCourse(raceId, courseId, { apiUrl: undefined })` (existing $unset pattern)
     - Redis DEL `admin:course-stats:${raceId}:${courseId}`
     - Emit audit log `course.apiUrl.cleared` với metadata `{ raceId, courseId, prevApiUrl, raceWasLive: confirmedLive }`
   - Unit test: 4 case (happy + race live no confirm 409 + race live with confirm OK + course not found 404)

5. **Phase 5 — Endpoint disable-and-reset (atomic combo):**
   - DTO `DisableAndResetDto { confirmedLive?: boolean }`
   - Service `disableAndReset(raceId, courseId, dto)`:
     - **Manager NEW MANDATE (Danny chốt H):** Redis SETNX lock `reset-lock:${raceId}:${courseId}` TTL 30s — chỉ 1 winner. Loser nhận 409 `RESET_IN_PROGRESS`
     - Verify race + course
     - Check race.status === 'live' && !confirmedLive → 409
     - Save prevApiUrl + start timer for durationMs
     - **Step 1:** `racesService.updateCourse(raceId, courseId, { apiUrl: undefined })` (clear apiUrl FIRST)
     - **Step 2:** Wait `raceSyncCron.isCurrentlySync()` poll mỗi 200ms × timeout 5s. If timeout → log warn "cron wait timeout exceeded", continue anyway
     - **Step 3:** `raceResultService.deleteResultsByCourse(raceId, courseId)` (với raceId filter)
     - **Step 4:** Redis DEL `admin:course-stats` (purgeCache đã được gọi inside deleteResultsByCourse)
     - **Step 5:** Emit audit log `course.disabled_and_reset` với metadata
     - **Step 6:** Redis DEL lock key
     - Return `{ message, deletedCount, success, prevApiUrlMasked, durationMs, hasApiUrl: false, nextCronAt: null }`
   - Unit test: 6 case (happy + cron mid-flight wait + cron stuck timeout + race live no confirm + cross-race safety regression + concurrent lock)

6. **Phase 6 — Endpoint reset-data EXTEND response:**
   - DTO `ResetDataDto { confirmedLive?: boolean }` (NEW optional)
   - Service `resetData(raceId, courseId, dto)`:
     - **Manager NEW MANDATE (Danny chốt H):** Redis SETNX lock như Phase 5
     - Verify race + course
     - Check race.status === 'live' && !confirmedLive → 409
     - Start timer
     - Call `raceResultService.deleteResultsByCourse(raceId, courseId)` (signature fixed)
     - Redis DEL `admin:course-stats`
     - Emit audit log `course.data_reset` với metadata `{ raceId, courseId, deletedCount, raceWasLive }`
     - Compute `nextCronAt` + `hasApiUrl` from race doc
     - Return EXTEND shape `{ message, deletedCount, success, nextCronAt, hasApiUrl, durationMs }`
   - Unit test: 5 case (happy + race live no confirm + concurrent lock + cross-race regression + audit emit verify)

7. **Phase 7 — Endpoint data-stats GET:**
   - Controller decorator stack: `@Get('races/:raceId/courses/:courseId/data-stats')` + `@ApiResponse 200/401/403/404/500`
   - Delegate to `CourseDataStatsService.getStats()`
   - Unit test cover trong CourseDataStatsService spec (Phase 3)

### Admin implementation order

1. **Phase 8 — SDK regen** sau khi backend ready: `pnpm --filter admin generate:api`
2. **Phase 9 — Hooks** `useCourseDataStats` (poll 5s) + 3 mutations
3. **Phase 10 — Components** 3 NEW (badge + 2 dialog)
4. **Phase 11 — Wire CourseTable**: extend column + button + dialog state
5. **Phase 12 — Browser self-test** mandatory (5bib-fullstack-engineer skill bước 5-6):
   - Verify mobile 375px responsive
   - Verify race live typed confirmation enable/disable
   - Verify polling pause khi tab blur
   - Verify post-reset poll snapshot (combo: forever; non-combo: 5×2s stop)

---

## 🛑 PAUSE points cho Coder

Trước khi làm các bước sau, Coder DỪNG và confirm với Danny:

- 🛑 **PAUSE-Coder-68-01:** Trước khi đổi signature `deleteResultsByCourse` + `purgeCache` (refactor đụng 3 call site + spec) — Manager đã pre-approve via PRD BR-68-10/11, Coder vẫn confirm "Bắt đầu refactor signature?" 1 lần để align
- 🛑 **PAUSE-Coder-68-02:** Trước khi thêm Redis SETNX lock pattern (Danny chốt H 2026-05-31 sau PRD) — Coder confirm hiểu pattern F-018/F-019 port + 409 code `RESET_IN_PROGRESS` + TTL 30s
- 🛑 **PAUSE-Coder-68-03:** Nếu `sync_logs` collection chưa có compound index `{raceId: 1, courseId: 1, created_at: -1}` (Coder verify với `db.sync_logs.getIndexes()`) → propose add migration script. Nếu performance test OK không có index → defer TD
- 🛑 **PAUSE-Coder-68-04:** Nếu phát hiện cần đụng file ngoài Scope Lock — phải hỏi Manager update plan
- 🛑 **PAUSE-Coder-68-05:** Trước khi mark READY_FOR_QC — verify tất cả 10 bước Self-Review Pipeline (skill 5bib-fullstack-engineer mandate) đặc biệt bước 5 (PROD-readiness smoke test) + bước 6 (UI/UX self-inspection real browser test 4 dialog states)

---

## 🆕 Decisions Danny chốt SAU PRD (post-BA, Manager document)

> 14 decisions Danny đã trả lời trong session 2026-05-31 sau khi BA output PRD. Coder follow plan này KHÔNG PRD (BA đã ship 🔵 READY, không edit PRD):

### Edge case answers (A/C/D/G/H)

- **A — Post-reset poll behavior:**
  - **Combo flow** (apiUrl đã clear via disable-and-reset HOẶC checkbox checked) → poll forever đến rowCount=0
  - **Reset thuần** (apiUrl còn) → poll 5 lần × 2s rồi stop (BA original design giữ — tránh stuck do cron re-insert)

- **C — apiUrl mask edge case:**
  - URL <16 chars → return raw KHÔNG mask (Danny chốt Option 1)

- **D — Race chuyển status mid-action:**
  - Toast đỏ `"Race vừa chuyển LIVE, vui lòng xác nhận lại"` + re-open dialog với typed confirmation visible (Option 1)

- **G — Audit actor:**
  - Hardcode `'admin'` Phase 1, defer F-069 (TD-CONTRACTS-ACTOR-001 carry-forward)
  - → Manager append TD-F068-COURSE-ACTOR-CARRY-FORWARD vào known-issues at deploy

- **H — Concurrent reset lock:**
  - **ADD Redis SETNX** lock `reset-lock:${raceId}:${courseId}` TTL 30s — chỉ 1 winner xóa thực sự, others nhận 409 với `code: 'RESET_IN_PROGRESS'`, message VN `"Đang có người khác xóa, chờ vài giây"`
  - Pattern port từ F-018 medical (`medical:incident-lock`) / F-019 awards (`awards:state-lock`)
  - Apply cho cả `/reset-data` + `/disable-and-reset` (KHÔNG cho `/clear-api-url` — không destructive on data)

### BA defaults Danny verified OK (#1-9)

- **1 UX combo:** 1 button + checkbox "Tắt auto-sync trước" mặc định ON nếu có apiUrl ✓
- **2 Race live:** typed confirmation (gõ courseName) — KHÔNG block hoàn toàn ✓
- **3 Race ended/draft:** KHÔNG warning ✓
- **5 Polling:** 5s + pause khi tab blur — KHÔNG "stale Xphút" warning ✓
- **7 Audit action names:** `course.apiUrl.cleared`, `course.disabled_and_reset`, `course.data_reset` ✓
- **8 SLA target 100K rows:** cold p95 <500ms ✓
- **9 Cache key rename:** deploy non-race-day, accept 1 lần cache miss ✓

### Implication cho test plan

- TC-68-16 "Concurrent reset-data 10x stability" — BA original viết vague "deletedCount sum=100". **Manager UPDATE per Danny chốt H:** 10 concurrent → 1 success (deletedCount=100) + 9 conflict 409 với code `RESET_IN_PROGRESS`. Pattern F-018 SETNX assertion.

---

## 🧪 Unit test BẮT BUỘC

Coder không được mark feature `READY_FOR_QC` nếu thiếu các test sau:

### Backend

**`course-data-stats.service.spec.ts` (NEW):**
- [ ] TC-68-01 happy path với cache hit
- [ ] TC-68-01 happy path cache miss → SET cache
- [ ] TC-68-02 empty stats (chưa sync)
- [ ] TC-68-03 cron in_progress → cronStatus + nextCronAt null
- [ ] TC-68-04 race not found → 404
- [ ] TC-68-05 course not found → 404
- [ ] BR-68-05 apiUrlMasked: URL dài → head8+tail8, URL <16 → raw (Danny chốt C)
- [ ] BR-68-06 nextCronAt compute edge: now=12:34 → next=12:40 + now=12:30:00 → next=12:40 (NOT 12:30)

**`race-result.service.spec.ts` (UPDATE signature):**
- [ ] TC-68-14 cross-race wipe regression — race A + race B cùng courseId='200m', reset race A → race B unchanged
- [ ] TC-68-15 cache pattern fix — pre-populate 5 keys (results/athlete/badge/leaderboard/stats với raceId mới), reset → all deleted

**`race-sync.cron.spec.ts` (NEW hoặc extend existing):**
- [ ] `isCurrentlySync()` return false default
- [ ] `isCurrentlySync()` return true khi handleCron running (mock setTimeout)
- [ ] `getNextScheduledRunAt()` compute đúng UTC */10 minute mark
- [ ] `getNextScheduledRunAt()` return null khi isSyncing=true

**`admin.service.spec.ts` (extend):**
- [ ] `clearApiUrl()` happy path + emit audit
- [ ] `clearApiUrl()` race live no confirm → 409
- [ ] `clearApiUrl()` race live with confirmedLive → 200
- [ ] `disableAndReset()` atomic order verify (clear apiUrl FIRST, then wait cron, then delete)
- [ ] `disableAndReset()` cron stuck 5s timeout → continue
- [ ] `disableAndReset()` Redis lock 409 RESET_IN_PROGRESS (Danny chốt H)
- [ ] `resetData()` EXTEND response shape `{ nextCronAt, hasApiUrl, durationMs }`
- [ ] `resetData()` Redis lock 409 (Danny chốt H)

**Stability:**
- [ ] TC-68-16 10x concurrent reset → 1 success + 9 conflict 409

### Admin (test plan, QC sẽ E2E)

Coder KHÔNG bắt buộc viết Playwright (QC sẽ làm), nhưng PHẢI verify trên browser thật theo Self-Review Pipeline bước 6:
- Mobile 375px responsive
- Race live typed confirmation
- Polling pause khi tab blur
- Post-reset poll combo (forever) vs non-combo (5×2s)

---

## 📊 Verdict

> ### ✅ APPROVED — Coder có thể bắt đầu

**Conditions:**
1. Follow PAUSE-Coder-68-01..05 strict
2. Implement order Phase 1 → 12 — KHÔNG đảo lộn (Phase 1 refactor signature trước, tránh spec break cascade)
3. Apply Danny chốt H Redis SETNX lock cho 2 endpoint mutate data
4. Browser self-test mandatory (5bib-fullstack-engineer Self-Review Pipeline bước 6)
5. SDK regen sau khi backend ready (Phase 8 trước Phase 9)

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] **Yes** — Coder có thể bắt đầu, theo Scope Lock + PAUSE points + 12-phase implementation order

---

## 🔗 Next step

Danny chạy: `/5bib-code FEATURE-068-course-data-ops-ux`
