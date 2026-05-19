# FEATURE-044: Contract DOCX Phase 2 — Hardcoded TEXT Bug Fix + Filename Convention

**Status:** 🟡 INITIATED
**Created:** 2026-05-19
**Owner:** Danny
**Type:** BUGFIX (HIGH severity — legal/finance accuracy, follow-up F-042 incomplete fix)
**Created by:** 5bib-manager
**Branch:** `feat/F-044-contract-docx-phase-2` (from origin/main `bd73ad3`)

---

## 🎯 Why this feature

Danny report 2026-05-19: contract DOCX gen vẫn còn lỗi sau F-042 ship (release/v1.8.7 2026-05-18). 3 bugs:

1. **Contract number hardcoded SAI** — DOCX hiển thị sample race number thay vì DB contract value
2. **"Bằng chữ" (VN amount in words) hardcoded SAI** — DOCX hiển thị sample text thay vì computed from totalAmount
3. **File naming convention SAI** — Current: ID-based; Expected: `[Mã hợp đồng] - [Tên sự kiện]`

### Reproduction case verified by Manager spot-check 2026-05-19

**Contract:** `https://admin.5bib.com/contracts/6a0bcab66042f47bde4eb9d7`
- **DB contractNumber:** `10.05/2026/HDDV/CTTFA-5BIB-6` (correct)
- **DOCX BBNT hiển thị:** `10.04/2026/HĐDV/TAM-5BIB` (SAI ❌ — matches `acceptance-racekit.docx` hardcoded sample exactly)
- **DOCX Hợp đồng hiển thị:** `10.04/2026/HĐDV/TAM-5BIB` (SAI ❌ — matches `contract-racekit.docx` hardcoded)

Danny attached 2 files confirming:
- `Hợp đồng-6a0bcab66042f47bde4eb9d7 (1).docx`
- `Biên bản nghiệm thu-6a0bcab66042f47bde4eb9d7.docx`

### Business impact

🔴 **HIGH severity:**
- Legal risk: contracts gửi merchant với số hợp đồng SAI → invalid evidence trong dispute
- Vi phạm Luật quản lý thuế 38/2019 (BBNT là chứng từ pháp lý)
- Same risk class as F-042 (financial) but TEXT-based — F-042 fix MISSED this scope
- Affected scope: tất cả RACEKIT contracts đã ship (+ potentially TICKET_SALES với hardcoded HDDV) + acceptance-timing + acceptance-operations (BBNT "Bằng chữ" sai)

---

## 📂 Impact Map (theo memory + spot-check 2026-05-19)

### F-042 missed bugs CONFIRMED inventory

**3.A — Hardcoded contract number TEXT trong 3 templates:**

| Template | Hardcoded value | Occurrences |
|----------|-----------------|-------------|
| `contract-racekit.docx` | `10.04/2026/HĐDV/TAM-5BIB` | 1 |
| `acceptance-racekit.docx` | `10.04/2026/HĐDV/TAM-5BIB` | 4 (Coder ordinal grep) |
| `contract-ticket-sales.docx` | `HDDV` text fragment | 1 |

→ Replace với `{contractNumber}` placeholder. `contract-timing.docx` + `acceptance-timing.docx` + 3 OPERATIONS templates đã có `{contractNumber}` correctly (verified).

**3.B — Hardcoded "Bằng chữ" VN amount-in-words trong 5 templates:**

