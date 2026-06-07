# FEATURE-069 M2b-2: Deploy & Memory Sync (PARTIAL)

**Status:** ✅ DONE (M2b-2 partial — feature stays IN-FLIGHT)
**Deployed:** 2026-06-05
**Milestone:** M2b-2 (Ticket Sales: summary + by-course + by-type)
**Branch:** `5bib_merchant_v1`

---

## Pre-flight
- [x] `04-qc-report-m2b-2.md` = ✅ APPROVED (incl QC real-DB cross-check)
- [x] 63 module tests PASS / 10x deterministic / tsc clean
- [x] Files match M2b Scope Lock — 0 creep
- [x] `IMPLEMENTATION_NOTES-m2b-2.md` present, 4 sections (3 honest deviations)

## Manager Independent Code Review (5 hotspots, grep + read verified)
1. `getTicketSalesSummary` (L416-474) — ✅ `assertRaceForUser` first (L420), byStatus normalizes 3 canonical + 0-fill + unknown-append, totalTickets all-status, `COUNT(DISTINCT om.id)` (LEFT JOIN multiply), no financial_status filter (groups by it).
2. `getTicketSalesByCourse` (L476-508) — ✅ chain `oli→om→tt→rc`, `financial_status='paid'` (L497), GROUP BY `rc.id` (dup names distinct), `.not` `om.race_course_id`.
3. `getTicketSalesByType` (L510-541) — ✅ chain to ticket_type, `tt.type_name`, GROUP BY `tt.id`.
4. `assertRaceForUser` (L373) — ✅ resolveAccessibleRaces + assertRaceAccessible; first line of all 3 endpoints (L420/480/514) → IDOR before SQL.
5. `cachedTicketRead` — ✅ try wraps only redis.get+parse / redis.set; `compute()` OUTSIDE try (Forced #1 compliant).
**SQL injection:** single `raceId` bound via `[raceId]`, zero `${}` value interpolation. **0 red flags.**

## Memory diff (applied)
- `feature-log.md` — in-flight F-069 → "🟠 M2b-2 SHIPPED". Counter unchanged (in-flight).
- `change-history.md` — M2b-2 entry (files, 3 Redis keys, real-DB lesson).
- `codebase-map.md` — merchant-portal entry extended with M2b-2 ticket-sales block.
- `known-issues.md` — +4 LOW TDs (orphan INNER JOIN gap=0, no-period, trend/stacked/table defer, generate:api).
- `conventions.md` — no new (reuses Forced #1).

## Follow-up
- **M2b-2b:** trend AreaChart + AnStacked + order-detail-table (time-bucket via F-062 bucket-helpers + period-resolver), add `?period=` + delta % to summary.
- **M2b-3:** Revenue (GMV permission-gated `revenue_report`) + cross-tenant per-tenant fee loop (BR-MP-21b, FeeService).
- Watch TD-F069-M2b2-BREAKDOWN-INNERJOIN-ORPHAN if a race with orphan ticket_types appears.

## Status
🟠 **FEATURE-069 M2b-2 PARTIAL DONE** — memory synced, feature IN-FLIGHT. Proceeding to localhost boot per Danny directive.
