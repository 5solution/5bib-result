# FEATURE-037: PRD — On-Sale Race Detail Page (MySQL Platform Integration)

**Status:** 🔵 READY
**Created:** 2026-05-18
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md` (status 🟢 READY 2026-05-18, MySQL schema verified)
**Parent feature:** F-036 SEO subdirectory (deployed PR #6 + release/v1.8.7)

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` toàn bộ — 4 Q closed, MySQL schema verified by Manager via DESCRIBE
- [x] Đã đọc F-036 artifacts (00-05) — dependency cho dual-source extension
- [x] Đã đọc F-033 promo-hub module — `RaceReadonly` entity pattern + service `findRacesOnSale` query
- [x] Đã đọc memory `codebase-map.md` cho promo-hub + giai-chay modules
- [x] Đã đọc memory `known-issues.md` — TD-F036-09 HIGH (on-sale internal detail deferred → resolved by F-037)

---

## 📝 On-Sale Race Internal SEO Detail Page

**Goal:** Tạo internal SEO detail page `/giai-chay/[urlName]` cho race phase **BÁN VÉ** (~17 race MySQL platform với `status=GENERATED_CODE`) để chiếm SEO juice + dẫn user về selling-web `5bib.com/vi/events/...` qua conversion CTA. Resolve TD-F036-09 — fix lỗ hổng SEO mà F-036 listing đang để race BÁN VÉ click → external selling-web trực tiếp.

**Scope:**

✅ **In scope:**
- Backend: extend `RaceReadonly` entity (+7 cols), NEW `RaceCourseReadonly` entity, NEW endpoint `GET /api/promo-hubs/races-on-sale/by-url-name/:urlName` với JOIN race + race_course
- Frontend: dual-source `getRaceBySlug()` fallback (MongoDB miss → MySQL on-sale), extend `/giai-chay/[raceSlug]/page.tsx` handle on-sale source, REVERT `RaceCard` on-sale branch (giờ internal link), sitemap include on-sale slugs
- ISR strategy: reuse F-036 1h listing revalidate auto-detect transitions (BÁN VÉ → VẬN HÀNH) + manual admin trigger via existing `/admin/seo`
- CTA "Đăng ký ngay" → selling-web (BR-12 format từ F-036)
- JSON-LD SportsEvent + BreadcrumbList for on-sale races
- ~17 trang SEO mới indexed → +100 SERP opportunities

❌ **Out of scope:**
- KHÔNG tạo cron riêng cho on-sale (reuse F-036 + ISR)
- KHÔNG xử lý form mua vé / payment inline (Danny mandate BR-10 từ F-036, carry-over)
- KHÔNG đổi F-036 logic listing (chỉ thay đổi RaceCard branch on-sale)
- KHÔNG đụng F-033 promo-hub `findRacesOnSale` listing endpoint
- KHÔNG sửa MongoDB `races` collection
- KHÔNG support race transition workflow trong admin UI (chỉ ISR auto-detect)

---

## 👤 User Stories & Business Rules

### User Stories

> Format: As a [Persona], I want [Action] so that [Benefit].

- As an **Anonymous Visitor** Google search "Đăng ký Hai Phong Marathon 2026", I want to land on `5bib.com/giai-chay/175` with race description, courses, organizer, registration window so that I can decide to register without leaving 5bib domain.
- As an **Anonymous Visitor** browsing `/giai-chay/` listing and clicking an on-sale race card, I want to navigate to internal detail page (NOT external selling-web direct) so that I see rich SEO content before committing to buy.
- As an **Anonymous Visitor** on on-sale race detail page, I want a clear "Đăng ký ngay" CTA that takes me to selling-web with proper UTM tracking so that buy flow continues seamlessly.
- As a **Race Organizer (merchant)**, I want my BÁN VÉ race to auto-appear with full SEO content within ≤1h of creation in MySQL so that I get free SEO exposure without manual admin work.
- As a **Race Organizer**, I want page state to auto-transition from BÁN VÉ → VẬN HÀNH within ≤1h when admin creates MongoDB race record (after race finishes registration) so that returning visitors see latest state.
- As a **5BIB Back-Office Admin**, I want to manually trigger immediate ISR refresh via existing `/admin/seo` button so that I can force-update without waiting for cron.
- As a **Google Crawler**, I want to fetch `https://5bib.com/sitemap-races.xml` with 17+ on-sale slugs included with priority 0.9 so that I prioritize indexing fresh content.

### Business Rules

#### Data source & schema

- **BR-37-01:** Race BÁN VÉ source = MySQL `5bib_platform_live.races` table with `status=GENERATED_CODE` filter (per F-033 BR-PH33-02). Query via TypeORM named connection `'platform'`.
- **BR-37-02:** RaceReadonly entity extend (current 12 cols → 19 cols) với new cols mapped read-only:
  ```
  description text, images text, event_type varchar(255), race_type varchar(64),
  district varchar(128), season varchar(255), location_url text
  ```
- **BR-37-03:** NEW `RaceCourseReadonly` entity maps MySQL `race_course` table. Fields selected (16 cols, exclude `wave` text + `add_ons json` + admin internal):
  ```
  id, race_id, prefix, name, distance, description, price float, max_participate,
  min_age, max_age, open_for_sale_date_time, close_for_sale_date_time,
  route_image_url, route_map_image_url, medal_url, course_type, gain
  ```
