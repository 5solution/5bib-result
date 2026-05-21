# FEATURE-056: Race Recap UI Upgrade + Data Enrichment

**Status:** 🟡 INITIATED
**Created:** 2026-05-21
**Owner:** Danny
**Type:** EXTEND_EXISTING (F-046 RaceRecapService + frontend page rewrite)
**Created by:** 5bib-manager
**Design source:** `/Users/dannynguyen/Downloads/5BIB Selling Web-handoff.zip` → `5bib-selling-web/project/page-recap.jsx` (Claude Design output)

---

## 🎯 Why this feature

Danny brief 2026-05-21:
> *"Trang recap sẽ có khá nhiều cái mày cần lấy data tương ứng từ trang kết quả giải chạy đấy. Mày nghiên cứu kỹ impact để hoàn thiện tính năng nhé"*

**Context:** Claude Design vừa output design handoff cho 4 SEO pages (page-recap + page-athlete + page-search + page-misc). Recap design phong phú HƠN current F-046 implementation rất nhiều — yêu cầu cả backend data enrichment LẪN frontend rewrite full.

**Critical insight:** Race Recap page dùng cùng RAW DATA SOURCE (race_results collection) với race ranking page (`/giai-chay/[slug]/ket-qua`). Manager phải **tránh duplicate aggregation logic** + reuse cross-page where possible.

**Business value:** Recap pages = SEO target "[Race Name] kết quả 2026" — most-trafficked programmatic SEO page (mỗi race ended = 1 indexable recap). Visual quality + data depth = competitive moat vs racevn/chayvn.

---

## 📂 Impact Map (theo memory + audit 2026-05-21)

### Module sẽ chạm

**Backend (extend F-046 — NO new module):**
- `backend/src/modules/race-result/services/race-recap.service.ts` — EXTEND compute method với:
  - `negSplit` % calculation (parse `chiptimes` JSON → compare 1st vs 2nd half pace)
  - `cityPerPodium` enrichment (derive from race_athletes.subinfo.club OR race_results.nationality)
  - `spotlightWinner` editorial text (new schema field per podium athlete)
- `backend/src/modules/race-result/dto/race-recap-response.dto.ts` — EXTEND with new optional fields
- `backend/src/modules/race-result/schemas/race-recap-insight.schema.ts` — ADD field `spotlightStories: Array<{ winnerBib, courseId, gender, markdown }>`
- POTENTIALLY: shared helpers extracted into `race-result/utils/race-aggregation.ts` (reused by both leaderboard service + recap service)

**Frontend (full rewrite F-046 page):**
- `frontend/app/(main)/giai-chay/[raceSlug]/recap/page.tsx` — REWRITE per design (Variation A "Editorial Magazine" — recommend default)
- NEW components extracted:
  - `frontend/components/recap/PodiumCard.tsx` (medal gradient + chip time + AG pill)
  - `frontend/components/recap/PaceDistributionChart.tsx` (bell curve SVG)
  - `frontend/components/recap/NegSplitBlock.tsx` (% vs benchmark)
  - `frontend/components/recap/AGBreakdownAccordion.tsx`
  - `frontend/components/recap/InsightEditorial.tsx` (drop cap, italic)
  - `frontend/components/recap/StickyNavPills.tsx` (auto scroll-spy)

**Admin (extend F-046 admin editor):**
- `admin/src/app/(dashboard)/races/[id]/recap/page.tsx` — extend với editor cho `spotlightStories` per winner

### File then chốt cần Coder đọc trước khi code

- `/tmp/5bib-selling-handoff/5bib-selling-web/project/page-recap.jsx` — DESIGN SOURCE (710 lines, 3 variations + 1 mobile)
- `/tmp/5bib-selling-handoff/5bib-selling-web/project/shared.jsx` line 294 RECAP shape
- `/tmp/5bib-selling-handoff/5bib-selling-web/project/charts.jsx` — chart components reference
- `/tmp/5bib-selling-handoff/5bib-selling-web/project/tokens.css` — design tokens (already aligned với 5BIB Velocity)
- `backend/src/modules/race-result/services/race-recap.service.ts` — current F-046 compute logic
- `backend/src/modules/race-result/services/race-result.service.ts` — `getLeaderboard()` shares aggregation pattern
- `frontend/app/(main)/giai-chay/[raceSlug]/recap/page.tsx` — current F-046 implementation
- `.5bib-workflow/design-briefs/SEO-PROGRAMMATIC-PAGES-DESIGN-BRIEF.md` — design brief reference (tao đã viết hôm nay)

### Endpoint liên quan

- `GET /api/race-recap/:raceSlug` (F-046 existing) — EXTEND response shape
- `GET /api/race-results/leaderboard/:courseId` (race-result module) — reuse for podium computation
- `GET /api/race-results/stats/:courseId/distribution` — reuse for pace bell curve
- `GET /api/race-results/stats/:raceId/:courseId` — reuse pace stats
- NO new endpoint required

