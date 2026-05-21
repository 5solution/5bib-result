# FEATURE-049 — Implementation Notes (Reviewer's Guide)

> Purpose: cô đọng deviation + tradeoff + review hotspots cho Manager `/5bib-deploy` Code Review + QC adversarial test. Đọc cùng `03-coder-implementation.md` (formal handoff log).

**Author:** 5bib-fullstack-engineer (Claude) — overnight autonomous
**Date:** 2026-05-20 / 2026-05-21 ICT
**Status:** 🟠 READY_FOR_QC

---

## 🚧 Section 1 — Deviations from Spec (intentional)

### Deviation #1 — Tier filter T3 vs T4 cùng map `?source=review_pending`
- **Spec said:** PRD Section 5 + Manager Clarification #2 suggested 4-way tier filter mapping to backend `source` enum.
- **I did:** T1→`email`, T2→`name+dob`, T3→`review_pending`, T4→`review_pending` (same param). Frontend doesn't currently sub-filter by confidence post-fetch.
- **Why:** Backend `?source=X` accepts single value (not OR list). T4 anonymous clusters have `confidence=0` AND `source=review_pending` — same enum as T3 review-queue (confidence 0.6). Adding multi-source backend support is outside Scope Lock. T4 in practice rare (<1% of clusters per F-048 stats).
- **Reviewer should check:** If real data shows T4 cluster needing differentiation in filter, deferred TD-F049-01 → backend extends to comma-list source param.

### Deviation #2 — `primaryEmail` field surfaced in DTO but not yet populated by backend service
- **Spec said:** BR-49-02 OVERRIDE — admin sees full email (no redact). DTO documented `primaryEmail?` field.
- **I did:** Added `@ApiPropertyOptional primaryEmail` in `IdentityClusterListItemDto` for Swagger schema generation, but the service `getCluster()` / `listClusters()` **don't currently populate it** because cluster schema only stores `emailHash` (SHA256), NOT raw email. Frontend ClusterSummaryCard falls back to `nameSlug` or "Hồ sơ ẩn danh" when `primaryEmail` undefined.
- **Why:** Surfacing raw email requires read-time join `race_athletes.email` on `(mysql_race_id, athletes_id)` — material PII access pattern that needs careful security review (audit log, BR-49-15 boundary documentation, race_athletes.email field exists but project pattern uses `.select('+email')` opt-in). I chose to lay foundation (DTO + UI fallback) rather than ship a half-baked PII surface. **TD-F049-05 is the action item.**
- **Reviewer should check:** Manager decide whether to (a) spawn task to wire backend join (preferred per BR-49-02 intent), or (b) revise BR-49-02 to keep email-hash-only display.

### Deviation #3 — Merge dialog uses comma-separated text input (not autocomplete search)
- **Spec said:** PRD Screen 2 UI Step-by-Step describes search autocomplete for merge target ("Tìm hồ sơ target theo email...").
- **I did:** Kept F-048 baseline pattern — single text input accepting comma-separated cluster IDs.
- **Why:** Autocomplete needs new backend search endpoint (`GET /api/admin/identity-clusters/search?q=...`) outside Scope Lock. Existing pattern works for admin who already knows target ID (typical scenario when investigating dupes via list page first).
- **Reviewer should check:** UX iteration v2 candidate — Hằng Sales / Hiền Finance feedback whether comma-separated UUID input is acceptable for daily moderation.

### Deviation #4 — TanStack Query keys for cache invalidation (no api-hooks.ts file)
- **Spec said:** Manager plan Scope Lock listed `admin/src/lib/api-hooks.ts` as EXTEND with `useIdentityClustersList()` + hooks.
- **I did:** `api-hooks.ts` doesn't exist in the codebase (verified via `ls`). F-048 baseline + my rewrites use `useQuery` / `useMutation` directly in page components.
- **Why:** Creating a new `api-hooks.ts` for just 2 endpoints adds an abstraction layer with zero benefit when fetch logic is co-located. Aligns with F-048 baseline pattern (also no api-hooks file).
- **Reviewer should check:** If a future feature ships api-hooks.ts as a project-wide pattern, F-049 should migrate to it. Currently not justified.

---

## ⚙️ Section 2 — Forced Changes (reality ≠ spec)

### Forced #1 — Schema has NO `tier` field — must derive
- **PRD assumed:** BR-49-04 + Section 3.3 DTO described `tier: 'T1'|'T2'|'T3'|'T4'` as a backend field.
- **Reality:** Schema `athlete-identity-cluster.schema.ts` stores `source` enum + `confidence: number` ONLY. Tier is a derived label.
- **Workaround:** Frontend `deriveTier(cluster)` helper in `identity-cluster-labels.ts` maps `(source, confidence)` → T1/T2/T3/T4 per Manager Clarification #1. Backend KHÔNG đổi schema.
- **Manager/BA action:** Update `01-ba-prd.md` to clarify "Tier is derived FE, not stored backend" — future PRD readers avoid same confusion. Also update `.5bib-workflow/memory/codebase-map.md` if exists with cluster schema field list.

