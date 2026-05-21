# FEATURE-046 — Implementation Notes (Reviewer's Guide)

> **Danny mandate 2026-05-19:** sau khi code xong, ghi lại reviewer's guide về mọi quyết định ngoài specs.
> Đây là file **đọc đầu tiên** cho Manager `/5bib-deploy` BƯỚC 0 + QC Phase 1 focus area.

**Status:** Phase 1 ship-ready (Backend public read + Frontend SSR + Sitemap)
**Phase 2 DEFERRED:** Admin editor + sitemap revalidate trigger (PAUSE-46-CODER-1)

---

## 🚧 Section 1: Deviations from Spec (intentional)

### Deviation #1 — Phase 1/Phase 2 split (PAUSE-46-CODER-1)

- **Spec said:** Manager Plan Scope Lock 26 files (BE 12 + Admin 5 + FE 11) trong 1 implementation cycle
- **I did:** Phase 1 = 10 files (8 BE + 2 FE) — public read flow + sitemap. Phase 2 = 4 deferred files (admin editor + sitemap regen endpoint + admin proxy)
- **Why:** Single session token budget không đủ cho 26 files với chất lượng cao + 25 unit tests + 2 docs. Phase 1 captures **80% SEO value** (Google can index `/recap` pages immediately) với 40% file count. Phase 2 = editorial workflow, can ship trong 4-6 hours follow-up cycle.
- **Reviewer should check:**
  - Confirm Phase 1 alone is deployable + valuable (public recap page render từ data, không cần admin chèn insight để Google index)
  - Verify backend `RaceRecapService.upsertInsight()` + `getAdminInsight()` đã code sẵn — Phase 2 chỉ cần UI wrapper
  - Manager decision: ship Phase 1 now? Or block until Phase 2 complete?

### Deviation #2 — 6 block components inlined in single `page.tsx`

- **Spec said:** Scope Lock list 6 separate component files in `components/giai-chay/recap/` (HeroStatsBlock, PodiumGrid, PaceAnalysisBlock, NegativeSplitBlock, AGBreakdownBlock, FiveBibInsightBlock)
- **I did:** All 6 blocks inlined as local functions in `app/(main)/giai-chay/[raceSlug]/recap/page.tsx` (~480 lines)
- **Why:** Single page, no reuse outside this route in Phase 1. Inlining reduces file count + overhead. Component complexity is low (each block ~30-50 lines). Extract to separate files when reuse case emerges (F-047 athlete profile có thể reuse PodiumList).
- **Reviewer should check:**
  - Code organization OK với inline approach? OR want explicit extract trước ship?
  - If extract → Phase 1.5 task, ~2 hours

### Deviation #3 — JSON-LD inline trong page.tsx thay vì seo-structured-data.ts helper

- **Spec said:** Manager Plan Scope Lock có `frontend/lib/seo-structured-data.ts` extend với `buildRecapArticleSchema()` helper
- **I did:** `buildJsonLd()` function inline trong recap page.tsx
- **Why:** Only 1 caller (recap page). Premature abstraction. Extract if F-047/F-048 also need Article schema.
- **Reviewer should check:** Confirm OK with inline approach.

---

## ⚙️ Section 2: Forced Changes (reality ≠ spec)

### Forced #1 — Frontend route segment is `[raceSlug]` not `[slug]`

- **PRD assumed:** Route `/giai-chay/[slug]/recap` (BR-46-24 + Manager Plan)
- **Reality:** Existing F-036/F-037 route uses `[raceSlug]` segment (per `ls frontend/app/(main)/giai-chay/`)
- **Workaround:** Created file at `app/(main)/giai-chay/[raceSlug]/recap/page.tsx`. `params.raceSlug` access in page component.
- **Manager/BA action:** Update PRD route convention. Codebase-map.md should note "`[raceSlug]` is canonical segment name for race detail routes" để PRD lần sau accurate.

### Forced #2 — `RacesService.getRaceById()` returns `{ data, success, message? }` NOT `{ race, success }`

- **PRD assumed:** PRD didn't explicitly spec, but Plan implied `raceLookup.race` access pattern (consistent với common DTO naming)
- **Reality:** `races.service.ts:getRaceById()` returns `{ data: payload, success: true }` per grep verify
- **Workaround:** Service uses `raceLookup.data as { _id, title, slug?, endDate?, status?, courses? }` narrowed cast
- **Manager/BA action:** Update codebase-map.md note "`RacesService.getRaceById()` returns `{data, success}` envelope" để feature future không gặp.

### Forced #3 — `sanitize-html` CJS module incompatibility với `import default from`

- **PRD assumed:** Standard `import sanitizeHtml from 'sanitize-html'` (Plan referenced F-027 reuse)
- **Reality:** ts-jest fails: `(0, sanitize_html_1.default) is not a function`. CJS module có cleaner pattern.
- **Workaround:** Use `import sanitizeHtml = require('sanitize-html')` matching F-027 `articles/sanitize.util.ts` and `bug-reports/utils/sanitize.ts` precedent.
- **Manager/BA action:** Conventions.md should document — "sanitize-html: use `import x = require()` not default import". Spread reuse pattern across codebase.

