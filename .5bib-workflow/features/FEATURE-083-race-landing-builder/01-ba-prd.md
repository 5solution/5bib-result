# FEATURE-083: PRD — Race Landing Page Builder (Phase 1 MVP / Subdomain)

**Status:** 🔵 READY
**Last updated:** 2026-06-13
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`
**Scope tài liệu này:** **PHASE 1 — MVP subdomain** (custom domain Phase 2 + managed Phase 3 = PRD riêng).

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` đầy đủ (impact map + R-1..R-9 + design reference + decisions + 8 PAUSE-83-*).
- [x] Đã đọc memory: `codebase-map.md` (promo-hub F-027/F-033/F-037 cluster + admin CRUD/SDK + `frontend/middleware.ts` host-rewrite + `globals.css --race-brand*`), `known-issues.md` (TD-F027-PHASE2-01..16 + assetPrefix + ALLOWED_FORM_HOSTS + 5Ticket rewrite).
- [x] Design reference đã verify render: `prototypes/` (hero 4 variant, sections 1-4, landing-full, mobile-full). **Đây là chuẩn UI bắt buộc.**
- [x] Decisions Danny đã chốt (KHÔNG re-litigate): module `landing/` mới (lean-fork) · template fill-in · subdomain Phase 1 · hybrid · theme main+sec · responsive.

---

## 1. Title · Goal · Scope

**Title:** Race Landing Page Builder ("RaceLanding") — Phase 1 MVP.

**Goal:** Cho phép tạo & publish **landing page quảng bá riêng cho từng giải chạy** trên **subdomain `<slug>.5bib.com`**, cấu hình toàn bộ qua admin (template fill-in, không code), với 10 loại section premium + variant + theme (màu chính/phụ) + responsive. Landing là phễu dẫn vào ticketing 5bib.com + nhúng kết quả/ảnh.

### ✅ In scope (Phase 1)
- Backend module `landing/` mới: schema `race_landings` + CRUD + publish/unpublish + section reorder + public read endpoints + S3 upload `landing-assets/`.
- Admin builder (template fill-in): list landing, tạo từ race, cấu hình 10 section + variant + theme picker (main/sec) + SEO + subdomain + preview + publish.
- Public renderer route-group `(landing)` + `RaceLandingRenderer` + 10 section component PREMIUM mới (đạt chuẩn prototype) + responsive mobile-first.
- Subdomain resolution qua `frontend/middleware.ts` (wildcard `*.5bib.com`).
- 10 section: hero, about, course, schedule, pricing, results_embed, photos_embed, gallery, sponsors, contact_social.
- Theme main/sec cascade (CSS var `--main`/`--sec`), preset + custom hex.
- Results embed = **NATIVE mode** (fetch race-results API + render bảng riêng — né R-1 CSP). Photos = **link-card + iframe-with-fallback** sang 5pix.

### ❌ Out of scope (Phase 1 — để Phase 2/3)
- ❌ Custom domain của BTC + Caddy on-demand TLS + domain verification state machine (Phase 2).
- ❌ Results embed mode **iframe** `/embed/results/[slug]` + CSP `frame-ancestors` allowlist (Phase 2 — chỉ cần khi custom domain).
- ❌ Merchant **self-serve** qua merchant portal app (Phase 1 = 5BIB Back-Office Admin dựng hộ trong admin dashboard; self-serve Phase 2).
- ❌ Publish **version history** đầy đủ + scheduled publish cron (Phase 1 = draft + 1 liveSnapshot).
- ❌ Zalo/FB **live SDK** trên custom domain whitelist (Phase 1 = render widget với OA/Page id; whitelist note hiển thị; full verify Phase 2).
- ❌ Drag-drop canvas builder (đã loại — template fill-in).

---

## 2. User Stories & Business Rules

### 2.1 Personas
- **Back-Office Admin** (5BIB internal) — Phase 1 người dựng/cấu hình landing.
- **Race Organizer / BTC** (merchant) — chủ sở hữu giải, người mua dịch vụ (self-serve Phase 2).
- **Anonymous Visitor / Runner** — người xem landing trên subdomain.

### 2.2 User Stories
- US-01: As a **Back-Office Admin**, I want to tạo landing từ 1 race có sẵn, để khởi tạo nhanh với data giải auto-fill.
- US-02: As a **Back-Office Admin**, I want to bật/tắt + sắp xếp + điền nội dung 10 section + chọn variant, để dựng trang đúng nhu cầu BTC mà không cần code.
- US-03: As a **Back-Office Admin**, I want to chọn **màu chính + màu phụ** + preset, để landing đúng brand giải.
- US-04: As a **Back-Office Admin**, I want to đặt **subdomain** + xem preview + publish, để đưa trang lên `<slug>.5bib.com`.
- US-05: As an **Anonymous Visitor**, I want to xem landing đẹp/responsive với cung đường, giá vé, lịch trình, để quyết định đăng ký.
- US-06: As a **Runner**, I want to bấm CTA "Đăng ký" để sang trang bán vé 5bib.com, và tra kết quả/tìm ảnh ngay trên landing.

