# FEATURE-094: PRD — GCN Crew nhiều phôi theo vị trí

**Status:** 🔵 READY
**Last updated:** 2026-06-27
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check
- [x] Đã đọc `00-manager-init.md` (impact map + 5 PAUSE)
- [x] Đã đọc code crew-certificates thật (schema batch/recipient, service renderPublic/renderPreview, controller, roster-parser)
- [x] Đã đọc `known-issues.md` (crew-cert render cache `crew-cert:render:<recipientId>`, quirk admin UI phải test live)
- [x] Danny đã chốt: hướng 🅱️ (multi-template/1-đợt) + map = **admin gán nhóm position→phôi**

---

## 📝 GCN Crew — nhiều phôi theo vị trí (multi-template per batch)

**Goal:** Cho phép 1 đợt GCN có **nhiều phôi (thiết kế) khác nhau, gán theo vị trí crew**; khi crew tra tên, hệ thống render **đúng phôi theo `position`** của họ. Giữ 1 đợt / 1 slug / 1 ô tìm-theo-tên (UX crew không đổi).

**Scope:**
- ✅ In: batch chứa nhiều phôi (1 default + N phụ, mỗi phụ gán 1+ giá trị `position`); admin UI gán position→phôi (sau upload roster); render/preview chọn phôi theo position + fallback default; migration batch F-090 cũ backward-safe.
- ❌ Out: KHÔNG đổi render engine core (`certificate-render.service`); KHÔNG đổi flow search public (1 slug); KHÔNG thêm cột roster (Danny chọn admin-gán); KHÔNG đụng module khác.

---

## 👤 User Stories & Business Rules

### User Stories
- As a **Race Organizer (BTC) / Back-Office Admin**, I want tải nhiều phôi GCN và gán từng nhóm vị trí vào phôi tương ứng, so that mỗi loại crew (trọng tài/TNV/y tế) nhận đúng thiết kế GCN.
- As a **Crew (Anonymous)**, I want gõ tên trong 1 link duy nhất và nhận GCN đúng phôi theo vị trí của mình, so that không phải đoán link hay chọn loại.
- As a **Back-Office Admin**, I want đợt GCN cũ (F-090, 1 phôi) vẫn hoạt động sau khi lên bản mới, so that không phải cấu hình lại.

### Business Rules
- **BR-01:** Mỗi batch có **1 phôi mặc định** (`batch.template`) — BẮT BUỘC luôn tồn tại (là fallback). Cộng thêm **0..N phôi phụ** (`batch.templates[]`).
- **BR-02:** Mỗi phôi phụ có `name` (nhãn admin) + `positions: string[]` (danh sách giá trị `position` được gán vào phôi này) + `template: CrewTemplate` (canvas/layers/photoArea — reuse sub-schema `certificates`).
- **BR-03:** **Chọn phôi khi render** (`pickTemplateForPosition`): tìm phôi phụ đầu tiên có `positions` chứa `recipient.position` (so khớp **trim + case-insensitive**) → nếu có, dùng phôi đó; **nếu không khớp / position rỗng → dùng `batch.template` (default)**.
- **BR-04:** 1 giá trị `position` chỉ được gán vào **tối đa 1 phôi phụ** (không trùng giữa các phôi phụ). Position không gán → default.
- **BR-05:** **Backward-compat:** batch F-090 cũ có `template` + KHÔNG có `templates[]` → `templates` mặc định `[]` → mọi recipient render bằng default (hành vi y hệt F-090). KHÔNG cần migration bắt buộc, KHÔNG mất GCN đang chạy.
- **BR-06:** Đổi `templates[]` hoặc mapping position (admin save) → **invalidate render cache** đợt đó (`invalidateBatchRenders(batchId)` đã có) để crew nhận phôi mới.
- **BR-07:** Public search + slug + idempotency KHÔNG đổi (1 đợt/1 slug). Render endpoint `public/render/:recipientId` giữ nguyên route, chỉ đổi logic chọn phôi.
- **BR-08:** Admin-only cho mọi cấu hình phôi/mapping (`LogtoAdminGuard`, như F-090). Public chỉ search + render.
- **BR-09:** Số phôi phụ: min 0, **max 10** (chặn abuse; đủ cho mọi BTC — 3 loại chỉ là case hiện tại).

