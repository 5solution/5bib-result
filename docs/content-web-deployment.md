# content-web Deployment Guide — `hotro.5bib.com`

> **App:** `content-web/` (Next.js 16 App Router, port 3015 dev)
> **Production domain:** `hotro.5bib.com` only (per Q-PC3 — `news.5bib.com` deferred)
> **Backend dependency:** `result.5bib.com` API + `X-API-Key` header

---

## 1. DNS

GoDaddy → 5bib.com zone → add A record:

```
hotro    IN    A    157.10.42.171
```

TTL: 600s. Verify: `dig hotro.5bib.com +short` returns `157.10.42.171`.

---

## 2. SSL — Let's Encrypt via certbot

SSH vào VPS:
```bash
ssh 5solution-vps
sudo certbot --nginx -d hotro.5bib.com --redirect --agree-tos -m devops@5bib.com
```

Auto-renewal đã có sẵn cron — không cần config thêm.

---

## 3. Nginx config

Tạo `/etc/nginx/sites-available/hotro.5bib.com`:

```nginx
server {
    listen 80;
    server_name hotro.5bib.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name hotro.5bib.com;

    # Cert paths managed by certbot
    ssl_certificate     /etc/letsencrypt/live/hotro.5bib.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hotro.5bib.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript application/xml+rss text/xml;
    gzip_min_length 1024;

    # Body size for image uploads (defensive)
    client_max_body_size 10M;

    # CRITICAL: overwrite X-Forwarded-For so client can't spoof
    # (matches backend get-client-ip util expectation for rate limit)
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Next.js static assets — long cache
    location /_next/static/ {
        proxy_pass http://localhost:3015;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Everything else → Next.js
    location / {
        proxy_pass http://localhost:3015;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 60s;
    }
}
```

Enable + test + reload:
```bash
sudo ln -s /etc/nginx/sites-available/hotro.5bib.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 4. Docker Compose entry

Add vào `/opt/5bib-result/docker-compose.yml`:

```yaml
services:
  # ... existing services ...

  5bib-content-web:
    image: ghcr.io/5solution/5bib-result/content-web:latest
    container_name: 5bib-content-web
    restart: unless-stopped
    ports:
      - "3015:3000"   # nginx → :3015 → container :3000
    environment:
      - NODE_ENV=production
      - BACKEND_URL=http://5bib-result-backend:8081
      - ARTICLES_API_KEY=${ARTICLES_API_KEY}
      - NEXT_PUBLIC_SITE_URL=https://hotro.5bib.com
    depends_on:
      - 5bib-result-backend
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

`ARTICLES_API_KEY` lấy từ `/admin/api-keys` admin UI — tạo key mới với:
- **Name**: "content-web hotro.5bib.com"
- **Allowed origins**: empty (server-side fetch không gửi Origin)
- **Rate limit**: 5000/min (heavy SSR + ISR re-revalidation)

Lưu vào `/opt/5bib-result/.env` trên VPS:
```
ARTICLES_API_KEY=ak_xxxxxxxxx_full_key_paste
```

---

## 5. Dockerfile cho content-web

Tạo `content-web/Dockerfile`:

```dockerfile
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat

# ─── deps ───
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile

# ─── build ───
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && pnpm run build

# ─── runtime ───
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000

RUN addgroup -g 1001 nodejs && adduser -D -u 1001 -G nodejs nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

**Standalone output**: cần thêm vào `next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // ... rest
};
```

→ Update file `content-web/next.config.ts` + commit cùng lần đầu.

---

## 6. GitHub Actions — extend `build-and-deploy.yml`

Add path filter + build job (mẫu):

```yaml
# .github/workflows/build-and-deploy.yml
jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      content-web: ${{ steps.filter.outputs.content-web }}
      # ... existing outputs
    steps:
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            content-web:
              - 'content-web/**'

  build-content-web:
    needs: changes
    if: needs.changes.outputs.content-web == 'true'
    runs-on: ubuntu-latest
    permissions: { contents: read, packages: write }
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: ${{ github.actor }}, password: ${{ secrets.GITHUB_TOKEN }} }
      - uses: docker/build-push-action@v5
        with:
          context: ./content-web
          push: true
          tags: ghcr.io/5solution/5bib-result/content-web:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

