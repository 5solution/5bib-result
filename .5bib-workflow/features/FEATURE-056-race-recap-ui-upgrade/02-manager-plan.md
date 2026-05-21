# FEATURE-056: Manager Plan Review

**Status:** ✅ **APPROVED with 3 Critical Clarifications**
**Reviewed:** 2026-05-21
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## ✅ Pre-flight Gate Check

- [x] Read `00-manager-init.md` (8 PAUSE confirmed)
- [x] Read `01-ba-prd.md` (25 BR + 53-row Field Source Table + 14 TC + 10 E2E)
- [x] Read `memory/codebase-map.md` race-result module structure
- [x] Read `memory/conventions.md` NestJS DI + Mongoose + Display Convention
- [x] Read `memory/known-issues.md` F-046 status
- [x] Spot-checked actual code references trong PRD (results below)

---

## 🔬 Manager Spot-Check Findings (MANDATORY per 2026-05-17 directive)

### Verified ✅

| PRD reference | Verified in code |
|---------------|-------------------|
| `race_results.chiptimes` JSON field | ✅ exists `race-result.schema.ts:68` |
| `race_results.nationality` | ✅ exists `race-result.schema.ts:58` |
| `race_results.genderRank` + `genderRankNumeric` | ✅ exist (lines 45-46) |
| F-046 cache key prefix `recap:race:` | ✅ matches `RECAP_PREFIX` (race-recap.service.ts:105) |
| F-046 `RaceRecapInsight` schema | ✅ exists |
| F-050 `classifyRaceType()` helper | ✅ exists, can port to frontend |

### ⚠️ CRITICAL CLARIFICATIONS (Coder MUST handle)

#### Clarification #1 — Wrong schema reference: `race_athletes.nationality` DOES NOT EXIST

**BA wrote (BR-56-04 + Field Source Table row 20):**
> City derivation chain: (1) `race_athletes.nationality` if non-empty...

**Reality (verified spot-check):**
- `race_athletes` schema has fields: `bib_number, name, gender, club, ... etc.` — NO `nationality` field
- Field actually exists in **`race_results.nationality`** (different collection)

**Corrected derivation chain for Coder:**
```typescript
// Per podium athlete (race_result row):
const city =
  normalizeCity(row.nationality) ??           // 1st: race_results.nationality (vendor field)
  extractCityFromClub(row.club) ??            // 2nd: race_results.club regex
  await raceAthleteSubinfo(row.bib).club ??   // 3rd: race_athletes.subinfo.club join
  null;                                        // hide chip
```

Plus need `normalizeCity()` helper — reuse logic from F-050 `canonicalizeProvince()` (`backend/src/common/utils/province-normalize.ts`) for "Hà Nội" / "TP Hà Nội" / "Tỉnh Hà Nội" dedup.

#### Clarification #2 — F-046 endpoint NEVER WIRED to controller (latent bug)

**Discovery:** Frontend recap page calls `/api/race-results/recap/:raceId` + `/api/race-results/recap/:raceId/insight`. NO controller exposes these routes. F-046 service + DTO + schema all built — but public REST endpoint missing. **Same Phase 1C wiring gap as F-047 athlete-profile bug fixed earlier today (commit `<wire-bypass>`).**

**Impact:** F-046 recap page currently 404s in production (silently). My earlier audit may have missed this because dev DB test races don't have `race_recap_insights` populated.

**Action for F-056 Scope:**
- ADD endpoint wiring to `race-result.controller.ts`:
  - `@Get('recap/:raceId')` → RaceRecapService.getRecap()
  - `@Get('recap/:raceId/insight')` → RaceRecapService.getInsight()
- Reuse existing `OptionalLogtoAuthGuard` pattern
- Add to BR-56-26 (NEW) — endpoint wiring is part of F-056 scope, not separate feature

#### Clarification #3 — `negativeSplits[0].interpretation` field doesn't exist in current F-046

**BA wrote (Field Source row 34):**
> NegSplit headline H3 ← `negativeSplits[0].interpretation` (existing F-046 field — backend computes Vietnamese narrative based on percent)

