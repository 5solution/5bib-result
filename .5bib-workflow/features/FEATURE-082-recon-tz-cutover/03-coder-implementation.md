# FEATURE-082: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC → QC verdict trong 04
**Started:** 2026-06-10
**Author:** 5bib-fullstack-engineer

## 💻 Files Changed (8)
- ✏️ `common/utils/ict-date.util.ts` — +`ICT_PERIOD_CUTOVER` const + `prevPeriod`/`endOfPeriodMs` private + `periodRangeUtc()` export
- ✏️ `common/utils/ict-date.util.spec.ts` — +11 test (cutover matrix T4/T5 UTC + T6 seam + T7 ICT + continuity chain T4→T8 + seam-window single-count + straddle + year boundary ×2)
- ✏️ `reconciliation/services/reconciliation-query.service.ts` — queryOrders boundary qua `periodRangeUtc`
- ✏️ `reconciliation/services/reconciliation-preflight.service.ts` — checkFeeChanged cùng helper
- ✏️ `finance/services/fee.service.ts` — periodClause params qua helper (đồng bộ F-058)
- ✏️ `analytics/analytics.service.ts` — buildDateFilter month branch qua helper (clause đổi `< next-month` → `<= toUtc` inclusive)
- ✏️ `reconciliation/services/reconciliation.cron.ts` — timeZone ICT + prev-month ICT derive + label getUTC*
- ✏️ `finance/services/pnl.service.ts` — resolveDateRange presets `monthStartIctOffset()` (custom branch giữ — đã ICT-aware)
- ➕ `reconciliation/services/__qc__/f082-period-boundary.spec.ts` — 4 QC param-assert test

## 🧪 Tests
```
ict-date.util.spec: 23/23 (12 F-081 + 11 F-082)
QC f082-period-boundary: 4/4 (param-assert T4 UTC / T6 seam / T7 ICT / re-create-T5-after-deploy deterministic)
Sweep reconciliation+finance+analytics+dashboard+common: 646/647 — 1 fail + 1 suite-fail PRE-EXISTING (stash-verified F-081)
tsc clean toàn bộ touched files
```

## IMPLEMENTATION_NOTES compact
- **Deviation:** analytics month clause đổi `payment_on < next-month-01` (exclusive) → `payment_on <= toUtc` (inclusive 23:59:59-style) để dùng chung helper signature với recon — semantics tương đương (resolution giây).
- **Forced:** none — workflow map + verify đã chốt đúng altitude trước khi code.
- **Tradeoffs:** (1) Seam rule: đơn 1/6 00:00-06:59 ICT thuộc kỳ T5 — "sai" ICT semantics nhưng giữ số T5 đã ký + zero double-count; full ICT từ T7. Cost: 1 tháng seam duy nhất. (2) pnl monthStartIctOffset inline helper thay vì util chung — month-offset logic chỉ dùng 1 chỗ; extract khi có consumer thứ 2.
- **Reviewer hotspots:** `endOfPeriodMs` cutover branch (string compare `period >= '2026-06'` — zero-padded guaranteed by validator regex) + seam-window test line assert `inT6 = false`.
