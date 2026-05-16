# FEATURE-038: PRD — Finance Contracts List with P&L Per Row

**Status:** 🔵 READY
**Last updated:** 2026-05-15
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check (BA bắt buộc làm trước khi viết)

- [x] Đã đọc `00-manager-init.md` (Danny chốt "A" lock 6 defaults 2026-05-15)
- [x] Đã trả lời tất cả PAUSE conditions trong file 00 (xem section "Answers to Manager's PAUSE" cuối file)
- [x] Đã đọc `memory/codebase-map.md` finance module structure (pnl.service + pnl-dashboard.service + Redis `pnl:dashboard:*` pattern)
- [x] Đã đọc `memory/known-issues.md` — F-029 PERF concerns noted (TD-F029-01 EXPLAIN ANALYZE pending, HIGH-PERF-01 N+1 MySQL resolved F-029 bulk refactor)

---

## 📝 Finance Contracts List with P&L Per Row

**Goal:** Thay placeholder page `/finance/contracts` bằng table list HĐ với KPI P&L inline per row, cho phép Finance Admin scan toàn bộ deals + drill-down detail.

**Scope:**
- ✅ In scope:
  - Backend NEW endpoint `GET /api/finance/pnl/contracts` paginated reuse `pnl-dashboard.service.getDashboardData()` compute path no-slice
  - Admin REWRITE `/finance/contracts/page.tsx` placeholder → list table (TanStack Query) với cột STT/Số HĐ/Đối tác/Giải/Doanh thu/Chi phí/Lãi/Lỗ/Margin badge/Status
  - Search combined (`contractNumber` + `partnerName` + `raceName`)
  - Pagination 20 default + selector 20/50/100
  - Sort default `anchorMonth DESC` + ascendable column headers
  - Period filter reuse `PeriodFilter` component F-028 Phase 2
  - Margin legend header (🟢 Healthy / 🟡 Thin / 🔴 Loss / ⚪ Neutral)
  - Row click → navigate `/finance/contracts/{contractId}` (F-028 Phase 1 detail page existing)
  - Redis cache `pnl:contracts-list:<filterHash>` TTL 60s mirror dashboard

- ❌ Out of scope:
  - Export CSV/Excel button (defer Phase 2 — PAUSE-38-06)
  - Include DRAFT contracts (BR-PNL-08 strict `ACTIVE+COMPLETED` — PAUSE-38-01)
  - Bulk action (edit/cancel/delete) — read-only list
  - Inline P&L compute mutation (admin must go to detail page edit cost items)

---

## 👤 User Stories & Business Rules

### User Stories

- As a **Finance Admin (Hiền)**, I want to scan tất cả HĐ ACTIVE/COMPLETED với P&L inline so that I quickly identify loss-making deals or top performers without opening each contract.
- As a **5BIB Back-Office Admin**, I want to filter list by period + search keyword + sort by margin/profit so that I can drill down deals matching investigation criteria.
- As a **Sales Admin (Hằng)**, I want to click row → navigate detail P&L so that I can see breakdown estimated vs actual costs + edit if needed.

### Business Rules (BR-38-XX)

