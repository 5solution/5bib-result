# FEATURE-069: PRD Revision R2 — Address Manager NEEDS_REVISION verdict

**Status:** 🔵 READY (re-submit cho Manager `/5bib-plan`)
**Last updated:** 2026-06-04
**Author:** 5bib-po-ba
**Supersedes:** Tham chiếu cùng với `01-ba-prd.md` (R1) + `01-ba-prd-part2.md` (R1)
**Linked verdict:** `02-manager-plan.md` 🟡 NEEDS_REVISION (Manager 2026-06-04)
**Reviewer expectations:** Manager đọc 3 file (part1 R1 + part2 R1 + revision-r2) cùng nhau cho `/5bib-plan` lần 2

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` (197 dòng, 8 PAUSE đã đáp ứng)
- [x] Đã đọc `02-manager-plan.md` — verdict 🟡 NEEDS_REVISION với 5 GAP + 3 MINOR cần fix
- [x] Đã re-verify code thực tế (Manager spot-check pattern):
  - `period-resolver.ts:22` `PeriodKind = '7d' | '30d' | 'quarter' | 'year' | 'custom' | 'rolling12m'` — XÁC NHẬN không có `'90d'` literal
  - `period-resolver.ts:133-179` `buildDateFilter()` switch chỉ có 5 case (`'7d' | '30d' | 'quarter' | 'rolling12m' | 'custom'`). Thêm `'90d'` là additive
  - `fee.service.ts:1108` `computeFeeForOrdersAggregate(tenantId: number, orders, period, injectedConfig?)` — XÁC NHẬN nhận SINGLE tenantId. Cross-tenant aggregate PHẢI loop per tenant
  - `fee.service.ts:1144-1146` cascade defaults: `service_fee_rate=5.5%, manual_fee_per_ticket=5000 VNĐ, fee_vat_rate=0%` (Tier 3 fallback)
  - `logto-staff.guard.spec.ts` tồn tại → port pattern unit test cho `logto-merchant.guard.spec.ts`
- [x] Đã đọc `known-issues.md` — confirm TD-CI-001 wording

---

## 🎯 Scope of R2

R2 KHÔNG re-write toàn bộ PRD. R2 chỉ THÊM/SỬA các BR cụ thể Manager flag:

| Gap | Action | Touch |
|---|---|---|
| 🔴 GAP #1 PeriodKind | **MODIFY** BR-MP-25 + path `period-resolver.ts` | Coder phép modify backend `PeriodKind` (additive) |
| 🔴 GAP #2 Chart scope | **MODIFY** BR-MP-07 + Phase 2.2.3 layout | Lock Phase 1 = 4 chart (3 baseline + 1 AnStacked), defer 5 chart |
| 🔴 GAP #3 Aggregate cross-tenant | **NEW** BR-MP-21b + Phase 2.2.4b layout | Per-tenant fee loop + per-tenant breakdown table |
| 🟡 GAP #4 MANUAL fee display | **MODIFY** BR-MP-10 + BR-MP-11 + Phase 2.2.4 layout + TC-MP-08 | Dual fee display (% + VNĐ/vé) |
| 🟡 GAP #5 Logto Management API | **NEW** BR-MP-36 + MODIFY BR-MP-29 + **NEW** TC-MP-26/27 | M2M setup + lookup endpoint |
| 🟢 MINOR #1 `403_INACTIVE` | **MODIFY** BR-MP-27 error table | Thêm 1 row |
| 🟢 MINOR #2 Access lock | **NEW** BR-MP-37 | SETNX pattern port F-068 |
| 🟢 MINOR #3 TD-CI-001 | **NEW** BR-MP-28b | CI workflow concurrency mitigation |

---

## 🔴 GAP #1 RESOLUTION — Period strategy

**Decision (BA chọn Manager Option A):** Mở rộng `PeriodKind` thêm `'90d'` literal — additive, F-062 không bị break.

**Lý do chọn Option A (KHÔNG Option B = dùng `quarter`):**
- Merchant team MKT nói "90 ngày qua" theo natural language, KHÔNG nói "quý gần nhất". Calendar quarter (Q1=Jan-Mar, Q2=Apr-Jun) khác hẳn rolling 90d.
- Vào ngày 2026-04-15 (đầu Q2), `quarter` sẽ chỉ lấy 15 ngày data (1/4 → 15/4) — sai expectation merchant cần 90 ngày trailing.
- Cost thấp: thêm 1 case `'90d'` vào `buildDateFilter()` switch, pattern hệt `'30d'`/`'7d'`.

### MODIFIED BR-MP-25 — Period & Granularity cho Report (replace original)

Merchant portal report support:

**Period options:**
| Value | Label VN | Label EN | Behavior |
|---|---|---|---|
| `'7d'` | 7 ngày qua | Last 7 days | `now() - INTERVAL 7 DAY` (đã có F-062) |
| `'30d'` (default) | 30 ngày qua | Last 30 days | `now() - INTERVAL 30 DAY` (đã có F-062) |
| `'90d'` ⭐ NEW | 90 ngày qua | Last 90 days | `now() - INTERVAL 90 DAY` — **THÊM vào enum** |
| `'custom'` | Tùy chỉnh | Custom | Date range picker (`from`, `to` query params) |

**Granularity options (cho trend chart):**
- `'daily'` — Ngày / Daily (default cho 7d, 30d)
- `'weekly'` — Tuần / Weekly (default cho 90d ⭐ — auto-switch khi period chuyển sang 90d)
- `'monthly'` — Tháng / Monthly (chỉ available với 90d hoặc custom > 60 ngày)

### NEW BR-MP-25b — PeriodKind enum migration (Manager PAUSE point)

**🛑 PAUSE Coder TRƯỚC khi modify `period-resolver.ts`.** Coder dừng confirm với Manager:

1. Modify `backend/src/modules/analytics/services/period-resolver.ts`:
   - Line 22: `export type PeriodKind = '7d' | '30d' | '90d' | 'quarter' | 'year' | 'custom' | 'rolling12m';`
   - Line 133-179 `buildDateFilter()`: thêm case `'90d'` between case `'30d'` và case `'quarter'`:
     ```typescript
     case '90d': {
       const from = new Date(now);
       from.setDate(from.getDate() - 90);
       return { from, to: now, label: 'Last 90 days' };
     }
     ```
2. Modify `resolveBucketSize()` (line 289+): thêm logic auto-resolve `granularity='weekly'` cho `'90d'` default.
3. Modify `buildMetricCacheKey()` (line 356+): periodKey cho `'90d'` = `'90d'` literal (no special handling).

**Regression test bắt buộc (Coder write trước khi merge):**
- [ ] `period-resolver.spec.ts` thêm test `buildDateFilter('90d')` → returns `{ from: now - 90d, to: now }`
- [ ] `period-resolver.spec.ts` thêm test `resolveBucketSize` default cho `'90d'` → granularity `'weekly'`
- [ ] F-062 regression: chạy lại `analytics.controller.spec.ts` existing tests — verify pass (additive change, không break)

**Affected TC update:**
- All TC trong part2 reference `period=last_30_days` → giữ nguyên (default)
- Thêm TC-MP-22b: `GET /ticket-sales/trend?period=90d&granularity=weekly` → expect series length = 13 weeks (90 / 7 ≈ 12-13)

---

## 🔴 GAP #2 RESOLUTION — Phase 1 chart scope lock

**Decision (BA chọn Manager Option B "lean+1"):** Phase 1 ship **4 chart** (3 baseline trong PRD R1 + AnStacked vì chỉ rebucket SQL data hiện có). 5 chart còn lại (AnPace projection, AnVelocity campaigns, AnHeatmap, AnFunnel, AnCompare) → Phase 2 backlog.

**Lý do chọn lean+1:**
- AnStacked (stacked theo course over time) chỉ cần data đã có trong `order_metadata` × `race_course_id` — KHÔNG cần schema mới. Useful cho merchant: thấy course nào ramp nhanh.
- AnPace projection cần model dự báo + benchmark data → vượt scope analytics đơn thuần.
- AnVelocity campaign markers cần collection `marketing_campaigns` mới → tạo schema/CRUD vượt phạm vi reporting.
- AnHeatmap (hour × dayOfWeek aggregation) implementable nhưng UX value thấp cho MKT staff Phase 1.
- AnFunnel cần visit/cart tracking → 5BIB hiện KHÔNG track funnel events. NOT IMPLEMENTABLE Phase 1.
- AnCompare cần race edition linking schema (`previous_edition_race_id`) → vượt scope.

### MODIFIED BR-MP-07 — Ticket Sales Module — Data Shown (replace original)

Module "Báo cáo bán vé" Phase 1 hiển thị **CHÍNH XÁC** 4 chart + 4 KPI + 1 table, KHÔNG nhiều hơn:

| Component | Mô tả | Data source |
|---|---|---|
| 4 KPI cards | Tổng vé, Đã thanh toán, Chờ xử lý, Đã hủy (KHÔNG có cards tài chính) | `order_metadata` COUNT |
| Chart #1 — **AreaChart trend** | Xu hướng đăng ký theo ngày/tuần/tháng (1 line: orderCount) | `COUNT(order_metadata) GROUP BY DATE(payment_on)` bucket theo granularity |
| Chart #2 — **AnStacked** (NEW Phase 1) | Stacked area chart theo course over time (mỗi course = 1 layer màu) | `COUNT(order_metadata) GROUP BY race_course_id, DATE(payment_on)` bucket |
| Chart #3 — Horizontal Bar | Breakdown theo course (tổng) | `COUNT GROUP BY race_course_id` |
| Chart #4 — Donut | Breakdown theo loại vé | `COUNT GROUP BY ticket_type_id` |
| Order table | 20 row/page với filter + search | `order_metadata` paginated |

**KHÔNG HIỂN THỊ tài chính (BR-MP-09 strict):** `total_price`, `unit_price`, GMV, fee, Net.

### NEW BR-MP-07b — Phase 2 backlog chart library (out of Phase 1 scope)

Defer các chart sau, KHÔNG implement Phase 1:

| Chart | Lý do defer | Schema/data dependency |
|---|---|---|
| **AnPace** Lũy kế + dự báo | Cần ML projection model | Benchmark data per race per edition |
| **AnVelocity** Tốc độ + campaign markers | Cần collection mới | `marketing_campaigns: { raceId, startDate, endDate, label, type }` |
| **AnHeatmap** Khung giờ vàng (hour × DOW) | Implementable nhưng UX low value Phase 1 | Aggregation `HOUR(payment_on)` × `DAYOFWEEK(payment_on)` |
| **AnFunnel** Phễu chuyển đổi | NOT implementable — KHÔNG có funnel tracking | Cần collection mới `funnel_events: { sessionId, event, raceId, ts }` |
| **AnCompare** vs mùa trước | Cần edition linking schema | `races.previous_edition_id` field hoặc `race_editions` mapping |

**Manager note:** Sau khi Phase 1 ship, BA mở feature riêng cho Phase 2 chart library (FEATURE-070?). Coder Phase 1 KHÔNG đụng 5 chart trên.

### MODIFIED Phase 2.2.3 Ticket Sales page layout (replace original)

| Vùng | Mô tả |
|---|---|
| **Header** | Title "Báo cáo bán vé" + tên giải. Phải: nút "Xuất Excel" (icon Download). |
| **KPI row (4 cards, grid 4 cột)** | (KHÔNG đổi) — Tổng vé / Đã thanh toán / Chờ xử lý / Đã hủy với delta % |
| **Chart 1 — AreaChart trend** | (KHÔNG đổi) — Xu hướng đăng ký 1 line, gradient blue fill |
| **Chart 2 — AnStacked** ⭐ NEW | Stacked area chart `width: 1040, height: 250`. Title "Cơ cấu đăng ký theo cự ly". X-axis = thời gian (theo granularity). Y-axis = số vé. Mỗi cự ly (course) = 1 layer màu (palette 5Solution blue ramp + warning + danger). Legend top với toggle on/off per course (click ẩn/hiện layer). Tooltip hover hiện breakdown per course + tổng. Empty state nếu 0 courses: "Chưa có dữ liệu cự ly." |
| **Breakdown row (2 cột, 50/50)** | (KHÔNG đổi) — HorizontalBarChart theo course + DonutChart theo ticket type |
| **Table section** | (KHÔNG đổi) — Order detail table 20 row/page |
| **Footer** | "Cập nhật lúc: {timestamp}" |

### NEW Backend endpoint cho AnStacked (BR-MP-26 extend)

| Method | Path | Guard | Mô tả |
|---|---|---|---|
| GET | `/api/merchant-portal/ticket-sales/stacked` | LogtoMerchantGuard | Stacked data theo course × time bucket |

**Response DTO:**
```typescript
class TicketSalesStackedDto {
  @ApiProperty({ description: 'Race ID đã filter' })
  raceId!: number;

