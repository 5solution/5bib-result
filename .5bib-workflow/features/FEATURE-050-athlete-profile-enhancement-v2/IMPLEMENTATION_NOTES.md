# FEATURE-050 — Implementation Notes (for Manager + QC)

## 1. Deviations from Manager init / PRD

- **Scope file count.** Manager init specified "Frontend (1 file rewrite + 0 new)". Delivered 1 modified (`page.tsx`) + 1 new client-island sibling (`race-history-table.tsx`). Justification in §2.
- **PAUSE-50-06 Finisher rate "Top X%".** Deferred to Phase 2 per Coder spec explicit instruction (`"if expensive query, skip Phase 1; mark as TD"`). Tracked as TD-F050-01.
- **PAUSE-50-04 ITRA points.** Implementation ready (extracts from `result.rawData.itraPoints`), but no race currently populates this field. Display gracefully omits — no functional regression, just no visible value yet.
- **Hero AG chip styling.** Manager init said "add AG bracket badge `Nữ 30-39`" — promoted existing chip from `bg-white/20` (background-equal) to `bg-amber-400/30 ring-amber-200/60` (race-day signal-elevated). Visual interpretation, not adding new UI.

## 2. Forced deviations (technical necessity)

- **Extracted client component `race-history-table.tsx`.** Required because:
  1. Gun Time toggle (PAUSE-50-05) needs localStorage persistence → must be `'use client'`.
  2. Parent `page.tsx` is server-rendered SSR (F-047 + F-051 schema generation depends on it staying server).
  3. Mixing `'use client'` directive into `page.tsx` would force the entire JSON-LD generation + SEO metadata block to lose SSR — would silently break F-051.
  Co-located in same route folder per Next.js convention; only ~225 LOC; pure presentational; receives all data from server parent.
- **`extractItraPoints` casts to `Record<string, unknown>` index access.** Cannot use `any`. The `ResultRow.rawData` field is intentionally untyped (vendor-dependent). Used bracket access with `unknown` casting + runtime type guards. No `any`, no `as unknown as X`.
- **Latent F-047 inconsistency NOT fixed.** `entry.race._id` is read after `stripRacePrivateFields` which outputs `id` (not `_id`). Logged as TD-F050-04. Out of F-050 scope; would require touching `computePRRecords` which is F-047 territory.

## 3. Trade-offs

| Decision | Trade-off | Why this choice |
| -------- | --------- | --------------- |
| Compute streak from `raceHistory` (DESC-sorted) post-build | Couples helper to history sort order | Single source of truth; matches what user sees in table; cheaper than re-sorting |
| Best AG rank uses **lowest numeric categoryRank** across all finished | Doesn't account for field size (rank 1 of 5 vs rank 1 of 500) | Simplicity; finisher count not available (see TD-F050-01); acceptable Phase 1 brag |
| Distance bucket = `Math.round(km) + 'K'` | "42K" and "42.195K" merge to "42K" | Real-world rounding is what athletes use; avoids 1-off bucket fragmentation |
| Heuristic `distance ≥ 50K` ⇒ `ultra_trail` even if `raceType` is empty | Rare road ultras misclassified as trail | Race-ops standard: 50K+ is ultra by definition; admin can set raceType explicitly |
| `formatAgBracket` fallback to raw category string | Vendor edge cases like `M-Master` get displayed raw | Better than crashing; dev sees real data; can extend regex later |
| ITRA / AG-Rank / Gun-Time columns auto-hide when dataset has zero values | Empty headers never appear, but column layout shifts between athletes | Cleaner UX than 4 empty `—` columns; informed by Display Convention "graceful undefined → hide block" |
| Frontend re-applies threshold gates (`streak >= 5`, `count >= 3`) on top of server-side gates | Redundant filtering | Defense-in-depth — if backend gates ever loosen for analytics use, UI thresholds remain authoritative |

## 4. Reviewer Notes (priority list for QC)

### P0 — must verify

1. **No PII leak** — `gunTime` is timing data, `agBracket`/`category` is demographic-but-public per F-047 BR-47-21..24 baseline. Confirm no new email/phone/cccd surface accidentally. Test: hit endpoint with a real production slug, grep response JSON for `email|phone|cccd|dob`.
2. **Backward compat** — confirm old SDK consumers (admin UI, other frontend calls) still work. Net additive optional fields, no field removed or renamed.
3. **Cache invalidation works** — when admin edits a race's `raceType` or `elevationGain`, Redis cache `athlete:profile:<slug>` must invalidate. Currently relies on RACE cache invalidation triggering a manual call to `invalidateProfileCache` — verify wiring is intact (was set up in F-047 Phase 1B).

### P1 — recommended

4. **Real-world fixture** — manually fetch `/api/race-results/athletes/5114-nghiem-thi-anh-thu` (Danny's reference) and confirm:
   - `raceClassification` populated per row
   - `elevationGain` populated where source data has it
   - `bestAgRank` non-null if any row has `categoryRank`
   - `provinces` array
   - `streak` count matches sorted-DESC consecutive-finished count
5. **Gun Time toggle** persists across browser refresh. Verify in Chrome devtools → Application → localStorage → `runners.profile.showGunTime` = `'1'` after click.
6. **Specialist badge wording** — verify visual sample matches `🎯 21K specialist (4 lần)` not `🎯 21k specialist (4 races)` or English.
7. **Hydration check** — Chrome devtools console should NOT show hydration warnings on /runners/[slug]. Client component has `hydrated` guard + `disabled={!hydrated}` to prevent toggle-before-hydration.

### P2 — nice to have

8. Run on athlete with mixed road + trail + ultra finishes — verify 3 different classification chips display correctly.
9. Verify F-051 SEO (JSON-LD, lead paragraph) untouched: head section + lead `<p>` still render identically to pre-F-050.
10. Browser back/forward navigation preserves Gun Time toggle state (localStorage survives).

### Out-of-scope (do NOT block PR)

- TD-F050-01..05 listed in 03-coder-implementation.md §9.
- F-047 latent bug `entry.race._id` access (TD-F050-04).
