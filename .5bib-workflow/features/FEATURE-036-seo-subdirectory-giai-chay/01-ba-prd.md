# FEATURE-036: PRD — SEO Subdirectory Routes `5bib.com/giai-chay/*`

**Status:** 🔵 READY
**Created:** 2026-05-15
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`
**Input:** `PRD_SEO_subdirectory_routes.md` (Danny gốc) + Manager init decisions

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` đầy đủ — Manager đã chốt 8 decisions
- [x] Đã đọc memory `codebase-map.md` (route layout), `known-issues.md` (vùng risk)
- [x] Đã đọc PRD gốc của Danny + F-027 OPS-NOTES + INTEGRATION-5ticket doc
- [x] Đã verify code thực:
  - [frontend/components/hub/internal-urls.ts](frontend/components/hub/internal-urls.ts) — `getRaceUrl()` + `getTicketUrl()` pattern
  - [frontend/app/(main)/hub/[slug]/page.tsx:67-78](frontend/app/(main)/hub/[slug]/page.tsx) — F-027 canonical pattern (`https://5bib.com/hub/${slug}` self-canonical)
  - [backend/src/modules/races/schemas/race.schema.ts:137-150](backend/src/modules/races/schemas/race.schema.ts) — slug, status, province, location fields confirmed
  - 5bib.com root sitemap.xml + robots.txt đã tồn tại (HTTP 200) → cần đặt tên sitemap khác để tránh conflict

---

## 📝 Programmatic SEO via `5bib.com/giai-chay/*`

### Goal

Tạo 600+ trang SEO-optimized cho race calendar Việt Nam tại subdirectory `5bib.com/giai-chay/*` (reuse F-027 hub routing model — 5Ticket Vercel rewrite), hưởng SEO authority của domain chính. Mục tiêu 6 tuần: 600+ pages indexed, top 10 cho ≥30 keywords "giải chạy + [thành phố]", organic traffic ×5.

**Quan trọng — Business Invariant:** SEO page là **discovery layer**. Mọi CTA "Mua vé/Đăng ký" PHẢI link về **selling-web** (`5bib.com/vi/events/...`) — đó là nơi xử lý transaction. SEO page KHÔNG được có form đăng ký inline.

### Scope

**✅ In scope:**
- 5 route mới trong `frontend/app/(main)/giai-chay/*`: listing, race detail, race results, city aggregator, sitemap
- API helper layer `app/lib/seo-api.ts` + ISR cache
- Backend NestJS `@Cron` weekly job: discover new races + auto-generate slug + trigger frontend revalidate
- Backend endpoint manual trigger cho admin: `POST /api/admin/seo/sync-slugs`
- Province normalization map (top 10 thành phố VN có race)
- Self-canonical metadata + JSON-LD SportsEvent + BreadcrumbList structured data
- Helper centralize `app/lib/selling-web-url.ts` — build CTA URL về selling-web với UTM tracking
- Dynamic sitemap `sitemap-races.xml` (tên khác `sitemap.xml` để tránh conflict với root 5bib.com sitemap)

**❌ Out of scope:**
- Athlete detail page deep link `/giai-chay/[slug]/vdv/[bib]` (Phase 2 — riêng feature)
- FAQ schema, Hreflang multilingual (Phase 3)
- Core Web Vitals audit/optimization (Phase 4)
- Sửa selling-web (KHÔNG đụng selling-web codebase — chỉ link sang)
- Backend race schema migration (slug field + index đã có sẵn)
- Form đăng ký/mua vé inline (CẤM)
- Sửa F-027 hub routing (giữ nguyên — chỉ reuse pattern)

---

## 👤 User Stories & Business Rules

### User Stories

- As an **Anonymous Visitor** searching Google for "giải chạy Hồ Chí Minh 2026", I want to land on `5bib.com/giai-chay/thanh-pho/ho-chi-minh` so that I see all relevant races without navigating sub-domain trees.
- As an **Anonymous Visitor** clicking a race card on `/giai-chay/`, I want to read full race info (date, location, distances, courses) on `/giai-chay/[raceSlug]` so that I can decide to register.
- As an **Anonymous Visitor** on race landing page when race is `pre_race`/`live` (đang bán vé), I want a clear "Đăng ký ngay" CTA so that I am taken to the actual purchase flow on selling-web.
- As an **Anonymous Visitor** on race landing when race is `ended`, I want a "Xem kết quả" CTA so that I navigate internally to `/giai-chay/[slug]/ket-qua` to see leaderboard.
- As an **Anonymous Visitor** on results page, I want pagination + search by name/BIB so that I can find my friend's finish time.
- As a **5BIB Back-Office Admin**, I want a manual "Sync SEO slugs" button so that I can force-generate slugs after data import without waiting for next weekly cron.
- As a **Race Organizer (merchant)**, I want my newly-created race to auto-appear on `5bib.com/giai-chay/*` within 1 week so that I get free SEO exposure with zero manual work.
- As a **Google Crawler**, I want to fetch `https://5bib.com/sitemap-races.xml` with `<lastmod>` and `<priority>` so that I prioritize indexing.

### Business Rules

#### Slug & Cron strategy

- **BR-01:** MongoDB `races.slug` field đã có sẵn. Cron tuần phát hiện race có `slug = null | '' | undefined` → generate slug = `slugify(title)` + `-` + năm `startDate` (vd: "VnExpress Marathon HCM" + 2026 → `vnexpress-marathon-hcm-2026`).
- **BR-02:** Slugify rules:
  - Lowercase, kebab-case, ASCII only (strip diacritics: "Hồ Chí Minh" → "ho-chi-minh")
  - Replace whitespace + special chars → `-`
  - Collapse consecutive `-`
  - Trim leading/trailing `-`
  - Max length 80 chars (truncate at word boundary)