### 2.3 Business Rules (BR-83-XX)

**Cấu trúc & quan hệ**
- **BR-83-01:** 1 landing ↔ **1 race** (`raceRef.raceId` UNIQUE). Tạo landing thứ 2 cho cùng race → 409 `LANDING_EXISTS`.
- **BR-83-02:** `merchantRef` (tenantId/tenantName) **derive từ race owner** lúc tạo, lưu để billing/RBAC. KHÔNG cho admin sửa tay.
- **BR-83-03:** Khi tạo, hệ thống AUTO seed `meta.title` = race.title, `theme.main` = race.brandColor (nếu có, else `#ea580c`), hero media = race.bannerUrl, và pre-add các section auto-data (hero/course/sponsors/results) ở trạng thái `enabled:true`.

**Section & variant**
- **BR-83-04:** `sections[]` là mảng có thứ tự. Mỗi item: `{ id, type, variant, enabled, order, anchor?, data }`. `type` ∈ 10 enum cố định. Section trùng `type` ĐƯỢC phép (vd 2 gallery), `id` unique trong landing.
- **BR-83-05:** Renderer dispatch theo `type` qua `switch`; `type` unknown → render `null` (forward-compat). `variant` unknown → fallback variant mặc định của type đó.
- **BR-83-06:** `enabled:false` → section KHÔNG render ở public + KHÔNG xuất hiện trong liveSnapshot.
- **BR-83-07:** Variant hợp lệ theo type (validate ở DTO): hero ∈ {video,image,text,split}; about ∈ {image-right,image-left,stats}; schedule ∈ {timeline,image}; sponsors ∈ {tier,wall}; gallery ∈ {bento,grid}. Type khác = single variant `default`.
- **BR-83-08:** Section AUTO-DATA (course/sponsors/results_embed) pull live từ race tại SSR render-time (KHÔNG snapshot cứng data giải) → cập nhật giải tự phản ánh. Section AUTHOR-DATA (about/schedule-timeline/pricing/gallery/contact_social/faq) lưu trong `data`.

**Theme**
- **BR-83-09:** `theme.main` + `theme.sec` là hex `^#[0-9a-fA-F]{6}$`. Renderer set CSS var `--main`/`--sec` ở wrapper landing → cascade toàn bộ section (nút, heading accent, badge, link, biểu đồ, gradient).
- **BR-83-10:** `theme.preset` (vd `velocity-orange`, `trail-green`, `ocean-blue`) = quick-pick set sẵn main+sec; chọn preset ghi đè main/sec; sau đó admin vẫn chỉnh custom được.

**Pricing & CTA (R-4)**
- **BR-83-11:** `pricing.tiers[]` **NHẬP TAY** (repo KHÔNG có giá vé — ticketing ở `dapi.5bib.com`). KHÔNG fetch giá tự động, KHÔNG hứa inventory/early-bird live.
- **BR-83-12:** Mọi CTA "Đăng ký" deep-link ra ngoài: `https://5bib.com/vi/events/<mysqlRaceId>?utm_source=landing&utm_medium=<sectionType>&utm_campaign=<slug>`. `target="_blank" rel="noopener"`. KHÔNG có `<form>` mua vé / `<button onClick>` purchase trên landing (anti-pattern F-037). **CTA source (Danny 2026-06-14):** `ctaButtons[].href` AUTO-FILL từ `mysql_race_id` khi có; nếu `mysql_race_id` NULL → để trống cho **admin nhập URL tay** (KHÔNG auto-fallback slug, KHÔNG ẩn nút). Admin luôn được sửa href.

**Embed (R-1, R-5)**
- **BR-83-13 (Phase 1):** `results_embed` chạy **NATIVE mode**: fetch `/api/race-results?raceId=&course_id=` → render bảng top-N + ô tra cứu BIB BẰNG component landing riêng. **KHÔNG iframe `result.5bib.com/races/[slug]`** (R-1 đã verify: gửi `X-Frame-Options: SAMEORIGIN` + CSP `frame-ancestors 'self'` → bị chặn). `mode:'iframe'` reserved cho Phase 2.
- **BR-83-14:** `photos_embed` Phase 1 = **card + nút "Tìm ảnh theo BIB"** deep-link sang `race.pixEventUrl` (target _blank); tuỳ chọn iframe với fallback link nếu 5pix cho phép. `pixEventUrl` lấy từ race (cần `enable5pix`). Nếu race `enable5pix=false` hoặc thiếu `pixEventUrl` → section auto-hide.
- **BR-83-15:** `contact_social`: Zalo widget cần `zaloOaId`; FB cần `fbPageId`. Admin form hiển thị **cảnh báo**: "FB/Zalo chỉ hiển thị trên domain đã whitelist trong cài đặt OA/App". Thiếu id → ẩn nút tương ứng.

