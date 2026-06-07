# FEATURE-069 M2b-2 — Implementation Notes (Reviewer's Guide)

**Milestone:** M2b-2 — Ticket Sales endpoints (summary KPI + course/type breakdown)
**Date:** 2026-06-05

---

## Section 1: 🚧 Deviations from Spec (intentional)

- **[Deviation #1] M2b-2 = 3 core read endpoints only; trend/stacked/order-table deferred to M2b-2b**
  - **Spec said:** PRD R2 Phase 2.2.3 lists 4 charts + KPI + order table + AnStacked endpoint.
  - **I did:** Shipped summary KPI + by-course + by-type (the 3 that are pure COUNT aggregates, no time-bucketing). Deferred trend AreaChart + AnStacked + order-detail-table.
  - **Why:** Trend/stacked need time-bucket logic (F-062 bucket-helpers + period-resolver) — a distinct concern that doubles surface area. Keeping M2b-2 a tight, reviewable slice (mirrors M2b-1 1.x discipline). The 3 shipped endpoints unblock the KPI row + 2 breakdown charts immediately.
  - **Reviewer should check:** M2b-2b ticket should cover trend/stacked/table. No data dependency missing — they reuse the same chain.

- **[Deviation #2] Summary is ALL-TIME per race (no period param / no delta %)**
  - **Spec said:** PRD R2 KPI cards show "delta %" (period comparison).
  - **I did:** All-time counts per race, no period/delta.
  - **Why:** Delta needs period-resolver + previous-period second query — adds the F-062 dependency this slice intentionally avoids. The raw counts are the primary value; delta is a presentation enhancement.
  - **Reviewer should check:** TD-F069-M2b2-NO-PERIOD-FILTER tracks the delta follow-up. Confirm M2b-2b adds `?period=` to summary.

- **[Deviation #3] Breakdowns paid-only; summary all-status**
  - **Spec said:** R3 line 159 flagged "Tổng vé đã bán = paid (revenue) HOẶC COMPLETE (all) — PAUSE-R3-01"; R3 line 242 FINAL "Card 1 Tổng vé = SUM(quantity) all".
  - **I did:** Summary `totalTickets` = ALL status (per R3 line 242 FINAL); summary byStatus splits paid/voided/pending; course/type breakdowns = paid-only (R3 chain template `financial_status='paid'`).
  - **Why:** "Tổng vé" (total) is genuinely all-status per the FINAL resolution; breakdown charts show distribution of *sold* (paid) tickets — voided/pending would distort the "what sold per course" picture.
  - **Reviewer should check:** Semantics consistent — if product wants breakdowns to include pending, flip the WHERE. Currently intentional paid-only.

## Section 2: ⚙️ Forced Changes (reality ≠ spec)

- **[Forced #1] PRD R2 course/type SQL was WRONG — `GROUP BY race_course_id` on order_metadata doesn't exist**
  - **PRD assumed:** R2 line 117/118 "COUNT(order_metadata) GROUP BY race_course_id / ticket_type_id".
  - **Reality:** `order_metadata` has NO `race_course_id` (R3 DISC-1, re-confirmed live `SHOW COLUMNS` 2026-06-05). Must chain `oli→om→tt→rc`.
  - **Workaround:** Used R3 canonical chain. R3 already documented this — followed R3 over R2 (as mandated).
  - **Manager/BA action:** R2 SQL already superseded by R3; no further action. Reinforces "always use R3 templates, never R1/R2 SQL".

- **[Forced #2] `ticket_type` has its own `deleted` bit column — chose NOT to filter it**
  - **PRD assumed:** No mention of ticket_type.deleted.
  - **Reality:** Live `SHOW COLUMNS` shows `ticket_type.deleted bit(1)`.
  - **Workaround:** Did NOT add `tt.deleted = 0` — a deleted ticket_type may still have historical paid line items, and the order/line-item is the source of truth for "what was sold" (R3 Source B reconciliation chain doesn't filter tt.deleted either).
  - **Manager/BA action:** Acceptable. If product wants to hide breakdowns for since-deleted ticket types, add the filter — but that would under-count real historical sales.

## Section 3: ⚖️ Tradeoffs Considered

| Decision | Chosen | Alternative | Why | Cost paid |
|----------|--------|-------------|-----|-----------|
| Summary date scope | All-time per race | Period-filtered + delta | Avoids F-062 period dep; raw counts are core value | No delta % (deferred TD) |
| Breakdown grouping key | `rc.id, rc.name` | `rc.name` only | Real data has dup names across distinct courses (540 & 515 = "2,9 km") | Slightly longer GROUP BY |
| Cache helper | shared `cachedTicketRead<T>` | inline try/catch per method | DRY + one place to honor Forced #1 try/catch rule | Generic adds tiny indirection |
| Order counting | `COUNT(DISTINCT om.id)` | `COUNT(*)` | LEFT/INNER JOIN multiplies rows by line items → COUNT(*) over-counts orders | DISTINCT slightly slower (negligible at race scale) |
| tt.deleted filter | omit | `tt.deleted=0` | Line item is source of truth for sold; deleted type still sold historically | Breakdown may list a since-deleted type name |

## Section 4: 🔬 Reviewer Notes — Priority spot-check order

1. **`merchant-portal.service.ts` `getTicketSalesSummary`** — verify (a) `assertRaceForUser` runs FIRST (IDOR), (b) byStatus ALWAYS emits paid/voided/pending in order with 0-fill, unknown appended, (c) `totalTickets` sums ALL status. `COUNT(DISTINCT om.id)` + `LEFT JOIN` + `om.deleted = 0` (no financial_status filter on summary — it groups by it).
2. **`getTicketSalesByCourse` / `getTicketSalesByType`** — verify chain `oli→om→tt→rc` (NOT `om.race_course_id`), `financial_status = 'paid'`, GROUP BY id (not name), `ORDER BY ticket_count DESC`. Adversarial test asserts SQL `.not.toMatch(/om\.race_course_id/)`.
3. **SQL injection** — every `db.query` uses `?` placeholder + `[raceId]` params array. ZERO `${}` interpolation of values (only the M2b-1 placeholder-string pattern, none in M2b-2 — single `raceId` bound). Adversarial Attack #6 asserts `501` NOT in SQL text.
4. **`cachedTicketRead`** — try/catch wraps ONLY redis get/set + JSON.parse (Forced #1 conventions compliance). Business compute runs outside on cache miss. Cache keys per-user + per-race (Attack #7).
5. **`ticket-sales.dto.ts`** — BR-MP-09 NO financial fields (no total_price/gmv/fee). Only counts. `financialStatus` raw enum (Display Convention — frontend maps).

### Security checklist self-applied
- [x] All 3 endpoints under class-level `LogtoMerchantGuard`; userId from `@CurrentUser` JWT.
- [x] IDOR: `assertRaceForUser` (resolveAccessibleRaces + assertRaceAccessible) before every aggregate.
- [x] SQL params: zero value interpolation — single `raceId` bound via `[raceId]`.
- [x] No financial field in any DTO (BR-MP-09 strict). No `_id`/`__v` leak (raw object literals).

### Edge cases tested vs deferred
- ✅ Tested: IDOR 403, missing-status normalize, dup course names, empty race, null name, corrupt cache, cache hit, SQLi param-bind.
- ⚠️ Deferred (acceptable): period filter + delta %, trend/stacked/order-table endpoints, live p95 (M5).