  @ApiProperty({ enum: ['7d', '30d', '90d', 'custom'] })
  period!: PeriodKind;

  @ApiProperty({ enum: ['daily', 'weekly', 'monthly'] })
  granularity!: GranularityKind;

  @ApiProperty({ description: 'Course list theo thứ tự hiển thị (ổn định trên các call)', type: [Object] })
  courses!: Array<{ courseId: number; courseName: string; colorHint: string }>;

  @ApiProperty({ description: 'Time series, mỗi entry có counts per courseId' })
  series!: Array<{ date: string; counts: Record<number, number> /* courseId → count */ }>;
}
```

**Cache key:** `merchant-portal:ticket-stacked:<userId>:<raceId>:<periodKey>:<granularity>` TTL 60s.

### NEW TC-MP-22c — AnStacked endpoint

| Field | Value |
|---|---|
| Method | GET |
| URL | `/api/merchant-portal/ticket-sales/stacked` |
| Headers | `Authorization: Bearer <merchant_viewer_token>` |
| Body/Query | `?raceId=501&period=30d&granularity=daily` |
| Expected status | 200 |
| Expected body | `{ raceId: 501, period: '30d', granularity: 'daily', courses: [...], series: [{ date, counts: {123: 5, 124: 3} }] }` |
| MUST NOT leak | `gmv`, `fee`, `total_price`, `unit_price`, bất kỳ field tài chính nào. `counts` object KHÔNG chứa key money/revenue |
| Side effect | Cache key set TTL 60s. Verify series length khớp granularity (30d daily → 30; 30d weekly → 5; 90d weekly → 13) |

---

## 🔴 GAP #3 RESOLUTION — Cross-tenant aggregate spec

**Decision:** Implement aggregate view với per-tenant breakdown table. Fee tính theo **per-tenant loop pattern** (an toàn vì `FeeService.computeFeeForOrdersAggregate()` chỉ nhận single tenantId — verified 2026-06-04).

### NEW BR-MP-21b — Cross-Tenant Aggregate Fee Compute Logic

Khi merchant_finance chọn "Tất cả BTC" trên agency account (BR-MP-21), service tính fee theo pattern **per-tenant loop**:

```
for each tenantId in user.tenantIds:
  orders_t = pullOrdersForFeeAggregate(db, clause, params, { tenantId })
  feeResult_t = FeeService.computeFeeForOrdersAggregate(tenantId, orders_t, period, config_t)
  byTenant[tenantId] = feeResult_t