- **BR-38-01** (status whitelist — inherit BR-PNL-08 F-028): Chỉ list HĐ `status: { $in: ['ACTIVE', 'COMPLETED'] }` + `deletedAt: null`. Loại DRAFT/SENT/ACCEPTED/CONVERTED_TO_CONTRACT/CANCELLED/REJECTED.
- **BR-38-02** (period filter): Date anchor `signDate` fallback `createdAt`. Period presets reuse F-028 Phase 2: `last_3_months` (default), `last_6_months`, `last_year`, `ytd`, `all_time`, `custom` (dateFrom/dateTo).
- **BR-38-03** (P&L compute identical F-036 additive): `totalCost = estimatedCost + actualCost` per `pnl.service.getSummary()` semantic. `estimatedCost = sum(line_items[i].cost × quantity)` (selected only); `actualCost = sum(cost_items.amount)`.
- **BR-38-04** (sort default): `anchorMonth DESC` (recent first). Other sortable: `profit ASC/DESC`, `revenue ASC/DESC`, `margin ASC/DESC`, `contractNumber ASC/DESC`.
- **BR-38-05** (search combined): Mongo regex `$or` 3 fields: `contractNumber` + `client.entityName` + `raceName`, case-insensitive, escape regex special chars (defense ReDoS).
- **BR-38-06** (pagination): Default page=1, limit=20. Limit options: 20/50/100. Max limit 100 hardcoded (prevent abuse).
- **BR-38-07** (margin tier — inherit F-028 Phase 3): `healthy >10%` 🟢, `thin 0-10%` 🟡, `loss <0%` 🔴, `neutral` ⚪ when revenue=0.
- **BR-38-08** (cache): Redis key `pnl:contracts-list:<sha256-filter-hash>` TTL 60s. Filter hash = JSON.stringify({period,dateFrom,dateTo,page,limit,sortBy,sortDir,q}).
- **BR-38-09** (cache invalidation): Mutation `POST/PATCH/DELETE /api/contracts/*` hoặc `/api/finance/cost-items/*` → flush pattern `pnl:contracts-list:*` (scanStream + pipeline DEL).
- **BR-38-10** (admin-only): Endpoint `LogtoAdminGuard` (inherit pnl-dashboard.controller.ts pattern). Page-level RBAC gate `isAdmin` defense-in-depth (mirror F-026 + F-028 Phase 2).
- **BR-38-11** (URL deep-link): Filter state preserve trong URL query params `?period=...&dateFrom=...&page=...&sortBy=...&q=...` để admin bookmark/share view cụ thể.

---

## 🖥️ UI/UX Flow — STEP-BY-STEP CHI TIẾT (Manager 2026-05-14 directive)

### Route structure
- `/finance/contracts` (rewrite from placeholder) — list page
- `/finance/contracts/[id]` (F-028 Phase 1 detail — unchanged)

### Screen 1: P&L Contracts List — Route: `/finance/contracts`

**Layout & Visible data:**

- **Header:**
  - Title `💰 P&L theo Hợp đồng` + (giữ badge "Phase 2" hoặc bỏ — recommend bỏ vì giờ là functional page)
  - Breadcrumb `finance > Hợp đồng`
  - Period filter dropdown right (reuse `PeriodFilter` F-028 Phase 2)
- **Subheader (margin legend banner):**
  - "Margin: 🟢 Tốt >10% · 🟡 Trung bình 0-10% · 🔴 Lỗ <0% · ⚪ Chưa có doanh thu"
- **Filter row:**
  - Search input (left) — placeholder "Tìm theo số HĐ / đối tác / giải"
  - Page size selector (right) — "20 / 50 / 100 mỗi trang"
- **Body:** Table 9 cột
- **Footer:** Pagination + summary "Tổng N HĐ — Doanh thu X — Chi phí Y — Lãi/Lỗ Z (margin avg M%)"

**Field-by-field data source:**

| Field UI label | Data source | Format hiển thị | Empty state |
|----------------|-------------|-----------------|-------------|
| STT | row index | number 1-N | — |
| Số HĐ | `contract.contractNumber` (MongoDB) | text mono | "—" |
| Đối tác | `contract.client.entityName` | text VN truncate max 200px | "—" |
| Giải đấu | `contract.raceName` | text VN truncate max 180px | "—" |
| Loại | `contract.contractType` mapped CONTRACT_TYPE_LABEL | VN: "Bán vé"/"Tính giờ"/"Racekit"/"Vận hành" | — |
| Doanh thu | computed `revenue` (F-028 BR-PNL-01) | VND vi-VN locale `1.000.000 ₫` right-align | "0 ₫" |
| Chi phí | computed `totalCost = estimated + actual` (F-036) | VND vi-VN right-align | "0 ₫" |
| Lãi/Lỗ | `profit = revenue - totalCost` | VND vi-VN, green if >0 / red if <0 | "0 ₫" |
| Margin | `margin %` + `marginTier` badge | "+11.1%" 🟢 / "-7.3%" 🔴 / "—" ⚪ | "—" |
| Status | `contract.status` mapped CONTRACT_STATUS_LABEL | VN: "Đang hiệu lực"/"Hoàn thành" | — |

