# FEATURE-088: Invoice Control Dashboard — nâng cấp trang admin kiểm soát xuất hóa đơn

**Status:** ✅ DEPLOYED (xem 03/04/05)
**Created:** 2026-06-16
**Owner:** Danny ("làm cái module quản lý trên admin dạng dashboard cho tao kiểm soát")
**Type:** EXTEND_EXISTING (mở rộng trang `/invoice-reconcile` F-076 + visibility F-086)

## 🎯 Why
Trang `/invoice-reconcile` đã có (KPI + missing table + orphan + trigger + auto-poll) nhưng KHÔNG hiển thị 3 số F-086 (tổng/hôm nay/lỗi) + sức khỏe hệ thống, và thiếu nút điều khiển. Danny cần dashboard theo dõi + kiểm soát.

## ✅ Danny chốt (2026-06-16)
- Nút: **Chạy reconcile (đã có) + Gửi heartbeat ngay + Đánh dấu đã xử lý từng đơn**.
- Trend chart: **chưa cần** (làm sau — cần lưu lịch sử per-day).

## 📂 Impact (extend, KHÔNG làm lại)
### Backend
- `dto/reconcile-report.dto.ts` — +ErrorBreakdownDto + cumulativeIssued/errorBreakdown/dailyCounters (optional → backward-compat).
- `dto/missing-invoice-row.dto.ts` — +resolved.
- `dto/resolve-order.dto.ts` (mới) — ResolveOrderDto + result DTOs.
- `services/invoice-reconcile.service.ts` — enrichReport + refreshCumulativeThrottled (SETNX 5p) + markOrderResolved/getResolvedOrderIds (scope-by-date + TTL 7d).
- `invoice-reconcile.controller.ts` — /today + /trigger enrich; +POST /send-heartbeat (throttle 3/min) +POST /resolve.
### Frontend (admin)
- `lib/invoice-reconcile-api.ts` — +sendHeartbeat/setOrderResolved + types.
- `_components/kpi-strip.tsx` — +2 card (Tổng từ 08/06 + Đang lỗi breakdown).
- `_components/health-panel.tsx` (mới) — MISA status/token/scan cuối/Telegram/email/ngưỡng/counters.
- `_components/invoice-reconcile-client.tsx` — health fetch + nút Gửi heartbeat + onResolve optimistic+override-merge.
- `_components/missing-rows-table.tsx` — nút "đã xử lý" per-row + toggle "ẩn đã xử lý".

## ⚠️ Risk
- 🟡 send-heartbeat outward (Telegram) → throttle 3/min + audit.
- 🟡 /today poll 60s → MISA throttle SETNX 5p (không hammer).
- 🟢 resolved = state nội bộ (F-076 read-only, KHÔNG xuất/hủy hóa đơn được).
- 🟢 Optional fields → backward-compat.

## ✅ Sẵn sàng — đã build full (autonomous theo workflow Danny yêu cầu).
