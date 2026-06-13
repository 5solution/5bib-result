# FEATURE-083: Race Landing Page Builder as a Service (F-LP / "RaceLanding")

**Status:** 🟣 PLAN_APPROVED (02-manager-plan.md ✅ APPROVED 2026-06-13)
**Created:** 2026-06-13
**Owner:** Danny
**Type:** NEW_MODULE (lean-fork of F-027 Promo Hub — ~80% reuse)
**Created by:** 5bib-manager

> Nguồn nghiên cứu: fleet 11-agent (`wf_7c2df211-75e`) + Manager spot-check repo thật + memory (codebase-map F-027/F-033/F-037, known-issues TD-F027-*, `research-5bib-saas-whitelabel-strategy.md`).

---

## 🎯 Why this feature

5BIB muốn **bán thêm dịch vụ "trang landing quảng bá giải chạy"** cho BTC/merchant. Mỗi giải có 1 microsite riêng: giới thiệu giải, cung đường, nhà tài trợ, giá vé, lịch trình; nút CTA mua vé deep-link sang 5bib.com; **nhúng** trang kết quả (result.5bib.com) + trang tìm ảnh (5pix); chạy trên **subdomain 5bib** hoặc **tên miền riêng** của BTC; nhúng fanpage + Zalo hỗ trợ.

Giá trị chiến lược: landing là **phễu dẫn vào ticketing** (nguồn revenue txn-fee thật qua `FeeService`) + **live-data moat** (kết quả real-time + ảnh theo BIB mà Webflow/Framer không làm được).

---

## 🧩 Phát hiện then chốt (đổi hẳn effort estimate)

> **CẬP NHẬT QUYẾT ĐỊNH #3 (2026-06-13):** Danny đổi từ "page-builder kéo-thả" → **TEMPLATE FILL-IN**. Bộ section dựng sẵn cố định, BTC chỉ **điền thông tin** (nhiều section **auto-pull từ data giải sẵn có** → BTC gần như không gõ). **KHÔNG drag-drop canvas.** Lý do Danny: kéo-thả "không ổn" cho BTC non-tech. → Còn RẺ + an toàn brand hơn cả page-builder: **BỎ** `PromoHubEditor` @dnd-kit (phần phức tạp nhất), chỉ giữ **renderer + 19 section component + per-section config form** của F-027, wrap trong template cố định + form fill-in.

**F-027 Promo Hub đã có sẵn renderer + thư viện 19 section + per-section config form.** Landing chỉ cần wrap trong template cố định fill-in — **đã có sẵn ~80%:**

| Lớp | Đã tồn tại (verified repo) |
|---|---|
| Admin DnD builder | `admin/src/components/promo-hub/`: `PromoHubEditor.tsx` (@dnd-kit/sortable), `SectionCard.tsx` (sortable), `SectionConfigDialog.tsx` (596 LOC, switch 19 type), `ThemeConfigurator.tsx`, `RichTextEditor.tsx` (TipTap), `PromoHubPreview.tsx`, `PromoHubAnalytics.tsx`, `section-types.ts` (registry 19 type) |
| Public renderer | `frontend/components/hub/PromoHubRenderer.tsx` + `sections/` (19 component) + `PromoHubTracker.tsx` + `internal-urls.ts` |
| Backend | `backend/src/modules/promo-hub/` (schema `promo-hubs` sections[] subdoc 19-enum + 5 DTO + service + controller + SETNX `promo-hub-lock:<slug>` + sanitize-html + LogtoAdminGuard) + `promo-hub-analytics/` (click/view tracking, IP-hash, 90d TTL) |
| Race data plumbing | F-033/F-037 đã add `RaceReadonly` + `OnSaleCourseReadonly` (MySQL `'platform'`) + `races-on-sale` endpoints → đọc giá/cự ly/mô tả giải đã có một phần |
| Host routing | `frontend/middleware.ts` đã host-based rewrite (timing/solution/5solution/5sport → path). **Đây là hook point cho subdomain→race resolution.** |
| Theme | `frontend/app/globals.css:65-68` `--race-brand*` đã wire per-race override |

**19 section hiện có:** Hero, Countdown, RichText, ScheduleTimeline, Sponsors, Faq, ImageGallery, RecentResults, SocialLinks (10 platform **gồm Zalo**), MapEmbed, CtaButtons, PromoBanner, VideoEmbed, Stats, FeaturedRaces, LinkGrid, FormEmbed, Testimonial, RaceCalendar.

