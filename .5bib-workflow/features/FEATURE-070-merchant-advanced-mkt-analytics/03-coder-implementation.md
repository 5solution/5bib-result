# FEATURE-070: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC
**Started/Done:** 2026-06-07
**Author:** 5bib-fullstack-engineer
**Linked:** 00, 01, 02 (APPROVED)

## 📌 Pre-flight
- [x] Đọc 00 + 01 + 02 (APPROVED) + memory conventions/codebase-map
- [x] Đọc code thật Scope Lock (merchant-portal.service/controller/module, ticket-charts.dto, charts.tsx, races page)

## 🔍 Phase 1 — Impact Assessment
- **Backend:** +3 endpoint read/write trên merchant-portal module. MySQL READ-ONLY aggregate `order_metadata` (index `(race_id, payment_on)` reuse). Mongo collection MỚI `merchant_race_target` (unique raceId). Redis cache `merchant-portal:forecast|heatmap:<raceId>` TTL 300s; PUT target DEL forecast key. KHÔNG đụng fee/revenue/auth.
- **Frontend:** Client components, hand-rolled SVG charts (0 dep mới). SDK regen (+3 fn). Funnel derive từ summary đã fetch (0 call thêm). Target PUT → refetch forecast.
- **API contract:** chỉ THÊM (3 endpoint + DTO), KHÔNG đổi DTO cũ → backward-compat, không break 13 endpoint F-069.

## ⚠️ Phase 2 — Edge Cases Covered
- [x] Race chưa có đơn paid → cumulative [], grid toàn 0, funnel 0 → EmptyState (BR-70-13)
- [x] Race ENDED (COMPLETE/CANCEL/qua ngày) → projectedValue null, FE ẩn projection/target (BR-70-06)
- [x] <8 điểm dữ liệu → projectedValue null (không đủ tính rate)
- [x] Timezone: payment_on UTC → +7h trước DAYOFWEEK/HOUR (BR-70-10), test correctness 16:30 UTC→Thu 21-24
- [x] IDOR: assertRaceForUser TRƯỚC mọi xử lý (3 endpoint, kể cả PUT trước upsert) → 403
- [x] target=0 → lưu 0 nhưng output null (BR-70-09); concurrent PUT idempotent (unique raceId)
- [x] Redis cache poisoned → readJsonCache try/catch fallback recompute

## 🧠 Phase 3 — Logic & Architecture
- Forecast cumulative: 1 SQL daily-count → running-sum in-process (nhẹ, <120 điểm). Projection = rate 7 ngày × daysToRace (BR-70-05) — disclaimer FE "ước tính theo tốc độ 7 ngày".
- Heatmap: 1 SQL GROUP BY dow×hr (+7h) → map MySQL DOW(1=Sun) sang grid Mon-first. Server trả luôn dayLabels/bucketLabels.
- Target: Mongo upsert findOneAndUpdate (atomic, unique raceId chống dup). Cache invalidation đúng site.
- Trade-off chi tiết: xem IMPLEMENTATION_NOTES.md Section 3.

## 💻 Files Changed (khớp Scope Lock 02)
Backend: ➕ schemas/merchant-race-target.schema.ts · ✏️ dto/ticket-charts.dto.ts · ✏️ services/merchant-portal.service.ts · ✏️ merchant-portal.controller.ts · ✏️ merchant-portal.module.ts · ✏️ services/merchant-portal.service.spec.ts + .adversarial.spec.ts
Frontend: ✏️ components/mp/charts.tsx · ✏️ app/races/[raceId]/page.tsx · ✏️ lib/mp/i18n.ts · 🔄 lib/api-generated/* (regen)
→ 0 scope creep.

## 🧪 Tests Written
```
Test Suites: 4 passed, 4 total
Tests:       124 passed, 124 total   (104 F-069 baseline + 20 NEW F-070)
```
New TC-01..10 covered: forecast happy/race-ended-null/empty/<8pts, heatmap happy/timezone+7h/empty, setTarget upsert/IDOR-403/0→null/validation/concurrent. 10x flaky timezone+concurrent = 10/10 stable. tsc 0, nest build clean, merchant tsc 0 + next build PASS 15 routes.

## 🛑 PAUSE/Confirmation log
- Mongo collection mới `merchant_race_target` — Manager đã APPROVE trong 02 (empty-start upsert, không migration). KHÔNG cần dừng.
- WRITE endpoint đầu cho merchant user — Manager APPROVE với điều kiện assertRaceForUser trước upsert → đã implement.

## 🚧 Scope creep: KHÔNG.

## 🐛 Known limitations / Tech debt
- Forecast projection là linear (rate 7 ngày) — không seasonal/curve-fit. Acceptable MVP (disclaimer hiển thị).
- Heatmap +7h hardcoded GMT+7 (không config TZ per tenant) — toàn bộ giải VN nên OK.
- Target chưa có audit log (chỉ updatedBy/updatedAt). Non-blocking.

## ✅ Self-Review Pipeline (Manager 2026-05-14 mandatory)
- [x] Bước 1: tsc + lint exit 0 (backend merchant-portal + merchant)
- [x] Bước 2: PRD strict adherence (DTO verbatim 3.3, endpoint table 3.2, SQL 3.4, TC-XX)
- [x] Bước 3: anti-pattern scan clean (no any/console.log/as-unknown ngoài narrowed row cast)
- [x] Bước 4: hand-pick audit — schema field mới chỉ ở 3 method mới, no drop
- [x] Bước 5: PROD smoke — backend restart swagger 20 endpoints (3 mới), build OK
- [x] Bước 6: UI/UX — chart states (loading/empty/error/data/race-ended/target-submit) implement
- [x] Bước 7: real-world data — test fixture dùng count thật, timezone real case
- [x] Bước 8: files vs Scope Lock — 0 creep
- [x] Bước 9: SDK regen (3 fn GetTicketForecast/GetTicketHeatmap/SetTicketTarget)
- [x] Bước 10: unit tests 124 PASS paste ở trên
- [x] Bước 11: IMPLEMENTATION_NOTES.md written (4 sections đầy đủ)

→ Status: 🟠 READY_FOR_QC
## 🔗 Next: `/5bib-qc FEATURE-070-merchant-advanced-mkt-analytics`
