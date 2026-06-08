# FEATURE-077 — QC Report Round 2 (DB / API / FE adversarial)

**Status:** ✅ APPROVED (sau khi QC bắt + fix 1 critical bug) — pending DEV re-verify + Danny
**Date:** 2026-06-08 · **Scope:** import counting + đã-huỷ INACTIVE + cơ cấu athletes + size racekit + INSURANCE + KPI redesign
**Tester:** QC Gatekeeper (no-mercy) · Live platform DB + DEV `055ea7f`

## Phase 1 — DB Regression & Impact (adversarial sweep)

### 🛑 CRITICAL BUG FOUND & FIXED — participant `last_status='ACTIVE'`
Adversarial cross-check `codes(ACTIVE/SENT)` vs `athletes(ACTIVE)` across top-25 races → divergence:
- race 5: codes 2209 vs athletes-ACTIVE **0**; race 13: 83 vs 0; race 26: 1762 vs 898.
- Root: `athletes.last_status` ∈ {ACTIVE, DEACTIVATE, NULL}. **Ended/old races → NULL** (race 5: 786 rows toàn NULL). Filter `='ACTIVE'` → Cơ cấu VĐV TRỐNG cho mọi race đã kết thúc.
- **Fix (8be884b):** `WHERE (last_status IS NULL OR last_status <> 'DEACTIVATE')`.
- Post-fix: race 5 → 786 (was 0); recent races (209/214/216/220) → athletes ≈ codes (gap≈0, clean).

### Verified correct
- **Import counting** (codes ACTIVE/SENT): race 209 644, race 214 1266, race 216 5 — khớp ground-truth.
- **By-course/by-type/capacity** (codes-based): course breakdown sums to total incl import. ✓
- **INSURANCE exclusion**: race 216 order-based → 3 đơn / 5 vé / GMV 4.650.000 = khớp ORG. ✓
- **"Vé đã huỷ"** = codes INACTIVE: race 214=28, 209=2, 216=0. ✓
- **Cơ cấu via `athletes`**: race 214 1266 (incl 148 import), demographics ~100%, size thật. ✓

### Known limitation (data reality, not a code bug)
- **Old races (5/26/41/68): `athletes` table partial** (race 5: 786/2209). Legacy registration không có đủ athlete demographic rows. Cơ cấu phủ phần có data; phần thiếu hiện "Chưa có dữ liệu" (honest). Recent races (merchant portal's actual use case) → đầy đủ. → TD-F077-OLD-RACE-DEMOGRAPHICS.

## Phase 2 — Security threat model
| Vector | Result |
|---|---|
| SQL injection (new queries) | ✅ Parameterized `?` + constant INSURANCE literal. `grep '${(raceId\|userId\|search...)' ` → only Redis cache-keys/filename/logs, ZERO in SQL. |
| IDOR | ✅ getParticipantInsights/Summary/etc call `assertRaceForUser(userId, raceId)` → scope qua resolveAccessibleRaces (JWT-derived userId, not body). |
| Auth | ✅ All routes class-level `LogtoMerchantGuard`. Verified 401 sans token. |
| Info disclosure | ✅ No financial fields in ticket DTOs; INSURANCE 10k/vé not leaked as ticket. |
| `$where`/eval | N/A (MySQL platform, parameterized). |

## Phase 3/4 — Tests
- 173 merchant-portal jest PASS (incl codes-based SQL assertions, INSURANCE exclusion, gap-bucket reconcile, export xlsx parse).
- `nest build` exit 0. merchant `tsc` clean.

## Phase 5 — Numbers reconcile (ground-truth)
| Race | Tổng vé (codes) | Cơ cấu (athletes non-deact) | Đơn (ORG) | Doanh thu | Match |
|---|---|---|---|---|---|
| 216 | 5 | 5 | 3 | 4.650.000 | ✅ = ORG |
| 214 | 1266 | 1266 | — | — | ✅ |
| 209 | 644 | 642 (≈, 2 INACTIVE diff) | — | — | ✅ |

## Phase 6 — FE persona walkthrough
- **BTC (recent race)**: KPI 5 cards (Đơn hàng/Vé bán/Import/Hủy/Tổng) — no duplicate; Cơ cấu size thật, total=Tổng vé. **PASS pending DEV re-deploy of 8be884b** (current DEV 055ea7f has the buggy status filter for ended races).
- **BTC (old/ended race)**: Cơ cấu now shows partial real demographics (not empty) + "Chưa có dữ liệu" honest. Needs DEV verify post-deploy.

## Verdict
✅ **APPROVED** — 1 critical bug (status filter) caught + fixed in QC. Ship `8be884b` to DEV, re-verify FE on an ENDED race + recent race, then PROD. Old-race partial demographics = accepted data-reality limitation (TD logged).
