# FEATURE-049: Manager Plan Review

**Reviewed:** 2026-05-21 00:05 ICT
**Reviewer:** 5bib-manager
**Verdict:** ✅ **APPROVED**

---

## ✅ Pre-flight + Spot-check (Manager mandate 2026-05-17)

- [x] Read `00-manager-init.md` (8 PAUSE confirmed)
- [x] Read `01-ba-prd.md` (20 BR-49 + 5 mandatory tables + 10 TC-49 + 12 E2E-49)
- [x] Spot-checked actual codebase files referenced in PRD:
  - ✅ `backend/src/modules/race-master-data/controllers/identity-cluster-admin.controller.ts` exists (URL is `/admin/athletes/identity-clusters` — minor PRD URL drift, Coder uses actual)
  - ✅ `backend/src/modules/race-master-data/services/athlete-identity-clustering.service.ts` exists with `getCluster()` + `listClusters()` methods
  - ✅ `backend/src/modules/race-master-data/schemas/athlete-identity-cluster.schema.ts` exists with fields `confidence: number` + `source: 'email'|'name+dob'|'name+gender'|'manual'|'review_pending'` + `linkedAthleteRecords[]`
  - ✅ `admin/src/app/(dashboard)/athletes/identity-clusters/page.tsx` exists (F-048 baseline)
  - ✅ `admin/src/app/(dashboard)/athletes/identity-clusters/[clusterId]/page.tsx` exists (F-048 baseline)
  - ✅ `admin/src/lib/finance-labels.ts` exists (dictionary pattern reference)
  - ✅ `admin/src/components/ui/badge.tsx` shadcn Badge (variant prop available)

---

## ⚠️ Critical Clarifications cho Coder

### Clarification #1 — Field naming reality vs PRD "tier"

PRD section "BR-49-04 Tier code → VN label" reference `tier: 'T1'|'T2'|'T3'|'T4'` enum. **Actual schema:**

```typescript
{
  confidence: number,  // 0.0 - 1.0
  source: 'email' | 'name+dob' | 'name+gender' | 'manual' | 'review_pending',
  // NO 'tier' field
}
```

**Tier is DERIVED, not stored.** Coder MUST create helper `deriveTier(cluster)` trong `identity-cluster-labels.ts`:

```typescript
export type Tier = 'T1' | 'T2' | 'T3' | 'T4';

export const deriveTier = (cluster: { source: string; confidence: number; linkedAthleteRecords?: unknown[] }): Tier => {
  if (cluster.source === 'email' || cluster.confidence >= 0.9) return 'T1';
  if (cluster.source === 'name+dob' || cluster.confidence >= 0.8) return 'T2';
  if (cluster.source === 'name+gender' || cluster.source === 'review_pending') return 'T3';
  return 'T4'; // anonymous single-race (rarely persisted as cluster)
};
```

### Clarification #2 — Backend filter query param "source" not "tier"

F-048 controller accepts `?source=email|name+dob|name+gender|manual|review_pending` (NOT `?tier=T1|T2|T3|T4`).

**Decision:** Frontend filter dropdown labels VN ("Tin cậy cao" / "Trung bình" / "Cần xem xét"), value internally maps to `source` enum:
- "Tin cậy cao (T1)" → `?source=email`
- "Trung bình (T2)" → `?source=name+dob`
- "Cần xem xét (T3)" → `?source=name+gender&source=review_pending` (OR pattern — Coder may need backend extend to support multi-source, OR client-side filter post-fetch)

**Coder decision space:** if backend OR pattern complex → frontend fetches WITHOUT source filter + client-side groups by tier. Acceptable given small page size (20 records).

### Clarification #3 — Race name lookup performance pattern

PRD BR-49-13 + BR-49-14 specify `$in` aggregation single query. **Implementation:**

