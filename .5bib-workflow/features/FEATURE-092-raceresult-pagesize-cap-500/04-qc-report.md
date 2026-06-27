# FEATURE-092: QC Report

**Status:** ✅ APPROVED
**Tested:** 2026-06-27
**Author:** 5bib-qc-gatekeeper
**Linked:** `01-ba-prd.md`, `03-coder-implementation.md`, `IMPLEMENTATION_NOTES.md`

---

## 📌 Pre-flight check

- [x] `03-coder-implementation.md` status = 🟠 READY_FOR_QC
- [x] `03` có section "Tests Written" + output PASS (11 NEW F-092) → KHÔNG auto-reject
- [x] Đã đọc `01-ba-prd.md` (BR-01..08 + TC) + `IMPLEMENTATION_NOTES.md` (Section 4 priority files)
- [x] Đã đọc `memory/conventions.md` (anti-patterns)
- [x] QC tự re-run test + tự đọc code (KHÔNG rubber-stamp Coder claims)

---

## 🔍 Phase 1: Impact & Regression Audit

### What the Coder got right (independently verified)
- **Cả 3 lớp = 500** (QC grep verify): DTO `description "max 500"` (L46) + `maximum: 500` (L49) + `@Max(500)` (L56); service `Math.min(dto.pageSize ?? 10, 500)` (L664); frontend `Math.min(500, Math.max(1, race?.privateListLimit || 20))` (L231). KHÔNG sót "max 100" nào.
- **Backward-compat:** nâng `@Max` chỉ nới [101..500], caller ≤100 (overview pageSize=3, admin, selector) không đổi — verified TC-03/TC-06.
- **DB cost không tăng:** service vốn `.find().sort().lean()` load hết rồi `.slice()` in-memory (L694-705, không `.limit()` DB) — luận điểm đúng.
- **0 scope creep:** chỉ 3 file core (đúng Scope Lock) + 2 spec (`*.spec.ts` được phép).

### What the Coder MISSED
- **Không có.** Diff service CHỈ đụng dòng `Math.min` + comment (QC verify `git diff`) — `enforceRaceVisibility` (L640), response mapping `data/pagination` (L709-710) nguyên vẹn. Không touch `filterDuplicateRanks`/sort/cache.

### Regression
- Service spec có **6 fail pre-existing** — QC confirm KHÔNG liên quan F-092 (grep tên test fail: rỗng match "F-092"). Là infra debt cũ (`syncAllRaceResults` axios spy + `submitClaim` mock thiếu `notifyClaimSubmitted`), tồn tại trên HEAD trước thay đổi. **F-092: +11 pass, 0 regression.**

---

## 🛡️ Phase 2: Security Threat Model

| Threat | Vector | Risk | Status |
|--------|--------|------|--------|
| Info disclosure: response leak field mới | pageSize lớn → trả nhiều dòng | LOW | ✅ Response shape KHÔNG đổi (chỉ `data[]` dài hơn, mỗi dòng qua `mapDocToResponse` như cũ) |
| Draft race exposure cho anon | bỏ qua visibility | CRITICAL | ✅ `enforceRaceVisibility(dto.raceId, user)` L640 nguyên vẹn — verified |
| Scrape amplification | public gọi pageSize=500 (5× so 100) | LOW | ✅ Chấp nhận: data vốn công khai + cache 60s + bounded 500 (không unbounded). Đánh giá trong PRD 4.3 |
| DoS qua pageSize khổng lồ | pageSize=999999 | LOW | ✅ DTO `@Max(500)` reject 400 + service `Math.min(...,500)` clamp (2 lớp) |
| Injection | pageSize param | NONE | ✅ `@IsInt()` + `@Type(Number)`; Mongo `.slice()` numeric, không string interpolation |
| Filter bypass (duplicate ranks / strip) | pageSize lớn skip lọc | LOW | ✅ `filterDuplicateRanks` chạy TRƯỚC `.slice()` — không bypass |

**0 CRITICAL/HIGH unmitigated.**

---

## 🧪 Phase 3 + 4: Test Scripts & Stability (Coder viết, QC verify + adversarial)

QC KHÔNG viết thêm E2E mới (bugfix backend thuần, không UI surface mới). Thay vào đó **adversarial-verify test của Coder thực sự có ý nghĩa** (chống test giả pass):

### Adversarial mutation test (QC thực hiện)
Tạm revert service `Math.min(...,500)` → `100` (giả lập Coder quên lớp service):
```
✕ TC-01: pageSize=500 returns >100 rows ... (FAILED — đúng kỳ vọng)
✕ TC-01b: pageSize=500 returns exactly 500 ... (FAILED)
✕ TC-07: pageSize=1000 clamps to 500 ... (FAILED)
✓ TC-03 / TC-06 (≤100 regression — vẫn pass, không phụ thuộc cap)
→ 3 failed, 2 passed
```
Restore → `500` → 5/5 pass. **Kết luận: test KHÔNG giả pass — nó thực sự gác lỗi "quên 1 lớp".**

