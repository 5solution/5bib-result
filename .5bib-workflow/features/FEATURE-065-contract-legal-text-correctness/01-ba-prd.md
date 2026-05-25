# FEATURE-065 — Contract Template Legal Text Correctness (PRD)

> **Owner BA/PO:** 5BIB PO + Master Business Analyst
> **Ngày ban hành:** 2026-05-25
> **Gate ownership:** `/5bib-prd` (PO-BA) → handoff `/5bib-code` (Coder) → `/5bib-qc` (QC)
> **Trạng thái:** AWAITING APPROVAL (Manager + Danny)
> **Phụ thuộc upstream:** F-042 (financial fix), F-044 (text/hardcoded phase 2), F-045 (legacy bank/provider phase 3), F-064 (hardcoded date/location)
> **Phụ thuộc downstream:** F-066 (contract number format refactor), F-067 (auto regen on template change)

---

## 0. Pre-flight Audit Findings (PAUSE-65-05)

**Mục tiêu:** Verify 3 acceptance template (`acceptance-operations.docx`, `acceptance-racekit.docx`, `acceptance-timing.docx`) có chứa bất kỳ trong 7 bug pattern viện dẫn không, để **bundle fix scope** nếu cần.

### Phương pháp
Chạy Python `zipfile + re` extract `word/document.xml` của từng template, strip XML tags, search 7 forbidden patterns: `Q11)`, `theo Điều 4 của Hợp đồng`, `quy định tại Điều 7`, `chịu phạt giống điều 5`, `lãi suất bằng quy định tại Điều 5`, `Bên tác động trở`, `Bên B thanh toán cho Bên A`.

### Kết quả pre-flight audit

| Template | Bugs phát hiện |
|---|---|
| `acceptance-operations.docx` | **0** — sạch |
| `acceptance-racekit.docx` | **0** — sạch |
| `acceptance-timing.docx` | **0** — sạch |
| `contract-operations.docx` | 6 bug pattern (Điều 4, Điều 7, điều 5, Điều 5 lãi, tác động trở, Bên B thanh toán) + Bug #3 `QH11)` typo |
| `contract-racekit.docx` | 5 bug pattern + Bug #3 `QH11)` typo |
| `contract-timing.docx` | 5 bug pattern, **KHÔNG có** Bug #3 (text đã đúng `77/2006/QH11 ngày`, không có `)` thừa) |
| `contract-ticket-sales.docx` | **0** — sạch (out scope) |

### Quyết định scope (chốt theo PAUSE-65-05)
**Group B (acceptance templates) = EMPTY scope.** Cả 3 acceptance template KHÔNG có bug pattern legal-text viện dẫn → **KHÔNG mở rộng scope F-065 sang acceptance templates.** Acceptance template chỉ render line-items + amounts + signoff (không có recital/penalty/force-majeure/tax clause), nên về mặt thiết kế cũng phù hợp với kết quả audit.

### Điều chỉnh phạm vi sau audit
- Bug #3 (typo `QH11)`) chỉ áp dụng **2 template** (operations + racekit), không phải 3 → giảm 1 edit so với Manager init.
- Bug #6 (Điều 4 → Điều 3) confirm chỉ trong operations (đúng Manager init).
- Tổng số edit thực tế = **8 (operations) + 7 (racekit) + 6 (timing) = 21 edits** (đúng theo Manager init scope, không thay đổi).

---

## 1. Mục tiêu nghiệp vụ & Bối cảnh

### 1.1. Background

3 template `contract-operations.docx`, `contract-racekit.docx`, `contract-timing.docx` là DOCX template `docxtemplater` dùng để render HĐ dịch vụ thực tế ký với merchant (operations / racekit / timing). Trong quá trình QC nội bộ + review bởi Legal/Finance, BA phát hiện **11 lỗi văn bản pháp lý** trong các template hiện tại:

- **7 viện dẫn SAI** số điều khoản (cross-reference đến điều khoản KHÔNG tồn tại hoặc SAI điều khoản trong cùng HĐ).
- **2 typo** (dấu ngoặc thừa, chính tả).
- **1 lỗi semantic** (sentence không có chủ ngữ rõ, ý nghĩa pháp lý mơ hồ).
- **1 cụm trùng nội dung** (dispute-resolution clause đã xuất hiện ở section trước, lặp ở `Điều khoản chung 11.5` gây mâu thuẫn).

Các lỗi này được phát hiện sau khi F-042 (financial calc), F-044 (placeholder hardcoded text), F-045 (bank/provider), F-064 (date/location) đã sửa xong các bug nội dung CƠ HỌC (số, ngày, chỗ ký). F-065 là vòng cuối: **legal text correctness pass** — verify text pháp lý chính xác về mặt viện dẫn và ngôn ngữ.

### 1.2. Vì sao F-065 quan trọng