**Domain & publish**
- **BR-83-16 (Phase 1):** `domain.subdomain` = chuỗi `^[a-z0-9](?:[a-z0-9-]{1,40}[a-z0-9])$` (3-42 ký tự, lowercase, không bắt đầu/kết thúc `-`). UNIQUE toàn hệ thống. Default = race.slug (sanitized). Reserved list (`www,admin,result,api,app,merchant,crew,m,mail,...`) → 400 `SUBDOMAIN_RESERVED`.
- **BR-83-17:** Landing public host = `<subdomain>.5bib.com`. `GET /api/landings/resolve?host=` map host→landing slug cho middleware.
- **BR-83-18:** `status`: `draft → published → unpublished/archived`. CHỈ `published` mới phục vụ public. `unpublished` → public trả 404.
- **BR-83-19:** **Publish = snapshot**: copy `{meta,theme,sections(enabled)}` hiện tại vào `publish.liveSnapshot` + set `publishedAt/publishedBy/version++` + `hasUnpublishedChanges=false`. Public CHỈ đọc `liveSnapshot` (KHÔNG đọc draft). Sửa draft sau publish → `hasUnpublishedChanges=true` (UI hiện "Có thay đổi chưa publish").
- **BR-83-20:** Public response strip: inject `id=_id.toString()` rồi loại `_id/__v/createdBy/updatedBy/internalName/merchantRef.tenantId/publish.history` (Pre-Deploy Checklist `_id→id` alias).

**Responsive & display**
- **BR-83-21:** Mobile-first BẮT BUỘC. Breakpoints: mọi grid section → 1 cột ở ≤640px; nav rút gọn (logo + 1 CTA, ẩn link) ở ≤900px; lưới ảnh gallery/photos 2 cột ở ≤760px. (Verify theo `prototypes/mobile-full.png`.)
- **BR-83-22:** Display Convention — mọi enum (status/variant/tier/section type) render qua `admin/src/lib/landing-labels.ts` VN dictionary, KHÔNG raw enum trong JSX text.

**Security**
- **BR-83-23:** Admin endpoints `@UseGuards(LogtoAdminGuard)`. Public `slug/:slug` + `resolve` no-auth + rate-limit IP (port pattern promo-hub `promo-hub-view-rl`).
- **BR-83-24:** IDOR — admin chỉ thao tác landing trong tenant scope của mình (trừ super-admin). `merchantRef.tenantId` so với actor. (Phase 1 Back-Office Admin = full; ghi sẵn guard hook cho Phase 2 merchant self-serve.)
- **BR-83-25:** Anti-stampede: `landing:slug:<slug>` Redis cache (TTL 60s) + `landing-lock:<slug>` SETNX (TTL 5s, retry 3×200ms) — port promo-hub pattern. Cache lưu **liveSnapshot raw**, transform strip khi đọc ra (KHÔNG cache transformed).

---

## 3. UI/UX Flow

### 3.1 Route structure

| Route | App | Access | Mô tả |
|---|---|---|---|
| `/landing` | admin | LogtoAdminGuard | List landing (table) |
| `/landing/[id]/builder` | admin | LogtoAdminGuard | Builder (cấu hình section/theme/domain/preview) |
| `/l/[slug]` | frontend `(landing)` | public | Canonical render landing |
| `<subdomain>.5bib.com/*` | frontend | public | middleware resolve host→slug → rewrite `/l/[slug]` |
| `/l/[slug]?preview=draft` | frontend | (token) | Preview draft từ builder (iframe) |

> **(landing) route-group KHÔNG kế thừa Header/Footer 5BIB** — landing là site tự chứa (nav + footer riêng theo `landing-full.html`).

### 3.2 Admin Screen A — Landing List (`/landing`)

**Header:** tiêu đề "Trang giải chạy" + button "Tạo trang mới" (primary, right).
**Body:** table 6 cột — `Tên giải` | `Subdomain` | `Trạng thái` (badge VN) | `Section bật` | `Cập nhật` | `Hành động` (Sửa / Mở link / Xoá).
**Footer:** pagination (20/trang).

**States:** Loading (skeleton 5 row) · Empty ("Chưa có trang nào" + icon + CTA "Tạo trang mới") · Data · Filtered-empty ("Không khớp filter" + clear) · Error (toast đỏ + retry).

#### UI Step-by-Step — Tạo landing

| # | User action | UI behavior | Trigger | Next state |
|---|---|---|---|---|
| 1 | Click "Tạo trang mới" header `/landing` | Mở dialog "Chọn giải" (RaceSearchCombobox — reuse F-024 pattern) | onClick | Dialog open |
| 2 | Gõ tìm + chọn 1 giải | Combobox collapse → card giải (UX-PICKER-COLLAPSE) + nút "Đổi" | select | `state.raceId` set |
| 3 | Click "Tạo" | POST `/api/landings` `{raceId}`; loading "Đang tạo…" | submit | 201 → navigate `/landing/<id>/builder` |
| 3a | Race đã có landing | Toast đỏ "Giải này đã có trang" (409) | error | Dialog giữ |

