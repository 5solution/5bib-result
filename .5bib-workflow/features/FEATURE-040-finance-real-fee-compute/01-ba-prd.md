# FEATURE-040: PRD — Finance Real Fee Compute (replace gross GMV)

**Status:** 🔵 READY
**Last updated:** 2026-05-17
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check (BA bắt buộc làm trước khi viết)

- [x] Đã đọc `00-manager-init.md` đầy đủ (187 dòng, 7 PAUSE conditions, Manager đề xuất sẵn cho mỗi PAUSE)
- [x] Đã trả lời tất cả PAUSE conditions trong file 00 — xem section "Answers to Manager's PAUSE conditions" cuối file
- [x] Đã đọc `memory/codebase-map.md` module finance + reconciliation + merchant
- [x] Đã đọc `memory/known-issues.md` vùng risk:
  - 🚨 **TD-F016-FINANCE-01** — 15 reconciliations cũ pre-2026-05-08 (F-016 v1.6.5) shipped với `fee_amount` SAI (drop 613 đơn 5BIB-eligible GROUP_BUY/GROUP_BUY_FIXED/CODE_TRANSFER). F-040 phải handle defensive: nếu `recon.created_at < 2026-05-08` → trust `recon.fee_amount` (BBNT đã ký với số sai cố hữu) HOẶC re-compute? BA chọn → trust BBNT signed values (immutable per business — admin đã ký với accounting, recompute = mở lại đối soát). Add flag `BR-40-12` xử lý case này.
  - 🟡 **TD-F003-02** reconciliation period overlap race condition (2 admin tạo cùng range trong 1s → 2 doc). F-040 query period overlap phải handle duplicate gracefully (SUM ALL match docs, không throw).

---

## 📝 Finance Real Fee Compute — Replace gross GMV với fee 5BIB thật

**Goal:** Field "Doanh thu" trong tất cả P&L surfaces (F-028 dashboard + F-038 contracts list + F-028 contract detail Lãi/Lỗ section) phải hiển thị **fee 5BIB thật** (số tiền 5BIB thu được), KHÔNG phải gross GMV (tổng tiền khách hàng pay merchant). Source priority: Reconciliation BBNT (signed) → fallback Self-compute từ MerchantConfig rate.

**Scope:**

- ✅ **In scope:**
  - Backend rewrite `fee.service.ts#getActualRevenueForRace()` + bulk variant: SQL refactor `SUM(total_price)` → `SUM(fee per category formula)`
  - NEW method `ReconciliationQueryService#getReconciledFeeForContract(mysqlRaceId, tenantId, periodFrom, periodTo)` — query MongoDB reconciliations collection by overlap
  - Update `pnl.service.ts#resolveRevenue + resolveRevenueSync` semantic: return `{ fee, source, grossGMV?, breakdown? }` thay vì `{ revenue, source }`
  - Extend `DashboardContractItemDto` DTO: thêm `feeSource: 'RECONCILIATION' | 'SELF_COMPUTE' | 'MIXED' | 'ESTIMATED'` + optional `grossGMV?: number` + optional `feeBreakdown?: FeeBreakdownDto`
  - NEW endpoint `GET /api/finance/contracts/:id/fee-breakdown` cho admin debug drill-down
  - Admin UI: tooltip + source badge cho mỗi row F-038 list + KPI F-028 dashboard. Contract detail Lãi/Lỗ section show full breakdown.
  - Cache strategy: TTL 60min + eager invalidation hooks 2 triggers (merchant config update, reconciliation status change)
  - Migration: eager flush `pnl:*` cache post-deploy
  - F-029 HIGH-PERF-01 bulk pattern preserve cho dashboard batch path

- ❌ **Out of scope:**
  - Schema migration MongoDB/MySQL — additive logic only
  - UI tách thành 2 columns (GMV + Phí) — defer Phase 2 nếu admin complain
  - Re-compute 15 reconciliations cũ TD-F016-FINANCE-01 — riêng feature recompute migration sau
  - Public API expose fee breakdown — admin-only (LogtoAdminGuard)
  - Change reconciliation domain logic — readonly query
  - VAT computation đổi semantic — fee = `fee_amount + manual_fee_amount` (KHÔNG cộng `fee_vat_amount`, VAT tracked riêng)

---

## 👤 User Stories & Business Rules

### User Stories

> Format strict: As a **[Persona]**, I want to **[Action]** so that **[Benefit]**.

- As a **Finance Admin (Hiền)**, I want to see real 5BIB fee revenue (not gross GMV) per TICKET_SALES contract so that I have an accurate financial picture for reporting to leadership.
- As a **5BIB Back-Office Admin**, I want to know which contracts have signed reconciliation (BBNT verified) vs self-computed estimates so that I can prioritize follow-up with merchants that lack reconciliation.
- As a **Sales Admin (Hằng)**, I want to drill-down into a contract and see fee breakdown (5BIB orders × rate% + MANUAL × VNĐ/vé + recon contribution) so that I can explain numbers to merchants.
- As a **CFO / Finance Director**, I want dashboard KPIs to reflect real revenue (5BIB fee, not GMV) so that I can compare period-over-period 5BIB profit without manual recomputation.

### Business Rules

> BR-40-01..18 — Coder + QC tham chiếu để encode + test.

#### Source priority chain & semantic
- **BR-40-01** (Revenue semantic shift): Field `revenue` trong response P&L = **fee 5BIB thật** (số 5BIB thu được), KHÔNG phải gross GMV. Display name UI = "Doanh thu" KHÔNG đổi (Option C per PAUSE-40-06).
- **BR-40-02** (Source priority cascade — 3 tiers + estimate):
  1. **`RECONCILIATION`** — Có ≥1 reconciliation doc cho `(mysql_race_id, tenant_id)` với `status IN ['signed', 'reviewed', 'completed']` AND overlap với contract period. Use `SUM(recon.fee_amount + recon.manual_fee_amount)` for overlap window.
  2. **`SELF_COMPUTE`** — Không có recon signed/reviewed/completed → self-compute từ MySQL platform orders × rate.
  3. **`MIXED`** — Recon cover MỘT PHẦN period (vd: 1 tháng/6 tháng contract). Use recon cho overlap month(s) + self-compute cho gap months. SUM total.
  4. **`ESTIMATED`** — Không link tenant/race HOẶC MerchantConfig completely missing → fallback `contract.totalAmount` (BTC nhập tay). Last resort.
- **BR-40-03** (Reconciliation status whitelist): Chỉ trust recon docs với `status IN ['signed', 'reviewed', 'completed']`. Status `draft`/`flagged`/`ready`/`approved` KHÔNG dùng (chưa BBNT ký). `status: 'sent'` = considered signed.
- **BR-40-04** (Period overlap algorithm): Một recon doc với `period_start, period_end` được consider "overlap" với contract period `[contractStart, contractEnd]` IF `recon.period_end >= contractStart AND recon.period_start <= contractEnd`. Use exact bytes per (mysql_race_id, tenant_id) — KHÔNG split partial-month vì recon docs là month-bound atomic.

#### Self-compute formula (BR-40-05..07)
- **BR-40-05** (5BIB-eligible categories — % fee):
  - Categories: `ORDINARY`, `PERSONAL_GROUP`, `GROUP_BUY`, `GROUP_BUY_FIXED`, `CHANGE_COURSE`, `CODE_TRANSFER` (per `fee.service.ts:41-48` `FIVE_BIB_CATEGORIES` const)
  - Formula: `fee_5bib = SUM(order.total_price) × tenant.service_fee_rate / 100`
  - Filter: `internal_status = 'COMPLETE' AND deleted = 0 AND mysql_race_id = X`
