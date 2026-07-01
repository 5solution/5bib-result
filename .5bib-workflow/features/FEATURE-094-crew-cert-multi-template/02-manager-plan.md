# FEATURE-094: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-06-27
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check
- [x] Đã đọc `00` + `01` đầy đủ
- [x] Đã đọc memory (codebase-map crew-cert, conventions, known-issues: crew-cert render cache + admin-UI-must-test-live)
- [x] Spot-check code thật 6 điểm (KHÔNG rubber-stamp)

---

## 🔬 SPOT-CHECK CODE THẬT (verify PRD không hallucinate)

| PRD reference | Code thật | Khớp? |
|---------------|-----------|-------|
| `CrewTemplateDto` reuse được cho phôi phụ | `crew-batch.dto.ts:18` `CrewTemplateDto` (reuse TemplateCanvas/Layer/PhotoArea DTO) | ✅ |
| `UpdateBatchDto.template` → thêm `templates[]` | `crew-batch.dto.ts:84-88` `template?: CrewTemplateDto` | ✅ |
| Batch `template` đơn (schema) | `crew-cert-batch.schema.ts:45` `@Prop CrewTemplate template` embedded | ✅ |
| recipient.position có sẵn | `crew-cert-recipient.schema.ts:20` `position!: string` required + index | ✅ |
| renderPublic dùng batch.template | `service:206` `renderPublic`, `:218` check `batch.template`, `:221` `toRenderable(batch.template)` | ✅ |
| renderPreview `draftTemplate ?? batch.template` | `service:234,236` | ✅ |
| update set doc.template + invalidate | `service:121` `doc.template=...`, `:128` `invalidateBatchRenders(doc._id)` | ✅ |
| invalidateBatchRenders(batchId) tồn tại | `service:313` `private invalidateBatchRenders(batchId: Types.ObjectId)` | ✅ |
| buildRenderData map position | `service:263` `position: recipient.position` | ✅ |
| response mapper có template | `service:300` `template: doc.template ?? null` | ✅ |

→ **Tất cả reference chính xác.** PRD bám code thật, không bịa file/method.

---

## ✓ PRD Validation Checklist
- [x] User Stories (BTC/Admin + Crew + backward-compat) + Personas chuẩn
- [x] BR-01..09 có ID, testable (đặc biệt BR-03 pickTemplate + BR-05 backward-compat + BR-04 position-unique)
- [x] UI states đủ (loading/empty-no-roster/data/chưa-gán-hết/validation/submitting/success/error/confirm-xoá)
- [x] Data source mỗi field rõ (distinct positions từ endpoint mới, templates từ batch)
- [x] Schema change flag + backward-safe (BR-05, `templates ?? []`) — KHÔNG migration bắt buộc
- [x] API additive (`templates[]` thêm vào response, KHÔNG rename/remove) → không breaking SDK; vẫn regen
- [x] Perf SLA số cụ thể (render <2s, /positions <300ms)
- [x] Security boundary rõ (admin-only config, public chỉ render)

## 📊 Cross-check memory
- **Architecture:** KHÔNG thêm node/integration; reuse `certificate-render.service` (gọi nhiều lần). Không update architecture.md.
- **Conventions:** reuse pattern F-090 (embedded template, invalidateBatchRenders, Logto guard). Position-uniqueness validation = pattern mới nhẹ (service-level check).
- **Known-issues:** crew-cert render cache per-recipient → an toàn với multi-template (position quyết định phôi, key vẫn per-recipient). Admin-UI-must-test-live quirk → nhắc Coder test render thật.

---

## 📋 Files được phép thay đổi (Scope Lock)

**Backend (`backend/src/modules/crew-certificates/`):**
- ✏️ `schemas/crew-cert-batch.schema.ts` — thêm `CrewCertNamedTemplate` sub-schema + `@Prop templates: [...] default []`
- ✏️ `dto/crew-batch.dto.ts` — thêm `CrewNamedTemplateDto` (name/positions/template) + `UpdateBatchDto.templates?`
- ✏️ `dto/crew-response.dto.ts` — thêm `templates` vào response DTO
- ✏️ `crew-certificates.service.ts` — thêm `pickTemplateForPosition()`; `renderPublic`/`renderPreview` dùng nó; `update()` set `doc.templates` + giữ `invalidateBatchRenders`; thêm `getPositions()` (distinct); validate position-unique across templates; response mapper +templates
- ✏️ `crew-certificates.controller.ts` — thêm `GET :id/positions`; `preview` nhận `templateIndex?`/`samplePosition?`
- ✏️/➕ `crew-certificates.service.spec.ts` — unit test (append)

**Frontend (`admin/`):**
- ✏️ `src/app/(dashboard)/crew-certificates/[id]/page.tsx` — khối Phôi multi (tabs default+phụ, editor reuse, multi-select gán position)
- ✏️ `src/lib/crew-cert-api.ts` + `crew-cert-hooks.ts` — thêm `templates` + `useCrewPositions(id)`
- 🔄 `src/lib/api-generated/**` (regen sau đổi DTO)

**NGOÀI scope = scope creep:** KHÔNG đụng `certificates/services/certificate-render.service.ts` (core), roster-parser (Danny chọn admin-gán, không cột), public search logic, module khác.

## 🔧 Tech approach
- `pickTemplateForPosition(position, batch)`: `const p=(position??'').trim().toLowerCase(); return batch.templates?.find(t=>t.positions.some(x=>x.trim().toLowerCase()===p))?.template ?? batch.template;` — thuần, dễ unit test.
- Position-unique validation: service-level (gom positions các phôi phụ, check trùng) → 400 VN. (Class-validator khó cross-element → check trong service.)
- Migration: KHÔNG script. `templates ?? []` khi đọc (Mongoose default `[]` nhưng doc cũ vẫn undefined → dùng `?? []` phòng thủ ở pick + mapper).

## 🛑 PAUSE points cho Coder
- 🛑 Schema thêm `templates[]` — backward-safe, KHÔNG migration; nhưng Coder confirm doc cũ đọc ra `templates` undefined → `?? []` mọi nơi.
- 🛑 KHÔNG `pnpm install` dep mới. KHÔNG đụng render-core.
- 🛑 Đụng file ngoài Scope Lock → hỏi Manager.

## 🧪 Unit test BẮT BUỘC (Coder)
- [ ] `pickTemplateForPosition`: match phôi phụ (TC-01) / no-match→default (TC-02) / empty→default (TC-03) / case+trim insensitive (TC-04) / `templates` undefined→default backward-compat (TC-05)
- [ ] DTO/service validation: phôi phụ positions rỗng→400 (TC-06) / position trùng 2 phôi→400 (TC-07) / >10 phôi→400 (TC-08)
- [ ] `update()` set `templates` + gọi `invalidateBatchRenders` (TC-11)
- [ ] `getPositions()` distinct+trim+bỏ rỗng+sort (TC-10)

## 📊 Verdict
### ✅ APPROVED
Reuse F-090 sạch, backward-safe (BR-05, không migration), API additive, admin-only. Rủi ro chính = render-fallback (đã có BR-03 + TC-02/03/05) + admin UI multi-phôi (nhắc test live). Spot-check 10/10 khớp code.

## ✅ Sẵn sàng `/5bib-code`? — [x] Yes (theo Scope Lock + unit test trên)

## 🔗 Next step
Danny chạy: `/5bib-code FEATURE-094-crew-cert-multi-template`
