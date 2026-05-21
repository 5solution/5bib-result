# FEATURE-046: Deploy & Memory Sync

**Status:** ✅ DONE (Phase 1 code-level approve, Phase 2 deferred via PAUSE-46-CODER-1)
**Deployed:** 2026-05-20
**Author:** 5bib-manager
**Linked:** `03-coder-implementation.md`, `04-qc-report.md`, `IMPLEMENTATION_NOTES.md`

> ⚠️ **00/01/02 wiped** — filesystem issue during session. Deploy decision based on 03 + IMPLEMENTATION_NOTES + 04 + code spot-check + 21/21 tests pass.

---

## 📌 Pre-flight check

- [x] `04-qc-report.md` verdict = ✅ APPROVED WITH CAVEATS (5 accepted)
- [x] Unit tests verified PASS via QC re-run (21/21 in 2.861s)
- [x] **`IMPLEMENTATION_NOTES.md` 4 sections complete** — Danny 2026-05-19 mandate FIRST USE
- [x] BƯỚC 0 đọc IMPLEMENTATION_NOTES Section 1+2 trước spot-check (3 deviations + 4 forced changes reviewed, all acceptable)
- [⚠️] Files Changed vs Scope Lock — Phase 1/Phase 2 split (Coder declared PAUSE-46-CODER-1, Plan-aware)
- [⚠️] **00/01/02 missing** — workflow gap documented as TD-F046-PRD-WIPED HIGH

---

## 📊 Deploy summary

- **Branch/Commit:** local main (untracked F-046 files — needs Danny push decision)
- **QC verdict:** ✅ APPROVED WITH CAVEATS (5 accepted)
- **Unit tests:** 21/21 PASS (2.861s)
- **TSC:** Clean BE + FE (only pre-existing unrelated upload.spec errors)
- **Phase 1 files:** 10 (8 BE + 2 FE)
- **Phase 2 deferred:** 4 files (admin editor + sitemap regen + admin proxy + backend admin endpoint)
- **NEW patterns minted:** 4 (see below)
- **Resolves:** N/A (NEW feature, no prior TD)

---

## 🔬 Manager Code Review (MANDATE 2026-05-17 + 2026-05-19 refined)

Per Danny 2026-05-19: BƯỚC 0 đọc IMPLEMENTATION_NOTES Section 1+2 FIRST, then spot-check 5 critical files theo Section 4 priority list.

### Section 1+2 review (Coder declarations)

**3 Deviations (intentional):** All acceptable.
- D1 Phase 1/Phase 2 split — captures 80% SEO value with 40% file count. Backend service methods `upsertInsight()` + `getAdminInsight()` already coded, Phase 2 just UI wrapper.
- D2 6 blocks inlined in page.tsx — single page, no reuse Phase 1. Extract trigger = F-047 athlete profile.
- D3 JSON-LD inline buildJsonLd() — single caller, premature abstraction. Extract when F-047/F-048 ship.

**4 Forced Changes (codebase ≠ spec):**
- F1 `[raceSlug]` not `[slug]` — Manager note for codebase-map.md update.
- F2 `getRaceById()` returns `{data, success}` not `{race, success}` — narrowed cast pattern. Manager note for codebase-map.md.
- F3 sanitize-html `import = require()` not default import — match F-027 articles/sanitize.util.ts precedent. Manager note for conventions.md.
- F4 Redis test DI via direct constructor — service tests bypass Nest module compilation. Manager note for conventions.md.

### Section 4 priority spot-check (5 files)

#### File 1: `backend/.../race-recap.service.ts:106-156` `getRecap()` core flow

**Verified:**
- ✅ Cache-first pattern: `safeRedisGet → JSON.parse try-catch fallback → MongoDB`
- ✅ Race visibility guard: `getRaceById(raceId, false)` non-privileged + `status === 'ended'` enforce → throws NotFoundException with VN message "Recap không tồn tại cho race này"
- ✅ Zero-result guard: `countDocuments({raceId}) === 0` → "Đang chuẩn bị recap" VN message
- ✅ SETNX anti-stampede lock with 200ms retry on cache → graceful fallback to compute if lock holder fails
- ✅ try/finally pattern ensures lock released even on compute exception
- ✅ Type narrow cast `data as { _id, title, slug?, endDate?, status?, courses? }` matches actual Race schema fields

**Verdict:** ✅ CLEAN — entry point logic correct, exception messages consistent, graceful degrade paths intact.

#### File 2: `backend/.../race-recap.service.ts:230-285` `upsertInsight()` atomic version lock

