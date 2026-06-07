# FEATURE-069 — Manager Plan Addendum: M2b-2b (ticket charts) + M2c (revenue trend/export)

**Status:** ✅ APPROVED (within already-approved M2 scope; this is a Scope-Lock addendum, not a new feature)
**Reviewed:** 2026-06-05
**Reviewer:** 5bib-manager
**Linked:** existing `02-manager-plan.md` (R2) + `01-ba-prd-revision-r3.md` (data layer) + R2 AnStacked spec

> Manager spot-checked helpers exist before approving (mandate 2026-05-17):
> `analytics/services/bucket-helpers.ts` (ymdUtc/dateToWeekKey/dateToMonthKey/weekKeyToRange/monthKeyToRange/labelFor*/normalizePaymentOn) ✓
> `analytics/services/period-resolver.ts` (PeriodKind 7d/30d/90d/quarter/year/custom/rolling12m, GranularityKind daily/weekly/monthly) ✓
> `exceljs@4.4.0` + `analytics/services/export.service.ts` (F-062 precedent) ✓ → **M2c export needs NO new dep (no PAUSE)**

---

## Recommended sequencing
Ship as **2 separate Coder slices** (mirror established M2b pattern, keep each QC-able):
1. **M2b-2b** first — ticket charts (no finance complexity, LogtoMerchantGuard).
2. **M2c** after — revenue trend + export (finance-gated, FeeService-per-bucket, exceljs).

---

## M2b-2b — Ticket Sales chart endpoints (BR-MP-07 Phase 1 charts)

All under `MerchantPortalController` + `LogtoMerchantGuard` (ticket = NO financial, BR-MP-09). Reuse `assertRaceForUser` (scope+IDOR) + `cachedTicketRead`. Reuse `period-resolver` + `bucket-helpers` from analytics.

### Scope Lock (Coder may ONLY touch):
- ✏️ `services/merchant-portal.service.ts` — +`getTicketSalesTrend`, +`getTicketSalesStacked`, +`getTicketSalesOrders`
- ✏️ `merchant-portal.controller.ts` — +3 GET routes
- ➕ `dto/ticket-charts.dto.ts` — trend + stacked + order-table DTOs + query DTO (raceId + period + granularity + page/pageSize/financialStatus/search)
- ✏️ `services/merchant-portal.service.spec.ts` + `merchant-portal.adversarial.spec.ts` — tests

### Endpoints
| Endpoint | SQL (R3 chain) | Notes |
|----------|----------------|-------|
| `GET /ticket-sales/trend?raceId&period&granularity` | `COUNT(DISTINCT om.id) GROUP BY <bucket(om.payment_on)>` paid | series `[{bucket,label,orderCount}]`. Bucket via `dateToWeekKey/MonthKey` or `DATE()`. period→from/to via period-resolver. |
| `GET /ticket-sales/stacked?raceId&period&granularity` | chain `oli→om→tt→rc`, `COUNT GROUP BY rc.id, <bucket>` paid | R2 DTO `TicketSalesStackedDto`: `courses[]{courseId,courseName,colorHint}` + `series[{date,counts:{courseId:n}}]`. Stable course order. |
| `GET /ticket-sales/orders?raceId&page&pageSize&financialStatus?&search?` | paginated `order_metadata` + chain to course/type | order detail table 20/page. **NO financial fields** (BR-MP-09). |

### 🛑 PAUSE / Coder pre-flight (R3-style data verify — MANDATORY)
- **Order-detail-table is the risky one.** R3 confirmed `order_metadata` has **NO order_code/code, NO buyer/athlete name, NO tenant_id**. Before coding `getTicketSalesOrders`, Coder MUST verify (live DB `SHOW COLUMNS` / sample query) what columns are available for a meaningful order row: likely `om.id` + course (chain) + ticket type + `SUM(oli.quantity)` + `financial_status` + `payment_on`. If buyer/athlete identity is required by UI, find the real source (separate table?) — do NOT assume. Document findings in IMPLEMENTATION_NOTES Forced section. If no clean buyer source → ship order-table with available columns + flag TD; do NOT block trend/stacked.
- `search` param: define what it searches against the verified columns (e.g. order id). If no text field exists, make `search` optional no-op + TD.

