# 5BIB Result — System Architecture

> **Owner:** 5bib-manager
> **Last updated:** 2026-05-03 (bootstrap)
>
> Sơ đồ kiến trúc hệ thống. Update khi thêm service/dependency mới hoặc đổi data flow.

---

## 🏗️ High-level Architecture

```
                         ┌──────────────────┐
                         │   GoDaddy DNS    │
                         │ → 157.10.42.171  │
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │ nginx + Let's    │
                         │ Encrypt SSL      │
                         └────────┬─────────┘
                                  │
       ┌──────────────────────────┼──────────────────────────┐
       │                          │                          │
  ┌────▼─────────┐         ┌──────▼─────────┐        ┌──────▼─────────┐
  │ result-fe-   │         │ result-admin-  │        │ result-dev     │
  │ dev.5bib.com │         │ dev.5bib.com   │        │ .5bib.com      │
  │ (frontend    │         │ (admin Next.js │        │ (backend API)  │
  │  Next.js)    │         │  port 3000)    │        │ port 8081      │
  │ port 3082→   │         │ port 3083→3000 │        │                │
  │ 3002         │         │                │        │                │
  └─────┬────────┘         └───────┬────────┘        └───────┬────────┘
        │                          │                         │
        │     /api/* proxy         │   /api/* proxy          │
        │   (runtime, NOT build)   │ (runtime, NOT build)    │
        └──────────────────────────┴─────────────────────────┘
                                  │
                  ┌───────────────┼────────────────┐
                  │               │                │
            ┌─────▼──────┐  ┌────▼──────┐    ┌────▼─────────┐
            │ MongoDB    │  │  Redis    │    │  AWS S3      │
            │ (host)     │  │ (cache)   │    │ (BIB photos, │
            │ port 27018 │  │           │    │  result imgs)│
            └────────────┘  └───────────┘    └──────────────┘
            host.docker.internal:27018
```

### Khác biệt với template generic
- **KHÔNG có MySQL platform DB** — project 5bib-result chỉ dùng MongoDB
- **Auth = Logto** (không phải custom JWT) — module `logto-auth/`
- **3 services flat** — `backend/`, `frontend/`, `admin/` (không phải `apps/api`, `apps/admin`)
- **MongoDB chạy trên host** (port 27018), containers access qua `host.docker.internal`
- **Runtime proxy** — `app/api/[...proxy]/route.ts` ở admin và frontend, KHÔNG dùng Next.js rewrites build-time

---

## 🔄 Data Flow per Domain

### Race Status Lifecycle
```
draft → pre_race → live → ended
  │        │        │       │
  │        │        │       └─ Public read-only
  │        │        └────── Real-time updates
  │        └─────────────── Pre-event prep
  └──────────────────────── ⚠️ Auto-excluded từ public API (frontend homepage)
                              Admin có thể thấy mọi status
```

### Athlete Result Data Flow
```
Admin upload CSV/Excel
   │
   ▼
[POST /api/race-result/import?raceId=]
   │
   ▼
[ResultService.importBatch()]
   │
   ├─▶ Parse rows (Chiptimes/Paces/OverallRanks là JSON strings)
   ├─▶ Insert MongoDB
   └─▶ Update race-master-data Redis cache
              │
              ▼
       Public frontend reads từ Redis
       (parse JSON strings → split times array dùng course checkpoint config)
```

### Result Image Generation Flow (v1.0)
```
[POST /race-results/result-image/:raceId/:bib]
   │
   ▼ (multipart/form-data)
[ResultImageService] (@napi-rs/canvas — KHÔNG headless browser)
   │
   ├─▶ Acquire lock: SETNX render-lock:[raceId]:[bib]:[hash] (60s)
   ├─▶ Render 1080×1350px PNG
   │     - Background: preset gradient OR custom upload
   │     - Logo: backend/assets/logo_5BIB_white.png
   │     - Fonts: Inter + Be Vietnam Pro (TTFs in backend/assets/fonts/)
   │     - Embed QR + share links từ RESULT_PUBLIC_URL
   │
   ├─▶ Upload S3 (prefix: result-images/, lifecycle 24h)
   ├─▶ INCR share-count:[raceId] + bib-count:[raceId]:[bib]
   └─▶ Return URL
```

### Discover Preview Cache Flow (FEATURE-001 — timing-alert)
```
Admin paste apiUrl trong race edit form
   │
   ▼ (Frontend: DiscoverPreviewPanel debounce 800ms)
POST /timing-alert/admin/discover-checkpoints (existing)
   │
   ▼
[CheckpointDiscoveryService.discover()]
   ├─▶ fetchRaceResults(apiUrl) — RR vendor API
   ├─▶ Sample 10 athletes → Schema-from-1 (Object.keys, ≥80% consistency threshold)
   │     ├─ Consistent → trust vendor schema (luôn full keys; value="" cho unreached)
   │     └─ Inconsistent → fallback aggregate (coverage% across all athletes)
   ├─▶ Filter sentinel keys (DNS/DNF/DSQ)
   ├─▶ Order: median time of finishers (≥5) > insertion order JSON
   └─▶ Return DetectedCheckpoint[]
   │
   ▼  parallel: backend background path (cho future cron pre-warm)
[CheckpointDiscoveryService.discoverAndCachePreview(raceId, courseId)]
   │
   ├─▶ Acquire lock: SETNX master:discover-lock:[raceId]:[courseId] (TTL 30s)
   │     ├─ acquired → continue
   │     └─ lock-held → skip + log warn (BR-06: 10x concurrent → only 1 fetches)
   ├─▶ discover() → success → cache discover-preview:[raceId]:[courseId] (TTL 1h)
   ├─▶ discover() → error → cache error JSON (TTL 60s, shorter for retry)
   └─▶ finally: DEL lock
   │
   ▼
GET /timing-alert/admin/discover-preview/:courseId → reads cache (or null/error)
   │
   ▼
[Admin UI: BR-09 MERGE preserve names]
DiscoverPreviewPanel onSuccess:
   ├─▶ existingByKey = Map<key, existingCheckpoint> from current course config
   ├─▶ For each detected checkpoint:
   │     ├─ existing → preserve name (BTC override), update distance only if BTC chưa set
   │     └─ new → use detected name (raw key)
   └─▶ Render 5-col mini editable table (key / name / distance / distanceKm / actions)
```

**Key design decisions:**
- Frontend-driven debounce thay vì backend event hook — tránh circular DI giữa RacesModule ↔ TimingAlertModule
- Set `value=""` thay vì delete keys khi filter Chiptimes/Guntimes — match real RR vendor schema (always full keys)
- Schema-from-1 sampling vs full aggregate — O(1) check, fallback defensive cho vendor lạ
- Cache key prefix `discover-preview:` (không namespace `master:`) — tech debt acceptable, post-pilot có thể migrate

### Auth Flow (Logto)
```
User → /login or /sign-in
   │
   ▼
Logto OAuth flow → /callback
   │
   ▼
[logto-auth module] verify + issue session
   │
   ▼
Frontend nhận session cookie
   │
   ▼
Mọi protected request → Logto guard verify
```

---

## 🔌 Integration Points

| External Service | Purpose | Module / File |
|------------------|---------|---------------|
| AWS S3 | BIB photos, result images, sponsor logos | `backend/src/modules/aws.config.ts` + `upload/` |
| Logto | Auth (OAuth/OIDC) | `backend/src/modules/logto-auth/` |
| MongoDB | Main DB | host port 27018 (qua `host.docker.internal`) |
| Redis | Cache, locks, counters | xem Redis Keys Registry dưới |
| GitHub Container Registry | Docker images | `ghcr.io/5solution/5bib-result/*` |
| GitHub Actions | CI/CD | `.github/workflows/build-and-deploy.yml` |

---

## 🔐 Security Boundaries

```
[Public routes]                       [Authenticated routes]              [Admin-only routes]
  /races/[slug]                          /api/me/*                            /api/admin/*
  /races/[slug]/ranking/[courseId]       /api/articles/[slug]/helpful         /api/admin/races/*
  /races/[slug]/[bib]                                                          /api/admin/results/*
  / (homepage)                                                                 /api/sponsors (admin write)
  /chip-verify
  /solution, /solution-5solution, /solution-5sport
  /calendar, /landing
   ─ no auth required                  ─ Logto session                     ─ Logto + role check
   ─ rate limit (Redis ratelimit:*)    ─ owner check                       ─ admin role required

⚠️ draft races → auto-excluded từ public API
```

