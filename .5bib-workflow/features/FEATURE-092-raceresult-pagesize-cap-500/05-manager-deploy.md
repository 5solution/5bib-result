# FEATURE-092: Deploy & Memory Sync

**Status:** ✅ DONE — DEPLOYED PROD release/v1.23.3 + verified live (2026-06-27)
**Deployed:** 2026-06-27
**Author:** 5bib-manager
**Linked:** `00`, `01`, `02`, `03`, `04`, `IMPLEMENTATION_NOTES.md`

---

## 📌 Pre-flight check

- [x] `04-qc-report.md` verdict = ✅ APPROVED
- [x] Unit test trong `03` PASS (11 NEW F-092) + QC re-run + adversarial mutation verified
- [x] File thay đổi (`03`) khớp Scope Lock (`02`) — 5 file, 0 scope creep
- [x] `IMPLEMENTATION_NOTES.md` đủ 4 sections (Deviations + Forced + Tradeoffs + Reviewer Notes)
- [x] Đã đọc Tech debt còn lại (`03`+`04`) → 2 TD non-blocking

---

## 🔬 INDEPENDENT CODE REVIEW (Manager — KHÔNG rubber-stamp)

**Bước 0 — IMPLEMENTATION_NOTES:** Section 1 Deviation #1 (skip `generate:api`, metadata-only) — hợp lệ, không conflict BR; Deviation #2 (giữ clamp service) — đúng defense-in-depth. Section 2: không forced change. Section 4 priority: service:664 → DTO:46/49/56 → frontend:231.

Spot-check theo priority list (5 điểm critical — đây là bugfix 3 file nên review TOÀN BỘ diff):

| # | File:line | Verify | Verdict |
|---|-----------|--------|---------|
| 1 | `race-result.service.ts:664` | `Math.min(dto.pageSize ?? 10, 500)` — clamp = 500 khớp DTO; KHÔNG đụng `enforceRaceVisibility` (L640) / response mapping (L709-710) / `filterDuplicateRanks`. `git diff` chỉ 1 dòng logic + comment. | ✅ PASS |
| 2 | `get-race-results.dto.ts:46,49,56` | `description "max 500"` + `maximum: 500` + `@Max(500)` — cả 3 đồng bộ, `@Min(1)` giữ nguyên, default 10 giữ. | ✅ PASS |
| 3 | `ranking/[courseId]/page.tsx:231` | `Math.min(500, Math.max(1, race?.privateListLimit || 20))` — clamp [1,500], `||` bắt cả 0. Type number→number, không cast. | ✅ PASS |
| 4 | `get-race-results.dto.spec.ts` | 6 test boundary (500/100/501/1000/0/omit) qua `plainToInstance`+`validate` — đúng pattern class-validator. | ✅ PASS |
| 5 | `race-result.service.spec.ts` (F-092 block) | 5 test; mock `find().sort().lean().exec()` trả array; `makeDocs(n)` rank duy nhất → không bị `filterDuplicateRanks` drop. Adversarial (QC revert→100) chứng minh test gác đúng. | ✅ PASS |

**Checklist:** Business logic = BR-01/02 verbatim (trần 500 + 2 lớp) ✓ · Type safety: 0 `any`/`as unknown` MỚI ✓ · Error handling: validation 400 qua class-validator pipe ✓ · KHÔNG SQL (Mongo) ✓ · Guard: endpoint public read, `enforceRaceVisibility` draft-404 nguyên ✓ · Convention: NestJS DTO + Mongoose pattern giữ ✓

**Red flags:** KHÔNG có. **Verdict: APPROVED for deploy.**

---

## 📊 Deploy summary

- **QC verdict:** ✅ APPROVED (6 phase)
- **Unit tests:** 11/11 F-092 PASS (6 DTO + 5 service); 6 pre-existing fail (infra debt, không liên quan)
- **Static:** tsc clean cho Scope Lock (BE + FE)
- **Live prod (code cũ):** bug tái hiện (pageSize 101/500 → 400). Post-deploy verify: pageSize=500 → tới 500 dòng + 501 → 400.
- **Files:** 5 (4 modified + 1 new spec), 0 scope creep, 0 F-084/junk bleed
- **Release đề xuất:** patch **v1.23.3** (latest = v1.23.2)

---

## 📝 Memory diff (đã apply)

### `feature-log.md`
- Counter F-092 marker: 🟡 INITIATED → ✅ QC APPROVED + code-review PASS (deploy push pending Danny). Sẽ chuyển Shipped table khi PROD push xong.

### `change-history.md`
- Append entry F-092 (xem section dưới — đã ghi vào file).

### `known-issues.md`
- ➕ TD-F092-VIRTUALIZE 🟢 LOW (render 500 dòng không virtualize)
- ➕ TD-F092-PREEXISTING-SPEC 🟢 LOW (6 test infra debt trong race-result.service.spec.ts)

### `conventions.md`
- ➕ Pattern F-092.1: "Sửa giới hạn (cap/max/limit) PHẢI grep CẢ validation layer (DTO `@Max`) LẪN service clamp (`Math.min`) — 2 lớp lệch nhau gây fix nửa vời (lớp service âm thầm cắt). Đính kèm test adversarial (revert 1 lớp → assert fail)."

### `codebase-map.md` / `architecture.md`
- (No change) — không thêm file/flow/integration.

---

## 🚀 Deploy plan (chờ Danny xác nhận PROD push — git policy + live race)

> Thay đổi đụng main/release CẦN Danny duyệt (memory git policy). Race đang live → timing là quyết định của Danny.

1. Commit 5 file F-092 + workflow docs lên **feature branch sạch** `fix/F-092-pagesize-cap-500` (tách khỏi working-tree dơ F-084) — pre-authorized.
2. **DEV:** merge/push `main` → CI build-and-deploy → `result-dev` (verify pageSize=500 trên dev).
3. **PROD:** cut `release/v1.23.3` từ origin/main → deploy-production.yml → `result.5bib.com` (~13 phút; watch "Created" hang). Verify 2 cURL Phase 4.

---

## 🔮 Follow-up
- Vấn đề "ẩn/hiện chi tiết VĐV" Danny nhắc → feature riêng (F-093+) sau.
- Post-deploy: chạy 2 cURL prod đóng loop (pageSize=500→tới 500, 501→400).

## ✅ Status
🎉 **FEATURE-092 DONE — DEPLOYED PROD.** Danny chốt DEV-trước-rồi-PROD. Chain: commit `8d16c4d` → main (CI DEV ✓) → `release/v1.23.3` (Deploy Production ✓, no "Created" hang).

**Live verification:**
- DEV (race 1190 kết quả): `pageSize=500→len=500 totalPages=3`, `501→400 "max 500"`.
- PROD (race Không Ma Tuý 3km, 3922): `pageSize=100→100`, `pageSize=500→len=500 totalPages=8` (BUG HẾT), `501→400`; browser ranking render OK (no regression).

Memory synced (feature-log DEPLOYED + change-history + known-issues 2 TD + conventions F-092.1). Follow-up: vấn đề ẩn/hiện chi tiết VĐV → feature riêng sau.
