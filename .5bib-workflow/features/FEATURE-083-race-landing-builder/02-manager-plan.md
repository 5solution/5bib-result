# FEATURE-083: Plan Review — Race Landing Builder (Phase 1 MVP)

**Status:** ✅ APPROVED (with 2 plan adjustments)
**Reviewed:** 2026-06-13
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check
- [x] Đọc `00-manager-init.md` (impact + R-1..R-9 + design reference + decisions).
- [x] Đọc `01-ba-prd.md` toàn bộ (10 section, 25 BR-83, 20 TC-83, endpoint/DTO tables).
- [x] Đọc memory: codebase-map (promo-hub F-027/F-033/F-037), conventions (route ordering, named conn, Base UI Select render-prop, picker collapse), known-issues (TD-F027-PHASE2-16 assetPrefix, F-080 mysql_race_id null).
- [x] **SPOT-CHECK CODE THẬT (MANDATORY)** — xem §"Spot-check findings".

---

## 🔬 Spot-check findings (code thật — defense last-line)

| PRD reference | File:line | Verdict |
|---|---|---|
| race fields title/slug/bannerUrl/brandColor/startDate/courses[]/enable5pix/pixEventUrl | `races/schemas/race.schema.ts:152-189` | ✅ TỒN TẠI |
| mysql race id | `race.schema.ts:150 mysql_race_id?: number\|null` | ✅ (tên thật `mysql_race_id`, KHÔNG `mysqlRaceId`) — **nullable** |
| promo-hub SETNX + sanitize + cache TTL | `promo-hub.service.ts:60,84-90` (`promo-hub-lock:<slug>` 5s, CACHE_TTL 60s, sanitize-html allowlist) | ✅ PLUMBING REUSABLE |
| route ordering slug-before-:id | `promo-hub.controller.ts:75,109,129 (before :id @187)` + comment | ✅ PRECEDENT đúng |
| LogtoAdminGuard admin endpoints | `promo-hub.controller.ts:148,161,188` | ✅ |
| sponsors race endpoint | `sponsors.controller.ts:40 @Get('race/:raceId') → findByRaceId` | ✅ |
| race-results controller | `race-result.controller.ts:80 @Controller('race-results')` | ✅ (controller tồn tại; listing endpoint `?raceId=&course_id=` per CLAUDE.md — Coder verify exact params) |
| nav requireRole pattern | `admin/src/lib/nav-groups.ts:74 requireRole?:"admin"\|...` + Sparkles | ✅ |
| **upload folder prop** | `upload.service.ts:21 key=\`${date}/...\`` | ❌ **KHÔNG honor folder** → ADJUSTMENT #1 |

→ **KHÔNG có lỗi PRD nghiêm trọng.** 2 adjustment (dưới) đưa vào Scope Lock, KHÔNG cần BA re-write.

---

## ✓ PRD Validation Checklist

**Completeness:** [x] US đủ persona (Back-Office/BTC/Visitor/Runner) · [x] 25 BR-83 đánh số testable · [x] PAUSE-83-01..08 đã trả lời (Danny resolved 5pix + builder owner) · [x] UI states đủ (loading/empty/error/success/validation/saving/publish) · [x] Form fields table + Buttons table + Step-by-step table.
**Tech vs codebase:** [x] schema mới greenfield (no migration) · [x] route ordering đúng precedent · [x] cache key `landing:*` khớp pattern `[resource]:[id]` · [x] SDK regen flagged · [x] reuse plumbing promo-hub xác nhận khả thi.
**Security:** [x] LogtoAdminGuard admin · [x] public rate-limit · [x] IDOR tenant · [x] strip `_id→id` + no tenantId/draft.
**Performance:** [x] SLA cụ thể (p95 <300ms cold / <80ms warm, cache>80%) · [x] SETNX anti-stampede · [x] 10x concurrent publish.
**Testability:** [x] 20 TC-83 input/output explicit + 5 E2E + boundary + concurrent.

---

## 📊 Cross-check memory

**Architecture:** Landing module mới = sibling promo-hub. **GIỮ "zero cross-module DI"** (promo-hub fetch race/sponsors/results ở FRONTEND SSR layer). → Backend `landing.service` CHỈ store config + đọc `Race` model (MongooseModule.forFeature, KHÔNG inject RacesService) để seed lúc create. **Auto-data sections (course/sponsors/results) lấy ở FRONTEND SSR** qua public endpoints (`/api/races/slug`, `/api/sponsors/race/:id`, `/api/race-results`). KHÔNG cross-module DI backend.

**Conventions áp dụng:** route ordering literal-trước-`:id` (đã precedent) · Base UI `<Select.Value>{(v)=>LABEL[v]}` render-prop cho dropdown variant/section (VN labels) · UX-PICKER-COLLAPSE cho RaceSearchCombobox (F-024) · atomic findOneAndUpdate cho publish snapshot (chống race) · cache lưu raw + transform-on-read.

