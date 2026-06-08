# FEATURE-072: Merchant Portal — Participant Insights (Size áo + Cơ cấu VĐV + Quốc tịch)

**Status:** 🟡 INITIATED
**Created:** 2026-06-08
**Owner:** Danny
**Type:** EXTEND_EXISTING (merchant-portal backend + merchant frontend)
**Created by:** 5bib-manager

---

## 🎯 Why this feature
BTC cần 3 thứ data đăng ký mà portal chưa có (tư vấn Sports Expert 2026-06-08):
1. **Phân bổ size áo** (S/M/L/XL/XXL) → đặt xưởng may đúng số lượng (pain vận hành #1, lead-time 4-6 tuần, không sửa được).
2. **Cơ cấu giới tính × nhóm tuổi (Age Group)** → báo cáo nhà tài trợ + chuẩn bị giải thưởng AG.
3. **Quốc tịch / tỉnh-thành** → hậu cần xuyên biên giới (cộng hưởng F-071 Khmer/Lào/Mã Lai: shuttle, khách sạn, suất ăn, MC song ngữ).

Gộp C1+C3+C7 (backlog) vì **cùng nằm 1 bảng `athlete_subinfo`** → 1 join, 1 feature.

## 📂 Impact Map (schema đã VERIFY 2026-06-08)

### Module chạm
- `backend/src/modules/merchant-portal/` — service + controller + DTO (thêm endpoint READ aggregate).
- `merchant/src/app/races/[raceId]/page.tsx` + `components/mp/charts.tsx` — section "Cơ cấu VĐV" (chart) ở tab Vé.
- `merchant/src/lib/mp/i18n.ts` — labels 5 ngôn ngữ (size/giới/AG/quốc tịch).

### Data source (platform MySQL — VERIFIED)
- `athlete_subinfo`: `tshirt_size` (tinytext), `gender` (varchar16), `dob` (**varchar255 ⚠️**), `nationality` (varchar255 free-text ⚠️), `city_province`, `is_represent` (bit), `order_line_item_id` (bigint, LINK).
- **Join path:** `athlete_subinfo asi JOIN order_line_item oli ON oli.id = asi.order_line_item_id JOIN order_metadata om ON oli.order_id = om.id JOIN races r ON ...` + filter `om.financial_status='paid'` + `om.deleted=0` + tenant/race scope (reuse pattern `assertRaceForUser`).
- Quota/size config (tham khảo): `race_extension.t_shirt_size` / `t_shirt_size_table_url`.

### Endpoint dự kiến (BA chốt shape)
- `GET /api/merchant-portal/ticket-sales/participant-insights?raceId=` → `{ shirtSizes[], genders[], ageGroups[], nationalities[], provinces[] }` (aggregate counts). Guard `LogtoMerchantGuard` (ticket-scope, KHÔNG cần finance).
- Redis cache key `merchant-portal:participants:<raceId>` TTL 300s (port pattern F-070).

## ⚠️ Risk Flags
- 🔴 **HIGH — `dob` là varchar(255):** format KHÔNG chuẩn (có thể "1990-05-01", "01/05/1990", "1990", rỗng, rác). Tính Age Group PHẢI parse phòng thủ + bucket "Không rõ" cho parse fail. BA định nghĩa AG bands (WA chuẩn: 18-24,25-29,…,70+) + xử lý invalid.
- 🔴 **HIGH — `nationality` free-text varchar:** giá trị lộn xộn ("VN","Vietnam","Việt Nam","Cambodia","KH"...). Cần normalize/group + nhóm "Khác". BA chốt cách gom (map ISO? top-N + Khác?).
- 🟡 **MED — PII:** chỉ trả AGGREGATE (đếm/%), TUYỆT ĐỐI không list VĐV cá nhân (tên/dob/cccd) ra portal. Giữ BR-MP no-PII F-069. (Danny chốt "k cần PII" = aggregate-only.)
- 🟡 **MED — cardinality:** 1 `order_line_item` có thể nhiều `athlete_subinfo`? (group buy `buy_group_line_item_id`, represent `is_represent`). BA chốt: đếm theo athlete_subinfo row (mỗi participant) hay theo vé. Loại/giữ hàng `is_represent` (người giám hộ)?
- 🟡 **MED — size order:** sort S<M<L<XL<XXL (không alphabet). Size value tinytext tự do → cần canonical order + nhóm lạ.
- 🟢 **LOW — frontend:** thêm section chart, reuse Donut/Bar component sẵn (charts.tsx).

## 🚧 PAUSE Conditions cho BA (trả lời trong PRD)
- [ ] AG bands chuẩn nào? (đề xuất WA: <18, 18-24, 25-29, 30-34, …, 65-69, 70+) + bucket "Không rõ DOB".
- [ ] `dob` parse: chấp nhận format nào, fail → "Không rõ"?
- [ ] `nationality` normalize: top-N quốc gia + "Khác", hay map ISO? Giá trị VN gom thế nào?
- [ ] Đếm theo **participant (athlete_subinfo row)** hay theo **vé (quantity)**? Hàng `is_represent=1` (giám hộ) tính không?
- [ ] Size: canonical order + nhóm size lạ vào "Khác"?
- [ ] Hiển thị ở đâu: tab Vé (cùng MKT analytics) hay tab riêng "Cơ cấu VĐV"?

## ✅ Sẵn sàng cho /5bib-prd?
- [x] Yes — schema verified, join path rõ. BA cần chốt 6 PAUSE (chủ yếu data-quality: dob/nationality/cardinality).

## 🔗 Next step
Danny chạy: `/5bib-prd FEATURE-072-merchant-participant-insights`
