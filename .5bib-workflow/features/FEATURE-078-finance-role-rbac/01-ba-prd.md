# FEATURE-078: PRD — Finance Role RBAC cho kế toán nội bộ

**Status:** 🔵 READY
**Last updated:** 2026-06-09
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` đầy đủ (8 PAUSE-78-* + 4 risk flag + impact map)
- [x] Đã đọc `memory/codebase-map.md` phần `logto-auth/`, `finance/`, `contracts/`, `invoice-reconcile/`
- [x] Đã đọc `memory/conventions.md` section "Dual-check permission helpers" + "Page-gate defense-in-depth pattern"
- [x] Đã đọc `memory/known-issues.md` — không có known issue trên logto-auth
- [x] Đã spot-check code thật:
  - `logto-merchant-finance.guard.ts` (F-069 pattern mẫu)
  - `logto-admin.guard.ts` + `logto-staff.guard.ts` (Internal pattern hiện tại)
  - `permissions.helper.ts` (BR-29 pure helper)
  - `auth-context.tsx` (frontend hierarchy)
  - `Sidebar.tsx` line 86-95 (nav filter logic)
  - 3 controller mẫu (pnl/contracts/invoice-reconcile)

---

## 📝 Finance Role RBAC — Logto role `finance` cho kế toán nội bộ 5BIB

**Goal:** Mở role `finance` mới trong Logto cho nhân sự kế toán (Hiền) truy cập 8 module liên quan kế toán (3 Tài chính + 4 Hợp đồng + 1 MISA Reconcile) mà KHÔNG cần cấp role `admin` toàn quyền. Tuân thủ nguyên tắc least-privilege: kế toán KHÔNG xem được Vận hành / Athletes / Promo / Identity Clusters.

**Scope:**

✅ **In scope:**
- Backend: tạo 2 guard mới `LogtoFinanceGuard` + `LogtoStaffOrFinanceGuard`; thêm 1 helper `isFinanceOrAdmin()` vào `permissions.helper.ts`; cập nhật 13 controller (8 finance + 4 contracts + 1 invoice-reconcile).
- Frontend: cập nhật `auth-context.tsx` thêm flag `isFinance`; widen `nav-groups.ts` type `requireRole`; cập nhật `Sidebar.tsx` filter logic; cập nhật ~11 page gate.
- Logto Dashboard (Danny tự setup, KHÔNG phải code): tạo permission `finance` + role `finance` + assign Hiền + admin role inherit permission `finance`.
- Cập nhật `docs/conventions.md` thêm section "Internal RBAC tier — Finance role".
- Smoke test F-076 invoice-reconcile (vừa golive sáng nay) sau đổi guard.

❌ **Out of scope:**
- Tạo permission granular `finance:read` vs `finance:write` (giữ 1 permission `finance` cho MVP — Hiền cần FULL CRUD theo scope chốt với Danny).
- Audit log `actorRole=finance` riêng (dùng audit-log.service hiện có, role trace qua `userId` + Logto claims — không thêm field DB).
- Mở quyền cho merchant.5bib.com (merchant_finance đã có F-069, KHÔNG đụng).
- Phân quyền sub-page trong module (vd kế toán chỉ xem P&L summary, không export) — toàn module hoặc không có.
- Env feature flag `RBAC_FINANCE_ROLE_ENABLED` (đã đề xuất ở init nhưng BA đề xuất KHÔNG cần — rollback bằng `git revert` nếu sự cố, thêm flag = thêm complexity. Xem PAUSE-78-08 answer).
- /reconciliations (đối soát merchant) — section Vận hành, không gate role finance.
- /dashboard tổng quan — finance vào được KPI vận hành, không gate.

---

## 👤 User Stories & Business Rules

### User Stories

- **US-01.** As a **5BIB Back-Office Admin (Hiền — kế toán)**, I want to **login Logto với role `finance` rồi vào `/finance` + `/contracts` + `/invoice-reconcile`** so that **tôi làm việc kế toán hằng ngày mà không cần cấp role admin (vi phạm least-privilege)**.

- **US-02.** As a **5BIB Back-Office Admin (Hiền — kế toán)**, I want to **chỉ thấy sidebar 3 group "Tài chính" + "Hợp đồng" + nav item "Đối soát hóa đơn MISA" + nav item public chung (Vận hành cơ bản)** so that **tôi không bị overwhelm bởi nav item vận hành không liên quan**.

- **US-03.** As a **5BIB Back-Office Admin (Hiền — kế toán)**, I want to **tạo / sửa / xóa cost_item, edit contract template, trigger MISA reconcile on-demand** so that **tôi xử lý đúng công việc kế toán FULL CRUD không bị block read-only**.

- **US-04.** As a **5BIB Back-Office Admin (Hiền — kế toán)**, I want to **nếu cố truy cập URL `/promo-hub` hoặc `/identity-clusters` (admin-only)** so that **frontend hiển thị `<RestrictedAccess />` rõ ràng + backend trả 403 cho mọi API admin-only**.

- **US-05.** As a **5BIB Back-Office Admin (Danny — admin)**, I want to **giữ nguyên TOÀN BỘ quyền hiện tại trên mọi module** so that **mở rộng role finance KHÔNG ảnh hưởng workflow admin của tôi (zero regression)**.

- **US-06.** As a **5BIB Staff (Tâm — sales/ops)**, I want to **vẫn truy cập `/contracts/*` như cũ** so that **tôi không bị mất quyền vận hành hợp đồng đang dùng hàng ngày**.

- **US-07.** As a **5BIB Back-Office Admin**, I want to **API endpoint MISA reconcile vẫn chạy cron đều đặn không gián đoạn** so that **F-076 alert race 220 mở bán hôm nay không bị regress khi đổi guard**.

- **US-08.** As a **5BIB Auditor (compliance)**, I want to **bypass test với token chỉ có role `staff` đến `/api/admin/invoice-reconcile/trigger` trả 403** so that **đảm bảo defense-in-depth backend, không phụ thuộc UI gate**.

### Business Rules

#### Authentication & Authorization

- **BR-01.** Role `finance` mới được tạo ở Logto Dashboard. Permission code: `finance` (1 permission duy nhất, KHÔNG granular `finance:read` / `finance:write`).
- **BR-02.** User được coi là "finance tier" nếu thoả MỘT trong 4 điều kiện:
  1. `roles` claim chứa `'finance'`
  2. `scopes` claim chứa `'finance'`
  3. `roles` claim chứa `'admin'` HOẶC `'super_admin'` (admin inherit)
  4. `scopes` claim chứa `'admin'` HOẶC `'admin:all'` HOẶC `'all'` (super admin override)
- **BR-03.** Inheritance hierarchy: `staff < finance < admin < all` (admin pass mọi finance check; finance KHÔNG pass admin check; finance KHÔNG pass staff check tự động — finance là role song song với staff, không subset).
- **BR-04.** Module **Tài chính** (P&L 3 controller) + **Đối soát hóa đơn MISA** (F-076) gate `LogtoFinanceGuard` — chỉ user thoả BR-02 mới truy cập được. Existing staff-only user MẤT quyền truy cập (acceptable — không ai staff-only đang dùng /finance + /invoice-reconcile vì hiện tại chỉ Admin có quyền).
- **BR-05.** Module **Hợp đồng** (4 controller) gate `LogtoStaffOrFinanceGuard` — chấp nhận staff/finance/admin/super_admin/all (loosened policy). Lý do: existing staff (Tâm, Hằng, ...) đang dùng /contracts daily ops, không được mất quyền. PAUSE-78-01 chốt.
- **BR-06.** Backend guard reject = throw `ForbiddenException` với message tiếng Việt cụ thể chỉ rõ permission thiếu + hướng dẫn liên hệ admin nâng cấp. KHÔNG generic "Forbidden".
- **BR-07.** Frontend `useAuth().isFinance` flag thêm vào `AuthContextType`. Logic: `isFinance = isAdmin || hasScope('finance') || hasRole('finance')`. Admin tier tự động pass `isFinance` check (inheritance).
- **BR-08.** Frontend page gate cho 3 finance pages + invoice-reconcile: `if (!isAdmin && !isFinance) return <RestrictedAccess />;` (cũ: `if (!isAdmin)`). Pages liệt kê BR-21.
- **BR-09.** Frontend page gate cho 7 contracts pages: `if (!isStaff && !isFinance) return <RestrictedAccess />;` (cũ: `if (!isStaff)`). Lý do: admin → isStaff = true (inheritance), staff → isStaff = true, finance → cần extra check. Pages liệt kê BR-22.
- **BR-10.** Nav-groups `requireRole` type union widen: `requireRole?: "admin" | "finance"`. Item `requireRole="finance"` hiển thị cho **finance** + **admin** (KHÔNG staff). Item `requireRole="admin"` hiển thị cho **chỉ admin** (KHÔNG finance, KHÔNG staff) — giữ nguyên semantic cũ.
- **BR-11.** Sidebar filter logic update: `!item.requireRole || (item.requireRole === "admin" && isAdmin) || (item.requireRole === "finance" && (isFinance || isAdmin))`.

#### Logto Dashboard Setup (Danny tự làm)

- **BR-12.** Trong Logto Dashboard → Resources → "5BIB Result API" → Permissions → tạo permission mới tên `finance` với description "Truy cập module Tài chính / Hợp đồng / Đối soát hóa đơn nội bộ 5BIB".
- **BR-13.** Trong Logto Dashboard → Roles → tạo role mới tên `finance` → assign permission `finance` (BR-12) trên resource "5BIB Result API".
- **BR-14.** Trong Logto Dashboard → Roles → `admin` (existing) → assign thêm permission `finance` (BR-12). Lý do: admin inherit finance permission ở Logto-side (defense-in-depth layer 1).
- **BR-15.** Trong Logto Dashboard → Users → tìm tài khoản Hiền (kế toán) → Roles → assign role `finance` (BR-13). Hiền sign-out + sign-in lại để token claims refresh.

#### Coverage & Inheritance Defense

- **BR-16.** Backend guard implementation phải dual-check: `roles.includes('finance') || scopes.includes('finance')` (PLUS admin inheritance từ BR-02). Lý do: tránh case Danny quên tick "Include in access token" cho permission `finance` ở Logto → fallback role-based check vẫn hoạt động.
- **BR-17.** `permissions.helper.ts` thêm pure function `isFinanceOrAdmin(user)` mirror `LogtoFinanceGuard.canActivate` verbatim. Pattern song song `isStaffOrHigher` + `isAdminOrHigher`. Reserved cho service-level branching tương lai (chưa dùng v1 nhưng định nghĩa sẵn để conventions.md consistent).

#### Smoke Test F-076 Mandatory

- **BR-18.** TRƯỚC khi deploy → Coder phải chạy smoke test F-076 invoice-reconcile sau khi đổi guard:
  1. `GET /api/admin/invoice-reconcile/health` với admin token → 200
  2. `GET /api/admin/invoice-reconcile/today` với admin token → 200 + body shape không đổi
  3. `POST /api/admin/invoice-reconcile/trigger` với admin token → 200 hoặc 409 lock-aware
  4. `GET /api/admin/invoice-reconcile/health` với finance token (token mới tạo Hiền) → 200
  5. `GET /api/admin/invoice-reconcile/today` với staff-only token → 403 expected
  6. Verify cron `@Cron('0 */5 8-22 * * *')` log chạy vào lần tick tiếp theo (≤5 phút).
