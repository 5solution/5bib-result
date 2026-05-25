# FEATURE-062: Nâng cấp Sales Analytics Dashboard

**Status:** 🟡 INITIATED
**Created:** 2026-05-24
**Renumbered:** 2026-05-22 (Manager) — F-060 → F-062 vì F-060 đã chiếm bởi `FEATURE-060-seo-landing-uplift/` (merged main `e7284b0` 2026-05-24/25), và F-061 = `split-payment-ref-ordinary` (ship `c4a736f`). Counter desync trong `feature-log.md` (still says "Next: F-057") sẽ sync trong `/5bib-deploy`.
**Owner:** Danny
**Type:** EXTEND_EXISTING
**Supersedes:** F-039 (Analytics Per-Event/Per-Day Enhancement — stale 2026-05-15, scope mở rộng hơn)

---

## 🎯 Tại sao feature này

Danny muốn xem performance bán hàng **theo ngày / tuần / tháng**, biết đơn hàng **thuộc giải nào**, xem **lưu lượng vào ra** (order funnel), và **so sánh giữa các kỳ** (period-over-period) để đưa ra phân tích chiến lược. Hiện tại F-059 Dashboard chỉ có 4 KPI cards + sparkline 30 ngày, còn F-026 Analytics module có daily revenue + top races + funnel nhưng **thiếu aggregation tuần/tháng, thiếu so sánh WoW/MoM/YoY rõ ràng, và thiếu actionable insight panel**.

### Bối cảnh cạnh tranh (theo Strategic Scout research 2026-05-24)

- **RunSignup** (Mỹ) — chuẩn vàng: RaceInsights engine, YoY comparison theo registration period, custom source tracking (UTM → ROI), loyalty report, revenue by sub-event.
- **Eventbrite** — tốt nhất về traffic attribution: traffic & conversion report với funnel rõ ràng, real-time mobile dashboard, tích hợp GA4 native.
- **RaceRoster** (Canada) — multi-event overview: tất cả events trong 1 màn hình, payout period reporting.
- **ActiUp.net & iRace.vn** (VN) — cả hai **chưa có analytics dashboard thực sự** cho BTC (organizer). Đây là cửa sổ 12–18 tháng để 5BIB chiếm lợi thế.

### Tư vấn Biz Strategist (2026-05-24)

- Dashboard phải trả lời 3 câu hỏi: **Bao nhiêu tiền? Từ đâu? Xu hướng ra sao?**
- "Lưu lượng" nên hiểu là **Order Funnel** (đã có endpoint `/analytics/funnel`), KHÔNG phải web analytics (đã có GA4 F-041).
- Cần **normalized metrics**: GMV per active race, orders per race — tách performance platform ra khỏi noise số lượng race.
- Cần **actionable insight panels**: races cần attention (bán chậm), merchant health score, revenue breakdown by order type.
- Phân 3 phase: MVP (2-3 tuần) → Actionable Layer (3-5 tuần) → Advanced (>6 tuần).

---

## 📂 Impact Map (theo memory + code thực tế)

### Module sẽ chạm

#### Backend
- `backend/src/modules/analytics/` — **mở rộng chính**. Đã có: overview, daily revenue, top races, race performance, race detail, merchant comparison, runner behavior, booking patterns, funnel, repeat athlete, merchant churn, time-to-fill, claim rate, geo-demo, refund-cancel, discrepancy check (F-058).
  - **Thêm:** weekly/monthly aggregation endpoint, WoW/MoM/YoY comparison logic, top races by orders (not just GMV), normalized metrics (GMV/race, orders/race), actionable alerts endpoint.
  - **Sửa:** `analytics.service.ts` — thêm method `getWeeklyRevenue()`, `getMonthlyRevenue()`, `getTopRacesByOrders()`, `getRacesNeedAttention()`.
  - **Sửa:** `period-resolver.ts` — mở rộng `PeriodKind` thêm `'weekly'` | `'monthly'` nếu chưa có.
  - **Sửa/Thêm:** DTO mới cho weekly/monthly response + comparison response.

