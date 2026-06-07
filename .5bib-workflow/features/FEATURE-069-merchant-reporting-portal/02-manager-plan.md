# FEATURE-069: Plan Review — Merchant Reporting Portal (R2)

**Status:** ✅ **APPROVED** — Coder có thể `/5bib-code`
**Reviewed:** 2026-06-04 (R1 reject) → 2026-06-04 (R2 approve)
**Reviewer:** 5bib-manager
**Linked PRD artifacts:**
1. `01-ba-prd.md` (R1, 2216 dòng) — BR-MP-01 → 35 nguyên bản
2. `01-ba-prd-part2.md` (R1, 767 dòng) — TC-MP-01 → 25, E2E-MP-01 → 08, SEC-01 → 15, Performance SLA, Design Spec
3. `01-ba-prd-revision-r2.md` (R2, 2026-06-04) — Modify/extend addressing 5 GAP + 3 MINOR

**Re-review history:**
- R1 (2026-06-04) — 🟡 NEEDS_REVISION (5 GAP + 3 MINOR) → BA xử lý
- R2 (2026-06-04) — ✅ APPROVED (8/8 gap resolved + 1 positive correction phát hiện thêm)

---

## 📌 Pre-flight check (Manager re-review R2)

- [x] Đọc `00-manager-init.md` (197 dòng) — 8 PAUSE đã đáp ứng
- [x] Đọc lại `01-ba-prd.md` (R1 nguyên) + `01-ba-prd-part2.md` (R1 nguyên)
- [x] Đọc `01-ba-prd-revision-r2.md` (R2) toàn bộ — 8 gap addressed
- [x] Memory: `codebase-map.md`, `architecture.md`, `conventions.md`, `known-issues.md`
- [x] **🔬 Spot-check code R2 claims** — XÁC NHẬN 7/7 reference đúng + 1 phát hiện positive:

| R2 claim | Code reality | Verdict |
|---|---|---|
| `period-resolver.ts:22` `PeriodKind = '7d' \| '30d' \| 'quarter' \| 'year' \| 'custom' \| 'rolling12m'` | ✅ Khớp chính xác | Additive `'90d'` an toàn |
| `period-resolver.ts:133-179` switch chỉ 5 case | ✅ Khớp | Coder thêm `case '90d'` between `'30d'` và `'quarter'` |
| `fee.service.ts:1108` signature `computeFeeForOrdersAggregate(tenantId: number, orders, period, injectedConfig?)` | ✅ Khớp — single tenantId confirmed | Per-tenant loop pattern BR-MP-21b correct |
| `fee.service.ts:1112-1116` `injectedConfig` pre-load pattern F-059 | ✅ Khớp — comment "F-059 hotfix 2026-05-24" | Cross-tenant: pre-load configs qua `$in` query → pass per-call (tránh N+1) |
| `fee.service.ts:1144` Tier 3 defaults `5.5% / 5000 VNĐ / 0% VAT` | ✅ Khớp — line 1144-1146 | BR-MP-11 dual fee compute đúng cascade |
| `logto-staff.guard.spec.ts` 80 dòng | ✅ Tồn tại | Coder port làm template `logto-merchant.guard.spec.ts` |
| F-068 SETNX lock pattern (`reset-lock:`, `medical:incident-lock:`, etc.) | ✅ Có 3+ precedent: `timing-alert/notification-dispatcher.service.ts` (SETNX EX 900), `timing-alert/services/checkpoint-discovery-lock.spec.ts` (10x stability test pattern), `reset-exceptions.spec.ts` (BR-A3 ConflictException 409) | BR-MP-37 access-lock viable, port pattern proven |
| exceljs proven in `reconciliation/export/tong-hop.service.ts` + `xlsx.service.ts` | ✅ Khớp | Coder reuse, KHÔNG cần `pnpm install` mới |
| ⭐ **PHÁT HIỆN POSITIVE** — `logto.service.ts` ĐÃ TỒN TẠI với M2M Management API wrapper | ✅ Method `getUser(userId)`, `mergeCustomData()`, `managementApi<T>()`, `fetchM2MToken()`. Env `LOGTO_M2M_APP_ID`/`SECRET` đã có trong `config/index.ts:47-48` | ⚠️ BR-MP-36 cần ADJUST — Coder EXTEND `logto.service.ts` thêm `lookupByEmail()` + cache, KHÔNG tạo file mới `logto-management.service.ts` |

---

## ✅ R1 Gaps — Tất cả đã RESOLVED trong R2

