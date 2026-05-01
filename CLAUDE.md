# 5BIB Result - Project Context

## Overview
Race result management system for running events in Vietnam. 3 services: backend API, public frontend, admin dashboard.

## Tech Stack
- **Backend**: NestJS 10, MongoDB (Mongoose), Redis, JWT auth, AWS S3 uploads — port 8081
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5.9, Tailwind CSS — port 3002
- **Admin**: Next.js 16 (App Router), React 19, shadcn/ui — port 3000
- **Infra**: Docker multi-stage builds (Node 22 Alpine), GitHub Actions CI/CD, nginx reverse proxy, Let's Encrypt SSL

## Repository Structure
```
5bib-result/
├── backend/           # NestJS API
│   └── src/modules/
│       ├── races/     # Race CRUD, course management, checkpoints
│       ├── race-result/ # Athlete results, split times
│       ├── sponsors/  # Sponsor CRUD (silver/gold/diamond levels)
│       ├── auth/      # JWT authentication
│       ├── upload/    # S3 file uploads
│       └── admin/     # Admin-specific endpoints
├── frontend/          # Public-facing Next.js app
│   └── app/
│       ├── page.tsx           # Homepage (UTMB-inspired design)
│       ├── races/[slug]/      # Race results listing
│       ├── races/[slug]/[bib]/ # Athlete detail page
│       ├── races/[slug]/ranking/[courseId]/ # Course ranking
│       ├── api/[...proxy]/    # Runtime proxy to backend (NOT build-time rewrites)
│       ├── calendar/          # Race calendar
│       └── landing/           # Landing page
├── admin/             # Admin dashboard Next.js app
│   └── src/app/(dashboard)/
│       ├── races/             # Race management + course + checkpoints
│       ├── sponsors/          # Sponsor management
│       ├── claims/            # Result claims
│       ├── sync-logs/         # Data sync logs
│       └── api/[...proxy]/    # Runtime proxy to backend
├── .github/workflows/
│   └── build-and-deploy.yml  # CI/CD: build Docker images → GHCR → deploy VPS
└── docker-compose.yml         # Local development
```

## Deployment

### Environments
| Service | Dev URL | VPS Port |
|---------|---------|----------|
| Backend | https://result-dev.5bib.com | 8081 |
| Frontend | https://result-fe-dev.5bib.com | 3082 → 3002 |
| Admin | https://result-admin-dev.5bib.com | 3083 → 3000 |

