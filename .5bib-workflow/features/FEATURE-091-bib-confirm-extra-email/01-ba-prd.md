# FEATURE-091: PRD — Gửi ảnh Border Pass qua email khi VĐV xác nhận BIB

**Status:** 🔵 READY
**Last updated:** 2026-06-18
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check
- [x] Đọc `00-manager-init.md` (3 quyết định Danny chốt + yêu cầu font + mandate test manual)
- [x] Đọc `codebase-map.md` (race-master-data / certificates / notification) + `known-issues.md`
- [x] Verify code thật: `mail.service.ts` (Mandrill `client.messages.send`, `sendCustomHtml(to,subject,html)`, `from_email: env.teamManagement.emailFrom`, attachments qua `message.attachments` base64); `certificate-render.service.ts` (`ensureFonts()` + `GlobalFonts.registerFromPath(path, family)`, FONTS_DIR=`backend/assets/fonts`, `render(template: RenderableTemplate, data, {includePhoto})`, `data.variables` generic — F-090); `AthleteReadonly` (`@Entity('athletes')`: athletes_id/race_id/bib_number/name/email/created_on… THIẾU rolling_bib_last_time+bib_image); F-085 igloo cron + idempotency + kill-switch; F-090 crew template builder + kéo-thả + live preview + draft-preview endpoint

---

## 📝 Border Pass email-on-BIB-confirm

**Goal:** Sau khi VĐV xác nhận số BIB trên legacy (đã có ảnh BIB), 5BIB gửi THÊM email kèm ảnh **Border Pass** cá nhân hóa (tên + số BIB + thông tin giải) — cấu hình per-race từ admin, **KHÔNG sờ code BE legacy**.

**Scope:**
- ✅ **In scope:** module backend `bib-pass-email/` (config + scan cron + manual send + render + mail); admin config page per-race (bật/tắt + builder phôi reuse F-090 + **chọn font** + static fields + email subject/body) + test-send + send-now + stats; mở rộng engine font (bundle TTF Vietnamese-supporting đa dạng + font list); extend `AthleteReadonly` +2 cột read-only; idempotency Mongo; kill-switch.
- ❌ **Out of scope (Phase 2):** sửa/đụng legacy BE hoặc legacy DB (ghi cờ); gửi nhiều loại ảnh (MVP **1 Border Pass**/race — schema extensible); auto-pull cự ly/passport từ subinfo (admin nhập tay); analytics open-rate; gửi SMS/Zalo.

---

## 👤 User Stories & Business Rules

### User Stories
- As a **Back-Office Admin**, I want to bật tính năng + dựng phôi Border Pass (chọn font, kéo-thả tên/bib/info) cho 1 giải, để VĐV nhận ảnh đẹp đúng brand.
- As a **Back-Office Admin**, I want to test-send 1 email cho chính mình trước, để duyệt phôi + font trước khi bật gửi hàng loạt.
- As an **Athlete**, I want to nhận email kèm Border Pass có tên + số BIB của tôi sau khi xác nhận BIB.
- As a **Back-Office Admin**, I want to feature tự gửi (cron) cho người mới xác nhận + nút gửi tay/gửi lại, để không phải canh thủ công.

### Business Rules