- **BR-03:** Slug uniqueness: nếu slug đã tồn tại (race khác đã claim) → append `-2`, `-3`, … (incrementing suffix until unique).
- **BR-04:** Cron schedule: **`@Cron('0 2 * * 0')`** — every Sunday 02:00 GMT+7. Anti-stampede via Redis SETNX lock `cron:seo-slug-sync:lock` (TTL 600s).
- **BR-05:** Sau khi cron backfill batch slugs → gọi frontend revalidate endpoint qua HTTP POST (reuse F-027 `FRONTEND_REVALIDATE_URL` pattern, secret token-gated):
  - `revalidatePath('/giai-chay')` (listing page)
  - `revalidatePath('/giai-chay/[slug]', 'page')` per slug mới
  - `revalidatePath('/sitemap-races.xml')`
- **BR-06:** Cron failure handling: 3 retry với exponential backoff (1s, 5s, 25s). Log success/fail vào NestJS Logger với context `seo-slug-sync`. Nếu fail 2 tuần liên tiếp → log ERROR level (ops monitor qua existing log infrastructure).
- **BR-07:** Manual trigger endpoint `POST /api/admin/seo/sync-slugs` cho 5BIB Back-Office Admin (JwtAuthGuard + role admin). Behavior y hệt cron — share service method.

#### Race filtering & status mapping

- **BR-08:** Race `status = 'draft'` → **TUYỆT ĐỐI EXCLUDE** khỏi mọi SEO route, sitemap, listing. Backend API `GET /api/races` đã filter sẵn (CLAUDE.md spec confirmed).
- **BR-09:** Race status → SEO behavior mapping:
  | Status | Visibility | CTA logic |
  |--------|-----------|-----------|
  | `pre_race` | ✅ Hiện | "Đăng ký ngay" → selling-web URL (BR-12) |
  | `live` | ✅ Hiện | "Đăng ký ngay" → selling-web URL (BR-12) + "Xem live results" → internal |
  | `ended` | ✅ Hiện | "Xem kết quả" → internal `/giai-chay/[slug]/ket-qua` |
  | `draft` | ❌ Ẩn | N/A |

#### CTA "Mua vé" / "Đăng ký" — selling-web link (CRITICAL)

- **BR-10:** SEO page TUYỆT ĐỐI KHÔNG được có `<form>` xử lý đăng ký, mua vé, cart, payment. CHỈ accept `<form>` cho search/filter local (vd: filter race by year).
- **BR-11:** Mọi CTA action ("Đăng ký ngay", "Mua vé", "Mua BIB") MUST là `<a href="...">` external link với `target="_self"`, KHÔNG `<button onClick>` JavaScript.
- **BR-12:** CTA URL format về selling-web. **Format đề xuất (BA propose, Danny verify trong /5bib-plan):**
  ```
  https://5bib.com/vi/events/{slug}_{raceId}?ref=seo-giai-chay&utm_source=organic&utm_medium=seo&utm_campaign=giai-chay
  ```
  - Path: `/vi/events/{slug}_{raceId}` — copy nguyên format legacy selling-web (PRD gốc Danny confirm pattern này)
  - UTM tracking: 4 params bắt buộc để Danny analyze CTR từ SEO
  - `ref=seo-giai-chay` — internal ref param (Danny nói "khác URL hiện tại 1 chút" — đây là cái "khác")
  - Centralize trong helper `app/lib/selling-web-url.ts` → đổi format 1 chỗ là apply toàn bộ
- **BR-13:** Nếu race thiếu `slug` (cron chưa fire) → fallback CTA URL: `https://5bib.com/vi/events/{raceId}` (chỉ raceId). Vẫn link được selling-web, mất SEO juice phần slug.

#### Canonical & duplicate content

