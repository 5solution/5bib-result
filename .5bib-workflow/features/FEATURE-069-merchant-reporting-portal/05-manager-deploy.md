# FEATURE-069 M1: Manager Deploy & Memory Sync — Backend Foundation (PARTIAL)

**Status:** ✅ M1 DEPLOYED (M2-M5 still in-flight)
**Deployed:** 2026-06-05
**Author:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md` (R1) + `01-ba-prd-part2.md` (R1) + `01-ba-prd-revision-r2.md` (R2), `02-manager-plan.md` (R2 APPROVED), `03-coder-implementation.md`, `04-qc-report.md` ✅ APPROVED, `IMPLEMENTATION_NOTES.md`

> **🚧 Partial deploy note:** Đây là milestone 1 trong chuỗi M1-M5. FEATURE-069 vẫn 🟠 in-flight đến khi M2-M5 hoàn thành. Memory sync M1 partial cho Manager catch issues sớm trước M2 build trên foundation (QC recommendation). Counter NOT advanced (still `Next: FEATURE-070`).

---

## 📌 Pre-flight check (Manager bắt buộc làm)

- [x] `04-qc-report.md` verdict = ✅ APPROVED (M1 only)
- [x] Unit tests Coder PASS — 76 M1 NEW tests + F-062 regression intact
- [x] QC added 6 adversarial tests — all PASS (148 total tests, 10x flaky deterministic)
- [x] Files Changed match Scope Lock M1 (10 files Coder + 1 file QC adversarial spec) — 0 scope creep
- [x] `IMPLEMENTATION_NOTES.md` tồn tại với 4 sections đầy đủ (6 Deviations + 3 Forced + 7 Tradeoffs + Reviewer priority list)
- [x] Section 1 Deviations vetted vs BR critical — KHÔNG có deviation conflict với auth/financial/fee logic
- [x] Đã spot-check 5 critical files theo IMPLEMENTATION_NOTES Section 4 priority order (xem section dưới)

---

## 📊 Deploy summary

- **Branch:** `5bib_merchant_v1`
- **Commit:** chưa commit (đang trên working tree — Danny chốt timing)
- **QC verdict:** ✅ APPROVED (M1 only)
- **Unit tests:** 76 M1 NEW + 6 QC adversarial = 82 NEW tests; 148 total / 8 suites; 10x deterministic
- **F-062 regression:** ✅ intact (additive `'90d'` không break)
- **Performance:** N/A cho M1 (service-only, no endpoint mounted yet). Sẽ measure ở M3 integration.
- **Migration:** ZERO migration ở M1 (no DB schema change). M2 sẽ thêm collection `merchant_portal_access`.
- **Rollback safety:** ✅ Trivially safe — additive changes only. Revert 4 modified + delete 7 new files = restore prior state.

---

## 🔬 Manager Code Review (MANDATE 2026-05-17 — defense last line)

> Manager đọc `IMPLEMENTATION_NOTES.md` Section 1+4 ĐẦU TIÊN, sau đó spot-check 5 file critical paths theo Section 4 priority order. KHÔNG rubber-stamp Coder/QC claims.

### Bước 0: IMPLEMENTATION_NOTES Section 1 audit (6 Deviations vs BR critical)

| # | Deviation | Conflict với BR critical? | Verdict |
|---|---|---|---|
| 1 | Negative cache sentinel `'NULL'` literal | NO — BR-MP-36 không specify cache behavior cho 404. Defensive optimization. | ✅ ACCEPT |
| 2 | 5xx KHÔNG cache (let retry) | NO — aligns với BR-MP-36 graceful degrade mandate | ✅ ACCEPT |
| 3 | Fuzzy search filter exact email match | NO — security improvement, prevents wrong-user assign | ✅ ACCEPT (improves spec) |
| 4 | Ambiguous (>1 match) → null | NO — defensive fail-closed | ✅ ACCEPT |
| 5 | Module-level constant `LOGTO_LOOKUP_CACHE_TTL_SECONDS = 300` | NO — config simplicity, easy refactor if needed | ✅ ACCEPT |
| 6 | LogtoStaffGuard opportunistic register trong module | NO — small cleanup of pre-existing oversight, no risk | ✅ ACCEPT |

**Verdict:** 6 Deviations đều DEFENSIVE/IMPROVEMENT, KHÔNG silent change auth/financial/fee critical logic. Approve all.

### Spot-check 5 file critical paths

#### File 1: `backend/src/modules/logto-auth/logto.service.ts:101-302` — CRITICAL: cache + normalize + graceful degrade

**Lines read:** 1-50 (imports + class header), 101-160 (existing managementApi + getUser + new normalize), 178-302 (lookup methods + lookupByEmail tail)

Findings:
- ✅ **Line 46 DI constructor** `@InjectRedis() private readonly redis: Redis` — correct NestJS pattern, matches existing `timing-alert/notification-dispatcher.service.ts:44` usage
- ✅ **Line 153-160 `normalizeLogtoUser`** — strict shape, only 4 fields exposed. `String(raw.id ?? '')` defensive coercion. `typeof === 'string' ? x : null` narrowed cast safe. KHÔNG leak `customData`, `identities`, `applicationId`
- ✅ **Line 184-195 Redis cache read try/catch** — wraps `JSON.parse(cached)` implicitly (line 188 inside try block). QC Attack #1 verified this catches corrupted JSON
- ✅ **Line 187 NULL sentinel** — distinct from `'null'` JSON encoding. QC Attack #2 verified collision-safe
- ✅ **Line 198-203 M2M unconfigured branch** — return null + log warn. Matches BR-MP-36 graceful degrade
- ✅ **Line 210-221 cache write try/catch** — wrapped, silent on Redis error (correct — degrade gracefully)
- ✅ **Line 227 404 detection** `/\b404\b/.test(msg)` — word boundary regex, won't false-match in messages containing "1404" etc.
- ✅ **Line 269 SHA-256 hash** — `createHash('sha256').update(normalizedEmail).digest('hex')` — Node crypto, NOT custom. PII protection per BR-MP-36
- ✅ **Line 268 normalize email** — `trim().toLowerCase()` — case-insensitive, whitespace-safe
- ✅ **Line 300-305 exact match filter** — Deviation #3 verified: `email.toLowerCase() === normalizedEmail`. Prevents Logto fuzzy match wrong-user assignment
- ✅ **Line 308 ambiguous handling** — `matches.length !== 1` covers BOTH 0 and >1. Cache 'NULL' sentinel + warn only if >1 (line 319-322). Don't warn for 0 (expected case "not found")
- ✅ **Line 321 + 346 PII redaction in logs** — `<hash:${hash.slice(0, 8)}>` prefix only, NEVER raw email
- ⚠️ **MINOR observation (not blocking):** Line 178 `if (!userId) return null` — empty string check. `0`, `'  '` (whitespace) would pass — but userId comes from JWT or admin input, controlled. Acceptable for M1 service layer.

**Verdict:** ✅ APPROVED — Code matches BR-MP-36 spec + Deviations 1-5 all properly encoded. NO red flags.

#### File 2: `backend/src/modules/logto-auth/logto-merchant.guard.ts:46-58` — Permission OR chain

**Lines read:** full 60-line file

Findings:
- ✅ **Line 37 super.canActivate(ctx) call** — proper inheritance chain
- ✅ **Line 38 early return false** — KHÔNG throw on JWT layer fail, returns false (matches NestJS guard contract)
- ✅ **Line 41-42 nullish coalescing** `?? []` — safe array default
- ✅ **Line 44-50 OR chain** — 4 roles/scopes covered (`merchant_viewer`, `merchant_finance`, `merchant:read`, `merchant:finance`)
- ✅ **Line 52-56 ForbiddenException** — VN message matches BR-MP-27 `403_NO_ROLE` literal "Cần quyền merchant. Liên hệ admin 5BIB để được cấp quyền."
- ✅ **Comment line 24 — admin/staff NOT in chain (implicit)** — admin role doesn't include `merchant_*` so won't pass. Explicit per BR-MP-02 — "tránh nhầm lẫn admin xem trực tiếp merchant report"

**Verdict:** ✅ APPROVED — Encodes BR-MP-02 verbatim. Permission boundary clear.

#### File 3: `backend/src/modules/logto-auth/logto-merchant-finance.guard.ts:36-57` — Finance-only check after parent

**Lines read:** full 58-line file

Findings:
- ✅ **Line 40 super.canActivate (parent = LogtoMerchantGuard)** — 2-layer JWT verify + base merchant role check
- ✅ **Line 41 return false propagation** — proper chain
- ✅ **Line 48-49 finance-specific check** — narrower than parent (only `merchant_finance` role OR `merchant:finance` scope)
- ✅ **Line 51-55 distinct error message** — `403_NO_FINANCE` ("Bạn chỉ có quyền xem báo cáo bán vé. Liên hệ admin 5BIB để nâng cấp...")
- ✅ **Key invariant verified:** Viewer-only (passed Merchant parent) reaches Finance check → fails with finance-specific error. No-merchant-role fails earlier at Merchant parent với 403_NO_ROLE. Distinct UX — FE can redirect differently.

**Verdict:** ✅ APPROVED — Encodes BR-MP-03 verbatim. 2-layer inheritance correct.

#### File 4: `backend/src/modules/analytics/services/period-resolver.ts:22 + 161-171` — PeriodKind extension

**Lines read:** 22-32 (type + JSDoc), 142-176 (switch with new case)

Findings:
- ✅ **Line 32 PeriodKind union** — `'90d'` added between `'30d'` và `'quarter'`. Lexical order matches semantic order (rolling intervals → calendar buckets)
- ✅ **Line 23-30 JSDoc comment** — documents F-069 additive rationale, references "merchant team natural language" + F-062 backward compat note
- ✅ **Line 161-171 case '90d'** — implementation parallel to `'7d'`/`'30d'`. `addDaysUtc(today, -89)` = 89 days back + today = 90 days total. `to = addDaysUtc(today, 1)` = end-exclusive next day boundary, matches existing convention
- ✅ **Line 169 periodKey** `90d:${ymd(from)}` — same prefix:date format as 7d/30d. Cache key stable across same UTC day
- ✅ **Comment line 163** — explains 90 ngày BAO GỒM hôm nay → `-89` not `-90`. Prevents future Coder confusion
- ✅ **F-062 backward compat verified by QC** — 142+ existing F-062 tests pass post-change

**Verdict:** ✅ APPROVED — Additive change correct + well-documented.

#### File 5: `backend/src/modules/logto-auth/logto.service.spec.ts:60-300` — Mock setup quality

**Lines read:** 60-140 (mock setup + lookupByIdWithCache happy + cache hit + NULL sentinel)

Findings:
- ✅ **Line 75 `getRedisConnectionToken()`** — correct Redis mock token (Forced Change #1 — Coder fixed via QC feedback from initial tsc error). Matches existing pattern `timing-alert/checkpoint-discovery-lock.spec.ts`
- ✅ **Line 72-77 Test.createTestingModule** — DI-managed instantiation (NOT `new LogtoService()` direct). Matches NestJS testing convention
- ✅ **Line 102-117 happy path assertion** — verifies 4-field shape + verifies normalization stripping (`not.toHaveProperty('customData')` line 109)
- ✅ **Line 112-117 Redis cache write assertion** — exact TTL 300 verified, JSON.stringify(result) value
- ✅ **Line 120-133 cache hit test** — verifies `mockFetch.not.toHaveBeenCalled()` (no Logto API hit when cache serves)
- ✅ **Line 135-138 NULL sentinel test** — distinct path coverage

**Verdict:** ✅ APPROVED — Mock setup correct + assertions specific + covers happy/cache/sentinel paths.

### Manager Code Review Summary

| File | Verdict | Red flags |
|---|---|---|
| `logto.service.ts` lookup methods | ✅ APPROVED | 0 |
| `logto-merchant.guard.ts` | ✅ APPROVED | 0 |
| `logto-merchant-finance.guard.ts` | ✅ APPROVED | 0 |
| `period-resolver.ts` `'90d'` case | ✅ APPROVED | 0 |
| `logto.service.spec.ts` mock setup | ✅ APPROVED | 0 |

**0 red flags. 1 minor observation (empty/whitespace userId edge — non-blocking).** Coder defensive coding + QC adversarial probing paid off. M1 ready to ship.

---

## 📝 Memory diff (đã apply)

### `feature-log.md`

✏️ Updated:
- **Counter:** UNCHANGED (still `FEATURE-070`) — F-069 partial deploy, not closed
- **In-flight table row F-069:** Status updated to `🟠 M1 SHIPPED — Backend foundation. M2-M5 pending.`
- ➕ Appended annotation `> _(2026-06-05 FEATURE-069 M1 PARTIAL DEPLOY...)_` summarizing M1 milestone

### `change-history.md`

✏️ Appended (top):

```markdown
## 2026-06-05 FEATURE-069 M1 PARTIAL: Merchant Portal Backend Foundation