### Schema/DB

- MongoDB `race_recap_insights`: ADD field `spotlightStories?: Array<{ winnerBib: string, courseId: string, gender: 'M'|'F', markdown: string, html: string }>` (optional, backward compat)
- MongoDB `race_results`: NO change. negSplit derived from existing `chiptimes` JSON field (already populated by timing sync)
- Redis: cache key `recap:<raceSlug>` TTL 3600s (already exists F-046, no change)
- NO migration required (additive fields only)

---

## 🔍 Critical data dependency analysis (Danny's question)

### Data points design expects vs what backend has

| RECAP design field | Current F-046 backend? | Source / GAP |
|---------------------|------------------------|--------------|
| `race.{slug,name,date,location,kind,courses}` | ✅ Yes | `races` collection direct |
| `hero` image | ✅ Yes (race.bannerUrl / imageUrl) | Already in race.schema |
| `podium.{M,F}[3]` rank/name/bib/time/ag | ⚠️ Partial — has fields but `ag` may be raw | F-050 formatAgBracket() reuse |
| `podium[].city` | ❌ MISSING | **GAP #1** — derive from race_athletes.subinfo (admin manual edit if vendor missing) |
| `pace.{median, p10, p90}` per course | ✅ Yes | Already computed F-046 |
| **`negSplit.{value, benchmark}`** | ❌ MISSING | **GAP #2** — needs chiptimes JSON parse + compute per finisher |
| `registered, finishers, dnf` counts | ✅ Yes | Already aggregated |
| `dnsCount, dsqCount` | ✅ Yes (F-046 v2) | Already in DTO |
| AG breakdown buckets per course | ✅ Yes | F-046 `agBreakdowns` |
| 5BIB Editorial Insight markdown/HTML | ✅ Yes | F-046 `race_recap_insights` collection |
| **`spotlightStories` per winner** (Variation C) | ❌ MISSING | **GAP #3** — admin editorial input per winner (new field) |
| Race classification badge (Road/Trail/Ultra) | ⚠️ Partial | reuse F-050 `classifyRaceType()` helper |
| Status pill (race ended/upcoming) | ✅ Yes | race.status |

**Summary: 3 GAPS need backend work** (negSplit + city + spotlightStories). 9 fields already available, reuse.

### Data REUSE opportunities (cross-page consistency)

Race Recap page + Race Results page (`/giai-chay/[slug]/ket-qua`) consume same raw `race_results` collection. Compute aggregations need to be SHARED:

| Aggregation | Recap uses | Results page uses | Recommend |
|-------------|-----------|-------------------|-----------|
| Podium per course (Top 3 M+F) | ✅ Hero podium block | ✅ Top of leaderboard | **EXTRACT** into `RaceAggregationService` |
| Pace stats per course (median/p10/p90) | ✅ Pace bell curve | ❌ Results page hiện không show | New helper, recap-only |
| AG breakdown buckets (Top 5 each) | ✅ AG section | ✅ Results page có filter by AG | **REUSE** existing aggregation |
| Total finishers/DNF/DNS/DSQ | ✅ Hero stats | ✅ Results page header | **EXTRACT** count helper |
| negSplit % | ✅ NegSplit block | ❌ Not on results page | New helper, recap-only |
| Race meta (title, date, location, courses) | ✅ Hero + breadcrumb | ✅ Page header | already shared via `races` collection |

**Pattern recommendation:** Extract `RaceAggregationHelpers` service with pure functions:
```typescript
// race-result/utils/race-aggregations.ts
computePodium(rows: RaceResult[]): Podium
computePaceStats(rows: RaceResult[]): PaceStats
computeAGBreakdown(rows: RaceResult[]): AGBuckets
computeStatusCounts(rows: RaceResult[]): { finishers, dnf, dns, dsq }
computeNegSplit(rows: RaceResult[]): { value: number, benchmark: 40 }  // NEW
```

Both `race-recap.service.ts` + `race-result.service.ts` consume these helpers. Single source of truth.

---

## ⚠️ Risk Flags

- 🔴 **[HIGH] Avoid duplicate aggregation logic** — Coder MUST extract pure helpers if computing aggregations also used by `race-result.service.getLeaderboard()`. Else: future schema drift between recap counts vs ranking counts (data integrity bug).

- 🟡 **[MED] negSplit computation expensive** — parsing `chiptimes` JSON for ALL finishers per race (2000+ per race) at request time = slow. Cache result OR pre-compute via cron `race_recap_aggregates` collection. Recommend: lazy-compute first request + Redis cache 1h.

- 🟡 **[MED] city per podium athlete may be sparse** — vendor data inconsistent. Need fallback: race_athletes.subinfo.club OR athlete profile's most-recent province OR hide chip if missing.

