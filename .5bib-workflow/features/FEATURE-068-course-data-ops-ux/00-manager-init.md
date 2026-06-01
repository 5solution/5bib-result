# FEATURE-068: Course Data Ops UX — Visibility + Cron-Aware Reset

**Status:** 🟡 INITIATED
**Created:** 2026-05-31
**Owner:** Danny
**Type:** EXTEND_EXISTING
**Created by:** 5bib-manager

---

## 🎯 Why this feature

Trong vận hành ngày thi đấu, Danny xóa data course (race `lets-run-2026` PROD) nhiều lần liên tiếp nhưng **không biết tiến độ + không biết tại sao data quay lại**. Hai gap thực tế:

1. **Visibility gap:** Click button xóa → toast generic "Xóa thành công" → user nghi data còn → click lại 5 lần (PROD log xác nhận 5 lần POST reset-data trong 1 phút). UI không hiển thị số rows hiện có / lần sync cuối / cron status.
2. **Silent killer cron:** `RaceSyncCron @Cron(EVERY_10_MINUTES)` tự pull vendor RaceResult.com cho mọi course còn `apiUrl` → reset xong bị overwrite 10 phút sau mà user không biết. UI không có cảnh báo, không có cách tắt nhanh.

Race ngày thi đấu nếu nhập data sai → cần **làm lại nhanh + biết kết quả tức thì + thông báo team chính xác**.

---

## 📂 Impact Map (theo memory hiện tại)

> Manager đã đọc `codebase-map.md` + `architecture.md` + `feature-log.md` (F-064/65/66/67 entries) + `known-issues.md` (TD-2026-05-12-CRIT-04 SSRF apiUrl, TD-F029-05 race-result spec debt). Đã spot-check code thật của CourseTable + admin.service + races.service.

### Module sẽ chạm

- `backend/src/modules/admin/` — extend admin controller + service (2 endpoint mới + 1 endpoint extend response)
- `backend/src/modules/race-result/services/race-result.service.ts` — expose `getCourseRowCount(raceId, courseId)` helper (Mongo countDocuments — không có hiện tại, hoặc reuse aggregation)
- `backend/src/modules/race-result/services/race-sync.cron.ts` — expose `getNextScheduledRunAt()` để frontend hiển thị "Sync tiếp theo: HH:MM"
- `backend/src/modules/races/races.service.ts` — `updateCourse()` đã support `$unset` qua `undefined` value (reuse pattern, KHÔNG tạo endpoint mới — Coder evaluate option)
- `admin/src/app/(dashboard)/races/[id]/settings/sections/CourseSection/` — `CourseTable.tsx` extend + parent `CourseSection.tsx` handler mới

### File then chốt cần Coder đọc trước khi code

- `backend/src/modules/admin/admin.controller.ts:65-75` — endpoint `reset-data` hiện tại (class-level `@UseGuards(LogtoAdminGuard)`)
- `backend/src/modules/admin/admin.service.ts:66-73` — `resetData()` delegate `deleteResultsByCourse(courseId)` (CHỈ truyền courseId — đã bị Danny challenge hôm nay, courseId không globally unique → cần truyền cả raceId vào filter để safe)
- `backend/src/modules/race-result/services/race-result.service.ts:1796-1800` — `deleteResultsByCourse(courseId)` — filter `{ courseId }` ONLY, không có `raceId`. **Pre-existing bug** Manager đã catch trong session 2026-05-31 audit: nếu 2 race khác nhau có cùng `courseId="200m"` → reset 1 race wipe cả 2. F-068 PHẢI fix luôn (atomic field update + raceId filter)
- `backend/src/modules/race-result/services/race-result.service.ts:331-356` — `purgeCache(courseId)` cache pattern mismatch bug (đã catch session 2026-05-31 — pattern `results:${courseId}:*` không match `results:<raceId>:<courseId>:*`). F-068 PHẢI fix luôn vì sau reset cache stale 24h
- `backend/src/modules/race-result/services/race-sync.cron.ts:12` — `@Cron(CronExpression.EVERY_10_MINUTES)` — Coder cần expose helper compute next run UTC time
- `backend/src/modules/races/schemas/race.schema.ts:41` — `@Prop() apiUrl?: string` (already optional, no schema migration)
- `admin/src/app/(dashboard)/races/[id]/settings/sections/CourseSection/CourseTable.tsx` — current 7 action buttons (Download/RefreshCw/RotateCcw/Copy/Pencil/Trash2) → cần insert action "Clear apiUrl" + extend row với data-stats badge
- `admin/src/app/(dashboard)/races/[id]/settings/sections/section-shared.types.ts` — `Course` type (Coder verify field shape)

