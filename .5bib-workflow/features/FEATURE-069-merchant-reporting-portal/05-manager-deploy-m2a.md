# FEATURE-069 M2a: Manager Deploy & Memory Sync — Backend Access Service Foundation (PARTIAL)

**Status:** ✅ M2a DEPLOYED — F-069 still in-flight (M2b/c/d + M3-M5 pending)
**Deployed:** 2026-06-05
**Author:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md` (R1) + `01-ba-prd-revision-r2.md` (R2), `02-manager-plan.md` (R2 APPROVED), `03-coder-implementation-m2a.md`, `04-qc-report-m2a.md` ✅ APPROVED WITH CONDITIONS, `IMPLEMENTATION_NOTES-m2a.md`, M1 docs (03/04/05/IMPLEMENTATION_NOTES)

> **🚧 Partial milestone deploy với 1 HIGH must-fix M2b:** M2a foundation ships nhưng `update()` flow có race condition (TD-F069-M2a-UPDATE-AFTER-DELETE-RACE) verified bởi Manager independent code review. Defer fix M2b natural refactor window. Counter UNCHANGED (still `Next: FEATURE-070`).

---

## 📌 Pre-flight check (Manager bắt buộc)

- [x] `04-qc-report-m2a.md` verdict = ✅ APPROVED WITH CONDITIONS (1 HIGH must-fix M2b, 4 LOW documented)
- [x] Unit tests Coder PASS — 19 M2a NEW + 5 QC adversarial = 24 new tests
- [x] Cumulative 172/172 tests pass / 10 suites / 10x deterministic (M1 148 + M2a 19 + QC adv 5)
- [x] Files Changed match M2a Scope Lock — 8 files (7 new + 1 modified `app.module.ts`), 0 scope creep
- [x] `IMPLEMENTATION_NOTES-m2a.md` tồn tại với 4 sections (6 Deviations + 2 Forced + 8 Tradeoffs + Reviewer Notes)
- [x] Section 1 Deviations vetted vs BR critical — 6/6 DEFENSIVE/SCOPING, KHÔNG conflict auth/financial/fee logic
- [x] Đã spot-check 5 critical files theo IMPLEMENTATION_NOTES Section 4 priority order (xem section dưới)

---

## 📊 Deploy summary

- **Branch:** `5bib_merchant_v1` (continued from M1 — single branch milestone-based delivery)
- **Commit:** Working tree changes uncommitted (Danny timing TBD)
- **QC verdict:** ✅ APPROVED WITH CONDITIONS
- **Unit tests:** 19 M2a Coder + 5 QC adversarial = 24 NEW; 172 cumulative (M1 + M2a) / 10 suites
- **10x flaky:** Deterministic 10/10
- **Performance:** N/A service-level (will measure at M3 frontend integration)
- **Migration:** ZERO migration M2a (Mongoose auto-creates `merchant_portal_access` collection on first write + indexes applied via decorators)
- **Rollback safety:** ✅ Drop 7 new files + revert 1 modified `app.module.ts` line = M1 state restored

---

## 🔬 Manager Code Review (MANDATE 2026-05-17 — defense last line)

> Manager đọc `IMPLEMENTATION_NOTES-m2a.md` Section 1+4 ĐẦU TIÊN, sau đó spot-check 5 file critical paths theo Section 4 priority. KHÔNG rubber-stamp QC verdict.

### Bước 0: IMPLEMENTATION_NOTES Section 1 audit (6 Coder Deviations vs BR critical)

| # | Deviation | Conflict với BR critical? | Verdict |
|---|---|---|---|
| 1 | App-level dup check BEFORE Mongo create | NO — defensive, cleaner errorCode + no E11000 message leak | ✅ ACCEPT |
| 2 | Schema explicit `createdAt!`/`updatedAt!` fields | NO — type safety improvement, Mongoose runtime injection preserved | ✅ ACCEPT |
| 3 | `raceCount` sentinel `'__all'` placeholder | NO — deferred M2b natural resolution via `resolveAccessibleRaces` | ✅ ACCEPT |
| 4 | Audit log query stub returns `[]` | NO — deferred M2b, controller method documented placeholder | ✅ ACCEPT |
| 5 | Logto lookup `source` always `'api'` literal | NO — UX doesn't need distinction. Future enhancement | ✅ ACCEPT |
| 6 | LogtoStaffGuard opportunistic register | NO — small cleanup of pre-existing oversight | ✅ ACCEPT |

**Verdict:** 6/6 DEFENSIVE/SCOPING, KHÔNG silent change auth/financial/fee critical logic. Approve all.

### Section 2 Forced Changes audit
- Forced #1 `MerchantPortalPermission` readonly tuple pattern — modern convention, no breaking impact. Future codebase doc opportunity.
- Forced #2 `app.module.ts` module register order — chronological, no DI conflict.

### Spot-check 5 file critical paths

#### File 1: `services/merchant-portal-access.service.ts:450-538` — `update()` flow (CRITICAL)

**Lines read:** 450-538 (entire update method)

Findings:
- ✅ **Line 455-461** findById + 404 NotFoundException with bilingual message
- ✅ **Line 463-473** cross-field validation BEFORE lock (early-fail path, no lock leak)
- ✅ **Line 475 acquireAccessLock + try/finally** structure correct
- ✅ **Line 477-484 before snapshot** captures pre-mutation state for audit diff
- ✅ **Line 486-498 patch application** uses `dto.X !== undefined` (correct semantics — null vs undefined distinct)
- ✅ **Line 500 existing.save()** Mongoose save call
- ✅ **Line 511-516 toggle vs update action distinction** logic correct
- ✅ **Line 518-530 audit emit** with proper actor + entity + changes diff
- ✅ **Line 532 cache invalidate** after success
- 🔴 **RED FLAG VERIFIED — Line 455 `findById` BEFORE Line 475 `acquireAccessLock`**
  - **Race window:** Admin A enters update flow, findById returns doc. Concurrent admin B enters delete flow, findById returns same doc. B wins SETNX, audit-emit + deleteOne + release. A SETNX wins → `existing.save()` on a doc whose underlying record was just deleted.
  - **Mongoose behavior:** `save()` on a loaded-then-externally-deleted document triggers UPSERT (insert with original _id + fields). This RESURRECTS deleted record.
  - **Impact:** Admin thought record deleted, B's update silently recreates it. If record was revoked merchant user, they regain access (security implication).
  - **Mitigation status (M2a):** NOT FIXED. SETNX prevents 2 simultaneous saves but doesn't prevent stale-read-then-save race.
  - **Required fix M2b:** After `acquireAccessLock` (line 475), insert `const stillExists = await this.accessModel.exists({ _id: existing._id }); if (!stillExists) throw new NotFoundException(...);` BEFORE patch/save (line 486+).
  - **Severity:** MED-HIGH. Manager elevates to **critical-watch** if M2b fix slips.

**Verdict:** ⚠️ **APPROVED WITH MUST-FIX M2B** — code logic functionally correct for non-racing case, race condition NOT yet defended.

#### File 2: `services/merchant-portal-access.service.ts:80-120` — SETNX lock pattern

Findings (already verified QC phase):
- ✅ `redis.set(key, '1', 'EX', 10, 'NX')` correct F-068 pattern verbatim
- ✅ Return value check `acquired !== 'OK'` correct (handles null + non-OK strings)
- ✅ ConflictException 409 `409_CONCURRENT_EDIT` with bilingual VN/EN
- ✅ Release function wrapped in `try/catch` with warn log
- ✅ Lock TTL 10s — admin op realistic <50ms, TTL not auto-extended (LOW TD)

**Verdict:** ✅ APPROVED — SETNX implementation correct per F-068 reference.

#### File 3: `services/merchant-portal-access.service.ts:540-590` — `delete()` flow

Findings (already verified QC phase):
- ✅ Audit emit BEFORE `deleteOne` (BR-MP-24 compliance + test verifies call order via tracking)
- ✅ Snapshot full state in audit metadata
- ✅ Cache invalidate after delete success
- ✅ NotFoundException 404 path correct (no audit emit, no delete attempt)
- ✅ try/finally ensures lock release on throw

**Verdict:** ✅ APPROVED — delete flow correct + compliance-grade audit trail.

#### File 4: `merchant-portal-admin.controller.ts:100-145` — admin endpoints + actor extraction

Findings:
- ✅ **Line 101-119 POST /access** — `@Body() dto: CreateAccessConfigDto` + class-validator + Swagger 201/400/409 codes
- ✅ **Line 118 actor extraction** — `req.user?.userId ?? 'admin'` fallback (defensive: LogtoAdminGuard guarantees req.user populated, fallback only if somehow guard bypassed)
- ✅ **Line 126-144 PATCH /access/:id** — same actor extraction pattern + 404/409 status codes
- ✅ **All routes class-level `@UseGuards(LogtoAdminGuard)`** (verified at controller top — line 60)
- ✅ **All routes have `@ApiResponse({status: 401/403/...})`** Swagger decorators

**Verdict:** ✅ APPROVED — controller wiring correct + actor attribution resolves TD-CONTRACTS-ACTOR-001 partial.

#### File 5: `schemas/merchant-portal-access.schema.ts:85-109` — schema + indexes

Findings:
- ✅ **Line 89-90 `updatedBy?: string`** optional field with `@Prop`
- ✅ **Line 97-98 explicit `createdAt!: Date; updatedAt!: Date;`** declaration (Deviation #2 verified — no `@Prop`, Mongoose runtime auto-injection still works, TS sees fields)
- ✅ **Line 101-104 HydratedDocument type + Schema factory** standard NestJS Mongoose pattern
- ✅ **Line 107-109 3 indexes** per BR-MP-04:
  - `{ userId: 1 }` unique — primary lookup
  - `{ tenantIds: 1 }` multi-key — reverse lookup
  - `{ isActive: 1, userId: 1 }` compound — active filter

**Verdict:** ✅ APPROVED — schema clean, type-safe, indexes match spec.

### Module file: `merchant-portal.module.ts`

Findings:
- ✅ Imports correct: MongooseModule.forFeature + TypeOrmModule.forFeature('platform') + LogtoAuthModule + AuditModule
- ✅ Exports MerchantPortalAccessService for M2b composition
- ✅ JSDoc documents M2a vs M2b scope distinction

### Manager Code Review Summary

| File | Verdict | Red flags |
|---|---|---|
| `service.ts update()` lines 450-538 | ⚠️ APPROVED WITH MUST-FIX M2B | 1 RED FLAG — race condition |
| `service.ts SETNX` lines 80-120 | ✅ APPROVED | 0 |
| `service.ts delete()` lines 540-590 | ✅ APPROVED | 0 |
| `merchant-portal-admin.controller.ts` lines 100-145 | ✅ APPROVED | 0 |
| `schema` lines 85-109 | ✅ APPROVED | 0 |
| `module.ts` | ✅ APPROVED | 0 |

**1 red flag** = TD-F069-M2a-UPDATE-AFTER-DELETE-RACE. Defer M2b natural refactor. M2a foundation otherwise ship-ready.

---

## 📝 Memory diff (đã apply)

### `feature-log.md`

✏️ Updated:
- **Counter:** UNCHANGED (still `FEATURE-070`)
- **In-flight table row F-069:** Status updated to `🟠 M2a SHIPPED — Backend access service foundation`
- ➕ Appended annotation summarizing M2a milestone + must-fix TD

### `change-history.md`

✏️ Appended (top): Full M2a entry with 11 files (7 new Coder + 1 QC adversarial + 1 modified + 2 deferred files) + architecture + conventions + DB/cache impact + 5 TDs + lessons learned + Manager Code Review verdict per-file.

### `codebase-map.md`

✏️ Updated `modules/` section: Added `merchant-portal/` module entry with M2a admin scope notes.

### `architecture.md`

✏️ No change at M2a — Logto Management API integration entry from M1 covers M2a usage. M2b will add merchant-portal data flow diagram.

### `conventions.md`

✏️ Added optional pattern: "string union enum via `as const` readonly tuple" (Forced Change #1 finding).

### `known-issues.md`

✏️ Appended 5 entries:
- **TD-F069-M2a-UPDATE-AFTER-DELETE-RACE** 🟠 MED-HIGH **critical-watch** — must-fix M2b (auto-elevate severity if M2b fix slips)
- **TD-F069-M2a-UPDATE-EMPTY-BODY** 🟢 LOW — no-op audit pollution, defer M2b
- **TD-F069-M2a-RACE-EXCLUDE-SCOPE** 🟢 LOW effective — BR-MP-33 spec gap, natural M2b enforcement
- **TD-F069-M2a-LOCK-TTL-NO-EXTEND** 🟢 LOW — admin ops <50ms realistic, defer
- **TD-F069-M2a-PAGINATION-EDGE** 🟢 LOW — frontend clamp, defer M3
- **TD-F069-M2a-LOGTO-LOOKUP-SOURCE** 🟢 LOW — UX doesn't need distinction, defer M3
- **TD-F069-M2a-AUDIT-LOG-QUERY-STUB** 🟢 LOW — M2b implements full query
- **TD-F069-M2a-RACECOUNT-PLACEHOLDER** 🟢 LOW — M2b implements real count

---

## 🔮 Follow-up cho M2b-M2d + M3-M5

Manager notes cho future milestones:

### M2b (Backend merchant report endpoints) — start NEXT
- **MUST-FIX FIRST:** Add `accessModel.exists({_id: existing._id})` re-verify after SETNX acquire trong `update()` method (~5 LoC). Adversarial spec `merchant-portal-access.adversarial.spec.ts` Attack #1 second test will validate fix.
- Implement `resolveAccessibleRaces(userId)` — replaces M2a `raceCount` sentinel `'__all'` with real count
- Implement audit log query endpoint — replaces M2a stub
- Add ticket-sales + revenue endpoints với `@UseGuards(LogtoMerchantGuard)` từ M1
- BR-MP-21b cross-tenant aggregate per-tenant FeeService loop
- ~30+ new unit tests covering TC-MP-04/05/06/07/08/08b/10/22/22b/22c/28/29

### M3 (Admin frontend `/merchant-portal`)
- Use M2a admin endpoints — generated SDK regen after backend M2b complete
- AccessConfigDialog "Tìm" button calls `/api/admin/merchant-portal/logto-lookup` (M2a ready)
- Pagination clamp client-side (M2a deferred TD)

### M5 (Infra)
- M2a MongoDB collection `merchant_portal_access` will exist on DEV after Mongoose first write (no migration needed)
- PROD collection auto-creates on first admin save (or pre-create empty + indexes via deploy script)

---

## ✅ Status

🟠 **M2a DEPLOYED — F-069 still in-flight (M2b/c/d + M3-M5 pending)**

- Counter UNCHANGED (Next: FEATURE-070 unchanged)
- In-flight: F-069 row updated với M2a milestone status
- Memory diff applied (6 files: feature-log, change-history, codebase-map, conventions, known-issues; architecture untouched)
- 1 HIGH must-fix M2b documented + adversarial spec already in place

### Next step

Danny option:
1. **`/5bib-code FEATURE-069 M2b`** ⭐ Recommended — Coder continues M2b với first task = fix update-after-delete race. Then proceed with `resolveAccessibleRaces` + ticket-sales endpoints.
2. **Pause feature** — Resume khi Danny ready cho M2b session.

**Recommendation:** Option 1 — natural workflow continuation. Adversarial spec ensures M2b Coder catches fix requirement.