---

## 📐 Service Decomposition (NestJS modules — 35 modules)

> **Updated 2026-05-13** post-FEATURE-027: 35 modules (33 from F-024-cluster + PromoHubModule + PromoHubAnalyticsModule). F-027 modules are INDEPENDENT (ZERO cross-module Nest DI from existing) — sections fetch races/sponsors/race-results via HTTP at frontend SSR layer, not via service injection.

```
AppModule
│
├── # Foundation
│   ├── DatabaseModule (MongoDB Mongoose)
│   ├── RedisModule
│   └── ConfigModule (env validation)
│
├── # Auth
│   ├── LogtoAuthModule         # Logto OAuth/OIDC. 3 permissions all/admin/staff. LogtoStaffGuard new F-024. ⚠ HIGH-AUTH-01 LogtoAdminGuard token-expiry race tests missing.
│   ├── UsersModule             # ⚠ 0 tests
│   └── ApiKeysModule           # ⚠ 0 tests (sensitive — API keys auth)
│
├── # Race Domain (CORE)
│   ├── RacesModule             # Race CRUD, course, checkpoints. F-019: +awardsCompoundingMode + bracketSource race-level read pattern. F-006: CourseMapService GPX/KML parse + Douglas-Peucker simplify + Leaflet integration.
│   ├── RaceResultModule        # ⭐ Results + Result Image Creator. ⚠ HIGH-RR-01 missing race.status guard on public list endpoint (draft leak risk — F-029 fix).
│   ├── RaceMasterDataModule    # Master data sync (Redis cache, MySQL fallback). F-019 v2: +AthleteDobReadonly entity (Option B isolation) + ageOnRaceDay computed. ⚠ 0 tests despite critical sync cron paths.
│   ├── TimingModule
│   ├── TimingAlertModule       # ⭐ FEATURE-001/002/010: simulator + scenarios + checkpoint-discovery + miss-detector + reset/poll. ⚠ CRIT-04 SSRF in RaceResultApiService.fetchRaceResults + checkpoint-discovery.service + timing-alert-poll.service (Danny defer 2026-05-12 — vendor IP whitelist FW level).
│   ├── CertificatesModule      # @napi-rs/canvas PDF gen pattern (reused by F-019 awards-pdf).
│   └── AwardsModule            # ⭐ FEATURE-019: 11 services + 2 schemas + 7 DTOs. Path A primary + Path B vendor cross-check (Pattern H VENDOR_MISMATCH). 8-state forward-only machine + APPEND-ONLY audit. Cross-module DI: race-master-data + races + race-result + timing-alert. 4 Redis keys awards:* + S3 awards-pdf/ Lifecycle Rule 5. ⚠ HIGH-AW-01 TD-F019-MULTITENANT pre-existing.
│
├── # Medical (F-018)
│   └── MedicalIncidentsModule  # ⭐ FEATURE-018 NEW: 10 endpoints LogtoStaffGuard. State machine TRIAGED→TRANSPORTED→RESOLVED + severity 1-5. Redis medical:race:<raceId>:active-count 60s + medical:incident-lock:<incidentId> SETNX 5s. S3 medical-attachments/ + medical-reports/ Lifecycle Rule 4 (7y legal retention VN Civil Code Art. 588-589). EXIF strip + MIME allowlist image/jpeg/png/webp 10MB cap. PII anonymization cron sau 7y.
│
├── # Athletes
│   ├── AthleteStarsModule      # ⚠ 0 tests (acceptable small)
│   └── ChipVerificationModule  # ⭐ TTS chip verify + F-017 config display. ChipThrottlerGuard custom 60/min token-based ratelimit. find-then-save 6 sites HIGH-CHIP.
│
├── # Result Kiosk (F-013/F-017)
│   └── ResultKioskDisplayModule # ⭐ FEATURE-013/F-017: kiosk display + sponsor logos config (max 5 × 2MB, S3 result-kiosk-sponsors/ Lifecycle Rule 3 indefinite). find-then-save 4 sites.
│
├── # Merchant / Admin
│   ├── AdminModule             # admin.controller IsMongoId=0 params not validated (MED-ADM-01)
│   ├── MerchantModule          # ⚠ 0 tests despite tenant config + reconciliation join (HIGH-MER-01). find-then-save 4 sites.
│   ├── ReconciliationModule    # ⭐ FEATURE-003/004/016/025: multi-month range + audit + overlap + group-buy include + bulk-delete. F-016 cross-DB pattern source-of-truth. find-then-save 3 sites + N+1 for-await cron.
│   └── NotificationModule      # ⚠ 0 tests (small)
│
├── # Public-facing
│   ├── HomepageModule          # 5bib.com homepage. ⚠ MED-HP-01 0 @ApiResponse + 0 @Public marker (auth ambiguity)
│   ├── ArticlesModule          # ⭐ news.5bib.com, hotro.5bib.com. sanitize-html ✅. find-then-save 6 sites.
│   ├── SearchModule            # ⚠ MED-SR-01 same @Public ambiguity homepage
│   ├── SponsorsModule          # silver/gold/diamond. Schema 0 index (MED-SPR-01). 0 tests.
│   └── SponsoredModule         # find-then-save 4 sites + schema 24 props 0 index (MED-SP-02). 0 tests.
│
├── # Operations & Analytics (F-023/F-026)
│   ├── DashboardModule         # ⭐ FEATURE-023 NEW: homepage stats + recent-activity + KPIs. N+1 fix pipeline 2N+N→2 RTT post-deploy `a7346d2`. TD-F023-* tracked.
│   ├── AnalyticsModule         # ⭐ FEATURE-026: revenue trend + repeat customer + period compare. TD-F026-REPEAT-TREND-FORMULA fixed (SQL subquery thật). TD-F026-CACHE-INVALIDATE pre-existing.
│   ├── AuditModule             # ⭐ FEATURE-024 NEW: Audit log service (Optional inject pattern). Used by contracts + dashboard + articles. ⚠ MED-AUDIT-01 missing emit in sponsored/sponsors/race-settings/awards mutations.
│   ├── EventTrackingModule     # Throttle 100/sec ✅. find-then-save 1.
│   ├── BugReportsModule        # LogtoAdminGuard + ThrottlerGuard ✅. find-then-save 3.
│   └── TeamManagementModule    # ⚠ BIGGEST module: 17 controllers + ~6000 LOC. 0 unit tests (HIGH-TM-01). Magic token 128-bit OK. No rate-limit per IP on :token/* (HIGH-RL-01). Swagger gap 7. VolunteerDB @Optional inject pattern — F-024 root cause bug source.
│
├── # Contract & Finance (F-024/F-028 cluster — NEW Q2 2026)
│   ├── ContractsModule         # ⭐ FEATURE-024 NEW: biggest NEW after team-management. Sub-services: ContractsService (1400+ LOC, split candidate REF-01) + PartnersService + ServiceCatalogService + ContractTemplatesService + ContractLifecycleService. DOCX gen docxtemplater+pizzip+libreoffice-convert PDF. RBAC LogtoStaffGuard. Cross-DB Tenant/Race picker (linkedTenantId/linkedMysqlRaceId sparse-indexed F-028 ref). Schema LineItem.catalogItemId F-028 ref. ⚠ HIGH-CON-01 find-then-save 11 callsites (worst offender). ⚠ HIGH-CON-02 @Req() req: any 6+ endpoints. ⚠ HIGH-CON-03 no page-level RBAC. S3 contracts/ Lifecycle Rule 6 (5y retention).
│   └── FinanceModule           # ⭐ FEATURE-028 NEW: Deal P&L Tracking 3 phases. Sub-services: PnlService (BR-PNL-08 strict whitelist ACTIVE+COMPLETED + **F-038 getContractsList() paginated list reuse compute path**) + CostItemsService (CRUD COGS, **F-038 flush dual-pattern**) + FeeService (cross-DB MySQL F-016 pattern via order_metadata→order_line_item→ticket_type→race_course JOIN) + PnlDashboardService + PnlExcelService + **PnlContractsListController (F-038 NEW `finance/pnl` prefix split from `finance/dashboard`)**. Cross-module DI Contracts (Optional MaybeUndefined inject). Redis pnl:contract:<id> + pnl:dashboard:<...> + **pnl:contracts-list:<sha256-16char> TTL 60s (F-038 NEW — dual-pattern invalidation via flushDashboardCache iterating BOTH `pnl:dashboard:*` + `pnl:contracts-list:*`)**. ⚠ HIGH-PERF-01 N+1 MySQL F-029 resolved. ⚠ HIGH-PERF-02 Excel in-memory >500 OOM.
│
└── # Infra
    └── UploadModule (AWS S3)   # ⚠ CRIT-03 ZERO validation MIME/magic/size + raw originalname path traversal + XSS via S3 URL (Danny defer 2026-05-12 — WAF/CloudFront cover). REF-07 centralize file-upload security helper.

# In-flight (NOT yet in AppModule):
# - PromoHubModule (FEATURE-027 🟡 INITIATED 2026-05-11) — Configurable landing page builder, will be 34th module when deployed
```

