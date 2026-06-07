# FEATURE-069 M2b-3 — Implementation Notes (Reviewer's Guide)

**Milestone:** M2b-3 — Revenue summary (GMV + fee + net, finance-gated)
**Date:** 2026-06-05

---

## Section 1: 🚧 Deviations from Spec (intentional)

- **[Deviation #1] M2b-3 = single-race revenue summary only; cross-tenant (BR-MP-21b) + breakdown/trend/export deferred to M2b-3b**
  - **Spec said:** PRD R2 GAP#3 + BR-MP-21b describe a per-tenant-loop cross-tenant aggregate ("Tất cả BTC") + revenue breakdown/trend/export.
  - **I did:** Shipped `GET /revenue/summary?raceId=X` (one race, GMV/fee/net). Deferred cross-tenant + breakdown/trend/export.
  - **Why:** A single race = exactly one tenant → no per-tenant loop complexity, no accessible-race-subset scoping. This is the core merchant use case and the tightest correct slice. Cross-tenant loops over the accessible-race-subset (with include/exclude overrides) is materially riskier and deserves its own QC pass. The `getRevenueSummary` per-tenant loop seam already exists, so M2b-3b extends rather than rewrites.
  - **Reviewer should check:** TD-F069-M2b3-CROSS-TENANT-DEFER tracks it. Confirm M2b-3b reuses the same FeeService consumption + GMV-from-orders pattern.

- **[Deviation #2] GMV computed from pulled orders, NOT a separate R3 GMV aggregate query**
  - **Spec said:** R3 line 177 gives a standalone GMV SQL `SUM(total_price - COALESCE(total_discounts,0))`.
  - **I did:** Sum `(totalPrice − totalDiscounts)` over the orders `pullOrdersForFeeAggregate` returns.
  - **Why:** Using the SAME order set FeeService computes fee on guarantees gmv/fee/net reconcile exactly. A separate GMV query with a slightly different WHERE could drift from the fee's order set → net mismatch. Single source of truth.
  - **Reviewer should check:** `pullOrdersForFeeAggregate` filters `financial_status='paid'` (matches R3 GMV filter) — verified in helper L84. So GMV-from-orders == R3 GMV SQL result. QC cross-checks on live DB.

## Section 2: ⚙️ Forced Changes (reality ≠ spec)

- **[Forced #1] FeeService.computeFeeForOrdersAggregate `_period` arg is void-ed**
  - **PRD assumed:** revenue is period-filtered (BR-MP-25 payment_on).
  - **Reality:** `fee.service.ts:1118` does `void _period` — orders are pre-filtered by the caller, period is a docs-only param. FeeService computes over whatever orders you pass.
  - **Workaround:** Pass a wide nominal window `{from:'1970-01-01', to:'2999-12-31'}` (orders already scoped to the race's paid set). Period-filtered revenue (date range) → M2b-3b via `pullOrdersForFeeAggregate(db, clause, params)` with buildDateFilter.
  - **Manager/BA action:** None — correct usage. M2b-3b adds real date filtering at the pull layer, not the fee layer.

- **[Forced #2] FeeService returns `totalNetGmv` but it's "5BIB-eligible only" — NOT the merchant GMV**
  - **PRD assumed:** could reuse FeeService's net.
  - **Reality:** `AnalyticsFeeAggregateResultDto.totalNetGmv` = "Tổng net GMV qua các orders đã tính (5BIB-eligible only)" — a fee-internal figure, not gross GMV.
  - **Workaround:** Compute gross GMV myself from orders; use FeeService ONLY for `totalFee` (+ breakdown serviceFee/manualFee/vat). Net = my GMV − totalFee.
  - **Manager/BA action:** Note in codebase-map: FeeService.totalNetGmv ≠ gross GMV — don't confuse.

## Section 3: ⚖️ Tradeoffs Considered

| Decision | Chosen | Alternative | Why | Cost paid |
|----------|--------|-------------|-----|-----------|
| GMV source | Sum pulled orders | Separate R3 GMV SQL | gmv/fee/net reconcile, one order set | Hold orders in memory (small — one race) |
| Permission gate | Guard + service-layer `assertRevenuePermission` | Guard only | Defense-in-depth; config.permissions can differ from Logto role | One extra array check |
| Fee compute | Consume FeeService | Re-implement fee cascade | Single source of fee truth (F-040/F-058 invariant), zero drift | Cross-module dep on FinanceModule |
| Period | Wide nominal (void-ed) | Wire period-resolver now | Slice stays tight; FeeService voids it anyway | No date-filtered revenue until M2b-3b |
| Cross-tenant | Defer M2b-3b | Loop now | Riskier scoping deserves own QC | "All BTC" view not available yet |

## Section 4: 🔬 Reviewer Notes — Priority spot-check order

1. **`merchant-portal.service.ts` `getRevenueSummary`** — verify ORDER of guards: getAccessConfig (404/403-inactive) → assertRevenuePermission (403 no revenue_report) → resolveAccessibleRaces+assert (403 IDOR) → THEN cached pull. All 3 gates BEFORE any order data is pulled (adversarial Attack #9 proves zero `db.query` for unauthorized viewer).
2. **GMV math** — `gmv += (totalPrice ?? 0) − (totalDiscounts ?? 0)` over every order; `net = gmv − totalFee`. QC cross-checks against live DB R3 GMV SQL (must match since same paid filter).
3. **`assertRevenuePermission`** — service-layer 403 even if guard bypassed. Plus controller `@UseGuards(LogtoMerchantFinanceGuard)` (merchant_finance only). Two independent layers.
4. **`merchant-portal.module.ts`** — `FinanceModule` import (exports FeeService). Verify no circular (FinanceModule import list has no merchant-portal). Backend booted clean on 8082 → DI resolves.
5. **`cachedTicketRead` reuse** — revenue uses the same Forced #1-compliant cache helper. Key `merchant-portal:revenue-summary:<userId>:<raceId>` (Attack #10 per-user+per-race namespacing).

### Security checklist self-applied
- [x] Controller: `LogtoMerchantFinanceGuard` (merchant_finance only) — viewer 403.
- [x] Service: `assertRevenuePermission` (config.revenue_report) — defense-in-depth.
- [x] IDOR: `assertRaceAccessible` before pull.
- [x] No raw value SQL — `pullOrdersForFeeAggregate` is parameterized; raceId bound via `{raceId}` filter → `om.race_id = ?`.
- [x] Financial data ONLY behind the finance gate; ticket endpoints (M2b-2) carry NO financial fields.

### Edge cases tested vs deferred
- ✅ Tested: viewer 403, IDOR 403, inactive 403, empty race (no FeeService call), Tier-3 warning propagation, GMV/net math, cache hit, cache namespacing.
- ⚠️ Deferred: cross-tenant aggregate, period/date filter + delta, revenue breakdown by order_category (BR-MP-12), live p95 (M5).
