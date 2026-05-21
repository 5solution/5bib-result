# FEATURE-051 — Implementation Notes

## Decisions taken without re-prompting

1. **Skipped backend mutation.** Manager init said "POTENTIALLY modify athlete-profile.service.ts to add dateCreated". On reading the service I found `lastRaceDate` already exists and `raceHistory[].raceDate` is already returned + DESC-sorted. Deriving `dateCreated = min(raceHistory[].raceDate)` on frontend is zero-risk, zero-LOC backend, and matches data freshness perfectly. **Bonus:** keeps the change at 2 files (well within the 2-3 file scope lock) and means QC has zero backend regression surface.

2. **`dateModified` = `profile.computedAt`** instead of a new "max(synced_at)" backend field. The aggregation service already stamps `computedAt = new Date().toISOString()` on every cache miss / cron tick. Functionally equivalent to "data was last touched at X" for SEO `dateModified` semantics.

3. **OG image uses Next.js built-in `next/og`** — no `@vercel/og` dependency added. Verified via `package.json`: `next: ^16.1.1`, so `import { ImageResponse } from 'next/og'` works out-of-the-box. System sans-serif fallback (no custom font load) — avoids the cold-start latency risk flagged in 00-manager-init.md.

4. **FAQ schema returns `null` when no Q can be answered.** Defensive against Google Rich Results validator rejecting empty `mainEntity[]`. Page renders 2 scripts (Person + BreadcrumbList) instead of 3 in the unlikely zero-data case.

5. **Related-athletes section dropped to Tech Debt.** Backend has no `/related` endpoint. Building one was not in scope-lock (would touch 4 backend files: controller / service / DTO / spec). Logged as `TD-F051-RELATED-ATHLETES`. Internal linking already exists via PR card → race page + race history row → race page, so SEO link graph isn't bare.

6. **Lead paragraph: graceful degradation over false-padding.** When data is sparse (single-DNS athlete) the paragraph shrinks to 38 words instead of inventing filler. This is the right SEO choice — Google ranks honest factual content over padded boilerplate, and any AI search citing a 5BIB profile gets accurate facts only.

## Risks / things QC should watch

- **`<p data-seo="lead">` and `sr-only md:not-sr-only`** — verified Tailwind utility classes exist in app's globals; visual hidden-but-accessible per WAI-ARIA APG. QC: confirm screen-reader reads it on mobile (intended behaviour) and that desktop renders the gray card.
- **OG image fetch failure path** — when backend is down, OG image renders generic "Hồ sơ vận động viên" / `BIB #—` card with `totalRaces: 0`. Better than 500 error which would break social previews. QC may want to confirm via `BACKEND_URL=http://nonexistent npm run dev` smoke.
- **`performerIn[]` URL pattern `/giai-chay/<slug>`** — assumes that route exists (it does, confirmed via grep). If a race slug is missing from `race-results.service` join, `raceSlug` falls back to `raceId` (existing F-047 behaviour), and the URL still resolves to the race detail page.
- **Twitter Card images use absolute URL** to opengraph-image route — Twitter / X crawler fetches the URL fresh, so caching is independent of Next.js metadata cache.

## How to verify locally (smoke)

```bash
# Start frontend
cd frontend && BACKEND_URL=http://localhost:8081 npx next dev -p 3002

# Verify HTML head
curl -s http://localhost:3002/runners/5114-nghiem-thi-anh-thu | grep -E '(canonical|application/ld\+json|twitter:card|og:image)' | head -10

# Verify OG image (should be image/png, ~50-100KB)
curl -sI http://localhost:3002/runners/5114-nghiem-thi-anh-thu/opengraph-image | head -5
curl -s http://localhost:3002/runners/5114-nghiem-thi-anh-thu/opengraph-image -o /tmp/og.png && open /tmp/og.png

# Verify all 3 JSON-LD scripts
curl -s http://localhost:3002/runners/5114-nghiem-thi-anh-thu | grep -c 'application/ld+json'
# Expected: 3 (Person + BreadcrumbList + FAQPage). 2 if FAQ has zero answerable questions.

# Verify lead paragraph in DOM
curl -s http://localhost:3002/runners/5114-nghiem-thi-anh-thu | grep 'data-seo="lead"'
```

## Files NOT touched (defensive scope verification)

- ✅ No backend file modified
- ✅ No DTO modified
- ✅ No Mongoose schema modified
- ✅ No Redis key registry change
- ✅ No new endpoint
- ✅ No `package.json` dependency added (using built-in `next/og`)
- ✅ F-047 baseline behaviour preserved (Person schema fields retained, breadcrumb nav UI unchanged, all 6 page blocks intact)
