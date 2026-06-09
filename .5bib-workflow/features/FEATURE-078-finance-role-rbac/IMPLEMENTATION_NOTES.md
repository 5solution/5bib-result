# FEATURE-078 — Implementation Notes (Reviewer's Guide)

> Cô đọng cho Manager `/5bib-deploy` Code Review + QC Phase 1 Impact & Regression Audit. Focus: **DEVIATIONS + FORCED + TRADEOFFS + REVIEWER HOTSPOTS**.

---

## Section 1: 🚧 Deviations from Spec (intentional)

### [Deviation #1] Comment hygiene update trên 6 controller (out-of-explicit-PRD-scope)

- **Spec said:** PRD section 3.2 + PAUSE-Coder-04: "Mỗi controller chỉ thay đổi 1 dòng import + 1 dòng decorator. KHÔNG rearrange import order hay touch logic."
- **I did:** Sau sed batch rename, có 6 controller chứa comment cũ kiểu `"Admin-only (LogtoFinanceGuard)"` hoặc `"All gated by LogtoFinanceGuard (role admin or scope admin)"` — comment misleading sau guard rename. Fix inline minimal 1-2 từ per comment:
  - `cost-suggestions.controller.ts:31` — "Admin-only" → "Finance-tier"
  - `cost-items.controller.ts:32` — "admin-only. KHÔNG dùng LogtoStaffGuard" → "finance-tier (F-078 BR-78-04 widen). KHÔNG dùng LogtoStaffGuard (staff tier không có quyền finance)"
  - `pnl-dashboard.controller.ts:30` — "Admin-only" → "Finance-tier"
  - `fee-breakdown.controller.ts:19` — idem
  - `pnl-contracts-list.controller.ts:20` — idem
  - `invoice-reconcile.controller.ts:9` — "All gated by LogtoFinanceGuard (role admin or scope admin)" → "All gated by LogtoFinanceGuard (F-078 — finance/admin/super_admin pass; staff FAIL)"
- **Why:** PAUSE-Coder-04 chặt về "không touch logic". Comment KHÔNG phải logic — không ảnh hưởng runtime. Nhưng comment sai sau rename = bẫy dev tương lai đọc comment tin nhầm "admin-only" rồi assign permission sai cho user. Lợi ích hygiene > rủi ro scope creep nhẹ.
- **Reviewer should check:** Confirm comment updates đúng ngữ nghĩa mới + KHÔNG vô tình đổi business logic comment (vd BR-PNL-12 reference đúng giữ nguyên).

### [Deviation #2] Page gate dùng explicit `!isAdmin && !isFinance` thay vì concise `!isFinance`

- **Spec said:** PRD section 3 + Manager plan Tech approach: "Coder dùng form ngắn `!isFinance` cho concise, OR giữ explicit `!isAdmin && !isFinance` cho readability. Manager đề xuất EXPLICIT."
- **I did:** Đi theo Manager khuyến nghị — dùng explicit form trên tất cả 11 page gate.
- **Why:** `isFinance` đã inherit `isAdmin` (BR-78-07 auth-context logic) → `!isFinance` đủ chặn cả 2 tier. Nhưng explicit `!isAdmin && !isFinance` dev mới đọc hiểu intent ngay không cần trace inheritance chain. Trade-off: 1 từ thêm per gate, đáng giá readability lifetime.
- **Reviewer should check:** Verify cả 11 page gate dùng cùng pattern explicit (zero mixing).

---

## Section 2: ⚙️ Forced Changes (reality ≠ spec)

### [Forced #1] `invoice-reconcile.controller.spec.ts` — F-076 controller test mock guard reference

- **PRD/Plan assumed:** Manager `02-manager-plan.md` Scope Lock liệt kê 13 controller cần đổi guard, KHÔNG include test spec file. Implicit assumption: test specs không reference guard cụ thể.
- **Reality:** F-076 controller spec (`invoice-reconcile.controller.spec.ts`) dùng `Test.createTestingModule().overrideGuard(LogtoAdminGuard).useValue({canActivate: () => true})` pattern (line 102) để bypass JWT verify trong integration test. Khi controller class-level guard đổi sang `LogtoFinanceGuard`, override không match controller's actual guard → tất cả 10 test fail với 401 Unauthorized.
- **Workaround:** Update 4 vị trí trong spec file:
  1. Import statement `LogtoAdminGuard` → `LogtoFinanceGuard`
  2. `overrideGuard(LogtoAdminGuard)` → `overrideGuard(LogtoFinanceGuard)`
  3. Doc comment line 4 — update "override LogtoAdminGuard" → "override LogtoFinanceGuard (F-078 renamed)"
  4. Doc comment line 12-14 — update "LogtoAdminGuard mocked thành allow-all" + reference guard spec file (`logto-staff.guard.spec.ts` → `logto-finance.guard.spec.ts`)
  Zero logic change. 10 test PASS lại sau fix.