- **BR-40-06** (MANUAL category — VNĐ/vé):
  - Category: `MANUAL` ONLY
  - Formula: `fee_manual = SUM(order_line_item.quantity per order) × tenant.manual_fee_per_ticket`
  - Filter: same as above
  - 📌 **CRITICAL:** MANUAL fee formula uses **line_item.quantity** (per-ticket), NOT order.total_price. Memory CLAUDE.md business invariant. Coder phải JOIN `order_metadata × order_line_item` để get quantity.
- **BR-40-07** (Self-compute total): `fee_self_compute = fee_5bib + fee_manual` per contract.

#### MerchantConfig rate cascade fallback (BR-40-08, addresses PAUSE-40-04)
- **BR-40-08** (Rate resolve cascade — 3 tiers + warning):
  1. **Primary:** `merchant_configs.service_fee_rate` per tenantId (typed `number | null`).
  2. **Secondary:** Nếu primary null/undefined → `contract.revenueShare.feePercentage` (BTC nhập trong contract create wizard).
  3. **Tertiary:** Nếu cả 2 null → hardcoded default `5.5%` (mirror `reconciliation.service.ts:406` existing fallback). **MUST log WARN** với contract ID + tenant ID để admin truy.
  
  Manual fee fallback:
  1. **Primary:** `merchant_configs.manual_fee_per_ticket` (default schema `5000`)
  2. **Tertiary:** Hardcoded `5000` (matches schema default).

#### Source badge & UI display
- **BR-40-09** (Source badge enum + VN labels):
  | Source | Badge text VN | Color | Icon | Tooltip |
  |--------|---------------|-------|------|---------|
  | `RECONCILIATION` | "BBNT đã ký" | green | ✅ | "Doanh thu lấy từ biên bản nghiệm thu đã ký với merchant" |
  | `SELF_COMPUTE` | "Tự tính" | blue | 🧮 | "Tự tính từ tỉ lệ phí merchant — chưa có BBNT" |
  | `MIXED` | "Kết hợp" | amber | 🔀 | "Một phần lấy từ BBNT, phần còn lại tự tính" |
  | `ESTIMATED` | "Ước tính" | grey | 📊 | "Số ước tính theo contract.totalAmount BTC nhập — chưa link platform" |
- **BR-40-10** (Display semantic — Option C):
  - List page: column "Doanh thu" hiện `revenue` (fee thật) + badge subtle (12px font, rounded-full px-1.5).
  - Detail page (`/contracts/[id]`): section "Lãi/Lỗ" expand show full breakdown:
    - Phí 5BIB orders: `{count} đơn × {rate}% = {fee_5bib} VNĐ` (5BIB-eligible)
    - Phí MANUAL: `{count} đơn × {manual_fee_per_ticket} VNĐ/vé × {total_quantity} vé = {fee_manual} VNĐ`
    - Cộng đối soát: `{recon_count} BBNT × {fee_amount + manual_fee_amount} VNĐ` (nếu có)
    - Total fee 5BIB: `{revenue} VNĐ` (= sum above per BR-40-02)
    - GMV (tham khảo): `{grossGMV} VNĐ` (gross order.total_price — KHÔNG dùng cho lãi/lỗ)

#### Cache strategy (BR-40-11, addresses PAUSE-40-05)
- **BR-40-11** (Cache key pattern + TTL + invalidation):
  - Key: `pnl:ticket-sales-fee:<contractId>` (reuse existing) — value đổi semantic (fee thật thay revenue)
  - Companion key NEW: `pnl:fee-source:<contractId>` → cached source enum (`RECONCILIATION|SELF_COMPUTE|MIXED|ESTIMATED`)
  - Companion key NEW: `pnl:gross-gmv:<contractId>` → cached `grossGMV` for display
  - **TTL: 3600s (60 min)** per Manager đề xuất PAUSE-40-05
  - **Invalidation triggers (eager DEL):**
    | Trigger event | Source code | DEL pattern |
    |---------------|-------------|-------------|
    | MerchantConfig.service_fee_rate update | `MerchantService.updateFeeConfig` | `pnl:*:tenant=<tenantId>` + `pnl:ticket-sales-fee:*` matching contracts of tenant |
    | MerchantConfig.manual_fee_per_ticket update | Same | Same |
    | Reconciliation status: draft → signed/reviewed/completed | `ReconciliationService.signReport` / approve | `pnl:*` matching `(mysql_race_id, tenant_id)` |
    | Reconciliation delete | `ReconciliationService.delete` | Same |
    | Reconciliation update gross_revenue / fee_amount | `ReconciliationService.update` | Same |
  - **Lazy fallback:** sau 60 min cache TTL expire → next call recompute. Acceptable nếu invalidation hook miss edge case.

#### Defensive guards (BR-40-12..15)
- **BR-40-12** (Pre-F016 recon docs — TD-F016-FINANCE-01 defensive): Recon docs với `created_at < 2026-05-08` (pre F-016 v1.6.5 fix) có thể có `fee_amount` SAI do drop 613 đơn GROUP_BUY/GROUP_BUY_FIXED/CODE_TRANSFER. **Decision (BA):** **TRUST `recon.fee_amount` as immutable BBNT signed value** — KHÔNG re-compute. Lý do: recon đã ký với accounting team, recompute = mở lại đối soát = process political. Defensive: log INFO `[F-040] consuming legacy recon doc {id} pre-2026-05-08 — fee_amount may underestimate by GROUP_BUY*+CODE_TRANSFER drop, source = TD-F016-FINANCE-01`. Future feature recompute migration TBD.
- **BR-40-13** (Period overlap race condition — TD-F003-02 defensive): Nếu query return >1 recon doc cho cùng `(mysql_race_id, tenant_id, period overlap)` (race condition tạo dup), SUM ALL match docs. KHÔNG throw. Log WARN `[F-040] duplicate recon docs detected for (raceId={X}, tenantId={Y}): {count} docs summed`.
- **BR-40-14** (Cross-DB graceful degradation): MySQL platform DB down → return `{ fee: estimatedFee, source: 'ESTIMATED', warning: 'MySQL platform unreachable' }`. KHÔNG crash. Mirror F-028 BR-PNL-04 existing pattern.
- **BR-40-15** (Admin-only enforcement): All endpoints `LogtoAdminGuard` (mirror F-028/F-038). Frontend defense-in-depth: `useAuth()` check `isAdmin` BEFORE mount.

#### Status whitelist (inherit F-028)
- **BR-40-16** (Contract status whitelist): Chỉ compute fee cho contracts `status: { $in: ['ACTIVE', 'COMPLETED'] }` + `deletedAt: null` (inherit BR-PNL-08 F-028 + BR-38-01 F-038). DRAFT/CANCELLED/REJECTED: skip.

#### Backward compat (BR-40-17..18)
- **BR-40-17** (Non-TICKET_SALES contracts unchanged): Contracts type `TIMING`, `RACEKIT`, `OPERATIONS` revenue compute UNCHANGED — vẫn dùng `acceptanceReport.actualTotalWithVat` (FINALIZED) hoặc `contract.totalAmount` (estimated). F-040 chỉ touch TICKET_SALES branch.
- **BR-40-18** (API response shape backward compat): Field `revenue: number` trên `DashboardContractItemDto` KHÔNG breaking — value đổi semantic gross GMV → fee thật. Admin already migrated F-038 deployment, frontend rendering label "Doanh thu" giữ nguyên. Optional `feeSource`/`grossGMV`/`feeBreakdown` fields add (additive).

---

## 🖥️ UI/UX Flow — STEP-BY-STEP CHI TIẾT (Manager 2026-05-14 directive)

### Affected routes (3 pages)

| Route | Component | Change scope |
|-------|-----------|--------------|
| `/finance/contracts` (F-038 list) | `contracts-list-table.tsx` | Add source badge column, tooltip on Revenue cell |
| `/finance` (F-028 dashboard) | `dashboard-client.tsx` + `pnl-summary-card.tsx` | Add "Source mix" KPI strip (% by source), tooltip on Top profit / Loss-making tables |
| `/contracts/[id]` (Contract detail) | `app/(dashboard)/contracts/[id]/page.tsx` Lãi/Lỗ section | Expand show full fee breakdown |

