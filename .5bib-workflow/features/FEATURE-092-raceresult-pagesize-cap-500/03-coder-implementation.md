# FEATURE-092: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC
**Started:** 2026-06-27
**Author:** 5bib-fullstack-engineer
**Linked:** `00`, `01`, `02`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md`
- [x] Đã đọc `01-ba-prd.md` đầy đủ (8 BR + 7 TC + FE clamp cases)
- [x] Đã đọc `02-manager-plan.md` — verdict ✅ APPROVED + Scope Lock
- [x] Đã đọc `memory/conventions.md` (anti-patterns) + `memory/codebase-map.md` (race-result module)
- [x] Đã đọc code thật 3 file Scope Lock TRƯỚC khi sửa

---

## 🔍 Impact Assessment (Think First)

**Backend:**
- MongoDB: KHÔNG đụng. `getRaceResults` vốn `.find(filter).sort().lean()` load toàn bộ docs của cự ly rồi `filterDuplicateRanks` + `.slice(skip, skip+pageSize)` in-memory → nâng cap 100→500 KHÔNG tăng query DB, chỉ map/serialize thêm ≤400 dòng.
- Redis: cache key `results:<raceId>:<course>:<pageNo>:<filtersHash>` KHÔNG đổi; object cache to hơn (≤500 dòng) — chấp nhận, TTL 60s.
- NestJS: KHÔNG đổi DI/module.

**Frontend:**
- TanStack Query: hook `useRaceResults` không đổi; chỉ đổi giá trị `effectivePageSize` truyền vào.
- Boundary: page vẫn `'use client'` — không đổi.
- KHÔNG cần `revalidatePath/Tag` (client query).

**API Contract:**
- DTO `pageSize` đổi `@Max(100)→500` + ApiProperty `maximum`/description → schema OpenAPI đổi metadata. **TS type `pageSize?: number` KHÔNG đổi** → generated SDK byte-identical → `generate:api` = no-op diff (xem IMPLEMENTATION_NOTES Deviation #1).
- Response shape KHÔNG đổi → KHÔNG breaking consumer.

---

## ⚠️ Edge Cases Covered

- [x] `pageSize=500` với >100 kết quả → trả tới 500 (KHÔNG cắt 100) — TC-01
- [x] `pageSize=500` với 600 kết quả → đúng 500 — TC-01b
- [x] `pageSize=1000` (vượt) → service `Math.min` clamp 500 — TC-07
- [x] `pageSize=100/50` (cũ) → backward-compatible, slice đúng — TC-03/TC-06
- [x] `pageSize=501/0` → DTO validation reject (400) — TC-02/TC-04
- [x] Frontend `privateListLimit` = 0/null/undefined/>500 → clamp về [1,500] (`|| 20` bắt cả 0) — BR-05

---

## 🧠 Logic & Architecture

Bug = **2 lớp chặn 100 lệch với form admin (max 500)**. Fix tối giản đúng 3 con số:
1. DTO `@Max(100)→500` + `maximum`/description (lớp validation — chỗ trả 400).
2. Service `Math.min(...,100)→500` (lớp clamp — defense-in-depth, GIỮ clamp không bỏ).
3. Frontend clamp `Math.min(500, Math.max(1, privateListLimit || 20))` — đảm bảo không bao giờ gửi pageSize ngoài [1,500], kể cả data cũ.

KHÔNG đụng `filterDuplicateRanks`/sort/cache/response DTO. KHÔNG migration (clamp xử lý data cũ).

---

## 💻 Files Changed

### Backend
- ✏️ `backend/src/modules/race-result/dto/get-race-results.dto.ts` — `@Max(100)→@Max(500)`, `maximum: 100→500`, description `"max 100"→"max 500"` (3 dòng)
- ✏️ `backend/src/modules/race-result/services/race-result.service.ts` (≈662-663) — `Math.min(dto.pageSize ?? 10, 100)→500` + comment
- ➕ `backend/src/modules/race-result/dto/get-race-results.dto.spec.ts` — NEW: 6 test DTO boundary
- ✏️ `backend/src/modules/race-result/services/race-result.service.spec.ts` — append describe "F-092 pageSize cap 500" (5 test)

### Frontend
- ✏️ `frontend/app/(main)/races/[slug]/ranking/[courseId]/page.tsx` (≈227-231) — clamp `effectivePageSize`

### SDK
- 🔄 `generate:api` — **KHÔNG chạy** (metadata-only change, no TS type diff). Xem IMPLEMENTATION_NOTES Deviation #1.

→ Khớp Scope Lock `02-manager-plan.md`, **0 scope creep** (chỉ 3 file core + 2 spec, đúng phạm vi "*.spec.ts" được phép).

---

## 🧪 Tests Written

### NEW F-092 unit tests — 11 pass

**DTO boundary** (`get-race-results.dto.spec.ts`, 6 test, class-validator):
```
PASS src/modules/race-result/dto/get-race-results.dto.spec.ts
  GetRaceResultsDto — F-092 pageSize boundary
    ✓ TC-03: pageSize=500 (exact cap) passes validation
    ✓ pageSize=100 (old cap) still passes — backward compatible
    ✓ TC-02: pageSize=501 (over cap) fails with max constraint
    ✓ TC-02b: pageSize=1000 fails with max constraint
    ✓ TC-04: pageSize=0 fails with min constraint
    ✓ TC-05: pageSize omitted → no error (defaults to 10)
