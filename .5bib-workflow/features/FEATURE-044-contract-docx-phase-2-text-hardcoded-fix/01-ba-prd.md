# FEATURE-044: PRD — Contract DOCX Phase 2 Hardcoded TEXT Bug Fix + Filename Convention

**Status:** 🔵 READY
**Last updated:** 2026-05-19
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check (BA)

- [x] Đã đọc `00-manager-init.md` đầy đủ (3 bug classes + 7 PAUSE-44-* + F-042 missed pattern inventory)
- [x] Đã đọc `memory/codebase-map.md` — contracts module F-024 NEW MODULE biggest + structure
- [x] Đã đọc `memory/known-issues.md` — F-042 8 TDs context + TD-F042-TEMPLATE-PLACEHOLDER-STATIC-AUDIT (F-044 resolves)
- [x] **Đã thực thi Manager's investigation order:**
  - Extract document.xml × 6 templates → exact position mapping
  - Read admin frontend `document-download-btn.tsx` → identified line 75 bug (`a.download` override)
  - Confirmed `buildDocumentFilename` util ĐÚNG nhưng admin BYPASS via DOM attribute override
- [x] **Manager hypothesis CONFIRMED + bonus bug discovered:**
  - `acceptance-racekit.docx` text says "số tiền còn lại cho Bên B là `{advancePaid}` VNĐ" → SAI semantic (should be `{remainingBalance}`)

---

## 🎯 Discovery findings (concrete bug inventory)

### A. Contract Number Hardcoded TEXT (3 templates, 8 occurrences total)

| Template | Position | Hardcoded | Replace với |
|----------|----------|-----------|-------------|
| `contract-racekit.docx` | Header `HỢP ĐỒNG DỊCH VỤ Số: ...` | `10.04/2026/HĐDV/TAM-5BIB` (×1) | `{contractNumber}` |
| `contract-ticket-sales.docx` | Header `HỢP ĐỒNG CUNG CẤP DỊCH VỤ Số: ...` | `25.02-HDDV-5BIB-TAM` | `{contractNumber}` |
| `contract-ticket-sales.docx` | Phụ lục 1 header `Số: ...` | `17.01-HDDV-5BIB-VUD` | `{contractNumber}` |
| `acceptance-racekit.docx` | Header `BIÊN BẢN NGHIỆM THU ... Số: ...` | `10.04/2026/HĐDV/TAM-5BIB` (×1) | `{contractNumber}` |
| `acceptance-racekit.docx` | `Căn cứ theo Hợp đồng số ...` | `10.04/2026/HĐDV/TAM-5BIB` (×1) | `{contractNumber}` |
| `acceptance-racekit.docx` | `Phụ lục số 01 của Hợp đồng số ...` | `10.04/2026/HĐDV/TAM-5BIB` (×1) | `{contractNumber}` |
| `acceptance-racekit.docx` | `nghiệm thu và thanh lý Hợp đồng dịch vụ Số: ...` | `10.04/2026/HĐDV/TAM-5BIB` (×1) | `{contractNumber}` |
| `acceptance-racekit.docx` | `Căn cứ: Hợp đồng số ...` | `10.04/2026/HĐDV/TAM-5BIB` (×1) | `{contractNumber}` |
| `acceptance-racekit.docx` | `Biên bản nghiệm thu và thanh lý hợp đồng số ...` | `10.04/2026/HĐDV/TAM-5BIB` (×1) | `{contractNumber}` |

**Total: 9 contract number hardcoded text occurrences across 3 templates.**

### B. "Bằng chữ" VN amount-in-words Hardcoded (5 templates, 7 hardcoded sentences)

| Template | Position context | Hardcoded text (= sample value) | Replace với |
|----------|------------------|--------------------------------|-------------|
| `contract-racekit.docx` | After totalAmount in Điều 2 | `Ba mươi sáu triệu một trăm tám mươi nghìn đồng` (= 36.180.000) | `{totalAmountInWords}` |
| `contract-operations.docx` | After totalAmount in Điều 2 | `Hai trăm sáu mươi tư triệu tám trăm tám tám ngàn ba trăm sáu mươi đồng` (= 264.888.360) | `{totalAmountInWords}` |
| `acceptance-timing.docx` | "thanh toán số tiền còn lại ... ({remainingBalance} VNĐ (Bằng chữ: ...))" | `Tám mươi lăm triệu bốn trăm hai mươi chín ngàn không trăm tám mươi đồng` (= 85.429.080) ×1 | `{remainingBalanceInWords}` |
| `acceptance-timing.docx` | "Quý Công ty sẽ thanh toán ... (Bằng chữ: ...)" | (same 85.429.080 in-words) ×1 | `{remainingBalanceInWords}` |
| `acceptance-racekit.docx` | Section 3.1 "Giá trị hợp đồng là {totalAmount} đồng (Bằng chữ: ...)" | `Ba mươi sáu triệu một trăm tám mươi nghìn đồng` (= 36.180.000) ×1 | `{totalAmountInWords}` |
| `acceptance-racekit.docx` | "số tiền còn lại cho Bên B là {advancePaid} VNĐ (Bằng chữ: ...)" | `Mười tám triệu không trăm chín mươi ngàn` (= 18.090.000) ×1 | `{remainingBalanceInWords}` |
| `acceptance-racekit.docx` | "Quý Công ty sẽ thanh toán ... (Bằng chữ: ...)" | (same 18.090.000 in-words) ×1 | `{remainingBalanceInWords}` |
| `acceptance-operations.docx` | "Bên A đồng ý nghiệm thu... {remainingBalance} VNĐ (Bằng chữ: ...)" | `Một trăm ba mươi ba triệu không trăm ba tám ngàn một trăm tám mươi đồng` (= 133.038.180) ×1 | `{remainingBalanceInWords}` |
| `acceptance-operations.docx` | "Quý Công ty sẽ thanh toán ... (Bằng chữ: ...)" | (same 133.038.180 in-words) ×1 | `{remainingBalanceInWords}` |