- **BR-37-04:** Course list filter `deleted = 0` (bit field). Use TypeORM `CAST(deleted AS UNSIGNED) = 0` per F-033 known pattern bit type handling.
- **BR-37-05:** Endpoint MUST return race + courses in single response (no N+1 query). JOIN at query time via `LEFT JOIN race_course ON race_course.race_id = races.race_id`.

#### Dual-source resolution

- **BR-37-06:** `getRaceBySlug(slug)` fallback chain:
  1. Try MongoDB via `GET /api/races/slug/:slug` (F-036 existing)
  2. If 404 OR race.status=draft → try MySQL via `GET /api/promo-hubs/races-on-sale/by-url-name/:urlName`
  3. If both miss → frontend `notFound()` (HTTP 404 + noindex meta)
- **BR-37-07:** When race exists in BOTH sources (race transition mid-flight), MongoDB takes precedence — return MongoDB shape. MySQL skipped. Prevents flicker/duplicate.
- **BR-37-08:** On-sale race returned from MySQL MUST set `source: 'on-sale'` + `status: 'pre_race'` for frontend uniform render logic.

#### CTA behavior

- **BR-37-09:** Detail page primary CTA "Đăng ký ngay" link = `buildSellingWebUrl(urlName, raceId)` from F-036 helper:
  ```
  https://5bib.com/vi/events/{urlName}_{raceId}?ref=seo-giai-chay&utm_source=organic&utm_medium=seo&utm_campaign=giai-chay
  ```
- **BR-37-10:** ZERO inline `<form>` xử lý mua vé / payment / cart on detail page (carry-over F-036 BR-10). All CTAs MUST `<a href>` external, NOT `<button onClick>`.
- **BR-37-11:** If race has `close_for_sale_date_time < now()` (registration window closed) → render CTA disabled state "Đã hết hạn đăng ký" + tooltip + still link external selling-web (some races allow late buy). Status badge changes "Đang bán" → "Hết hạn đăng ký".

#### Sitemap & SEO

- **BR-37-12:** F-036 sitemap-races.xml MUST include on-sale slugs. REVERT line 53-55 skip filter. New entries:
  - `loc`: `https://5bib.com/giai-chay/{urlName}`
  - `lastmod`: `event_start_date` OR `registration_start_time` OR `now()` (newest)
  - `changefreq`: `daily`
  - `priority`: `0.9` (active type, same as MongoDB pre_race/live)
- **BR-37-13:** Self-canonical metadata `<link rel="canonical" href="https://5bib.com/giai-chay/{urlName}" />` (reuse F-036 BR-14 pattern).
- **BR-37-14:** noindex meta when accessed via `result.5bib.com` direct (reuse F-036 BR-15 layout-level host check).
- **BR-37-15:** JSON-LD SportsEvent with `offers.priceCurrency: VND` + `offers.url: <selling-web>` + `offers.availability: https://schema.org/InStock` (or `SoldOut` if registration closed) + `eventStatus: EventScheduled`.
- **BR-37-16:** JSON-LD BreadcrumbList: Trang chủ → Giải chạy → [City nếu province khớp] → Race title.

#### ISR & cache

- **BR-37-17:** `/giai-chay/[raceSlug]` page on-sale source ISR `revalidate: 3600` (1h, match F-036 pre_race race).
- **BR-37-18:** Redis cache key `promo-hub:race-on-sale-detail:<urlName>` TTL 600s (10 min, server-side cache layer). Pattern matches F-033 `promo-hub:races-on-sale:*`.
- **BR-37-19:** Cache invalidation: NONE (TTL-only, on-sale race lifecycle external-controlled — KHÔNG có admin mutation trên 5BIB Result side).
- **BR-37-20:** Race transition BÁN VÉ → VẬN HÀNH auto-detect: F-036 listing `getAllRaces()` ISR 1h + dedup by title → on-sale entry disappears from listing within 1h, internal detail page falls through to MongoDB version.

#### Performance

- **BR-37-21:** Endpoint `GET /api/promo-hubs/races-on-sale/by-url-name/:urlName` p95 < 300ms (cold) / < 50ms (Redis cache hit). 10x stability test for race-day scenarios.
- **BR-37-22:** Page render p95 < 800ms cold + ISR cache layer reduces to < 200ms warm.

#### Edge cases

- **BR-37-23:** Race exists MySQL nhưng `is_show = 0` (bit field) → backend returns 404 (treat as not exists, same as `deleted=1`).
- **BR-37-24:** Race in MySQL nhưng `url_name = null` (TD-F033-06 PROD shows 19/19 active races NULL) → fallback raceId as slug, page reachable via `/giai-chay/175` (numeric).
- **BR-37-25:** Course array empty (race no longer has courses) → render section "Chi tiết cự ly cập nhật sớm" placeholder + no JSON-LD `offers` field.

---

## 🖥️ UI/UX Flow — Step-by-step Step-by-Step

### Route structure

| Route | Page type | Access |
|-------|-----------|--------|
| `/giai-chay/[raceSlug]` (existing F-036 page, EXTENDED for on-sale) | Server Component, ISR 3600s | Public |
| `/giai-chay/[raceSlug]/ket-qua` (no changes) | Server Component, ISR | Public — 404 cho on-sale race (no results yet) |

