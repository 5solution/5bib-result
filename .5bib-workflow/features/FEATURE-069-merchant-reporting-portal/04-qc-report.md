# FEATURE-069 M1: QC Report — Backend Foundation

**Status:** ✅ **APPROVED** — Coder có thể `/5bib-deploy` M1 partial hoặc tiếp tục `/5bib-code` M2
**Tested:** 2026-06-05
**Author:** 5bib-qc-gatekeeper
**Linked:** `01-ba-prd.md` (R1), `01-ba-prd-part2.md` (R1), `01-ba-prd-revision-r2.md` (R2), `02-manager-plan.md` (R2 APPROVED), `03-coder-implementation.md` (M1), `IMPLEMENTATION_NOTES.md` (M1)

> **🚧 Scope note:** M1 = Backend foundation (period-resolver `'90d'` + LogtoService extend + 2 merchant guards + specs). M2-M5 chưa start — QC sẽ test riêng từng milestone.

---

## 📌 Pre-flight check (QC bắt buộc)

- [x] Đã đọc `01-ba-prd.md` (R1) + part2 — BR-MP-01 → 35 + 25 TC + 8 E2E + 15 SEC + Performance SLA
- [x] Đã đọc `01-ba-prd-revision-r2.md` (R2) — BR-MP-36 (logto lookup), BR-MP-25 (90d), BR-MP-27 error codes, BR-MP-37 (access lock — M2 not M1), BR-MP-28b (CI — M5)
- [x] Đã đọc `03-coder-implementation.md` — 10 file M1 (4 modified + 6 new), 76 unit tests Coder wrote
- [x] Đã đọc `IMPLEMENTATION_NOTES.md` Section 1+4 đầu tiên — 6 Deviations + 3 Forced + 7 Tradeoffs + priority files list
- [x] Đã đọc `memory/conventions.md` — anti-pattern checklist
- [x] Đã chạy Coder unit tests LOCAL → confirm 142 tests PASS / 7 suites
- [x] Đã spot-check 5 file priority theo IMPLEMENTATION_NOTES Section 4 — verify line-by-line vs BR

---

## 🔍 Phase 1: Impact & Regression Audit

### What the Coder got right ✅

| Item | Verification |
|---|---|
| **REUSE existing `LogtoService`** thay vì tạo file mới (Manager R2 POSITIVE CORRECTION) | Verified `logto.service.ts` extend, KHÔNG có file mới `logto-management.service.ts` |
| **Cache key isolation per user** | `logto-lookup:byid:<userId>` + `logto-lookup:byemail:<sha256>` — 2 namespace mới không collide với existing patterns. QC grepped `articles:*`, `analytics:*`, `dashboard:*`, etc. — no conflict |
| **SHA-256 hash email cache key** (BR-MP-36 mandate) | Verified `logto.service.ts:269` `createHash('sha256').update(normalizedEmail).digest('hex')`. Test grep cache key for raw email substring — clean |
| **Negative cache sentinel `'NULL'`** distinguishes from JSON.stringify(null) | Verified Attack #2 test: Logto user với name "NULL" gets JSON-encoded as `'"NULL"'` (quoted), NOT bare `'NULL'` sentinel. No collision possible |
| **Graceful degrade (NO throw)** for all failure modes | Verified line 198, 227, 240, 286 — return null for M2M unconfigured / 404 / 5xx / Redis error |
| **Normalization strips internal fields** | Verified `normalizeLogtoUser()` returns only 4 fields (userId/email/name/username). Internal `customData`, `identities`, `applicationId` STRIPPED |
| **Email logging redacted** | Verified `<hash:${hash.slice(0, 8)}>` prefix logging at line 321 + 346 — NO raw email leak in logs |
| **Period-resolver `'90d'` additive backward-compat** | F-062 regression suite (`__tests__/period-resolver.spec.ts` + `__tests__/period-resolver.f062.spec.ts`) — verified PASS post-change |
| **Guard hierarchy via inheritance** | `LogtoMerchantFinanceGuard extends LogtoMerchantGuard extends LogtoAuthGuard` — pattern mirrors proven `LogtoStaffGuard` + `LogtoAdminGuard` |
| **2-layer error propagation distinct** | TC verified: viewer accessing finance endpoint → `403_NO_FINANCE` message; no-merchant-role accessing finance endpoint → `403_NO_ROLE` (bubbled từ parent guard) |
| **Anti-pattern scan clean** | QC re-verified: 0 `console.log`, 0 `: any`, 0 `as unknown as` trong M1 non-spec files |
| **Scope creep zero** | git status confirms 10 file đúng Scope Lock |
| **`LogtoStaffGuard` opportunistic fix** | Pre-existing guard NOT registered in module — Coder fixed in same diff. ACCEPTABLE small win |

