# FEATURE-069 M2b-2: Coder Implementation — Ticket Sales Endpoints

**Status:** 🟠 READY_FOR_QC
**Milestone:** M2b-2 (Ticket Sales: summary KPI + course breakdown + type breakdown)
**Date:** 2026-06-05
**Coder:** 5bib-fullstack-engineer

---

## 1. Pre-flight check
- [x] `02-manager-plan.md` APPROVED + R3 data-layer re-review APPROVED
- [x] Read `00`, `01-ba-prd.md` + `01-ba-prd-revision-r2.md` (ticket-sales spec BR-MP-07/08/09) + `01-ba-prd-revision-r3.md` (canonical SQL + DISC-1/4/5 + PAUSE-R3-01 resolution)
- [x] Read memory `conventions.md` (MySQL schema section + Forced #1 try/catch rule), `codebase-map.md` (merchant-portal M2b-1 entry)
- [x] Read code thật: `merchant-portal.service.ts` (M2b-1 resolveAccessibleRaces + assertRaceAccessible to reuse), controller, DTOs
- [x] **Live DB verify (R3 lesson):** `SHOW COLUMNS` on `ticket_type` (id/race_course_id/type_name/deleted bigint+varchar) + `order_line_item` (order_id/ticket_type_id/quantity) + chain sanity query (top-3 courses returned real data, confirmed dup course names across ids)

## 2. Impact Assessment (Phase 1)
- **MySQL platform** — 3 NEW read aggregates. Summary = `order_metadata LEFT JOIN order_line_item GROUP BY financial_status`. Breakdowns = chain `oli→om→tt→rc` (DISC-1: om has NO race_course_id). All bound params, index-friendly (`om.race_id = ?`).
- **Redis** — 3 NEW keys `merchant-portal:ticket-summary|ticket-by-course|ticket-by-type:<userId>:<raceId>` TTL 60s. Per-user + per-race namespaced.
- **NestJS** — 3 methods on existing `MerchantPortalService`, 3 GET routes on existing `MerchantPortalController`. No new module/provider.
- **API contract** — 3 additive endpoints. `generate:api` deferred to M4 (no consumer).

## 3. Edge Cases Covered (Phase 2)
1. **Race not in scope (IDOR)** → `assertRaceForUser` → 403 `403_NO_RACE` BEFORE any aggregate SQL (verified: only resolve query runs).
2. **Missing financial_status in scope** → summary normalizes to ALWAYS emit paid/voided/pending (0-filled); unknown status appended.
3. **Duplicate course names across distinct ids** (real data: course 540 & 515 both "2,9 km") → GROUP BY `rc.id` keeps them distinct.
4. **Empty race (0 orders)** → summary all-zero 3 cards; breakdowns empty items + totalTickets 0.
5. **null type_name / course_name** → `?? ''` fallback.
6. **Corrupt Redis JSON** → try/catch recompute (Forced #1 pattern reused via `cachedTicketRead`).

## 4. Logic & Architecture (Phase 3)
- **`assertRaceForUser` + `cachedTicketRead` private helpers** — DRY across all 3 endpoints. Every endpoint: scope-guard FIRST (IDOR), then cached compute. Mirrors M2b-1 conventions.
- **`totalTickets` = ALL-status sum** in summary (R3 line 242 "Tổng vé" = all). Breakdowns are **paid-only** (R3 template `financial_status='paid'`) — "sold distribution".
- **`COUNT(DISTINCT om.id)`** required because LEFT JOIN order_line_item multiplies order rows by line-item count; `SUM(oli.quantity)` then sums correctly.
- **Display Convention:** backend returns RAW `financialStatus` enum (paid/voided/pending) — frontend maps VN label via `merchant-labels.ts` (M4). No VN strings baked in backend.

## 5. Files Changed
| File | Change |
|------|--------|
| `services/merchant-portal.service.ts` | +3 public methods (getTicketSalesSummary/ByCourse/ByType) + 3 private helpers (assertRaceForUser, cachedTicketRead, toBreakdown) + CANONICAL_FINANCIAL_STATUSES const + TTL const + DTO imports |
| `merchant-portal.controller.ts` | +3 GET routes `/ticket-sales/summary|by-course|by-type` |
| `dto/ticket-sales.dto.ts` | **NEW** — TicketStatusCountDto + TicketSalesSummaryDto + TicketBreakdownItemDto + TicketSalesBreakdownDto + TicketSalesQueryDto |
| `services/merchant-portal.service.spec.ts` | +10 tests (summary 5 + course 3 + type 2) |
| `services/merchant-portal.adversarial.spec.ts` | +3 QC adversarial (SQLi param bind, cache namespacing, corrupt-cache) |

## 6. Tests Written
```
PASS merchant-portal.service.spec.ts — 29 (19 M2b-1 + 10 M2b-2)
  getTicketSalesSummary — happy/unknown-status/empty/IDOR/cache-hit (5)
  getTicketSalesByCourse — dup-name distinct/IDOR/chain-not-race_course_id (3)
  getTicketSalesByType — type_name display/null fallback (2)
Full module: 4 suites, 63 passed (was 50 + 13 M2b-2)
10x flaky: 63/63 × 10 deterministic
tsc: clean
```

## 7. Scope creep
None. All edits within merchant-portal module (M2b Scope Lock).

## 8. Known limitations / Tech Debt
- **TD-F069-M2b2-NO-PERIOD-FILTER** 🟢 LOW — summary/breakdowns are ALL-TIME per race (no period param, no delta %). PRD R2 KPI cards mention "delta %" — deferred to M2b-2b (needs period-resolver + previous-period compute, F-062 pattern).
- **TD-F069-M2b2-TREND-STACKED-TABLE-DEFER** 🟢 — trend AreaChart + AnStacked + order-detail-table endpoints deferred to M2b-2b (time-bucket via F-062 bucket-helpers).
- **TD-F069-M2b2-GENERATE-API** — `pnpm generate:api` deferred to M4.

## ✅ Self-Review Pipeline
- [x] Bước 1: tsc clean for Scope Lock files
- [x] Bước 2: PRD adherence — R3 canonical chain SQL + BR-MP-08 3-status + BR-MP-09 no-financial
- [x] Bước 3: Anti-pattern scan clean (no console.log/any/as unknown/TODO)
- [x] Bước 4: Hand-pick audit — `toBreakdown` maps all 4 DTO fields (id/name/orderCount/ticketCount); summary byStatus maps all 3
- [x] Bước 5: PROD-readiness — Nest DI resolves (reuses M2b-1 deps); routes mounted under existing guard
- [x] Bước 6: UI/UX — N/A (backend-only)
- [x] Bước 7: Real-world data — verified against LIVE DB (44K orders), dup course names, real ticket types
- [x] Bước 8: Files vs Scope Lock — 0 creep
- [x] Bước 9: Generated SDK — deferred M4 (documented)
- [x] Bước 10: 63 tests PASS + 10x deterministic
- [x] Bước 11: IMPLEMENTATION_NOTES-m2b-2.md written (4 sections)

→ Status: 🟠 READY_FOR_QC
