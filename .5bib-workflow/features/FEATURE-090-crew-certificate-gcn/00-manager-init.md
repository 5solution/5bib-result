# FEATURE-090: Giấy Chứng Nhận (GCN) cho Crew sự kiện — tìm theo tên + tự gen ảnh

**Status:** 🟡 INITIATED
**Created:** 2026-06-17
**Owner:** Danny
**Type:** NEW_MODULE (`crew-certificates/`) — REUSE engine module `certificates` có sẵn
**Created by:** 5bib-manager

---

## 🎯 Why this feature

Sau mỗi sự kiện, 5BIB muốn phát Giấy Chứng Nhận (GCN) cho Crew/TNV. Thay vì gửi tay từng người, dựng hệ thống self-service: **admin upload phôi GCN + danh sách crew (tên + vị trí + vài thông tin)** → **crew vào trang public, tìm theo tên → tự sinh ra GCN cá nhân hóa (ảnh PNG)** có Họ tên + Vị trí + thông tin khác, **làm giống GCN giải chạy kèm ảnh** (ý 3).

**Danny chốt 2026-06-17 (qua Manager AskUserQuestion):**
- **Nguồn data crew = admin UPLOAD ROSTER RIÊNG mỗi sự kiện** (file Excel/CSV), **KHÔNG** lấy từ `team-management`/VolRegistration. → feature đứng độc lập, không phụ thuộc luồng đăng ký TNV.
- GCN render **kèm ảnh** — reuse engine certificate có sẵn.

---

## 📂 Impact Map (theo memory + code thật đã verify)

### 🟢 Tin tốt — phần lõi ĐÃ CÓ (Manager verified)
- Module [certificates/](backend/src/modules/certificates/services/certificate-render.service.ts) đã có **engine render template-based** dùng `@napi-rs/canvas`: `drawTextLayer()` (nội suy biến `{variable}`), `wrapText()`, `drawImageCover()`, photo slot, font Be Vietnam Pro (lo dấu tiếng Việt). → render GCN reuse nguyên.
- Schema [certificate-template](backend/src/modules/certificates/schemas/) đã có `TemplateCanvas` (width/height/`backgroundImageUrl`) + `TemplateLayer` (type `text|image|shape|photo`, `text` chứa token `{variable}`, photo slot có border) → **đúng khuôn GCN**: phôi = `backgroundImageUrl`, biến `{full_name}`/`{position}` = text layer, ảnh crew = photo layer.
- [upload.service.ts](backend/src/modules/upload/upload.service.ts) `uploadFile(file, folder?)` (folder param có từ F-083) → upload phôi + ảnh crew vào prefix `crew-certificates/`.
- Parse roster: `xlsx` + `exceljs` + `papaparse` **đã là dep backend** (F-032/F-077) → **KHÔNG cần dep mới**.

### Module sẽ chạm
- ➕ `backend/src/modules/crew-certificates/` — **MODULE MỚI** (controller + service + schema + dto). DEPEND vào `CertificatesModule` (render service) + `UploadModule`.
- ✏️ `backend/src/modules/app.module.ts` — register `CrewCertificatesModule`.
- ✏️ `backend/src/modules/certificates/certificates.module.ts` — `exports: [CertificateRenderService]` nếu chưa export (để crew-certificates inject). Coder verify ở plan.
- ➕ `admin/src/app/(dashboard)/crew-certificates/` — quản lý "đợt GCN": tạo, upload phôi + thiết kế vị trí layer, upload roster, preview.
- ➕ `admin/src/lib/crew-certificates-{api,hooks}.ts`.
- ➕ `frontend/app/.../[trang public tìm GCN]` — crew nhập tên → tìm → tải GCN.

