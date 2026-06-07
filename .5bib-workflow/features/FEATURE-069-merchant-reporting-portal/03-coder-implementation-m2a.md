# FEATURE-069 M2a: Coder Implementation Log — Backend Access Service Foundation

**Status:** 🟠 READY_FOR_QC (M2a only — backend admin access CRUD foundation. M2b-M2d + M3-M5 pending)
**Started:** 2026-06-05
**Author:** 5bib-fullstack-engineer
**Linked:** `00-manager-init.md`, `01-ba-prd.md` (R1) + `01-ba-prd-part2.md` (R1) + `01-ba-prd-revision-r2.md` (R2), `02-manager-plan.md` (R2 ✅ APPROVED), `03-coder-implementation.md` (M1), `05-manager-deploy.md` (M1)

> **🚧 Milestone sub-scoping:** M2 chia 4 sub-milestone (M2a-M2d) trong session-based delivery. M2a foundation, M2b ticket-sales endpoints, M2c revenue+aggregate, M2d export+cron. M2a self-contained, can ship + revert independently.

---

## 📌 Pre-flight check (Coder bắt buộc)

- [x] Đọc `02-manager-plan.md` R2 APPROVED + M1 deploy report
- [x] Đọc `01-ba-prd-revision-r2.md` BR-MP-04, 13, 16, 17, 21, 33, 36, 37 (M2a-scoped BRs)
- [x] Đọc `03-coder-implementation.md` M1 + `IMPLEMENTATION_NOTES.md` M1 (lessons learned)
- [x] Đọc `05-manager-deploy.md` M1 — verify M1 deploy state + Manager review findings
- [x] Đọc memory: `conventions.md` (Redis mock pattern, negative cache sentinel, SHA-256 hash — 3 patterns minted M1), `codebase-map.md` `logto-auth/` updated section
- [x] Spot-check code thật: F-068 SETNX `reset-lock:` pattern (course-data-ops.service.ts), AuditLogService.emit shape (audit-log.service.ts), MerchantsService tenant lookup (merchant.service.ts), Tenant TypeORM entity (tenant.entity.ts), scanStream cache invalidation (articles.service.ts), existing admin controller pattern (admin.controller.ts)

---

## 🎯 M2a Scope Recap

M2a = Backend admin merchant-portal access config CRUD + Logto lookup endpoint.

**Deliverables:**
1. NEW MongoDB collection `merchant_portal_access` (BR-MP-04) — schema + 3 indexes
2. NEW DTOs (CreateAccessConfigDto + UpdateAccessConfigDto + ResponseDto + ListQuery/Response + LogtoLookupQuery/Response) với class-validator BR-MP-33 rules
3. NEW `MerchantPortalAccessService` — CRUD + SETNX lock BR-MP-37 + cache invalidation BR-MP-13 + audit log BR-MP-17 + Logto lookup BR-MP-36 reuse M1
4. NEW `MerchantPortalAdminController` — 7 admin endpoints `/api/admin/merchant-portal/*` (BR-MP-26 R2)
5. NEW `MerchantPortalModule` — DI wiring (LogtoAuthModule + AuditModule + TypeORM Tenant 'platform')
6. Register `MerchantPortalModule` trong `app.module.ts`
7. 19 unit tests covering 9 PRD TCs (TC-MP-11/12/13/14/23/24/30 + lookup variants + list/findOne)

**Out of M2a scope (deferred M2b-M2d + M3-M5):**
- Merchant-facing endpoints (`/api/merchant-portal/*`) → M2b
- `resolveAccessibleRaces(userId)` service core → M2b (M2a uses sentinel `'__all'` for raceCount placeholder)
- Ticket-sales summary/breakdown/trend/stacked endpoints → M2b
- Revenue endpoints + cross-tenant aggregate BR-MP-21b → M2c
- Excel export → M2d
- Cron pre-warm → M2d
- Audit log query endpoint (M2a returns stub) → M2b
- Admin frontend → M3
- Merchant portal frontend → M4
- Infra → M5

---

## 🔍 Impact Assessment (Think First Phase 1)

### Backend

