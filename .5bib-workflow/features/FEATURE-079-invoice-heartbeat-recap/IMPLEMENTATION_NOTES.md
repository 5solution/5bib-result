# FEATURE-079 — Implementation Notes (Reviewer's Guide)

> Cô đọng cho Manager `/5bib-deploy` Code Review + QC Phase 1. Focus: **DEVIATIONS + FORCED + TRADEOFFS + REVIEWER HOTSPOTS**.

---

## Section 1: 🚧 Deviations from Spec (intentional)

### [Deviation #1] Constructor `raceTitleResolver` appended to END (sau redis) thay vì insert middle

- **Spec said:** PRD BR-79-22 + Plan Tech Approach: inject `AthleteIdentityClusteringService`. Vị trí trong constructor không spec rõ.
- **I did:** Append `@Optional() raceTitleResolver?` ở END của constructor — sau `redis`.
- **Why:** F-076 spec `invoice-reconcile.service.spec.ts` (8 existing tests) instantiates service trực tiếp với 5 positional args: `new InvoiceReconcileService(orderRepo, misa, alert, counters, redis)`. Insert resolver giữa `counters` và `redis` (middle position) sẽ break tất cả 5 calls — forced cascade fix tất cả test factories.
- **Reviewer should check:** Constructor signature `invoice-reconcile.service.ts:60-71` — verify Optional resolver ở vị trí cuối. NestJS DI resolves via metadata reflection KHÔNG position-based — runtime tự inject đúng.

### [Deviation #2] Cron spec dùng source assertion thay vì cron lib parse

- **Spec said:** TC-79-07 BA + Manager Plan: verify expression `'0 0 8,10,12,14,16,18,20,22 * * *'` parse đúng với cron-parser lib.
- **I did:** Source-level grep assertion (read file + regex match `@Cron('...')` decorator) + math verification (split comma-list, verify 8 distinct heartbeat hours spaced 2h apart).
- **Why:** `cron-parser` lib KHÔNG bundled trong `backend/package.json` (chỉ transitive `cron@4.3.0` via `@nestjs/schedule`). Direct `import 'cron'` fail TS2307 vì root-level `node_modules/cron` không exist (pnpm flat layout). Tradeoff: source assertion proves expression value, math verification proves semantics — `@nestjs/schedule` runtime validation đảm bảo expression PARSE đúng (boot fail nếu sai syntax).
- **Reviewer should check:** Source file `hourly-recap.cron.ts:23` chứa `'0 0 8,10,12,14,16,18,20,22 * * *'` verbatim. Boot smoke test (PAUSE-Coder-79-02) sẽ catch nếu syntax wrong — `@nestjs/schedule` registers cron via `cron` lib internally.

### [Deviation #3] Source file regex match accepts wildcard `[0-9,*-]+` for hour field

- **Spec said:** Verify hour field = `'8,10,12,14,16,18,20,22'` exact
- **I did:** Regex `@Cron\(['"](0 0 [0-9,*-]+ \* \* \*)['"]` accepts any valid hour field syntax; assertion then verifies exact match
- **Why:** Two-step (regex match → equality check) cho clearer error message khi assertion fails — points to ACTUAL value found vs expected.
- **Reviewer should check:** `hourly-recap.cron.spec.ts:27-37` — assertion stays strict, regex permissive only for capture.

---

## Section 2: ⚙️ Forced Changes (reality ≠ spec)

### [Forced #1] `RaceMasterDataModule.exports` thiếu `AthleteIdentityClusteringService`

- **PRD/Plan assumed:** Manager Plan section "Spot-Check 5 file" line "Service exported từ `RaceMasterDataModule.providers` line 117 → có thể import + inject." — đọc nhầm `providers` (line 117) thành `exports` (line 123, chỉ có `RaceAthleteLookupService`).
- **Reality:** `race-master-data.module.ts` line 109-124:
  ```typescript
  providers: [
    RaceMasterCacheService, RaceAthleteLookupService, AthleteIdentityClusteringService, // <- registered
    ...
  ],
  exports: [RaceAthleteLookupService],  // <- NOT including AthleteIdentityClusteringService
  ```
  NestJS cross-module DI requires service to be IN `exports[]` to inject từ consumer module. `providers[]` alone = internal-only.
- **Workaround:** Add `AthleteIdentityClusteringService` to `RaceMasterDataModule.exports[]` — minimal 1-line append. Zero logic change, only DI visibility widen.
- **Manager/BA action:**
  - **Update Manager Plan template:** Spot-check pattern cần phân biệt rõ `providers[]` (DI-internal) vs `exports[]` (cross-module). Pattern grep cho cross-module reuse: `grep -n "exports:" [target-module].module.ts`.
  - **codebase-map.md note:** Add "RaceMasterDataModule exports: RaceAthleteLookupService + AthleteIdentityClusteringService (F-079 extension)".
  - **conventions.md:** Reaffirm cross-module DI checklist — verify target service trong `exports[]` array trước khi inject.