### 3.3 Admin Screen B — Builder (`/landing/[id]/builder`)

**Layout:** 2 cột — TRÁI = panel cấu hình (tabs); PHẢI = **live preview iframe** (`/l/[slug]?preview=draft`, refresh on save). Header: tên giải + subdomain chip + badge "Có thay đổi chưa publish" (nếu dirty) + button "Lưu nháp" + button "Publish".

**Tabs panel trái:** `Section` · `Giao diện` (theme) · `SEO` · `Tên miền` (subdomain) · `Nhúng` (embed config).

#### Tab "Section" — template fill-in (KHÔNG drag-drop)
- Danh sách 10 section dạng **accordion card** theo `order`. Mỗi card: icon + tên VN + toggle **Hiện/Ẩn** + nút **▲▼** (đổi thứ tự) + nút "Cấu hình" (mở form).
- Click "Cấu hình" → mở form fields riêng theo type (xem §3.5 Form Fields) + dropdown chọn **variant** (nếu type có variant) + (section auto-data hiển thị "Tự động từ dữ liệu giải", read-only preview).

#### Tab "Giao diện" (Theme)
- **Màu chính** (swatch presets 6 + custom `<input type=color>`) + **Màu phụ** (tương tự) — preview strip live (theo `sections-4-prototype.html`). Chọn **Preset** (dropdown) ghi đè cả 2.
- Font heading/body (dropdown: Be Vietnam Pro / Inter / ...). Hero overlay opacity (slider 0-0.8).

#### Tab "Tên miền"
- Field `subdomain` (input + suffix `.5bib.com`) + validate live (uniqueness check debounced) + trạng thái ✓/✗. (Custom domain tab = disabled với badge "Phase 2".)

#### UI Step-by-Step — Cấu hình + Publish

| # | User action | UI behavior | Trigger | Next state |
|---|---|---|---|---|
| 1 | Toggle "Hiện/Ẩn" section Hero | Card đổi opacity + preview cập nhật | PATCH sections (debounce) | `section.enabled` flip |
| 2 | Click ▲ trên card "Vé" | Section "Vé" đổi chỗ lên trên; order recompute | PATCH `/sections` reorder | order updated |
| 3 | Mở "Cấu hình" Hero → chọn variant "Video nền" | Form hiện field `media` (video URL) + animation preset | onChange | `section.variant='video'` |
| 4 | Tab Giao diện → bấm swatch xanh lá (main) | Preview strip + iframe đổi màu live | setProperty + PATCH theme | `theme.main` updated |
| 5 | Tab Tên miền → gõ subdomain "halong-marathon" | Debounced check uniqueness → ✓ "Khả dụng" | GET check | valid |
| 6 | Click "Lưu nháp" | Toast "Đã lưu" + `hasUnpublishedChanges=true` | PATCH | draft saved |
| 7 | Click "Publish" | Confirm dialog "Đưa trang lên `<sub>.5bib.com`?" → POST publish; loading | POST `/publish` | 200 → toast "Đã publish" + badge clear |
| 7a | Subdomain trống/trùng khi publish | Confirm chặn → toast đỏ "Cần subdomain hợp lệ" (422) | validate | giữ |

**States builder:** Loading (skeleton 2 cột) · Saving (button "Đang lưu…") · Save error (toast + giữ form) · Publish success (toast green) · Publish validation (scroll-to-error: thiếu subdomain / hero tắt) · Preview loading (iframe skeleton).

### 3.4 Public renderer (`/l/[slug]` + subdomain)
- Server Component: fetch `GET /api/landings/slug/:slug` (liveSnapshot strip) → `RaceLandingRenderer` map `sections[]` → component. ISR `revalidate:60` + tag-revalidate trên publish.
- Nav dính (đổi nền khi scroll) + 10 section theo order + footer "Powered by 5BIB". Theme từ `theme.main/sec` → CSS var.
- **States:** Slug không tồn tại / `status≠published` → `notFound()` (404). Section auto-data lỗi fetch → section degrade gracefully (ẩn hoặc empty state), KHÔNG vỡ trang.

### 3.5 Form Fields Specification (per section type — trích yếu)