### Forced #2 — Backend filter accepts `?source=`, not `?tier=`
- **PRD assumed:** Implicit `?tier=T1` filter in BR-49-11 dropdown spec.
- **Reality:** F-048 controller `listClusters` query param is `?source=email|name+dob|name+gender|manual|review_pending` (matches schema).
- **Workaround:** `TIER_FILTER_OPTIONS` constant in dictionary maps VN tier label → backend source param via `sourceParam` field. UI dropdown text stays VN business language; URL query stays backend-correct.
- **Manager/BA action:** PRD lesson — when documenting filter dropdowns for derived enums, explicitly note the FE→BE mapping. Avoid assuming 1:1.

### Forced #3 — Race title from MongoDB `races` collection, not MySQL platform DB
- **PRD assumed:** BR-49-07 said "backend join `races.title` from `mysql_race_id`".
- **Reality:** MongoDB `races` collection has a `mysql_race_id` field (added by F-048 Phase 1A migration) so the join is intra-MongoDB, not MySQL→MongoDB.
- **Workaround:** `getRaceTitlesByMysqlIds()` uses `raceModel.find({ mysql_race_id: { $in } })` on MongoDB. Correct + simpler than crossing DB boundaries.
- **Manager/BA action:** PRD wording was ambiguous ("via mysql_race_id lookup") — codebase-map.md should explicitly note "Race title source = MongoDB races.title (NOT MySQL platform.races.name)".

