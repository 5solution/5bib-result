# FEATURE-042: Contract DOCX + BBNT Financial Number Generation Bug Fix

**Status:** 🟡 INITIATED
**Created:** 2026-05-18
**Owner:** Danny
**Type:** BUGFIX (HIGH severity — legal/finance accuracy)
**Created by:** 5bib-manager

---

## 🎯 Why this feature

Danny phát hiện bug PROD ngày 2026-05-18 khi xem DOCX hợp đồng + Biên bản nghiệm thu (BBNT) generated cho contract `6a095ceae7c717e8fc1c2c0e` (TIMING service): **số tài chính trong DOCX KHÔNG khớp với data thật trong DB/admin UI**.

### Reproduction case

**Contract:** `https://admin.5bib.com/contracts/6a095ceae7c717e8fc1c2c0e`

**Admin UI hiển thị (DATA ĐÚNG):**
| Field | Value |
|-------|-------|
| Cộng (chưa VAT) | 25.870.000 ₫ |
| VAT (8%) | 2.069.600 ₫ |
| TỔNG | 27.939.600 ₫ |
| Tạm ứng (50%) | 13.969.800 ₫ |
| Còn lại | 13.969.800 ₫ |

**DOCX Hợp đồng — Phụ lục 01 (SAI):**
| Field | Generated | Expected |
|-------|-----------|----------|
| Tổng tiền | 152.000.000 ₫ ❌ | 25.870.000 ₫ |
| VAT (8%) | 12.160.000 ₫ ❌ | 2.069.600 ₫ |
| Tổng sau VAT | 27.939.600 ₫ ✅ | 27.939.600 ₫ |

→ "Tổng sau VAT" đúng nhưng "Tổng tiền" + "VAT" sai → math không ra (152M + 12.16M = 164.16M ≠ 27.94M).

**DOCX BBNT (Biên bản nghiệm thu — SAI hết):**
- Section 3.1 "Giá trị hợp đồng": 27.939.600 ₫ ✅
- Section 3.2 "Giá trị nghiệm thu và thanh lý hợp đồng": **167.509.080 ₫** ❌ (should be 27.939.600 nếu 100% nghiệm thu)
- Footer table: Tổng tiền 155.101.000 ₫ ❌ / VAT 12.408.080 ₫ ❌ / Tổng sau VAT 167.509.080 ₫ ❌
- "Bên A tạm ứng cho Bên B": **82.080.000 ₫** ❌ (should be 13.969.800)
- "Bên A còn phải thanh toán": **85.429.080 VNĐ** ❌ (math should = totalAfterVAT - tạm ứng)

### Numeric anomaly analysis

- **BBNT footer 155.101.000 / 25.870.000 ≈ 5.99x** — gần như 6x multiplier
- **BBNT total 167.509.080 / 27.939.600 ≈ 5.99x** — same factor
- **BBNT tạm ứng 82.080.000 / 13.969.800 ≈ 5.87x** — different multiplier
- **Phụ lục Tổng tiền 152.000.000 / 25.870.000 ≈ 5.87x** — matches tạm ứng multiplier

→ 2 different multipliers (~5.99x và ~5.87x) → suggest **2 different bug paths** OR shared multiplier with rounding edge case.

### Business impact

🔴 **HIGH severity:**
- **Legal risk** — contracts đã gửi client có giá trị tài chính SAI → client có thể dispute legally
- **Finance dispute** — BBNT là chứng từ pháp lý cho payment + audit → wrong numbers = vi phạm Luật quản lý thuế 38/2019
- **Affected scope unknown** — chưa rõ bao nhiêu contracts đã generate với template sai. Cần audit toàn bộ TIMING/RACEKIT/OPERATIONS contracts đã ship.
- **5BIB external trust** — bug financial visible directly to merchant clients

---

## 📂 Impact Map (per memory + spot-check 2026-05-18)

### Module sẽ chạm

**Backend (`backend/src/modules/contracts/`):**

- `backend/assets/contract-templates/contract-timing.docx` — DOCX template Hợp đồng TIMING (likely bug source — Phụ lục 01 placeholder mapping)
- `backend/assets/contract-templates/acceptance-timing.docx` — DOCX template BBNT TIMING (likely bug source — footer + 3.2 + tạm ứng placeholders)
- `backend/src/modules/contracts/services/contracts.service.ts` — `buildRenderContext()` line ~1210 + `upsertAcceptanceReport()` line 1064 (verify data layer correct first)
- `backend/src/modules/contracts/services/document-generator.service.ts` — `renderDocx()` line 108 (docxtemplater wrapper — verify {placeholder} resolution correct)
- `backend/src/modules/contracts/schemas/contract.schema.ts` — `AcceptanceReport` schema fields (line 147-149: `actualSubtotal/actualVatAmount/actualTotalWithVat`)

