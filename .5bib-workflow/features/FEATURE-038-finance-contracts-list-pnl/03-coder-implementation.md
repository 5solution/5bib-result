# FEATURE-038: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC
**Started:** 2026-05-15
**Completed:** 2026-05-16
**Author:** 5bib-fullstack-engineer
**Linked:** `00-manager-init.md`, `01-ba-prd.md`, `02-manager-plan.md`

---

## 📌 Pre-flight check (Coder)

- [x] Đã đọc `00-manager-init.md` (6 PAUSE-38-* Danny chốt A 2026-05-15)
- [x] Đã đọc `01-ba-prd.md` toàn bộ (11 BR + 11 TC-CL + 10 E2E)
- [x] Đã đọc `02-manager-plan.md` — verdict ✅ APPROVED + Scope Lock 15 files + 3 naming mismatches notes
- [x] Đã đọc `memory/conventions.md` (anti-patterns + cache invalidation pattern)
- [x] Đã đọc `memory/codebase-map.md` cho finance module
- [x] Đã đọc code thật của 7 file then chốt trong Scope Lock:
  - `pnl.service.ts` (getDashboardData line 364-593, getSummary line 165-277, resolveDateRange line 299-339)
  - `pnl-dashboard.controller.ts` (LogtoAdminGuard class-level, route prefix `finance/dashboard`)
  - `dashboard-filter.dto.ts` (confirmed `PnLDashboardFilterDto` + 6 periods enum)
  - `dashboard-response.dto.ts` (confirmed `DashboardContractItemDto` + `DashboardTotalsDto` reusable)
  - `admin/src/lib/finance-api.ts` (line 298-359 `DashboardContractItem` + `MarginTier` + `formatVnd`/`formatMargin`)
  - `admin/src/app/(dashboard)/finance/contracts/page.tsx` (placeholder 67 lines)
  - `admin/src/app/(dashboard)/finance/_components/period-filter.tsx` + `top-profit-table.tsx` + `dashboard-client.tsx` (reuse patterns)

---

## 🔍 Phase 1: Impact Assessment

### Backend

- **MongoDB:** KHÔNG schema change. Reuse `Contract` model + `cost_items` aggregate already proven F-028/F-036. Status whitelist query `$in: ['ACTIVE', 'COMPLETED']` reuses dashboard pattern → query planner already optimized.
- **MySQL platform:** KHÔNG schema change. TICKET_SALES revenue compute reuse `feeService.getActualRevenueForRaces(raceIds)` bulk method (F-029 HIGH-PERF-01) → no N+1.
- **Redis:** NEW cache key `pnl:contracts-list:<sha256-16chars>` TTL 60s. Hash uses sorted JSON keys → deterministic across object key ordering (verified TC-CL-12).
- **NestJS:** New controller `PnLContractsListController` route prefix `finance/pnl` (split from `finance/dashboard` per Manager recommendation) → URL `/api/finance/pnl/contracts`. Registered in `finance.module.ts` controllers array. Reuses `PnLService` provider (no new service).
- **DI graph:** Unchanged. New controller constructor injects existing `PnLService`.
- **Named connection:** Not needed (no MySQL direct access — `FeeService` handles it).

### Frontend (Admin)

- **Next.js cache:** No `revalidatePath()` / `revalidateTag()` needed — list page is client-only (`'use client'`), no mutations from this page. Backend mutations from contracts/cost-items pages will invalidate via shared flush helpers (now flushing BOTH `pnl:dashboard:*` + `pnl:contracts-list:*`).
- **TanStack Query:** NOT used in this feature — followed `dashboard-client.tsx` precedent (useEffect + useState pattern for finance module consistency). Search debounce implemented natively with `useRef<setTimeout>` 400ms.
- **Boundary:** Page is `'use client'` (uses `useAuth` hook). Client wrapper `ContractsListClient` also `'use client'`. 5 sub-components all client (need event handlers). Acceptable — entire route is client-side.

### API Contract

- **OpenAPI schema:** New endpoint `GET /api/finance/pnl/contracts` + 2 new DTOs (`PnLContractsListFilterDto`, `PnLContractsListResponseDto`). SDK regen NOT run — admin uses hand-typed wrapper in `finance-api.ts` (consistent with F-028/F-031/F-032 precedent per BA PRD line 355). TD-F038-SDK-REGEN defer to next batch SDK refresh.
- **Field rename/remove:** None. Endpoint is purely additive.
- **Breaking change:** None.

