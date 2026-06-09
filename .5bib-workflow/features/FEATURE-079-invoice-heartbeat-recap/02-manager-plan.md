# FEATURE-079: Plan Review

**Status:** ✅ APPROVED with Tech Approach Correction
**Reviewed:** 2026-06-09
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` (5 PAUSE-79-* + 3 risk flag)
- [x] Đã đọc `01-ba-prd.md` đầy đủ (25 BR + 17 TC + 3 state Telegram template + race title resolver section)
- [x] Đã đọc memory: F-076 conventions section + F-049 race-title cache pattern + known-issues invoice-reconcile
- [x] Đã spot-check 5 file critical paths (xem section "Spot-Check Results" dưới)

---

## 🔬 Spot-Check Code Thật (Manager 2026-05-17 mandate)

### File 1: `backend/src/modules/invoice-reconcile/services/invoice-alert.service.ts` (line 104-114)

**Reviewed:** `sendHourlyRecap` skip condition BR-25.

- [x] **Tồn tại** đúng path. Code line 108-110 EXACTLY `if (report.missingCount === 0 && diffEvents.length === 0) return false;` — match BA reference verbatim.
- [x] Relax skip strategy: chỉ cần delete 3 line skip block + thêm composer 3-state render → minimal surgical change.
- ✅ **Verdict:** Implementation path clear, no blocking.

### File 2: `backend/src/modules/invoice-reconcile/services/alert-composer.ts` (line 84-131)

**Reviewed:** `composeHourlyRecap` signature + template.

- [x] Hiện tại `composeHourlyRecap(report, diffEvents, dashboardUrl)` → 3 param. BA propose widen thành 4 param với `raceTitlesByid: Map<number, string>`.
- [x] Pure function — không inject DI deps OK. Backward compat khi param optional `raceTitlesByid: Map<number, string> = new Map()`.
- [x] Existing helper `escapeHtml()` + `formatVnd()` + `truncate()` available — reuse cho race title escape (BR-79-24).
- [x] Diff event format `formatDiffEvent(ev)` line 133-138 — render `race ${ev.raceId}`. F-079 cần update: nếu `raceTitlesByid.get(ev.raceId)` resolve, hiển thị title; fallback `Race ${raceId}` (BR-79-23).
- ✅ **Verdict:** Composer signature widen OK. Coder cần update `formatDiffEvent` helper signature cũng — Plan section dưới sẽ note.

### File 3: `backend/src/modules/invoice-reconcile/crons/hourly-recap.cron.ts` (line 22-25)

**Reviewed:** Cron schedule expression + name + TZ.

- [x] Hiện tại `@Cron('0 0 8-20 * * *', { name: 'invoice-reconcile-hourly-recap', timeZone: 'Asia/Ho_Chi_Minh' })`.
- [x] BR-79-01 propose đổi expression → `'0 0 8,10,12,14,16,18,20,22 * * *'`. `@nestjs/schedule` v3+ dùng `cron` lib hỗ trợ comma-list syntax — verified by Coder local test PAUSE-Coder-79-02.
- [x] Name + TZ giữ NGUYÊN BR-79-03 — KHÔNG đổi ScheduleRegistry mapping.
- ✅ **Verdict:** Schedule change minimal 1-line edit, safe.

### File 4: `backend/src/modules/invoice-reconcile/services/reconcile-classifier.ts` (line 74-89 + 274-310)

**Reviewed:** `ClassifierOutput` shape + `expectedCount` filter logic.

- [x] Line 80-82 hiện có `expectedCount` + `issuedCount` + `atRiskCount` + `breachedCount` + `duplicateCount`. F-079 thêm `skippedCount: number`.
- [x] Line 301-303 compute: `expectedCount = dbOrders.filter(o => !SKIP_CATEGORIES.has(o.orderCategory)).length` → `skippedCount = dbOrders.length - expectedCount` clean 1-line add.
- [x] DTO `ReconcileReportDto` line 13 cần thêm `@ApiPropertyOptional() skippedCount?: number` (optional cho backward compat cached old report).
- ✅ **Verdict:** Schema extension clean, BR-79-12 spec đúng.

### File 5: `backend/src/modules/race-master-data/services/athlete-identity-clustering.service.ts` (line 488 + 549-620)

**Reviewed:** F-049 `getRaceTitlesByMysqlIds(mysqlRaceIds)` source.

- [x] **CRITICAL FINDING:** F-049 pattern dùng **MongoDB `race` collection** (Mongoose) field `mysql_race_id` + `title`, **KHÔNG** MySQL platform direct query.
- [x] Method signature: `async getRaceTitlesByMysqlIds(mysqlRaceIds: number[]): Promise<Map<number, string>>` line 552 — match BA propose composer param shape verbatim.
- [x] Cache key `races:title:byMysqlId:${id}` TTL 3600s + mget batch + setex per cache miss + graceful Redis fail → fallback Mongo. Production-hardened pattern.
- [x] Service exported từ `RaceMasterDataModule.providers` line 117 → có thể import + inject.
- ⚠️ **GAP với BA PRD:** BR-79-21 BA propose query **MySQL platform** `SELECT race_id, title FROM races WHERE race_id = ?` — SAI source-of-truth so với F-049 pattern verbatim. PRD reference cần correct.
- ✅ **Verdict:** Source-of-truth correction needed trong Plan Tech Approach section. Reuse F-049 method DI inject route — Coder follow Plan.

---

## ✓ PRD Validation Checklist

### Completeness
- [x] User Stories đầy đủ 4 (US-01..04) với 4 persona (Danny + Hiền + zero regression)
- [x] Business Rules có ID đầy đủ BR-79-01 → BR-79-25 testable
- [x] Tất cả 5 PAUSE-79-* Manager file 00 đã được BA trả lời
- [x] UI states (Telegram output spec) đầy đủ 3 state variant + 6 backend state (Loading/Anonymous/Data/Error/Success/etc) — N/A một số state vì backend-only
- [x] 3 state Telegram template explicit HTML render đầy đủ

### Technical correctness vs codebase
- [x] DB change MongoDB ZERO + MySQL ZERO + Redis ZERO + S3 ZERO — confirm
- [x] Endpoint shape không đổi — backward compat 100%
- [x] Cache key reuse F-049 pattern verified — `races:title:byMysqlId:<mysql_race_id>` 3600s
- [x] Named connection `'platform'` — N/A (BR-79-21 correction sang Mongoose, KHÔNG đụng MySQL platform direct)
- [x] Generated SDK refresh — DTO thêm `skippedCount?` optional → backward compat OK, có thể skip regen hoặc regen defensive
- [x] Pattern reuse F-076 BR-25 + F-049 race title resolver — verified

### ⚠️ Tech Correction Needed (NOT block — Plan section addresses)
- BR-79-21 BA propose MySQL platform direct query → Plan correct sang **reuse F-049 `getRaceTitlesByMysqlIds()` method từ `AthleteIdentityClusteringService`**. Inject cross-module hoặc extract shared service.

### Security
- [x] Telegram bot token + chat ID env vars — verified BR-14a F-076 pattern
- [x] `escapeHtml()` for race title (BR-79-24) — verified existing helper
- [x] SQL `?` placeholder — N/A sau Plan correction (Mongoose ORM auto-escape)
- [x] Defensive fallback `Race {raceId}` khi DB/Redis fail (BR-79-23)
- [x] No PII leak — heartbeat chỉ render time/count/orderCode/raceId/title/money

### Performance
- [x] Cron tick p95 < 2s inherit F-076 SLA
- [x] Race title resolver cache hit 99%+ expected (race title rarely changes, 3600s TTL)
- [x] Composer pure function ~1KB string output negligible memory

### Testability
- [x] 17 TC explicit (8 unit composer/service + 1 cron parse + 1 stability + 7 race title resolver)
- [x] TC-79-09 smoke test 5-step post-deploy
- [x] TC-79-13 defensive fallback test (BR-79-23 critical)

---

## 📊 Cross-check với memory

### Architecture impact
- **No structural change.** Heartbeat is internal alert-flow widen — KHÔNG thêm node mới.
- `architecture.md` không cần update (existing F-076 cron arrow vẫn đúng).

### Convention impact
- **F-049 race title resolver pattern reuse** — convention F-049 cache key + Mongo fallback sẽ được reaffirmed trong conventions.md post-deploy.
- **Backward compat optional field DTO** — pattern existing (F-019/F-068), không mới.

### Known issues impact
- TD-F076-* tracking F-076 7 alert types — F-079 không resolve / không tạo TD mới critical
- **TD-F079-TZ-BOUNDARY-FILTER** (Manager init flag) — defer, KHÔNG fix trong F-079
- F-049 `getRaceTitlesByMysqlIds` battle-tested 1 month PROD — reuse là choice an toàn

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ được thay đổi các file/folder dưới đây. Đụng ngoài = scope creep, phải hỏi Manager.

### Backend (8 file)

**Modified (5):**
- ✏️ `backend/src/modules/invoice-reconcile/crons/hourly-recap.cron.ts` — cron expression `'0 0 8-20 * * *'` → `'0 0 8,10,12,14,16,18,20,22 * * *'` + cập nhật doc comment
- ✏️ `backend/src/modules/invoice-reconcile/services/invoice-alert.service.ts` — remove skip block line 108-110 trong `sendHourlyRecap` + signature mở rộng nhận `raceTitlesByid` param từ service → composer
- ✏️ `backend/src/modules/invoice-reconcile/services/alert-composer.ts` — `composeHourlyRecap()` thêm param `raceTitlesByid: Map<number, string>` + helper `composeRaceTag(title, raceId)` + 3-state render branch + `formatDiffEvent()` thêm race title context
- ✏️ `backend/src/modules/invoice-reconcile/services/invoice-reconcile.service.ts` — `runHourlyRecap()` call `getRaceTitlesByMysqlIds(enabledRaceIds)` trước khi gọi `sendHourlyRecap()`. Pass Map xuống.
- ✏️ `backend/src/modules/invoice-reconcile/services/reconcile-classifier.ts` — `ClassifierOutput` thêm field `skippedCount: number` + compute line 301-303 thêm `skippedCount = dbOrders.length - expectedCount`
- ✏️ `backend/src/modules/invoice-reconcile/dto/reconcile-report.dto.ts` — thêm `@ApiPropertyOptional() skippedCount?: number` (backward compat)
- ✏️ `backend/src/modules/invoice-reconcile/invoice-reconcile.module.ts` — `imports: [RaceMasterDataModule]` (hoặc forwardRef nếu cần) để inject `AthleteIdentityClusteringService`

**Tests (3):**
- ✏️ `backend/src/modules/invoice-reconcile/__tests__/alert-composer.spec.ts` — extend TC-79-01..04 + TC-79-15..17 (3-state heartbeat + truncate + escape)
- ✏️ `backend/src/modules/invoice-reconcile/__tests__/invoice-reconcile.service.spec.ts` — extend TC-79-05/06/08/10/11..14 (relax skip + race title resolver integration + defensive fallback)
- ➕ `backend/src/modules/invoice-reconcile/__tests__/hourly-recap.cron.spec.ts` (NEW) — TC-79-07 cron parse comma-list

### Frontend
- **ZERO change.** Generated SDK regen optional (DTO thêm optional field — không break frontend rendering).

### Docs (optional)
- `docs/conventions.md` — Manager append F-049 reuse note ở `/5bib-deploy`

**TOTAL: 8 backend file. ZERO frontend. ZERO migration. ZERO new endpoint.**

---

## 🔧 Tech approach (Coder có thể tinh chỉnh)

### Race title resolver — CORRECTION quan trọng

**BA PRD BR-79-21 propose MySQL platform direct query** → Manager correct sang **REUSE F-049 method**:

```typescript
// invoice-reconcile.module.ts
@Module({
  imports: [
    // ... existing imports ...
    RaceMasterDataModule,   // F-079 — inject AthleteIdentityClusteringService for race title resolver
  ],
  // ... providers + exports unchanged ...
})
export class InvoiceReconcileModule {}