| Template | Hardcoded sample value (= old hardcoded numeric) | Occurrences | Should be |
|----------|--------------------------------------------------|-------------|-----------|
| `contract-racekit.docx` | `Ba mươi sáu triệu một trăm tám mươi nghìn đồng` (= 36.180.000) | 1 | `{totalAmountInWords}` |
| `contract-operations.docx` | `Hai trăm sáu mươi tư triệu tám trăm tám tám ngàn ba trăm sáu mươi đồng` (= 264.888.360) | 1 | `{totalAmountInWords}` |
| `acceptance-timing.docx` | `Tám mươi lăm triệu bốn trăm hai mươi chín ngàn không trăm tám mươi đồng` (= 85.429.080 remainingBalance sample) | 3 | TBD per occurrence position — `{actualTotalWithVatInWords}` OR `{remainingBalanceInWords}` (NEW helper needed?) |
| `acceptance-racekit.docx` | `Ba mươi sáu triệu...` + `Mười tám triệu không trăm chín mươi ngàn` (= 36.180.000 + 18.090.000) | 3+3 | TBD per position |
| `acceptance-operations.docx` | `Một trăm ba mươi ba triệu không trăm ba tám ngàn một trăm tám mươi đồng` (= 133.038.180 remainingBalance) | 3 | TBD per position |

→ Need extend `buildRenderContext()` flatten F-042 với NEW helpers: `actualTotalWithVatInWords` (already added), `remainingBalanceInWords` (NEW), `advancePaidInWords` (NEW), `actualSubtotalInWords` (NEW). Plus `subtotalInWords` (NEW for contract templates).

**3.C — File naming convention bug:**

- Util `backend/src/modules/contracts/utils/build-filename.ts` EXISTS với pattern `[Provider] [Partner] - [DocType] [Service] - [DD.MM.YYYY].ext`
- Called from `contracts.service.ts:1448 downloadDocument()` correctly
- **BUT:** Admin frontend may use signed S3 URL directly via `getDownloadUrl()` line 1462 → bypasses Content-Disposition → filename = raw S3 key (ID-based)
- **Plus:** Danny wants DIFFERENT pattern `[Mã hợp đồng] - [Tên sự kiện].docx` — KHÔNG match existing F-024 pattern
- Need clarify with BA: change pattern entirely OR keep F-024 + ensure admin always uses download endpoint not signed URL

### Module sẽ chạm

**Backend (`backend/src/modules/contracts/`):**

1. **6 DOCX templates** (asset binary):
   - `assets/contract-templates/contract-racekit.docx` — Replace 1 hardcoded contract number + 1 in-words string
   - `assets/contract-templates/contract-operations.docx` — Replace 1 in-words string
   - `assets/contract-templates/contract-ticket-sales.docx` — Replace `HDDV` fragment + verify all placeholders present
   - `assets/contract-templates/acceptance-racekit.docx` — Replace 4 contract numbers + 6 in-words (3+3)
   - `assets/contract-templates/acceptance-timing.docx` — Replace 3 in-words (remainingBalance sample)
   - `assets/contract-templates/acceptance-operations.docx` — Replace 3 in-words (remainingBalance sample)
   - **NO change** `contract-timing.docx`, `payment-request.docx`, `quotation.xlsx` (verified clean from F-042 audit)

2. **`services/contracts.service.ts:1265-1300`** — Extend F-042 flatten với additional in-words helpers:
   - `subtotalInWords` (cho contract-* templates Bằng chữ subtotal — if applicable)
   - `actualSubtotalInWords` (BBNT footer Bằng chữ subtotal)
   - `actualVatAmountInWords` (BBNT footer Bằng chữ VAT — if needed)
   - `advancePaidInWords` (BBNT tạm ứng Bằng chữ)
   - `remainingBalanceInWords` (BBNT còn lại Bằng chữ — currently hardcoded sample 85.429.080 in acceptance-timing)
   - Reuse existing `vndAmountInWords()` helper from `utils/vn-num-to-words.ts`

3. **`utils/build-filename.ts`** — Conditional based on PAUSE-44-04 BA decision:
   - Option A: Update pattern to `[Mã HĐ] - [Tên sự kiện].ext` per Danny request (breaking change F-024)
   - Option B: Keep F-024 pattern + ensure admin frontend always uses backend download endpoint
   - Option C: Add NEW alternative function `buildShortFilename({contractNumber, raceName, format})` + admin chooses

4. **Admin frontend (`admin/src/app/(dashboard)/contracts/`):**
   - Verify download button uses backend `/download/:s3Key` endpoint NOT direct S3 signed URL → Content-Disposition filename respected
   - If currently using `getDownloadUrl()` → switch to fetch via backend endpoint

