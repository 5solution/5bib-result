# FEATURE-077 — QC Report (Import-ticket counting)

**Verdict:** ✅ APPROVED (DEV) — pending Danny PROD sign-off
**Date:** 2026-06-08 · **Tester:** Claude (BE+FE) · **Race:** 209 tenant 14 (acct minhnb9897)

## Phase 1 — Code/data spot-check
- `codes` canonical filter `deleted=0 AND status IN ('ACTIVE','SENT')` verified vs live DB.
- Source split `order_id IS NULL` = import: race 209 → 432 (5BIB) + 212 (import) = 644.
- Revenue path UNTOUCHED (order-based) — confirmed `codes.value=0` for all rows.

## Phase 2 — Backend
- 170 jest PASS (+1 new SQL-shape assertion). `npx nest build` OK (compiled JS has 4 `FROM codes c`).
- Live SQL parity: summary 644/432/212; by-course 311(253+58)/168(117+51)/165(62+103);
  by-type 222/118/102/89/66/47=644; capacity sold per type sums 644.

## Phase 3 — Frontend (browser-UAT on merchant-dev.5bib.com, 2 deploys)
| Screen | Expected | Actual | ✓ |
|---|---|---|---|
| Tổng vé bán | 644 (5BIB 432·Import 212) | 644 (432·212) | ✓ |
| Vé đã thanh toán | order-paid (tách riêng) | 452 "Đã thu qua 5BIB" | ✓ |
| Vé import (KPI mới) | 212 | 212 "Bán nguồn khác, import vào 5BIB" | ✓ |
| Theo cự ly | 311/168/165 | 311·48.3% / 168·26.1% / 165·25.6% | ✓ |
| Donut theo loại | center 644 | 644, 6 slices = 644 | ✓ |
| Sức chứa theo cự ly | 311/168/165 incl import | 311/168/165 /4.000 | ✓ |
| Cơ cấu VĐV total | 644 (432·212) | 644 (Qua 5BIB 432·Import 212) | ✓ |
| Coverage note | "N vé có dữ liệu" | "dựa trên 428 vé có dữ liệu — vé import chưa có thông tin" | ✓ |
| Size empty-state | giải chưa thu size | "Giải này chưa thu dữ liệu size áo" | ✓ |

## Bug found & fixed during QC
- Participant KPI sub showed "Qua 5BIB: 428" (demographics-coverage) → không cộng ra 644.
  Fix (commit 85f5a31): dùng `totalIssued − issuedImport` = 432 cho source split, giữ 428 ở note.
  Re-verified post-redeploy: "Qua 5BIB: 432 · Import: 212" = 644 ✓.

## Known limitation (documented, accepted)
- Import/MANUAL BIBs không có demographics (user_id NULL, không FK sạch tới athlete_subinfo)
  → biểu đồ cơ cấu chỉ trên 5BIB tickets có dữ liệu (428). Tổng VĐV vẫn đúng (644). Note hiển thị rõ.

## Deploy
- DEV commits: `0f2f1b2` (BE+FE), `85f5a31` (FE polish). Both live on DEV verified by image revision label.
- PROD: chờ Danny approve `release/v*`.