**Total: 9 in-words sentences across 5 templates → introduces NEW flatten key `remainingBalanceInWords`.**

### C. Placeholder Semantic Bug — `{advancePaid}` should be `{remainingBalance}` (1 template)

| Template | Position | Current placeholder | Should be |
|----------|----------|--------------------|-----------| 
| `acceptance-racekit.docx` | "Bên A đồng ý nghiệm thu và thanh toán số tiền còn lại cho Bên B là `{advancePaid}` VNĐ" | `{advancePaid}` | `{remainingBalance}` |

**Hidden bug:** Khi totalAmount/2 ≠ advancePaid, BBNT racekit hiển thị WRONG amount cho "còn lại". 50/50 split race templates hide bug numerically (advancePaid = remainingBalance same value).

### D. File Naming Convention Bug (admin frontend)

**Location:** `admin/src/app/(dashboard)/contracts/_components/document-download-btn.tsx:75`

**Current code:**
```typescript
a.download = `${DOCTYPE_LABEL[docType]}-${contractId}.${format.toLowerCase()}`;
```

**Result:** `Hợp đồng-6a0bcab66042f47bde4eb9d7.docx` — ID-based, ignores backend `Content-Disposition: filename="..."` from `buildDocumentFilename()`.

**Backend correctly returns human filename** via `contracts.service.ts:1448` calling `buildDocumentFilename({providerId, partnerName, docType, contractType, signDate, format})` → produces `[5BIB] CÔNG TY XYZ - Hợp đồng dịch vụ tính giờ - 15.05.2026.docx`.

**Danny's wanted pattern:** `[Mã hợp đồng] - [Tên sự kiện]`

**Per PAUSE-44-04 Manager option C HYBRID:** Combine F-024 pattern + Danny request →
- `[Mã HĐ] - [Tên sự kiện] - [DocType].ext`
- Example: `10.05.2026.HDDV.CTTFA-5BIB-6 - Cát Tiên Trail Family Adventure - Hợp đồng.docx`
- Sanitize: `/` in contract number → `.` (filesystem safe)
- Sanitize: race name `/` → `-`, strip control chars, max length 100 per existing pattern

---

## 📝 Contract DOCX Phase 2 Text Hardcoded Fix

**Goal:** Eliminate ALL hardcoded sample TEXT (contract numbers + VN amount-in-words + placeholder semantic typos) trong 6 contract templates. Fix admin frontend filename override. Extend F-024 audit script catch text patterns.

**Scope:**

- ✅ **In scope:**
  - Edit 5 templates với hardcoded contract number text + VN in-words: contract-racekit, contract-operations, contract-ticket-sales, acceptance-racekit, acceptance-operations + acceptance-timing
  - Fix placeholder typo `{advancePaid}` → `{remainingBalance}` trong acceptance-racekit.docx (Section 4)
  - Extend `buildRenderContext()` flatten F-042 với NEW key `remainingBalanceInWords` + verify `totalAmountInWords` working
  - Fix admin frontend `document-download-btn.tsx:75` — remove `a.download` override OR set proper pattern
  - Extend `audit-template-placeholders.ts` regex catch contract number pattern + VN in-words pattern (close TD-F042-TEMPLATE-PLACEHOLDER-STATIC-AUDIT)
  - Backend `buildDocumentFilename` extension: NEW input `contractNumber` + `raceName` per HYBRID Option C pattern
  - Reuse F-042 audit + regenerate scripts (extend if needed for combined F-042+F-044 batch)
  - 6 template backups → `.backup/<type>-20260519-pre-f044.docx`

- ❌ **Out of scope:**
  - `payment-request.docx` (verified clean from in-words + contract number — uses `{paymentRequest.amountDueInWords}` + `{contractNumber}` correctly)
  - `quotation.xlsx` (Excel template — different render path, no contract number rendering)
  - `contract-timing.docx` (clean from contract number + uses `{totalAmountInWords}` correctly — verified)
  - DB schema/migration (zero data change, template-only fix)
  - Admin UI redesign — only `a.download` line change

---

## 👤 User Stories & Business Rules

### User Stories

- As a **Sales Admin (Hằng)**, I want exported DOCX có số hợp đồng + "Bằng chữ" đúng từ DB so that gửi merchant không có discrepancy như case 6a0bcab66042f47bde4eb9d7.
- As a **Finance Admin (Hiền)**, I want BBNT DOCX file tải về có tên `[Mã HĐ] - [Tên sự kiện] - BBNT.docx` so that organize files dễ tracking thay vì chuỗi ObjectId random.
- As a **Race Organizer (merchant)**, I want hợp đồng nhận được có giá trị + bằng chữ tự động khớp tổng tiền so that no manual cross-check vs invoice.
- As a **5BIB Back-Office Admin**, I want audit script catch ALL hardcoded text patterns (numeric + contract number + in-words) so that future template changes auto-verified before deploy.
- As a **CFO**, I want regenerate batch covering both F-042 + F-044 fixes trong 1 communication cycle so that merchant nhận corrected DOCX đồng bộ, không gửi 2 lần suspicious.

### Business Rules (BR-44-01..18)

#### A. Template Hardcoded Text Replacement