### What the Coder MISSED — QC findings

| # | Finding | Risk | Status |
|---|---|---|---|
| **QC-1** | **Spec BR-MP-36 says M2M auth fail "throw `InternalServerErrorException`"** but Coder returns null + log warn. Deviation NOT noted in IMPLEMENTATION_NOTES Section 1. | 🟢 LOW — More defensive than spec. Acceptable behavior, but documentation gap | ⚠️ ADVISORY (not blocking) — Coder add as Deviation #7 trong IMPLEMENTATION_NOTES nếu sửa file sau |
| **QC-2** | **Concurrent lookup stampede** — 10x same userId lookup, each hits Logto API (no SETNX dedup). IMPLEMENTATION_NOTES Section 4 acknowledges this. | 🟢 LOW — admin-triggered low-freq op, Logto rate limit 600/min > expected load | ✅ ACCEPTABLE — documented. M2 thêm SETNX nếu spam-click pattern emerge |
| **QC-3** | **Logto Management API pagination edge** — `?search=<email>` returns max 20 results (Logto Cloud default). If query string fuzzy matches >20 users, exact-email could be in page 2 → miss. | 🟢 LOW — unrealistic at 5BIB scale (max ~few dozen merchants × few staff). Email exact-match unlikely to fuzzy-match >20 fan-out | ✅ ACCEPTABLE — defer. Document trong TD list nếu Logto query patterns grow |
| **QC-4** | **`upload.*.spec.ts` pre-existing tsc errors** (`vi` global not defined) — flagged Coder Forced Change #2 | 🟢 LOW — NOT introduced by M1 | ⚠️ TD ticket `TD-UPLOAD-SPEC-VI-GLOBAL` mở separately |
| **QC-5** | **Duplicate `period-resolver.spec.ts`** — F-062 existing ở `__tests__/`, M1 new ở `services/`. Cả 2 pass, no collision. | 🟢 LOW — convention drift | ⚠️ Future: document spec location convention trong `conventions.md` |

**No 🔴 HIGH / CRITICAL findings.** All Coder claims verified accurate.

### Coder claims verified vs IMPLEMENTATION_NOTES

| Claim | Verified |
|---|---|
| 142 tests PASS / 7 suites | ✅ Re-run confirm + QC added 6 adversarial tests → 148 / 8 suites |
| Anti-pattern grep clean | ✅ Re-run independent grep — no console/any/as-unknown-as/TODO |
| 10 file in Scope Lock, 0 creep | ✅ `git status` matches |
| F-062 regression intact | ✅ Existing F-062 specs PASS post `'90d'` addition |
| tsc clean cho M1 files | ✅ Verified (ignoring pre-existing `vi` errors trong unrelated `upload.*.spec.ts`) |

---

## 🛡️ Phase 2: Security Threat Model

