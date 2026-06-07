# FEATURE-069 M2b-3b — Implementation Notes (Reviewer's Guide)

**Milestone:** M2b-3b — Revenue by-category (BR-MP-12 Option A) + cross-tenant aggregate (BR-MP-21b)
**Date:** 2026-06-05

---

## Section 1: 🚧 Deviations from Spec (intentional)

- **[Deviation #1] aggregate loops `cfg.tenantIds`, NOT the tenant set derived from accessible races**
  - **Spec said:** BR-MP-21b "merchant_finance chọn Tất cả BTC trên agency account" → user's tenants.
  - **I did:** Loop `cfg.tenantIds`; filter each tenant's orders to the accessible race set.
  - **Why:** cfg.tenantIds IS the agency's BTC set (spec-aligned), and avoids an extra `SELECT DISTINCT tenant_id` query. Include-override races to tenants OUTSIDE the agency are individual grants, not "the agency's BTC" — excluded from the rollup (still visible in /races + single-race revenue).
  - **Reviewer should check:** TD-F069-M2b3b-INCLUDE-OUTSIDE-TENANT. If product wants include-overrides in the aggregate too, switch to deriving tenants from `SELECT DISTINCT tenant_id WHERE race_id IN (accessible)`.

- **[Deviation #2] by-category computes fee PER GROUP (2 FeeService calls/tenant), not just GMV split**
  - **Spec said:** BR-MP-12 = breakdown by category group.
  - **I did:** Each group (fee_percent/fee_fixed) gets its own FeeService run over its order partition → GMV + fee + net per group.
  - **Why:** The grouping IS by fee-type, so showing fee + net per group is the natural, high-value read ("% orders contributed X fee, manual contributed Y"). FeeService is cheap over a race's partition.
  - **Reviewer should check:** 2 FeeService calls per tenant per race acceptable (one race = one tenant → 2 calls total). Cost noted in Section 3.

## Section 2: ⚙️ Forced Changes (reality ≠ spec)

- **[Forced #1] `pullOrdersForFeeAggregate` takes single raceId/tenantId — no race-LIST filter**
  - **PRD assumed:** could scope the pull to a race subset.
  - **Reality:** helper signature is `{tenantId?, raceId?}` (single values).
  - **Workaround:** For cross-tenant aggregate, pull per-tenant (all that tenant's paid orders), then filter in-memory `accessible.has(o.raceId)`. Bounded by one tenant's order count.
  - **Manager/BA action:** None — acceptable. If a tenant has huge order volume across many races, a future race-list-scoped pull variant could optimize. Not needed at current scale.

## Section 3: ⚖️ Tradeoffs Considered

| Decision | Chosen | Alternative | Why | Cost paid |
|----------|--------|-------------|-----|-----------|
| aggregate tenant set | loop cfg.tenantIds | derive from accessible races | spec-aligned, no extra query | include-override-outside-tenant excluded (TD) |
| aggregate scope filter | in-memory `accessible.has` | SQL race-list IN | reuse proven helper, single-value sig | pulls full tenant set then drops non-accessible |
| by-category fee | per-group FeeService | GMV-only split | fee+net per fee-type = real merchant value | 2 FeeService calls/tenant (cheap) |
| empty group | always emit (0-fill) | omit | stable frontend (2 fixed cards) | tiny payload for 0 group |
| tenant name in aggregate | tenantId only | join Tenant repo | keep slice tight | frontend/M3 must enrich name (TD) |

## Section 4: 🔬 Reviewer Notes — Priority spot-check order

1. **`getRevenueAggregate`** — verify (a) guard order config→perm→resolve (no IDOR assert needed — aggregate spans all accessible), (b) **`accessible.has(o.raceId)` filter** applied per tenant (Attack #11 proves exclude-override race 502/888888 dropped), (c) per-tenant FeeService (each tenant own config), (d) skip-empty-tenant, (e) sort gmv DESC.
2. **`getRevenueByCategory`** — verify `categoryGroup` (MANUAL→fixed, else→percent incl null), partition→per-group FeeService, always-both-groups 0-fill, finance gate before SQL.
3. **`categoryGroup` helper** — null-safe (`cat === 'MANUAL'`), so a NEW future order_category auto-lands in fee_percent (no crash). Matches R3 line 285 Option A.
4. **Controller** — both routes method-level `@UseGuards(LogtoMerchantFinanceGuard)` (merchant_finance only) + service `assertRevenuePermission` (2-layer).
5. **`revenue-breakdown.dto.ts`** — BR-MP-09: only aggregate financials, no per-order PII, raw `groupKey` (Display Convention).

### Security checklist self-applied
- [x] Both endpoints: LogtoMerchantFinanceGuard + assertRevenuePermission (2-layer, viewer 403 before SQL — Attack #12).
- [x] aggregate: cross-tenant filter to accessible races (exclude-override respected — Attack #11).
- [x] SQL params: pullOrders parameterized (tenantId/raceId bound).
- [x] Cache keys per-user (+per-race for by-category).

### Edge cases tested vs deferred
- ✅ Tested: Option A grouping, always-both-groups, viewer-403 (both), cross-tenant filter+sort, skip-empty-tenant, exclude-override exclusion, null category.
- ⚠️ Deferred: tenant-name enrichment, revenue trend, Excel export (M2c), live p95 (M5).