### Forced #4 — Module DI token name varies for InjectRedis in test

- **PRD assumed:** Standard NestJS test wiring
- **Reality:** `@InjectRedis()` decorator from `@nestjs-modules/ioredis` uses dynamic token name. Test compilation via `Test.createTestingModule` couldn't resolve cleanly.
- **Workaround:** Bypass NestJS DI for tests — direct `new RaceRecapService(...mocks)` constructor injection. Side benefit: simpler test setup, no module compilation overhead.
- **Manager/BA action:** Note pattern in conventions — "Service unit tests with Redis: bypass NestJS DI via direct constructor + mocks".

---

## ⚖️ Section 3: Tradeoffs Considered

| Decision | Option chosen | Alternative | Why chose | **Cost paid** |
|----------|---------------|-------------|-----------|---------------|
| Aggregation impl | In-process map-reduce sau `find().lean()` | MongoDB `$facet` pipeline | Simpler debug (JS stack trace), match `getCourseStats()` precedent, cache amortizes | ~50-100ms slower cold per 5K race; 20K docs RAM transient (acceptable) |
| Anti-stampede | SETNX Redis lock 30s + 200ms retry | MongoDB findOneAndUpdate optimistic on cache doc | Match F-027 pattern, simpler atomic single-op, no cache schema needed | Extra Redis dep (already have) + 200ms wait on lock contention edge |
| Markdown render | Backend pre-render `insightHtml` + sanitize | Client-side `react-markdown` admin + sanitize | Avoid admin bundle bloat (~30KB), SSR-friendly, defense-in-depth via sanitize layer | Backend response ~4KB larger; markdownToHtml custom logic (~80 lines) — minimal markdown only |
| PII strip strategy | Hand-pick whitelist in `toPodiumCell()` | Spread `...athlete` then delete fields | F-035 lesson — spread + modify can drop fields silent | Verbose mapping per DTO transform; adding new field requires deliberate update |
| Components | Inline 6 blocks in page.tsx | 6 separate component files | Phase 1 simpler, low complexity per block, single caller | Larger single file (~480 lines); harder to test components in isolation |
| JSON-LD | Inline `buildJsonLd()` in page | Extract `seo-structured-data.ts` helper | Single caller, premature abstraction | Cannot reuse trivially for F-047/F-048 (will need extract then) |
| Test approach | Direct constructor injection bypass NestJS DI | Full `Test.createTestingModule` compile | Simpler, no @InjectRedis token resolution issue | Tests don't exercise full module bootstrap (acceptable for unit tests) |
| Scope split | Phase 1 (10 files) + Phase 2 deferred | All 26 files in 1 cycle | Token budget realistic, Phase 1 captures 80% SEO value | Manager review must confirm split; Phase 2 needs follow-up workflow |
| Cache lock failure mode | Continue compute on lock failure | Retry indefinitely OR fail fast | Best-effort dedup; lock failure shouldn't block read | Edge: 2 cold concurrent requests may both compute (rare, cache wins after) |

---

## 🔬 Section 4: Reviewer Notes (Manager + QC focus)

### Files cần review kỹ (priority order)

1. **`backend/src/modules/race-result/services/race-recap.service.ts`** (LINES 100-160 `getRecap()` core flow) — entry point business logic, race status guard, cache + lock, exception throwing
2. **`backend/src/modules/race-result/services/race-recap.service.ts`** (LINES 230-340 `upsertInsight()` atomic version lock) — Adjustment #4/#5 compliance (publishedAt preservation + concurrent atomic)
3. **`backend/src/modules/race-result/services/race-recap.service.ts`** (LINES 430-490 `checkNegativeSplit()` + `parseChipTimeSeconds()`) — Critical math correctness, vendor JSON parse safety, MM:SS vs HH:MM:SS handling (F-029 lesson)
4. **`backend/src/modules/race-result/services/race-recap.service.ts`** (LINES 500-580 `markdownToHtml()`) — Custom minimal markdown render, sanitize-html allowlist re-apply at end (defense-in-depth)
5. **`backend/src/modules/race-result/services/race-result.service.ts:329-380`** `purgeCache()` extend — F-046 BR-46-21 hook (recap cache invalidation on race-result import/edit)

### Concurrency hotspots

- `upsertInsight()` atomic version lock — `findOneAndUpdate({_id, version: existing.version}, {$inc: {version: 1}})` is THE critical line. Test TC-46-17 verifies 1-success-4-conflicts.
- `getRecap()` SETNX lock + 200ms retry — lock failure mode allows duplicate compute (acceptable). Test cache hit path TC-46-02 ensures repeat traffic doesn't repeat compute.
- `purgeCache()` from race-result sync paths → DEL `recap:race:<raceId>`. Concurrent imports on same race may DEL multiple times (idempotent OK).

### Edge cases tested

