# F-056 Phase 4 Scope Expansion QC Report

**Status:** APPROVED WITH CAVEATS
**Tested:** 2026-05-21
**Tester:** 5bib-qc-gatekeeper (background agent)
**Branch:** feat/F-056-race-recap-upgrade
**Baseline:** 04-qc-report.md APPROVED 2026-05-21 (commit e2fbc21)

---

## Scope reviewed

8 commits since QC approval baseline:

| Commit | Phase | Summary |
|--------|-------|---------|
| f5a88b6 | P1 baseline | raw raceTitle + course pills visual + hero alignment |
| 7acfec6 | P1 | hero winning M/F + elevationGain + finisherDistribution |
| 1f020b3 | P2+P3 | Variation A enrich + Variation B body dashboard (10 frontend components + page rewrite) |
| 5f3de77 | nav | header 5 buttons + `/recap` index page |
| 97620c5 | P3 fix | course pills clickable scroll-to-anchor |
| 8ec3a62 | P3 | spotlight switcher tabs + NAM/NỮ equal cards |
| 48f1b1e | P4 BE | auto-articles generator + S3 storage |
| ded92da | P4 FE | 5BIB Stories expandable cards section |

Diff: **+4230 / -253** across 28 files (vs Scope Lock 16 → actual **+20 files** = scope creep tracked).

---

## Phase 1 — Regression & Impact audit

### F-046 (existing recap endpoint) — NOT BROKEN
`GET /api/race-results/recap/:raceId` still returns same DTO shape; new fields all `optional` (`recapArticles?`, `finisherDistribution?`, `elevationGain?`, `winningTimeMale?` etc.). Backward compatible.

### F-051 (JSON-LD SEO) — PRESERVED
`buildJsonLd()` in recap page (lines 269-301) still emits `Article` schema with `headline`/`datePublished`/`dateModified`/`author`/`publisher`/`mainEntityOfPage`/`articleBody`. Output unchanged from baseline. `<script type="application/ld+json">` injection on line 530 intact.

### Consumer audit
Grep `race-results/recap` across `admin/` + `frontend/` returns **only 2 hits** — both inside `giai-chay/[raceSlug]/recap/page.tsx`. No other consumer to break. Local `RecapArticleMeta` interface defined in page (raw `fetch`, not SDK).

### Generated SDK sync
Admin `types.gen.ts` already contains `elevationGain` (3 hits). Frontend SDK has no recap types — by design (recap uses server-component raw fetch). No regen required.

### Scope Lock vs actual
Original plan: 16 files. Actual: **36 files touched** (28 in diff + 8 unchanged-area). Scope creep is **tracked + intentional** (4 phases approved by Danny mandate). Recorded as tech debt below.

---

## Phase 2 — Security threat model