### Screen 1: F-038 Contracts List — `/finance/contracts` (semantic update + badge)

**Layout (UNCHANGED from F-038):**
- Header: "💰 P&L theo Hợp đồng" + Period filter + Margin legend banner
- Filter row: Search + Page size selector
- Body: Table 9 cols — column "Doanh thu" semantic = fee thật post-F-040
- Footer: Summary "Tổng N HĐ — Doanh thu (fee 5BIB) X — Chi phí Y — Lãi/Lỗ Z"

**NEW visible elements:**

| Field UI label | Data source | Format hiển thị | Empty state |
|----------------|-------------|-----------------|-------------|
| Source badge (next to "Doanh thu" cell) | `item.feeSource` enum | Pill badge 12px font, rounded-full px-1.5 + color per BR-40-09 | Hide if `feeSource === 'ESTIMATED'` (default fallback, không cần badge nổi) |
| Tooltip "Doanh thu" cell hover | `item.feeSource` + tooltip dict | Floating tooltip 280px max-w with tooltip text per BR-40-09 + raw `grossGMV` shown small grey | "Source: chưa rõ" if feeSource missing |

### Screen 1 Journey: Finance Admin Hiền inspect contract source

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Navigate `/finance/contracts` | Page load skeleton 5 rows + header shimmer | TanStack Query `useGetContractsList(filter)` | Loading state |
| 2 | Data arrives 20 rows | Table render với column "Doanh thu" hiện fee thật, badge subtle next to value | Query resolved | Data state |
| 3 | Hover row "Doanh thu" cell HĐ với `feeSource: SELF_COMPUTE` | Tooltip popup "🧮 Tự tính từ tỉ lệ phí merchant — chưa có BBNT. GMV tham khảo: 18.284.000 ₫" | onMouseEnter 300ms debounce | Tooltip visible |
| 4 | Hover row "Doanh thu" cell HĐ với `feeSource: RECONCILIATION` | Tooltip popup "✅ Doanh thu lấy từ biên bản nghiệm thu đã ký với merchant. GMV: 18.284.000 ₫. Tổng BBNT: 2 doc đã ký." | onMouseEnter | Tooltip visible |
| 5 | Click row | Navigate `/contracts/{contractId}` detail | Next.js Link | Detail page F-040 enhanced |

### Screen 2: F-028 Dashboard — `/finance` (KPI label + source mix strip)

**Layout (mostly UNCHANGED, ADD source mix):**
- Title row + Period filter (UNCHANGED)
- 4 KPI cards (UNCHANGED): Doanh thu / Chi phí / Lãi/Lỗ / Margin avg
- **NEW** Source mix strip (subtle, below KPI cards):
  - "Nguồn doanh thu: 60% BBNT ký · 30% Tự tính · 10% Ước tính"
  - Stacked progress bar 4 segments (green/blue/amber/grey)
  - Tooltip hover each segment → drill-down count of contracts
- Trend chart + Top profit / Loss-making tables (UNCHANGED)
- Donut breakdown (UNCHANGED)

**NEW visible elements:**

| Field UI label | Data source | Format | Empty state |
|----------------|-------------|--------|-------------|
| Source mix percentage | computed `totals.sourceMix.{recon|self|mixed|estimated}` | "60% BBNT ký · 30% Tự tính · 10% Ước tính · 0% Mixed" | Hide strip if 0 contracts |
| KPI "Doanh thu" tooltip | Same as F-028, ADD line "Doanh thu = fee 5BIB thật (đã đổi từ FEATURE-040)" | Tooltip popup | — |

### Screen 2 Journey: Back-Office Admin scan dashboard source mix

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Navigate `/finance` | Dashboard skeleton | useGetDashboardData | Loading |
| 2 | Data arrives | KPI cards render + Source mix strip "60% BBNT ký · 30% Tự tính · 10% Ước tính" | Query resolved | Data state |
| 3 | Hover Source mix "30% Tự tính" segment | Tooltip "12 HĐ tính tự bằng MerchantConfig rate — bấm để xem list" | onMouseEnter | Tooltip visible |
| 4 | Click segment | Navigate `/finance/contracts?feeSource=SELF_COMPUTE` (filter pre-applied) | onClick Link | F-038 list filtered |
| 5 | F-038 list render với chỉ 12 HĐ self-compute | Footer summary count = 12 | URL param consumed | Filtered data state |

### Screen 3: Contract Detail Lãi/Lỗ Section — `/contracts/[id]` (full breakdown)

**Layout — Lãi/Lỗ section trong contract detail page:**

```
┌─────────────────────────────────────────────────────────────────┐
│ 💰 Lãi / Lỗ Deal                          [Xuất Excel]          │
├─────────────────────────────────────────────────────────────────┤
│ Doanh thu (Phí 5BIB):              ✅ BBNT ký  1.279.880 ₫       │
│  ↳ chi tiết breakdown ▾                                          │
│                                                                   │
│ Chi phí:                                              500.000 ₫  │
│  ↳ Line items (chi phí ước tính)  300.000 ₫                      │
│  ↳ Cost items (chi phí thực)      200.000 ₫                      │
│                                                                   │
│ ──────────────────────────────────────────────────────────────  │
│ Lãi/Lỗ:                                  +779.880 ₫ (61% margin) │
│ Margin tier: 🟢 Healthy >10%                                    │
└─────────────────────────────────────────────────────────────────┘
```

**Expanded fee breakdown panel (collapse default, click ▾ to expand):**

```
┌─ FEE BREAKDOWN ──────────────────────────────────────────────┐
│ Source: ✅ BBNT đã ký                                          │
│                                                                │
│ Recon docs đã ký áp dụng (2):                                  │
│   • 2026-05: Phí 5BIB orders 1.063.880 ₫ + MANUAL 216.000 ₫   │
│   • 2026-06: (chưa ký, sẽ self-compute)                       │
│                                                                │
│ Self-compute cho period gap:                                   │
│   • 5BIB-eligible orders: 25 đơn × 7.0% = 0 ₫ (chưa có)        │
│   • MANUAL orders: 0 đơn                                       │
│                                                                │
│ Total Doanh thu (fee 5BIB): 1.279.880 ₫                       │
│ ─────────────────────────────                                  │
│ GMV (tham khảo, KHÔNG dùng cho P&L): 18.284.000 ₫             │
└────────────────────────────────────────────────────────────────┘
```

### Screen 3 Journey: Sales Admin Hằng drill-down breakdown

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Navigate `/contracts/6a095d81...` | Contract detail render với Lãi/Lỗ section showing summary | Initial fetch | Data state |
| 2 | Click "▾ chi tiết breakdown" trong Doanh thu line | Expand panel slide-down 200ms ease-out | onClick state toggle | Panel expanded |
| 3 | Panel render fee breakdown sections | Show recon contributions + self-compute parts + GMV reference | Fetch `GET /api/finance/contracts/:id/fee-breakdown` | Breakdown loaded |
| 4 | Click "▾" again | Panel collapse | onClick toggle | Panel collapsed |

### UI States (must cover all)