- `backend/src/modules/dashboard/` — **có thể mở rộng nhẹ**. F-059 đã có KPI cards + sparklines. Có thể thêm "sales summary widget" vào dashboard chính hoặc giữ nguyên và nâng cấp analytics page.

#### Admin Frontend
- `admin/src/app/(dashboard)/analytics/page.tsx` — **refactor chính**. Hiện có overview. Cần thêm:
  - Tabs/selector cho daily/weekly/monthly granularity
  - Chart revenue + orders theo granularity đã chọn
  - Period-over-period comparison panel (MoM, WoW, YoY toggle)
  - Top races table mở rộng (by GMV + by orders, có drill-down)
  - "Races cần attention" alert panel
- `admin/src/app/(dashboard)/analytics/components/PeriodCompareSelector.tsx` — mở rộng thêm WoW/MoM/YoY options
- `admin/src/app/(dashboard)/analytics/races/page.tsx` — có rồi, cần nâng cấp UI
- `admin/src/app/(dashboard)/analytics/merchants/page.tsx` — có rồi, thêm merchant health score
- `admin/src/app/(dashboard)/analytics/funnel/page.tsx` — có rồi, nâng cấp visual (funnel chart thay vì table)

### File then chốt cần đọc trước khi code

| File | Vai trò |
|------|---------|
| `backend/src/modules/analytics/analytics.service.ts` | Service chính F-026 — tất cả aggregation pipeline |
| `backend/src/modules/analytics/services/period-resolver.ts` | Period logic hiện tại (PeriodKind, CompareKind) |
| `backend/src/modules/analytics/dto/analytics-query.dto.ts` | Query params hiện tại |
| `backend/src/modules/dashboard/services/kpi.service.ts` | F-059 KPI cards logic + fee cascade |
| `backend/src/modules/dashboard/services/sparkline.service.ts` | F-059 sparkline 30d logic |
| `admin/src/app/(dashboard)/analytics/page.tsx` | Analytics overview UI hiện tại |
| `admin/src/app/(dashboard)/analytics/components/PeriodCompareSelector.tsx` | Period compare UI hiện tại |

### Endpoint liên quan (đã có)

| Endpoint | Dùng trong |
|----------|-----------|
| `GET /analytics/overview` | Overview page — GMV, orders, platform fee, vs last month |
| `GET /analytics/revenue/daily` | Daily revenue chart |
| `GET /analytics/top-races` | Top races by GMV |
| `GET /analytics/revenue-by-category` | Revenue by order type (ORDINARY/MANUAL/GROUP_BUY) |
| `GET /analytics/races` | Race performance list (paginated) |
| `GET /analytics/races/:raceId/detail` | Per-race drill-down |
| `GET /analytics/merchants` | Merchant comparison |
| `GET /analytics/runners/behavior` | Runner behavior stats |
| `GET /analytics/runners/booking-patterns` | Booking heatmap 7×24 |
| `GET /analytics/funnel` | Order funnel (paid/voided/avg time) |
| `GET /analytics/repeat-athlete-rate` | F-026 repeat athlete |
| `GET /analytics/merchant-churn` | F-026 merchant churn |
| `GET /admin/dashboard/kpi` | F-059 KPI MTD cards |
| `GET /admin/dashboard/sparklines` | F-059 sparkline 30d |

### Endpoint MỚI (dự kiến)

| Endpoint | Mục đích |
|----------|---------|
| `GET /analytics/revenue/weekly` | Weekly revenue aggregation |
| `GET /analytics/revenue/monthly` | Monthly revenue aggregation |
| `GET /analytics/top-races-by-orders` | Top races by số đơn (không phải GMV) |
| `GET /analytics/comparison` | Period-over-period: WoW/MoM/YoY cho all key metrics |
| `GET /analytics/normalized` | GMV/race, orders/race, AOV — normalized metrics |
| `GET /analytics/alerts/races-need-attention` | Races bán chậm cần push marketing |
| `GET /analytics/alerts/merchant-health` | Merchant health score (active/at-risk/churned) |