### Endpoint liên quan

- **(NEW)** `GET /api/admin/races/:raceId/courses/:courseId/data-stats` — response `{ rowCount, lastSyncedAt, lastSyncStatus, lastSyncDurationMs, hasApiUrl, apiUrlMasked, nextCronAt, lastActorId? }`. Auth: `LogtoAdminGuard` (class-level). Cache: Redis 5s TTL key `admin:course-stats:<raceId>:<courseId>` để tránh hit Mongo count + sync_logs query mỗi 5s × N course
- **(EXTEND)** `POST /api/admin/races/:raceId/courses/:courseId/reset-data` — response thêm `{ nextCronAt, hasApiUrl, durationMs }`. **Backward compat OK** (chỉ thêm field, không rename/remove). KHÔNG break SDK.
- **(NEW)** `PATCH /api/admin/races/:raceId/courses/:courseId/clear-api-url` — Coder evaluate 2 options: (a) tạo PATCH endpoint riêng emit audit log + (b) reuse existing `PATCH /admin/races/:raceId/courses/:courseId` với `apiUrl: null` body. Manager prefer **option (a)** vì cần audit log + explicit semantic ("Tắt đồng bộ") + UI có CTA riêng. Verify với BA.
- **(OPTIONAL — Phase 1+)** Endpoint atomic combo "clear + reset": `POST /api/admin/races/:raceId/courses/:courseId/disable-and-reset` — clear apiUrl trước rồi mới deleteMany, đảm bảo cron không re-pull giữa 2 step. Manager đề xuất, BA confirm.

### Schema/DB

- **MongoDB `races` collection:** KHÔNG schema change (`apiUrl` đã `optional`). Chỉ UPDATE via `$unset` hoặc `$set: null` (reuse existing `updateCourse()` $unset pattern lines 293-334)
- **MongoDB `race_results` collection:** KHÔNG schema change. Chỉ `countDocuments({ raceId, courseId })` — verify Mongo có index `{ raceId: 1, courseId: 1 }` (Coder check `race-result.schema.ts`); nếu chưa có → flag PAUSE add compound index
- **MongoDB `sync_logs` collection:** KHÔNG schema change. Query latest `findOne({ raceId, courseId }).sort({ created_at: -1 })`. Verify index `{ raceId: 1, courseId: 1, created_at: -1 }` (Coder check)
- **MongoDB `audit_logs` collection:** Thêm action type `course.apiUrl.cleared` — verify enum trong codebase (nếu có) hoặc convention string literal
- **Redis:**
  - NEW key `admin:course-stats:<raceId>:<courseId>` TTL 5s — register vào CLAUDE.md Redis Keys Registry
  - DEL key này sau mọi mutation (reset-data, clear-apiUrl, force-sync, update-course)
- **MySQL platform:** KHÔNG đụng

---

## ⚠️ Risk Flags

> Manager đã cross-check `known-issues.md`:
> - **TD-2026-05-12-CRIT-04 (SSRF apiUrl)** — defer-able, F-068 KHÔNG fix nhưng phải KHÔNG mở thêm vector (clear-apiUrl chỉ DELETE field, không accept user URL input nên không tăng surface)
> - **TD-F029-05 (race-result.spec failures)** — pre-existing test infra debt, Coder phải KHÔNG depend on failing specs khi viết unit test mới
> - **Pre-existing bug Manager caught 2026-05-31** — `deleteResultsByCourse(courseId)` thiếu raceId filter + `purgeCache` pattern mismatch — F-068 PHẢI fix (in-scope)

- 🔴 **HIGH — Ops impact:** "Clear apiUrl" có thể bị nhấn nhầm trong race day live. Hậu quả: vendor live timing data ngừng update → leaderboard freeze giữa race. **Mitigation MANDATE:** confirm dialog với race title + course name + nhắc "race đang LIVE" nếu `race.status === 'live'`. BA mô tả copy text VN chuẩn.

- 🔴 **HIGH — Race condition cron vs reset:** Nếu cron đang sync mid-flight mà user nhấn "Clear apiUrl + Reset data" combo → race condition: clear apiUrl thành công, cron đã start với apiUrl cũ (snapshot trong `getRacesWithApiUrls()` line 391) → cron insert data sau khi deleteMany xong → user thấy data còn. **Mitigation MANDATE:** atomic order `clear apiUrl FIRST → wait current cron iteration done (poll `isSyncing` flag race-sync.cron.ts:8) → deleteMany`. Hoặc dùng SETNX lock `master:cron-lock:<raceId>:<courseId>` (TTL 60s) tương tự pattern F-018 medical/F-019 awards trong CLAUDE.md.