### Screen: `/giai-chay/[urlName]` — On-Sale Race Detail Page

**Title tag template:**
- Active reg: `Đăng ký {race.title} {year} — Mua BIB giải chạy {province} | 5BIB`
- Reg closed: `{race.title} {year} — Lịch giải chạy {province} | 5BIB`

**Description meta:** `{race.description first 160 chars}` OR fallback `{race.title} tại {race.location ?? race.province ?? 'Việt Nam'} — Đăng ký, mua BIB, xem chi tiết cự ly trên 5BIB.`

#### Layout description

**Header zone:**
- Breadcrumb: Trang chủ › Giải chạy › [City] › {race.title}
- H1: `{race.title}` (Be Vietnam Pro 900, 4xl on mobile / 5xl desktop)
- Status badge:
  - "Đang bán vé" green `bg-green-100 text-green-700` if `now() < close_for_sale_date_time`
  - "Hết hạn đăng ký" stone `bg-stone-200 text-stone-700` if registration window closed

**Hero zone (2-col on desktop, stack on mobile):**
- Left col (col-span-2): Banner image `race.logo_url` 16:9 aspect ratio
- Right col (col-span-1): Sidebar with race meta:
  - 📅 Date: `event_start_date` (formatted `dd/MM/yyyy`)
  - 📍 Location: `race.location || race.province || race.district`
  - 🏃 Type: `race.race_type || race.event_type` (formatted)
  - 🏢 Tổ chức: `race.brand` (organizer)
  - ⏰ Đăng ký đến: `close_for_sale_date_time` (formatted)
  - Countdown timer (Client Component) until `event_start_date`

**CTA zone:**
- Primary button "Đăng ký ngay →" (blue, large) → external selling-web (BR-37-09)
- Secondary button "Xem tất cả giải" → `/giai-chay/` (ghost outline)

**Description zone:**
- H2: "Giới thiệu"
- Sanitized HTML `race.description` (whitespace preserved, allowlist tags p/strong/em/ul/ol/li/br)

**Courses zone:**
- H2: "Cự ly thi đấu"
- Grid 2-col responsive (1-col mobile) — each course card:
  - Course name (H3): `race_course.name` (e.g. "Marathon 42KM")
  - Distance pill: `race_course.distance` (font-mono)
  - Description: `race_course.description` (text-sm)
  - Price (if not null): `race_course.price` formatted VND (`Intl.NumberFormat('vi-VN', {style: 'currency', currency: 'VND'})`)
  - Capacity: `Tối đa {max_participate} VĐV` (if not null)
  - Age range: `Độ tuổi {min_age}-{max_age}` (if both set)
  - Elevation gain: `🏔 {gain}` (if not null)
  - Route image: `race_course.route_image_url` (lazy load, click → lightbox)
  - Map image: `race_course.route_map_image_url` (lazy load)
  - Reg window: `Mở: {open_for_sale_date_time} - Đóng: {close_for_sale_date_time}`

**Sidebar zone (desktop only, lg:col-span-1):**
- "Giải tương tự" — 3 similar races (same province OR same race_type) — Internal `<Link>` to other `/giai-chay/[slug]`
- Mini share buttons (NOT mua vé) — Facebook/Twitter share URLs (NOT inline form)

**Footer zone:**
- Repeat primary CTA "Đăng ký ngay →"
- "Quay lại danh sách giải" link → `/giai-chay/`

#### UI Step-by-step table

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | User search Google "Đăng ký Hai Phong Marathon 2026" → click result | Land on `5bib.com/giai-chay/175` (Vercel rewrite serves from result.5bib.com) | External → 5bib.com domain | Server-render detail page with on-sale data |
| 2 | Page server-renders | Hero + breadcrumb + status badge "Đang bán vé" green | SSR fetch dual-source: MongoDB 404 → MySQL hit `byUrlName('175')` returns race + courses JOIN | DOM ready, JSON-LD scripts inject |
| 3 | User scrolls description section | Read race intro, courses list grid | Static render | No state change |
| 4 | User clicks course card image | Lightbox opens route map | Client `'use client'` onClick lightbox component | Modal visible |
| 5 | User clicks "Đăng ký ngay →" | Navigate full URL to `5bib.com/vi/events/175_175?ref=seo-giai-chay&utm_source=organic&utm_medium=seo&utm_campaign=giai-chay` | `<a href={buildSellingWebUrl(...)} target="_self">` | Browser navigates to selling-web (5BIB Result session ends) |
| 6 | If race registration closed (`close_for_sale_date_time < now()`) | Status badge "Hết hạn đăng ký" stone, CTA disabled visual + tooltip "Đã quá hạn đăng ký nhưng vẫn liên hệ BTC" | Conditional render server-side | User can still click (still navigate to selling-web, late buy possible) |
| 7 | Race transition admin imports MongoDB | Within ≤1h next ISR tick, `getRaceBySlug(slug)` returns MongoDB version (race transitioned to VẬN HÀNH) | F-036 ISR + dual-source fallback dedup | Page now serves MongoDB race detail (full flow with `/ket-qua` available) |

