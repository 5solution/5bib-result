# FEATURE-058: Manager Plan Review

**Reviewed:** 2026-05-22
**Reviewer:** 5bib-manager
**Verdict:** ✅ **APPROVED**
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check (Manager)

- [x] Đọc `00-manager-init.md` — 6 PAUSE init đã lock
- [x] Đọc `01-ba-prd.md` (707 LoC, 18 BR + 15 TC + 3 PAUSE phụ)
- [x] Spot-check code thật (Manager 2026-05-17 mandate):
  - ✅ `analytics.service.ts:119-128` getFeeConfigs() chỉ map `tenantId → fee_rate` (TIER 1 only) — bug confirmed
  - ✅ `fee.service.ts:585-650` `computeSelfFee()` Tier 0 logic đã có sẵn — F-058 extend method aggregate version
  - ✅ `merchant.service.ts:flushEventOverrideCache()` hiện flush 2 pattern (`pnl:*:tenant=<id>` + `merchant:fee-overrides:<tenantId>`) — F-058 thêm 6 analytics pattern
  - ✅ `analytics-aggregator.cron.ts` cron `EVERY_HOUR` (BA correction từ Manager init giả định 15min) + SETNX lock pattern existing
  - ✅ `reconciliation.service.ts` chưa có method `getTotalsByTenantMonth()` — F-058 sẽ extend (PAUSE-58-08 = A Danny chốt)

---

## ✓ PRD Validation Checklist

| # | Item | Status | Note |
|---|------|--------|------|
| 1 | User Stories đầy đủ | ✅ | Persona Finance Admin (5BIB internal) — primary user của discrepancy-check endpoint |
| 2 | Business Rules testable | ✅ | 18 BR-58-* concrete (algorithm pseudo code, field path, perf budget, response shape) |
| 3 | UI states | ✅ | KHÔNG có frontend UI (backend fix) — response shape rõ ràng cho future admin dashboard |
| 4 | Data source rõ | ✅ | MerchantConfig.event_fee_overrides + MySQL orders.created_at (PAUSE-58-07 = A `created_at`) |
| 5 | DB change | N/A | Zero schema migration |
| 6 | API contract | ✅ | Additive only: 1 endpoint NEW `/api/analytics/discrepancy-check`. 12 endpoint existing giữ response shape (chỉ số bên trong đúng cascade) |
| 7 | Performance SLA cụ thể | ✅ | BR-58-11 p95 < 2× baseline. Endpoint critical: `/analytics/overview` + `/analytics/top-races` mandatory benchmark paste output |
| 8 | Security | ✅ | `LogtoAdminGuard` cho `/discrepancy-check` (finance team only). KHÔNG leak tenant data cross-tenant |
| 9 | PAUSE 9/9 lock | ✅ | 6 init (Danny chốt 2026-05-22) + 3 BA flag (Danny chốt 2026-05-22) |
| 10 | Tiếng Việt | ✅ | PRD 100% tiếng Việt (BR + UI + decisions), code/identifier giữ EN |
| 11 | Test coverage | ✅ | 15 TC + 8-10 unit tests cover 4 tenant scenarios + perf benchmark + concurrent race + backward compat regression |
| 12 | Backward compat | ✅ | KHÔNG backfill (PAUSE-58-04). Tenant không override → response shape + số liệu KHÔNG đổi (regression baseline test TC-58-01) |

**Tổng kết:** ✅ All 12 PASS.

---

## 📋 Files được phép thay đổi (Scope Lock — DỨT KHOÁT)

Coder CHỈ được đụng 10 file dưới. Ngoài Scope Lock = scope creep, phải hỏi Manager.

### 🆕 NEW (3 file)

| # | File | Mục đích | LoC |
|---|------|----------|-----|
| 1 | `backend/src/modules/analytics/dto/analytics-discrepancy.dto.ts` | Request + Response DTO cho `/discrepancy-check` (per-tenant per-month delta) | ~80 |
| 2 | `backend/src/modules/finance/dto/fee-aggregate.dto.ts` | DTO cho `FeeService.computeFeeForOrdersAggregate()` input/output | ~60 |
| 3 | `backend/src/modules/analytics/analytics.service.f058.spec.ts` | 8-10 unit tests cover 4 tenant scenarios + cascade per-order pro-rate + perf | ~250 |

### ✏️ MODIFY (7 file)

