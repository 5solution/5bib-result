# FEATURE-085: Deploy & Memory Sync

**Status:** ✅ DONE
**Deployed:** 2026-06-15
**Author:** 5bib-manager
**Linked:** `00`, `01`, `02`, `03`, `04`, `IMPLEMENTATION_NOTES`

---

## 📌 Pre-flight check
- [x] `04-qc-report.md` verdict = ✅ APPROVED
- [x] Unit test trong `03` PASS (verify lại: **55/55**)
- [x] File `03 Files Changed` khớp Scope Lock `02` — KHÔNG scope creep
- [x] `IMPLEMENTATION_NOTES.md` 4/4 section đầy đủ
- [x] Đọc Tech debt `03` + `04`

---

## 📊 Deploy summary
- **QC verdict:** ✅ APPROVED · **Unit+QC tests: 55/55 PASS** · tsc clean (igloo files)
- **Branch:** `5bib_igloo_insurance_v1` → main (CI → DEV). 2 kill-switch default false → DEV boot an toàn (0 egress, không cần IGLOO_API_KEY để boot).
- **Migration:** KHÔNG (Mongo collection mới additive + readonly entity +1 cột).

---

## 🔬 Manager Independent Code Review (MANDATORY)

> Đọc code thật theo IMPLEMENTATION_NOTES Section 4 priority. KHÔNG rubber-stamp.

| File | Line | Verify | Verdict |
|---|---|---|---|
| `utils/igloo-helpers.ts` | 15/18/138/150/160 | `IGLOO_PREMIUM_FLAT=10000` + `derivePackageCode→ROAD` + coverage `to:from,totalDays:1` + premium flat → **money bất biến 10k/ROAD/1-day** đúng BR-IGL-08 OVERRIDES | ✅ PASS |
| `services/igloo-request.service.ts` | 206/246/338 | idempotency: filter `status:{$in:IGLOO_ACTIVE_STATUSES}` + catch `code===11000 → return false` → race-safe BR-IGL-06 | ✅ PASS |
| `services/igloo-selection.service.ts` | 70-146 | mọi `db.query` truyền params array `[...params,?]`; `q` chỉ thành `%${q}%` đẩy qua params; KHÔNG interpolate cột/bảng/id → SQL-injection-safe | ✅ PASS |
| `crons/igloo-submit-worker.cron.ts` | 31 | `if (!env.igloo.submitEnabled) return` TRƯỚC mọi xử lý → kill-switch egress đúng BR-IGL-03/19 | ✅ PASS |
| `igloo-insurance.controller.ts` | 37-38 | `@UseGuards(LogtoAdminGuard)` **class-level** + `@ApiResponse` đủ codes mọi route → authz BR-IGL-16 | ✅ PASS |

**Findings:** 0 red flag · 0 BR conflict · 0 type bypass (`as unknown as` đã loại) · 0 SQL injection vector · guard đầy đủ. Type-safe (`payloadSnapshot` typed `CreateIglooRequestPayload`, không cast bẩn).

**Minor (non-blocking, đã tracked TD):** eligible-count xấp xỉ · course_distance có thể null · live-Igloo-verify chưa làm (an toàn, pre-golive).

→ **APPROVED for deploy.**

---

## 📝 Memory diff (đã apply)
- `feature-log.md`: marker FEATURE-085 → ✅ DEPLOYED, counter giữ FEATURE-086.
- `change-history.md`: append entry F-085 (18 file backend + 7 admin + 3 edit).
- `codebase-map.md`: +module `igloo-insurance/`.
- `conventions.md`: +pattern "External async integration: hàng đợi nội bộ QUEUED→submit→poll + 2-tier kill-switch + idempotency unique partnerRefId".
- `known-issues.md`: +5 TD-F085-* (SDK-REGEN / IGLOO-LIVE-VERIFY 🔴 pre-golive / LIVE-E2E / ELIGIBLE-COUNT-APPROX / COURSE-DISTANCE / PERF-SLA).

---

## 🚀 Golive runbook (Danny thao tác trên prod/DEV container)
1. Set `IGLOO_API_KEY=<key>` trên backend container env.
2. Giữ `IGLOO_SUBMIT_ENABLED=false` → vào admin tạo thử → đơn "Chờ gửi", verify data.
3. `IGLOO_SUBMIT_ENABLED=true` + restart → verify 1 đơn thật ra `gicContractNo`+cert (TD-F085-IGLOO-LIVE-VERIFY).
4. `IGLOO_DAILY_ENABLED=true` → cron 9h VN tự đẩy 10 VĐV/ngày.
5. Tắt khẩn cấp bất kỳ lúc nào: `IGLOO_SUBMIT_ENABLED=false`.

---

## 🔮 Follow-up
- Sau khi Igloo nhận ROAD-10k OK → có thể auto-on cron.
- Nếu Igloo từ chối same-day coverage → đổi eligibility `event_start_date >= tomorrow`.
- Reuse pattern "queue + 2 kill-switch + idempotency" cho tích hợp bên thứ ba tương lai.

## ✅ Status
🎉 **FEATURE-085 DONE** — memory synced, code → main (CI deploy DEV). Golive thật chờ Danny set key + bật flag.