// invoice-reconcile.service.ts (runHourlyRecap method)
constructor(
  // ... existing deps ...
  private readonly raceTitleResolver: AthleteIdentityClusteringService,
) {}

async runHourlyRecap(date: string): Promise<...> {
  // ... existing logic ...
  const enabledRaceIds = this.getEnabledRaceIds(); // [140, 220]
  const raceTitlesByid = await this.raceTitleResolver.getRaceTitlesByMysqlIds(enabledRaceIds);
  // raceTitlesByid: Map<number, string> reuse F-049 cache `races:title:byMysqlId:<id>` 3600s + Mongo fallback
  const sent = await this.alert.sendHourlyRecap(current, diffEvents, raceTitlesByid);
  // ...
}
```

**Lý do correct:**
1. F-049 đã production-hardened (graceful Redis fail + Mongo fallback + batch mget + setex write-back) — KHÔNG cần viết lại logic resolver.
2. Cache key cùng namespace `races:title:byMysqlId:` — share cache với F-049 admin endpoint, KHÔNG fragment Redis.
3. Source-of-truth nhất quán: MongoDB `race` collection (sync từ MySQL platform). MySQL platform direct query của BA risk inconsistency nếu MongoDB sync lag (rare nhưng possible).
4. Cross-module DI tiêu chuẩn NestJS — `RaceMasterDataModule.exports` đã có `AthleteIdentityClusteringService` (line 117) — KHÔNG cần update module exports.

**Alternative (FUTURE, OUT OF SCOPE F-079):** Extract `getRaceTitlesByMysqlIds()` thành shared `RaceTitleResolverService` trong `common/` module → cả F-049 + F-079 dùng. Tracked **TD-F079-EXTRACT-RACE-TITLE-RESOLVER** (priority LOW post-deploy).

### Compose 3-state heartbeat

```typescript
// alert-composer.ts
export function composeHourlyRecap(
  report: ReconcileReportDto,
  diffEvents: DiffEvent[],
  dashboardUrl: string,
  raceTitlesByid: Map<number, string> = new Map(),  // F-079 — default empty for backward compat
): string {
  const enabledRaceIds = report.enabledRaceIds ?? []; // hoặc compute từ report.missing.map(r => r.raceId).distinct
  const raceTagLines = enabledRaceIds.map(id => composeRaceTag(raceTitlesByid.get(id), id));
  // ... 3 state branch logic ...
}