### F-024/F-028 cross-module dependency flow

```
                ┌──────────────────────────────┐
                │      MySQL platform DB        │
                │   tenant + race + order_*    │
                │     ticket_type + course      │
                └──────────────┬────────────────┘
                               │ TypeORM 'platform' named conn
                               │
        ┌──────────────────────┴──────────────────────┐
        │                                             │
   ┌────▼─────────┐                          ┌────────▼─────────┐
   │ ContractsModule (F-024)                 │ FinanceModule (F-028)
   │ - Partner CRUD                          │ - PnlService
   │ - ServiceCatalog                        │ - CostItemsService
   │ - ContractTemplates (DOCX)              │ - FeeService (MySQL)
   │ - Contract lifecycle                    │ - PnlDashboardService
   │ - linkedTenantId/linkedMysqlRaceId      │ - PnlExcelService
   │ - LineItem.catalogItemId                │
   └─────────┬────────────────────────────────┘
             │ @Optional() inject (Cross-module DI, MaybeUndefined)
             │
        ┌────▼─────────────┐
        │ FinanceModule reads Contract for P&L compute
        │ - status whitelist ACTIVE+COMPLETED (BR-PNL-08)
        │ - revenue/expense per LineItem (catalogItemId reference cost)
        │ - margin 3-tier badge (Phase 3)
        └──────────────────┘
             │
             ▼
        ┌────────────────┐
        │ AuditModule (F-024)
        │ - Optional inject emit on contract mutation
        │ - Recent activity feed (Dashboard F-023 consumer)
        └────────────────┘
```

**Cross-DB pattern (F-016 → F-028):**
```typescript
// FeeService.getActualRevenueForRace() — F-028 inherited F-016 pattern
SELECT SUM(o.total_price) FROM order_metadata o
WHERE o.internal_status='COMPLETE'
  AND o.deleted=0
  AND o.order_category IN ('ORDINARY','GROUP_BUY','PERSONAL_GROUP','CHANGE_COURSE')  -- exclude MANUAL
  AND o.id IN (
    SELECT DISTINCT oli2.order_id FROM order_line_item oli2
    INNER JOIN ticket_type tt2 ON oli2.ticket_type_id = tt2.id
    INNER JOIN race_course rc2 ON tt2.race_course_id = rc2.id
    WHERE rc2.race_id = :raceId2
  )
// NOTE: o.tenant_id column DOES NOT EXIST in order_metadata.
// race_id is unique per tenant — no tenant filter needed.
```

---

### FEATURE-027 — Promo Hub cross-app cache invalidation flow

```
[Admin save promo hub]
   │
   ▼
[PATCH /api/promo-hubs/:id] → backend
   │
   ├──▶ MongoDB updateOne promo_hubs
   ├──▶ Redis DEL promo-hub:<slug>
   │
   ▼ (fire-and-forget from admin React client)
[POST /api/revalidate-hub] on admin Next.js (server-side route)
   │ attaches REVALIDATE_TOKEN to Authorization Bearer header
   │ (token NEVER sent to browser — env server-side only)
   ▼
[POST /api/revalidate-hub] on frontend Next.js
   │ validates Bearer token matches REVALIDATE_TOKEN env
   │ (fail-closed: 401 if mismatch/unset)
   ▼
revalidateTag('promo-hub:<slug>', 'default')          ← Next.js 16 2-arg signature
revalidateTag('promo-hubs-sitemap', 'default')
   │
   ▼
Next public hit → ISR re-fetches from backend → fresh data <1s
```

Without REVALIDATE_TOKEN env: admin returns `{ ok: true, skipped: 'no-token' }` graceful, propagation falls back to ISR 60s window (acceptable).

### FEATURE-027 — Anti-stampede SETNX lock pattern (port from F-004 RaceMasterDataService)

```
[Public /hub/<slug>] → frontend Server Component SSR
   │ ↓ ISR cache miss
   ▼
[GET /api/promo-hubs/slug/<slug>] → backend PromoHubService.findBySlugPublic()
   │
   ├─[CACHE HIT]──▶ Return cached Redis promo-hub:<slug> 60s TTL
   │
   └─[CACHE MISS]──▶ SET promo-hub-lock:<slug> 1 EX 5 NX
                       │
                       ├─[LOCK ACQUIRED]──▶ Query Mongo → cache → return
                       │
                       └─[LOCK BUSY]──▶ Retry 3× with 200ms sleep
                                          │
                                          ├─[CACHE NOW HIT after retry]──▶ Return cached
                                          │
                                          └─[STILL LOCKED after 3 retry]──▶ Fallback Mongo direct (no cache write)
```

Prevents 100 concurrent cold-cache requests from hitting Mongo.

---

### FEATURE-037 V2 — Dual-source race resolution (Promo Hub on-sale phase, 2026-05-18)

> Resolves TD-F036-09. Internal SEO detail page `/giai-chay/[urlName]` for ~17 on-sale races (MySQL platform `5bib_platform_live`).

```
[GET /giai-chay/<slug>] → frontend SSR getRaceBySlug(slug)
   │
   ├─[Step 1: MongoDB first]──▶ GET BACKEND_URL/api/races/slug/<slug>
   │                                │
   │                                ├─[hit + status!='draft']──▶ Return {...race, source:'mongodb'}
   │                                ├─[hit + status='draft']───▶ fall through
   │                                └─[miss/404]────────────────▶ fall through
   │
   ├─[Step 2: MySQL on-sale fallback]──▶ GET BACKEND_URL/api/promo-hubs/races-on-sale/by-url-name/<slug>
   │                                          │
   │                                          ├─[Redis HIT promo-hub:race-on-sale-detail:<urlName> 600s]──▶ Return cached JSON
   │                                          └─[Redis MISS]
   │                                                │
   │                                                ├─▶ MySQL QueryBuilder
   │                                                │   WHERE status=GENERATED_CODE
   │                                                │   AND CAST(is_delete AS UNSIGNED)=0
   │                                                │   AND CAST(is_show AS UNSIGNED)=1
   │                                                │   AND (url_name=:urlName OR race_id=:raceId)
   │                                                │   LIMIT 1
   │                                                │
   │                                                ├─▶ MySQL QueryBuilder courses
   │                                                │   WHERE race_id=:raceId
   │                                                │   AND CAST(deleted AS UNSIGNED)=0
   │                                                │
   │                                                ├─▶ toRaceOnSaleDetailDto(race, courses) — build sellingWebUrl + UTM
   │                                                ├─▶ Redis SETEX promo-hub:race-on-sale-detail:<urlName> 600 <json>
   │                                                └─▶ Return DTO {..., source:'on-sale'}
   │
   └─[Step 3: both miss]──▶ return null → Next.js notFound()

PREVENTS FLICKER: When race transitions BÁN VÉ→VẬN HÀNH, ops admin creates MongoDB races doc.
Next ISR tick (~1h max), MongoDB-first wins → seamless transition.

CACHE TTL ONLY: No mutation site (MySQL external-controlled). Max 1h staleness acceptable per
race lifecycle. F-036 admin/seo cache flush does NOT invalidate F-037 namespace (different prefix).

SECURITY:
  - Parameterized TypeORM (zero raw interpolation)
  - Numeric regex /^\d+$/.test(urlName) safe parse before raceId IN clause
  - encodeURIComponent on slug param (XSS via URL defense)
  - Bit field CAST(... AS UNSIGNED) pattern (F-033 reuse)
  - DTO grep-verified zero internal field leak (no tenantId/isDelete/isShow/createdById/templateId)
```

