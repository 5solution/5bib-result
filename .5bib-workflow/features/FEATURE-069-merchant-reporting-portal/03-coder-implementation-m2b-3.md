# FEATURE-069 M2b-3: Coder Implementation — Revenue Summary (GMV + Fee + Net)

**Status:** 🟠 READY_FOR_QC
**Milestone:** M2b-3 (single-race revenue summary, finance-gated)
**Date:** 2026-06-05
**Coder:** 5bib-fullstack-engineer

---

## 1. Pre-flight check
- [x] `02-manager-plan.md` APPROVED + R3 re-review
- [x] Read `01-ba-prd*.md` (BR-MP-10 revenue, BR-MP-21b cross-tenant, BR-MP-09 financial gate) + R3 GMV SQL
- [x] Read `conventions.md` (Forced #1 try/catch, MySQL schema, MANUAL=VNĐ vs %=rate invariant) + `codebase-map.md` (M2b-1/2 merchant-portal)
- [x] Read code thật: `fee-aggregate.helpers.ts` (`pullOrdersForFeeAggregate` signature), `fee.service.ts:1108` (`computeFeeForOrdersAggregate` + `AnalyticsFeeAggregateResultDto`), `logto-merchant-finance.guard.ts` (M1), `finance.module.ts` (exports FeeService)

## 2. Impact Assessment (Phase 1)
- **MySQL** — reuses `pullOrdersForFeeAggregate` (proven F-062 helper, `financial_status='paid'` + JOIN races for tenant). No new SQL written — consume the verified helper.
- **NestJS DI** — MerchantPortalModule imports `FinanceModule` (exports FeeService — verified, no circular: FinanceModule doesn't import merchant-portal). Inject `FeeService` into `MerchantPortalService`.
- **Redis** — 1 NEW key `merchant-portal:revenue-summary:<userId>:<raceId>` TTL 60s.
- **Fee logic** — CONSUMED read-only (`computeFeeForOrdersAggregate`), NOT modified. MANUAL vs % invariant lives inside FeeService (F-040/F-058 territory untouched).
- **API** — 1 additive endpoint, finance-gated. `generate:api` deferred M4.

## 3. Edge Cases Covered (Phase 2)
1. **Viewer (no revenue_report)** → 403 `403_NO_REVENUE_PERMISSION` (service layer, defense-in-depth beyond guard) BEFORE any SQL.
2. **IDOR (race not in scope)** → 403 before order pull.
3. **Inactive account** → 403 via getAccessConfig (before permission check).
4. **Empty race (0 paid orders)** → gmv/fee/net all 0, FeeService not called (empty tenant map).
5. **Missing MerchantConfig** → FeeService Tier-3 fallback warning propagated to response `warnings[]`.
6. **GMV/fee consistency** → GMV computed from the SAME pulled order set FeeService sees (no separate query drift).

## 4. Logic & Architecture (Phase 3)
- **GMV from pulled orders, not a separate aggregate query** — `pullOrdersForFeeAggregate` already returns totalPrice + totalDiscounts per order; summing them gives GMV over EXACTLY the fee-computed set → gmv/fee/net always reconcile. Avoids a 2nd GMV SQL that could drift (different WHERE).
- **Per-tenant loop over the Map** — a single race = one tenant, but loop defensively (aggregate if data anomaly). This is also the seam M2b-3b cross-tenant will extend (BR-MP-21b).
- **2-layer permission** — LogtoMerchantFinanceGuard (Logto role `merchant_finance`) at controller + `assertRevenuePermission(config)` (config grants `revenue_report`) at service. Either failing → 403.
- **Net = GMV − totalFee** (fee incl VAT) = merchant payout basis (BR-MP-10).

## 5. Files Changed
| File | Change |
|------|--------|
| `services/merchant-portal.service.ts` | +`getRevenueSummary` + `assertRevenuePermission` + inject `FeeService` + import `pullOrdersForFeeAggregate` |
| `merchant-portal.controller.ts` | +GET `/revenue/summary` with method-level `@UseGuards(LogtoMerchantFinanceGuard)` |
| `dto/revenue-summary.dto.ts` | **NEW** — `RevenueSummaryDto` (gmv/serviceFee/manualFee/vat/totalFee/net/orderCount/warnings) |
| `merchant-portal.module.ts` | import `FinanceModule` |
| `services/merchant-portal.service.spec.ts` | +7 revenue tests + FeeService mock |
| `services/merchant-portal.adversarial.spec.ts` | +2 (Attack #9 viewer-gate, #10 cache namespacing) + FeeService mock |

## 6. Tests Written
```
PASS merchant-portal.service.spec.ts — 36 (29 prior + 7 revenue)
  getRevenueSummary — happy GMV/net math / viewer-403 / IDOR-403 / Tier3-warning / empty / inactive / cache-hit
Full module: 4 suites, 72 passed (63 prior + 9 M2b-3)
10x flaky: 72/72 × 10 deterministic
tsc: clean · Live: revenue/summary mounted, 401 no-auth, Swagger lists 6 routes
```

## 7. Scope creep
None. merchant-portal module + FinanceModule import (declared M2b dependency).

## 8. Known limitations / Tech Debt
- **TD-F069-M2b3-CROSS-TENANT-DEFER** 🟢 — BR-MP-21b "Tất cả BTC" per-tenant-loop over accessible-race-subset → M2b-3b.
- **TD-F069-M2b3-BREAKDOWN-TREND-EXPORT-DEFER** 🟢 — revenue breakdown (order_category groups BR-MP-12) + trend + Excel export → M2b-3b/M2c.
- **TD-F069-M2b3-PERIOD** 🟢 — all-time per race, no `?period=`/delta. FeeService `_period` is void-ed (orders pre-filtered) so passing a nominal wide window is correct; period-filtered revenue → M2b-3b.
- generate:api deferred M4.

## ✅ Self-Review Pipeline
- [x] Bước 1: tsc clean (Scope Lock)
- [x] Bước 2: PRD adherence — BR-MP-10 GMV/fee/net, BR-MP-09 finance-gate, FeeService consumed not modified
- [x] Bước 3: Anti-pattern clean (no console.log/any/as unknown/TODO)
- [x] Bước 4: Hand-pick audit — revenue return object explicit, all DTO fields mapped from fee result + gmv sum
- [x] Bước 5: PROD-readiness — rebuilt + booted on 8082, revenue route mounted, 401 no-auth, Swagger 6 routes
- [x] Bước 6: UI/UX — N/A backend
- [x] Bước 7: Real-world data — FeeService consumes real order shape (totalPrice/discounts/category/paymentRef); QC will cross-check live DB
- [x] Bước 8: Files vs Scope Lock — 0 creep
- [x] Bước 9: generate:api deferred M4 (documented)
- [x] Bước 10: 72 tests PASS + 10x deterministic
- [x] Bước 11: IMPLEMENTATION_NOTES-m2b-3.md written (4 sections)

→ Status: 🟠 READY_FOR_QC