### Schema/DB

- **MongoDB:** Collection `orders` — query chính cho aggregation pipeline. Đã dùng trong F-026. Không cần field mới.
- **MySQL platform:** Bảng `orders` (named connection `'platform'`) — cross-reference race info. Đã dùng trong F-026/F-028/F-040.
- **Redis:**
  - Có: `dashboard:kpi:mtd` (60s), `dashboard:sparkline:30d` (3600s)
  - Thêm: `analytics:weekly:<sha256>` (300s), `analytics:monthly:<sha256>` (600s), `analytics:comparison:<sha256>` (300s), `analytics:alerts:races:<sha256>` (300s)
  - Invalidation: port pattern F-026 — `analytics:*` flush via `scanStream` khi admin write order.

---

## ⚠️ Risk Flags

### 🔴 HIGH
- **Chạm fee calculation logic.** Comparison view cần hiện phí 5BIB thật — phải dùng `FeeService.computeFeeForOrdersAggregate()` (F-040 4-tier cascade). Nếu BA không mandate dùng đúng service → dashboard show số sai (lặp lại bug F-059 trước F-040).
- **Performance aggregation lớn.** Monthly aggregation trên 42K+ orders + cross-DB MySQL join → phải dùng MongoDB aggregation pipeline + Redis cache. Không được dùng in-memory sort/filter cho dataset lớn (lesson TD-F038-MONGO-SORT).

### 🟡 MEDIUM
- **Period-resolver mở rộng.** `period-resolver.ts` hiện support `PeriodKind` + `CompareKind` — cần mở rộng thêm weekly/monthly/YoY mà không break 6 endpoint F-026 đang dùng nó.
- **Admin UI complexity.** Thêm nhiều chart + table + comparison → cần responsive design + skeleton loading. F-026 đã có ExportButton (stub) — Phase 2 nên wire export thật.
- **Cache invalidation scope.** Thêm nhiều cache key mới `analytics:*` — phải đảm bảo invalidation hook cover hết mutation sites (lesson F-040: 7 sites grep verify).
- **TD-F026-CACHE-INVALIDATE** đang tồn tại — analytics cache hiện KHÔNG bị invalidate khi admin write, chỉ rely cron 1h. Feature mới nên fix luôn hoặc accept risk với TTL ngắn hơn.

### 🟢 LOW
- **GA4 integration.** Danny đề cập "lưu lượng" — nếu cần embed GA4 vào admin dashboard thì scope phình. Biz Strategist khuyên KHÔNG build web analytics, dùng GA4 đã có (F-041). Chỉ cần order funnel.
- **Normalized metrics (GMV/race).** Tính toán đơn giản nhưng cần define rõ "active race" — race có `status = 'live'` hay bao gồm `'ended'` trong period?

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

1. **"Lưu lượng" nghĩa là gì chính xác?** Biz Strategist khuyên = order funnel (đã có `/analytics/funnel`). Hay Danny muốn embed GA4 vào admin? Hay muốn xem page views của public frontend từ GA4 API?
2. **Scope Phase 1 MVP bao gồm gì?** Biz Strategist đề xuất: orders over time (daily/weekly/monthly toggle) + GMV/Net Revenue cùng time dimension + MoM comparison + top 10 races + merchant active count. Danny có đồng ý?
3. **"So sánh" cụ thể là gì?** WoW (tuần này vs tuần trước), MoM (tháng này vs tháng trước), YoY (tháng này vs cùng tháng năm trước) — Danny muốn cả 3 hay chỉ MoM?
4. **Actionable alerts Phase 1 hay Phase 2?** "Races cần attention" (bán chậm) + "Merchant health score" — nên đưa vào MVP hay delay?
5. **Dashboard vs Analytics page?** Nâng cấp ngay trên `/analytics` page hay muốn widget tóm tắt trên `/dashboard` chính?

