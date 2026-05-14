# FEATURE-035 + F-036: Edit Dialog Width + Cost Persist + P&L Additive

**Status:** 🟢 SHIPPED (HEAD a8ad737)
**Created:** 2026-05-14
**Owner:** Danny (multi-screenshot UAT iteration)
**Type:** BUGFIX (F-033 follow-up — 3 nested bugs caught during local UAT)

## 🎯 Triple bug chain

1. **F-035a Dialog narrow** — F-033 thêm cột "Giá vốn" → 9-col table → dialog `max-w-3xl` (768px) chật → inputs nén ("Th"/"67:"/"Nhập số (v...")
2. **F-035b Cost field drop** — buildInitialState + service.create/update hand-pick mapping → quên cost field → save xong reload thấy rỗng (illusion "k lưu được")
3. **F-036 P&L semantic** — F-033 priority chain (actual REPLACE estimated) sai semantic → cost_items 1M phát sinh = total cost 1M thay vì 186M

## 📂 Files (10 file = 6 BE + 4 admin)

**Backend:**
- ✏️ `contracts/services/contracts.service.ts` — add `cost` vào create + update lineItems.map
- ✏️ `finance/services/pnl.service.ts` — additive totalCost (getSummary + getDashboardData)
- ✏️ `finance/services/pnl.service.spec.ts` — TC-LIC-01..06 updated + NEW Danny scenario reproduction (32/32 PASS)
- ✏️ `finance/dto/pnl-response.dto.ts` — add estimatedCost + actualCost + mixed source enum

**Admin:**
- ✏️ `contracts/_components/contract-edit-dialog.tsx` — dialog width override + preserve cost+catalogItemId in buildInitialState
- ✏️ `contracts/_components/line-items-editor.tsx` — column widths tăng + MoneyInput placeholder "0"
- ✏️ `lib/finance-api.ts` — PnLSummary type add 2 new fields
- ✏️ `finance/_components/pnl-summary-card.tsx` — breakdown UI "Ước tính" + "Phát sinh" + 3 badges

## 🚦 Workflow (FIRST CORRECT IN SESSION)

Branch `fix/F-035-edit-dialog-line-items-width` off main:
- `9f4cb64` Dialog width + table column widths
- `797fa85` Backend cost field mapping
- `7bc1050` Admin buildInitialState preserve cost
- `a8ad737` F-036 P&L additive semantic

Push branch only → Danny localhost UAT pass → merge main + release/v1.8.1 = HEAD a8ad737.

## 📊 Test reproduction (TC-LIC-06)

HĐ Danny screenshot `11.05/2026/HDDV/CTTXT5-5BIB-20`:
- 3 line items với cost ước tính = 185M
- 1 cost_item "Đút lót chính quyền" = 1M phát sinh
- Expected (F-036): totalCost 186M, lãi 23M, margin 11.1%, badge KẾT HỢP
- Bug F-033 (before F-036): totalCost 1M, lãi 208M, margin 99.5%, badge THỰC TẾ (sai)

## ✅ Memory hardened (conventions.md + known-issues.md)

4 anti-patterns + 4 lessons documented. Workflow rule: push thẳng release/v* CHỈ cho critical incident.
