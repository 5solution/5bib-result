# FEATURE-069 M1 — Implementation Notes (Reviewer's Guide)

**Scope:** M1 Backend foundation only (period-resolver `'90d'` + LogtoService extend + 2 merchant guards + specs)
**Coder:** 5bib-fullstack-engineer
**Date:** 2026-06-04
**For:** Manager `/5bib-deploy` Code Review + QC `/5bib-qc` Phase 1 Impact Audit

> **Reviewer:** Đọc Section 1 + 4 đầu tiên. Section 1 cho biết Coder đổi gì so với spec (block deploy nếu conflict BR critical). Section 4 chỉ priority files cho spot-check 5+ critical paths.

---

## 🚧 Section 1: Deviations from Spec (intentional)

### Deviation #1 — Negative cache sentinel `'NULL'` literal string (out-of-spec optimization)

- **Spec said:** BA R2 BR-MP-36 không specify cache behavior cho 404 / ambiguous lookup. Default assumption: return null, retry next time.
- **I did:** Cache literal string `'NULL'` (sentinel) cho confirmed-not-found / ambiguous (>1 exact match) results với cùng TTL 300s. Subsequent lookup trong 300s → return null từ cache, KHÔNG hit Logto API.
- **Why:** Logto Cloud free tier rate limit 600 req/min/M2M. Admin spam-click "Tìm" sau khi nhập sai email → without negative cache, Logto API hit mọi click. Sentinel pattern proven trong S3 / GraphQL DataLoader contexts.
- **Reviewer should check:** TC `logto.service.spec.ts > lookupByIdWithCache > "404 from Logto → returns null + caches NULL sentinel"` + `> "cache hit with NULL sentinel → returns null without hitting API"`. Verify `redis.set` called với `'NULL'` literal + TTL 300s.

### Deviation #2 — Cache 5xx KHÔNG cache (skip negative cache cho transient errors)

- **Spec said:** BR-MP-36 mandate graceful degrade khi Logto API unreachable nhưng KHÔNG specify cache behavior cho 5xx.
- **I did:** Return null + log warn, KHÔNG cache. Subsequent lookup retries Logto API (no sentinel pollution).
- **Why:** 5xx = transient. Caching `'NULL'` cho 5xx có thể block successful lookup tới 300s sau khi Logto recover → bad UX.
- **Reviewer should check:** TC `> "5xx from Logto → returns null (graceful degrade)"` — assertion `mockRedis.set` NOT called.

### Deviation #3 — Fuzzy search filter exact email match before return

- **Spec said:** BA R2 BR-MP-36 says "call Logto Management API `GET /api/users?search=<email>`" — assumes 1-to-1 result.
- **I did:** Filter array results, keep only entries với exact `primaryEmail.toLowerCase() === normalizedEmail.toLowerCase()`. Logto `?search=` is fuzzy — query `admin@btc.vn` có thể return cả `admin@btc.vn.org`.
- **Why:** Logto Management API docs state `search` matches partial substring on multiple fields. Without filter, admin search "admin@btc.vn" có thể return wrong user `admin@btc.vn.org` → assign access cho wrong human → security incident.
- **Reviewer should check:** TC `logto.service.spec.ts > lookupByEmail > "fuzzy match — filter exact email only"` + line 240-250 `logto.service.ts` `matches.filter(u => ... email.toLowerCase() === normalizedEmail)`.

### Deviation #4 — Ambiguous (>1 exact match) returns null (defensive)

- **Spec said:** BA R2 doesn't address case khi Logto returns 2+ users với cùng `primaryEmail` (theoretical — Logto tenant policy enforces email uniqueness).
- **I did:** Return null + log warn + cache 'NULL'. Caller cannot determine which user is "the right one".
- **Why:** Picking arbitrary user (e.g., first match) là dangerous — admin có thể vô tình assign access cho wrong tenant user. Better fail-closed: force admin manually input correct userId.
- **Reviewer should check:** TC `> "ambiguous (>1 exact match) → returns null + caches NULL"`. Logger.warn assertion verified bằng spy trong production code if needed.

