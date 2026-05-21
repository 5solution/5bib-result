# FEATURE-051 — Coder Implementation Report

**Status:** ✅ READY_FOR_QC
**Coder:** 5bib-fullstack-engineer (Claude)
**Date:** 2026-05-21
**Branch / worktree:** `main` @ worktree `condescending-dewdney-757430`
**PRD ref:** `00-manager-init.md` (no PRD doc — Manager init accepted as scope contract; Danny granted "xử lý đi" direct execution authority)

---

## Files Changed (2 files — within scope lock)

| Path | Type | LOC delta |
|------|------|-----------|
| `frontend/app/(main)/runners/[slug]/page.tsx` | MODIFY | +313 / -25 |
| `frontend/app/(main)/runners/[slug]/opengraph-image.tsx` | NEW | +214 |

**Backend:** zero changes — `dateCreated` is derived on frontend from `min(raceHistory[].raceDate)` and `dateModified` uses existing `profile.computedAt`. No DTO mutation, no service mutation, no schema migration, no new endpoint.

---

## PAUSE Defaults Applied (all 6 accepted)

| ID | Decision |
|----|----------|
| PAUSE-51-01 | Phase 1 **minimal OG** — gradient bg + athlete name + BIB chip + 2 stat chips + brand mark. No race photos (Phase 2). |
| PAUSE-51-02 | **5 Q&A** in FAQ schema — totalRaces breakdown, best PR, race types, last race, AG bracket. Q skipped when underlying data missing (no placeholder answers). |
| PAUSE-51-03 | Lead paragraph **below hero** inside content container. `sr-only md:not-sr-only` — always in DOM for crawlers, hidden mobile to preserve hero focus, visible desktop as factual lede card. |
| PAUSE-51-04 | **vi only** — schema language Vietnamese (gender, sport, location names follow Vietnamese convention). EN Phase 2 deferred. |
| PAUSE-51-05 | **DEFERRED → TD-F051-RELATED-ATHLETES** — backend has no "related athletes by AG" endpoint. Building one was out of scope (would add backend file + DTO + cache key + spec). Logged as Tech Debt. |
| PAUSE-51-06 | `dateModified` = `profile.computedAt` (= last cache refresh / aggregation tick) — practical proxy for `max(synced_at)` without new query. |

---

## Schemas Added

### 1. Person (extended) — `buildPersonSchema()`

Baseline F-047 fields preserved (`name`, `url`, `gender`, `affiliation`, `image`, `award`). F-051 additions:
- `alternateName` — last word of canonical name (VN convention given name)
- `mainEntityOfPage` — canonical URL
- `nationality` — upgraded from string to `{ "@type": "Country", "name": ... }`
- `gender` — upgraded to schema.org URI form (`https://schema.org/Female`)
- `knowsAbout` — sport keywords derived from race history (Running + Trail Running / Marathon / Half Marathon / 5K Road Race / 10K Road Race based on regex match)
- `performerIn[]` — top-10 most-recent races as `SportsEvent` with `name`, `url`, `sport`, `startDate`, `description`
- `dateCreated` — earliest `raceDate` in history (ISO 8601)
- `dateModified` — `profile.computedAt` (ISO 8601)

### 2. BreadcrumbList — `buildBreadcrumbSchema()`

Mirrors visible breadcrumb: Trang chủ → Giải chạy → `<athlete>`. Three `ListItem` entries with `position` 1-3.

### 3. FAQPage — `buildFaqSchema()`

5 auto-generated Q&A. Returns `null` (no script rendered) when zero Q can be answered — defensive against Rich Results validation failure.

---

## AI-Friendly Lead Paragraph

`buildLeadParagraph()` — deterministic template, no LLM calls.

**Rich profile test (94 words — within 80-120 target):**
```
NGHIÊM THỊ ANH THƯ (BIB 5114) là vận động viên Việt Nam đã tham gia 12 giải chạy
trên hệ thống 5BIB từ 2024 đến 2026, chuyên trail running, 5k road race, marathon.
Personal Best Marathon hiện tại 04:12:33 tại giải Ha Giang Discovery Marathon.
Đã hoàn thành 7 giải về đích bao gồm CAT TIEN JUNGLE PATHS 2026, Ha Giang
Discovery Marathon, Những dấu chân Thái Nguyên. Giải gần nhất là CAT TIEN JUNGLE
PATHS 2026 ngày 2026-05-17. Thành viên câu lạc bộ Hanoi Trail Club. Nhóm tuổi
thi đấu hiện tại F35-39.
```

**Sparse profile (38 words):** when only 1 DNS race exists, paragraph honestly degrades — no padding/marketing fluff. Crawler still gets factual citation source.

Mounted as `<p data-seo="lead">` with `sr-only md:not-sr-only` — always in DOM for AI crawlers, visible only desktop (mobile UX preserved per PAUSE-51-03 default).

---

## Dynamic OG Image — `opengraph-image.tsx`

