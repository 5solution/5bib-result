# FEATURE-081: Systemic TZ Audit — UTC/ICT boundary toàn codebase

**Status:** 🟡 INITIATED
**Created:** 2026-06-09
**Owner:** Danny
**Type:** BUGFIX (systemic — nhiều site)
**Created by:** 5bib-manager

---

## 🎯 Why this feature

F-079 hotfix4 fix 1 site TZ boundary (invoice-reconcile queryDbOrders). Danny chốt audit toàn codebase vì memory ghi nhận reconciliation `parsePeriod` cùng bug pattern (lệch 1 ngày UTC+7) từ đợt test trước. Server/container chạy UTC, business là ICT (UTC+7) — mọi chỗ convert Date → date-string hoặc month-boundary mà KHÔNG shift +7h đều lệch.

## 📂 Audit Findings (Manager grep 2026-06-09)

### 🔴 Tier A1 — Analytics display sai số, fix NGAY (KHÔNG cần PAUSE)

| # | Site | Bug | Impact |
|---|------|-----|--------|
| A1-1 | `dashboard/services/kpi.service.ts:312-324` `startOfMonth` + `fmtDate` | MTD = UTC month. Filter `payment_on >= 'YYYY-MM-01'` UTC | 4 KPI cards (GMV/Net/VĐV/Phí) sai trong 7h đầu tháng + đơn 17:00+ UTC cuối tháng đếm nhầm kỳ |
| A1-2 | `dashboard/services/sparkline.service.ts:127-128, 307, 352-368` | Daily series group theo UTC date string | Đơn ICT 00:00-06:59 sáng đếm vào ngày hôm trước — 30-day chart lệch |
| A1-3 | `analytics/analytics.service.ts:172-177` | Default `to = new Date().toISOString().slice(0,10)` = hôm nay UTC | 00:00-07:00 ICT sáng: "to" = hôm qua → analytics thiếu data hôm nay |

### 🟠 Tier A2 — Financial documents, PAUSE Danny quyết (đổi số chứng từ)

| # | Site | Bug | Impact |
|---|------|-----|--------|
| A2-1 | `reconciliation/reconciliation.service.ts:787` + `reconciliation-preflight.service.ts:387` `parsePeriod` ×2 | Kỳ tháng = UTC month. Query `payment_on BETWEEN 'MM-01 00:00:00' AND 'MM-31 23:59:59'` UTC | **Đối soát merchant lệch kỳ 7h** — đơn 1/6 00:00-06:59 ICT vào kỳ tháng 5. Memory test case đã flag. NHƯNG: recon cũ đã ký với merchant — fix = số kỳ mới khác kỳ cũ |
| A2-2 | `reconciliation/services/reconciliation.cron.ts:59-60` prev-month compute | Local TZ (container UTC) | Cron đầu tháng generate draft kỳ sai boundary |
| A2-3 | `finance/services/pnl.service.ts:375-401` period ranges | `new Date(y, m, 1)` local TZ | P&L filter kỳ lệch 7h đầu kỳ — internal analytics, ít nghiêm trọng hơn A2-1 |

### 🟢 Tier B — Cosmetic (ngày hiển thị trên document), fix kèm A1 bằng helper

| Site | Note |
|------|------|
| `reconciliation/services/docx.service.ts:237` + `xlsx.service.ts:100` | "Ngày đối soát" ký = UTC today — lệch nếu generate 00:00-07:00 ICT |
| `awards/services/podium-pdf.service.ts:207` | Ngày ký podium PDF |
| `timing/timing-admin.controller.ts:45` + `bug-reports:369` | Filename stamp — vô hại, SKIP |
| `certificates.controller.ts:206`, `sponsored.service.ts:132` | Event dates từ DB — semantics riêng, SKIP (cần verify riêng) |

### ✅ Verified ĐÚNG (không đụng)
- `invoice-reconcile` crons dùng `isoDateIct()` helper (+7h shift) — đúng
- `invoice-reconcile.service.ts` queryDbOrders — đã fix hotfix4
- `kpi/sparkline` dùng `getUTC*` consistent nội bộ — sai semantic ICT nhưng không random

## ⚠️ Risk Flags
- 🔴 HIGH (A2-1) — Đổi parsePeriod = recon kỳ mới khác số kỳ cũ đã ký merchant. Chồng lên TD-F016-FINANCE-01 (15 recon cũ đã sai categories). PHẢI Danny chốt: fix từ kỳ nào, có recompute kỳ cũ không, thông báo merchant thế nào.
- 🟡 MED (A1) — Dashboard số sẽ THAY ĐỔI sau fix (đúng hơn) — Danny cần biết để không tưởng bug.
- 🟢 LOW (B) — cosmetic.

## 🚧 PAUSE Conditions
- [ ] **PAUSE-81-01 (BLOCK A2):** Reconciliation parsePeriod fix — áp dụng từ kỳ nào? Đề xuất: chỉ kỳ MỚI (từ T6/2026), kỳ cũ giữ nguyên + note. Recompute kỳ cũ = gộp với TD-F016-FINANCE-01 migration thành đợt riêng có thông báo merchant.
- [x] PAUSE-81-02: A1 dashboard fix ngay không cần hỏi — analytics display only. ✓ (Manager tự quyết theo phân loại)

## 🎯 Scope quyết định
- **F-081 scope:** util `ict-date.util.ts` + Tier A1 (3 site) + Tier B docx/xlsx/podium signed-date. 
- **A2 DEFER** → PAUSE-81-01 chờ Danny chốt → F-082 riêng (financial migration cần kế hoạch merchant-facing).

## ✅ Sẵn sàng cho /5bib-prd: Yes (scope A1+B)
