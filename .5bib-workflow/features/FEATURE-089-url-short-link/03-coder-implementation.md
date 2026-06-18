# FEATURE-089: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC
**Started/Done:** 2026-06-17
**Author:** 5bib-fullstack-engineer
**Linked:** `00`, `01`, `02`

---

## 📌 Pre-flight check
- [x] Đọc `00-manager-init.md` + `01-ba-prd.md` + `02-manager-plan.md` (APPROVED)
- [x] Đọc memory `conventions.md` + `codebase-map.md` (landing/upload)
- [x] Đọc code thật Scope Lock: `landing.module/controller/service/constants`, `logto-auth/index`, `app.module`, `frontend/middleware`, `landing-api/hooks`, `landing/page.tsx`, proxy route, schema example

## 🔍 Impact Assessment (Phase 1)
- **Backend:** module mới `short-links/` pure Mongo+Redis. Collection mới `short_links` (unique index `code`). KHÔNG platform DB, KHÔNG migration (rỗng). KHÔNG cross-module DI. Redis `@Optional()` (graceful no-redis). 0 dep mới (mongoose/ioredis/qrcode/class-validator có sẵn).
- **Frontend:** route handler `/r/[code]` (Next 16 async params) + middleware branch host `s.5bib.com`. KHÔNG đổi cache/SDK.
- **Admin:** page + 2 dialog + api/hooks (hand-typed wrapper qua proxy, KHÔNG generated SDK) + 1 nav entry. TanStack Query invalidate `['short-links']`.
- **API contract:** module mới → KHÔNG break SDK hiện tại. `generate:api` KHÔNG bắt buộc (admin dùng hand-typed).

## ⚠️ Edge Cases Covered (Phase 2)
- [x] Random code collision → retry ≤5, hết retry → 409 (test)
- [x] Custom alias reserved (`admin`) → 400 (test); alias dup → 409 (test)
- [x] targetUrl không http(s) / `javascript:` → 400 (DTO `@Matches`)
- [x] Resolve không tồn tại / `active=false` → 404 (test)
- [x] Cache hit không query Mongo nhưng vẫn $inc click (test) — đếm click chính xác
- [x] Update đổi targetUrl → DEL cache (test) → resolve sau trả URL mới
- [x] Redis down → cacheGet/set nuốt lỗi, fallback direct Mongo (graceful)
- [x] Frontend resolve fail/timeout → 302 fallback `https://5bib.com` (không vỡ)
- [x] Middleware: `s` thêm vào LANDING_RESERVED → không bị bắt nhầm thành landing slug

## 🧠 Logic & Architecture (Phase 3)
- **Redirect served FRONTEND** (per Manager Plan): `s.5bib.com/<code>` → middleware rewrite `/r/<code>` → route handler fetch backend resolve → 302. Backend `setGlobalPrefix('api')` nên redirect tại backend phải `/api/...`; phục vụ ở frontend giữ URL root ngắn + reuse middleware đã tested + 0 touch global config.
- **Cache-aside + SETNX** port `landing.service.queryPublished()` 1:1. Cache value = targetUrl string (đơn giản hơn JSON landing).
- **Click count** $inc fire-and-forget mọi resolve (kể cả cache hit) → counter chính xác, không chặn redirect.
- **Code-gen** crypto `randomInt` (KHÔNG Math.random — bị cấm trong workflow scripts + tốt cho uniqueness). base62 6 ký tự.
- **QR** `QRCode.toBuffer` (lib có sẵn) → `StreamableFile` + `Content-Type: image/png`.

## 💻 Files Changed
**Backend (`backend/src/`):**
- ➕ `modules/short-links/short-links.constants.ts`
- ➕ `modules/short-links/schemas/short-link.schema.ts`
- ➕ `modules/short-links/dto/{create,update}-short-link.dto.ts` + `dto/short-link-response.dto.ts`
- ➕ `modules/short-links/short-links.service.ts`
- ➕ `modules/short-links/short-links.controller.ts`
- ➕ `modules/short-links/short-links.module.ts`
- ➕ `modules/short-links/short-links.service.spec.ts`
- ✏️ `modules/app.module.ts` — import + register `ShortLinksModule`

**Frontend (`frontend/`):**
- ➕ `app/r/[code]/route.ts`
- ✏️ `middleware.ts` — `isShortLinkHost` branch + `s/go/link` vào `LANDING_RESERVED`

