# FEATURE-094 — Implementation Notes (Reviewer's Guide)

## Section 1: 🚧 Deviations from Spec (intentional)

- **[Deviation #1] KHÔNG chạy `pnpm generate:api`**
  - **Spec said:** PRD 3.4 "Đổi DTO → chạy pnpm generate:api".
  - **I did:** Không chạy.
  - **Why:** Admin crew-cert dùng **hand-typed wrappers** (`crew-cert-api.ts` header ghi rõ "Hand-typed thin wrappers", pattern landing/short-links) — KHÔNG dùng generated SDK. Tao đã tự thêm type `CrewNamedTemplate` + `getPositions` vào file hand-typed. Generated SDK không liên quan crew-cert.
  - **Reviewer should check:** admin gọi API qua `crew-cert-api.ts` (không import từ `api-generated`).

- **[Deviation #2] Preview phôi phụ dùng recipient mẫu đầu đợt (không lọc theo position)**
  - **Spec said:** PRD 2.3 step 8 "render phôi cụ thể với recipient mẫu của phôi đó".
  - **I did:** `POST :id/preview(draftTemplate)` render phôi đang chọn với recipient ĐẦU đợt (cơ chế draft-preview F-090 sẵn có).
  - **Why:** Tái dùng nguyên endpoint draft-preview F-090 (0 thêm behavior BE). Preview chỉ để xem THIẾT KẾ phôi (vị trí chữ/ảnh), không cần đúng recipient theo position. Giảm scope + rủi ro.
  - **Reviewer should check:** admin bấm chọn phôi → preview render đúng thiết kế phôi đó. (TD-F094-PREVIEW-SAMPLE nếu muốn mẫu đúng position.)

## Section 2: ⚙️ Forced Changes (reality ≠ spec)
- **Không có.** Mọi reference PRD khớp code thật (Manager spot-check 10/10 ở `02`). `CrewTemplateDto` reuse được, `UpdateBatchDto`/`renderPublic`/`invalidateBatchRenders` đúng như plan.

## Section 3: ⚖️ Tradeoffs Considered

| Decision | Chọn | Alternative | Why | Cost |
|----------|------|-------------|-----|------|
| Model schema | Giữ `template` (default) + `templates[]` phụ | Thay hẳn bằng `templates[]` | 0 migration, batch F-090 cũ chạy nguyên (`?? []`) | `pickTemplateForPosition` phải fallback về `template` (thêm 1 nhánh) |
| Admin multi-editor | Commit-on-switch (1 editor, đổi phôi commit state) | Extract `<TemplateEditor>` component tái dùng N instance | Reuse 100% editor + drag + preview F-090, ít rủi ro refactor lớn | Phải nhớ `commitActive()` trước mọi switch/add/remove/save (đã bọc trong helper) |
| Position uniqueness | Check ở service (`assertPositionsUnique`) + enforce client (toggle gỡ phôi khác) | class-validator | Cross-element không làm được bằng decorator | Validate 2 nơi (BE là source-of-truth) |
| Preview phôi phụ | recipient mẫu đầu đợt | recipient theo position | reuse draft-preview, 0 BE change | preview không đúng data thật theo position (chấp nhận) |

## Section 4: 🔬 Reviewer Notes

### Files review kỹ (priority)
1. **`crew-certificates.service.ts` `pickTemplateForPosition` + `renderPublic`** — logic chọn phôi + fallback default + `?? []` backward-compat. Test TC-01..05.
2. **`crew-certificates.service.ts` `updateBatch` + `assertPositionsUnique`** — validate position-unique + set `doc.templates` + invalidate cache. TC-06/07/11.
3. **`schemas/crew-cert-batch.schema.ts`** — `CrewCertNamedTemplate` + `templates default []` (backward-safe).
4. **`admin/.../[id]/page.tsx` commit-on-switch** — `commitActive`/`switchPhoi`/`saveTemplate` (build-all). Concurrency: state sync khi đổi phôi.
5. **`admin/.../[id]/page.tsx` togglePosition** — enforce 1 position/1 phôi (gỡ khỏi phôi khác).

### Concurrency hotspots
- Admin commit-on-switch: `commitActive()` đọc flat-state closure hiện tại rồi setState — luôn commit TRƯỚC khi đổi activeIdx. Không có async race (thuần client state).

### Edge cases tested vs deferred
- ✅ Tested: pick match/no-match/empty/case-trim/backward-compat, validation dup/max, getPositions distinct.
- ⚠️ Deferred: preview đúng recipient theo position (Deviation #2); live admin UI (test trên DEV sau deploy).

### Type safety casts
- `crew-certificates.service.ts` `doc.templates = dto.templates as CrewCertNamedTemplate[]` — mirror existing `doc.template = dto.template as CrewTemplate` (F-090). DTO↔schema chỉ khác `canvas.backgroundColor` optional; Mongoose assign an toàn.

### Security
- [x] `GET :id/positions` + PATCH + preview: `LogtoAdminGuard` (admin-only). Public chỉ search + render.
- [x] Public render KHÔNG leak (stream PNG). Response `templates[]` chỉ name/positions/template.
- [x] Upload phôi nền: giữ MIME/size guard F-090.
