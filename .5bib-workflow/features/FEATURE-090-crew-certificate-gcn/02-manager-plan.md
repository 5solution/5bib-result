# FEATURE-090: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-06-17
**Reviewer:** 5bib-manager
**Linked:** `00`, `01`

---

## 📌 Pre-flight + spot-check (code thật)
- [x] `render(template, data, options)` destructure `{canvas, layers, photo_area, placeholder_photo_url, photo_behind_background}` (certificate-render.service.ts:87-98) → `RenderableTemplate` interface khớp chính xác ✅
- [x] `interpolate(text, data)` hardcoded 13 token (240-262) → mở rộng generic additive an toàn ✅
- [x] `CertificateTemplate.race_id` **required** (schema:83) → xác nhận crew PHẢI embed template riêng (KHÔNG reuse collection race-scoped) ✅
- [x] DTO reuse tồn tại: `template-canvas.dto.ts` + `template-layer.dto.ts` + `photo-area.dto.ts` ✅
- [x] `certificates.module` exports `CertificateRenderService` ✅ ; papaparse + exceljs load OK ✅
- [x] `slugifyVN` (common/utils/slugify.ts) + partners-import exceljs pattern ✅

## ✓ PRD Validation Checklist
- [x] User Stories + Personas (Admin / Anonymous Crew)
- [x] BR-01..11 testable
- [x] UI states đủ 9 (admin editor + public)
- [x] Endpoint table + DTO + route order (public trước :id)
- [x] Data source rõ; engine extension additive + regression flagged
- [x] Security: anti-enumeration + photoUrl http/https + roster MIME/size + admin guard
- [x] Performance SLA cụ thể (render <800ms cold / search <150ms)
- [x] KHÔNG migration; S3 lifecycle rule 8 flagged PAUSE

## 📊 Cross-check memory
- **Architecture:** module mới `crew-certificates/` + **1 shared-engine edit** (render service generic variables). Reuse CertificateRenderService qua DI (module exports sẵn). Sau deploy: codebase-map + CLAUDE.md S3 rule 8 + Redis `crew-cert:*`.
- **Convention:** embed template = reuse schema classes (TemplateCanvas/TemplateLayer/PhotoArea) — pattern reuse-schema-class cross-module. Roster import = port F-032 exceljs 2-step. Diacritic search = slugifyVN.
- **Known issues:** S3 prefix mix risk (CLAUDE.md "do NOT mix result-images/") → bắt buộc prefix `crew-certificates/` riêng + rule 8.

## 📋 Files được phép thay đổi (Scope Lock)

**Backend `backend/src/`:**
- ➕ `modules/crew-certificates/crew-certificates.module.ts`
- ➕ `modules/crew-certificates/crew-certificates.controller.ts`
- ➕ `modules/crew-certificates/crew-certificates.service.ts`
- ➕ `modules/crew-certificates/roster-parser.ts` (exceljs + papaparse helper)
- ➕ `modules/crew-certificates/schemas/crew-cert-batch.schema.ts` + `crew-cert-recipient.schema.ts`
- ➕ `modules/crew-certificates/dto/*.dto.ts` (CreateBatch/UpdateBatch/RecipientRow/RosterPreview/CrewSearchResult/BatchResponse/BatchListResponse)
- ➕ `modules/crew-certificates/crew-certificates.constants.ts` (CACHE keys, MAX_ROWS, slug regex)
- ➕ `modules/crew-certificates/crew-certificates.service.spec.ts`
- ✏️ `modules/certificates/services/certificate-render.service.ts` — **CHỈ**: `RenderData += variables?`, `interpolate()` generic pass, `render()` param `RenderableTemplate` (CertificateTemplate vẫn assignable). KHÔNG đổi logic vẽ.
- ✏️ `modules/certificates/certificates.module.ts` — KHÔNG cần (CertificateRenderService đã exports). Crew module import `CertificatesModule`.
- ✏️ `modules/app.module.ts` — register `CrewCertificatesModule`.

