# FEATURE-090 — IMPLEMENTATION_NOTES (Reviewer's Guide)

## Section 1: 🚧 Deviations from Spec (intentional)

- **[Deviation #1] Admin components fold vào editor `[id]/page.tsx`** — Plan Scope Lock liệt kê `BatchDialog/TemplateLayerForm/RosterUpload/RecipientTable/PreviewPane.tsx` riêng.
  - **I did:** Toàn bộ editor (3 tab + layer form + roster + preview) trong 1 file `[id]/page.tsx`; create dialog trong `page.tsx` (list).
  - **Why:** Khớp precedent landing/short-links (mọi thứ trong page). Ít file, ít prop-drilling. Giảm scope (không thêm file).
  - **Reviewer check:** editor render đủ 3 tab + 9 state.

- **[Deviation #2] confirmRoster REPLACE toàn bộ recipients** — PRD không nói rõ append vs replace.
  - **I did:** `deleteMany({batchId})` rồi `insertMany`.
  - **Why:** Re-upload roster = danh sách mới hoàn chỉnh (BTC sửa file Excel rồi up lại). Idempotent, tránh trùng.
  - **Reviewer check:** up lần 2 không nhân đôi crew. Trade-off: không merge từng phần (acceptable MVP).

- **[Deviation #3] Layout designer = form toạ độ + live preview (KHÔNG Konva)** — đúng Plan, nhắc lại để reviewer rõ.
  - **Reviewer check:** "Lưu & xem trước" render đúng layer text + photo box.

## Section 2: ⚙️ Forced Changes (reality ≠ spec)

- **[Forced #1] `import * as Papa from 'papaparse'`** (KHÔNG default import)
  - **PRD assumed:** import papaparse bình thường.
  - **Reality:** `import Papa from 'papaparse'` → `Papa` undefined dưới ts-jest (CJS interop) → `Papa.parse` crash. Test bắt được.
  - **Workaround:** namespace import `* as Papa`.
  - **BA/Manager action:** ghi conventions — CJS lib (papaparse) dùng `* as` trong backend.

- **[Forced #2] `CertificateTemplate.race_id` required** → KHÔNG reuse collection.
  - **Reality:** confirmed schema:83 required+index. Standalone crew không có race.
  - **Workaround:** embed `CrewTemplate` (reuse sub-schema classes) trong batch doc + map → `RenderableTemplate` khi render.

- **[Forced #3] Engine `interpolate` hardcoded token** → cần mở rộng để crew token resolve.
  - **Workaround:** additive `RenderData.variables?` + generic pass; `render()` param widen `RenderableTemplate`. Athlete caller no-op (test regression PASS).

## Section 3: ⚖️ Tradeoffs Considered

| Decision | Chosen | Alternative | Why | Cost |
|----------|--------|-------------|-----|------|
| Crew template | Embed trong batch | Reuse certificate_templates collection | Decouple race_id required | Không tái dùng /certificates Konva editor → tự build form designer |
| Engine variables | Additive generic pass | Refactor interpolate sang full generic map | Backward-compat tuyệt đối cho athlete cert | Hai cơ chế token (cố định + generic) cùng tồn tại |
| render() param | Widen `RenderableTemplate` interface | Ép crew build full CertificateTemplate (dummy race_id) | Sạch, self-documenting | +1 interface export |
| Roster confirm | Replace all | Append/upsert by name | Idempotent re-upload | Không merge từng phần |
| Render cache | base64 Redis 600s | Persist S3 + presigned | Đơn giản, render rẻ on-demand | Redis chứa binary base64 (nhỏ, TTL ngắn) |
| Admin designer | Form + preview | Konva drag-drop | Bounded scope MVP | UX toạ độ thủ công (preview bù) |

## Section 4: 🔬 Reviewer Notes

### Files cần review kỹ (priority order)
1. **`certificate-render.service.ts`** (interpolate generic pass + RenderData.variables + RenderableTemplate + render param) — SHARED engine, verify additive KHÔNG phá athlete render. Engine regression test trong crew spec.
2. **`crew-certificates.service.ts:renderPublic/buildRenderData/toRenderable`** — map roster → variables + photo; inactive/invalid-id → 404; cache.
3. **`crew-certificates.service.ts:searchPublic`** — BR-05 anti-enumeration (<2 ký tự [], cap 20, no list-all, list không leak photoUrl/extra).
4. **`roster-parser.ts`** — header VN normalize match; photoUrl http/https only (SSRF); MAX_ROWS cap; thiếu cột.
5. **`crew-certificates.controller.ts`** — route order (public trước :id); admin guard mọi mutation + preview; public chỉ search + render.

### Concurrency hotspots
- `confirmRoster` deleteMany+insertMany không atomic (no transaction) — re-upload đồng thời hiếm (1 admin). Acceptable MVP. TD nếu cần.

### Edge cases tested vs deferred
- ✅ Tested: roster csv/xlsx/invalid/SSRF-url, search normalize/min/cap/inactive, render map/invalid-id/inactive, engine generic + regression, createBatch dup, confirm replace.
- ⚠️ Deferred (QC/staging): auth 401, Nest boot smoke, real PNG pixel correctness, admin browser walkthrough, Logto, S3 upload live, large 500-row perf.

### Type safety
- KHÔNG `as unknown as`. 1 narrowed cast `doc.template as BatchResponseDto['template']` trong toBatchResponse (CrewTemplate → DTO shape, structural khớp). `as CrewTemplate` trong updateBatch (DTO → schema class, structural khớp).

### Security checklist
- [x] Admin guard: create/list/get/update/delete/roster*/recipients/preview = LogtoAdminGuard. Public: search + render only.
- [x] Anti-enumeration BR-05 (min 2 char, cap 20, no list-all, list no sensitive field).
- [x] photoUrl http/https only (roster-parser + buildRenderData chỉ truyền photoUrl đã validate).
- [x] No leak `_id`/`createdBy`/`__v` (toResponse allowlist).
- [x] No SQL (Mongo only); regex search escaped.
- [x] Roster file size cap 5MB (FileInterceptor limit) + MAX_ROWS 500.

### Performance
- Render p95 mục tiêu <800ms cold / <100ms cache. Search indexed `{batchId, normalizedName}`. Đo thật → QC/staging.

### Deploy runbook (F-090)
1. CLAUDE.md: thêm S3 **lifecycle rule 8** prefix `crew-certificates/` (persist, KHÔNG mix result-images/ 24h) + Redis registry `crew-cert:render:` / `crew-cert-lock:`.
2. Verify font Be Vietnam Pro render dấu tiếng Việt trên GCN (đã có trong engine).
3. Public page `/gcn/<slug>` served bởi frontend (result-fe domain) — không cần subdomain.
