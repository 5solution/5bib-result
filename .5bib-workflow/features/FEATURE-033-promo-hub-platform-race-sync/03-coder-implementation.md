# FEATURE-033: Coder Implementation Log

**Status:** 🟠 **READY_FOR_QC**
**Started:** 2026-05-14
**Author:** 5bib-fullstack-engineer
**Linked:** `00`, `01`, `02`

---

## 📌 Pre-flight check

- [x] Đã đọc 00 + 01 + 02 đầy đủ
- [x] Đã đọc memory `conventions.md` + `codebase-map.md` (named connection pattern)
- [x] Đã đọc code thật `race-master-data/entities/race-course-readonly.entity.ts` (template) + `reconciliation/services/reconciliation-query.service.ts` (cross-DB query pattern)

---

## 🔍 Impact Assessment (Think First)

### Backend
- MySQL platform DB: NEW entity `RaceReadonly` map `races` table — read-only, narrow column selection (12/70+ cols)
- TypeORM named connection `'platform'` reuse — register `TypeOrmModule.forFeature([RaceReadonly], 'platform')` trong PromoHubModule
- Redis: NEW key `promo-hub:races-on-sale:<limit>:<sort>` TTL 60s — KHÔNG conflict existing key namespace
- NestJS: KHÔNG thêm module mới, extend PromoHubModule. Inject Repository qua `@Optional()` để test KHÔNG cần real DB

### Frontend
- Next.js cache: NEW tag `promo-hub-races-on-sale` cho fetch — đồng nhất F-027 pattern
- Server Component branch by `section.config.source` — KHÔNG đổi rendering boundary
- New helper `getTicketUrl()` trong `internal-urls.ts` (file đã có từ cross-app rewrite fix)

### API Contract
- Endpoint MỚI `GET /api/promo-hubs/races-on-sale` — public no-auth
- Route declared BEFORE `Get(':id')` — avoid route shadowing (pattern F-003 convention)
- SDK regen sau DTO ready: admin + frontend cả 2

---

## ⚠️ Edge Cases Covered

- [x] Race với `url_name IS NULL` → SKIP (BR-PH33-03) — `andWhere('r.url_name IS NOT NULL')`
- [x] Race với `is_delete = 1` → KHÔNG xuất hiện — `CAST(r.is_delete AS UNSIGNED) = 0`
- [x] Race với `is_show = 0` → KHÔNG xuất hiện — `CAST(r.is_show AS UNSIGNED) = 1`
- [x] `limit > 20 / < 1` → reject 400 validation (`@Min(1) @Max(20)`)
- [x] `sort` invalid string → reject 400 validation (`@IsEnum(RACE_ON_SALE_SORT_VALUES)`)
- [x] MySQL connection drop → catch → return `[]` (no 500, log error)
- [x] Redis throws → fallback DB direct, log warning, continue
- [x] `raceRepo` not injected (test environment) → return `[]` with warn log
- [x] Backward-compat F-027 existing hub: section config thiếu `source` → admin/frontend default `'result_active'` preserve cũ
- [x] `urlName` empty string trong DB (theoretically possible nếu validation slip) → still goes to ticketUrl, frontend would 404 acceptable
- [x] `title` NULL → DTO maps `?? ''` (empty string render)

---

## 🧠 Logic & Architecture

**Service architecture choice:** Inline `findRacesOnSale()` method trong `PromoHubService` (Option A per Manager Plan recommend). Reason: shared cache prefix infra + small method (<60 LOC) + tests cùng spec file.

**Bit type handling:** `CAST(... AS UNSIGNED) = 0/1` trong QueryBuilder raw clause — cleaner than load entity then `Buffer.readUInt8(0)`. Tests confirm filter works as text comparison (verified F-019 awards pattern same approach).

**Cache strategy:** TTL-only invalidation (60s). Reason: race lifecycle ở 5Ticket platform — 5bib-result backend KHÔNG nhận write event. Acceptable lag 60s cho MKT use case.

**No anti-stampede SETNX:** Limit 20 race × 60s cache → max ~50 concurrent miss/min in worst case (Redis stampede acceptable cho payload size 5-10KB JSON). Add SETNX nếu monitoring shows DB spike post-launch.

**Backward-compat 2-layer:**
1. Frontend: `c.source ?? 'result_active'` (preserve F-027 behavior)
2. Admin form: `(c.source ?? 'result_active')` initial value
Existing F-027 hub published trước F-033 → continue work without migration.

---

## 💻 Files Changed

### Backend (3 NEW + 3 MODIFY)
- ➕ `backend/src/modules/promo-hub/entities/race-readonly.entity.ts` (53 LOC) — TypeORM entity `@Entity('races')` 12 columns
- ➕ `backend/src/modules/promo-hub/dto/race-on-sale-response.dto.ts` (76 LOC) — `RacesOnSaleQueryDto` (limit + sort enum) + `RaceOnSaleResponseDto` + `RacesOnSaleListResponseDto`
- ✏️ `backend/src/modules/promo-hub/promo-hub.module.ts` — register `TypeOrmModule.forFeature([RaceReadonly], 'platform')`
- ✏️ `backend/src/modules/promo-hub/promo-hub.service.ts` — inject `@InjectRepository(RaceReadonly, 'platform') @Optional()` + add method `findRacesOnSale()` + helper `toRaceOnSaleDto()` + 4 new constants (TICKET_URL_BASE, CACHE_PREFIX, CACHE_TTL, STATUS)
- ✏️ `backend/src/modules/promo-hub/promo-hub.controller.ts` — add `@Get('races-on-sale')` endpoint with `@ApiQuery + ApiResponse` Swagger decorators
- ✏️ `backend/src/modules/promo-hub/promo-hub.service.spec.ts` — extend `describe('findRacesOnSale')` block with 9 tests

