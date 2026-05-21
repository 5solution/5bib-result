# FEATURE-056: Race Recap UI Upgrade + Data Enrichment — PRD

**Status:** 🔵 READY
**Created:** 2026-05-21
**Author:** 5BIB Mastermind PO
**Type:** EXTEND_EXISTING (F-046 backend extend + frontend full rewrite)
**Handoff next:** `/5bib-manager FEATURE-056-race-recap-ui-upgrade` (Plan review)

---

## ✅ Pre-flight Gate Check

| Source | Path | Read |
|--------|------|------|
| Manager init | `.5bib-workflow/features/FEATURE-056-race-recap-ui-upgrade/00-manager-init.md` | ✅ |
| Design source A | `/tmp/5bib-selling-handoff/5bib-selling-web/project/page-recap.jsx` (lines 39–292 Variation A + 636–710 mobile) | ✅ |
| Design RECAP shape | `/tmp/5bib-selling-handoff/5bib-selling-web/project/shared.jsx` line 294 | ✅ |
| Current backend service | `backend/src/modules/race-result/services/race-recap.service.ts` | ✅ |
| Current backend DTO | `backend/src/modules/race-result/dto/race-recap-response.dto.ts` | ✅ |
| Current schema | `backend/src/modules/race-result/schemas/race-recap-insight.schema.ts` | ✅ |
| Current frontend page | `frontend/app/(main)/giai-chay/[raceSlug]/recap/page.tsx` | ✅ |
| Memory: codebase-map + conventions + known-issues | `.5bib-workflow/memory/*` | ✅ |

All 8 PAUSE-56-* answered by Danny (default A — accept all) on 2026-05-21 → BA write greenlight.

---

## 1 · Title + Goal + Scope

### 1.1 Title
**Race Recap UI Upgrade + Data Enrichment** — Variation A "Editorial Magazine" desktop + mobile parallel ship.

### 1.2 Goal
Đẩy chất lượng page `/giai-chay/[raceSlug]/recap` lên ngang competitive moat — editorial magazine layout, oversized type, sticky scroll-spy nav, podium cards có city chip, negative-split block với pacing storytelling, AG breakdown accordion, 5BIB editorial drop-cap article. Cụ thể:

1. **Bù 3 data GAP** (Manager init): negative-split rich detail, city per podium athlete, spotlightStories editorial.
2. **Đảm bảo cross-page consistency:** podium/AG aggregation phải SHARE pure helpers với race-result module — không drift đếm finisher giữa recap và ranking page.
3. **Match design Variation A ~95%** (typography, layout, color, sticky behavior). KHÔNG ship Variation B (Telemetry) hoặc C (Magazine Index) — defer Phase 2.
4. **Mobile parallel** (PAUSE-56-06): 1 single responsive page Server Component + `<StickyRecapNav>` client island, KHÔNG split route mobile/desktop.

### 1.3 Scope IN

**Backend (F-046 EXTEND, no module rewrite):**
- EXTEND `RaceRecapResponseDto` 3 field optional: `cityPerPodium`, `negSplitDetails`, `spotlightStoriesByCourse`.
- EXTEND `RecapPodiumCellDto` 1 field optional: `city?: string`.
- EXTEND `RecapNegativeSplitDto` 4 field optional: `avgFirstHalf?, avgSecondHalf?, deltaSeconds?, finishersAnalyzed?`.
- EXTEND `race_recap_insights` schema 1 field optional: `spotlightStories?: Array<{...}>`.
- EXTRACT `backend/src/modules/race-result/utils/race-aggregations.ts` — 5 pure-function helpers (computePodium, computePaceStats, computeAGBreakdown, computeStatusCounts, computeNegSplit). Refactor `RaceRecapService` + (optional Phase-1.5) `RaceResultService.getLeaderboard()` consume these helpers.
- City derivation chain: `race_athletes.nationality` → `race_athletes.subinfo.club` → null (BR-56-04, PAUSE-56-04).
- spotlightStories auto-gen fallback when admin chưa curated (BR-56-20, PAUSE-56-03).
- Backward compat: tất cả field thêm `@ApiPropertyOptional` — F-046 frontend cũ KHÔNG break (BR-56-19).

**Frontend (F-046 page FULL REWRITE):**
- Rewrite `frontend/app/(main)/giai-chay/[raceSlug]/recap/page.tsx` theo Variation A — desktop + mobile responsive 1 file.
- 6 component mới `frontend/components/recap/`: `PodiumCard.tsx`, `PaceDistributionChart.tsx`, `NegSplitBlock.tsx`, `AGBreakdownAccordion.tsx`, `InsightEditorial.tsx`, `StickyRecapNav.tsx` (client island).
- Sticky pill nav scroll-spy active state (PAUSE-56-08).
- SSR Server Component preserved (F-051 JSON-LD SEO không bị mất).
- Reuse F-050 `classifyRaceType()` cho race classification badge (BR-56-16).

**Admin (DEFER — sub-feature):**
- spotlightStories editor UI = **OUT of v1 scope** — tracked F-056-admin sub-feature. v1 backend ship optional field; admin nhập qua MongoDB shell tạm thời nếu cần test. Auto-gen fallback đủ cho 95% race-day (PAUSE-56-03).

### 1.4 Scope OUT

| OUT item | Lý do | Defer to |
|----------|-------|----------|
| Variation B "Data Telemetry" | PAUSE-56-01 = A only | Phase 2 toggle |
| Variation C "Magazine Index" | PAUSE-56-01 = A only | Phase 2 |
| Per-course route `/giai-chay/:slug/recap/:courseId` | PAUSE-56-07 = race-level only | Phase 2 nếu trafic justify |
| Admin spotlightStories editor UI | PAUSE-56-03 fallback đủ + ops effort 30-60m/race | F-056-admin sub-feature |
| Hero image upload by admin (force `bannerUrl`) | Race admin module owns banner — không scope của F-056 | Existing race admin flow |
| RaceResultService refactor consume helpers | Risk regression toàn module — chỉ extract + ensure recap service consume; leaderboard service refactor optional Phase 1.5 | F-056 Phase 1.5 nếu test pass |
| MongoDB migration | NO migration — all fields additive optional | n/a |
| New endpoint | NO new endpoint — extend existing `GET /api/race-recap/:raceSlug` response shape | n/a |

---

## 2 · User Stories & Business Rules

### 2.1 Personas

| Persona | Tỉ lệ traffic est. | Top need |
|---------|--------------------|----------|
| **Anonymous Visitor** (SEO landing) | 70% — Google search "[race name] kết quả 2026" | Visual storytelling đầy đủ trong 5s scroll → click "Xem toàn bộ kết quả" |
| **Athlete** (post-race share) | 20% — share Facebook + xem mình trong podium/AG | Tìm tên mình nhanh, screenshot/share dễ |
| **Race Organizer** (showcase) | 7% — gửi link recap cho sponsor/báo chí | Branding chuyên nghiệp, classification badge đúng |
| **Back-Office Admin** (curate insight) | 3% — viết editorial insight + spotlight | Editor markdown + preview |

### 2.2 User Stories

