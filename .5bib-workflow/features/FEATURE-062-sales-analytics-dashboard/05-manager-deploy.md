# FEATURE-062: Deploy & Memory Sync

**Deployed:** 2026-05-25
**Status:** ✅ DONE
**Branch:** `5bib_analytics_v2` → fast-forward `main` → `release/v1.9.0`
**Manager:** 5bib-manager (Code Review MANDATE 2026-05-17 applied)

---

## 📊 Deploy Summary

| Item | Value |
|------|-------|
| Commits ahead of origin/main | 8 (pre-deploy) |
| QC verdict | ✅ APPROVED (`04-qc-report.md`) |
| Backend unit tests | 290/290 PASS |
| Files changed vs main | 81 files (+23,776 / -3,902 lines) |
| New backend endpoints | 19 analytics endpoints |
| New backend services | 5 NEW (merchant-comparison, race-performance, runner-analytics, ga4, export) |
| New shared helpers | 2 NEW (fee-aggregate.helpers.ts, bucket-helpers.ts) |
| New DTOs | 17 NEW analytics DTOs |
| Admin layout/components | 17 NEW (layout + tab nav + filter bar + 14 UI components) |
| SDK functions | 17 NEW generated functions + 17 TanStack Query hooks |
| BUG fixes in QC cycle | BUG-009 (granularity switch), BUG-010 (month/from/to @Matches), BUG-011 (@Min tenantId) |

---

## 🔬 Manager Code Review (MANDATE 2026-05-17)

**Reviewed 5 critical files per IMPLEMENTATION_NOTES Section 4 priority list + SQL injection concern:**

### File 1: `backend/src/modules/analytics/analytics.controller.ts`
- **Lines reviewed:** class-level guard + all 19 `@Get()` routes + `@ApiResponse` decorators
- **Findings:**
  - ✅ `@UseGuards(LogtoAdminGuard)` at class level — all 19 endpoints protected, no escape
  - ✅ `@ApiResponse` with 200/400/401/403 on all Wave 2 endpoints
  - ✅ Route ordering correct — specific paths before parameterized (`/merchants/scatter` before `/merchants/:id` pattern)
  - ✅ `@ApiTags('analytics')` + `@ApiOperation` on every method
- **Verdict:** CLEAN

### File 2: `backend/src/modules/analytics/services/fee-aggregate.helpers.ts`
- **Lines reviewed:** Full file (109 lines) — SQL template literal concern
- **Findings:**
  - ⚠️ Line 84 uses `${whereClause}` template literal in SQL string
  - ✅ **SAFE** — `whereClause` derived from `buildDateFilter()` which outputs only `?`-parameterized SQL fragments (`'payment_on >= ? AND payment_on < ?'` etc.)
  - ✅ `extraWhere` built from hardcoded `?` placeholder strings — values in `extraParams`
  - ✅ All user-supplied values (`tenantId`, `raceId`) go through `[...params, ...extraParams]` array parameterization
  - ✅ `buildDateFilter()` verified at lines 121-151 of `analytics.service.ts` — clause string is hardcoded SQL, user values always in params array
- **Verdict:** CLEAN — SQL injection vector confirmed safe

### File 3: `backend/src/modules/analytics/services/runner-analytics.service.ts`
- **Lines reviewed:** `getRepeatCohort()` (265-326) + `getSummaryKpi()` repeat rate calc (620-638)
- **Findings:**
  - ✅ BR-SA-20c: `COUNT(DISTINCT race_id) >= 2` correct definition of repeat runner
  - ✅ Bucket assignment: `1 / 2 / 3-4 / 5+` matches PRD spec
  - ✅ Percentage: `Math.round((count / total) * 10000) / 100` — 2 decimal places correct
  - ✅ Div-by-zero guard: `totalUniqueRunners > 0 ? ... : 0` on all percentage calcs
  - ✅ SQL parameterization: `whereClause` from `buildDateFilter()` + `?` for `tenantId` in `tenantWhere`
  - ✅ Excludes `MANUAL` orders: `AND om.order_category != 'MANUAL'` — runners who registered via manual entry not double-counted
- **Verdict:** CLEAN — business logic encodes BR-SA-20c correctly

### File 4: `backend/src/modules/analytics/dto/analytics-query.dto.ts`
- **Lines reviewed:** Full file (133 lines) — BUG-010/011 fix validation
- **Findings:**
  - ✅ BUG-010: `month` — `@Matches(/^\d{4}-(0[1-9]|1[0-2])$/)` enforces YYYY-MM with valid month 01-12
  - ✅ BUG-010b: `from`/`to` — `@Matches(/^\d{4}-\d{2}-\d{2}$/)` enforces YYYY-MM-DD format
  - ✅ BUG-011: `tenantId` — `@Min(1)` prevents negative/zero values
  - ✅ `sortOrder` — `@IsIn(['ASC', 'DESC', 'asc', 'desc'])` whitelist
  - ✅ `page` — `@Min(0)`, `limit` — `@Min(1) @Max(100)`
  - ✅ `@Type(() => Number)` coercion on all numeric query params (from query string)
  - Minor concern: `raceId` has no `@Min(1)` but it's used as a filter join condition only — not a security risk since it's parameterized SQL
- **Verdict:** CLEAN — BUG-010 + BUG-011 correctly implemented

