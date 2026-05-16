# FEATURE-038: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-05-15
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check (Manager)

- [x] Đã đọc `00-manager-init.md` (6 PAUSE-38-* Danny chốt A 2026-05-15)
- [x] Đã đọc `01-ba-prd.md` toàn bộ (11 BR + 11 TC-CL + 10 E2E + DTO code blocks)
- [x] Đã đọc memory: `codebase-map.md` finance module, `conventions.md` cache invalidation pattern, `known-issues.md` (F-029 perf concerns)
- [x] Đã spot-check code thật:
  - `backend/src/modules/finance/services/pnl.service.ts` — confirmed `getDashboardData()` line 364, `getSummary()` line 165
  - `backend/src/modules/finance/controllers/pnl-dashboard.controller.ts` — confirmed `LogtoAdminGuard` class-level, route prefix `finance/dashboard`
  - `backend/src/modules/finance/dto/dashboard-filter.dto.ts` — confirmed class name `PnLDashboardFilterDto` + periods `current_month/last_3_months/last_6_months/last_12_months/ytd/custom`
  - `backend/src/modules/finance/dto/dashboard-response.dto.ts` — confirmed `DashboardContractItemDto` + `DashboardTotalsDto` reusable
  - `admin/src/app/(dashboard)/finance/contracts/page.tsx` — confirmed placeholder 67 lines (RestrictedAccess pattern)
  - `admin/src/lib/finance-api.ts` — confirmed `DashboardContractItem`, `DashboardTotals`, `MarginTier` types
  - `admin/src/app/(dashboard)/finance/_components/period-filter.tsx` — reusable component

---

## ✓ PRD Validation Checklist (8 items)

### Completeness
- [x] **User Stories đầy đủ** — 3 persona (Finance Admin Hiền / Back-Office Admin / Sales Admin Hằng) đều có As-I-So
- [x] **Business Rules testable** — 11 BR-38-XX có ID, mỗi BR map sang test case TC-CL hoặc E2E
- [x] **UI states đầy đủ** — Loading / Empty / Filtered+empty / Data / Error fetch / Stale revalidating / 403 Forbidden (7 states, đủ)
- [x] **Data source rõ ràng** — table 10 fields có MongoDB source / VND format / Empty state per field
- [x] **DB change flag** — KHÔNG migration, KHÔNG schema change (confirmed)
- [x] **API contract no break** — additive endpoint mới (`GET /api/finance/pnl/contracts`), KHÔNG đụng `/api/finance/dashboard` cũ
- [x] **Performance SLA có số cụ thể** — p95 < 500ms cold / < 100ms warm / cache hit > 80% / 100 contracts < 800ms / load test 50 concurrent
- [x] **Security boundary rõ** — `LogtoAdminGuard` class-level + page-level `isAdmin` gate defense-in-depth + escapeRegex ReDoS defense + no PII leak

### Cross-check memory
- ✅ Architecture: additive endpoint không phá flow Order/Reconciliation domain. Reuse cache invalidation pattern conventions.md (scanStream + pipeline DEL).
- ✅ Convention: Atomic compute reuse `getDashboardData()` path đã proven F-028 + F-036.
- ✅ Known-issues: F-029 HIGH-PERF-01 bulk MySQL fee fetch resolved → list compute không re-introduce N+1.

---

## ⚠️ Notes for Coder — 3 NAMING MISMATCHES trong PRD cần dùng tên CHUẨN code thật

> BA viết PRD reference với tên tương đối — Coder dùng tên CHÍNH XÁC theo codebase hiện tại:

| BA viết trong PRD | Tên chuẩn codebase | Action |
|-------------------|--------------------|--------|
| `pnl-dashboard.service.ts` | **`pnl.service.ts`** | Add method `getContractsList()` vào file này (không tạo file mới) |
| `DashboardFilterDto` (parent class) | **`PnLDashboardFilterDto`** | `PnLContractsListFilterDto extends PnLDashboardFilterDto` |
| Period `last_year` / `all_time` | **`last_12_months`** / (no `all_time`) | Dùng enum hiện có: `current_month/last_3_months/last_6_months/last_12_months/ytd/custom`. Nếu BA muốn `all_time` riêng → discuss với Manager trước khi extend enum |