| Gap | R2 resolution | Verdict |
|---|---|---|
| 🔴 #1 PeriodKind | Option A (mở rộng enum thêm `'90d'`) — BR-MP-25 modified + BR-MP-25b PAUSE point + TC-MP-22b regression | ✅ RESOLVED. Additive change, F-062 không break. Coder PAUSE Manager trước khi modify period-resolver.ts |
| 🔴 #2 Chart scope creep | Lean+1 — Phase 1 = 4 chart (3 baseline + AnStacked). 5 chart deferred Phase 2. BR-MP-07 modified + BR-MP-07b backlog table + NEW endpoint `/ticket-sales/stacked` + TC-MP-22c | ✅ RESOLVED. Scope rõ ràng. AnStacked implementable (chỉ rebucket SQL). 5 chart Phase 2 backlog có lý do data dependency cụ thể |
| 🔴 #3 Cross-tenant aggregate | Per-tenant loop pattern (verified FeeService nhận single tenantId). BR-MP-21b loop logic + BR-MP-21c response shape `byTenant[]` + Phase 2.2.4b layout per-tenant breakdown table + TC-MP-28/29 + E2E-MP-09 | ✅ RESOLVED. Pre-load configs qua F-059 pattern tránh N+1 |
| 🟡 #4 MANUAL fee display | Dual display (% line + VNĐ/vé line). BR-MP-10/11 modified, RevenueSummaryDto thêm `feeRatePercent` + `manualFeePerTicket` + `feeRateSource`. Auto-hide line khi category orderCount=0. TC-MP-08 updated + TC-MP-08b math check `MANUAL.fee = SUM(qty) × manualFeePerTicket` | ✅ RESOLVED. Math check TC-MP-08b đảm bảo merchant đối soát đúng |
| 🟡 #5 Logto Management API | BR-MP-36 LogtoManagementService + endpoint `/api/admin/merchant-portal/logto-lookup` + BR-MP-29 step 5 M2M setup + TC-MP-26/27/27b + UI step-by-step | ✅ RESOLVED (với 1 POSITIVE CORRECTION dưới): Coder EXTEND `logto.service.ts` hiện có thay vì tạo file mới |
| 🟢 #1 `403_INACTIVE` | BR-MP-27 thêm 4 error code (`403_INACTIVE`, `503_LOGTO_UNREACHABLE`, `400_QUERY_TOO_SHORT`, `429_RATE_LIMIT_EXPORT`) | ✅ RESOLVED |
| 🟢 #2 Access mutation lock | BR-MP-37 SETNX `merchant-access-lock:<userId>` TTL 10s. Port pattern verified: F-068 + timing-alert + reset-exceptions có 3 precedent. TC-MP-30 + SEC-16 | ✅ RESOLVED |
| 🟢 #3 TD-CI-001 mitigation | BR-MP-28b: concurrency group + workflow_dispatch ref validate + post-deploy verify all 4 service tags + compose backup. TC-MP-31 manual integration test | ✅ RESOLVED |

---

## ⚠️ 1 POSITIVE CORRECTION cho R2 (không block)

### `logto.service.ts` đã tồn tại — Coder EXTEND thay vì tạo file mới

**Phát hiện 2026-06-04 trong spot-check R2:**

R2 BR-MP-36 propose tạo NEW file `backend/src/modules/logto-auth/logto-management.service.ts`. Nhưng `backend/src/modules/logto-auth/logto.service.ts` ĐÃ TỒN TẠI với:

```typescript
export class LogtoService {
  isEnabled(): boolean { ... }            // check env.logto.m2mAppId
  private async fetchM2MToken(): Promise<string> { ... }  // M2M token (BR-MP-36 line 26)
  private async managementApi<T>(...) { ... }              // generic wrapper
  async getUser(userId: string) { ... }                    // ⭐ EXACTLY lookupById(userId) cần
  async mergeCustomData(userId, patch) { ... }             // không cần cho feature này
}
```

**Env vars `LOGTO_M2M_APP_ID` + `LOGTO_M2M_APP_SECRET` đã được setup** trong `config/index.ts:47-48` + `:147-148` với Joi validation.

**Adjustment cho Coder:**

| BR-MP-36 R2 | Adjustment (Manager apply) |
|---|---|
| Tạo NEW file `logto-management.service.ts` với 6 method | EXTEND existing `logto.service.ts` thêm 2 method: `lookupByEmail(email)` + `lookupByIdWithCache(userId)` (wrap `getUser()` với Redis cache) |
| Re-implement M2M token fetch | REUSE `fetchM2MToken()` đã có (line 26) |
| Re-implement Management API wrapper | REUSE `managementApi<T>()` đã có (line 74) |
| Re-implement `lookupById()` | REUSE `getUser(userId)` đã có (line 94) — wrap với Redis cache `logto-lookup:byid:<userId>` TTL 300s |
| NEW: `lookupByEmail(email)` | ADD — call Logto Management API `GET /api/users?search=<email>` (Logto Management API endpoint), cache `logto-lookup:byemail:<sha256_hash>` TTL 300s |
| BR-MP-29 step 5 setup M2M App | ⚠️ Danny VERIFY: M2M App có thể đã setup sẵn từ F-XXX trước đó (vì env vars đã tồn tại trong config schema). Nếu YES → BR-MP-29 step 5 chỉ là "verify .env đã có values", KHÔNG cần setup mới |

**Net impact:**
- ✅ Scope giảm: Coder code ÍT hơn (reuse 4/5 method đã có)
- ✅ Risk giảm: M2M auth proven trong production (existing code paths)
- ⚠️ Danny PAUSE: confirm `LOGTO_M2M_APP_ID` đã có values trên DEV + PROD (không phải empty string default theo `Joi.optional().allow('')`)

Lý do KHÔNG block: positive correction chỉ làm scope nhẹ hơn, KHÔNG thay đổi nghiệp vụ. Coder đọc note này khi `/5bib-code` và apply tự nhiên.

---

## ✓ Final Validation Checklist

### Completeness — Coverage đầy đủ (R1+R2)
- [x] User Stories 12 US-069-XX với 3 personas chuẩn
- [x] Business Rules có ID (BR-MP-01 → 37, total 37 BR sau R2)
- [x] UI states đầy đủ cho 8 page + 5 error/gate page
- [x] Test cases 35 TC (25 R1 + 10 R2) + 9 E2E (8 R1 + 1 R2) + 16 SEC + Performance SLA 18 row
- [x] Field Source Table mỗi UI field map về data source cụ thể
- [x] Bilingual error message VN/EN cho 13 error code

