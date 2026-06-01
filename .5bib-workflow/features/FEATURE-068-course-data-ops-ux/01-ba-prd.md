# FEATURE-068: PRD — Course Data Ops UX (Visibility + Cron-Aware Reset)

**Status:** 🔵 READY
**Last updated:** 2026-05-31
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md`
- [x] Đã trả lời 8 PAUSE conditions trong file 00 (xem Section 8 cuối file)
- [x] Đã đọc `memory/codebase-map.md` (admin module + race-result + races module)
- [x] Đã đọc `memory/known-issues.md` (TD-2026-05-12-CRIT-04 SSRF apiUrl + TD-CONTRACTS-ACTOR-001 carry-forward)
- [x] Đã verify code thật: `RaceStatus enum`, `Course` type, `AuditLogService.emit` signature F-023 pattern, `RaceSyncCron.isSyncing` flag accessibility, `race_results` compound index `{raceId, courseId, bib}`

---

## 🎯 [Course Data Ops UX] — Goal + Scope

**Goal:**
- 5BIB Back-Office Admin phải **biết chính xác trạng thái dữ liệu của từng course** (số rows, lần sync cuối, có auto-sync không, sync tiếp theo lúc nào) và **xóa data tự tin trong race day live ops** (không bị silent cron re-sync, không double-click vì nghi data còn).
- Đồng thời fix 2 pre-existing bug Manager catch session 2026-05-31 (cross-race wipe + cache stale 24h).

**Scope:**
- ✅ **In scope:**
  1. NEW endpoint `GET /api/admin/races/:raceId/courses/:courseId/data-stats` (real-time row count + sync log + apiUrl + next cron)
  2. NEW endpoint `PATCH /api/admin/races/:raceId/courses/:courseId/clear-api-url` (explicit clear apiUrl + audit log)
  3. NEW endpoint `POST /api/admin/races/:raceId/courses/:courseId/disable-and-reset` (atomic combo clear apiUrl → wait isSyncing → deleteMany)
  4. EXTEND endpoint `POST /api/admin/races/:raceId/courses/:courseId/reset-data` response thêm `{ nextCronAt, hasApiUrl, durationMs }` (backward compat — append field only)
  5. FIX pre-existing bug `RaceResultService.deleteResultsByCourse(courseId)` thêm `raceId` filter (cross-race safety)
  6. FIX pre-existing bug `RaceResultService.purgeCache(courseId)` pattern + thêm `athlete:`, `badge:` invalidation
  7. NEW `RaceSyncCron.isCurrentlySync()` public getter + `getNextScheduledRunAt(): Date | null`
  8. NEW `CourseDataStatsService` wrapper (poll count + sync_logs + apiUrl + cron status) + Redis cache 5s
  9. Extend `CourseTable.tsx` UI với inline data-stats badge per row + new "Clear apiUrl" action button
  10. NEW confirm dialog cho reset-data + clear-apiUrl với cron-aware warning + typed confirmation khi `race.status === 'live'`
  11. NEW toast success cụ thể với số rows + next sync ETA
  12. NEW post-reset poll snapshot 2s × 5 (verify rowCount = 0)
  13. NEW `useCoursesDataStats` TanStack Query hook poll 5s

- ❌ **Out of scope:**
  - JWT actor attribution proper fix (TD-CONTRACTS-ACTOR-001) → defer F-069+ (Phase 1 chấp nhận hardcode `actor='admin'` per existing F-067 wrapper pattern)
  - SSRF apiUrl validation (TD-2026-05-12-CRIT-04) → defer (out of scope per known-issues)
  - WebSocket/SSE real-time progress streaming (Option B trong manager proposal) → defer Option B feature riêng
  - Course Health Dashboard tab mới (Option C trong manager proposal) → defer Option C feature riêng
  - Reset-data progress bar cho race lớn 100K+ rows → defer Option B (5s poll snapshot đã đủ cho race ≤10K rows phổ biến)
  - Athlete count regex F-064 PAUSE-64-12 → defer F-069+
  - Migration backfill `sync_logs` retroactive cho races cũ → out of scope (chỉ track từ F-068 ship trở đi, F-023 pattern)

---

## 👤 User Stories & Business Rules

### User Stories

- As a **5BIB Back-Office Admin** (ops Hằng race day), I want to **biết chính xác course nào đã có bao nhiêu kết quả real-time** so that **tôi không phải double-click reset 5 lần để verify**.
- As a **5BIB Back-Office Admin** (ops Hằng), I want to **được cảnh báo khi course còn auto-sync trước khi xóa data** so that **tôi không bị silent re-sync 10 phút sau làm hỏng race day report**.
- As a **5BIB Back-Office Admin** (Tùng race director), I want to **tắt auto-sync vĩnh viễn cho course đã sai vendor URL** so that **tôi có thể manual nhập data đúng mà không bị overwrite**.
- As a **5BIB Back-Office Admin** (Tùng race director), I want to **được block khỏi nhấn nhầm "Clear apiUrl" trên race đang live** so that **tôi không vô tình ngừng live timing giữa race**.
- As a **5BIB Back-Office Admin** (Hiền finance), I want to **biết thời điểm sync tiếp theo của cron** so that **tôi báo chính xác cho team về delay update kết quả**.

### Business Rules

- **BR-68-01:** `GET data-stats` endpoint response field `rowCount` = `db.race_results.countDocuments({ raceId, courseId })` exact value (real-time, no estimate).
- **BR-68-02:** `lastSyncedAt` = `db.sync_logs.findOne({ raceId, courseId }).sort({ created_at: -1 }).created_at` HOẶC `null` nếu chưa từng sync.
- **BR-68-03:** `lastSyncStatus` ∈ `'success' | 'failed' | null` lấy từ `sync_logs` doc cuối cùng. `lastSyncDurationMs` từ cùng doc.
- **BR-68-04:** `hasApiUrl` = `Boolean(course.apiUrl && course.apiUrl.trim().length > 0)` — empty string KHÔNG count as has apiUrl.
- **BR-68-05:** `apiUrlMasked`: nếu `hasApiUrl=true` → return prefix `https://api.raceresult.com/402892/KHV8...` + suffix `...JGPJ4Q67MIH` (head 8 chars + ellipsis + tail 8 chars). KHÔNG return full apiUrl trong response (defense in depth — admin endpoint nhưng tránh log leak).
- **BR-68-06:** `nextCronAt` logic:
  - Nếu `RaceSyncCron.isCurrentlySync() === true` → return `null` + `cronStatus: 'in_progress'`
  - Nếu `hasApiUrl === false` → return `null` + `cronStatus: 'disabled'`
  - Else → return `getNextScheduledRunAt()` = `Math.ceil(now.getMinutes() / 10) * 10` next mark in UTC + `cronStatus: 'scheduled'`