- **BR-19.** Coder MUST verify Telegram alert vẫn gửi được sau đổi guard (cron không phụ thuộc guard, nhưng smoke test toàn bộ flow để chắc chắn không có regression).

#### Rollback

- **BR-20.** KHÔNG dùng env feature flag `RBAC_FINANCE_ROLE_ENABLED` (PAUSE-78-08 BA đề xuất KHÔNG cần — rollback bằng `git revert` commit nếu sự cố). Lý do: thêm env flag = thêm complexity test matrix; rollback git đơn giản hơn cho RBAC change.

#### Page coverage detail

- **BR-21.** Frontend pages dùng `isAdmin` gate (Tài chính + MISA — 4 pages):
  1. `admin/src/app/(dashboard)/finance/page.tsx`
  2. `admin/src/app/(dashboard)/finance/contracts/page.tsx`
  3. `admin/src/app/(dashboard)/finance/contracts/[id]/page.tsx`
  4. `admin/src/app/(dashboard)/invoice-reconcile/page.tsx`
- **BR-22.** Frontend pages dùng `isStaff` gate (Contracts — 7 pages):
  1. `admin/src/app/(dashboard)/contracts/page.tsx`
  2. `admin/src/app/(dashboard)/contracts/[id]/page.tsx`
  3. `admin/src/app/(dashboard)/contracts/create/page.tsx`
  4. `admin/src/app/(dashboard)/contracts/services/page.tsx`
  5. `admin/src/app/(dashboard)/contracts/templates/page.tsx`
  6. `admin/src/app/(dashboard)/contracts/partners/page.tsx`
  7. `admin/src/app/(dashboard)/contracts/partners/[id]/page.tsx`