→ Phủ ~11-12/14 section một landing giải cần. **Chỉ thiếu 3-4 section mới** (xem Gap).

---

## 🎨 Design Quality Mandate (Danny 2026-06-13)

> Danny feedback: *"Promo Hub khó dùng, chẳng đâu vào đâu"* + Hero phải cấu hình được video/chữ + phải có hiệu ứng đẹp. → Landing BÁN cho khách **KHÔNG kế thừa visual/UX kém của Promo Hub.**

**Tách reuse cho rõ:**
- ✅ **Reuse PLUMBING (vô hình với khách):** config storage + section dispatch theo type + SSR render pipeline + analytics click/view + sanitize-html + SETNX cache. Backend promo-hub tốt → giữ.
- ❌ **KHÔNG reuse VISUALS/EDITOR:** build **thư viện section component MỚI, premium, có animation** (chuẩn Velocity design system + frontend-design skill) + màn admin config **đơn giản & đẹp hơn hẳn** Promo Hub editor.

**Hero = configurable + có hiệu ứng (BR bắt buộc cho PRD):**
- `variant`: `video` | `image` | `text` | `split`
- controls: headline/subhead, media (video URL / ảnh upload), overlay opacity, countdown on/off, 1-2 CTA, **animation preset** (fade-up stagger / Ken Burns / parallax nhẹ)
- MỌI section khác cũng có **variant + motion preset**; **mobile-first**; responsive; reduced-motion aware.

**Hệ quả effort (honest recalibrate):** MVP subdomain ~**3-4 tuần** (thay vì 2-3) do build section premium thay vì xài lại đồ Promo Hub thô. Đáng — đây là sản phẩm bán, chất lượng visual = điểm bán.

**Tác động PAUSE-83-01:** càng nghiêng **lean-fork `landing/` riêng với thư viện section component RIÊNG (premium)** — chỉ reuse backend plumbing của promo-hub, KHÔNG reuse `frontend/components/hub/sections/*` verbatim.

**Design reference (prototype đã dựng + Danny duyệt "đẹp" 2026-06-13):**
- `prototypes/hero-prototype.html` — Hero 4 variant (video/image/text/split) + countdown + animation.
- `prototypes/sections-prototype.html` — Cung đường (auto-GPX/elevation, tab cự ly) + Bảng giá vé (CTA deep-link 5bib.com) + Liên hệ (Zalo/FB chat).
- `prototypes/sections-2-prototype.html` — Kết quả (embed result.5bib.com, top-3 medal, tra cứu BIB) + Tìm ảnh (embed 5pix, BIB search grid) + Lịch trình (timeline) + Nhà tài trợ (tier kim cương/vàng/bạc).
- `prototypes/sections-3-prototype.html` — **Thư viện ảnh & video** (bento grid mixed media, filter ảnh/video, play overlay) + **Lịch trình 2 variant** (Timeline 5BIB-render **HOẶC** Ảnh BTC-upload poster/infographic).
- `prototypes/sections-4-prototype.html` — **Giới thiệu (About)** 3 variant (ảnh phải/trái/số liệu) + **THEME STUDIO** (chọn Màu chính + Màu phụ → re-theme live qua CSS var `--main`/`--sec`, preset + custom color) + responsive.
- `prototypes/landing-full.html` — **TRANG FULL ghép 8 section** + nav dính (đổi nền khi cuộn) + footer "Powered by 5BIB" + nhịp sáng/tối + scroll-reveal. Reference tổng thể (`?cap` = full-page static render mode).

→ **10 section phủ TOÀN BỘ scope** (+ Thư viện ảnh/video + Giới thiệu). **Theme = Màu chính (`--main`) + Màu phụ (`--sec`)** (Danny chốt 2026-06-13 — re-theme toàn trang live, preset + custom hex). Nhiều section có **variant** (Hero 4 / Lịch trình Timeline-Ảnh / About 3). **Responsive mobile-first BẮT BUỘC** (đã verify mobile-full render 402px — mọi section stack 1 cột, nav rút gọn). Đây là **chuẩn chất lượng UI bắt buộc** cho PRD + Coder — section render phải đạt mức này, KHÔNG hạ xuống mức Promo Hub.

---

## 📂 Impact Map

