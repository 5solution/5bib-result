# FEATURE-036 (SEO subdirectory `/giai-chay/*`): Deploy & Memory Sync

**Status:** ✅ DONE
**Deployed:** 2026-05-18
**Author:** 5bib-manager
**Linked:** `00`, `01`, `02` (amended 2026-05-16), `03`, `04`
**Merge commit:** `91cf876` (Merge PR #6 — `feat/F-036-seo-giai-chay` → `main`)
**Feature commit:** `f348364` feat(F-036): SEO subdirectory routes /giai-chay/*

---

## ⚠️ NUMBER CONFLICT (documented)

**F-036 number được dùng cho 2 features khác nhau, cùng tồn tại trong feature-log:**

| Variant | Date | Branch | Scope | Folder |
|---------|------|--------|-------|--------|
| F-036 (P&L additive) | 2026-05-14 | `fix/F-035-edit-dialog-line-items-width` (commit `a8ad737`) | totalCost = estimated + actual semantic fix | none (bundled with F-035) |
| **F-036 (SEO subdirectory)** | **2026-05-18** | **`feat/F-036-seo-giai-chay` → main via PR #6** | **Programmatic SEO `/giai-chay/*` routes** | **`.5bib-workflow/features/FEATURE-036-seo-subdirectory-giai-chay/`** |

Conflict reason: F-036 number was bumped twice — once when fix/F-035 branch added P&L additive logic (in-flight), again when seo-subdirectory feature was initiated (2026-05-15) by separate Manager flow without checking. By the time conflict was discovered (note in feature-log line 23), both had progressed too far to renumber.

**Resolution:** Keep both as F-036 (different scope, different folders, different commit chains). Future Manager init MUST grep existing feature folders before assigning new number.

---

## 📌 Pre-flight check

- [x] `04-qc-report.md` verdict = ✅ APPROVED (5 phases passed + 30 BR + Manager Amendment 2026-05-16 verified)
- [x] Unit tests 24/24 PASS (slugify 13 + seo-slug-sync.service 11)
- [x] TypeScript clean (FE + BE + Admin 0 errors)
- [x] Scope match: 38 files committed vs Scope Lock amended `02-manager-plan.md` — match (Manager accepted 7-file scope creep for listing dual-source merge 2026-05-16)
- [x] Tech debt 9 items flagged in `04-qc-report.md` — moving to `known-issues.md`

---

## 📊 Deploy summary

- **PR:** [#6](https://github.com/5solution/5bib-result/pull/6) — `feat/F-036-seo-giai-chay` → `main`
- **Merge commit:** `91cf876` (squash/merge type per repo default)
- **Feature commit:** `f348364` (38 files)
- **QC verdict:** ✅ APPROVED with 9 TD non-blocking
- **Unit tests:** 24/24 PASS
- **Backend E2E:** deferred (TD-F036-07 — needs local Mongo+Redis setup)
- **Frontend Playwright:** deferred (TD-F036-08 — `@playwright/test` not installed)
- **Live preview verification:** ✅ DONE (5 routes + sitemap + anti-pattern DOM proofs)

### Merge effect

- `origin/main` advanced from `74960c5` (F-041 GA4) → `91cf876` (F-036 SEO merge)
- CI will trigger DEV deploy on push to main (per `prod_deploy_gap` memory):
  - Backend: `result-dev.5bib.com`
  - Frontend: `result-fe-dev.5bib.com/giai-chay` ← smoke verify
  - Admin: `result-admin-dev.5bib.com/admin/seo` ← trigger UI

### PROD path

After DEV smoke OK → cherry-pick `f348364` to `release/v*` branch → push → CI auto-deploys PROD.

---

## 📝 Memory diff (applied)

### `feature-log.md`
- ✏️ Counter unchanged at `FEATURE-042` (F-042 still INITIATED, F-043 next)
- ➕ Append top: 2026-05-18 FEATURE-036 (SEO) ✅ DEPLOYED entry
- 🚨 Note number conflict with 2026-05-14 F-036 (P&L additive)

### `change-history.md`
- ➕ Append top: full entry — 38 files, scope amendment, 5-gate workflow, dual-source listing, anti-pattern DOM verified, 9 TD items

### `codebase-map.md`
- ✏️ Add backend module: `backend/src/modules/admin-seo/` (admin-seo.controller, admin-seo.module, dto/seo-sync-result.dto)
- ✏️ Add backend services: `races/jobs/seo-slug-sync.cron`, `races/services/seo-slug-sync.service`, `races/utils/slugify`, `races/schemas/seo-sync-log`
- ✏️ Add frontend routes: `app/(main)/giai-chay/{layout,page,[raceSlug]/{page,not-found,ket-qua/page},thanh-pho/[citySlug]/{page,not-found}}` + `app/api/revalidate-giai-chay/route` + `app/sitemap-races.xml/route`
- ✏️ Add frontend lib: `lib/{seo-api,selling-web-url,province-normalize,seo-structured-data}`
- ✏️ Add frontend components: `components/giai-chay/{RaceCard,RaceCTA,CountdownTimer,ResultsTable}`
- ✏️ Add admin: `admin/src/app/(dashboard)/admin/seo/page.tsx`

### `architecture.md`
- ✏️ Add SEO discovery → conversion data flow (Google → 5bib.com/giai-chay/[slug] → selling-web `/vi/events/...?utm_*`)
- ✏️ Add `SeoSlugSyncCron` node under Races domain (weekly Sunday 02:00 GMT+7)
- ✏️ Add cross-app rewrite reference (5Ticket Vercel `/giai-chay/:path*` + `/sitemap-races.xml`)

### `conventions.md`
- (No change) — F-036 reuses existing patterns:
  - F-027 hub Vercel rewrite + `assetPrefix: 'https://result.5bib.com'`
  - F-018/F-019 SETNX anti-stampede pattern
  - F-027 revalidate webhook pattern
  - Existing `@Cron(..., { name: 'X' })` cron registration

### `known-issues.md`
- ➕ Append 9 TD-F036-* entries:
  - TD-F036-01 LOW: Frontend jest infra absent (2 spec excluded from tsc)
  - TD-F036-02 MED: 5Ticket Vercel rewrite coordination post-deploy
  - TD-F036-03 LOW: Results search UI deferred (anti-pattern conservative)
  - TD-F036-04 LOW: Course tabs use full SSR navigation
  - TD-F036-05 LOW: Cron tz hardcoded GMT+7 assumption
  - TD-F036-06 MED: PROD env `FRONTEND_REVALIDATE_GIAICHAY_URL` setup
  - TD-F036-07 MED: Backend admin-seo E2E spec deferred
  - TD-F036-08 MED: Frontend Playwright suite deferred
  - TD-F036-09 HIGH: On-sale internal detail page deferred → FEATURE-037 (already init)

---

## 🔮 Follow-up

### Immediate (Danny next steps)

1. **Forward integration doc** to team dev 5bib (Vercel/Next.js app on 5bib.com domain):
   `docs/INTEGRATION-5bib-giai-chay-rewrite.md` — 3-step hand-off (rewrites + robots.txt + GSC)

2. **Set PROD env:**
   ```
   FRONTEND_REVALIDATE_GIAICHAY_URL=http://5bib-result-frontend:3002/api/revalidate-giai-chay
   ```
   (Backend `REVALIDATE_TOKEN` already exists — reused from F-027)

3. **DEV smoke verify** after CI auto-deploys:
   - `https://result-fe-dev.5bib.com/giai-chay` → 73 cards
   - `https://result-fe-dev.5bib.com/giai-chay/cat-tien-jungle-path-2026` → race landing
   - `https://result-fe-dev.5bib.com/sitemap-races.xml` → XML valid 109 URLs

4. **PROD cherry-pick** to `release/v*` after DEV smoke OK

### Parallel feature

**FEATURE-037** (on-sale race internal detail page) — already initiated in `.5bib-workflow/features/FEATURE-037-on-sale-race-detail-page/`. Pending Danny answer 4 MySQL schema PAUSE Q before BA `/5bib-prd F-037`.

### Branch cleanup

- `feat/F-036-seo-giai-chay` — merged via PR #6, can delete remote branch (local optional)
- `feat/F-042-wip` — local-only commit `ab21227`, NOT pushed. F-042 continues 5-gate workflow on this branch when Danny ready.

### Pattern hardening note

**Number collision incident** (2026-05-14 F-036 P&L vs 2026-05-18 F-036 SEO) — Manager init protocol MUST be updated:
- Before assigning `FEATURE-XXX` number, MUST grep `.5bib-workflow/features/FEATURE-XXX-*` AND scan `feature-log.md` for in-flight/shipped entries with same number
- If collision found → bump to next available number
- Append safety to `5bib-manager` skill protocol

---

## ✅ Status

🎉 **FEATURE-036 (SEO subdirectory `/giai-chay/*`) DONE.**

Memory synced. Merge into main verified at `91cf876`. PROD deploy pending after DEV smoke + team 5bib coordination. F-037 follow-up tracked.
