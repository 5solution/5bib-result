# FEATURE-045: PRD — Contract DOCX Phase 3 Legacy Hardcoded Bank Account + Provider Name Fix

**Status:** 🔵 READY
**Last updated:** 2026-05-19
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`
**Strategy:** Combined F-044+F-045 single release (Option B chốt 2026-05-19)

---

## 📌 Pre-flight check (BA)

- [x] Đã đọc `00-manager-init.md` đầy đủ (5 hardcoded inventory items + Combined Option B strategy)
- [x] Đã đọc `memory/codebase-map.md` — contracts module (F-024 NEW MODULE biggest) + `env.provider` namespace F-030
- [x] Đã đọc `memory/known-issues.md` — F-044 8 TDs context + TD-F044-LEGACY-HARDCODED-BANK-PROVIDER (F-045 RESOLVES)
- [x] **Đã thực thi Manager's investigation order:**
  - Extracted document.xml × 5 templates → exact position mapping
  - Read `provider-entities.ts` (F-030 registry) — ProviderEntity shape có `bankAccount` + `bankName` + `entityName` đầy đủ cho cả 5BIB + 5SOLUTION
  - Verified `contract-timing.docx` CLEAN — KHÔNG có hardcoded từ F-045 inventory (4 templates affected only)
- [x] **Bonus discovery beyond Manager init inventory:**
  - `acceptance-operations.docx` hardcoded SAI service label `"về dịch vụ tính giờ"` ở câu mở đầu BBNT — template OPERATIONS phải là `"về vận hành"` (legacy bug, not multi-provider)
  - `acceptance-operations.docx` có 7 occurrences `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` (Manager init estimated 1, actual 7 — include "Bên B" section header which is normally placeholder-driven)
  - `acceptance-racekit/timing` hardcoded có 2 case variants: `CÔNG TY CỔ PHẦN 5BIB` (UPPER) ở 2 vị trí + `Công ty Cổ phần 5BIB` (proper) ở 3 vị trí

---

## 🎯 Discovery findings (concrete inventory)

### Inventory per template (post-extraction grep)

| Template | Bank acct | Bank branch | Provider name | Service label SAI |
|----------|----------:|------------:|--------------:|-------------------|
| `acceptance-racekit.docx` | 2× `110398986` | 2× `MB chi nhánh Thụy Khuê` | 2× UPPER + 3× proper | (N/A — racekit OK với "tính giờ" hardcoded? — Discussion below) |
| `acceptance-timing.docx` | 2× `110398986` | 2× `MB chi nhánh Thụy Khuê` | 2× UPPER + 3× proper | "dịch vụ tính giờ" CORRECT (TIMING template) |
| `acceptance-operations.docx` | 3× `111213998` | 2× `MB chi nhánh Hai Bà Trưng` | 7× `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` | **"dịch vụ tính giờ" SAI** — phải là `"vận hành"` |
| `contract-ticket-sales.docx` | 1× `110398986` (long form) | 1× full sentence | 1× `CONG TY CO PHAN 5BIB` (no diacritics) | (N/A) |
| `contract-timing.docx` | **0** ✅ | **0** ✅ | **0** ✅ | (Clean — verified) |

### Service label issue trong acceptance-racekit.docx

Câu mở đầu BBNT: `"giữa {client.entityName} và Công ty Cổ phần 5BIB về **dịch vụ tính giờ** Hôm nay..."`

→ Template RACEKIT hardcoded `"dịch vụ tính giờ"` — KHÔNG nhất quán với service template. Should be `"về vận hành racekit"` hoặc đơn giản drop service phrase (vì BR-FM-04 stripServicePrefix logic đã handle filename). PRD chọn approach: render dynamic service label PER template (BR-45-09).

---

## 📝 Contract DOCX Phase 3 Legacy Hardcoded Bank + Provider Name Fix

**Goal:** Eliminate ALL hardcoded provider-specific data (bank account number + branch + entity name) trong 4 contract/BBNT templates. Replace với F-030 provider entity placeholders để support multi-provider (5BIB + 5SOLUTION) correctly. Fix bonus legacy bug: wrong service label trong acceptance-operations + acceptance-racekit.

**Scope:**

- ✅ **In scope:**
  - Edit 4 templates với hardcoded provider data: `acceptance-racekit`, `acceptance-timing`, `acceptance-operations`, `contract-ticket-sales`
  - Replace 2× `110398986` + 3× `111213998` bank account hardcoded → `{provider.bankAccount}`
  - Replace 2× `MB chi nhánh Thụy Khuê` + 2× `MB chi nhánh Hai Bà Trưng` → `{provider.bankName}` (F-030 registry stores `bankName: "MB - Chi nhánh Thụy Khuê"` — full bank+branch)
  - Replace 5× `CÔNG TY CỔ PHẦN 5BIB` (UPPER) + 7× `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` (UPPER) → `{provider.entityName}`
  - Replace 3× `Công ty Cổ phần 5BIB` (proper case) trong 2 templates → `{provider.entityName}` (decision: use UPPER-case from F-030 registry consistently — see BR-45-08)
  - Replace 1× `CONG TY CO PHAN 5BIB` (no diacritics, contract-ticket-sales unique format) → `{provider.entityName}`
  - Fix service label bug: `acceptance-operations.docx` "về dịch vụ tính giờ" → "về vận hành" (correct for OPERATIONS template) — BR-45-09
  - Extend `audit-template-placeholders.ts` với 2 new pattern classes (Class 5 bank account hardcoded + Class 6 provider name hardcoded) — close TD-F044-LEGACY-HARDCODED-BANK-PROVIDER
  - 4 template backups → `.backup/<type>-20260519-pre-f045.docx`
  - Extend `f044-manager-render-verify.spec.ts` với multi-provider fixture (5BIB + 5SOLUTION variants)
  - Extend `f044-cn-coverage-verify.spec.ts` thành `f045-provider-coverage-verify.spec.ts` cho provider data coverage

- ❌ **Out of scope:**
  - `contract-timing.docx` (verified CLEAN — KHÔNG có hardcoded từ F-045 inventory)
  - `contract-racekit.docx` (verified — F-044 đã handle, KHÔNG có provider data hardcoded)
  - `contract-operations.docx` (verified — F-044 đã handle)
  - `payment-request.docx` (verify clean — likely uses `{provider.*}` already)
  - `quotation.xlsx` (Excel template, separate render path)
  - DB schema/migration (zero data change)
  - F-030 provider-entities.ts registry change (re-use existing structure)
  - Admin UI change (no UI new — template-only fix)

---

## 👤 User Stories & Business Rules

### User Stories

- As a **Sales Admin (Hằng)**, I want BBNT racekit/timing/operations DOCX hiển thị đúng tên provider tương ứng (5BIB cho TIMING/RACEKIT, 5SOLUTION cho OPERATIONS) so that contract gửi merchant không lộ thông tin sai provider.
- As a **Finance Admin (Hiền)**, I want số tài khoản + chi nhánh ngân hàng trong DOCX always khớp với F-030 provider registry so that khi 5BIB đổi tài khoản, chỉ cần update 1 file constant, KHÔNG phải edit template lại.
- As a **Race Organizer (5SOLUTION provider contracts)**, I want BBNT operations DOCX hiển thị `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` + bank `111213998` Hai Bà Trưng, NOT 5BIB info, so that contract không bị nghi ngờ sai pháp nhân.
- As a **5BIB Back-Office Admin**, I want audit script catch ALL hardcoded entity/bank data so that future template changes auto-verified before deploy.
- As a **CFO**, I want combined F-042+F-044+F-045 single regenerate batch + single merchant communication so that merchant nhận corrected DOCX 1 lần đồng bộ, KHÔNG 3 lần suspicious.

### Business Rules (BR-45-01..15)

#### A. Template Hardcoded Replacement

- **BR-45-01** (Bank account eliminate): MỌI hardcoded bank account `110398986` hoặc `111213998` trong 4 affected templates PHẢI replace với `{provider.bankAccount}` placeholder. Post-fix audit grep = 0 occurrences với 9-digit pattern matching F-030 registry.
- **BR-45-02** (Bank branch eliminate): MỌI hardcoded `MB chi nhánh Thụy Khuê` / `MB chi nhánh Hai Bà Trưng` / `Ngân hàng TMCP Quân Đội (MB) – Chi nhánh Thụy Khuê` PHẢI replace với `{provider.bankName}` placeholder. F-030 registry stores `bankName: "MB - Chi nhánh Thụy Khuê"` (full bank+branch concatenated) → rendered output sẽ hiển thị `MB - Chi nhánh Thụy Khuê` consistently.
- **BR-45-03** (Provider name eliminate UPPER-case): Mọi hardcoded `CÔNG TY CỔ PHẦN 5BIB` / `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` PHẢI replace với `{provider.entityName}`.
- **BR-45-04** (Provider name eliminate proper-case): 3× `Công ty Cổ phần 5BIB` (proper-case) trong acceptance-racekit + acceptance-timing PHẢI replace với `{provider.entityName}` (sẽ render UPPER-case từ F-030). Lý do consistency: legal documents conventional dùng UPPER-case for entity names (matches "BÊN A: CÔNG TY TNHH ABC" pattern existing trong templates).
- **BR-45-05** (Provider name eliminate no-diacritics edge): 1× `CONG TY CO PHAN 5BIB` (contract-ticket-sales, no diacritics) PHẢI replace với `{provider.entityName}` (sẽ render với diacritics từ F-030 → "CÔNG TY CỔ PHẦN 5BIB").

#### B. Service Label Fix (BR-45-09 bonus — out of original F-045 init inventory but found during BA discovery)

- **BR-45-09** (acceptance-operations service label fix): Câu mở đầu BBNT `"giữa {client.entityName} và {provider.entityName} về dịch vụ tính giờ Hôm nay..."` trong `acceptance-operations.docx` PHẢI đổi `"dịch vụ tính giờ"` → `"vận hành"` (correct for OPERATIONS template). KHÔNG dùng placeholder (template name đã xác định service per Manager PAUSE-45-01 đề xuất).
- **BR-45-10** (acceptance-racekit service label fix): Cùng câu trong `acceptance-racekit.docx` PHẢI đổi `"dịch vụ tính giờ"` → `"vận hành racekit"` (correct for RACEKIT template).
- **BR-45-11** (acceptance-timing preserved): `"dịch vụ tính giờ"` trong acceptance-timing CORRECT — KHÔNG đụng.

#### C. Backward Compatibility

- **BR-45-06** (Existing F-024+F-042+F-044 placeholders preserved): Tất cả placeholders đã có (`{contractNumber}`, `{provider.entityName}`, `{provider.address}`, `{provider.taxId}`, `{provider.representative}`, `{provider.position}`, `{totalAmount}`, `{totalAmountInWords}`, `{remainingBalanceInWords}`, etc.) PHẢI giữ nguyên không break.
- **BR-45-07** (Provider registry unchanged): KHÔNG đụng `provider-entities.ts` registry — F-030 ProviderEntity shape đầy đủ + đúng cho F-045 needs.

#### D. Provider Field Rendering Convention

- **BR-45-08** (Provider name case convention): F-030 registry stores entityName UPPER-case (`CÔNG TY CỔ PHẦN 5BIB`). Template render dùng UPPER-case consistently across all positions (Bên B header + ĐẠI DIỆN BÊN B + Tên chủ tài khoản + câu mở đầu BBNT + Đề nghị thanh toán). Lý do: legal document convention + simpler implementation (single placeholder source).

#### E. Audit Script Extension

- **BR-45-12** (Audit regex extend Class 5 + Class 6): `backend/scripts/audit-template-placeholders.ts` HARDCODED_LEAK_PATTERNS PHẢI extend từ F-042+F-044 (4 classes) sang +2 NEW:
  - **Class 5 (Bank account hardcoded):** `\b110398986\b` + `\b111213998\b` — exact match F-030 registry values (specific KHÔNG generic `\d{9}` để avoid false-positive với 9-digit phone numbers/MST)
  - **Class 6 (Provider name hardcoded):** `CÔNG TY CỔ PHẦN 5BIB(?! KH)` + `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` + `Công ty Cổ phần 5BIB` + `CONG TY CO PHAN 5BIB` (4 variant exact match)
  - **Class 6 (Bank branch hardcoded):** `MB chi nhánh (Thụy Khuê|Hai Bà Trưng)` — exact branch name match
- **BR-45-13** (Pre-deploy audit gate): Manager `/5bib-plan` REJECT verdict nếu audit script chạy on edited templates báo ANY hardcoded leak (Classes 2+3+4+5+6 = 6 pattern classes). Zero-hardcoded gate mandatory.

#### F. Combined Regenerate Strategy (Option B — F-044+F-045 single release)

- **BR-45-14** (Combined regen batch F-042+F-044+F-045): Single regenerate batch run post-F-045 deploy covers BOTH F-042 numeric fixes + F-044 text fixes + F-045 provider-data fixes. Reuse `regenerate-affected-contracts.ts` script. Audit log emit `actor=f042-f044-f045-combined-regenerate-script`.
- **BR-45-15** (Multi-provider verification mandatory): Render verify spec PHẢI test 2 fixture variants per template: provider=5BIB và provider=5SOLUTION. Verify rendered output uses entityName/bankAccount/bankName từ correct registry entry.

---

## 🖥️ UI/UX Flow

> F-045 KHÔNG có UI redesign. Chỉ DOCX template content changes. Admin download flow đã được F-044 fix với HYBRID Option C filename pattern — unchanged trong F-045.

### Admin Download Flow (unchanged from F-044)

Same flow as F-044 — no change to `document-download-btn.tsx`, `streamDownloadBlob`, or `buildDocumentFilename`. Only DOCX render content changes.

### UI States (unchanged from F-044)

| State | F-045 verdict |
|-------|--------------|
| Loading | ✅ Unchanged from F-044 |
| Success | ✅ Unchanged |
| Error | ✅ Unchanged |
| Filename fallback | ✅ Unchanged |

---

## 📊 Template Placeholder Mapping Tables (Coder spec)

### Table A: `acceptance-racekit.docx`

| Position context | Hardcoded value | Replace with |
|------------------|-----------------|--------------|
| Câu mở đầu BBNT "giữa ... và X về dịch vụ tính giờ" | `Công ty Cổ phần 5BIB` | `{provider.entityName}` |
| Service label câu mở đầu | `dịch vụ tính giờ` | `vận hành racekit` (BR-45-10 — hardcode per template) |
| Bên B section "Tài khoản: 110398986 - tại MB chi nhánh Thụy Khuê" | `110398986` | `{provider.bankAccount}` |
| Bên B section (same line) | `MB chi nhánh Thụy Khuê` | `{provider.bankName}` |
| ĐẠI DIỆN BÊN B section header | `CÔNG TY CỔ PHẦN 5BIB` | `{provider.entityName}` |
| Đề nghị thanh toán câu mở đầu "X xin gửi lời cảm ơn..." | `Công ty Cổ phần 5BIB` | `{provider.entityName}` |
| Đề nghị thanh toán "X kính đề nghị Quý Công ty..." | `Công ty Cổ phần 5BIB` | `{provider.entityName}` |
| Thông tin tài khoản "Tên chủ tài khoản: X" | `CÔNG TY CỔ PHẦN 5BIB` | `{provider.entityName}` |
| Thông tin tài khoản "Số tài khoản: Y" | `110398986` | `{provider.bankAccount}` |
| Thông tin tài khoản "Tại ngân hàng: Z" | `MB chi nhánh Thụy Khuê` | `{provider.bankName}` |

**Total per template: 5 provider name + 2 bank account + 2 bank branch + 1 service label = 10 replacements**

### Table B: `acceptance-timing.docx`

Same structure as Table A (10 replacements) but:
- Service label câu mở đầu: `dịch vụ tính giờ` → **KHÔNG ĐỤNG** (CORRECT for TIMING per BR-45-11)
- → Total 9 replacements (skip service label fix)

### Table C: `acceptance-operations.docx`

| Position | Hardcoded | Replace with |
|----------|-----------|--------------|
| Câu mở đầu BBNT | `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` | `{provider.entityName}` |
| Service label câu mở đầu | `dịch vụ tính giờ` | `vận hành` (BR-45-09) |
| Bên B section header | `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` | `{provider.entityName}` |
| Bên B Mã số thuế "0111213998" | (KEEP — taxId hardcoded vì F-030 stores `taxId: '0111213998'`, render từ `{provider.taxId}` đã có) | (Verify {provider.taxId} placeholder ALREADY present, KHÔNG đụng) |
| Bên B "Tài khoản: 111213998 - tại MB chi nhánh Hai Bà Trưng" | `111213998` + `MB chi nhánh Hai Bà Trưng` | `{provider.bankAccount}` + `{provider.bankName}` |
| ĐẠI DIỆN BÊN B section header | `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` | `{provider.entityName}` |
| Đề nghị thanh toán câu mở đầu | `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` | `{provider.entityName}` |
| Đề nghị thanh toán "X kính đề nghị..." | `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` | `{provider.entityName}` |
| Thông tin tài khoản "Tên chủ tài khoản" | `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` | `{provider.entityName}` |
| Thông tin tài khoản "Số tài khoản: 111213998" | `111213998` | `{provider.bankAccount}` |
| Thông tin tài khoản "Tại ngân hàng: ..." | `MB chi nhánh Hai Bà Trưng` | `{provider.bankName}` |
| Footer (chữ ký) | `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` | `{provider.entityName}` |

**Total: 7 provider name + 2 bank account + 2 bank branch + 1 service label fix = 12 replacements**

### Table D: `contract-ticket-sales.docx`

| Position | Hardcoded | Replace with |
|----------|-----------|--------------|
| Bên B section "Tài khoản số : 110398986 tại Ngân hàng TMCP Quân Đội (MB) – Chi nhánh Thụy Khuê – Chủ tài khoản: CONG TY CO PHAN 5BIB" | Complex line — `110398986` + `Ngân hàng TMCP Quân Đội (MB) – Chi nhánh Thụy Khuê` + `CONG TY CO PHAN 5BIB` | Rewrite to: `Tài khoản số : {provider.bankAccount} tại {provider.bankName} – Chủ tài khoản: {provider.entityName}` |

**Total: 1 bank account + 1 bank branch + 1 provider name = 3 replacements (single complex line rewrite)**

### Table E: `contract-timing.docx` — NO CHANGE

Verified CLEAN. KHÔNG có hardcoded từ F-045 inventory. Out of scope.

### Grand total

| Template | Replacements |
|----------|-------------:|
| acceptance-racekit.docx | 10 |
| acceptance-timing.docx | 9 |
| acceptance-operations.docx | 12 |
| contract-ticket-sales.docx | 3 |
| **Total** | **34 replacements across 4 templates** |

---

## 🛠️ Technical Mandates

### DB / Cache changes

- ❌ **MongoDB schema:** KHÔNG đụng
- ❌ **MongoDB data migration:** KHÔNG cần
- ❌ **Redis:** KHÔNG đụng
- ❌ **MySQL platform:** KHÔNG đụng
- ❌ **F-030 provider-entities.ts:** KHÔNG đụng (registry đã đủ)
- ✅ **DOCX templates binary:** 4 files modify + 4 backup → `.backup/<type>-20260519-pre-f045.docx`
- ✅ **AWS S3:** New DOCX files upload (existing flow, old files preserved 5y retention)

### Backend Code Change: `buildRenderContext()` — NO CHANGE

`{provider.entityName}`, `{provider.bankAccount}`, `{provider.bankName}` đã có sẵn trong context từ F-024 (line 1242 `provider: contract.provider` spread). docxtemplater render dot-notation tự động. KHÔNG cần extend buildRenderContext.

**Verification (BA spot-checked):**
```typescript
// contracts.service.ts line 1242-1243
provider: contract.provider,
client: contract.client,
```

`contract.provider` populated từ `getProviderEntity(providerId)` at create/quotation accept (line 307) — đầy đủ shape `ProviderEntity`.

### Audit Script Extension: `audit-template-placeholders.ts`

Per BR-45-12 — extend HARDCODED_LEAK_PATTERNS với 2 new classes:

```typescript
// F-045 EXTEND: catch provider data hardcoded
const HARDCODED_LEAK_PATTERNS = [
  // ... existing Class 1-4 from F-042+F-044 ...
  // Class 5 (NEW) — Bank account hardcoded (exact F-030 values)
  /\b110398986\b/,  // 5BIB bank account
  /\b111213998\b/,  // 5SOLUTION bank account
  // Class 6 (NEW) — Bank branch hardcoded
  /MB chi nhánh (Thụy Khuê|Hai Bà Trưng)/,
  /Ngân hàng TMCP Quân Đội \(MB\) – Chi nhánh/,
  // Class 6 (NEW) — Provider name hardcoded (4 variants)
  /CÔNG TY CỔ PHẦN 5BIB(?! KH)/,  // UPPER-case (negative lookahead exclude "KHÁCH HÀNG" false-positive)
  /CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION/,  // UPPER-case
  /Công ty Cổ phần 5BIB/,  // proper case
  /CONG TY CO PHAN 5BIB/,  // no diacritics
];
```

**Note Class 5/6 KHÔNG override Class 1 legacy F-024 patterns** — Class 1 catch `Hồ Gươm Plaza`, `Vũ Phan Anh`, `0110446252`, etc. (legacy F-024 sample). Class 5/6 specifically catch F-045 provider-data leaks.

### DOCX Template Edit Methodology — Python XML manipulation (F-044 pattern reuse)

```python
# F-045 fix_templates_f045.py — extend F-044 fix_templates_f044.py
REPLACEMENTS = {
    'acceptance-racekit': [
        # BR-45-01..05 + BR-45-10
        (r'110398986', '{provider.bankAccount}', 0),
        (r'MB chi nhánh Thụy Khuê', '{provider.bankName}', 0),
        (r'CÔNG TY CỔ PHẦN 5BIB', '{provider.entityName}', 0),
        (r'Công ty Cổ phần 5BIB', '{provider.entityName}', 0),
        # Service label fix BR-45-10
        (r'về dịch vụ tính giờ Hôm nay', 'về vận hành racekit Hôm nay', 0),
    ],
    'acceptance-timing': [
        # Same as acceptance-racekit MINUS service label fix
        (r'110398986', '{provider.bankAccount}', 0),
        (r'MB chi nhánh Thụy Khuê', '{provider.bankName}', 0),
        (r'CÔNG TY CỔ PHẦN 5BIB', '{provider.entityName}', 0),
        (r'Công ty Cổ phần 5BIB', '{provider.entityName}', 0),
        # KHÔNG đụng "dịch vụ tính giờ" (CORRECT for TIMING)
    ],
    'acceptance-operations': [
        (r'111213998', '{provider.bankAccount}', 0),
        (r'MB chi nhánh Hai Bà Trưng', '{provider.bankName}', 0),
        (r'CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION', '{provider.entityName}', 0),
        # Service label fix BR-45-09
        (r'về dịch vụ tính giờ Hôm nay', 'về vận hành Hôm nay', 0),
    ],
    'contract-ticket-sales': [
        # Complex line — single rewrite via specific regex
        (r'Tài khoản số : 110398986 tại Ngân hàng TMCP Quân Đội \(MB\) – Chi nhánh Thụy Khuê – Chủ tài khoản: CONG TY CO PHAN 5BIB',
         'Tài khoản số : {provider.bankAccount} tại {provider.bankName} – Chủ tài khoản: {provider.entityName}', 0),
    ],
}
```

**Edge case:** acceptance-operations.docx may have `Mã số thuế: 0111213998` which embedded `111213998` substring. Regex `\b111213998\b` với word boundary MAY match. **Coder verify:** if `0111213998` (with leading 0) trong template, regex needs adjust to avoid replacing taxId substring. Safer regex: `Tài khoản: 111213998` + `Số tài khoản: 111213998` (full sentence context).

### Frontend / Admin (Next.js)

- ❌ NO new endpoint
- ❌ NO SDK regen (no DTO change)
- ❌ NO UI change
- ✅ F-044 streamDownloadBlob + HYBRID filename unchanged

### PAUSE flags

- 🛑 **Manager verify acceptance-operations.docx `0111213998` taxId substring collision** với regex `\b111213998\b`. Coder MUST use context-anchored pattern (full sentence) thay vì bare 9-digit pattern.
- 🛑 **Multi-provider test fixture mandatory** — Coder PHẢI render mỗi template với BOTH provider=5BIB + provider=5SOLUTION variants để verify provider data renders correctly. KHÔNG just single provider.
- 🛑 **Combined F-042+F-044+F-045 regenerate batch** — Danny + Finance team approve scope before PROD execution.

---

## 🛡️ Testing Mandates

### Backend Test Cases TC-45-XX

#### TC-45-01 — acceptance-racekit RACEKIT 5BIB provider (multi-provider primary)

| Element | Value |
|---------|-------|
| Method | POST |
| URL | `/api/contracts/<racekit-5BIB-id>/generate/ACCEPTANCE_REPORT` |
| Pre-condition | Contract type RACEKIT, providerId=5BIB (default per F-030 BR-CM-01), totalAmount 54M, advancePaid 15M, remainingBalance 39M |
| Expected status | 200 |
| **DOCX content verify** | Contains `CÔNG TY CỔ PHẦN 5BIB` ≥5 times (5 provider positions resolved). Contains `110398986` ≥2 times (bank account). Contains `MB - Chi nhánh Thụy Khuê` ≥2 times (bankName từ F-030). Contains `về vận hành racekit` (service label fix). NO `Công ty Cổ phần 5BIB` proper-case (all UPPER-cased post-fix). |

#### TC-45-02 — acceptance-operations OPERATIONS 5SOLUTION provider (multi-provider primary)

| Element | Value |
|---------|-------|
| Method | POST |
| URL | `/api/contracts/<ops-5SOLUTION-id>/generate/ACCEPTANCE_REPORT` |
| Pre-condition | Contract type OPERATIONS, providerId=5SOLUTION (default per BR-CM-01), totalAmount 108M, advancePaid 30M, remainingBalance 78M |
| Expected status | 200 |
| **DOCX content verify** | Contains `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` ≥7 times. Contains `111213998` ≥2 times. Contains `MB - Chi nhánh Hai Bà Trưng` ≥2 times. Contains `về vận hành Hôm nay` (service label fix BR-45-09). NO old hardcoded `MB chi nhánh Hai Bà Trưng` (no dash separator) — full F-030 bankName format. NO `dịch vụ tính giờ` (wrong service label fixed). |

#### TC-45-03 — acceptance-racekit RACEKIT với providerId OVERRIDDEN to 5SOLUTION (multi-provider critical)

| Element | Value |
|---------|-------|
| Method | POST |
| URL | `/api/contracts/<racekit-override-5SOLUTION-id>/generate/ACCEPTANCE_REPORT` |
| Pre-condition | Contract type RACEKIT, providerId=5SOLUTION (admin override), totalAmount 54M, advancePaid 15M, remainingBalance 39M |
| Expected status | 200 |
| **DOCX content verify** | Contains `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` ≥5 times. Contains `111213998` ≥2 times. Contains `MB - Chi nhánh Hai Bà Trưng`. NO `110398986` anywhere. NO `CÔNG TY CỔ PHẦN 5BIB`. **Critical: KHÔNG bị hardcoded 5BIB residual leak khi admin override provider.** |

#### TC-45-04 — acceptance-operations OPERATIONS với providerId OVERRIDDEN to 5BIB (multi-provider critical)

Similar to TC-45-03 but reverse — verify khi OPERATIONS contract assigned 5BIB provider, DOCX renders 5BIB data NOT 5SOLUTION.

#### TC-45-05 — acceptance-timing TIMING 5BIB

| Element | Value |
|---------|-------|
| Pre-condition | TIMING contract, providerId=5BIB |
| **DOCX content verify** | Contains `CÔNG TY CỔ PHẦN 5BIB` + `110398986` + `MB - Chi nhánh Thụy Khuê`. Contains `về dịch vụ tính giờ Hôm nay` (PRESERVED — correct for TIMING per BR-45-11). |

#### TC-45-06 — contract-ticket-sales TICKET_SALES 5BIB

| Element | Value |
|---------|-------|
| Pre-condition | TICKET_SALES contract, providerId=5BIB, totalAmount=any |
| **DOCX content verify** | Contains `Tài khoản số : 110398986 tại MB - Chi nhánh Thụy Khuê – Chủ tài khoản: CÔNG TY CỔ PHẦN 5BIB`. NO `CONG TY CO PHAN 5BIB` (no-diacritics removed). NO `Ngân hàng TMCP Quân Đội` (replaced by bankName F-030 format). |

#### TC-45-07 — Edge: contract.provider field null/incomplete (defense-in-depth)

| Pre-condition | Contract với `provider` field missing some sub-fields (vd: bankAccount=undefined) |
| **DOCX content verify** | Template renders empty string thay vì literal `{provider.bankAccount}` (docxtemplater default behavior). KHÔNG crash render. |

#### TC-45-08 — Audit script post-fix zero hardcoded across Class 5+6

| Method | Run `pnpm --filter backend ts-node scripts/audit-template-placeholders.ts` post-edit |
| Expected output | "Hardcoded leaks (unique): 0" — verify NO entries for `110398986`, `111213998`, `MB chi nhánh Thụy Khuê`, `MB chi nhánh Hai Bà Trưng`, `CÔNG TY CỔ PHẦN 5BIB` (UPPER), `Công ty Cổ phần 5BIB` (proper), `CONG TY CO PHAN 5BIB` (no diacritics), `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION`. |

#### TC-45-09 — F-044 regression: filename HYBRID still works

| Pre-condition | Contract `6a0bcab66042f47bde4eb9d7` (Danny case from F-044) — download Contract DOCX RACEKIT |
| **Verify** | Filename = `10.05.2026.HDDV.CTTFA-5BIB-6 - Cát Tiên Trail Family Adventure - Hợp đồng.docx` (F-044 HYBRID Option C UNCHANGED). |

#### TC-45-10 — F-042+F-044 regression: số khớp chữ + Adjustment #1 typo fix preserved

| Pre-condition | Same as TC-45-01 (RACEKIT 5BIB 30/70 split) |
| **Verify** | "Tổng giá trị Hợp đồng (đã bao gồm 8% VAT): 54.000.000 VND (Bằng chữ: Năm mươi tư triệu đồng)" — F-042+F-044 BUGFIX#1 preserved. 3× "còn lại" sentences render 39M not 15M (Adjustment #1 preserved). |

### Frontend E2E Test Cases (Playwright)

| TC | Persona | Journey | Steps | Expected |
|----|---------|---------|-------|----------|
| E2E-45-01 | Sales Admin | Download Contract OPERATIONS 5SOLUTION provider | 1. `/contracts/<ops-id>` 2. Click "Hợp đồng" → "Tải DOCX" 3. Open file | Filename HYBRID. Content: provider=5SOLUTION info (bank `111213998`, branch Hai Bà Trưng, entity `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION`). NO 5BIB residual. |
| E2E-45-02 | Sales Admin | Download BBNT RACEKIT với provider overridden 5SOLUTION | Similar flow + verify multi-provider correctness | Content: 5SOLUTION data, NOT 5BIB. |
| E2E-45-03 | Finance Admin | Download BBNT OPERATIONS 5SOLUTION (Danny multi-provider expected case) | Standard flow | Content matches F-030 5SOLUTION registry: address, taxId, bankAccount, bankName, representative, position all from registry. |
| E2E-45-04 | Back-Office Admin | Audit script post-deploy | SSH backend → run extended audit | "Hardcoded leaks: 0" across all 6 pattern classes (F-042+F-044+F-045 superset). |

### Security Checks

- [ ] Provider data leak prevention: F-045 ensures non-5BIB contracts don't expose 5BIB info accidentally (multi-provider integrity)
- [ ] Audit script catches future hardcoded regressions (BR-45-12 Class 5+6)
- [ ] LogtoStaffGuard preserved on `POST /api/contracts/:id/generate-document` (unchanged from F-044)

### Performance SLA

- DOCX gen p95 < 30s (unchanged — same render pipeline)
- Audit script extended regex runtime < 5 phút (cùng scale với F-044)
- Test suite F-045 (TC-45-XX) < 5s (unit tests mock S3, multi-provider variant overhead minimal)

---

## 📌 Answers to Manager's PAUSE conditions (từ file 00)

> BA giải quyết 2 PAUSE-45-* Manager đã đặt + 1 bonus PAUSE phát hiện trong discovery.

- **PAUSE-45-01 (Service label dynamic vs hardcoded per template):** ✅ **Hardcode per template** — Manager đề xuất accepted. Lý do: template name đã xác định service (TIMING template = "tính giờ", OPERATIONS = "vận hành", RACEKIT = "vận hành racekit"). Dynamic placeholder thêm complexity không cần thiết. BR-45-09/10/11 encode per-template hardcode values.

- **PAUSE-45-02 (Audit regex precision để KHÔNG false-positive):** ✅ Sử dụng EXACT MATCH thay vì generic pattern:
  - Bank account: `\b110398986\b` + `\b111213998\b` (exact F-030 values, KHÔNG `\d{9}` generic) — avoid false-positive với phone numbers
  - Provider name: 4 exact variants `CÔNG TY CỔ PHẦN 5BIB`, `Công ty Cổ phần 5BIB`, `CONG TY CO PHAN 5BIB`, `CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION` — avoid false-positive với placeholder default articles (admin can edit entity name)
  - Bank branch: `MB chi nhánh (Thụy Khuê|Hai Bà Trưng)` — exact branch names

- **PAUSE-45-03 (NEW from BA discovery — acceptance-operations wrong service label):** ✅ Fix to "vận hành" per BR-45-09. Bonus fix beyond Manager init inventory. Flag in 02-manager-plan to confirm Danny approve scope expansion.

---

## 🚨 Risk acknowledgments

- 🔴 **HIGH multi-provider regression risk** — TC-45-03 + TC-45-04 critical (provider override scenarios). If F-045 incorrectly handles, OPERATIONS contracts with 5BIB provider OR RACEKIT contracts with 5SOLUTION provider will render WRONG provider data.
- 🟡 **MED `0111213998` taxId substring collision** — Coder MUST verify regex `\b111213998\b` KHÔNG accidentally replace `0111213998` (leading-0 taxId). Use context-anchored pattern (full sentence prefix) khi cần. Safer pattern: `Tài khoản: 111213998` + `Số tài khoản: 111213998`.
- 🟡 **MED service label fix scope** — BR-45-09/10 fix wrong service labels (bonus from BA discovery). Manager confirm scope expansion is acceptable.
- 🟢 **LOW backward compat** — All existing F-024+F-042+F-044 placeholders preserved (BR-45-06).
- 🟢 **LOW provider registry** — F-030 ProviderEntity shape unchanged (BR-45-07).

---

## ✅ Status

- [x] **READY** — sẵn sàng cho Manager review (`/5bib-plan`)

---

## 🔗 Next step

Danny chạy: `/5bib-plan FEATURE-045-contract-docx-phase-3-legacy-hardcoded-bank-provider`

Manager sẽ:
1. Validate 15 BR-45-* testable + 5 Mapping Tables A-E + 10 TC-45-XX + 4 E2E-45-XX
2. Cross-check memory architecture (no change) + conventions (extend F-044 audit pattern Class 5+6) + known-issues (close TD-F044-LEGACY-HARDCODED-BANK-PROVIDER)
3. **Spot-check code thật** per MANDATE 2026-05-17:
   - `provider-entities.ts` (F-030 registry — verify shape correct cho `{provider.bankAccount}` + `{provider.bankName}` + `{provider.entityName}`)
   - `contracts.service.ts:1242-1243` flatten block (verify `contract.provider` spread đầy đủ ProviderEntity)
   - 4 template document.xml grep + verify Mapping Tables A-D positions exact
   - Audit script Class 5+6 regex precision (taxId substring collision check)
4. **Manager pre-Plan spot-check expected findings** (BA pre-emptive):
   - Manager likely flag PAUSE-45-03 service label fix scope expansion → recommend Danny approve OR exclude
   - Manager likely flag `0111213998` regex edge case → recommend Coder use context-anchored pattern
5. Output `02-manager-plan.md` với Scope Lock + verdict

**Estimated Coder workload:** ~2-3h
- ~15 min: Extract document.xml for 4 templates + verify Mapping Tables A-D
- ~30 min: Edit 4 DOCX templates via Python XML manipulation (extending F-044 pattern) + verify post-edit
- ~15 min: Audit script Class 5+6 regex extension
- ~30 min: Extend `f044-manager-render-verify.spec.ts` với multi-provider fixtures (5BIB + 5SOLUTION variants)
- ~30 min: Write F-045 spec files (`document-generator.service.f045.spec.ts` TC-45-01..07, `audit-script.f045.spec.ts` TC-45-08, regression spec for F-042+F-044 TC-45-09/10)
- ~30 min: Self-Review Pipeline + documentation 03-coder-implementation.md

**Combined F-044+F-045 deploy ETA:** Add ~3h F-045 work to F-044 already done → single release branch + single regen batch.

---

## 📊 Combined deploy summary (Option B reminder for Danny)

After F-045 ship:
1. Single push merge `feat/F-044-contract-docx-phase-2` (extended with F-045 commits) → main
2. Single `release/v1.8.8` cover F-044 + F-045
3. Single combined audit + regen batch: F-042 numeric + F-044 text + F-045 provider data → merchant nhận corrected DOCX 1 lần
4. Single Finance team communication strategy (TD-F044-COMM-STRATEGY-PHASE2-COMBINED + F-045 inherited)
