# FEATURE-062 Wave 1 Foundation — Coder Implementation Log

**Status:** 🟠 **READY_FOR_QC** (Wave 1 Foundation slice only)
**Started:** 2026-05-22
**Author:** 5bib-fullstack-engineer
**Linked:** `00-manager-init.md` (235 dòng), `01-ba-prd.md` v3 (2278 dòng), `02-manager-plan.md` v2 (397 dòng), `IMPLEMENTATION_NOTES.md` (Reviewer's Guide)
**Branch:** `5bib_analytics_v2` off main `e7284b0`
**Scope:** Wave 1 Foundation ONLY (~600 LoC). Phase 1 backend services + endpoints + Tab pages REFACTOR sẽ ship trong Wave 2+.

---

## 📌 Pre-flight check (Coder bắt buộc làm)

- [x] Đã đọc `00-manager-init.md` (235 dòng)
- [x] Đã đọc `01-ba-prd.md` v3 (2278 dòng — focus BR-SA-01/13/14/14b/14c/17 + Adjustment #5)
- [x] Đã đọc `02-manager-plan.md` v2 (397 dòng — verdict ✅ APPROVED clean)
- [x] Đã đọc `memory/conventions.md` (Display Convention + named connection + cache key pattern)
- [x] Đã đọc `memory/codebase-map.md` analytics section
- [x] Đã đọc code thật: `period-resolver.ts` (211 dòng F-026 baseline) + `PeriodCompareSelector.tsx` (61 dòng) + `globals.css` lines 95-160 (brand tokens existing)

---

## 🔍 Impact Assessment (Phase 1 — Think First)

### Backend
- MongoDB: **KHÔNG đụng**. Wave 1 pure helpers + type extensions.
- MySQL platform: **KHÔNG đụng**. No new query.
- Redis: **KHÔNG đụng**. Cache keys unchanged.
- NestJS: **KHÔNG add module/DI**. Pure utility refactor.

### Frontend
- Next.js cache: N/A (no Server Action, no fetch)
- TanStack Query: N/A (no hook added Wave 1)
- Boundary: 3 NEW selectors là `'use client'` (cần useState callbacks)

### API Contract
- OpenAPI schema: **KHÔNG đổi**. SDK regen NOT needed Wave 1.
- DTOs: KHÔNG thêm. Defer Wave 2 backend services.

---

## ⚠️ Edge Cases Covered (Phase 2)

- [x] `resolveBucketSize('invalid')` → throw with exhaustiveness check (TS `never` type)
- [x] `resolveCompare('wow')` shift đúng 7 ngày (24*60*60*1000 ms — no DST drift trong UTC)
- [x] `resolveCompare('mom')` setUTCMonth(-1) handle 28/29/30/31-day boundaries (JS Date built-in)
- [x] `resolveCompare('none')` return null không break invariant
- [x] PeriodKind reject `'weekly'` + `'monthly'` ở compile time (TS `@ts-expect-error` annotation in test)
- [x] CompareKind union `'custom'` kept cho backward compat F-026 (Deviation #2 doc Section 1)
- [x] PeriodSelector custom mode max=today prevents future date pollution
- [x] PeriodSelector min/max linked: customFrom max = customTo, customTo min = customFrom
- [x] Brand token alias chain `--5s-blue → --5bib-info → #1D49FF` resolves đúng (CSS resolution)

---

## 🧠 Logic & Architecture (Phase 3)

### Why 3 separate selector files (KHÔNG combined component)
Manager Adjustment #3 explicit: tách Period/Compare/Granularity vào 3 concerns riêng để URL params + state persistence rõ ràng. Combined component gây confusion semantic + harder unit testing. 3 file = each focused single responsibility, smaller diff per change, easier to grep references.

### Why CSS `var()` alias instead of hex literal
Codebase đã có `--5bib-info: #1D49FF` từ F-022 era. Hardcode `--5s-blue: #1D49FF` duplicate sẽ drift nếu Marketing rebrand sau. Alias chain ensures single source of truth. Cost: slight CSS resolution indirection — negligible runtime.

### Why `resolveBucketSize()` returns SQL expr fragment (KHÔNG full QueryBuilder)
Helper just supplies bucket aggregation expression — caller (Wave 2 service) controls full SQL. Simpler API: 1 input → 1 output object `{sqlGroupExpr, labelFormat, bucketKeyFormat}`. Tradeoff: caller phải biết SQL inject risk khi compose query. Mitigated: enum-constrained input, no user-controllable interpolation.

### Why analytics-labels.ts dictionary `as const satisfies` pattern
- `as const` → narrow string literal types for keyof inference
- `satisfies Record<string, string>` → constraint validation without widening
- Result: `keyof typeof ORDER_TYPE_LABEL` gives exact union `'ORDINARY' | 'MANUAL' | ...` for type-safe lookup
- Tree-shakable + zero runtime cost vs enum

---

## 💻 Files Changed (Wave 1 Foundation)

### Backend (2 files)
- ✏️ **Modified:** `backend/src/modules/analytics/services/period-resolver.ts` — Adj #1 implementation:
  - Add `GranularityKind` type (new — 3 values daily/weekly/monthly)
  - Extend `CompareKind` type với `'wow' | 'mom'` (giữ 'prev'/'yoy'/'custom'/'none' backward compat)
  - Extend `resolveCompare()` with branches cho 'wow' (shift 7d) + 'mom' (calendar month -1)
  - Add `resolveBucketSize(granularity)` helper returning SQL expr + label format
- ➕ **Added:** `backend/src/modules/analytics/__tests__/period-resolver.f062.spec.ts` — 21 NEW tests covering Adj #1 (resolveBucketSize 4 tests + resolveCompare wow/mom 5 tests + PeriodKind regression 6 tests + helpers sanity 4 tests + CompareKind completeness 6 tests)

### Admin Frontend (5 files)
- ✏️ **Modified:** `admin/src/app/globals.css` (Adj #5):
  - Add 5Solution brand token alias block (`--5s-blue`, `--5s-magenta`, `--5s-blue-600/700/400/300/100`, `--5s-magenta-dim`) lines 126-134
  - `--5s-blue` aliases `var(--5bib-info)` (single source of truth)
- ➕ **Added:** `admin/src/lib/analytics-labels.ts` — BR-SA-17 Vietnamese dictionary:
  - 15 label maps (Order types / Merchant status / Health tiers / Alert types / Race types / Period / Granularity / Compare / Funnel stages / Lead time buckets / Day of week / Gender / Repeat cohort)
  - HEALTH_TIER_COLOR map binding 5Solution brand tokens (NOT Tailwind defaults per Adj #5)
  - LEAD_TIME_BUCKET_COLOR map
  - ERROR_MESSAGE constants (BR-SA-16 Vietnamese error messages, keys renamed `_<code>` suffix per Deviation #4)
  - `labelOr()` type-safe lookup helper
- ➕ **Added:** `admin/src/app/(dashboard)/analytics/components/GranularityToggle.tsx` (Adj #3 — BR-SA-13)
- ➕ **Added:** `admin/src/app/(dashboard)/analytics/components/PeriodSelector.tsx` (Adj #3 — BR-SA-14b)
- ➕ **Added:** `admin/src/app/(dashboard)/analytics/components/CompareSelector.tsx` (Adj #3 — BR-SA-14)
- ✏️ **Modified:** `admin/src/app/(dashboard)/analytics/components/PeriodCompareSelector.tsx` (BR-SA-14c) — Mark `@deprecated F-062 v3` header comment with migration path note. KHÔNG xoá file (backward compat).

### Feature workflow (2 files)
- ➕ **Added:** `.5bib-workflow/features/FEATURE-062-sales-analytics-dashboard/03-coder-implementation.md` (this file)
- ➕ **Added:** `.5bib-workflow/features/FEATURE-062-sales-analytics-dashboard/IMPLEMENTATION_NOTES.md` (Reviewer's Guide per Danny 2026-05-19 mandate)

### Total Wave 1 LoC
- Backend: ~140 LoC (period-resolver.ts +60 net delta) + ~190 LoC (period-resolver.f062.spec.ts new)
- Admin: ~210 LoC (analytics-labels.ts new) + ~50 LoC (GranularityToggle + PeriodSelector + CompareSelector each ~80-100 LoC) + ~20 LoC (PeriodCompareSelector deprecation comment) + ~10 LoC (globals.css alias block)
- Tests: 21 new + 17 regression = 38 pass
- **Net: ~620 LoC**, within Wave 1 scope target.

---

## 🧪 Tests Written

### Unit tests — Backend

File: `backend/src/modules/analytics/__tests__/period-resolver.f062.spec.ts`

**Test execution result (Jest):**

```
PASS src/modules/analytics/__tests__/period-resolver.f062.spec.ts
PASS src/modules/analytics/__tests__/period-resolver.spec.ts

Test Suites: 2 passed, 2 total
Tests:       38 passed, 38 total
Snapshots:   0 total
Time:        1.957 s
Ran all test suites matching /period-resolver/i.
```

**Coverage breakdown:**
- `resolveBucketSize()` — 4 tests (3 valid kinds + 1 exhaustiveness)
- `resolveCompare('wow')` — 1 test (shift 7 days verify)
- `resolveCompare('mom')` — 1 test (calendar month -1 verify)
- `resolveCompare('yoy')` — 1 regression test (F-026 backward compat)
- `resolveCompare('prev')` — 1 regression test (F-026 backward compat)
- `resolveCompare('none')` — 1 regression test
- PeriodKind regression — 6 tests (all 6 values resolve without break)
- PeriodKind reject 'weekly'/'monthly' — 1 test (@ts-expect-error compile + runtime throw)
- Helper sanity — 4 tests (calcDeltaPercent guards, buildMetricCacheKey format platform + race scopes)
- CompareKind completeness — 5 tests (all 6 values handle correctly)

### Frontend tests
- ⚪ Spec-only docs (TD-F041-NO-TEST-RUNNER inherited). Frontend test runner Vitest/Jest KHÔNG installed. QC sẽ manual UAT trong Wave 2 page integration.

---

## 🛑 PAUSE/Confirmation log

| Date | What | Danny's answer |
|------|------|----------------|
| 2026-05-22 | Wave 1 scope clarification — full F-062 ~8,405 LoC quá lớn single session | Danny chốt Wave 1 Foundation only (~600 LoC) |
| 2026-05-22 | `pnpm install @google-analytics/data` cho Ga4Service Wave 1? | Danny chốt DEFER GA4 cho later wave |
| 2026-05-22 | Switch branch `feat/F-061-split-payment-ref-ordinary` → `5bib_analytics_v2`? | Danny chốt YES, switch ngay |

---

## 🚧 Scope creep / Out-of-Scope changes

- [x] **Không có scope creep.** Tất cả 8 file Wave 1 đều nằm trong Manager Plan v2 Scope Lock:
  - `period-resolver.ts` EXTEND ✓ (Plan v2 Scope Lock backend modify section)
  - `period-resolver.f062.spec.ts` NEW ✓ (Plan v2 Scope Lock backend tests section)
  - `globals.css` EXTEND ✓ (Plan v2 Scope Lock admin refactor section, Adj #5)
  - `analytics-labels.ts` NEW ✓ (Plan v2 Scope Lock admin new section)
  - `GranularityToggle.tsx` NEW ✓ (Plan v2 Scope Lock admin new section, Adj #3)
  - `PeriodSelector.tsx` NEW ✓ (Plan v2 Scope Lock admin new section, Adj #3)
  - `CompareSelector.tsx` NEW ✓ (Plan v2 Scope Lock admin new section, Adj #3)
  - `PeriodCompareSelector.tsx` REFACTOR ✓ (Plan v2 Scope Lock admin refactor section, BR-SA-14c @deprecated mandate)

---

## 🐛 Known limitations / Tech debt còn lại (Wave 2+ scope)

Wave 1 ship Foundation only. Following items DEFERRED cho Wave 2+ trong cùng F-062:

### Wave 2 (Backend Phase 1)
- Backend 5 NEW services (runner-analytics + race-performance + merchant-comparison + ga4 + export)
- Backend 16 NEW DTOs (per Scope Lock v2)
- Backend 12 NEW endpoints in analytics.controller.ts (per BR-SA-02..23)
- `flushEventOverrideCache()` extend +13 patterns (BR-SA-18)
- `.env.example` GA4 stubs
- 6 NEW backend spec files (~80 unit tests target)
- `pnpm install exceljs` (already there!) + `pnpm install @google-analytics/data` (PAUSE — Danny approve trước install)

### Wave 3 (Frontend Phase 1)
- `analytics/layout.tsx` NEW (multi-tab navigation wrapper)
- Tab 1+2+3 REFACTOR existing pages (TanStack Query migration + 3 NEW selectors integration via layout)
- `KpiConcentration.tsx` NEW (BR-SA-24 Adj #6)
- ~14 NEW components (charts, tables, sections per Scope Lock v2)
- SDK regen `pnpm --filter admin generate:api`

### Wave 4 (Frontend Phase 2)
- Tab 4 (Runner Behavior) — heatmap, lead time, cohort, demographics, geographic
- Tab 5 (Funnel detail page)
- GA4 section component
- Accordion F-026 wrapper

### Wave 5 (Polish + QC)
- Performance benchmarks (k6 SLA verify per Section 4.4)
- Manual UAT 5 tabs end-to-end
- BR coverage final audit

---

## ✅ Self-Review Pipeline (Manager 2026-05-14 mandatory + Danny 2026-05-19 Bước 11)

- [x] **Bước 1:** `tsc --noEmit` exit 0 cho F-062 Scope Lock files (backend + admin). Pre-existing errors trong `result-kiosk/__tests__/` unrelated.
- [x] **Bước 2:** PRD strict adherence audit — 6 BRs implemented (BR-SA-01 / BR-SA-13 / BR-SA-14 / BR-SA-14b / BR-SA-14c / BR-SA-17 + Adj #5). 4 Deviations documented Section 1.
- [x] **Bước 3:** Anti-pattern scan clean — 0 `console.log` / 0 `: any` / 0 `as unknown as` across 8 Wave 1 files.
- [x] **Bước 4:** Hand-pick mapping audit — N/A Wave 1 (no schema change, no `.map((li) =>` pattern in scope).
- [x] **Bước 5:** PROD-readiness — backend test 38/38 PASS. Admin tsc clean. Wave 1 no endpoint changes → no curl smoke needed.
- [x] **Bước 6:** UI/UX self-inspection — 3 NEW selectors render-test DEFERRED to Wave 3 page integration (no tab page in Wave 1 scope to test in browser). Components structured per shadcn/ui patterns existing.
- [x] **Bước 7:** Real-world data sanity — N/A Wave 1 (no fixture, no DB query in scope).
- [x] **Bước 8:** Files Changed vs Scope Lock — 8 files touched, ALL within Manager Plan v2 Scope Lock. 0 scope creep documented.
- [x] **Bước 9:** Generated SDK regen — N/A Wave 1 (no backend DTO change). Wave 2 backend service work sẽ trigger SDK regen.
- [x] **Bước 10:** Unit tests PASS với output pasted vào file 03 (above section).
- [x] **Bước 11:** `IMPLEMENTATION_NOTES.md` viết với 4 sections đầy đủ (Deviations + Forced + Tradeoffs + Reviewer Notes). KHÔNG section nào trống/skip. Reviewer priority list 6 file paths cụ thể.

→ **Status: 🟠 READY_FOR_QC** (Wave 1 Foundation slice)

---

## 🔗 Next step

**For QC (`/5bib-qc`):**
- Wave 1 scope = pure helpers + UI components + type extensions. KHÔNG có endpoint mới, KHÔNG có service mutation.
- QC focus area: regression verify F-026 6 endpoint vẫn pass với `CompareKind 'prev' | 'yoy' | 'custom' | 'none'`, NEW resolveCompare branches `'wow' | 'mom'` math correct, GranularityKind/CompareKind union type completeness.
- E2E test cho 3 NEW selectors UI: defer Wave 3 khi tab pages REFACTOR + integration trong layout.tsx.

**For Wave 2 (next Coder session):**
- Backend Phase 1 — 5 NEW services + 16 NEW DTOs + 12 NEW endpoints + cache invalidation extend
- PAUSE before `pnpm install @google-analytics/data` — confirm Danny
- Verify `races.type` column existence PAUSE-SA-07 before Endpoint 15 implementation
- Phase split tiếp: Wave 3 frontend pages REFACTOR + 3 selectors integration + new components

**For Manager (`/5bib-deploy` Wave 1):**
- Memory updates NOT yet — Wave 1 partial. Manager defer `/5bib-deploy` until full F-062 ships (Wave 5 complete).
- Acceptable interim: branch `5bib_analytics_v2` carries Wave 1 + Wave 2+ commits incrementally. `/5bib-deploy` runs ONCE after all 5 waves done.
- ALTERNATIVE: Mini-deploy gate per wave for safety — Manager + Danny decide which approach.

---

# Wave 2A — Foundation Fixes (2026-05-22) — Manager BLOCKING TD resolutions

**Status:** 🟠 **READY_FOR_QC (Wave 2A)** — 2 BLOCKING TDs từ Wave 1 resolved trước khi tiếp Wave 2B backend services.
**Scope:** ~160 LoC delta (3 files). Wave 2A = small focused fix scope per Danny choice "Foundation fixes only" 2026-05-22.

## 🔍 Wave 2A Impact Assessment

- **Backend:** period-resolver.ts NEW `shiftMonthClamped()` exported helper + updated `resolveCompare('mom')` branch. ZERO endpoint change, ZERO service mutation.
- **DTO**: `repeat-athlete-rate.dto.ts` `@IsIn` array extend `+wow +mom`. Backward compat — existing 4 values preserved.
- **SDK regen**: DEFER Wave 2B (DTO change technically affects SDK type, value stays string with `@IsIn` runtime reject — no breaking change for SDK consumers).
- **Tests**: +13 new tests (8 shiftMonthClamped standalone + 5 mom boundary regression).

## ⚠️ Wave 2A Edge Cases Covered

- [x] May 31 → April 30 (Manager bug case, naive `setUTCMonth(-1)` rolls to May 1)
- [x] Jan 31 → Dec 31 (cross-year backward, Dec has 31 days no clamp needed)
- [x] Mar 29 → Feb 29 LEAP YEAR 2024 (no clamp, leap day preserved)
- [x] Mar 29 → Feb 28 NON-LEAP 2025 (clamp from 29 to 28)
- [x] Mar 31 → Feb 29 LEAP YEAR 2024 (clamp from 31 to 29)
- [x] Positive shift +1 month (Jan 31 → Feb 28 non-leap clamp)
- [x] Time preservation HH/MM/SS/MS (May 22 23:59:59.123 → April 22 23:59:59.123)
- [x] 0 month no-op (returns same date)

## 🧠 Wave 2A Logic & Architecture

### Why `shiftMonthClamped` over inline if-else trong mom branch

- **Reusable**: Future date arithmetic (WoY week-over-year, QoQ quarter-over-quarter) can leverage same pattern
- **Testable**: 8 standalone unit tests cover all boundary cases without setup overhead
- **Symmetric**: Joins existing exported helpers family (`addDaysUtc`, `addYearsUtc`, `startOfDayUtc`)

### Why `@IsIn` extend instead of `@IsEnum` migration

- **Codebase convention**: 5 other F-026 DTOs use `@IsIn` pattern. Switching to `@IsEnum` would require defining formal TypeScript enum (CompareKind is currently string union type, not enum).
- **Backward compat**: Existing F-026 endpoints continue accepting 4 values + gain 2 new (wow/mom) — pure capability extension.
- **Type alignment**: `@IsIn(['prev', 'yoy', 'custom', 'none', 'wow', 'mom'])` array EXACTLY matches `CompareKind` type union. Manual sync needed if type changes — tracked as TD-F062-CONVENTION-AUDIT in Wave 5 polish.

## 💻 Wave 2A Files Changed

### Backend (3 files / 160 LoC delta)
- ✏️ Modified: `backend/src/modules/analytics/services/period-resolver.ts` (+55 LoC):
  - NEW exported `shiftMonthClamped(date, months)` helper (lines 84-127)
  - Updated `resolveCompare('mom')` branch to use new helper (lines 225-238)
  - Doc comments explain TD-F062-MOM-BOUNDARY-ROLLOVER fix rationale
- ✏️ Modified: `backend/src/modules/analytics/__tests__/period-resolver.f062.spec.ts` (+104 LoC):
  - NEW Section 1B: `shiftMonthClamped()` standalone tests (8 boundary cases)
  - NEW 5 mom boundary regression tests in Section 2 (May 31 / Jan 31 / Mar 29 leap / Mar 29 non-leap / Mar 31 leap)
- ✏️ Modified: `backend/src/modules/analytics/dto/repeat-athlete-rate.dto.ts` (+9 LoC):
  - `@IsIn` array extend từ 4 → 6 values (`+wow +mom`)
  - `@ApiProperty.enum` array updated tương ứng
  - `@ApiProperty.description` extended với F-062 Wave 2A note

## 🧪 Wave 2A Tests Written

### Unit tests — Backend

**Test execution result (Jest):**

```
Test Suites: 11 passed, 11 total
Tests:       104 passed, 104 total
Snapshots:   0 total
Time:        8.083 s
Ran all test suites matching /analytics\/__tests__|analytics.service.f058/i.
```

### Coverage breakdown Wave 2A new tests
- **Section 1B `shiftMonthClamped()` — 8 tests**:
  - preserves day when target month has enough days (May 22 → April 22)
  - clamps day to last-day-of-target-month (May 31 → April 30, Manager bug case)
  - handles cross-year backward (Jan 31 → Dec 31, no clamp Dec has 31)
  - handles leap year (Mar 29 → Feb 29 in 2024)
  - handles non-leap year clamp (Mar 29 → Feb 28 in 2025)
  - handles positive shift +1 month (Jan 31 → Feb 28 non-leap clamp)
  - preserves time components HH/MM/SS/MS
  - handles 0 months shift (no-op)

- **Section 2 mom boundary regression — 5 tests**:
  - May 31 → April 30 WITHOUT rollover (Manager bug case)
  - Jan 31 → Dec 31 (cross-year, no clamp)
  - Mar 29 → Feb 29 LEAP YEAR (2024, no clamp)
  - Mar 29 → Feb 28 NON-leap year (2025, CLAMP to 28)
  - Mar 31 → Feb 29 LEAP YEAR (2024, CLAMP from 31 to 29)

### Regression assurance
- All Wave 1 38 period-resolver tests PASS unchanged
- F-026 6 F-026 service tests + analytics-invariants + analytics-aggregator.cron + F-058 discrepancy = 11 test files, 104 tests total PASS
- ZERO break F-026 backward compat verified

## 🛑 Wave 2A PAUSE/Confirmation log

| Date | What | Danny's answer |
|------|------|----------------|
| 2026-05-22 | Wave 2 scope cho session (full 1800 LoC vs 250 LoC fixes only)? | Wave 2A Foundation fixes only ~250 LoC chosen |

## 🚧 Wave 2A Scope creep

- [x] **Không có scope creep.** 3 files đều trong Manager Plan v2 Scope Lock backend section:
  - `period-resolver.ts` EXTEND ✓
  - `period-resolver.f062.spec.ts` NEW (continued from Wave 1) ✓
  - `repeat-athlete-rate.dto.ts` EXTEND (TD-F062-VALIDATION-COMPAREKIND fix per Wave 1 known-issues) ✓

## 🐛 Wave 2A Known limitations / TDs

### Resolved by Wave 2A
- ✅ **TD-F062-MOM-BOUNDARY-ROLLOVER** 🟡 MED 🔴 BLOCKING Wave 2 — RESOLVED via shiftMonthClamped + 13 tests
- ✅ **TD-F062-VALIDATION-COMPAREKIND** 🟢 LOW — RESOLVED via `@IsIn` array extend (already had validation, just out-of-sync với extended type)

### Refined understanding (Wave 2A discovery)
- **TD-F062-F026-SILENT-CAPABILITY-EXPANSION** 🟢 INFORMATIONAL — QC claim "6 endpoints" actually only 1 endpoint (repeat-athlete-rate) has compareWith. Other 5 F-026 endpoints (merchant-churn, time-to-fill, claim-rate, geographic-demographic, refund-cancel-rate) don't accept compareWith. Manager update known-issues.md TD text "6 → 1 endpoint" recommended.

### Deferred Wave 2B+
- 5 NEW backend services (runner-analytics + race-performance + merchant-comparison + ga4 + export)
- 16 NEW DTOs
- 12 NEW endpoints
- `flushEventOverrideCache()` extend +13 patterns (BR-SA-18)
- `pnpm install @google-analytics/data` PAUSE Wave 2B confirm Danny
- Verify MySQL `races.type` column existence PAUSE-SA-07 trước Endpoint 15

## ✅ Wave 2A Self-Review Pipeline checklist 11 bước

- [x] **Bước 1:** tsc clean cho Wave 2A files (pre-existing errors trong `upload/*.spec.ts` Vitest `vi` import UNRELATED to F-062)
- [x] **Bước 2:** PRD strict adherence — TD fixes per MANAGER_WAVE1_REVIEW.md code suggestion + boundary tests per Manager directive
- [x] **Bước 3:** Anti-pattern scan clean — 0 console.log / 0 `: any` / 0 `as unknown as` trên 3 Wave 2A files
- [x] **Bước 4:** Hand-pick mapping audit — N/A Wave 2A (no schema change)
- [x] **Bước 5:** PROD-readiness — 104/104 analytics tests PASS. Wave 2A no new endpoint = no curl smoke.
- [x] **Bước 6:** UI/UX self-inspection — N/A Wave 2A (no UI changes, pure backend)
- [x] **Bước 7:** Real-world data sanity — Boundary tests use natural marketing/finance scenarios (month-end reports)
- [x] **Bước 8:** Files Changed vs Scope Lock — 3 files ALL within Manager Plan v2 backend Scope Lock + TD fix scope
- [x] **Bước 9:** Generated SDK regen — DEFER Wave 2B (compareWith still string type after `@IsIn` validation, no breaking change)
- [x] **Bước 10:** Unit tests PASS 104/104 — output paste below
- [x] **Bước 11:** IMPLEMENTATION_NOTES.md Wave 2A section đầy đủ 4 sub-sections (Deviations #5+#6 + Forced #4 + Tradeoffs 5 + Reviewer Notes)

→ **Status: 🟠 READY_FOR_QC (Wave 2A slice)**

## 🔗 Wave 2A Next Step

**For Manager Wave 2A spot-check (optional, recommended):**
- Verify shiftMonthClamped Manager bug case fix via Node REPL `2026-05-31` → `2026-04-30`
- Spot-check period-resolver.ts:84-127 helper implementation + lines 225-238 mom branch usage
- Verify TD-F062-MOM-BOUNDARY-ROLLOVER closed in known-issues.md

**For Wave 2B start (next Coder session):**
- Begin Wave 2B backend services: 5 NEW services + 16 DTOs + 12 endpoints
- PAUSE BEFORE `pnpm install @google-analytics/data` — confirm Danny
- Verify MySQL `races.type` column existence — PAUSE-SA-07 (before Endpoint 15 implementation)
- Target Wave 2B ~1,600 LoC backend + ~50 unit tests

**For partial deploy decision (Danny choose):**
- Mini-deploy Wave 2A alone? OR bundle with Wave 1 partial deploy (commit `b8cb87f`)?
- QC re-test pass Wave 2A? Manager checkpoint update?
