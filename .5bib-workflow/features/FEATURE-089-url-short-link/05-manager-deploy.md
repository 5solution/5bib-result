# FEATURE-089: Deploy & Memory Sync

**Status:** ✅ DONE
**Deployed (memory-closed):** 2026-06-17
**Author:** 5bib-manager
**Linked:** `00`–`04` + `IMPLEMENTATION_NOTES.md`

---

## 📌 Pre-flight check
- [x] `04-qc-report.md` verdict = ✅ APPROVED
- [x] Unit tests PASS (27/27 sau Manager fix; 15 service + 12 QC)
- [x] Files changed khớp Scope Lock `02` (3 deviation documented, KHÔNG creep)
- [x] `IMPLEMENTATION_NOTES.md` đủ 4 sections (Deviations + Forced + Tradeoffs + Reviewer Notes)

## 📊 Deploy summary
- QC verdict: ✅ APPROVED — 0 CRITICAL/HIGH, 12/12 BR, 9/9 UI state, 4 persona.
- Tests: **27/27 PASS**. tsc clean (backend + admin + frontend, scoped). Anti-pattern scan clean ×3 app.
- Migration: KHÔNG. Dep mới: KHÔNG. SDK regen: N/A (hand-typed wrapper).
- Git: **CHƯA commit/push** (Danny chưa yêu cầu). Working tree on branch `5bib_invoice_v2`. Đề xuất tách `5bib_short_link_v1` khi Danny commit.
- Infra gate (ops, KHÔNG block code): `s.5bib.com` DNS + nginx vhost (clone result-fe-dev → frontend 3082) + certbot SSL.

## 🔬 Manager Independent Code Review (MANDATORY — đọc code thật)

Spot-check theo IMPLEMENTATION_NOTES §4 priority:

| # | File / range | Verdict | Findings |
|---|--------------|---------|----------|
| 1 | `short-links.service.ts:resolve()+queryActive()+bumpClick()` (155-220) | 🔴→✅ FIXED | **RED FLAG CAUGHT:** `queryActive()` trả null có 2 nghĩa (doc-absent vs contention "cache đã warm") nhưng `resolve()` throw 404 cho cả 2 → spurious 404 dưới stampede (F-083 landing có cùng latent). **FIX:** re-read cache trước throw + 1 unit test. Verified 27/27. |
| 2 | `short-links.service.ts:create()` (52-95) | ✅ | alias reserved (case-insensitive) trước insert; random retry ≤5 + E11000 detect; dup→409. BR-01/02/03 đúng. |
| 3 | `frontend/middleware.ts:124-138` | ✅ | branch `isShortLinkHost` đặt TRƯỚC landing catch-all; `s/go/link` reserved → không vỡ landing/timing/solution. root `/`→redirect 5bib.com; loại `/api`+`/r/`. |
| 4 | `short-links.controller.ts` | ✅ | route-order `resolve/:code` trước `:id`; `LogtoAdminGuard` mọi mutation + list + qr (QC Reflect test confirm); resolve public. QR `StreamableFile` + Content-Type png. `user.sub` cho createdBy. |
| 5 | `frontend/app/r/[code]/route.ts` | ✅ | Next 16 async params; 302 + fallback `https://5bib.com` mọi lỗi (no 500/blank); `cache:'no-store'`. |

**Type safety:** 0 `as unknown as` (đã fix bằng khai báo timestamps trên schema). **Security:** open-redirect chặn DTO regex; no leak `_id/createdBy`; reserved alias; no SQL. **Verdict: ✅ APPROVED sau fix** — 0 red flag tồn đọng.

## 📝 Memory diff (đã apply)
- `feature-log.md`: Counter giữ `FEATURE-091`. In-flight F-089 → moved. Shipped table +1 row (top). F-090 vẫn In-flight.
- `change-history.md`: append entry đầy đủ (top) — 16 file + architecture/conventions/lessons.
- `codebase-map.md`: thêm node `short-links/` dưới backend modules.
- `known-issues.md`: +3 TD (TD-F089-RATELIMIT / LIVE-E2E / ANALYTICS).
- `CLAUDE.md`: Redis registry +2 key (`shortlink:code:` / `shortlink-lock:`).
- `conventions.md`: (ghi trong change-history) refinement SETNX null-semantics 2 nghĩa — re-read cache trước 404.

## 🔮 Follow-up
- Ops: dựng `s.5bib.com` (DNS+nginx+SSL) → chạy TD-F089-LIVE-E2E.
- F-083 landing có cùng latent contention-404 → cân nhắc backport fix (track riêng nếu Danny muốn).
- Tiếp theo: **F-090 GCN cho Crew** (Danny "làm cả").

## ✅ Status
🎉 **FEATURE-089 DONE** — memory synced. Code ready (working tree), Danny commit khi sẵn sàng.
