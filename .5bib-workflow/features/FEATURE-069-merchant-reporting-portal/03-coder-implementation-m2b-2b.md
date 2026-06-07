# FEATURE-069 M2b-2b: Coder Implementation — Ticket Sales Chart Endpoints

**Status:** 🟠 READY_FOR_QC
**Milestone:** M2b-2b (trend + stacked + order-detail-table)
**Date:** 2026-06-05
**Coder:** 5bib-fullstack-engineer

---

## 1. Pre-flight check
- [x] `02-manager-plan-m2b-2b-m2c.md` APPROVED
- [x] Read R2 (AnStacked DTO spec) + R3 (chain `oli→om→tt→rc`) + conventions + codebase-map
- [x] Read code: period-resolver (`resolvePeriod` + `resolveBucketSize`), bucket-helpers (`mysqlYearweekToWeekKey`/`labelForWeekKey`/`labelForMonthKey`), M2b-2 service patterns
- [x] **Live-DB pre-flight (Manager mandate):** `SHOW COLUMNS order_metadata` → resolved the order-table risk (buyer fields EXIST)

## 2. Impact Assessment (Phase 1)
- **MySQL** — 3 NEW read paths. trend = COUNT GROUP BY bucket. stacked = chain SUM(quantity) GROUP BY course×bucket. orders = paginated om + chain + COUNT. All paid-scoped (except orders which filters optional status).
- **NestJS** — 3 methods on `MerchantPortalService` + 3 routes. Reuse analytics `period-resolver`/`bucket-helpers` (cross-module import, no DI). No new module.
- **Redis** — 2 NEW keys (trend, stacked — incl period+granularity). orders NOT cached (combinatorial filter/page).
- **API** — 3 additive endpoints. generate:api deferred M4.

## 3. Edge Cases Covered (Phase 2)
1. IDOR (race not accessible) → 403 before chart query (all 3).
2. Empty period/race → empty series / empty items (no crash).
3. Weekly YEARWEEK int → mapped to `YYYY-Www` via helper; daily/monthly string buckets.
4. Course absent in a bucket → `counts[courseId]` undefined (frontend treats 0).
5. Buyer name: first+last → fallback `name` → '' (null-safe).
6. Order spanning multiple courses → display row uses aggregated line (MIN ticket_type_id) + SUM quantity.

## 4. Logic & Architecture (Phase 3)
- **String-output bucket exprs for mysql2 TZ-safety** (Deviation #1): daily uses `DATE_FORMAT(...'%Y-%m-%d')` not resolveBucketSize's `DATE()` — avoids mysql2 returning a JS Date that `ymdUtc` could shift across TZ. weekly/monthly reuse resolveBucketSize's safe int/string forms.
- **stacked = ticket count (SUM quantity)** not order count (Deviation #2) — reconciles with M2b-2 by-course breakdown.
- **orders NO financial + NO email/phone** (BR-MP-09 + PII conservatism) — buyer NAME only. search = name LIKE.
- Reuse `assertRaceForUser` (scope+IDOR) + `cachedTicketRead` (Forced #1 try/catch) from M2b-1/2.

## 5. Files Changed
| File | Change |
|------|--------|
| `services/merchant-portal.service.ts` | +`getTicketSalesTrend`/`getTicketSalesStacked`/`getTicketSalesOrders` + `bucketExpr`/`bucketKeyLabel` helpers + analytics imports |
| `merchant-portal.controller.ts` | +3 GET `/ticket-sales/{trend,stacked,orders}` (LogtoMerchantGuard) |
| `dto/ticket-charts.dto.ts` | **NEW** — Trend/Stacked/OrderList DTOs + query DTOs |
| `dto/ticket-sales.dto.ts` | +`TicketChartGranularity` type export |
| `services/merchant-portal.service.spec.ts` | +11 tests |
| `services/merchant-portal.adversarial.spec.ts` | +2 (Attack #13 orders-no-PII-SQL, #14 trend cache namespacing) |

## 6. Tests Written
```
PASS merchant-portal.service.spec.ts (53: 42 prior + 11 M2b-2b)
  getTicketSalesTrend — daily/weekly/monthly bucket+label / IDOR / empty
  getTicketSalesStacked — course×bucket matrix + stable order / IDOR
  getTicketSalesOrders — pagination/buyerName/NO-leak / name-fallback / search SQL / IDOR
Full module: 4 suites, 93 passed (80 prior + 13 M2b-2b: 11 service + 2 adversarial)
10x flaky: 93/93 × 10 deterministic
tsc clean · Live 8081: 11 endpoints, 3 chart routes 401-guarded
```

## 7. Scope creep
None. merchant-portal module + analytics helper imports (declared in Manager plan).

## 8. Known limitations / Tech Debt
- **TD-F069-M2b2b-ORDER-PII** 🟢 — order table excludes email/phone (available on order_metadata) pending product decision on buyer-contact exposure in merchant report.
- **TD-F069-M2b2b-BUCKET-TZ** 🟢 — bucketing uses MySQL session TZ for DATE_FORMAT/YEARWEEK vs UTC from/to filter; matches F-062 analytics precedent. Validate at M5 if race-day TZ edge appears.
- **TD-F069-M2b2b-ORDER-MULTI-COURSE** 🟢 — order row shows one representative course/type (MIN ticket_type_id) + total quantity; a multi-course order collapses to one row. Acceptable for table; note for UI.
- generate:api deferred M4.

## ✅ Self-Review Pipeline
- [x] Bước 1: tsc clean
- [x] Bước 2: PRD adherence — R2 chart specs (trend/stacked/table), bucket via period-resolver, BR-MP-09 no-financial
- [x] Bước 3: Anti-pattern clean (fixed `as unknown as` → spread `[...ENUM]`)
- [x] Bước 4: Hand-pick — order row + trend/stacked points map all DTO fields explicitly
- [x] Bước 5: PROD-readiness — rebuilt + booted 8081, 11 endpoints, 3 new 401
- [x] Bước 6: UI/UX — N/A backend
- [x] Bước 7: Real-world — live-DB column verify; VN buyer name fixture; QC live-DB recommended
- [x] Bước 8: Files vs Scope Lock — 0 creep
- [x] Bước 9: generate:api deferred M4
- [x] Bước 10: 93 tests PASS + 10x
- [x] Bước 11: IMPLEMENTATION_NOTES-m2b-2b.md written (4 sections)

→ Status: 🟠 READY_FOR_QC
