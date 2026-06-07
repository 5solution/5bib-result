# FEATURE-070: PRD — Merchant Portal Advanced MKT Analytics (Forecast / Heatmap / Funnel)

**Status:** 🔵 READY
**Last updated:** 2026-06-07
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check
- [x] Đã đọc `00-manager-init.md` (5 PAUSE, impact map, risk flags)
- [x] Đã đọc memory codebase-map (merchant-portal F-069) + known-issues (vendor payment_on quirk)
- [x] 5 PAUSE conditions đã được Danny + Manager chốt (xem section cuối)

---

## 🎯 Title + Goal + Scope

**Goal:** Bổ sung 3 chart MKT analytics vào tab "Báo cáo bán vé" của Merchant Portal (merchant.5bib.com) để BTC/MKT ra quyết định chiến dịch: dự báo về đích, khung giờ vàng đăng ký, phễu chuyển đổi đơn.

**In scope:**
- ✅ Backend: 2 endpoint READ (`forecast`, `heatmap`) + 1 endpoint WRITE (`target` — BTC tự nhập mục tiêu).
- ✅ Frontend: 3 chart (Pace/Forecast, Heatmap, Funnel) port từ mockup vào tab Vé + ô nhập target.
- ✅ Store mới: Mongo collection `merchant_race_target` (per-race goal).

**Out of scope:**
- ❌ KHÔNG đụng revenue/fee endpoints (3 chart đều ticket-scope, KHÔNG tiền — BR-MP-09).
- ❌ KHÔNG YoY compare chart (AnCompare mockup) — cần liên kết race edition, defer F-071+.
- ❌ KHÔNG stacked-by-course / velocity charts (đã có `/ticket-sales/stacked` endpoint nhưng chưa wire — out scope lần này, Danny chỉ yêu cầu 3 chart forecast/heatmap/funnel).
- ❌ KHÔNG đụng 13 endpoint + 152 test F-069 hiện có.

---

## 👤 Phase 1 — User Stories & Business Rules

### User Stories
- **US-1:** As a **Race Organizer (BTC/MKT, role merchant_viewer)**, I want to **xem lũy kế đăng ký + dự báo vé về ngày đua so với mục tiêu tôi đặt** so that **tôi biết có cần đẩy thêm chiến dịch hay không**.
- **US-2:** As a **Race Organizer**, I want to **tự nhập mục tiêu số vé cho giải** so that **biểu đồ dự báo có mốc so sánh đúng với kỳ vọng của tôi**.
- **US-3:** As a **Race Organizer**, I want to **xem khung giờ & thứ trong tuần có nhiều đăng ký nhất (giờ VN)** so that **tôi lên lịch chạy ads/email/notification đúng lúc**.
- **US-4:** As a **Race Organizer**, I want to **xem phễu chuyển đổi đơn (tạo → thanh toán) + tỷ lệ treo/huỷ** so that **tôi biết bao nhiêu đơn treo cần nhắc thanh toán**.

