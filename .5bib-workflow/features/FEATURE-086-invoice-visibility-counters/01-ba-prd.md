# FEATURE-086: PRD — Invoice Visibility Counters

**Status:** ✅ READY_FOR_PLAN
**Author:** 5bib-po-ba
**Date:** 2026-06-16

## Phase 1 — Vision & User Stories
**Persona:** Danny (operator) + Hiền (kế toán) đọc bot `@invoice_5bib_daily_bot`.
**US-1:** Là operator, tao muốn thấy **tổng hóa đơn đã xuất từ 08/06/2026** để biết quy mô tích lũy.
**US-2:** Là operator, tao muốn thấy **hôm nay đã xuất bao nhiêu / cần xuất bao nhiêu**.
**US-3:** Là operator, tao muốn thấy **đang có bao nhiêu đơn lỗi** (gộp + breakdown) để biết có cần xử lý.
**US-4:** 3 con số trên PHẢI nằm trong tin heartbeat 2h + EOD recap (không phải đào dashboard).

### Business Rules
- **BR-86-01:** "Tổng đã xuất" = MISA `/invoice/paging` `TotalCount` over range `[2026-06-08 → today ICT]`. MISA account 5BIB dùng tax code riêng → TotalCount = tổng hóa đơn 5BIB. Authoritative, idempotent (query lại ra cùng số), KHÔNG cần DB-match.
- **BR-86-02:** Anchor cutover `CUMULATIVE_START_DATE = '2026-06-08'` (Danny chốt — ngày mở bán Lào Cai Marathon 2026). Hardcoded const, KHÔNG đụng kỳ/period nào khác.
- **BR-86-03:** "Hôm nay xuất" = `report.issuedCount` / `report.expectedCount` (đã có sẵn) — chỉ cần nhãn rõ trong cả 2 state heartbeat.
- **BR-86-04:** "Đang lỗi" = **snapshot hiện tại**, KHÔNG tích lũy. `errorTotal = unissued + duplicate + orphan + misaFailToday` với:
  - `unissued` = `report.missing.filter(bucket==='UNISSUED').length` (đã gồm breached)
  - `duplicate` = `report.duplicateCount`
  - `orphan` = `report.misaOrphan.length`
  - `misaFailToday` = `dailyCounters['misa-fail'] ?? 0` (lỗi gọi MISA hôm nay — hạ tầng)
  - KHÔNG cộng `breachedCount` riêng (breached ⊂ unissued → tránh double-count).
- **BR-86-05:** Cumulative persist Redis key `invoice-reconcile:cumulative:issued` (no TTL). Refresh fresh từ MISA mỗi heartbeat (2h) + EOD. MISA fail → giữ value cũ (KHÔNG overwrite 0).
- **BR-86-06:** Mọi thao tác best-effort — Redis/MISA fail KHÔNG block heartbeat (kế thừa BR-79-23 contract: heartbeat MUST send).
- **BR-86-07:** Bot isolation tuyệt đối — chỉ chèn dòng vào composer qua `InvoiceTelegramClient` riêng. KHÔNG đụng bot/token khác.

## Phase 2 — UI/UX (tin Telegram)
### 2.1 Block "Tóm tắt" chèn vào composeHourlyRecap (CẢ 2 state)
Vị trí: ngay sau dòng `Giải: ...` + blank line, TRƯỚC block stats state-specific (để Danny thấy đầu tiên).
```
📦 Hôm nay: <b>{issuedCount}</b>/{expectedCount} đã xuất
⚠️ Đang lỗi: <b>{errorTotal}</b> (UNISSUED {u} · trùng {d} · orphan {o} · MISA-fail {m})
📈 Tổng từ 08/06: <b>{cumulativeIssued}</b> hóa đơn
```
- State "All OK" (errorTotal=0): dòng ⚠️ vẫn hiện "Đang lỗi: 0" để Danny chắc chắn không có lỗi (không ẩn).
### 2.2 composeEodRecap — thêm vào section "Tổng kết ngày"
- Thêm 1 dòng error tổng (cùng breakdown) + 1 dòng `📈 Tổng từ 08/06: N hóa đơn`.
### 2.3 States
- Heartbeat luôn render (kế thừa F-079). MISA fail → cumulativeIssued = value cũ; misaFail count tăng → phản ánh trong dòng ⚠️.

## Phase 3 — Technical Mandates (Coder)
- **MISA client:** thêm `countInvoicesInRange(from, to): Promise<number>` — fetch 1 page (skip=0, take=1) reuse `fetchPageWithRetry`, return `totalCount`. Throw-safe ở caller.
- **daily-counters.service:** thêm `setCumulativeIssued(n)` (SET no-TTL) + `getCumulativeIssued(): Promise<number>` (GET, 0 nếu miss/fail). Best-effort try/catch.
- **invoice-reconcile.service:** const `CUMULATIVE_START_DATE='2026-06-08'`; method `refreshCumulativeIssued(date): Promise<number>` — MISA count [start→date]; success → SET + return n; fail → return getCumulativeIssued() (giữ cũ). Gọi trong `runHourlyRecap` + `runEodRecap` trước compose. Đọc `misaFailToday` từ counters.getAll(date).
- **invoice-alert.service:** `sendHourlyRecap(report, diff, raceTitlesByid, extras?: {cumulativeIssued, misaFailToday})`; `sendEodRecap(date, report, extras?: {cumulativeIssued})`.
- **alert-composer:** `composeHourlyRecap(..., extras?: {cumulativeIssued, misaFailToday})` default `{0,0}` (backward-compat tests); `composeEodRecap(report, dailyCounters, dashboardUrl, extras?: {cumulativeIssued})`. Compute breakdown nội bộ từ report.
- SQL: KHÔNG có SQL mới. MISA `?`-free (body params). KHÔNG đụng reconcile/classify logic.

## Phase 4 — Testing Mandates
- **TC-86-01:** composeHourlyRecap All-OK → chứa "📦 Hôm nay: 5/5", "Đang lỗi: 0", "Tổng từ 08/06: 147".
- **TC-86-02:** composeHourlyRecap Có-issue → errorTotal = unissued+dup+orphan+misaFail đúng (vd 2+1+1+0=4), breakdown đúng.
- **TC-86-03:** errorTotal KHÔNG double-count breached (1 đơn UNISSUED+breached → đếm 1 trong unissued).
- **TC-86-04:** composeEodRecap → có dòng cumulative + error tổng.
- **TC-86-05:** refreshCumulativeIssued: MISA OK → SET + return n. MISA throw → return persisted cũ (KHÔNG overwrite). Idempotent: gọi 2 lần cùng range → cùng số (no double-count).
- **TC-86-06:** countInvoicesInRange → trả TotalCount từ page đầu (take=1).
- **TC-86-07:** extras default {0,0} → composer cũ KHÔNG vỡ (backward-compat).
- **TC-86-08:** Redis/MISA fail trong refresh → heartbeat vẫn compose + send (best-effort, BR-86-06).

## PAUSE
- Format 3 dòng — Manager đề xuất, Danny review khi đọc tin thật (reversible).
- BR-86-01 caveat: MISA TotalCount có thể gồm hóa đơn hủy/thay thế → ghi TD refine nếu số lệch.
