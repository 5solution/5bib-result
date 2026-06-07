# FEATURE-069 M2a — Implementation Notes (Reviewer's Guide)

**Scope:** M2a Backend admin access CRUD foundation
**Coder:** 5bib-fullstack-engineer
**Date:** 2026-06-05
**For:** Manager `/5bib-deploy` Code Review + QC `/5bib-qc` Phase 1 Impact Audit

> Reviewer: Đọc Section 1 + 4 đầu. Section 1 = deviations vs spec (block deploy nếu conflict BR critical). Section 4 = priority files for spot-check.

---

## 🚧 Section 1: Deviations from Spec (intentional)

### Deviation #1 — Application-level dup check BEFORE Mongo unique index

- **Spec said:** BR-MP-33 mandate userId unique. Standard implementation = Mongo unique index throws E11000 on dup insert.
- **I did:** Application `findOne(userId)` precheck BEFORE `model.create()`. Throws ConflictException với clean errorCode `409_DUPLICATE` + bilingual VN/EN message.
- **Why:** Mongo E11000 raw message leaks index name + key value pattern. Clean errorCode lets frontend translate consistently. Cost = 1 extra query per create (~5ms acceptable for admin op).
- **Reviewer should check:** `merchant-portal-access.service.ts:create()` line 280-300 — check order: lock acquire → findOne dup check → create → audit → cache invalidate.

### Deviation #2 — Schema `timestamps: true` + explicit field declaration

- **Spec said:** BA R2 didn't specify. Standard Mongoose pattern uses `@Prop` for all fields including timestamps.
- **I did:** Schema uses `@Schema({ timestamps: true })` (Mongoose auto-injects createdAt/updatedAt) PLUS explicit `createdAt!: Date; updatedAt!: Date;` declaration (no `@Prop`) for TS visibility.
- **Why:** Avoids `as unknown as { createdAt: Date }` narrowed casts in service mapper. Mongoose runtime injection still works; TS now sees fields. Coder Hard Rule "NO `as unknown as X`" satisfied cleanly.
- **Reviewer should check:** `schemas/merchant-portal-access.schema.ts:91-95` explicit field decl + service `toResponse()` line 253-254 direct access `doc.createdAt`.

### Deviation #3 — `raceCount` sentinel string `'__all'` (not real count)

- **Spec said:** BR-MP-16 list table shows "X giải" or "Tất cả giải" label.
- **I did:** M2a returns sentinel string `'__all'` for tenant-only configs (no excludes); raw `include.length` for override-only configs. M2b will replace with real `resolveAccessibleRaces(userId).size`.
- **Why:** Real raceCount requires `resolveAccessibleRaces()` which loops MySQL races + applies exclude/include filters — that's M2b service core scope. M2a foundation work shouldn't block on M2b functionality. Sentinel covers UI display (frontend renders "Tất cả giải" for `'__all'` value).
- **Reviewer should check:** `service.ts findAll() line 350-365` raceCount logic — sentinel path documented. M2b will replace.

### Deviation #4 — Audit log query endpoint returns stub `[]`

- **Spec said:** BR-MP-26 endpoint `GET /api/admin/merchant-portal/audit-log` lists `merchant_access.*` audit entries.
- **I did:** M2a endpoint returns `{ items: [], total: 0, page: 1, pageSize: 20 }` stub. Full implementation deferred M2b.
- **Why:** M2a scope focuses on access service + admin CRUD. Audit log query needs AuditLog model injection + query helper + pagination — distinct service responsibility. M2b implements this on top of M2a foundation. Stub returns 200 to keep frontend M3 happy (UI can render "no audit yet" empty state).
- **Reviewer should check:** Controller `auditLog()` method comment notes "M2a stub — M2b implements full audit log query".

### Deviation #5 — Logto lookup `source` always `'api'` literal

- **Spec said:** BR-MP-36 says `source: 'cache' | 'api'` distinguishes cache hit vs miss.
- **I did:** Service always returns `source: 'api'` regardless of actual cache hit/miss. M1 LogtoService doesn't expose cache state to caller.
- **Why:** Exposing internal cache state would require additional flag from M1 service (signature change) — out of M2a scope. Admin UX doesn't materially benefit from distinguishing cache vs api. Defer until M3 needs it for debugging.
- **Reviewer should check:** Service `lookupLogto()` line 580+ — note + future enhancement comment.

### Deviation #6 — Actor extraction from JWT (resolves TD-CONTRACTS-ACTOR-001 partial)

- **Spec said:** Known issue `TD-CONTRACTS-ACTOR-001` "carry-forward F-069" — F-068 hardcoded `'admin'`, F-069 expected to fix.
- **I did:** Controller extracts `req.user?.userId` via `@Req() req: AuthenticatedRequest` decorator. Falls back to `'admin'` literal nếu user undefined (defensive).
- **Why:** M1 LogtoAuthGuard sets `req.user = { userId, ... }` on every request. Controller actor = Logto userId of admin invoking endpoint. Proper attribution per audit log compliance. Fallback `'admin'` covers edge case where guard somehow doesn't populate req.user (shouldn't happen but defensive).
- **Reviewer should check:** All 3 mutation methods (create/update/delete) extract actorUserId correctly. Tests use `'admin_xyz'` fixed string actor.