- **BR-01 (Confirmed-BIB detection):** VĐV "đã xác nhận BIB" ⇔ trong `athletes`: `bib_number` NOT NULL/≠'' **AND** `rolling_bib_last_time` NOT NULL **AND** `bib_image` NOT NULL/≠'' **AND** `deleted = false`. Thiếu 1 → KHÔNG gửi.
- **BR-02 (No legacy touch):** Đọc `athletes` **read-only** (conn `'platform'`). Track "đã gửi" ở Mongo `bib_pass_sends` của 5bib-result. TUYỆT ĐỐI không INSERT/UPDATE legacy DB.
- **BR-03 (Per-race enable):** Chỉ scan+gửi cho race có config `enabled = true`. Race không config / `enabled=false` → bỏ qua.
- **BR-04 (Idempotency):** Mỗi (raceId, athletesId) gửi **đúng 1 lần** thành công — unique index `{raceId, athletesId}` trên `bib_pass_sends`. Đã có record `status='sent'` → KHÔNG gửi lại (trừ resend chủ động).
- **BR-05 (Resend):** Admin bấm "Gửi lại" cho 1 VĐV → xóa/ghi đè record → gửi lại. (MVP: KHÔNG auto-resend khi `rolling_bib_last_time` đổi — chỉ lưu `rollingBibAt` để Phase 2.)
- **BR-06 (Auto variables):** `{name}` = `athletes.name`, `{bib}` = `athletes.bib_number` (auto từ DB). Các biến static `{location}` `{race_day}` `{distance}` `{passport_no}` lấy từ `config.staticFields` (admin nhập). `{passport_no}` = `config.staticFields.passportPrefix` + số BIB (vd `LCM-2026-` + `001`) — MVP dùng bib làm seq (KHÔNG sequence riêng).
- **BR-07 (Render):** Reuse `CertificateRenderService.render()` (F-090) với template embed (canvas + layers) + `data.variables`. Phôi nền (khung thổ cẩm) = `canvas.backgroundImageUrl` (admin upload S3).
- **BR-08 (Font):** Engine register bộ font Vietnamese-supporting đa dạng (≥6 family, đủ category sans/serif/display/script). Mỗi text layer chọn `fontFamily` từ list. Font KHÔNG hỗ trợ tiếng Việt → KHÔNG đưa vào list (Coder verify render "ƯỢẦỄỌ").
- **BR-09 (Email):** Gửi qua `MailService` (Mandrill), from = `env.teamManagement.emailFrom`, to = `athletes.email`. Ảnh Border Pass đính kèm PNG (`message.attachments` base64). Subject/body HTML từ `config.email` (admin nhập, hỗ trợ `{name}`/`{bib}` trong body).
- **BR-10 (Kill-switch):** Env `BIB_PASS_SEND_ENABLED` (default `false`). `false` → render + log "[DRY] would send to X" nhưng KHÔNG gửi thật (an toàn dev). Prod set `true`. Cron + send-now đều tôn trọng.
- **BR-11 (Throttle):** Cron mỗi tick gửi tối đa `BIB_PASS_BATCH_LIMIT` (default 200) VĐV/race; render concurrency cap reuse `RENDER_MAX_CONCURRENT`. SETNX lock `bib-pass-lock:<raceId>` chống cron overlap.
- **BR-12 (Email không leak):** Response admin KHÔNG leak email VĐV ra ngoài scope cần thiết; stats chỉ trả số đếm. Admin guard mọi endpoint.
- **BR-13 (No-email guard):** VĐV không có `email` hợp lệ → skip + ghi `bib_pass_sends status='failed' error='no_email'` (không retry vô hạn).

---

## 🖥️ UI/UX Flow

### 2.1 Route structure
| App | Route | Access |
|-----|-------|--------|
| admin | `/bib-pass` (list races có config / tạo) | Admin (`isAdmin`) |
| admin | `/bib-pass/[raceId]` (editor: Thông tin / Phôi GCN / Email / Trạng thái) | Admin |
| backend | `/api/bib-pass/*` | Admin (mutation) / cron (internal) |

### 2.2 Layout — Editor `/bib-pass/[raceId]` (reuse khung tab F-090)