### Business Rules
- **BR-70-01:** 3 chart thuộc **ticket-scope** → guard `LogtoMerchantGuard` (role merchant_viewer HOẶC merchant_finance). KHÔNG yêu cầu finance. (Kế thừa F-069 BR-MP-02.)
- **BR-70-02:** 3 chart **KHÔNG hiển thị bất kỳ giá trị tiền nào** (chỉ count vé/đơn) — ticket report rule (kế thừa BR-MP-09).
- **BR-70-03 (IDOR):** Mọi endpoint phải gọi `assertRaceForUser(userId, raceId)` — user chỉ truy cập raceId nằm trong access của mình. Vi phạm → 403.
- **BR-70-04 (Forecast data):** Cumulative = running-sum của `COUNT(DISTINCT om.id)` theo `DATE(om.payment_on)`, `financial_status='paid'`, `deleted=0`, `payment_on IS NOT NULL`, toàn bộ lịch sử tới hiện tại (FULL window, KHÔNG theo PeriodSelector).
- **BR-70-05 (Forecast projection):** `recentDailyRate` = (cumulative hiện tại − cumulative 7 ngày trước) / 7. `projectedValue` = cumulative hiện tại + recentDailyRate × `daysToRace`. `daysToRace` = max(0, ceil((eventStartDate − today)/86400000)). Là **ước tính theo tốc độ 7 ngày** — frontend PHẢI ghi disclaimer.
- **BR-70-06 (Race ended):** Nếu race.status ∈ {COMPLETE, CANCEL} HOẶC eventStartDate < today → `raceEnded=true`, backend trả `projectedValue=null` + frontend ẩn đường projection + ẩn target line (chỉ vẽ lũy kế thực tế).
- **BR-70-07 (Target editable):** BTC tự nhập `target` (số vé). Lưu Mongo `merchant_race_target` (1 doc/raceId, upsert). Khi chưa set → `target=null` → forecast ẩn đường target. Target chỉ là mốc tham chiếu, KHÔNG ảnh hưởng projection.
- **BR-70-08 (Target write access):** PUT target yêu cầu user có access raceId (`assertRaceForUser`). Đây là **WRITE đầu tiên** của merchant user (portal vốn read-only) — vẫn ticket-scope, KHÔNG cần finance. Ghi `updatedBy=userId`, `updatedAt`.
- **BR-70-09 (Target validation):** `target` integer ≥ 0, ≤ 10_000_000 (chặn số vô lý). 0 = xoá mục tiêu (target=null hiệu lực).
- **BR-70-10 (Heatmap timezone):** `payment_on` lưu UTC → backend convert `DATE_ADD(om.payment_on, INTERVAL 7 HOUR)` TRƯỚC khi tính `DAYOFWEEK`/`HOUR`. Grid theo giờ VN.
- **BR-70-11 (Heatmap shape):** Grid 7 dòng (T2→CN, tức Mon→Sun) × 7 cột khung giờ `[0-6, 6-9, 9-12, 12-15, 15-18, 18-21, 21-24]`. Cell = `COUNT(DISTINCT om.id)` paid trong dòng×cột. Full history.
- **BR-70-12 (Funnel — frontend derive):** KHÔNG endpoint mới. Lấy từ `getTicketSalesSummary` byStatus (orderCount). `confirmed = paid (+ completed nếu có)`, `pending = pending`, `dropped = voided (+ cancelled + refunded nếu có)`. `conversion% = confirmed/totalOrders`, `pending% = pending/totalOrders`, `cancel% = dropped/totalOrders`. 2 stage bar (Tổng đơn → Đã thanh toán) + 3 stat.
- **BR-70-13 (Empty/zero data):** Race chưa có đơn paid → forecast cumulative `[]`, heatmap grid toàn 0, funnel toàn 0 → frontend hiện EmptyState "Chưa có dữ liệu đăng ký", KHÔNG vẽ chart rỗng lỗi.
- **BR-70-14 (Cache):** forecast + heatmap cache Redis TTL 300s, key `merchant-portal:forecast:<raceId>` / `merchant-portal:heatmap:<raceId>`. Target write → DEL `merchant-portal:forecast:<raceId>`.

---

## 🖥️ Phase 2 — UI/UX Flow

### 2.1 Route
- KHÔNG route mới. 3 chart render trong tab "Báo cáo bán vé" của `merchant/src/app/races/[raceId]/page.tsx` (access: merchant session, đã có).

### 2.2 Layout — vị trí trong tab Vé (sau các block F-069 hiện có)
Thứ tự block trong tab Vé (giữ nguyên block cũ, THÊM nhóm "Phân tích MKT" sau bảng đơn):
1. (cũ) KPI cards → trend → by-course → by-type → orders table.
2. **(MỚI) GroupLabel "Phân tích MKT / MKT analytics"**
3. **(MỚI) Card Forecast** — header "Lũy kế & dự báo về đích" + ô nhập target (góc phải) → PaceChart.
4. **(MỚI) Card Heatmap** — header "Khung giờ vàng đăng ký" → grid 7×7.
5. **(MỚI) Card Funnel** — header "Phễu chuyển đổi đơn" → 2 stage bar + 3 stat.