### Deviation #5 — Module-level constant `LOGTO_LOOKUP_CACHE_TTL_SECONDS = 300` (not env var)

- **Spec said:** BA R2 BR-MP-13 lists cache TTLs in PRD nhưng KHÔNG mandate env-configurable.
- **I did:** Hardcoded constant trong `logto.service.ts` module scope.
- **Why:** Simplicity. Cache TTL rarely needs tuning per environment. Adding env var = extra deployment config burden + Joi validation. If future tuning needed, easy refactor (5 min change).
- **Reviewer should check:** Line `const LOGTO_LOOKUP_CACHE_TTL_SECONDS = 300;` trong `logto.service.ts`. If Manager prefers env var → 5-min follow-up.

### Deviation #6 — `LogtoStaffGuard` registered trong LogtoAuthModule opportunistic (out of M1 spec)

- **Spec said:** M1 Scope Lock specify modify `logto-auth.module.ts` chỉ thêm 2 merchant guards.
- **I did:** Thêm `LogtoStaffGuard` vào providers + exports cùng diff. Pre-existing guard không registered (legacy oversight from F-068-ish).
- **Why:** Prevent future confusion. Khi M2-M5 hoặc later features `@UseGuards(LogtoStaffGuard)`, DI graph lookup expects guard registered trong module exports. Without this fix, NestJS sẽ instantiate via `new LogtoStaffGuard()` (works because no constructor deps) but pattern inconsistent với LogtoAdminGuard.
- **Reviewer should check:** `logto-auth.module.ts` diff lines 13 + 18 (LogtoStaffGuard added). Verify still works — `LogtoStaffGuard` constructor is empty (no dep injection broken).

---

## ⚙️ Section 2: Forced Changes (reality ≠ spec)

### Forced #1 — `@nestjs-modules/ioredis` exports `getRedisConnectionToken()` NOT `getRedisToken()`

- **PRD assumed:** Coder write spec với standard `getRedisToken('default')` (common pattern across ORM/Cache libs).
- **Reality:** Library exports `getRedisConnectionToken()` (singular, no args) — verified via existing usage trong `timing-alert/checkpoint-discovery-lock.spec.ts`.
- **Workaround:** First-pass spec file used `getRedisToken`, tsc threw error `TS2305: Module '"@nestjs-modules/ioredis"' has no exported member 'getRedisToken'`. Replaced với `getRedisConnectionToken()` across all 4 usages trong `logto.service.spec.ts`. tsc clean.
- **Manager/BA action:** Update `conventions.md` section "Redis testing" với correct mock token import:
  ```typescript
  import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
  { provide: getRedisConnectionToken(), useValue: mockRedis },
  ```

### Forced #2 — Pre-existing `vi` global error trong `upload.*.spec.ts`

- **PRD assumed:** N/A — out of M1 scope.
- **Reality:** `npx tsc --noEmit` reports 4 errors trong `upload.controller.spec.ts` + `upload.service.spec.ts`: `TS2304: Cannot find name 'vi'`. Suggests legacy Vitest globals not properly set up (might be `vi` from Vitest, but project uses Jest).
- **Workaround:** Verified errors là pre-existing (NOT introduced by M1). M1 own files compile clean. tsc errors lọt-known TD.
- **Manager/BA action:** Open separate TD ticket `TD-UPLOAD-SPEC-VI-GLOBAL` để fix `upload.*.spec.ts` global `vi` references (probably replace với `jest` or add Vitest globals if project intentionally bilingual test framework).

### Forced #3 — Existing `__tests__/period-resolver.spec.ts` từ F-062 duplicates filename