### File then chốt cần Coder đọc trước khi code (REUSE)
- `backend/src/modules/certificates/services/certificate-render.service.ts` — engine: `buildFontString`, `drawTextLayer` (nội suy `{var}`), `wrapText`, `drawImageCover`, `loadImageCached`, photo layer. **CORE reuse.**
- `backend/src/modules/certificates/services/certificate-template.service.ts` — CRUD template (canvas+layers). Crew batch tham chiếu/clone 1 template.
- `backend/src/modules/certificates/services/race-certificate-config.service.ts` — pattern gắn template vào 1 race + map biến từ data nguồn (athlete) → đối chiếu để map biến từ **roster row** sang template.
- `backend/src/modules/certificates/schemas/*.ts` — `TemplateCanvas` + `TemplateLayer` shape (đã verify).
- `backend/src/modules/race-result/services/result-image.service.ts` — pattern S3 upload + Redis index + presigned URL + render semaphore (`RENDER_MAX_CONCURRENT`). Reuse cho output GCN.
- `backend/src/modules/upload/upload.{controller,service}.ts` — upload phôi + ảnh + (tùy) zip ảnh crew.
- Admin: `admin/src/app/(dashboard)/landing/` + `landing-{api,hooks}.ts` — khuôn list/create/upload + TanStack Query.
- Frontend public: `frontend/app/(main)/races/[slug]/page.tsx` + `frontend/app/api/[...proxy]/route.ts` — khuôn trang search client + gọi backend qua proxy.

### Endpoint dự kiến (BA chốt shape)
- ➕ `POST /api/crew-certificates/batches` — admin tạo đợt GCN (eventName, templateId/canvas, raceRef? optional). LogtoAdminGuard.
- ➕ `POST /api/crew-certificates/batches/:id/roster` — upload Excel/CSV → parse → lưu recipients (multipart).
- ➕ `POST /api/crew-certificates/batches/:id/photos` — (tùy) upload ảnh crew (map theo tên/mã).
- ➕ `GET /api/crew-certificates/search?batch=<slug>&name=<q>` — **PUBLIC**, tìm crew theo tên (diacritic-insensitive), trả danh sách match (KHÔNG dump cả roster).
- ➕ `GET|POST /api/crew-certificates/render/:recipientId` — **PUBLIC**, render + trả PNG (hoặc presigned URL). Cache.
- ➕ admin CRUD list batches + recipients + preview.

### Schema/DB
- MongoDB MỚI:
  - `crew_cert_batches`: `{ slug (unique, public-facing), eventName, templateId (ref) HOẶC canvas+layers inline, raceRef? optional, active, createdBy, createdAt }`.
  - `crew_cert_recipients`: `{ batchId, fullName, normalizedName (lowercase, bỏ dấu — search index), position, extraFields (Map/subdoc), photoUrl?, createdAt }`. Index `{ batchId, normalizedName }`.
- MySQL platform: **KHÔNG đụng** (roster upload độc lập, KHÔNG dùng VolRegistration — Danny chốt).
- Redis: `crew-cert:render:<recipientId>:<hash>` cache PNG/URL (TTL ngắn), (tùy) `crew-cert:search` cache. Đăng ký CLAUDE.md registry khi deploy.
- **S3: prefix MỚI `crew-certificates/`** — phôi + ảnh crew **persist** (KHÔNG TTL 24h), ảnh GCN sinh ra có thể 24h hoặc persist. 🛑 PAUSE: **thêm S3 lifecycle rule mới** trong CLAUDE.md (rule 8) — KHÔNG để lẫn prefix `result-images/` (xóa sau 24h). Bài học CLAUDE.md "do NOT mix prefix".
- Dependency MỚI: **KHÔNG** (canvas/upload/xlsx/exceljs/papaparse/qrcode đã có).

---

## ⚠️ Risk Flags

- 🟡 **MED — Tìm tên tiếng Việt + trùng tên:** chuẩn hóa bỏ dấu để tìm gần đúng; nhiều crew trùng tên ("Nguyễn Văn A") → phải trả **danh sách match** + cho disambiguate (vị trí/SĐT/mã) chứ không auto-render nhầm người. BA chốt cách phân biệt.
- 🟡 **MED — Lộ roster / enumeration:** trang public tìm theo tên → tránh để bot quét lộ cả danh sách (tên + SĐT). Mitigate: chỉ trả khi query đủ dài + match cụ thể, KHÔNG list-all, rate-limit IP, ẩn field nhạy cảm (SĐT/email) khỏi response. BA chốt field nào hiện ra.
- 🟡 **MED — Thiết kế vị trí layer trên phôi:** admin cần đặt `{full_name}`/`{position}`/ảnh vào đúng chỗ trên phôi. Cần builder UI (kéo-thả hoặc nhập tọa độ). **Kiểm tra `certificates` đã có template builder admin chưa** — nếu có thì reuse, chưa có thì là phần UI nặng nhất. Coder verify ở plan.
- 🟡 **MED — S3 lifecycle:** phôi GCN phải persist; nếu lỡ ghi vào `result-images/` sẽ bị xóa sau 24h. Bắt buộc prefix riêng `crew-certificates/` + rule lifecycle mới.
- 🟢 **LOW — Engine render:** đã production-proven (certificates + result-image). Font VN OK. Photo slot OK.

