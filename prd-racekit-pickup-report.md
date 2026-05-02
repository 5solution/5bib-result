# PRD — Module Báo Cáo Tình Hình Lấy Racekit

**Version:** 1.2 — Locked
**Ngày:** 2026-05-01
**Author:** PO Agent (rewrite từ v1.0 sau review của Fullstack-Engineer + 6 PAUSE đã được Danny chốt)
**Status:** ✅ Locked — sẵn sàng cho QC bóc test + Coder implement
**Branch target:** `5bib_racekit_v1` (từ `main`, KHÔNG từ `release/v1.6.0`)
**Ship target:** Sau race day Hà Giang 2026-05-02 → earliest 2026-05-05

---

## 🔒 6 PAUSE Resolutions (Danny chốt 2026-05-01)

| # | Item | Decision |
|---|------|----------|
| 1 | Install `recharts` | ✅ APPROVED — Coder được phép `pnpm add recharts` trong admin |
| 2 | Logto role | ✅ Chỉ `5bib-admin` được access (KHÔNG có role staff/back-office riêng) |
| 3 | Tenant scoping | ✅ Chỉ admin nội bộ 5BIB xem report — KHÔNG expose cho merchant/BTC. KHÔNG cần check Logto org claim cross-tenant (5bib-admin = super-admin theo design hiện tại) |
| 4 | Cost saved rate | ✅ Hardcode `4000 VNĐ` thẳng vào code. Đây là số nội bộ 5BIB tracking lợi nhuận, KHÔNG liên quan BTC, KHÔNG đổi theo deal |
| 5 | UI placement | ✅ Button cạnh "Chip Verify" trên race detail header |
| 6 | Audit log real-time mode | ✅ KHÔNG cần — bật/tắt thoải mái, không ghi log gì |

---

## 🆕 Changelog v1.0 → v1.1

| # | Thay đổi | Lý do |
|---|---------|-------|
| 1 | **Bỏ toàn bộ direct query MySQL** — consume `RaceAthleteLookupService` từ `race-master-data` module | v1.0 vi phạm boundary. Module `race-master-data` đã là single source of truth, đã có `racekit_received` + `racekit_received_at` cached trong MongoDB |
| 2 | Bỏ PAUSE #1 (`racekit_received_at` field) | Đã có trong [race_athletes.schema.ts:74](backend/src/modules/race-master-data/schemas/race-athlete.schema.ts), map từ MySQL `racekit_recieved_time` |
| 3 | Endpoint Overview: gộp 3 query → 1 `$facet` aggregation | Performance: giảm round trip MongoDB |
| 4 | Endpoint Athlete List: reuse `RaceAthleteLookupService.list()` + batch lookup chip_verifications | Tránh duplicate logic pagination/filter, tránh cross-DB |
| 5 | Hourly chart: dùng `race_athletes.racekit_received_at` cho series Bàn 1 (đã có timestamp) | v1.0 nói "nếu MySQL không có timestamp → 1 series" — sai, đã có |
| 6 | Cache key: giảm 3 → 2 key mới (reuse `master:stats:{raceId}` cho overview) | Tránh duplicate cache invalidation logic |
| 7 | Auth: clarify Logto (không phải JwtAuth thuần) + tenant scoping | v1.0 nói "JWT auth" — sai, codebase dùng `LogtoAuthModule` |
| 8 | Real-time mode: race-day trigger `triggerSync(ATHLETE_DELTA)` mỗi 60s khi tab open | Cron delta 5 phút quá chậm cho race-day pickup view |
| 9 | Add 10 edge cases (EC-1 → EC-10) vào QC mandate | Bib reassignment, course reassignment, no-bib athlete, overnight race timezone, … |
| 10 | Frontend: PAUSE install `recharts` (admin/package.json chưa có) | Tránh slip dependency mà không xin approval |

**Effort estimate revised:** 6-9 ngày (v1.0) → **3-5 ngày** (v1.1) vì bỏ MySQL query layer + cross-DB merge.

---

## 📝 Racekit Pickup Report Module

**Goal:** Trang báo cáo trên admin.5bib.com cho phép 5BIB Back-Office theo dõi real-time tình hình lấy racekit của 1 sự kiện — bao nhiêu VĐV đã đến, bao nhiêu no-show, phân bổ theo cự ly, theo thời gian — phục vụ ra quyết định ngay ngày race và báo cáo sau race.

