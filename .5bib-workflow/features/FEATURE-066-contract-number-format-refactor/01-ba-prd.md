# FEATURE-066 — Contract Number Format Refactor — PRD v1.0

> **Owner BA:** 5bib-po-ba
> **Status:** 🟢 READY_FOR_MANAGER_PLAN
> **Last updated:** 2026-05-25
> **Module touched:** `contracts/` (backend service + Partner schema/DTO + admin Partner form)
> **Depends on:** F-024 ContractNumberService (`backend/src/modules/contracts/services/contract-number.service.ts`)
> **Manager init:** 4 PAUSE locked (D + A + A + Confirm format)

---

## 0. Bối cảnh và 4 PAUSE đã chốt

### Bối cảnh
Định dạng số HĐ hiện tại `DD.MM/YYYY/HDDV/CLIENT-PROVIDER[-N]` đã chuẩn (F-024 BR-CM-02), NHƯNG khâu tạo `CLIENT` token còn 3 bug nghiệp vụ:

1. **Bỏ qua `Partner.shortName`** — Caller trong `contracts.service.activate()` build CLIENT bằng cách lấy chữ cái đầu mỗi từ của `entityName` (acronym) → ra `"CTCPTAMAN"` thay vì `"TAM"` admin đã nhập. Field `Partner.shortName` đã exists trong schema từ trước nhưng never consumed.
2. **Không strip company prefix** — Khi entityName = `"CÔNG TY CỔ PHẦN TÂM AN MEDIA"` → acronym = `"CTCPTAM"` lẫn lộn prefix pháp nhân (CTCP/CTYTNHH) với tên thương hiệu thực.
3. **Sequence per-year toàn cục** — Key Redis `contracts:sequence:<year>` cộng dồn ALL clients trong năm. 2 HĐ khác client cùng năm → 1 HĐ bị `-2` suffix vô lý trong khi đó là HĐ ĐẦU TIÊN của client đó. Số HĐ trông như "đã có #1 trước".

### 4 PAUSE locked (Manager init)

| # | Quyết định chốt | Tóm tắt |
|---|----------------|---------|
| **PAUSE-66-01** | **D — Hybrid** | Default: strip prefix CTCP/CTYTNHH/CTCPDT/CTYTNHHMTV/... khỏi `entityName` rồi abbreviate. Override: nếu `Partner.shortName` có giá trị, dùng nó (highest priority). |
| **PAUSE-66-02** | **A — Per-(client, year) sequence** | Redis key đổi từ `contracts:sequence:<year>` → `contracts:sequence:<year>:<clientShortName>`. Mỗi cặp (year, client) reset độc lập. |
| **PAUSE-66-03** | **A — Forward-only** | KHÔNG migrate HĐ cũ. HĐ tạo trước F-066 giữ nguyên contractNumber. HĐ mới sau deploy dùng logic mới. |
| **PAUSE-66-04** | **Confirm format** | Giữ format `DD.MM/YYYY/HDDV/CLIENT-PROVIDER[-N]`. KHÔNG đổi cấu trúc tổng thể, chỉ refactor logic build token `CLIENT`. |

---

## 1. Mục tiêu & Phạm vi

### Mục tiêu nghiệp vụ
- HĐ `15/05/2026` cho `"CÔNG TY CỔ PHẦN TÂM AN MEDIA"` (shortName = `"TAM"`) → số HĐ = `15.05/2026/HDDV/TAM-5BIB` (đúng ý admin).
- HĐ thứ 2 cùng ngày cùng client → `15.05/2026/HDDV/TAM-5BIB-2`.
- HĐ thứ 3 trong năm cho client A + HĐ thứ 1 trong năm cho client B → A có suffix `-3`, B KHÔNG có suffix (vì là HĐ ĐẦU TIÊN của B trong năm 2026).
- Admin chỉnh `Partner.shortName` → HĐ mới generate dùng ngay giá trị mới, KHÔNG đụng HĐ cũ.

### IN scope

**Group A — Backend service refactor (`contract-number.service.ts`)**
- New helper `stripCompanyPrefix(rawName: string): string` — strip 1 lần các prefix VN phổ biến.
- `generateNumber()` mở rộng signature → nhận thêm option `partnerShortName?: string` (override).
- `nextSequence()` mở rộng signature → `nextSequence(year: number, clientShortName: string)` (per-(year, client)).
- Redis key migration `contracts:sequence:<year>` → `contracts:sequence:<year>:<clientShortName>`.

