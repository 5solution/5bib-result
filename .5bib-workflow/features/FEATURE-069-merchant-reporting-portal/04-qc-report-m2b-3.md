# FEATURE-069 M2b-3: QC Report — Revenue Summary

**Status:** ✅ APPROVED
**QC:** 5bib-qc-gatekeeper (No Mercy Protocol)
**Date:** 2026-06-05
**Milestone:** M2b-3 (single-race revenue summary, finance-gated)
**Scope note:** Backend-only → **Phase 6 Persona Walkthrough N/A** (UI deferred M4).

---

## Gate Check
- [x] `03-coder-implementation-m2b-3.md` status `🟠 READY_FOR_QC`
- [x] "Tests Written" present + PASS (36 service incl 7 revenue)
- [x] Read PRD (BR-MP-10 revenue, BR-MP-21b cross-tenant, BR-MP-09 financial gate) + R3 GMV SQL
- [x] Read `conventions.md` (Forced #1 try/catch, MANUAL vs % fee invariant, financial_status='paid' revenue rule)

---

## Phase 1: Impact & Regression Audit
**Coder got right:**
- Consumes `pullOrdersForFeeAggregate` + `FeeService.computeFeeForOrdersAggregate` — does NOT re-implement fee cascade (F-040/F-058 invariant single-source). Fee logic untouched.
- `FinanceModule` import verified no-circular (booted clean on 8082). FeeService injected.
- GMV from pulled orders (Deviation #2) — **QC live-DB proved identical to R3 GMV SQL** (no drift).
- 1 NEW Redis key per-user+per-race, 60s TTL.

**Regression:** M2b-1/2 + M2a all green (72/72). No shared-state collision.

## Phase 2: Security Threat Model
| Vector | Probe | Verdict |
|--------|-------|---------|
| **Financial data exposure (BR-MP-09)** | Revenue behind 2 layers: controller `LogtoMerchantFinanceGuard` (merchant_finance role) + service `assertRevenuePermission` (config.revenue_report). Viewer → 403 BEFORE any SQL (Attack #9: zero db.query). | ✅ SAFE |
| Auth bypass | Method-level FinanceGuard stricter than class MerchantGuard; both must pass. Live: 401 no-token. | ✅ SAFE |
| IDOR (cross-race) | `assertRaceAccessible` before order pull (unit: only resolve query runs then 403). | ✅ SAFE |
| IDOR (cross-tenant) | GMV/fee scoped to the race's tenant (pullOrders JOIN races filter raceId). QC confirmed race 138 → single tenant 46. | ✅ SAFE |
| SQL injection | `pullOrdersForFeeAggregate` parameterized; raceId bound via `{raceId}` → `om.race_id = ?`. No value interpolation. | ✅ SAFE |
| Cache poisoning | `cachedTicketRead` try/catch → recompute; key per-user+per-race (Attack #10). | ✅ SAFE |
| Info disclosure | DTO exposes only aggregate financials (no per-order PII, no `_id`, no merchant fee-rate config). | ✅ SAFE |

## Phase 3: Adversarial + Live-DB Verification
- Adversarial spec now 11 attacks (8 prior + #9 viewer-perm-gate-before-SQL, #10 revenue cache namespacing).
- **QC live-DB revenue invariant cross-check (race 138, `5bib_platform_live`):**
```
[A] R3 GMV SQL:            gmv = 1,035,025,000   orderCount = 3031
[B] Coder GMV-from-orders: gmv = 1,035,025,000   orderCount = 3031
[1] GMV-from-orders == R3 GMV SQL ........ TRUE (identical — Deviation #2 zero drift)
[2] orderCount match ..................... TRUE (3031)
[3] single race → single tenant .......... TRUE (tenant 46)
[4] GMV ~1.03B positive (net plausible) .. TRUE
```
→ The riskiest correctness point (GMV computed from orders vs spec's standalone SQL) is **proven identical on 1B+ real money**. Single-tenant-per-race assumption (per-tenant-loop seam) confirmed.

## Phase 4: Execution + 10x Flaky
```
Full module: 4 suites, 72 passed (63 prior + 9 M2b-3)
10x flaky: 72/72 × 10 deterministic (Coder) + QC independent run 72/72
tsc: clean · Live: revenue/summary mounted on 8082, 401 no-auth, Swagger 6 routes
```
**Performance:** unit mocked; FeeService cascade is in-memory over one race's paid orders (race 138 = 3031 orders) — bounded, cached 60s. Live p95 → M5. Not blocking.

## Phase 5: PRD / Invariant Compliance
| BR / Invariant | Code | Verified |
|----------------|------|----------|
| BR-MP-10 GMV = Σ(price−discount) paid | ✅ | QC live-DB [1] identical to R3 |
| BR-MP-10 Net = GMV − fee | ✅ | unit happy-path (150000−8800=141200) |
| BR-MP-09 financial gate (finance role + revenue_report) | ✅ 2-layer | Attack #9 + unit viewer-403 |
| `financial_status='paid'` ONLY in revenue | ✅ | pullOrders helper L84 + QC live |
| MANUAL=VNĐ/vé vs %=rate fee invariant | ✅ (inside FeeService, consumed) | FeeService own tests (F-040/F-058) |
| FeeService consumed read-only (not modified) | ✅ | grep — only `.computeFeeForOrdersAggregate` call |

## Tech Debt (carry to known-issues)
- **TD-F069-M2b3-CROSS-TENANT-DEFER** 🟢 — BR-MP-21b "Tất cả BTC" per-tenant loop → M2b-3b.
- **TD-F069-M2b3-BREAKDOWN-TREND-EXPORT-DEFER** 🟢 — revenue breakdown (order_category BR-MP-12) + trend + Excel → M2b-3b/M2c.
- **TD-F069-M2b3-PERIOD** 🟢 — all-time, no date filter/delta (FeeService voids _period; date filter at pull layer M2b-3b).
- generate:api deferred M4.

## Final Verdict: ✅ APPROVED
Revenue endpoint stands up under adversarial + live-DB probing: 2-layer finance gate (zero data access for unauthorized), IDOR-safe, SQLi-safe, fee logic consumed-not-modified. The GMV-from-orders approach is **proven byte-identical to the R3 spec SQL on 1.03B real revenue** — net reconciles. FeeService Tier-3 fallback surfaced via warnings. 72 tests 100% deterministic ×10.

→ Ready for `/5bib-deploy` (M2b-3 partial).
