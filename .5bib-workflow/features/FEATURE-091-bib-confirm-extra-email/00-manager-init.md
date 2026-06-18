# FEATURE-091: Gửi thêm ảnh (Border Pass) qua email khi VĐV xác nhận số BIB

**Status:** 🟡 INITIATED (research)
**Created:** 2026-06-18
**Owner:** Danny
**Type:** NEW_MODULE (reuse nặng F-090 render engine + F-085 scan-cron + notification mail)
**Created by:** 5bib-manager

---

## 🎯 Why this feature

Legacy 5BIB có tính năng "quay BIB" + tự email ảnh số BIB cho VĐV. Danny muốn **gửi THÊM vài ảnh nữa** (vd 1 ảnh dạng **Border Pass** — mẫu Lào Cai Marathon 2026: khung thổ cẩm, tên VĐV, số BIB, vài thông tin tham gia) qua email — **mà KHÔNG sờ vào code BE legacy**. Bật/tắt + cấu hình ảnh là **per-race từ admin** (không phải giải nào cũng có).

---

## 🔑 Nguyên tắc kiến trúc chốt
**KHÔNG đụng legacy BE.** Toàn bộ feature sống trong repo `5bib-result` (NestJS): **đọc** bảng `athletes` (MySQL platform, read-only) để phát hiện VĐV đã xác nhận BIB → render ảnh (engine F-090) → gửi email (mail.service) → tự track "đã gửi" trong Mongo của MÌNH (không ghi cờ vào legacy DB).

**Phát hiện VĐV đã xác nhận BIB (Danny cung cấp):** trong `athletes`: `bib_number` có giá trị **AND** `rolling_bib_last_time` có giá trị **AND** `bib_image` có giá trị. `bib_image` rỗng = chưa xác nhận.

---

## 📂 Impact Map (theo memory + code thật đã verify)

### Module sẽ chạm / tạo
- ➕ **`backend/src/modules/bib-confirm-email/` (MODULE MỚI)** — config + scan cron + render + send. Tên tạm; BA/Danny chốt.
- ✏️ `backend/src/modules/race-master-data/entities/athlete-readonly.entity.ts` — **THÊM 2 cột read-only** `rolling_bib_last_time` (datetime) + `bib_image` (varchar/text). (Precedent: F-085 thêm `created_on`.) Additive, read-only.
- ✏️ `backend/src/modules/app.module.ts` — register module mới (trong nhóm `platformDbModules` vì cần đọc `athletes` qua conn `'platform'`).
- ➕ `admin/src/app/(dashboard)/.../` — trang cấu hình per-race (bật/tắt + builder Border Pass + danh sách ảnh) — **reuse pattern F-090 editor + kéo-thả**.
- ➕ `admin/src/lib/*-{api,hooks}.ts` — hand-typed wrapper.

### File then chốt cần đọc (REUSE)
- `backend/src/modules/certificates/services/certificate-render.service.ts` — **engine render** (đã mở rộng generic variables ở F-090: `{full_name}`/`{position}`/`<cột>`). Border Pass = template (phôi nền thổ cẩm + text layers: `{name}`/`{bib}`/`{location}`/`{race_day}`/`{distance}`/`{passport_no}`). REUSE 100%.
- `backend/src/modules/crew-certificates/` (F-090) — **khuôn mẫu gần nhất**: embed template (canvas+layers), upload phôi S3, admin editor kéo-thả + live preview, render PNG. Feature này ≈ "F-090 nhưng trigger = bib-confirm + email + per-race".
- `backend/src/modules/igloo-insurance/` (F-085) — **khuôn cron scan platform athletes + idempotent + SETNX lock + kill-switch + daily counters**. Trigger F-091 port pattern này (scan `athletes` đã-confirm-BIB chưa-gửi → action).
- `backend/src/modules/notification/mail.service.ts` — **gửi email** (đã có `attachments: [...]` + `sendCustomHtml()`). Border Pass PNG đính kèm hoặc inline. Transport qua `env` (verify SMTP/SES).
- `backend/src/modules/race-master-data/entities/athlete-readonly.entity.ts` — `athletes` entity (đã có `bib_number`/`name`/`email`; thiếu `rolling_bib_last_time`+`bib_image`).
- `backend/src/modules/invoice-reconcile` (F-076) — pattern per-race enable list + cron-tick + health endpoint.