```typescript
// In athlete-identity-clustering.service.ts
async enrichClustersWithRaceContext(clusters: Cluster[]): Promise<Cluster[]> {
  const allMysqlRaceIds = [...new Set(clusters.flatMap(c =>
    c.linkedAthleteRecords.map(r => r.mysql_race_id)
  ))];

  // Single $in query với Redis cache layer
  const raceTitleMap = await this.getRaceTitlesByMysqlIds(allMysqlRaceIds);

  // Bib lookup via race_athletes — single aggregation pipeline grouped by (mysql_race_id, athletes_id)
  const bibMap = await this.getBibsByCompositeKeys(
    clusters.flatMap(c => c.linkedAthleteRecords.map(r => ({
      mysql_race_id: r.mysql_race_id,
      athletes_id: r.athletes_id,
    })))
  );

  return clusters.map(c => ({
    ...c,
    linkedAthleteRecords: c.linkedAthleteRecords.map(r => ({
      ...r,
      raceName: raceTitleMap.get(r.mysql_race_id),
      bibNumber: bibMap.get(`${r.mysql_race_id}:${r.athletes_id}`),
    })),
  }));
}
```

### Clarification #4 — Email FULL display defense-in-depth

BR-49-02 OVERRIDE = admin sees raw email. **Backend response DTO MUST explicitly include `primaryEmail` field WITHOUT redaction.** Verify by spot-check:
- Cluster service `getCluster()` returns full `primaryEmail` from MongoDB
- Controller does NOT strip email
- Frontend renders `cluster.primaryEmail` directly (no client-side redact)

**Audit checklist:** Manager Code Review post-implementation MUST grep `primaryEmail` in cluster service + controller to verify NO sanitization applied (since intentional for admin UI).

### Clarification #5 — F-048 navigation URL drift

PRD section 3.2 wrote `/api/admin/identity-clusters` but actual mount is `/api/admin/athletes/identity-clusters`. Coder uses ACTUAL backend URL from F-048 controller. Frontend route path is `/athletes/identity-clusters` (admin Next.js) which matches.

---

## ✓ PRD Validation Checklist

- [x] User Stories đầy đủ — 5 US covering 2 personas (BO Admin primary + Engineer secondary)
- [x] Business Rules testable — 20 BR-49-XX, mỗi BR có TC reference
- [x] UI states đầy đủ — list page 6 states (loading/empty/data/filtered-empty/error/search-debounce) + detail page 5 states
- [x] Data source mỗi field rõ ràng — 2 field source tables (Screen 1 + Screen 2)
- [x] DB change flagged — ZERO schema migration, ZERO new dep (BR-49-16 backward compat)
- [x] API contract — additive optional fields only (`raceName?`, `bibNumber?`)
- [x] PERFORMANCE SLA cụ thể — p95 400ms cold / 80ms warm + N+1 prevention TC-49-08 explicit
- [x] Security boundary — `LogtoAdminGuard` confirmed F-048 baseline + BR-49-02 PII override documented
- [x] PRD 5 mandatory tables present:
  - ✅ UI Step-by-Step (10+12 steps)
  - ✅ Buttons Specification (8+9 buttons)
  - ✅ Form Fields Specification (5+ fields incl. dialog forms)
  - ✅ Backend Endpoint Specification (2 endpoints extended)
  - ✅ Test Cases TC-49 (10 backend + 12 E2E)

---

## 📋 Files được phép thay đổi (Scope Lock)

**Coder CHỈ được thay đổi các file dưới đây. Ngoài scope = phải hỏi Manager.**

### Backend (3 files)

| File | Action | Scope |
|------|--------|-------|
| `backend/src/modules/race-master-data/controllers/identity-cluster-admin.controller.ts` | EXTEND response DTO | Add raceName + bibNumber per linkedAthleteRecord. Document via `@ApiPropertyOptional`. |
| `backend/src/modules/race-master-data/services/athlete-identity-clustering.service.ts` | EXTEND service | Add private `enrichClustersWithRaceContext()` + `getRaceTitlesByMysqlIds()` + `getBibsByCompositeKeys()` helpers. Wire into existing `listClusters()` + `getCluster()` return path. |
| `backend/src/modules/race-master-data/services/athlete-identity-clustering.service.spec.ts` | EXTEND tests | Add TC-49-01 ÷ TC-49-10 backend unit tests. |

### Backend (Service helper — optional NEW DTO file if Coder prefers)

| File | Action | Scope |
|------|--------|-------|
| `backend/src/modules/race-master-data/dto/identity-cluster-enriched.dto.ts` | CREATE (optional) | If Coder wants explicit DTO class separate from inline `@ApiPropertyOptional`. |

### Admin (10 files)

