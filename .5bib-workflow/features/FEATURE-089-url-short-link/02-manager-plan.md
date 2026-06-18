# FEATURE-089: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-06-17
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check
- [x] Đã đọc `00` + `01` đầy đủ
- [x] Đã đọc memory `architecture.md` (landing flow) + `conventions.md` (cache key, guard) + `known-issues.md`
- [x] Đã spot-check code thật (KHÔNG rubber-stamp):
  - `landing.service.ts:85,295,332-347,557-583` — `@Optional() @InjectRedis()` + cache-aside (`get`/`set EX ttl`/`del`) + SETNX lock. ✅ Reuse confirmed.
  - `invoice-reconcile.controller.ts:24,48,102` — `ThrottlerGuard` + `@Throttle({default:{limit,ttl}})`. ✅
  - `result-image.service.ts:25,772` — `import * as QRCode from 'qrcode'` + `QRCode.toBuffer(url,{...})`. ✅
  - `landing.controller.ts:22` — `LogtoAdminGuard` from `../logto-auth`. ✅
  - `main.ts:100` — `setGlobalPrefix('api')` (xác nhận lý do chọn frontend-served redirect).

## ✓ PRD Validation Checklist
- [x] User Stories đầy đủ + Personas chuẩn (Back-Office Admin / Anonymous)
- [x] Business Rules testable, đánh số BR-01..12
- [x] UI states đủ 9 state (loading/empty/data/filtered-empty/error/submitting/success/validation/confirm)
- [x] Buttons + Form fields + Field source spec table đầy đủ
- [x] Endpoint spec table + DTO code block + status codes đầy đủ
- [x] Data source rõ (Mongo `short_links` / Redis `shortlink:*`)
- [x] KHÔNG migration (collection mới rỗng) — không cần PAUSE migration
- [x] KHÔNG breaking SDK (module mới, hand-typed admin wrapper)
- [x] Performance SLA cụ thể (resolve p95 < 80ms, cache hit > 80%)
- [x] Security boundary rõ (admin mutation / public resolve + throttle / open-redirect guard)

## 📊 Cross-check memory
- **Architecture:** module mới `short-links/` độc lập, không phá flow hiện tại. Sau deploy thêm node vào architecture.md + Redis registry CLAUDE.md (`shortlink:*`).
- **Convention:** cache key `shortlink:code:<code>` đúng pattern `[resource]:[id]:[variant]`; SETNX lock port `landing-lock`; guard `LogtoAdminGuard` chuẩn. KHÔNG pattern mới.
- **Known issues:** middleware subdomain — phải thêm `'s'` vào `LANDING_RESERVED` TRƯỚC catch-all landing, nếu không `s.5bib.com` bị bắt thành landing slug `s`. ⚠️ Coder chú ý thứ tự.

## 📋 Files được phép thay đổi (Scope Lock)

**Backend (`backend/src/`):**
- ➕ `modules/short-links/short-links.module.ts`
- ➕ `modules/short-links/short-links.controller.ts`
- ➕ `modules/short-links/short-links.service.ts`
- ➕ `modules/short-links/schemas/short-link.schema.ts`
- ➕ `modules/short-links/dto/create-short-link.dto.ts`
- ➕ `modules/short-links/dto/update-short-link.dto.ts`
- ➕ `modules/short-links/dto/short-link-response.dto.ts` (+ `ResolveShortLinkDto`)
- ➕ `modules/short-links/short-links.constants.ts` (`SHORTLINK_BASE_HOST`, `SHORTLINK_CODE_LENGTH`, `SHORTLINK_RESERVED`, `SHORTLINK_CACHE`)
- ➕ `modules/short-links/short-links.service.spec.ts` (unit tests)
- ✏️ `modules/app.module.ts` — register `ShortLinksModule`

**Frontend (`frontend/`):**
- ➕ `app/r/[code]/route.ts` — redirect route handler
- ✏️ `middleware.ts` — host `s.5bib.com` rewrite `/<code>` → `/r/<code>` + thêm `'s'` vào `LANDING_RESERVED`

