# FEATURE-033: Line-Item Cost-at-Quote-Time

**Status:** 🟡 INITIATED
**Created:** 2026-05-14
**Owner:** Danny (request "tao muốn nhìn thấy P&L ở đầu mục luôn, việc phát sinh thêm gì thì ghi sau")
**Type:** EXTEND_EXISTING (F-024 Contract Management + F-028 Deal P&L)

## 🎯 Why this feature

Khi tạo HĐ trong wizard, admin muốn nhìn thấy P&L Deal preview NGAY — không phải đợi sau khi ship rồi mới nhập Cost Items (F-028 Phase 3 dialog). Cost ước tính ở quote time = single source of truth ban đầu, cost_items thực tế phát sinh sau sẽ override.

## 📂 Impact Map

### Module sẽ chạm
- `backend/src/modules/contracts/schemas/contract.schema.ts` — LineItem subschema add field `cost`
- `backend/src/modules/contracts/dto/create-contract.dto.ts` — LineItemInputDto add `cost?`
- `backend/src/modules/finance/dto/pnl-response.dto.ts` — PnLSummaryDto add `totalCostSource`
- `backend/src/modules/finance/services/pnl.service.ts` — priority chain (actual > estimated > none) cho cả detail + dashboard
- `backend/src/modules/finance/services/pnl.service.spec.ts` — 5 NEW TC-LIC-* tests
- `admin/src/lib/contracts-api.ts` — LineItemInput.cost type
- `admin/src/lib/finance-api.ts` — PnLSummary.totalCostSource type
- `admin/src/app/(dashboard)/contracts/_components/line-items-editor.tsx` — column "Giá vốn" + P&L preview strip real-time
- `admin/src/app/(dashboard)/contracts/_components/service-catalog-picker.tsx` — onPick auto-copy referenceCost → line.cost
- `admin/src/app/(dashboard)/finance/_components/pnl-summary-card.tsx` — badge "ƯỚC TÍNH" / "THỰC TẾ"

### Endpoint liên quan
- `POST /api/contracts` — create with line items (cost field optional)
- `PATCH /api/contracts/:id` — update line items
- `GET /api/finance/pnl/:contractId` — return totalCostSource

### Schema/DB
- MongoDB `contracts.lineItems[].cost: Number, default: 0, min: 0` — optional new field. Backward compat: HĐ cũ default 0 → estimated=0 → totalCostSource='none' → behavior như cũ.

## ⚠️ Risk Flags
- 🟢 LOW backward compat: existing contracts không có cost → P&L = revenue - 0 (như trước F-033)
- 🟢 LOW logic: P&L priority chain straightforward — actual > estimated > none
- 🟡 MED admin display: line-items table thêm cột → check width responsive (table-fixed + min-w handle)
- 🟢 LOW cache impact: Redis cache key không đổi, TTL 60s tự invalidate

## 🚧 PAUSE Conditions
- KHÔNG cần PRD (BA gate SKIP — Manager Plan đủ, scope hẹp + Danny chốt rõ intent)
- KHÔNG migration (cost optional, default 0)

## ✅ Sẵn sàng cho /5bib-code
Có — Manager Plan + code đã ship combined (Coder mode Manager same agent).
