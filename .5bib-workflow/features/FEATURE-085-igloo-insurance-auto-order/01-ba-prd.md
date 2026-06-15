# FEATURE-085: PRD — Igloo Insurance: Daily Auto-Order + Admin Manual-Create

**Status:** 🔵 READY
**Last updated:** 2026-06-15
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` (impact map + risk + 11 PAUSE conditions)
- [x] Đã đọc memory `igloo_insurance_daily_job.md` (API contract + data mapping + eligibility verify số thật)
- [x] Đã đọc `memory/codebase-map.md` — admin guard = `LogtoAdminGuard`; `RaceReadonly`/`AthleteReadonly`/`AthleteSubinfoReadonly` đã đăng ký 'platform' (F-033/F-037); admin dùng hand-typed `*-api.ts`/`*-hooks.ts` (landing precedent)
- [x] Đã đọc `memory/known-issues.md` — TD-RUNNERS-PRIVACY-CONSENT (NĐ13/2023 nghiêm túc), F-015 "never log full CMND", TD-F083-SDK-REGEN (hand-typed wrapper khi backend chưa live)

---

## 🎯 Title + Goal + Scope

**Title:** Igloo Insurance — Daily Auto-Order (cron 7 VĐV/ngày) + Admin Manual-Create.

**Goal:** Tự động + thủ công phát sinh đơn bảo hiểm tai nạn cho VĐV thật của 5BIB sang đối tác **Igloo** (portal đứng trước nhà bảo hiểm **GIC**) nhằm **duy trì volume hợp đồng** đã ký, giữ vị thế hợp tác với Igloo cho sản phẩm tương lai. 5Solution **tự chịu phí**; KHÔNG bán bảo hiểm cho khách trên 5BIB.

**Scope:**
- ✅ **In scope:**
  - Backend module mới `igloo-insurance/`: HTTP client Igloo + tuyển chọn VĐV từ legacy MySQL + 3 cron (daily-select / submit-worker / poll-worker) + Mongo collection lưu đơn + admin REST endpoints.
  - Cron daily auto: chọn 7 VĐV "phát sinh trong ngày" (bù từ kho) → tạo đơn.
  - Admin page (admin.5bib.com): chọn VĐV thủ công theo giải → tạo đơn; danh sách đơn + trạng thái + retry.
  - 2 lớp kill-switch ENV (auto-select + actual egress) cho an toàn dev/prod.
  - PII defense (mask CCCD, không log thô) + audit log + idempotency.
- ❌ **Out of scope (Phase sau):**
  - Bán bảo hiểm cho khách / thu phí từ VĐV / checkout.
  - Cờ consent VĐV / opt-out UI (Phase 1 không thu thập consent — xem PAUSE-85-07).
  - Webhook nhận callback từ Igloo (Phase 1 dùng polling).
  - Báo cáo/đối soát phí với Igloo (chỉ lưu + hiển thị; reconcile tài chính để sau).
  - Public-facing (VĐV xem chứng nhận của mình) — Phase 1 chỉ admin.
  - VĐV nước ngoài dùng passport (chỉ nhận id_number 9–12 chữ số) — xem PAUSE-85-08.

---

## ✅ DANNY ĐÃ CHỐT 2026-06-15 — AUTHORITATIVE OVERRIDES

> Các quyết định dưới là **CHỐT CUỐI**, override mọi default/PAUSE mâu thuẫn phía dưới. Manager + Coder bám theo block này.

1. **Phí cố định 10.000đ/đơn + 10 đơn/ngày.** `IGLOO_DAILY_COUNT=10`. Để mỗi đơn đúng 10k: **`packageCode = ROAD` (luôn)** + **coverage 1 ngày** (`to = from`). `premium = premiumVat = totalPayment = 10000`. **KHÔNG** đổi gói theo race_type, **KHÔNG** nhân theo số ngày. Cần thêm volume → admin tự tạo thủ công.
   → thay BR-IGL-02 (count=10), BR-IGL-07 (1 ngày), BR-IGL-08 (flat 10k). Bỏ `derivePackageCode` TRAIL-logic + premium×days.
2. **`premiumVat = premium = 10000`.**
3. **KHÔNG mask CCCD/PII.** Mongo lưu `insuredIdCard` đầy đủ; DTO trả `idCard`/`phone`/`dateOfBirth` đầy đủ (đổi `idCardMasked`→`idCard`, `phoneMasked`→`phone`, `birthYear`→hiển thị đủ nếu cần). → nới BR-IGL-14 (chỉ giữ hygiene: không spam PII vào log app, KHÔNG bắt buộc mask hiển thị/lưu).
4. **Coverage bắt đầu = `event_start_date` của giải VĐV đó** (vd VĐV Giải Lào Cai → ngày bắt đầu sự kiện Lào Cai). Kết hợp #1 → 1 ngày kể từ `event_start_date`.
5. **CCCD nhận cả 9 (CMND) và 12 số.**
6. **Cron lỗi/<10 eligible → chỉ log, không alert.**
7. **KHÔNG cần cờ consent VĐV.**
8. **KHÔNG lấy VĐV nước ngoài** — lọc `id_number ^[0-9]{9,12}$` (loại passport/giấy tờ có chữ).

---

## 👤 User Stories & Business Rules

### User Stories
- As a **5BIB Back-Office Admin**, tôi muốn hệ thống **tự động mỗi ngày tạo 7 đơn bảo hiểm** cho VĐV thật để **duy trì volume hợp đồng Igloo** mà không cần thao tác tay.
- As a **5BIB Back-Office Admin**, tôi muốn **tự chọn VĐV của một giải để tạo bảo hiểm thủ công** để chủ động bổ sung volume khi cần (vd cuối kỳ).
- As a **5BIB Back-Office Admin**, tôi muốn **xem danh sách đơn đã tạo + trạng thái (Chờ/Thành công/Thất bại) + số hợp đồng GIC + link chứng nhận**, và **retry đơn lỗi**, để theo dõi và xử lý.
- As a **5BIB Tech Lead (Danny)**, tôi muốn **kill-switch tắt toàn bộ việc gửi đơn** để dev/test an toàn, không vô tình phát sinh policy thật + tốn phí.

### Business Rules

**Mục đích & vận hành**
- **BR-IGL-01** — Đơn tạo ra là hợp đồng bảo hiểm GIC **thật trên production**; 5Solution chịu phí. KHÔNG thu phí VĐV, KHÔNG hiển thị cho VĐV (Phase 1).
- **BR-IGL-02** — Cron daily auto chạy **1 lần/ngày lúc `IGLOO_CRON_HOUR` giờ (VN, mặc định 9h)**, đẩy đúng **`IGLOO_DAILY_COUNT` (mặc định 10 — Danny chốt)** đơn khi đủ VĐV eligible. Cần thêm → admin tạo thủ công.
- **BR-IGL-03 (KILL-SWITCH 2 LỚP)** —
  - `IGLOO_DAILY_ENABLED` (mặc định `false`): `false` → cron daily auto KHÔNG chọn/tạo (chỉ log skip).
  - `IGLOO_SUBMIT_ENABLED` (mặc định `false`): `false` → submit-worker KHÔNG POST sang Igloo (đơn nằm yên ở trạng thái nội bộ `QUEUED`). Áp dụng cho **cả cron lẫn manual**.
  - Production phải bật **cả hai**. Dev để cả hai `false` → tuyệt đối không có egress.

**Tuyển chọn VĐV (eligibility)**
- **BR-IGL-04** — VĐV **eligible** khi đủ TẤT CẢ: `full_name` không rỗng · `dob` không null · `gender ∈ {MALE,FEMALE}` (OTHER/null → loại) · `id_number` match `^[0-9]{9,12}$` · `contact_phone` sau normalize match `^0[0-9]{9}$` · `email` hợp lệ · thuộc giải có `event_start_date >= hôm nay` (VN).
- **BR-IGL-05** — "Phát sinh trong ngày" = `athletes.created_on` (DATE theo VN) = hôm nay. Cron **ưu tiên** nhóm này; nếu < `IGLOO_DAILY_COUNT` → **bù random** từ kho eligible còn lại (BR-IGL-04) cho đủ. Nếu kho cũng < count (hiếm) → đẩy hết có được + log cảnh báo (KHÔNG báo động Phase 1, xem PAUSE-85-06).
- **BR-IGL-17** — `gender` normalize: `MALE`→`MALE`, `FEMALE`→`FEMALE`, mọi giá trị khác/null → **loại** (Igloo chỉ nhận MALE/FEMALE).
- **BR-IGL-18** — `contact_phone` normalize: bỏ space/dash/dấu chấm; `+84`/`84` đầu → `0`; phải match `^0[0-9]{9}$` sau normalize, else **loại**.
- **BR-IGL-08b** — `id_number` nhận **9 (CMND cũ) hoặc 12 (CCCD) chữ số**. Passport (có chữ) → loại Phase 1 (PAUSE-85-08).

**Chống trùng & idempotency**
- **BR-IGL-06** — `partnerRefId = "igloo:<athletes_id>:<mysql_race_id>"`. **1 VĐV / 1 giải = đúng 1 đơn.** Trước khi tạo row, check Mongo: nếu đã tồn tại request với `partnerRefId` này ở trạng thái KHÁC `FAILED`/`CANCELLED` → **skip** (đã có/đang có đơn). Mongo unique index trên `partnerRefId` là chốt chặn cuối (race-safe).
- **BR-IGL-06b** — Cron pool **loại** VĐV đã có request `SUCCESS`/`PENDING`/`PROCESSING`/`GET_CERTI_PROCESSING`/`QUEUED` cho cùng `(athletesId, raceId)`.

**Payload bảo hiểm**
- **BR-IGL-07 (Coverage — Danny chốt)** — `coverage.from = event_start_date` (giải của VĐV), `coverage.to = from` (**1 ngày**), `totalDays = 1`. Format `YYYY-MM-DD`. Chỉ tạo khi `from >= hôm nay` (BR-IGL-04). (KHÔNG dùng event_end_date cho coverage — phí cố định 10k.)
- **BR-IGL-08 (packageCode + phí — Danny chốt)** — **`packageCode = ROAD` LUÔN** (rẻ nhất, 10k/người/ngày), KHÔNG suy từ race_type. Phí **cố định**: `premium = premiumVat = totalPayment = 10000` (10k/đơn, không nhân ngày). race_type chỉ dùng tham khảo hiển thị, KHÔNG đổi gói.
- **BR-IGL-09 (Mapping)** — `insured.name = athletes.name`; `insured.dateOfBirth = athletes.dob (YYYY-MM-DD)`; `insured.gender = subinfo.gender`; `insured.idCard = subinfo.id_number`; `insured.email = athletes.email`; `insured.phone = normalize(subinfo.contact_phone)`; `insured.address =` ghép non-null `[races.location, races.district, races.province]` join `', '` (fallback `races.province` hoặc `"Việt Nam"` nếu tất cả null). `requester = insured` với `relationCode = "INSURED"`. `tournament.name = races.title`, `tournament.bibNumber = athletes.bib_number`, `tournament.distance = race_course.distance` (qua subinfo.order_line_item→ticket_type→race_course, fallback code→race_course).

**Vòng đời đơn (local state machine)**
- **BR-IGL-10** — Trạng thái nội bộ: `QUEUED` (đã tạo row local, chưa gửi) → `submit-worker POST` → nếu 202: lưu `iglooRequestId` + status `PENDING` → `poll-worker GET` cập nhật theo Igloo (`PROCESSING`/`GET_CERTI_PROCESSING`/`SUCCESS`/`FAILED`/`CANCELLED`). `SUCCESS` → lưu `gicContractNo` + `certificateUrl`. POST lỗi (4xx/5xx/timeout) → status `FAILED` + `errorMessage`.
- **BR-IGL-11 (Retry)** — Đơn `FAILED` retry thủ công (admin) → reset về `QUEUED` (giữ `partnerRefId`), `retryCount += 1`, **max 3** (≥3 → nút retry disabled). Nếu đã có `iglooRequestId` (fail ở bước lấy certificate), retry gọi lại poll thay vì tạo mới (tránh tạo trùng GIC).
- **BR-IGL-13 (Concurrency)** — `daily-select` + `submit-worker` + `poll-worker` mỗi cron có Redis SETNX lock chống chồng tick. Tạo đơn race-safe nhờ unique `partnerRefId`.

**Thủ công**
- **BR-IGL-12 (Manual)** — Admin chọn N VĐV eligible từ 1 giải → tạo N row `QUEUED` (`source='manual'`, `createdByActor=<adminId>`). Hiển thị **preview tổng phí** trước khi xác nhận. Áp dụng idempotency BR-IGL-06 (VĐV đã có đơn → skip + báo trong kết quả). Submit thực tế vẫn qua submit-worker (gated `IGLOO_SUBMIT_ENABLED`).

**PII & bảo mật**
- **BR-IGL-14 (PII — Danny chốt KHÔNG mask)** — Mongo lưu `insuredIdCard` **đầy đủ** (không mask); DTO trả `idCard`/`phone`/`dateOfBirth` đầy đủ. Hygiene nội bộ: app log dùng `athletesId` thay vì spam CCCD vào log (không bắt buộc, chỉ là good practice — KHÔNG mask hiển thị/lưu).
- **BR-IGL-16 (Authz + Audit)** — Mọi endpoint admin `@UseGuards(LogtoAdminGuard)`. Mỗi lần tạo đơn (cron/manual) ghi audit log: `actor` (admin id hoặc `'cron'`), `athletesId`, `mysqlRaceId`, `packageCode`, `totalPayment`, `partnerRefId`.
- **BR-IGL-19 (Dev safety)** — Khi `IGLOO_SUBMIT_ENABLED=false` (dev), KHÔNG có request nào rời backend. Tạo đơn thật trên production chỉ khi Danny explicit bật flag.

**Hiển thị (Display Convention)**
- **BR-IGL-15** — Mọi enum render UI map dictionary VN qua `admin/src/lib/insurance-labels.ts`: status (`QUEUED`→"Chờ gửi", `PENDING`→"Đang xử lý", `PROCESSING`→"Đang xử lý (GIC)", `GET_CERTI_PROCESSING`→"Đang lấy chứng nhận", `SUCCESS`→"Thành công", `FAILED`→"Thất bại", `CANCELLED`→"Đã huỷ"), `packageCode` (`ROAD`→"Đường trường (Road)", `TRAIL`→"Địa hình (Trail)"), `relationCode` (`INSURED`→"Chính chủ"). KHÔNG render raw enum trong JSX text.

---

## 🖥️ UI/UX Flow

### 2.1 Route structure
- `GET /(dashboard)/insurance` — trang quản lý bảo hiểm Igloo. **Access: admin** (Logto admin; ẩn khỏi sidebar nếu không phải admin). 2 tab nội bộ: **"Tạo bảo hiểm"** + **"Đơn đã tạo"**.

### 2.2 Layout per screen

**Tab "Tạo bảo hiểm"**
- **Header:** tiêu đề "Tạo bảo hiểm Igloo" + Badge trạng thái hệ thống ("Chế độ gửi: BẬT/TẮT" đọc từ `IGLOO_SUBMIT_ENABLED` qua endpoint config) + nút tab.
- **Body:**
  - Dropdown **"Chọn giải"** (giải sắp diễn ra, hiển thị `title — dd/MM/yyyy — gói ROAD/TRAIL`).
  - Ô **search** "Tìm theo tên / BIB / CCCD".
  - **Bảng VĐV eligible**: cột `[checkbox] | Họ tên | BIB | Giới tính | Năm sinh | CCCD (mask) | SĐT (mask) | Email | Trạng thái` (Trạng thái = "Chưa có đơn" / "Đã có đơn" — đã có thì checkbox disabled).
  - Checkbox header "chọn tất cả (trang hiện tại)".
- **Footer (sticky):** "Đã chọn **N** VĐV — Tổng phí dự kiến: **X đ**" + nút **"Tạo bảo hiểm (N)"** (disabled khi N=0).

**Tab "Đơn đã tạo"**
- **Header:** tiêu đề "Đơn bảo hiểm đã tạo" + filter `Trạng thái` (dropdown VN) + filter `Giải` + nút "Làm mới".
- **Body — Bảng đơn:** cột `Họ tên | Giải | Gói | Phí | Trạng thái (badge VN) | Số HĐ GIC | Chứng nhận | Nguồn | Ngày tạo | Hành động`.
  - `Chứng nhận`: link "Xem PDF" (mở `certificateUrl`) khi SUCCESS, else "—".
  - `Nguồn`: "Tự động" (cron) / "Thủ công".
  - `Hành động`: nút "Thử lại" (chỉ hiện khi status=FAILED và retryCount<3).
- **Footer:** pagination (20/trang).

### 2.3 UI Step-by-Step (Tab "Tạo bảo hiểm")

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Vào `/insurance` | Tab "Tạo bảo hiểm" active, dropdown giải load (loading skeleton) | `useUpcomingRaces()` | Dropdown ready |
| 2 | Chọn giải trong dropdown | Bảng VĐV eligible load (skeleton) cho `raceId`, gói ROAD/TRAIL hiện badge | `useEligibleAthletes(raceId)` | Danh sách VĐV |
| 3 | Gõ vào ô search | Debounce 300ms → query lại theo `q` | `useEligibleAthletes(raceId,q)` | Danh sách lọc |
| 4 | Tick checkbox vài VĐV (chỉ "Chưa có đơn") | Footer cập nhật "Đã chọn N — Tổng phí X đ" (tính client từ gói × số ngày) | onChange state | state.selected = [...] |
| 5 | Click "Tạo bảo hiểm (N)" | Mở **confirm modal**: liệt kê N VĐV + gói + phí từng đơn + tổng + cảnh báo "Tạo đơn thật, 5Solution chịu phí" | onClick | Modal open |
| 6 | Click "Xác nhận" trong modal | Button loading "Đang tạo..."; POST batch | `useCreateRequests()` | Submitting |
| 7 | Nhận response | Toast: "Đã tạo N đơn (M bỏ qua vì đã có đơn)"; chuyển tab "Đơn đã tạo" filter giải vừa chọn | onSuccess invalidate | Success |
| 8 | Nếu lỗi mạng/500 | Toast đỏ "Tạo đơn thất bại — thử lại"; modal giữ nguyên selection | onError | Error |

### 2.4 Buttons Specification

| Button | Vị trí | Default | Disabled | Loading | Action | Confirm? |
|--------|--------|---------|----------|---------|--------|----------|
| "Tạo bảo hiểm (N)" | Footer sticky tab 1 | Primary | khi N=0 | "Đang tạo..." spinner | mở confirm modal | YES (modal preview phí) |
| "Xác nhận" (modal) | Modal footer | Primary đỏ-cam (cảnh báo tiền) | khi đang submit | spinner | POST `/api/igloo-insurance/requests` | — |
| "Thử lại" | Row tab 2 | Ghost | khi status≠FAILED hoặc retryCount≥3 | spinner | POST `/api/igloo-insurance/requests/:id/retry` | YES — "Gửi lại đơn cho {tên}?" |
| "Xem PDF" | Row tab 2 | Link | khi không có certificateUrl | — | mở `certificateUrl` tab mới | NO |
| "Làm mới" | Header tab 2 | Outline | — | spinner | refetch list | NO |

### 2.5 Form / Filter Fields

| Field | UI label | Type | Required | Validation | Error | Default |
|-------|----------|------|----------|-----------|-------|---------|
| `raceId` | Chọn giải | select | ✅ (tab tạo) | phải thuộc list giải upcoming | "Chọn giải trước" | none |
| `q` | Tìm VĐV | text | ⚪ | max 64, trim | — | "" |
| `selected[]` | (checkbox) | array | ✅ ≥1 khi submit | mỗi phần tử là athletesId eligible | "Chọn ít nhất 1 VĐV" | [] |
| `status` (filter) | Trạng thái | select | ⚪ | enum status hợp lệ | — | "Tất cả" |

### 2.6 Field source

| Field UI | Data source | Format | Empty |
|----------|-------------|--------|-------|
| Họ tên | `athletes.name` (MySQL) | text | "—" |
| BIB | `athletes.bib_number` | mono | "—" |
| Giới tính | `subinfo.gender` → "Nam"/"Nữ" | VN | "—" |
| Năm sinh | `YEAR(athletes.dob)` (chỉ năm, không lộ full DOB ở list) | số | "—" |
| CCCD (mask) | `subinfo.id_number` → `0921****4349` | mono mask | "—" |
| SĐT (mask) | normalize(`subinfo.contact_phone`) → `0901***567` | mono mask | "—" |
| Phí | computed `rate(packageCode) × totalDays` | VND vi-VN | "0 đ" |
| Trạng thái đơn | `igloo_insurance_requests.status` → VN label | badge | — |
| Số HĐ GIC | `gicContractNo` | mono | "—" |

### 2.7 UI States (bắt buộc đủ)
- **Loading:** skeleton 5 dòng cho bảng VĐV / bảng đơn.
- **Empty (tab tạo):** chưa chọn giải → "Chọn một giải để xem VĐV". Giải không có VĐV eligible → "Giải này chưa có VĐV đủ điều kiện".
- **Empty (tab đơn):** "Chưa có đơn nào" + gợi ý sang tab tạo.
- **Filtered empty:** "Không có VĐV/đơn khớp bộ lọc" + nút xoá lọc.
- **Error fetch:** toast đỏ + nút thử lại.
- **Submitting:** modal button loading, disable.
- **Success:** toast xanh + chuyển tab.
- **Validation:** "Chọn ít nhất 1 VĐV" / "Chọn giải".
- **Confirm dialog:** modal preview phí (destructive-aware vì tốn tiền thật).
- **Submit-disabled banner:** nếu `IGLOO_SUBMIT_ENABLED=false` → banner vàng "Chế độ gửi đang TẮT — đơn sẽ ở trạng thái Chờ gửi, chưa gửi sang Igloo".

---

## 🛠️ Technical Mandates

### 3.1 DB / Cache changes

**MongoDB — collection MỚI `igloo_insurance_requests`:**
| Field | Type | Note |
|-------|------|------|
| `partnerRefId` | string | **unique index** — `igloo:<athletesId>:<mysqlRaceId>` |
| `iglooRequestId` | string \| null | từ 202 response |
| `status` | enum | `QUEUED\|PENDING\|PROCESSING\|GET_CERTI_PROCESSING\|SUCCESS\|FAILED\|CANCELLED` — index |
| `source` | enum | `cron\|manual` |
| `createdByActor` | string \| null | admin id (manual) hoặc `'cron'` |
| `athletesId` | number | index |
| `mysqlRaceId` | number | index |
| `raceTitle` | string | snapshot |
| `bib` | string \| null | |
| `insuredName` | string | |
| `insuredIdCardMasked` | string | mask 4 số cuối — KHÔNG lưu CCCD thô (BR-IGL-14) |
| `packageCode` | enum | `ROAD\|TRAIL` |
| `coverageFrom` / `coverageTo` | Date | |
| `totalDays` | number | |
| `premium` / `premiumVat` / `totalPayment` | number | |
| `gicContractNo` | string \| null | |
| `certificateUrl` | string \| null | |
| `errorMessage` | string \| null | |
| `retryCount` | number | default 0, max 3 |
| `lastPolledAt` | Date \| null | |
| `createdAt` / `updatedAt` | Date | timestamps |

Index: unique `{partnerRefId}` · `{status}` · `{mysqlRaceId}` · `{athletesId}` · `{status, lastPolledAt}` (poll-worker query). **KHÔNG migration** (collection mới, additive).

**MySQL platform (readonly conn `'platform'`):** ✏️ thêm cột `created_on: Date` (DATE/datetime) vào `AthleteReadonly` entity (cột đã tồn tại trên `5bib_platform_live.athletes`). **PAUSE-Coder:** verify SELECT grant cho `created_on` trên `5bib_readonly_user`. KHÔNG migration (readonly).

**Redis:** `igloo:daily-lock:<YYYY-MM-DD>` (SETNX, TTL 23h) · `igloo:submit-lock` (SETNX, TTL 110s) · `igloo:poll-lock` (SETNX, TTL 110s). Prefix mới, không xung đột.

**ENV (thêm `IGLOO_SUBMIT_ENABLED`):** `IGLOO_BASE_URL`, `IGLOO_API_KEY`, `IGLOO_DAILY_COUNT=7`, `IGLOO_CRON_HOUR=9`, `IGLOO_DAILY_ENABLED=false`, **`IGLOO_SUBMIT_ENABLED=false`** (BA bổ sung). Config validation trong `src/config/index.ts`.

### 3.2 Backend Endpoint Specification (admin, `LogtoAdminGuard`)

| Method | Path | Mục đích | Request | Response | Status |
|--------|------|----------|---------|----------|--------|
| GET | `/api/igloo-insurance/config` | Trạng thái flag (dailyEnabled/submitEnabled) cho banner | — | `IglooConfigDto` | 200/401/403 |
| GET | `/api/igloo-insurance/races` | Giải sắp diễn ra (dropdown) | — | `IglooRaceDto[]` | 200/401/403 |
| GET | `/api/igloo-insurance/eligible-athletes` | VĐV eligible theo giải (paginated, PII masked) | query `raceId*,q?,page?,limit?` | `Paginated<EligibleAthleteDto>` | 200/400/401/403 |
| POST | `/api/igloo-insurance/requests` | Tạo batch đơn (manual) | `CreateIglooRequestsDto` | `CreateIglooRequestsResultDto` | 201/400/401/403 |
| GET | `/api/igloo-insurance/requests` | Danh sách đơn (paginated) | query `status?,raceId?,page?,limit?` | `Paginated<IglooRequestDto>` | 200/401/403 |
| GET | `/api/igloo-insurance/requests/:id` | Chi tiết 1 đơn | param `id` | `IglooRequestDto` | 200/401/403/404 |
| POST | `/api/igloo-insurance/requests/:id/retry` | Retry đơn FAILED | param `id` | `IglooRequestDto` | 200/400(not failed/max retry)/401/403/404 |

**Side effects:** POST `/requests` → ghi N row `QUEUED` (idempotent BR-IGL-06) + audit log. Retry → reset FAILED→QUEUED + retryCount++. Tất cả mutation invalidate cache list FE (TanStack Query).

**Internal (KHÔNG expose qua HTTP):**
- `IglooDailyCron` (`@Cron` `IGLOO_CRON_HOUR`): gated `IGLOO_DAILY_ENABLED` + SETNX `igloo:daily-lock` → chọn ≤`IGLOO_DAILY_COUNT` VĐV (ưu tiên created_on hôm nay + bù kho) → ghi row QUEUED.
- `IglooSubmitWorkerCron` (`@Cron` mỗi 1 phút): gated `IGLOO_SUBMIT_ENABLED` + SETNX `igloo:submit-lock` → lấy ≤20 row QUEUED → POST Igloo → PENDING(+iglooRequestId) / FAILED(+errorMessage).
- `IglooPollWorkerCron` (`@Cron` mỗi 2 phút): SETNX `igloo:poll-lock` → lấy row non-terminal có iglooRequestId, `lastPolledAt` cũ → GET status → cập nhật.

### 3.3 DTO Field-Level Spec

```typescript
// Tạo batch (manual)
class CreateIglooRequestsDto {
  @ApiProperty({ description: 'mysql_race_id của giải', example: 220 })
  @IsInt() @Min(1)
  raceId!: number;

