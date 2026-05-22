# FEATURE-058: Analytics Cascade Fee Integration (Tier 0 Bugfix)

**Status:** 🟡 INITIATED
**Created:** 2026-05-22
**Owner:** Danny
**Type:** BUGFIX (financial discrepancy — analytics dashboard không tận dụng F-043 cascade)
**Severity:** 🔴 P0 — finance discrepancy

> Lưu ý số: F-057 đã PRE-RESERVED cho `/runners` restore (privacy compliance work, blocked by TD-RUNNERS-PRIVACY-CONSENT). F-058 = bugfix mới này.

---

## 🎯 Why this feature

Audit 2026-05-22 post F-043 deployment (Manager + Danny request: "kiểm tra dashboard + analytic + tính phí theo hợp đồng sau khi lên override phí bán vé theo sự kiện") phát hiện **inconsistency lớn**:

### ✅ Modules ĐÚNG sau F-043 (inherit cascade qua FeeService)
- Reconciliation preview → Tier 0 native (F-043 BR-43-16)
- Dashboard P&L per contract → `feeService.getFeeForContract()` → `computeSelfFee()` line 617 check Tier 0
- Contracts P&L list → `feeService.getFeeForContractsBulk()` cùng path

### 🔴 Module SAI — Analytics aggregate
**File:** `backend/src/modules/analytics/analytics.service.ts:119-128`

```typescript
private async getFeeConfigs(): Promise<
  Map<number, { fee_rate: number; manual_fee: number }>
> {
  const map = new Map<number, { fee_rate: number; manual_fee: number }>();
  configs.forEach((c) => {
    map.set(c.tenantId, {
      fee_rate: c.service_fee_rate ?? 5.5,        // ❌ TIER 1 only — bỏ qua event_fee_overrides
      manual_fee: c.manual_fee_per_ticket ?? 5000, // ❌ same
    });
  });
}
```

Dùng map `tenant → fee_rate` (1-to-1), KHÔNG có chiều `(tenant, race) → fee_rate` cho Tier 0 override.

### Impact thực tế

Tenant "Cát Tiên Adventure" (123) với:
- MerchantConfig default `5%`
- Event override race 12345: `7%`

| Module | Phí cho race 12345 | Đúng? |
|--------|---------------------|-------|
| Reconciliation | 7% | ✅ |
| Dashboard P&L | 7% | ✅ |
| **Analytics overview/daily/top-races/merchant-comparison** | **5%** | 🔴 **SAI — báo cáo lệch ~2% × GMV race đó** |

→ Finance team reconcile cuối tháng sẽ phát hiện **dashboard tổng Analytics ≠ tổng Reconciliation** → mất uy tín hệ thống.

---

## 📂 Impact Map

### Backend (1 module modify + tests)

- ✏️ `backend/src/modules/analytics/analytics.service.ts` — refactor `getFeeConfigs()` + 9 methods downstream tính platform fee
- ✏️ `backend/src/modules/analytics/analytics.module.ts` — register `FeeService` import nếu chọn Option α (delegate sang FeeService)
- ✏️ `backend/src/modules/analytics/services/analytics-aggregator.cron.ts` — verify cron không cache stale (Redis flush key trên override mutation)
- ✏️ `backend/src/modules/merchant/merchant.service.ts` — extend cache flush sau POST/PUT/DELETE event override để invalidate `analytics:*` keys (F-043 đã flush `pnl:*` + `merchant:fee-overrides:*`, chưa flush `analytics:*`)
- ➕ NEW `backend/src/modules/analytics/services/fee-resolver.service.ts` (optional Option β) — extract Tier 0 cascade thành helper riêng

### Tests
- ➕ NEW `backend/src/modules/analytics/analytics.service.f058.spec.ts` — 8-10 tests verify Tier 0 cascade applied per-race
- ✏️ EXTEND merchant.service.f043.spec để verify cache flush key `analytics:*` được trigger

### File then chốt cần đọc

- `backend/src/modules/analytics/analytics.service.ts` (1062 LoC)
- `backend/src/modules/analytics/analytics.module.ts` — DI graph
- `backend/src/modules/analytics/analytics-aggregator.cron.ts` — cron timing 15min + lock
- `backend/src/modules/finance/services/fee.service.ts:585-650` — `computeSelfFee()` Tier 0 logic (reference pattern)
- `backend/src/modules/merchant/merchant.service.ts:flushEventOverrideCache()` — current cache flush keys

### Endpoint affected (15 endpoint)

Tất cả `/api/analytics/*` endpoint touch platform fee:
- `GET /analytics/overview` — fee per tenant aggregate
- `GET /analytics/revenue/daily` — daily revenue per tenant
- `GET /analytics/top-races` — race ranking by fee revenue
- `GET /analytics/revenue-by-category`
- `GET /analytics/races/:raceId/detail` — per-race fee breakdown
- `GET /analytics/merchants` — merchant comparison
- `GET /analytics/funnel`
- `GET /analytics/repeat-athlete-rate`
- `GET /analytics/merchant-churn`
- `GET /analytics/time-to-fill`
- `GET /analytics/claim-rate`
- `GET /analytics/geographic-demographic`
- (+ 3 endpoint khác không touch fee — skip)