**Scope:**

- ✅ In scope: Trang report trong admin race detail, **consume `RaceAthleteLookupService`** + MongoDB `chip_verifications`. Bao gồm: overview cards, biểu đồ theo giờ (2 series), breakdown theo cự ly, danh sách VĐV chi tiết (paginated, filter, search), export CSV.
- ❌ Out of scope: Cross-race comparison; push notification/alert khi tỷ lệ đạt ngưỡng; merchant-facing report (BTC tự xem); modify MySQL legacy data.

---

## 🔍 Bối cảnh thị trường (giữ nguyên từ v1.0)

Hầu hết platform race xử lý racekit pickup rất thô sơ. RunSignup có participant check-in list nhưng không có biểu đồ theo thời gian hay tính no-show cost. RaceRoster có bib assignment tracking nhưng không gắn với chip verification. Không platform nào ở SEA có báo cáo racekit pickup real-time kết hợp RFID data.

Đây là lợi thế độc quyền của 5BIB: vì ta own toàn bộ flow (QR scan Bàn 1 → RFID verify Bàn 2), ta có data mà không ai khác có. Data này cực kỳ có giá trị cho BTC (tối ưu logistics race day) và 5BIB (đàm phán giá RaceResult — chỉ push VĐV thật sự tham gia).

---

## 👤 User Stories & Business Rules

### User Stories

- As a **5BIB Back-Office Admin**, I want xem dashboard tổng quan tình hình lấy racekit ngay trên trang race detail so that tôi theo dõi real-time ngày race và ra quyết định nhanh (thêm nhân sự, mở thêm bàn).
- As a **5BIB Back-Office Admin**, I want xem biểu đồ pickup theo giờ với 2 series (Bàn 1 nhận racekit, Bàn 2 verify chip) so that tôi biết giờ cao điểm để phân bổ nhân sự.
- As a **5BIB Back-Office Admin**, I want xem breakdown theo cự ly so that tôi biết cự ly nào đã lấy gần hết, cự ly nào còn nhiều VĐV chưa đến.
- As a **5BIB Back-Office Admin**, I want xem danh sách VĐV chi tiết với filter trạng thái + search BIB/tên so that tôi tra cứu trạng thái từng VĐV cụ thể.
- As a **5BIB Back-Office Admin**, I want export CSV danh sách VĐV + trạng thái racekit so that tôi gửi BTC hoặc dùng đối soát sau race.
- As a **5BIB Back-Office Admin**, I want thấy số tiền tiết kiệm nhờ không push no-show lên RaceResult so that tôi report giá trị 5BIB mang lại cho BTC.
- As a **5BIB Back-Office Admin (race-day mode)**, I want auto-trigger delta sync mỗi 60s khi mở tab so that data update gần real-time thay vì lag tối đa 5 phút theo cron.

### Business Rules

- **BR-01:** Report chỉ hoạt động cho race đã link `mysql_race_id` (giống chip-verify). Nếu chưa link → hiện message "Chưa link MySQL race, vui lòng link tại trang Chip Verify" + button redirect.
- **BR-02:** Single source of truth = `race-master-data` module. Tất cả data lấy từ:
  - **Tổng VĐV đăng ký:** `RaceAthleteLookupService.getStats(raceId).total`
  - **Đã nhận racekit (Bàn 1):** Count `race_athletes` WHERE `racekit_received = true` (MongoDB cache, sync từ MySQL `racekit_recieved`)
  - **Đã verify chip (Bàn 2):** Count `chip_verifications` WHERE `mysql_race_id = X` AND `result = 'FOUND'` AND `is_first_verify = true`
  - **No-show:** registered − picked_up
  - **CẤM:** Direct query MySQL `athletes`/`race_course`/`ticket_type` từ module này (vi phạm boundary `race-master-data`).
