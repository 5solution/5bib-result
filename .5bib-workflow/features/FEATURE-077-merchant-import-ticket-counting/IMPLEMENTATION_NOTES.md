# FEATURE-077 — Import-ticket counting fix (merchant portal báo cáo bán vé)

**Type:** BUGFIX (data-source correctness) — đụng F-069/F-072/F-073 đã ship
**Date:** 2026-06-08
**Trigger (Danny):** "ở báo cáo bán vé là vé ở dạng import vào ... code có 'IMPORT' là code import
của giải cái đó cũng cần tính vào thì mới ra số tổng được, vì 1 BTC bán rất nhiều nguồn nhưng
sau dùng 5BIB quản lý toàn bộ."

## 🔬 Root cause (data finding, race 209 "Giải chạy")
Báo cáo bán vé đếm từ `order_metadata` (paid orders) → BỎ SÓT vé import.
- `codes` ACTIVE/SENT (vé thật) = **644**; order paid chỉ = **402** → thiếu ~242.
- 212 codes `order_id IS NULL` = vé IMPORT/MANUAL (BTC bán nguồn ngoài → import vào 5BIB,
  `import_tracking_id` → `csv_import_tracking.file_name='MANUAL'`).
- `codes` có sẵn `race_id`+`course_id`+`ticket_type_id` → đếm trực tiếp, không cần chuỗi
  `oli→om→tt→rc`.

## ✅ Counting model mới (chốt với Danny 3 câu hỏi)
- **Đếm vé** = `codes` WHERE `deleted=0 AND status IN ('ACTIVE','SENT')`. `order_id IS NULL`
  = import; NOT NULL = qua 5BIB. (Q1: gộp tổng + tách nguồn.)
- **Doanh thu/phí GIỮ NGUYÊN order-based** — `codes.value=0` toàn bộ, import không có giao
  dịch tiền trên 5BIB.
- **"Vé đã thanh toán" = order paid (tách riêng)** + KPI mới "Vé import". (Q2.)

## 🚧 Deviation from Danny's Q3 choice (data overrode the pick)
- **Q3 chọn:** kéo demographics import qua `codes.user_id`.
- **Reality:** import codes có `user_id = NULL` (0/212). `athlete_subinfo` không có `user_id`,
  link `import_unique_key` (SHA-hash) không khớp cột nào của `codes`; MANUAL adds không có
  demographic row. → **Bất khả thi.**
- **Fallback đã làm:** "Cơ cấu VĐV" tổng = `totalIssued` (gồm import) nhưng các biểu đồ
  size/giới/AG/quốc tịch chỉ tính `participantsWithData` (vé qua 5BIB có athlete_subinfo) +
  hiển thị note "Cơ cấu dựa trên N vé có dữ liệu — vé import chưa có thông tin chi tiết".
  Số TỔNG (thứ Danny cần) vẫn đúng đủ.

## Files changed
- BE `services/merchant-portal.service.ts`: `pullIssuedCodeTotals()` + `CODE_SOLD_FILTER`;
  rewrote getTicketSalesByCourse/ByType → codes-based + source split; getTicketSalesSummary
  += totalIssued/issued5bib/issuedImport; getCapacity sold → codes correlated subquery;
  getParticipantInsights += totalIssued/participantsWithData/issuedImport.
- BE DTOs: ticket-sales.dto.ts (+totalIssued/issued5bib/issuedImport, +count5bib/countImport),
  participant-insights.dto.ts (+3 fields).
- BE specs: merchant-portal.service.spec.ts updated (codes mocks + new assertions, +1 SQL test).
- FE merchant: types.gen.ts (hand-added SDK +fields), page.tsx (Tổng vé=totalIssued + sub split,
  new "Vé import" KPI replacing pending, ParticipantsTab total+coverage note), i18n.ts (+6 keys ×5 lang).

## Verification
- Live DB (race 209): summary 644/432/212 ✓; by-course 311(253+58)/168(117+51)/165(62+103) ✓;
  capacity sold sums 644 ✓.
- 170 backend jest PASS. `npx nest build` OK (compiled JS has 4 `FROM codes c`). FE tsc clean.

## Pending
- Browser-QC on DEV after deploy (BE+FE single push). PROD release after Danny approval.
- Reconcile hand-added SDK via `pnpm generate:api` later.

---

## Follow-up fixes (Danny PROD review 2026-06-08)

### F2 — "Vé đã huỷ" = voided-order qty → codes INACTIVE (commit 4d31e34)
- Bug có sẵn từ F-069: "Vé đã huỷ" = SUM(quantity) đơn financial_status='voided'
  → đếm cả đơn checkout hỏng/bỏ giữa chừng/hoàn tiền → thổi phồng.
  Race 124: 2.202 (777 đơn voided) vs vé huỷ THẬT (codes INACTIVE) = 15. Race 209: 213 vs 2.
- Fix: `pullIssuedCodeTotals` gộp `cancelled_count` (status='INACTIVE', deleted=0) trong 1 query.
  DTO +cancelledIssued; FE KPI đọc summary.cancelledIssued thay statusCount('voided').

### F3 — Cơ cấu VĐV charts không cộng ra tổng (commit 21bcae3)
- Tổng VĐV = codes incl import (race 124 = 7.176) nhưng demographics chỉ ~3.559 (vé qua 5BIB)
  → charts giới/tuổi/quốc tịch/tỉnh nhìn như lỗi.
- Đào lại import→demographics cho race 124 (CSV import, không phải MANUAL như 209):
  external_order_ref="12.bv" (mảnh tên file), receipt_email, csv_import_tracking.hash_code —
  **đều 0 match** athlete_subinfo.import_unique_key. → Xác nhận data gap THẬT, không recover.
- Fix (Danny chốt): append bucket "Chưa có dữ liệu" = (totalIssued − participantsWithData) vào
  4 biểu đồ nhân khẩu → mọi chart SUM = totalIssued. Size áo giữ empty-state riêng.
- Verified DEV race 209: donut center 644, Nam 276 + Nữ 152 + Chưa có dữ liệu 216 = 644.

## KNOWN LIMITATION (TD-F077-IMPORT-DEMOGRAPHICS)
Vé import (codes order_id NULL) KHÔNG có dữ liệu nhân khẩu trong platform DB —
không có user_id, không FK sạch tới athlete_subinfo (cả MANUAL adds lẫn CSV import).
Cơ cấu VĐV chỉ phản ánh vé qua 5BIB; phần import hiện ở bucket "Chưa có dữ liệu".
Nếu sau này import flow lưu demographics → revisit để phủ đủ.

## Release chain
- v1.15.0 (f9eda42): F-072/073/074 + fee-fix + F-077 import counting + participant sub fix.
- v1.15.1 (21bcae3): + "Vé đã huỷ"=INACTIVE + Cơ cấu gap bucket.