### Module sẽ chạm / tạo

**Backend (`backend/src/modules/`)**
- ➕ `landing/` — **NEW module (lean-fork promo-hub)**: schema `race_landings` (raceRef + merchantRef + domain{} + sections[] + publish snapshot) + controller (admin CRUD/publish/reorder/domain-verify + public `slug`/`resolve?host=` + `tls/check-domain`) + service. **REUSE** section DTO contract + sanitize + SETNX pattern từ promo-hub.
- ✏️ `promo-hub/dto/section.dto.ts` (HOẶC landing riêng) — thêm 3-4 section type mới: `course_showcase`, `pricing_tiers`, `results_embed` (full iframe mode), `photos_embed` (5pix).
- ✏️ `races/` — KHẢ NĂNG cross-module read (course GPX/elevation/sponsors live) → **cân nhắc giữ "zero cross-module DI" của promo-hub** (xem Risk R-DI).
- ✏️ `upload/` — honor `folder` prop cho prefix `landing-assets/` (S3 lifecycle rule mới — xem PAUSE-83-07).

**Frontend (`frontend/`)**
- ➕ `app/(landing)/` — route group MỚI (tách `(main)` để KHÔNG kế thừa Header/Footer 5BIB): `l/[slug]/page.tsx` (canonical) + resolve-by-host.
- ➕ `app/(main)/embed/results/[slug]/page.tsx` — route nhúng kết quả **nhẹ** (strip shell) + CSP `frame-ancestors` allowlist. **KHÔNG iframe thẳng `/races/[slug]`** (bị chặn — R-1).
- ➕ `components/landing/` — `RaceLandingRenderer.tsx` (port PromoHubRenderer) + 3-4 section mới + `LandingTracker.tsx` + `lib/embed/iframe-resize.ts` (auto-height postMessage).
- ✏️ `middleware.ts` — thêm nhánh catch-all (sau known-host checks, loại trừ `/api` `/_next` `/l` `/embed`) → resolve host→landing slug.
- ✏️ `next.config.ts` — ⚠️ `assetPrefix` footgun (R-3): custom domain same-origin cần assetPrefix rỗng — có thể cần build target riêng.

**Admin (`admin/`)**
- ➕ `app/(dashboard)/landing/` — màn config **TEMPLATE FILL-IN**: bộ section CỐ ĐỊNH (accordion/card), mỗi section 1 form + toggle **Hiện/Ẩn** + (optional) nút **▲▼ reorder** — **KHÔNG drag-drop canvas**. **REUSE** `components/promo-hub/SectionConfigDialog` forms + `ThemeConfigurator.tsx` + `RichTextEditor.tsx` (extend cho section mới); **BỎ** `PromoHubEditor.tsx` @dnd-kit. Thêm tab Domain + tab Embeds. Nhiều section auto-fill từ race data (BTC không gõ).
- ✏️ `lib/landing-{api,hooks,labels}.ts` — SDK gen + TanStack hooks + VN dictionary (Display Convention).
- ✏️ `lib/nav-groups.ts` — thêm entry "Trang giải chạy" (clone pattern F-027 promo-hub nav).

**Infra (Phase 2)**
- ➕ `Caddyfile` + docker-compose service + cert volume (Caddy on-demand TLS) + `tls/check-domain` ask-endpoint guardrail.
- ➕ wildcard `*.5bib.com` DNS + cert (Phase 1).

### Endpoint liên quan (mới — đề xuất, BA chốt)
- `GET /api/landings/slug/:slug` (PUBLIC, rate-limit IP) — render data
- `GET /api/landings/resolve?host=` (PUBLIC) — middleware host→slug
- `GET /api/landings/tls/check-domain?host=` (PUBLIC) — Caddy ask guardrail (Phase 2)
- Admin: `POST/PATCH/DELETE /api/landings`, `PATCH /api/landings/:id/reorder`, publish/unpublish, domain verify
- ⚠️ **Route ordering** (NestJS quirk đã ghi conventions §1173): literal `slug/:slug`, `resolve`, `tls/check-domain` khai báo **TRƯỚC** `:id`.

