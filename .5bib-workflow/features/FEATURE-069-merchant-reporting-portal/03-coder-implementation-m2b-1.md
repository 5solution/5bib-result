# FEATURE-069 M2b-1: Coder Implementation — Merchant Portal Core (resolveAccessibleRaces + /me + /races)

**Status:** 🟠 READY_FOR_QC
**Milestone:** M2b-1 (first slice of M2b — merchant-facing core)
**Date:** 2026-06-05
**Coder:** 5bib-fullstack-engineer

---

## 1. Pre-flight check

- [x] `02-manager-plan.md` APPROVED (+ R3 data-layer re-review APPROVED 2026-06-05)
- [x] Đọc `00-manager-init.md`, `01-ba-prd.md` + `01-ba-prd-revision-r3.md` (data-layer source of truth)
- [x] Đọc memory `conventions.md` (MySQL Platform DB schema section + Redis mock + SHA-256 + negative cache sentinel), `codebase-map.md` (merchant-portal entry), `known-issues.md` (TD-F069-M2a-UPDATE-AFTER-DELETE-RACE)
- [x] Đọc code thật Scope Lock: `analytics.service.ts` (`@InjectDataSource('platform')` raw `db.query()`), `fee-aggregate.helpers.ts` (proven SQL JOIN races), `logto-auth/types.ts` (LogtoUser), `current-user.decorator.ts`, `logto-merchant.guard.ts` (M1)

---

## 2. Impact Assessment (Phase 1)

**Backend:**
- **MySQL platform** — NEW read path: races scope + ticket count. Uses R3 canonical SQL verbatim (verified column-by-column vs live DB). Parameterized `?`. `JOIN races r WHERE r.tenant_id IN (?)` because `order_metadata` has NO tenant_id.
- **Redis** — 2 NEW keys: `merchant-portal:access:<userId>` + `merchant-portal:races:<userId>`, both TTL 300s. Anti-stampede không cần (per-user read, low cardinality). Invalidation reuse `MerchantPortalAccessService.invalidateUserCache` (M2a) — extended below.
- **NestJS DI** — `MerchantPortalService` registered providers + exports (cho M2b-2/3 depend). `MerchantPortalController` registered. `@InjectDataSource('platform')` resolves vì module đã có `TypeOrmModule.forFeature([Tenant], 'platform')` (M2a).

**API Contract:** 2 NEW endpoints `GET /api/merchant-portal/me` + `GET /api/merchant-portal/races`. Additive — không break SDK. `pnpm generate:api` deferred tới M4 (frontend milestone — no admin consumer yet).

## 3. Edge Cases Covered (Phase 2)

1. **No config** → 404 `404_NO_CONFIG` (user chưa được admin gán)
2. **Inactive config** → 403 `403_INACTIVE` — **cả cache path** (bug caught: assertActive ban đầu nằm trong try/catch → ForbiddenException bị swallow → fixed bằng cách đẩy assertActive ra ngoài try)
3. **Empty scope** (no tenant + no include) → empty Set, skip SQL hoàn toàn (no wasted query)
4. **Draft filter** → `status != 'DRAFT'` áp dụng cho CẢ tenant races VÀ include overrides (draft never leaks)
5. **Exclude overlap** → exclude removes from union sau cùng (set difference)
6. **IDOR** → `assertRaceAccessible(set, raceId)` throws 403 `403_NO_RACE` enumeration-safe (same response cho không tồn tại vs không quyền)
7. **Cross-tenant filter** → `getRaces(tenantId)` với tenantId ngoài user scope → 403 `403_NO_TENANT`
8. **0 paid tickets** → LEFT JOIN + COALESCE → `ticketsSold: 0` (không drop race khỏi list)
9. **Redis down** → try/catch fallback to Mongo/MySQL (graceful, log warn)

## 4. Logic & Architecture (Phase 3)