- 🟡 **[MED] spotlightStories editor UX** — admin must enter editorial text per podium winner (typically 1-3 per race × course). UI complexity manageable (markdown textarea per winner). But operational overhead 30-60 phút/race admin time.

- 🟢 **[LOW] Backward compat F-046** — All new DTO fields `@ApiPropertyOptional`. Existing F-046 frontend graceful when fields undefined.

- 🟢 **[LOW] Design system match** — design `tokens.css` aligned với 5BIB Velocity (same colors, fonts). Mocking integration ratio ~95% direct.

- 🟢 **[LOW] Cross-data path with race-result module** — both services live in `race-result/` Nest module, no DI complexity.

---

## 🚧 PAUSE Conditions — ✅ ALL CONFIRMED Danny 2026-05-21

- [x] **PAUSE-56-01:** ✅ **Variation A "Editorial Magazine"** — asymmetric hero, oversized type, italic lead, magazine-grid pace block. Best storytelling-first for SEO + AI search.
- [x] **PAUSE-56-02:** ✅ Hardcode 40% Vietnam benchmark + display "% Vietnam avg" label.
- [x] **PAUSE-56-03:** ✅ spotlightStories OPTIONAL + auto-generated 1-line fallback ("Winner X completed Y in Z time").
- [x] **PAUSE-56-04:** ✅ City derivation chain — vendor `nationality` → fallback `race_athletes.subinfo.club` → hide chip if both null. NO admin manual entry v1.
- [x] **PAUSE-56-05:** ✅ Require race.bannerUrl (admin enforced). Solid gradient + oversized race title fallback if missing. NO Unsplash external dep.
- [x] **PAUSE-56-06:** ✅ Ship BOTH desktop + mobile parallel (design provides mobile variation, ~30% extra Coder effort).
- [x] **PAUSE-56-07:** ✅ v1 race-level only (`/giai-chay/[raceSlug]/recap`). Per-course route deferred Phase 2.
- [x] **PAUSE-56-08:** ✅ Sticky nav pills as `<StickyRecapNav>` client island. Rest of page Server Component (SSR SEO preserved).

**Status:** ALL 8 PAUSE confirmed → BA ready to write PRD with 5 mandatory tables.

---

## 🎯 Success criteria (gợi ý cho BA)

- Visual match design Variation A within ~95% (typography + layout + colors)
- All 3 GAP data points populated: negSplit %, city per podium, spotlightStories
- p95 GET `/api/race-recap/:raceSlug` < 800ms cold / <100ms warm (Redis cache 1h)
- No duplicate aggregation logic — Coder extracts pure helpers shared with race-result module
- Mobile layout responsive với design variation D mobile
- 5BIB Insight editorial preserved (existing F-046 admin flow unchanged)
- SEO foundation preserved: F-051 JSON-LD Article schema still emitted on recap pages
- Graceful degrade per missing field (city/spotlightStories optional)

---

## ✅ Sẵn sàng cho `/5bib-prd`

**Sẵn sàng** với defaults recommendation cho 8 PAUSE-56-* questions.

**Danny next step:**
1. Confirm 8 PAUSE defaults (hoặc override per question)
2. `/5bib-po-ba FEATURE-056-race-recap-ui-upgrade` → BA viết PRD với:
   - 5 mandatory tables (UI steps + buttons + fields + endpoints + TCs)
   - DTO field-level spec for 3 new fields (negSplit, cityPerPodium, spotlightStories)
   - RaceAggregationHelpers pure-function spec (shared backend)
   - Component spec for 6 new frontend components

3. `/5bib-manager FEATURE-056-...` → Plan review + Scope Lock cho Coder

---

## 🔗 References

- Design source: `/Users/dannynguyen/Downloads/5BIB Selling Web-handoff.zip` (Claude Design output 2026-05-21)
  - `page-recap.jsx` 710 lines, 3 desktop variations + 1 mobile
  - `shared.jsx` line 294 RECAP data shape
  - `tokens.css` design tokens
- Earlier design brief: `.5bib-workflow/design-briefs/SEO-PROGRAMMATIC-PAGES-DESIGN-BRIEF.md` (Phase 1 page #3)
- Data mapping audit: `.5bib-workflow/design-briefs/DATA-MAPPING-DEFINITION.md` (cross-page reuse strategy)
- Current F-046: `backend/src/modules/race-result/services/race-recap.service.ts` + `frontend/app/(main)/giai-chay/[raceSlug]/recap/page.tsx`
- Race result module endpoints: `backend/src/modules/race-result/race-result.controller.ts` (existing aggregations to reuse)
- Sibling planned features:
  - F-053 Email-based identity merge (data foundation, separate)
  - F-057 page-athlete iterate per design (uses page-athlete.jsx)
  - F-058 page-search redesign (uses page-search.jsx)
  - F-052 search & discovery (UX surface for athlete)