Nếu Coder thấy PRD muốn period `all_time` (vd: BR-38-02 hoặc TC-CL-02 dùng `?period=all_time`):
- **Decision:** SKIP `all_time` cho v1.0 F-038 — dùng `last_12_months` làm widest preset
- **Lý do:** Extend enum = breaking SDK regen + dashboard cũ chưa support. Defer Phase 2 nếu Danny cần.

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ được sửa các file dưới đây. Ngoài scope = scope creep, phải hỏi Manager.

### Backend (5 files)
- ✏️ **MODIFY** `backend/src/modules/finance/services/pnl.service.ts` — thêm method `getContractsList(filter: PnLContractsListFilterDto): Promise<PnLContractsListResponseDto>` + helper `hashFilter()` (sha256 deterministic) + reuse `computeContractItems()` internal hoặc extract từ `getDashboardData()` body 364-530
- ✏️ **MODIFY** `backend/src/modules/finance/controllers/pnl-dashboard.controller.ts` — thêm `@Get('/contracts')` endpoint (HOẶC route ngoài controller scope nếu cần `/finance/pnl/contracts` — recommend tạo route trong controller hiện tại với `@Controller('finance/pnl')` mới hoặc bổ sung sub-route). **PAUSE point:** Coder xác nhận route path = `/api/finance/pnl/contracts` (BA PRD) HAY `/api/finance/dashboard/contracts` (đỡ tách controller mới). Recommend tạo controller mới `pnl-contracts-list.controller.ts` route prefix `finance/pnl` — sạch hơn, không pollute dashboard controller.
- ➕ **NEW** `backend/src/modules/finance/controllers/pnl-contracts-list.controller.ts` (NẾU chọn split controller) — `@Controller('finance/pnl')` + `@UseGuards(LogtoAdminGuard)` + `@Get('/contracts')`
- ➕ **NEW** `backend/src/modules/finance/dto/pnl-contracts-list-filter.dto.ts` — `PnLContractsListFilterDto extends PnLDashboardFilterDto` với 5 field (page/limit/sortBy/sortDir/q) theo DTO code block PRD line 215-250
- ➕ **NEW** `backend/src/modules/finance/dto/pnl-contracts-list-response.dto.ts` — `PnLContractsListResponseDto` reuse `DashboardContractItemDto[]` + `DashboardTotalsDto` (KHÔNG duplicate types)
- ✏️ **MODIFY** `backend/src/modules/finance/services/pnl.service.spec.ts` — thêm `describe('getContractsList()')` covering 11 TC-CL-01..11
- ✏️ **MODIFY** `backend/src/modules/finance/finance.module.ts` (NẾU split controller) — register `PnLContractsListController`

### Cache invalidation (1 file modify)
- ✏️ **MODIFY** wherever existing dashboard cache flush được call (`cost-items.service.ts` mutation handlers + `contracts.service.ts` update/delete) — thêm pattern flush `pnl:contracts-list:*` song song với `pnl:dashboard:*`. Coder grep `pnl:dashboard` để find tất cả call sites.

### Admin (8 files)
- ✏️ **REWRITE** `admin/src/app/(dashboard)/finance/contracts/page.tsx` — từ placeholder 67 dòng → ContractsListClient wrapper với `isAdmin` gate + `RestrictedAccess` pattern (đã có pattern)
- ✏️ **MODIFY** `admin/src/lib/finance-api.ts` — thêm helper `getContractsList(filter)` + types `PnLContractsListFilterClient` + `PnLContractsListResponse`
- ➕ **NEW** `admin/src/app/(dashboard)/finance/contracts/_components/contracts-list-client.tsx` — `'use client'` main wrapper với TanStack Query + filter state + URL sync via `useSearchParams`
- ➕ **NEW** `admin/src/app/(dashboard)/finance/contracts/_components/contracts-list-table.tsx` — table render 9 cột với sortable headers
- ➕ **NEW** `admin/src/app/(dashboard)/finance/contracts/_components/contracts-list-footer-summary.tsx` — totals row + pagination
- ➕ **NEW** `admin/src/app/(dashboard)/finance/contracts/_components/margin-legend-banner.tsx` — top header legend 🟢/🟡/🔴/⚪
- ➕ **NEW** `admin/src/app/(dashboard)/finance/contracts/_components/contracts-list-empty-state.tsx` — Empty + Filtered+empty + Error states
- (Reuse — KHÔNG sửa) `admin/src/app/(dashboard)/finance/_components/period-filter.tsx`, `admin/src/components/admin-shell/restricted-access.tsx`, `admin/src/lib/format.ts` (formatVnd, formatMargin)