#### Buttons Specification Table

| Button label | Position | Default state | Disabled state | Loading state | Action | Confirm dialog? |
|--------------|----------|---------------|----------------|---------------|--------|-----------------|
| "Đăng ký ngay →" | Hero CTA + Footer repeat | Primary blue large | Stone-300 + tooltip "Hết hạn đăng ký" khi `close_for_sale_date_time < now()` | N/A (external navigation) | `<a href={buildSellingWebUrl(urlName, raceId)}>` | NO |
| "Xem tất cả giải" | Hero CTA secondary + Footer | Ghost outline | N/A | N/A | `<Link href="/giai-chay">` internal | NO |
| Course image card | Course grid | Cursor pointer + hover | N/A | N/A | onClick → lightbox modal (Client Component) | NO |
| "Share Facebook" | Sidebar | Icon button blue | N/A | N/A | `<a href="https://www.facebook.com/sharer/sharer.php?u={current}">` | NO |
| "Share Twitter" | Sidebar | Icon button cyan | N/A | N/A | `<a href="https://twitter.com/intent/tweet?url={current}&text={title}">` | NO |

⚠️ ZERO `<form>` purchase. ZERO `<button onClick>` mua vé. ALL CTAs `<a href>` external.

#### Form Fields Specification Table

**NOT APPLICABLE** — On-sale detail page is **read-only SEO discovery layer**. No form fields. All registration/payment handled on selling-web (external endpoint). This is BR-10/11 invariant carry-over from F-036 (Danny mandate).

#### Field source table

| Field UI label | Data source | Format hiển thị | Empty state |
|----------------|-------------|-----------------|-------------|
| H1 title | `race.title` (MySQL races) | text | "(Đang cập nhật)" — should never empty due to BR-37-22 |
| Banner image | `race.logo_url` (MySQL races) | `<img src>` with priority loading | Gray placeholder 16:9 |
| Date | `race.event_start_date` | `dd/MM/yyyy` vi-VN | "Sắp công bố" |
| Location | `race.location ?? race.province ?? race.district` | text | "Việt Nam" fallback |
| Description | `race.description` | sanitized HTML (allowlist p/strong/em/ul/ol/li/br) | (Section hidden if empty) |
| Organizer | `race.brand` | text | (Field hidden if empty) |
| Race type | `race.race_type ?? race.event_type` | mapped VN label (e.g. TRAIL → "Đường mòn") | (Section hidden if empty) |
| Season | `race.season` | text | (Hidden if empty) |
| Registration close | `race.registration_end_time` | `dd/MM/yyyy HH:mm` vi-VN | (Hidden) |
| Course name | `race_course.name` | text | "(Đang cập nhật)" |
| Course distance | `race_course.distance` | font-mono pill | (Field hidden if empty) |
| Course price | `race_course.price` | `Intl.NumberFormat('vi-VN', {style:'currency',currency:'VND'})` | "Liên hệ" fallback if null |
| Course capacity | `race_course.max_participate` | text VN: "Tối đa N VĐV" | (Hidden) |
| Course route image | `race_course.route_image_url` | lazy `<img>` 16:9 lightbox | (Hidden if null) |
| Course map | `race_course.route_map_image_url` | lazy `<img>` 16:9 lightbox | (Hidden if null) |
| Course elevation | `race_course.gain` | "🏔 {gain}" | (Hidden) |
| Course age range | `race_course.min_age`-`max_age` | "Tuổi {min}-{max}" | (Hidden if either null) |
| CTA URL | `buildSellingWebUrl(urlName, raceId)` from F-036 helper | external link | N/A (always present) |

#### UI States — ĐỦ trạng thái

- **Loading (SSR initial fetch):** N/A — Server Component, page renders complete OR 404. No client-side loading state for initial render.
- **Empty (no on-sale race for urlName):** Next.js `notFound()` → 404 page (reuse F-036 `[raceSlug]/not-found.tsx`)
- **Data loaded — Active registration:** Full layout, green "Đang bán vé" badge, primary CTA enabled
- **Data loaded — Registration closed:** Stone "Hết hạn đăng ký" badge, CTA disabled visual (still link external for late buy)
- **Description empty:** Section hidden (no "Empty description" placeholder — clean SEO)
- **Courses empty:** Render placeholder "Chi tiết cự ly cập nhật sớm" message
- **Error fetch (MySQL down):** Backend service returns 503 → frontend `notFound()` (treat as not exists, no 5xx leak to user)
- **Race transition (BÁN VÉ → VẬN HÀNH within 1h):** Next ISR tick auto-switches to MongoDB source — user sees fresh state
- **Server-side image fetch fail (logo_url 404):** Gray placeholder rendered, no broken image icon

---

## 🛠️ Technical Mandates (For Coder Agent)

### DB Changes

**MySQL platform `5bib_platform_live` (read-only):**

- `races` table: EXTEND TypeORM entity to map 7 additional cols. NO DDL change (table has all needed cols already, per Manager DESCRIBE verification 2026-05-18):
  ```typescript
  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  images: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 255, nullable: true })
  eventType: string | null;

  @Column({ name: 'race_type', type: 'varchar', length: 64, nullable: true })
  raceType: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  district: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  season: string | null;

  @Column({ name: 'location_url', type: 'text', nullable: true })
  locationUrl: string | null;
  ```