- **BR-14:** Reuse F-027 hub canonical pattern: `<link rel="canonical" href="https://5bib.com/giai-chay/{slug}" />` self-canonical về domain 5bib.com (mặc dù app render trên result.5bib.com qua Vercel rewrite). Cụ thể format dùng Next.js metadata:
  ```ts
  return {
    title: '...',
    alternates: { canonical: `https://5bib.com/giai-chay/${slug}` },
    openGraph: { url: `https://5bib.com/giai-chay/${slug}`, ... },
  }
  ```
- **BR-15:** Khi user truy cập trực tiếp `result.5bib.com/giai-chay/*` → trả `<meta name="robots" content="noindex,nofollow" />` cho domain `result.5bib.com` (giống F-027 hub behavior). Verify Coder qua middleware host check.

#### Sitemap

- **BR-16:** Sitemap tên `sitemap-races.xml` (KHÔNG `sitemap.xml` vì 5bib.com root đã có) — implement qua Next.js `app/sitemap.ts` ở vị trí `app/(main)/giai-chay/sitemap.ts`. Output route: `/sitemap-races.xml` (cần config Next.js `MetadataRoute.Sitemap` + 5Ticket Vercel rewrite).
- **BR-17:** Sitemap entries per race:
  - `https://5bib.com/giai-chay/{slug}` — luôn có
  - `https://5bib.com/giai-chay/{slug}/ket-qua` — chỉ nếu `status ∈ {live, ended}` (race chưa diễn ra → không có kết quả)
- **BR-18:** Sitemap `lastmod` per entry:
  - Race `ended` → `endDate` (race đã đóng, ít thay đổi)
  - Race `pre_race`/`live` → `now()` (cập nhật live)
- **BR-19:** Sitemap `priority`:
  - Race active (pre_race/live): 0.9
  - Race ended: 0.6
  - Results page (ended): 0.5
  - Results page (live): 0.8
- **BR-20:** Sitemap `changeFrequency`:
  - Active race: `daily`
  - Ended race: `yearly`
  - Active results: `hourly`
  - Ended results: `monthly`

#### Province normalization

- **BR-21:** Province slug map (Phase B, cùng launch — KHÔNG defer):
  ```
  ho-chi-minh    ← ["TP HCM", "TP.HCM", "Tp Hồ Chí Minh", "Thành phố Hồ Chí Minh", "HCM", "Hồ Chí Minh"]
  ha-noi         ← ["Hà Nội", "TP Hà Nội", "Thành phố Hà Nội", "HN"]
  da-nang        ← ["Đà Nẵng", "TP Đà Nẵng"]
  da-lat         ← ["Đà Lạt", "Lâm Đồng"]
  nha-trang      ← ["Nha Trang", "Khánh Hoà", "Khánh Hòa"]
  hai-phong      ← ["Hải Phòng", "TP Hải Phòng"]
  hue            ← ["Huế", "Thừa Thiên Huế", "TT Huế"]
  can-tho        ← ["Cần Thơ", "TP Cần Thơ"]
  vung-tau       ← ["Vũng Tàu", "Bà Rịa Vũng Tàu", "BRVT"]
  quy-nhon       ← ["Quy Nhơn", "Bình Định"]
  ```
- **BR-22:** Race có province không khớp 10 cities trên → fallback bucket `khac` (`/giai-chay/thanh-pho/khac`). Page này KHÔNG xuất hiện trong sitemap (low SEO value).
- **BR-23:** Race có `province = null/empty` → KHÔNG hiển thị trong city aggregator. Vẫn hiện trong global listing `/giai-chay/`.

#### ISR & cache

- **BR-24:** ISR revalidate per route:
  | Route | `revalidate` (seconds) | Reason |
  |-------|-----------------------|--------|
  | `/giai-chay/` | 3600 (1h) | List ổn định |
  | `/giai-chay/[slug]` (pre_race/live) | 3600 (1h) | Active race info |
  | `/giai-chay/[slug]` (ended) | 86400 (24h) | Đã ổn định |
  | `/giai-chay/[slug]/ket-qua` (live) | 1800 (30min) | Race day |
  | `/giai-chay/[slug]/ket-qua` (ended) | 86400 (24h) | Static |
  | `/giai-chay/thanh-pho/[city]` | 21600 (6h) | Aggregation |
  | `/sitemap-races.xml` | 86400 (24h) | Daily refresh |

#### JSON-LD structured data

- **BR-25:** `/giai-chay/[slug]` MUST output JSON-LD `SportsEvent`:
  ```json
  {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": "<race.title>",
    "startDate": "<race.startDate ISO>",
    "endDate": "<race.endDate ISO>",
    "location": { "@type": "Place", "name": "<race.location>",
                  "address": { "@type": "PostalAddress",
                               "addressLocality": "<race.province>",
                               "addressCountry": "VN" } },
    "organizer": { "@type": "Organization",
                   "name": "<race.organizer or '5BIB'>",
                   "url": "https://5bib.com" },
    "image": "<race.bannerUrl or race.imageUrl>",
    "sport": "Running",
    "eventStatus": "https://schema.org/EventScheduled" | "EventInProgress" | "EventEnded",
    "url": "https://5bib.com/giai-chay/<slug>"
  }
  ```
  Race active (`pre_race`/`live`) thêm `offers`: `{ "@type": "Offer", "priceCurrency": "VND", "url": "<selling-web-url>", "availability": "https://schema.org/InStock" }`.
- **BR-26:** `/giai-chay/[slug]` + `/giai-chay/[slug]/ket-qua` MUST output JSON-LD `BreadcrumbList`:
  - Position 1: "Trang chủ" → `https://5bib.com/`
  - Position 2: "Giải chạy" → `https://5bib.com/giai-chay/`
  - Position 3 (city, optional): `<city>` → `https://5bib.com/giai-chay/thanh-pho/<city-slug>`
  - Position last: `<race.title>` → current URL

#### Internal linking (SEO juice distribution)

- **BR-27:** Race landing `/giai-chay/[slug]` MUST có ≥3 internal links đến race tương tự (cùng province HOẶC cùng distance range). Đặt trong sidebar hoặc "Giải tương tự" section.
- **BR-28:** `/giai-chay/` listing page MUST link đến tất cả city pages có ≥1 race (top 10 cities theo BR-21).

#### 404 handling

- **BR-29:** Race slug không tồn tại trong DB → return 404 (Next.js `notFound()`), KHÔNG redirect.
- **BR-30:** Race có `status = 'draft'` mà user truy cập slug đó → 404 (treat as not exists). KHÔNG leak draft race.

---

## 🖥️ UI/UX Flow

### Route Structure (Next.js App Router)

```
frontend/app/(main)/giai-chay/
├── layout.tsx                           # SEO shell + breadcrumb + header/footer
├── page.tsx                             # /giai-chay/ — listing
├── sitemap.ts                           # /sitemap-races.xml — dynamic sitemap
├── [raceSlug]/
│   ├── page.tsx                         # /giai-chay/[slug] — race landing
│   ├── not-found.tsx                    # 404 page
│   └── ket-qua/
│       └── page.tsx                     # /giai-chay/[slug]/ket-qua — results
└── thanh-pho/
    └── [citySlug]/
        ├── page.tsx                     # /giai-chay/thanh-pho/[city] — city aggregator
        └── not-found.tsx                # 404 page
```

---

### Screen 1: `/giai-chay/` — Race Calendar Listing

**Title tag:** `Lịch giải chạy bộ Việt Nam 2026 — Đăng ký & Kết quả | 5BIB`
**Description:** `Danh sách toàn bộ giải chạy bộ Việt Nam — marathon, trail, ultra. Đăng ký, mua BIB, xem kết quả. Cập nhật hàng tuần.`

**Visible data:**
| Element | Field | Source |
|---------|-------|--------|
| H1 | "Giải chạy bộ Việt Nam 2026" | Static |
| Race count | Total active races | Computed from `getAllRaces()` |
| Filter year | 2024 / 2025 / 2026 | Derived from `race.startDate` |
| Filter province | Top 10 cities | BR-21 + dynamic from data |
| Filter status | "Sắp diễn ra" / "Đã kết thúc" | `race.status` |
| Race card | banner image, title, startDate, location, distances (course count + max distance), status badge | `race.bannerUrl/imageUrl`, `race.title`, `race.startDate`, `race.location`, `race.courses[].distance` |
| City pills | Top 10 cities với race count | BR-21 + aggregation |

**User actions:**
- Click race card → navigate `/giai-chay/[slug]`
- Click filter → URL search param `?year=2026&city=ho-chi-minh&status=pre_race` (Server Component re-render với filter)
- Click city pill → navigate `/giai-chay/thanh-pho/[citySlug]`

**States:**
- **Loading (SSR initial fetch):** skeleton 6 race cards
- **Empty (zero races):** "Hiện chưa có giải nào — hãy quay lại sau!" + link homepage
- **Empty (filter no match):** "Không tìm thấy giải khớp bộ lọc" + button "Xoá bộ lọc"
- **Data:** Grid race cards (3 col desktop, 2 col tablet, 1 col mobile)
- **Error (API fail):** "Không tải được danh sách giải. Thử lại sau." + retry button

---

### Screen 2: `/giai-chay/[raceSlug]` — Race Landing Page

**Title tag (active race — `pre_race`/`live`):**
`Đăng ký <race.title> — Mua BIB giải chạy <province> <year> | 5BIB`

**Title tag (ended race):**
`Kết quả <race.title> — Bảng xếp hạng & Chip Time | 5BIB`

**Visible data:**
| Element | Field | Source |
|---------|-------|--------|
| H1 | Race title | `race.title` |
| Hero banner | Image | `race.bannerUrl ?? race.imageUrl` |
| Date | startDate – endDate | `race.startDate`, `race.endDate` |
| Location | Full location string | `race.location` |
| Status badge | "Sắp diễn ra" / "Đang diễn ra" / "Đã kết thúc" | Mapped from `race.status` (BR-09) |
| Description | Race description (HTML allowed but sanitized) | `race.description` |
| Course list | Card per course: name, distance, startTime, cutOffTime | `race.courses[]` (embedded) |
| Countdown (active) | Time until startDate | Computed |
| CTA primary | Button text + URL | Per BR-09 + BR-12 |
| Sidebar — Giải tương tự | 3+ race links (BR-27) | Computed from same province/distance |

**User actions:**
- Click CTA "Đăng ký ngay" (race active) → external nav to `<selling-web-url>` (BR-12)
- Click CTA "Xem kết quả" (race ended) → internal nav to `/giai-chay/[slug]/ket-qua`
- Click course card → scroll to course detail (anchor) OR navigate to `/giai-chay/[slug]/ket-qua?course=<courseId>`
- Click breadcrumb item → nav to parent

**States:**
- **Loading (SSR):** skeleton hero + 3 section placeholders
- **404 (slug not found OR status=draft):** Next.js `notFound()` → custom 404 page
- **Active race data loaded:** banner + countdown + CTA "Đăng ký ngay"
- **Live race data loaded:** banner + "LIVE" badge + dual CTA ("Đăng ký" + "Xem live")
- **Ended race data loaded:** banner + stats summary + CTA "Xem kết quả"
- **Race missing slug** (cron chưa fire): KHÔNG xảy ra vì 404 cho slug không tồn tại; race trong DB mà `slug = null` không sinh route
- **Error (API fail):** "Không tải được thông tin giải" + retry button

**JSON-LD outputs:** BR-25 (SportsEvent) + BR-26 (BreadcrumbList).

---

### Screen 3: `/giai-chay/[raceSlug]/ket-qua` — Results Table

**Title tag:** `Kết quả <race.title> <year> — Chip Time & Xếp hạng | 5BIB`

**Visible data:**
| Element | Field | Source |
|---------|-------|--------|
| H1 | "Kết quả <race.title>" | `race.title` |
| Course tabs | List courses with finisher count | `race.courses[]` + `getCourseStats()` per course |
| Stats card | Total finishers, fastest time, avg pace | `getCourseStats(raceId, courseId)` |
| Results table | Hạng, BIB, Tên, Chip Time, Gun Time, Pace, Giới tính, Category | `getRaceResults(raceId, courseId, page)` |
| Search input | Tìm theo BIB/tên | Client-side filter trên page hiện tại (KHÔNG re-fetch — server pagination giữ) |
| Pagination | Page N / Total | Server-side, 50 per page |

**User actions:**
- Click course tab → URL `?course=<courseId>` (Server Component re-render)
- Type in search → debounced 300ms, filter rows client-side trên page hiện tại
- Click page number → URL `?course=<courseId>&page=<N>`
- Click "Quay lại race detail" → nav `/giai-chay/[slug]`

**States:**
- **Loading (SSR):** skeleton table 10 rows
- **404 (slug not found OR status=draft OR status=pre_race race chưa start):** Next.js `notFound()` — pre-race chưa có kết quả
- **Empty (course có 0 finisher):** "Chưa có ai finish course này" + link course khác
- **Data loaded:** table with rows + pagination + stats card
- **Search empty:** "Không tìm thấy VĐV khớp '<query>'"
- **Error (API fail):** retry button

**Note:** Timing data trong DB là JSON string (CLAUDE.md ghi rõ), nhưng backend API `GET /api/race-results` đã trả parsed → frontend KHÔNG cần parse.

---

### Screen 4: `/giai-chay/thanh-pho/[citySlug]` — City Aggregator

**Title tag:** `Giải chạy bộ <City> 2026 — Lịch thi đấu & Kết quả | 5BIB`

**Visible data:**
| Element | Field | Source |
|---------|-------|--------|
| H1 | "Giải chạy bộ <City>" | Map từ city slug → display name |
| Intro paragraph | "Tại <City> năm <year> có N giải chạy..." | Computed |
| Race list (sorted by startDate ASC) | Same race card as Screen 1 | `getAllRaces()` filter by province (BR-21 normalize) |

**User actions:**
- Click race card → nav `/giai-chay/[slug]`
- Click breadcrumb "Giải chạy" → nav `/giai-chay/`

**States:**
- **Loading:** skeleton list
- **404 (citySlug không khớp BR-21 và không phải `khac`):** Next.js `notFound()`
- **Empty (city có 0 race):** "Hiện <City> chưa có giải nào — quay lại sau" + link city khác
- **Data loaded:** race list
- **Error:** retry

---

### Screen 5: Admin Manual Trigger UI (5BIB Back-Office)

> Nằm trong existing admin app (`admin/`), không phải frontend. Trang admin dashboard có 1 section nhỏ.

**Route:** `/admin/seo` (NEW)

**Visible data:**
- Last cron run timestamp
- Last cron result: success / fail + error message
- Count: races có slug / races thiếu slug
- Button "Sync ngay" (manual trigger)

**User actions:**
- Click "Sync ngay" → confirm modal → call `POST /api/admin/seo/sync-slugs`
- Show toast result

**States:**
- **Idle:** stats + button enabled
- **Submitting (clicked sync):** button disabled + spinner
- **Success:** toast green "Đã sync N race" + reload stats
- **Error:** toast red với error message

---

## 🛠️ Technical Mandates (For Coder Agent)

### DB Changes

**MongoDB:**
- `races` collection: slug field + index ĐÃ CÓ (verified [race.schema.ts:137, 223](backend/src/modules/races/schemas/race.schema.ts)). **KHÔNG cần migration schema.**
- Khi cron generate slug → `updateOne({ _id }, { $set: { slug: <generated> } })`. Idempotent.
- NEW collection (optional, recommended): `seo_sync_logs` — record cron runs cho admin visibility.
  - Fields: `_id`, `startedAt`, `finishedAt`, `racesScanned`, `slugsGenerated`, `revalidatedPaths[]`, `errors[]`, `triggeredBy: 'cron' | 'manual'`, `userId?`
  - Index: `{ startedAt: -1 }`

**MySQL platform:** KHÔNG ĐỤNG.

### Redis Cache

- **Key `cron:seo-slug-sync:lock`** — SETNX với TTL 600s. Đảm bảo chỉ 1 instance fire cron tại 1 thời điểm (multi-pod safety). Pattern giống F-018/F-019 anti-stampede.
- **KHÔNG cần Redis cache cho API call** — Next.js ISR đã handle (`fetch(..., { next: { revalidate: N } })`).

### Backend — NestJS

**File mới:**
- `backend/src/modules/races/seo-slug-sync.service.ts` — core logic (`syncSlugs()` method, slugify, uniqueness check, revalidate trigger)
- `backend/src/modules/races/seo-slug-sync.cron.ts` — `@Cron('0 2 * * 0')` wrapper, gọi service
- `backend/src/modules/races/seo-sync-log.schema.ts` — Mongoose schema cho log collection
- `backend/src/modules/admin/admin-seo.controller.ts` — manual trigger endpoint
- `backend/src/modules/admin/dto/seo-sync-result.dto.ts` — response DTO

**Endpoint mới: `POST /api/admin/seo/sync-slugs`**

Input: none (body empty)
Response DTO:
```typescript
class SeoSyncResultDto {
  @ApiProperty() racesScanned!: number;
  @ApiProperty() slugsGenerated!: number;
  @ApiProperty({ type: [String] }) revalidatedPaths!: string[];
  @ApiProperty({ type: [String] }) errors!: string[];
  @ApiProperty() durationMs!: number;
}
```
Guards: `@UseGuards(JwtAuthGuard)` + role check `admin` (5BIB Back-Office only).
Behavior: gọi service y hệt cron, return summary để admin xem trên UI.

**Endpoint mới: `GET /api/admin/seo/sync-logs?limit=10`**

Response: `SeoSyncLogDto[]` (gần nhất trước). Cho admin dashboard hiển thị history.

**Env:**
- `FRONTEND_REVALIDATE_GIAICHAY_URL` — backend gọi frontend revalidate (reuse pattern F-027). Default: `http://5bib-result-frontend:3002/api/revalidate-giai-chay`
- `REVALIDATE_TOKEN` — reuse existing F-027 secret (đã có trong PROD env).

**🛑 PAUSE flags cho Coder:**
- [ ] Trước khi `pnpm install` package mới (slugify lib) — verify `@sindresorhus/slugify` đã có trong deps chưa, nếu chưa thì hỏi Danny.
- [ ] Trước khi enable cron lần đầu trên PROD — Danny duyệt schedule (Sunday 02:00 GMT+7).
- [ ] Nếu phát hiện race có slug đã tồn tại với value sai (vd: dấu, uppercase) — KHÔNG được tự ý sửa, chỉ generate cho race `slug = null/empty`.

### Frontend — Next.js

**File mới:**
- `frontend/app/(main)/giai-chay/layout.tsx` — Server Component, header/footer/breadcrumb
- `frontend/app/(main)/giai-chay/page.tsx` — Server Component, listing
- `frontend/app/(main)/giai-chay/sitemap.ts` — export default `sitemap()` function → `/sitemap-races.xml`
- `frontend/app/(main)/giai-chay/[raceSlug]/page.tsx` — Server Component, race landing với `generateMetadata`
- `frontend/app/(main)/giai-chay/[raceSlug]/not-found.tsx` — 404 page
- `frontend/app/(main)/giai-chay/[raceSlug]/ket-qua/page.tsx` — Server Component, results table
- `frontend/app/(main)/giai-chay/thanh-pho/[citySlug]/page.tsx` — Server Component, city aggregator
- `frontend/app/(main)/giai-chay/thanh-pho/[citySlug]/not-found.tsx` — 404
- `frontend/app/api/revalidate-giai-chay/route.ts` — token-gated POST endpoint receiving revalidate request from backend cron (reuse pattern `/api/revalidate-hub`)
- `frontend/lib/seo-api.ts` — API wrapper helpers (`getAllRaces`, `getRaceBySlug`, `getRaceResults`, `getCourseStats`)
- `frontend/lib/selling-web-url.ts` — `buildSellingWebUrl(slug, raceId)` helper (BR-12 format)
- `frontend/lib/province-normalize.ts` — BR-21 map + helper `normalizeProvince(raw): citySlug | 'khac'`
- `frontend/lib/seo-structured-data.ts` — JSON-LD builders for `SportsEvent` + `BreadcrumbList`

**Client Components (`'use client'` chỉ khi thực sự cần):**
- `frontend/components/giai-chay/CountdownTimer.tsx` — `'use client'` cho setInterval
- `frontend/components/giai-chay/ResultsSearch.tsx` — `'use client'` cho useState filter input
- `frontend/components/giai-chay/RaceListFilters.tsx` — `'use client'` (hoặc Server Component với URL search params — Coder chọn)

**Server Components (mặc định):**
- Race card, race landing hero, course list, JSON-LD scripts, sitemap, layout, listing, city aggregator, results table (with pagination via URL params)

**Admin (`admin/`):**
- `admin/src/app/(dashboard)/admin/seo/page.tsx` — Server Component, manual trigger UI
- `admin/src/components/seo/SyncSlugsButton.tsx` — Client Component với mutation hook (via TanStack Query, generated SDK)

**TanStack Query (admin only):**
- `queryKey: ['admin', 'seo', 'sync-logs']` — list recent runs
- `useSyncSlugsMutation` — POST trigger, on success invalidate `['admin', 'seo', 'sync-logs']`

**Revalidation:**
- Backend cron → POST frontend `/api/revalidate-giai-chay` with token → frontend calls `revalidatePath('/giai-chay')`, `revalidatePath('/giai-chay/{slug}', 'page')` per slug, `revalidatePath('/sitemap-races.xml')`.

**SDK regeneration:**
- Sau khi backend thêm endpoint admin → Coder MUST chạy `pnpm --filter admin generate:api`.

**5Ticket Vercel rewrite (coordinate ngoài codebase):**
- Add rewrite: `5bib.com/giai-chay/:path*` → `result-fe.5bib.com/giai-chay/:path*`
- Add rewrite: `5bib.com/sitemap-races.xml` → `result-fe.5bib.com/sitemap-races.xml`
- KHÔNG nằm trong scope Coder code — Manager/Danny coordinate với 5Ticket team sau khi internal code done. Doc reference: [docs/INTEGRATION-5ticket-promo-hub-rewrite.md](docs/INTEGRATION-5ticket-promo-hub-rewrite.md) pattern.

**🛑 PAUSE flags cho Coder:**
- [ ] Trước khi sửa `next.config.ts` — KHÔNG được sửa `assetPrefix` (giữ `https://result.5bib.com`, BR-14 reuse F-027 pattern).
- [ ] Nếu cần thêm `@sindresorhus/slugify` hoặc lib slugify khác — confirm Danny.
- [ ] Nếu phát hiện cần đụng `frontend/app/(main)/hub/*` (F-027 code) — STOP, hỏi Manager.

---

## 🛡️ Testing Mandates (For QC Agent)

### Happy Path

1. **Listing page:** Visit `/giai-chay/` → 200 OK, render ≥10 race cards (filter active races only), no draft race visible
2. **Race landing (active):** Visit `/giai-chay/vnexpress-marathon-hcm-2026` → 200 OK, CTA "Đăng ký ngay" có `href` matching BR-12 format, JSON-LD SportsEvent render, canonical = `https://5bib.com/giai-chay/vnexpress-marathon-hcm-2026`
3. **Race landing (ended):** Visit `/giai-chay/some-ended-race-2024` → CTA "Xem kết quả" link internal `/giai-chay/some-ended-race-2024/ket-qua`
4. **Results page:** Visit `/giai-chay/some-ended-race-2024/ket-qua?course=10k&page=1` → table render with 50 rows + pagination
5. **City page:** Visit `/giai-chay/thanh-pho/ho-chi-minh` → list all races có province ∈ BR-21 alias list
6. **Sitemap:** GET `/sitemap-races.xml` → XML response with all non-draft races + lastmod/priority/changeFreq per BR-17~20
7. **Cron weekly run:** Manually trigger `POST /api/admin/seo/sync-slugs` → response shows races scanned/generated/revalidated. Verify race mới có slug + xuất hiện sitemap

### Unhappy Paths — MUST write tests for

**Validation & 404:**
- [ ] GET `/giai-chay/non-existent-slug` → 404 (Next.js `notFound()`)
- [ ] GET `/giai-chay/<draft-race-slug>` → 404 (BR-30 — draft race leak prevention)
- [ ] GET `/giai-chay/some-race/ket-qua` khi race `status=pre_race` → 404 (chưa có kết quả)
- [ ] GET `/giai-chay/thanh-pho/non-existent-city` → 404
- [ ] GET `/giai-chay/thanh-pho/khac` → 200 (fallback bucket valid)

**Anti-pattern checks (CRITICAL — Danny mandate):**
- [ ] **grep `<form` trong `frontend/app/(main)/giai-chay/**/*.tsx`** — chỉ accept form cho search/filter local; ZERO form đăng ký/mua vé inline (BR-10)
- [ ] Tất cả CTA "Đăng ký ngay" / "Mua vé" MUST có `href` starting with `https://5bib.com/vi/events/...` (BR-11, BR-12)
- [ ] CTA URL MUST contain `?ref=seo-giai-chay&utm_source=organic&utm_medium=seo&utm_campaign=giai-chay` (BR-12)
- [ ] KHÔNG có `<button onClick>` cho purchase action — chỉ `<a href>` (BR-11)
- [ ] CTA dùng `target="_self"` hoặc no target attribute (BR-11)

