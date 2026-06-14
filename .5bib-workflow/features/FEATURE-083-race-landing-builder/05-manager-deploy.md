# FEATURE-083: Deploy & Memory Sync

**Status:** ✅ DONE
**Deployed:** 2026-06-14
**Author:** 5bib-manager
**Linked:** `00`, `01`, `02`, `03`, `04`, `IMPLEMENTATION_NOTES.md`

---

## 📌 Pre-flight check (Manager)

- [x] `04-qc-report.md` verdict = ✅ APPROVED (full public luồng live-verified E2E vs backend thật + VPS dev Mongo).
- [x] Unit test 15/15 PASS (`landing.service.spec.ts`) — confirmed in `03`.
- [x] File thay đổi khớp Scope Lock `02` (+ 2 ADJUSTMENT đã duyệt: upload `folder` param, mysql_race_id NULL CTA fallback; + dev-only `landing-preview` harness flagged). KHÔNG scope creep.
- [x] `IMPLEMENTATION_NOTES.md` đủ 4 sections (D1-D5 Deviations + F1-F5 Forced + Tradeoffs table + Reviewer Notes).
- [x] BƯỚC 0 — đọc IMPLEMENTATION_NOTES TRƯỚC: 5 deviations đều là spec-allowed choices (native results embed BR-83-13 allowed native|iframe; auto-data render từ `section.data`; JSON content MVP; raceId input; no preview pane) — KHÔNG có deviation nào silently đổi BR critical (auth/strip/publish snapshot intact).

---

## 📊 Deploy summary