**Group B — Partner schema + DTO + admin UI**
- `partner.schema.ts`: field `shortName` ĐÃ EXISTS — bổ sung validation (max 16, uppercase, alphanum) qua DTO.
- `partner.dto.ts`: `CreatePartnerDto.shortName` + `UpdatePartnerDto.shortName` bổ sung `@MaxLength(16)` + `@Matches(/^[A-Z0-9]+$/)` regex + `@ApiPropertyOptional` description bằng tiếng Việt.
- Admin `partner-picker.tsx` form field `shortName` ĐÃ EXISTS — bổ sung placeholder + helper text + client-side validation + uppercase auto-transform.

**Group C — Caller refactor (`contracts.service.ts`)**
- Trong `activate()`: thay block acronym hand-built (`split(/\s+/).map(w=>w[0])`) bằng call mới đến `contract-number.service` truyền `partner.shortName` + `partner.entityName`.
- Service quyết định: nếu `partnerShortName` có giá trị → dùng. Nếu rỗng → strip prefix `entityName` rồi sanitize.

**Group D — Tests**
- Extend `contract-number.service.spec.ts` ≥10 TC-66-* (xem Section 7).

**Group E — Admin UX contract preview**
- Trong `contract-wizard.tsx` (hoặc nơi hiển thị preview contract number trước khi save) → hiển thị số HĐ dự kiến dùng partner.shortName real-time khi user chọn partner.

### OUT of scope
- ❌ Migrate historical contracts (forward-only — PAUSE-66-03).
- ❌ Render template engine `contract-render.service.ts` (F-064/F-065 territory).
- ❌ Audit log số HĐ change (F-067 territory).
- ❌ Public-facing API expose số HĐ (chỉ admin).
- ❌ Đổi format tổng thể `DD.MM/YYYY/HDDV/...` (PAUSE-66-04 confirm giữ nguyên).

---

## 2. UI Step-by-Step Journey

### Journey 1 — Sales Admin (Hằng) — Tạo Partner mới với shortName

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Trong `contract-wizard` step "Chọn đối tác", click button **"+ Tạo đối tác mới"** | PartnerPicker mở rộng → hiển thị form inline (KHÔNG modal) | Local state `creating=true` | Form render |
| 2 | Type vào field "Tên đối tác *" — `"CÔNG TY CỔ PHẦN TÂM AN MEDIA"` | Input controlled, char counter ẩn | onChange | `form.entityName` updated |
| 3 | Type vào field "Tên viết tắt" — `"tam"` (lowercase) | Input auto-transform → hiển thị `"TAM"` (uppercase) ngay khi blur. Helper text bên dưới: `"Dùng cho số HĐ. VD: TAM, THANHANMEDIA. Tối đa 16 ký tự A-Z 0-9."` | onChange + onBlur transform `.toUpperCase().replace(/[^A-Z0-9]/g,'')` | `form.shortName = "TAM"` |
| 4 | (Optional) Type field "MST" — `"0312345678"` | Standard input, no special transform | onChange | `form.taxId` updated |
| 5 | Click button **"Lưu đối tác"** | Button disabled trong khi `saving=true`, spinner + text `"Đang lưu..."`. POST `/api/partners` body = form | onClick | API call inflight |
| 6a | 201 success | Toast green `"Đã tạo đối tác TÂM AN MEDIA"`. PartnerPicker collapse → hiển thị compact card với name + "Đổi" button. Wizard preview contract number cập nhật: `"Dự kiến: DD.MM/2026/HDDV/TAM-5BIB"` | onCreated callback | `value=partner, browsing=false` |
| 6b | 400 validation (shortName chứa ký tự lạ) | Toast đỏ `"Tên viết tắt phải in hoa và không chứa khoảng trắng / ký tự đặc biệt"`. Field "Tên viết tắt" border đỏ + inline error text. | API 400 response handle | Stay on form |
| 6c | 400 validation (shortName >16 chars) | Toast đỏ `"Tên viết tắt tối đa 16 ký tự"`. Field highlight. | onClick client-side check OR API 400 | Stay on form |