- **Header:** "Border Pass — {raceTitle}" + badge enabled/disabled.
- **Tab "Thông tin":** toggle `enabled`; static fields (location/raceDay/distance/passportPrefix); nút "Lưu".
- **Tab "Phôi GCN":** **REUSE editor F-090** — upload phôi nền + canvas W/H + lớp chữ (mỗi lớp: token text, X, Y, cỡ, màu, căn, **+ dropdown FONT**) + kéo-thả trên preview + live preview (render dữ liệu mẫu). Token khả dụng: `{name}` `{bib}` `{location}` `{race_day}` `{distance}` `{passport_no}`.
- **Tab "Email":** subject (text) + body HTML (textarea) + nút "Test-send" (nhập email → gửi thử 1 ảnh).
- **Tab "Trạng thái":** stats (Đã confirm BIB / Đã gửi / Lỗi / Chờ gửi) + bảng recipient (tên, bib, email-masked, trạng thái, nút "Gửi lại") + nút "Gửi ngay cho tất cả chờ gửi".
- **States đủ 9:** loading skeleton / empty (chưa config → CTA bật) / data / error / submitting / success toast / validation field đỏ / confirm (gửi hàng loạt — destructive-ish) / preview-rendering.

### 2.3 UI Step-by-Step — Admin cấu hình + test
| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Vào `/bib-pass` → "Tạo cho giải" → chọn race (nhập mysql_race_id) | Navigate `/bib-pass/<raceId>` tab Thông tin | router.push | Editor mở |
| 2 | Bật toggle "Kích hoạt" + nhập static fields → "Lưu" | PUT config; toast "Đã lưu" | useUpdateConfig | config.enabled=true |
| 3 | Tab Phôi GCN: upload phôi nền | POST /upload folder `bib-pass`; preview hiện nền | uploadImage | canvas.backgroundImageUrl set |
| 4 | Thêm lớp `{name}`, chọn **font** "Playfair Display", kéo vào vị trí | Live preview tự render (debounce) | previewDraft | layer cập nhật |
| 5 | Tab Email: nhập subject/body → "Test-send" → nhập email mình | POST test-send; toast "Đã gửi thử"; check inbox | testSend | email gửi (nếu Mandrill on) |
| 6 | Bật `BIB_PASS_SEND_ENABLED` (prod) → cron tự gửi / hoặc "Gửi ngay" | cron/manual scan→render→send; stats cập nhật | cron/sendNow | recipients status='sent' |

### 2.4 Buttons Specification
| Button | Vị trí | Disabled | Loading | Action | Confirm? |
|--------|--------|----------|---------|--------|----------|
| "Tạo cho giải" | list header | — | — | mở dialog nhập raceId | NO |
| "Lưu" (Thông tin) | tab | khi static fields trống bắt buộc | "Đang lưu…" | PUT config | NO |
| "Lưu phôi" | tab Phôi | — | "Đang lưu…" | PUT config.template | NO |
| "Test-send" | tab Email | khi email sai/chưa có phôi | "Đang gửi…" | POST test-send | NO |
| "Gửi ngay cho tất cả chờ gửi" | tab Trạng thái | khi 0 chờ gửi | "Đang gửi…" | POST send-now | YES — "Gửi Border Pass cho N VĐV?" |
| "Gửi lại" | row recipient | — | spinner | POST resend | YES — "Gửi lại cho {name}?" |

### 2.5 Form Fields Specification (Thông tin + Email)
| Field | UI label | Type | Required | Validation | Error |
|-------|----------|------|----------|------------|-------|
| `enabled` | Kích hoạt gửi | switch | ⚪ | boolean | — |
| `staticFields.location` | Địa điểm | text | ✅(nếu enabled) | 1–255 | "Địa điểm bắt buộc" |
| `staticFields.raceDay` | Ngày thi đấu | text | ✅(nếu enabled) | 1–64 (vd "18/10/2026") | "Nhập ngày thi đấu" |
| `staticFields.distance` | Cự ly | text | ⚪ | max 64 (vd "5.5/10.5/21KM") | — |
| `staticFields.passportPrefix` | Tiền tố passport | text | ⚪ | max 32 (vd "LCM-2026-") | — |
| `email.subject` | Tiêu đề email | text | ✅(nếu enabled) | 1–200 | "Nhập tiêu đề" |
| `email.bodyHtml` | Nội dung email | textarea | ✅(nếu enabled) | 1–5000 | "Nhập nội dung" |
| layer `fontFamily` | Font | select | ✅ | thuộc font list | "Chọn font hợp lệ" |
| test `email` | Email nhận thử | email | ✅ | regex email | "Email không hợp lệ" |

