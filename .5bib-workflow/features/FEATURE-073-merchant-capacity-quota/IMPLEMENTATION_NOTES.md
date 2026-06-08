# F-073 Implementation Notes
## Deviations: Capacity = SECTION trong tab Vé (không tab riêng) — gắn liền bán vé, tránh tab bloat. sold dùng quota-remaining (vendor remained_ticket) thay vì paid-count → phản ánh "chỗ còn" public thấy (BTC quan tâm). Cost: nếu có hold/pending, remained khác paid → số "đã bán" = đã giữ chỗ, không phải đã trả tiền. Chấp nhận cho "sức chứa".
## Forced: race_course.max_participate=placeholder(1) toàn hệ → BỎ, dùng ticket_type. Nhiều tt max=1000 default → pctFilled thấp cho BTC chưa set quota thật (data thật, không phải bug).
## Tradeoffs: aggregate Node (testable) vs SQL; section vs tab (chọn section); sold=quota-remaining vs paid-count (chọn vendor-remaining cho ý nghĩa "chỗ còn").
## Reviewer: capacity.util.ts (clamp remaining≤quota, sold≥0, unlimited logic); service getCapacity (rc.race_id scope, deleted filter, IDOR). No-PII (chỉ count). SDK hand-add reconcile.
## TD: TD-F073-SOLD-SEMANTICS (sold=remained-based not paid-based — verify với BTC ý nghĩa); TD-F073-DEFAULT-1000 (nhiều quota default 1000); TD-F073-SDK-HANDADD.