gmv_total = SUM(byTenant[*].gmv)
fee_total = SUM(byTenant[*].fee)
net_total = gmv_total - fee_total
```

**Lý do per-tenant loop (KHÔNG single multi-tenant query):**
- `FeeService.computeFeeForOrdersAggregate(tenantId, ...)` chỉ nhận 1 tenantId — verified code line 1108.
- Mỗi tenant có `merchant_configs.service_fee_rate` riêng → KHÔNG thể compute correct fee với single multi-tenant aggregation.
- Cascade Tier 0 (event_fee_overrides per race) cũng cần config theo tenant của race đó.

**Performance:**
- N tenants → N FeeService calls per request. Agency account thường có 2-5 tenants → acceptable.
- Pre-load all MerchantConfig 1 lần qua batch `$in` query (F-059 pattern), pass `injectedConfig` vào mỗi call → tránh N+1.
- Cron pre-warm aggregate cache mỗi 5 phút cho active agency (BR-MP-30 mở rộng).

### NEW BR-MP-21c — Aggregate Response Shape

Cross-tenant aggregate Revenue summary response:

```typescript
class RevenueSummaryAggregateDto {
  @ApiProperty({ description: 'Aggregate mode flag — true nếu user chọn "Tất cả BTC"' })
  isAggregate!: boolean;

  @ApiProperty({ description: 'Tenant IDs đã include trong aggregate' })
  tenantIds!: number[];

  // Aggregate totals
  @ApiProperty() totalGmv!: number;
  @ApiProperty() totalPlatformFee!: number;
  @ApiProperty() totalNetRevenue!: number;
  @ApiProperty() totalOrderCount!: number;

  // Per-tenant breakdown — KEY ADDITION
  @ApiProperty({ type: [Object], description: 'Breakdown từng tenant' })
  byTenant!: Array<{
    tenantId: number;
    tenantName: string;
    gmv: number;
    platformFee: number;
    netRevenue: number;
    orderCount: number;
    feeRatePercent: number;        // ⭐ NEW — % rate cho ORDINARY/GROUP_BUY của tenant này
    manualFeePerTicket: number;    // ⭐ NEW — VNĐ/vé cho MANUAL của tenant này (GAP #4 dual)
    pctOfTotal: number;            // tenant gmv / total gmv * 100
  }>;