### 2.6 Field source
| Field UI | Source |
|----------|--------|
| Tên (trên ảnh) | `athletes.name` → `{name}` |
| Số BIB | `athletes.bib_number` → `{bib}` |
| Địa điểm/Ngày/Cự ly | `config.staticFields.*` |
| Passport no | `passportPrefix` + `bib_number` |
| Email nhận | `athletes.email` |
| Đã confirm? | `bib_number`+`rolling_bib_last_time`+`bib_image` (athletes) |
| Đã gửi? | `bib_pass_sends` (Mongo) |

---

## 🛠️ Technical Mandates (For Coder)

### 3.1 DB / Cache / S3 / Font
**MySQL platform (read-only) — extend entity:**
- `AthleteReadonly` (`@Entity('athletes')`): **THÊM** `@Column({type:'datetime', nullable:true}) rolling_bib_last_time: Date | null;` + `@Column({type:'text', nullable:true}) bib_image: string | null;`. `synchronize:false` → chỉ map. 🛑 Coder verify TÊN/KIỂU cột thật trên replica trước.

**MongoDB MỚI:**
- `bib_pass_configs`: `{ _id, raceId:number (unique index), enabled:boolean, template:{canvas,layers,photoArea?} (reuse F-090 sub-schema), staticFields:{location,raceDay,distance?,passportPrefix?}, email:{subject,bodyHtml}, createdBy?, timestamps }`.
- `bib_pass_sends`: `{ _id, raceId:number, athletesId:number, bibNumber:string, email:string, status:'sent'|'failed', error?:string, rollingBibAt?:Date, sentAt:Date }` + **unique compound index `{raceId, athletesId}`**.

**Redis:** `bib-pass-lock:<raceId>` (SETNX cron anti-overlap, TTL ~50s). (Tùy) render cache reuse F-090.

**S3:** phôi nền → prefix `bib-pass/` (hoặc reuse `crew-certificates/`). Lifecycle persist (đăng ký CLAUDE.md nếu prefix mới). Generated PNG: render on-demand, đính kèm email, KHÔNG lưu S3.

**Font (engine extend — dùng chung F-090):**
- Bundle TTF vào `backend/assets/fonts/` (Coder `curl` từ github.com/google/fonts raw — 🛑 PAUSE Manager xác nhận nguồn). Candidate (Coder verify VN glyph từng cái, drop nếu fail): **Montserrat**, **Roboto**, **Lora**, **Playfair Display**, **Oswald** (+ đã có Inter, Be Vietnam Pro), **Dancing Script** (script). ≥6 family đủ category.
- Extend `ensureFonts()` register thêm (registerFromPath + family name).
- Constant chung `FONT_OPTIONS: {family,label,category}[]` (backend) → expose qua `GET /api/bib-pass/fonts` (và reuse cho admin F-090). `layer.fontFamily` phải ∈ FONT_OPTIONS.

**Dependency MỚI:** KHÔNG (`@napi-rs/canvas`, Mandrill client, mongoose, ioredis đã có). Chỉ thêm file TTF (asset).

