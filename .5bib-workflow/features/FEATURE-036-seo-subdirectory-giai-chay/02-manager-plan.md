# FEATURE-036: Plan Review

**Status:** ✅ APPROVED (amended 2026-05-16 — see "Scope Amendment" section)
**Reviewed:** 2026-05-15
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 🔄 Scope Amendment 2026-05-16

Trong quá trình Coder demo preview localhost, Danny clarify thêm 2 yêu cầu **CỐT LÕI** chưa thể hiện trong PRD/Plan ban đầu:

### Requirement A (đã ship — accept scope creep)
> *"mục tiêu chính khi làm phần này là list được cả ra các giải đang bán trên 5bib.com và lấy bằng cách query từ DB Legacy của 5bib ra"*

**Diff:** Listing `/giai-chay/` MUST gộp 2 sources:
- MongoDB races (phase vận hành) — đã có trong plan
- MySQL platform races phase BÁN VÉ (status=GENERATED_CODE) — **MỚI**

**Implementation đã ship** (Coder retroactive request):
- Reuse F-033 endpoint `GET /api/promo-hubs/races-on-sale?limit=20`
- Frontend `getAllRaces()` merge cả 2 sources + dedupe by title
- RaceCard branch: on-sale source → external `<a href>` selling-web; mongodb → internal `<Link>`
- Listing header count tách 3: bán vé / sắp diễn ra / đã kết thúc

**Manager verdict trên scope creep:** ✅ **ACCEPTED**. Lý do:
1. Đây là correction về scope cốt lõi (Danny intent từ đầu, không phải freelance bloat)
2. Reuse F-033 endpoint sẵn có → integration cost thấp
3. Không break existing 30 BR — chỉ extend BR-08 source list
4. Test impact: QC sẽ verify dual-source listing render
5. KHÔNG được làm lần nữa — lần sau scope thay đổi Coder phải PAUSE + Manager amend trước khi code.

### Requirement B (chưa ship — defer to FEATURE-037)
> *"đối với các giải đang diễn ra đó là mày đi xem cái link kết quả của nó đâu thì gán vào đúng theo giải"*

> *"Cái này sẽ cải thiện gì khi mày có trang danh sách giai-chay rồi khi ấn vào 1 bản ghi thì dẫn thẳng về trang bán vé 5bib?"*

**Diff:** Đề xuất race BÁN VÉ phải có **internal detail page** `/giai-chay/[slug]` (KHÔNG link thẳng external) để:
- Hưởng SEO juice cho race đang bán
- Google index 17+ trang content rich (description, courses, organizer)
- User search "Đăng ký <race>" → land trên `5bib.com/giai-chay/<slug>` → click CTA → mua vé

**Cost ước tính:** ~3h dev (BE extend F-033 endpoint trả full data + FE detail page handle dual source).

**Manager verdict:** 🛑 **DEFER → FEATURE-037**. Lý do:
1. Requires backend extension (new `GET /api/promo-hubs/races-on-sale/by-url-name/:urlName`)
2. Requires extending `RaceReadonly` entity với additional MySQL columns (description, organizer_name, course join)
3. Requires schema decision: courses from `race_course_distances` table or different MySQL table — needs MySQL platform DB exploration
4. Scope đáng kể, không phải scope creep small → tách feature cleaner
5. F-036 listing đã đạt mục tiêu A (17 on-sale visible) → ship F-036 trước, deploy giá trị ngay
6. F-037 mở ngay sau F-036 deploy với BA → Plan → Code → QC riêng

### Implementation đã ship trong F-036 (scope creep accepted)