**MongoDB:**
- NEW collection `merchant_portal_access` với 3 indexes (`{userId:1}` unique, `{tenantIds:1}` multi-key, `{isActive:1, userId:1}` compound). Đụng PAUSE Manager — confirmed Danny: tạo trên DEV với initial empty + indexes auto-applied khi Mongoose loads.
- Document size nhỏ (~few hundred bytes max). Collection size predict ~58 tenants × ~5 admin users = ~300 docs max. Index overhead negligible.

**MySQL platform (read-only):**
- `Tenant` repo qua named connection `'platform'` cho `validateTenantIds()` bulk validation. Pattern matches `MerchantsService` existing.
- Single `find({ where: { id: In([...]) } })` query per CRUD op → fast (<10ms với index trên tenant.id PK).

**Redis:**
- NEW key pattern `merchant-access-lock:<userId>` TTL 10s (BR-MP-37 SETNX lock).
- Cache invalidation patterns ưu tiên `merchant-portal:access:<userId>`, `merchant-portal:races:<userId>`, `merchant-portal:*:<userId>:*` (wildcard scanStream cho M2b/c cache namespace). Plus invalidates M1 `logto-lookup:byid:<userId>` (admin update có thể đổi user info).

**NestJS:**
- NEW module `MerchantPortalModule` imports `MongooseModule.forFeature` + `TypeOrmModule.forFeature('platform')` + `LogtoAuthModule` (M1 LogtoService + LogtoAdminGuard) + `AuditModule` (AuditLogService).
- Module registered cuối `app.module.ts` để load sau platform DB initialization.

### Frontend

M2a backend-only — KHÔNG đụng frontend.

### API Contract

NEW 7 endpoints under `/api/admin/merchant-portal/*` + 6 DTOs với `@ApiProperty`. Cần chạy `pnpm --filter admin generate:api` sau khi M2a deployed để M3 frontend có generated SDK.

M2a deferred SDK regen — không có frontend consumer trong M2a window. M3 sẽ regen + integrate.

---

## ⚠️ Edge Cases Covered (Think First Phase 2)

### Create access config

- [x] **Duplicate userId** — Application-level check `findOne(userId)` BEFORE Mongo insert → 409 với clean errorCode + bilingual VN/EN. Bypass Mongo E11000 raw error leak.
- [x] **Invalid tenantId** — Bulk validate qua TypeORM `find({where: {id: In(ids)}})`. Missing → 400 với specific missing ID. KHÔNG leak SQL.
- [x] **Empty scope** (no tenantIds + no include) — Cross-field validation per BR-MP-33 → 400 `400_SCOPE_EMPTY`.
- [x] **Permission validation** — `revenue_report` alone không hợp lệ, phải include `ticket_report` → 400 `400_PERMISSION_INVALID`.
- [x] **Cross-tenant assignment** — Audit log metadata flag `isCrossTenant: true` khi `tenantIds.length > 1` (BR-MP-14 audit requirement).
- [x] **Concurrent admin save** — SETNX `merchant-access-lock:<userId>` TTL 10s. 2 admin concurrent → 1 wins 201, 1 loses 409 `409_CONCURRENT_EDIT` với bilingual message.
- [x] **Lock release on throw** — `try/finally` block ensures lock release even if Mongo insert / audit emit throws.

### Update access config

- [x] **Partial update** — Apply only provided fields, preserve existing for unset fields.
- [x] **Cross-field re-validation** — When tenantIds/scope/permissions change, re-validate effective state (merged DTO + existing).
- [x] **Toggle isActive only** — Distinct audit action `merchant_access.toggle` (vs general `update`) for ops team filterability.
- [x] **Before/after diff** — Audit metadata includes both states for compliance + dispute resolution.
- [x] **Not found** — 404 với generic message, no leak about config existence.

### Delete access config

- [x] **Audit BEFORE delete** — Snapshot full state into audit metadata, then deleteOne. Order verified by test ('audit', 'delete' call order).
- [x] **Hard delete** (BR-MP-16) — Permanent removal. Audit log preserves history for re-grant compliance.
- [x] **Not found** — 404 (no audit emit, no delete attempt).

