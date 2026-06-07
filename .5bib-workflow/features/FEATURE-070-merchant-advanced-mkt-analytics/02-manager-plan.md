# FEATURE-070: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-06-07
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight
- [x] Đọc 00 + 01 đầy đủ
- [x] Đọc memory (merchant-portal F-069 codebase + known-issues vendor payment_on quirk)
- [x] **Spot-check code thật (mandate):**
  - `assertRaceForUser(userId, raceId)` tồn tại đúng signature (L420) ✓
  - Service inject `@InjectModel` + `@InjectDataSource('platform')` + `@InjectRedis` (L125-128) ✓ — đủ cho schema mới + SQL aggregate + cache
  - `MongooseModule.forFeature` đã có trong module (L37) ✓ — thêm `merchant_race_target` schema OK
  - Controller `@ApiResponse` 200/401/403/404 pattern (L66-85) ✓ — mirror cho route mới
  - `getTicketSalesTrend` bucket SQL pattern + `resolvePeriod` (L898) ✓ — reuse cho forecast

## ✓ PRD Validation Checklist
- [x] User Stories đầy đủ (US-1..4) + Persona chuẩn (Race Organizer)
- [x] Business Rules testable, đánh số BR-70-01..14
- [x] UI states đầy đủ (loading/empty/data/error/submitting/success/validation/race-ended)
- [x] Data source mỗi field rõ (MySQL order_metadata / Mongo merchant_race_target / derive summary)
- [x] DB change flagged (Mongo collection mới — PAUSE confirmed dưới)
- [x] API contract KHÔNG break SDK (chỉ THÊM 3 endpoint + DTO mới, không đổi DTO cũ)
- [x] Perf SLA cụ thể (p95 < 800ms cold / 50ms cache)
- [x] Security rõ (LogtoMerchantGuard + assertRaceForUser IDOR cả 3 endpoint, kể cả PUT)

## 🔬 Cross-check memory
- **Architecture:** 3 endpoint read-only + 1 write nhỏ, cùng pattern F-069 aggregate. Thêm collection `merchant_race_target` dưới merchant-portal domain. Không phá flow.
- **Convention:** SQL parameterized, named conn 'platform', cache key prefix `merchant-portal:*` khớp registry. Mongoose schema mới theo pattern `merchant_portal_access`.
- **Known-issues:** vendor `payment_on` NULL cho đơn chưa paid → đã defensive `financial_status='paid' AND payment_on IS NOT NULL`. Timezone UTC verified.

## 🟢 PAUSE resolutions (Manager chốt thay Danny — đã có context)
- ✅ **Mongo collection mới `merchant_race_target`**: APPROVED. Empty-start, upsert dần, KHÔNG migration data. Unique index `raceId`.
- ✅ **WRITE endpoint đầu tiên cho merchant user**: APPROVED với điều kiện BẮT BUỘC `assertRaceForUser` TRƯỚC upsert (BR-70-08). Vẫn ticket-scope (KHÔNG cần finance vì target là số vé, không phải tiền).

## 📋 Files được phép thay đổi (Scope Lock)

**Backend (`backend/src/modules/merchant-portal/`):**
- ➕ `schemas/merchant-race-target.schema.ts` — Mongoose schema mới
- ✏️ `dto/ticket-charts.dto.ts` — thêm TicketForecastDto/Point, TicketHeatmapDto, SetTicketTargetDto, TicketTargetDto
- ✏️ `services/merchant-portal.service.ts` — thêm `getTicketForecast()`, `getTicketHeatmap()`, `setTicketTarget()`, `getRaceMeta()` helper (event_start_date+status)
- ✏️ `merchant-portal.controller.ts` — thêm 3 route (GET forecast, GET heatmap, PUT target) + @ApiResponse đầy đủ
- ✏️ `merchant-portal.module.ts` — register MerchantRaceTarget schema vào MongooseModule.forFeature
- ➕/✏️ `services/merchant-portal.service.spec.ts` + `services/merchant-portal.adversarial.spec.ts` — unit + adversarial tests

**Frontend (`merchant/src/`):**
- ✏️ `components/mp/charts.tsx` — thêm PaceChart, Heatmap, Funnel (port mp-analytics.jsx)
- ✏️ `app/races/[raceId]/page.tsx` — wire 3 chart + ô target vào tab Vé
- ✏️ `lib/mp/i18n.ts` — label VI/EN
- 🔄 `lib/api-generated/*` — regenerate sau backend (KHÔNG sửa tay)

**Ngoài Scope Lock = scope creep → hỏi Manager.** KHÔNG đụng: revenue endpoints, fee logic, auth guards, 13 endpoint F-069 cũ, frontend dashboard/settings.

## 🔧 Tech approach (đề xuất)
- Forecast: 1 SQL daily-count + 1 SQL race-meta (event_start_date, status) → BE cumsum + projection (rate 7d × daysToRace). Target từ Mongo (findOne by raceId). Cache read-through.
- Heatmap: 1 SQL GROUP BY dow×hr (với +7h) → BE map sang grid 7×7. Cache.
- Target: assertRaceForUser → Mongo upsert {raceId} → DEL forecast cache.
- Funnel: KHÔNG backend — FE derive từ summary.
- FE charts: port SVG từ mockup, props từ SDK.

## 🛑 PAUSE points cho Coder
- 🛑 KHÔNG `pnpm install` dep mới (charts hand-rolled). Nếu nghĩ cần → dừng hỏi.
- 🛑 KHÔNG đụng file ngoài Scope Lock.
- 🟢 Mongo collection mới đã được Manager approve — KHÔNG cần dừng lại.

## 🧪 Unit test BẮT BUỘC (QC sẽ verify)
- [ ] `getTicketForecast()` — happy (cumsum đúng) + race ended (projectedValue null) + <8 điểm (projectedValue null) + empty (cumulative [])
- [ ] `getTicketHeatmap()` — happy grid 7×7 + **timezone +7h correctness** (payment_on 16:30 UTC → grid Thu 21-24) + empty (toàn 0)
- [ ] `setTicketTarget()` — upsert + IDOR (assertRaceForUser throw 403) + target=0→null + validation (âm/quá lớn) + concurrent idempotent
- [ ] DTO validation SetTicketTargetDto (Min 0, Max 10M)
- [ ] IDOR cả 3 endpoint
- [ ] Security: response KHÔNG leak tiền (grep gmv/fee/price trong test assert)

## ✅ Sẵn sàng cho `/5bib-code`: YES
## 🔗 Next: `/5bib-code FEATURE-070-merchant-advanced-mkt-analytics`