### Frontend (1 MODIFY + 1 EXTEND)
- ✏️ `frontend/components/hub/internal-urls.ts` — extend với `getTicketUrl(urlName)` + `TICKET_BASE_URL` env override
- ✏️ `frontend/components/hub/sections/RaceCalendarSection.tsx` — rewrite component branch by `source`. Two sub-render: `ResultRaceCalendar` (F-027 preserved) + `PlatformRaceCalendar` (F-033 new). NEW helper `computeDaysLeft()` for countdown badge

### Admin (2 MODIFY)
- ✏️ `admin/src/components/promo-hub/section-types.ts` — update `race_calendar` description + defaultConfig (source: 'platform_on_sale', sort: 'registration_start_time')
- ✏️ `admin/src/components/promo-hub/SectionConfigDialog.tsx` — case `'race_calendar'` rewrite: add "Nguồn dữ liệu" Select + conditional render "Sắp xếp" (platform mode) vs "Lọc theo trạng thái" (result mode)

### SDK regen (auto)
- 🔄 `admin/src/lib/api-generated/*.gen.ts` — exports `promoHubControllerFindRacesOnSale` + `RaceOnSaleResponseDto` types
- 🔄 `frontend/lib/api-generated/*.gen.ts` — same (note: F-033 frontend uses raw fetch not SDK, but types available)

**Files KHÔNG đụng ngoài Scope Lock — 0 scope creep.**

---

## 🧪 Tests Written

### Unit tests — Backend
File: `backend/src/modules/promo-hub/promo-hub.service.spec.ts`

Added 9 new tests trong `describe('findRacesOnSale() — MySQL platform on-sale phase')`:

1. `queries with filter status=GENERATED_CODE + is_delete=0 + is_show=1 + url_name NOT NULL`
2. `respects limit + default sort=registration_start_time ASC`
3. `sort=event_date maps to r.event_start_date ASC`
4. `default limit=6 when not provided`
5. `Redis cache HIT on 2nd call — returns cached without re-querying MySQL`
6. `Redis GET throws → fallback DB direct (graceful degrade)`
7. `MySQL query throws → return empty [] (no 500)`
8. `transforms RaceReadonly → DTO, strips tenant_id, pre-computes ticketUrl`
9. `caches result on successful query (Redis SET called)`

### Test results

```
PASS src/modules/promo-hub-analytics/promo-hub-analytics.service.spec.ts
PASS src/modules/promo-hub/promo-hub.controller.spec.ts
PASS src/modules/promo-hub/promo-hub.service.spec.ts (with 9 F-033 new tests)

Test Suites: 3 passed, 3 total
Tests:       37 passed, 37 total  (28 baseline + 9 F-033 new)
Snapshots:   0 total
Time:        3.7 s
```

### Build verification

```
Backend tsc --noEmit: PASS (no new errors, 4 pre-existing in upload spec unrelated)
Admin pnpm build:    ✓ Compiled successfully in 6.3s
Frontend next build: ✓ Compiled successfully in 5.2s
```

---

## 🛑 PAUSE/Confirmation log

KHÔNG có PAUSE — Plan đã pre-approve tech approach Option A inline method.

---

## 🚧 Scope creep / Out-of-Scope changes

KHÔNG. Tất cả file thay đổi nằm trong Scope Lock của `02-manager-plan.md`.

---

## 🐛 Known limitations / Tech debt

- **TD-F033-01** LOW — `RaceReadonly` entity chỉ map 12/70+ columns. Adding column tương lai cần verify SELECT grant cho `5bib_readonly_user`.
- **TD-F033-02** LOW — Multi-tenant filter Phase 2 (admin chọn tenant_id) — current show ALL.
- **TD-F033-03** LOW — Race CTA `target="_blank"` mở tab mới — analytics tracker `keepalive: true` fetch fire OK nhưng race-card open trong same tab cũ. Acceptable cho promo (giữ user trên hub).
- **TD-F033-04** MED — Anti-stampede SETNX KHÔNG implement. Acceptable hiện tại; add nếu monitoring shows MySQL spike post-launch.
- **TD-F033-05** LOW — `computeDaysLeft()` chỉ tính based on `registrationEndTime`. Nếu admin muốn countdown khác (vd "Còn N ngày nữa khai mạc") → custom field section config Phase 2.

---

## ✅ Status

- [x] IN_PROGRESS
- [x] READY_FOR_QC

**Required to mark READY_FOR_QC:**
- [x] Tất cả file trong Scope Lock đã code xong
- [x] Unit test PASS (37/37)
- [x] Backend `tsc --noEmit` no new errors
- [x] Admin + Frontend builds PASS
- [x] No `console.log`, no `any` type, no `as unknown as X` in F-033 code

---

## 🔗 Next step

`/5bib-qc FEATURE-033-promo-hub-platform-race-sync`
