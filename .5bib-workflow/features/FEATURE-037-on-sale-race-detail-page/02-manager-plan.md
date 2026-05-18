# FEATURE-037: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-05-18
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md` (READY), `01-ba-prd.md` (READY)

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` (READY + MySQL schema verified)
- [x] Đã đọc `01-ba-prd.md` toàn bộ — 25 BR-37-01..25, full UI tables, DTO code blocks, 10 TC backend + 10 E2E
- [x] Đã đọc memory: `architecture.md` (F-033 promo-hub + F-036 SEO pages context), `conventions.md` (F-033 patterns reuse), `known-issues.md` (TD-F036-09 will resolve)
- [x] MySQL schema spot-checked via DESCRIBE (Manager 2026-05-18) — all referenced cols exist

---

## ✓ PRD Validation Checklist

### Completeness
- [x] User Stories 7 stories with proper Personas (Anonymous Visitor x4, Race Organizer x2, Back-Office Admin x1, Google Crawler x1)
- [x] Business Rules đánh số BR-37-01..25 (25 rules total, well-grouped: schema/dual-source/CTA/sitemap/cache/perf/edge-cases)
- [x] All 4 PAUSE conditions từ file 00 đã trả lời (BA-Q1..4 với defaults rationale)
- [x] UI States 8 states đầy đủ — loading SSR / 404 / data active / data registration-closed / desc empty / courses empty / error fetch / race transition

### Technical correctness vs codebase
- [x] **Schema verified:** Manager đã DESCRIBE MySQL — all 7 extension cols + 16 race_course cols exist. NO DDL change needed.
- [x] **Named connection** `'platform'` used correctly (F-033 pattern reused)
- [x] **Bit field handling** `CAST(deleted AS UNSIGNED) = 0` reuses F-033 known pattern
- [x] **No N+1 query** — JOIN race + race_course in single SELECT
- [x] **Endpoint REST convention** `GET /api/promo-hubs/races-on-sale/by-url-name/:urlName` consistent với F-033 `/races-on-sale`
- [x] **Cache key** `promo-hub:race-on-sale-detail:<urlName>` follows `[resource]:[id]:[variant]` pattern
- [x] **Dual-source fallback** logic clear (BR-37-06..08): MongoDB → MySQL → 404
- [x] **Sitemap include** with priority 0.9 matches F-036 BR-19 active type
- [x] **Generated SDK regen:** N/A — admin doesn't consume this public endpoint, frontend uses raw fetch (consistent với F-036 pattern)

### Security
- [x] **Public endpoint** (no JWT) — same as F-033 listing, explicit reasoning
- [x] **Response leak prevention** — MUST NOT leak tenant_id, is_delete, is_show, metadata.internal, created_by_id (listed in TC-37-01)
- [x] **HTML sanitization** — race.description + race_course.description allowlist p/strong/em/ul/ol/li/br (XSS defense in TC-37-09)
- [x] **URL param validation** — no path traversal (TC-37-08)
- [x] **CORS same-origin** explicit
- [x] **Rate limit** reuse F-033 ThrottlerGuard 60 req/min/IP

### Performance
- [x] SLA cụ thể: backend p95 < 300ms cold / < 50ms warm, page p95 < 800ms cold / < 200ms ISR
- [x] Cache strategy: Redis 600s + Next.js ISR 3600s (BR-37-17,18)
- [x] 10x concurrent stability test scenario explicit (TC-37-07)
- [x] No cron new — reuse F-036 ISR auto-detect (transition ≤1h)

### Testability
- [x] 10 backend TC-37-XX với full 8 elements (Method/URL/Headers/Body/Status/Body shape/MUST NOT leak/Side effects)
- [x] 10 frontend E2E Playwright cases per persona journey
- [x] Anti-pattern verification ZERO `<form>`/onClick mua vé (carry-over F-036 BR-10)
- [x] Concurrent stability + cache stampede TC-37-07

---

## 📊 Cross-check với memory

### Architecture impact

F-037 chỉ extend F-033 promo-hub module (entity wiring + 1 endpoint). Reuse F-036 routing infrastructure. NO new architectural node.

Architecture diagram update sau deploy:
```
PromoHubModule (existing F-027 + F-033)
├── RaceReadonly entity (F-033) — EXTEND +7 cols
├── RaceCourseReadonly entity — NEW (F-037)
└── findRaceOnSaleByUrlName() method — NEW (F-037)
   └─ JOIN race + race_course query single round-trip
```

