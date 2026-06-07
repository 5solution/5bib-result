# FEATURE-069 M3: Deploy & Memory Sync (PARTIAL — FIRST UI SLICE)

**Status:** ✅ DONE (M3 admin-code merged; F-069 stays IN-FLIGHT — M4/M5 + 2 staging conditions remain)
**Deployed:** 2026-06-05
**Milestone:** M3 (admin UI gán quyền Merchant Portal)
**Branch:** `5bib_merchant_v1`

---

## Pre-flight
- [x] `04-qc-report-m3.md` = ✅ APPROVED (2 staging conditions, non-blocking admin-code)
- [x] `03-coder-implementation-m3.md` + `IMPLEMENTATION_NOTES-m3.md` (4 sections) present
- [x] Unit 13/13 PASS (re-run deterministic)
- [x] Scope: 9 Scope-Lock files + 2 declared test-infra (F-044 precedent) — ACCEPT, no undeclared creep
- [x] 0 backend change verified

## Manager Independent Code Review (0 red flag)
Spot-check theo IMPLEMENTATION_NOTES Section 4 priority + grep verify:
1. **access-form-dialog.tsx** — ✅ `permissions = revenueEnabled ? ['ticket_report','revenue_report'] : ['ticket_report']` (L137-138, ticket_report ALWAYS); `<Checkbox checked disabled>` ticket_report (L273); `userId disabled={isEdit}` (L214); body KHÔNG có raceOverrides (chỉ comment).
2. **page.tsx** — ✅ gate `isAdmin` + RestrictedAccess (L276-281); delete confirm destructive; pagination lùi-trang khi xóa item cuối.
3. **logto-lookup-field.tsx** — ✅ `catch → unavailable` (L53-55) không throw lên form (graceful 503).
4. **nav-groups.ts** — ✅ `requireRole: "admin"` (L91); Sidebar filter `requireRole==='admin' && isAdmin` verified.
5. **raceOverrides data-loss (QC cross-check confirm)** — ✅ backend `merchant-portal-access.service.ts:update()` dùng `if (dto.raceOverrides !== undefined)` → form omit field = PRESERVE giá trị cũ. KHÔNG data-loss. **Đây là rủi ro nguy hiểm nhất Coder tự flag — Manager + QC đều đọc backend code xác nhận an toàn.**
- Type safety: 0 `as unknown as` (loại sạch — dùng SDK typed data + narrow). Display Convention grep clean.
**Verdict: 0 red flag. APPROVED.**

## Memory diff (applied)
- `feature-log.md` — F-069 in-flight row prepend "🟠 M3 SHIPPED — ADMIN UI". Counter UNCHANGED.
- `change-history.md` — M3 entry (files + triple-gate + Forced #1 house-style + 3 TD + review).
- `codebase-map.md` — merchant-portal line +M3 admin UI block (admin/src files + nav + labels).
- `known-issues.md` — +3 TD: AUTH-SMOKE (MED, blocking M4), LIVE-WALKTHROUGH (LOW), TENANTID-FILTER (LOW).
- `conventions.md` — +note house-style "admin list pages = direct generated-SDK fn + useState (NOT TanStack hooks); dùng data typed, KHÔNG `as unknown as`" (Forced #1).

## ⚠️ 2 STAGING CONDITIONS carried forward (gắn M4, KHÔNG blocking M3 admin-code)
1. ⛔ **TD-F069-M3-AUTH-SMOKE (MED):** auth-through-flow (admin gán quyền → token merchant Logto thật → GET /me + /races 200 đúng scope) CHƯA verify — local không mint được Logto merchant JWT. **Trước M4 go-live MUST chạy staging.** Đây là gap "backend verified-through-auth" Danny muốn đóng từ PAUSE #4 — vẫn mở, honest.
2. ⚠️ **TD-F069-M3-LIVE-WALKTHROUGH (LOW):** Playwright persona live deferred (admin thiếu RTL/jsdom). Manual QA staging.

## Follow-up
- **M3b (optional):** raceOverrides UI (include/exclude race picker) + tenantId filter (reuse single TenantPicker).
- **M4:** merchant.5bib.com frontend (consume 13 merchant endpoints + merchant-labels dicts + charts). **Mở đầu M4 = chạy staging auth-smoke đóng TD-F069-M3-AUTH-SMOKE.**
- **M5:** infra (subdomain + nginx + SSL).

## Status
🟠 **FEATURE-069 M3 PARTIAL DONE — ADMIN UI gán quyền SHIPPED.** Admin (5BIB Back-Office) giờ có thể gán/sửa/gỡ quyền BTC xem báo cáo trên `/admin/merchant-portal`. Backend (20 endpoint) + admin UI complete. Remaining: M4 merchant frontend + M5 infra. Staging auth-smoke là gate bắt buộc trước M4.