- `race_course` table: NEW TypeORM entity (16 cols). NO DDL change.
  ```typescript
  @Entity('race_course')
  export class RaceCourseReadonly {
    @PrimaryColumn({ type: 'bigint' })
    id: string;

    @Column({ name: 'race_id', type: 'bigint' })
    raceId: string;

    @Column({ type: 'varchar', length: 6 })
    prefix: string;

    @Column({ type: 'varchar', length: 255, nullable: true })
    name: string | null;

    @Column({ type: 'varchar', length: 32, nullable: true })
    distance: string | null;

    @Column({ type: 'text', nullable: true })
    description: string | null;

    @Column({ type: 'float', nullable: true })
    price: number | null;

    @Column({ name: 'max_participate', type: 'int', nullable: true })
    maxParticipate: number | null;

    @Column({ name: 'min_age', type: 'tinyint', nullable: true })
    minAge: number | null;

    @Column({ name: 'max_age', type: 'tinyint', nullable: true })
    maxAge: number | null;

    @Column({ name: 'open_for_sale_date_time', type: 'datetime', nullable: true })
    openForSaleDateTime: Date | null;

    @Column({ name: 'close_for_sale_date_time', type: 'datetime', nullable: true })
    closeForSaleDateTime: Date | null;

    @Column({ name: 'route_image_url', type: 'text', nullable: true })
    routeImageUrl: string | null;

    @Column({ name: 'route_map_image_url', type: 'text', nullable: true })
    routeMapImageUrl: string | null;

    @Column({ name: 'medal_url', type: 'text', nullable: true })
    medalUrl: string | null;

    @Column({ name: 'course_type', type: 'varchar', length: 16, nullable: true })
    courseType: string | null;

    @Column({ type: 'varchar', length: 255, nullable: true })
    gain: string | null;

    // Bit field — filter via CAST(deleted AS UNSIGNED) in QueryBuilder
    @Column({ type: 'bit', width: 1, default: () => "b'0'", select: false })
    deleted: Buffer;
  }
  ```

**MongoDB:** NO CHANGES.

**Redis:** New cache key `promo-hub:race-on-sale-detail:<urlName>` TTL 600s.

**S3:** NO CHANGES.

🛑 **PAUSE before:**
- TypeORM entity register changes — Manager `/5bib-plan` review required (NOT a migration but production-touching entity wiring)
- Verify MySQL `5bib_readonly_user` SELECT grant covers `race_course` table — if grant missing, Danny coordinate DB admin

### Redis Cache

- Key: `promo-hub:race-on-sale-detail:<urlName>`
- TTL: 600s (10 min)
- Invalidate: TTL-only (no admin mutation in 5BIB Result side affects MySQL race lifecycle)

### Backend Endpoint Specification

#### Endpoint NEW: `GET /api/promo-hubs/races-on-sale/by-url-name/:urlName`

| Element | Spec |
|---------|------|
| Method | GET |
| Path | `/api/promo-hubs/races-on-sale/by-url-name/:urlName` |
| Auth | Public (no JwtAuthGuard — same as `/races-on-sale` listing F-033) |
| Path param | `urlName: string` — race url_name OR raceId fallback (numeric if NULL url_name) |
| Response DTO | `RaceOnSaleDetailDto` (see §DTO Spec) |
| Status codes | 200 found / 404 not found OR is_show=false OR is_delete=true / 503 MySQL connection error (rare) |
| Cache | Redis 600s + Next.js ISR 3600s |
| Performance SLA | p95 < 300ms cold / < 50ms cache hit |
| Side effects | NONE (read-only endpoint) |

#### DTO Field-Level Spec

