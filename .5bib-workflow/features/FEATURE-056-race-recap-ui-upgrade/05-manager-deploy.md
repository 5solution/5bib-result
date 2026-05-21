# FEATURE-056: Deploy & Memory Sync

**Status:** ✅ DONE (Phase 1-4) · ⏸️ Phase 5 HARD-PAUSED
**Deployed:** 2026-05-21
**Author:** 5bib-manager
**Linked:** `00`, `01`, `02`, `03`, `04`, `04b-qc-report-phase4-extension.md`

---

## 📌 Pre-flight check

- [x] `04-qc-report.md` verdict = ✅ APPROVED (initial scope F-056)
- [x] `04b-qc-report-phase4-extension.md` verdict = ✅ APPROVED WITH CAVEATS (Phase 4 scope expansion)
- [x] Unit tests 51/51 pass (race-recap 39 + recap-article-generator 12)
- [x] Frontend TS check exit 0
- [x] Backend TS check exit 0 (no F-056 surface errors)
- [x] Phase 5 hard-pause executed (this doc § "Phase 5 Decision")

---

## 📊 Deploy summary

- **Branch:** `feat/F-056-race-recap-upgrade`
- **Total commits since main:** 16 (full list § "Commit log")
- **Scope shipped:** Phase 1-4 (race recap UI upgrade + auto-articles)
- **Scope paused:** Phase 5 (/runners public discover)
- **QC verdict:** ✅ APPROVED WITH CAVEATS (1 real bug fixed, 4 non-blocker TDs tracked)
- **Awaiting:** Danny approval to merge → main + push remote

---

## ⏸️ Phase 5 Decision (2026-05-21)

### Trigger
Danny + `5bib-biz-strategist` consult identified critical issues with publishing 53,495 athlete aggregate profiles publicly:

1. **PII compliance VN Nghị định 13/2023** — aggregate cross-race profile + searchable directory exceeds athlete's race-day implicit consent scope. Risk: 50-200M VND fine + reputation damage.
2. **Brand risk** — athletes (esp. female VĐV) discovering public profile without opt-in → social media backlash precedent.
3. **Data moat leakage** — 53K profile database trivially scrapable for competitor sales enrichment.
4. **Industry benchmark misalignment** — Strava/Garmin default private, World Athletics elite-only, RaceResult.com per-race only. 5BIB Phase 5 was most aggressive in market.

### Decision: Path 2 — Hard pause /runners listing
- Per-race results `/giai-chay/[slug]/[bib]` remain **public** (industry norm, athlete consent implicit khi đăng ký race)
- Individual `/runners/[slug]` athlete profile pages from **F-047** remain accessible
- ONLY aggregate `/runners` discover index + 4 listing endpoints are hard-paused
- Code preserved in git (commits below) for **F-057** future restore with opt-in consent flow

### Rollback execution
| Layer | File | Change |
|-------|------|--------|
| Frontend | `app/(main)/runners/page.tsx` | Replaced with `notFound()` shell + restore comment |
| Frontend | `components/Header.tsx` | Nav VĐV → `/search` (revert MVP) — `/runners/*` still active via matcher |
| Backend | `race-result.controller.ts` | 4 endpoints (athletes-stats / athletes-spotlight / athletes-featured-90d / athletes listing) throw `NotFoundException` |
| Backend | `athlete-profile.service.ts` | UNCHANGED — service methods preserved (getPublicStats / listPublicAthletes / getSpotlightOfMonth / getFeatured90Days) |
| SEO | `app/robots.ts` | Disallow `/runners$` exact + Allow `/runners/*` (F-047 profile pages remain indexable) |

### Verify post-pause (live)
- `GET /api/race-results/athletes-stats` → **404** ✅
- `GET /api/race-results/athletes-spotlight` → **404** ✅
- `GET /api/race-results/athletes-featured-90d` → **404** ✅
- `GET /api/race-results/athletes?page=1` → **404** ✅
- `GET /api/race-results/athletes/5114-nghiem-thi-anh-thu` → **200** ✅ (F-047 preserved)
- `GET /runners` → **404** ✅
- `GET /runners/[slug]` → 200 (athlete profile F-047)

### Components preserved (not deleted) for F-057
`frontend/components/runners/` — 10 files (1,811 LOC):
- AlphabetJumper.tsx, AthleteCard.tsx, Featured90dCarousel.tsx, FilterSidebar.tsx,
  HeroStatsTiles.tsx, LetterMonogramHeader.tsx, Pagination.tsx, SortDropdown.tsx,
  SpotlightOfMonthCard.tsx, types.ts