---

## 📊 Phân phase (đề xuất từ Biz Strategist, Manager đồng ý)

### Phase 1 — ALL-IN (Danny quyết 2026-05-24: "Làm cả đi" + "Làm luôn")
- Orders over time chart: daily/weekly/monthly toggle
- GMV + Net Revenue + Platform Fee theo cùng time dimension
- WoW + MoM + YoY comparison — cả 3 loại, toggle trên cùng 1 UI
- Top 10 races by GMV VÀ by orders
- "Races Cần Attention" alert panel (bán chậm cần push marketing)
- Merchant Health Score (active/at-risk/churned)
- Order Funnel visualization upgrade (chart thay vì data table)
- Merchant active count (30/60/90 ngày)
- Export CSV/Excel thật (fix TD-F026-EXPORT-STUB)
- **GA4 embed/integration** vào admin analytics (Danny hỏi "Embed GA4 được à?" → CÓ, dùng GA4 Data API backend-side, KHÔNG iframe)
- **Redesign layout** analytics page: sắp xếp lại biểu đồ cho logic hơn (Danny: "mấy cái biểu đồ hơi ngơ ngơ về vị trí")
- **PRD kèm Design spec** cho Claude Design redesign UI/UX

### Phase 2 — Advanced (đánh giá lại sau Phase 1)
- Normalized metrics (GMV/race, orders/race, AOV trend)
- Revenue concentration warning (top 5 races = X% revenue)
- Revenue breakdown by order type trend (MANUAL vs ORDINARY shift)
- Booking patterns trend (peak hour shift detection)

---

## 📸 Danny PAUSE Answers (2026-05-24)

1. **"Lưu lượng"**: GA4 embed ĐƯỢC — Danny muốn. Dùng GA4 Data API backend, không iframe.
2. **Phase 1 MVP**: Đồng ý scope.
3. **So sánh**: Làm CẢ 3 (WoW + MoM + YoY).
4. **Actionable alerts**: Làm LUÔN Phase 1.
5. **Vị trí**: Làm trên `/analytics` page.
6. **BONUS**: Sắp xếp lại layout biểu đồ analytics hiện tại (Danny thấy "ngơ ngơ").
7. **BONUS**: Viết PRD kèm Design spec cho Claude Design redesign layout.
8. **Reference**: Danny cung cấp 2 screenshots — ActiUp Workspace dashboard + 5BIB Organizer dashboard hiện tại.

### Screenshot Analysis — ActiUp Workspace Dashboard
- 4 KPI cards (gradient xanh): Tổng doanh thu, Tổng đơn hàng, Tổng số vé, Tổng doanh thu thuần — kèm delta % so kỳ trước (↓80%, ↓79%, ↓81%, ↓80%)
- Date range picker: 01/01/2026 - 31/12/2026
- Events table: STT, Sự kiện, Tổng doanh thu, Đơn hàng, Số vé, Giảm giá, Ưu đãi công TT, Doanh thu thực, Trạng thái (badge)
- Revenue + ticket chart: monthly, 3 line (doanh thu gộp, doanh thu thuần, số lượng vé) — dual Y-axis
- Sidebar: Dashboard, Sự kiện, Đơn hàng, Người tham dự, Tổ chức, Khuyến mãi, Fipix, Check In
- **Điểm mạnh**: KPI cards rõ ràng, delta % rõ, table events có status badge, chart dual-axis
- **Điểm yếu**: Không có WoW/MoM/YoY toggle, không drill-down per-event, không có alerts