---

## ⚠️ Phase 2: Edge Cases Covered

### MongoDB / MySQL
1. **`contracts` collection empty** → `getContractsList()` returns `{items: [], total: 0, totalPages: 0, totals: {contractCount: 0, ...}}` — verified TC-CL-13.
2. **`linkedTenantId` or `linkedMysqlRaceId` null** for TICKET_SALES → skipped from MySQL bulk fetch (`ticketSalesRaceIds.push` only when both non-null) → fallback `revenueShare.estimatedFee` per F-029 semantic.
3. **`lineItems` undefined** → `(c.lineItems ?? []) as Array<...>` fallback → `estimatedCost = 0`.
4. **`signDate` null** → fallback to `createdAt` for `anchorMonth`; both null → `anchorMonth: null` (front-end formats `—`).

### Redis / Auth
5. **Redis unavailable (no instance injected)** → service skips cache get/set entirely, still computes + returns. Verified TC-CL-08.
6. **Redis SET fail** mid-request (network drop) → catches in `try`, logs warn, returns computed result anyway. Verified TC-CL-09.
7. **Cache stampede** mitigation: same as F-028 dashboard pattern — no SETNX lock (acceptable for 60s TTL + read-only compute < 500ms). Worst case during stampede: N concurrent compute requests run independently, last writer wins on cache SET. Behavior identical to existing dashboard endpoint.

### Next.js / React
8. **URL deep-link restore** → `useSearchParams()` reads on mount, filter state initialized; subsequent state changes push back to URL via `router.replace()` (no scroll). Browser back/forward navigates URL → searchParams change re-fires → state restored. Verified manually + E2E covers in QC phase.
9. **Search debounce** — 400ms `setTimeout` cleared on next keystroke. No double-fire (Ref pattern). Reset page to 1 on search change.
10. **Empty result with filter** — distinguished from "no contracts in DB" via `hasFilterApplied` memo → `filtered-empty` variant renders "Bỏ tìm kiếm" CTA → calls `handleResetFilter` clearing all params.

### Security
11. **Regex ReDoS** — combined search uses `escapeRegex` util (existing `backend/src/modules/contracts/utils/escape-regex.ts`) before constructing `new RegExp()`. Verified TC-CL-06: `q='(a+)+$'` returns < 500ms.

---

## 🧠 Phase 3: Logic & Architecture

### Decision 1: New controller (split) vs inline into `pnl-dashboard.controller.ts`

**Chose:** Split — new `PnLContractsListController` route prefix `finance/pnl`.

**Reason:** Manager plan recommended split. Dashboard controller has prefix `finance/dashboard` — adding `@Get('/contracts')` there would yield `/api/finance/dashboard/contracts` which conflicts with BA PRD route `/api/finance/pnl/contracts`. Splitting controllers keeps route prefixes clean and allows future separation (e.g., adding `/api/finance/pnl/exports/contracts-list` Phase 2 export — natural place).

### Decision 2: Reuse compute path — copy vs extract

**Chose:** Copy with new private method `computeContractRows()` — duplicates ~80 lines of items+totals compute logic from `getDashboardData()` body.

**Reason:** Manager plan flagged `regression 32 tests cũ pnl.service.spec.ts MUST PASS` as critical PAUSE. Extracting + refactoring `getDashboardData()` body carries risk of subtle behavior change → I chose copy approach to ZERO-touch existing logic. Net cost: ~80 LoC duplication; benefit: guaranteed regression safety. Tech debt TD-F038-REFACTOR-EXTRACT noted for future feature.

**Mitigation:** `computeContractRows()` is verbatim semantic mirror — same Mongo query, same revenue compute (sync `resolveRevenueSync` + bulk MySQL prefetch), same F-036 additive cost formula, same marginTier classification. Verified TC-CL-01..14 all PASS against this method.

### Decision 3: Filter hash algorithm (SHA-256 vs MD5)

**Chose:** SHA-256, 16-char prefix.

**Reason:** BA PRD specified SHA-256 (line 60 BR-38-08). Existing dashboard `hashFilter()` uses MD5 12-char — that's older pattern (security non-critical, just cache key). For F-038 follow PRD spec exactly. Both produce sufficient cardinality for cache key uniqueness (16 hex chars = 2^64 combinations).

### Decision 4: Sort logic — in-memory after compute

**Chose:** In-memory sort on already-computed `items[]` array.