These components are CURRENTLY UNUSED but preserved. F-057 will:
1. Add Logto athlete-tier auth (claim profile flow)
2. Strip avatar/gender/province for non-claimed profiles
3. Re-enable backend endpoints
4. Restore frontend `/runners/page.tsx` from git revert of commit `97fd9bf`

---

## 📝 Memory diff (applied to `memory/*`)

### `feature-log.md`
✏️ Append (top of Shipped):
```
| 2026-05-21 | FEATURE-056 | Race recap UI upgrade (Variation A + B) + auto-articles + /runners P5 paused | EXTEND_EXISTING | race-result, runners, frontend hero+nav | 🟡 MED | 16 commits — Phase 5 discover hard-paused pending F-057 consent flow |
```

### `change-history.md`
✏️ Append (top):
```markdown
## 2026-05-21 FEATURE-056: Race Recap UI Upgrade + Phase 5 Hard Pause

**Branch:** feat/F-056-race-recap-upgrade
**Type:** EXTEND_EXISTING (scope expansion 4 phases)

### Phases shipped
- Phase 1: Backend hero winning M/F + elevationGain + finisherDistribution + RecapHeroStatsDto
- Phase 2: Frontend 10 components (SpotlightWinCard, HeroStatTilesRow, HeroPhotoLayer, FinisherDistributionBars, OverallChampionsCard, NegSplitDonutLarge, AGBreakdownTable, EditorialBlock, RecapActionBar, PaceCurveNarrativeBlock)
- Phase 3: Recap page rewrite (hero magazine + body dashboard layout, Variation A + B)
- Phase 4: Auto-articles (6 templates: race-narrative + winner-profile + pacing + course-difficulty + age-group + pace-distribution) with S3 storage (recap-articles/{raceId}/{slug}.md), admin regenerate endpoint
- Phase 5: ⏸️ HARD-PAUSED — /runners public discover (PII compliance + brand risk + moat leakage)

### Files added (Phase 1-4)
- backend/src/modules/race-result/services/recap-article-generator.service.ts (NEW)
- backend/src/modules/race-result/services/recap-article-storage.service.ts (NEW)
- backend/src/modules/race-result/services/recap-article-generator.spec.ts (NEW, 12 TC)
- frontend/components/recap/*.tsx (10 NEW components)
- frontend/components/recap/SpotlightSwitcher.tsx (Spotlight balanced fix)
- frontend/components/recap/RecapStoryCard.tsx (5BIB Stories expandable)
- frontend/app/(main)/recap/page.tsx (NEW index landing)

### Files modified (Phase 1-4)
- backend/src/modules/race-result/dto/race-recap-response.dto.ts (+RecapArticleMetaDto, +RecapCourseDistributionDto, RecapHeroStatsDto expanded)
- backend/src/modules/race-result/services/race-recap.service.ts (assembleArticles + regenerateArticles methods + Optional() decorator for new deps)
- backend/src/modules/race-result/services/athlete-profile.service.ts (data quality filter + 4 new methods for Phase 5 — kept for F-057)
- backend/src/modules/race-result/race-result.controller.ts (recap regenerate endpoint + Phase 5 endpoints now 404)
- backend/src/modules/race-result/utils/race-aggregations.ts (computeCourseDistribution helper)
- backend/src/modules/race-result/race-result.module.ts (register RecapArticleGenerator + Storage)
- frontend/app/(main)/giai-chay/[raceSlug]/recap/page.tsx (major rewrite — hero + 7 sections)
- frontend/components/recap/StickyRecapNav.tsx (course pills clickable scroll)
- frontend/components/Header.tsx (5 nav links; VĐV → /search per Phase 5 pause)
- frontend/locales/vi.json + en.json (+nav.results / nav.athletes / nav.recap keys)
- frontend/lib/hooks/use-athlete-stars.ts (graceful 401/403 fallback)
- frontend/app/globals.css (recap-story-body typography rules)
- frontend/app/robots.ts (Disallow /runners$)

### Files paused (preserved, currently unused — F-057 restore)
- frontend/app/(main)/runners/page.tsx (replaced with notFound shell)
- frontend/components/runners/*.tsx (10 components — alphabet jumper, filter sidebar, athlete card, pagination, sort dropdown, spotlight, carousel)

### Architecture impact
- NEW recap-articles S3 prefix — `recap-articles/{raceId}/{slug}.md` (CLAUDE.md S3 lifecycle rule 7 TBD — TD-F056-CLAUDE-S3-RULE-7)
- /api/race-results endpoint surface expanded by 6 new routes (4 Phase 5 paused → 404, 1 admin regenerate, 1 athletes/:slug unchanged)
- Frontend nav structure: 5 navLinks (was 2)

### Conventions impact
- NEW pattern: `@Optional()` decorator for service DI (NestJS @nestjs/common) — graceful skip when DI provider not registered. Used in RaceRecapService for RecapArticleGenerator + RecapArticleStorage.
- NEW pattern: Frontmatter YAML + markdown body convention for S3 article persistence — see recap-article-storage.service.ts.

### DB / Cache impact
- MongoDB: no schema change (athlete_profiles existing F-047 schema reused)
- Redis: NEW key `recap:race:{raceId}` already in F-046 baseline (unchanged TTL 3600s)
- S3: NEW prefix `recap-articles/` (need CLAUDE.md S3 lifecycle rule 7 — tracked as TD-F056-CLAUDE-S3-RULE-7)

### Tech debt moved to known-issues.md
1. TD-F056-PRD-ADDENDUM (🟡 MED) — BR-56-26..31 implicit, PRD chưa update
2. TD-F056-CLAUDE-S3-RULE-7 (🟢 LOW) — S3 lifecycle rule cho `recap-articles/` prefix chưa add CLAUDE.md
3. TD-F056-STAMPEDE-LOCK (🟢 LOW) — recap-articles cold gen idempotent nhưng wasteful (low-pri)
4. TD-F056-MOBILE-TABLE-OVERFLOW (🟢 LOW) — story body table cần overflow-x-auto wrapper
5. TD-RUNNERS-PRIVACY-CONSENT (🔴 HIGH BLOCKER for F-057) — /runners public discover requires opt-in claim flow before restore
6. TD-ATHLETE-PROFILES-GARBAGE-DELETE (🟢 LOW) — 1,225 garbage profiles in athlete_profiles collection (BIB-as-name, #VALUE!) — backfill cron cleanup
7. TD-AUTH-LOGTO-SCOPE-GRANT (🟡 MED, unrelated) — Logto users without "5BIB Result API" resource scope grant cause 401 on watchlist (graceful fallback shipped, root config needs Logto admin)

### Lessons learned
- **Scope expansion is dangerous without re-planning.** F-056 grew from 16-file Scope Lock → ~40 files across 4 phases + Phase 5 paused. PRD/Manager-plan should track BR-56-26..31 explicitly (TD-F056-PRD-ADDENDUM).
- **Privacy-by-design must be PRD-level concern, not afterthought.** Phase 5 had to be hard-paused because PII implications were not surfaced in original PRD. Future feature touching aggregate athlete data: PRD section 4 (Testing) MUST include privacy compliance audit.
- **Industry benchmarks check before novel UX.** 5BIB Phase 5 went further than Strava/Garmin/RaceResult — biz-strategist consult would've flagged this earlier if invoked during PRD.
- **Optional DI decorator pattern** unlocks gradual feature integration without breaking existing tests (RaceRecapService Phase 4 example).
```

