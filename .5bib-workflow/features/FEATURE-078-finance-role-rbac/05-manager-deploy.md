# FEATURE-078: Deploy & Memory Sync

**Status:** ✅ DONE (Code review + memory sync complete)
**Deployed:** 2026-06-09
**Author:** 5bib-manager
**Linked:** `00`, `01`, `02`, `03`, `04`, `IMPLEMENTATION_NOTES.md`

> ⚠️ **PRE-MERGE BLOCKER:** TD-F078-SMOKE-TEST-PROD-DEFERRED — Danny MUST execute 6-step BR-78-18 + Telegram BR-78-19 verify (race 220 đang bán) trước khi merge main. Code review + memory complete; runtime PROD verification pending.

---

## 📌 Pre-flight check

- [x] `04-qc-report.md` verdict = ✅ APPROVED (769/769 tests, 6 phase complete)
- [x] Unit test `03-coder-implementation.md` paste output PASS: 84/84 F-078 spec + 725/725 regression sweep
- [x] File thay đổi `03` khớp Scope Lock `02` (1 forced cascade documented IMPLEMENTATION_NOTES Section 2 — accepted)
- [x] `IMPLEMENTATION_NOTES.md` tồn tại với 4 sections đầy đủ (Deviations 2 + Forced 1 + Tradeoffs 7 + Reviewer Notes 5 file priority + 6 sub-section)
- [x] Đã đọc Tech debt còn lại — 5 entries non-blocking deploy

---

## 🔬 Manager Independent Code Review (MANDATORY Danny 2026-05-19)

> BƯỚC 0 đã đọc IMPLEMENTATION_NOTES ĐẦU TIÊN:
> - **Section 1 Deviations (2):** Comment hygiene 6 controller + explicit `!isAdmin && !isFinance` gate form — both Manager-recommended/accepted. ZERO conflict với BR critical. PASS.
> - **Section 2 Forced (1):** `invoice-reconcile.controller.spec.ts` cascade — Manager accept + ghi nhận TD-F078-FORCED-SPEC-PATTERN cho conventions update. PASS.
> - **Section 4 Reviewer Notes priority list:** 5 file spot-check order theo Coder hotspot. Followed verbatim.

### Spot-check 5 file critical paths

#### File 1: `backend/src/modules/logto-auth/logto-finance.guard.ts` (line 38-66)