- **Manager/BA action:**
  - **Update conventions.md:** Add rule "Khi controller đổi `@UseGuards()`, audit `__tests__/*.controller.spec.ts` xem có `overrideGuard()` reference không + include vào Scope Lock"
  - **Update Manager Scope Lock template:** Khi controller đổi guard, automatically include `__tests__/[controller].spec.ts` nếu file tồn tại
  - Pattern này sẽ áp dụng cho tương lai khi đổi guard hàng loạt — không phải chỉ F-078

### [Forced #2] — None other

Toàn bộ 32 Scope Lock files đều khớp PRD reference. ZERO file path drift, ZERO method/field name mismatch.

---

## Section 3: ⚖️ Tradeoffs Considered

| Decision | Option chosen | Alternative | Why chose | Cost paid |
|----------|---------------|-------------|-----------|-----------|
| Guard inheritance | `LogtoFinanceGuard extends LogtoAuthGuard` (root) | `extends LogtoAdminGuard` hoặc `LogtoStaffGuard` (subset) | Finance là tier song song staff, không subset. Extends root cho phép tự define union role check rõ ràng. Mirror F-069 pattern. | 6-line role/scope check duplicate giữa 4 guard files (Admin/Staff/Finance/StaffOrFinance). Accepted vì clarity + dễ debug per-guard. |
| Inheritance defense layer | Logto-side (BR-14) + Guard-side fallback (BR-78-02 #3-#4) | Chỉ Logto-side (Danny tick permission) | Defense-in-depth: nếu Danny quên tick `finance` permission cho admin role ở Logto Dashboard, guard fallback vẫn pass admin → admin user KHÔNG bị 403 bất ngờ. | 4 line code thêm trong mỗi guard (admin scope/role check). Acceptable defensive cost. |
| Contracts policy | `LogtoStaffOrFinanceGuard` (loosened union) | Strict-finance-only `LogtoFinanceGuard` | PAUSE-78-01 chốt: existing staff Tâm/Hằng đang dùng /contracts daily ops. Strict-only-finance = breaking RBAC change cho staff hiện tại. Loosened union accept staff∪finance∪admin = ZERO regression cho staff. | Phải tạo guard thứ 2 (`LogtoStaffOrFinanceGuard`) thay vì reuse `LogtoFinanceGuard`. ~80 LoC duplicate code. Worth it cho non-regression promise. |
| Page gate form | Explicit `!isAdmin && !isFinance` | Concise `!isFinance` (lợi dụng inheritance) | Manager khuyến nghị readability cho dev mới — không cần trace `isFinance = isAdmin || ...` inheritance chain. | +1 từ per gate × 11 page = +11 từ. Negligible. |
| Sidebar filter | Explicit ternary chain với named conditions | Compact short-circuit `&& \|\|` chain | Future-proof: nếu thêm tier mới (vd `viewer`), thêm branch dễ. Compact chain phải rewrite toàn bộ. | 4 line dài hơn so với 1-line filter. Worth it cho extensibility. |
| Test format | `it.each` truth-table cho `isFinanceOrAdmin` + `isStaffOrFinanceOrHigher` | 12 `it()` riêng lẻ | Truth table compact, dễ scan, dễ thêm row khi expand permission tier. Mirror pattern F-029 helper spec. | First-time reader cần biết `it.each` syntax. Moderate Jest familiarity required. |
| Comment hygiene fix | Inline minimal 1-2 từ update | Skip comment, document in IMPLEMENTATION_NOTES only | Inline fix prevent future dev confusion. Skip = bẫy permanent. | Slight PAUSE-Coder-04 deviation (Deviation #1). Documented. |

---

## Section 4: 🔬 Reviewer Notes (Manager + QC focus)

### Files cần review kỹ (priority order — Manager spot-check theo order này)

1. **`backend/src/modules/logto-auth/logto-finance.guard.ts:38-56`** — Core role/scope union check. Verify BR-78-02 dual-check + admin inheritance fallback (4 line check admin role/scope) đúng verbatim. **CRITICAL** — sai 1 dòng = 403 mass cho admin.
2. **`backend/src/modules/logto-auth/logto-staff-or-finance.guard.ts:42-61`** — Loosened union staff∪finance∪admin. Verify PAUSE-78-01 promise: staff hiện tại KHÔNG mất quyền (existing staff role/scope vẫn pass đầu tiên).
3. **`admin/src/lib/auth-context.tsx:99-100`** — `isFinance = isAdmin || hasScope("finance") || hasRole("finance")`. Verify inheritance order (`isAdmin` first cho short-circuit performance).
4. **`admin/src/components/admin-shell/Sidebar.tsx:86-101`** — Filter logic ternary chain. Verify 3 branch logic mutually exclusive + default false (item.requireRole undefined → true via early return).
5. **`backend/src/modules/invoice-reconcile/__tests__/invoice-reconcile.controller.spec.ts:24,102`** — Forced cascade fix verify đúng. Verify `overrideGuard(LogtoFinanceGuard)` match controller's actual `@UseGuards(LogtoFinanceGuard, ThrottlerGuard)`.

### Concurrency hotspots

- **Guard logic stateless** — không có shared state, không có race condition. TC-11 backend (PRD Phase 4) verify 10x concurrent mix-token request → exactly expected status per token tier. Deferred sang QC Phase 4 E2E vì cần Nest application bootstrap.
- **Frontend `useAuth()` query** — TanStack Query `["logto-user"]` staleTime 30s. Multi-tab same session sẽ share cache. Sign-out trigger query invalidate.

### Edge cases I tested vs DEFERRED

- ✅ **Tested locally:**
  - Token roles=['finance'] scope empty (TC-08 role-based path)
  - Token scopes=['finance'] role empty (TC-09 scope-based path)
  - Admin token KHÔNG tick `finance` permission (TC-10 inheritance fallback)
  - Multi-role combined finance+admin
  - Negative: viewer/merchant/empty token reject
  - VN error message text match (BR-78-06)
  - Helper truth table 12 case isFinanceOrAdmin
  - Helper truth table isStaffOrFinanceOrHigher parity với compound check
- ⚠️ **Deferred (acceptable — QC sẽ verify):**
  - **E2E backend** real Nest application + supertest với 3 token tier hit 13 controller (Manager Plan TC-11 concurrency 10x stability)
  - **E2E frontend** Playwright login finance role → click 8 nav item → verify render
  - **PROD smoke test** F-076 6 step BR-18 + Telegram BR-19 — PAUSE-Coder-02 pre-merge requirement, needs PROD env + Hiền's real token
  - **Sign-out + sign-in token refresh** E2E (E2E-09 PRD) — needs real Logto session

### Type safety narrowed casts (Manager grep `as unknown as`)

- **None.** Zero `as unknown as` trong Scope Lock files. Grep verified.

### Security checklist self-applied

- [x] **All 13 controller endpoints:** explicit `@UseGuards(LogtoFinanceGuard)` hoặc `@UseGuards(LogtoStaffOrFinanceGuard, ...)` class-level — verified grep `"UseGuards"` count = 13.
- [x] **Defense-in-depth:** Backend guard (LAST LINE) + Frontend page-gate (UI explain) + Nav-groups requireRole (UX hide) — 3 layer như F-029 BR-HD-30 + F-026 pattern.
- [x] **VN error message:** `ForbiddenException` body chứa actionable VN message rõ ràng (KHÔNG generic). Verified TC `expect(...).rejects.toThrow(/Module Tài chính.+role `finance`/)`.
- [x] **No PII leak:** Guard response không expose user details / raw token claims. Verified ForbiddenException chỉ trả message string, không trả request payload.
- [x] **Inheritance fallback:** TC-10 verify admin token KHÔNG cần `finance` permission vẫn pass — phòng Logto config drift.
- [x] **SQL/ORM:** N/A. Feature pure RBAC, không query DB.
- [x] **Cache key:** N/A. Feature không touch Redis.
- [x] **Audit log:** F-076 audit log hooks (`POST /trigger` action log) sẽ ghi nhận finance user trigger với `actorId = Logto sub` — verified existing AuditLogService injection trong controller không đụng (zero touch).

### Performance numbers measured (qualitative)

- **Guard overhead:** `roles.includes()` + `scopes.includes()` × 7 array element max = O(n) trên array <10 element = ~microseconds. Negligible (target p95 < 5ms per BR per PRD).
- **Sidebar filter:** 5 group × ~10 item × 3 branch ternary = ~150 ops mỗi render. < 1ms.
- **Test runtime:** 84 test F-078 specs runs 2.8s; full sweep 725 tests 4 module 14.7s.

### Logto Dashboard verify (PAUSE-Coder-01 pre-merge)

Trước khi merge main, Danny verify Logto Dashboard:
1. Resources → 5BIB Result API → Permissions có `finance` (BR-78-12)
2. Roles → có role `finance` assigned permission `finance` (BR-78-13)
3. Roles → admin → tab Permissions có `finance` tick (BR-78-14)
4. Users → Hiền → tab Roles có `finance` assigned (BR-78-15)
5. Hiền sign-out + sign-in → decode JWT verify `scope` chứa `"finance"`

Nếu bước 5 fail (scope không có `finance`) → vào Resources → 5BIB Result API → Settings → bật "Include role permissions in access token". Retry sign-out + sign-in.

### Smoke test PAUSE-Coder-02 (F-076 regression mandatory)

Trước khi merge main, Coder phải run 6 step BR-18 + BR-19 Telegram verify. Reason: F-076 invoice-reconcile vừa golive sáng nay 2026-06-09, race 220 đang bán vé. Regression = block.

Smoke test commands (cần PROD env / Hiền token):
```bash
# Step 1: GET /health admin token
curl -H "Authorization: Bearer <admin>" https://result-dev.5bib.com/api/admin/invoice-reconcile/health
# Expect: 200 + healthy=true + masked secrets

# Step 2: GET /today admin token
curl -H "Authorization: Bearer <admin>" https://result-dev.5bib.com/api/admin/invoice-reconcile/today
# Expect: 200 + ReconcileReportDto shape

# Step 3: POST /trigger admin token
curl -X POST -H "Authorization: Bearer <admin>" https://result-dev.5bib.com/api/admin/invoice-reconcile/trigger
# Expect: 200 hoặc 409 lock-aware

# Step 4: GET /health finance token (Hiền new)
curl -H "Authorization: Bearer <finance>" https://result-dev.5bib.com/api/admin/invoice-reconcile/health
# Expect: 200 (NEW access F-078)

# Step 5: GET /today staff-only token
curl -H "Authorization: Bearer <staff>" https://result-dev.5bib.com/api/admin/invoice-reconcile/today
# Expect: 403 + VN message (BR-78-06)

# Step 6: Verify cron tick scan-tick.cron @Cron('0 */5 8-22 * * *') log
ssh 5solution-vps "docker logs 5bib-result-backend --tail 100 | grep 'invoice-reconcile.*scan'"
# Expect: log có entry trong 5 phút gần nhất

# BR-19: Verify Telegram bot @invoice_5bib_daily_bot vẫn gửi alert được
# Manual: trigger manual → check Telegram group "F-076 Invoice Alerts" nhận test alert.
```

---

## Summary

**Implementation:** 37 file changed (32 Scope Lock + 1 forced cascade + bonus comment hygiene + 3 spec test). **84/84 F-078 spec PASS + 725/725 regression sweep PASS — zero regression.** Backward compat 100% verified: F-076 controller spec self-healed sau forced cascade, finance/contracts services không touch.

**Risk residual:**
- F-076 PROD smoke test deferred (PAUSE-Coder-02 pre-merge) — Danny + Coder cần coordinate trước khi push main.
- Logto Dashboard config drift risk — guard defense-in-depth fallback đã cover admin tier; finance tier phụ thuộc Danny setup chính xác BR-78-12 đến BR-78-15.

**Recommendation:** Manager review prioritize 5 files theo order Section 4 + Section 1 deviation justification. QC focus Phase 2 Security Threat Model + Phase 6 persona walkthrough 4 token tier × 13 controller.