| Section | Field | UI label | Type | Required | Validation | Error msg | Default |
|---|---|---|---|---|---|---|---|
| hero | `variant` | Kiểu hero | select | ✅ | ∈ video/image/text/split | "Chọn kiểu hero" | image |
| hero | `title` | Tiêu đề | text | ✅ | 1-120 | "Tiêu đề bắt buộc" | race.title |
| hero | `media` | Ảnh/Video nền | url/upload | ⚪ | image≤5MB / video url | "File ≤5MB" | race.bannerUrl |
| hero | `countdownTo` | Đếm ngược tới | datetime | ⚪ | ISO future | "Ngày phải ở tương lai" | race.startDate |
| hero | `ctaButtons[]` | Nút CTA | repeater | ⚪ | label 1-30 + href url | "Link không hợp lệ" | [Đăng ký] |
| about | `variant` | Bố cục | select | ✅ | image-right/left/stats | — | image-right |
| about | `richText` | Nội dung | richtext(sanitized) | ⚪ | ≤5000 char, strip script | — | "" |
| about | `stats[]` | Số liệu | repeater | ⚪ | num+label, ≤6 | — | [] |
| schedule | `variant` | Chế độ | select | ✅ | timeline/image | — | timeline |
| schedule | `items[]` | Mốc lịch trình | repeater | variant=timeline | time+title | "Cần ít nhất 1 mốc" | [] |
| schedule | `image` | Ảnh lịch trình | upload | variant=image | ≤5MB png/jpg | "File ≤5MB" | null |
| pricing | `tiers[]` | Hạng vé | repeater | ✅ | name+price≥0+ctaHref | "Giá ≥ 0" | [] |
| photos_embed | `pixEventUrl` | Link 5pix | url | auto từ race | https only | "Link không hợp lệ" | race.pixEventUrl |
| gallery | `variant` | Kiểu lưới | select | ✅ | bento/grid | — | bento |
| gallery | `items[]` | Ảnh/Video | repeater | ✅ | type image/video + url | "Cần URL" | [] |
| contact_social | `zaloOaId` | Zalo OA ID | text | ⚪ | digits | "OA ID là số" | null |
| contact_social | `fbPageId` | Facebook Page ID | text | ⚪ | digits | "Page ID là số" | null |
| contact_social | `hotline/email/mapEmbed` | … | text/url | ⚪ | email regex / url | VN msg | null |
| theme | `main`/`sec` | Màu chính/phụ | color | ✅ | `^#[0-9a-fA-F]{6}$` | "Mã màu sai" | #ea580c/#1d4ed8 |
| domain | `subdomain` | Subdomain | text | ✅ publish | `^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$` + unique + not-reserved | "Subdomain đã dùng/không hợp lệ" | race.slug |

### 3.6 Buttons Specification (trích yếu)

| Label | Position | Default | Disabled | Loading | Action | Confirm? |
|---|---|---|---|---|---|---|
| Tạo trang mới | List header | Primary | — | Spinner | Mở dialog chọn race | NO |
| Lưu nháp | Builder header | Outline | khi không dirty | "Đang lưu…" | PATCH landing | NO |
| Publish | Builder header | Primary | khi subdomain invalid | "Đang publish…" | POST `/publish` | YES "Đưa lên `<sub>.5bib.com`?" |
| Hiện/Ẩn | Section card | Toggle | — | — | PATCH section.enabled | NO |
| ▲ / ▼ | Section card | Ghost icon | ▲ disabled ở top, ▼ ở bottom | — | PATCH reorder | NO |
| Xoá trang | List row | Ghost đỏ | — | — | DELETE landing | YES "Xoá trang `<tên>`?" |

---

## 4. Technical Mandates

### 4.1 DB / Cache / S3

**MongoDB collection MỚI `race_landings`:**
- Index: `{ 'raceRef.raceId': 1 } unique`, `{ 'domain.subdomain': 1 } unique sparse`, `{ 'merchantRef.tenantId': 1 }`, `{ status: 1 }`.
- 🛑 **PAUSE-Coder:** collection mới — KHÔNG migration data cũ (greenfield). Confirm Manager.

**Redis (thêm vào Registry):**
- `landing:slug:<slug>` — public liveSnapshot raw cache, TTL 60s. DEL khi publish/unpublish/delete.
- `landing-lock:<slug>` — SETNX anti-stampede, TTL 5s.
- `landing:resolve:<host>` — host→slug map cache, TTL 300s. DEL khi đổi subdomain.
- `ratelimit:landing-view:<slug>:<ipHash>` — view dedup, TTL 5m.

**S3 (lifecycle rule 7 MỚI — CLAUDE.md):**
- Prefix `landing-assets/<landingId>/<randomHex>.{png,jpg,jpeg,webp,mp4}`. **NO expiration** (như `courses/`). Max 5MB ảnh / config video qua URL ngoài. 🛑 PAUSE-Coder: confirm prefix + reuse `upload.controller` với `folder=landing-assets`.

### 4.2 Backend Endpoint Specification

> **Route ordering (NestJS quirk — conventions §1173):** khai báo literal `slug/:slug`, `resolve`, (Phase 2 `tls/check-domain`) **TRƯỚC** `:id`.