### [Forced #2] — None other.

Toàn bộ Scope Lock 8 file modified theo Plan + 1 cascade module.exports — không có file path drift / method rename / field shape mismatch khác.

---

## Section 3: ⚖️ Tradeoffs Considered

| Decision | Option chosen | Alternative | Why chose | Cost paid |
|----------|---------------|-------------|-----------|-----------|
| Resolver wire pattern | Cross-module DI (InvoiceReconcileModule.imports RaceMasterDataModule) | Extract shared `RaceTitleResolverService` to `common/` module | Plan đề xuất Option A faster — F-049 method battle-tested 1 month PROD, NOT need re-engineering. Future extract tracked TD-F079-EXTRACT-RACE-TITLE-RESOLVER LOW priority | Cross-module dep coupling (InvoiceReconcile → RaceMasterData). Acceptable trade — both modules in same domain (invoice + race lifecycle). |
| Constructor resolver position | END of constructor (after redis) | Middle (between counters and redis) | Backward compat F-076 spec — 8 existing tests instantiate with 5 positional args. Avoid forced cascade. | Slight signature asymmetry — `@Optional()` resolver after `@Optional()` redis. Reader sees 2 optional tail — clear from doc comment. |
| Composer raceTitlesByid param | Optional with default `new Map()` | Required param | Backward compat — caller (alert service) had old 3-arg signature. Old code paths work without change. New code passes populated Map. | Slight overhead allocating empty Map per old call. Negligible — composer rarely called outside heartbeat flow. |
| skippedCount in DTO | Optional `?` field | Required field | Backward compat cached old reports (Redis `invoice-reconcile:last-run:<date>` 24h TTL) — old serialized JSON missing field, parse without throw. Composer defensive `?? 0`. | Composer reader needs `?? 0` fallback. 1-line defensive cost vs migration script for cache. |
| Cron test approach | Source assertion + Reflect metadata + math verification | Install `cron-parser` lib explicit | Avoid new dep + `pnpm install` PAUSE Manager. Source assertion deterministic + math proves semantic correctness. `@nestjs/schedule` runtime validates parse at boot. | Test cannot detect "valid but wrong" syntax at compile-time (vd hours 7,9 instead of 8,10). Boot smoke (PAUSE-Coder-79-02) catches before deploy. |
| Heartbeat header text | "Heartbeat" (All OK states) vs "Recap" (Có issue) — different headers | Single "Recap" header always | Visual differentiation — Danny + Hiền glance see "Heartbeat" = OK status, "Recap" = action needed. Reduces cognitive load. | Two header variants in code — maintain symmetry care needed. Composer 3-state branch keeps logic clean. |
| Diff label "2h trước" | Update from "1h trước" → "2h trước" | Keep "1h trước" generic | Accurate per new cron 2h tick. Misleading to say "1h" when actual interval is 2h. | None — minor text change. |

---

## Section 4: 🔬 Reviewer Notes (Manager + QC focus)

### Files cần review kỹ (priority order — Manager spot-check 5 file theo order này)