### UI Step-by-Step (numbered, click-by-click)

#### Journey 1: Finance Admin scan top loss-making contracts

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Navigate `/finance/contracts` | Page load — skeleton table 5 rows + header shimmer | TanStack Query `useGetContractsList({period:'last_3_months'})` | Loading state |
| 2 | Data arrives | Table render với 20 rows + pagination footer + summary footer | Query resolved | Data state |
| 3 | Click column header "Margin" twice (DESC → ASC) | Sort arrow toggle direction, list re-fetch sorted | onClick patch state `sortBy:'margin', sortDir:'asc'` | Loss-making rows appear top |
| 4 | Click row đầu (margin -7.3% red badge) | Navigate `/finance/contracts/6a020...` | Next.js Link | Detail page F-028 Phase 1 |
| 5 | Browser Back | Return to list — filter+sort+page state PRESERVED (URL query params) | useSearchParams restore | Same view |

#### Journey 2: Search specific contract

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Type "Zaha" trong search input | Debounce 300ms | onChange + useDebounced | Query updates with q="Zaha" |
| 2 | Debounce fire | List re-fetch với q="Zaha" | useGetContractsList refetch | Loading state |
| 3 | 3 rows match | Table render 3 rows + footer "Tổng 3 HĐ — Doanh thu X — ..." | Query resolved | Filtered data state |
| 4 | Clear search input | List re-fetch full | onChange empty + debounce | Default data state |

#### Journey 3: Period filter switch

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Click PeriodFilter dropdown → chọn "Năm nay (YTD)" | Dropdown closes, list re-fetch | onValueChange `period='ytd'` | Loading state |
| 2 | Data arrives | List + summary footer update với YTD aggregate | Query resolved | Data state |
| 3 | Click "Tùy chọn" → modal popup chọn date range custom | DateRangePicker open | UI modal | Modal open state |
| 4 | Pick `2026-04-01` đến `2026-04-30` → Confirm | Modal closes, list re-fetch với period='custom' | onChange | Loading → Data |

### Buttons spec table

| Button label | Position | Default state | Disabled state | Loading state | Action | Confirm dialog? |
|--------------|----------|---------------|----------------|---------------|--------|-----------------|
| Period dropdown trigger | Header right | Outline w/ icon Calendar | KHÔNG | N/A | Open dropdown menu | NO |
| Search input clear (X icon) | Search input right | Hidden | N/A (always enabled when has value) | N/A | onClick clear input + debounce refetch | NO |
| Page size selector dropdown | Filter row right | Outline | KHÔNG | N/A | onValueChange refetch with new limit | NO |
| Sortable column header (Doanh thu/Chi phí/Lãi-Lỗ/Margin/Số HĐ) | Table thead | Underline hover + arrow icon | KHÔNG | N/A | onClick toggle DESC ↔ ASC, refetch | NO |
| Pagination Previous (←) | Footer left | Outline | Disabled if page=1 | N/A | onClick `setPage(page - 1)` | NO |
| Pagination Next (→) | Footer right | Outline | Disabled if page=totalPages | N/A | onClick `setPage(page + 1)` | NO |
| Pagination page number | Footer center | Outline current = filled | N/A | N/A | onClick `setPage(N)` | NO |
| Row link (entire row clickable) | Table body | Cursor pointer + hover bg | KHÔNG | N/A | Navigate `/finance/contracts/{id}` | NO |
| "Refresh" icon button | Header right (small) | Ghost | Disabled while loading | Spinner | onClick `queryClient.invalidateQueries` | NO |

### Form Fields Specification

> Search là input duy nhất user-typeable. Page size + sort + period là dropdown enum.