### Convention impact

KHÔNG có pattern mới minted. F-037 reuse:
- F-033 bit field handling: `CAST(field AS UNSIGNED) = 0/1`
- F-033 named connection `'platform'` + TypeORM read-only entity
- F-033 ThrottlerGuard rate limit
- F-036 dual-source merge in `getAllRaces()`
- F-036 buildSellingWebUrl() helper for CTA
- F-036 self-canonical metadata + noindex direct host
- F-036 JSON-LD SportsEvent + BreadcrumbList
- F-036 sitemap-races.xml route handler

→ `conventions.md` no update needed post-deploy.

### Known issues impact

| Issue | F-037 effect |
|-------|--------------|
| TD-F036-09 HIGH (on-sale internal detail deferred) | **RESOLVED** by F-037 — Manager will mark RESOLVED in `/5bib-deploy` |
| TD-F033-06 HIGH (url_name NULL fallback) | Reuse fallback to raceId, no new issue |
| TD-F036-02 MED (5Ticket Vercel rewrite pending) | F-037 KHÔNG impact — Vercel rewrite covers `/giai-chay/:path*` already |

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ được thay đổi file/folder dưới đây. Đụng ngoài = scope creep, phải hỏi Manager.

### Backend (`backend/`)

**Modify (3 files):**
- ✏️ `src/modules/promo-hub/entities/race-readonly.entity.ts` — Add 7 columns: `description`, `images`, `eventType` (col `event_type`), `raceType` (col `race_type`), `district`, `season`, `locationUrl` (col `location_url`)
- ✏️ `src/modules/promo-hub/promo-hub.service.ts` — Add method `findRaceOnSaleByUrlName(urlName: string)` với LEFT JOIN race_course query + Redis cache layer
- ✏️ `src/modules/promo-hub/promo-hub.controller.ts` — Add `@Get('races-on-sale/by-url-name/:urlName')` endpoint
- ✏️ `src/modules/promo-hub/promo-hub.module.ts` — Register `RaceCourseReadonly` entity in `TypeOrmModule.forFeature([..., RaceCourseReadonly], 'platform')`
- ✏️ `src/modules/app.module.ts` — Add `RaceCourseReadonly` to `'platform'` DataSource entities array (BOTH places mandatory per F-033 lesson)

**Add (4 files):**
- ➕ `src/modules/promo-hub/entities/race-course-readonly.entity.ts` — NEW TypeORM entity mapping `race_course` table 16 cols
- ➕ `src/modules/promo-hub/dto/race-on-sale-detail.dto.ts` — NEW DTOs: `RaceCourseDto` + `RaceOnSaleDetailDto` (full code block trong PRD §3.3)
- ➕ `src/modules/promo-hub/promo-hub.service.spec.ts` — EXTEND existing spec (or new spec) — add tests for `findRaceOnSaleByUrlName()` method

### Frontend (`frontend/`)

**Modify (4 files):**
- ✏️ `frontend/lib/seo-api.ts` — Extend `getRaceBySlug()` dual-source fallback (MongoDB miss → MySQL on-sale endpoint). Add `getRaceOnSaleByUrlName(urlName)` helper.
- ✏️ `frontend/app/(main)/giai-chay/[raceSlug]/page.tsx` — Conditional render for `race.source === 'on-sale'` branch: render courses from `race.courses` array, use `race.sellingWebUrl` from backend, registration-closed state handling
- ✏️ `frontend/components/giai-chay/RaceCard.tsx` — REVERT on-sale branch: change external `<a href>` to internal `<Link href>` (now that detail page exists). ⚠️ **REGRESSION RISK** — Coder + QC MUST verify F-036 listing still works.
- ✏️ `frontend/app/sitemap-races.xml/route.ts` — REMOVE skip filter `if (race.source === 'on-sale') continue` at line 53-55. Add lastmod fallback chain for on-sale entries.

**Add (2 files):**
- ➕ `frontend/components/giai-chay/CourseCard.tsx` — Server Component, render course detail (distance, price VND format, route image, gain, age range)
- ➕ `frontend/components/giai-chay/RouteImageLightbox.tsx` — `'use client'` modal for image lightbox (state + escape key handler)

