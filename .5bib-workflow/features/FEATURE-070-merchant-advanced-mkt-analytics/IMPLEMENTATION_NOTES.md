# FEATURE-070 — Implementation Notes (Reviewer's Guide)

## Section 1: 🚧 Deviations from Spec (intentional)

- **[Deviation #1] Heatmap labels trả từ backend thay vì FE tự build**
  - **Spec said:** PRD 3.3 TicketHeatmapDto có `dayLabels`/`bucketLabels`; PRD ngụ ý FE localize.
  - **I did:** Backend trả `dayLabels=['T2'..'CN']` + `bucketLabels=['0-6'..'21-24']` cố định; FE render thẳng (bucket labels là số giờ, không cần dịch; day labels FE có thể override theo lang nếu muốn nhưng hiện dùng nguyên).
  - **Why:** Bucket boundaries là nguồn sự thật ở backend (gắn với SQL HOUR bucketing) — trả kèm tránh FE/BE lệch định nghĩa khung giờ.
  - **Reviewer check:** FE có localize day labels theo EN không (Mon..Sun) — hiện chấp nhận T2..CN cho cả 2 lang (số giờ universal).

- **[Deviation #2] target=0 lưu 0 trong Mongo (không xoá doc)**
  - **Spec said:** BR-70-09 "0 = xoá mục tiêu (target=null hiệu lực)".
  - **I did:** Upsert lưu `target:0`, nhưng `setTicketTarget` output + `getTicketForecast.target` đều trả `null` khi giá trị lưu là 0.
  - **Why:** Giữ doc (updatedBy/updatedAt) để audit BTC từng đặt rồi xoá; FE thấy null ⇒ ẩn target line — đúng hành vi mong muốn.
  - **Reviewer check:** GET forecast sau PUT target=0 → target=null (TC-05 verify).

## Section 2: ⚙️ Forced Changes (reality ≠ spec)

- **[Forced #1] races PK = `race_id` KHÔNG phải `id`**
  - **PRD assumed:** 3.4 SQL `SELECT event_start_date, status FROM races WHERE id=?`.
  - **Reality:** Platform races table PK là `race_id` (bigint) — existing `resolveAccessibleRaces` đã dùng `WHERE r.race_id IN (...)`. Dùng `id` sẽ trả 0 row → forecast silent-break.
  - **Workaround:** `WHERE race_id = ? LIMIT 1`.
  - **Manager/BA action:** Note vào codebase-map: races PK = race_id (PRD lần sau đừng assume `id`).

- **[Forced #2] userId qua `@CurrentUser() user: LogtoUser` decorator**
  - **PRD assumed:** task text nhắc `req.user.userId`.
  - **Reality:** Codebase dùng decorator `@CurrentUser()` cho mọi route merchant.
  - **Workaround:** Mirror decorator → `user.userId`.

- **[Forced #3] Funnel summary field = `financialStatus` (không `status`)**
  - **PRD assumed:** BR-70-12 nói byStatus `status`.
  - **Reality:** TicketStatusCountDto field tên `financialStatus`; summary có `totalOrders` ở root.
  - **Workaround:** FE map `financialStatus` + dùng `summary.totalOrders`.

## Section 3: ⚖️ Tradeoffs Considered

| Decision | Chosen | Alternative | Why | Cost paid |
|----------|--------|-------------|-----|-----------|
| Cumulative sum | In-process running-sum sau 1 SQL daily-count | SQL window `SUM() OVER` | Đơn giản, debug dễ, <120 điểm nhẹ | ~vài ms CPU, không đáng |
| Projection model | Linear rate 7 ngày × daysToRace | Curve-fit/seasonal | MVP, khớp mockup, dễ giải thích cho BTC | Kém chính xác cuối mùa — mitigate bằng disclaimer |
| Heatmap TZ | Hardcode `+ INTERVAL 7 HOUR` | CONVERT_TZ (cần tz table MySQL) | tz table thường chưa load trên MySQL prod; toàn giải VN | Không hỗ trợ tenant ngoài GMT+7 (chấp nhận) |
| Funnel | Derive frontend từ summary | Endpoint mới | 0 call thêm, summary đã fetch | Logic mapping ở FE (test E2E cover) |
| Target store | Mongo collection riêng + unique raceId | Field trên merchant_portal_access | Target per-RACE không per-user; nhiều BTC chung 1 race share target | +1 collection nhỏ |

## Section 4: 🔬 Reviewer Notes

### Files review kỹ (priority)
1. **`services/merchant-portal.service.ts`** — `getTicketForecast` (cumsum + projection + raceEnded logic BR-70-05/06), `getTicketHeatmap` (DOW map MySQL 1=Sun→Mon-first grid + +7h), `setTicketTarget` (assertRaceForUser TRƯỚC upsert + cache del).
2. **`merchant-portal.controller.ts`** — 3 route @ApiResponse codes + @CurrentUser + guard (ticket-scope, KHÔNG finance).
3. **`schemas/merchant-race-target.schema.ts`** — unique index raceId.
4. **`merchant/src/app/races/[raceId]/page.tsx`** — saveTarget validation (0–10M) + isolated analytics error state + raceEnded hide input.
5. **`merchant/src/components/mp/charts.tsx`** — PaceChart projection/target line conditional render; Funnel derive mapping.

### Concurrency hotspots
- `setTicketTarget` upsert — unique index `raceId` + findOneAndUpdate atomic → concurrent PUT idempotent (TC-10/Attack verify, 10x stable).

### Edge cases tested vs deferred
- ✅ Tested: timezone +7h, race-ended null, empty, <8pts, IDOR 403, target 0→null, concurrent, poisoned cache.
- ⚠️ Deferred: seasonal projection, per-tenant TZ, target audit log (non-blocking, ghi tech debt).

### Type safety narrowed casts (Manager grep `as unknown as`)
- Raw `this.db.query` rows narrowed to `{ d: string; n: number }` / `{ dow:number; hr:number; n:number }` row shapes — không `any`.

### Security checklist self-applied
- [x] 3 endpoint `@UseGuards(LogtoMerchantGuard)` (class-level) — 401 no token
- [x] assertRaceForUser cả 3 (kể cả PUT trước upsert) — IDOR 403
- [x] SQL parameterized 100% (`?` placeholders, 0 `${}` interpolation)
- [x] Response 0 tiền (grep gmv/fee/price assert trong test)
- [x] Cache key namespace `merchant-portal:*` đúng registry

### Performance
- forecast/heatmap: 1-2 SQL aggregate + cache TTL 300s read-through. Cold p95 mục tiêu <800ms (race ≤6K đơn, 49-nhóm heatmap nhẹ).