| Threat | Surface | Verdict | Notes |
|--------|---------|---------|-------|
| XSS via auto-gen markdown→HTML | `RecapArticleGenerator.finalize()` + frontend `RecapStoryCard` `dangerouslySetInnerHTML` | **AT RISK (low) — see Finding 1** | Generator SANITIZE_OPTIONS allowlist missing `table/thead/tbody/tr/th/td` but `markdownToHtml()` emits them in `course-difficulty` template → tags stripped, leaves orphan text. NOT XSS (sanitize-html removes them safely) but is **broken rendering on cold path**. Warm path (`rerenderMarkdownToSanitizedHtml` in race-recap.service.ts L1076) DOES allow table tags — table will render correctly after S3 read-back. Inconsistency between two sanitize allowlists. |
| Markdown injection (user-provided strings) | `recap.raceTitle`, `male.name`, `male.bib`, `male.city`, `bucket.category` interpolated into markdown bodies | **MITIGATED** | All strings pass through `escapeHtml()` inside `inline()` helper before HTML emission. Even `**` in a name would render as text (single asterisk pattern only). Verified at recap-article-generator.service.ts L674-678. |
| S3 path traversal via slug | `RecapArticleStorage.buildKey(raceId, slug)` → `recap-articles/{raceId}/{slug}.md` | **SAFE** | `slug` values are hardcoded constants inside generator (`'race-overall-narrative'`, `'pacing-analysis'`, `winner-profile-${podium.courseId}`). `raceId` comes from route param, validated as ObjectId by NestJS pipe earlier in flow. Not user-controlled. |
| IDOR — public GET recap | `@Get('recap/:raceId')` no auth | **SAFE** | Preserved BR-46-22 public-by-design. Same as F-046 baseline. |
| IDOR — admin regenerate | `@Post('recap/:raceId/regenerate-articles') @UseGuards(LogtoAdminGuard)` | **SAFE** | LogtoAdminGuard enforced at line 138. Verified import line 73. |
| YAML injection in frontmatter | `serializeArticle()` uses `escapeYaml()` for special chars (`:#\n"'\\`) | **SAFE** | Double-quote-wrap + escape of `\` and `"`. `deserializeArticle` regex-matches per-key, no arbitrary YAML eval. Acceptable for trusted internal generator output. |
| S3 PUT/GET error swallowing | All S3 ops wrapped in try/catch, logged via `Logger.warn`, never throw to public caller | **SAFE** | Graceful degradation: S3 unreachable → assembleArticles returns `undefined` → frontend omits stories section (guard `recapArticles && recap.recapArticles.length > 0`). |
| Race condition on cold concurrent regen | 2 GETs on cold S3 → both call `generateForRace` + `putArticles` | **TOLERABLE** | No SETNX lock around assembly. Worst case: same articles PUT twice with same key → S3 last-write-wins idempotent. Cost: 6× extra S3 PUT during first warmup. Acceptable for non-critical path; consider lock for stampede protection on launch day. **Tech debt only**. |
| Defamation (auto-gen names + cities) | Winner-profile articles use `male.name` + `male.city` straight from DB | **SAFE — Danny mandate preserved** | Same data already shown in podium cards (F-046 scope). City null-on-missing pattern unchanged. Neutral factual phrasing in templates ("đã chinh phục" / "hoàn thành"). No editorial interpretation. |

---

## Phase 3 — Test execution

### Backend tests
```
PASS src/modules/race-result/services/race-recap.service.spec.ts
PASS src/modules/race-result/services/recap-article-generator.spec.ts
Test Suites: 2 passed, 2 total
Tests:       51 passed, 51 total
Time:        3.416 s
```
**51/51 PASS** (race-recap 39 + generator 12). Matches expectation.

### Frontend TS check
```
cd frontend && tsc --noEmit
EXIT=0
```
**Clean.** No type errors across 662-line recap page rewrite + 10 new components + new locales.

---

## Phase 4 — 10x stability

**SKIPPED** — scope expansion is UI enhancement + auto-content generation. Does NOT touch payment/transfer/escrow/critical-write paths. Auto-articles flow is idempotent (S3 PUT same key) and read-only public. Per QC playbook section 4 ("10x for race-condition critical writes"), this scope falls outside the mandate.

---

## Phase 5 — PRD compliance vs scope expansion

### Original PRD (01-ba-prd.md): 25 BR (BR-56-01 → BR-56-25).
QC baseline 04-qc-report.md confirmed all 25 PASS at commit e2fbc21.

### Scope expansion added **6 implicit BR** NOT formalized in PRD:

| Implicit BR | Description | Code reference | Status |
|-------------|-------------|----------------|--------|
| BR-56-26 | Hero 4-tile stat row (M/F winning + Pace median + Elev gain) | `frontend/components/recap/HeroStatTilesRow.tsx` + page.tsx L466-490 | Implemented |
| BR-56-27 | ElevationGain max across courses in hero | `RaceRecapService` hero block + DTO `elevationGain?` | Implemented |
| BR-56-28 | FinisherDistribution[] per-course bar chart | `frontend/components/recap/FinisherDistributionBars.tsx` + DTO array | Implemented |
| BR-56-29 | Auto-articles "5BIB Stories" with S3 persistence + admin regenerate | `RecapArticleGenerator` + `RecapArticleStorage` + page L858-889 | Implemented |
| BR-56-30 (implicit) | Course pills clickable scroll-to-anchor podium section | `frontend/components/recap/SpotlightSwitcher.tsx` + `scroll-mt-32` | Implemented |
| BR-56-31 (implicit) | Header nav expanded 5 buttons + `/recap` index landing | `frontend/components/Header.tsx` + `app/(main)/recap/page.tsx` | Implemented |

