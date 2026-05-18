# FEATURE-036: SEO Subdirectory Routes `5bib.com/giai-chay/*`

**Status:** 🟢 READY for `/5bib-prd`
**Created:** 2026-05-15
**Updated:** 2026-05-15 — Danny clarify 7 Q + 2 requirement mới
**Owner:** Danny
**Type:** NEW_MODULE (FE routes + sitemap + weekly cron sync) — reuse F-027 hub routing model
**Input PRD:** `PRD_SEO_subdirectory_routes.md` (Danny tự viết — BA refactor theo template chuẩn)

---

## 🎯 Why this feature

5bib.com hiện không index từ khoá race nào — content nằm trên `result.5bib.com` (sub-domain phụ, không hưởng SEO juice). PRD đề xuất programmatic SEO tại subdirectory `5bib.com/giai-chay/*` (600+ trang, sitemap, JSON-LD SportsEvent) để chiếm organic search "giải chạy + [thành phố]".

KPI 6 tuần: 600+ pages indexed, top 10 cho 30 keywords, organic traffic 5x baseline.

**Quan trọng:** SEO page là **clone nội dung phục vụ SEO discovery**, KHÔNG xử lý mua vé. Mọi CTA "Mua vé" / "Đăng ký" PHẢI dẫn về **selling-web** (trang sự kiện đích của 5bib) — đó là nơi xử lý transaction.

---

## ✅ Danny Decisions (clarify 2026-05-15)

### TOP — Routing model
> *"Phần cấu hình chạy với 5bib mày làm y hệt phần hub là được, 5bib đã chạy đc phần đấy rồi."*

→ **CHỐT:** Reuse 100% F-027 hub routing model.
- 5bib.com hosted trên **5Ticket Vercel** → rewrite rule `5bib.com/giai-chay/*` → `result-fe.5bib.com/giai-chay/*` (giống pattern `/hub/*` hiện tại)
- `assetPrefix: 'https://result.5bib.com'` (cross-domain absolute) — **GIỮ NGUYÊN, KHÔNG đổi**
- KHÔNG có VPS Nginx riêng cho 5bib.com → toàn bộ Section 5 trong PRD gốc (Nginx config) **HUỶ**
- Coordinate với 5Ticket team thêm rewrite rule (giống doc [INTEGRATION-5ticket-promo-hub-rewrite.md](docs/INTEGRATION-5ticket-promo-hub-rewrite.md))

### Q1 — 5bib.com platform
> *"K hiểu"* → đã decided ở TOP: Vercel rewrite.

### Q2 — assetPrefix
> Đã decided ở TOP: giữ `https://result.5bib.com`.

### Q3 — Slug coverage + **CRON JOB MỚI**
> *"MongoDb thiếu nhiều, nhưng mục tiêu là lấy các giải trong 5bib ra để tạo thành các trang SEO, và quan trọng là mày có job để chạy hàng tuần việc đó nhằm update các giải mới nếu có."*

→ **CHỐT:**
- Phase B1 **không phải migration 1 lần** mà là **cron job định kỳ**.
- Schedule: **weekly** (vd: Sunday 02:00 GMT+7) — discover new races + backfill missing slug + auto-generate slug từ `title + startDate`.
- Owner: backend NestJS `@nestjs/schedule` module (có sẵn).
- Side effect: trigger frontend `revalidatePath('/giai-chay/[slug]')` sau khi backfill slug mới.

### Q4 — Canonical / noindex
> *"Làm giống phần hub"*

→ **CHỐT:** Reuse F-027 hub canonical pattern. Hub đang dùng self-canonical `5bib.com/hub/<slug>` → tương tự `5bib.com/giai-chay/<slug>`. BA verify pattern hub hiện tại + apply.

### Q5 — Province normalization
> *"B"*

→ **CHỐT:** Phase B (cùng launch với race detail + city pages). KHÔNG defer Phase C.

### Q6 — Selling-web CTA URL format
> *"URL làm khác URL của trang selling hiện tại 1 chút nhé"*

→ **HIỂU:** URL CTA "Mua vé" sẽ KHÁC URL `/vi/events/[slug]_[race_id]` legacy của selling-web hiện tại (có biến thể nhỏ — có thể là param tracking SEO, hoặc path mới).
→ **Action BA:** verify exact format với Danny khi viết PRD. Memory `project_selling_web.md` có codebase map selling-web — BA có thể đọc routes hiện tại + propose format mới (vd: `5bib.com/vi/events/[slug]_[race_id]?ref=seo-giai-chay`).

### Q7 — Sitemap conflict
> *"K biết"*

→ **Action BA:** verify khi viết PRD. Hỏi 5Ticket team xem `5bib.com/sitemap.xml` legacy đã có chưa. Nếu có → đặt tên khác (`/sitemap-races.xml`) + add `<sitemap>` reference vào root sitemap index. Nếu không → dùng tên gì cũng được.