| Threat | Vector | Risk | Status |
|---|---|---|---|
| **Token bypass via missing guard** | Endpoint không có `@UseGuards()` | CRITICAL | ✅ N/A cho M1 (guards/service-only, no endpoint exposed). M2 controllers MUST apply guards |
| **Role escalation: viewer accesses finance** | viewer JWT calls revenue endpoint | CRITICAL | ✅ Mitigated by `LogtoMerchantFinanceGuard` — verified 11 unit tests + 4 distinct ForbiddenException paths |
| **Admin bypass: admin accesses merchant endpoint** | admin JWT calls merchant endpoint | HIGH | ✅ Mitigated by `LogtoMerchantGuard` — admin role/scope explicitly NOT in OR chain. Verified TC "admin role only → 403" |
| **Cache poisoning via Redis injection** | Inject malicious JSON via userId interpolation | MEDIUM | ✅ Mitigated — userId is JWT-derived (signed), KHÔNG raw user input. Cache key uses `:` separator, no SCAN command (`GET`/`SET` only) → no key wildcard injection |
| **PII leak via cache key inspection** | Redis admin reads cache key with raw email | HIGH | ✅ Mitigated — SHA-256 hash. Verified test "cache key uses SHA-256 hash (no raw PII)" |
| **Information disclosure via response leak** | Service returns internal Logto fields | MEDIUM | ✅ Mitigated — `normalizeLogtoUser()` strips to 4 fields only (userId/email/name/username) |
| **PII leak via logging** | Logger.warn includes raw email | MEDIUM | ✅ Mitigated — `<hash:${hash.slice(0, 8)}>` prefix-only logging |
| **JSON parse DoS** | Corrupted JSON in Redis crashes service | MEDIUM | ✅ **VERIFIED via QC Attack #1** — try/catch around `JSON.parse(cached)` at line 184-195 catches parse error, falls back to API. No uncaught throw |
| **Sentinel collision attack** | Malicious user with name "NULL" tricks cache | LOW | ✅ **VERIFIED via QC Attack #2** — JSON.stringify produces `'"NULL"'` (quoted), distinct from bare `'NULL'` sentinel. Subsequent cache hit returns full user data |
| **M2M auth bypass via cleared env** | Empty `LOGTO_M2M_APP_ID` env in PROD | MEDIUM | ✅ Mitigated — `isConfigured` getter checks both env vars, returns null gracefully when missing |
| **Concurrent admin save race condition** | 2 admin save same userId simultaneously | HIGH | ⏳ N/A cho M1. BR-MP-37 SETNX lock implemented trong M2 (access service) |
| **SQL injection** | User input in SQL string | CRITICAL | ✅ N/A cho M1 (no SQL). M2 MUST parameterize per BR-MP-06 |
| **CSRF on Server Action** | Cross-site request to NestJS | LOW | ✅ N/A cho M1 (no controller). M2 controllers + Next.js admin app handle via runtime proxy pattern |

**Conclusion:** M1 security posture STRONG. Mọi attack vector applicable to M1 scope đều mitigated. M2+ endpoints sẽ inherit guard protection.

---

## 🧪 Phase 3: Test Scripts (QC adversarial additions)

### New spec file QC created
- **`backend/src/modules/logto-auth/logto.service.adversarial.spec.ts`** (NEW, 6 tests)
  - **Attack #1: Corrupted JSON in cache** (2 tests) — verifies `JSON.parse` failure caught by try/catch
  - **Attack #2: Sentinel collision** (2 tests) — verifies Logto user `name: "NULL"` safely JSON-encoded
  - **Attack #3: Stampede observation** (1 test) — documents M1 design choice (no SETNX, acceptable cho admin low-freq)
  - **Gap #4: M2M auth 401** (1 test) — verifies Coder Deviation from spec (return null vs throw) is acceptable graceful degrade

### Adversarial test results

```
PASS src/modules/logto-auth/logto.service.adversarial.spec.ts
  LogtoService — QC ADVERSARIAL probes
    Attack #1: Corrupted JSON in cache (JSON.parse crash)
      ✓ lookupByIdWithCache — corrupted cache string → MUST NOT throw, fall back to API (5 ms)
      ✓ lookupByEmail — corrupted cache string → MUST NOT throw (1 ms)
    Attack #2: Sentinel collision with Logto user containing "NULL"
      ✓ user with name = "NULL" stringifies safely without sentinel collision (2 ms)
      ✓ subsequent lookup with cached evil user returns full data (not null) (1 ms)
    Attack #3: Cache stampede observation
      ✓ M1 does NOT implement SETNX anti-stampede — each concurrent call goes to API (1 ms)
    Gap #4: M2M auth 401 (token endpoint fail, not user endpoint)
      ✓ M2M token endpoint returns 401 → service returns null gracefully (1 ms)
```

**6/6 QC adversarial tests PASS.**

---

## 📊 Phase 4: Test execution results

### Full M1 suite

```
PASS src/modules/analytics/services/period-resolver.spec.ts        (33 tests M1)
PASS src/modules/analytics/__tests__/period-resolver.f062.spec.ts (F-062 regression)
PASS src/modules/analytics/__tests__/period-resolver.spec.ts      (F-062 regression)
PASS src/modules/logto-auth/logto-merchant-finance.guard.spec.ts  (11 tests M1)
PASS src/modules/logto-auth/logto-merchant.guard.spec.ts          (13 tests M1)
PASS src/modules/logto-auth/logto-staff.guard.spec.ts             (existing)
PASS src/modules/logto-auth/logto.service.adversarial.spec.ts     (6 tests QC NEW)
PASS src/modules/logto-auth/logto.service.spec.ts                 (19 tests M1)

Test Suites: 8 passed, 8 total
Tests:       148 passed, 148 total
Time:        2.7 s
```