#### Backend controller coverage detail

- **BR-23.** Controllers đổi từ `LogtoAdminGuard` → `LogtoFinanceGuard` (9 file):
  - **Finance (8):** `pnl.controller.ts`, `pnl-dashboard.controller.ts`, `pnl-contracts-list.controller.ts`, `pnl-export.controller.ts`, `cost-items.controller.ts`, `cost-suggestions.controller.ts`, `fee-breakdown.controller.ts`, `mysql-lookup.controller.ts`
  - **Invoice Reconcile (1):** `invoice-reconcile.controller.ts`
- **BR-24.** Controllers đổi từ `LogtoStaffGuard` → `LogtoStaffOrFinanceGuard` (4 file):
  - `contracts.controller.ts`, `contract-templates.controller.ts`, `partners.controller.ts`, `service-catalog.controller.ts`
- **BR-25.** Total backend file change scope: **13 controller + 2 guard new + 1 helper extend + 1 index export update = 17 file**. KHÔNG đụng services/* (import services không có inline guard, chỉ comment reference).

---

## 🖥️ UI/UX Flow — STEP-BY-STEP CHI TIẾT

### Route structure (no new routes, no new pages — UI logic chỉ thay đổi gate)

- Existing routes giữ nguyên path:
  - `/finance`, `/finance/contracts`, `/finance/contracts/[id]` (Admin/Finance, was Admin-only)
  - `/contracts`, `/contracts/[id]`, `/contracts/create`, `/contracts/services`, `/contracts/templates`, `/contracts/partners`, `/contracts/partners/[id]` (Staff/Finance/Admin, was Staff/Admin)
  - `/invoice-reconcile` (Admin/Finance, was Admin-only)

Access control matrix:

| Route | Anonymous | Staff-only | Finance | Admin |
|-------|-----------|-----------|---------|-------|
| `/finance/*` | 401 redirect login | 403 `<RestrictedAccess />` | ✅ Render | ✅ Render |
| `/contracts/*` | 401 redirect login | ✅ Render (unchanged) | ✅ Render | ✅ Render |
| `/invoice-reconcile` | 401 redirect login | 403 `<RestrictedAccess />` | ✅ Render | ✅ Render |
| `/dashboard`, `/races`, `/merchants`, `/athletes` | 401 | ✅ Render | ✅ Render (no change) | ✅ Render |
| `/promo-hub`, `/identity-clusters`, `/analytics`, `/merchant-portal` (admin-only) | 401 | 403 (unchanged) | 403 `<RestrictedAccess />` | ✅ Render |

### Screen 1: Sidebar navigation — UI changes only

**Header:** Logo "5BIB Result" + user avatar dropdown (existing).
**Body:** Sidebar groups + items render theo `NAV_GROUPS` filter logic BR-11.
**Footer:** N/A.

#### UI Step-by-Step Numbered Table

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Hiền (role=finance) đăng nhập Logto → callback `/api/logto/callback` | TanStack Query `logto-user` fetch userInfo, `roles=['finance']` populated | `AuthProvider` query | `isFinance=true`, `isAdmin=false`, `isStaff=false` |
| 2 | Sidebar render | Filter `NAV_GROUPS` theo BR-11 | `SidebarNav` useEffect | Visible groups: "Vận hành" (chỉ items KHÔNG `requireRole`), "Hợp đồng" (full 4 items, `requireRole=finance`), "Tài chính" (full 3 items, `requireRole=finance`), "Nội dung" (items không `requireRole`), "Hỗ trợ" (visible) |
| 3 | Hiền click "Tổng quan P&L" → `/finance` | Page-level gate check `isAdmin \|\| isFinance` (BR-08) → render `DashboardClient` | `<FinancePageGate>` | P&L Dashboard load |
| 4 | Hiền click "Danh sách hợp đồng" → `/contracts` | Page-level gate check `isStaff \|\| isFinance` (BR-09) → render `ContractsListClient` | `<ContractsListPageGate>` | Contracts list load |
| 5 | Hiền nhập URL trực tiếp `/promo-hub` | Page-level gate (nếu có) hoặc nav filter giấu item, page render nhưng API trả 403 | `useAuth().isAdmin === false` | `<RestrictedAccess />` hoặc 403 toast |
| 6 | Admin (Danny, role=admin) đăng nhập | `isAdmin=true`, `isFinance=true` (inheritance), `isStaff=true` | `AuthProvider` query | Sidebar render TOÀN BỘ groups (no regression) |
| 7 | Staff (Tâm, role=staff) đăng nhập | `isAdmin=false`, `isFinance=false`, `isStaff=true` | `AuthProvider` query | Sidebar: "Vận hành" (no admin items), "Hợp đồng" (4 items vẫn thấy — `requireRole=finance` filter cho phép finance/admin, NHƯNG staff đang KHÔNG có quyền finance) → **WAIT: nếu nav-groups Hợp đồng items được đánh dấu `requireRole="finance"` thì staff sẽ MẤT thấy nav!** |

#### ⚠️ Critical UX clarification — BR-26

- **BR-26.** Nav-groups items trong **Hợp đồng** group KHÔNG được đánh dấu `requireRole="finance"`. Lý do: contracts loosened policy (BR-05, BR-09) chấp nhận staff/finance/admin → nav phải hiển thị cho cả 3 tier, đồng nghĩa **default visible (no requireRole gate)**. Backend guard `LogtoStaffOrFinanceGuard` + page gate `if (!isStaff && !isFinance)` là 2 layer phòng vệ đủ.

- **BR-27.** Nav-groups items trong **Tài chính** group (3 items: `finance-pnl-dashboard`, `finance-pnl-contract`, `invoice-reconcile`) đổi từ `requireRole="admin"` → `requireRole="finance"`. Hiển thị cho finance/admin, ẨN với staff-only.

#### Buttons Specification Table

| Button label | Position | Default state | Disabled state | Loading state | Action | Confirm dialog? |
|--------------|----------|---------------|----------------|---------------|--------|-----------------|
| Sidebar nav item "Tổng quan P&L" | Sidebar group "Tài chính" | Active link nếu match pathname | N/A | N/A | Next.js `<Link>` to `/finance` | NO |
| Sidebar nav item "Danh sách hợp đồng" | Sidebar group "Hợp đồng" | Active link nếu match pathname | N/A | N/A | Next.js `<Link>` to `/contracts` | NO |
| Sidebar nav item "Đối soát hóa đơn MISA" | Sidebar group "Tài chính" | Active link nếu match pathname + badge "NEW" giữ nguyên | N/A | N/A | Next.js `<Link>` to `/invoice-reconcile` | NO |
| `<RestrictedAccess />` "Quay lại Dashboard" CTA | Page body khi gate fail | Primary | N/A | N/A | Next.js `<Link>` to `/dashboard` | NO |

#### Form Fields Specification Table — N/A

Feature này KHÔNG có form input UI mới. Form đã có sẵn trong các module (contracts/finance/invoice-reconcile) — không đụng.

#### Field source table — N/A (no new fields)

#### UI States

| State | Trigger | Render |
|-------|---------|--------|
| **Loading** | `useAuth().isLoading === true` | `return null` (Sidebar + page gate) — KHÔNG flash empty (pattern hiện có) |
| **Anonymous** | `isAuthenticated === false` | Logto redirect `/api/logto/sign-in` |
| **Authorized (admin)** | `isAdmin === true` | Render full UI (no change) |
| **Authorized (finance)** | `isFinance === true && isAdmin === false` | Render finance-allowed pages, sidebar filter ẩn admin-only items |
| **Authorized (staff)** | `isStaff === true && isFinance === false && isAdmin === false` | Render staff-allowed pages (contracts vẫn full), sidebar ẩn finance + admin items |
| **Forbidden — direct URL** | User has lower tier hit higher-tier page | `<RestrictedAccess message="..." />` (existing component) |
| **API 403** | Backend reject token tier insufficient | Toast đỏ với message VN từ `ForbiddenException` body |
| **Error fetch** | `/api/logto/user` fail | TanStack Query error state — existing AuthProvider handles (no new logic) |
| **Submitting** | N/A | (no mutation in scope) |
| **Success** | Login complete | Sidebar + page render |
| **Validation error** | N/A (no form) | — |
| **Confirm dialog** | N/A (no destructive action in scope) | — |

---

## 🛠️ Technical Mandates

### DB / Cache changes

- **MongoDB:** KHÔNG đụng.
- **MySQL platform:** KHÔNG đụng.
- **Redis:** KHÔNG đụng.
- **S3:** KHÔNG đụng.
- **Logto external config:** Danny setup dashboard theo BR-12 đến BR-15.
- **No migration script.**

### Backend Endpoint Specification

KHÔNG có endpoint mới. Feature này chỉ đổi `@UseGuards()` decorator trên 13 controller existing. Endpoint paths + DTOs + response shapes giữ NGUYÊN — backward compat 100%.

#### Spec đổi guard cho từng nhóm controller:

##### Nhóm 1 — Finance (8 controller) — đổi `LogtoAdminGuard` → `LogtoFinanceGuard`

| Element | Spec |
|---------|------|
| Files | `pnl.controller.ts`, `pnl-dashboard.controller.ts`, `pnl-contracts-list.controller.ts`, `pnl-export.controller.ts`, `cost-items.controller.ts`, `cost-suggestions.controller.ts`, `fee-breakdown.controller.ts`, `mysql-lookup.controller.ts` |
| Decoration before | `@UseGuards(LogtoAdminGuard)` class-level |
| Decoration after | `@UseGuards(LogtoFinanceGuard)` class-level |
| Import before | `import { LogtoAdminGuard } from '../../logto-auth';` |
| Import after | `import { LogtoFinanceGuard } from '../../logto-auth';` |
| Status codes (unchanged) | 200 success / 401 no auth / 403 insufficient (with VN message) / 500 server |
| Side effects (unchanged) | None (just guard change) |
| Smoke test post-deploy | Admin token vẫn 200 + Finance token mới (Hiền) trả 200 + Staff-only token trả 403 |

##### Nhóm 2 — Contracts (4 controller) — đổi `LogtoStaffGuard` → `LogtoStaffOrFinanceGuard`

| Element | Spec |
|---------|------|
| Files | `contracts.controller.ts`, `contract-templates.controller.ts`, `partners.controller.ts`, `service-catalog.controller.ts` |
| Decoration before | `@UseGuards(LogtoStaffGuard)` class-level |
| Decoration after | `@UseGuards(LogtoStaffOrFinanceGuard)` class-level |
| Status codes (unchanged) | 200/201/204 success / 401 / 403 / 409 dup / 500 |
| Side effects (unchanged) | Audit log emit + Redis cache invalidate (existing logic — không đụng) |
| Smoke test post-deploy | Staff token 200 (unchanged) + Finance token 200 (new) + Admin token 200 + Anonymous 401 |

##### Nhóm 3 — Invoice Reconcile (1 controller) — đổi `LogtoAdminGuard` → `LogtoFinanceGuard`

| Element | Spec |
|---------|------|
| File | `invoice-reconcile.controller.ts` |
| Decoration before | `@UseGuards(LogtoAdminGuard, ThrottlerGuard)` class-level |
| Decoration after | `@UseGuards(LogtoFinanceGuard, ThrottlerGuard)` class-level |
| Endpoints unchanged | `GET /today`, `POST /trigger`, `GET /health` |
| Throttler unchanged | `POST /trigger` 6/min/user |
| Smoke test post-deploy | BR-18 đầy đủ 6 step + BR-19 Telegram alert verify |

### Guard implementation — `LogtoFinanceGuard`

**File:** `backend/src/modules/logto-auth/logto-finance.guard.ts` (NEW)

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { LogtoAuthGuard } from './logto-auth.guard';

/**
 * F-078 — Internal Finance role guard.
 *
 * Verify Logto access token + REQUIRE permission tier finance hoặc admin.
 * Permission hierarchy: `finance < admin < all`. Admin tier tự động pass
 * (defense-in-depth — phòng trường hợp Danny quên tick permission `finance`
 * cho role admin ở Logto Dashboard).
 *
 * Hierarchy chi tiết:
 *   - finance (kế toán Hiền) — pass
 *   - admin (Danny) — pass (inheritance)
 *   - super_admin / all / admin:all — pass (super override)
 *   - staff (Tâm, Hằng) — FAIL với message VN
 *   - anonymous — FAIL 401
 *
 * Use cho 9 controller: 8 finance/controllers/* + 1 invoice-reconcile.
 *
 * Phân biệt với `LogtoAdminGuard`:
 *   - `LogtoAdminGuard`: chỉ admin/super_admin/all — KHÔNG finance pass
 *   - `LogtoFinanceGuard`: finance + admin/super_admin/all — staff FAIL
 *
 * KHÔNG dùng cho contracts (use LogtoStaffOrFinanceGuard — loosened policy).
 */