| Field name | UI label | Type | Required | Validation | Error message | Default |
|------------|----------|------|----------|------------|---------------|---------|
| `q` (search) | Tìm theo số HĐ / đối tác / giải | text | ⚪ | max 100 char, trim, escape regex via backend `escape-regex` util | "Từ khoá tối đa 100 ký tự" | "" |
| `period` | Period filter | enum select | ⚪ | one of: `last_3_months`/`last_6_months`/`last_year`/`ytd`/`all_time`/`custom` | "Period không hợp lệ" | "last_3_months" |
| `dateFrom` | Từ ngày (custom period only) | date | ⚪ (required if period=custom) | ISO date `YYYY-MM-DD`, year 2020-2030, NOT after dateTo | "Từ ngày không hợp lệ" | (empty) |
| `dateTo` | Đến ngày (custom period only) | date | ⚪ (required if period=custom) | ISO date, NOT before dateFrom, NOT >today+30days | "Đến ngày không hợp lệ" | (empty) |
| `page` | Trang (URL param) | number | ⚪ | min 1, max 9999, integer | (auto-clamp 1) | 1 |
| `limit` | Số dòng/trang | enum number | ⚪ | one of: 20/50/100 | "Limit không hợp lệ" | 20 |
| `sortBy` | Cột sắp xếp | enum | ⚪ | one of: `anchorMonth`/`profit`/`revenue`/`margin`/`contractNumber` | (default) | "anchorMonth" |
| `sortDir` | Hướng sắp xếp | enum | ⚪ | one of: `asc`/`desc` | (default) | "desc" |

### UI States

- **Loading** (initial + page change + filter change): Skeleton table 5 rows full-width + header shimmer + footer hidden
- **Empty** (no contracts match filter): Card centered icon `Coins` + heading "Không có HĐ phù hợp filter" + description "Thử bỏ filter hoặc đổi period" + CTA button "Reset filter" (clear all params back to defaults)
- **Filtered + empty** (q matched nothing): Same Empty state nhưng description "Không tìm thấy HĐ khớp '{q}'" + CTA "Bỏ tìm kiếm"
- **Data**: Table render + footer summary + pagination
- **Error fetch** (5xx hoặc network): Toast `sonner` đỏ "Lỗi tải danh sách. Thử lại?" + retry button `queryClient.refetch()`. Table giữ state cũ nếu có data trước đó (stale-while-revalidate).
- **Stale revalidating** (background refetch sau navigate back): Table giữ data + small spinner icon Header indicator subtle (KHÔNG flash empty)
- **403 Forbidden** (non-admin access): Render `<RestrictedAccess message="Module Tài chính chỉ dành cho admin" />` (reuse F-026 pattern, NOT toast)

---

## 🛠️ Technical Mandates (For Coder Agent)

### DB / Cache changes

- MongoDB: **KHÔNG đụng schema**. Reuse `Contract` model existing.
- MySQL platform: **KHÔNG đụng**. TICKET_SALES revenue compute reuse `fee.service.ts` bulk method (F-029 HIGH-PERF-01 batch refactor proven).
- Redis: NEW key pattern `pnl:contracts-list:<sha256-filter-hash>` TTL 60s. Invalidate trên mutation `contract.*` + `cost-items.*` (mirror dashboard cache flush pattern).
- S3: **KHÔNG đụng**.
- Migration: **KHÔNG cần**.

### Backend Endpoint Specification

| Element | Spec |
|---------|------|
| Method | GET |
| Path | `/api/finance/pnl/contracts` |
| Auth | `@UseGuards(LogtoAdminGuard)` class-level (inherit pnl-dashboard.controller.ts pattern) |
| Guard role | admin |
| Query DTO | `PnLContractsListFilterDto` (extend `DashboardFilterDto`) |
| Response DTO | `PnLContractsListResponseDto` |
| Status codes | 200 success / 400 validation / 401 no auth / 403 insufficient (non-admin) / 500 server |
| Side effects | Redis SET cache (60s TTL); no DB write |

### DTO Field-Level Spec

