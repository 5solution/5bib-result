# FEATURE-070: Merchant Portal — Advanced MKT Analytics (Forecast / Heatmap / Funnel)

**Status:** 🟡 INITIATED
**Created:** 2026-06-07
**Owner:** Danny
**Type:** EXTEND_EXISTING
**Created by:** 5bib-manager

---

## 🎯 Why this feature

Danny review UI merchant.5bib.com (F-069) đối chiếu mockup design 5Solution → 3 chart MKT analytics đã bị **OMIT** ở F-069 M4 (vì backend chưa có endpoint). Danny yêu cầu bổ sung để BTC/MKT có công cụ ra quyết định chiến dịch:
1. **Forecast / Pace** — lũy kế đăng ký + dự báo vé về ngày đua so với mục tiêu.
2. **Heatmap khung giờ vàng** — đăng ký theo thứ-trong-tuần × khung-giờ → lên lịch ads/email.
3. **Funnel chuyển đổi đơn** — tổng đơn → đã thanh toán + tỷ lệ pending/huỷ.

Mockup design (visual source of truth): `/tmp/5bib-merchant-template/` (mp-analytics.jsx `AnPace`/`AnHeatmap`/`AnFunnel` + mp-charts.jsx).

---

## 📂 Impact Map (theo memory + spot-check code thật)

### Module sẽ chạm
- `backend/src/modules/merchant-portal/` — thêm 2 endpoint read-only analytics (forecast + heatmap). KHÔNG đụng auth/fee/order-write.
- `merchant/src/` — port 3 chart từ mockup vào tab "Báo cáo bán vé" của race detail.

### File then chốt cần Coder đọc trước khi code
- `backend/src/modules/merchant-portal/services/merchant-portal.service.ts` — method `getTicketSalesTrend()` (L898, pattern bucket SQL + `resolvePeriod`), `getTicketSalesSummary()` (L463, byStatus cho funnel), `assertRaceForUser()` (L420, guard tenant scope), `bucketExpr()` (L861). Pattern SQL: `order_metadata om`, `om.payment_on`, `om.financial_status='paid'`, `om.deleted=0`, named connection `'platform'`.
- `backend/src/modules/merchant-portal/merchant-portal.controller.ts` — thêm 2 route (class `@UseGuards(LogtoMerchantGuard)` đã có; ticket-scope, KHÔNG finance).
- `backend/src/modules/merchant-portal/dto/ticket-charts.dto.ts` — thêm DTO forecast + heatmap (cùng file hoặc file mới).
- `merchant/src/app/races/[raceId]/page.tsx` — wire 3 chart vào Ticket tab.
- `merchant/src/components/mp/charts.tsx` — thêm chart components (PaceChart, Heatmap, Funnel) port từ mockup.
- `merchant/src/lib/mp/i18n.ts` — thêm label VI/EN cho 3 chart.

### Endpoint liên quan
- ➕ `GET /api/merchant-portal/ticket-sales/forecast?raceId=&...` — cumulative series + projection + target. Guard merchant (ticket).
- ➕ `GET /api/merchant-portal/ticket-sales/heatmap?raceId=` — grid 7×N (DAYOFWEEK × hour-bucket of `payment_on`). Guard merchant (ticket).
- (Funnel: KHÔNG cần endpoint — derive frontend từ `ticket-sales/summary` byStatus đã có.)

### Schema/DB
- MongoDB: KHÔNG đụng.
- MySQL platform (named conn `'platform'`): READ-ONLY aggregate trên `order_metadata` (đã dùng ở F-069). Heatmap: `COUNT(DISTINCT om.id) GROUP BY DAYOFWEEK(om.payment_on), HOUR(om.payment_on)`. Forecast: COUNT theo ngày `DATE(om.payment_on)` trong window tới ngày đua + race meta `event_start_date` (đã có ở races table dùng trong getRaces).
- Redis: thêm cache key `master:cc-...`? → theo registry F-069, propose `merchant-portal:forecast:<raceId>` + `merchant-portal:heatmap:<raceId>` TTL 300s (BA chốt TTL).

---