- **US-56-01** As an **Anonymous Visitor**, I want to see editorial-quality hero with race name oversized, classification badge, finisher count, median pace, winning time — **so that** tôi nắm race overview trong 3 giây và quyết định scroll tiếp.
- **US-56-02** As an **Anonymous Visitor**, I want sticky pill nav (Podium / Pace / NegSplit / AG / Insight) — **so that** jump giữa 5 section mà không phải scroll dài.
- **US-56-03** As an **Athlete**, I want to see Top 3 Nam + Nữ podium với chip-time mono, city chip, AG pill — **so that** nhận diện được người quen + verify mình có lọt podium AG.
- **US-56-04** As an **Anonymous Visitor**, I want pace bell curve với median/p10/p90 stat cards — **so that** hiểu được race tough hay easy so với expectation.
- **US-56-05** As an **Anonymous Visitor**, I want negative-split donut + storytelling 1-paragraph kèm avgFirstHalf / avgSecondHalf / delta — **so that** cảm nhận race-day vibe (kiệt sức, gió ngược, etc.).
- **US-56-06** As an **Athlete**, I want AG breakdown accordion với Top 5 mỗi bracket — **so that** tìm thấy mình trong bracket cụ thể của mình.
- **US-56-07** As an **Anonymous Visitor**, I want 5BIB Editorial Insight với drop-cap italic lead — **so that** nhận diện 5BIB là editorial brand chứ không chỉ data utility.
- **US-56-08** As an **Athlete**, I want CTA "Xem toàn bộ kết quả" + "Chia sẻ" cuối Insight section — **so that** chuyển sang ranking page hoặc share Facebook tức thì.
- **US-56-09** As an **Athlete** mở trên mobile, I want stacked single-column layout với podium cards full-width — **so that** đọc + share dễ trên điện thoại sau race.
- **US-56-10** As a **Back-Office Admin**, I want backend optional field `spotlightStories` để tương lai thêm editorial text per podium winner — **so that** roadmap admin editor F-056-admin có sẵn slot data (KHÔNG ship UI editor v1).

### 2.3 Business Rules (BR-56-XX)

| ID | Rule | Source |
|----|------|--------|
| **BR-56-01** | Variation A "Editorial Magazine" = default + only variation v1. Không ship B/C. | PAUSE-56-01 |
| **BR-56-02** | negSplit benchmark hardcoded `40` cho Việt Nam — render label "Benchmark Vietnam ~40%". KHÔNG configurable v1. | PAUSE-56-02 |
| **BR-56-03** | spotlightStories field optional. Khi `spotlightStories[].markdown` null/empty → auto-generate 1-line fallback `"<name> hoàn thành <distance> với chip time <chipTime>"` per podium winner. | PAUSE-56-03 |
| **BR-56-04** | City derivation chain per podium athlete: (1) `race_athletes.nationality` if non-empty + Vietnamese-province-like → use. (2) Else `race_athletes.subinfo.club` (city often embedded in club name). (3) Else null → frontend hide city chip. | PAUSE-56-04 |
| **BR-56-05** | Hero banner: render `race.bannerUrl` if non-empty. Else solid gradient `linear-gradient(135deg, #1B2238, #2A3354)` + oversized race title — không Unsplash external. | PAUSE-56-05 |
| **BR-56-06** | Mobile + desktop parallel ship — 1 single responsive page Server Component. Breakpoint 768px = stack columns + reduce hero height 640px → 380px. | PAUSE-56-06 |
| **BR-56-07** | Route v1: race-level ONLY `/giai-chay/[raceSlug]/recap`. Per-course `/recap/:courseId` defer Phase 2. | PAUSE-56-07 |
| **BR-56-08** | Sticky nav pills = `<StickyRecapNav>` client island ('use client'). Rest of page Server Component. Scroll-spy active state via IntersectionObserver. | PAUSE-56-08 |
| **BR-56-09** | computeNegSplit: parse `chiptimes` JSON for each finisher → tìm midpoint (closest checkpoint to 50% distance hoặc 2nd half if Finish-Start có chia). Count finishers where `pace_2ndHalf < pace_1stHalf`. Result = count / totalFinishers × 100. Cache 1h Redis. |
| **BR-56-10** | Podium = Top 3 by `genderRank` per course per gender (M + F). Tie-break: chipTimeMs ASC. Existing F-046 logic preserve. |
| **BR-56-11** | Pace stats per course: medianPace, p10Pace, p90Pace formatted `mm:ss/km`. Sort all finishers by pace ASC, pick percentile rank by index. |
| **BR-56-12** | AG breakdown: group `category` field per course → Top 5 by genderRank ASC per bracket. Min 1 finisher to render bracket. |
| **BR-56-13** | 5BIB Editorial Insight markdown → backend pre-render HTML (sanitize-html allowlist preserved F-046 BR-46-13). |
| **BR-56-14** | Page = Server Component SSR. Preserve F-051 JSON-LD Article emit (SEO foundation). NO client-side fetch on initial render. |
| **BR-56-15** | Redis cache key `recap:race:<raceId>` TTL 3600s. SETNX anti-stampede lock `recap:lock:<raceId>` 30s (F-046 preserve). Cache invalidate khi admin upsert insight. |
| **BR-56-16** | Race classification badge: reuse F-050 `classifyRaceType(race)` helper. Port to frontend `frontend/lib/race-classifier.ts` nếu backend chưa expose to public DTO. |
| **BR-56-17** | Performance SLA: p95 GET `/api/race-recap/:raceSlug` cold < **800ms**, warm < **100ms** (Redis hit). |
| **BR-56-18** | `RaceAggregationHelpers` MUST be pure functions (no DI, no I/O). Located `backend/src/modules/race-result/utils/race-aggregations.ts`. Unit-tested in isolation. |
| **BR-56-19** | Backward compat: all new DTO fields `@ApiPropertyOptional`. Frontend F-046 cũ (nếu còn cache) KHÔNG break khi optional fields undefined. |
| **BR-56-20** | Auto-generated spotlight fallback per podium winner: `"${name} đã hoàn thành ${distance} với chip time ${chipTime} — đứng top ${rank} hạng ${category}."` Vietnamese. |
| **BR-56-21** | City chip render rule: max 14 chars, truncate ellipsis. Mono font tabular. Hide chip if city = null. |
| **BR-56-22** | Endpoint public, NO auth required. Response NO PII leak (no email, phone, DOB) — F-046 BR-46-15/16 preserved. |
| **BR-56-23** | spotlightStories markdown sanitized server-side (sanitize-html allowlist) before render HTML — XSS protection. |
| **BR-56-24** | Empty state — race exists but no finishers yet: render hero + "Recap sẽ có khi race kết thúc" placeholder. KHÔNG 404. |
| **BR-56-25** | 404 only when race slug không tồn tại MongoDB. |

---

## 3 · UI/UX Flow

### 3.1 Route Structure

| Route | Type | Access | Component model |
|-------|------|--------|-----------------|
| `/giai-chay/[raceSlug]/recap` | Public | Anonymous + Athlete + Admin | Server Component + 1 client island `<StickyRecapNav>` |

### 3.2 Layout per Screen — Desktop (≥ 1024px)

Single page với 6 vùng dọc:

| # | Vùng | Height | Content |
|---|------|--------|---------|
| 1 | **Header5BIB sticky top** | 56px | Logo + nav (Trang chủ / Giải chạy / Athletes / About) + search icon |
| 2 | **Hero full-bleed** | 640px | Banner image background + dark gradient overlay + topo SVG lines + breadcrumb top-left + asymmetric grid: H1 race name (88pt oversized) bottom-left + 3-row stat ticker right (Finishers / Median Pace / Winning Time) + diagonal accent strip bottom |
| 3 | **Sticky pill nav (client island)** | 52px | sticky top:56px, glass-blur bg, 5 pills (Podium / Pace / Negative Split / Age Group / Insight) + course pill chips on right (10K/21K/42K — read-only in v1, không filter) |
| 4 | **Main content** (max-width 1280px, padding 64px 32px) | flow | 5 sections in order: Podium → Pace → NegSplit → AG → Insight |
| 5 | **Footer5BIB** | auto | Standard 5BIB footer (existing component) |