**Admin (`admin/src/`):**
- ➕ `app/(dashboard)/short-links/page.tsx`
- ➕ `components/short-links/ShortLinksClient.tsx`
- ➕ `components/short-links/ShortLinkDialog.tsx`
- ➕ `components/short-links/QrDialog.tsx`
- ➕ `lib/short-links-api.ts`
- ➕ `lib/short-links-hooks.ts`
- ✏️ `lib/nav-groups.ts` — thêm nav "Link rút gọn" (requireRole admin)

**Constants/env:**
- ✏️ backend `.env` + `docker-compose.yml` — `SHORTLINK_BASE_HOST=s.5bib.com` (KHÔNG secret)

🛑 Ngoài danh sách trên = scope creep → hỏi Manager.

## 🔧 Tech approach (Manager chốt)
- **Redirect served by FRONTEND** (xác nhận BA option B): `app/r/[code]/route.ts` server-side fetch `${BACKEND_URL}/api/short-links/resolve/:code` → `NextResponse.redirect(targetUrl, 302)`; 404 → redirect `https://5bib.com`. Lý do: URL root ngắn nhất + reuse middleware landing đã tested + 0 touch `setGlobalPrefix`.
- **Redis `@Optional()`** y `landing.service.ts:85` — graceful khi không có Redis (fallback direct Mongo). Port helper `getCache/setCache/delCache` + SETNX lock.
- **Code-gen:** base62 6 ký tự (crypto random), check unique, retry ≤5; custom alias bypass random. Reserved check trước insert.
- **Click count:** resolve → cache-aside lấy targetUrl; `$inc clickCount` fire-and-forget (KHÔNG await trước redirect resolve return).
- **QR:** `QRCode.toBuffer('https://'+host+'/'+code, {width:512, margin:1})` → trả `image/png`.

## 🛑 PAUSE points cho Coder
- 🛑 KHÔNG `pnpm install` — mọi lib (mongoose/ioredis/qrcode/@nestjs/throttler/class-validator) đã có. Nếu thấy thiếu → dừng hỏi.
- 🛑 KHÔNG đụng global `setGlobalPrefix` trong `main.ts` (đã chọn frontend-served để né).
- 🛑 Middleware: thêm `'s'` vào `LANDING_RESERVED` + đặt nhánh xử lý `s` host TRƯỚC catch-all landing — verify không vỡ subdomain landing hiện có.
- 🛑 Infra `s.5bib.com` (DNS/nginx/SSL) KHÔNG phải việc Coder — chỉ ghi runbook. Test trên domain dev hiện có.

## 🧪 Unit test BẮT BUỘC (`short-links.service.spec.ts`)
- [ ] `create()` — random code: sinh code đúng 6 ký tự base62, insert, trả shape KHÔNG leak `_id`
- [ ] `create()` — custom alias: dùng alias làm code
- [ ] `create()` — alias reserved (`admin`) → throw 400
- [ ] `create()` — alias dup → throw 409
- [ ] `create()` — targetUrl `javascript:`/`ftp:` → reject (validation-level, test DTO hoặc service guard)
- [ ] code-gen collision: mock model trả tồn tại 1 lần → retry ra code khác
- [ ] `resolve()` — active link → trả targetUrl, $inc gọi
- [ ] `resolve()` — không tồn tại / `active=false` → throw 404
- [ ] `resolve()` — cache hit: lần 2 KHÔNG query Mongo (mock redis get trả value)
- [ ] `update()` — đổi targetUrl → DEL cache key
- [ ] `toResponse()` — map `_id`→`id`, có `shortUrl`, KHÔNG có `_id`/`__v`/`createdBy`

## 📊 Verdict
> ### ✅ APPROVED — Coder bắt đầu được theo Scope Lock + PAUSE points.

PRD chất lượng cao, code-verified, 0 conflict architecture. Rủi ro chính = infra subdomain (ops, không block code) + thứ tự middleware (đã flag).

## ✅ Sẵn sàng cho `/5bib-code`?
- [x] Yes.

## 🔗 Next step
Danny chạy: `/5bib-code FEATURE-089-url-short-link`
