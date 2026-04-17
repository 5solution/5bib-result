# 5BIB Crew

Public-facing Next.js 16 app for volunteer/crew/leader registration. Hosted
at `https://crew.5bib.com`.

## Pages

- `/` — list open events
- `/events/[id]/register` — dynamic registration form (photo uploads via
  `/api/public/team-upload-photo` proxy)
- `/status/[token]` — registration status + QR for check-in

## Dev

```bash
pnpm install
BACKEND_URL=http://localhost:8081 pnpm dev
# serves on http://localhost:3003
```

## Runtime proxy

`app/api/[...proxy]/route.ts` forwards `/api/*` requests to `$BACKEND_URL`
so the browser never talks to the backend directly. Same pattern as
`admin/` and `frontend/`.

## Deployment

Intended nginx subdomain: `crew.5bib.com` → port 3003.
