# Articles & Help Center — API Reference (P1)

> **Module:** `backend/src/modules/articles/`
> **Phase:** A (backend complete) → handed off to Phase B (admin UI) + Phase C (public site)
> **Base URL (dev):** `http://localhost:8081/api`
> **Base URL (prod):** `https://result.5bib.com/api`
> **Auth scheme:** Logto JWT (Bearer). Admin endpoints require role=admin via `LogtoAdminGuard`.
> **Source verified:** 2026-04-27 against `backend/src/modules/articles/`

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Common Conventions](#common-conventions)
3. [Public — Articles](#public--articles)
   - [GET /articles/latest](#get-articleslatest)
   - [GET /articles/categories](#get-articlescategories)
   - [GET /articles](#get-articles)
   - [GET /articles/:slug](#get-articlesslug)
   - [POST /articles/:slug/view](#post-articlesslugview)
   - [POST /articles/:slug/helpful](#post-articlessluphelpful)
4. [Public — Article Categories](#public--article-categories)
   - [GET /article-categories](#get-article-categories)
5. [Admin — Articles (LogtoAdminGuard)](#admin--articles)
   - [GET /admin/articles](#get-adminarticles)
   - [GET /admin/articles/stats](#get-adminarticlesstats)
   - [GET /admin/articles/:id](#get-adminarticlesid)
   - [POST /admin/articles](#post-adminarticles)
   - [PATCH /admin/articles/:id](#patch-adminarticlesid)
   - [POST /admin/articles/:id/publish](#post-adminarticlesidpublish)
   - [POST /admin/articles/:id/unpublish](#post-adminarticlesidunpublish)
   - [DELETE /admin/articles/:id](#delete-adminarticlesid)
   - [POST /admin/articles/:id/restore](#post-adminarticlesidrestore)
6. [Admin — Article Categories (LogtoAdminGuard)](#admin--article-categories)
   - [GET /admin/article-categories](#get-adminarticle-categories)
   - [GET /admin/article-categories/:id](#get-adminarticle-categoriesid)
   - [POST /admin/article-categories](#post-adminarticle-categories)
   - [PATCH /admin/article-categories/reorder](#patch-adminarticle-categoriesreorder)
   - [PATCH /admin/article-categories/:id](#patch-adminarticle-categoriesid)
   - [DELETE /admin/article-categories/:id](#delete-adminarticle-categoriesid)
7. [Data Models](#data-models)
8. [Business Rules Index](#business-rules-index)
9. [Cache Strategy](#cache-strategy)

---

## Quick Reference

| # | Method | Path | Auth | Cache | Rate Limit | BR |
|---|---|---|---|---|---|---|
| 1 | GET | `/articles/latest` | Public | 300s | — | BR-01, BR-06 |
| 2 | GET | `/articles/categories` | Public | — | — | — |
| 3 | GET | `/articles` | Public | 120s | — | BR-01, BR-06 |
| 4 | GET | `/articles/:slug` | Public | 600s | — | BR-01 |
| 5 | POST | `/articles/:slug/view` | Public | — | 1/IP/5min | — |
| 6 | POST | `/articles/:slug/helpful` | Public | — | 1/IP/24h | — |
| 7 | GET | `/article-categories` | Public | 300s | — | — |
| 8 | GET | `/admin/articles` | Admin | — | — | — |
| 9 | GET | `/admin/articles/stats` | Admin | — | — | — |
| 10 | GET | `/admin/articles/:id` | Admin | — | — | — |
| 11 | POST | `/admin/articles` | Admin | invalidates | — | BR-03 |
| 12 | PATCH | `/admin/articles/:id` | Admin | invalidates | — | — |
| 13 | POST | `/admin/articles/:id/publish` | Admin | invalidates | — | BR-02, BR-09 |
| 14 | POST | `/admin/articles/:id/unpublish` | Admin | invalidates | — | — |
| 15 | DELETE | `/admin/articles/:id` | Admin | invalidates | — | BR-08 |
| 16 | POST | `/admin/articles/:id/restore` | Admin | invalidates | — | BR-08 |
| 17 | GET | `/admin/article-categories` | Admin | — | — | — |
| 18 | GET | `/admin/article-categories/:id` | Admin | — | — | — |
| 19 | POST | `/admin/article-categories` | Admin | invalidates | — | — |
| 20 | PATCH | `/admin/article-categories/reorder` | Admin | invalidates | — | — |
| 21 | PATCH | `/admin/article-categories/:id` | Admin | invalidates | — | cascade |
| 22 | DELETE | `/admin/article-categories/:id` | Admin | invalidates | — | 409-if-in-use |

---

## Common Conventions

### Auth header
```http
Authorization: Bearer <logto_jwt_access_token>
```

Public endpoints: header optional/ignored.
Admin endpoints: required, must have `role=admin` claim. Missing token → `401`. Wrong role → `403`.

### Standard error shape (NestJS default)
```json
{
  "statusCode": 404,
  "message": "Không tìm thấy bài viết",
  "error": "Not Found"
}
```

For validation errors (`422`/`400`):
```json
{
  "statusCode": 422,
  "message": "Thiếu trường bắt buộc khi publish",
  "missing": ["coverImageUrl", "content"]
}
```

### ID conventions
- Public: identify article by **`slug`** (URL-safe string). MongoDB `_id` NEVER exposed publicly.
- Admin: identify article by **`id`** (string form of MongoDB `_id`, alias exposed in response as `id`).

### Pagination
Standard envelope:
```typescript
{
  items: T[],
  total: number,
  page: number,        // 1-indexed
  totalPages: number
}
```

### TanStack Query keys (recommended)
```typescript
['articles', 'public', filters]              // public list
['articles', 'latest', { type, product, limit }]
['articles', 'detail', slug]
['articles', 'admin', 'list', filters]
['articles', 'admin', 'detail', id]
['articles', 'admin', 'stats']
['article-categories', 'public', type]
['article-categories', 'admin']
['article-categories', 'admin', id]
```

---

## PUBLIC — Articles

### GET /articles/latest

Lấy N bài đăng mới nhất cho **homepage widget** (`5bib.com`, `5sport.vn`).

**Auth:** none
**Cache:** Redis `articles:latest:{type}:{product}:{limit}` — TTL **300s**
**Business rules:** BR-01 (chỉ trả `status=published`), BR-06 (sort `publishedAt DESC`)

**Query params:**

| Field | Type | Required | Default | Validation |
|---|---|---|---|---|
| `type` | `'news' \| 'help'` | optional | — | enum |
| `product` | `'5bib' \| '5sport' \| '5ticket' \| '5pix' \| 'all'` | optional | — | enum. Filter `$in: [product, 'all']` — bài có `products: ['all']` luôn match mọi product. |
| `limit` | `number` | optional | `10` | `1 ≤ x ≤ 20` |

**Response 200:** `ArticleCardDto[]`
```json
[
  {
    "id": "6620a1...",
    "slug": "huong-dan-dang-ky-giai-chay",
    "title": "Hướng dẫn đăng ký giải chạy 5BIB",
    "excerpt": "Cách đăng ký giải chạy nhanh nhất...",
    "coverImageUrl": "https://s3.../cover.jpg",
    "type": "help",
    "products": ["5bib"],
    "category": "dang-ky-giai",
    "authorName": "Nguyễn Minh",
    "authorAvatar": "https://logto.../avatar.jpg",
    "publishedAt": "2026-04-25T03:12:00.000Z",
    "readTimeMinutes": 5,
    "featured": true
  }
]
```

**Frontend usage:**
- `5bib.com` homepage Server Component — `fetch('/api/articles/latest?product=5bib&limit=10', { next: { revalidate: 300 } })`
- `5sport.vn` widget — `fetch('/api/articles/latest?product=5sport&limit=10', ...)`
- Featured selection: filter `.find(a => a.featured)` ở frontend (P1-03 = nhiều bài featured được phép)

---

### GET /articles/categories

**LEGACY** — aggregate-based category list từ articles. Đề xuất dùng [`GET /article-categories`](#get-article-categories) thay (có icon, tint, description từ collection riêng).

**Auth:** none
**Cache:** none

**Query params:**
| Field | Type | Default |
|---|---|---|
| `type` | `'news' \| 'help'` | optional |

**Response 200:**
```json
[
  { "category": "dang-ky-giai", "count": 12 },
  { "category": "thanh-toan", "count": 8 }
]
```

**Note:** Trả raw category slug + count, KHÔNG có metadata. Phase B/C dùng `/api/article-categories` để có icon + tint + name display.

---

### GET /articles

Paginated list bài đã publish — dùng cho landing page `news.5bib.com` / `hotro.5bib.com` grid + filter.

**Auth:** none
**Cache:** Redis `articles:list:{type}:{product}:{category}:{page}:{limit}` — TTL **120s**
**Business rules:** BR-01, BR-06

**Query params:**

| Field | Type | Required | Default | Validation |
|---|---|---|---|---|
| `type` | `'news' \| 'help'` | optional | — | enum |
| `product` | enum | optional | — | enum |
| `category` | `string` | optional | — | category slug (match exact) |
| `page` | `number` | optional | `1` | `≥ 1` |
| `limit` | `number` | optional | `12` | `1 ≤ x ≤ 50` |

**Response 200:** `PaginatedArticlesDto`
```json
{
  "items": [/* ArticleCardDto[] */],
  "total": 47,
  "page": 1,
  "totalPages": 4
}
```

**Frontend usage:**
- `news.5bib.com` `/` page (Server Component) — `revalidate: 120`
- `hotro.5bib.com` `/` "Mới nhất" section — same endpoint, filter `type=help`

---

### GET /articles/:slug

Detail page bài viết public.

**Auth:** none
**Cache:** Redis `articles:detail:{slug}` — TTL **600s**. Invalidated mỗi khi admin write trên bài này hoặc bất kỳ bài nào (full flush).
**Business rules:** BR-01 (404 nếu draft hoặc isDeleted)

**Path params:**

| Field | Type | Validation |
|---|---|---|
| `slug` | `string` | (recommended add validation in service — currently raw passthrough) |

**Response 200:** `ArticleDetailDto` (extends `ArticleCardDto`)
```json
{
  "id": "6620a1...",
  "slug": "huong-dan-dang-ky-giai-chay",
  "title": "Hướng dẫn đăng ký giải chạy 5BIB",
  "excerpt": "Cách đăng ký giải chạy nhanh nhất...",
  "coverImageUrl": "https://s3.../cover.jpg",
  "type": "help",
  "products": ["5bib"],
  "category": "dang-ky-giai",
  "authorName": "Nguyễn Minh",
  "authorAvatar": "https://logto.../avatar.jpg",
  "publishedAt": "2026-04-25T03:12:00.000Z",
  "readTimeMinutes": 5,
  "featured": true,
  "content": "<p>...sanitized HTML...</p>",
  "seoTitle": "Hướng dẫn đăng ký giải chạy",
  "seoDescription": "Cách đăng ký giải chạy nhanh nhất trên 5BIB",
  "tableOfContents": [
    { "id": "tao-tai-khoan-5bib", "text": "Tạo tài khoản 5BIB", "level": 2 },
    { "id": "chon-giai-va-cu-ly", "text": "Chọn giải và cự ly phù hợp", "level": 2 }
  ],
  "related": [/* ArticleCardDto[3] — same type + ≥1 product overlap */],
  "helpfulYes": 424,
  "helpfulNo": 12,
  "viewCount": 12450
}
```

**Response 404:** Bài draft / soft-deleted / không tồn tại

**Frontend usage:**
- `news.5bib.com/[slug]` + `hotro.5bib.com/[slug]` Server Component
- `generateMetadata` dùng `seoTitle`/`seoDescription`/`coverImageUrl` cho OG meta
- Render `tableOfContents` ở sidebar sticky 220px (per design)
- Render `related` ở section "Bài viết liên quan" cuối trang
- Hiển thị `helpfulYes`/`helpfulNo` ở widget feedback cuối bài

---

### POST /articles/:slug/view

Đếm lượt xem bài viết — dedup per IP per 5 phút qua Redis SETNX.

**Auth:** none
**Rate limit:** `ratelimit:article-view:{slug}:{ip}` SETNX TTL **300s**
- Hit lần đầu trong window → tăng `viewCount`, trả `alreadyCounted: false`
- Hit lại trong window → KHÔNG tăng, trả `alreadyCounted: true` + counter hiện tại (silent — KHÔNG 429)

**Path params:** `slug: string`
**Body:** none

**Response 200:** `ViewCountResponseDto`
```json
{ "viewCount": 12451, "alreadyCounted": false }
```

**Response 404:** Bài draft / không tồn tại (rate-limit slot rolled back)

**Frontend usage:**
- Article detail page — gọi 1 lần khi mount (Client Component với `useEffect`):
  ```typescript
  useEffect(() => {
    fetch(`/api/articles/${slug}/view`, { method: 'POST' });
  }, [slug]);
  ```
- KHÔNG hiển thị `alreadyCounted` cho user
- Stats card "Lượt xem 30 ngày" trong admin → query DB trực tiếp, KHÔNG qua endpoint này

---

### POST /articles/:slug/helpful

Vote "Bài viết này có hữu ích không?" — dedup per IP per 24h.

**Auth:** none
**Rate limit:** `ratelimit:article-helpful:{slug}:{ip}` SETNX TTL **86400s**
- Vote lần đầu → tăng `helpfulYes` HOẶC `helpfulNo`, trả `alreadyVoted: false`
- Đã vote trong 24h → KHÔNG tăng, trả `alreadyVoted: true` + counters hiện tại

**Path params:** `slug: string`
**Body:** `HelpfulVoteDto`
```json
{ "helpful": true }
```
| Field | Type | Required | Validation |
|---|---|---|---|
| `helpful` | `boolean` | yes | `@IsBoolean()` |

**Response 200:** `HelpfulVoteResponseDto`
```json
{ "helpfulYes": 425, "helpfulNo": 12, "alreadyVoted": false }
```

**Response 404:** Bài draft / không tồn tại

**Cache invalidation:** Detail cache `articles:detail:{slug}` flushed sau vote thành công (counters fresh).

**Frontend usage:**
- Widget cuối bài viết:
  ```tsx
  // 'use client' — useState để disable button
  const [voted, setVoted] = useState(false);
  const handleVote = async (helpful: boolean) => {
    const r = await fetch(`/api/articles/${slug}/helpful`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ helpful })
    });
    const data = await r.json();
    if (data.alreadyVoted) toast('Bạn đã đánh giá bài này rồi');
    setVoted(true);
  };
  ```
- TOC sidebar callout "💡 Bài hữu ích? `{helpfulYes}` người đánh giá có ích" — render từ `helpfulYes` của detail response

---

## PUBLIC — Article Categories

### GET /article-categories

Danh mục có metadata (icon, tint, description) cho **hero category grid** ở `hotro.5bib.com` / `news.5bib.com`.

**Auth:** none
**Cache:** Redis `articles:categories:{type}` — TTL **300s**

**Query params:**

| Field | Type | Required | Default |
|---|---|---|---|
| `type` | `'news' \| 'help'` | optional | — |

Filter `type` match `$in: [type, 'both']` — categories với `type='both'` luôn xuất hiện ở cả 2 subdomain.

**Response 200:** `ArticleCategoryResponseDto[]` (sorted by `order ASC, name ASC`)
```json
[
  {
    "id": "6620b2...",
    "slug": "dang-ky-giai",
    "name": "Đăng ký giải",
    "type": "help",
    "icon": "📖",
    "tint": "#1D49FF",
    "description": "Hướng dẫn từ A-Z",
    "order": 0,
    "isActive": true,
    "articleCount": 12
  }
]
```

**Frontend usage:**
- `hotro.5bib.com` Hero categories grid (Server Component, revalidate 300s):
  ```tsx
  const cats = await fetch('/api/article-categories?type=help', { next: { revalidate: 300 } }).then(r => r.json());
  // map → render card với icon, tint, count
  ```

---

## ADMIN — Articles

> **All require:** `Authorization: Bearer <token>` + role=admin (`LogtoAdminGuard`).
> Missing token → `401`. Wrong role → `403`.
> Invalid `:id` (not ObjectId) → `404` (KHÔNG 500 — đã handle qua `findByIdOrThrow`).

### GET /admin/articles

List bài viết admin (gồm draft + optionally deleted) với filter, search, pagination.

**Cache:** none (admin views always live)

**Query params:**

| Field | Type | Default | Validation |
|---|---|---|---|
| `type` | `'news' \| 'help'` | — | enum |
| `product` | enum | — | enum |
| `category` | `string` | — | exact match |
| `page` | `number` | `1` | `≥ 1` |
| `limit` | `number` | `20` | `1 ≤ x ≤ 50` |
| `status` | `'draft' \| 'published' \| 'all'` | `'all'` | enum |
| `q` | `string` | — | search title (regex escaped, ReDoS-safe) |
| `includeDeleted` | `boolean` | `false` | `true` để show soft-deleted |

**Response 200:** `PaginatedAdminArticlesDto`
```json
{
  "items": [
    {
      "id": "...", "slug": "...", "title": "...", /* card fields */,
      "content": "<p>...</p>",
      "seoTitle": "", "seoDescription": "",
      "status": "draft",
      "isDeleted": false,
      "createdAt": "2026-04-20T...", "updatedAt": "2026-04-25T...",
      "authorId": "logto-user-id",
      "viewCount": 0, "helpfulYes": 0, "helpfulNo": 0
    }
  ],
  "total": 47, "page": 1, "totalPages": 3
}
```

Sort: `updatedAt DESC` (most recently edited first).

**Frontend usage:**
- `/admin/articles` list page Server Component (initial), TanStack Query for filter/search refetch
- Query key: `['articles', 'admin', 'list', { type, status, q, page, limit }]`
- Search input debounce 300ms trước khi gọi

---

### GET /admin/articles/stats

Aggregate counts cho 4 stat cards ở `/admin/articles` page header.

**Response 200:** `ArticleStatsDto`
```json
{ "total": 47, "published": 38, "draft": 9, "deleted": 3 }
```

**Frontend usage:**
- 4 cards: "Tổng số bài" / "Đã đăng" / "Bản nháp" / "Đã xóa"
- Query key: `['articles', 'admin', 'stats']` — invalidate sau mọi mutation
- "Lượt xem 30 ngày" card: phải tự aggregate (chưa có endpoint, tạm hardcode hoặc Phase 2)

---

### GET /admin/articles/:id

Detail bài viết để load vào editor.

**Path params:** `id: string` (MongoDB ObjectId)

**Response 200:** `ArticleAdminDto` (cùng shape `items[0]` của list endpoint trên)

**Response 404:** Invalid ObjectId hoặc không tồn tại (kể cả soft-deleted nếu `findByIdLeanOrThrow` không filter — verify: hiện trả cả `isDeleted=true` để admin restore. ✅ correct).

**Frontend usage:**
- `/admin/articles/[id]/edit` page Server Component (initial fetch SSR)
- Editor body Client Component nhận data qua props

---

### POST /admin/articles

Tạo bài viết mới — luôn `status='draft'` ban đầu.

**Body:** `CreateArticleDto`
```json
{
  "title": "Hướng dẫn đăng ký giải chạy 5BIB",
  "slug": "huong-dan-dang-ky-giai-chay",
  "type": "help",
  "products": ["5bib"],
  "category": "dang-ky-giai",
  "content": "<p>...HTML...</p>",
  "excerpt": "Cách đăng ký...",
  "coverImageUrl": "https://s3.../cover.jpg",
  "seoTitle": "Hướng dẫn đăng ký giải chạy",
  "seoDescription": "Cách đăng ký giải chạy nhanh nhất",
  "featured": false
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `title` | string | ✅ | 3-200 chars |
| `slug` | string | optional | `/^[a-z0-9-]+$/`, max 120. Auto-gen từ title nếu omitted |
| `type` | enum | ✅ | `'news' \| 'help'` |
| `products` | string[] | ✅ | each `IsIn(ARTICLE_PRODUCTS)` |
| `category` | string | optional | max 80 |
| `content` | string | optional | HTML — sanitized server-side (sanitize-html whitelist) |
| `excerpt` | string | optional | max 160 |
| `coverImageUrl` | string | optional | URL string |
| `seoTitle` | string | optional | max 60 |
| `seoDescription` | string | optional | max 160 |
| `featured` | boolean | optional | default false |

**Business rules:**
- BR-03 — slug unique. Race condition handled qua retry 3x với suffix `Date.now().toString(36)`. Sau 3 attempts vẫn fail → `409 ConflictException`.
- Author info (`authorId`/`authorName`/`authorAvatar`) auto-extracted từ Logto JWT — KHÔNG truyền từ client.
- HTML content → `sanitize-html` whitelist:
  - Allowed: standard prose tags + `img`, `figure`, `figcaption`, `iframe` (YouTube/Vimeo only), `h1/h2/h3`, `video`, `source`
  - Stripped: `<script>`, `<style>`, `onerror`/`onload`/etc. handlers, `style` attribute
  - Auto-add `rel="noopener noreferrer" target="_blank"` cho links http(s)
- TOC auto-derived từ h2/h3 → ids assigned + stored in content

**Response 201:** `ArticleAdminDto`

**Response 409:** Slug conflict không thể resolve sau 3 retry.

**Cache invalidation:** flush all `articles:*` keys.

**Frontend usage:**
```typescript
// Admin "Tạo bài mới" button
const created = await sdk.adminArticlesCreate({
  title: 'Tạo nhanh',
  type: 'help',
  products: ['5bib']
});
router.push(`/admin/articles/${created.id}/edit`);
```

---

### PATCH /admin/articles/:id

Update bài viết — autosave-friendly partial update.

**Path params:** `id: string`
**Body:** `UpdateArticleDto` (= `PartialType(CreateArticleDto)`) — tất cả fields optional.

**Behavior:**
- 404 nếu invalid ObjectId hoặc không tồn tại hoặc đã soft-deleted
- Slug rename: nếu `slug` khác current → check unique (excluding self) → assign
- Content rewrite: re-sanitize + re-build TOC + re-compute readTimeMinutes
- KHÔNG đổi `status`/`publishedAt`/`isDeleted` qua endpoint này

**Response 200:** `ArticleAdminDto`

**Cache invalidation:** flush all `articles:*` keys.

**Frontend usage:**
- Autosave debounced 2s khi user gõ trong editor:
  ```typescript
  const debouncedSave = useMemo(() => debounce(async (patch) => {
    setSaveStatus('saving');
    await sdk.adminArticlesUpdate({ id, body: patch });
    setSaveStatus('saved');
  }, 2000), [id]);

  editor.on('update', () => debouncedSave({ content: editor.getHTML() }));
  ```
- Sidebar fields (title/slug/cover/excerpt/SEO) — same debounce
- Query invalidation: `['articles', 'admin', 'detail', id]` + `['articles', 'admin', 'list']` + stats

---

### POST /admin/articles/:id/publish

Đăng bài (set `status='published'`).

**Body:** none

**Behavior:**
- Validate **BR-02** required fields — nếu thiếu trả `422`:
  ```json
  {
    "statusCode": 422,
    "message": "Thiếu trường bắt buộc khi publish",
    "missing": ["coverImageUrl", "content"]
  }
  ```
  Required: `title`, `content`, `slug`, `type`, `coverImageUrl`
- **BR-09** — preserve `publishedAt`: chỉ set `publishedAt = NOW()` lần đầu publish. Re-publish KHÔNG đổi.
- 404 nếu invalid ObjectId / không tồn tại / soft-deleted

**Response 200:** `ArticleAdminDto` (updated status + publishedAt)

**Cache invalidation:** flush all `articles:*` keys.

**Frontend usage:**
- "Publish" button trong editor sidebar:
  ```typescript
  try {
    await sdk.adminArticlesPublish({ id });
    toast.success('Đã đăng bài');
    router.push('/admin/articles');
  } catch (err) {
    if (err.status === 422) {
      const missing = err.body.missing as string[];
      toast.error(`Thiếu: ${missing.join(', ')}`);
      // Highlight các field thiếu trong sidebar
    }
  }
  ```

---

### POST /admin/articles/:id/unpublish

Ẩn bài về draft. `publishedAt` giữ nguyên (BR-09 preserve).

**Body:** none

**Response 200:** `ArticleAdminDto` (status='draft')

**Cache invalidation:** flush all `articles:*` keys.

**Frontend usage:**
- Dropdown menu "Ẩn (unpublish)" trong publish button:
  ```typescript
  await sdk.adminArticlesUnpublish({ id });
  ```

---

### DELETE /admin/articles/:id

Soft delete (BR-08).

**Behavior:**
- Set `isDeleted=true`, `status='draft'`
- **Rename slug** thành `{slug}-deleted-{timestamp}` để giải phóng slug gốc cho bài mới reuse
- 404 nếu invalid ObjectId / không tồn tại
- Idempotent: gọi lại trên bài đã soft-deleted → 200 `{ ok: true }` (no-op)

**Response 200:** `{ "ok": true }`

**Cache invalidation:** flush all `articles:*` keys.

**Frontend usage:**
- "Xóa" button trong row table — confirm dialog → call → invalidate list/stats

---

### POST /admin/articles/:id/restore

Restore bài soft-deleted.

**Body:** `RestoreArticleDto` (optional)
```json
{ "slug": "huong-dan-dang-ky-giai-chay-v2" }
```
| Field | Type | Required | Validation |
|---|---|---|---|
| `slug` | string | optional | `/^[a-z0-9-]+$/`, max 120. Mặc định: lấy slug gốc trước khi soft-delete (strip `-deleted-{ts}`). |

**Behavior:**
- Status reset về `draft` (không tự re-publish)
- Slug reassigned, đảm bảo unique (collision retry suffix)
- Idempotent: nếu chưa soft-deleted → return current shape

**Response 200:** `ArticleAdminDto`

**Cache invalidation:** flush all `articles:*` keys.

**Frontend usage:**
- Tab "Đã xóa" trong admin list (`?includeDeleted=true&status=all`)
- Button "Khôi phục" — optional input slug mới nếu collision

---

## ADMIN — Article Categories

### GET /admin/article-categories

List tất cả categories (kể cả `isActive=false`) với articleCount.

**Response 200:** `ArticleCategoryResponseDto[]`
```json
[
  {
    "id": "6620b2...",
    "slug": "dang-ky-giai",
    "name": "Đăng ký giải",
    "type": "help",
    "icon": "📖",
    "tint": "#1D49FF",
    "description": "Hướng dẫn từ A-Z",
    "order": 0,
    "isActive": true,
    "articleCount": 12
  }
]
```

Sort: `order ASC, name ASC`.

**Frontend usage:**
- `/admin/article-categories` page — list + drag-drop reorder
- Article editor sidebar — load để build dropdown "Danh mục"

---

### GET /admin/article-categories/:id

Detail 1 category.

**Path params:** `id: string` (ObjectId)

**Response 200:** `ArticleCategoryResponseDto`
**Response 404:** invalid ObjectId hoặc không tồn tại

---

### POST /admin/article-categories

Tạo category mới.

**Body:** `CreateArticleCategoryDto`
```json
{
  "name": "Đăng ký giải",
  "slug": "dang-ky-giai",
  "type": "help",
  "icon": "📖",
  "tint": "#1D49FF",
  "description": "Hướng dẫn từ A-Z",
  "order": 0,
  "isActive": true
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `name` | string | ✅ | 1-80 chars |
| `slug` | string | optional | `/^[a-z0-9-]+$/`, max 80. Auto-gen từ name nếu omitted. |
| `type` | enum | optional | `'help' \| 'news' \| 'both'` (default `'both'`) |
| `icon` | string | optional | emoji or icon name, max 20 |
| `tint` | string | optional | `@IsHexColor()` (e.g. `#1D49FF`) |
| `description` | string | optional | max 160 |
| `order` | number | optional | int, default 0 |
| `isActive` | boolean | optional | default true |

**Behavior:**
- Slug race retry 3x với suffix
- Slug rename collision → 409 sau 3 attempts

**Response 201:** `ArticleCategoryResponseDto` (`articleCount: 0`)

**Cache invalidation:** flush all `articles:*` keys (vì public list/detail có chứa category metadata).

---

### PATCH /admin/article-categories/reorder

Bulk reorder qua drag-drop.

> ⚠️ **Routing note:** `reorder` PHẢI đặt trước `:id` route trong NestJS để Express match đúng. Hiện đã handle ở admin controller — nếu thêm route mới, lưu ý thứ tự.

**Body:** `ReorderArticleCategoriesDto`
```json
{
  "items": [
    { "id": "6620b2...", "order": 0 },
    { "id": "6620b3...", "order": 1 },
    { "id": "6620b4...", "order": 2 }
  ]
}
```

| Field | Type | Validation |
|---|---|---|
| `items` | `ReorderItemDto[]` | each: `{ id: string, order: number }`, ObjectId items không hợp lệ → bị skip silently |

**Response 200:** `{ "ok": true }`

**Cache invalidation:** flush all `articles:*` keys.

**Frontend usage:**
- After drag-drop end → collect new ordered array → bulk PATCH:
  ```typescript
  await sdk.adminCategoriesReorder({
    items: orderedIds.map((id, idx) => ({ id, order: idx }))
  });
  ```

---

### PATCH /admin/article-categories/:id

Update category. **Slug rename → cascade update tất cả Article có `category=oldSlug` sang `newSlug`** (giữ link không bị break).

**Path params:** `id: string`
**Body:** `UpdateArticleCategoryDto` (PartialType) — tất cả optional.

**Response 200:** `ArticleCategoryResponseDto`
**Response 404:** invalid ObjectId / không tồn tại
**Response 409:** slug rename va chạm với category khác

**Cache invalidation:** flush all `articles:*` keys.

**Frontend usage:**
- Edit dialog/page — autosave hoặc explicit save button
- Warning UI khi rename slug: "Sẽ cập nhật {count} bài viết đang dùng category này"

---

### DELETE /admin/article-categories/:id

Xóa category.

**Behavior:**
- Block 409 nếu còn ≥1 article tham chiếu (`category=slug`)
- Hard delete (KHÔNG soft) — categories ít, không cần audit trail
- Idempotent NO — gọi lại sau khi xóa → 404

**Response 200:** `{ "ok": true }`
**Response 409:**
```json
{
  "statusCode": 409,
  "message": "Danh mục đang được sử dụng bởi 1 hoặc nhiều bài viết. Hãy reassign trước khi xóa."
}
```

**Frontend usage:**
- "Xóa" button — confirm dialog
- Khi gặp 409: redirect admin sang `/admin/articles?category={slug}` để reassign

---

## Data Models

### `Article` (collection `articles`)

```typescript
{
  _id: ObjectId,                    // exposed as `id: string` in DTOs
  title: string,                    // required
  slug: string,                     // unique, indexed, /^[a-z0-9-]+$/
  type: 'news' | 'help',            // required, indexed (compound)
  products: string[],               // ['5bib'|'5sport'|'5ticket'|'5pix'|'all'][]
  category: string,                 // category slug (FK to ArticleCategory.slug)
  content: string,                  // sanitized HTML
  excerpt: string,                  // ≤160 chars
  coverImageUrl: string,            // S3 URL
  seoTitle: string,                 // ≤60 chars
  seoDescription: string,           // ≤160 chars
  status: 'draft' | 'published',    // indexed, default 'draft'
  publishedAt: Date | null,         // indexed; preserved across re-publish
  featured: boolean,                // default false
  authorId: string,                 // Logto userId
  authorName: string,
  authorAvatar: string,
  readTimeMinutes: number,          // computed Math.ceil(wordCount/200)
  viewCount: number,                // default 0
  helpfulYes: number,               // default 0
  helpfulNo: number,                // default 0
  isDeleted: boolean,               // indexed, default false
  createdAt: Date,
  updatedAt: Date,
}
```

**Indexes:**
- `{ slug: 1 }` unique
- `{ status: 1, type: 1, publishedAt: -1 }`
- `{ status: 1, products: 1, publishedAt: -1 }` (multikey)
- `{ status: 1, featured: -1, publishedAt: -1 }`
- `{ status: 1, category: 1, publishedAt: -1 }`
- `{ isDeleted: 1 }`

### `ArticleCategory` (collection `article_categories`)

```typescript
{
  _id: ObjectId,                    // exposed as `id: string`
  slug: string,                     // unique, indexed
  name: string,                     // required
  type: 'help' | 'news' | 'both',   // default 'both'
  icon: string,                     // emoji, default '📁'
  tint: string,                     // hex, default '#1D49FF'
  description: string,              // ≤160 chars
  order: number,                    // sort order, indexed
  isActive: boolean,                // indexed, default true
  createdAt: Date,
  updatedAt: Date,
}
```

**Indexes:**
- `{ slug: 1 }` unique
- `{ isActive: 1, type: 1, order: 1 }`

---

## Business Rules Index

| Rule | Spec | Enforcement point |
|---|---|---|
| **BR-01** | Draft articles excluded from public API | `findOne({ status: 'published', isDeleted: false })` in all public reads |
| **BR-02** | Publish requires title/content/slug/type/coverImageUrl | `publish()` service throws `422` with `missing[]` array |
| **BR-03** | Slug unique + URL-safe + auto-gen | DTO `@Matches(/^[a-z0-9-]+$/)` + `ensureUniqueSlug()` + E11000 catch + retry 3x |
| **BR-04** | `type=news` → news.5bib.com, `type=help` → hotro.5bib.com | Backend stores `type` field; frontend domain middleware (Phase C) |
| **BR-05** | Products array enum validation | DTO `@IsIn(ARTICLE_PRODUCTS, { each: true })` |
| **BR-06** | Public list sorted `publishedAt DESC` | `.sort({ publishedAt: -1 })` in all public reads |
| **BR-07** | `coverImageUrl` is OG image | Frontend `generateMetadata` (Phase C) |
| **BR-08** | Soft delete + restore | `isDeleted` flag + slug rename `-deleted-{ts}` to free slug |
| **BR-09** | `publishedAt` preserved on re-publish | `if (!doc.publishedAt) doc.publishedAt = new Date()` |
| **BR-10** | Public no auth, admin LogtoAdminGuard | Two controllers: `articles.controller.ts` (no guard), `articles-admin.controller.ts` (`@UseGuards(LogtoAdminGuard)`) |
| **P1-03** | Multiple featured allowed | No constraint — frontend picks first |
| **P1-04** | Open admin scope | All admins can edit/delete any article — by design |
| **P1-05** | Last-write-wins concurrency | No version field — accepted trade-off |
| **P1-06** | No force-reset publishedAt | BR-09 strict — design choice |
| **P2-09** | Configurable categories | `ArticleCategory` collection + admin CRUD |

---

## Cache Strategy

| Key pattern | Purpose | TTL | Invalidate on |
|---|---|---|---|
| `articles:latest:<type>:<product>:<limit>` | Widget homepage | 300s | Any article/category write |
| `articles:list:<type>:<product>:<category>:<page>:<limit>` | Public list | 120s | Any article/category write |
| `articles:detail:<slug>` | Public detail | 600s | Any article/category write + `voteHelpful` (single key del) |
| `articles:categories:<type>` | Public category metadata | 300s | Any article/category write |
| `ratelimit:article-view:<slug>:<ip>` | View dedup | 5m | Never (TTL only) |
| `ratelimit:article-helpful:<slug>:<ip>` | Vote dedup (value `'y'\|'n'`) | 24h | Never (TTL only) |

**Invalidate strategy:** Admin writes (create/update/publish/unpublish/delete/restore on articles or categories) flush ALL keys matching `articles:*` via `scanStream` + pipeline. Rate-limit keys use prefix `ratelimit:*` so dedup state survives admin edits.

**Cache stampede protection:** None implemented in v1.0. If MISS rate becomes problematic at scale, add SETNX-based per-key lock with short TTL.

---

## Phase C — Next.js ISR & Revalidation Hook

Next.js public site (`articles-web/` Phase C) uses ISR with `revalidate: 300` (matches Redis TTL). However, after admin publish, Redis cache flushes immediately but Next.js ISR still serves cached page for up to 5 min.

**Recommended:** Backend POST webhook to Next.js after publish/unpublish:
```typescript
// In ArticlesService.publish() — after invalidateAll()
if (env.NEXT_REVALIDATE_URL) {
  fetch(`${env.NEXT_REVALIDATE_URL}/api/revalidate`, {
    method: 'POST',
    headers: { 'X-Revalidate-Secret': env.NEXT_REVALIDATE_SECRET },
    body: JSON.stringify({ tag: 'articles-list', slug: doc.slug }),
  }).catch(() => {}); // best-effort, don't block publish
}
```

→ **PAUSE before implement** — confirm with Danny + DevOps khi dựng `articles-web/`.

---

## Frontend SDK Generation

After backend changes:
```bash
# Backend running on :8081
cd admin && pnpm run generate:api
```

This regenerates `admin/src/lib/api-generated/` from `http://localhost:8081/swagger/json`. The 22 endpoints documented above will appear as functions like:
- `articlesLatest(query)`, `articlesDetail(slug)`, `articlesCategories(query)`
- `adminArticlesList(query)`, `adminArticlesCreate(body)`, `adminArticlesPublish({ id })`
- `adminCategoriesList()`, `adminCategoriesCreate(body)`, `adminCategoriesReorder(body)`

Wrap each in TanStack Query hook in `lib/api-hooks.ts` for component consumption.

---

## Document Maintenance

- **Update on:** Any DTO change (add/remove/rename field), new endpoint, BR change
- **Owner:** Backend coder updates this doc as part of PR — QC blocks merge if doc stale
- **Sync with:** Swagger JSON at `/swagger/json` (always source of truth for shape)
