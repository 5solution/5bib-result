# FEATURE-087: Heartbeat Self-Heal — bug heartbeat 8:00 ICT skip câm mỗi sáng

**Status:** ✅ FIXED + DEPLOYED
**Type:** BUGFIX (incident — pre-existing F-076/F-079 race, surfaced 2026-06-17)
**Owner:** Danny ("tao đéo thấy telegram bắn thêm cái gì sáng nay cả")

## 🔍 Root cause (xác định từ PROD log)
- Log `[hourly-recap] no cached report yet, skip` lúc 01:00 UTC (8:00 ICT) → recap fire đúng giờ nhưng `getCachedReport('2026-06-17')` = null → **skip câm**.
- **scan-tick cron = `@Cron('0 */5 8-22', tz ICT)`** — chỉ chạy 8h–22h ICT, ĐÊM KHÔNG SCAN.
- Sang ngày mới (00:00 ICT) chưa scan → chưa có report cache cho ngày đó.
- Đúng 8:00:00 ICT: scan-tick + hourly-recap fire CÙNG GIÂY → recap đọc cache TRƯỚC khi scan kịp ghi → null → skip.
- → **Heartbeat 8:00 sáng LUÔN skip mỗi ngày** (deterministic cross-cron race). Danny check sáng → trống.
- `cumulative:issued=null` xác nhận F-086 chưa kịp chạy lần nào (recap skip trước đoạn F-086) — F-086 KHÔNG phải nguyên nhân.

## 🔧 Fix
`runHourlyRecap`: khi `getCachedReport` null → **tự chạy `scan(date,'cron')`** tạo report rồi gửi (thay vì skip câm). Triết lý F-079 "heartbeat MUST send". scan() idempotent + alert dedup SETNX → an toàn dù scan-tick chạy song song (double-work 1 tick, vô hại). scan throw → graceful return, không crash cron.

## 🧪 Tests
- `invoice-reconcile/services/invoice-reconcile.service.ts` runHourlyRecap self-heal.
- +2 test F-087 (no-cache → scan + send; scan throw → graceful). 147/147 module PASS, tsc clean.

## TD đóng
- Đóng class bug "heartbeat skip khi thiếu cache" (cùng họ incident F-076 gốc). EOD recap đã tự-đủ sẵn (empty report fallback) — chỉ hourly thiếu.
