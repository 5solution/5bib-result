# Merchant Portal — Feature Backlog (BTC value)

> **Owner:** 5bib-manager · **Created:** 2026-06-08
> Nguồn: tư vấn `5bib-sports-domain-expert` (2026-06-08) sau khi F-069/F-070/F-071 ship.
> Đây là BACKLOG ứng viên — mỗi dòng = 1 `/5bib-init` riêng khi Danny chốt. Counter CHƯA bump.
> Bản chất portal = **read-only reporting** → ưu tiên tính năng báo cáo/insight, KHÔNG write-action vận hành.

---

## 📊 Bảng tính năng (rank theo giá trị BTC ÷ effort)

| # | Tính năng | Mô tả (BTC dùng để làm gì) | Loại | Giá trị | Data cần (⚠️=phải verify schema) | Reuse hạ tầng sẵn | Effort | Hợp read-only? | Ưu tiên |
|---|-----------|----------------------------|------|---------|----------------------------------|-------------------|--------|----------------|---------|
| C1 | **Phân bổ size áo** | Đếm S/M/L/XL/XXL × cự ly (chỉ vé paid) → đặt xưởng may đúng số lượng (pain #1, lead-time 4-6 tuần) | EXTEND | 🔴 Rất cao | ⚠️ field `shirt_size` trong order/registration | Pattern by-course (M2b-2.2) | 🟢 Thấp (nếu có field) | ✅ | **P0** |
| C2 | **Quota/Slot từng cự ly** | Progress `đã bán / quota` mỗi cự ly + dự báo ngày sold-out → đóng sớm / cứu cự ly ế | EXTEND | 🔴 Rất cao | ⚠️ `quota`/`limit` per course (race_course) + paid count (có) | **Forecast engine F-070** (chẻ theo cự ly) | 🟡 TB | ✅ | **P0** |
| C3 | **Cơ cấu VĐV: Giới tính × Nhóm tuổi (AG) × Quốc tịch** | Donut giới tính + histogram tuổi (AG 5 năm) + top tỉnh/quốc gia → báo cáo nhà tài trợ + giải thưởng AG + hậu cần xuyên biên giới | EXTEND | 🔴 Cao (↑ vì đa ngôn ngữ ĐNA) | ⚠️ `gender`, `dob`/`birth_year`, `nationality`/`province` | Pattern by-type donut + heatmap grid | 🟡 TB | ✅ | **P1** |
| C4 | **So sánh mùa này vs mùa trước (YoY)** | Overlay đường lũy kế đăng ký theo "ngày trước race" (D-90/D-60…) năm nay vs năm trước → biết bán nhanh/chậm hơn | EXTEND | 🟠 Cao | Cần map "giải mùa trước" (cùng tenant, race trước) — ⚠️ liên kết race-to-race | Forecast cumulative line (F-070) | 🟡 TB | ✅ | **P1** |
| C5 | **Hiệu quả wave giá / mã giảm / nhóm vé** | Breakdown theo early-bird/regular/VIP/group + % đóng góp + timeline wave + promo code performance | EXTEND | 🟠 TB-Cao | ⚠️ `ticket_wave`/`promo_code`/`discount` trong order | Pattern by-ticket-type (M2b-2.3) | 🟡 TB | ✅ | **P2** |
| C6 | **Cohort VĐV quay lại (repeat/loyalty)** | % VĐV từng tham gia mùa trước → chỉ số sức khỏe thương hiệu giải, pitch tài trợ | EXTEND | 🟡 TB | ⚠️ match VĐV cross-race (email/phone/CCCD) — privacy-sensitive | — (mới) | 🔴 Cao (matching + PII) | ✅ (số liệu) | **P3** |
| C7 | **Quốc tịch trong bảng đơn + KPI "VĐV quốc tế %"** | Cột cờ quốc gia ở bảng đơn hàng + KPI card % quốc tế (đi kèm C3, tách nhỏ để ship nhanh) | EXTEND | 🟠 Cao (cross-border) | ⚠️ `nationality` (chung C3) | Bảng orders (M2b-2b.3) | 🟢 Thấp | ✅ | **P1 (gộp C3)** |
| — | ~~Hoàn/chuyển nhượng/dời BIB (refund/transfer/defer)~~ | Write-action vận hành — **KHÔNG hợp portal read-only** | — | — | — | — | — | ❌ | **Loại** (module ops riêng; chỉ "báo cáo số yêu cầu" thì OK) |
| — | ~~Live tracking / kết quả race-day~~ | Sản phẩm kết quả thi đấu khác — không thuộc portal doanh số BTC | — | — | — | — | — | ❌ | **Loại** |

---

## 🎯 Đề xuất lộ trình (Manager)

**Wave 1 (quick win, đánh trúng pain + tận dụng data sẵn):** C1 Size áo → C2 Quota (reuse forecast) → C3+C7 Cơ cấu VĐV (giới/tuổi/quốc tịch).
**Wave 2:** C4 YoY → C5 Wave giá/promo.
**Wave 3 (cân nhắc):** C6 Cohort (vướng PII + matching, để sau).

**Cộng hưởng chiến lược:** C2/C3/C7 nối thẳng với hướng **xuyên biên giới** (Khmer/Lào/Mã Lai vừa thêm ở F-071) — quốc tịch + quota cự ly là data BTC cần khi đón VĐV khu vực.

---

## ⚠️ Gate trước khi init bất kỳ feature nào (Manager memory-first)

1. **Verify schema MySQL platform** — cột nào THẬT tồn tại: `shirt_size`, `gender`, `dob/birth_year`, `nationality/province`, `quota`, `ticket_wave`, `promo_code`. **Đây là điều kiện sống còn** — không có field thì feature bất khả thi (bài học F-070: "races PK = race_id"). Mỗi `/5bib-init` PHẢI spot-check schema TRƯỚC.
2. **PII/privacy** — gender/dob/nationality/cohort là dữ liệu cá nhân. Confirm: chỉ aggregate (đếm/%), KHÔNG lộ VĐV cá nhân ra portal BTC (giữ nguyên tắc F-069 BR-MP: no PII trong report). C6 cohort đặc biệt nhạy.
3. **Read-only invariant** — giữ portal thuần report. Tính năng write (hoàn/chuyển vé) → module khác.

---

## 🔗 Next
Danny chốt feature nào → `/5bib-init <tên>` (Manager verify schema + impact map) → `/5bib-prd` → … Mỗi feature là 1 chu trình 4-agent riêng.

---

## ✅ SCHEMA VERIFIED (2026-06-08, platform MySQL read-only) — consolidation

Manager đã DESCRIBE `5bib_platform_live`. Kết quả gom 7 ứng viên → **4 feature thật** (C6 DROP per Danny no-PII):

| Feature mới | Gồm | Data source THẬT (verified) | Join path | Trạng thái |
|-------------|-----|------------------------------|-----------|------------|
| **F-072 Participant Insights** | C1 size áo + C3 giới/tuổi/quốc tịch + C7 cờ quốc gia | `athlete_subinfo`: `tshirt_size`,`gender`,`dob`,`nationality`,`city_province` | `order_line_item.id = athlete_subinfo.order_line_item_id` → om → races (tenant) | ✅ build được (1 bảng, paid-only via om.financial_status) |
| **F-073 Quota/Capacity** | C2 | `ticket_type.max_participate` + `remained_ticket` (đã tính sẵn) + `race_course.max_participate/max_bib` | có sẵn chain tt/rc | ✅ build được (reuse forecast cho dự báo sold-out) |
| **F-074 YoY comparison** | C4 | race history cùng `tenant_id` (races) | tenant → races trước | ✅ (không cần field mới) |
| **F-075 Promo/Wave** | C5 | `oli.total_discount`,`om.manual_discount_id`,`buy_group.fixed_discount_percent`,`price_rule.promotion_scope`,`race_course.wave` | spread nhiều bảng | ✅ (join phức, để cuối) |
| ~~C6 Cohort~~ | — | DROP (Danny no-PII + cần match PII cross-race) | — | ❌ Loại |

**Bonus bugfix (ngoài backlog):** ẩn warning kỹ thuật `revSummary.warnings` ("MerchantConfig không tồn tại cho tenantId=14 — fallback Tier 3…") khỏi merchant — leak tenantId + fee tier nội bộ. Backend bugfix nhỏ (FeeService/revenue response). Default: ẩn khỏi merchant, giữ log nội bộ.

**Thứ tự build (Manager):** F-072 (value cao nhất, 1 bảng) → F-073 (reuse forecast) → fee-banner bugfix (nhanh) → F-074 → F-075.

**PII note:** F-072 chỉ aggregate (đếm/% theo size/giới/AG-bracket/quốc tịch) — KHÔNG list VĐV cá nhân (giữ BR-MP no-PII F-069). Danny "k cần PII" = ✅ aggregate-only, không match cá nhân.
