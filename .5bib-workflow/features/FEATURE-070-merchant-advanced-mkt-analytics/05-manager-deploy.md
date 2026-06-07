# FEATURE-070: Deploy & Memory Sync

**Status:** ✅ DONE
**Deployed:** 2026-06-07
**Author:** 5bib-manager

## 📌 Pre-flight
- [x] 04-qc-report verdict ✅ APPROVED
- [x] 124 backend test PASS (104 F-069 + 20 F-070)
- [x] IMPLEMENTATION_NOTES.md đủ 4 sections (Deviations + Forced + Tradeoffs + Reviewer Notes)
- [x] Files changed khớp Scope Lock 02 — 0 scope creep

## 📊 Deploy summary
- QC ✅ APPROVED · 124 unit/adversarial test pass · tsc 0 (BE+FE) · nest build + merchant next build clean
- 4-agent workflow đầy đủ: init(00) → PRD(01) → plan(02 APPROVED) → code(03+NOTES) → QC(04) → deploy(05)
- Backend deploy: main → CI → DEV. Merchant deploy: CI build-merchant → VPS container.

## 🔬 Manager Code Review
- **`merchant-portal.service.ts`**: getTicketForecast — assertRaceForUser first, cumsum, raceEnded compute, recentDailyRate guard ≥8 điểm, projectedValue null khi ended/<8, target null khi 0/absent (BR-70-05/06/07/09 verbatim ✓). getTicketHeatmap — INTERVAL 7 HOUR + DOW map Mon-first ✓. setTicketTarget — assertRaceForUser TRƯỚC upsert + cache del ✓.
- **Security grep**: assertRaceForUser 3/3 method · SQL 0 `${}` interpolation (param `?`) · 0 money field trong 3 method/DTO · LogtoMerchantGuard class-level.
- **Verdict:** ✅ no red flag.

## 📝 Memory diff (applied)
- `feature-log.md`: counter F-070→**F-071**; append F-070 DEPLOYED entry.
- `change-history.md`: append F-070 full entry (files + arch + review + lessons + tech debt).
- `known-issues.md`: (tech debt ghi trong change-history) forecast linear / heatmap GMT+7 / target no audit-log — non-blocking.
- `codebase-map.md`: note races PK = `race_id` (lesson) + collection mới `merchant_race_target` (sẽ sync khi cần).

## 🔮 Follow-up
- F-071+ candidate: YoY compare chart (cần race-edition linking) + stacked-by-course/velocity (endpoint stacked đã có, chưa wire).
- Forecast seasonal projection nếu BTC cần chính xác hơn.

🎉 **FEATURE-070 DONE.**