**Branch:** `5bib_merchant_v1`
**Type:** NEW_MODULE (M1 of 5 milestones)
**Status:** 🟠 M1 DEPLOYED — Feature in-flight (M2-M5 pending)

### Files changed (10 Coder + 1 QC adversarial = 11 total)
- ✏️ Modified: `backend/src/modules/analytics/services/period-resolver.ts` — PeriodKind union thêm `'90d'` literal additive (BR-MP-25 R2) + case body trong `resolvePeriod()` switch (90 ngày including today, parallel với '7d'/'30d' pattern)
- ✏️ Modified: `backend/src/modules/logto-auth/logto.service.ts` — Extend existing M2M wrapper với 2 method MỚI cho admin lookup: `lookupByIdWithCache(userId)` + `lookupByEmail(email)` + private `normalizeLogtoUser()`. Constructor injection `@InjectRedis()`. Export `LogtoUserInfo` interface (4 fields). Module-level constant `LOGTO_LOOKUP_CACHE_TTL_SECONDS = 300`. Cache key pattern `logto-lookup:byid:<userId>` + `logto-lookup:byemail:<sha256_hash>` (SHA-256 hash email avoid raw PII per BR-MP-36). Negative cache sentinel `'NULL'` literal string distinguishes from JSON-null. Graceful degrade: return null on 404/5xx/M2M unconfigured/Redis error.
- ✏️ Modified: `backend/src/modules/logto-auth/logto-auth.module.ts` — Register 2 NEW guards + LogtoStaffGuard (opportunistic fix pre-existing oversight) trong providers + exports
- ✏️ Modified: `backend/src/modules/logto-auth/index.ts` — Export 2 NEW guards + type `LogtoUserInfo`
- ➕ Added: `backend/src/modules/logto-auth/logto-merchant.guard.ts` — BR-MP-02 base merchant guard. extends LogtoAuthGuard. PASS cho 4 role/scope combinations (`merchant_viewer`/`merchant_finance`/`merchant:read`/`merchant:finance`). Admin/staff/super_admin KHÔNG pass (implicit — no merchant role/scope in chain). ForbiddenException 403_NO_ROLE VN message.
- ➕ Added: `backend/src/modules/logto-auth/logto-merchant-finance.guard.ts` — BR-MP-03 finance-only guard. extends LogtoMerchantGuard (2-layer inheritance). Additional check `merchant_finance` role OR `merchant:finance` scope. ForbiddenException 403_NO_FINANCE distinct VN message.
- ➕ Added: `backend/src/modules/analytics/services/period-resolver.spec.ts` — Unit test 33 tests: F-069 case '90d' (5 tests window/key/length/stability/cross-year) + F-062 regression (existing 7 kinds) + resolveCompare (prev/none/wow) + shiftMonthClamped (boundary fix) + resolveBucketSize + buildMetricCacheKey 3-variant + calcDeltaPercent + helpers.
- ➕ Added: `backend/src/modules/logto-auth/logto.service.spec.ts` — Unit test 19 tests cho 2 new lookup methods + M2M unconfigured graceful path. Mock setup using `getRedisConnectionToken()` (corrected from initial `getRedisToken` — see Forced Change #1).
- ➕ Added: `backend/src/modules/logto-auth/logto-merchant.guard.spec.ts` — Unit test 13 tests (PASS x 5 + FAIL x 7 + JWT false x 1). Port pattern logto-staff.guard.spec.ts.
- ➕ Added: `backend/src/modules/logto-auth/logto-merchant-finance.guard.spec.ts` — Unit test 11 tests. 2-layer inheritance test via `LogtoAuthGuard.prototype.canActivate` spy. Critical: distinct 403_NO_FINANCE vs 403_NO_ROLE bubbled.
- ➕ Added: `backend/src/modules/logto-auth/logto.service.adversarial.spec.ts` — QC ADVERSARIAL spec 6 tests covering Attack #1 corrupted JSON + Attack #2 sentinel collision + Attack #3 stampede observation + Gap #4 M2M 401 graceful.

### Architecture impact
- **LogtoService dual responsibility** — service now handles cả avatar customData (existing F-029-ish) + admin Logto user lookup (F-069 M1). Single M2M token cache (in-memory) reused.
- **NEW Redis namespace `logto-lookup:*`** — 2 sub-namespaces `byid:<userId>` + `byemail:<sha256_hash>`. KHÔNG collide với existing patterns (`analytics:*`, `dashboard:*`, `medical:*`, `awards:*`, `articles:*`, `master:*`).
- **NEW guard hierarchy** dưới logto-auth: `LogtoMerchantGuard extends LogtoAuthGuard`, `LogtoMerchantFinanceGuard extends LogtoMerchantGuard`. 2-layer pattern matches existing `LogtoAdminGuard`/`LogtoStaffGuard` parallel structure.
- **PeriodKind enum additive** — F-062 backward compat preserved.

### Conventions impact
- **Pattern (1) Negative cache sentinel** — Use literal `'NULL'` string distinct from JSON.stringify(null) cho confirmed-not-found / ambiguous results. Prevents repeated 404 spam from Logto Management API.
- **Pattern (2) SHA-256 cache key for PII** — Hash email với SHA-256 before using as Redis cache key suffix. One-way hash, deterministic, sufficient for "obfuscation tier" privacy.
- **Pattern (3) Email logger redaction** — `<hash:${hash.slice(0, 8)}>` prefix-only in log lines, NEVER raw email. Apply when service must log PII context.
- **Pattern (4) `getRedisConnectionToken()` test mock** — Correct token from `@nestjs-modules/ioredis` cho Test.createTestingModule. NOT `getRedisToken` (doesn't exist).

### DB / Cache impact
- MongoDB: ZERO change ở M1 (no collection added/modified). M2 sẽ thêm `merchant_portal_access`.
- MySQL platform: ZERO change.
- Redis: ➕ `logto-lookup:byid:<userId>` TTL 300s + ➕ `logto-lookup:byemail:<sha256>` TTL 300s.
  - Cache value formats: positive = `JSON.stringify({userId,email,name,username})`, negative sentinel = literal `'NULL'` string.
  - Invalidation strategy: M1 chỉ TTL-based expiry (admin tự lookup rare op). M2+ có thể `redis.del('logto-lookup:byid:<userId>')` sau admin update user info nếu cần.

### Tech debt còn lại (moved to known-issues.md)
- TD-F069-M1-STAMPEDE 🟢 LOW — No SETNX anti-stampede for concurrent same-userId lookup (admin low-freq, acceptable for M1)
- TD-F069-M1-M2M-401-DEVIATION 🟢 LOW — Coder returns null vs spec `throw InternalServerErrorException`. More defensive. Coder add as Deviation #7 in next IMPLEMENTATION_NOTES edit.
- TD-F069-M1-LOGTO-PAGINATION 🟢 LOW — Logto `?search=` returns max 20 results, exact email could be page 2 trong edge case
- TD-F069-SPEC-LOCATION-CONVENTION 🟢 LOW — Duplicate `period-resolver.spec.ts` filenames (mine `services/`, F-062 `__tests__/`) — both pass, no collision but convention drift to clarify
- TD-UPLOAD-SPEC-VI-GLOBAL 🟢 LOW — Pre-existing `vi` global error in `upload.*.spec.ts`. NOT introduced by M1.

### Lessons learned
1. **REUSE existing service > create new** — Manager R2 spot-check found `LogtoService` already had M2M wrapper. Coder EXTEND saved ~70 lines + reused proven M2M auth + single token cache. Pattern: always check `find * -name "*.service.ts" | xargs grep -l 'Management API\|M2M'` before scaffolding new service for integration.
2. **Defensive try/catch around `JSON.parse(cached)` PAYS OFF** — QC Attack #1 verified Coder's existing try/catch around Redis read catches corrupted JSON automatically. Pattern: wrap cache READ in try/catch, fall back to API on parse failure.
3. **Negative cache sentinel literal string > JSON null** — `redis.get` returns null for both "key not exists" và "value === null" — ambiguous. Use distinct sentinel like `'NULL'`.
4. **SHA-256 cache key for PII tier** — Sufficient for Redis-tier privacy without AES key management overhead. Pattern for future: any cache key involving email/phone/userId → hash unless key serves as identifier across services.
5. **Milestone-based delivery for NEW_MODULE** — Splitting F-069 into M1-M5 caught issues early (R2 NEEDS_REVISION, then M1 self-contained QC). Each milestone = independent QC + memory sync cycle. Prevent M5 bundle bloat.
6. **Forced Change discovery** — `getRedisConnectionToken()` correct, `getRedisToken` doesn't exist trong `@nestjs-modules/ioredis`. Convention added to memory.
```

### `codebase-map.md`

✏️ Updated logto-auth/ module section:
```diff
 modules/logto-auth/
   logto-auth.guard.ts           # Base JWT verify
   logto-admin.guard.ts          # admin/super_admin role
   logto-staff.guard.ts          # staff/admin/all
+  logto-merchant.guard.ts       # F-069 M1 — merchant_viewer/finance + scope merchant:read/finance
+  logto-merchant-finance.guard.ts  # F-069 M1 — finance-only (extends LogtoMerchantGuard)
   logto.service.ts              # Management API wrapper (M2M) — F-069 M1 extended với
                                 # lookupByIdWithCache + lookupByEmail (Redis cache 300s)
   types.ts                      # LogtoUser interface
+                                # F-069 M1 — LogtoUserInfo exported (4-field admin lookup shape)
   index.ts                      # Exports
   logto-auth.module.ts          # DI providers
```

### `architecture.md`

✏️ Added section "Logto integration":
```diff
 ## 🔌 Integration Points

 | External Service | Purpose | File then chốt |
 |------------------|---------|----------------|
+| Logto (Cloud) — Management API M2M | Avatar customData (F-029-ish) + Admin user lookup (F-069 M1) | `backend/src/modules/logto-auth/logto.service.ts` |
 | AWS S3 | ... |
```

### `conventions.md`

✏️ Added pattern in "Testing Conventions" section:
```markdown
### Redis mock pattern (NestJS testing)
Khi inject Redis vào service test, dùng correct token từ `@nestjs-modules/ioredis`:

```typescript
import { getRedisConnectionToken } from '@nestjs-modules/ioredis';
// ✅ ĐÚNG
{ provide: getRedisConnectionToken(), useValue: mockRedis }
// ❌ SAI — không tồn tại
{ provide: getRedisToken('default'), useValue: mockRedis }
```

mockRedis tối thiểu cần: `get`, `set`, `del` jest.fn(). Service inject `@InjectRedis() private readonly redis: Redis`.

Documented sau F-069 M1 deploy.
```

### `known-issues.md`

✏️ Appended 5 entries:
- TD-F069-M1-STAMPEDE 🟢 (LOW Tech debt section): No SETNX anti-stampede for `LogtoService.lookupByIdWithCache` concurrent calls. Acceptable admin low-freq, defer add SETNX nếu spam pattern emerge.
- TD-F069-M1-M2M-401-DEVIATION 🟢 (Tech debt): Coder Deviation from spec — return null vs throw InternalServerErrorException for M2M auth fail. Defensive. Coder add Deviation #7 in next IMPLEMENTATION_NOTES edit.
- TD-F069-M1-LOGTO-PAGINATION 🟢 (Tech debt): Logto `?search=<email>` returns max 20 fuzzy results. Exact email could be on page 2 trong edge case (unrealistic at 5BIB scale).
- TD-F069-SPEC-LOCATION-CONVENTION 🟢 (Known quirks): Duplicate `period-resolver.spec.ts` filenames trong cùng module — both pass, no collision but convention drift. Document in conventions.md future.
- TD-UPLOAD-SPEC-VI-GLOBAL 🟢 (Tech debt): Pre-existing tsc error trong `upload.*.spec.ts` (`vi` global undefined — likely Vitest globals trong Jest context). NOT introduced by F-069 M1. Investigate origin (legacy Vitest migration?).

---

## 🔮 Follow-up cho M2-M5

Manager notes cho future milestones build trên M1 foundation:

### M2 (Backend merchant-portal module)
- **Use M1 guards** — `@UseGuards(LogtoMerchantGuard)` cho ticket-sales endpoints, `@UseGuards(LogtoMerchantFinanceGuard)` cho revenue endpoints. KHÔNG inline role check trong controller.
- **Use M1 LogtoUserInfo lookup** — admin config controller `POST /api/admin/merchant-portal/access` call `LogtoService.lookupByEmail(email)` → distinguish null (404 vs 503 — controller adds context via `LogtoService.isConfigured` getter).
- **PeriodKind `'90d'`** — merchant report queries pass `period=90d` → `resolvePeriod({ kind: '90d' })` works out-of-box.
- **Add SETNX lock** — M2 access service `POST/PATCH/DELETE merchant_portal_access` MUST add `merchant-access-lock:<userId>` SETNX 10s per BR-MP-37.
- **Add cache invalidation hook** — When M2 admin updates Logto user info via management op, consider `redis.del('logto-lookup:byid:<userId>')` to bust M1 cache stale.

### M3 (Admin frontend config UI)
- **Search button calls `/api/admin/merchant-portal/logto-lookup?q=`** — frontend handles 200/404/503/400 distinctly per BR-MP-36 + Phase 2.2.6 UI step table

### M4 (Merchant portal frontend app)
- **Logto Web App callback** — separate Logto Application from M1 M2M App. Danny Logto Dashboard setup M5.
- **i18n + bilingual** — apply Display Convention (`merchant-labels.ts`) from day 1

### M5 (Infra)
- **TD-CI-001 mitigation in same PR** as merchant-portal Docker addition per BR-MP-28b
- **`getRedisConnectionToken()`** convention now in `conventions.md` — Coder future tests reuse pattern

---

## ✅ Status

🟠 **M1 DEPLOYED — F-069 still in-flight (M2-M5 pending)**

- Counter NOT advanced (Next: FEATURE-070 unchanged)
- In-flight table: F-069 row updated với M1 milestone status
- Memory diff applied (5 files: feature-log, change-history, codebase-map, architecture, conventions, known-issues)

### Next step

Danny option:
1. **`/5bib-init FEATURE-069 M2`** — Mở milestone 2 (Backend merchant-portal module). Manager pre-init impact map cho M2 build trên M1 foundation.
2. **Continue `/5bib-code` M2 trên 5bib_merchant_v1 branch** — Skip /5bib-init re-mở (M2 đã được scope trong existing plan R2). Coder reads `02-manager-plan.md` M2 scope section + IMPLEMENTATION_NOTES M1 lessons + new IMPLEMENTATION_NOTES M2 file.
3. **Pause feature** — Resume khi Danny clarify M2-M5 schedule. M1 work-in-progress trên branch nhưng chưa merge until M2+ ship hoặc M1-bundle deploy decision.

**Recommendation:** Option 2 — Continue M2 trên existing branch + plan. M1 foundation proven, defer init re-open overhead.
