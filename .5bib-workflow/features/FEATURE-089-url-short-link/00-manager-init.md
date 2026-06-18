# FEATURE-089: Short link rút gọn URL (s.5bib.com)

**Status:** 🟡 INITIATED
**Created:** 2026-06-17
**Owner:** Danny
**Type:** NEW_MODULE (`short-links/` — chưa từng có shortener trong codebase)
**Created by:** 5bib-manager

---

## 🎯 Why this feature

BTC/sale dán link giải lên MXH (Facebook/Zalo) thì URL dài + có dấu tiếng Việt (vd `https://5bib.com/vi/events/lao-cai-marathon-2026-dong-chay-bien-cuong`) bị **vỡ/cắt/encode lỗi** khi cop. Cần hệ thống rút gọn: admin dán URL bất kỳ → ra short link ngắn gọn (vd `s.5bib.com/abc123`) → cop đăng MXH sạch đẹp, không lỗi, click ra đúng trang.

**Danny chốt 2026-06-17 (qua Manager AskUserQuestion):**
- **Domain phục vụ redirect = subdomain stack này, vd `s.5bib.com`** (KHÔNG đụng repo selling-web).
- **Phạm vi = shortener TỔNG QUÁT** — rút gọn MỌI URL (event selling-web, trang kết quả, landing, link ngoài), không chỉ event.

---

## 📂 Impact Map (theo memory + code thật đã verify)

### ⚠️ Ranh giới repo (Manager verified)
Link `5bib.com/vi/events/...` **KHÔNG thuộc repo này** — xác nhận qua [frontend/lib/selling-web-url.ts](frontend/lib/selling-web-url.ts:1) (FEATURE-036: trang event do **selling-web** repo quản, `5bib.com` root cũng selling-web). Repo `5bib-result` chỉ quản `result.5bib.com`. → Vì Danny chốt **subdomain riêng `s.5bib.com`**, feature này dựng **trọn vẹn trong repo này**, redirect 301/302 sang URL dài (kể cả URL trỏ về selling-web). KHÔNG cần sửa selling-web.

### Module sẽ chạm
- ➕ `backend/src/modules/short-links/` — **MODULE MỚI** (controller + service + schema + dto).
- ✏️ `backend/src/modules/app.module.ts` — register `ShortLinksModule` vào `imports`.
- ➕ `admin/src/app/(dashboard)/short-links/` — trang quản lý link (list/create/copy/QR/disable).
- ➕ `admin/src/lib/short-links-{api,hooks}.ts` — API wrapper + TanStack Query hooks.
- ✏️ Redirect endpoint công khai — chốt ở plan (xem PAUSE "nơi phục vụ redirect").

### File then chốt cần Coder đọc trước khi code (REUSE pattern)
- `backend/src/modules/landing/landing.service.ts` — **PRECEDENT** slug→content resolve + Redis cache-aside + SETNX anti-stampede + direct-query fallback. Shortener resolve `code→targetUrl` port y pattern này (đơn giản hơn).
- `backend/src/modules/landing/landing.constants.ts` — pattern khai báo cache key/TTL/lock (`LANDING_CACHE`). Tạo `SHORTLINK_CACHE` tương tự.
- `backend/src/modules/landing/landing.controller.ts` — pattern route order (public route TRƯỚC admin route) + `@ApiResponse` + `LogtoAdminGuard` cho mutation.
- `backend/src/modules/landing/landing.module.ts` — pattern wiring `MongooseModule.forFeature` + `LogtoAuthModule`.
- `backend/src/modules/upload/upload.controller.ts` — pattern guard admin (`LogtoOrApiKeyWriteGuard` / scope) cho endpoint tạo link.
- `frontend/middleware.ts` — **CRITICAL** đang rewrite `<slug>.5bib.com → /l/<slug>` + danh sách subdomain reserved. Nếu redirect phục vụ qua frontend, `s` phải thêm vào logic này (hoặc tách riêng — xem PAUSE).
- `frontend/app/api/[...proxy]/route.ts` — runtime proxy `/api/*` → backend (nếu redirect resolve qua frontend route gọi backend).
- Admin reuse: `admin/src/app/(dashboard)/landing/page.tsx` + `landing-api.ts` + `landing-hooks.ts` — khuôn list/create/delete + AlertDialog + Table (copy nguyên).
- Lib QR: `qrcode` đã có (dùng trong `result-image.service.ts`) → tạo QR cho mỗi short link KHÔNG cần dep mới.

### Endpoint dự kiến (BA chốt shape)
- ➕ `GET /r/:code` (HOẶC `GET /api/short-links/resolve/:code`) — **PUBLIC**, resolve + redirect 301/302. Cache-aside Redis. Click counter.
- ➕ `POST /api/short-links` — admin tạo link (`{ targetUrl, customAlias?, title? }`). LogtoAdminGuard.
- ➕ `GET /api/short-links` — admin list (paginated) + click count.
- ➕ `PATCH /api/short-links/:id` — đổi targetUrl/title/active.
- ➕ `DELETE /api/short-links/:id` — xóa/disable.