| File | Action | Scope |
|------|--------|-------|
| `admin/src/lib/identity-cluster-labels.ts` | CREATE | TIER_LABEL + TIER_SHORT_LABEL + CONFIDENCE_VARIANT + CONFIDENCE_LABEL + STATUS_LABEL + ACTION_LABEL + deriveTier helper |
| `admin/src/app/(dashboard)/athletes/identity-clusters/page.tsx` | REWRITE | List page with 6-col table + filter bar + 4 KPI cards + tech-mode toggle |
| `admin/src/app/(dashboard)/athletes/identity-clusters/[clusterId]/page.tsx` | REWRITE | Detail page với summary card + linked records table + merge/split dialogs |
| `admin/src/components/identity-clusters/IdentityClusterTable.tsx` | CREATE | Extracted table component |
| `admin/src/components/identity-clusters/ClusterSummaryCard.tsx` | CREATE | Detail header summary card |
| `admin/src/components/identity-clusters/LinkedRecordsTable.tsx` | CREATE | Records table with race name + bib |
| `admin/src/components/identity-clusters/MergeClusterDialog.tsx` | CREATE | Merge dialog with target search |
| `admin/src/components/identity-clusters/SplitClusterDialog.tsx` | CREATE | Split dialog with record checkboxes |
| `admin/src/components/identity-clusters/TechModeToggle.tsx` | CREATE | Toggle + localStorage hook |
| `admin/src/components/identity-clusters/CopyClusterIdButton.tsx` | CREATE | Copy icon + toast |

### Admin SDK regen (auto-generated, MUST run command)

| File | Action |
|------|--------|
| `admin/src/lib/api-generated/**` | REGEN via `pnpm --filter admin generate:api` |
| `admin/src/lib/api-hooks.ts` | EXTEND with `useIdentityClustersList()` + `useIdentityClusterDetail(id)` + mutations |

### CLAUDE.md update (Redis Keys Registry)

| File | Action |
|------|--------|
| `CLAUDE.md` | APPEND row in Redis Keys Registry: `races:title:byMysqlId:<mysql_race_id>` TTL 3600s |

**Total scope:** 14 source files (3 backend + 10 admin + 1 docs) + SDK auto-regen. Outside scope = scope creep, MUST ask.

---

## 🔧 Tech approach (Coder may tinh chỉnh)

### Backend strategy

1. **Service helper pattern reuse** — clone F-040 fee.service `getFeeForContractsBulk()` `$in` aggregation pattern:
   ```typescript
   // F-040 precedent: getFeeForContractsBulk uses $in MySQL query with Redis cache layer
   ```

2. **Redis cache pattern** — clone F-046 cache utility wrappers:
   - Key: `races:title:byMysqlId:<id>`
   - Try/catch Redis fail → fallback MongoDB query
   - SETNX anti-stampede không cần (high cache hit, low CPU)

3. **DTO extend pattern** — add `@ApiPropertyOptional` decorator to existing DTO class, not new class. Generated SDK picks up optional field gracefully.

### Frontend strategy

1. **Component extraction first** — extract existing F-048 page logic into smaller components, THEN apply label dictionary. Reduces risk of breaking F-048 baseline behavior.

2. **TanStack Query keys** — preserve existing F-048 query keys to leverage cache. Add `select` transform to apply derived `tier` + `tierLabel` from `source` + `confidence` at hook layer.

3. **shadcn Badge variants** — use existing `success` / `warning` / `destructive` variants (already in F-038/F-040 codebase). Check `admin/src/components/ui/badge.tsx` for available variant types.

4. **localStorage tech-mode** — use existing `useLocalStorage` hook if available, else simple `useState` + `useEffect` sync.

---

## 🛑 PAUSE points cho Coder

- 🛑 Nếu backend `enrichClustersWithRaceContext()` cần thay đổi schema `athlete_identity_clusters` → DỪNG, hỏi Manager. (Expected: zero schema change, enrichment at service-return layer only.)
- 🛑 Nếu Redis Keys Registry conflict với existing key → DỪNG, hỏi.
- 🛑 Nếu phát hiện F-048 baseline test (62/62) fail post-DTO-extend → DỪNG, Manager investigate trước khi proceed.
- 🛑 Nếu `pnpm --filter admin generate:api` fail → DỪNG, Manager + Coder debug Swagger schema.
- 🛑 Nếu admin localStorage tech-mode toggle gây hydration mismatch (Next.js 16 SSR) → DỪNG, switch to client-only mount.