5. **NEW audit script extension** (TD-F042 fix):
   - `backend/scripts/audit-template-placeholders.ts` — Extend regex to ALSO detect:
     - Contract number pattern `\d{2}\.\d{2}/\d{4}/H[DĐ]+V?/`
     - VN amount-in-words pattern `(Một|Hai|Ba|Bốn|Năm|Sáu|Bảy|Tám|Chín)\s+(trăm|mươi|triệu|tỷ)\s+`
   - Add to BR-44-07 zero-hardcoded verification gate

### File then chốt Coder đọc trước khi code

- `backend/assets/contract-templates/contract-racekit.docx` + 5 sibling templates (extract via Python pizzip per F-042 pattern)
- `backend/src/modules/contracts/services/contracts.service.ts:1265-1300` — F-042 flatten block (extend)
- `backend/src/modules/contracts/utils/vn-num-to-words.ts` — `vndAmountInWords()` existing helper
- `backend/src/modules/contracts/utils/build-filename.ts` — current naming pattern (verify caller path)
- `backend/src/modules/contracts/services/contracts.service.ts:1426-1459 downloadDocument()` — current naming flow
- `admin/src/app/(dashboard)/contracts/_components/` — find download button + download URL logic
- F-042 fix script template `/tmp/docx-extract/fix_templates.py` (extend pattern for new replacements)

### Endpoint liên quan

- NO new endpoint
- **EXISTING modify:** `POST /api/contracts/:id/generate-document` — flatten context includes new *InWords keys
- **EXISTING modify:** `GET /api/contracts/:id/documents/:s3Key/download` — verify filename respected (PAUSE-44-04 dependent)

### Schema/DB

- ❌ KHÔNG đụng MongoDB schema
- ❌ KHÔNG đụng MySQL platform
- ❌ KHÔNG đụng Redis
- ✅ DOCX templates binary: 6 files modify + 6 backup → `.backup/<type>-20260519-pre-f044.docx` per existing BACKUP_DIRNAME pattern
- ✅ AWS S3: New DOCX files upload (old wrong DOCX preserved via lifecycle rule 5y retention)

---

## ⚠️ Risk Flags

> Cross-reference với `known-issues.md`:

- 🔴 **HIGH severity LEGAL/FINANCE** — Same risk class F-042. Contracts đã ship với wrong text identifier → legal/financial dispute exposure ongoing.
- 🔴 **HIGH F-042 audit script gap** — Existing `audit-template-placeholders.ts` reports "Hardcoded leaks: NONE" but missed contract number + in-words text patterns. Future template fixes must extend audit pattern.
- 🟡 **MED filename convention change** — Danny's pattern `[Mã HĐ] - [Tên sự kiện]` differs from F-024 existing pattern. Breaking change OR additive — PAUSE-44-04 BA confirm.
- 🟡 **MED `buildDocumentFilename` may not be reached** — Admin may use signed S3 URL bypass. Need spot-check admin frontend before fixing.
- 🟡 **MED audit + regenerate batch** — F-042 audit + regen scripts pattern reusable for F-044. May need extend báo cáo blast radius cho both numeric + text bug class.
- 🟢 **LOW backend service code** — Flatten extension ~20 LoC. Template edit XML manipulation pattern reuse F-042 exactly.
- 🟢 **LOW rollback** — `.backup/` restore + revert template commits.

### Known issues impact

- **TD-F042-MULTI-VIEWER-VERIFY-DEFERRED** — F-044 inherits multi-viewer manual verify deferred. Recommend same pragmatic approach.
- **TD-F042-TEMPLATE-PLACEHOLDER-STATIC-AUDIT** — F-024 audit script CONTEXT_KEYS stale + regex incomplete. F-044 RESOLVES (extend regex) — close TD.
- **TD-F042-COMM-STRATEGY-PHASE2** (HIGH business priority) — Danny + Finance team still need decide re-send DOCX strategy. F-044 adds MORE affected contracts to communication scope.
- **TD-F042-1000-ITEMS-STRETCH-TEST** — F-044 KHÔNG add LineItem-level processing → inherits but doesn't worsen.

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

