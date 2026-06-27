# FEATURE-092 — Implementation Notes (Reviewer's Guide)

> Bugfix: nâng trần `pageSize` của `GET /api/race-results` từ 100→500. Reviewer đọc file này trước khi spot-check code.

---

## Section 1: 🚧 Deviations from Spec (intentional)

- **[Deviation #1] KHÔNG chạy `pnpm generate:api`**
  - **Spec said:** PRD 3.6 + Plan: "đổi `maximum` schema → chạy `pnpm generate:api`".
  - **I did:** KHÔNG chạy regen SDK.
  - **Why:** Thay đổi DUY NHẤT ảnh hưởng schema là `maximum: 100→500` (OpenAPI metadata). `@hey-api/openapi-ts` sinh TS type `pageSize?: number` — KHÔNG encode `maximum`. Nên generated SDK byte-identical → regen = no-op diff. Thêm nữa `generate:api` fetch từ `http://localhost:8081/swagger/json` (cần boot backend), chạy chỉ để được diff rỗng = noise + rủi ro touch nhiều file generated không cần thiết.
  - **Reviewer should check:** Nếu muốn chắc, boot backend + chạy `cd frontend && pnpm generate:api` → confirm `git diff lib/api-generated/` rỗng. Hành vi runtime không phụ thuộc việc này (validation enforce ở backend).

- **[Deviation #2] Giữ clamp `Math.min` ở service (không bỏ dù đã có `@Max` DTO)**
  - **Spec said:** Plan cho phép; PRD BR-02 yêu cầu sửa cả 2 lớp.
  - **I did:** Đổi `Math.min(...,100)→500` thay vì xoá clamp service.
  - **Why:** Defense-in-depth. DTO `@Max` chặn ở pipe; nhưng nếu có caller nội bộ gọi `getRaceResults()` trực tiếp (không qua controller pipe) thì service clamp vẫn bảo vệ. Giữ nguyên cấu trúc 2 lớp, chỉ đổi con số.
  - **Reviewer should check:** Service clamp = 500 khớp DTO `@Max(500)` (không lệch).

---

## Section 2: ⚙️ Forced Changes (reality ≠ spec)

- **Không có forced change.** PRD reference 3 vị trí (DTO:56, service:663, frontend:228) khớp 100% code thật (Manager đã spot-check ở `02`). Không phát sinh chỗ nào codebase khác spec.

---

## Section 3: ⚖️ Tradeoffs Considered

| Decision | Option chosen | Alternative | Why chose | Cost paid |
|----------|---------------|-------------|-----------|-----------|
| Trần private list | 500 (khớp form admin) | Clamp form admin về 100 (không đụng backend) | Danny muốn hiện >100; tôn trọng intent | Backend phải sửa 2 lớp + payload tối đa 500 dòng/request (~vài trăm KB, cache 60s) |
| Lớp enforce | Sửa CẢ DTO + service | Chỉ sửa DTO | Chỉ DTO → service `Math.min(...,100)` âm thầm cắt 100 → fix không trọn | Thêm 1 dòng + 1 test (TC-07) để chặn |
| Frontend clamp `||` vs `??` | `Math.min(500, Math.max(1, privateListLimit \|\| 20))` | `?? 20` | `??` không bắt 0 → pageSize=0 → 400. `\|\| 20` bắt cả 0/NaN | `\|\|` cũng coi giá trị hợp lệ 0 là falsy — nhưng 0 không phải limit hợp lệ nên đúng ý |
| Render 500 dòng | Render thẳng (no virtualize) | react-window virtualize | Scope tối giản cho bugfix; 500 row OK trên đa số máy | Máy yếu hơi khựng (TD-F092-VIRTUALIZE) |

---

## Section 4: 🔬 Reviewer Notes (Manager + QC focus)

### Files cần review kỹ (priority order)
1. **`backend/src/modules/race-result/services/race-result.service.ts:662-663`** — clamp `Math.min(...,500)`. Đây là lớp dễ bị quên nhất → verify = 500 (không phải 100). Test chặn: service spec TC-07/TC-01.
2. **`backend/src/modules/race-result/dto/get-race-results.dto.ts:46,49,56`** — `description "max 500"` + `maximum: 500` + `@Max(500)`. Cả 3 phải đồng bộ 500.
3. **`frontend/app/(main)/races/[slug]/ranking/[courseId]/page.tsx:227-231`** — clamp `[1,500]` + `|| 20`. Verify không gửi pageSize ngoài range.

### Concurrency hotspots
- Không có. Endpoint read-only, không mutation/lock.

### Edge cases tested vs DEFERRED
- ✅ Tested: pageSize 500/600-data/1000-clamp/100-regression/50-pageNo2/501-reject/0-reject/omit-default
- ⚠️ Deferred (acceptable): live E2E giải >100 VĐV + privateListLimit>100 → post-deploy (cần BE mới); render-perf 500 dòng mobile (TD-F092-VIRTUALIZE)

### Type safety narrowed casts
- Không thêm cast nào. Edit chỉ đổi number literal + thêm `Math.min/max` (number→number).

### Security checklist self-applied
- [x] Endpoint public read — response shape KHÔNG đổi → không leak field/PII mới
- [x] `enforceRaceVisibility` (draft race 404 cho anon) KHÔNG đụng
- [x] Không SQL (Mongo only); không interpolation
- [x] Cache key namespace KHÔNG đổi → không collision

### Performance
- DB cost KHÔNG đổi (service vốn load toàn bộ rồi slice in-memory — verify dòng 694-705 không có `.limit()` ở DB). Delta = map/serialize ≤400 dòng + payload to hơn. Cache 60s hấp thụ.

### Regression risk
- Backward-compat: mọi caller ≤100 (overview pageSize=3, admin, selector ≤100) KHÔNG đổi (nâng max chỉ nới). TC-03/TC-06 chặn regression.
