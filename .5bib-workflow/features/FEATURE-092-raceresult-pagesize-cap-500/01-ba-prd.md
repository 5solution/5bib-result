# FEATURE-092: PRD — Nâng trần pageSize race-results 100→500

**Status:** 🔵 READY
**Last updated:** 2026-06-27
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` (impact map verify tận code + 4 PAUSE)
- [x] Đã đọc `memory/codebase-map.md` — module `race-result`
- [x] Đã đọc `memory/known-issues.md` — TD-F062 (in-memory sort+limit acceptable), TD-F038-PAGE-CLAMP (pagination edge), không có issue chặn
- [x] Trần = 500 đã được Danny chốt; 3 PAUSE còn lại trả lời ở section cuối

---

## 📝 Nâng trần pageSize endpoint race-results 100 → 500

**Goal:** Cho phép tính năng **Danh sách riêng tư** (`privateListLimit` tối đa 500) hiển thị đúng số VĐV operator cấu hình trên trang ranking công khai, thay vì trả về danh sách trống do backend chặn `pageSize` ở 100.

**Scope:**
- ✅ In scope:
  - Nâng trần `pageSize` của `GET /api/race-results` từ 100 → **500** ở **cả 2 lớp backend** (DTO validation + service clamp).
  - Cập nhật `@ApiPropertyOptional` (`maximum` + `description`) → regen SDK.
  - Thêm **clamp phòng thủ** ở frontend ranking page để `pageSize` luôn nằm trong `[1, 500]`, kể cả khi `privateListLimit` = 0/null/>500.
- ❌ Out of scope:
  - KHÔNG nâng selector "Hiển thị" (10/25/50/100) ở chế độ ranking thường — giữ nguyên max 100 (xem PAUSE-92-01).
  - KHÔNG virtualize bảng 500 dòng (xem PAUSE-92-02, ghi tech debt).
  - KHÔNG đụng form admin `PublishingSection` (form đã đúng: `min 1`, `max 500`).
  - KHÔNG đụng logic lọc trùng rank, sort, cache key, filter — chỉ đổi con số trần.

---

## 👤 User Stories & Business Rules

### User Stories

- As a **Race Organizer (merchant)**, I want trang ranking công khai hiển thị đủ tới 500 VĐV khi tôi bật "Danh sách riêng tư" với giới hạn >100, so that danh sách không bị trống trơn.
- As an **Anonymous Visitor**, I want xem được danh sách VĐV (tới mức operator cho phép) ở chế độ danh sách riêng tư, so that tôi vẫn tra cứu được kết quả mà không bị màn hình trống.
- As a **5BIB Back-Office Admin**, I want set `privateListLimit` bất kỳ trong [1..500] và biết chắc trang công khai render đúng, so that cấu hình admin và hành vi public không lệch nhau.

### Business Rules

- **BR-01:** Trần tối đa của `pageSize` (endpoint `GET /api/race-results`) = **500** (đổi từ 100). Đây là **con số duy nhất** thay đổi.
- **BR-02:** Trần phải được enforce **đồng bộ ở CẢ HAI lớp backend**:
  - **Lớp validation (DTO):** `@Max(500)` + `@ApiPropertyOptional({ maximum: 500, description: 'Page size (max 500)' })`. `pageSize > 500` → **400 Bad Request** với message `"pageSize must not be greater than 500"`.
  - **Lớp service (clamp):** `Math.min(dto.pageSize ?? 10, 500)`. (Nếu chỉ sửa DTO mà quên service → service vẫn cắt còn 100 → fix KHÔNG trọn.)
- **BR-03:** `pageSize` hợp lệ trong `[1, 500]`. `pageSize < 1` (gồm 0) → **400** `"pageSize must not be less than 1"` (giữ nguyên `@Min(1)`). Default vẫn = `10` khi không truyền.
- **BR-04:** **Backward-compatible tuyệt đối** — mọi request `pageSize ≤ 100` (overview top-3, admin athletes, ranking selector ≤100) hành vi KHÔNG đổi. Nâng trần chỉ NỚI thêm khoảng [101..500].
- **BR-05:** Frontend ranking page (chế độ private, không search) phải **clamp** `effectivePageSize = Math.min(500, Math.max(1, privateListLimit || 20))` → KHÔNG bao giờ gửi `pageSize` ngoài `[1,500]`, kể cả `privateListLimit` = 0/null/undefined/>500. (`|| 20` thay `?? 20` để bắt cả số 0.)
- **BR-06:** Phân trang bình thường KHÔNG bị ảnh hưởng: với `pageSize ≤ 100`, `pageNo > 1`, `total`, `totalPages` vẫn tính đúng như trước.
- **BR-07:** Không thay đổi response shape, field, hay strip logic → KHÔNG breaking SDK consumer (chỉ `maximum` trong schema đổi).
- **BR-08:** Không có thay đổi DB/migration. Data `privateListLimit` cũ ngoài [1..500] được clamp an toàn ở frontend (BR-05), không cần backfill.

---

## 🖥️ UI/UX Flow

> Feature gần như thuần backend + 1 clamp frontend. UI **không thêm màn hình/nút/trường mới**. Mô tả hành vi quan sát được ở trang ranking công khai hiện có.

### 2.1 Route structure
- `GET /races/[slug]/ranking/[courseId]` — **public** (Anonymous), không auth. Route KHÔNG đổi.

### 2.2 Layout — trang ranking công khai (hiện có, không đổi cấu trúc)
- **Header (hero):** tên cự ly + địa điểm + ngày (không đổi).
- **Body:** thanh trạng thái → (biểu đồ nếu không ẩn) → ô search → bộ lọc → **bảng xếp hạng** (desktop table / mobile card) → (phân trang nếu không ở private mode).
- **Footer:** sponsors (không đổi).

### 2.3 UI Step-by-Step (hành vi sau fix)

| # | User action | UI behavior (TRƯỚC fix) | UI behavior (SAU fix) | Trigger |
|---|-------------|------------------------|----------------------|---------|
| 1 | Admin set `privateListLimit = 500`, lưu | — | Config lưu (form đã cho phép) | PATCH `/api/races/:id` |
| 2 | Anonymous mở `/races/[slug]/ranking/[courseId]` (private mode, không search) | Frontend gửi `pageSize=500` → **400** → `results=[]` → **bảng trống** "Không tìm thấy kết quả" | Frontend gửi `pageSize=500` (đã clamp) → **200** → bảng hiện **tới 500 VĐV** | `useRaceResults` fetch |
| 3 | Anonymous gõ BIB/tên vào ô search | (search vẫn chạy bình thường) | (không đổi — search dùng `pageSize` thường ≤100) | debounce search |
| 4 | Operator set `privateListLimit = 80` (≤100) | Hiện 80 VĐV | Hiện 80 VĐV (KHÔNG đổi — BR-04) | fetch |

### 2.4 Buttons Specification
> KHÔNG có nút mới. Selector "Hiển thị" (10/25/50/100) ở ranking thường GIỮ NGUYÊN max 100 (PAUSE-92-01).

### 2.5 Form Fields Specification
> KHÔNG có field input mới ở public. Field admin `privateListLimit` đã tồn tại, KHÔNG đổi:

| Field name | UI label | Type | Required | Validation | Default | Note |
|------------|----------|------|----------|------------|---------|------|
| `privateListLimit` | Số VĐV hiển thị tối đa (khi không search) | number | ⚪ | `min 1, max 500` (form clamp `Math.max(1, parseInt \|\| 20)`) | 20 | KHÔNG đổi — đã đúng |

### 2.6 Field source

| Field UI label | Data source | Format hiển thị | Empty state |
|----------------|-------------|-----------------|-------------|
| Danh sách VĐV (private mode) | `GET /api/race-results?...&pageSize={clamped privateListLimit}` → `data[]` | bảng/card | "Không tìm thấy kết quả" (chỉ khi thực sự 0 VĐV) |

### 2.7 UI States (trang ranking công khai)
- **Loading:** skeleton bảng (đã có — `loadingResults`).
- **Data:** bảng tới N VĐV (N = clamped `privateListLimit`, tối đa 500).
- **Empty thật:** chỉ hiện "Không tìm thấy kết quả" khi cự ly thực sự 0 kết quả (KHÔNG còn xuất hiện do lỗi 400).
- **Error fetch:** nếu backend lỗi → query error → empty state (như hiện tại). Sau fix, lỗi 400-do-pageSize KHÔNG còn xảy ra với `privateListLimit ≤ 500`.
- **Private mode:** phân trang ẩn (giữ nguyên hành vi `isPrivateNoSearch`).

---

## 🛠️ Technical Mandates (For Coder)

### 3.1 DB / Cache changes
- MongoDB: **KHÔNG đụng**.
- Redis: **KHÔNG đổi** key pattern/TTL (`results:<raceId>:<course>:<pageNo>:<filtersHash>`). Object cache có thể to hơn (tối đa 500 dòng) — chấp nhận.
- S3: không liên quan.
- Migration: **KHÔNG** → không PAUSE Manager.

### 3.2 Backend Endpoint Specification

| Element | Spec |
|---------|------|
| Method | GET |
| Path | `/api/race-results` |
| Auth | Public (Anonymous) — `enforceRaceVisibility` chỉ chặn draft race cho anon (giữ nguyên) |
| Query DTO | `GetRaceResultsDto` — **đổi `@Max(100)` → `@Max(500)`** + `@ApiPropertyOptional` maximum/description |
| Response DTO | KHÔNG đổi — `{ data: RaceResultDto[], pagination: { pageNo, pageSize, total, totalPages } }` |
| Status codes | 200 success / 400 `pageSize > 500` hoặc `< 1` / 404 draft race cho anon (giữ nguyên) |
| Side effects | KHÔNG đổi (cache read/write `results:*` như cũ) |

### 3.3 DTO Field-Level Spec (chỗ sửa duy nhất ở DTO)

`backend/src/modules/race-result/dto/get-race-results.dto.ts`:

```typescript
@ApiPropertyOptional({
  description: 'Page size (max 500)',   // ← was "max 100"
  default: 10,
  minimum: 1,
  maximum: 500,                          // ← was 100
  example: 25,
})
@IsOptional()
@Type(() => Number)
@IsInt()
@Min(1)
@Max(500)                                // ← was @Max(100)
pageSize?: number = 10;
```

### 3.4 Service clamp (chỗ sửa thứ 2 — BẮT BUỘC)

`backend/src/modules/race-result/services/race-result.service.ts` (≈ dòng 663):

```typescript
// Enforce pageSize cap
const pageSize = Math.min(dto.pageSize ?? 10, 500);   // ← was 100
```

> ⚠️ Coder PHẢI sửa cả 3.3 và 3.4. Sửa thiếu 3.4 = service âm thầm cắt 100 → fix không trọn (QC sẽ bắt qua TC-01).

### 3.5 Frontend clamp (chỗ sửa thứ 3)

`frontend/app/(main)/races/[slug]/ranking/[courseId]/page.tsx`:

- Dòng ≈228:
```typescript
const effectivePageSize = isPrivateNoSearch
  ? Math.min(500, Math.max(1, race?.privateListLimit || 20))   // clamp [1,500], || bắt cả 0
  : pageSize;