- 🔴 **HIGH — Pre-existing bug surface scope creep:** `deleteResultsByCourse(courseId)` filter thiếu raceId — F-068 MUST fix vì user-facing trust ("xóa course 200m race A không được wipe course 200m race B"). Manager flag SCOPE-IN, BA encode BR-XX explicit.

- 🟡 **MED — Admin UX layout:** CourseTable hiện 7 action buttons + 4 column. Thêm 1 button + data-stats badge inline → mobile có thể bị overflow. Test với:
  - Race 4 courses (200m/400m/800m/1000m — `lets-run-2026`)
  - Race 1 course (vd `5K-fun-run`)
  - Race 4 courses + 1 course 70K trail có distance string dài

- 🟡 **MED — Polling cost:** 5s poll × N course × M admin user → Mongo countDocuments + sync_logs query × poll. Race lớn 30K rows × 4 course × 3 admin = 720 query/phút. **Mitigation MANDATE:** Redis cache TTL 5s key `admin:course-stats:<raceId>:<courseId>` để mỗi 5s chỉ hit Mongo 1 lần/course (1×60×4 = 240 query/phút regardless of admin count). BA + Coder verify performance SLA p95 < 200ms cold, < 50ms cache hit.

- 🟡 **MED — Cron next-run computation:** `@Cron(CronExpression.EVERY_10_MINUTES)` = `*/10 * * * *` (UTC). Compute "next run = ceil(now_minutes / 10) * 10". Edge case: cron đang chạy mid-iteration → next run là "đang chạy" → UI hiển thị gì? BA quyết option (a) "Đang sync..." (b) "Sync tiếp theo: now+10min".

- 🟢 **LOW — Backend endpoint mới:** chỉ 1 GET read-only + 1 PATCH atomic field update + 1 endpoint extend response. Không touch fee logic, không touch auth, không touch leaderboard cache.

- 🟢 **LOW — SDK regen:** đổi DTO backend → Coder phải chạy `pnpm --filter admin generate:api`. Convention đã có.

- 🟢 **LOW — i18n:** copy text VN chuẩn theo convention "KHÔNG render raw enum" (CLAUDE.md). BA viết Vietnamese-only.

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

> Manager liệt kê các câu hỏi nghiệp vụ chưa rõ. BA phải trả lời trong `01-ba-prd.md`.

### PAUSE-68-01: Clear apiUrl endpoint shape

Option A: **NEW endpoint** `PATCH /api/admin/races/:raceId/courses/:courseId/clear-api-url` (no body, explicit action, easier audit)
Option B: **REUSE existing** `PATCH /api/admin/races/:raceId/courses/:courseId` với body `{ apiUrl: null }` (less endpoint, BUT loose semantic — admin có thể accidentally clear khi sửa course config khác)

Manager prefer **A** vì explicit semantic + audit log clear. BA confirm hoặc đề xuất khác.

### PAUSE-68-02: Audit log integration

`auditLog.emit({ action: 'course.apiUrl.cleared', resourceId, actorId, metadata: { raceId, courseId, prevApiUrl })`. BA verify:
- AuditLogService có sẵn không? (F-024/F-066/F-067 đã dùng — yes có)
- Action name convention: `course.apiUrl.cleared` (dotted lowercase) phù hợp existing?
- `actorId` lấy từ JWT — TD-CONTRACTS-ACTOR-001 carry-forward (hardcode 'admin' acceptable Phase 1) HAY F-068 fix proper JWT actor luôn?

### PAUSE-68-03: Atomic combo "Clear apiUrl + Reset data"

Có cần endpoint combo `POST /disable-and-reset` không, hay UI chia 2 button (Clear apiUrl → confirm → Reset → confirm)? Manager đề xuất:
- **Default UX:** UI 1 button "Xóa data vĩnh viễn" với checkbox "Tắt auto-sync trước khi xóa" mặc định checked nếu `hasApiUrl=true` → backend tự handle atomic 2-step
- BA quyết UX flow + Coder tự chọn 1 endpoint combo hay 2 sequential

### PAUSE-68-04: Cron mid-flight UI state

