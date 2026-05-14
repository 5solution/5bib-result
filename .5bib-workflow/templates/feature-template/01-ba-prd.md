# FEATURE-XXX: PRD — [Tên feature]

**Status:** 🔵 DRAFT → 🔵 READY khi BA xong
**Last updated:** YYYY-MM-DD
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check (BA bắt buộc)

- [ ] Đã đọc `00-manager-init.md`
- [ ] Đã trả lời tất cả PAUSE conditions trong file 00 (xem section cuối)
- [ ] Đã đọc `memory/codebase-map.md` cho module liên quan
- [ ] Đã đọc `memory/known-issues.md` cho vùng có risk

---

## 📝 [Epic Title]

**Goal:** [1–2 câu mục tiêu nghiệp vụ]
**Scope:**
- ✅ In scope: [list]
- ❌ Out of scope: [list]

---

## 👤 User Stories & Business Rules

### User Stories
> Format: As a [Persona], I want [Action] so that [Benefit].

- As a **[Race Organizer / Athlete / Back-Office Admin / Anonymous Visitor]**, I want ... so that ...

### Business Rules (BR-XX)

- **BR-01:** [Rule]
- **BR-02:** [Rule]
- ...

---

## 🖥️ UI/UX Flow — STEP-BY-STEP CHI TIẾT (Manager 2026-05-14 directive)

> **Quy định BẮT BUỘC:** Danny instruction sau session 2026-05-14 "code ra rất khó hiểu và UI/UX rất tệ". BA PHẢI mô tả TỪNG STEP user thấy gì + click gì + nhập gì + UI hiện gì. Tránh "vague descriptions" như "user xem list" — phải là "user thấy table 5 cột STT/Tên/MST/Đại diện/Email, hover row hiện shadow, click row navigate `/contracts/{id}`".

### Screen 1: [Name] — Route: `[/path]`

**Layout & Visible data:**
- Header: [tên + buttons gì + breadcrumb]
- Body: [table/form/card layout cụ thể]
- Footer: [pagination / actions]

**Field-by-field data source (mỗi field 1 hàng):**

| Field UI label | Data source | Format hiển thị | Empty state |
|----------------|-------------|-----------------|-------------|
| Tên đối tác | `partner.entityName` (MongoDB) | text VN | "—" |
| MST | `partner.taxId` | font-mono | "—" |
| Lãi/Lỗ | computed: `revenue - totalCost` | VND vi-VN locale | "0 đ" |

### UI Step-by-Step (numbered, click-by-click)

> Format: NUMBERED steps, mỗi step = 1 user action concrete + UI behavior + state transition.

#### Journey 1: [Mục đích, vd "Tạo HĐ mới"]

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Click button "Tạo HĐ" header `/contracts` | Navigate `/contracts/create` wizard step 1 | Next.js Link | Wizard mounted, step 1 active |
| 2 | Select dropdown "Loại hợp đồng" → chọn "Dịch vụ tính giờ" | Trigger hiển thị VN label (KHÔNG `TIMING` raw) | `<Select.Value>{(v)=>LABEL[v]}</Select.Value>` | state.contractType = "TIMING" |
| 3 | Click radio "Provider 5BIB" | Card highlighted blue border | onClick patch state | state.providerId = "5BIB" |
| 4 | Click "Tiếp tục" | Bottom-right button enabled khi cả 3 field filled, navigate step 2 | Step validation | Step 2 active |
| 5 | ... | ... | ... | ... |

#### Journey 2: [Mục đích phụ, vd "Edit DRAFT HĐ"]
[Same numbered table structure]

### Buttons spec table (mọi button trong feature)

| Button label | Position | Default state | Disabled state | Loading state | Action | Confirm dialog? |
|--------------|----------|---------------|----------------|---------------|--------|-----------------|
| "Tạo HĐ" | Header right | Primary blue | KHÔNG | Spinner + "Đang tạo..." | POST `/api/contracts` | NO |
| "Xoá" | Row action | Ghost red icon | Disabled khi status != DRAFT | N/A | DELETE `/api/contracts/:id` | YES — "Xoá HĐ {name}?" |
| "Chỉnh sửa" non-DRAFT | Detail header | Outline | KHÔNG (F-034 unlock) | N/A | Confirm dialog → mở edit dialog | YES — status-aware warning |