### Journey 2 — Sales Admin — Activate contract → số HĐ generate

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Mở contract `DRAFT` đã có `client.entityName`+`signDate` tại `/contracts/{id}` | Detail page render. Banner top hiển thị: `"📝 HĐ chưa kích hoạt. Số HĐ sẽ tự sinh khi click Kích hoạt."`. Preview line: `"Dự kiến: 15.05/2026/HDDV/TAM-5BIB"` | useEffect fetch contract + computed preview | Detail rendered |
| 2 | Click button **"Kích hoạt HĐ"** (primary blue, header right) | Confirm dialog mở: `"Kích hoạt HĐ TÂM AN MEDIA? Số HĐ 15.05/2026/HDDV/TAM-5BIB sẽ được khoá vĩnh viễn."`. 2 buttons "Huỷ" + "Xác nhận kích hoạt" | onClick | Dialog open |
| 3 | Click "Xác nhận kích hoạt" | Button disabled + spinner `"Đang kích hoạt..."`. POST `/api/contracts/{id}/activate` | onClick | API inflight |
| 4a | 200 success | Toast green `"HĐ đã kích hoạt — số HĐ: 15.05/2026/HDDV/TAM-5BIB"`. Banner đổi → `"✅ HĐ ACTIVE, số 15.05/2026/HDDV/TAM-5BIB, kích hoạt lúc 15:30 25/05"`. Status badge `ACTIVE` xanh. | API 200 + invalidate query | Detail refresh |
| 4b | 409 conflict (số HĐ trùng sau 5 retry) | Toast đỏ `"Số HĐ bị trùng — vui lòng đổi tên viết tắt đối tác và thử lại"`. Banner giữ nguyên DRAFT. | API 409 handle | Stay DRAFT |

### Journey 3 — Admin — Edit Partner.shortName của partner đã có HĐ cũ

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Vào `/contracts` list → mở Partner Manager (sub-page hoặc modal — tuỳ implementation hiện tại) | List partners hiển thị | nav | List rendered |
| 2 | Click row partner "TÂM AN MEDIA" | Edit form load với `shortName` hiện tại (vd: rỗng hoặc cũ) | onClick | Edit modal open |
| 3 | Sửa field "Tên viết tắt" từ rỗng → `"TAM"` | Same auto-transform Journey 1 step 3 | onChange | `form.shortName="TAM"` |
| 4 | Click "Lưu" | PATCH `/api/partners/{id}` body = `{shortName:"TAM"}` | onClick | API inflight |
| 5 | 200 success | Toast `"Đã cập nhật đối tác TÂM AN MEDIA"`. Warning banner inline: `"⚠️ HĐ đã ACTIVE trước đây KHÔNG đổi số. Chỉ HĐ mới sau lúc này sẽ dùng tên viết tắt mới."` | API 200 | Modal close |

---

## 3. Buttons Specification

| Button label | Position | Default state | Disabled state | Loading state | Action | Confirm dialog? |
|--------------|----------|---------------|----------------|---------------|--------|-----------------|
| **"Lưu đối tác"** | Footer PartnerPicker form | primary blue, enabled khi `entityName.trim()!=''` | `entityName` rỗng OR `saving=true` | Spinner + "Đang lưu..." | POST `/api/partners` body=form | Không |
| **"Kích hoạt HĐ"** | Header right contract detail | primary blue, enabled khi `status==='DRAFT'` | `status!=='DRAFT'` OR `activating=true` | Spinner + "Đang kích hoạt..." | POST `/api/contracts/{id}/activate` | Có — confirm preview số HĐ |
| **"Xác nhận kích hoạt"** | Confirm dialog Footer | primary blue, always enabled in dialog | `activating=true` | Spinner | Trigger API activate | — |
| **"Huỷ"** | Confirm dialog Footer | outline, always enabled | — | — | Close dialog | — |
| **"Lưu"** (Partner edit) | Edit modal Footer | primary blue | `saving=true` | Spinner + "Đang lưu..." | PATCH `/api/partners/{id}` | Không |

---

## 4. Form Fields Specification

### 4.1 Partner form (PartnerPicker create + Partner edit)