---

## 🖥️ UI/UX Flow

### 2.1 Route structure
- `/(dashboard)/crew-certificates/[id]` — **admin** (LogtoAdminGuard) — trang cấu hình đợt GCN (mở rộng trang F-090 hiện có). KHÔNG thêm route mới.
- Public (KHÔNG đổi): search theo slug + render — không phải trang admin.

### 2.2 Layout — trang cấu hình đợt `/crew-certificates/[id]` (mở rộng)
- **Header:** tên đợt + trạng thái active + nút "Lưu".
- **Body — 3 khối (mở rộng từ F-090):**
  1. **Thông tin đợt** (giữ nguyên F-090): eventName, slug, active.
  2. **Roster** (giữ nguyên): upload Excel/CSV → preview → confirm; hiển thị số recipient + distinct `position`.
  3. **Phôi GCN (MỚI — multi):** khối quản lý phôi:
     - **Tab/List phôi:** "Phôi mặc định" (bắt buộc) + các phôi phụ (thêm/xoá). Mỗi tab mở **editor kéo-thả** (reuse component F-090) cho phôi đó.
     - **Gán vị trí:** với mỗi phôi phụ, 1 khối **multi-select** liệt kê **distinct `position`** (lấy từ recipients của đợt) → admin tick các vị trí thuộc phôi này. Position đã gán cho phôi khác bị disable (BR-04). Position chưa gán → badge "→ phôi mặc định".
- **Footer:** nút "Lưu cấu hình" (lưu cả phôi + mapping).

### 2.3 UI Step-by-Step (admin cấu hình 3 loại GCN)

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Mở `/crew-certificates/[id]` | Load đợt: thông tin + roster + khối Phôi (tab "Phôi mặc định" active) | `useCrewBatch(id)` | Xem cấu hình |
| 2 | Upload roster Excel → confirm | Recipients lưu; hiện distinct `position` (vd "Trọng tài", "TNV", "Y tế") | `POST /:id/roster/confirm` | Roster confirmed |
| 3 | Click "Thêm phôi" | Thêm 1 tab phôi phụ (tên mặc định "Phôi 2") + editor rỗng | onClick patch state | Có phôi phụ mới |
| 4 | Trong tab phôi phụ: upload nền + kéo-thả layer `{full_name}`/`{position}` + photo box | Live preview render (reuse F-090 editor) | editor state | Phôi phụ có thiết kế |
| 5 | Khối "Gán vị trí" của phôi phụ: tick "Trọng tài" | Chip "Trọng tài" gán vào phôi; bị remove khỏi các phôi khác | onChange multi-select | `templates[k].positions=["Trọng tài"]` |
| 6 | Lặp step 3-5 cho phôi 3 | — | — | 3 phôi (default + 2 phụ) hoặc default + 3 phụ |
| 7 | Click "Lưu cấu hình" | Validate (mỗi phôi phụ có canvas + ≥1 position) → PATCH → toast success → invalidate render cache | `PATCH /crew-certificates/:id` | Đã lưu |
| 8 | Xem preview mỗi phôi | Nút "Xem trước" per phôi → render PNG với recipient mẫu của phôi đó | `POST /:id/preview` (thêm param templateIndex/position) | Xem GCN từng loại |

### 2.4 Buttons Specification

| Button | Vị trí | Default | Disabled | Loading | Action | Confirm? |
|--------|--------|---------|----------|---------|--------|----------|
| "Thêm phôi" | Header khối Phôi | Outline | Disabled khi đã đủ max 10 phôi phụ | N/A | patch state (thêm tab) | NO |
| "Xoá phôi" | Tab phôi phụ | Ghost đỏ | Ẩn ở "Phôi mặc định" (không xoá được default) | N/A | patch state (bỏ tab) + gỡ positions | YES — "Xoá phôi {name}? Vị trí đã gán về phôi mặc định." |
| "Lưu cấu hình" | Footer | Primary | Disabled khi 1 phôi phụ thiếu canvas hoặc thiếu position | Spinner "Đang lưu..." | `PATCH /crew-certificates/:id` | NO |
| "Xem trước" | Mỗi tab phôi | Outline | Disabled khi phôi rỗng canvas | Spinner | `POST /:id/preview` | NO |

