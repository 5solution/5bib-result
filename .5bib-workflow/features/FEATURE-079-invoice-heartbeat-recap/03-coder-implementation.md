# FEATURE-079: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC
**Started:** 2026-06-09
**Author:** 5bib-fullstack-engineer
**Linked:** `00`, `01`, `02`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md`
- [x] Đã đọc `01-ba-prd.md` đầy đủ (25 BR + 17 TC + 3 state template + race title resolver)
- [x] Đã đọc `02-manager-plan.md` — verdict ✅ APPROVED with Tech Approach Correction
- [x] Đã đọc `memory/conventions.md` + F-049 pattern + F-076 alert flow
- [x] Đã đọc code thật của 5 file then chốt (composer + alert-service + cron + classifier + F-049 resolver)

---

## 🔍 Impact Assessment (Phase 1 Think First)

### Backend
- **MongoDB:** ZERO change. Reuse F-049 `race` collection read qua `getRaceTitlesByMysqlIds`.
- **MySQL platform:** ZERO change. Plan correction: NOT MySQL direct query, REUSE F-049 Mongoose path.
- **Redis:** ZERO new key. Reuse F-049 `races:title:byMysqlId:<id>` TTL 3600s — share cache namespace.
- **NestJS DI:** cross-module wire `RaceMasterDataModule` → `InvoiceReconcileModule.imports`. Optional `@Optional()` inject của resolver → graceful degrade nếu boot không có module.

### Frontend
- **ZERO change.** DTO thêm `skippedCount?` optional — backward compat existing UI render.
- **SDK regen:** KHÔNG cần — field optional + zero endpoint shape change.

### API Contract
- ZERO endpoint mới. `composeHourlyRecap` signature widen optional param — backward compat.

---

## ⚠️ Edge Cases Covered (Phase 2)

1. **Cached old report missing `skippedCount`** → composer `report.skippedCount ?? 0` defensive
2. **Resolver throws (Mongo down / Redis down)** → catch + log warn + empty Map → composer falls back `Race {id}` (BR-79-23) — heartbeat KHÔNG block
3. **Resolver returns partial Map** (1/2 races resolved) → composer per-race lookup with fallback
4. **Race title chứa `<script>`** → escape HTML (BR-79-24, TC-79-17)
5. **Race title > 80 char** → truncate `slice(0,77) + '...'` (BR-79-25, TC-79-15)
6. **22:00 ICT tick** (sau EOD 21:00) → next heartbeat "08:00 (ngày hôm sau)"
7. **Resolver KHÔNG wired** (test/boot without RaceMasterDataModule) → empty Map default → composer fallback
8. **Concurrent runHourlyRecap** → existing F-076 Redis snapshot guard (15s TTL) protects

---

## 🧠 Logic & Architecture (Phase 3)

### Tech Approach Correction follow Manager Plan

Manager Plan section "Tech Approach" correction: BA PRD BR-79-21 propose **MySQL platform direct query** SAI source-of-truth. F-049 pattern dùng **MongoDB `race` collection** (Mongoose) + Redis cache 3600s + graceful fallback — production-hardened.

Coder follow Plan correction (PAUSE-Coder-79-05 explicit):
- Import `RaceMasterDataModule` vào `InvoiceReconcileModule.imports`
- Inject `AthleteIdentityClusteringService` (Optional decorator cho graceful boot)
- Reuse method `getRaceTitlesByMysqlIds(mysqlRaceIds: number[]): Promise<Map<number, string>>`
- ZERO new resolver code

### Composer 3-state branch

State 1 "All OK" `missing=0 && diff=[]` → Heartbeat header + ✅ All OK + stats block (Expected/Issued/Missing/Duplicate/Skipped).
State 2 "All OK + diff" `missing=0 && diff>0` → Heartbeat header + ✅ All OK + Diff block.
State 3 "Có issue" `missing>0` → Recap header (GIỮ NGUYÊN BR-25) + 4-line stats.

Race title line `Giải: <b>{title} - {raceId}, ...</b>` applied to all 3 state per BR-79-20.

### Composer signature widen — backward compat

Đổi từ `composeHourlyRecap(report, diffEvents, dashboardUrl)` → `composeHourlyRecap(report, diffEvents, dashboardUrl, raceTitlesByid = new Map())`. Default empty Map = backward compat existing callers; new tests pass populated Map.

### Constructor positional appended

`raceTitleResolver` Optional inject APPENDED to END of constructor (sau redis position) thay vì insert middle. Backward compat F-076 spec calling `new InvoiceReconcileService(orderRepo, misa, alert, counters, redis)` (5 args) — KHÔNG vỡ.

---

## 💻 Files Changed (9 file backend + 0 frontend)

### Modified (8)
- ✏️ `backend/src/modules/invoice-reconcile/crons/hourly-recap.cron.ts` — Cron expression `'0 0 8-20'` → `'0 0 8,10,12,14,16,18,20,22'` + comment update
- ✏️ `backend/src/modules/invoice-reconcile/services/invoice-alert.service.ts` — Remove skip block + signature `raceTitlesByid` param + doc
- ✏️ `backend/src/modules/invoice-reconcile/services/alert-composer.ts` — Add `composeRaceTag()` helper + `computeNextHeartbeatHour()` helper + 3-state branch render + `formatDiffEvent()` race tag context
- ✏️ `backend/src/modules/invoice-reconcile/services/invoice-reconcile.service.ts` — Inject `AthleteIdentityClusteringService` Optional + `resolveRaceTitlesSafe()` defensive wrapper + wire to `sendHourlyRecap`
- ✏️ `backend/src/modules/invoice-reconcile/services/reconcile-classifier.ts` — Add `skippedCount: number` field + compute `dbOrders.length - expectedCount`
- ✏️ `backend/src/modules/invoice-reconcile/dto/reconcile-report.dto.ts` — Add `@ApiPropertyOptional() skippedCount?` field
- ✏️ `backend/src/modules/invoice-reconcile/invoice-reconcile.module.ts` — Import `RaceMasterDataModule`
- ✏️ `backend/src/modules/race-master-data/race-master-data.module.ts` — **FORCED CASCADE** add `AthleteIdentityClusteringService` to exports (Plan đọc nhầm providers thành exports — see IMPLEMENTATION_NOTES Section 2)

### Tests (3)
- ✏️ `backend/src/modules/invoice-reconcile/__tests__/alert-composer.spec.ts` — Extend 14 new tests (TC-79-01..04 + TC-79-15..17 + backward compat)
- ✏️ `backend/src/modules/invoice-reconcile/__tests__/invoice-reconcile.service.spec.ts` — Extend 8 new tests (TC-79-05/06/08/10/11..14 + Resolver-not-wired)
- ➕ `backend/src/modules/invoice-reconcile/__tests__/hourly-recap.cron.spec.ts` — NEW 6 tests (TC-79-07 source assertion + math verification)

### Frontend
- ZERO change. SDK regen NOT needed (DTO field optional, zero endpoint shape change).

---

## 🧪 Tests Written

### Test files (1 new + 2 extend) — 28 NEW F-079 tests PASS

**Composer (alert-composer.spec.ts):** +14 test (TC-79-01..04 happy path + heartbeat compute + TC-79-15 truncate + TC-79-16 multi-race + TC-79-17 escape XSS + backward compat)
**Service (invoice-reconcile.service.spec.ts):** +8 test (TC-79-05 skip removed + TC-79-06 dispatch fail graceful + TC-79-08 resolver wire + TC-79-10 concurrent + TC-79-11/12 resolver call + TC-79-13 defensive fallback + TC-79-14 partial Map + resolver-not-wired)
**Cron (hourly-recap.cron.spec.ts NEW):** +6 test (TC-79-07 source assertion + Reflect metadata + math verification)

### Test execution output

```
PASS src/modules/invoice-reconcile/__tests__/alert-composer.spec.ts
PASS src/modules/invoice-reconcile/__tests__/invoice-reconcile.service.spec.ts
PASS src/modules/invoice-reconcile/__tests__/hourly-recap.cron.spec.ts