@Injectable()
export class LogtoFinanceGuard extends LogtoAuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const ok = await super.canActivate(ctx);
    if (!ok) return false;

    const req = ctx.switchToHttp().getRequest();
    const roles: string[] = req.logto?.roles ?? [];
    const scopes: string[] = req.logto?.scopes ?? [];

    const hasPermission =
      // Finance tier (BR-02 #1, #2)
      roles.includes('finance') ||
      scopes.includes('finance') ||
      // Admin inheritance (BR-02 #3, #4)
      roles.includes('admin') ||
      roles.includes('super_admin') ||
      scopes.includes('admin') ||
      scopes.includes('admin:all') ||
      scopes.includes('all');

    if (!hasPermission) {
      throw new ForbiddenException(
        'Module Tài chính / Hợp đồng / Đối soát hóa đơn chỉ dành cho nhân sự kế toán (role `finance`) hoặc admin. Liên hệ Danny để được cấp quyền role `finance` trên Logto Dashboard, sau đó đăng xuất + đăng nhập lại để refresh access token.',
      );
    }
    return true;
  }
}
```

### Guard implementation — `LogtoStaffOrFinanceGuard`

**File:** `backend/src/modules/logto-auth/logto-staff-or-finance.guard.ts` (NEW)

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { LogtoAuthGuard } from './logto-auth.guard';

/**
 * F-078 — Loosened guard cho module Hợp đồng (PAUSE-78-01 chốt).
 *
 * Chấp nhận: staff OR finance OR admin OR super_admin OR all.
 * Lý do: existing staff (Tâm, Hằng) đang dùng /contracts daily ops — KHÔNG
 * được mất quyền khi mở thêm role finance. Đây là loosened policy chứ không
 * thay thế Staff strictly.
 *
 * Use cho 4 controller: contracts/{contracts,contract-templates,partners,service-catalog}.
 *
 * Phân biệt:
 *   - `LogtoStaffGuard`: staff/admin/super_admin/all — KHÔNG finance pass
 *   - `LogtoStaffOrFinanceGuard`: staff/finance/admin/super_admin/all (union)
 */
@Injectable()
export class LogtoStaffOrFinanceGuard
  extends LogtoAuthGuard
  implements CanActivate
{
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const ok = await super.canActivate(ctx);
    if (!ok) return false;

    const req = ctx.switchToHttp().getRequest();
    const roles: string[] = req.logto?.roles ?? [];
    const scopes: string[] = req.logto?.scopes ?? [];

    const hasPermission =
      // Staff tier
      roles.includes('staff') ||
      scopes.includes('staff') ||
      // Finance tier
      roles.includes('finance') ||
      scopes.includes('finance') ||
      // Admin tier (inheritance)
      roles.includes('admin') ||
      roles.includes('super_admin') ||
      scopes.includes('admin') ||
      scopes.includes('admin:all') ||
      scopes.includes('all');

    if (!hasPermission) {
      throw new ForbiddenException(
        'Module Hợp đồng cần quyền staff, finance, hoặc admin. Liên hệ Danny để được cấp role phù hợp trên Logto Dashboard, sau đó đăng xuất + đăng nhập lại.',
      );
    }
    return true;
  }
}
```