### 3.3 Layout per Screen — Mobile (< 768px)

| # | Vùng | Adjustment |
|---|------|-----------|
| 1 | Header | Compact 52px |
| 2 | Hero | Height 380px, H1 fontSize 44pt (vs 88pt desktop), 2-row stats inline (Finishers + Median Pace), KHÔNG topo SVG (perf) |
| 3 | Sticky pills | sticky top:52px, scroll horizontal overflow, pills size sm |
| 4 | Main | padding `24px 16px`, all grids stack 1-column |
| 5 | Podium cards | 1 column stack — M trên F dưới, each card size="sm" |
| 6 | Pace block | Bell curve + stat cards stacked, KHÔNG side-by-side |
| 7 | NegSplit | Donut center top + text below, KHÔNG 2-column |
| 8 | AG | Accordion full-width stack |
| 9 | Insight | padding `20px 16px`, font-size lead 18pt (vs 26pt desktop), CTA button full-width |

### 3.4 UI Step-by-Step Numbered Table

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | User Google "Hà Giang Discovery kết quả 2026" → click result | SSR Server Component render full HTML in <200ms cold (Redis miss) hoặc <50ms warm | GET `/giai-chay/ha-giang-discovery-2026/recap` | Page render với hero visible above-fold |
| 2 | Page loaded — user nhìn hero 3 giây | Hero shows race name uppercase 88pt, classification badge "Trail", date + location mono, 3 stat ticker (Finishers 1.247 / Median Pace 06:42 / Winning Time 02:38:21) | n/a — pure render | User in "Hero scanned" state |
| 3 | User scroll xuống 600px | Sticky nav pills attach top:56px (desktop) hoặc top:52px (mobile), bg blur, "Podium" pill highlight active (vì section đầu trong viewport) | IntersectionObserver section trong `<StickyRecapNav>` | active state = 'podium' |
| 4 | User click pill "Pace" | smooth-scroll vào `#pace` section, active state update 'pace' | onClick `<a href="#pace">` + JS scroll behavior smooth | scrolled to Pace section |
| 5 | User scroll xuống đụng NegSplit section | Pill "Negative Split" active highlight | IntersectionObserver | active='negsplit' |
| 6 | User scroll xuống AG section, click bracket "Nam 30-39" header (chevron-down) | Accordion expand, hiện Top 5 finisher của bracket Nam 30-39 với rank + name + chipTime mono | onClick toggle state | Accordion expanded |
| 7 | User scroll xuống Insight section | Drop-cap "H" oversized 88pt highlight color render, italic display lead paragraph | pure render | Insight visible |
| 8 | User click "Xem toàn bộ kết quả" CTA bottom | Next.js Link navigate `/giai-chay/ha-giang-discovery-2026/ket-qua` | onClick Link | route navigate |
| 9 | User click "Chia sẻ" CTA | Native share API mở (mobile) hoặc copy URL to clipboard + toast "Đã copy link" (desktop) | onClick navigator.share or clipboard | share sheet hoặc toast |
| 10 | User mobile scroll → reach Footer | Footer5BIB render với links About / Privacy / Contact | pure render | end of page |
| 11 | (Edge) User land trên race chưa có finishers (status = 'live' or 'upcoming') | Hero render bình thường + placeholder section "Recap sẽ có khi race kết thúc" — KHÔNG 404 | BR-56-24 | Empty state render |
| 12 | (Edge) User truy cập slug không tồn tại | `notFound()` từ Next.js → 404 page | BR-56-25 | 404 |

### 3.5 Buttons Specification Table

| Button label | Position | Default state | Disabled state | Loading state | Action | Confirm dialog? |
|--------------|----------|---------------|----------------|---------------|--------|-----------------|
| **"Xem toàn bộ kết quả"** | Bottom of Insight section | Primary blue solid + arrow-right icon | KHÔNG (always enabled) | N/A (Next.js Link nav) | Next.js `Link` → `/giai-chay/[raceSlug]/ket-qua` | NO |
| **"Chia sẻ"** | Bottom of Insight section, sát "Xem toàn bộ kết quả" | Ghost outline + share icon | KHÔNG | spinner 200ms khi share API resolve | `navigator.share({ url, title })` (mobile) hoặc `navigator.clipboard.writeText(url)` + toast (desktop) | NO |
| **Nav pill "Podium"** | Sticky nav | Active = black bg + white text; Inactive = transparent + border + muted text | KHÔNG | N/A | smooth-scroll to `#podium` | NO |
| **Nav pill "Pace"** | Sticky nav | idem | KHÔNG | N/A | smooth-scroll to `#pace` | NO |
| **Nav pill "Negative Split"** | Sticky nav | idem | KHÔNG | N/A | smooth-scroll to `#negsplit` | NO |
| **Nav pill "Age Group"** | Sticky nav | idem | KHÔNG | N/A | smooth-scroll to `#ag` | NO |
| **Nav pill "Insight"** | Sticky nav | idem | KHÔNG | N/A | smooth-scroll to `#insight` | NO |
| **Course chip "10K/21K/42K"** | Sticky nav right side | Read-only visual chip — KHÔNG clickable v1 | n/a | n/a | n/a (Phase 2 filter) | NO |
| **AG accordion chevron** | AG breakdown each bracket header | Closed = chevron-down; Open = chevron-up | KHÔNG | N/A | Toggle accordion state (client island OR CSS-only via `<details>`) | NO |
| **"Xem tất cả"** (AG section header) | AG section right action | Ghost text-button | KHÔNG | N/A | Next.js Link → `/giai-chay/[raceSlug]/ket-qua` (same as primary CTA) | NO |

### 3.6 Form Fields Specification Table

**v1 = NO admin form fields in scope.** spotlightStories editor UI deferred F-056-admin sub-feature (per Scope OUT). Backend schema field optional, populated by MongoDB direct write OR auto-gen fallback.

Future F-056-admin spec (informational only — NOT v1 build):

| Field name (future) | UI label | Type | Required | Validation | Error message | Default |
|---------------------|----------|------|----------|------------|---------------|---------|
| `spotlightStories[i].markdown` | Spotlight cho VĐV [name] | textarea | ⚪ | max 600 chars, sanitize-html allowlist | "Tối đa 600 ký tự" | "" |
| `spotlightStories[i].courseId` | Cự ly | select (course list) | ✅ (if entry exists) | ObjectId valid | "Chọn cự ly" | none |
| `spotlightStories[i].gender` | Giới tính | select M/F | ✅ | enum | "Chọn nam/nữ" | none |
| `spotlightStories[i].winnerBib` | BIB | text | ✅ | exists in podium of (courseId+gender) | "BIB không khớp podium" | "" |

### 3.7 Field Source Table — CRITICAL (Danny's main question)

> Đây là **heart of PRD** — answers "lấy data tương ứng từ trang kết quả giải chạy" question.