> Manager liệt kê 7 PAUSE-44-* conditions. BA phải trả lời TỪNG cái trong `01-ba-prd.md`.

- [ ] **PAUSE-44-01 (in-words helper scope):** Cần helper Bằng chữ cho field nào?
   - `subtotalInWords` (cho contract Phụ lục 01 "Tổng tiền chưa VAT bằng chữ"? — verify if template needs)
   - `actualSubtotalInWords` ✅ definitely BBNT
   - `actualVatAmountInWords` — typically not displayed Bằng chữ in VN BBNT
   - `advancePaidInWords` ✅ BBNT tạm ứng
   - `remainingBalanceInWords` ✅ BBNT còn lại (currently hardcoded `Tám mươi lăm triệu...` SAI)
   - Manager đề xuất: Add ALL 4 in-words helpers (extend F-042 flatten block ~20 LoC) — cover toàn diện.

- [ ] **PAUSE-44-02 (acceptance-racekit BBNT semantic mapping):** acceptance-racekit có:
   - Section 3.1 "Giá trị hợp đồng là 36.180.000 (Bằng chữ: Ba mươi sáu triệu...)" — `{totalAmount}` + `{totalAmountInWords}` ?
   - Section 3.2 "Giá trị hợp đồng đã ký" + "Giá trị nghiệm thu" — `{totalAmount}` + `{actualTotalWithVat}` + their InWords variants?
   - Footer "Tổng tiền + VAT + Tổng sau VAT (Bằng chữ:)" — actual or contract?
   - Tạm ứng + còn lại Bằng chữ
   BA xác nhận semantic + Coder document.xml extract positions exact.

- [ ] **PAUSE-44-03 (contract-ticket-sales.docx HDDV fragment):** "HDDV" text được Manager grep — không rõ đây là:
   - Hardcoded sample contract number prefix
   - Hay text label như "Loại HĐDV: ..."
   BA inspect template + decide replace với `{contractNumber}` OR keep as static text label.

- [ ] **PAUSE-44-04 (file naming convention SCOPE):** Danny request `[Mã hợp đồng] - [Tên sự kiện].ext`. Existing F-024 pattern khác:
   - Option A: REPLACE F-024 pattern entirely (`[Mã HĐ] - [Race name].ext` — breaking change)
   - Option B: ADDITIVE — keep F-024 default, allow per-customer override via env or admin setting
   - Option C: HYBRID — concatenate: `[Mã HĐ] - [Race name] - [DocType].ext`
   Manager đề xuất **Option C** — preserve F-024 info richness + add what Danny wants. BA confirm + provide test fixture filename examples.

- [ ] **PAUSE-44-05 (admin frontend download path):** Manager spot-check thấy backend `downloadDocument()` set filename correctly, NHƯNG admin có thể bypass via signed S3 URL. BA + Coder verify admin actual download flow:
   - If admin uses `<a href={signedUrl}>` → bypass → fix admin switch to proxy endpoint
   - If admin uses backend endpoint → filename should work → maybe S3 metadata override needed

- [ ] **PAUSE-44-06 (re-send DOCX merchants — combined với F-042 TD-COMM-STRATEGY-PHASE2):** F-044 ships MORE corrected DOCX. Communication strategy decision now combines F-042 + F-044 scope. Manager đề xuất:
   - Single combined audit + regenerate batch covering BOTH numeric (F-042) + text (F-044) bug classes
   - Reuse F-042 scripts với extended regex audit
   - Single notification batch để merchants nhận file mới đồng bộ (avoid 2 separate communications)