**Known-issues liên quan:**
- 🔴 **TD-F027-PHASE2-16 (assetPrefix):** `next.config.ts` set assetPrefix canonical `result.5bib.com` cho cross-app 5Ticket. Subdomain landing same-origin cần assetPrefix RỖNG → **host-conditional assetPrefix** (PAUSE-Coder). Từng gây sự cố DEV/PROD cold-cache.
- 🟡 **F-080 mysql_race_id NULL:** 140/220 race Mongo thiếu `mysql_race_id` → CTA deep-link cần fallback (ADJUSTMENT #2).
- 🟡 `pixEventUrl` comment "mock" → Phase 1 deep-link an toàn (auto-hide nếu empty, BR-83-14); verify data thật trước go-live.

---

## 🔧 2 Plan Adjustments (Manager thêm vào — Coder làm)

**ADJUSTMENT #1 — Upload folder support:** `upload.service.ts` hiện hardcode key `${date}/...`. Thêm optional param `folder?: string` → key = `folder ? \`${folder}/${randomHex}.${ext}\` : \`${date}/...\``. Backward-compat: caller cũ không truyền folder → giữ nguyên `${date}/`. Landing truyền `folder=landing-assets/<landingId>`. `upload.controller.ts` thêm `@Body('folder')` optional. **🛑 PAUSE-Coder: shared upload — verify mọi caller hiện tại không vỡ.**

**ADJUSTMENT #2 — mysql_race_id NULL → CTA behavior (✅ Danny chốt 2026-06-14):** CTA href = **auto-fill** deep-link `https://5bib.com/vi/events/<mysql_race_id>?utm_*` KHI `mysql_race_id` có giá trị; nếu **NULL → ĐỂ TRỐNG** cho admin **nhập URL đăng ký tay** per landing (`ctaButtons.href` editable). **KHÔNG auto-fallback slug** (tránh dẫn link sai). **KHÔNG ẩn** nút. Admin form hiện hint "Auto-điền từ ticketing — sửa nếu cần". Map field thật `mysql_race_id` → `raceRef.mysqlRaceId` trong code.

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ đụng các file/folder sau. Ngoài scope = hỏi Manager.

**Backend — module MỚI `backend/src/modules/landing/`:**
- ➕ `landing.module.ts` (MongooseModule.forFeature RaceLanding + Race read; InjectRedis; KHÔNG inject Races/Sponsors service)
- ➕ `landing.controller.ts` (10 endpoint — route order: `slug/:slug`, `resolve` TRƯỚC `:id`; LogtoAdminGuard admin; public rate-limit)
- ➕ `landing.service.ts` (CRUD + publish snapshot atomic + SETNX `landing-lock` + cache `landing:slug`/`landing:resolve` + section validate-by-type + subdomain unique/reserved + strip public)
- ➕ `schemas/race-landing.schema.ts` (race_landings collection, index unique raceRef.raceId + domain.subdomain sparse)
- ➕ `dto/{create-landing,update-landing,reorder-sections,section,theme,domain,landing-response,public-landing-response}.dto.ts`
- ➕ `constants.ts` (LANDING_SECTION_TYPES, VARIANTS_BY_TYPE, RESERVED_SUBDOMAINS, cache keys/TTL)
- ➕ `landing.service.spec.ts` + `landing.controller.spec.ts` (unit tests)

**Backend — modify (adjustments):**
- ✏️ `upload/upload.service.ts` + `upload/upload.controller.ts` — ADD optional `folder` (ADJUSTMENT #1)
- ✏️ `app.module.ts` — register `LandingModule`
- ✏️ `CLAUDE.md` — Redis registry (`landing:slug`/`landing:resolve`/`landing-lock`/`ratelimit:landing-view`) + S3 lifecycle rule 7 (`landing-assets/` no-expire)

**Frontend — route-group MỚI + components:**
- ➕ `frontend/app/(landing)/layout.tsx` (KHÔNG 5BIB header/footer)
- ➕ `frontend/app/(landing)/l/[slug]/page.tsx` (server fetch + render; preview=draft mode)
- ➕ `frontend/components/landing/RaceLandingRenderer.tsx` + `sections/*` (10 section PREMIUM mới — đạt chuẩn prototypes) + `LandingNav.tsx` + `LandingFooter.tsx` + `LandingTracker.tsx`
- ➕ `frontend/app/api/revalidate-landing/route.ts` (publish → revalidateTag)
- ✏️ `frontend/middleware.ts` — thêm nhánh subdomain landing (sau known-host, loại `/api /_next /l /embed`) → `resolve?host=` → rewrite `/l/<slug>`
- ✏️ `frontend/next.config.ts` — assetPrefix HOST-CONDITIONAL (R-3)

**Admin — builder MỚI:**
- ➕ `admin/src/app/(dashboard)/landing/page.tsx` (list) + `[id]/builder/page.tsx`
- ➕ `admin/src/components/landing/{LandingBuilder,SectionListEditor,SectionConfigForm,ThemePicker,DomainTab,SeoTab,PreviewPane}.tsx`
- ➕ `admin/src/lib/landing-{api,hooks,labels}.ts` (SDK wrap + TanStack + VN dict)
- ✏️ `admin/src/lib/nav-groups.ts` — thêm entry `{id:"landing", href:"/landing", label:"Trang giải chạy", requireRole:"admin"}`
- 🔄 regenerate SDK sau backend DTO (`pnpm generate:api`)

---

## 🔧 Tech approach (đề xuất)
- **Reuse plumbing promo-hub** (copy pattern, KHÔNG import): section-as-subdoc array, SETNX lock retry 3×200ms, sanitize-html cho richtext/customCss, cache raw + transform-on-read.
- **Publish snapshot:** atomic `findOneAndUpdate({_id, publish.version: current}, {$set:{liveSnapshot, version+1, hasUnpublishedChanges:false}})` — chống concurrent publish.
- **Section validate-by-type:** service map `VARIANTS_BY_TYPE[type]` → reject 400 nếu variant sai (BR-83-07).
- **Auto-data ở FRONTEND SSR** (giữ zero-cross-module-DI): renderer section course/sponsors/results gọi public endpoints tại server-component; degrade gracefully nếu fetch fail.
- **Native results (BR-83-13):** component landing fetch `GET /api/race-results?raceId=&course_id=` → render bảng riêng. KHÔNG iframe result.5bib.com (né R-1).
- **Theme:** renderer set `style="--main:..;--sec:.."` ở wrapper → cascade.

---

## 🛑 PAUSE points cho Coder
- 🛑 **upload.service folder** — shared, verify backward-compat mọi caller (ADJUSTMENT #1).
- 🛑 **mysql_race_id NULL** — CTA fallback behavior, confirm Danny (ADJUSTMENT #2).
- 🛑 **next.config assetPrefix host-conditional** (R-3, TD-F027-PHASE2-16) — từng gây sự cố, confirm Manager trước khi đổi.
- 🛑 **middleware.ts** — thứ tự nhánh (sau known-host) + **KHÔNG set cookie scope `.5bib.com`** (R-9 cross-tenant bleed) + loại trừ internal routes.
- 🛑 **KHÔNG cross-module DI backend** — auto-data ở frontend SSR (giữ architecture promo-hub).
- 🛑 **Native results** — verify exact query params `GET /api/race-results` (raceId + course_id) + response shape TRƯỚC khi build component.
- 🛑 **KHÔNG `pnpm install`** dep mới (sanitize-html đã có; template fill-in KHÔNG cần @dnd-kit).
- 🛑 Schema mới greenfield — KHÔNG migration (confirm).

---

## 🧪 Unit test BẮT BUỘC (Coder phải viết — QC check)

`landing.service.spec.ts`:
- [ ] create → seed sections auto (hero/course/sponsors/results enabled) + raceRef đúng (TC-83-01)
- [ ] create dup race → 409 (TC-83-02)
- [ ] subdomain invalid/reserved/dup → 400/400/409 (TC-83-03/04/06)
- [ ] theme hex invalid → 400 (TC-83-05)
- [ ] variant invalid-by-type → 400 (TC-83-07)
- [ ] publish → liveSnapshot = enabled sections + hasUnpublishedChanges=false + cache DEL (TC-83-08)
- [ ] publish thiếu subdomain → 422 (TC-83-09)
- [ ] public strip: `_id→id`, no tenantId/draft, chỉ liveSnapshot (TC-83-10/12)
- [ ] unpublished → public 404 (TC-83-11)
- [ ] concurrent publish (Promise.all) → 1 win, version nhất quán (TC-83-16)
- [ ] resolve host → slug / 404 (TC-83-13)
- [ ] CTA deep-link utm + mysql_race_id NULL fallback (TC-83-19 + ADJUSTMENT #2)
- [ ] boundary subdomain 3 & 43 ký tự (TC-83-20)

DTO validation specs: ThemeDto hex, DomainDto subdomain regex, SectionDto enum.

---

## 📊 Verdict

### ✅ APPROVED — Coder có thể bắt đầu

PRD airtight, mọi reference verify khớp code thật (1 gap upload-folder → đã đưa vào Scope Lock như ADJUSTMENT #1; naming `mysql_race_id` + nullable → ADJUSTMENT #2). Architecture giữ zero-cross-module-DI. Security/perf/test mandates đầy đủ.

**Điều kiện:** Coder tuân Scope Lock + 8 PAUSE points + 2 adjustments. KHÔNG đụng promo-hub module (lean-fork = copy pattern, không sửa F-027). KHÔNG đụng OrderService/fee logic (không liên quan).

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] **Yes** — theo Scope Lock + PAUSE + adjustments. 2 open behavior (mysql_race_id NULL fallback / native results exact params) Coder confirm trong lúc code, không block start.

**Next:** Danny chạy `/5bib-code FEATURE-083-race-landing-builder`.