```
- (Tuỳ chọn nhất quán) dòng ≈209 mapping: giữ `privateListLimit: r.privateListLimit ?? 20` — clamp ở dòng 228 đã đủ an toàn; KHÔNG bắt buộc đổi dòng 209.
- Component: page là Client Component (`'use client'`) — KHÔNG đổi boundary.
- Data fetching: vẫn qua hook `useRaceResults` (generated SDK) — KHÔNG fetch thủ công.
- KHÔNG cần `revalidatePath/Tag` (client-side query).

### 3.6 SDK
- Đổi `maximum` schema → **chạy `pnpm generate:api`** ở `frontend/` (và `admin/` nếu cùng dùng) để SDK đồng bộ. Type không enforce `maximum` ở TS nên call site không gãy, nhưng vẫn regen cho đúng quy trình.

### 3.7 PAUSE flags
- KHÔNG migration, KHÔNG dep mới, KHÔNG đụng auth/fee, KHÔNG breaking response → **KHÔNG có PAUSE nào** cho Coder. Đây là bugfix trần số thuần.

---

## 🛡️ Testing Mandates (For QC)

### 4.1 Backend Test Cases TC-XX

#### TC-01 (CRITICAL) Happy path — pageSize=500 trả tới 500 dòng, KHÔNG cắt 100

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/race-results?raceId={raceCó>500kếtquả}&course_id={x}&pageNo=1&pageSize=500` |
| Headers | (none — public) |
| Expected status | 200 |
| Expected body shape | `{ data: [...], pagination: { pageNo:1, pageSize:500, total:N, totalPages:ceil(N/500) } }` |
| Assertion then chốt | `data.length === Math.min(500, totalSauLọcTrùngRank)` **và `pagination.pageSize === 500`** (KHÔNG phải 100) |
| MUST NOT leak | không field internal mới (response shape không đổi) |

