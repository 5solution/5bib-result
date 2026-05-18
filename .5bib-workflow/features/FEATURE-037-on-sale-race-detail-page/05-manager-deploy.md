# FEATURE-037 (V2 on-sale-race-detail-page): Deploy & Memory Sync

**Deployed:** 2026-05-18
**Status:** ✅ DONE (code-level approve, post-deploy live verify deferred to release/v1.8.8 + curl checklist)
**Author:** 5bib-manager
**Linked:** 00-manager-init.md → 01-ba-prd.md (READY) → 02-manager-plan.md (APPROVED) → 03-coder-implementation.md (READY_FOR_QC) → 04-qc-report.md (✅ APPROVED WITH CAVEATS)

---

## ⚠️ Number collision note (workflow hygiene)

**F-037 number reused.** Prior F-037 = "DOCX colspan widths + tblLayout fix" (deployed 2026-05-15 via release/v1.8.1, commits 98fc18f→0d93d4b). This F-037 V2 = on-sale-race-detail-page (different feature, same folder slot). Same pattern as F-036 V1 P&L additive + F-036 V2 SEO subdirectory collision documented 2026-05-18.

Resolution: **keep both deployed under F-037** in feature-log, distinguish in title `(V2 on-sale-race-detail-page)`. Counter advances normally (next = FEATURE-043).

**Hardening note for future Manager init:** when /5bib-init runs, MUST grep `feature-log.md` + existing `.5bib-workflow/features/FEATURE-XXX-*` folder names BEFORE assigning new number. Reserve next sequential ID via counter bump immediately on /5bib-init, not at deploy.

---

## 📊 Deploy summary

- **Branch:** `feat/F-037-on-sale-race-detail-page` (worktree `condescending-dewdney-757430`)
- **Commit base:** post-F-036 SEO subdirectory merge (main HEAD)
- **QC verdict:** ✅ APPROVED WITH CAVEATS (4 caveats accepted, all post-deploy verify)
- **Unit tests:** 35/35 PASS (10 new TC-37-XX + 25 F-027/F-033 regression)
- **TypeScript:** `pnpm tsc --noEmit` exit 0 both backend + frontend
- **F-036 regression:** Verified intact via live localhost preview — 73 cards listing, 17 on-sale internal links, 0 forms, 0 onClick purchase
- **Scope Lock match:** 100% (13 files: 9 BE + 4 FE) with 1 documented naming variant (`OnSaleCourseReadonly` to avoid TS identifier collision with existing `RaceCourseReadonly` in race-master-data)

---

## 🔬 Manager Code Review (MANDATE per skill 2026-05-17)

Per skill mandate, Manager performed independent code review of 5 critical files BEFORE memory sync. No rubber-stamp — read code line ranges + verified business logic encoding.

### File 1: `backend/src/modules/promo-hub/promo-hub.service.ts` (lines 730-810 `findRaceOnSaleByUrlName()` + helpers)

**Reviewed:** core service method, Redis cache try/catch, TypeORM QueryBuilder, helper transforms.

**Green points:**
- ✅ Null-injection guards on both `raceReadonlyRepo` + `raceCourseRepo` — graceful null return (TC-37-09 covered)
- ✅ TypeORM QueryBuilder parameterized: `:status`, `:urlName`, `:raceId` — zero raw interpolation, SQL inject defense intact
- ✅ Bit field CAST pattern reuse F-033 lesson: `CAST(is_delete AS UNSIGNED) = 0 AND CAST(is_show AS UNSIGNED) = 1`
- ✅ Numeric regex safe parse: `/^\d+$/.test(urlName) ? urlName : '0'` — prevents NaN injection into `raceId` IN clause
- ✅ Redis try/catch wraps both GET + SETEX — Redis failure won't crash request (graceful degrade per BR-37-19)
- ✅ Cache key prefix `promo-hub:race-on-sale-detail:` + TTL 600s explicit constants

**Minor concerns:**
- 🟡 OR-condition `WHERE (r.url_name = :urlName OR r.race_id = :raceId)` causes MySQL to scan both indexes — acceptable for O(1) detail lookup (LIMIT 1 implicit via getOne()) but Manager track perf SLA TD-F037-QC-04 post-deploy
- 🟡 `toRaceOnSaleDetailDto()` hand-pick field-by-field (not spread `{...race}`) — F-035 lesson hand-pick mapping risk noted. Coder's spec.ts TC-37-10 explicitly asserts all 22 fields mapped, mitigation acceptable.