### Technical correctness vs codebase
- [x] Guard inheritance `LogtoMerchantGuard extends LogtoAuthGuard` + `LogtoMerchantFinanceGuard extends LogtoMerchantGuard` pattern khớp `logto-admin.guard.ts`
- [x] PeriodKind extension additive — F-062 không break
- [x] FeeService reuse pattern + per-tenant loop với pre-load configs đúng F-058/F-059
- [x] Cache key pattern + scanStream invalidate khớp F-049/F-068
- [x] SETNX lock pattern khớp F-068 + 3 precedent khác
- [x] Generated SDK refresh sau DTO change
- [x] Display Convention `merchant-labels.ts` centralize
- [x] Logto Management API REUSE existing `LogtoService` (positive correction)
- [x] exceljs proven pattern reconciliation module
- [x] Runtime proxy pattern admin/frontend hiện tại

### Security — Mọi layer covered
- [x] IDOR 2-layer (service + SQL) + per-tenant scoping
- [x] Cache key userId-scoped (cache isolation)
- [x] 403 vs 404 enumeration prevention
- [x] Inactive user block
- [x] Draft race filter
- [x] Concurrent admin save lock (BR-MP-37 mới)
- [x] Audit log immutable + ghi trước hard delete
- [x] Rate limit export 1/30s
- [x] SQL injection — parameterized only

### Performance — Số cụ thể
- [x] SLA 18-row với cold/warm split, payload size
- [x] Cache pre-warm cron 5 phút cho active merchants (BR-MP-30)
- [x] FeeService cold cache risk acknowledged (TD-F062-WAVE2B1-FEE-PERF)

### Architecture impact (Manager acceptance)
- ➕ Module backend mới `merchant-portal/`
- ➕ Frontend app mới `merchant-portal/` (port 3084)
- ➕ Collection MongoDB mới `merchant_portal_access`
- ➕ 6 Redis key pattern mới + 1 lock key
- ➕ 2 Logto role + 2 permission + 1 Web App (Logto Dashboard manual)
- ➕ 1 NestJS service EXTEND (`LogtoService.lookupByEmail`)
- ➕ 4 Docker container (backend, frontend, admin, **merchant-portal**)
- ➕ 1 nginx site + 1 DNS A record
- ➕ 1 CI/CD pipeline update với TD-CI-001 mitigation

**Architecture diagram update needed sau ship:**
- Thêm node `MerchantPortal` dưới Auth domain
- Thêm flow: Login → resolveAccessibleRaces (Redis 300s) → reportQuery (Redis 60s) → SQL with mandatory tenant_id + race_id filter
- Thêm integration point: Backend → Logto Management API (M2M) → User lookup

### Known issues addressed
| TD | R2 handling |
|---|---|
| `TD-AUTH-LOGTO-SCOPE-GRANT` 🔴 | BR-MP-29 acknowledged (R1) — admin assign role trước khi user login lần đầu |
| `TD-F062-WAVE2B1-FEE-PERF` 🟡 | BR-MP-30 cron pre-warm 5 phút (R1) + per-tenant loop với injectedConfig (R2 BR-MP-21b) tránh N+1 |
| `TD-CI-001` 🔴 | BR-MP-28b mitigation (R2): concurrency group + ref validate + post-deploy verify all 4 service tags + compose backup |

---

## 📋 Files được phép thay đổi (Scope Lock — FINAL R2)

Coder **CHỈ** được thay đổi các file/folder dưới đây. Đụng ngoài = scope creep, phải hỏi Manager.

### Backend — `backend/src/`

**NEW MODULE — `modules/merchant-portal/`:**
- ➕ `merchant-portal.module.ts`
- ➕ `merchant-portal.controller.ts` — merchant endpoints (BR-MP-26, 11 endpoint including `/ticket-sales/stacked`)
- ➕ `merchant-portal-admin.controller.ts` — admin endpoints (7 endpoint including `/logto-lookup`)
- ➕ `merchant-portal.service.ts` — service chính
- ➕ `merchant-portal-access.service.ts` — CRUD access config + cache invalidation + SETNX lock (BR-MP-37)
- ➕ `merchant-portal-export.service.ts` — Excel generation (reuse exceljs pattern)
- ➕ `merchant-portal-cron.service.ts` — cron pre-warm revenue cache (BR-MP-30)
- ➕ `schemas/merchant-portal-access.schema.ts`
- ➕ `dto/access-config.dto.ts`
- ➕ `dto/ticket-sales.dto.ts` — `TicketSalesSummaryDto`, `TicketSalesBreakdownDto`, `TicketSalesTrendDto`, `TicketSalesStackedDto` (R2 mới)
- ➕ `dto/revenue.dto.ts` — `RevenueSummaryDto` (dual fee fields R2), `RevenueSummaryAggregateDto` (cross-tenant R2), `RevenueBreakdownDto`, `RevenueTrendDto`
- ➕ `dto/merchant-me.dto.ts`
- ➕ `dto/race-list.dto.ts`
- ➕ `dto/logto-lookup.dto.ts` — `LogtoLookupQueryDto`, `LogtoLookupResponseDto` (R2 mới)
- ➕ `merchant-portal.service.spec.ts` — unit tests (xem section unit test mandate dưới)
- ➕ `merchant-portal-access.service.spec.ts` — unit tests + SETNX lock tests
- ➕ `merchant-portal-export.service.spec.ts` — Excel content verify
- ➕ `merchant-portal.controller.spec.ts`