  // Per-category breakdown (giữ pattern BR-MP-12 cho whole aggregate)
  @ApiProperty({ type: [Object] })
  byCategory!: Array<{
    category: 'ORDINARY' | 'GROUP_BUY' | 'MANUAL';
    label: { vi: string; en: string };
    gmv: number;
    fee: number;
    net: number;
    orderCount: number;
    pctOfGmv: number;
  }>;
}
```

**Single-tenant mode (user chỉ có 1 tenantId hoặc chọn 1 tenant cụ thể):**
- `isAggregate: false`
- `byTenant` array length 1 (vẫn return, để frontend render thống nhất)
- `feeRatePercent` + `manualFeePerTicket` chính xác cho tenant đó

### NEW Phase 2.2.4b — Aggregate Revenue page layout

Khi merchant_finance chọn "Tất cả BTC" dropdown sidebar (UI mockup `RaceListScreen` đã có), navigate `/revenue?aggregate=1`:

| Vùng | Mô tả |
|---|---|
| **Header** | Title "Báo cáo doanh thu — Tất cả BTC" + chip "{N} BTC, {M} giải". Phải: nút "Xuất Excel". **KHÔNG có fee rate badge đơn** (vì nhiều mức) → thay bằng note nhỏ italic "Mỗi BTC có mức phí riêng — xem chi tiết bảng bên dưới." |
| **KPI row (3 cards)** | `Tổng GMV` / `Tổng Phí 5BIB` / `Tổng Doanh thu rộng` — aggregate across tenants. Delta % so với period trước |
| **Chart section** | AreaChart 3 line (GMV / Fee / Net) — aggregate series over time. Tooltip hover hiện tổng + breakdown per tenant (sub-line nhỏ) |
| **Per-tenant breakdown table** ⭐ NEW | Title "Theo BTC". Cột: BTC name, Số đơn, GMV, Phí 5BIB, Doanh thu rộng, **Mức phí (%)**, **Phí vé thủ công (VNĐ/vé)**, % tổng GMV. Row cuối: Tổng cộng (bold). |
| **Per-category breakdown table** | (Giữ nguyên BR-MP-12 layout) — Theo loại đơn aggregate across tenants |
| **Footer** | "Cập nhật lúc: {timestamp}" |

### MODIFIED BR-MP-26 — API Endpoint Scoping pattern

Endpoint Revenue cần phân biệt single-tenant vs aggregate:

| Endpoint | Behavior |
|---|---|
| `GET /revenue/summary?raceId=X` | Single race (single-tenant implicit) |
| `GET /revenue/summary?tenantId=Y` | Single tenant aggregate (all races của tenant Y) |
| `GET /revenue/summary` (no `raceId`, no `tenantId`) | **CROSS-TENANT aggregate** mode — response `isAggregate: true` với `byTenant[]` đầy đủ |

Controller validate:
- Nếu user `tenantIds.length === 1` → `isAggregate` luôn `false` (single tenant)
- Nếu user `tenantIds.length >= 2` AND no `raceId`/`tenantId` → `isAggregate: true`
- Nếu user pass `tenantId` không thuộc `user.tenantIds` → 403 `403_NO_TENANT`

### NEW TC-MP-28 — Cross-tenant aggregate revenue happy path

| Field | Value |
|---|---|
| Method | GET |
| URL | `/api/merchant-portal/revenue/summary` |
| Headers | `Authorization: Bearer <merchant_finance_agency_token>` (userId = USER_AGENCY, tenantIds = [42, 99, 17]) |
| Body/Query | `?period=30d` (no raceId, no tenantId — aggregate mode) |
| Expected status | 200 |
| Expected body | `{ isAggregate: true, tenantIds: [42, 99, 17], totalGmv: >0, totalPlatformFee: >0, totalNetRevenue: totalGmv - totalPlatformFee, byTenant: [{ tenantId: 42, tenantName: string, gmv, platformFee, netRevenue, orderCount, feeRatePercent, manualFeePerTicket, pctOfTotal }, ... 3 entries], byCategory: [3 entries] }` |
| MUST NOT leak | Tenant IDs USER_AGENCY KHÔNG có trong `user.tenantIds`. Verify response `byTenant` length === user.tenantIds.length |
| Side effect | Verify `FeeService.computeFeeForOrdersAggregate()` được call EXACTLY 3 lần (1 per tenant). Cache key: `merchant-portal:revenue:<userId>:agg:<periodKey>` TTL 60s |

### NEW TC-MP-29 — Cross-tenant aggregate excluding unassigned tenant

| Field | Value |
|---|---|
| Method | GET |
| URL | `/api/merchant-portal/revenue/summary` |
| Headers | `Authorization: Bearer <merchant_finance_agency_token>` (tenantIds = [42, 99]) |
| Body/Query | `?tenantId=17` (tenant 17 NOT in user's tenantIds) |
| Expected status | 403 |
| Expected body | `{ statusCode: 403, errorCode: '403_NO_TENANT', message: { vi: 'Bạn không có quyền xem BTC này', en: "You don't have access to this merchant" } }` |
| MUST NOT leak | Bất kỳ data nào của tenant 17, kể cả tên |
| Side effect | Không. Log warn `IDOR attempt: userId=USER_AGENCY tried tenantId=17` |

### NEW E2E-MP-09 — Aggregate vs Per-tenant view

```
Precondition: User agency merchant_finance, tenantIds [42, 99]
Steps:
  1. Login → sidebar dropdown "Tất cả BTC" selected default
  2. Navigate /revenue (aggregate mode)
  3. Verify header "Báo cáo doanh thu — Tất cả BTC" + chip "2 BTC, N giải"
  4. Verify KHÔNG có fee rate badge đơn, có note italic "Mỗi BTC có mức phí riêng..."
  5. Verify 3 KPI cards aggregate (GMV / Fee / Net)
  6. Verify per-tenant breakdown table có 2 row + 1 row "Tổng cộng"
  7. Click dropdown → select "BTC Alpha" (tenant 42)
  8. Verify header thay đổi "Báo cáo doanh thu — BTC Alpha"
  9. Verify fee rate badge xuất hiện single (vd "Mức phí hiện tại: 5.5%")
  10. Verify breakdown KHÔNG còn per-tenant (chỉ per-category)
Expected: Aggregate mode + single-tenant mode chuyển đổi mượt, data scope đúng
```

---

## 🟡 GAP #4 RESOLUTION — MANUAL fee display

**Decision:** Dual fee display — hiển thị **2 line** trong fee context (badge KPI + breakdown table cột).

### MODIFIED BR-MP-10 — Revenue Module Data Shown (replace original "Fee rate hiện tại" row)

| Metric | Mô tả | Calculation |
|---|---|---|
| GMV | Sum `total_price - total_discounts` của paid orders | SQL SUM |
| Phí 5BIB | Phí platform tính qua FeeService 4-tier cascade | `FeeService.computeFeeForOrdersAggregate()` |
| Net Revenue | GMV - Phí 5BIB | Computed |
| Revenue breakdown theo loại đơn | (KHÔNG đổi) | Group by ORDINARY/GROUP_BUY/MANUAL |
| Xu hướng doanh thu | (KHÔNG đổi) | Time series GMV/Fee/Net |
| **Mức phí hiện tại** ⭐ MODIFIED | **2 thành phần riêng:** (a) **% rate** áp dụng cho đơn ORDINARY + GROUP_BUY (b) **VNĐ/vé** áp dụng cho đơn MANUAL | FeeService cascade lookup, return cả `feeRatePercent` + `manualFeePerTicket` |

### MODIFIED BR-MP-11 — Revenue Module Fee Calculation (replace "Hiển thị fee rate" paragraph)

PHẢI reuse `FeeService.computeFeeForOrdersAggregate()` — verified line 1108 nhận `tenantId, orders, period, injectedConfig?`. Service cascade Tier 0 (event_fee_overrides per race) → Tier 1 (merchant_configs) → Tier 3 fallback (5.5% / 5000 VNĐ).

**Response shape (single-tenant single-race, MODIFIED):**

```typescript
class RevenueSummaryDto {
  @ApiProperty() raceId!: number;
  @ApiProperty() raceName!: string;
  @ApiProperty() gmv!: number;
  @ApiProperty() platformFee!: number;
  @ApiProperty() netRevenue!: number;

