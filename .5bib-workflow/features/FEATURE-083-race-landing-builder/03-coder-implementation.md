# FEATURE-083: Coder Implementation Log

**Status:** 🟠 IN_PROGRESS (backend module done + typecheck clean; tests/SDK/frontend/admin pending)
**Started:** 2026-06-14
**Branch:** `5bib_landing_v1`
**Author:** 5bib-fullstack-engineer
**Linked:** `00`, `01`, `02`

---

## 📌 Pre-flight check
- [x] Đọc `00-manager-init.md` + `01-ba-prd.md` + `02-manager-plan.md` (APPROVED) + memory conventions.
- [x] Đọc code thật Scope Lock refs: promo-hub schema/controller/service/module + create-promo-hub.dto + race.schema + logto-auth index + app.module + upload.service.

## 🔍 Impact Assessment (Phase 1)
- **Backend:** module mới `landing/` greenfield. Mongo collection `race_landings` (2 index: unique raceRef.raceId + status/updatedAt). Reads `Race` model (forFeature) cho create-seed — KHÔNG inject RacesService (zero-cross-module-DI giữ như promo-hub). Redis keys `landing:slug:` / `landing:resolve:` / `landing-lock:` (port F-027 SETNX). KHÔNG migration.
- **DI graph:** LandingModule = Mongoose(RaceLanding+Race) + LogtoAuthModule. Registered app.module sau PromoHubAnalyticsModule.

## ⚠️ Edge Cases Covered
- [x] Race not found → 404; race đã có landing → 409 `LANDING_EXISTS` (BR-83-01).
- [x] mysql_race_id NULL → CTA href `''` để admin nhập tay (ADJUSTMENT #2 — Danny chốt).
- [x] Subdomain invalid/reserved/taken → 400/400/409.
- [x] Variant sai theo type → 400 (BR-83-07 via VARIANTS_BY_TYPE).
- [x] Publish thiếu subdomain → 422; concurrent publish → version-guarded findOneAndUpdate (1 winner, TC-83-16).
- [x] Public strip: liveSnapshot only, `_id→id`, no merchantRef.tenantId/internalName/draft (BR-83-20).
- [x] Redis down → graceful (Optional inject + try/catch + direct-query fallback).

## 🧠 Logic & Architecture
- Lean-fork PATTERN promo-hub (KHÔNG import module): section subdoc array, SETNX lock retry 3×200ms, sanitize-html cho `data.richText`, cache raw JSON + transform-on-read, route-order `slug/:slug`+`resolve` trước `:id`.
- Publish = atomic version-guarded snapshot (`findOneAndUpdate({_id, 'publish.version': cur})`) → freeze enabled sections + meta + theme vào `liveSnapshot`. Public CHỈ đọc liveSnapshot.
- Seed sections từ race data (hero/course/results/sponsors enabled; photos_embed enabled iff enable5pix).

## 💻 Files Changed (backend — done)
- ➕ `backend/src/modules/landing/landing.constants.ts`
- ➕ `backend/src/modules/landing/schemas/race-landing.schema.ts`
- ➕ `backend/src/modules/landing/dto/{section,landing-parts,create-landing,update-landing,reorder-sections,landing-response}.dto.ts`
- ➕ `backend/src/modules/landing/landing.service.ts`
- ➕ `backend/src/modules/landing/landing.controller.ts`
- ➕ `backend/src/modules/landing/landing.module.ts`
- ✏️ `backend/src/modules/app.module.ts` (register LandingModule)
- **Typecheck:** `npx tsc --noEmit` → 0 landing errors. (Pre-existing unrelated: `vi` global in upload.*.spec.ts.)

## ✅ Backend slice DONE (milestone M2)
1. ✅ `landing.service.spec.ts` — **15 tests PASS** (TC-83-01/02/04/06/07/08/09/10/11/13/19 + ADJUSTMENT#2 + 404/empty edges). Jest, mocked models + redis-null graceful path.
2. ✅ ADJUSTMENT #1: `upload.service.ts` + `upload.controller.ts` — optional `folder` param (sanitized, path-traversal-safe, backward-compat: no folder → date prefix). tsc clean.
3. ✅ CLAUDE.md — Redis registry (`landing:slug`/`landing:resolve`/`landing-lock`/`ratelimit:landing-view`) + S3 lifecycle rule 7 (`landing-assets/` no-expire).

## ✅ Frontend M3 DONE
- `app/(landing)/layout.tsx` (no 5BIB chrome) + `landing.css` (tokens scoped `.landing-root` + shared utils + nav + footer) + `l/[slug]/page.tsx` (server fetch `BACKEND_URL/api/landings/slug/:slug` + ISR 60s + generateMetadata) + `__preview/page.tsx` (dev-only harness, 404s in prod).
- `components/landing/`: `types.ts` + `RaceLandingRenderer.tsx` (switch dispatch, unknown→null) + `LandingNav.tsx` (client sticky-solid) + `LandingFooter.tsx` + `sections/registry.ts` + **10 section components** (HeroSection 'use client' countdown/4-variant, AboutSection 3-variant, CourseSection 'use client' tabs+elevation, ScheduleSection timeline/image, PricingSection, ResultsEmbedSection native frame, PhotosEmbedSection 5pix, GallerySection 'use client' bento+filter, SponsorsSection tier/wall, ContactSocialSection Zalo/FB) — each + own `*.module.css`, theme via `var(--main)/var(--sec)`, mobile-responsive. **Built via 10-agent workflow fan-out (`way557kzd`), ports of verified prototypes.**
- `middleware.ts`: subdomain branch `<slug>.5bib.com → /l/<slug>` (catch-all after known hosts, reserved-label excluded, no `.5bib.com` cookie — R-9).
- **next.config.ts: NO change** — `assetPrefix` already env-driven (`NEXT_PUBLIC_ASSET_PREFIX ?? ''`), F-056 fixed; Phase 1 subdomains same-origin. (R-3 resolved.)
- **Verify:** `npx tsc --noEmit` 0 landing errors. Live render needs `next dev` restart to register the new route group (existing :3002 server didn't hot-add it) OR deploy — `/__preview` shows all 10 sections with sample data.

## ⏳ Pending (M4 — Admin)
- SDK regen `pnpm --filter admin generate:api` (needs backend running).
- Admin builder: list + `[id]/builder` + components (section editor + theme picker + domain tab + preview) + `landing-{api,hooks,labels}.ts` + nav-groups entry.
- Then: full self-review pipeline + IMPLEMENTATION_NOTES.md → READY_FOR_QC.

```
PASS src/modules/landing/landing.service.spec.ts
Tests: 15 passed, 15 total
```

## 🛑 PAUSE/Confirmation log
| Date | What | Danny |
|---|---|---|
| 2026-06-14 | Branch `5bib_landing_v1` | ✅ tạo, không push |
| 2026-06-14 | mysql_race_id NULL → CTA | ✅ admin nhập tay (ADJUSTMENT #2) |

## 🚧 Scope creep
- [x] Không — mọi file trong Scope Lock.

## ✅ Status
🟠 **IN_PROGRESS** — backend module foundation hoàn tất + typecheck clean. Chưa READY_FOR_QC (thiếu unit tests + frontend + admin + self-review pipeline). Tiếp tục các turn sau.
