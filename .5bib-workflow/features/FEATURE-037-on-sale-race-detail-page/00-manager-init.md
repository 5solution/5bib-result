# FEATURE-037: On-Sale Race Detail Page (MySQL Platform Integration)

**Status:** 🟢 READY for `/5bib-prd` (Danny chốt 4 PAUSE Q + Manager verified MySQL schema 2026-05-18)
**Created:** 2026-05-16
**Owner:** Danny
**Type:** EXTEND_EXISTING (extend F-033 endpoint + F-036 frontend routes)
**Parent:** FEATURE-036 (in-flight, awaiting QC) + FEATURE-033 (deployed PROD)

---

## 🎯 Why this feature

F-036 ship listing `/giai-chay/` gộp được giải BÁN VÉ (MySQL platform) cùng giải vận hành (MongoDB) — 17 race BÁN VÉ visible. NHƯNG khi user click on-sale card → **thẳng external selling-web** → **MẤT TOÀN BỘ SEO juice** cho 17+ race BÁN VÉ.

Mục tiêu F-037: tạo internal detail page `/giai-chay/[urlName]` cho race BÁN VÉ với content rich (description, courses, organizer, hero image) → Google index thêm 17+ trang SEO → user search "Đăng ký Hai Phong Legacy Marathon 2026" land trên 5bib.com SEO page → click CTA → mua vé.

**Business value:** ~17 race × 6-8 unique keywords per race = ~100+ SERP opportunities mới.

---

## 📂 Impact Map (theo memory hiện tại + verify code)

### Module sẽ chạm

**Backend (`backend/src/modules/promo-hub/`)** — EXTEND F-033
- `entities/race-readonly.entity.ts` — **EXTEND**: thêm columns description, organizer details, image fields (cần Danny clarify columns nào available trong MySQL `races` table — xem PAUSE Q1)
- `dto/race-on-sale-detail.dto.ts` — **NEW**: full detail DTO (descriptive, distinct từ list-card DTO)
- `promo-hub.service.ts` — **EXTEND**: thêm method `findRaceOnSaleByUrlName(urlName)`
- `promo-hub.controller.ts` — **EXTEND**: thêm endpoint `GET /api/promo-hubs/races-on-sale/by-url-name/:urlName`
- `promo-hub.service.spec.ts` — **EXTEND**: thêm test cases

**Possibly NEW Backend (cần Danny clarify Q2 — Course list):**
- `entities/race-course-distance-readonly.entity.ts` — **NEW** nếu courses từ bảng riêng MySQL
- Hoặc embed course array trong RaceReadonly nếu MySQL có column JSON

**Frontend (`frontend/`)** — REVERT F-036 amendment + EXTEND
- `lib/seo-api.ts` — **EXTEND**: `getRaceBySlug()` fallback dual-source. Khi MongoDB miss → call F-037 endpoint by-url-name → return Race shape (status='pre_race', source='on-sale')
- `components/giai-chay/RaceCard.tsx` — **REVERT** branch: on-sale source giờ link internal `<Link>` thay vì external (Internal page render được rồi)
- `app/(main)/giai-chay/[raceSlug]/page.tsx` — **EXTEND**: handle dual source. Render placeholder cho missing fields (vd: courses optional, no results, no organizer fallback "5BIB")
- `app/sitemap-races.xml/route.ts` — **REVERT**: include on-sale slugs (F-036 đang skip — giờ có internal page → include)

### File then chốt cần đọc trước khi code
- `backend/src/modules/promo-hub/promo-hub.service.ts:findRacesOnSale()` — F-033 query builder pattern reuse
- `backend/src/modules/promo-hub/entities/race-readonly.entity.ts` — extend với new columns
- `backend/src/modules/promo-hub/dto/race-on-sale-response.dto.ts` — list DTO; detail DTO mới phải extend
- `frontend/lib/seo-api.ts:getRaceBySlug()` — point of fallback insertion
- `frontend/components/giai-chay/RaceCard.tsx` — revert on-sale branch
- `frontend/app/(main)/giai-chay/[raceSlug]/page.tsx` — handle missing fields gracefully

### Endpoint liên quan
- F-033 ĐÃ CÓ: `GET /api/promo-hubs/races-on-sale?limit=20&sort=...` — list with 12 fields per race
- F-037 MỚI: `GET /api/promo-hubs/races-on-sale/by-url-name/:urlName` — single race full detail