#### TC-02 Boundary trên — pageSize=501 → 400

| Element | Value |
|---------|-------|
| URL | `?...&pageSize=501` |
| Expected status | 400 |
| Expected body | `{ "message": ["pageSize must not be greater than 500"], "error": "Bad Request", "statusCode": 400 }` |

#### TC-03 Boundary đúng trần — pageSize=500 exact → 200 (đã ở TC-01); pageSize=100 → 200 (regression)

| Element | Value |
|---------|-------|
| URL | `?...&pageSize=100` |
| Expected status | 200 |
| Assertion | `pagination.pageSize === 100`, `data.length === min(100, total)` — hành vi KHÔNG đổi (BR-04) |

#### TC-04 Boundary dưới — pageSize=0 → 400

| Element | Value |
|---------|-------|
| URL | `?...&pageSize=0` |
| Expected status | 400 |
| Expected body | `{ "message": ["pageSize must not be less than 1"], ... }` |

#### TC-05 Default — không truyền pageSize → 200, pageSize=10

| Element | Value |
|---------|-------|
| URL | `?raceId=...&course_id=...&pageNo=1` |
| Expected status | 200 |
| Assertion | `pagination.pageSize === 10` |

#### TC-06 Pagination giữa chừng (regression) — pageSize=50, pageNo=2