- Next.js 16 file-convention route (auto-registered at `/runners/[slug]/opengraph-image`)
- `runtime = 'edge'`, `size = 1200×630`, `contentType = 'image/png'`
- Uses `next/og` `ImageResponse` (built-in, no @vercel/og dependency)
- System sans-serif fallback (no external font fetch → no cold-start latency penalty)
- Composition: gradient bg (5BIB blue `#1d4ed8` → indigo `#312e81`) + brand mark "5BIB" + tagline "Hồ sơ vận động viên" + BIB chip + large athlete name (truncated to 38 chars to avoid overflow) + 2 stat chips (Tổng giải / Về đích) + URL footer
- Graceful fallback when fetch fails — generic brand card renders (never 500)
- Fetches `/api/race-results/athletes/:slug` with `revalidate: 1800` (matches page cache TTL)

Auto-wired into metadata via explicit `openGraph.images[]` + `twitter.images[]` absolute URLs — Next.js also auto-injects via file convention; explicit declaration keeps Twitter card upgrade visible + crawler-friendly absolute URLs.

---

## Canonical + Twitter Card

- `metadata.alternates.canonical` = `https://5bib.com/runners/<slug>` — prevents duplicate-indexing of www / trailing-slash / query-string variants
- `metadata.openGraph.url` mirrors canonical + adds `siteName: '5BIB'` + `locale: 'vi_VN'`
- `metadata.twitter.card = 'summary_large_image'` — upgrade from default `summary` so the 1200×630 OG renders full-bleed on Twitter / X

---

## Self-Review Pipeline

| Check | Result |
|-------|--------|
| Frontend `npx tsc --noEmit` exit 0 | ✅ (clean — full frontend project compiled) |
| Anti-pattern grep `console.\|: any\b` in modified files | ✅ Only pre-existing F-047 `console.error` in catch blocks (not added by F-051) |
| JSON-LD structure validate | ✅ Person has 12+ fields, BreadcrumbList has 3 items, FAQ has 5 Q&A |
| OG image route accessible (logical) | ✅ Co-located, `runtime = 'edge'`, returns `ImageResponse` |
| Lead paragraph word count 80-120 | ✅ Rich case = 94 words; sparse case honestly degrades to 38 (no padding) |
| Canonical URL format `https://5bib.com/runners/<slug>` | ✅ |
| Files Changed vs Scope Lock (2-3 files) | ✅ Exactly 2 files |

---

## Coordination with F-050

F-050 sibling (Race Ops UX) had **only** `00-manager-init.md` at start of execution — no code yet. F-051 modified the head metadata block + body lead paragraph + 3 JSON-LD scripts, leaving F-050's body regions untouched:
- F-051 owns: `import` block, `generateMetadata()`, 4 schema-builder helpers, JSON-LD `<script>` tags in JSX head, lead `<p data-seo="lead">` block
- F-050 owns: hero pill badge / stats card colours / race history table columns / gun time toggle (when F-050 lands)

If F-050 Coder later edits `page.tsx`, the merge surface is the JSX body — schemas and metadata are additive and self-contained. Section markers used (`F-051 PAUSE-51-03 — AI-friendly lead paragraph`) make rebase straightforward.

---

## Tech Debt logged

- **TD-F051-RELATED-ATHLETES** — backend `GET /api/race-results/athletes/:slug/related?ag=X&limit=5` endpoint needed for internal-linking auto-suggest (PAUSE-51-05). Skipped Phase 1 because scope lock = 2-3 files and backend addition would push to 4+ files. Frontend section + props injection can be added next sprint when backend ships.
- **TD-F051-RICH-OG-PHASE2** — rich OG with race photo collage deferred (PAUSE-51-01) until photo upload populates `athlete_photos` collection at scale.
- **TD-F051-EN-SCHEMA** — bilingual schema (vi+en) deferred (PAUSE-51-04) to next phase.

---

## QC Hand-off

**READY_FOR_QC.** Suggested QC focus areas:
1. Run https://search.google.com/test/rich-results against deployed `/runners/<slug>` URL — expect Person + BreadcrumbList + FAQPage all valid.
2. Curl `GET /runners/<slug>/opengraph-image` → expect HTTP 200 + `Content-Type: image/png` + ~50-80KB PNG response. Verify visual via `open` on macOS.
3. Twitter Card Validator (`https://cards-dev.twitter.com/validator`) — confirm large image renders.
4. Inspect page source: 3 `<script type="application/ld+json">` blocks, 1 `<link rel="canonical">`, 1 `<meta name="twitter:card" content="summary_large_image">`.
5. Lighthouse mobile — verify lead paragraph `sr-only` doesn't trigger a11y warnings; verify TTI < 1.5s no regression.
6. Sparse profile edge case (DNS-only athlete) — confirm FAQ schema does not include null/empty answers (FAQ may degrade to 1-2 Q which is still valid per Schema.org).
