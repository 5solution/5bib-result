# FEATURE-092: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-06-27
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md`
- [x] Đã đọc `01-ba-prd.md` toàn bộ
- [x] Đã đọc memory: `conventions.md` (pageSize cap pattern), `known-issues.md` (TD-F062, TD-F038-PAGE-CLAMP)
- [x] Đã spot-check code thật 3 file then chốt (KHÔNG rubber-stamp)

---

## 🔬 SPOT-CHECK CODE THẬT (MANDATORY — verify PRD không hallucinate)

| PRD reference | Code thật | Khớp? |
|---------------|-----------|-------|
| `get-race-results.dto.ts` `@Max(100)` + `maximum:100` + desc "max 100" | dòng 46 `description: 'Page size (max 100)'`, dòng 49 `maximum: 100`, dòng 56 `@Max(100)`, dòng 57 `pageSize?: number = 10` | ✅ |
| `race-result.service.ts:663` `Math.min(...,100)` | dòng 663 `const pageSize = Math.min(dto.pageSize ?? 10, 100);` (comment "Enforce pageSize cap") | ✅ |
| `ranking/[courseId]/page.tsx:228` `effectivePageSize` | dòng 227 `isPrivateNoSearch = (race?.enablePrivateList ?? false) && !searchQuery.trim()`, dòng 228 `effectivePageSize = isPrivateNoSearch ? (race?.privateListLimit ?? 20) : pageSize` | ✅ |
| `GetRaceResultsDto` dùng bởi 1 endpoint duy nhất | grep xác nhận chỉ `GET /api/race-results` (controller `getRaceResults`) | ✅ |
| Service `.find()` load hết rồi slice in-memory | dòng 694-705 `.find(filter).sort().lean()` → `filterDuplicateRanks` → `.slice(skip, skip+pageSize)` (KHÔNG `.limit()` ở DB) | ✅ |

→ **Không có file/method/field nào BA hallucinate.** PRD bám đúng code thật.

---

## ✓ PRD Validation Checklist

### Completeness
- [x] User Stories đầy đủ (Race Organizer / Anonymous / Back-Office Admin)
- [x] Business Rules có ID (BR-01..08), testable
- [x] Tất cả PAUSE conditions file 00 đã được BA trả lời (trần=500 + 3 PAUSE-92-*)

### Technical correctness vs codebase
- [x] Đổi đúng 2 lớp backend (DTO + service) — BR-02 chỉ rõ bẫy "quên lớp service"
- [x] Clamp frontend `|| 20` bắt cả 0 (BR-05) — đúng lỗ hổng `?? 20` đã phát hiện
- [x] Response shape KHÔNG đổi → KHÔNG breaking SDK (BR-07)
- [x] `pnpm generate:api` được flag (3.6) cho schema `maximum` đổi
- [x] Cache key pattern KHÔNG đổi

### Security
- [x] Endpoint public read — fix KHÔNG mở field/PII mới (response shape giữ nguyên)
- [x] `enforceRaceVisibility` (draft race 404 cho anon) giữ nguyên
- [x] Abuse vector (public gọi pageSize=500) đánh giá: data công khai + cache + bounded → LOW, chấp nhận

### Performance
- [x] SLA cụ thể (p95 < 800ms cache miss / <100ms hit)
- [x] DB cost KHÔNG tăng (đã verify load-all-then-slice) — luận điểm đúng
- [x] Tech debt virtualize được flag (TD-F092-VIRTUALIZE)

### Testability
- [x] TC-01 (pageSize=500 → data.length tới 500 + pagination.pageSize===500) — bắt bug "cắt 100"
- [x] TC-07 unit test service clamp — bắt bug "quên sửa lớp service"
- [x] TC regression pageSize≤100 (BR-04) + pagination giữa chừng pageNo>1 (BR-06)
- [x] Boundary 501→400, 0→400, default→10

---

## 📊 Cross-check với memory

- **Architecture:** KHÔNG thêm node/integration. Chỉ đổi hằng số trần trong path có sẵn. Architecture.md KHÔNG cần update.
- **Conventions:** Pattern "2-lớp enforce cap (DTO + service)" đáng ghi vào conventions sau deploy như 1 lesson (sửa cap PHẢI grep cả validation lẫn service clamp).
- **Known-issues:** TD-F062 (in-memory sort+limit) — fix này KHÔNG làm tệ hơn (DB vốn load hết). TD-F038-PAGE-CLAMP (deep-link page>totalPages) là endpoint khác (finance), KHÔNG liên quan.

---

## 📋 Files được phép thay đổi (Scope Lock)

Coder CHỈ được đụng:

**Backend (`backend/`):**
- ✏️ `src/modules/race-result/dto/get-race-results.dto.ts` — `@Max(100)→500`, `@ApiPropertyOptional` `maximum: 100→500` + description "max 100"→"max 500"
- ✏️ `src/modules/race-result/services/race-result.service.ts` (≈663) — `Math.min(dto.pageSize ?? 10, 100)` → `...500`
- ➕/✏️ `src/modules/race-result/**/*.spec.ts` — unit test cho service clamp (TC-07) + (nếu chưa có) test pageSize boundary. Coder chọn file spec phù hợp (service spec hiện có hoặc tạo mới).

**Frontend (`frontend/`):**
- ✏️ `app/(main)/races/[slug]/ranking/[courseId]/page.tsx` (≈228) — clamp `Math.min(500, Math.max(1, race?.privateListLimit || 20))`
- 🔄 `lib/api-generated/**` (auto) — nếu chạy `pnpm generate:api`

**NGOÀI scope = scope creep, phải hỏi Manager:**
- KHÔNG đụng `PublishingSection.tsx` (form admin đã đúng)
- KHÔNG đụng selector "Hiển thị" (giữ max 100 — PAUSE-92-01)
- KHÔNG đụng `filterDuplicateRanks`, sort map, cache, filter, response DTO

---

## 🔧 Tech approach (đề xuất)

- Sửa đúng 2 con số backend (DTO `@Max` + ApiProperty `maximum` + service `Math.min`) + 1 clamp frontend. Tối giản.
- Service clamp giữ `Math.min(..., 500)` (KHÔNG bỏ clamp) — defense-in-depth phòng client gửi vượt.
- Frontend dùng `|| 20` (KHÔNG `?? 20`) để 0 cũng fallback 20, rồi `Math.min(500, Math.max(1, ...))`.

---

## 🛑 PAUSE points cho Coder
- KHÔNG migration, KHÔNG dep mới, KHÔNG auth/fee. **KHÔNG có PAUSE.** Nếu phát sinh cần đụng file ngoài Scope Lock → dừng hỏi Manager.

---

## 🧪 Unit test BẮT BUỘC (Coder phải viết, QC check)

- [ ] **TC-07 (then chốt):** service `getRaceResults` với `dto.pageSize=500` (mock find ≥200 doc) → `data.length` tới 500 + `pagination.pageSize===500` (verify lớp service KHÔNG cắt 100)
- [ ] Service clamp `dto.pageSize=1000` → trả 500 (`Math.min`)
- [ ] DTO validation: `pageSize=501` → reject (`@Max(500)`); `pageSize=0` → reject (`@Min(1)`); `pageSize=500` → pass
- [ ] Regression: `dto.pageSize=50, pageNo=2` → slice đúng (skip 50, len ≤50, pagination.pageNo=2)
- [ ] (Frontend, nếu tách helper) clamp: 90→90, 500→500, 999→500, 0→20, null→20

---

## 📊 Verdict

### ✅ APPROVED — Coder có thể bắt đầu

Bugfix sạch, scope tối giản, backward-compatible, KHÔNG migration/auth/fee. PRD bám đúng code thật (spot-check 5/5 PASS). Rủi ro chính = "sửa thiếu 1 trong 2 lớp backend" → đã có TC-01 + TC-07 chặn.

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] Yes — theo Scope Lock + unit test bắt buộc trên.

---

## 🔗 Next step

Danny chạy: `/5bib-code FEATURE-092-raceresult-pagesize-cap-500`