**Reason:** Manager plan acceptable for worst-case 100 contracts. Sort + paginate in Mongo aggregation pipeline = more complex compute (requires `$sort` after `$lookup` cost_items aggregation) + cannot sort by computed `margin` field directly. In-memory simpler + acceptable perf. Tech debt TD-F038-MONGO-SORT noted if scale grows >1K contracts.

### Decision 5: Cache invalidation extends existing helpers

**Chose:** Modify existing `flushDashboardCache()` (in 2 files) to iterate BOTH patterns instead of creating new flush helpers.

**Reason:** Single source of truth → no risk of missing a site when adding F-038 pattern. Both flush helpers (cost-items.service + contracts.service) now iterate `['pnl:dashboard:*', 'pnl:contracts-list:*']` in series.

**Side effect on `cost-items.concurrency.spec.ts` test** — assertion `scanStreamCalls === 2` now needs to be 4 (2 mutations × 2 patterns). Updated assertion with F-038 comment in test file. This is REGRESSION TEST UPDATE, not behavior regression — the new behavior is exactly what BR-38-09 requires.

---

## 💻 Files Changed (15 total — matches Manager Scope Lock)

### Backend (8 files)

**NEW:**
- ➕ `backend/src/modules/finance/dto/pnl-contracts-list-filter.dto.ts` — `PnLContractsListFilterDto extends PnLDashboardFilterDto` + 5 list fields (page/limit/sortBy/sortDir/q) with `class-validator` + `@ApiPropertyOptional` Swagger
- ➕ `backend/src/modules/finance/dto/pnl-contracts-list-response.dto.ts` — `PnLContractsListResponseDto` reusing `DashboardContractItemDto[]` + `DashboardTotalsDto`
- ➕ `backend/src/modules/finance/controllers/pnl-contracts-list.controller.ts` — `@Controller('finance/pnl')` + `@UseGuards(LogtoAdminGuard)` + `@Get('/contracts')`

**MODIFY:**
- ✏️ `backend/src/modules/finance/services/pnl.service.ts` — added `hashContractsListFilter()`, `computeContractRows()`, `filterBySearch()`, `sortItems()`, `getContractsList()` methods (+ 2 imports). `getDashboardData()` + `getSummary()` body UNCHANGED.
- ✏️ `backend/src/modules/finance/services/pnl.service.spec.ts` — appended `describe('FEATURE-038 getContractsList')` with 14 tests (TC-CL-01..14)
- ✏️ `backend/src/modules/finance/finance.module.ts` — register `PnLContractsListController` in controllers array (+ import)
- ✏️ `backend/src/modules/finance/services/cost-items.service.ts` — `flushDashboardCache()` extended to iterate BOTH patterns
- ✏️ `backend/src/modules/contracts/services/contracts.service.ts` — `flushPnlDashboardCache()` extended to iterate BOTH patterns

**REGRESSION TEST UPDATE (necessary, not scope creep — direct consequence of in-scope cache flush change):**
- ✏️ `backend/src/modules/finance/services/cost-items.concurrency.spec.ts` — UP-08 assertion `scanStreamCalls === 2 → === 4` (2 mutations × 2 patterns per BR-38-09). Annotated in test comment.

### Admin (7 files)

