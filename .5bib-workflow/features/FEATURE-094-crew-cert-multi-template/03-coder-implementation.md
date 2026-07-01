# FEATURE-094: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC
**Started:** 2026-06-27
**Author:** 5bib-fullstack-engineer
**Linked:** `00`, `01`, `02`

## 📌 Pre-flight
- [x] Đọc 00/01/02 (PLAN ✅ APPROVED) + conventions + code crew-cert thật (schema/service/controller/dto/admin page).

## 🔍 Impact Assessment
- **Backend:** MongoDB `crew_cert_batches` thêm `templates[]` (default `[]`, backward-safe — batch F-090 cũ đọc ra `?? []`). Redis render cache per-recipient KHÔNG đổi key; `invalidateBatchRenders` gọi khi PATCH (đã có). KHÔNG migration script.
- **Frontend:** admin crew-cert dùng **hand-typed** `crew-cert-api.ts` (KHÔNG generated SDK) → **KHÔNG cần `pnpm generate:api`** (Deviation #1). TanStack Query: thêm `useCrewPositions`, invalidate `crew-positions` sau confirm roster.
- **API:** response `templates[]` additive → không breaking.

## ⚠️ Edge Cases Covered
- [x] position khớp phôi phụ → phôi phụ; không khớp/rỗng → default (pickTemplateForPosition, TC-01/02/03)
- [x] match trim + case-insensitive (TC-04)
- [x] batch F-090 cũ `templates` undefined → default, không crash (`?? []`, TC-05)
- [x] position gán >1 phôi → 400 (assertPositionsUnique, TC-06/07)
- [x] >10 phôi phụ → 400 (ArrayMaxSize, TC-08)
- [x] admin: switch phôi commit editor trước (không mất chỉnh), position đã gán chỗ khác → disable, phôi phụ thiếu nền/position → chặn Lưu

## 🧠 Logic & Architecture
- **Backend:** `pickTemplateForPosition(position, batch)` thuần (trim+lowercase match `templates[].positions` → fallback `batch.template`). Dùng ở `renderPublic` + backward via `?? []`. `assertPositionsUnique` chặn 1 position gán nhiều phôi. `getPositions` distinct. Giữ `template` (default) → **0 migration**, batch cũ chạy nguyên.
- **Admin:** pattern **commit-on-switch** — editor flat-state là bản làm việc của phôi đang chọn; đổi phôi → `commitActive()` ghi vào `phoiList[idx]` rồi nạp phôi mới. `saveTemplate` build tất cả: `{template: phoiList[0], templates: phoiList[1..]}`. Reuse 100% editor kéo-thả + live preview cho phôi active. Position gán bằng chip multi-select (distinct từ `useCrewPositions`), enforce unique client-side + server-side.

## 💻 Files Changed
### Backend
- ✏️ `schemas/crew-cert-batch.schema.ts` — + `CrewCertNamedTemplate` sub-schema + `templates` prop (default [])
- ✏️ `dto/crew-batch.dto.ts` — + `CrewNamedTemplateDto` + `UpdateBatchDto.templates` (ArrayMaxSize 10)
- ✏️ `dto/crew-response.dto.ts` — + `templates` vào `BatchResponseDto`
- ✏️ `crew-certificates.service.ts` — + `pickTemplateForPosition`/`assertPositionsUnique`/`getPositions`; `renderPublic` dùng pick; `updateBatch` set templates + validate; response mapper +templates
- ✏️ `crew-certificates.controller.ts` — + `GET :id/positions`
- ✏️ `crew-certificates.service.spec.ts` — +11 test F-094
### Frontend (admin)
- ✏️ `src/app/(dashboard)/crew-certificates/[id]/page.tsx` — multi-phôi (thanh chọn phôi + gán vị trí + editor reuse + save-all)
- ✏️ `src/lib/crew-cert-api.ts` — + `CrewNamedTemplate` + `templates` + `getPositions`
- ✏️ `src/lib/crew-cert-hooks.ts` — + `useCrewPositions` + templates trong updateBatch + invalidate crew-positions

## 🧪 Tests Written
```
PASS src/modules/crew-certificates/crew-certificates.service.spec.ts
  F-094 renderPublic — chọn phôi theo position
    ✓ TC-01 position khớp phôi phụ → render phôi phụ
    ✓ TC-02 không khớp → phôi mặc định
    ✓ TC-03 position rỗng → mặc định
    ✓ TC-04 case-insensitive + trim
    ✓ TC-05 batch F-090 cũ (templates undefined) → default, không crash
  F-094 updateBatch — validate + set templates
    ✓ TC-06/07 position gán >1 phôi → BadRequestException
    ✓ TC-11 templates hợp lệ → set + invalidate cache
  F-094 getPositions
    ✓ TC-10 distinct + trim + bỏ rỗng + sort
Tests: 23 passed, 23 total  (12 F-090 cũ + 11 F-094)
```
- tsc clean backend (crew-cert) + admin (crew-cert). Anti-pattern scan: 0 `any`/`console.log`/`as unknown` MỚI (cast `as CrewCertNamedTemplate[]` mirror existing `as CrewTemplate` pattern F-090).

## 🛑 PAUSE/Confirmation log
- Danny chốt (qua AskUserQuestion): hướng 🅱️ multi-template/1-đợt + map = admin-gán-nhóm. Không migration (backward-safe). KHÔNG dep mới.

## 🚧 Scope creep
- [x] KHÔNG. Đúng Scope Lock (backend 6 + admin 3 + spec). KHÔNG đụng render-core/roster-parser/public-search.

## 🐛 Known limitations / Tech debt
- Live admin UI test chạy trên DEV sau deploy (backend F-094 phải deploy trước để `/positions` + PATCH templates hoạt động) — pattern F-092/F-093.
- Preview phôi phụ dùng recipient mẫu ĐẦU đợt (không lọc theo position của phôi) — chấp nhận (chỉ để xem thiết kế). TD-F094-PREVIEW-SAMPLE nếu cần.

## ✅ Self-Review Pipeline
- [x] B1 tsc clean (backend + admin crew-cert)
- [x] B2 PRD adherence (BR-01..09 + TC-01..11 có test/impl)
- [x] B3 anti-pattern scan clean (no new any/console/as-unknown)
- [x] B4 field-map audit — templates spread qua fieldsToTemplate, không hand-pick drop
- [~] B5/B6 PROD-smoke + UI live — **defer DEV** (cần backend deploy; live-test admin trên DEV/local-preview sau)
- [x] B7 real-world data (test dùng vị trí VN "Trọng tài"/"Y tế"/"TNV")
- [x] B8 Files vs Scope Lock — 0 creep
- [x] B9 generate:api — N/A (crew-cert hand-typed, xem Deviation #1)
- [x] B10 unit tests PASS (23)
- [x] B11 IMPLEMENTATION_NOTES.md 4 sections

→ Status: 🟠 READY_FOR_QC

## 🔗 Next step
Danny chạy: `/5bib-qc FEATURE-094-crew-cert-multi-template`