```typescript
// backend/src/modules/finance/dto/pnl-contracts-list-filter.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { DashboardPeriod, DashboardFilterDto } from './dashboard-filter.dto';

export type ContractsListSortBy =
  | 'anchorMonth'
  | 'profit'
  | 'revenue'
  | 'margin'
  | 'contractNumber';
export type SortDir = 'asc' | 'desc';

export class PnLContractsListFilterDto extends DashboardFilterDto {
  @ApiPropertyOptional({ description: 'Page number', minimum: 1, maximum: 9999, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(9999)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', enum: [20, 50, 100], default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsEnum([20, 50, 100], { message: 'Limit không hợp lệ' })
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sort column',
    enum: ['anchorMonth', 'profit', 'revenue', 'margin', 'contractNumber'],
    default: 'anchorMonth',
  })
  @IsOptional()
  @IsEnum(['anchorMonth', 'profit', 'revenue', 'margin', 'contractNumber'])
  sortBy?: ContractsListSortBy;

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortDir?: SortDir;

  @ApiPropertyOptional({ description: 'Search keyword (contractNumber + entityName + raceName)', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Từ khoá tối đa 100 ký tự' })
  q?: string;
}

// backend/src/modules/finance/dto/pnl-contracts-list-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { DashboardContractItemDto, DashboardTotalsDto } from './dashboard-response.dto';

export class PnLContractsListResponseDto {
  @ApiProperty({ description: 'ISO date period start' })
  dateFrom!: string;

  @ApiProperty({ description: 'ISO date period end' })
  dateTo!: string;

  @ApiProperty({ description: 'Generated timestamp ISO' })
  generatedAt!: string;

  @ApiProperty({ type: [DashboardContractItemDto], description: 'Paginated list of contracts with P&L' })
  items!: DashboardContractItemDto[];

  @ApiProperty({ description: 'Total contracts matching filter (before pagination)' })
  total!: number;

  @ApiProperty({ description: 'Current page (1-indexed)' })
  page!: number;

  @ApiProperty({ description: 'Items per page' })
  limit!: number;

  @ApiProperty({ description: 'Total pages = ceil(total/limit)' })
  totalPages!: number;

  @ApiProperty({ type: DashboardTotalsDto, description: 'Aggregate totals across ALL matching contracts (not just current page)' })
  totals!: DashboardTotalsDto;
}
```

### Service implementation guidance

```typescript
// pnl-dashboard.service.ts — add new method
async getContractsList(filter: PnLContractsListFilterDto): Promise<PnLContractsListResponseDto> {
  const cacheKey = `pnl:contracts-list:${this.hashFilter(filter)}`;
  const cached = await this.redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Reuse compute path from getDashboardData() — BR-PNL-08 status whitelist
  const { items: allItems, totals } = await this.computeContractItems(filter);

  // Search filter (BR-38-05)
  const q = filter.q?.trim();
  let filtered = allItems;
  if (q) {
    const safe = escapeRegex(q);
    const re = new RegExp(safe, 'i');
    filtered = allItems.filter(
      (i) =>
        re.test(i.contractNumber ?? '') ||
        re.test(i.partnerName ?? '') ||
        re.test(i.raceName ?? ''),
    );
  }

  // Sort (BR-38-04)
  const sortBy = filter.sortBy ?? 'anchorMonth';
  const sortDir = filter.sortDir ?? 'desc';
  filtered.sort((a, b) => {
    const aVal = a[sortBy] ?? '';
    const bVal = b[sortBy] ?? '';
    if (sortDir === 'asc') return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });

  // Paginate (BR-38-06)
  const page = filter.page ?? 1;
  const limit = filter.limit ?? 20;
  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const items = filtered.slice((page - 1) * limit, page * limit);

  const result: PnLContractsListResponseDto = {
    dateFrom: /* ... */,
    dateTo: /* ... */,
    generatedAt: new Date().toISOString(),
    items, total, page, limit, totalPages, totals,
  };

  await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 60);
  return result;
}
```

### Frontend / Admin (Next.js)

