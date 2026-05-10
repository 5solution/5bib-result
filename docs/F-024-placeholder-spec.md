# F-024 Contract Management — Placeholder Specification

**Status:** 🟠 PHASE_1_PAUSED_FOR_REVIEW
**Author:** 5bib-fullstack-engineer (Coder)
**Created:** 2026-05-11
**🛑 PAUSE-CODE-NEW-C:** Danny phải review file này TRƯỚC khi áp vào template render production.

---

## 1. Source files (Danny gửi 2026-05-11)

8 file `.docx/.xlsx` trong `.5bib-workflow/features/FEATURE-024-contract-management/templates-input/`:

| File | Type | Provider | Pattern |
|------|------|----------|---------|
| `[5BIB] Hợp đồng bán vé Giải chạy ... 2026.docx` | TICKET_SALES | 5BIB | Revenue-share, 14 articles |
| `[Timing] - 5BIB - Hợp đồng dịch vụ tính giờ ....docx` | TIMING | 5BIB | Fixed-price, 11 articles + 2 phụ lục |
| `[RACEKIT] - 5BIB - Hợp đồng vận hành racekit ....docx` | RACEKIT | 5BIB | Fixed-price, 11 articles |
| `14.4.26 ... - 5Sport - Hợp đồng vận hành (1).docx` | OPERATIONS | 5SOLUTION | Fixed-price, 25+ line items |
| `[5BIB-Timing] Biên bản nghiệm thu ....docx` | ACCEPTANCE | 5BIB | Diff actual vs contract |
| `[5BIB-Racekit] Biên bản nghiệm thu ....docx` | ACCEPTANCE | 5BIB | Diff actual vs contract |
| `[5Sport - Vận hành] Biên bản nghiệm thu ....docx` | ACCEPTANCE | 5SOLUTION | Diff actual vs contract |
| `[5BIB] Run For The Heart.xlsx` | Reference | — | Line items pattern (excel) |

---

## 2. Placeholder convention

- **Delimiter:** `{varName}` (single-brace, NOT double-brace per docxtemplater config)
- **Nested access:** `{client.entityName}` — supported via custom parser in `DocumentGeneratorService.renderDocx`
- **Loops:** `{#articles}...{/articles}` for arrays (paragraphLoop:true enabled)
- **Missing data:** rendered as empty string (nullGetter), no crash

---

## 3. Placeholder list

### 3.1 Provider entity (auto-fill from `provider-entities.ts`)

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{provider.entityName}` | `Contract.provider.entityName` | "CÔNG TY CỔ PHẦN 5BIB" |
| `{provider.taxId}` | `Contract.provider.taxId` | "0110398986" |
| `{provider.address}` | `Contract.provider.address` | "Tầng 9, Hồ Gươm Plaza..." |
| `{provider.representative}` | `Contract.provider.representative` | "Nguyễn Bình Minh" |
| `{provider.position}` | `Contract.provider.position` | "Giám đốc" hoặc "Tổng Giám Đốc" |
| `{provider.bankAccount}` | `Contract.provider.bankAccount` | "110398986" |
| `{provider.bankName}` | `Contract.provider.bankName` | "MB - Chi nhánh Thụy Khuê" |

### 3.2 Client entity (auto-fill from Partner picker hoặc inline)

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{client.entityName}` | `Contract.client.entityName` | "CÔNG TY CỔ PHẦN THÀNH AN MEDIA" |
| `{client.taxId}` | `Contract.client.taxId` | "0110446252" |
| `{client.address}` | `Contract.client.address` | "TM01-22, Vinhomes West Point..." |
| `{client.representative}` | `Contract.client.representative` | "Vũ Phan Anh" |
| `{client.position}` | `Contract.client.position` | "Tổng Giám Đốc" |
| `{client.phone}` | `Contract.client.phone` | "0985 737 168" |
| `{client.email}` | `Contract.client.email` | "contact@thanhanmedia.vn" |
| `{client.bankAccount}` | `Contract.client.bankAccount` | (optional) |
| `{client.bankName}` | `Contract.client.bankName` | (optional) |