| State | Where applicable | UI |
|-------|-----------------|-----|
| **Loading** | F-038 list, F-028 dashboard, breakdown panel | Skeleton rows / KPI shimmer |
| **Empty** | F-028 dashboard if 0 contracts | "Chưa có HĐ ACTIVE/COMPLETED" |
| **Data ready** | All screens | Render values + badges |
| **Filtered empty** | F-038 list `?feeSource=X` filter no match | "Không có HĐ với source này" + CTA "Xoá filter" |
| **Error fetch** | All | Toast sonner đỏ "Lỗi tải fee breakdown. Thử lại?" + retry button |
| **Tooltip loading** | Hover source badge | Spinner inside tooltip 200ms |
| **Source `ESTIMATED` (default fallback)** | F-038 list row | Hide badge (no visual noise, default state) |
| **Admin-only restriction** | All `/finance/*` pages | `<RestrictedAccess />` for non-admin (defense-in-depth) |
| **Cross-DB degraded** | F-028 dashboard / F-038 list | Banner sub-header "⚠️ Một số số liệu là ước tính (Platform DB lỗi)" if any contract has `warning` set |
| **Recon with TD-F016 legacy warning** | Contract detail breakdown panel | Info banner subtle "ℹ️ BBNT này từ trước 08/05/2026 — có thể thiếu GROUP_BUY/CODE_TRANSFER orders (xem TD-F016)" only if `recon.created_at < '2026-05-08'` |

### Buttons Specification Table

| Button label | Position | Default state | Disabled state | Loading state | Action | Confirm dialog? |
|--------------|----------|---------------|----------------|---------------|--------|-----------------|
| Source badge (clickable on F-028 dashboard source mix strip) | Below KPI cards | Pill badge per source color | KHÔNG | N/A | Navigate `/finance/contracts?feeSource=<X>` (filter prefilled) | NO |
| "▾ chi tiết breakdown" (expand) | Contract detail Lãi/Lỗ section, next to Doanh thu line | Outline ghost icon | KHÔNG | Spinner trong panel | onClick toggle state + fetch breakdown if not loaded | NO |
| "▾ chi tiết breakdown" (collapse) | Same | Filled chevron rotated 180° | KHÔNG | N/A | onClick toggle | NO |
| Tooltip "Doanh thu" cell hover | F-038 list row | Hidden | N/A | N/A | onMouseEnter show tooltip after 300ms | NO |
| "Xoá filter" (Empty state CTA filteredbyFeeSource) | F-038 list empty state | Outline | KHÔNG | N/A | router.replace `/finance/contracts` | NO |
| (Existing F-038/F-028 buttons unchanged) | Various | — | — | — | — | — |

### Form Fields Specification (filter additions only)

> F-038 list filter extends with NEW `feeSource` enum filter param.

| Field name | UI label | Type | Required | Validation | Error message | Default |
|------------|----------|------|----------|------------|---------------|---------|
| `feeSource` (URL query param) | Source filter | enum select | ⚪ | one of: `RECONCILIATION` / `SELF_COMPUTE` / `MIXED` / `ESTIMATED` / undefined (all) | "Source không hợp lệ" (backend 400) | undefined (all) |

(Other fields q/period/dateFrom/dateTo/page/limit/sortBy/sortDir unchanged from F-038.)

---

## 🛠️ Technical Mandates (For Coder Agent)

### DB / Cache changes

- **MongoDB:** KHÔNG đổi schema. Read additionally `merchant_configs` (existing) + `reconciliations` (existing). Indexes already in place:
  - `merchant_configs.tenantId` (unique:true, index)
  - `reconciliations.tenant_id` (index) + `reconciliations.mysql_race_id` (index)
- **MySQL platform:** KHÔNG đổi schema. SQL query refactor — see Service Implementation Guidance section.
- **S3:** KHÔNG đụng.
- **Redis:**
  - **REUSE** key `pnl:ticket-sales-fee:<contractId>` — value semantic đổi from gross revenue → fee 5BIB thật. TTL **3600s** (60 min, was 5min per BR-40-11).
  - **NEW** companion key `pnl:fee-source:<contractId>` (TTL 3600s) → cached `feeSource` enum.
  - **NEW** companion key `pnl:gross-gmv:<contractId>` (TTL 3600s) → cached `grossGMV` for display.
  - **NEW** invalidation hooks per BR-40-11.
- **Migration:** Post-deploy script flush `pnl:*` keys (eager) per BR-40-11 + PAUSE-40-07.

### Backend Endpoint Specification

**Existing endpoint 1: `GET /api/finance/dashboard`** (F-028) — semantic update only

| Element | Spec |
|---------|------|
| Method | GET |
| Path | `/api/finance/dashboard` |
| Auth | `@UseGuards(LogtoAdminGuard)` class-level |
| Guard role | admin |
| Query DTO | `PnLDashboardFilterDto` (unchanged) |
| Response DTO | `PnLDashboardResponseDto` (extended — see DTO spec) |
| Status codes | 200 success / 401 / 403 / 500 server |
| Side effects | Redis SET cache; no DB write |
| Semantic change | `revenue` field per contract item = fee 5BIB thật (was gross GMV); new fields `feeSource`, `grossGMV` additive |

**Existing endpoint 2: `GET /api/finance/pnl/contracts`** (F-038) — semantic update only

| Element | Spec |
|---------|------|
| Method | GET |
| Path | `/api/finance/pnl/contracts` |
| Auth | `LogtoAdminGuard` |
| Query DTO | `PnLContractsListFilterDto` (extended with `feeSource?` filter — see Form Fields) |
| Response DTO | `PnLContractsListResponseDto` (extended) |
| Status codes | 200/400/401/403/500 |
| Side effects | Redis SET cache; no DB write |
| Semantic change | Same as endpoint 1 |

**Existing endpoint 3: `GET /api/finance/contracts/:id/pnl`** (F-028 detail) — semantic update + new `feeBreakdown` field

| Element | Spec |
|---------|------|
| Method | GET |
| Path | `/api/finance/contracts/:id/pnl` |
| Auth | `LogtoAdminGuard` |
| Path param | `id` ObjectId |
| Response DTO | `PnLSummaryDto` (extended with `feeBreakdown: FeeBreakdownDto`) |
| Status codes | 200/401/403/404 contract not found / 500 |
| Side effects | Redis SET cache `pnl:contract:<id>` + companion keys |
| Semantic change | `revenue` = fee 5BIB; new `feeBreakdown` field with full breakdown |

**NEW endpoint 4: `GET /api/finance/contracts/:id/fee-breakdown`** (admin debug drill-down)

| Element | Spec |
|---------|------|
| Method | GET |
| Path | `/api/finance/contracts/:id/fee-breakdown` |
| Auth | `LogtoAdminGuard` |
| Path param | `id` ObjectId (contract `_id`) |
| Response DTO | `FeeBreakdownDto` |
| Status codes | 200/401/403/404 / 500 |
| Side effects | Redis SET cache `pnl:fee-breakdown:<contractId>` TTL 3600s; no DB write |
| Purpose | Drill-down expand panel in `/contracts/[id]` detail Lãi/Lỗ section |

### DTO Field-Level Spec

