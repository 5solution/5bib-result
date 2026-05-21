# FEATURE-050: Athlete Profile Enhancement v2 (Race Ops + UX đặc sắc)

**Status:** 🟡 INITIATED
**Created:** 2026-05-21 09:30 ICT
**Owner:** Danny
**Type:** EXTEND_EXISTING (extend F-047 Phase 1A AthleteProfileService + frontend page)
**Created by:** 5bib-manager
**Sibling ship:** F-051 SEO + AI Search (bundle release/v1.9.1)

---

## 🎯 Why this feature

> Danny critique 2026-05-21 sau khi test `/runners/5114-nghiem-thi-anh-thu`:
> 1. **`/5bib-race-operation-expert` review:** trang functional nhưng KHÔNG đủ "race-aware" cho serious athletes. Thiếu AG rank, race classification (road/trail/ultra), ITRA points, elevation gain, gun time, finisher rate context, gamification.
> 2. **VĐV serious (trail/ultra runners) sẽ thấy profile là "data dump"** thay vì "athlete story" — miss cơ hội giữ chân + viral share.

Bổ sung **layer race-day knowledge** để page thực sự đặc sắc cho VĐV. Foundation cho future PR record validation (AIMS-certified) + UTMB qualification tracking (ITRA points).

---

## 📂 Impact Map (theo memory hiện tại)

### Module sẽ chạm

**Backend (3 files extend + 0 new):**
- `backend/src/modules/race-result/services/athlete-profile.service.ts` — extend response with AG rank, race classification, ITRA, elevation, finisher rate context
- `backend/src/modules/race-result/dto/athlete-profile-response.dto.ts` — extend response DTO with new fields
- `backend/src/modules/races/schemas/race.schema.ts` — verify fields available (raceType, courses.elevationGain, courses.itraPoints) — nếu thiếu thì noop default

**Frontend (1 file rewrite + 0 new):**
- `frontend/app/(main)/runners/[slug]/page.tsx` — rewrite Hero + Stats + Race History table với race ops elements

**NO schema migration. NO new collection. NO new endpoint.**

### File then chốt cần Coder đọc trước khi code
- `backend/src/modules/race-result/services/athlete-profile.service.ts` — current Phase 1A logic
- `backend/src/modules/race-result/dto/athlete-profile-response.dto.ts` — current DTO shape
- `frontend/app/(main)/runners/[slug]/page.tsx` — current 6-block layout
- `backend/src/modules/races/schemas/race.schema.ts` — verify `raceType` + `courses[].elevationGain` fields available
- `.5bib-workflow/memory/conventions.md` — Display Convention (VN labels, no raw enum)

### Endpoint liên quan
- `GET /api/race-results/athletes/:slug` — extend response (additive only, backward compat)

### Schema/DB
- MongoDB: ZERO change. Read-only join với existing `races.courses[].elevationGain`, `races.raceType`
- Redis: cache key `athlete:profile:<slug>` đã tồn tại — TTL giữ nguyên 30 phút, key shape extend only
- NO migration

---

## ⚠️ Risk Flags

- 🟢 **[LOW] Backward compat additive** — chỉ thêm optional fields vào response. F-047 frontend page sẽ rewrite cùng, generated SDK regen handles graceful undefined.
- 🟡 **[MED] Race meta data completeness** — không phải race nào cũng có `elevationGain` populated. Coder MUST graceful undefined (UI hide block nếu thiếu).
- 🟡 **[MED] ITRA points hiện không có data source** — schema có field `itraPoints?` nhưng chưa populate cho 60 races. Phase 1 only show badge if data exists; Phase 2 backfill data via cron/manual admin entry.
- 🟢 **[LOW] AG rank derivation** — `categoryRank` đã có trong race_results. Coder chỉ cần aggregate per race row.

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

- [ ] **PAUSE-50-01:** AG bracket display format — `M30-39 · Nữ` (international) hay `Nữ 30-39` (VN order)? **Recommend:** `Nữ 30-39` (VN convention).
- [ ] **PAUSE-50-02:** Race classification badges — show all 4 (Road/Trail/Ultra Trail/Cycling) hay merge "Trail" + "Ultra Trail"? **Recommend:** 3 badges Road / Trail (<50K) / Ultra Trail (≥50K).
- [ ] **PAUSE-50-03:** Elevation gain display — show meter (`D+ 2,580m`) hay feet? **Recommend:** meter (VN context).
- [ ] **PAUSE-50-04:** ITRA points display — show even if `null`/0 hay only when populated? **Recommend:** only when populated + > 0.
- [ ] **PAUSE-50-05:** Gun time toggle default — hidden + toggle "Hiện Gun Time", hay always visible 2 columns? **Recommend:** hidden + toggle (default UX cho amateur).
- [ ] **PAUSE-50-06:** Finisher rate display — "47/142 finishers" hay "Top 33%"? **Recommend:** Top X% (clearer brag).
- [ ] **PAUSE-50-07:** Streak badge threshold — 5 race liên tiếp hay 7? **Recommend:** 5 (achievable, more athletes qualify).
- [ ] **PAUSE-50-08:** Distance specialist threshold — chuyên cự ly N nếu chạy ≥3 hay ≥5 race? **Recommend:** ≥3.

---

## 🎯 Success criteria (gợi ý cho BA)

- AG rank visible per race row (col "AG Rank") AND in stats card (best AG performance)
- Race classification icon + label phù hợp (🛣️ Road / 🌲 Trail / 🏔️ Ultra)
- Elevation gain (D+ Nm) displayed per trail/ultra race (graceful skip if null)
- Streak badge `🔥 N race về đích liên tiếp` (>= threshold)
- Distance specialist badge `🎯 Trail 50K specialist (N lần)` (>= threshold)
- Geographic badge `🌍 Đã chạy N tỉnh: ...` (visible if ≥3 tỉnh)
- Gun time column toggleable (default hidden)
- All new UI graceful degrades when data unavailable (no broken empty cells)

---

## ✅ Sẵn sàng cho `/5bib-prd`

**Sẵn sàng** với defaults recommendation cho 8 PAUSE-50-* questions. Danny chốt hoặc override.

---

## 🔗 References

- Race Ops Expert review: 2026-05-21 conversation thread
- Parent F-047 RESUME: `.5bib-workflow/features/FEATURE-047-athlete-profile-pages/`
- Sibling F-051: `.5bib-workflow/features/FEATURE-051-athlete-profile-seo-ai-search/`
- Race Ops standards: per skill `/5bib-race-operation-expert` — WA / ITRA / AIMS
