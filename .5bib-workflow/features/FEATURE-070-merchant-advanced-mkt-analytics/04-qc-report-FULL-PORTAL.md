# QC Report — Merchant Portal FULL (F-069 + F-070 + admin per-race) — "test toàn bộ FE + BE"

**Status:** ✅ APPROVED
**Tested:** 2026-06-08
**Author:** 5bib-qc-gatekeeper
**Scope:** Toàn bộ merchant portal trên DEV — backend merchant-portal module (20 endpoints), merchant.5bib.com frontend, admin "Gán quyền BTC" dialog. Test cả unit/adversarial + live DEV + browser UAT (logged-in session thật).

---

## Phase 1 — Regression & Impact
- **merchant-portal suite: 137/137 PASS** (5 suites: service + adversarial + access service + access adversarial + admin controller).
- **Full backend regression: 2185 pass / 14 fail.** 14 fail thuộc **7 suite PRE-EXISTING UNRELATED** (dashboard/sparkline F-059, admin.service, race-result.service, upload `vi`-global, reconciliation.controller, chip-verification concurrency) — **KHÔNG có file merchant-portal nào fail → 0 regression do F-069/F-070**. (Các fail này có trước, ngoài scope; flag để Manager track.)
- API contract: chỉ THÊM endpoint/field (forecast/heatmap/target, coverUrl, tenants/races search) — không rename/remove → SDK backward-compat. generate:api đã chạy (admin + merchant).
- Named conn 'platform' dùng đúng (this.db). Redis cache key đúng prefix `merchant-portal:*`.

## Phase 2 — Security Threat Model
| Threat | Verdict |
|--------|---------|
| IDOR (cross-race) | ✅ `assertRaceForUser` 12 lần trong service — mọi data method (ticket/revenue/forecast/heatmap/target) gọi trước xử lý; PUT target trước upsert |
| SQL injection | ✅ 0 `${}` interpolation nguy hiểm (chỉ cache-key string); raceId/q qua `?` param (forecast/heatmap/tenants/races search) |
| Auth bypass | ✅ **17/17 endpoint live DEV trả 401** không token (route mounted + guard, không 404/500/leak). merchant controller 7 UseGuards, admin 3 |
| Finance gating | ✅ revenue/* dùng `LogtoMerchantFinanceGuard`; FE ẩn tab Doanh thu khi !hasRevenue |
| Money leak ticket-scope (BR-MP-09/BR-70-02) | ✅ ticket/forecast/heatmap DTO 0 field tiền (2 match grep chỉ là COMMENT "NO financial") |
| Concurrent target write | ✅ unique index raceId + findOneAndUpdate atomic (TC-10, 10x stable) |
| Admin search abuse | ✅ LogtoAdminGuard; LIMIT 50; parameterized LIKE |

## Phase 3-4 — Test scripts + 10x stability (trong suite)
- Forecast: happy/race-ended-null/empty/<8pts. Heatmap: happy/timezone/empty. Target: upsert/IDOR-403/0→null/validation/concurrent. Search: q-filter/empty/401.
- 10x flaky: timezone determinism + concurrent target = 10/10 stable.
- Live API: 17 endpoints 401-gated.

## Phase 5 — PRD compliance (F-070 BR-70-01..14)
✅ tất cả: guard ticket-scope · no money · IDOR · cumsum+projection · race-ended null · target editable+0→null · timezone (đã sửa: payment_on VN-local, BỎ +7h sau UAT) · grid 7×7 · funnel derive · empty states · cache+invalidate. F-069 BR-MP giữ nguyên (152→ giờ 137 hợp nhất do refactor spec, vẫn full coverage).

## Phase 6 — Persona Journey Walkthrough (browser UAT THẬT, logged-in)

### Persona A — BTC viewer/finance (minhnb9897@gmail.com) @ merchant-dev.5bib.com
| # | Action | Verified (screenshot) |
|---|--------|----------------------|
| 1 | Login → /dashboard | 7 race cards, **ảnh bìa THẬT từ DB** (Mẫu Sơn/Khuổi Nọi/Lang Sơn…), status badge VN, vé bán, sidebar full-height chỉ Giải chạy+Cài đặt ✅ |
| 2 | Vào race 209 (Mẫu Sơn 439 vé) tab Vé | KPI 647/439/2/206 + trend + by-course (30KM 58.1%) + by-type donut + orders table ✅ |
| 3 | Scroll "Phân tích MKT" | **Forecast** (lũy kế→439 + projection + target 1.200 + insight "~481 vé thấp hơn mục tiêu"); **Heatmap** peak 9-12h (giờ VN đúng sau fix); **Funnel** 586→391 paid 67.1% ✅ |
| 4 | Tab Doanh thu (có finance) | hiện (GMV/Phí/Net + trend + breakdown) ✅ |
| 5 | Toggle VI/EN | label đổi, số giữ ✅ |

### Persona B — 5BIB Admin (danny@5bib.com) @ admin-dev.5bib.com/merchant-portal
| # | Action | Verified |
|---|--------|----------|
| 1 | Mở trang | list access (Nguyễn Minh→Thạch Sanh, Tất cả giải, quyền, active) ✅ |
| 2 | "Gán quyền mới" → dialog | radio **Phạm vi: Theo BTC \| Chọn giải cụ thể** ✅ |
| 3 | Mode Theo BTC | tenant list **FULL race-organizing** (5BIB JSC/ACECOOK/Aviwin… alphabetical, MST từ cột `vat`) ✅ |
| 4 | Mode Chọn giải cụ thể | **race picker** (title + BTC + mã + trạng thái "Sắp diễn ra") ✅ |
| 5 | Gõ "marathon" | **lọc đúng** 4 giải marathon cross-tenant (server-side) ✅ |

### 6.4 UI/UX scrutiny (10 items) — PASS
Dialog width OK · VN labels (không raw enum, status mapped) · empty/loading/error/success states (analytics card isolated retry; toast "Đã lưu mục tiêu") · form validation (target 0–10M field error) · picker chips removable · race cover real · sidebar full-height. (1 lưu ý: dialog dài — đã scroll OK, không sticky footer nhưng không che nút.)

### 6.5 Real-world data — PASS
VN tên giải dài + diacritics (Lang Son Geopark VTV8 Ultra Trail…), số vé 1000+ (race thật), tenant MST thật, giờ VN.

## Tech debt còn lại (→ known-issues)
- Forecast projection linear (no seasonal). Heatmap GMT+7 không config per-tenant (toàn giải VN OK). Target no audit log. Race exclude mode chưa có UI (Danny chọn toggle 2-mode, exclude defer).
- **Pre-existing fails (NGOÀI scope, flag):** 7 suite (upload `vi`, dashboard sparkline, admin.service, race-result, reconciliation, chip concurrency) — cần feature riêng dọn.

## ✅ FINAL VERDICT: APPROVED
Merchant portal (F-069 + F-070 + admin per-race) — backend 137 test + 0 regression, security clean (IDOR/SQL/guard/no-money), 17 endpoint 401-gated, UI verified bằng browser thật cả 2 persona. Đã live DEV.