```typescript
// backend/src/modules/finance/dto/pnl-response.dto.ts (EXTEND DashboardContractItemDto)

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type FeeSource = 'RECONCILIATION' | 'SELF_COMPUTE' | 'MIXED' | 'ESTIMATED';

export class DashboardContractItemDto {
  // ... existing fields ...
  
  @ApiProperty({ description: 'Doanh thu = fee 5BIB thật (KHÔNG phải GMV) - VND' })
  revenue!: number;
  
  // NEW F-040 fields
  @ApiProperty({
    enum: ['RECONCILIATION', 'SELF_COMPUTE', 'MIXED', 'ESTIMATED'],
    description: 'Nguồn của revenue (fee 5BIB)',
  })
  feeSource!: FeeSource;
  
  @ApiPropertyOptional({
    description: 'Gross GMV tổng tiền khách hàng pay (chỉ tham khảo, KHÔNG dùng cho P&L)',
  })
  grossGMV?: number;
  
  @ApiPropertyOptional({
    description: 'Warning nếu có TD legacy hoặc data degraded',
    example: 'BBNT pre-F016 — fee_amount may underestimate by GROUP_BUY drop',
  })
  feeWarning?: string;
}

// NEW DTO — FeeBreakdownDto (cho fee-breakdown endpoint + contract detail expand panel)

export class ReconciledFeeSliceDto {
  @ApiProperty({ description: 'Recon doc _id' })
  reconciliationId!: string;
  
  @ApiProperty({ description: 'Period start ISO YYYY-MM-DD' })
  periodStart!: string;
  
  @ApiProperty({ description: 'Period end ISO YYYY-MM-DD' })
  periodEnd!: string;
  
  @ApiProperty({ description: 'Recon status (signed/reviewed/completed/sent)' })
  status!: string;
  
  @ApiProperty({ description: 'Phí 5BIB orders từ recon (VND)' })
  feeAmount!: number;
  
  @ApiProperty({ description: 'Phí MANUAL orders từ recon (VND)' })
  manualFeeAmount!: number;
  
  @ApiPropertyOptional({ description: 'TD-F016 legacy warning nếu created_at < 2026-05-08' })
  legacyWarning?: string;
  
  @ApiProperty({ description: 'Signed/reviewed/completed timestamp ISO' })
  finalizedAt!: string | null;
}

export class SelfComputeSliceDto {
  @ApiProperty({ description: 'Số đơn 5BIB-eligible (ORDINARY/GROUP_BUY/etc.)' })
  count5BIB!: number;
  
  @ApiProperty({ description: 'SUM(total_price) của 5BIB orders (VND)' })
  gross5BIB!: number;
  
  @ApiProperty({ description: 'Tỉ lệ phí % áp dụng' })
  feeRatePercent!: number;
  
  @ApiProperty({ description: 'Phí 5BIB = gross5BIB × feeRatePercent / 100 (VND)' })
  fee5BIB!: number;
  
  @ApiProperty({ description: 'Số đơn MANUAL' })
  countManual!: number;
  
  @ApiProperty({ description: 'Tổng số vé MANUAL (SUM line_item.quantity)' })
  manualTicketCount!: number;
  
  @ApiProperty({ description: 'VNĐ/vé MANUAL áp dụng' })
  manualFeePerTicket!: number;
  
  @ApiProperty({ description: 'Phí MANUAL = manualTicketCount × manualFeePerTicket' })
  feeManual!: number;
  
  @ApiPropertyOptional({ description: 'Period gap that self-compute covers (when MIXED source)' })
  periodGapStart?: string;
  
  @ApiPropertyOptional()
  periodGapEnd?: string;
  
  @ApiPropertyOptional({
    description: 'Warning nếu fallback cascade tier 3 default 5.5% kích hoạt',
    example: 'MerchantConfig + contract.feePercentage cả 2 null - dùng default 5.5%',
  })
  rateFallbackWarning?: string;
}

export class FeeBreakdownDto {
  @ApiProperty({ description: 'Contract ObjectId' })
  contractId!: string;
  
  @ApiProperty({ enum: ['RECONCILIATION', 'SELF_COMPUTE', 'MIXED', 'ESTIMATED'] })
  feeSource!: FeeSource;
  
  @ApiProperty({ description: 'Total fee 5BIB (= sum reconciliations + selfCompute)' })
  totalFee!: number;
  
  @ApiPropertyOptional({ description: 'Gross GMV reference (KHÔNG dùng cho P&L)' })
  grossGMV?: number;
  
  @ApiProperty({
    type: [ReconciledFeeSliceDto],
    description: 'Reconciliation slices contributing to total (empty if SELF_COMPUTE only)',
  })
  reconciliations!: ReconciledFeeSliceDto[];
  
  @ApiPropertyOptional({
    type: SelfComputeSliceDto,
    description: 'Self-compute slice for period gap (null if pure RECONCILIATION cover)',
  })
  selfCompute?: SelfComputeSliceDto;
  
  @ApiProperty({ description: 'Computed at ISO timestamp' })
  computedAt!: string;
  
  @ApiPropertyOptional({ description: 'Generic warnings if any' })
  warnings?: string[];
}

// EXTEND PnLDashboardResponseDto with sourceMix

export class FeeSourceMixDto {
  @ApiProperty({ description: 'Count of contracts with RECONCILIATION source' })
  reconciliation!: number;
  
  @ApiProperty()
  selfCompute!: number;
  
  @ApiProperty()
  mixed!: number;
  
  @ApiProperty()
  estimated!: number;
}

export class PnLDashboardTotalsDto {
  // ... existing fields ...
  
  // NEW F-040
  @ApiProperty({ type: FeeSourceMixDto, description: 'Distribution of contracts by feeSource' })
  feeSourceMix!: FeeSourceMixDto;
}

// EXTEND PnLContractsListFilterDto (F-038) with feeSource filter

export class PnLContractsListFilterDto extends PnLDashboardFilterDto {
  // ... existing fields (page/limit/sortBy/sortDir/q) ...
  
  // NEW F-040
  @ApiPropertyOptional({
    enum: ['RECONCILIATION', 'SELF_COMPUTE', 'MIXED', 'ESTIMATED'],
    description: 'Filter contracts theo fee source',
  })
  @IsOptional()
  @IsEnum(['RECONCILIATION', 'SELF_COMPUTE', 'MIXED', 'ESTIMATED'])
  feeSource?: FeeSource;
}
```

### Service Implementation Guidance (pseudocode, Coder tinh chỉnh)

