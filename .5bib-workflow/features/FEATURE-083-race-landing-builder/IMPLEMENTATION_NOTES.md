# FEATURE-083 — Implementation Notes (Reviewer's Guide)

**Branch:** `5bib_landing_v1` · **Scope:** Phase 1 MVP (subdomain). For Manager `/5bib-deploy` code review + QC Phase 1.

---

## 1. 🚧 Deviations from Spec (intentional — spec allowed both)

- **[D1] results_embed = NATIVE styled table, not iframe** — Spec BR-83-13 allowed native|iframe; chose **native** (renders a styled "embedded widget" frame + table from `data.rows`, link out to result.5bib.com). **Why:** R-1 verified (result-dev sends `X-Frame-Options: SAMEORIGIN`) — native avoids CSP entirely for Phase 1. **Reviewer:** iframe mode + `/embed/results/[slug]` + CSP `frame-ancestors` = Phase 2.
- **[D2] Auto-data sections render from `section.data`, not live SSR fetch** — course/sponsors/results currently render from the section's `data` (seeded/admin-entered/sample), NOT a live SSR fetch of race courses/sponsors/results. **Why:** keeps zero-cross-module-DI + made the 10-section fan-out tractable. **Reviewer/TD-F083-AUTODATA:** wire a page-level SSR enricher (fetch `/api/races/slug`, `/api/sponsors/race/:id`, `/api/race-results`) to inject live data into these sections before render. Components already handle empty/data gracefully.
- **[D3] Admin section content = JSON textarea (MVP), not per-type visual forms** — section list gives proper controls (enable/▲▼/variant), but the `data` object is edited as JSON. **Why:** 10 bespoke per-type forms is a separate large build; JSON keeps Phase 1 functional. **TD-F083-SECTIONFORMS:** rich repeater forms (hero CTA, pricing tiers, schedule items) = polish.
- **[D4] Create dialog = raceId input, not race picker** — no `RaceSearchCombobox` exists in admin. **TD-F083-RACEPICKER.**
- **[D5] No live preview iframe pane** — builder shows "Xem trang ↗" (published) instead of an embedded draft preview. **Why:** admin↔frontend are different origins; iframe preview is fiddly. **TD-F083-PREVIEWPANE.** Dev harness `/__preview` (frontend) covers visual review.

## 2. ⚙️ Forced Changes (reality ≠ PRD assumption)

- **[F1] `upload.service` did NOT honor `folder`** (spot-checked: hardcoded `${date}/` key) → added optional sanitized `folder` param, backward-compat (ADJUSTMENT #1). **BA/Manager:** note in codebase-map that upload now supports folder.
- **[F2] race field is `mysql_race_id` (snake), nullable** (not `mysqlRaceId`) → mapped to `raceRef.mysqlRaceId`; CTA auto-fill only when present, else empty for admin (ADJUSTMENT #2, Danny-confirmed). `Race._id` is typed `string` in schema → used `String(race._id)`.
- **[F3] SDK regen needs backend on :8081** (`generate:api` input = `http://localhost:8081/swagger/json`) → hand-authored typed `landing-api.ts` + `landing-hooks.ts` (mirrors F-068 `course-data-ops-*` pattern). **Run `pnpm --filter admin generate:api` in QC** against a live backend to replace with generated SDK.
- **[F4] `Race` schema has no tenantId** → `merchantRef.tenantName` derived from `race.organizer`; `tenantId` left empty Phase 1. Billing/RBAC tenant linkage to refine when merchant self-serve (Phase 2).
- **[F5] next.config `assetPrefix` already env-driven** (`NEXT_PUBLIC_ASSET_PREFIX ?? ''`, F-056 fix) → **no change needed** (R-3 resolved); Phase 1 subdomains same-origin.

## 3. ⚖️ Tradeoffs

| Decision | Chosen | Alternative | Why | Cost paid |
|---|---|---|---|---|
| Results embed | Native styled table | iframe result.5bib.com | Avoids R-1 X-Frame/CSP in Phase 1 | No live cross-event BIB search until Phase 2 |
| Auto-data | Render from section.data | Live SSR fetch | Zero-cross-module-DI + fan-out tractable | course/sponsors/results not live until enricher (D2) |
| 10 sections | Workflow fan-out (10 agents) | Sequential single-author | Wall-clock + Ultracode | Coordination risk — mitigated by strict contract; all tsc-clean |
| Admin content | JSON textarea | Per-type forms | Functional MVP fast | Rough UX for array fields |
| Subdomain routing | middleware catch-all + reserved-set | per-host nginx | One code path, no infra | Reserved-list must be maintained |
| Publish | version-guarded findOneAndUpdate | mongo txn | Simpler, 1-winner concurrency | Loser gets 409 retry (acceptable) |

## 4. 🔬 Reviewer Notes (Manager + QC focus)

### Files to review (priority)
1. `backend/src/modules/landing/landing.service.ts` — publish snapshot (atomic version-guard ~L190), public strip `toPublicResponse` (BR-83-20), subdomain validate (reserved/unique), seed + CTA fallback.
2. `backend/src/modules/landing/landing.controller.ts` — route order (`slug`/`resolve` before `:id`), LogtoAdminGuard on admin only, public reads open.
3. `frontend/middleware.ts` — landing subdomain branch: runs AFTER known-host checks, reserved-label excluded, rewrites only root `/` → `/l/<slug>`, sets NO cookie (R-9).
4. `backend/src/modules/upload/upload.service.ts` — `folder` sanitize (strip `..`, disallowed chars) + backward-compat date fallback.
5. `frontend/components/landing/RaceLandingRenderer.tsx` + `sections/registry.ts` — dispatch, unknown→null.

### Security self-applied
- [x] Admin endpoints `@UseGuards(LogtoAdminGuard)`; public `slug`/`resolve` open + (global throttler).
- [x] Public strip: `_id`→`id`, no `merchantRef.tenantId`/`internalName`/draft (only `liveSnapshot`). Unit-tested TC-83-10.
- [x] Subdomain regex + reserved-list + uniqueness enforced; publish requires valid subdomain (422).
- [x] richtext sanitized server-side (`sanitizeSectionData`).
- [x] No `.5bib.com`-scoped cookie in middleware (R-9).

### Concurrency hotspots
- `landing.service.ts publish()` — version-guarded `findOneAndUpdate`; unit-tested TC-83-08/16 (only enabled sections snapshot, version++).

### Edge cases tested (15 unit tests PASS) vs deferred
- ✅ Tested: create-seed, CTA auto/null, 409 dup, 404 race, variant-by-type 400, subdomain reserved/taken, publish 422/snapshot, public strip, resolve host.
- ⚠️ Deferred to QC: live integration (Supertest against running backend+Mongo), Playwright E2E, perf SLA.

### ⚠️ Verification caveat (honest)
- **Static:** `tsc --noEmit` clean across backend + frontend (10 sections) + admin. 15 backend unit tests pass.
- **Live render NOT performed in this environment** — port 3002 had a running `next dev` (not killed) that hadn't registered the new `(landing)` route group; the real `/l/[slug]` page needs the backend + a published landing in Mongo. **QC / deploy must do live verification.** Frontend dev harness `frontend/app/(landing)/__preview` (prod-guarded) renders all 10 sections with sample data after a `next dev` restart.