| # | Method | Path | Auth | Req DTO | Res DTO | Status | Side effects |
|---|---|---|---|---|---|---|---|
| E1 | GET | `/api/landings` | LogtoAdminGuard | query(tenant,page) | `LandingListResponseDto` | 200/401 | — |
| E2 | POST | `/api/landings` | LogtoAdminGuard | `CreateLandingDto{raceId}` | `LandingResponseDto` | 201/400/401/409 | seed sections (BR-83-03); 409 nếu race có landing |
| E3 | GET | `/api/landings/:id` | LogtoAdminGuard | — | `LandingResponseDto` (draft full) | 200/401/403/404 | IDOR check tenant |
| E4 | PATCH | `/api/landings/:id` | LogtoAdminGuard | `UpdateLandingDto` (meta/theme/domain partial) | `LandingResponseDto` | 200/400/401/403/404 | `hasUnpublishedChanges=true` |
| E5 | PATCH | `/api/landings/:id/sections` | LogtoAdminGuard | `ReorderSectionsDto{sections[]}` | `LandingResponseDto` | 200/400/401/403/404 | validate variant per type; dirty=true |
| E6 | POST | `/api/landings/:id/publish` | LogtoAdminGuard | — | `LandingResponseDto` | 200/401/403/404/422 | snapshot→liveSnapshot; DEL `landing:slug:*`+`landing:resolve:*`; 422 nếu subdomain invalid |
| E7 | POST | `/api/landings/:id/unpublish` | LogtoAdminGuard | — | `LandingResponseDto` | 200/401/403/404 | status=unpublished; DEL cache |
| E8 | DELETE | `/api/landings/:id` | LogtoAdminGuard | — | `{deleted:true}` | 200/401/403/404 | soft-delete archived; DEL cache |
| E9 | GET | `/api/landings/slug/:slug` | PUBLIC + ratelimit | — | `PublicLandingResponseDto` | 200/404/429 | cache 60s; strip BR-83-20; 404 nếu ≠published |
| E10 | GET | `/api/landings/resolve` | PUBLIC + ratelimit | query`host` | `{slug}` \| 404 | 200/404 | cache `landing:resolve:<host>` |

> Upload ảnh: reuse `POST /api/upload` với `folder=landing-assets` (KHÔNG endpoint mới) — 🛑 PAUSE-Coder verify `upload.service` honor `folder`.

### 4.3 DTO Field-Level Spec (trích — core)

```typescript
// section discriminated union
export class SectionDto {
  @ApiProperty() @IsString() @IsNotEmpty() id!: string;
  @ApiProperty({ enum: LANDING_SECTION_TYPES }) @IsEnum(LANDING_SECTION_TYPES) type!: LandingSectionType;
  @ApiProperty() @IsString() variant!: string;               // validate-by-type ở service (BR-83-07)
  @ApiProperty() @IsBoolean() enabled!: boolean;
  @ApiProperty() @IsInt() @Min(0) order!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() anchor?: string;
  @ApiProperty({ type: Object }) @IsObject() data!: Record<string, unknown>; // sanitize richtext/url server-side
}

export class CreateLandingDto {
  @ApiProperty({ description: 'Mongo race _id' })
  @IsMongoId() raceId!: string;
}

export class UpdateLandingDto {
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => MetaDto) meta?: MetaDto;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => ThemeDto) theme?: ThemeDto;
  @ApiPropertyOptional() @IsOptional() @ValidateNested() @Type(() => DomainDto) domain?: DomainDto;
}

export class ThemeDto {
  @ApiProperty({ pattern: '^#[0-9a-fA-F]{6}$', example: '#ea580c' })
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Mã màu chính sai (vd #ea580c)' }) main!: string;
  @ApiProperty({ pattern: '^#[0-9a-fA-F]{6}$', example: '#1d4ed8' })
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Mã màu phụ sai' }) sec!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() preset?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fontHeading?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(0.8) heroOverlay?: number;
}

export class DomainDto {
  @ApiPropertyOptional({ pattern: '^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$' })
  @IsOptional() @Matches(/^[a-z0-9][a-z0-9-]{1,40}[a-z0-9]$/, { message: 'Subdomain không hợp lệ' })
  subdomain?: string;
}
```

`PublicLandingResponseDto` — KHÔNG có `merchantRef.tenantId`, `internalName`, `createdBy/updatedBy`, `_id` (chỉ `id`), `publish.draftSnapshot`. CHỈ phục vụ `liveSnapshot`.