**Entity naming collision resolution (TypeORM multi-entity-per-table):**
- `race_course` table has TWO TypeORM entity classes:
  - `RaceCourseReadonly` (race-master-data module, 3 cols kiosk usage, pre-existing)
  - `OnSaleCourseReadonly` (promo-hub module, 16 cols F-037 V2 SEO detail rendering)
- Same `@Entity({ name: 'race_course' })` annotation, different TypeScript class names.
- Both registered in BOTH `forFeature` AND `forRoot({entities:[]})` per F-033 lesson.

---

### FEATURE-083 — Race Landing subdomain → SSR → public liveSnapshot flow

```
[BTC microsite visitor] GET https://<slug>.5bib.com/
        │
        ▼
[frontend/middleware.ts]  isLandingHost? (host endsWith .5bib.com
        │                  + single-label + NOT in LANDING_RESERVED)
        │                  → rewrite '/' → '/l/<slug>'  (NO cookie set — R-9)
        ▼
[app/(landing)/l/[slug]/page.tsx]  SSR fetch (ISR 60s)
        │   GET ${BACKEND_URL}/api/landings/slug/<slug>
        ▼
[LandingController.findBySlugPublic]  (PUBLIC — no guard; route BEFORE :id)
        │
        ▼
[LandingService.findBySlugPublic]
        ├─▶ Redis GET landing:slug:<sub>  ──hit──▶ return stripped DTO
        │       miss
        ▼
        ├─▶ SETNX landing-lock:<sub> (5s, retry 3×200ms anti-stampede)
        ├─▶ queryPublished(sub)  (Mongo: status='published')
        ├─▶ toPublicResponse()  ── allowlist strip (liveSnapshot only,
        │       _id→id, NO merchantRef/internalName/publish)
        └─▶ Redis SET landing:slug:<sub> = stripped DTO (TTL 60s)
        ▼
[RaceLandingRenderer]  switch(section.type) → 10 section component
        theme cascade: .landing-root style var(--main)/var(--sec)

Admin write (create-seed / update / reorder / publish / unpublish / delete)
        └─▶ invalidate(subdomain): DEL landing:slug:<sub> (+ landing:resolve:*)
Publish = atomic findOneAndUpdate({_id,'publish.version':cur}) → version++,
        freeze enabled sections into publish.liveSnapshot (1-winner concurrency).
```

**Phase 2 (tracked):** page-level SSR enricher injects live race/sponsors/results into
auto-data sections (TD-F083-AUTODATA); iframe results embed + CSP (TD-F083-RESULTS-IFRAME-PHASE2);
custom domain Caddy on-demand TLS (`domain.domainStatus`/`sslStatus` fields reserved).

---

## ⚡ Performance Critical Paths + Redis Keys Registry

> **Source of truth:** CLAUDE.md "Redis Keys Registry"

| Prefix | Purpose | TTL |
|--------|---------|-----|
| `badge:<raceId>:<bib>` | Cached BadgeService detection | 24h |
| `badge-lock:<raceId>:<bib>` | SETNX lock during badge computation | 30s |
| `render-lock:<raceId>:<bib>:<hash>` | Dedupe concurrent identical renders | 60s |
| `share-count:<raceId>` | INCR-based race-level share counter | ∞ |
| `bib-count:<raceId>:<bib>` | INCR-based athlete-level share counter | ∞ |
| `homepage:sponsored` | SponsoredModule public API cache | 300s |
| `master:athlete:bib:<raceId>` | RaceMasterData athlete cache (HSET bib→json public-view, NO PII) | 24h |
| `master:athlete:byid:<raceId>` | RaceMasterData reverse index (HSET athletes_id→bib) | 24h |
| `master:stats:<raceId>` | RaceMasterData athlete stats | 60s |
| `master:sync-lock:<raceId>` | SETNX lock during FULL sync | 60s |
| `master:cron-lock:<raceId>` | SETNX lock per-race cron tick | 50s |
| `master:lookup-lock:<raceId>:<bib>` | SETNX lock during MySQL on-demand fallback | 5s |
| `master:discover-lock:<raceId>:<courseId>` | SETNX lock during checkpoint discovery (BR-06, FEATURE-001) | 30s |
| `discover-preview:<raceId>:<courseId>` | Cached discover result JSON (FEATURE-001; tech debt — should be `master:discover-preview:`) | 1h (60s on error) |
| `articles:latest:<type>:<product>:<limit>` | ArticlesModule widget cache | 300s |
| `articles:list:<type>:<product>:<category>:<page>:<limit>` | Paginated public list | 120s |
| `articles:detail:<slug>` | Article detail page | 600s |
| `articles:categories:<type>` | ArticleCategoriesService | 300s |
| `ratelimit:article-view:<slug>:<ip>` | View dedup per IP | 5m |
| `ratelimit:article-helpful:<slug>:<ip>` | Helpful vote dedup | 24h |
| `checkin:lock:<raceId>:<bib>` | F-015 SETNX distributed lock during check-in confirmPickup (multi-station race condition guard, BR-CK-04) | 5s |
| `checkin:race:<raceId>:stats` | F-015 aggregate check-in stats per race (DEL on confirmPickup) | 60s |
| `awards:race:<raceId>:ag-podium:<courseId>` | F-019 cached AG podium snapshot per course | 60s |
| `awards:race:<raceId>:anomalies` | F-019 race-level anomaly warnings list | 60s |
| `awards:eligibility:<raceId>` | F-019 v2 AGEligibilityReport pre-race readiness cache | 60s |
| `awards:lock:<raceId>:*` | F-019 SETNX anti-stampede lock during recompute (TD-F019-LOCK-KEY: literal `*` for full-race, not Redis pattern) | 30s |
| `awards:state-lock:<podiumId>` | F-019 SETNX lock during 8-state machine transition (multi-judge concurrent edit guard) | 5s |

### Cache Invalidation Rules
- **Articles**: admin write (CRUD on articles OR categories) → flush ALL `articles:*` qua `scanStream` + pipeline. Rate-limit `ratelimit:*` SURVIVES flush.
- **Race results**: tự invalidate khi update via `race-master-data` events.
- **Sponsor**: invalidate `homepage:sponsored` khi sponsor CRUD.

### Flush global pattern (cẩn thận)
```bash
ssh 5solution-vps "docker exec 5bib-result-backend node -e \"require('ioredis').createClient(process.env.REDIS_URL).keys('badge:*').then(k => ...)\""
```

---

## 🎨 Frontend Design System ("Velocity")

> **Theme file:** `frontend/app/globals.css`

- **Palette**: Warm stone (`#fafaf9` bg, `#1c1917` text), accent blue `#1d4ed8`, energy orange `--5bib-energy: #ea580c`, trail green `--5bib-trail: #166534`
- **Fonts**: Be Vietnam Pro (headings) + Inter (body), JetBrains Mono / SF Mono (mono)
- **Motion tokens**: `--ease-out-expo`, `--ease-spring`, `--duration-fast/normal/slow`
- **Shadow system**: `--shadow-xs` → `--shadow-xl`, `--shadow-glow`
- **Key utilities**: `stagger-in`, `slide-up`, `scale-in`, `shimmer`, `grain`, `topo-lines`, `glass-light`, `text-gradient`, `mono-data`, `rank-gold/silver/bronze`, `card-hover`, `result-row-hover`

---

## 🗺️ Course Map flow (FEATURE-006)