Deploy step (`appleboy/ssh-action` — same pattern as existing):

```yaml
  deploy:
    needs: [build-content-web]
    if: always() && (needs.build-content-web.result == 'success')
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          port: ${{ secrets.VPS_PORT }}
          script: |
            cd /opt/5bib-result
            docker compose pull 5bib-content-web
            docker compose up -d --no-deps 5bib-content-web
            docker image prune -f
```

---

## 7. Smoke test sau deploy

```bash
# DNS
dig hotro.5bib.com +short    # → 157.10.42.171

# SSL
curl -I https://hotro.5bib.com/   # → 200 + cert info

# Pages
curl -sI https://hotro.5bib.com/ | head -1
curl -sI https://hotro.5bib.com/cach-hoan-ve-giai-chay | head -1   # any published slug
curl -sI https://hotro.5bib.com/danh-muc/dang-ky-giai | head -1
curl -sI https://hotro.5bib.com/tin-tuc | head -1
curl -sI https://hotro.5bib.com/btc | head -1
curl -sI https://hotro.5bib.com/lien-he | head -1

# All should return 200

# Verify backend connectivity (from inside container)
ssh 5solution-vps "docker exec 5bib-content-web wget -qO- http://5bib-result-backend:8081/health"
```

---

## 8. On-demand revalidation (Phase 2 — optional)

Khi admin publish/unpublish bài → backend webhook gọi Next.js revalidate:

**Backend** (defer):
```typescript
// In ArticlesService.publish() after invalidateAll()
if (env.NEXT_REVALIDATE_URL) {
  fetch(`${env.NEXT_REVALIDATE_URL}/api/revalidate`, {
    method: "POST",
    headers: { "X-Revalidate-Secret": env.NEXT_REVALIDATE_SECRET },
    body: JSON.stringify({ slug: doc.slug, tags: ["articles-list"] }),
  }).catch(() => {});
}
```

**Frontend** route handler `content-web/app/api/revalidate/route.ts`:
```typescript
import { revalidateTag, revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  if (req.headers.get("x-revalidate-secret") !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const body = (await req.json()) as { slug?: string; tags?: string[] };
  if (body.slug) {
    revalidatePath(`/${body.slug}`);
    revalidateTag(`article:${body.slug}`);
  }
  for (const tag of body.tags ?? []) revalidateTag(tag);
  return NextResponse.json({ ok: true });
}
```

→ Defer Phase 2. Hiện tại ISR 5 phút lag chấp nhận được cho blog.

---

## 9. Rollback

```bash
ssh 5solution-vps
cd /opt/5bib-result
docker compose pull 5bib-content-web   # pull last image (use specific tag if needed)
docker compose up -d --no-deps 5bib-content-web
```

Nếu image broken → revert tag:
```bash
docker tag ghcr.io/5solution/5bib-result/content-web:<previous-sha> \
           ghcr.io/5solution/5bib-result/content-web:latest
docker compose up -d --no-deps 5bib-content-web
```

---

## 10. Monitoring

- nginx access log: `/var/log/nginx/hotro.5bib.com.access.log`
- Docker logs: `docker logs -f 5bib-content-web`
- Backend API key usage: admin → `/admin/api-keys` → xem `usageCount` + `lastUsedAt` cho key "content-web hotro.5bib.com"

---

## Pre-deploy checklist

- [ ] DNS A record `hotro` → `157.10.42.171` propagated
- [ ] SSL cert issued via certbot
- [ ] nginx config tested + reloaded
- [ ] API key tạo trong admin với name "content-web hotro.5bib.com"
- [ ] `/opt/5bib-result/.env` cập nhật `ARTICLES_API_KEY=ak_xxx...`
- [ ] `next.config.ts` thêm `output: "standalone"`
- [ ] Dockerfile create + push test build local trước
- [ ] GitHub Actions extend với content-web job
- [ ] Smoke test 6 routes sau deploy
- [ ] Verify nginx X-Forwarded-For overwrite (KHÔNG append) — quan trọng cho rate limit