### 3.2 Backend Endpoints (admin, `LogtoAdminGuard` class-level; cron internal)
| Method | Path | DTO in → out |
|--------|------|--------------|
| GET | `/api/bib-pass/fonts` | → `FontOptionDto[]` |
| GET | `/api/bib-pass/config/:raceId` | → `BibPassConfigDto` (default rỗng nếu chưa có) |
| PUT | `/api/bib-pass/config/:raceId` | `UpsertBibPassConfigDto` → `BibPassConfigDto` |
| POST | `/api/bib-pass/config/:raceId/preview` | `BibPassTemplateDto` (draft) → PNG (reuse F-090 draft-preview) |
| POST | `/api/bib-pass/config/:raceId/test-send` | `{email}` → `{sent:boolean}` (render + Mandrill tới email nhập; tôn trọng kill-switch) |
| POST | `/api/bib-pass/config/:raceId/send-now` | → `{queued:number}` (scan confirmed + chưa gửi → gửi, throttle) |
| POST | `/api/bib-pass/config/:raceId/resend/:athletesId` | → `{sent:boolean}` |
| GET | `/api/bib-pass/config/:raceId/stats` | → `{confirmed,sent,failed,pending}` |
| GET | `/api/bib-pass/config/:raceId/recipients?status=&page=` | → recipients (tên, bib, email-masked, status) |

### 3.3 DTO (chính)
```typescript
export class StaticFieldsDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(255) location!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(64) raceDay!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) distance?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) passportPrefix?: string;
}
export class BibPassEmailDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) subject!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) bodyHtml!: string;
}
export class UpsertBibPassConfigDto {
  @ApiProperty() @IsBoolean() enabled!: boolean;
  @ApiPropertyOptional({ type: StaticFieldsDto }) @IsOptional() @ValidateNested() @Type(()=>StaticFieldsDto) staticFields?: StaticFieldsDto;
  @ApiPropertyOptional({ type: BibPassEmailDto }) @IsOptional() @ValidateNested() @Type(()=>BibPassEmailDto) email?: BibPassEmailDto;
  @ApiPropertyOptional({ type: BibPassTemplateDto }) @IsOptional() @ValidateNested() @Type(()=>BibPassTemplateDto) template?: BibPassTemplateDto;
}
// BibPassTemplateDto = canvas + layers (reuse certificates TemplateCanvasDto/TemplateLayerDto như F-090 CrewTemplateDto)
export class TestSendDto {
  @ApiProperty() @IsEmail() email!: string;
}
export class FontOptionDto {
  @ApiProperty() family!: string;  @ApiProperty() label!: string;  @ApiProperty() category!: string;
}
```

### 3.4 Frontend / Admin
- `admin/src/app/(dashboard)/bib-pass/page.tsx` (list) + `[raceId]/page.tsx` (editor 4 tab) — reuse khung + kéo-thả + live-preview của F-090 crew editor.
- `lib/bib-pass-{api,hooks}.ts` (hand-typed wrapper) + nav entry "Border Pass email".
- Tab Phôi: thêm **dropdown Font** mỗi layer (nguồn `GET /fonts`).
- SDK: hand-typed (như landing/short-links/crew). KHÔNG bắt buộc generate:api.

### 3.5 Mail
- Thêm method `MailService.sendBibPass(toEmail, subject, html, png: Buffer, filename)` → `client.messages.send({message:{from_email, from_name:'5BIB', subject, html, to:[{email}], attachments:[{type:'image/png', name:filename, content: png.toString('base64')}]}})`. Tôn trọng `this.client` null (DEV → log, return false).

### 3.6 Cron
- `bib-pass-scan.cron.ts` `@Cron` (cadence env `BIB_PASS_SCAN_CRON`, default mỗi 10 phút) → SETNX lock per race → scan confirmed (BR-01) anti-join sends → render + send (BR-09/11) → upsert sends. Kill-switch BR-10.

### 3.7 PAUSE flags
- 🛑 `curl` tải TTF font (KHÔNG `pnpm install`) — Manager xác nhận nguồn github.com/google/fonts.
- 🛑 Extend `AthleteReadonly` (+2 cột read-only) — verify cột thật replica.
- 🛑 ENV mới: `BIB_PASS_SEND_ENABLED`(default false) + `BIB_PASS_BATCH_LIMIT`(200) + `BIB_PASS_SCAN_CRON`. Thêm config + docker-compose + VPS. KHÔNG secret.
- ✅ KHÔNG migration MongoDB (collection mới). KHÔNG đụng legacy. KHÔNG đụng fee/order/auth.