```
[BTC Admin upload GPX/KML]
    │ multipart POST /admin/races/:raceId/courses/:courseId/gpx (LogtoAdminGuard)
    ▼
[CourseMapService.parseGpxOrKml()]
    ├─▶ @tmcw/togeojson — parse GPX/KML → GeoJSON
    ├─▶ @turf/simplify — Douglas-Peucker (50K → ≤5K points, tolerance 0.0001)
    ├─▶ Compute elevationGain/Loss + bounds + totalDistanceKm
    └─▶ matchWaypoints() strict 3 levels (L1 exact / L2 case-insensitive / L3 no-match)
            │
            ▼
    [S3 parallel upload]
        ├─▶ courses/{raceId}/{courseId}/original.gpx (bucket policy public-read)
        └─▶ courses/{raceId}/{courseId}/simplified.geojson (bucket policy public-read)
            │
            ▼
    [MongoDB $set on RaceCourse]
        gpxParsed: { trackPoints, simplifiedPoints, totalDistanceKm, elevationGain/Loss, max/minElevation, bounds }
        gpxSimplifiedUrl: 'https://s3.../simplified.geojson'
        checkpoints[].lat/lng: auto-assigned từ matchWaypoints L1/L2 (admin manual drag fill L3)
            │
            ▼
    [DEL master:course-map:<raceId>:<courseId>] — invalidate cache

────────────────────────────────────────────────────────

[Athlete public race detail page]
    │ GET /api/races/:raceId/courses/:courseId/map-data (PUBLIC)
    ▼
[Gate: race.status >= pre_race]
    ├─ status === 'draft' → 404 (BR-CM-07)
    └─ status >= 'pre_race' → continue
        │
        ▼
[Redis GET master:course-map:<raceId>:<courseId>]
    ├─ HIT (< 100ms p95) → return cached
    └─ MISS → SETNX master:course-map-lock:<raceId>:<courseId> TTL 30s
        ├─ acquired → fetch + compute response → SET cache TTL 600s → DEL lock → return
        └─ lock held → wait + read after expire (anti-stampede pattern, F-005 reused)
            │
            ▼
    [Frontend Leaflet render]
        ├─ Lazy fetch gpxSimplifiedUrl GeoJSON
        ├─ Polyline #1D49FF, custom DivIcons (start/finish/CP/aid)
        ├─ escapeHtml() user-controlled cp.key (XSS prevention)
        └─ ElevationChart pure SVG (haversine derive curve)
```

---

## 🎯 Timing Intelligence config + DNS breakdown flow (FEATURE-010)

```
┌─────────────────────────────────────────────────────────────┐
│ Race Director ▶ Settings tab                                │
│   <SettingsLinkCardsSection />          (F-008 v2)          │
│   <CourseMapFullpageLinkCard />          (F-009)            │
│   <TimingDetectionConfigSection />      (F-010 ADD)         │
│     ├─ Preset selector (Road/Trail/Ultra)                   │
│     │     └─ Auto-fills 4 fields (Danny TIMING_PRESETS)     │
│     ├─ paceBuffer @Min(1.01) @Max(2.0)                      │
│     ├─ paceAlertThreshold @Min(0.2) @Max(0.95)              │
│     ├─ confidenceMultiplier @Min(0.05) @Max(1.0)            │
│     └─ Save → PATCH /api/timing-alert/admin/configs/:raceId │
│         (LogtoAdminGuard, upsert preserves existing fields) │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼ next poll cycle (TimingAlertPollService)
       ┌───────────────────────────────────────────┐
       │  poll service reads TimingAlertConfig +   │
       │  passes to detect() + calculate():        │
       │  - paceBuffer per course_type             │
       │  - paceAlertThreshold per course_type     │
       │  - confidenceMultiplier per course_type   │
       │  - lastPollAt for OBS-1 wall-clock        │
       │  - totalRegistered via getTotalRegistered │
       └────────────────┬──────────────────────────┘
                        │
            ┌───────────┴────────────┐
            │                        │
            ▼                        ▼
   miss-detector.detect()   projected-rank.calculate()
   ├ paceBuffer × distance   ├ percentage-based confidence
   │   = expectedSeconds      │  threshold = totalRegistered
   ├ overdue check            │           × multiplier
   ├ projectedFinish > cutoff?│  fallback 50 if 0 registered
   │  ├ YES → CUTOFF_RISK     │  cap MIN(1, totalFinishers
   │  │       severity:       │              / max(thresh,1))
   │  │       WARNING or HIGH │
   │  │       (TopN)          │
   │  └ NO → PHANTOM          │
   ├ OBS-1 wall-clock:        │
   │  gap + (now-lastPollAt)  │
   └ OBS-2 MIDDLE_GAP esc:    │
     INFO→WARNING→HIGH→CRIT   │
                              │
            ┌─────────────────┘
            │ Auto-resolve in poll service:
            │  - athlete now has CP time → resolve
            │  - athlete has Finish chiptime → resolve

────────────────────────────────────────────────────────

[DashboardSnapshot extends — F-010 dnsBreakdown additive]
   ┌─────────────────────────────────────────┐
   │ computeDnsBreakdown() — query-time      │
   │ derivation (NO persisted dnsSubState):  │
   │   IF dnsChipFail===true                 │
   │     → DNS_CHIP_FAIL                     │
   │   ELSE IF racekitPickedUp===false       │
   │     → DNS_NOT_PICKED                    │
   │   ELSE                                  │
   │     → DNS_NO_START                      │
   │ Integrated into Promise.all parallel    │
   │ chain L143 (no extra request cost)      │
   └────────────────┬────────────────────────┘
                    │
                    ▼
   <DnsBreakdownCard /> in CommandCenterLayout
   (between SummaryCardsRow + lg:grid-cols-5)

────────────────────────────────────────────────────────

[DNS chip fail admin override]
   <DnsChipFailToggle athleteId={result._id} />
   inline button on race-results admin page
        │
        ▼ optimistic update mutation
   PATCH /api/race-results/:id/dns-chip-fail
   (LogtoAdminGuard, IsBoolean validator,
    paired ResponseDto, full @ApiOperation
    + @ApiResponse decorators)
        │
        ▼
   race-result.service.updateDnsChipFail()
        │
        ▼
   DashboardSnapshot recompute on next 15s poll
   → DnsBreakdownCard auto-updates via TanStack Query
```

**Cross-module DI (F-010):** `RaceResultModule.imports += MongooseModule.forFeature([{ name: TimingAlertConfig.name, schema: TimingAlertConfigSchema }])` — read-only access from RaceResultService.getPaceAlertThreshold() and updateDnsChipFail flow. NO circular import (TimingAlertModule does NOT import RaceResultModule). tsc --noEmit verifies clean.

**detection_type enum (F-010 extend):** `'PHANTOM' | 'MIDDLE_GAP' | 'CUTOFF_RISK'` — additive only. Default still `'PHANTOM'`. Existing alerts preserved across F-005 sub-page parallel preserve 30-day window (JSON spec ignore extra enum values).

**Per-course timing presets (Danny adjusted):**
| Preset | paceBuffer | paceAlertThreshold | overdueMinutes | confidenceMultiplier |
|--------|-----------|-------------------|----------------|---------------------|
| ROAD | 1.10 | 0.80 | 30 | 0.20 |
| TRAIL | **1.35** | **0.45** | 45 | 0.20 |
| ULTRA | **1.50** | 0.40 | 60 | 0.15 |

(TRAIL paceBuffer 1.35 = Sports Domain Expert lower-bound compromise vs recommended 1.40-1.50; ULTRA paceBuffer 1.50 = upper bound; ROAD all values PRD original. Field-test mandate next VN race Q2/Q3 2026 — TD-F010-V1-tuning.)

---

## 🏟️ Race Ops 10-tab shell (FEATURE-007 + FEATURE-008 v2 + FEATURE-015)

> **10-tab shell (was 9 since F-008v2; F-015 added Check-In Kiosk 2026-05-08).** Tab order: Overview / Readiness / Course Map / Command Center / Result Kiosk / Awards / Athletes / Results / Check-In Kiosk / Settings. Tab overflow-later policy: refactor "More" dropdown when shell exceeds 12 tabs (option A precedent).