### **Q8 (MỚI) — Buy-ticket CTA luôn về selling-web**
> *"Khi mày clone nội dung chạy SEO thì phải đảm bảo các nút ấn mua vé luôn dẫn về trang sự kiện đích của 5bib nhé vì ở trang đó mới xử lý được các giao dịch mua."*

→ **CHỐT — Business invariant:**
- **TUYỆT ĐỐI KHÔNG** xử lý cart / payment / form đăng ký trong SEO page `/giai-chay/*`.
- Mọi CTA action (Mua vé, Đăng ký, Mua BIB) → external link sang selling-web (`5bib.com/vi/events/...`) với `target="_self"`.
- Logic phân biệt CTA theo race status:
  - `pre_race` / `live` (đang bán): CTA "Đăng ký ngay" → selling-web event detail
  - `ended`: CTA "Xem kết quả" → INTERNAL link `/giai-chay/[slug]/ket-qua` (SEO juice)

---

## 📂 Impact Map (revised)

### Module sẽ chạm

**Frontend (`frontend/`)** — NEW_MODULE
- `app/giai-chay/layout.tsx` — NEW SEO shell + breadcrumb
- `app/giai-chay/page.tsx` — NEW listing all races
- `app/giai-chay/[raceSlug]/page.tsx` — NEW race landing
- `app/giai-chay/[raceSlug]/ket-qua/page.tsx` — NEW results table
- `app/giai-chay/thanh-pho/[citySlug]/page.tsx` — NEW city aggregator (Phase B)
- `app/giai-chay/sitemap.ts` — NEW dynamic sitemap
- `app/lib/seo-api.ts` — NEW backend API wrapper với ISR cache
- `app/lib/selling-web-url.ts` — NEW helper: build CTA URL về selling-web (centralize URL format)
- `app/lib/province-normalize.ts` — NEW helper: map "TP HCM"/"Tp Hồ Chí Minh"/"HCM" → `ho-chi-minh`
- `next.config.ts` — **KHÔNG đổi assetPrefix** (giữ `https://result.5bib.com`)

**Backend (`backend/`)**
- `src/modules/races/races.service.ts` — thêm helper `generateSlugIfMissing(race)` (slugify(title) + year suffix)
- `src/modules/races/race-seo-sync.cron.ts` — NEW cron `@Cron(CronExpression.EVERY_WEEK)` — discover + backfill slug + trigger frontend revalidate
- `src/modules/races/races.module.ts` — register cron + inject HttpModule cho revalidate call
- `src/modules/races/schemas/race.schema.ts` — slug + text index ĐÃ CÓ ✓
- Env: thêm `FRONTEND_REVALIDATE_GIAICHAY_URL` cho cron call (giống pattern F-027 `FRONTEND_REVALIDATE_URL`)

**5Ticket Vercel (external coordinate)**
- Thêm rewrite rule `5bib.com/giai-chay/*` → `result-fe.5bib.com/giai-chay/*` (PR riêng — KHÔNG nằm trong codebase này)
- Thêm rewrite rule `5bib.com/sitemap-races.xml` → `result-fe.5bib.com/sitemap-races.xml`

### File then chốt cần đọc trước khi code
- [frontend/next.config.ts](frontend/next.config.ts) — `assetPrefix` pattern đã set cho F-027 (GIỮ NGUYÊN)
- [backend/src/modules/races/schemas/race.schema.ts:137](backend/src/modules/races/schemas/race.schema.ts) — slug field
- [.5bib-workflow/features/FEATURE-027-promo-hub/OPS-NOTES.md](.5bib-workflow/features/FEATURE-027-promo-hub/OPS-NOTES.md) — F-027 routing reference
- [docs/INTEGRATION-5ticket-promo-hub-rewrite.md](docs/INTEGRATION-5ticket-promo-hub-rewrite.md) — Vercel rewrite pattern template
- Selling-web codebase (memory: `project_selling_web.md`) — BA verify URL format CTA

### Endpoint liên quan (backend ĐÃ CÓ — KHÔNG cần thêm)
- `GET /api/races?limit=500` — list races
- `GET /api/races/slug/:slug` — race detail
- `GET /api/race-results?raceId=X&course_id=Y&page=Z&limit=50` — results pagination
- `GET /api/race-results/stats/:raceId/:courseId` — course stats

### Endpoint MỚI cần thêm
- Internal: cron gọi `POST /api/internal/revalidate-giai-chay` (token-gated, giống F-027 revalidate pattern) — hoặc cron gọi thẳng frontend revalidate endpoint qua HttpModule.

