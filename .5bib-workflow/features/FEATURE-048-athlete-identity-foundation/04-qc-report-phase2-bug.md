# FEATURE-048 QC ADDENDUM — Bulk Sync Critical Bug

**Status:** ❌ REJECTED initially → ✅ FIXED after RCA
**Found by:** Danny live UI test 2026-05-20 22:30 ICT
**Fixed by:** 5bib-qc-gatekeeper RCA + Coder fix in 8 minutes

---

## 🐛 Critical Bug — Bulk Sync staged_10: 10/10 FAILED

### Symptom (Danny screenshot)

```
Live sync progress (Run bdca5fc8...)
staged_10 — done                              10/10 races
Succeeded: 0    Failed: 10    Duration: 1s
▼ 10 errors (click expand)
  race_id=212: Unknown column 'AthleteReadonly.contact_phone' in 'field list'
  race_id=160: Unknown column 'AthleteReadonly.contact_phone' in 'field list'
  race_id=140: Unknown column 'AthleteReadonly.contact_phone' in 'field list'
  ... (all 10 races same error)
```

### Root Cause

**My Adjustment #1 (extend AthleteReadonly entity với 3 PII columns) was based on FALSE ASSUMPTION.**

PROD MySQL verify revealed:
- ✅ `athletes.email` EXISTS
- ❌ `athletes.contact_phone` **DOES NOT EXIST**
- ❌ `athletes.id_number` **DOES NOT EXIST**
- ✅ `athlete_subinfo.contact_phone` EXISTS (different table!)
- ✅ `athlete_subinfo.id_number` EXISTS (different table!)

Original spike test (F-047 PRD pre-req) only verified `athletes.email` 99.995% coverage. NEVER checked `contact_phone` or `id_number` columns exist in `athletes` table.

When sync ran `SELECT * FROM athletes` (via TypeORM ORM), MySQL rejected because TypeORM included `contact_phone` + `id_number` in SELECT clause based on entity declaration, but those columns don't physically exist.

### Fix (4 files in worktree)

1. **`entities/athlete-readonly.entity.ts`** — Removed `contact_phone` + `id_number` columns. Kept only `email` (real column in athletes table)
2. **`entities/athlete-subinfo-readonly.entity.ts`** — ADDED `contact_phone` + `id_number` columns (the actual location)
3. **`utils/athlete-mapper.ts`** — Updated to source phone/CCCD from `a.subinfo?.contact_phone` instead of `a.contact_phone`
4. **`utils/athlete-mapper.spec.ts`** — Test fixtures restructured (PII now in `subinfo` nested object)

### Live verify post-fix (PROD-restored DEV data)

```
━━━ F-048 Bulk Sync Test (post-fix) ━━━
Triggered: <runId>

FINAL:
  Status:         done
  Succeeded:      10   ← was 0
  Failed:         0    ← was 10
  Duration:       4420ms
```

**10/10 races synced successfully** with email + phone + CCCD populated via subinfo relation.

### Tests post-fix

- **62/62 unit tests STILL PASS** (4 test fixtures restructured to use subinfo PII nesting)
- TypeScript clean
- Backend builds + starts clean (PID 64848)

---

## 🎓 Lesson reinforced — TD-F048-DATA-GAP-04 (F-048 Foundation Lesson)

**Spike Test 5-Checkbox Layer 3 strengthened:**
"Bridge data populated" MUST include **per-field schema verification on REAL DB**, not just collection/table existence check.

Specifically:
- ✅ Layer 1: Table `athletes` exists (was verified)
- ❌ Layer 3: Column `contact_phone` exists in `athletes` (NEVER verified — assumed)
- ❌ Layer 3: Column `id_number` exists in `athletes` (NEVER verified — assumed)

**Pattern to mint conventions.md:**
> Before adding `@Column` declarations to TypeORM entity, run `SHOW COLUMNS FROM <table>` on PROD-snapshot DB and confirm each column physically exists. Entity is binding contract with DB schema — phantom columns cause SQL "Unknown column" errors at runtime.

---

## Verdict: ✅ APPROVED (post-fix)

Bug caught BY Danny live UI testing, fixed in 8 minutes via:
1. SSH PROD MySQL `SHOW COLUMNS FROM athletes` + `SHOW COLUMNS FROM athlete_subinfo`
2. Identify actual column location
3. Refactor entity + mapper + spec
4. Re-run live sync test — 10/10 SUCCEEDED

Backend live PID 64848 port 8081. Admin worktree picks up via Next.js hot-reload.