- **BR-03:** Chi phí tiết kiệm = `no_show × 4000` VNĐ. **Hardcode `4000` thẳng vào constant** — đây là số nội bộ 5BIB tracking, KHÔNG đổi theo BTC, KHÔNG cần env config. Đặt constant `RESULT_PUSH_FEE_PER_ATHLETE = 4000` trong file `racekit-report.constants.ts`.
- **BR-04:** Biểu đồ timeline 2 series (group theo giờ HH GMT+7):
  - Series 1 — **Nhận racekit:** group `race_athletes.racekit_received_at` (đã có timestamp)
  - Series 2 — **Verify chip:** group `chip_verifications.verified_at` WHERE `is_first_verify=true AND result='FOUND'`
- **BR-05:** Breakdown theo cự ly: `course_name` lấy từ `race_athletes.course_name` (latest truth, không dùng `course_name_snapshot` để tránh stale data khi BTC đổi cự ly).
- **BR-06:** Auto-refresh polling:
  - Overview: 30s
  - Hourly chart: 60s
  - Course breakdown: 60s
  - Athlete list: trigger manual hoặc khi đổi filter/page (KHÔNG poll, tránh interrupt scroll)
- **BR-07:** Race-day real-time mode (toggle UI, default OFF):
  - Khi ON: gọi `RaceAthleteLookupService.triggerSync(raceId, { syncType: 'ATHLETE_DELTA', triggeredBy: 'racekit-report-realtime' })` mỗi 60s
  - SETNX lock `master:cron-lock:{raceId}` đã có → an toàn nếu cron + manual trigger trùng giờ
- **BR-08:** Auth — `@UseGuards(LogtoAuthGuard)` + role check **chỉ `5bib-admin`**. KHÔNG có tenant scoping (5bib-admin có quyền xem mọi race). Role khác (merchant/staff/athlete) → 403.
- **BR-09:** Athlete list filter: `all` | `picked_up` (racekit_received=true) | `verified` (chip_verified=true) | `picked_no_verify` (received=true AND verified=false) | `no_show` (received=false). Search server-side trên `bib_number` + `display_name` (LIKE).
- **BR-10:** Pagination 50 VĐV/page, max limit 100. KHÔNG cache athlete list (quá nhiều variant).
- **BR-11:** Export CSV: rate limit 1 export/phút/user, max 10000 rows. Stream với `﻿` BOM để Excel mở UTF-8 đúng tiếng Việt.
- **BR-12:** Field hiển thị `bib_number = null` (chưa gán BIB): cột BIB hiện `—`, có filter "Chưa gán BIB" riêng.

---

## 🖥️ UI/UX Flow

### Screen: Racekit Report — Route: `/races/[id]/racekit-report`

Thêm button trên race detail header cạnh "Chip Verify":

```
┌─────────────────────────────────────────────────────────────┐
│  ← Race List                                                │
│                                                              │
│  HA GIANG TRAIL 2026                              [Live]    │
│  ha-giang-trail-2026                                        │
│                                                              │
│   [📊 Racekit Report] [📡 Chip Verify] [✏️ Sửa KQ]          │
│   [🔴 Real-time mode: OFF]  ← toggle race-day               │
└─────────────────────────────────────────────────────────────┘
```