### Pure helper — `permissions.helper.ts` extension

**Append vào file existing:**

```typescript
/**
 * F-078 — True if user has `finance` permission or higher (finance / admin /
 * super_admin / all). Staff DOES NOT pass — finance is parallel tier.
 *
 * Mirrors `LogtoFinanceGuard.canActivate` permission check verbatim.
 */
export function isFinanceOrAdmin(user: LogtoUser | undefined): boolean {
  if (!user) return false;
  const roles = user.roles ?? [];
  const scopes = user.scopes ?? [];
  return (
    roles.includes('finance') ||
    scopes.includes('finance') ||
    roles.includes('admin') ||
    roles.includes('super_admin') ||
    scopes.includes('admin') ||
    scopes.includes('admin:all') ||
    scopes.includes('all')
  );
}

/**
 * F-078 — True if user has `staff` permission, `finance` permission, or higher.
 * Loosened union for /contracts (BR-05).
 *
 * Mirrors `LogtoStaffOrFinanceGuard.canActivate` permission check verbatim.
 */
export function isStaffOrFinanceOrHigher(
  user: LogtoUser | undefined,
): boolean {
  if (!user) return false;
  return isStaffOrHigher(user) || isFinanceOrAdmin(user);
}
```

### Index export update — `logto-auth/index.ts`

**Append:**

```typescript
export { LogtoFinanceGuard } from './logto-finance.guard';
export { LogtoStaffOrFinanceGuard } from './logto-staff-or-finance.guard';
export {
  hasUser,
  isAdminOrHigher,
  isStaffOrHigher,
  isFinanceOrAdmin,            // NEW
  isStaffOrFinanceOrHigher,    // NEW
} from './permissions.helper';
```

### Frontend / Admin (Next.js)

#### 3.4.1 `auth-context.tsx` — add `isFinance` flag

**Existing pattern (line 44-48):**
```typescript
isAdmin: boolean;
isStaff: boolean;
```

**Updated pattern:**
```typescript
/** F-078 — True khi user là finance hoặc admin/super_admin. KHÔNG bao gồm staff-only. */
isFinance: boolean;
isAdmin: boolean;
isStaff: boolean;
```

**Logic update (line 95-98):**
```typescript
const isAdmin =
  hasScope("admin") || hasScope("all") || hasRole("admin") || hasRole("super_admin");
// F-078 — Finance tier: finance role/scope OR admin inheritance.
const isFinance =
  isAdmin || hasScope("finance") || hasRole("finance");
const isStaff =
  isAdmin || hasScope("staff") || hasRole("staff");
```

**Value object (line 109-131) — add `isFinance`:**
```typescript
const value: AuthContextType = {
  // ... existing ...
  isAdmin,
  isFinance,    // NEW
  isStaff,
};
```

#### 3.4.2 `nav-groups.ts` — widen `requireRole` type + mark finance items

**Existing (line 68):**
```typescript
requireRole?: "admin";
```

**Updated:**
```typescript
/**
 * RBAC gate — `"admin"` chỉ admin/super_admin xem, `"finance"` finance + admin xem.
 * Default undefined = staff trở lên xem được.
 */
requireRole?: "admin" | "finance";
```

**Item updates (3 items trong Tài chính group, BR-27):**
```typescript
// finance-pnl-dashboard, finance-pnl-contract, invoice-reconcile
requireRole: "finance"   // was "admin"
```

**Contracts items (BR-26) — giữ NGUYÊN không có `requireRole` (default visible cho staff trở lên).**

#### 3.4.3 `Sidebar.tsx` — filter logic update