### Phase 4 — 10x flaky stability run

```
Run 1:  Tests: 148 passed, 148 total
Run 2:  Tests: 148 passed, 148 total
Run 3:  Tests: 148 passed, 148 total
Run 4:  Tests: 148 passed, 148 total
Run 5:  Tests: 148 passed, 148 total
Run 6:  Tests: 148 passed, 148 total
Run 7:  Tests: 148 passed, 148 total
Run 8:  Tests: 148 passed, 148 total
Run 9:  Tests: 148 passed, 148 total
Run 10: Tests: 148 passed, 148 total
```

**10/10 deterministic — ZERO flake.** Test suite stable cho CI.

### Performance results

| Metric | Target | Actual | Status |
|---|---|---|---|
| M1 test suite execution | < 30s | 2.7s | ✅ |
| `LogtoService.lookupByIdWithCache` cold (cache miss + Logto API) | n/a (no SLA at M1) | mocked ~1-2ms | ✅ Will measure real perf at M3 integration |
| `LogtoService.lookupByEmail` cold | n/a | mocked ~1-2ms | ✅ Same |
| Guard chain overhead | n/a | <1ms (JS object property checks) | ✅ Negligible |
| Period-resolver `'90d'` resolution | n/a | <1ms (date math) | ✅ Negligible |

### Cache behavior verification

- **Positive cache TTL** 300s ✅ (verified test asserts `mockRedis.set` called với `'EX', 300`)
- **Negative cache sentinel TTL** 300s ✅
- **Cache isolation per user** ✅ (key chứa userId hash hoặc raw userId)

---

## 🔁 Phase 5: PRD Compliance Check

### M1-scope BR coverage

| BR | Spec | Test coverage | Verdict |
|---|---|---|---|
| **BR-MP-02** | LogtoMerchantGuard — 4 role/scope combinations pass; admin/staff/super_admin FAIL | 13 tests trong `logto-merchant.guard.spec.ts` covering PASS x5 + FAIL x7 + JWT false | ✅ |
| **BR-MP-03** | LogtoMerchantFinanceGuard — extends Merchant, additional finance check | 11 tests trong `logto-merchant-finance.guard.spec.ts` covering finance PASS + viewer FAIL + no-role FAIL + error specificity | ✅ |
| **BR-MP-25 (R2)** | PeriodKind extend `'90d'` literal additive | 5 tests trong `period-resolver.spec.ts > F-069 NEW case "90d"` + F-062 regression intact | ✅ |
| **BR-MP-25b (R2)** | Modify `period-resolver.ts` thêm `case '90d'` between `'30d'` và `'quarter'` | Verified line 161-171 implementation exact location | ✅ |
| **BR-MP-27 error codes (R2 partial)** | `403_NO_ROLE`, `403_NO_FINANCE` VN messages | Guard ForbiddenException messages verified verbatim match BR-MP-27 table | ✅ |
| **BR-MP-36 (R2)** | LogtoService lookupById + lookupByEmail với Redis cache | 19 tests + 6 QC adversarial = 25 tests covering all happy/edge/security paths | ✅ |
| **BR-MP-36 M2M setup** | Env vars `LOGTO_M2M_APP_ID/SECRET` | Verified existing in `config/index.ts:47-48` (Manager R2 POSITIVE CORRECTION confirmed) | ✅ |

### BRs deferred to M2-M5 (NOT M1 scope)

