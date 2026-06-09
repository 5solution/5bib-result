# FEATURE-078: Finance Role RBAC — Logto role `finance` cho kế toán

**Status:** 🟡 INITIATED
**Created:** 2026-06-09
**Owner:** Danny
**Type:** EXTEND_EXISTING
**Created by:** 5bib-manager

---

## 🎯 Why this feature

Hiền (kế toán) cần truy cập section **Tài chính** + **Hợp đồng** + **Đối soát hóa đơn MISA** trên admin.5bib.com. Hiện tại các section này gate bằng `LogtoAdminGuard` (Tài chính + MISA) hoặc `LogtoStaffGuard` (Hợp đồng) → kế toán hoặc bị 403 hoặc phải cấp quyền `admin` toàn quyền (vi phạm least-privilege, kế toán xem được cả vận hành/promo-hub/identity-clusters).

Mở role `finance` mới: nhân sự tài chính có quyền FULL CRUD trên 8 module liên quan kế toán mà KHÔNG đụng tới phần vận hành (giải, athlete, claim, sponsor, …). Defense-in-depth: backend Guard mới + frontend `isFinance` flag + nav `requireRole` widening.

---

## 📂 Impact Map (theo memory hiện tại + spot-check code thật)

### Module sẽ chạm

**Backend (`backend/src/modules/`):**
- `logto-auth/` — thêm guard mới `LogtoFinanceGuard`
- `finance/controllers/*` — 8 controller hiện gate `LogtoAdminGuard` → đổi sang `LogtoFinanceGuard`
- `contracts/*` — 4 controller + 2 import service hiện gate `LogtoStaffGuard` → đổi sang `LogtoFinanceGuard`
- `invoice-reconcile/` — 1 controller hiện gate `LogtoAdminGuard` → đổi sang `LogtoFinanceGuard`

**Frontend (`admin/src/`):**
- `lib/auth-context.tsx` — thêm flag `isFinance` bên cạnh `isAdmin/isStaff`
- `lib/nav-groups.ts` — mở rộng type `requireRole?: "admin"` → `requireRole?: "admin" | "finance"` + đánh dấu 8 nav item liên quan
- `app/(dashboard)/finance/**` + `app/(dashboard)/contracts/**` + `app/(dashboard)/invoice-reconcile/page.tsx` — ~10-11 page-level gate đổi từ `if (!isAdmin)` / `if (!isStaff)` → `if (!isAdmin && !isFinance)` (hoặc helper `canAccessFinance`)

**Logto Dashboard (Danny tự setup, KHÔNG phải code):**
- Resources → 5BIB Result API → Permissions → tạo permission `finance`
- Roles → tạo role `finance` → assign permission `finance`
- Roles → `admin` → assign permission `finance` (inheritance — admin ⊃ finance)
- Users → Hiền → assign role `finance`

### File then chốt cần Coder đọc trước khi code

1. `backend/src/modules/logto-auth/logto-merchant-finance.guard.ts` — **PATTERN MẪU** (F-069). Cloning pattern: `LogtoFinanceGuard extends LogtoAuthGuard` (KHÔNG extend Admin/Staff — finance là role song song, không subset).
2. `backend/src/modules/logto-auth/logto-admin.guard.ts` — tham khảo cách check `roles.includes('admin') || scopes.includes('admin')`.
3. `backend/src/modules/logto-auth/logto-staff.guard.ts` — tham khảo logic check hierarchy.
4. `backend/src/modules/finance/controllers/pnl.controller.ts` — controller mẫu để đổi guard.
5. `backend/src/modules/contracts/contracts.controller.ts` — controller mẫu (đang Staff).
6. `backend/src/modules/invoice-reconcile/invoice-reconcile.controller.ts` — controller mẫu (F-076 vừa golive).
7. `admin/src/lib/auth-context.tsx` — cần extend pattern `isAdmin/isStaff` thêm `isFinance`.
8. `admin/src/lib/nav-groups.ts` line 68 `requireRole?: "admin"` — cần widen union type.
9. `admin/src/app/(dashboard)/finance/page.tsx` line 14-16 — gate pattern mẫu.
10. `admin/src/app/(dashboard)/contracts/page.tsx` line 17-19 — gate pattern mẫu.

