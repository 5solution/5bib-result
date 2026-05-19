# FEATURE-043: PRD — Reconciliation Per-Event Fee Rate Override

**Status:** 🔵 READY
**Last updated:** 2026-05-19
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`
**Danny chốt 2026-05-19:** Toàn bộ 8 PAUSE-43-* đều Option A (Manager recommended)

---

## 📌 Pre-flight check (BA)

- [x] Đã đọc `00-manager-init.md` đầy đủ (251 dòng + 8 PAUSE conditions)
- [x] Đã đọc `memory/codebase-map.md` — reconciliation + merchant + finance modules
- [x] Đã đọc `memory/known-issues.md` — TD-F016-FINANCE-01 + TD-F029-INHERITED-CTRL-SPEC
- [x] **Đã spot-check code thật:**
  - `merchant-config.schema.ts` — current shape verified
  - `merchant.service.ts:196-279` — `updateFee()` audit-history pattern reuse
  - `fee.service.ts:585-625` — F-040 3-tier cascade structure (`config.service_fee_rate → contract.revenueShare → 5.5%`)
  - `reconciliation.service.ts:127-156` — feeRate computation via `configModel.findOne({tenantId})`
  - `merchant.controller.ts` — existing 7 endpoints pattern
  - F-033 `RaceReadonly` entity in `promo-hub/entities/` — cross-DB validation pattern

---

## 📝 Reconciliation Per-Event Fee Rate Override

**Goal:** Cho phép admin cấu hình mức phí riêng cho từng sự kiện của 1 merchant (override `merchant.service_fee_rate` default), với versioning theo ngày hiệu lực + audit log đầy đủ.

**Scope:**

- ✅ **In scope:**
  - Add nested array `event_fee_overrides[]` vào `MerchantConfig` schema (3 fields nullable: `service_fee_rate`, `manual_fee_per_ticket`, `fee_vat_rate` + `raceId` + `effective_from` + `note` + audit trail)
  - 4 NEW REST endpoints CRUD override cho `/api/merchants/:id/event-fee-overrides`
  - Extend `fee.service.ts:computeSelfFee()` cascade từ 3-tier sang **4-tier** (event override TIER 0 → merchant default TIER 1 → contract revenueShare TIER 2 → 5.5% default TIER 3)
  - Update `reconciliation-calc.service.ts` để resolve fee per (tenantId + raceId)
  - Admin UI: Accordion "Cấu hình phí theo sự kiện" trong tab Tổng quan `/admin/merchants/[id]`
  - NEW component `EventFeeOverrideManager.tsx` (list + add dialog + delete confirm)
  - Race picker reuse F-040 / F-033 (MySQL platform via `RaceReadonly`)
  - Reconciliation preview banner hiển thị nguồn fee (Override / Merchant default / Contract / 5.5% default)
  - Audit log: extend `merchant_fee_histories` collection thêm `fee_field='event_override.<raceId>.<field>'`

- ❌ **Out of scope:**
  - Multi-merchant batch override (1 admin chỉ override 1 merchant 1 lần)
  - Retroactive recompute existing recons (BR-43-12 — snapshot preserved)
  - Override cho contract types khác TICKET_SALES (per Danny PAUSE-43-04 Option A)
  - Staff role override permission (per Danny PAUSE-43-05 Option A — chỉ ADMIN)
  - Effective date range `effective_to` (chỉ `effective_from` per Danny PAUSE-43-02 Option A)

---

## 👤 User Stories & Business Rules

### User Stories

- As an **Admin (Logto admin role)**, I want to set custom fee rate cho từng sự kiện của merchant Cát Tiên Adventure so that "Cát Tiên Jungle Paths" áp 7% và "Cát Tiên Trail Mini" áp 5% (thay vì cùng 6% như merchant default).
- As a **Finance Admin**, I want to see badge "Override theo sự kiện" trong reconciliation preview so that biết fee đến từ event-level override (không phải merchant default).
- As an **Admin**, I want versioning theo `effective_from` so that thay đổi mức phí trong tương lai mà không ảnh hưởng đối soát quá khứ.
- As a **5BIB Back-Office**, I want existing 58 merchant configs KHÔNG bị break sau F-043 deploy so that legacy behavior preserved.
- As a **5BIB Back-Office**, I want audit log đầy đủ cho create/update/delete override so that trace ai đã đổi fee khi nào.

### Business Rules

#### A. Schema & Storage

- **BR-43-01** (Sub-schema `EventFeeOverride`): Nested array `event_fee_overrides[]` trong `MerchantConfig` với shape:
  ```
  {
    raceId: number (required, MySQL platform race.id)
    service_fee_rate: number | null  // % phí dịch vụ — null = dùng merchant default
    manual_fee_per_ticket: number | null  // VNĐ/vé — null = dùng merchant default
    fee_vat_rate: number | null  // % VAT trên fee — null = dùng merchant default
    effective_from: string (YYYY-MM-DD, required)
    note: string | null  // ghi chú admin
    createdBy: number | null  // adminId
    createdAt: Date
    updatedAt: Date
  }
  ```
- **BR-43-02** (Lazy default): Existing 58 merchant configs có `event_fee_overrides = []` (empty array, Mongoose lazy default) — NO migration script needed.
- **BR-43-03** (Compound index): `{ tenantId: 1, 'event_fee_overrides.raceId': 1 }` cho fast override lookup.
- **BR-43-04** (Unique constraint per tenant+race): 1 cặp `(tenantId, raceId)` tối đa 1 override entry (không có versioning multi-row same race — Option A `effective_from` chỉ trỏ tới thời điểm chuyển đổi). Update mutates `effective_from` + `updatedAt`.

#### B. Fee Cascade Logic (4-Tier)

- **BR-43-05** (4-tier cascade): `computeSelfFee()` resolve `serviceFeeRate` theo thứ tự ưu tiên:
  1. **TIER 0 — Event override:** Lookup `event_fee_overrides` find entry với `raceId === mysqlRaceId` AND `effective_from <= periodFilter.periodFrom` → nếu found AND `service_fee_rate != null`, dùng giá trị này. Nếu effective_from > periodFrom → SKIP (chưa apply tại period đó).
  2. **TIER 1 — Merchant default:** Nếu Tier 0 không match, dùng `config.service_fee_rate` (current logic).
  3. **TIER 2 — Contract fallback:** Nếu Tier 1 null, dùng `contract.revenueShare.feePercentage`.
  4. **TIER 3 — Default:** Nếu cả 3 tier null, dùng `5.5%` hardcoded default.
- **BR-43-06** (Same cascade cho `manual_fee_per_ticket` + `fee_vat_rate`): Mỗi field độc lập cascade theo cùng pattern 4-tier (event override → merchant default → 5000/0 default). Vì `manual_fee_per_ticket` + `fee_vat_rate` không có tier contract fallback (contract chỉ có % fee), tier 2 skipped, tier 3 = hardcoded default.
- **BR-43-07** (Effective date semantics): `effective_from` ngày bắt đầu áp dụng override. Recon period `periodFrom < effective_from` → override KHÔNG áp dụng (dùng tier 1). Recon `periodFrom >= effective_from` → override áp dụng.

  Ví dụ: Override 5% effective_from `2026-07-01`. Recon period `2026-06-01..2026-06-30` → KHÔNG dùng override (dùng merchant default). Recon period `2026-07-01..2026-07-31` → DÙNG override 5%.

- **BR-43-08** (Snapshot preserved): Existing reconciliations có `fee_rate_applied` field đã chốt tại thời điểm tạo → F-043 KHÔNG retroactive recompute. Chỉ áp dụng cho future recons + dashboard P&L aggregate.

#### C. Endpoints

- **BR-43-09** (Admin-only access): Tất cả 4 endpoints require `@UseGuards(LogtoAdminGuard)` (KHÔNG staff role).
- **BR-43-10** (Cross-DB validation): Khi create/update override, backend validate `raceId` tồn tại trong MySQL `races` table via `RaceReadonly` entity (named connection `'platform'`). Trả 400 nếu raceId không tồn tại.
- **BR-43-11** (Unique constraint): POST với (tenantId, raceId) đã tồn tại → 409 Conflict (yêu cầu admin PUT để update thay vì duplicate). Hoặc decision: POST upsert? → Decision: **POST = create only (409 if exists), PUT = update existing only (404 if not exists), DELETE = remove (404 if not exists)**.

#### D. Audit Log

- **BR-43-12** (Audit per field change): Tái sử dụng `MerchantFeeHistory` collection. Khi create/update/delete override, insert 1 history doc mỗi field changed với `fee_field = 'event_override.<raceId>.<field>'`. Ví dụ:
  - Create override raceId=12345 với service_fee_rate=7% → 1 history doc `fee_field='event_override.12345.service_fee_rate'`, `old_value=null`, `new_value='7'`
  - Update same override service_fee_rate=5% → 1 history doc `fee_field='event_override.12345.service_fee_rate'`, `old_value='7'`, `new_value='5'`
  - Delete override → 3 history docs (1 per field with `new_value=null`)
- **BR-43-13** (Audit retrieval): Endpoint `GET /api/merchants/:id/fee-history` (existing) phải return cả entries `event_override.*` để admin tra cứu lịch sử event override.

#### E. Cache Invalidation

- **BR-43-14** (Cache flush on override CUD): Khi POST/PUT/DELETE override → flush:
  - `pnl:*:tenant=<tenantId>` (F-040 pattern reuse)
  - `pnl:contracts-list:*` (F-038 pattern)
  - `merchant:fee-overrides:<tenantId>` (NEW key, TTL 3600s cached lookup list)
- **BR-43-15** (No cache stampede): Tái sử dụng F-040 rate-limited Logger pattern — chỉ log lần đầu khi cascade hit tier 2/3 (fallback warnings), không log mỗi request.

#### F. Reconciliation Display

- **BR-43-16** (Preview banner source): Reconciliation preview/create endpoint response thêm field `fee_source: 'event_override' | 'merchant_default' | 'contract_fallback' | 'platform_default'`. Admin UI dùng để render badge:
  - 🟢 "Override theo sự kiện" (event_override)
  - 🔵 "Mặc định merchant" (merchant_default)
  - 🟡 "Fallback hợp đồng" (contract_fallback)
  - ⚪ "Default 5.5%" (platform_default)

#### G. Contract Type Restriction

- **BR-43-17** (TICKET_SALES only): Override CHỈ ảnh hưởng đối soát TICKET_SALES (% phí trên doanh thu vé). Endpoint POST/PUT chấp nhận raceId của race bất kỳ (race != contract concept), nhưng cascade application chỉ active khi reconciliation đang process TICKET_SALES context. TIMING/RACEKIT/OPERATIONS fixed-price contracts KHÔNG đụng vào.

---

## 🖥️ UI/UX Flow

### Route — không thêm mới
- `/admin/merchants/[id]` — extend trang detail có sẵn

### Layout — Accordion section "Cấu hình phí theo sự kiện"

**Vị trí:** Trong tab "Tổng quan" (`page.tsx`), accordion section thêm DƯỚI phần "Phí mặc định" (service_fee_rate + manual_fee_per_ticket + fee_vat_rate hiện tại).

**Component mới:** `EventFeeOverrideManager.tsx`

#### Layout breakdown

**Accordion header (collapsed default):**
- Title: "Cấu hình phí theo sự kiện ({N} overrides)"
- Chevron toggle expand/collapse
- Badge số lượng overrides hiện tại

**Body (expanded):**

**Header row:**
- Title: "Override mức phí áp dụng cho từng sự kiện cụ thể"
- Button "+ Thêm override" (top-right, primary blue)

**Table list (sort by `effective_from DESC` mặc định):**

| # | Sự kiện | Phí DV (%) | Phí thủ công (VNĐ/vé) | VAT (%) | Hiệu lực từ | Ghi chú | Hành động |
|---|---------|------------|------------------------|---------|-------------|---------|-----------|
| 1 | Cát Tiên Trail (#12345) | 5.0 | 5.000 | 0 | 01/07/2026 | Promo Q3 | [✏️] [🗑️] |

- Tên sự kiện: từ `RaceReadonly.name` (cross-DB join via raceId)
- Field null (vd: `manual_fee_per_ticket=null`) hiển thị "—" (dùng merchant default)
- Truncate tooltip cho ghi chú dài (F-038 truncate pattern)

**Empty state:** Icon + heading "Chưa có override" + description "Mọi sự kiện đang dùng phí mặc định của merchant" + CTA button "+ Thêm override đầu tiên"

**Loading:** Skeleton 3 rows

### UI Step-by-Step — Tạo override

| # | Action | UI behavior | Trigger | Next state |
|---|--------|-------------|---------|------------|
| 1 | Click "+ Thêm override" trong accordion | Modal dialog mở, size `sm:max-w-lg` (F-032 lesson — KHÔNG dùng default sm) | onClick → setState dialogOpen=true | Dialog visible |
| 2 | Click "Chọn sự kiện" dropdown | Race picker mở (F-040 reuse) — list `RaceReadonly` của tenant này, search by tên | Race picker component | dropdown options visible |
| 3 | Type "Cát Tiên" → chọn "Cát Tiên Trail 2026 (#12345)" | Picker collapse → compact card "Cát Tiên Trail 2026 (#12345)" + button "Đổi" | onSelect handler | state.raceId = 12345 |
| 4 | Nhập service_fee_rate = 7 (decimal) | Field validate min 0, max 100, step 0.01 | onChange | state.service_fee_rate = 7 |
| 5 | Để trống manual_fee_per_ticket + fee_vat_rate | Field hiển thị placeholder "Dùng default merchant (5000)" / "(0)" | onChange | state.* = null |
| 6 | Chọn ngày `effective_from` = 01/07/2026 | DatePicker (existing component) | onChange | state.effective_from = "2026-07-01" |
| 7 | Nhập note "Promo Q3" (optional) | textarea max 200 chars + counter | onChange | state.note = "Promo Q3" |
| 8 | Click "Lưu override" | Button loading spinner. POST `/api/merchants/123/event-fee-overrides` | onClick → mutation | API call |
| 9 | Success | Modal close, toast green "Đã tạo override", list refresh (TanStack Query invalidate) | onSuccess | List shows new row |
| 9b | Error 409 (duplicate raceId) | Toast red "Đã tồn tại override cho sự kiện này — vui lòng dùng nút Sửa" | onError | Modal vẫn mở |
| 9c | Error 400 (invalid raceId / validation) | Field-level red + scroll-to-error | onError | Modal vẫn mở |

### UI Step-by-Step — Edit override

| # | Action | UI behavior | Trigger | Next state |
|---|--------|-------------|---------|------------|
| 1 | Click [✏️] trong row | Modal mở pre-filled current values | onClick | Dialog visible với data |
| 2 | Race picker DISABLED (không cho đổi raceId — phải xoá tạo mới) | Race row hiển thị read-only với hint "Để đổi sự kiện, vui lòng xoá và tạo mới" | DOM disabled attr | Lock |
| 3 | Sửa các field rate/manual_fee/vat/effective_from/note | Same validation as Create | onChange | state mutated |
| 4 | Click "Cập nhật" | PUT `/api/merchants/123/event-fee-overrides/12345` | onClick | API call |
| 5 | Success | Modal close, toast, list refresh | onSuccess | Done |

### UI Step-by-Step — Delete override

| # | Action | UI behavior | Trigger | Next state |
|---|--------|-------------|---------|------------|
| 1 | Click [🗑️] trong row | Confirm dialog: "Xoá override cho sự kiện {raceName}? Đối soát mới sẽ dùng phí mặc định merchant." | onClick → useConfirm() | Confirm visible |
| 2 | Click "Xoá" trong confirm | DELETE `/api/merchants/123/event-fee-overrides/12345` | onConfirm | API call |
| 3 | Success | Toast green "Đã xoá override", list refresh | onSuccess | Row removed |

### UI Step-by-Step — Reconciliation preview với fee source badge

| # | Action | UI behavior | Verification |
|---|--------|-------------|--------------|
| 1 | Admin tạo recon mới với `tenantId=123` + `raceId=12345` + period `2026-07-01..2026-07-31` | Preview endpoint call | Response includes `fee_source` field |
| 2 | Preview hiển thị "Phí áp dụng: 7% 🟢 Override theo sự kiện" badge | Component render badge per `fee_source` | Tooltip "Override theo sự kiện cho Race #12345, hiệu lực từ 01/07/2026" |
| 3 | Hover badge | Tooltip show full chi tiết override | UX hint |

### UI States (đầy đủ)

| State | Description |
|-------|-------------|
| **Loading list** | Skeleton 3 rows |
| **Empty** | Icon "phí" + heading "Chưa có override" + CTA |
| **Data loaded** | Table rows |
| **Filtered (search by race name)** | Filtered list OR "Không có kết quả" |
| **Error fetch** | Toast red + retry button |
| **Add dialog open** | Dialog với form fields |
| **Submitting** | Button spinner + form disabled |
| **Success POST/PUT/DELETE** | Toast green + modal close + list refresh |
| **Validation error** | Field-level red + scroll-to-error |
| **409 Conflict** | Toast red với thông báo cụ thể |
| **403 Forbidden (non-admin)** | Toast red "Chỉ admin mới có quyền cấu hình override" + hide form |

---

## 📊 Backend Endpoint Specifications

### Endpoint 1: GET `/api/merchants/:id/event-fee-overrides`

| Element | Spec |
|---------|------|
| Method | GET |
| Path | `/api/merchants/:id/event-fee-overrides` |
| Auth | `@UseGuards(LogtoAdminGuard)` class-level (existing pattern) |
| Guard role | admin |
| Path param | `id: number` (tenantId) |
| Response DTO | `EventFeeOverrideResponseDto[]` |
| Status codes | 200 success / 401 no auth / 403 not admin / 404 tenant not found / 500 server |
| Side effects | Read-only, cache layer key `merchant:fee-overrides:<tenantId>` (TTL 3600s) |

### Endpoint 2: POST `/api/merchants/:id/event-fee-overrides`

| Element | Spec |
|---------|------|
| Method | POST |
| Path | `/api/merchants/:id/event-fee-overrides` |
| Auth | `@UseGuards(LogtoAdminGuard)` |
| Path param | `id: number` (tenantId) |
| Body DTO | `CreateEventFeeOverrideDto` |
| Response DTO | `EventFeeOverrideResponseDto` (created entry) |
| Status codes | 201 created / 400 validation/invalid raceId / 401 no auth / 403 not admin / 404 tenant not found / 409 duplicate (tenantId+raceId already exists) / 500 server |
| Side effects | Push to `MerchantConfig.event_fee_overrides[]` + insert N `MerchantFeeHistory` docs (per field changed) + flush cache patterns `pnl:*:tenant=<tenantId>` + `pnl:contracts-list:*` + `merchant:fee-overrides:<tenantId>` |

### Endpoint 3: PUT `/api/merchants/:id/event-fee-overrides/:raceId`

| Element | Spec |
|---------|------|
| Method | PUT |
| Path | `/api/merchants/:id/event-fee-overrides/:raceId` |
| Auth | `@UseGuards(LogtoAdminGuard)` |
| Path params | `id: number` (tenantId), `raceId: number` |
| Body DTO | `UpdateEventFeeOverrideDto` (partial CreateDto, excluding raceId) |
| Response DTO | `EventFeeOverrideResponseDto` |
| Status codes | 200 ok / 400 validation / 401 no auth / 403 not admin / 404 override not found / 500 server |
| Side effects | Mutate sub-document by raceId match + insert N audit history docs (only fields changed) + cache flush |

### Endpoint 4: DELETE `/api/merchants/:id/event-fee-overrides/:raceId`

| Element | Spec |
|---------|------|
| Method | DELETE |
| Path | `/api/merchants/:id/event-fee-overrides/:raceId` |
| Auth | `@UseGuards(LogtoAdminGuard)` |
| Path params | `id: number`, `raceId: number` |
| Body | (none) |
| Response DTO | `{ success: true, deletedRaceId: number }` |
| Status codes | 200 ok / 401 / 403 / 404 / 500 |
| Side effects | `$pull` from array + insert 3 audit history docs (per field with new_value=null) + cache flush |

### DTO Specifications

#### `CreateEventFeeOverrideDto`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CreateEventFeeOverrideDto {
  @ApiProperty({
    description: 'MySQL platform race.id — phải tồn tại trong races table',
    example: 12345,
  })
  @IsInt({ message: 'raceId phải là số nguyên' })
  @Min(1, { message: 'raceId phải >= 1' })
  raceId!: number;

  @ApiPropertyOptional({
    description: '% phí dịch vụ — null = dùng merchant default',
    minimum: 0,
    maximum: 100,
    example: 7,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'service_fee_rate phải là số' })
  @Min(0, { message: 'service_fee_rate phải >= 0' })
  @Max(100, { message: 'service_fee_rate phải <= 100' })
  service_fee_rate?: number | null;

  @ApiPropertyOptional({
    description: 'Phí cố định VNĐ/vé cho đơn MANUAL — null = dùng merchant default',
    minimum: 0,
    example: 5000,
  })
  @IsOptional()
  @IsInt({ message: 'manual_fee_per_ticket phải là số nguyên' })
  @Min(0, { message: 'manual_fee_per_ticket phải >= 0' })
  manual_fee_per_ticket?: number | null;

  @ApiPropertyOptional({
    description: '% VAT trên fee — null = dùng merchant default',
    minimum: 0,
    maximum: 100,
    example: 8,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  fee_vat_rate?: number | null;

  @ApiProperty({
    description: 'Ngày bắt đầu áp dụng (YYYY-MM-DD)',
    example: '2026-07-01',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'effective_from phải format YYYY-MM-DD' })
  effective_from!: string;

  @ApiPropertyOptional({
    description: 'Ghi chú admin',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'note tối đa 200 ký tự' })
  note?: string | null;
}
```

