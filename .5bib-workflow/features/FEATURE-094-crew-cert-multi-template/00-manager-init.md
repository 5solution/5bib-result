# FEATURE-094: GCN Crew — nhiều phôi theo vị trí (multi-template per batch)

**Status:** 🟡 INITIATED
**Created:** 2026-06-27
**Owner:** Danny
**Type:** EXTEND_EXISTING (mở rộng F-090 crew-certificates)
**Created by:** 5bib-manager

---

## 🎯 Why this feature

BTC có **3 loại GCN với thiết kế (phôi) khác nhau cho các vị trí crew khác nhau** (vd Trọng tài / TNV / Y tế). Hiện F-090 chỉ cho **1 phôi/đợt** → mọi crew cùng 1 nền, `{position}` chỉ là chữ in đè. Cần cho **nhiều phôi trong 1 đợt, tự chọn theo `position`** — GIỮ 1 đợt / 1 slug / 1 ô tìm-theo-tên (crew chỉ cần 1 link, gõ tên, ra đúng GCN theo vị trí). Danny đã chốt **hướng 🅱️ multi-template/1-đợt** (loại 🅰️ tạo 3 đợt riêng vì crew phải đoán link).

---

## 📂 Impact Map (đã đọc code thật 2026-06-27)

### Module chạm
- `backend/src/modules/crew-certificates/` — schema batch + service render + DTO
- `admin/src/app/(dashboard)/crew-certificates/[id]/` — editor phôi (1 → N)

### File then chốt (Coder đọc trước)
- **`backend/.../schemas/crew-cert-batch.schema.ts`** — hiện `@Prop CrewTemplate template` (đơn, embedded, reuse sub-schema từ `certificates/`). Cần → **nhiều phôi** (`templates[]` hoặc giữ `template` default + `templates[]` extra — BA chốt model).
- **`backend/.../schemas/crew-cert-recipient.schema.ts`** — **đã có `position: string`** (required) + `normalizedName` index. KHÔNG cần thêm field (trừ khi chọn mapping bằng cột roster → thêm field vd `templateKey`).
- **`backend/.../crew-certificates.service.ts`** — **3 chỗ render dùng `batch.template`:** `renderPublic()` (≈206, `toRenderable(batch.template)`), `renderPreview()` (≈234, `draftTemplate ?? batch.template`), + `buildRenderData()`. Cần logic **chọn phôi theo `recipient.position`** (fallback default). + `roster/confirm` (map extraFields) nếu chọn mapping bằng cột.
- **`backend/.../dto/crew-batch.dto.ts`** — `template` field trong Create/Update → `templates[]`.
- **`admin/.../crew-certificates/[id]/page.tsx`** — editor kéo-thả 1 phôi → quản N phôi + gán vị trí.
- `admin/src/lib/crew-cert-api.ts` + `crew-cert-hooks.ts` — nếu đổi DTO → regen SDK.

### Endpoint liên quan (KHÔNG đổi route, chỉ đổi behavior)
- `GET /api/crew-certificates/public/:slug/search` — search per-slug (giữ nguyên: 1 đợt/1 slug).
- `GET /api/crew-certificates/public/render/:recipientId` — render: giờ **chọn phôi theo `position` của recipient** thay vì dùng phôi đơn.
- Admin CRUD `POST/PATCH /crew-certificates` + `/:id/roster/*` + `/:id/preview`.

### Schema/DB
- MongoDB `crew_cert_batches`: `template` (đơn) → **nhiều phôi**. Model do BA chốt (2 phương án ở PAUSE). **Migration batch cũ:** `template` hiện có → thành phôi mặc định trong cấu trúc mới (KHÔNG mất data GCN đang chạy).
- MongoDB `crew_cert_recipients`: `position` đã có. (Có thể thêm `templateKey` nếu mapping bằng cột roster.)
- Redis: `crew-cert:render:<recipientId>` (PNG cache) — **per-recipient nên vẫn đúng** khi mỗi recipient có phôi theo position; `invalidateBatchRenders` (đã có) DEL khi mutation → cần gọi thêm khi đổi mapping/templates. `crew-cert-lock:<recipientId>` giữ nguyên.
- S3: prefix `crew-certificates/` (phôi nền) — giờ upload **N phôi/đợt** (vẫn cùng prefix, lifecycle rule 8 persist). GCN render on-demand (không lưu S3) — không đổi.

---

## ⚠️ Risk Flags

- 🟡 **MED — Schema migration batch cũ.** F-090 đã live PROD (v1.22.0) → có `crew_cert_batches` với `template` đơn. Đổi sang multi-template PHẢI migrate (giữ phôi cũ làm default) + backward-safe render (batch chưa migrate vẫn render được). BA cần migration plan → 🛑 PAUSE.
- 🟡 **MED — Render selection logic.** `renderPublic`/`renderPreview` chọn phôi theo `position`; phải có **fallback phôi mặc định** khi `position` không khớp phôi nào (nếu không → recipient không render được GCN). Edge: position rỗng/lệch chính tả trong roster.
- 🟡 **MED — Admin editor UX.** Từ 1 editor kéo-thả → quản N phôi + gán vị trí. Đây là phần UI nặng nhất (F-090 editor phức tạp). Cần test render/tương tác thật (bài học `feedback_admin_ui_must_test_live`: Base UI checkbox vô hình, next build > tsc).
- 🟢 **LOW — Render engine core.** KHÔNG đụng `certificate-render.service.ts` (chỉ gọi nhiều lần với template khác nhau). Reuse nguyên.
- 🟢 **LOW — Public search/slug/idempotency.** Giữ 1 đợt/1 slug → UX crew không đổi.

---

## 🚧 PAUSE Conditions cần Danny quyết khi BA viết PRD

- [ ] **Cách map `position` → phôi** (Danny defer "tính sau"): **(A)** admin gán nhóm `position` → phôi SAU khi upload roster (thấy list position, kéo vào từng phôi; KHÔNG sửa file roster) · **(B)** thêm cột "Loại GCN" trong file Excel roster (BTC điền A/B/C → tự map). → BA đề xuất + Danny chốt.
- [ ] **Model schema:** `templates[]` thay hẳn `template` (migration bắt buộc mọi batch) HAY giữ `template` = phôi mặc định + `templates[]` = phôi phụ theo vị trí (ít migration hơn, backward-safe)?
- [ ] **Fallback:** recipient có `position` không khớp phôi nào → dùng phôi mặc định? (đề xuất: có 1 phôi default bắt buộc).
- [ ] **Số phôi tối đa/đợt:** cố định 3 hay N tùy ý (đề xuất N, min 1).
- [ ] **Admin editor:** quản N phôi kiểu gì (tabs mỗi phôi / list + editor riêng) + chỗ gán vị trí.

---

## 🎯 Success criteria (gợi ý BA)

- 1 đợt có ≥2 phôi, gán theo vị trí; crew gõ tên → render **đúng phôi theo `position`** của mình.
- Batch cũ (F-090, 1 phôi) vẫn render bình thường sau migration (0 mất data/GCN gãy).
- Fallback: position lệch → vẫn ra GCN (phôi default), KHÔNG lỗi.
- Admin: cấu hình N phôi + gán vị trí, live preview render đúng từng phôi.
- Render cache per-recipient vẫn đúng + invalidate khi đổi phôi/mapping.

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] Yes — BA bắt đầu được. 5 PAUSE ở trên là quyết định thiết kế (mapping method + model + fallback + max + editor UX) — BA đề xuất, Danny chốt trong/sau PRD.

---

## 🔗 Next step

Danny chạy: `/5bib-prd FEATURE-094-crew-cert-multi-template`