### 3.3 Race info (auto-fill from race picker, optional)

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{raceName}` | `Contract.raceName` | "Hành Trình Theo Chân Bác" |
| `{raceDate}` | `Contract.raceDate` (formatted DD/MM/YYYY) | "01/05/2026" |
| `{raceLocation}` | `Contract.raceLocation` | "Hà Nội" |

### 3.4 Contract metadata

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{contractNumber}` | `Contract.contractNumber` | "11.04/2026/HDDV/TAM-5BIB" |
| `{signDate}` | formatted | "11/04/2026" |
| `{signDay}` / `{signMonth}` / `{signYear}` | derived | "11" / "04" / "2026" |
| `{effectiveDate}` | formatted | "12/04/2026" |
| `{endDate}` | formatted | "10/05/2026" |

### 3.5 Articles loop (BR-CM-11 dual-mode)

```
{#articles}
{heading}
{body}
{/articles}
```

- Mỗi item có `{heading}` (vd: "ĐIỀU 1. ĐỐI TƯỢNG") + `{body}` (text content)
- Default articles tại `constants/default-templates.ts`
- Per-contract override qua `templateOverrides[articleKey]`
- DB-level override qua `ContractTemplate.articles[articleKey]`

### 3.6 Line items loop

```
{#lineItems}
{stt}. {description} — {unit} — SL: {quantity} — Đơn giá: {unitPrice} — CK: {discount}% — Thành tiền: {amount}
{/lineItems}
```

| Placeholder per item | Source |
|---------------------|--------|
| `{stt}` | LineItem.stt |
| `{description}` | LineItem.description |
| `{unit}` | LineItem.unit |
| `{quantity}` | LineItem.quantity (formatted vi-VN) |
| `{unitPrice}` | LineItem.unitPrice (formatted) |
| `{discount}` | LineItem.discount (number) |
| `{amount}` | LineItem.amount (formatted) |
| `{note}` | LineItem.note |

### 3.7 Financial summary

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{subtotal}` | computed | "152.000.000" |
| `{vatRate}` | Contract.vatRate | "8" |
| `{vatAmount}` | computed | "12.160.000" |
| `{totalAmount}` | computed | "164.160.000" |
| `{totalAmountInWords}` | TODO Phase 2 — VN số tiền bằng chữ (TBD) | "Một trăm sáu mươi tư triệu một trăm sáu mươi ngàn đồng" |

### 3.8 Payment terms

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{advancePercentage}` | PaymentTerms.advancePercentage | "50" |
| `{advanceAmount}` | computed | "82.080.000" |
| `{remainderAmount}` | computed | "82.080.000" |
| `{latePenaltyRate}` | PaymentTerms.latePenaltyRate | "0.02" hoặc "12" |
| `{latePenaltyUnit}` | derived from PaymentTerms.latePenaltyUnit | "%/ngày" hoặc "%/năm" |
| `{paymentDeadlineDays}` | PaymentTerms.paymentDeadlineDays | "15" |

### 3.9 Revenue share (TICKET_SALES only)

| Placeholder | Source | Example |
|-------------|--------|---------|
| `{feePercentage}` | RevenueShare.feePercentage | "6" |
| `{feePerAthlete}` | RevenueShare.feePerAthlete | "7.000" |
| `{estimatedAthletes}` | RevenueShare.estimatedAthletes | "3000" |

### 3.10 Acceptance Report (BR-CM-09)

| Placeholder | Source |
|-------------|--------|
| `{acceptanceDate}` | formatted reportDate |
| `{contractTotalAmount}` | from contract |
| `{actualSubtotal}` | computed |
| `{actualVatAmount}` | computed |
| `{actualTotalWithVat}` | computed |
| `{diffAmount}` | computed (actual - contract) |
| `{advancePaid}` | input |
| `{remainingBalance}` | computed |
| `{verdict}` | enum |
| `{notes}` | text |
| `{#actualValues}...{/actualValues}` | array loop (same fields as lineItems) |