### Schema / DB / Cache
- MongoDB: collection MỚI `race_landings` (1 doc ↔ 1 race, `raceRef.raceId` unique). Tách `publish.liveSnapshot` (frozen) khỏi working draft.
- MySQL `'platform'`: chỉ READ (reuse F-033/F-037 `RaceReadonly`/`OnSaleCourseReadonly`). **KHÔNG** có giá vé per-ticket / checkout (xem R-4).
- Redis: `landing:slug:<slug>` (cache render, TTL ~60s, pattern promo-hub) + `landing-lock:<slug>` (SETNX) + Phase 2 `landing:tls:<host>` (DEL khi detach domain).
- S3: prefix MỚI `landing-assets/` — **lifecycle KHÔNG expire** (CLAUDE.md rule 7, ĐỪNG trộn `result-images/` 24h TTL).

---

## ⚠️ Risk Flags

- 🔴 **[HIGH] R-1 — Embed kết quả bị chặn (ĐÃ VERIFY).** `curl result-dev.5bib.com` → `X-Frame-Options: SAMEORIGIN` + CSP `frame-ancestors 'self'` ⇒ iframe cross-origin **bị chặn**. (`result.5bib.com` prod: HEAD không lộ header → BA/Coder phải `curl -I` GET 1 URL race thật để confirm.) **Bắt buộc** route embed nhẹ riêng `/embed/results/[slug]` + CSP `frame-ancestors` allowlist theo custom domain BTC; KHÔNG iframe `/races/[slug]`.
- 🔴 **[HIGH] R-3 — `assetPrefix` footgun.** Memory TD-F027-PHASE2-16: `next.config` đã set assetPrefix canonical (`result.5bib.com`) cho cross-app 5Ticket. Custom domain same-origin cần assetPrefix RỖNG kẻo asset 404. Có thể cần **separate build target**. F-037 đã từng dính DEV/PROD cold-cache từ vấn đề liên quan.
- 🟡 **[MED] R-DI — phá "zero cross-module DI" của promo-hub.** promo-hub cố tình fetch race/sponsor/result **ở frontend SSR layer**, backend KHÔNG cross-module DI. Nếu landing cần pull live course GPX backend-side → cân nhắc giữ pattern SSR-fetch thay vì inject `RacesService`.
- 🟡 **[MED] R-2 — Caddy `ask` guardrail (Phase 2).** Thiếu = VPS thành cert-mint miễn phí → ban Let's Encrypt rate-limit + đầy disk. `landing:tls:<host>` PHẢI DEL khi revoke/detach domain.
- 🟡 **[MED] R-4 — KHÔNG có data giá vé/checkout trong repo.** Ticketing ở `dapi.5bib.com`/5Ticket ngoài. `pricing_tiers` **nhập tay**, CTA chỉ **deep-link**. Set expectation rõ với BTC: đây là marketing+results landing, KHÔNG phải checkout (đừng hứa early-bird/inventory live).
- 🟡 **[MED] R-5 — 5Pix là third-party.** `5pix.org`=nginx (có vẻ nhúng được), `5pix.vn`=cloudflare. **PHẢI confirm domain nào là product tìm ảnh** + CSP của họ. Fallback = link card.
- 🟢 **[LOW] R-6 — Zalo/FB silent non-render** khi thiếu whitelist domain (Facebook) → admin builder phải hiện cảnh báo "phải khai báo domain". R-9 — cookie KHÔNG scope `.5bib.com` (chống cross-tenant session bleed).

### Reuse-from-memory (giảm risk)
- TD-F027-PHASE2-01..15: nhiều UX polish của promo-hub builder (RaceSearchCombobox thay raw ObjectId, UploadModule thay raw S3 URL, autosave, duplicate, next/image, preview iframe) **trùng đúng** việc landing cần → BA nên gom.
- `ALLOWED_FORM_HOSTS` whitelist (form_embed) = pattern allowlist sẵn cho photos_embed/results_embed.
- `docs/INTEGRATION-5ticket-promo-hub-rewrite.md` = blueprint cross-app rewrite (cho SEO `5bib.com/<...>` nếu cần).
- `research-5bib-saas-whitelabel-strategy.md` = blueprint custom-domain/nginx/pricing. **LƯU Ý:** doc đó là white-label TICKETING đầy đủ (database-per-tenant) — **NẶNG hơn** landing. Landing chỉ lấy phần domain-resolution + nginx multi-domain, **KHÔNG** áp database-per-tenant.

---

## 🚧 PAUSE Conditions — BA phải chốt khi viết PRD

