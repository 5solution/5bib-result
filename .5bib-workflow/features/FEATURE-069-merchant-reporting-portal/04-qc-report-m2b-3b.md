# FEATURE-069 M2b-3b: QC Report — Revenue Breakdown + Cross-Tenant Aggregate

**Status:** ✅ APPROVED
**QC:** 5bib-qc-gatekeeper (No Mercy Protocol)
**Date:** 2026-06-05
**Milestone:** M2b-3b (by-category BR-MP-12 Option A + cross-tenant aggregate BR-MP-21b)
**Scope note:** Backend-only → **Phase 6 Persona Walkthrough N/A** (UI deferred M4).

---

## Gate Check
- [x] `03-coder-implementation-m2b-3b.md` status `🟠 READY_FOR_QC`
- [x] "Tests Written" present + PASS (42 service incl 6 M2b-3b)
- [x] Read PRD (BR-MP-12 grouping, BR-MP-21b per-tenant loop, BR-MP-09 finance gate) + R3 line 285 Option A
- [x] Read `conventions.md` (fee invariant, Forced #1, Display Convention)

---

## Phase 1: Impact & Regression Audit
**Coder got right:**
- Reuses `pullOrdersForFeeAggregate` + `getRevenueSummary` per-tenant seam — no new SQL, no fee-logic change.
- FinanceModule already imported (M2b-3) — no new DI. 2 endpoints additive.
- `categoryGroup` null-safe (future category → fee_percent, no crash).
- 2 new Redis keys per-user (+per-race for by-category), 60s.

**Regression:** M2b-1/2/3 + M2a all green (80/80). No shared-state collision.

## Phase 2: Security Threat Model
| Vector | Probe | Verdict |
|--------|-------|---------|
| Financial exposure (BR-MP-09) | Both endpoints: controller `LogtoMerchantFinanceGuard` + service `assertRevenuePermission` (2-layer). Viewer → 403 BEFORE SQL (Attack #12 by-category, aggregate viewer-403 unit). | ✅ SAFE |
| **Cross-tenant leak** | aggregate filters each tenant's orders to `accessible.has(raceId)` → exclude-override race excluded (Attack #11: race 502/888888 dropped, gmv stays 100k). | ✅ SAFE |
| IDOR (by-category) | `assertRaceAccessible` before pull. | ✅ SAFE |
| SQL injection | pullOrders parameterized (tenantId/raceId bound). | ✅ SAFE |
| Cache poisoning | `cachedTicketRead` recompute; keys per-user(+race). | ✅ SAFE |
| Info disclosure | DTO aggregate financials only, no per-order PII, raw groupKey/tenantId. | ✅ SAFE |

## Phase 3: Adversarial + Live-DB Verification
- Adversarial spec now 13 attacks (11 prior + #11 exclude-override-aggregate-exclusion, #12 by-category-viewer-403).
- **QC live-DB cross-check #1 — by-category reconciliation (race 138, tenant 46):**
```
fee_percent: gmv=1,035,025,000  n=3031   |  fee_fixed: gmv=0  n=0
distinct categories: [ORDINARY, CHANGE_COURSE]  (both → fee_percent, Option A ✓)
[1] by-category Σ == single-race summary GMV ... TRUE (1,035,025,000)
[2] group counts add to total orders ........... TRUE (3031)
[3] every category mapped (no order lost) ...... TRUE
```
- **QC live-DB cross-check #2 — Option A split with MANUAL present (race 34):**
```
race 34: 1043 MANUAL + 315 other
fee_fixed.n = 1043  ==  direct MANUAL count 1043  → MANUAL isolated EXACTLY
fee_percent.n = 315 (the rest)
```
→ Option A grouping (BR-MP-12) **proven correct on real data both with and without MANUAL**. by-category reconciles byte-identical with M2b-3 summary. Always-emit-both-groups validated (race 138 fee_fixed 0-fill).

## Phase 4: Execution + 10x Flaky
```
Full module: 4 suites, 80 passed (72 prior + 8 M2b-3b)
10x flaky: 80/80 × 10 deterministic (Coder) + QC independent run 80/80
tsc: clean · Live: 8 endpoints on 8082, both new revenue routes 401-guarded
```
**Performance:** aggregate = N pulls (one per cfg.tenantIds) + N FeeService runs; by-category = 1 pull + ≤2 FeeService/tenant. In-memory, bounded by tenant order volume, cached 60s. Live p95 → M5. Not blocking (no prod consumer).

## Phase 5: PRD Compliance
| BR / Invariant | Code | Verified |
|----------------|------|----------|
| BR-MP-12 Option A grouping (MANUAL→fixed, else→percent) | ✅ | QC live-DB race 34 exact split + race 138 |
| BR-MP-12 always 2 groups (0-fill) | ✅ | unit + race 138 (fee_fixed 0) |
| BR-MP-21b per-tenant FeeService loop | ✅ | unit cross-tenant test |
| BR-MP-21b scope to accessible races | ✅ | Attack #11 exclude-override |
| BR-MP-09 finance gate (2-layer) | ✅ | Attack #12 + aggregate viewer-403 |
| financial_status='paid' only | ✅ | pullOrders helper |
| fee logic consumed not modified | ✅ | finance/ untouched (M2b-3 verified) |

## Tech Debt (carry to known-issues)
- **TD-F069-M2b3b-INCLUDE-OUTSIDE-TENANT** 🟢 — aggregate loops cfg.tenantIds; include-override races to tenants outside agency not in rollup (BR-MP-21b intent; visible in /races + single-race). Documented.
- **TD-F069-M2b3b-TENANT-NAME** 🟢 — aggregate returns tenantId only, no BTC name → frontend/M3 enrich.
- **TD-F069-M2b3-TREND-EXPORT-DEFER** 🟢 — revenue trend + Excel export → M2c.
- generate:api deferred M4.

## Final Verdict: ✅ APPROVED
Cross-tenant aggregate + category breakdown stand up under adversarial + 2 live-DB cross-checks: 2-layer finance gate (zero data for viewer), cross-tenant scoping respects exclude-overrides (no leak), Option A grouping **proven exact on real MANUAL data (race 34) and reconciles byte-identical with M2b-3 summary (race 138)**. Fee consumed-not-modified. 80 tests 100% deterministic ×10.

→ Ready for `/5bib-deploy` (M2b-3b partial).