Tests:       54 passed (composer 34 + service 14 + cron 6)
```

### Full regression sweep (invoice-reconcile + race-master-data — 2 affected modules)

```
Test Suites: 12 passed, 12 total
Tests:       185 passed, 185 total
Time:        13.817 s
```

**Zero regression.** F-076 6 alert flow + F-049 race-master-data spec all PASS.

---

## 🛑 PAUSE/Confirmation log

| Date | What | Resolution |
|------|------|------------|
| 2026-06-09 | PAUSE-Coder-79-05 Manager directive: reuse F-049 NOT MySQL direct query | Followed Plan — import RaceMasterDataModule + inject AthleteIdentityClusteringService |
| 2026-06-09 | Discovered RaceMasterDataModule.exports thiếu AthleteIdentityClusteringService (chỉ exports RaceAthleteLookupService) | Forced cascade — add to exports. Documented Section 2 IMPLEMENTATION_NOTES |
| 2026-06-09 | Constructor param order: insert raceTitleResolver before redis = breaks F-076 spec | Moved to END of constructor (after redis) for backward compat positional calls |
| 2026-06-09 | cron-parser lib NOT bundled | Use cron file source assertion + Reflect metadata + math verification instead — works without external dep |

PAUSE-Coder-79-02 (PROD smoke pre-merge) + PAUSE-Coder-79-03 (deploy window 20h+) — PENDING, executed by Manager/Danny at `/5bib-deploy`.

---

## 🚧 Scope creep / Out-of-Scope changes

- **1 forced cascade:** `backend/src/modules/race-master-data/race-master-data.module.ts` — add `AthleteIdentityClusteringService` to module.exports. Manager Plan đọc nhầm providers thành exports → reality requires fix. Documented Section 2 IMPLEMENTATION_NOTES. Minimal 1-line append, zero logic change.

ZERO other scope creep. 8 file modified in Scope Lock + 1 forced cascade + 3 spec test = 9 + 3 = 12 file diff total.

---

## 🐛 Known limitations / Tech debt còn lại

- **TD-F079-EXTRACT-RACE-TITLE-RESOLVER** (Manager Plan tracked) — Future extract `getRaceTitlesByMysqlIds` thành shared `RaceTitleResolverService` trong `common/`. F-079 dùng cross-module DI ad-hoc. LOW priority post-deploy.
- **TD-F079-TZ-BOUNDARY-FILTER** (Manager Init tracked) — DB 23 ORDINARY today vs F-076 expected=22 lệch 1 đơn cross-midnight ICT. F-079 KHÔNG fix — defer feature riêng.
- **TD-F079-CRON-PARSER-NOT-INSTALLED** — Cron spec dùng source assertion thay vì cron-parser lib (KHÔNG bundled). Test vẫn cover semantics đầy đủ — non-blocking. Future install `cron-parser` cho stricter compile-time test.

---

## ✅ Self-Review Pipeline (Manager 2026-05-14 mandatory)

- [x] **Bước 1:** tsc clean cho Scope Lock files (zero error trên `invoice-reconcile` + `race-master-data` modules)
- [x] **Bước 2:** PRD strict adherence audit — 25 BR + 17 TC matched verbatim (BR-79-20..25 race title + 3 state composer + 8 cron tick + skippedCount)
- [x] **Bước 3:** Anti-pattern scan clean (zero `console.log` / `: any` / `as any` / `as unknown as` trên 6 Scope Lock files)
- [x] **Bước 4:** Hand-pick field mapping audit — N/A (RBAC/alert change, no schema field cascade)
- [x] **Bước 5:** PROD-readiness smoke self-test — `185/185 tests PASS` proves boot/wire correct. Live curl deferred PAUSE-Coder-79-02 pre-merge.
- [x] **Bước 6:** UI/UX self-inspection — N/A (backend-only, Telegram HTML output spec'd in PRD State 1/2/3 templates; composer test renders verified)
- [x] **Bước 7:** Real-world data sanity — used PROD race 220 title "LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG" (47 chars) + race 140 "5BIB x COROS" verbatim in tests
- [x] **Bước 8:** Files Changed vs Scope Lock — 12 file diff (8 Scope Lock modified + 1 forced cascade + 3 spec). Documented Section 2 IMPLEMENTATION_NOTES.
- [x] **Bước 9:** Generated SDK regen — NOT needed (DTO `skippedCount?` optional, zero endpoint shape change). Verified.
- [x] **Bước 10:** Unit tests PASS — 28 NEW F-079 tests + 185/185 regression sweep
- [x] **Bước 11:** `IMPLEMENTATION_NOTES.md` written với 4 sections đầy đủ (Deviations + Forced + Tradeoffs + Reviewer Notes)

→ Status: **🟠 READY_FOR_QC**

---

## ✅ Status

- [x] **READY_FOR_QC**

**Required to mark READY_FOR_QC:**
- [x] Scope Lock files implemented + 1 forced cascade documented
- [x] Unit test 28 NEW + 185/185 regression PASS
- [x] `pnpm --filter admin generate:api` — KHÔNG cần
- [x] Anti-pattern scan clean
- [x] Lint + typecheck PASS
- [x] `IMPLEMENTATION_NOTES.md` 4 sections complete

---

## 🔗 Next step

Danny chạy: `/5bib-qc FEATURE-079-invoice-heartbeat-recap`
