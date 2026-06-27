# FEATURE-092: Nâng trần pageSize race-results 100→500 (fix Danh sách riêng tư trống)

**Status:** 🟡 INITIATED
**Created:** 2026-06-27
**Owner:** Danny
**Type:** BUGFIX
**Created by:** 5bib-manager

---

## 🎯 Why this feature

Trên prod, race "Không Ma Tuý 2026" (course 3km) — khi operator bật **Danh sách riêng tư** (`enablePrivateList`) và set **`privateListLimit` > 100** (form admin cho tới 500), trang ranking công khai hiển thị **danh sách VĐV TRỐNG TRƠN**.

Nguyên nhân (đã verify live + đọc code): trang ranking ở private mode gửi `pageSize = privateListLimit`. Nhưng backend chặn `pageSize` ở **100** tại 2 lớp → trả `400 "pageSize must not be greater than 100"` → TanStack Query vào error state → `results = []` → empty list. Danny đã reproduce bằng cURL `?pageSize=200` → 400.

→ **3 lớp lệch nhau:** form admin cho 500, backend chặn 100, frontend gửi raw không clamp.

Danny chốt: **nâng trần pageSize lên 500** để khớp form.

---

## 📂 Impact Map (đã spot-check code thật 2026-06-27)

### Root cause — 2 lớp chặn 100 (PHẢI sửa CẢ HAI)

1. **DTO validation** — `backend/src/modules/race-result/dto/get-race-results.dto.ts:56` → `@Max(100)` (+ `@ApiPropertyOptional` `maximum: 100` + description "Page size (max 100)" dòng ~46-50). Đây là chỗ chặn trả 400.
2. **Service clamp** — `backend/src/modules/race-result/services/race-result.service.ts:663` → `const pageSize = Math.min(dto.pageSize ?? 10, 100);` (comment "Enforce pageSize cap (BR-08)"). **Nếu chỉ sửa DTO mà quên chỗ này → hết 400 nhưng service vẫn âm thầm cắt còn 100** → private mode (ẩn phân trang) vẫn chỉ hiện 100, không đạt mục tiêu.

### Frontend — clamp phòng thủ

3. `frontend/app/(main)/races/[slug]/ranking/[courseId]/page.tsx:228` →
   ```ts
   const effectivePageSize = isPrivateNoSearch ? (race?.privateListLimit ?? 20) : pageSize;
   ```
   `?? 20` KHÔNG bắt được `0`. Cần clamp: `Math.min(500, Math.max(1, race?.privateListLimit || 20))` để pageSize không bao giờ out-of-range (kể cả data cũ/null/0). Dòng 209 (`privateListLimit: r.privateListLimit ?? 20`) cũng nên xét `|| 20` cho nhất quán.

### File then chốt cần Coder đọc trước khi code
- `backend/src/modules/race-result/dto/get-race-results.dto.ts` — DTO pageSize (lớp 1)
- `backend/src/modules/race-result/services/race-result.service.ts` (≈634-720) — `getRaceResults()` clamp + cache + DB load pattern (lớp 2)
- `frontend/app/(main)/races/[slug]/ranking/[courseId]/page.tsx` (≈207-247) — private mode pageSize (lớp 3)
- `admin/src/app/(dashboard)/races/[id]/settings/sections/PublishingSection/PublishingSection.tsx:195` — form `max={500}` (reference, không sửa — đã đúng phía form)

### Endpoint liên quan
- `GET /api/race-results` (`raceResultControllerGetRaceResults`) — endpoint DUY NHẤT dùng `GetRaceResultsDto`. Callers đã grep:
  - Public ranking page (private mode → tới 500; normal mode selector ≤100)
  - Public overview page (`pageSize=3` top finishers) — không đổi
  - Admin CourseSection + admin athletes list — đều ≤100, không đổi
  - ⇒ Nâng `@Max` chỉ **NỚI** thêm, **backward-compatible 100%** (mọi caller cũ ≤100 vẫn hợp lệ).

