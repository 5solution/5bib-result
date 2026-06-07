# FEATURE-069 M3 — QC Report (Admin UI Gán quyền Merchant Portal)

**Status:** ✅ APPROVED (với 2 điều kiện staging — xem Verdict)
**Tested:** 2026-06-05
**Author:** 5bib-qc-gatekeeper
**Linked:** `02-manager-plan-m3.md` (no 01 — skip BA), `03-coder-implementation-m3.md`, `IMPLEMENTATION_NOTES-m3.md`

---

## 📌 Pre-flight
- [x] `03` status = 🟠 READY_FOR_QC + Tests Written có output PASS (13/13)
- [x] Đọc `02-manager-plan-m3.md` (requirement source) + IMPLEMENTATION_NOTES-m3 (Section 4 priority)
- [x] Đọc conventions (Display Convention) + 7 endpoint M2a controller + backend update service
- [x] Re-run unit test LOCAL → 13/13 pass deterministic

---

## 🔍 Phase 1: Impact & Regression Audit

### Coder got right
- 0 backend change — pure consume SDK (regenerated, additive, no breaking).
- Scope match: 9 file Scope-Lock + 2 declared test-infra (`merchant-portal-labels.spec.ts` + jest regex) — precedent F-044, ACCEPT.
- `generate:api` chạy trước code (PAUSE point tuân thủ) — 7 admin fn + types có trong SDK.
- House style đúng: direct SDK fn + useState (races/page.tsx pattern), KHÔNG TanStack hooks (repo không sinh hooks) — Forced #1 hợp lý.

### Verified — KHÔNG có regression
- **🟢 Deviation #2 data-loss risk (Coder tự flag) — VERIFIED SAFE.** Đọc `merchant-portal-access.service.ts:update()`: dùng `if (dto.raceOverrides !== undefined)` PATCH partial. Form M3 KHÔNG gửi `raceOverrides` (grep confirm chỉ có comment) → backend GIỮ NGUYÊN `existing.raceOverrides`. KHÔNG reset, KHÔNG data-loss. ✅
- raceCount generated thành object (OpenAPI union quirk) → `formatRaceCount(unknown)` narrow — đúng, tránh cast.

## 🛡️ Phase 2: Security Threat Model

| Threat | Vector | Risk | Status |
|--------|--------|------|--------|
| Non-admin truy cập UI gán quyền | Navigate `/merchant-portal` | HIGH | ✅ Triple-layer: Sidebar `requireRole` filter + page `isAdmin` gate + backend `LogtoAdminGuard` |
| Nav item leak cho staff | Sidebar render | MED | ✅ `visibleGroups` filter `requireRole==='admin' && isAdmin` (Sidebar.tsx L90-95) |
| Privilege escalation qua API | POST/PATCH/DELETE direct | CRITICAL | ✅ Mọi endpoint M2a class-level `LogtoAdminGuard` (verified controller L59) + 401 confirmed |
| Injection | Form input | LOW | ✅ Pure UI, no raw SQL/Mongo; backend validate DTO + SETNX lock (M2a tested) |
| Info disclosure | List/detail response | MED | ✅ Render từ `AccessConfigListItemDto` (backend đã strip `_id`→`id`); no fee/internal field |
| Display leak raw enum | JSX text | LOW | ✅ grep `(ticket_report\|revenue_report\|ticket_only\|...)` trong JSX text = rỗng |

## 🧪 Phase 3+4: Test execution

```
Unit (jest.kiosk): src/lib/merchant-portal-labels.spec.ts
Test Suites: 1 passed · Tests: 13 passed, 13 total · deterministic
tsc --noEmit: merchant-portal scope = 0 errors (lỗi tồn tại = result-kiosk specs CÓ SẴN, ngoài scope M3)
anti-pattern grep: 0 (no console.log / :any / as unknown as / eval / $where)
```
- **10x concurrency rule:** N/A frontend (no client-side last-seat). Mutating concurrency (concurrent same-userId create/update) đã có SETNX lock backend M2a — tested ở `merchant-portal-access.adversarial.spec.ts`.

## 🛡️ Smoke Auth (PAUSE #4) — PARTIAL, gap disclosed
| Route | No-token | Kết quả |
|-------|----------|---------|
| GET `/admin/merchant-portal/access` | expect 401 | ✅ 401 |
| GET `/admin/merchant-portal/logto-lookup` | expect 401 | ✅ 401 |
| POST `/admin/merchant-portal/access` | expect 401 | ✅ 401 |
| GET `/merchant-portal/me` | expect 401 | ✅ 401 |
| GET `/merchant-portal/races` | expect 401 | ✅ 401 |

⛔ **FULL token-through-flow (gán quyền → token merchant → /me 200) KHÔNG verify được local** — không có Logto merchant JWT (JWKS-signed) + curl không session. **Gap "verified-through-auth" VẪN MỞ** → điều kiện staging (xem Verdict). QC KHÔNG fake.