### Endpoint liên quan (controller cần đổi guard — verified grep)

**Finance (8 controller — đang `LogtoAdminGuard`):**
- `finance/controllers/pnl.controller.ts`
- `finance/controllers/pnl-dashboard.controller.ts`
- `finance/controllers/pnl-contracts-list.controller.ts`
- `finance/controllers/pnl-export.controller.ts`
- `finance/controllers/cost-items.controller.ts`
- `finance/controllers/cost-suggestions.controller.ts`
- `finance/controllers/fee-breakdown.controller.ts`
- `finance/controllers/mysql-lookup.controller.ts`

**Contracts (4 controller + 2 service — đang `LogtoStaffGuard`):**
- `contracts/contracts.controller.ts`
- `contracts/contract-templates.controller.ts`
- `contracts/partners.controller.ts`
- `contracts/service-catalog.controller.ts`
- `contracts/services/partners-import.service.ts` (Logto check inline trong service)
- `contracts/services/service-catalog-import.service.ts` (idem)

**Invoice Reconcile (1 controller — đang `LogtoAdminGuard`, vừa ship F-076):**
- `invoice-reconcile/invoice-reconcile.controller.ts`

**Total: 13 controller + 2 import service file cần đổi guard.**

### Schema/DB

- **MongoDB:** KHÔNG đụng.
- **MySQL platform:** KHÔNG đụng.
- **Redis:** KHÔNG đụng.
- **Logto:** thay đổi config ngoài codebase (Danny setup dashboard) — KHÔNG có migration script trong repo.

---

## ⚠️ Risk Flags

- 🔴 **HIGH — Mở rộng quyền truy cập dữ liệu kế toán (P&L, contracts, MISA invoices).** Sai sót guard = leak doanh thu/hợp đồng/hóa đơn cho user không phận sự. Defense-in-depth bắt buộc: backend Guard (LAST LINE) + frontend gate + nav `requireRole`. Test bypass URL trực tiếp (Postman) với role `staff`-only → phải 403.

- 🔴 **HIGH — Touching F-076 invoice-reconcile vừa golive sáng nay (2026-06-09).** Đổi guard trên controller MISA = nguy cơ regression alert cron. PAUSE point bắt buộc: smoke test 3 endpoint F-076 sau khi đổi guard, verify cron chạy đúng.

- 🟡 **MED — Inheritance logic `admin ⊃ finance`.** 2 cách implement: (a) Logto-level — admin role assign cả permission `admin` + `finance` (Danny setup, code ZERO awareness); (b) Guard-level — `LogtoFinanceGuard` accept cả admin role+scope như fallback. Manager đề xuất **(a) tại Logto + (b) làm defense-in-depth** — guard accept `roles=admin` để tránh case Danny quên tick permission ở Logto dashboard. Quyết định cuối ở PRD.

- 🟡 **MED — Nav-groups type widening.** Đổi `requireRole?: "admin"` thành `"admin" | "finance"` có thể vỡ TypeScript narrowing ở mọi consumer. Grep `requireRole` cẩn thận.

- 🟡 **MED — Multi-guard hierarchy ambiguity.** Contracts hiện gate `Staff` (loose). Đổi sang `Finance` (strict) → existing `staff`-only user sẽ MẤT quyền vào contracts! Đây là **breaking RBAC change** với staff hiện tại. PAUSE bắt buộc cho Danny: có user `staff`-only nào đang dùng /contracts không? Nếu có → phải allow `staff` OR `finance` OR `admin` (tức là Finance guard NỚI hơn cho contracts, không thay thế).

- 🟢 **LOW — Frontend page gate refactor.** ~11 file đổi từ `if (!isAdmin)` → `if (!isAdmin && !isFinance)`. Mechanical change, Coder có thể grep replace; nhưng QC phải verify từng page render đúng cho cả 3 role.