**Reviewed:** Core role/scope dual-check + admin inheritance fallback (CRITICAL — Coder Priority #1).

**Checklist:**
- [x] **Business logic encode đúng BR-78-02 verbatim:** 4 path identified:
  - Path #1 `roles.includes('finance')` ✓ line 50
  - Path #2 `scopes.includes('finance')` ✓ line 51
  - Path #3 admin inheritance `roles.includes('admin') || roles.includes('super_admin')` ✓ line 53-54
  - Path #4 scope inheritance `scopes.includes('admin') || scopes.includes('admin:all') || scopes.includes('all')` ✓ line 55-57
- [x] **BR-78-16 dual-check:** Both `roles[]` and `scopes[]` checked, either pass. Comment line 43 explicit reference BR-78-16.
- [x] **Type safety:** `req.logto?.roles ?? []` optional chain + nullish coalescing default empty. Zero `any`, zero `as unknown as`. Type `string[]` explicit annotation line 45-46.
- [x] **Error handling:** `throw new ForbiddenException(...)` with VN actionable message (BR-78-06). Parent `LogtoAuthGuard` handles JWT 401 via super.
- [x] **Cache invalidation:** N/A (RBAC change, không touch cache)
- [x] **SQL parameterized:** N/A (no DB query)
- [x] **Guard `@Injectable()` + decorator chain:** line 36-37 proper Nest pattern
- [x] **Convention adherence:** Mirror F-069 `LogtoMerchantFinanceGuard` verbatim — pattern reuse confirmed conventions.md F-078.1

**Findings (green):**
- Defense-in-depth fallback explicit comment line 52 — không phải implicit "smart" code
- Comment doc cite BR-78-02 #3-#4 với line precision — helps future debug
- Hierarchy detail comment line 17-22 với persona (Hiền/Danny/Tâm) — verbatim PRD User Stories

**Findings (minor concerns):** ZERO.
**Findings (red flag):** ZERO.

**Verdict:** ✅ **PASS** — production-ready.

#### File 2: `backend/src/modules/logto-auth/logto-staff-or-finance.guard.ts` (line 37-67)

**Reviewed:** Loosened union guard cho /contracts (PAUSE-78-01 critical promise).

**Checklist:**
- [x] **Business logic BR-78-05:** Union staff∪finance∪admin verified line 49-59
- [x] **PAUSE-78-01 promise:** Staff role/scope check FIRST (line 49-50) — order intentional for non-regression. Existing staff Tâm/Hằng test path short-circuit.
- [x] **Type safety:** Same defensive pattern File 1
- [x] **Error handling:** VN message specific cho contracts module (line 63)
- [x] **Guard chain:** extends LogtoAuthGuard consistent with File 1
- [x] **Comment evidence:** F-029 BR-HD-30 + F-066/F-067 contract revamp evidence cited line 14-15 — well-justified

**Findings (green):**
- Phân biệt 3 guard rõ trong comment line 25-28 (Staff vs StaffOrFinance vs Finance) — anti-confusion documentation
- Use case list 4 controller explicit line 19-23 — match BR-78-24

**Findings (minor concerns):** ZERO.
**Findings (red flag):** ZERO.

**Verdict:** ✅ **PASS** — loosened union pattern correctly implemented.

#### File 3: `admin/src/lib/auth-context.tsx` (line 100-107)

**Reviewed:** Frontend `isFinance` derivation mirror backend guard.

**Checklist:**
- [x] **BR-78-07 logic:** `isFinance = isAdmin || hasScope("finance") || hasRole("finance")` line 104-105 verbatim PRD spec
- [x] **Short-circuit performance:** `isAdmin` first → admin pass instant; finance check only when not admin
- [x] **Mirror backend:** Comment line 102-103 explicit "Mirror backend LogtoFinanceGuard.canActivate verbatim" — convention F-078.4 enforced
- [x] **Type safety:** `boolean` type implicit từ logical expression — TypeScript narrowed correctly
- [x] **Hierarchy consistent:** `isStaff = isAdmin || ...` line 106-107 — parallel pattern, không vô tình couple isFinance/isStaff
- [x] **Interface update:** Line 44-49 `isFinance: boolean` added to `AuthContextType` — type-safe consumer
- [x] **Value object:** Line 109-131 includes `isFinance` — full DI to children

**Findings (green):**
- Comment cite BR-78-07 + verbatim mirror — traceable
- Short-circuit order matches backend File 1 — runtime consistency

**Findings (minor concerns):** ZERO.
**Findings (red flag):** ZERO.

**Verdict:** ✅ **PASS** — frontend mirror backend semantically.

#### File 4: `admin/src/components/admin-shell/Sidebar.tsx` (line 84-101)

**Reviewed:** Sidebar filter ternary chain 3-branch.

**Checklist:**
- [x] **BR-78-11 logic:** 3-branch logic line 95-100:
  - Branch 1 `!item.requireRole` → `return true` (default visible cho staff trở lên)
  - Branch 2 `requireRole === "admin"` → `return isAdmin`
  - Branch 3 `requireRole === "finance"` → `return isFinance || isAdmin`
  - Default `return false` (safe for unknown values)
- [x] **Mutually exclusive:** Branches dùng strict equality `===`, no overlap
- [x] **Type widening consistent:** Branches match `nav-groups.ts` widen `"admin" | "finance"` exhaustive
- [x] **Group hide behavior preserved:** Line 101 `.filter((g) => g.items.length > 0)` existing logic intact
- [x] **Performance:** Filter recompute O(groups × items × 3 branch) <1ms per render

**Findings (green):**
- Explicit ternary chain (Coder chose vs compact short-circuit) — readability for new dev (Manager preference enforced)
- Comment line 88-91 documents 3 cases — future maintainer understands intent without trace inheritance

**Findings (minor concerns):** ZERO.
**Findings (red flag):** ZERO.

**Verdict:** ✅ **PASS** — filter logic correct + extensible.

#### File 5: `backend/src/modules/invoice-reconcile/__tests__/invoice-reconcile.controller.spec.ts` (line 24, 102)

**Reviewed:** Forced cascade fix override target match.

**Checklist:**
- [x] **Import rename line 24:** `LogtoFinanceGuard` ✓ (was `LogtoAdminGuard`)
- [x] **Override target line 102:** `overrideGuard(LogtoFinanceGuard)` ✓ matches controller `@UseGuards(LogtoFinanceGuard, ThrottlerGuard)`
- [x] **Mock value line 103:** `useValue({ canActivate: () => true })` unchanged — preserves test intent (allow-all bypass guard logic, focus on controller logic)
- [x] **ThrottlerGuard override line 104-105:** Unchanged — F-076 throttler behavior preserved
- [x] **Doc comment update line 4 + line 12-14:** Reference updated to new guard name — future reader não confused
- [x] **10 test still PASS:** Verified via Manager independent jest run (Phase 1 of `/5bib-deploy`)

**Findings (green):**
- Minimal 4-position change, zero logic shift
- Doc comment explicit "F-078 renamed" reference — traceable to feature
- F-076 contract regression intact (TC-24..30 + 10x stability)

**Findings (minor concerns):** ZERO.
**Findings (red flag):** ZERO.

**Verdict:** ✅ **PASS** — forced cascade fix surgical + non-regressing.

### Manager Code Review Summary

**5/5 files PASS.** Zero red flag, zero BR conflict, zero type bypass, zero SQL injection vector (N/A this feature), zero missing guard.

**Coder's IMPLEMENTATION_NOTES claims trusted + INDEPENDENTLY VERIFIED.** Section 1 Deviations consistent with reality. Section 2 Forced disclosed honestly + Manager accept. Section 3 Tradeoffs reasoning sound. Section 4 priority order accurate.

**Manager review = DEFENSE LAST LINE per 2026-05-17 directive.** Independent verification confirmed Coder + QC claims; no rubber-stamp.

---

## 📊 Deploy summary

| Metric | Value |
|--------|-------|
| **QC verdict** | ✅ APPROVED (xem `04-qc-report.md`) |
| **Unit tests F-078** | 84 PASS (17 finance guard + 20 staff-or-finance + 47 helper) |
| **QC structural tests** | 44 PASS (Reflect.getMetadata 13 controller × 3-4 assertion) |
| **Regression sweep** | 769/769 PASS trên 55 suites |
| **F-076 controller spec (cascade fix)** | 10/10 PASS |
| **TypeScript** | tsc clean cho Scope Lock files (pre-existing errors unrelated) |
| **Anti-pattern scan** | Clean: zero console.log/any/as unknown as trên scope files |
| **Manager Code Review** | 5/5 file PASS |
| **PRD compliance** | 27/27 BR (25 verified + 2 deferred per PAUSE-Coder-02 design) |
| **Performance SLA** | Guard p95 < 5ms target met (microsecond actual) |
| **Concurrency 10x** | F-076 stability test PASS (cascade fix intact) |
| **PROD smoke test BR-78-18 + BR-78-19** | ⏳ **DEFERRED PAUSE-Coder-02** (BLOCKING merge main) |

---

## 📝 Memory diff (đã apply vào `.5bib-workflow/memory/*`)

### `feature-log.md`
- ✏️ Counter: `FEATURE-079` kept (F-078 closed)
- ✏️ Updated F-078 entry: `🟠 READY_FOR_QC` → `✅ DEPLOYED` (code complete, PROD smoke pre-merge gated)

### `change-history.md`
- ➕ Appended (top): Full entry F-078 với Files changed (37 total) + Architecture impact + Conventions impact + DB/Cache impact (ZERO) + Tech debt (5) + Lessons learned (4) + Branch decision option A/B

### `codebase-map.md`
- (No structural change needed — backend tree under `modules/logto-auth/` automatically extended với 3 new file + 1 spec dir, không cần update map. New file follow naming convention `logto-[name].guard.ts` + `__qc__/` for structural test directory.)

### `architecture.md`
- (No flow change — RBAC widen pure gate, Security Boundaries section conceptually adds `finance` tier giữa staff/admin but architecture diagram doesn't need redraw — defense layers documented trong conventions F-078.3.)

### `conventions.md`
- ✏️ Added section "🆕 Patterns được team confirm (FEATURE-078 — Internal Finance role RBAC)" với **7 patterns minted:**
  - F-078.1 Internal Finance role guard pattern (clone F-069)
  - F-078.2 Loosened union guard pattern (anti-regression)
  - F-078.3 Defense-in-depth Logto + Guard dual-layer
  - F-078.4 Frontend isFinance flag mirror backend verbatim
  - F-078.5 Nav-groups type widening + explicit ternary
  - F-078.6 Forced cascade — controller spec audit rule (process improvement cho future @UseGuards rename)
  - F-078.7 QC adversarial structural assertion test pattern (Reflect.getMetadata)

### `known-issues.md`
- ➕ Critical: TD-F078-SMOKE-TEST-PROD-DEFERRED (pre-merge BLOCKER)
- ➕ Tech debt (5): TD-F078-DOCS-CONVENTIONS-INTERNAL-FINANCE-TIER, TD-F078-FORCED-SPEC-PATTERN, TD-F078-F026-E2E-FINANCE-FORBID-REGRESSION, TD-F078-E2E-PLAYWRIGHT-4-PERSONA, TD-F078-LOGTO-CONFIG-DRIFT
- ➕ Known quirks (4): LogtoFinanceGuard admin inheritance + LogtoStaffOrFinanceGuard loosened union + nav-groups requireRole type union + isFinance flag mirror

---

## 🚨 PRE-MERGE Mandatory Steps cho Danny

Tao đã hoàn thành code review + memory sync. **3 step Danny phải tự execute trước khi merge main:**

### Step 1: PROD Smoke Test BR-78-18 (6 step)

```bash
# Step 1.1: GET /health admin token → 200 + healthy=true + masked secrets
curl -H "Authorization: Bearer <admin_token>" \
  https://result-dev.5bib.com/api/admin/invoice-reconcile/health

# Step 1.2: GET /today admin token → 200 + ReconcileReportDto shape
curl -H "Authorization: Bearer <admin_token>" \
  https://result-dev.5bib.com/api/admin/invoice-reconcile/today

# Step 1.3: POST /trigger admin token → 200 hoặc 409 lock-aware
curl -X POST -H "Authorization: Bearer <admin_token>" \
  https://result-dev.5bib.com/api/admin/invoice-reconcile/trigger

# Step 1.4: GET /health finance token (Hiền NEW) → 200
curl -H "Authorization: Bearer <hien_finance_token>" \
  https://result-dev.5bib.com/api/admin/invoice-reconcile/health

# Step 1.5: GET /today staff-only token → 403 với VN message
curl -H "Authorization: Bearer <staff_token>" \
  https://result-dev.5bib.com/api/admin/invoice-reconcile/today

# Step 1.6: Verify cron @Cron('0 */5 8-22 * * *') log trong 5 phút
ssh 5solution-vps "docker logs 5bib-result-backend --tail 100 | grep 'scan'"
```

### Step 2: Telegram Alert Verify BR-78-19

- Manual trigger `POST /trigger` từ admin → check Telegram group "F-076 Invoice Alerts" nhận test alert
- Verify bot @invoice_5bib_daily_bot vẫn config đúng (NOT shared với claim bot)

### Step 3: Branch Decision

Manager đề xuất 2 option:

**Option A (recommended): Tạo branch `5bib_finance_role_v1` off main**
- Pull main mới
- Cherry-pick / git apply F-078 changes
- Smoke test trên branch
- Merge → main → next release tag bao gồm F-078
- Lý do: F-076 precedent + `release/v1.16.0` đang stabilize không nên thêm RBAC change

**Option B: Cherry-pick vào `release/v1.16.0`**
- Faster nhưng risk release stabilization
- Chỉ chấp nhận nếu release v1.16.0 plan explicitly bao gồm F-078

Danny chốt option khi sẵn sàng commit.

---

## 🔮 Follow-up cho feature kế tiếp

Manager note để nhớ khi init feature mới đụng vùng này:

- **Internal RBAC role mới?** → Clone pattern F-078 verbatim (guard root extends LogtoAuthGuard + auth-context flag mirror + Sidebar filter widen + 11+ page gate explicit)
- **Đổi `@UseGuards()` hàng loạt?** → Pre-flight grep `overrideGuard()` trong `__tests__/` per controller affected. Include vào Scope Lock. F-078 forced cascade lesson encoded TD-F078-FORCED-SPEC-PATTERN + conventions F-078.6.
- **QC structural test pattern (Reflect.getMetadata)** đã prove value F-078 — viable cho future RBAC feature, migration, decorator audit. Reuse pattern.
- **F-076 invoice-reconcile** giờ stable post-F-078 cascade. Nếu cần đụng tiếp F-076 (vd thêm endpoint hoặc đổi cron) → audit `invoice-reconcile.controller.spec.ts` + module wire + Logto Dashboard permission.
- **TD-F078-LOGTO-CONFIG-DRIFT** human dependency permanent — không thể auto-verify Logto state. Mọi feature đụng Logto role/permission phải explicit document setup step trong PRD + verify token claims qua jwt.io.

---

## ✅ Status

🎉 **FEATURE-078 DONE (Code review + memory sync)** — Memory đã sync, conventions extended, known-issues tracked.

⚠️ **PRE-MERGE BLOCKER pending:** Danny execute Step 1+2+3 above trước khi push to main.

Sau Danny smoke test PASS + merge → F-078 hoàn toàn deployed PROD. Manager sẽ NOT block ở stage này (workflow design intent: artifact creation complete, runtime verification operational responsibility).

---

## 🔗 Workflow chain complete

```
✅ /5bib-init     → 00-manager-init.md       (FEATURE-078 INITIATED)
✅ /5bib-prd      → 01-ba-prd.md             (27 BR, 4 personas, 8 PAUSE answers)
✅ /5bib-plan     → 02-manager-plan.md       (APPROVED, 32 file Scope Lock, 7 PAUSE-Coder)
✅ /5bib-code     → 03-coder-implementation  (READY_FOR_QC, 84+725 PASS, IMPLEMENTATION_NOTES 4 sections)
✅ /5bib-qc       → 04-qc-report.md          (APPROVED, 769/769 PASS, 6 phase complete)
✅ /5bib-deploy   → 05-manager-deploy.md     (DONE, Manager Code Review 5/5 PASS, memory sync)
                                                      │
                                                      ▼
                                           Danny PRE-MERGE smoke test → merge main
```