- **BR-44-01** (Contract number eliminate): MỌI hardcoded contract number text pattern `\d{2}\.\d{2}/\d{4}/H[DĐ]+V?/[A-Z\-0-9]+` OR `\d{2}\.\d{2}-HDDV-[A-Z0-9\-]+` trong 3 affected templates PHẢI replace với `{contractNumber}` placeholder. Post-fix audit grep = 0 occurrences.
- **BR-44-02** (In-words eliminate): MỌI hardcoded VN amount-in-words text "Bằng chữ:" followed by `(Một|Hai|...|Chín)\s+(trăm|mươi|triệu|tỷ)\s+` PHẢI replace với appropriate `{xxxInWords}` placeholder per Mapping Table B above. Post-fix audit = 0 hardcoded in-words sentences in financial sections.
- **BR-44-03** (Placeholder semantic typo fix): `acceptance-racekit.docx` "Bên A thanh toán số tiền còn lại cho Bên B là {advancePaid} VNĐ" PHẢI đổi thành `{remainingBalance}`. Verify same typo KHÔNG có trong acceptance-timing.docx + acceptance-operations.docx (those use `{remainingBalance}` correctly).
- **BR-44-04** (Backward compat existing placeholders): Tất cả placeholders ĐÚNG hiện tại (`{contractNumber}` trong contract-timing/operations + `{totalAmountInWords}` trong acceptance-timing/operations + `{paymentRequest.amountDueInWords}` trong payment-request) PHẢI preserve unchanged.

#### B. Backend Context Flatten Extension (F-042 follow-up)

- **BR-44-05** (`remainingBalanceInWords` flatten key — NEW): `buildRenderContext()` trong `contracts.service.ts:1265-1300` PHẢI add new flatten key `remainingBalanceInWords` = `vndAmountInWords(contract.acceptanceReport.remainingBalance ?? 0)` khi acceptanceReport exists. Returns empty string khi acceptanceReport null.
- **BR-44-06** (Existing F-042 flatten preserved): 11 existing F-042 flatten keys (`actualSubtotal/actualVatAmount/actualTotalWithVat/contractSubtotal/diffAmount/advancePaid/remainingBalance/actualTotalWithVatInWords/reportDay/reportMonth/reportYear`) PHẢI giữ nguyên không break.
- **BR-44-07** (Numeric flatten guard): NEW in-words helpers MUST handle:
  - `remainingBalance = 0` → return empty string OR "Không đồng" (BA tham khảo `vndAmountInWords()` existing behavior — verify trong vn-num-to-words.ts)
  - `remainingBalance = null/undefined` → return empty string KHÔNG crash render
  - Negative values → behavior depends on vndAmountInWords (likely "Âm ..." prefix — KHÔNG block render)

#### C. File Naming Convention (HYBRID Option C per PAUSE-44-04)

