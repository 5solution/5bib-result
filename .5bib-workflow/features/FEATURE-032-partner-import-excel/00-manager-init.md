# FEATURE-032: Partner Import Excel

**Status:** 🟡 INITIATED
**Created:** 2026-05-13
**Owner:** Danny
**Type:** EXTEND_EXISTING (extend F-024 Contract Management — Partners domain, mirror F-031)
**Created by:** 5bib-manager

---

## 🎯 Why this feature

Danny: "thêm cả tính năng import đối tác nữa, tao quên mất". Tiếp nối F-031 vừa ship — admin trang "Hợp đồng → Đối tác" (`/contracts/partners`) cũng cần bulk import Excel để setup ban đầu các merchants/sponsors/clients làm reference khi tạo hợp đồng.

Pattern reuse 100% F-031 (Service Catalog Import) — chỉ swap schema fields + duplicate key + admin route.

---

## 📂 Impact Map

### Module sẽ chạm
- `backend/src/modules/contracts/` — extend Partners domain (mirror F-031 ServiceCatalog work)
- `admin/src/app/(dashboard)/contracts/partners/` + `_components/`

### File then chốt cần Coder đọc

- `backend/src/modules/contracts/schemas/partner.schema.ts` — Partner: `entityName` (required, indexed) + `shortName` + `taxId` (sparse indexed) + `address` + `representative` + `position` + `bankAccount` + `bankName` + `phone` + `email` + `notes` (11 fields)
- `backend/src/modules/contracts/dto/partner.dto.ts` — `CreatePartnerDto` pattern: 1 required + 10 optional (email IsEmail strict)
- `backend/src/modules/contracts/partners.controller.ts` — class-level `LogtoStaffGuard`, routes Post/Get(/Get:id)/Patch:id/Delete:id
- `backend/src/modules/contracts/services/partners.service.ts` — existing CRUD methods, KHÔNG có batch query — sẽ thêm `findByTaxIdsOrNames`
- **F-031 reference (just shipped):** `services/service-catalog-import.service.ts` — parseExcel + validateRow + bulkInsert + generateTemplate pattern + `_components/service-catalog-import-dialog.tsx` 2-step UX

### Endpoint

- NEW `POST /api/partners/import-excel/preview` (multipart, FileInterceptor 5MB)
- NEW `POST /api/partners/import-excel/confirm` (JSON body rows[])
- NEW `GET /api/partners/import-template` (binary XLSX)

### Schema/DB

- MongoDB collection `partners` — KHÔNG schema migration (đã có sẵn từ F-024)
- KHÔNG đụng MySQL / Redis / S3

### Library / dependency
- ExcelJS đã có sẵn (reuse F-031 + F-030 + reconciliation)
- FileInterceptor pattern reuse F-024 + F-031
- KHÔNG `pnpm install`

---

## ⚠️ Risk Flags

- 🟢 **LOW** — Pattern reuse 100% F-031 (just shipped today + verified). Different schema fields nhưng cùng UX flow + cùng tech approach.
- 🟡 **MED** — Email validation strict: F-024 `CreatePartnerDto` dùng `@IsEmail()`. Excel cell có thể có email lỗi format (vd: trailing space, missing @). Per-row validate + report error.
- 🟡 **MED** — Duplicate key: PARTNER có 2 candidate keys — `entityName` (required) vs `taxId` (sparse unique candidate). Cần Danny chốt key dedup (PAUSE-32-02).
- 🟢 **LOW** — `notes` field free-form long text có thể chứa newline trong Excel cell — ExcelJS handle OK.

---

## 🚧 PAUSE Conditions — cần Danny chốt

### PAUSE-32-01: Excel format columns

Đề xuất 11 cột VN headers (match admin form):

| Col | Header | Required? | Format | Notes |
|-----|--------|-----------|--------|-------|
| A | **Tên đối tác** | ✅ | Text | entityName |
| B | Tên viết tắt | ⚪ | Text | shortName |
| C | Mã số thuế | ⚪ | Text | taxId (sparse unique candidate) |
| D | Địa chỉ | ⚪ | Text | address |
| E | Người đại diện | ⚪ | Text | representative |
| F | Chức vụ | ⚪ | Text | position |
| G | Số tài khoản | ⚪ | Text | bankAccount |
| H | Ngân hàng | ⚪ | Text | bankName |
| I | Điện thoại | ⚪ | Text | phone |
| J | Email | ⚪ | Email format | email — IsEmail strict, sai format → per-row error |
| K | Ghi chú | ⚪ | Text | notes |

