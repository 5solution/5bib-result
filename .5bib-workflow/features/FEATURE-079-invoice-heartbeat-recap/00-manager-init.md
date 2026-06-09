# FEATURE-079: F-076 Heartbeat Recap 2h/lần — đảm bảo bot visibility

**Status:** 🟡 INITIATED
**Created:** 2026-06-09
**Owner:** Danny
**Type:** BUGFIX (extend F-076 BR-25 noise control)
**Created by:** 5bib-manager

---

## 🎯 Why this feature

Sáng 2026-06-09 10:00 ICT F-076 vừa golive race 220 bán vé. Đến 13:54 ICT bot `@invoice_5bib_daily_bot` im lặng → Danny báo. Manager triage:
- Cron chạy đều mỗi 5 phút từ 10:00 → 13:50 (47 tick PASS)
- Tất cả `missing=0 maxSeverity=INFO` (22/22 ORDINARY đã xuất hóa đơn)
- BR-25 logic `invoice-alert.service.ts:108-110` SKIP hourly recap khi `missingCount=0 && diffEvents=[]` → đúng spec nhưng KHÔNG match Danny intent ("tổng hợp theo tiếng để kế toán nắm thông tin")

Danny chốt 2026-06-09 13:50:
> "Bổ sung thêm tin daily để tao chắc hệ thống vẫn ổn 2 tiếng / lần"

→ Mở heartbeat recap mỗi 2 giờ trong khung 8h-22h ICT, gửi kể cả khi `missing=0` để Danny + Hiền visibility cron vẫn alive.

---

## 📂 Impact Map

### Module sẽ chạm

**Backend (`backend/src/modules/invoice-reconcile/`):**
- `services/invoice-alert.service.ts` — relax BR-25 skip condition HOẶC thêm method `sendHeartbeat()` riêng
- `services/alert-composer.ts` — thêm composer `composeHeartbeatRecap()` HOẶC reuse `composeHourlyRecap()` với suffix "All OK"
- `crons/hourly-recap.cron.ts` — đổi cron schedule từ `'0 0 8-20 * * *'` (mỗi giờ) → `'0 0 8,10,12,14,16,18,20,22 * * *'` (2h) HOẶC giữ hourly mà thêm flag bypass skip
- `__tests__/alert-composer.spec.ts` — extend test heartbeat compose
- `__tests__/invoice-reconcile.service.spec.ts` — extend test heartbeat skip OFF when force flag

**Frontend: ZERO change** — không UI mới.

### File then chốt cần Coder đọc

1. `backend/src/modules/invoice-reconcile/services/invoice-alert.service.ts:104-114` — `sendHourlyRecap` current skip logic (BR-25)
2. `backend/src/modules/invoice-reconcile/services/alert-composer.ts` — `composeHourlyRecap` template
3. `backend/src/modules/invoice-reconcile/crons/hourly-recap.cron.ts:22-25` — current cron schedule + comment "skip 21:00 vì EOD thay"
4. `backend/src/modules/invoice-reconcile/services/invoice-reconcile.service.ts:223-249` — `runHourlyRecap` orchestrator

### Endpoint liên quan

KHÔNG có endpoint mới. Cron-driven background job only.

### Schema/DB

- MongoDB: KHÔNG đụng
- MySQL platform: KHÔNG đụng
- Redis: KHÔNG đụng (heartbeat KHÔNG cần dedup — gửi đều mỗi 2h)
- Telegram: bot `@invoice_5bib_daily_bot` chat `-100...` reuse existing — KHÔNG cần config mới

### Logto / Auth

- ZERO change. RBAC F-078 không liên quan.

---

## ⚠️ Risk Flags

- 🟡 **MED — Đụng F-076 invoice-alert.service vừa golive sáng nay.** Bất kỳ regression sẽ ảnh hưởng alert flow race 220 đang bán. Smoke test BẮT BUỘC sau deploy.
- 🟡 **MED — Cron schedule change.** Đổi expression `0 0 8-20 * * *` (13 tick/ngày) → `0 0 8,10,12,14,16,18,20,22 * * *` (8 tick/ngày) — cần verify @nestjs/schedule chấp nhận comma-list syntax. (Theo cron spec chuẩn: YES. Verify trong Coder bước test.)
- 🟢 **LOW — Composer template change.** Chỉ thêm câu "✅ Tất cả OK" hoặc tương đương khi missingCount=0.

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

- [ ] **PAUSE-79-01:** Heartbeat 2h gửi mỗi giờ chẵn `8,10,12,14,16,18,20,22` ICT (8 tick/ngày) → đúng "2 tiếng/lần" Danny chốt. Có cần skip 22:00 vì EOD 21:00 đã gửi rồi không? Manager đề xuất: GIỮ 22:00 (Danny chốt 21:00 EOD daily + 22:00 heartbeat last = không trùng nội dung).
- [ ] **PAUSE-79-02:** Khi có `missing > 0` hoặc `diffEvents.length > 0`, có cần GỬI cả 2 tin (alert chi tiết + heartbeat tổng quát) không? Manager đề xuất: gửi 1 tin gộp dạng "Recap + missing rows" như BR-25 hiện tại (reuse `composeHourlyRecap` đầy đủ).
- [ ] **PAUSE-79-03:** Format heartbeat khi `missing=0`. Manager đề xuất:
  ```
  📊 Recap 14:00 — Race 220 invoice status
  ✅ All OK — 23/23 ORDINARY đã xuất hóa đơn MISA
  
  Expected: 23 | Issued: 23 | Missing: 0 | Duplicate: 0
  Skipped (INSURANCE/MANUAL): 2
  
  🕐 Next heartbeat: 16:00 ICT
  ```
  Hoặc form ngắn gọn hơn — BA chốt format.
- [ ] **PAUSE-79-04:** Có dùng Redis dedup cho heartbeat không? Manager đề xuất KHÔNG (heartbeat đặc tính cron-driven, schedule chính xác, không cần dedup).
- [ ] **PAUSE-79-05:** Touching F-076 vừa golive — cần test mandate đặc biệt? Manager đề xuất: regression test toàn bộ alert-composer + alert-service 7 loại alert hiện có + smoke test cron tick 1 vòng sau deploy.

---

## 🎯 Success criteria

- Telegram group nhận tin từ bot `@invoice_5bib_daily_bot` mỗi 2 tiếng (8h-22h ICT) → 8 tin/ngày tối thiểu
- Khi `missing=0`: tin có dạng "All OK ✅"
- Khi `missing>0`: tin có dạng "Recap + missing rows" như BR-25 hiện tại
- Zero regression 7 loại alert F-076 existing (INFO Hourly/WARN/CRITICAL/BREACHED/DUPLICATE/MISA Health/EOD Daily)
- Race 220 đang bán vé không bị gián đoạn alert flow
- Smoke test sau deploy: trigger manual `POST /trigger` → verify alert flow normal

Performance: SLA inherit F-076 — cron tick <2s p95.

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] **Yes** — BA có thể viết PRD ngay với 5 PAUSE-79-* answered + format heartbeat template đề xuất.

Danny đã chốt scope explicit ("2 tiếng/lần"). Implementation đơn giản, expected total work ~30-45 phút Coder.

---

## 🔗 Next step

Danny chạy: `/5bib-prd FEATURE-079-invoice-heartbeat-recap`