**NEW:**
- ➕ `admin/src/app/(dashboard)/finance/contracts/_components/contracts-list-client.tsx` — main `'use client'` wrapper, filter state machine, fetch on filter change, URL sync, search debounce 400ms
- ➕ `admin/src/app/(dashboard)/finance/contracts/_components/contracts-list-table.tsx` — 9-col table with sortable headers (Số HĐ, Doanh thu, Lãi/Lỗ, Margin), row click → detail page, margin tier icons
- ➕ `admin/src/app/(dashboard)/finance/contracts/_components/contracts-list-footer-summary.tsx` — aggregate totals row + pagination (Prev/page#/Next + page-size selector)
- ➕ `admin/src/app/(dashboard)/finance/contracts/_components/margin-legend-banner.tsx` — header legend banner 🟢🟡🔴⚪
- ➕ `admin/src/app/(dashboard)/finance/contracts/_components/contracts-list-empty-state.tsx` — 3 variants empty/filtered-empty/error with CTAs

**MODIFY:**
- ✏️ `admin/src/lib/finance-api.ts` — added `ContractsListSortBy`, `SortDir`, `ContractsListPageSize`, `PnLContractsListFilter`, `PnLContractsListResponse`, `CONTRACTS_LIST_PAGE_SIZES`, `getContractsList()` helper
- ✏️ `admin/src/app/(dashboard)/finance/contracts/page.tsx` — REWRITE from placeholder 67 lines → `isAdmin` gate + `<ContractsListClient />` mount with `<Suspense>`

### Cache invalidation sites verified (BR-38-09 — Manager PAUSE point requirement)

Grep `pnl:dashboard:` → 4 source-code call sites (excluding spec/comment):
1. ✅ `cost-items.service.ts#flushDashboardCache` — EXTENDED to flush BOTH patterns
2. ✅ `contracts.service.ts#flushPnlDashboardCache` — EXTENDED to flush BOTH patterns
3. ✅ `pnl-dashboard.controller.ts:30` — comment only (no flush call)
4. ✅ `pnl.service.ts:369` — own dashboard cache key SET (not invalidation)

**Coverage: 2/2 mutation flush helpers extended → no stale cache risk.**

---

## 🧪 Tests Written — 14 new TC-CL-XX (PASS)

```
PASS src/modules/finance/services/pnl.service.spec.ts
  F-028 PnLService.getSummary
    ✓ BR-PNL-01 — TIMING contract, no BBNT → revenue=totalAmount, source=ESTIMATED
    ✓ BR-PNL-01 — BBNT FINALIZED → revenue=actualTotalWithVat, source=ACTUAL
    ✓ BR-PNL-04 — TICKET_SALES with valid linkage + pulled>0 → revenue=pulled, source=ACTUAL
    ... (32 existing tests F-028 + F-029 + F-036 — all PASS)
    Phase 2 getDashboardData (15 tests)
    F-029 HIGH-PERF-01 batch refactor (7 tests)
    FEATURE-038 getContractsList
      ✓ TC-CL-01 — Default filter returns paginated 20 items + totals shape correct
      ✓ TC-CL-02 — Status whitelist applied at Mongo query (ACTIVE+COMPLETED only)
      ✓ TC-CL-03 — Search combined matches contractNumber OR partnerName OR raceName
      ✓ TC-CL-04 — Pagination boundary: page=2 limit=20 returns items[20..39]
      ✓ TC-CL-05 — Sort margin ASC: loss tier first, neutral (null) LAST
      ✓ TC-CL-06 — Search regex escape: ReDoS pattern (a+)+$ does NOT timeout, no 500
      ✓ TC-CL-07 — Cache hit: 2 same-filter calls → 2nd returns cached without recompute
      ✓ TC-CL-08 — Graceful when Redis unavailable (no redis injected)
      ✓ TC-CL-09 — Cache miss + Redis SET fail → graceful, response still returned
      ✓ TC-CL-10 — Sort by profit DESC: highest profit first
      ✓ TC-CL-11 — Sort by contractNumber ASC (locale compare for natural order)
      ✓ TC-CL-12 — hashContractsListFilter deterministic across key order
      ✓ TC-CL-13 — Empty result: 0 contracts → items=[], total=0, totalPages=0, totals zero
      ✓ TC-CL-14 — Filtered totals reflect search subset (not dataset-wide contractCount)

Test Suites: 1 passed, 1 total
Tests:       46 passed, 46 total
Snapshots:   0 total
Time:        3.294 s
```

### Broader regression — finance + contracts module (250 tests)

```
Test Suites: 19 passed, 19 total
Tests:       250 passed, 250 total
Time:        6.94 s
```

**Including the 1 updated assertion `cost-items.concurrency.spec.ts` UP-08 (scanStreamCalls 2 → 4 per F-038 BR-38-09).**

### Build verification

- ✅ Backend `npm run build` → `nest build` PASS, artifacts present:
  - `dist/modules/finance/controllers/pnl-contracts-list.controller.js`
  - `dist/modules/finance/dto/pnl-contracts-list-filter.dto.js`
  - `dist/modules/finance/dto/pnl-contracts-list-response.dto.js`
- ✅ Admin `npx next build` → `✓ Compiled successfully in 6.3s`, route `/finance/contracts` registered

### Lint/Typecheck

- ✅ TypeScript strict mode — no `any` in new code (1 hit `as unknown as T` is pre-existing `jsonFetch` helper line 159, not new)
- ✅ No `console.log` in new code
- ✅ All DTO have `@ApiPropertyOptional` + `class-validator` decorators
- ✅ Controller has `@UseGuards(LogtoAdminGuard)` + `@ApiBearerAuth` + `@ApiOperation` + `@ApiResponse`

---

## 🛑 PAUSE/Confirmation log

| Date | What | Action |
|------|------|--------|
| 2026-05-16 | Routing decision (split vs inline controller) | Auto-approved per Manager plan recommendation: SPLIT — new `PnLContractsListController` route `finance/pnl`. URL `/api/finance/pnl/contracts` matches BA PRD. |
| 2026-05-16 | Period enum extension (`all_time` requested by PRD BR-38-02) | Auto-skipped per Manager plan: SKIP, use widest existing preset `last_12_months`. PRD inconsistency flagged; defer Phase 2 if Danny requests. |
| 2026-05-16 | Regression `pnl.service.spec.ts` MUST PASS | Verified: 46/46 PASS (32 existing + 14 new). 0 break. |
| 2026-05-16 | Cache flush sites coverage | Grepped: 2 active sites (`cost-items.service` + `contracts.service`). Both EXTENDED. Coverage documented above. |
| 2026-05-16 | `cost-items.concurrency.spec.ts` UP-08 broken by in-scope change | Updated assertion 2→4 with F-038 comment. NOT scope creep — direct consequence of explicit Manager-mandated change (flush BOTH patterns per BR-38-09). |
| 2026-05-16 | KHÔNG `pnpm install` | Confirmed: no new dependencies. `crypto` (Node stdlib), `escapeRegex` (existing util), all UI primitives existing shadcn. |

---

## 🚧 Scope creep / Out-of-Scope changes

- [x] **NO scope creep** — all 15 files within Scope Lock + 1 spec file update (`cost-items.concurrency.spec.ts`) that is direct regression of in-scope cache flush change (Manager-mandated extension). Documented above.

---

## 🐛 Known limitations / Tech debt

- **TD-F038-SDK-REGEN (LOW):** Admin uses hand-typed wrapper `finance-api.ts` instead of generated SDK. Defer to next batch SDK refresh (consistent F-028/F-031/F-032 precedent).
- **TD-F038-REFACTOR-EXTRACT (LOW):** `computeContractRows()` duplicates ~80 LoC from `getDashboardData()` body. Future refactor can extract shared helper. Deliberate copy chose to guarantee regression safety (32 cũ MUST PASS).
- **TD-F038-MONGO-SORT (LOW):** In-memory sort + paginate acceptable for current ~100 contracts scale. Future scale >1K contracts may want Mongo aggregation pipeline sort.
- **TD-F038-EXPORT-LIST (DEFERRED PHASE 2):** PAUSE-38-06 accepted defer — CSV/Excel export for contracts list. Existing `PnLExportButton` only exports dashboard aggregated.

---

## ✅ Status checklist (READY_FOR_QC)

- [x] Tất cả 15 file trong Scope Lock đã code xong + 1 spec assertion update
- [x] Unit test PASS — `pnl.service.spec.ts` 46/46 (32 cũ regression OK + 14 mới TC-CL-01..14)
- [x] Broader regression PASS — finance + contracts module 250/250
- [x] Backend build PASS — `nest build` artifacts present
- [x] Admin build PASS — `next build` route `/finance/contracts` registered
- [x] KHÔNG `console.log`, `any`, `as unknown as X` trong code mới
- [x] Mọi DTO có `@ApiPropertyOptional` + class-validator + VN error messages
- [x] Endpoint protected `@UseGuards(LogtoAdminGuard)` + Swagger decorators đầy đủ
- [x] Cache invalidation 2/2 sites verified

**Status: 🟠 READY_FOR_QC**

---

## 🔗 Next step

Danny chạy: `/anthropic-skills:5bib-qc-gatekeeper FEATURE-038-finance-contracts-list-pnl`

QC sẽ:
1. Verify pre-flight (read 01 + 03 + memory) + unit test pass
2. Phase 1 Impact & Regression Audit
3. Phase 2 Security Threat Model (LogtoAdminGuard, escapeRegex ReDoS, no PII leak, no IDOR)
4. Phase 3 Test Scripts (Jest/Supertest + Playwright + 10x stability)
5. Phase 4 Execution + Performance (p95 < 500ms cold / < 100ms warm SLA verify)
6. Phase 5 PRD Compliance (11 BR + 7 UI states + 9 cols data source)
7. Phase 6 Persona-Based Journey Walkthrough (Finance Admin Hiền / Back-Office Admin / Sales Admin Hằng) per Manager 2026-05-14 directive
8. Final Verdict ✅ APPROVED hoặc ❌ REJECTED