  @ApiProperty({ description: 'Danh sách athletes_id chọn tạo đơn', type: [Number], example: [101, 102] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50)
  @IsInt({ each: true })
  athleteIds!: number[];
}

class CreateIglooRequestsResultDto {
  @ApiProperty({ description: 'Số đơn tạo mới (QUEUED)' }) created!: number;
  @ApiProperty({ description: 'Bỏ qua + lý do', type: [Object], example: [{ athletesId: 102, reason: 'ALREADY_HAS_ORDER' }] })
  skipped!: Array<{ athletesId: number; reason: 'ALREADY_HAS_ORDER' | 'NOT_ELIGIBLE' }>;
  @ApiProperty({ description: 'Tổng phí dự kiến (VNĐ)' }) totalPremium!: number;
}

class EligibleAthleteDto {
  @ApiProperty() athletesId!: number;
  @ApiProperty() fullName!: string;
  @ApiProperty({ nullable: true }) bib!: string | null;
  @ApiProperty({ enum: ['Nam', 'Nữ'] }) gender!: string;   // VN label
  @ApiProperty({ description: 'Năm sinh (chỉ năm, không lộ full DOB)' }) birthYear!: number;
  @ApiProperty({ description: 'CCCD đã mask', example: '0921****4349' }) idCardMasked!: string;
  @ApiProperty({ description: 'SĐT đã mask', example: '0901***567' }) phoneMasked!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ description: 'Đã có đơn cho giải này?' }) hasOrder!: boolean;
}