**Admin (`admin/src/`):**
- ➕ `app/(dashboard)/short-links/page.tsx`
- ➕ `components/short-links/ShortLinkDialog.tsx` + `QrDialog.tsx`
- ➕ `lib/short-links-api.ts` + `lib/short-links-hooks.ts`
- ✏️ `lib/nav-groups.ts` — import `Link2` + nav "Link rút gọn"

## 🧪 Tests Written
```
PASS src/modules/short-links/short-links.service.spec.ts
  ShortLinksService
    create() — random code
      ✓ sinh code base62 đúng 6 ký tự + trả shape KHÔNG leak _id/createdBy
      ✓ retry khi đụng unique index (collision) → ra code khác, vẫn thành công
      ✓ đụng dup quá SHORTLINK_CODE_MAX_RETRY lần → ConflictException
    create() — custom alias
      ✓ dùng alias làm code
      ✓ alias reserved (admin) → BadRequestException
      ✓ alias đã tồn tại → ConflictException
    resolve()
      ✓ active link (cache miss) → trả targetUrl + $inc clickCount + cacheSet
      ✓ cache hit → KHÔNG query Mongo findOne, vẫn $inc
      ✓ không tồn tại / active=false → NotFoundException
    update()
      ✓ đổi targetUrl → save + DEL cache key
      ✓ id không tồn tại → NotFoundException
    remove()
      ✓ xóa + DEL cache
      ✓ không tồn tại → NotFoundException
    list()
      ✓ trả items + total, map shape không leak _id

Tests: 14 passed, 14 total
```
TC mapping PRD: TC-01/02 create; TC-03 reserved+url(DTO); TC-04 alias dup; TC-06 resolve+404; TC-07 collision retry; TC-08 update invalidate. TC-05 auth + TC-09 boundary + frontend E2E → QC live.

## 🛑 PAUSE/Confirmation log
| Date | What | Resolution |
|------|------|-----------|
| 2026-06-17 | ThrottlerGuard cho resolve | DROP — resolve là server-to-server (frontend gọi), throttle per-IP vô nghĩa ở backend; rate-limit thuộc nginx/frontend. Xem IMPLEMENTATION_NOTES §1. |
| 2026-06-17 | Infra `s.5bib.com` DNS/nginx/SSL | Ops task — KHÔNG block code. Test trên domain dev. Runbook trong IMPLEMENTATION_NOTES §4. |

## 🚧 Scope creep
- [x] KHÔNG scope creep. Bỏ bớt `ShortLinksClient.tsx` (fold vào page.tsx theo precedent landing) — giảm scope, không thêm. Bỏ edit `.env`/`docker-compose` (constant có default `s.5bib.com`; ENV optional) — documented.

## 🐛 Known limitations / Tech debt
- Click count = tổng (v1). Theo ngày/referrer = Phase 2.
- Rate-limit end-user dựa nginx (chưa code) — TD-F089-RATELIMIT.
- Backend boot smoke + live E2E (redirect 302, admin auth flow) → QC gate (cần DB+Logto+host).

## ✅ Self-Review Pipeline
- [x] Bước 1: tsc exit 0 cho Scope Lock (backend + admin + frontend — grep clean)
- [x] Bước 2: PRD adherence (DTO fields + endpoints + TC matched)
- [x] Bước 3: Anti-pattern scan clean (no console.log/any/as-unknown-as in prod files, all 3 apps)
- [x] Bước 4: Hand-pick mapping — N/A (no multi-layer `.map` field; toResponse single source)
- [~] Bước 5: PROD-readiness smoke — tsc compile OK; full Nest boot + curl deferred QC (cần env/DB)
- [~] Bước 6: UI/UX self-inspection — code follows landing pattern (sm:max-w-md dialog, truncate+title, empty/loading/error states); live browser deferred QC (cần admin auth)
- [x] Bước 7: Real-world data — test dùng URL thật `5bib.com/vi/events/lao-cai-marathon-2026-...`, alias `laocai2026`
- [x] Bước 8: Files vs Scope Lock — 0 creep
- [x] Bước 9: SDK regen — N/A (hand-typed wrapper, KHÔNG đổi consumed DTO)
- [x] Bước 10: Unit tests PASS (14/14) output paste ở trên
- [x] Bước 11: IMPLEMENTATION_NOTES.md viết đủ 4 sections

→ Status: 🟠 READY_FOR_QC

## 🔗 Next step
Danny chạy: `/5bib-qc FEATURE-089-url-short-link`
