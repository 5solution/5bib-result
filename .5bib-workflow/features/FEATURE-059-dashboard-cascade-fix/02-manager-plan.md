# FEATURE-059: Manager Plan Review

**Reviewed:** 2026-05-22
**Reviewer:** 5bib-manager
**Verdict:** ✅ **APPROVED**
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check (Manager)

- [x] Đọc `00-manager-init.md` — 6 PAUSE init Danny đã lock
- [x] Đọc `01-ba-prd.md` — 15 BR + 13 TC + 3 PAUSE-Coder + 1 fact correction
- [x] Spot-check code (Manager 2026-05-17 mandate):
  - ✅ `kpi.service.ts:108` hardcode `net * 0.055` — bug confirmed
  - ✅ `sparkline.service.ts:123` hardcode `v.net * 0.055` — bug confirmed
  - ✅ `dashboard-aggregator.cron.ts` cron EVERY_HOUR + SETNX lock pattern existing
  - ✅ `fee.service.ts:computeFeeForOrdersAggregate()` F-058 đã build sẵn — F-059 REUSE only
  - ✅ Actual route prefix `/api/admin/dashboard/*` (BA correction từ Manager init giả định `/api/dashboard/*`)
  - ✅ F-058 hotfix v1.9.2 `om.payment_on` column verified
- [x] Verify boundary F-058 FeeService UNTOUCHED — F-059 chỉ CALL method, zero modification

---

## ✓ PRD Validation Checklist

| # | Item | Status | Note |
|---|------|--------|------|
| 1 | User Stories đầy đủ | ✅ | Persona Admin/BOD xem dashboard MTD + sparkline 30d |
| 2 | Business Rules testable | ✅ | 15 BR-59-* concrete (SQL signature, decorator, cache key, perf budget) |
| 3 | UI states | ✅ | KHÔNG có frontend UI change (backend fix only). Response shape unchanged → admin dashboard tự render đúng số mới |
| 4 | Data source rõ | ✅ | MerchantConfig.event_fee_overrides (Mongo) + orders MySQL `om.payment_on` + FeeService delegation |
| 5 | DB change | N/A | Zero schema migration |
| 6 | API contract | ✅ | `/admin/dashboard/kpi` + `/admin/dashboard/sparklines` giữ shape, số bên trong đúng cascade |
| 7 | Performance SLA cụ thể | ✅ | BR-59-10: KPI cold p95 < 1.5s, Sparkline cold p95 < 4s, hot < 100ms (Redis cache TTL 60s KPI + sparkline cron 1h) |
| 8 | Security | ✅ | `LogtoAdminGuard` class-level đã có existing — no change |
| 9 | PAUSE 9/9 lock | ✅ | 6 init + 3 PAUSE-Coder (Danny chốt 2026-05-22 "theo Manager") |
| 10 | Tiếng Việt | ✅ | PRD 100% tiếng Việt |
| 11 | Test coverage | ✅ | 13 TC + perf benchmark + cold/hot path + cache flush + cron race + backward compat |
| 12 | Backward compat | ✅ | Response shape `KpiResponseDto` + `SparklineResponseDto` giữ nguyên (BR-59-08 regression diff zero) |

**Tổng kết:** ✅ All 12 PASS.

---

## 📋 Files được phép thay đổi (Scope Lock — DỨT KHOÁT)

Coder CHỈ được đụng 8 file dưới. Ngoài Scope Lock = scope creep, phải hỏi Manager.

### 🆕 NEW (2 files)

| # | File | Mục đích | LoC |
|---|------|----------|-----|
| 1 | `backend/src/modules/dashboard/services/kpi.service.f059.spec.ts` | 6-8 tests cover 4 tenant scenarios + KPI cache 60s | ~200 |
| 2 | `backend/src/modules/dashboard/services/sparkline.service.f059.spec.ts` | 5-6 tests cover daily aggregate cascade + 30-day series + pre-load configs | ~250 |

### ✏️ MODIFY (5 files)

