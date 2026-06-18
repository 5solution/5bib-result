# FEATURE-090: PRD — Giấy Chứng Nhận (GCN) cho Crew sự kiện

**Status:** 🔵 READY
**Last updated:** 2026-06-17
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check
- [x] Đọc `00-manager-init.md`
- [x] Đọc `codebase-map.md` (certificates/upload) + `known-issues.md`
- [x] Verify code thật: `certificate-render.service.ts` (`render(template, data, options): Buffer`, `interpolate()` hardcoded tokens, photo layer từ `data.runner_photo_url`), `certificate-template.schema.ts` (TemplateCanvas + TemplateLayer + PhotoArea; `CertificateTemplate.race_id` **required** → crew embed template riêng), `certificates.module` exports `CertificateRenderService`, `partners-import.service.ts` (exceljs pattern), `common/utils/slugify.ts` (`slugifyVN`)

---

## 📝 GCN cho Crew — tìm theo tên + tự gen ảnh

**Goal:** Admin upload **phôi GCN + danh sách crew** (Excel/CSV: tên + vị trí + thông tin thêm) cho 1 sự kiện → tạo "đợt GCN" có link public → **crew vào trang, gõ tên → tìm thấy mình → tải GCN PNG cá nhân hóa** (họ tên + vị trí + ảnh), trông như GCN giải chạy.

**Scope:**
- ✅ **In scope:** module `crew-certificates/` (batch + recipient + render); admin CRUD đợt GCN + thiết kế phôi (upload nền + đặt layer text/ảnh + **live preview**) + upload roster Excel/CSV; trang public tìm theo tên + tải GCN PNG; reuse `CertificateRenderService` (mở rộng generic variables).
- ❌ **Out of scope (Phase 2):** lấy crew từ `team-management`/VolRegistration (Danny chốt upload riêng); QR/serial chống giả; upload ảnh chân dung từng người qua UI (v1 = cột URL ảnh trong roster); PDF (v1 PNG); gắn `raceRef` (v1 standalone `eventName`); Konva drag-drop editor (v1 form + preview).

---

## 👤 User Stories & Business Rules

### User Stories
- As a **Back-Office Admin**, I want to upload phôi GCN + đặt vị trí Họ tên/Vị trí/Ảnh + xem preview, để GCN ra đúng layout.
- As a **Back-Office Admin**, I want to upload file Excel/CSV danh sách crew (tên + vị trí + thông tin thêm) cho 1 đợt, để không nhập tay từng người.
- As a **Crew member (Anonymous)**, I want to gõ tên trên trang public → thấy đúng mình (xử lý trùng tên) → tải GCN PNG có tên + vị trí + ảnh.

### Business Rules
- **BR-01:** 1 "đợt GCN" (`crew_cert_batches`) có `slug` public **unique** (regex `^[a-z0-9-]{3,60}$`), `eventName`, `template` (canvas+layers embedded), `active`, `extraFields[]` (label cột thêm).
- **BR-02:** Roster parse Excel (.xlsx, exceljs) + CSV (papaparse). Cột BẮT BUỘC: **Họ tên**, **Vị trí**. Cột tùy chọn: **Ảnh** (URL http/https) + cột tự do khác → `extraFields` (key = slugifyVN(header)). Tối đa **500 dòng**/lần upload (BR-02a). Header dòng 1, bỏ qua.
- **BR-03:** Dòng thiếu Họ tên HOẶC Vị trí → invalid (báo dòng + lý do), KHÔNG insert; dòng valid vẫn insert (2-step preview → confirm, port F-032 partners-import).
- **BR-04:** Mỗi recipient lưu `normalizedName = slugifyVN(fullName)` để tìm kiếm diacritic-insensitive.
- **BR-05:** Tìm public: query name ≥ **2 ký tự** sau normalize; match `normalizedName` **chứa** query; trả tối đa **20** kết quả; **KHÔNG list-all** (chống quét roster). Response chỉ `{ id, fullName, position }` (+ extraFields hiển thị nhẹ) — KHÔNG trả URL ảnh/field nhạy cảm trong list.
- **BR-06:** Render GCN = reuse `CertificateRenderService.render(template, data, {includePhoto})`. `data` map: `runner_name = fullName`, `runner_photo_url = photoUrl`, `event_name = eventName`, `variables = { full_name, position, ...extraFields }`. Engine mở rộng để resolve `{key}` generic từ `variables` (BR-06a — additive, KHÔNG phá render athlete hiện có).
- **BR-07:** Batch `active=false` → trang public + render trả 404.
- **BR-08:** Admin CRUD + roster upload + preview = `LogtoAdminGuard`. Search + render = **public** (no auth).
- **BR-09:** Response KHÔNG leak `_id` raw/`__v`/`createdBy` (inject `id`).
- **BR-10:** Phôi nền upload qua `UploadService.uploadFile(file, 'crew-certificates')` → S3 prefix `crew-certificates/` **persist** (lifecycle rule 8). GCN PNG render on-demand (stream, KHÔNG lưu S3). 🛑 PAUSE: thêm lifecycle rule.
- **BR-11:** Render cache-aside Redis `crew-cert:render:<recipientId>` (TTL 600s, base64 PNG) — DEL khi update batch/recipient. SETNX lock `crew-cert-lock:<recipientId>`.