- [x] **PAUSE-83-01 (KIẾN TRÚC) — ✅ RESOLVED (Danny chốt 2026-06-13): TẠO MODULE `landing/` MỚI (lean-fork).** KHÔNG extend `promo-hub`. Module `landing/` riêng, race-scoped + domain-aware. Reuse **backend plumbing** promo-hub (config storage/section dispatch/sanitize/SETNX/cache/analytics) NHƯNG build **thư viện section premium MỚI + admin config template fill-in MỚI** (KHÔNG kế thừa visual/editor Promo Hub — theo Design Quality Mandate). Giữ promo-hub sạch (platform-marketing).
- [ ] **PAUSE-83-02:** Section mới cần build: `course_showcase` (race.courses[] GPX/elevation), `pricing_tiers` (nhập tay + CTA), `photos_embed` (5pix iframe), `results_embed` (full iframe **hay** dùng `recent_results` top-N có sẵn?). Chốt danh sách + ưu tiên.
- [ ] **PAUSE-83-03:** Subdomain Phase 1 format: `<slug>.5bib.com`? slug = race slug hay BTC tự đặt? Trùng slug xử lý sao?
- [ ] **PAUSE-83-04:** Embed kết quả — native (`recent_results` top-N, nhẹ, không CSP) **vs** full iframe `/embed/results/[slug]` (đầy đủ tra cứu BIB, cần CSP allowlist). Chốt cho MVP.
- [ ] **PAUSE-83-05:** 5Pix — confirm `5pix.org` vs `5pix.vn` + cách truyền eventId/raceId vào URL nhúng. (Reuse `race.pixEventUrl` + `enable5pix` đã có.)
- [ ] **PAUSE-83-06:** Quan hệ với `merchantRef` — landing gắn merchant/tenant nào cho billing + RBAC? Self-serve T0/T1 ai được tạo/sửa (admin nội bộ hay merchant portal)?
- [ ] **PAUSE-83-07:** S3 prefix `landing-assets/` lifecycle NO-expire — confirm + thêm CLAUDE.md rule 7.
- [ ] **PAUSE-83-08:** Publish model — versioning/draft snapshot + scheduled publish? (promo-hub hiện serve live doc trực tiếp; landing nên tách snapshot.)

---

## 🎯 Phase boundaries (Danny đã chốt)

- **Phase 1 (MVP — subdomain):** `landing/` module + `race_landings` schema + admin config **template fill-in** (section cố định + form + toggle Hiện/Ẩn, KHÔNG DnD) + 3-4 section mới + public renderer `(landing)` route + middleware subdomain `<slug>.5bib.com` + embed quyết PAUSE-83-04. Hạ tầng: chỉ wildcard `*.5bib.com` cert + DNS. **Monetization: T0 free.**
- **Phase 2 (custom domain + embed nâng cao):** Caddy on-demand TLS + `tls/check-domain` ask + domain verify state machine + full iframe embed + CSP `frame-ancestors` + Zalo/FB widget + 5Pix + analytics GA4/Pixel. **Monetization: T1 Pro (custom domain = paywall).**
- **Phase 3 (managed + scale):** publish versioning + T2 managed clone-tooling + series/annual plan + Cloudflare-for-SaaS nếu >100 domain.

---

## ✅ Sẵn sàng cho `/5bib-prd`?

**Có — với điều kiện** BA trả lời 8 PAUSE-83-* (đặc biệt PAUSE-83-01 kiến trúc + PAUSE-83-04 embed). Manager khuyến nghị PRD **scope Phase 1 trước** (subdomain MVP), Phase 2/3 viết PRD riêng để tránh PRD khổng lồ.

Success criteria (gợi ý cho BA cụ thể hoá thành TC):
- BTC tạo landing trong admin (kéo-thả section), publish lên `<slug>.5bib.com`, render < 500ms cold.
- CTA "Đăng ký" deep-link đúng `5bib.com/...?utm_source=landing`.
- Embed kết quả render được (qua route nhẹ, không bị X-Frame chặn).
- Strip public đúng (`_id`→`id` alias, không leak `merchantRef.tenantId`/draft snapshot — Pre-Deploy Checklist).

---

## 🔗 Next step

Danny chạy: `/5bib-prd FEATURE-083-race-landing-builder` (BA đọc file này + trả lời 8 PAUSE-83-* trước khi viết PRD).