**Status mapping:**
- [ ] Race `pre_race` → CTA "Đăng ký ngay", NO "Xem kết quả" button
- [ ] Race `live` → BOTH "Đăng ký" và "Xem live"
- [ ] Race `ended` → CTA "Xem kết quả", NO "Đăng ký"

**Canonical & robots (BR-14, BR-15):**
- [ ] `<link rel="canonical" href="https://5bib.com/giai-chay/<slug>" />` present on race landing (regardless of host)
- [ ] Truy cập `result-fe.5bib.com/giai-chay/<slug>` direct → `<meta name="robots" content="noindex,nofollow">` PRESENT
- [ ] Truy cập `5bib.com/giai-chay/<slug>` (via Vercel rewrite) → NO robots noindex meta

**JSON-LD validation (BR-25, BR-26):**
- [ ] Race landing has `<script type="application/ld+json">` with `@type: SportsEvent`
- [ ] Race active has `offers` field with `priceCurrency: VND`
- [ ] Breadcrumb JSON-LD has correct position numbers + URLs

**Sitemap (BR-16~20):**
- [ ] `/sitemap-races.xml` valid XML, parsable by xmllint
- [ ] Each `<url>` has `<loc>`, `<lastmod>`, `<changefreq>`, `<priority>` per BR-18~20
- [ ] Race `status=draft` NEVER appears in sitemap (BR-8)
- [ ] Race `status=pre_race` has ONLY `/giai-chay/<slug>` entry, NOT `/ket-qua`
- [ ] Race `status=ended` has BOTH entries