- **BR-44-08** (Filename pattern HYBRID): Admin download filename PHẢI follow pattern: `[<ContractNumber sanitized>] - [<RaceName sanitized>] - [<DocType label>].<ext>`. Example: `10.05.2026.HDDV.CTTFA-5BIB-6 - Cát Tiên Trail Family Adventure - Hợp đồng.docx`.
- **BR-44-09** (ContractNumber sanitize): Replace `/` với `.` (filesystem safe). Strip control chars + `\\<>:|?*"`. Collapse whitespace. Max 80 chars. Fallback `(chưa cấp số)` nếu contractNumber null.
- **BR-44-10** (RaceName sanitize): Same pattern as `sanitizePartnerName()` in build-filename.ts — replace `/` `\` → `-`, strip control chars, collapse whitespace, max 80 chars. Fallback `(chưa gắn sự kiện)` nếu raceName null/empty.
- **BR-44-11** (Admin frontend remove override): `document-download-btn.tsx:75` PHẢI remove `a.download = ...` line OR set `a.download = backendFilename` extracted from Content-Disposition response header. Tested: KHÔNG còn `Hợp đồng-<contractId>.docx` pattern leak.
- **BR-44-12** (Backend `buildDocumentFilename` extension): Add 2 new input fields `contractNumber: string | null` + `raceName: string | null` to `BuildFilenameInput` interface. Render new HYBRID pattern when both provided. Fallback F-024 old pattern khi `contractNumber` empty (backward compat cho existing recon/quotation flows). `signDate` field giữ optional cho compatibility.

#### D. Audit Script Extension

- **BR-44-13** (Audit regex extend): `backend/scripts/audit-template-placeholders.ts` HARDCODED_LEAK_REGEX PHẢI extend từ chỉ `[0-9]{1,3}\.[0-9]{3}\.[0-9]{3}` (F-042) sang:
  ```
  - [0-9]{1,3}\.[0-9]{3}\.[0-9]{3}  (F-042 vi-VN number)
  - \d{2}\.\d{2}/\d{4}/H[DĐ]+V?/[A-Z\-0-9]+  (F-044 contract number slash format)
  - \d{2}\.\d{2}-HDDV-[A-Z0-9\-]+  (F-044 contract number dash format)
  - (?:Một|Hai|Ba|Bốn|Năm|Sáu|Bảy|Tám|Chín|Mười)\s+(?:trăm|mươi|triệu|tỷ|nghìn|ngàn)\s+  (F-044 VN in-words)
  ```
- **BR-44-14** (Audit script CONTEXT_KEYS update): CONTEXT_KEYS Set in audit script PHẢI include 12 F-042 flatten keys + new `remainingBalanceInWords`. Close TD-F042-TEMPLATE-PLACEHOLDER-STATIC-AUDIT — script reports 0 "Missing in context" post-F-044.
- **BR-44-15** (Pre-deploy audit gate): Manager `/5bib-plan` REJECT verdict nếu audit script chạy on edited templates báo ANY hardcoded leak (numeric + text + in-words). Zero-hardcoded gate mandatory.

#### E. Regenerate Strategy (Combined F-042 + F-044)

- **BR-44-16** (Combined regen batch): Single regenerate batch run post-F-044 deploy covers BOTH F-042 numeric fixes (already done) AND F-044 text fixes. Reuse `regenerate-affected-contracts.ts` script. Audit log emit `actor=f044-regenerate-script` để distinguish from F-042 batch.
- **BR-44-17** (PAID contract safeguard inherit): F-042 Manager Adjustment safeguard (PAID contract WARN + special audit event) PRESERVED in F-044 regen batch.
- **BR-44-18** (Audit before regen): MUST re-run audit script post-F-044 deploy → produce new `audit-f044-report.json` để identify contracts affected by EITHER F-042 OR F-044 (superset of F-042 audit).

---

## 🖥️ UI/UX Flow

> F-044 KHÔNG có UI redesign. Only 1 frontend line change + DOCX template content.

### Admin Download Flow (modified)

**Current bug (line 75 download-btn.tsx):**
```typescript
a.download = `${DOCTYPE_LABEL[docType]}-${contractId}.${format.toLowerCase()}`;
// Result: "Hợp đồng-6a0bcab66042f47bde4eb9d7.docx" ❌
```

**Fixed (BR-44-11 + BR-44-12):**
```typescript
// Backend returns Content-Disposition with proper filename
// Frontend reads it from response headers + applies to a.download
// OR removes a.download to let browser auto-handle
```

### UI Step-by-Step Journey: Sales Admin downloads BBNT

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Open `/contracts/6a0bcab66042f47bde4eb9d7` | Contract detail page render với "Tài liệu" section listing generatedDocuments[] | Page load | Detail loaded |
| 2 | Click button "BBNT" + chọn "Tải DOCX" trong dropdown | `<DocumentDownloadBtn docType=ACCEPTANCE_REPORT>` trigger `generateDocument()` + `streamDownloadBlob()` | Button onClick → API call | Loading state |
| 3 | Backend gen DOCX với CORRECT contract number + Bằng chữ | DOCX file ready trong S3 | Backend processing | Backend success |
| 4 | Backend `downloadDocument()` returns Content-Disposition `filename="<HYBRID pattern>"` | Frontend reads header → applies to download | Header parse | File downloaded |
| 5 | Browser saves file với tên `10.05.2026.HDDV.CTTFA-5BIB-6 - Cát Tiên Trail Family Adventure - Biên bản nghiệm thu.docx` | Toast success | Browser download API | Filename correct ✅ |

### UI States

- **Loading:** Button disabled + Loader2 spinner + label "Đang tạo..." (existing)
- **Success:** Toast green "Đã tải DOCX" + file saved với HYBRID filename (existing toast + new filename)
- **Error fetch backend:** Toast red với error message (existing)
- **Filename missing data fallback:** Nếu contractNumber null → use `(chưa cấp số)`. Nếu raceName null → use `(chưa gắn sự kiện)`. KHÔNG block download.

---

## 📊 Template Placeholder Mapping Table (Coder spec)

### Table A: `contract-racekit.docx`

| Position context | Hardcoded value | Replace with |
|------------------|-----------------|--------------|
| `HỢP ĐỒNG DỊCH VỤ Số: ...` (header) | `10.04/2026/HĐDV/TAM-5BIB` | `{contractNumber}` |
| `(Bằng chữ: ...)` after totalAmount | `Ba mươi sáu triệu một trăm tám mươi nghìn đồng` | `{totalAmountInWords}` |

### Table B: `contract-operations.docx`

| Position | Hardcoded | Replace with |
|----------|-----------|--------------|
| `(Bằng chữ: ...)` after totalAmount | `Hai trăm sáu mươi tư triệu tám trăm tám tám ngàn ba trăm sáu mươi đồng` | `{totalAmountInWords}` |

### Table C: `contract-ticket-sales.docx`

| Position | Hardcoded | Replace with |
|----------|-----------|--------------|
| `HỢP ĐỒNG CUNG CẤP DỊCH VỤ Số: ...` (header) | `25.02-HDDV-5BIB-TAM` | `{contractNumber}` |
| `PHỤ LỤC 1 ... Số: ...` (page 2) | `17.01-HDDV-5BIB-VUD` | `{contractNumber}` |

### Table D: `acceptance-timing.docx`

| Position | Hardcoded | Replace with |
|----------|-----------|--------------|
| Điều 4 `... {remainingBalance} VNĐ (Bằng chữ: ...)` | `Tám mươi lăm triệu bốn trăm hai mươi chín ngàn không trăm tám mươi đồng` ×1 | `{remainingBalanceInWords}` |
| `Quý Công ty sẽ thanh toán ... (Bằng chữ: ...)` | (same text) ×1 | `{remainingBalanceInWords}` |

### Table E: `acceptance-racekit.docx` — MOST CRITICAL (9 contract numbers + 3 in-words + 1 placeholder typo)

| Position | Current | Replace with |
|----------|---------|--------------|
| Header `BIÊN BẢN NGHIỆM THU ... Số: ...` | `10.04/2026/HĐDV/TAM-5BIB` ×1 | `{contractNumber}` |
| `Căn cứ theo Hợp đồng số ...` | `10.04/2026/HĐDV/TAM-5BIB` ×1 | `{contractNumber}` |
| `Phụ lục số 01 của Hợp đồng số ...` | `10.04/2026/HĐDV/TAM-5BIB` ×1 | `{contractNumber}` |
| `nghiệm thu và thanh lý Hợp đồng dịch vụ Số: ...` | `10.04/2026/HĐDV/TAM-5BIB` ×1 | `{contractNumber}` |
| `Căn cứ: Hợp đồng số ...` | `10.04/2026/HĐDV/TAM-5BIB` ×1 | `{contractNumber}` |
| `Biên bản nghiệm thu và thanh lý hợp đồng số ...` | `10.04/2026/HĐDV/TAM-5BIB` ×1 | `{contractNumber}` |
| Section 3.1 `Giá trị hợp đồng là {totalAmount} (Bằng chữ: ...)` | `Ba mươi sáu triệu một trăm tám mươi nghìn đồng` ×1 | `{totalAmountInWords}` |
| Điều 4 placeholder typo: `số tiền còn lại cho Bên B là {advancePaid} VNĐ` | `{advancePaid}` | `{remainingBalance}` (BR-44-03 semantic fix) |
| Điều 4 in-words `(Bằng chữ: ...)` for "còn lại" | `Mười tám triệu không trăm chín mươi ngàn` ×1 | `{remainingBalanceInWords}` |
| `Quý Công ty sẽ thanh toán ... (Bằng chữ: ...)` | (same 18.090.000 in-words) ×1 | `{remainingBalanceInWords}` |

### Table F: `acceptance-operations.docx`

| Position | Hardcoded | Replace with |
|----------|-----------|--------------|
| Điều 4 `... {remainingBalance} VNĐ (Bằng chữ: ...)` | `Một trăm ba mươi ba triệu không trăm ba tám ngàn một trăm tám mươi đồng` ×1 | `{remainingBalanceInWords}` |
| `Quý Công ty sẽ thanh toán ... (Bằng chữ: ...)` | (same 133.038.180 in-words) ×1 | `{remainingBalanceInWords}` |

**Total replacements:**
- Contract numbers: 8 occurrences across 3 templates
- In-words: 9 occurrences across 5 templates
- Semantic placeholder typo: 1 in acceptance-racekit

---

## 🛠️ Technical Mandates

### DB / Cache changes

- ❌ **MongoDB schema:** KHÔNG đụng
- ❌ **MongoDB data migration:** KHÔNG cần
- ❌ **Redis:** KHÔNG đụng (existing `invalidateContractsCache()` chains unchanged)
- ❌ **MySQL platform:** KHÔNG đụng
- ✅ **DOCX templates binary:** 6 files modify + 6 backup → `.backup/<type>-20260519-pre-f044.docx` per F-024 BACKUP_DIRNAME pattern
- ✅ **AWS S3:** New DOCX files upload (existing flow, old buggy files preserved via 5y retention)

### Backend Code Change: `buildRenderContext()` flatten extension

Extend F-042 flatten block (line 1265-1300) — ADD 1 new key:

```typescript
// F-044 EXTEND F-042 flatten — Add remainingBalanceInWords for "Bằng chữ" of còn lại
...(contract.acceptanceReport
  ? {
      // ... existing F-042 keys (preserve unchanged BR-44-06)
      actualSubtotal: contract.acceptanceReport.actualSubtotal,
      actualVatAmount: contract.acceptanceReport.actualVatAmount,
      actualTotalWithVat: contract.acceptanceReport.actualTotalWithVat,
      // ... (other 8 keys)
      
      // F-044 NEW: BR-44-05
      remainingBalanceInWords: vndAmountInWords(
        contract.acceptanceReport.remainingBalance ?? 0,
      ),
    }
  : {}),
