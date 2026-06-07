# FEATURE-069 M2b-1: Deploy & Memory Sync (PARTIAL)

**Status:** ✅ DONE (M2b-1 partial — feature stays IN-FLIGHT)
**Deployed:** 2026-06-05
**Author:** 5bib-manager
**Milestone:** M2b-1 (resolveAccessibleRaces + /me + /races + M2b-1.1 race fix)
**Branch:** `5bib_merchant_v1`

---

## 📌 Pre-flight check
- [x] `04-qc-report-m2b-1.md` verdict = ✅ APPROVED
- [x] Unit tests PASS — 50 module tests (19 service + 6 QC adversarial + 25 access), 10x deterministic, tsc clean
- [x] Files changed match M2b Scope Lock (merchant-portal module) — 0 scope creep
- [x] `IMPLEMENTATION_NOTES-m2b-1.md` present with all 4 sections (Deviations + Forced + Tradeoffs + Reviewer Notes)

---

## 📊 Deploy summary
- **QC verdict:** ✅ APPROVED — SQL-injection-safe, IDOR-safe (cross-user + cross-tenant + draft-via-include), graceful cache degradation, R3 schema-exact
- **Tests:** 50 merchant-portal module / 10 suites cumulative / 10x deterministic / 0 flake
- **Scope:** backend-only milestone (no UI → Phase 6 persona N/A). No production endpoint serving traffic yet.
- **Not yet pushed to remote / no CI deploy** — partial in-flight slice on local branch, same as M1 + M2a. Feature ships to DEV/PROD when M2 fully complete (M2b-2/3 + M2c/d) or Danny cuts an interim.

---

## 🔬 Manager Independent Code Review

**Bước 0 — IMPLEMENTATION_NOTES read first.** Section 1 Deviation #1 (admin-list raceCount sentinel) — verified does NOT touch financial/auth BR, accepted (avoids N+1). Section 2 Forced #1 (assertActive outside try) — verified as a real bug fix, encoded to conventions. Section 4 priority list drove spot-check order below.

| # | File / area | Findings | Verdict |
|---|-------------|----------|---------|
| 1 | `merchant-portal.service.ts` `getAccessConfig` cache path | `assertActive` runs OUTSIDE the redis try/catch (L84-97). Inactive-from-cache → 403 propagates (not swallowed). Forced #1 fix confirmed. | ✅ |
| 2 | `resolveAccessibleRaces` | `status != 'DRAFT'` on BOTH tenant query (L190) AND include query (L204) → draft never leaks via include override. Exclude applied last (L211). Empty tenantIds+include → skips SQL entirely. | ✅ |
| 3 | `getRaces` | Cross-tenant 403 short-circuits BEFORE any SQL (L279-288). Ticket Map merge with COALESCE 0 for races without paid orders (L322, L331). 2-query split avoids LEFT-JOIN row multiplication. | ✅ |
| 4 | R3 SQL adherence | `races.status != 'DRAFT'` UPPERCASE (R3 L263 ✓), `financial_status='paid'` lowercase (R3 L226 ✓), `om.deleted=0`, `r.is_delete=0`, `event_start_date`. All `${}` in SQL are placeholder strings (`?,?,?` from `.map(()=>'?')`) + constant tenantClause — values bound via params array. **SQL-injection grep CLEAN.** | ✅ |
| 5 | `merchant-portal-access.service.ts` M2b-1.1 | `accessModel.exists({_id})` re-verify AFTER `acquireAccessLock` in update() (L482) AND delete() (L576), inside try, throws NotFoundException. delete() emits audit AFTER exists-check → no duplicate audit emit. Resolves the M2a HIGH must-fix. | ✅ |

**Red flags: 0.** Type-safe (no `any`/`as unknown as`), guards present (`LogtoMerchantGuard` class-level), error handling (best-effort Redis try/catch + log warn), `@ApiResponse` codes complete.

---

## 📝 Memory diff (applied)

### `feature-log.md`
- ✏️ In-flight F-069 row → "🟠 M2b-1 SHIPPED" (resolveAccessibleRaces + /me + /races + M2b-1.1 fix). Counter UNCHANGED (F-069 still in-flight → next `FEATURE-070`).

### `change-history.md`
- ➕ Appended (top): full M2b-1 entry — files, architecture (2 Redis keys + merchant API surface), conventions (Forced #1), Manager review table, lessons.

### `codebase-map.md`
- ✏️ merchant-portal entry extended with M2b-1 SHIPPED block (service core + controller + DTOs + M2b-1.1 fix + 50 tests).

### `conventions.md`
- ➕ NEW section: **"Business exceptions MUST live OUTSIDE the Redis-I/O try/catch"** (Forced #1 lesson) with wrong/right code + QC grep enforcement.

### `known-issues.md`
- ✅ TD-F069-M2a-UPDATE-AFTER-DELETE-RACE → **RESOLVED** (M2b-1.1 + Manager review).
- ✅ TD-F069-M2a-RACECOUNT-PLACEHOLDER → **PARTIAL-RESOLVED** (merchant-facing real; admin-list superseded).
- ➕ 4 NEW 🟢 LOW: TD-F069-M2b-RACECOUNT-ADMINLIST, TD-F069-M2b-BIGINT-RACEID, TD-F069-M2b-GENERATE-API-DEFERRED, TD-F069-M2b-PERF-SLA-UNMEASURED.

---

## 🔮 Follow-up for next milestone
- **M2b-2 (Ticket Sales endpoints)** — summary KPI cards using R3 FINAL BR-MP-08 `financial_status` 3 values (paid/voided/pending) + course breakdown via chain `oli→om→tt→rc`. Use `resolveAccessibleRaces` + `assertRaceAccessible` for scope. Build `merchant-labels.ts` dictionary (ORDER_FINANCIAL_STATUS + RACE_STATUS) per Display Convention.
- **M2b-3 (Revenue + cross-tenant)** — GMV `SUM(total_price - COALESCE(total_discounts,0)) WHERE financial_status='paid'`, permission-gated by `revenue_report`; cross-tenant aggregate via FeeService per-tenant loop.
- **Open product decision (decide at M2c):** BR-MP-12 revenue category grouping — 8 `order_category` values → display group (Option A "Phí %" vs "Phí cố định" recommended).
- Keep the Forced #1 grep (`throw`/`assert` inside `try` containing `redis.`) in every future M2b/c service review.

---

## ✅ Status
🟠 **FEATURE-069 M2b-1 PARTIAL DONE** — memory synced, feature remains IN-FLIGHT. Ready for `/5bib-code FEATURE-069 M2b-2`.
