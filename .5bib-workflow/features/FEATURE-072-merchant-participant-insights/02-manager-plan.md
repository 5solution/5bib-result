# FEATURE-072: Plan Review — ✅ APPROVED

**Reviewer:** 5bib-manager · 2026-06-08

## Spot-check (verified)
- `athlete_subinfo.order_line_item_id` + tshirt_size/gender/dob/nationality/city_province — DESCRIBE confirmed.
- `om.race_id` tồn tại (getTicketSalesByCourse line 647 dùng `WHERE om.race_id=?`) → scope đơn giản.
- ExcelJS import sẵn (service line 10) + getRevenueExport pattern (Res buffer).
- `cachedTicketRead` + `assertRaceForUser` + `@CurrentUser user.userId` + `LogtoMerchantGuard` — patterns sẵn.

## Validation: ✅ đủ — BR testable, AG/dob/nationality data-quality có rule rõ, no-PII aggregate, IDOR guard, cache TTL, endpoints + DTO cụ thể. KHÔNG đụng OrderService/fee/auth/schema-write.

## Scope Lock (CHỈ các file này)
**Backend:**
- ➕ `backend/src/modules/merchant-portal/utils/participant-insights.util.ts` — pure: parseAge/ageGroupWA/normalizeNationality/normalizeGender/orderSizes/aggregateParticipants
- ➕ `backend/src/modules/merchant-portal/utils/participant-insights.util.spec.ts` — TC-01..08
- ➕ `backend/src/modules/merchant-portal/dto/participant-insights.dto.ts`
- ✏️ `backend/src/modules/merchant-portal/services/merchant-portal.service.ts` — `getParticipantInsights()` + `getParticipantInsightsExport()`
- ✏️ `backend/src/modules/merchant-portal/merchant-portal.controller.ts` — 2 endpoint GET insights + export
**Frontend (merchant):**
- ✏️ `merchant/src/app/races/[raceId]/page.tsx` — tab "Cơ cấu VĐV" + section
- ✏️ `merchant/src/components/mp/charts.tsx` — reuse Donut/Bar (thêm nếu cần component nhỏ)
- ✏️ `merchant/src/lib/mp/i18n.ts` — labels 5 ngôn ngữ
- 🔄 `merchant/src/lib/api-generated/*` — `pnpm generate:api` sau backend
- ➕ (nếu cần) `merchant/src/lib/mp/participants-api.ts` fetch wrappers

## Tech approach
- **Pull-then-aggregate-in-Node** (BR-72-10): SQL chỉ pull raw rows (size/gender/dob/nationality/province) cho paid participants → `aggregateParticipants()` parse/normalize/bucket. Robust với data bẩn + unit-testable không cần DB.
- Export: reuse ExcelJS, sheet Size×cự ly cần thêm course → query có thêm `rc.name` (join tt→rc). Sheet2 demographics từ aggregate.
- Cache TTL 300s key `merchant-portal:participants:<userId>:<raceId>`.

## PAUSE cho Coder
- 🛑 KHÔNG `pnpm install` (ExcelJS/exceljs đã có). Vitest merchant đã có (F-071).
- 🛑 Guard ticket-scope (KHÔNG finance) — insights không phải data tiền.
- ⚠️ is_represent: ĐẾM tất cả row join paid oli (mỗi participant 1 row); KHÔNG lọc is_represent (demographic là của athlete). Verify trên DEV data ở QC.

## Unit test bắt buộc: TC-01..08 (util) PASS.
## ✅ Sẵn sàng /5bib-code
