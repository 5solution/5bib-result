# FEATURE-078: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-06-09
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` (đầy đủ 8 PAUSE-78-* + 4 risk flag + impact map)
- [x] Đã đọc `01-ba-prd.md` đầy đủ (27 BR + 12 TC backend + 10 E2E + 10 SEC + 8 PAUSE answers)
- [x] Đã đọc memory: `codebase-map.md` (logto-auth module), `conventions.md` (Dual-check permission helpers section + Page-gate defense-in-depth pattern), `known-issues.md` (zero issue trên logto-auth)
- [x] Đã spot-check code thật 7 file then chốt (xem section "Spot-Check Results" dưới)

---

## 🔬 Spot-Check Code Thật (Manager 2026-05-17 mandate)

### File 1: `backend/src/modules/logto-auth/logto-merchant-finance.guard.ts` (F-069 pattern mẫu)
- [x] **Tồn tại** đúng path
- [x] Pattern `extends LogtoMerchantGuard implements CanActivate` + `super.canActivate(ctx)` → roles/scopes dual-check → throw `ForbiddenException` với VN message
- [x] PRD BR-02 + BR-16 dual-check pattern **MATCH verbatim** với guard này (chỉ đổi từ extending LogtoMerchantGuard → LogtoAuthGuard cho internal role)
- ✅ **Verdict:** Pattern chuẩn, Coder clone an toàn.

### File 2: `backend/src/modules/logto-auth/logto-admin.guard.ts`
- [x] **Tồn tại** đúng path
- [x] Check `roles.includes('admin') || roles.includes('super_admin') || scopes.includes('admin') || scopes.includes('admin:all') || scopes.includes('all')`
- [x] PRD BR-02 #3-#4 admin inheritance **MATCH verbatim**
- ✅ **Verdict:** Source-of-truth cho admin tier, PRD encode đúng.

### File 3: `backend/src/modules/logto-auth/logto-staff.guard.ts`
- [x] **Tồn tại** đúng path
- [x] Check union: staff + admin + super_admin + all (dual roles+scopes)
- [x] PRD BR-05 + BR-24 + `LogtoStaffOrFinanceGuard` clone pattern **MATCH** (chỉ thêm finance union)
- ✅ **Verdict:** Pattern reuse chuẩn cho loosened policy contracts.

### File 4: `backend/src/modules/logto-auth/permissions.helper.ts`
- [x] **Tồn tại** đúng path, exports `hasUser`, `isAdminOrHigher`, `isStaffOrHigher`
- [x] PRD section 3 thêm `isFinanceOrAdmin` + `isStaffOrFinanceOrHigher` — naming convention **CONSISTENT** với existing pattern
- [x] Convention: "DUAL CHECK pattern — mirrors guard verbatim" — PRD helper mirror đúng guard mới
- ✅ **Verdict:** Helper extend đúng convention F-029.

### File 5: `backend/src/modules/logto-auth/logto-auth.module.ts`
- [x] **Tồn tại** đúng path
- [x] Providers list register tất cả guards (LogtoAuthGuard, LogtoAdminGuard, LogtoStaffGuard, LogtoMerchantGuard, LogtoMerchantFinanceGuard, OptionalLogtoAuthGuard)
- ⚠️ **PRD GAP MINOR:** PRD section 3 KHÔNG explicit nhắc Coder phải register 2 guard mới vào `LogtoAuthModule.providers` + `exports`. Existing pattern bắt buộc đăng ký để DI inject `LogtoService` vào guard parent. → **Manager bổ sung Scope Lock + PAUSE-Coder-05** ở dưới.
- ✅ **Verdict:** Không breaking, chỉ là omission nhỏ Coder dễ miss.

### File 6: `admin/src/lib/auth-context.tsx`
- [x] **Tồn tại** đúng path
- [x] Existing pattern (line 95-98): `isAdmin = hasScope/hasRole`; `isStaff = isAdmin || hasScope('staff') || hasRole('staff')` — inheritance đúng
- [x] PRD section 3.4.1 thêm `isFinance = isAdmin || hasScope('finance') || hasRole('finance')` **CONSISTENT** với pattern existing
- ✅ **Verdict:** Code shape khớp, type safety chuẩn.

### File 7: `admin/src/lib/nav-groups.ts` + `admin/src/components/admin-shell/Sidebar.tsx`
- [x] **nav-groups.ts** line 68 `requireRole?: "admin"` — type union widen sang `"admin" | "finance"` không break TypeScript (kiểm tra: chỉ 1 consumer trong codebase = `Sidebar.tsx` line 93)
- [x] **Sidebar.tsx** line 86-95 filter logic — PRD section 3.4.3 update khớp pattern hiện tại, chỉ thêm 1 branch `requireRole === "finance"`
- [x] Tài chính group line 139-166 hiện 3 items đều `requireRole: "admin"` — PRD BR-27 đổi `"finance"` đúng list (finance-pnl-dashboard, finance-pnl-contract, invoice-reconcile)
- [x] Hợp đồng group line 130-137 hiện 4 items KHÔNG có `requireRole` — PRD BR-26 giữ NGUYÊN — quyết định đúng (loosened policy staff vẫn thấy nav)
- ✅ **Verdict:** Type widening + filter logic + nav annotation đều chuẩn xác.

### Verified counts (grep PROD):
- Backend controller dùng LogtoAdminGuard/StaffGuard trong 3 module mục tiêu: **13** ✓ (8 finance + 4 contracts + 1 invoice-reconcile — khớp BR-23 + BR-24 + BR-25)
- Frontend page gate `isAdmin`/`isStaff`: **11** ✓ (4 finance gate + 7 contracts gate — khớp BR-21 + BR-22)
- Zero pre-existing collision với `LogtoFinanceGuard` / `isFinanceOrAdmin` / `isStaffOrFinance` (grep clean)

---

## ✓ PRD Validation Checklist

### Completeness
- [x] User Stories đầy đủ 8 (US-01 → US-08) với 4 personas đúng (Hiền finance / Danny admin / Tâm staff / Auditor)
- [x] Business Rules có ID đầy đủ BR-01 → BR-27 testable
- [x] Tất cả 8 PAUSE-78-* của Manager đã được BA trả lời cụ thể với justification
- [x] UI states đầy đủ 11 state (Loading / Anonymous / Authorized admin/finance/staff / Forbidden direct URL / API 403 / Error fetch / Submitting / Success / Validation error / Confirm dialog) — feature không có form nên một số state N/A là acceptable
- [x] Step-by-step numbered table sidebar journey có 7 step
- [x] Buttons spec table có 4 button
- [x] Access control matrix 5 row × 4 column rõ ràng

### Technical correctness vs codebase
- [x] DB change phù hợp — **ZERO** schema change, ZERO migration
- [x] Endpoint design giữ NGUYÊN — backward compat 100%, không break SDK
- [x] Cache key pattern — không đụng Redis keys
- [x] Named connection `'platform'` — không đụng MySQL
- [x] Generated SDK refresh — BR section 3.4.5 explicit "KHÔNG cần regenerate" (đúng vì DTO/endpoint không đổi)
- [x] Pattern reuse F-069 `LogtoMerchantFinanceGuard` + F-029 dual-check helper — CONSISTENT

### Security
- [x] Backend guard mới `LogtoFinanceGuard` + `LogtoStaffOrFinanceGuard` đều extends `LogtoAuthGuard` → JWT verify trước, role check sau (defense-in-depth chuẩn)
- [x] IDOR check — N/A (feature không thay đổi data scope, chỉ thay đổi access gate)
- [x] Role check inheritance `admin ⊃ finance` dual-layer (Logto BR-14 + Guard BR-02 #3-#4 fallback)
- [x] Sensitive field không leak — N/A (không đổi response shape)
- [x] 10 security check (SEC-01 → SEC-10) cover: direct API curl với staff token + finance token attempt admin-only endpoint + bypass UI Postman + token tampered + 403 response không leak stack + audit log + Logto custom_data privacy

### Performance
- [x] SLA cụ thể: guard p95 < 5ms (chỉ array includes, defensible số)
- [x] Frontend zero new query (existing TanStack staleTime 30s)
- [x] Sidebar filter recompute < 1ms

### Testability
- [x] 12 TC backend với 8 element bắt buộc (Method/URL/Headers/Body/Expected status/Expected body shape/MUST NOT leak/Side effect verify)
- [x] 10 E2E case 4 persona walkthrough
- [x] Concurrency test TC-11 10x mix-token PASS
- [x] Helper unit test TC-12 covered

### F-076 smoke test (CRITICAL — vừa golive sáng nay)
- [x] BR-18 6 step smoke test EXPLICIT trong PRD (health + today + trigger với 3 token tier + cron verify)
- [x] BR-19 Telegram alert verify
- [x] PAUSE-Coder-02 wait smoke test PASS trước khi merge main

---

## 📊 Cross-check với memory

### Architecture impact
- KHÔNG thêm node mới vào `architecture.md`. Guard mới ngồi trong existing `LogtoAuthModule`. Data flow Logto → guard verify token → controller giữ nguyên.
- **Architecture update post-deploy:** `architecture.md` Security Boundaries section thêm tier `finance` giữa staff và admin (nhỏ, post-deploy).

### Convention impact
- Pattern `LogtoFinanceGuard extends LogtoAuthGuard` (KHÔNG extends LogtoAdminGuard/StaffGuard) — Manager confirm đúng. Lý do: finance là tier song song staff, không subset; extending LogtoAuthGuard cho phép tự define union mới mà không nested super.canActivate phức tạp.
- Pattern `LogtoStaffOrFinanceGuard` (loosened union) — pattern mới chưa có trong conventions.md, Manager sẽ thêm section "Loosened union guard pattern" vào conventions.md ở `/5bib-deploy`.

### Known issues impact
- Zero known issue trong logto-auth. Feature này KHÔNG resolve issue cũ, KHÔNG tạo issue mới (hy vọng).

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ được thay đổi các file/folder dưới đây. Đụng ngoài = scope creep, PAUSE confirm Manager.

### Backend (17 file)

**Guards mới (2):**
- ➕ `backend/src/modules/logto-auth/logto-finance.guard.ts` (new file)
- ➕ `backend/src/modules/logto-auth/logto-staff-or-finance.guard.ts` (new file)

**Helper extend (1):**
- ✏️ `backend/src/modules/logto-auth/permissions.helper.ts` (append `isFinanceOrAdmin` + `isStaffOrFinanceOrHigher`)

**Index export (1):**
- ✏️ `backend/src/modules/logto-auth/index.ts` (export 2 guard + 2 helper)

**Module wiring (1) — Manager bổ sung từ spot-check:**
- ✏️ `backend/src/modules/logto-auth/logto-auth.module.ts` (register 2 guard mới vào `providers` + `exports` — DI requirement)

**Controller đổi guard (13):**

Finance (8 — `LogtoAdminGuard` → `LogtoFinanceGuard`):
- ✏️ `backend/src/modules/finance/controllers/pnl.controller.ts`
- ✏️ `backend/src/modules/finance/controllers/pnl-dashboard.controller.ts`
- ✏️ `backend/src/modules/finance/controllers/pnl-contracts-list.controller.ts`
- ✏️ `backend/src/modules/finance/controllers/pnl-export.controller.ts`
- ✏️ `backend/src/modules/finance/controllers/cost-items.controller.ts`
- ✏️ `backend/src/modules/finance/controllers/cost-suggestions.controller.ts`
- ✏️ `backend/src/modules/finance/controllers/fee-breakdown.controller.ts`
- ✏️ `backend/src/modules/finance/controllers/mysql-lookup.controller.ts`

Contracts (4 — `LogtoStaffGuard` → `LogtoStaffOrFinanceGuard`):
- ✏️ `backend/src/modules/contracts/contracts.controller.ts`
- ✏️ `backend/src/modules/contracts/contract-templates.controller.ts`
- ✏️ `backend/src/modules/contracts/partners.controller.ts`
- ✏️ `backend/src/modules/contracts/service-catalog.controller.ts`

Invoice Reconcile (1 — `LogtoAdminGuard` → `LogtoFinanceGuard`):
- ✏️ `backend/src/modules/invoice-reconcile/invoice-reconcile.controller.ts`

**Backend test (2-3):**
- ➕ `backend/src/modules/logto-auth/logto-finance.guard.spec.ts` (new — TC-01..04 + TC-08..10)
- ➕ `backend/src/modules/logto-auth/logto-staff-or-finance.guard.spec.ts` (new — TC-05..07)
- ✏️ `backend/src/modules/logto-auth/permissions.helper.spec.ts` (extend — TC-12)

### Frontend (14 file)

**Core auth (3):**
- ✏️ `admin/src/lib/auth-context.tsx` (add `isFinance` flag)
- ✏️ `admin/src/lib/nav-groups.ts` (widen `requireRole` type + đổi 3 finance items từ `"admin"` → `"finance"`)
- ✏️ `admin/src/components/admin-shell/Sidebar.tsx` (filter logic add finance branch)

**Page gates Finance (4):**
- ✏️ `admin/src/app/(dashboard)/finance/page.tsx`
- ✏️ `admin/src/app/(dashboard)/finance/contracts/page.tsx`
- ✏️ `admin/src/app/(dashboard)/finance/contracts/[id]/page.tsx`
- ✏️ `admin/src/app/(dashboard)/invoice-reconcile/page.tsx`

**Page gates Contracts (7):**
- ✏️ `admin/src/app/(dashboard)/contracts/page.tsx`
- ✏️ `admin/src/app/(dashboard)/contracts/[id]/page.tsx`
- ✏️ `admin/src/app/(dashboard)/contracts/create/page.tsx`
- ✏️ `admin/src/app/(dashboard)/contracts/services/page.tsx`
- ✏️ `admin/src/app/(dashboard)/contracts/templates/page.tsx`
- ✏️ `admin/src/app/(dashboard)/contracts/partners/page.tsx`
- ✏️ `admin/src/app/(dashboard)/contracts/partners/[id]/page.tsx`

### Documentation (1, optional)
- ✏️ `docs/conventions.md` — append section "Internal RBAC tier — Finance role" (Coder optional, Manager sẽ append ở `/5bib-deploy` nếu Coder skip)

**TOTAL: 32 file (17 backend + 14 frontend + 1 docs optional). Manager final count.**

---

## 🔧 Tech approach (Coder có thể tinh chỉnh)

- **Guard implementation:** Clone pattern F-069 `LogtoMerchantFinanceGuard` verbatim, đổi extends `LogtoAuthGuard` (KHÔNG extends LogtoAdminGuard/StaffGuard) + tự define union role check (BR-02 + BR-16 dual-check).
- **Module registration:** Add 2 guard mới vào `LogtoAuthModule.providers` + `exports` (mirror pattern existing).
- **Index export:** Append 2 export statement vào `logto-auth/index.ts`.
- **Controller changes:** Mỗi controller chỉ thay đổi 1 dòng import + 1 dòng decorator. KHÔNG rearrange import order khác (PAUSE-Coder-04 BA).
- **Frontend filter logic:** Sidebar.tsx ternary chain `requireRole === "admin" ? isAdmin : requireRole === "finance" ? (isFinance || isAdmin) : true` — clean readable.
- **Page gate refactor:** Mechanical change `if (!isAdmin) → if (!isAdmin && !isFinance)` cho 4 finance pages; `if (!isStaff) → if (!isStaff && !isFinance)` cho 7 contracts pages. **Caveat:** `isFinance` đã inherit từ `isAdmin` (auth-context BR-07) → biểu thức `!isAdmin && !isFinance` equivalent với `!isFinance` cho 4 finance pages. Coder dùng form ngắn `!isFinance` cho concise, OR giữ explicit `!isAdmin && !isFinance` cho readability. **Manager đề xuất EXPLICIT** để new dev đọc hiểu intent ngay không phải trace hierarchy.

---

## 🛑 PAUSE points cho Coder

> Coder DỪNG lại confirm Danny TRƯỚC khi thực hiện các bước sau.

- 🛑 **PAUSE-Coder-01 (CRITICAL):** Wait Danny confirm Logto Dashboard setup XONG ĐẦY ĐỦ (BR-12 → BR-15):
  - Permission `finance` tồn tại trên resource `5BIB Result API`
  - Role `finance` tồn tại + assign permission `finance`
  - Role `admin` đã tick thêm permission `finance` (inheritance)
  - Hiền đã assign role `finance` + sign-out + sign-in lại
  - Verify token claims qua jwt.io decode: `scope` chứa `"finance"`
- 🛑 **PAUSE-Coder-02 (CRITICAL):** TRƯỚC khi merge main → smoke test F-076 invoice-reconcile per BR-18 đủ 6 step + BR-19 Telegram alert verify. F-076 golive sáng nay 2026-06-09, race 220 đang bán vé, regression = block.
- 🛑 **PAUSE-Coder-03:** KHÔNG đụng existing guards (`LogtoAdminGuard`, `LogtoStaffGuard`, `LogtoMerchantFinanceGuard`). Chỉ thêm 2 file guard mới.
- 🛑 **PAUSE-Coder-04:** Mỗi controller chỉ thay đổi 1 dòng import + 1 dòng decorator. KHÔNG rearrange import order hay touch logic.
- 🛑 **PAUSE-Coder-05 (Manager bổ sung từ spot-check):** PHẢI register 2 guard mới vào `LogtoAuthModule.providers` + `exports`. KHÔNG quên — guard không register sẽ ném DI error runtime khi controller dùng `@UseGuards()`.
- 🛑 **PAUSE-Coder-06:** Nếu phát hiện cần đụng file ngoài Scope Lock 32 file → DỪNG hỏi Manager. Không tự "fix incidental issues".
- 🛑 **PAUSE-Coder-07:** SDK regen — PRD BR-3.4.5 nói KHÔNG cần. Coder confirm bằng cách KHÔNG chạy `pnpm generate:api`. Nếu Coder thấy cần thì PAUSE hỏi (signal có schema drift Coder phát hiện).

---

## 🧪 Unit test BẮT BUỘC

Coder không được mark `READY_FOR_QC` nếu thiếu các test sau:

### `logto-finance.guard.spec.ts` (new file — TC-01..04 + TC-08..10)
- [ ] **TC-01** — Finance role/scope token → PASS (200)
- [ ] **TC-02** — Admin role token (inheritance) → PASS (200)
- [ ] **TC-03** — Staff-only token → 403 với VN message chuẩn (BR-06)
- [ ] **TC-04** — Anonymous token → 401 (via super LogtoAuthGuard)
- [ ] **TC-08** — Token roles=['finance'] scopes=[] empty → PASS (role-based dual-check)
- [ ] **TC-09** — Token scopes=['finance'] roles=[] empty → PASS (scope-based dual-check)
- [ ] **TC-10** — Admin token KHÔNG tick `finance` permission → PASS (inheritance fallback BR-02 #3-#4)

### `logto-staff-or-finance.guard.spec.ts` (new file — TC-05..07)
- [ ] **TC-05** — Staff token → PASS (existing không regress)
- [ ] **TC-06** — Finance token → PASS (NEW access)
- [ ] **TC-07** — Anonymous → 401

### `permissions.helper.spec.ts` (extend — TC-12)
- [ ] **TC-12** — `isFinanceOrAdmin(user)` truth table 8 case (undefined, empty, finance role, finance scope, admin role, all scope, staff role, super_admin role) match BR-17
- [ ] Extend: `isStaffOrFinanceOrHigher(user)` truth table mirror BR-05

### Concurrent stability
- [ ] **TC-11** — 10x mix-token concurrent request → expected status correct (zero race condition guard logic)

**Mỗi test PHẢI có `describe` group rõ ràng + assertion cụ thể (KHÔNG chỉ `expect(result).toBeDefined()`).**

---

## 📊 Verdict

> ### ✅ APPROVED — Coder có thể bắt đầu

PRD đầy đủ, BR testable, scope rõ, pattern reuse đúng (F-069 + F-029). 8 PAUSE-78-* answered cụ thể với justification. Spot-check 7 file then chốt PASS clean. 1 GAP MINOR (module registration) đã bổ sung vào PAUSE-Coder-05 + Scope Lock.

**Risk residual:** F-076 invoice-reconcile vừa golive (mai bán vé race 220). PAUSE-Coder-02 smoke test 6 step BR-18 + Telegram BR-19 = mandatory pre-merge.

**No PRD revision needed.** Coder skip thẳng sang `/5bib-code`.

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] **Yes** — Coder có thể bắt đầu code theo Scope Lock 32 file + 7 PAUSE points + 11 unit test mandate.

---

## 🔗 Next step

Danny chạy: `/5bib-code FEATURE-078-finance-role-rbac`
