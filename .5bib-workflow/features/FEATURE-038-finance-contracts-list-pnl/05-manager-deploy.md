# FEATURE-038: Deploy & Memory Sync

**Status:** ✅ DONE (memory synced — push/deploy pending Manager+BA UI walkthrough)
**Deployed:** 2026-05-16
**Author:** 5bib-manager
**Linked:** `00`, `01`, `02`, `03`, `04`

---

## 📌 Pre-flight check (Manager)

- [x] `04-qc-report.md` verdict = ✅ APPROVED (verified — 0 CRITICAL/HIGH, 13/13 security vectors mitigated)
- [x] Unit test trong `03` PASS — re-verified 46/46 `pnl.service.spec.ts` + 250/250 broader finance+contracts regression
- [x] File thay đổi trong `03` khớp với Scope Lock `02` — 15 files Scope + 1 necessary regression test assertion (`cost-items.concurrency.spec.ts` UP-08 `scanStreamCalls 2→4` documented as direct consequence of BR-38-09 dual-pattern flush — NOT scope creep)
- [x] Đã đọc Tech debt còn lại `03` + `04` — 8 TD-F038-* items documented và appended vào `known-issues.md`

---

## 📊 Deploy summary

- **Branch:** worktree `funny-kirch-90e777` off `release/v1.8.1` — **NOT YET pushed remote**
- **Commits:** Pending Danny approve push per memory rule 2026-05-14 "anti-cowboy workflow — PROD deploy phải qua DEV UAT, KHÔNG push thẳng release/v* trừ critical incident"
- **QC verdict:** ✅ APPROVED
- **Unit tests:** 46/46 `pnl.service.spec.ts` PASS (32 existing F-028+F-029+F-036 regression OK + 14 NEW TC-CL-01..14)
- **Broader regression:** 250/250 finance + contracts module PASS
- **E2E API tests:** Deferred to walkthrough phase (backend container Up 18s commit `0d93d4b` does NOT contain F-038 — needs deploy first)
- **E2E UI tests:** Deferred to walkthrough phase (admin container Up 22h commit `a8ad737` also does NOT contain F-038)
- **Concurrency 10x:** N/A — endpoint is read-only compute (no mutations from this endpoint)
- **Performance SLA:** ⏳ DEFERRED empirical measurement to walkthrough phase (TD-F038-PERF-SLA-MEASURE flagged)
- **Migration:** N/A (no schema change)
- **Backend `nest build`:** PASS (artifacts present in `dist/modules/finance/`)
- **Admin `next build`:** PASS (6.3s compile, route `/finance/contracts` registered as `○ Static` entry point)

---

## 📝 Memory diff (đã apply)

### `feature-log.md`

✏️ Updated:
- **Counter:** Unchanged at `FEATURE-040` (F-039 INITIATED already bumped to next free slot earlier 2026-05-15)
- **Narrative INITIATED entry preserved (line 14, 2026-05-15 F-038 init)**
- **Narrative DEPLOYED entry APPENDED on top (2026-05-16 line 12)** — ~1500 chars detailing 15 files Scope + 1 regression assertion + 11 BR coverage + 46/46 + 250/250 + 8 TD + 3 new patterns minted + NOT YET pushed status
- **Shipped table row APPENDED (top row above F-032)** — full table entry with file count breakdown + QC verdict + TD list + 3 new patterns reference

### `change-history.md`

✏️ Appended at TOP (above F-027 entry):