**NEW GUARDS — `modules/logto-auth/`:**
- ➕ `logto-merchant.guard.ts`
- ➕ `logto-merchant-finance.guard.ts`
- ➕ `logto-merchant.guard.spec.ts` — port `logto-staff.guard.spec.ts` (80 dòng template)
- ➕ `logto-merchant-finance.guard.spec.ts`
- ✏️ `index.ts` — export 2 guard mới

**EXTEND existing — `modules/logto-auth/logto.service.ts`** ⭐ R2 CORRECTION
- ✏️ ADD method `lookupByEmail(email: string): Promise<LogtoUserInfo | null>` — call Logto Management API `GET /api/users?search=`, cache Redis 300s
- ✏️ ADD method `lookupByIdWithCache(userId: string)` — wrap existing `getUser()` với cache layer
- KHÔNG modify existing methods `getUser()`, `mergeCustomData()`, `managementApi()`, `fetchM2MToken()`, `isEnabled()`
- ✏️ ADD unit test cases trong `logto.service.spec.ts` (nếu chưa có file, tạo mới)

**MODIFY existing — `modules/analytics/services/period-resolver.ts`** ⚠️ PAUSE Manager
- ✏️ Line 22: thêm `'90d'` vào `PeriodKind` union
- ✏️ Line 133-179: thêm `case '90d'` trong `buildDateFilter()` switch
- ✏️ Line 289+: thêm logic auto-resolve granularity `weekly` cho `'90d'` trong `resolveBucketSize()`
- ✏️ Test: thêm case test `'90d'` trong `period-resolver.spec.ts` (nếu chưa có file, tạo + port pattern test pattern hiện tại)
- 🛑 **PAUSE Manager trước khi merge** — chạy F-062 regression test suite

**CONFIG:**
- ⚠️ **KHÔNG cần modify `src/config/index.ts`** — `LOGTO_M2M_APP_ID` + `LOGTO_M2M_APP_SECRET` đã có. Coder chỉ confirm DEV + PROD đã set values (không empty string).
- ✏️ `app.module.ts` — register `MerchantPortalModule`

**REUSE — KHÔNG modify (chỉ import):**
- `modules/analytics/services/fee-aggregate.helpers.ts` ❌ NO change
- `modules/finance/services/fee.service.ts` ❌ NO change
- `modules/logto-auth/logto-auth.guard.ts` ❌ NO change
- `modules/logto-auth/logto-admin.guard.ts` ❌ NO change
- `modules/reconciliation/services/xlsx.service.ts` ❌ NO change (chỉ port pattern, không import)

**CI/CD — `.github/workflows/`** (BR-MP-28b R2):
- ✏️ `build-and-deploy.yml` — thêm paths-filter cho `merchant-portal/`, build + push image
- ✏️ `deploy-production.yml` — thêm `concurrency` group + workflow_dispatch ref validate + post-deploy verify 4 service tags + compose backup
- 🛑 **PAUSE Manager** trước khi merge PR có CI changes

### Frontend — `merchant-portal/` (NEW APP)
```
merchant-portal/
├── package.json
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── Dockerfile                    # port 3000 container → host 3084
├── postcss.config.mjs
├── .env.example
└── src/
    ├── middleware.ts             # Logto auth check + redirect
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css            # 5Solution palette tokens (#1D49FF + #FF0E65)
    │   ├── (auth)/
    │   │   ├── callback/page.tsx
    │   │   └── layout.tsx
    │   ├── (dashboard)/
    │   │   ├── layout.tsx
    │   │   ├── page.tsx           # Race list
    │   │   ├── ticket-sales/page.tsx
    │   │   ├── revenue/page.tsx
    │   │   └── settings/page.tsx
    │   ├── unauthorized/page.tsx
    │   ├── no-access/page.tsx
    │   └── api/
    │       ├── auth/callback/route.ts
    │       └── [...proxy]/route.ts
    ├── components/
    │   ├── charts/
    │   │   ├── AreaTrend.tsx
    │   │   ├── AnStacked.tsx      # R2 — stacked area per course
    │   │   ├── HBarsByCourse.tsx
    │   │   └── DonutByTicketType.tsx
    │   ├── kpi/KpiCard.tsx
    │   ├── shell/{Sidebar,Topbar}.tsx
    │   ├── revenue/FeeRateBadge.tsx  # R2 — dual line display
    │   ├── tenant/TenantSelector.tsx # cross-tenant agency
    │   └── ui/ (shadcn/ui components)
    ├── lib/
    │   ├── api-generated/
    │   ├── api-hooks.ts
    │   ├── logto.ts
    │   ├── merchant-labels.ts    # BR-MP-24 dictionary
    │   └── i18n.ts
    └── messages/{vi,en}.json
```

### Admin — `admin/src/`
**NEW route group:**
- ➕ `app/(dashboard)/merchant-portal/page.tsx` — Access config list
- ➕ `app/(dashboard)/merchant-portal/audit-log/page.tsx` — Audit log viewer
- ➕ `components/merchant-portal/AccessConfigTable.tsx`
- ➕ `components/merchant-portal/AccessConfigDialog.tsx` — Logto lookup button (BR-MP-36)
- ➕ `components/merchant-portal/AuditLogList.tsx`
- ➕ `components/merchant-portal/TenantWarningBanner.tsx`

