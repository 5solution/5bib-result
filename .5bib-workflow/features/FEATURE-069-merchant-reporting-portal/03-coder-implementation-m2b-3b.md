# FEATURE-069 M2b-3b: Coder Implementation — Revenue Breakdown + Cross-Tenant Aggregate

**Status:** 🟠 READY_FOR_QC
**Milestone:** M2b-3b (revenue by-category BR-MP-12 + cross-tenant aggregate BR-MP-21b)
**Date:** 2026-06-05
**Coder:** 5bib-fullstack-engineer

---

## 1. Pre-flight check
- [x] M2b plan APPROVED + R3 data layer + BR-MP-12 Option A DECIDED (Danny 2026-06-05)
- [x] Read PRD (BR-MP-12 grouping, BR-MP-21b per-tenant loop) + R3 line 285 (Option A grouping source)
- [x] Read `conventions.md` (Forced #1, fee invariant, Display Convention) + `codebase-map.md` (M2b-3 revenue seam)
- [x] Read code: `getRevenueSummary` (per-tenant loop seam to extend), `pullOrdersForFeeAggregate` (has orderCategory+raceId), `FeeService`, `LogtoMerchantFinanceGuard`

## 2. Impact Assessment (Phase 1)
- **MySQL** — reuses `pullOrdersForFeeAggregate` (no new SQL). by-category: 1 race pull. aggregate: N pulls (one per `cfg.tenantIds`).
- **NestJS** — 2 methods on `MerchantPortalService` + 2 GET routes. FinanceModule already imported (M2b-3). No new DI.
- **Redis** — 2 NEW keys: `merchant-portal:revenue-by-category:<userId>:<raceId>` + `merchant-portal:revenue-aggregate:<userId>`, 60s.
- **Fee** — consumed read-only (per-group + per-tenant FeeService calls). Fee logic untouched.
- **API** — 2 additive finance-gated endpoints. generate:api deferred M4.

## 3. Edge Cases Covered (Phase 2)
1. **Viewer (no revenue_report)** → 403 before SQL (both endpoints).
2. **by-category: empty group** → always emits both groups 0-filled; FeeService NOT called for empty partition.
3. **aggregate: race outside accessible set** → filtered out (Attack #11 exclude-override 888888 excluded).
4. **aggregate: tenant with 0 accessible orders** → row skipped (no empty rows).
5. **null order_category** → fee_percent (Option A null-safe).
6. **IDOR (by-category race not accessible)** → 403.

## 4. Logic & Architecture (Phase 3)
- **by-category Option A:** `categoryGroup(cat) = cat==='MANUAL' ? 'fee_fixed' : 'fee_percent'` (null/unknown → percent, R3 line 285). Partition each tenant's orders → 2 groups → FeeService per non-empty partition → GMV/fee/net per group. Always emit both groups (0-fill) for stable frontend.
- **aggregate per-tenant loop (BR-MP-21b):** loop `cfg.tenantIds` (= agency's BTC); pull each tenant's paid orders; **filter to accessible race set** (applies draft/include/exclude); FeeService per tenant (each tenant's own fee config). Sort byTenant gmv DESC, sum totals. Skip empty-tenant rows.
- **Why filter-in-memory not SQL race-list:** `pullOrdersForFeeAggregate` takes single tenantId/raceId, not a race LIST. Pulling per-tenant then filtering to `accessible.has(raceId)` is correct + reuses the proven helper. Cost: pulls a tenant's full paid set then drops non-accessible (bounded — one tenant's orders).
- **Display Convention:** backend returns raw `groupKey` (fee_percent/fee_fixed) — frontend maps VN (M4).

## 5. Files Changed
| File | Change |
|------|--------|
| `services/merchant-portal.service.ts` | +`getRevenueByCategory` + `getRevenueAggregate` + `categoryGroup` helper + `NOMINAL_PERIOD` static |
| `merchant-portal.controller.ts` | +GET `/revenue/by-category` + `/revenue/aggregate` (both `LogtoMerchantFinanceGuard`) |
| `dto/revenue-breakdown.dto.ts` | **NEW** — RevenueCategoryGroupDto + RevenueByCategoryDto + RevenueTenantRowDto + RevenueAggregateDto |
| `services/merchant-portal.service.spec.ts` | +6 tests (by-category 3 + aggregate 3) |
| `services/merchant-portal.adversarial.spec.ts` | +2 (Attack #11 exclude-override, #12 by-category viewer-403) + mockFee ref |

## 6. Tests Written
```
PASS merchant-portal.service.spec.ts (42: 36 prior + 6 M2b-3b)
  getRevenueByCategory — Option A grouping / always-both-groups / viewer-403
  getRevenueAggregate — cross-tenant filter+sort / skip-empty-tenant / viewer-403
Full module: 4 suites, 80 passed (72 prior + 8 M2b-3b)
10x flaky: 80/80 × 10 deterministic
tsc clean · Live: 8 endpoints mounted on 8082, both new revenue routes 401-guarded
```

## 7. Scope creep
None. merchant-portal module only (FinanceModule already imported M2b-3).

## 8. Known limitations / Tech Debt
- **TD-F069-M2b3b-INCLUDE-OUTSIDE-TENANT** 🟢 — aggregate loops `cfg.tenantIds`; include-override races to tenants OUTSIDE the agency are NOT in the rollup (they appear in /races + single-race revenue). BR-MP-21b "agency BTC" intent. Documented.
- **TD-F069-M2b3b-TENANT-NAME** 🟢 — aggregate returns `tenantId` only, no BTC name. Frontend (M3/M4) or future Tenant-repo enrichment.
- **TD-F069-M2b3-TREND-EXPORT-DEFER** 🟢 — revenue trend + Excel export still deferred → M2c.
- generate:api deferred M4.

## ✅ Self-Review Pipeline
- [x] Bước 1: tsc clean
- [x] Bước 2: PRD — BR-MP-12 Option A grouping verbatim, BR-MP-21b per-tenant loop, BR-MP-09 finance-gate
- [x] Bước 3: Anti-pattern clean
- [x] Bước 4: Hand-pick — group/tenant return objects explicit, all DTO fields mapped
- [x] Bước 5: PROD-readiness — rebuilt + booted 8082, 8 endpoints, new routes 401
- [x] Bước 6: UI/UX — N/A backend
- [x] Bước 7: Real-world — FeeService real order shape; QC live-DB cross-check recommended
- [x] Bước 8: Files vs Scope Lock — 0 creep
- [x] Bước 9: generate:api deferred M4
- [x] Bước 10: 80 tests PASS + 10x
- [x] Bước 11: IMPLEMENTATION_NOTES-m2b-3b.md written (4 sections)

→ Status: 🟠 READY_FOR_QC