- 🟢 **LOW — Logto setup steps.** Danny tự làm, Manager chỉ deliver checklist trong `02-manager-plan.md` Phụ lục.

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

BA phải trả lời trong `01-ba-prd.md` section "Answers to Manager's PAUSE":

- [ ] **PAUSE-78-01 (CRITICAL):** Staff hiện tại có ai đang truy cập `/contracts/*` không? Nếu có → contracts không được đổi Staff → Finance một chiều. Đề xuất: `LogtoFinanceGuard` cho contracts cần accept `roles=staff OR finance OR admin` (loosened policy), KHÔNG strict-only-finance. BA confirm semantic + ghi vào BR.
- [ ] **PAUSE-78-02:** Inheritance `admin ⊃ finance` setup ở Logto-side hay Guard-side hay cả hai? Manager đề xuất **cả hai** (Logto = source-of-truth, Guard = defense fallback).
- [ ] **PAUSE-78-03:** Tên role chính xác Logto: `finance` (Manager đề xuất, match `merchant_finance` naming) hay `accountant` (Vietnam idiom)? Permission code: `finance` hay `finance:read,finance:write` (granular)?
- [ ] **PAUSE-78-04:** Finance role có được phép xem `/reconciliations` (Đối soát merchant — nav "Vận hành") không? Section đó hiện không gate `requireRole=admin`, staff thấy được. Nếu finance subset không thấy Vận hành → cần check.
- [ ] **PAUSE-78-05:** Finance role có cần xem `/dashboard` tổng quan KPI không? Hay chỉ vào thẳng /finance? Ảnh hưởng UX: login → landing page đâu?
- [ ] **PAUSE-78-06:** FULL CRUD nghĩa là gì cụ thể? Có endpoint nào trong scope cần GIỚI HẠN finance read-only không (vd MISA trigger manual scan = mutation, có cho phép finance trigger không)?
- [ ] **PAUSE-78-07:** Audit log cho finance role action (vd kế toán xóa cost_item, edit contract)? Có cần log riêng `actorRole=finance` không?
- [ ] **PAUSE-78-08:** Rollback plan nếu deploy gây 403 mass-error: revert guard về Admin tạm thời? Có cần feature flag `RBAC_FINANCE_ROLE_ENABLED` env không?

---

## 🎯 Success criteria (gợi ý cho BA)

- Hiền login Logto với role `finance` → vào được TẤT CẢ 8 module Tài chính + Hợp đồng + MISA reconcile.
- Hiền KHÔNG vào được /dashboard merchant-portal, /promo-hub, /identity-clusters, /races, /athletes (admin-only hoặc staff-only).
- User `admin` cũ → KHÔNG bị regression, vẫn full quyền (inheritance defense).
- User `staff`-only hiện tại → contracts vẫn truy cập được (per PAUSE-78-01 decision).
- Backend bypass test (Postman với token `staff`-only) → /finance + /invoice-reconcile trả 403.
- Frontend: nav chỉ render module được phép cho từng role.
- F-076 cron + alert tiếp tục chạy bình thường (zero regression race 220 mở bán).

Performance: trip thêm `roles/scopes` check trong guard ~1ms, không SLA mới.

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] **Yes** — BA có thể bắt đầu PRD ngay.
- [ ] Cần Danny xác nhận trước:
  - PAUSE-78-01 (contracts staff fallback) — Danny biết best vì biết Hiền + team staff hiện tại
  - PAUSE-78-03 (Logto role name + permission granularity) — Danny setup Logto nên cần Danny chốt naming
  - PAUSE-78-08 (env flag rollback có cần không) — Manager đề xuất CÓ để safe deploy

> Manager note: 3 PAUSE trên BA có thể tự đề xuất trong PRD; Danny review ở `/5bib-plan`.

---

## 🔗 Next step

Danny chạy: `/5bib-prd FEATURE-078-finance-role-rbac`
