# FEATURE-058: Manager Deploy & Memory Sync

**Status:** ✅ DONE (code-level)
**Deployed:** 2026-05-22
**Linked:** 00 → 04

---

## 📌 Pre-flight check (Manager)

- [x] QC verdict ✅ APPROVED WITH MINOR REWORK → rework done (commit `80944b0`)
- [x] 14/14 F-058 unit tests PASS (10 cũ + 4 rework verdict tests)
- [x] 45/45 fee.service regression PASS (F-040 + F-043 zero regression)
- [x] Files changed match Scope Lock (10 code + 1 DI plumbing — finance.module.ts pre-approved)
- [x] Tech debt tracked (TD-F058-PERF-BUDGET, TD-F058-CACHE-EXPLOSION-RISK)

---

## 📊 Deploy summary

| Metric | Value |
|--------|-------|
| QC verdict | ✅ APPROVED with MINOR REWORK → done |
| F-058 tests | 14/14 PASS (10 cascade + 4 verdict) |
| Module regression | 45/45 PASS (F-040 + F-043) |
| Performance benchmark | p95 = 7ms / 5000 orders (estimated endpoint Δ <10%) — well below 2× baseline |
| Pre-existing fails | 6 suites (upload, admin, race-result, reconciliation-controller, chip-verification) — verified pre-existing on main baseline, NOT F-058 caused |
| Branch | `feat/F-058-analytics-cascade-fix` từ `origin/main` (9f65f92) |
| Commits | 2 (initial `867cd9e` + rework `80944b0`) |
| Files changed | 11 (10 Scope Lock + finance.module.ts DI exports) |
| LoC | +1582 / -66 |

---

## 🔬 Manager Independent Code Review

> Manager mandate 2026-05-17 — 5 critical paths reviewed post-implementation.

### 1. `fee.service.ts:computeFeeForOrdersAggregate()` (+228 LoC NEW method)
- ✅ Method aggregate **EXTEND only** — `computeSelfFee()` existing F-040/F-043 untouched (verified via diff)
- ✅ Per-order pro-rate algorithm dùng `order.created_at` so sánh `effective_from` (PAUSE-58-07 = A)
- ✅ 3-field cascade independent: `service_fee_rate` + `manual_fee_per_ticket` + `fee_vat_rate` (PAUSE-58-02 = A)
- ✅ Return shape `AggregateFeeResult` rõ ràng — totalFee + totalGmv + feeSourceBreakdown + appliedOverrides
- ✅ Type-safe — no `any`, narrowed casts proper

**Verdict:** ✅ APPROVED

### 2. `analytics.service.ts` refactor (~+403/-66 LoC)
- ✅ DELETE `getFeeConfigs()` (line 119-128 old) — bug source removed
- ✅ 12 endpoint method refactor: gọi `feeService.computeFeeForOrdersAggregate()` thay vì map tenant→rate
- ✅ Response shape backward compat (verified TC-58-10 regression diff)
- ✅ Rework dead-code fix `getTopRaces()` (lines 445-475) — remove outer aggregate call, preserve per-race logic
- ✅ FeeService DI inject correctly via FinanceModule export

**Verdict:** ✅ APPROVED

### 3. `analytics.controller.ts:getDiscrepancyCheck()` NEW endpoint (+24 LoC)
- ✅ `LogtoAdminGuard` class-level applied
- ✅ Swagger annotations đầy đủ (@ApiOperation + @ApiResponse + @ApiBearerAuth)
- ✅ Query DTO validation via class-validator
- ✅ Response DTO `DiscrepancyResponseDto` shape match BR-58-13

**Verdict:** ✅ APPROVED

### 4. `merchant.service.ts:flushEventOverrideCache()` extend (+43 LoC)
- ✅ Thêm 6 analytics patterns: `analytics:overview:*` + `analytics:daily:*` + `analytics:top-races:*` + `analytics:rev-by-cat:*` + `analytics:merchants:*` + `analytics:races:*`
- ✅ Total 9 patterns flush (3 existing + 6 NEW) via scanStream + pipeline DEL (convention Pattern 1)
- ✅ Logger.warn rate-limited khi flush time > threshold (defensive)

**Verdict:** ✅ APPROVED

### 5. `reconciliation.service.ts:getTotalsByTenantMonth()` NEW (+75 LoC)
- ✅ Method aggregate `{totalFee, totalGmv, reconCount}` per tenant per month
- ✅ Dùng MongoDB aggregation pipeline với index (tenantId, period)
- ✅ Throw NotFoundException nếu tenantId invalid (defensive)
- ✅ KHÔNG break existing reconciliation query patterns

**Verdict:** ✅ APPROVED

### Summary

| Area | Verdict |
|------|---------|
| FeeService extend | ✅ APPROVED |
| Analytics refactor | ✅ APPROVED |
| Discrepancy endpoint | ✅ APPROVED |
| Cache flush extension | ✅ APPROVED |
| Reconciliation method | ✅ APPROVED |

**Final Manager Code Review: ✅ APPROVED — production-ready.**

---

## 📝 Memory diff applied

### `feature-log.md`
- F-058 entry append top of Shipped table
- Counter advance F-058 → F-059

### `change-history.md`
- Full F-058 entry với 10 files + 14 tests + perf benchmark output + 2 PAUSE-Coder choices

### `conventions.md`
- New pattern minted: **N-tier cascade aggregate delegation** — FeeService own truth, other services delegate qua method aggregate per-order pro-rate

### `known-issues.md`
- TD-F058-PERF-BUDGET (MED — monitor PROD 24h post-deploy) — escalate Danny per PAUSE-58-09 nếu p95 > 2× baseline
- TD-F058-CACHE-EXPLOSION-RISK (LOW — 9 SCAN cycles per override mutation, monitor nếu tenant scale 500+)
- TD-F058-RUNNER-BEHAVIOR-SQL-INTERPOLATION (LOW pre-existing) — flag F-059 cleanup, mitigated by Number() cast hiện tại

---

## ✅ Status

🎉 **FEATURE-058 CODE-LEVEL DONE** — Push pending Danny decision (merge main + cut release/v1.9.1 hoặc parallel với F-052).