11 cols OK không? Có drop cột nào hay thêm cột không?

### PAUSE-32-02: Duplicate detection key

Khi import row có `entityName + taxId` đã tồn tại trong DB:

**Recommend: dedup theo MST (taxId) trước, fallback entityName.** Vì:
- 1 doanh nghiệp có thể đổi tên nhưng MST stable
- 2 partners cùng tên nhưng MST khác = 2 entities hợp pháp khác nhau
- MST có index sparse trong schema → fast lookup

Logic:
- Row có `taxId` → check duplicate by `taxId` (skip nếu trùng)
- Row KHÔNG có `taxId` (optional field) → fallback check duplicate by `entityName` exact match

**(a) Skip + report** ⭐ recommend (cùng F-031 pattern)
**(b)** chỉ check entityName
**(c)** chỉ check taxId (rows không có taxId → luôn insert dù trùng tên)

### PAUSE-32-03..05: Reuse F-031 defaults

Recommend giữ nguyên F-031 defaults:
- **PAUSE-32-03 2-step Preview→Confirm UX** ⭐ recommend (proven F-031)
- **PAUSE-32-04 Max 200 rows/lần** ⭐ recommend
- **PAUSE-32-05 Empty per-row skip + collect ALL errors** ⭐ recommend
- **PAUSE-32-06 createdBy = userId admin** ⭐ recommend
- **PAUSE-32-07 CÓ template download button** ⭐ recommend

---

## 🎯 Đề xuất Scope Lock (cho Manager Plan sau khi Danny chốt)

**Backend (5 modify + 3 NEW):**
- ➕ NEW `backend/src/modules/contracts/dto/import-partner.dto.ts` — 4 DTOs (ParsedRow + InvalidRow + Preview + ConfirmRequest + Result) — mirror F-031
- ➕ NEW `backend/src/modules/contracts/services/partners-import.service.ts` — parseExcel + validateRow + bulkInsert + generateTemplate — mirror F-031
- ➕ NEW `backend/src/modules/contracts/services/partners-import.service.spec.ts` — 7-9 TC-IM-* mandatory
- ✏️ MODIFY `backend/src/modules/contracts/partners.controller.ts` — thêm 3 routes literal BEFORE `:id`
- ✏️ MODIFY `backend/src/modules/contracts/contracts.module.ts` — register PartnersImportService provider
- ✏️ MODIFY `backend/src/modules/contracts/services/partners.service.ts` — thêm `findByTaxIdsOrNames` batch query method

**Admin (2 modify + 1 NEW):**
- ➕ NEW `admin/src/app/(dashboard)/contracts/_components/partner-import-dialog.tsx` — mirror F-031 Dialog
- ✏️ MODIFY `admin/src/app/(dashboard)/contracts/partners/page.tsx` — thêm button "Import Excel" header
- ✏️ MODIFY `admin/src/lib/contracts-api.ts` — thêm 3 helpers + 4 interface (mirror F-031)

**KHÔNG đụng:**
- ❌ Partner schema migration
- ❌ Existing CRUD endpoints (POST/GET/PATCH/DELETE)
- ❌ Contracts module other domain
- ❌ tạo helper file mới ngoài Scope Lock — reuse F-031 pattern in-place

---

## ✅ Sẵn sàng cho `/5bib-plan`?

7 PAUSE-32-* — nếu mày chốt "OK theo F-031 defaults" thì tao auto chốt:
- PAUSE-32-01: 11 cols VN headers ⭐
- PAUSE-32-02: Dedup taxId primary + entityName fallback, Skip+report ⭐
- PAUSE-32-03..07: y hệt F-031

ETA: **~2h** (pattern reuse + smaller scope vs F-031, no category mapper, no test infra setup từ đầu).

---

## 🔗 Related features

- **F-024 SHIPPED** — Partners CRUD module
- **F-031 SHIPPED ~2h trước** — Service Catalog Excel Import (pattern source)
- **F-028 P&L** — partners chưa link, không impact

---

## 🔗 Next step

Mày chốt **A** (auto theo F-031 defaults) → tao chạy `/5bib-plan` build Scope Lock + tech approach + pipeline ship đến PROD.

Hoặc trả lời cụ thể từng PAUSE → đẩy luôn.
