# FEATURE-086: Invoice Visibility Counters — tổng/hôm nay/lỗi vào tin Telegram + persist bền

**Status:** 🟡 INITIATED
**Created:** 2026-06-16
**Owner:** Danny (nêu sau mấy ngày vận hành F-076: "không biết tổng xuất bao nhiêu / hôm nay bao nhiêu / bao nhiêu error / tin nhắn cũng đếch biết")
**Type:** EXTEND_EXISTING (mở rộng F-076 invoice-reconcile — visibility layer)

---

## 🎯 Why
F-076 chạy production từ ~08/06/2026 (mở bán Lào Cai Marathon 2026, race 220) nhưng Danny KHÔNG có cách nào nhìn ra 3 con số vận hành cốt lõi: tổng hóa đơn đã có, số hôm nay, số đang lỗi. Tin Telegram heartbeat/EOD hiện không hiển thị rõ. Đây là visibility gap thuần — không đổi logic đối soát.

## 🧭 Kiến trúc đã xác nhận (workflow map wf_946fb2b8, 5 agents)
**F-076 là hệ thống đối soát READ-ONLY — KHÔNG tự xuất hóa đơn.** Webhook legacy xuất hóa đơn lên MISA; F-076 chỉ query MySQL `order_metadata` + MISA `/invoice/paging` mỗi 5 phút để cross-check, classify OK / SYNC_LAG / UNISSUED / DUPLICATE. Hệ quả:
- "Tổng đã xuất" = số đơn **đã có** hóa đơn (issued = vat_ref đủ HOẶC MISA có 1 invoice gốc), KHÔNG phải "F-076 vừa xuất N cái".
- Mọi metric hiện **ephemeral**: report TTL 24h, daily-counters TTL 48h. KHÔNG có store bền → không trả lời được "tổng từ đầu".

## ✅ Quyết định Danny đã chốt (2026-06-16)
1. **Error = gộp cả 4 loại** UNISSUED + DUPLICATE + Orphan + MISA-fail — render KÈM breakdown để phân biệt nghiệp vụ vs hạ tầng.
2. **Phạm vi:** Telegram (heartbeat 2h + EOD) + persist Redis bền. KHÔNG làm dashboard/endpoint.
3. **Mốc tổng:** tích lũy từ **08/06/2026** (ngày mở bán Lào Cai Marathon 2026).

## 🧠 Quyết định thiết kế Manager (chốt, Danny bác được khi review PRD)
- **"Tổng đã xuất"** = tích lũy: backfill 1 lần từ MISA paging khoảng `[2026-06-08 → nay]` để seed, sau đó cộng tiến theo **diff event `ISSUED`** (KHÔNG cộng snapshot mỗi tick → tránh double-count ×288/ngày).
- **"Lỗi"** = **snapshot hiện tại** ("đang có N đơn cần xử lý"), KHÔNG tích lũy. Lý do: UNISSUED hôm nay → mai xuất xong là hết lỗi; đếm tích lũy lỗi sẽ phình ảo/vô nghĩa. Snapshot mới actionable.
- **"Hôm nay xuất"** = `issuedCount` snapshot tại tick cuối (đã có sẵn) — chỉ cần nhãn rõ.

## 📂 Impact Map (module `backend/src/modules/invoice-reconcile/`)
### File sẽ chạm
- `services/daily-counters.service.ts` — THÊM cumulative counter (key no-TTL `invoice-reconcile:cumulative:issued`) + method get/incr. (~sau :52)
- `services/invoice-reconcile.service.ts` — INCR theo diff `ISSUED` (sau computeDiff ~:254) + một-lần backfill seed từ MISA `[08/06→nay]`.
- `services/alert-composer.ts` — render 3 dòng vào `composeHourlyRecap` (cả 2 state :158-195) + `composeEodRecap` (:425-447). Pure function — nhận thêm tham số.
- `services/invoice-alert.service.ts` — truyền cumulative vào 2 call site (`sendHourlyRecap` :119, `sendEodRecap` :134).
- `services/reconcile-classifier.ts` / `diff-computer.ts` — ĐỌC để lấy field error (duplicateCount :208, unissued :235, breachedCount :254, misaOrphan). KHÔNG sửa logic.

### Redis keys mới
- `invoice-reconcile:cumulative:issued` — INCR, **no TTL** (seed backfill 08/06).
- (Optional guard) `invoice-reconcile:counted-issued:<orderId>` — SETNX TTL 24h chống cộng đôi trong ngày.
- Error: KHÔNG cần key bền (snapshot tính tại chỗ từ report).

## ⚠️ Risk Flags
- 🔴 [HIGH] **Double-count cumulative** — BẮT BUỘC INCR theo diff `ISSUED` event, KHÔNG theo snapshot. Cần SETNX guard per-orderId/ngày. QC phải test tick lặp không cộng đôi.
- 🟡 [MED] **Backfill từ MISA** — query paging `[08/06→nay]` filter đơn 5BIB; one-time, idempotent (set chứ không incr). Nếu MISA fail → seed = 0, log warn, không block.
- 🟡 [MED] **Redis flushdb xoá cumulative no-TTL** — chấp nhận cho MVP (re-backfill được). Mongo-persist = effort L, KHÔNG làm.
- 🟢 [LOW] **Bot isolation** — chỉ chèn dòng vào composer qua `InvoiceTelegramClient` riêng. KHÔNG đụng bot khác. An toàn.
- 🟢 [LOW] **Telegram 4096 char cap** — đã có `truncate()`; thêm 3 dòng ngắn không vượt.
- 🟢 [LOW] **Đụng F-079** — chỉ CHÈN dòng, giữ nguyên `composeRaceTag` / 3-state / "Next heartbeat".

## 🚧 PAUSE cho BA khi viết PRD
- [ ] Xác nhận format 3 dòng tiếng Việt trong tin (tao đề xuất: `📦 Hôm nay: N/M đã xuất` · `⚠️ Đang lỗi: N (UNISSUED u · trùng d · orphan o · MISA-fail m)` · `📈 Tổng từ 08/06: K hóa đơn`).
- [ ] Backfill: nếu MISA paging `[08/06→nay]` quá nặng/chậm → fallback seed = 0 từ ngày deploy + ghi rõ "tổng từ ngày bật" thay vì 08/06?

## 🌿 Branch note (Manager)
Branch hiện tại `5bib_igloo_insurance_v1` có work landing/igloo CHƯA commit (không liên quan F-086). F-086 thuộc lineage F-076 (sống ở main + release/v1.16.0). Quyết định branch/commit để ở /5bib-deploy — đề xuất branch riêng off main, tránh trộn với igloo.

## ✅ Sẵn sàng cho /5bib-prd
Có. Spec đã lock đủ; PAUSE chỉ là xác nhận format + fallback backfill.
