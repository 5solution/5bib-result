# FEATURE-090: Deploy & Memory Sync

**Status:** ✅ DONE
**Deployed (memory-closed):** 2026-06-17
**Author:** 5bib-manager
**Linked:** `00`–`04` + `IMPLEMENTATION_NOTES.md`

---

## 📌 Pre-flight
- [x] `04-qc-report.md` = ✅ APPROVED
- [x] Unit tests 20/20 PASS (15 service + 5 QC)
- [x] Files khớp Scope Lock `02` (3 deviation + 1 forced documented; engine edit additive-only như cam kết)
- [x] `IMPLEMENTATION_NOTES.md` đủ 4 sections

## 📊 Deploy summary
- QC: 0 CRITICAL/HIGH, 11/11 BR, engine regression-safe, 2 persona traced.
- Tests 20/20. tsc clean ×3 app. Anti-pattern clean ×3.
- Migration: KHÔNG. Dep mới: KHÔNG. SDK: N/A (hand-typed).
- Git: CHƯA commit/push. Branch đề xuất `5bib_crew_cert_v1`.
- Infra: S3 lifecycle rule 8 `crew-certificates/` (đã ghi CLAUDE.md) — ops apply trên AWS khi golive.

## 🔬 Manager Independent Code Review
| # | File | Verdict | Findings |
|---|------|---------|----------|
| 1 | `certificate-render.service.ts` interpolate/render/RenderData (SHARED) | ✅ | **Additive xác nhận đọc code:** `if (data.variables)` guard → athlete caller (no variables) chạy chain token cố định rồi SKIP → byte-identical. Generic pass escapeToken (no regex injection). Fixed-token-first → variables key trùng tên token cố định = no remaining `{token}` = harmless no-op. `render(RenderableTemplate)` widen — CertificateTemplate assignable. 0 red flag. Regression test (athlete `{runner_name}`) PASS. |
| 2 | `crew-certificates.service.ts` renderPublic/buildRenderData/toRenderable | ✅ | map fullName/position/photoUrl→variables đúng; inactive/invalid-id→404; toRenderable map camelCase→snake_case render shape đúng; cache base64 + DEL. |
| 3 | `crew-certificates.service.ts` searchPublic | ✅ | BR-05 anti-enum: <2 ký tự return [] TRƯỚC query DB; cap 20; escapeRegex; list chỉ {id,fullName,position} no leak. |
| 4 | `roster-parser.ts` | ✅ | header VN normalize (NFD strip) match Họ tên/Vị trí; photoUrl http/https only; MAX_ROWS 500 cap; thiếu cột → invalid rõ. `import * as Papa` (forced, đúng). |
| 5 | `crew-certificates.controller.ts` | ✅ | route order public/* trước :id; LogtoAdminGuard 9 admin method (QC Reflect test confirm); public chỉ search+render; FileInterceptor 5MB limit; StreamableFile PNG. |

**Type safety:** 2 narrowed structural cast (`as CrewTemplate` / `as BatchResponseDto['template']`) — shape khớp, KHÔNG `as unknown as`. **Security:** guard + anti-enum + SSRF photoUrl + escapeRegex/escapeToken + no leak. **Verdict: ✅ APPROVED**, 0 red flag.

## 📝 Memory diff (đã apply)
- `feature-log.md`: Counter `FEATURE-091`. In-flight F-090 → moved. Shipped +1 row (top). In-flight giờ rỗng feature mới (chỉ F-016 legacy).
- `change-history.md`: append entry đầy đủ (top).
- `codebase-map.md`: +node `crew-certificates/` + engine extension note.
- `CLAUDE.md`: Redis `crew-cert:render:`/`crew-cert-lock:` + **S3 lifecycle rule 8** `crew-certificates/`.
- `known-issues.md`: +4 TD (ROSTER-TXN / KONVA / PHOTO-UPLOAD / LIVE-E2E).
- `conventions.md` (ghi change-history): CJS `import * as Papa`; reuse sub-schema cross-module; engine generic-variable additive pattern.

## 🖼️ Manual Visual Verification (Danny 2026-06-17 — "test thật trên giao diện?")
- **`next build` PASS** cả admin (route `/crew-certificates` + `/crew-certificates/[id]` build) + frontend (`/gcn/[slug]` build) — gate thật Next 16, catch RSC/import lỗi tsc bỏ sót.
- **Render GCN PNG thật qua engine** (ts-node) với data tiếng Việt "Nguyễn Thị Hồng Nhung / Trưởng trạm tiếp nước số 3 / LÀO CAI MARATHON 2026 — DÒNG CHẢY BIÊN CƯƠNG": **dấu tiếng Việt render chuẩn (Be Vietnam Pro)** + generic variables `{full_name}/{position}/{don_vi}/{event_name}` resolve đúng + nền cream + chữ legible. ✅
- **Phát hiện qua visual test:** sample dùng `shape` rect viền (no fill) → ra hộp ĐEN (engine `drawShapeLayer` luôn fill mặc định #000). KHÔNG ảnh hưởng F-090 (crew admin editor chỉ tạo text+photo, KHÔNG shape) → TD-ENGINE-SHAPE-FILL-DEFAULT (pre-existing). Re-render text-only → đúng đẹp.
- **QR PNG (F-089-style)** render OK scannable.
- **✅ PUBLIC FLOW LIVE-VERIFIED (Danny "dùng mongo dev"):** SSH tunnel `localhost:27018→dev Mongo` → start backend (CODE MỚI) → seed 3 recipient test → verified qua running stack: (1) search `?name=nguyen` (no dấu) → "Nguyễn Thị Hồng Nhung" (diacritic-insensitive normalizedName); `name=le hong` → "Lê Hồng Phong"; 1-char → `[]` (anti-enum); (2) render endpoint → `image/png 1000×700` PNG thật từ DB→engine, 2nd call Redis cache hit; (3) **browser `/gcn/demo-crew-test`**: nhập "Nguyễn" → list kết quả → click "Xem GCN" → **GCN image render trong browser** (đúng tên/vị trí/sự kiện từ DB) + download "GCN-Nguyễn Thị Hồng Nhung.png", 0 console error. Test data đã xoá khỏi dev + tunnel đóng.
- **CÒN gated:** admin click-through (Logto OAuth login không auto được; admin :3005 của Danny trỏ dev backend chưa có crew code) + S3 upload phôi thật + 500-row perf → TD-F090-LIVE-E2E staging (admin only).

## 🔮 Follow-up
- Ops: S3 lifecycle rule 8 trên AWS + verify font VN render GCN.
- Phase 2: Konva designer + upload ảnh per-person + PDF + QR chống giả.
- Staging: chạy TD-F090-LIVE-E2E.

## ✅ Status
🎉 **FEATURE-090 DONE** — memory synced. Code ready (working tree), Danny commit khi sẵn sàng.

> **Cả 2 feature Danny yêu cầu ("làm cả 089 → 090") đã hoàn tất full workflow.**