```markdown
## [2026-05-16] FEATURE-038: Finance Contracts List with P&L Per Row

**Branch:** worktree `funny-kirch-90e777` off `release/v1.8.1` — NOT YET pushed
**Type:** BUGFIX + EXTEND_EXISTING (F-028 Phase 2 follow-up)

### Files changed (15 Scope + 1 regression)
Backend (8 — 3 NEW DTO+controller + 5 modify) + Admin (7 — 5 NEW components + 2 modify) + 1 regression assertion update `cost-items.concurrency.spec.ts` UP-08

### Architecture impact
- NEW endpoint `GET /api/finance/pnl/contracts` (additive)
- NEW Redis cache pattern `pnl:contracts-list:<sha256-16char>` TTL 60s
- 2 flush helpers extended to iterate BOTH patterns

### Conventions impact
3 NEW patterns minted (added to conventions.md):
1. Dual-pattern cache flush helper
2. URL deep-link 2-level debounce
3. Defense-in-depth admin gate (Guard + page isAdmin)
+ Pattern 4: Deterministic cache key hashing (sorted keys)
+ Pattern 5: Read-only compute reuse — copy vs extract trade-off

### Lessons learned
- BA naming mismatch caught by Manager Plan (BA wrote pnl-dashboard.service.ts vs real pnl.service.ts)
- Cache flush dual-pattern test assertion fragility (count-based test → break N×M)
- Compute path duplication: regression safety > DRY when scope is single-feature
- Empirical perf SLA cannot be measured at unit level — walkthrough deferred
```

(Full content in actual file — ~150 lines detailed entry.)

### `codebase-map.md`

✏️ Updated `finance/` module description line 99 — added:
- **F-038 getContractsList() method** in pnl.service
- **F-038 dual-pattern flush** in cost-items.service
- **NEW controller** `pnl-contracts-list.controller.ts` (`@Controller('finance/pnl')`)
- **NEW DTOs** `pnl-contracts-list-filter.dto.ts` + `pnl-contracts-list-response.dto.ts`
- **NEW Redis pattern** `pnl:contracts-list:<sha256-16char>` TTL 60s với dual-pattern invalidation

### `architecture.md`

✏️ Updated FinanceModule entry — added:
- **F-038 getContractsList() reuse compute path**
- **F-038 flush dual-pattern**
- **NEW PnlContractsListController** route prefix `finance/pnl` split from `finance/dashboard`
- **NEW Redis cache** `pnl:contracts-list:<sha256-16char>` TTL 60s
- Cross-pattern invalidation `flushDashboardCache` iterating BOTH `pnl:dashboard:*` + `pnl:contracts-list:*`

### `conventions.md`

✏️ Appended section **"🆕 Patterns minted by FEATURE-038 (Finance Contracts List P&L) — 2026-05-16"** với 5 patterns:

1. **Dual-pattern cache flush helper** — single helper iterates array of patterns trong series
2. **URL deep-link 2-level debounce** — local input (immediate UX) + applied state (debounced 400ms → URL + fetch)
3. **Defense-in-depth admin gate** — Backend Guard + page-level isAdmin check BEFORE client mount
4. **Deterministic cache key hashing** — sorted keys before JSON.stringify để same hash regardless of object key order
5. **Read-only compute reuse — copy vs extract trade-off** — decision matrix (existing tests >20 + recent lineage → COPY)

Mỗi pattern có code example + rationale + gotcha notes.

### `known-issues.md`

✏️ Appended 8 TD-F038-* items to "🟡 Tech debt" table top:

| ID | Severity | Description |
|----|----------|-------------|
| TD-F038-SDK-REGEN | LOW | Hand-typed wrapper vs generated SDK (consistent F-028/F-031/F-032 precedent) |
| TD-F038-REFACTOR-EXTRACT | LOW | ~80 LoC duplicate `computeContractRows` ↔ `getDashboardData` body (deliberate copy) |
| TD-F038-MONGO-SORT | LOW | In-memory sort+paginate (acceptable <1K) |
| TD-F038-EXPORT-LIST | DEFERRED Phase 2 | CSV/Excel export (PAUSE-38-06 accepted) |
| TD-F038-FILTERED-COST-CATEGORY | LOW | `filteredTotals.costByCategory` dataset-wide (unused on list page) |
| TD-F038-PAGE-CLAMP | LOW | `?page=99` not clamped to totalPages (minor UX) |
| TD-F038-AUTH-INTEGRATION-TEST | LOW | HTTP 401/403 deferred to E2E walkthrough |
| TD-F038-PERF-SLA-MEASURE | MED | p95 cold/warm not empirically measured — MUST verify walkthrough phase |

---

## 🔮 Follow-up cho feature kế tiếp

Manager note để nhớ khi init feature mới đụng vùng này:

1. **Finance Phase 2 export contracts list** → reuse pattern F-031 "2-step Excel Import UX" reverse (export 5-sheet pattern from `pnl-excel.service.ts`)
2. **F-038 perf SLA empirical measurement** — Manager+BA UI walkthrough MUST verify p95 with browser dev tools timing or `curl -w '%{time_total}'`. If breach → loop back Coder
3. **F-038 refactor extract opportunity** — when next feature needs F-028 compute path (e.g., contracts-by-tenant view), trigger TD-F038-REFACTOR-EXTRACT consolidation
4. **F-038 dual-pattern flush** — when adding new `pnl:*` cache key family, add to BOTH `cost-items.service.ts#flushDashboardCache` AND `contracts.service.ts#flushPnlDashboardCache` array. Pattern documented conventions.md Pattern 1
5. **F-038 admin defense-in-depth** — new admin-only pages should follow `useAuth().isAdmin` gate BEFORE client mount pattern (Pattern 3)
6. **F-038 in-memory limit** — if contract count grows >1K → migrate `getContractsList()` to Mongo aggregation pipeline (TD-F038-MONGO-SORT)

---

## 🚦 NOT YET PUSHED — Next steps for Danny

Per memory rule 2026-05-14 anti-cowboy workflow:

1. **Manager + BA empirical UI walkthrough** (Danny mandate from session start) — verify:
   - Login admin → `/finance/contracts` → page renders with header + period filter + margin legend + skeleton then data
   - Table renders 20 rows default sorted `anchorMonth DESC`
   - Click "Margin" column header twice → ASC sort, loss tier rows surface top
   - Click row → navigate `/finance/contracts/{id}` detail
   - Search "Zaha" → debounce 400ms → 2-3 filtered rows + footer "Tổng N HĐ — DT/CP/Lãi/Margin"
   - Period filter switch "YTD" → re-fetch
   - Deep-link `?period=ytd&sortBy=profit&sortDir=desc&page=2` → restore filter
   - Non-admin staff login → `<RestrictedAccess />` rendered, NO fetch fired
   - **Performance SLA empirical:** measure p95 cold + warm via browser dev tools
2. **If walkthrough PASS** → push branch `funny-kirch-90e777` to remote → CI auto-deploy DEV
3. **If DEV smoke OK** → cherry-pick or fast-forward to `release/v1.8.1` (existing release) OR cut new `release/v1.8.2` → CI auto-deploy PROD

**Block conditions to halt deploy:**
- Walkthrough reveals page render bug
- Performance SLA breach (p95 > 500ms cold OR > 100ms warm OR cache hit < 80%)
- Persona journey blocker
- Any new security finding

---

## ✅ Status

🎉 **FEATURE-038 DEPLOYED (workflow gates closed)** — Memory đã sync, 6 files updated. Code complete + tested + QC approved. **Push/deploy PENDING Danny UI walkthrough decision** per session-start directive ("Cuối cùng agent Manager và BA test UI lại").

**Memory sync verification:**
- `feature-log.md`: ✅ shipped row added + INITIATED narrative preserved + DEPLOYED narrative appended
- `change-history.md`: ✅ detailed entry appended at TOP (~150 lines)
- `codebase-map.md`: ✅ finance module description updated with F-038 additions
- `architecture.md`: ✅ FinanceModule entry updated with new controller + cache pattern
- `conventions.md`: ✅ 5 new patterns appended in dedicated section
- `known-issues.md`: ✅ 8 TD-F038-* items appended to Tech debt table

**Workflow lessons reinforced:**
- 5-gate workflow (Init → PRD → Plan → Code → QC → Deploy) executed cleanly end-to-end ONE shot — no loop-back required
- BA naming mismatch (PRD vs codebase) caught by Manager Plan review — pattern: BA should spot-check OR Manager always verify before APPROVE
- Cache flush dual-pattern necessitates regression test assertion update — clearly DOCUMENTED as necessary consequence not creep
- Performance SLA empirical measurement requires walkthrough phase (cannot measure with unit mocks)
- 8 TD documented + tracked in `known-issues.md` for future feature awareness