| # | File | Thay đổi | Δ LoC |
|---|------|----------|-------|
| 4 | `backend/src/modules/finance/services/fee.service.ts` | EXTEND method `computeFeeForOrdersAggregate(tenantId, mapByRace, periodFrom, periodTo)` — per-order pro-rate dùng `order.created_at` (PAUSE-58-07 = A). 3-field cascade (rate + manual_fee + vat per BR-43-06). **KHÔNG sửa `computeSelfFee()`** existing | +150 |
| 5 | `backend/src/modules/analytics/analytics.service.ts` | DELETE `getFeeConfigs()` (line 119-128). Refactor 12 method downstream: gọi `feeService.computeFeeForOrdersAggregate()` thay vì map tenant→rate. SQL query group by `(tenant_id, race_id, order_date)` thay vì chỉ `tenant_id`. Backward compat response shape | +280 / -50 |
| 6 | `backend/src/modules/analytics/analytics.module.ts` | Import `FinanceModule` (export FeeService) cho DI | +5 |
| 7 | `backend/src/modules/analytics/analytics.controller.ts` | NEW `@Get('discrepancy-check')` method với LogtoAdminGuard + full Swagger annotation | +60 |
| 8 | `backend/src/modules/merchant/merchant.service.ts` | EXTEND `flushEventOverrideCache()` thêm 6 analytics pattern flush: `analytics:overview:*`, `analytics:daily:*`, `analytics:top-races:*`, `analytics:rev-by-cat:*`, `analytics:merchants:*`, `analytics:races:*` | +25 |
| 9 | `backend/src/modules/reconciliation/reconciliation.service.ts` | NEW method `getTotalsByTenantMonth(tenantId, month)` trả `{totalFee, totalGmv, reconCount}` — dùng cho discrepancy-check (PAUSE-58-08 = A) | +80 |
| 10 | `backend/src/modules/finance/services/fee.service.spec.ts` | EXTEND perf benchmark TC cho `computeFeeForOrdersAggregate` — paste p95 output PASS với cost < 2× baseline | +120 |

**Tổng:** 3 NEW + 7 MODIFY = **10 file** (~1110 LoC tổng).

**KHÔNG được đụng:**
- ❌ `fee.service.ts:computeSelfFee()` existing (F-040+F-043 territory — KHÔNG modify, chỉ extend method aggregate mới)
- ❌ `analytics-aggregator.cron.ts` (verify đúng pattern lock + flush, KHÔNG sửa unless flush sequence sai)
- ❌ Frontend admin dashboard UI (F-058 backend fix only — UI defer F-059 nếu cần)
- ❌ Bất kỳ file trong `admin/`, `frontend/`, `selling-web/`
- ❌ MongoDB/MySQL schema migration
- ❌ Existing analytics endpoint 12 cái (response shape giữ nguyên — chỉ thay đổi internal computation)

---

## 🔧 Tech Approach (Coder reference)

### 1. FeeService extend method signature (PAUSE-58-01 = A)

```typescript
// backend/src/modules/finance/services/fee.service.ts

interface OrderForFee {
  id: number;
  raceId: number;
  total_price: number;
  total_discounts: number;
  order_category: string;
  created_at: Date;  // PAUSE-58-07 = A — field decisive
  ticket_quantity?: number;  // MANUAL only
}

interface AggregateFeeResult {
  tenantId: number;
  totalFee: number;
  totalGmv: number;
  feeSourceBreakdown: Record<string, number>;  // {event_override: 1234, merchant_default: 567, ...}
  appliedOverrides: Array<{ raceId: number; field: string; effectiveFrom: string }>;
}

async computeFeeForOrdersAggregate(
  tenantId: number,
  orders: OrderForFee[],
  periodFrom: Date,
  periodTo: Date,
): Promise<AggregateFeeResult> {
  // 1. Load MerchantConfig once (cache merchant:fee-overrides:<tenantId>)
  const config = await this.merchantConfigModel.findOne({ tenantId }).lean();
  
  // 2. Group orders by raceId
  const ordersByRace = new Map<number, OrderForFee[]>();
  orders.forEach(o => {
    const arr = ordersByRace.get(o.raceId) ?? [];
    arr.push(o);
    ordersByRace.set(o.raceId, arr);
  });
  
  // 3. Per-race + per-order cascade (Option C pro-rate)
  let totalFee = 0;
  let totalGmv = 0;
  const breakdown: Record<string, number> = {};
  
  for (const [raceId, raceOrders] of ordersByRace) {
    const override = config?.event_fee_overrides?.find(o => o.raceId === raceId);
    
    for (const order of raceOrders) {
      const orderDate = order.created_at.toISOString().slice(0, 10);
      
      // Per-field cascade independent (PAUSE-58-02 = A)
      const rateApplies = override?.service_fee_rate != null 
        && override.effective_from <= orderDate;
      const manualApplies = override?.manual_fee_per_ticket != null
        && override.effective_from <= orderDate;
      const vatApplies = override?.fee_vat_rate != null
        && override.effective_from <= orderDate;
      
      // ... compute fee per order, accumulate, update breakdown
    }
  }
  
  return { tenantId, totalFee, totalGmv, feeSourceBreakdown: breakdown, appliedOverrides };
}
```