### KHÔNG đụng

- ❌ MongoDB `races` collection / `RacesService` — F-037 read-only on MySQL
- ❌ `next.config.ts` `assetPrefix` — giữ `https://result.5bib.com` (carry-over F-036)
- ❌ F-036 admin/seo module — F-037 KHÔNG đụng cron / admin trigger
- ❌ F-027 hub module — F-037 chỉ extend promo-hub entity wiring, KHÔNG đụng hub UI

---

## 🔧 Tech approach (đề xuất, Coder có thể tinh chỉnh)

### Backend query strategy
- LEFT JOIN race + race_course in single SELECT via TypeORM QueryBuilder
- Filter `races.status = 'GENERATED_CODE' AND races.is_delete = 0 AND races.is_show = 1`
- Filter race_course `deleted = 0` via CAST AS UNSIGNED
- Pre-compute `sellingWebUrl` in service layer (reuse F-036 pattern or simple template literal)

### Frontend dual-source fallback in `getRaceBySlug()`
```typescript
async function getRaceBySlug(slug: string): Promise<Race | null> {
  // Try MongoDB first
  const mongoRace = await safeFetch<Race>(`${BACKEND_URL}/api/races/slug/${slug}`, ...);
  if (mongoRace && mongoRace.status !== 'draft') return { ...mongoRace, source: 'mongodb' };

  // Fallback to MySQL on-sale
  const onSaleRace = await safeFetch<RaceOnSaleDetailDto>(
    `${BACKEND_URL}/api/promo-hubs/races-on-sale/by-url-name/${slug}`, ...
  );
  if (onSaleRace) return mapOnSaleToRaceShape(onSaleRace); // normalize to Race type with source='on-sale'

  return null;
}
```

### Detail page conditional render
```typescript
// Page level — pseudo code structure (Coder finalize)
const race = await getRaceBySlug(raceSlug);
if (!race) notFound();

const isOnSale = race.source === 'on-sale';
const courses = race.courses ?? [];

return (
  <main>
    <Hero race={race} isOnSale={isOnSale} />
    <RaceCTA race={race} isOnSale={isOnSale} />  // uses race.sellingWebUrl directly for on-sale
    {race.description && <DescriptionSection html={sanitize(race.description)} />}
    {courses.length > 0 ? (
      <CoursesGrid courses={courses} />
    ) : (
      <PlaceholderCourses />  // BR-37-25
    )}
  </main>
);
```

### Sitemap revert + extend
- Remove line `if (race.source === 'on-sale') continue;`
- Add `lastmod` fallback chain: `race.endDate ?? race.startDate ?? race.eventStartDate ?? now`
- Set `priority` based on source + status (F-037 on-sale = 0.9, F-036 ended = 0.6)

---

## 🛑 PAUSE points cho Coder

Trước khi làm các bước sau, Coder DỪNG và confirm với Danny / Manager:

- 🛑 **Trước khi extend `RaceReadonly` entity** — verify MySQL `5bib_readonly_user` SELECT grant covers all 7 new cols. If grant missing → Danny ping DB admin (Manager 2026-05-18 verified user can SELECT description+brand cols, but cross-check `images`, `event_type`, `race_type`, `district`, `season`, `location_url`).
- 🛑 **Trước khi `pnpm install`** — KHÔNG cần dep mới (no new lib). If Coder thấy cần → STOP, hỏi Manager.
- 🛑 **Trước khi REVERT `RaceCard.tsx` on-sale branch** — chạy F-036 listing localhost preview verify 73 cards render OK với on-sale internal `<Link>` thay vì external. Manager flag REGRESSION RISK — must smoke test trước commit.
- 🛑 **Trước khi enable sitemap include on-sale** — verify backend endpoint /races-on-sale/by-url-name/:urlName trả 200 cho all 17 urlNames. Nếu có any 404 → fix backend trước, KHÔNG để Google crawl 404.
- 🛑 **Nếu phát hiện MySQL col `is_show` bit handling edge case** — STOP, document trong PAUSE log, sync với Manager (might need separate test fixture).
- 🛑 **Nếu phát hiện cần đụng file ngoài Scope Lock** — STOP, hỏi Manager update plan.

---

## 🧪 Unit test BẮT BUỘC (Coder phải viết, QC sẽ check)