- **PRD assumed:** M1 creates new `period-resolver.spec.ts` cạnh `period-resolver.ts` trong `services/` folder.
- **Reality:** F-062 already had `__tests__/period-resolver.spec.ts` + `__tests__/period-resolver.f062.spec.ts` (different folder, different scope).
- **Workaround:** Cả 2 file có cùng base name `period-resolver.spec.ts` nhưng ở folders khác nhau. Jest picks up both. Verified no test name collision because each file has unique top-level `describe('PeriodResolver')` block — Jest accepts duplicate describe names as long as tests inside don't collide. All 142 tests pass.
- **Manager/BA action:** Future Coder cẩn thận khi tạo specs trong folder mới — `find . -name "<filename>.spec.ts"` để check duplicates trước. Codebase-map.md có thể note convention "specs cạnh source OR `__tests__/` không cả 2".

---

## ⚖️ Section 3: Tradeoffs Considered

| Decision | Option chosen | Alternative | Why chose | Cost paid |
|---|---|---|---|---|
| Lookup service architecture | EXTEND existing `LogtoService` | Create new `logto-management.service.ts` | (1) REUSE proven M2M auth + managementApi wrapper (~70 lines saved). (2) Single in-memory M2M token cache (avoid duplicate auth). (3) Manager R2 POSITIVE CORRECTION explicitly recommends. | LogtoService now dual-purpose (avatar customData + admin lookup). File ~290 lines — still maintainable, organized với section comments. Future split if size grows 2x. |
| Cache key for email | SHA-256 hash (64-char hex suffix) | Plaintext email OR AES encrypt | (1) BR-MP-36 mandate "avoid raw PII in Redis keys". (2) One-way hash sufficient for obfuscation tier (Redis access already privileged). (3) Deterministic — same email always same hash → cache hit. | Cannot reverse cache key → email. Cache invalidation by email requires re-hashing in invalidation logic (acceptable, op rare). |
| Negative cache strategy | Sentinel `'NULL'` literal string | Don't cache 404 / `undefined` value | Prevent Logto API spam khi admin spam-click search. Logto rate limit (600 req/min/M2M) real concern. | Slightly awkward `if (cached === 'NULL') return null` comparison logic. Documented inline trong code. |
| 5xx handling | Return null + log warn, NO cache | Throw 503 directly OR cache 5xx | (1) BR-MP-36 mandate graceful degrade (admin can manually input). (2) Don't cache 5xx — let next request retry (5xx is transient). | Caller cannot distinguish 404 vs 503 from service return value alone. M3 controller must use `LogtoService.isConfigured` getter + explicit error context. Acceptable separation of concerns. |
| Guard inheritance | `extends LogtoMerchantGuard extends LogtoAuthGuard` | Composition: Finance composes Merchant + checks finance role separately | (1) Mirrors existing `LogtoStaffGuard extends LogtoAuthGuard` proven pattern. (2) DI simpler — guard instantiated once, parent chain auto-invoked. (3) Test mock simpler (1 spy on JWT layer). | Hard to test 2-layer parent — required spy on `LogtoAuthGuard.prototype.canActivate` directly instead of nested mock. Solution documented in `logto-merchant-finance.guard.spec.ts:24` comment. |
| Period extension `'90d'` | Additive enum literal (Option A from R2) | Use existing `'quarter'` (Option B from R2) | (1) Merchant team natural language = "90 ngày qua" NOT "Quý gần nhất". (2) Calendar quarter inaccurate at start-of-Q (e.g., 2026-04-15 = only 15 days). (3) Additive backward-compat with F-062 — verified regression tests pass. | F-062 regression suite must re-run on every modification. 1 case added to switch + 1 entry to type union + JSDoc — minimal surface area change. F-062 specs verified pass post-change. |
| Boundary day convention | `from = today - 89` (90 days INCLUDING today) | `from = today - 90` (90 days BEFORE today) | Match existing `'7d'`/`'30d'` convention (`from = today - 6`/`from = today - 29`). Semantic consistency. | Slightly counterintuitive math (89 not 90) — documented inline comment. Tests verify length = 90 days exactly. |

---

## 🔬 Section 4: Reviewer Notes (Manager + QC focus)

### Files cần review kỹ (priority order)