### Schema/DB
- MongoDB: **KHÔNG đụng** — `getRaceResults` vốn `.find(filter).sort().lean()` load TOÀN BỘ docs của cự ly vào RAM rồi `filterDuplicateRanks` + `.slice(skip, skip+pageSize)` in-memory (service:694-705). Nên pageSize 100 hay 500 → **query DB y hệt**, không tăng tải DB.
- MySQL platform: không đụng.
- Redis: không đổi key pattern. Cache `results:<raceId>:<course>:<pageNo>:<filtersHash>` TTL ~60s — object cache to hơn chút (tối đa 500 dòng), chấp nhận được.

### SDK
- Đổi `maximum` trong OpenAPI schema → **phải chạy `pnpm generate:api`** (frontend; admin nếu cùng dùng) để SDK type đồng bộ. (Validation chỉ là metadata, không enforce ở TS, nhưng vẫn regen cho đúng quy trình.)

---

## ⚠️ Risk Flags

- 🟢 **LOW (tổng thể)** — bugfix, backward-compatible, KHÔNG schema/migration, KHÔNG đụng auth/fee logic. Chỉ đổi 1 con số trần ở 2 chỗ backend + 1 clamp frontend.
- 🟡 **MED** — `race-result.service.ts` là **hot path** (leaderboard, race-day spike). Đổi đúng 1 dòng clamp, nhưng QC phải verify không vỡ pagination bình thường (pageNo>1, totalPages) và không regress cache key.
- 🟡 **MED** — **Bẫy 2-lớp:** sửa thiếu 1 trong 2 chỗ chặn 100 = fix không trọn (vẫn cắt 100 âm thầm). QC bắt buộc test pageSize=500 trả đúng tới 500 dòng, KHÔNG phải 100.
- 🟢 **LOW (perf frontend)** — render tới 500 dòng (cả desktop table + mobile card trong DOM, không virtualize). Máy yếu hơi khựng khi mở. Chấp nhận cho fix này; note tech debt nếu cần virtualize sau.

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

- [x] **Trần = bao nhiêu?** → Danny đã chốt **500** (khớp `max` form admin hiện tại).
- [ ] **Có nâng cả selector "Hiển thị" (10/25/50/100) ở ranking công khai không?** → Đề xuất: **KHÔNG** — selector normal-mode giữ tối đa 100 (UX phân trang bình thường); chỉ path `privateListLimit` mới đi tới 500. BA confirm.
- [ ] **Render 500 dòng có cần virtualize/lazy không?** → Đề xuất: **KHÔNG cho fix này** (chấp nhận, ghi tech debt). BA confirm.
- [ ] **Backfill/validate data cũ:** có race nào đang lưu `privateListLimit` ngoài [1..500] (vd 0/null) không? → clamp frontend `Math.max(1, ...)` + `Math.min(500, ...)` xử lý an toàn mọi giá trị; không cần migration.

---

## 🎯 Success criteria (gợi ý cho BA)

- Operator set `privateListLimit = 500` → trang ranking công khai hiển thị **đủ tới 500 VĐV** (không 400, không cắt 100, không trống).
- `GET /api/race-results?pageSize=500` → 200 + trả tối đa 500 dòng + `pagination.pageSize=500`.
- `pageSize=501` → vẫn 400 (trần mới = 500).
- Mọi caller cũ (pageSize ≤100) hành vi **không đổi** (regression-free).
- Frontend không bao giờ gửi pageSize <1 hoặc >500 (clamp phòng thủ), kể cả data `privateListLimit` = 0/null/>500.

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] Yes — BA có thể bắt đầu. Trần đã chốt = 500; 3 PAUSE còn lại là xác nhận scope nhỏ, BA trả lời trong PRD.

---

## 🔗 Next step

Danny chạy: `/5bib-prd FEATURE-092-raceresult-pagesize-cap-500`