**Other affected TIMING/RACEKIT/OPERATIONS templates (potential same bug pattern):**
- `backend/assets/contract-templates/contract-racekit.docx`
- `backend/assets/contract-templates/contract-operations.docx`
- `backend/assets/contract-templates/acceptance-racekit.docx`
- `backend/assets/contract-templates/acceptance-operations.docx`
- `backend/assets/contract-templates/payment-request.docx`

**Admin UI (verify only):**
- `admin/src/app/(dashboard)/contracts/[id]/page.tsx` — financial summary hiển thị ĐÚNG → admin UI KHÔNG bug, DB OK

### File then chốt Coder đọc trước khi code

1. **`backend/src/modules/contracts/services/contracts.service.ts:1210-1290`** — `buildRenderContext()` builder cho DOCX. Verify mỗi field `subtotal/vatAmount/totalAmount/lineItems/acceptanceReport/paymentTerms` được passed đúng từ contract document.

2. **`backend/src/modules/contracts/services/contracts.service.ts:1064-1123`** — `upsertAcceptanceReport()` build `acceptanceReport.actualValues[]` + tính `actualSubtotal/actualVatAmount/actualTotalWithVat`. CRITICAL: nếu admin input wrong unit_price vào `actualValues`, data layer sẽ store wrong totals.

3. **`backend/src/modules/contracts/services/document-generator.service.ts:108-150`** — `renderDocx()` qua docxtemplater. Check tag resolution + nested object access (`{acceptanceReport.actualTotalWithVat}` vs `{actualTotalWithVat}`).

4. **Real contract data dump:** Query MongoDB contract `6a095ceae7c717e8fc1c2c0e` để xác minh `acceptanceReport.actualValues` có exact unit_prices đúng hay không. Distinguish data input bug vs template render bug.

5. **DOCX template inspection:** Mỗi `.docx` template binary — Coder cần extract via `unzip -p <file> word/document.xml` hoặc mammoth/docx-extract để xem TỪNG `{placeholder}` tag trong Phụ lục 01 + BBNT footer + section 3.2 + tạm ứng/còn lại.

### Endpoint liên quan

- `POST /api/contracts/:id/generate-document` (docType=CONTRACT) — `generateDocument()` line 1295
- `POST /api/contracts/:id/generate-document` (docType=ACCEPTANCE_REPORT) — same endpoint
- `PUT /api/contracts/:id/acceptance-report` — `upsertAcceptanceReport()` (verify data path)
- `GET /api/contracts/:id` — admin UI fetch (DB read confirmed correct)

### Schema/DB

- **MongoDB collection `contracts`:**
  - `subtotal/vatAmount/totalAmount` (line 269/271/272 schema) — VERIFIED CORRECT cho contract bug
  - `paymentTerms.advanceAmount` (line ~) — 13.969.800 ✅ admin UI
  - `acceptanceReport.actualValues[]` (line 147 area) — **CẦN KIỂM TRA DB cho contract `6a095ceae7c717e8fc1c2c0e`** — nếu actual_unit_prices SAI (vd 90.000.000 thay vì 15.000.000) → bug data layer (admin entry mistake). Nếu actual_unit_prices ĐÚNG → bug template render.
  - `acceptanceReport.actualSubtotal/actualVatAmount/actualTotalWithVat` — derived from actualValues, sẽ match DB calc

- ❌ MySQL platform: KHÔNG đụng
- ❌ Redis: KHÔNG đụng (chỉ contracts list/dashboard cache, không cache DOCX content)
- ✅ AWS S3: contracts/ prefix — generated DOCX files đã upload S3, cần regenerate sau fix.

---

## ⚠️ Risk Flags

> Cross-reference `known-issues.md`:
> - F-024 contracts module HIGH-CON-01 find-then-save 11 callsites (NOT this bug — pure DOCX render layer)
> - F-035 cost field drop triple-quên — similar pattern of mapping errors
> - F-037 DOCX colspan + tblLayout fix — recent DOCX template bug precedent

- 🔴 **HIGH severity LEGAL/FINANCE** — Contracts đã ship với wrong financial numbers gửi client. Audit blast radius cần thiết trước khi fix.
- 🔴 **HIGH affecting PROD** — Bug LIVE trên `admin.5bib.com`, real merchant contracts đã download wrong DOCX. Risk = client dispute legally.
- 🟡 **MED template binary inspection** — DOCX templates binary, hard to diff/grep. Coder cần unzip extract `document.xml` để inspect placeholders. F-037 đã có precedent dùng tool này.
- 🟡 **MED need data audit DB** — Bug có thể là data input (admin entered wrong unit_prices in acceptanceReport) HOẶC template (placeholder wrong). Phải confirm trước khi fix.
- 🟡 **MED blast radius scan** — Cần grep audit `generatedDocuments[]` array across all contracts để biết bao nhiêu DOCX files đã ship wrong → regenerate batch.
- 🟢 **LOW backend code complexity** — Logic computation (`calcTotals`, `upsertAcceptanceReport`) appears correct via spot-check. Likely template mapping or data input bug.
- 🟢 **LOW rollback** — Fix template file + regenerate DOCX → no schema migration, no breaking API.

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