**Province normalization (BR-21~23):**
- [ ] Race với province "TP.HCM" → appear on `/giai-chay/thanh-pho/ho-chi-minh`
- [ ] Race với province "Tp Hồ Chí Minh" → appear on `/giai-chay/thanh-pho/ho-chi-minh`
- [ ] Race với province "Đồng Nai" (không trong BR-21) → appear on `/giai-chay/thanh-pho/khac`
- [ ] Race với province `null` → KHÔNG appear trên any city page

**Cron behavior:**
- [ ] Trigger manual sync khi 1 race có slug=null → race nhận slug + revalidate triggered + log entry created
- [ ] Trigger 2 cron concurrent (manual + cron schedule fire cùng lúc) → 1 grabs lock, 1 returns early (SETNX behavior)
- [ ] Race với title chứa duplicate slug → 2nd race nhận `slug-2` suffix (BR-03)
- [ ] Race title rỗng / null → KHÔNG generate slug, log warning (edge case)

**Admin endpoint security:**
- [ ] `POST /api/admin/seo/sync-slugs` không có token → 401
- [ ] `POST /api/admin/seo/sync-slugs` token role `merchant` → 403
- [ ] `POST /api/admin/seo/sync-slugs` token role `admin` → 200
- [ ] `GET /api/admin/seo/sync-logs` same auth requirements
- [ ] Response KHÔNG leak: athlete PII, internal `_id` of race documents (only public race fields), `service_fee_rate`, MySQL credentials in error messages

