# FEATURE-069 M4: Plan — Merchant Portal Frontend (merchant.5bib.com)

**Status:** ✅ APPROVED (Manager init+plan, skip BA) · **Type:** NEW_APP (frontend) · **Branch:** `5bib_merchant_v1`

## 🎯 Goal
Frontend cho BTC đăng nhập (Logto merchant) xem báo cáo vé + doanh thu — consume 13 merchant endpoints.

## 🏗️ Kiến trúc (Manager chốt)
- **NEW standalone app `merchant/`** (clone pattern `frontend/` — Next.js App Router + runtime proxy `app/api/[...proxy]` → BACKEND_URL + Logto login). Lý do: subdomain riêng + Logto Application riêng (scopes merchant) + deploy riêng (M5). KHÔNG nhét vào `frontend/` (public, no-auth) hay `admin/` (admin scope).
- Logto: `@logto/next` như admin, nhưng scopes `['openid','profile','email','offline_access','roles','merchant:read','merchant:finance']`, `LOGTO_BASE_URL=http://localhost:3006` (dev) / `https://merchant.5bib.com` (prod). **Logto Application MỚI** cần đăng ký redirect (G2/Danny).
- SDK: generate từ swagger 8081 vào `merchant/src/lib/api-generated` (chỉ dùng 13 merchant fns).
- Display Convention: `merchant/src/lib/merchant-labels.ts` (ORDER_FINANCIAL_STATUS, RACE_STATUS, ORDER_CATEGORY_GROUP, permission).
- Charts: recharts (cần `pnpm add recharts` — PAUSE confirm) hoặc reuse pattern admin nếu có.

## 📋 Scope (slices — build tuần tự)
- **M4.1 Scaffold:** `merchant/` app (package.json, next.config, tailwind, app/layout, globals, proxy route, Logto config, auth-context, login/callback). Boot localhost:3006.
- **M4.2 Shell + /me + races:** sidebar/topbar, race switcher (GET /me, /races), landing.
- **M4.3 Ticket reports:** summary KPI + by-course + by-type + trend(chart) + stacked(chart) + orders(table paginated).
- **M4.4 Revenue reports (finance-gated UI):** summary + by-category + trend(chart) + export(.xlsx download). Hide nếu không có `revenue_report` (403 → redirect ticket).
- **M4.5 labels + states + QC persona + auth-smoke (G3).**

## 🛑 PAUSE/Gate
- 🛑 `pnpm add recharts` (dep mới) — confirm Danny.
- ⛔ G2: Logto Application mới cho merchant (redirect localhost:3006 + merchant.5bib.com) — Danny tạo trên Logto.
- ⛔ G3: auth-smoke thật cần login merchant (app này khi xong sẽ tự sinh token → đóng TD-F069-M3-AUTH-SMOKE).

## 🧪 Tests
- merchant-labels unit (jest). Component states (loading/empty/error/no-permission). QC Phase 6 persona BTC walkthrough (live khi app chạy).

## Verdict: ✅ APPROVED — build M4.1 scaffold trước.
