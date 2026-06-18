# FEATURE-091 — Coder Implementation Notes

**Status:** ✅ CODE COMPLETE — backend build + 26 unit tests + regression green + live functional smoke (real DEV data). Admin builds. Pending: live UI E2E + real test-send on DEV (cần Danny duyệt merge main + permission gửi email).
**Date:** 2026-06-18
**Branch:** `5bib_short_link_crew_v1`

---

## 🔑 Coder decisions (chốt khi code)

### D1 — Quét athletes bằng RAW parameterized SQL (KHÔNG extend AthleteReadonly entity)
Plan Scope Lock cho phép extend `AthleteReadonly` +2 cột. **Coder chọn KHÔNG đụng entity đó**, thay bằng `@InjectDataSource('platform')` + raw parameterized SQL (đúng pattern F-085 IglooSelectionService). Lý do:
1. **Giảm blast radius** — `AthleteReadonly` được race-master-data sync dùng; thêm cột = thay file shared (Pre-Deploy Checklist cảnh báo #1).
2. **Đúng hơn** — "chưa xác nhận" thực tế = `bib_image IS NULL` **HOẶC** rỗng `''` (verify replica: race 192 có 2 dòng `''`). `Not(IsNull())` của repository sẽ MISS case rỗng → false-positive gửi nhầm. Raw SQL `bib_image IS NOT NULL AND bib_image <> ''` robust.
3. Chỉ SELECT đúng 5 cột cần. Parameterized `?` — KHÔNG interpolate (SEC).
→ Đây là **thu hẹp scope** (nằm trong file module mới), KHÔNG mở rộng → không cần hỏi Manager. `AthleteReadonly` giữ NGUYÊN.

### D2 — Verify cột legacy (PAUSE #1) ✅
`SHOW COLUMNS athletes`: `bib_number varchar(255)`, `rolling_bib_last_time datetime(6)`, `bib_image text`, `name`, `email` — đúng tên Danny nói. BR-01 detection = cả 3 non-null + non-empty.

### D3 — FONT đa dạng (PAUSE #2) ✅ — 6 phông mới, KHÔNG drop phông nào
Tải OFL variable TTF từ **github.com/google/fonts** (Manager APPROVE): Montserrat, Roboto, Lora, Playfair Display, Oswald, Dancing Script. Verify 2 lớp:
1. **cmap parser** (tự viết) check codepoint VN khó nhất (ễ U+1EC5, ợ U+1EE3, ầ, ữ, ậ, ỉ, đ, Ư…) → **cả 6 FULL** (validate parser bằng Inter/BeVietnamPro known-good).
2. **render smoke** @napi-rs/canvas "Nguyễn Thị Hậu — ƯỢ Ầ Ễ Ọ đ ữ ậ" → cả 6 render đẹp, VF weight (700) hoạt động, KHÔNG tofu.
Tổng **8 family** (+ Inter, Be Vietnam Pro): sans (4) / serif (2) / display (1) / script (1). Đăng ký **additive** trong `certificate-render.service.ts ensureFonts()` + export `FONT_OPTIONS` (dùng chung F-090 + F-091). Engine render logic KHÔNG đổi → crew tests vẫn xanh (20/20).

### D4 — Idempotency optimistic claim (BR-04)
`bib_pass_sends` unique `{raceId, athletesId}`. Sender "claim" = insert status='sent' TRƯỚC khi gửi; E11000 → đã xử lý → skip. Render/mail lỗi → downgrade 'failed'. At-most-once (ưu tiên không gửi trùng). Anti-join: athletesId đã có doc (mọi status) → bỏ.

### D5 — Kill-switch (BR-10) 2 tầng
- Batch/cron: `BIB_PASS_SEND_ENABLED=false` → dry-run (đếm, KHÔNG ghi ledger, KHÔNG gửi).
- `MailService.sendBibPass`: `this.client` null (thiếu MAILCHIMP key) → log dry-run, return false.
- test-send: KHÔNG chịu kill-switch batch (gửi cho email admin chỉ định, không phải VĐV) — chỉ cần Mailchimp configured.

---

## 📁 Files changed

**Backend (`backend/`):**
- ✏️ `src/modules/certificates/services/certificate-render.service.ts` — additive: +6 font register, export `FONT_OPTIONS`. Render logic giữ nguyên.
- ➕ `assets/fonts/{Montserrat,Roboto,Lora,PlayfairDisplay,Oswald,DancingScript}-VF.ttf`
- ➕ `src/modules/bib-pass-email/` — constants, schemas (config + send), dto (req + res), `bib-pass-scanner.service.ts`, `bib-pass-config.service.ts`, `bib-pass-sender.service.ts`, `crons/bib-pass-scan.cron.ts`, controller, module, `.service.spec.ts` (26 tests).
- ✏️ `src/modules/notification/mail.service.ts` — +`sendBibPass()` (additive).
- ✏️ `src/modules/app.module.ts` — register `BibPassEmailModule` trong `platformDbModules`.
- ✏️ `src/config/index.ts` — env `BIB_PASS_SEND_ENABLED`(false) / `BIB_PASS_BATCH_LIMIT`(200) / `BIB_PASS_SCAN_CRON`('0 */2 * * *') → `env.bibPass`.

**Admin (`admin/src/`):**
- ➕ `app/(dashboard)/bib-pass/page.tsx` (list + race picker), `app/(dashboard)/bib-pass/[raceId]/page.tsx` (editor: phôi + kéo-thả + dropdown phông + static fields + email + kích hoạt + test-send + gửi batch + danh sách VĐV).
- ➕ `lib/bib-pass-api.ts` + `lib/bib-pass-hooks.ts`.
- ✏️ `lib/nav-groups.ts` — nav "Border Pass email" (icon Mail, requireRole admin).

**KHÔNG đụng:** legacy BE code, legacy DB write (chỉ SELECT athletes), fee/order/auth, F-090 render logic, AthleteReadonly entity.

---

## 🧪 Test evidence

- **Unit (Jest):** 26/26 PASS — BR-01 detect SQL (3 điều kiện + param), BR-04 idempotency (anti-join + E11000), BR-06 render vars (passport_no=prefix+bib), BR-09 upsert validation (enabled thiếu phôi/subject→400), BR-10 kill-switch dry-run, BR-11 throttle, BR-13 no-email→failed, font VN smoke (8 family), sendBibPass attachment image/png base64.
- **Regression:** crew-certificates + certificates 20/20 PASS (shared engine an toàn).
- **Build:** `nest build` clean; admin `next build` clean (routes `/bib-pass`, `/bib-pass/[raceId]` compiled).
- **Live functional smoke** (standalone Nest context, REAL dev Mongo + platform MySQL, kill-switch ON):
  - DI graph resolve OK; 12 routes mapped + guarded (401 không token, KHÔNG 500).
  - Scanner race 220 → 72 VĐV đã xác nhận (khớp raw-SQL count), tên VN thật.
  - Config upsert → Mongo write OK; renderPreview → PNG hợp lệ (VN "NGUYỄN THỊ HẬU" Playfair + {bib} Oswald).
  - Stats merge confirmed=72/sent=0/pending=72; confirmed list email masked.
  - sendBatch kill-switch → dryRun=true, sent=0 (KHÔNG gửi). Cleanup OK.

## ⏳ Còn lại (cần Danny)
- **Live UI E2E** trên `result-admin-dev.5bib.com` (Chrome đã login) — cần merge `main` → DEV (git policy: merge main cần Danny duyệt).
- **Test-send email thật** (vd tới danh.ng9897@gmail.com) — gửi email là hành động cần permission; Danny tự bấm "Gửi thử" trên UI hoặc đồng ý để gửi.
- **Infra env (deploy):** thêm `BIB_PASS_SEND_ENABLED` / `BIB_PASS_BATCH_LIMIT` / `BIB_PASS_SCAN_CRON` vào docker-compose + VPS env khi go-live (default false an toàn nếu chưa set).