```typescript
// backend/src/modules/promo-hub/dto/race-on-sale-detail.dto.ts

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RaceCourseDto {
  @ApiProperty({ description: 'Course ID (bigint as string)' })
  id!: string;

  @ApiProperty({ description: 'Course display prefix (e.g. "M42K")' })
  prefix!: string;

  @ApiPropertyOptional({ description: 'Course name VN' })
  name?: string | null;

  @ApiPropertyOptional({ description: 'Distance label (e.g. "42KM")' })
  distance?: string | null;

  @ApiPropertyOptional({ description: 'Course description (sanitized HTML)' })
  description?: string | null;

  @ApiPropertyOptional({ description: 'Price in VND', minimum: 0 })
  price?: number | null;

  @ApiPropertyOptional({ description: 'Max participants', minimum: 0 })
  maxParticipate?: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 120 })
  minAge?: number | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 120 })
  maxAge?: number | null;

  @ApiPropertyOptional({ description: 'Registration window open' })
  openForSaleDateTime?: Date | null;

  @ApiPropertyOptional({ description: 'Registration window close' })
  closeForSaleDateTime?: Date | null;

  @ApiPropertyOptional({ description: 'Course route image URL (S3 public)' })
  routeImageUrl?: string | null;

  @ApiPropertyOptional({ description: 'Course map image URL (S3 public)' })
  routeMapImageUrl?: string | null;

  @ApiPropertyOptional({ description: 'Medal image URL' })
  medalUrl?: string | null;

  @ApiPropertyOptional({ description: 'Elevation gain e.g. "1500m+"' })
  gain?: string | null;

  @ApiPropertyOptional({ description: 'Course type', enum: ['ORDINARY', 'VIRTUAL', 'CHARITY'] })
  courseType?: string | null;
}

export class RaceOnSaleDetailDto {
  @ApiProperty({ description: 'race_id (bigint as string)' })
  raceId!: string;

  @ApiProperty({ description: 'Race title' })
  title!: string;

  @ApiProperty({ description: 'URL slug (url_name OR fallback raceId)' })
  urlName!: string;

  @ApiPropertyOptional({ description: 'Race long-form description (sanitized)' })
  description?: string | null;

  @ApiPropertyOptional({ description: 'Logo / banner image URL' })
  logoUrl?: string | null;

  @ApiPropertyOptional({ description: 'Additional images CSV or JSON' })
  images?: string | null;

  @ApiPropertyOptional()
  eventStartDate?: Date | null;

  @ApiPropertyOptional()
  eventEndDate?: Date | null;

  @ApiPropertyOptional()
  registrationStartTime?: Date | null;

  @ApiPropertyOptional()
  registrationEndTime?: Date | null;

  @ApiPropertyOptional({ description: 'Race location (text)' })
  location?: string | null;

  @ApiPropertyOptional()
  province?: string | null;

  @ApiPropertyOptional()
  district?: string | null;

  @ApiPropertyOptional({ description: 'Google Maps URL' })
  locationUrl?: string | null;

  @ApiPropertyOptional({ description: 'Organizer brand name' })
  brand?: string | null;

  @ApiPropertyOptional({ description: 'event_type field (e.g. "RUNNING")' })
  eventType?: string | null;

  @ApiPropertyOptional({ description: 'race_type field (e.g. "MARATHON", "TRAIL")' })
  raceType?: string | null;

  @ApiPropertyOptional()
  season?: string | null;

  @ApiProperty({
    description: 'Pre-built selling-web URL with UTM tracking (BR-37-09 format)',
    example: 'https://5bib.com/vi/events/175_175?ref=seo-giai-chay&utm_source=organic&utm_medium=seo&utm_campaign=giai-chay',
  })
  sellingWebUrl!: string;

  @ApiProperty({ type: [RaceCourseDto], description: 'Course list filtered deleted=false' })
  courses!: RaceCourseDto[];

  @ApiProperty({ description: 'Source marker for frontend dual-source logic', enum: ['on-sale'] })
  source!: 'on-sale';
}
```

### Frontend / Admin (Next.js)

#### Files to MODIFY (revert F-036 changes + extend)

- ✏️ `frontend/lib/seo-api.ts`:
  - Extend `getRaceBySlug()` to fallback to MySQL via new endpoint when MongoDB returns null
  - Add `getRaceOnSaleByUrlName(urlName)` helper (TypeScript shape matches `RaceOnSaleDetailDto`)
  - `getAllRaces()` no changes (already merges 2 sources)

- ✏️ `frontend/app/(main)/giai-chay/[raceSlug]/page.tsx`:
  - Add conditional rendering for `race.source === 'on-sale'` branch
  - For on-sale source, render courses from `race.courses` array (RaceCourseDto shape)
  - Conditional CTA — use `race.sellingWebUrl` (pre-built from backend) for on-sale
  - Disable CTA visual if `now() > registration_end_time` OR all course `close_for_sale_date_time < now()`

- ✏️ `frontend/components/giai-chay/RaceCard.tsx`:
  - REVERT on-sale branch (currently external `<a href>`)
  - On-sale source → internal `<Link href="/giai-chay/{urlName}">` (now that detail page exists)

- ✏️ `frontend/app/sitemap-races.xml/route.ts`:
  - REMOVE line 53-55 skip filter for on-sale (`if (race.source === 'on-sale') continue`)
  - Add on-sale entries with priority 0.9, changefreq daily, lastmod fallback chain

#### Files to ADD

- ➕ `frontend/components/giai-chay/CourseCard.tsx` — Server Component for course detail rendering (used in on-sale detail page courses grid)
- ➕ `frontend/components/giai-chay/RouteImageLightbox.tsx` — Client Component `'use client'` for course image lightbox

#### Component boundaries
- Detail page = Server Component (SSR + ISR)
- CourseCard = Server Component (static render)
- RouteImageLightbox = `'use client'` (modal state + escape key handler)
- CountdownTimer (existing F-036) reused = `'use client'`

