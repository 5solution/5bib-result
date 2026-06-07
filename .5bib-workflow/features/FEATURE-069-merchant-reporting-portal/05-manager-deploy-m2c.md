# FEATURE-069 M2c: Deploy & Memory Sync (PARTIAL — BACKEND COMPLETE)

**Status:** ✅ DONE (M2c partial — feature stays IN-FLIGHT; backend reporting layer 100% complete)
**Deployed:** 2026-06-05
**Milestone:** M2c (revenue trend + Excel export + order-PII show-full fold-in)
**Branch:** `5bib_merchant_v1`

---

## Pre-flight
- [x] `04-qc-report-m2c.md` = ✅ APPROVED (live-DB trend reconcile + order-PII verified)
- [x] 98 module tests / 10x deterministic / tsc clean
- [x] Files match M2c plan Scope Lock + order-PII fold-in — 0 creep
- [x] `IMPLEMENTATION_NOTES-m2c.md` present, 4 sections

## Manager Independent Code Review (3 hotspots)
1. `getRevenueTrend` — ✅ guard order config→perm→resolve→assertRaceAccessible (L9-11); date clause `om.payment_on >= ? AND < ?` bound; bucket in-memory; FeeService per tenant per bucket; net = gmv − fee.
2. `getRevenueExport` — ✅ reuses getRevenueSummary + getRevenueByCategory (both finance+scope gated → inherits 403/404); exceljs writeBuffer → Buffer; controller `@Res` + Content-Disposition `filename="5bib-merchant-revenue-race-${raceId}"` (raceId validated int — no header injection).
3. order-PII — ✅ SELECT adds `om.email, om.phone_number`; grep confirms NO `om.total_price`/`om.total_discounts` (financial still excluded, BR-MP-09).
**0 red flags. BACKEND F-069 COMPLETE.**

## Memory diff (applied)
- `feature-log.md` — in-flight F-069 → "🟠 M2c SHIPPED — BACKEND COMPLETE 100%" + 13 endpoints. Counter unchanged.
- `change-history.md` — M2c entry (in-memory bucketing + fee-rounding lesson).
- `codebase-map.md` — merchant-portal entry + revenue trend/export + 13 endpoints.
- `known-issues.md` — ✅ RESOLVED TD-F069-M2b2b-ORDER-PII; +3 NEW LOW (trend-fee-rounding, trend-fee-perbucket, export-no-trend-sheet).
- `conventions.md` — no new (exceljs/`@Res` = F-062 precedent).

## Follow-up — Backend DONE, remaining = UI + infra
- **M3** — admin UI `/admin/merchant-portal` (gán quyền merchant: consume 7 M2a admin endpoints). Unlocks E2E test với merchant thật.
- **M4** — merchant portal frontend merchant.5bib.com (consume 13 merchant endpoints; build `merchant-labels.ts` dicts: ORDER_FINANCIAL_STATUS, RACE_STATUS, ORDER_CATEGORY_GROUP; charts via recharts/AnStacked).
- **M5** — infra (merchant.5bib.com subdomain + nginx + SSL + docker-compose).
- **Open TDs to fold into M3/M4:** trend-fee UI note ("tổng phí chính xác xem ở Tổng quan"), TD-F069-M2a-DUP-MONGOOSE-INDEX (cosmetic schema fix), generate:api (run at M4 when frontend consumes SDK).

## Status
🟠 **FEATURE-069 M2c PARTIAL DONE — BACKEND REPORTING LAYER 100% COMPLETE.** 13 endpoints live on localhost 8081, all 401-guarded, full-stack coherent. Remaining work is pure frontend (M3 admin UI + M4 merchant frontend) + infra (M5).
