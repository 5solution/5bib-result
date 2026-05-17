# FEATURE-040: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-05-17
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check (Manager)

- [x] Đã đọc `00-manager-init.md` (187 dòng, 7 PAUSE conditions, Manager đề xuất sẵn)
- [x] Đã đọc `01-ba-prd.md` toàn bộ (~840 dòng, 18 BR + 19 TC-FE + 10 E2E)
- [x] Đã đọc memory: `codebase-map.md` finance/reconciliation/merchant, `conventions.md`, `known-issues.md` (TD-F016-FINANCE-01 + TD-F003-02 + TD-F029-01)
- [x] Đã spot-check code path: `fee.service.ts:200-410`, `pnl.service.ts:100-440`, `merchant-config.schema.ts`, `reconciliation.schema.ts:62-114`, `reconciliation.service.ts:65-110`

---

## ✓ PRD Validation Checklist (8 items Manager requires)

### 1. Completeness
- [x] **User Stories đầy đủ** với 4 Persona chuẩn (Finance Admin Hiền / Back-Office Admin / Sales Admin Hằng / CFO Finance Director). Format strict "As a... I want... so that..." applied.
- [x] **Business Rules có ID** BR-40-01..18 + structured groups (Source priority / Self-compute formula / Rate cascade / Source badge & UI / Cache / Defensive guards / Status whitelist / Backward compat).
- [x] **7 PAUSE-40-* answered** (40-01..07 đều có Manager-aligned answer + encoded vào BR cụ thể).

### 2. Technical correctness vs codebase
- [x] **DB change phù hợp** — KHÔNG schema change, additive read only. Reuse existing `merchant_configs` + `reconciliations` MongoDB collections.
- [x] **Endpoint design REST convention** — 3 existing endpoints semantic update + 1 NEW `GET /api/finance/contracts/:id/fee-breakdown` (admin debug drill-down).
- [x] **Cache key pattern** khớp `[resource]:[id]:[variant]` — `pnl:ticket-sales-fee:<contractId>` reuse + 3 companion keys.
- [x] **Cross-DB pattern** — chỉ READ MongoDB merchant_configs + MongoDB reconciliations + MySQL platform orders (existing pattern fee.service đã có).
- [x] **SDK regen** — BA correctly identify admin pattern hand-typed `finance-api.ts` consistent F-028/F-031/F-032/F-038 — defer TD same as TD-F038-SDK-REGEN. KHÔNG cần regen ngay.

### 3. UI states đầy đủ
- [x] 10 states cover: Loading / Empty / Data / Filtered empty / Error fetch / Tooltip loading / ESTIMATED hidden badge / Admin restriction / Cross-DB degraded banner / TD-F016 legacy warning banner.

### 4. Security
- [x] All endpoints `@UseGuards(LogtoAdminGuard)` — verified per Endpoint Spec table.
- [x] No IDOR (admin-only, no per-resource ownership).
- [x] Response NOT leak — `apiToken`, MerchantConfig nested non-fee fields, MongoDB stack trace explicitly excluded.
- [x] Cross-DB error wrapped — KHÔNG expose raw MySQL connection error.

### 5. Performance
- [x] **SLA có số cụ thể**:
  - Dashboard 100 contracts cold < 800ms (preserve F-029 SLA)
  - Dashboard warm < 100ms
  - Per-contract detail cold < 400ms / warm < 50ms
  - Cache hit ratio > 80% sau 60min steady state
  - MerchantConfig lookup < 20ms (indexed unique)
  - Reconciliation overlap query < 50ms (indexed tenant_id + mysql_race_id)
- [x] Cache TTL 3600s + 5 invalidation triggers matrix (BR-40-11)
- [x] F-029 HIGH-PERF-01 bulk pattern preserved cho dashboard batch path

### 6. Testability
- [x] **19 TC-FE backend tests** với 8 elements mỗi case (Method/URL/Headers/Body/Expected status/Expected body shape/MUST NOT leak/Side effect verify).
- [x] **10 E2E Playwright** persona-based (4 personas covered).
- [x] BR coverage matrix tracked.
- [x] **TD-F016 + TD-F003-02 defensive tests** explicit (TC-FE-06 + TC-FE-19).
- [x] Cache hit determinism test (TC-FE-10).
- [x] Concurrent / boundary cases (TC-FE-18 boundary period overlap exact start).