### Logto lookup (REUSE M1)

- [x] **Format auto-detection** — `q.includes('@')` → email lookup, otherwise → userId. Test covers both.
- [x] **Graceful degrade** — M1 service returns null on 404/5xx/M2M unconfigured. Controller maps null → `{ found: false, user: null }` (200 status — admin manual entry path).

---

## 🧠 Logic & Architecture (Think First Phase 3)

### Decision 1: Application-level dup check BEFORE Mongo unique index

**Why:** Mongo E11000 duplicate key error message leaks internal index name + key value. Catching at application layer with `findOne` precheck → clean 409 response với bilingual errorCode. Tradeoff: 1 extra query per create (acceptable — admin op low-frequency, ~1/day per admin).

### Decision 2: Audit emit BEFORE Mongo mutation (delete) — NOT after

**Why BR-MP-24 spec mandate.** Audit log must capture full state PRE-deletion for compliance trail. If Mongo deleteOne fails mid-operation, audit still records intent + snapshot (defensible). If audit emit fails after delete, we'd lose snapshot forever. Test verifies call order via call-tracking array `['audit', 'delete']`.

### Decision 3: SETNX lock per userId, NOT per Mongo \_id

**Why:** Lock the LOGICAL identity (userId is the natural uniqueness key) not the storage primary key. Same userId may have multiple create attempts in race; using `merchant-access-lock:<userId>` covers ALL CRUD ops on logical record. Also enables update/delete to lock against concurrent create of same userId.

### Decision 4: Separate `toggle` audit action vs `update`

**Why ops team UX.** Audit log filters often distinguish "user toggled" (security-relevant) from "config edited" (operational change). Separate action keys enable cleaner Linear/dashboard queries. Test catches this distinction.

### Decision 5: M2a `raceCount` sentinel `'__all'` deferred to M2b

**Why scoping discipline.** Real `raceCount` requires `resolveAccessibleRaces(userId)` which loops MySQL races + applies overrides. That's M2b service core scope. M2a uses sentinel string `'__all'` for tenant-only configs (covers ~80% case) + raw `include[].length` for override-only configs. M2b will replace with real count.

### Decision 6: REUSE M1 `LogtoService.lookupByEmail` / `lookupByIdWithCache` — no new service

**Why M1 foundation pattern.** Spec BR-MP-36 says "EXTEND `logto.service.ts`" per Manager R2 POSITIVE CORRECTION. M2a uses M1 service directly via DI. Source detection ('api' literal) deferred — caller doesn't need to know cache hit vs miss for M2a UX. Future enhancement.

### Decision 7: Schema includes timestamps fields explicitly (vs Mongoose runtime injection)

**Why type safety.** Mongoose `timestamps: true` adds `createdAt`/`updatedAt` at runtime but TS Schema class doesn't see them → service needs narrowed casts. Adding `createdAt!: Date; updatedAt!: Date;` to Schema class (NOT via `@Prop`) — Mongoose still auto-injects via timestamps, TS sees the fields. Cleaner than `as unknown as` casts.

---

## 💻 Files Changed (M2a)

### Added (7 files, 1883 LoC total)

| File | Purpose | Lines |
|---|---|---|
| `backend/src/modules/merchant-portal/schemas/merchant-portal-access.schema.ts` | Mongoose schema BR-MP-04 + 3 indexes + enum constants | 109 |
| `backend/src/modules/merchant-portal/dto/access-config.dto.ts` | 6 DTOs: Create/Update/Response/ListItem/ListResponse/ListQuery/Delete với class-validator BR-MP-33 rules + bilingual error messages | 278 |
| `backend/src/modules/merchant-portal/dto/logto-lookup.dto.ts` | LogtoLookupQueryDto (min 3 chars) + LogtoLookupResponseDto BR-MP-36b | 65 |
| `backend/src/modules/merchant-portal/services/merchant-portal-access.service.ts` | CRUD + SETNX lock BR-MP-37 + cache invalidation BR-MP-13 + audit log BR-MP-17 + Logto lookup BR-MP-36 reuse M1 + tenant validation BR-MP-33 | 617 |
| `backend/src/modules/merchant-portal/services/merchant-portal-access.service.spec.ts` | 19 unit tests covering 9 PRD TCs | 559 |
| `backend/src/modules/merchant-portal/merchant-portal-admin.controller.ts` | 7 admin endpoints + Swagger decorators + actor extraction từ JWT (resolves TD-CONTRACTS-ACTOR-001 partial) | 211 |
| `backend/src/modules/merchant-portal/merchant-portal.module.ts` | DI wiring | 44 |