---

## 🖥️ UI/UX Flow

### 2.1 Routes
| App | Route | Access |
|-----|-------|--------|
| admin | `/crew-certificates` (list) + `/crew-certificates/[id]` (editor) | Admin |
| frontend | `/gcn/[slug]` (tìm + tải GCN) | Public |
| backend | `/api/crew-certificates/*` | Admin (mutation) / Public (search+render) |

### 2.2 Admin list `/crew-certificates`
- **Header:** "Giấy chứng nhận Crew" + nút "+ Tạo đợt".
- **Body table:** Tên sự kiện | Slug (link `/gcn/<slug>`) | Số crew | Trạng thái | Thao tác (Sửa / Xoá).
- **States:** loading skeleton / empty (CTA) / data / error.

### 2.3 Admin editor `/crew-certificates/[id]`
- **Tab "Thông tin":** eventName, slug (validate), active toggle.
- **Tab "Phôi GCN":** upload ảnh nền (→ `/upload` folder `crew-certificates`) → set canvas w/h; danh sách **layer** (repeater): mỗi layer { loại: text|photo, nội dung (text với token `{full_name}`/`{position}`/`{ten_cot}`), x, y, fontSize, màu, căn lề | photo: x,y,w,h }; nút **"Xem trước"** → render với dữ liệu mẫu (recipient đầu hoặc mock) → hiện ảnh.
- **Tab "Danh sách Crew":** nút "Tải file mẫu", upload Excel/CSV → **preview** (N hợp lệ / M lỗi breakdown) → "Xác nhận nhập" → insert; bảng recipients (tên, vị trí) + xoá.
- **States đủ 9:** loading / empty / data / filtered-empty / error / submitting / success (toast) / validation (field đỏ) / confirm (xoá).

### 2.4 Buttons Specification (rút gọn)
| Button | Vị trí | Disabled | Loading | Action | Confirm |
|--------|--------|----------|---------|--------|---------|
| "+ Tạo đợt" | list header | — | — | mở dialog tạo (eventName+slug) | NO |
| "Xem trước" | tab Phôi | khi chưa có layer | "Đang render…" | GET render preview | NO |
| "Tải file mẫu" | tab Crew | — | — | download CSV mẫu | NO |
| "Upload roster" | tab Crew | — | "Đang đọc…" | POST roster preview | NO |
| "Xác nhận nhập" | sau preview | khi 0 valid | "Đang lưu…" | POST roster confirm | NO |
| "Xoá đợt" | row | — | — | DELETE | YES |

### 2.5 Form Fields (đợt + layer)
| Field | Label | Type | Required | Validation | Error |
|-------|-------|------|----------|------------|-------|
| `eventName` | Tên sự kiện | text | ✅ | 1–255 trim | "Tên sự kiện bắt buộc" |
| `slug` | Đường dẫn | text | ✅ | regex `^[a-z0-9-]{3,60}$` | "Slug chỉ gồm a-z, 0-9, - (3–60)" |
| layer `text` | Nội dung | text | ✅(text) | max 200 | "Tối đa 200 ký tự" |
| layer `x/y` | Toạ độ | number | ✅ | ≥0 | "Toạ độ ≥ 0" |
| layer `fontSize` | Cỡ chữ | number | ⚪ | 8–300 | "Cỡ chữ 8–300" |

### 2.6 Public `/gcn/[slug]`
- **Header:** `eventName` + dòng "Nhập tên của bạn để nhận Giấy chứng nhận".
- **Search input** + nút "Tìm".
- **States:** idle (ô tìm) / loading / no-result ("Không tìm thấy, kiểm tra lại tên") / list (mỗi item: Họ tên — Vị trí, nút "Xem GCN") / preview GCN (ảnh + nút "Tải về").
- Trùng tên → list nhiều item, crew chọn đúng theo Vị trí.