### Schema/DB

- **MongoDB:** KHÔNG đụng (chỉ đọc `MerchantConfig.event_fee_overrides[]`)
- **MySQL platform:** KHÔNG đụng (chỉ aggregate orders như hiện tại)
- **Redis:** Cache invalidate mở rộng:
  - F-043 hiện flush: `pnl:*:tenant=<id>` + `pnl:contracts-list:*` + `merchant:fee-overrides:<tenantId>`
  - **F-058 THÊM:** `analytics:overview:*`, `analytics:daily:*`, `analytics:top-races:*`, `analytics:rev-by-cat:*`, `analytics:merchants:*`, `analytics:races:*` — tất cả keys chứa monthly/period data có thể chứa override-affected fee

---

## ⚠️ Risk Flags

- 🔴 **HIGH — Performance regression** Analytics endpoint nặng (aggregate 42K orders × 195 race). Hiện chỉ 1 query MySQL group by `tenant_id` → tính fee map. Với F-058 cần group by `(tenant_id, race_id)` → potentially N× rows. **Mandatory:** benchmark trước/sau (p95 query latency phải < 2x), nếu vượt → Option γ (denormalize override map in-memory)
- 🟡 **MED — Analytics cron warm cache 15 min** — race condition giữa cron warm + override mutation flush. Cần verify: nếu user tạo override LÚC cron đang chạy → cron có thể serve stale. Mitigate: SETNX lock + flush AFTER cron complete (existing pattern)
- 🟡 **MED — Cache key explosion** F-058 thêm flush keys → mỗi POST/PUT/DELETE override sẽ DEL ~6 analytics key patterns × tenant. Redis SCAN cost OK với 58 tenant, monitor nếu scale lên 500+
- 🟢 **LOW — Backward compat** F-058 chỉ FIX silent bug — KHÔNG break response shape. Existing consumers (admin dashboard, finance team) thấy số chính xác hơn (đúng cascade)
- 🟢 **LOW — Naming collision F-040 vs F-043** — KHÔNG đụng trong F-058 (defer separate refactor sau)

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

### PAUSE-58-01 — Tech approach cho Analytics cascade

Có 3 cách áp Tier 0:

- **Option α — Delegate sang `FeeService`** (cleanest): Analytics method gọi `feeService.computeFeeForOrders(tenantId, raceId, orders, periodFrom)`. Lợi: 1 source of truth cascade. Hại: `FeeService.computeSelfFee` hiện tại design per-contract, không per-race. Cần extend new method.
- **Option β — Inline Tier 0 lookup trong analytics**: Analytics query `MerchantConfig.event_fee_overrides` lookup map `(tenant,race) → override`. Lợi: minimal blast radius. Hại: duplicate cascade logic (DRY violation, future divergence risk).
- **Option γ — Denormalize override into MySQL view/cache** (extreme): Pre-compute `(tenant,race) → effective_fee_rate` table refresh on override mutation. Lợi: zero query cost. Hại: complexity, sync risk, MySQL schema change.

Manager đề xuất **Option β** ngắn hạn (1 sprint fix) — minimal risk, đúng pattern current analytics. Sau đó refactor sang Option α trong F-059/F-060 nếu DRY violation pain.

### PAUSE-58-02 — Manual fee cascade

`event_fee_overrides[].manual_fee_per_ticket` cũng cascade (per BR-43-06 independent per-field). Analytics có dùng `manual_fee` cho MANUAL orders. Câu hỏi:

- **Option A** — Áp tier 0 cho cả `manual_fee_per_ticket` (đầy đủ cascade per-field)
- **Option B** — Chỉ áp tier 0 cho `service_fee_rate`, `manual_fee` giữ default merchant (giảm scope, fix critical first)

Manager đề xuất **Option A** — consistency với F-043 BR-43-06 (independent per-field cascade). Không nửa vời.

### PAUSE-58-03 — Effective date filter cho analytics

F-043 BR-43-07: `effective_from <= periodFromCheck` mới apply override.

Analytics aggregate **monthly** (vd query month=2026-06). Câu hỏi:

- **Option A — periodFromCheck = month start** (`2026-06-01`): override với `effective_from = 2026-06-15` KHÔNG apply cho month 2026-06 (vì 2026-06-15 > 2026-06-01)
- **Option B — periodFromCheck = month end** (`2026-06-30`): override apply nếu effective trong tháng
- **Option C — Pro-rate** (chính xác nhất): order date >= effective_from → áp override; order date < effective_from → default. Cần granularity per-order.

Manager đề xuất **Option C** — chính xác nhất, match Reconciliation behavior. Nhưng cost cao (per-order check). Nếu performance regression > 2× → fallback Option B.

### PAUSE-58-04 — Backfill historical data

