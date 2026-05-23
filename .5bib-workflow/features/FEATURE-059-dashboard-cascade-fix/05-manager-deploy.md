# FEATURE-059: Manager Deploy & Memory Sync

**Status:** ✅ DONE (code-level)
**Deployed:** 2026-05-23
**Linked:** 00 → 04

---

## 📌 Pre-flight check (Manager)

- [x] QC verdict ❌ REJECTED → rework done (commit `4d0dba4`) → 0 failures `src/modules/dashboard`
- [x] 13/13 F-059 NEW spec PASS + 59 tests total dashboard PASS (incl. updated legacy)
- [x] F-058 + F-043 regression 190/190 PASS — zero regression
- [x] Files match Scope Lock (5 docs + 7 code; Coder consolidated regression baseline into 1 spec — declared deviation acceptable)
- [x] Tech debt tracked (PERF-BUDGET MED, MANUAL-FEE-CONFUSION LOW, PAYMENT-ON LOW, PRELOAD-NO-SKIP-FEESERVICE LOW)

---

## 📊 Deploy summary

| Metric | Value |
|--------|-------|
| QC verdict | ❌ REJECTED → ✅ APPROVED post-rework |
| F-059 tests | 13/13 PASS (8 KPI + 5 Sparkline) |
| Dashboard total | 10 suites / 59 tests PASS |
| Module regression | 190/190 PASS (F-058 + F-043 + Fee + Analytics) |
| Perf benchmark | In-process: KPI ~250-450ms (<1.5s), Sparkline cold ~2-3s (<4s) ✅ |
| Branch | `feat/F-059-dashboard-cascade-fix` từ `origin/main` (87a4918 v1.9.2 hotfix) |
| Commits | 2 (`659d517` initial + `4d0dba4` rework legacy specs) |
| Files changed | 12 (5 docs + 7 code: 5 modify + 2 new spec) |

---

## 🔬 Manager Independent Code Review

### 1. `kpi.service.ts` refactor (+200/-25 LoC)
- ✅ DELETE hardcode `net * 0.055` (line 108 trước)
- ✅ ADD `pullOrdersForFeeAggregate()` duplicate helper (PAUSE-Coder-01 = A)
- ✅ Delegate `feeService.computeFeeForOrdersAggregate()` per tenant per period
- ✅ INCLUDE MANUAL fee semantic (PAUSE-59-02 = B) — fee compute KHÔNG filter MANUAL
- ✅ GMV/Net display vẫn EXCLUDE MANUAL (giữ UX)
- ✅ KPI cache TTL 60s mới (BR-59-09)

**Verdict:** ✅ APPROVED

### 2. `sparkline.service.ts` refactor (+220/-30 LoC)
- ✅ Pre-load `Map<tenantId, MerchantConfig>` mandatory (PAUSE-Coder-03)
- ✅ Per-day per-tenant FeeService call
- ✅ Exported `FALLBACK_DAYS=14` constant ready (PAUSE-Coder-02 fallback)
- ⚠️ Pre-load configMap chỉ cosmetic — FeeService vẫn tự load Mongo (F-058 protect). Tracked TD-F059-PRELOAD-NO-SKIP-FEESERVICE để F-060 refactor FeeService accept config-injected

**Verdict:** ✅ APPROVED (cosmetic optimization acceptable trong F-059 scope)

### 3. `dashboard.module.ts` DI (+10 LoC)
- ✅ Import FinanceModule (export FeeService từ F-058)
- ✅ MongooseModule.forFeature MerchantConfig

**Verdict:** ✅ APPROVED

### 4. `merchant.service.ts:flushEventOverrideCache` (+18 LoC)
- ✅ Extend +2 patterns: `dashboard:kpi:*` + `dashboard:sparkline:*` (total 11 patterns)
- ✅ scanStream + pipeline DEL pattern convention

**Verdict:** ✅ APPROVED

### 5. Legacy specs rework (post-QC, commit `4d0dba4`)
- ✅ Option A — UPDATE preserve test coverage (BR-DASH-02 delta NULL, DB-error resilience, cache short-circuit, 30-point backfill)
- ✅ DI mocks added (FeeService + MerchantConfigModel + Redis token)
- ✅ Cache key updated `sparklines` → `sparkline` (singular per F-059 Deviation #2)
- ✅ Value correctness ownership chuyển sang `sparkline.service.f059.spec.ts`

**Verdict:** ✅ APPROVED

### Summary

| Area | Verdict |
|------|---------|
| KPI service refactor | ✅ APPROVED |
| Sparkline service refactor | ✅ APPROVED |
| Module DI | ✅ APPROVED |
| Cache flush extension | ✅ APPROVED |
| Legacy specs rework | ✅ APPROVED |

**Final Manager Code Review: ✅ APPROVED — production-ready.**

---

## 📝 Memory diff applied (post-deploy memory sync)

### `feature-log.md`
- F-059 entry append top of Shipped table
- Counter advance F-059 → F-060

### `change-history.md`
- Full F-059 entry với 7 code files + 13 new tests + 12 legacy specs updated + perf benchmark + 4 TDs

### `conventions.md`
- Pattern extend: **3-source cascade truth** — Reconciliation, Analytics (F-058), Dashboard (F-059) đều delegate `FeeService.computeFeeForOrdersAggregate()` = 1 source of truth platform fee
- Pattern: **Pre-load Map<tenantId, config> before loop** when iterating multi-day × multi-tenant aggregate

### `known-issues.md`
- TD-F059-SPARKLINE-PERF-BUDGET (MED — monitor PROD 24h)
- TD-F059-MANUAL-FEE-CONFUSION (LOW — UI tooltip Phí = ORDINARY + MANUAL)
- TD-F059-PAYMENT-ON-CONSISTENCY (LOW — verified)
- TD-F059-PRELOAD-NO-SKIP-FEESERVICE (LOW — cosmetic, refactor FeeService accept config-injected trong F-060 nếu cần)

---

## ✅ Status

🎉 **FEATURE-059 CODE-LEVEL DONE** — Push pending Danny decision (merge main + cut release/v1.9.3).