### 2.7 Field source
| Field UI | Source |
|----------|--------|
| Tên sự kiện | `batch.eventName` |
| Họ tên (GCN) | `recipient.fullName` → `{full_name}`/`{runner_name}` |
| Vị trí (GCN) | `recipient.position` → `{position}` |
| Ảnh (GCN) | `recipient.photoUrl` → photo layer |
| Thông tin thêm | `recipient.extraFields[key]` → `{key}` |

---

## 🛠️ Technical Mandates (For Coder)

### 3.1 DB / Cache / S3
**MongoDB MỚI:**
- `crew_cert_batches`: `{ _id, slug (unique index), eventName, template: { canvas: TemplateCanvas, layers: TemplateLayer[], photoArea?: PhotoArea, placeholderPhotoUrl?, photoBehindBackground? }, extraFields: string[], active (default true), createdBy?, timestamps }`. Reuse schema CLASSES `TemplateCanvas`/`TemplateLayer`/`PhotoArea` import từ `certificates/schemas`.
- `crew_cert_recipients`: `{ _id, batchId (index), fullName, normalizedName (index), position, extraFields: Record<string,string>, photoUrl?, timestamps }`. Compound index `{ batchId, normalizedName }`.

**Redis:** `crew-cert:render:<recipientId>` (600s, base64 PNG), `crew-cert-lock:<recipientId>` (SETNX 5s). DEL render cache khi update batch template/recipient.

**S3:** phôi nền → `crew-certificates/` (persist). 🛑 PAUSE: thêm **lifecycle rule 8** vào CLAUDE.md (KHÔNG lẫn `result-images/` 24h).

**Migration:** KHÔNG (collection mới).

### 3.2 Engine extension (shared — `certificate-render.service.ts`)
- `RenderData` += `variables?: Record<string, string>`.
- `interpolate()`: sau chain hardcoded, nếu `data.variables` → replace mọi `{key}` còn lại bằng `variables[key]` (escape key cho regex). Token không có → giữ nguyên hoặc rỗng (chốt: rỗng để không lộ `{token}`).
- `render(template, data, options)`: đổi param type `template: RenderableTemplate` (interface mới = subset `{canvas, layers, photo_area?, photo_behind_background?, placeholder_photo_url?}`) — `CertificateTemplate` vẫn assignable (KHÔNG phá caller). 🛑 Regression: chạy lại test certificates hiện có.

### 3.3 Backend Endpoints
| Method | Path | Auth | DTO in → out |
|--------|------|------|--------------|
| POST | `/api/crew-certificates` | Admin | CreateBatchDto → BatchResponseDto |
| GET | `/api/crew-certificates` | Admin | → BatchListResponseDto |
| GET | `/api/crew-certificates/:id` | Admin | → BatchResponseDto (full template + recipient count) |
| PATCH | `/api/crew-certificates/:id` | Admin | UpdateBatchDto (eventName/slug/active/template) → BatchResponseDto |
| DELETE | `/api/crew-certificates/:id` | Admin | → 204 |
| POST | `/api/crew-certificates/:id/roster/preview` | Admin | multipart file → RosterPreviewDto {total,valid[],invalid[]} |
| POST | `/api/crew-certificates/:id/roster/confirm` | Admin | {rows:[]} → {inserted:number} |
| GET | `/api/crew-certificates/:id/recipients` | Admin | → recipient list (paginated) |
| GET | `/api/crew-certificates/:id/preview.png` | Admin | (query sample) → PNG (render template + mock data) |
| GET | `/api/crew-certificates/public/:slug/search?name=` | Public | → CrewSearchResultDto[] (id,fullName,position) |
| GET | `/api/crew-certificates/public/render/:recipientId.png` | Public | → PNG stream |

Route order: `public/...` literal trước `:id` param routes.

### 3.4 DTO (chính)
```typescript
export class CreateBatchDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) eventName!: string;
  @ApiProperty() @IsString() @Matches(/^[a-z0-9-]{3,60}$/, { message: 'Slug chỉ gồm a-z, 0-9, - (3–60)' }) slug!: string;
}
export class RecipientRowDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) fullName!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) position!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() photoUrl?: string;
  @ApiPropertyOptional() @IsOptional() extraFields?: Record<string, string>;
}
export class CrewSearchResultDto {
  @ApiProperty() id!: string;
  @ApiProperty() fullName!: string;
  @ApiProperty() position!: string;
}
```
Template DTO reuse `TemplateCanvasDto` + `TemplateLayerDto` từ certificates (import).

