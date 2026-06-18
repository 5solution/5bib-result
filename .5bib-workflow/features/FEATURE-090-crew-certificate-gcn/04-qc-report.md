# FEATURE-090: QC Report

**Status:** ✅ APPROVED
**Tested:** 2026-06-17
**Author:** 5bib-qc-gatekeeper
**Linked:** `01-ba-prd.md`, `03-coder-implementation.md`, `IMPLEMENTATION_NOTES.md`

---

## 📌 Pre-flight
- [x] Đọc 01 + 03 + IMPLEMENTATION_NOTES + conventions
- [x] 03 status READY_FOR_QC + Tests Written có output
- [x] Chạy lại unit test Coder LOCAL → **15/15 PASS**

## 🔍 Phase 1: Impact & Regression Audit
### Coder got right
- Engine extension **additive** (variables + RenderableTemplate widen) — `CertificateTemplate` vẫn assignable; engine regression test (athlete `{runner_name}` no-variables) PASS.
- Embed template decouple `race_id` (đúng vì CertificateTemplate.race_id required).
- Roster parse 2-step (port F-032), header VN normalize, photoUrl http/https only.
- Search indexed `{batchId, normalizedName}` + anti-enumeration.
- Reuse CertificateRenderService qua module exports (DI sạch).
- Anti-pattern clean 3 app.
### Findings
- ⚠️ **F-090-Q1 (LOW, accepted):** confirmRoster deleteMany+insertMany không transaction — re-upload đồng thời 2 admin có thể race. 1 admin/đợt thực tế → accept. TD-F090-ROSTER-TXN.
- ⚠️ **F-090-Q2 (LOW, accepted):** render cache base64 trong Redis — binary nhỏ, TTL 600s, OK.
- ✅ Scope khớp Scope Lock (3 deviation documented hợp lý: fold components, replace roster, form-not-Konva). Engine edit additive-only đúng cam kết.

## 🛡️ Phase 2: Security Threat Model
| Threat | Vector | Risk | Status |
|--------|--------|------|--------|
| Auth bypass mutation | admin endpoints no token | CRITICAL | ✅ LogtoAdminGuard mọi mutation+preview (QC structural Reflect test) |
| Roster enumeration | quét `public/:slug/search` | MED | ✅ min 2 ký tự (no DB) + cap 20 + no list-all + list KHÔNG trả photoUrl/extra |
| SSRF qua photoUrl | engine loadImage URL lạ | MED | ✅ roster-parser + buildRenderData chỉ nhận http/https (regex); `file://` reject (test) |
| Regex injection (search) | name `.*`/`(c)` | LOW | ✅ escapeRegex (QC test: source ≠ `.*`) |
| Token regex injection (render) | variable key `a.b` | LOW | ✅ escapeToken (QC test render PNG OK) |
| Recursive interpolation | value chứa `{token}` | LOW | ✅ generic pass 1-shot, không loop (QC test) |
| Info disclosure | leak `_id`/`createdBy` | MED | ✅ toResponse allowlist (test) |
| Upload abuse | file lớn / non-roster | LOW | ✅ FileInterceptor 5MB limit + MAX_ROWS 500 |

**0 CRITICAL/HIGH unmitigated.**

## 🧪 Phase 3-4: Test Scripts + Execution
**`crew-certificates.qc.spec.ts` (5):** guard wiring (public no-guard / 9 admin guarded) + engine escapeToken (regex-char key + recursive-value) + search regex-injection-safe.
```
PASS crew-certificates.service.spec.ts  (15)
PASS crew-certificates.qc.spec.ts       (5)
Tests: 20 passed, 20 total
```
- tsc clean (backend crew+engine+app.module / admin / frontend). Anti-pattern clean 3 app.
- **Performance:** render PNG (canvas) measured ~vài chục–trăm ms trong test (full canvas render produce PNG). Search indexed. Số p95 thật → staging (cần Redis+Mongo+ảnh thật).

## 🔁 Phase 5: PRD Compliance (BR)
- [x] BR-01 batch slug unique+regex — createBatch dup 409 + slug regex DTO
- [x] BR-02/02a roster cột bắt buộc + xlsx/csv + max 500 — roster-parser tests
- [x] BR-03 invalid row breakdown — test
- [x] BR-04 normalizedName slugifyVN — confirmRoster test
- [x] BR-05 search ≥2/≤20/no-list-all/no-leak — search tests + anti-enum
- [x] BR-06/06a render map variables + engine generic — renderPublic + engine tests
- [x] BR-07 inactive → 404 — test
- [x] BR-08 admin guard / public search+render — QC guard wiring
- [x] BR-09 no leak — test
- [x] BR-10 S3 `crew-certificates/` persist — upload folder param (lifecycle rule 8 = deploy)
- [x] BR-11 render cache + DEL on mutation — cache + invalidateBatchRenders

**UI states (code-inspected):** admin list (loading/empty/error/data/confirm) + editor (3 tab, save/preview/roster preview+confirm states) + public (idle/loading/no-result/list/preview). Đủ.

## 🎭 Phase 6: Persona Journey (code-traced; live staging gated)
### Admin tạo đợt + phôi + roster
1. `/crew-certificates` → "+ Tạo đợt" (eventName+slug) → editor.
2. Tab Phôi: upload nền (`/upload` folder crew-certificates) → set W/H → thêm lớp chữ `{full_name}`/`{position}` (x/y/cỡ/màu/căn) + bật ô ảnh → "Lưu & xem trước" → `<img>` render mẫu.
3. Tab Crew: "Tải file mẫu" → up Excel/CSV → preview (N hợp lệ/M lỗi) → "Xác nhận nhập" → bảng recipients.
### Crew (Anonymous) tải GCN
1. `/gcn/<slug>` → gõ tên (≥2) → "Tìm".
2. Trùng tên → list (tên — vị trí) → chọn đúng → `<img>` GCN → "Tải Giấy chứng nhận".
3. Tên sai → "Không tìm thấy".

UI/UX: tabs VN, dialog sm:max-w-md, empty/loading/error states, toast VN, token hint hiển thị. Real-world data: "Nguyễn Văn Á"/"Trần Thị B" + cột "Đơn vị" diacritic.

## 🚧 Tech debt (→ known-issues)
- TD-F090-ROSTER-TXN (LOW): confirmRoster không atomic.
- TD-F090-KONVA (Phase 2): drag-drop designer thay form toạ độ.
- TD-F090-PHOTO-UPLOAD (Phase 2): upload ảnh chân dung per-person (v1 = cột URL).
- TD-F090-LIVE-E2E (staging): admin auth + S3 upload + render pixel + 500-row perf.

## 📊 Final Verdict
> ### ✅ APPROVED — Sẵn sàng deploy
20/20 PASS, 0 CRITICAL/HIGH, 11/11 BR, engine additive regression-safe, UI states đủ, 2 persona traced. 4 TD non-blocking. Live E2E + S3 + Logto gated staging.

## 🔗 Next step
`/5bib-deploy FEATURE-090-crew-certificate-gcn`