Khi `RaceSyncCron.handleCron()` đang chạy (flag `isSyncing=true` line 8 race-sync.cron.ts:14) → `nextCronAt` trả về gì?
- Option A: trả `null` + status `'in_progress'` → UI badge "🔵 Đang đồng bộ..."
- Option B: trả thời gian `now + 10min` → UI hiển thị normal countdown
- Option C: trả `'PENDING'` literal → UI mơ hồ

Manager prefer **A** vì rõ ràng nhất cho ops.

### PAUSE-68-05: Race status live warning

`race.status` enum hiện có (Coder verify): `pre_race | live | ended | draft`. Khi click "Clear apiUrl" trên course thuộc race `status='live'` → confirm dialog có hiện warning đỏ "⛔ Race ĐANG DIỄN RA. Clear apiUrl sẽ ngừng live timing." không? BA quyết copy + có require typed confirmation ("gõ RACE-NAME để xác nhận") không.

### PAUSE-68-06: Polling fallback nếu endpoint chậm

Nếu `GET data-stats` p95 > 500ms (race lớn cold cache) → UI fallback gì?
- Option A: polling 10s thay vì 5s
- Option B: hiển thị placeholder "..." chờ load, không disable button
- Option C: degraded mode: chỉ poll 1 lần on-mount, không real-time

Manager prefer **B** (loading state placeholder không block user).

### PAUSE-68-07: Pre-existing bug scope

Manager đã catch 2 bug trong session 2026-05-31:
1. `deleteResultsByCourse(courseId)` thiếu raceId filter
2. `purgeCache(courseId)` pattern mismatch (`results:${courseId}:*` không match `results:<raceId>:<courseId>:*` + `athlete:`, `badge:` keys không invalidate)

BA confirm IN-SCOPE F-068 (Manager prefer) vì UI mới sẽ ngầm trust 2 bug này đã fix. Nếu defer → UI hiển thị "đã xóa 0 rows" do filter sai → user confuse tiếp.

### PAUSE-68-08: Performance SLA target

- `GET data-stats` cold (Mongo countDocuments + sync_logs latest): target p95 < 500ms cho race 100K rows? BA confirm số cụ thể.
- Cache hit ratio sau 5 phút warm: > 80%?
- Reset-data response time: ≤ 3s cho 100K rows deleteMany? (BA verify benchmark)

---

## 🎯 Success criteria (gợi ý cho BA)

- Sau khi click "Xóa data", trong vòng ≤ 10s, UI hiển thị `📊 0 rows` xác nhận (poll snapshot 2s × 5)
- 0% accidental "Clear apiUrl" trong race live (confirm dialog block + typed confirmation nếu PAUSE-68-05 chọn require)
- Toast success cụ thể: số rows + next sync ETA (hoặc "Đã tắt auto-sync")
- Per-course inline badge real-time (cập nhật ≤ 5s) hiển thị: row count + last sync time + cron status
- 0 case "xóa rồi data quay lại sau 10 phút" — vì combo clear apiUrl + reset atomic
- Pre-existing bugs `deleteResultsByCourse` + `purgeCache` fix → không còn cache stale + cross-race wipe
- Performance: `GET data-stats` p95 < 500ms cold + < 50ms cache hit (race 100K rows)
- Mobile UX: CourseTable không overflow trên viewport 375px (test với race 4 course)

---

## 🔗 Cross-reference với F-068 dự kiến trong feature-log

Feature-log entry F-067 ghi:
> **F-068 dự kiến** cho proper JWT actor attribution (resolve TD-CONTRACTS-ACTOR-001 carry-forward F-067) hoặc Athlete Count regex improve (F-064 PAUSE-64-12 defer) — Danny chốt scope khi mở init.

**Danny chốt 2026-05-31:** F-068 = Course Data Ops UX (Option A bundle 6 mục) thay vì 2 candidate cũ. TD-CONTRACTS-ACTOR-001 + TD-F064-ATHLETE-COUNT-REGEX defer F-069+ hoặc bundle với feature khác.

**OPTIONAL trong scope:** PAUSE-68-02 có thể fix actor attribution luôn nếu BA + Coder thấy effort low (extract JWT user ở guard, attach vào req.user → service đọc từ req). Manager đề xuất confirm với Danny ở PRD.

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] **Yes — BA có thể bắt đầu.** Scope rõ + 8 PAUSE conditions cần trả lời + impact map đầy đủ + pre-existing bug in-scope flagged.

---

## 🔗 Next step

Danny chạy: `/5bib-prd FEATURE-068-course-data-ops-ux`