> Manager liệt kê các câu hỏi nghiệp vụ + technical chưa rõ. BA phải trả lời TỪNG cái trong `01-ba-prd.md`.

- [ ] **PAUSE-42-01 (Root cause classification):** BA cần phối hợp với Coder query MongoDB contract `6a095ceae7c717e8fc1c2c0e` document trực tiếp để dump `acceptanceReport.actualValues[]` raw. Nếu actualValues có wrong unit_prices (vd: 90M thay vì 15M cho item 1 Thảm tính giờ) → bug DATA INPUT (admin entered wrong). Nếu actualValues đúng (matches 15M/30k/9k/5M/5M screenshot) → bug TEMPLATE RENDER. **Manager đề xuất:** dump DB trước, classify root cause trước khi đề xuất fix scope.

- [ ] **PAUSE-42-02 (Blast radius audit):** Bao nhiêu contracts đã ship DOCX với wrong financial numbers? Cần audit:
  - Query `db.contracts.find({"generatedDocuments.0": {$exists: true}}, {contractNumber, totalAmount, "generatedDocuments.docType"})` để list tất cả contracts đã generate documents
  - Verify từng DOCX file S3 (sample 5-10 random) xem có same bug pattern
  - **Manager đề xuất:** Coder spawn 1 audit script chạy DB query + cross-check vài DOCX random → output report số contracts affected.

- [ ] **PAUSE-42-03 (Fix scope — chỉ TIMING hay all 3 contract types?):** Bug repro chỉ trên TIMING contract `6a095ceae7c717e8fc1c2c0e`. RACEKIT + OPERATIONS có cùng bug không? Cần test ít nhất 1 RACEKIT + 1 OPERATIONS contract đã generated. **Manager đề xuất:** Audit + test 3 contract types — fix ALL nếu cùng pattern bug, scope nhỏ nếu chỉ TIMING.

- [ ] **PAUSE-42-04 (Communication strategy):** Sau khi fix code + regenerate DOCX cho affected contracts, có cần:
  - Re-send DOCX cho merchants đã nhận file SAI? (Risk: nhận file mới với số khác → suspicious, legal exposure)
  - Hoặc internal-only fix (regenerate cho audit purpose, KHÔNG re-send cho client)?
  - **Manager đề xuất:** Cần Danny + Finance team decide. Phase 1 fix code + ngăn future bug. Phase 2 outreach strategy.

- [ ] **PAUSE-42-05 (Test fixture):** BA cần list scenarios test sau khi fix:
  - TIMING contract simple (1-2 line items) → DOCX gen → verify mỗi placeholder mapping đúng
  - TIMING contract complex (5+ line items có discount) — case của bug `6a095ceae7c717e8fc1c2c0e`
  - BBNT same contract → verify actualSubtotal/actualVatAmount/actualTotalWithVat math correct + tạm ứng/còn lại đúng
  - RACEKIT + OPERATIONS each 1 test contract

- [ ] **PAUSE-42-06 (Regenerate strategy for affected DOCX):** Sau fix code, regenerate cho contracts affected:
  - Script tự động re-call `generateDocument()` cho mỗi contract trong audit list?
  - Hoặc admin click "Tạo lại" thủ công per contract?
  - **Manager đề xuất:** Bulk regenerate script với confirm prompt + audit log emit.

- [ ] **PAUSE-42-07 (Lifecycle considerations):**
  - Hợp đồng đã FINALIZED status: có cho phép overwrite generatedDocuments[] với version mới không?
  - Mỗi regenerate có push entry mới vào `generatedDocuments[]` array (version++) hay overwrite latest?
  - Per memory F-034 (force-edit any status): contracts có thể edit non-DRAFT — chắc cho phép regenerate. Verify.

---

## 🎯 Success criteria (gợi ý cho BA cụ thể hoá thành BR)

- DOCX Hợp đồng Phụ lục 01 hiển thị **đúng** `subtotal/vatAmount/totalAmount` match DB
- DOCX BBNT footer table + section 3.2 + tạm ứng + còn lại hiển thị **đúng** match DB calc
- DOCX Hợp đồng Phụ lục lines (description + unit_price + qty + discount + amount) match DB lineItems
- DOCX BBNT actualValues table match DB acceptanceReport.actualValues + footer totals consistent với actualSubtotal/actualVatAmount/actualTotalWithVat
- Performance: regenerate DOCX < 30s timeout (existing PDF convert timeout preserved)
- Blast radius audit script: list ALL contracts có generatedDocuments[] với wrong numbers
- Regenerate batch: idempotent, audit-logged
- Tests: unit + e2e cover 3 contract types (TIMING/RACEKIT/OPERATIONS) — happy path + complex multi-line-item case

