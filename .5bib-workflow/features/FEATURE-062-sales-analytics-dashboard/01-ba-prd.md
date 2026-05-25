# FEATURE-062: Sales Analytics Dashboard — Multi-Tab Redesign — PRD v3

**Status:** 🔵 READY (v3 — Manager Adjustments #1–#6 applied 2026-05-22)
**Author:** BA (5BIB Mastermind PO + Master Business Analyst)
**Created:** 2026-05-24
**Revised:**
  - 2026-05-25 (v2 — Multi-tab architecture per design review)
  - 2026-05-22 (v3 — Manager Adjustments #1 GranularityKind split, #2 TTL align 900s/86400s, #3 Selector split 3 components, #4 TD-F019 documentation, #5 5Solution brand tokens lock, #6 3 strategic metrics added)
**Owner:** Danny
**Type:** EXTEND_EXISTING (nâng cấp F-026 Analytics + multi-tab layout + GA4 integration)
**Renumbered:** F-060 → F-062 (Manager 2026-05-22 — F-060 chiếm bởi SEO landing uplift merged main `e7284b0`, F-061 = split-payment-ref-ordinary ship `c4a736f`)
**Manager init:** `00-manager-init.md` (đọc đầy đủ — 235 dòng, 5 PAUSE đã chốt)
**Manager plan v1:** `02-manager-plan.md` (529 dòng — 🟡 APPROVED WITH ADJUSTMENTS 2026-05-22, 6 BA action items)
**Supersedes:** F-039 (stale), PRD v1 (single-page layout → thay bằng 5-tab), PRD v2 (BR-SA-01 conflate Period+Granularity → split v3)
**Reference PRDs:** F-026, F-058, F-059

---

## ✅ Pre-flight Check

- [x] `00-manager-init.md` tồn tại, đã đọc đầy đủ (235 dòng, 5 PAUSE đã chốt bởi Danny 2026-05-24).
- [x] Đọc `.5bib-workflow/memory/conventions.md` — Redis lock pattern, dual-pattern flush helper, deterministic cache key hashing.
- [x] Đọc `.5bib-workflow/memory/codebase-map.md` — module `analytics/` dependency map.
- [x] Đọc `.5bib-workflow/memory/known-issues.md` — TD-F026-CACHE-INVALIDATE, TD-F016-FINANCE-01.
- [x] Đọc F-058 PRD — pattern delegate `FeeService.computeFeeForOrdersAggregate()`, DTO `OrderForFeeAggregate`.
- [x] Đọc F-059 PRD — Dashboard KPI + Sparkline cascade pattern, `flushEventOverrideCache` 9 key pattern.
- [x] Spot-check code thực tế:
  - `analytics.controller.ts` (258 dòng, 16 endpoint, `LogtoAdminGuard`) — route prefix `/analytics/*`.
  - `analytics.service.ts` (800+ dòng, inject `@InjectDataSource('platform')`, `FeeService`, `cachedQuery`, `buildDateFilter`, `pullOrdersForFeeAggregate`).
  - `period-resolver.ts` (212 dòng) — `PeriodKind = '7d' | '30d' | 'quarter' | 'year' | 'custom' | 'rolling12m'`. CHƯA CÓ `'weekly'` | `'monthly'`.
  - `analytics-query.dto.ts` (121 dòng) — `month?, from?, to?, tenantId?, raceId?, raceType?, status?, sortBy?, sortOrder?, page?, limit?`.
  - `admin/analytics/page.tsx` (608 dòng) — `raw fetch()` với `authHeaders`, state riêng lẻ, layout flat.
  - `admin/analytics/components/PeriodCompareSelector.tsx` (61 dòng) — thiếu `'custom'` + WoW.
  - `admin/analytics/components/ExportButton.tsx` (59 dòng) — stub UI, chưa wire download thật.
- [x] Đọc 4 design files (analytics-overview.jsx 712 dòng, analytics-runners.jsx 323 dòng, analytics-merchants.jsx 228 dòng, analytics-races.jsx 219 dòng).
- [x] Danny confirmed ALL 7 additions: Multi-tab 5 sub-page, Granularity control, Runner Behavior, Race Performance, Merchant Comparison, Order Funnel 5-stage, Accordion vận hành chi tiết.

---

## 🎯 Title + Goal + Scope

### Title
Nâng cấp Sales Analytics Dashboard: Multi-tab architecture (5 sub-page), daily/weekly/monthly aggregation, WoW/MoM/YoY comparison, Runner Behavior analytics, Race Performance analytics, Merchant Comparison analytics, Order Funnel 5-stage, GA4 integration, Export CSV/Excel, Layout redesign.

### Goal
- **Kiến trúc multi-tab:** Chuyển từ 1 trang dài cuộn (v1) sang 5 sub-tab rõ ràng — mỗi tab phục vụ 1 nhóm insight.
- **Tab 1 — Tổng quan:** KPI strip + Revenue trend + Category donut + Comparison + Top Races + Alerts + Merchant Health overview + Order Funnel + GA4 + Accordion F-026.
- **Tab 2 — Hiệu suất Race:** Filter bar (date range + race type + merchant), GMV by race type chart, Race spotlight, Paginated race table.
- **Tab 3 — Merchant:** Scatter chart GMV×Orders, Health Score distribution 5 tier, Full comparison table sortable.
- **Tab 4 — Runner (Hành vi Runner):** Booking heatmap 7×24, Lead time histogram 5 bucket, Repeat cohort 4 tier, Demographics age×gender, Geographic top 8 provinces.
- **Tab 5 — Funnel:** Order Funnel 5-stage (Khởi tạo → Đã thanh toán → Hoàn thành → Bị hủy → Refunded) với conversion rates.
- **Granularity control:** Admin chọn Ngày/Tuần/Tháng cho revenue chart ngay trong tab bar.
- **Period comparison:** WoW/MoM/YoY toggle trên 1 UI.
- **FEE INVARIANT:** Mọi metric phí 5BIB PHẢI dùng `FeeService.computeFeeForOrdersAggregate()`.

### Scope IN

| # | Module | File/Thư mục | Hành động |
|---|--------|-------------|-----------|
| 1 | Period Resolver | `backend/src/modules/analytics/services/period-resolver.ts` | **EXTEND** `PeriodKind` thêm `'weekly'` \| `'monthly'`. BACKWARD COMPAT. |
| 2 | Analytics Service | `backend/src/modules/analytics/analytics.service.ts` | **EXTEND** thêm ~15 methods mới (weekly/monthly revenue, comparison, runner behavior, race performance, merchant comparison, funnel upgrade). |
| 3 | Analytics Controller | `backend/src/modules/analytics/analytics.controller.ts` | **EXTEND** thêm ~20 endpoint mới (xem bảng 3.2). |
| 4 | DTO mới | `backend/src/modules/analytics/dto/` | **NEW** ~15 DTO files cho request/response. |
| 5 | GA4 Service | `backend/src/modules/analytics/services/ga4.service.ts` | **NEW** — Google Analytics Data API v4 integration. |
| 6 | Export Service | `backend/src/modules/analytics/services/export.service.ts` | **NEW** — CSV/Excel generation via `exceljs`. |
| 7 | Runner Service | `backend/src/modules/analytics/services/runner-analytics.service.ts` | **NEW** — Booking heatmap, lead time, repeat cohort, demographics, geographic analytics. |
| 8 | Race Perf Service | `backend/src/modules/analytics/services/race-performance.service.ts` | **NEW** — Race type distribution, spotlight, filtered performance list. |
| 9 | Merchant Comp Service | `backend/src/modules/analytics/services/merchant-comparison.service.ts` | **NEW** — Scatter data, health distribution, comparison table. |
| 10 | Analytics Module | `backend/src/modules/analytics/analytics.module.ts` | **EXTEND** register new services/providers. |
| 11 | Admin Analytics Layout | `admin/src/app/(dashboard)/analytics/layout.tsx` | **NEW** — Tab navigation layout wrapper (5 tabs). |
| 12 | Admin Tab 1 — Tổng quan | `admin/src/app/(dashboard)/analytics/page.tsx` | **REFACTOR** toàn bộ → multi-tab overview. TanStack Query + SDK. |
| 13 | Admin Tab 2 — Hiệu suất Race | `admin/src/app/(dashboard)/analytics/races/page.tsx` | **NEW** — Race performance page. |
| 14 | Admin Tab 3 — Merchant | `admin/src/app/(dashboard)/analytics/merchants/page.tsx` | **REFACTOR** — Merchant comparison page. |
| 15 | Admin Tab 4 — Runner | `admin/src/app/(dashboard)/analytics/runners/page.tsx` | **NEW** — Runner behavior page. |
| 16 | Admin Tab 5 — Funnel | `admin/src/app/(dashboard)/analytics/funnel/page.tsx` | **REFACTOR** — Funnel 5-stage visual. |
| 17 | Admin Components | `admin/src/app/(dashboard)/analytics/components/` | **EXTEND + NEW** ~20 components. |
| 18 | Analytics Labels | `admin/src/lib/analytics-labels.ts` | **NEW** — Vietnamese dictionary cho tất cả enum. |
| 19 | API Generated SDK | `admin/src/lib/api-generated/` | **REGENERATE** `pnpm generate:api` sau backend endpoint mới. |
| 20 | API Hooks | `admin/src/lib/api-hooks.ts` | **EXTEND** hooks mới cho TanStack Query. |

### Scope OUT (Phase 2+)

| Item | Lý do |
|------|-------|
| Normalized metrics trend (GMV/race trend line) | Phase 2 — cần accumulate time series. |
| Revenue concentration warning (top 5 = X%) | Phase 2 — cần threshold definition. |
| Booking patterns trend (peak hour shift) | Phase 2 — cần multi-month heatmap comparison. |
| Slack/email alert automation | Phase 2 — cần notification infrastructure. |
| Mobile responsive analytics | Phase 2 — admin dashboard chủ yếu desktop. |
| Real-time WebSocket analytics | Phase 2 — TTL cache + manual refresh đủ MVP. |
| Runner individual profile drill-down | Phase 2 — privacy + PII considerations. |
| Merchant drill-down per race | Phase 2 — cần pivot query. |

---

## 👥 Phase 1: Product Vision & User Stories

### Objective
Cung cấp cho Admin (back-office) và Finance team một Sales Analytics Dashboard multi-tab toàn diện, giúp:
1. Nhìn tổng quan doanh thu + đơn hàng với khả năng so sánh kỳ trước (Tab 1)
2. Đánh giá hiệu suất từng race theo loại hình + merchant (Tab 2)
3. So sánh merchant ecosystem — health score + scatter + ranking (Tab 3)
4. Hiểu hành vi runner — booking pattern + lead time + repeat + demographics + geographic (Tab 4)
5. Nhìn phễu đơn hàng 5 giai đoạn với conversion rates (Tab 5)

### User Stories

**US-60-01:** *Là Back-Office Admin*, tôi muốn chuyển granularity chart revenue từ Ngày → Tuần → Tháng bằng 1 click, *để* nhìn xu hướng ở nhiều góc thời gian.

**US-60-02:** *Là Back-Office Admin*, tôi muốn xem so sánh WoW/MoM/YoY cho GMV, Net Revenue, Platform Fee, và Orders, *để* biết xu hướng tăng/giảm.

**US-60-03:** *Là Back-Office Admin*, tôi muốn xem Top races by GMV VÀ by số đơn trong 2 toggle, *để* phân biệt race doanh thu cao vs race popular.

**US-60-04:** *Là Back-Office Admin*, tôi muốn xem panel "Giải chạy cần chú ý" hiện race bán chậm, *để* chủ động push marketing.

**US-60-05:** *Là Back-Office Admin*, tôi muốn xem Merchant Health Score 5 tier (Xuất sắc/Tốt/Trung bình/Yếu/Nguy cơ), *để* biết merchant nào cần nurture.

**US-60-06:** *Là Back-Office Admin*, tôi muốn xem Order Funnel 5 giai đoạn (Khởi tạo → Đã thanh toán → Hoàn thành → Bị hủy → Refunded), *để* nhận diện drop-off.

**US-60-07:** *Là Back-Office Admin*, tôi muốn export analytics data ra CSV/Excel, *để* báo cáo management offline.

**US-60-08:** *Là Back-Office Admin*, tôi muốn xem web traffic từ GA4 ngay trong admin, *để* không chuyển sang Google Analytics console.

**US-60-09:** *Là Back-Office Admin*, tôi muốn xem **Hiệu suất Race** trên tab riêng — filter theo loại race (Road Marathon, Trail, Ultra Trail), merchant, ngày — với biểu đồ GMV by race type + spotlight race tốt nhất + bảng chi tiết paginated, *để* so sánh hiệu quả giữa các loại giải.

**US-60-10:** *Là Back-Office Admin*, tôi muốn xem **So sánh Merchant** trên tab riêng — scatter chart GMV×Đơn hàng, phân bố Health Score 5 tier, bảng comparison 10 cột sortable, *để* đánh giá toàn diện merchant ecosystem.

**US-60-11:** *Là Back-Office Admin*, tôi muốn xem **Hành vi Runner** trên tab riêng — heatmap booking 7×24, lead time histogram, repeat cohort, demographics (tuổi × giới tính), geographic (top tỉnh thành), *để* hiểu patterns đăng ký.

**US-60-12:** *Là Back-Office Admin*, tôi muốn accordion "Phân tích vận hành chi tiết" collapse mặc định (6 panel F-026), *để* dashboard không quá dài mà vẫn truy cập được chi tiết.

**US-60-13:** *Là Back-Office Admin*, tôi muốn navigate giữa 5 tab (Tổng quan / Hiệu suất Race / Merchant / Runner / Funnel) mà KHÔNG mất context period/granularity đã chọn, *để* phân tích liên tục.

### Business Rules

#### BR-SA-01 — Granularity vs Period — TÁCH 3 enums riêng (v3 Manager Adjustment #1)

> **Manager 2026-05-22 directive:** PRD v2 đề xuất ADD `'weekly'` + `'monthly'` vào `PeriodKind` SAI semantic. Weekly/monthly LÀ BUCKET SIZE (granularity) cho chart aggregation, KHÔNG PHẢI time range filter. Mixing 2 concepts vào 1 union sẽ risk break F-026 6 endpoint.

**3 enum riêng biệt — KHÔNG mixed:**

1. **`PeriodKind`** — GIỮ NGUYÊN 6 values cho time range filter, KHÔNG thêm gì:
   ```typescript
   type PeriodKind = '7d' | '30d' | 'quarter' | 'year' | 'custom' | 'rolling12m'
   ```
   Backward compat 100% với 6 endpoint F-026 hiện tại.

2. **`GranularityKind`** — MỚI, cho chart bucket size:
   ```typescript
   type GranularityKind = 'daily' | 'weekly' | 'monthly'
   ```
   - `'daily'`: bucket 1 ngày (default cho chart 30 data points).
   - `'weekly'`: bucket ISO 8601 week (Thứ 2 → Chủ nhật).
   - `'monthly'`: bucket calendar month (ngày 1 → cuối tháng).

3. **`CompareKind`** — EXTEND từ F-026, thêm `'wow' | 'mom' | 'yoy'`:
   ```typescript
   type CompareKind = 'none' | 'prev' | 'wow' | 'mom' | 'yoy' | 'custom'
   ```
   - `'prev'` GIỮ cho backward compat F-026.
   - `'wow' | 'mom' | 'yoy'` thêm mới cho F-062 Comparison Row.

**Frontend pass 3 query params riêng biệt:** `?period=30d&granularity=weekly&compare=mom`.

**Backend behavior:**
- `period` → resolveRange() filter time range (SQL WHERE clause).
- `granularity` → resolveBucketSize() decide GROUP BY bucket trong aggregation pipeline.
- `compare` → resolveCompareRange() compute previous period range cho delta calc.

**Helper mới trong `period-resolver.ts`:**
```typescript
export function resolveBucketSize(granularity: GranularityKind): {
  sqlGroupExpr: string;  // 'DATE(payment_on)' | 'YEARWEEK(payment_on, 3)' | 'DATE_FORMAT(payment_on, "%Y-%m")'
  labelFormat: string;   // 'DD/MM' | 'Tuần WW' | 'Tháng MM/YYYY'
}
```

**6 endpoint F-026 hiện tại KHÔNG bị ảnh hưởng** — chỉ nhận `PeriodKind` cũ.

#### BR-SA-02 — Weekly Revenue Aggregation

Endpoint `GET /analytics/revenue/weekly` trả doanh thu aggregate theo tuần (ISO week).

- **Response shape:** Array of `{ week: string (YYYY-Www), weekStart: string (YYYY-MM-DD), weekEnd: string, gmv: number, netGmv: number, platformFee: number, orderCount: number }`.
- **Phí 5BIB:** PHẢI dùng `FeeService.computeFeeForOrdersAggregate()`. KHÔNG inline tính phí.
- **Default:** 12 tuần gần nhất nếu không truyền `from/to`.
- **Cache:** `analytics:metric:weekly-revenue:<scope>:<periodKey>` TTL **900s (current month), 86400s (historical)** — align existing `analytics.service.ts` convention `TTL_CURRENT=900s, TTL_HISTORY=86400s`. Coder reuse `cachedQuery()` helper auto-detect TTL từ key (Manager Adjustment #2 v3).

#### BR-SA-03 — Monthly Revenue Aggregation

Endpoint `GET /analytics/revenue/monthly` trả doanh thu aggregate theo tháng.

- **Response shape:** Array of `{ month: string (YYYY-MM), gmv: number, netGmv: number, platformFee: number, orderCount: number }`.
- **Phí 5BIB:** PHẢI dùng `FeeService.computeFeeForOrdersAggregate()`.
- **Default:** 12 tháng gần nhất.
- **Cache:** `analytics:metric:monthly-revenue:<scope>:<periodKey>` TTL **900s (current month), 86400s (historical)** — align existing convention (Manager Adjustment #2 v3).

#### BR-SA-04 — Period Comparison (WoW/MoM/YoY)

Endpoint `GET /analytics/comparison` trả so sánh metrics giữa period hiện tại và period tham chiếu.

- **Input:** `compareWith: 'wow' | 'mom' | 'yoy'`.
- `'wow'` = tuần này vs tuần trước.
- `'mom'` = tháng này vs tháng trước.
- `'yoy'` = tháng này vs cùng tháng năm trước.
- **Response shape:**
```
{
  current: { label, from, to, gmv, netGmv, platformFee, orderCount },
  previous: { label, from, to, gmv, netGmv, platformFee, orderCount },
  delta: { gmvPct, netGmvPct, platformFeePct, orderCountPct }
}
```
- **Phí 5BIB:** PHẢI dùng `FeeService.computeFeeForOrdersAggregate()`.
- **Delta calculation:** `calcDeltaPercent()` từ `period-resolver.ts`. Trả `null` nếu base = 0.
- **Cache:** `analytics:metric:comparison:<scope>:<compareWith>:<periodKey>` TTL **900s (current), 86400s (historical)** — align convention (Manager Adjustment #2 v3).

#### BR-SA-05 — Top Races by Orders

Endpoint `GET /analytics/top-races-by-orders` trả top races xếp theo số đơn hàng.

- **Response shape:** Array of `{ raceId, raceName, tenantId, tenantName, orderCount, gmv, netGmv, platformFee, fillRate }`.
- Limit: 10 default, max 50.
- **Sort:** `orderCount DESC`.
- **Phí 5BIB:** PHẢI dùng `FeeService.computeFeeForOrdersAggregate()`.
- **Cache:** `analytics:metric:top-races-orders:<scope>:<periodKey>` TTL **900s (current), 86400s (historical)** — align convention (Manager Adjustment #2 v3).
- **Fill rate bar:** Design hiện progress bar fill rate cho mỗi race.

#### BR-SA-06 — Races Cần Attention (Alerts)

Endpoint `GET /analytics/alerts/races-need-attention` trả danh sách race cần push marketing.

- **Tiêu chí "cần attention":**
  1. Fill rate < 30% VÀ ngày race trong vòng 30 ngày tới.
  2. Hoặc: đơn hàng giảm > 50% so với tuần trước.
  3. Hoặc: race đã live > 14 ngày nhưng fill rate < 10%.
- **Response shape:** Array of `{ raceId, raceName, tenantName, alertType: 'LOW_FILL_RATE' | 'ORDER_DROP' | 'STAGNANT', fillRate, orderCount, daysUntilRace, weekOverWeekChange, severity: 'WARNING' | 'CRITICAL' }`.
- `severity = 'CRITICAL'` nếu fill rate < 10% VÀ daysUntilRace < 14.
- `severity = 'WARNING'` cho còn lại.
- **Sort:** `severity DESC` (CRITICAL trước), rồi `daysUntilRace ASC`.
- **Design detail:** Alert card có left-border strip 4px — đỏ = CRITICAL, vàng = WARNING. Hiện metrics: Fill rate %, Còn X slot, WoW change %.
- **Cache:** `analytics:metric:alerts-races:<scope>:current` TTL **900s** (current-only data, không historical variant — Manager Adjustment #2 v3).

#### BR-SA-07 — Merchant Health Score (5-tier)

Endpoint `GET /analytics/alerts/merchant-health` trả merchant health assessment.

- **Phân loại status:**
  - `ACTIVE`: có đơn hàng trong 30 ngày qua.
  - `AT_RISK`: không có đơn trong 30 ngày qua, nhưng có trong 60 ngày.
  - `CHURNED`: không có đơn trong 90 ngày qua.
  - `NEW`: merchant tạo trong 30 ngày qua, chưa có đơn.
- **Health Score formula (RFM):** `healthScore = w1×recency + w2×frequency + w3×monetary`.
  - `recency` = 100 nếu đơn trong 7 ngày, 75 nếu 7-14d, 50 nếu 14-30d, 25 nếu 30-60d, 0 nếu >60d.
  - `frequency` = min(100, totalOrders90d × 10).
  - `monetary` = min(100, gmv90d / 10_000_000 × 100). Threshold 10M VND.
  - Trọng số: `w1=0.4, w2=0.3, w3=0.3`.
- **Health Score tiers (per design):**
  - 80-100: `EXCELLENT` — "Xuất sắc" (green-600)
  - 60-79: `GOOD` — "Tốt" (blue-600)
  - 40-59: `AVERAGE` — "Trung bình" (amber-500)
  - 20-39: `WEAK` — "Yếu" (orange-500)
  - 0-19: `AT_RISK_SCORE` — "Nguy cơ" (red-500)
- **Response shape:**
```
{
  summary: { active, atRisk, churned, new, total },
  activeCount: { d30, d60, d90 },
  merchants: Array<{
    tenantId, tenantName, status, lastOrderDate, totalOrders30d, totalOrders60d, totalOrders90d,
    gmv30d, raceCount, feeRate, manualPct, voidedPct, healthScore
  }>
}
```
- **Sort:** `healthScore ASC` (yếu nhất trước).
- **Cache:** `analytics:metric:merchant-health:platform:current` TTL **900s** (current-only — Manager Adjustment #2 v3).

#### BR-SA-08 — Merchant Active Count 30/60/90 ngày

Đã bao gồm trong `merchant-health` endpoint response: `activeCount: { d30, d60, d90 }`. Frontend hiện 3 metric cards inline.

#### BR-SA-09 — Order Funnel 5 Giai Đoạn (Upgrade)

Endpoint `/analytics/funnel` MỞ RỘNG response từ 4 stages lên 5 stages:

- **5 stages theo design:**
  1. **Khởi tạo** — tổng đơn tạo (mọi status).
  2. **Đã thanh toán** — `financial_status = 'paid'`.
  3. **Hoàn thành** — `status = 'completed'` (delivered/used).
  4. **Bị hủy** — `status = 'cancelled'`.
  5. **Refunded** — `status = 'refunded'` hoặc `financial_status = 'refunded'`.
- **Conversion rate:** Mỗi stage hiện `count` + `% so với tổng Khởi tạo`.
- **Design:** Horizontal bars, mỗi bar width proportional to count, labels: tên stage + count + percentage.
- **Cache:** `analytics:metric:funnel:<scope>:<periodKey>` TTL **900s (current), 86400s (historical)** — align convention (Manager Adjustment #2 v3).
- **Backward compat:** Endpoint response MỚI có thêm field `refundedCount`, `refundedPct`. Frontend cũ nếu chưa update → ignore field mới.

#### BR-SA-10 — Export CSV/Excel (Fix TD-F026-EXPORT-STUB)

Endpoint `GET /analytics/export` trả file download.

- **Input:** `format: 'csv' | 'xlsx'`, `reportType: 'overview' | 'revenue' | 'races' | 'merchants' | 'funnel' | 'runners'`, cùng `AnalyticsQueryDto` params.
- **CSV:** UTF-8 BOM header (`﻿`) để Excel VN mở đúng encoding.
- **Excel:** `exceljs`, sheet name = reportType, format VND cho cột tiền, % cho cột tỷ lệ.
- **File name:** `5bib-analytics-{reportType}-{YYYYMMDD}.{csv|xlsx}`.
- **Max rows:** 10,000. Vượt → 400 "Dữ liệu quá lớn, vui lòng thu hẹp phạm vi thời gian".
- **Auth:** `LogtoAdminGuard`.
- **KHÔNG cache** — luôn query fresh.

#### BR-SA-11 — GA4 Data API Integration

Endpoint `GET /analytics/ga4/overview` proxy GA4 Data API v4.

- **Backend service:** `Ga4Service` dùng `@google-analytics/data`.
- **Auth:** Google Service Account JSON key. Env: `GA4_SERVICE_ACCOUNT_KEY_PATH`, `GA4_PROPERTY_ID`.
- **Metrics:** sessions, pageviews, bounceRate, avgSessionDuration, newUsers, topPages (top 10), trafficSources (top 5), dailySessions (sparkline).
- **Cache:** `analytics:ga4:overview:<periodKey>` TTL 600s.
- **Error handling:** GA4 chưa config → `{ available: false, error: 'GA4 chưa được cấu hình' }`. KHÔNG throw 500.
- **Design detail:** GA4 section hiện 4 KPI cards + sparkline + top 5 pages table + 5 traffic sources donut/table.

#### BR-SA-12 — Multi-Tab Architecture (5 Sub-Tab)

Analytics Page PHẢI chuyển từ single-page sang 5-tab architecture:

| Tab # | Label | Route | Mô tả |
|-------|-------|-------|-------|
| 1 | Tổng quan | `/analytics` | KPI + Revenue + Category + Comparison + Top Races + Alerts + Merchant overview + Funnel overview + GA4 + Accordion |
| 2 | Hiệu suất Race | `/analytics/races` | Filter bar + GMV by race type + Spotlight + Paginated table |
| 3 | Merchant | `/analytics/merchants` | Scatter + Health distribution + Comparison table |
| 4 | Runner | `/analytics/runners` | Heatmap + Lead time + Repeat cohort + Demographics + Geographic |
| 5 | Funnel | `/analytics/funnel` | Funnel 5-stage full + data table expandable |

**Tab navigation:** Horizontal tabs dính dưới header bar. Active tab có underline accent blue-600. Click tab → Next.js App Router navigation (giữ URL state).

**State persistence:** Period + Granularity + Compare selections PHẢI persist across tab navigation qua URL search params: `?period=30d&granularity=daily&compare=mom`.

#### BR-SA-13 — Granularity Toggle (TÁCH component riêng — Manager Adjustment #3 v3)

SegmentedControl 3 option trong header bar area: `"Ngày"` | `"Tuần"` | `"Tháng"`.

- **Component file:** `admin/src/app/(dashboard)/analytics/components/GranularityToggle.tsx` (MỚI — KHÔNG dùng chung file với Period/Compare selector).
- **Type:** `GranularityKind = 'daily' | 'weekly' | 'monthly'` (per BR-SA-01 v3).
- **Default:** `'daily'` (label "Ngày").
- Khi chuyển:
  - "Ngày" → `GET /analytics/revenue/daily` (endpoint cũ F-026).
  - "Tuần" → `GET /analytics/revenue/weekly` (endpoint mới — BR-SA-02).
  - "Tháng" → `GET /analytics/revenue/monthly` (endpoint mới — BR-SA-03).
- Revenue chart X-axis thay đổi theo `granularity`: DD/MM (daily), Tuần WW (weekly), Tháng MM/YYYY (monthly).
- **Design position:** Nằm trong header bar, bên phải title, TRƯỚC PeriodSelector.
- **URL params:** `?granularity=daily|weekly|monthly` (persist across tab navigation).

#### BR-SA-14 — Comparison Selector (TÁCH component riêng — Manager Adjustment #3 v3)

**Component file:** `admin/src/app/(dashboard)/analytics/components/CompareSelector.tsx` (MỚI — tách khỏi `PeriodCompareSelector.tsx` cũ).

- **Type:** `CompareKind = 'none' | 'prev' | 'wow' | 'mom' | 'yoy' | 'custom'` (per BR-SA-01 v3).
- **Mới so với F-026:** thêm `'wow' | 'mom' | 'yoy'` options. `'prev'` GIỮ cho backward compat.
- **UI:** Select dropdown với 5 options (KHÔNG include `custom` v1):
  - "Không so sánh" (`none`)
  - "Kỳ trước" (`prev`)
  - "Tuần trước (WoW)" (`wow`)
  - "Tháng trước (MoM)" (`mom`)
  - "Cùng kỳ năm trước (YoY)" (`yoy`)
- **Default:** `'mom'`.
- **Design position:** Header bar, SAU PeriodSelector, TRƯỚC Export button.
- **URL params:** `?compare=mom|wow|yoy|prev|none`.
- **Trên Tab 1 Section 3 (Comparison Row):** Còn 1 SegmentedControl phụ trợ `['WoW', 'MoM', 'YoY']` để switch nhanh trong context — sync state với header CompareSelector, KHÔNG độc lập.

#### BR-SA-14b — Period Selector (TÁCH component riêng — Manager Adjustment #3 v3)

**Component file:** `admin/src/app/(dashboard)/analytics/components/PeriodSelector.tsx` (MỚI — tách khỏi `PeriodCompareSelector.tsx` cũ).

- **Type:** `PeriodKind = '7d' | '30d' | 'quarter' | 'year' | 'custom' | 'rolling12m'` (GIỮ NGUYÊN F-026 backend convention, KHÔNG thêm weekly/monthly per BR-SA-01 v3).
- **UI:** Select dropdown với 6 options:
  - "7 ngày qua" (`7d`)
  - "30 ngày qua" (`30d`) — default
  - "Quý này" (`quarter`)
  - "Năm nay" (`year`)
  - "12 tháng rolling" (`rolling12m`)
  - "Tuỳ chỉnh" (`custom`) — mở date range picker inline
- **Default:** `'30d'`.
- **Design position:** Header bar, SAU GranularityToggle, TRƯỚC CompareSelector.
- **URL params:** `?period=7d|30d|quarter|year|rolling12m|custom`.
- **Custom variant:** Khi `period=custom` → render 2 DatePicker inputs ("Từ" + "Đến") inline cùng row, pass `from=YYYY-MM-DD&to=YYYY-MM-DD` thêm vào query.

#### BR-SA-14c — Backward Compat của PeriodCompareSelector.tsx cũ

- `admin/src/app/(dashboard)/analytics/components/PeriodCompareSelector.tsx` cũ (61 dòng) → **DEPRECATE** nhưng KHÔNG xoá ngay (giữ cho any in-flight feature ref tránh break import).
- Mark TODO trong header file: `// @deprecated F-062 v3 — split sang PeriodSelector/CompareSelector/GranularityToggle. Xoá sau Phase 2 verify zero refs.`
- Tab 1+2+3+4+5 page.tsx imports 3 NEW selectors thay thế qua shared `layout.tsx`.

#### BR-SA-15 — TanStack Query Migration

Admin Analytics Page PHẢI migrate từ `raw fetch()` sang TanStack Query hooks.

- Mỗi section 1 custom hook.
- SDK generated từ `@hey-api/openapi-ts`.
- Stale time: 60s current, 300s historical.
- Error retry: 2 lần, delay 1s.

#### BR-SA-16 — Error Messages (Tiếng Việt)

Tất cả error PHẢI tiếng Việt:
- 400: "Tham số không hợp lệ: {detail}"
- 400 (date range): "Phạm vi thời gian không được vượt quá 366 ngày"
- 400 (export): "Dữ liệu quá lớn (>{max} dòng), vui lòng thu hẹp phạm vi thời gian"
- 401: "Chưa đăng nhập hoặc token hết hạn"
- 403: "Không có quyền truy cập chức năng này"
- 500: "Lỗi hệ thống, vui lòng thử lại sau"
- GA4: "GA4 chưa được cấu hình hoặc tạm thời không khả dụng"

#### BR-SA-17 — Display Convention (Vietnamese Labels)

Mọi enum/technical value PHẢI map qua dictionary tiếng Việt:

```
ORDINARY → "Thường"
MANUAL → "Thủ công"
GROUP_BUY → "Mua nhóm"
PERSONAL_GROUP → "Nhóm cá nhân"
CHANGE_COURSE → "Đổi cự ly"
INSURANCE → "Bảo hiểm"
ACTIVE → "Hoạt động"
AT_RISK → "Có nguy cơ"
CHURNED → "Đã rời"
NEW → "Mới"
LOW_FILL_RATE → "Tỷ lệ bán thấp"
ORDER_DROP → "Đơn hàng giảm mạnh"
STAGNANT → "Đình trệ"
WARNING → "Cảnh báo"
CRITICAL → "Nghiêm trọng"
ROAD_MARATHON → "Marathon đường bộ"
ROAD_HALF_MARATHON → "Bán Marathon đường bộ"
ULTRA_TRAIL_RACE → "Ultra Trail"
TRAIL_RACE → "Trail"
EXCELLENT → "Xuất sắc"
GOOD → "Tốt"
AVERAGE → "Trung bình"
WEAK → "Yếu"
AT_RISK_SCORE → "Nguy cơ"
```

Dictionary tập trung tại `admin/src/lib/analytics-labels.ts`. KHÔNG inline duplicate.

#### BR-SA-18 — Cache Invalidation

Tất cả cache key `analytics:*` mới PHẢI được flush khi admin write. Extend `flushEventOverrideCache()`:
- Pattern cũ: 6 analytics F-058 + 2 dashboard F-059 + 1 F-043.
- Pattern mới: `analytics:metric:weekly-revenue:*`, `analytics:metric:monthly-revenue:*`, `analytics:metric:comparison:*`, `analytics:metric:top-races-orders:*`, `analytics:metric:alerts-races:*`, `analytics:metric:merchant-health:*`, `analytics:metric:runner-*:*`, `analytics:metric:race-perf-*:*`, `analytics:metric:merchant-comp-*:*`, `analytics:metric:funnel:*`.
- `analytics:ga4:*` KHÔNG flush (GA4 không phụ thuộc admin write).
- Flush method: `scanStream` + pipeline `DEL`.

#### BR-SA-19 — Category Segments (Mở rộng)

Design hiện category donut gồm 6 segments:
- `ORDINARY` (86% — phần lớn)
- `MANUAL` (11%)
- `CHANGE_COURSE` (2% — đổi cự ly)
- `INSURANCE` (1% — bảo hiểm chạy)
- `GROUP_BUY` (giữ từ PRD v1)
- `PERSONAL_GROUP` (giữ từ PRD v1)

Endpoint `/analytics/revenue-by-category` PHẢI trả đủ 6 categories. Nếu category count = 0 → vẫn trả `{ category, count: 0, gmv: 0 }` để UI render legend đầy đủ.

#### BR-SA-20 — Runner Behavior Analytics (Tab 4)

**5 widgets trên Runner tab, mỗi widget 1 endpoint riêng:**

**BR-SA-20a — Booking Heatmap (7×24):**
- **Endpoint:** `GET /analytics/runners/booking-heatmap`
- Grid 7 hàng (CN, T2, T3, T4, T5, T6, T7) × 24 cột (0h-23h).
- Mỗi ô = số lượng đơn đặt trong giờ đó, ngày đó.
- Intensity scale 6 levels: 0 (trắng), 1-5 (blue-50), 6-15 (blue-100), 16-30 (blue-200), 31-50 (blue-300), 51+ (blue-500).
- **Data source:** `orders.created_at` parsed theo `dayOfWeek` + `hourOfDay` (timezone VN UTC+7).
- **Cache:** `analytics:metric:runner-heatmap:<scope>:<periodKey>` TTL 900s (current), 86400s (historical).

**BR-SA-20b — Lead Time Histogram (5 buckets):**
- **Endpoint:** `GET /analytics/runners/lead-time`
- Lead time = `race.date - order.created_at` (ngày).
- 5 buckets:
  - 0-7 ngày: "Last-minute" (red-400)
  - 8-30 ngày: "Cận race" (amber-400)
  - 31-60 ngày: "Lập kế hoạch" (blue-400)
  - 61-120 ngày: "Early bird" (green-400)
  - 120+ ngày: "Super early" (purple-400)
- Response: `Array<{ bucket, label, count, percentage, color }>`.
- Design hiện insight box: "28% runner đặt 31-60 ngày trước — nhóm lớn nhất. 8% đặt last-minute, cần chiến lược giá sớm."
- **Cache:** `analytics:metric:runner-leadtime:<scope>:<periodKey>` TTL 900s (current), 86400s (historical).

**BR-SA-20c — Repeat Cohort (4 tiers):**
- **Endpoint:** `GET /analytics/runners/repeat-cohort`
- Đếm unique runners theo số races đã tham gia:
  - 1 race (label: "1 giải")
  - 2 races (label: "2 giải")
  - 3-4 races (label: "3-4 giải")
  - 5+ races (label: "5+ giải")
- Response: `Array<{ tier, count, percentage }>` + `totalUniqueRunners`.
- Design hiện stacked bar + list, insight warning "83.8% runners chỉ tham gia 1 race — cần loyalty program."
- **Cache:** `analytics:metric:runner-repeat:<scope>:<periodKey>` TTL 900s (current), 86400s (historical).

**BR-SA-20d — Demographics (Age × Gender):**
- **Endpoint:** `GET /analytics/runners/demographics`
- 6 age brackets: 18-24, 25-34, 35-44, 45-54, 55-64, 65+.
- Gender: Nam, Nữ, Khác, Không rõ.
- Response: `{ brackets: Array<{ ageRange, male, female, other, unknown, total }>, genderSummary: { male: { count, pct }, female: { count, pct }, other: { count, pct }, unknown: { count, pct } } }`.
- **Data source:** `athletes.date_of_birth` (age = race.date - dob years), `athletes.gender`.
- Athletes thiếu DOB → bucket "Không rõ tuổi" (KHÔNG bỏ ra khỏi tổng).
- **Cache:** `analytics:metric:runner-demo:<scope>:<periodKey>` TTL 900s (current), 86400s (historical).

**BR-SA-20e — Geographic (Top Provinces):**
- **Endpoint:** `GET /analytics/runners/geographic`
- Top 8 tỉnh thành theo số lượng runner.
- Response: `{ provinces: Array<{ province, count, percentage }>, coverage: number (%), totalWithProvince: number, totalRunners: number }`.
- Coverage = `totalWithProvince / totalRunners * 100`.
- **Data source:** `athletes.province` hoặc `orders.billing_province`. Athletes thiếu province → "Không rõ" (không tính vào top 8).
- **Cache:** `analytics:metric:runner-geo:<scope>:<periodKey>` TTL 900s (current), 86400s (historical).

**BR-SA-20f — Runner Summary KPIs (Tab 4 header):**
- **Endpoint:** `GET /analytics/runners/summary`
- 4 KPIs:
  - **Unique Runners:** Số runner duy nhất (distinct `athlete_id` từ paid orders).
  - **Repeat rate:** `(runners có ≥2 races) / totalUniqueRunners * 100` (%).
  - **Avg lead time:** Trung bình `race.date - order.created_at` (ngày).
  - **Avg đơn/runner:** `totalOrders / totalUniqueRunners`.
- Mỗi KPI có delta MoM (%).
- **Cache:** `analytics:metric:runner-summary:<scope>:<periodKey>` TTL 900s (current), 86400s (historical).

#### BR-SA-21 — Race Performance Analytics (Tab 2)

**BR-SA-21a — Race Type Distribution (Chart):**
- **Endpoint:** `GET /analytics/races/type-distribution`
- Horizontal bar chart GMV by race type.
- Response: `Array<{ raceType, count, gmv, avgGmv }>`.
- Race types: `ROAD_MARATHON`, `ROAD_HALF_MARATHON`, `ULTRA_TRAIL_RACE`, `TRAIL_RACE`.
- **Cache:** `analytics:metric:race-perf-type:<scope>:<periodKey>` TTL 900s (current), 86400s (historical).

**BR-SA-21b — Race Spotlight:**
- **Endpoint:** `GET /analytics/races/spotlight`
- Trả race có GMV cao nhất trong period.
- Response: `{ raceId, raceName, merchant, type, date, gmv, orders, avgPerOrder, platformFee, insight: string }`.
- `insight` = tự generate text: "Đóng góp {X}% tổng GMV, trung bình {Y} VND/đơn".
- **Cache:** `analytics:metric:race-perf-spotlight:<scope>:<periodKey>` TTL 900s (current), 86400s (historical).

**BR-SA-21c — Race Performance List (Paginated + Filtered):**
- **Endpoint:** `GET /analytics/races/performance`
- Extend existing F-026 `GET /analytics/races` endpoint, thêm filter:
  - `raceType?: 'ROAD_MARATHON' | 'ROAD_HALF_MARATHON' | 'ULTRA_TRAIL_RACE' | 'TRAIL_RACE'`
  - `tenantId?: number`
  - `from?: string`, `to?: string`
  - `sortBy?: 'gmv' | 'orders' | 'fee' | 'avgPerOrder' | 'voidedPct'` (default `'gmv'`)
  - `sortOrder?: 'asc' | 'desc'` (default `'desc'`)
  - `page?: number`, `limit?: number` (default 12, max 50)
- Response: `{ data: Array<RacePerformanceItem>, total, page, limit, totalPages }`.
- `RacePerformanceItem`: `{ raceId, raceName, merchant, raceType, date, orders, gmv, platformFee, avgPerOrder, voidedPct }`.
- **Cache:** `analytics:metric:race-perf-list:<scope>:<filters-hash>` TTL 900s (current), 86400s (historical).

#### BR-SA-22 — Merchant Comparison Analytics (Tab 3)

**BR-SA-22a — Scatter Data (GMV × Đơn hàng):**
- **Endpoint:** `GET /analytics/merchants/scatter`
- Mỗi merchant = 1 bubble: x = orders, y = gmv, size = gmv proportional.
- Response: `Array<{ tenantId, tenantName, orders, gmv, status }>`.
- Design hiện quadrant labels: ★ HIGH VALUE (top-right), ⚠ LOW ACTIVITY (bottom-left).
- **Cache:** `analytics:metric:merchant-comp-scatter:<scope>:<periodKey>` TTL 900s (current), 86400s (historical).

**BR-SA-22b — Health Distribution:**
- **Endpoint:** `GET /analytics/merchants/health-distribution`
- Response: `Array<{ tier: string, label: string, min: number, max: number, count: number, color: string }>`.
- 5 tiers per BR-SA-07.
- Design hiện horizontal bars, mỗi bar = 1 tier, width proportional, count bên phải.
- **Cache:** `analytics:metric:merchant-comp-dist:<scope>:<periodKey>` TTL 900s (current), 86400s (historical).

**BR-SA-22c — Comparison Table (Full):**
- **Endpoint:** `GET /analytics/merchants/comparison`
- Response: `{ data: Array<MerchantCompItem>, totals: { orders, gmv, fee } }`.
- `MerchantCompItem`: `{ tenantId, tenantName, feeRate, races, orders, gmv, fee, manualPct, voidedPct, status, healthScore }`.
- Design hiện 10 columns sortable: STT, Tên merchant, Fee rate, Số giải, Đơn hàng, GMV, Phí 5BIB, Thủ công %, Huỷ %, Health Score (progress bar).
- Footer row = totals.
- Segmented toggle sort: "GMV" | "Đơn" | "Fee" | "Score ↓".
- **Cache:** `analytics:metric:merchant-comp-table:<scope>:<periodKey>` TTL 900s (current), 86400s (historical).

#### BR-SA-23 — Accordion "Phân tích vận hành chi tiết"

- **Vị trí:** Cuối Tab 1 (Tổng quan), TRƯỚC GA4 section.
- **Mặc định:** Collapsed.
- **Title:** "Phân tích vận hành chi tiết" + badge count "6 chỉ số".
- **Khi mở:** Grid 2-col, 6 panels:
  1. RepeatAthleteRate (F-026)
  2. MerchantChurn (F-026)
  3. TimeToFill (F-026)
  4. ClaimRate (F-026)
  5. GeographicDemographic (F-026)
  6. RefundCancelRate (F-026)
- **Lazy load:** 6 F-026 endpoints CHỈ gọi khi accordion mở.

#### BR-SA-24 — GMV Concentration KPI (Manager Adjustment #6 v3 — Strategic metric)

> Trả lời câu hỏi chiến lược "5BIB phụ thuộc bao nhiêu vào top races?" → leading indicator concentration risk.

- **Vị trí:** Tab 1 Section 1 KPI strip — ADD column thứ 5 (chuyển KPI strip từ 4 cards → 5 cards equal width).
- **Card UI:** Icon Trophy (Lucide) + label "Tập trung GMV" + value "{X}%" + subtitle "Top 5 giải / Tổng GMV".
- **Compute:** Frontend từ existing `/analytics/top-races` data — `sum(top5GmvValues) / totalGmv * 100`. KHÔNG cần backend endpoint mới.
- **Threshold color coding:**
  - X < 50% → green (diversified, healthy).
  - 50-70% → amber (moderate concentration).
  - X > 70% → red ("Concentration risk — top 5 chiếm >70% revenue, cần diversify").
- **Tooltip hover:** "Tập trung càng cao → revenue càng dễ tổn thương nếu top giải hủy."
- **Cache:** No (compute frontend từ data đã cache).

#### BR-SA-25 — AOV (Average Order Value) Trend (Manager Adjustment #6 v3 — Strategic metric)

> Track AOV biến động giúp Pricing/Marketing team biết khi nào nâng giá hoặc cần promotion.

- **Vị trí:** Tab 1 Section 3 (Comparison Row) — ADD metric thứ 5 vào row (chuyển từ 4 comparison cards → 5 cards equal width).
- **Compute:** Frontend từ existing `/analytics/overview` + `/analytics/comparison` — `aov = gmv / orderCount` cho cả current + previous, delta % tính sẵn.
- **Card UI:** Same pattern 4 cards khác — Metric name "AOV" + Current value VND + Previous value struck-through + Delta badge.
- **Format:** VND vi-VN locale (vd: "456,250 đ").
- **NO new endpoint** — pure frontend compute.

#### BR-SA-26 — YoY Merchant Retention (Manager Adjustment #6 v3 — Strategic metric)

> Biz health KPI — merchant retention YoY giúp đánh giá platform stickiness.

- **Vị trí:** Tab 3 Merchant Section 1 KPI strip — ADD KPI thứ 6 vào row "5 KPIs hiện tại + 1 mới".
- **Compute backend:** Extend response `/analytics/alerts/merchant-health` thêm field `yoyRetentionRate: number | null`.
  - **Formula:** `merchant_active_last_year_AND_active_this_year / merchant_active_last_year * 100`.
  - "active" = có ≥1 paid order trong period.
  - "last year" = 365 ngày trước period.
  - Trả `null` nếu không đủ data (< 1 năm).
- **Card UI:** Icon Refresh (Lucide) + label "Giữ chân YoY" + value "{X}%" + subtitle "Merchant active 2025 vs 2026" + delta MoM badge.
- **Threshold color coding:**
  - X > 80% → green (excellent retention).
  - 60-80% → amber.
  - X < 60% → red.
- **Tooltip hover:** "Tỷ lệ merchant active 12 tháng trước vẫn active hiện tại. Industry benchmark SaaS B2B: 80-90%."
- **Cache:** Inherit `analytics:metric:merchant-health:platform:current` TTL 900s (đã có).
- **DTO impact:** Extend `MerchantHealthSummaryDto` thêm 1 field `yoyRetentionRate: number | null`. Backward compat (optional field, frontend cũ ignore).

---

## 📐 Phase 2: UI/UX & Data Flow

### 2.1 Route Structure

| Route | Trang | Access | Mô tả |
|-------|-------|--------|-------|
| `/analytics` | Tab 1: Tổng quan | `LogtoAdminGuard` (staff/admin) | Overview KPI + Revenue + Top Races + Alerts + Merchant + Funnel + GA4 + Accordion |
| `/analytics/races` | Tab 2: Hiệu suất Race | `LogtoAdminGuard` | Filter + Race type chart + Spotlight + Paginated table |
| `/analytics/races/[raceId]` | Race Drill-down | `LogtoAdminGuard` | Per-race detail (đã có F-026) |
| `/analytics/merchants` | Tab 3: Merchant | `LogtoAdminGuard` | Scatter + Health dist + Comparison table |
| `/analytics/runners` | Tab 4: Runner | `LogtoAdminGuard` | Heatmap + Lead time + Repeat + Demo + Geo |
| `/analytics/funnel` | Tab 5: Funnel | `LogtoAdminGuard` | Funnel 5-stage full + detail table |

### 2.2 Layout — Shared Header + Tab Bar

**Breakpoints:**
- Desktop (≥1280px): 12-column grid.
- Tablet (768-1279px): 8-column, stack.
- < 768px: Out of scope Phase 1.

**Shared across ALL tabs:**

**Header Bar** (full width, sticky top, `bg-white border-b`):
- Trái: Title "Vận hành · Analytics" (font-heading, text-2xl, font-bold, `text-stone-900`).
- Giữa: GranularityToggle SegmentedControl (`"Ngày" | "Tuần" | "Tháng"`) — chỉ visible ở Tab 1.
- Phải cụm: Period dropdown ("30 ngày qua" label) + Compare dropdown ("MoM" label) + "Xuất báo cáo" button (icon Download, primary blue).

**Tab Bar** (full width, dưới header, `border-b border-stone-200`):
- 5 tabs horizontal: `['Tổng quan', 'Hiệu suất Race', 'Merchant', 'Runner', 'Funnel']`.
- Active tab: `text-blue-600 border-b-2 border-blue-600 font-semibold`.
- Inactive: `text-stone-500 hover:text-stone-700`.
- Click tab → `router.push('/analytics/{tab-slug}')`.
- URL search params persist: `?period=30d&granularity=daily&compare=mom`.

---

### 2.3 Tab 1: Tổng quan — Layout + UI Steps

**Layout flow (desktop, top-to-bottom):**

**Section 1 — KPI Strip** (full width, **5 equal columns** v3, `gap-4`)
- **5 `KpiCard`** (v3 — Manager Adjustment #6 added GMV Concentration):
  1. **GMV** (Banknote icon, --5s-blue accent)
  2. **Net Revenue** (TrendingUp, green-600)
  3. **Platform Fee** (Receipt, purple-600)
  4. **Orders** (ShoppingCart, orange-500)
  5. **GMV Concentration** (Trophy icon — per BR-SA-24) — "Top 5 giải / Tổng GMV"
- Mỗi card: Icon 20px muted top-left → Label 14px `text-stone-500` → Value 28px JetBrains Mono bold → Delta badge 12px (green/red rounded-full) → Subtitle "so với {compare label}" 11px `text-stone-400`.
- Skeleton: 5 cards shimmer, height 120px.

**Section 2 — Revenue Row** (2/3 + 1/3, `gap-4`)
- Trái (col-span-8): Revenue Trend AreaChart.
  - Height 320px, `bg-white rounded-xl border p-4 shadow-sm`.
  - X-axis: DD/MM (daily), Tuần WW (weekly), Tháng MM/YYYY (monthly).
  - Y-axis trái: VND (GMV area blue-100/blue-500 + Net Revenue line green-500).
  - Y-axis phải: Orders (dashed amber-500).
  - Legend below, horizontal, clickable toggle.
  - Tooltip: vertical crosshair + data formatted.
  - **30 data points** default (daily), 12 (weekly/monthly).
- Phải (col-span-4): Category DonutChart.
  - Height 320px, ring chart.
  - 6 segments: ORDINARY blue-500, MANUAL amber-500, CHANGE_COURSE sky-500, INSURANCE emerald-500, GROUP_BUY purple-500, PERSONAL_GROUP teal-500.
  - Center: tổng GMV format VND, 2 dòng.
  - Legend below vertical: label VN + % + VND.

**Section 3 — Comparison Row** (full width)
- SegmentedControl: `['WoW', 'MoM', 'YoY']`, default MoM (sync state với header CompareSelector).
- **5 comparison cards** inline equal width (v3 — Manager Adjustment #6 added AOV):
  - Metric name 14px → Current value 20px bold → Previous value 14px muted struck-through → Delta badge 16px prominent.
  - Metrics: GMV, Net Revenue, Phí 5BIB, Đơn hàng, **AOV** (per BR-SA-25 — `gmv / orderCount` formatted VND).

**Section 4 — Top Races + Alerts** (1/2 + 1/2, `gap-4`)
- Trái (col-span-6): Top Races.
  - Segmented toggle: `"Theo GMV" | "Theo đơn"`.
  - Table 5 rows: #, Tên giải, BTC (merchant name), GMV hoặc Đơn hàng, Fill Rate (progress bar %), Link arrow.
  - Click race name → navigate `/analytics/races/{raceId}`.
- Phải (col-span-6): Alerts Panel.
  - Title "Giải chạy cần chú ý" + badge count.
  - Max 4 alert cards visible, scrollable.
  - Mỗi card: left border strip 4px (red CRITICAL, amber WARNING) → Race name + BTC → Alert type VN → Metrics row (Fill rate, Còn X slot, WoW%).
  - Empty state: "Tất cả giải chạy đang vận hành tốt" + CheckCircle icon xanh.

**Section 5 — Merchant Health Overview** (full width)
- Top row: Summary strip 4 count cards inline: Active (green dot), At Risk (amber dot), Churned (red dot), New (blue dot).
- Toggle: `"30 ngày" | "60 ngày" | "90 ngày"`.
- Table below: 8 columns: Merchant, Trạng thái (badge), Health Score (progress bar color-coded), Đơn 30d/60d/90d, GMV 30d, Đơn cuối.
- Click merchant row → navigate `/analytics/merchants?tenantId={id}`.

**Section 6 — Order Funnel Overview** (full width)
- Title "Phễu đơn hàng".
- Horizontal bars 5 stages (proportional width):
  - Khởi tạo (gray-300) → Đã thanh toán (blue-500) → Hoàn thành (green-500) → Bị hủy (red-400) → Refunded (orange-400).
- Mỗi bar: count label + % conversion.
- "Xem bảng số liệu" ghost button → navigate Tab 5.

**Section 7 — Accordion F-026** (full width)
- Title: "Phân tích vận hành chi tiết" + badge "6 chỉ số".
- Default: collapsed (ChevronDown icon).
- Expand: grid 2-col, 6 panels lazy load.

**Section 8 — GA4 Web Traffic** (full width)
- Title: "Lưu lượng truy cập (GA4)" + badge "Beta".
- Nếu `available === false`: placeholder card.
- Nếu available: 4 KPI cards (Sessions, Pageviews, Bounce Rate, Avg Duration) + sparkline + top pages + traffic sources.

#### 2.3.1 Tab 1 UI Step-by-Step

| # | Hành động người dùng | Kết quả hiển thị | API trigger | Next state |
|---|---------------------|------------------|-------------|------------|
| 1 | Admin click menu "Analytics" sidebar | Navigate `/analytics`. Skeleton toàn bộ 8 sections. Tab "Tổng quan" active. Header: Period "30 ngày qua", Compare "MoM", Granularity "Ngày". | `GET /analytics/overview`, `GET /analytics/revenue/daily`, `GET /analytics/revenue-by-category`, `GET /analytics/comparison?compareWith=mom`, `GET /analytics/top-races`, `GET /analytics/top-races-by-orders`, `GET /analytics/alerts/races-need-attention`, `GET /analytics/alerts/merchant-health`, `GET /analytics/funnel` | Data rendered |
| 2 | Admin click Granularity "Tuần" | Revenue chart skeleton → weekly data. X-axis label tuần. Granularity highlight "Tuần". | `GET /analytics/revenue/weekly?from=...&to=...` | Chart reloaded |
| 3 | Admin click Granularity "Tháng" | Revenue chart skeleton → monthly data. X-axis label tháng. | `GET /analytics/revenue/monthly?from=...&to=...` | Chart reloaded |
| 4 | Admin click Period dropdown → select "Quý này" | Tất cả sections reload. URL params update `?period=quarter`. | Re-fetch ALL endpoints với from/to quý | All reloaded |
| 5 | Admin click Compare dropdown → select "YoY" | Comparison Row tab YoY active. KPI delta % update. | `GET /analytics/comparison?compareWith=yoy` | Comparison updated |
| 6 | Admin click toggle "Theo đơn" trong Top Races | Table switch → data sort by orders. | `GET /analytics/top-races-by-orders?...` | Table switched |
| 7 | Admin click race name "VnExpress Marathon 2026" | Navigate `/analytics/races/{raceId}`. Breadcrumb update. | `GET /analytics/races/{raceId}/detail` | Drill-down page |
| 8 | Admin click "Xuất báo cáo" button → dropdown "Export Excel" | Button disabled "Đang xuất...". Toast "Đang tạo file báo cáo...". File download. Toast success. | `GET /analytics/export?format=xlsx&reportType=overview&from=...&to=...` | File downloaded |
| 9 | Admin click accordion "Phân tích vận hành chi tiết" | Accordion slide-down 200ms. 6 panels render (lazy). | 6 F-026 endpoints | Accordion open |
| 10 | Admin click accordion lại | Accordion collapse 200ms. | None | Accordion closed |
| 11 | Admin scroll tới GA4 section (chưa config) | GA4 placeholder: "GA4 chưa được cấu hình. Liên hệ admin để kết nối Google Analytics." | `GET /analytics/ga4/overview` → `{ available: false }` | Placeholder shown |
| 12 | Admin click merchant row "Thành An Media" | Navigate `/analytics/merchants?tenantId=42`. Tab "Merchant" active. | Navigation only | Merchant tab |

#### 2.3.2 Tab 1 Buttons Specification

| # | Button label | Vị trí | Kiểu | Default state | Disabled state | Loading state | Action | Confirm? |
|---|-------------|--------|------|---------------|----------------|---------------|--------|----------|
| 1 | "Ngày" | Header Granularity | SegmentedControl item | Active (blue bg) | Đang loading chart | N/A | Switch revenue → daily | NO |
| 2 | "Tuần" | Header Granularity | SegmentedControl item | Inactive | Đang loading chart | N/A | Switch revenue → weekly | NO |
| 3 | "Tháng" | Header Granularity | SegmentedControl item | Inactive | Đang loading chart | N/A | Switch revenue → monthly | NO |
| 4 | Period dropdown | Header right | Select (shadcn) | "30 ngày qua" | Đang loading | N/A | Change period filter | NO |
| 5 | Compare dropdown | Header right | Select (shadcn) | "MoM" | Đang loading | N/A | Change compare type | NO |
| 6 | "Xuất báo cáo" | Header right | DropdownMenu Button primary | Enabled, icon Download | Đang export | Spinner + "Đang xuất..." | Open dropdown | NO |
| 7 | "Export Excel" | Dropdown item | MenuItem | Enabled | Đang export | N/A | Trigger xlsx download | NO |
| 8 | "Export CSV" | Dropdown item | MenuItem | Enabled | Đang export | N/A | Trigger csv download | NO |
| 9 | "Theo GMV" | Top Races toggle | SegmentedControl item | Active | N/A | N/A | Switch top races → GMV sort | NO |
| 10 | "Theo đơn" | Top Races toggle | SegmentedControl item | Inactive | N/A | N/A | Switch top races → orders sort | NO |
| 11 | "WoW" | Comparison Row | SegmentedControl item | Inactive | Loading | N/A | Fetch WoW comparison | NO |
| 12 | "MoM" | Comparison Row | SegmentedControl item | Active | Loading | N/A | Fetch MoM comparison | NO |
| 13 | "YoY" | Comparison Row | SegmentedControl item | Inactive | Loading | N/A | Fetch YoY comparison | NO |
| 14 | Accordion toggle | Section 7 header | Ghost button | ChevronDown icon | N/A | N/A | Toggle expand/collapse | NO |
| 15 | Race name link | Top Races table | Text link blue-600 | Enabled | N/A | N/A | Navigate drill-down | NO |
| 16 | Merchant name link | Merchant Health table | Text link blue-600 | Enabled | N/A | N/A | Navigate merchant tab | NO |
| 17 | "30 ngày" / "60 ngày" / "90 ngày" | Merchant section toggle | SegmentedControl | "30 ngày" active | N/A | N/A | Filter merchant by period | NO |
| 18 | "Xem bảng số liệu" | Funnel section footer | Ghost button + ChevronDown icon | Enabled | N/A | N/A | Navigate Tab 5 Funnel | NO |

#### 2.3.3 Tab 1 Form Fields

| # | Field name | UI label | Type | Options | Default | Validation |
|---|-----------|----------|------|---------|---------|------------|
| 1 | `granularity` | (SegmentedControl) | segmented | "Ngày" \| "Tuần" \| "Tháng" | "Ngày" | Required, persist in URL |
| 2 | `period` | "Khoảng thời gian" | select | "7 ngày qua" \| "30 ngày qua" \| "Quý này" \| "Năm nay" \| "12 tháng rolling" | "30 ngày qua" | Required |
| 3 | `compareWith` | "So sánh" | select | "Tuần trước (WoW)" \| "Tháng trước (MoM)" \| "Cùng kỳ năm trước (YoY)" \| "Không so sánh" | "Tháng trước (MoM)" | Required |
| 4 | `exportFormat` | (Menu item) | menu | "Excel" \| "CSV" | N/A | Required khi export |
| 5 | `topRacesSort` | (SegmentedControl) | segmented | "Theo GMV" \| "Theo đơn" | "Theo GMV" | Required |
| 6 | `comparisonTab` | (SegmentedControl) | segmented | "WoW" \| "MoM" \| "YoY" | "MoM" | Required |
| 7 | `merchantPeriod` | (SegmentedControl) | segmented | "30 ngày" \| "60 ngày" \| "90 ngày" | "30 ngày" | Required |

#### 2.3.4 Tab 1 Field Source Table

| # | UI Field | API Endpoint | Response Field | Transform |
|---|----------|-------------|---------------|-----------|
| 1 | KPI GMV | `/analytics/overview` | `gmv` | `formatVnd()` |
| 2 | KPI Net Revenue | `/analytics/overview` | `netGmv` | `formatVnd()` |
| 3 | KPI Platform Fee | `/analytics/overview` | `platformFee` | `formatVnd()` |
| 4 | KPI Orders | `/analytics/overview` | `orderCount` | `formatNumber()` |
| 4b | **KPI GMV Concentration** (v3 — BR-SA-24) | `/analytics/top-races` | computed frontend: `sum(top5.gmv) / total.gmv * 100` | `formatPct(0)`, threshold color (green<50% / amber 50-70% / red>70%) |
| 4c | **Comparison AOV current** (v3 — BR-SA-25) | `/analytics/overview` | computed: `gmv / orderCount` | `formatVnd()` |
| 4d | **Comparison AOV previous** (v3 — BR-SA-25) | `/analytics/comparison` | computed: `previous.gmv / previous.orderCount` | `formatVnd()` |
| 4e | **Comparison AOV delta** (v3 — BR-SA-25) | computed frontend | `(currentAov - prevAov) / prevAov * 100` | `formatPct()`, badge color |
| 5 | KPI GMV delta | `/analytics/comparison` | `delta.gmvPct` | `formatPct()`, badge color |
| 6 | KPI Net delta | `/analytics/comparison` | `delta.netGmvPct` | `formatPct()`, badge color |
| 7 | KPI Fee delta | `/analytics/comparison` | `delta.platformFeePct` | `formatPct()`, badge color |
| 8 | KPI Orders delta | `/analytics/comparison` | `delta.orderCountPct` | `formatPct()`, badge color |
| 9 | Revenue chart daily | `/analytics/revenue/daily` | Array `{ date, gmv, netGmv, orderCount }` | X: `DD/MM` |
| 10 | Revenue chart weekly | `/analytics/revenue/weekly` | Array `{ week, weekStart, gmv, netGmv, platformFee, orderCount }` | X: `Tuần WW` |
| 11 | Revenue chart monthly | `/analytics/revenue/monthly` | Array `{ month, gmv, netGmv, platformFee, orderCount }` | X: `Tháng MM/YYYY` |
| 12 | Category donut | `/analytics/revenue-by-category` | Array `{ category, count, gmv }` | Label VN per BR-SA-17 |
| 13 | Comparison current | `/analytics/comparison` | `current.*` | `formatVnd()` / `formatNumber()` |
| 14 | Comparison previous | `/analytics/comparison` | `previous.*` | `formatVnd()` / `formatNumber()` |
| 15 | Comparison delta | `/analytics/comparison` | `delta.*` | `formatPct()`, badge color |
| 16 | Top Races GMV | `/analytics/top-races` | Array `{ raceId, raceName, gmv, fillRate }` | GMV: `formatVnd()`, fillRate: progress bar |
| 17 | Top Races Orders | `/analytics/top-races-by-orders` | Array `{ raceId, raceName, orderCount, fillRate }` | fillRate: progress bar |
| 18 | Alerts list | `/analytics/alerts/races-need-attention` | `alerts[]` | alertType VN, severity badge |
| 19 | Merchant summary | `/analytics/alerts/merchant-health` | `summary.*`, `activeCount.*` | `formatNumber()` |
| 20 | Merchant table | `/analytics/alerts/merchant-health` | `merchants[]` | status VN, healthScore progress bar |
| 21 | Funnel data | `/analytics/funnel` | 5 stages | Conversion % calc frontend |
| 22 | GA4 Sessions | `/analytics/ga4/overview` | `sessions` | `formatNumber()` |
| 23 | GA4 Pageviews | `/analytics/ga4/overview` | `pageviews` | `formatNumber()` |
| 24 | GA4 Bounce Rate | `/analytics/ga4/overview` | `bounceRate` | `formatPct()` |
| 25 | GA4 Avg Duration | `/analytics/ga4/overview` | `avgSessionDuration` | `formatDuration()` (mm:ss) |
| 26 | GA4 Top Pages | `/analytics/ga4/overview` | `topPages[]` | Truncate pagePath |
| 27 | GA4 Traffic Sources | `/analytics/ga4/overview` | `trafficSources[]` | -- |
| 28 | GA4 Daily Sessions | `/analytics/ga4/overview` | `dailySessions[]` | Sparkline chart |

---

### 2.4 Tab 2: Hiệu suất Race — Layout + UI Steps

**Page title:** "Hiệu suất Race" (font-heading, text-xl).
**Breadcrumbs:** `Vận hành > Analytics > Hiệu suất Race`.

**Layout flow:**

**Section 1 — Filter Bar** (full width, `bg-white rounded-xl border p-4`)
- Row inline:
  - Date range: 2 DatePicker inputs ("Từ" + "Đến"), default 30 ngày qua.
  - Race type chips: `['Tất cả loại', 'Marathon đường bộ', 'Bán Marathon', 'Ultra Trail', 'Trail']`, multi-select chips, default "Tất cả loại" selected.
  - Merchant dropdown: Select searchable, all merchants, default "Tất cả BTC".
  - Count label: "Hiển thị {filtered}/{total} giải" (text-sm text-stone-400).

**Section 2 — GMV by Race Type** (full width, `bg-white rounded-xl border p-4`)
- Title: "GMV theo loại giải" (text-lg font-semibold).
- Horizontal bar chart, 4 bars:
  - ROAD_MARATHON → "Marathon đường bộ" (blue-500)
  - ROAD_HALF_MARATHON → "Bán Marathon đường bộ" (sky-400)
  - ULTRA_TRAIL_RACE → "Ultra Trail" (amber-500)
  - TRAIL_RACE → "Trail" (green-500)
- Mỗi bar: GMV label formatted VND bên phải.

**Section 3 — Spotlight** (full width, `bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-6`)
- Title: "Spotlight #1" badge + race name (text-xl bold).
- 4 metric cards inline: GMV, Đơn hàng, Trung bình/đơn, Phí 5BIB.
- Insight text dưới: "Đóng góp {X}% tổng GMV, trung bình {Y} VND/đơn. {raceType VN label}."

**Section 4 — Race Table** (full width, `bg-white rounded-xl border`)
- Sort dropdown top-right: "GMV (cao nhất)" default.
- Table 10 columns:

| Cột | Header | Width | Data | Format |
|-----|--------|-------|------|--------|
| 1 | # | 40px | Row index | Number |
| 2 | Tên giải | 200px min | `raceName` | Text, link blue-600 |
| 3 | BTC | 150px | `merchant` | Text |
| 4 | Loại | 120px | `raceType` | Badge VN label |
| 5 | Ngày | 100px | `date` | DD/MM/YYYY |
| 6 | Đơn hàng | 90px | `orders` | Number right-align |
| 7 | GMV | 120px | `gmv` | VND right-align |
| 8 | Phí 5BIB | 100px | `platformFee` | VND right-align |
| 9 | TB/đơn | 100px | `avgPerOrder` | VND right-align |
| 10 | Huỷ % | 80px | `voidedPct` | `X%` right-align, red nếu > 10% |

- Pagination bottom: "Hiển thị {from}-{to} trên {total} giải" + Prev/Page numbers/Next buttons.
- Default: page 1, limit 12, sort GMV desc.

#### 2.4.1 Tab 2 UI Step-by-Step

| # | Hành động | Kết quả | API trigger | Next state |
|---|-----------|---------|-------------|------------|
| 1 | Admin click tab "Hiệu suất Race" | Navigate `/analytics/races`. Skeleton 4 sections. Filter bar default values. | `GET /analytics/races/type-distribution`, `GET /analytics/races/spotlight`, `GET /analytics/races/performance?page=1&limit=12&sortBy=gmv&sortOrder=desc` | Data rendered |
| 2 | Admin click chip "Ultra Trail" | Chip highlight blue. Table + chart reload filtered. Count update. | Re-fetch all 3 endpoints with `raceType=ULTRA_TRAIL_RACE` | Filtered data |
| 3 | Admin select merchant "Thành An Media" | Dropdown show selected. Reload filtered. | Re-fetch with `tenantId=42` | Filtered |
| 4 | Admin change date "Từ" → "01/01/2026" | Date picker close. Reload filtered. | Re-fetch with `from=2026-01-01` | Filtered |
| 5 | Admin click sort dropdown → "Đơn hàng (cao nhất)" | Table re-sort by orders desc. | `GET /analytics/races/performance?sortBy=orders&sortOrder=desc` | Re-sorted |
| 6 | Admin click page "2" | Table show rows 13-24. | `GET /analytics/races/performance?page=2` | Page 2 |
| 7 | Admin click race name "VMM 2026" | Navigate `/analytics/races/{raceId}`. | Drill-down page | Navigate |

#### 2.4.2 Tab 2 Buttons

| # | Button | Vị trí | Kiểu | Default | Disabled | Action | Confirm? |
|---|--------|--------|------|---------|----------|--------|----------|
| 1 | Race type chips | Filter bar | Toggle chips | "Tất cả loại" selected | N/A | Toggle filter raceType | NO |
| 2 | Merchant select | Filter bar | Select searchable | "Tất cả BTC" | N/A | Filter tenantId | NO |
| 3 | Date "Từ" | Filter bar | DatePicker | 30 ngày trước | N/A | Set from date | NO |
| 4 | Date "Đến" | Filter bar | DatePicker | Today | N/A | Set to date | NO |
| 5 | Sort dropdown | Table top-right | Select | "GMV (cao nhất)" | N/A | Change sort | NO |
| 6 | Pagination buttons | Table bottom | Buttons | Page 1 active | First/Last page | Navigate pages | NO |
| 7 | Race name link | Table col 2 | Text link | Enabled | N/A | Navigate drill-down | NO |
| 8 | "Xuất CSV" | Header right (shared) | Menu item | Enabled | Exporting | Export races data | NO |
| 9 | "Lọc nâng cao" | Header right, trước "Xuất CSV" | Secondary + Filter icon | Enabled | N/A | Toggle advanced filter panel (collapse/expand) | NO |

#### 2.4.3 Tab 2 Form Fields

| # | Field | UI label | Type | Required | Validation | Default |
|---|-------|----------|------|----------|------------|---------|
| 1 | `from` | Từ | DatePicker | ⚪ | Date format YYYY-MM-DD, ≤ `to` | 30 ngày trước |
| 2 | `to` | Đến | DatePicker | ⚪ | Date format YYYY-MM-DD, ≥ `from`, ≤ today | Today |
| 3 | `raceType` | (chips) | multi-select | ⚪ | enum values only | "Tất cả loại" |
| 4 | `tenantId` | BTC | select searchable | ⚪ | valid tenant ID | null (all) |
| 5 | `sortBy` | (dropdown) | select | ✅ | `'gmv'|'orders'|'fee'|'avgPerOrder'|'voidedPct'` | `'gmv'` |
| 6 | `sortOrder` | (implicit) | hidden | ✅ | `'asc'|'desc'` | `'desc'` |
| 7 | `page` | (pagination) | number | ✅ | ≥1, ≤totalPages | 1 |
| 8 | `limit` | (hidden) | number | ✅ | 12 default, max 50 | 12 |

#### 2.4.4 Tab 2 Field Sources

| # | UI Field | API Endpoint | Response Field | Transform |
|---|----------|-------------|---------------|-----------|
| 1 | Race type bars | `/analytics/races/type-distribution` | Array `{ raceType, count, gmv }` | raceType → VN label, gmv → `formatVnd()` |
| 2 | Spotlight race | `/analytics/races/spotlight` | `{ raceName, gmv, orders, avgPerOrder, platformFee, insight }` | All money → `formatVnd()` |
| 3 | Table data | `/analytics/races/performance` | `data[]` | raceType badge VN, money → `formatVnd()`, voidedPct → `formatPct()` |
| 4 | Table pagination | `/analytics/races/performance` | `{ total, page, limit, totalPages }` | "Hiển thị {from}-{to} trên {total} giải" |
| 5 | Filter count | computed | `data.length` vs `total` from unfiltered | "Hiển thị {filtered}/{total} giải" |

---

### 2.5 Tab 3: Merchant — Layout + UI Steps

**Page title:** "So sánh Merchant" (font-heading, text-xl).
**Breadcrumbs:** `Vận hành > Analytics > Merchant`.

**Layout flow:**

**Section 1 — KPI Strip** (full width, **6 equal columns** v3 — Manager Adjustment #6 added YoY Retention)
- 6 KPI cards:
  1. Tổng merchants: count (font-mono bold).
  2. Hoạt động (30d): count + "X%" of total (green badge).
  3. Có nguy cơ: count (amber badge).
  4. Avg fee rate: "X.XX%" (font-mono).
  5. Top merchant: "{name} · {X}% GMV" (truncate name).
  6. **Giữ chân YoY** (per BR-SA-26 v3) — "{X}%" (Refresh icon, color tier-coded green/amber/red). Hiện "—" nếu YoY data chưa có (< 1 năm period).

**Section 2 — Scatter Chart** (full width, `bg-white rounded-xl border p-4`, height 400px)
- Title: "GMV × Đơn hàng" (text-lg font-semibold).
- X-axis: "Đơn hàng" (count).
- Y-axis: "GMV (VND)".
- Mỗi merchant = 1 circle, radius proportional to GMV.
- Quadrant labels (text-xs text-stone-300):
  - Top-right: "★ HIGH VALUE"
  - Bottom-left: "⚠ LOW ACTIVITY"
- Tooltip hover: merchant name + orders + GMV.
- Status color: ACTIVE green, AT_RISK amber, CHURNED red, ALERT red (bất thường — merchant có anomaly metric vượt ngưỡng, vd voided rate > 5% hoặc fee = 0 nhưng có đơn).

**Section 3 — Health Distribution** (full width, `bg-white rounded-xl border p-4`)
- Title: "Phân bố Health Score".
- 5 horizontal bars (tier stacked):
  - 80-100 "Xuất sắc" green — count bên phải.
  - 60-79 "Tốt" blue — count.
  - 40-59 "Trung bình" amber — count.
  - 20-39 "Yếu" orange — count.
  - 0-19 "Nguy cơ" red — count.
- Bar width proportional to count.

**Section 4 — Comparison Table** (full width, `bg-white rounded-xl border`)
- Segmented toggle sort: `"GMV" | "Đơn" | "Fee" | "Score ↓"`, default "Score ↓".
- Table 10 columns:

| Cột | Header | Width | Data | Format |
|-----|--------|-------|------|--------|
| 1 | STT | 40px | Row index | Number |
| 2 | Tên merchant | 180px | `tenantName` | Text, link |
| 3 | Fee rate | 80px | `feeRate` | `X%` mono |
| 4 | Số giải | 70px | `races` | Number |
| 5 | Đơn hàng | 90px | `orders` | Number right-align |
| 6 | GMV | 120px | `gmv` | VND right-align |
| 7 | Phí 5BIB | 100px | `fee` | VND right-align |
| 8 | Thủ công % | 80px | `manualPct` | `X%`, amber nếu > 20% |
| 9 | Huỷ % | 80px | `voidedPct` | `X%`, red nếu > 10% |
| 10 | Health Score | 100px | `healthScore` | Progress bar + number, color per tier |

- Footer totals row: Tổng đơn, Tổng GMV, Tổng phí.
- Status dot per row (green/amber/red).

#### 2.5.1 Tab 3 UI Step-by-Step

| # | Hành động | Kết quả | API trigger | Next state |
|---|-----------|---------|-------------|------------|
| 1 | Admin click tab "Merchant" | Navigate `/analytics/merchants`. Skeleton 4 sections. | `GET /analytics/merchants/scatter`, `GET /analytics/merchants/health-distribution`, `GET /analytics/merchants/comparison`, `GET /analytics/alerts/merchant-health` (KPIs) | Data rendered |
| 2 | Admin hover bubble "Thành An Media" trong scatter | Tooltip: "Thành An Media — 2,847 đơn — 382.5M VND" | None (frontend hover) | Tooltip shown |
| 3 | Admin click sort toggle "GMV" | Table re-sort by GMV desc. | Frontend sort (data already loaded) | Re-sorted |
| 4 | Admin click sort toggle "Score ↓" | Table re-sort by healthScore asc. | Frontend sort | Re-sorted |
| 5 | Admin click merchant name "VPBank Run" | Navigate `/analytics/merchants?tenantId=X` or drill-down. | TBD | Navigate |

#### 2.5.2 Tab 3 Buttons

| # | Button | Vị trí | Kiểu | Default | Action |
|---|--------|--------|------|---------|--------|
| 1 | Sort segmented | Table header | SegmentedControl | "Score ↓" | Switch sort column |
| 2 | Merchant name link | Table col 2 | Text link | Enabled | Navigate detail |
| 3 | "Xuất CSV" | Header (shared) | Menu item | Enabled | Export merchants data |

#### 2.5.3 Tab 3 Field Sources

| # | UI Field | API Endpoint | Response Field | Transform |
|---|----------|-------------|---------------|-----------|
| 1 | KPI Tổng merchants | `/analytics/alerts/merchant-health` | `summary.total` | `formatNumber()` |
| 2 | KPI Hoạt động 30d | `/analytics/alerts/merchant-health` | `activeCount.d30` + `summary.total` | count + pct |
| 3 | KPI Có nguy cơ | `/analytics/alerts/merchant-health` | `summary.atRisk` | count |
| 4 | KPI Avg fee rate | `/analytics/merchants/comparison` | computed: avg `feeRate` | `formatPct(2)` |
| 5 | KPI Top merchant | `/analytics/merchants/comparison` | `data[0]` by GMV | name + pct of total GMV |
| 6 | **KPI Giữ chân YoY** (v3 — BR-SA-26) | `/analytics/alerts/merchant-health` | `yoyRetentionRate` (number \| null) | `formatPct(1)`, color tier-coded; "—" if null |
| 7 | Scatter bubbles | `/analytics/merchants/scatter` | Array `{ tenantName, orders, gmv, status }` | gmv → radius scale |
| 7 | Health distribution | `/analytics/merchants/health-distribution` | Array `{ tier, label, count }` | bar width proportional |
| 8 | Comparison table | `/analytics/merchants/comparison` | `data[]` | money → VND, pct → %, score → progress bar |
| 9 | Table totals | `/analytics/merchants/comparison` | `totals` | `formatVnd()` |

---

### 2.6 Tab 4: Runner (Hành vi Runner) — Layout + UI Steps

**Page title:** "Hành vi Runner" (font-heading, text-xl).
**Breadcrumbs:** `Vận hành > Analytics > Hành vi Runner`.

**Header custom cho Tab 4:**
- Trái: Title.
- Phải: Period dropdown "Tháng 5/2026" + "Xuất CSV" button.
- **LƯU Ý:** Tab 4 dùng period riêng (theo tháng), KHÔNG share granularity control Tab 1.

**Layout flow:**

**Section 1 — KPI Strip** (full width, 4 equal columns)
- 4 KPI cards:
  - **Unique Runners:** count (font-mono 28px bold) + delta MoM badge.
  - **Repeat rate:** `X.X%` + delta MoM badge.
  - **Avg lead time:** `X ngày` + delta MoM badge.
  - **Avg đơn/runner:** `X.XX` + delta MoM badge.
- Skeleton: 4 cards shimmer.

**Section 2 — Booking Heatmap** (full width, `bg-white rounded-xl border p-4`)
- Title: "Thời điểm đặt vé" (text-lg font-semibold).
- Grid 7 rows × 24 columns.
- Rows (trái): CN, T2, T3, T4, T5, T6, T7.
- Columns (top): 0, 1, 2, ..., 23.
- Mỗi ô: square `w-5 h-5` with background intensity:
  - 0: `bg-stone-50`
  - 1-5: `bg-blue-50`
  - 6-15: `bg-blue-100`
  - 16-30: `bg-blue-200`
  - 31-50: `bg-blue-300`
  - 51+: `bg-blue-500 text-white`
- Tooltip hover: "T3 14h: 42 đơn".
- Legend bottom: gradient scale 6 levels.

**Section 3 — Lead Time + Category Mix** (1/2 + 1/2, `gap-4`)
- Trái (col-span-6): Category Mix Donut.
  - Title: "Phân bổ loại đơn".
  - Ring chart: Thường 93%, Thủ công 6%, Đổi cự ly 1%, Bảo hiểm 0%.
  - Colors: ORDINARY blue, MANUAL amber, CHANGE_COURSE sky, INSURANCE emerald.
- Phải (col-span-6): Lead Time Histogram.
  - Title: "Thời gian đặt trước race".
  - 5 horizontal bars, height proportional:
    - 0-7d "Last-minute" red-400 → `X%` label.
    - 8-30d "Cận race" amber-400 → `X%`.
    - 31-60d "Lập kế hoạch" blue-400 → `X%`.
    - 61-120d "Early bird" green-400 → `X%`.
    - 120d+ "Super early" purple-400 → `X%`.
  - Insight box dưới (`bg-amber-50 border-amber-200 rounded-lg p-3`):
    - Text: "28% runner đặt 31-60 ngày trước — nhóm lớn nhất. 8% đặt last-minute, cần chiến lược giá sớm."

**Section 4 — Repeat Cohort** (full width, `bg-white rounded-xl border p-4`)
- Title: "Tần suất tham gia" (text-lg font-semibold).
- Stacked horizontal bar (full width):
  - 1 giải (gray-300) + 2 giải (blue-300) + 3-4 giải (blue-500) + 5+ giải (blue-700).
- List bên dưới, 4 rows:
  - "5+ giải: {count} ({pct}%)" — badge "Trung thành".
  - "3-4 giải: {count} ({pct}%)".
  - "2 giải: {count} ({pct}%)".
  - "1 giải: {count} ({pct}%)".
- Insight warning dưới cùng (`bg-amber-50 rounded-lg p-3`):
  - "83.8% runners chỉ tham gia 1 race — cần loyalty/referral program."

**Section 5 — Demographics** (full width, `bg-white rounded-xl border p-4`)
- Title: "Phân bổ nhân khẩu" (text-lg font-semibold).
- Grouped horizontal bar chart, 6 age brackets:
  - 18-24, 25-34, 35-44, 45-54, 55-64, 65+.
  - Mỗi bracket: 4 bars side-by-side (Nam blue, Nữ pink, Khác gray, Không rõ stone-200).
- Legend top-right: "Nam {count} ({pct}%)" blue, "Nữ {count} ({pct}%)" pink, "Khác" gray, "Không rõ" stone.

**Section 6 — Geographic** (full width, `bg-white rounded-xl border p-4`)
- Title: "Phân bổ địa lý" (text-lg font-semibold).
- Top 8 provinces horizontal bar chart:
  - Mỗi bar: province name + percentage + count.
  - Colors: gradient blue-600 → blue-200 (cao → thấp).
- Coverage text dưới: "Phủ sóng {coverage}% tổng runner có thông tin tỉnh thành."

#### 2.6.1 Tab 4 UI Step-by-Step

| # | Hành động | Kết quả | API trigger | Next state |
|---|-----------|---------|-------------|------------|
| 1 | Admin click tab "Runner" | Navigate `/analytics/runners`. Skeleton 6 sections. Period default tháng hiện tại. | `GET /analytics/runners/summary`, `GET /analytics/runners/booking-heatmap`, `GET /analytics/runners/lead-time`, `GET /analytics/runners/repeat-cohort`, `GET /analytics/runners/demographics`, `GET /analytics/runners/geographic`, `GET /analytics/revenue-by-category` | Data rendered |
| 2 | Admin change period → "Tháng 4/2026" | All 7 sections reload with April data. | Re-fetch all 7 endpoints with `from=2026-04-01&to=2026-04-30` | Updated |
| 3 | Admin hover heatmap ô T3/14h | Tooltip: "Thứ 3, 14:00 — 42 đơn". Background highlight. | None (frontend hover) | Tooltip |
| 4 | Admin click "Xuất CSV" | Download CSV runner behavior data. | `GET /analytics/export?format=csv&reportType=runners&from=...&to=...` | File download |

#### 2.6.2 Tab 4 Buttons

| # | Button | Vị trí | Kiểu | Default | Action |
|---|--------|--------|------|---------|--------|
| 1 | Period dropdown | Header right | Select | Tháng hiện tại | Change period |
| 2 | "Xuất CSV" | Header right | Button outline | Enabled | Export runner data |

#### 2.6.3 Tab 4 Field Sources

| # | UI Field | API Endpoint | Response Field | Transform |
|---|----------|-------------|---------------|-----------|
| 1 | KPI Unique Runners | `/analytics/runners/summary` | `uniqueRunners` | `formatNumber()` |
| 2 | KPI Repeat rate | `/analytics/runners/summary` | `repeatRate` | `formatPct(1)` |
| 3 | KPI Avg lead time | `/analytics/runners/summary` | `avgLeadTimeDays` | `{X} ngày` |
| 4 | KPI Avg đơn/runner | `/analytics/runners/summary` | `avgOrdersPerRunner` | `formatNumber(2)` |
| 5 | KPI deltas | `/analytics/runners/summary` | `delta.*Pct` | `formatPct()`, badge color |
| 6 | Heatmap cells | `/analytics/runners/booking-heatmap` | `grid[day][hour]` | Intensity color |
| 7 | Lead time bars | `/analytics/runners/lead-time` | Array `{ bucket, count, percentage }` | Proportional height |
| 8 | Repeat cohort | `/analytics/runners/repeat-cohort` | Array `{ tier, count, percentage }` | Stacked bar + list |
| 9 | Demographics | `/analytics/runners/demographics` | `brackets[]` + `genderSummary` | Grouped bars |
| 10 | Geographic | `/analytics/runners/geographic` | `provinces[]` + `coverage` | Horizontal bars |
| 11 | Category donut | `/analytics/revenue-by-category` | Array `{ category, count, gmv }` | Ring chart |

---

### 2.7 Tab 5: Funnel — Layout + UI Steps

**Page title:** "Phễu đơn hàng" (font-heading, text-xl).
**Breadcrumbs:** `Vận hành > Analytics > Funnel`.

**Layout flow:**

**Section 1 — Funnel Visual** (full width, `bg-white rounded-xl border p-6`, height 300px)
- 5 horizontal bars, mỗi bar width proportional to count:
  - **Khởi tạo** (gray-400): count + "100%".
  - **Đã thanh toán** (blue-500): count + `X% so với Khởi tạo` — conversion arrow between bars.
  - **Hoàn thành** (green-500): count + `X%`.
  - **Bị hủy** (red-400): count + `X%`.
  - **Refunded** (orange-400): count + `X%`.
- Conversion arrows: between Khởi tạo→Thanh toán: "85.5% chuyển đổi", etc.

**Section 2 — Detail Table** (full width, expandable)
- Default: expanded.
- Table 5 rows (1 per stage):

| Cột | Header | Data | Format |
|-----|--------|------|--------|
| 1 | Giai đoạn | Stage name VN | Text bold |
| 2 | Số lượng | count | Number right-align |
| 3 | % Tổng | `(count / stage1_count) * 100` | `X.X%` |
| 4 | % Chuyển đổi | `(count / prev_stage_count) * 100` | `X.X%`, green nếu > 80%, red nếu < 50% |
| 5 | Thay đổi MoM | delta vs previous month | `+X%` / `-X%` badge |

**Section 3 — Funnel Insights** (full width, `bg-stone-50 rounded-lg p-4`)
- Auto-generated insights:
  - "Tỷ lệ thanh toán {X}% — {đánh giá: tốt/trung bình/cần cải thiện}."
  - "Tỷ lệ hoàn thành {X}% — {đánh giá}."
  - "Tỷ lệ hủy {X}% — {nếu > 15%: 'cao, cần review chính sách hủy'}."
  - "Refund rate {X}% — {nếu > 5%: 'đáng chú ý'}."

#### 2.7.1 Tab 5 UI Step-by-Step

| # | Hành động | Kết quả | API trigger | Next state |
|---|-----------|---------|-------------|------------|
| 1 | Admin click tab "Funnel" | Navigate `/analytics/funnel`. Skeleton. | `GET /analytics/funnel?from=...&to=...` | Data rendered |
| 2 | Admin change period | Funnel reload. | `GET /analytics/funnel?from=...&to=...` (new period) | Updated |
| 3 | Admin click "Xuất CSV" | Download funnel CSV. | `GET /analytics/export?format=csv&reportType=funnel` | File download |

---

### 2.8 UI States (Áp dụng TẤT CẢ 5 tabs)

| # | State | Trigger | Hiển thị |
|---|-------|---------|---------|
| 1 | **Loading** | Page load, chuyển period/granularity/tab | Skeleton shimmer per-section. Charts: skeleton rectangle. Tables: 5 skeleton rows. |
| 2 | **Empty** | Period không có dữ liệu | "Chưa có dữ liệu trong khoảng thời gian này" + icon Package. KPI: "--". Charts: empty message. |
| 3 | **Data** | API thành công | Render đầy đủ sections. |
| 4 | **Filtered + Empty** | Filter cụ thể nhưng no data | "Không tìm thấy dữ liệu cho bộ lọc đã chọn. Thử mở rộng phạm vi." |
| 5 | **Error** | API 4xx/5xx | Toast error "Lỗi tải dữ liệu: {message}". Section lỗi hiện retry card. Các section khác vẫn OK (independent error boundary). |
| 6 | **Exporting** | Click Export | Button disabled "Đang xuất...". Toast progress. |
| 7 | **Export Success** | Download xong | Toast "Tải file {filename} thành công". Button re-enable. |
| 8 | **Export Error** | Export lỗi | Toast error. Button re-enable. |
| 9 | **GA4 Unavailable** | `ga4.available === false` | Placeholder card "GA4 chưa được cấu hình". |
| 10 | **No Alerts** | `alerts = []` | "Tất cả giải chạy đang vận hành tốt" + CheckCircle xanh. |
| 11 | **Comparison No Base** | Previous period trống | "Không có dữ liệu kỳ trước để so sánh". Delta = "--". |
| 12 | **Heatmap Empty** | Không có booking data | Grid toàn bộ `bg-stone-50` + message "Chưa có dữ liệu booking." |
| 13 | **Tab Loading** | Click tab → navigate | Tab content skeleton until API resolves. Tab bar remains interactive. |

---

## ⚙️ Phase 3: Technical Mandates

### 3.1 DB / Cache Changes

#### Database — KHÔNG có schema mới
- Tất cả endpoint mới aggregate từ MySQL `orders` table (platform DataSource) + MongoDB `merchant_configs` + MySQL `athletes` + MySQL `races` — CÙNG data sources.
- KHÔNG cần migration MongoDB hoặc MySQL.

#### Redis Keys Mới

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `analytics:metric:weekly-revenue:<scope>:<periodKey>` | Weekly revenue aggregation | 300s/86400s |
| `analytics:metric:monthly-revenue:<scope>:<periodKey>` | Monthly revenue aggregation | 600s/86400s |
| `analytics:metric:comparison:<scope>:<compareWith>:<periodKey>` | Period comparison | 300s |
| `analytics:metric:top-races-orders:<scope>:<periodKey>` | Top races by orders | 300s |
| `analytics:metric:alerts-races:<scope>:current` | Races need attention | 300s |
| `analytics:metric:merchant-health:platform:current` | Merchant health | 300s |
| `analytics:metric:funnel:<scope>:<periodKey>` | Funnel 5-stage | 300s |
| `analytics:metric:runner-summary:<scope>:<periodKey>` | Runner summary KPIs | 300s |
| `analytics:metric:runner-heatmap:<scope>:<periodKey>` | Booking heatmap | 300s |
| `analytics:metric:runner-leadtime:<scope>:<periodKey>` | Lead time histogram | 300s |
| `analytics:metric:runner-repeat:<scope>:<periodKey>` | Repeat cohort | 300s |
| `analytics:metric:runner-demo:<scope>:<periodKey>` | Demographics | 300s |
| `analytics:metric:runner-geo:<scope>:<periodKey>` | Geographic | 300s |
| `analytics:metric:race-perf-type:<scope>:<periodKey>` | Race type distribution | 300s |
| `analytics:metric:race-perf-spotlight:<scope>:<periodKey>` | Race spotlight | 300s |
| `analytics:metric:race-perf-list:<scope>:<hash>` | Race perf list (filtered) | 300s |
| `analytics:metric:merchant-comp-scatter:<scope>:<periodKey>` | Merchant scatter | 300s |
| `analytics:metric:merchant-comp-dist:<scope>:<periodKey>` | Merchant health dist | 300s |
| `analytics:metric:merchant-comp-table:<scope>:<periodKey>` | Merchant comparison | 300s |
| `analytics:ga4:overview:<periodKey>` | GA4 overview | 600s |

`<scope>` = `platform` hoặc `race:<raceId>`.

#### Environment Variables Mới

| Var | Required | Default | Mô tả |
|-----|----------|---------|-------|
| `GA4_SERVICE_ACCOUNT_KEY_PATH` | Không | -- | Path tới Google Service Account JSON key |
| `GA4_PROPERTY_ID` | Không | -- | GA4 Property ID |

### 3.2 Backend Endpoint Specification Table

> **Giữ nguyên 8 endpoints PRD v1** (Endpoint 1-8: weekly/monthly revenue, comparison, top-races-by-orders, races-need-attention, merchant-health, export, ga4/overview). Xem PRD v1 cho full spec. Dưới đây chỉ liệt kê **endpoints MỚI** cho Tab 2/3/4/5.

#### Endpoint 9: GET /analytics/runners/summary

| Field | Value |
|-------|-------|
| **Method** | GET |
| **Path** | `/analytics/runners/summary` |
| **Guard** | `LogtoAdminGuard` |
| **Query Params** | `AnalyticsQueryDto` (from?, to?, tenantId?) |
| **Success Response** | `200 RunnerSummaryResponseDto` |
| **Error Responses** | 400, 401, 403 |
| **Cache** | `analytics:metric:runner-summary:<scope>:<periodKey>` TTL 900s (current), 86400s (historical) |
| **Note** | Includes MoM delta for each KPI |

#### Endpoint 10: GET /analytics/runners/booking-heatmap

| Field | Value |
|-------|-------|
| **Method** | GET |
| **Path** | `/analytics/runners/booking-heatmap` |
| **Guard** | `LogtoAdminGuard` |
| **Query Params** | `AnalyticsQueryDto` (from?, to?) |
| **Success Response** | `200 BookingHeatmapResponseDto` |
| **Error Responses** | 400, 401, 403 |
| **Cache** | `analytics:metric:runner-heatmap:<scope>:<periodKey>` TTL 900s (current), 86400s (historical) |
| **Note** | Timezone: UTC+7 (Vietnam). `orders.created_at` parsed to dayOfWeek + hourOfDay. |

#### Endpoint 11: GET /analytics/runners/lead-time

| Field | Value |
|-------|-------|
| **Method** | GET |
| **Path** | `/analytics/runners/lead-time` |
| **Guard** | `LogtoAdminGuard` |
| **Query Params** | `AnalyticsQueryDto` (from?, to?) |
| **Success Response** | `200 LeadTimeResponseDto` |
| **Error Responses** | 400, 401, 403 |
| **Cache** | `analytics:metric:runner-leadtime:<scope>:<periodKey>` TTL 900s (current), 86400s (historical) |
| **Note** | Lead time = `race.date - order.created_at` in days. Races without date → exclude. |

#### Endpoint 12: GET /analytics/runners/repeat-cohort

| Field | Value |
|-------|-------|
| **Method** | GET |
| **Path** | `/analytics/runners/repeat-cohort` |
| **Guard** | `LogtoAdminGuard` |
| **Query Params** | `AnalyticsQueryDto` (from?, to?) |
| **Success Response** | `200 RepeatCohortResponseDto` |
| **Error Responses** | 400, 401, 403 |
| **Cache** | `analytics:metric:runner-repeat:<scope>:<periodKey>` TTL 900s (current), 86400s (historical) |
| **Note** | Count distinct `athlete_id` per race count bucket. |

#### Endpoint 13: GET /analytics/runners/demographics

| Field | Value |
|-------|-------|
| **Method** | GET |
| **Path** | `/analytics/runners/demographics` |
| **Guard** | `LogtoAdminGuard` |
| **Query Params** | `AnalyticsQueryDto` (from?, to?) |
| **Success Response** | `200 DemographicsResponseDto` |
| **Error Responses** | 400, 401, 403 |
| **Cache** | `analytics:metric:runner-demo:<scope>:<periodKey>` TTL 900s (current), 86400s (historical) |
| **Data Source** | `athletes.date_of_birth` (MySQL) + `athletes.gender` |
| **Note** | Missing DOB → "Không rõ tuổi" bracket. Missing gender → "Không rõ" category. |

#### Endpoint 14: GET /analytics/runners/geographic

| Field | Value |
|-------|-------|
| **Method** | GET |
| **Path** | `/analytics/runners/geographic` |
| **Guard** | `LogtoAdminGuard` |
| **Query Params** | `AnalyticsQueryDto` (from?, to?, limit? default 8) |
| **Success Response** | `200 GeographicResponseDto` |
| **Error Responses** | 400, 401, 403 |
| **Cache** | `analytics:metric:runner-geo:<scope>:<periodKey>` TTL 900s (current), 86400s (historical) |
| **Data Source** | `athletes.province` hoặc `orders.billing_province` |
| **Note** | Missing province → excluded from top list. Coverage = hasProvince / total. |

#### Endpoint 15: GET /analytics/races/type-distribution

| Field | Value |
|-------|-------|
| **Method** | GET |
| **Path** | `/analytics/races/type-distribution` |
| **Guard** | `LogtoAdminGuard` |
| **Query Params** | `AnalyticsQueryDto` (from?, to?) |
| **Success Response** | `200 RaceTypeDistributionResponseDto` |
| **Error Responses** | 400, 401, 403 |
| **Cache** | `analytics:metric:race-perf-type:<scope>:<periodKey>` TTL 900s (current), 86400s (historical) |

#### Endpoint 16: GET /analytics/races/spotlight

| Field | Value |
|-------|-------|
| **Method** | GET |
| **Path** | `/analytics/races/spotlight` |
| **Guard** | `LogtoAdminGuard` |
| **Query Params** | `AnalyticsQueryDto` (from?, to?) |
| **Success Response** | `200 RaceSpotlightResponseDto` |
| **Error Responses** | 400, 401, 403 |
| **Cache** | `analytics:metric:race-perf-spotlight:<scope>:<periodKey>` TTL 900s (current), 86400s (historical) |
| **Fee** | `FeeService.computeFeeForOrdersAggregate()` |

#### Endpoint 17: GET /analytics/races/performance

| Field | Value |
|-------|-------|
| **Method** | GET |
| **Path** | `/analytics/races/performance` |
| **Guard** | `LogtoAdminGuard` |
| **Query Params** | `RacePerformanceQueryDto` (from?, to?, raceType?, tenantId?, sortBy?, sortOrder?, page?, limit?) |
| **Success Response** | `200 RacePerformanceResponseDto` |
| **Error Responses** | 400, 401, 403 |
| **Cache** | `analytics:metric:race-perf-list:<scope>:<hash>` TTL 900s (current), 86400s (historical). Hash = deterministic from all filters. |
| **Fee** | `FeeService.computeFeeForOrdersAggregate()` |
| **Pagination** | Default page=1, limit=12, max limit=50 |

#### Endpoint 18: GET /analytics/merchants/scatter

| Field | Value |
|-------|-------|
| **Method** | GET |
| **Path** | `/analytics/merchants/scatter` |
| **Guard** | `LogtoAdminGuard` |
| **Query Params** | `AnalyticsQueryDto` (from?, to?) |
| **Success Response** | `200 MerchantScatterResponseDto` |
| **Error Responses** | 401, 403 |
| **Cache** | `analytics:metric:merchant-comp-scatter:<scope>:<periodKey>` TTL 900s (current), 86400s (historical) |

#### Endpoint 19: GET /analytics/merchants/health-distribution

| Field | Value |
|-------|-------|
| **Method** | GET |
| **Path** | `/analytics/merchants/health-distribution` |
| **Guard** | `LogtoAdminGuard` |
| **Query Params** | Không |
| **Success Response** | `200 HealthDistributionResponseDto` |
| **Error Responses** | 401, 403 |
| **Cache** | `analytics:metric:merchant-comp-dist:platform:current` TTL 900s (current), 86400s (historical) |

#### Endpoint 20: GET /analytics/merchants/comparison

| Field | Value |
|-------|-------|
| **Method** | GET |
| **Path** | `/analytics/merchants/comparison` |
| **Guard** | `LogtoAdminGuard` |
| **Query Params** | `AnalyticsQueryDto` (from?, to?, sortBy?, sortOrder?) |
| **Success Response** | `200 MerchantComparisonResponseDto` |
| **Error Responses** | 401, 403 |
| **Cache** | `analytics:metric:merchant-comp-table:<scope>:<periodKey>` TTL 900s (current), 86400s (historical) |

### 3.3 DTO Field-Level Spec

> **Giữ nguyên tất cả DTOs PRD v1** (WeeklyRevenueResponseDto, MonthlyRevenueResponseDto, ComparisonQueryDto, ComparisonResponseDto, TopRacesByOrdersResponseDto, RacesNeedAttentionResponseDto, MerchantHealthResponseDto, ExportQueryDto, Ga4QueryDto, Ga4OverviewResponseDto). Dưới đây chỉ liệt kê **DTOs MỚI**.

#### RunnerSummaryResponseDto

```typescript
export class RunnerSummaryDeltaDto {
  @ApiProperty({ nullable: true }) uniqueRunnersPct: number | null;
  @ApiProperty({ nullable: true }) repeatRatePct: number | null;
  @ApiProperty({ nullable: true }) avgLeadTimePct: number | null;
  @ApiProperty({ nullable: true }) avgOrdersPerRunnerPct: number | null;
}

export class RunnerSummaryResponseDto {
  @ApiProperty({ description: 'Số runner duy nhất (distinct athlete_id từ paid orders)' })
  uniqueRunners: number;

  @ApiProperty({ description: 'Tỷ lệ runner ≥2 races / total (%)' })
  repeatRate: number;

  @ApiProperty({ description: 'Trung bình lead time (ngày)' })
  avgLeadTimeDays: number;

  @ApiProperty({ description: 'Trung bình đơn/runner' })
  avgOrdersPerRunner: number;

  @ApiProperty({ type: RunnerSummaryDeltaDto, description: 'Delta MoM %' })
  delta: RunnerSummaryDeltaDto;

  @ApiProperty() period: { from: string; to: string };
}
```

#### BookingHeatmapResponseDto

```typescript
export class HeatmapCellDto {
  @ApiProperty({ description: 'Ngày trong tuần (0=CN, 1=T2, ..., 6=T7)' })
  dayOfWeek: number;

  @ApiProperty({ description: 'Giờ (0-23)' })
  hour: number;

  @ApiProperty({ description: 'Số đơn' })
  count: number;
}

export class BookingHeatmapResponseDto {
  @ApiProperty({ type: [HeatmapCellDto] })
  cells: HeatmapCellDto[];

  @ApiProperty({ description: 'Max count (cho intensity scale)' })
  maxCount: number;

  @ApiProperty() period: { from: string; to: string };
}
```

#### LeadTimeResponseDto

```typescript
export class LeadTimeBucketDto {
  @ApiProperty({ description: 'Bucket key', example: '0-7' })
  bucket: string;

  @ApiProperty({ description: 'Label tiếng Việt', example: 'Last-minute' })
  label: string;

  @ApiProperty() count: number;

  @ApiProperty({ description: 'Percentage of total' })
  percentage: number;

  @ApiProperty({ description: 'Color hex cho chart', example: '#f87171' })
  color: string;
}

export class LeadTimeResponseDto {
  @ApiProperty({ type: [LeadTimeBucketDto] })
  buckets: LeadTimeBucketDto[];

  @ApiProperty({ description: 'Tổng orders analyzed' })
  totalOrders: number;

  @ApiProperty({ description: 'Auto-generated insight text' })
  insight: string;

  @ApiProperty() period: { from: string; to: string };
}
```

#### RepeatCohortResponseDto

```typescript
export class RepeatCohortTierDto {
  @ApiProperty({ description: 'Tier label', example: '5+ giải' })
  tier: string;

  @ApiProperty() count: number;

  @ApiProperty({ description: 'Percentage of total unique runners' })
  percentage: number;
}

export class RepeatCohortResponseDto {
  @ApiProperty({ type: [RepeatCohortTierDto] })
  tiers: RepeatCohortTierDto[];

  @ApiProperty() totalUniqueRunners: number;

  @ApiProperty({ description: 'Auto-generated insight' })
  insight: string;

  @ApiProperty() period: { from: string; to: string };
}
```

#### DemographicsResponseDto

```typescript
export class AgeBracketDto {
  @ApiProperty({ example: '25-34' })
  ageRange: string;

  @ApiProperty() male: number;
  @ApiProperty() female: number;
  @ApiProperty() other: number;
  @ApiProperty() unknown: number;
  @ApiProperty() total: number;
}

export class GenderSummaryItemDto {
  @ApiProperty() count: number;
  @ApiProperty() percentage: number;
}

export class DemographicsResponseDto {
  @ApiProperty({ type: [AgeBracketDto] })
  brackets: AgeBracketDto[];

  @ApiProperty()
  genderSummary: {
    male: GenderSummaryItemDto;
    female: GenderSummaryItemDto;
    other: GenderSummaryItemDto;
    unknown: GenderSummaryItemDto;
  };

  @ApiProperty() totalRunners: number;
  @ApiProperty() period: { from: string; to: string };
}
```

#### GeographicResponseDto

```typescript
export class ProvinceItemDto {
  @ApiProperty({ example: 'Hồ Chí Minh' })
  province: string;

  @ApiProperty() count: number;
  @ApiProperty() percentage: number;
}

export class GeographicResponseDto {
  @ApiProperty({ type: [ProvinceItemDto] })
  provinces: ProvinceItemDto[];

  @ApiProperty({ description: '% runners có thông tin tỉnh thành' })
  coverage: number;

  @ApiProperty() totalWithProvince: number;
  @ApiProperty() totalRunners: number;
  @ApiProperty() period: { from: string; to: string };
}
```

#### RaceTypeDistributionResponseDto

```typescript
export class RaceTypeItemDto {
  @ApiProperty({ enum: ['ROAD_MARATHON', 'ROAD_HALF_MARATHON', 'ULTRA_TRAIL_RACE', 'TRAIL_RACE'] })
  raceType: string;

  @ApiProperty({ description: 'Số giải loại này' })
  count: number;

  @ApiProperty({ description: 'Tổng GMV loại này' })
  gmv: number;

  @ApiProperty({ description: 'GMV trung bình/giải' })
  avgGmv: number;
}

export class RaceTypeDistributionResponseDto {
  @ApiProperty({ type: [RaceTypeItemDto] })
  data: RaceTypeItemDto[];

  @ApiProperty() period: { from: string; to: string };
}
```

#### RaceSpotlightResponseDto

```typescript
export class RaceSpotlightResponseDto {
  @ApiProperty() raceId: number;
  @ApiProperty() raceName: string;
  @ApiProperty() merchant: string;
  @ApiProperty() raceType: string;
  @ApiProperty() date: string;
  @ApiProperty() gmv: number;
  @ApiProperty() orders: number;
  @ApiProperty() avgPerOrder: number;
  @ApiProperty() platformFee: number;
  @ApiProperty({ description: 'Auto-generated insight' })
  insight: string;
}
```

#### RacePerformanceQueryDto

```typescript
export class RacePerformanceQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional({ enum: ['ROAD_MARATHON', 'ROAD_HALF_MARATHON', 'ULTRA_TRAIL_RACE', 'TRAIL_RACE'] })
  @IsOptional()
  @IsIn(['ROAD_MARATHON', 'ROAD_HALF_MARATHON', 'ULTRA_TRAIL_RACE', 'TRAIL_RACE'])
  raceType?: string;

  @ApiPropertyOptional({ enum: ['gmv', 'orders', 'fee', 'avgPerOrder', 'voidedPct'], default: 'gmv' })
  @IsOptional()
  @IsIn(['gmv', 'orders', 'fee', 'avgPerOrder', 'voidedPct'])
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number;
}
```

#### RacePerformanceResponseDto

```typescript
export class RacePerformanceItemDto {
  @ApiProperty() raceId: number;
  @ApiProperty() raceName: string;
  @ApiProperty() merchant: string;
  @ApiProperty() raceType: string;
  @ApiProperty() date: string;
  @ApiProperty() orders: number;
  @ApiProperty() gmv: number;
  @ApiProperty() platformFee: number;
  @ApiProperty() avgPerOrder: number;
  @ApiProperty({ description: 'Tỷ lệ huỷ %' })
  voidedPct: number;
}

export class RacePerformanceResponseDto {
  @ApiProperty({ type: [RacePerformanceItemDto] })
  data: RacePerformanceItemDto[];

  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
```

#### MerchantScatterResponseDto

```typescript
export class MerchantScatterItemDto {
  @ApiProperty() tenantId: number;
  @ApiProperty() tenantName: string;
  @ApiProperty() orders: number;
  @ApiProperty() gmv: number;
  @ApiProperty({ enum: ['ACTIVE', 'AT_RISK', 'CHURNED', 'NEW', 'ALERT'] })
  status: string;
}

export class MerchantScatterResponseDto {
  @ApiProperty({ type: [MerchantScatterItemDto] })
  data: MerchantScatterItemDto[];
}
```

#### HealthDistributionResponseDto

```typescript
export class HealthTierDto {
  @ApiProperty({ example: 'EXCELLENT' })
  tier: string;

  @ApiProperty({ example: 'Xuất sắc' })
  label: string;

  @ApiProperty({ example: 80 })
  min: number;

  @ApiProperty({ example: 100 })
  max: number;

  @ApiProperty() count: number;

  @ApiProperty({ example: '#16a34a' })
  color: string;
}

export class HealthDistributionResponseDto {
  @ApiProperty({ type: [HealthTierDto] })
  tiers: HealthTierDto[];
}
```

#### MerchantComparisonResponseDto

```typescript
export class MerchantCompItemDto {
  @ApiProperty() tenantId: number;
  @ApiProperty() tenantName: string;
  @ApiProperty({ description: 'Fee rate %' }) feeRate: number;
  @ApiProperty() races: number;
  @ApiProperty() orders: number;
  @ApiProperty() gmv: number;
  @ApiProperty({ description: 'Phí 5BIB' }) fee: number;
  @ApiProperty({ description: 'Tỷ lệ đơn thủ công %' }) manualPct: number;
  @ApiProperty({ description: 'Tỷ lệ huỷ %' }) voidedPct: number;
  @ApiProperty({ enum: ['ACTIVE', 'AT_RISK', 'CHURNED', 'NEW', 'ALERT'] }) status: string;
  @ApiProperty({ description: 'RFM health score 0-100' }) healthScore: number;
}

export class MerchantComparisonTotalsDto {
  @ApiProperty() orders: number;
  @ApiProperty() gmv: number;
  @ApiProperty() fee: number;
}

export class MerchantComparisonResponseDto {
  @ApiProperty({ type: [MerchantCompItemDto] })
  data: MerchantCompItemDto[];

  @ApiProperty({ type: MerchantComparisonTotalsDto })
  totals: MerchantComparisonTotalsDto;
}
```

#### Funnel 5-Stage Update — FunnelResponseDto (EXTEND)

```typescript
// Extend existing FunnelResponseDto — thêm 2 fields mới
export class FunnelStageDto {
  @ApiProperty() stage: string; // 'created' | 'paid' | 'completed' | 'cancelled' | 'refunded'
  @ApiProperty() label: string; // VN label
  @ApiProperty() count: number;
  @ApiProperty({ description: '% so với tổng created' }) percentOfTotal: number;
  @ApiProperty({ description: '% so với stage trước', nullable: true }) conversionRate: number | null;
}

export class FunnelResponseDto {
  @ApiProperty({ type: [FunnelStageDto] })
  stages: FunnelStageDto[];

  @ApiProperty() period: { from: string; to: string };
}
```

### 3.4 Frontend/Admin Changes

#### 3.4.1 SDK Regeneration
```bash
cd admin && pnpm generate:api
```

#### 3.4.2 New Files

| File | Mô tả |
|------|-------|
| `admin/src/app/(dashboard)/analytics/layout.tsx` | Tab navigation layout (5 tabs + shared header) |
| `admin/src/app/(dashboard)/analytics/races/page.tsx` | Tab 2: Race Performance page |
| `admin/src/app/(dashboard)/analytics/runners/page.tsx` | Tab 4: Runner Behavior page |
| `admin/src/lib/analytics-labels.ts` | Vietnamese dictionary (BR-SA-17) |
| `admin/src/app/(dashboard)/analytics/components/GranularityToggle.tsx` | **NEW (Manager Adjustment #3 v3)** — SegmentedControl Ngày/Tuần/Tháng, type `GranularityKind` |
| `admin/src/app/(dashboard)/analytics/components/PeriodSelector.tsx` | **NEW (Manager Adjustment #3 v3)** — Select 6 PeriodKind values + custom date range picker inline |
| `admin/src/app/(dashboard)/analytics/components/CompareSelector.tsx` | **NEW (Manager Adjustment #3 v3)** — Select 5 CompareKind values (none/prev/wow/mom/yoy) |
| `admin/src/app/(dashboard)/analytics/components/ComparisonPanel.tsx` | WoW/MoM/YoY comparison cards trong Tab 1 Section 3 (sync state với header CompareSelector) |
| `admin/src/app/(dashboard)/analytics/components/AlertsPanel.tsx` | Races Cần Attention |
| `admin/src/app/(dashboard)/analytics/components/KpiConcentration.tsx` | **NEW (Manager Adjustment #6 v3)** — GMV Concentration KPI card ("Top 5 races: X% GMV") |
| `admin/src/app/(dashboard)/analytics/components/MerchantHealthSection.tsx` | Merchant health overview (Tab 1) |
| `admin/src/app/(dashboard)/analytics/components/FunnelChart.tsx` | 5-stage horizontal bar funnel |
| `admin/src/app/(dashboard)/analytics/components/Ga4Section.tsx` | GA4 web traffic |
| `admin/src/app/(dashboard)/analytics/components/TopRacesTabs.tsx` | Tabbed Top Races GMV/Orders |
| `admin/src/app/(dashboard)/analytics/components/BookingHeatmap.tsx` | 7×24 heatmap grid |
| `admin/src/app/(dashboard)/analytics/components/LeadTimeHistogram.tsx` | 5-bucket bars |
| `admin/src/app/(dashboard)/analytics/components/RepeatCohort.tsx` | Stacked bar + list |
| `admin/src/app/(dashboard)/analytics/components/DemographicsChart.tsx` | Age × gender grouped bars |
| `admin/src/app/(dashboard)/analytics/components/GeographicChart.tsx` | Top provinces bars |
| `admin/src/app/(dashboard)/analytics/components/ScatterChart.tsx` | Merchant GMV × Orders scatter |
| `admin/src/app/(dashboard)/analytics/components/HealthDistribution.tsx` | 5-tier horizontal bars |
| `admin/src/app/(dashboard)/analytics/components/RacePerformanceTable.tsx` | Paginated race table |
| `admin/src/app/(dashboard)/analytics/components/MerchantCompTable.tsx` | Sortable merchant table |
| `admin/src/app/(dashboard)/analytics/components/AccordionInsights.tsx` | F-026 accordion wrapper |
| `backend/src/modules/analytics/services/runner-analytics.service.ts` | Runner analytics queries |
| `backend/src/modules/analytics/services/race-performance.service.ts` | Race performance queries |
| `backend/src/modules/analytics/services/merchant-comparison.service.ts` | Merchant comparison queries |
| `backend/src/modules/analytics/dto/runner-*.dto.ts` | 6 runner DTOs |
| `backend/src/modules/analytics/dto/race-performance-*.dto.ts` | 3 race DTOs |
| `backend/src/modules/analytics/dto/merchant-comp-*.dto.ts` | 3 merchant DTOs |

#### 3.4.3 Refactored Files

| File | Thay đổi |
|------|---------|
| `admin/src/app/(dashboard)/analytics/page.tsx` | REFACTOR: TanStack Query + SDK, multi-tab Tab 1 layout |
| `admin/src/app/(dashboard)/analytics/merchants/page.tsx` | REFACTOR: Merchant Comparison tab (scatter + dist + table) |
| `admin/src/app/(dashboard)/analytics/funnel/page.tsx` | REFACTOR: 5-stage visual funnel |
| `admin/src/app/(dashboard)/analytics/components/PeriodCompareSelector.tsx` | **DEPRECATE (Manager Adjustment #3 v3)** — Mark `@deprecated F-062 v3`, KHÔNG xoá ngay. Tab 1+2+3+4+5 import 3 NEW selectors thay thế qua shared `layout.tsx`. |
| `admin/src/app/(dashboard)/analytics/components/ExportButton.tsx` | REFACTOR: wire real download |
| `admin/src/app/globals.css` | **EXTEND (Manager Adjustment #5 v3)** — Import 5Solution brand tokens (`--5s-blue`, `--5s-magenta`, `--5s-blue-600`, `--5s-blue-300`) nếu chưa có |
| `backend/src/modules/analytics/analytics.controller.ts` | EXTEND: +12 endpoints |
| `backend/src/modules/analytics/analytics.service.ts` | EXTEND: delegate to new services |
| `backend/src/modules/analytics/analytics.module.ts` | EXTEND: register new services |
| `backend/src/modules/analytics/services/period-resolver.ts` | **EXTEND (Manager Adjustment #1 v3)** — KHÔNG ADD weekly/monthly vào `PeriodKind`. THÊM NEW `export type GranularityKind = 'daily' \| 'weekly' \| 'monthly'` + helper `resolveBucketSize(granularity)`. EXTEND `CompareKind` thêm `'wow' \| 'mom' \| 'yoy'` (giữ `'prev'` backward compat). |
| `backend/src/modules/merchant/merchant.service.ts` | EXTEND: `flushEventOverrideCache()` thêm 13 patterns analytics:metric:* (BR-SA-18) |
| `backend/.env.example` | EXTEND: add `GA4_SERVICE_ACCOUNT_KEY_PATH` + `GA4_PROPERTY_ID` stubs |

#### 3.4.4 Dependencies

| Package | Layer | Mô tả |
|---------|-------|-------|
| `exceljs` ^4.4.0 | Backend | Excel generation |
| `@google-analytics/data` ^4.x | Backend | GA4 API client |
| (no new admin packages) | Admin | Dùng shadcn/ui + Tailwind + recharts existing |

### 3.5 PAUSE Flags

#### PAUSE-SA-01 — GA4 Credentials
Coder implement Ga4Service với graceful fallback. Danny cung cấp key khi deploy.

#### PAUSE-SA-02 — Fill Rate Definition
Race không set capacity → `fillRate = null`. Frontend hiện "--".

#### PAUSE-SA-03 — ExcelJS Bundle Size
Chấp nhận. Lazy import `await import('exceljs')` trong export service.

#### PAUSE-SA-04 — Comparison Cold Performance
Cache 300s. Cold p95 có thể ~3-4s. Coder benchmark + optimize parallel `Promise.all`.

#### PAUSE-SA-05 — Health Score Weights
Dùng defaults per BR-SA-07. Constants có thể config (KHÔNG cần UI config Phase 1).

#### PAUSE-SA-06 — Runner Demographics Privacy (MỚI)
Athletes DOB + gender dùng cho aggregate analytics CHỈ — KHÔNG expose individual athlete data qua API. Response chỉ trả aggregate counts per bracket. Nếu bracket count < 5 → merge vào adjacent bracket (k-anonymity defense).

#### PAUSE-SA-07 — Race Type Enum Source (MỚI)
Cần verify `race.type` field tồn tại trong MySQL `races` table với exact enum values `ROAD_MARATHON`, `ROAD_HALF_MARATHON`, `ULTRA_TRAIL_RACE`, `TRAIL_RACE`. Nếu field chưa có → fallback derive từ race name pattern matching (ít chính xác hơn). Coder spot-check trước khi implement.

---

## 🧪 Phase 4: Testing Mandates

### 4.1 Backend Test Cases

> **Giữ nguyên TC-SA-01 → TC-SA-93 từ PRD v1** cho 8 endpoints gốc. Dưới đây bổ sung TCs cho endpoints MỚI.

#### Endpoint: GET /analytics/runners/summary

| TC | Mô tả | Input | Expected | Loại |
|----|-------|-------|----------|------|
| TC-SA-94 | Happy path — runner summary | `{}` default 30d | 200, uniqueRunners > 0, repeatRate 0-100, avgLeadTimeDays > 0, avgOrdersPerRunner > 0 | Happy |
| TC-SA-95 | MoM delta populated | Default period | delta fields populated (number or null) | Invariant |
| TC-SA-96 | Empty period | Historical no data | 200, uniqueRunners = 0, repeatRate = 0 | Boundary |
| TC-SA-97 | Auth missing | No token | 401 | Auth |
| TC-SA-98 | Non-admin | User token | 403 | Permission |

#### Endpoint: GET /analytics/runners/booking-heatmap

| TC | Mô tả | Input | Expected | Loại |
|----|-------|-------|----------|------|
| TC-SA-99 | Happy path — heatmap grid | `{}` | 200, cells array, mỗi cell có dayOfWeek 0-6, hour 0-23, count ≥ 0 | Happy |
| TC-SA-100 | maxCount consistent | cells max | maxCount = max(cells[*].count) | Invariant |
| TC-SA-101 | Timezone VN UTC+7 | Order created_at 2026-05-20T02:00Z (= 09:00 VN) | Cell dayOfWeek=3(T4 nếu Wed), hour=9 | Invariant |
| TC-SA-102 | Empty period | No orders | 200, cells = [], maxCount = 0 | Boundary |
| TC-SA-103 | Auth | No token | 401 | Auth |

#### Endpoint: GET /analytics/runners/lead-time

| TC | Mô tả | Input | Expected | Loại |
|----|-------|-------|----------|------|
| TC-SA-104 | Happy path — 5 buckets | `{}` | 200, buckets.length = 5, sum(percentage) ≈ 100 | Happy |
| TC-SA-105 | Bucket assignment — 3 ngày | Order 3 ngày trước race | Bucket "0-7" | Invariant |
| TC-SA-106 | Bucket assignment — 45 ngày | Order 45 ngày trước | Bucket "31-60" | Invariant |
| TC-SA-107 | Insight text generated | Data available | insight string non-empty, contains largest bucket | Invariant |
| TC-SA-108 | Auth | No token | 401 | Auth |

#### Endpoint: GET /analytics/runners/repeat-cohort

| TC | Mô tả | Input | Expected | Loại |
|----|-------|-------|----------|------|
| TC-SA-109 | Happy path — 4 tiers | `{}` | 200, tiers.length = 4, sum(count) = totalUniqueRunners | Happy |
| TC-SA-110 | Runner 3 races → tier "3-4 giải" | Test data | Correct bucket | Invariant |
| TC-SA-111 | Runner 7 races → tier "5+ giải" | Test data | Correct bucket | Invariant |
| TC-SA-112 | Insight generated | Data | insight string mentions "1 race" percentage | Invariant |
| TC-SA-113 | Auth | No token | 401 | Auth |

#### Endpoint: GET /analytics/runners/demographics

| TC | Mô tả | Input | Expected | Loại |
|----|-------|-------|----------|------|
| TC-SA-114 | Happy path — 6 brackets | `{}` | 200, brackets.length = 6, genderSummary populated | Happy |
| TC-SA-115 | Missing DOB → "Không rõ tuổi" | Athlete no DOB | Counted in total but not in age brackets | Invariant |
| TC-SA-116 | Missing gender → "Không rõ" | Athlete no gender | genderSummary.unknown.count += 1 | Invariant |
| TC-SA-117 | k-anonymity — bracket < 5 | Bracket with 3 athletes | Merge into adjacent bracket | Privacy |
| TC-SA-118 | Auth | No token | 401 | Auth |

#### Endpoint: GET /analytics/runners/geographic

| TC | Mô tả | Input | Expected | Loại |
|----|-------|-------|----------|------|
| TC-SA-119 | Happy path — top 8 | `{}` | 200, provinces.length ≤ 8, sorted by count DESC | Happy |
| TC-SA-120 | Coverage calc | Mix athletes | coverage = totalWithProvince / totalRunners * 100 | Invariant |
| TC-SA-121 | No province athletes | All athletes missing province | provinces = [], coverage = 0 | Boundary |
| TC-SA-122 | Auth | No token | 401 | Auth |

#### Endpoint: GET /analytics/races/type-distribution

| TC | Mô tả | Input | Expected | Loại |
|----|-------|-------|----------|------|
| TC-SA-123 | Happy path | `{}` | 200, data array with raceType/count/gmv | Happy |
| TC-SA-124 | Race type VN label | Response | raceType is enum key, NOT VN label (frontend transforms) | Invariant |
| TC-SA-125 | Auth | No token | 401 | Auth |

#### Endpoint: GET /analytics/races/spotlight

| TC | Mô tả | Input | Expected | Loại |
|----|-------|-------|----------|------|
| TC-SA-126 | Happy path — top race | `{}` | 200, raceId > 0, insight string non-empty | Happy |
| TC-SA-127 | No races in period | Empty period | 200, raceId = null, insight = "Chưa có giải nào trong khoảng thời gian này" | Boundary |
| TC-SA-128 | Fee uses FeeService | Tenant with override | platformFee matches FeeService output | Invariant |
| TC-SA-129 | Auth | No token | 401 | Auth |

#### Endpoint: GET /analytics/races/performance

| TC | Mô tả | Input | Expected | Loại |
|----|-------|-------|----------|------|
| TC-SA-130 | Happy path — paginated | `{ page: 1, limit: 12 }` | 200, data.length ≤ 12, total/page/totalPages populated | Happy |
| TC-SA-131 | Filter by raceType | `{ raceType: 'TRAIL_RACE' }` | All items have raceType = 'TRAIL_RACE' | Filter |
| TC-SA-132 | Filter by tenantId | `{ tenantId: 42 }` | All items belong to tenant 42 | Filter |
| TC-SA-133 | Sort by orders desc | `{ sortBy: 'orders', sortOrder: 'desc' }` | data[0].orders ≥ data[1].orders | Sort |
| TC-SA-134 | Page 2 | `{ page: 2 }` | Different data than page 1 | Pagination |
| TC-SA-135 | Limit exceed | `{ limit: 100 }` | Capped at 50 or 400 | Validation |
| TC-SA-136 | Auth | No token | 401 | Auth |

#### Endpoint: GET /analytics/merchants/scatter

| TC | Mô tả | Input | Expected | Loại |
|----|-------|-------|----------|------|
| TC-SA-137 | Happy path | `{}` | 200, data array with tenantId/orders/gmv/status | Happy |
| TC-SA-138 | Status enum valid | Response | All status ∈ {'ACTIVE', 'AT_RISK', 'CHURNED', 'NEW', 'ALERT'} | Invariant |
| TC-SA-139 | Auth | No token | 401 | Auth |

#### Endpoint: GET /analytics/merchants/health-distribution

| TC | Mô tả | Input | Expected | Loại |
|----|-------|-------|----------|------|
| TC-SA-140 | Happy path — 5 tiers | No params | 200, tiers.length = 5, sum(count) = total merchants | Happy |
| TC-SA-141 | Tier boundaries | Score = 80 | tier = "EXCELLENT" | Invariant |
| TC-SA-142 | Auth | No token | 401 | Auth |

#### Endpoint: GET /analytics/merchants/comparison

| TC | Mô tả | Input | Expected | Loại |
|----|-------|-------|----------|------|
| TC-SA-143 | Happy path | `{}` | 200, data array, totals populated | Happy |
| TC-SA-144 | Totals consistent | Sum data | totals.orders = sum(data[*].orders) | Invariant |
| TC-SA-145 | Health score range | Each merchant | 0 ≤ healthScore ≤ 100 | Invariant |
| TC-SA-146 | Auth | No token | 401 | Auth |

#### Funnel 5-Stage

| TC | Mô tả | Input | Expected | Loại |
|----|-------|-------|----------|------|
| TC-SA-147 | 5 stages returned | `{}` | stages.length = 5, stages[0].stage = 'created' | Happy |
| TC-SA-148 | Refunded stage | Orders with refund | stages[4].stage = 'refunded', count > 0 | Happy |
| TC-SA-149 | conversionRate calc | Known data | stages[1].conversionRate = stages[1].count / stages[0].count * 100 | Invariant |
| TC-SA-150 | percentOfTotal | All stages | stages[X].percentOfTotal = stages[X].count / stages[0].count * 100 | Invariant |

#### Cache Invalidation (Extended)

| TC | Mô tả | Expected | Loại |
|----|-------|----------|------|
| TC-SA-151 | Flush covers ~13 new patterns | flushEventOverrideCache() → scanStream verify runner-*/race-perf-*/merchant-comp-*/funnel patterns flushed | Cache |
| TC-SA-152 | GA4 keys NOT flushed | `analytics:ga4:*` survive admin write | Cache |

### 4.2 Frontend E2E Test Cases

| TC | Mô tả | Steps | Expected |
|----|-------|-------|----------|
| TC-SA-76 | Tab 1 page load | Navigate /analytics | Skeleton → all 8 sections render. Console no errors. |
| TC-SA-77 | Granularity toggle | Click "Tuần" → "Tháng" → "Ngày" | Chart X-axis labels update. API calls match. |
| TC-SA-78 | Period change | Select "Quý này" | All sections reload. |
| TC-SA-79 | Compare toggle | Select "YoY" | Comparison Panel switch. KPI delta update. |
| TC-SA-80 | Top Races tabs | Click "Theo đơn" | Table sort by orders. |
| TC-SA-81 | Export CSV | Click Export → CSV | File download valid. |
| TC-SA-82 | Export Excel | Click Export → Excel | File download valid. |
| TC-SA-83 | Race drill-down | Click race name | Navigate /analytics/races/{id}. |
| TC-SA-84 | Accordion | Click "Phân tích vận hành chi tiết" | Accordion expand, 6 panels. |
| TC-SA-85 | GA4 placeholder | GA4 not configured | Placeholder message. |
| TC-SA-86 | Empty alerts | No alerts | "Tất cả giải chạy đang vận hành tốt". |
| TC-SA-87 | Error state | Backend 500 | Retry button per section. |
| TC-SA-88 | VN labels | All enums | No raw enum visible. |
| TC-SA-153 | Tab 2 load | Click tab "Hiệu suất Race" | Navigate /analytics/races. Filter bar + chart + spotlight + table render. |
| TC-SA-154 | Tab 2 filter race type | Click chip "Ultra Trail" | Table + chart filtered. Count update. |
| TC-SA-155 | Tab 2 pagination | Click page 2 | Table rows change. |
| TC-SA-156 | Tab 3 load | Click tab "Merchant" | Navigate /analytics/merchants. Scatter + dist + table render. |
| TC-SA-157 | Tab 3 scatter hover | Hover merchant bubble | Tooltip with name + orders + GMV. |
| TC-SA-158 | Tab 3 sort toggle | Click "GMV" | Table re-sorted by GMV. |
| TC-SA-159 | Tab 4 load | Click tab "Runner" | Navigate /analytics/runners. 6 sections render. |
| TC-SA-160 | Tab 4 heatmap hover | Hover cell | Tooltip "T3 14h: 42 đơn". |
| TC-SA-161 | Tab 4 period change | Change to previous month | All sections reload. |
| TC-SA-162 | Tab 5 load | Click tab "Funnel" | Navigate /analytics/funnel. 5-stage chart render. |
| TC-SA-163 | Tab 5 conversion | Verify bars | Bar widths proportional to counts. Labels show %. |
| TC-SA-164 | Tab navigation state | Change period on Tab 1 → click Tab 2 → click Tab 1 | Period preserved across tab switches. |
| TC-SA-165 | Tab URL state | Navigate Tab 2 with ?period=quarter | Tab 2 loads with quarter filter applied. |

### 4.3 Security Checks

| TC | Mô tả | Expected |
|----|-------|----------|
| TC-SA-89 | Tất cả endpoints mới có LogtoAdminGuard | No endpoint accessible without admin token |
| TC-SA-90 | Export — no path traversal | reportType validated |
| TC-SA-91 | GA4 credentials — không expose | Key KHÔNG trả về cho client |
| TC-SA-92 | SQL injection — query params | Parameterized queries |
| TC-SA-93 | Export max rows — DoS prevention | > 10,000 → 400 |
| TC-SA-166 | Runner demographics — no individual data | Response only aggregate counts, no athlete PII |
| TC-SA-167 | k-anonymity — small brackets | Bracket < 5 → merged |

### 4.4 Performance SLA

| Metric | Target | Đo bằng |
|--------|--------|---------|
| `GET /analytics/revenue/weekly` p95 warm | < 200ms | k6 100 req |
| `GET /analytics/revenue/weekly` p95 cold | < 3s | k6 |
| `GET /analytics/revenue/monthly` p95 warm | < 200ms | k6 |
| `GET /analytics/comparison` p95 cold | < 5s | k6 |
| `GET /analytics/top-races-by-orders` p95 warm | < 200ms | k6 |
| `GET /analytics/alerts/races-need-attention` p95 | < 1s | k6 |
| `GET /analytics/alerts/merchant-health` p95 | < 2s | k6 |
| `GET /analytics/export` xlsx 1000 rows | < 5s | Manual |
| `GET /analytics/ga4/overview` p95 cold | < 8s | k6 |
| `GET /analytics/runners/summary` p95 warm | < 200ms | k6 |
| `GET /analytics/runners/booking-heatmap` p95 warm | < 300ms | k6 |
| `GET /analytics/runners/lead-time` p95 warm | < 200ms | k6 |
| `GET /analytics/runners/repeat-cohort` p95 warm | < 300ms | k6 |
| `GET /analytics/runners/demographics` p95 warm | < 500ms | k6 |
| `GET /analytics/runners/geographic` p95 warm | < 200ms | k6 |
| `GET /analytics/races/performance` p95 warm | < 300ms | k6 |
| `GET /analytics/races/type-distribution` p95 warm | < 200ms | k6 |
| `GET /analytics/races/spotlight` p95 warm | < 200ms | k6 |
| `GET /analytics/merchants/scatter` p95 warm | < 200ms | k6 |
| `GET /analytics/merchants/comparison` p95 warm | < 300ms | k6 |
| `GET /analytics/merchants/health-distribution` p95 warm | < 200ms | k6 |
| Admin Analytics page Tab 1 — LCP | < 3s | Lighthouse |
| Admin Analytics page — CLS | < 0.1 | Lighthouse |
| Tab switch (Tab 1 → Tab 2) | < 2s LCP | Manual |

---

## 🎨 Phase 5: Design Spec

### 5.1 Design Philosophy
**"Command Center"** — Multi-tab analytics dashboard, mỗi tab = 1 góc nhìn chuyên biệt.

### 5.2 Color Scheme

| Mục đích | Hex | Tailwind |
|----------|-----|----------|
| Background | `#fafaf9` | `bg-stone-50` |
| Card | `#ffffff` | `bg-white` |
| Text chính | `#1c1917` | `text-stone-900` |
| Text phụ | `#78716c` | `text-stone-500` |
| **GMV accent** | **`#1D49FF`** | **`var(--5s-blue)` — 5Solution brand blue, NOT Tailwind blue-600** |
| **GMV accent dark** | **`#0B36E6`** | **`var(--5s-blue-600)`** |
| **GMV accent light** | **`#88A2FF`** | **`var(--5s-blue-300)`** |
| **Magenta accent (CTA)** | **`#FF0E65`** | **`var(--5s-magenta)` — 5-family logo accent** |
| Net Revenue | `#16a34a` | `text-green-600` |
| Orders | `#f97316` | `text-orange-500` |
| Platform Fee | `#9333ea` | `text-purple-600` |
| Positive delta | `#16a34a` | `text-green-600 bg-green-50` |
| Negative delta | `#dc2626` | `text-red-600 bg-red-50` |
| CRITICAL alert | `#dc2626` | border-red-500 bg-red-50 |
| WARNING alert | `#f59e0b` | border-amber-500 bg-amber-50 |
| Health Excellent | `#16a34a` | green-600 |
| **Health Good** | **`#1D49FF`** | **`var(--5s-blue)` — 5Solution brand (not blue-600)** |
| Health Average | `#f59e0b` | amber-500 |
| Health Weak | `#f97316` | orange-500 |
| Health At Risk | `#ef4444` | red-500 |

> **Manager Adjustment #5 v3 — 5Solution Brand Tokens Lock:**
> - GMV accent + Magenta accent + Health Good PHẢI dùng **`--5s-blue #1D49FF`** và **`--5s-magenta #FF0E65`** (5Solution brand DNA), KHÔNG Tailwind defaults `text-blue-600 #2563eb`.
> - Reference: `.5bib-workflow/features/FEATURE-062-sales-analytics-dashboard/reference-ui-selling-web/design-system/tokens.css` (canonical 5Solution Design System).
> - **Coder action:** Verify `admin/src/app/globals.css` đã import 5Solution brand tokens (`--5s-blue`, `--5s-blue-600`, `--5s-blue-300`, `--5s-magenta`). Nếu chưa → import từ shared tokens file hoặc copy CSS variables vào `globals.css`.
> - Tất cả `text-blue-*` / `bg-blue-*` Tailwind classes trong analytics components PHẢI thay bằng arbitrary value syntax: `text-[var(--5s-blue)]` hoặc inline style `style={{ color: 'var(--5s-blue)' }}`.
> - Charts library (recharts) color prop dùng `var(--5s-blue)` cho area/bar fills.

### 5.2.1 Brand Token CSS Reference

```css
/* From reference-ui-selling-web/design-system/tokens.css — load vào admin globals.css */
:root {
  /* 5Solution brand DNA — shared across 5BIB/5Sport/5Ticket/5Pix/5Tech */
  --5s-blue:        #1D49FF;   /* primary — 5-family logo blue */
  --5s-blue-600:    #0B36E6;
  --5s-blue-700:    #0026B3;
  --5s-blue-400:    #4A6EFF;
  --5s-blue-300:    #88A2FF;
  --5s-blue-100:    #DCE3FF;
  --5s-magenta:     #FF0E65;   /* accent — 5-family logo magenta */
}
```

### 5.3 Typography
- **Page title:** Be Vietnam Pro, 24px, bold.
- **Section title:** Be Vietnam Pro, 18px, semibold.
- **KPI value:** JetBrains Mono, 28px, bold.
- **KPI label:** Inter, 14px, medium, stone-500.
- **Delta badge:** Inter, 12px, semibold, rounded-full.
- **Table header:** Inter, 13px, medium, uppercase, stone-400.
- **Table body:** Inter, 14px, normal, stone-700.
- **Tab label:** Inter, 14px, medium.
- **Breadcrumb:** Inter, 13px, normal, stone-400.

### 5.4 Animation
- Page load: sections stagger-in 200ms delay.
- Tab switch: content fade-in 150ms.
- Granularity change: chart crossfade 300ms.
- Accordion: slide-down 200ms ease-out.
- Delta badge: pulse 1× on data load.
- Card hover: translateY(-2px) + shadow-md 150ms.
- Heatmap cell hover: scale(1.1) + outline 100ms.

---

## 📋 Tóm tắt Feature Impact

### Backend Files Changed/New

| File | Action | Dòng ước tính |
|------|--------|--------------|
| `services/period-resolver.ts` | EXTEND | +40 |
| `analytics.service.ts` | EXTEND delegate | +100 |
| `analytics.controller.ts` | EXTEND +20 endpoints | +300 |
| `services/runner-analytics.service.ts` | NEW | +400 |
| `services/race-performance.service.ts` | NEW | +250 |
| `services/merchant-comparison.service.ts` | NEW | +200 |
| `services/ga4.service.ts` | NEW | +180 |
| `services/export.service.ts` | NEW | +200 |
| `dto/*.dto.ts` (~15 files) | NEW | +500 |
| `analytics.module.ts` | EXTEND | +20 |
| `merchant.service.ts` (flush extend) | EXTEND | +15 |
| **Tổng backend** | | **~2,205 LoC** |

### Admin Files Changed/New

| File | Action | Dòng ước tính |
|------|--------|--------------|
| `analytics/layout.tsx` | NEW (tab nav) | +80 |
| `analytics/page.tsx` | REFACTOR (Tab 1) | ~700 |
| `analytics/races/page.tsx` | NEW (Tab 2) | +350 |
| `analytics/merchants/page.tsx` | REFACTOR (Tab 3) | ~400 |
| `analytics/runners/page.tsx` | NEW (Tab 4) | +500 |
| `analytics/funnel/page.tsx` | REFACTOR (Tab 5) | ~200 |
| `analytics-labels.ts` | NEW | +60 |
| Components (~20 files) | NEW + REFACTOR | +2,000 |
| `api-hooks.ts` | EXTEND | +100 |
| **Tổng admin** | | **~4,390 LoC** |

### Test Files

| File | Dòng ước tính |
|------|--------------|
| `analytics-f060.spec.ts` (unit: 20 endpoints) | ~800 |
| `runner-analytics.spec.ts` | +300 |
| `race-performance.spec.ts` | +200 |
| `merchant-comparison.spec.ts` | +150 |
| `period-resolver.spec.ts` (extend) | +40 |
| `cache-invalidation.spec.ts` (extend) | +50 |
| `ga4.service.spec.ts` | +120 |
| `export.service.spec.ts` | +150 |
| **Tổng tests** | **~1,810 LoC** |

**Grand Total: ~8,405 LoC** (backend + admin + tests).

---

## 🔗 Technical Debt Reference

| TD ID | Mô tả | Hành động F-062 |
|-------|-------|----------------|
| **TD-F026-EXPORT-STUB** | Export chỉ stub | **✅ FIX** — implement Export endpoint (BR-SA-10) |
| **TD-F026-CACHE-INVALIDATE** | Cache không invalidate on write | **🟡 PARTIAL FIX** — extend flush helper +13 patterns (BR-SA-18) |
| **TD-F026-REPEAT-TREND-FORMULA** | RepeatAthleteService.computeTrend() trả `rate=100 if total>0` thay tỷ lệ repeat thật | ⚪ **OUT OF SCOPE** |
| **TD-F016-FINANCE-01** | 15 reconciliations cũ sai data | ⚪ **OUT OF SCOPE** — F-062 KHÔNG fix recon cũ, chỉ analytics aggregations mới luôn dùng F-040 cascade |
| **TD-F019-MULTITENANT** (Manager Adjustment #4 v3) | `LogtoAdminGuard` không enforce per-race tenant — global admin role có thể access analytics của ALL merchants | ⚪ **INHERITED — acceptable v1.** F-062 admin = trusted full access (back-office only, KHÔNG merchant self-serve). **Phase 2:** nếu ship merchant-self-serve analytics → cần thiết kế `RaceTenantGuard` decorator check `req.user.tenantId === race.tenantId`. Document để Coder/QC/Future-Manager biết inheritance, KHÔNG fix trong F-062. |
| **TD-F041-NO-TEST-RUNNER** | Frontend test runner Vitest/Jest chưa cài | ⚪ **INHERITED** — F-062 backend tests via Jest existing. Frontend tests spec-only docs (Playwright pending Phase 2 infra setup). |
| TD-F026-REPEAT-TREND-FORMULA | RepeatAthlete rate=100 sai | OUT OF SCOPE |
| TD-F016-FINANCE-01 | 15 reconciliation sai data | OUT OF SCOPE |

---

## ✅ Acceptance Criteria Summary

1. Admin mở `/analytics` → Tab 1 load < 3s LCP, tất cả 8 sections render.
2. Navigate 5 tabs → mỗi tab render đúng layout + data.
3. Granularity toggle Ngày/Tuần/Tháng → chart update chính xác.
4. Comparison WoW/MoM/YoY → delta % đúng trên KPI + Comparison Panel.
5. Tab 2 Hiệu suất Race → filter + chart + spotlight + paginated table hoạt động.
6. Tab 3 Merchant → scatter + health distribution + comparison table hoạt động.
7. Tab 4 Runner → heatmap + lead time + repeat + demographics + geographic render đúng.
8. Tab 5 Funnel → 5 stages + conversion rates hiện chính xác.
9. Export CSV/Excel → file download, UTF-8 VN đúng.
10. GA4 section → metrics nếu configured, placeholder nếu chưa.
11. Fee invariant → tất cả platformFee dùng FeeService cascade.
12. Cache invalidation → admin write → analytics cache flush.
13. Vietnamese labels → không render raw enum.
14. Period/granularity persist across tab navigation.
15. Performance → tất cả endpoint đạt SLA.
16. Tests → ≥130 test cases pass (TC-SA-01 → TC-SA-167).
17. Accordion F-026 → 6 panels lazy load khi expand.
18. Runner demographics → aggregate only, no individual PII.
19. **v3 (Adjustment #1):** `PeriodKind` + `GranularityKind` + `CompareKind` là 3 enum riêng biệt — KHÔNG có weekly/monthly trong PeriodKind. Frontend pass 3 query params riêng `?period=&granularity=&compare=`.
20. **v3 (Adjustment #2):** TTL cache align convention `TTL_CURRENT=900s, TTL_HISTORY=86400s` cho 24 cache keys.
21. **v3 (Adjustment #3):** PeriodSelector + CompareSelector + GranularityToggle = 3 components RIÊNG BIỆT. PeriodCompareSelector cũ `@deprecated` mark.
22. **v3 (Adjustment #4):** TD-F019-MULTITENANT documented inheritance trong PRD Technical Debt Reference section.
23. **v3 (Adjustment #5):** Brand tokens locked — `--5s-blue #1D49FF` + `--5s-magenta #FF0E65` thay Tailwind `text-blue-600`. Verify `globals.css` import 5Solution tokens.
24. **v3 (Adjustment #6 — BR-SA-24):** Tab 1 KPI strip có **5 cards** (added GMV Concentration "Top 5 races: X% GMV" với 3-tier threshold color).
25. **v3 (Adjustment #6 — BR-SA-25):** Tab 1 Section 3 Comparison Row có **5 cards** (added AOV current/previous/delta).
26. **v3 (Adjustment #6 — BR-SA-26):** Tab 3 KPI strip có **6 cards** (added Giữ chân YoY với null fallback "—" khi data <1 năm). DTO `MerchantHealthSummaryDto` extend `yoyRetentionRate: number | null`.

---

**Status:** 🔵 **READY (v3)** — PRD v3 sẵn sàng cho Manager review (`/5bib-plan`). All 6 Manager Adjustments applied.

**Next step:** Danny chạy `/5bib-plan` để Manager re-review PRD v3 — Manager verify 6 adjustments applied → upgrade verdict 🟡 APPROVED WITH ADJUSTMENTS → ✅ APPROVED → Coder bắt đầu `/5bib-code FEATURE-062-sales-analytics-dashboard`.

---

## 📝 Changelog v3 (BA, 2026-05-22)

Tóm tắt 6 Manager Adjustments đã apply lên PRD v2 → v3:

| # | Adjustment | Sections sửa | Status |
|---|------------|--------------|--------|
| 1 | GranularityKind tách khỏi PeriodKind | BR-SA-01 (rewrite), BR-SA-13 (extend), BR-SA-14 (rewrite), BR-SA-14b (NEW), BR-SA-14c (NEW), 3.4.3 Refactored period-resolver.ts spec | ✅ DONE |
| 2 | TTL align 900s/86400s | BR-SA-02..09 + BR-SA-20a..f + BR-SA-21a..c + BR-SA-22a..c + Endpoint 9-20 spec table (24 cache keys total) | ✅ DONE |
| 3 | Selector split 3 components | BR-SA-13/14/14b/14c (NEW BRs), 3.4.2 New Files (+PeriodSelector + CompareSelector), 3.4.3 PeriodCompareSelector → @deprecated | ✅ DONE |
| 4 | TD-F019-MULTITENANT documentation | Technical Debt Reference section table extended | ✅ DONE |
| 5 | 5Solution brand tokens lock | Section 5.2 Color Scheme + 5.2.1 Brand Token CSS Reference (NEW), 3.4.3 globals.css EXTEND | ✅ DONE |
| 6 | 3 strategic metrics (Concentration/AOV/YoY Retention) | BR-SA-24/25/26 (NEW BRs), Tab 1 Section 1 KPI strip (4→5 cards), Tab 1 Section 3 Comparison Row (4→5 cards), Tab 3 Section 1 KPI strip (5→6 cards), Tab 1+Tab 3 Field Sources tables extended, MerchantHealthSummaryDto extend `yoyRetentionRate` | ✅ DONE |