- **Branch:** `5bib_landing_v1` (9 commit) → merge `main` → push → CI `build-and-deploy.yml` → DEV.
- **QC verdict:** ✅ APPROVED.
- **Unit tests:** 15/15 (service spec) + `landing.e2e-spec.ts` (401/404/route-order contract; full create→publish gated behind `LANDING_E2E_ADMIN_TOKEN`).
- **Live E2E (QC):** killed Expo squatting :8081, SSH-tunnel VPS dev Mongo, dựng backend thật → 401 guard, 404 VN, seed→`/api/landings/slug/:slug` **strip verified live** (no `_id`/`merchantRef`/`internalName`/`publish`), CTA `events/117`, resolve, cache, frontend `/l/<slug>` render real data + per-race theme `#918d04`, swagger 7 paths + DTOs.
- **Migration:** NONE (greenfield Mongo collection `race_landings`).
- **PROD:** KHÔNG đụng (feature-branch → main = DEV only; release/* không cut).

---

## 🔬 Manager Independent Code Review (MANDATORY — defense last line)

> Đọc code thật + grep-verify từng claim. KHÔNG rubber-stamp Coder/QC/IMPLEMENTATION_NOTES. Ưu tiên theo IMPLEMENTATION_NOTES Section 4.

### 1. `backend/src/modules/landing/landing.service.ts`
- **`toPublicResponse` (L510-525) — BR-83-20 strip:** ✅ GREEN. Dùng **explicit object literal (allowlist)**, KHÔNG spread-and-delete. Chỉ trả `id` (alias `String(_id)`), `raceRef.{raceId,mysqlRaceId,slug}`, `meta`/`theme`/`sections` **từ `publish.liveSnapshot`**, `subdomain`. KHÔNG có `merchantRef`/`internalName`/`publish`/`status`/`createdBy`/`updatedBy`. Sections fallback `snap?.sections ?? []` (rỗng — KHÔNG leak draft sections). An toàn hơn spread-delete vì miss-field = absent, không leak.
- **`publish` (L230-275) — atomic snapshot:** ✅ GREEN. Guard subdomain → 422 `SUBDOMAIN_REQUIRED`; re-validate reserved/unique (defense); `enabled = sections.filter(enabled)`; atomic `findOneAndUpdate({_id, 'publish.version': currentVersion}, {$set: version+1 + liveSnapshot{meta,theme,enabled}})`; null → 409 `PUBLISH_CONFLICT` (VN). 1-winner concurrency (TC-83-16).
- **Cache invalidation:** ✅ GREEN. `invalidate()` fired ở MỌI mutation: `update` (cả old + new subdomain L198-199), `reorderSections` (L226), `publish` (L273), `unpublish` (L282), `softDelete` (L291). `create`(seed) KHÔNG invalidate — đúng (chưa published).
- **Public read cache:** ⚠️ MINOR/ACCEPTED. `findBySlugPublic` cache **stripped public DTO** (không cache raw doc) → lệch Pre-Deploy Checklist rule #4. NHƯNG intentional: khớp forked F-027 pattern, documented CLAUDE.md registry (`landing:slug:` "stores stripped liveSnapshot JSON"), TTL 60s self-heal, và **an toàn hơn** (cache KHÔNG chứa PII). Non-blocking.

### 2. `backend/src/modules/landing/landing.controller.ts`
- ✅ GREEN. Route order: `@Get('slug/:slug')` (L55) + `@Get('resolve')` (L66) **public, KHÔNG guard**, đứng TRƯỚC `@Get(':id')` (L114) → slug không bị `:id` shadow (verified `landing.e2e-spec.ts` route-ordering test). 8 admin endpoint (`@Post`, list, `:id`, update, reorder, publish, unpublish, delete) đều `@UseGuards(LogtoAdminGuard)`.

### 3. `frontend/middleware.ts`
- ✅ GREEN. `landingSub` chỉ derive khi `host.endsWith('.5bib.com')`; `isLandingHost` yêu cầu single-label (`!landingSub.includes('.')`) + `!LANDING_RESERVED.has(landingSub)`; rewrite CHỈ root `/` → `/l/<slug>`. Branch chạy SAU known-host checks. KHÔNG set `.5bib.com`-scoped cookie (R-9) — chỉ đọc `logto_*` cookie cho `/account` auth (existing).

### 4. `backend/src/modules/upload/upload.service.ts`
- ✅ GREEN. `folder` sanitize (L25-28): `.replace(/\.\.+/g,'')` (strip `..`) → `.replace(/[^a-zA-Z0-9._/-]/g,'')` (strip unsafe) → `.replace(/^\/+|\/+$/g,'')` (trim slashes). Path-traversal-safe. Backward-compat: `folder` omitted → `${date}/` prefix (mọi caller cũ không đổi).

### 5. `frontend/components/landing/RaceLandingRenderer.tsx` + `sections/registry.ts`
- ✅ GREEN (verified session as Coder + grep). Switch dispatch theo `section.type` qua `SECTION_COMPONENTS` map; unknown type → `null` (không crash); wrap mỗi section trong `id={anchor ?? type}` cho nav anchor.

### Anti-pattern scan
- ✅ `grep -rE ':any|as unknown as|console.log'` trên `landing/` (loại spec) = **0 hit**. No raw SQL (Mongo only — landing không đụng MySQL platform). Logger dùng cho cache fail path.

### Verdict per-file: **5/5 PASS · 0 red flag · 1 minor accepted (cache-stripped-DTO).** → APPROVED for merge.

---

## 📝 Memory diff (đã apply)

### `feature-log.md`
- In-flight F-083 row → marked ✅ DEPLOYED 2026-06-14. Counter giữ `FEATURE-084` (đã advance lúc init).
- Appended Shipped blockquote `2026-06-14 FEATURE-083 ✅ DEPLOYED`.

### `change-history.md`
- Prepended full entry (NEW_MODULE landing + frontend `(landing)` 10 section + admin builder + middleware + upload folder + CLAUDE registry/S3 rule 7).

### `codebase-map.md`
- ➕ `backend/src/modules/landing/` module (collection `race_landings`, 10 section type, lean-fork F-027). ➕ frontend `app/(landing)` + `components/landing/`. ➕ admin `(dashboard)/landing/` + `lib/landing-*`. ✏️ upload.service `folder` param noted.

### `architecture.md`
- ➕ Section "FEATURE-083 — Race Landing subdomain → SSR → public liveSnapshot flow".

### `conventions.md`
- ➕ Section F-083.1 (lean-fork plumbing without import), F-083.2 (publish snapshot = public source-of-truth), F-083.3 (subdomain catch-all middleware + reserved-set), F-083.4 (allowlist-literal public strip > spread-delete).

### `known-issues.md`
- ➕ 7 TD-F083-* (AUTODATA, SECTIONFORMS, RACEPICKER, PREVIEWPANE, RESULTS-IFRAME-PHASE2, SDK-REGEN, C2-ADMIN-AUTH-WALKTHROUGH-PRE-PROD).

---

## 🔮 Follow-up cho feature kế tiếp (Phase 2)

- **TD-F083-AUTODATA** (HIGH value): page-level SSR enricher fetch `/api/races/slug` + `/api/sponsors/race/:id` + `/api/race-results` → inject live data vào course/sponsors/results sections (components đã handle empty/data).
- **TD-F083-RESULTS-IFRAME-PHASE2:** iframe mode + `/embed/results/[slug]` route + CSP `frame-ancestors` (R-1 deferred).
- **Custom domain Phase 2:** Caddy on-demand TLS — `domain.domainStatus`/`sslStatus` fields đã có chỗ.
- **SDK regen:** chạy `pnpm --filter admin generate:api` vs live backend để thay hand-typed `landing-api.ts`.
- **C2 admin-auth walkthrough:** create→publish UI cần Logto admin login — verify trước khi cut PROD release.

---

## ✅ Status

🎉 **FEATURE-083 DONE** — Manager code review PASS, memory synced, merged `5bib_landing_v1` → main → CI DEV. Phase 1 MVP (subdomain) live trên DEV. Phase 2 (auto-data enricher + iframe results + custom domain) tracked.