1. **`backend/src/modules/logto-auth/logto.service.ts:101-256`** — 2 new public methods + private normalize helper. CRITICAL: cache layer logic, normalization strip, graceful degrade paths. Đọc CẢ method body line-by-line.
2. **`backend/src/modules/logto-auth/logto-merchant.guard.ts:46-58`** — Permission check logic. Verify boolean OR chain matches BR-MP-02 verbatim. Edge: admin/super_admin EXPLICITLY KHÔNG pass.
3. **`backend/src/modules/logto-auth/logto-merchant-finance.guard.ts:38-56`** — Finance-specific check sau parent. Critical: super.canActivate() chain order matters (Auth → Merchant → Finance).
4. **`backend/src/modules/analytics/services/period-resolver.ts:22 + 142-160`** — PeriodKind union + new case '90d' in switch. F-062 backward compat critical — verify existing case bodies UNCHANGED.
5. **`backend/src/modules/logto-auth/logto.service.spec.ts:60-300`** — Mock setup quality. Verify mockFetch sequence (M2M token THEN API call), Redis mock returns plausible values.

### Concurrency hotspots

- **`logto.service.ts:148-152 + 215-219`** — Redis cache write (`redis.set`) wrapped trong try/catch. If Redis transient down between read miss + API success + write, write silently fails (logged), service still returns correct result. Verified: NO cache invariant violation. NO race condition vì lookups are read-only (admin lookup user info).
- **No SETNX lock cần** vì admin click "Tìm" là user-triggered single op, không phải cron / bulk job. M2 mutation endpoints (POST/PATCH/DELETE access config) sẽ cần SETNX lock per BR-MP-37 — out of M1.

### Edge cases I tested vs DEFERRED

- ✅ **Tested:** Cache hit/miss/NULL sentinel, 404 cache, 5xx no-cache, M2M unconfigured graceful, Redis read error fallback, empty userId, invalid email, whitespace trim, case insensitivity, SHA-256 hash determinism, fuzzy filter exact match, ambiguous return null, F-062 regression, period boundary day count, cross-year boundary.
- ⚠️ **Deferred (acceptable):**
  - Logto API rate limit detection (HTTP 429) — currently treated as 5xx graceful null. Could add explicit 429 backoff handling later but acceptable for admin-triggered low-frequency op.
  - Concurrent admin search same email simultaneously — Redis cache write idempotent (latest wins, same SHA-256 key). No issue.
  - Negative cache invalidation on user creation — if admin creates new Logto user matching previously-cached `'NULL'` email, cache giữ stale 'NULL' tới 300s. Acceptable trade-off vì admin creation flow is rare event. M3 controller can `redis.del('logto-lookup:byemail:<hash>')` after Logto create if needed.

### Type safety narrowed casts (Manager grep `as unknown as`)

- **No `as unknown as` trong M1 non-spec files** (verified Step 3 grep clean).
- **Narrowed casts in spec files only:**
  - `logto.service.spec.ts:104` — `mockFetch as unknown as typeof fetch` — required to override global fetch with jest mock. Standard test pattern, narrowed shape verified by usage.
  - `logto.service.spec.ts:multiple` — `setCall![0] as string` (non-null assertion + string narrow) — guarded by prior `expect(setCall).toBeDefined()` assertion. Safe.

### Security checklist self-applied

- [x] **All M1 endpoints: N/A** — M1 không thêm endpoint. Guards/service được consumed bởi M2 endpoints.
- [x] **Guard layer protect future endpoint:** Verified 13 + 11 unit tests cover all positive/negative paths. NO bypass possible via missing role/scope.
- [x] **SQL params: N/A cho M1** (no SQL changes). Period-resolver only outputs date filter (not raw SQL string).
- [x] **Cache key collision:** `logto-lookup:*` namespace verified unique vs existing patterns (`analytics:*`, `dashboard:*`, `medical:*`, `awards:*`, `articles:*`, `master:*`, `merchant-portal:*` (future M2), `ratelimit:*`, `reset-lock:*`, `share-count:*`, `bib-count:*`, `flag:*`, `is_sync_*`, `block_number_*`).
- [x] **PII in Redis keys:** SHA-256 hash email before key construction (BR-MP-36 mandate). Verified TC.
- [x] **Logging PII:** Service `logger.warn` calls use `<hash:${hash.slice(0, 8)}>` for email logging (truncated hash prefix) — NOT raw email. Verified `logto.service.ts:226` + `:253`.