### Schema/DB
- **MySQL platform `races` table** — extend entity column mapping (cần Danny clarify available columns — PAUSE Q1)
- **MySQL platform `race_course_distances` (hoặc tương đương)** — nếu courses từ bảng riêng (PAUSE Q2)
- **MongoDB:** KHÔNG đụng
- **Redis:** thêm key `promo-hub:race-on-sale-detail:<urlName>` TTL 600s (reuse F-033 cache pattern)

---

## ⚠️ Risk Flags

### 🔴 [HIGH] MySQL schema unknown — cần Danny clarify

F-033 entity chỉ map 12 columns "safe" (verified column exist). Để render trang detail rich, cần thêm columns:
- `description` (or `event_description`) — race long-form content cho SEO
- `organizer_name` (or `tenant_name` via join)
- `cover_image` / `banner_image` (separate from logo_url)
- `race_type` / `category` (running/trail/marathon)
- `event_url` / `register_url` (selling-web URL nếu khác `5ticket.vn/event/<urlName>`)

**Risk:** column tên khác hoặc không tồn tại → entity load fail silent → null fields → trang detail render empty/broken.

**Mitigation:** Danny verify MySQL schema TRƯỚC khi BA viết PRD. Hoặc tao SSH lên PROD DB chạy `DESCRIBE 5bib_platform_live.races` → đọc actual schema (cần Danny grant access).

### 🔴 [HIGH] Course list source unclear

MongoDB race có `races.courses[]` embedded (RaceCourse type). MySQL platform → courses từ đâu?

**Possibilities:**
1. Bảng riêng `race_course_distances` join via raceId — most likely
2. JSON column trong `races` table
3. Không có — race BÁN VÉ không có courses, chỉ marketing card

**Mitigation:** PAUSE Q2 — Danny xác nhận bảng/cột nào hold course info cho race phase BÁN VÉ.

### 🟡 [MED] Dual-source getRaceBySlug() — race conditions

Frontend `getRaceBySlug(slug)` hiện gọi MongoDB endpoint. F-037 sửa thành: MongoDB miss → fallback MySQL on-sale.

**Edge case:** race CHUYỂN từ BÁN VÉ (MySQL) → VẬN HÀNH (MongoDB) — slug có thể trùng giữa 2 sources. Ưu tiên MongoDB (đầy đủ data, status `pre_race`/`live`/`ended`).

**Mitigation:** check MongoDB trước, KHÔNG fallback nếu MongoDB return draft.

### 🟡 [MED] Sitemap include 17+ on-sale slugs

F-036 đang skip on-sale từ sitemap (vì 404). F-037 include lại sau khi internal page work.

**Risk:** nếu F-037 chưa stable → Google crawl on-sale slug → 500 error → SEO penalty.

**Mitigation:** F-037 QC verify 100% on-sale slugs render thành công (not 500) trước khi merge sitemap change.

### 🟡 [MED] On-sale race KHÔNG có courses → JSON-LD SportsEvent thiếu

F-036 race detail page output JSON-LD SportsEvent (BR-25). Race BÁN VÉ thiếu `endDate`, có thể thiếu `location` precise, courses → JSON-LD optional fields chỉ render khi data có.

**Mitigation:** F-037 BA define minimal JSON-LD requirement cho on-sale (chấp nhận missing fields, không break schema).

### 🟢 [LOW] Sitemap CTR risk

On-sale race với content thiếu → Google rank thấp + bounce rate cao. KHÔNG block ship — sau khi index, monitor + iterate.

---

## ✅ Danny Decisions (2026-05-18 + Manager verified MySQL schema via DESCRIBE)

### Q1 — MySQL `races` table columns available for SEO content ✅
Manager connected MySQL 54.255.21.237:3306 (user `5bib_readonly_user`) — confirmed columns:

| Field cần cho SEO | MySQL column | Status |
|------------------|--------------|--------|
| Description | `races.description text` | ✅ Có |
| Organizer | `races.brand varchar(255)` | ✅ Có (F-033 đã map) |
| Cover image | `races.logo_url text` + `races.images text` (multi) | ✅ Có |
| Race type | `races.event_type varchar(255)` + `races.race_type varchar(64)` | ✅ Có (2 fields) |
| Event URL | N/A — build từ `url_name` (selling-web format) | N/A |
| Province/district | `races.province` + `races.district` + `races.ward` + `races.location_url text` | ✅ Có |
| Season | `races.season varchar(255)` | ✅ Bonus |
| Metadata | `races.metadata json` | ✅ Flexible field |