```typescript
// backend/src/modules/reconciliation/services/reconciliation-query.service.ts (NEW METHOD)

async getReconciledFeeForContract(
  mysqlRaceId: number,
  tenantId: number,
  periodFrom: Date,
  periodTo: Date,
): Promise<ReconciledFeeSliceDto[]> {
  // BR-40-03 + BR-40-04 — query recon docs by overlap with whitelist status
  const APPROVED_STATUSES = ['signed', 'reviewed', 'completed', 'sent']; // BR-40-03
  
  const docs = await this.reconciliationModel.find({
    mysql_race_id: mysqlRaceId,
    tenant_id: tenantId,
    status: { $in: APPROVED_STATUSES },
    // BR-40-04 overlap: period_end >= periodFrom AND period_start <= periodTo
    period_end: { $gte: this.toIsoString(periodFrom) },
    period_start: { $lte: this.toIsoString(periodTo) },
  }).lean().exec();
  
  // BR-40-13 — log WARN if dup
  if (docs.length > 1) {
    this.logger.warn(`[F-040] duplicate recon docs (raceId=${mysqlRaceId}, tenantId=${tenantId}): ${docs.length} docs summed`);
  }
  
  return docs.map((d) => ({
    reconciliationId: d._id.toString(),
    periodStart: d.period_start,
    periodEnd: d.period_end,
    status: d.status,
    feeAmount: d.fee_amount,
    manualFeeAmount: d.manual_fee_amount,
    finalizedAt: d.signed_at ?? d.approved_at ?? d.reviewed_at ?? null,
    // BR-40-12 — TD-F016 legacy warning
    legacyWarning: d.createdAt < new Date('2026-05-08')
      ? 'BBNT pre-F016 — fee_amount có thể underestimate GROUP_BUY/CODE_TRANSFER orders (xem TD-F016-FINANCE-01)'
      : undefined,
  }));
}

// backend/src/modules/finance/services/fee.service.ts (REWRITE getActualRevenueForRace)

async getFeeForContract(
  contract: ContractDocument,
): Promise<{
  fee: number;
  source: FeeSource;
  grossGMV: number;
  breakdown: FeeBreakdownDto;
  warnings: string[];
}> {
  const tenantId = contract.linkedTenantId;
  const mysqlRaceId = contract.linkedMysqlRaceId;
  const contractStart = contract.effectiveDate ?? contract.signDate;
  const contractEnd = contract.endDate ?? new Date('2099-12-31');
  const warnings: string[] = [];
  
  // BR-40-02 tier 4 fallback — ESTIMATED
  if (!tenantId || !mysqlRaceId) {
    return {
      fee: contract.totalAmount ?? 0,
      source: 'ESTIMATED',
      grossGMV: 0,
      breakdown: { /* ... */ source: 'ESTIMATED', totalFee: contract.totalAmount, /* ... */ },
      warnings: ['Contract chưa link tenantId/mysqlRaceId — dùng totalAmount ước tính'],
    };
  }
  
  // 1. Query reconciliations cho period overlap (BR-40-02 tier 1)
  const reconciliations = await this.reconciliationQueryService.getReconciledFeeForContract(
    mysqlRaceId, tenantId, contractStart, contractEnd,
  );
  
  // 2. Self-compute (always run for grossGMV + potential gap fill)
  const selfCompute = await this.computeSelfFee(mysqlRaceId, tenantId, contract);
  // selfCompute returns: { count5BIB, gross5BIB, feeRatePercent, fee5BIB, countManual, manualTicketCount, manualFeePerTicket, feeManual, gross GMV total }
  
  // 3. BR-40-02 source decision logic
  let source: FeeSource;
  let totalFee: number;
  
  if (reconciliations.length === 0) {
    source = 'SELF_COMPUTE';
    totalFee = selfCompute.fee5BIB + selfCompute.feeManual;
  } else {
    // Compute period coverage of recons
    const reconCoverage = this.computePeriodCoverage(reconciliations, contractStart, contractEnd);
    
    if (reconCoverage.gapMonths.length === 0) {
      // Recon covers full period
      source = 'RECONCILIATION';
      totalFee = reconciliations.reduce((s, r) => s + r.feeAmount + r.manualFeeAmount, 0);
    } else {
      // Partial coverage — MIXED
      source = 'MIXED';
      const reconFee = reconciliations.reduce((s, r) => s + r.feeAmount + r.manualFeeAmount, 0);
      // Self-compute only for gap months
      const gapSelfCompute = await this.computeSelfFee(
        mysqlRaceId, tenantId, contract,
        { periodFrom: reconCoverage.gapStart, periodTo: reconCoverage.gapEnd },
      );
      totalFee = reconFee + gapSelfCompute.fee5BIB + gapSelfCompute.feeManual;
    }
  }
  
  return {
    fee: totalFee,
    source,
    grossGMV: selfCompute.grossGMV, // Always compute for transparency
    breakdown: { /* assemble from above */ },
    warnings,
  };
}

private async computeSelfFee(
  mysqlRaceId: number,
  tenantId: number,
  contract: ContractDocument,
  periodFilter?: { periodFrom: Date; periodTo: Date },
): Promise<SelfComputeSliceDto & { grossGMV: number }> {
  // BR-40-08 rate cascade
  const config = await this.merchantConfigModel.findOne({ tenantId }).lean();
  let serviceFeeRate: number;
  let rateFallbackWarning: string | undefined;
  
  if (config?.service_fee_rate != null) {
    serviceFeeRate = config.service_fee_rate;
  } else if (contract.revenueShare?.feePercentage != null) {
    serviceFeeRate = contract.revenueShare.feePercentage;
    rateFallbackWarning = 'MerchantConfig.service_fee_rate null — dùng contract.revenueShare.feePercentage';
  } else {
    serviceFeeRate = 5.5;
    rateFallbackWarning = 'MerchantConfig + contract feePercentage cả 2 null - dùng default 5.5%';
    this.logger.warn(`[F-040] rate fallback default 5.5% triggered for contract=${contract._id} tenantId=${tenantId}`);
  }
  
  const manualFeePerTicket = config?.manual_fee_per_ticket ?? 5000;
  
  // BR-40-05 + 06 — SQL query 5BIB-eligible + MANUAL
  // (Coder choice: 1 query with CASE OR 2 query separate — benchmark)
  // ...
  // Return SelfComputeSliceDto
}
```

### Frontend / Admin (Next.js)

- `/finance/contracts` (F-038) — Client Component (`'use client'`) — add tooltip + source badge rendering. URL filter `feeSource` deep-link sync.
- `/finance` (F-028 dashboard) — Add source mix strip component below KPI cards. Click segment navigates to F-038 with filter applied.
- `/contracts/[id]` (Detail Lãi/Lỗ section) — Add expand panel with TanStack Query fetch on first expand: `useGetFeeBreakdown(contractId)`. Cache stale 60s.
- TanStack Query key extension: `['finance', 'fee-breakdown', contractId]`
- Reuse: `MarginTier` helper, `formatVnd`, `formatPercent` from F-028.
- New components:
  - `FeeSourceBadge.tsx` — pill badge với enum → label/color/icon
  - `FeeBreakdownPanel.tsx` — expand/collapse with breakdown sections
  - `SourceMixStrip.tsx` — stacked bar % visualization on dashboard
- Tooltip: shadcn `<Tooltip>` (existing) — render text per BR-40-09
- KHÔNG cần SDK regen (admin pattern hand-typed wrapper `finance-api.ts` consistent F-028/F-031/F-032/F-038 — defer TD same as TD-F038-SDK-REGEN)

### PAUSE flags (Coder dừng lại confirm)

- ❌ KHÔNG cần migration MongoDB/MySQL — additive read
- ❌ KHÔNG cần `pnpm install` dep mới
- 🟡 **Cache key namespace change** — REUSE `pnl:ticket-sales-fee:` semantic shift gross→fee. Companion keys NEW `pnl:fee-source:` + `pnl:gross-gmv:` + `pnl:fee-breakdown:`. Manager đã approve approach.
- 🟡 **Cross-module model injection** — FinanceModule cần inject `ReconciliationModel` + `MerchantConfigModel`. Manager đề xuất import models trực tiếp, KHÔNG import ReconciliationService (avoid circular). Coder confirm trước khi code.
- 🟡 **TD-F016-FINANCE-01 BR-40-12 trust legacy** — BA chốt trust signed BBNT immutable. Coder PHẢI log INFO khi consume pre-F016 doc (audit trail).

---

## 🛡️ Testing Mandates (For QC Agent) — TC-FE-XX Format

### Backend Test Cases TC-FE-XX

#### TC-FE-01 Self-compute happy path — % fee 5BIB-eligible only

| Element | Value |
|---------|-------|
| Method | (Service test) `pnl.service.getSummary(contractId)` |
| Setup | Contract TICKET_SALES tenantId=20, mysqlRaceId=194. MerchantConfig service_fee_rate=7. NO reconciliation. 34 ORDINARY orders × 18,284,000 GMV total. |
| Expected | `{ revenue: 1,279,880, feeSource: 'SELF_COMPUTE', grossGMV: 18,284,000 }` |
| Expected body shape | Top-level `revenue` numeric VND. `feeSource` enum string. `grossGMV` numeric. Optional `feeBreakdown` populated nếu detail endpoint. |
| MUST NOT leak | Raw merchant `_id`, `__v`, internal `apiToken`, raw recon doc IDs ngoài array of slices |
| Side effect verify | Redis SET `pnl:ticket-sales-fee:<contractId>` value=1279880 TTL ≈ 3600s; Redis SET `pnl:fee-source:<contractId>` value='SELF_COMPUTE'; Redis SET `pnl:gross-gmv:<contractId>` value=18284000 |

#### TC-FE-02 MANUAL fee VNĐ/vé only

| Element | Value |
|---------|-------|
| Setup | Contract TICKET_SALES. NO 5BIB orders. 10 MANUAL orders, each with line_items quantity total = 50 tickets. MerchantConfig manual_fee_per_ticket=5000. NO recon. |
| Expected | `{ revenue: 250,000 (= 50 × 5000), feeSource: 'SELF_COMPUTE' }` |
| Expected body shape | revenue=250000 |
| MUST NOT leak | — |
| Side effect verify | — |

#### TC-FE-03 Mixed category — 5BIB + MANUAL sum