### Tests: ≥12 — trend bucket counts (daily/weekly/monthly series length), stacked course×bucket matrix + stable course order, orders pagination + financialStatus filter + NO-financial-leak, IDOR 403, empty race, cache. 10x flaky.

---

## M2c — Revenue trend + Excel export (BR-MP-10/11)

Under `LogtoMerchantFinanceGuard` + `assertRevenuePermission` (2-layer, same as M2b-3). Reuse `pullOrdersForFeeAggregate` + `FeeService` + period-resolver/bucket-helpers + F-062 `ExportService` pattern (exceljs).

### Scope Lock:
- ✏️ `services/merchant-portal.service.ts` — +`getRevenueTrend`, +`getRevenueExport` (or a small `MerchantExportService` if it grows)
- ✏️ `merchant-portal.controller.ts` — +2 routes (`/revenue/trend`, `/revenue/export`)
- ➕ `dto/revenue-trend.dto.ts`
- ✏️ `dto/ticket-charts.dto.ts` + `services/merchant-portal.service.ts` `getTicketSalesOrders` — **FOLD-IN (Danny 2026-06-05): add buyer `email` + `phone` to order table** (TD-F069-M2b2b-ORDER-PII RESOLVED show-full). +SELECT `om.email, om.phone_number`, +DTO fields, +map, +update adversarial Attack #13 (assert total_price still excluded; email/phone now ALLOWED).
- tests

### Endpoints
| Endpoint | Approach | Notes |
|----------|----------|-------|
| `GET /revenue/trend?raceId&period&granularity` | Per bucket: filter pulled orders to bucket date-range, GMV Σ + FeeService per tenant per bucket → series `[{bucket,label,gmv,totalFee,net,orderCount}]` | **Cost flag:** FeeService runs per bucket → bound bucket count (period-resolver caps). Cache 60s. |
| `GET /revenue/export?raceId` (+ maybe `?aggregate=true`) | exceljs workbook: sheets = Summary + By-Category + (cross-tenant) + Trend. Reuse F-062 ExportService pattern. | Returns xlsx stream (Content-Disposition attachment). Finance-gated. Filename slugify VN (memory ZIP naming rules). |

### 🛑 PAUSE / notes
- Export = read-only generation, NO new dep (exceljs present). NOT a fee-logic change → no Danny fee-PAUSE.
- Revenue-trend FeeService-per-bucket is the perf hotspot — Coder note cost in IMPLEMENTATION_NOTES; QC measure if feasible.
- Date filter at PULL layer (`pullOrdersForFeeAggregate(db, clause, params)` with `buildDateFilter`-style WHERE on `om.payment_on`), NOT at fee layer (FeeService voids _period) — resolves TD-F069-M2b3-PERIOD.

### Tests: ≥10 — trend bucket gmv/fee/net, export workbook sheet structure (mock exceljs or assert buffer non-empty), finance 403 viewer, IDOR, empty. 10x.

---

## Cross-cutting (both slices)
- Display Convention: backend raw enums (financialStatus/groupKey/course) — frontend maps (M4 `merchant-labels.ts`).
- `generate:api` deferred to M4 (no consumer yet) — same as all M2b.
- After each slice: rebuild + reboot 8081, verify new routes 401-guarded + Swagger.

## Verdict: ✅ APPROVED — Coder may start M2b-2b, then M2c.

## 🔗 Next step
Danny chạy: `/5bib-fullstack-engineer FEATURE-069 M2b-2b` → QC → deploy, **then** `/5bib-fullstack-engineer FEATURE-069 M2c`.
Manager KHÔNG code — slices handed to fullstack-engineer.