#### `UpdateEventFeeOverrideDto`

```typescript
// Same as CreateDto MINUS raceId (raceId from path param, immutable)
export class UpdateEventFeeOverrideDto extends OmitType(
  CreateEventFeeOverrideDto,
  ['raceId'] as const,
) {}
```

#### `EventFeeOverrideResponseDto`

```typescript
export class EventFeeOverrideResponseDto {
  @ApiProperty()
  raceId!: number;

  @ApiPropertyOptional()
  raceName?: string;  // joined from RaceReadonly

  @ApiPropertyOptional({ nullable: true })
  service_fee_rate!: number | null;

  @ApiPropertyOptional({ nullable: true })
  manual_fee_per_ticket!: number | null;

  @ApiPropertyOptional({ nullable: true })
  fee_vat_rate!: number | null;

  @ApiProperty()
  effective_from!: string;

  @ApiPropertyOptional({ nullable: true })
  note!: string | null;

  @ApiPropertyOptional({ nullable: true })
  createdBy!: number | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
```

#### Reconciliation Preview Response Extension

```typescript
// Existing PreviewReconciliationResponseDto thêm field:
export class PreviewReconciliationResponseDto {
  // ... existing fields ...

  @ApiProperty({
    description: 'Nguồn fee rate được resolved',
    enum: ['event_override', 'merchant_default', 'contract_fallback', 'platform_default'],
  })
  fee_source!: 'event_override' | 'merchant_default' | 'contract_fallback' | 'platform_default';
}
```