### 2.3 UI Step-by-Step

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Mở `/races/{raceId}`, tab Vé active | Fetch song song forecast + heatmap + summary(đã có) | useEffect on mount | loading skeleton 3 card |
| 2 | Data về | 3 card render charts; nếu race ended → forecast ẩn projection/target | setState | data state |
| 3 | Forecast chưa có target | Card forecast hiện ô input "Mục tiêu vé" rỗng + nút "Lưu" + chart KHÔNG có đường target | render | target=null |
| 4 | BTC gõ số vào ô target → click "Lưu" | Nút → loading "Đang lưu…"; PUT target; on success → refetch forecast → chart vẽ đường target | onClick → mutation | target set |
| 5 | Hover điểm trên PaceChart | Tooltip hiện ngày + vé lũy kế | onMouseMove | tooltip |
| 6 | Hover cell heatmap | Outline magenta + (cell đã hiện số) | onMouseEnter | highlight |
| 7 | Toggle VI/EN (topbar đã có) | Mọi label 3 chart đổi ngôn ngữ; data (số) giữ nguyên | useLang | lang switched |

### 2.4 Buttons Specification

| Button label | Position | Default | Disabled | Loading | Action | Confirm? |
|--------------|----------|---------|----------|---------|--------|----------|
| "Lưu" (target) | Card Forecast header phải | Primary blue sm | Khi input rỗng hoặc == giá trị đã lưu | "Đang lưu…" spinner | PUT `/api/merchant-portal/ticket-sales/target` | NO |

### 2.5 Form Fields Specification

| Field | UI label | Type | Required | Validation | Error message | Default |
|-------|----------|------|----------|------------|---------------|---------|
| `target` | "Mục tiêu vé" (vi) / "Ticket target" (en) | number | ⚪ | integer ≥ 0, ≤ 10000000 | "Mục tiêu phải là số nguyên 0–10.000.000" | giá trị đã lưu hoặc rỗng |

### 2.6 Field source table

| Field UI | Data source | Format | Empty state |
|----------|-------------|--------|-------------|
| Đường lũy kế | `forecast.cumulative[].value` | mp-data num | chart EmptyState nếu `[]` |
| Đường dự báo | `forecast.projectedValue` @ `projectionDate` | num | ẩn nếu null (race ended) |
| Đường mục tiêu | `forecast.target` | num | ẩn nếu null |
| Insight forecast | computed FE: so projectedValue vs target | text VI/EN | "Chưa đủ dữ liệu dự báo" nếu cumulative<8 điểm |
| Heatmap cell | `heatmap.grid[dow][bucket]` | num | "0" |
| Funnel stage/stat | derive từ `summary.byStatus[].orderCount` | num + % | "0 / 0%" |

### 2.7 UI States (mỗi chart card)
- **Loading:** skeleton box cao ~250px (animate-pulse) per card.
- **Empty:** EmptyState icon + "Chưa có dữ liệu đăng ký cho giải này".
- **Data:** chart render.
- **Error fetch:** card đỏ + message VN (extractMsg) + nút "Thử lại" (refetch riêng nhóm analytics, không vỡ block F-069 phía trên).
- **Target submitting:** nút loading, input disable.
- **Target success:** toast green "Đã lưu mục tiêu" + chart vẽ lại đường target.
- **Target validation error:** input viền đỏ + error text dưới ô.
- **Race ended:** forecast card hiện badge nhỏ "Giải đã kết thúc — chỉ hiện lũy kế thực tế", ẩn projection/target/ô input.

---

## 🛠️ Phase 3 — Technical Mandates

### 3.1 DB / Cache
- **MongoDB MỚI:** collection `merchant_race_target` (Mongoose schema mới trong merchant-portal module).
  - Fields: `raceId: number` (unique index), `target: number`, `updatedBy: string` (Logto userId), timestamps.
  - 🛑 **PAUSE Manager:** collection MỚI (không migration data — empty start, upsert dần). Confirm OK.
- **Redis:** `merchant-portal:forecast:<raceId>` TTL 300s, `merchant-portal:heatmap:<raceId>` TTL 300s. PUT target → `redis.del('merchant-portal:forecast:'+raceId)`.
- **MySQL platform:** READ-ONLY aggregate trên `order_metadata` (đã dùng). Cần index `(race_id, payment_on)` — verify EXPLAIN (đã có ở getTrend, reuse).