```
admin/src/app/(dashboard)/races/[id]/
├── layout.tsx                          # Sticky RaceOpsHeader (Breadcrumb + RaceLiveTimer) + <main>
├── page.tsx                            # Overview render at root (no redirect flash)
├── overview/page.tsx                   # Alias route
├── readiness/page.tsx                  # F-010 placeholder (Readiness Checklist canvas 01)
├── course-map/                         # F-009 FULL implementation (replaces F-007 placeholder)
│   ├── page.tsx                        # Server Component shell, reads ?course=courseId query param
│   └── components/                     # 9 NEW sub-components
│       ├── CourseMapLayout.tsx         # orchestrator wiring 6 sections
│       ├── CourseDistancePicker.tsx    # pills + 4-state status badge (✅ ⚠ ❌ 🔴) + URL query param sync
│       ├── CourseMapFullView.tsx       # F-006 CourseMapTabInner verbatim port (466 lines, BR-AF-23 7th)
│       ├── GpxUploadSection.tsx        # upload UI from CourseDialog Map tab
│       ├── CheckpointConfigGrid.tsx    # checkpoints grid + Distance READ-ONLY
│       ├── ManualDragModeButton.tsx    # toggle + lightweight 3s toast (drag = reversible)
│       ├── AimsItraDisclaimerBanner.tsx # AIMS/ITRA disclaimer + 7-day localStorage dismiss
│       └── CourseMapFullpageLinkCard.tsx # link card consumed by Settings tab
├── command-center/                     # F-008 v2 FULL implementation
│   ├── page.tsx                        # reads ?view query param → drill-in conditional
│   └── components/                     # 9 NEW + 5 v1 carryover sub-components
│       ├── CommandCenterLayout.tsx     # orchestrator: dashboard default + AlertsListView drill-in
│       ├── CommandCenterTopBar.tsx     # 8 elements: Last sync + Poll + Force Refresh + Export CSV + Sound + Reset + Fullscreen + Discovery
│       ├── AlertsListView.tsx          # F-005 AlertsTab verbatim port (491 lines, single import-fix)
│       ├── AlertDetailDialogWrapper.tsx + CheckpointDiscoveryDialogWrapper.tsx  # verbatim re-export
│       ├── CommandCenterFullscreenButton.tsx + SoundToggleButton.tsx + ResetConfirmModal.tsx
│       ├── RaceStatusPill.tsx          # status badge inline body (distinct from RaceLiveTimer clock)
│       ├── SettingsLinkCardsSection.tsx # 2 link cards consumed by settings tab
│       └── (v1 inherit) ThroughputSparkline + DnsCounterCard + CheckpointHealthMatrix
├── result-kiosk/page.tsx               # F-011 placeholder
├── awards/page.tsx                     # F-008 v2 NEW — Trao giải standalone tab (port PodiumTab 146 lines), enabledIn:["live","ended"]
├── athletes/page.tsx                   # F-012 placeholder
├── results/page.tsx                    # F-013 existing surface preserved
├── settings/page.tsx                   # 1678-line legacy editor (BR-AF-23 byte-for-byte) + F-008 v2 SettingsLinkCardsSection ABOVE
├── timing-alerts/                      # F-005 sub-page tree STILL ALIVE (30-day deprecation, 3 sub-tabs banner)
└── components/CourseDialog.tsx         # F-006 modal STILL ALIVE parallel until F-009

admin/src/lib/                          # F-008 v2 NEW lib hooks
├── use-timing-alert-sse.ts             # SSE listener body-scoped, debounce 1500ms invalidate, reconnect on error
├── sound-alarm.ts                      # 880Hz Web Audio API helper, browser autoplay silent fail
└── leaderboard-export.ts               # F-008 v1 carryover (downloadFullCSV)

admin/src/components/race-ops-shell/
├── RaceOpsHeader.tsx                   # Sticky header composition
├── RaceLiveTimer.tsx                   # 'use client' setInterval 1Hz, 4 states, pure-exported computeTimerDisplay()
├── RaceTabsNav.tsx                     # 'use client' usePathname active state, fail-pill folded inline
├── PageHero.tsx                        # 3 variants (pink / red-live / white)
├── Breadcrumb.tsx                      # Chevron + truncate >40 chars + hidden < 640px sm:
└── PlaceholderPage.tsx                 # F-XXX badge + ETA + description

admin/src/middleware.ts                 # 301 redirect: cockpit → command-center, alerts → command-center?view=alerts, podium → awards (30-day window)
```

### Drill-in pattern (F-008 v2 NEW B3 hybrid)

```
/command-center                         # Dashboard view (7-section default)
  └─ ?view=alerts                       # AlertsListView drill-in fullpage replace
       └─ "← Về dashboard" link clears query param

/awards                                 # Trao giải standalone tab, enabledIn:["live","ended"]
```

### SSE realtime hook flow (F-008 v2)

```
CommandCenterLayout (mount)
  └─ useTimingAlertSse(raceId)
       ├─ EventSource('/api/admin/races/:raceId/timing-alert/sse', { withCredentials: true })
       ├─ on 'alert.created' / 'alert.updated':
       │     debounce 1500ms → invalidateQueries(['dashboard-snapshot', raceId] + ['timing-alerts', raceId])
       │     if severity === 'CRITICAL' → callback play880Hz() (if Sound enabled localStorage)
       └─ cleanup on unmount: es.close() + clearTimeout
```

### Fullscreen pattern (F-008 v2 + F-011 dual-layer extension)

```
CommandCenterFullscreenButton click
  └─ document.body.toggleAttribute('data-fullscreen')
       └─ CSS dual-layer scope (F-011 extends F-008 v2):
            ├─ body[data-fullscreen] [data-race-ops-shell-header] { transform: translateY(-100%) }    # F-008 v2 race-ops shell
            └─ body[data-fullscreen] [data-admin-sidebar], [data-admin-topbar] { display:none !important }  # F-011 admin shell
       └─ Esc keydown → document.body.removeAttribute('data-fullscreen')
       └─ unmount cleanup → removeAttribute (state safety)
```

