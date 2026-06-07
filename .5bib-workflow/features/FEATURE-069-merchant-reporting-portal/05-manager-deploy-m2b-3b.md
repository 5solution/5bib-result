# FEATURE-069 M2b-3b: Deploy & Memory Sync (PARTIAL)

**Status:** ✅ DONE (M2b-3b partial — feature stays IN-FLIGHT)
**Deployed:** 2026-06-05
**Milestone:** M2b-3b (revenue by-category BR-MP-12 Option A + cross-tenant aggregate BR-MP-21b)
**Branch:** `5bib_merchant_v1`

---

## Pre-flight
- [x] `04-qc-report-m2b-3b.md` = ✅ APPROVED (2 live-DB cross-checks)
- [x] 80 module tests / 10x deterministic / tsc clean
- [x] Files match M2b Scope Lock — 0 creep
- [x] `IMPLEMENTATION_NOTES-m2b-3b.md` present, 4 sections (2 deviations)

## Manager Independent Code Review (5 hotspots)
1. `getRevenueAggregate` — ✅ guard config→perm→resolve; loop `cfg.tenantIds`; **`accessible.has(o.raceId)` filter** prevents cross-tenant leak (Attack #11: race 502/888888 excluded, gmv stays 100k); FeeService per tenant (own config); skip-empty-tenant.
2. `getRevenueByCategory` / `categoryGroup` — ✅ `=== 'MANUAL' ? fee_fixed : fee_percent` null-safe, Option A exact (R3 line 285). Per-group FeeService, always-both-groups 0-fill.
3. Controller — ✅ both `/revenue/by-category` + `/revenue/aggregate` method-level `@UseGuards(LogtoMerchantFinanceGuard)`.
4. SQL injection — ✅ `${}` in service are placeholder-only (M2b-1 resolve helper); M2b-3b methods use parameterized `pullOrdersForFeeAggregate`. No value interpolation.
5. Fee — ✅ consumed read-only (finance/ untouched, verified M2b-3).
**0 red flags.**

## Memory diff (applied)
- `feature-log.md` — in-flight F-069 → "🟠 M2b-3b SHIPPED" + "Backend reporting layer ĐẦY ĐỦ". Counter unchanged.
- `change-history.md` — M2b-3b entry (aggregate filter, Option A, live-DB lesson).
- `codebase-map.md` — merchant-portal entry extended + "8 endpoints live" + reporting-layer-complete note.
- `known-issues.md` — ✅ RESOLVED TD-F069-M2b3-CROSS-TENANT-DEFER + breakdown half; +2 NEW LOW (include-outside-tenant, tenant-name).
- `conventions.md` — no new (Option A + 2-layer gate reuse).

## Follow-up
- **Backend reporting layer of F-069 is COMPLETE** (ticket-sales + revenue summary + by-category + cross-tenant aggregate). 8 endpoints live on 8082.
- **M2c:** revenue trend + Excel export (remaining half of breakdown-trend-export TD).
- **M2b-2b (optional):** ticket-sales chart endpoints (trend AreaChart + AnStacked + order-detail-table).
- **M3:** admin UI (`/admin/merchant-portal` gán quyền — consume M2a 7 admin endpoints).
- **M4:** merchant portal frontend (merchant.5bib.com — consume the 8 merchant endpoints; build `merchant-labels.ts` ORDER_CATEGORY_GROUP + ORDER_FINANCIAL_STATUS + RACE_STATUS dicts).
- **M5:** infra (merchant.5bib.com subdomain + nginx + SSL).

## Status
🟠 **FEATURE-069 M2b-3b PARTIAL DONE** — memory synced, feature IN-FLIGHT. Backend reporting layer complete; remaining work is charts (M2b-2b/M2c) + UI (M3/M4) + infra (M5).