### Modified (1 file)

| File | Change | Lines |
|---|---|---|
| `backend/src/modules/app.module.ts` | Register `MerchantPortalModule` import + module reference | +3 / -1 |

### Files NOT touched (deferred)

- ❌ Merchant-facing controller `merchant-portal.controller.ts` (M2b)
- ❌ Service core `merchant-portal.service.ts` (`resolveAccessibleRaces`) (M2b)
- ❌ Export service (M2d), Cron service (M2d)
- ❌ Audit log query endpoint (M2b — M2a returns stub)
- ❌ Admin/Merchant frontend (M3/M4)

---

## 🧪 Tests Written

### Unit test results (Jest)

```
PASS src/modules/merchant-portal/services/merchant-portal-access.service.spec.ts
  MerchantPortalAccessService
    create()
      ✓ happy path → 201 + audit emit + cache invalidate (TC-MP-11) (6 ms)
      ✓ TC-MP-12 — duplicate userId → 409 `409_DUPLICATE` (10 ms)
      ✓ TC-MP-13 — invalid tenantId → 400 `400_INVALID_TENANT` (1 ms)
      ✓ empty scope (no tenantIds, no include) → 400 `400_SCOPE_EMPTY` (1 ms)
      ✓ revenue_report without ticket_report → 400 `400_PERMISSION_INVALID` (1 ms)
      ✓ TC-MP-14 — cross-tenant → audit metadata isCrossTenant: true (3 ms)
      ✓ TC-MP-30 — concurrent SETNX → 1 win 201, 1 lose 409 `409_CONCURRENT_EDIT` (8 ms)
    update()
      ✓ TC-MP-23 — happy path partial update → audit before/after diff (2 ms)
      ✓ toggle isActive only → action `merchant_access.toggle` (2 ms)
      ✓ not found → 404 (1 ms)
    delete()
      ✓ TC-MP-24 — hard delete + audit emit BEFORE remove with full snapshot (2 ms)
      ✓ not found → 404 (no audit emit, no delete) (1 ms)
    lookupLogto()
      ✓ q contains @ → email lookup
      ✓ q without @ → userId lookup (1 ms)
      ✓ null result → found: false (graceful degrade)
    findAll()
      ✓ returns paginated list với tenant names enriched + computed raceCount (1 ms)
      ✓ search by q → applies regex to userName + email (1 ms)
    findOne()
      ✓ returns ResponseDto with id alias (strip _id raw per BR-MP-23)
      ✓ not found → 404 (1 ms)

Tests: 19 passed, 19 total
```

### Cumulative M1+M2a regression
```
9 suites passed, 9 total
167 tests passed, 167 total
Time: ~3s
```

### 10x flaky stability
```
Run 1-10: All 167/167 passed
ZERO flake — deterministic
```

### Tests deferred to M2b (admin controller HTTP-level + service findOne pagination edge)
- Controller HTTP-level tests (Jest + Supertest cho 401/403/404/409 path) — QC convention pattern, will write in QC phase
- Pagination edge `?page=999 limit=20` empty page handling

---

## 🛑 PAUSE/Confirmation log

| Date | What | Danny's answer |
|---|---|---|
| 2026-06-05 | M2a scope vs full M2 / M2a+M2b combo? | M2a Foundation only |
| 2026-06-05 | Tạo MongoDB collection trên DEV với indexes? | OK tạo DEV (M5 PROD) |
| 2026-06-05 | Port F-068 SETNX pattern cho `merchant-access-lock:<userId>`? | OK port F-068 pattern |
| 2026-06-05 | Admin endpoint URL prefix `/api/admin/merchant-portal/*`? | OK BR-MP-26 spec |