**REUSE — KHÔNG modify:**
- `admin/src/lib/api-client.ts` ❌ NO change (chỉ regenerate SDK)
- `admin/src/lib/auth-context.tsx` ❌ NO change

### Infra
- ✏️ `docker-compose.yml` — thêm service `merchant-portal` port 3084:3000
- ✏️ `docker-compose.production.yml` — same
- ➕ `nginx/sites-available/merchant.5bib.com` — NEW
- ➕ DNS GoDaddy A record (Danny manual)
- ➕ Logto Dashboard manual config (Danny manual): 2 role + 2 permission + 1 Web App + verify M2M App đã có

### OUT of scope (Coder KHÔNG đụng)
- ❌ Module `order`, `race-result`, `auth`, `merchant`, `analytics` (existing) — read-only reuse
- ❌ `fee.service.ts`, `fee-aggregate.helpers.ts` — chỉ import
- ❌ Existing methods của `LogtoService` (`getUser`, `mergeCustomData`, etc.) — chỉ ADD `lookupByEmail` + `lookupByIdWithCache`
- ❌ Trang admin nào ngoài `merchant-portal/` route group
- ❌ Frontend public app `frontend/` — không đụng
- ❌ Backend port 8081 routing chính — chỉ thêm controller mới
- ❌ Existing collection MongoDB nào ngoài `audit_logs` (reuse emit pattern)
- ❌ MySQL platform schema (read-only)
- ❌ 5 chart nâng cao (AnPace, AnVelocity, AnHeatmap, AnFunnel, AnCompare) — Phase 2 backlog
- ❌ Backend `period-resolver.ts` không phải `case '90d'` (chỉ thêm 1 case, không refactor toàn bộ)

---

## 🔧 Tech approach (Coder reference)

### Backend
1. **Module skeleton** — port pattern `analytics/` + `finance/`
2. **Guards** — extends `LogtoAuthGuard` thuần kế thừa
3. **`resolveAccessibleRaces(userId)`** — return `Set<number>` raceId, cache 300s, draft filter trong service layer
4. **3-tier scoping** — Controller validate → Service pass scope → SQL helper với mandatory filter
5. **Cache invalidation** — `scanStream('merchant-portal:*:<userId>:*')` khi admin update
6. **Fee calc** — REUSE `FeeService.computeFeeForOrdersAggregate(tenantId, ...)`. Cross-tenant: pre-load configs qua `$in` query (port F-059) → loop per tenant
7. **Period extension** — thêm `'90d'` literal additive vào `period-resolver.ts`
8. **Atomic admin save** — SETNX `merchant-access-lock:<userId>` TTL 10s, release `try/finally` (port pattern timing-alert SETNX EX 900)
9. **Audit log** — reuse `AuditLogService.emit({ action: 'merchant_access.*', ... })`
10. **Excel** — reuse exceljs pattern từ `reconciliation/services/xlsx.service.ts`. Hard limit 10K rows.
11. **Logto lookup** — EXTEND `LogtoService` với `lookupByEmail` + cache wrap, REUSE `getUser()` cho ID lookup
12. **Cron pre-warm** — `@Cron(CronExpression.EVERY_5_MINUTES)` port pattern `DashboardAggregatorCron`

### Frontend (merchant-portal/)
1. **App scaffold** — port `admin/` config files
2. **Logto** — `@logto/next` (proven pattern admin)
3. **TanStack Query + generated SDK** — port `admin/src/lib/api-client.ts`
4. **i18n** — `next-intl` HOẶC custom `useTranslation()` + localStorage persist
5. **Charts** — Recharts, lazy-load chart pages
6. **Design tokens** — 5Solution palette `#1D49FF` + `#FF0E65` (theo memory `design_5solution_system.md`)
7. **Layout** — Sidebar 240px + Topbar 56px + Content `max-w-7xl`
8. **Runtime proxy** — port admin pattern
9. **Permission gate** — Server Component check role, `<PermissionGate>` wrapper Revenue page
10. **Excel download** — fetch blob → anchor href trigger + revoke URL
11. **AnStacked chart** — Recharts `Area` với `stackId` per courseId, legend toggle on/off
12. **Aggregate tenant selector** — Sidebar dropdown khi `user.tenantIds.length > 1`, persist selection

### Admin
1. Reuse `admin/src/components/ui/` shadcn/ui
2. AccessConfigDialog: Logto lookup button → call `/api/admin/merchant-portal/logto-lookup?q=`, handle 200/404/503/400 states
3. Cross-tenant warning banner conditional render `tenantIds.length > 1`
4. Hard delete confirm dialog destructive variant

---

## 🛑 PAUSE points cho Coder (FINAL R2)

Coder DỪNG confirm với Manager hoặc Danny TRƯỚC khi:

