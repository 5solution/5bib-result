# Data Mapping Định nghĩa — Athlete Identity & Profile Aggregation

**Status:** 🟡 DEFINED (4 quick fixes applied, 6 gaps tracked TD)
**Created:** 2026-05-21
**Audited by:** 5bib-po-ba + Claude
**Owner:** Danny

---

## 🎯 Tại sao có doc này

Mày phán "đoạn map data VĐV đang hơi lỏ" — đúng. Identity resolution của 5BIB build trên giả định BIB-name match, nhưng reality data quality vendor có hàng tá edge cases. Doc này:

1. **List CHÍNH XÁC** 10 lỗ hổng phát hiện qua audit (số liệu thực tế từ DB DEV)
2. **Phân loại fix priority** (4 đã fix session này / 6 TD defer)
3. **Define rule rõ ràng** cho TỪNG layer mapping (slug parsing → match → aggregate → display)
4. **Workflow recommendation** — feature mới nào cần mở để fix triệt để

---

## 📊 Identity Resolution Pipeline (current)

```
URL slug "5114-nghiem-thi-anh-thu"
        │
        ▼
[1] parseSlug() → { bib: "5114", nameSlug: "nghiem-thi-anh-thu" }
        │
        ▼
[2] PERSISTED PATH (default):
    athlete_profiles.findOne({ slug: "5114-nghiem-thi-anh-thu" })
        │
        ├─ HIT → buildResponseFromCollection()
        │         │
        │         ▼
        │   resultModel.find({
        │     bib: $in linkedBibs,           ← single bib usually
        │     raceId: $in linkedRaceIds      ← curated set
        │   })
        │         │
        │         ▼
        │   POST-FILTER: slugifyVN(name) === parsed.nameSlug  ← NEW FIX
        │         │
        │         ▼
        │   liveResults → buildRaceHistory + computeProfile fields
        │
        └─ MISS → computeProfile() (live aggregation)
                  │
                  ▼
            Same flow without persisted hint
                  │
                  ▼
            Cache Redis 1800s

[3] F-047 RESUME path (UNWIRED — Phase 1C pending):
    AthleteIdentityMergeService.resolveBySlug()
      → finds athlete_identity_clusters by anchor mongoRaceId+mongoBib
      → returns 23 races for NGUYỄN BÌNH MINH (cluster-based aggregation)
    Currently NOT called by AthleteProfileService → cluster engine wasted
```

---

## 🔍 10 Lỗ hổng phát hiện (audit 2026-05-21)

### ✅ FIXED in session (4)

#### Gap #1 — Cross-athlete BIB pollution (CRITICAL — đã fix earlier 21/05)

**Root cause:** BIB numbers KHÔNG unique cross-race. bib=5114 dùng bởi 12 athletes khác nhau ở 12 races. `buildResponseFromCollection` query `find({bib: $in linkedBibs})` không filter name slug → pull 11 strangers' results vào profile của NGHIÊM THỊ ANH THƯ.

**Impact pre-fix:** Profile Nữ show "Hạng 1 Nam 50-54" (data từ Phạm Văn Tuất). Affects ALL 2,470 persisted profiles.

**Fix:** Added defense-in-depth filter:
1. `raceId: $in linkedRaceIds` (efficient Mongo $in)
2. Post-filter `slugifyVN(name) === parsed.nameSlug`

**Branch:** `fix/F-047-bib-collision-name-filter` commit `98ea688`

#### Gap #2 — Province dedup MISSING (MEDIUM — vừa fix session này)

**Root cause:** Vendor `races.province` data inconsistent:
- "Hà Nội" + "Thành phố Hà Nội" + "TP Hà Nội" → 3 distinct values
- "Đồng Nai" + "Tỉnh Đồng Nai" → 2 distinct values
- "Lâm Đồng " (trailing space) + "Tỉnh Lâm Đồng" → 2 distinct values
- "Ba Bể - Thái Nguyên" (compound) + "Thái Nguyên" + "Tỉnh Thái Nguyên" → 3 distinct values

**Impact pre-fix:** NGHIÊM THỊ ANH THƯ "Đã chạy 8 tỉnh" (inflated, actual ~5).