### Section 1 — Overview Cards (top, polling 30s)

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│ ĐĂNG KÝ      │ ĐÃ NHẬN      │ ĐÃ VERIFY    │ NO-SHOW      │ TIẾT KIỆM    │
│   3,500      │   2,812      │   2,734      │    688       │  2,752,000₫  │
│  Total VĐV   │  Racekit ✓   │  Chip ✓      │  Chưa đến    │ 688×4,000    │
│              │  80.3%       │  78.1%       │  19.7%       │              │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘
```

- Mỗi card hiện số tuyệt đối + % so với tổng
- Card "TIẾT KIỆM" format VNĐ
- Color của %: xanh (>80%), vàng (50-80%), đỏ (<50%)

### Section 2 — Biểu đồ theo giờ (middle, polling 60s)

Bar chart 2 series chồng (stacked) hoặc cạnh nhau (grouped):
- Series 1 (xanh đậm): Đã verify chip
- Series 2 (xanh nhạt): Đã nhận racekit
- X axis: giờ trong ngày (06:00 → 22:00, GMT+7)
- Lib: `recharts` (✅ Danny approved install — Coder chạy `cd admin && pnpm add recharts`)

### Section 3 — Breakdown theo cự ly (polling 60s)

Table + visual progress bar cho mỗi cự ly:

```
Cự ly       │ Đăng ký  │ Đã nhận  │ Đã verify │ No-show
10KM        │    800   │    712   │    698    │    88
21KM        │  1,200   │    980   │    952    │   220
...
```

- Sort mặc định theo `course_distance` ASC
- % tính = picked_up / registered

### Section 4 — Danh sách VĐV chi tiết (bottom)

```
┌─────────────────────────────────────────────────────────────┐
│  👥 Danh sách VĐV                          [📥 Export CSV]  │
│                                                              │
│  🔍 [Tìm BIB hoặc tên_____________]                         │
│  Filter: [Tất cả ▼] [10KM ▼] [Trạng thái ▼]                 │
│                                                              │
│  BIB    │ Họ tên          │ Cự ly │ Racekit │ Chip   │ Giờ  │
│  ───────┼─────────────────┼───────┼─────────┼────────┼───── │
│  90009  │ Phạm Dương      │ 21KM  │  ✅     │  ✅    │14:23 │
│  90010  │ Trần Vinh       │ 42KM  │  ✅     │  ✅    │14:22 │
│   —     │ Lê Thị Hoa      │ 10KM  │  ❌     │  ❌    │  —   │  ← chưa gán BIB
│  90012  │ Nguyễn Minh     │ 21KM  │  ❌     │  ❌    │  —   │  ← no-show
│                                                              │
│  Trang 1/70               [← Prev] [1] [2] [3] ... [Next →] │
└─────────────────────────────────────────────────────────────┘
```

**Cột chi tiết (data source = `race_athletes` Mongo):**
- **BIB:** `bib_number` (hiện `—` nếu null)
- **Họ tên:** `display_name` (fallback `full_name`)
- **Cự ly:** `course_name`
- **Racekit:** ✅ nếu `racekit_received=true`
- **Chip:** ✅ nếu có record `chip_verifications` với `is_first_verify=true AND result='FOUND'`
- **Giờ:** `chip_verifications.verified_at` format `HH:mm`

**Filter status:** `all` | `picked_up` | `verified` | `picked_no_verify` | `no_show` | `no_bib` (theo BR-09 + BR-12).

**Search:** Server-side trên `bib_number` + `display_name` (qua `RaceAthleteLookupService.list({ search })`).

**Export CSV:** Toàn bộ danh sách (KHÔNG áp filter), columns:
`BIB,Họ tên,Cự ly,Đã nhận racekit,Đã verify chip,Giờ verify,Trạng thái`

Filename: `racekit-report-{race_slug}-{date}.csv`. Header có `﻿` BOM cho Excel UTF-8.

### States

- **Chưa link MySQL race_id:** Alert "Vui lòng link MySQL race_id tại trang Chip Verify trước" + button redirect `/races/[id]/chip-mappings`
- **Đã link nhưng chưa sync `race-master-data` lần đầu:** Alert "Chưa sync danh sách VĐV. [Trigger sync ngay]" → POST `/admin/races/:id/master-data/sync` mode=FULL
- **Đã sync nhưng chưa import chip mapping:** Report hiện bình thường, cột Chip tất cả ⏳, stats verify=0
- **Race chưa bắt đầu phát racekit:** Cards = 0, biểu đồ trống, danh sách tất cả ❌
- **Race đang phát racekit (live):** Auto-refresh theo BR-06, có thể bật race-day real-time mode
- **Race đã kết thúc:** Data cuối cùng, polling chậm hơn (5 phút). Toggle real-time mode tự động OFF
- **Error API:** Toast "Không tải được dữ liệu, đang thử lại...", retry 10s, giữ data cũ trên UI (stale-while-revalidate)
- **No results sau search:** Empty state "Không tìm thấy VĐV nào"

---

## 🛠️ Technical Mandates (For Coder Agent)

### DB Changes

**KHÔNG có schema change.** Tất cả data đã có sẵn:
- MongoDB `race_athletes` (`race-master-data` module) — đã có `racekit_received`, `racekit_received_at`, `course_name`, `course_id`
- MongoDB `chip_verifications` (`chip-verification` module) — đã có index `race_verified_at_desc`

### Redis Cache

| Key | TTL | Note |
|-----|-----|------|
| `master:stats:{raceId}` | 60s | **REUSE** từ `race-master-data`, KHÔNG tạo key mới cho overview |
| `racekit-report:hourly:{raceId}` | 60s | Cross-collection aggregation — cache riêng |
| `racekit-report:course:{raceId}` | 60s | Cross-collection (race_athletes + chip_verifications) — cache riêng |
| `racekit-report:export-rl:{userId}` | 60s | Rate limit export CSV — SETNX |

KHÔNG cache athlete list (quá nhiều variant query).

### Backend — NestJS

**Tạo module mới:** `backend/src/modules/racekit-report/`
- `racekit-report.module.ts`
- `racekit-report.controller.ts`
- `services/racekit-report.service.ts`
- `dto/` — RacekitOverviewDto, RacekitHourlyDto, RacekitCourseDto, AthleteListResponseDto, ExportQueryDto

**Imports:**
```typescript
@Module({
  imports: [
    MongooseModule.forFeature([{ name: ChipVerification.name, schema: ChipVerificationSchema }]),
    RaceMasterDataModule,  // ← inject RaceAthleteLookupService
    LogtoAuthModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [RacekitReportController],
  providers: [RacekitReportService],
})
```

#### Endpoint 1 — Overview stats

```
GET /admin/races/:mysqlRaceId/racekit-report/overview
```

- Guards: `@UseGuards(LogtoAuthGuard)` + role check **chỉ `5bib-admin`** (single role, KHÔNG fallback)
- KHÔNG cần tenant scoping (5bib-admin có quyền xem mọi race)
- Logic:
  1. `RaceAthleteLookupService.getStats(raceId)` → `total_registered`, `picked_up`, `by_course` (đã cache `master:stats` 60s)
  2. MongoDB count `chip_verifications` WHERE `mysql_race_id+result='FOUND'+is_first_verify=true` → `verified_count`
  3. Compute: `no_show = registered - picked_up`, `cost_saved = no_show × 4000`
- Response DTO:

```typescript
class RacekitOverviewDto {
  @ApiProperty() total_registered: number;
  @ApiProperty() total_picked_up: number;
  @ApiProperty() total_chip_verified: number;
  @ApiProperty() total_no_show: number;
  @ApiProperty() cost_saved: number;
  @ApiProperty() pickup_rate: number;
  @ApiProperty() verify_rate: number;
}
```

#### Endpoint 2 — Hourly timeline

```
GET /admin/races/:mysqlRaceId/racekit-report/hourly
```

- Logic: Promise.all 2 aggregation:
  ```javascript
  // Series 1 — pickup
  db.race_athletes.aggregate([
    { $match: { mysql_race_id: raceId, racekit_received: true, racekit_received_at: { $ne: null } } },
    { $group: { _id: { $dateToString: { format: "%H", date: "$racekit_received_at", timezone: "+07:00" } }, count: { $sum: 1 } }},
    { $sort: { _id: 1 } }
  ])
  // Series 2 — verify
  db.chip_verifications.aggregate([
    { $match: { mysql_race_id: raceId, result: 'FOUND', is_first_verify: true } },
    { $group: { _id: { $dateToString: { format: "%H", date: "$verified_at", timezone: "+07:00" } }, count: { $sum: 1 } }},
    { $sort: { _id: 1 } }
  ])
  ```
- Merge into 24-hour skeleton (00→23), fill 0 cho hour rỗng
- Cache 60s

#### Endpoint 3 — Course breakdown

```
GET /admin/races/:mysqlRaceId/racekit-report/by-course
```

- Logic: Promise.all 2 aggregation
  - `race_athletes` $facet: registered + picked_up group by `course_name` + `course_id`
  - `chip_verifications` group by `course_name_snapshot` AS verified_count
  - Merge by `course_name`. Sort theo `course_distance` ASC.
- Cache 60s

#### Endpoint 4 — Athlete list (paginated)

```
GET /admin/races/:mysqlRaceId/racekit-report/athletes?page=1&limit=50&status=all&course_id=&search=
```

- Logic:
  1. `RaceAthleteLookupService.list(raceId, { page, limit, status_filter, course_id, search })` → trả paginated athletes
  2. Lấy `athletes_id[]` của page hiện tại → 1 query `chip_verifications.find({ mysql_race_id, athletes_id: { $in: [...] }, is_first_verify: true, result: 'FOUND' })`
  3. Merge `chip_verified` + `verified_at` vào response DTO
- **status filter** mapping (tránh ambiguity):
  - `all` → no filter
  - `picked_up` → `racekit_received=true`
  - `verified` → có chip_verifications match
  - `picked_no_verify` → `racekit_received=true AND` không có chip_verification
  - `no_show` → `racekit_received=false`
  - `no_bib` → `bib_number=null`
- Response DTO:

```typescript
class AthleteRacekitDto {
  @ApiProperty({ nullable: true }) bib_number: string | null;
  @ApiProperty({ nullable: true }) display_name: string | null;
  @ApiProperty({ nullable: true }) course_name: string | null;
  @ApiProperty() racekit_received: boolean;
  @ApiProperty({ nullable: true }) racekit_received_at: Date | null;
  @ApiProperty() chip_verified: boolean;
  @ApiProperty({ nullable: true }) verified_at: Date | null;
}

class AthleteListResponseDto {
  @ApiProperty({ type: [AthleteRacekitDto] }) data: AthleteRacekitDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() total_pages: number;
}
```

- KHÔNG cache (quá nhiều variant)

#### Endpoint 5 — Export CSV

```
GET /admin/races/:mysqlRaceId/racekit-report/export
```

- Rate limit: SETNX `racekit-report:export-rl:{userId}` TTL 60s. Trùng → 429.
- Stream `text/csv; charset=utf-8`, header `Content-Disposition: attachment; filename=racekit-report-{slug}-{date}.csv`
- Prepend `﻿` BOM
- Cursor MongoDB stream qua `race_athletes`, batch size 500, mỗi batch lookup `chip_verifications` 1 lần
- Max rows: 10000. Nếu race > 10000 → trả 413 + message "Race quá lớn, vui lòng filter trước khi export"
- Columns: `BIB,Họ tên,Cự ly,Đã nhận racekit,Đã verify chip,Giờ verify,Trạng thái`

#### Endpoint 6 — Trigger race-day delta sync

```
POST /admin/races/:mysqlRaceId/racekit-report/realtime-sync
```

- Logic: thin wrapper gọi `RaceAthleteLookupService.triggerSync(raceId, { syncType: 'ATHLETE_DELTA', triggeredBy: 'racekit-report-user-{userId}' })`
- Tự throttle nội bộ via SETNX `master:cron-lock:{raceId}` → trùng cron tick = no-op, an toàn
- Return: `{ status: 'triggered' | 'already_running', sync_log_id?: string }`
- Frontend gọi mỗi 60s khi toggle real-time ON

### ✅ PAUSE đã resolved (xem block "6 PAUSE Resolutions" đầu PRD)

Toàn bộ 6 PAUSE đã được Danny chốt. Coder KHÔNG cần xin approval thêm cho 6 mục này. Nếu phát hiện PAUSE mới trong quá trình implement → escalate riêng.

### Frontend — Next.js (admin)

**Tạo route:** `admin/src/app/(dashboard)/races/[id]/racekit-report/page.tsx`

| Component | Type | Purpose |
|-----------|------|---------|
| `RacekitReportPage` | Server Component | Layout, fetch race config (slug, course list), check link MySQL |
| `RacekitOverviewCards` | `'use client'` | 5 stat cards. Query key `['racekit-report', 'overview', raceId]`, refetchInterval 30000 |
| `RacekitHourlyChart` | `'use client'` | recharts BarChart 2 series. Query key `['racekit-report', 'hourly', raceId]`, refetchInterval 60000 |
| `RacekitCourseBreakdown` | `'use client'` | Table + progress bars. Query key `['racekit-report', 'by-course', raceId]`, refetchInterval 60000 |
| `RacekitAthleteList` | `'use client'` | Paginated table + filter + search + export. Query key `['racekit-report', 'athletes', raceId, { page, status, course, search }]`, NO refetchInterval (manual) |
| `RacekitRealtimeToggle` | `'use client'` | Toggle race-day mode. Khi ON: `setInterval(triggerRealtimeSync, 60000)` + `queryClient.invalidateQueries(['racekit-report'])` sau mỗi sync |

**TanStack Query setup:**
- Sau mutation toggle real-time: `queryClient.invalidateQueries({ queryKey: ['racekit-report'] })` (broad invalidate cả 4 sub-key)
- Mobile-first: stack vertical < `md`, grid 2-col < `lg`, grid 5-col >= `lg`

**SDK regen:** Sau khi backend xong → `cd admin && pnpm run generate:api`. Verify SDK gen ra type AthleteRacekitDto + RacekitOverviewDto đúng nullable.

---

## 🛡️ Testing Mandates (For QC Agent)

### Happy Path

1. Login admin (role `back-office-admin`) → vào race đã link MySQL + đã sync master-data → click "Racekit Report"
2. Thấy 5 overview cards với data chính xác (so sánh với `RaceAthleteLookupService.getStats()` + MongoDB count chip_verifications)
3. Biểu đồ hourly hiện 2 series (Bàn 1 + Bàn 2) theo giờ GMT+7
4. Breakdown theo cự ly hiện đúng số liệu per-course (compare manual aggregation MongoDB)
5. Danh sách VĐV hiện đúng status, support filter `picked_no_verify` + `no_bib`
6. Search "90009" → tìm đúng VĐV
7. Filter "No-show" → chỉ hiện racekit_received=false
8. Export CSV → file download, mở Excel hiển thị đúng tiếng Việt (BOM check)
9. Toggle real-time mode ON → 60s sau, network tab thấy POST `/realtime-sync`, sau đó 4 query refetch

### Unhappy Paths — Must Write Tests

#### Edge Cases mới (EC-1 → EC-10) từ Fullstack-Engineer review

- [ ] **EC-1 — Athlete chưa có BIB:** Race có 100 VĐV chưa gán BIB → cột BIB hiện `—`, filter `no_bib` trả 100, search BIB miss không lỗi
- [ ] **EC-2 — Bib reassignment:** VĐV verify chip với BIB=100, sau đó admin đổi BIB=200. Athlete list join theo `athletes_id` → row đúng, BIB cột hiện 200, Chip ✅, không duplicate
- [ ] **EC-3 — Course reassignment:** VĐV verify chip với course="10KM", sau đó admin đổi course="21KM". Breakdown by course → đếm vào "21KM" (theo `race_athletes.course_name` latest), KHÔNG đếm vào "10KM" (snapshot cũ)
- [ ] **EC-4 — Data lag race-day:** Tắt real-time mode, MySQL update `racekit_recieved=true` lúc T0 → UI thấy sau ≤ 5 phút (cron). Bật real-time mode → UI thấy sau ≤ 90s (60s trigger + 30s polling overview)
- [ ] **EC-5 — Verify trước khi nhận racekit:** Athlete A có chip_verified=true nhưng racekit_received=false → filter `picked_no_verify` KHÔNG trả A, filter `no_show` KHÔNG trả A. Cần filter mới `verified_no_pickup` HOẶC bug log warning
- [ ] **EC-6 — Race chưa sync master-data lần đầu:** Hiện alert "Chưa sync, [Trigger ngay]". Click → POST `/master-data/sync`, sau đó refresh report
- [ ] **EC-7 — Race overnight (Hà Giang 100KM):** VĐV verify lúc 23:50 GMT+7 (= 16:50 UTC) → bucket "23" (GMT+7), KHÔNG là "16" (UTC). Test với race start 22:00, fixture 5 verify ở 22:30, 23:30, 00:30, 01:30, 02:30
- [ ] **EC-8 — Export CSV stream backpressure:** Mock chậm response, abort connection giữa stream → backend không leak cursor (verify Mongoose cursor close in finally)
- [ ] **EC-9 — cost_saved over-claim:** Race chưa start, 0 VĐV picked_up, cards hiện cost_saved = 3500×4000 = 14M → SAI. Phải có guard: nếu race chưa start (`race.status != 'live' && != 'ended'`) thì cost_saved = 0
- [ ] **EC-10 — Search server-side với 3500 VĐV:** Search "Phạm" → server-side LIKE qua `RaceAthleteLookupService.list({ search: 'Phạm' })`, p95 < 500ms (test load)

#### Standard unhappy paths

- [ ] **Race chưa link MySQL:** Vào racekit-report → alert + redirect link, không hiện report (verify response 200 với flag `linked: false`)
- [ ] **Race không có chip mapping:** Overview cards hiện, verified=0, danh sách cột Chip tất cả ⏳
- [ ] **Race 0 VĐV đăng ký:** Cards = 0, biểu đồ trống, danh sách trống. Division by zero → "0%" không NaN
- [ ] **Search không có kết quả:** Empty state "Không tìm thấy VĐV nào"
- [ ] **Export CSV race > 10000 VĐV:** Trả 413 + message rõ ràng, KHÔNG timeout
- [ ] **Concurrent export:** 2 click trong 60s → lần 2 trả 429 với header `Retry-After: 60`
- [ ] **API timeout:** Toast error, data cũ giữ nguyên (stale-while-revalidate), retry 10s
- [ ] **JWT expired giữa polling:** Detect 401 → redirect login, KHÔNG silent fail
- [ ] **Real-time mode khi tab hidden (page visibility API):** Tab inactive → tạm dừng setInterval để tiết kiệm tài nguyên. Tab active lại → resume

### Security Checks

- `GET /admin/races/:id/racekit-report/*` — unauthenticated → `401`
- `GET /admin/races/:id/racekit-report/*` — wrong role (athlete/merchant/staff) → `403`
- `GET /admin/races/:id/racekit-report/*` — role `5bib-admin` access bất kỳ race nào → `200` (KHÔNG tenant filter)
- Response MUST NOT contain: `email`, `contact_phone`, `id_number`, `address`, `cccd_image_url` (PII fields). Verify qua DTO `RaceAthletePublicDto` có flag `select: false` ở schema
- Export CSV MUST NOT contain PII columns — check raw bytes file output
- Logto JWT verify đúng (signature, exp, audience) — không hardcode public key, dùng JWKS

### Performance SLA

| Endpoint | SLA p95 | Note |
|----------|---------|------|
| Overview | < 300ms | Reuse cache `master:stats` 60s + 1 count `chip_verifications` |
| Hourly | < 400ms | 2 aggregation song song, MongoDB index hit |
| Course breakdown | < 500ms | 2 aggregation, group by indexed field |
| Athlete list (page 1, 50 rows, no filter) | < 800ms | `RaceAthleteLookupService.list` đã optimize + 1 batch query chip |
| Athlete list (search "Phạm" trong 5000 VĐV) | < 1000ms | LIKE search có thể chậm — cần index hoặc Atlas Search |
| Export CSV 5000 rows | < 5s | Stream với cursor, batch 500 |

Frontend:
- Initial render < 2s (skeleton first, data fill progressive)
- Real-time mode ON, 1 hour session → memory leak < 50MB (verify Chrome DevTools)

### Load Test (race-day simulation)

- Hà Giang scenario: 3500 VĐV, 5 admin đang xem report cùng lúc, real-time mode ON
- Backend: 5 admin × 4 polling endpoint mỗi 30-60s ≈ 20 req/min sustained — Redis cache hit rate phải > 80%
- MongoDB: aggregation race_athletes + chip_verifications mỗi 60s — phải KHÔNG trigger collection scan (verify `explain()`)

---

## 📌 Notes

**Tại sao tách 6 endpoint thay vì 1 endpoint trả hết:**
- Mỗi section refresh interval khác nhau (overview 30s, chart 60s)
- Athlete list có pagination/filter riêng + KHÔNG cache
- Endpoint 6 (real-time sync trigger) cần POST + rate limit, không gộp vào GET được
- Cache Redis hiệu quả hơn khi tách

**Effort estimate (revised):**
- Backend: 2-3 ngày (5 GET endpoint + 1 POST + Redis cache, KHÔNG có MySQL query layer mới)
- Frontend: 2 ngày (4 components + chart + pagination + export, sau khi `recharts` được approve)
- QA: 1-2 ngày (chạy đủ 10 EC + standard paths + load test)
- **Total: 5-7 ngày** (giảm ~30% so với v1.0)

**Dependencies:**
- `race-master-data` module (đã có production)
- `chip-verification` module v1.3 (đã có production sau race day 2026-05-02)
- KHÔNG dependency với feature TTS đang phát triển song song

**Branch chiến lược:**
- Tạo `5bib_racekit_v1` từ `main` SAU khi `release/v1.6.0` đã merge vào main và race day 2026-05-02 ổn định
- Earliest start coding: 2026-05-05
- Earliest ship: 2026-05-12 (1 tuần sau)