**Red flags:** none.

**Verdict:** ✅ APPROVED — core method clean, no SQL inject vector, graceful Redis fallback intact.

---

### File 2: `backend/src/modules/promo-hub/promo-hub.controller.ts` (lines 94-128 detail endpoint)

**Reviewed:** route definition, NotFoundException flow, Swagger decorators.

**Green points:**
- ✅ Route literal `'races-on-sale/by-url-name/:urlName'` placed BEFORE catch-all `:id` — F-031 lesson honored (else Nest matches `:id` first)
- ✅ Public endpoint (no `@UseGuards`) matches F-033 list endpoint convention — SEO crawlers need access
- ✅ `@ApiResponse({ status: 200, type: RaceOnSaleDetailDto })` + `@ApiResponse({ status: 404 })` complete
- ✅ NotFoundException with VN message `'Không tìm thấy giải bán vé'` — service returns null → controller throws 404 (not 500)
- ✅ ThrottlerGuard inherited from module level (DoS T9 mitigated)

**Minor concerns:** none material.

**Red flags:** none.

**Verdict:** ✅ APPROVED — endpoint shape correct, public scope justified for SEO use case.

---

### File 3: `backend/src/modules/promo-hub/entities/on-sale-course-readonly.entity.ts`

**Reviewed:** entity definition, column mapping, naming collision resolution.

**Green points:**
- ✅ `@Entity({ name: 'race_course' })` + `export class OnSaleCourseReadonly` — rename from initial `RaceCourseReadonly` documented in file header. TypeORM supports multi-entity-per-table via different class names.
- ✅ 16 cols mapped explicit per BR-37-04 (id, raceId FK, prefix, name, distance, description, price, maxParticipate, min/maxAge, open/closeForSaleDateTime, routeImageUrl, routeMapImageUrl, medalUrl, courseType, gain, deleted Buffer)
- ✅ Bit field `deleted: Buffer` typed correctly (TypeORM driver-level), filter via CAST in service
- ✅ Registered BOTH `forFeature` in promo-hub.module.ts AND `forRoot(entities[])` in app.module.ts per F-033 critical lesson

**Minor concerns:** none.

**Red flags:** none.

**Verdict:** ✅ APPROVED — naming collision resolved cleanly, TypeORM convention honored.

---

### File 4: `frontend/lib/seo-api.ts` (lines 318-355 `getRaceBySlug()` dual-source)

**Reviewed:** dual-source resolution flow, source marker assignment, null cascade.

**Green points:**
- ✅ Step 1 MongoDB-first: tries `${BACKEND_URL}/api/races/slug/${encodeURIComponent(slug)}` → if hit AND status !== 'draft' → returns with `source: 'mongodb'` marker
- ✅ Step 2 MySQL fallback: only on MongoDB miss or draft → tries `getRaceOnSaleByUrlName(slug)` → returns with `source: 'on-sale'` marker
- ✅ Step 3 final null: both miss → returns null → Next.js notFound() triggered (BR-37-16 prevents flicker during transition)
- ✅ `encodeURIComponent` on slug param — XSS via URL injection defense
- ✅ `safeFetch` wrapper handles non-2xx + JSON parse errors gracefully (existing F-027 pattern)

**Minor concerns:**
- 🟡 No explicit log when MongoDB returns draft + falls through to MySQL — could be useful for debugging race transition edge case. Non-blocking, add to TD if pattern recurs.

**Red flags:** none.

**Verdict:** ✅ APPROVED — dual-source pattern correct, MongoDB precedence prevents flicker per BR-37-07.

---

### File 5: `frontend/components/giai-chay/RaceCard.tsx` (lines 105-128, REVERT)

**Reviewed:** revert of on-sale external link branch, verify F-036 regression risk mitigated.

**Green points:**
- ✅ Removed `import { buildSellingWebUrl }` — no longer needed (CTA moved to detail page per BR-37-09)
- ✅ Removed on-sale external `<a href>` branch — ALL sources (mongodb + on-sale) now link internal `<Link href="/giai-chay/${slug}">`
- ✅ Live verified via localhost preview: 17 on-sale cards now render `<Link>` internal (was `<a>` external pre-revert)
- ✅ Empty slug guard `if (!slug) return null` — defensive against malformed data
- ✅ Comment block updated explaining F-037 resolution of TD-F036-09

