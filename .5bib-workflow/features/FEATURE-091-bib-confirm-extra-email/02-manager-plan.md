# FEATURE-091: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-06-18
**Reviewer:** 5bib-manager
**Linked:** `00`, `01`

---

## 📌 Pre-flight + spot-check (code thật)
- [x] Đọc 00 + 01 đầy đủ + memory
- [x] **mail.service**: `require('@mailchimp/mailchimp_transactional')`, `this.client = mailchimp(env.mailchimp.apiKey)` (null nếu thiếu key → warn, KHÔNG gửi), `client.messages.send({message:{from_email, from_name, subject, html, to, attachments:[{type, name, content: base64}]}})` — format attachment xác nhận tại `sendTeamContractSent` (pdf). `sendBibPass` thêm `type:'image/png'` OK. ✅
- [x] **certificate-render**: `ensureFonts()` + `GlobalFonts.registerFromPath(path, family)`, FONTS_DIR=`backend/assets/fonts`, `render(template: RenderableTemplate, data, {includePhoto})` + `data.variables` generic (F-090). Extend font = additive. ✅
- [x] **AthleteReadonly** `@Entity('athletes')`: có bib_number/name/email; THIẾU rolling_bib_last_time+bib_image → +2 cột read-only (precedent F-085 created_on). ✅
- [x] **Kill-switch pattern**: `IGLOO_*_ENABLED` Joi boolean default false → `env.igloo.*` (config/index.ts:120-121,251-252). `BIB_PASS_SEND_ENABLED` port y. ✅
- [x] **F-090 reuse**: CrewTemplateDto + draft-preview POST + kéo-thả editor + render — có sẵn (vừa ship). ✅

## ✓ PRD Validation Checklist
- [x] User Stories + Personas (Back-Office Admin / Athlete)
- [x] BR-01..13 testable (đặc biệt BR-01 confirmed-detection, BR-04 idempotency, BR-10 kill-switch)
- [x] UI states đủ 9 (editor 4 tab)
- [x] Buttons + Form fields + Field source + Endpoint table + DTO code block đầy đủ
- [x] Data source rõ (athletes read-only / Mongo config+sends / config static)
- [x] KHÔNG migration Mongo (collection mới); entity extend read-only (verify replica)
- [x] Security: admin guard + no-legacy-write + email no-leak + kill-switch + SQL param
- [x] Performance SLA cụ thể (render <800ms, throttle batch)
- [x] Test mandate có manual (Danny)

## 📊 Cross-check memory
- **Architecture:** module mới `bib-pass-email/` trong nhóm platform-DB (cần `@InjectRepository(AthleteReadonly,'platform')`). Reuse CertificateRenderService (cross-module DI từ CertificatesModule) + MailService (NotificationModule) + Mongo riêng. Sau deploy: codebase-map + CLAUDE.md (Redis `bib-pass-lock`, S3 `bib-pass/` nếu prefix mới, env mới).
- **Convention:** kill-switch env-boolean (F-085), idempotency unique-index Mongo (mới — giống bib_pass_sends), scan-platform-athletes read-only (F-085), template-embed + render (F-090).
- **Known issues:** đụng platform `athletes` read-only — quirk named connection `'platform'` (BẮT BUỘC). Engine shared (F-090) — edit additive-only.

## 📋 Files được phép thay đổi (Scope Lock)

**Backend `backend/`:**
- ✏️ `src/modules/certificates/services/certificate-render.service.ts` — **CHỈ additive**: register thêm font trong `ensureFonts()` + export `FONT_OPTIONS`. KHÔNG đổi logic render. (Shared F-090 — regression: chạy lại crew tests.)
- ➕ `assets/fonts/*.ttf` — font mới (curl github.com/google/fonts, verify VN).
- ➕ `src/modules/bib-pass-email/bib-pass-email.module.ts`
- ➕ `src/modules/bib-pass-email/bib-pass-email.controller.ts`
- ➕ `src/modules/bib-pass-email/bib-pass-config.service.ts` (CRUD config + render preview + test-send + stats)
- ➕ `src/modules/bib-pass-email/bib-pass-sender.service.ts` (scan confirmed + idempotent send + throttle)
- ➕ `src/modules/bib-pass-email/crons/bib-pass-scan.cron.ts`
- ➕ `src/modules/bib-pass-email/schemas/{bib-pass-config,bib-pass-send}.schema.ts`
- ➕ `src/modules/bib-pass-email/dto/*.dto.ts`
- ➕ `src/modules/bib-pass-email/bib-pass-email.constants.ts` (CACHE/lock, BATCH_LIMIT default, token list)
- ➕ `src/modules/bib-pass-email/*.spec.ts`
- ✏️ `src/modules/notification/mail.service.ts` — thêm `sendBibPass()` (additive)
- ✏️ `src/modules/notification/notification.module.ts` — đảm bảo `exports: [MailService]` (nếu chưa)
- ✏️ `src/modules/race-master-data/entities/athlete-readonly.entity.ts` — +2 cột `rolling_bib_last_time` + `bib_image` (read-only map)
- ✏️ `src/modules/app.module.ts` — register `BibPassEmailModule` (trong `platformDbModules` block)
- ✏️ `src/config/index.ts` — Joi + env: `BIB_PASS_SEND_ENABLED`(bool false) / `BIB_PASS_BATCH_LIMIT`(200) / `BIB_PASS_SCAN_CRON`(string) → `env.bibPass`