**Existing (line 86-95):**
```typescript
const { isAdmin } = useAuth();
const visibleGroups = NAV_GROUPS.map((group) => ({
  ...group,
  items: group.items.filter(
    (item) => !item.requireRole || (item.requireRole === "admin" && isAdmin),
  ),
})).filter((g) => g.items.length > 0);
```

**Updated (BR-11):**
```typescript
const { isAdmin, isFinance } = useAuth();
const visibleGroups = NAV_GROUPS.map((group) => ({
  ...group,
  items: group.items.filter((item) => {
    if (!item.requireRole) return true;
    if (item.requireRole === "admin") return isAdmin;
    if (item.requireRole === "finance") return isFinance || isAdmin;
    return false;
  }),
})).filter((g) => g.items.length > 0);
```

#### 3.4.4 Page gate updates — 11 file

**Pattern cho 4 finance pages (BR-21) — old `if (!isAdmin)`:**
```typescript
const { isAdmin, isFinance, isLoading } = useAuth();
if (isLoading) return null;
if (!isAdmin && !isFinance) {
  return <RestrictedAccess message="Module Tài chính chỉ dành cho admin hoặc kế toán (role `finance`)." />;
}
```

**Pattern cho 7 contracts pages (BR-22) — old `if (!isStaff)`:**
```typescript
const { isStaff, isFinance, isLoading } = useAuth();
if (isLoading) return null;
if (!isStaff && !isFinance) {
  return <RestrictedAccess message="Module Hợp đồng cần quyền staff, finance, hoặc admin." />;
}
```

**Note:** Pattern `isAdmin || isFinance` cho finance pages; `isStaff || isFinance` cho contracts pages. Lý do: contracts loosened cho staff (BR-05), finance pages strict (BR-04).

#### 3.4.5 SDK regeneration

**KHÔNG cần.** Feature này không đổi DTO / endpoint shape / status code. Generated SDK không cần regenerate.

#### 3.4.6 Server Component vs Client Component

KHÔNG đổi component boundary. Tất cả page gate đã là `"use client"` (existing pattern). Backend guard server-side.

#### 3.4.7 TanStack Query

KHÔNG đổi query keys / staleTime / invalidation. Auth context query `["logto-user"]` đã có staleTime 30s — finance role mới populate qua claims không cần đổi.

#### 3.4.8 `revalidatePath` / `revalidateTag`

KHÔNG cần. Không có Server Action mới.

### PAUSE flags

- 🛑 **PAUSE-Coder-01** Trước khi mở PR → Coder phải confirm Danny đã setup XONG Logto Dashboard (BR-12 đến BR-15), CỤ THỂ:
  - Permission `finance` tồn tại trên resource "5BIB Result API"
  - Role `finance` tồn tại với permission `finance` assigned
  - Role `admin` đã assign thêm permission `finance` (inheritance)
  - Hiền đã assign role `finance`
  - Hiền đã sign-out + sign-in để refresh token
- 🛑 **PAUSE-Coder-02** Trước khi merge main → Coder phải verify smoke test BR-18 đầy đủ 6 step PASS + BR-19 Telegram verify. F-076 vừa golive sáng nay, regression race 220 = critical.
- 🛑 **PAUSE-Coder-03** KHÔNG được đụng `LogtoAdminGuard` / `LogtoStaffGuard` / `LogtoMerchantFinanceGuard` existing. Chỉ thêm guard mới.
- 🛑 **PAUSE-Coder-04** KHÔNG được đổi tên file controller existing hoặc rearrange import order (chỉ replace 1 dòng import + 1 dòng decorator per file).

---

## 🛡️ Testing Mandates

### 4.1 Backend Test Cases TC-XX (Coder viết unit + QC E2E)

#### TC-01 Happy path — Finance role pass `LogtoFinanceGuard`

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/invoice-reconcile/health` |
| Headers | `Authorization: Bearer <finance_token>` (token có `roles=['finance']` HOẶC `scopes=['finance']`) |
| Body | — |
| Expected status | 200 |
| Expected body shape | `{"healthy":true,"misa":{...},"telegram":{...},"redis":"connected","mysql":"connected"}` (existing ReconcileHealthDto) |
| MUST NOT leak | MISA password raw, Telegram bot token raw — phải masked như existing F-076 |
| Side effect verify | None (read-only endpoint) |

#### TC-02 Happy path — Admin role pass `LogtoFinanceGuard` (inheritance)

| Element | Value |
|---------|-------|
| Method | POST |
| URL | `/api/admin/invoice-reconcile/trigger` |
| Headers | `Authorization: Bearer <admin_token>` |
| Body | `{}` |
| Expected status | 200 OR 409 (lock-aware nếu đang scan) |
| Expected body shape | 200 → `{"triggered":true,"reportId":"...","timestamp":"<iso>"}`; 409 → `{"statusCode":409,"message":"..."}` |
| Side effect verify | Redis lock `master:cron-lock:invoice-reconcile` set hoặc fail nếu busy |

#### TC-03 Forbid — Staff-only role FAIL `LogtoFinanceGuard`

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/invoice-reconcile/today` |
| Headers | `Authorization: Bearer <staff_only_token>` (roles=['staff'], NO admin, NO finance) |
| Body | — |
| Expected status | 403 |
| Expected body shape | `{"statusCode":403,"message":"Module Tài chính / Hợp đồng / Đối soát hóa đơn chỉ dành cho nhân sự kế toán (role \`finance\`) hoặc admin. Liên hệ Danny..."}` (BR-06) |
| MUST NOT leak | Stack trace, internal token claims, MongoDB error detail |
| Side effect verify | None (rejected before service call) |

#### TC-04 Anonymous — No token FAIL guard

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/invoice-reconcile/health` |
| Headers | (no Authorization) |
| Body | — |
| Expected status | 401 |
| Expected body shape | `{"statusCode":401,"message":"Unauthorized"}` (existing LogtoAuthGuard behavior) |
| MUST NOT leak | Endpoint existence detail |

#### TC-05 Happy path — Staff role pass `LogtoStaffOrFinanceGuard` (contracts)

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/contracts` |
| Headers | `Authorization: Bearer <staff_only_token>` |
| Body | — |
| Expected status | 200 |
| Expected body shape | Existing contracts list response (no shape change) |
| Side effect verify | Existing logic — không đụng |

#### TC-06 Happy path — Finance role pass `LogtoStaffOrFinanceGuard` (contracts — NEW access)

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/contracts` |
| Headers | `Authorization: Bearer <finance_token>` |
| Body | — |
| Expected status | 200 |
| Expected body shape | Existing contracts list response |
| Side effect verify | None |

#### TC-07 Forbid — Anonymous staff-or-finance guard

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/contracts` |
| Headers | (no Authorization) |
| Body | — |
| Expected status | 401 |
| Expected body shape | `{"statusCode":401,"message":"Unauthorized"}` |