### VPS: 5solution-vps (157.10.42.171)
- **SSH port**: 6060 (NOT default 22)
- **SSH alias**: `ssh 5solution-vps` (configured in ~/.ssh/config)
- **Deploy path**: `/opt/5bib-result/`
- **Docker Compose**: pulls from `ghcr.io/5solution/5bib-result/{backend,frontend,admin}:latest`
- **MongoDB**: runs on host, containers access via `host.docker.internal:27018`
- **nginx**: reverse proxy at `/etc/nginx/sites-enabled/result-*.5bib.com`
- **SSL**: certbot (Let's Encrypt)
- **DNS**: GoDaddy → A records pointing to 157.10.42.171

### CI/CD (GitHub Actions)
- Triggers on push to `main` + manual `workflow_dispatch`
- Uses `dorny/paths-filter` to detect which services changed
- Builds Docker images → pushes to GHCR
- Deploys via `appleboy/ssh-action` (requires GitHub secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT=6060`)
- GitHub repo: `github.com:5solution/5bib-result.git` (remote shows old URL `0xaldric/5bib-result` but redirects)

### Manual Deploy Command
```bash
ssh 5solution-vps "cd /opt/5bib-result && docker compose pull && docker compose up -d --remove-orphans && docker image prune -f"
```

## Key Architecture Decisions

### Runtime Proxy (NOT build-time rewrites)
Both frontend and admin use `app/api/[...proxy]/route.ts` to proxy API requests to backend at runtime. This allows `BACKEND_URL` to be set as environment variable in Docker without rebuilding.
```
Frontend/Admin → /api/* → proxy route → BACKEND_URL (e.g., http://5bib-result-backend:8081)
```

### Race Status Lifecycle
`draft` → `pre_race` → `live` → `ended`
- `draft` races are auto-excluded from public API (frontend homepage)
- Admin can see all statuses

### Athlete Result Data Format
API returns timing data as JSON strings that need parsing:
```json
{
  "Chiptimes": "{\"Start\":\"00:00\",\"TM1\":\"24:29\",\"Finish\":\"1:12:13\"}",
  "Paces": "{\"Start\":\"\",\"TM1\":\"4:53\",\"Finish\":\"7:17\"}",
  "OverallRanks": "{\"Start\":\"1\",\"TM1\":\"5\",\"Finish\":\"5\"}"
}
```
Frontend parses these into split times array, using course checkpoint config for display names.

### Course Checkpoints
Each course has optional `checkpoints[]` config: `{ key, name, distance }`.
- `key` matches timing point keys (Start, TM1, TM2, Finish)
- `name` is display name (e.g., "CP1 - Suoi Vang")
- `distance` is optional (e.g., "5K")
- Configured in admin → Race → Course dialog

### Sponsors
Levels: silver, gold, diamond. Sorted by level priority (diamond first) then custom order.
- Backend: `/api/sponsors` (public), `/api/sponsors/all` (admin)
- Admin: full CRUD with S3 logo upload
- Frontend: floating sidebar with scrolling logos (hidden on mobile)

## Build Commands
```bash
# Backend
cd backend && npm run build    # NestJS build

# Frontend
cd frontend && npx next build  # Next.js build

# Admin
cd admin && npx next build     # Next.js build
```

## Environment Variables

### Backend (.env)
```
NODE_ENV, PORT=8081, MONGODB_URL, MONGODB_DB_NAME, REDIS_URL, JWT_SECRET
AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET

# Result Image Creator v1.0
RENDER_MAX_CONCURRENT=8              # In-process semaphore cap for canvas renders (tune per CPU)
RESULT_PUBLIC_URL=https://result.5bib.com  # Used to embed QR code + share links in canvas
```

### Frontend / Admin (runtime)
```
BACKEND_URL=http://5bib-result-backend:8081  # Set in docker-compose, NOT at build time
```

## Redis Keys Registry (Result Image Creator v1.0)
| Prefix | Purpose | TTL |
|--------|---------|-----|
| `badge:<raceId>:<bib>` | Cached BadgeService detection result | 24h |
| `badge-lock:<raceId>:<bib>` | SETNX lock during badge computation (anti-stampede) | 30s |
| `render-lock:<raceId>:<bib>:<hash>` | Dedupe concurrent identical renders | 60s |
| `share-count:<raceId>` | INCR-based race-level share counter | ∞ |
| `bib-count:<raceId>:<bib>` | INCR-based athlete-level share counter | ∞ |
| `homepage:sponsored` | SponsoredModule public API cache | 300s |
| `master:athlete:bib:<raceId>` | RaceMasterData athlete cache (HSET bib→json public-view, no PII) | 24h |
| `master:athlete:byid:<raceId>` | RaceMasterData reverse index (HSET athletes_id→bib) | 24h |
| `master:stats:<raceId>` | RaceMasterData athlete stats per race | 60s |
| `master:sync-lock:<raceId>` | SETNX lock during FULL sync (anti-stampede) | 60s |
| `master:cron-lock:<raceId>` | SETNX lock per-race cron tick | 50s |
| `master:lookup-lock:<raceId>:<bib>` | SETNX lock during MySQL on-demand fallback | 5s |
| `articles:latest:<type>:<product>:<limit>` | ArticlesModule widget cache (homepage 5bib.com / 5sport.vn) | 300s |
| `articles:list:<type>:<product>:<category>:<page>:<limit>` | Paginated public list (news.5bib.com / hotro.5bib.com) | 120s |
| `articles:detail:<slug>` | Article detail page cache | 600s |
| `articles:categories:<type>` | ArticleCategoriesService public list cache | 300s |
| `ratelimit:article-view:<slug>:<ip>` | View dedup per IP per article | 5m |
| `ratelimit:article-helpful:<slug>:<ip>` | Helpful vote dedup per IP per article (value = 'y'\|'n') | 24h |

Cache invalidation: any admin write (create/update/publish/unpublish/delete/restore on articles OR categories) flushes ALL `articles:*` keys via `scanStream` + pipeline. Rate-limit keys use a different `ratelimit:*` prefix so they survive cache flushes — view/vote dedup state is preserved across admin edits.

Flush pattern (careful — global):
```bash
ssh 5solution-vps "docker exec 5bib-result-backend node -e \"require('ioredis').createClient(process.env.REDIS_URL).keys('badge:*').then(k => ...)\""
```

## S3 Lifecycle (Result Image Creator v1.0)
Bucket: `AWS_S3_BUCKET` (shared with race/sponsor assets).
Required lifecycle rule (configure via AWS console or CDK):
- **Prefix**: `result-images/`
- **Expiration**: 24 hours after creation
- **Reason**: Generated PNGs are re-creatable from canvas; no need for long-term storage. Keeps bucket clean and cost low.


## Development Rules

### Backend API Rules
- Every new API endpoint MUST have full `@ApiResponse({ type: DtoClass })` decorator with proper response DTO
- All controller methods must define `@ApiOperation`, `@ApiResponse` (success), and `@ApiTags`
- Response DTOs must use `@ApiProperty()` on every field for proper OpenAPI schema generation
- This ensures `@hey-api/openapi-ts` can generate correct TypeScript types for frontend/admin

### Frontend/Admin API Rules
- All API calls use `@hey-api/openapi-ts` generated SDK from `lib/api-generated/`
- TanStack Query hooks in `lib/api-hooks.ts` wrap SDK calls for React components
- Run `pnpm generate:api` to regenerate types after backend API changes
- Never use raw `fetch()` for API calls — always use generated SDK functions or hooks

## Frontend Design System ("Velocity" — Athletic Editorial)
- **Theme file**: `frontend/app/globals.css`
- **Palette**: Warm stone base (`#fafaf9` bg, `#1c1917` text), blue accent `#1d4ed8`, energy orange `--5bib-energy: #ea580c`, trail green `--5bib-trail: #166534`
- **Fonts**: Be Vietnam Pro (headings, `--font-heading`) + Inter (body, `--font-sans`). Monospace: JetBrains Mono / SF Mono (`--font-mono`)
- **Motion tokens**: `--ease-out-expo`, `--ease-spring`, `--duration-fast/normal/slow`
- **Shadow system**: `--shadow-xs` → `--shadow-xl`, `--shadow-glow`
- **Key utilities**:
  - Animation: `stagger-in`, `slide-up`, `scale-in`, `shimmer`
  - Texture: `grain`, `topo-lines`, `hero-pattern`, `diagonal-lines`
  - Glass: `glass-light`, `glass-dark`
  - Typography: `text-gradient`, `text-gradient-warm`, `mono-data`, `accent-underline`
  - Athletic: `rank-gold`, `rank-silver`, `rank-bronze`
  - Interactive: `card-hover`, `result-row-hover`, `glow-accent`, `focus-ring`
  - Layout: `scrollbar-hide`, `scrollbar-thin`, `sep`

## Result Image Generation
- **Backend service**: `backend/src/modules/race-result/services/result-image.service.ts`
- **Library**: `@napi-rs/canvas` — canvas-based, no headless browser
- **Output**: 1080×1350px PNG (4:5 ratio, Instagram-ready)
- **Endpoint**: `POST /race-results/result-image/:raceId/:bib` (multipart/form-data)
  - `bg`: preset gradient key (`blue|dark|sunset|forest|purple`)
  - `customBg`: optional image file upload for custom background
- **Fonts**: Inter + Be Vietnam Pro TTFs bundled in `backend/assets/fonts/`
- **Frontend**: `ResultImageEditor` component previews with DOM, calls backend API for download/share
- **Logo**: `backend/assets/logo_5BIB_white.png`

## Common Issues & Solutions
- **MongoDB ECONNREFUSED in Docker**: Use `host.docker.internal:27018` + `extra_hosts` in docker-compose
- **nginx 502**: Check escaped `$http_upgrade` in nginx config
- **CI deploy SSH refused**: VPS uses port 6060, need `VPS_PORT` secret
- **Frontend build errors**: Check for unused imports from `@/lib/api` (legacy exports removed)
- **Admin build errors**: Race creation needs `enableEcert`, `enableClaim`, `enableLiveTracking`, `enable5pix` booleans

## Pre-Deploy Checklist — LUÔN kiểm tra trước khi push/deploy

> Bài học từ bug thực tế: security fix strip `_id` → frontend mất `raceId` → toàn bộ race results trả về empty array âm thầm (không có 4xx error).

### 1. API Response Shape Changed?
Khi thêm/xóa/đổi tên field trong response DTO hoặc strip logic:
```bash
# Grep toàn bộ frontend + admin tìm consumer của field đó
grep -rn "field_name" frontend/ admin/ --include="*.tsx" --include="*.ts"
```
Đặc biệt nguy hiểm: `_id`, `id`, `slug`, `courseId`, `raceId` — những field dùng làm input cho API call tiếp theo.

### 2. Strip / Scrub Fields khỏi Public API?
- Kiểm tra field đó có được frontend dùng làm key để gọi API downstream không
- Nếu strip `_id` → **phải inject alias `id = _id.toString()`** trước khi strip
- Pattern an toàn trong `stripRacePrivateFields`: inject `id` → filter ra `_id`

### 3. DTO thêm Required Field?
- Chạy `pnpm generate:api` trong admin/frontend
- Kiểm tra tất cả call site của SDK function đó có truyền đủ field mới chưa
- Call cũ thiếu required field → backend trả 400, frontend im lặng trả empty

### 4. Redis Cache?
- Cache stores **raw DB document** (có `_id`), transform **khi đọc ra** — không cache transformed result
- Sau deploy backend mới có thay đổi response shape, cache cũ vẫn valid vì transform chạy lại
- Nếu cần flush: `ssh -o "ExitOnForwardFailure no" 5solution-vps "docker exec 5bib-result-backend node -e \"require('ioredis').createClient(process.env.REDIS_URL).flushdb()\""`

### 5. Verify End-to-End Trước Khi Báo Done
Không chỉ test endpoint vừa sửa — test cả **flow downstream**:
1. `GET /api/races/slug/:slug` → kiểm tra `id` có trong response
2. Lấy `id` → gọi `GET /api/race-results?raceId={id}&course_id={x}`
3. Confirm athletes trả về > 0

### Fields Nguy Hiểm Trong 5BIB Frontend
| Field | Dùng ở đâu | Downstream call |
|-------|-----------|----------------|
| `race.id` / `race._id` | `races/[slug]/page.tsx`, `[bib]/page.tsx`, `ranking/page.tsx`, `compare/page.tsx` | `/api/race-results?raceId=` |
| `course.courseId` | tất cả result pages | `/api/race-results?course_id=` + stats |
| `result._id` | admin `results/page.tsx` | PATCH `/api/race-results/:id` |