| Field name | UI label | Type | Required | Validation | Error message (VN) | Default |
|-----------|----------|------|----------|------------|---------------------|---------|
| `entityName` | "Tên đối tác *" | text input | ✅ | `trim().length >= 1` AND `<= 255` | `"Tên đối tác là bắt buộc"` / `"Tên đối tác tối đa 255 ký tự"` | "" |
| `shortName` | "Tên viết tắt" | text input | ❌ | `^[A-Z0-9]{0,16}$` sau client-side transform `.toUpperCase().replace(/[^A-Z0-9]/g,'')` | `"Tên viết tắt phải in hoa và chỉ gồm A-Z 0-9"` / `"Tên viết tắt tối đa 16 ký tự"` | undefined |
| `taxId` | "MST" | text input | ❌ | `^[0-9]{10}(-[0-9]{3})?$` nếu non-empty | `"MST phải có 10 chữ số (hoặc 10-3)"` | undefined |
| `address` | "Địa chỉ" | text input | ❌ | `<=500 chars` | `"Địa chỉ tối đa 500 ký tự"` | undefined |
| `representative` | "Đại diện" | text input | ❌ | `<=120 chars` | — | undefined |
| `position` | "Chức vụ" | text input | ❌ | `<=120 chars` | — | undefined |
| `bankAccount` | "Số TK" | text input | ❌ | `<=30 chars` | — | undefined |
| `bankName` | "Tên ngân hàng" | text input | ❌ | `<=120 chars` | — | undefined |
| `phone` | "Điện thoại" | text input | ❌ | `<=20 chars` | — | undefined |
| `email` | "Email" | text input | ❌ | `IsEmail()` nếu non-empty | `"Email không hợp lệ"` | undefined |

**Helper text dưới field `shortName`:**
> *"Dùng cho số HĐ — VD: `15.05/2026/HDDV/TAM-5BIB`. Để trống → tự sinh từ tên đối tác. Tối đa 16 ký tự A-Z 0-9."*

---

## 5. Backend Endpoint Specification

### 5.1 POST `/api/partners` (create) — modified

| Element | Spec |
|---------|------|
| Method | `POST` |
| Path | `/api/partners` |
| Auth | `@UseGuards(LogtoStaffGuard)` |
| Guard role | `staff` hoặc `admin` |
| Request body DTO | `CreatePartnerDto` (modified — see Section 6.1) |
| Response DTO | `PartnerResponseDto` |
| Status codes | `201` success / `400` validation (shortName format/length, entityName missing) / `401` no auth / `409` dup taxId / `500` server |
| Side effects | Mongo insert `partners` collection. KHÔNG cache invalidate (no Redis cache for partners list). |
| MUST NOT leak | `__v`, `deletedAt` (nếu null), `createdBy` raw (mask if needed) |

### 5.2 PATCH `/api/partners/:id` (update) — modified

| Element | Spec |
|---------|------|
| Method | `PATCH` |
| Path | `/api/partners/:id` |
| Auth | `@UseGuards(LogtoStaffGuard)` |
| Request body DTO | `UpdatePartnerDto` (PartialType — all fields optional) |
| Response DTO | `PartnerResponseDto` |
| Status codes | `200` success / `400` validation / `401` / `404` not found / `500` |
| Side effects | Mongo `findOneAndUpdate`. KHÔNG re-generate contract numbers của HĐ cũ (PAUSE-66-03 forward-only). |

### 5.3 POST `/api/contracts/:id/activate` — unchanged signature, internal logic changed

| Element | Spec |
|---------|------|
| Method | `POST` |
| Path | `/api/contracts/:id/activate` |
| Auth | `@UseGuards(LogtoStaffGuard)` |
| Status codes | `200` success / `400` not DRAFT / `404` / `409` collision after 5 retries / `500` |
| Side effects | Mongo update contract (status DRAFT→ACTIVE + contractNumber + activatedAt). Redis INCR `contracts:sequence:<year>:<clientShortName>` (new key pattern). Audit log via Logger.warn. |

---

## 6. DTO Field-Level Spec

### 6.1 `CreatePartnerDto` modified (`backend/src/modules/contracts/dto/partner.dto.ts`)

```typescript
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreatePartnerDto {
  @ApiProperty({ description: 'Tên pháp nhân đầy đủ', example: 'CÔNG TY CỔ PHẦN TÂM AN MEDIA', maxLength: 255 })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  entityName: string;

  @ApiPropertyOptional({
    description: 'Tên viết tắt dùng cho số HĐ (uppercase, A-Z 0-9). Để trống → tự sinh từ entityName bỏ prefix pháp nhân.',
    example: 'TAM',
    maxLength: 16,
    pattern: '^[A-Z0-9]+$',
  })
  @IsOptional()
  @IsString()
  @MaxLength(16, { message: 'Tên viết tắt tối đa 16 ký tự' })
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Tên viết tắt phải in hoa và chỉ gồm A-Z 0-9',
  })
  shortName?: string;

  // ... other fields unchanged
}

export class UpdatePartnerDto extends PartialType(CreatePartnerDto) {}
```

### 6.2 `ContractNumberService` new signature