### 7. API contract
- [x] **NO breaking change** — `revenue` field type unchanged (number VND), semantic shift only (gross → fee). Frontend label "Doanh thu" KHÔNG đổi (Option C per BR-40-10).
- [x] Additive fields: `feeSource` enum, `grossGMV?`, `feeWarning?`, `feeBreakdown?`, `feeSourceMix` aggregate, `feeSource?` filter.

### 8. Migration & deploy
- [x] **NO MongoDB/MySQL schema change** flag.
- [x] Cache eager flush post-deploy ghi rõ trong PAUSE-40-07 answer:
  ```bash
  ssh 5solution-vps "docker exec 5bib-result-redis redis-cli --scan --pattern 'pnl:*' | xargs docker exec -i 5bib-result-redis redis-cli del"
  ```
  Manager sẽ add vào `05-manager-deploy.md` Deploy summary checklist.

---

## 📊 Cross-check với memory

### Architecture impact
- Feature thêm cross-module data flow: FinanceModule → MongoDB `merchant_configs` + `reconciliations` (existing collections, no new). Architecture diagram cần update post-deploy: thêm arrow `PnLService → ReconciliationQueryService` + `PnLService → MerchantConfig model`.
- Avoid circular dependency: BA correctly đề xuất import **models** directly từ MerchantModule, KHÔNG import ReconciliationService. Manager ratify approach.

### Convention impact
- **NEW pattern emerging:** Source attribution via enum field (`feeSource`) + companion cache keys (`pnl:fee-source:`, `pnl:gross-gmv:`). Post-deploy `conventions.md` cần thêm pattern "Compute source attribution + dual cache keys" cho features compute từ multiple sources.
- BR-40-08 rate cascade fallback (3-tier) — pattern có thể reuse cho config-derived computations khác trong tương lai.

### Known issues impact
- **TD-F016-FINANCE-01** (RESOLVED partial) — BA chốt trust legacy BBNT signed values immutable. Decision: documented in BR-40-12 + tested in TC-FE-06. Future feature recompute migration TBD (separately tracked).
- **TD-F003-02** reconciliation period overlap race condition — BR-40-13 defensive: SUM duplicate docs gracefully + log WARN. TC-FE-19 verify.
- **TD-F029-01** EXPLAIN ANALYZE bulk SQL deferred — Manager note: F-040 phải preserve bulk pattern F-029, NẾU rewrite SQL với CASE statement, verify EXPLAIN PLAN tương đương index usage. Add Coder PAUSE point.
- **F-038 cache TTL 60s** vs F-040 TTL 3600s — discrepancy intentional: F-038 list aggregate ngắn TTL vì filter+pagination thường đổi; F-040 fee per contract dài TTL vì source data stable.

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ được sửa các file dưới đây. Ngoài scope = scope creep, phải hỏi Manager.

### Backend (12 files)

**Modify (8):**
- ✏️ `backend/src/modules/finance/services/fee.service.ts` — **CORE REWRITE**: replace `getActualRevenueForRace()` + `getActualRevenueForRaces()` bulk variant. SQL refactor SUM(total_price) → CASE statement với fee per category formula. Inject `ReconciliationQueryService` model.
- ✏️ `backend/src/modules/finance/services/pnl.service.ts` — `resolveRevenue()` + `resolveRevenueSync()` semantic update. Return `{ fee, source, grossGMV, breakdown }`. Add `getDashboardData()` bulk pre-fetch reconciliations song song với revenue prefetch.
- ✏️ `backend/src/modules/finance/finance.module.ts` — import MerchantConfig + Reconciliation models (direct, NOT service import → avoid circular).
- ✏️ `backend/src/modules/finance/dto/pnl-response.dto.ts` — extend `DashboardContractItemDto` + `PnLDashboardTotalsDto`. Add NEW DTOs: `ReconciledFeeSliceDto`, `SelfComputeSliceDto`, `FeeBreakdownDto`, `FeeSourceMixDto`.
- ✏️ `backend/src/modules/finance/dto/dashboard-filter.dto.ts` — KHÔNG đụng (F-038 filter dto bypass — verify scope)
- ✏️ `backend/src/modules/finance/dto/pnl-contracts-list-filter.dto.ts` (F-038) — add `feeSource?: FeeSource` filter field.
- ✏️ `backend/src/modules/finance/controllers/pnl.controller.ts` (HOẶC fee-breakdown.controller.ts NEW) — register NEW endpoint `GET /:id/fee-breakdown`.
- ✏️ `backend/src/modules/reconciliation/services/reconciliation-query.service.ts` — add NEW method `getReconciledFeeForContract()`.