### 4.4 Frontend / Admin
- **Backend đổi DTO → 🛑 chạy `pnpm generate:api`** (admin + frontend) → `landing-api.ts` + `landing-hooks.ts` (TanStack). KHÔNG fetch thủ công.
- Public renderer = Server Component fetch qua proxy `/api/landings/slug/:slug`; section components premium MỚI trong `frontend/components/landing/` (KHÔNG reuse `components/hub/sections/*`); lazy-island chỉ section tương tác (countdown, results native fetch, gallery filter, Zalo/FB script).
- Admin builder = Client Components (form state), TanStack mutation + `invalidateQueries(['landing',id])`; Base UI `<Select.Value>{(v)=>LABEL[v]}` render-prop cho dropdown (VN labels); picker collapse cho RaceSearchCombobox.
- `frontend/middleware.ts`: thêm nhánh catch-all subdomain (sau known-host checks 5sport/5solution/timing, loại trừ `/api /_next /l /embed`) → `resolve?host=` → rewrite `/l/<slug>`. 🛑 PAUSE-Coder: thứ tự nhánh + KHÔNG set cookie `.5bib.com` (R-9 cross-tenant).
- `next.config.ts` assetPrefix (R-3): verify subdomain same-origin asset load; 🛑 PAUSE-Coder confirm không vỡ với existing `result.5bib.com` assetPrefix (TD-F027-PHASE2-16) — có thể cần điều kiện theo host.

### 4.5 PAUSE flags (tổng hợp cho Manager/Danny)
- 🛑 Collection mới `race_landings` (greenfield, no migration) — Manager confirm.
- 🛑 S3 prefix `landing-assets/` + CLAUDE.md lifecycle rule 7 — Manager confirm.
- 🛑 `frontend/middleware.ts` đụng auth/routing — Manager review (security).
- 🛑 `next.config.ts` assetPrefix điều kiện theo host — Manager review (R-3 từng gây sự cố DEV/PROD).
- 🛑 **Danny confirm:** 5pix domain (`5pix.org` vs `5pix.vn`) + race.pixEventUrl format (R-5).
- 🛑 **Danny confirm:** Phase 1 ai dựng — Back-Office Admin (đề xuất) hay merchant self-serve (cần merchant portal RBAC, đội effort).
- KHÔNG `pnpm install` dep mới dự kiến (reuse @napi/sanitize-html, dnd KHÔNG cần vì template fill-in).

---

## 5. Testing Mandates (TC-83-XX)

#### TC-83-01 Happy — Create landing từ race
| Element | Value |
|---|---|
| Method/URL | POST `/api/landings` |
| Headers | `Authorization: Bearer <admin>` |
| Body | `{"raceId":"<valid_oid>"}` |
| Expected status | 201 |
| Expected shape | `{id, raceRef:{raceId,slug}, sections:[...seeded], theme:{main,sec}, status:"draft"}` |
| MUST NOT leak | `_id` raw, `__v`, `merchantRef.tenantId` |
| Side effect | doc mới + sections auto-seeded (hero/course/sponsors enabled) |

#### TC-83-02 Conflict — race đã có landing
POST cùng `raceId` lần 2 → **409** `{code:"LANDING_EXISTS"}`.

#### TC-83-03 Validation — subdomain sai
PATCH `/:id` `{domain:{subdomain:"-Bad_"}}` → **400** msg "Subdomain không hợp lệ".

#### TC-83-04 Validation — subdomain reserved
PATCH `{domain:{subdomain:"admin"}}` → **400** `SUBDOMAIN_RESERVED`.

#### TC-83-05 Validation — theme hex sai
PATCH `{theme:{main:"red"}}` → **400** "Mã màu chính sai".

#### TC-83-06 Conflict — subdomain trùng
2 landing cùng subdomain → landing thứ 2 PATCH → **409** `SUBDOMAIN_TAKEN`.

#### TC-83-07 Variant invalid theo type
PATCH sections hero `variant:"carousel"` → **400** "Variant không hợp lệ cho hero".

#### TC-83-08 Publish — snapshot đúng
POST `/:id/publish` (subdomain hợp lệ, hero enabled) → **200**; `liveSnapshot` = sections enabled hiện tại; `hasUnpublishedChanges=false`; Redis `landing:slug:*` DEL.

#### TC-83-09 Publish chặn — thiếu subdomain
POST publish khi `subdomain=null` → **422** `SUBDOMAIN_REQUIRED`.

#### TC-83-10 Public GET — chỉ liveSnapshot + strip
GET `/api/landings/slug/<slug>` (published) → **200**; body = `id` (không `_id`), KHÔNG `merchantRef.tenantId`/`internalName`/draft; CHỈ section enabled trong liveSnapshot.

#### TC-83-11 Public GET — unpublished → 404
GET slug khi `status=unpublished` → **404**.

#### TC-83-12 Public — draft change KHÔNG lộ
PATCH draft sau publish (đổi title) → GET public vẫn trả title CŨ (liveSnapshot), `hasUnpublishedChanges=true` ở admin GET.

#### TC-83-13 Resolve host
GET `/api/landings/resolve?host=halong-marathon.5bib.com` → **200** `{slug}`; host lạ → **404**.

#### TC-83-14 Auth — admin endpoint no token → 401
POST `/api/landings` không token → **401**.