```typescript
@Injectable()
export class ContractNumberService {
  /**
   * F-066: generate contract number với 2-tier client name resolution.
   *
   * Priority:
   *   1. partnerShortName (admin override, highest) — nếu non-empty + valid
   *   2. entityName stripped prefix CTCP/CTYTNHH/... rồi sanitize uppercase
   *
   * Sequence: per-(year, clientShortName) Redis key.
   */
  async generateNumber(args: {
    signDate: Date;
    partnerShortName?: string | null;
    entityName: string;
    providerId: string;
  }): Promise<{ contractNumber: string; sequence: number; clientToken: string }>;

  /** Strip prefix pháp nhân VN (CTCP, CTY TNHH, CTYTNHHMTV, ...) khỏi entityName. */
  static stripCompanyPrefix(rawName: string): string;

  /** Atomic per-(year, client) sequence Redis INCR. */
  async nextSequence(year: number, clientShortName: string): Promise<number>;

  /** Read current sequence without incrementing (for preview). */
  async peekSequence(year: number, clientShortName: string): Promise<number>;
}
```

### 6.3 Strip prefix regex

```typescript
/**
 * F-066 BR-66-04: Strip prefix pháp nhân VN khỏi entityName 1 LẦN (idempotent).
 *
 * Prefix recognized (case-insensitive, có/không dấu, có/không space):
 *   - "CÔNG TY CỔ PHẦN" / "CONG TY CO PHAN" / "CTCP"
 *   - "CÔNG TY TNHH MỘT THÀNH VIÊN" / "CTY TNHH MTV" / "CTYTNHHMTV"
 *   - "CÔNG TY TNHH" / "CTY TNHH" / "CTYTNHH"
 *   - "CÔNG TY" / "CTY"
 *   - "DOANH NGHIỆP TƯ NHÂN" / "DNTN"
 *   - "HỢP TÁC XÃ" / "HTX"
 *
 * Implementation: normalize VN diacritics → uppercase → regex strip first match.
 */
const PREFIX_PATTERNS = [
  /^CONG\s*TY\s*CO\s*PHAN\b/i,
  /^CTCP\b/i,
  /^CONG\s*TY\s*TNHH\s*MOT\s*THANH\s*VIEN\b/i,
  /^CTY\s*TNHH\s*MTV\b/i,
  /^CTYTNHHMTV\b/i,
  /^CONG\s*TY\s*TNHH\b/i,
  /^CTY\s*TNHH\b/i,
  /^CTYTNHH\b/i,
  /^CONG\s*TY\b/i,
  /^CTY\b/i,
  /^DOANH\s*NGHIEP\s*TU\s*NHAN\b/i,
  /^DNTN\b/i,
  /^HOP\s*TAC\s*XA\b/i,
  /^HTX\b/i,
];
```

---

## 7. Business Rules (BR-66-*)

| BR | Rule |
|----|------|
| **BR-66-01** | Số HĐ giữ format `DD.MM/YYYY/HDDV/CLIENT-PROVIDER[-N]` (PAUSE-66-04 confirm) |
| **BR-66-02** | Token `CLIENT` được resolve theo priority: (1) `Partner.shortName` nếu non-empty + match `^[A-Z0-9]{1,16}$`, ngược lại (2) strip prefix `entityName` rồi sanitize uppercase + slice 16 |
| **BR-66-03** | Khi `Partner.shortName` rỗng VÀ `entityName` cũng rỗng/invalid → token = `"CLIENT"` (fallback constant, không throw) |
| **BR-66-04** | `stripCompanyPrefix(name)` chỉ strip 1 LẦN prefix đầu chuỗi. Không recursive. Sau strip → trim + normalize space → take initials hoặc full ≤16 chars |
| **BR-66-05** | Redis key sequence đổi sang `contracts:sequence:<year>:<clientShortName>`. Mỗi (year, clientShortName) atomic INCR riêng |
| **BR-66-06** | Sequence năm reset: 1/1 mọi năm, lần generate đầu tiên cho 1 client trả về `seq=1` (NO `-N` suffix theo F-024 convention) |
| **BR-66-07** | `seq=1` → KHÔNG có suffix `-N` (giữ backward compat F-024 BUG-002 fix). `seq≥2` → append `-${seq}` |
| **BR-66-08** | Backdate signDate: sequence key dùng `signDate.getFullYear()` (NOT today.year). Đồng nhất F-024 PAUSE-CODE-04 edge case 1 |
| **BR-66-09** | Forward-only: HĐ tạo trước deploy F-066 KHÔNG bị regenerate contractNumber (PAUSE-66-03) |
| **BR-66-10** | Update `Partner.shortName` sau deploy → CHỈ tác động HĐ generate sau lúc update. HĐ ACTIVE cũ giữ nguyên contractNumber (immutable) |
| **BR-66-11** | DTO `CreatePartnerDto.shortName` validate `@MaxLength(16)` + `@Matches(/^[A-Z0-9]+$/)`. Reject 400 trên backend nếu admin bypass client transform |
| **BR-66-12** | Admin UI auto-transform `shortName` input → `.toUpperCase().replace(/[^A-Z0-9]/g,'')` on blur (best-effort UX, backend là source of truth) |
| **BR-66-13** | Contract preview line trong wizard hiển thị "Dự kiến: `DD.MM/YYYY/HDDV/<clientToken>-<provider>`" dùng `peekSequence()` để không tăng counter |
| **BR-66-14** | Collision retry: nếu 5 lần INCR vẫn duplicate trong Mongo → throw 409 `"Số HĐ bị trùng — vui lòng đổi tên viết tắt đối tác và thử lại"` (giữ F-024 BUG-002 logic) |
| **BR-66-15** | Logging: mỗi lần `generateNumber()` → `Logger.warn` structured `{event:'contract_number_generated', year, clientToken, sequence, source: 'partnerShortName'|'entityName_stripped'}` |
| **BR-66-16** | KHÔNG migrate Redis key cũ `contracts:sequence:<year>`. Key cũ bỏ dở, không reused. Sequence năm 2026 cho mỗi client mới bắt đầu từ 1 (acceptable — chỉ ảnh hưởng counter, KHÔNG đụng HĐ ACTIVE cũ) |
| **BR-66-17** | Backend `partner.dto.ts` validation message tiếng Việt (không dùng class-validator default English). Manager BA rule "Mọi error message tiếng Việt cụ thể" |