| Element | Value |
|---------|-------|
| URL | `?...&pageSize=50&pageNo=2` |
| Expected status | 200 |
| Assertion | `data.length === min(50, total-50)`, `pagination.pageNo===2`, `totalPages===ceil(total/50)` — đúng skip/slice (BR-06) |

#### TC-07 Service clamp unit test (then chốt — bắt bug "quên sửa lớp service")

| Element | Value |
|---------|-------|
| Loại | Unit test service `getRaceResults` (mock `resultModel.find` trả ≥ 200 doc) |
| Input | `dto.pageSize = 500` |
| Assertion | service trả `data.length` đúng tới 500 (KHÔNG bị `Math.min(...,100)` cắt còn 100); `pagination.pageSize === 500` |
| Input phụ | `dto.pageSize = 1000` (giả định qua được validation) → clamp về 500 (`Math.min`) |

**Minimum coverage:** TC-01..TC-07 (happy 500 + boundary 501/0/100 + default + pagination giữa + service clamp).

### 4.2 Frontend test cases (clamp logic)

| TC | Mô tả | Input `privateListLimit` | Expected `effectivePageSize` |
|----|-------|--------------------------|------------------------------|
| FE-01 | Giá trị thường | 90 | 90 |
| FE-02 | Trần mới | 500 | 500 |
| FE-03 | Vượt trần (data lỗi) | 999 | 500 (clamp) |
| FE-04 | Zero (data cũ) | 0 | 20 (`0 || 20`) rồi clamp → 20 |
| FE-05 | Null/undefined | null | 20 |
| FE-06 | Không private mode | (bất kỳ, có search) | = `pageSize` selector (≤100) |

