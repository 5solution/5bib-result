# FEATURE-082: Reconciliation TZ Cutover — ICT boundary từ kỳ T6/2026

**Status:** ✅ DEPLOYED (xem 03/04/05)
**Created:** 2026-06-10
**Owner:** Danny (chốt PAUSE-81-01: "Ừm từ kì Tháng 6 thôi")
**Type:** BUGFIX (financial — Tier A2 từ F-081 audit)

---

## 🎯 Why
F-081 audit: kỳ đối soát tháng filter `processed_on` theo UTC month → đơn VN paid/processed 1/X 00:00-06:59 sáng ICT rơi vào kỳ THÁNG TRƯỚC. Memory test case đã flag từ trước. Danny chốt: ICT boundary áp dụng TỪ KỲ T6/2026, kỳ cũ giữ nguyên số đã ký merchant.

## 🔬 Pre-code Workflow Map (ultracode — wf_3e402420-bf4, 5 agents, 99 tool calls)
4 parallel readers + adversarial verify. Verify verdict "CHƯA ĐỦ ĐỂ CODE" chặn 3 lỗ hổng:
1. **Cross-module miss:** `fee.service.ts` periodClause (~761) + `analytics.service.ts buildDateFilter` month branch có CÙNG bug — fix lệch pha → F-058 discrepancy check báo MAJOR_DRIFT giả
2. **SEAM 7h double-count:** T5 (UTC) end 31/5 23:59:59 UTC vs T6 (ICT) start 31/5 17:00 UTC → đơn cửa sổ 7h tính phí 2 lần
3. **Altitude:** shift CHỈ ở tầng date→SQL datetime param. parsePeriod/Mongo overlap/schema/admin helpers là calendar strings TZ-agnostic — KHÔNG đổi (validator `IsPeriodBoundaryDate` chặn nếu đổi)

Plus: cutover PHẢI period-keyed (KHÔNG createdAt-keyed như precedent F040_PRE_F016_CUTOFF) — preview/delete-recreate kỳ cũ sau deploy re-query MySQL phải ra số cũ.

## 🔬 Empirical TZ verify (PROD 2026-06-10)
- MySQL `@@time_zone = SYSTEM`, `NOW() == UTC_TIMESTAMP()` → **server UTC** → mọi NOW()-written cột (changed_at) UTC
- Order 200029493: `payment_on=2026-06-08 21:14:31`, `processed_on=2026-06-08 21:14:20` — cùng UTC (paid ICT 04:14 sáng 9/6)

## 🎯 Design — Seam Continuity Invariant
```
startOf(P) = endOf(prevPeriod(P)) + 1s   → zero gap, zero double-count by construction
endOf(P)   = P < '2026-06' ? 'P-last 23:59:59' UTC : 'P-last 16:59:59' UTC (= 23:59:59 ICT)
```
| Kỳ | from (UTC) | to (UTC) | Semantics |
|----|-----------|----------|-----------|
| ≤ T5/2026 | `01 00:00:00` | `last 23:59:59` | Legacy UTC — số đã ký bất biến |
| **T6/2026 (seam)** | `06-01 00:00:00` | `06-30 16:59:59` | from continuity UTC, to ICT — đơn 31/5 17:00-23:59 UTC CHỈ thuộc T5 |
| ≥ T7/2026 | `prev-last 17:00:00` | `last 16:59:59` | Full ICT |

Multi-month straddle (validator cho 12 tháng): from theo tháng start, to theo tháng end — continuity tự đúng.

## 💻 Sites fixed (6 + 1 helper)
1. `common/utils/ict-date.util.ts` — `ICT_PERIOD_CUTOVER` + `periodRangeUtc()` (+11 boundary test)
2. `reconciliation-query.service.ts queryOrders` — boundary qua helper (preflight SHARE method này → count nhất quán create())
3. `reconciliation-preflight.service.ts checkFeeChanged` — changed_at cùng rule
4. `fee.service.ts` periodClause — ĐỒNG BỘ recon (chống MAJOR_DRIFT giả F-058)
5. `analytics.service.ts buildDateFilter` month branch — ĐỒNG BỘ recon
6. `reconciliation.cron.ts` — `timeZone: 'Asia/Ho_Chi_Minh'` + prev-month derive theo ICT + label getUTC*
7. `pnl.service.ts resolveDateRange` presets — ICT trực tiếp KHÔNG cutover (rolling live analytics; `custom` branch đã ICT-aware sẵn)

## KHÔNG đổi (per altitude verdict)
parsePeriod ×2 (calendar strings) · Mongo overlap queries · schema period_start/end · admin period-helpers/MonthRangePicker (calendar math TZ-agnostic) · regenerate() (line_items persisted) · period.validator.ts

## TD mới
- TD-F082-XLSX-PROCESSED-ON-DISPLAY — xlsx line ~395 export processed_on raw UTC lên chứng từ (đơn ICT sáng in 23:5x hôm trước). Cosmetic trên chứng từ pháp lý + đụng kỳ cũ bất biến → cần Danny chốt riêng.
- TD-F082-PARSEPERIOD-DUPLICATE — parsePeriod identical ×2 (service + preflight) drift risk nếu sửa 1 bản. Defer unify.
- TD-F082-PNL-ISOMONTH-GROUPING — pnl isoMonth() group theo local-UTC month của signDate (display grouping nhẹ).
- TD-F082-EFFECTIVE-FROM-LEXICO — `effective_from <= period_start` lexicographic quirk pre-existing (ISO timestamp vs date string).