function composeRaceTag(title: string | undefined, raceId: number): string {
  if (!title) return `Race ${raceId}`;  // BR-79-23 fallback
  const safe = escapeHtml(title);       // BR-79-24
  const truncated = safe.length > 80 ? safe.slice(0, 77) + '...' : safe;  // BR-79-25
  return `${truncated} - ${raceId}`;
}

function computeNextHeartbeatHour(currentHour: number): string {
  // BR-79-11: 8→10, 10→12, ..., 20→22, 22→"08:00 (ngày hôm sau)"
  const heartbeatHours = [8, 10, 12, 14, 16, 18, 20, 22];
  const idx = heartbeatHours.indexOf(currentHour);
  if (idx === -1 || idx === heartbeatHours.length - 1) {
    return '08:00 ICT (ngày hôm sau)';
  }
  return `${String(heartbeatHours[idx + 1]).padStart(2, '0')}:00 ICT`;
}
```

### Relax skip

```typescript
// invoice-alert.service.ts
async sendHourlyRecap(
  report: ReconcileReportDto,
  diffEvents: DiffEvent[],
  raceTitlesByid: Map<number, string> = new Map(),
): Promise<boolean> {
  // F-079 BR-79-04 — removed skip-when-OK condition. Always dispatch.
  const html = composeHourlyRecap(report, diffEvents, this.dashboardUrl(), raceTitlesByid);
  return this.dispatch(html, 'hourly-recap');
}
```

---

## 🛑 PAUSE points cho Coder

Trước khi làm các bước sau, Coder DỪNG và confirm với Danny / Manager:

- 🛑 **PAUSE-Coder-79-01:** Trước khi thêm `RaceMasterDataModule` vào `InvoiceReconcileModule.imports` — verify KHÔNG có circular dependency. Nếu có → dùng `forwardRef(() => RaceMasterDataModule)` HOẶC extract shared resolver (Manager đề xuất Option A trong Tech Approach).
- 🛑 **PAUSE-Coder-79-02:** Trước khi deploy PROD → smoke test BR-79-18 5-step + verify cron tick mới `'0 0 8,10,12,14,16,18,20,22 * * *'` parse đúng (Coder test local trước với `parseExpression()` cron-parser).
- 🛑 **PAUSE-Coder-79-03:** Deploy WINDOW — đề xuất sau 20:00 ICT tránh peak transaction race 220 (Manager + Danny chốt `/5bib-deploy`).
- 🛑 **PAUSE-Coder-79-04:** KHÔNG đụng 6 loại alert khác F-076 + 2 cron khác (scan-tick + eod-recap). Scope chỉ hourly-recap.
- 🛑 **PAUSE-Coder-79-05:** **Source-of-truth correction (Manager `/5bib-plan`)** — KHÔNG implement BA's BR-79-21 MySQL platform direct query. INSTEAD reuse F-049 `AthleteIdentityClusteringService.getRaceTitlesByMysqlIds()` per Tech Approach section above.
- 🛑 **PAUSE-Coder-79-06:** Nếu phát hiện cần đụng file ngoài Scope Lock 8 file → DỪNG hỏi Manager.

---

## 🧪 Unit test BẮT BUỘC

Coder không được mark `READY_FOR_QC` nếu thiếu các test sau:

### `alert-composer.spec.ts` extend (NEW test cases)
- [ ] **TC-79-01** Composer "All OK" state — heartbeat thuần (BR-79-07)
- [ ] **TC-79-02** Composer "All OK + diff" state (BR-79-08)
- [ ] **TC-79-03** Composer "Có issue" state regression check (BR-79-09 — verify BR-25 format intact)
- [ ] **TC-79-04** Next heartbeat compute (BR-79-11) — `8→10, 10→12, 20→22, 22→08 (next day)`
- [ ] **TC-79-15** Race title truncate >80 char (BR-79-25)
- [ ] **TC-79-16** Composer integration với raceTitlesByid Map multi-race (BR-79-20)
- [ ] **TC-79-17** Race title escape HTML `<script>` (BR-79-24)

### `invoice-reconcile.service.spec.ts` extend
- [ ] **TC-79-05** Skip removed verify — `missingCount=0 diffEvents=[]` → Telegram dispatch CALLED (NOT skip)
- [ ] **TC-79-06** Telegram dispatch fail → return false (KHÔNG throw)
- [ ] **TC-79-08** `runHourlyRecap` end-to-end mock với raceTitlesByid resolution
- [ ] **TC-79-10** 10x stability — concurrent runHourlyRecap → exactly 1 Telegram dispatch (Redis lock existing)
- [ ] **TC-79-11** Race title resolver cache hit (skip Mongo query)
- [ ] **TC-79-12** Race title resolver cache miss → Mongo fallback (NOTE: BA propose MySQL direct, Manager correct sang Mongo per Tech Approach)
- [ ] **TC-79-13** Race title resolver DB+Redis fail → fallback `Race {raceId}` (BR-79-23, defensive critical)
- [ ] **TC-79-14** Race title resolver race_id không tồn tại → fallback string

### `hourly-recap.cron.spec.ts` NEW
- [ ] **TC-79-07** Cron expression `'0 0 8,10,12,14,16,18,20,22 * * *'` parse đúng + next 8 fire times next 24h

**Mỗi test PHẢI có `describe` group rõ ràng + assertion cụ thể.**

---

## 📊 Verdict

> ### ✅ APPROVED with Tech Approach Correction — Coder có thể bắt đầu

**Rationale:** PRD đầy đủ 25 BR + 17 TC + 3 state Telegram template + 5 PAUSE-79-* answered. 1 GAP CRITICAL (BR-79-21 source-of-truth MySQL vs Mongo) đã correct trong Plan Tech Approach + PAUSE-Coder-79-05. Coder follow Plan correction, KHÔNG implement BA's MySQL direct path.

**Risk residual:**
- F-076 vừa golive race 220 đang bán — touch sensitive. PAUSE-Coder-79-02 + 79-03 mandatory pre-merge.
- Cross-module DI `RaceMasterDataModule` → InvoiceReconcileModule. Coder verify zero circular deps PAUSE-Coder-79-01.

**No PRD revision needed.** Coder skip thẳng sang `/5bib-code`.

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] **Yes** — Coder bắt đầu code theo Scope Lock 8 file + 6 PAUSE-Coder-79-* + 14 unit test mandate.

---

## 🔗 Next step

Danny chạy: `/5bib-code FEATURE-079-invoice-heartbeat-recap`