#### TC-08 Edge — Token có roles=['finance'] nhưng scopes=[] empty (role-based path)

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/finance/pnl/dashboard` |
| Headers | `Authorization: Bearer <token_roles_finance_only>` |
| Body | — |
| Expected status | 200 |
| Expected body shape | Existing P&L dashboard response |
| Verify | BR-16 dual-check: role-based path PASS even khi scope claim empty |

#### TC-09 Edge — Token có scopes=['finance'] nhưng roles=[] empty (scope-based path)

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/finance/pnl/dashboard` |
| Headers | `Authorization: Bearer <token_scopes_finance_only>` |
| Body | — |
| Expected status | 200 |
| Expected body shape | Existing P&L dashboard response |
| Verify | BR-16 dual-check: scope-based path PASS even khi role claim empty |

#### TC-10 Edge — Admin inheritance KHÔNG cần tick `finance` permission

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/finance/pnl/dashboard` |
| Headers | `Authorization: Bearer <admin_only_token>` (roles=['admin'], NO `finance` permission) |
| Body | — |
| Expected status | 200 |
| Expected body shape | Existing |
| Verify | BR-02 #3: admin tier inherit finance ngay cả khi Danny quên tick `finance` permission cho admin role trên Logto |

#### TC-11 Concurrent — 10x simultaneous request KHÔNG vỡ guard logic

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/invoice-reconcile/health` |
| Headers | 10 request concurrent với mix staff/finance/admin/anon tokens |
| Body | — |
| Expected | 10 finance/admin → 200; staff → 403; anon → 401. Zero unexpected status code. |
| Verify | Guard stateless, no race condition |

#### TC-12 — `isFinanceOrAdmin` helper unit test

| Element | Value |
|---------|-------|
| Method | Unit test (Jest) |
| Function | `isFinanceOrAdmin(user)` |
| Test inputs | undefined → false; {roles:[]} → false; {roles:['finance']} → true; {scopes:['finance']} → true; {roles:['admin']} → true; {scopes:['all']} → true; {roles:['staff']} → false; {roles:['super_admin']} → true |
| Expected | Match table per BR-02 + BR-17 verbatim |

#### Minimum coverage per controller — 7 case (per BA mandate):

- TC-01..04 áp dụng cho `LogtoFinanceGuard` (9 controller)
- TC-05..07 áp dụng cho `LogtoStaffOrFinanceGuard` (4 controller)
- TC-08..11 edge case Logto claim variation
- TC-12 helper unit test

**Total Backend: ~12 test case core + 9 controller × 4 case = thực chất Coder viết 1 spec file `logto-finance.guard.spec.ts` + 1 file `logto-staff-or-finance.guard.spec.ts` + extend `permissions.helper.spec.ts` cover toàn bộ. KHÔNG cần lặp lại per controller — guard logic centralized.**

### 4.2 Frontend E2E Test Cases (Playwright optional, Manual QC mandatory)

| TC | Persona | Journey | Steps | Expected |
|----|---------|---------|-------|----------|
| E2E-01 | Admin (Danny) | Smoke regression toàn bộ module | 1. Login Logto admin 2. Click 8 nav item Tài chính + Hợp đồng + MISA 3. Verify mỗi page render data | Toàn bộ render 200, zero regression |
| E2E-02 | Finance (Hiền) | Login lần đầu | 1. Logto sign-in 2. Sidebar render 3. Click "Tổng quan P&L" | Sidebar hiện: Vận hành (no admin items), Nội dung (no admin items), Hợp đồng (4 items), Tài chính (3 items), Hỗ trợ. P&L Dashboard load. |
| E2E-03 | Finance (Hiền) | Direct URL `/promo-hub` | 1. Login finance 2. Browser address `/promo-hub` | Sidebar item "Trang quảng bá" KHÔNG hiện, URL truy cập → page tự gate → `<RestrictedAccess />` OR API 403 toast |
| E2E-04 | Finance (Hiền) | Tạo cost_item | 1. /finance → Click cost-items 2. Tạo mới, fill form, submit | Toast success, list refresh, MongoDB ghi nhận `createdBy=hien_logto_sub` |
| E2E-05 | Finance (Hiền) | Trigger MISA reconcile manual | 1. /invoice-reconcile 2. Click button "Trigger now" | Toast loading → toast success/lock-aware. Telegram alert (nếu trigger thành công) verify nhận group. |
| E2E-06 | Staff (Tâm) | Regression contracts | 1. Login staff 2. Click "Danh sách hợp đồng" | Page load 200 (KHÔNG bị mất quyền) |
| E2E-07 | Staff (Tâm) | Sidebar visibility | 1. Login staff 2. Inspect sidebar | Tài chính group KHÔNG hiện (3 items đều `requireRole=finance`). Hợp đồng group VẪN hiện (no `requireRole` gate). |
| E2E-08 | Anonymous | Login flow | 1. Visit /finance | Redirect `/api/logto/sign-in` (existing LogtoAuthGuard) |
| E2E-09 | Finance (Hiền) | Sign-out + sign-in (token refresh) | 1. Logout 2. Login lại 3. Verify Sidebar mới | TanStack Query refetch `["logto-user"]`, sidebar mới populate đúng |
| E2E-10 | Finance + Admin parallel | 2 browser session đồng thời | Browser A admin, Browser B finance | Cả 2 session độc lập, không leak state |

### 4.3 Security Checks

- [ ] **SEC-01** — Direct API curl với staff-only token đến `/api/admin/finance/pnl/dashboard` → 403 + VN message chuẩn (KHÔNG generic "Forbidden")
- [ ] **SEC-02** — Direct API curl với staff-only token đến `/api/admin/invoice-reconcile/today` → 403
- [ ] **SEC-03** — Direct API curl với finance token đến `/api/admin/analytics/*` (admin-only F-026) → 403 (regression check — finance KHÔNG được leak vào admin-only)
- [ ] **SEC-04** — Direct API curl với finance token đến `/api/admin/merchant-portal/*` (admin-only) → 403
- [ ] **SEC-05** — Bypass UI test: Postman với admin token đến endpoint mới → 200 (admin inheritance verified)
- [ ] **SEC-06** — `<RestrictedAccess />` component render text VN không leak permission detail (KHÔNG hiển thị raw roles/scopes claim, KHÔNG hint module nội bộ structure)
- [ ] **SEC-07** — Token tampered (signature invalid) → 401 (existing LogtoAuthGuard verify)
- [ ] **SEC-08** — Response body của 403 KHÔNG chứa stack trace / internal error detail
- [ ] **SEC-09** — Audit log existing (per F-076 BR-13) tiếp tục emit cho action MISA trigger từ finance user (verify `actorId` populate correctly)
- [ ] **SEC-10** — Logto claim `custom_data` KHÔNG bị leak vào client response (Logto frontend chỉ thấy roles + scopes + sub + email)