**Fix:** NEW `backend/src/common/utils/province-normalize.ts` — `canonicalizeProvince()` strips Tỉnh/TP/Thành phố/Phường prefix + alias map cho top cities → unified display name.

#### Gap #10 — canonicalName vendor casing drift (LOW — vừa fix session này)

**Root cause:** `latest.name` (most recent race) chọn arbitrary vendor casing. Vendor data có double-space ("Nguyễn Tiến  Thành"), lowercase variants, ASCII fallback variants.

**Impact pre-fix:** profile shows "Nguyễn Tiến  Thành" (double-space) thay vì clean "Nguyễn Tiến Thành".

**Fix:** NEW `pickCanonicalName()` helper — group rows by slug key, count occurrences (mode), tie-break longest variant. Applied both `computeProfile` + `buildResponseFromCollection` paths.

#### Gap #5 — Road ultra mis-classified (LOW — vừa fix session này)

**Root cause:** Heuristic `distance ≥ 50K + !isTrail → ultra_trail`. Rare road ultra (UTMB road, IAU 100K certified) gets wrong icon 🏔️.

**Fix:** Removed heuristic. Only escalate to ultra_trail when EXPLICIT `raceType` contains "trail" / "mountain" / "ultra".

---

### 🟡 TRACKED TD (6 — defer to future features)

#### Gap #3 — Cross-race identity aggregation BROKEN at scale (HIGHEST PRIORITY TD)

**Symptom:** Same person chạy 5 races với 5 BIB khác nhau → 5 athlete_profiles riêng biệt.

**Data evidence:**
- 54,720 total athlete_profiles
- Avg `linkedRaceIds` per profile = **1.0003** (mean: each profile has 1 race)
- Max = 3 (extremely rare aggregation)
- `canonicalEmailHash` populated = **0/54,720 = 0%**

**Root cause:** F-047 Phase 1B `athlete-profile-backfill.cron.ts` line 175 hardcoded:
```typescript
const linkedBibs = [row.bib]; // Phase 1B Coder extension: identityMerge expands via email hash
```
Comment says "expands via email hash" — but never implemented. F-048 `athlete_identity_clusters` collection ready (1,413 clusters) but NOT consumed by cron.

**Impact:** NGUYỄN BÌNH MINH (23 races trên platform) → 23 profile riêng biệt với 23 slug khác nhau. F-047 SEO value = 1/N expected.