### File 5: `admin/src/app/(dashboard)/analytics/page.tsx`
- **Lines reviewed:** BUG-009 granularity switch (249-286) + chart title render (462-474)
- **Findings:**
  - ✅ BUG-009: `granularityFromUrl = sp.get("granularity") ?? "daily"` before `useCallback`
  - ✅ Endpoint switch: `weekly → revenue/weekly`, `monthly → revenue/monthly`, else `revenue/daily`
  - ✅ Date normalization: `d.date ?? d.weekStart ?? d.month ?? ""` handles all 3 granularity field names
  - ✅ Chart title dynamic: "theo tuần" / "theo tháng" / "theo ngày" per `granularityFromUrl`
  - ✅ `useCallback` dependency array: `[token, from, to, granularityFromUrl]` — re-fetches when granularity changes
  - ✅ ARCH-001 resolved: legacy F-026 KPI strip removed, Wave 2 sections at top, F-026 accordion below per BR-SA-23
- **Verdict:** CLEAN — BUG-009 correctly implemented

### Manager Code Review Summary
- **Red flags:** 0
- **Minor concerns:** 1 (raceId missing @Min(1) — accepted, non-security, parameterized)
- **Green patterns:** SQL injection defense via buildDateFilter(), div-by-zero guards, guard class-level, DTO validators complete
- **Decision:** ✅ APPROVE DEPLOY — no blocking issues

---

## ✅ Pre-deploy Verification

| Gate | Status | Evidence |
|------|--------|----------|
| QC APPROVED | ✅ | `04-qc-report.md` final verdict ✅ APPROVED |
| IMPLEMENTATION_NOTES.md exists | ✅ | 4 sections: Deviations + Forced + Tradeoffs + Reviewer Notes |
| Unit tests pass | ✅ | 290/290 PASS (all analytics specs + regression) |
| IMPLEMENTATION_NOTES Section 1 Deviations vs BR | ✅ | 4 deviations reviewed — none conflict critical BR (financial logic, auth, fee calc) |
| Scope Lock match | ✅ | 81 files all within Plan v2 Scope Lock + declared forced changes |
| tsc clean | ✅ | Backend exit 0, admin exit 0 for F-062 files |
| 19 endpoints smoke (pre-deploy) | ✅ | All return 401 (mounted + auth-protected), none 404 |

---

## 📝 Memory Diff (Applied)

### `feature-log.md`
- ✏️ Updated: In-flight F-062 → **CLOSED** status
- ➕ Appended deploy entry (see below)
- 📌 Next counter: `FEATURE-063`

### `change-history.md`
- ➕ Appended: F-062 full deploy entry (81 files detail)

### `codebase-map.md`
- ➕ Added: 5 new analytics services under `backend/src/modules/analytics/services/`
- ➕ Added: `fee-aggregate.helpers.ts` (shared MySQL pull helper)
- ➕ Added: `bucket-helpers.ts` (ISO 8601 week bucket helper)
- ➕ Added: 17 new DTOs in `backend/src/modules/analytics/dto/`
- ➕ Added: `admin/src/app/(dashboard)/analytics/layout.tsx`
- ➕ Added: 14 new components under `admin/src/app/(dashboard)/analytics/components/`
- ➕ Added: 4 new sub-pages: `tab1/ → merchants/ → races/ → runners/`
- ➕ Added: `admin/src/lib/analytics-labels.ts` + `admin/src/lib/analytics-hooks.ts`

### `architecture.md`
- ✏️ Updated: Analytics module expanded — 19 endpoints across 5 new services + 4-tab admin UI
- ✏️ Updated: `fee-aggregate.helpers.ts` added to shared helper layer (MySQL platform DB pull)

### `conventions.md`
- ➕ Added: "Analytics filter bar URL sync" — `useSearchParams()` + `useRouter().push()` for tab-persistent filter state
- ➕ Added: "Shared MySQL pull helper extraction threshold" — extract when 3rd consumer appears
- ➕ Added: "ISO 8601 week bucket helper" — `bucket-helpers.ts` approach for weekly bucketing
- ➕ Added: "buildDateFilter() SQL safety pattern" — clause = hardcoded SQL, user values always in params[]

### `known-issues.md`
- ➕ Appended tech debts post-ship (from QC + Coder notes):
  - TD-F062-BUG-005 🟡 MED — label sliding window UX (axis labels dense for 90d daily)
  - TD-F062-BUG-008 🟡 MED — legacy Manual % > 100% guard missing (F-026 era)
  - TD-F062-GA4-SERVICE-ACCOUNT 🔴 HIGH — GA4 service account JSON not configured → GA4 tab placeholder
  - TD-F062-WAVE2C1-IN-MEMORY-SORT-LIMIT 🟢 LOW — TopRaces in-memory sort (acceptable <200 races)

---

## 🔮 Follow-up for Next Feature

- **F-063+:** counter ready — next `/5bib-init` gets F-063
- **F-039** (Analytics Per-Event/Per-Day) still INITIATED defer — Danny quyết before /5bib-init F-039
- **GA4 Service Account**: Danny needs to set `GOOGLE_APPLICATION_CREDENTIALS` env var on VPS for Tab 5 GA4 overview to work. Without it, Tab 5 returns empty gracefully (no crash per BR-SA-11 fallback).
- **PROD smoke post-deploy**: verify `result-admin-dev.5bib.com/analytics` → Tab 1-4 load, 401→login→see data, filter bar persists across tab nav