### Manager PAUSE
1. 🛑 TRƯỚC khi modify `period-resolver.ts` (BR-MP-25b — additive `'90d'`) — Manager spot-check + chạy F-062 regression
2. 🛑 TRƯỚC khi tạo collection MongoDB `merchant_portal_access` trên PROD (initial empty + indexes)
3. 🛑 TRƯỚC khi push CI workflow changes (BR-MP-28b TD-CI-001 mitigation) — Manager spot-check YAML
4. 🛑 TRƯỚC khi `pnpm install` package mới — CHỈ `next-intl` được phép. Coder phải xác minh các package khác (`@logto/next`, `exceljs`, `recharts`, `@hey-api/openapi-ts`) đã có trong root/admin/frontend
5. 🛑 TRƯỚC khi merge release/v* branch về main — verify CI workflow + Manager re-spot-check

### Danny PAUSE
6. 🛑 TRƯỚC khi setup Logto Dashboard (Danny manual): 2 role + 2 permission + 1 Web App. VERIFY M2M App đã có sẵn (env `LOGTO_M2M_APP_ID` đã có config schema từ F-XXX trước đó — nếu YES, skip M2M setup, chỉ confirm values .env)
7. 🛑 TRƯỚC khi GoDaddy DNS A record `merchant.5bib.com → 157.10.42.171`
8. 🛑 SAU khi `.env` set values cho `LOGTO_M2M_APP_ID` + `LOGTO_M2M_APP_SECRET` trên DEV + PROD (BR-MP-29 step 5 — verify mode, không phải setup mode)
9. 🛑 Phase 2 chart library scope decision (sau Phase 1 ship 2-4 tuần) — Danny duyệt 5 chart deferred backlog
10. 🛑 Fee rate badge UI edge case khi race chưa có order nào — Danny chốt "Chưa áp dụng phí" hay "{defaultRate}%" placeholder

---

## 🧪 Unit test BẮT BUỘC (Coder phải viết, QC sẽ check)

Coder KHÔNG được mark feature `READY_FOR_QC` nếu thiếu các test sau:

### `merchant-portal.service.spec.ts`
- [ ] `resolveAccessibleRaces()` — tenant scope only (raceOverrides empty) → return all non-draft races
- [ ] `resolveAccessibleRaces()` — with raceOverrides.include outside tenant → race outside tenant trong Set
- [ ] `resolveAccessibleRaces()` — with raceOverrides.exclude → race excluded KHÔNG trong Set
- [ ] `resolveAccessibleRaces()` — draft race của tenant → KHÔNG trong Set (BR-MP-05)
- [ ] `resolveAccessibleRaces()` — inactive user (`isActive=false`) → throw ForbiddenException `403_INACTIVE`
- [ ] `resolveAccessibleRaces()` — no config → throw NotFoundException `404_NO_CONFIG`
- [ ] `resolveAccessibleRaces()` — cache hit returns same Set, no Mongo query (spy)
- [ ] `getTicketSalesSummary()` — raceId thuộc accessibleRaces → return data
- [ ] `getTicketSalesSummary()` — raceId KHÔNG thuộc accessibleRaces → 403 `403_NO_RACE`
- [ ] `getTicketSalesSummary()` — response DTO KHÔNG có field `total_price`, `gmv`, `fee`, `net` (BR-MP-23)
- [ ] `getTicketSalesStacked()` ⭐ R2 — series structure với courses + counts per courseId
- [ ] `getTicketSalesStacked()` ⭐ R2 — series length đúng granularity (30d daily → 30; 90d weekly → 13)
- [ ] `getRevenueSummary()` — single-tenant happy path → response có `gmv`, `platformFee`, `netRevenue`, `feeRatePercent`, `manualFeePerTicket`, `feeRateSource` (R2 dual fee)
- [ ] `getRevenueSummary()` — verify `FeeService.computeFeeForOrdersAggregate()` được call với `{ tenantId, raceId }` filter (spy)
- [ ] `getRevenueSummary()` — math check: `netRevenue = gmv - platformFee`
- [ ] `getRevenueSummary()` — byCategory MANUAL.fee = `SUM(quantity) × manualFeePerTicket` (NOT `gmv × %`) (BR-MP-11 R2)
- [ ] `getRevenueSummary()` — byCategory có 3 entries kể cả count=0
- [ ] `getRevenueSummaryAggregate()` ⭐ R2 — cross-tenant per-tenant loop (verify FeeService call N times với spy)
- [ ] `getRevenueSummaryAggregate()` ⭐ R2 — response `isAggregate: true` + `byTenant[]` length === user.tenantIds.length
- [ ] `getRevenueSummaryAggregate()` ⭐ R2 — total aggregate = SUM(per-tenant)
- [ ] PeriodKind `'90d'` ⭐ R2 — buildDateFilter returns 90-day window
- [ ] Cache key isolation — user A vs user B cùng raceId → 2 key khác nhau

### `merchant-portal-access.service.spec.ts`
- [ ] `create()` — happy path → MongoDB insert + audit log emit + cache invalidate
- [ ] `create()` — duplicate userId → 409 ConflictException `409_DUPLICATE`
- [ ] `create()` — invalid tenantId (not in MySQL merchants) → 400 `400_INVALID_TENANT`
- [ ] `create()` — raceOverrides.exclude race ngoài tenant scope → 400
- [ ] `create()` — cross-tenant (tenantIds.length > 1) → audit `metadata.isCrossTenant = true`
- [ ] `create()` ⭐ R2 — concurrent 2 admin same userId → SETNX lock → 1 thắng 201, 1 trả 409 `409_CONCURRENT_EDIT`
- [ ] `create()` ⭐ R2 — lock released trong try/finally even on throw (verify second attempt sau 12s succeed)
- [ ] `update()` — happy path → audit log có `changes: { before, after }`
- [ ] `update()` — cache flush `scanStream('merchant-portal:*:<userId>:*')` được call
- [ ] `delete()` — hard delete + audit log emit BEFORE remove (TC-MP-24)

