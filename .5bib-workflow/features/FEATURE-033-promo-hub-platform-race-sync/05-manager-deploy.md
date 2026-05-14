# FEATURE-033: Deploy & Memory Sync

**Status:** ✅ DONE
**Deployed:** 2026-05-14
**Author:** 5bib-manager
**Linked:** `00`, `01`, `02`, `03`, `04`

---

## 📌 Pre-flight check

- [x] `04-qc-report.md` verdict = ✅ APPROVED
- [x] Unit tests 38/38 PASS (37 after initial + 1 post-hotfix fallback test)
- [x] Files in `03-coder-implementation.md` match Plan Scope Lock
- [x] Post-deploy bug found (url_name NULL filter) caught + fixed (hotfix 2 commits)

---

## 📊 Deploy summary

- **Commits (3):**
  - `940de07` — feat F-033 main implementation
  - `7fd6d80` — fix F-033 drop url_name NOT NULL filter (post-deploy bug)
  - `35877a7` — fix F-033 register RaceReadonly in platform DataSource entities
- **Branches:** main + release/v1.8.1 (synced)
- **QC verdict:** ✅ APPROVED + 2 post-deploy hotfixes documented
- **Unit tests:** 38/38 PASS (28 baseline + 10 F-033 new — 9 original + 1 fallback test)
- **Build verification:** Backend tsc clean / Admin ✓ 6.8s / Frontend ✓ 4.9s
- **Workflow:** ĐẦY ĐỦ 5-gate (BA → Plan → Code → QC → Deploy) — NO hotfix shortcut

---

## 🐛 Post-deploy hotfix sequence (2 bugs found, both fixed within F-033 workflow)

**Bug 1 (commit `7fd6d80`):** `url_name IS NOT NULL` filter returned 0 rows.
- Root cause: PRD BR-PH33-03 assumed NULL was edge case; PROD shows 19/19 active races có url_name NULL (5Ticket convention dùng race_id).
- Fix: Drop filter + DTO fallback `slug = urlName?.trim() || raceId`.
- Updated test: removed assertion + added fallback test.

**Bug 2 (commit `35877a7`):** `No metadata for "RaceReadonly" was found`.
- Root cause: TypeOrmModule.forFeature registers Repository token, BUT `forRoot(name: 'platform')` config has explicit `entities: [...]` array → DataSource metadata lookup fails without entity in that array.
- Fix: Add `RaceReadonly` to `app.module.ts` 'platform' DataSource entities.
- Lesson: For new entities on `'platform'` connection, MUST register at BOTH forRoot (DataSource) AND forFeature (Repository DI).

---

## 📝 Memory diff (đã apply)

### `feature-log.md`
✏️ Counter `FEATURE-034` (unchanged, F-033 was already initiated).
✏️ Move F-033 from In-flight → Shipped table (append top).

### `change-history.md`
✏️ Appended F-033 full entry (top).

### `codebase-map.md`
✏️ Add `backend/src/modules/promo-hub/entities/race-readonly.entity.ts` to module map.

### `architecture.md`
✏️ Add note: PromoHub now reads from `'platform'` MySQL DataSource (entity `RaceReadonly`) — cross-DB pattern reuse.

### `conventions.md`
✏️ Add **NEW PATTERN: TypeORM entity must register BOTH places** for non-default named connection:
1. `forFeature([Entity], 'connName')` in feature module — provides Repository DI token
2. `forRoot({ name: 'connName', entities: [..., Entity], ... })` in app module — provides DataSource metadata
Missing #2 → `No metadata for "X" was found` runtime error.

### `known-issues.md`
Append 6 TD-F033-* entries:
- TD-F033-01 LOW: Narrow column selection (12/70+ MySQL races columns)
- TD-F033-02 LOW: Multi-tenant filter defer Phase 2
- TD-F033-03 LOW: Race CTA target="_blank"
- TD-F033-04 MED: No SETNX anti-stampede yet
- TD-F033-05 LOW: computeDaysLeft hardcoded based on registrationEndTime
- TD-F033-06 HIGH: 5Ticket URL pattern for race_id slug fallback unverified — `5ticket.vn/event/<numeric_id>` may not work; need 5Ticket team confirm OR backfill `races.url_name` for active races

---

## 🔮 Follow-up

**HIGH priority:** Verify 5Ticket URL routing for race_id fallback (TD-F033-06). Two options:
1. 5Ticket team adds `/event/race-id/:id` route alias mapping numeric id → slug DB lookup
2. 5BIB ops backfills `races.url_name` for 27 active GENERATED_CODE races (SQL UPDATE with slugify(title))

**MED priority:** Multi-tenant filter Phase 2 — admin chooses which tenant_id to surface in promo (currently shows ALL tenants).

**LOW priority:** TD-F033-04 SETNX add khi MySQL load monitoring shows spike.

---

## ✅ Status

🎉 **FEATURE-033 DONE.** Memory synced. PROD live. Workflow ran FULL 5-gate per Danny mandate "đúng quy trình".