**F-011 extension (BR-PB-01 + BR-PB-02):** Fullscreen scope NOW dual-layer — admin shell `[data-admin-sidebar]` + `[data-admin-topbar]` (data-attrs added on `(dashboard)/layout.tsx` lines 251/273, additive only per BR-AF-23) + race-ops shell `[data-race-ops-shell-header]` (F-008 v2 unchanged). All hide simultaneously when fullscreen toggled. `!important` justified per F-008 v2 BR-CC2-09 precedent (overrides Tailwind `lg:flex` on `<aside>`). Other admin routes unaffected (they don't toggle `body[data-fullscreen]`).

**F-013 extension (BR-RK-12):** APPEND +8 LOC additional rule scoped to TRUTHY attribute value `body[data-fullscreen="true"]`:

```
body[data-fullscreen="true"] {
  overflow: hidden;
  height: 100vh;
}
```

Containment for kiosk touchscreen layout (prevents page scroll + locks viewport to 100vh). NEW reusable fullscreen primitive — first feature using it (F-013 result-kiosk); future kiosk-style/fullscreen features will adopt this primitive instead of reinventing. Pre-existing F-008v2 + F-011 `body[data-fullscreen]` (no value attribute) rules preserved verbatim — F-013 rule is scoped narrower (truthy `="true"` value) and complementary, not overriding. F-013 owns toggle via `useKioskFullscreen` hook (hook OWNS the attribute lifecycle including Escape listener + cleanup). `useKioskFullscreen` ALSO calls native `document.documentElement.requestFullscreen()` best-effort under user-gesture (anchored at `KioskTabBody` "Bật chế độ Kiosk" CTA click). Both APIs (CSS attribute + native Fullscreen) swallow errors silently — fallback to soft state (CSS attribute alone) keeps surface usable when browser blocks native API (some iframes/locked contexts).

### Result Kiosk standalone (F-013 — Race Ops Cluster #8 first feature)

F-013 result-kiosk consumes existing `getAthleteDetail` endpoint (BR-RK-09); ZERO backend modify, ZERO new endpoint, ZERO SDK regen, ZERO new Redis key. Reuses existing `master:athlete:*` Redis cache via F-005-era cache hit path. Single SDK function: `raceResultControllerGetAthleteDetail({ raceId, bib })` at `sdk.gen.ts:878` returns `unknown` payload → F-013 introduces **SDK unknown-response runtime guard pattern** via `isAthleteDetailResponse(x): x is AthleteDetailEnvelope` validating shape before render (BR-RK-11). Backend response envelope `{ data: PublicAthleteData | null, success: boolean, message?: string }` observed at `backend/src/modules/race-result/race-result.controller.ts:139-155` (controller already strips `_id`/`editHistory`/`isManuallyEdited` server-side per BR-RK-05 privacy double defense — KioskResultCard ALSO reads only public allowlist `bib/name/distance/dsqReason` HTML-stripped via regex).

State machine (`KioskModeProvider` Context): `mode | bib | result | resultKind | loading | soundEnabled` with pure transition methods `enterKiosk()` / `submitBib()` / `resetToInput()` / `exitKiosk()`. 4 hooks separation (DOM/timer/Web Audio/SDK boundaries):

```
       ┌─────────┐  enterKiosk()     ┌────────────┐
route → │  admin  │ ───────────────▶ │ bib-input  │
        │ (Surf 1)│                  │  (Surf 2)  │
        └─────────┘                  └─────┬──────┘
            ▲                              │  submitBib()
            │  exitKiosk()                 ▼
            │                        ┌────────────┐
            └────────────────────────│   result   │
                 resetToInput()      │  (Surf 3)  │
                 ◀────────────────── └────────────┘
                                       60s idle
```

**Web Audio + Fullscreen co-location pattern (F-013 mints):** both APIs require user-gesture; co-locate activation at single trigger button click (`KioskTabBody` "Bật chế độ Kiosk" → `KioskModeProvider.enterKiosk()` calls `sound.ensureAudioContext()` + `fullscreen.enterFullscreen()` synchronously inside handler). Both APIs swallow errors silently — fallback to soft state (DOM attribute fullscreen + audio-disabled beep no-ops) keeps surface usable if browser blocks one.

### Athletes tab + Settings sectioned-scroll IA (F-014 — Race Ops Cluster #8 second feature)

F-014 occupies athletes (slot 7) + settings (slot 9) tabs of the Race Ops 9-tab shell **without modifying RaceTabsNav** (F-007 v2 territory unchanged). Athletes tab REPLACES F-007 41-LOC placeholder with full NEW_MODULE; Settings tab REFACTORS 1692-LOC legacy editor (`page.tsx`) into 268-LOC composer + 6 sections (RaceMeta / Course / Timing / Publishing / Integrations / Advanced) with sticky-nav `SettingsLayout`.

**Option C client-derive status pattern (alternative to backend schema migration).** F-014 introduces 9-status enum derived purely client-side from existing race-result fields:

```
deriveAthleteStatus(row, raceStatus) →
  ┌─ editHistory[] field='status' present? ──→ manual override WINS (BR-AS-02 trust-admin)
  ├─ DSQ signals (3 paths): editHistory + timingPoint sentinel "DSQ-CP3" + dsqReason
  ├─ DNF signals (3 paths): dnf>0 (number) + dnf===true (bool) + timingPoint==='DNF'
  ├─ FIN signals: timingPoint='FINISH' AND meaningful chipTime/gunTime AND finite OverallRank (rejects '-' / '00:00:00' / '0' sentinels)
  ├─ DNS signals: timingPoint='DNS' OR (raceStatus='ended' AND no startTime AND dnsChipFail)
  ├─ LIVE signals: startTime present OR partial split detected (timingPoint not FINISH/DNS/DNF)
  ├─ PICKED signals: racekitReceived === true (camelCase + snake_case both)
  └─ REG fallback (default; never returns null)
```

MED + CUT have NO vendor signal — only manual `editHistory[]` override per Race Ops Expert advisory §2 (BTC race-day judgment). Status persists via existing `editHistory[]` PATCH `adminControllerEditResult` (server-side appends actor + timestamp). ZERO schema migration. **Refactor candidate when backend `status` field schema lands** — refactor to single shared util TD-F014-02 (currently duplicated F-013 5-status `deriveKioskStatus` + F-014 9-status `deriveAthleteStatus`).

**Sectioned-scroll IA pattern (Settings refactor).** SettingsLayout provides sticky left rail (desktop, lg≥1024px) / horizontal scroll (mobile) + active section highlight via IntersectionObserver in `useUrlHashScroll` + chấm cam (orange dot) per nav item driven by `useDirtyFormPerSection.dirtyMap`. URL preserved (no migration); HTML5 hash anchor `#section-id` enables bookmark + section discovery; reduced-motion respected. Each section is self-contained — owns its own form state + save mutation via react-hook-form. No autosave block, no leave-confirm — admin trust philosophy. 4 per-tab save buttons preserved (BR-AS-42). 6-section IA: Formula & Fees DROPPED per audit empty (BR-AS-54); `cacheTtlSeconds` MOVED to Integrations (BR-AS-39).

**Drawer pattern (Athletes).** shadcn `Sheet` right-side, 480px desktop / fullscreen mobile. Drawer state machine `mode: 'edit' | 'profile' | 'closed'` prevents two drawers stacking. Two-tab toggle inside drawer; `AthleteProfileDrawer` is thin wrapper opening merged drawer in `mode='profile'`.

**`admin/src/lib/` shared lib root established.** First file: `deriveAthleteStatus.ts`. Future shared admin utilities adopt this root (alternative to `admin/src/components/` UI primitives or scope-local module patterns).

**5 PRESERVED stack components ZERO diff** — F-014 RE-IMPORTS without modifying source: F-008v2 `SettingsLinkCardsSection`, F-009 `CourseMapFullpageLinkCard`, F-010 `TimingDetectionConfigSection` (349 LOC), F-012 trio (`TimingFormulaTooltipContent` + `TimingPresetComparisonTable` + `TimingPresetRationalePanel`), F-012 `timing-presets.constant`. BR-AF-23 byte-for-byte preserve mandate honored — 9th successful verbatim port through cluster (Manager + QC verified 64/64 logical fields + 7/7 stack pieces). PAUSE-AS-02 field-mapping checklist was THE planning artifact (saved 6+ ambiguous decisions during refactor).

**F-011 status-aware guard reused on both tabs.** Athletes: `raceStatus === 'draft'` → `<AthletesEmptyState variant='draft-guard'>` deep-link to `settings#race-meta` (zero-data short-circuit). Settings: LifecycleStepper forward-only ORDER preserved verbatim with `ended` terminal lock (BR-AS-36); race.status guards in Timing/Publishing.

### Check-In Kiosk standalone (F-015 — Race Ops Cluster #9 first feature)

F-015 check-in-kiosk consumes existing race-result + race-master-data; introduces NEW `CheckInService` (sibling of `RaceResultService`, NOT modifier) + NEW `CheckInSseService` for multi-station broadcast.

```
admin/src/app/(dashboard)/races/[id]/
├── check-in-kiosk/                    # F-015 NEW slot 9 (between Results and Settings)
│   ├── page.tsx                       # KioskTabBody orchestrator + status guard (BR-CK-07 race draft disabled)
│   ├── checkin.constant.ts            # BIB_MAX_LEN, IDLE_MS, SETNX_LOCK_TTL_S=5, source enum (qr/bib/cmnd)
│   ├── checkin.microcopy.ts           # scope-local VN strings (Phase 1; F-013 pattern reused)
│   ├── checkin.types.ts               # AthleteCheckInResponse runtime guard `isAthleteCheckInResponse(x)`
│   ├── components/                    # 13 components (CheckInTabBody / Surfaces 1-3 / MultiInputLookup / AthleteCheckInCard / ConfirmPickupButton / CMNDLastFourInput / MultiStationStatusBar / QRScannerOverlay / Idle / Exit / Provider / WindowGuard)
│   ├── hooks/                         # 4 hooks: useAthleteLookup / useCheckInMutation / useStationSync / useQRScanner
│   └── __tests__/                     # checkin.types.spec.ts 23 cases EXECUTED PASS + 11 deferred specs

admin/src/lib/kiosk/                   # F-015 NEW shared lib (Option 3 generalized; F-013 retrofit deferred TD-F015-01)
├── useFullscreen.ts                   # extracted from F-013 useKioskFullscreen (rename = generalization)
├── useKioskIdle.ts                    # extracted from F-013 — unchanged
├── useKioskSound.ts                   # extracted from F-013 — unchanged
├── kiosk.constant.ts                  # SHARED_KIOSK_CONFIG (was KIOSK_CONFIG) — generalized
├── types.ts
└── index.ts                           # barrel re-export

backend/src/modules/race-result/
├── check-in.controller.ts             # F-015 NEW — 4 endpoints (LogtoAdminGuard BR-CK-11)
├── check-in.service.ts                # F-015 NEW — confirmPickup atomic + lookupByCmndLastFour anchored regex
├── check-in-sse.service.ts            # F-015 NEW — @Sse() + RxJS Subject + 25s heartbeat (BR-CK-08)
├── check-in.module.ts                 # F-015 NEW — MongooseModule.forFeature CheckInLog + RaceResult cross-DI
├── check-in-log.schema.ts             # F-015 NEW — check_in_logs collection (NO PII, ObjectId only BR-CK-15)
├── dto/check-in.dto.ts                # F-015 NEW — request/response DTOs
└── dto/check-in-stats.dto.ts          # F-015 NEW — aggregate stats DTO
```

**Multi-station race condition mitigation (BR-CK-04 / BR-CK-05) — two-tier guard:**

```
confirmPickup(raceId, bib, stationId, source, checkedInBy):
  Step 1 — Redis SETNX checkin:lock:{raceId}:{bib} 5s TTL
            └─ returns null (lock held) → throw 409 CHECKIN_LOCK_HELD
  Step 2 — atomic findOneAndUpdate({ raceId, bib, racekit_received: false },
            { $set: { racekit_received: true, racekit_received_at: now } })
            └─ matchedCount=0 + athlete exists → throw 409 CHECKIN_ALREADY_PICKED_UP
            └─ athlete missing → throw NotFoundException
  Step 3 — insert check_in_logs doc (raceId, bib, athleteId ObjectId, checkedInAt, checkedInBy, stationId, source)
  Step 4 — SSE broadcast pickup event via per-race RxJS Subject
  Step 5 — DEL master:rr-snapshot:{raceId} (F-005 dashboard-snapshot cache) + DEL checkin:race:{raceId}:stats
  finally — DEL checkin:lock:{raceId}:{bib} (best-effort; TTL safety net if process dies)
```

**Multi-station SSE broadcast flow (BR-CK-08):**

```
Tablet 1..N each open EventSource('/api/race-results/check-in/:raceId/sse', { withCredentials: true })
   │
   ▼
CheckInSseService — single global RxJS Subject + filter(event => event.raceId === raceId)
   │
   ├─▶ on confirmPickup → Subject.next({ type: 'pickup', raceId, bib, stationId, ts })
   ├─▶ all subscribed tablets receive event in <1s
   └─▶ heartbeat: interval(25_000).next({ type: 'heartbeat' }) — keeps EventSource alive
```

**CMND PII boundary (BR-CK-08 / BR-CK-10) — last-4-digit visual match by BTC, NEVER stored:**
- Frontend `CMNDLastFourInput.tsx` — 4-digit input field; never logs value (verified by grep audit)
- Backend `lookupByCmndLastFour(raceId, cmndLast4)` — anchored regex `^[0-9]{4}$` validation; queries `RaceMasterData.cmnd_last_4` (master-data layer; populated upstream by athlete sync)
- `check_in_logs` schema stores ObjectId only — NO `cmnd`, NO `name`, NO PII
- BTC visually matches last-4 digits to athlete's physical CMND (paper ID); pickup confirmed via separate UI flow

**TD-F005-01 RESOLVED 2026-05-08 by F-015** — `racekit_received` field finally written to MongoDB by F-015 atomic mutation. Cluster #4 placeholder (always-0 in F-005 dashboard-snapshot) lived ~3 weeks; pattern lesson: always track placeholder TDs to closure feature.

**chip-verification module boundary (BR-CK-20) — hard boundary:** F-015 zero imports from `chip-verification/` module verified by grep audit. 2 modules cover overlapping problem domain (chip-verification = chip↔BIB tech check; check-in-kiosk = BIB pickup workflow) without coupling.

### AthleteFlowChart pre-race state guard (F-011 BR-PB-04)

```
AthleteFlowChart receives raceStatus?: RaceStatus prop (optional, literal union)
  ├─ raceStatus ∈ ['draft', 'pre_race']
  │     └─ EARLY RETURN: CardShell with neutral grey "⏱ Race chưa khởi động — chờ start gun"
  │        (FlowRows skipped; F-005 health() calc never runs; no false "KIỂM TRA THIẾT BỊ" badge)
  ├─ raceStatus ∈ ['live', 'ended']
  │     └─ FlowRows render normally; F-005 health() calc preserved verbatim (lines 144-145)
  └─ raceStatus === undefined (legacy consumer)
        └─ guard does NOT fire → fallback to existing 3-tier empty-state ladder (BR-PB-03 backward-compat)
```

Frontend race-status guard interprets per-state ABOVE backend logic, never bypasses. Backend F-005 health() calc preserved verbatim: `c >= e * 0.9 ? 'good' : c >= e * 0.7 ? 'warn' : 'fail'`.

### Brand tokens (FEATURE-007 v2 magenta migration)
```
--5s-primary: #FF0E65        # magenta — brand primary (was #1D49FF blue)
--5s-primary-hover: #d9094f
--5s-info: #1D49FF           # blue retained for data viz / info banner role
--5s-live: #FF0E65           # RACE LIVE pulsing dot
--5s-blue: #1D49FF           # back-compat alias
--5s-blue-50: #1D49FF0d      # back-compat alias
```

Audit gate: `grep -rn "#1D49FF" admin/src/app/(dashboard)/races/ admin/src/components/race-ops-shell/ admin/src/components/course-map/ frontend/app/(main)/races/` → 0 results.

Out-of-scope preserved: `admin/src/app/(dashboard)/article-categories/` + `frontend/app/solution-5solution/` (5Solution brand = blue per design system memory).

### RACE LIVE timer 4-state matrix
| Status | Display | Tick? |
|---|---|---|
| `draft` | `DRAFT` | No |
| `pre_race` | `RACE START IN T-HH:MM:SS` (or `TBD` if `scheduledStartAt` null) | Yes |
| `live` | `RACE LIVE · HH:MM:SS` (red pulsing dot) | Yes |
| `ended` | `RACE ENDED · HH:MM:SS` (or `--:--:--` if missing data) | No |

Cluster F-008..F-014 will populate the placeholder pages.

---

## 🧭 Navigation hint cho Manager

Khi `/5bib-init`, đối chiếu impact theo domain:

- **Race domain** (races, race-result, race-master-data, timing) → ⚠️ check race lifecycle + Redis `master:*` keys + leaderboard cache. FEATURE-006 added Course Map flow: `master:course-map:<raceId>:<courseId>` TTL 600s + `master:course-map-lock:` SETNX TTL 30s anti-stampede. S3 prefix `courses/` no expiration. Direct `redis.del()` trong RacesService.updateCourse + removeCourse.
- **Race detail page (admin)** (FEATURE-007 + FEATURE-008 v2 onwards) → **9-tab** race-ops shell pattern. Route: `(dashboard)/races/[id]/layout.tsx` shell + nested `[tab]/page.tsx` per tab. **9 tabs locked order: Overview / Readiness / Course Map / Command Center / Result Kiosk / Trao giải (Awards) / Athletes / Results / Settings**. Brand primary `#FF0E65` magenta (was `#1D49FF` blue; blue retained as `--5s-info` data viz role). RACE LIVE timer global header `RaceOpsHeader` với 4 states matrix (`draft` / `pre_race` / `live` / `ended`). Middleware redirects 30-day window: `/timing-alerts/cockpit` → `/command-center` + `/timing-alerts/alerts` → `/command-center?view=alerts` + `/timing-alerts/podium` → `/awards` (all 301). Settings tab = 1678-line legacy editor moved VERBATIM (BR-AF-23) + **multi-feature additive composition stack ABOVE** (F-008 v2 `SettingsLinkCardsSection` link cards + F-009 `CourseMapFullpageLinkCard` link card + F-010 `TimingDetectionConfigSection` form section + F-012 hints/explanation surfaces inside that section: 4 inline tooltips + comparison table + rationale panel). **Settings parent `settings/page.tsx` PRESERVED byte-for-byte** through Cluster #2..#7 — every cluster feature touching settings tab adds new section/link card ABOVE legacy editor without modifying parent file (BR-AF-23 preserve mandate). **Shared constant module pattern (F-012 minted)** — `timing-presets.constant.ts` extracts cross-component data (TIMING_PRESETS values) to dedicated module imported by ≥2 consumers (form + display table); single source of truth prevents drift forever. Reusable cho future cross-component data sync needs. **Command Center sub-views** via `?view=alerts` query param drill-in (B3 hybrid). **Awards tab** standalone `enabledIn:["live","ended"]`. **SSE realtime hook** body-scoped (`useTimingAlertSse`) with debounce 1500ms invalidate. **Fullscreen mode** via `body[data-fullscreen]` CSS attr (NO F11). **Reset 4-layer defense** (LogtoAdminGuard + confirmToken=race.slug + status throw + 2-step typing modal). NOTE: app has NO `basePath` — canonical URLs `/races/[id]/...` not `/admin/races/[id]/...`.
- **Articles** → ⚠️ cache invalidation phức tạp, tổng 4-5 key prefix bị ảnh hưởng
- **Auth (logto-auth)** → 🔴 CRITICAL — KHÔNG được tự build, KHÔNG được bypass Logto, cần Danny duyệt
- **Result Image** → check S3 lifecycle (24h), Redis `render-lock:*`, font assets, `RESULT_PUBLIC_URL`
- **Reconciliation, fee logic** → 🔴 CRITICAL nghiệp vụ, đọc CLAUDE.md "Pre-Deploy Checklist"
- **Schema change** → ⚠️ check `Fields Nguy Hiểm Trong 5BIB Frontend` (race.id, course.courseId, result._id)