```

**Service clamp** (`race-result.service.spec.ts` describe "F-092 pageSize cap 500", 5 test):
```
  getRaceResults — F-092 pageSize cap 500
    ✓ TC-01: pageSize=500 returns >100 rows (NOT capped at 100) when 200 results exist
    ✓ TC-01b: pageSize=500 returns exactly 500 when 600 results exist
    ✓ TC-07: pageSize=1000 clamps to 500 (service Math.min defense-in-depth)
    ✓ TC-03: pageSize=100 stays backward-compatible (regression — caps at 100)
    ✓ TC-06: pageSize=50 pageNo=2 slices the correct page (regression)
```

### Pre-existing failures (NOT F-092 — documented infra debt)
Service spec có **6 fail pre-existing** (verified bằng `git stash` → trên HEAD đã 6 failed/43 passed TRƯỚC thay đổi của tao): `syncAllRaceResults` ×2 (axios spy + sync log mock) + `submitClaim` (`telegramService.notifyClaimSubmitted` mock thiếu) + vài cái khác. Spec file tự ghi chú test infra debt (dòng 148-176). **Thay đổi F-092: +11 test pass, 0 regression.**

### Static checks
- `tsc --noEmit` backend: 0 lỗi ở 2 file Scope Lock backend
- `tsc --noEmit` frontend: 0 lỗi ở ranking page
- Anti-pattern scan: 0 `console.log`/`any`/`as unknown` MỚI trong đoạn sửa (matches còn lại đều pre-existing ngoài edit)

---

## 🛑 PAUSE/Confirmation log

| Date | What | Answer |
|------|------|--------|
| 2026-06-27 | Trần = 500 | Danny chốt 500 (qua AskUserQuestion) |
| — | KHÔNG migration/dep/auth/fee → không cần PAUSE | — |

---

## 🚧 Scope creep / Out-of-Scope changes
- [x] KHÔNG có scope creep. Chỉ 3 file core (đúng Scope Lock) + 2 spec ("*.spec.ts" được phép).

---

## 🐛 Known limitations / Tech debt còn lại
- **TD-F092-VIRTUALIZE** 🟢 LOW: bảng ranking render tới 500 dòng (desktop table + mobile card cùng trong DOM, không virtualize) → máy yếu hơi khựng khi mở giải set limit cao. Defer; virtualize/lazy nếu có complaint lag mobile.
- **TD-F092-PREEXISTING-SPEC** 🟢 LOW: 6 test pre-existing fail trong `race-result.service.spec.ts` (mock infra debt: `notifyClaimSubmitted` + axios sync) — không thuộc scope F-092, track để dọn sau.
- `generate:api` no-op cho change này; nếu sau thêm field DTO khác thì mới cần chạy.

---

## ✅ Self-Review Pipeline (Manager 2026-05-14 mandatory)

- [x] Bước 1: tsc exit 0 cho Scope Lock files (backend DTO+service, frontend ranking)
- [x] Bước 2: PRD strict adherence — BR-01..08 + TC-01/02/03/04/05/06/07 đều có test tương ứng
- [x] Bước 3: Anti-pattern scan clean (0 console.log/any/as-unknown MỚI trong đoạn sửa)
- [x] Bước 4: Hand-pick field mapping audit — N/A (không thêm field schema, chỉ đổi hằng số trần)
- [~] Bước 5: PROD-readiness smoke — unit test cover logic; live E2E (giải >100 VĐV + privateListLimit>100) defer post-deploy (cần BE mới deploy mới thấy pageSize=500→200). Đã verify live prod TRƯỚC fix (90 VĐV render OK, 400 với pageSize>100).
- [~] Bước 6: UI/UX self-inspection — KHÔNG thêm UI mới (chỉ clamp 1 biến); trang ranking layout không đổi
- [x] Bước 7: Real-world data — test dùng race thật 3km "Không Ma Tuý 2026" (3922 kết quả) + mock 200/600 docs
- [x] Bước 8: Files Changed vs Scope Lock — 0 scope creep
- [x] Bước 9: Generated SDK — no-op (metadata-only, documented Deviation #1)
- [x] Bước 10: Unit tests PASS (11 NEW F-092, output paste ở trên)
- [x] Bước 11: IMPLEMENTATION_NOTES.md written với 4 sections đầy đủ

→ Status: 🟠 READY_FOR_QC

---

## 🔗 Next step

Danny chạy: `/5bib-qc FEATURE-092-raceresult-pagesize-cap-500`