**Frontend files NEW/MODIFIED (ngoài Scope Lock gốc):**
- ✏️ `frontend/lib/seo-api.ts` — thêm `fetchOnSaleRaces()`, `fetchMongoRaces()`, `getResultPageUrl()`, `getCourseLeaderboardUrl()`, `unwrap()` helper
- ✏️ `frontend/components/giai-chay/RaceCard.tsx` — branch render mongodb vs on-sale source
- ✏️ `frontend/components/giai-chay/RaceCTA.tsx` — ended/live CTA → external `result.5bib.com/races/[slug]` (Danny req: link kết quả thật)
- ✏️ `frontend/app/(main)/giai-chay/page.tsx` — 3-bucket count + sort priority on-sale → vận hành → ended
- ✏️ `frontend/app/(main)/giai-chay/[raceSlug]/ket-qua/page.tsx` — thêm CTA "Xem leaderboard chi tiết trên 5BIB" → external course leaderboard
- ✏️ `frontend/app/sitemap-races.xml/route.ts` — skip on-sale races (no internal page yet)
- ✏️ `frontend/.env.local` worktree — `NEXT_PUBLIC_ASSET_PREFIX=` override cho local dev (don't sync to main)

**Backend:** KHÔNG đụng — reuse F-033 endpoint as-is.

**Test impact:** QC MUST verify:
- Listing render 17 on-sale với green "Đang bán vé" badge ở top
- On-sale card click → external selling-web URL with UTM (BR-12 format)
- Sitemap KHÔNG chứa on-sale slugs (avoid 404 SEO penalty)
- Ended/live race CTA → external `result.5bib.com/races/[slug]`
- Count text "Hiện có X bán vé, Y sắp diễn ra, Z đã kết thúc"

### F-037 spec preview (Manager note for next /5bib-init)

**Title:** `FEATURE-037: on-sale race detail page (MySQL platform integration)`

**Goal:** Internal SEO detail page cho 17+ race BÁN VÉ. Click on-sale card → land `5bib.com/giai-chay/[urlName]` (NOT external thẳng) — render rich content from MySQL → CTA "Đăng ký ngay" → selling-web.

**Backend scope:**
- NEW endpoint `GET /api/promo-hubs/races-on-sale/by-url-name/:urlName` — full race detail từ MySQL platform
- Extend `RaceReadonly` entity: thêm `description`, `organizer_name`, `event_end_date`, `register_url`, …
- Possibly join `race_course_distances` table (or equivalent) cho course list
- Schema audit needed: MySQL `races` table có những cột gì usable cho SEO content?

**Frontend scope:**
- `getRaceBySlug()` fallback: MongoDB miss → try MySQL on-sale endpoint
- Race detail page handle dual source — render placeholder/skeleton cho missing fields (courses optional)
- RaceCard on-sale source → internal `<Link>` thay vì external (revert F-036 amendment)
- Sitemap include on-sale slugs (now that internal page exists)

**Effort:** ~3h dev + ~2h QC = ~5h total. Worth it for SEO impact (17 race × 6-8 unique keywords per race = ~100+ new SERP opportunities).

**Pre-conditions for /5bib-init F-037:**
- F-036 deployed PROD successful
- Danny confirm MySQL `races` table columns available (or accept schema discovery as part of F-037 BA phase)

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` (READY status, 8 Danny decisions chốt)
- [x] Đã đọc `01-ba-prd.md` toàn bộ — 30 BR + 5 screens full states + Technical Mandates + Testing Mandates
- [x] Đã đọc memory: `architecture.md` (F-027 hub model + Cron patterns), `conventions.md` (Cache key/Atomic op/DTO/SDK regen), `known-issues.md` (no conflict)
- [x] Spot-check code thật:
  - `frontend/app/api/revalidate-hub/` route exists → reuse pattern cho `revalidate-giai-chay`
  - 6 existing `@Cron` precedents (timing-alert, race-master-delta-sync, share-nurture, etc.) → BA's cron design align với codebase
  - F-027 canonical pattern verified [hub/[slug]/page.tsx:67-78](frontend/app/(main)/hub/[slug]/page.tsx)
  - F-027 internal-urls helper pattern verified — F-036 dùng tương tự cho `selling-web-url.ts`

---

## ✓ PRD Validation Checklist

### Completeness
- [x] User Stories đầy đủ với 5 Personas chuẩn (Anonymous Visitor, Race Organizer, 5BIB Back-Office Admin, Google Crawler) — Anonymous Visitor coverage 5 stories (search/click/CTA active/CTA ended/results) là điểm strong
- [x] Business Rules đánh số BR-01 → BR-30, grouped theo concern
- [x] Tất cả 7 PAUSE conditions của Manager (file 00) đã được BA trả lời explicit ở section "Answers to Manager's PAUSE"
- [x] UI states đầy đủ cho 5 screens — loading/empty/404/data/error/submitting đủ. Đặc biệt PRD distinguish 404 reasons (slug not found vs draft race vs pre_race chưa có kết quả)

### Technical correctness vs codebase
- [x] **DB change phù hợp current schema** — slug field + text index ĐÃ CÓ. KHÔNG cần migration schema. Cron only writes data backfill (idempotent `$set`).
- [x] Endpoint design REST convention — `POST /api/admin/seo/sync-slugs` + `GET /api/admin/seo/sync-logs?limit=10` đúng pattern `/api/admin/*`
- [x] Cache key pattern khớp `[resource]:[id]:[variant]` — `cron:seo-slug-sync:lock` follow F-018/F-019 SETNX precedent
- [x] **KHÔNG đụng MySQL platform DB** — confirmed
- [x] Generated SDK refresh được flag (`pnpm --filter admin generate:api` sau khi backend thêm admin endpoint)
- [x] `assetPrefix` KHÔNG đổi — BR-14 chốt giữ F-027 pattern. PAUSE flag rõ trong Coder section.

### Security
- [x] `JwtAuthGuard` + role `admin` cho `/api/admin/seo/*` endpoints
- [x] IDOR: SEO routes public read-only → no per-user data leak vector
- [x] Sensitive field không leak — DTO response chỉ public race fields (test phase liệt kê 7 field cần verify NOT leaked)
- [x] CTA URL no user input injection — slug từ DB, raceId từ DB, helper centralize
- [x] SSRF mitigation cho revalidate webhook — hard-coded env URL

### Performance
- [x] SLA có số cụ thể — 7 routes có target p95
- [x] Cache strategy — BR-24 ma trận ISR per-route + per-status (cold/warm)
- [x] Migration không cần (slug field đã có)
- [x] Anti-stampede SETNX lock cho cron multi-pod

### Testability
- [x] Unhappy paths cụ thể — 40+ test cases liệt kê across validation/anti-pattern/status/canonical/JSON-LD/sitemap/province/cron/admin-auth/boundary
- [x] Critical Danny mandate test — grep `<form` zero hits + CTA `href` pattern validation
- [x] 10x stability test cho results page + sitemap
- [x] Concurrency: cron SETNX lock test

---

## 📊 Cross-check với memory

### Architecture impact

- Feature thêm: weekly cron `RaceSeoSlugSyncCron` dưới `RacesModule`, SEO routes `/giai-chay/*` trên frontend, admin `/admin/seo` UI
- KHÔNG phá vỡ flow hiện tại. Mở rộng F-027 routing pattern (Vercel rewrite cross-app).
- **Architecture diagram update sau deploy:** thêm "Weekly cron RaceSeoSlugSync → revalidate-giai-chay webhook" branch dưới Races domain.

### Convention impact

- Cron pattern reuse — đã có 6 precedent (timing-alert/race-master-delta/share-nurture).
- SETNX anti-stampede lock — đã có F-018/F-019 precedent.
- Revalidate webhook — F-027 `/api/revalidate-hub` precedent.
- `assetPrefix` cross-domain — F-027 đã ship pattern.
- 5Ticket Vercel rewrite coordination — F-027 đã ship doc reference.

→ **KHÔNG có pattern mới minted** trong F-036. Tất cả tái sử dụng pattern hiện có. → conventions.md không cần update mới sau deploy.

### Known issues impact

- F-029 leftover TD-F029-NEW-03 (global search có thể leak draft races) — F-036 BR-30 đảm bảo draft KHÔNG leak qua `/giai-chay/*`. Manager note: dù không resolve F-029 issue (search endpoint riêng), F-036 tránh được vector tương tự cho route mới.
- KHÔNG có known issue blocking F-036.

---

## ⚠️ Clarifications cho Coder (KHÔNG block APPROVE, nhưng phải đọc)

### #1 — Sitemap routing implementation

BA PRD mong muốn URL output `/sitemap-races.xml` (BR-16). Có 2 cách Coder implement, chọn 1:

**Option A (khuyến nghị):** Custom route handler
- File: `frontend/app/sitemap-races.xml/route.ts` (Next.js custom XML route)
- Export `async function GET()` returns XML string + `Content-Type: application/xml`
- Pros: URL chính xác `/sitemap-races.xml`, KHÔNG cần Vercel rewrite extra
- Cons: tự code XML serialization (~30 dòng)

**Option B (Next.js native):** `MetadataRoute.Sitemap`
- File: `frontend/app/sitemap.ts` ở root → output `/sitemap.xml` (NHƯNG conflict với root 5bib.com sitemap nếu Vercel rewrite `/sitemap.xml`)
- HOẶC `frontend/app/(main)/giai-chay/sitemap.ts` → output `/giai-chay/sitemap.xml`, sau đó 5Ticket Vercel rewrite `5bib.com/sitemap-races.xml` → `result-fe.5bib.com/giai-chay/sitemap.xml`
- Pros: framework helper, type-safe
- Cons: cần extra rewrite rule

→ **Manager đề xuất Option A** vì giảm dependency 5Ticket coordination. Coder có quyền chọn — nếu chọn Option B phải document trong `03-coder-implementation.md`.

### #2 — Selling-web URL format final

BA propose format trong PRD section "Answers Q1":
```
https://5bib.com/vi/events/{slug}_{raceId}?ref=seo-giai-chay&utm_source=organic&utm_medium=seo&utm_campaign=giai-chay
```

Danny said "URL khác URL của trang selling hiện tại 1 chút nhé" trong file 00 Q6. Manager interpret: format trên (5 params extra = "1 chút khác") = ACCEPT. Nếu Danny không phản hồi trong window code/QC → Coder ship với format này. Helper centralize trong `frontend/lib/selling-web-url.ts` → đổi 1 chỗ apply toàn bộ.

**Action:** Manager note để khi Danny review demo trước QC, nếu Danny không OK format → easy update.

### #3 — Cron schedule `0 2 * * 0` (Sunday 02:00)

Danny chưa phản hồi (Manager file 00 PAUSE Q "Cron schedule: Sunday 02:00 GMT+7 — Danny confirm OK"). Manager interpret: 02:00 Sunday low-traffic, anti-stampede SETNX safe → ACCEPT default. Coder có thể PAUSE confirm nếu Danny tham gia mid-code.

### #4 — 5Ticket Vercel rewrite coordination

OUT_OF_SCOPE codebase (rewrite trong 5Ticket team's repo). Manager note: SAU KHI Coder ship + QC pass, **Manager hoặc Danny** ping 5Ticket team thêm 2 rewrite rules:
```
5bib.com/giai-chay/:path*  →  result-fe.5bib.com/giai-chay/:path*
5bib.com/sitemap-races.xml →  result-fe.5bib.com/sitemap-races.xml
```
Trước khi 5Ticket merge rewrite → F-036 chỉ work qua direct `result-fe.5bib.com/giai-chay/*` (testable internal).

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ được thay đổi file/folder dưới đây. Đụng ngoài = scope creep → STOP, hỏi Manager.

### Backend (`backend/`)

**Files mới:**
- ➕ `src/modules/races/services/seo-slug-sync.service.ts` — core sync logic
- ➕ `src/modules/races/jobs/seo-slug-sync.cron.ts` — `@Cron('0 2 * * 0')` wrapper
- ➕ `src/modules/races/schemas/seo-sync-log.schema.ts` — Mongoose schema cho audit log collection `seo_sync_logs`
- ➕ `src/modules/admin/seo/admin-seo.controller.ts` — `POST /api/admin/seo/sync-slugs` + `GET /api/admin/seo/sync-logs`
- ➕ `src/modules/admin/seo/admin-seo.module.ts` — module wiring
- ➕ `src/modules/admin/seo/dto/seo-sync-result.dto.ts` — response DTO
- ➕ `src/modules/admin/seo/dto/seo-sync-log.dto.ts` — log entry DTO
- ➕ `src/modules/races/services/seo-slug-sync.service.spec.ts` — unit tests
- ➕ `src/modules/races/utils/slugify.ts` — slugify helper (hoặc dùng lib — PAUSE confirm Danny nếu install dep mới)
- ➕ `src/modules/races/utils/slugify.spec.ts` — unit tests cho slugify edge cases

**Files modify:**
- ✏️ `src/modules/races/races.module.ts` — register `RaceSeoSlugSyncCron`, `SeoSlugSyncService`, `SeoSyncLog` schema
- ✏️ `src/modules/app.module.ts` — import `AdminSeoModule` (CHỈ thêm vào imports[], KHÔNG đụng config khác)

**KHÔNG đụng:**
- ❌ `src/modules/races/schemas/race.schema.ts` — slug field + index đã có
- ❌ `src/modules/races/races.service.ts` — main service (chỉ inject `SeoSlugSyncService` vào module, không sửa existing service methods)

### Frontend (`frontend/`)

**Files mới:**
- ➕ `app/(main)/giai-chay/layout.tsx`
- ➕ `app/(main)/giai-chay/page.tsx`
- ➕ `app/(main)/giai-chay/[raceSlug]/page.tsx`
- ➕ `app/(main)/giai-chay/[raceSlug]/not-found.tsx`
- ➕ `app/(main)/giai-chay/[raceSlug]/ket-qua/page.tsx`
- ➕ `app/(main)/giai-chay/thanh-pho/[citySlug]/page.tsx`
- ➕ `app/(main)/giai-chay/thanh-pho/[citySlug]/not-found.tsx`
- ➕ `app/sitemap-races.xml/route.ts` (Option A) HOẶC `app/(main)/giai-chay/sitemap.ts` (Option B)
- ➕ `app/api/revalidate-giai-chay/route.ts` — POST receiver từ backend cron (token-gated)
- ➕ `lib/seo-api.ts` — `getAllRaces`, `getRaceBySlug`, `getRaceResults`, `getCourseStats` helpers
- ➕ `lib/selling-web-url.ts` — `buildSellingWebUrl(slug, raceId)` helper
- ➕ `lib/province-normalize.ts` — BR-21 map + `normalizeProvince` + `getCitySlug` + `getCityDisplayName`
- ➕ `lib/seo-structured-data.ts` — `buildSportsEventJsonLd`, `buildBreadcrumbJsonLd` helpers
- ➕ `components/giai-chay/RaceCard.tsx` — Server Component
- ➕ `components/giai-chay/RaceLandingHero.tsx` — Server Component
- ➕ `components/giai-chay/RaceCTA.tsx` — Server Component (CTA per status, NO onClick)
- ➕ `components/giai-chay/CountdownTimer.tsx` — `'use client'`
- ➕ `components/giai-chay/ResultsTable.tsx` — Server Component
- ➕ `components/giai-chay/ResultsSearch.tsx` — `'use client'` (filter local)
- ➕ `components/giai-chay/CourseTabs.tsx` — Server Component với URL search params
- ➕ `components/giai-chay/RaceListFilters.tsx` — Server Component với URL search params (chọn Server > Client để giữ ISR)
- ➕ `components/giai-chay/SimilarRacesSidebar.tsx` — Server Component (BR-27)

**Files modify:**
- ❌ **TUYỆT ĐỐI KHÔNG SỬA** `next.config.ts` — `assetPrefix` giữ nguyên `https://result.5bib.com` (BR-14)
- ❌ KHÔNG đụng `frontend/app/(main)/hub/*` — F-027 code, reuse helper pattern không sửa code

### Admin (`admin/`)

**Files mới:**
- ➕ `src/app/(dashboard)/admin/seo/page.tsx` — manual trigger UI
- ➕ `src/app/(dashboard)/admin/seo/SyncSlugsButton.tsx` — `'use client'` với TanStack Query mutation

### SDK regenerated
- 🔄 `admin/lib/api-generated/*` — auto via `pnpm --filter admin generate:api`

### Env vars (PROD setup — Danny operations)
- ➕ Backend: `FRONTEND_REVALIDATE_GIAICHAY_URL=http://5bib-result-frontend:3002/api/revalidate-giai-chay`
- ✅ Backend: `REVALIDATE_TOKEN` đã có (reuse F-027 token)

---

## 🔧 Tech approach (đề xuất, Coder có thể tinh chỉnh)

### Slugify implementation

**Option A (recommended):** Tự code `slugify.ts` utility — KHÔNG cần install dep mới.
```typescript
// Pseudocode — Coder implement
function slugify(input: string): string {
  return input
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // strip diacritics
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')              // Vietnamese đ
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')                        // non-alphanumeric → -
    .replace(/^-+|-+$/g, '')                            // trim -
    .slice(0, 80);                                      // truncate (TODO: at word boundary)
}
```

**Option B:** Install `@sindresorhus/slugify`. PAUSE confirm Danny.

→ Manager đề xuất Option A — tránh install dep, code Vietnamese-aware logic dễ test.

### Cron service structure

```typescript
@Injectable()
export class SeoSlugSyncService {
  async syncSlugs(triggeredBy: 'cron' | 'manual', userId?: string): Promise<SeoSyncResult> {
    // 1. SETNX lock check
    // 2. Find races với slug = null/empty
    // 3. Generate slug per race (slugify + uniqueness check + suffix-2/3)
    // 4. updateOne per race
    // 5. Collect paths to revalidate
    // 6. POST frontend revalidate endpoint
    // 7. Insert seo_sync_logs entry
    // 8. Release lock + return summary
  }
}

@Injectable()
export class SeoSlugSyncCron {
  constructor(private readonly service: SeoSlugSyncService) {}
  @Cron('0 2 * * 0', { name: 'seo-slug-sync' })
  async handleCron() { await this.service.syncSlugs('cron'); }
}
```

Pattern reuse F-018/F-019 SETNX + service-spawn-by-cron.

### Frontend revalidate webhook

Reuse F-027 pattern: clone `frontend/app/api/revalidate-hub/route.ts` → `revalidate-giai-chay/route.ts`. Same token-gated POST, parse `paths[]` body, call `revalidatePath(p)` per item.

### CTA helper centralize

```typescript
// frontend/lib/selling-web-url.ts
export function buildSellingWebUrl(slug: string | null, raceId: string): string {
  const path = slug ? `${encodeURIComponent(slug)}_${raceId}` : raceId;
  const params = new URLSearchParams({
    ref: 'seo-giai-chay',
    utm_source: 'organic',
    utm_medium: 'seo',
    utm_campaign: 'giai-chay',
  });
  return `https://5bib.com/vi/events/${path}?${params}`;
}
```

---

## 🛑 PAUSE points cho Coder

Trước khi làm các bước sau, Coder DỪNG và confirm với Danny (hoặc Manager):

- 🛑 **Trước khi `pnpm install` slugify lib** — Manager đề xuất tự code (Option A trên). Nếu Coder muốn dùng lib → PAUSE confirm Danny.
- 🛑 **Trước khi enable cron schedule lần đầu trên DEV/PROD** — confirm với Danny `0 2 * * 0` OK chưa.
- 🛑 **Nếu phát hiện cần đụng `next.config.ts` `assetPrefix`** — STOP. KHÔNG được sửa. BR-14 chốt giữ F-027 pattern. Nếu thấy nhu cầu → hỏi Manager update plan.
- 🛑 **Nếu phát hiện cần đụng `frontend/app/(main)/hub/*` (F-027 code)** — STOP, hỏi Manager.
- 🛑 **Nếu phát hiện slug đã tồn tại nhưng sai (vd: dấu Tiếng Việt, uppercase)** — KHÔNG tự ý sửa. Chỉ generate cho `slug = null/empty`. Race có slug "sai" giữ nguyên.
- 🛑 **Khi viết `not-found.tsx`** — confirm pattern với F-027 hub's `not-found.tsx` ở `frontend/app/(main)/hub/[slug]/not-found.tsx`.
- 🛑 **Trước khi commit lần đầu** — verify ZERO `<form>` xử lý mua vé trong `app/(main)/giai-chay/**`. Grep self-check.

---

## 🧪 Unit test BẮT BUỘC

Coder KHÔNG được mark feature `READY_FOR_QC` nếu thiếu các test sau:

### `seo-slug-sync.service.spec.ts`
- [ ] `syncSlugs()` — happy path: 3 races có slug=null → 3 slugs generated + revalidate gọi đúng paths
- [ ] `syncSlugs()` — race có slug đã set → KHÔNG đụng (skip)
- [ ] `syncSlugs()` — duplicate slug collision → append `-2`, `-3` (BR-03)
- [ ] `syncSlugs()` — concurrent run: lock acquired → return early
- [ ] `syncSlugs()` — frontend revalidate fail (5xx) → 3 retry exponential backoff (BR-06)
- [ ] `syncSlugs()` — race title empty/null → log warning, KHÔNG generate slug (edge case)
- [ ] Log entry created with correct `triggeredBy` (`cron` vs `manual`)

### `slugify.spec.ts`
- [ ] Strip Vietnamese diacritics: "Đà Lạt" → "da-lat"
- [ ] Strip `đ`/`Đ` → "d"/"D"
- [ ] Lowercase + kebab: "VnExpress Marathon HCM" → "vnexpress-marathon-hcm"
- [ ] Special chars: "Test@2026!" → "test-2026"
- [ ] Collapse consecutive `-`: "test--abc" → "test-abc"
- [ ] Trim: "-test-" → "test"
- [ ] Max 80 chars truncate
- [ ] Empty/null input → returns "" (callers handle)
- [ ] Only special chars: "@@@" → ""

### `admin-seo.controller.spec.ts`
- [ ] `POST /sync-slugs` — admin role → 200 + summary
- [ ] `POST /sync-slugs` — merchant role → 403
- [ ] `POST /sync-slugs` — no auth → 401
- [ ] `GET /sync-logs?limit=5` — admin role → returns 5 most recent
- [ ] `GET /sync-logs?limit=5` — no auth → 401

### Frontend (Coder discretion — Playwright sẽ cover bởi QC)
- Mininum: 1 unit test cho `buildSellingWebUrl()` happy path + edge case (slug=null fallback) + `province-normalize.ts` 10 test cases per BR-21

---

## 📊 Verdict

> ### ✅ APPROVED — Coder có thể bắt đầu

PRD chất lượng cao — 30 BR numbered, full UI states, anti-pattern checks rõ, Testing Mandates exhaustive. 4 clarifications above KHÔNG block — Coder có guidance + Manager note để follow-up.

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] **Yes** — Coder bắt đầu, theo Scope Lock + 7 PAUSE points + 4 clarifications above.

---

## 🔗 Next step

Danny chạy:
```
/5bib-code FEATURE-036-seo-subdirectory-giai-chay
```

Coder (5bib-fullstack-engineer) sẽ:
1. Đọc 00 + 01 + 02 (file này)
2. Đọc memory conventions + codebase-map cho race module + F-027 hub
3. Implement theo Scope Lock + Tech approach đề xuất
4. PAUSE confirm Danny tại 7 PAUSE points
5. Viết unit test theo checklist trên
6. Output `03-coder-implementation.md` status `READY_FOR_QC`