  // ⭐ MODIFIED — dual fee fields
  @ApiProperty({ description: 'Phí % áp dụng cho đơn ORDINARY + GROUP_BUY', minimum: 0, maximum: 100 })
  feeRatePercent!: number;

  @ApiProperty({ description: 'Phí cố định VNĐ/vé áp dụng cho đơn MANUAL', minimum: 0 })
  manualFeePerTicket!: number;

  @ApiPropertyOptional({ description: 'Note hiển thị nếu race có override' })
  feeRateSource?: 'event_override' | 'merchant_default' | 'platform_default';

  @ApiProperty() orderCount!: number;

  @ApiProperty({ type: [Object] })
  byCategory!: Array<{
    category: 'ORDINARY' | 'GROUP_BUY' | 'MANUAL';
    label: { vi: string; en: string };
    gmv: number;
    fee: number;
    net: number;
    orderCount: number;
    pctOfGmv: number;
  }>;
}
```

**Display logic (Phase 2.2.4 MODIFIED layout for fee rate badge area):**

```
┌─────────────────────────────────────┐
│ Báo cáo doanh thu — Trail Đà Lạt    │
│ ┌──────────────────────────────┐    │
│ │ 💰 Mức phí hiện tại:         │    │
│ │   • Đơn thường / Mua nhóm: 5.5% │
│ │   • Đơn thủ công: 5,000 đ/vé  │    │
│ │   (Nguồn: Cấu hình BTC)      │    │
│ └──────────────────────────────┘    │
└─────────────────────────────────────┘
```

UI mockup `RevenueScreen` cần update:
- Thay 1 badge `Mức phí hiện tại: 5.5%` thành **stack 2 line**:
  - Line 1: `Đơn thường / Mua nhóm: {feeRatePercent}%` (icon Percent, color blue)
  - Line 2: `Đơn thủ công: {format_vnd(manualFeePerTicket)}/vé` (icon Coins, color orange)
- Tooltip hover badge hiện source: "Áp dụng từ {feeRateSource}: cấu hình BTC / override theo giải / mặc định platform"
- Khi `byCategory.find(c => c.category === 'MANUAL').orderCount === 0` → ẨN line 2 (không relevant)
- Khi `byCategory.find(c => c.category === 'ORDINARY').orderCount === 0 && byCategory.find(c => c.category === 'GROUP_BUY').orderCount === 0` → ẨN line 1

### MODIFIED TC-MP-08 — Revenue summary happy path

| Field | Value |
|---|---|
| Method | GET |
| URL | `/api/merchant-portal/revenue/summary` |
| Headers | `Authorization: Bearer <merchant_finance_token>` |
| Body/Query | `?raceId=501&period=30d` |
| Expected status | 200 |
| Expected body | `{ raceId: 501, raceName: string, gmv: number, platformFee: number, netRevenue: number, feeRatePercent: number, manualFeePerTicket: number, feeRateSource: 'event_override'\|'merchant_default'\|'platform_default', orderCount: number, byCategory: [3 entries] }` |
| MUST NOT leak | (KHÔNG đổi) — other tenants' data, raw `_id`. KHÔNG leak `merchant_configs._id` của tenant khác |
| Side effect | (KHÔNG đổi) + verify response có CẢ `feeRatePercent` AND `manualFeePerTicket` (không null). Verify byCategory MANUAL.fee tính bằng `orderCount × manualFeePerTicket` khi quantity=1, hoặc `SUM(quantity) × manualFeePerTicket` general |

### NEW TC-MP-08b — Revenue with MANUAL orders correctness

| Field | Value |
|---|---|
| Method | GET |
| URL | `/api/merchant-portal/revenue/summary` |
| Headers | `Authorization: Bearer <merchant_finance_token>` |
| Body/Query | `?raceId=501` (race có cả ORDINARY và MANUAL orders) |
| Expected status | 200 |
| Expected body | `byCategory[MANUAL].fee === SUM(quantity for MANUAL orders) × manualFeePerTicket` (math check). KHÔNG bằng `byCategory[MANUAL].gmv × feeRatePercent / 100` |
| MUST NOT leak | KHÔNG. |
| Side effect | Verify FeeService dùng `manual_fee_per_ticket` từ MerchantConfig cho MANUAL category, dùng `service_fee_rate` cho ORDINARY/GROUP_BUY. Spy assertion |

---

## 🟡 GAP #5 RESOLUTION — Logto Management API integration

### NEW BR-MP-36 — Logto Management API Service

Backend cần truy cập Logto Management API để lookup user (admin click "Tìm" trong AccessConfigDialog). Setup theo pattern proven:

**Service:** `backend/src/modules/logto-auth/logto-management.service.ts`

```typescript
@Injectable()
export class LogtoManagementService {
  private cachedToken: { accessToken: string; expiresAt: number } | null = null;

  // M2M token (cache 60min TTL)
  private async getM2MToken(): Promise<string> { ... }

  // Lookup user by Logto userId
  async lookupById(userId: string): Promise<LogtoUserInfo | null> { ... }

  // Lookup user by email (case-insensitive)
  async lookupByEmail(email: string): Promise<LogtoUserInfo | null> { ... }
}