## ⚠️ Risk Flags

- 🟢 **LOW** — Read-only analytics, KHÔNG đụng fee/auth/order-write. Cùng pattern SQL aggregate đã proven ở F-069 (13 endpoint live, 152 test pass).
- 🟡 **MED** — **Forecast TARGET/CAPACITY**: spot-check chưa thấy field "registration target/capacity" trên races table. Cần BA chốt nguồn target (xem PAUSE). Nếu không có → projection vẫn vẽ được nhưng đường "Mục tiêu" phải heuristic hoặc ẩn.
- 🟡 **MED** — **Heatmap volume**: `GROUP BY DAYOFWEEK × HOUR` trên order_metadata theo raceId. Race lớn (6K+ đơn) vẫn nhẹ (49 nhóm). Cần index trên `(race_id, payment_on)` — verify EXPLAIN (đã có ở getTrend). SLA p95 < 800ms (cold).
- 🟢 **LOW** — Funnel: pure frontend từ data đã fetch (summary), 0 backend risk.

## 🧊 Known quirks (copy cho Coder)
- Vendor RaceResult quirk: `om.payment_on` có thể NULL cho đơn chưa thanh toán — forecast/heatmap chỉ tính `financial_status='paid'` nên payment_on luôn có giá trị. Vẫn phải `AND om.payment_on IS NOT NULL` defensive.
- 2-layer verify lesson (F-019): forecast projection là phép tính 5BIB tự derive (không trust vendor) → OK, không có vendor field tương ứng.
- Independent calc: projection = rate 7 ngày gần nhất × days-to-race (như mockup AnPace). Ghi rõ disclaimer "ước tính theo tốc độ 7 ngày".

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

- [ ] **Forecast target**: dùng nguồn nào? (a) field capacity/target trên races table nếu tồn tại — BA verify; (b) heuristic `ceil(current × 1.15)` server-side; (c) ẩn đường target, chỉ vẽ projection. → Danny/BA chốt.
- [ ] **Forecast khi race đã ENDED (COMPLETE)**: race đã kết thúc thì không còn "dự báo về ngày đua" — chỉ hiện đường lũy kế thực tế (ẩn projection + target)? BA chốt behavior theo race.status.
- [ ] **Heatmap timezone**: `payment_on` lưu UTC hay GMT+7? Heatmap "khung giờ vàng" phải theo giờ VN → cần `CONVERT_TZ` hoặc `+ INTERVAL 7 HOUR`. BA chốt (ảnh hưởng đúng/sai khung giờ).
- [ ] **Period/granularity**: forecast dùng full pre-race window (không theo PeriodSelector) hay theo period? Heatmap full-history hay theo period? (mockup: pace = full season, heatmap = full). BA chốt.
- [ ] **Funnel stages**: mockup chỉ 2 stage (Tổng đơn tạo → Đã thanh toán) + 3 stat (conversion/pending/cancel). Map byStatus: paid+completed=confirmed, pending=pending, voided+cancelled+refunded=dropped. BA xác nhận mapping với financial_status thật (hiện summary trả paid/voided/pending — có completed/refunded/cancelled không?).

---

## 🎯 Success criteria (gợi ý cho BA)
- 3 chart hiển thị trong tab "Báo cáo bán vé" với data thật tenant, song ngữ VI/EN, tooltip hover.
- Forecast: đường lũy kế thực tế + (projection + target nếu có) + insight text MKT.
- Heatmap: grid 7 ngày × khung giờ, màu đậm theo mật độ, theo giờ VN.
- Funnel: 2 stage bar + 3 stat % (conversion/pending/cancel), 0 hiện tiền (BR-MP-09 ticket report KHÔNG tiền).
- Performance: forecast + heatmap p95 < 800ms cold, cache TTL.
- KHÔNG đụng/break 13 endpoint + 152 test F-069 hiện có.

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] Yes — BA bắt đầu được, miễn trả lời 5 PAUSE conditions trên trong PRD.

## 🔗 Next step
Danny chạy: `/5bib-prd FEATURE-070-merchant-advanced-mkt-analytics`