**Minor concerns:** none material.

**Red flags:** none.

**Verdict:** ✅ APPROVED — revert clean, F-036 regression risk mitigated, TD-F036-09 fully resolved.

---

### Manager Code Review summary

**5/5 files spot-checked: 0 red flags, 3 minor concerns (all tracked as TD or accepted).**

Independent review confirms Coder + QC findings — no rubber-stamp. Manager 2026-05-17 mandate satisfied.

**Cache hooks grep verify:** N/A — F-037 uses TTL-only invalidation (BR-37-19), no mutation site to flush.

**SQL injection grep verify:** searched `${.*}` in QueryBuilder strings → 0 matches. All `:param` placeholders parameterized. ✅ clean.

---

## 📝 Memory diff (applied)

### `feature-log.md`
- ➕ Appended F-037 (V2 on-sale-race-detail-page) ✅ DEPLOYED entry
- ✏️ Counter unchanged (next = FEATURE-043) — F-037 reused number, not advancing

### `change-history.md`
- ➕ Appended detailed entry (13 files, dual-source pattern, OnSaleCourseReadonly naming, F-033 module reg lesson honored)

### `codebase-map.md`
- ✏️ Updated `backend/src/modules/promo-hub/` entry to note F-037 V2 NEW entity (`OnSaleCourseReadonly`) + NEW endpoint (`GET /races-on-sale/by-url-name/:urlName`)
- ✏️ Updated `frontend/lib/seo-api.ts` entry to note dual-source resolution

### `architecture.md`
- ➕ Added dual-source resolution flow section: MongoDB precedence → MySQL on-sale fallback → null cascade

### `conventions.md`
- (No new pattern — TTL-only invalidation + dual-source resolution + entity rename to avoid TS collision are documented in change-history; no convention shift required)

### `known-issues.md`
- ➕ Appended 11 TD-F037-* items (6 Coder + 5 QC-added)
- ✏️ Marked **TD-F036-09 ✅ RESOLVED** (on-sale internal detail page now exists, resolved by F-037 V2)

---

## 🚦 Caveats accepted (post-deploy verify required)

Per QC report, Manager accepts these 4 caveats with explicit follow-up plan:

| # | Caveat | Plan |
|---|--------|------|
| 1 | Live endpoint verification deferred | Post-deploy curl checklist (6 items) on release/v1.8.8 |
| 2 | Frontend XSS sanitization for `race.description` | Verify frontend uses `sanitize-html` like F-027 hub pattern. If missing, file follow-up bugfix in next sprint. |
| 3 | Performance SLA measure deferred | k6/autocannon measure on `/by-url-name/:urlName` post-deploy + add to TD-F037-QC-04 |
| 4 | Phase 6 persona live walkthrough deferred | Manager + Danny walk through 5 personas on `result-fe-dev.5bib.com` after CI deploy |

---

## 🚀 Post-deploy chain

1. ✅ Manager close artifact (this file) — DONE
2. ✅ Memory sync — DONE
3. Push branch `feat/F-037-on-sale-race-detail-page` to remote (Danny action)
4. PR → main → CI auto-deploy DEV `result-dev.5bib.com` + `result-fe-dev.5bib.com`
5. Cherry-pick to `release/v1.8.8` → CI auto-deploy PROD
6. Run 6-item curl checklist (QC Phase 6 follow-up)
7. Verify Vercel rewrite `https://5bib.com/giai-chay/175` returns rich content (F-027 cross-domain)
8. Mark TD-F037-01 RESOLVED post live verify

---

## 🔮 Follow-up for future features touching this area

- **MongoDB → MySQL race transition flow:** when 5BIB ops admin creates MongoDB `races` doc for an on-sale race (race transitions BÁN VÉ → VẬN HÀNH), `getRaceBySlug()` automatically picks MongoDB version next ISR tick (max ~1h delay). Document this in race-master-data sync docs if not already.
- **Sitemap regeneration:** F-037 adds 17 URLs to `sitemap-races.xml`. Verify Google Search Console picks up new URLs within 1 week. If slow, manually submit sitemap.
- **Performance baseline:** record p95 latency on `/by-url-name/:urlName` post-deploy as baseline for future regression check.
- **Number collision hardening:** add `/5bib-init` skill update — counter bump immediately, not at deploy. (See top of this file.)