---

## 🚧 PAUSE Conditions cần BA/Danny xác nhận khi viết PRD

- [ ] **Cột roster:** Excel/CSV gồm cột nào? Tối thiểu `Họ tên` + `Vị trí`. "Vài thông tin nữa" = những gì (đơn vị/ngày/mã số/lời cảm ơn...)? Cột nào bắt buộc, cột nào tùy? Hỗ trợ cả `.xlsx` và `.csv`?
- [ ] **⭐ Ảnh crew ("kèm ảnh"):** ý 3 "GCN giải chạy kèm ảnh" — ảnh là **(a)** ảnh chân dung của crew (mỗi người 1 ảnh, photo slot) hay **(b)** chỉ ảnh nền phôi đẹp (không cần ảnh từng người)? Nếu (a): nguồn ảnh = cột URL trong roster / upload zip map theo mã / crew tự up khi tìm? Manager đoán: phôi đẹp + (tùy chọn) ảnh chân dung. → Danny chốt.
- [ ] **Builder vị trí:** reuse template builder của `certificates` (nếu admin đã có) hay v1 cho admin **nhập tọa độ {x,y}/preset layout** cho name/position? (ảnh hưởng lớn tới effort UI).
- [ ] **Tìm kiếm:** khớp chính xác hay gần đúng bỏ dấu? Trùng tên xử lý sao (hiện list + chọn theo vị trí/đơn vị)? Field nào hiện trong kết quả tìm (ẩn SĐT?).
- [ ] **Truy cập public:** ai cũng vào được trang theo `slug` đợt GCN, hay cần link/mã sự kiện? Chống quét roster thế nào?
- [ ] **Định dạng tải:** PNG (như GCN giải chạy)? Cần thêm PDF không?
- [ ] **Chống giả mạo:** GCN có cần QR/mã serial xác thực (như cert giải chạy) không, hay v1 không cần?
- [ ] **Gắn với race trong hệ thống:** đợt GCN có cần link `raceRef` tới race có sẵn không, hay hoàn toàn standalone theo `eventName` tự nhập? (Danny chọn upload roster → nghiêng standalone, nhưng raceRef optional để tái dùng branding).
- [ ] **Persist hay render-on-demand:** sinh ảnh mỗi lần tìm (cache ngắn) hay sinh sẵn hàng loạt? Manager đề xuất **on-demand + cache**.

---

## 🎯 Success criteria (gợi ý cho BA)

- Admin tạo 1 đợt GCN: upload phôi + đặt vị trí name/position/ảnh + upload roster Excel → publish, ra `slug` public.
- Crew vào trang, gõ tên → ra đúng mình (xử lý trùng tên) → bấm tải → GCN PNG đẹp, đúng họ tên + vị trí + (ảnh), dấu tiếng Việt chuẩn, trong vài giây.
- Roster không bị quét lộ; field nhạy cảm ẩn; rate-limit IP.
- Phôi + ảnh persist trên S3 (KHÔNG bị xóa 24h).

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] **Yes** — BA bắt đầu được. PRD PHẢI chốt: cột roster, ảnh crew (a/b), builder vị trí (reuse vs nhập tọa độ), xử lý trùng tên + chống enumeration, S3 lifecycle prefix mới.
- Lưu ý BA: lõi render ĐÃ CÓ (`certificate-render.service.ts`) — feature chủ yếu là **roster upload/parse + search + map biến + UI**, KHÔNG viết lại engine canvas. Tham chiếu `race-certificate-config.service.ts` cho cách map biến nguồn → template.

## 🔗 Next step
Danny chạy: `/5bib-prd FEATURE-090-crew-certificate-gcn`