### `codebase-map.md`
✏️ Update module sections:
```diff
 modules/race-result/
   services/
+    recap-article-generator.service.ts    # F-056 P4: 6 article templates auto-gen
+    recap-article-storage.service.ts      # F-056 P4: S3 markdown persistence
     race-recap.service.ts                  # F-056 P1-3: extended hero+distribution+articles
+    recap-article-generator.spec.ts        # F-056 P4: 12 TC

 frontend/app/(main)/
   giai-chay/[raceSlug]/recap/page.tsx     # F-056 P3: major rewrite
+  recap/page.tsx                           # F-056 P3.5: index landing 55 ended races
   runners/page.tsx                         # F-056 P5 PAUSED → notFound() shell
+ frontend/components/recap/
+  SpotlightSwitcher.tsx                    # F-056 P3 spotlight balanced fix
+  SpotlightWinCard.tsx + HeroStatTilesRow.tsx + HeroPhotoLayer.tsx + ...
+  RecapStoryCard.tsx                       # F-056 P4 expandable card
+ frontend/components/runners/              # F-056 P5 PAUSED (preserved for F-057)
+  *.tsx (10 files)
```

### `architecture.md`
✏️ Update Race Result domain:
```diff
  Race Recap flow (F-046 baseline + F-056 extension):
    [Frontend recap page] → GET /api/race-results/recap/:raceId
                              │
                              ▼
                      [RaceRecapService.getRecap()]
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        [Redis cache]    [MongoDB agg]   [S3 articles]
        recap:race:*    race_results      recap-articles/
                              │           {raceId}/{slug}.md
                              ▼               │
                  [computePodium/pace/         ▼
                   negSplit/AGBreakdown/    [RecapArticleGenerator
                   courseDistribution]      → 6 templates auto-gen
                                            → sanitize-html allowlist]
```