### 2. Analytics service refactor (KHÔNG ngắt response shape)

Tất cả 12 method (overview, daily, top-races, etc) hiện tại pattern:
```typescript
const feeConfigs = await this.getFeeConfigs();  // ❌ DELETE
const tenantRows = await this.orderRepo.query(`SELECT tenant_id, SUM(...) GROUP BY tenant_id`);
for (const row of tenantRows) {
  const cfg = feeConfigs.get(row.tenant_id);
  row.fee = row.gmv * cfg.fee_rate / 100;
}
```

Refactor thành:
```typescript
const tenantOrders = await this.orderRepo.query(`
  SELECT o.tenant_id, o.race_id, o.total_price, o.created_at, o.order_category, o.ticket_quantity
  FROM orders o
  WHERE o.financial_status = 'paid' AND o.created_at BETWEEN ? AND ?
`, [periodFrom, periodTo]);

const byTenant = groupBy(tenantOrders, 'tenant_id');
for (const [tenantId, orders] of byTenant) {
  const result = await this.feeService.computeFeeForOrdersAggregate(tenantId, orders, periodFrom, periodTo);
  // ... fill response row
}
```

→ Response shape KHÔNG đổi (BR-58-14 backward compat). Số bên trong đúng cascade.

### 3. Discrepancy check endpoint (PAUSE-58-08 = A)

```typescript
// analytics.controller.ts
@Get('discrepancy-check')
@UseGuards(LogtoAdminGuard)
@ApiOperation({ summary: 'Compare Analytics vs Reconciliation totals' })
@ApiResponse({ status: 200, type: DiscrepancyResponseDto })
async checkDiscrepancy(@Query() query: DiscrepancyQueryDto): Promise<DiscrepancyResponseDto> {
  const analyticsTotal = await this.analyticsService.getTenantMonthTotal(query.tenantId, query.month);
  const reconTotal = await this.reconciliationService.getTotalsByTenantMonth(query.tenantId, query.month);
  
  const deltaFee = analyticsTotal.totalFee - reconTotal.totalFee;
  const deltaPct = reconTotal.totalFee > 0 ? Math.abs(deltaFee / reconTotal.totalFee) * 100 : null;
  
  let verdict: 'MATCH' | 'MINOR_DRIFT' | 'MAJOR_DRIFT' | 'NO_RECONCILIATION';
  if (reconTotal.reconCount === 0) verdict = 'NO_RECONCILIATION';
  else if (deltaPct < 0.5) verdict = 'MATCH';
  else if (deltaPct < 5) verdict = 'MINOR_DRIFT';
  else verdict = 'MAJOR_DRIFT';
  
  return { tenantId, month, analyticsTotal, reconTotal, deltaFee, deltaPct, verdict };
}
```

### 4. Cache flush extension (BR-58-12)

`merchant.service.ts:flushEventOverrideCache()` thêm 6 patterns:
```typescript
const patterns = [
  `pnl:*:tenant=${tenantId}`,            // F-040 existing
  `pnl:contracts-list:*`,                // F-038 existing  
  `merchant:fee-overrides:${tenantId}`,  // F-043 existing
  // F-058 NEW:
  `analytics:overview:*`,
  `analytics:daily:*`,
  `analytics:top-races:*`,
  `analytics:rev-by-cat:*`,
  `analytics:merchants:*`,
  `analytics:races:*`,
];
await Promise.all(patterns.map(p => this.redisService.scanAndDel(p)));
```

⚠️ **Performance:** 9 SCAN cycles per mutation. Với 58 tenant × ~10 months data → ~580 keys. OK với Redis nhưng monitor.

---

## 🛑 PAUSE points cho Coder

### PAUSE-Coder-01 — FeeService method bulk vs per-call

Coder phải chốt:
- **Option α** — Method nhận `orders[]` array, return aggregate (như code mẫu trên). Bulk processing, single transaction
- **Option β** — Method nhận `(tenantId, raceId, periodFrom, periodTo)`, internal query orders. Đẩy responsibility query xuống FeeService

Manager đề xuất **Option α** — analytics đã có orders rồi (từ query group), pass thẳng. Tránh DI orderRepo cross-module.

### PAUSE-Coder-02 — Cache flush timing với cron

Cron analytics chạy `EVERY_HOUR`. Override mutation flush analytics keys. Race condition:
- T=00:00: Cron start warm cache
- T=00:30: Admin tạo override → flush analytics keys
- T=00:45: Cron complete với SỐ CŨ → set key lại

Solution:
- **Option α** — Cron set key với version check (`SETNX` per-key)
- **Option β** — Mutation flush set bit `analytics:dirty:<tenant>` → cron check before set, abort nếu dirty
- **Option γ** — Cron re-fetch override config AFTER query → trước khi set key