**Reality:** F-046 RaceRecapResponseDto has no `negativeSplits` field at all (negSplit is GAP #2 in init). BA contradicted itself — claims field is "existing" but it's NEW per BR-56-09.

**Corrected:** `interpretation` is NEW field in NEW `RecapNegSplitDto`. Backend MUST compute Vietnamese narrative based on percentage thresholds (e.g., "<20%": "Race kỹ thuật cao", "20-40%": "Bình thường", ">40%": "Race dễ pacing").

Add to Coder spec.

---

## ✓ PRD Validation Checklist

### Completeness
- [x] User Stories đầy đủ (10 stories, 4 personas)
- [x] BR-56-XX có ID (25 BR)
- [x] Tất cả 8 PAUSE-56 đã được trả lời + mapped to implementing BR
- [x] **53-row Field Source Table** đáp ứng câu hỏi Danny "lấy data từ trang kết quả giải chạy"

### Technical correctness
- [x] Cache key pattern khớp existing F-046 (`recap:race:<raceId>`)
- [x] Server Component SSR (preserve F-051 JSON-LD)
- [x] Sticky nav client island isolated
- [x] RaceAggregationHelpers extraction strategy clear
- [x] All new DTO fields `@ApiPropertyOptional` (backward compat)
- ⚠️ City derivation field reference wrong (Clarification #1)
- ⚠️ F-046 endpoint missing — must add to scope (Clarification #2)
- ⚠️ negativeSplits.interpretation marked "existing" but is NEW (Clarification #3)

### Security
- [x] Public endpoint NO auth required (matches F-046)
- [x] PII strip preserved (no email/phone/DOB)
- [x] Markdown sanitize-html on spotlightStories (XSS protection)

### Performance
- [x] SLA cụ thể: p95 < 800ms cold / <100ms warm
- [x] Cache strategy: Redis 1h + SETNX anti-stampede
- [x] negSplit lazy-compute first request

### Testability
- [x] 14 TC-56-XX backend cases
- [x] 10 E2E Playwright
- [x] Stability 10x concurrent
- [x] Data integrity sample races identified (3 races test)

---

## 📊 Cross-check với memory

### Architecture impact
- F-046 stays in `race-result` module (no new module)
- NEW utils file `race-aggregations.ts` shared helpers (modest refactor)
- `race_recap_insights` collection schema extended (spotlightStories optional field)
- Architecture diagram: no major change, just add helper layer

### Convention impact
- 5BIB Velocity tokens (already aligned with design `tokens.css`)
- Display Convention (VN labels everywhere, no raw enum)
- Mongoose schema additive field pattern
- Pure-function helper extraction = NEW pattern → conventions.md update post-deploy

### Known issues impact
- F-046 endpoint missing (Clarification #2) = previously-unknown latent bug → resolve in this feature scope
- F-049/F-050 patterns reused (canonicalizeProvince + classifyRaceType)
- No conflict with in-flight features

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ được thay đổi các file/folder sau. Đụng ngoài = scope creep.

### Backend — 9 files (3 NEW + 6 modify)

**NEW:**
- ➕ `backend/src/modules/race-result/utils/race-aggregations.ts` — 5 pure functions (BR-56-18)
- ➕ `backend/src/modules/race-result/utils/race-aggregations.spec.ts` — unit tests
- ➕ `backend/src/modules/race-result/utils/city-derive.ts` — city derivation chain helper (Clarification #1) — reuses canonicalizeProvince

**MODIFY:**
- ✏️ `backend/src/modules/race-result/services/race-recap.service.ts` — refactor to use helpers, add negSplit + city + spotlight, fix interpretation field
- ✏️ `backend/src/modules/race-result/services/race-recap.service.spec.ts` — add TC-56-XX tests (14 cases)
- ✏️ `backend/src/modules/race-result/race-result.controller.ts` — **ADD 2 endpoints** (Clarification #2): `@Get('recap/:raceId')` + `@Get('recap/:raceId/insight')`
- ✏️ `backend/src/modules/race-result/dto/race-recap-response.dto.ts` — extend with 3 new optional DTOs (RecapCityDto, RecapNegSplitDto, RecapSpotlightStoryDto) + extend RecapPodiumCellDto with `city?: string`
- ✏️ `backend/src/modules/race-result/schemas/race-recap-insight.schema.ts` — add `spotlightStories` optional array field
- ✏️ `backend/src/modules/race-result/race-result.module.ts` — no provider changes needed (helpers are pure funcs, not DI)

### Frontend — 7 files (6 NEW + 1 rewrite)

**REWRITE:**
- ✏️ `frontend/app/(main)/giai-chay/[raceSlug]/recap/page.tsx` — full rewrite per Variation A design

**NEW components (`frontend/components/recap/`):**
- ➕ `PodiumCard.tsx` (medal gradient per rank + chip time + AG pill + city chip)
- ➕ `PaceDistributionChart.tsx` (SVG bell curve)
- ➕ `NegSplitDonut.tsx` (% donut + narrative)
- ➕ `AGBreakdownAccordion.tsx` (Top 5 per bracket)
- ➕ `InsightEditorial.tsx` (drop cap, italic, sanitized HTML render)
- ➕ `StickyRecapNav.tsx` (`'use client'`, IntersectionObserver scroll-spy)

**NEW utility:**
- ➕ `frontend/lib/race-classifier.ts` — port `classifyRaceType` from backend F-050 (BR-56-16)

### Admin — DEFERRED (Phase 2)
- spotlightStories admin editor → defer F-056-admin sub-feature (optional Phase 2)

### CLAUDE.md — minor update
- ✏️ Cache Keys Registry: `recap:race:<raceId>` 3600s already exists, no change. spotlightStories doesn't add new Redis key.

**Total scope: 16 source files (9 backend + 7 frontend). NO migration. NO new endpoint URL pattern.**

---

## 🔧 Tech Approach (Coder có thể tinh chỉnh)

### Backend pattern

```typescript
// race-aggregations.ts — PURE FUNCTIONS, no DI, no I/O
export function computePodium(rows: RaceResult[]): { M: Top3, F: Top3 } { ... }
export function computePaceStats(rows: RaceResult[]): PaceStats { ... }
export function computeAGBreakdown(rows: RaceResult[]): AGBuckets { ... }
export function computeStatusCounts(rows: RaceResult[]): StatusCounts { ... }
export function computeNegSplit(rows: RaceResult[]): NegSplitStats { ... }

// race-recap.service.ts — consume helpers
async getRecap(raceId: string): Promise<RaceRecapResponseDto> {
  const cached = await this.redis.get(cacheKey);
  if (cached) return parse(cached);

  await this.acquireLock();
  try {
    const rows = await this.resultModel.find({ raceId }).lean();
    const grouped = groupByCourse(rows);
    const result = {
      podiums: courses.map(c => computePodium(grouped[c.id])),
      paceStats: courses.map(c => computePaceStats(grouped[c.id])),
      agBreakdowns: courses.map(c => computeAGBreakdown(grouped[c.id])),
      negativeSplits: courses.map(c => computeNegSplit(grouped[c.id])),
      hero: computeStatusCounts(rows),
      spotlightStories: this.buildSpotlightStories(grouped, insight),
      // ... etc
    };
    await this.redis.setex(cacheKey, 3600, JSON.stringify(result));
    return result;
  } finally { await this.releaseLock(); }
}

private async buildSpotlightStories(grouped, insight): Promise<RecapSpotlightStoryDto[]> {
  // If admin curated in insight.spotlightStories → use
  // Else: auto-generate from podium per BR-56-20
}
```

### Frontend pattern

```typescript
// page.tsx — Server Component SSR
export default async function RecapPage({ params }: { params: Promise<{ raceSlug: string }> }) {
  const { raceSlug } = await params;
  const race = await fetchRaceBySlug(raceSlug);
  if (!race) notFound();
  const recap = await fetchRecap(race.id);  // SSR fetch from /api/race-results/recap/:raceId

  return (
    <article>
      <Hero race={race} recap={recap} />
      <StickyRecapNav />  {/* client island */}
      <PodiumSection podiums={recap.podiums} courses={race.courses} />
      <PaceSection paceStats={recap.paceStats} />
      <NegSplitSection negSplit={recap.negativeSplits[0]} />
      <AGBreakdownSection agBreakdowns={recap.agBreakdowns} />
      <InsightSection insight={recap.insight} spotlight={recap.spotlightStories} />
      <RecapJsonLd race={race} recap={recap} />  {/* F-051 SEO preserve */}
    </article>
  );
}
```

---

## 🛑 PAUSE points cho Coder

- 🛑 Refactor F-046 service to use new helpers → MUST verify 100% backward compat. Run existing F-046 spec first → all pass → then refactor → spec MUST still pass.
- 🛑 Endpoint wiring (Clarification #2) — verify existing frontend still works after wiring. If F-046 frontend currently never worked, no risk; if it worked somehow (proxy?), test before/after.
- 🛑 `spotlightStories` schema add — write migration-less (Mongoose lazy default). Verify existing F-046 admin insight upsert still works.
- 🛑 negSplit compute performance — if benchmark shows >500ms on 2000-finisher race → cache stale-while-revalidate pattern, don't block initial response.
- 🛑 If city derivation requires JOIN race_athletes table → add to `RaceMasterDataService` query, NOT raw model.find (preserve existing query patterns).

---

## 🧪 Unit test BẮT BUỘC

Coder MUST write + paste PASS output in `03-coder-implementation.md`:

### `race-aggregations.spec.ts` (NEW)
- computePodium happy path (3 finishers) + edge (1 finisher → only top1) + empty (no rows)
- computePaceStats medianPace correctness + p10/p90 edge cases
- computeAGBreakdown bucket grouping + Top 5 sort
- computeStatusCounts counts dnf/dns/dsq finished correctly
- **computeNegSplit** with fixture chiptimes JSON: 100 finishers, 23 negative-split → output 23% benchmark 40

### `race-recap.service.spec.ts` (EXTEND existing)
- TC-56-01 happy path: GET recap with all 3 new fields populated
- TC-56-02 negSplit compute via helper
- TC-56-03 city derivation fallback chain test
- TC-56-04 spotlightStories auto-gen fallback when admin not curated
- TC-56-05 hero banner fallback gradient
- TC-56-06 cache hit returns cached
- TC-56-07 endpoint wiring 200 OK
- TC-56-08 endpoint not found 404
- TC-56-09 backward compat — F-046 frontend with new optional fields graceful
- TC-56-10 XSS sanitize spotlightStories markdown
- TC-56-11 spotlightStories array order matches podium
- TC-56-12 empty state — race no finishers
- TC-56-13 perf: cold compute < 800ms (mock race 2000 finishers)
- TC-56-14 invalidate cache on admin insight upsert

### Data integrity tests (per Danny "k nó kiện đấy")

Coder MUST add a data-cross-check spec:
- Pull 3 sample races from DEV DB (e.g., race 154 Ha Giang Discovery, race 192 Cat Tien)
- Compute via RaceAggregationHelpers
- Compare against raw DB queries via mongoose `.find({}).sort()` + manual aggregation
- Assert: podium ranks match raw `genderRankNumeric` ASC, finisher counts match raw status grouping, negSplit count matches manual chiptimes parse
- File: `race-aggregations.data-integrity.spec.ts` — gated test (skip in CI, runs locally)

---

## ✅ Verdict: APPROVED

3 critical clarifications applied. Scope lock 16 files. Coder unblocked với:
- ✅ Plan APPROVED
- ✅ Clarifications #1-3 documented (city field name, endpoint wiring, interpretation field)
- ✅ Tech approach + helper extraction pattern
- ✅ PAUSE points for Coder
- ✅ Unit test list explicit (14 + helpers + data integrity)
- ✅ Self-Review Pipeline 10 bước MANDATORY before READY_FOR_QC

**Recommended Coder sequence:**
1. Backend helpers extract (3 NEW files, ~1h)
2. Backend service refactor + 3 GAPs + endpoint wiring (~2.5h)
3. Backend tests + data integrity spec (~1.5h)
4. Frontend Variation A page rewrite + 6 components (~3h)
5. Self-Review Pipeline 10 bước (~30 min)

**Total ETA: ~8h Coder work.**

---

## 🎯 Performance Acceptance Criteria

- p95 GET `/api/race-results/recap/:raceId` < 800ms cold / <100ms warm
- TC-56-13 mock race 2000 finishers assert <800ms
- Cache hit ratio >90% after 1h warmup
- Frontend SSR TTI <1.5s on 4G simulated
- All BR-56-XX testable with concrete assertion

---

## 🔗 Next step

Danny chạy: `/5bib-fullstack-engineer FEATURE-056-race-recap-ui-upgrade` (or Manager autonomous spawn Coder agent per Danny's "lead end-to-end" mandate).