---

## 8. Backend Test Cases (TC-66-*)

> Test file extension: `backend/src/modules/contracts/services/contract-number.service.spec.ts`
> Test fixture: dùng VN long names + diacritics (real-world). KHÔNG dùng "Co A".

### TC-66-01 — Strip CTCP prefix happy path
- **Setup:** `entityName="CÔNG TY CỔ PHẦN TÂM AN MEDIA"`, `partnerShortName=undefined`
- **Call:** `generateNumber({signDate: 2026-05-15, entityName, partnerShortName, providerId: '5BIB'})`
- **Expected output:** `contractNumber.includes('/HDDV/TAMANMEDIA-5BIB')` (initials/compact form ≤16) OR `/HDDV/TAM-5BIB` tuỳ rule chốt (BA prefer: strip prefix → take initials of remaining words → "TAM" 3 chars; nếu strip prefix → remaining 3 words "TAM AN MEDIA" → initials "TAM")
- **Sequence:** `seq=1`, key `contracts:sequence:2026:TAM`
- **MUST NOT leak:** internal Redis client object

### TC-66-02 — Strip CTYTNHH MTV prefix
- **Setup:** `entityName="CÔNG TY TNHH MỘT THÀNH VIÊN ABC XYZ"`, `partnerShortName=undefined`
- **Expected:** stripped → `"ABC XYZ"` → token `"AX"` (initials) or `"ABCXYZ"` (compact ≤16 — BA chốt compact)
- **Verify:** prefix MTV removed BEFORE TNHH (longest match first in regex array)

### TC-66-03 — Partner.shortName override (highest priority)
- **Setup:** `entityName="CÔNG TY CỔ PHẦN ABC"`, `partnerShortName="CUSTOM"`
- **Expected:** `contractNumber.includes('/HDDV/CUSTOM-5BIB')` (CUSTOM thắng, KHÔNG fallback về strip entityName)
- **Verify:** `Logger.warn` log có `source: 'partnerShortName'`

### TC-66-04 — Per-(year, client) sequence isolation
- **Setup:** 2 partners khác nhau (A: shortName="TAM", B: shortName="ABC"), cùng date 2026-05-15
- **Call:**
  - `r1 = generateNumber({entityName:'A', partnerShortName:'TAM', ...})`
  - `r2 = generateNumber({entityName:'B', partnerShortName:'ABC', ...})`
- **Expected:** `r1.sequence === 1` (key `contracts:sequence:2026:TAM`), `r2.sequence === 1` (key `contracts:sequence:2026:ABC`). HAI HĐ ĐỀU KHÔNG có suffix `-N`.
- **Verify:** `mockRedis.incr` called với 2 keys khác nhau

