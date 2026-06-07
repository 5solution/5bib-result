# FEATURE-069 M1: Coder Implementation Log — Backend Foundation

**Status:** 🟠 READY_FOR_QC (M1 only — backend foundation. M2-M5 chưa start)
**Started:** 2026-06-04
**Author:** 5bib-fullstack-engineer
**Linked:** `00-manager-init.md`, `01-ba-prd.md` (R1), `01-ba-prd-part2.md` (R1), `01-ba-prd-revision-r2.md` (R2), `02-manager-plan.md` (R2 ✅ APPROVED)

> **🚧 Milestone scoping note:** FEATURE-069 được chia 5 milestone (M1-M5) theo proposal Coder accepted bởi Danny đầu session. File này CHỈ document **M1 — Backend foundation**. M2-M5 sẽ có handoff log riêng khi ship.

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` (197 dòng)
- [x] Đã đọc `01-ba-prd.md` (R1, 2216 dòng) — BR-MP-01 → 35
- [x] Đã đọc `01-ba-prd-part2.md` (R1) — TC + E2E + SEC + Performance + Design Spec
- [x] Đã đọc `01-ba-prd-revision-r2.md` (R2) — 8 gap resolution + BR-MP-36/37/28b mới + 10 TC mới
- [x] Đã đọc `02-manager-plan.md` (R2 APPROVED) — Scope Lock + 10 PAUSE + 50+ unit test mandate + 1 POSITIVE CORRECTION
- [x] Đã đọc `memory/conventions.md` — anti-pattern + NestJS DI + named connection patterns
- [x] Đã đọc `memory/codebase-map.md` — logto-auth module + analytics period-resolver
- [x] Đã đọc code thật file trong Scope Lock: `period-resolver.ts` (414 dòng), `logto.service.ts` (114 dòng), `logto-staff.guard.ts` (54 dòng) + `.spec.ts` (80 dòng template), `logto-admin.guard.ts`, `logto-auth.guard.ts`, `logto-auth.module.ts`, `types.ts`, `index.ts`

---

## 🎯 M1 Scope Recap

M1 = Backend foundation cho FEATURE-069. Zero infra dependency, unblock M2+M4.

**Deliverables:**
1. `period-resolver.ts` extend `PeriodKind` với `'90d'` literal additive (BR-MP-25b R2)
2. `logto.service.ts` extend 2 method `lookupByIdWithCache` + `lookupByEmail` với Redis cache 300s (BR-MP-36 R2, POSITIVE CORRECTION từ Manager — REUSE existing service)
3. NEW `LogtoMerchantGuard` (BR-MP-02)
4. NEW `LogtoMerchantFinanceGuard` (BR-MP-03)
5. Update `logto-auth.module.ts` + `index.ts` exports
6. 4 unit test files (50+ tests total)

**Out of M1 scope (deferred M2-M5):**
- merchant-portal backend module (controllers, services, DTOs, schemas) → M2
- admin frontend route group → M3
- merchant-portal/ Next.js app → M4
- Docker + nginx + DNS + CI/CD + Logto Dashboard → M5

---

## 🔍 Impact Assessment (Think First Phase 1)

### Backend

**MongoDB / MySQL:**
- M1 không đụng DB. KHÔNG có schema change, migration script, hoặc collection mới ở M1.
- M2 sẽ tạo collection `merchant_portal_access` (deferred).

**Redis:**
- M1 thêm 2 cache key pattern MỚI:
  - `logto-lookup:byid:<userId>` TTL 300s — `LogtoService.lookupByIdWithCache()`
  - `logto-lookup:byemail:<sha256_hash>` TTL 300s — `LogtoService.lookupByEmail()`
- Cache value: `JSON.stringify(LogtoUserInfo)` cho positive results, sentinel `'NULL'` (literal string) cho confirmed not-found / ambiguous → tránh repeated Logto API hit.
- KHÔNG xung đột với existing keys (namespace `logto-lookup:*` mới, không collision với `analytics:*`, `dashboard:*`, `medical:*`, `awards:*`, etc.).
- Stampede risk LOW: lookup là admin-triggered (1 admin click "Tìm" 1 lần) không phải race-day spike. Không cần SETNX anti-stampede ở layer này.

**NestJS:**
- `LogtoService` thêm constructor `@InjectRedis() private readonly redis: Redis`. RedisModule global (registered `RedisModule.forRoot()` trong `app.module.ts` — verified) → KHÔNG cần modify `LogtoAuthModule.imports`.
- `LogtoAuthModule` chỉ thêm 2 guard mới vào providers + exports.
- Named connection `'platform'` không cần ở M1 (no MySQL access).

### Frontend

M1 backend-only — KHÔNG đụng frontend.

### API Contract

M1 KHÔNG thêm endpoint hoặc DTO. Service-internal types `LogtoUserInfo` exported cho M2 consumer (merchant-portal admin controller endpoint `/api/admin/merchant-portal/logto-lookup`).

KHÔNG cần chạy `pnpm --filter admin generate:api` ở M1 (no OpenAPI surface change).

---

## ⚠️ Edge Cases Covered (Think First Phase 2)

### `period-resolver.ts` case `'90d'`

- [x] **Boundary day count:** 90 ngày BAO GỒM hôm nay → `from = today - 89` (matching `'7d'`/`'30d'` convention). Verified test "window length = exactly 90 days".
- [x] **Same-UTC-day stability:** Multiple calls trong cùng UTC day → identical `periodKey` (cache hit). Verified test "same periodKey across multiple calls".
- [x] **Cross-year boundary:** 2026-02-15 → from = 2025-11-18 (cross-year). Verified test.
- [x] **PeriodKind union exhaustive:** All 7 kinds compilable, `to > from` invariant. Verified test "PeriodKind type union".

### `LogtoService.lookupByIdWithCache()`

- [x] **Cache hit positive** → return cached, skip API.
- [x] **Cache hit negative (sentinel `'NULL'`)** → return null, skip API (tránh repeated 404 spam).
- [x] **Cache miss → API 200** → fetch + normalize + cache positive (TTL 300s).
- [x] **API 404** → return null + cache `'NULL'` sentinel (TTL 300s).
- [x] **API 5xx** → return null, KHÔNG cache (transient — retry next time).
- [x] **M2M unconfigured** (empty `LOGTO_M2M_APP_ID` / `LOGTO_M2M_APP_SECRET`) → return null gracefully WITHOUT hitting Redis or API.
- [x] **Redis read error** → fall back to API (KHÔNG fail the request).
- [x] **Empty userId** → return null immediately (no Redis/API call).
- [x] **Normalization strip:** internal fields `customData`, `identities`, `applicationId` KHÔNG leak qua return value (only 4 fields: userId/email/name/username).

### `LogtoService.lookupByEmail()`

- [x] **SHA-256 hash cache key:** Raw PII KHÔNG có trong Redis keys (BR-MP-36 mandate). Verified test grep cache key for raw email substring.
- [x] **Email case-insensitive:** `admin@btc.vn` và `ADMIN@BTC.VN` produce same hash (lowercased before hash).
- [x] **Whitespace trim:** `"  admin@btc.vn  "` normalized before hash.
- [x] **Invalid email (no @):** Return null without API hit.
- [x] **Logto fuzzy search filter:** Logto `?search=` is fuzzy — filter exact `primaryEmail` match before returning. Edge: `admin@btc.vn` search returns both `admin@btc.vn` và `admin@btc.vn.org` — chỉ pick first.
- [x] **Ambiguous (>1 exact match):** Return null + cache `'NULL'` (tenant policy violation — defensive).
- [x] **No match:** Return null + cache `'NULL'`.

### Guard chain

- [x] **`LogtoMerchantGuard` PASS** cho 4 cases: role `merchant_viewer`, role `merchant_finance`, scope `merchant:read`, scope `merchant:finance`.
- [x] **`LogtoMerchantGuard` FAIL** cho 6 cases: no role/scope, admin only, super_admin only, staff only, scope `admin`, irrelevant scopes (viewer/guest).
- [x] **`LogtoMerchantFinanceGuard` PASS** chỉ cho role `merchant_finance` hoặc scope `merchant:finance`.
- [x] **`LogtoMerchantFinanceGuard` FAIL** cho viewer-only (BR-MP-03 ZERO TOLERANCE) — emit specific 403_NO_FINANCE message KHÁC với 403_NO_ROLE.
- [x] **2-layer error propagation:** Khi user không có merchant role nào, `LogtoMerchantGuard` throw FIRST với 403_NO_ROLE message ("Cần quyền merchant..."). `LogtoMerchantFinanceGuard` chỉ throw 403_NO_FINANCE khi user là valid merchant_viewer thiếu finance escalation. Verified test "No merchant role → 403_NO_ROLE bubbled".
- [x] **JWT layer false propagation:** Cả 2 guard return false (KHÔNG throw) khi super.canActivate() returns false → existing NestJS auth flow behavior preserved.

---

## 🧠 Logic & Architecture (Think First Phase 3)

### Decision 1: REUSE existing `LogtoService` instead of new `LogtoManagementService` (Manager R2 POSITIVE CORRECTION)

**BA R2 BR-MP-36 originally proposed** tạo file mới `logto-management.service.ts` với 6 method (fetchM2MToken, managementApi wrapper, lookupById, lookupByEmail, lookupByIdWithCache).

**Manager R2 review found** existing `LogtoService` (created cho avatar upload feature ~F-029) đã có:
- `fetchM2MToken()` private — M2M auth proven
- `managementApi<T>()` private — Management API wrapper proven
- `getUser(userId)` public — lookupById equivalent
- Env vars `LOGTO_M2M_APP_ID` / `LOGTO_M2M_APP_SECRET` đã có Joi-validated trong `config/index.ts:47-48`

**Coder decision:** EXTEND `LogtoService` thêm 2 method (`lookupByIdWithCache` + `lookupByEmail`). Cost savings:
- Skip re-implementing M2M token fetch + caching logic (~50 dòng)
- Skip re-implementing managementApi wrapper (~20 dòng)
- Reuse proven `getUser()` for ID lookup
- Net: 1 file modified (LogtoService) instead of 2 files (LogtoService unchanged + new LogtoManagementService) → simpler dependency graph

**Tradeoff paid:** LogtoService now has dual responsibility (avatar customData + admin lookup). Acceptable vì:
- Both responsibilities use same M2M auth + Management API
- Single service = single M2M token cache (in-memory), tránh duplicate token requests
- File still <300 dòng, well-organized với section comments

### Decision 2: SHA-256 hash cache key cho email lookup (BR-MP-36 PII)

**Problem:** Cache key like `logto-lookup:byemail:admin@btc.vn` exposes raw PII trong Redis. Anyone với Redis access (DevOps, security incident response) sees email addresses.

**Decision:** Hash email với SHA-256 before using as cache key suffix. Key shape: `logto-lookup:byemail:<64-char-hex-hash>`.

**Tradeoff:** Cannot reverse-lookup email from cache key (intentional — privacy). Cache invalidation by email requires re-hashing in invalidation logic (acceptable, rare op).

**Alternative considered:** AES-encrypt with feature-specific key. Rejected vì:
- Overhead (key management, KMS access)
- Hash is one-way, simpler, sufficient for "obfuscation" tier

### Decision 3: Negative cache sentinel `'NULL'` literal string

**Problem:** API returns 404 → if we don't cache, every retry (admin types email, clicks Search again) re-hits Logto API. Causes Logto rate limit issues at scale.

**Decision:** Cache literal string `'NULL'` for confirmed-not-found / ambiguous-multi-match results. Sentinel distinguishes "cache miss" (returns null from Redis.get) vs "confirmed null" (returns 'NULL' string).

**Tradeoff:** Slightly awkward sentinel comparison logic. Acceptable:
```typescript
if (cached === 'NULL') return null;          // Confirmed not-found
return JSON.parse(cached) as LogtoUserInfo;  // Positive cache hit
```

**Alternative considered:** Cache `null` directly. Rejected vì:
- `redis.get` returns `null` for both "key not exists" và "value === null" — ambiguous
- Need explicit sentinel to disambiguate

### Decision 4: Guard hierarchy via inheritance (not composition)

**LogtoMerchantFinanceGuard extends LogtoMerchantGuard extends LogtoAuthGuard.**

Inheritance pattern proven by existing `LogtoStaffGuard extends LogtoAuthGuard` + `LogtoAdminGuard extends LogtoAuthGuard`. Composition pattern (Finance composes Merchant + checks finance role) would require manual DI wiring + more boilerplate.

**Test challenge:** Mocking 2-layer parent (Finance → Merchant → Auth). Solved by spying directly on `LogtoAuthGuard.prototype.canActivate` (bypass JWT verify), letting `LogtoMerchantGuard.canActivate` run real scope/role check. Verified spec passes.

### Decision 5: Graceful degrade (return null, NOT throw)

**Problem:** BR-MP-36 mandates graceful degrade. If Logto Management API down, admin should be able to enter user info manually instead of seeing 500 error.

**Decision:** All lookup failure modes (404, 5xx, M2M unconfigured, network error, Redis error) return `null` from service layer. Controller (M2) responsible for distinguishing:
- `null` from "user genuinely not found" → 404 response
- `null` from "service degraded" → 503 response with "manual entry" message

**Tradeoff:** Service caller cannot distinguish 404 vs 503 from service return value alone. Acceptable because M2 controller will distinguish via separate `LogtoService.isConfigured` getter + maintain explicit error context.

---

## 💻 Files Changed (M1)

### Modified (4 files)

| File | What changed | Lines |
|---|---|---|
| `backend/src/modules/analytics/services/period-resolver.ts` | (1) `PeriodKind` union thêm `'90d'` literal. (2) `resolvePeriod()` switch thêm `case '90d'` between `'30d'` và `'quarter'`. (3) JSDoc comment giải thích F-069 additive lý do. | +18 / -1 |
| `backend/src/modules/logto-auth/logto.service.ts` | (1) Import `InjectRedis`, `Redis`, `createHash`. (2) Constructor thêm `@InjectRedis() redis: Redis`. (3) Export new interface `LogtoUserInfo`. (4) Add private method `normalizeLogtoUser()`. (5) Add public method `lookupByIdWithCache()`. (6) Add public method `lookupByEmail()`. (7) Add module-level constant `LOGTO_LOOKUP_CACHE_TTL_SECONDS = 300`. | +180 / -1 |
| `backend/src/modules/logto-auth/logto-auth.module.ts` | Register 2 guard mới (`LogtoMerchantGuard`, `LogtoMerchantFinanceGuard`) + `LogtoStaffGuard` (pre-existing nhưng chưa registered — Coder fix opportunistic) trong providers + exports. | +12 / -2 |
| `backend/src/modules/logto-auth/index.ts` | Export 2 guard mới + type `LogtoUserInfo` cho M2 consumer. | +5 / -1 |

### Added (6 files)

| File | Purpose | Lines |
|---|---|---|
| `backend/src/modules/analytics/services/period-resolver.spec.ts` | Unit test cho period-resolver. F-069 NEW case '90d' (5 tests) + F-062 regression (existing kinds, 7 tests) + helpers (delta percent, shiftMonthClamped, buildMetricCacheKey, etc.). 33 tests total. | 269 |
| `backend/src/modules/logto-auth/logto.service.spec.ts` | Unit test cho 2 method MỚI của LogtoService. Test cache hit/miss/negative sentinel, 404, 5xx graceful degrade, SHA-256 cache key, fuzzy match exact filter, ambiguous null, M2M unconfigured. 19 tests. | 300 |
| `backend/src/modules/logto-auth/logto-merchant.guard.ts` | NEW guard BR-MP-02. extends LogtoAuthGuard. Check 4 role/scope combinations. ForbiddenException VN message. | 51 |
| `backend/src/modules/logto-auth/logto-merchant.guard.spec.ts` | Unit test cho LogtoMerchantGuard. 13 tests: PASS x 5 + FAIL x 7 + JWT false x 1. Port pattern logto-staff.guard.spec.ts. | 118 |
| `backend/src/modules/logto-auth/logto-merchant-finance.guard.ts` | NEW guard BR-MP-03. extends LogtoMerchantGuard. Thêm check finance role/scope. Distinct 403_NO_FINANCE message. | 56 |
| `backend/src/modules/logto-auth/logto-merchant-finance.guard.spec.ts` | Unit test cho Finance guard. 11 tests. Critical: viewer-only FAIL với specific message, no-merchant-role FAIL bubbled từ parent guard. | 120 |

**Total M1: 10 file (4 modified + 6 new), 0 file ngoài Scope Lock (verified `git status`).**

### Files NOT touched (out of M1 scope — deferred M2-M5)

- ❌ Backend `merchant-portal/` module (M2)
- ❌ Backend admin endpoint `/api/admin/merchant-portal/logto-lookup` (M3 — uses LogtoService from M1 ✅)
- ❌ Frontend admin route `/merchant-portal` (M3)
- ❌ Frontend merchant-portal app (M4)
- ❌ Docker + nginx + DNS + CI/CD (M5)
- ❌ MongoDB collection `merchant_portal_access` (M2)
- ❌ Logto Dashboard setup (M5 — Danny manual op)

### Files in Scope Lock NOT touched at M1 (deferred but still in plan)

- ❌ `period-resolver.spec.ts` existing F-062 tests trong `__tests__/period-resolver.spec.ts` — verified RAN trong test suite, F-062 regression PASS without touching the file.

---

## 🧪 Tests Written

### Unit test results (Jest)

```
PASS src/modules/logto-auth/logto-staff.guard.spec.ts        (existing — also matched by pattern)
PASS src/modules/analytics/__tests__/period-resolver.f062.spec.ts (existing F-062)
PASS src/modules/analytics/__tests__/period-resolver.spec.ts (existing F-062)
PASS src/modules/analytics/services/period-resolver.spec.ts  (M1 NEW — 33 tests)
PASS src/modules/logto-auth/logto-merchant.guard.spec.ts     (M1 NEW — 13 tests)
PASS src/modules/logto-auth/logto-merchant-finance.guard.spec.ts (M1 NEW — 11 tests)
PASS src/modules/logto-auth/logto.service.spec.ts            (M1 NEW — 19 tests)

