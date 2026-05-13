# FEATURE-032: Manager Plan — Partner Import Excel

**Status:** ✅ APPROVED
**Reviewed:** 2026-05-13
**Linked:** `00-manager-init.md` (BA gate SKIPPED — mirror F-031 pattern)

---

## ✓ PAUSE-32-* ALL RESOLVED (auto chốt defaults F-031)

- **PAUSE-32-01** Excel 11 cols VN headers ⭐
- **PAUSE-32-02** Dedup: taxId primary + entityName fallback, Skip+report ⭐
- **PAUSE-32-03** 2-step Preview→Confirm ⭐
- **PAUSE-32-04** Max 200 rows ⭐
- **PAUSE-32-05** createdBy = userId admin ⭐
- **PAUSE-32-06** Empty per-row skip + collect errors ⭐
- **PAUSE-32-07** CÓ template download ⭐

---

## 📋 Scope Lock — Mirror F-031 cho Partners domain

### Backend (6 file = 3 NEW + 3 modify)

- ➕ `backend/src/modules/contracts/dto/import-partner.dto.ts` — 4 DTOs (ParsedRow + InvalidRow + Preview + ConfirmRequest + Result)
- ➕ `backend/src/modules/contracts/services/partners-import.service.ts` — parseExcel + validateRow + bulkInsert + generateTemplate
- ➕ `backend/src/modules/contracts/services/partners-import.service.spec.ts` — 7-9 TC-IM-* mandatory
- ✏️ `backend/src/modules/contracts/partners.controller.ts` — 3 routes literal BEFORE `:id` (preview/confirm/template)
- ✏️ `backend/src/modules/contracts/contracts.module.ts` — register PartnersImportService
- ✏️ `backend/src/modules/contracts/services/partners.service.ts` — `findByTaxIdsOrNames` batch query (dual-key dedup)

### Admin (3 file)

- ➕ `admin/src/app/(dashboard)/contracts/_components/partner-import-dialog.tsx` — mirror F-031 Dialog
- ✏️ `admin/src/app/(dashboard)/contracts/partners/page.tsx` — button "Import Excel" header
- ✏️ `admin/src/lib/contracts-api.ts` — 3 helpers + 4 interface

### Excel template format (11 cols VN headers)

| Col | Header | Required? | Maps to |
|-----|--------|-----------|---------|
| A | **Tên đối tác** | ✅ | `entityName` |
| B | Tên viết tắt | ⚪ | `shortName` |
| C | Mã số thuế | ⚪ | `taxId` |
| D | Địa chỉ | ⚪ | `address` |
| E | Người đại diện | ⚪ | `representative` |
| F | Chức vụ | ⚪ | `position` |
| G | Số tài khoản | ⚪ | `bankAccount` |
| H | Ngân hàng | ⚪ | `bankName` |
| I | Điện thoại | ⚪ | `phone` |
| J | Email | ⚪ | `email` (IsEmail strict, sai → per-row error) |
| K | Ghi chú | ⚪ | `notes` |

### Duplicate detection logic

```typescript
// Dual-key dedup per PAUSE-32-02
// 1. Rows có taxId → check by taxId (MST stable, sparse unique candidate)
// 2. Rows không taxId → check by entityName exact match
// 3. Cả 2 → Skip + report (NOT update, NOT fail batch)

async findByTaxIdsOrNames(
  pairs: Array<{ taxId?: string; entityName: string }>,
): Promise<Array<{ taxId?: string; entityName: string }>> {
  // Split: rows có taxId vs không
  const taxIds = pairs.filter(p => p.taxId).map(p => p.taxId!);
  const namesNoTax = pairs.filter(p => !p.taxId).map(p => p.entityName);

  const orConditions = [];
  if (taxIds.length > 0) orConditions.push({ taxId: { $in: taxIds } });
  if (namesNoTax.length > 0) orConditions.push({ entityName: { $in: namesNoTax } });
  if (orConditions.length === 0) return [];

  const items = await this.model
    .find({ deletedAt: null, $or: orConditions }, { entityName: 1, taxId: 1, _id: 0 })
    .lean();
  return items.map(i => ({ entityName: i.entityName, taxId: i.taxId }));
}
```

---

## 🛑 PAUSE-CODER (mirror F-031)

- PAUSE-32-CODER-01: Verify `findByTaxIdsOrNames` method existed (KHÔNG → add new per Scope Lock)
- PAUSE-32-CODER-02: Server RE-VALIDATES dedup tại confirm step (don't trust FE)
- PAUSE-32-CODER-03: SDK regen defer (backend dev còn code cũ — same F-031 pattern)
- PAUSE-32-CODER-04: KHÔNG `pnpm install` / KHÔNG file ngoài Scope Lock
- PAUSE-32-CODER-05: Route ordering literal BEFORE `:id` (F-021 convention)

---

## 🧪 Unit test BẮT BUỘC

7 mandatory TC-IM-* trong `partners-import.service.spec.ts`:

| ID | Scenario |
|----|----------|
| TC-IM-01 | Happy 5 valid rows → all valid |
| TC-IM-02 | Email IsEmail strict — accept `a@b.com`, reject `not-email` |
| TC-IM-03 | Empty entityName → invalid row report |
| TC-IM-04 | Duplicate by taxId → Skip+report |
| TC-IM-05 | Duplicate by entityName (no taxId) → Skip+report |
| TC-IM-06 | Mixed valid + duplicate (by taxId) + duplicate (by name) + invalid → preview shape |
| TC-IM-07 | bulkInsert createdBy assertion + re-validate dedup (race condition) |
| TC-IM-08 (defensive) | generateTemplate buffer parse-able |
| TC-IM-09 (defensive) | Max 200 rows enforcement |

---

## ✅ Verdict APPROVED — Ready cho `/5bib-code`

**ETA:** ~1.5-2h (pattern reuse F-031 — proven hôm nay).

**Pattern reuse:**
- ExcelJS, FileInterceptor, jsonFetch, LogtoStaffGuard, 2-step Preview→Confirm UX
- F-031 spec structure (clone + adapt 11 Partner fields)
- F-031 dialog component (clone + adapt 11 cols preview table)
