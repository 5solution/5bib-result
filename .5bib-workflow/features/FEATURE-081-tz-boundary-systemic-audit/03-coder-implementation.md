# FEATURE-081: Coder Implementation Log (kèm PRD+Plan compact trong 00-init)

**Status:** 🟠 READY_FOR_QC → QC verdict trong 04
**Started:** 2026-06-09
**Author:** 5bib-fullstack-engineer

## 💻 Files Changed (10)

**Util mới (2):**
- ➕ `backend/src/common/utils/ict-date.util.ts` — 6 helper: toIctDateString / nowIctDateString / startOfMonthIct / startOfDayIct / toUtcSqlDatetime / ictDayRangeUtc
- ➕ `backend/src/common/utils/ict-date.util.spec.ts` — 12 boundary test (order 200029493 case + month/year boundary + 17:00 UTC flip)

**Tier A1 (3 site analytics):**
- ✏️ `dashboard/services/kpi.service.ts` — MTD theo tháng ICT (startOfMonthIct + toUtcSqlDatetime SQL boundary). Removed UTC helpers (startOfMonth/fmtDate/fmtDateExclusive) chống reuse nhầm.
- ✏️ `dashboard/services/sparkline.service.ts` — labels ICT + SQL `GROUP BY DATE(DATE_ADD(payment_on, INTERVAL 7 HOUR))` + dateKey toIctDateString + removed dateRange UTC helper
- ✏️ `analytics/analytics.service.ts` — default from/to dùng nowIctDateString

**Tier B cosmetic (3 site):**
- ✏️ `reconciliation/services/docx.service.ts` + `xlsx.service.ts` — "Ngày đối soát" ICT
- ✏️ `awards/services/podium-pdf.service.ts` — ngày ký ICT

**Test fixtures update (2 — intentional behavior change):**
- ✏️ `dashboard/__tests__/kpi.service.spec.ts` + `dashboard/services/kpi.service.f059.spec.ts` — dispatch exact-match ICT month start (trước: UTC month prefix)

## 🧪 Tests
```
ict-date.util.spec: 12/12 PASS (boundary matrix)
kpi legacy: 6/6 PASS · kpi f059: 9/9 PASS
Sweep dashboard+analytics+reconciliation+awards+common: 584 passed
2 fail PRE-EXISTING verified via git-stash test trên 37e0a6d:
  - sparkline.f059 TC-59-10 (fixture May dates ngoài 30-day window — có sẵn)
  - reconciliation.controller.spec ("Invalid guard" circular import — có sẵn)
```

## ⚠️ A2 DEFERRED per PAUSE-81-01 (chờ Danny)
reconciliation parsePeriod ×2 + reconciliation.cron prev-month + pnl.service ranges — financial documents, đổi số kỳ đã ký merchant. Đề xuất F-082 riêng: áp dụng kỳ mới từ T6/2026 + gộp recompute kỳ cũ với TD-F016-FINANCE-01 migration có thông báo merchant.

## IMPLEMENTATION_NOTES compact
- **Deviation:** none — theo init scope A1+B verbatim.
- **Forced #1:** kpi/f059 test fixtures dispatch theo UTC month prefix → exact-match ICT start (behavior change intentional, documented in-file).
- **Tradeoff:** SQL `DATE_ADD(payment_on, INTERVAL 7 HOUR)` trong GROUP BY = mất index trên payment_on cho GROUP (WHERE range vẫn dùng index — chỉ GROUP shifted). Cost: negligible với range 30 ngày đã filter. Alternative `CONVERT_TZ` cần TZ tables loaded — DATE_ADD an toàn hơn.
- **Reviewer hotspot:** `ict-date.util.ts` boundary math (12 test cover) + kpi.service prev-month ICT compute (shift +7h → Date.UTC(y, m-1) → -7h).