type LogtoUserInfo = {
  userId: string;
  email: string;
  name: string | null;
  username: string | null;
};
```

**Behavior:**
- M2M token cached in-memory với TTL ~50min (Logto issue token 60min, refresh 10min trước expiry)
- Lookup result cached Redis `logto-lookup:byid:<userId>` hoặc `logto-lookup:byemail:<hashed>` TTL 300s — tránh hit Logto Management API spam
- Logto API 5xx → return `null` + log warn (graceful degrade)
- Logto API 404 → return `null` (user not found)
- M2M auth fail (401 từ Logto token endpoint) → throw `InternalServerErrorException('Lỗi xác thực Logto Management API')` + log error

**Env vars (NEW, Coder add vào `src/config/env.ts`):**
```
LOGTO_M2M_APP_ID=<app id from Logto Dashboard>
LOGTO_M2M_APP_SECRET=<client secret>
LOGTO_MANAGEMENT_API_RESOURCE=https://default.logto.app/api  (default value)
```

### NEW BR-MP-36b — Admin Lookup Endpoint

**Endpoint table:**

| Element | Spec |
|---|---|
| Method | GET |
| Path | `/api/admin/merchant-portal/logto-lookup` |
| Auth | `@UseGuards(LogtoAdminGuard)` |
| Guard role | admin / super_admin |
| Query DTO | `LogtoLookupQueryDto { q: string }` (min 3 ký tự) |
| Response DTO | `LogtoLookupResponseDto { found: boolean; user: LogtoUserInfo \| null; source: 'cache' \| 'api' }` |
| Status codes | 200 ok / 400 query too short / 401 unauth / 403 not admin / 503 Logto unreachable |
| Side effects | Cache lookup result Redis 5min. Log info `logto.lookup actor=<adminId> q=<q> found=<bool>` |

**Query parameter logic:**
- Nếu `q` match regex `^[a-zA-Z0-9_-]{8,}$` AND không chứa `@` → treat as Logto userId, call `lookupById(q)`
- Nếu `q` chứa `@` → treat as email, call `lookupByEmail(q)`
- Nếu `q.length < 3` → 400 `400_QUERY_TOO_SHORT`

**Validation DTO:**
```typescript
class LogtoLookupQueryDto {
  @ApiProperty({ description: 'Logto userId hoặc email', minLength: 3, maxLength: 254 })
  @IsString()
  @MinLength(3, { message: 'Từ khóa tìm kiếm phải ít nhất 3 ký tự' })
  @MaxLength(254)
  q!: string;
}
```

### MODIFIED BR-MP-29 — Logto Configuration Requirements (extend with step 5)

Section "Danny cần thực hiện trong Logto Dashboard" THÊM step 5:

5. **M2M Application cho Management API access:**
   - Logto Dashboard → Applications → Create application → type "Machine-to-Machine"
   - Name: "5BIB Backend M2M (Management API)"
   - API resource: Logto Management API (chuẩn auto-provisioned)
   - Permissions: tick `read:users` (minimal — KHÔNG cấp `manage:*`)
   - Copy `App ID` + `App Secret` → Danny share vào `.env` của backend:
     ```
     LOGTO_M2M_APP_ID=<copy>
     LOGTO_M2M_APP_SECRET=<copy>
     ```
   - 🛑 PAUSE Manager: confirm `.env` đã được set trên DEV + PROD trước khi Coder push

### NEW TC-MP-26 — Logto lookup by userId happy path

| Field | Value |
|---|---|
| Method | GET |
| URL | `/api/admin/merchant-portal/logto-lookup` |
| Headers | `Authorization: Bearer <admin_token>` |
| Body/Query | `?q=logto_4a9f2b71c0` |
| Expected status | 200 |
| Expected body | `{ found: true, user: { userId: 'logto_4a9f2b71c0', email: 'a@btc.vn', name: 'Nguyễn Văn A', username: 'a.nguyen' }, source: 'api' }` |
| MUST NOT leak | Tokens, internal Logto roles, scope claims, password hash. Chỉ field `userId/email/name/username` |
| Side effect | Redis cache `logto-lookup:byid:logto_4a9f2b71c0` set TTL 300s. Subsequent call trong 300s → `source: 'cache'`. Logto Management API endpoint hit chỉ 1 lần |

### NEW TC-MP-27 — Logto lookup by email + 503 degrade

| Field | Value |
|---|---|
| Method | GET |
| URL | `/api/admin/merchant-portal/logto-lookup` |
| Headers | `Authorization: Bearer <admin_token>` |
| Body/Query | `?q=admin@btc.vn` (Logto Management API mocked 5xx response) |
| Expected status | 503 |
| Expected body | `{ statusCode: 503, errorCode: '503_LOGTO_UNREACHABLE', message: { vi: 'Không thể tra cứu Logto. Vui lòng nhập thông tin user thủ công.', en: 'Cannot lookup Logto. Please enter user info manually.' } }` |
| MUST NOT leak | Logto API URL, M2M client_id, stack trace |
| Side effect | Cache KHÔNG set. Log warn `logto.lookup actor=<adminId> q=admin@btc.vn error=upstream_5xx` |

### NEW TC-MP-27b — Logto lookup 400 query too short

| Field | Value |
|---|---|
| Method | GET |
| URL | `/api/admin/merchant-portal/logto-lookup` |
| Headers | `Authorization: Bearer <admin_token>` |
| Body/Query | `?q=ab` (2 ký tự) |
| Expected status | 400 |
| Expected body | `{ statusCode: 400, errorCode: '400_QUERY_TOO_SHORT', message: { vi: 'Từ khóa tìm kiếm phải ít nhất 3 ký tự', en: 'Search query must be at least 3 characters' } }` |
| MUST NOT leak | KHÔNG |
| Side effect | Không hit Logto. KHÔNG cache |

### NEW Admin Config Dialog UI flow update (Phase 2.2.6 extend)

Khi admin click button "Tìm" trong dialog:

| Step | UI behavior |
|---|---|
| 1. Admin nhập text vào input `userId` (vd `logto_4a9f` hoặc `a@btc.vn`) | Input border default |
| 2. Click "Tìm" | Button disable + spinner replace icon Search. Input `userName` + `email` show skeleton |
| 3. Backend call `/api/admin/merchant-portal/logto-lookup?q=` | Loading 300-1500ms typical |
| 4a. Success | `userName` + `email` auto-fill. Border `userId` input → success green. Toast nhỏ "Đã tìm thấy user" |
| 4b. Found = false (404) | Error text đỏ dưới input `userId`: "Không tìm thấy user với từ khóa này trên Logto". `userName` + `email` cleared |
| 4c. 503 | Toast warning vàng: "Logto Management API tạm không phản hồi. Vui lòng nhập thông tin user thủ công." `userName` + `email` input enable, admin nhập tay |
| 4d. 400 | Error text đỏ: "Từ khóa tìm kiếm phải ít nhất 3 ký tự" |

---

## 🟢 MINOR #1 RESOLUTION — `403_INACTIVE` error code

### MODIFIED BR-MP-27 — Error Messages (append row)

Thêm vào error table cuối BR-MP-27:

| Code | Vi | En |
|---|---|---|
| 403_INACTIVE | Tài khoản đã bị vô hiệu hóa | Account has been deactivated |
| 503_LOGTO_UNREACHABLE | Không thể tra cứu Logto. Vui lòng nhập thông tin user thủ công. | Cannot lookup Logto. Please enter user info manually. |
| 400_QUERY_TOO_SHORT | Từ khóa tìm kiếm phải ít nhất 3 ký tự | Search query must be at least 3 characters |
| 429_RATE_LIMIT_EXPORT | Vui lòng chờ {N} giây giữa các lần xuất file | Please wait {N} seconds between export requests |

(Existing 9 codes giữ nguyên — thêm 4 row trên là full update R2.)

---

## 🟢 MINOR #2 RESOLUTION — Concurrent admin save race condition

### NEW BR-MP-37 — Access Config Mutation Lock (port F-068 pattern)

Khi admin POST/PATCH/DELETE access config, race condition có thể xảy ra (2 admin click "Lưu" đồng thời cho cùng `userId`). Port pattern F-068 `reset-lock:` SETNX:

**Redis key:** `merchant-access-lock:<userId>` TTL 10s

**Flow:**
1. Admin POST/PATCH/DELETE access config → service trước khi mutate gọi `redis.set('merchant-access-lock:<userId>', actorId, 'EX', 10, 'NX')`
2. Nếu `OK` → acquired lock → proceed (sau khi xong: `redis.del(lock_key)` trong `try/finally` để release cả on throw)
3. Nếu `null` (key đã tồn tại) → throw `ConflictException` với code `409_CONCURRENT_EDIT`:
   ```json
   { "statusCode": 409, "errorCode": "409_CONCURRENT_EDIT",
     "message": { "vi": "Đang có admin khác cập nhật quyền của user này, vui lòng thử lại sau vài giây.",
                  "en": "Another admin is updating this user's access, please retry in a few seconds." } }
   ```

**Note:** Lock pattern tương đương F-068 `reset-lock:<raceId>:<courseId>` đã proven. KHÔNG dùng MongoDB session/transaction (overhead cao, không cần consistency cross-doc).

### NEW TC-MP-30 — Concurrent admin save (race condition)

| Field | Value |
|---|---|
| Method | POST × 2 (Promise.all) |
| URL | `/api/admin/merchant-portal/access` |
| Headers | Call 1: `Bearer <admin_A_token>`. Call 2: `Bearer <admin_B_token>` |
| Body | Both: `{ userId: 'logto_concurrent_test', tenantIds: [42], permissions: ['ticket_report'] }` |
| Expected status | 1 call → 201; 1 call → 409 (timing-dependent which is which) |
| Expected body | Winner: standard create response. Loser: `{ statusCode: 409, errorCode: '409_CONCURRENT_EDIT', message: { vi, en } }` |
| MUST NOT leak | Loser KHÔNG biết winner là admin nào (actor ID không leak trong error). KHÔNG có MongoDB E11000 stack trace leaked |
| Side effect | MongoDB collection có CHÍNH XÁC 1 document (KHÔNG 2 docs, KHÔNG 0 docs). Audit log có CHÍNH XÁC 1 entry `merchant_access.create`. Lock key tự release sau success/fail (verify with second Promise.all 12s sau — phải succeed nếu KHÔNG có conflict khác) |

### NEW SEC-16 — Access mutation lock prevents race condition

- [ ] Concurrent POST same userId → exactly 1 success + 1 409 `409_CONCURRENT_EDIT`. Unit test TC-MP-30 pass.
- [ ] Lock released trong `try/finally` → second attempt sau 12s succeed.
- [ ] Lock key TTL 10s — verify expire tự động kể cả service crash giữa chừng.

---

## 🟢 MINOR #3 RESOLUTION — TD-CI-001 mitigation

### NEW BR-MP-28b — CI/CD Workflow TD-CI-001 Mitigation Mandate

Theo `known-issues.md` TD-CI-001 🔴 CRITICAL (PROD compose tag race condition khi concurrent runs), feature này THÊM service thứ 4 (`merchant-portal`) vào pipeline làm tăng risk. Coder PHẢI apply mitigation **TRONG SAME PR** thêm merchant-portal service vào CI:

#### Modify `.github/workflows/build-and-deploy.yml` + `deploy-production.yml`

**Required changes:**

1. **Concurrency lock (top-level):**
   ```yaml
   concurrency:
     group: deploy-production
     cancel-in-progress: false
   ```
   Serialize tất cả run vào group này — Run B chờ Run A finish.

2. **workflow_dispatch ref validation (deploy-production.yml):**
   ```yaml
   - name: Validate trigger branch
     if: github.event_name == 'workflow_dispatch'
     run: |
       if [[ ! "${{ github.ref }}" =~ ^refs/heads/release/ ]]; then
         echo "::error::workflow_dispatch only allowed from release/* branches"
         exit 1
       fi
   ```

3. **Post-deploy verify (deploy-production.yml end of job):**
   ```yaml
   - name: Verify all 4 service container tags match compose pins
     run: |
       ssh 5solution-vps "cd /opt/5bib-result-production && \
         for svc in backend frontend admin merchant-portal; do \
           compose_tag=$(grep -A1 \"image: ghcr.io/5solution/5bib-result/$svc:\" docker-compose.yml | head -1 | sed -E 's/.*:(.*)/\1/'); \
           container_tag=$(docker inspect 5bib-result-$svc --format '{{.Config.Image}}' | sed -E 's/.*:(.*)/\1/'); \
           if [[ \"$compose_tag\" != \"$container_tag\" ]]; then \
             echo \"::error::$svc tag mismatch: compose=$compose_tag container=$container_tag\"; exit 1; \
           fi; \
         done"
   ```

4. **Backup compose before sed:**
   ```yaml
   - name: Backup compose
     run: ssh 5solution-vps "cd /opt/5bib-result-production && cp docker-compose.yml{,.bak.$(date +%s)}"
   ```

5. **Manager `/5bib-deploy` checklist update** (Manager memory action item — Manager update sau ship):
   - Check tất cả **4** PROD container image tag (backend, frontend, admin, **merchant-portal**), KHÔNG chỉ backend.

**🛑 PAUSE Manager before merging PR with CI workflow changes** — Manager spot-check YAML + dry-run trên branch trước khi merge.

### NEW TC-MP-31 — CI workflow concurrency (verify trên staging)

| Field | Value |
|---|---|
| Test type | Manual integration test (NOT automated unit test) |
| Setup | Tag 2 release branches `release/v1.13.0-test-a` + `release/v1.13.0-test-b` cùng commit khác nhau. Push cả 2 đồng thời trong vòng 5 giây. |
| Expected behavior | GitHub Actions UI hiển thị Run B `waiting...` cho đến khi Run A finish. KHÔNG concurrent execution |
| Verification | Sau khi cả 2 finish, SSH staging → `docker ps` → all 4 service image tag === compose pin của Run B (winner = later push). KHÔNG mismatch |
| MUST NOT leak | Workflow secrets KHÔNG leaked (GitHub default) |
| Side effect | 2 successful deploys serialized. Compose backup file `docker-compose.yml.bak.<ts>` tồn tại |

---

## 📊 Updated Test Coverage Summary

### Backend Test Cases (TC-MP-XX) — R2 total

Original TC-MP-01 → 25 (R1) + NEW:
- TC-MP-08b — Revenue with MANUAL orders correctness (GAP #4)
- TC-MP-22b — `90d` period series length (GAP #1)
- TC-MP-22c — AnStacked endpoint (GAP #2)
- TC-MP-26 — Logto lookup by userId happy path (GAP #5)
- TC-MP-27 — Logto lookup by email + 503 degrade (GAP #5)
- TC-MP-27b — Logto lookup 400 query too short (GAP #5)
- TC-MP-28 — Cross-tenant aggregate revenue happy path (GAP #3)
- TC-MP-29 — Cross-tenant aggregate excluding unassigned tenant (GAP #3)
- TC-MP-30 — Concurrent admin save race condition (MINOR #2)
- TC-MP-31 — CI workflow concurrency (MINOR #3, manual)

**Total: 35 TC.**

### Frontend E2E (E2E-MP-XX) — R2 total

Original E2E-MP-01 → 08 (R1) + NEW:
- E2E-MP-09 — Aggregate vs Per-tenant view (GAP #3)

**Total: 9 E2E.**

### Security Checklist (SEC-XX) — R2 total

Original SEC-01 → 15 (R1) + NEW:
- SEC-16 — Access mutation lock prevents race condition (MINOR #2)

**Total: 16 SEC items.**

---

## 🛑 Updated PAUSE Conditions (R2 consolidate)

**Manager-level PAUSE (Coder confirm với Manager trước khi proceed):**

1. 🛑 TRƯỚC khi modify `period-resolver.ts` (BR-MP-25b) — additive `'90d'` literal + regression test F-062
2. 🛑 TRƯỚC khi tạo collection `merchant_portal_access` trên PROD
3. 🛑 TRƯỚC khi setup Logto Dashboard (2 role + 2 permission + Web App + **M2M App** mới)
4. 🛑 TRƯỚC khi push CI workflow changes (BR-MP-28b — TD-CI-001 mitigation)
5. 🛑 TRƯỚC khi GoDaddy DNS A record `merchant.5bib.com → 157.10.42.171`
6. 🛑 TRƯỚC khi `pnpm install` package mới (chỉ `next-intl` được phép, các package khác đã có)
7. 🛑 TRƯỚC khi merge release/v* branch về main (Danny duyệt deploy PROD)
8. 🛑 SAU khi `.env` set `LOGTO_M2M_APP_ID` + `LOGTO_M2M_APP_SECRET` trên DEV + PROD (BR-MP-29 step 5)

**Danny-level PAUSE:**
- Quyết định final scope Phase 2 chart library (BR-MP-07b) — sau Phase 1 ship 2-4 tuần
- Approve M2M app secret rotation policy (yearly?)
- Approve fee rate badge UI khi `MANUAL.orderCount === 0` AND `ORDINARY+GROUP_BUY === 0` (race chưa có order nào) — show "Chưa áp dụng phí" hay "5.5% / 5,000 đ/vé"?

---

## ✅ Verdict & Re-submit

R2 đã address đầy đủ 5 GAP LỚN + 3 MINOR Manager flag. PRD giờ:
- ✅ Tham chiếu code thực tế đúng (PeriodKind enum, FeeService signature single tenantId, Logto guard pattern)
- ✅ Phase 1 scope rõ ràng (4 chart locked, 5 chart deferred Phase 2)
- ✅ Cross-tenant aggregate có spec đầy đủ (per-tenant loop + per-tenant breakdown table + UI layout)
- ✅ MANUAL fee dual display (% + VNĐ/vé) — không gây hiểu sai cho merchant_finance
- ✅ Logto Management API M2M setup spec + endpoint + 3 TC + UI step-by-step
- ✅ `403_INACTIVE` + concurrent admin lock + TD-CI-001 mitigation

**Status:** 🔵 READY for `/5bib-plan` re-review.

---

## 🔗 Next step

Danny chạy: `/5bib-plan FEATURE-069-merchant-reporting-portal`

Manager re-review 3 file cùng nhau:
1. `01-ba-prd.md` (R1) — BR-MP-01 → 35 nguyên bản (giữ cho continuity)
2. `01-ba-prd-part2.md` (R1) — TC-MP-01 → 25, E2E-MP-01 → 08, SEC-01 → 15, Performance SLA
3. `01-ba-prd-revision-r2.md` (R2 — file này) — Modify/extend BRs + 10 TC mới + 1 E2E mới + 1 SEC mới + 8 PAUSE mới

Nếu Manager APPROVE → Coder `/5bib-code` áp dụng cả 3 file làm spec.
Nếu Manager NEEDS_REVISION lần nữa → BA fix R3.