### Schema/DB
- MongoDB `races`: slug field ĐÃ CÓ. Cron weekly backfill via `updateMany({ slug: null/missing }, { $set: { slug: generated } })`. NO schema migration.
- MongoDB `race_results`: KHÔNG đụng.
- KHÔNG cần MySQL platform DB.
- Redis: optional cron lock key `cron:race-seo-sync:lock` (SETNX 60s, anti double-fire khi multi-pod).

---

## ⚠️ Risk Flags (revised)

### 🔴 [HIGH] CTA "Mua vé" PHẢI link selling-web — KHÔNG có form/cart trong SEO page

Danny mandate: SEO page CHỈ là discovery layer. Mọi transaction về selling-web. Coder + QC PHẢI verify mọi button "Mua vé/Đăng ký" có `href` về `5bib.com/vi/events/...`, KHÔNG có `<form>` đặt vé inline.

Test: grep `<form` trong `app/giai-chay/**` → MUST be 0 form xử lý đăng ký. Chỉ accept `<form>` cho search/filter local.

### 🟡 [MED] Weekly cron — auto-discover races mới

Risk: cron fail silent → race mới không có slug → SEO page 404. Mitigation:
- Log success/fail vào ALS (audit log service hoặc Logger)
- Retry policy: max 3 retry với exponential backoff
- Alert nếu cron fail 2 tuần liên tiếp
- Manual trigger endpoint (admin-only) cho ops chạy on-demand

### 🟡 [MED] Province normalization (Phase B, không Phase C)

Move-up so với PRD gốc. Coder làm helper `province-normalize.ts` + map cứng top 10 thành phố VN. Edge case: race có province NULL → fallback "Khác".

### 🟡 [MED] result.5bib.com/giai-chay/* duplicate content

Reuse F-027 hub pattern — BA verify hub đang xử lý canonical sao + áp dụng. Có thể là self-canonical về 5bib.com domain trong `<link rel="canonical">`.

### 🟢 [LOW] Selling-web URL format thay đổi nhỏ

Danny nói "khác 1 chút" — BA verify khi viết PRD. Coder dùng helper `selling-web-url.ts` để centralize → đổi 1 chỗ là xong nếu sau Danny đổi.

### 🟢 [LOW] Sitemap conflict
BA verify với 5Ticket. Nếu conflict → tên khác.

---

## 🚧 PAUSE Conditions cho BA (khi viết `01-ba-prd.md`)

- [ ] BA verify selling-web URL format **exact** (đọc memory `project_selling_web.md` + có thể đọc routes selling-web codebase) → propose format CTA URL cho `pre_race`/`live` race
- [ ] BA verify F-027 hub canonical pattern hiện tại → reuse cho F-036
- [ ] BA verify 5bib.com root sitemap đã tồn tại chưa (qua curl `https://5bib.com/sitemap.xml` hoặc hỏi 5Ticket)
- [ ] BA list ≥10 province slug mapping (top thành phố có race) trong PRD Technical Mandates
- [ ] BA define cron failure handling + manual trigger endpoint spec
- [ ] BA define test scenario: weekly cron run dry → verify race mới có slug generated + revalidate trigger
- [ ] BA list các trang KHÔNG có form mua vé (anti-pattern check cho QC)

---

## 🎯 Success criteria (gợi ý cho BA)

- 600+ pages indexed trong Google Search Console sau 6 tuần
- Top 10 cho ≥30 keywords "giải chạy + [thành phố]"
- Organic traffic tăng 5x baseline
- Weekly cron success rate ≥ 95% (4/52 tuần fail acceptable, miễn có alert)
- Zero `<form>` xử lý mua vé trong `/giai-chay/*` routes
- All CTA "Mua vé" link về selling-web with proper URL format
- Race mới tạo trong tuần T → có slug + xuất hiện sitemap chậm nhất tuần T+1 (sau cron weekly fire)

---

## 📋 Workflow path

**Path A (đúng quy trình — Manager khuyến nghị):**
1. ✅ Manager `00-manager-init.md` READY
2. **NEXT:** `/5bib-prd FEATURE-036-seo-subdirectory-giai-chay` → BA refactor PRD gốc của Danny theo template chuẩn (User Stories + BR numbered + UI states + Technical Mandates + Cron spec)
3. `/5bib-plan FEATURE-036-seo-subdirectory-giai-chay` → Manager review + Scope Lock
4. `/5bib-code FEATURE-036-seo-subdirectory-giai-chay` → Coder
5. `/5bib-qc FEATURE-036-seo-subdirectory-giai-chay` → QC
6. `/5bib-deploy FEATURE-036-seo-subdirectory-giai-chay` → Manager memory sync

---

## ✅ Sẵn sàng cho /5bib-prd?

✅ **YES** — Danny đã clarify đủ. BA có 7 PAUSE conditions để verify trong PRD nhưng KHÔNG block khởi đầu (BA tự research selling-web + F-027 hub).

**Next:** Danny chạy `/5bib-prd FEATURE-036-seo-subdirectory-giai-chay`