**Frontend `frontend/`:**
- ➕ `app/gcn/[slug]/page.tsx` (+ optional small components)

**Admin `admin/src/`:**
- ➕ `app/(dashboard)/crew-certificates/page.tsx` + `[id]/page.tsx`
- ➕ `components/crew-certificates/{BatchDialog,TemplateLayerForm,RosterUpload,RecipientTable,PreviewPane}.tsx`
- ➕ `lib/crew-cert-api.ts` + `crew-cert-hooks.ts`
- ✏️ `lib/nav-groups.ts` — nav "GCN Crew"

🛑 Ngoài scope = hỏi Manager. **ĐẶC BIỆT:** edit `certificate-render.service.ts` CHỈ additive — nếu phải đổi logic vẽ hiện có → DỪNG.

## 🔧 Tech approach (Manager chốt)
- **Embed template** trong `crew_cert_batches.template` (reuse TemplateCanvas/TemplateLayer/PhotoArea classes). Decouple race_id.
- **Engine generic variables:** `interpolate` sau hardcoded → `if (data.variables) for [k,v] replace \{k\} → v` (escape k). Token thừa → rỗng. `render` param → `RenderableTemplate` interface (export từ render service).
- **Render data map:** `runner_name=fullName`, `runner_photo_url=photoUrl` (chỉ khi http/https), `event_name=eventName`, `variables={full_name, position, ...extraFields}`.
- **Roster:** `roster-parser.ts` detect ext (.xlsx → exceljs eachRow / .csv → papaparse) → rows → validate (Họ tên + Vị trí required) → preview {valid, invalid}. 2-step confirm.
- **Search:** `normalizedName` index, query `slugifyVN(name)` ≥2 ký tự, `{ batchId, normalizedName: /q/ }` limit 20.
- **Cache render:** base64 PNG Redis 600s + SETNX (port F-089/landing). DEL on batch/recipient update.

## 🛑 PAUSE points cho Coder
- 🛑 Edit `certificate-render.service.ts` PHẢI additive — chạy lại FULL test certificates hiện có (regression) TRƯỚC khi mark READY_FOR_QC. Nếu 1 test cũ fail → DỪNG.
- 🛑 KHÔNG `pnpm install`. KHÔNG migration. KHÔNG đụng fee/auth/order/race/certificates CRUD logic.
- 🛑 S3 lifecycle rule 8 (`crew-certificates/`) — ghi runbook + CLAUDE.md ở deploy (KHÔNG tự đổi AWS).

## 🧪 Unit test BẮT BUỘC (`crew-certificates.service.spec.ts` + engine)
- [ ] roster parse: xlsx + csv → valid/invalid breakdown (thiếu Họ tên/Vị trí)
- [ ] createBatch slug dup → 409; slug sai regex → 400
- [ ] search diacritic-insensitive ("nguyen van a" → "Nguyễn Văn Á"); <2 ký tự → []; cắt 20; rỗng → [] (no list-all)
- [ ] render data map: variables {full_name, position, extra} + photoUrl http/https only
- [ ] batch inactive → search/render 404
- [ ] response no leak `_id`/`createdBy`
- [ ] **engine: interpolate generic variables** resolve `{full_name}`/`{position}` + **regression** athlete tokens cũ vẫn đúng (KHÔNG có variables)

## 📊 Verdict
> ### ✅ APPROVED — Coder bắt đầu được.

PRD code-verified, reuse engine đúng, scope rõ. Rủi ro chính = shared-engine edit (mitigate: additive-only + regression mandatory) + S3 prefix (mitigate: rule 8). Admin builder = form+preview (bounded, KHÔNG Konva).

## ✅ Sẵn sàng `/5bib-code`?
- [x] Yes.

## 🔗 Next step
`/5bib-code FEATURE-090-crew-certificate-gcn`