### 3.11 Payment Request

| Placeholder | Source |
|-------------|--------|
| `{requestDate}` | formatted |
| `{amountDue}` | from acceptance.remainingBalance |
| `{paymentDeadline}` | computed |

---

## 4. Template files (assets)

9 file DOCX trong `backend/assets/contract-templates/`:

| File | Use case | Status |
|------|----------|--------|
| `contract-timing.docx` | TIMING contract render | ✅ Stub generated (programmatic) |
| `contract-racekit.docx` | RACEKIT contract | ✅ Stub |
| `contract-operations.docx` | OPERATIONS contract | ✅ Stub |
| `contract-ticket-sales.docx` | TICKET_SALES contract | ✅ Stub |
| `acceptance-timing.docx` | TIMING acceptance | ✅ Stub |
| `acceptance-racekit.docx` | RACEKIT acceptance | ✅ Stub |
| `acceptance-operations.docx` | OPERATIONS acceptance | ✅ Stub |
| `payment-request.docx` | Payment request | ✅ Stub |
| `quotation.docx` | Quotation | ✅ Stub |

**⚠️ Important:** templates hiện tại là STUB (generated programmatically via `docx` lib). Chúng có cấu trúc placeholder đúng nhưng **layout đơn giản**. Phase 2 (sau Danny review) Coder sẽ:

1. Replace stub với DOCX layout phỏng theo file mẫu (giữ font Times New Roman, header/footer, table layout, signature lines).
2. Hoặc: Danny có thể sửa thủ công các template DOCX trên Word — chỉ cần **giữ nguyên placeholder syntax** `{varName}` và `{#loop}...{/loop}`.

---

## 5. Articles default content

Xem `backend/src/modules/contracts/constants/default-templates.ts`:

- TIMING: 11 articles (Điều 1-4 type-specific từ file mẫu Timing + Điều 5-11 shared boilerplate)
- RACEKIT: 11 articles (Điều 1-4 type-specific từ file mẫu RACEKIT + Điều 5-11 shared)
- OPERATIONS: 11 articles (Điều 1-4 type-specific từ file mẫu 5Sport Operations + Điều 5-11 shared)
- TICKET_SALES: 11 articles (Điều 1-4 type-specific từ file mẫu Ticket Sales + Điều 5-11 shared)

Shared boilerplate (Điều 5-11) extracted từ Timing contract:
- Điều 5: Chấm dứt hợp đồng
- Điều 6: Bất khả kháng
- Điều 7: Bồi thường và phạt vi phạm hợp đồng
- Điều 8: Bảo mật thông tin
- Điều 9: Giải quyết tranh chấp hợp đồng
- Điều 10: Điều khoản chung
- Điều 11: Hiệu lực hợp đồng

---

## 6. Review request — Danny phải confirm

🛑 **PAUSE-CODE-NEW-B**: Danny review nội dung Điều 1-11 trong `default-templates.ts` (legal-sensitive). Nếu OK → confirm. Nếu cần sửa → sửa trực tiếp file đó (hoặc chỉ đạo Coder sửa cụ thể).

🛑 **PAUSE-CODE-NEW-C**: Danny review danh sách placeholder trên (3.1 → 3.11). Nếu thiếu placeholder nào → bổ sung. Nếu data source mapping sai → correct.

🛑 **PAUSE-CODE-04 (deferred to Phase 2):** Edge case admin backdate signDate đã được resolve theo approach: sequence theo `signDate.getFullYear()` (NOT current year). Coder ghi rõ trong `contract-number.service.ts` comment + test `contract-number.service.spec.ts`. **Cần Danny confirm approach này OK.**

---

## 7. Sample render (Coder đã verify)

Test render `contract-timing.docx` với dummy data → render thành công, output file 31KB. Verified placeholder replacement, articles loop, line items loop, nested object access. Output xem `/tmp/test-render-timing.docx` (local-only, không commit).

Phase 2 sẽ render production sample + Danny verify side-by-side với file mẫu gốc.