Coder KHÔNG được mark feature `READY_FOR_QC` nếu thiếu các test sau:

### `promo-hub.service.spec.ts` (extend existing)
- [ ] `findRaceOnSaleByUrlName()` — happy path: race exists with 3 courses → returns full DTO with courses array
- [ ] `findRaceOnSaleByUrlName()` — race not found → returns null (will trigger 404 in controller)
- [ ] `findRaceOnSaleByUrlName()` — race is_show=0 → returns null (BR-37-23)
- [ ] `findRaceOnSaleByUrlName()` — race is_delete=1 → returns null (BR-37-24)
- [ ] `findRaceOnSaleByUrlName()` — race status != 'GENERATED_CODE' → returns null (BR-37-26 future-proof)
- [ ] `findRaceOnSaleByUrlName()` — race với 0 courses → returns DTO with empty courses array
- [ ] `findRaceOnSaleByUrlName()` — race với course deleted=1 → course excluded from response
- [ ] `findRaceOnSaleByUrlName()` — cache hit on 2nd call → MySQL query NOT executed (Redis layer verify)
- [ ] `findRaceOnSaleByUrlName()` — concurrent 10 calls → max 1-2 MySQL queries (cache stampede defense)
- [ ] `mapOnSaleToRaceShape()` (or similar normalizer) — produces correct Race type with `source: 'on-sale'`, `status: 'pre_race'`

### `race-course-readonly.entity.spec.ts` (smoke test)
- [ ] Entity loads with 16 cols mapped correctly
- [ ] Bit field `deleted` Buffer type handled

### `seo-api.spec.ts` (if frontend infra allows — F-036 has no jest yet, can skip)
- [ ] `getRaceBySlug()` — MongoDB hit → returns mongo race (no MySQL fallback called)
- [ ] `getRaceBySlug()` — MongoDB miss → MySQL fallback returns on-sale race
- [ ] `getRaceBySlug()` — both miss → returns null
- [ ] `getRaceBySlug()` — MongoDB returns draft → falls through to MySQL (correct behavior per BR-37-06)

**Test results paste in `03-coder-implementation.md` MUST show all backend tests PASS.**

---

## 📊 Verdict

> ### ✅ APPROVED — Coder có thể bắt đầu

PRD chất lượng cao — 25 BR numbered, full UI tables per Manager 2026-05-14 mandate, 10 TC backend với 8 elements full spec, DTO code block với @ApiProperty, schema verified by Manager.

**Strengths:**
1. ✅ MySQL schema completely verified before PRD writing — zero "unknown col" risk
2. ✅ Reuse all proven patterns (F-027 + F-033 + F-036) — no new architectural complexity
3. ✅ Anti-pattern carry-over (ZERO form purchase) — Danny mandate preserved
4. ✅ Dual-source fallback logic explicit + tested
5. ✅ 4 BA-Q resolved with rationale defaults

**Concerns flagged (non-blocking):**
1. ⚠️ **RaceCard revert** = regression risk for F-036 (already in PROD via release/v1.8.7). Coder MUST smoke test before commit + QC verify F-036 listing not broken
2. ⚠️ **MySQL grant** for new cols — Coder verify SELECT permission before deploy (TC-37-01 fail catches this)
3. ⚠️ **PROD env** `FRONTEND_REVALIDATE_GIAICHAY_URL` (TD-F036-06) — F-037 inherits this dependency; if not set, manual admin trigger still works

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] **Yes** — Coder có thể bắt đầu theo Scope Lock + 6 PAUSE points + Tech approach guidance.

---

## 🔗 Next step

Danny chạy:
```
/5bib-code FEATURE-037-on-sale-race-detail-page
```

Coder (5bib-fullstack-engineer) sẽ:
1. Đọc 00 + 01 + 02 (file này)
2. Verify MySQL SELECT grant via DESCRIBE test query
3. Implement backend (extend entity + new service method + new endpoint + tests) ~2.5h
4. Implement frontend (extend seo-api + page conditional + revert RaceCard + sitemap) ~1.5h
5. Smoke test F-036 listing localhost (regression check)
6. Output `03-coder-implementation.md` status `READY_FOR_QC` with test PASS output

Estimated total: ~4h dev + ~1.5h QC = **~5.5h end-to-end**.