---

## 🛠️ Technical Mandates

### DB / Cache changes

#### MongoDB

**`MerchantConfig` schema** (extend, NO migration needed):
```typescript
// Add to merchant-config.schema.ts
@Schema({ _id: false })
export class EventFeeOverride {
  @Prop({ type: Number, required: true, index: true })
  raceId: number;

  @Prop({ type: Number, default: null })
  service_fee_rate: number | null;

  @Prop({ type: Number, default: null })
  manual_fee_per_ticket: number | null;

  @Prop({ type: Number, default: null })
  fee_vat_rate: number | null;

  @Prop({ type: String, required: true })  // YYYY-MM-DD
  effective_from: string;

  @Prop({ type: String, default: null })
  note: string | null;

  @Prop({ type: Number, default: null })
  createdBy: number | null;
}
export const EventFeeOverrideSchema = SchemaFactory.createForClass(EventFeeOverride);

// In MerchantConfig:
@Prop({ type: [EventFeeOverrideSchema], default: [] })
event_fee_overrides: EventFeeOverride[];
```

**Index extension** (post-schema):
```typescript
// In MerchantConfig SchemaFactory.createForClass post-init:
MerchantConfigSchema.index({ tenantId: 1, 'event_fee_overrides.raceId': 1 });
```

#### Redis