| BR | Defer to | Note |
|---|---|---|
| BR-MP-01 (Logto Dashboard 2 role + 2 permission) | M5 (Danny manual) | Coder cannot script Logto Dashboard |
| BR-MP-04 (`merchant_portal_access` collection) | M2 | Backend module |
| BR-MP-05 (assignment resolution logic) | M2 | Service layer |
| BR-MP-06 (IDOR 2-layer scoping) | M2 | Controller + service |
| BR-MP-07/08/09/10/11/12 (report data) | M2 | Endpoints + DTOs |
| BR-MP-13 (cache strategy 6 patterns) | M2 | merchant-portal-* keys |
| BR-MP-14 (Excel export) | M2 | Export service |
| BR-MP-15 (i18n) | M4 | Frontend |
| BR-MP-16 (admin config UI) | M3 | Admin frontend |
| BR-MP-17 (audit log) | M2 | Reuse AuditLogService |
| BR-MP-18 (auth flow) | M4 | Frontend Logto callback |
| BR-MP-19 (branding) | M4 | Frontend design tokens |
| BR-MP-20 (no expiry) | M2 | Access service logic |
| BR-MP-21 (cross-tenant aggregate) | M2 | FeeService per-tenant loop |
| BR-MP-22 (endpoint scoping pattern) | M2 | Controller |
| BR-MP-23 (response DTO stripping) | M2 | DTOs |
| BR-MP-24 (display convention dict) | M4 | Frontend |
| BR-MP-26 (endpoint list) | M2 | Controller |
| BR-MP-28 (Docker/nginx/DNS/CI) | M5 | Infra |
| BR-MP-28b TD-CI-001 mitigation (R2) | M5 | Infra |
| BR-MP-29 (Logto config) | M5 | Danny manual |
| BR-MP-30 (performance SLA) | M2-M4 | Measured at integration |
| BR-MP-31 (data freshness) | M2 | Cache TTL |
| BR-MP-32 (notification defer Phase 2) | OUT | N/A |
| BR-MP-33 (admin validation) | M2 | DTO validators |
| BR-MP-34 (security checklist) | M2-M5 | Per layer |
| BR-MP-35 (frontend stack) | M4 | Frontend |
| BR-MP-37 (access mutation lock — R2) | M2 | Access service SETNX |

**M1 compliance:** 7 BRs covered (5 BR-MP-02/03/25/27/36 + 2 derived BR-MP-25b/36-M2M). **100% of M1-scoped BRs verified.**

---

## 👥 Phase 6: Persona Journey Walkthrough

### N/A cho M1 — defer to M3/M4 (UI milestones)

M1 = Backend foundation, **không có UI**. Phase 6 mandate apply cho feature có UI per Manager 2026-05-14 directive: *"nếu test thì test thêm cả các persona như thế này để bao quát cũng như đảm bảo về UI/UX."*

M1 deliverables:
- `period-resolver.ts` PeriodKind extension — internal type, không user-facing
- `LogtoService` lookup methods — service layer, consumed bởi M2 admin controller (not yet exists)
- 2 merchant guards — consumed bởi M2 controllers (not yet exists)

**Phase 6 sẽ test ở milestone:**
- **M3** Admin Config UI (Sales/BackOffice persona) — AccessConfigDialog Logto lookup button journey
- **M4** Merchant Portal Frontend (Merchant MKT / Merchant Finance / Anonymous persona) — Race List → Ticket Sales → Revenue journeys + Aggregate cross-tenant + Bilingual VN/EN toggle

Manager `/5bib-deploy` M1 phải accept this Phase 6 skip với rationale documented.

### QC Phase 6 substitute for M1: Code review walkthrough

Vì M1 không có UI, QC thực hiện code review walkthrough thay thế:

| Persona | Code path walkthrough |
|---|---|
| **5BIB Back-Office Admin** (future M3 consumer) | Will call `LogtoService.lookupByEmail(email)` → service returns LogtoUserInfo or null → admin UI renders "Tìm thấy" hoặc "Không tìm thấy/Lỗi kết nối" |
| **Merchant MKT Staff** (future M4 consumer) | Will be guarded by `LogtoMerchantGuard` → endpoint serves ticket-sales data filtered by service-resolved accessibleRaces |
| **Merchant Finance Staff** (future M4 consumer) | Will be guarded by `LogtoMerchantFinanceGuard` → endpoint serves revenue data với GMV + dual fee display |
| **Anonymous (unauthenticated)** | All guards throw 401 at JWT verify layer (`LogtoAuthGuard.canActivate` returns false / throws UnauthorizedException) |

All walkthrough paths verified via guard unit tests + service unit tests.

---

## 🚧 Tech debt còn lại sau M1 ship (Manager append vào known-issues.md)