- **Pháp lý rủi ro cao:** HĐ ký với merchant chứa viện dẫn SAI điều khoản → khi tranh chấp ra tòa hoặc khi merchant cãi lý → 5BIB không bảo vệ được lập luận penalty/lãi suất/khấu trừ thuế.
- **Trust với merchant:** Merchant Finance/Legal đọc HĐ thấy typo `Q11)` → giảm trust với 5BIB ngay khi ký mới.
- **Tax compliance:** Bug #11 (cụm "Bên B thanh toán cho Bên A" trùng nội dung trong tax clause) gây mơ hồ nghĩa vụ khấu trừ thuế VAT/CIT → có thể bị cơ quan thuế bắt lỗi khi audit.
- **Force majeure clause (#10):** Bug semantic "Bên tác động trở" → không xác định rõ Bên nào được miễn trừ → khi xảy ra bất khả kháng thực tế (bão, dịch, đình công), 2 Bên không thống nhất ai được tạm ngừng nghĩa vụ.

### 1.3. KPI hậu deploy

| Metric | Trước F-065 | Target sau F-065 |
|---|---|---|
| Số viện dẫn SAI trong HĐ ký mới | 7 (ops) / 6 (racekit) / 6 (timing) | **0 cả 3 template** |
| Typo legal text | 2 (`QH11)`, "tác động trở") | **0** |
| Cụm trùng nội dung trong cùng HĐ | 1 (dispute dup) | **0** |
| Audit script grep test pattern coverage | 4 class (F-044) | **4 + 7 = 11 class (F-065)** |
| Regression F-042/F-044/F-045/F-064 | PASS | **Vẫn PASS 100%** |

---

## 2. PAUSE Decisions Locked (Manager Init)

5 PAUSE đã được Danny APPROVE trong Manager init:

| ID | Quyết định | Lý do |
|---|---|---|
| **PAUSE-65-01** | APPROVE ALL Manager wording proposals cho 7 bugs (xem chi tiết Section 3.2) | Manager đã rà soát toàn bộ 11 điều khoản, đề xuất viện dẫn đúng cross-reference theo article-numbering hiện tại của từng template |
| **PAUSE-65-02** | A Generic lãi suất (Bug #9): dùng cụm "*tiền lãi suất chậm trả tương ứng với thời gian chậm nộp theo quy định pháp luật hiện hành*" thay vì cố fix viện dẫn về Điều 5/6 | Chưa có article quy định lãi suất cụ thể trong template → dùng generic "*theo quy định pháp luật hiện hành*" an toàn nhất, không cần thêm article mới |
| **PAUSE-65-03** | A Bỏ Điều 11.5 hoàn toàn (Bug #12 — cụm trùng dispute) | Section trước đã xử dispute resolution → giữ lại sẽ mâu thuẫn / lặp → bỏ hoàn toàn 1 đoạn lặp |
| **PAUSE-65-04** | A Forward-only (KHÔNG migrate HĐ historical đã ký) | Historical HĐ đã có chữ ký 2 Bên — không có quyền đơn phương đổi → fix chỉ áp dụng cho HĐ ký mới từ deploy date trở đi |
| **PAUSE-65-05** | Pre-flight audit acceptance templates trong PRD (đã thực hiện — kết quả Section 0) | Đảm bảo F-065 scope cover đầy đủ template có liên quan |

---

## 3. Phạm vi (Scope)

### 3.1. IN SCOPE — Group A: 3 contract templates × text edits

#### 21 text edit tổng cộng (matrix view)

| # | Bug ID | Loại | contract-operations | contract-racekit | contract-timing | Total edits |
|---|---|---|---|---|---|---|
| 1 | Bug #3 | Typo `QH11)` | ✓ | ✓ | — (đã đúng) | 2 |
| 2 | Bug #6 | Viện dẫn Điều 4 → Điều 3 | ✓ | — (không có) | — (không có) | 1 |
| 3 | Bug #7 | Viện dẫn Điều 7 → Điều 8 | ✓ | ✓ | ✓ | 3 |
| 4 | Bug #8 | Viện dẫn điều 5 → Điều 6 | ✓ | ✓ | ✓ | 3 |
| 5 | Bug #9 | Lãi suất Generic | ✓ | ✓ | ✓ | 3 |
| 6 | Bug #10 | Force majeure semantic | ✓ | ✓ | ✓ | 3 |
| 7 | Bug #11 | Tax clause rewrite | ✓ | ✓ | ✓ | 3 |
| 8 | Bug #12 | Bỏ đoạn dispute lặp | ✓ | ✓ | ✓ | 3 |
| | | **Per template** | **8** | **7** | **6** | **21** |

### 3.2. Chi tiết 7 bug + wording fix (PAUSE-65-01 APPROVE ALL)

#### **Bug #3 — Typo "Q11)"** (operations + racekit)

- **Hiện trạng (raw text in DOCX):**
  `Căn cứ Luật Thể dục, thể thao số 77/2006/QH11) ngày 29/11/2006 của Quốc hội`
- **Fix:** Drop dấu `)` thừa sau `QH11`.
- **Sau khi fix:**
  `Căn cứ Luật Thể dục, thể thao số 77/2006/QH11 ngày 29/11/2006 của Quốc hội`
- **Find anchor (unique):** `77/2006/QH11) ngày 29/11/2006`
- **Replace with:** `77/2006/QH11 ngày 29/11/2006`
- **Áp dụng:** contract-operations.docx, contract-racekit.docx
- **KHÔNG áp dụng:** contract-timing.docx (đã đúng — pre-flight confirm)

#### **Bug #6 — Viện dẫn SAI "Điều 4 của Hợp đồng"** (operations only)

- **Hiện trạng:**
  `Thanh toán đầy đủ và đúng hạn cho Bên B theo Điều 4 của Hợp đồng`
- **Vấn đề:** Điều 4 trong contract-operations là "Quyền và nghĩa vụ" → SAI. Điều quy định payment terms là **Điều 3** (Thanh toán).
- **Fix wording (Manager APPROVE):**
  `Thanh toán đầy đủ và đúng hạn cho Bên B theo Điều 3 của Hợp đồng`
- **Find anchor:** `theo Điều 4 của Hợp đồng Cung cấp tất cả các thông tin`
- **Replace with:** `theo Điều 3 của Hợp đồng Cung cấp tất cả các thông tin`
  (giữ context anchor để tránh nhầm với match khác)
- **Áp dụng:** contract-operations.docx (only)

#### **Bug #7 — Viện dẫn SAI "quy định tại Điều 7"** (all 3)

- **Hiện trạng:**
  `bên vi phạm sẽ bị xử lý theo quy định tại Điều 7;`
- **Vấn đề:** Điều 7 (cả 3 template) là "Chấm dứt hợp đồng" → không có penalty. Penalty quy định tại **Điều 8** ("Vi phạm và bồi thường").
- **Fix wording:**
  `bên vi phạm sẽ bị xử lý theo quy định tại Điều 8`
- **Find anchor:** `bị xử lý theo quy định tại Điều 7;`
- **Replace with:** `bị xử lý theo quy định tại Điều 8;`
- **Áp dụng:** cả 3 template

#### **Bug #8 — Viện dẫn SAI "chịu phạt giống điều 5"** (all 3)

- **Hiện trạng:**
  `(Trừ trường hợp đơn phương chấm dứt hợp đồng thì chịu phạt giống điều 5)`
- **Vấn đề:** Điều 5 là "Bảo mật thông tin" → không có penalty. Penalty đơn phương chấm dứt nằm tại **Điều 6** ("Đơn phương chấm dứt").
- **Fix wording (Manager APPROVE — chú ý đổi cả từ "giống" → "áp dụng theo quy định tại" để rõ ràng hơn):**
  `(Trừ trường hợp đơn phương chấm dứt hợp đồng thì áp dụng theo quy định tại Điều 6)`
- **Find anchor:** `chịu phạt giống điều 5)`
- **Replace with:** `áp dụng theo quy định tại Điều 6)`
- **Áp dụng:** cả 3 template

#### **Bug #9 — "lãi suất bằng quy định tại Điều 5" → Generic** (all 3)

- **Hiện trạng:**
  `Bên có nghĩa vụ thanh toán thêm tiền lãi suất chậm trả tương ứng với thời gian chậm nộp với lãi suất bằng quy định tại Điều 5.`
- **Vấn đề:** Điều 5 ("Bảo mật") không quy định lãi suất. Không có article nào trong template hiện tại quy định mức lãi suất chậm trả cụ thể.
- **Quyết định PAUSE-65-02:** Dùng Generic — viện dẫn "*theo quy định pháp luật hiện hành*" (Bộ luật Dân sự 2015 Art. 357, 468 + Luật Thương mại 2005 Art. 306). KHÔNG cố nhét article mới.
- **Fix wording (Manager APPROVE):**
  `Bên có nghĩa vụ thanh toán thêm tiền lãi suất chậm trả tương ứng với thời gian chậm nộp theo quy định pháp luật hiện hành.`
- **Find anchor:** `với lãi suất bằng quy định tại Điều 5.`
- **Replace with:** `theo quy định pháp luật hiện hành.`
  (lưu ý: anchor sẽ cắt cụm "với lãi suất bằng" — câu sau fix vẫn đầy đủ ý vì cụm "tiền lãi suất chậm trả tương ứng với thời gian chậm nộp" đã có chữ "lãi suất" rồi)
- **Áp dụng:** cả 3 template

#### **Bug #10 — Force majeure semantic "Bên tác động trở"** (all 3)

- **Hiện trạng (semantic mơ hồ, lỗi chính tả "trở"):**
  `Sự kiện bất khả kháng tác động lên một trong hai Bên hoặc cả hai Bên thì các nghĩa vụ của Bên tác động trở sẽ bị tạm ngừng thực hiện vụ mà không bị coi là vi phạm Hợp đồng này.`
- **Vấn đề:**
  - "Bên tác động trở" không rõ là Bên nào (chủ ngữ mơ hồ, lỗi chính tả — có thể là "trở thành" hoặc "trợ" — tất cả đều SAI).
  - "thực hiện vụ" thiếu từ → lỗi cú pháp.
- **Fix wording (Manager APPROVE — rewrite hoàn toàn cho rõ nghĩa):**
  `Khi sự kiện bất khả kháng tác động đến một trong hai Bên hoặc cả hai Bên, việc thực hiện các nghĩa vụ bị ảnh hưởng sẽ được tạm ngừng trong thời gian xảy ra sự kiện bất khả kháng và không bị coi là vi phạm Hợp đồng này.`
- **Find anchor (toàn bộ câu):**
  `Sự kiện bất khả kháng tác động lên một trong hai Bên hoặc cả hai Bên thì các nghĩa vụ của Bên tác động trở sẽ bị tạm ngừng thực hiện vụ mà không bị coi là vi phạm Hợp đồng này.`
- **Replace with (toàn bộ câu):**
  `Khi sự kiện bất khả kháng tác động đến một trong hai Bên hoặc cả hai Bên, việc thực hiện các nghĩa vụ bị ảnh hưởng sẽ được tạm ngừng trong thời gian xảy ra sự kiện bất khả kháng và không bị coi là vi phạm Hợp đồng này.`
- **Áp dụng:** cả 3 template

#### **Bug #11 — Tax clause rewrite** (all 3)

- **Hiện trạng (cụm "Bên B thanh toán cho Bên A" trùng + ngôn ngữ pháp lý không chuẩn):**
  `Mỗi Bên chịu trách nhiệm thanh toán nghĩa vụ thuế của mỗi bên phát sinh từ giao dịch theo Hợp đồng này. Nếu có bất kỳ khoản thuế nào thuộc nghĩa vụ của Bên A mà Bên B có trách nhiệm khấu trừ và nộp hộ theo pháp luật Việt Nam thì Bên B phải tính và khấu trừ, nộp hộ cho Bên A theo đúng quy định của pháp luật. Và khoản tiền này được khấu trừ vào khoản tiền Bên B thanh toán cho Bên A.`
- **Vấn đề:**
  - "Mỗi Bên chịu trách nhiệm thanh toán nghĩa vụ thuế" — thuế không "thanh toán" mà "thực hiện nghĩa vụ kê khai/nộp" → ngôn ngữ tax non-standard.
  - "thuộc nghĩa vụ của Bên A mà Bên B có trách nhiệm khấu trừ" — hard-code A/B → áp đặt 1 chiều, nhưng trong thực tế dòng tiền có thể đi 2 chiều (sponsor-fee Bên A trả Bên B, refund Bên B trả Bên A, tax rebate, etc.) → quy tắc generic 2 chiều an toàn hơn.
  - Câu cuối "khoản tiền này được khấu trừ vào khoản tiền Bên B thanh toán cho Bên A" lặp ý "khấu trừ" → redundant + sai logic dòng tiền nếu Bên A là payer.
- **Fix wording (Manager APPROVE — rewrite toàn bộ block):**
  `Mỗi Bên chịu trách nhiệm thực hiện các nghĩa vụ thuế của mình phát sinh từ giao dịch theo Hợp đồng này theo quy định pháp luật. Trường hợp pháp luật quy định một Bên có nghĩa vụ khấu trừ, kê khai, nộp thay bất kỳ khoản thuế nào liên quan đến khoản thanh toán theo Hợp đồng này, Bên đó sẽ thực hiện theo đúng quy định pháp luật và thông báo cho Bên còn lại.`
- **Find anchor (toàn bộ 3 câu liền nhau):**
  `Mỗi Bên chịu trách nhiệm thanh toán nghĩa vụ thuế của mỗi bên phát sinh từ giao dịch theo Hợp đồng này. Nếu có bất kỳ khoản thuế nào thuộc nghĩa vụ của Bên A mà Bên B có trách nhiệm khấu trừ và nộp hộ theo pháp luật Việt Nam thì Bên B phải tính và khấu trừ, nộp hộ cho Bên A theo đúng quy định của pháp luật. Và khoản tiền này được khấu trừ vào khoản tiền Bên B thanh toán cho Bên A.`
- **Replace with (toàn bộ block):**
  `Mỗi Bên chịu trách nhiệm thực hiện các nghĩa vụ thuế của mình phát sinh từ giao dịch theo Hợp đồng này theo quy định pháp luật. Trường hợp pháp luật quy định một Bên có nghĩa vụ khấu trừ, kê khai, nộp thay bất kỳ khoản thuế nào liên quan đến khoản thanh toán theo Hợp đồng này, Bên đó sẽ thực hiện theo đúng quy định pháp luật và thông báo cho Bên còn lại.`
- **Áp dụng:** cả 3 template

#### **Bug #12 — Bỏ đoạn dispute lặp ("Điều 11.5")** (all 3)

- **Hiện trạng (đoạn dispute resolution lặp trong ĐIỀU KHOẢN CHUNG, đã có ở Section dispute trước đó):**
  `Bất kỳ tranh chấp nào phát sinh từ hoặc liên quan đến Hợp Đồng này trước tiên sẽ giải quyết thông qua thương lượng và hòa giải giữa Các Bên. Trong trường hợp giữa Các Bên có tranh chấp mà không thể giải quyết bằng thương lượng và hòa giải thì mọi tranh chấp phát sinh từ hoặc liên quan đến Hợp Đồng này sẽ được giải quyết tại Tòa án Nhân dân có thẩm quyền của Việt Nam.`
- **Vấn đề:** Section trước đó (mục "Giải quyết tranh chấp") đã có nội dung hoàn chỉnh:
  `Trong quá trình thực hiện Hợp đồng này, nếu có bất kỳ tranh chấp, mâu thuẫn nào phát sinh từ hoặc liên quan đến Hợp đồng, Các Bên trước hết sẽ nỗ lực cùng nhau thương lượng… vụ việc, tranh chấp sẽ được giải quyết tại Tòa án nhân dân có thẩm quyền theo quy định của pháp luật.`
  → Đoạn ở ĐIỀU KHOẢN CHUNG **lặp y nguyên ý**, vừa redundant vừa gây mâu thuẫn tiềm năng nếu sau này 1 trong 2 đoạn được edit không đồng bộ.
- **Quyết định PAUSE-65-03:** Xoá hoàn toàn đoạn dispute lặp trong ĐIỀU KHOẢN CHUNG.
- **Find anchor (toàn bộ 2 câu lặp):**
  `Bất kỳ tranh chấp nào phát sinh từ hoặc liên quan đến Hợp Đồng này trước tiên sẽ giải quyết thông qua thương lượng và hòa giải giữa Các Bên. Trong trường hợp giữa Các Bên có tranh chấp mà không thể giải quyết bằng thương lượng và hòa giải thì mọi tranh chấp phát sinh từ hoặc liên quan đến Hợp Đồng này sẽ được giải quyết tại Tòa án Nhân dân có thẩm quyền của Việt Nam.`
- **Replace with:** chuỗi rỗng `` (xoá hoàn toàn).
- **Lưu ý format:** sau khi remove, paragraph trước/sau cần giữ nguyên format. Approach DOCX edit: tìm `<w:p>…đoạn lặp…</w:p>` (nếu cả block nằm trong 1 paragraph), remove cả `<w:p>` wrapper để không để lại empty para. Nếu nằm trong block lớn hơn, chỉ remove text run + giữ paragraph wrapper.
- **Áp dụng:** cả 3 template

### 3.3. IN SCOPE — Group B: Acceptance templates

**EMPTY** sau pre-flight audit (Section 0). Không có edit nào trên 3 acceptance templates.

### 3.4. IN SCOPE — Group C: Audit script extend

Thêm test file mới `audit-script.f065.spec.ts` theo pattern F-044/F-045 (REUSE inline regex approach, không subprocess):

- 7 forbidden pattern (chính các cụm SAI mà F-065 fix):
  - `/Q11\)/` (typo)
  - `/theo Điều 4 của Hợp đồng/`
  - `/quy định tại Điều 7/`
  - `/chịu phạt giống điều 5/`
  - `/lãi suất bằng quy định tại Điều 5/`
  - `/Bên tác động trở/`
  - `/Bên B thanh toán cho Bên A/` (trong context tax clause)
- Verify cả **6 template** (3 contract + 3 acceptance) phải PASS post-fix (0 match cho từng pattern).
- File path: `/Users/dannynguyen/Desktop/Claude/5bib-result/backend/src/modules/contracts/services/audit-script.f065.spec.ts`

### 3.5. IN SCOPE — Group D: Tests

Xem chi tiết Section 7 (Test Cases).

### 3.6. OUT OF SCOPE

- ❌ KHÔNG migrate historical contracts đã ký (PAUSE-65-04 forward-only).
- ❌ KHÔNG đụng hardcoded date/location → F-064 đã sửa, KHÔNG re-touch.
- ❌ KHÔNG đụng contract number format → F-066 sẽ refactor riêng.
- ❌ KHÔNG đụng auto-regen on template change → F-067.
- ❌ KHÔNG đụng `contract-ticket-sales.docx` (audit confirm sạch).
- ❌ KHÔNG đụng `acceptance-*.docx` × 3 (audit confirm sạch).
- ❌ KHÔNG thêm article mới (bug #9 dùng generic "*theo quy định pháp luật hiện hành*" để tránh phải thêm article).
- ❌ KHÔNG đổi numbering hệ thống điều khoản (giữ nguyên Điều 1-10/11, chỉ sửa viện dẫn).
- ❌ KHÔNG đổi font, layout, format DOCX (chỉ raw text replace).

---

## 4. Yêu cầu chức năng (Functional Requirements)

### FR-65-1 — Template DOCX text correctness post-fix

Sau khi F-065 deploy, render thử HĐ test với context giả lập (race demo, merchant demo) cho cả 3 template:

1. **KHÔNG còn** 7 forbidden patterns trong output `.docx` rendered (verify bằng `unzip → grep`).
2. **CÓ** 7 fixed patterns mới (Section 3.2 wording APPROVED).
3. Format DOCX (font, bold, indent, list) giữ nguyên 100% so với pre-fix (compare visual diff).
4. Render time per contract ≤ 5s (BR-CM-04 from F-024 baseline — KHÔNG regress).

### FR-65-2 — Audit grep test pass

`audit-script.f065.spec.ts` (NEW) PASS với 0 forbidden pattern match trên cả 6 template (3 contract + 3 acceptance) sau fix.

### FR-65-3 — Regression existing audit scripts

`audit-script.f044.spec.ts` + `audit-script.f045.spec.ts` (EXISTING) vẫn PASS 100% — F-065 KHÔNG được làm gãy F-044/F-045 leak guards.

### FR-65-4 — Forward-only deployment

- F-065 chỉ áp dụng từ deploy time. HĐ đã ký + đã render PDF lưu trong S3 (`contracts/{contractId}/...`) KHÔNG bị touch (PAUSE-65-04).
- KHÔNG có cron migration historical, KHÔNG có script auto-regen historical.
- KHÔNG cần data migration MongoDB.

### FR-65-5 — Admin UI signal (optional UX hint)

Admin Contract list UI hiển thị **thông tin version template** (nếu chưa có): cột "Template version" / tooltip ngày generate template. Mục đích: BTC kế toán xem được HĐ historical generated trước F-065 → biết là có thể có bug viện dẫn → tự quyết định re-print hay không. **Quyết định:** OPTIONAL — Coder evaluate effort, nếu < 2h thì làm, không thì defer sang F-068.

---

## 5. Yêu cầu phi chức năng (Non-Functional)

### NFR-65-1 — Performance
- Render contract: ≤ 5s per contract (baseline F-024 BR-CM-04).
- Template file size: ≤ 200KB (`contract-operations.docx` hiện ~80KB → fix raw text KHÔNG tăng > 5%).

### NFR-65-2 — Compatibility
- `docxtemplater` placeholder syntax KHÔNG bị break: tất cả `{contractNumber}`, `{client.taxId}`, `{provider.bankAccount}`, `{#lineItems}…{/lineItems}` MUST render OK sau fix.
- Verify bằng test: render 1 contract đầy đủ context, parse output PDF, check 100% placeholder filled.

### NFR-65-3 — Reversibility
- Backup template gốc pre-F-065 vào `backend/assets/contract-templates/backups/legacy-pre-f065/{filename}.docx.bak` trước khi commit fix (Pattern Manager F-024 UX-39 v3 backup).
- Lý do: dễ rollback manual nếu Legal yêu cầu rollback.

### NFR-65-4 — Quality
- 21 text edit cần verify từng cái bằng visual diff (DOCX → render PDF → so sánh pre/post).
- 0 typo mới phát sinh từ edit (QC review chéo trước merge).

### NFR-65-5 — Audit trail
- Commit message ghi rõ: `fix(F-065): legal text correctness — 7 bugs × 3 templates (21 edits) + audit script extend`.
- File `04-qc-report.md` (do QC viết) ghi list 21 edit với before/after wording đầy đủ.

---

## 6. Kỹ thuật & Implementation Guidance

### 6.1. DOCX XML edit approach

**Recommendation:** Dùng Python `python-docx` hoặc Node `docx` library hoặc raw `pizzip` + regex text replace TRONG `word/document.xml`.

**Approach an toàn nhất cho 5BIB:** Dùng `pizzip` (đã có sẵn trong backend cho docxtemplater), Coder viết 1 script `scripts/fix-f065-templates.ts`:

```typescript
// scripts/fix-f065-templates.ts (illustrative skeleton)
import * as fs from 'fs';
import * as path from 'path';
const PizZip = require('pizzip');

const TEMPLATES_DIR = path.join(__dirname, '..', 'assets', 'contract-templates');
const BACKUP_DIR = path.join(TEMPLATES_DIR, 'backups', 'legacy-pre-f065');

interface Edit {
  find: string;
  replace: string;
  templates: string[]; // which templates apply
  bugId: string;
}

const EDITS: Edit[] = [
  // Bug #3
  { bugId: 'F065-B3', find: '77/2006/QH11)', replace: '77/2006/QH11', templates: ['contract-operations.docx', 'contract-racekit.docx'] },
  // Bug #6 (operations only)
  { bugId: 'F065-B6', find: 'theo Điều 4 của Hợp đồng Cung cấp', replace: 'theo Điều 3 của Hợp đồng Cung cấp', templates: ['contract-operations.docx'] },
  // Bug #7
  { bugId: 'F065-B7', find: 'bị xử lý theo quy định tại Điều 7;', replace: 'bị xử lý theo quy định tại Điều 8;', templates: ['contract-operations.docx', 'contract-racekit.docx', 'contract-timing.docx'] },
  // Bug #8
  { bugId: 'F065-B8', find: 'chịu phạt giống điều 5)', replace: 'áp dụng theo quy định tại Điều 6)', templates: ['contract-operations.docx', 'contract-racekit.docx', 'contract-timing.docx'] },
  // Bug #9
  { bugId: 'F065-B9', find: 'với lãi suất bằng quy định tại Điều 5.', replace: 'theo quy định pháp luật hiện hành.', templates: [...] },
  // Bug #10 — full sentence rewrite
  { bugId: 'F065-B10', find: 'Sự kiện bất khả kháng tác động lên một trong hai Bên hoặc cả hai Bên thì các nghĩa vụ của Bên tác động trở sẽ bị tạm ngừng thực hiện vụ mà không bị coi là vi phạm Hợp đồng này.', replace: 'Khi sự kiện bất khả kháng tác động đến một trong hai Bên hoặc cả hai Bên, việc thực hiện các nghĩa vụ bị ảnh hưởng sẽ được tạm ngừng trong thời gian xảy ra sự kiện bất khả kháng và không bị coi là vi phạm Hợp đồng này.', templates: [...] },
  // Bug #11 — full tax block rewrite
  { bugId: 'F065-B11', find: 'Mỗi Bên chịu trách nhiệm thanh toán nghĩa vụ thuế của mỗi bên phát sinh từ giao dịch theo Hợp đồng này. Nếu có bất kỳ khoản thuế nào thuộc nghĩa vụ của Bên A mà Bên B có trách nhiệm khấu trừ và nộp hộ theo pháp luật Việt Nam thì Bên B phải tính và khấu trừ, nộp hộ cho Bên A theo đúng quy định của pháp luật. Và khoản tiền này được khấu trừ vào khoản tiền Bên B thanh toán cho Bên A.', replace: 'Mỗi Bên chịu trách nhiệm thực hiện các nghĩa vụ thuế của mình phát sinh từ giao dịch theo Hợp đồng này theo quy định pháp luật. Trường hợp pháp luật quy định một Bên có nghĩa vụ khấu trừ, kê khai, nộp thay bất kỳ khoản thuế nào liên quan đến khoản thanh toán theo Hợp đồng này, Bên đó sẽ thực hiện theo đúng quy định pháp luật và thông báo cho Bên còn lại.', templates: [...] },
  // Bug #12 — delete duplicate dispute block
  { bugId: 'F065-B12', find: 'Bất kỳ tranh chấp nào phát sinh từ hoặc liên quan đến Hợp Đồng này trước tiên sẽ giải quyết thông qua thương lượng và hòa giải giữa Các Bên. Trong trường hợp giữa Các Bên có tranh chấp mà không thể giải quyết bằng thương lượng và hòa giải thì mọi tranh chấp phát sinh từ hoặc liên quan đến Hợp Đồng này sẽ được giải quyết tại Tòa án Nhân dân có thẩm quyền của Việt Nam.', replace: '', templates: [...] },
];

async function main() {
  // 1. Backup originals to BACKUP_DIR
  // 2. For each template, for each applicable edit: load DOCX, get word/document.xml as string, run .replace(find, replace), save back into ZIP
  // 3. Write fixed DOCX back to TEMPLATES_DIR
  // 4. Log every edit applied + verify post-condition (find still NOT present)
}
```

**KEY ATTENTION:** DOCX text trong XML có thể bị split qua nhiều `<w:t>` runs (do Word save autocomplete). Nếu `find` không match được → cần normalize XML trước replace bằng cách concat consecutive `<w:t>` runs in cùng `<w:r>` HOẶC dùng Word document như-is bằng cách open trong LibreOffice/Word + save lại để clean up split runs trước khi edit.

**Khuyến nghị thực tế:** Trước khi viết script, Coder kiểm tra `word/document.xml` bằng `unzip -p contract-operations.docx word/document.xml | grep -o 'find_string'` cho từng anchor — nếu KHÔNG match → text bị split → cần normalize first (mở DOCX trong LibreOffice/Word, edit text trong app, save lại — LibreOffice sẽ auto-clean split runs).

### 6.2. File location

- Templates source: `/Users/dannynguyen/Desktop/Claude/5bib-result/backend/assets/contract-templates/`
  - `contract-operations.docx` (modify in-place)
  - `contract-racekit.docx` (modify in-place)
  - `contract-timing.docx` (modify in-place)
- Backup: `backend/assets/contract-templates/backups/legacy-pre-f065/`
  - `contract-operations.docx` (copy unchanged before edit)
  - `contract-racekit.docx`
  - `contract-timing.docx`
- New audit test: `backend/src/modules/contracts/services/audit-script.f065.spec.ts`
- Optional one-shot fix script: `backend/scripts/fix-f065-templates.ts` (KHÔNG ship to runtime, dev tool only — `.gitignore`? KHÔNG, commit để track edit log)

### 6.3. Pattern reuse (REUSE)

- **F-044/F-045 audit pattern:** REUSE 100% inline regex approach. NEW file `audit-script.f065.spec.ts` follow exact same structure: `TEMPLATES_DIR`, `extractAllText()`, `F065_LEAK_PATTERNS`, per-template iteration.
- **F-024 UX-39 v3 backup pattern:** REUSE backup-to-`backups/` subdirectory before destructive edit.
- **F-064 approach** (hardcoded date/location): SAME XML find-replace strategy, SAME `pizzip` lib.

### 6.4. Module impact

| Module | Impact | Reason |
|---|---|---|
| `backend/src/modules/contracts/services/contract-generation.service.ts` | NONE | Service đọc template từ assets, không hard-code text |
| `backend/src/modules/contracts/services/contract-template.service.ts` | NONE | Service quản lý template metadata, không liên quan text content |
| `backend/src/modules/contracts/services/audit-script.f0**.spec.ts` | NEW file f065 | Add F-065 leak guards |
| `backend/assets/contract-templates/contract-{ops,racekit,timing}.docx` | MODIFY in-place | Core fix |
| `backend/assets/contract-templates/backups/legacy-pre-f065/` | NEW directory | Reversibility |
| Frontend / Admin | NONE | KHÔNG có UI work (PRD trừ FR-65-5 optional) |
| Redis cache | NONE | KHÔNG có cache key cho contract template content |
| MongoDB | NONE | KHÔNG có data migration |

### 6.5. Deploy sequence

1. Coder: implement fix script + execute → 3 template fixed in-place.
2. Coder: run `pnpm test audit-script.f065.spec.ts` → PASS.
3. Coder: run `pnpm test audit-script.f044.spec.ts && pnpm test audit-script.f045.spec.ts` → PASS (regression).
4. Coder: render 3 test contracts (1 per template) qua API `POST /api/contracts/:id/generate` với fixture race + merchant → verify output không có 7 forbidden patterns + có 7 fixed wording.
5. Coder commit: `fix(F-065): legal text correctness — 7 bugs × 3 templates (21 edits) + audit script extend`.
6. Manager: review diff (`git diff` cả docx → unzip diff so sánh `word/document.xml`).
7. QC: run full regression (F-024 → F-042 → F-044 → F-045 → F-064 → F-065).
8. Danny: approve deploy.
9. Deploy DEV → smoke render contract → deploy PROD.

---

## 7. Test Cases (12+ TC)

### TC matrix overview

| TC ID | Bug ID | Type | Template | Mục tiêu |
|---|---|---|---|---|
| **TC-65-01** | B3 | Unit | operations | Verify `Q11)` removed, `Q11 ngày` correct |
| **TC-65-02** | B3 | Unit | racekit | Verify `Q11)` removed |
| **TC-65-03** | B6 | Unit | operations | Verify `Điều 4 → Điều 3` |
| **TC-65-04** | B7 | Unit | operations + racekit + timing | Verify `Điều 7 → Điều 8` cả 3 |
| **TC-65-05** | B8 | Unit | operations + racekit + timing | Verify `chịu phạt giống điều 5 → áp dụng theo quy định tại Điều 6` cả 3 |
| **TC-65-06** | B9 | Unit | all 3 | Verify generic lãi suất wording present, "Điều 5" lãi suất REMOVED |
| **TC-65-07** | B10 | Unit | all 3 | Verify force-majeure full sentence replaced |
| **TC-65-08** | B11 | Unit | all 3 | Verify tax clause rewritten |
| **TC-65-09** | B12 | Unit | all 3 | Verify duplicate dispute block REMOVED |
| **TC-65-10** | ALL | Integration | all 3 | E2E render contract → output `.docx` không có 7 forbidden patterns |
| **TC-65-11** | ALL | Audit script | 6 templates (3 ct + 3 acc) | `audit-script.f065.spec.ts` PASS |
| **TC-65-12** | ALL | Regression | all templates | F-044 + F-045 audit script PASS |
| **TC-65-13** | NFR | Performance | all 3 | Render time ≤ 5s per contract |
| **TC-65-14** | NFR | Compatibility | all 3 | All `docxtemplater` placeholders render OK (no `{...}` leftover) |
| **TC-65-15** | NFR | Visual diff | all 3 | Font/bold/indent format preserved pre-vs-post fix |

### TC-65-01 — Bug #3 fix on contract-operations.docx

**Steps:**
1. Read `backend/assets/contract-templates/contract-operations.docx` post-F065.
2. Extract `word/document.xml`, strip tags, normalize whitespace.
3. Assert string `77/2006/QH11)` NOT present.
4. Assert string `77/2006/QH11 ngày 29/11/2006` present.

**Expected:** Both assertions PASS.

### TC-65-02 — Bug #3 fix on contract-racekit.docx

Same as TC-65-01 with `contract-racekit.docx`.

### TC-65-03 — Bug #6 fix on contract-operations.docx

**Steps:**
1. Extract text.
2. Assert `theo Điều 4 của Hợp đồng Cung cấp` NOT present.
3. Assert `theo Điều 3 của Hợp đồng Cung cấp` present.

### TC-65-04 — Bug #7 fix on all 3 templates

Loop through 3 templates:
- Assert `quy định tại Điều 7` NOT present.
- Assert `quy định tại Điều 8` present (in context `bị xử lý theo quy định tại Điều 8`).

### TC-65-05 — Bug #8 fix on all 3 templates

Loop:
- Assert `chịu phạt giống điều 5` NOT present.
- Assert `áp dụng theo quy định tại Điều 6` present.

### TC-65-06 — Bug #9 fix on all 3 templates

Loop:
- Assert `với lãi suất bằng quy định tại Điều 5` NOT present.
- Assert `theo quy định pháp luật hiện hành` present (in context lãi suất chậm trả).

### TC-65-07 — Bug #10 force majeure fix on all 3

Loop:
- Assert `Bên tác động trở` NOT present.
- Assert `tạm ngừng trong thời gian xảy ra sự kiện bất khả kháng` present.

### TC-65-08 — Bug #11 tax clause fix on all 3

Loop:
- Assert `Bên B thanh toán cho Bên A` NOT present.
- Assert `Mỗi Bên chịu trách nhiệm thực hiện các nghĩa vụ thuế của mình` present.
- Assert `thông báo cho Bên còn lại` present.

### TC-65-09 — Bug #12 dispute duplicate removed

Loop:
- Assert text `Bất kỳ tranh chấp nào phát sinh từ hoặc liên quan đến Hợp Đồng này trước tiên sẽ giải quyết thông qua thương lượng và hòa giải giữa Các Bên` NOT present in ĐIỀU KHOẢN CHUNG section.
- Assert primary dispute section (`Trong quá trình thực hiện Hợp đồng này, nếu có bất kỳ tranh chấp`) STILL present (un-touched).
- Count occurrences of `Tòa án nhân dân` (lowercase + hoa) — pre-fix = 2, post-fix = 1.

### TC-65-10 — E2E render contract integration test

**Steps:**
1. Create fixture: race demo + merchant demo (full context with all `{contractNumber}`, `{client.*}`, `{provider.*}`, lineItems).
2. Call `ContractGenerationService.generateContract(...)` for each of 3 contract types.
3. Receive generated `.docx` buffer.
4. Unzip + extract text.
5. Assert 7 forbidden patterns NOT present.
6. Assert 7 fixed wording present.
7. Assert all `{placeholder}` substituted (no `{...}` remains).

### TC-65-11 — F-065 audit script PASS

Run `pnpm test backend/src/modules/contracts/services/audit-script.f065.spec.ts`. Assert: all 6 templates × 7 patterns = 42 assertions PASS.

### TC-65-12 — Regression F-044/F-045 audit script

Run both. Assert: PASS 100% — F-065 edit không introduce hardcoded financial/currency/CN leak.

### TC-65-13 — Render performance ≤ 5s

Benchmark `ContractGenerationService.generateContract()` × 10 runs per template type, P95 ≤ 5s.

### TC-65-14 — Placeholder compatibility

Render with full context. Run regex `/\{[^}]+\}/` over output text → assert match count == 0 (no leftover placeholder).

### TC-65-15 — Visual diff format preservation

Manual QC step (Manager + Danny):
1. Render 1 sample contract pre-F065 (from backup) + post-F065.
2. Open both in MS Word side-by-side.
3. Verify: font family, font size, bold/italic, paragraph spacing, list bullets, table layout → IDENTICAL except for 21 fixed text segments.

---

## 8. Risk Register & Mitigation

| Risk ID | Mô tả | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| R-65-1 | Text split qua nhiều `<w:t>` runs → find-replace không match anchor | HIGH | MEDIUM | Coder check `unzip -p ... \| grep` từng anchor trước khi script. Nếu mismatch → open DOCX trong LibreOffice + save lại để normalize runs trước khi edit. |
| R-65-2 | Edit phá format DOCX (mất bold, mất indent) | MEDIUM | LOW | Visual diff TC-65-15 + backup pre-F065 → rollback nếu cần |
| R-65-3 | Anchor `find` không unique → replace nhầm vị trí khác | MEDIUM | MEDIUM | Mỗi `find` PRD đã chọn anchor đủ dài + context xung quanh (ví dụ Bug #6 có chữ "Cung cấp" sau Điều 4 để unique). Coder verify count match == 1 trước replace. |
| R-65-4 | Historical contract PDF đã ký vẫn có bug | LOW | HIGH | PAUSE-65-04 forward-only đã accept. Admin UI tooltip FR-65-5 optional show version để BTC tự re-print nếu cần. |
| R-65-5 | Merchant đã print HĐ in giấy đem ký mà có bug | MEDIUM | MEDIUM | BA notify BTC Finance: HĐ ký từ deploy date trở đi mới có version mới. HĐ đang process mid-flight → BTC tự quyết ký bản cũ hay re-print bản mới. |
| R-65-6 | Bug #9 generic "theo quy định pháp luật hiện hành" bị Legal merchant push back | LOW | LOW | Đây là wording chuẩn dùng phổ biến trong HĐ thương mại VN. Nếu merchant push back → BA reply với reference Bộ luật Dân sự 2015 Art. 357, 468. |
| R-65-7 | Bug #12 xoá hoàn toàn block dispute → mất 1 đoạn dài → DOCX paragraph numbering shift | LOW | LOW | DOCX numbering nếu là auto-numbered list sẽ tự reflow. Nếu hardcoded "11.5" trong text khác → grep verify trước commit. |
| R-65-8 | F-066 (contract number refactor) chạy parallel → conflict edit | MEDIUM | MEDIUM | Coordinate sequencing: F-065 deploy TRƯỚC F-066. Nếu F-066 cũng đụng `word/document.xml`, F-066 base trên F-065. |

---

## 9. Acceptance Criteria & Deliverables

### Acceptance Criteria (chốt cho QC)

✅ **AC-65-1:** Cả 3 contract template (`contract-operations.docx`, `contract-racekit.docx`, `contract-timing.docx`) PASS audit `audit-script.f065.spec.ts` (0 forbidden pattern).

✅ **AC-65-2:** Cả 3 acceptance template (`acceptance-*.docx`) cũng PASS `audit-script.f065.spec.ts` (sanity — vốn đã sạch).

✅ **AC-65-3:** Audit script regression F-044 + F-045 PASS 100%.

✅ **AC-65-4:** E2E render contract test (TC-65-10) PASS với 0 placeholder leftover + 0 forbidden pattern + 7 fixed wording present.

✅ **AC-65-5:** Visual diff TC-65-15 confirm format preservation.

✅ **AC-65-6:** Backup files có trong `backups/legacy-pre-f065/` × 3 templates.

✅ **AC-65-7:** Commit message format + diff readable.

✅ **AC-65-8:** Performance NFR-65-1 PASS.

### Deliverables (handoff `/5bib-code`)

1. `backend/assets/contract-templates/contract-operations.docx` — MODIFIED (8 edits).
2. `backend/assets/contract-templates/contract-racekit.docx` — MODIFIED (7 edits).
3. `backend/assets/contract-templates/contract-timing.docx` — MODIFIED (6 edits).
4. `backend/assets/contract-templates/backups/legacy-pre-f065/` — NEW dir × 3 backup files.
5. `backend/src/modules/contracts/services/audit-script.f065.spec.ts` — NEW test file.
6. `backend/scripts/fix-f065-templates.ts` — NEW one-shot script (committed for audit trail).
7. `.5bib-workflow/features/FEATURE-065-contract-legal-text-correctness/03-coder-implementation.md` — handoff doc by Coder.
8. `.5bib-workflow/features/FEATURE-065-contract-legal-text-correctness/04-qc-report.md` — by QC after PASS.

---

## 10. Open Questions (none — all 5 PAUSE locked by Manager)

Không có open question. Tất cả 5 PAUSE đã được Danny APPROVE trong Manager init.

---

## 11. Tài liệu tham chiếu

- Manager init: `00-manager-init.md` (5 PAUSE locked)
- F-024 PRD/QC: contract generation baseline + S3 lifecycle rule 6 (5y retention)
- F-042 PRD/QC: financial calc bug fix
- F-044 PRD: text + hardcoded fix phase 2 + `audit-script.f044.spec.ts` pattern
- F-045 PRD: bank/provider legacy fix phase 3
- F-064 PRD: hardcoded date/location fix
- Bộ luật Dân sự 2015 (Luật số 91/2015/QH13) — Art. 357 (lãi suất chậm trả), Art. 468 (hợp đồng vay)
- Luật Thương mại 2005 — Art. 306 (lãi suất chậm thanh toán)
- Luật Quản lý thuế 38/2019/QH14 — Art. 41 (chứng từ kế toán 5 năm — đã ref trong F-024 S3 lifecycle rule 6)

---

**PRD F-065 SẴN SÀNG HANDOFF `/5bib-code`.**
Coder receive PRD này, implement theo Section 6 + 7, deliver theo Section 9.