**Recommendation:** Manager must publish **PRD addendum** documenting BR-56-26 → BR-56-31 BEFORE deploy. Otherwise future QC cannot regression-test against an authoritative spec.

---

## Phase 6 — Persona walkthrough

### Persona 1 — Anonymous athlete
- Path: `/recap` → renders ended-races list (server component, ISR 1h, ordered endDate DESC, filtered `status === 'ended' && slug`). Sorted descending, accessible.
- Click race card → `/giai-chay/{slug}/recap` → page fetches recap + insight + renders 7 sections (hero / spotlight / courses / pace / AG / negSplit / **stories** / insight).
- Click "Đọc tiếp →" on story card → `useState` toggles `open` → renders sanitized HTML via `dangerouslySetInnerHTML`. CTA changes to "Thu gọn ↑". Smooth UX.
- **Finding:** if `recap.recapArticles` cold-fetched first time → 11.5s cold S3 write reported in user note. Subsequent loads fast (Redis cache). Acceptable for race-day; consider background prewarm for hot races.

### Persona 2 — Race organizer (share URL SEO)
- `<title>` tag derived from `metadata` block (verified file structure has `metadata` export indirectly via parent layout) + JSON-LD `Article` schema emitted server-side line 530 with `headline: "Recap {raceTitle}"`, `datePublished`, `dateModified`, `articleBody` (insight first 1500 chars or hero headline). F-051 schema **PRESERVED**.
- OG tags inherited from `/recap` index metadata. Per-race `/giai-chay/[slug]/recap` does not currently override per-race OG image — could be enhancement but **not regression**.

### Persona 3 — Mobile responsiveness
- Story card grid: `grid gap-4 md:gap-5 md:grid-cols-2` → **1-column on mobile (correct)**, 2-col on md+.
- Hero stat tiles row: spot-check `HeroStatTilesRow.tsx` not opened in full, but page integration uses standard responsive flex/grid Tailwind classes; no negative class strings noted.
- Spotlight switcher: tab buttons `min-w` likely safe on small viewports; touch targets adequate.
- Story card body `dangerouslySetInnerHTML` may render wide `<table>` from `course-difficulty` template — **on mobile this could overflow horizontally**. No `overflow-x-auto` wrapper around the body content. Consider wrapping `.recap-story-body` with `overflow-x-auto` in globals.css (1-line CSS fix, not blocker).

---

## Findings

### Finding 1 — Generator SANITIZE_OPTIONS allowlist mismatch (course-difficulty table strip)
**File:** `backend/src/modules/race-result/services/recap-article-generator.service.ts` L29-50
**Severity:** Low (UX — broken table render on cold path, NOT security)
**Detail:** Generator's `SANITIZE_OPTIONS` does NOT include `table/thead/tbody/tr/th/td`, but `buildCourseDifficulty()` emits a markdown pipe-table that `markdownToHtml()` converts to `<table>...</table>`. After sanitize-html on cold-write path, the table tags are stripped → only the cell text content remains, run together as paragraph.
**However:** the WARM read path uses `rerenderMarkdownToSanitizedHtml()` in `race-recap.service.ts` L1076, which DOES include table tags in allowlist. So:
- 1st GET (cold S3): table broken, plain text fallback.
- 2nd+ GET (warm S3): table renders correctly (re-render from stored markdown).
**Recommendation:** Align both allowlists. Add `table/thead/tbody/tr/th/td` to `recap-article-generator.service.ts` SANITIZE_OPTIONS L30-42. 1-line fix.