→ RaceReadonly entity F-033 cần EXTEND thêm: `description`, `images`, `event_type`, `race_type`, `district`, `season`, `location_url`. KHÔNG cần Danny grant thêm column SELECT (entity đã có quyền đọc bảng `races`).

### Q2 — Course list source ✅
> Danny: "Ở bảng `race_course`"

Manager verified MySQL `race_course` table — schema rich:
- `id`, `race_id` (FK to races), `prefix`, `name`, `distance`, `description`
- `price float`, `max_participate int`, `max_ticket_per_order`, `min/max_age`
- `open_for_sale_date_time`, `close_for_sale_date_time` (course-level reg window)
- `route_image_url`, `route_map_image_url`, `medal_url` (course map images!)
- `gain` (elevation), `course_type`, `wave` text, `add_ons json`

→ NEW `RaceCourseReadonly` TypeORM entity required. Join via `race_id`. Plenty SEO content per course.

### Q3 — CTA URL format ✅
> Danny: "5bib.com/vi/events"

→ Reuse F-036 BR-12 format `buildSellingWebUrl(urlName, raceId)`:
```
https://5bib.com/vi/events/{urlName}_{raceId}?ref=seo-giai-chay&utm_source=organic&utm_medium=seo&utm_campaign=giai-chay
```
KHÔNG dùng `5ticket.vn/event/<urlName>` (F-033 ticketUrl deprecated cho SEO page CTA).

### Q4 — Cron behavior (RE-SCOPED) ⚠️

> Danny: "làm nào update đc các giải mà có kết quả thì đổi trạng thái trang và với giải bán mới thì hiển thị là đc"

**Re-interpreted:** Danny KHÔNG yêu cầu cron riêng cho slug. Yêu cầu thực sự là:
1. **Race transition BÁN VÉ → VẬN HÀNH:** khi race chuyển từ MySQL (status=GENERATED_CODE) sang MongoDB (có kết quả) → page tự đổi trạng thái
2. **Race BÁN VÉ mới:** khi MySQL có race mới với status=GENERATED_CODE → tự hiển thị trên listing + tạo trang detail

**Manager Solution (no new cron needed — leverage F-036 infrastructure):**

| Scenario | Mechanism | Latency |
|----------|-----------|---------|
| New on-sale race in MySQL | F-036 listing ISR `revalidate: 3600` auto re-fetches `getAllRaces()` mỗi giờ → on-sale race appear | ≤1h |
| Race transition (BÁN VÉ → VẬN HÀNH) | F-036 `getAllRaces()` dedupe by title — MongoDB version takes precedence → page state đổi tự động | ≤1h (next ISR tick) |
| Race result published | F-036 cron weekly slug sync handles MongoDB races đã có result + slug backfill | ≤7 days (cron) hoặc admin manual trigger /admin/seo |
| URGENT update (race admin tạo MongoDB) | Manual trigger `/admin/seo` → `/api/admin/seo/sync-slugs` → revalidate webhook | Immediate |

**Conclusion:** F-037 KHÔNG cần cron mới. Reuse F-036 cron + ISR. Race transitions auto-detected via dedup logic. Mức delay 1h chấp nhận được (race transition không phải real-time).

Manager đề xuất bổ sung: trigger ISR revalidate khi admin tạo race mới trong MongoDB (F-036 đã có webhook `revalidate-giai-chay` — F-037 chỉ cần extend trigger condition).

---

## 🚧 PAUSE Conditions for BA (now reduced to implementation details)

> Manager block `/5bib-prd` cho đến khi Danny trả lời. Lý do: schema MySQL platform DB không thuộc memory của repo này.

- [x] ~~Q1-Q4 closed by Danny + Manager schema verification 2026-05-18~~

**Remaining minor decisions (BA decide trong PRD draft):**
- [ ] **BA-Q1:** Detail page sections order — Hero (banner + title + countdown) → Description → Courses → CTA → Location? Hoặc CTA top + description below?
- [ ] **BA-Q2:** Hiển thị `race_course.price` trên detail page không? Nếu yes thì format VND có comma? Hay chỉ "Từ X VND" lowest tier?
- [ ] **BA-Q3:** `race_course.route_image_url` + `route_map_image_url` — render cả 2 hay 1 (route image only)?
- [ ] **BA-Q4:** Sitemap include on-sale slugs với priority bao nhiêu (currently F-036 set 0.9 cho active, 0.6 cho ended — on-sale là active type)?

---

## 🎯 Success criteria (gợi ý cho BA)