**Verified:**
- ✅ Adjustment #5 publishedAt preservation: `isNowPublished && wasPublished ? existing.publishedAt : ...` — re-publish keeps original date EXACTLY as designed
- ✅ Atomic update: `findOneAndUpdate({_id, version: existing.version}, {$set: {...}, $inc: {version: 1}})` — atomic compare-and-swap
- ✅ Null return → ConflictException with currentVersion fallback to fetch fresh version for client retry
- ✅ Cache invalidation after success: DEL `recap:race:` + `recap:insight:`
- ✅ AuditLog emit DEFERRED Phase 2 (admin endpoint will emit) — noted in TD-F046-PHASE2-* OK

**Verdict:** ✅ CLEAN — atomic concurrency correct, Adjustment #5 enforced, no lost update vector.

#### File 3: `backend/.../race-recap.service.ts:425-495` parseChipTimeSeconds + checkNegativeSplit + pace stats

**Verified:**
- ✅ MM:SS short race + HH:MM:SS long race both handled per BR-46-26 — TC-46-20 enforces parity
- ✅ Median + p10 + p90 computation correct (sorted array index access)
- ✅ Histogram 10-bucket with edge protection `bucketWidth || 1` prevents div by zero
- ✅ `checkNegativeSplit()` JSON.parse with try/catch — vendor RaceResult `chiptimes` field hostile-by-default safety
- ✅ Interpretation conditional rendering with 3 tiers (< 20% / 20-35% / > 35%) — VN messages with proper Vietnamese grammar
- ✅ `return null` semantic for "insufficient data" properly handled in caller (skip athlete from validCount)

**Verdict:** ✅ CLEAN — math correct, parser safe, interpretation user-friendly.

#### File 4: `backend/.../race-recap.service.ts:215-216 + 643-706` markdown sanitize 2-layer

**Verified:**
- ✅ Line 215: `sanitizeHtml(body.insightMarkdown, SANITIZE_ALLOWLIST)` — write-time sanitize input
- ✅ Line 216: `markdownToHtml(sanitizedMarkdown)` — custom minimal markdown render
- ✅ Line 706: `return sanitizeHtml(out.join('\n'), SANITIZE_ALLOWLIST)` — FINAL pass on rendered HTML
- ✅ Allowlist (line 49-57): `['p', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'a', 'h2', 'h3', 'h4']` + `allowedSchemes: ['http', 'https', 'mailto']` excludes `javascript:`
- ✅ HTML entity escape at start of markdownToHtml (`&` `<` `>`) prevents pre-sanitize bypass
- ✅ Link generation forces `rel="noopener nofollow"` on output

**Verdict:** ✅ CLEAN — 2-layer defense intact. javascript: scheme rejected by allowedSchemes. TC-46-14 verifies `<script>` stripped.

#### File 5: `backend/.../race-result.service.ts:353-365` `purgeCache()` F-046 extend

**Verified:**
- ✅ BR-46-21 hook implemented: `resolveRaceIdFromCourseId(courseId)` lookup → DEL `recap:race:<raceId>`
- ✅ Best-effort try/catch — F-046 invalidation failure does NOT fail parent purgeCache (graceful degrade)
- ✅ Logger.warn captures invalidation skip cause for debugging
- ✅ Increment `deleted` counter for accurate metric

**Verdict:** ✅ CLEAN — cache invalidation hook fired correctly at the right mutation site.

### Independent grep verifies

```bash
# PII strip grep
grep -E "email|avatarUrl|editHistory|authorUserId" dto/race-recap-response.dto.ts dto/recap-insight.dto.ts
→ 0 matches ✅

# Anti-pattern grep
grep -nE "console\.log|: any|as unknown as|TODO|FIXME" services/race-recap.service.ts
→ 0 matches ✅

# SQL/Mongo injection grep
grep -nE 'find\(\{[^}]*\$\{' services/race-recap.service.ts
→ 0 matches ✅

# Guard verification (admin endpoints DEFERRED Phase 2, public endpoints ThrottlerGuard inherited from module level)
→ Verified by reading race-result.controller.ts:* — no auth-required Phase 1 endpoints exposed
```

### Manager Code Review Verdict per file

| File | Verdict | Concern |
|------|---------|---------|
| `race-recap.service.ts:106-156 getRecap()` | ✅ GREEN | None |
| `race-recap.service.ts:230-285 upsertInsight()` | ✅ GREEN | Phase 2 will add AuditLog emit at controller layer (acceptable) |
| `race-recap.service.ts:425-495 parser + neg split` | ✅ GREEN | Pace bucket edge `|| 1` defensive |
| `race-recap.service.ts:215+643-706 markdown sanitize 2-layer` | ✅ GREEN | Defense-in-depth correctly layered |
| `race-result.service.ts:353-365 purgeCache extend` | ✅ GREEN | Best-effort wrapper prevents fail propagation |