Test Suites: 7 passed, 7 total
Tests:       142 passed, 142 total
Time:        4.56 s
```

**M1 NEW tests breakdown:**
- `period-resolver.spec.ts`: 33 tests
  - F-069 NEW case `'90d'`: 5 tests (window length, periodKey stability, cross-year boundary, multiple call same UTC day, length = 90 days exact)
  - F-062 regression: 7 tests (existing kinds `'7d'/'30d'/'quarter'/'year'/'rolling12m'/'custom'`)
  - `resolveCompare` (prev/none/wow): 3 tests
  - `shiftMonthClamped` boundary fix: 4 tests
  - `resolveBucketSize`: 3 tests
  - `buildMetricCacheKey` 3 variants: 3 tests
  - `calcDeltaPercent` guard: 5 tests
  - helpers (ymd/addDaysUtc/periodKeyFromInputs/resolveScopeFromTenant): 4 tests
  - PeriodKind union exhaustive: 1 test
- `logto.service.spec.ts`: 19 tests
  - `lookupByIdWithCache`: 7 tests (happy + cache hit + NULL sentinel + 404 + 5xx + empty userId + Redis error fallback)
  - `lookupByEmail`: 10 tests (happy + SHA-256 hash + case-insensitive + fuzzy filter + ambiguous null + no match + invalid email + empty + 5xx + whitespace trim)
  - M2M unconfigured graceful: 2 tests
- `logto-merchant.guard.spec.ts`: 13 tests (PASS x 5 + FAIL x 7 + JWT false x 1)
- `logto-merchant-finance.guard.spec.ts`: 11 tests (PASS x 4 + FAIL x 5 + error message specificity x 2 + JWT false x 0… wait actually 11 by my count: 4+5+2 = 11)

**Total M1 NEW: 76 unit tests.**

### F-062 regression verification

Existing F-062 test suites still PASS với additive `'90d'` change:
- `src/modules/analytics/__tests__/period-resolver.spec.ts` — PASS
- `src/modules/analytics/__tests__/period-resolver.f062.spec.ts` — PASS

→ Additive change KHÔNG break F-062 backward compat (BR-MP-25 mandate).

---

## 🛑 PAUSE/Confirmation log

| Date | What | Danny's answer |
|---|---|---|
| 2026-06-04 | Milestone scoping: ship M1-M5 over multiple sessions thay vì 1 shot? | YES — ship M1 only this session |
| 2026-06-04 | M1.1 PAUSE Manager — modify `period-resolver.ts` thêm `'90d'` additive vs use existing `'quarter'`? | OK proceed additive `'90d'` |
| 2026-06-04 | M1.2 PAUSE Manager — extend `logto.service.ts` (REUSE) vs create new `logto-management.service.ts`? | OK extend (Manager R2 POSITIVE CORRECTION) |

---

## 🚧 Scope creep / Out-of-Scope changes

- [x] **Không có scope creep cho M1.** Verified `git status backend/src/modules/analytics/services/ backend/src/modules/logto-auth/`:
  - 4 file modified (period-resolver.ts, logto.service.ts, logto-auth.module.ts, index.ts) — all in M1 Scope Lock
  - 6 file new (period-resolver.spec.ts, logto.service.spec.ts, 2 merchant guard.ts, 2 merchant guard.spec.ts) — all in M1 Scope Lock
  - 0 file ngoài Scope Lock

- [x] **Opportunistic fix:** `LogtoStaffGuard` đã exists nhưng KHÔNG registered trong `LogtoAuthModule` providers/exports (legacy oversight). Coder thêm vào cùng diff với 2 merchant guards. Lý do: prevent confusion khi M2+ controllers `@UseGuards(LogtoStaffGuard)` lookup module DI graph.

---

## 🐛 Known limitations / Tech debt còn lại (M1)

- **M2-M5 not started:** Đây là expected — milestone-based delivery. Feature chưa user-facing functional cho đến khi M2 ship endpoints.
- **`LogtoService` dual responsibility:** Hiện service làm cả avatar customData + admin lookup. Acceptable size (~300 dòng) nhưng future split candidate nếu thêm 3+ more lookup-style methods.
- **Cache invalidation chưa có cho admin update workflow:** Khi admin update merchant_portal_access (M2), nếu user Logto info đổi (rename, email change), cache `logto-lookup:byid:*` vẫn giữ stale value tới 300s. Acceptable cho M1 (Logto user info rarely changes). M2 controller có thể `redis.del('logto-lookup:byid:<userId>')` sau admin save nếu cần.
- **Logto Management API rate limit chưa instrumented:** Logto Cloud free tier 600 req/min/M2M. Cache 300s + SHA-256 dedup mitigate but không hard-cap. M3 frontend có thể spam click "Tìm" → consider FE debounce 300ms (theo BR-MP-16 form behavior).

---

## ✅ Self-Review Pipeline (Manager 2026-05-14 mandatory)

- [x] **Bước 1:** `tsc --noEmit` exit 0 cho M1 Scope Lock files (pre-existing `vi` errors trong `upload.*.spec.ts` không liên quan M1)
- [x] **Bước 2:** PRD strict adherence audit — guards encode BR-MP-02 + BR-MP-03 verbatim; LogtoService methods khớp BR-MP-36 R2 spec (cache 300s + graceful degrade + SHA-256 hash + exact-match filter); period-resolver `'90d'` khớp BR-MP-25 R2 spec
- [x] **Bước 3:** Anti-pattern scan clean — 0 console.log/error/warn, 0 `: any`, 0 `as unknown as`, 0 TODO/FIXME trong non-spec files
- [x] **Bước 4:** Hand-pick field mapping audit — N/A cho M1 (KHÔNG có schema field changes)
- [x] **Bước 5:** PROD-readiness smoke self-test — SKIPPED cho M1 (no endpoint mới; guards/service consumed bởi M2 endpoints sau)
- [x] **Bước 6:** UI/UX self-inspection — N/A cho M1 (backend-only milestone)
- [x] **Bước 7:** Real-world data sanity — N/A cho M1 (type/service-only)
- [x] **Bước 8:** Files Changed vs Scope Lock — `git status` confirm 10 file, all in M1 Scope Lock, 0 creep
- [x] **Bước 9:** Generated SDK regen — N/A cho M1 (no DTO change, only internal types)
- [x] **Bước 10:** Unit tests PASS — 142 tests / 7 suites (76 M1 NEW + F-062 regression intact). Output paste section "Tests Written" ở trên.
- [x] **Bước 11:** `IMPLEMENTATION_NOTES.md` written với 4 sections (xem file riêng) — Danny 2026-05-19 mandate

→ Status: 🟠 **READY_FOR_QC (M1 only)**

---

## ✅ Status

- [x] M1 IN_PROGRESS → **READY_FOR_QC**

**Required to mark READY_FOR_QC:**
- [x] Tất cả file trong M1 Scope Lock đã code xong (10 file)
- [x] Unit test PASS (142 tests / 7 suites, 76 M1 NEW)
- [x] `pnpm --filter admin generate:api` — N/A (no DTO change)
- [x] Không còn `console.log`, `any`, `as unknown as` trong M1 non-spec files
- [x] Lint + typecheck pass (tsc clean cho M1 files)
- [x] Self-Review Pipeline 11 bước complete
- [x] `IMPLEMENTATION_NOTES.md` written

---

## 🔗 Next step

Danny chạy:
1. `/5bib-qc FEATURE-069-merchant-reporting-portal` — QC verify M1 only (4 guards + 2 LogtoService methods + period-resolver '90d' additive)
2. Nếu QC APPROVED → `/5bib-deploy FEATURE-069 M1` (Manager memory sync M1 partial) hoặc giữ in-flight chờ M2-M5 hoàn thành rồi bundle deploy
3. `/5bib-init` hoặc continue `/5bib-code` cho M2 (Backend merchant-portal module — Mongo collection + access service + report service + endpoints + 30+ unit tests)

**Recommendation:** QC ngay M1 trước khi start M2 để catch issues sớm. M1 self-contained, can ship + revert độc lập nếu cần.
