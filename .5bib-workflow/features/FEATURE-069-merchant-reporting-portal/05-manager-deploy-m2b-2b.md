# FEATURE-069 M2b-2b: Deploy & Memory Sync (PARTIAL)

**Status:** ✅ DONE (M2b-2b partial — feature stays IN-FLIGHT)
**Deployed:** 2026-06-05
**Milestone:** M2b-2b (ticket charts: trend + stacked + order-detail-table)
**Branch:** `5bib_merchant_v1`

---

## Pre-flight
- [x] `04-qc-report-m2b-2b.md` = ✅ APPROVED (3 live-DB reconciles)
- [x] 93 module tests / 10x deterministic / tsc clean
- [x] Files match Manager plan Scope Lock — 0 creep
- [x] `IMPLEMENTATION_NOTES-m2b-2b.md` present, 4 sections (2 deviations + Forced #1)

## Manager Independent Code Review (3 hotspots)
1. `getTicketSalesOrders` — ✅ `assertRaceForUser` first (IDOR); SELECT = id/first_name/last_name/name/financial_status/payment_on/quantity/course_name/ticket_type_name → **NO om.email / om.phone_number / om.total_price** (PII + financial safe); search LIKE param-bound; buyerName first+last→name fallback.
2. `bucketExpr` — ✅ daily `DATE_FORMAT('%Y-%m-%d')` (mysql2 TZ-safe, NOT DATE()), weekly `YEARWEEK(,3)`, monthly `DATE_FORMAT('%Y-%m')`; stacked chain has no `om.race_course_id`.
3. Routing — ✅ 3 chart routes class-level `LogtoMerchantGuard` (FinanceGuard correctly only on the 3 revenue routes).
**0 red flags.** QC live-DB reconciles confirmed (trend Σ==total 3031, stacked Σ==by-course, orders no-PII).

## Memory diff (applied)
- `feature-log.md` — in-flight F-069 → "🟠 M2b-2b SHIPPED" + "Backend reporting layer COMPLETE" + localhost 8081/11 endpoints. Counter unchanged.
- `change-history.md` — M2b-2b entry (orders no-PII, bucketExpr, Forced #1 R3-cols lesson).
- `codebase-map.md` — merchant-portal entry + **SCHEMA QUIRK: order_metadata HAS buyer columns** (R3 dump incomplete) + 11 endpoints.
- `known-issues.md` — +4 LOW TD (order-PII product decision, bucket-TZ, multi-course collapse, R3-cols-doc).
- `conventions.md` — no new (reuse Forced #1 + Display Convention).

## Follow-up
- **M2c** — revenue trend + Excel export (last backend slice; BR-MP-12 grouping decided, exceljs present, no new dep).
- **🛑 Product decision pending:** TD-F069-M2b2b-ORDER-PII — show buyer email/phone in merchant order table? (currently name-only).
- **M3** — admin UI `/admin/merchant-portal` (gán quyền, consume 7 M2a admin endpoints).
- **M4** — merchant frontend merchant.5bib.com (consume 11 merchant endpoints + build `merchant-labels.ts` dicts).
- **M5** — infra (merchant.5bib.com subdomain + nginx + SSL).

## Status
🟠 **FEATURE-069 M2b-2b PARTIAL DONE** — memory synced, feature IN-FLIGHT. Backend reporting layer COMPLETE (11 endpoints live on 8081). Remaining backend = M2c (revenue trend/export); then UI (M3/M4) + infra (M5).