### 2.5 Form Fields Specification

| Field | UI label | Type | Required | Validation | Error msg | Default |
|-------|----------|------|----------|------------|-----------|---------|
| `templates[k].name` | Tên phôi | text | ✅ (phôi phụ) | min 1, max 60, trim | "Tên phôi bắt buộc" | "Phôi {k}" |
| `templates[k].positions` | Vị trí áp dụng | multi-select | ✅ (phôi phụ) | ≥1 giá trị; mỗi position chỉ 1 phôi | "Chọn ít nhất 1 vị trí cho phôi này" | [] |
| `templates[k].template.canvas` | (editor nền) | canvas | ✅ | có width/height + background | "Phôi chưa có nền/thiết kế" | — |
| `template` (default) | Phôi mặc định | canvas | ✅ | như F-090 | "Đợt GCN chưa cấu hình phôi mặc định" | (F-090 hiện có) |

### 2.6 Field source

| Field UI | Data source | Format | Empty |
|----------|-------------|--------|-------|
| Distinct positions | `GET /crew-certificates/:id/positions` (distinct recipient.position của đợt) | chips | "Chưa có roster — upload trước" |
| Danh sách phôi | `batch.template` (default) + `batch.templates[]` | tabs | chỉ default |
| Vị trí đã gán / chưa gán | computed từ `templates[].positions` vs distinct positions | chip xanh (đã gán) / xám (→ default) | — |

### 2.7 UI States (khối Phôi)
- **Loading:** skeleton tab + editor.
- **Empty (chưa có roster):** khối "Gán vị trí" hiện "Upload roster trước để lấy danh sách vị trí" + disable thêm mapping.
- **Data:** tabs phôi + editor + mapping.
- **Chưa gán hết:** badge cảnh báo "N vị trí chưa gán → dùng phôi mặc định" (thông tin, KHÔNG chặn lưu).
- **Validation error:** phôi phụ thiếu canvas/position → viền đỏ tab + disable "Lưu" + scroll-to-error.
- **Submitting:** "Lưu" spinner, disable form.
- **Success:** toast xanh "Đã lưu cấu hình phôi" + refetch.
- **Error:** toast đỏ VN + retry.
- **Confirm xoá phôi:** dialog destructive.

---

## 🛠️ Technical Mandates

### 3.1 DB / Cache
- MongoDB `crew_cert_batches`:
  - GIỮ `template?: CrewTemplate` (phôi mặc định — backward-compat).
  - THÊM `templates: CrewCertNamedTemplate[]` (default `[]`), mỗi phần tử: `{ name: string, positions: string[], template: CrewTemplate }`.
- MongoDB `crew_cert_recipients`: KHÔNG đổi (dùng `position` sẵn có). KHÔNG thêm field (Danny chọn admin-gán, không dùng cột roster).
- Redis: `crew-cert:render:<recipientId>` (per-recipient, TTL 600s) — KHÔNG đổi key; `invalidateBatchRenders(batchId)` gọi thêm khi PATCH templates/mapping (BR-06). `crew-cert-lock:<recipientId>` giữ nguyên.
- S3: prefix `crew-certificates/` — upload N phôi nền/đợt (cùng prefix, lifecycle rule 8 persist). KHÔNG đổi.
- **Migration:** 🛑 **KHÔNG cần migration script bắt buộc** — `templates` default `[]`, batch cũ chạy default. (Optional data-patch: set `templates: []` cho doc cũ nếu Mongoose không auto-default trên đọc — Coder confirm; an toàn hoặc dùng `?? []` khi đọc.)

### 3.2 Backend Endpoints

| Element | `PATCH /api/crew-certificates/:id` (extend) |
|---------|---------|
| Auth | `@UseGuards(LogtoAdminGuard)` |
| Body DTO | `UpdateBatchDto` — thêm `templates?: CrewNamedTemplateDto[]` |
| Response | `CrewBatchResponseDto` — thêm `templates[]` |
| Status | 200 / 400 validation (phôi phụ thiếu canvas/position, position trùng phôi) / 401 / 403 / 404 |
| Side effect | `invalidateBatchRenders(batchId)` sau save (BR-06) |

