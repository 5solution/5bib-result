# FEATURE-069 M2b-2b: QC Report — Ticket Sales Chart Endpoints

**Status:** ✅ APPROVED
**QC:** 5bib-qc-gatekeeper (No Mercy Protocol)
**Date:** 2026-06-05
**Milestone:** M2b-2b (trend + stacked + order-detail-table)
**Scope note:** Backend-only → **Phase 6 Persona Walkthrough N/A** (UI deferred M4).

---

## Gate Check
- [x] `03-coder-implementation-m2b-2b.md` status `🟠 READY_FOR_QC`
- [x] "Tests Written" present + PASS (53 service incl 11 M2b-2b)
- [x] Read PRD R2 (chart specs) + R3 (chain) + `conventions.md` (no-financial, Forced #1, anti-`as unknown as`)

---

## Phase 1: Impact & Regression Audit
**Coder got right:**
- Reuses `period-resolver` + `bucket-helpers` (no reinvented bucketing) + `assertRaceForUser` + `cachedTicketRead`.
- **Live-DB pre-flight resolved the Manager-flagged order-table risk** (buyer columns exist — Forced #1).
- 2 new Redis keys (trend/stacked incl period+granularity); orders uncached (combinatorial — correct).
- Fixed `as unknown as` → `[...ENUM]` spread (hard-rule honored).

**Regression:** M2b-1/2/3/3b + M2a green (93/93). No shared-state collision.

## Phase 2: Security Threat Model
| Vector | Probe | Verdict |
|--------|-------|---------|
| **PII leak (orders)** | order row query SELECTs name parts (for buyerName) but **NO email/phone/total_price** — QC live-DB confirmed result keys exclude them (Attack #13 asserts SQL string too). Response DTO = buyerName only (raw first/last not exposed). | ✅ SAFE |
| Financial leak (BR-MP-09) | trend/stacked = counts only; orders no total_price. | ✅ SAFE |
| IDOR | `assertRaceForUser` before query on all 3 (unit: only resolve query runs then 403). | ✅ SAFE |
| SQL injection | bucketExpr = internal constant (no user input); raceId/from/to/status/search/page/pageSize all `?`-bound; search LIKE param-bound; period/granularity DTO `@IsIn`. | ✅ SAFE |
| Auth | class-level `LogtoMerchantGuard`. Live: 3 routes 401 no-token. | ✅ SAFE |
| Cache poisoning | `cachedTicketRead` recompute; keys per-user+race+period+granularity (Attack #14). | ✅ SAFE |

## Phase 3: Adversarial + Live-DB Verification
- Adversarial spec now 14 attacks (12 prior + #13 orders-SQL-no-PII, #14 trend cache namespacing).
- **QC live-DB reconcile (race 138, `5bib_platform_live`):**
```
[A] trend ΣorderCount = 3031  ==  total paid orders 3031  (32 daily buckets) → no order lost
[B] stacked per-course Σ(buckets) {535:413, 538:159, 540:3660, 542:20}
    == by-course breakdown (M2b-2) EXACTLY → Deviation #2 (ticket-count) reconciles
[C] orders result keys: order_id, first_name, last_name, name, financial_status,
    payment_on, quantity, course_name, ticket_type_name
    → NO email / NO phone_number / NO total_price · buyerName real VN "Nguyễn Trọng Đức"
```
→ Charts correct on real data: trend bucketing complete, stacked reconciles with by-course, orders PII-safe with real VN diacritic names.

## Phase 4: Execution + 10x Flaky
```
Full module: 4 suites, 93 passed (80 prior + 13 M2b-2b)
10x flaky: 93/93 × 10 deterministic (Coder) + QC independent 93/93
tsc clean · Live 8081: 11 endpoints, 3 chart routes 401-guarded
```
**Performance:** trend/stacked single GROUP BY query, cached 60s. orders paginated (LIMIT) + 1 COUNT. Index-friendly (`om.race_id` filter). Live p95 → M5. Not blocking.

## Phase 5: PRD Compliance
| BR / spec | Code | Verified |
|-----------|------|----------|
| BR-MP-07 chart #1 trend | ✅ COUNT paid by bucket | trend tests + live [A] |
| BR-MP-07 chart #2 AnStacked | ✅ course×bucket, stable order | stacked tests + live [B] reconcile |
| BR-MP-07 order table 20/page + filter + search | ✅ pagination + financialStatus + name search | orders tests |
| BR-MP-09 NO financial | ✅ counts only / no total_price | live [C] + Attack #13 |
| R3 chain `oli→om→tt→rc` (no om.race_course_id) | ✅ | stacked test `.not.toMatch` |
| Bucket via period-resolver/bucket-helpers | ✅ daily/weekly/monthly labels | trend tests |

## Tech Debt (carry to known-issues)
- **TD-F069-M2b2b-ORDER-PII** 🟢 — email/phone excluded pending product decision on buyer-contact exposure.
- **TD-F069-M2b2b-BUCKET-TZ** 🟢 — bucket TZ (MySQL session) vs UTC from/to; F-062 precedent. Validate M5.
- **TD-F069-M2b2b-ORDER-MULTI-COURSE** 🟢 — multi-course order collapses to one representative row.
- **TD-F069-R3-ORDER-COLS-INCOMPLETE** 🟢 (BA/Manager action) — R3 column dump for order_metadata omitted buyer fields (name/first_name/last_name/email/phone_number/user_id); update R3/codebase-map.
- generate:api deferred M4.

## Final Verdict: ✅ APPROVED
3 chart endpoints stand up under adversarial + live-DB reconcile: trend complete (Σ==total), stacked reconciles byte-exact with by-course, orders PII-safe (no email/phone/total_price, real VN names work), IDOR-safe, SQLi-safe, no-financial. 93 tests 100% deterministic ×10. The Manager-flagged order-table risk was resolved by live-DB verify (buyer columns exist — R3 dump was incomplete).

→ Ready for `/5bib-deploy` (M2b-2b partial).