| # | File | Thay đổi | Δ LoC |
|---|------|----------|-------|
| 3 | `backend/src/modules/dashboard/services/kpi.service.ts` | Refactor `aggregate()`: DELETE hardcode 5.5%, ADD `pullOrdersForFeeAggregate()` helper (duplicate from F-058 pattern per PAUSE-Coder-01 = A), call `feeService.computeFeeForOrdersAggregate()` per tenant, INCLUDE MANUAL fee (per PAUSE-59-02 = B), ADD KPI cache TTL 60s | +180 / -30 |
| 4 | `backend/src/modules/dashboard/services/sparkline.service.ts` | Refactor `queryDaily()` + `refreshCache()`: per-day per-tenant FeeService call. **MANDATORY pre-load `Map<tenantId, MerchantConfig>` trước loop** (per PAUSE-Coder-03 = A). Cold p95 < 4s budget. Nếu fail → fallback 14-day (PAUSE-Coder-02 = A) | +250 / -40 |
| 5 | `backend/src/modules/dashboard/dashboard.module.ts` | Import FinanceModule (export FeeService từ F-058) + import MongooseModule cho MerchantConfig pre-load | +12 |
| 6 | `backend/src/modules/merchant/merchant.service.ts` | EXTEND `flushEventOverrideCache()` thêm 2 patterns: `dashboard:kpi:*` + `dashboard:sparkline:*` (total 11 patterns: 3 base + 6 analytics F-058 + 2 dashboard F-059) | +15 |
| 7 | `CLAUDE.md` | Update Redis Keys Registry section thêm `dashboard:kpi:*` + `dashboard:sparkline:*` entries (per convention 5BIB) | +10 |
| 8 | `backend/src/modules/dashboard/services/sparkline.service.spec.ts` hoặc `kpi.service.spec.ts` existing | EXTEND regression baseline test (tenant no override + no MANUAL → number unchanged vs pre-F-059) | +30 |

**Tổng:** 2 NEW + 6 MODIFY = **8 files** (~767 LoC tổng).

**KHÔNG được đụng:**
- ❌ `fee.service.ts:computeFeeForOrdersAggregate()` F-058 (REUSE only, zero modification)
- ❌ `analytics.service.ts` (F-058 territory, đã ship)
- ❌ Frontend admin UI (response shape unchanged)
- ❌ Dashboard 5 service khác (live-races, upcoming-races, pending-tasks, recent-activity, system-status) — KHÔNG touch fee
- ❌ MongoDB/MySQL schema
- ❌ Discrepancy check endpoint (PAUSE-59-04 = B skip)
- ❌ Cron interval change (PAUSE-59-03 = A keep EVERY_HOUR)
- ❌ Bất kỳ file trong `admin/`, `frontend/`, `selling-web/`

---

## 🔧 Tech Approach (Coder reference)

### 1. KPI service refactor pattern

```typescript
// backend/src/modules/dashboard/services/kpi.service.ts
async aggregate(period: 'mtd' | 'prev'): Promise<KpiAggregateResult> {
  // 1. Build SQL pull orders (per PAUSE-Coder-01 = A duplicate helper)
  //    KEY DIFF: KHÔNG filter `order_category != 'MANUAL'` cho fee compute
  //    (per PAUSE-59-02 = B include MANUAL fee)
  //    Display GMV/Net VẪN exclude MANUAL trong response (separate compute)
  const orders = await this.pullOrdersForFeeAggregate(start, end);
  
  // 2. Group by tenant (per PAUSE-Coder-03 = A pre-load configs)
  const byTenant = groupBy(orders, 'tenantId');
  const configs = await this.merchantConfigModel.find({ tenantId: { $in: [...byTenant.keys()] } }).lean();
  const configMap = new Map(configs.map(c => [c.tenantId, c]));
  
  // 3. Delegate FeeService per tenant
  let totalFee = 0;
  for (const [tenantId, tenantOrders] of byTenant) {
    const result = await this.feeService.computeFeeForOrdersAggregate(
      tenantId,
      tenantOrders,
      { from: start, to: end },
      configMap.get(tenantId),  // pre-loaded config — skip extra Mongo query
    );
    totalFee += result.totalFee;
  }
  
  // 4. Display GMV/Net từ separate aggregate (exclude MANUAL — keep UX)
  const displayGmv = orders
    .filter(o => o.orderCategory !== 'MANUAL')
    .reduce((sum, o) => sum + o.totalPrice, 0);
  
  return { gmv: displayGmv, net: displayNet, athletes, platformFee: totalFee };
}
```

### 2. Sparkline service refactor (CRITICAL perf)

```typescript
// backend/src/modules/dashboard/services/sparkline.service.ts
async refreshCache(days = 30): Promise<void> {
  const dates = generateDateRange(days);
  
  // 1. Pull ALL orders 30 days 1 query (NOT 30 queries)
  const allOrders = await this.pullOrdersForFeeAggregate(dates[0], dates[days - 1]);
  
  // 2. Pre-load ALL configs 1 query (PAUSE-Coder-03 = A mandatory)
  const tenantIds = [...new Set(allOrders.map(o => o.tenantId))];
  const configs = await this.merchantConfigModel.find({ tenantId: { $in: tenantIds } }).lean();
  const configMap = new Map(configs.map(c => [c.tenantId, c]));
  
  // 3. Per-day per-tenant fee compute (in-memory group)
  for (const date of dates) {
    const dayOrders = allOrders.filter(o => formatDate(o.paymentOn) === date);
    const byTenant = groupBy(dayOrders, 'tenantId');
    let dayFee = 0;
    for (const [tenantId, orders] of byTenant) {
      const result = await this.feeService.computeFeeForOrdersAggregate(
        tenantId, orders, { from: date, to: nextDay(date) }, configMap.get(tenantId)
      );
      dayFee += result.totalFee;
    }
    feePoints.push({ date, value: dayFee });
  }
  
  // 4. Cache series Redis
  await this.redis.set('dashboard:sparkline:30d', JSON.stringify(result), 'EX', 3600);
}
```