### Out of scope (KHÔNG đụng)
- ❌ `pnl-dashboard.controller.ts` route prefix `/api/finance/dashboard` — KHÔNG đổi
- ❌ `pnl-export.controller.ts`, `pnl-excel.service.ts` — defer Phase 2
- ❌ `cost-items.service.ts` business logic (chỉ thêm cache flush invocation)
- ❌ `contracts.service.ts` business logic (chỉ thêm cache flush invocation)
- ❌ MongoDB Contract schema
- ❌ MySQL platform DB
- ❌ `pnl.service.ts` getDashboardData/getSummary BODY (chỉ thêm method mới, KHÔNG sửa method cũ)
- ❌ Admin sidebar nav entry (đã có "P&L theo HĐ")

**Total file count:** Backend 5 modify + 3 new = 8. Admin 2 modify + 5 new = 7. **Cộng dồn 15 files.**

---

## 🔧 Tech approach (đề xuất — Coder có thể tinh chỉnh)

### Backend
1. **Reuse compute path** — extract method `computeContractItems(filter): { items, totals }` từ body `getDashboardData()` (line 364-530). Cả `getDashboardData()` cũ + `getContractsList()` mới dùng chung. Refactor nhẹ, KHÔNG đổi behavior dashboard cũ.
2. **Filter hash** — `crypto.createHash('sha256').update(JSON.stringify(sortedKeys)).digest('hex').slice(0,16)` deterministic. Sort keys trước stringify để `{page:1,limit:20}` và `{limit:20,page:1}` cho cùng hash.
3. **Sort logic** — implement client-side (in memory) trên `filtered` array sau search. Acceptable vì worst case 100 contracts. Nếu Coder lo perf >1000 contracts (future), có thể sort + paginate ở Mongo aggregation pipeline thay vì in-memory.
4. **escapeRegex util** — check `backend/src/common/utils/` có sẵn chưa. Nếu chưa → tạo `escape-regex.util.ts` 5 dòng: `str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`.
5. **Cache invalidation hook** — Coder grep `pnl:dashboard` toàn backend, mọi nơi flush dashboard cache → thêm flush `pnl:contracts-list:*` ngay sau (cùng pipeline để atomic).
6. **Controller routing decision** — RECOMMEND tạo controller mới `pnl-contracts-list.controller.ts` với `@Controller('finance/pnl')` + `@Get('/contracts')` → URL `/api/finance/pnl/contracts` match PRD. KHÔNG inline vào `pnl-dashboard.controller.ts` (route prefix khác).

### Admin
1. **URL state sync** — Pattern `useSearchParams` (read) + `router.replace(?...)` (write debounced 500ms để tránh history spam). Filter changes trigger query refetch + URL update song song.
2. **Search debounce** — 300ms typing → 500ms URL sync (2 levels). TanStack Query staleTime: 30s.
3. **Sortable column header** — Component `<SortableHeader column="margin" currentSort={sortBy} dir={sortDir} onSort={...} />` reusable. Hiển thị `↑` `↓` `↕` icon theo state.
4. **MarginTier badge** — Reuse F-028 Phase 3 component nếu có (grep `marginTier`); nếu chưa có util `getMarginColor(tier)` thì viết inline 4-case.
5. **403 state** — Pattern F-026 dùng `<RestrictedAccess />`. Render BEFORE TanStack Query mount để tránh waste request.
6. **Empty state CTA** — "Reset filter" call `router.replace('/finance/contracts')` clear all params.

---

## 🛑 PAUSE points cho Coder

Trước khi làm các bước sau, Coder DỪNG và confirm với Danny qua chat:

- 🛑 **Controller routing decision** — chọn split controller (`pnl-contracts-list.controller.ts` mới) HAY inline vào `pnl-dashboard.controller.ts`. Recommend split. Confirm trước khi code.
- 🛑 **Period enum extension** — nếu thấy cần `all_time`, dừng hỏi Danny (đề xuất: SKIP, dùng `last_12_months`).
- 🛑 **Refactor `getDashboardData()` body** — nếu extract `computeContractItems()` thay đổi behavior dashboard cũ (vì F-028 + F-036 tests đã PASS), Coder phải run regression `pnl.service.spec.ts` toàn bộ ĐẢM BẢO không break. Nếu test fail → STOP, hỏi Manager.
- 🛑 **Cache invalidation site coverage** — grep `pnl:dashboard` ra N call sites. Coder LIST tất cả N sites trong `03-coder-implementation.md` section "Cache invalidation hooks added" để Manager verify ở deploy. Thiếu 1 site = stale cache bug.
- 🛑 **KHÔNG `pnpm install`** — feature này KHÔNG cần dep mới (crypto + reuse types).
- 🛑 **Scope creep** — nếu Coder phát hiện cần đụng file ngoài Scope Lock → STOP, hỏi Manager update plan.