### Endpoint dự kiến (BA chốt)
- Admin: CRUD config per-race (bật/tắt, upload phôi, layers, list ảnh) — `LogtoAdminGuard`.
- Admin: preview render (reuse F-090 POST preview draft) + test-send (gửi thử tới 1 email).
- (Tùy chọn) Admin: trigger batch send thủ công + xem trạng thái đã gửi/lỗi.
- KHÔNG có public endpoint (đây là backend job + admin config; VĐV nhận qua email).

### Schema/DB
- **MySQL platform (read-only):** `athletes` — đọc `athletes_id`, `race_id`, `bib_number`, `name`, `email`, `rolling_bib_last_time`(MỚI), `bib_image`(MỚI). KHÔNG ghi.
- **MongoDB MỚI:**
  - `bib_email_configs` (per-race): `{ raceId/mysqlRaceId, enabled, template (canvas+layers reuse F-090), extraImages[]?, emailSubject, emailBody, createdBy }`.
  - `bib_email_sends` (idempotency): `{ raceId, athletesId, sentAt, status, error? }` — **track "đã gửi" ở Mongo của mình** (KHÔNG ghi legacy DB).
- **Redis:** SETNX cron-lock per-race (port F-085) + (tùy) render cache (port F-090 `crew-cert:render`).
- **S3:** phôi Border Pass → prefix `crew-certificates/` (reuse rule 8) hoặc prefix mới `bib-pass/` (BA chốt).
- Dependency MỚI: **KHÔNG** (canvas/mail/exceljs/mongoose/ioredis đã có).

---

## ⚠️ Risk Flags

- 🟡 **MED — Volume email:** 1 giải có thể vài nghìn VĐV xác nhận BIB → scan + render + gửi hàng loạt. Phải **throttle/batch** (SMTP rate-limit) + cron không gửi trùng (idempotency). Port semaphore render F-090 (`RENDER_MAX_CONCURRENT`) + giới hạn gửi/tick.
- 🟡 **MED — Đọc legacy athletes:** thêm 2 cột read-only vào `AthleteReadonly` — verify TÊN/KIỂU cột thật trên replica (`rolling_bib_last_time`, `bib_image`) trước (đừng hallucinate). `synchronize:false` nên chỉ map, không migrate.
- 🟡 **MED — Idempotency cross-system:** không ghi được cờ "đã gửi" vào legacy → track ở Mongo. Nếu Mongo mất / reset → có thể gửi lại. Cần khóa chắc + (tùy) chống resend khi `rolling_bib_last_time` đổi (re-confirm).
- 🟡 **MED — Email egress thật:** gửi mail thật tới VĐV thật (như F-085 egress) → cần **kill-switch + test-send + dev dry-run** trước khi bật prod. Sai template/sai người = spam VĐV.
- 🟢 **LOW — Render + config + admin builder:** reuse F-090 (đã ship + test). Engine generic-variable đã có.
- 🟢 **LOW — Không đụng legacy:** read-only + Mongo riêng + cron riêng + mail riêng.

---

## 🚧 PAUSE Conditions — Danny chốt 2026-06-18 (AskUserQuestion)

- [x] **⭐ Cấu hình per-race → ADMIN UI (Mongo) — reuse F-090.** Admin tự bật/tắt + upload phôi + kéo-thả đặt tên/bib/info per-race (editor giống F-090). KHÔNG dùng env-list. → Mongo collection `bib_email_configs` per-race + admin builder.
- [x] **⭐ Trigger → CRON tự quét + NÚT gửi tay (cả 2)** — như F-085. Cron định kỳ (cadence BA chốt, đề xuất 5–15 phút) quét VĐV vừa confirm BIB (bib_image set + chưa gửi) → gửi tự động; + admin có nút gửi tay/gửi lại + test-send.
- [x] **⭐ Nguồn data → Admin nhập cố định per-race + auto tên/bib.** `{name}`+`{bib}` auto từ `athletes` (name, bib_number). Còn `{location}`/`{race_day}`/`{distance}`/`{passport_no}` admin nhập 1 lần cho cả giải trong config (vd "Quảng trường Tráng A Pao" / 18/10/2026 / "5.5/10.5/21KM" / format "LCM-2026-{seq}"). KHÔNG auto-pull subinfo/race (tránh phức tạp).
- [ ] **Coder pre-check (không phải Danny):** verify TÊN + KIỂU thật cột `rolling_bib_last_time` + `bib_image` trên `athletes` (replica) trước khi map entity.
- [ ] **BA chốt (minor, có default):**
  - **Passport no:** format admin nhập có `{seq}` → seq auto-tăng per-race hay = bib_number? (default đề xuất: per-race incremental theo thứ tự confirm; hoặc đơn giản = bib).
  - **Số ảnh:** MVP **1 template Border Pass** (config extensible N ảnh sau). BA xác nhận MVP 1.
  - **Email content:** subject + body tiếng Việt (admin nhập trong config); ảnh **đính kèm** PNG (đề xuất) hay inline cid; from address + SMTP verify cho volume.
  - **Idempotency + resend:** gửi 1 lần/VĐV (Mongo `bib_email_sends`); gửi lại = admin chủ động (nút) hoặc khi `rolling_bib_last_time` đổi (re-confirm) — BA chốt.
  - **Dry-run/kill-switch:** dev KHÔNG gửi thật (env `*_ENABLED=false` như F-085); prod có công tắc tổng + test-send tới 1 email trước.