> Có thể test bằng unit test thuần hàm clamp (tách helper) HOẶC Playwright E2E mục 4.2b.

### 4.2b Frontend E2E (Playwright — nếu QC chạy)

| TC | Persona | Journey | Expected |
|----|---------|---------|----------|
| E2E-01 | Anonymous | Mở ranking giải có `privateListLimit=500`, cự ly >100 VĐV | Bảng render >100 dòng (tới 500), KHÔNG empty state, KHÔNG lỗi |
| E2E-02 | Anonymous | Mở ranking `privateListLimit=90` | Bảng render đúng 90 dòng (regression) |

### 4.3 Security Checks
- [ ] Endpoint public read — fix KHÔNG mở thêm field/PII nào (response shape không đổi).
- [ ] Anon vẫn KHÔNG xem được draft race (`enforceRaceVisibility` giữ nguyên) → verify 404 với draft race.
- [ ] Không leak field internal mới; `pageSize` lớn KHÔNG bypass `filterDuplicateRanks` hay strip logic.
- [ ] Abuse note: public có thể gọi tay `pageSize=500` (data vốn công khai + cache 60s + bounded 500) — rủi ro thấp, chấp nhận.

### 4.4 Performance SLA
- `GET /api/race-results?pageSize=500` p95 **< 800ms** (cache miss; cache hit < 100ms). DB cost KHÔNG tăng so với pageSize=100 (service vốn load toàn bộ rồi slice in-memory) — chỉ thêm map + serialize ~400 dòng.
- Cache hit ratio sau warm-up > 80% (TTL 60s, không đổi).
- 10× ổn định: gọi `pageSize=500` 10 lần liên tiếp → kết quả deterministic (cùng `data.length`, cùng thứ tự).
- Frontend render 500 dòng: chấp nhận khựng nhẹ máy yếu (ghi tech debt TD-F092-VIRTUALIZE).

---

## 📌 Answers to Manager's PAUSE conditions (từ file 00)

- **PAUSE-92 "Trần = bao nhiêu?"** → **500** (Danny chốt).
- **PAUSE-92-01 "Có nâng selector Hiển thị (10/25/50/100) ở ranking công khai không?"** → **KHÔNG.** Selector normal-mode giữ tối đa 100 (UX phân trang bình thường, tránh tải 500 dòng khi user chỉ lướt). Chỉ path `privateListLimit` (operator chủ động bật) mới đi tới 500.
- **PAUSE-92-02 "Render 500 dòng có cần virtualize không?"** → **KHÔNG cho fix này.** Chấp nhận render thẳng (DOM ~500 row). Ghi **tech debt TD-F092-VIRTUALIZE** (virtualize/lazy nếu sau này có giải set limit cao + nhiều complaint lag mobile).
- **PAUSE-92 "Backfill data cũ?"** → **KHÔNG cần migration.** Clamp frontend `Math.min(500, Math.max(1, privateListLimit || 20))` xử lý an toàn mọi giá trị cũ (0/null/>500). Form admin đã chặn min 1/max 500 cho data mới.

---

## ✅ Status

- [x] READY — sẵn sàng cho Manager review (`/5bib-plan`)

---

## 🔗 Next step

Danny chạy: `/5bib-plan FEATURE-092-raceresult-pagesize-cap-500`