- **BR-68-07:** `PATCH /clear-api-url` chỉ clear field `apiUrl` (set `null` via `$unset` reuse `RacesService.updateCourse()` pattern lines 293-334). KHÔNG đụng field khác của course. Emit audit log `course.apiUrl.cleared` với metadata `{ raceId, courseId, prevApiUrl }`.
- **BR-68-08:** `POST /disable-and-reset` atomic order:
  1. Update `course.apiUrl = null` (via `$unset`)
  2. Poll `RaceSyncCron.isCurrentlySync()` mỗi 200ms, timeout 5s → nếu vẫn `true` sau 5s → continue anyway (don't block forever — log warn)
  3. `deleteResultsByCourse(raceId, courseId)` (với raceId filter, fix pre-existing bug)
  4. `purgeCache(raceId, courseId)` (với pattern fix, fix pre-existing bug)
  5. Emit audit log `course.disabled_and_reset` với metadata `{ raceId, courseId, prevApiUrl, deletedCount }`
- **BR-68-09:** `POST /reset-data` (existing endpoint) response shape EXTEND thêm `nextCronAt`, `hasApiUrl`, `durationMs` — KHÔNG remove/rename field cũ (`message`, `deletedCount`, `success` giữ nguyên).
- **BR-68-10:** `deleteResultsByCourse` signature CHANGE: `(courseId: string) → (raceId: string, courseId: string)` — Mongo filter `{ raceId, courseId }` (fix pre-existing bug cross-race wipe). All call sites update.
- **BR-68-11:** `purgeCache` signature CHANGE: `(courseId: string) → (raceId: string, courseId: string)` — patterns extend:
  - `results:${raceId}:${courseId}:*` (fix)
  - `athlete:${raceId}:*` (NEW — F-068 invalidate)
  - `badge:${raceId}:*` (NEW)
  - `leaderboard:${raceId}:${courseId}` (rename from `leaderboard:${courseId}`)
  - `stats:${raceId}:${courseId}` (rename from `stats:${courseId}`)
  - `country-stats:${raceId}:${courseId}` (rename)
  - `time-distribution:${raceId}:${courseId}` (rename)
  - `filters:${courseId}` (giữ — pattern key này không có raceId nhưng global per courseId)
  - `percentile:v3:${raceId}:*` (NEW pattern)
  - `master:athlete:bib:${mysqlRaceId}` (skip — not Coder's responsibility, RaceMasterCacheService handles)
- **BR-68-12:** `data-stats` endpoint Redis cache key `admin:course-stats:${raceId}:${courseId}` TTL 5s. DEL trên mutation: reset-data, clear-apiUrl, disable-and-reset, force-sync, updateCourse.
- **BR-68-13:** `clear-apiUrl` + `disable-and-reset` action requires `race.status !== 'live'` OR explicit `confirmedLive: true` field in request body. Nếu `race.status === 'live'` AND `confirmedLive !== true` → return 409 `{ code: 'RACE_IS_LIVE_CONFIRM_REQUIRED', message: 'Race đang LIVE — gửi confirmedLive=true để xác nhận' }`.
- **BR-68-14:** `clear-apiUrl` Phase 1 actor hardcode `'admin'` (acceptable per TD-CONTRACTS-ACTOR-001 carry-forward F-067 lesson). Defer proper JWT actor F-069.
- **BR-68-15:** `data-stats` cron status `'in_progress'`: nếu poll endpoint detect `isSyncing=true` trong > 60s liên tục → log warn (cron stuck), KHÔNG fail endpoint, return `cronStatus: 'in_progress'`. Recovery TD-F068-CRON-STUCK-DETECT defer.
- **BR-68-16:** Frontend polling `useCoursesDataStats` interval `staleTime: 0, refetchInterval: 5000` (5s). Pause polling khi tab không focus (TanStack Query default `refetchIntervalInBackground: false`).
- **BR-68-17:** Toast success copy VN cụ thể:
  - Reset-data normal: `"Đã xóa {deletedCount} kết quả — course {courseName}. Lần sync tiếp theo: {nextCronRelativeTime}."`
  - Reset-data với hasApiUrl=false: `"Đã xóa {deletedCount} kết quả — course {courseName}. Auto-sync đang tắt."`
  - Clear-apiUrl: `"Đã tắt auto-sync course {courseName}. Vendor RaceResult sẽ không còn ghi đè."`
  - Disable-and-reset: `"Đã tắt auto-sync + xóa {deletedCount} kết quả — course {courseName}. Data sẽ KHÔNG tự đồng bộ lại."`
- **BR-68-18:** Post-reset poll snapshot: sau khi `POST /reset-data` thành công, frontend poll `GET /data-stats` mỗi 2s × tối đa 5 lần. Stop early nếu `rowCount === 0` trong response. Hiển thị inline progress trong badge: `📊 Đang xác nhận... (3/5)`.

---

## 🖥️ UI/UX Flow

### 6.1 Route structure

KHÔNG có route mới. Feature mở rộng UI trong route admin có sẵn:
- `/races/[id]/settings` (admin route, requires `LogtoStaffGuard` HOẶC `LogtoAdminGuard` per existing CourseSection guard) — section "Cự ly" chứa CourseTable

### 6.2 Layout description per screen

#### Screen 1: CourseTable extended view — Route `/races/[id]/settings` section "Cự ly"

**Header (unchanged):**
- Tiêu đề "Cự ly" + subtitle "Quản lý các cự ly của giải"
- Button top-right "➕ Thêm" (primary blue)

**Body — Table 5 columns (extend từ 5 column hiện tại + thêm column "Tình trạng"):**

| Column | Header | Width | Content |
|--------|--------|-------|---------|
| 1 | Tên | 200px | imageUrl thumbnail 14×14 + course.name bold |
| 2 | Khoảng cách | 100px (sm+ only) | course.distance |
| 3 | Giờ xuất phát | 130px (md+ only) | course.startTime parsed HH:mm - DD/MM |
| 4 | Đường dẫn API | 240px max-w truncate (lg+ only) | course.apiUrl text truncate |
| 5 (**NEW**) | Tình trạng | 200px (md+ only) | Inline badge group (xem 6.2.1) |
| 6 | Thao tác | right-align flex | 7 action buttons (extend từ 6 thành 7 — thêm "Clear apiUrl") |

#### 6.2.1 NEW "Tình trạng" column inline badge

Render 3 sub-badge stack vertical (gap 1):
- **Row count badge:** `📊 {rowCount} rows` (gray bg) — nếu polling: `📊 Đang xác nhận... ({attempt}/5)` (blue bg pulse animation)
- **Last sync badge:** `⏱️ Sync {relativeTime}` (xanh nếu status=success, đỏ nếu status=failed, gray nếu null) — empty state: `⏱️ Chưa sync`
- **Cron status badge:** `🔄 Auto-sync ON` (xanh dot) hoặc `🔌 Auto-sync OFF` (gray dot) hoặc `🔵 Đang sync...` (blue pulse) hoặc `⚠️ Sync stuck >60s` (vàng)

Tooltip on hover badge "🔄 Auto-sync ON" → hiện thị `"Sync tiếp theo: {HH:mm UTC+7}"` formatted.

#### 6.2.2 Action column extend (7 buttons)

Order left→right:
1. 📥 Download (existing - Xuất CSV)
2. 🔄 RefreshCw (existing - Ép đồng bộ)
3. 🗑️ RotateCcw (existing - Xóa dữ liệu) — **UI CHANGE:** button label tooltip thay đổi từ "Xóa dữ liệu" → `"Xóa dữ liệu ({rowCount} kết quả)"` dynamic. Disabled nếu `rowCount === 0`.
4. 🔌 PlugX (**NEW** - Tắt auto-sync) — chỉ hiện nếu `hasApiUrl === true`. Disabled khi đang loading. Icon `lucide-react: PlugZap` hoặc custom `🔌`.
5. 📋 Copy (existing - Nhân bản)
6. ✏️ Pencil (existing - Sửa)
7. 🗑️ Trash2 (existing - Xóa cự ly)

### 6.3 UI Step-by-Step Numbered Tables

#### Journey 1: Reset data course có apiUrl (cron-aware warning)

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Mở `/races/{raceId}/settings` | CourseTable render với 5 row "Tình trạng" badge populated từ `useCoursesDataStats` hook poll | TanStack Query mount + interval 5s | Polling active |
| 2 | Hover button 🗑️ row "200m" | Tooltip hiện `"Xóa dữ liệu (576 kết quả)"` | Button title attr dynamic | — |
| 3 | Click button 🗑️ row "200m" | AlertDialog open với title "Xóa dữ liệu course 200m?" + body cron-aware (xem 6.3.1) | `setConfirmDialog({ open: true, courseId: '200m', action: 'reset' })` | Dialog visible |
| 4 | Đọc warning + tick checkbox "Tắt auto-sync trước khi xóa" (mặc định CHECKED nếu hasApiUrl=true) | Checkbox state change | onCheckedChange | `disableAutoSync = true` |
| 5 | Click "Xóa data" button (red destructive) | Button loading spinner + dialog disabled | `mutation.mutate({ disableAutoSync: true })` → call `POST /disable-and-reset` (vì checkbox checked) | Submitting |
| 6 | Backend trả 200 trong 2s | Dialog close + toast success VN BR-68-17 | onSuccess invalidate `useCoursesDataStats` | Toast 5s timeout |
| 7 | Badge "Tình trạng" tự update: `📊 Đang xác nhận... (1/5)` | Frontend trigger post-reset poll snapshot 2s × 5 BR-68-18 | useEffect poll | Polling snapshot |
| 8 | Sau 2s poll #1 → `rowCount=0` → badge update `📊 0 rows` + `🔌 Auto-sync OFF` | Snapshot polling stop early | rowCount===0 condition | Confirmed |
| 9 | Sau 30s tab vẫn focus | 5s interval poll vẫn chạy, badge values up-to-date | TanStack Query refetchInterval 5s | Steady state |

#### 6.3.1 AlertDialog body Journey 1 step 3 — cron-aware copy

**Title:** `Xóa dữ liệu course {courseName}?`

**Body:**
```
🗑️ Sẽ xóa {rowCount} kết quả của course {courseName} (race "{raceTitle}").

{IF hasApiUrl === true:}
⚠️ Course này còn auto-sync từ vendor RaceResult.com.
   Cron sẽ tự đồng bộ lại vào {nextCronRelativeTime} ({nextCronAbsTime}).

   [✓] Tắt auto-sync trước khi xóa (khuyến nghị)
       → Nếu bỏ tick: data sẽ bị overwrite lại sau {minutesUntilNextCron} phút.

{IF race.status === 'live':}
⛔ Race "{raceTitle}" đang LIVE.
   Xóa data sẽ ảnh hưởng public leaderboard NGAY.
   Gõ "{courseName}" vào ô bên dưới để xác nhận:
   [_______________] (typed confirmation input)

Thao tác này KHÔNG thể hoàn tác.

[Hủy] [Xóa data] (red destructive, disabled cho đến khi typed confirmation match nếu race live)
```

#### Journey 2: Clear apiUrl không reset data (admin sửa wrong vendor URL)

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Click button 🔌 PlugX row "400m" (chỉ hiện nếu hasApiUrl=true) | AlertDialog open: "Tắt auto-sync course 400m?" | `setConfirmDialog({ open: true, courseId: '400m', action: 'clear-apiurl' })` | Dialog visible |
| 2 | Body hiện apiUrlMasked + warning | `"https://api.raceresult.com/402892/KHV8...J4Q67MIH"` từ data-stats response | Render from prop | — |
| 3 | IF race.status='live' → typed confirmation field "Gõ {courseName} để xác nhận" | Input required match courseName | onChange validate | Button disabled |
| 4 | Click "Tắt auto-sync" (red) | Mutation `PATCH /clear-api-url` | `mutation.mutate()` | Submitting |
| 5 | Backend 200 trong 500ms | Dialog close + toast: `"Đã tắt auto-sync course 400m..."` BR-68-17 | onSuccess invalidate data-stats | Toast 5s |
| 6 | Badge "Tình trạng" update: `🔌 Auto-sync OFF` + apiUrl column hiện "—" | Polling 5s next tick fetch updated | useCoursesDataStats refetch | Steady state |
| 7 | Button 🔌 PlugX disappear (vì hasApiUrl=false) | Conditional render | row.hasApiUrl === false | Action menu 6 buttons |

#### Journey 3: Force sync sau khi tắt nhầm

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Admin nhận ra tắt nhầm → click ✏️ Pencil edit course | Edit dialog mở với form apiUrl field empty | onEdit | Edit modal |
| 2 | Paste lại apiUrl đúng → Submit | `PATCH /admin/races/:raceId/courses/:courseId` (existing endpoint) | mutation | Saved |
| 3 | Badge update: `🔄 Auto-sync ON` + tooltip "Sync tiếp theo: HH:mm" | Polling 5s | useCoursesDataStats | Steady state |
| 4 | Click 🔄 RefreshCw force sync ngay (không chờ cron 10 phút) | Button spinner + mutation `POST /force-sync` | onForceSync | Syncing |
| 5 | Backend 200 sau 5-15s với count rows imported | Toast success + badge update `📊 N rows` | onSuccess | Done |

### 6.4 Buttons Specification Table

| Button label | Position | Default state | Disabled state | Loading state | Action | Confirm dialog? |
|--------------|----------|---------------|----------------|---------------|--------|-----------------|
| "🗑️ Xóa dữ liệu" | Action col 3 | Ghost icon RotateCcw | rowCount === 0 (no data to delete) | Spinner replace icon | `POST /reset-data` HOẶC `/disable-and-reset` based on checkbox | YES — cron-aware (6.3.1) |
| "🔌 Tắt auto-sync" | Action col 4 (**NEW**) | Ghost icon PlugZap | hasApiUrl === false (hidden hoàn toàn) | Spinner | `PATCH /clear-api-url` | YES — apiUrl + live warning |
| "Hủy" dialog | Dialog footer left | Outline | KHÔNG | N/A | Close dialog | NO |
| "Xóa data" dialog | Dialog footer right | Destructive red | typed confirmation chưa match khi race=live | Spinner | Confirm action | N/A (already in dialog) |
| "Tắt auto-sync" dialog | Dialog footer right | Destructive red | typed confirmation chưa match khi race=live | Spinner | `PATCH /clear-api-url` | N/A (already in dialog) |

### 6.5 Form Fields Specification Table

| Field name | UI label | Type | Required | Validation | Error message | Default |
|------------|----------|------|----------|------------|---------------|---------|
| `disableAutoSync` | "Tắt auto-sync trước khi xóa (khuyến nghị)" | checkbox | ⚪ | boolean | — | `true` nếu hasApiUrl=true, else `false` |
| `confirmedLive` (hidden) | — | boolean | ✅ nếu race.status='live' | true literal | — | `false` |
| `liveTypedConfirmation` | "Gõ {courseName} để xác nhận" | text | ✅ nếu race.status='live' | match exact `courseName` (case-sensitive) | "Tên course không khớp" | "" |

### 6.6 Field Source Table

| Field UI label | Data source | Format hiển thị | Empty state |
|----------------|-------------|-----------------|-------------|
| Row count badge | `data-stats.rowCount` (live poll 5s) | `📊 {n} rows` integer | `📊 0 rows` |
| Last sync time | `data-stats.lastSyncedAt` ISO | `⏱️ Sync {relativeTime}` (date-fns formatDistanceToNow VN locale) | `⏱️ Chưa sync` |
| Cron status | `data-stats.cronStatus` enum | Badge VN per BR-68-06 mapping | "—" |
| Next cron time tooltip | `data-stats.nextCronAt` ISO | `HH:mm UTC+7` (vi-VN locale date.toLocaleString) | "—" |
| apiUrl masked | `data-stats.apiUrlMasked` | font-mono text-xs | "—" |
| Confirmation count | local state `pollAttempt` | `({n}/5)` integer | hidden |

### 6.7 UI States

| State | Trigger | UI |
|-------|---------|-----|
| **Loading initial** | Mount, before first data-stats response | Badge group hiện skeleton 3 gray bars (no flash empty) |
| **Loading polling** | Polling refetch in-flight | Badge giữ data cũ + subtle opacity 0.7 (no full re-skeleton) |
| **Empty rowCount=0** | data-stats.rowCount === 0 | `📊 0 rows` (gray) + button 🗑️ disabled |
| **Empty hasApiUrl=false** | data-stats.hasApiUrl === false | `🔌 Auto-sync OFF` (gray dot) + button 🔌 hidden |
| **Data normal** | rowCount > 0, hasApiUrl=true | 3 badges all populated |
| **Filtered + empty** | N/A (không có filter trong CourseTable) | — |
| **Error fetch data-stats** | useCoursesDataStats error | Badge group hiện `⚠️ Lỗi tải` (vàng) + retry button inline + toast đỏ "Không tải được trạng thái course" |
| **Submitting reset** | mutation in-flight | Dialog button spinner + dialog frozen (KHÔNG cho click ngoài close) |
| **Submitting clear-apiurl** | mutation in-flight | Dialog button spinner + dialog frozen |
| **Success reset** | mutation 200 | Dialog close + toast VN BR-68-17 + post-reset poll snapshot 2s × 5 |
| **Success clear-apiurl** | mutation 200 | Dialog close + toast VN BR-68-17 + immediate invalidate data-stats |
| **Validation error typed confirm** | race=live + typed input không match | Input red border + helper text "Tên course không khớp" + button disabled |
| **Confirm dialog destructive** | Cả 2 dialogs (reset + clear-apiurl) | shadcn AlertDialog với destructive variant button red |
| **Cron in_progress** | data-stats.cronStatus='in_progress' | `🔵 Đang sync...` pulse blue + button 🗑️ disabled với tooltip "Chờ sync xong" |
| **Cron stuck >60s** | data-stats.cronStatus='in_progress' + warning flag | `⚠️ Sync stuck >60s` vàng + button 🗑️ enabled (admin override OK) |
| **Race live warning** | race.status='live' + click 🗑️ or 🔌 | Dialog title đổi `⛔ Race "{title}" đang LIVE` + body có typed confirmation |

---

## 🛠️ Technical Mandates

### 3.1 DB / Cache changes

**MongoDB:**
- KHÔNG schema migration. `course.apiUrl?` đã `optional` từ schema race.schema.ts:41
- `race_results` collection: KHÔNG schema change. Compound index `{raceId, courseId, bib}` UNIQUE đã exist (line 121) → countDocuments hit prefix index OK perf
- `sync_logs` collection: KHÔNG schema change. Compound index check: nếu chưa có `{raceId, courseId, created_at: -1}` → 🛑 PAUSE Manager add index trước deploy (perf for race với 100+ sync logs/day)
- `audit_logs` collection (F-023): KHÔNG schema change. Action name `course.apiUrl.cleared` + `course.disabled_and_reset` là string literal, no enum.

**Redis (CLAUDE.md Redis Keys Registry update):**
- NEW key `admin:course-stats:<raceId>:<courseId>` — TTL 5s — purpose: cache data-stats endpoint response để giảm Mongo countDocuments cost khi nhiều admin user poll cùng lúc
- DEL pattern khi mutate: `admin:course-stats:${raceId}:${courseId}` (single key, không scanStream cần thiết)
- BR-68-11 keys rename (BREAKING cache key change — accept 1 lần cache miss khi deploy):
  - OLD: `leaderboard:${courseId}` → NEW: `leaderboard:${raceId}:${courseId}`
  - OLD: `stats:${courseId}` → NEW: `stats:${raceId}:${courseId}`
  - OLD: `time-distribution:${courseId}` → NEW: `time-distribution:${raceId}:${courseId}`
  - OLD: `country-stats:${courseId}` → NEW: `country-stats:${raceId}:${courseId}`
  - OLD: `country-rank:${courseId}:*` → NEW: `country-rank:${raceId}:${courseId}:*`
  - Migration: KHÔNG cần (TTL 60-300s đa số → tự expire trong 5 phút post-deploy)

**S3:** KHÔNG đụng.

**Migration script needed?** NO — chỉ Redis key pattern change, tự expire.

### 3.2 Backend Endpoint Specifications

#### Endpoint A — GET data-stats

| Element | Spec |
|---------|------|
| Method | GET |
| Path | `/api/admin/races/:raceId/courses/:courseId/data-stats` |
| Auth | `@UseGuards(LogtoAdminGuard)` class-level (existing AdminController guard) |
| Guard role | admin |
| Request body | — (path params only) |
| Response DTO | `CourseDataStatsResponseDto` |
| Status codes | 200 success / 401 no auth / 403 insufficient / 404 race or course not found / 500 server |
| Side effects | Redis cache GET `admin:course-stats:${raceId}:${courseId}` (TTL 5s), SET on miss |
| Cache strategy | Redis 5s TTL, key includes both raceId + courseId |

#### Endpoint B — PATCH clear-api-url

| Element | Spec |
|---------|------|
| Method | PATCH |
| Path | `/api/admin/races/:raceId/courses/:courseId/clear-api-url` |
| Auth | `@UseGuards(LogtoAdminGuard)` class-level |
| Guard role | admin |
| Request body DTO | `ClearApiUrlDto` (optional `confirmedLive: boolean`) |
| Response DTO | `ClearApiUrlResponseDto` |
| Status codes | 200 success / 400 validation / 401 no auth / 403 insufficient / 404 race or course not found / 409 race is live + confirmedLive≠true / 500 server |
| Side effects | Mongo `$unset courses.$.apiUrl`, Redis DEL `admin:course-stats:${raceId}:${courseId}`, AuditLog emit `course.apiUrl.cleared`, RacesService.invalidateRaceCache(raceId) |

#### Endpoint C — POST disable-and-reset

| Element | Spec |
|---------|------|
| Method | POST |
| Path | `/api/admin/races/:raceId/courses/:courseId/disable-and-reset` |
| Auth | `@UseGuards(LogtoAdminGuard)` class-level |
| Guard role | admin |
| Request body DTO | `DisableAndResetDto` (optional `confirmedLive: boolean`) |
| Response DTO | `DisableAndResetResponseDto` (extends ResetDataResponseDto + `prevApiUrl` masked) |
| Status codes | 200 success / 400 validation / 401 no auth / 403 / 404 / 409 race live / 500 |
| Side effects | (1) Mongo $unset apiUrl, (2) Wait isSyncing ≤ 5s, (3) deleteResultsByCourse(raceId, courseId), (4) purgeCache(raceId, courseId), (5) DEL admin:course-stats, (6) AuditLog emit `course.disabled_and_reset` |

#### Endpoint D — POST reset-data (EXTEND existing)

| Element | Spec |
|---------|------|
| Method | POST |
| Path | `/api/admin/races/:raceId/courses/:courseId/reset-data` (EXISTING) |
| Auth | `@UseGuards(LogtoAdminGuard)` class-level (existing) |
| Guard role | admin |
| Request body DTO | `ResetDataDto` (NEW optional `confirmedLive: boolean`) — body có thể empty (backward compat) |
| Response DTO | `ResetDataResponseDto` EXTEND thêm `{ nextCronAt: Date \| null, hasApiUrl: boolean, durationMs: number }` |
| Status codes | 200 success / 401 / 403 / 404 / 409 race live / 500 |
| Side effects | deleteResultsByCourse(raceId, courseId) [PRE-EXISTING BUG FIX BR-68-10], purgeCache(raceId, courseId) [PRE-EXISTING BUG FIX BR-68-11], DEL admin:course-stats, AuditLog emit `course.data_reset` |

### 3.3 DTO Field-Level Spec

```typescript
// === Response DTOs ===

export class CourseDataStatsResponseDto {
  @ApiProperty({ description: 'Số rows trong race_results cho (raceId, courseId)' })
  rowCount!: number;

  @ApiPropertyOptional({ description: 'ISO date của sync_log mới nhất, null nếu chưa từng sync' })
  lastSyncedAt!: string | null;

  @ApiPropertyOptional({ description: 'success | failed | null' })
  lastSyncStatus!: 'success' | 'failed' | null;

  @ApiPropertyOptional({ description: 'Duration ms của sync gần nhất' })
  lastSyncDurationMs!: number | null;

  @ApiProperty({ description: 'Có apiUrl không (empty string = false)' })
  hasApiUrl!: boolean;

  @ApiPropertyOptional({ description: 'Masked apiUrl prefix...suffix, null nếu hasApiUrl=false' })
  apiUrlMasked!: string | null;

  @ApiPropertyOptional({ description: 'ISO date next cron run, null nếu disabled hoặc in_progress' })
  nextCronAt!: string | null;

  @ApiProperty({ enum: ['scheduled', 'in_progress', 'disabled'] })
  cronStatus!: 'scheduled' | 'in_progress' | 'disabled';
}

export class ClearApiUrlDto {
  @ApiPropertyOptional({ description: 'Bắt buộc true nếu race.status=live' })
  @IsOptional()
  @IsBoolean()
  confirmedLive?: boolean;
}

export class ClearApiUrlResponseDto {
  @ApiProperty({ example: 'Đã tắt auto-sync course 200m' })
  message!: string;

  @ApiProperty()
  success!: boolean;

  @ApiPropertyOptional({ description: 'Masked previous apiUrl trước khi clear' })
  prevApiUrlMasked!: string | null;
}

export class DisableAndResetDto {
  @ApiPropertyOptional({ description: 'Bắt buộc true nếu race.status=live' })
  @IsOptional()
  @IsBoolean()
  confirmedLive?: boolean;
}

export class DisableAndResetResponseDto {
  @ApiProperty()
  message!: string;

  @ApiProperty()
  deletedCount!: number;

  @ApiProperty()
  success!: boolean;

  @ApiPropertyOptional()
  prevApiUrlMasked!: string | null;

  @ApiProperty()
  durationMs!: number;

  @ApiProperty()
  hasApiUrl!: boolean; // Always false post-success

  @ApiPropertyOptional()
  nextCronAt!: string | null; // Always null post-success
}

export class ResetDataDto {
  @ApiPropertyOptional({ description: 'Bắt buộc true nếu race.status=live' })
  @IsOptional()
  @IsBoolean()
  confirmedLive?: boolean;
}

export class ResetDataResponseDto {
  @ApiProperty({ example: 'Deleted 576 results for course 200m' })
  message!: string;

  @ApiProperty()
  deletedCount!: number;

  @ApiProperty()
  success!: boolean;

  // NEW F-068 fields (backward compat — append only)
  @ApiPropertyOptional()
  nextCronAt!: string | null;

  @ApiProperty()
  hasApiUrl!: boolean;

  @ApiProperty()
  durationMs!: number;
}
```

### 3.4 Frontend / Admin (Next.js)

- **Page level:** `/races/[id]/settings/page.tsx` — Server Component (existing), no change
- **CourseSection.tsx** — Client Component (existing) — extend với new handler for clear-apiurl + extend reset handler with disableAutoSync param
- **CourseTable.tsx** — Client Component — extend với new "Tình trạng" column + new "Clear apiUrl" button (icon PlugZap from lucide-react)
- **NEW Client Components:**
  - `admin/src/components/course-data-ops/CourseDataStatsBadge.tsx` — render 3 sub-badge (rowCount + lastSync + cron)
  - `admin/src/components/course-data-ops/ResetDataConfirmDialog.tsx` — AlertDialog cron-aware + checkbox + typed confirmation
  - `admin/src/components/course-data-ops/ClearApiUrlConfirmDialog.tsx` — AlertDialog với apiUrlMasked + typed confirmation race live
- **TanStack Query hooks:**
  - `useCoursesDataStats(raceId, courseIds[])` — `useQueries` batched, poll 5s, staleTime 0. Hoặc nếu Coder thấy phù hợp hơn → single `useCourseDataStats(raceId, courseId)` mỗi row gọi riêng (acceptable performance vì 5s cache server-side).
  - `useResetCourseData(raceId, courseId)` — mutation
  - `useClearCourseApiUrl(raceId, courseId)` — mutation
  - `useDisableAndResetCourse(raceId, courseId)` — mutation
- **Cache invalidation post-mutation:**
  - Invalidate `['course-data-stats', raceId, courseId]` immediately
  - Server Action revalidate KHÔNG cần (CourseSection là Client Component pull từ SDK)
- **SDK regen:** `pnpm --filter admin generate:api` bắt buộc sau khi backend DTO ready
- **Base UI Select.Value pattern:** N/A (không có dropdown trong feature)
- **Dialog max-w override:** AlertDialog mặc định shadcn `sm:max-w-lg` (32rem ~ 512px) → OK cho body 6.3.1 không cần override
- **Picker collapse pattern:** N/A

### 3.5 PAUSE flags

- 🛑 **Migration MongoDB schema** — KHÔNG có. Nếu sync_logs chưa có compound index `{raceId, courseId, created_at: -1}` → Coder kiểm tra + tạo migration script add index (1 dòng `db.sync_logs.createIndex({...})`)
- 🛑 **`pnpm install` dep mới** — KHÔNG. Reuse `lucide-react` đã có `PlugZap` icon, `date-fns` đã có cho formatDistanceToNow VN locale
- 🛑 **Auth/security logic change** — KHÔNG (reuse `LogtoAdminGuard` existing)
- 🛑 **Breaking API response change** — KHÔNG. EXTEND `reset-data` response chỉ append field mới, không rename. Frontend cũ ignore field mới OK
- 🛑 **Logic động vào fee calculation** — KHÔNG
- 🛑 **`deleteResultsByCourse` + `purgeCache` signature change BR-68-10/11** — đây là REFACTOR pre-existing bug fix. Coder phải update ALL call sites:
  - `backend/src/modules/admin/admin.service.ts:67` (resetData caller)
  - `backend/src/modules/race-result/services/race-result.service.ts` (internal callers — `syncSingleCourse`, `syncRaceResult` cron path)
  - Bất kỳ test spec nào mock 2 method này (Coder grep `deleteResultsByCourse\|purgeCache` toàn codebase)
- 🛑 **Redis cache key pattern rename BR-68-11** — Coder cần verify KHÔNG có consumer ngoài 5 nơi đã liệt kê (grep `leaderboard:\|stats:\|country-rank:\|time-distribution:\|country-stats:` toàn codebase admin + frontend + backend)
- 🛑 **`RaceSyncCron.isSyncing` flag access** — hiện `private` (line 8). Coder cần đổi thành `public` getter OR thêm method `isCurrentlySync(): boolean`. Recommend method để giữ encapsulation.
- 🛑 **Trước khi expose endpoint Phase 2 disable-and-reset** — Coder cần test atomic order BR-68-08 thật sự work với simulated cron mid-flight (test với jest fake timer + isSyncing flag mock).

---

## 🧪 Testing Mandates

### 4.1 Backend Test Cases TC-XX

#### TC-68-01 Happy path — GET data-stats khi course có data + apiUrl

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/races/6a1b1d19d06795986d383294/courses/200m/data-stats` |
| Headers | `Authorization: Bearer <admin_token>` |
| Body | — |
| Expected status | 200 |
| Expected body shape | `{"rowCount":576,"lastSyncedAt":"2026-05-31T02:45:15.000Z","lastSyncStatus":"success","lastSyncDurationMs":987,"hasApiUrl":true,"apiUrlMasked":"https://api.raceresult.com/402892/KHV8...J4Q67MIH","nextCronAt":"2026-05-31T02:55:00.000Z","cronStatus":"scheduled"}` |
| MUST NOT leak | Full apiUrl raw, `_id` của sync_log, `__v` |
| Side effect verify | Redis SET `admin:course-stats:6a1b1d19...:200m` TTL≤5s, 2nd call cùng key trong 5s phải hit cache (Mongo countDocuments KHÔNG called 2nd time) |

#### TC-68-02 GET data-stats khi course chưa từng sync

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/races/{raceId}/courses/{newCourseId}/data-stats` |
| Headers | Admin token |
| Expected status | 200 |
| Expected body shape | `{"rowCount":0,"lastSyncedAt":null,"lastSyncStatus":null,"lastSyncDurationMs":null,"hasApiUrl":false,"apiUrlMasked":null,"nextCronAt":null,"cronStatus":"disabled"}` |
| Side effect | Cache miss → MongoDB query → cache SET |

#### TC-68-03 GET data-stats khi cron đang chạy

| Element | Value |
|---------|-------|
| Setup | Mock `RaceSyncCron.isCurrentlySync()` return `true` |
| Method | GET |
| URL | `/api/admin/races/{raceId}/courses/200m/data-stats` |
| Expected status | 200 |
| Expected body shape | `{...,"nextCronAt":null,"cronStatus":"in_progress"}` |

#### TC-68-04 GET data-stats — 404 race not found

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/races/000000000000000000000000/courses/200m/data-stats` |
| Expected status | 404 |
| Expected body shape | `{"statusCode":404,"message":"Race not found"}` |

#### TC-68-05 GET data-stats — 404 course not found in existing race

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/races/{validRaceId}/courses/999K/data-stats` |
| Expected status | 404 |
| Expected body shape | `{"statusCode":404,"message":"Course not found in race"}` |

#### TC-68-06 GET data-stats — 401 unauthenticated

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/races/{raceId}/courses/200m/data-stats` |
| Headers | NO Authorization |
| Expected status | 401 |

#### TC-68-07 PATCH clear-api-url happy path

| Element | Value |
|---------|-------|
| Method | PATCH |
| URL | `/api/admin/races/{raceId}/courses/200m/clear-api-url` |
| Headers | Admin token |
| Body | `{}` |
| Expected status | 200 |
| Expected body shape | `{"message":"Đã tắt auto-sync course 200m","success":true,"prevApiUrlMasked":"https://api.raceresult.com/402892/KHV8...J4Q67MIH"}` |
| Side effect verify | Mongo course.apiUrl undefined (verify `db.races.findOne({_id, 'courses.courseId':'200m'}, {'courses.$':1})`), Redis DEL `admin:course-stats:{raceId}:200m` called, AuditLog `db.audit_logs.findOne({action:'course.apiUrl.cleared'})` returns doc với metadata `{raceId, courseId, prevApiUrl}` (full prev — internal audit OK) |

#### TC-68-08 PATCH clear-api-url khi race=live không có confirmedLive

| Element | Value |
|---------|-------|
| Setup | Race status='live' |
| Method | PATCH |
| URL | `.../200m/clear-api-url` |
| Body | `{}` |
| Expected status | 409 |
| Expected body shape | `{"statusCode":409,"code":"RACE_IS_LIVE_CONFIRM_REQUIRED","message":"Race đang LIVE — gửi confirmedLive=true để xác nhận"}` |
| Side effect verify | Mongo apiUrl UNCHANGED, AuditLog KHÔNG emit |

#### TC-68-09 PATCH clear-api-url khi race=live có confirmedLive=true

| Element | Value |
|---------|-------|
| Setup | Race status='live' |
| Body | `{"confirmedLive":true}` |
| Expected status | 200 |
| Side effect | apiUrl cleared, AuditLog emitted với metadata `{...,raceWasLive:true}` |

#### TC-68-10 POST disable-and-reset atomic order — happy path

| Element | Value |
|---------|-------|
| Setup | Course '200m' có apiUrl + 576 rows + cron NOT in progress |
| Method | POST |
| URL | `.../200m/disable-and-reset` |
| Body | `{}` |
| Expected status | 200 |
| Expected body shape | `{"message":"...","deletedCount":576,"success":true,"prevApiUrlMasked":"https://api.raceresult.com/402892/KHV8...","durationMs":<number>,"hasApiUrl":false,"nextCronAt":null}` |
| Side effect verify | (1) apiUrl unset, (2) race_results count=0 cho raceId+courseId, (3) Other course (400m) race_results UNCHANGED (cross-race + cross-course safety), (4) Redis DEL admin:course-stats, (5) Redis DEL results:{raceId}:200m:*, athlete:{raceId}:*, badge:{raceId}:*, leaderboard:{raceId}:200m, stats:{raceId}:200m, (6) AuditLog `course.disabled_and_reset` emitted |

#### TC-68-11 POST disable-and-reset waits for isSyncing

| Element | Value |
|---------|-------|
| Setup | Mock `RaceSyncCron.isCurrentlySync()` return `true` for first 600ms, then `false` |
| Method | POST |
| URL | `.../200m/disable-and-reset` |
| Expected status | 200 |
| Expected timing | `durationMs > 600` (waited for cron) |
| Side effect | apiUrl unset FIRST (before wait), then deleteMany happens AFTER cron done |

#### TC-68-12 POST disable-and-reset timeout — cron stuck > 5s

| Element | Value |
|---------|-------|
| Setup | Mock `isCurrentlySync()` ALWAYS return `true` |
| Method | POST |
| URL | `.../200m/disable-and-reset` |
| Expected status | 200 (does NOT fail) |
| Expected timing | `durationMs > 5000 && < 6000` (5s timeout) |
| Side effect | Log warn "cron wait timeout exceeded", continue deleteMany anyway |

#### TC-68-13 POST reset-data EXTEND response shape (existing endpoint)

| Element | Value |
|---------|-------|
| Method | POST |
| URL | `.../200m/reset-data` |
| Body | `{}` |
| Expected status | 200/201 (current behavior 201 from NestJS @Post default) |
| Expected body shape | `{"message":"Deleted 576 results for course 200m","deletedCount":576,"success":true,"nextCronAt":"2026-05-31T02:55:00.000Z","hasApiUrl":true,"durationMs":<number>}` |
| Side effect verify | Pre-existing bug fixed: only race_results với (raceId AND courseId) filter deleted, race_results khác raceId nhưng cùng courseId UNCHANGED |

#### TC-68-14 Pre-existing bug — cross-race wipe regression test

| Element | Value |
|---------|-------|
| Setup | 2 race khác nhau (raceA, raceB) cùng có course "200m" với rows |
| Method | POST |
| URL | `.../raceA/courses/200m/reset-data` |
| Expected status | 200 |
| Side effect verify | `db.race_results.countDocuments({raceId:raceA._id, courseId:'200m'})` = 0, `db.race_results.countDocuments({raceId:raceB._id, courseId:'200m'})` UNCHANGED (regression for BR-68-10) |

#### TC-68-15 Pre-existing bug — cache invalidation pattern verify

| Element | Value |
|---------|-------|
| Setup | Pre-populate Redis: `results:raceA:200m:1:hash1`, `athlete:raceA:bib1`, `badge:raceA:bib1`, `leaderboard:raceA:200m`, `stats:raceA:200m` |
| Method | POST `.../raceA/courses/200m/reset-data` |
| Expected | All 5 keys deleted (verify `redis.exists(...)` = 0 for each) |

#### TC-68-16 Concurrent reset-data — 10x stability

| Element | Value |
|---------|-------|
| Setup | Course '200m' với 100 rows |
| Method | 10x parallel `Promise.all([POST reset-data × 10])` |
| Expected | All 10 return 200, deletedCount sum = 100 (only 1 winner actually deletes, others return 0). KHÔNG có request fail với 500 |

#### TC-68-17 Race lookup boundary — courseId not in race.courses array

| Element | Value |
|---------|-------|
| Method | GET data-stats |
| URL | `.../validRaceId/courses/INVALID-COURSE-ID/data-stats` |
| Expected status | 404 |

### 4.2 Frontend E2E Test Cases (Playwright)

| TC | Persona | Journey | Steps | Expected |
|----|---------|---------|-------|----------|
| E2E-68-01 | Hằng Sales Admin | Reset data course đơn giản | 1. Login admin 2. Navigate `/races/{raceId}/settings` 3. Đợi badge "📊 576 rows" hiện 4. Click 🗑️ row 200m 5. Verify dialog title "Xóa dữ liệu course 200m?" 6. Verify body show "576 kết quả" 7. Verify checkbox "Tắt auto-sync" CHECKED (vì hasApiUrl=true) 8. Click "Xóa data" 9. Verify toast green "Đã tắt auto-sync + xóa 576 kết quả..." 10. Verify badge update "📊 Đang xác nhận... (1/5)" 11. Verify badge final "📊 0 rows" + "🔌 Auto-sync OFF" trong vòng 12s | All 11 steps pass |
| E2E-68-02 | Hằng Sales Admin | Reset KHÔNG tắt auto-sync (uncheck) | 1-7 như E2E-68-01 8. Uncheck checkbox "Tắt auto-sync" 9. Verify warning text "data sẽ bị overwrite lại sau N phút" hiện 10. Click "Xóa data" 11. Backend call `POST /reset-data` (KHÔNG `/disable-and-reset`) 12. Toast: "Đã xóa 576 kết quả. Lần sync tiếp theo: 8 phút nữa" | Backend nhận đúng endpoint |
| E2E-68-03 | Tùng Race Director | Tắt auto-sync vĩnh viễn | 1. Settings page 2. Click 🔌 row 400m 3. Dialog hiện title "Tắt auto-sync course 400m?" + apiUrlMasked 4. Click "Tắt auto-sync" 5. Toast: "Đã tắt auto-sync course 400m..." 6. Verify badge update "🔌 Auto-sync OFF" 7. Verify button 🔌 disappear khỏi row | Action menu giờ chỉ 6 buttons |
| E2E-68-04 | Tùng Race Director | Race live - typed confirmation block | 1. Race status='live' 2. Click 🗑️ row 200m 3. Dialog title đỏ "⛔ Race "XYZ" đang LIVE" 4. Verify input field "Gõ 200m để xác nhận" hiện 5. Verify "Xóa data" button disabled 6. Type "200" (incomplete) → button vẫn disabled + helper "Tên course không khớp" 7. Type "200m" full → button enabled 8. Click "Xóa data" → 200 success | Typed confirmation enforced |
| E2E-68-05 | Hiền Finance | Read data-stats tooltip cron next time | 1. Settings page hover badge "🔄 Auto-sync ON" 2. Tooltip hiện "Sync tiếp theo: 02:55 UTC+7" 3. Tooltip dismiss khi blur | Tooltip render đúng locale vi-VN |
| E2E-68-06 | Hằng | Polling pause khi tab blur | 1. Settings page polling active 5s 2. Switch tab khác 30s 3. Quay lại tab 4. Verify polling resume (1 immediate fetch) | TanStack Query refetchIntervalInBackground:false |
| E2E-68-07 | Hằng | Error state - backend 500 | 1. Backend mock data-stats throw 500 2. Verify badge group hiện "⚠️ Lỗi tải" + toast đỏ + retry button | Error state visible, app KHÔNG crash |
| E2E-68-08 | Hằng | Cron in_progress badge | 1. Backend mock cronStatus='in_progress' 2. Verify badge "🔵 Đang sync..." pulse 3. Verify button 🗑️ disabled với tooltip "Chờ sync xong" | Disabled state correct |
| E2E-68-09 | Hằng | rowCount=0 disable 🗑️ button | 1. Course mới chưa sync, rowCount=0 2. Hover button 🗑️ → tooltip "Xóa dữ liệu (0 kết quả)" 3. Button disabled (cursor not-allowed) | Disabled logic correct |
| E2E-68-10 | Hằng | Mobile responsive 375px | 1. Viewport 375×667 2. Settings page 3. CourseTable scroll horizontal smooth 4. Verify column "Tình trạng" hidden trên <768px (md breakpoint) 5. Verify action menu vẫn accessible (overflow scroll) | No layout break |

### 4.3 Security Checks

- [ ] All 4 endpoints (data-stats, clear-api-url, disable-and-reset, reset-data) protected by `LogtoAdminGuard` — verify 401 unauth
- [ ] Cross-tenant access: admin của tenant A KHÔNG access course của tenant B (verify với race thuộc tenant khác) — 403 OR 404 (chọn 1)
- [ ] Response data-stats KHÔNG leak: full apiUrl (chỉ masked), `_id` raw sync_log, MongoDB error stack
- [ ] AuditLog metadata `prevApiUrl` raw OK (internal collection, admin-only read)
- [ ] Path param `raceId` invalid ObjectId → 400 NOT 500 (Coder dùng `class-validator` `@IsMongoId()` trên path)
- [ ] Path param `courseId` SQL/NoSQL injection: `'200m'; DROP TABLE` → MongoDB string literal match, KHÔNG eval (verify với fuzz test)

### 4.4 Performance SLA

- `GET data-stats` cold (cache miss, race 100K rows): **p95 < 500ms**
- `GET data-stats` warm (cache hit): **p95 < 50ms**
- `POST reset-data` race 10K rows: **p95 < 3000ms**
- `POST disable-and-reset` race 10K rows (cron NOT in progress): **p95 < 3500ms** (overhead 500ms for apiUrl unset + cron poll)
- `POST disable-and-reset` cron stuck timeout: **5000-5500ms** (5s wait + 500ms deleteMany)
- Cache hit ratio sau 5 phút warm: **> 80%** (5s TTL × N admin user concurrent)
- 10x flaky test pass rate: **100%** (concurrent reset-data + concurrent data-stats poll)

---

## 📌 Answers to Manager's PAUSE conditions

### PAUSE-68-01 — Clear apiUrl endpoint shape

✅ **Chọn A (NEW endpoint).** `PATCH /api/admin/races/:raceId/courses/:courseId/clear-api-url` — explicit semantic + dedicated audit log action + UI có dedicated CTA. Lý do reject B: reuse `PATCH /courses/:courseId` với `{apiUrl: null}` body sẽ loose semantic — admin sửa course config khác (vd đổi startTime) có thể accidentally include apiUrl=null trong payload.

### PAUSE-68-02 — Audit log integration

✅ **Dùng AuditLogService existing F-023 pattern.** Action `course.apiUrl.cleared` + `course.disabled_and_reset` + `course.data_reset` (3 actions mới). Actor Phase 1 **hardcode 'admin'** (TD-CONTRACTS-ACTOR-001 carry-forward acceptable) — defer proper JWT actor F-069. Optional: nếu Coder thấy effort low (extract JWT user từ req → service đọc) → có thể fix luôn (BR-68-14 cho phép Phase 1 hardcode, Phase 2 promote khi sẵn sàng).

### PAUSE-68-03 — Atomic combo

✅ **UI 1 button "Xóa data" + checkbox "Tắt auto-sync trước khi xóa".** Backend 2 endpoint riêng: nếu checkbox checked → call `/disable-and-reset` (atomic combo); nếu unchecked → call `/reset-data` (legacy behavior, warning toast). Lý do: UX đơn giản 1 button + giữ tùy chọn cho admin advanced.

### PAUSE-68-04 — Cron mid-flight UI state

✅ **Chọn A (null + status 'in_progress').** Backend trả `nextCronAt: null` + `cronStatus: 'in_progress'`. UI badge hiện "🔵 Đang sync..." pulse animation. Button 🗑️ disabled với tooltip "Chờ sync xong" (60s soft timeout — sau 60s allow override per BR-68-15).

### PAUSE-68-05 — Race live warning + typed confirmation

✅ **Có.** Khi `race.status === 'live'` AND user click 🗑️ hoặc 🔌:
- Dialog title đổi sang đỏ với icon `⛔ Race "{title}" đang LIVE`
- Body hiện warning legal: "Xóa data sẽ ảnh hưởng public leaderboard NGAY"
- Required typed confirmation input "Gõ {courseName} để xác nhận" — case-sensitive exact match
- Button "Xóa data" / "Tắt auto-sync" disabled cho đến khi typed match
- Backend BR-68-13 enforce `confirmedLive: true` field (defense in depth — frontend có thể bypass, backend không bypass)

### PAUSE-68-06 — Polling fallback

✅ **Chọn B (placeholder loading state).** Nếu data-stats endpoint chậm > 500ms cold → badge group hiện skeleton 3 gray bars (NO flash empty). Polling vẫn 5s interval. Nếu vẫn fail sau 3 retry → switch to error state "⚠️ Lỗi tải" + retry button. KHÔNG degrade polling interval (giữ 5s) vì 5s đã hợp lý cho ops cadence.

### PAUSE-68-07 — Pre-existing bug scope

✅ **IN-SCOPE F-068.** Confirm BR-68-10 + BR-68-11 fix `deleteResultsByCourse(courseId)` → `(raceId, courseId)` + `purgeCache(courseId)` → `(raceId, courseId)` với pattern fix. Lý do: UI mới implicit trust 2 bug đã fix. Nếu defer → toast "Đã xóa 576 kết quả" nhưng race_results khác bị wipe → confuse hơn. 2 NEW TC-68-14 + TC-68-15 cover regression.

### PAUSE-68-08 — Performance SLA target

✅ **Đã chốt số:**
- GET data-stats cold: p95 < 500ms (race 100K rows — assumed worst case 5BIB scale)
- GET data-stats warm: p95 < 50ms
- POST reset-data 10K rows: p95 < 3000ms
- POST disable-and-reset 10K rows + cron not in progress: p95 < 3500ms
- Cache hit ratio 5 phút warm: > 80%
- 10x stability: 100% pass

Cron stuck > 60s sau monitoring → ghi TD-F068-CRON-STUCK-DETECT (cron lifecycle recovery defer).

---

## ✅ Status

- [x] **🔵 READY** — sẵn sàng cho Manager review `/5bib-plan`

---

## 🔗 Next step

Danny chạy: `/5bib-plan FEATURE-068-course-data-ops-ux`