| # | Field UI label | Data source | Format hiển thị | Empty state |
|---|----------------|-------------|-----------------|-------------|
| **HERO** ||||
| 1 | Breadcrumb "5BIB · GIẢI CHẠY · {location} · RECAP" | `race.location` (races collection) | uppercase mono 11pt | n/a — always render "—" if missing |
| 2 | Status pill "RACE RECAP" | hardcoded label | render only when `race.status === 'ended'`; else "LIVE" or "UPCOMING" | render conditional |
| 3 | Classification badge "Trail/Road/Ultra" | `classifyRaceType(race)` helper (port F-050) | label VN: "Đường nhựa" / "Trail" / "Ultra Trail" | "—" if cannot classify |
| 4 | Race title H1 | `race.title` (races collection) | uppercase 88pt desktop / 44pt mobile, oversized | required field — always present |
| 5 | Date + location subtitle | `race.endDate` + `race.location` | `DD/MM/YYYY · location` mono 12pt | "—" |
| 6 | Editorial lede italic (Variation A only) | Future: `race.editorialLede` (race admin field, NEW optional) OR auto-gen từ insight first paragraph | italic 16pt 540px max-width | hide if both null |
| 7 | Finishers stat | `hero.totalFinishers` (DTO) | `1,247` vi-VN locale, mono 56pt | "0" if 0 |
| 8 | Median Pace stat | derived: first course `paceStats[0].medianPace` (DTO) — OR "—" if multi-course no aggregate | `06:42/km` mono | "—" |
| 9 | Winning Time stat | derived: first course Top1 male `podiums[0].male[0].chipTime` | `02:38:21` mono | "—" |
| 10 | Hero background image | `race.bannerUrl` (races collection) | fill cover, brightness 0.6 | Fallback solid gradient + race title oversized (BR-56-05) |
| **PODIUM SECTION** ||||
| 11 | Section eyebrow "01 · Bảng vinh danh" | hardcoded | uppercase 11pt mono | n/a |
| 12 | Section title "PODIUM 42KM" (per course) | hardcoded prefix + `course.distance` from race.courses | uppercase 36pt display | n/a |
| 13 | Section action "Tổng X / Y VĐV · DNF Z" | `hero.totalFinishers` / `hero.registered` (NEW field) / `hero.dnfCount` | mono 13pt | "—" |
| 14 | Podium subgroup heading "OVERALL · NAM/NỮ" | hardcoded | uppercase 18pt | n/a |
| 15 | Podium count per gender (eyebrow right) | aggregate count finishers per course per gender | "687 finisher" mono 11pt | "0 finisher" |
| 16 | Podium card rank "#1/2/3" | `podiums[].male/female[].medal` mapped to rank | display 28pt color medal | n/a |
| 17 | Podium card BIB | `podiums[].male/female[].bib` | `BIB 1024` mono | required |
| 18 | Podium card name | `podiums[].male/female[].name` | uppercase 22pt display | required |
| 19 | Podium card AG pill | `podiums[].male/female[].category` (raw from RaceResult.category, e.g. "M30-39") | reformat VN via F-046 formatAgBracket → "Nam 30-39" | hide pill if null |
| 20 | **Podium card city chip (NEW GAP #1)** | NEW `podiums[].male/female[].city` (derive chain BR-56-04) | mono 11pt, max 14 chars truncate | hide chip if null |
| 21 | Podium card chip time | `podiums[].male/female[].chipTime` | `02:38:14` mono 28pt | required |
| **PACE SECTION** ||||
| 22 | Section eyebrow "02 · Phân bố pace" | hardcoded | uppercase mono | n/a |
| 23 | Section title "DÒNG CHẢY TỐC ĐỘ" | hardcoded | uppercase 36pt display | n/a |
| 24 | Pace bell curve chart | `paceStats[0].distribution: number[]` (histogram bins) | SVG path render | render flat line if all 0 |
| 25 | Median pace stat card | `paceStats[0].medianPace` | mono 30pt + "/km" suffix | "—" |
| 26 | Fastest 10% stat | `paceStats[0].p10Pace` | mono 30pt green | "—" |
| 27 | Slowest 10% stat | `paceStats[0].p90Pace` | mono 30pt red | "—" |
| 28 | Pace spread stat | derived: `p90 - p10` formatted minutes | `3:53 min` mono | "—" |
| 29 | Pace narrative paragraph | hardcoded template: "Phân bố pace nghiêng phải — phần đông VĐV chạy quanh `{p25}–{p75}/km`. Top 10% giữ pace dưới `{p10}`." | italic 13pt | hide if data missing |
| **NEG SPLIT SECTION** ||||
| 30 | Section eyebrow "03 · Pacing strategy" | hardcoded | uppercase mono | n/a |
| 31 | Section title "NEGATIVE SPLIT" | hardcoded | display 36pt | n/a |
| 32 | NegSplit donut | `negativeSplits[0].negativeSplitPercent` | SVG donut, value % vs benchmark 40 | "0%" donut empty if no data |
| 33 | "Chỉ X% chạy negative split" tag | derived from `negativeSplitPercent` | uppercase 11pt accent orange | hide if null |
| 34 | NegSplit headline H3 | `negativeSplits[0].interpretation` (existing F-046 field — backend computes Vietnamese narrative based on percent) | display 36pt | "—" |
| 35 | NegSplit body paragraph | hardcoded template + dynamic insertion of percent: "Benchmark Vietnam là ~40% finisher chạy negative split. Tại race này, chỉ X% giữ được pace nửa sau nhanh hơn nửa đầu — gợi ý..." | body 14pt | hide if null |
| 36 | **Average 1st half (NEW)** | NEW `negativeSplits[0].avgFirstHalf` | `03:21:08` mono 20pt | hide if null |
| 37 | **Average 2nd half (NEW)** | NEW `negativeSplits[0].avgSecondHalf` | mono 20pt | hide if null |
| 38 | **Δ delta (NEW)** | NEW `negativeSplits[0].deltaSeconds` | format `+10:05` or `-2:30` mono 20pt color red(positive)/green(negative) | hide if null |
| **AG BREAKDOWN** ||||
| 39 | Section eyebrow "04 · Age group" | hardcoded | uppercase mono | n/a |
| 40 | Section title "THEO NHÓM TUỔI" | hardcoded | display 36pt | n/a |
| 41 | AG bar chart | `agBreakdowns[0].buckets[].finisherCount` | SVG bars per bracket | empty state "Chưa có dữ liệu AG" |
| 42 | AG accordion bracket header pill | `agBreakdowns[].buckets[].category` → VN format ("Nam 30-39") | uppercase 11pt pill | "—" |
| 43 | AG accordion finisher count | `agBreakdowns[].buckets[].finisherCount` | "318 finisher" mono | "0 finisher" |
| 44 | AG accordion Top 5 row rank | derived index 1-5 | display 18pt color #1 gold, others muted | n/a |
| 45 | AG accordion Top 5 name | `agBreakdowns[].buckets[].top5[].name` | body 14pt bold | required |
| 46 | AG accordion Top 5 chipTime | `agBreakdowns[].buckets[].top5[].chipTime` | mono 13pt | required |
| **INSIGHT SECTION** ||||
| 47 | Section eyebrow "05 · 5BIB Editorial" | hardcoded | uppercase mono | n/a |
| 48 | Section title "INSIGHT" | hardcoded | display 36pt | n/a |
| 49 | Editorial team byline | `5BIB EDITORIAL TEAM · ${race.endDate}` | uppercase 11pt mono | "—" if date missing |
| 50 | Drop-cap first letter | first char of `insightHtml` plaintext | display 88pt highlight color, float-left | render only if insight exists |
| 51 | Lead paragraph italic | first `<p>` of `insightHtml` (sanitized server-side) | display italic 26pt | fallback auto-gen "{raceTitle} kết thúc với {finishers} VĐV hoàn thành." |
| 52 | Body paragraphs | rest of `insightHtml` | body 16pt line-height 1.75 | hide if no body |
| 53 | **Spotlight Stories (NEW GAP #3, conditional)** | NEW `spotlightStoriesByCourse[].stories[].html` (per podium winner) | render as card grid below body paragraphs — title "VĐV nổi bật" + 2-3 spotlight cards | hide section if all stories auto-gen + admin chưa curate |

---

### 3.8 UI States

Mỗi state PHẢI implement (Manager `/5bib-plan` reject nếu thiếu):

| State | UI |
|-------|----|
| **Loading SSR** | KHÔNG có (SSR đồng bộ). Next.js loading.tsx skeleton tùy chọn — Phase 2 nếu cần streaming |
| **Empty — race ended no finishers** (BR-56-24) | Hero render normal + Main content thay = placeholder block: icon clock + heading "Recap sẽ có khi race kết thúc và hoàn tất sync timing" + CTA "Quay lại trang giải" |
| **Empty — race upcoming/live** | Idem above, headline khác: "Race sắp diễn ra/đang diễn ra — recap publish sau finish" |
| **Data full** | All 5 sections render |
| **Partial — missing city per podium** | Render podium cards bình thường, hide city chip per athlete (BR-56-21) |
| **Partial — missing negSplit details** | Render donut + headline + interpretation. Hide avgFirstHalf/avgSecondHalf/delta row nếu null (BR-56-09 fallback) |
| **Partial — missing spotlightStories** | Hide spotlight cards section. Body paragraphs vẫn render |
| **Error fetch** | `notFound()` Next.js or 500 page (race slug invalid → 404; backend 5xx → bubble to error.tsx) |
| **Mobile responsive** | Breakpoint <768px stack 1-col, hero 380px, font sizes reduced per BR-56-06 |
| **Race slug not found** | Next.js `notFound()` → 404 page (BR-56-25) |

---

## 4 · Technical Mandates

### 4.1 DB / Cache Changes

| Layer | Change | Migration? |
|-------|--------|-----------|
| **MongoDB** `race_recap_insights` | ADD optional field `spotlightStories?: Array<{ courseId: string; gender: 'M'\|'F'; winnerBib: string; markdown: string; html: string }>` (sub-document, no separate collection) | ❌ NO migration — additive optional |
| **MongoDB** `race_results` | NO change — city derived from joined `race_athletes` collection on aggregation | ❌ |
| **MongoDB** `races` | NO change v1 — `bannerUrl` already exists | ❌ |
| **Redis** | NO new key. Existing `recap:race:<raceId>` TTL 3600s preserved. Invalidate on admin upsert insight (existing F-046 logic) | ❌ |
| **S3** | NO change | ❌ |

> **PAUSE flag:** spotlightStories sub-document = additive optional → KHÔNG cần Danny duyệt migration. Manager confirm in Plan review.

### 4.2 Backend Endpoint Specification Table

| Element | Spec |
|---------|------|
| Method | `GET` |
| Path | `/api/race-recap/:raceSlug` |
| Auth | NONE (public endpoint — BR-56-22) |
| Guard role | n/a |
| Request body | n/a (GET) |
| Path params | `raceSlug: string` (race slug) |
| Query params | none |
| Response DTO | `RaceRecapResponseDto` (extended with 3 new fields) |
| Status codes | 200 success / 404 slug not found / 500 server error |
| Cache | Redis `recap:race:<raceId>` 3600s TTL |
| Side effects | Cache write on miss + SETNX lock `recap:lock:<raceId>` 30s |
| Backward compat | All NEW fields `@ApiPropertyOptional` → old SDK works |

### 4.3 DTO Field-Level Spec

```typescript
// backend/src/modules/race-result/dto/race-recap-response.dto.ts (EXTEND existing)

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecapPodiumCellDto {
  @ApiProperty({ description: 'Tên VĐV (display)' })
  name!: string;

  @ApiProperty({ description: 'Số BIB' })
  bib!: string;

  @ApiProperty({ description: 'Chip time format hh:mm:ss' })
  chipTime!: string;

  @ApiPropertyOptional({ description: 'AG category raw từ RaceResult.category (M30-39)' })
  category?: string;

  @ApiProperty({ enum: ['gold', 'silver', 'bronze'] })
  medal!: 'gold' | 'silver' | 'bronze';

  @ApiPropertyOptional({ description: 'F-046 Phase 1.5 — public-shareable avatar URL' })
  avatarUrl?: string;

  /** F-056 NEW (GAP #1) — derive chain: nationality → subinfo.club → null. Max 80 chars. */
  @ApiPropertyOptional({ description: 'F-056 City per podium athlete (derived)', maxLength: 80 })
  city?: string;
}

export class RecapNegativeSplitDto {
  @ApiProperty()
  courseId!: string;

  @ApiProperty()
  courseName!: string;

  @ApiProperty({ description: '% finisher chạy negative split (0-100)' })
  negativeSplitPercent!: number;

  @ApiProperty({ description: 'Vietnamese narrative interpretation' })
  interpretation!: string;

  /** F-056 NEW (GAP #2) — Avg 1st half time hh:mm:ss across finishers analyzed */
  @ApiPropertyOptional({ description: 'Average time 1st half finisher hh:mm:ss' })
  avgFirstHalf?: string;

  /** F-056 NEW — Avg 2nd half time hh:mm:ss */
  @ApiPropertyOptional({ description: 'Average time 2nd half finisher hh:mm:ss' })
  avgSecondHalf?: string;

  /** F-056 NEW — Delta in seconds (positive = slowed down, negative = sped up) */
  @ApiPropertyOptional({ description: 'Delta seconds (avg2H - avg1H), positive = positive split' })
  deltaSeconds?: number;

  /** F-056 NEW — Count finishers analyzed (had valid checkpoint data for split compute) */
  @ApiPropertyOptional({ description: 'Số finisher có data đủ để compute split' })
  finishersAnalyzed?: number;
}

// NEW DTO classes

export class RecapSpotlightStoryDto {
  @ApiProperty({ description: 'Course ID this story refers to' })
  courseId!: string;

  @ApiProperty({ enum: ['M', 'F'] })
  gender!: 'M' | 'F';

  @ApiProperty({ description: 'Winner BIB number' })
  winnerBib!: string;

  @ApiProperty({ description: 'Winner display name' })
  winnerName!: string;

  @ApiProperty({ description: 'Auto-gen or admin-curated markdown source' })
  markdown!: string;

  @ApiProperty({ description: 'Pre-rendered sanitized HTML' })
  html!: string;

  @ApiProperty({ description: 'Source: "admin" | "auto"' })
  source!: 'admin' | 'auto';
}

export class RecapSpotlightPerCourseDto {
  @ApiProperty()
  courseId!: string;

  @ApiProperty()
  courseName!: string;

  @ApiProperty({ type: [RecapSpotlightStoryDto] })
  stories!: RecapSpotlightStoryDto[];
}

// EXTEND root response

export class RaceRecapResponseDto {
  // ... existing fields preserved (raceId, raceTitle, raceSlug, endDate, hero, podiums, paceStats, negativeSplits, agBreakdowns, computedAt)

  /** F-056 NEW (GAP #3) — Spotlight editorial per podium winner (Variation A optional render) */
  @ApiPropertyOptional({ type: [RecapSpotlightPerCourseDto] })
  spotlightStoriesByCourse?: RecapSpotlightPerCourseDto[];
}
```

### 4.4 Schema Field-Level Spec

```typescript
// backend/src/modules/race-result/schemas/race-recap-insight.schema.ts (EXTEND existing)

@Schema({ _id: false })
export class RecapSpotlightStorySub {
  @Prop({ required: true }) courseId!: string;
  @Prop({ required: true, enum: ['M', 'F'] }) gender!: 'M' | 'F';
  @Prop({ required: true }) winnerBib!: string;
  @Prop({ required: true, maxlength: 600 }) markdown!: string;
  @Prop({ required: true }) html!: string;
}
export const RecapSpotlightStorySubSchema = SchemaFactory.createForClass(RecapSpotlightStorySub);

@Schema({ ... })
export class RaceRecapInsight {
  // ... existing fields preserved

  /** F-056 NEW — Per-podium-winner editorial stories. Optional. */
  @Prop({ type: [RecapSpotlightStorySubSchema], default: undefined })
  spotlightStories?: RecapSpotlightStorySub[];
}
```

### 4.5 Frontend / Admin (Next.js)

**Routing + Component model:**

| File | Type | Reasoning |
|------|------|-----------|
| `frontend/app/(main)/giai-chay/[raceSlug]/recap/page.tsx` | Server Component (default) | SSR preserved, F-051 JSON-LD emit unchanged |
| `frontend/components/recap/StickyRecapNav.tsx` | `'use client'` island | IntersectionObserver scroll-spy active state, smooth-scroll onClick |
| `frontend/components/recap/PodiumCard.tsx` | Server Component | Pure render, no client state |
| `frontend/components/recap/PaceDistributionChart.tsx` | Server Component | SVG static render from `distribution[]` array |
| `frontend/components/recap/NegSplitBlock.tsx` | Server Component | SVG donut static, no animation v1 |
| `frontend/components/recap/AGBreakdownAccordion.tsx` | Server Component | Use native `<details>` element — no client JS for toggle |
| `frontend/components/recap/InsightEditorial.tsx` | Server Component | `dangerouslySetInnerHTML` for sanitized HTML |
| `frontend/components/recap/SpotlightCards.tsx` | Server Component | Conditional render based on `spotlightStoriesByCourse` |
| `frontend/lib/race-classifier.ts` | Pure util | Port F-050 `classifyRaceType` to frontend if backend không expose to DTO |

**Data fetch pattern:**
- Server Component direct fetch `${BACKEND_URL}/api/race-recap/${raceSlug}` (existing F-046 pattern preserve).
- KHÔNG TanStack Query — page = SSR, no client refetch.
- `revalidate = 3600` Next.js ISR fallback (same TTL as Redis).

**Display Convention (CLAUDE.md):**
- VN labels for all enum render: AG category "M30-39" → "Nam 30-39" via F-046 `formatAgBracket()`.
- Classification badge "trail" → "Trail" / "road" → "Đường nhựa" / "ultra" → "Ultra Trail" via VN dictionary.
- Status pill enum → VN: 'ended' → "ĐÃ KẾT THÚC", 'live' → "ĐANG DIỄN RA", 'upcoming' → "SẮP DIỄN RA".

**SDK regenerate:**
- After backend DTO change → `pnpm generate:api` in `frontend/`.
- Run grep `grep -rn "RecapPodiumCell\|RecapNegativeSplit" frontend/` to verify no stale type refs.

**Cache invalidation:**
- Admin upsert insight (existing F-046 endpoint) → DEL `recap:race:<raceId>` (preserved).
- spotlightStories edit (future F-056-admin) → same DEL pattern.

### 4.6 RaceAggregationHelpers — Pure Function Spec (NEW utils)

```typescript
// backend/src/modules/race-result/utils/race-aggregations.ts (NEW)

import { RaceResult } from '../schemas/race-result.schema';

export interface PodiumResult {
  male: Array<Pick<RaceResult, 'bib' | 'name' | 'chipTime' | 'category'> & { medal: 'gold'|'silver'|'bronze' }>;
  female: Array<...>; // same shape
}

export interface PaceStatsResult {
  medianPace: string;
  p10Pace: string;
  p90Pace: string;
  distribution: number[]; // histogram bins (10 buckets default)
  finisherCount: number;
}

export interface AGBucketResult {
  category: string; // raw e.g. "M30-39"
  finisherCount: number;
  top5: Array<...>; // same as PodiumResult cell
}

export interface StatusCountsResult {
  finishers: number;
  dnf: number;
  dns: number;
  dsq: number;
  registered: number; // total all statuses
}

export interface NegSplitResult {
  value: number; // % 0-100
  benchmark: 40; // hardcoded VN
  avgFirstHalf: string; // hh:mm:ss
  avgSecondHalf: string;
  deltaSeconds: number;
  finishersAnalyzed: number;
}

/** Pure — no DI, no I/O. Sort by genderRank ASC then chipTimeMs ASC tie-break. */
export function computePodium(rows: RaceResult[]): PodiumResult;

/** Pure — pace histogram + p10/p50/p90 from sorted finisher paces. */
export function computePaceStats(rows: RaceResult[]): PaceStatsResult;

/** Pure — group by RaceResult.category → Top 5 per bracket. */
export function computeAGBreakdown(rows: RaceResult[]): AGBucketResult[];

/** Pure — count by status field. */
export function computeStatusCounts(rows: RaceResult[]): StatusCountsResult;

/** Pure — parse chiptimes JSON per row, count negative-split finishers, avg 1H/2H. */
export function computeNegSplit(rows: RaceResult[]): NegSplitResult;

/** Pure helper — chip-time hh:mm:ss → seconds */
export function chipTimeToSeconds(time: string): number;
/** Pure helper — seconds → hh:mm:ss */
export function secondsToChipTime(seconds: number): string;
```

**Consumer refactor:**
- `RaceRecapService` MUST import + consume these 5 helpers (replaces inline aggregation logic).
- `RaceResultService.getLeaderboard()` consume `computePodium` Phase 1.5 — defer if regression risk too high (out of v1 scope).
- Unit test isolated: 100% pure function tests in `race-aggregations.spec.ts`.

### 4.7 PAUSE Flags Cho Manager Plan Review

- 🛑 **Schema additive verify** — confirm `race_recap_insights.spotlightStories` sub-doc backward compat (existing F-046 admin upsert endpoint doesn't break, old docs without field still readable).
- 🛑 **negSplit compute performance** — parsing `chiptimes` JSON for 2000+ finishers per race × 4 courses per race = 8000 JSON parses per recap compute. Recommend benchmark Coder thực tế. Nếu >800ms cold p95 → cache trong `race_recap_aggregates` collection (NEW Phase 1.5 — defer to plan).
- 🛑 **Helper extract regression risk** — `RaceResultService.getLeaderboard()` refactor consume `computePodium` = potential regression on ranking page. Recommend: Phase 1 = extract + consume in RecapService only. Phase 1.5 = refactor RaceResultService SEPARATE branch + full E2E ranking regression test.
- 🛑 **City derivation false-positive** — `subinfo.club` might contain noise ("Hanoi Runners Club" → "Hà Nội" ok; "5BIB Crew" → "5BIB Crew" wrong). Coder MUST implement Vietnamese-province whitelist match — chỉ pass if club starts with hoặc contains 1 of 63 VN provinces. Otherwise null.

---

## 5 · Testing Mandates

### 5.1 Backend Test Cases (TC-56-XX)

#### TC-56-01 Happy path — Full recap response shape

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/race-recap/ha-giang-discovery-2026` |
| Headers | n/a |
| Body | n/a |
| Expected status | 200 |
| Expected body shape | `{ raceId, raceTitle: "Hà Giang Discovery Marathon 2026", raceSlug, endDate, hero: {...}, podiums: [{ courseId, courseName, distance, male: [3 cells], female: [3 cells] }], paceStats: [{ medianPace, p10Pace, p90Pace, distribution: [10 nums], finisherCount }], negativeSplits: [{ courseId, courseName, negativeSplitPercent: 23, interpretation, avgFirstHalf: "03:21:08", avgSecondHalf: "03:31:13", deltaSeconds: 605, finishersAnalyzed }], agBreakdowns: [...], spotlightStoriesByCourse: [...], computedAt }` |
| MUST NOT leak | `_id`, email, phone, dob, raw subinfo PII |
| Side effect verify | Redis `recap:race:<raceId>` set với TTL 3600s |

#### TC-56-02 negSplit compute correctness — finishers with valid checkpoint data

| Element | Value |
|---------|-------|
| Setup | Insert 100 RaceResult rows với `chiptimes` JSON valid, 23 finishers có `pace_2ndHalf < pace_1stHalf` |
| Action | Call `computeNegSplit(rows)` |
| Expected | `{ value: 23, benchmark: 40, avgFirstHalf: <hh:mm:ss>, avgSecondHalf: <hh:mm:ss>, deltaSeconds: number, finishersAnalyzed: 100 }` |
| Edge | If row.chiptimes invalid JSON → skip, không throw |

#### TC-56-03 City derivation fallback chain

| Element | Value |
|---------|-------|
| Setup A | Athlete `nationality = "Hà Nội"` | Expected `city = "Hà Nội"` |
| Setup B | nationality null, `subinfo.club = "Hanoi Runners Club"` | Expected `city = "Hà Nội"` (Vietnamese-province whitelist match) |
| Setup C | nationality null, `subinfo.club = "5BIB Crew"` | Expected `city = null` (no province match) |
| Setup D | nationality null, subinfo null | Expected `city = null` |

#### TC-56-04 spotlightStories — admin curated vs auto-gen

| Element | Value |
|---------|-------|
| Setup A | `race_recap_insights.spotlightStories[]` has 6 entries (Top1 M+F × 3 courses) | Expected response stories[].source = "admin" |
| Setup B | `spotlightStories` empty/null | Expected auto-gen 6 stories với source = "auto", html = sanitized template "X hoàn thành Y với chip time Z..." |
| Setup C | Partial — 2/6 admin curated, 4 missing | Expected 2 source="admin" + 4 source="auto" fallback |

#### TC-56-05 Banner missing → frontend gradient fallback (smoke E2E)

| Element | Value |
|---------|-------|
| Setup | `race.bannerUrl = null` |
| Action | GET recap, frontend renders |
| Expected | Backend response unchanged. Frontend renders solid gradient `linear-gradient(135deg, #1B2238, #2A3354)` + oversized race title H1 (no broken `<img>`) |

#### TC-56-06 Cache hit returns same shape

| Element | Value |
|---------|-------|
| Setup | First GET seeds cache. Wait 1ms. Second GET. |
| Expected | Response identical bytes. p95 < 100ms warm. Redis TTL ~3600s. |

#### TC-56-07 RaceAggregationHelpers.computePodium correctness

| Element | Value |
|---------|-------|
| Setup | 10 rows: 6 M (genderRank 1-6) + 4 F (genderRank 1-4) |
| Action | `computePodium(rows)` |
| Expected | `{ male: [rank1, rank2, rank3 sorted by genderRank ASC then chipTimeMs tie-break, medals gold/silver/bronze], female: [rank1, rank2, rank3] }`. Row 4-6 M + Row 4 F excluded. |

#### TC-56-08 RaceAggregationHelpers.computeNegSplit edge cases

| Element | Value |
|---------|-------|
| Setup A | 0 finishers | Expected `{ value: 0, benchmark: 40, avgFirstHalf: "00:00:00", avgSecondHalf: "00:00:00", deltaSeconds: 0, finishersAnalyzed: 0 }` (no throw) |
| Setup B | All finishers chiptimes JSON empty/null | Expected `finishersAnalyzed: 0`, percent = 0 |
| Setup C | 1 finisher với only Start + Finish (no midpoint) | Expected skip — `finishersAnalyzed` không count |

#### TC-56-09 Race slug not found → 404

| Element | Value |
|---------|-------|
| URL | `/api/race-recap/non-existent-slug` |
| Expected status | 404 |
| Expected body | `{ statusCode: 404, message: "Race not found" }` |

#### TC-56-10 Race exists but no finishers → graceful empty

| Element | Value |
|---------|-------|
| Setup | Race `status='live'`, race_results count = 0 |
| Action | GET recap |
| Expected status | 200 |
| Expected body | `hero.totalFinishers = 0`, `podiums: []`, `paceStats: []`, `negativeSplits: []`, `agBreakdowns: []`, `spotlightStoriesByCourse: []`. No throw. |

#### TC-56-11 spotlightStories order matches podium order

| Element | Value |
|---------|-------|
| Setup | Race với 2 courses [42K, 21K], each có M+F podium |
| Expected | `spotlightStoriesByCourse[0].courseId === podiums[0].courseId`. stories order: [M course1, F course1] then per next course |

#### TC-56-12 Backward compat — old SDK without new fields

| Element | Value |
|---------|-------|
| Setup | Frontend cũ chỉ destructure {hero, podiums, paceStats, negativeSplits, agBreakdowns} |
| Action | Backend returns response WITH new optional fields |
| Expected | Old frontend không throw — new fields ignored. F-046 page (if still cached) render fine. |

#### TC-56-13 XSS protection — spotlightStories markdown sanitize

| Element | Value |
|---------|-------|
| Setup | Admin upsert markdown `"<script>alert(1)</script><p>hi</p>"` |
| Expected | Stored `html` = `"<p>hi</p>"`. Script tag stripped. sanitize-html allowlist (BR-56-23) |

#### TC-56-14 Public endpoint no auth

| Element | Value |
|---------|-------|
| Method | GET `/api/race-recap/ha-giang-discovery-2026` |
| Headers | NO Authorization |
| Expected status | 200 (BR-56-22) |

### 5.2 Frontend E2E Test Cases (Playwright)

| TC | Persona | Journey | Steps | Expected |
|----|---------|---------|-------|----------|
| **E2E-56-01** | Anonymous | Landing recap page desktop | 1. Visit `/giai-chay/ha-giang-discovery-2026/recap` desktop 1440px 2. Verify hero H1 visible above-fold 3. Verify 3 stat ticker render | Hero render <500ms TTFB, H1 oversized, 3 stats mono format |
| **E2E-56-02** | Anonymous | Sticky nav scroll-spy active | 1. Scroll to #pace section 2. Verify pill "Pace" has black bg + white text 3. Scroll to #negsplit, verify pill "Negative Split" active | Active state updates via IntersectionObserver |
| **E2E-56-03** | Anonymous | Mobile responsive 375px | 1. Visit page at 375px viewport 2. Verify hero 380px height 3. Verify H1 fontSize 44pt (not 88pt) 4. Verify podium cards stack 1-col | Stack layout, smaller fonts, hero shorter |
| **E2E-56-04** | Anonymous | SEO meta + JSON-LD preserved | 1. View page-source 2. Verify `<title>` contains race name 3. Verify `<script type="application/ld+json">` Article schema present (F-051 preserved) | Both present |
| **E2E-56-05** | Anonymous | Empty state race no finishers | 1. Visit `/giai-chay/sapa-mountain-marathon-2026/recap` (upcoming) 2. Verify hero renders 3. Verify main content = placeholder "Recap sẽ có khi race kết thúc" | Empty state shown, NO 404 |
| **E2E-56-06** | Anonymous | 404 invalid slug | 1. Visit `/giai-chay/non-existent-2026/recap` | Next.js 404 page |
| **E2E-56-07** | Athlete | CTA navigate to ranking | 1. Visit recap 2. Click "Xem toàn bộ kết quả" CTA 3. Verify URL changed to `/giai-chay/[slug]/ket-qua` | Nav success |
| **E2E-56-08** | Athlete | Share CTA desktop | 1. Click "Chia sẻ" 2. Verify URL copied to clipboard 3. Verify toast "Đã copy link" | Clipboard contains URL, toast shown |
| **E2E-56-09** | Athlete | AG accordion expand | 1. Scroll to #ag 2. Click bracket "Nam 30-39" header chevron 3. Verify Top 5 list expand | List visible with 5 rows |
| **E2E-56-10** | Athlete | City chip render conditional | 1. Verify podium card with city = render chip 2. Verify podium card without city = no chip element (BR-56-21) | Conditional render correct |

### 5.3 Security Checks

- [ ] Public endpoint NO auth — verify 200 with no Authorization header (BR-56-22)
- [ ] Response PII strip — verify NO email/phone/dob in podium cells, hero, AG buckets (F-046 BR-46-15/16 preserved)
- [ ] spotlightStories markdown sanitized — server-side sanitize-html allowlist, `<script>` stripped (BR-56-23, TC-56-13)
- [ ] City field max 80 chars truncate — no injection via subinfo.club bypass length
- [ ] Cache key uses `raceId` (ObjectId) not raceSlug — prevent slug enumeration leak (existing F-046 pattern preserve)
- [ ] No IDOR — endpoint is public + read-only, no cross-tenant concern
- [ ] Race results query filters on `race_id` only — no other field bypass
- [ ] Frontend `dangerouslySetInnerHTML` ONLY for backend-sanitized `insightHtml` + `spotlightStories[].html` — never raw user input

### 5.4 Performance SLA

- [ ] **p95 GET `/api/race-recap/:raceSlug` cold (Redis miss) < 800ms** (BR-56-17)
- [ ] **p95 GET warm (Redis hit) < 100ms** (BR-56-17)
- [ ] **Redis cache hit ratio > 90%** after 1h warmup (race traffic stable)
- [ ] **Concurrent load: 10x parallel requests** same `raceSlug` — SETNX lock prevents thundering herd; verify only 1 actual compute, 9 wait for cache write
- [ ] **Frontend SSR TTFB < 500ms** at edge (Vercel/VPS) p95
- [ ] **Lighthouse Performance score ≥ 90** on desktop + ≥ 80 mobile (Core Web Vitals: LCP < 2.5s, CLS < 0.1, INP < 200ms)
- [ ] **Bundle size impact** — `<StickyRecapNav>` client island < 5KB gzipped

---

## 6 · Answers to Manager's PAUSE Conditions

| PAUSE | Answer | Implemented in |
|-------|--------|----------------|
| **PAUSE-56-01** Variation A as default + only | ✅ A only v1 | BR-56-01, Scope OUT (B/C deferred) |
| **PAUSE-56-02** negSplit benchmark hardcoded 40% VN | ✅ Hardcoded `benchmark: 40` | BR-56-02, helper `computeNegSplit()` returns `benchmark: 40` literal |
| **PAUSE-56-03** spotlightStories optional + auto-gen fallback | ✅ Optional schema field + auto-gen | BR-56-03, BR-56-20, TC-56-04, Scope OUT admin editor |
| **PAUSE-56-04** City derivation chain (nationality → subinfo.club → null) | ✅ Implemented chain | BR-56-04, TC-56-03, RaceAggregationHelpers city resolver |
| **PAUSE-56-05** Hero bannerUrl + gradient fallback | ✅ Gradient if missing | BR-56-05, Field table row 10, E2E-56-04 |
| **PAUSE-56-06** Ship desktop + mobile parallel | ✅ Single responsive page 1 file | BR-56-06, Layout sections 3.2 + 3.3, E2E-56-03 |
| **PAUSE-56-07** Race-level route only v1 | ✅ `/giai-chay/[raceSlug]/recap` only | BR-56-07, route table 3.1, Scope OUT per-course |
| **PAUSE-56-08** Sticky nav = client island | ✅ `<StickyRecapNav>` 'use client' | BR-56-08, Component table 4.5 |

---

## 7 · Files Touch List (for Manager / Coder)

### Backend (5 files modified, 1 new)

| File | Change | LOC est. |
|------|--------|----------|
| `backend/src/modules/race-result/dto/race-recap-response.dto.ts` | EXTEND: 5 optional fields + 2 new DTO classes | +60 |
| `backend/src/modules/race-result/schemas/race-recap-insight.schema.ts` | EXTEND: spotlightStories sub-doc | +20 |
| `backend/src/modules/race-result/services/race-recap.service.ts` | EXTEND: city derivation + negSplit detail compute + spotlight auto-gen, REFACTOR consume helpers | +120 / refactor 80 |
| `backend/src/modules/race-result/utils/race-aggregations.ts` | **NEW** — 5 pure helper functions | +200 |
| `backend/src/modules/race-result/utils/race-aggregations.spec.ts` | **NEW** — unit tests | +300 |
| `backend/src/modules/race-result/services/race-recap.service.spec.ts` | UPDATE: add 14 TCs | +200 |

### Frontend (1 file rewrite, 8 new components)

| File | Change | LOC est. |
|------|--------|----------|
| `frontend/app/(main)/giai-chay/[raceSlug]/recap/page.tsx` | **REWRITE** — Variation A layout, responsive | ~400 |
| `frontend/components/recap/PodiumCard.tsx` | NEW | ~120 |
| `frontend/components/recap/PaceDistributionChart.tsx` | NEW | ~100 |
| `frontend/components/recap/NegSplitBlock.tsx` | NEW | ~140 |
| `frontend/components/recap/AGBreakdownAccordion.tsx` | NEW | ~120 |
| `frontend/components/recap/InsightEditorial.tsx` | NEW | ~80 |
| `frontend/components/recap/SpotlightCards.tsx` | NEW | ~80 |
| `frontend/components/recap/StickyRecapNav.tsx` | NEW (`'use client'`) | ~100 |
| `frontend/lib/race-classifier.ts` | NEW (port F-050) | ~40 |

**Total estimate:** ~2200 LOC (backend ~700, frontend ~1500). Component split keeps each file ≤150 LOC = reviewable.

### Admin
- **NO change** v1 (sub-feature F-056-admin deferred).

---

## 8 · Status + Next Step

**Status:** 🔵 READY

**PRD complete.** All 8 PAUSE-56-* answered. 25 BR-56-XX, 14 TC-56-XX, 10 E2E-56-XX defined. 3 GAPs (city / negSplit details / spotlightStories) specified với DTO + schema + helper + fallback strategy. 5 mandatory tables present (steps + buttons + fields + endpoints + TCs).

**Next:** Danny chạy `/5bib-manager FEATURE-056-race-recap-ui-upgrade` → Manager Plan review.

Manager Plan Review verdict expected:
- ✅ APPROVED nếu Plan match BR-56 + TC-56 + Files Touch List trên.
- 🟡 NEEDS_REVISION nếu Manager đề xuất:
  - Phase 1.5 split `RaceResultService` helper refactor SEPARATE branch (recommend accept — giảm regression risk).
  - Pre-compute negSplit via cron + cache collection nếu p95 cold > 800ms (recommend benchmark first, defer to v1.5 nếu fail SLA).
- 🔴 REJECTED nếu critical PAUSE flag chưa Danny duyệt (city province whitelist false-positive là risk lớn nhất — Manager confirm strategy).