### Forced #4 — `admin/src/lib/api-hooks.ts` doesn't exist
- **PRD assumed:** Manager Scope Lock listed `admin/src/lib/api-hooks.ts` as EXTEND.
- **Reality:** File doesn't exist in current admin codebase. Each F-048 baseline page uses TanStack Query directly.
- **Workaround:** Did NOT create the file. Pages use TanStack Query inline (Deviation #4). Total file count stays at 14 (Scope Lock).
- **Manager/BA action:** Either retire the api-hooks.ts pattern from future PRDs, or commit to project-wide rollout in a separate refactor feature.

### Forced #5 — shadcn Badge variants are `green/amber/red/gray`, not `success/warning/destructive` (per PRD)
- **PRD assumed:** PRD Section 3.4 dictionary used `'success' | 'warning' | 'destructive' | 'secondary'`.
- **Reality:** `admin/src/components/ui/badge.tsx` exports variants: `default / secondary / destructive / outline / ghost / link / gray / blue / green / amber / red / violet / dark`. The 6 status pill tones are color names (FEATURE-022 BR-DESIGN-14).
- **Workaround:** Mapped traffic light to color-name variants: ≥0.9 → `green`, 0.6-0.9 → `amber`, 0.1-0.6 → `red`, <0.1 → `gray`. Same semantics, codebase-aligned naming.
- **Manager/BA action:** PRD template — reference actual codebase Badge variants when prescribing colors.

---

## ⚖️ Section 3 — Tradeoffs Considered

| Decision | Option chosen | Alternative | Why chose | Cost paid |
|----------|---------------|-------------|-----------|-----------|
| Service-layer enrichment vs MongoDB `$lookup` | Service-return enrichment | MongoDB aggregation pipeline `$lookup` to races + race_athletes | Easier to apply Redis cache (race title hit ratio >95%). Easier unit-testable. F-048 algorithm logic stays in pure JS, easier to mock. | 2 extra MongoDB queries per page (race title + bib lookups). Mitigated by `$in` batching + Redis cache layer. |
| `@Optional()` DI for Race + Redis | Optional constructor params | Required constructor params + update F-048 spec test to 4-arg | Preserves 20 existing F-048 unit tests untouched. Smaller blast radius. | Slight type-narrowing burden in helper (must check `if (!this.raceModel) return result`). Acceptable. |
| useSyncExternalStore for localStorage | `useSyncExternalStore` with manual `storage` event dispatch | `useState + useEffect` with localStorage read | Compliance with React 19 strict `react-hooks/set-state-in-effect` lint rule. Cleaner SSR/CSR isolation. | Slightly more code (subscribe/snapshot/serverSnapshot triple). Manual `dispatchEvent('storage')` after `setItem` (storage event only fires cross-tab by default — quirky). |
| Dialog reset via `key` remount | `key={String(open)}` causes inner form unmount/remount | `useEffect` to reset state on `open` flip | Avoids `react-hooks/set-state-in-effect` lint. State reset is provably correct (fresh mount = fresh state). | One extra re-render per open/close cycle. Negligible — dialogs aren't render-hot. |
| Raw `fetch()` in pages vs generated SDK | Raw `fetch()` matching F-048 baseline | `pnpm --filter admin generate:api` then use generated SDK functions | SDK regen requires backend up on :8081. Coder running autonomously without backend dev server → would be blocking. Existing F-048 pattern uses raw `fetch()`, consistency. | Manual `interface ClusterDetail` declared inline in 2 page files (~30 lines duplicate). Worth it for autonomous unblock. |
| Lean cluster interface vs Mongoose HydratedDocument | Custom `LeanClusterForEnrichment` interface | `HydratedDocument<AthleteIdentityCluster>` | `.lean()` strips Mongoose Document shape → forcing `as unknown as` cast. Custom interface matches actual lean shape, zero casts. | Maintenance: if schema gets new field, interface needs same addition. Currently small surface (12 fields) — acceptable. |
| Hand-pick mapping audit | Spread pattern `{...c, linkedAthleteRecords: ...}` | Hand-pick `clusterId: c.clusterId, source: c.source, ...` | F-035 cost-drop bug avoidance — spread preserves all fields including ones added later. | Spread carries Mongo `_id` / `__v` through (controllers strip later, or DTO `@ApiProperty` whitelist). Marginal risk acceptable. |
| MongoDB `$or` query grouped by race | Group athletes_ids by mysql_race_id → 1 `$or` clause per race | Single `{mysql_race_id: {$in}, athletes_id: {$in}}` flat query | Flat query would over-match (race A's athletes + race B's athletes interleaved). Grouped `$or` is precise. | Slightly larger query payload (N `$or` clauses for N races). Mitigated by typical small N (5-10 races per page). |

---

## 🔬 Section 4 — Reviewer Notes (Manager + QC focus)

### Files to review priority order

1. **`backend/.../athlete-identity-clustering.service.ts:419-630`** — F-049 enrichment helpers `enrichClustersWithRaceContext` + `getRaceTitlesByMysqlIds` + `getBibsByCompositeKeys`. **Critical:** N+1 prevention + Redis fallback path. Read TC-49-08 first to understand the contract.
2. **`backend/.../identity-cluster-admin.controller.ts:75-174`** — F-049 DTO additions. Confirm `@ApiPropertyOptional` decorators present + optional fields don't break SDK consumer expectations.
3. **`admin/.../page.tsx` (list)** — Top-level page logic. Check `tierFilterToSourceParam` mapping correctness + TanStack Query key shape for cache hit/miss + pagination edge case.
4. **`admin/.../[clusterId]/page.tsx` (detail)** — Mutation invalidation logic (`queryClient.invalidateQueries({queryKey: ['identity-clusters']})` + `['identity-cluster', clusterId]`).
5. **`admin/src/lib/identity-cluster-labels.ts:34-49`** — `deriveTier()` helper. Critical for the entire UI tier rendering — verify branching matches Manager Clarification #1.

### Concurrency hotspots

- `backend/.../athlete-identity-clustering.service.ts:535-580` (Redis `mget` + write-back loop) — multiple concurrent admin sessions running same query would all execute Mongo fallback if Redis was just flushed. Mitigated by: short Mongo query (`.select('mysql_race_id title')`) + Redis SETEX after — second concurrent caller benefits from cache. NO SETNX anti-stampede lock (acceptable for read-only enrichment cache, low CPU cost).
- `admin/.../[clusterId]/page.tsx:142-160` — Inline single-record split via `handleSingleRecordSplit` uses `mutateAsync` with auto-generated reason. If admin clicks two different rows fast, both fire serially (TanStack mutex via `useMutation`); could be racy but server-side `splitCluster` has no atomic guarantee — outside F-049 scope (F-048 owns split logic).

### Edge cases tested vs deferred

- ✅ Tested: race not found / Redis down / empty input / N+1 prevention / cache hit / orphan filter / case-insensitive search regex / N+1 multi-record
- ⚠️ Deferred:
  - Concurrent merge+split from two admins (F-048 baseline doesn't have lock — out of F-049 scope)
  - Frontend E2E (per Manager plan — QC Phase 6 walkthrough)
  - Performance load test 100 concurrent admin requests (acceptable for v1 — admin endpoint low traffic)
  - Email-full-display when backend doesn't populate `primaryEmail` yet → graceful fallback to nameSlug (intentional, TD-F049-05)

### Type safety narrowed casts

- `backend/.../athlete-identity-clustering.service.ts:475` — `.lean<LeanClusterForEnrichment[]>()` generic narrowing — type-safe (Mongoose `lean<T>()` is the recommended pattern). Zero `as unknown as`.
- `backend/.../athlete-identity-clustering.service.ts:485` — `.lean<LeanClusterForEnrichment>()` same pattern for `getCluster` single document.

### Security checklist self-applied

- [x] All admin endpoints stay protected by `LogtoAdminGuard` (unchanged from F-048 — class-level decorator on controller).
- [x] PII boundary maintained: `emailLogProxy()` still emits `[emailHash:abc12345]` in logger output. F-049 does NOT log raw email anywhere (greppable via `grep "logger\.\(log\|warn\)" backend/src/modules/race-master-data/services/athlete-identity-clustering.service.ts | grep email` → only emailLogProxy calls).
- [x] Cache key `races:title:byMysqlId:${id}` uses parseInt'd Number primitive (no string injection risk).
- [x] Search regex uses raw `opts.q` string — F-048 already passes this to `$regex`. F-049 untouched (out of scope per controller existing behavior). Manager note: F-048 should consider `escapeRegExp` defense against ReDoS but that's F-048's debt, not F-049.
- [x] `navigator.clipboard.writeText` HTTPS-only (no document.execCommand fallback per BR-49-18 — explicit security choice).
- [x] No new public endpoints (admin-only via guard).
- [x] CORS / CSRF: same as F-048 (credentials: 'include' to same-origin).

### Performance numbers (estimated — no live measurement)

- TC-49-08 asserts 1 raceModel.find + 1 athleteModel.find per 100-cluster page → O(1) DB calls per request regardless of cluster count.
- Estimate p95 cold cache: ~120-180ms (1 cluster find + 1 race find + 1 athlete find, all $in-indexed).
- Estimate p95 warm cache: ~50-80ms (1 cluster find + 1 Redis mget + 1 athlete find).
- Cache hit ratio after 1h steady state: >95% (race title rarely changes).
- Real measurement deferred to QC load-test phase.

### Recommended QC adversarial tests

1. **TC-49-03 reproduction in PROD-like data:** Create cluster manually with `linkedAthleteRecords[0].mysql_race_id = 99999` (non-existent race). Verify list page renders without 500 — should show "—" for race name on that record.
2. **Race title cache invalidation (NONE):** Edit a race title in admin, wait <1h, refresh identity-clusters list → should still show old title (acceptable per BR-49-14 "1h staleness acceptable"). Beyond 1h → refreshes automatically.
3. **Tech-mode toggle persistence:** Toggle ON, navigate to another admin page, come back → should STILL be ON (localStorage). Open new tab on same domain → should be ON (shared localStorage).
4. **Tier filter T3 fetch:** Select "Cần xem xét (T3)" → URL adds `?source=review_pending` → backend returns clusters with that source enum → frontend tier badges show T3 (red). Cross-check with `deriveTier()` output for at least 3 sample clusters.
5. **Split-all guard:** Open Split dialog on cluster with 3 records → check all 3 → "Xác nhận phân tách" stays disabled, inline error visible.
6. **Self-merge guard:** Open Merge dialog → paste OWN cluster ID into the text input → "Xác nhận hợp nhất" → expect inline error `"Không thể hợp nhất với chính nó"`.
7. **VN long race name truncation:** Sample race title `"Vietnam Mountain Marathon Mu Cang Chai 2026 - Ultra 100K Mountain Edition"` (>40 chars) → list/detail show truncated with `…` + hover tooltip = full text.
8. **Toast i18n:** Trigger split success → toast text `"Đã phân tách hồ sơ thành công"` (Vietnamese, NOT English fallback).

---

## 📎 Quick-reference paths

- Plan: `02-manager-plan.md` (same folder)
- PRD: `01-ba-prd.md` (same folder)
- Init: `00-manager-init.md` (same folder)
- Formal handoff: `03-coder-implementation.md` (same folder)
- Redis Keys Registry update: `CLAUDE.md` row 174 (`races:title:byMysqlId:<mysql_race_id>` 3600s)
- Backend service: `/Users/dannynguyen/Desktop/Claude/5bib-result/backend/src/modules/race-master-data/services/athlete-identity-clustering.service.ts`
- Backend controller: `/Users/dannynguyen/Desktop/Claude/5bib-result/backend/src/modules/race-master-data/controllers/identity-cluster-admin.controller.ts`
- Backend spec: `/Users/dannynguyen/Desktop/Claude/5bib-result/backend/src/modules/race-master-data/services/athlete-identity-clustering.service.spec.ts`
- Admin dictionary: `/Users/dannynguyen/Desktop/Claude/5bib-result/admin/src/lib/identity-cluster-labels.ts`
- Admin components: `/Users/dannynguyen/Desktop/Claude/5bib-result/admin/src/components/identity-clusters/` (7 files)
- Admin pages: `/Users/dannynguyen/Desktop/Claude/5bib-result/admin/src/app/(dashboard)/athletes/identity-clusters/{page.tsx,[clusterId]/page.tsx}`
