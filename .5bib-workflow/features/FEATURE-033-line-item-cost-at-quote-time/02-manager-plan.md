# FEATURE-033: Manager Plan — Line-Item Cost-at-Quote-Time

**Status:** ✅ APPROVED
**Reviewed:** 2026-05-14

---

## 📋 Files được phép thay đổi (Scope Lock)

### Backend (5 file)
- ✏️ `backend/src/modules/contracts/schemas/contract.schema.ts` — LineItem subschema add `@Prop({ default: 0, min: 0 }) cost?: number`
- ✏️ `backend/src/modules/contracts/dto/create-contract.dto.ts` — LineItemInputDto add `@IsOptional() @IsNumber() @Min(0) cost?`
- ✏️ `backend/src/modules/finance/dto/pnl-response.dto.ts` — PnLSummaryDto add `totalCostSource: 'actual' | 'estimated' | 'none'`
- ✏️ `backend/src/modules/finance/services/pnl.service.ts` — priority chain logic trong `getSummary` + `getDashboardData`
- ✏️ `backend/src/modules/finance/services/pnl.service.spec.ts` — 5 NEW TC-LIC-* tests

### Admin (4 file)
- ✏️ `admin/src/lib/contracts-api.ts` — LineItemInput.cost
- ✏️ `admin/src/lib/finance-api.ts` — PnLSummary.totalCostSource
- ✏️ `admin/src/app/(dashboard)/contracts/_components/line-items-editor.tsx` — col "Giá vốn" + P&L preview strip
- ✏️ `admin/src/app/(dashboard)/contracts/_components/service-catalog-picker.tsx` — onPick auto-copy referenceCost
- ✏️ `admin/src/app/(dashboard)/finance/_components/pnl-summary-card.tsx` — source attribution badge

## 🔧 Tech approach

**Priority chain (Danny intent):**
```
1. cost_items collection có data (admin nhập actual)
   → totalCost = sum(cost_items.amount)
   → totalCostSource = 'actual'
2. cost_items rỗng + line_items có cost > 0
   → totalCost = sum(line_items[i].cost × quantity) where selected !== false
   → totalCostSource = 'estimated'
3. Cả 2 = 0 (HĐ cũ pre-F-033)
   → totalCost = 0, source = 'none'
```

**Auto-fill on catalog pick:** `line.cost = ServiceCatalog.referenceCost ?? 0` — admin có thể override sau pick.

**Wizard real-time preview:** P&L Deal preview strip dưới line items table, tính TRỰC TIẾP client-side (không gọi backend) — admin nhìn lãi/lỗ ngay khi thay đổi cost/price.

**Display Convention:** badge "ƯỚC TÍNH" (amber) vs "THỰC TẾ" (emerald) trên pnl-summary-card để admin hiểu nguồn data.

## 🧪 Unit test BẮT BUỘC

5 TC-LIC-* trong `pnl.service.spec.ts`:
| ID | Scenario |
|----|----------|
| TC-LIC-01 | cost_items rỗng + line_items có cost → estimated |
| TC-LIC-02 | cost_items có data → actual ưu tiên (line.cost IGNORE) |
| TC-LIC-03 | line_items selected=false → skip khỏi estimated |
| TC-LIC-04 | Cả 2 = 0 → none, totalCost=0 |
| TC-LIC-05 | HĐ cũ không có field cost → backward compat estimated=0 |

## ✅ Verdict APPROVED — Ready cho code (combined agent mode)