---

## 🛡️ Testing Mandates (For QC)

### Backend TC
- **TC-01** upsert config happy → 200, shape no `_id`.
- **TC-02** config validation: enabled=true thiếu location/subject → 400.
- **TC-03** scan detection: athlete có đủ bib_number+rolling_bib_last_time+bib_image → "confirmed"; thiếu bib_image → KHÔNG confirmed (unit test service với mock repo).
- **TC-04** idempotency: gửi 2 lần cùng (raceId, athletesId) → lần 2 skip (đã sent); unique index chặn dup insert.
- **TC-05** render variables: `{name}`/`{bib}` auto + `{location}`/`{passport_no}` từ config → engine resolve đúng (PNG buffer).
- **TC-06** kill-switch: `BIB_PASS_SEND_ENABLED=false` → KHÔNG gọi mail.send, log dry-run.
- **TC-07** no-email: athlete email null → status='failed' error='no_email', không crash.
- **TC-08** auth: endpoint no token → 401.
- **TC-09** throttle: scan > BATCH_LIMIT → chỉ gửi BATCH_LIMIT/tick.
- **TC-10** font: layer.fontFamily ∉ FONT_OPTIONS → reject/400 (hoặc fallback an toàn).
- **TC-11** **font Vietnamese render** (engine): render layer chữ "Nguyễn Thị ƯỢ Ầ Ễ" với từng font trong FONT_OPTIONS → PNG hợp lệ (smoke, đảm bảo registered).

### Security
- [ ] Mọi endpoint `LogtoAdminGuard` → 401 no token.
- [ ] KHÔNG ghi legacy DB (chỉ SELECT athletes). Grep verify không có INSERT/UPDATE platform.
- [ ] Email VĐV không leak (recipients trả masked, không leak ra ngoài admin).
- [ ] Kill-switch chặn egress dev.
- [ ] SQL athletes parameterized (TypeORM repo, không raw interpolation).

### Performance
- Render PNG p95 < 800ms (cache). Scan 1 race (vài nghìn confirmed) chạy theo batch không block; gửi ≤ BATCH_LIMIT/tick.

### Manual (Danny mandate — như F-090)
- Live trong Chrome (login): config 1 đợt thật + dựng phôi + chọn font + **test-send 1 email thật** → mở inbox xem ảnh + font render đúng tiếng Việt. Verify cron-scan + idempotency trên dev (seed athlete confirmed ở dev Mongo/MySQL).

---

## 📌 Answers to Manager's PAUSE (file 00)
- **Config admin vs env** → Admin UI (Mongo `bib_pass_configs`) + builder reuse F-090. ✓
- **Trigger** → Cron (`BIB_PASS_SCAN_CRON` ~10') + manual send-now + resend + test-send. ✓
- **Nguồn data** → name/bib auto từ `athletes`; location/raceDay/distance/passportPrefix admin nhập per-race; passport = prefix + bib (BR-06). ✓
- **Font** → bundle ≥6 font Vietnamese-supporting + dropdown per layer (BR-08). Coder verify VN glyph + PAUSE nguồn curl.
- **Số ảnh** → MVP 1 Border Pass/race (schema extensible).
- **Idempotency/resend** → 1 lần/VĐV (unique index); resend chủ động (nút). ✓
- **Kill-switch** → `BIB_PASS_SEND_ENABLED` default false (BR-10). ✓

---

## ✅ Status
- [x] READY — sẵn sàng `/5bib-plan`

## 🔗 Next step
`/5bib-plan FEATURE-091-bib-confirm-extra-email`