---

## 🧪 Unit test BẮT BUỘC (Coder phải viết, QC sẽ check)

Coder KHÔNG được mark `READY_FOR_QC` nếu thiếu các test sau trong `pnl.service.spec.ts`:

### `describe('getContractsList()')` — 11 TC-CL từ PRD

- [ ] **TC-CL-01** Default filter → 200 với items[20] + totals + pagination shape correct
- [ ] **TC-CL-02** Status whitelist → 5 contracts (2 ACTIVE + 1 COMPLETED + 1 DRAFT + 1 CANCELLED) → only 3 in response
- [ ] **TC-CL-03** Search combined — `?q=Zaha` match A + C (contractNumber/partnerName/raceName 3 fields)
- [ ] **TC-CL-04** Pagination boundary `?page=2&limit=20` → items[20..39], total=50, totalPages=3
- [ ] **TC-CL-05** Sort margin ASC → loss-making rows top, neutral last
- [ ] **TC-CL-06** Search escape regex `?q=(a+)+$` → response < 200ms, no ReDoS
- [ ] **TC-CL-07** Cache hit — 2 consecutive same-filter → 1st compute, 2nd Redis hit (mock assertion)
- [ ] **TC-CL-08** Auth missing → 401
- [ ] **TC-CL-09** Non-admin → 403
- [ ] **TC-CL-10** Validation invalid limit=999 → 400 with VN message "Limit không hợp lệ"
- [ ] **TC-CL-11** Cache invalidation — mutation contract PATCH → next list call recompute

### Additional unit (Coder bắt buộc)
- [ ] `hashFilter()` — same filter object different key order → same hash (deterministic)
- [ ] `escapeRegex` util — special chars `.*+?^${}()|[]\` escaped correctly
- [ ] `PnLContractsListFilterDto` validation — page<1, page>9999, limit not in enum, sortBy invalid, q >100 char → all reject

**Target: 11 TC-CL + 3 additional = 14 test cases minimum. Hiện `pnl.service.spec.ts` có 32 tests F-028+F-036 PASS → final target ≈ 46 tests PASS.**

---

## 📊 Verdict

> ### ✅ APPROVED — Coder có thể bắt đầu

**Lý do APPROVE:**
1. PRD đầy đủ 11 BR testable + 11 TC-CL + 10 E2E
2. Scope rõ ràng, không đụng schema, không cần migration
3. Reuse compute path proven F-028 + F-036 (16+16 tests PASS)
4. Performance SLA cụ thể với cache strategy
5. Security defense-in-depth (LogtoAdminGuard + page gate + escapeRegex)

**Coder bắt đầu với:**
1. Read 3 file then chốt: `pnl.service.ts:364-530`, `pnl.service.ts:165-310`, `pnl-dashboard.controller.ts`, `dashboard-filter.dto.ts`, `dashboard-response.dto.ts`, `finance-api.ts:298-344`, `period-filter.tsx`
2. Decide routing (split vs inline controller) → confirm Danny
3. Grep cache flush sites cho `pnl:dashboard` → list cho Manager verify
4. Implement backend trước (DTO → service method → controller → spec), commit incremental
5. Run `pnl.service.spec.ts` toàn bộ → verify 32 cũ PASS + 14 mới PASS
6. Implement admin sau (helper → page rewrite → 5 components)
7. Mark `🟠 READY_FOR_QC` khi: 46 unit tests PASS + lint + typecheck + admin build success

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] **Yes** — Coder có thể bắt đầu, theo Scope Lock + PAUSE points + 3 naming mismatches notes
- [ ] No

---

## 🔗 Next step

Danny chạy: `/anthropic-skills:5bib-fullstack-engineer FEATURE-038-finance-contracts-list-pnl`

Coder sẽ output `03-coder-implementation.md` + actual code + 14 unit tests PASS + cache invalidation hooks list.