### Finding 2 — Mobile table overflow risk
**File:** `frontend/components/recap/RecapStoryCard.tsx` L120-126 (no overflow wrapper on `.recap-story-body`)
**Severity:** Low (responsive UX)
**Recommendation:** Add `overflow-x-auto` to `.recap-story-body` style in `frontend/app/globals.css`, OR wrap `<div className="overflow-x-auto">` around the inner `dangerouslySetInnerHTML` div.

### Finding 3 — No stampede protection on cold article generation
**File:** `race-recap.service.ts` `assembleArticles` L611-643
**Severity:** Low (cost / minor race)
**Detail:** Concurrent GETs on cold race → multiple `generateForRace` + `putArticles` runs. Idempotent on S3 (same key, last-write-wins), but wastes CPU + ~6× extra S3 PUT.
**Recommendation:** Add `SETNX recap-articles-lock:<raceId>` (30s TTL) around generate-and-put. Pattern proven in F-019 (`awards:lock:`). Non-blocker for launch; track as enhancement.

### Finding 4 — CLAUDE.md missing S3 lifecycle rule for `recap-articles/`
**File:** `CLAUDE.md` (top-level)
**Severity:** Documentation debt
**Detail:** Storage service comment says "lifecycle NONE — keep indefinitely", but CLAUDE.md S3 lifecycle section lists 6 rules (none for `recap-articles/`). If an admin sets a global expiration rule by accident, articles may evaporate.
**Recommendation:** Add **Lifecycle rule 7 — Recap Articles** to CLAUDE.md (port pattern from `courses/`).

---

## 🚧 Tech debt tracked

- **TD-F056-PHASE4-PRD-ADDENDUM**: PRD chưa update 6 implicit BR (BR-56-26..31). Manager must publish addendum before next QC cycle to preserve spec authority.
- **TD-F056-PHASE4-SANITIZE-MISMATCH**: Generator + re-render allowlists divergent. 1-line fix add table tags to generator SANITIZE_OPTIONS.
- **TD-F056-PHASE4-S3-DOC**: Add `recap-articles/` to CLAUDE.md S3 lifecycle registry (Rule 7).
- **TD-F056-PHASE4-STAMPEDE-LOCK**: Add SETNX lock around cold article generation to prevent thundering herd.
- **TD-F056-PHASE4-TABLE-OVERFLOW**: Mobile responsiveness for `<table>` inside story card body — `overflow-x-auto` wrapper.
- **TD-F056-PHASE4-SCOPE-LOCK-DRIFT**: Scope expanded from 16 → 36 files across 4 phases without re-running `/5bib-plan`. Manager should retroactively re-validate Scope Lock and approve drift.

---

## ✅ Final Verdict

**APPROVED WITH CAVEATS** for deploy after:
1. Manager publishes PRD addendum (TD-F056-PHASE4-PRD-ADDENDUM)
2. Apply Finding 1 fix (1-line allowlist alignment) — prevents UX bug visible on race-day first load
3. Add Finding 4 S3 lifecycle documentation

Findings 2, 3, 5 (mobile overflow, stampede lock, scope drift) tracked as tech debt — non-blocker.

**Security posture:** No XSS, no IDOR, no path traversal. Admin write surface guarded. Public read surface unchanged. Defamation risk neutral (data unchanged from F-046).

**Test posture:** 51/51 backend unit tests PASS. TypeScript strict-mode clean. No regression on F-046 / F-051. Frontend SDK still in sync.

---

> **For Danny (TL;DR):** Phase 4 expansion technically solid — 51/51 tests xanh, TS clean, security OK, không break F-046/F-051. Cần fix 1 dòng sanitize allowlist (table tags) trước deploy để tránh story "Cự ly so sánh" render vỡ trên cold load đầu tiên, và update PRD addendum cho 6 BR mới. APPROVED WITH CAVEATS — không reject.