| Element | `GET /api/crew-certificates/:id/positions` (MỚI) |
|---------|---------|
| Auth | `@UseGuards(LogtoAdminGuard)` |
| Response | `{ positions: string[] }` — distinct `recipient.position` của đợt (đã trim, unique, sort) |
| Status | 200 / 401 / 403 / 404 |

| Element | `POST /api/crew-certificates/:id/preview` (extend) |
|---------|---------|
| Body | thêm `templateIndex?: number` (−1/null = default) hoặc `samplePosition?: string` — render phôi cụ thể với recipient mẫu |
| Response | StreamableFile PNG |

| Element | `GET /api/crew-certificates/public/render/:recipientId` (behavior đổi) |
|---------|---------|
| Auth | Public |
| Logic | `pickTemplateForPosition(recipient.position, batch)` → render phôi đúng; fallback `batch.template` |
| Status | 200 / 404 (không thấy) / 400 (chưa cấu hình phôi default) |

### 3.3 DTO Field-Level Spec

```typescript
class CrewNamedTemplateDto {
  @ApiProperty({ description: 'Tên phôi (nhãn admin)', maxLength: 60 })
  @IsString() @IsNotEmpty() @MaxLength(60)
  name!: string;

  @ApiProperty({ description: 'Các giá trị position áp dụng phôi này', type: [String] })
  @IsArray() @ArrayMinSize(1) @IsString({ each: true })
  positions!: string[];

  @ApiProperty({ description: 'Thiết kế phôi (canvas/layers/photoArea)', type: CrewTemplateDto })
  @ValidateNested() @Type(() => CrewTemplateDto)
  template!: CrewTemplateDto;
}

// UpdateBatchDto thêm:
@ApiPropertyOptional({ description: 'Phôi phụ theo vị trí (tối đa 10)', type: [CrewNamedTemplateDto] })
@IsOptional() @IsArray() @ArrayMaxSize(10)
@ValidateNested({ each: true }) @Type(() => CrewNamedTemplateDto)
templates?: CrewNamedTemplateDto[];
```

### 3.4 Frontend / Admin
- Trang `crew-certificates/[id]/page.tsx` — Client Component (đã là). Mở rộng khối Phôi: tabs + editor reuse + multi-select mapping.
- TanStack Query hook từ SDK generated (`useCrewBatch`, `useUpdateCrewBatch`) — KHÔNG fetch thủ công. Thêm hook `useCrewPositions(id)` cho endpoint mới.
- Sau PATCH: `invalidateQueries(['crew-batch', id])`.
- Base UI multi-select (VN labels) cho gán position.
- **BẮT BUỘC test render/tương tác thật** (bài học `feedback_admin_ui_must_test_live`: Base UI checkbox chưa-tick vô hình → click cả dòng; alert-dialog không export AlertDialogTrigger; next build > tsc).
- Đổi DTO → chạy `pnpm generate:api`.

### 3.5 PAUSE flags
- 🛑 Schema change `crew_cert_batches` (thêm `templates[]`) — Manager duyệt (BR-05 backward-safe, không migration bắt buộc).
- KHÔNG dep mới, KHÔNG đụng auth/fee/render-core.
- Breaking API? — response `CrewBatchResponseDto` THÊM field `templates[]` (additive, không rename/remove) → KHÔNG breaking; vẫn regen SDK.

---

## 🛡️ Testing Mandates

### 4.1 Backend TC-XX

#### TC-01 (then chốt) — Render chọn đúng phôi theo position
| Element | Value |
|---------|-------|
| Setup | batch: default template D + templates[{name:"TT", positions:["Trọng tài"], template:A}]; recipient position="Trọng tài" |
| Method/URL | `GET /api/crew-certificates/public/render/:recipientId` |
| Expected | 200, PNG render bằng phôi **A** (không phải D). Assert: `pickTemplateForPosition("Trọng tài", batch)` trả A |

#### TC-02 — Fallback default khi position không khớp
| Setup | recipient position="Hậu cần" (không có trong phôi phụ nào) |
| Expected | render bằng `batch.template` (D). `pickTemplateForPosition` trả default |

#### TC-03 — position rỗng/null → default
| Setup | recipient position="" hoặc "  " | Expected | trả default (trim) |

#### TC-04 — Match case/whitespace-insensitive
| Setup | phôi positions=["Trọng tài"], recipient position=" trọng tài " | Expected | khớp phôi A (trim + case-insensitive) |