### TC-66-05 — Same client same year sequence increment
- **Setup:** same partner `shortName="TAM"`, 3 contracts cùng năm 2026
- **Expected:**
  - r1.contractNumber = `DD.MM/2026/HDDV/TAM-5BIB` (seq=1, no suffix)
  - r2.contractNumber = `DD.MM/2026/HDDV/TAM-5BIB-2`
  - r3.contractNumber = `DD.MM/2026/HDDV/TAM-5BIB-3`

### TC-66-06 — Year reset across new year
- **Setup:** partner `shortName="TAM"`, contract 1 ký 2026-12-31, contract 2 ký 2027-01-01
- **Expected:** r1.sequence=1 (key `:2026:TAM`), r2.sequence=1 (key `:2027:TAM`). r2 KHÔNG có suffix.
- **Verify:** 2 Redis keys distinct

### TC-66-07 — Backdate signDate uses signDate.year not today.year
- **Setup:** today=2027-01-15, signDate=2026-12-20, shortName="TAM"
- **Expected:** sequence key = `contracts:sequence:2026:TAM` (NOT 2027). Continue BR-66-08 + F-024 PAUSE-CODE-04.

### TC-66-08 — partnerShortName invalid (lowercase) — backend reject 400
- **Endpoint test:** POST `/api/partners` body `{entityName:"X", shortName:"tam"}` (lowercase)
- **Expected status:** `400`
- **Expected body:** `{statusCode:400, message:['Tên viết tắt phải in hoa và chỉ gồm A-Z 0-9'], error:'Bad Request'}`
- **Verify:** Mongo NOT insert (count unchanged)

### TC-66-09 — partnerShortName empty falls back to entityName strip
- **Setup:** `entityName="DNTN HOÀNG GIA"`, `partnerShortName=""` (empty string)
- **Expected:** strip "DNTN" → "HOÀNG GIA" → diacritics removed → `"HOANGGIA"` (≤16) → token `"HOANGGIA"` → contractNumber includes `/HDDV/HOANGGIA-5BIB`
- **Verify:** `Logger.warn` log `source: 'entityName_stripped'`

### TC-66-10 — entityName chỉ có prefix (edge — strip → empty)
- **Setup:** `entityName="CÔNG TY TNHH"`, `partnerShortName=undefined`
- **Expected:** strip → empty string → fallback `"CLIENT"` constant (BR-66-03). contractNumber includes `/HDDV/CLIENT-5BIB`. NO throw.

### TC-66-11 — Max length 16 truncation after strip
- **Setup:** `entityName="CÔNG TY CỔ PHẦN VERYLONGCOMPANYNAMETHATEXCEEDSLIMITS"`, `partnerShortName=undefined`
- **Expected:** strip "CTCP" → "VERYLONGCOMPANY..." → sanitize → `.slice(0,16)` → 16 chars max
- **Verify:** `contractNumber.split('/').pop().split('-')[0].length <= 16`

### TC-66-12 — Forward-only: existing HĐ contractNumber không bị regenerate
- **Setup:** seed Mongo 1 contract pre-F-066 với `contractNumber="01.01/2026/HDDV/OLDFORMAT-5BIB"` status ACTIVE
- **Action:** PATCH `/api/partners/{id}` đổi `shortName` từ "OLDFORMAT" → "NEW"
- **Expected:** PATCH 200. Contract cũ trong DB QUERY lại → `contractNumber` UNCHANGED. KHÔNG có background job regenerate.

### TC-66-13 — Concurrent generate same client (Redis INCR atomic)
- **Setup:** mock `Promise.all([generateNumber(A), generateNumber(A)])` với same shortName="TAM"
- **Expected:** 2 contractNumbers DISTINCT (1 có suffix `-2`). `mockRedis.incr` called 2 times with key `contracts:sequence:2026:TAM`.

### TC-66-14 — Collision retry exhausted → 409
- **Setup:** mock `model.exists()` always return truthy 5 lần
- **Expected:** `contracts.service.activate()` throw `ConflictException` với message tiếng Việt `"Số HĐ bị trùng — vui lòng đổi tên viết tắt đối tác và thử lại"`. HTTP response 409.

### TC-66-15 — Logger.warn structured output
- **Setup:** spy `Logger.warn` calls during `generateNumber`
- **Expected:** at least 1 call với object args matching `{event:'contract_number_generated', year:2026, clientToken:string, sequence:number, source:'partnerShortName'|'entityName_stripped'}`

---

## 9. Personas Affected & Acceptance