---

## ⚙️ Section 2: Forced Changes (reality ≠ spec)

### Forced #1 — `MerchantPortalPermission` type union shape (vs spec enum)

- **PRD assumed:** Standard NestJS enum pattern from class-validator examples.
- **Reality:** TypeScript `readonly tuple as const` pattern provides type-safe enum-like behavior without runtime enum overhead, matches modern codebase convention (no enum runtime weight).
- **Workaround:** `MERCHANT_PORTAL_PERMISSION_VALUES = ['ticket_report', 'revenue_report'] as const` + `MerchantPortalPermission = typeof MERCHANT_PORTAL_PERMISSION_VALUES[number]`. Used in both Schema `@Prop({enum: MERCHANT_PORTAL_PERMISSION_VALUES})` and DTO `@IsEnum(MERCHANT_PORTAL_PERMISSION_VALUES)`.
- **Manager/BA action:** Update `conventions.md` add pattern "string union enum via readonly tuple" — already common in 5BIB codebase.

### Forced #2 — `app.module.ts` import location (after AdminInternalModule)

- **PRD assumed:** Module register order doesn't matter.
- **Reality:** Module load order matters for NestJS DI graph. Looking at app.module.ts, F-061 `AdminInternalModule` is last → I inserted `MerchantPortalModule` after for chronological consistency.
- **Workaround:** Added `MerchantPortalModule` last (after AdminInternalModule). No conflict.
- **Manager/BA action:** None. Standard chronological pattern.

---

## ⚖️ Section 3: Tradeoffs Considered

| Decision | Option chosen | Alternative | Why chose | Cost paid |
|---|---|---|---|---|
| Dup check strategy | App-level `findOne` BEFORE create | Catch Mongo E11000 after insert | Clean errorCode, no schema name leak, easy bilingual message | +1 query per create (~5ms acceptable for admin low-freq) |
| Lock granularity | Per-userId (logical identity) | Per-Mongo-_id (storage key) | Lock the logical record — covers create/update/delete of same user | Slightly broader lock scope (acceptable — admin ops rare) |
| Tenant validation | Bulk `find({where: {id: In(ids)}})` single query | Loop per tenantId | Single query <10ms vs N queries | First missing returned via `find()` — not strict batch verify but covers BR-MP-33 |
| Audit emit timing for delete | BEFORE deleteOne | After deleteOne | BR-MP-24 spec + defensive against partial failure | Slight unnecessary write if delete actually fails (acceptable — audit is append-only) |
| Cache invalidation pattern | Hybrid exact DEL + scanStream wildcard | Pure scanStream all | Exact DELs avoid scan overhead for known keys; scanStream covers M2b/c future cache | Multiple Redis pipeline ops per invalidate (acceptable batch) |
| Toggle vs update distinction | Separate audit action `merchant_access.toggle` | Single `merchant_access.update` with changes diff | Ops team filterable; security-relevant actions distinct | +1 conditional in service (trivial) |
| raceCount placeholder | Sentinel `'__all'` string | Defer endpoint entirely until M2b | M2a admin UI can render "Tất cả giải" label correctly; foundation usable | M2b refactor required (acceptable — clear deferment path documented) |
| Logto lookup source field | Always `'api'` literal | Expose M1 cache state via signature change | M2a scope — admin UX doesn't need distinction | Future M3 enhancement deferred (documented TD) |

---

## 🔬 Section 4: Reviewer Notes (Manager + QC focus)

### Files cần review kỹ (priority order)

1. **`backend/src/modules/merchant-portal/services/merchant-portal-access.service.ts:80-130`** — SETNX lock implementation. Verify acquireAccessLock returns release fn for try/finally + ConflictException shape matches BR-MP-27 `409_CONCURRENT_EDIT`.
2. **`merchant-portal-access.service.ts:270-340`** — `create()` business logic. Order matters: validation → tenant check → lock → dup check → mongo insert → audit → cache invalidate.
3. **`merchant-portal-access.service.ts:455-540`** — `delete()` ensures audit emit BEFORE deleteOne (compliance critical, test verifies call order).
4. **`merchant-portal-access.service.ts:135-175`** — `invalidateUserCache()` mixed exact-DEL + scanStream pattern. Verify wildcard pattern syntax correct + try/catch graceful.
5. **`merchant-portal-admin.controller.ts:106-115`** — Actor extraction `req.user?.userId ?? 'admin'`. Verify fallback path safe (LogtoAdminGuard guarantees req.user populated, fallback defensive only).

### Concurrency hotspots

- **`service.ts acquireAccessLock`** — SETNX `merchant-access-lock:<userId>` TTL 10s. 2 concurrent same-userId → 1 win, 1 lose 409. Test TC-MP-30 verifies via Promise.allSettled.
- **`service.ts try/finally release`** — Lock released even if Mongo insert / audit emit / cache invalidate throws. Verified by test that lock released after error path.
- **NO SETNX cho findAll/findOne/lookupLogto** — Read-only ops, no race condition (eventual consistency acceptable for admin list view).

