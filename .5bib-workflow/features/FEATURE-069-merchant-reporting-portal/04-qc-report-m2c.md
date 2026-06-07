# FEATURE-069 M2c: QC Report — Revenue Trend + Excel Export + Order-PII

**Status:** ✅ APPROVED
**QC:** 5bib-qc-gatekeeper (No Mercy Protocol)
**Date:** 2026-06-05
**Milestone:** M2c (revenue trend + Excel export + order-table PII fold-in)
**Scope note:** Backend-only → **Phase 6 Persona Walkthrough N/A** (UI deferred M4).

---

## Gate Check
- [x] `03-coder-implementation-m2c.md` status `🟠 READY_FOR_QC`
- [x] "Tests Written" present + PASS (58 service incl 5 M2c + updated order test)
- [x] Read PRD (BR-MP-10/11 revenue, BR-MP-09 financial gate) + Manager M2c plan + Danny order-PII decision
- [x] Read `conventions.md` (Forced #1, FeeService.totalNetGmv quirk, anti-`as unknown as`)

---

## Phase 1: Impact & Regression Audit
**Coder got right:**
- Reuses `pullOrdersForFeeAggregate` (date clause) + bucket-helpers + FeeService + F-062 exceljs/`@Res` pattern. No new dep (exceljs present).
- Export reuses getRevenueSummary + getRevenueByCategory → inherits finance+scope gating (no duplicate auth logic).
- order-PII fold-in: +email/phone, `total_price` still excluded.

**Regression:** all prior milestones green (98/98). order-table DTO change additive (buyerEmail/buyerPhone added) — no break.

## Phase 2: Security Threat Model
| Vector | Probe | Verdict |
|--------|-------|---------|
| Financial gate (revenue trend/export) | LogtoMerchantFinanceGuard + assertRevenuePermission (export via getRevenueSummary). Viewer → 403 before pull (unit verified, both). | ✅ SAFE |
| IDOR | trend: assertRaceAccessible before pull; export: inside reused gated methods. | ✅ SAFE |
| SQL injection | trend date clause `om.payment_on >= ? AND < ?` bound; pullOrders parameterized. | ✅ SAFE |
| Export header injection | `@Res` sends buffer + Content-Disposition `filename="5bib-merchant-revenue-race-${raceId}"` — raceId is validated int (DTO @IsInt), no user string in header. | ✅ SAFE |
| order-PII (email/phone) | **INTENTIONAL show-full** (Danny 2026-06-05 — BTC owns race customer data). order-table = MerchantGuard (viewer+finance). `total_price` STILL excluded (BR-MP-09 financial). | ✅ By-design |
| Cache | trend key per-user+race+period+granularity; export uncached. | ✅ SAFE |

## Phase 3: Adversarial + Live-DB Verification
- Adversarial Attack #13 updated: order SQL — `total_price`/`total_discounts` excluded; `email`/`phone_number` NOW allowed (Danny show-full).
- **QC live-DB reconcile (race 138):**
```
[A] revenue-trend bucket partition (32 daily buckets):
    Σ(bucket gmv) = total paid GMV = 1,035,025,000  → [1] lossless partition TRUE
    [2] trend Σ == summary GMV (M2b-3) ............. TRUE (byte-identical)
[B] order buyer contact: email [present] + phone [present], real VN "Đào Thoại."
```
→ revenue trend GMV reconciles byte-exact with M2b-3 summary; order-PII show-full works on real data.

## Phase 4: Execution + 10x Flaky
```
Full module: 4 suites, 98 passed (93 prior + 5 M2c)
10x flaky: 98/98 × 10 deterministic (Coder) + QC independent 98/98
tsc clean · Live 8081: 13 endpoints, 2 M2c routes 401-guarded · export unit asserts PK-zip magic
```
**Performance:** revenue/trend = N FeeService calls per bucket (daily 90d ≤90), cached 60s. export = 2 small queries + exceljs (in-memory). Live p95 → M5. Not blocking.

## Phase 5: PRD Compliance
| BR / decision | Code | Verified |
|---------------|------|----------|
| BR-MP-10/11 revenue trend GMV/fee/net by bucket | ✅ | trend tests + live [A] |
| BR-MP-11 Excel export | ✅ 2-sheet xlsx | export test PK magic + mime |
| BR-MP-09 financial gate | ✅ 2-layer | viewer-403 trend + export |
| financial_status='paid' only | ✅ | date-clause pull paid |
| Order-PII show-full (Danny 2026-06-05) | ✅ buyerEmail/buyerPhone, total_price excluded | order test + Attack #13 + live [B] |

## Tech Debt (carry to known-issues)
- **TD-F069-M2c-TREND-FEE-ROUNDING** 🟢 NEW (QC finding) — summing per-bucket `FeeService.totalFee` can differ ±vài đồng from single-shot total (FeeService rounds service-fee per call). Trend fee is a per-bucket approximation; authoritative total = `/revenue/summary`. Acceptable for a chart; note in UI ("tổng phí chính xác xem ở Tổng quan").
- **TD-F069-M2c-TREND-FEE-PERBUCKET** 🟢 (Coder) — N FeeService calls/bucket (cached 60s); optimize via injectedConfig later.
- **TD-F069-M2c-EXPORT-NO-TREND-SHEET** 🟢 — export v1 = Summary+By-Category only.
- generate:api deferred M4.

## Final Verdict: ✅ APPROVED
Revenue trend + export + order-PII stand up under adversarial + live-DB: trend GMV reconciles byte-exact with summary (lossless bucket partition on 1.03B), export emits valid PK-zip xlsx, order-PII show-full per Danny (total_price still excluded), 2-layer finance gate, SQLi-safe, no header injection. 98 tests 100% deterministic ×10. One QC-found rounding note (trend fee per-bucket approximation) flagged as LOW TD — not a blocker (authoritative total is /revenue/summary).

→ Ready for `/5bib-deploy` (M2c partial). **Backend reporting layer of F-069 COMPLETE** (13 endpoints).