- [ ] **PAUSE-44-07 (test fixture matrix):** Need test matrix cho:
   - 3 contract types × CONTRACT + ACCEPTANCE_REPORT docs = 6 templates
   - Real-world data: contract `6a0bcab66042f47bde4eb9d7` (Danny case) + 1 RACEKIT + 1 OPERATIONS + 1 TICKET_SALES
   - Long contract number with diacritics: `10.05/2026/HĐDV/CTTFA-5BIB-6`
   - File naming test: verify filename match expected pattern post-fix

---

## 🎯 Success criteria (gợi ý cho BA)

- DOCX Hợp đồng + BBNT hiển thị **đúng** contract number từ DB (NOT hardcoded `10.04/2026/HĐDV/TAM-5BIB`)
- DOCX "Bằng chữ" hiển thị đúng VN-text computed từ actual amount (NOT hardcoded sample text)
- Download filename match pattern Danny request (TBD final per PAUSE-44-04)
- F-024 `audit-template-placeholders.ts` extended để detect text patterns + reports "NONE" sau fix
- Backward compat: existing F-042 flatten keys preserved, add new *InWords keys additive
- Performance: DOCX render p95 < 30s (unchanged)
- Combined với F-042 regenerate batch — re-render ALL affected contracts (F-042 + F-044 fixes both applied)

---

## 🔍 Manager hypotheses validated

### Root cause = same pattern F-042

Templates created F-024 era by copying SAMPLE race DOCX → Coder ban đầu convert SOME numeric values to `{placeholder}` (lineItems loop) BUT QUÊN:
- Contract number text (`10.04/2026/HĐDV/TAM-5BIB`)
- "Bằng chữ" VN amount in words

F-042 fix script grep pattern `[0-9]{1,3}\.[0-9]{3}\.[0-9]{3}` KHÔNG match these text variants:
- Contract numbers have `/` separators + text suffixes
- VN amount-in-words are full Vietnamese sentences

→ F-042 incomplete. F-044 must extend audit pattern + apply same XML manipulation fix.

### Pattern reuse F-042

- Python script `fix_templates.py` pattern (extract → regex replace → repack)
- `.backup/<type>-<timestamp>-pre-f044.docx` per BACKUP_DIRNAME convention
- Same test helper `extractDocxText` + `assertDocxNotContains`
- Audit + regen scripts: extend OR clone từ F-042 với updated patterns
- Manager Code Review post-cherry-pick mandatory (skill 2026-05-17)

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] **Yes** — Manager đã spot-check 8 templates + downloadDocument flow + build-filename util + 7 PAUSE conditions liệt kê. BA proceed với context complete.
- 📝 **Note for BA:** PRD MUST include:
  - **Template Placeholder Mapping Tables** (extend F-042 Tables A-F với contract number + in-words rows)
  - **In-words Flatten Spec** — 4-5 new keys với computation formula
  - **File Naming Decision Matrix** (Option A/B/C from PAUSE-44-04 + final filename format examples)
  - **Test Cases TC-44-XX** (3 contract types × 2 doc types + filename + grep audit)
  - **Audit Script Pattern Extension** — regex updates
  - **Combined F-042+F-044 Regenerate Strategy** (per PAUSE-44-06)

---

## 🔗 Next step

Danny chạy: `/5bib-prd FEATURE-044-contract-docx-phase-2-text-hardcoded-fix`

BA agent (5bib-po-ba) sẽ:
1. Đọc 00-manager-init.md + memory + F-042 artifacts (lesson learned + missed patterns)
2. Extract `contract-ticket-sales.docx` + `acceptance-racekit.docx` + `acceptance-operations.docx` raw document.xml để map exact positions (PAUSE-44-02/03 semantic)
3. Output `01-ba-prd.md` với:
   - Placeholder Mapping Tables (~6 templates × multiple text fixes)
   - In-words flatten spec
   - File naming decision per Danny choice
   - 12+ test cases TC-44-XX
   - Combined F-042+F-044 communication strategy
4. Estimate Coder workload: ~4-5h (XML manipulation pattern reuse F-042 fast)

**After F-044 ships:** Resume F-043 reconciliation upgrade per stashed init (`git stash pop` retrieve F-043 00-manager-init.md).