- **resolveAccessibleRaces = single source of scope.** Mọi M2b-2/3 endpoint PHẢI gọi nó trước, rồi `assertRaceAccessible`. Tránh mỗi endpoint tự re-implement scope logic (drift risk).
- **2 queries cho race list (metadata + ticket count) thay vì 1 JOIN** — tách để LEFT JOIN ticket aggregate không multiply race rows. Bounded bởi `race_id IN (accessibleSet)` nên cardinality nhỏ.
- **Cache config + race set riêng** — config TTL 300s đủ vì admin mutation flush qua invalidateUserCache. Race set cũng 300s; nếu admin đổi assignment → flush cả 2.

## 5. Files Changed

| File | Change |
|------|--------|
| `services/merchant-portal.service.ts` | **NEW** — getAccessConfig, resolveAccessibleRaces, assertRaceAccessible, getMe, getRaces |
| `merchant-portal.controller.ts` | **NEW** — GET /me + GET /races, LogtoMerchantGuard |
| `dto/merchant-me.dto.ts` | **NEW** — MerchantMeResponseDto |
| `dto/race-list.dto.ts` | **NEW** — MerchantRaceItemDto + ListResponseDto + QueryDto |
| `merchant-portal.module.ts` | register MerchantPortalService + MerchantPortalController, export service |
| `services/merchant-portal-access.service.ts` | M2b-1.1 fix update-after-delete race (`exists()` re-verify after lock) |
| `services/merchant-portal-access.adversarial.spec.ts` | Attack #1 rewrite (3 tests FIXED) |
| `services/merchant-portal-access.service.spec.ts` | add `exists` mock default |
| `services/merchant-portal.service.spec.ts` | **NEW** — 19 tests |

## 6. Tests Written

```
PASS src/modules/merchant-portal/services/merchant-portal.service.spec.ts
  MerchantPortalService
    getAccessConfig() — happy/cache hit/404/403/403-from-cache (5)
    resolveAccessibleRaces() — tenant/include/exclude/draft/cache hit/empty/inactive (7)
    assertRaceAccessible() — in set/IDOR 403 (2)
    getMe() — profile + real count + no leak (1)
    getRaces() — enriched/cross-tenant 403/empty/0-tickets (4)
Tests: 19 passed, 19 total

Full suite: 3 passed, 44 passed (incl M2a access service 25)
10x flaky: 19/19 deterministic ×10
```

## 7. Scope creep
Không. Tất cả file trong M2b Scope Lock (merchant-portal module). `merchant-portal-access.service.ts` edit = M2b-1.1 race fix (đã declared trong M2b plan).

## 8. Known limitations / Tech Debt
- **TD-F069-M2b-RACECOUNT-ADMINLIST** 🟢 LOW — admin-list `raceCount` giữ `'__all'` sentinel (Deviation #1). Merchant-facing real count DONE qua resolveAccessibleRaces. Defer batched admin-list count nếu admin UX cần.
- **TD-F069-M2b-GENERATE-API** — `pnpm generate:api` deferred to M4 (no admin/frontend consumer yet cho merchant endpoints).

## ✅ Self-Review Pipeline (Manager 2026-05-14 mandatory)

- [x] Bước 1: tsc exit 0 cho Scope Lock files (no merchant-portal errors)
- [x] Bước 2: PRD strict adherence — R3 canonical SQL verbatim (race list + ticket count), BR-MP-05/06/26 encoded
- [x] Bước 3: Anti-pattern scan clean (no console.log/any/as unknown/TODO)
- [x] Bước 4: Hand-pick mapping audit — getRaces `.map` includes all DTO fields (raceId/title/status/eventStartDate/tenantId/ticketsSold)
- [x] Bước 5: PROD-readiness — Nest DI resolves (InjectDataSource('platform') OK via M2a forFeature)
- [x] Bước 6: UI/UX — N/A (backend-only milestone)
- [x] Bước 7: Real-world data — VN race titles + diacritics trong fixtures
- [x] Bước 8: Files Changed vs Scope Lock — 0 creep
- [x] Bước 9: Generated SDK — deferred M4 (documented TD)
- [x] Bước 10: Unit tests 19 PASS + 10x flaky deterministic
- [x] Bước 11: IMPLEMENTATION_NOTES-m2b-1.md written (4 sections)

→ Status: 🟠 READY_FOR_QC