- ✏️ Reuse `pnl:*:tenant=<tenantId>` pattern (F-040)
- ✏️ Reuse `pnl:contracts-list:*` (F-038)
- ➕ NEW: `merchant:fee-overrides:<tenantId>` TTL 3600s (cached list)

### Backend service extensions

**`merchant.service.ts`** — Add methods:
- `listEventFeeOverrides(tenantId: number): Promise<EventFeeOverrideResponseDto[]>` (with raceName join via RaceReadonly)
- `createEventFeeOverride(tenantId: number, dto: CreateDto, adminId: number): Promise<EventFeeOverrideResponseDto>` (validate raceId existence via RaceReadonly, throw 409 if duplicate, emit fee history)
- `updateEventFeeOverride(tenantId: number, raceId: number, dto: UpdateDto, adminId: number): Promise<EventFeeOverrideResponseDto>` (throw 404 if not exists)
- `deleteEventFeeOverride(tenantId: number, raceId: number, adminId: number): Promise<{success, deletedRaceId}>`

**`fee.service.ts:computeSelfFee()` extension** — Insert Tier 0 lookup:
```typescript
private async computeSelfFee(
  mysqlRaceId: number,
  tenantId: number,
  contract: ContractDocument,
  periodFilter?: { periodFrom: Date | string; periodTo: Date | string },
): Promise<...> {
  // ... existing ...
  let serviceFeeRate: number;
  let manualFeePerTicket: number;
  let feeVatRate: number;
  let feeSource: 'event_override' | 'merchant_default' | 'contract_fallback' | 'platform_default';

  const config = await this.merchantConfigModel.findOne({ tenantId }).lean();

  // BR-43-05 Tier 0 — event override lookup
  const periodFromStr = periodFilter?.periodFrom ? this.toIsoDate(periodFilter.periodFrom) : null;
  const override = config?.event_fee_overrides?.find(
    (o) => o.raceId === mysqlRaceId
      && (!periodFromStr || o.effective_from <= periodFromStr)
  );

  if (override?.service_fee_rate != null) {
    serviceFeeRate = Number(override.service_fee_rate);
    feeSource = 'event_override';
  } else if (config?.service_fee_rate != null) {
    serviceFeeRate = Number(config.service_fee_rate);
    feeSource = 'merchant_default';
  } else if (c.revenueShare?.feePercentage != null) {
    serviceFeeRate = Number(c.revenueShare.feePercentage);
    feeSource = 'contract_fallback';
    rateFallbackWarning = '...';
  } else {
    serviceFeeRate = 5.5;
    feeSource = 'platform_default';
  }

  // Same cascade for manual_fee_per_ticket + fee_vat_rate (3-tier each, no contract fallback)
  manualFeePerTicket = override?.manual_fee_per_ticket
    ?? config?.manual_fee_per_ticket
    ?? 5000;
  feeVatRate = override?.fee_vat_rate
    ?? config?.fee_vat_rate
    ?? 0;

  // ... rest of compute ...

  return { ..., feeSource };  // expose to caller
}
```