#### TanStack Query / fetch
- Server Components use `fetch()` with `next: { revalidate: 3600, tags: ['giai-chay:race:<urlName>'] }`
- No TanStack Query needed (no client-side data mutation)
- No SDK regenerate needed (admin doesn't consume this endpoint)

#### Sitemap re-build
- Frontend `getAllRaces()` already returns dual-source — sitemap iterates list
- Remove skip filter line in `sitemap-races.xml/route.ts:53-55`
- On-sale race urlName MUST be defined (BR-37-24 fallback to raceId) for valid URL

🛑 **PAUSE before:**
- Reverting F-036 RaceCard on-sale branch — Manager `/5bib-plan` confirm no regression for F-036 users
- Sitemap inclusion change — verify GSC sitemap re-fetch within 24h

### PAUSE flags
- 🛑 Migration MongoDB/MySQL schema (NONE in F-037, but flag if Coder discovers cols don't exist)
- 🛑 `pnpm install` (NONE expected — F-033 patterns reusable)
- 🛑 Auth/security logic change (NONE — public endpoint, no JwtAuthGuard)
- 🛑 Breaking API response change (NONE — new endpoint, backward compatible)
- 🛑 Touching MongoDB races collection (NONE — F-037 read-only on MySQL)

---

## 🛡️ Testing Mandates (For QC Agent)

### Backend Test Cases TC-37-XX

#### TC-37-01 Happy path — Fetch on-sale race with full data

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/promo-hubs/races-on-sale/by-url-name/175` |
| Headers | None (public endpoint) |
| Body | N/A |
| Expected status | 200 |
| Expected body shape | `{"raceId":"175","title":"Hai Phong Legacy Marathon 2026","urlName":"175","description":"<sanitized HTML>","logoUrl":"https://...","eventStartDate":"<iso>","registrationEndTime":"<iso>","location":"Hải Phòng","province":"Hải Phòng","brand":"...","raceType":"MARATHON","sellingWebUrl":"https://5bib.com/vi/events/175_175?ref=seo-giai-chay&utm_source=organic&utm_medium=seo&utm_campaign=giai-chay","source":"on-sale","courses":[{"id":"...","name":"Marathon 42KM","distance":"42KM","price":1500000,"closeForSaleDateTime":"<iso>","routeImageUrl":"https://...","gain":"500m+"}]}` |
| MUST NOT leak | `tenant_id`, `is_delete`, `is_show`, `metadata.internal`, `created_by_id` |
| Side effect verify | Redis cache `promo-hub:race-on-sale-detail:175` populated TTL 600s; no MongoDB query attempted; no admin mutation |

#### TC-37-02 Validation — urlName param non-existent

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/promo-hubs/races-on-sale/by-url-name/NONEXISTENT-XYZ` |
| Expected status | 404 |
| Expected body | `{"statusCode":404,"message":"Race not found","error":"Not Found"}` |
| MUST NOT leak | MySQL query SQL, stack trace, internal IDs |

#### TC-37-03 Filter — race exists but is_show=false

| Element | Value |
|---------|-------|
| Setup | Insert test race with `is_show=0` in MySQL (read-only user can't, use mock) |
| Method | GET |
| URL | `/api/promo-hubs/races-on-sale/by-url-name/HIDDEN-RACE` |
| Expected status | 404 |
| Behavior | Treat as not exists (no information leak) |

#### TC-37-04 Filter — race deleted

| Element | Value |
|---------|-------|
| Setup | Test race with `is_delete=1` in mock |
| Expected status | 404 |
| Behavior | Same as TC-37-03 — never expose deleted races |

#### TC-37-05 Filter — race status != GENERATED_CODE

| Element | Value |
|---------|-------|
| Setup | Test race with `status='DRAFT'` |
| Expected status | 404 |
| Behavior | Only `status=GENERATED_CODE` accessible via on-sale endpoint (race transitioned to VẬN HÀNH not returned, frontend should fall through to MongoDB) |

#### TC-37-06 Course filter — deleted course excluded

| Element | Value |
|---------|-------|
| Setup | Race 175 has 3 courses, course #2 deleted=1 |
| Method | GET |
| URL | `/api/promo-hubs/races-on-sale/by-url-name/175` |
| Expected status | 200 |
| Expected body | `courses[]` length = 2 (course #2 excluded) |

#### TC-37-07 Concurrent fetch (cache stampede defense)

| Element | Value |
|---------|-------|
| Method | 10x parallel GET `/api/promo-hubs/races-on-sale/by-url-name/175` |
| Expected | All 10 succeed (200 OK), MySQL query executed ≤ 2 times (cache + 1 cold) |
| Side effect | Redis cache populated, subsequent requests served from cache |

#### TC-37-08 Boundary — urlName with special chars

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/promo-hubs/races-on-sale/by-url-name/test%2Fwith%2Fslashes` |
| Expected status | 404 |
| Behavior | URL-decode safely, no path traversal vulnerability |

#### TC-37-09 Boundary — race with empty courses array

| Element | Value |
|---------|-------|
| Setup | Race with no race_course rows |
| Expected status | 200 |
| Expected body | `courses: []` |
| Frontend handling | BR-37-25 — render "Chi tiết cự ly cập nhật sớm" placeholder |

#### TC-37-10 Performance — cold start latency

| Element | Value |
|---------|-------|
| Method | First GET (Redis cache empty) |
| Expected | p95 < 300ms |
| Tool | k6 or autocannon 100 requests |

### Frontend E2E Test Cases (Playwright)

| TC | Persona | Journey | Steps | Expected |
|----|---------|---------|-------|----------|
| E2E-37-01 | Anonymous Visitor | Direct URL access | 1. Navigate `/giai-chay/175` | Page renders, breadcrumb, H1 title, CTA "Đăng ký ngay" visible, JSON-LD scripts present in DOM |
| E2E-37-02 | Anonymous Visitor | Listing → detail navigation | 1. `/giai-chay` 2. Click on-sale race card | URL changes to `/giai-chay/{urlName}`, page renders, NO direct external navigation |
| E2E-37-03 | Anonymous Visitor | CTA click → selling-web | 1. On detail page 2. Click "Đăng ký ngay →" | Browser navigates to `5bib.com/vi/events/{urlName}_{raceId}?ref=seo-giai-chay&utm_*` |
| E2E-37-04 | Anonymous Visitor | Race registration closed | 1. Mock race with `registration_end_time < now()` 2. Visit detail page | Badge "Hết hạn đăng ký" stone, CTA disabled visual + tooltip |
| E2E-37-05 | Anonymous Visitor | 404 non-existent race | 1. Visit `/giai-chay/nonexistent-zzz` | Next.js 404 page, noindex meta present |
| E2E-37-06 | Anonymous Visitor | View course details | 1. Detail page 2. Scroll to courses section | Course cards rendered with distance, price, description, route image |
| E2E-37-07 | Anonymous Visitor | Click route image | 1. Course card 2. Click route_image_url | Lightbox modal opens with full-size image, ESC closes |
| E2E-37-08 | Google Crawler | Sitemap inclusion | 1. GET `/sitemap-races.xml` 2. Parse XML | Contains 17+ on-sale URLs with priority 0.9, changefreq daily |
| E2E-37-09 | Anonymous Visitor | Description sanitization | 1. Mock race with malicious HTML (`<script>alert('xss')</script>`) 2. Visit detail page | Scripts stripped, only allowlist tags rendered, NO XSS execution |
| E2E-37-10 | Anonymous Visitor | Race transition (BÁN VÉ→VẬN HÀNH) | 1. Visit on-sale race 2. Admin creates MongoDB version 3. Wait 1h+ 4. Refresh | Page now serves MongoDB version (status changes, `/ket-qua` becomes accessible) |

### Security Checks
- [ ] Endpoint public (no JwtAuthGuard) — verify no auth required
- [ ] No IDOR risk (no per-user data, just race public info)
- [ ] Response MUST NOT leak: `tenant_id`, `is_delete`, `is_show`, `metadata.internal`, `created_by_id`, `email_template_id`, `template_id`, MySQL query SQL, stack traces
- [ ] Sanitize `race.description` + `race_course.description` HTML (allowlist p/strong/em/ul/ol/li/br) — XSS defense
- [ ] URL param `urlName` validated (no path traversal `../`)
- [ ] No SQL injection (TypeORM parameterized queries)
- [ ] CORS: same-origin only (no cross-origin XHR exposure)
- [ ] Rate limit: reuse F-033 ThrottlerGuard defaults (60 req/min per IP)

### Performance SLA
- Backend endpoint p95 < 300ms cold (MySQL JOIN) / < 50ms warm (Redis cache)
- Cache hit ratio > 90% after warm-up (5 min)
- Frontend page render p95 < 800ms cold (SSR) / < 200ms warm (ISR cached)
- 10x concurrent stability test: 200/200 success rate, no MySQL connection pool exhaustion
- Sitemap render with 17 on-sale slugs added: still < 2s (current 109 URLs → 126 URLs)

### Anti-pattern Verification (carry-over F-036 mandate)

QC Phase 2 MUST verify:
- [ ] grep `<form` in `frontend/app/(main)/giai-chay/**` — ZERO forms for purchase (BR-37-10)
- [ ] grep `<button.*onClick.*\(`(register|buy|purchase|cart) — ZERO purchase onClick handlers
- [ ] All CTAs MUST be `<a href>` external, NOT `<button onClick>` JavaScript
- [ ] DOM inspection: `formCount === 0`, `purchaseOnClickCount === 0`

---

## 📌 Answers to Manager's PAUSE conditions (từ file 00)

### BA-Q1 — Detail page sections order
**Decision:** Hero (banner + title + meta sidebar + countdown) → CTA primary → Description → Courses grid → CTA repeat → Footer. Rationale: CTA above fold for conversion (mobile-first), description below for SEO content depth, courses for decision support.

### BA-Q2 — Price display format
**Decision:** Show `Intl.NumberFormat('vi-VN', {style:'currency',currency:'VND'})` per course (e.g. "1.500.000 ₫"). Fallback "Liên hệ" if `price=null`. Display ALL course prices (NOT lowest tier only) for transparency.

### BA-Q3 — Course images rendering
**Decision:** Render BOTH `route_image_url` (race overview) AND `route_map_image_url` (technical map) when both present. Lightbox component handles full-size view on click. If only one present, render that one. If neither, course card has no image (clean layout).

### BA-Q4 — Sitemap priority for on-sale
**Decision:** Priority **0.9** (same as MongoDB pre_race/live active races per F-036 BR-19). Rationale: on-sale = active type, high SEO value during registration window. Changes to 0.6 only after race transitions to ended (auto-handled by F-036 sitemap logic via MongoDB takeover).

---

## ✅ Status

- [x] DRAFT
- [x] 🔵 **READY** — sẵn sàng cho Manager `/5bib-plan`

---

## 🔗 Next step

Danny chạy:
```
/5bib-plan FEATURE-037-on-sale-race-detail-page
```

Manager sẽ review PRD này + ra verdict APPROVED / NEEDS_REVISION / REJECTED + viết Scope Lock cho Coder trong `02-manager-plan.md`.
