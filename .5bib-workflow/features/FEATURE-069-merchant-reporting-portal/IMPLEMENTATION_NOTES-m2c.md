# FEATURE-069 M2c — Implementation Notes (Reviewer's Guide)

**Milestone:** M2c — Revenue trend + Excel export + order-table PII fold-in
**Date:** 2026-06-05

---

## Section 1: 🚧 Deviations from Spec (intentional)

- **[Deviation #1] Revenue trend buckets IN-MEMORY (not SQL like ticket trend)**
  - **Spec said:** Manager plan "GMV/fee/net per bucket".
  - **I did:** Pull paid orders (period date clause) then group by bucket in JS via bucket-helpers; FeeService per bucket.
  - **Why:** FeeService.computeFeeForOrdersAggregate needs the actual order OBJECTS (per-order cascade), so I can't SQL-GROUP-then-fee. Must hold orders, bucket them, fee each bucket. Ticket trend (M2b-2b) could SQL-group because it's pure COUNT.
  - **Reviewer should check:** bucket keys (UTC via bucket-helpers) — ISO week matches YEARWEEK mode 3; daily UTC may differ ±1 from ticket-trend's SQL session-TZ buckets (both F-062 precedent). TD-F069-M2b2b-BUCKET-TZ covers.

- **[Deviation #2] Export workbook = Summary + By-Category only (no Trend/cross-tenant sheet)**
  - **Spec said:** Manager plan listed "Summary + By-Category + cross-tenant + Trend".
  - **I did:** 2 sheets (Tổng quan + Theo loại phí).
  - **Why:** Keep v1 tight + the 2 most-used views. Trend/cross-tenant sheets are additive later (TD-F069-M2c-EXPORT-NO-TREND-SHEET).
  - **Reviewer should check:** acceptable for v1? Add sheets if product needs.

## Section 2: ⚙️ Forced Changes (reality ≠ spec)

- **[Forced #1] order-PII reversal — show-full (Danny 2026-06-05)**
  - **PRD/M2b-2b assumed:** order table excludes email/phone (PII conservatism).
  - **Reality:** Danny decided BTC (race organizer) owns their race's customer data → show full buyerEmail + buyerPhone.
  - **Workaround:** +`om.email, om.phone_number` to SELECT + DTO buyerEmail/buyerPhone. total_price STILL excluded (financial). Adversarial Attack #13 + order test updated.
  - **Manager/BA action:** TD-F069-M2b2b-ORDER-PII marked DECIDED. None further.

## Section 3: ⚖️ Tradeoffs Considered

| Decision | Chosen | Alternative | Why | Cost paid |
|----------|--------|-------------|-----|-----------|
| Trend bucketing | in-memory | SQL GROUP BY | FeeService needs order objects per bucket | hold orders in memory (one race, bounded) |
| Fee per bucket | N FeeService calls | 1 call + manual split | cascade is per-order, can't split aggregate | N MerchantConfig findOne (cached 60s) — perf TD |
| Export sheets | 2 (summary+category) | 4 (+trend+cross-tenant) | tight v1, most-used | trend/cross-tenant sheets later |
| Export caching | none | cache buffer 60s | files regenerate cheap; avoid stale | regen per call (bounded — 2 small queries + exceljs) |
| order email/phone | show full | mask | Danny: BTC owns data | PII visible to merchant_viewer too? NO — order table is MerchantGuard (viewer+finance). Buyer contact = ticket-level, not financial. Acceptable per Danny. |

## Section 4: 🔬 Reviewer Notes — Priority spot-check order

1. **`getRevenueTrend`** — verify guard order config→perm→resolve→assertRaceAccessible BEFORE pull; date clause `om.payment_on >= ? AND < ?` bound params; in-memory bucket via `dateBucketKeyLabel`; FeeService per bucket; net = gmv − fee per bucket.
2. **`getRevenueExport`** — reuses getRevenueSummary + getRevenueByCategory (BOTH finance+scope gated → export inherits 403/404). exceljs Workbook → `writeBuffer()` → `Buffer.from(... as ArrayBuffer)`. Controller `@Res` + Content-Disposition attachment.
3. **`getTicketSalesOrders`** — order-PII: SELECT now has `om.email, om.phone_number`; total_price STILL absent (Attack #13 asserts). buyerEmail/buyerPhone null-safe.
4. **Controller `/revenue/export`** — `@Res() res` raw response (only place not returning a DTO); `LogtoMerchantFinanceGuard`. Note: `@Res` bypasses Nest interceptors — acceptable for file stream.
5. **Perf** — TD-F069-M2c-TREND-FEE-PERBUCKET (N FeeService/bucket). Cached 60s.

### Security checklist self-applied
- [x] revenue/trend + export: LogtoMerchantFinanceGuard + assertRevenuePermission (export via getRevenueSummary).
- [x] IDOR: assertRaceAccessible before pull (trend) / inside reused methods (export).
- [x] SQL: date clause `?`-bound; no interpolation.
- [x] order-PII: email/phone intentionally shown (Danny); total_price still excluded.
- [x] export `@Res`: only sends buffer + 2 headers, no user-controlled header injection (filename = `race-${raceId}`, raceId is validated int).

### Edge cases tested vs deferred
- ✅ Tested: trend bucket math, viewer-403 (trend+export), empty period, export buffer (PK magic)+filename+mime, order email/phone show-full.
- ⚠️ Deferred: trend FeeService-per-bucket perf (TD), export trend/cross-tenant sheets (TD), live p95 (M5).