→ **Perf target cold p95 < 4s** với 195 races × 58 tenants × 30 day. Nếu fail → fallback 14-day per PAUSE-Coder-02 = A (acceptable UX).

### 3. Cron Option γ (re-fetch override AFTER query)

```typescript
// dashboard-aggregator.cron.ts (verify existing pattern, KHÔNG modify cron interval)
async aggregate() {
  const acquired = await this.acquireLock();
  if (!acquired) return;
  try {
    await this.sparklineService.refreshCache();
    // Option γ: KHÔNG cần fetch override sau query — refreshCache đã re-load
    // configs từ Mongo MỖI lần (pre-load Map). Override mutation → flush
    // dashboard:sparkline:* → cron next tick auto re-load fresh configs.
  } finally {
    await this.releaseLock();
  }
}
```

### 4. Cache flush extension (BR-59-06)

```typescript
// merchant.service.ts:flushEventOverrideCache()
const patterns = [
  // F-040/F-038/F-043 existing (3)
  `pnl:*:tenant=${tenantId}`,
  `pnl:contracts-list:*`,
  `merchant:fee-overrides:${tenantId}`,
  // F-058 analytics (6)
  `analytics:overview:*`,
  `analytics:daily:*`,
  `analytics:top-races:*`,
  `analytics:rev-by-cat:*`,
  `analytics:merchants:*`,
  `analytics:races:*`,
  // F-059 dashboard (2 NEW)
  `dashboard:kpi:*`,
  `dashboard:sparkline:*`,
];
```

→ **Total 11 patterns** flush mỗi override mutation. Monitor Redis SCAN cost — với 58 tenant scale OK.

### 5. MANUAL fee semantic (PAUSE-59-02 = B)

| Aspect | Pre-F-059 | Post-F-059 |
|--------|-----------|-----------|
| GMV display | Exclude MANUAL | **Exclude MANUAL** (giữ UX) |
| Net display | Exclude MANUAL | **Exclude MANUAL** (giữ UX) |
| Platform fee | `net × 0.055` | **`feeService.computeFeeForOrdersAggregate(includes MANUAL)`** |
| MANUAL fee formula | KHÔNG tính | `manual_fee_per_ticket × ticket_count` per cascade |

→ Sau F-059, Phí 5BIB có thể > `GMV × 5.5%` vì có thêm MANUAL fee VND-based. Đây là **đúng business**, KHÔNG phải bug. PRD ghi rõ disclaimer "Phí 5BIB tính cả online + MANUAL orders".

---

## 🛑 PAUSE points cho Coder

### Existing Coder PAUSE (3 đã lock theo Manager đề xuất)

- ✅ **PAUSE-Coder-01 = A** — Duplicate `pullOrdersForFeeAggregate()` helper trong dashboard module (KHÔNG share với analytics)
- ✅ **PAUSE-Coder-02 = A** — Sparkline cold > 4s fallback giảm 14-day (defer denormalize cho F-060)
- ✅ **PAUSE-Coder-03 = A** — Pre-load `Map<tenantId, MerchantConfig>` mandatory before loop

### Bắt buộc PAUSE trước commit

- 🛑 **MANDATORY perf benchmark** sparkline cold + KPI cold/hot. Paste output vào `03-coder-implementation.md`. Nếu cold > 4s → fallback 14-day + ghi rõ
- 🛑 Trước khi modify `fee.service.ts` → **STOP, KHÔNG đụng** (F-058 territory, REUSE only)
- 🛑 Trước khi `pnpm install` lib mới → KHÔNG cần thêm dep
- 🛑 Trước commit → verify SQL query dùng đúng `om.payment_on` (F-058 hotfix lesson). Coder MUST grep audit `om\.created_at` → 0 match

---

## 🧪 Unit test bắt buộc

Coder PHẢI viết 10-14 tests trong 2 file spec NEW + 1 file extend:

### `kpi.service.f059.spec.ts` (6-8 tests)
- TC-59-01 Regression baseline: tenant no override + no MANUAL → number unchanged vs pre-F-059
- TC-59-02 Tenant override-only-rate (7%) → fee > 5.5% × gmv
- TC-59-03 Tenant MANUAL-only orders → fee = manual_fee_per_ticket × ticket_count cascade
- TC-59-04 Mix tenant (ORDINARY 6% + MANUAL 5000đ/vé × 100 vé) → aggregate correct
- TC-59-05 Multi-tenant aggregate (3 tenants different rates) → sum correct
- TC-59-06 KPI cache hit (TTL 60s) → 2nd call ≤ 100ms
- TC-59-07 Cache flush trigger sau POST override → DEL dashboard:kpi:* key
- TC-59-08 (optional) Per-order pro-rate: order ngày 5 vs 15 vs override effective_from=10

### `sparkline.service.f059.spec.ts` (5-6 tests)
- TC-59-09 30-day series shape (gmv + net + athletes + platform_fee) unchanged
- TC-59-10 Pre-load configs efficient (verify N+1 query NOT happen)
- TC-59-11 Cold path < 4s budget (mandatory perf benchmark — paste output)
- TC-59-12 Cron race condition (concurrent mutation + cron)
- TC-59-13 Day-level cascade correctness (multi-tenant per day correct)

### Existing spec extend
- TC-59-Regression KPI shape diff zero vs main HEAD

### Output bắt buộc paste vào `03-coder-implementation.md`
```
=== F-059 specs ===
PASS dashboard/services/kpi.service.f059.spec.ts (8 tests)
PASS dashboard/services/sparkline.service.f059.spec.ts (5 tests)
Tests: 13 passed

=== Performance benchmark ===
Pre-F-059 baseline:
  /admin/dashboard/kpi p95 cold: 250ms
  /admin/dashboard/sparklines p95 cold: 800ms

Post-F-059:
  /admin/dashboard/kpi p95 cold: XXXms (target < 1500ms)
  /admin/dashboard/sparklines p95 cold: YYYms (target < 4000ms)
  
Verdict: ✅ PASS hoặc 🚨 FALLBACK 14-day (per PAUSE-Coder-02)
```

---

## ⚠️ Manager Risk Notes (encode vào known-issues.md sau deploy)

### TD-F059-SPARKLINE-PERF-BUDGET (MED — monitor PROD 24h)

Sparkline 30-day × 58 tenant × FeeService cost cao. Mitigation:
- Cron warm cache 1h
- KPI in-memory cache TTL 60s
- Pre-load configs Map<tenantId, MerchantConfig>
- Fallback 14-day nếu cold > 4s

Nếu PROD p95 > 4s sustained → escalate fallback 14-day or denormalize MongoDB snapshot (F-060).

### TD-F059-MANUAL-FEE-SEMANTIC-CONFUSION (LOW)

Sau F-059, Phí 5BIB Dashboard có thể > `GMV × 5.5%` (vì MANUAL fee VND-based). Admin có thể confuse. Mitigation:
- Admin UI nên có tooltip "Phí 5BIB tính cả ORDINARY (% × GMV) + MANUAL (VND/vé)"
- Defer UI tooltip → F-060 hoặc inline trong F-059 nếu Coder muốn

### TD-F059-PAYMENT-ON-CONSISTENCY (LOW)

F-058 hotfix `om.payment_on`. F-059 follow same pattern. Coder grep audit `om\.created_at` trong dashboard → 0 match required.

---

## ✅ Sẵn sàng cho `/5bib-code`

**Manager verdict:** ✅ **APPROVED — Coder bắt đầu.**

### Next step

Danny chạy `/5bib-code FEATURE-059-dashboard-cascade-fix` → Coder sẽ:
1. Cắt branch `feat/F-059-dashboard-cascade-fix` từ `origin/main` (latest = v1.9.2 hotfix)
2. Read 00 + 01 + 02 + memory conventions
3. Implement 2 NEW + 6 MODIFY = 8 file theo Scope Lock
4. Pre-load configs optimization mandatory
5. Per-order pro-rate cascade reuse F-058 FeeService
6. Include MANUAL fee per PAUSE-59-02 = B
7. Write 13 tests + perf benchmark output
8. PAUSE-Coder confirm (3 đã lock)
9. Mark `03-coder-implementation.md` = `🟠 READY_FOR_QC`

**Estimate:** 3-3.5 ngày dev + 1.5 ngày QC + 0.5 ngày deploy = **~5-6 ngày**.

### Branch strategy

- F-059 độc lập với F-052 (frontend SEO). Có thể parallel dev.
- F-059 base trên F-058 hotfix v1.9.2 (origin/main HEAD = `87a4918`)
- Cut release/v1.9.3 sau khi F-059 ship

### Priority sau F-059

1. 🔴 F-059 Dashboard cascade (currently active)
2. 🟡 F-052 SEO Site Foundation — defer pending or parallel
3. 🟢 F-057 /runners restore — Q3 2026
4. 🟢 F-039 Analytics Per-Event/Day — pending Danny