---

## 🎨 Yêu cầu thêm — FONT đa dạng (Danny 2026-06-18)
> "Set up font cho chọn font đa dạng chút để match được với design."

- Engine F-090 (`certificate-render.service.ts`) hiện chỉ register **Inter + Be Vietnam Pro** (GlobalFonts.registerFromPath, `backend/assets/fonts/`). Border Pass dùng nhiều style (display đậm cho tiêu đề, script cho "Dòng chảy Biên Cương", condensed...) → cần **bộ font phong phú**.
- **Phải làm:** bundle thêm 1 bộ TTF (Google Fonts) **CÓ hỗ trợ tiếng Việt** (diacritics) — đa dạng category: sans (Be Vietnam Pro, Inter, Montserrat, Roboto), serif (Lora, Playfair Display), display/condensed (Oswald, Bebas Neue), script (Dancing Script, Great Vibes nếu có VN). ⚠️ **CHỈ chọn font có glyph tiếng Việt** — nhiều display/script font KHÔNG có → render ra ô vuông. Coder verify từng font render được "ƯỢ Ầ Ễ Ọ" trước khi đưa vào list.
- Register tất cả trong engine + expose **danh sách font (key→display name)** cho admin editor → mỗi text layer có **dropdown chọn font**. `fontFamily` của layer dùng đúng family name đã register.
- Reuse cho cả F-090 crew GCN (cùng engine) — nâng cấp font list = lợi cả 2.
- Coder PAUSE nếu cần `curl` tải TTF (không phải `pnpm install`) — confirm nguồn (github.com/google/fonts raw).

---

## 🧪 Test mandate (Danny 2026-06-18)
**Test cả MANUAL** — như F-090: sau code+QC, chạy live (backend + admin trong Chrome đã login): cấu hình 1 đợt thật, dựng phôi Border Pass + chọn font, **test-send 1 email thật** (xem ảnh đính kèm + font render đúng), verify cron-scan + idempotency. Không chỉ unit test.

---

## 🎯 Success criteria (gợi ý cho BA)
- Admin bật feature cho 1 giải, dựng phôi Border Pass (kéo-thả tên/bib/info + nhập location/race-day/distance/passport-format), test-send 1 email OK.
- Cron tự phát hiện VĐV vừa xác nhận BIB (bib_image set) → gửi email kèm Border Pass đúng tên + số BIB + info per-race, **không gửi trùng**, không gửi cho người chưa confirm. + nút gửi tay/gửi lại.
- KHÔNG đụng 1 dòng code legacy BE. KHÔNG ghi vào legacy DB.
- Volume an toàn (throttle, không spam, không vượt SMTP limit).

## ✅ Sẵn sàng cho `/5bib-prd`?
- [x] **YES** — 3 quyết định khoá ⭐ Danny đã chốt. BA viết PRD được. Còn vài minor (passport seq, MVP 1 ảnh, email content, resend, kill-switch) BA spec với default đề xuất ở trên. Coder verify cột legacy ở đầu phase code.
- Reuse nặng: **F-090** (CertificateRenderService + RenderableTemplate generic variables + admin template builder + kéo-thả + live preview) + **F-085 Igloo** (scan platform athletes + idempotent Mongo tracking + cron + SETNX lock + kill-switch + daily counters) + **notification/mail.service** (attachments + sendCustomHtml).

## 🔗 Next step
Danny chốt 3 PAUSE ⭐ → `/5bib-prd FEATURE-091-bib-confirm-extra-email`