### `logto-merchant.guard.spec.ts` (port `logto-staff.guard.spec.ts`)
- [ ] Token role `merchant_viewer` → pass
- [ ] Token role `merchant_finance` → pass (inherit)
- [ ] Token scope `merchant:read` → pass
- [ ] Token role `admin` only (no merchant) → throw 403 `403_NO_ROLE`
- [ ] No token → 401
- [ ] Invalid/expired token → 401

### `logto-merchant-finance.guard.spec.ts`
- [ ] `merchant_finance` role → pass
- [ ] `merchant_viewer` role only → 403 `403_NO_FINANCE`
- [ ] `merchant:finance` scope → pass

### `logto.service.spec.ts` ⭐ R2 — EXTEND existing tests
- [ ] `lookupByIdWithCache()` ⭐ R2 — cache hit returns same data, KHÔNG hit Logto API (spy `getUser`)
- [ ] `lookupByEmail()` ⭐ R2 — happy path returns `{ userId, email, name, username }`
- [ ] `lookupByEmail()` ⭐ R2 — Logto API 404 → return `null`
- [ ] `lookupByEmail()` ⭐ R2 — Logto API 5xx → return `null` + log warn (graceful degrade)
- [ ] `lookupByEmail()` ⭐ R2 — cache 2nd call trong 300s returns cached
- [ ] M2M auth fail → throw InternalServerErrorException (existing pattern verify)

### `merchant-portal-export.service.spec.ts`
- [ ] Ticket sales Excel → parse, verify cột KHÔNG có field tài chính (TC-MP-15)
- [ ] Revenue Excel → parse, verify 3 sheet "Tổng quan" + "Breakdown" + "Xu hướng" (TC-MP-16)
- [ ] Row count > 10,000 → 400 `400_EXPORT_TOO_LARGE`
- [ ] UTF-8 BOM header — encoding test

### `period-resolver.spec.ts` ⭐ R2 (modify nếu tồn tại, tạo mới nếu chưa)
- [ ] `buildDateFilter('90d')` ⭐ → returns `{ from: now - 90d, to: now }`
- [ ] `resolveBucketSize('weekly')` default cho `'90d'`
- [ ] `buildMetricCacheKey('xxx', { ... }, '90d')` returns key chứa `90d`
- [ ] F-062 regression — chạy existing tests, verify pass (additive change không break)

**Frontend Component tests**: KHÔNG bắt buộc — QC sẽ Playwright E2E (9 E2E TC).

---

## 📊 Verdict

> ### ✅ APPROVED
>
> R2 addressed thorough cả 5 GAP LỚN + 3 MINOR Manager flag ở R1. 7/7 code reference verify đúng. 1 phát hiện POSITIVE (existing `LogtoService` đã có M2M wrapper) chỉ làm scope giảm, không block.
>
> PRD (R1+R2) hiện tại:
> - 37 BR có ID + testable
> - 35 TC + 9 E2E + 16 SEC + 18-row Performance SLA + 10 PAUSE
> - 2-layer IDOR + cache isolation + 3-tier guard pattern
> - Reuse architecture đúng (FeeService cascade + period-resolver + exceljs + LogtoService M2M)
> - Cross-tenant aggregate per-tenant loop với F-059 injectedConfig pattern
> - Dual fee display (% + VNĐ/vé) — không gây hiểu sai
> - Concurrent admin save SETNX lock
> - TD-CI-001 mitigation trong same PR
>
> Coder có thể `/5bib-code` ngay với 3 file artifact (01 R1 + part2 R1 + revision-r2 R2) + Scope Lock + 10 PAUSE points + unit test mandate trên.

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] **YES** — Coder có thể bắt đầu

Coder MUST đọc trước khi code:
1. `00-manager-init.md` — impact map + risk flag
2. `01-ba-prd.md` (R1) — BR-MP-01 → 35
3. `01-ba-prd-part2.md` (R1) — TC + E2E + SEC + Performance
4. `01-ba-prd-revision-r2.md` (R2) — 8 gap resolution + BR modify/extend + 10 TC mới + 1 E2E mới + 1 SEC mới + 8 PAUSE mới
5. `02-manager-plan.md` (file này, R2) — Scope Lock final + Tech approach + Unit test mandate + 1 POSITIVE CORRECTION cho BR-MP-36

---

## 🔗 Next step

Danny chạy: `/5bib-code FEATURE-069-merchant-reporting-portal`

Manager note cho Coder:
- Bám sát Scope Lock — out-of-scope đụng vào = STOP hỏi Manager
- 10 PAUSE points là HARD GATE — không phải khuyến nghị
- BR-MP-36 corrections: REUSE `logto.service.ts`, KHÔNG tạo file mới `logto-management.service.ts`
- AnStacked chart Phase 1 implementable, 5 chart còn lại Phase 2 — KHÔNG implement
- UI mockup 8 JSX file là reference VISUAL DESIGN — convert sang Tailwind + shadcn/ui + bilingual VN/EN từ ngày đầu
- Unit test 50+ test cases liệt kê trên là MINIMUM coverage — Coder thêm test boundary/edge case tùy nghi

---

# 📐 R3 RE-REVIEW — Data Layer Schema Correction (2026-06-05)

