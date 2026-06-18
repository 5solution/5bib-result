# FEATURE-089: PRD — Short link rút gọn URL (s.5bib.com)

**Status:** 🔵 READY
**Last updated:** 2026-06-17
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` đầy đủ
- [x] Đã đọc `memory/codebase-map.md` phần `landing/` (pattern reuse) + `upload/`
- [x] Đã đọc `memory/known-issues.md` (vùng risk: middleware subdomain, route-order)
- [x] Đã verify code thật: `backend/src/main.ts:100` `setGlobalPrefix('api')`; `frontend/middleware.ts:58-124` pattern landing subdomain + `LANDING_RESERVED` set

---

## 📝 Short link rút gọn URL

**Goal:** BTC/sale dán link giải (URL dài, có dấu tiếng Việt) lên MXH bị vỡ/cắt/encode lỗi. Cần admin dán **bất kỳ URL nào** → ra short link ngắn `s.5bib.com/<code>` để cop đăng MXH sạch, click ra đúng đích.

**Scope:**
- ✅ **In scope:**
  - Module backend `short-links/` (Mongo collection + resolve API + admin CRUD + QR).
  - Trang admin quản lý link (list/tạo/sửa/xóa/copy/QR/đếm click).
  - Frontend redirect: `s.5bib.com/<code>` → 302 sang URL đích (qua middleware rewrite + route handler).
  - Shortener **tổng quát**: targetUrl là URL http(s) bất kỳ.
  - Custom alias (vanity code) tùy chọn.
  - Đếm tổng click mỗi link.
- ❌ **Out of scope (Phase 2):**
  - Analytics theo ngày/nguồn/referrer/UTM passthrough.
  - Auto-sinh link từ danh sách giải.
  - Mở cho merchant/sale tạo link (v1 admin only).
  - Link expiry theo thời gian.
  - Cấu hình DNS/nginx/SSL cho `s.5bib.com` (task ops — xem §Technical Mandates PAUSE).

---

## 👤 User Stories & Business Rules

### User Stories
- As a **5BIB Back-Office Admin**, I want to dán 1 URL dài bất kỳ → nhận short link `s.5bib.com/<code>` để cop đăng Facebook/Zalo không bị lỗi.
- As a **5BIB Back-Office Admin**, I want to đặt **alias dễ nhớ** (vd `laocai2026`) để link đẹp cho campaign.
- As a **5BIB Back-Office Admin**, I want to **sửa URL đích** của 1 link sau khi tạo (vd trang event đổi slug) mà giữ nguyên short link đã in/đăng.
- As a **5BIB Back-Office Admin**, I want to **tải QR** của short link để in lên poster/standee.
- As a **5BIB Back-Office Admin**, I want to **xem số click** mỗi link để biết campaign nào hiệu quả.
- As an **Anonymous Visitor**, I want to click `s.5bib.com/<code>` → được đưa tới đúng trang đích ngay lập tức.

### Business Rules

- **BR-01:** `code` là **case-sensitive base62** (`[A-Za-z0-9]`), độ dài mặc định **6 ký tự** sinh ngẫu nhiên (`SHORTLINK_CODE_LENGTH = 6`, ~56,8 tỷ tổ hợp). Sinh xong check unique, đụng thì retry tối đa 5 lần.
- **BR-02:** **Custom alias** (tùy chọn): admin tự nhập, regex `^[A-Za-z0-9_-]{3,32}$`. Nếu nhập alias → dùng làm `code` (bỏ qua random). Alias đã tồn tại → 409.
- **BR-03:** `code` KHÔNG được trùng **reserved words**: `SHORTLINK_RESERVED = {'r','api','admin','health','www','result','app','s','go','assets','static','favicon.ico','robots.txt'}`. Vi phạm → 400.
- **BR-04:** `targetUrl` BẮT BUỘC là URL hợp lệ có protocol `http`/`https` (chống open-redirect tới `javascript:`/`data:`). Tối đa 2048 ký tự.
- **BR-05:** Redirect dùng **HTTP 302** (Found, tạm thời) — KHÔNG 301 — vì `targetUrl` sửa được, 301 bị browser/CDN cache cứng sẽ kẹt URL cũ.
- **BR-06:** Mỗi lần resolve thành công → tăng `clickCount` (atomic `$inc`), **fire-and-forget** (KHÔNG chặn tốc độ redirect).
- **BR-07:** Link `active = false` → resolve trả **404** (không redirect). Admin disable thay vì xóa để giữ lịch sử.
- **BR-08:** Tạo/sửa/xóa link CHỈ **Back-Office Admin** (`LogtoAdminGuard`). Resolve là **public** (no auth) + rate-limit IP.
- **BR-09:** Resolve KHÔNG nối query string client gửi vào targetUrl (v1 — passthrough = out of scope). `s.5bib.com/abc?x=1` → redirect tới `targetUrl` nguyên bản.
- **BR-10:** Link KHÔNG có hạn dùng (v1). Tồn tại tới khi admin disable/xóa.
- **BR-11:** Response API công khai (resolve) + response admin list KHÔNG được leak `_id` raw, `__v`, `createdBy`. Inject alias `id = _id.toString()` (Pre-Deploy Checklist — strip `_id` phải có alias).
- **BR-12:** Resolve cache-aside Redis `shortlink:code:<code>` TTL 3600s; mọi mutation (update/delete/disable) → DEL cache key tương ứng. Anti-stampede SETNX `shortlink-lock:<code>` (port pattern `landing-lock`), retry 3×200ms rồi direct-query fallback.

---

## 🖥️ UI/UX Flow

### 2.1 Route structure

| App | Route | Access | Mô tả |
|-----|-------|--------|-------|
| admin | `/short-links` (`admin/src/app/(dashboard)/short-links/page.tsx`) | Admin only (page-gate `isAdmin`) | Trang quản lý short link |
| frontend | `s.5bib.com/<code>` → rewrite `/r/<code>` (`frontend/app/r/[code]/route.ts`) | Public | Redirect handler |
| backend | `/api/short-links/*` | Admin (mutation) / Public (resolve) | API |

### 2.2 Layout — Trang `/short-links` (admin)

- **Header:** Tiêu đề "Link rút gọn" + nút primary **"+ Tạo link"** (góc phải) + ô search (lọc theo title/code/targetUrl).
- **Body:** Bảng 6 cột:
  | Short link | Tiêu đề | URL đích | Click | Trạng thái | Thao tác |
  - **Short link**: `s.5bib.com/<code>` (font-mono) + icon **Copy**.
  - **Tiêu đề**: `title` hoặc "—".
  - **URL đích**: `targetUrl` truncate 1 dòng + tooltip full + link mở tab mới.
  - **Click**: `clickCount` (number, vi-VN locale).
  - **Trạng thái**: Badge "Đang bật" (xanh) / "Đã tắt" (xám).
  - **Thao tác**: nút **QR** (mở dialog QR + tải PNG), **Sửa** (mở dialog), **Tắt/Bật** (toggle active), **Xóa** (confirm).
- **Footer:** Pagination (20/trang) + tổng số link.

### 2.3 UI Step-by-Step — Tạo link

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Click "+ Tạo link" header | Mở Dialog "Tạo link rút gọn" (sm:max-w-md), focus field URL đích | onClick | Dialog open |
| 2 | Dán URL vào "URL đích" | Validate realtime: phải http(s) | onChange | state.targetUrl |
| 3 | (Tùy chọn) nhập "Tiêu đề" | — | onChange | state.title |
| 4 | (Tùy chọn) nhập "Alias tùy chỉnh" | Helper text "Để trống = tự sinh ngẫu nhiên". Validate regex realtime | onChange | state.customAlias |
| 5 | Click "Tạo" | Button disabled khi targetUrl trống/sai; loading "Đang tạo..." | POST `/api/short-links` | Submitting |
| 6 | Server 201 | Dialog đóng, toast xanh "Đã tạo link", list refresh, hiện row mới + auto-copy short link | invalidate `['short-links']` | Data refreshed |
| 6b | Server 409 (alias trùng) | Field alias đỏ "Alias đã tồn tại, chọn cái khác", giữ data | error | Validation error |
| 6c | Server 400 (reserved/sai URL) | Field tương ứng đỏ + message VN | error | Validation error |

### 2.4 Buttons Specification

| Button label | Position | Default | Disabled | Loading | Action | Confirm? |
|--------------|----------|---------|----------|---------|--------|----------|
| "+ Tạo link" | Header right | Primary blue | KHÔNG | N/A | Mở dialog tạo | NO |
| "Tạo" | Dialog footer | Primary | Khi targetUrl trống/sai format | Spinner "Đang tạo..." | POST `/api/short-links` | NO |
| "Lưu" | Dialog sửa | Primary | Khi targetUrl trống/sai | Spinner "Đang lưu..." | PATCH `/api/short-links/:id` | NO |
| Copy (icon) | Row + sau tạo | Ghost icon | KHÔNG | Đổi icon ✓ 1.5s | `navigator.clipboard.writeText(shortUrl)` | NO |
| "QR" | Row action | Outline | KHÔNG | N/A | Mở dialog QR (ảnh `/api/short-links/:id/qr.png`) + nút Tải | NO |
| "Sửa" | Row action | Ghost | KHÔNG | N/A | Mở dialog sửa (targetUrl/title/active) | NO |
| "Tắt"/"Bật" | Row action | Ghost | KHÔNG | Spinner nhỏ | PATCH `/api/short-links/:id` `{active}` | NO |
| "Xóa" | Row action | Ghost red | KHÔNG | N/A | DELETE `/api/short-links/:id` | YES — "Xóa link s.5bib.com/{code}?" |

### 2.5 Form Fields Specification — Dialog tạo/sửa

| Field | UI label | Type | Required | Validation | Error message | Default |
|-------|----------|------|----------|------------|---------------|---------|
| `targetUrl` | URL đích | url | ✅ | regex `^https?://.+`, max 2048, trim | "URL phải bắt đầu http:// hoặc https://" | "" |
| `title` | Tiêu đề (tùy chọn) | text | ⚪ | max 255, trim | "Tiêu đề tối đa 255 ký tự" | "" |
| `customAlias` | Alias tùy chỉnh (tùy chọn) | text | ⚪ (chỉ khi tạo) | regex `^[A-Za-z0-9_-]{3,32}$`, không reserved | "Alias chỉ gồm chữ/số/_/- (3–32 ký tự)" | "" |
| `active` | Đang bật | switch | ⚪ (chỉ dialog sửa) | boolean | — | true |

### 2.6 Field source table

| Field UI | Data source | Format | Empty |
|----------|-------------|--------|-------|
| Short link | `s.5bib.com/` + `link.code` | font-mono | n/a |
| Tiêu đề | `link.title` | text VN | "—" |
| URL đích | `link.targetUrl` | truncate + tooltip | n/a |
| Click | `link.clickCount` | number vi-VN | "0" |
| Trạng thái | `link.active` | Badge VN | n/a |

### 2.7 UI States (đủ 9 state)
- **Loading**: skeleton 5 rows.
- **Empty** (chưa có link): icon link + "Chưa có link nào" + CTA "+ Tạo link".
- **Data**: bảng.
- **Filtered + empty**: "Không có link khớp tìm kiếm" + nút "Xóa tìm kiếm".
- **Error fetch**: toast đỏ + nút "Thử lại".
- **Submitting**: button loading, disable form.
- **Success**: toast xanh + list refresh + auto-copy.
- **Validation error**: field-level đỏ + message VN.
- **Confirm dialog**: destructive variant cho Xóa.

---

## 🛠️ Technical Mandates (For Coder)

### 3.1 DB / Cache / Infra

**MongoDB — collection MỚI `short_links`:**
| Field | Type | Note |
|-------|------|------|
| `_id` | ObjectId | auto |
| `code` | string | **unique index**, case-sensitive |
| `targetUrl` | string | max 2048 |
| `title` | string? | optional |
| `clickCount` | number | default 0 |
| `active` | boolean | default true |
| `createdBy` | string? | Logto userId (KHÔNG leak ra API) |
| `createdAt`/`updatedAt` | Date | `timestamps: true` |

Index: `{ code: 1 }` unique. (Tùy chọn `{ createdAt: -1 }` cho list sort.)

**Redis (đăng ký vào CLAUDE.md registry khi deploy):**
| Key | Mục đích | TTL |
|-----|----------|-----|
| `shortlink:code:<code>` | Cache resolve (`{targetUrl, active}` JSON) | 3600s |
| `shortlink-lock:<code>` | SETNX anti-stampede cache-miss | 5s |

**S3:** KHÔNG dùng.

**Migration:** KHÔNG (collection mới, rỗng). KHÔNG cần PAUSE migration.

**🛑 PAUSE — Infra `s.5bib.com` (ops, KHÔNG phải code):** cần DNS A record GoDaddy `s.5bib.com → 157.10.42.171` + nginx vhost `s.5bib.com → frontend container (3082)` (clone vhost landing subdomain) + SSL certbot. Code chạy được trên domain hiện có để test (`result-fe-dev.5bib.com/r/<code>`); `s.5bib.com` chỉ là host đẹp production. **Danny/ops làm khi deploy.**

### 3.2 Backend Endpoint Specification

**Resolve (public):**
| Element | Spec |
|---------|------|
| Method | GET |
| Path | `/api/short-links/resolve/:code` |
| Auth | PUBLIC (no guard) + `@UseGuards(ThrottlerGuard)` (rate-limit IP, vd 60/min) |
| Response DTO | `ResolveShortLinkDto` `{ targetUrl: string }` |
| Status | 200 (active link) / 404 (không tồn tại hoặc `active=false`) / 429 (rate-limit) |
| Side effects | Redis cache-aside; `clickCount` $inc fire-and-forget; KHÔNG leak field nội bộ |

**Create (admin):**
| Element | Spec |
|---------|------|
| Method | POST |
| Path | `/api/short-links` |
| Auth | `@UseGuards(LogtoAdminGuard)` class-level |
| Request DTO | `CreateShortLinkDto` |
| Response DTO | `ShortLinkResponseDto` |
| Status | 201 / 400 (URL sai, reserved) / 401 / 403 / 409 (alias dup) / 500 |
| Side effects | Insert Mongo; KHÔNG cache (cache lazy khi resolve) |

**List (admin):** `GET /api/short-links?search=&page=&pageSize=` → `{ items: ShortLinkResponseDto[], total, page, pageSize }`. Guard admin.
**Update (admin):** `PATCH /api/short-links/:id` body `UpdateShortLinkDto` → `ShortLinkResponseDto`. DEL `shortlink:code:<code>`. Status 200/400/404/409.
**Delete (admin):** `DELETE /api/short-links/:id` → 204. DEL cache.
**QR (admin):** `GET /api/short-links/:id/qr.png` → `image/png` (QR của `https://s.5bib.com/<code>`, dùng lib `qrcode` đã có). Guard admin.

### 3.3 DTO Field-Level Spec

```typescript
export class CreateShortLinkDto {
  @ApiProperty({ description: 'URL đích (http/https)', maxLength: 2048, example: 'https://5bib.com/vi/events/lao-cai-marathon-2026' })
  @IsString() @IsNotEmpty() @MaxLength(2048)
  @Matches(/^https?:\/\/.+/i, { message: 'URL phải bắt đầu http:// hoặc https://' })
  targetUrl!: string;

  @ApiPropertyOptional({ description: 'Tiêu đề', maxLength: 255 })
  @IsOptional() @IsString() @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'Alias tùy chỉnh (3–32, [A-Za-z0-9_-])', example: 'laocai2026' })
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9_-]{3,32}$/, { message: 'Alias chỉ gồm chữ/số/_/- (3–32 ký tự)' })
  customAlias?: string;
}

export class UpdateShortLinkDto {
  @ApiPropertyOptional({ maxLength: 2048 })
  @IsOptional() @IsString() @MaxLength(2048) @Matches(/^https?:\/\/.+/i, { message: 'URL phải bắt đầu http:// hoặc https://' })
  targetUrl?: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional() @IsString() @MaxLength(255)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  active?: boolean;
}

export class ShortLinkResponseDto {
  @ApiProperty() id!: string;          // alias từ _id, KHÔNG leak _id raw
  @ApiProperty() code!: string;
  @ApiProperty() shortUrl!: string;    // computed: `https://${SHORTLINK_BASE_HOST}/${code}`
  @ApiProperty() targetUrl!: string;
  @ApiPropertyOptional() title?: string;
  @ApiProperty() clickCount!: number;
  @ApiProperty() active!: boolean;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class ResolveShortLinkDto {
  @ApiProperty() targetUrl!: string;
}
```

**Constant:** `SHORTLINK_BASE_HOST = process.env.SHORTLINK_BASE_HOST ?? 's.5bib.com'` (để dev override). `SHORTLINK_CODE_LENGTH = 6`, `SHORTLINK_RESERVED` set (BR-03).

### 3.4 Frontend / Admin

**Frontend (public app) — redirect:**
- ➕ `frontend/app/r/[code]/route.ts` — **Route Handler** GET. Server-side `fetch(`${process.env.BACKEND_URL}/api/short-links/resolve/${code}`)`. 200 → `NextResponse.redirect(targetUrl, 302)`. 404 → `NextResponse.redirect('https://5bib.com', 302)` hoặc render trang "Link không tồn tại" (chốt: redirect về `https://5bib.com`).
- ✏️ `frontend/middleware.ts` — thêm xử lý host `s.5bib.com`: rewrite `s.5bib.com/<code>` → `/r/<code>` (đặt TRƯỚC catch-all landing). Thêm `'s'` vào `LANDING_RESERVED` để không bị bắt nhầm thành landing slug.

**Admin app — management UI:**
- ➕ `admin/src/app/(dashboard)/short-links/page.tsx` — Server Component shell + Client table.
- ➕ `admin/src/components/short-links/ShortLinksClient.tsx` (`'use client'`) — table + dialogs.
- ➕ `admin/src/components/short-links/ShortLinkDialog.tsx` (`'use client'`) — form tạo/sửa.
- ➕ `admin/src/components/short-links/QrDialog.tsx` (`'use client'`) — hiện QR + tải.
- ➕ `admin/src/lib/short-links-api.ts` — thin wrapper qua `/api/*` proxy (pattern `landing-api.ts`).
- ➕ `admin/src/lib/short-links-hooks.ts` — TanStack Query hooks (`useShortLinks`, `useCreateShortLink`, `useUpdateShortLink`, `useDeleteShortLink`), invalidate `['short-links']`.
- ✏️ `admin/src/lib/nav-groups.ts` — thêm entry nav "Link rút gọn" (requireRole `admin`).

**SDK regen:** Admin dùng hand-typed wrapper (pattern `landing-api.ts`) → **KHÔNG bắt buộc** `generate:api`. Nếu Coder chọn dùng generated SDK thì chạy `pnpm generate:api`.

### 3.5 PAUSE flags
- 🛑 Infra `s.5bib.com` DNS+nginx+SSL (ops, không block code/test).
- 🛑 ENV mới `SHORTLINK_BASE_HOST` (backend) — thêm vào `.env` + docker-compose. KHÔNG secret.
- ✅ KHÔNG `pnpm install` (Mongoose + qrcode + ThrottlerGuard đã có).
- ✅ KHÔNG migration, KHÔNG đụng fee/auth/order.

---

## 🛡️ Testing Mandates (For QC)

### 4.1 Backend Test Cases

#### TC-01 Happy — Tạo link random code
| Element | Value |
|---------|-------|
| Method/URL | POST `/api/short-links` |
| Headers | `Authorization: Bearer <admin_token>` |
| Body | `{"targetUrl":"https://5bib.com/vi/events/lao-cai-marathon-2026","title":"Lào Cai 2026"}` |
| Expected status | 201 |
| Expected shape | `{id, code(6 ký tự), shortUrl:"https://s.5bib.com/<code>", targetUrl, title:"Lào Cai 2026", clickCount:0, active:true, createdAt, updatedAt}` |
| MUST NOT leak | `_id` raw, `__v`, `createdBy` |
| Side effect | Mongo `short_links` +1 doc, `code` unique |

#### TC-02 Custom alias happy
- Body `{"targetUrl":"https://5bib.com/x","customAlias":"laocai2026"}` → 201, `code="laocai2026"`.

#### TC-03 Validation
- targetUrl `"ftp://x"` → 400 "URL phải bắt đầu http:// hoặc https://".
- targetUrl `"javascript:alert(1)"` → 400.
- customAlias `"ab"` (quá ngắn) → 400.
- customAlias `"admin"` (reserved) → 400.

#### TC-04 Conflict — alias dup
- Tạo alias `"laocai2026"` 2 lần → lần 2 = 409.

#### TC-05 Auth
- POST không token → 401. GET list không token → 401.

#### TC-06 Resolve happy + 404
- Tạo link code X → GET `/api/short-links/resolve/X` → 200 `{targetUrl}`, `clickCount` tăng (verify Mongo).
- GET `/api/short-links/resolve/khongtontai` → 404.
- Disable link X (`active=false`) → resolve X → 404.

#### TC-07 Concurrent code-gen (race)
- `Promise.all` 10× POST cùng targetUrl (random code) → 10 doc, 10 code KHÁC nhau, 0 lỗi unique.

#### TC-08 Update invalidates cache
- Resolve X (warm cache) → PATCH X đổi targetUrl → resolve X trả targetUrl MỚI (cache đã DEL).

#### TC-09 Boundary
- targetUrl đúng 2048 ký tự → 201; 2049 → 400.
- alias đúng 32 ký tự → 201; 33 → 400.

### 4.2 Frontend redirect (route handler) test / E2E
| TC | Journey | Steps | Expected |
|----|---------|-------|----------|
| E2E-01 | Redirect OK | GET `/r/<code>` (link active) | 302 Location = targetUrl |
| E2E-02 | Redirect 404 | GET `/r/khongtontai` | 302 về `https://5bib.com` |
| E2E-03 | Admin tạo + copy | Admin: mở dialog, dán URL, Tạo | Toast xanh, row mới, clipboard = shortUrl |
| E2E-04 | Admin alias dup | Tạo alias đã tồn tại | Field đỏ "Alias đã tồn tại" |
| E2E-05 | Admin sửa URL đích | Sửa link → đổi targetUrl | Row cập nhật, resolve trả URL mới |

### 4.3 Security Checks
- [ ] POST/PATCH/DELETE/list/QR có `LogtoAdminGuard` → 401 khi thiếu token.
- [ ] Resolve public KHÔNG yêu cầu auth nhưng có ThrottlerGuard.
- [ ] `targetUrl` chỉ http/https (chống open-redirect `javascript:`/`data:`).
- [ ] Response KHÔNG leak `_id`/`__v`/`createdBy` (BR-11).
- [ ] Reserved alias bị chặn (không tạo được code đụng route `r`/`api`/`admin`).

### 4.4 Performance SLA
- Resolve p95 **< 80ms** (cache hit).
- Cache hit ratio sau 1 phút > 80%.
- 10× concurrent resolve cùng code → KHÔNG stampede (SETNX lock), kết quả nhất quán.

---

## 📌 Answers to Manager's PAUSE conditions (file 00)

- **Nơi phục vụ redirect (A backend / B frontend):** → **B — Frontend** (route handler `app/r/[code]/route.ts` + middleware rewrite). Lý do BA chốt: (1) URL ngắn nhất `s.5bib.com/<code>` ở root path (backend bị `setGlobalPrefix('api')` → phải dùng `/r/` hoặc đụng global config); (2) **reuse pattern middleware landing subdomain đã production-tested** (F-083); (3) zero touch backend global prefix. Backend chỉ giữ resolve API sạch `/api/short-links/resolve/:code`. *(Manager xác nhận lại ở `/5bib-plan`.)*
- **Redirect type:** → **302** (BR-05, link sửa được).
- **Custom alias:** → **Có** (BR-02), regex `^[A-Za-z0-9_-]{3,32}$` + reserved check.
- **Độ dài/charset code random:** → base62 6 ký tự (BR-01).
- **Analytics click:** → v1 đếm tổng `clickCount` $inc (BR-06). Theo ngày/nguồn = Phase 2.
- **Ai tạo link:** → admin only (BR-08).
- **Auto-sinh từ danh sách giải:** → Phase 2 (out of scope).
- **QR code:** → **Có** — endpoint `/api/short-links/:id/qr.png` + dialog tải.
- **Expiry:** → **Không** (BR-10).
- **Query passthrough:** → **Không** v1 (BR-09).

---

## ✅ Status
- [x] READY — sẵn sàng `/5bib-plan`

## 🔗 Next step
Danny chạy: `/5bib-plan FEATURE-089-url-short-link`