**Boundary conditions:**
- [ ] 0 races in DB → listing shows empty state, sitemap returns empty `<urlset>` (still valid)
- [ ] 500+ races in DB → listing pagination handled, sitemap returns all in single XML (≤50KB acceptable)
- [ ] Slug exactly 80 chars after slugify → no truncation issue
- [ ] Title with only special chars (`@#$%`) → slugify returns "" → fallback to `race-<raceId>` slug

### Performance SLA

| Endpoint / Route | Target p95 | Cache |
|------------------|-----------|-------|
| `/giai-chay/` SSR | < 800ms (cold) / < 200ms (ISR hit) | ISR 1h |
| `/giai-chay/[slug]` SSR | < 1000ms (cold) / < 200ms (ISR hit) | ISR 1h/24h |
| `/giai-chay/[slug]/ket-qua` SSR | < 1500ms (cold) / < 300ms (ISR hit) | ISR 30min/24h |
| `/sitemap-races.xml` | < 2000ms (cold) | ISR 24h |
| `POST /api/admin/seo/sync-slugs` (manual) | < 60s for 200 races | No cache |
| Cron weekly run | < 60s total | No cache |

### Cache hit ratio target
- After warm-up (10 visits per page): ≥ 80% ISR hit rate
- Sitemap: 24h cache, 1 cold fetch per day