#### TC-83-15 IDOR — tenant khác
Admin tenant A GET landing tenant B (non-super) → **403**.

#### TC-83-16 Concurrent publish (race)
`Promise.all` 2 publish cùng `:id` → 1 thành công, snapshot nhất quán (SETNX `landing-lock`), không double-version lệch.

#### TC-83-17 Auto-data course pull
Section course render → fetch race.courses[] live; race thêm course → public phản ánh (no snapshot data giải).

#### TC-83-18 photos_embed auto-hide
Race `enable5pix=false` → section photos_embed KHÔNG render public.

#### TC-83-19 CTA deep-link đúng utm
Render hero CTA → href = `https://5bib.com/vi/events/<mysqlRaceId>?utm_source=landing&utm_medium=hero&utm_campaign=<slug>`, `rel=noopener`, KHÔNG có `<form>`/onClick purchase.

#### TC-83-20 Boundary — subdomain 3 & 42 ký tự
PATCH subdomain 3 ký tự "abc" → 200; 43 ký tự → 400.

**Frontend E2E (Playwright):**
| TC | Persona | Journey | Expected |
|---|---|---|---|
| E2E-83-01 | Admin | Tạo→cấu hình hero variant→theme main/sec→subdomain→publish | Toast publish; `<sub>.5bib.com` render |
| E2E-83-02 | Admin | Đổi màu chính | Preview iframe đổi màu live |
| E2E-83-03 | Admin | Ẩn section + reorder ▲▼ | Preview cập nhật đúng thứ tự |
| E2E-83-04 | Visitor | Mở landing mobile 390px | Mọi section 1 cột, nav rút gọn (BR-83-21) |
| E2E-83-05 | Visitor | Bấm "Đăng ký" | Tab mới sang 5bib.com với utm |

**Security checks:** [ ] LogtoAdminGuard mọi admin endpoint (401 unauth) · [ ] IDOR tenant (403) · [ ] public strip không leak `_id/tenantId/draft` · [ ] CSP: native results không cần frame-ancestors; richtext sanitize script · [ ] subdomain reserved/unique enforced.

**Performance SLA:** GET `/api/landings/slug/:slug` p95 **< 300ms** cold / **< 80ms** warm (cache hit) · cache hit > 80% sau 1 phút · 10x concurrent publish stable.

---

## 6. Answers to Manager's PAUSE conditions (PAUSE-83-02..08)

- **PAUSE-83-01 (kiến trúc):** ✅ Danny chốt — module `landing/` mới (lean-fork). (Đã lock §1.)
- **PAUSE-83-02 (section list):** Chốt **10 section** (§1, §3.5). Variant: hero4/about3/schedule2/sponsors2/gallery2.
- **PAUSE-83-03 (subdomain slug):** `<subdomain>.5bib.com`, default = race.slug sanitized, admin chỉnh được, UNIQUE + reserved-list + regex BR-83-16. Trùng → 409.
- **PAUSE-83-04 (embed native vs iframe):** **Phase 1 = NATIVE** cho results (né R-1 hoàn toàn, không cần CSP/route embed); iframe mode → Phase 2. Photos = link-card/deep-link (iframe fallback) sang 5pix.
- **PAUSE-83-05 (5pix domain):** ✅ **Danny chốt 2026-06-13: `5pix.org` và `5pix.vn` là CÙNG product** → dùng `race.pixEventUrl` as-is, deep-link Phase 1 (iframe optional sau — CSP không phải vấn đề vì cùng product). Reuse `race.pixEventUrl` + `enable5pix`.
- **PAUSE-83-06 (merchant binding/RBAC):** ✅ **Danny chốt 2026-06-13: Phase 1 = Back-Office Admin dựng** trong admin dashboard (LogtoAdminGuard, no new RBAC). `merchantRef` derive từ race owner cho billing + Phase 2 merchant self-serve qua merchant portal.
- **PAUSE-83-07 (S3 lifecycle):** Prefix `landing-assets/` **NO expiration** (như `courses/`), thêm CLAUDE.md lifecycle rule 7. Confirm Manager.
- **PAUSE-83-08 (publish versioning):** Phase 1 = **draft + 1 liveSnapshot** + `hasUnpublishedChanges` (BR-83-19). Version history đầy đủ + scheduled publish → Phase 3.

---

## 7. Status & Next

- [x] DRAFT → [x] **READY** — sẵn sàng Manager `/5bib-plan`.

**Open items — ✅ ĐÃ RESOLVED (Danny 2026-06-13):**
1. 5pix: `.org` = `.vn` cùng product → dùng `race.pixEventUrl` deep-link.
2. Phase 1 builder owner = Back-Office Admin (admin dashboard, no new RBAC).

**Next:** Danny chạy `/5bib-plan FEATURE-083-race-landing-builder` (Manager review PRD + spot-check code thật promo-hub/middleware/upload + Scope Lock + APPROVED/NEEDS_REVISION).