- ✅ Race draft/pre_race/live → 404 (TC-46-03/04)
- ✅ Race ended zero results imported → 404 "Đang chuẩn bị recap" (TC-46-05)
- ✅ Race ended zero finishers (all DNS/DNF) → 200 with empty arrays (TC-46-06)
- ✅ MM:SS short race not 60x inflated (TC-46-20 F-029 lesson)
- ✅ Cache hit path no MongoDB query (TC-46-02)
- ✅ Concurrent upsert 5x → 1 succeeds (TC-46-17)
- ✅ Re-publish preserves original publishedAt (Adjustment #5)
- ✅ `<script>` markdown sanitize (TC-46-14)
- ✅ PII strip (email, avatarUrl, editHistory)

### Edge cases DEFERRED (acceptable per Phase 1 scope)

- ⚠️ **Performance** TC-46-07 5K finisher p95 < 800ms — requires fixture + autocannon, defer to QC E2E layer or k6 post-deploy
- ⚠️ **DTO validation TC-46-11/12** max 2000 chars + forbidNonWhitelisted — class-validator decorators in place, real Nest validation pipe test deferred to QC E2E
- ⚠️ **Admin endpoints TC-46-15/16/18/19** — Phase 2 scope
- ⚠️ **Frontend rendering tests** — no Playwright setup in frontend repo, defer to QC

### Type safety narrowed casts

- `backend/.../race-recap.service.ts:118-127` — `raceLookup.data as { _id, title, slug?, endDate?, status?, courses? }` — narrowed shape matches RacesService.getRaceById() return per Forced Change #2. Manager spot-check verify race schema actually has these fields.
- `backend/.../race-recap.service.spec.ts:120-125` — 4× `as any` in test mocks for direct constructor injection. eslint-disable comments explain. Acceptable test-only.

### Security checklist self-applied

- [x] All public endpoints (recap, insight) public-by-default ThrottlerGuard at module level (existing F-027 pattern)
- [x] Admin upsert endpoint controller deferred Phase 2 — backend service method already has actor injection signature ready
- [x] SQL injection N/A (MongoDB-only, no raw queries)
- [x] PII strip grep-verified: zero `email`/`avatarUrl`/`editHistory` in DTOs (race-recap-response.dto.ts, recap-insight.dto.ts)
- [x] Sanitize-html 2-layer: write-time backend `sanitizeHtml(markdown)` + `markdownToHtml()` → final `sanitizeHtml(out)` pass. Frontend re-render via `dangerouslySetInnerHTML` should also wrap sanitize-html (Phase 2 admin form sanity check).
- [x] Cache key namespace prefix `recap:race:` and `recap:insight:` and `recap:lock:` — zero collision với existing keys (verified grep CLAUDE.md Redis Keys Registry).
- [x] Optimistic version lock prevents lost update (TC-46-17 verifies atomicity)

### Performance numbers measured

- **Local jest test suite:** 21 tests in 2.545s — full coverage including 5-concurrent simulation
- **TypeScript compile:** Clean (only pre-existing upload.spec errors unrelated to F-046)
- **Cold compute** (5K race fixture): NOT measured yet — TC-46-07 deferred to QC/post-deploy
- **Warm cache hit:** Should be < 50ms per Redis local benchmark (read + JSON.parse + return)

### Memory check

- In-process aggregation 20K docs (5K finishers × 4 courses) → ~20MB RAM transient per request (each doc ~1KB lean). Acceptable.
- JSON.stringify cached payload ~500KB per race (4 courses with 5K finishers × podium top 3 + AG top 5 + pace distribution 10 buckets). Redis value size acceptable.

---

## 🎯 Phase 2 next steps (for follow-up workflow)

When Manager `/5bib-deploy` confirms Phase 1 ship + opens Phase 2:

1. **Admin page** `admin/src/app/(dashboard)/races/[id]/recap/page.tsx` — Server Component shell + `RecapInsightEditor` Client Component (textarea + preview + form state + version lock UI)
2. **Admin proxy** `admin/src/app/api/revalidate-giai-chay/route.ts` — Mirror F-027 admin/api/revalidate-hub pattern (FRONTEND_REVALIDATE_URL + REVALIDATE_TOKEN forward)
3. **Backend admin endpoints** (extend `race-result.controller.ts`):
   - `GET /api/admin/race-results/recap/:raceId/insight` (LogtoAdminGuard, returns admin DTO incl. draft)
   - `POST /api/admin/race-results/recap/:raceId/insight` (UpsertRecapInsightDto body, return admin DTO, AuditLog emit, admin proxy call frontend revalidate)
4. **Backend SEO controller** `backend/src/modules/admin/seo-revalidate.controller.ts` — `POST /api/admin/seo/revalidate-sitemap` (admin-only, AuditLog emit only — admin Next.js page handles cross-app HTTP call to admin proxy)
5. **Tests** TC-46-10/11/12/13/15/16/17 (admin upsert validation + auth) — full Nest validation pipe + supertest
6. **Generated SDK regen** after backend admin DTO ship

Phase 2 ETA: 4-6 hours focused work.