**Trigger:** Danny challenge "đã đọc structure DB chưa?" → Manager đọc DB thật → phát hiện 10 schema discrepancy → `TD-F069-PRD-DATALAYER-SCHEMA-MISMATCH` (BLOCKING M2b). BA viết `01-ba-prd-revision-r3.md` fix + query DB live (Danny cấp quyền MySQL readonly).

**Status:** ✅ **R3 APPROVED — M2b UNBLOCKED**

## 🔬 Manager independent verification (column-by-column — lần này KHÔNG chỉ signature)

Tao tự đọc 3 source of truth + đối chiếu 4 canonical SQL templates trong R3 vs DB thật:

| R3 SQL template | Verify vs proven schema | Verdict |
|---|---|---|
| Ticket summary | `om.race_id`✅ `r.tenant_id`✅ `oli.order_id=om.id`✅ `om.deleted=0`(bit, raw proven)✅ `om.payment_on`✅ `om.financial_status`✅ · `COUNT(DISTINCT om.id)`+`SUM(oli.quantity)` đúng (LEFT JOIN multiply handled) | ✅ |
| Course breakdown | chain `oli→om→tt→rc` đúng Source B (reconciliation-query.service.ts:112-115) · `tt.race_course_id`✅ `rc.race_id`✅ · `JOIN races r ON rc.race_id=r.race_id` cho tenant filter (đúng) | ✅ |
| Revenue GMV | `SUM(om.total_price - COALESCE(om.total_discounts,0))` (cả 2 float)✅ `financial_status='paid'`✅ aligned Source A `fee-aggregate.helpers.ts:84` + Source C `analytics.service.ts:354` | ✅ |
| Race list | `r.tenant_id`✅ `r.status != 'DRAFT'` (uppercase — DB confirmed value)✅ `r.is_delete=0` (bit raw, proven analytics:273 + time-to-fill:126) | ✅ |

**4/4 templates verified.** Value sets BA query live (financial_status: paid=35618/voided=9405/pending=1; races.status: COMPLETE/GENERATED_CODE/DRAFT/CANCEL/ONGOING; order_category: 8 values+null) = evidence trực tiếp production.

## ✅ 10 discrepancy resolution verdict
| # | R1 sai | R3 fix | Status |
|---|---|---|---|
| 1🔴 | `om.race_course_id` | course chain `oli→om→tt→rc` | ✅ |
| 2🔴 | `order_status` 6-enum | `financial_status` {paid/voided/pending} — DB confirmed | ✅ |
| 3🔴 | races.status pre_race/live/ended | MySQL {COMPLETE/GENERATED_CODE/DRAFT/CANCEL/ONGOING} + filter `!= 'DRAFT'` | ✅ |
| 4-10 | table/col names, tenant scope, date, FK | tất cả corrected + verified | ✅ |

## 🚧 2 product decision còn open (KHÔNG block schema — Danny chốt khi tới milestone)
- **BR-MP-12 category grouping** (R3 PAUSE-R3-03 resolved schema, nhưng display group): Danny chốt Option A (2 nhóm % vs cố định) hay raw 8-category — chốt ở **M2c** (revenue endpoints), KHÔNG cần cho M2b (ticket sales).
- **KPI "Chờ xử lý" card**: financial_status='pending' chỉ 1 đơn thực tế. UI vẫn render card (hiện 0 trong scope). Acceptable.

## 📋 M2b Scope Lock — Data Layer ADDENDUM (override R1/R2 data assumptions)
M2b Coder dùng **`01-ba-prd-revision-r3.md` canonical SQL templates** làm source of truth, KHÔNG copy SQL từ R1/R2. Raw `db.query()` qua named connection `'platform'`, parameterized `?` placeholder (KHÔNG string interpolation). Reuse `pullOrdersForFeeAggregate` (Source A) cho FeeService revenue. Tenant scope LUÔN `JOIN races r WHERE r.tenant_id IN (?) AND om.race_id IN (?)`.

## 🛑 M2b PAUSE points (giữ nguyên + thêm)
- 🛑 (carry-forward) Fix `TD-F069-M2a-UPDATE-AFTER-DELETE-RACE` FIRST trong M2b
- 🛑 Trước khi viết bất kỳ raw SQL nào — đối chiếu R3 canonical template, KHÔNG tự chế column name
- 🛑 Bit field comparison: dùng `= 0` raw (proven) — KHÔNG cần CAST trong raw query

## 🪞 Manager self-critique (lesson encoded)
Tao APPROVE R2 ở `/5bib-plan` mà verify fee.service **signature** nhưng KHÔNG đọc **data source schema column-by-column** → 10 discrepancy lọt qua. Defense-in-depth gap. Nếu Danny không challenge → M2b code theo PRD as-is → query fail toàn bộ. **Lesson đã ghi vào `conventions.md` + `known-issues.md`:** Manager `/5bib-plan` MUST verify data source schema column-by-column (entity + proven SQL) khi PRD đụng MySQL platform tables, KHÔNG chỉ signature.

## 🔗 Next step (R3)
Danny chạy `/5bib-code FEATURE-069 M2b`. Coder đọc thứ tự: R1 + R2 (auth/UX) + **R3 (data layer VERIFIED — override)**. First task M2b = fix update-after-delete race, rồi `resolveAccessibleRaces` + ticket-sales endpoints dùng R3 canonical SQL.