| Element | Value |
|---------|-------|
| Setup | Contract. 20 ORDINARY (gross 10,000,000) + 5 MANUAL (15 tickets total). config rate=10%, manual=5000. NO recon. |
| Expected | `{ revenue: 1,000,000 + 75,000 = 1,075,000, feeSource: 'SELF_COMPUTE' }` |
| Side effect verify | breakdown.selfCompute.fee5BIB=1000000 + feeManual=75000 |

#### TC-FE-04 Reconciliation full-period override

| Element | Value |
|---------|-------|
| Setup | Contract period 2026-05-01 to 2026-05-31. 1 recon doc status=signed period 2026-05-01..2026-05-31 fee_amount=500,000 manual_fee_amount=200,000. Self-compute would return 700,001 (verify priority). |
| Expected | `{ revenue: 700,000 (= recon SUM, NOT self-compute), feeSource: 'RECONCILIATION' }` |
| Side effect verify | breakdown.reconciliations[0] populated, breakdown.selfCompute = null/undefined |

#### TC-FE-05 Reconciliation partial period — MIXED source

| Element | Value |
|---------|-------|
| Setup | Contract period 2026-01-01 to 2026-06-30. 1 recon signed cho 2026-05-01..05-31 fee=500K + manual=100K. Self-compute remaining gaps Jan-Apr + Jun returns gap fee=200K. |
| Expected | `{ revenue: 600K + 200K = 800K, feeSource: 'MIXED' }` |
| Side effect verify | breakdown.reconciliations length=1, breakdown.selfCompute.periodGapStart/End present |

#### TC-FE-06 Pre-F016 recon legacy warning (BR-40-12)

| Element | Value |
|---------|-------|
| Setup | 1 recon doc created_at=2026-04-15 (pre-F016 fix 2026-05-08) status=signed. |
| Expected | `feeSource: 'RECONCILIATION'`, breakdown.reconciliations[0].legacyWarning="BBNT pre-F016..." |
| Side effect verify | Backend log INFO `[F-040] consuming legacy recon doc...` emitted |

#### TC-FE-07 Rate cascade fallback tier 2 — contract.feePercentage

| Element | Value |
|---------|-------|
| Setup | MerchantConfig exists but service_fee_rate=null. Contract revenueShare.feePercentage=8. |
| Expected | Use 8%, breakdown.selfCompute.feeRatePercent=8, breakdown.selfCompute.rateFallbackWarning="MerchantConfig.service_fee_rate null — dùng contract..." |
| Side effect verify | Self-compute formula uses 8% |

#### TC-FE-08 Rate cascade fallback tier 3 — hardcoded default 5.5% + log WARN

| Element | Value |
|---------|-------|
| Setup | NO MerchantConfig + contract.revenueShare.feePercentage=null. |
| Expected | Use 5.5%, breakdown.selfCompute.rateFallbackWarning="...default 5.5%" |
| Side effect verify | Backend Logger.warn `[F-040] rate fallback default 5.5% triggered` |

#### TC-FE-09 Reconciliation status whitelist — DRAFT recon excluded

| Element | Value |
|---------|-------|
| Setup | 1 recon status='draft' overlap period (NOT in whitelist BR-40-03). |
| Expected | `feeSource: 'SELF_COMPUTE'` (recon ignored despite overlap), reconciliations=[] |
| Side effect verify | — |

#### TC-FE-10 Cache hit — 2 consecutive calls

| Element | Value |
|---------|-------|
| Method | GET `/api/finance/contracts/:id/pnl` × 2 |
| Setup | Contract with self-compute. First call cold ~200ms, second within 60min should be Redis hit. |
| Expected | 1st: HTTP 200 ~200ms (compute + SET); 2nd: HTTP 200 < 50ms (Redis HIT) |
| Side effect verify | Mongo query count == 1 (mock assert); Redis GET called twice; SET called once |

#### TC-FE-11 Cache invalidation — Merchant config update

| Element | Value |
|---------|-------|
| Setup | Cache populated `pnl:ticket-sales-fee:<contractId>` value=1279880 |
| Action | `PATCH /api/admin/merchants/:tenantId/fee-config` update service_fee_rate from 7 → 8 |
| Expected | All `pnl:ticket-sales-fee:*` matching contracts of tenantId=X DEL'd |
| Side effect verify | Next GET pnl recompute (mock assert Mongo query called) |

#### TC-FE-12 Cache invalidation — Reconciliation sign

| Element | Value |
|---------|-------|
| Setup | Cache populated. |
| Action | `POST /api/reconciliations/:reconId/sign` |
| Expected | `pnl:*` keys matching (mysql_race_id, tenant_id) of recon DEL'd |

#### TC-FE-13 Cross-DB graceful — MySQL platform down

| Element | Value |
|---------|-------|
| Setup | Mock orderRepo throw connection error. |
| Expected | HTTP 200 (not 500) with `feeSource: 'ESTIMATED'`, fee=contract.totalAmount, warnings includes "MySQL platform unreachable" |
| Side effect verify | Logger.warn cross-DB fail logged; cache NOT set (fail-open) |

#### TC-FE-14 IDOR — non-admin → 403

| Element | Value |
|---------|-------|
| Method | GET `/api/finance/contracts/:id/fee-breakdown` |
| Headers | `Authorization: Bearer <staff_token>` (not admin) |
| Expected | 403 Forbidden |
| MUST NOT leak | Contract data |