**NEW (1 controller):**
- ➕ Có thể split `pnl.controller.ts` thêm route hoặc tạo `fee-breakdown.controller.ts` — Coder quyết. Recommend split: cleaner module org.

**Cache invalidation hooks (3 modify):**
- ✏️ `backend/src/modules/merchant/merchant.service.ts` — `updateFeeConfig()` hook DEL `pnl:*` matching tenantId contracts.
- ✏️ `backend/src/modules/reconciliation/reconciliation.service.ts` — `signReport()` / `approve()` / `update()` / `delete()` hooks DEL `pnl:*` matching (mysql_race_id, tenant_id).
- (NEW pattern grep: also check `reconciliation.cron.ts` if auto-create signs).

**Spec extend (2 modify, ≥35 NEW tests):**
- ✏️ `backend/src/modules/finance/services/fee.service.spec.ts` (~18KB existing) — extend với fee compute test scenarios (TC-FE-01..09).
- ✏️ `backend/src/modules/finance/services/pnl.service.spec.ts` (~30KB existing) — extend với recon override + MIXED source scenarios (TC-FE-04..06, 11..13).

**NEW spec (1):**
- ➕ `backend/src/modules/reconciliation/services/reconciliation-query.service.spec.ts` — NEW method tests (TC-FE-04, 06, 18, 19).

### Admin (10 files)

**REWRITE (1):**
- ✏️ `admin/src/app/(dashboard)/finance/contracts/_components/contracts-list-table.tsx` (F-038) — add source badge column rendering + tooltip on Doanh thu cell.

**Modify (4):**
- ✏️ `admin/src/app/(dashboard)/finance/contracts/_components/contracts-list-client.tsx` — sync `feeSource` URL filter.
- ✏️ `admin/src/app/(dashboard)/finance/_components/dashboard-client.tsx` (F-028) — add source mix strip below KPI cards.
- ✏️ `admin/src/app/(dashboard)/finance/_components/pnl-summary-card.tsx` (F-028) — KPI label tooltip update.
- ✏️ `admin/src/app/(dashboard)/contracts/[id]/page.tsx` — Lãi/Lỗ section integrate `FeeBreakdownPanel` component.

**NEW (3 components):**
- ➕ `admin/src/app/(dashboard)/finance/_components/fee-source-badge.tsx` — Pill badge enum → label/color/icon helper.
- ➕ `admin/src/app/(dashboard)/finance/_components/source-mix-strip.tsx` — Stacked bar % visualization on dashboard.
- ➕ `admin/src/app/(dashboard)/contracts/_components/fee-breakdown-panel.tsx` — Expand/collapse with breakdown sections.

**Helper extend (2):**
- ✏️ `admin/src/lib/finance-api.ts` — add `getFeeBreakdown(contractId)` helper + types `FeeSource`, `FeeBreakdownResponse`, `ReconciledFeeSliceClient`, `SelfComputeSliceClient`. Extend `getContractsList` types với optional `feeSource` query param.
- ✏️ `admin/src/lib/finance-api.ts` types — extend `DashboardContractItem` type với `feeSource`, `grossGMV?`, `feeWarning?`.

### Out of scope (KHÔNG đụng)
- ❌ MongoDB Contract schema
- ❌ MySQL platform DB schema  
- ❌ `reconciliation.service.ts` business logic (chỉ thêm cache flush hooks)
- ❌ `merchant.service.ts` business logic (chỉ thêm cache flush hook)
- ❌ Reconciliation domain calculations (`reconciliation-calc.service.ts`)
- ❌ F-028 dashboard chart logic (PnLTrendChart / PnLCategoryDonut — chỉ touch KPI cards + add source mix strip)
- ❌ Recompute migration cho 15 pre-F016 reconciliations — defer separate feature
- ❌ Admin SDK regen — same TD-F038-SDK-REGEN defer

**Total file count:** Backend 12 + Admin 10 = **22 files** (medium-large feature, comparable to F-038)

---