class IglooRequestDto {
  @ApiProperty() id!: string;                 // = _id.toString() (KHÔNG leak _id raw)
  @ApiProperty({ enum: ['QUEUED','PENDING','PROCESSING','GET_CERTI_PROCESSING','SUCCESS','FAILED','CANCELLED'] }) status!: string;
  @ApiProperty({ enum: ['ROAD','TRAIL'] }) packageCode!: string;
  @ApiProperty() insuredName!: string;
  @ApiProperty({ nullable: true }) bib!: string | null;
  @ApiProperty() raceTitle!: string;
  @ApiProperty() totalPayment!: number;
  @ApiProperty({ enum: ['cron','manual'] }) source!: string;
  @ApiProperty({ nullable: true }) gicContractNo!: string | null;
  @ApiProperty({ nullable: true }) certificateUrl!: string | null;
  @ApiProperty({ nullable: true }) errorMessage!: string | null;
  @ApiProperty() retryCount!: number;
  @ApiProperty() createdAt!: string;
}
```

> ⚠️ Response DTO **KHÔNG leak**: `insuredIdCardMasked` chỉ trả masked, KHÔNG bao giờ trả CCCD thô; `_id` raw, `__v`, `partnerRefId` (internal). `EligibleAthleteDto` chỉ mask CCCD/phone + birthYear (không full DOB) ở list.

### 3.4 Frontend / Admin (Next.js 16)

- **Page:** `admin/src/app/(dashboard)/insurance/page.tsx` — Server Component shell, Client Component cho tabs + tương tác.
- **Components (Client):** `InsuranceCreateTab.tsx` (dropdown + table + footer + confirm modal), `InsuranceOrdersTab.tsx` (filter + table + retry), `insurance-labels.ts` (dictionary VN — BR-IGL-15).
- **Data:** hand-typed `admin/src/lib/insurance-api.ts` + `insurance-hooks.ts` (TanStack Query) theo precedent `landing-api.ts`/`course-data-ops-api.ts` (TD-F083-SDK-REGEN — backend chưa live lúc code). **Sau khi backend live: chạy `pnpm --filter admin generate:api`** rồi swap sang generated SDK (tracking TD).
- **Mutation invalidation:** sau create/retry → `queryClient.invalidateQueries(['igloo','requests'])` + `['igloo','eligible',raceId]`.
- **Sidebar:** thêm mục "Bảo hiểm Igloo" trong `nav-groups`, gate `requireRole: admin`.
- **Dropdown/Select:** Base UI `Select.Value` render prop map VN label (gói ROAD/TRAIL, status). Modal preview dùng `sm:max-w-md`.

### 3.5 PAUSE flags
- 🛑 **PAUSE-Coder-01** — Verify SELECT grant `created_on` trên `5bib_readonly_user` trước khi map (nếu thiếu grant → query fail). Test bằng `SHOW COLUMNS`/`SELECT created_on LIMIT 1`.
- 🛑 **PAUSE-Coder-02** — KHÔNG `pnpm install` dep mới (axios/@nestjs/schedule/@nestjs-modules/ioredis đã có). Nếu phát sinh cần dep → dừng hỏi Manager.
- 🛑 **PAUSE-Coder-03** — KHÔNG bật `IGLOO_SUBMIT_ENABLED`/`IGLOO_DAILY_ENABLED` khi dev/test. KHÔNG POST tạo đơn thật lên production trừ khi Danny duyệt. Test submit-worker bằng mock HTTP hoặc nock.
- 🛑 **PAUSE-Coder-04** — Thêm endpoint mới → sau khi backend live chạy `pnpm --filter admin generate:api` (tracking TD nếu defer).
- 🛑 **Danny duyệt** — confirm PAUSE-85-01..08 (cuối file) trước khi golive production.

---

## 🛡️ Testing Mandates

### 4.1 Backend Unit Test (Coder bắt buộc — `igloo-insurance.service.spec.ts` + helpers)

Bắt buộc tách **pure helpers** để test không cần DB:
- `normalizePhone()` · `maskIdCard()` · `derivePackageCode(raceType)` · `computeCoverage(from,to)` · `computePremium(packageCode,totalDays)` · `isEligible(athleteRow)` · `buildPartnerRefId(athletesId,raceId)` · `buildIglooPayload(athlete,race)`.

| TC | Mục tiêu | Input | Expected |
|----|----------|-------|----------|
| TC-01 | normalizePhone | `'+84 901 234 567'`, `'0901234567'`, `'84901234567'`, `'12-3'` | `'0901234567'`×3, `null` (loại) |
| TC-02 | maskIdCard | `'092124584349'` | `'0921****4349'` (KHÔNG lộ giữa) |
| TC-03 | derivePackageCode | `'TRAIL_RACE'`,`'ULTRA_RAIL_RACE'`,`'ROAD_MARATHON'`,`'UNKNOWN'`,`null` | `TRAIL,TRAIL,ROAD,ROAD,ROAD` |
| TC-04 | computeCoverage | from `2026-07-10` to `2026-07-12` | `{from,to,totalDays:3}` |
| TC-04b | computeCoverage null end | from `2026-07-10` to `null` | `{from,to:from,totalDays:1}` |
| TC-05 | computePremium | ROAD×3 / TRAIL×3 | `30000` / `45000` |
| TC-06 | isEligible loại | gender `OTHER` / dob null / id_number `'12A'` / phone fail / event_start hôm qua | `false` mỗi case |
| TC-07 | isEligible happy | đủ field + giải upcoming | `true` |
| TC-08 | buildPartnerRefId | `(101, 220)` | `'igloo:101:220'` |
| TC-09 | buildIglooPayload | athlete+race fixture | payload đúng shape: insured/coverage/requester(INSURED)/tournament, address ghép non-null, dob `YYYY-MM-DD` |
| TC-10 | idempotency skip | athlete đã có request SUCCESS cùng (id,race) | service trả `skipped: ALREADY_HAS_ORDER`, KHÔNG ghi row mới |
| TC-11 | top-up | created_on hôm nay = 3, count=7 | chọn 3 + bù 4 từ kho = 7 (mock repo) |
| TC-12 | kill-switch | `IGLOO_DAILY_ENABLED=false` | daily cron return sớm, 0 row |
| TC-13 | submit-worker gated | `IGLOO_SUBMIT_ENABLED=false` | worker không gọi HTTP (mock spy 0 calls) |
| TC-14 | retry guard | request status≠FAILED hoặc retryCount=3 | throw BadRequest |

### 4.2 Backend E2E (QC — `igloo-insurance.e2e-spec.ts`, mock Igloo HTTP qua nock)

| TC | Mục tiêu | Method/URL | Body/Headers | Expected |
|----|----------|-----------|--------------|----------|
| E2E-01 | Auth missing | GET `/api/igloo-insurance/requests` | no token | 401 |
| E2E-02 | Non-admin | GET `/api/igloo-insurance/requests` | non-admin token | 403 |
| E2E-03 | List eligible | GET `/eligible-athletes?raceId=220` | admin | 200, items có idCard masked, KHÔNG có CCCD thô |
| E2E-04 | Create batch happy | POST `/requests` `{raceId:220,athleteIds:[101]}` | admin | 201, `created:1`, Mongo có row QUEUED partnerRefId `igloo:101:220` |
| E2E-05 | Create dup | POST lại cùng athlete | admin | 201, `created:0, skipped:[ALREADY_HAS_ORDER]` |
| E2E-06 | Validation | POST `{raceId:220,athleteIds:[]}` | admin | 400 |
| E2E-07 | Submit-worker (mock 202) | trigger worker với SUBMIT_ENABLED | nock 202 `{requestId}` | row → PENDING + iglooRequestId |
| E2E-08 | Poll SUCCESS | trigger poll, nock GET SUCCESS | nock `{status:SUCCESS,contractNo,certificateUrl}` | row → SUCCESS + fields lưu |
| E2E-09 | Retry FAILED | POST `/requests/:id/retry` row FAILED | admin | 200, status QUEUED, retryCount+1 |
| E2E-10 | Concurrent create | 10× POST cùng athlete (Promise.all) | admin | đúng 1 row tạo (unique partnerRefId), 9 skip |
| E2E-11 | PII leak guard | GET `/requests/:id` | admin | response KHÔNG chứa CCCD thô / `_id` raw / `partnerRefId` |

### 4.3 Frontend E2E (Playwright)
| TC | Persona | Journey | Expected |
|----|---------|---------|----------|
| FE-01 | Admin | Chọn giải → tick 2 VĐV → tạo | confirm modal show phí, sau xác nhận toast "Đã tạo 2 đơn" |
| FE-02 | Admin | Tab đơn → filter FAILED → retry | toast "Đã gửi lại" |
| FE-03 | Admin | SUBMIT_ENABLED=false | banner vàng "Chế độ gửi đang TẮT" |
| FE-04 | Admin | Giải không VĐV eligible | empty state đúng |

### 4.4 Security
- [ ] Tất cả endpoint `LogtoAdminGuard` → 401 unauth, 403 non-admin.
- [ ] Response KHÔNG leak CCCD thô / `_id` raw / `__v` / `partnerRefId`.
- [ ] List eligible mask CCCD + phone, chỉ birthYear (không full DOB).
- [ ] Log KHÔNG in CCCD/DOB thô (grep `id_number`/`dob` trong logger calls = 0).
- [ ] SQL legacy parameterized (`?` placeholder), KHÔNG string interpolation `q` từ user.

### 4.5 Performance SLA
- GET `/eligible-athletes` (join 3 bảng + paginate 20): **p95 < 800ms**.
- POST `/requests` batch ≤20 (chỉ ghi QUEUED, KHÔNG gọi Igloo đồng bộ): **p95 < 500ms**.
- Submit-worker: ≤20 đơn/tick, rate-limit thân thiện (tuần tự hoặc pool ≤5).
- 10× concurrent create stability test (TC E2E-10) PASS.

---

## 📌 PAUSE Conditions — cần Danny chốt (BA đề xuất default sẵn)

| # | Câu hỏi | Đề xuất default |
|---|---------|-----------------|
| **PAUSE-85-01** 🔴 BUSINESS | Igloo bill phí kiểu gì (prepaid/deposit vs invoice cuối kỳ)? Có cần **trần ngân sách/ngày** để cron tự dừng khi vượt không? | Phase 1: KHÔNG trần, chỉ log tổng phí/ngày; chờ Danny xác nhận cơ chế bill với Igloo |
| **PAUSE-85-02** | `premiumVat` tính sao? (ví dụ API `premium==premiumVat`) | `premiumVat = premium` cho tới khi Igloo xác nhận công thức VAT |
| **PAUSE-85-03** | Lưu CCCD trong Mongo đơn: mask (4 số cuối) hay đủ `select:false`? | **Mask** (an toàn PII nhất); CCCD thật chỉ lấy on-the-fly khi gửi |
| **PAUSE-85-04** | Coverage `from` được phép = hôm nay không, hay phải ≥ ngày mai? | `from >= hôm nay`; nếu Igloo/GIC từ chối same-day → đổi `>= ngày mai` |
| **PAUSE-85-05** | CCCD 9 số (CMND cũ) GIC có chấp nhận? | Nhận cả 9 và 12 số; cần Danny confirm với GIC |
| **PAUSE-85-06** | Khi cron <7 eligible hoặc Igloo lỗi → báo động qua đâu? | Phase 1 chỉ log; không alert (thêm Telegram sau nếu cần) |
| **PAUSE-85-07** | Có cần cờ consent/loại trừ VĐV (NĐ13/2023)? | Phase 1 không thu consent, chỉ loại VĐV thiếu KYC; rủi ro Danny đã chấp nhận |
| **PAUSE-85-08** | VĐV nước ngoài (passport, không CCCD VN) → loại hay đẩy? | Loại Phase 1 (chỉ nhận id_number 9–12 chữ số) |

---

## ✅ Status

- [x] **READY** — sẵn sàng cho Manager `/5bib-plan`.
- ⏳ Lưu ý: `IGLOO_API_KEY` đã có + verified. 8 PAUSE trên không block code (BA đã set default); Danny confirm trước khi bật flag production.

## 🔗 Next step
Danny chạy: `/5bib-plan FEATURE-085-igloo-insurance-auto-order`