1. **`backend/src/modules/invoice-reconcile/services/invoice-reconcile.service.ts:60-71`** — Constructor signature + `@Optional()` resolver position (Deviation #1). Verify backward compat F-076 spec.
2. **`backend/src/modules/invoice-reconcile/services/invoice-reconcile.service.ts:521-548`** — `resolveRaceTitlesSafe()` defensive wrapper. Verify graceful 3-path fallback: no resolver / empty raceIds / resolver throws → all return empty Map. **CRITICAL** — heartbeat MUST NOT block per BR-79-23.
3. **`backend/src/modules/invoice-reconcile/services/alert-composer.ts:81-152`** — 3-state branch logic + `composeRaceTag()` + `computeNextHeartbeatHour()`. Verify TC-79-01/02/03 + escape XSS verbatim per PRD State templates.
4. **`backend/src/modules/race-master-data/race-master-data.module.ts:118-126`** — Forced #2 add to exports[]. Verify minimal 1-line change zero logic shift.
5. **`backend/src/modules/invoice-reconcile/crons/hourly-recap.cron.ts:22-26`** — Cron expression source. Verify exact value `'0 0 8,10,12,14,16,18,20,22 * * *'` + TZ + name unchanged.

### Concurrency hotspots

- `runHourlyRecap()` — relies on F-076 existing Redis snapshot guard (`master:rr-snapshot:<raceId>` 15s TTL). F-079 doesn't add new locking. TC-79-10 verifies 10x concurrent calls don't break (sendHourlyRecap may be called multiple times but composer pure function = no shared state).
- `resolveRaceTitlesSafe()` delegates to F-049 `getRaceTitlesByMysqlIds()` — F-049 uses Redis `mget` batch + setex per cache-miss = atomic per key. No race condition added.

### Edge cases I tested vs DEFERRED

- ✅ **Tested:**
  - 3-state composer branching (All OK / All OK + diff / Có issue)
  - Race title fallback `Race {raceId}` when title undefined (BR-79-23)
  - Race title escape XSS `<script>` (BR-79-24)
  - Race title truncate >80 char (BR-79-25)
  - Next heartbeat compute 8 hour values + 22 → "next day"
  - Multi-race title in Giải line
  - Skip removed verify (sendHourlyRecap CALLED when missing=0)
  - Telegram dispatch fail graceful
  - Resolver throw graceful empty Map
  - Resolver partial Map (1/2 races)
  - Resolver not wired (Optional inject undefined)
  - 10x concurrent runHourlyRecap
  - Cron expression source assertion + math verify
- ⚠️ **Deferred (acceptable — QC will verify):**
  - Live cron tick fire at exact ICT hour (boot integration — PAUSE-Coder-79-02 PROD smoke)
  - Telegram delivery actual `@invoice_5bib_daily_bot` group (PAUSE-Coder-79-02)
  - F-049 cache hit rate post-deploy (TD-F049-* if any)

### Type safety narrowed casts (Manager grep `as unknown as`)

- **None.** Zero `as unknown as` trong Scope Lock files. Few `as any` only in test files (mock object construction — acceptable).

### Security checklist self-applied

- [x] **Telegram bot token env-only** — `INVOICE_RECONCILE_TELEGRAM_BOT_TOKEN` reuse F-076 BR-14a isolation. Zero hardcode.
- [x] **escapeHtml() for race title** — TC-79-17 verifies XSS `<script>` escape (BR-79-24).
- [x] **SQL params** — N/A (Plan correction = no MySQL direct query, use Mongoose).
- [x] **No PII leak** — heartbeat renders: time, count, orderCode (`#5B...IB`), raceId, public race title, money. Zero PII.
- [x] **Defensive resolver fail** — `try/catch` in `resolveRaceTitlesSafe()` log.warn + return empty Map. Heartbeat MUST send (BR-79-23). Verified TC-79-13.
- [x] **Optional inject Resolver** — boot/test without RaceMasterDataModule = graceful, no MODULE_NOT_FOUND.
- [x] **Backward compat** — old cached Redis report missing `skippedCount` → composer `?? 0` defensive. Old composer callers (no 4th arg) → empty Map default.

### Performance numbers (qualitative, measured by test runtime)

- F-079 28 NEW tests run: ~3 seconds across 3 spec files
- Full regression sweep 185 tests / 12 suites: 13.8s = no SLA regression
- Composer pure function ~1KB string output per tick. Memory negligible.
- Resolver F-049 cache hit ratio expected 99%+ (race title rarely changes, 3600s TTL).

### F-076 race 220 smoke checklist (Manager `/5bib-deploy` PRE-MERGE — PAUSE-Coder-79-02)

Trước khi merge main, Danny/Manager phải verify:

```bash
# 1. Backend boot smoke
ssh 5solution-vps "docker logs 5bib-result-backend --tail 50 | grep 'InvoiceReconcileModule\|InvoiceHourlyRecapCron'"
# Expect: InvoiceHourlyRecapCron mapped + InvoiceReconcileModule initialized

# 2. Trigger manual + verify Telegram heartbeat dispatch
curl -X POST -H "Authorization: Bearer <admin>" https://result-dev.5bib.com/api/admin/invoice-reconcile/trigger
# Expect: 200 or 409 lock-aware

# 3. Wait for next heartbeat tick (8,10,12,14,16,18,20,22 ICT)
# Verify Telegram group nhận tin "📊 5BIB Invoice Heartbeat" với race title hiển thị

# 4. Verify F-049 race-master-data tests still PASS (no regression)
docker exec 5bib-result-backend npm test -- --testPathPattern "race-master-data|invoice-reconcile" --bail
```

---

## Summary

**Implementation:** 12 file changed (8 Scope Lock + 1 forced cascade + 3 spec). **28 NEW F-079 tests + 185/185 regression sweep PASS.** Backward compat 100% — F-076 6 existing tests + F-049 race-master-data tests intact post-cascade.

**Risk residual:**
- PAUSE-Coder-79-02 PROD smoke (cron tick + Telegram delivery) — Manager `/5bib-deploy` gate.
- PAUSE-Coder-79-03 deploy window 20h+ (race 220 peak avoidance) — Manager + Danny chốt.

**Recommendation:** Manager spot-check 5 files per Section 4 order. QC focus: TC-79-13 defensive fallback + TC-79-17 XSS escape + Forced #1 module.exports cascade verify.