### Schema/DB
- MongoDB collection MỚI `short_links`: `{ code (unique index), targetUrl, title?, createdBy, clickCount (default 0), active (default true), createdAt, updatedAt }`. Unique index trên `code`. **KHÔNG đổi schema có sẵn.**
- MySQL platform: **KHÔNG đụng.**
- Redis: key MỚI `shortlink:code:<code>` → targetUrl (TTL ~1h), `shortlink-lock:<code>` SETNX anti-stampede (port `landing-lock`), click counter `shortlink:clicks:<code>` INCR (flush về Mongo định kỳ hoặc inc trực tiếp — BA chốt). Đăng ký vào CLAUDE.md Redis registry khi deploy.
- Dependency MỚI: **KHÔNG** (Mongoose + qrcode đã có).

---

## ⚠️ Risk Flags

- 🟡 **MED — Infra subdomain `s.5bib.com`:** cần **DNS A record** (GoDaddy → 157.10.42.171) + **nginx vhost** mới + **SSL certbot** + trỏ về container (frontend 3082 hay backend 8081 — xem PAUSE). Đây là task hạ tầng VPS, KHÔNG chỉ code (bài học `5bib-survey` còn thiếu nginx+DNS). 🛑 PAUSE confirm với Danny trước deploy.
- 🟡 **MED — Open redirect / abuse:** shortener tổng quát cho phép trỏ tới URL ngoài → có thể bị lạm dụng phishing. Mitigate: tạo link **chỉ admin** (LogtoAdminGuard), validate `targetUrl` là http(s) hợp lệ, (tùy chọn) allowlist host hoặc cảnh báo khi host ngoài 5bib. BA chốt mức độ.
- 🟡 **MED — Redirect type 301 vs 302:** 301 cache vĩnh viễn ở browser/CDN → nếu sau này admin sửa `targetUrl` thì user cũ vẫn vào URL cũ. Vì link **sửa được** → đề xuất **302** (hoặc 307). BA chốt.
- 🟢 **LOW — Clean slate:** chưa có shortener nào → không tech debt, không breaking. Pattern landing tái dùng tốt.
- 🟢 **LOW — Collision code:** random base62 6-7 ký tự + check unique + retry. Negligible.

---

## 🚧 PAUSE Conditions cần BA/Danny xác nhận khi viết PRD

- [ ] **⭐ KIẾN TRÚC LỚN NHẤT — nơi phục vụ redirect `s.5bib.com/:code`:** (A) **Backend** public `GET /r/:code` 301/302, nginx `s.5bib.com → backend:8081` (gọn, ít hop, không qua Next); (B) **Frontend** Next route `app/r/[code]/route.ts` gọi backend resolve rồi redirect, nginx `s.5bib.com → frontend:3082`. Manager đề xuất **(A)** — redirect thuần không cần React, giảm latency + không đụng middleware frontend. → chốt ở `/5bib-plan` (kèm nginx/DNS task).
- [ ] **Redirect type:** 301 (SEO, cache cứng) hay 302/307 (link sửa được)? Manager đề xuất **302**.
- [ ] **Custom alias (vanity):** cho admin tự đặt code đẹp (vd `s.5bib.com/laocai2026`) hay chỉ random? Nếu cho → validate ký tự + reserved words + check unique.
- [ ] **Độ dài/charset code random:** đề xuất base62, 6 ký tự (~56 tỷ tổ hợp).
- [ ] **Analytics click:** v1 chỉ đếm tổng `clickCount`? Hay cần theo ngày/nguồn/referrer/UTM passthrough? Manager đề xuất v1 đếm tổng (INCR Redis), nâng cấp sau.
- [ ] **Ai được tạo link:** chỉ admin nội bộ (v1) hay mở cho merchant/sale? Manager đề xuất **admin only** v1.
- [ ] **Auto-sinh từ danh sách giải:** có nút "tạo short link cho event X" tự build URL selling-web (qua helper `selling-web-url.ts` pattern) không, hay luôn dán tay? (nice-to-have, có thể Phase 2).
- [ ] **QR code:** mỗi link có nút tải QR (PNG) không? (reuse `qrcode` — gần như free). Manager đề xuất **có**.
- [ ] **Expiry:** link có hạn dùng không? Manager đề xuất **không** (vĩnh viễn, disable thủ công).
- [ ] **Query passthrough:** khi redirect, có giữ/nối query string client gửi vào không (vd `s.5bib.com/abc?utm_x=y`)? Đề xuất bỏ qua v1.

---

## 🎯 Success criteria (gợi ý cho BA)

- Admin dán URL dài bất kỳ → trong 1 thao tác ra `s.5bib.com/<code>` + nút copy + (tùy) QR.
- Click `s.5bib.com/<code>` → redirect đúng URL đích < 100ms p95 (cache hit), counter tăng.
- Link sửa targetUrl → lần click sau ra URL mới (nếu chọn 302).
- Tạo link chỉ admin; resolve công khai có rate-limit IP.
- Subdomain `s.5bib.com` có SSL hợp lệ, không cảnh báo trình duyệt.

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] **Yes** — BA bắt đầu được. PRD PHẢI chốt: nơi phục vụ redirect (A/B), 301-vs-302, custom alias, charset code, scope analytics, open-redirect guard.
- Lưu ý BA: tham chiếu `landing.service.ts` (cache-aside + SETNX + fallback) làm khuôn resolve; `landing-{api,hooks}.ts` + `landing/page.tsx` làm khuôn admin UI; KHÔNG cần dep mới.

## 🔗 Next step
Danny chạy: `/5bib-prd FEATURE-089-url-short-link`