### Test execution (QC re-run độc lập)
```
DTO boundary (get-race-results.dto.spec.ts -t F-092): 6 passed, 6 total
  ✓ 500 pass / 100 pass / 501 reject(max) / 1000 reject(max) / 0 reject(min) / omit→default 10
Service clamp (race-result.service.spec.ts -t F-092): 5 passed
  ✓ TC-01 / TC-01b / TC-07 / TC-03 / TC-06
→ 11/11 F-092 PASS
```

### Live prod cURL (code CŨ — chứng minh bug pre-deploy)
```
pageSize=100 → 200 OK, len=100, total=3922
pageSize=101 → 400 "pageSize must not be greater than 100"   ← BUG
pageSize=500 → 400 "pageSize must not be greater than 100"   ← BUG (đúng cái Danny báo)
```
**Post-deploy verification plan (gate Manager/Danny chạy sau deploy):**
```
pageSize=500 → 200 OK, len tới 500 (race 3km có 3922 → len=500)
pageSize=501 → 400 "pageSize must not be greater than 500"
```

### Performance
- DB cost KHÔNG tăng (load-all-then-slice). Delta = serialize ≤400 dòng + payload. SLA p95 < 800ms (cache miss) đạt — race 3km hiện p95 < ~600ms với pageSize=90 live.

---

## ✅ Phase 5: PRD Compliance Check

| BR | Nội dung | Verified by |
|----|----------|-------------|
| BR-01 | Trần = 500 | DTO `@Max(500)` + service `Math.min(...,500)` grep ✓ |
| BR-02 | Enforce CẢ 2 lớp backend | Adversarial mutation test (revert service→100 ⇒ TC-01/07 fail) ✓ |
| BR-03 | `[1,500]`, <1→400, default 10 | TC-04 (0→min) + TC-05 (omit→10) ✓ |
| BR-04 | Backward-compat ≤100 | TC-03 (100→100) + TC-06 (50,pageNo2) ✓ |
| BR-05 | Frontend clamp `|| 20` bắt cả 0 | Code L231 `Math.min(500,Math.max(1,...||20))` ✓ |
| BR-06 | Pagination pageNo>1 đúng | TC-06: page2/50 → Bib 1050, pageNo=2 ✓ |
| BR-07 | Response shape không đổi | `git diff` service chỉ Math.min; mapping L709-710 nguyên ✓ |
| BR-08 | Không migration; clamp xử lý data cũ | FE clamp 0/null/>500 → [1,500] ✓ |

**8/8 BR covered.**

UI states: feature KHÔNG thêm UI mới (chỉ đổi giá trị 1 biến truyền vào fetch có sẵn). Trang ranking states (loading/data/empty/private) không đổi cấu trúc → không cần test state mới. Hiệu ứng quan sát được: list KHÔNG còn trống khi `privateListLimit` 101–500.

---

## 👥 Phase 6: Persona Journey Walkthrough

**N/A — KHÔNG có UI surface mới.** Feature chỉ nâng trần số + 1 clamp; không thêm màn hình/nút/trường/dialog. Theo directive Phase 6 "MANDATORY cho feature CÓ UI" → bugfix backend không trigger. 1 journey quan sát được (post-deploy):

| # | Persona | Action | Expected (post-deploy) |
|---|---------|--------|------------------------|
| 1 | Race Organizer | Admin set `privateListLimit=500`, lưu | Form lưu OK (đã đúng từ trước) |
| 2 | Anonymous Visitor | Mở `/races/[slug]/ranking/[courseId]` (private, no search), cự ly >100 VĐV | Bảng render tới 500 VĐV — KHÔNG còn trống |
| 3 | Anonymous Visitor | Cự ly có `privateListLimit=90` | Render 90 (regression — không đổi) |

(Verify thật bằng cURL plan ở Phase 4 sau deploy.)

---

## 🚧 Tech debt còn lại sau ship (Manager append known-issues)
- **TD-F092-VIRTUALIZE** 🟢 LOW — bảng render tới 500 dòng không virtualize (máy yếu khựng khi giải set limit cao).
- **TD-F092-PREEXISTING-SPEC** 🟢 LOW — 6 test pre-existing fail trong `race-result.service.spec.ts` (mock `notifyClaimSubmitted` + axios sync). Không thuộc F-092; dọn sau.

---

## 📊 Final Verdict

### ✅ APPROVED — Sẵn sàng deploy

- 11/11 F-092 unit test PASS + adversarial mutation chứng minh test gác đúng lỗi.
- Cả 3 lớp (DTO + service + frontend) = 500, đồng bộ, KHÔNG sót 100.
- 8/8 BR covered. Security 0 CRITICAL/HIGH (response shape + draft-guard nguyên vẹn). Backward-compat verified.
- 0 regression (6 fail pre-existing, độc lập F-092). 0 scope creep.

**Pre-merge note (không block QC):** `generate:api` no-op (metadata-only) — Manager confirm diff rỗng nếu muốn. Post-deploy: chạy 2 cURL ở Phase 4 trên prod để đóng loop.

---

## 🔗 Next step

Danny chạy: `/5bib-deploy FEATURE-092-raceresult-pagesize-cap-500`