#### TC-FE-15 NEW endpoint fee-breakdown happy path

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/finance/contracts/6a095d81e7c717e8fc1c2da1/fee-breakdown` |
| Headers | `Authorization: Bearer <admin_token>` |
| Expected status | 200 |
| Expected body shape | `{ contractId, feeSource, totalFee, grossGMV, reconciliations: [...], selfCompute?: {...}, computedAt, warnings? }` |
| MUST NOT leak | Raw `_id`, `__v`, MongoDB error stack, `apiToken` |
| Side effect verify | Redis SET `pnl:fee-breakdown:<contractId>` |

#### TC-FE-16 Filter F-038 list by feeSource

| Element | Value |
|---------|-------|
| Method | GET `/api/finance/pnl/contracts?feeSource=SELF_COMPUTE` |
| Setup | 10 contracts: 4 RECONCILIATION, 5 SELF_COMPUTE, 1 ESTIMATED |
| Expected | items.length=5, all with `feeSource: 'SELF_COMPUTE'` |
| Side effect verify | totals.feeSourceMix reflects all 10 (not filtered) |

#### TC-FE-17 Validation — invalid feeSource enum

| Element | Value |
|---------|-------|
| URL | `?feeSource=INVALID_VALUE` |
| Expected status | 400 |
| Expected body | `{ message: ['feeSource phải là RECONCILIATION|SELF_COMPUTE|MIXED|ESTIMATED'] }` |

#### TC-FE-18 Boundary period overlap — exactly at recon period_start

| Element | Value |
|---------|-------|
| Setup | Contract period 2026-05-01..2026-12-31. Recon period 2026-05-01..2026-05-31. |
| Expected | Overlap match (recon.period_end >= contract.start AND recon.period_start <= contract.end → 05-31 >= 05-01 ✅ AND 05-01 <= 12-31 ✅), source=MIXED (because Jun-Dec gap), fee correctly computed |

#### TC-FE-19 Duplicate recon docs (TD-F003-02 defensive BR-40-13)

| Element | Value |
|---------|-------|
| Setup | 2 recon docs same (mysql_race_id, tenant_id, period) due to race condition |
| Expected | Both fees summed, source=RECONCILIATION |
| Side effect verify | Logger.warn `[F-040] duplicate recon docs detected` |

### Frontend E2E Test Cases (Playwright)

| TC | Persona | Journey | Steps | Expected |
|----|---------|---------|-------|----------|
| E2E-01 | Finance Admin Hiền | F-038 list source badges visible | 1. Login admin 2. Navigate `/finance/contracts` 3. Wait data load | Table renders 20 rows. Rows with feeSource: SELF_COMPUTE show blue 🧮 "Tự tính" badge. Rows RECONCILIATION show green ✅ "BBNT đã ký". Rows ESTIMATED hide badge. |
| E2E-02 | Finance Admin | Tooltip on Doanh thu hover | 1. Hover row with feeSource=SELF_COMPUTE Doanh thu cell 2. Wait 300ms | Tooltip popup "🧮 Tự tính từ tỉ lệ phí merchant — chưa có BBNT. GMV tham khảo: 18.284.000 ₫" |
| E2E-03 | Back-Office Admin | F-028 dashboard source mix strip | 1. Navigate `/finance` 2. Wait data | Source mix strip below KPI cards "60% BBNT ký · 30% Tự tính · 10% Ước tính" with stacked bar |
| E2E-04 | Back-Office Admin | Click source mix segment → filter list | 1. Click "30% Tự tính" segment 2. Wait navigate | URL → `/finance/contracts?feeSource=SELF_COMPUTE`, F-038 list renders only SELF_COMPUTE rows |
| E2E-05 | Sales Admin Hằng | Contract detail expand breakdown panel | 1. Navigate `/contracts/6a095d81...` 2. Scroll to Lãi/Lỗ section 3. Click "▾ chi tiết breakdown" | Panel slides down 200ms. Shows: Source badge, recon contributions (if any), self-compute slice (if any), Total fee, GMV reference |
| E2E-06 | Sales Admin | Collapse breakdown panel | 1. Continue E2E-05 2. Click "▾" again | Panel slides up, chevron rotates back |
| E2E-07 | Non-admin staff | Access denied F-040 routes | 1. Login staff (not admin) 2. Navigate `/finance/contracts` | `<RestrictedAccess />` rendered, NO data fetch fired |
| E2E-08 | Finance Admin | TD-F016 legacy warning visible | 1. Navigate `/contracts/{contract-with-pre-2026-05-08-recon}` 2. Expand breakdown | Info banner subtle "ℹ️ BBNT này từ trước 08/05/2026 — có thể thiếu GROUP_BUY/CODE_TRANSFER orders (xem TD-F016)" |
| E2E-09 | Finance Admin | Filtered empty state | 1. Navigate `/finance/contracts?feeSource=MIXED` 2. No MIXED contracts exist | Empty state "Không có HĐ với source này" + CTA "Xoá filter" |
| E2E-10 | Finance Admin | Cross-DB degraded banner | 1. Backend MySQL down (mock) 2. Navigate `/finance` | Banner sub-header "⚠️ Một số số liệu là ước tính (Platform DB lỗi)" |

### Security Checks

- [x] All endpoints protected `LogtoAdminGuard` — verify 401 unauth + 403 staff
- [x] No IDOR (admin-only endpoint, no per-resource ownership for finance)
- [x] Response NOT leak: `apiToken`, MerchantConfig nested non-fee fields (legal_name OK to expose, bank_account NO), recon doc `_id` raw only in slice subdocs (acceptable), MongoDB stack trace
- [x] Cross-DB error wrapped — KHÔNG expose raw MySQL connection error message tới client
- [x] Cache key contains contract ID but NOT tenant API token

### Performance SLA

| Endpoint / Operation | Target p95 | Notes |
|---------------------|------------|-------|
| GET `/api/finance/dashboard` cold | < 800ms | 100 contracts batch (F-029 SLA preserve) |
| GET `/api/finance/dashboard` warm (cache hit) | < 100ms | Redis full hit all companion keys |
| GET `/api/finance/pnl/contracts` cold | < 800ms | Same |
| GET `/api/finance/contracts/:id/pnl` cold | < 400ms | Per-contract detail |
| GET `/api/finance/contracts/:id/fee-breakdown` cold | < 400ms | Includes recon query + self-compute SQL |
| GET `/api/finance/contracts/:id/fee-breakdown` warm | < 50ms | Redis hit |
| Cache hit ratio after 60min steady state | > 80% | Per BR-40-11 TTL strategy |
| Reconciliation query per contract | < 50ms | Indexed (tenant_id + mysql_race_id) |
| MerchantConfig lookup | < 20ms | Indexed unique tenantId |
| MySQL self-compute SQL (1 race) | < 200ms | Preserve F-029 HIGH-PERF-01 bulk pattern when N races |

### 10x Stability Test

- Critical path: `getFeeForContract()` × 10 sequential same contractId → all 10 return identical fee value (cache hit determinism)
- Concurrent: 50 GET dashboard requests / 60s → 0 errors, p95 < 1s (cache covers 90%+)

---

## 📌 Answers to Manager's PAUSE conditions (từ file 00)

> BA giải quyết 7 PAUSE-40-* Manager đã đặt, encode vào BR.

- **PAUSE-40-01 (Pre-recon era race fallback):** ✅ Self-compute default + `feeSource: 'SELF_COMPUTE'` + subtle badge "🧮 Tự tính". KHÔNG block UI. Encoded as **BR-40-02 tier 2** + **BR-40-09**.
- **PAUSE-40-02 (Partial period recon — split-compute):** ✅ Split-compute: recon cover overlap month(s) as-is + self-compute cho period gap months. `feeSource: 'MIXED'`. Encoded as **BR-40-02 tier 3** + **BR-40-04**.
- **PAUSE-40-03 (Mixed category):** ✅ Per-category fee compute then sum: `fee_total = SUM(5BIB orders × service_fee_rate%) + SUM(MANUAL line_items quantity × manual_fee_per_ticket)`. Encoded as **BR-40-05** + **BR-40-06** + **BR-40-07**.
- **PAUSE-40-04 (Null MerchantConfig fallback):** ✅ Cascade 3-tier: MerchantConfig → contract.revenueShare.feePercentage → hardcoded 5.5% + Logger.warn. Encoded as **BR-40-08**.
- **PAUSE-40-05 (Cache TTL 60min + eager invalidation):** ✅ TTL=3600s reuse key `pnl:ticket-sales-fee:` + 2 companion keys. Eager DEL on MerchantConfig update + Reconciliation status change. Encoded as **BR-40-11**.
- **PAUSE-40-06 (UI single column + drill-down):** ✅ Option C — keep "Doanh thu" column semantic shift (no rename) + tooltip on hover + drill-down breakdown panel in `/contracts/[id]` detail. GMV reference only in expanded breakdown. Encoded as **BR-40-10**.
- **PAUSE-40-07 (Migration eager flush post-deploy):** ✅ Eager flush all `pnl:*` keys post-deploy script. Manager `/5bib-deploy` checklist includes:
  ```bash
  ssh 5solution-vps "docker exec 5bib-result-redis redis-cli --scan --pattern 'pnl:*' | xargs docker exec -i 5bib-result-redis redis-cli del"
  ```
  Add into `05-manager-deploy.md` Deploy summary section.

---

## ✅ Status

- [x] **READY** — sẵn sàng cho Manager review (`/5bib-plan`)

---

## 🔗 Next step

Danny chạy: `/5bib-plan FEATURE-040-finance-real-fee-compute`

Manager sẽ:
1. Validate checklist 8 items (User Stories đủ / BR testable / UI states đủ / Data source rõ / DB change flag / API contract no break / Perf SLA cụ thể / Security boundary rõ)
2. Cross-check với memory architecture + conventions + known-issues
3. Output `02-manager-plan.md` với Scope Lock + verdict APPROVED hoặc NEEDS_REVISION
4. Approve cho Coder bắt đầu nếu pass tất cả

**Estimate cho Coder workload:**
- Backend: ~10 files (3 NEW DTO, 1 NEW endpoint, 4 modify service+module, 2 spec extend)
- Admin: ~7 files (3 NEW components, 4 modify pages)
- Tests: 19 TC-FE backend + 10 E2E Playwright
- Total LoC estimate: ~1500-2000 lines (medium-large feature)