- `/finance/contracts/page.tsx` — Client Component (`'use client'`) — has filter state, debounce, TanStack Query
- TanStack Query hook: `useGetContractsList(filter)` — queryKey `['finance', 'pnl', 'contracts', filter]`
- Invalidate sau navigate back (focus refetch): `staleTime: 30s`, `gcTime: 5min`
- URL state sync: `useSearchParams` + `router.replace(?period=...&page=...)` để deep-link
- Base UI Select.Value render prop pattern cho period dropdown + page size + sort dir (VN labels)
- Reuse: `PeriodFilter` từ F-028 Phase 2 (`_components/period-filter.tsx`), `formatVnd`, `formatMargin`, `MarginTier` types
- New components:
  - `ContractsListClient` (main page client) — fetch + filter state machine
  - `ContractsListTable` — table render với sortable column headers
  - `ContractsListFooterSummary` — totals row at bottom (Tổng N HĐ — DT/CP/Lãi/avg margin)
  - `MarginLegendBanner` — top header legend 🟢/🟡/🔴/⚪
  - `EmptyState` + `RestrictedAccess` reuse existing
- KHÔNG cần SDK regen ngay (admin pattern raw fetch via `finance-api.ts` helpers — consistent F-031/F-032 pattern). TD-F038-SDK-REGEN defer batch khi SDK rev (LOW).

### PAUSE flags

- ❌ KHÔNG cần migration MongoDB/MySQL
- ❌ KHÔNG cần `pnpm install` dep mới
- ❌ KHÔNG breaking API change (additive endpoint)
- ✅ Có thể chạy independent — no dependency on F-016 v1.7.0 hay TD nào

---

## 🛡️ Testing Mandates (For QC Agent) — TC-XX Format

### Backend Test Cases — TC-CL-XX

#### TC-CL-01 Happy path — Default filter trả paginated 20 items

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/finance/pnl/contracts` |
| Headers | `Authorization: Bearer <admin_token>` |
| Query params | (default — no params) |
| Expected status | 200 |
| Expected body shape | `{ dateFrom, dateTo, generatedAt, items: [...], total: N, page: 1, limit: 20, totalPages: M, totals: {...} }` |
| Items shape per row | `{ contractId, contractNumber, partnerName, raceName, contractType, status, revenue, totalCost, profit, margin, marginTier, anchorMonth }` |
| MUST NOT leak | `client._id` raw, `__v`, `lineItems[]`, `costItemsByCategory`, `service_fee_rate`, `manual_fee_per_ticket` |
| Side effect verify | Redis SET `pnl:contracts-list:<hash>` TTL 60s; no DB write |

#### TC-CL-02 Status whitelist — DRAFT contracts NOT in response

| Element | Value |
|---------|-------|
| Setup | 5 contracts in DB: 2 ACTIVE, 1 COMPLETED, 1 DRAFT, 1 CANCELLED |
| Method | GET |
| URL | `/api/finance/pnl/contracts?period=all_time` |
| Expected status | 200 |
| Expected | `items.length === 3` (chỉ ACTIVE + COMPLETED) |
| MUST NOT contain | contractId của DRAFT hoặc CANCELLED contracts |

#### TC-CL-03 Search combined — match contractNumber OR partnerName OR raceName

| Element | Value |
|---------|-------|
| Setup | Contract A (`contractNumber=14.05/2026/HDDV`, partner="Zaha", race="Hai Phong"), Contract B (partner="Thach Sanh", race="Mau Son"), Contract C (partner="Zaha SubCo", race="Đà Lạt") |
| Method | GET |
| URL | `/api/finance/pnl/contracts?q=Zaha` |
| Expected status | 200 |
| Expected | `items.length === 2` (A + C); B excluded |
| Test variant | `?q=Hai+Phong` → only A; `?q=14.05` → only A |

#### TC-CL-04 Pagination boundary — page 2 với limit 20 trả items[20..39]

| Element | Value |
|---------|-------|
| Setup | 50 ACTIVE contracts |
| Method | GET |
| URL | `/api/finance/pnl/contracts?page=2&limit=20` |
| Expected status | 200 |
| Expected | `items.length === 20`, `page: 2`, `total: 50`, `totalPages: 3`, items match indices [20..39] sorted by default anchorMonth DESC |

#### TC-CL-05 Sort margin ASC — loss-making rows top

| Element | Value |
|---------|-------|
| Setup | Contracts: A (margin=50% healthy), B (margin=-10% loss), C (margin=5% thin), D (margin=null neutral) |
| Method | GET |
| URL | `/api/finance/pnl/contracts?sortBy=margin&sortDir=asc` |
| Expected | items order: [B (-10%), C (5%), A (50%), D (null)] — neutral last |

#### TC-CL-06 Search escape regex (security) — special chars KHÔNG trigger ReDoS

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/finance/pnl/contracts?q=(a+)+$` (potential ReDoS pattern) |
| Expected status | 200 (NOT timeout, NOT 500) |
| Expected | Response time < 200ms (escapeRegex util neutralized special chars) |
| Test variant | `q=` (empty) → no search filter applied; `q=` 100+ chars → 400 validation |