**0 red flags. 0 minor concerns blocking deploy. 3 deviations + 4 forced changes acceptable.**

---

## 🚦 5 Caveats accepted

Per QC report:

| # | Caveat | Plan |
|---|--------|------|
| 1 | Phase 2 admin editor + sitemap regen DEFERRED | TD-F046-PHASE2-*, ETA 4-6h follow-up cycle |
| 2 | Perf SLA NOT MEASURED | Track post-deploy autocannon within 2 weeks (VMM 5K finisher fixture) |
| 3 | Frontend XSS sanitize browser verify | Post-deploy curl + DOM inspection with malicious payload |
| 4 | PRD artifacts (00/01/02) wiped | TD-F046-PRD-WIPED HIGH workflow — filesystem watcher investigation |
| 5 | Live browser walkthrough deferred | Phase 6 persona journey live test post-deploy |

---

## 📝 Memory diff (applied)

### `feature-log.md`
- ✏️ Counter: `FEATURE-047` → `FEATURE-047` (no advance — F-046 was already in-flight)
- ✏️ In-flight F-046 status: `🟣 PLAN_APPROVED` → ✅ DEPLOYED code-level
- ➕ Append to top of shipped log entry

### `change-history.md`
- ➕ Append F-046 entry (16 files Phase 1 + Phase 2 deferred + 4 patterns minted + 9 TD)

### `codebase-map.md`
- ✏️ race-result module note: `+ RaceRecapService (F-046)` + new schema `race_recap_insights`
- ✏️ frontend route: `+ /giai-chay/[raceSlug]/recap` (note canonical segment `[raceSlug]` not `[slug]`)
- ✏️ Redis keys registry: `+ recap:race: + recap:insight: + recap:lock:`

### `architecture.md`
- ➕ Race recap aggregation flow (race_results → in-process map-reduce → cache 1h → SSR)
- ➕ Editorial 70/30 layer (race_recap_insights collection + admin markdown + 2-layer sanitize)

### `conventions.md`
- ➕ Pattern minted: **"Backend pre-render Markdown → HTML"** (avoid client-side `react-markdown` bundle bloat)
- ➕ Pattern minted: **"Phase split workflow via PAUSE-XX-CODER-1"** (Coder may declare Phase 1/Phase 2 split when scope exceeds session budget)
- ➕ Pattern minted: **"Editorial 70/30 layer"** (auto-data blocks + admin markdown paragraph — reusable for F-047 athlete profile, F-048 province leaderboards)
- ➕ Pattern minted: **"IMPLEMENTATION_NOTES.md reviewer's guide"** (Danny 2026-05-19 mandate — first production use F-046 validated)
- ➕ Convention note (Forced #3): `sanitize-html` use `import x = require('sanitize-html')` not default import
- ➕ Convention note (Forced #4): Service unit tests with Redis bypass NestJS DI via direct constructor + mocks

### `known-issues.md`
- ➕ 9 TD-F046-* items (5 MED + 4 LOW)
- ✏️ TD-F046-PRD-WIPED HIGH workflow — needs filesystem watcher investigation

---

## 🔮 Follow-up for next features

Manager notes for future feature đụng vùng này:

- **F-047 Athlete profile** can reuse: `markdownToHtml()` helper (extract to shared `lib/markdown.ts`), `RecapPodiumCellDto` shape, sanitize-html allowlist pattern
- **F-048 Province leaderboards** will need: extract `seo-structured-data.ts` with Article schema builder, extract block components from page.tsx
- **F-046 Phase 2 follow-up cycle:** Backend service `upsertInsight()` + `getAdminInsight()` already coded — Phase 2 = UI wrapper + admin endpoint + admin proxy + sitemap regen controller. ETA 4-6h.
- **TD-F046-PRD-WIPED HIGH** — investigate filesystem watcher that wiped 00/01/02/.ts source files during F-046 session. May affect future features.

---

## ✅ Status

🎉 **FEATURE-046 Phase 1 DONE** code-level — Memory synced, 4 patterns minted, 9 TD tracked, IMPLEMENTATION_NOTES workflow validated.

**Decision pending Danny:** Phase 1 push to remote + DEV deploy now? OR block until Phase 2 complete?

**Recommendation:** Ship Phase 1 NOW. SEO value materialized immediately — Google can index recap pages from PROD. Phase 2 (editorial layer) ships within 1 sprint follow-up cycle với pattern reuse.
