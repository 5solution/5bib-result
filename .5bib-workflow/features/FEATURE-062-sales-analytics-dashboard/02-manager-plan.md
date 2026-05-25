# FEATURE-062: Plan Review — Sales Analytics Dashboard Multi-Tab Redesign

**Status:** ✅ **APPROVED (v2 — 2026-05-22)** — Coder có thể bắt đầu `/5bib-code FEATURE-062-sales-analytics-dashboard`
**Reviewed:** 2026-05-22 (v1 — APPROVED WITH ADJUSTMENTS) → 2026-05-22 (v2 — APPROVED clean sau BA apply 6 adjustments)
**Reviewer:** 5bib-manager
**Branch:** `5bib_analytics_v2` (off main `e7284b0`)
**Linked:** `00-manager-init.md` (235 dòng), `01-ba-prd.md` v3 (2278 dòng — BA applied 6 adjustments 2026-05-22), reference UI `reference-ui-selling-web/`

---

## 🔄 v1 → v2 Verdict Upgrade

| v1 (2026-05-22) | v2 (2026-05-22 sau BA fix) |
|------------------|---------------------------|
| 🟡 APPROVED WITH ADJUSTMENTS | ✅ **APPROVED — Clean** |
| 6 BA action items pending | 0 action items remaining |
| Block: F-060 numbering collision + 5 spec adjustments | None — all resolved |

---

## ✅ Adjustment Verification Matrix (Manager re-review 2026-05-22)

Manager đã verify từng adjustment qua grep + file reads. Tất cả 6 PASS.