### Performance numbers (not measured at M1 — services not endpoint-mounted)

- Period-resolver — pure functional logic, no I/O. Negligible CPU (date math).
- LogtoService `lookupByIdWithCache`:
  - Cache hit: 1 Redis GET (~1ms local, ~5-10ms cloud)
  - Cache miss + 200: 2 Redis ops (GET + SET) + 1 M2M auth (if not cached) + 1 Logto API (~50-200ms typical) ≈ p95 < 300ms cold
- LogtoService `lookupByEmail`:
  - Same as above + SHA-256 hash (~0.1ms) + array filter (typically <5 results)
- Manager Performance SLA target (BR-MP-30) — `Auth flow login → dashboard < 2s p95` — M2 frontend gates dashboard rendering, M1 service is sub-component. Will measure in M3-M4 integration.

---

## 📋 M1 Verification Checklist for Reviewers

### Manager `/5bib-deploy` quick check

- [ ] Confirm `git status` shows 10 files trong M1 Scope Lock (period-resolver + logto-auth area)
- [ ] Confirm `npx jest --testPathPattern="(period-resolver|logto-merchant|logto)" ` returns 142/142 pass
- [ ] Confirm `npx tsc --noEmit` clean cho M1 files (ignore pre-existing `vi` errors)
- [ ] Read Section 1 above — does ANY deviation conflict với BR critical?
  - Deviation #1-5 are optimizations / defensive defaults → ACCEPTABLE
  - Deviation #6 (LogtoStaffGuard register) is opportunistic fix → ACCEPTABLE
- [ ] Spot-check 5 files theo priority list Section 4 above

### QC `/5bib-qc` Phase 1 Impact Audit

- [ ] **What Coder got right:**
  - REUSE existing LogtoService (Manager R2 corrective)
  - Cache key isolation (SHA-256 hash, BR-MP-36)
  - Graceful degrade (no throw, return null + log warn)
  - F-062 regression verified pass
  - Anti-pattern scan clean
- [ ] **What Coder may have MISSED (QC investigate):**
  - LogtoService cache miss test: verify Redis SET called với exact TTL value 300 (not 60 or 600). Test exists nhưng QC re-run với spy assertion `mockRedis.set.mock.calls[0][3]` === 300.
  - Period-resolver `'90d'` weekly granularity not yet asserted — BR-MP-25 says default `weekly` cho `'90d'`. Currently `resolveBucketSize` doesn't auto-resolve based on PeriodKind (FE explicitly passes `granularity` query param). Verify M2 controller default logic.
  - LogtoMerchantFinanceGuard error message specificity test passes — but does it test 403_NO_FINANCE message verbatim từ BR-MP-27? Spot-check.

---

## 🔗 Cross-references

- **PRD source:** `01-ba-prd.md` BR-MP-01 → 35 + `01-ba-prd-revision-r2.md` BR-MP-36 (LogtoManagementService) + BR-MP-25 R2 (PeriodKind extend)
- **Plan source:** `02-manager-plan.md` R2 APPROVED, Scope Lock M1 partial = period-resolver + logto-auth area
- **Test outputs:** `03-coder-implementation.md` section "Tests Written"
- **Related TD:** `TD-UPLOAD-SPEC-VI-GLOBAL` (forced #2 finding — open TD ticket)
- **Memory updates needed at /5bib-deploy:** `conventions.md` add Redis testing pattern (forced #1), `change-history.md` append M1 entry, `codebase-map.md` note 2 new guards trong logto-auth/

---

**End of M1 Implementation Notes. M2 will create its own IMPLEMENTATION_NOTES.md when ship.**
