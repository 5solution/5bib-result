# FEATURE-081: Deploy & Memory Sync

**Status:** ✅ DONE (scope A1+B)
**Deployed:** 2026-06-09
**Author:** 5bib-manager

## 🔬 Manager Code Review
- **`ict-date.util.ts`** — boundary math verified per 12-test matrix (17:00 UTC flip + month/year boundary + order 200029493 real case). Constants ICT_OFFSET_MS đúng. Zero deps. PASS.
- **`kpi.service.ts` MTD ICT** — prev-month compute (shift +7h → Date.UTC(y,m-1,1) → -7h) verified đúng qua spec dispatch exact-match. UTC helpers removed chống reuse nhầm — đúng hướng convention. PASS.
- **`sparkline.service.ts`** — labels/SQL-group/dateKey 3 chỗ consistent ICT. PASS.
- **Cosmetic 3 site** — sed minimal + imports đúng path. PASS.

## 📊 Summary
- QC ✅ · 12+6+9 new-path tests PASS · 584 sweep · 2 pre-existing fails isolated (git-stash verified)
- **A2 financial (reconciliation parsePeriod + pnl ranges) DEFERRED** → PAUSE-81-01 chờ Danny → F-082

## 📝 Memory diff
- feature-log: F-080 + F-081 DEPLOYED, counter → F-082
- conventions: **F-081.1 ICT date convention** — MỌI logic ngày/tháng nghiệp vụ VN dùng `common/utils/ict-date.util`; CẤM `toISOString().slice(0,10)` cho business date; SQL group theo ngày VN dùng `DATE(DATE_ADD(col, INTERVAL 7 HOUR))`
- known-issues: +TD-F081-A2-FINANCIAL-TZ (PAUSE Danny) + 2 pre-existing spec fails + RESOLVED note TD-F079-TZ-BOUNDARY-FILTER (hotfix4) giờ có util chuẩn

## 🔮 Follow-up
- F-082 candidate: A2 financial TZ (PAUSE-81-01) — cần Danny chốt kỳ áp dụng + merchant comms, nên gộp TD-F016-FINANCE-01 recompute
- Future feature đụng date nghiệp vụ → BẮT BUỘC ict-date.util (Manager Plan check)