```

### Backend `buildDocumentFilename` extension

Extend `backend/src/modules/contracts/utils/build-filename.ts`:

```typescript
export interface BuildFilenameInput {
  // ... existing fields
  
  // F-044 NEW
  /** Mã hợp đồng (contractNumber) — for HYBRID Option C pattern.
   * Nullable for backward compat (Quotation flows use F-024 old pattern). */
  contractNumber?: string | null;
  /** Tên sự kiện (raceName) — for HYBRID Option C pattern. */
  raceName?: string | null;
}

export function buildDocumentFilename(input: BuildFilenameInput): string {
  // ...
  // F-044: If contractNumber + raceName BOTH provided → HYBRID pattern
  //   `[ContractNumber sanitized] - [RaceName sanitized] - [DocType].ext`
  if (input.contractNumber && input.raceName) {
    const sanitizedCN = sanitizeContractNumber(input.contractNumber);
    const sanitizedRN = sanitizePartnerName(input.raceName);  // reuse existing
    const docLabel = DOC_TYPE_LABEL[input.docType];
    return `${sanitizedCN} - ${sanitizedRN} - ${docLabel}.${input.format}`;
  }
  // Else fallback to F-024 existing pattern (backward compat)
  // ... existing code
}

// F-044 NEW helper
function sanitizeContractNumber(cn: string): string {
  return cn
    .replace(/\//g, '.')  // / → . (filesystem safe)
    .replace(/[\\<>:|?*"]/g, '')  // strip control chars
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}
```

### Backend `contracts.service.ts:1448 downloadDocument()` extension

Pass `contractNumber` + `raceName` to `buildDocumentFilename` call:

```typescript
const filename = buildDocumentFilename({
  providerId: c.providerId,
  partnerName: c.client?.entityName ?? '',
  docType: doc.docType as any,
  contractType: c.contractType,
  signDate: c.signDate ?? null,
  fallbackDate: doc.generatedAt ?? c.createdAt ?? null,
  format,
  // F-044 NEW
  contractNumber: c.contractNumber ?? null,
  raceName: c.raceName ?? null,
});
```

### Admin Frontend Fix: `document-download-btn.tsx:75`

**Decision (Coder may choose):**
- **Option 1 (Recommended):** Remove `a.download` line → browser uses Content-Disposition from backend
- **Option 2:** Extract filename from response headers + apply

If Option 1 chosen:
```typescript
// REMOVE this line (was line 75):
// a.download = `${DOCTYPE_LABEL[docType]}-${contractId}.${format.toLowerCase()}`;

// Browser uses Content-Disposition filename from backend automatically
```

Streamed via `streamDownloadBlob()` — verify that helper preserves Content-Disposition response header passed to blob filename.

⚠️ **Coder verify:** `streamDownloadBlob()` implementation trong `contracts-api.ts` — confirm it reads `Content-Disposition` filename + applies to download OR returns headers for caller usage.

### Audit Script Extension: `audit-template-placeholders.ts`

Per BR-44-13 + BR-44-14 — extend HARDCODED_LEAK_REGEX + CONTEXT_KEYS Set.

```typescript
// F-044 EXTEND: catch F-042 + F-044 hardcoded patterns
const HARDCODED_LEAK_REGEX = [
  /[0-9]{1,3}\.[0-9]{3}\.[0-9]{3}/g,  // F-042 vi-VN currency
  /\d{2}\.\d{2}\/\d{4}\/H[DĐ]+V?\/[A-Z\-0-9]+/g,  // F-044 contract number slash
  /\d{2}\.\d{2}-HDDV-[A-Z0-9\-]+/g,  // F-044 contract number dash
  /(?:Một|Hai|Ba|Bốn|Năm|Sáu|Bảy|Tám|Chín|Mười)\s+(?:trăm|mươi|triệu|tỷ|nghìn|ngàn)\s+/g,  // F-044 VN in-words
];

// F-044 CONTEXT_KEYS update — add F-042 11 + F-044 1 = 12 flatten keys
const CONTEXT_KEYS = new Set([
  // ... existing keys
  'actualSubtotal', 'actualVatAmount', 'actualTotalWithVat',
  'contractSubtotal', 'diffAmount', 'advancePaid', 'remainingBalance',
  'actualTotalWithVatInWords', 'reportDay', 'reportMonth', 'reportYear',
  'remainingBalanceInWords',  // F-044 NEW BR-44-14
]);
```

### Frontend / Admin (Next.js)

- ❌ NO new endpoint, NO SDK regen (no DTO change)
- ❌ NO UI restructure
- ✅ Single line change `document-download-btn.tsx:75`

### PAUSE flags

- 🛑 `streamDownloadBlob()` implementation in `contracts-api.ts` — Coder MUST verify Content-Disposition propagation. If admin client strips header (CORS or Fetch API restriction), need alternative implementation (parse header manually via xhr OR backend exposes filename in response JSON).
- 🛑 acceptance-racekit `{advancePaid}` typo fix — Coder + Manager confirm semantic is "amount remaining to pay" (= `{remainingBalance}`). If Danny's business logic actually wants "advance amount" displayed there for some reason → revert.
- 🛑 Combined F-042+F-044 regenerate batch — Danny + Finance team approve scope before PROD execution.

---

## 🛡️ Testing Mandates

### Backend Test Cases TC-44-XX

#### TC-44-01: Contract DOCX RACEKIT — contract number resolved
| Element | Value |
|---------|-------|
| Method | POST |
| URL | `/api/contracts/test-racekit-id/generate-document` |
| Body | `{"docType": "CONTRACT"}` |
| Pre-condition | Contract `contractNumber: '10.05/2026/HDDV/CTTFA-5BIB-6'`, contractType `RACEKIT`, totalAmount 36180000 |
| Expected status | 200 |
| **DOCX content verify** | Contains `10.05/2026/HDDV/CTTFA-5BIB-6` (DB value). NO `10.04/2026/HĐDV/TAM-5BIB` (old hardcoded sample). Contains `Ba mươi sáu triệu một trăm tám mươi nghìn đồng` (= computed in-words). |

#### TC-44-02: Contract DOCX OPERATIONS in-words
| Body | `{"docType": "CONTRACT"}` |
| Pre-condition | Contract type OPERATIONS, totalAmount 100000000 |
| **DOCX content verify** | Contains `Một trăm triệu đồng` (computed in-words for 100M). NO `Hai trăm sáu mươi tư triệu...` (old 264M hardcoded). |

#### TC-44-03: Contract DOCX TICKET_SALES — 2 contract number positions
| Body | `{"docType": "CONTRACT"}` |
| Pre-condition | Contract type TICKET_SALES, contractNumber `01.05/2026/HDDV/XYZ-5BIB-1` |
| **DOCX content verify** | Contains `01.05/2026/HDDV/XYZ-5BIB-1` ≥2 occurrences (header + Phụ lục). NO `25.02-HDDV-5BIB-TAM` + NO `17.01-HDDV-5BIB-VUD` hardcoded. |

#### TC-44-04: BBNT RACEKIT — 6 contract numbers resolved + remainingBalance fix
| Body | `{"docType": "ACCEPTANCE_REPORT"}` |
| Pre-condition | RACEKIT contract với acceptanceReport: totalAmount 36180000, advancePaid 15000000, remainingBalance 21180000 (NOT 50/50 split — different values critical) |
| **DOCX content verify** | Contains contractNumber từ DB ≥6 occurrences. "Bằng chữ" cho "còn lại" = `Hai mươi mốt triệu một trăm tám mươi nghìn đồng` (= 21180000 = remainingBalance). NOT `Mười tám triệu...` (hardcoded sample). NOT `Mười lăm triệu...` (= advancePaid — verify {remainingBalance} used not {advancePaid}). |

#### TC-44-05: BBNT TIMING — remainingBalanceInWords replaces hardcoded
| Body | `{"docType": "ACCEPTANCE_REPORT"}` |
| Pre-condition | TIMING contract acceptanceReport remainingBalance = 13969800 |
| **DOCX content verify** | Contains `Mười ba triệu chín trăm sáu mươi chín nghìn tám trăm đồng` (= 13.969.800 in-words). NO `Tám mươi lăm triệu bốn trăm hai mươi chín ngàn không trăm tám mươi đồng` (hardcoded sample 85.429.080). |

#### TC-44-06: BBNT OPERATIONS — remainingBalanceInWords resolves
Similar pattern verify NO `Một trăm ba mươi ba triệu...` hardcoded.

#### TC-44-07: Filename HYBRID pattern — happy path
| Method | Direct service call OR controller integration |
| Input | `buildDocumentFilename({providerId: '5BIB', partnerName: 'Cát Tiên Adventure', contractNumber: '10.05/2026/HDDV/CTTFA-5BIB-6', raceName: 'Cát Tiên Trail Family Adventure', docType: 'CONTRACT', contractType: 'RACEKIT', format: 'docx'})` |
| Expected output | `10.05.2026.HDDV.CTTFA-5BIB-6 - Cát Tiên Trail Family Adventure - Hợp đồng.docx` |
| Verify | `/` → `.` sanitize, no leading/trailing whitespace |

#### TC-44-08: Filename — backward compat F-024 pattern when contractNumber missing
| Input | Same as TC-44-07 but `contractNumber: null` |
| Expected output | `[5BIB] Cát Tiên Adventure - Hợp đồng vận hành racekit - <date>.docx` (F-024 pattern) |
| Verify | Backward compat for Quotation flow that doesn't have contractNumber |

#### TC-44-09: Filename sanitize edge cases
| Input variations | contractNumber có `/`, raceName có `/`, very long names |
| Expected | `/` replaced with `.` or `-` per field. Truncated at 80 chars. No control chars. |

#### TC-44-10: Audit script post-fix grep zero hardcoded
| Method | Run `pnpm --filter backend ts-node scripts/audit-template-placeholders.ts` post-edit |
| Expected output | "Hardcoded leaks (unique): 0" across all template categories (F-042 numeric + F-044 contract number + F-044 in-words) |
| Side effect | NO DB mutation, JSON output `audit-f044-report.json` |

#### TC-44-11: Audit script CONTEXT_KEYS verifies flatten keys present
| Expected | "Missing in context" = 0 (close TD-F042-TEMPLATE-PLACEHOLDER-STATIC-AUDIT) — all F-042 11 + F-044 1 flatten keys in CONTEXT_KEYS Set match buildRenderContext output. |

#### TC-44-12: Context flatten verifies remainingBalanceInWords
| Method | Unit test `buildRenderContext()` directly |
| Input | acceptanceReport.remainingBalance = 21180000 |
| Expected | ctx.remainingBalanceInWords = "Hai mươi mốt triệu một trăm tám mươi nghìn đồng" |

#### TC-44-13: Context flatten edge — remainingBalance = 0
| Input | remainingBalance: 0 |
| Expected | ctx.remainingBalanceInWords = "Không đồng" (per vndAmountInWords behavior — verify) |

#### TC-44-14: Context flatten edge — acceptanceReport null
| Input | contract.acceptanceReport = null |
| Expected | ctx.remainingBalanceInWords UNDEFINED (key not present in flatten spread `... ? {...} : {}`) |

### Frontend E2E Test Cases (Playwright)

| TC | Persona | Journey | Steps | Expected |
|----|---------|---------|-------|----------|
| E2E-44-01 | Sales Admin | Download Contract RACEKIT | 1. `/contracts/<racekit-id>` 2. Click "Hợp đồng" → "Tải DOCX" 3. Open file | Filename = `<CN> - <Race> - Hợp đồng.docx`. Content has DB contractNumber NOT `TAM-5BIB`. |
| E2E-44-02 | Finance Admin | Download BBNT RACEKIT (Danny case) | 1. `/contracts/6a0bcab66042f47bde4eb9d7` 2. Click "BBNT" → "Tải DOCX" 3. Open | Filename = `10.05.2026.HDDV.CTTFA-5BIB-6 - <Race> - Biên bản nghiệm thu.docx`. Content section 3.2 + footer có contract number ĐÚNG `10.05/2026/HDDV/CTTFA-5BIB-6`. "Bằng chữ" còn lại = computed value NOT `Mười tám triệu...`. |
| E2E-44-03 | Sales Admin | Download Contract TICKET_SALES — 2 CN positions | Similar flow | Both contract header + Phụ lục show DB contract number |
| E2E-44-04 | Finance Admin | Acceptance with 30/70 split (BR-44-03 verify) | Create acceptance với advancePaid 30%, remainingBalance 70% of totalAmount → download BBNT racekit | "Còn lại" line shows remainingBalance (70%) NOT advancePaid (30%). In-words matches 70% computed. |
| E2E-44-05 | Operations | Filename sanitize | Contract với contractNumber có `/`, raceName có VN diacritics | Filename = `XX.YY.YYYY...... - RaceName - DocType.docx` (slashes replaced, diacritics preserved) |
| E2E-44-06 | Back-Office Admin | Audit script post-deploy | SSH backend → run extended audit script | "Hardcoded leaks: 0" + "Missing in context: 0" reports |

### Security Checks

- [ ] Filename sanitize prevents path traversal — no `../` injection
- [ ] Long contractNumber/raceName (>80 chars) truncated safely
- [ ] Existing `LogtoStaffGuard` preserved on `POST /api/contracts/:id/generate-document` (unchanged from F-042)

### Performance SLA

- DOCX gen p95 < 30s (unchanged — same render pipeline)
- Audit script extended regex runtime < 5 phút (cùng scale với F-042)
- Test suite F-044 (TC-44-XX) < 5s (unit tests mock S3)

---

## 📌 Answers to Manager's PAUSE conditions (từ file 00)

> BA giải quyết 7 PAUSE-44-* Manager đã đặt.

- **PAUSE-44-01 (in-words helper scope):** ✅ Add **1 new key** `remainingBalanceInWords` (per Mapping Table evidence — 9 hardcoded "Bằng chữ" sentences trong 5 templates ALL correspond to "còn lại"/remainingBalance semantics, NOT subtotal hoặc vatAmount). BR-44-05 encoded.

- **PAUSE-44-02 (acceptance-racekit semantic):** ✅ Mapped exact via extract — Table E:
  - Section 3.1 → `{totalAmount}` + `{totalAmountInWords}` (contract value)
  - Section 4 "còn lại" → `{remainingBalance}` (fix typo from `{advancePaid}` BR-44-03) + `{remainingBalanceInWords}` (BR-44-02)
  - "Quý Công ty sẽ thanh toán" → `{remainingBalanceInWords}` (same remainingBalance context)
  - 6 contract number occurrences → `{contractNumber}`

- **PAUSE-44-03 (contract-ticket-sales HDDV fragment):** ✅ Verified via extract — 2 separate hardcoded contract numbers (header + Phụ lục 1). Both → `{contractNumber}`. Same template can use same placeholder twice (docxtemplater renders consistently).

- **PAUSE-44-04 (file naming convention):** ✅ **Option C HYBRID** chốt: `[ContractNumber sanitized] - [RaceName sanitized] - [DocType label].ext`. Manager đề xuất accepted. F-024 old pattern preserved as fallback khi contractNumber empty (Quotation/Pre-contract flows). BR-44-08..12 encoded.

- **PAUSE-44-05 (admin frontend download path):** ✅ Confirmed via spot-check `document-download-btn.tsx:75` — `a.download = ...` override bypass Content-Disposition. Fix: Coder remove line OR extract from response header. BR-44-11 encoded.

- **PAUSE-44-06 (combined F-042+F-044 regen):** ✅ Single audit + regen batch run post-F-044 deploy reuses F-042 scripts. Audit script extended (BR-44-13) catches all bug classes. Regen actor=`f044-regenerate-script` distinguishes. PAID safeguard preserved (BR-44-17). Audit before regen (BR-44-18).

- **PAUSE-44-07 (test fixture matrix):** ✅ Encoded in Testing Mandates — 14 TC-44-XX + 6 E2E-44-XX covering 3 contract types × CONTRACT/BBNT + filename + audit. Real-world: TC-44-04 uses Danny's exact contract `6a0bcab66042f47bde4eb9d7` semantic (30/70 split asymmetric advancePaid/remainingBalance to expose BR-44-03 typo).

---

## 🚨 Risk acknowledgments

- 🔴 **MULTI-VIEWER VERIFY inherits F-042 TD** — Same XML manipulation approach. Manual visual verify post-deploy (MS Word + LibreOffice + Google Docs) per F-037 lesson.
- 🟡 **Placeholder typo fix `{advancePaid}` → `{remainingBalance}` in racekit BBNT** — Hidden bug surfaces khi non-50/50 split. Coder MUST test asymmetric split case (TC-44-04 covers).
- 🟡 **streamDownloadBlob Content-Disposition propagation** — Coder verify before commit. If admin Fetch API strips response header → need alternative (backend exposes filename in response JSON via header `X-Filename-Override`).
- 🟢 **Backward compat F-024 quotation filename** — fallback path preserved (BR-44-12).

---

## ✅ Status

- [x] **READY** — sẵn sàng cho Manager review (`/5bib-plan`)

---

## 🔗 Next step

Danny chạy: `/5bib-plan FEATURE-044-contract-docx-phase-2-text-hardcoded-fix`

Manager sẽ:
1. Validate 18 BR-44-* testable + Template Placeholder Mapping Tables A-F + 14 TC + 6 E2E
2. Cross-check memory architecture (no change) + conventions (extend F-042 audit pattern) + known-issues (F-042 8 TDs)
3. **Spot-check code thật** per MANDATE 2026-05-17:
   - `contracts.service.ts:1265-1300` flatten block ready for 1 new key add
   - `build-filename.ts:` Input interface ready for 2 new fields
   - `document-download-btn.tsx:75` `a.download` override confirmed
   - `streamDownloadBlob()` impl trong contracts-api.ts cần verify Content-Disposition behavior
4. Output `02-manager-plan.md` với Scope Lock + verdict

**Estimated Coder workload:** ~3-4 hours
- ~30 min: Extract document.xml for 6 templates + verify Mapping Tables A-F
- ~1h: Edit 6 DOCX templates via Python XML manipulation + grep audit verify
- ~30 min: Backend buildRenderContext flatten extension (1 LoC) + build-filename HYBRID (~30 LoC) + downloadDocument call signature update
- ~30 min: Admin frontend `document-download-btn.tsx:75` fix + verify streamDownloadBlob path
- ~30 min: Audit script regex + CONTEXT_KEYS extension
- ~1h: Unit tests TC-44-01..14 (14 cases)
- ~30 min: Self-Review Pipeline + documentation 03-coder-implementation.md
