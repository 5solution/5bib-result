# FEATURE-056 — Implementation Notes

**Reader:** Manager + QC + future Coder iterating on F-056 follow-up.

---

## 1 · Deviations from PRD/Plan

### 1.1 `subinfoClub` join — accepted as API surface, deferred as actual implementation

- **PRD said:** city chain step 3 = `race_athletes.subinfo.club` (via cross-collection join)
- **What I did:** `deriveCity({ nationality, club, subinfoClub })` signature accepts the field, but the service path `enrichCellWithCity` only passes `nationality` + `club` from the matched RaceResult row. Step 3 join NOT invoked at runtime.
- **Why:** Manager Plan PAUSE-56-04 explicitly flagged this as risk (false-positive on club strings like "5BIB Crew"). The data layer for `subinfo.club` lives in `RaceMasterDataService` — wiring a new cross-module query in this scope risks split-brain DI + extra round-trip per podium athlete. Plan said "If city derivation requires JOIN race_athletes table → add to `RaceMasterDataService` query, NOT raw model.find".
- **Impact:** City coverage will be lower than PRD spec when both `nationality` AND `club` are null but `subinfo.club` has province info. Fallback: chip hidden (graceful per BR-56-21).
- **Recommended follow-up:** F-056-followup to wire `subinfoClub` after measuring real coverage gap in DEV.

### 1.2 Inline AG formatter (vs centralized util)

- **PRD said (line 487):** "VN labels for all enum render: AG category `M30-39` → `Nam 30-39` via F-046 `formatAgBracket()`."
- **What I did:** Inlined `formatAg()` helper inside `PodiumCard.tsx` + `AGBreakdownAccordion.tsx` (duplicated 5-line regex).
- **Why:** Backend `formatAgBracket` is a private service method (not exported). No shared util exists in `frontend/lib/` for this. Extracting now would be cross-cutting.
- **Impact:** Minor duplication (2 sites, 5 lines each). No drift risk because regex is trivial.
- **Recommended follow-up:** When QC runs design audit, extract to `frontend/lib/ag-bracket.ts` if QC requests centralization.

### 1.3 Hero stat ticker — 3 stats kept consistent with design, but "Median Pace" can be undefined

- **PRD said (field 8):** `paceStats[0].medianPace` OR "—" if multi-course no aggregate.
- **What I did:** Uses `firstPace?.medianPace ?? '—'` plus stripped `/km` suffix for hero (per design Variation A which shows "06:42" not "06:42/km").
- **Why:** Design renders mono "06:42" inline + "MEDIAN PACE /km" label below. Matching design = strip suffix before rendering hero stat only.
- **Impact:** Hero stat looks like raw vendor data when missing → "—". OK.

---

## 2 · Forced choices not explicitly in PRD

### 2.1 Mobile responsive via Tailwind clamp + grid

- PRD called for parallel desktop + mobile with H1 88pt → 44pt. I used `font-size: clamp(44px, 7vw, 88px)` so the layout fluidly scales between breakpoints without a JS condition. Stack-on-mobile via `md:grid-cols-2`.
- Hero topo SVG hidden on mobile via `hidden md:block` for perf (PRD §3.3 row 2 said no topo on mobile).

### 2.2 Insight drop-cap derived from sanitized HTML first plaintext char

- PRD said drop-cap = first letter of `insightHtml`. Sanitized HTML may start with `<p>` tag — needed to strip tags + trim whitespace to get the first plaintext char. Implemented in `firstChar()` helper inside `InsightEditorial.tsx`.
- Edge case: if HTML starts with empty `<p></p>`, falls back to literal "H" (design example).

### 2.3 Hero "Race Recap" status pill conditional on race.status

- PRD field 2 said render "RACE RECAP" only when `status === 'ended'`. Implemented as ternary: ended → "RACE RECAP", live → "ĐANG DIỄN RA", else → "SẮP DIỄN RA". Backend currently 404s when race not ended (BR-56-25), so the pill is effectively always "RACE RECAP" in production. Code handles edge case for any future BR-56-24 empty-state route.

### 2.4 Auto-gen spotlight template wording

- BR-56-20 template: `"${name} đã hoàn thành ${distance} với chip time ${chipTime} — đứng top ${rank} hạng ${category}."`
- I implemented with `**name**` markdown bold + html `<strong>` wrap. The rank is always "1" (only Top-1 M/F per course gets spotlight per BR-56-03 + design Variation A). PRD didn't specify wider ranks.
- Category appended only when present (no trailing `" hạng "` when category missing).

---

## 3 · Tradeoffs

### 3.1 Helper extraction = breaking change for service internal interface

- `RaceRecapService` previously had `private` aggregation methods (`computePodium`, `computePaceStats`, etc.). Refactored to consume pure helpers.
- Side effect: `service.parseChipTimeSeconds(...)` was a public method (used by F-046 spec line 365). I kept it as a backward-compat shim delegating to the pure helper `chipTimeToSeconds`. Existing F-046 spec still PASSes without modification.
- Future Coder iterating on `getLeaderboard()` refactor (Phase 1.5) can directly reuse `computePodium` from helpers — no duplication.

