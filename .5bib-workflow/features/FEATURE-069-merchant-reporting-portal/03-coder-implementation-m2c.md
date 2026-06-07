# FEATURE-069 M2c: Coder Implementation — Revenue Trend + Excel Export + Order-PII

**Status:** 🟠 READY_FOR_QC
**Milestone:** M2c (revenue trend + Excel export + order-table PII fold-in)
**Date:** 2026-06-05
**Coder:** 5bib-fullstack-engineer

---

## 1. Pre-flight check
- [x] `02-manager-plan-m2b-2b-m2c.md` APPROVED (incl order-PII fold-in directive)
- [x] Read conventions + codebase-map (FeeService.totalNetGmv quirk, Forced #1 try/catch)
- [x] Read code: F-062 `export.service.ts` (exceljs Workbook→writeBuffer→Buffer), analytics export controller (`@Res` + setHeader + send), `pullOrdersForFeeAggregate` clause pattern, bucket-helpers (ymdUtc/dateToWeekKey/dateToMonthKey/normalizePaymentOn)
- [x] exceljs@4.4.0 present → no `pnpm install`

## 2. Impact Assessment (Phase 1)
- **MySQL** — revenue/trend pulls paid orders w/ `payment_on` date clause; export reuses summary+by-category (no new query). order-PII = +2 columns in existing orders SELECT.
- **NestJS** — 2 methods + 2 routes (trend DTO, export `@Res` stream). `ExcelJS` imported (present). FinanceModule already wired.
- **Redis** — 1 NEW key `merchant-portal:revenue-trend:<userId>:<raceId>:<periodKey>:<granularity>` 60s. export uncached.
- **API** — 2 additive + order DTO gains buyerEmail/buyerPhone (additive, no break). generate:api M4.

## 3. Edge Cases Covered (Phase 2)
1. Viewer (no revenue_report) → 403 before pull (trend + export, latter via getRevenueSummary).
2. IDOR → assertRaceAccessible before pull.
3. Empty period → empty trend series, FeeService not called.
4. In-memory bucketing handles orders across day/week/month boundaries (UTC keys).
5. Export reuses scope-checked summary/by-category → inherits 403/404.
6. order-PII: email/phone null-safe (`?? null`).

## 4. Logic & Architecture (Phase 3)
- **Revenue trend buckets IN-MEMORY** (not SQL) because FeeService needs the order OBJECTS per bucket (cascade is per-order). Pull with `payment_on` date clause, group via bucket-helpers (UTC keys), FeeService per tenant per bucket.
- **FeeService per bucket** = N calls (cascade can't be aggregated-then-split). Cached 60s. Perf TD flagged.
- **Export = exceljs Workbook** (2 sheets) reusing getRevenueSummary + getRevenueByCategory (both finance+scope gated) → buffer; controller streams via `@Res` + Content-Disposition (F-062 pattern).
- **Order-PII** (Danny show-full): +`om.email, om.phone_number` to SELECT + DTO buyerEmail/buyerPhone. `total_price` STILL excluded (BR-MP-09).

## 5. Files Changed
| File | Change |
|------|--------|
| `services/merchant-portal.service.ts` | +`getRevenueTrend` + `getRevenueExport` + `dateBucketKeyLabel` + ExcelJS import + bucket-helpers imports; `getTicketSalesOrders` +email/phone |
| `merchant-portal.controller.ts` | +GET `/revenue/trend` + `/revenue/export` (`@Res` stream); `Res`/`Response` imports |
| `dto/revenue-trend.dto.ts` | **NEW** — RevenueTrendDto + point |
| `dto/ticket-charts.dto.ts` | `TicketOrderRowDto` +buyerEmail/buyerPhone |
| service + adversarial specs | +5 M2c tests; order test + Attack #13 updated for show-full |

## 6. Tests Written
```
PASS merchant-portal.service.spec.ts (58: 53 prior + 5 M2c)
  getRevenueTrend — bucket gmv/fee/net / viewer-403 / empty
  getRevenueExport — xlsx buffer (PK magic) + filename + mime / viewer-403
  (order test updated: buyerEmail/buyerPhone show-full, total_price still excluded)
Full module: 4 suites, 98 passed (93 prior + 5 M2c)
10x flaky: 98/98 × 10 deterministic
tsc clean · Live 8081: 13 endpoints, 2 M2c routes 401-guarded
```

## 7. Scope creep
None. merchant-portal module + order-PII fold-in (Manager-approved in M2c plan).

## 8. Known limitations / Tech Debt
- **TD-F069-M2c-TREND-FEE-PERBUCKET** 🟢 — revenue/trend calls FeeService once per non-empty bucket per tenant (each loads MerchantConfig). Daily 90d = up to 90 calls. Cached 60s; merchant-report scale (not race-day hot). Optimize later by injecting MerchantConfig once + passing `injectedConfig` to each bucket call.
- **TD-F069-M2c-EXPORT-NO-TREND-SHEET** 🟢 — export workbook v1 = Summary + By-Category only (no Trend/cross-tenant sheet). Add sheets later if product wants.
- generate:api deferred M4.

## ✅ Self-Review Pipeline
- [x] Bước 1: tsc clean
- [x] Bước 2: PRD adherence — revenue trend/export per Manager M2c plan, order-PII per Danny decision
- [x] Bước 3: Anti-pattern clean (no console.log/any/as-unknown-as; `as ArrayBuffer` exceljs standard)
- [x] Bước 4: Hand-pick — order row maps +buyerEmail/buyerPhone; trend point maps all fields
- [x] Bước 5: PROD-readiness — rebuilt + booted 8081, 13 endpoints, 2 M2c 401
- [x] Bước 6: UI/UX — N/A backend
- [x] Bước 7: Real-world — export emits real PK-zip xlsx; trend on real order shape
- [x] Bước 8: Files vs Scope Lock — 0 creep
- [x] Bước 9: generate:api deferred M4
- [x] Bước 10: 98 tests PASS + 10x
- [x] Bước 11: IMPLEMENTATION_NOTES-m2c.md written (4 sections)

→ Status: 🟠 READY_FOR_QC