**`reconciliation.service.ts:previewReconciliation()` extension** — Return `fee_source` in response:
```typescript
const { feeRate, feeSource } = await this.feeService.computeSelfFee(...);
return { ..., fee_source: feeSource };
```

### Audit log pattern (reuse F-024)

```typescript
// Insert per field changed in createEventFeeOverride / updateEventFeeOverride
const history: Partial<MerchantFeeHistory> = {
  tenantId,
  fee_field: `event_override.${raceId}.service_fee_rate`,
  old_value: oldVal != null ? String(oldVal) : null,
  new_value: newVal != null ? String(newVal) : null,
  changed_by: adminId,
  note,
};
await this.feeHistoryModel.create(history);
```

### Frontend / Admin

**Page:** `admin/src/app/(dashboard)/merchants/[id]/page.tsx` — Add accordion section
**NEW component:** `admin/src/app/(dashboard)/merchants/_components/event-fee-override-manager.tsx`
**API client:** `admin/src/lib/merchants-api.ts` — Add 4 helpers (list/create/update/delete) + RaceReadonly fetch for picker

**SDK regeneration:** YES required — `pnpm --filter admin generate:api` post-backend deploy DTO changes.

### PAUSE flags

- 🛑 NO migration script needed (lazy default `[]`)
- 🛑 NO `pnpm install` new deps
- 🛑 NO auth/security boundary change (admin guard reuse)
- 🛑 Breaking API: PreviewReconciliationResponseDto adds `fee_source` field → backward compat (consumer can ignore if not used)
- 🛑 Fee calculation logic change → CRITICAL test coverage required (Manager Code Review focus)