### 3.5 Frontend / Admin
- Admin: `admin/src/app/(dashboard)/crew-certificates/page.tsx` (list) + `[id]/page.tsx` (editor 3 tab) + components (`BatchDialog`, `TemplateLayerForm`, `RosterUpload`, `RecipientTable`) + `lib/crew-cert-{api,hooks}.ts` + nav entry.
- Public: `frontend/app/gcn/[slug]/page.tsx` ('use client') gọi backend qua proxy.
- SDK: hand-typed wrapper (pattern landing). KHÔNG bắt buộc generate:api.

### 3.6 PAUSE flags
- 🛑 Shared engine edit (`certificate-render.service.ts`) — Manager scope-lock + regression certificates tests.
- 🛑 S3 lifecycle rule 8 (`crew-certificates/`) — CLAUDE.md.
- ✅ KHÔNG `pnpm install` (canvas/exceljs/papaparse/qrcode có sẵn).
- ✅ KHÔNG migration, KHÔNG đụng fee/auth/order/race.

---

## 🛡️ Testing Mandates (For QC)

### Backend TC
- **TC-01** createBatch happy → 201, slug unique, shape no `_id`.
- **TC-02** slug dup → 409; slug sai regex → 400.
- **TC-03** roster preview: file 3 dòng (2 valid + 1 thiếu Vị trí) → `{total:3, valid:2, invalid:1}` + lý do dòng.
- **TC-04** roster confirm → insert N, `normalizedName` = slugifyVN.
- **TC-05** search "nguyen van a" tìm được "Nguyễn Văn Á" (diacritic-insensitive); query 1 ký tự → []; >20 match → cắt 20; KHÔNG list-all khi name rỗng.
- **TC-06** render: variables map → engine resolve `{full_name}`/`{position}`/`{extra}`; photo từ photoUrl.
- **TC-07** batch active=false → search + render 404.
- **TC-08** auth: admin endpoints no token → 401; public search/render no token → 200.
- **TC-09** engine regression: render athlete cert cũ (KHÔNG có variables) vẫn đúng token cũ.
- **TC-10** leak: response no `_id`/`__v`/`createdBy`.

### Security
- [ ] Admin guard mọi mutation + preview; public chỉ search + render.
- [ ] Anti-enumeration: name <2 ký tự → []; no list-all; list KHÔNG trả photoUrl/extra nhạy cảm.
- [ ] photoUrl chỉ http/https (chống SSRF/`file:` khi render load image) — validate + render bỏ qua nếu sai.
- [ ] Roster upload: MIME allowlist (xlsx/csv), max 500 dòng, max file size.
- [ ] Engine variables: KHÔNG cho `{key}` inject script (chỉ text canvas, no HTML) — render canvas an toàn.

### Performance
- Render p95 < **800ms** (cache miss), < 100ms (cache hit). Search p95 < 150ms (indexed `normalizedName`).

---

## 📌 Answers to Manager's PAUSE (file 00)
- **Cột roster:** Họ tên + Vị trí (bắt buộc); Ảnh (URL, tùy); cột tự do → extraFields. xlsx + csv.
- **Ảnh crew:** v1 = cột URL ảnh trong roster (phôi đẹp + ảnh chân dung tùy chọn). Upload-per-person UI = Phase 2.
- **Builder vị trí:** v1 = form layer (x/y/fontSize) + **live preview** qua render engine (KHÔNG Konva). Reuse render, không reuse certificates editor (vì template race-scoped).
- **Tìm kiếm:** diacritic-insensitive (slugifyVN) substring; trùng tên → list + Vị trí disambiguate; ẩn field nhạy cảm; chống enumeration (≥2 ký tự, ≤20, no list-all).
- **Public access:** theo `slug`, ai cũng vào; chống quét bằng search-only.
- **Định dạng:** PNG (v1). PDF Phase 2.
- **QR/serial:** Phase 2.
- **raceRef:** v1 standalone `eventName`.
- **Persist/on-demand:** render on-demand + cache 600s; phôi nền persist S3.

---

## ✅ Status
- [x] READY — sẵn sàng `/5bib-plan`

## 🔗 Next step
`/5bib-plan FEATURE-090-crew-certificate-gcn`