- 17+ on-sale race có internal detail page `/giai-chay/[urlName]` render thành công (KHÔNG 404, KHÔNG 500)
- Mỗi page có ≥3 SEO elements: H1 title, description ≥100 words, hero image, CTA selling-web
- JSON-LD SportsEvent render với at least: name, startDate, location, organizer, offers (status='InStock')
- Sitemap include 17+ on-sale slugs với priority 0.9 (active race priority)
- F-036 RaceCard branch revert: on-sale source giờ internal `<Link>` (không còn external)
- Performance: p95 < 800ms cho detail page (ISR hit < 200ms)
- 0 form mua vé inline (F-036 BR-10 carry over)

---

## ✅ Sẵn sàng cho `/5bib-prd`?

✅ **YES** — 4 PAUSE Q closed, MySQL schema verified, no architectural blockers.

BA có 4 minor decisions còn lại nhưng KHÔNG block PRD writing — BA propose default → Danny review trong /5bib-plan.

---

## 📋 Updated Scope Summary (post-clarification)

### Backend changes
- ✏️ EXTEND `backend/src/modules/promo-hub/entities/race-readonly.entity.ts` — add 7 columns: `description`, `images`, `event_type`, `race_type`, `district`, `season`, `location_url`
- ➕ NEW `backend/src/modules/promo-hub/entities/race-course-readonly.entity.ts` — map `race_course` table 17 columns
- ✏️ Register new entity in `app.module.ts` `forRoot({name: 'platform'})` + `promo-hub.module.ts` `forFeature`
- ➕ NEW endpoint `GET /api/promo-hubs/races-on-sale/by-url-name/:urlName` — full race + courses detail
- ➕ NEW DTO `RaceOnSaleDetailDto` + `RaceCourseDto`
- ✏️ EXTEND `promo-hub.service.ts` — `findRaceOnSaleByUrlName()` method with JOIN query
- ➕ Unit tests for new service method

### Frontend changes
- ✏️ EXTEND `frontend/lib/seo-api.ts` — `getRaceBySlug()` dual-source fallback (MongoDB miss → MySQL on-sale)
- ✏️ EXTEND `frontend/app/(main)/giai-chay/[raceSlug]/page.tsx` — handle on-sale source render (description from MySQL, courses from race_course table)
- ✏️ REVERT `frontend/components/giai-chay/RaceCard.tsx` — on-sale source now internal `<Link>` (previously external)
- ✏️ EXTEND `frontend/app/sitemap-races.xml/route.ts` — include on-sale slugs (currently skipped)
- ➕ NEW component `OnSaleRaceLanding.tsx` (or reuse race detail with conditional render)

### NO new cron / Redis key
- Reuse F-036 ISR 1h auto-refresh for listing + sitemap
- Reuse F-036 `cron:seo-slug-sync:lock` infrastructure (no impact on F-037)
- Add Redis cache key `promo-hub:race-on-sale-detail:<urlName>` TTL 600s

### Effort estimate
- Backend: ~2.5h (entity extend + new endpoint + DTO + tests)
- Frontend: ~1.5h (lib helper + page handle dual source + sitemap)
- **Total ~4h dev + ~1.5h QC = ~5.5h**

---

## 🔗 Next step

Danny chạy: `/5bib-prd FEATURE-037-on-sale-race-detail-page`

BA viết `01-ba-prd.md` với 4 BA-Q defaults + 13 BR numbered (BR-37-01..13 covering schema map, ISR strategy, dual-source fallback, sitemap inclusion, CTA reuse F-036 helper).

---

## 🔄 Dependency trên F-036

- **Block deploy:** F-037 KHÔNG được deploy PROD trước F-036 (vì F-036 ship listing logic mà F-037 dựa trên).
- **Có thể dev song song:** BA + Manager plan F-037 trong khi F-036 đang QC. Coder F-037 có thể bắt đầu BE extension trước khi F-036 deploy (BE work isolated từ F-036 frontend).
- **Sync conflict risk:** F-036 amend file `frontend/components/giai-chay/RaceCard.tsx` + `lib/seo-api.ts` + `sitemap-races.xml/route.ts` — F-037 cần REVERT/EXTEND các file này. Coder MUST rebase sau F-036 deploy.

---

## 🔗 Next step

Danny trả lời 4 PAUSE Q → Manager update file này thành 🟢 READY → `/5bib-prd FEATURE-037-on-sale-race-detail-page`.

**Trong khi đợi:** Danny có thể chạy `/5bib-qc FEATURE-036` song song để move F-036 forward.