### 4.4 Performance SLA

- Backend guard check overhead: **p95 < 5ms** (vì chỉ là array includes check trên 2-5 string element). Acceptable: <10ms p99.
- Frontend `useAuth()` cost: zero new query (existing TanStack Query staleTime 30s).
- Sidebar filter recompute: <1ms (NAV_GROUPS 5 groups × ~10 items, plain JS filter).
- Smoke test BR-18: toàn bộ 6 step PASS trong 5 phút.

### 4.5 10x Flaky Test (Concurrency)

- **TC-11 backend** đã cover.
- Frontend Sidebar filter render 100x liên tiếp → cùng kết quả (deterministic).

---

## 📌 Answers to Manager's PAUSE conditions (từ file 00)

> BA trả lời 8 PAUSE-78-* tại đây. Tất cả đều BA tự đề xuất, Danny final review ở `/5bib-plan`.

- **PAUSE-78-01 (CRITICAL): Staff hiện tại có ai đang truy cập /contracts/* không?**
  → **BA đề xuất YES (Tâm + Hằng đang dùng /contracts daily ops per F-029 BR-HD-30 + F-066/F-067 contract revamp evidence).** Giải pháp: Tạo guard mới `LogtoStaffOrFinanceGuard` (loosened policy) accept staff/finance/admin/super_admin/all cho 4 contracts controller. KHÔNG breaking existing staff (BR-05, BR-09, BR-24). Frontend contracts pages: gate `if (!isStaff && !isFinance)` (BR-22). Nav items contracts KHÔNG có `requireRole` (default visible cho staff trở lên, BR-26).

- **PAUSE-78-02: Inheritance `admin ⊃ finance` setup Logto-side hay Guard-side hay cả hai?**
  → **BA đề xuất CẢ HAI (Logto + Guard fallback) — defense-in-depth.** (BR-14 + BR-16). Logto-side: Danny tick permission `finance` cho role `admin`. Guard-side: `LogtoFinanceGuard` accept `roles.includes('admin') || scopes.includes('admin')` ngay cả khi Logto-side chưa tick. Lý do: Danny dễ quên dashboard setup, fallback code = robust.

- **PAUSE-78-03: Logto naming `finance` vs `accountant`? Permission granularity?**
  → **BA đề xuất `finance` (match merchant convention F-069 `merchant_finance`)** + permission name duy nhất `finance` (KHÔNG granular `finance:read`/`finance:write`). Lý do: (1) Hiền cần FULL CRUD theo scope chốt (BR-03 init), granular = thêm complexity không cần; (2) "finance" là từ tiếng Anh chuẩn dùng cho role kế toán quốc tế, "accountant" gây nhầm với chứng chỉ CPA. Nếu sau này cần read-only viewer thì mở `finance_viewer` role mới (Phase 2).

- **PAUSE-78-04: Finance có xem /reconciliations (Vận hành) không?**
  → **BA đề xuất KHÔNG.** /reconciliations là đối soát merchant invoice payment vendor (Stripe / VNPay), workflow Vận hành — không liên quan kế toán nội bộ 5BIB. Section "Vận hành" giữ nguyên không gate `requireRole=finance`. Hiền truy cập được nhưng chỉ ở mức staff-tier nav items (dashboard cơ bản + races list public read), KHÔNG có admin-only items như reconciliations gate.

  **Wait — verify:** /reconciliations hiện gate gì? Manager init nói "không có `requireRole` trong nav". Verify code thật: nav-groups.ts line 93 `{ id: "reconciliations", href: "/reconciliations", label: "Đối soát", icon: ReceiptText },` — KHÔNG có `requireRole`. Backend controller cần xác minh. → Coder phải grep `/api/admin/reconciliations` controller, nếu là `LogtoStaffGuard` thì finance user sẽ FAIL truy cập (vì finance KHÔNG implies staff). Đây là **acceptable per PAUSE-78-04 decision** — finance không cần xem reconciliations.

- **PAUSE-78-05: Landing page sau login?**
  → **BA đề xuất `/dashboard` (giữ nguyên existing flow).** Logto callback redirect default `/dashboard`. Dashboard hiện không gate `requireRole`, finance user vào được. Hiền có thể tự click "Tổng quan P&L" để vào /finance từ sidebar. KHÔNG cần custom landing logic cho finance role.

- **PAUSE-78-06: FULL CRUD bao gồm MISA trigger mutation?**
  → **BA đề xuất YES.** Kế toán cần manual trigger MISA scan khi nghi ngờ data lag hoặc giải mới mở bán cần xác minh ngay. `POST /api/admin/invoice-reconcile/trigger` (F-076) gated `LogtoFinanceGuard` cho phép finance + admin. Throttler 6/min/user vẫn protect (BR-23 nhóm 3).

- **PAUSE-78-07: Audit log `actorRole=finance` riêng?**
  → **BA đề xuất KHÔNG cần.** Audit log existing (per F-076 + F-064 actor attribution carry-forward) ghi `actorId` (Logto `sub` claim). Role/scope của actor trace được qua Logto admin dashboard với `sub` lookup. KHÔNG thêm field `actorRole` vào schema DB. Lý do: (1) Logto là source-of-truth cho role; (2) role có thể đổi (Hiền upgrade admin sau này) — store role lúc audit = stale; (3) avoid schema migration.

- **PAUSE-78-08: Env feature flag `RBAC_FINANCE_ROLE_ENABLED` rollback?**
  → **BA đề xuất KHÔNG cần.** Rollback strategy: `git revert` commit nếu PROD lỗi mass 403. Feature flag = thêm code path test matrix + maintenance burden. RBAC change là **single commit small surface area** (13 controller × 1 line decoration + 2 guard file + 1 helper extend + 1 frontend type widen + 1 sidebar filter + 11 page gate) — revert nhanh hơn flag toggle. Danny final review nếu muốn flag thì BA thêm `BR-20-FLAG-OPT-IN` Phase 2.

---

## ✅ Status

- [x] **READY** — sẵn sàng cho Manager review (`/5bib-plan`)

---

## 🔗 Next step

Danny chạy: `/5bib-plan FEATURE-078-finance-role-rbac`