---

## 🛡️ Testing Mandates

### Backend TC-43-XX

#### TC-43-01 — GET list happy path
| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/merchants/123/event-fee-overrides` |
| Headers | `Authorization: Bearer <admin_token>` |
| Pre-condition | MerchantConfig tenantId=123 có 2 overrides |
| Expected status | 200 |
| Expected body shape | `[{raceId, raceName, service_fee_rate, ...}, ...]` sorted by effective_from DESC |
| MUST NOT leak | `_id` của sub-doc raw |
| Side effect | Read-only |

#### TC-43-02 — POST happy path
| Element | Value |
|---------|-------|
| Method | POST |
| URL | `/api/merchants/123/event-fee-overrides` |
| Body | `{raceId: 12345, service_fee_rate: 7, effective_from: "2026-07-01", note: "Promo Q3"}` |
| Expected status | 201 |
| Expected body | EventFeeOverrideResponseDto with `raceName` joined |
| Side effect | MerchantConfig pushed entry + 1 MerchantFeeHistory doc + cache flush 3 patterns |

#### TC-43-03 — POST duplicate raceId → 409
| Pre-condition | Override (tenantId=123, raceId=12345) already exists |
| Body | Same raceId |
| Expected status | 409 |
| Expected body | `{message: 'Override cho sự kiện #12345 đã tồn tại — dùng PUT để cập nhật', code: 'EVENT_OVERRIDE_DUPLICATE'}` |

#### TC-43-04 — POST invalid raceId → 400
| Body | `{raceId: 99999999}` (không tồn tại trong MySQL races) |
| Expected status | 400 |
| Expected body | `{message: 'Race #99999999 không tồn tại', code: 'RACE_NOT_FOUND'}` |
| Side effect | NO MerchantConfig mutation, NO history doc |

#### TC-43-05 — PUT happy path
| Method | PUT |
| URL | `/api/merchants/123/event-fee-overrides/12345` |
| Body | `{service_fee_rate: 5}` (partial) |
| Expected status | 200 |
| Side effect | Update sub-doc + 1 history doc (service_fee_rate old→new) |

#### TC-43-06 — DELETE happy path
| Method | DELETE |
| URL | `/api/merchants/123/event-fee-overrides/12345` |
| Expected status | 200 |
| Expected body | `{success: true, deletedRaceId: 12345}` |
| Side effect | `$pull` from array + 3 history docs (per field with new_value=null) + cache flush |

#### TC-43-07 — Non-admin → 403
| Headers | `Authorization: Bearer <staff_token>` |
| Endpoint | POST or PUT or DELETE |
| Expected status | 403 |
| Expected body | LogtoAdminGuard rejection |

#### TC-43-08 — Cascade tier 0 (event override applied)
Pre-condition: tenant=123 + race=12345 + override with service_fee_rate=7%, effective_from='2026-07-01'. Recon period: '2026-07-01..2026-07-31'.
| Method | Direct service call `feeService.computeSelfFee(12345, 123, contract, {periodFrom: '2026-07-01'})` |
| Expected | `serviceFeeRate=7`, `feeSource='event_override'` |

#### TC-43-09 — Cascade tier 0 SKIPPED (effective_from > periodFrom)
Pre-condition: same override (effective_from='2026-07-01'). Recon period: '2026-06-01..2026-06-30'.
| Expected | `serviceFeeRate = config.service_fee_rate` (tier 1), `feeSource='merchant_default'` |

#### TC-43-10 — Cascade tier 1 (no override match)
Pre-condition: tenant=123, race=99 (no override). Config service_fee_rate=6.
| Expected | `serviceFeeRate=6`, `feeSource='merchant_default'` |

#### TC-43-11 — Cascade tier 2 (no override, no merchant default)
Pre-condition: config.service_fee_rate=null. Contract.revenueShare.feePercentage=8.
| Expected | `serviceFeeRate=8`, `feeSource='contract_fallback'` + log warn |

#### TC-43-12 — Cascade tier 3 (all null → 5.5%)
Pre-condition: config null + contract.revenueShare null.
| Expected | `serviceFeeRate=5.5`, `feeSource='platform_default'` + log warn |

#### TC-43-13 — Audit log per field on POST
| Pre-condition | POST với 3 fields set (rate=7, manual=4500, vat=8) |
| Expected | 3 MerchantFeeHistory docs với fee_field=`event_override.12345.service_fee_rate` / `event_override.12345.manual_fee_per_ticket` / `event_override.12345.fee_vat_rate` |
| Verify | old_value=null, new_value chính xác, changed_by=adminId |

#### TC-43-14 — Cache flush on mutation
| Pre-condition | Redis có 3 keys: `pnl:dashboard:tenant=123:x`, `pnl:contracts-list:hash1`, `merchant:fee-overrides:123` |
| Mutation | POST override |
| Expected | 3 keys deleted post-mutation |
| Verify | `redis.exists()` returns 0 |

#### TC-43-15 — Race condition: concurrent POST same raceId
| Method | `Promise.all([POST, POST])` cùng raceId |
| Expected | 1 success (201), 1 fail (409) |
| Verify | DB chỉ có 1 entry (no duplicate) |

#### TC-43-16 — Backward compat: existing recons preserved
| Pre-condition | Recon đã tạo trước F-043 với `fee_rate_applied=6%` (snapshot) |
| Mutation | POST override 7% cho cùng race |
| Expected | Existing recon `fee_rate_applied` vẫn 6% (KHÔNG retroactive) — verify via DB read |

#### TC-43-17 — Preview shows fee_source
| Method | POST `/api/reconciliations/preview` |
| Pre-condition | Override exists + match period |
| Expected response | `fee_source: 'event_override'` |

### Frontend E2E Test Cases (Playwright)

| TC | Persona | Journey | Expected |
|----|---------|---------|----------|
| E2E-43-01 | Admin | Tạo override mới | Modal open → fill form → submit → toast success + list refresh |
| E2E-43-02 | Admin | Tạo dup raceId | Toast red "đã tồn tại" + form giữ data |
| E2E-43-03 | Admin | Sửa override | PUT → toast success |
| E2E-43-04 | Admin | Xoá override | Confirm dialog → DELETE → toast |
| E2E-43-05 | Admin | Reconciliation preview shows badge | Badge "🟢 Override theo sự kiện" visible |
| E2E-43-06 | Staff (non-admin) | Truy cập accordion | 403 — accordion ẩn hoặc disabled với message |

### Security Checks

- [ ] All 4 endpoints có `@UseGuards(LogtoAdminGuard)` — verify 401/403
- [ ] IDOR: admin của tenant A không sửa được override của tenant B (kiểm tra path param vs token claims if applicable — current pattern uses adminId for audit, no tenant scope from token)
- [ ] Response không leak `_id` raw của MongoDB sub-document
- [ ] DTO validation tight (Min/Max/regex/MaxLength) — fuzz test với invalid input
- [ ] No SQL injection (TypeORM parameterized via RaceReadonly findOne)

### Performance SLA

- GET list endpoint p95 < 100ms (with cache hit), < 500ms (cold cache)
- POST/PUT/DELETE p95 < 300ms
- Cascade lookup overhead < 5ms per request (sub-array scan trong 1 document)
- Cache hit ratio > 80% sau 1 phút warmup
- 10x flaky test cho concurrent POST + cache invalidation

---

## 📌 Trả lời PAUSE conditions từ file 00

| PAUSE | Danny answer | BR encoded |
|-------|-------------|-----------|
| 1 (Override field scope) | **Option A** Full set 3 fields nullable | BR-43-01 |
| 2 (Effective date semantics) | **Option A** effective_from required, lookup by date | BR-43-04 + BR-43-07 |
| 3 (Backward compat recompute) | **Option A** snapshot preserved, NO retroactive | BR-43-08 |
| 4 (Contract types scope) | **Option A** TICKET_SALES only | BR-43-17 |
| 5 (Admin role permission) | **Option A** ADMIN only | BR-43-09 |
| 6 (Preview source badge) | **Option A** Yes + badge per source | BR-43-16 |
| 7 (UI placement) | **Option A** Accordion in Tổng quan tab | UI spec section |
| 8 (Cross-DB raceId validation) | **Option A** Backend validate via RaceReadonly | BR-43-10 |

---

## 🚨 Risk acknowledgments

- 🔴 **HIGH financial logic change** — TC-43-08..12 cover all 4 cascade tiers + TC-43-15 concurrent. Manager Code Review fee.service cascade BLOCK if any tier incorrect.
- 🔴 **HIGH backward compat** — TC-43-16 verify existing recons fee_rate_applied unchanged. Manager review schema change đảm bảo Mongoose default `[]` works for all 58 existing docs.
- 🟡 **MED audit retrieval** — `GET fee-history` endpoint return event_override entries — verify existing UI handle thêm `event_override.*` prefix correctly hoặc skip render gracefully.
- 🟡 **MED MySQL race ID validation** — Cross-DB check adds 1 query per CUD. Cache `merchant:fee-overrides` includes raceName joined → 1 batch query khi list.
- 🟢 **LOW UI** — Accordion + dialog patterns standard, F-038/F-032 lessons applied.

---

## ✅ Status

- [x] **READY** — Sẵn sàng cho Manager review (`/5bib-plan`)

---

## 🔗 Next step

Danny chạy: `/5bib-plan FEATURE-043-reconciliation-per-event-fee-override`

Manager sẽ:
1. Validate 17 BR-43-* testable + Mapping
2. Cross-check `architecture.md` (no new flow node — extends Order/Recon/Merchant domains)
3. Spot-check code:
   - `merchant-config.schema.ts` ready for `event_fee_overrides` extension
   - `fee.service.ts:585-625` 3-tier cascade ready for Tier 0 insertion
   - `RaceReadonly` entity available in named connection 'platform'
   - F-024 audit log pattern (`MerchantFeeHistory` collection) ready for reuse
4. Confirm 17 TC-43-XX coverage matrix
5. Output `02-manager-plan.md` với Scope Lock + verdict