### 3.2 Backend Endpoint Specs

**Endpoint 1 — Forecast**
| Element | Spec |
|---------|------|
| Method | GET |
| Path | `/api/merchant-portal/ticket-sales/forecast` |
| Auth | `@UseGuards(LogtoMerchantGuard)` (class-level, đã có) |
| Query | `raceId: number` (required) |
| Response DTO | `TicketForecastDto` |
| Status codes | 200 / 400 (raceId thiếu/sai) / 401 / 403 (IDOR assertRaceForUser) / 500 |
| Side effects | Redis read-through cache `merchant-portal:forecast:<raceId>` TTL 300s |

**Endpoint 2 — Heatmap**
| Element | Spec |
|---------|------|
| Method | GET |
| Path | `/api/merchant-portal/ticket-sales/heatmap` |
| Auth | `@UseGuards(LogtoMerchantGuard)` |
| Query | `raceId: number` (required) |
| Response DTO | `TicketHeatmapDto` |
| Status codes | 200 / 400 / 401 / 403 / 500 |
| Side effects | Redis cache `merchant-portal:heatmap:<raceId>` TTL 300s |

**Endpoint 3 — Set Target (WRITE)**
| Element | Spec |
|---------|------|
| Method | PUT |
| Path | `/api/merchant-portal/ticket-sales/target` |
| Auth | `@UseGuards(LogtoMerchantGuard)` (ticket-scope, KHÔNG finance) |
| Body DTO | `SetTicketTargetDto` |
| Response DTO | `TicketTargetDto` |
| Status codes | 200 / 400 (validation) / 401 / 403 (assertRaceForUser) / 500 |
| Side effects | Mongo upsert `merchant_race_target`; Redis DEL `merchant-portal:forecast:<raceId>` |

### 3.3 DTO Field-Level Spec

```typescript
// dto/ticket-charts.dto.ts (EXTEND file hiện có)
export class TicketForecastPointDto {
  @ApiProperty({ description: 'Ngày (YYYY-MM-DD)' }) date!: string;
  @ApiProperty({ description: 'Vé lũy kế tới hết ngày này' }) value!: number;
}
export class TicketForecastDto {
  @ApiProperty({ type: [TicketForecastPointDto] }) cumulative!: TicketForecastPointDto[];
  @ApiProperty({ description: 'Vé dự báo về ngày đua (null nếu race ended hoặc <8 điểm dữ liệu)', nullable: true })
  projectedValue!: number | null;
  @ApiProperty({ description: 'Ngày đua = races.event_start_date (ISO, null nếu thiếu)', nullable: true })
  projectionDate!: string | null;
  @ApiProperty({ description: 'Tốc độ vé/ngày 7 ngày gần nhất' }) recentDailyRate!: number;
  @ApiProperty({ description: 'Mục tiêu BTC nhập (null nếu chưa set)', nullable: true }) target!: number | null;
  @ApiProperty({ description: 'true nếu race COMPLETE/CANCEL hoặc đã qua ngày đua' }) raceEnded!: boolean;
}

export class TicketHeatmapDto {
  @ApiProperty({ description: 'Nhãn 7 dòng thứ trong tuần (Mon..Sun)', type: [String] }) dayLabels!: string[];
  @ApiProperty({ description: 'Nhãn 7 cột khung giờ (giờ VN)', type: [String] }) bucketLabels!: string[];
  @ApiProperty({ description: 'grid[dayIndex][bucketIndex] = số đơn paid', type: 'array', items: { type: 'array', items: { type: 'number' } } })
  grid!: number[][];
  @ApiProperty({ description: 'Giá trị cell lớn nhất (để FE scale màu)' }) max!: number;
}

export class SetTicketTargetDto {
  @ApiProperty({ description: 'MySQL race_id' }) @Type(() => Number) @IsInt() @Min(1) raceId!: number;
  @ApiProperty({ description: 'Mục tiêu vé (0 = xoá mục tiêu)' })
  @Type(() => Number) @IsInt() @Min(0) @Max(10_000_000, { message: 'Mục tiêu phải là số nguyên 0–10.000.000' })
  target!: number;
}
export class TicketTargetDto {
  @ApiProperty() raceId!: number;
  @ApiProperty({ nullable: true }) target!: number | null;
}
```