### Form Fields Specification (mọi input trong feature)

> BA bắt buộc fill table này cho mỗi form. Coder dùng để viết DTO + validation; QC dùng để test boundary.

| Field name | UI label | Type | Required | Validation | Error message | Default |
|------------|----------|------|----------|------------|---------------|---------|
| `entityName` | Tên đối tác | text | ✅ | min 1 char, max 255 char, trim | "Tên đối tác bắt buộc" | "" |
| `taxId` | Mã số thuế | text | ⚪ | regex `^[0-9]{10}(-[0-9]{3})?$` | "MST sai format (10 chữ số hoặc 10-3)" | null |
| `email` | Email | email | ⚪ | regex `^[^\s@]+@[^\s@]+\.[^\s@]+$` | "Email không hợp lệ" | null |
| `cost` | Giá vốn | number | ⚪ | min 0, integer | "Giá vốn phải ≥ 0" | 0 |
| `discount` | Giảm % | number | ⚪ | min 0, max 100 | "Giảm phải 0–100%" | 0 |

### UI States — TỪNG state PHẢI có

> Manager `/5bib-plan` REJECT nếu thiếu state.

- **Loading**: skeleton hoặc spinner — KHÔNG flash empty
- **Empty**: icon + heading + description + CTA "Tạo mới"
- **Data**: table/cards layout
- **Filtered + empty**: "Không có kết quả khớp filter" + suggest clear filter
- **Error fetch**: toast đỏ + retry button
- **Submitting**: button loading state, disable form
- **Success**: toast green + redirect/refresh
- **Validation error**: field-level red + scroll-to-error
- **Confirm dialog**: destructive variant với cảnh báo nội dung action

---

## 🛠️ Technical Mandates (For Coder)

### DB Changes
- MongoDB: collection `[name]`, field thêm, index?
- Redis: key pattern + TTL (theo Redis Keys Registry)
- S3: prefix mới, lifecycle policy
- Migration script needed? — IF yes, 🛑 PAUSE Manager

### Backend (NestJS) — STRUCTURED SPEC

**Endpoint 1: `[METHOD] /api/[path]`**

| Element | Spec |
|---------|------|
| Method | POST |
| Path | `/api/partners` |
| Auth | `@UseGuards(LogtoStaffGuard)` class-level |
| Guard role | staff hoặc admin |
| Request body DTO | `CreatePartnerDto` |
| Response DTO | `PartnerResponseDto` |
| Status codes | 201 success / 400 validation / 401 no auth / 403 insufficient role / 409 dup taxId / 500 server |
| Side effects | Audit log emit `partner.create` / Redis cache invalidate `partners:*` |

**DTO field-level spec (mỗi DTO):**

```typescript
class CreatePartnerDto {
  @ApiProperty({ description: 'Tên pháp nhân đối tác', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  entityName!: string;

  @ApiPropertyOptional({ description: 'MST format 10 hoặc 10-3', pattern: '^[0-9]{10}(-[0-9]{3})?$' })
  @IsOptional()
  @Matches(/^[0-9]{10}(-[0-9]{3})?$/, { message: 'MST sai format' })
  taxId?: string;

  // ... field còn lại
}
```

[Repeat block cho mỗi endpoint trong feature]

### Frontend / Admin (Next.js)
- Server Component vs Client Component — declare per page/component
- TanStack Query hook từ generated SDK — KHÔNG fetch thủ công
- Sau mutation: `revalidatePath()` hoặc `revalidateTag()`?
- Cần update SDK: `pnpm generate:api`
- Base UI Select.Value render prop pattern (VN labels)
- Dialog overrides cho `sm:max-w-sm` shadcn default (F-032 lesson)
- Picker collapse pattern (UX-PICKER-COLLAPSE) cho picker với list

---

