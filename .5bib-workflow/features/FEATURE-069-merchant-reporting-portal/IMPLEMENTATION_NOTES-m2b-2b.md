# FEATURE-069 M2b-2b — Implementation Notes (Reviewer's Guide)

**Milestone:** M2b-2b — Ticket Sales charts (trend + stacked + order-detail-table)
**Date:** 2026-06-05

---

## Section 1: 🚧 Deviations from Spec (intentional)

- **[Deviation #1] String-output bucket exprs (daily = DATE_FORMAT, not resolveBucketSize's DATE())**
  - **Spec said:** Manager plan "reuse resolveBucketSize" — daily expr there is `DATE(payment_on)`.
  - **I did:** daily uses `DATE_FORMAT(om.payment_on, '%Y-%m-%d')` (string); weekly/monthly reuse resolveBucketSize forms.
  - **Why:** `DATE()` makes mysql2 return a JS `Date`; `ymdUtc(date)` (UTC) can shift the day if the connection TZ ≠ UTC → wrong daily bucket. String output is reinterpret-proof.
  - **Reviewer should check:** weekly/monthly still use the canonical `YEARWEEK(,3)` / `DATE_FORMAT(,'%Y-%m')`. Daily label DD/MM sliced from the string.

- **[Deviation #2] Stacked uses ticket count (SUM quantity), not order count**
  - **Spec said:** R2 chart #2 wrote `COUNT(order_metadata) GROUP BY race_course_id`.
  - **I did:** `SUM(oli.quantity)` per course×bucket via chain.
  - **Why:** (a) om has no race_course_id → chain mandatory anyway; (b) ticket count reconciles with M2b-2 by-course breakdown (also ticket count) so the stacked layers sum to the same totals the donut/bar show. Order count would diverge.
  - **Reviewer should check:** consistency with by-course — both ticket-count, paid-only.

## Section 2: ⚙️ Forced Changes (reality ≠ spec)

- **[Forced #1] R3 "verified columns" list for order_metadata was INCOMPLETE — buyer fields exist**
  - **PRD/Manager assumed:** R3 line 292 dump + Manager plan flagged "order_metadata has NO buyer/athlete name" → order-table risky.
  - **Reality:** live `SHOW COLUMNS order_metadata` → has `name, first_name, last_name, email, phone_number, user_id` (R3 dump omitted them).
  - **Workaround:** order-table viable — show buyer NAME (first+last → name fallback). search = name LIKE. Excluded email/phone (PII conservatism, TD).
  - **Manager/BA action:** Update R3/codebase-map: order_metadata HAS buyer PII columns (name/first_name/last_name/email/phone_number/user_id). The earlier "no buyer name" assumption was wrong.

## Section 3: ⚖️ Tradeoffs Considered

| Decision | Chosen | Alternative | Why | Cost paid |
|----------|--------|-------------|-----|-----------|
| daily bucket | DATE_FORMAT string | DATE() + ymdUtc | TZ-reinterpret-proof | tiny deviation from helper |
| stacked metric | ticket count | order count | reconciles with by-course | n/a |
| orders cache | none | cache 60s | filter/page/search combinatorial → low hit, stale risk | every call hits DB (bounded by pagination LIMIT) |
| order row course/type | representative line (MIN ticket_type_id) + SUM qty | one row per line item | one row per order = cleaner table | multi-course order collapses (TD) |
| buyer contact | name only | name+email+phone | PII conservatism in a report view | merchant can't see contact here (TD, product decides) |

## Section 4: 🔬 Reviewer Notes — Priority spot-check order

1. **`getTicketSalesOrders`** — verify (a) `assertRaceForUser` first (IDOR), (b) SELECT list has NO `total_price`/`email`/`phone_number` (Attack #13 asserts SQL string), (c) `search` params bound via `?` LIKE (no interpolation), (d) LIMIT/OFFSET params bound, (e) buyerName fallback first+last→name.
2. **`getTicketSalesStacked`** — chain `oli→om→tt→rc` (NOT om.race_course_id), SUM(quantity) paid, courses[] sorted total DESC (stable), per-bucket counts map. `payment_on` range filter.
3. **`getTicketSalesTrend` + `bucketExpr`/`bucketKeyLabel`** — daily DATE_FORMAT string, weekly YEARWEEK int→mysqlYearweekToWeekKey, monthly YYYY-MM. Labels via bucket-helpers. COUNT(DISTINCT om.id) paid.
4. **SQL injection** — bucketExpr is a fixed internal string (no user input); raceId/period-from/to/status/search/page all bound via `?`. period/granularity validated by DTO `@IsIn`.
5. **`ticket-charts.dto.ts`** — query DTO validation (raceId @Min, period/granularity @IsIn, pageSize @Min/@Max 100, search @MaxLength). NO financial in row DTO.

### Security checklist self-applied
- [x] All 3 endpoints `LogtoMerchantGuard` + `assertRaceForUser` IDOR.
- [x] orders: NO total_price/email/phone selected (Attack #13).
- [x] SQL: bucketExpr internal-constant; all values `?`-bound.
- [x] Cache keys per-user+race+period+granularity (Attack #14).

### Edge cases tested vs deferred
- ✅ Tested: trend daily/weekly/monthly labels, stacked matrix+stable order+absent-course, orders pagination+name-fallback+search-SQL+no-leak, IDOR (all 3), empty.
- ⚠️ Deferred: order-table email/phone (PII product decision), multi-course order collapse, bucket TZ edge (M5), live p95.