## 📋 Phase 5: Plan Compliance (no PRD → dùng plan + PAUSE)
- [x] `ticket_report` luôn ON + disabled (BR-MP-33) — verified form code + unit
- [x] `revenue_report` optional checkbox
- [x] tenantIds ≥1 client validate (disable submit) + backend re-validate
- [x] userId immutable khi edit (disabled input)
- [x] Logto 503/not-found → nhập tay graceful (catch → unavailable, no throw)
- [x] Display Convention (permission/status/raceCount qua labels dict)
- [x] Admin-only (PAUSE #1) · tenant multi reuse data source (PAUSE #2) · raceOverrides defer M3b (PAUSE #3)
- [~] **Deviation #1:** tenantId filter UI bỏ (plan liệt kê 4 filter, build 3). ACCEPT — tenantNames hiện + q search đủ; backend vẫn support param. Ghi TD.

## 🎭 Phase 6: Persona Journey — STATIC review (live walkthrough deferred)

> ⚠️ Admin KHÔNG có RTL/jsdom (TD-F013-TESTSTACK) + env non-interactive → live Playwright KHÔNG chạy được. QC làm **static code-read scrutiny** + viết journey spec cho manual QA / staging.

**Persona: Back-Office Admin (Hằng) — gán quyền BTC**
| # | Action | UI behavior (code-verified) | Verification |
|---|--------|----------------------------|--------------|
| 1 | Vào `/merchant-portal` (admin) | Gate `isAdmin`; staff→RestrictedAccess | page.tsx gate ✅ |
| 2 | Click "Gán quyền mới" | Dialog mở, mode create | `openCreate` reset state ✅ |
| 3 | Tra email Logto → "Tra cứu" | found→prefill; 503→nhập tay | logto-lookup-field ✅ |
| 4 | Chọn ≥1 BTC (chips) | multi-select, chip + remove | tenant-multi-picker ✅ |
| 5 | Tick "Báo cáo doanh thu" (optional) | ticket_report locked-on | form ✅ |
| 6 | Submit | dup 409→toast VN giữ form; OK→toast + refresh | extractError + onSaved ✅ |
| 7 | Sửa / Gỡ (confirm destructive) | edit prefill (userId disabled); delete useConfirm | openEdit + handleDelete ✅ |

**UI/UX 10-item (static code-read):**
- [x] Dialog width override `!max-w-2xl` (KHÔNG sm:max-w-sm — F-032 lesson) · [x] truncate+title (table cells, chips) · [x] empty + filtered-empty phân biệt CTA · [x] loading skeleton · [x] error state + "Thử lại" · [x] success toast + refetch · [x] field-level validation đỏ · [x] VN labels (no raw enum) · [x] picker chip/remove pattern · [~] sticky footer dialog (DialogFooter sẵn, scroll dài chưa test live)
- [~] **Live interactive walkthrough → deferred staging/manual** (env limitation, không phải defect).

**Real-world data (static):** [x] VN long name truncate+title chips · [x] raceCount '__all'→"Tất cả giải" · [~] còn lại cần live render.

## 🚧 Tech debt (Manager → known-issues)
- **TD-F069-M3-AUTH-SMOKE (MED):** token-through-flow chưa verify — cần Logto merchant test account / staging. **Blocker cho M4 launch, KHÔNG cho M3 admin-code merge.**
- **TD-F069-M3-LIVE-WALKTHROUGH (LOW):** Playwright persona walkthrough deferred tới khi admin có RTL/jsdom (TD-F013-TESTSTACK) hoặc manual QA staging.
- **TD-F069-M3-TENANTID-FILTER (LOW):** filter theo tenantId chưa build (Deviation #1).

## 📊 Final Verdict

### ✅ APPROVED — với 2 điều kiện staging (non-blocking cho admin-code, blocking cho M4 merchant launch)

**Lý do APPROVE:** Mọi check khả thi trong env đều PASS — tsc clean, anti-pattern clean, Display Convention clean, unit 13/13 deterministic, security triple-gate verified, **data-loss risk Deviation #2 đọc backend xác nhận SAFE**. 2 deviation hợp lý (tenantId filter giảm scope; raceOverrides defer đúng PAUSE #3). Scope addition test-infra hợp lệ (F-044 precedent).

**2 gap còn lại là ENV LIMITATION (Coder disclosed honest), KHÔNG phải code defect** — reject về Coder vô nghĩa (Coder cũng không mint được Logto token). Chuyển thành điều kiện staging:
1. ⛔ **Trước khi M4 (merchant frontend) go-live:** chạy auth-through-smoke trên staging (Logto merchant account thật → /me + /races đúng scope). Đây mới đóng gap "backend verified-through-auth".
2. ⚠️ **Manual QA staging:** persona walkthrough live (7 step) + 10-item UI/UX trên browser thật.

→ Manager `/5bib-deploy` ghi 3 TD vào known-issues, mark M3 admin-code DONE, giữ điều kiện staging gắn M4.

## 🔗 Next step
Danny chạy: `/anthropic-skills:5bib-manager FEATURE-069 M3`