#### TC-05 — Backward-compat batch F-090 cũ
| Setup | batch chỉ có `template`, KHÔNG có `templates` (undefined) | Expected | mọi recipient render bằng default, KHÔNG lỗi (`templates ?? []`) |

#### TC-06 — Validation PATCH: phôi phụ thiếu position
| Body | templates:[{name:"X", positions:[], template:{...}}] | Expected | 400 "Chọn ít nhất 1 vị trí" |

#### TC-07 — Validation: position trùng giữa 2 phôi phụ
| Body | 2 phôi phụ cùng chứa "Trọng tài" | Expected | 400 "Vị trí {x} bị gán cho nhiều phôi" (BR-04) |

#### TC-08 — Max phôi phụ
| Body | 11 phôi phụ | Expected | 400 (ArrayMaxSize 10) |

#### TC-09 — Auth
| `PATCH` / `GET :id/positions` không token | Expected | 401; token non-admin → 403 |

#### TC-10 — GET /positions distinct
| Setup | recipients positions=["A","A","B",""] | Expected | 200 `{positions:["A","B"]}` (unique, trim, bỏ rỗng, sort) |

#### TC-11 — invalidate cache sau PATCH
| Action | PATCH templates | Expected | `invalidateBatchRenders(batchId)` called (render cache DEL) |

**Unit test bắt buộc (Coder):** `pickTemplateForPosition` (TC-01..05 logic thuần) + DTO validation (TC-06/07/08) + service PATCH invalidate (TC-11) + GET positions distinct (TC-10).

### 4.2 Frontend E2E (Playwright)
| TC | Persona | Journey | Expected |
|----|---------|---------|----------|
| E2E-01 | Back-Office Admin | Thêm 2 phôi phụ + gán "Trọng tài"→phôi A, "TNV"→phôi B, lưu | Toast success; reload thấy mapping giữ |
| E2E-02 | Admin | Xoá 1 phôi phụ | Confirm dialog → position của phôi đó về "chưa gán/default" |
| E2E-03 | Admin | Lưu khi phôi phụ thiếu position | Nút "Lưu" disabled / toast error VN |
| E2E-04 | Crew (public) | Gõ tên (position="Trọng tài") → tải GCN | GCN render phôi A |
| E2E-05 | Crew (public) | Tên position không gán | GCN render phôi default |

### 4.3 Security
- [ ] `PATCH` + `GET :id/positions` + `preview` → `LogtoAdminGuard` (401/403 verify).
- [ ] Public render KHÔNG leak internal (chỉ stream PNG). `positions` endpoint admin-only (position có thể là PII-ish → không public).
- [ ] Response `templates[]` KHÔNG leak field internal ngoài name/positions/template.
- [ ] Upload phôi: MIME allowlist png/jpeg/webp + max 5MB (như F-090, giữ nguyên).

### 4.4 Performance
- Render 1 GCN (cache miss) p95 < 2s (như F-090); cache hit < 100ms. Chọn phôi = O(N phôi × M positions), N≤10 → negligible.
- `GET /positions` p95 < 300ms (distinct trên recipients 1 đợt, có index batchId).
- 10x: render cùng recipient 10 lần → cùng phôi, deterministic.

---

## 📌 Answers to Manager's PAUSE conditions (từ file 00)

- **Map position→phôi:** ✅ Danny chốt **admin gán nhóm** (sau upload roster, multi-select distinct positions vào từng phôi; KHÔNG cột roster).
- **Model schema:** giữ `template` = default (backward-compat) + thêm `templates[]` phụ (BR-01/05) — ít migration nhất (Danny confirm ở /5bib-plan).
- **Fallback:** position không khớp/rỗng → `batch.template` default (BR-03), default BẮT BUỘC tồn tại.
- **Max phôi:** N tùy ý, **max 10** phôi phụ (BR-09), min 0.
- **Admin editor:** tabs phôi (default + phụ) + editor kéo-thả reuse per phôi + multi-select gán position (BR-04 mỗi position 1 phôi).

---

## ✅ Status
- [x] READY — sẵn sàng `/5bib-plan`

## 🔗 Next step
Danny chạy: `/5bib-plan FEATURE-094-crew-cert-multi-template`