**Admin `admin/src/`:**
- ➕ `app/(dashboard)/bib-pass/page.tsx` + `[raceId]/page.tsx`
- ➕ `components/bib-pass/*` (reuse pattern editor F-090 + font dropdown)
- ➕ `lib/bib-pass-api.ts` + `bib-pass-hooks.ts`
- ✏️ `lib/nav-groups.ts` — nav "Border Pass email"

**Infra (PAUSE, không block code/test):**
- ✏️ `docker-compose.yml` + VPS env — 3 env keys mới.

🛑 Ngoài Scope Lock = hỏi Manager. ĐẶC BIỆT: `certificate-render.service.ts` CHỈ additive font.

## 🔧 Tech approach (Manager chốt)
- **Font registration shared:** đặt `FONT_OPTIONS` + register trong certificate-render (engine) → F-090 + F-091 dùng chung. `GET /api/bib-pass/fonts` trả FONT_OPTIONS.
- **Scan query (read-only platform):** `athleteRepo.createQueryBuilder` hoặc `find({ where: { race_id, bib_number: Not(IsNull()), rolling_bib_last_time: Not(IsNull()), bib_image: Not(IsNull()), deleted: false } })` → anti-join Mongo sends (lấy athletesId đã sent → filter). Parameterized (TypeORM). KHÔNG raw SQL interpolation.
- **Idempotency:** unique index `{raceId, athletesId}` + insert khi gửi; `E11000` → coi như đã gửi (skip).
- **Render reuse:** `CertificateRenderService.render(toRenderable(config.template), {runner_name:name, variables:{name,bib,location,race_day,distance,passport_no}}, {includePhoto:false})`.
- **Mail:** `sendBibPass` attachment base64 PNG. Tôn trọng `this.client` null + `env.bibPass.sendEnabled` (BR-10).
- **Cron:** `@Cron(env.bibPass.scanCron)` + SETNX `bib-pass-lock:<raceId>` + batch limit.

## 🛑 PAUSE points cho Coder
- 🛑 **Verify cột legacy** `rolling_bib_last_time` + `bib_image` trên `athletes` replica (tên/kiểu) TRƯỚC khi map entity. Sai → dừng hỏi.
- 🛑 **Font:** `curl` TTF từ **github.com/google/fonts** (OFL, chính chủ) — Manager APPROVE nguồn này. **Verify từng font render "Nguyễn ƯỢ Ầ Ễ Ọ"** (VN glyph) trước khi đưa vào FONT_OPTIONS; font fail → DROP. KHÔNG `pnpm install`.
- 🛑 ENV mới (3 key, không secret) — thêm config + báo Danny set docker-compose/VPS khi deploy.
- 🛑 KHÔNG ghi legacy DB (chỉ SELECT). KHÔNG đụng fee/order/auth/F-090 render logic.
- 🛑 Manual test-send cần `MAILCHIMP_API_KEY` ở env đang chạy (team email dùng key này → thường có). Nếu local thiếu → test-send log dry-run; verify render PNG + send-attempt path, hoặc set key.

## 🧪 Unit test BẮT BUỘC
- [ ] config upsert + validation (enabled=true thiếu required → 400)
- [ ] scan detection (BR-01): đủ 3 field → confirmed; thiếu bib_image → không
- [ ] idempotency (BR-04): đã sent → skip; E11000 → skip
- [ ] render variables (BR-06): {name}/{bib} auto + {passport_no}=prefix+bib
- [ ] kill-switch (BR-10): sendEnabled=false → KHÔNG gọi mail, log dry-run
- [ ] no-email (BR-13): email null → failed 'no_email', không throw
- [ ] throttle (BR-11): > BATCH_LIMIT → cắt
- [ ] **font VN render smoke**: render "Nguyễn Thị ƯỢ Ầ Ễ" với mỗi FONT_OPTIONS → PNG hợp lệ
- [ ] sendBibPass: attachment base64 đúng type image/png

## 📊 Verdict
> ### ✅ APPROVED — Coder bắt đầu được.

PRD code-verified, reuse rõ (F-090 render+editor / F-085 cron+kill-switch / Mandrill mail), scope khoá. Rủi ro chính: shared-engine font edit (mitigate additive + regression crew tests) + legacy column verify + email egress (mitigate kill-switch + test-send). Mandate manual test giữ nguyên.

## ✅ Sẵn sàng `/5bib-code`?
- [x] Yes.

## 🔗 Next step
`/5bib-code FEATURE-091-bib-confirm-extra-email`