### 3.4 SQL Spec (Coder dùng named conn 'platform', parameterized `?`)

**Forecast (daily counts → FE/BE cumsum):**
```sql
SELECT DATE(om.payment_on) AS d, COUNT(DISTINCT om.id) AS n
FROM order_metadata om
WHERE om.race_id = ? AND om.deleted = 0 AND om.financial_status = 'paid'
  AND om.payment_on IS NOT NULL
GROUP BY d ORDER BY d ASC
```
→ BE running-sum thành cumulative. `eventStartDate` + `status` lấy từ races (reuse query của getRaces / 1 query nhỏ `SELECT event_start_date, status FROM races WHERE id=?`). `daysToRace`, projection theo BR-70-05/06.

**Heatmap (giờ VN, BR-70-10):**
```sql
SELECT DAYOFWEEK(DATE_ADD(om.payment_on, INTERVAL 7 HOUR)) AS dow,   -- 1=CN..7=T7 (MySQL)
       HOUR(DATE_ADD(om.payment_on, INTERVAL 7 HOUR)) AS hr,
       COUNT(DISTINCT om.id) AS n
FROM order_metadata om
WHERE om.race_id = ? AND om.deleted = 0 AND om.financial_status = 'paid'
  AND om.payment_on IS NOT NULL
GROUP BY dow, hr
```
→ BE map dow MySQL(1=Sun..7=Sat) → grid row Mon..Sun; hr → 7 bucket [0-6,6-9,9-12,12-15,15-18,18-21,21-24].

### 3.5 Frontend
- **Client components** (đã "use client"). Chart SVG hand-rolled port từ mockup `mp-analytics.jsx` (AnPace, AnHeatmap, AnFunnel) + `mp-charts.jsx` → `merchant/src/components/mp/charts.tsx`. Đổi `MP.fmt`→`fmt`, `I.`→`Icons`, mock data→props từ SDK.
- **SDK:** sau khi backend đổi DTO → `cd merchant && pnpm generate:api` (hoặc regenerate từ admin rồi copy như F-069 UI). SDK functions: `merchantPortalControllerGetForecast`, `...GetHeatmap`, `...SetTarget`.
- **Data flow:** trong races/[raceId] page, fetch forecast+heatmap song song với các call hiện có; funnel derive từ summary đã fetch. Target PUT → on success refetch forecast.
- Label VI/EN thêm vào `lib/mp/i18n.ts` DICT.

### 3.6 PAUSE flags
- 🛑 **Manager:** MongoDB collection MỚI `merchant_race_target` (không migration, empty-start upsert). Confirm.
- 🛑 **Manager:** WRITE endpoint đầu tiên cho merchant user (portal read-only trước giờ) — review security (assertRaceForUser bắt buộc).
- 🟢 KHÔNG `pnpm install` dep mới (charts hand-rolled SVG).
- 🟢 KHÔNG đụng fee/financial logic.

---

## 🛡️ Phase 4 — Testing Mandates

### 4.1 Backend TC

#### TC-01 Forecast happy path
| Element | Value |
|---------|-------|
| Method/URL | GET `/api/merchant-portal/ticket-sales/forecast?raceId=<accessibleRaceId>` |
| Headers | merchant session token (role merchant_viewer) |
| Expected status | 200 |
| Expected shape | `{cumulative:[{date,value}], projectedValue:number|null, projectionDate, recentDailyRate, target:null, raceEnded:false}` |
| MUST NOT leak | tiền (gmv/fee/price), `_id` raw |
| Side effect | Redis key `merchant-portal:forecast:<raceId>` set |

#### TC-02 Forecast race ended → projectedValue null
Race status COMPLETE → `raceEnded:true`, `projectedValue:null`, target ẩn (vẫn trả target value nếu set nhưng FE ẩn).

#### TC-03 Heatmap happy path
GET heatmap → 200, `grid` 7×7 number[][], `dayLabels` 7, `bucketLabels` 7, `max` = max cell. Verify timezone: 1 đơn paid tại payment_on='2026-01-01 16:30:00'(UTC, =23:30 VN T5) → grid[Thu][21-24] += 1.