---

## 🧪 Unit test bắt buộc

Coder phải viết unit test cho:

### Backend (10 TC-49 tests in `athlete-identity-clustering.service.spec.ts`)

- [x] TC-49-01 Happy path list with raceName/bibNumber enriched
- [x] TC-49-02 Happy path detail with linked records enriched
- [x] TC-49-03 Race not found graceful (no throw, raceName=undefined)
- [x] TC-49-04 Race name cache hit (Redis pre-seed → MongoDB query NOT called)
- [x] TC-49-05 Auth missing 401 (delegate to existing F-048 controller test)
- [x] TC-49-06 Non-admin 403 (delegate to existing F-048 controller test)
- [x] TC-49-07 Invalid UUID 400 (delegate to existing F-048 controller validation)
- [x] TC-49-08 N+1 query prevention — `findMany()` called exactly 1 time per page (mock spy)
- [x] TC-49-09 Tier filter — source=email returns only T1
- [x] TC-49-10 Search by email substring (case-insensitive regex)

### Admin (smoke tests acceptable — full E2E deferred to QC Phase 6 walkthrough)

- [x] `identity-cluster-labels.spec.ts` — unit test deriveTier() helper với 4 tier combinations
- [x] `IdentityClusterTable.test.tsx` (optional) — render with mock cluster data, verify VN labels

### Self-Review Pipeline (10 bước Manager 2026-05-14 directive)

Coder MUST run + paste output to `03-coder-implementation.md`:

1. `pnpm tsc --noEmit` exit 0 (backend + admin)
2. PRD strict adherence audit (5 tables matched)
3. Anti-pattern scan: no `console.log`, no `any`, no `as unknown as`
4. Hand-pick field mapping audit: grep `.map((r) =>` for race name + bibNumber field preservation
5. PROD-readiness smoke: backend start clean + admin start clean + curl `/api/admin/athletes/identity-clusters` 401 unauth + 200 admin
6. UI/UX self-inspection: 10 items (dialog width / table truncate / sticky / VN labels / empty / loading / error / success / validation / picker collapse N/A)
7. Real-world data sanity: VN long race name "Vietnam Mountain Marathon Mu Cang Chai 2026" (>40 char trigger truncate + tooltip)
8. Files Changed vs Scope Lock — 14 source files
9. Generated SDK regen success
10. Unit tests PASS output paste

---

## 🎯 Performance Acceptance Criteria

- TC-49-08 explicit assertion `findMany()` called exactly 1 time per page (NOT N+1)
- p95 GET list <400ms cold / <80ms warm (Coder measure post-implementation, paste to file 03)
- p95 GET detail <200ms warm
- Frontend list TTI <1.5s on 4G simulated (Coder measure via Chrome DevTools throttling)

---

## ✅ Sẵn sàng cho /5bib-code

**Verdict: APPROVED.** Coder unblocked.

Pre-flight gate cho Coder:
- [x] Plan APPROVED status confirmed
- [x] Scope Lock 14 files documented
- [x] 5 critical clarifications resolved
- [x] PAUSE points documented
- [x] Tech approach with precedent references (F-040 + F-046 + F-038 patterns)
- [x] Unit test list explicit (10 backend + 1 helper unit + 1 component optional)
- [x] Self-Review Pipeline 10 bước MANDATORY before Coder marks READY_FOR_QC

**Manager note:** Coder may parallelize backend (3 files) + admin (10 files) work. Backend critical path because admin depends on regenerated SDK types post-DTO-extend.

Recommended Coder sequence:
1. Backend DTO extend (controller + spec) — 30 min
2. Backend service helpers (`enrichClustersWithRaceContext` + race title cache + bib lookup) — 60 min
3. `pnpm --filter admin generate:api` — 5 min
4. Admin `identity-cluster-labels.ts` dictionary — 15 min
5. Admin component extract + REWRITE list page — 60 min
6. Admin component extract + REWRITE detail page — 60 min
7. Admin merge/split dialogs + tech-mode toggle + copy button — 60 min
8. Self-Review Pipeline 10 bước — 30 min

**Total ETA: ~4-5h Coder work.**
