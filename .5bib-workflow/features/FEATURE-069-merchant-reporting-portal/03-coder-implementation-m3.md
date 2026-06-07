# FEATURE-069 M3: Coder Implementation Log — Admin UI Gán quyền Merchant

**Status:** 🟠 READY_FOR_QC
**Started/Done:** 2026-06-05
**Author:** 5bib-fullstack-engineer
**Linked:** `00-manager-init-m3.md`, `02-manager-plan-m3.md` (✅ APPROVED, skip BA)

---

## 📌 Pre-flight
- [x] Đọc `00-manager-init-m3.md` + `02-manager-plan-m3.md` (APPROVED)
- [x] Đọc memory conventions (Display Convention) + codebase-map (merchant-portal)
- [x] Đọc code thật: 7 endpoint M2a controller + DTO + nav-groups + tenant-picker + finance-labels + races/page.tsx pattern
- [x] `pnpm generate:api` chạy ĐẦU TIÊN (PAUSE point) — 7 endpoint M2a + types có trong SDK

## 🔍 Impact Assessment (Phase 1)
- **Backend:** KHÔNG đụng (pure consume). 0 schema/DB/Redis change.
- **Frontend:** Next.js client components (`'use client'`); house-style data fetch = direct generated SDK fn + useState/useEffect (KHÔNG TanStack hooks — xem Forced #1). No revalidate (client-only mutations → local refetch).
- **API contract:** SDK regenerated (additive — 7 admin + merchant fns). Không breaking.

## ⚠️ Edge Cases Covered (Phase 2)
- [x] Logto lookup 503/not-found → cho nhập tay, KHÔNG block form (graceful)
- [x] tenantIds rỗng → submit disabled + helper "Chọn ít nhất 1 BTC" (client) + backend validate lại
- [x] Edit mode: userId immutable (disabled), tenant chip prefill từ denormalized tenantNames
- [x] Delete item cuối của trang >1 → lùi 1 trang (tránh empty page)
- [x] raceCount generated thành object (OpenAPI union quirk) → formatRaceCount narrow unknown (no cast)
- [x] List error → error state + "Thử lại"; filtered-empty vs empty (CTA khác nhau)

## 🧠 Logic & Architecture (Phase 3)
- 1 dialog 2 mode (create/edit) — state reset theo `open`+`editingItem` qua useEffect; tránh stale prefill.
- `ticket_report` luôn ON + disabled (BR-MP-33); `revenue_report` checkbox optional → permissions array build `['ticket_report'(, 'revenue_report')]`.
- Permission/status/raceCount render qua `merchant-portal-labels.ts` (Display Convention).
- Admin gate `useAuth().isAdmin` + RestrictedAccess (defense-in-depth; backend LogtoAdminGuard vẫn enforce).
- Multi-tenant picker tự build (reuse `searchMysqlTenants` data source) vì TenantPicker là single-select.

## 💻 Files Changed
**Trong Scope Lock:**
- ➕ `admin/src/lib/merchant-portal-labels.ts`
- ✏️ `admin/src/lib/nav-groups.ts` (+NavItem "Quyền BTC xem báo cáo", Vận hành, admin, +ShieldCheck icon)
- ➕ `admin/src/app/(dashboard)/merchant-portal/page.tsx` (gate + list + filter + pagination + delete)
- ➕ `admin/src/app/(dashboard)/merchant-portal/_components/access-list-table.tsx`
- ➕ `.../_components/access-form-dialog.tsx`
- ➕ `.../_components/tenant-multi-picker.tsx`
- ➕ `.../_components/logto-lookup-field.tsx`
- ➕ `.../_components/permission-badge.tsx`
- ➕ `.../_components/empty-state.tsx`
- 🔄 `admin/src/lib/api-generated/*` (regenerate, auto)

**Scope ADDITION (declared — test infra, precedent F-044):**
- ➕ `admin/src/lib/merchant-portal-labels.spec.ts` (unit test pure fn)
- ✏️ `admin/jest.kiosk.config.cjs` (+1 regex để chạy spec trên) — chờ Manager xác nhận OK

## 🧪 Tests Written
```
Test Suites: 1 passed, 1 total
Tests:       13 passed, 13 total
src/lib/merchant-portal-labels.spec.ts
  formatPermission (5) · formatPermissionTier (2) · status (2) · formatRaceCount (4)
```
UI components → QC Playwright (E2E mandate trong plan). RTL/jsdom KHÔNG có trong admin (TD-F013-TESTSTACK) — component spec defer cho QC.

## 🛑 PAUSE/Confirmation log
| What | Resolution |
|------|-----------|
| `pnpm generate:api` trước code (PAUSE point) | Done — 7 endpoint M2a có trong SDK |
| KHÔNG install dep mới | Tuân thủ — dùng shadcn/Base UI sẵn có |
| **Smoke auth (PAUSE #4)** | Route mount + guard 401 verified. FULL token-flow KHÔNG chạy được local (xem Known limitations) |

## 🚧 Scope creep / additions
- CÓ (declared): `merchant-portal-labels.spec.ts` + 1 regex `jest.kiosk.config.cjs` — test-only, mirror F-044. Manager xác nhận ở deploy.
- KHÔNG đụng backend hay file ngoài merchant-portal/labels/nav/test-config.

## 🐛 Known limitations / Tech debt
- **TD-F069-M3-AUTH-SMOKE (QUAN TRỌNG):** Smoke "gán quyền → token merchant → /me 200" KHÔNG chạy được ở local — không có Logto merchant JWT (JWKS-signed, không fake được) + không có session cookie trong curl. Chỉ verify được route mounted + 401 guard. → Cần Danny cấp 1 Logto merchant test account HOẶC chạy trên staging để đóng gap "verified-through-auth". KHÔNG claim done.
- TD-F069-M3-TENANTID-FILTER: filter theo tenantId (plan liệt kê) deferred — built q + permission + status (xem IMPLEMENTATION_NOTES Deviation #1).
- raceOverrides UI: deferred M3b per PAUSE #3 (planned, không phải debt).

## ✅ Self-Review Pipeline
- [x] Bước 1: tsc --noEmit clean cho merchant-portal files (lỗi duy nhất = result-kiosk test specs CÓ SẴN, không phải scope M3)
- [x] Bước 2: PRD/Plan adherence (ticket_report locked, tenantIds≥1, Logto graceful, Display Convention)
- [x] Bước 3: Anti-pattern grep clean (no console.log / `: any` / `as unknown as`)
- [x] Bước 4: Hand-pick audit N/A (không thêm schema field; SDK types là source of truth)
- [x] Bước 5: PROD-readiness — backend routes 401 (mounted); admin tsc clean
- [~] Bước 6: UI/UX self-inspection — dialog width override (!max-w-2xl, KHÔNG sm:max-w-sm), truncate+title, empty/loading/error states, VN labels. Browser walkthrough đầy đủ → defer QC Phase 6 (admin chưa chạy interactive trong phiên này)
- [x] Bước 7: Real-world data — VN long names truncate+title; raceCount '__all'
- [x] Bước 8: Files vs Scope Lock — khớp + 2 file test-infra declared
- [x] Bước 9: generate:api đã chạy
- [x] Bước 10: Unit tests PASS (13/13)
- [x] Bước 11: IMPLEMENTATION_NOTES-m3.md viết đủ 4 sections

→ Status: 🟠 READY_FOR_QC

## 🔗 Next step
Danny chạy: `/anthropic-skills:5bib-qc-gatekeeper FEATURE-069 M3`