## 🛡️ Testing Mandates (For QC) — INPUT/OUTPUT EXPLICIT (Manager 2026-05-14)

> **Quy định BẮT BUỘC:** BA viết test case structured với INPUT cụ thể + EXPECTED OUTPUT shape. Coder dùng để viết unit test; QC dùng để viết E2E test. Không viết "test happy path" — viết "POST /api/partners với body `{entityName:'X', taxId:'0123456789'}` → expect 201 + response `{id, entityName, taxId, createdAt}` (không có `_id` raw)".

### Backend Test Cases — TC-XX format

#### TC-01 Happy path — Create partner đầy đủ field

| Element | Value |
|---------|-------|
| Method | POST |
| URL | `/api/partners` |
| Headers | `Authorization: Bearer <staff_token>`, `Content-Type: application/json` |
| Body | `{"entityName":"CÔNG TY ABC","taxId":"0123456789","email":"a@b.com"}` |
| Expected status | 201 |
| Expected body shape | `{"id":"<oid>","entityName":"CÔNG TY ABC","taxId":"0123456789","email":"a@b.com","createdAt":"<iso>","updatedAt":"<iso>"}` |
| MUST NOT leak | `_id` raw, `__v`, internal `createdBy` |
| Side effect verify | MongoDB partners collection has 1 new doc; Redis `partners:*` cache flushed; AuditLog has entry `partner.create` |

#### TC-02 Validation fail — taxId sai format

| Element | Value |
|---------|-------|
| Method | POST |
| URL | `/api/partners` |
| Body | `{"entityName":"X","taxId":"abc-123"}` (regex fail) |
| Expected status | 400 |
| Expected body | `{"statusCode":400,"message":["MST sai format"],"error":"Bad Request"}` |

#### TC-03 Duplicate taxId — return 409

| Element | Value |
|---------|-------|
| Setup | Partner tồn tại với `taxId=0123456789` |
| Method | POST |
| Body | `{"entityName":"Y","taxId":"0123456789"}` |
| Expected status | 409 |
| Expected body | `{"statusCode":409,"message":"Duplicate taxId","code":"PARTNER_DUP_TAXID"}` |

#### TC-04 Auth missing — 401
[Same table structure]

#### TC-05 IDOR — user A access partner B
[Same structure]

#### TC-06 Concurrent create — race condition
[Same structure with concurrent Promise.all assertion]

#### TC-07 Boundary — entityName max 255 char
[Same structure]

### Frontend E2E Test Cases — Playwright

| TC | Persona | Journey | Steps | Expected |
|----|---------|---------|-------|----------|
| E2E-01 | Sales Admin | Tạo partner mới | 1. `/contracts/partners` 2. Click "Tạo mới" 3. Fill form 4. Submit | Toast success, list refresh |
| E2E-02 | Sales Admin | Tạo dup taxId | Same as E2E-01 với taxId tồn tại | Toast error VN, form giữ data |
| E2E-03 | Operations | Import 50 partners | Upload Excel, preview, confirm | 42 inserted + 3 dup + 5 invalid breakdown shown |
| ... | ... | ... | ... | ... |

### Security Checks
- [ ] Endpoint protected by `LogtoStaffGuard` — verify 401 unauth
- [ ] IDOR — user A KHÔNG access partner của tenant khác (nếu áp dụng)
- [ ] Response KHÔNG leak: `_id`, `__v`, internal fields, MongoDB error stack
- [ ] Field strip mà có inject `id` alias từ `_id` cho frontend ref

### Performance SLA
- Response time p95 < [Xms] (cụ thể số)
- Cache hit ratio > [N%]
- 10x flaky test cho critical path (concurrent + boundary)

---

## 📌 Answers to Manager's PAUSE conditions (từ file 00)

- **[PAUSE Q1]** → [Answer]
- **[PAUSE Q2]** → [Answer]

---

## ✅ Status

- [ ] DRAFT — đang viết
- [ ] READY — sẵn sàng cho `/5bib-plan`

---

## 🔗 Next step

Danny chạy: `/5bib-plan FEATURE-XXX-[slug]`