| Persona | Domain | Acceptance criteria |
|---------|--------|---------------------|
| **Sales Admin (Hằng)** | Tạo partner mới + activate HĐ | (1) Field "Tên viết tắt" hiển thị helper text VN. (2) Sai format → toast VN cụ thể. (3) Activate HĐ → số HĐ preview match số HĐ thực tế. (4) HĐ thứ 2 cùng client cùng ngày có `-2` suffix. |
| **Sales Admin nhiều partners** | Quản lý 10+ partners trong năm | Mỗi partner contract đầu tiên trong năm KHÔNG có suffix `-N`. Sequence isolation per-client visible. |
| **Document Generator** | Export DOCX dùng contractNumber | DOCX render đúng contractNumber mới (TAM-5BIB) thay vì CTCPTAMAN. Verify cross template tax-included + tax-excluded. |
| **Existing contract holder** | HĐ cũ ACTIVE pre-F-066 | Sau deploy, mở HĐ cũ → contractNumber UNCHANGED. Edit Partner.shortName → HĐ cũ KHÔNG mutate (forward-only). |
| **Audit / Finance** | Track sequence per client per year | Báo cáo "HĐ trong năm X cho client Y" — count rõ ràng, không bị lẫn với client khác. |

---

## 10. Performance & Risk

### Performance impact
- **Negligible.** Redis INCR atomic O(1) per call. Key cardinality tăng từ `~1 key/year` (~5 keys total ever) → `~N_partners × 1 key/year` (~58 tenants × 5 years = 290 keys). Acceptable cho Redis memory.
- Strip prefix regex: <1ms per call (regex array length 14, anchored at `^`, early return on first match).
- No new Mongo query — service-level pure compute.

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing HĐ cũ gì show số HĐ inconsistent với pattern mới | High (by design — PAUSE-66-03 forward-only) | Low (visual cosmetic, không break logic) | Document trong release note + admin UI banner |
| Admin nhập shortName trùng với partner khác → sequence overlap | Medium | Medium (số HĐ có thể "lệch" — vd partner A nhập shortName "TAM" thấy seq=5 vì partner B trước đó dùng "TAM") | Backend pre-check uniqueness `partners.findOne({shortName})` khi create — return 409 "shortName đã được dùng". **Bổ sung BR-66-18 nếu PM xác nhận.** |
| Race condition: 2 admin tạo HĐ cùng ms cho cùng client | Low | Low | Redis INCR atomic + collision retry 5 lần (F-024 BUG-002 logic giữ nguyên) |
| Redis key migration cũ `:<year>` orphan | Low | Trivial | Bỏ lửng — Redis TTL không set, ~5 keys cũ tồn tại forever. Acceptable. |

### Open question (cần PM xác nhận trước /5bib-plan)
- **OQ-66-01:** Có pre-check uniqueness `Partner.shortName` không? Nếu có → cần thêm Mongo index `{shortName: 1}` sparse + BR-66-18 + TC-66-16. BA recommend: **YES** — tránh confusion sequence sharing. Đợi Manager Plan chốt.

---

## 11. Files Touched (Scope Lock cho Coder)

### Backend
- `backend/src/modules/contracts/services/contract-number.service.ts` — MODIFY: signature + stripCompanyPrefix helper + per-(year,client) key
- `backend/src/modules/contracts/services/contract-number.service.spec.ts` — EXTEND: +15 TC-66-* tests
- `backend/src/modules/contracts/services/contracts.service.ts` — MODIFY: `activate()` block 890-897 → call new service signature, drop hand-built acronym
- `backend/src/modules/contracts/dto/partner.dto.ts` — MODIFY: `shortName` add `@MaxLength` + `@Matches` + VN messages
- `backend/src/modules/contracts/schemas/partner.schema.ts` — NO CHANGE (field exists)

### Admin
- `admin/src/app/(dashboard)/contracts/_components/partner-picker.tsx` — MODIFY: add placeholder + helper text + onBlur uppercase transform for `shortName` input
- `admin/src/app/(dashboard)/contracts/_components/contract-wizard.tsx` — ADD: preview "Dự kiến số HĐ" line dưới Partner card khi đã chọn partner + có signDate
- `admin/src/lib/api-generated/` — REGENERATE via `pnpm generate:api` sau khi backend DTO update

### Out of scope (KHÔNG đụng)
- `contract-render.service.ts`
- `contract-templates.controller.ts`
- Audit log persistence (Logger.warn đủ cho MVP)

---

**END PRD v1.0** — Sẵn sàng cho `/5bib-plan` (Manager).
