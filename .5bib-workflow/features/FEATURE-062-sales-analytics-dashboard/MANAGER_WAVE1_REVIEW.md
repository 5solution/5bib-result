# FEATURE-062 Wave 1 — Manager Independent Review Checkpoint

**Status:** ✅ **APPROVED — Wave 1 ship-able WITH 1 mandatory Wave 2 follow-up (MoM boundary rollover bug)**
**Reviewed:** 2026-05-22
**Reviewer:** 5bib-manager
**Linked:** `04-qc-report.md` (QC ✅ APPROVED), `IMPLEMENTATION_NOTES.md` (Coder's reviewer guide)
**Branch:** `5bib_analytics_v2` commit `53d2ec1`
**Note:** This is **NOT** `05-manager-deploy.md` (that file reserved for Wave 5 full F-062 ship). Wave 1 = infrastructure foundation slice — partial deploy decision documented here.

---

## 🔬 Manager Independent Code Review (5+ files spot-checked per Manager 2026-05-17 directive)

### BƯỚC 0 — Read IMPLEMENTATION_NOTES.md FIRST ✅
- Section 1: 4 Deviations documented (5s-blue alias / CompareKind keep custom / wow 7-day shift / ERROR_MESSAGE rename)
- Section 2: 3 Forced Changes (4 tab pages exist as raw-fetch / GA4 dep not installed / branch start state)
- Section 3: 6 Tradeoffs với cost-paid column rõ ràng
- Section 4: Priority list 6 file paths cho Manager spot-check

### Spot-check results

| File | Lines | Verdict | Note |
|------|-------|---------|------|
| `period-resolver.ts:22-34` | Type declarations | ✅ CLEAN | 3 enum tách rõ ràng. PeriodKind 6 GIỮ, GranularityKind 3 NEW, CompareKind 6 EXTEND. Documentation header semantic correct. |
| `period-resolver.ts:199-209` | wow branch | ✅ CLEAN | `SEVEN_DAYS_MS = 7*24*60*60*1000` chính xác. Shift symmetric cả from + to. Period length preserved. |
| `period-resolver.ts:211-222` | **mom branch** | 🔴 **RED FLAG — boundary rollover BUG** | `setUTCMonth(-1)` JS Date built-in rolls over khi source day > target month days. See detail below. |
| `period-resolver.ts:244-269` | resolveBucketSize | ✅ CLEAN | Enum-constrained input (no SQL injection vector). Exhaustiveness check via `never` type default branch. SQL expr strings static const. |
| `period-resolver.f062.spec.ts:81-89` | mom test | 🟡 **GAP** | Chỉ test day=22 (safe case). KHÔNG test boundary day=29/30/31. Coder claim "boundary handled correctly" — NOT VERIFIED, actually WRONG. |
| `analytics-labels.ts:202-211` | ERROR_MESSAGE rename | ✅ ACCEPTABLE | TS strict mode constraint legitimate. Deviation #4 documented honest. PRD addendum needed. |
| `globals.css:118-125` | 5s-blue alias chain | ✅ ELEGANT | `var(--5bib-info)` delegate pattern = single source of truth. No hex duplicate. Coder Deviation #1 well-justified. |

---

## 🔴 RED FLAG #1 — MoM boundary rollover bug (LATENT, MEDIUM severity)

### Reproduction (verified via Node REPL)

```javascript
// Coder logic (period-resolver.ts:213-222):
const from = new Date('2026-05-31T00:00:00.000Z');
from.setUTCMonth(from.getUTCMonth() - 1); // setUTCMonth(3) = April

// JS behavior: April has 30 days, but day 31 preserved → rolls over to May 1
// Result: from = 2026-05-01T00:00:00.000Z (BUG! Should be April 30 per business intent)
```

### Verified test matrix

| Current `fromIso` | Expected MoM `fromIso` | Coder's Actual Output | Bug? |
|-------------------|------------------------|----------------------|------|
| `2026-05-22` (day 22, safe) | `2026-04-22` | `2026-04-22` | ✅ NO |
| `2026-05-31` (day 31, May→April rollover) | `2026-04-30` | `2026-05-01` | 🔴 **YES** |
| `2026-01-31` (Jan→Dec, Dec has 31 days) | `2025-12-31` | `2025-12-31` | ✅ NO (Coder claim valid here) |
| `2024-03-29` (leap Feb, day 29 → Feb 29 OK) | `2024-02-29` | `2024-02-29` | ✅ NO |

### Business impact assessment

- **Wave 1 SHIP**: ✅ NOT affected — no backend endpoint wires `compare=mom` Wave 1
- **Wave 2-3 wire CompareSelector → backend `?compare=mom`**: 🔴 BUG MANIFEST
- **Worst-case scenario**: Marketing team picks "Tháng này (1-31 May)" period → MoM toggle → frontend shows "kỳ trước (May 1-30)" instead of "kỳ trước (April 30 - May 30)". Numbers will appear suspiciously similar to current period. Could lead to incorrect "MoM growth = 0%" reporting → wrong business decisions.
- **Probability**: HIGH if user uses month-end custom period or natural calendar months
- **Severity**: 🟡 MEDIUM — latent now, BLOCKER khi wire Wave 2

### Coder's claim vs reality

Coder's IMPLEMENTATION_NOTES.md Section 4 claims:
> `resolveCompare('mom')` edge case "31 January → MoM" (Date.setUTCMonth shift behavior) — JavaScript Date built-in handles correctly ... Other dates edge cases tested by extension via period-resolver existing regression.

**Manager verdict:** Claim is PARTIALLY TRUE (Jan 31 → Dec 31 works because Dec has 31 days) but generalized INCORRECTLY. The Anti-pattern "Đọc file nhưng skip business logic check" applies — Coder tested visual sanity but missed semantic boundary.

This is exactly the type of latent bug Manager Independent Review is designed to catch — defense-in-depth justified.

### Required fix (Wave 2 PAUSE before wiring `compare=mom` backend)

```diff
  if (compare.kind === 'mom') {
-   const from = new Date(curFrom.getTime());
-   from.setUTCMonth(from.getUTCMonth() - 1);
-   const to = new Date(curTo.getTime());
-   to.setUTCMonth(to.getUTCMonth() - 1);
+   // Use clamp-to-last-day-of-month pattern to avoid setUTCMonth rollover.
+   const from = shiftMonthClamped(curFrom, -1);
+   const to = shiftMonthClamped(curTo, -1);
    return { ... };
  }
+
+ /**
+  * Shift date by N months, clamping day to last-day-of-target-month
+  * to avoid setUTCMonth rollover (e.g., May 31 setUTCMonth(-1) → May 1 instead of April 30).
+  */
+ function shiftMonthClamped(date: Date, months: number): Date {
+   const target = new Date(Date.UTC(
+     date.getUTCFullYear(),
+     date.getUTCMonth() + months + 1,
+     0  // day 0 of next month = last day of target month
+   ));
+   const targetLastDay = target.getUTCDate();
+   const clampedDay = Math.min(date.getUTCDate(), targetLastDay);
+   return new Date(Date.UTC(
+     date.getUTCFullYear(),
+     date.getUTCMonth() + months,
+     clampedDay,
+     date.getUTCHours(),
+     date.getUTCMinutes(),
+     date.getUTCSeconds()
+   ));
+ }
```

Plus add boundary tests:
```typescript
it('mom: handles May 31 (31-day month) → April 30 (30-day month) WITHOUT rollover', () => {
  const periodMay31 = resolvePeriod({ kind: 'custom', from: '2026-05-31', to: '2026-05-31' });
  const result = resolveCompare(periodMay31, { kind: 'mom' });
  // Expected: April 30, NOT May 1
  expect(result!.fromIso.slice(0, 10)).toBe('2026-04-30');
});
```

---

## ✅ Other findings (informational, not blockers)

### Adj #1 GranularityKind split — clean
- 3 enum tách bạch đúng semantic
- Backward compat F-026 verified (77/77 analytics tests PASS)
- Type-level rejection của `'weekly'`/`'monthly'` trong PeriodKind verified via @ts-expect-error

### Adj #3 Selector split 3 components — clean
- GranularityToggle / PeriodSelector / CompareSelector 3 file riêng
- Old PeriodCompareSelector.tsx `@deprecated` mark + backward compat preserved
- Only 1 in-flight caller (`analytics/page.tsx:22`) — will migrate Wave 3

### Adj #5 5Solution brand tokens — elegant
- Alias chain `var(--5s-blue) → var(--5bib-info) → #1D49FF` = single source of truth
- Coder Deviation #1 well-justified (no hex drift if Marketing rebrand)
- HEALTH_TIER_COLOR map binds `var(--5s-blue)` in analytics-labels.ts:55

### Deviation #2 CompareKind keep `'custom'` — justified
- Backend type keep 6 values (backward compat F-026)
- Frontend CompareSelector OPTIONS array show 5 (skip custom per PRD)
- Discrepancy documented Section 1 Deviation #2

### Deviation #4 ERROR_MESSAGE rename — acceptable
- TS strict mode constraint legitimate (numeric-prefix identifier reject)
- Suffix `_<code>` ergonomic for consumers
- PRD addendum needed to align spec with code

### Forced Change #1 — 4 tab pages exist
- Verified via `wc -l` on 4 page.tsx files (282 + 439 + 443 + 366 = 1530 LoC)
- Wave 3 REFACTOR plan documented
- codebase-map.md needs update (defer until Wave 5)

### Forced Change #2 — GA4 dep defer
- Danny approved PAUSE 2026-05-22
- Wave 2 will install + implement Ga4Service

### Forced Change #3 — branch hygiene
- Switch sang `5bib_analytics_v2` clean, working tree preserved

---

## 🚦 Manager Verdict

### ✅ Wave 1 SHIP-ABLE — APPROVED WITH 1 BLOCKING TD FOR WAVE 2

**Justification:**
1. Wave 1 = pure infrastructure, no consumer of `'mom'` yet → MoM bug LATENT
2. All 6 BRs implemented per spec (with documented deviations)
3. 77/77 analytics regression PASS
4. Coder honest documentation (4 Deviations + 3 Forced Changes + 6 Tradeoffs)
5. 0 anti-patterns / 0 scope creep / 0 SQL injection / 0 PII exposure
6. Adj #1/3/5 verified semantic correct
7. Type safety preserved (no `as unknown as`, narrowed type assertions only in F-026 controller cast = acceptable inheritance)

**Mandatory Wave 2 actions:**
- 🔴 **TD-F062-MOM-BOUNDARY-ROLLOVER** (Manager finding, NEW) — BLOCKING fix before wire CompareSelector → backend endpoints accept `?compare=mom`. ~30 min fix per code suggestion above + 1 boundary test case.
- 🟡 TD-F062-VALIDATION-COMPAREKIND (QC finding) — add `@IsEnum` decorator to AnalyticsQueryDto
- ⚪ TD-F062-F026-SILENT-CAPABILITY-EXPANSION (QC finding) — decide market as feature OR add explicit guard
- ⚪ TD-F062-PRD-SECTION-3.4-DTO-IMPORT-OVERLAP (Coder Forced #1) — PRD update + codebase-map.md note

---

## 📅 Phasing Decision

> Per Danny request: Option A defer-to-Wave-5 / Option B mini-deploy / Option C hybrid.

### Manager recommendation: **Option B — Mini-deploy Wave 1 với LIMITED memory sync**

**Rationale:**
- Wave 1 = 4064 LoC delta manageable (vs ~8,405 LoC full F-062 would be too big single deploy)
- Branch `5bib_analytics_v2` will live ~3-5 weeks pending Wave 2-5 — stale branch risk
- 4 NEW TDs need tracking now (especially MoM bug — easy to forget Wave 2)
- KHÔNG counter sync `feature-log.md` (F-062 still in-flight, Wave 5 final ship sẽ counter bump)
- KHÔNG move to Shipped table (Wave 5 sẽ do)
- DO update In-flight section + known-issues + change-history với "Wave 1 partial" note

### Memory diff applied Wave 1 (limited scope)

#### `known-issues.md` — ADD 4 NEW TDs

```markdown
| **TD-F062-MOM-BOUNDARY-ROLLOVER** 🟡 MED | analytics / period-resolver | `resolveCompare('mom')` setUTCMonth(-1) rolls over khi source day > target month days (vd: May 31 → May 1 instead of April 30). Latent Wave 1 (no consumer), BLOCKING Wave 2 wire CompareSelector → backend endpoint. | Manager spot-check 2026-05-22 caught | Wave 2 Coder — replace setUTCMonth with shiftMonthClamped pattern per MANAGER_WAVE1_REVIEW.md code suggestion + add day=31 boundary test |
| **TD-F062-VALIDATION-COMPAREKIND** 🟢 LOW | analytics / controller | `analytics.controller.ts` 4 sites cast `q.compareWith as CompareKind` accept any string. Wave 2 should add `@IsEnum(['prev','yoy','custom','none','wow','mom'])` decorator vào `AnalyticsQueryDto.compareWith`. | QC adversarial Wave 1 | Wave 2 — ~5 LoC fix |
| **TD-F062-F026-SILENT-CAPABILITY-EXPANSION** 🟢 INFORMATIONAL | analytics / 6 F-026 endpoints | Adj #1 CompareKind extend silently adds wow/mom capability cho 6 F-026 endpoint cũ. Cache key namespace separate (no collision). | QC Wave 1 finding | Wave 5 decide: market as feature OR add guard restrict F-026 chỉ accept original 4 values |
| **TD-F062-PRD-SECTION-3.4-DTO-IMPORT-OVERLAP** 🟢 LOW | docs / PRD v3 + memory codebase-map | PRD Section 3.4.2 list 4 tab pages NEW nhưng codebase đã có 1530 LoC raw-fetch implementations. | Coder Forced Change #1 | Wave 3 (when REFACTOR pages) — update PRD addendum + codebase-map.md analytics section note "4 pages exist từ F-026 era" |
```

#### `feature-log.md` — In-flight section UPDATE

```diff
 | F-039 | Analytics Per-Event & Per-Day Enhancement | 🟡 INITIATED (defer pending Danny quyết) | — | 2026-05-15 (stale 6+ ngày) |
+| F-062 | Sales Analytics Dashboard Multi-Tab Redesign | 🟠 CODING (Wave 1 of 5 complete — Foundation slice shipped commit 53d2ec1) | Danny | 2026-05-22 |
```

NO counter bump (F-062 still in-flight). NO Shipped table entry (Wave 5 will do).

#### `change-history.md` — APPEND Wave 1 partial entry

```markdown
## 2026-05-22 FEATURE-062 Wave 1 Foundation: Sales Analytics Dashboard infrastructure (PARTIAL DEPLOY)

**Commit:** 53d2ec1 on branch 5bib_analytics_v2
**Type:** EXTEND_EXISTING (Wave 1 of 5 — Foundation slice only, full F-062 pending Wave 2-5)
**QC verdict:** ✅ APPROVED Wave 1 slice (77/77 regression PASS)
**Manager review:** ✅ APPROVED with 1 BLOCKING TD for Wave 2 (TD-F062-MOM-BOUNDARY-ROLLOVER)

### Files changed (Wave 1 = 13 files / 4064 LoC delta)
- ✏️ Modified: `backend/src/modules/analytics/services/period-resolver.ts` — Adj #1 GranularityKind split + CompareKind extend + resolveBucketSize helper
- ➕ Added: `backend/src/modules/analytics/__tests__/period-resolver.f062.spec.ts` — 21 new tests
- ✏️ Modified: `admin/src/app/globals.css` — Adj #5 5Solution brand token aliases (alias chain, no hex duplicate)
- ➕ Added: `admin/src/lib/analytics-labels.ts` — BR-SA-17 Vietnamese dictionary (15 label maps + ERROR_MESSAGE + labelOr helper)
- ➕ Added: `admin/src/app/(dashboard)/analytics/components/GranularityToggle.tsx` — Adj #3 BR-SA-13
- ➕ Added: `admin/src/app/(dashboard)/analytics/components/PeriodSelector.tsx` — Adj #3 BR-SA-14b
- ➕ Added: `admin/src/app/(dashboard)/analytics/components/CompareSelector.tsx` — Adj #3 BR-SA-14
- ✏️ Modified: `admin/src/app/(dashboard)/analytics/components/PeriodCompareSelector.tsx` — BR-SA-14c @deprecated header

### Architecture impact (Wave 1 only)
- NEW types added to analytics module: `GranularityKind`, extended `CompareKind` (backward compat)
- NEW helper: `resolveBucketSize()` cho chart aggregation
- 5Solution brand token alias layer added to globals.css

### Conventions impact (defer formal update until Wave 5)
- NEW pattern minted (will codify Wave 5): "3-enum separation cho time-series query"
- NEW pattern minted (will codify Wave 5): "Brand token alias chain via CSS custom properties"
- NEW pattern minted (will codify Wave 5): "Backward compat selector deprecation"

### DB / Cache impact
- ZERO — Wave 1 pure infrastructure

### Tech debt added (4 new in known-issues.md)
- TD-F062-MOM-BOUNDARY-ROLLOVER 🟡 MED (Manager spot-check finding — MUST fix Wave 2)
- TD-F062-VALIDATION-COMPAREKIND 🟢 LOW
- TD-F062-F026-SILENT-CAPABILITY-EXPANSION 🟢 INFO
- TD-F062-PRD-SECTION-3.4-DTO-IMPORT-OVERLAP 🟢 LOW

### Lessons learned
- **Coder Deviation honesty** worked: documented 4 deviations enabled Manager to spot-check correct files. Section 4 priority list saved review time.
- **Manager Independent Review caught MoM bug** that Coder + QC both missed. Defense-in-depth justified (lesson reinforces 2026-05-17 directive).
- **Visual scan ≠ semantic verify** — Coder claim "boundary handled" was visual scan only, not exhaustive boundary test. Manager grep `setUTCMonth` + Node REPL verify revealed bug.
- **Partial wave deploy pattern** introduced — feature-log In-flight status `🟠 CODING (Wave N of M)`, change-history partial entry, defer codebase-map/conventions/architecture update until Wave 5 final ship.

### Wave 2-5 roadmap (defer full feature-log Shipped entry until Wave 5)
- Wave 2 (~1800 LoC): Backend services + 16 DTOs + 12 endpoints + cache invalidation extend + FIX TD-F062-MOM-BOUNDARY-ROLLOVER first
- Wave 3 (~2500 LoC): Frontend layout.tsx + Tab 1/2/3 REFACTOR + 14 NEW components + SDK regen
- Wave 4 (~1400 LoC): Tab 4 Runner + Tab 5 Funnel + GA4 + Accordion F-026
- Wave 5 (~200 LoC): Polish + k6 benchmarks + Manual UAT + counter bump + Shipped table entry
```

#### `codebase-map.md`, `architecture.md`, `conventions.md` — NO UPDATE Wave 1

Defer formal memory updates đến Wave 5 final ship. Wave 1 partial update risk drift if subsequent waves change patterns.

---

## 🛑 Push policy

Coder shipped commit `53d2ec1` LOCAL on branch `5bib_analytics_v2`. Per `feedback_git_push_policy.md`:

> **NEVER push to main without Danny's explicit approval, always ask first**

Branch `5bib_analytics_v2` ≠ main, but Manager still defer to Danny:

- **Option 1**: Push `5bib_analytics_v2` lên origin → CI builds + creates remote tracking branch. Safe (not main).
- **Option 2**: Keep local until Wave 2-5 commits accumulate, push as single bundle later.

Manager recommend Option 1 — push immediately để CI catch any build failure early + protect against local data loss.

---

## ✅ Final Status

| Item | Status |
|------|--------|
| QC verdict ✅ APPROVED Wave 1 slice | Verified |
| Manager Independent Code Review | DONE — 6 files spot-checked |
| Manager finding (MoM bug) | DOCUMENTED — TD-F062-MOM-BOUNDARY-ROLLOVER 🟡 MED for Wave 2 BLOCKING |
| 4 new TDs tracked in known-issues.md | Pending Danny approve memory update |
| feature-log.md In-flight update | Pending Danny approve (Option B mini-deploy) |
| change-history.md partial entry | Pending Danny approve |
| codebase-map/conventions/architecture | DEFER Wave 5 |
| Push branch | Pending Danny approve |
| Wave 5 `/5bib-deploy` (full F-062 close) | Pending Wave 2-5 complete |

---

## 🔗 Next Step (Danny decide)

1. **Phasing strategy confirm** — Option A (defer-to-Wave-5) / **Option B (mini-deploy now, recommended)** / Option C (hybrid)
2. **Push branch** — `git push origin 5bib_analytics_v2` to backup commit?
3. **Apply memory updates** Wave 1 partial (known-issues + feature-log In-flight + change-history) via this Manager review?
4. **Wave 2 start** — Coder fix TD-F062-MOM-BOUNDARY-ROLLOVER FIRST before backend services work?
