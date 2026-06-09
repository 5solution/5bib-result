# FEATURE-078: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC
**Started:** 2026-06-09
**Author:** 5bib-fullstack-engineer
**Linked:** `00`, `01`, `02`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` (8 PAUSE-78-* + impact map + 4 risk flag)
- [x] Đã đọc `01-ba-prd.md` (27 BR + 12 TC + Scope decisions)
- [x] Đã đọc `02-manager-plan.md` — verdict ✅ APPROVED + Scope Lock 32 file + 7 PAUSE-Coder + spot-check 7 file
- [x] Đã đọc memory: `conventions.md` (Dual-check helpers + Page-gate defense-in-depth)
- [x] Đã đọc code thật của file then chốt trong Scope Lock (7 file pattern reference)

---

## 🔍 Impact Assessment (Phase 1)

### Backend
- **Logto-auth module:** thêm 2 guard mới (`LogtoFinanceGuard`, `LogtoStaffOrFinanceGuard`) extends `LogtoAuthGuard`. Pattern reuse 100% từ F-069 `LogtoMerchantFinanceGuard`. Module providers + exports được wire (PAUSE-Coder-05 Manager spot-check).
- **MongoDB/MySQL:** ZERO schema change. ZERO migration. ZERO query change.
- **Redis:** ZERO key change. ZERO TTL change.
- **NestJS DI:** 2 guard mới đăng ký vào `LogtoAuthModule.providers` + `exports`. Controller tự inject qua `@UseGuards()` decorator.
- **API contract:** ZERO endpoint shape change. ZERO DTO change. Backward compat 100% — staff token request `/contracts` vẫn 200, admin token request `/finance` vẫn 200.

### Frontend
- **Next.js cache:** không đụng `revalidatePath/revalidateTag` (RBAC change pure-UI gate, không cần invalidate).
- **TanStack Query:** không đổi query keys — `["logto-user"]` staleTime 30s existing handle automatic refresh khi role thay đổi (sign-out + sign-in).
- **Boundary:** không đổi Server/Client Component boundary. 11 page gates đều Client Component existing (`"use client"`).
- **Generated SDK:** KHÔNG regenerate (PRD BR-3.4.5 explicit + verified zero DTO change).

### API Contract
- KHÔNG đổi OpenAPI schema. KHÔNG đổi response shape. KHÔNG break SDK.
- Generated SDK files `admin/src/lib/api-generated/` KHÔNG touched.

---

## ⚠️ Edge Cases Covered (Phase 2)

1. **Token có roles=['finance'] scopes=[] empty (role-based only path)** — TC-08 PASS. Mirror F-029 dual-check pattern.
2. **Token có scopes=['finance'] roles=[] empty (scope-based only path)** — TC-09 PASS. Bảo vệ trường hợp Logto config chỉ tick permission, không assign role string.
3. **Admin token KHÔNG tick `finance` permission (BR-78-02 #3-#4 inheritance fallback)** — TC-10 PASS. Phòng trường hợp Danny quên setup `finance` permission cho admin role ở Logto Dashboard.
4. **Staff-only token attempt /finance** — TC-03 throw `ForbiddenException` với VN message rõ ràng (BR-78-06). Defense-in-depth backend, không phụ thuộc UI gate.
5. **Anonymous (JWT invalid)** — TC-04 super.canActivate=false → guard return false (LogtoAuthGuard 401). Test mock chain verified.
6. **Multi-role token (admin + finance combined)** — `isFinanceOrAdmin` truth table PASS true (dual-tier user).
7. **F-076 invoice-reconcile controller mocks LogtoAdminGuard → broken sau rename** — Forced cascade fix (chi tiết IMPLEMENTATION_NOTES Section 2).

---

## 🧠 Logic & Architecture (Phase 3)

### Guard inheritance design

Chọn pattern `LogtoFinanceGuard extends LogtoAuthGuard` (KHÔNG extends `LogtoAdminGuard` hoặc `LogtoStaffGuard`) vì:

- **Finance là tier song song staff**, không subset. Nếu extends `LogtoAdminGuard` → admin-only guard chain reject finance role qua super.canActivate, sau đó chain check finance — phức tạp + dễ sai.
- **Defense-in-depth Logto + Guard fallback** (BR-78-02 #3-#4): tự define union role check trực tiếp ở guard level cho phép admin role/scope pass qua "inheritance" path mà không cần extends.

Trade-off: code duplication nhẹ giữa 4 guard files (Admin/Staff/Finance/StaffOrFinance) — mỗi file repeat 6-line role/scope check. Accepted vì rõ ràng + dễ debug.

### Nav-groups type widening

Widen `requireRole?: "admin"` → `"admin" | "finance"`. Sidebar filter logic update từ:
```typescript
(item) => !item.requireRole || (item.requireRole === "admin" && isAdmin)
```
thành ternary chain explicit:
```typescript
(item) => {
  if (!item.requireRole) return true;
  if (item.requireRole === "admin") return isAdmin;
  if (item.requireRole === "finance") return isFinance || isAdmin;
  return false;
}
```

Chọn explicit form (Manager khuyến nghị `02-manager-plan.md`) vì:
- Dev mới đọc hiểu intent ngay (`isFinance || isAdmin`) — không phải trace inheritance chain.
- Future-proof: nếu thêm tier mới (vd `viewer`), pattern extends dễ dàng.

### Page gate pattern — explicit `!isAdmin && !isFinance`

Cho 4 finance pages: `if (!isAdmin && !isFinance) return <RestrictedAccess />`.
Cho 7 contracts pages: `if (!isStaff && !isFinance) return <RestrictedAccess />`.

Chọn explicit (vs concise `!isFinance` lợi dụng inheritance) vì Manager khuyến nghị readability cho dev mới (`02-manager-plan.md` Tech approach section).

---

## 💻 Files Changed (37 file total)

### Backend (22 file)

**New (5):**
- ➕ `backend/src/modules/logto-auth/logto-finance.guard.ts` — guard finance/admin tier
- ➕ `backend/src/modules/logto-auth/logto-staff-or-finance.guard.ts` — guard loosened union staff∪finance∪admin
- ➕ `backend/src/modules/logto-auth/logto-finance.guard.spec.ts` — 17 test (TC-01..04 + TC-08..10 + edge cases)
- ➕ `backend/src/modules/logto-auth/logto-staff-or-finance.guard.spec.ts` — 20 test (TC-05..07 + union matrix)
- ➕ `backend/src/modules/logto-auth/permissions.helper.spec.ts` — 47 test (TC-12 + extend isStaffOrFinanceOrHigher truth table)

**Modified (17):**
- ✏️ `backend/src/modules/logto-auth/permissions.helper.ts` — append `isFinanceOrAdmin` + `isStaffOrFinanceOrHigher` helpers
- ✏️ `backend/src/modules/logto-auth/index.ts` — export 2 guard + 2 helper new
- ✏️ `backend/src/modules/logto-auth/logto-auth.module.ts` — register 2 guard mới vào providers + exports (PAUSE-Coder-05)
- ✏️ `backend/src/modules/finance/controllers/pnl.controller.ts` — `LogtoAdminGuard` → `LogtoFinanceGuard`
- ✏️ `backend/src/modules/finance/controllers/pnl-dashboard.controller.ts` — idem + comment hygiene fix
- ✏️ `backend/src/modules/finance/controllers/pnl-contracts-list.controller.ts` — idem + comment hygiene fix
- ✏️ `backend/src/modules/finance/controllers/pnl-export.controller.ts` — idem
- ✏️ `backend/src/modules/finance/controllers/cost-items.controller.ts` — idem + comment update (admin-only → finance-tier)
- ✏️ `backend/src/modules/finance/controllers/cost-suggestions.controller.ts` — idem
- ✏️ `backend/src/modules/finance/controllers/fee-breakdown.controller.ts` — idem
- ✏️ `backend/src/modules/finance/controllers/mysql-lookup.controller.ts` — idem
- ✏️ `backend/src/modules/invoice-reconcile/invoice-reconcile.controller.ts` — `LogtoAdminGuard` → `LogtoFinanceGuard` + comment hygiene
- ✏️ `backend/src/modules/contracts/contracts.controller.ts` — `LogtoStaffGuard` → `LogtoStaffOrFinanceGuard`
- ✏️ `backend/src/modules/contracts/contract-templates.controller.ts` — idem
- ✏️ `backend/src/modules/contracts/partners.controller.ts` — idem
- ✏️ `backend/src/modules/contracts/service-catalog.controller.ts` — idem
- ✏️ `backend/src/modules/invoice-reconcile/__tests__/invoice-reconcile.controller.spec.ts` — **FORCED CASCADE** override `LogtoAdminGuard` → `LogtoFinanceGuard` (chi tiết IMPLEMENTATION_NOTES Section 2)

### Frontend (14 file)

- ✏️ `admin/src/lib/auth-context.tsx` — add `isFinance` flag + type interface + value object
- ✏️ `admin/src/lib/nav-groups.ts` — widen `requireRole` type + đổi 3 finance items `"admin"` → `"finance"`
- ✏️ `admin/src/components/admin-shell/Sidebar.tsx` — filter logic ternary chain với finance branch
- ✏️ `admin/src/app/(dashboard)/finance/page.tsx` — gate `!isAdmin && !isFinance`
- ✏️ `admin/src/app/(dashboard)/finance/contracts/page.tsx` — gate idem
- ✏️ `admin/src/app/(dashboard)/finance/contracts/[id]/page.tsx` — gate idem
- ✏️ `admin/src/app/(dashboard)/invoice-reconcile/page.tsx` — gate idem
- ✏️ `admin/src/app/(dashboard)/contracts/page.tsx` — gate `!isStaff && !isFinance`
- ✏️ `admin/src/app/(dashboard)/contracts/[id]/page.tsx` — gate idem
- ✏️ `admin/src/app/(dashboard)/contracts/create/page.tsx` — gate idem
- ✏️ `admin/src/app/(dashboard)/contracts/services/page.tsx` — gate idem
- ✏️ `admin/src/app/(dashboard)/contracts/templates/page.tsx` — gate idem
- ✏️ `admin/src/app/(dashboard)/contracts/partners/page.tsx` — gate idem
- ✏️ `admin/src/app/(dashboard)/contracts/partners/[id]/page.tsx` — gate idem

### Docs (1 — deferred to Manager)

- ⬜ `docs/conventions.md` "Internal RBAC tier — Finance role" section — deferred to Manager `/5bib-deploy` per Scope Lock optional clause.

### SDK regenerated

- 🚫 KHÔNG regenerate. PRD BR-3.4.5 explicit + zero DTO/endpoint shape change verified.

---

## 🧪 Tests Written

### Test files (3 new) — 84 test PASS
- `logto-finance.guard.spec.ts` — 17 test (5 describe blocks: TC-01 happy finance, TC-02 admin inheritance, TC-03 staff forbid, TC-04 anonymous, TC-08/09/10 edge cases, negative cases)
- `logto-staff-or-finance.guard.spec.ts` — 20 test (TC-05/06/07 + admin inheritance + negative + union matrix it.each 7 case)
- `permissions.helper.spec.ts` — 47 test (hasUser + isAdminOrHigher + isStaffOrHigher + TC-12 isFinanceOrAdmin truth table 12 case + isStaffOrFinanceOrHigher truth table + parity property test)

### Test output PASS

```
PASS src/modules/logto-auth/permissions.helper.spec.ts
PASS src/modules/logto-auth/logto-finance.guard.spec.ts
PASS src/modules/logto-auth/logto-staff-or-finance.guard.spec.ts
Test Suites: 3 passed, 3 total
Tests:       84 passed, 84 total
Time:        2.856 s
```

### Full regression sweep (4 affected modules)

```
PASS — 54 test suites (finance + contracts + invoice-reconcile + logto-auth)
Test Suites: 54 passed, 54 total
Tests:       725 passed, 725 total
Time:        14.693 s
```

**Zero regression. F-076 invoice-reconcile.controller.spec.ts cũng PASS sau khi update guard reference.**

---

## 🛑 PAUSE/Confirmation log

| Date | What | Danny's answer |
|------|------|----------------|
| 2026-06-09 | Logto Dashboard setup XONG? (PAUSE-Coder-01) | "ok rồi" — Danny confirm setup xong, proceed coding |

PAUSE-Coder-02 (smoke test F-076 BR-18 6-step + Telegram BR-19) — PENDING — sẽ thực hiện sau khi QC PASS + trước khi merge main. Backend cần PROD env để execute smoke; staging/local cần Hiền's finance token thật từ Logto.

---

## 🚧 Scope creep / Out-of-Scope changes

- **1 forced cascade change:** `backend/src/modules/invoice-reconcile/__tests__/invoice-reconcile.controller.spec.ts` KHÔNG trong Scope Lock 32 file. Chi tiết Forced Change #1 trong `IMPLEMENTATION_NOTES.md` Section 2.
  - Lý do: F-076 controller spec dùng `overrideGuard(LogtoAdminGuard)` trong test bed. Khi controller đổi guard sang `LogtoFinanceGuard`, override không match → tất cả 10 test fail với 401 Unauthorized.
  - Fix minimal: rename import + override target. 4 chỗ touch. Zero logic change. Manager `/5bib-plan` Scope Lock đã miss file này khi enumerate Scope.

- Optional: comment hygiene update (6 controller có comment "Admin-only" cũ trở thành misleading sau rename). Fixed inline minimal — 1-2 word change per comment. Document Deviation #2 IMPLEMENTATION_NOTES.

---

## 🐛 Known limitations / Tech debt còn lại

- **TD-F078-DOCS-CONVENTIONS-INTERNAL-FINANCE-TIER** — `docs/conventions.md` section "Internal RBAC tier — Finance role" pending Manager `/5bib-deploy` (Scope Lock optional clause). Non-blocking.
- **TD-F078-SMOKE-TEST-PROD-DEFERRED** — BR-18 smoke test 6-step + BR-19 Telegram alert verify CHƯA thực hiện local (cần PROD env + Hiền's finance token thật). Sẽ thực hiện trước merge main per PAUSE-Coder-02.
- **TD-F078-FORCED-SPEC-PATTERN** — pattern Manager Scope Lock cần thêm rule: "Khi đổi `@UseGuards()` controller, audit toàn bộ `__tests__/*.controller.spec.ts` xem có `overrideGuard()` reference không + include vào Scope Lock". Sẽ document trong conventions.md.

---

## ✅ Self-Review Pipeline (Manager 2026-05-14 mandatory)

- [x] **Bước 1:** tsc + lint clean cho Scope Lock files (backend tsc — 4 pre-existing upload errors unrelated; admin tsc — 8 pre-existing result-kiosk test errors unrelated; ZERO error trên F-078 Scope Lock files)
- [x] **Bước 2:** PRD strict adherence audit — 5 tables matched verbatim (Buttons N/A no new buttons; Form Fields N/A no form; UI Step-by-Step Sidebar journey 7 step implemented; Endpoint Spec backward compat verified; TC-XX 12 TC implemented + edge cases)
- [x] **Bước 3:** Anti-pattern scan clean (no `console.log` / `: any` raw / `as unknown as` / unjustified TODO)
- [x] **Bước 4:** Hand-pick field mapping audit — N/A (RBAC change, zero schema field, zero `.map()` transforms)
- [x] **Bước 5:** PROD-readiness smoke self-test — backend tsc 0 + 725 jest PASS verified. Live curl deferred to PAUSE-Coder-02 pre-merge step (cần PROD env).
- [x] **Bước 6:** UI/UX self-inspection — KHÔNG có UI mới. Page gate render `<RestrictedAccess />` existing component đã tested F-026/F-028/F-076. Sidebar filter logic deterministic.
- [x] **Bước 7:** Real-world data sanity — N/A (RBAC change, no data input).
- [x] **Bước 8:** Files Changed vs Scope Lock — 36 file changed (32 in scope + 1 forced cascade + 3 spec docs files within "2-3 spec" Scope Lock bounds). Documented Forced + Deviation.
- [x] **Bước 9:** Generated SDK regen — KHÔNG regen (PRD BR-3.4.5 verified zero DTO change).
- [x] **Bước 10:** Unit tests PASS — 84/84 F-078 + 725/725 full sweep zero regression.
- [x] **Bước 11:** `IMPLEMENTATION_NOTES.md` written với 4 sections đầy đủ (Deviations + Forced + Tradeoffs + Reviewer Notes). Không section nào trống.

→ Status: **🟠 READY_FOR_QC**

---

## ✅ Status

- [x] **READY_FOR_QC**

**Required to mark READY_FOR_QC:**
- [x] Tất cả file trong Scope Lock đã code xong + 1 forced cascade
- [x] Unit test PASS (84/84 F-078 spec + 725/725 regression sweep)
- [x] `pnpm --filter admin generate:api` — KHÔNG cần (zero DTO change)
- [x] Không còn `console.log`, `any`, `as unknown as X` trong Scope Lock files
- [x] Lint + typecheck PASS cho Scope Lock files
- [x] `IMPLEMENTATION_NOTES.md` written với 4 sections đầy đủ

---

## 🔗 Next step

Danny chạy: `/5bib-qc FEATURE-078-finance-role-rbac`