### 10x stability test (critical paths)

```typescript
// Critical: results page (race day potential traffic spike)
it('serves 10 concurrent requests to results page without inconsistency', async () => {
  const promises = Array.from({ length: 10 }, () =>
    request(frontendApp).get('/giai-chay/some-race-2026/ket-qua?course=10k')
  );
  const results = await Promise.all(promises);
  expect(results.every(r => r.status === 200)).toBe(true);
  // Verify response body consistent (same first BIB across all 10)
  const firstBibs = results.map(r => extractFirstBib(r.text));
  expect(new Set(firstBibs).size).toBe(1);
});

// Critical: sitemap (Googlebot may hit aggressively)
it('handles 10 concurrent sitemap requests', async () => { ... });
```

### Security checks

| Threat | Vector | Risk | Verification |
|--------|--------|------|--------------|
| Information disclosure: draft race leak | Direct URL access `/giai-chay/<draft-slug>` | HIGH | 404 returned (BR-30) |
| Open redirect via CTA URL | Manipulated `slug` in URL → CTA build URL → redirect external | MEDIUM | `buildSellingWebUrl()` validates slug pattern, no user input in URL construction |
| Admin endpoint privilege escalation | Non-admin trigger sync | MEDIUM | JwtAuthGuard + role check |
| SSRF in revalidate webhook | Backend POST untrusted URL | LOW | Hard-coded `FRONTEND_REVALIDATE_GIAICHAY_URL` env, no user input |
| Sitemap data exposure | Sitemap leaks draft race URLs | HIGH | BR-8 enforce — QC check XML output |
| JSON-LD injection | Race title with `</script>` → break LD JSON | MEDIUM | JSON.stringify with `escape` — Coder uses standard Next.js JSON serialization |
| Cron stampede DoS | Multi-pod trigger same time | LOW | Redis SETNX lock (BR-04) |