---

## 🔍 Manager observations & hypotheses

> Manager đã spot-check codebase trong impact map. Sau đây là các hypotheses ban đầu:

### Hypothesis 1: Template placeholder mismatch (LIKELY)

DOCX templates binary có `{placeholder}` tags. Có thể:
- Phụ lục 01 "Tổng tiền" placeholder = `{totalAmount}` (= 27.94M correct) nhưng template hiển thị `27.939.600` ở dòng "Tổng sau VAT" và đặt `{subtotal}` ở dòng "Tổng tiền" — nhưng số 152.000.000 không match bất kỳ field nào trong DB → suggest stale hardcoded value HOẶC template đã được edited by ai đó ở step trước
- BBNT footer "Tổng tiền: 155.101.000" — possibly using `{lineItems.0.amount}` × N hoặc placeholder reading wrong field
- Tạm ứng 82.080.000 — possibly old hardcoded value from sample template KHÔNG được replace properly

### Hypothesis 2: Stale template uploaded (POSSIBLE)

Admin có endpoint `POST /api/contracts/contract-templates/upload` (line 194 controller). Có thể ai đó upload OLD template version với hardcoded sample values KHÔNG xóa, KHÔNG có `{placeholder}` proper.

### Hypothesis 3: Data input bug acceptanceReport (POSSIBLE)

Admin entered `actualValues` với unit_prices SAI (vd: nhập 90.000.000 cho item 1 instead of 15.000.000) → `actualSubtotal` = 155M, `actualVatAmount` = 12.4M, `actualTotalWithVat` = 167.5M. Match BBNT footer exactly.

Nhưng:
- Visible table trong BBNT screenshot hiển thị unit_price 15.000.000 (đúng) cho item 1
- Nếu data SAI thì TABLE rows phải hiển thị unit_price SAI luôn
- → Hypothesis 3 LESS LIKELY unless template renders table from `lineItems` (raw contract data đúng) nhưng footer reads from `acceptanceReport.actualValues` (data sai)

### Hypothesis 4: Multiplier bug in template (POSSIBLE)

DOCX template có macro hoặc formula nhân với constant. ~5.99x = `qty × 6` somehow? `actualSubtotal × estimatedAthletes` somehow? Unlikely but possible if template was manually built with incorrect formula by non-dev.

### Recommended investigation order

1. **DB dump first** — `db.contracts.findOne({_id: ObjectId('6a095ceae7c717e8fc1c2c0e')}, {acceptanceReport: 1, paymentTerms: 1, subtotal: 1, vatAmount: 1, totalAmount: 1, lineItems: 1})` → classify root cause
2. **DOCX template extract** — `unzip -p backend/assets/contract-templates/contract-timing.docx word/document.xml | grep -oE '{[^}]+}'` → list all placeholders trong template
3. **Same for `acceptance-timing.docx`** — verify footer placeholder mapping
4. **Compare with code context builder** — verify mỗi placeholder có matching field trong `buildRenderContext()` output

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] **Yes** — Manager đã spot-check existing code + DOCX templates location + 7 PAUSE conditions liệt kê đầy đủ. BA proceed với context complete.
- 📝 **Note for BA:** PRD MUST include structured tables MANDATORY:
  - **Root Cause Investigation Plan** — explicit steps DB dump + template extract before propose fix
  - **Placeholder Mapping Table** — list all `{placeholder}` tags trong contract-timing.docx + acceptance-timing.docx + correct field path in `buildRenderContext()` output
  - **Affected Contracts Audit Plan** — DB query + sample DOCX inspection methodology
  - **Regenerate Batch Strategy** — script flow + idempotent guarantee + audit log
  - **Test Case Matrix** — 3 contract types × happy path + complex + edge cases
  - **Rollback strategy** — fix gì có thể revert nếu post-deploy fail

---

## 🔗 Next step

Danny chạy: `/5bib-prd FEATURE-042-contract-docx-financial-bug-fix`

BA agent (5bib-po-ba) sẽ:
1. Đọc file này + memory codebase-map + known-issues (vùng contracts)
2. Coordinate với Coder hoặc tự run DB dump query để classify root cause
3. Output `01-ba-prd.md` với structured tables (Root Cause Investigation Plan + Placeholder Mapping Table + Affected Audit Plan + Regenerate Strategy + 7 PAUSE-42-* answers)
4. Estimate Coder workload: ~3-5h fix template + audit script + tests + regenerate batch