| # | Adjustment | Verification method | Status |
|---|------------|--------------------|--------|
| 0 | **Folder rename F-060 → F-062** | `ls .5bib-workflow/features/FEATURE-06*/` xác nhận: F-060-seo-landing-uplift (existing ship) + F-061-split-payment-ref (existing ship) + F-062-sales-analytics-dashboard (NEW). KHÔNG collision. | ✅ DONE |
| 1 | **GranularityKind split** | BR-SA-01 rewrite confirmed: 3 enum riêng (PeriodKind 6 values GIỮ, GranularityKind 3 values NEW, CompareKind extend +wow/mom/yoy). Helper `resolveBucketSize(granularity)` spec. Backward compat note F-026 6 endpoint không ảnh hưởng. | ✅ DONE |
| 2 | **TTL align 900s/86400s** | Grep counts: TTL 900s = 26 occurrences, TTL 300s = 0, TTL 600s = 1 (GA4 only — intentional ngoài scope Adj #2). 24 cache keys aligned theo existing convention `analytics.service.ts:31-32`. | ✅ DONE |
| 3 | **Split PeriodCompareSelector** | 3 NEW component specs confirmed: BR-SA-13 GranularityToggle.tsx + BR-SA-14 CompareSelector.tsx + BR-SA-14b PeriodSelector.tsx. BR-SA-14c PeriodCompareSelector.tsx mark `@deprecated F-062 v3` (KHÔNG xoá ngay backward compat). Section 3.4.2 New Files updated với 3 entries. | ✅ DONE |
| 4 | **TD-F019-MULTITENANT documented** | Technical Debt Reference table row added: "INHERITED — acceptable v1 (admin = trusted full access). Phase 2 nếu ship merchant self-serve → cần `RaceTenantGuard`". Document để Coder/QC/Future-Manager biết, KHÔNG fix trong F-062. | ✅ DONE |
| 5 | **5Solution brand tokens locked** | Section 5.2 Color Scheme updated: GMV accent `--5s-blue #1D49FF` (5-family logo blue, NOT Tailwind blue-600). Magenta accent `--5s-magenta #FF0E65` thêm. Health Good colored với `--5s-blue`. NEW Section 5.2.1 Brand Token CSS Reference với raw CSS variables. Coder action mandate `globals.css` import + `text-[var(--5s-blue)]` arbitrary syntax cho Tailwind utilities. globals.css EXTEND row thêm vào 3.4.3 Refactored Files. | ✅ DONE |
| 6 | **3 strategic metrics added** | BR-SA-24 GMV Concentration (Tab 1 KPI thứ 5) + BR-SA-25 AOV trend (Tab 1 Comparison Row metric thứ 5) + BR-SA-26 YoY Merchant Retention (Tab 3 KPI thứ 6) — tất cả compute frontend từ existing data trừ BR-SA-26 extend `yoyRetentionRate` vào `MerchantHealthSummaryDto`. Tab 1 + Tab 3 KPI strip updated card counts. Field Source tables extended. | ✅ DONE |

---

## ✓ PRD v3 Validation Checklist (Manager re-verify)

### Completeness
- [x] User Stories US-60-01..13 đầy đủ
- [x] Business Rules BR-SA-01..23 + BR-SA-14b/14c/24/25/26 v3 → tổng **28 BR-SA** (was 23, +5)
- [x] All 5 PAUSE conditions trong 00-manager-init.md đã được Danny chốt 2026-05-24
- [x] UI states đầy đủ 13 trạng thái áp dụng all 5 tabs
- [x] UI Step-by-Step numbered tables per tab
- [x] Buttons spec table per tab
- [x] Form Fields spec table per tab
- [x] Field Source table per tab — v3 extended với rows mới cho BR-SA-24/25/26
- [x] Acceptance Criteria 26 items (was 18, +8 v3 items)

### Technical correctness vs codebase
- [x] DB change: KHÔNG schema mới (vẫn aggregations only — DTO extend `yoyRetentionRate` optional cho BR-SA-26 backward compat)
- [x] Endpoint design RESTful (12 endpoint mới)
- [x] Cache key pattern khớp existing `analytics:metric:<name>:<scope>:<periodKey>`
- [x] **TTL align convention (Adj #2 verified)** — 24 cache keys = 900s/86400s match analytics.service.ts:31-32
- [x] Named connection `'platform'` documented
- [x] SDK regen mandate
- [x] Fee invariant `FeeService.computeFeeForOrdersAggregate()` mandate
- [x] **3 enum separation (Adj #1 verified)** — Period/Granularity/Compare distinct

### Security
- [x] LogtoAdminGuard mọi endpoint mới
- [x] PAUSE-SA-06 Runner Demographics privacy + k-anonymity
- [x] PAUSE-SA-01 GA4 Service Account JSON key env var
- [x] BR-SA-10 Export max 10K rows DoS prevention
- [x] **TD-F019-MULTITENANT (Adj #4 verified)** — Documented inheritance, acceptable v1 admin trusted

### Performance
- [x] SLA cụ thể (p95 < 200ms warm, <3s cold, etc.) trong Section 4.4 đầy đủ 22 metrics
- [x] Cache TTL specified per endpoint — aligned 900s/86400s
- [x] Migration: KHÔNG cần migration data — pure aggregation

### Testability
- [x] Test cases TC-SA-01..167 đầy đủ
- [x] Concurrency: cache invalidation TC-SA-151
- [x] Security TCs (TC-SA-89..93 + TC-SA-166-167)
- [x] PAUSE-SA-07 Race type enum verify pre-implementation

### Design / Brand
- [x] **5Solution brand tokens (Adj #5 verified)** — `--5s-blue #1D49FF` + `--5s-magenta #FF0E65` mandate Section 5.2 + 5.2.1
- [x] globals.css import action documented Section 3.4.3
- [x] Tailwind utility binding `text-[var(--5s-blue)]` arbitrary syntax

### Strategic Metrics
- [x] **BR-SA-24 GMV Concentration (Adj #6 verified)** — Tab 1 KPI strip 5 cards, frontend compute từ top-races
- [x] **BR-SA-25 AOV Trend (Adj #6 verified)** — Tab 1 Comparison Row 5 cards, frontend compute
- [x] **BR-SA-26 YoY Merchant Retention (Adj #6 verified)** — Tab 3 KPI strip 6 cards, backend extend `yoyRetentionRate` field optional

---

## 📊 Cross-check với memory (re-verified)

### Architecture impact (unchanged)
- 5 NEW backend services trong `analytics/services/` (runner-analytics, race-performance, merchant-comparison, ga4, export)
- KHÔNG phá vỡ Order/Race/Merchant module domain
- KHÔNG break SDK existing (chỉ thêm 12 endpoint mới)
- Architecture diagram update sau deploy: Analytics module 11 services (6 cũ + 5 mới)

### Convention impact (v3 changes)
- Pattern reuse `cachedQuery + buildMetricCacheKey + calcDeltaPercent + buildDateFilter` (unchanged)
- TanStack Query migration (unchanged)
- Dictionary `analytics-labels.ts` (unchanged)
- **NEW pattern v3:** "3-enum separation cho time-series query (Period/Granularity/Compare)" — Manager sẽ ghi vào `conventions.md` sau deploy (Section "Time-series query convention").
- **NEW pattern v3:** "Brand token binding via CSS custom properties + Tailwind arbitrary value syntax" — Manager sẽ ghi vào `conventions.md` Section "Brand token binding" sau deploy.
- **NEW pattern v3:** "Backward compat selector deprecation" — DEPRECATE old component, NEW components imported via shared layout.tsx, mark `@deprecated` keep file để protect in-flight feature imports.

### Known issues impact (v3 confirmed)
| TD | Trạng thái sau F-062 |
|----|---------------------|
| TD-F026-EXPORT-STUB | ✅ RESOLVED by BR-SA-10 |
| TD-F026-CACHE-INVALIDATE | 🟡 PARTIAL RESOLVED by BR-SA-18 (+13 patterns) |
| TD-F026-REPEAT-TREND-FORMULA | ⚪ OUT OF SCOPE |
| TD-F016-FINANCE-01 | ⚪ OUT OF SCOPE |
| TD-F019-MULTITENANT | ⚪ INHERITED (Adj #4 documented) |
| TD-F041-NO-TEST-RUNNER | ⚪ INHERITED (frontend tests spec-only) |

---

## 📋 Files được phép thay đổi (Scope Lock v2 — updated cho v3 changes)

> Coder CHỈ được thay đổi các file/folder dưới đây. Đụng ngoài = scope creep, phải hỏi Manager.

### Backend (apps/api) — NEW files (28 files)

**Services (5 new):**
- ➕ `backend/src/modules/analytics/services/runner-analytics.service.ts`
- ➕ `backend/src/modules/analytics/services/race-performance.service.ts`
- ➕ `backend/src/modules/analytics/services/merchant-comparison.service.ts`
- ➕ `backend/src/modules/analytics/services/ga4.service.ts`
- ➕ `backend/src/modules/analytics/services/export.service.ts`

**DTOs (16 new):**
- ➕ `backend/src/modules/analytics/dto/runner-summary.dto.ts`
- ➕ `backend/src/modules/analytics/dto/booking-heatmap.dto.ts`
- ➕ `backend/src/modules/analytics/dto/lead-time.dto.ts`
- ➕ `backend/src/modules/analytics/dto/repeat-cohort.dto.ts`
- ➕ `backend/src/modules/analytics/dto/demographics.dto.ts`
- ➕ `backend/src/modules/analytics/dto/geographic.dto.ts`
- ➕ `backend/src/modules/analytics/dto/race-type-distribution.dto.ts`
- ➕ `backend/src/modules/analytics/dto/race-spotlight.dto.ts`
- ➕ `backend/src/modules/analytics/dto/race-performance.dto.ts`
- ➕ `backend/src/modules/analytics/dto/merchant-scatter.dto.ts`
- ➕ `backend/src/modules/analytics/dto/health-distribution.dto.ts`
- ➕ `backend/src/modules/analytics/dto/merchant-comparison.dto.ts`
- ➕ `backend/src/modules/analytics/dto/weekly-revenue.dto.ts`
- ➕ `backend/src/modules/analytics/dto/monthly-revenue.dto.ts`
- ➕ `backend/src/modules/analytics/dto/comparison.dto.ts`
- ➕ `backend/src/modules/analytics/dto/top-races-by-orders.dto.ts`
- ➕ `backend/src/modules/analytics/dto/races-need-attention.dto.ts`
- ➕ `backend/src/modules/analytics/dto/merchant-health.dto.ts` (extend `MerchantHealthSummaryDto` thêm `yoyRetentionRate` per Adj #6 BR-SA-26)
- ➕ `backend/src/modules/analytics/dto/ga4-overview.dto.ts`
- ➕ `backend/src/modules/analytics/dto/export-query.dto.ts`

**Tests (7 new):**
- ➕ `backend/src/modules/analytics/services/runner-analytics.service.spec.ts`
- ➕ `backend/src/modules/analytics/services/race-performance.service.spec.ts`
- ➕ `backend/src/modules/analytics/services/merchant-comparison.service.spec.ts`
- ➕ `backend/src/modules/analytics/services/ga4.service.spec.ts`
- ➕ `backend/src/modules/analytics/services/export.service.spec.ts`
- ➕ `backend/src/modules/analytics/__tests__/cache-invalidation.f062.spec.ts`
- ➕ `backend/src/modules/analytics/__tests__/period-resolver.f062.spec.ts`

### Backend (apps/api) — EXTEND files (6 files)

- ✏️ `backend/src/modules/analytics/analytics.controller.ts` — +12 endpoint methods
- ✏️ `backend/src/modules/analytics/analytics.service.ts` — delegate to new services
- ✏️ `backend/src/modules/analytics/analytics.module.ts` — register 5 new services + GA4 module
- ✏️ `backend/src/modules/analytics/services/period-resolver.ts` — **per Adj #1:** ADD `GranularityKind` enum + `resolveBucketSize()` helper + EXTEND `CompareKind` thêm `'wow' | 'mom' | 'yoy'` (giữ `'prev'`). KHÔNG ADD weekly/monthly vào PeriodKind.
- ✏️ `backend/src/modules/merchant/merchant.service.ts` — extend `flushEventOverrideCache()` thêm 13 patterns (BR-SA-18)
- ✏️ `backend/.env.example` — add GA4_SERVICE_ACCOUNT_KEY_PATH + GA4_PROPERTY_ID stubs

### Admin Frontend — NEW files (Scope Lock v2 — added 4 components per Adj #3 + Adj #6)

**Pages (3 new):**
- ➕ `admin/src/app/(dashboard)/analytics/layout.tsx` — Tab navigation wrapper (5 tabs + shared header with 3 NEW selectors)
- ➕ `admin/src/app/(dashboard)/analytics/races/page.tsx` — Tab 2: Race Performance
- ➕ `admin/src/app/(dashboard)/analytics/runners/page.tsx` — Tab 4: Runner Behavior

**Components (24 new — v2 added 4 per Adj #3 + #6):**
- ➕ `admin/src/lib/analytics-labels.ts` — Vietnamese dictionary (BR-SA-17)
- ➕ `admin/src/app/(dashboard)/analytics/components/GranularityToggle.tsx` **(Adj #3)** — SegmentedControl Ngày/Tuần/Tháng, type `GranularityKind`
- ➕ `admin/src/app/(dashboard)/analytics/components/PeriodSelector.tsx` **(Adj #3)** — Select 6 PeriodKind values + custom date range picker inline
- ➕ `admin/src/app/(dashboard)/analytics/components/CompareSelector.tsx` **(Adj #3)** — Select 5 CompareKind values (none/prev/wow/mom/yoy)
- ➕ `admin/src/app/(dashboard)/analytics/components/ComparisonPanel.tsx` — WoW/MoM/YoY comparison cards sync với header CompareSelector
- ➕ `admin/src/app/(dashboard)/analytics/components/AlertsPanel.tsx`
- ➕ `admin/src/app/(dashboard)/analytics/components/MerchantHealthSection.tsx`
- ➕ `admin/src/app/(dashboard)/analytics/components/FunnelChart.tsx`
- ➕ `admin/src/app/(dashboard)/analytics/components/Ga4Section.tsx`
- ➕ `admin/src/app/(dashboard)/analytics/components/TopRacesTabs.tsx`
- ➕ `admin/src/app/(dashboard)/analytics/components/BookingHeatmap.tsx`
- ➕ `admin/src/app/(dashboard)/analytics/components/LeadTimeHistogram.tsx`
- ➕ `admin/src/app/(dashboard)/analytics/components/RepeatCohort.tsx`
- ➕ `admin/src/app/(dashboard)/analytics/components/DemographicsChart.tsx`
- ➕ `admin/src/app/(dashboard)/analytics/components/GeographicChart.tsx`
- ➕ `admin/src/app/(dashboard)/analytics/components/ScatterChart.tsx`
- ➕ `admin/src/app/(dashboard)/analytics/components/HealthDistribution.tsx`
- ➕ `admin/src/app/(dashboard)/analytics/components/RacePerformanceTable.tsx`
- ➕ `admin/src/app/(dashboard)/analytics/components/MerchantCompTable.tsx`
- ➕ `admin/src/app/(dashboard)/analytics/components/AccordionInsights.tsx`
- ➕ `admin/src/app/(dashboard)/analytics/components/KpiConcentration.tsx` **(Adj #6)** — GMV Concentration KPI card (Top 5 races %, threshold color)

### Admin Frontend — REFACTOR files (Scope Lock v2 — updated)

- ✏️ `admin/src/app/(dashboard)/analytics/page.tsx` — Multi-tab Tab 1 + TanStack Query migration + use 3 NEW selectors via layout.tsx
- ✏️ `admin/src/app/(dashboard)/analytics/merchants/page.tsx` — Tab 3 redesign + 6 KPI cards (added Giữ chân YoY per BR-SA-26)
- ✏️ `admin/src/app/(dashboard)/analytics/funnel/page.tsx` — Tab 5 5-stage visual
- ✏️ `admin/src/app/(dashboard)/analytics/components/PeriodCompareSelector.tsx` **(Adj #3)** — Mark `@deprecated F-062 v3 — split sang PeriodSelector/CompareSelector/GranularityToggle. Xoá sau Phase 2 verify zero refs.` KHÔNG xoá ngay backward compat.
- ✏️ `admin/src/app/(dashboard)/analytics/components/ExportButton.tsx` — wire real CSV/Excel download
- ✏️ `admin/src/lib/api-hooks.ts` — add TanStack Query hooks cho 20 NEW endpoints
- ✏️ `admin/src/app/globals.css` **(Adj #5)** — Import 5Solution brand tokens (`--5s-blue`, `--5s-magenta`, `--5s-blue-600`, `--5s-blue-300`, `--5s-blue-100`) nếu chưa có

### SDK regen (auto)
- 🔄 `admin/src/lib/api-generated/sdk.gen.ts` + `types.gen.ts` — sau `pnpm --filter admin generate:api`

### OUT-OF-SCOPE (REJECT nếu Coder touch)
- ❌ `backend/src/modules/order/*` — KHÔNG đụng fee calculation core
- ❌ `backend/src/modules/finance/services/fee.service.ts` — KHÔNG đụng (chỉ inject + consume)
- ❌ `backend/src/modules/reconciliation/*` — KHÔNG đụng
- ❌ `backend/src/modules/dashboard/*` — F-059 separate
- ❌ MongoDB schema changes — N/A
- ❌ MySQL platform schema changes — N/A
- ❌ Logto auth config — N/A

---

## 🔧 Tech Approach (giữ nguyên từ v1, Coder reference)

### Backend
1. **5 new services pattern** — port từ F-058 structure: inject `@InjectDataSource('platform') + FeeService + Redis + Logger`. Use `cachedQuery + buildMetricCacheKey + calcDeltaPercent + buildDateFilter` helpers.
2. **3-enum separation (Adj #1)** — Period filter time range, Granularity decide GROUP BY bucket, Compare resolve previous range. Frontend pass 3 query params riêng `?period=&granularity=&compare=`.
3. **Aggregation pipeline** — MySQL `orders` + `athletes` JOIN named connection 'platform'. KHÔNG in-memory sort/filter cho dataset >42K orders.
4. **GA4 service stub-first** — graceful fallback `{ available: false }` nếu env vars missing. Service Account JSON key Danny cung cấp trong PROD env.
5. **Export service** — `await import('exceljs')` lazy import. UTF-8 BOM CSV cho Excel VN.
6. **Cache invalidation extension** — extend `flushEventOverrideCache()` trong `merchant.service.ts`. Use `scanStream` + pipeline DEL.
7. **PAUSE-SA-07 spot-check first** — Coder check MySQL `races.type` column existence trước khi implement Endpoint 15.

### Frontend
1. **Multi-tab layout** — `analytics/layout.tsx` Client Component (tab navigation cần useState). Server pages wrap by Client tab layout.
2. **URL search params persistence** — `useSearchParams` + `router.push` persist period/granularity/compare across tab switches.
3. **TanStack Query migration** — mỗi section 1 custom hook. Stale time 60s current / 300s historical.
4. **Brand token binding (Adj #5)** — Verify `globals.css` import `--5s-blue` etc. trước style. Use `text-[var(--5s-blue)]` arbitrary syntax cho Tailwind utilities.
5. **3 separate selectors (Adj #3)** — PeriodCompareSelector.tsx mark `@deprecated`, KHÔNG xoá. 3 NEW selectors imported via shared `layout.tsx`.
6. **BR-SA-24/25/26 frontend compute** — GMV Concentration + AOV computed từ existing data, KHÔNG cần backend endpoint mới. BR-SA-26 chỉ cần backend extend `yoyRetentionRate` field optional.

---

## 🛑 PAUSE Points cho Coder (v2 — giữ nguyên + thêm Adj checkpoints)

- 🛑 **PAUSE-SA-07** — Spot-check MySQL `races.type` column trước implement Endpoint 15.
- 🛑 **GA4 credentials** — Implement `Ga4Service` graceful fallback. Danny cung cấp service account JSON khi PROD deploy.
- 🛑 **`pnpm install exceljs`** — verify chưa có trong backend package.json.
- 🛑 **`pnpm install @google-analytics/data`** — same verify.
- 🛑 **v2 PAUSE — Brand token import (Adj #5)** — TRƯỚC khi style component đầu tiên, verify `admin/src/app/globals.css` đã import `--5s-blue` + `--5s-magenta`. Nếu chưa → import từ shared tokens file hoặc copy CSS variables từ `reference-ui-selling-web/design-system/tokens.css`.
- 🛑 **v2 PAUSE — period-resolver.ts refactor (Adj #1)** — TRƯỚC khi rename/split, verify F-026 6 endpoint cũ pass test với PeriodKind cũ 6 values. KHÔNG break backward compat.
- 🛑 **v2 PAUSE — PeriodCompareSelector deprecation (Adj #3)** — KHÔNG xoá file ngay. Mark `@deprecated` comment, keep export, search across codebase tìm các nơi import + plan migration.
- 🛑 Trước khi merge Tab 4 Runner Demographics — verify k-anonymity logic (bracket count <5 merge).
- 🛑 Trước push DEV — chạy `pnpm --filter admin generate:api` + verify 20 endpoint mới appear trong `sdk.gen.ts`.
- 🛑 Nếu phát hiện cần đụng file ngoài Scope Lock — phải hỏi Manager update plan.

---

## 🧪 Unit Test BẮT BUỘC (v2 — added Adj #1 + Adj #6 specific tests)

Coder không được mark feature `READY_FOR_QC` nếu thiếu các test sau:

### Backend test files (7 spec mới)

**`runner-analytics.service.spec.ts`** — ~30 tests:
- [ ] `getRunnerSummary()` + 5 boundaries (happy/empty/auth/delta-null/MoM)
- [ ] `getBookingHeatmap()` + 4 boundaries (happy/timezone UTC+7/maxCount/empty)
- [ ] `getLeadTime()` + 4 boundaries (happy/3d→bucket0-7/45d→bucket31-60/insight)
- [ ] `getRepeatCohort()` + 4 boundaries (happy/3races→tier3-4/sum=total/insight)
- [ ] `getDemographics()` + 5 boundaries (happy/missing DOB/missing gender/k-anonymity bracket<5/auth)
- [ ] `getGeographic()` + 4 boundaries (happy/coverage calc/empty/auth)

**`race-performance.service.spec.ts`** — ~15 tests cover Endpoint 15-17.

**`merchant-comparison.service.spec.ts`** — ~15 tests cover Endpoint 18-20 **+ Adj #6 BR-SA-26 tests:**
- [ ] `yoyRetentionRate` computed correctly khi data ≥1 năm
- [ ] `yoyRetentionRate` trả null khi data <1 năm

**`ga4.service.spec.ts`** — ~6 tests (happy/missing env→{available:false}/cache hit).

**`export.service.spec.ts`** — ~8 tests (CSV UTF-8 BOM/escape comma/max 10K/XLSX format).

**`cache-invalidation.f062.spec.ts`** — verify scanStream covers 13 NEW analytics patterns.

**`period-resolver.f062.spec.ts`** — **v2 explicit Adj #1 tests:**
- [ ] `resolveBucketSize('daily')` → bucket 1 day
- [ ] `resolveBucketSize('weekly')` → bucket ISO 8601 week
- [ ] `resolveBucketSize('monthly')` → bucket calendar month
- [ ] `CompareKind` extend: `'wow'` resolve correctly (current week vs previous week)
- [ ] `CompareKind` extend: `'mom'` resolve correctly (current month vs previous month)
- [ ] `CompareKind` extend: `'yoy'` resolve correctly (current vs same period last year)
- [ ] **REGRESSION:** F-026 endpoint vẫn pass với PeriodKind cũ 6 values

**Total target: ~80 backend unit tests (was 75 v1, +5 for Adj #1 + Adj #6 explicit tests).**

### Frontend tests
- ⚪ Spec-only docs (TD-F041-NO-TEST-RUNNER inherited). QC run manual UAT.

---

## 🌐 Strategic Upgrade Assessment (giữ nguyên từ v1, validated v3)

### Tier 1 — Foundation Strength ✅ STRONG
- Multi-tab scalable architecture
- Fee invariant binding (F-040 cascade)
- Display Convention centralized dict
- DTO-first + SDK regen
- Cache strategy comprehensive
- **v3 bonus:** 3-enum separation Period/Granularity/Compare = cleaner data flow

### Tier 2 — Competitive Parity ✅ COMPETITIVE
- RunSignup parity: ✓ YoY + UTM source + lite loyalty
- Eventbrite parity: ✓ Funnel 5-stage + GA4 native + real-time
- RaceRoster parity: ✓ Multi-event filter (Tab 2)
- ActiUp/iRace VN: DẪN ĐẦU (cả 2 KHÔNG có analytics)

### Tier 3 — Strategic Differentiation 🟡 PARTIAL → ENHANCED v3
- ✨ Runner Behavior Analytics UNIQUE (heatmap + cohort)
- ✨ Merchant Health Score RFM 5-tier
- ✨ Proactive alerts (3 trigger types)
- **v3 bonus from Adj #6 → moved up to STRATEGIC LAYER:**
  - 🌟 **GMV Concentration KPI** = leading indicator concentration risk — NONE of competitor có metric này
  - 🌟 **AOV trend với MoM/YoY** = pricing/promo team signal — competitor có nhưng KHÔNG inline trong dashboard chính
  - 🌟 **YoY Retention** = SaaS B2B benchmark metric — UNIQUE để chứng minh 5BIB platform stickiness

**MISSING (defer F-063+):** LTV per merchant, Cohort retention chart, Predictive churn ML, Cross-product attribution.

### Tier 4 — Brand & UX ✅ LOCKED v3 (was 🟡 v1)
- 5Solution brand tokens binding mandate (Adj #5)
- UI reference canonical visual baseline
- 3 selector components clean separation (Adj #3)

---

## 📅 Phasing Recommendation (giữ nguyên v1)

### Phase 1 MVP (~5,500 LoC, 2-3 sprint weeks)
- Backend: weekly/monthly + comparison + top-races-by-orders + alerts + merchant-health (+ yoyRetentionRate) + funnel 5-stage + export + cache invalidation + period-resolver refactor (Adj #1)
- Frontend: Tab 1+2+3 + layout.tsx + 3 NEW selectors (Adj #3) + KpiConcentration + globals.css brand tokens (Adj #5)
- TanStack Query migration cho 3 tabs đầu
- Tests: ~55 unit tests
- **Acceptance:** Danny demo 3 tabs với real PROD data + 3 strategic metrics live

### Phase 2 (Within F-062, ~2,900 LoC, 1-2 sprint weeks)
- Backend: runner-analytics + ga4 service + race-spotlight
- Frontend: Tab 4 (Runner) + Tab 5 (Funnel detail) + GA4 + Accordion F-026
- Tests: ~25 unit tests
- **Acceptance:** All 5 tabs live + GA4 configured

### Phase 3 (Defer F-063 nếu cần)
- LTV per merchant
- Cohort retention chart
- Predictive churn ML

---

## ✅ Verdict v2

### ✅ **APPROVED — Clean, sẵn sàng cho `/5bib-code`**

Tất cả 6 Manager Adjustments đã apply đúng spec. PRD v3 đầy đủ 28 BR-SA testable, 26 Acceptance Criteria, technical mandates rõ ràng (DB/Redis/Backend/Frontend/Brand tokens), security boundaries lock chặt, performance SLA cụ thể, 7 spec files tests đầy đủ ~80 unit tests, Scope Lock 28 file backend NEW + 6 EXTEND + 27 file admin NEW + 7 REFACTOR.

**Sẵn sàng cho `/5bib-code`?** ✅ **YES**

---

## 🔗 Next Step

1. **Danny action:** Chạy `/5bib-code FEATURE-062-sales-analytics-dashboard` — Coder bắt đầu Phase 1 MVP.
2. **Coder pre-flight:** Đọc 00-init + 01-prd v3 + 02-plan v2 + memory/conventions.md + memory/codebase-map.md analytics section.
3. **Coder spot-check trước code:**
   - Verify MySQL `races.type` column existence (PAUSE-SA-07)
   - Verify `admin/src/app/globals.css` import 5Solution tokens (PAUSE Adj #5)
   - Verify period-resolver.ts existing tests pass (PAUSE Adj #1 regression)
4. **Coder PAUSE points** trước khi `pnpm install exceljs` + `@google-analytics/data`.
5. **Sau Phase 1 ship → Coder confirm Danny demo OK → tiếp Phase 2.**
6. **/5bib-deploy memory sync** — Manager sẽ:
   - Update `feature-log.md` counter desync (Next: F-057 → F-063, append F-062 entry)
   - Append `change-history.md` entry
   - Update `codebase-map.md` analytics services tree
   - Update `architecture.md` analytics decomposition diagram
   - Update `conventions.md`:
     - "Time-series query convention" (3-enum Period/Granularity/Compare)
     - "Brand token binding" (CSS custom properties + Tailwind arbitrary value)
     - "Backward compat selector deprecation" pattern
   - Update `known-issues.md` resolved TD-F026-EXPORT-STUB + partial TD-F026-CACHE-INVALIDATE

---

## 📝 Verdict Audit Trail

| Date | Reviewer | Verdict | Note |
|------|----------|---------|------|
| 2026-05-22 (v1) | 5bib-manager | 🟡 APPROVED WITH ADJUSTMENTS | 6 BA action items |
| 2026-05-22 (v2) | 5bib-manager | ✅ **APPROVED — Clean** | All 6 adjustments verified applied |
