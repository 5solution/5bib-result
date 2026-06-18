# FEATURE-089 — IMPLEMENTATION_NOTES (Reviewer's Guide)

## Section 1: 🚧 Deviations from Spec (intentional)

- **[Deviation #1] Bỏ ThrottlerGuard khỏi resolve endpoint**
  - **Spec said:** PRD §3.2 + Plan — resolve public + `@UseGuards(ThrottlerGuard)` rate-limit IP.
  - **I did:** Resolve KHÔNG có ThrottlerGuard. Public, không guard.
  - **Why:** Kiến trúc chốt = redirect served ở FRONTEND → backend resolve được gọi **server-to-server** bởi `app/r/[code]/route.ts` (luôn cùng 1 IP = frontend container). Throttle per-IP ở backend vô nghĩa. Thêm nữa, `ThrottlerModule` chỉ register trong `invoice-reconcile.module` (conditional theo platform DB) → phụ thuộc fragile. Rate-limit per-end-user đúng chỗ là nginx/frontend.
  - **Reviewer should check:** resolve có cache Redis (chống tải) + 404 sạch. Rate-limit end-user = TD-F089-RATELIMIT (nginx), tracked.

- **[Deviation #2] Active toggle ở row button, KHÔNG ở edit dialog Switch**
  - **Spec said:** PRD §2.5 form có field `active` switch trong dialog sửa.
  - **I did:** Edit dialog chỉ targetUrl + title. Bật/Tắt qua nút row "Tắt"/"Bật" (PATCH `{active}`).
  - **Why:** Tránh phụ thuộc shadcn Switch (chưa verify có trong repo); nút row trực quan hơn cho toggle nhanh. Cùng endpoint PATCH.
  - **Reviewer should check:** toggleActive() gọi PATCH đúng; badge phản ánh active.

- **[Deviation #3] Fold table vào page.tsx, bỏ `ShortLinksClient.tsx`**
  - **Spec said:** Plan Scope Lock list `ShortLinksClient.tsx`.
  - **I did:** Toàn bộ table + state trong `page.tsx` ('use client') theo precedent `landing/page.tsx`.
  - **Why:** Landing pattern để hết trong page.tsx — nhất quán, ít file. Giảm scope (không thêm file).
  - **Reviewer should check:** page.tsx render đủ 9 state.

## Section 2: ⚙️ Forced Changes (reality ≠ spec)

- **[Forced #1] `s.5bib.com` cần branch riêng + reserved trong middleware**
  - **PRD assumed:** chỉ cần rewrite `s.5bib.com/<code>` → `/r/<code>`.
  - **Reality:** `frontend/middleware.ts` có catch-all landing bắt MỌI `<x>.5bib.com` thành landing slug. Nếu không thêm `'s'` vào `LANDING_RESERVED`, `s.5bib.com` bị rewrite `/l/s`.
  - **Workaround:** Thêm `s/go/link` vào `LANDING_RESERVED` + branch `isShortLinkHost` đặt TRƯỚC landing block.
  - **Manager/BA action:** ghi codebase-map: middleware reserved-set là single point cho subdomain mới.

- **[Forced #2] timestamps fields phải khai báo trên schema class cho TS**
  - **PRD assumed:** `timestamps: true` đủ.
  - **Reality:** TS không thấy `createdAt/updatedAt` trên class → `doc.createdAt` error (ban đầu phải `as unknown as`).
  - **Workaround:** khai báo `createdAt!: Date; updatedAt!: Date;` (KHÔNG @Prop) trên schema class → typed sạch, bỏ cast.

## Section 3: ⚖️ Tradeoffs Considered

| Decision | Chosen | Alternative | Why | Cost paid |
|----------|--------|-------------|-----|-----------|
| Nơi redirect | Frontend route handler | Backend `/r/:code` + setGlobalPrefix exclude | URL root ngắn + reuse middleware tested + 0 touch global config | +1 hop frontend→backend (~vài ms, có cache) |
| Click count | $inc mọi resolve (kể cả cache hit) | Redis INCR flush batch | Đếm chính xác, code đơn giản | 1 Mongo write nhỏ/click (async, không chặn) |
| Code gen | crypto randomInt base62 6 | nanoid/uuid | 0 dep mới, đủ entropy 56B | Cần retry loop khi collision (cực hiếm) |
| Cache value | targetUrl string thuần | JSON {targetUrl,active} | Đơn giản; inactive không cache (chỉ cache active) | Disable trong TTL → dựa DEL-on-update (đã làm) |
| Admin API | hand-typed wrapper | generated SDK | Khớp landing precedent, không cần regen | Phải tự sync type nếu DTO đổi |

## Section 4: 🔬 Reviewer Notes

### Files cần review kỹ (priority order)
1. **`backend/.../short-links.service.ts:resolve()+queryActive()+bumpClick()`** — cache-aside + SETNX + $inc fire-and-forget. Logic resolve/404/click.
2. **`backend/.../short-links.service.ts:create()`** — alias reserved/dup + random retry loop (BR-01/02/03).
3. **`frontend/middleware.ts:isShortLinkHost branch`** — thứ tự TRƯỚC landing + reserved. Verify không vỡ subdomain landing/timing/solution hiện có.
4. **`backend/.../short-links.controller.ts`** — route order `resolve/:code` trước `:id`; guard admin trên mọi mutation + QR; resolve public.
5. **`frontend/app/r/[code]/route.ts`** — 302 + fallback mọi lỗi (không 500/blank).

### Concurrency hotspots
- `create()` random code — `Promise.all` nhiều create đồng thời: unique index + retry loop đảm bảo không trùng (test covered). E11000 → retry/409.
- `resolve()` cache miss stampede — SETNX `shortlink-lock:<code>` retry 3×200ms (port landing).

### Edge cases tested vs deferred
- ✅ Tested: collision retry, reserved alias, dup alias, resolve 404/inactive, cache hit no-Mongo, update invalidate, list no-leak.
- ⚠️ Deferred (QC live): auth 401 (TC-05), boundary 2048/32 (TC-09 — DTO `@MaxLength` covers), frontend 302 E2E, admin browser walkthrough, backend Nest boot smoke.

### Type safety narrowed casts
- KHÔNG còn `as unknown as` (đã fix bằng khai báo timestamps trên schema). `String(doc._id)` — `_id: unknown` từ Document, String() nhận unknown OK.

### Security checklist self-applied
- [x] Mutation + list + QR: `@UseGuards(LogtoAdminGuard)`. Resolve public (chỉ trả targetUrl, no PII).
- [x] Open-redirect: `targetUrl` `@Matches(/^https?:\/\/.+/i)` — chặn `javascript:`/`data:`.
- [x] Response KHÔNG leak `_id`/`__v`/`createdBy` (toResponse allowlist; test negative-assert).
- [x] Reserved code chặn đụng route hệ thống (`r`/`api`/`admin`/...).
- [x] No SQL (Mongo only); regex search escaped (`escapeRegex`).

### Performance
- Resolve cache hit → 1 Redis GET + 1 async Mongo $inc. p95 mục tiêu <80ms. Đo thật → QC.

### Deploy runbook (ops, F-089)
1. DNS: GoDaddy A `s.5bib.com → 157.10.42.171`.
2. nginx: clone vhost `result-fe-dev.5bib.com` → `s.5bib.com` proxy_pass frontend container (3082).
3. SSL: `certbot --nginx -d s.5bib.com`.
4. (Optional) backend env `SHORTLINK_BASE_HOST=s.5bib.com` (default đã đúng).
5. Verify: `curl -I https://s.5bib.com/<code>` → 302 Location = targetUrl.