---

## 🚧 Scope creep / Out-of-Scope changes

- [x] **Không có scope creep cho M2a.** `git status` confirm:
  - 7 file new trong `backend/src/modules/merchant-portal/` — all in M2a Scope Lock
  - 1 file modified `backend/src/modules/app.module.ts` — required to register module
  - 0 file ngoài Scope Lock

---

## 🐛 Known limitations / Tech debt còn lại (M2a)

| TD | Severity | Note |
|---|---|---|
| `raceCount` sentinel `'__all'` placeholder — not real count | 🟢 LOW | M2b implements `resolveAccessibleRaces(userId)` then replace sentinel với real count |
| Audit log query endpoint returns stub `[]` | 🟢 LOW | M2b implements full query against AuditLog collection filtered by `action LIKE 'merchant_access.%'` with pagination |
| Logto lookup source detection always `'api'` | 🟢 LOW | M1 LogtoService caches internally but source tracking would require exposing cache state. Defer — admin UX không cần distinguish |
| Controller HTTP-level integration tests (401/403/404/409) | 🟢 LOW | QC convention to write — service-level tests cover business logic, HTTP guard wiring proven by existing LogtoAdminGuard usage |

---

## ✅ Self-Review Pipeline (Manager 2026-05-14 mandatory)

- [x] **Bước 1:** `tsc --noEmit` exit 0 cho M2a Scope Lock files (verified after schema timestamps fix)
- [x] **Bước 2:** PRD strict adherence audit — BR-MP-04/13/16/17/27/33/36/37 covered. DTOs match BR-MP-33 validation table. SETNX pattern matches F-068 reference verbatim.
- [x] **Bước 3:** Anti-pattern scan clean — 0 `console.log`, 0 `: any` raw, 0 `as unknown as` (initial 2 narrowed casts replaced với schema explicit `createdAt!: Date` fields), 0 TODO trong non-spec files (controller `// M2a stub — M2b implements...` justified)
- [x] **Bước 4:** Hand-pick field mapping audit — N/A cho M2a (no `.map()` field transforms; tenantNames enrichment via Map lookup, not field copy)
- [x] **Bước 5:** PROD-readiness smoke — SKIPPED (no local DEV server in session; module registration verified via tsc + jest module DI graph)
- [x] **Bước 6:** UI/UX self-inspection — N/A cho M2a (backend-only)
- [x] **Bước 7:** Real-world data sanity — fixtures use VN names (`Nguyễn Văn A`, `Trần Thị B`) + cross-tenant scenarios + concurrent admin race + diacritics in regex search
- [x] **Bước 8:** Files Changed vs Scope Lock — 8 files (7 new + 1 modified), 0 scope creep, git status confirm matches Manager plan M2a section
- [x] **Bước 9:** Generated SDK regen — DEFERRED to M3 frontend integration (M2a backend-only)
- [x] **Bước 10:** Unit tests PASS — 19 M2a NEW tests + 148 M1 regression = 167 total / 9 suites / 10x deterministic
- [x] **Bước 11:** `IMPLEMENTATION_NOTES-m2a.md` written với 4 sections (xem file riêng) — Danny 2026-05-19 mandate

→ Status: 🟠 **READY_FOR_QC (M2a only)**

---

## ✅ Status

- [x] M2a IN_PROGRESS → **READY_FOR_QC**

**Required to mark READY_FOR_QC:**
- [x] All M2a Scope Lock files (8 files) coded + tested
- [x] Unit tests PASS (19 M2a + cumulative 167/167)
- [x] `pnpm --filter admin generate:api` — N/A (deferred M3)
- [x] No `console.log`, `any`, `as unknown as` trong non-spec files
- [x] Lint + typecheck pass (tsc clean cho M2a)
- [x] Self-Review Pipeline 11 bước complete
- [x] `IMPLEMENTATION_NOTES-m2a.md` written

---

## 🔗 Next step

Danny chạy `/5bib-qc FEATURE-069 M2a` — QC verify M2a access service + admin controller + DTO validation + SETNX lock + audit emit + Logto lookup integration with M1.
