# Promo Hub — API Reference & Integration Guide

> **Module:** `backend/src/modules/promo-hub/` + `backend/src/modules/promo-hub-analytics/`
> **Feature:** FEATURE-027 — Configurable Landing Page (19 section types)
> **Status:** ✅ DEPLOYED 2026-05-13 (Phase A1-A5 + Phase B)
> **Base URL (dev):** `http://localhost:8081/api`
> **Base URL (prod):** `https://result.5bib.com/api`
> **Auth scheme:** Logto JWT (Bearer). Admin endpoints require role=`admin` via `LogtoAdminGuard`.
> **Source verified:** 2026-05-13 against `backend/src/modules/promo-hub/`
> **Đối tượng tài liệu:** Backend devs, frontend devs (5bib + 5sport + 5pix tích hợp), partner integrators.

---

## Table of Contents

1. [Quick Reference](#quick-reference)
2. [Common Conventions](#common-conventions)
3. [Public Endpoints](#public-endpoints)
   - [GET /promo-hubs/slug/:slug](#get-promo-hubsslugslug)
   - [POST /promo-hub-analytics/track-view](#post-promo-hub-analyticstrack-view)
   - [POST /promo-hub-analytics/track-click](#post-promo-hub-analyticstrack-click)
4. [Admin Endpoints (LogtoAdminGuard)](#admin-endpoints-logtoadminguard)
   - [GET /promo-hubs](#get-promo-hubs)
   - [POST /promo-hubs](#post-promo-hubs)
   - [GET /promo-hubs/:id](#get-promo-hubsid)
   - [PATCH /promo-hubs/:id](#patch-promo-hubsid)
   - [DELETE /promo-hubs/:id](#delete-promo-hubsid)
   - [PATCH /promo-hubs/:id/sections/reorder](#patch-promo-hubsidsectionsreorder)
   - [GET /promo-hub-analytics/:hubId/summary](#get-promo-hub-analyticshubidsummary)
5. [Data Models](#data-models)
6. [Section Types — 19 schemas](#section-types--19-schemas)
7. [Cache Strategy](#cache-strategy)
8. [Cross-app Revalidation](#cross-app-revalidation)
9. [SDK Usage Examples](#sdk-usage-examples)
10. [Tích hợp vào 5bib.com / 5sport.vn / 5pix](#tích-hợp-vào-5bibcom--5sportvn--5pix)
11. [Business Rules Index](#business-rules-index)
12. [Error Codes](#error-codes)
13. [Troubleshooting](#troubleshooting)

---

## Quick Reference

| # | Method | Path | Auth | Cache | Rate Limit | BR |
|---|---|---|---|---|---|---|
| 1 | `GET` | `/promo-hubs/slug/:slug` | Public | Redis 60s + ISR | — | BR-PH-14 |
| 2 | `POST` | `/promo-hub-analytics/track-view` | Public | — | 1/IP/slug/5min Redis SETNX | BR-PH-07, 09 |
| 3 | `POST` | `/promo-hub-analytics/track-click` | Public | — | ThrottlerGuard | BR-PH-07 |
| 4 | `GET` | `/promo-hubs` | Admin | — | — | BR-PH-03 |
| 5 | `POST` | `/promo-hubs` | Admin | DEL cache slug | — | BR-PH-01, 03 |
| 6 | `GET` | `/promo-hubs/:id` | Admin | — | — | BR-PH-03 |
| 7 | `PATCH` | `/promo-hubs/:id` | Admin | DEL cache slug | — | BR-PH-03, 16 |
| 8 | `DELETE` | `/promo-hubs/:id` | Admin | DEL cache slug | — | BR-PH-03 |
| 9 | `PATCH` | `/promo-hubs/:id/sections/reorder` | Admin | DEL cache slug | — | BR-PH-05 |
| 10 | `GET` | `/promo-hub-analytics/:hubId/summary` | Admin | — | — | BR-PH-15 |

---

## Common Conventions

### Authentication

**Public endpoints** (`/promo-hubs/slug/:slug`, `/promo-hub-analytics/track-*`): no auth, no Bearer token needed.

**Admin endpoints** (all others): require `Authorization: Bearer <logto-jwt-token>` header. JWT phải có claim `roles: ['admin']` (NOT `staff`).

Get token via Logto OAuth flow — refer to admin login implementation in `admin/src/lib/logto.ts`.

### Headers

All requests should include:
```
Accept: application/json
Content-Type: application/json    # for POST/PATCH bodies
```

### Pagination

Admin list endpoint uses query params:
- `pageNo` — page number, 1-indexed (default 1)
- `pageSize` — items per page (default 20, max 100)

Response shape:
```json
{
  "data": [...],
  "total": 42,
  "pageNo": 1,
  "pageSize": 20,
  "totalPages": 3
}
```

### Error response format

All errors follow NestJS standard:
```json
{
  "statusCode": 404,
  "message": "Không tìm thấy trang quảng bá",
  "error": "Not Found"
}
```

Validation errors include array of field-level messages:
```json
{
  "statusCode": 400,
  "message": [
    "slug must match the regex /^[a-z0-9-]+$/",
    "title should not be empty"
  ],
  "error": "Bad Request"
}
```

---

## Public Endpoints

### `GET /promo-hubs/slug/:slug`

Fetch a published Promo Hub by slug. Used by frontend SSR at `5bib.com/hub/<slug>`.

**Auth:** None (public)
**Rate limit:** Not enforced at API level (Redis cache 60s + Next.js ISR 60s effectively rate-limits).
**BR:** BR-PH-14 (public SSR)

#### Path params
| Name | Type | Description |
|---|---|---|
| `slug` | string | URL-friendly identifier, `^[a-z0-9-]+$` |

#### Response 200

Returns full `PromoHubResponseDto` including all sections (filtered by `visible=true` AND `isWithinSchedule(schedule, now)` server-side).

```json
{
  "id": "6a04463412358f2d9a3a2e6f",
  "slug": "utmb-2026",
  "title": "UTMB Việt Nam 2026",
  "description": "Optional internal description",
  "status": "published",
  "sections": [
    {
      "_id": "6a04463412358f2d9a3a2e70",
      "type": "hero",
      "order": 0,
      "visible": true,
      "config": {
        "title": "UTMB Việt Nam 2026",
        "subtitle": "Giải chạy địa hình lớn nhất Đông Nam Á",
        "backgroundImage": "https://...",
        "ctaLabel": "Đăng ký ngay",
        "ctaUrl": "https://5bib.com/calendar",
        "align": "center"
      },
      "schedule": null
    }
    // ... more sections
  ],
  "seo": {
    "metaTitle": "UTMB Việt Nam 2026 — Đăng ký ngay | 5BIB",
    "metaDescription": "...",
    "ogImage": "https://...",
    "canonicalUrl": "https://5bib.com/hub/utmb-2026",
    "structuredData": null
  },
  "theme": {
    "primaryColor": "#1d4ed8",
    "secondaryColor": "#ea580c",
    "fontFamily": "Be Vietnam Pro, sans-serif",
    "layout": "standard",
    "customCss": ""
  },
  "createdBy": "logto-user-id",
  "createdAt": "2026-05-13T08:00:00.000Z",
  "updatedAt": "2026-05-13T08:00:00.000Z"
}
```

#### Response 404

Returned for:
- Slug doesn't exist
- Hub status = `draft` or `archived` (no existence leak — same message)

```json
{
  "statusCode": 404,
  "message": "Không tìm thấy trang quảng bá",
  "error": "Not Found"
}
```

#### Caching

- **Redis cache key:** `promo-hub:<slug>` TTL 60s
- **Anti-stampede:** SETNX lock `promo-hub-lock:<slug>` TTL 5s (max 3 retries × 200ms sleep, fallback DB direct)
- **Invalidation:** automatic on admin PATCH/DELETE via `RedisService.del()`
- **Cross-app:** Frontend Next.js `revalidate: 60` ISR + `revalidateTag('promo-hub:<slug>')` on admin save

#### Example

```bash
curl https://result.5bib.com/api/promo-hubs/slug/utmb-2026
```

---

### `POST /promo-hub-analytics/track-view`

Record a hub view event. Called from frontend `PromoHubTracker` Client Component on mount.

**Auth:** None (public)
**Rate limit:** 1 view per IP per slug per 5 minutes (Redis SETNX `promo-hub-view-rl:<slug>:<ipHash>` TTL 300s)
**BR:** BR-PH-07 (analytics), BR-PH-09 (rate limit)

#### Request body

```json
{
  "hubId": "6a04463412358f2d9a3a2e6f",   // required, ObjectId hex string
  "slug": "utmb-2026"                     // optional, used for rate-limit key
}
```

#### Response 200

```json
{
  "recorded": true    // OR false if rate-limited
}
```

#### Behavior

- Hash IP via SHA-256 (no salt) → store in `promo_hub_views.ip` (64-char hex)
- Truncate userAgent to 500 chars, referer to 2000 chars
- TTL 90 days (`expireAfterSeconds: 7776000`) — auto-delete

#### Example

```bash
curl -X POST https://result.5bib.com/api/promo-hub-analytics/track-view \
  -H "Content-Type: application/json" \
  -d '{"hubId":"6a04463412358f2d9a3a2e6f","slug":"utmb-2026"}'
```

---

### `POST /promo-hub-analytics/track-click`

Record a CTA click event. Fired from frontend `PromoHubTracker` via DOM event delegation on `[data-promo-cta]` elements.

**Auth:** None (public)
**Rate limit:** ThrottlerGuard (default tier)
**BR:** BR-PH-07

#### Request body

```json
{
  "hubId": "6a04463412358f2d9a3a2e6f",
  "sectionId": "6a04463412358f2d9a3a2e70",
  "ctaId": "optional-cta-id",         // optional
  "label": "Đăng ký ngay",
  "url": "https://5bib.com/calendar"
}
```

#### Response 200

```json
{ "success": true }
```

---

## Admin Endpoints (LogtoAdminGuard)

All admin endpoints require:
- `Authorization: Bearer <logto-jwt>` header
- JWT claim `roles: ['admin']`

Returns 401 if missing token, 403 if token lacks admin role.

### `GET /promo-hubs`

List all hubs (admin view — includes draft/archived).

**Query params:**
| Name | Type | Default | Description |
|---|---|---|---|
| `status` | `'draft' \| 'published' \| 'archived' \| 'all'` | `'all'` | Filter by status |
| `pageNo` | number | 1 | 1-indexed |
| `pageSize` | number | 20 | Max 100 |
| `q` | string | — | Search by title or slug (case-insensitive) |

**Response 200:**

```json
{
  "data": [
    {
      "id": "6a04463412358f2d9a3a2e6f",
      "slug": "utmb-2026",
      "title": "UTMB Việt Nam 2026",
      "status": "published",
      "sectionCount": 15,
      "views7d": 1234,
      "createdAt": "2026-05-13T08:00:00.000Z",
      "updatedAt": "2026-05-13T09:00:00.000Z"
    }
  ],
  "total": 42,
  "pageNo": 1,
  "pageSize": 20,
  "totalPages": 3
}
```

---

### `POST /promo-hubs`

Create a new hub (typically as draft, then update later).

**Request body** (`CreatePromoHubDto`):

```json
{
  "slug": "utmb-2026",                   // required, ^[a-z0-9-]+$
  "title": "UTMB Việt Nam 2026",          // required, 1-200 chars
  "description": "Internal note",         // optional
  "status": "draft",                      // optional, default 'draft'
  "sections": [],                         // optional, default []
  "seo": { /* PromoHubSeoInputDto */ },  // optional
  "theme": { /* PromoHubThemeInputDto */ } // optional, has defaults
}
```

**Response 201:** Full `PromoHubResponseDto` (same shape as GET).

**Errors:**
- `400` — Validation failed
- `409` — Slug already exists (MongoDB E11000 duplicate key)

---

### `GET /promo-hubs/:id`

Get a hub by ObjectId (admin — includes draft).

**Response 200:** Full `PromoHubResponseDto`
**Errors:** `404` if not found

---

### `PATCH /promo-hubs/:id`

Update a hub. Partial update — fields not in body are unchanged.

**Request body** (`UpdatePromoHubDto`): all fields optional.

```json
{
  "slug": "new-slug",
  "title": "New Title",
  "status": "published",
  "sections": [ /* full array — replaces existing */ ],
  "seo": { /* ... */ },
  "theme": { /* ... */ }
}
```

**Important:**
- `sections` replaces entire array. To add/remove single section, fetch first, modify array, send full updated array.
- `sections[*]._id`: if present and matches existing section, preserved. If absent or `tmp-*`, new ObjectId assigned by service.
- Slug change validates uniqueness against existing hubs (excludes self).

**Side effects:**
1. MongoDB update
2. Redis `DEL promo-hub:<old-slug>` (and `DEL promo-hub:<new-slug>` if slug changed)
3. Frontend cache invalidation triggered separately via `POST /api/revalidate-hub` (admin client fire-and-forget)

**Response 200:** Updated `PromoHubResponseDto`
**Errors:** `404`, `409` (slug conflict)

---

### `DELETE /promo-hubs/:id`

Hard delete a hub.

> ⚠️ **No soft-delete in Phase 1.** Once deleted, gone. Phase 2 will add trash bin.

**Response 200:** `{ success: true }`
**Side effects:** Redis DEL + sitemap revalidate
**Errors:** `404`

---

### `PATCH /promo-hubs/:id/sections/reorder`

Reorder sections within a hub by providing new order of section IDs.

**Request body** (`ReorderSectionsDto`):

```json
{
  "sectionIds": [
    "6a04463412358f2d9a3a2e70",
    "6a04463412358f2d9a3a2e71",
    "6a04463412358f2d9a3a2e72"
  ]
}
```

**Validation:**
- `sectionIds.length` MUST equal current `sections.length`
- All IDs must exist in current sections (no add/remove via this endpoint — use PATCH `/:id` for that)

**Response 200:** Updated `PromoHubResponseDto` with sections re-indexed `order: 0, 1, 2, ...`
**Errors:**
- `400` — sectionIds set mismatch
- `404` — hub not found

---

### `GET /promo-hub-analytics/:hubId/summary`

Get analytics summary for last 30 days.

**Response 200** (`AnalyticsSummaryDto`):

```json
{
  "hubId": "6a04463412358f2d9a3a2e6f",
  "totalViews": 5421,
  "totalClicks": 432,
  "ctr": 0.0797,    // 7.97% — totalClicks / totalViews
  "viewsByDay": [
    { "date": "2026-04-14", "count": 123 },
    { "date": "2026-04-15", "count": 145 },
    // ... 30 entries
  ],
  "clicksByDay": [
    { "date": "2026-04-14", "count": 12 },
    // ...
  ],
  "topSections": [
    { "sectionId": "6a04463412358f2d9a3a2e72", "clicks": 234 },
    { "sectionId": "6a04463412358f2d9a3a2e71", "clicks": 156 }
    // top 10
  ],
  "topLabels": [
    { "label": "Đăng ký ngay", "clicks": 312 },
    { "label": "Xem lịch giải", "clicks": 87 }
    // top 10
  ]
}
```

**Errors:**
- `400` — Invalid hubId (not ObjectId format)
- `404` — Hub not found

---

## Data Models

### `PromoHubResponseDto`

```typescript
{
  id: string;                  // ObjectId hex
  slug: string;
  title: string;
  description?: string;
  status: 'draft' | 'published' | 'archived';
  sections: SectionResponseDto[];
  seo: PromoHubSeoResponseDto;
  theme: PromoHubThemeResponseDto;
  createdBy: string;
  createdAt: string;           // ISO 8601
  updatedAt: string;
}
```

### `SectionResponseDto`

```typescript
{
  _id?: string;                // ObjectId hex (always present in response)
  type: SectionType;           // one of 19 enum values (see below)
  order: number;               // 0-indexed
  visible: boolean;
  config: Record<string, unknown>;   // type-specific, see Section Types section
  schedule?: SectionScheduleDto;
}
```

### `SectionScheduleDto`

```typescript
{
  enabled: boolean;
  startDate?: string;          // ISO 8601 UTC
  endDate?: string;
}
```

If `enabled=true`, section is rendered only if `startDate <= now <= endDate`.

### `PromoHubSeoResponseDto`

```typescript
{
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;            // S3 URL or external
  canonicalUrl?: string;
  structuredData?: Record<string, unknown>;   // JSON-LD inject
}
```

### `PromoHubThemeResponseDto`

```typescript
{
  primaryColor: string;        // hex `#1d4ed8`
  secondaryColor: string;
  fontFamily: string;          // CSS font-family value
  layout: 'standard' | 'compact' | 'wide';   // 1200 / 960 / 1440 max-width
  customCss?: string;          // sanitize-html cleaned
}
```

### `SectionType` (enum, 19 values)

```typescript
type SectionType =
  // Phase A1 — core (9)
  | 'hero' | 'race_calendar' | 'featured_races' | 'promo_banner'
  | 'cta_buttons' | 'sponsors' | 'stats' | 'rich_text' | 'recent_results'
  // Phase B — landing-page expansion (10)
  | 'link_grid' | 'social_links' | 'faq' | 'countdown' | 'video_embed'
  | 'image_gallery' | 'testimonial' | 'map_embed' | 'schedule_timeline' | 'form_embed';
```

---

## Section Types — 19 schemas

Each section's `config` is `Record<string, unknown>` — type-specific shape detailed below.

### 1. `hero`

```typescript
{
  title?: string;
  subtitle?: string;
  backgroundImage?: string;   // URL
  ctaLabel?: string;
  ctaUrl?: string;
  align?: 'left' | 'center' | 'right';
}
```

### 2. `race_calendar`

```typescript
{
  title?: string;
  limit?: number;             // default 6
  filter?: {
    status?: 'pre_race' | 'live' | 'ended';
  };
}
```

Async-fetches `/api/races?status=<filter.status>&limit=<limit>` at SSR time.

### 3. `featured_races`

```typescript
{
  title?: string;
  raceIds?: string[];         // ObjectId hex array
}
```

Async-fetches each race via `/api/races/:id` in parallel via `Promise.all`. Failed lookups (race deleted) are silently skipped.

### 4. `promo_banner`

```typescript
{
  imageUrl?: string;
  linkUrl?: string;
  alt?: string;
}
```

If `linkUrl` is HTTP/HTTPS, opens in new tab.

### 5. `cta_buttons`

```typescript
{
  title?: string;
  buttons?: Array<{
    label: string;
    url: string;
    variant?: 'primary' | 'secondary' | 'outline';
  }>;
}
```

### 6. `sponsors`

```typescript
{
  title?: string;
  levels?: Array<'silver' | 'gold' | 'diamond'>;
}
```

Async-fetches `/api/sponsors` then filters by level. Sorted: `diamond → gold → silver`.

### 7. `stats`

```typescript
{
  title?: string;
  items?: Array<{
    label: string;
    value: string;
  }>;
}
```

### 8. `rich_text`

```typescript
{
  title?: string;
  html?: string;              // sanitize-html cleaned (backend)
}
```

**Sanitization (backend):** strips `<script>`, event handlers (`onclick`, `onerror`, etc.), `javascript:` URIs. Allowed tags: `p, strong, em, a, ul, ol, li, h2, h3, br`.

### 9. `recent_results`

```typescript
{
  title?: string;
  raceId?: string;            // ObjectId hex
  limit?: number;             // default 5
}
```

Async-fetches race + race-results in parallel.

### 10. `link_grid` (Phase B)

```typescript
{
  title?: string;
  columns?: 2 | 3 | 4;        // default 3
  items?: Array<{
    imageUrl: string;
    title: string;
    url: string;
  }>;
}
```

### 11. `social_links` (Phase B)

```typescript
{
  title?: string;
  align?: 'left' | 'center' | 'right';
  links?: Array<{
    platform: 'facebook' | 'instagram' | 'tiktok' | 'youtube' | 'twitter'
            | 'linkedin' | 'telegram' | 'zalo' | 'email' | 'custom';
    url: string;
  }>;
}
```

Frontend renders brand-correct inline SVG icons.

### 12. `faq` (Phase B)

```typescript
{
  title?: string;
  items?: Array<{
    question: string;
    answer: string;            // supports newlines (rendered as <p>)
  }>;
}
```

Frontend renders native `<details>/<summary>` accordion (zero JS, full SSR, a11y compliant).

### 13. `countdown` (Phase B)

```typescript
{
  title?: string;
  targetDate?: string;        // ISO 8601 UTC
  message?: string;           // shown when targetDate passed
}
```

`'use client'` Component — updates every 1 second via `setInterval`.

### 14. `video_embed` (Phase B)

```typescript
{
  title?: string;
  provider?: 'youtube' | 'vimeo';   // default 'youtube'
  videoId?: string;           // raw ID or full URL — regex extracts ID
  caption?: string;
}
```

**YouTube extract regex:**
- `^[A-Za-z0-9_-]{6,}$` — raw ID
- `youtu\.be/([A-Za-z0-9_-]+)` — short URL
- `[?&]v=([A-Za-z0-9_-]+)` — standard URL
- `embed/([A-Za-z0-9_-]+)` — embed URL

**Privacy:** uses `youtube-nocookie.com` domain (no tracking).

### 15. `image_gallery` (Phase B)

```typescript
{
  title?: string;
  columns?: 2 | 3 | 4;
  images?: Array<{
    url: string;
    alt: string;
  }>;
}
```

Click image → opens full size in new tab.

### 16. `testimonial` (Phase B)

```typescript
{
  title?: string;
  items?: Array<{
    quote: string;
    author: string;
    role?: string;
    avatarUrl?: string;       // optional — fallback to initials
  }>;
}
```

### 17. `map_embed` (Phase B)

```typescript
{
  title?: string;
  embedUrl?: string;          // HOST whitelisted
  address?: string;           // text fallback if URL not whitelisted
}
```

**HOST whitelist:** `google.com`, `maps.google.com`, `www.openstreetmap.org`. HTTPS only.

### 18. `schedule_timeline` (Phase B)

```typescript
{
  title?: string;
  items?: Array<{
    time: string;             // "04:00" or "2026-05-15T04:00:00Z" — free-form text
    title: string;
    description?: string;
  }>;
}
```

### 19. `form_embed` (Phase B)

```typescript
{
  title?: string;
  description?: string;
  provider?: 'iframe' | 'link';
  embedUrl?: string;
}
```

**Iframe HOST whitelist:** `docs.google.com`, `forms.gle`, `tally.so`, `form.5bib.com`, `forms.office.com`. HTTPS only. If non-whitelisted: falls back to `link` mode (CTA button opening URL in new tab).

---

## Cache Strategy

### Redis keys

| Key | Purpose | TTL |
|---|---|---|
| `promo-hub:<slug>` | Cached `findBySlugPublic` response | 60s |
| `promo-hub-lock:<slug>` | SETNX anti-stampede lock | 5s |
| `promo-hub-view-rl:<slug>:<ipHash>` | Per-IP view rate-limit | 300s (5 min) |

### Anti-stampede pattern (port from F-004 RaceMasterDataService)

```typescript
async findBySlugPublic(slug: string) {
  const cached = await redis.get(`promo-hub:${slug}`);
  if (cached) return JSON.parse(cached);

  const gotLock = await redis.set(`promo-hub-lock:${slug}`, '1', 'EX', 5, 'NX');
  if (!gotLock) {
    // Lock busy — retry 3× with 200ms sleep
    for (let i = 0; i < 3; i++) {
      await sleep(200);
      const retryHit = await redis.get(`promo-hub:${slug}`);
      if (retryHit) return JSON.parse(retryHit);
    }
    return queryMongoDirectly(slug);   // fallback, no cache write
  }

  try {
    const result = await queryMongoAndShape(slug);
    await redis.set(`promo-hub:${slug}`, JSON.stringify(result), 'EX', 60);
    return result;
  } finally {
    await redis.del(`promo-hub-lock:${slug}`);
  }
}
```

### Invalidation triggers

Admin writes that trigger `DEL promo-hub:<slug>`:
- `POST /promo-hubs` (slug from new doc)
- `PATCH /promo-hubs/:id` (old slug + new slug if changed)
- `DELETE /promo-hubs/:id`
- `PATCH /promo-hubs/:id/sections/reorder`

---

## Cross-app Revalidation

To propagate admin saves to public frontend faster than ISR 60s window:

### Architecture

```
[Admin edit page] → [PATCH /api/promo-hubs/:id] (backend)
        ↓
        ├─ MongoDB update
        ├─ Redis DEL promo-hub:<slug>
        ↓
[Admin React client fire-and-forget]
        ↓
[POST /api/revalidate-hub] (admin Next.js server route)
        │ attaches REVALIDATE_TOKEN to Authorization Bearer
        ↓
[POST /api/revalidate-hub] (frontend Next.js server route)
        │ validates Bearer token
        ↓
revalidateTag('promo-hub:<slug>', 'default')        ← Next.js 16 2-arg signature
revalidateTag('promo-hubs-sitemap', 'default')
        ↓
[Next public hit on /hub/<slug>] → re-fetches from backend → fresh data <1s
```

### Required env vars (PROD)

```bash
# Frontend .env (5bib-result-frontend container)
REVALIDATE_TOKEN=<random 48-char hex>

# Admin .env (5bib-result-admin container)
REVALIDATE_TOKEN=<same value>
FRONTEND_REVALIDATE_URL=http://5bib-result-frontend:3002/api/revalidate-hub
```

**Generate token:**
```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

### Fail-closed behavior (if env unset)

- Admin route returns `{ ok: true, skipped: 'no-token' }` (200)
- Frontend route returns `{ error: 'unauthorized' }` (401)
- Net effect: feature still works, propagation falls back to ISR 60s window (acceptable)

---

## SDK Usage Examples

### TypeScript SDK (generated via `@hey-api/openapi-ts`)

The SDK is auto-generated and available in both admin + frontend:

```typescript
// admin/src/lib/api-generated/sdk.gen.ts
// frontend/lib/api-generated/sdk.gen.ts

import {
  promoHubControllerList,
  promoHubControllerFindBySlug,
  promoHubControllerCreate,
  promoHubControllerUpdate,
  promoHubControllerDelete,
  promoHubControllerReorderSections,
  promoHubAnalyticsControllerTrackView,
  promoHubAnalyticsControllerTrackClick,
  promoHubAnalyticsControllerGetSummary,
} from '@/lib/api-generated';
```

### Example: List hubs (admin)

```typescript
const res = await promoHubControllerList({
  query: {
    status: 'published',
    pageNo: 1,
    pageSize: 20,
    q: 'utmb',
  },
});
const items = res.data?.data ?? [];
```

### Example: Public hub fetch (server-side in frontend)

```typescript
// In Server Component
const BACKEND_URL = process.env.BACKEND_URL;
const res = await fetch(
  `${BACKEND_URL}/api/promo-hubs/slug/${slug}`,
  {
    next: { revalidate: 60, tags: [`promo-hub:${slug}`] },
  }
);
if (res.status === 404) notFound();
const hub = await res.json();
```

### Example: Track view (client-side)

```typescript
'use client';
useEffect(() => {
  fetch('/api/promo-hub-analytics/track-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hubId, slug }),
    keepalive: true,    // survives navigation
  });
}, [hubId, slug]);
```

### Example: Click tracking via DOM event delegation

```typescript
'use client';
useEffect(() => {
  const onClick = (e: MouseEvent) => {
    const cta = (e.target as Element)?.closest<HTMLElement>('[data-promo-cta]');
    if (!cta) return;
    fetch('/api/promo-hub-analytics/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hubId,
        sectionId: cta.dataset.promoSectionId,
        label: cta.dataset.promoCtaLabel,
        url: cta.dataset.promoCtaUrl,
      }),
      keepalive: true,
    });
  };
  document.addEventListener('click', onClick, { capture: true });
  return () => document.removeEventListener('click', onClick, { capture: true });
}, [hubId]);
```

Sections must mark CTA elements:

```jsx
<a
  href={url}
  data-promo-cta
  data-promo-section-id={section._id}
  data-promo-cta-label="Đăng ký ngay"
  data-promo-cta-url={url}
>
  Đăng ký ngay
</a>
```

---

## Tích hợp vào 5bib.com / 5sport.vn / 5pix

### Khi nào tích hợp Promo Hub vào product khác (5sport, 5pix)?

Hiện tại Promo Hub chỉ deploy trên `5bib.com/hub/*`. Nếu cần dùng cho:
- `5sport.vn/hub/*` (sport event landing)
- `5pix.com/hub/*` (photo event landing)

→ Tích hợp như sau:

### Option A — Reuse same backend (recommended)

Backend `PromoHubModule` đã domain-agnostic. Chỉ cần frontend của product mới:

1. Copy `frontend/components/hub/*` sang repo product mới (vd `5sport-web/components/hub/`)
2. Copy `frontend/app/(main)/hub/[slug]/*` sang `5sport-web/app/hub/[slug]/*`
3. Set `BACKEND_URL` env trong frontend product mới trỏ về same backend
4. Trong sections async (RaceCalendarSection, SponsorsSection, RecentResultsSection): có thể cần override để fetch từ tenant-specific endpoints nếu data khác

### Option B — Multi-tenant on hub schema

Khi cần phân biệt hub thuộc tenant nào → thêm field `tenant: 'bib' | 'sport' | 'pix' | 'ticket'` vào `promo_hubs` schema.

Backend filter query:
```typescript
async findBySlugPublic(slug: string, tenant: string) {
  return this.model.findOne({ slug, tenant, status: 'published' });
}
```

Frontend pass tenant context:
```typescript
const res = await fetch(`${BACKEND_URL}/api/promo-hubs/slug/${slug}?tenant=sport`);
```

> ⚠️ **Phase 2 work** — current Phase 1 không có multi-tenant. Discuss với Manager nếu cần spike.

### Embedding hub vào product page (iframe)

Public hub có thể embed qua iframe:

```html
<iframe
  src="https://5bib.com/hub/utmb-2026?embed=1"
  width="100%"
  height="2000"
  frameborder="0"
  allow="autoplay"
></iframe>
```

> ⚠️ Phase 1 chưa có `?embed=1` query — currently hub always render with site header/footer. Embed mode defer Phase 2.

### Sharing hub via OG meta

Hub đã có đầy đủ OG / Twitter Card meta tags. Sharing trên:
- ✅ Facebook → preview với OG image + title + description
- ✅ Twitter/X → Twitter Card (summary or summary_large_image based on `ogImage` presence)
- ✅ Zalo / Telegram → OG preview
- ✅ LinkedIn → OG preview

**Force refresh share cache:**
- Facebook: [developers.facebook.com/tools/debug](https://developers.facebook.com/tools/debug) → paste URL → "Scrape Again"
- Twitter: [cards-dev.twitter.com/validator](https://cards-dev.twitter.com/validator)

---

## Business Rules Index

| BR | Description | Enforcement |
|---|---|---|
| BR-PH-01 | Hub có slug unique + status (draft/published/archived) | MongoDB `slug` sparse unique index |
| BR-PH-02 | Hub có sections[] subdoc array, 19 type enum | Mongoose schema validation |
| BR-PH-03 | Admin CRUD endpoints | `LogtoAdminGuard` on controller |
| BR-PH-04 | 9 + 10 section types với type-specific config | `SECTION_TYPES` enum, switch dispatch |
| BR-PH-05 | Section drag-and-drop reorder | `PATCH /:id/sections/reorder` atomic |
| BR-PH-06 | Admin preview pane | `PromoHubPreview` Client Component |
| BR-PH-07 | Analytics track view + click | 2 public endpoints + DOM event delegation |
| BR-PH-08 | IP SHA-256 hash (GDPR-compat) | `hashIp()` in `PromoHubAnalyticsService` |
| BR-PH-09 | Rate-limit 1 view/IP/slug/5min | Redis SETNX `promo-hub-view-rl:*` |
| BR-PH-10 | TTL 90 days analytics events | MongoDB `expireAfterSeconds: 7776000` |
| BR-PH-11 | Section schedule (visibility window) | `isWithinSchedule()` server-side filter |
| BR-PH-12 | XSS sanitize rich text + custom CSS | `sanitize-html` backend write path |
| BR-PH-13 | SEO meta + OG + canonical + JSON-LD | `generateMetadata()` + script inject |
| BR-PH-14 | Public SSR `/hub/<slug>` | Frontend Server Component + ISR 60s |
| BR-PH-15 | Analytics 30-day summary | `getSummary()` + AreaChart admin tab |
| BR-PH-16 | Cross-app cache invalidation | `revalidateTag` + token-gated route |
| BR-PH-17 | 19 section types (Phase B addendum) | SectionType union + dispatcher |

---

## Error Codes

| HTTP | Code | Meaning | Trigger |
|---|---|---|---|
| 400 | Bad Request | Validation failed | DTO field invalid (slug format, missing required, etc.) |
| 400 | Bad Request | Invalid hubId | `getSummary` with non-ObjectId hubId |
| 400 | Bad Request | sectionIds set mismatch | Reorder with wrong number of IDs |
| 401 | Unauthorized | Missing Bearer token | Admin endpoint without `Authorization` header |
| 401 | Unauthorized | Invalid REVALIDATE_TOKEN | Frontend `/api/revalidate-hub` with wrong token |
| 403 | Forbidden | Non-admin role | Logto JWT lacks `admin` role |
| 404 | Not Found | Hub doesn't exist | Slug or ID not found |
| 404 | Not Found | Hub not published | `findBySlugPublic` for draft/archived (no leak) |
| 409 | Conflict | Slug already exists | MongoDB E11000 on create/update |
| 500 | Internal Server Error | Unexpected | Database, Redis, or logic error |

---

## Troubleshooting

### Public hub `/hub/<slug>` returns 404

**Cause:** Hub status is `draft` or `archived`, OR slug doesn't exist.
**Check:** Admin login → `/promo-hub` → filter "Tất cả trạng thái" → search by slug.
**Fix:** Change status to `Đã đăng` + Save.

### Admin saves but public site doesn't update for >60s

**Cause:** `REVALIDATE_TOKEN` env not set or mismatched between admin + frontend containers.
**Check:**
- Admin container: `docker exec 5bib-result-admin env | grep REVALIDATE`
- Frontend container: `docker exec 5bib-result-frontend env | grep REVALIDATE`
- Values must match exactly.
**Fix:** Set both `.env` files with same token, `docker compose up -d --force-recreate admin frontend`.

### Race Calendar / Sponsors section doesn't show updated data

**Cause:** Sub-section cache (race/sponsor data) has TTL 5min.
**Workaround:** Wait 5 min OR Save the hub again to invalidate sub-section cache.

### Rich text formatting lost after save

**Cause:** `sanitize-html` stripped disallowed tags.
**Check:** Allowed tags = `p, strong, em, a, ul, ol, li, h2, h3, br`. Disallowed = `script, style, iframe, on*` handlers.
**Fix:** Use only allowed tags in HTML.

### Custom CSS not applied

**Cause:** Sanitization stripped CSS property or value.
**Check:** Console errors. Avoid `position: fixed`, `@import`, `behavior:`, `expression()`.

### Map embed shows text instead of map

**Cause:** Embed URL not in HOST whitelist (`google.com`, `maps.google.com`, `www.openstreetmap.org`).
**Fix:** Re-generate embed URL from Google Maps Share → Embed flow.

### Form embed shows link button instead of iframe

**Cause:** URL not in `ALLOWED_FORM_HOSTS`.
**Fix:** Use form from supported providers (Google Forms, Tally, Microsoft Forms, etc.) OR contact dev to add custom host to whitelist.

### Analytics summary returns empty for sections

**Cause:** Less than 30 days of data OR no clicks yet.
**Check:** `db.promo_hub_clicks.count({ hubId: ObjectId('...') })` in mongosh.

### MongoDB query slow on large hubs collection

**Cause:** Missing indexes.
**Check:**
```bash
docker exec 5bib-result-backend node -e "
const m = require('mongoose');
m.connect(process.env.MONGODB_URL).then(async () => {
  console.log(await m.connection.db.collection('promo_hubs').indexes());
  process.exit(0);
});
"
```

**Expected indexes:**
- `slug_1` sparse unique
- `status_1_createdAt_-1` compound

If missing → restart backend (Mongoose auto-create on connect).

### Phase 2 features not yet available

Refer to `known-issues.md` TD-F027-PHASE2-01 through TD-F027-PHASE2-15:

- Race picker UI (HIGH)
- Image picker UploadModule integration (HIGH)
- TipTap WYSIWYG (MED)
- Preview iframe (MED)
- Autosave (MED)
- Duplicate hub action (MED)
- `next/image` migration (MED)
- Playwright e2e tests (MED)
- Other LOW priority items

Contact Manager for Phase 2 roadmap + ETA.

---

> 📌 **Tài liệu API này verbatim từ `backend/src/modules/promo-hub/` source code commit `158c5c4` (main, 2026-05-13).** Khi backend update, chạy `pnpm --filter admin generate:api` + `pnpm --filter frontend generate:api` để SDK tự sync.

**Liên hệ:**
- Backend dev: Manager `/5bib-manager`
- Frontend integration (5sport/5pix): Coder `/5bib-fullstack-engineer`
- PRD changes: BA `/5bib-po-ba`
