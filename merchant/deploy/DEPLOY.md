# F-069 M5 — Merchant Portal Deploy (merchant.5bib.com)

Frontend app `merchant/` — Next.js standalone, Logto auth (merchant scopes), runtime proxy → backend. Mirrors admin deploy pattern.

## 1. DNS (Danny / GoDaddy)
| Env | Domain | A record → |
|-----|--------|-----------|
| DEV | `merchant-dev.5bib.com` | 157.10.42.171 (VPS dev) |
| PROD | `merchant.5bib.com` | <PROD server IP> |

## 2. Logto Application (ĐÃ XONG — tạo qua Management API)
- App: **5BIB Merchant Portal** · type Traditional · id `v6g8edb1fmcsmawy1y64e`
- Redirect URIs đã set: `localhost:3006` + `merchant.5bib.com` + `merchant-dev.5bib.com` (both `/callback` + `/api/logto/sign-in-callback`)
- Scopes: API resource `https://api.5bib.com` → `merchant:read` / `merchant:finance` (token lấy theo role user)
- Sign-in Experience: username + password (đã test). Để magic-link passwordless (M3b invite) → bật **email verification-code** trong Sign-in Experience.

## 3. Backend env (BẮT BUỘC — cho M3b auto-provision hoạt động)
Set trên backend DEV + PROD `.env`:
```
LOGTO_M2M_APP_ID=<M2M app id>
LOGTO_M2M_APP_SECRET=<M2M app secret>
LOGTO_MANAGEMENT_RESOURCE=https://default.logto.app/api   # OSS quirk — KHÔNG phải auth.5bib.com/api
MERCHANT_PORTAL_LOGIN_URL=https://merchant.5bib.com         # (dev: merchant-dev.5bib.com) — link trong email mời
```
> ⚠ Thiếu `LOGTO_MANAGEMENT_RESOURCE` đúng → M2M token fail `invalid_target` → lookup/provision tắt.

## 4. Merchant container env (docker-compose / VPS .env)
```
MERCHANT_LOGTO_APP_ID=v6g8edb1fmcsmawy1y64e
MERCHANT_LOGTO_APP_SECRET=<từ Logto app secret>
MERCHANT_LOGTO_BASE_URL=https://merchant.5bib.com          # dev: https://merchant-dev.5bib.com
MERCHANT_LOGTO_COOKIE_SECRET=<random 32+ bytes>
MERCHANT_LOGTO_COOKIE_SECURE=true
BACKEND_URL=http://backend:8081                             # internal compose network
```
Container PORT=3006 (EXPOSE 3006). Host map 3006:3006 (đổi nếu trùng — vd dev offset 3086:3006).

## 5. nginx + SSL (per env)
- DEV: copy `nginx-merchant-dev.5bib.com.conf` → `/etc/nginx/sites-available/` → symlink `sites-enabled/`
- PROD: copy `nginx-merchant.5bib.com.conf` → same
- `certbot --nginx -d merchant.5bib.com` (và `-d merchant-dev.5bib.com`)
- `nginx -t && systemctl reload nginx`
- Chỉnh `proxy_pass` port nếu host map khác 3006.

## 6. CI/CD
`.github/workflows/build-and-deploy.yml` đã thêm `merchant` (paths-filter `merchant/**` → build-merchant → push GHCR `ghcr.io/5solution/5bib-result/merchant`). Deploy script bump tag + `docker compose pull/up 5bib-result-merchant`.

**VPS `/opt/5bib-result/docker-compose.yml` cần thêm service** (pull-image style, KHÔNG build):
```yaml
  5bib-result-merchant:
    image: ghcr.io/5solution/5bib-result/merchant:latest
    container_name: 5bib-result-merchant
    ports:
      - "3006:3006"          # dev có thể dùng 3086:3006 nếu trùng
    environment:
      - BACKEND_URL=http://5bib-result-backend:8081
      - LOGTO_ENDPOINT=https://auth.5bib.com
      - LOGTO_API_RESOURCE=https://api.5bib.com
      - LOGTO_APP_ID=v6g8edb1fmcsmawy1y64e
      - LOGTO_APP_SECRET=<secret>
      - LOGTO_BASE_URL=https://merchant.5bib.com   # dev: https://merchant-dev.5bib.com
      - LOGTO_COOKIE_SECRET=<random>
      - LOGTO_COOKIE_SECURE=true
    restart: unless-stopped
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

## 7. Smoke sau deploy
1. Mở `https://merchant.5bib.com` → redirect Logto login.
2. Login user merchant (có role merchant_viewer/finance + record gán quyền).
3. Dashboard hiện đúng giải của tenant; vào 1 giải → tab Vé (+ Doanh thu nếu finance).
4. Account KHÔNG role merchant → 403 "Cần quyền merchant" (verify guard).