Analytics có data từ 2024-2025 trước khi F-043 ship. Câu hỏi: có cần recompute lại số liệu cũ với override mới không?

- **Option A** — KHÔNG backfill (override mới chỉ áp forward từ effective_from)
- **Option B** — Backfill nếu override có effective_from < today (rewrite history)
- **Option C** — Cho admin trigger backfill manual nếu cần

Manager đề xuất **Option A** — KHÔNG backfill. Override semantic là "forward effective". Backfill rewrite history sẽ confuse finance team. F-043 BR-43-08 explicitly states "no retro" for reconciliation, F-058 follow nguyên tắc.

### PAUSE-58-05 — Discrepancy alert mechanism

Hiện tại không có alert khi Analytics vs Reconciliation số lệch. Sau F-058 fix, có nên add monitoring không?

- **Option A** — Add cron job daily compare Analytics totals vs Reconciliation totals per tenant, alert Slack nếu lệch > 1%
- **Option B** — Skip — trust F-058 fix, không cần monitoring
- **Option C** — Manual admin endpoint `GET /api/analytics/discrepancy-check?tenantId=X&month=Y` cho finance team chạy ad-hoc

Manager đề xuất **Option C** — minimal infra, finance team chủ động check. Option A nếu Danny muốn pro-active alert (slack integration cost).

### PAUSE-58-06 — Test data realistic

Test fixture cho F-058: cần override scenario rõ ràng. Đề xuất:

- Tenant 1 (test): MerchantConfig 5% default + 0 event override → analytics = 5% (regression baseline)
- Tenant 2: MerchantConfig 5% + override race A 7% effective 2026-06-01 → analytics tháng 6 = 7% cho race A, 5% cho race khác
- Tenant 3: KHÔNG có MerchantConfig (legacy) + override → fallback tier 2 contract / tier 3 platform default
- Tenant 4: Override với manual_fee + service_fee_rate cùng lúc → both apply

Confirm test scope đầy đủ?

---

## ✅ Sẵn sàng cho `/5bib-prd`

**Manager verdict:** ✅ READY — feature scope rõ, bug confirmed bằng code spot-check, 6 PAUSE locked.

### 📌 Danny answers 2026-05-22

| # | Quyết định | Implication |
|---|------------|-------------|
| **PAUSE-58-01** | ✅ **A — Delegate FeeService** | Extend `FeeService` với method mới `computeFeeForRaceAggregate(tenantId, raceId, orders[], periodFrom)` hoặc `computeFeeForOrdersBulk(tenantId, mapByRace, periodWindow)`. KHÔNG inline duplicate cascade logic trong analytics. 1 source of truth. |
| **PAUSE-58-02** | ✅ **A — Manual fee cascade** | Tier 0 áp cho cả `service_fee_rate` + `manual_fee_per_ticket` + `fee_vat_rate` (3 field) per BR-43-06 |
| **PAUSE-58-03** | ✅ **C — Per-order pro-rate** | Chính xác nhất, match Reconciliation behavior. Cost cao (per-order check). **MANDATORY perf benchmark** — nếu p95 >2× → escalate Danny xét fallback Option B |
| **PAUSE-58-04** | ✅ **KHÔNG backfill** | Forward-only như F-043 BR-43-08. Override mới chỉ apply forward từ effective_from. Historical data giữ nguyên |
| **PAUSE-58-05** | ✅ **C — Admin manual check endpoint** | Add `GET /api/analytics/discrepancy-check?tenantId=X&month=Y` cho finance team ad-hoc check. KHÔNG cron alert |
| **PAUSE-58-06** | ✅ **Test scope đủ** | 4 tenant scenarios confirmed: clean / override-only-rate / legacy-no-config / multi-field-override |

**Next step:** BA chạy `/5bib-prd FEATURE-058-analytics-cascade-fix` viết PRD đầy đủ.

---

## 📋 Scope ngoài tầm (out of scope)

- ❌ Rename F-040 `FeeSource` enum vs F-043 `feeSource` collision — defer F-059 (REFACTOR)
- ❌ Analytics Per-Event/Per-Day enhancement (F-039) — riêng feature pending Danny
- ❌ Analytics frontend UI changes (admin dashboard) — backend fix đủ
- ❌ Migration MongoDB/MySQL — F-058 chỉ logic refactor
- ❌ Add new analytics endpoint — chỉ fix 12 endpoint existing

---

## 📊 Estimated effort

| Layer | Files | Days |
|-------|-------|------|
| Analytics service refactor | 1 modify (analytics.service.ts ~200 LoC change) | 1.5 |
| Cache flush extension | 1 modify (merchant.service.ts flushCache method) | 0.5 |
| Unit tests | 1 spec file (8-10 tests) | 1 |
| Performance benchmark | Manual + paste output | 0.5 |
| QC E2E + dependency module regression | — | 1.5 |
| **Total dev + QC** | | **~5 ngày** |

Sprint estimate: **1 tuần** end-to-end (dev + QC + deploy).