| TD ID | Module | Debt | Severity | Notes |
|---|---|---|---|---|
| **TD-F069-M1-STAMPEDE** | `LogtoService.lookupByIdWithCache` | No SETNX anti-stampede — concurrent same-userId lookups each hit Logto API | 🟢 LOW | Acceptable cho M1 admin low-freq op. Add SETNX nếu spam pattern emerge. Documented in IMPLEMENTATION_NOTES Section 4 |
| **TD-F069-M1-M2M-401-DEVIATION** | `LogtoService` lookup methods | Spec BR-MP-36 said throw on M2M 401, Coder returns null. More defensive but doc gap | 🟢 LOW | Update IMPLEMENTATION_NOTES Section 1 with Deviation #7 cho clarity |
| **TD-F069-M1-LOGTO-PAGINATION** | `LogtoService.lookupByEmail` | Logto `?search=` returns max 20 results — exact email could be on page 2 trong edge case | 🟢 LOW | Unrealistic at 5BIB scale. Defer until needed |
| **TD-UPLOAD-SPEC-VI-GLOBAL** | `backend/src/modules/upload/*.spec.ts` | Pre-existing `vi` global error — Vitest globals trong Jest context | 🟢 LOW | NOT introduced by M1, opened separately. Existing fail, NOT M1 regression |
| **TD-F069-SPEC-LOCATION-CONVENTION** | `analytics/services/period-resolver.spec.ts` + `__tests__/period-resolver.spec.ts` | Duplicate filename, different folders — both pass, no collision but convention drift | 🟢 LOW | Document spec location convention trong `conventions.md` future |

---

## 📊 Final Verdict

> ### ✅ **APPROVED — M1 sẵn sàng deploy hoặc continue M2**

**Justification:**
- **148 tests PASS / 8 suites / 10x deterministic** — zero flake, sub-3s execution
- **Security threat model 13 vectors all mitigated** (4 N/A for M1 scope, 9 verified)
- **Code review walkthrough 4 personas** — paths verified via unit test coverage
- **PRD compliance 7/7 M1-scoped BRs covered** — 100%
- **Anti-pattern scan clean** — 0 console.log, 0 any, 0 as-unknown-as, 0 TODO
- **Scope creep zero** — 10 file đúng Scope Lock
- **F-062 regression intact** — additive change validated
- **Manager R2 POSITIVE CORRECTION applied** — REUSE `LogtoService` existing
- **5 LOW-severity TDs documented** — none blocking M1 ship

**QC found Coder doing the right thing:**
- Adversarial Attack #1 (corrupted JSON) — Coder code ALREADY safe via try/catch wrapping JSON.parse. Defensive coding paid off.
- Adversarial Attack #2 (sentinel collision) — JSON.stringify quoting prevents collision. Correct design choice.
- M2M graceful degrade — Coder went BEYOND spec (return null instead of throw) for safer admin UX.

**Coder Deviations all DEFENSIVE:**
- All 6 deviations in IMPLEMENTATION_NOTES Section 1 are optimizations / defensive defaults → ACCEPTABLE.
- 1 spec deviation (M2M 401 → null vs throw) NOT noted → ADVISORY only, not blocking.

### Re-submit checklist (NONE — already APPROVED)

No items required for re-submit. Coder may proceed directly to:
- (a) Continue `/5bib-code` M2 (Backend merchant-portal module) using M1 foundation
- (b) Stop M1 here for Manager `/5bib-deploy` M1 partial memory sync first
- (c) Wait for M2-M5 completion then bundle deploy

---

## 🔗 Next step

**APPROVED → Danny chạy 1 trong 3 options:**

1. **`/5bib-deploy FEATURE-069 M1 partial`** — Manager memory sync M1 only, keep feature in-flight cho M2-M5 sau. Recommend cho early validation.
2. **`/5bib-code FEATURE-069 M2`** — Continue Backend merchant-portal module trên M1 foundation. M1 không re-deploy until M5 bundle.
3. **Pause feature** — Resume sau khi Danny clarify M2-M5 schedule. M1 work-in-progress trên branch nhưng không merge until M2+ ship.

**QC recommendation:** Option (1) — `/5bib-deploy M1 partial` để Manager catch any M1 issue ở review layer + sync memory before M2 builds on top. Tránh M2 build on potentially-bad foundation. Sau M2 ship → another /5bib-deploy. Pattern proven F-068 (Course Data Ops UX) — incremental deploy + memory sync per milestone.