#### TC-04 Target set + forecast reflect
PUT target {raceId, target:5000} → 200 `{raceId, target:5000}`; Mongo có doc; Redis forecast key DEL'd; GET forecast → `target:5000`.

#### TC-05 Target=0 xoá mục tiêu
PUT {target:0} → Mongo target=0; GET forecast → `target:null` (BR-70-09: 0 ⇒ null hiệu lực FE ẩn). (Coder chốt: lưu 0 hoặc xoá doc — output forecast.target=null khi 0.)

#### TC-06 Validation: target âm / quá lớn
PUT {target:-5} → 400; PUT {target:20000000} → 400 message "Mục tiêu phải là số nguyên 0–10.000.000".

#### TC-07 Auth 401
GET forecast/heatmap + PUT target không token → 401.

#### TC-08 IDOR 403
User chỉ có access race A → GET forecast?raceId=<raceB ngoài access> → 403 (assertRaceForUser). PUT target raceB → 403.

#### TC-09 Empty data
Race không đơn paid → forecast cumulative `[]`, projectedValue null, heatmap grid toàn 0 max 0. KHÔNG 500.

#### TC-10 Concurrent target write (race condition)
2 PUT đồng thời cùng raceId khác target → upsert idempotent, 1 giá trị cuối thắng, không duplicate doc (unique index raceId). Promise.all assert.

**Min coverage:** mỗi endpoint ≥ happy + 400 + 401 + 403 + empty. Forecast thêm boundary (race ended, <8 điểm → projectedValue null). Heatmap thêm timezone-correctness test (TC-03). Unit test service methods mock model/datasource.

### 4.2 Frontend E2E (Playwright — QC viết)
| TC | Persona | Journey | Expected |
|----|---------|---------|----------|
| E2E-01 | merchant_viewer | Mở race tab Vé | 3 chart MKT render (forecast/heatmap/funnel) |
| E2E-02 | merchant_viewer | Nhập target 5000 → Lưu | Toast "Đã lưu mục tiêu", đường target xuất hiện |
| E2E-03 | merchant_viewer | Toggle EN | Label 3 chart đổi sang tiếng Anh, số giữ nguyên |
| E2E-04 | merchant_viewer | Race ended | Forecast ẩn projection/target, badge "Giải đã kết thúc" |

### 4.3 Security Checks
- [ ] 3 endpoint `@UseGuards(LogtoMerchantGuard)` — 401 khi no token.
- [ ] IDOR: `assertRaceForUser` trên CẢ 3 endpoint (kể cả PUT target) — 403 cross-race.
- [ ] Response 3 chart KHÔNG leak tiền (gmv/fee/price/total_price) — grep assert trong test.
- [ ] SQL parameterized (raceId qua `?`, KHÔNG string interpolation).
- [ ] Target write KHÔNG cho set raceId ngoài access (assertRaceForUser TRƯỚC upsert).

### 4.4 Performance SLA
- Forecast p95 < 800ms cold / < 50ms cache hit.
- Heatmap p95 < 800ms cold / < 50ms cache hit.
- Target PUT p95 < 200ms.
- 10x flaky: TC-03 timezone determinism + TC-10 concurrent target.

---

## 📌 Answers to Manager's PAUSE conditions (file 00)
1. **Forecast target** → BTC tự nhập (BR-70-07/08/09), store Mongo `merchant_race_target`, chưa set ⇒ ẩn đường target.
2. **Race ended** → BR-70-06: ẩn projection + target, chỉ lũy kế thực tế.
3. **Heatmap timezone** → BR-70-10: payment_on UTC → +7h (verified DB tz=UTC, peak 14-16h UTC=21-23h VN).
4. **Period/granularity** → forecast FULL pre-race window; heatmap FULL history; funnel toàn-giải (BR-70-04/11/12).
5. **Funnel stages** → BR-70-12: derive FE từ summary byStatus (confirmed=paid, pending, dropped=voided +cancelled/refunded), 2 stage + 3 stat, không tiền.

---

## ✅ Status: 🔵 READY
## 🔗 Next: Danny chạy `/5bib-plan FEATURE-070-merchant-advanced-mkt-analytics`