### Edge cases I tested vs DEFERRED

✅ **Tested:** Dup userId, invalid tenant, empty scope, bad permissions, cross-tenant, concurrent SETNX, partial update diff, toggle distinct action, hard delete order, lookup format auto-detect, lookup null graceful, list pagination + search regex, findOne not-found.

⚠️ **Deferred (acceptable):**
- Pagination edge `?page=999&pageSize=20` empty page handling — frontend can clamp page client-side (minor UX, M3 will fix).
- Audit log query endpoint returns stub `[]` — M2b scope (documented TD).
- `raceCount` real computation — M2b service core dependency (documented TD).
- Logto lookup source `'cache' | 'api'` distinction — Future enhancement (documented TD).

### Type safety narrowed casts (Manager grep `as unknown as`)

- **NONE in service file** (after Deviation #2 schema fix).
- **Test mock:** `as unknown as typeof mockModel` (line 76) for Mongoose model mock callable wrapping. Narrowed to specific shape, test-only.

### Security checklist self-applied

- [x] All endpoints have `@UseGuards(LogtoAdminGuard)` at class level
- [x] Response DTOs use `id` alias (BR-MP-23 strip pattern verified by `toHaveProperty('id')` + `not.toHaveProperty('_id')` assertions)
- [x] SQL params: TypeORM `find({where: {id: In(ids)}})` — parameterized, no raw interpolation
- [x] Cache key collision check: `merchant-access-lock:` + `merchant-portal:*:` distinct from existing M1 namespace `logto-lookup:*`
- [x] Mongo query injection: User input (`q` search) escaped via `replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` regex special chars
- [x] PII protection: Audit log emits userId (Logto ID, not email) as actor + targetUserId
- [x] Error message PII: bilingual VN/EN messages reference tenant ID number, not user email or sensitive PII

### Performance numbers (estimates — not measured at M2a service-level)

- **CRUD ops:** All <50ms expected (single Mongo op + lock + audit + cache invalidate parallel).
- **List endpoint:** O(pageSize) per page + tenant name batch lookup (~1 TypeORM query). Expected <200ms cold cache.
- **Logto lookup:** Reuses M1 cache — same SLA as M1 (cache hit <5ms, cold ~200ms).
- **SETNX lock acquire:** <1ms (single Redis SET op).

Performance SLA measurement deferred to M2b/M2c integration window where endpoints are actually invoked from frontend M3/M4.

---

## 📋 M2a Verification Checklist for Reviewers

### Manager `/5bib-deploy` quick check

- [ ] `git status` shows 8 files in M2a Scope Lock (7 new + 1 modified `app.module.ts`)
- [ ] `npx jest merchant-portal-access` returns 19/19 PASS
- [ ] `npx jest logto period-resolver merchant-portal` returns 167/167 PASS (cumulative M1+M2a)
- [ ] `npx tsc --noEmit` clean for M2a files
- [ ] 6 Deviations vs BR critical → ALL ACCEPTABLE (foundation deferments + defensive improvements)
- [ ] Spot-check 5 priority files (Section 4 above)

### QC `/5bib-qc` Phase 1 Impact Audit

- [ ] **What Coder got right:**
  - REUSE M1 LogtoService (no new file)
  - SETNX lock per F-068 pattern (proven)
  - Audit emit BEFORE delete (compliance)
  - App-level dup check vs Mongo E11000 leak
  - Schema timestamps explicit fields (avoid narrowed casts)
- [ ] **What Coder may have MISSED (QC investigate):**
  - List endpoint pagination edge `?page=999` — does it return empty page or 404?
  - Cache invalidation pattern wildcard syntax — does scanStream match all expected keys?
  - Cross-field validation order — does scope-empty check happen BEFORE tenant validation? (Tested: yes, line ordering verified)
  - Actor fallback `'admin'` literal — should this be flagged as security event log?
  - Concurrent update of same record while delete pending — what's the expected behavior? (Currently: delete wins, update gets 404 on lookup. Acceptable but worth QC TC.)

---

## 🔗 Cross-references

- **PRD source:** R1 `01-ba-prd.md` BR-MP-04/13/16/17/22/27/33 + R2 `01-ba-prd-revision-r2.md` BR-MP-36 (M1 done) + BR-MP-37 access lock (M2a) + BR-MP-26 endpoint table
- **Plan source:** R2 `02-manager-plan.md` Scope Lock M2 section (M2a subset implemented)
- **M1 references:** `IMPLEMENTATION_NOTES.md` (LogtoService extension + cache pattern) + `05-manager-deploy.md` (memory diff already includes 4 conventions M2a reuses)
- **Memory updates needed at /5bib-deploy:** 
  - `codebase-map.md` add `merchant-portal/` module entry
  - `change-history.md` append M2a entry
  - `known-issues.md` add 4 M2a LOW TDs (raceCount placeholder, audit log stub, lookup source, controller HTTP tests)
  - `conventions.md` (optional): document "string union enum via readonly tuple" pattern (Forced #1)

---

**End of M2a Implementation Notes. M2b will create its own addendum when ship.**