---

## 📌 Answers to Manager's PAUSE Conditions (từ file 00)

### Q1: Selling-web URL format exact

**BA proposal (Danny verify trong /5bib-plan):**
```
https://5bib.com/vi/events/{slug}_{raceId}?ref=seo-giai-chay&utm_source=organic&utm_medium=seo&utm_campaign=giai-chay
```
- Path `/vi/events/{slug}_{raceId}` — copy nguyên format trong PRD gốc Danny
- 4 UTM params + 1 `ref` param — đây là "1 chút khác" Danny đề cập
- Fallback nếu thiếu slug: `https://5bib.com/vi/events/{raceId}` (chỉ raceId)
- Centralize trong [frontend/lib/selling-web-url.ts](frontend/lib/selling-web-url.ts) — đổi format 1 chỗ apply toàn bộ

**Action Danny:** Confirm format trên trong `/5bib-plan` HOẶC đề xuất khác. Nếu không reply → Manager APPROVE PRD với format đề xuất, Coder implement.

### Q2: F-027 hub canonical pattern → reuse

✅ Verified trong [frontend/app/(main)/hub/[slug]/page.tsx:67-78](frontend/app/(main)/hub/[slug]/page.tsx):
```ts
const canonical = hub.seo.canonicalUrl || `https://5bib.com/hub/${hub.slug}`;
return { alternates: { canonical }, openGraph: { url: canonical, ... } }
```
F-036 áp dụng tương tự với `https://5bib.com/giai-chay/${slug}` (BR-14).

### Q3: 5bib.com root sitemap conflict

✅ Verified qua curl: `https://5bib.com/sitemap.xml` HTTP 200 (đã tồn tại). → BR-16 đặt tên `sitemap-races.xml` để KHÔNG conflict.

**Action follow-up (post-deploy):** Manager hoặc Danny ping 5Ticket team thêm reference vào root sitemap index nếu 5Ticket có sitemap index pattern. Không block F-036 launch.

### Q4: Cron failure handling + manual trigger spec

✅ Specified trong BR-04 ~ BR-07 + Backend endpoints section. Coder implement:
- Cron `@Cron('0 2 * * 0')` + SETNX lock + 3-retry exponential backoff
- Manual trigger `POST /api/admin/seo/sync-slugs` JwtAuthGuard + admin role
- Logs collection `seo_sync_logs` + `GET /api/admin/seo/sync-logs?limit=10`
- Admin UI `/admin/seo` show stats + sync button

### Q5: Province slug mapping ≥10 thành phố

✅ Specified trong BR-21 — 10 cities listed (ho-chi-minh, ha-noi, da-nang, da-lat, nha-trang, hai-phong, hue, can-tho, vung-tau, quy-nhon) + fallback `khac` bucket.

### Q6: Anti-pattern: zero `<form>` mua vé inline

✅ Specified trong BR-10, BR-11. QC mandate test: grep `<form` trong `frontend/app/(main)/giai-chay/**` — chỉ accept search/filter form local. Mọi CTA Mua vé MUST là `<a href>`, KHÔNG `<button onClick>`.

### Q7: Test scenario cron dry run

✅ Specified trong Testing Mandates "Cron behavior" section: 4 test cases (manual sync, concurrent lock, duplicate slug suffix, edge case title rỗng).

---

## 🛑 PAUSE Conditions còn lại — Cần Danny/Manager confirm

- [ ] **Selling-web URL format final** (Q1 trên) — Danny confirm trong `/5bib-plan` REVIEW
- [ ] **Cron schedule:** Sunday 02:00 GMT+7 — Danny confirm OK
- [ ] **Slugify lib:** `@sindresorhus/slugify` chưa có trong deps. Coder verify + PAUSE trước install
- [ ] **5Ticket coordination:** Sau khi Coder ship internal code, ai ping 5Ticket team thêm Vercel rewrite `/giai-chay/*` + `/sitemap-races.xml`? Manager coordinate hoặc Danny? — Manager flag để follow-up post-deploy.

---

## ✅ Status

- [x] DRAFT
- [x] 🔵 **READY** — sẵn sàng cho Manager `/5bib-plan`

---

## 🔗 Next step

Danny chạy: `/5bib-plan FEATURE-036-seo-subdirectory-giai-chay`

Manager sẽ review PRD này + ra verdict APPROVED / NEEDS_REVISION / REJECTED + viết Scope Lock cho Coder trong `02-manager-plan.md`.
