# FEATURE-072 — Implementation Notes (Reviewer's Guide)

## 1. 🚧 Deviations from Spec
- **[D1] Aggregate trong Node, KHÔNG SQL GROUP** — Spec/Plan cho phép; chọn pull-then-aggregate vì dob/nationality/size là varchar bẩn → parse/normalize trong JS robust hơn + unit-testable. Cost: pull N rows/race (≤15k OK). Reviewer check: query có LIMIT? KHÔNG — bounded bởi 1 race. Nếu race >50k participant cân nhắc thêm cap.
- **[D2] Export = fetch blob qua proxy, KHÔNG dùng SDK** — SDK baseUrl='' + proxy inject token; file download dễ nhất bằng `fetch('/api/merchant-portal/participants/export')`. Cost: 1 manual fetch (không qua SDK typing).

## 2. ⚙️ Forced Changes
- **[F1] is_represent KHÔNG lọc** — đếm mọi athlete_subinfo row join paid oli = 1 participant. Plan ghi "verify trên DEV". Reviewer/QC: kiểm tra trên data thật xem guardian row (is_represent=1) có làm phồng count không. Nếu có → thêm `AND (asi.is_represent=0 OR asi.is_represent IS NULL)`.
- **[F2] Label backend = tiếng Việt** (gender "Nam/Nữ/Khác", "Không rõ", nationality "Việt Nam") — non-VN user thấy label VN. Số liệu + size + AG là universal. → TD-F072-LABEL-I18N (BTC thường VN, chấp nhận v1).

## 3. ⚖️ Tradeoffs
| Decision | Chosen | Alt | Why | Cost |
|---|---|---|---|---|
| Aggregate | Node | SQL GROUP | robust messy varchar + testable | pull N rows |
| AG band | WA 5-year | gọn 4 mốc | Danny chốt + chuẩn trao giải | nhiều bucket hơn |
| Export | proxy fetch blob | SDK | đơn giản, token sẵn | không SDK-typed |
| Cache | 300s | 60s | insights ít đổi | stale tối đa 5'  |

## 4. 🔬 Reviewer Notes
### Review kỹ
1. `utils/participant-insights.util.ts` — parseAge (3 format + implausible guard) + ageGroupWA (band 18-24 special) + normalizeNationality (VN variants). **QC: dùng data DEV thật verify nationality/dob spread.**
2. `services/merchant-portal.service.ts` getParticipantInsights/Export — SQL join `asi.order_line_item_id`, paid filter, race scope `om.race_id`. **assertRaceForUser TRƯỚC (IDOR).**
3. `merchant-portal.controller.ts` — guard ticket-scope (class `LogtoMerchantGuard`, KHÔNG finance).
4. FE `ParticipantsTab` — empty state + export loading.

### Security
- [x] IDOR: assertRaceForUser cả 2 method. [x] No-PII: response chỉ {label,count}, KHÔNG tên/dob cá nhân. [x] SQL param `?`. [x] Ticket-scope guard (không phải data tiền nên không cần finance).

### Edge tested vs deferred
- ✅ Tested (17 unit): parse/normalize/bucket/top-N/empty.
- ⚠️ Deferred QC: live data spread (nationality/dob thực) + glyph 5 lang + is_represent cardinality (F1) + IDOR e2e.

### TD
- TD-F072-LABEL-I18N (gender/unknown labels VN cho non-VN user).
- TD-F072-IS-REPRESENT (verify guardian rows không phồng count).