**Fix scope (F-052 OR F-053):**
- Wire `AthleteIdentityMergeService.resolveByEmail()` (đã tồn tại từ F-047 RESUME) into cron
- Requires: race_athletes.email populated (depends Gap #4)
- OR clustering tier T2 (name+DOB+gender) — works without email if DOB exists

**Priority:** HIGH — đây là moat SEO mà 5BIB đang miss.

#### Gap #4 — `primaryEmail` KHÔNG populated end-to-end (MEDIUM TD-F049-05)

**Symptom:**
- `athlete_profiles.canonicalEmailHash` = 0/54,720 populated
- F-049 admin UI shows nameSlug thay vì email (mặc dù Danny override PAUSE-49-02 = full email)
- AthleteIdentityMergeService cluster lookup tier-1 (email exact) inactive

**Root cause:** F-048 master sync `race-athlete-sync.service.ts` chưa populate `email` field from MySQL `athletes.email` (99.995% coverage) into `race_athletes` collection.

**Fix scope (F-053 / F-054):**
- Extend race-athlete-sync to SELECT + persist email field
- PII review re select:false MongoDB schema layer
- Re-run bulk sync 195 races → email populated → clustering tier-1 activate

#### Gap #6 — Best AG bracket trust vendor blindly (LOW)

**Symptom:** `bestAgRank.bracket` = vendor's category string. If vendor mislabels gender ("Male" cho Nữ athlete) → display sai (đã fix specific case via formatAgBracket regex longest-first, but root issue persists).

**Fix:** Cross-check athlete.gender against vendor bracket gender → log warning + use athlete gender for label.

**Priority:** LOW — rare vendor mistake.

#### Gap #7 — OG image route 404 (MEDIUM TD-F051-OG-PHASE2)

**Symptom:** `/runners/[slug]/opengraph-image` returns HTML 404 (route not registered).

**Root cause:** Next.js 16 Turbopack metadata route convention quirk. Already fixed `params: Promise<{...}>` await but still 404. Needs Next.js 16 docs deep dive.

**Fix scope:** investigate Next.js 16 `next/og` route patterns + maybe try `next build` production mode (Turbopack dev may not support metadata routes correctly).

**Priority:** MEDIUM — blocks social share thumbnail (Facebook/Telegram/Zalo).

#### Gap #8 — DSQ true classification vs DNS catch-all (LOW)

**Symptom:** `started=0 + no chip → 'dns'`. All non-finishers without start signal labeled DNS. True DSQ (vendor explicit `status='DSQ'` in rawData) treated as DNS.

**Fix:** Extend isFinisher/status logic to check `rawData.status === 'DSQ'` first.

**Priority:** LOW — true DSQ rare (~<1% races), current heuristic correct 99%.

#### Gap #9 — slugifyVN regex obscure but functional (TRIVIAL)

**Symptom:** Regex `/[̀-ͯ]/g` between 2 combining marks — visually unclear in code review, possibly mistyped on different keyboard layouts.

**Fix:** Replace with explicit `/[̀-ͯ]/g` — same behavior, much clearer.

**Priority:** TRIVIAL — works correctly, just cosmetic.

---

## 📐 Định nghĩa rõ ràng — Mapping Rules

### Rule 1: Slug parsing

| Input | Output |
|-------|--------|
| `5114-nghiem-thi-anh-thu` | `{bib: "5114", nameSlug: "nghiem-thi-anh-thu"}` |
| `9897-nguyen-binh-minh` | `{bib: "9897", nameSlug: "nguyen-binh-minh"}` |
| Invalid (no hyphen) | `null` → 404 |

**Source of truth:** `parseSlug()` regex `^(\d+)-(.+)$`. NEVER split on first hyphen — bib is `\d+` only.

### Rule 2: Name normalization for matching

```
"NGHIÊM THỊ ANH THƯ"      →  slugifyVN  →  "nghiem-thi-anh-thu"
"Nguyễn Tiến  Thành"      →  slugifyVN  →  "nguyen-tien-thanh"
"Nguyen Thi  Thanh"       →  slugifyVN  →  "nguyen-thi-thanh"
"Đào Đức Long"            →  slugifyVN  →  "dao-duc-long"
```

**Rule:** Always `slugifyVN(name) === parsed.nameSlug` for cross-record matching. NEVER raw string compare.

### Rule 3: Identity match strength (current Phase 1B)

| Strength | Condition | Confidence | Source |
|----------|-----------|------------|--------|
| Strong | bib EQUAL + slugifyVN(name) EQUAL | 95% (rare BIB+name collision) | computeProfile/buildResponseFromCollection name filter |
| Weak | bib EQUAL only | 12% (BIB shared 12 ways) | OBSOLETE — caused Gap #1 pollution |
| Cluster | F-048 athlete_identity_clusters lookup | T1 1.0 email / T2 0.85 name+DOB+gender / T3 0.6 review | UNWIRED — Phase 1C |

### Rule 4: Canonical name picker

```
Input: [
  "Nguyễn Tiến  Thành",  // race 1
  "Nguyễn Tiến  Thành",  // race 2
]
→ slugifyVN both → "nguyen-tien-thanh" key
→ collapsed variant "Nguyễn Tiến Thành" stored
→ mode pick: 2 occurrences
→ Output: "Nguyễn Tiến Thành" (clean single space)
```

**Rule:** Mode > Recency. Tie-break: longest variant (preserves diacritics).

### Rule 5: Province canonicalization

| Input | After `canonicalizeProvince()` |
|-------|--------------------------------|
| "Tỉnh Đồng Nai" | "Đồng Nai" |
| "Thành phố Hà Nội" | "Hà Nội" |
| "TP Hải Phòng" | "Hải Phòng" |
| "Lâm Đồng " | "Lâm Đồng" |
| "Ba Bể - Thái Nguyên" | "Thái Nguyên" |
| "Sài Gòn" | "Hồ Chí Minh" (alias) |
| null/empty | null (excluded from set) |

### Rule 6: Race classification

| raceType (vendor) | distance | Classification |
|-------------------|----------|----------------|
| contains "trail" | < 50K | trail |
| contains "trail" | ≥ 50K | ultra_trail |
| contains "mountain" / "ultra" | any | trail (or ultra_trail if ≥50K) |
| Other (road, etc.) | any | road (kể cả road ultra rare) |
| null | any | road (if distance ≥0) hoặc undefined |

### Rule 7: Status code derivation

| chipTime | started | dnsChipFail flag | Status |
|----------|---------|------------------|--------|
| > 0 | any | any | `finished` |
| empty/0 | > 0 | any | `dnf` |
| empty/0 | 0 | true | `dnf` (admin-flagged chip fail) |
| empty/0 | 0 | false/null | `dns` |
| (future) | any | any | `dsq` (if vendor rawData.status='DSQ') |

### Rule 8: Cache invalidation

| Event | Invalidate |
|-------|------------|
| Admin edits race_result | `athlete:profile:<slug>` (per slug bib match) |
| Admin merges cluster | `athlete:profile:<slug>` for ALL slugs linked to cluster |
| race-master-data sync | NONE (cron rebuilds athlete_profiles atomically) |

---

## 🛠️ Recommended next features

### F-053 (HIGH) — Email-based identity merge
- Extend F-048 sync to populate `race_athletes.email`
- Wire `AthleteIdentityMergeService.resolveByEmail()` into `athlete-profile-backfill.cron`
- Result: NGUYỄN BÌNH MINH 23 races aggregate vào 1 profile
- ETA: ~4-5h
- Resolves: Gap #3 + Gap #4

### F-054 (MED) — OG image Next.js 16 fix + DSQ detection
- Fix metadata route registration quirk
- Add rawData.status='DSQ' detection in buildRaceHistory
- ETA: ~2h
- Resolves: Gap #7 + Gap #8

### F-055 (LOW) — Mapping observability + admin tools
- Admin UI: athlete merge/split (if F-053 mis-merges)
- Audit log per identity action
- Health dashboard: % profiles with canonicalEmailHash, avg linkedRaceIds
- ETA: ~6h
- Resolves: Gap #6 (cross-check vendor bracket vs athlete.gender warning)

---

## 📊 Fix verification — Before/After

| Metric | Before | After |
|--------|--------|-------|
| 5114 totalRaces | 12 (polluted strangers) | 1 (actual Anh Thư) |
| 5114 Best AG | "Hạng 1 Nam 50-54" (wrong gender) | hidden (no podium her race) |
| 8005 canonicalName | "Nguyễn Tiến  Thành" (double-space) | "Nguyễn Tiến Thành" (clean) |
| 5114 provinces | ["Thái Nguyên", "Tỉnh Thái Nguyên"] (dup) | ["Thái Nguyên"] |
| 89897 provinces | (would have dup if multi-race) | ["Nghệ An", "Phú Thọ"] clean |
| road 100K race | mis-classified ultra_trail 🏔️ | road 🛣️ (correct) |

---

## ✅ Status & Next step

**Đã fix (session 2026-05-21):** Gap #1, #2, #5, #10
**TD tracked:** Gap #3, #4, #6, #7, #8, #9

**Files changed session này:**
- `backend/src/common/utils/province-normalize.ts` (NEW)
- `backend/src/modules/race-result/services/athlete-profile.service.ts` (4 edits: import + computeProvinces + classifyRaceType + pickCanonicalName helper + 2 call sites)

**Branch:** worktree currently on `fix/F-047-bib-collision-name-filter` — Gap #2/#5/#10 fixes uncommitted. Need decision:

- (A) Commit cùng branch fix (rename branch `fix/F-047-data-mapping-cleanup`)
- (B) Tạo branch riêng `fix/F-047-data-mapping-province-canonical-name`
- (C) Squash thành 1 commit + force push fix branch

**Recommend (A):** rename + commit all data-mapping fixes together (logically related).

**Danny chốt approach commit → tao execute.**
