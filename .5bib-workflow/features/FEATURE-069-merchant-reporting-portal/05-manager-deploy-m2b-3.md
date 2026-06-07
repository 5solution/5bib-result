# FEATURE-069 M2b-3: Deploy & Memory Sync (PARTIAL)

**Status:** ✅ DONE (M2b-3 partial — feature stays IN-FLIGHT)
**Deployed:** 2026-06-05
**Milestone:** M2b-3 (single-race revenue summary, finance-gated)
**Branch:** `5bib_merchant_v1`

---

## Pre-flight
- [x] `04-qc-report-m2b-3.md` = ✅ APPROVED (incl QC live-DB GMV invariant)
- [x] 72 module tests PASS / 10x deterministic / tsc clean
- [x] Files match M2b Scope Lock + declared FinanceModule dep — 0 creep
- [x] `IMPLEMENTATION_NOTES-m2b-3.md` present, 4 sections (2 honest Forced changes)

## Manager Independent Code Review (5 hotspots)
1. `getRevenueSummary` guard ORDER — ✅ getAccessConfig (404/403-inactive) → assertRevenuePermission (403 no revenue_report) → resolveAccessibleRaces → assertRaceAccessible (403 IDOR), ALL before order pull (L5-8). Adversarial Attack #9 proves zero db.query for unauthorized.
2. `assertRevenuePermission` — ✅ `!cfg.permissions.includes('revenue_report')` → 403 `403_NO_REVENUE_PERMISSION`.
3. **FinanceModule import — ✅ NO circular** (grep finance.module.ts: zero merchant-portal ref; backend booted clean on 8082).
4. **Fee logic — ✅ CONSUMED not modified** (`git diff --stat finance/` empty — F-040/F-058 invariant territory untouched). Only `.computeFeeForOrdersAggregate` called.
5. GMV/net correctness — ✅ QC live-DB: GMV-from-orders (1,035,025,000) == R3 GMV SQL byte-identical on race 138; single tenant 46 confirms per-tenant-loop assumption.
**SQL injection:** raceId bound via `{raceId}` → `om.race_id = ?` (pullOrders helper parameterized). **0 red flags.**

## Memory diff (applied)
- `feature-log.md` — in-flight F-069 → "🟠 M2b-3 SHIPPED". Counter unchanged.
- `change-history.md` — M2b-3 entry (FinanceModule dep, 2-layer perm, live-DB lesson, NetGmv trap).
- `codebase-map.md` — merchant-portal entry extended with revenue block + 6-endpoint localhost note.
- `known-issues.md` — +3 LOW TDs (cross-tenant, breakdown/trend/export [BLOCKED BR-MP-12], period) + 1 QUIRK (TD-F069-FEESERVICE-NETGMV-GOTCHA).
- `conventions.md` — no new section (2-layer perm + Forced #1 reuse noted in change-history).

## Follow-up
- **M2b-3b:** cross-tenant revenue (BR-MP-21b per-tenant loop over accessible-race subset) + revenue breakdown by order_category (BR-MP-12) + trend + Excel export + period/date filter (at pull layer).
- **🛑 BLOCKER for revenue breakdown:** Danny must decide **BR-MP-12 order_category grouping** (8 values → display group; Option A "Phí %" vs "Phí cố định" recommended) before M2b-3b breakdown.
- **Codebase-map gotcha recorded:** FeeService.totalNetGmv ≠ gross GMV — future revenue consumers beware.

## Status
🟠 **FEATURE-069 M2b-3 PARTIAL DONE** — memory synced, feature IN-FLIGHT. Backend localhost 8082 serves 6 endpoints (me/races/ticket-sales×3/revenue), all 401-guarded.