Manager đề xuất **Option γ** — đơn giản, an toàn.

### 🛑 Bắt buộc PAUSE trước commit

- 🛑 Trước khi DELETE `getFeeConfigs()`, run regression test ALL 12 endpoint analytics — verify response shape unchanged
- 🛑 **MANDATORY perf benchmark** trước/sau refactor — paste `p95` cho `/analytics/overview` + `/analytics/top-races` vào `03-coder-implementation.md`. Nếu p95 > 2× baseline → STOP, escalate Danny (PAUSE-58-09 = C)
- 🛑 Trước khi modify `reconciliation.service.ts:getTotalsByTenantMonth()`, verify không break existing reconciliation flow (F-043)
- 🛑 Trước `pnpm install` lib mới → KHÔNG cần thêm dep, reuse existing

---

## 🧪 Unit test bắt buộc

Coder PHẢI viết 8-10 backend tests trong `analytics.service.f058.spec.ts`:

| TC | Scenario | Expected |
|----|----------|----------|
| TC-58-01 | Clean tenant no override | Analytics output IDENTICAL to pre-F-058 (regression baseline) |
| TC-58-02 | Tenant override-only-rate | Phí cho race override = `gmv × override_rate / 100`, race khác = default |
| TC-58-03 | Tenant legacy no MerchantConfig | Fallback Tier 3 platform default 5.5% |
| TC-58-04 | Tenant multi-field override (rate + manual_fee + vat) | 3 field cascade independent |
| TC-58-05 | Per-order pro-rate: order ngày 5 (trước effective_from=10) áp default, order ngày 15 áp override | Both correct |
| TC-58-06 | Cache flush: tạo override → trigger flush 9 patterns → analytics:* keys DELETED | All keys flushed |
| TC-58-07 | Cron race condition: concurrent mutation + cron run | No stale data after cron complete |
| TC-58-08 | Discrepancy check MATCH/MINOR/MAJOR/NO_RECON | 4 verdicts correct |
| TC-58-09 | Auth: `/discrepancy-check` no token | 401 |
| TC-58-10 | Backward compat: response shape diff vs main HEAD | Zero diff trong shape |

**Performance benchmark output bắt buộc paste:**
```
Pre-F-058 baseline:
  /analytics/overview p95: 245ms
  /analytics/top-races p95: 380ms

Post-F-058:
  /analytics/overview p95: ___ms (target < 490ms = 2× baseline)
  /analytics/top-races p95: ___ms (target < 760ms = 2× baseline)
```

---

## ⚠️ Manager Risk Notes (encode vào known-issues.md sau deploy)

### TD-F058-PERF-BUDGET (MED — monitor PROD)

PAUSE-58-09 = C escalate nếu fail. PROD monitoring:
- Add Prometheus metric `analytics_endpoint_latency_p95{endpoint}` cho 12 endpoint
- Alert nếu p95 > 2× baseline sustained 5 phút
- Logger.warn rate-limited khi `computeFeeForOrdersAggregate` > 500ms per call

### TD-F058-CACHE-EXPLOSION-RISK (LOW)

Mỗi override mutation flush 9 patterns × ~580 keys. Với 58 tenant scale OK. Nếu tenant scale lên 500+ → SCAN cost spike → consider tag-based invalidate (Redis 7+).

---

## ✅ Sẵn sàng cho `/5bib-code`

**Manager verdict:** ✅ **APPROVED — Coder bắt đầu.**

### Next step

Danny chạy `/5bib-code FEATURE-058-analytics-cascade-fix` → Coder sẽ:
1. Cắt branch `feat/F-058-analytics-cascade-fix` từ `main`
2. Read 00 + 01 + 02 + memory conventions
3. Implement 3 NEW + 7 MODIFY = 10 file theo Scope Lock
4. Per-order pro-rate algorithm (PAUSE-58-03 = C)
5. Write 8-10 unit tests + perf benchmark
6. PAUSE-Coder-01 + PAUSE-Coder-02 confirm
7. Mark `03-coder-implementation.md` = `🟠 READY_FOR_QC`

**Estimate:** 3.5 ngày dev + 1.5 ngày QC + 0.5 ngày deploy = **~1 tuần**.

### Branch strategy

- F-058 không đụng F-052 territory (frontend SEO). Cả 2 có thể parallel dev.
- F-052 vẫn 🟠 DEFERRED — Danny có thể unfreeze sau khi F-058 ship hoặc song song.

### Priority ranking sau F-058

1. 🔴 **F-058** Analytics cascade fix — finance discrepancy P0 (currently active)
2. 🟡 **F-052** SEO Site Foundation — deferred, có thể start parallel hoặc sau F-058 stable
3. 🟢 **F-057** /runners restore — pre-reserved, biz consult Q3 2026