#### TC-CL-07 Cache hit — 2 consecutive same-filter requests serve from Redis

| Element | Value |
|---------|-------|
| Method | GET × 2 |
| URL | `/api/finance/pnl/contracts?period=last_3_months` × 2 calls |
| Expected | 1st call: compute + Redis SET (~200-500ms); 2nd call within 60s: Redis HIT (<50ms), identical response |
| Side effect verify | Mongo `find()` called once (mock assertion); Redis `get` called twice, `set` once |

#### TC-CL-08 Auth missing — 401

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/finance/pnl/contracts` |
| Headers | (none) |
| Expected status | 401 |
| Expected body | `{ statusCode: 401, message: 'Missing Bearer token', error: 'Unauthorized' }` |

#### TC-CL-09 Non-admin role — 403

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/finance/pnl/contracts` |
| Headers | `Authorization: Bearer <staff_token>` (not admin) |
| Expected status | 403 |
| Expected body | `{ statusCode: 403, error: 'Forbidden' }` |

#### TC-CL-10 Validation — invalid limit/sortBy/page

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/finance/pnl/contracts?limit=999` (not in enum 20/50/100) |
| Expected status | 400 |
| Expected | `{ message: ['Limit không hợp lệ'] }` |
| Variants | `?sortBy=foo` → 400; `?page=0` → 400 min 1; `?page=10000` → 400 max 9999 |

#### TC-CL-11 Cache invalidation — mutation contract → cache flushed

| Element | Value |
|---------|-------|
| Setup | Cache populated với `pnl:contracts-list:<hash1>` |
| Action | PATCH `/api/contracts/{id}` update line items |
| Expected | Mongo + Redis scanStream `pnl:contracts-list:*` keys deleted (mirror dashboard flush pattern) |
| Verify | Next GET `/api/finance/pnl/contracts?period=...` re-computes (not Redis hit) |

### Frontend E2E Test Cases — Playwright

| TC | Persona | Journey | Steps | Expected |
|----|---------|---------|-------|----------|
| E2E-01 | Finance Admin | Land + see default list | 1. Login admin 2. Navigate `/finance/contracts` | Table render 20 rows + footer summary + margin legend banner top |
| E2E-02 | Finance Admin | Sort by margin ASC | 1. Click "Margin" column header 2. Click again | Sort arrow toggles, list re-orders (loss tier appears top); URL params `?sortBy=margin&sortDir=asc` |
| E2E-03 | Finance Admin | Search by partner name | 1. Type "Zaha" in search 2. Wait 300ms debounce | Table re-renders với chỉ rows match; URL `?q=Zaha` |
| E2E-04 | Finance Admin | Empty state filter | 1. Type "ZZZ_NOTEXIST" | "Không tìm thấy HĐ khớp 'ZZZ_NOTEXIST'" empty state + "Bỏ tìm kiếm" CTA |
| E2E-05 | Finance Admin | Page navigation | 1. Click Next pagination | List re-fetches page 2; URL `?page=2` |
| E2E-06 | Finance Admin | Drill detail | 1. Click row đầu | Navigate `/finance/contracts/{id}` |
| E2E-07 | Finance Admin | Deep-link restore | 1. Navigate `/finance/contracts?period=ytd&sortBy=profit&sortDir=desc&page=2` | Page load với filter applied trực tiếp |
| E2E-08 | Non-admin staff | Access denied | 1. Login staff (not admin) 2. Navigate `/finance/contracts` | `<RestrictedAccess />` shown, NOT redirect |
| E2E-09 | Finance Admin | Loading state | 1. Throttle network slow 3G 2. Navigate `/finance/contracts` | Skeleton 5 rows + header shimmer visible >500ms |
| E2E-10 | Finance Admin | Error retry | 1. Mock 500 backend 2. Navigate | Toast đỏ "Lỗi tải danh sách. Thử lại?" + retry button work |

### Security Checks

- [x] Endpoint protected `LogtoAdminGuard` — verify 401 unauth + 403 staff
- [x] No IDOR (admin-only endpoint, no per-resource ownership)
- [x] Response KHÔNG leak: `_id` raw (use `contractId` string), `__v`, MongoDB error stack, `lineItems` raw (only aggregated `revenue/totalCost`), `service_fee_rate` / `manual_fee_per_ticket` from MerchantConfig
- [x] Search regex sanitized via `escapeRegex` util (defense ReDoS) — TC-CL-06 verify
- [x] CORS: admin-only endpoint, cookie session via Logto — no preflight concern
- [x] No PII leak: athlete names NOT in P&L list response

### Performance SLA

- Response time p95: < 500ms cold (compute + Redis SET); < 100ms warm (Redis hit)
- Cache hit ratio sau 1 phút operation: > 80%
- Worst case 100 ACTIVE+COMPLETED contracts × period 3 months: < 800ms cold
- Load test: 50 concurrent admin requests / 60s → 0 errors, p95 < 1s (cache covers most)
- 10x stability test: 10 sequential same-filter requests deterministic (TC-CL-07 verify)

---

## 📌 Answers to Manager's PAUSE conditions (từ file 00)

> Danny chốt "A" 2026-05-15 — 6 defaults locked. BA paste vào PRD:

- **PAUSE-38-01 Status whitelist:** ✅ Giữ BR-PNL-08 strict `ACTIVE+COMPLETED`. Drafts đã có preview wizard step 4 + detail page card. Encoded as **BR-38-01**.
- **PAUSE-38-02 Default sort:** ✅ `anchorMonth DESC` (recent first — standard table pattern). Encoded as **BR-38-04**.
- **PAUSE-38-03 Search field:** ✅ Combined `contractNumber + client.entityName + raceName` (Mongo `$or` match cả 3 fields). Encoded as **BR-38-05**.
- **PAUSE-38-04 Page size:** ✅ 20 default + selector 20/50/100. Max 100 hardcoded (prevent abuse). Encoded as **BR-38-06**.
- **PAUSE-38-05 Margin legend:** ✅ Show header — 🟢 Healthy >10% / 🟡 Thin 0-10% / 🔴 Loss <0% / ⚪ Neutral no revenue. Encoded as **BR-38-07** + UI Layout subheader.
- **PAUSE-38-06 Export CSV/Excel:** ✅ Defer Phase 2. Out of scope F-038.

---

## ✅ Status

- [x] **READY** — sẵn sàng cho Manager review (`/5bib-plan`)

---

## 🔗 Next step

Danny chạy: `/anthropic-skills:5bib-manager` hoặc `/5bib-plan FEATURE-038-finance-contracts-list-pnl`

Manager sẽ:
1. Validate checklist (User Stories + BR + UI states + Tech / Security / Performance / Testability + Personas affected + UI Detail + Backend Detail tables)
2. Output `02-manager-plan.md` với Scope Lock + verdict APPROVED hoặc NEEDS_REVISION
