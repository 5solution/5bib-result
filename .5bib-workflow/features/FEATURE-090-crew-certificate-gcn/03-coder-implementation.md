# FEATURE-090: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC
**Started/Done:** 2026-06-17
**Author:** 5bib-fullstack-engineer
**Linked:** `00`, `01`, `02`

---

## 📌 Pre-flight
- [x] Đọc 00/01/02 (APPROVED) + conventions + codebase-map
- [x] Đọc code thật: certificate-render.service (render + interpolate), certificate-template.schema (sub-schemas + race_id required), certificates.module exports, partners-import (exceljs), slugify

## 🔍 Impact Assessment
- **Backend:** module mới `crew-certificates/` + **1 shared-engine edit additive** (render generic variables). 2 collection mới. Reuse CertificateRenderService qua CertificatesModule DI. Redis render cache. 0 dep mới (canvas/exceljs/papaparse có sẵn).
- **Frontend:** 1 public page `/gcn/[slug]` (plain Tailwind, gọi proxy).
- **Admin:** list + editor (3 tab) + api/hooks + nav. Hand-typed wrapper.
- **Contract:** module mới → 0 break SDK.

## ⚠️ Edge Cases Covered
- [x] Roster thiếu Họ tên/Vị trí → invalid báo dòng; thiếu cột bắt buộc → toàn bộ invalid
- [x] photoUrl chỉ http/https (chống SSRF khi engine loadImage)
- [x] Search <2 ký tự → [] (no DB, chống enumeration); cap 20; batch inactive → 404
- [x] Diacritic-insensitive (slugifyVN normalizedName)
- [x] recipientId invalid ObjectId → 404 (no CastError)
- [x] Redis down → graceful (cache nuốt lỗi)
- [x] Engine: athlete token cũ vẫn render (regression test) + generic {full_name} render

## 🧠 Logic & Architecture
- **Embed template** (CrewTemplate reuse TemplateCanvas/TemplateLayer/PhotoArea sub-schema) → decouple `CertificateTemplate.race_id` (required). Map → `RenderableTemplate` khi render.
- **Engine additive:** `RenderData.variables?` + `interpolate` generic pass (sau token cố định) + `render(template: RenderableTemplate)` (CertificateTemplate vẫn assignable). Athlete callers no-op.
- **Render data map:** runner_name=fullName, runner_photo_url=photoUrl, event_name=eventName, variables={full_name, position, ...extraFields}.
- **Roster:** detect ext → exceljs (xlsx) / papaparse (csv) → header VN normalize → validate → 2-step preview/confirm. Confirm = REPLACE toàn bộ recipients (re-upload fresh).
- **Cache:** base64 PNG Redis 600s + DEL on batch/recipient mutation.

## 💻 Files Changed
**Backend:**
- ✏️ `modules/certificates/services/certificate-render.service.ts` — additive: import TemplateCanvas, `RenderData.variables?`, `RenderableTemplate` interface, `render()` param widen, `interpolate()` generic pass + `escapeToken()`
- ➕ `modules/crew-certificates/`: constants, schemas/{crew-cert-batch,crew-cert-recipient}, dto/{crew-batch,crew-response}, roster-parser, service, controller, module, service.spec
- ✏️ `modules/app.module.ts` — register CrewCertificatesModule
**Frontend:** ➕ `app/gcn/[slug]/page.tsx`
**Admin:** ➕ `app/(dashboard)/crew-certificates/page.tsx` + `[id]/page.tsx`; ➕ `lib/crew-cert-{api,hooks}.ts`; ✏️ `lib/nav-groups.ts`

## 🧪 Tests Written
```
PASS src/modules/crew-certificates/crew-certificates.service.spec.ts
  roster-parser: CSV cột VN + extra + invalid · XLSX header VN · thiếu cột · photoUrl http/https only
  engine generic variables: render {full_name}/{position} → PNG · REGRESSION {runner_name} no-variables → PNG
  createBatch: slug dup 409 · happy no-leak
  searchPublic: <2 ký tự [] · diacritic-insensitive map · inactive 404
  renderPublic: map fullName/position/photo + cache · invalid id 404 · inactive 404
  confirmRoster: replace + normalizedName + extraFields labels
Tests: 15 passed, 15 total
```
TC map PRD: TC-01/02 createBatch; TC-03/04 roster; TC-05 search; TC-06 render map; TC-07 inactive; TC-09 engine regression; TC-10 leak. TC-08 auth + frontend E2E → QC.

## 🛑 PAUSE/Confirmation log
| What | Resolution |
|------|-----------|
| Shared engine edit | Additive only (variables + RenderableTemplate widen). Regression: no existing certificates .spec → tsc clean + engine test trong crew spec render athlete token cũ PASS. |
| S3 lifecycle rule 8 `crew-certificates/` | Ops + CLAUDE.md ở deploy (KHÔNG tự đổi AWS). Phôi upload qua /upload folder param. |
| Konva builder | Theo plan: form + live preview (KHÔNG Konva). |

## 🚧 Scope creep
- [x] KHÔNG creep. Fold admin components vào editor page.tsx (giảm scope, không tạo file components riêng như plan list — acceptable, ít file hơn).

## 🐛 Known limitations / Tech debt
- Admin layout designer = form toạ độ + preview (không drag-drop). Konva = Phase 2.
- Ảnh chân dung = cột URL trong roster (upload-per-person = Phase 2).
- confirmRoster REPLACE toàn bộ (không append/merge) — re-upload = full list.
- Render cache base64 trong Redis (đơn giản; không persist S3).

## ✅ Self-Review Pipeline
- [x] B1: tsc clean (backend crew+engine+app.module / admin crew+nav / frontend gcn)
- [x] B2: PRD adherence (DTO + endpoints + TC matched)
- [x] B3: Anti-pattern scan clean (3 app, prod files)
- [x] B4: hand-pick mapping — N/A (no multi-layer field drop risk; toResponse single)
- [~] B5: PROD smoke — tsc compile OK; Nest boot + curl + admin/Logto + s3 deferred QC/staging
- [~] B6: UI/UX — code follows pattern (tabs, states, sm:max-w-md, truncate); live browser deferred QC
- [x] B7: Real-world data — test "Nguyễn Văn Á"/"Trần Thị B" + Đơn vị diacritic + file:// SSRF reject
- [x] B8: Files vs Scope Lock — 0 creep
- [x] B9: SDK regen — N/A (hand-typed)
- [x] B10: Unit tests 15/15 PASS
- [x] B11: IMPLEMENTATION_NOTES.md 4 sections

→ Status: 🟠 READY_FOR_QC

## 🔗 Next step
`/5bib-qc FEATURE-090-crew-certificate-gcn`