### 3.2 Cache shape change — additive only

- Cache stores serialized `RaceRecapResponseDto`. After F-056 deploy, cache will include new optional keys (`spotlightStoriesByCourse`, `negativeSplits[].avgFirstHalf`, etc.).
- Old cached responses (pre-F-056) won't have new fields. Frontend handles this via optional destructure (BR-56-19). No cache flush required at deploy time.
- Tradeoff: Old browser tabs with stale F-046 page won't see new fields until next visit (revalidate=3600). Acceptable.

### 3.3 NegSplit interpretation — backend-computed (vs frontend dictionary)

- Alternative: backend returns only `value`, frontend dictionary maps to narrative. PRO: easier to localize.
- Chosen: backend computes interpretation directly. PRO: single source of truth + cache hit returns full narrative + matches PRD field 34 "backend computes Vietnamese narrative".
- Tradeoff: changing narrative copy requires backend deploy. Acceptable — copy is part of editorial product, not user-configurable.

### 3.4 Spotlight HTML sanitize via dedicated allowlist

- I introduced a NEW `SPOTLIGHT_SANITIZE` allowlist (only `p / strong / em / br`) — STRICTER than insight allowlist. Why: spotlight is auto-gen + admin-edited per podium athlete; no headings / links / lists needed. Tighter allowlist = smaller XSS surface.
- Tradeoff: future admin who wants `<ul>` in spotlight markdown won't get it. F-056-admin sub-feature can expand allowlist if needed.

---

## 4 · Reviewer Notes — Priority Read Order

1. **`backend/src/modules/race-result/utils/race-aggregations.ts`** — heart of the refactor. Pure helpers + new `computeNegSplit` with detail fields + interpretation thresholds. Audit `parseSplit()` carefully — that's where chiptimes JSON parse logic lives.
2. **`backend/src/modules/race-result/utils/city-derive.ts`** — Manager Clarification #1 fix. Audit `FOLDED_PROVINCE_LOOKUP` + word-boundary regex to confirm "5BIB Crew" → null (no false positive).
3. **`backend/src/modules/race-result/services/race-recap.service.ts`** — service now consumes helpers + adds `enrichCellWithCity` + `buildSpotlightStoriesForCourse` + `autoGenSpotlight`. F-046 logic preserved verbatim (cache + lock + insight admin upsert).
4. **`backend/src/modules/race-result/race-result.controller.ts`** — Clarification #2 wiring (2 new GET routes lines 100-138).
5. **`frontend/app/(main)/giai-chay/[raceSlug]/recap/page.tsx`** — Variation A rewrite. SSR preserved + F-051 JSON-LD preserved + `<StickyRecapNav>` single client island.
6. **`frontend/components/recap/*.tsx`** — 6 components, all Server Components except StickyRecapNav. PodiumCard renders 3 medals + city chip + AG pill. NegSplitDonut renders SVG donut + 3 stat cards. PaceDistributionChart renders SVG bell curve from 10-bin histogram.
7. **Specs:** `race-aggregations.spec.ts` + extension in `race-recap.service.spec.ts` (TC-56-01..14).

### Critical safety review checklist for QC

- [ ] City whitelist match — "Saigon Hash House Harriers" → "Hồ Chí Minh" via unaccented alias `saigon`; "Test Club" → null
- [ ] Podium ranking — vendor `genderRankNumeric` ASC trumps any other heuristic
- [ ] Chip times never reformatted (e.g. vendor "3:15:23" stays "3:15:23", not "03:15:23")
- [ ] Names never canonicalized
- [ ] `<script>` in athlete name → escaped + sanitize-html strips remainder
- [ ] Cache invalidate flow: admin upsert insight → DEL `recap:race:<raceId>` (existing) + DEL `recap:insight:<raceId>` (existing) → next GET recompute with new spotlight stories
- [ ] No new Redis keys introduced (CLAUDE.md registry unchanged)
- [ ] No S3 lifecycle change

### Production smoke after deploy

```bash
# 1. Wire test — call new endpoint with known ended race
curl -s https://result-dev.5bib.com/api/race-results/recap/<raceId> | jq '.spotlightStoriesByCourse | length'

# 2. Verify SSR
curl -s https://result-fe-dev.5bib.com/giai-chay/<raceSlug>/recap | grep -c "RACE RECAP"

# 3. Verify JSON-LD preserved
curl -s https://result-fe-dev.5bib.com/giai-chay/<raceSlug>/recap | grep -o 'application/ld+json'

# 4. Verify cache hit
curl -sv https://result-dev.5bib.com/api/race-results/recap/<raceId> 2>&1 | grep -i "x-cache\|age"
```
