# FEATURE-069 M2b-1 — Implementation Notes (Reviewer's Guide)

**Milestone:** M2b-1 — Merchant Portal core (resolveAccessibleRaces + /me + /races)
**Date:** 2026-06-05

---

## Section 1: 🚧 Deviations from Spec (intentional)

- **[Deviation #1] Admin-list `raceCount` giữ `'__all'` sentinel, KHÔNG dùng real count**
  - **Spec said:** TD-F069-M2a-RACECOUNT-PLACEHOLDER — "M2b implements real count via resolveAccessibleRaces(userId).size"
  - **I did:** Merchant-facing endpoints (`/me` `assignedRaceCount`, `/races` `total`) dùng REAL count qua `resolveAccessibleRaces().size`. Admin-list endpoint (M2a `findAll`) GIỮ `'__all'` sentinel.
  - **Why:** Real count cho admin-list = gọi resolveAccessibleRaces per config row → N+1 SQL trên list endpoint (mỗi config 1-2 MySQL queries). Admin-list hiển thị nhiều configs → expensive. `'__all'` render label "Tất cả giải" có nghĩa UX. Cái user THỰC SỰ thấy (merchant portal) đã có real count.
  - **Reviewer should check:** Nếu admin UX cần exact count per config trên list → implement batched query (1 query GROUP BY tenant_id cho all configs trong page) thay vì N+1. Track TD-F069-M2b-RACECOUNT-ADMINLIST.

- **[Deviation #2] 2 queries cho race list thay vì 1 JOIN**
  - **Spec said:** R3 ticket aggregate + race list — không mandate số query
  - **I did:** Query 1 = race metadata, Query 2 = ticket count GROUP BY race_id. Merge in-memory bằng Map.
  - **Why:** LEFT JOIN order_line_item vào race metadata sẽ multiply race rows theo số line item → phải GROUP BY + dedup. Tách 2 query cleaner, mỗi query bounded bởi `race_id IN (accessibleSet)` (cardinality nhỏ, không phải full scan).
  - **Reviewer should check:** Nếu accessibleSet rất lớn (agency 100+ races) → 2 query vẫn OK vì IN clause indexed. Monitor p95.

## Section 2: ⚙️ Forced Changes (reality ≠ spec)

- **[Forced #1] `assertActive` phải nằm NGOÀI try/catch của cache read**
  - **PRD assumed:** Cache hit path đơn giản parse → return
  - **Reality:** Đặt `assertActive(cfg)` trong cùng try block với `redis.get` → ForbiddenException (403 inactive) bị catch nuốt → fall-through xuống Mongo query → mất 403, user inactive vẫn đọc được config từ DB.
  - **Workaround:** Tách: parse cached value trong try (chỉ catch Redis/JSON error), gọi `assertActive` SAU try block. Caught bởi adversarial test "inactive from cache → still 403".
  - **Manager/BA action:** Ghi conventions.md — "Business exceptions (403/404) KHÔNG được nằm trong try/catch bao quanh Redis I/O. Try chỉ wrap infra call, validation/assert đẩy ra ngoài."

## Section 3: ⚖️ Tradeoffs Considered

- **Cache config + race set riêng (2 keys) vs gộp 1 key:** chọn riêng. resolveAccessibleRaces gọi getAccessConfig nội bộ → config cache tái dùng cho /me. Nếu gộp, /me phải resolve cả race set (SQL) ngay cả khi chỉ cần profile. Tách → /me cache-hit không chạm MySQL nếu race set chưa cần.
- **Negative cache cho no-config 404:** KHÔNG implement ở M2b-1. No-config là transient state (admin sắp gán) — negative cache 404 sẽ làm user vừa được gán vẫn thấy 404 tới 300s. Chấp nhận Mongo hit cho no-config (rare).

## Section 4: 🔍 Reviewer Notes — Priority spot-check order

1. **`merchant-portal.service.ts` `getAccessConfig` (cache path)** — verify assertActive ngoài try (Forced #1). 403 inactive PHẢI propagate cả cache hit lẫn DB miss.
2. **`merchant-portal.service.ts` `resolveAccessibleRaces`** — verify `status != 'DRAFT'` áp dụng cả tenant query VÀ include query (draft never leaks). Verify exclude là set-difference cuối cùng. Verify empty tenantIds + empty include → skip SQL.
3. **`merchant-portal.service.ts` `getRaces`** — verify cross-tenant 403 check TRƯỚC resolveAccessibleRaces. Verify ticket Map merge + COALESCE 0 cho race không có paid order.
4. **R3 SQL adherence** — đối chiếu mọi query với `01-ba-prd-revision-r3.md` canonical templates: `JOIN races r WHERE r.tenant_id IN (?)`, `om.deleted = 0`, `om.financial_status = 'paid'`, `r.is_delete = 0`. KHÔNG được copy SQL từ R1/R2.
5. **`merchant-portal-access.service.ts` M2b-1.1 fix** — verify `exists()` re-check sau `acquireAccessLock` trong cả update() và delete() (prevents update-after-delete resurrection + duplicate audit emit).