### Screenshot Analysis — 5BIB Organizer Dashboard (merchant-facing)
- Per-race view: "Giải Marathon Quốc Tế VTV LPBank 2026"
- KPI strip: Tổng doanh thu 381M, Tổng đơn hàng 713, Tổng số vé 1008, Tổng vé import 78
- Date filter + period buttons: Tất cả, Tháng này, Tháng trước, Tuần này, Tuần trước
- Revenue chart: line chart doanh thu theo thời gian (Vé + Doanh số)
- Athlete demographics: pie chart VĐV theo cự ly-giới tính + bar chart theo cự ly-độ tuổi
- Ticket by course: donut charts per distance (6.8KM, 12KM, 21KM)
- Top 10 VĐV by CLB: pie charts per distance
- Top 10 VĐV by tỉnh thành: horizontal bar chart
- Size áo table: STT, Size Áo, Cung đường, Giới tính, Số lượng — có Export file
- **Điểm mạnh**: Athlete demographics phong phú, per-course breakdown, size áo table hữu ích
- **Điểm yếu**: Layout rất dài (scroll 2600px), biểu đồ pie nhiều quá (6+), chart position "ngơ ngơ" Danny nhận xét, thiếu period comparison, thiếu actionable insights

### Manager Note cho BA
- Feature này scope LỚN hơn F-039. Danny muốn all-in Phase 1 nên BA cần viết PRD chi tiết.
- PRD phải kèm Design Spec section riêng cho Claude Design redesign layout.
- Lấy cảm hứng từ ActiUp KPI cards (rõ ràng, có delta %) nhưng VƯỢT QUA bằng WoW/MoM/YoY toggle + alerts.
- 5BIB Organizer dashboard là merchant-facing (per-race), khác với admin analytics (cross-race platform view). PRD phải phân biệt rõ.
- **GA4 Data API integration** là scope mới — BA cần nghiên cứu GA4 Reporting API v4 (betaGA4) response format.

---

## ✅ Sẵn sàng cho /5bib-prd

**CÓ — Danny đã xác nhận tất cả PAUSE conditions + mở rộng scope.**

---

## 📎 Tài liệu đính kèm (research)

### Strategic Scout Research (2026-05-24)
- RunSignup: RaceInsights, YoY comparison, UTM source tracking, loyalty report, revenue by event
- Eventbrite: traffic & conversion funnel, real-time mobile, GA4 native
- RaceRoster: multi-event overview, payout period reporting
- ActiUp/iRace: KHÔNG có analytics dashboard → cửa sổ competitive 12–18 tháng
- Gap lớn nhất: Runner Journey Analytics (result → re-register) — chỉ 5BIB có data này

### Biz Strategist Advisory (2026-05-24)
- KPI Framework: Revenue (GMV/net/fee/AOV) + Volume (orders/athletes/conversion) + Race Attribution (top by GMV/orders) + Trend (WoW/MoM/YoY)
- Period comparison ưu tiên: MoM → YoY → WoW (WoW nhiễu nhất)
- "Lưu lượng" = order funnel, KHÔNG build web analytics (đã có GA4)
- 3 actionable panels: Races Cần Attention + Merchant Health Score + Revenue by Order Type
- Dashboard đẹp mà team không dùng = sunk cost → MVP ra nhanh, đo adoption trước

### Memory Cross-reference
- F-059 KPI cards + sparklines: extend, không rebuild
- F-026 Analytics module: 16 endpoints đã có, mở rộng thêm weekly/monthly/comparison
- F-040 Fee cascade: BẮT BUỘC dùng cho revenue metrics (không dùng GMV raw)
- F-041 GA4: đã có cho frontend, KHÔNG cần duplicate trong admin
- TD-F026-EXPORT-STUB: export CSV/Excel là stub — Phase 2 fix
- TD-F026-CACHE-INVALIDATE: analytics cache không invalidate on write — cần fix hoặc accept
- TD-F016-FINANCE-01: 15 reconciliation cũ sai data — analytics PHẢI dùng F-040 fee cascade để tránh inherit sai
