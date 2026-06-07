# FEATURE-069 M2b-2: QC Report — Ticket Sales Endpoints

**Status:** ✅ APPROVED
**QC:** 5bib-qc-gatekeeper (No Mercy Protocol)
**Date:** 2026-06-05
**Milestone:** M2b-2 (summary KPI + by-course + by-type breakdown)
**Scope note:** Backend-only → **Phase 6 Persona Walkthrough N/A** (UI deferred to M4).

---

## Gate Check
- [x] `03-coder-implementation-m2b-2.md` status `🟠 READY_FOR_QC`
- [x] "Tests Written" present + PASS output (29 service tests incl 10 M2b-2)
- [x] Read `01-ba-prd-revision-r2.md` (BR-MP-07/08/09 ticket-sales) + `r3.md` (canonical chain SQL, DISC-1/4/5, PAUSE-R3-01 FINAL)
- [x] Read `conventions.md` (Forced #1 try/catch rule, MySQL schema section)

---

## Phase 1: Impact & Regression Audit
**Coder got right:**
- Reuses M2b-1 `resolveAccessibleRaces` + `assertRaceAccessible` — single scope source, no duplicate logic.
- `@InjectDataSource('platform')` already wired (M2a). 3 additive endpoints, no module change.
- `cachedTicketRead<T>` helper correctly honors the Forced #1 convention (try/catch wraps ONLY redis+parse; compute outside).
- 3 new Redis keys per-user + per-race namespaced, 60s TTL.

**Regression:** M2b-1 (50 tests) + M2a all still green. Total module 63/63.

## Phase 2: Security Threat Model
| Vector | Probe | Verdict |
|--------|-------|---------|
| SQL injection | All 3 aggregates use `?` + `[raceId]` params. ZERO value interpolation (adversarial Attack #6 asserts `501` NOT in SQL text, `om.race_id = ?` present). | ✅ SAFE |
| IDOR (cross-user) | userId from `@CurrentUser` JWT; cache keys per-user (Attack #7). | ✅ SAFE |
| IDOR (cross-race) | `assertRaceForUser` → 403 BEFORE any aggregate SQL (unit: only resolve query runs, then throws). Cache key per-race → no cross-race read. | ✅ SAFE |
| Auth bypass | Class-level `LogtoMerchantGuard` covers all 3 routes. | ✅ SAFE |
| Info disclosure (financial) | **BR-MP-09 STRICT.** Real-DB QC confirmed queries SELECT only id/name/COUNT/SUM(quantity) — NO total_price/price/gmv/fee. DTOs have no financial field. | ✅ SAFE |
| Cache poisoning | Corrupt JSON → recompute (Attack #8). | ✅ SAFE |

## Phase 3: Adversarial Test Scripts (QC-verified + real-DB)
- Adversarial spec now 9 attacks (5 M2b-1 + Attack #6 SQLi-param-bind, #7 ticket cache namespacing, #8 corrupt-cache).
- **QC real-DB cross-check (race 138, live `5bib_platform_live`)** — beyond mocks:

```
SUMMARY: paid 3031 orders/4252 tickets, voided 439/571 → totalAll = 4823
BY-COURSE (paid): 4 courses, Σ = 4252
BY-TYPE  (paid): 4 types,   Σ = 4252
CROSS-CHECKS:
 [1] by-course Σ == by-type Σ ............ TRUE (4252 == 4252)
 [2] breakdown Σ <= summary paid ......... TRUE (4252 <= 4252)
 [3] orphan gap (paid not mapping course)  0
 [4] totalAll >= paid (voided included) .. TRUE (4823 >= 4252)
```
→ **Deviation #3 (paid-only breakdown vs all-status summary) is CORRECT on real data.** Voided 571 counted in `totalTickets` (4823), excluded from breakdowns (4252).

## Phase 4: Execution + 10x Flaky
```
Full module: 4 suites, 63 passed (50 prior + 13 M2b-2: 10 service + 3 adversarial)
10x flaky: 63/63 × 10 — 100% deterministic
tsc --noEmit: clean (independent QC run)
Anti-pattern grep: clean (no console.log/any/as unknown/TODO)
```
**Performance:** unit layer mocked; queries index-bounded (`om.race_id = ?` + indexed FK joins), per-user 60s cache. Real-DB queries returned instantly on race 138 (largest paid race, 4823 tickets). p95 to measure at M5. Not blocking (no production consumer).

## Phase 5: PRD / R3 Compliance
| BR / R3 rule | Code | Verified |
|--------------|------|----------|
| BR-MP-07 KPI summary (4 cards) | ✅ total + paid/voided/pending (always 3) | summary tests + real-DB |
| BR-MP-08 FINAL `financial_status` 3 values | ✅ canonical 3 normalized + unknown appended | unknown-status test |
| BR-MP-07 course breakdown via chain | ✅ `oli→om→tt→rc`, GROUP BY rc.id | chain test (`.not.toMatch(om.race_course_id)`) |
| BR-MP-07 type breakdown | ✅ `tt.type_name`, GROUP BY tt.id | type test |
| BR-MP-09 NO financial fields | ✅ counts only | real-DB column inspection + DTO review |
| DISC-1 om has no race_course_id | ✅ chain used | adversarial |
| DISC-4 `tt.type_name` not `name` | ✅ | live SHOW COLUMNS |
| DISC-5 `race_course` singular, dup names | ✅ GROUP BY rc.id keeps distinct | dup-name test (540 & 515 "2,9 km") |
| R3 line 242 "Tổng vé" = all-status | ✅ totalTickets all | real-DB [4] |

## Tech Debt (carry to known-issues)
- **TD-F069-M2b2-BREAKDOWN-INNERJOIN-ORPHAN** 🟢 LOW NEW — by-course/by-type use INNER JOIN to `race_course`/`ticket_type`. If a paid line item's ticket_type has null/invalid `race_course_id` (orphan), its tickets drop from breakdown but remain in summary paid → breakdown Σ < summary paid. Gap=0 on race 138 (largest), so no current impact. If product needs reconciliation guarantee, add a "Khác/Chưa phân loại" bucket via LEFT JOIN. Monitor when more races onboard.
- **TD-F069-M2b2-NO-PERIOD-FILTER** 🟢 LOW (Coder-flagged) — all-time, no delta %. Defer M2b-2b.
- **TD-F069-M2b2-TREND-STACKED-TABLE-DEFER** 🟢 — trend/AnStacked/order-table → M2b-2b.
- **TD-F069-M2b2-GENERATE-API** — deferred M4.

## Final Verdict: ✅ APPROVED
3 endpoints stand up under adversarial + real-DB probing: SQLi-safe (param-bound), IDOR-safe (cross-user + cross-race + pre-SQL 403), BR-MP-09 financial-leak-free (real-DB column-verified), R3 chain-exact. The paid-vs-all semantic — the riskiest correctness point — is proven correct on 4823 real tickets. 63 tests 100% deterministic ×10. One latent LOW TD (orphan INNER JOIN) noted, gap=0 currently.

→ Ready for `/5bib-deploy` (M2b-2 partial).
