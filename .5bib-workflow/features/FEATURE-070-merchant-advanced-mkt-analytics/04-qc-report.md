# FEATURE-070: QC Report

**Status:** ✅ APPROVED
**Tested:** 2026-06-07
**Author:** 5bib-qc-gatekeeper
**Linked:** 01-ba-prd.md, 03-coder-implementation.md, IMPLEMENTATION_NOTES.md

## 📌 Pre-flight
- [x] Đọc 01 PRD (BR-70-01..14, TC-01..10), 03, IMPLEMENTATION_NOTES (Section 4 focus list)
- [x] Chạy lại test suite local → confirm pass

## 🔍 Phase 1 — Impact & Regression Audit
- Coder got right: chỉ THÊM 3 endpoint + 1 collection, KHÔNG đổi 13 endpoint/DTO F-069 → 0 regression (104 test baseline vẫn pass trong tổng 124). SDK regen backward-compat.
- IMPLEMENTATION_NOTES Forced #1 (races PK race_id) là catch tốt — tránh silent-break forecast. Verify: service dùng `WHERE race_id = ?` ✓.

## 🛡️ Phase 2 — Security Threat Model (independent grep verify)
| Threat | Risk | Status |
|--------|------|--------|
| IDOR 3 endpoint (cross-race) | CRITICAL | ✅ `assertRaceForUser` xuất hiện trong CẢ getTicketForecast/getTicketHeatmap/setTicketTarget (grep 1/1/1), PUT trước upsert |
| SQL injection | CRITICAL | ✅ 0 `${}` interpolation nguy hiểm (chỉ cache-key string); raceId qua `?` param |
| Money leak (ticket report BR-MP-09/BR-70-02) | HIGH | ✅ DTO + 3 method KHÔNG có gmv/fee/price (grep clean, chỉ comment "NO financial") |
| Auth bypass | HIGH | ✅ class `@UseGuards(LogtoMerchantGuard)` áp dụng 3 route mới (ticket-scope, KHÔNG finance — đúng BR-70-01) |
| Concurrent target write | MED | ✅ unique index raceId + findOneAndUpdate atomic (TC-10 10x stable) |
| Cache poisoning | LOW | ✅ readJsonCache try/catch fallback recompute |

## 🧪 Phase 3-4 — Test execution
```
Test Suites: 4 passed, 4 total
Tests:       124 passed, 124 total   (104 F-069 + 20 NEW F-070)
10x flaky (timezone +7h + concurrent target): 10/10 stable
```
Backend tsc 0 lỗi merchant-portal · nest build clean · merchant tsc 0 · merchant next build PASS 15 routes.

## 🔁 BR coverage
- [x] BR-70-01 guard ticket-scope · BR-70-02 no money · BR-70-03 IDOR · BR-70-04/05 forecast cumsum+projection · BR-70-06 race-ended null · BR-70-07/08/09 target editable+IDOR+0→null · BR-70-10 timezone +7h (TC-03 correctness) · BR-70-11 grid 7×7 · BR-70-12 funnel derive · BR-70-13 empty states · BR-70-14 cache+invalidate.
- TC-01..10 đều có `it()` block tương ứng (forecast happy/ended/empty/<8pts, heatmap happy/tz/empty, target upsert/IDOR/0/validation/concurrent).

## 🚧 Tech debt (Manager → known-issues)
- Forecast linear projection (no seasonal), heatmap GMT+7 hardcoded, target no audit log — đều non-blocking, đã ghi 03.

## 📊 Final Verdict: ✅ APPROVED — sẵn sàng deploy
## 🔗 Next: `/5bib-deploy FEATURE-070-merchant-advanced-mkt-analytics`