## 🔧 Tech approach (đề xuất — Coder tinh chỉnh)

### Backend
1. **Extract shared util** từ `reconciliation-calc.service.ts` cho self-compute formula reuse — BA flag in 00 init. Coder consider extract `computeFeeFromOrders()` private helper into shared module HOẶC inline duplicate (acceptable nếu logic ≤30 LoC). Coder benchmark + decide.
2. **Bulk pre-fetch reconciliations** trong `getDashboardData()` — query 1 lần với `tenant_id: { $in: [...] }, mysql_race_id: { $in: [...] }` then group by (tenantId, raceId) Map for O(1) lookup. Mirror F-029 HIGH-PERF-01 pattern.
3. **SQL refactor** `getActualRevenueForRace()`:
   - **Option A:** ONE query với CASE statement (như Coder Choice 1 trong 00). Sub-query để JOIN order_line_item lấy quantity cho MANUAL. Pros: 1 round-trip MySQL. Cons: query complexity tăng.
   - **Option B:** TWO queries separate (% fee for 5BIB-eligible + VNĐ/vé for MANUAL). Pros: simpler. Cons: 2 round-trips.
   - **Recommend Option A** + EXPLAIN PLAN verify post-deploy (TD-F029-01 unblock cơ hội).
4. **Cache key strategy** — namespace by tenantId trong key (e.g. `pnl:ticket-sales-fee:<contractId>:tenant=<tenantId>`) để DEL pattern dễ match khi MerchantConfig update. Alternative: track contractIds per tenant trong Mongo, query first to compute keys. Recommend embedding tenantId in key.
5. **Reconciliation query method** thêm vào existing `ReconciliationQueryService` (KHÔNG tạo service mới — proper module org).

### Frontend
1. **TanStack Query key extension:** `['finance', 'fee-breakdown', contractId]` với `staleTime: 60s` (mirror server cache TTL).
2. **Tooltip pattern** dùng shadcn `<Tooltip>` (existing in admin). Render dynamic content per source enum.
3. **Source mix strip** stacked progress bar — Recharts `StackedBarChart` HOẶC pure Tailwind `flex` percent-width children. Recommend Tailwind cho perf (chart lib overkill).
4. **Badge component** reuse existing shadcn `Badge` với variant color override per source enum.

---

## 🛑 PAUSE points cho Coder

Trước khi làm các bước sau, Coder DỪNG và confirm với Danny qua chat:

- 🛑 **SQL CASE statement design** — Coder propose final query + EXPLAIN PLAN output post-rewrite. TD-F029-01 unblock cơ hội — verify MySQL index usage same/better than current `SUM(total_price)` plan.
- 🛑 **Cache key tenantId namespace** — Coder decide embed tenantId vào key vs query-then-DEL. Performance implication for invalidation flush.
- 🛑 **Extract shared util vs inline duplicate** — Coder benchmark + pick. NẾU extract, cần consider impact reconciliation-calc.service.spec.ts test (KHÔNG đụng business logic, chỉ refactor location).
- 🛑 **Controller split** — `pnl.controller.ts` thêm route HAY tạo `fee-breakdown.controller.ts` mới. Recommend split.
- 🛑 **Cache flush hook coverage** — Coder grep ALL mutation sites của MerchantService + ReconciliationService (potential miss: cron jobs, batch updates). LIST tất cả N sites trong `03-coder-implementation.md` để Manager verify post-deploy.
- 🛑 **TD-F016-FINANCE-01 legacy log INFO** — BR-40-12 yêu cầu log INFO `[F-040] consuming legacy recon doc {id}`. Coder verify log volume KHÔNG flood (rate-limit log nếu cần). Mỗi request dashboard có thể log 5-15 lần nếu nhiều legacy recon.
- 🛑 **KHÔNG `pnpm install` dep mới** — feature này KHÔNG cần
- 🛑 **Scope creep** — nếu Coder phát hiện cần đụng file ngoài Scope Lock → STOP, hỏi Manager.

---

## 🧪 Unit test BẮT BUỘC (Coder phải viết, QC sẽ check)

Coder KHÔNG được mark `READY_FOR_QC` nếu thiếu các test sau:

### File `fee.service.spec.ts` (extend ~18KB existing)
- [ ] **TC-FE-01** Self-compute % fee 5BIB-eligible only (happy path)
- [ ] **TC-FE-02** MANUAL VNĐ/vé only — JOIN order_line_item verify quantity SUM correct
- [ ] **TC-FE-03** Mixed category — 5BIB + MANUAL sum
- [ ] **TC-FE-07** Rate cascade tier 2 — contract.feePercentage fallback
- [ ] **TC-FE-08** Rate cascade tier 3 — hardcoded 5.5% + Logger.warn fired
- [ ] **TC-FE-13** Cross-DB graceful — MySQL down → 'ESTIMATED' + warning, no crash
- [ ] **TC-FE-18** Boundary period overlap exact start/end

### File `pnl.service.spec.ts` (extend ~30KB existing — 32 tests cũ MUST still pass)
- [ ] **TC-FE-04** Reconciliation full-period override (RECON > self-compute)
- [ ] **TC-FE-05** Reconciliation partial period — MIXED source
- [ ] **TC-FE-06** Pre-F016 recon legacy — TC trust + log INFO
- [ ] **TC-FE-09** Recon DRAFT status whitelist exclude
- [ ] **TC-FE-10** Cache hit determinism (mock Mongo query count == 1)
- [ ] **TC-FE-16** Filter F-038 list by feeSource enum

### File `reconciliation-query.service.spec.ts` (NEW)
- [ ] **TC-FE-19** Duplicate recon docs — SUM all + log WARN

### Cache invalidation tests (in respective service spec)
- [ ] **TC-FE-11** MerchantConfig update → `pnl:*` DEL pattern fired
- [ ] **TC-FE-12** Reconciliation sign → `pnl:*` DEL pattern fired

### Endpoint integration (NEW spec hoặc extend)
- [ ] **TC-FE-14** IDOR — non-admin → 403
- [ ] **TC-FE-15** NEW fee-breakdown endpoint happy path
- [ ] **TC-FE-17** Validation invalid feeSource enum → 400

**Target: ~50+ tests pass** (32 cũ F-028+F-029+F-036+F-038 regression + 19 mới F-040 + 3 cache hooks)

---

## 📊 Verdict

> ### ✅ APPROVED — Coder có thể bắt đầu

**Lý do APPROVE:**
1. PRD đầy đủ 18 BR testable + 19 TC-FE + 10 E2E + structured tables MANDATORY all present
2. 7 PAUSE-40-* trả lời rõ ràng với BR mapping
3. UI states 10 cases đủ + persona-based E2E 4 personas
4. Performance SLA cụ thể với cache strategy + invalidation matrix 5 triggers
5. Security defense-in-depth (LogtoAdminGuard + cross-DB graceful + no sensitive leak)
6. TD defensive handling explicit (TD-F016 legacy trust + TD-F003-02 duplicate gracefully)
7. Backward compat — additive API + Option C UI display semantic shift only (no rename)
8. Scope hợp lý (22 files, comparable F-038 successful pattern)

**Coder bắt đầu với:**
1. Đọc 10 file then chốt (fee.service, pnl.service, merchant-config.schema, reconciliation.schema, reconciliation-query.service, reconciliation-calc.service, fee.service.spec, pnl.service.spec, period-label.helper, dashboard-snapshot.service)
2. Decision: extract shared util vs inline (benchmark + decide)
3. Decision: cache key tenantId namespace strategy (Coder confirm Danny)
4. Implement Reconciliation query method first (lowest dep)
5. SQL refactor fee.service với CASE statement + EXPLAIN PLAN verify
6. Cache invalidation hooks (grep ALL mutation sites — LIST cho Manager review)
7. Service-level tests (TC-FE-01..09 trên fee.service)
8. Cross-service tests (TC-FE-04..06, 11..13, 16 trên pnl.service)
9. Endpoint NEW + integration tests (TC-FE-14, 15, 17)
10. Admin UI components (badge → strip → breakdown panel order)
11. Run regression: backend 250+ tests PASS + admin build clean

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] **Yes** — Coder có thể bắt đầu, theo Scope Lock + 7 PAUSE points + 19 unit test mandatory

---

## 🔗 Next step

Danny chạy: `/5bib-code FEATURE-040-finance-real-fee-compute`

Coder output `03-coder-implementation.md` + actual code + ≥19 unit tests PASS + cache invalidation hooks list + EXPLAIN PLAN verification.