### `conventions.md`
✏️ Add new section **"@Optional() decorator for service DI"**:
```markdown
### @Optional() decorator for service DI (F-056 P4 pattern)
Khi cần inject optional dependency vào service mà tests có thể không provide:
- Import `Optional` từ `@nestjs/common`
- Decorate constructor param: `@Optional() private readonly foo?: FooService`
- Graceful handling trong service code: `if (!this.foo) return undefined`
- Allows existing spec.ts (with direct `new Service(model, redis, ...)`) to skip
  providing the new dep without breaking.

Example: RaceRecapService Phase 4 — RecapArticleGenerator + RecapArticleStorage
optional so 39 existing F-046 tests don't need test fixture rewrite.
```

### `known-issues.md`
✏️ Add 6 entries (see "Tech debt moved" list above) — TD-F056-* IDs + TD-RUNNERS-PRIVACY-CONSENT (🔴 HIGH BLOCKER for F-057).

---

## 🔮 Follow-up: F-057 init prerequisites

When Danny ready to restore `/runners` discover (estimate Q3 2026):

1. **Privacy consent flow PRD** must address:
   - Logto athlete-tier signup (lightweight, KHÔNG fork merchant tier)
   - Claim profile UI: athlete searches by BIB → ID-verify → claim
   - Toggle public/private discover status
   - GDPR-style data deletion request flow

2. **Backend changes** (small — endpoints exist, just gate by `profile.publicDiscoverConsent: boolean`):
   - Add `publicDiscoverConsent: Date | null` field on AthleteProfile schema
   - Update `listPublicAthletes` filter: `{ ...quality, publicDiscoverConsent: { $ne: null } }`
   - Re-enable controller endpoints (remove `NotFoundException` throw)

3. **Frontend changes** (already built — just restore page.tsx):
   - Restore `app/(main)/runners/page.tsx` from git revert of commit `97fd9bf`
   - Adjust `AthleteCard.tsx` to strip avatar/gender/province for non-claimed (already null in DB schema if not consented)
   - Header nav VĐV → revert from `/search` back to `/runners`

4. **SEO**: remove `/runners$` disallow from robots.ts, add sitemap-runners.xml only for claimed profiles

5. **Industry benchmark check** with biz-strategist before launch — confirm new opt-in posture comparable to Strava/Garmin defaults.

---

## 📋 Commit log (16 commits)

```
97620c5 fix: course pills clickable — scroll to per-course podium anchor
f5a88b6 fix(F-056): raw raceTitle + course pills + hero stat baseline
7acfec6 feat(F-056): P1 hero winning M/F + elevationGain + finisherDistribution
1f020b3 feat(F-056): P2+P3 Variation A enrich + Variation B body dashboard
8ec3a62 feat(F-056): spotlight balanced — tab switcher + NAM/NỮ equal cards
5f3de77 feat(F-056): expand header nav + /recap index landing page
48f1b1e feat(F-056): P4 backend — auto-generated recap articles with S3 storage
ded92da feat(F-056): P4 frontend — "5BIB Stories" section with expandable cards
6f91f91 fix(F-056): nav active state + /runners VĐV index page + QC sanitize
1bf80d3 fix(athlete-stars): graceful 401/403 fallback to localStorage in hooks
ac341ed feat(F-056): P5 backend — /runners full discover endpoints
97fd9bf feat(F-056): P5 frontend — /runners full discover matching design
a4a785a fix(F-056): data quality filter for /runners athlete listing
[NEW]   fix(F-056): P5 hard-pause /runners + memory sync + robots disallow
```

---

## ✅ Status

🎉 **FEATURE-056 DONE (with Phase 5 pause caveat)** — Memory synced. Branch ready to merge → main + push remote after Danny approval.

**Awaiting Danny:**
- [ ] Approve merge `feat/F-056-race-recap-upgrade` → `main`
- [ ] Approve push to remote
- [ ] Greenlight F-057 timeline (Q3 2026 estimate)
