# FEATURE-059: Dashboard Cascade Fee Integration — PRD

**Status:** 🔵 READY
**Author:** BA (5BIB Mastermind PO + Master Business Analyst)
**Created:** 2026-05-23
**Owner:** Danny
**Type:** BUGFIX (P0 — Dashboard hiển thị PHÍ 5BIB sai ~11% so với Analytics)
**Manager init:** `00-manager-init.md` (đọc đầy đủ trước khi viết PRD này — 207 dòng, 6 PAUSE đã chốt)
**Reference PRD:** F-058 `01-ba-prd.md` (pattern delegate `FeeService.computeFeeForOrdersAggregate`)

---

## ✅ Pre-flight Check

- [x] `00-manager-init.md` đã đọc đầy đủ — 6 PAUSE locked, scope IN/OUT rõ, impact map 5 file backend.
- [x] F-058 PRD `01-ba-prd.md` đã đọc — invoke pattern + DTO `OrderForFeeAggregate` shape verified.
- [x] F-058 Manager Plan `02-manager-plan.md` đã đọc — tech approach (per-tenant aggregate, pull-then-feed pattern).
- [x] `.5bib-workflow/memory/conventions.md` cascade pattern checked — Pattern 1 (dual-pattern flush helper), Pattern Redis lock SETNX, BR-43-06 per-field independent cascade.
- [x] Spot-check code thực tế:
  - `dashboard/services/kpi.service.ts` (153 LoC, `aggregateOrders()` line 87-115, hardcode 5.5% line 108) ✅
  - `dashboard/services/sparkline.service.ts` (171 LoC, `queryDaily()` line 138-159, `compute()` line 83-136 hardcode 5.5% line 123) ✅
  - `dashboard/services/dashboard-aggregator.cron.ts` (72 LoC, SETNX lock `dashboard:cron-lock:sparkline` TTL 3300s, EVERY_HOUR) ✅
  - `dashboard/dashboard.module.ts` (57 LoC, CHƯA import FinanceModule) ✅
  - `dashboard/dashboard.controller.ts` (122 LoC, prefix thực tế `/api/admin/dashboard/*` — KHÔNG phải `/api/dashboard/*` như Manager init) ✅ **BA flag minor** — Manager init viết nhầm route prefix
  - `finance/services/fee.service.ts:1077-1268` (`computeFeeForOrdersAggregate` đã ship F-058, REUSE zero-modification) ✅
  - `finance/dto/fee-aggregate.dto.ts` (`OrderForFeeAggregate` interface line 19-34 — id/raceId/totalPrice/totalDiscounts/orderCategory/createdAt/manualTicketCount?) ✅
  - `analytics/analytics.service.ts:166-233` (helper `pullOrdersForFeeAggregate` — pull MySQL → group by tenant → return Map) ✅ **pattern verbatim copy cho Dashboard**
  - `merchant/merchant.service.ts:825-873` (`flushEventOverrideCache` hiện flush F-043 + 6 analytics pattern → cần extend 2 dashboard pattern) ✅
- [x] **Hotfix v1.9.2 verify** — F-058 dùng `om.payment_on` (NOT `created_at`), match Dashboard hiện tại (kpi.service.ts:101 + sparkline.service.ts:154). Consistency guaranteed → Dashboard ≡ Analytics tự nhiên.

---

## 🎯 Title + Goal + Scope

### Title
Dashboard admin homepage `/api/admin/dashboard/kpi` + `/api/admin/dashboard/sparklines` phải delegate fee computation sang `FeeService.computeFeeForOrdersAggregate()` (F-058) — fix silent finance discrepancy ~11% giữa Dashboard "Tổng quan" và Analytics Dashboard.

### Goal
- **Bịt 2 lớp bug Dashboard hiện tại:**
  1. **Hardcode 5.5% no cascade** — bỏ qua F-040 Tier 1 `MerchantConfig.service_fee_rate` per-tenant + F-043 Tier 0 `event_fee_overrides[]` per-race.
  2. **Exclude MANUAL fee** — Dashboard hiện tại WHERE `order_category != 'MANUAL'` không chỉ cho GMV mà cả phí 5BIB → miss `manual_fee_per_ticket × ticket_count` cho MANUAL orders (CLAUDE.md business invariant).
- **Đảm bảo Dashboard ≡ Analytics by design** — cùng `FeeService.computeFeeForOrdersAggregate()` source-of-truth (PAUSE-59-04 = B skip 3-way discrepancy check).
- **Response shape backward compat 100%** — `KpiResponseDto.kpis[].value` và `SparklinesResponseDto.series[].points[].value` giữ nguyên field, chỉ số bên trong đúng cascade. Frontend admin homepage KHÔNG cần code change.
- **Mandatory perf benchmark** — p95 `/admin/dashboard/kpi` + `/admin/dashboard/sparklines` MUST < 2× baseline pre-F059. Sparkline 30-day per-day cascade là risk lớn nhất (30 × N tenant call).
- **MANUAL fee semantic rõ:** GMV display vẫn EXCLUDE MANUAL (UX hiện tại — MANUAL không phải doanh thu online), NHƯNG phí 5BIB INCLUDE MANUAL fee (`manual_fee_per_ticket × manual_ticket_count`) cascade.
- **Cron warm cache anti-stale** — verify pattern F-058 Option γ (cron re-fetch override AFTER query, flush trigger không bị overwrite stale).

### Scope IN

| Module | File | Action |
|--------|------|--------|
| Dashboard KPI service | `backend/src/modules/dashboard/services/kpi.service.ts` | **REFACTOR** `aggregateOrders()` → split: SELECT GMV/net/athletes (exclude MANUAL) + SELECT orders raw (INCLUDE MANUAL) → call `feeService.computeFeeForOrdersAggregate` per-tenant. Inline 5.5% hardcode DELETE. |
| Dashboard Sparkline service | `backend/src/modules/dashboard/services/sparkline.service.ts` | **REFACTOR** `compute()` + `queryDaily()` → per-day per-tenant fee cascade. 30 day × N tenant call FeeService. Cache payload shape unchanged. |
| Dashboard Cron | `backend/src/modules/dashboard/services/dashboard-aggregator.cron.ts` | **VERIFY** Option γ — cron warm cache đọc override AFTER query (no modification cần thiết vì refreshCache delegate sparkline.service.compute → đã include fresh override mỗi lần). Smoke test only. |
| Dashboard Module DI | `backend/src/modules/dashboard/dashboard.module.ts` | **IMPORT** `FinanceModule` (đã exports FeeService từ F-058). |
| Merchant cache flush | `backend/src/modules/merchant/merchant.service.ts:flushEventOverrideCache` | **EXTEND** thêm 2 dashboard pattern: `dashboard:kpi:*` (NEW key cho TC-59-06 — cache flush trigger) + `dashboard:sparklines:*` (existing key `dashboard:sparklines:30d`). |
| Unit tests | `backend/src/modules/dashboard/services/__tests__/kpi.service.f059.spec.ts` | **NEW** 6-8 tests cover 4 tenant scenarios + MANUAL include + Tier 0 cascade + regression baseline. |
| Unit tests | `backend/src/modules/dashboard/services/__tests__/sparkline.service.f059.spec.ts` | **NEW** 4-6 tests cover daily aggregate cascade per tenant + 30-day series + cache write. |
| Unit tests extend | `backend/src/modules/merchant/__tests__/merchant.service.f043.spec.ts` | **EXTEND** assert flush trigger 9 patterns (1 F-043 + 6 F-058 + 2 F-059). |
| Perf benchmark | `03-coder-implementation.md` section "Performance" | **MANDATORY** paste before/after k6/autocannon output. |

### Scope OUT (defer / out of scope)

| Item | Lý do |
|------|-------|
| 5 endpoint Dashboard khác (live-races, upcoming-races, pending-tasks, recent-activity, system-status) | KHÔNG touch platform fee. |
| `FeeService.computeFeeForOrdersAggregate` modification | F-058 territory protected — F-059 chỉ CALL. |
| Frontend admin homepage UI changes | Response shape unchanged, frontend tự động đúng số. |
| `/api/admin/dashboard/discrepancy-check` endpoint mới | PAUSE-59-04 = B skip (Dashboard ≡ Analytics by design). |
| Migration MongoDB / MySQL schema | Zero schema change. |
| Backfill historical sparkline data | PAUSE-59-05 = B admin manual / cron 1h auto-refresh. |
| Cron interval change (15min, 30min) | PAUSE-59-03 = A giữ EVERY_HOUR. |
| Add `period=quarter/year` cho KPI | Scope hiện tại MTD only. |
| Rename `FeeSource` enum F-040 vs F-043 collision | Defer (refactor riêng). |
| Slack alert pro-active discrepancy | PAUSE-59-04 = B skip toàn bộ alert mechanism. |

---

## 👥 User Stories & Business Rules

### User Stories

- **US-59-01:** *Là 5BIB BOD (admin)*, mở `/admin` homepage Tổng quan, tôi muốn thấy "Phí 5BIB" MTD = số chính xác match với `/admin/analytics` Dashboard cùng tháng, *để* không phải tự cross-check 2 dashboard mỗi sáng.
- **US-59-02:** *Là Finance Manager*, tôi muốn "Phí 5BIB" sparkline 30 ngày phản ánh đúng per-day cascade (tenant override + MANUAL fee), *để* trend chart không lệch khi tenant lớn (UTMB Vietnam, VPBank) có override 7-8%.
- **US-59-03:** *Là Back-Office Admin*, sau khi POST/PUT/DELETE event override cho race, tôi muốn Dashboard KPI + Sparkline **lập tức** phản ánh số mới (sau cache flush), *để* test override không phải đợi cron 1h.
- **US-59-04:** *Là 5BIB Engineering*, tôi muốn Dashboard delegate fee compute sang FeeService (cùng F-058 method), *để* không duplicate cascade logic giữa Dashboard và Analytics — 1 source of truth.
- **US-59-05:** *Là Finance Manager*, tôi muốn MANUAL orders cũng tính phí 5BIB cascade (per `manual_fee_per_ticket × ticket_count`), *để* dashboard không miss ~3-5% revenue stream từ MANUAL orders.
- **US-59-06:** *Là 5BIB BOD*, tôi muốn Dashboard load < 1s p95 (giống pre-F059), *để* admin homepage UX không sluggish.

### Business Rules

#### BR-59-01 — Dashboard KPI delegate FeeService — signature

`DashboardKpiService.aggregateOrders()` MUST tách 2 SQL query + delegate FeeService:

```typescript
private async aggregateOrders(
  start: string,
  end: string,
): Promise<{ gmv: number; net: number; athletes: number; platformFee: number }> {
  // STEP 1 — GMV/net/athletes aggregate (giữ exclude MANUAL — semantic UX hiện tại)
  const [agg] = await this.db.query(
    `SELECT
      COALESCE(SUM(CASE WHEN order_category != 'MANUAL' THEN total_price ELSE 0 END), 0) AS gmv,
      COALESCE(SUM(CASE WHEN order_category != 'MANUAL'
        THEN GREATEST(total_price - IFNULL(total_discounts, 0), 0) ELSE 0 END), 0) AS net,
      COUNT(DISTINCT CASE WHEN order_category != 'MANUAL' THEN user_id END) AS athletes
    FROM order_metadata
    WHERE financial_status = 'paid' AND payment_on >= ? AND payment_on < ?`,
    [start, end],
  );

  // STEP 2 — Pull raw orders INCLUDE MANUAL (cascade per-order)
  const ordersByTenant = await this.pullOrdersForFeeAggregate(start, end);

  // STEP 3 — Per-tenant call FeeService → sum totalFee
  let platformFee = 0;
  for (const [tenantId, orders] of ordersByTenant.entries()) {
    const result = await this.feeService.computeFeeForOrdersAggregate(
      tenantId, orders, { from: start, to: end },
    );
    platformFee += result.totalFee;
  }

  return { gmv: Number(agg?.gmv ?? 0), net: Number(agg?.net ?? 0),
           athletes: Number(agg?.athletes ?? 0), platformFee };
}
```

- MUST gọi `feeService.computeFeeForOrdersAggregate` per tenant (KHÔNG inline cascade).
- MUST INCLUDE MANUAL orders trong pull (`pullOrdersForFeeAggregate` no MANUAL filter) — FeeService nội bộ branch `is5bib` vs `isManual` (fee.service.ts:1206).
- MUST GIỮ `payment_on` field (consistency F-058 v1.9.2 hotfix + Dashboard hiện tại).

#### BR-59-02 — Dashboard pullOrdersForFeeAggregate helper

NEW private helper trong `DashboardKpiService` (port pattern từ `analytics.service.ts:166-233` — copy verbatim, KHÔNG abstract chung):

```typescript
private async pullOrdersForFeeAggregate(
  start: string, end: string,
): Promise<Map<number, OrderForFeeAggregate[]>> {
  const rows: Array<{...}> = await this.db.query(
    `SELECT
      om.id, r.tenant_id, om.race_id, om.total_price, om.total_discounts,
      om.order_category, om.payment_on,
      oli_agg.total_quantity AS manual_ticket_count
    FROM order_metadata om
    JOIN races r ON r.race_id = om.race_id
    LEFT JOIN (
      SELECT order_id, SUM(quantity) AS total_quantity
      FROM order_line_item GROUP BY order_id
    ) oli_agg ON oli_agg.order_id = om.id
    WHERE om.financial_status = 'paid'
      AND om.payment_on >= ? AND om.payment_on < ?`,
    [start, end],
  );
  const byTenant = new Map<number, OrderForFeeAggregate[]>();
  for (const r of rows) {
    const tid = Number(r.tenant_id);
    const arr = byTenant.get(tid) ?? [];
    arr.push({
      id: Number(r.id), raceId: Number(r.race_id),
      totalPrice: Number(r.total_price ?? 0),
      totalDiscounts: Number(r.total_discounts ?? 0),
      orderCategory: r.order_category,
      createdAt: r.payment_on, // F-058 hotfix semantic
      manualTicketCount: r.manual_ticket_count != null ? Number(r.manual_ticket_count) : undefined,
    });
    byTenant.set(tid, arr);
  }
  return byTenant;
}
```

- Pattern này **DUPLICATE** với `analytics.service.ts` có chủ ý — KHÔNG abstract chung shared helper (avoid cross-module coupling, conventions.md guideline "duplication trumps premature abstraction").
- BR-59-02 explicit: nếu Coder muốn shared helper → flag PAUSE-Coder-01.

#### BR-59-03 — Dashboard Sparkline service refactor — per-day per-tenant cascade

`DashboardSparklineService.compute()` MUST refactor:

```typescript
private async compute(days: number): Promise<SparklinesResponseDto> {
  const dates = this.dateRange(start, today, days);
  const gmvPoints: SparklinePointDto[] = [];
  const netPoints: SparklinePointDto[] = [];
  const athletePoints: SparklinePointDto[] = [];
  const feePoints: SparklinePointDto[] = [];

  // STEP 1 — Daily GMV/net/athletes (giữ exclude MANUAL — UX) — 1 SQL aggregate
  const dailyRows = await this.queryDaily(startStr, endStr); // existing method
  const gmvNetMap = new Map<string, { gmv: number; net: number; athletes: number }>();
  for (const r of dailyRows) {
    gmvNetMap.set(r.d, { gmv: Number(r.gmv), net: Number(r.net), athletes: Number(r.athletes) });
  }

  // STEP 2 — Daily fee compute per-day per-tenant cascade
  // BR-59-03 critical: 30 day × N tenant call → batch-aware
  for (const date of dates) {
    const dayStart = date;
    const dayEnd = this.nextDay(date); // YYYY-MM-DD exclusive

    const ordersByTenant = await this.pullOrdersForFeeAggregate(dayStart, dayEnd);

    let dailyFee = 0;
    for (const [tenantId, orders] of ordersByTenant.entries()) {
      const r = await this.feeService.computeFeeForOrdersAggregate(
        tenantId, orders, { from: dayStart, to: dayEnd },
      );
      dailyFee += r.totalFee;
    }

    const v = gmvNetMap.get(date) ?? { gmv: 0, net: 0, athletes: 0 };
    gmvPoints.push({ date, value: v.gmv });
    netPoints.push({ date, value: v.net });
    athletePoints.push({ date, value: v.athletes });
    feePoints.push({ date, value: dailyFee });
  }

  return {
    series: [
      { key: 'gmv', points: gmvPoints },
      { key: 'net', points: netPoints },
      { key: 'athletes', points: athletePoints },
      { key: 'platform_fee', points: feePoints },
    ],
    days, generatedAt: new Date().toISOString(),
  };
}
```

- **Performance critical** — 30 day × ~58 tenant × FeeService overhead. Coder MUST benchmark TC-59-08.
- **Optimization HINT (Coder lựa chọn):** pull 30-day raw orders 1 lần → group by (date, tenant) trong memory → 30 × N call FeeService (skip 30 × SQL roundtrip). BA recommend approach này nếu p95 vượt budget.
- Sparkline payload shape unchanged — `series[].points[].value` giữ field, frontend Recharts chart-bar-interactive không break.

#### BR-59-04 — MANUAL fee INCLUDE (PAUSE-59-02 = B) — semantic rõ

Dashboard hiện EXCLUDE MANUAL trong cả GMV + fee. F-059 sửa:
- **GMV display:** GIỮ EXCLUDE MANUAL (UX hiện tại — KPI card "GMV tháng này" + sparkline `gmv` series exclude MANUAL).
- **Net display:** GIỮ EXCLUDE MANUAL (same KPI card "Doanh thu net" + sparkline `net` series).
- **Athletes display:** GIỮ EXCLUDE MANUAL (KPI card "VĐV đăng ký" + sparkline `athletes`).
- **Platform fee:** **INCLUDE MANUAL** — pull include MANUAL orders → FeeService nội bộ branch:
  - `is5bib` (ORDINARY/PERSONAL_GROUP/...): fee = `netGmv × rate%` + VAT.
  - `isManual`: fee = `manualTicketCount × manual_fee_per_ticket` (no VAT theo F-043 BR-43-06).
- **Implication math:** Phí 5BIB có thể > GMV × 5.5% vì MANUAL fee VND-based. Test TC-59-04.
- **UI legend đề xuất (out of scope F-059 frontend):** KPI card "Phí 5BIB" tooltip nên có disclaimer "Phí 5BIB = ORDINARY/GROUP_BUY + MANUAL fee" — frontend issue riêng F-060 (UX polish).

#### BR-59-05 — Cron Option γ pattern verify (PAUSE-59-03 = A + Manager init)

`DashboardAggregatorCron.aggregate()` chạy `EVERY_HOUR`, gọi `sparklineService.refreshCache()` → `compute()` → query MySQL fresh + Mongo `MerchantConfig` fresh.
- **F-058 Option γ** = cron re-fetch override AFTER query → đảm bảo cron tick không serve stale config.
- Trong context F-059: `compute()` gọi `feeService.computeFeeForOrdersAggregate()` mỗi tick → `FeeService` internally `merchantConfigModel.findOne({tenantId}).lean()` (fee.service.ts:1087) → **luôn read fresh từ Mongo** (no caching trong FeeService aggregate method). ✅ Safe by design.
- F-059 KHÔNG modify cron logic, chỉ verify smoke test TC-59-07 (concurrent POST override × cron tick).
- Lock `dashboard:cron-lock:sparkline` TTL 3300s — KHÔNG đổi.

#### BR-59-06 — Cache flush extension (2 patterns mới)

`merchant.service.ts:flushEventOverrideCache(tenantId)` extend `ANALYTICS_FLUSH_PATTERNS` array → THÊM 2 dashboard pattern:

```typescript
const DASHBOARD_FLUSH_PATTERNS = [
  'dashboard:kpi:*',         // NEW — KPI cache (chưa tồn tại trong codebase hiện tại, NHƯNG Coder MUST cache KPI để đạt perf, xem BR-59-09)
  'dashboard:sparklines:*',  // existing key `dashboard:sparklines:30d`
];
```

Pattern flush qua `scanStream({match, count: 200})` + pipeline DEL — port helper F-058 (merchant.service.ts:847-872). Loop iteration thêm 2 pattern vào array sẵn có.

- Total patterns sau F-059: **1 F-043** (`merchant:fee-overrides:<tenantId>`) + **6 F-058** (analytics:*) + **2 F-059** (dashboard:*) = **9 patterns**.
- TC-59-06 assert 9 patterns flushed.

#### BR-59-07 — Dashboard module DI

`dashboard.module.ts` MUST import `FinanceModule`:

```typescript
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    LogtoAuthModule,
    AuditModule,
    TypeOrmModule.forFeature([], 'platform'),
    MongooseModule.forFeature([...]),
    FinanceModule, // F-059 — for FeeService DI
  ],
  // ...
})
```

`FinanceModule` đã `exports: [FeeService]` từ F-058 — verify chỉ.

#### BR-59-08 — Backward compat — response shape unchanged

- `KpiResponseDto.kpis[].value`: giữ field name, kiểu number, unit `'vnd'`.
- `SparklinesResponseDto.series[].points[].value`: giữ field, kiểu number.
- KHÔNG thêm field mới (vd `feeSource`, `appliedOverrides[]`, `warnings[]`) vào response Dashboard. Internal FeeService trả info đó nhưng Dashboard discard, chỉ lấy `result.totalFee`.
- Frontend admin homepage `/admin/page.tsx` (Recharts KPI card + sparkline) tự động hiển thị số đúng cascade — KHÔNG cần SDK regenerate vì shape không đổi.

#### BR-59-09 — KPI cache (NEW) cho perf budget

Dashboard KPI hiện **KHÔNG cache** (kpi.service.ts:30 gọi DB direct mỗi request). Sau F-059 với FeeService overhead, KPI per-tenant cascade có thể > 500ms p95 cold.

**Decision (BA):** ADD cache `dashboard:kpi:mtd` TTL 60s — minimal risk vì admin homepage refresh rate << 1/phút. Cache flush trigger qua BR-59-06 (`dashboard:kpi:*` pattern).

```typescript
const KPI_CACHE_KEY = 'dashboard:kpi:mtd';
const KPI_CACHE_TTL_SECONDS = 60;

async getMtdKpis(): Promise<KpiResponseDto> {
  const cached = await this.readKpiCache();
  if (cached) return cached;
  // ... existing compute logic
  await this.writeKpiCache(result);
  return result;
}
```

- TTL 60s đủ cho perf + freshness UX admin homepage.
- Override mutation flush cache ngay (BR-59-06) → no stale.
- Cron auto-refresh không touch KPI cache (cron chỉ refresh sparkline) — KPI cache tự expire 60s.

#### BR-59-10 — Performance SLA (mandatory benchmark)

| Endpoint | Baseline p95 pre-F059 | Budget post-F059 |
|----------|----------------------|------------------|
| `/api/admin/dashboard/kpi` (cached 60s) | KHÔNG có cache, ~300-500ms direct SQL | **< 600ms p95 cold** / < 50ms cached |
| `/api/admin/dashboard/kpi` (uncached / cold start) | N/A | **< 1500ms p95** |
| `/api/admin/dashboard/sparklines` (cache 1h) | ~50ms cached / ~800ms cold | **< 100ms cached / < 4000ms cold** |
| Cron `aggregate()` runtime (30-day refresh) | < 30s | **< 90s (3×)** |

- Coder MUST run `autocannon -d 30 -c 5` cho mỗi endpoint, paste output p50/p95/p99 trước & sau.
- Sparkline cold uncached là worst case — 30 day × N tenant call FeeService. Nếu vượt 4s → Coder MUST implement optimization BR-59-03 hint (batch pull-then-group-in-memory).
- Nếu Sparkline cold vượt budget sau optimization → escalate PAUSE-Coder-02.

#### BR-59-11 — Regression baseline guarantee

Tenant KHÔNG có `event_fee_overrides[]` AND `MerchantConfig.service_fee_rate = 5.5` AND không có MANUAL orders → `platformFee` post-F059 = pre-F059 (tolerance ±1 VND do Math.round).

TC-59-01 assert mathematical equivalence: `net × 0.055 === FeeService.totalFee` cho clean tenant.

#### BR-59-12 — `payment_on` semantic consistency (F-058 hotfix v1.9.2)

F-059 dùng `om.payment_on` (NOT `created_at`) trong cả 2 query (KPI + Sparkline) — match:
- F-058 Analytics hotfix v1.9.2 (`om.payment_on`)
- Dashboard hiện tại (kpi.service.ts:101 + sparkline.service.ts:154 đã `payment_on`)
- Reconciliation aggregate (theo memory `vendor_raceresult_quirks.md` + finance module)

→ Dashboard ≡ Analytics tự động (cùng field decisive). Discrepancy check skip (PAUSE-59-04 = B) hợp lý.

#### BR-59-13 — Logger warn cascade fallback

FeeService nội bộ `logger.warn` khi `MerchantConfig` missing (Tier 3 fallback, fee.service.ts:1095). Dashboard KHÔNG suppress warn. Coder verify warn fire 1 lần per tenant per request (KHÔNG fire 30× cho sparkline 30 day — vì Map.get cached config no-op for subsequent days).

⚠️ **Potential issue:** FeeService gọi `findOne` mỗi invocation → 30 day × N tenant call = 30N × Mongo query. **BA flag PAUSE-Coder-03:** Coder cân nhắc memoize MerchantConfig per request (in-memory `Map<tenantId, config>`) để tránh N+30N Mongo round-trip.

#### BR-59-14 — Edge case: zero orders period

Tenant có 0 paid orders trong period → `ordersByTenant.get(tenantId) = undefined`. Loop skip → no FeeService call → `platformFee = 0` cho tenant đó. Sum aggregate vẫn đúng. TC-59-09 assert.

#### BR-59-15 — Audit log

Dashboard READ-ONLY → KHÔNG audit log entry (per F-023 BR-DASH-21 invariant). F-059 KHÔNG thêm audit emit.

---

## 🖥️ UI/UX Flow

> F-059 là backend fix **chính**. Frontend KHÔNG có UI changes (response shape unchanged). Admin user thấy ngay số chính xác sau deploy + cache flush.

### Persona: Admin (5BIB BOD / Engineering / Finance)

#### Numbered Step Journey — Dashboard view post-F-059 deploy

| # | User action | UI behavior / API call | Trigger | Next state |
|---|-------------|------------------------|---------|------------|
| 1 | Admin login + mở `/admin` homepage | Frontend GET `/api/admin/dashboard/kpi` + GET `/api/admin/dashboard/sparklines` parallel | Auto on page mount | Loading skeleton |
| 2 | Backend `/kpi` resolve | (a) Check `dashboard:kpi:mtd` cache → MISS first time. (b) `aggregateOrders()` chạy 2 SQL (GMV agg + orders pull) + per-tenant FeeService. (c) Compute platformFee cascade INCLUDE MANUAL. (d) Write cache TTL 60s. | First request | 400-1500ms |
| 3 | Backend `/sparklines` resolve | (a) Check `dashboard:sparklines:30d` cache → HIT (cron đã warm 1h trước). (b) Return cached payload. | First request | < 100ms cached |
| 4 | Frontend render | KPI cards 4 boxes (GMV/Net/Athletes/Phí 5BIB) + Recharts line sparkline 30 ngày | Response 200 | Idle |
| 5 | Admin scroll/refresh trong vòng 60s | KPI cache HIT → < 50ms response | Subsequent request | Idle |
| 6 | (Edge) Admin POST event override race A → flush dashboard:kpi:* + dashboard:sparklines:* | Next `/kpi` + `/sparklines` request → cache MISS → rebuild fresh số mới | Mutation event | Fresh data |
| 7 | (Edge) Cron tick `EVERY_HOUR` → refresh `dashboard:sparklines:30d` | Lock SETNX acquired → `compute(30)` → write cache | Auto every hour | Warm cache |

#### Visible state matrix

| Scenario | Pre-F059 (Dashboard) | Post-F059 (Dashboard) | Analytics (reference) | Match? |
|----------|---------------------|----------------------|------------------------|--------|
| Tenant 5.5% no override, no MANUAL | `net × 5.5%` | `net × 5.5%` via FeeService | same | ✅ regression baseline |
| Tenant 7% override + 0 MANUAL | `net × 5.5%` (SAI) | `net × 7%` via FeeService Tier 0 | same | ✅ FIX |
| Tenant 5.5% + 100 MANUAL × 5000đ/ticket | `net × 5.5%` (miss 500k MANUAL) | `net × 5.5% + 100 × 5000` | same | ✅ FIX |
| Tenant 6% + 50 MANUAL × 5000đ/ticket override | `net × 5.5%` (SAI 2 lớp) | Cascade Tier 0 6% rate + override manual_fee | same | ✅ FIX |

#### KHÔNG có frontend UI changes

- Admin homepage `/admin/page.tsx` Recharts chart-bar-interactive: response shape `series[].points[].value` unchanged → no SDK regenerate cần thiết.
- KPI card label "Phí 5BIB" GIỮ nguyên (frontend issue F-060 nếu cần tooltip disclaimer "Bao gồm MANUAL fee").
- Frontend `pnpm generate:api` **không cần chạy** vì zero DTO change.

---

## 🛠️ Technical Mandates

### 6.1 DB / Cache changes

- **MongoDB:** KHÔNG đụng. FeeService nội bộ đọc `MerchantConfig` qua existing query.
- **MySQL platform:** KHÔNG migration. Reuse existing 2 query Dashboard + add 1 query pull-orders (port từ Analytics).
- **Redis:**
  - 1 cache key NEW: `dashboard:kpi:mtd` TTL 60s (BR-59-09).
  - 1 cache key EXISTING: `dashboard:sparklines:30d` TTL 3600s.
  - 2 flush patterns mới: `dashboard:kpi:*` + `dashboard:sparklines:*` (BR-59-06).
  - 1 lock key existing: `dashboard:cron-lock:sparkline` TTL 3300s (KHÔNG đổi).
- **Cache Registry update:** Coder MUST update `CLAUDE.md` Redis Keys Registry section thêm 2 dòng `dashboard:kpi:*` và `dashboard:sparklines:*`.

### 6.2 Backend — Dashboard KPI Service refactor

**File:** `backend/src/modules/dashboard/services/kpi.service.ts`

**Changes:**
- **DELETE** line 108 hardcode `Math.round(net * 0.055)`.
- **DELETE** inline platform fee compute.
- **ADD** constructor inject `feeService: FeeService` + `redis: Redis`.
- **ADD** private helper `pullOrdersForFeeAggregate(start, end): Promise<Map<tenantId, OrderForFeeAggregate[]>>` (BR-59-02 — port từ analytics.service.ts:166-233).
- **REFACTOR** `aggregateOrders()`:
  - STEP 1 SQL: GMV/net/athletes aggregate (exclude MANUAL) — giữ existing SQL.
  - STEP 2: call `pullOrdersForFeeAggregate(start, end)` → Map<tenantId, orders>.
  - STEP 3: loop call `feeService.computeFeeForOrdersAggregate(tenantId, orders, {from: start, to: end})` → sum `totalFee`.
  - Return shape unchanged.
- **ADD** KPI cache wrapper trong `getMtdKpis()`:
  - Check `dashboard:kpi:mtd` (TTL 60s).
  - Cache MISS → compute → write cache.
  - Cache HIT → return cached.
- **ADD** `@InjectRedis()` decorator + cache read/write helper methods.
- Logger warn pass-through (FeeService tự log Tier 3 fallback).

**Estimated LoC:** +100 / -15.

### 6.3 Backend — Dashboard Sparkline Service refactor

**File:** `backend/src/modules/dashboard/services/sparkline.service.ts`

**Changes:**
- **DELETE** line 123 hardcode `Math.round(v.net * 0.055)`.
- **ADD** constructor inject `feeService: FeeService`.
- **ADD** private helper `pullOrdersForFeeAggregate(start, end)` (same shape BR-59-02 — duplicate within service, internal helper).
- **REFACTOR** `compute(days)`:
  - Existing `queryDaily` (line 138) trả GMV/net/athletes per day → giữ.
  - ADD per-day loop: pull orders per day → group by tenant → per tenant FeeService call → sum `totalFee`.
  - `feePoints.push({ date, value: dailyFee })` thay vì hardcode.
  - **OPTIMIZATION (recommended Coder):** pull all 30-day orders 1 SQL → group by `(DATE(payment_on), tenant_id)` in memory → 30 day × N tenant call FeeService (1 SQL roundtrip thay vì 30). Coder benchmark TC-59-08 quyết định.
- Cache write payload shape unchanged.

**Estimated LoC:** +120 / -10.

### 6.4 Backend — Dashboard Module DI

**File:** `backend/src/modules/dashboard/dashboard.module.ts`

```typescript
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    LogtoAuthModule,
    AuditModule,
    TypeOrmModule.forFeature([], 'platform'),
    MongooseModule.forFeature([
      { name: Race.name, schema: RaceSchema },
      { name: ResultClaim.name, schema: ResultClaimSchema },
      { name: Reconciliation.name, schema: ReconciliationSchema },
    ]),
    FinanceModule, // F-059 — for FeeService DI
  ],
  // ...
})
```

Verify `FinanceModule` đã `exports: [FeeService]` (F-058 đã ship). Estimated LoC: +2.

### 6.5 Backend — Cache flush extension (merchant.service.ts)

**File:** `backend/src/modules/merchant/merchant.service.ts:flushEventOverrideCache`

```typescript
// F-058 — 6 analytics pattern (existing)
const ANALYTICS_FLUSH_PATTERNS = [
  'analytics:overview:*',
  'analytics:daily:*',
  'analytics:top-races:*',
  'analytics:rev-by-cat:*',
  'analytics:merchants:*',
  'analytics:races:*',
];
// F-059 — 2 dashboard pattern (NEW)
const DASHBOARD_FLUSH_PATTERNS = [
  'dashboard:kpi:*',
  'dashboard:sparklines:*',
];
const ALL_FLUSH_PATTERNS = [...ANALYTICS_FLUSH_PATTERNS, ...DASHBOARD_FLUSH_PATTERNS];

for (const pattern of ALL_FLUSH_PATTERNS) {
  // existing scanStream + pipeline DEL pattern (KHÔNG đổi)
}
```

- Refactor: merge 2 array (cleaner) — Coder lựa chọn keep separate hoặc combine.
- Log warn prefix `[F-059]` cho dashboard pattern (debugging).

Estimated LoC: +12.

### 6.6 Cron Option γ verify (no code change)

**File:** `backend/src/modules/dashboard/services/dashboard-aggregator.cron.ts`

- KHÔNG modify code.
- Coder MUST smoke test scenario TC-59-07 (concurrent POST override × cron tick) — verify cron re-fetch override mỗi tick (vì `sparklineService.refreshCache()` → `compute()` → FeeService → `merchantConfigModel.findOne` luôn fresh Mongo read).
- Document trong `03-coder-implementation.md` section "Cron behavior" — paste cron log output + Redis lock state.

### 6.7 Frontend / Admin

- ❌ KHÔNG code change frontend admin homepage.
- ❌ KHÔNG `pnpm generate:api` cần thiết (zero DTO change).
- Sau backend deploy, admin tự động thấy số đúng (cache TTL 1h tự expire HOẶC manual cron trigger qua admin endpoint).
- **Manual cache flush command** (post-deploy):
  ```bash
  ssh 5solution-vps "docker exec 5bib-result-backend node -e \"require('ioredis').createClient(process.env.REDIS_URL).keys('dashboard:*').then(ks => Promise.all(ks.map(k => require('ioredis').createClient(process.env.REDIS_URL).del(k))))\""
  ```
  Hoặc đơn giản đợi TTL 1h tự expire (PAUSE-59-05 = B admin manual trigger / cron auto-refresh).

### 6.8 PAUSE-Coder flags (BA mới phát hiện)

| PAUSE | Câu hỏi | BA recommend |
|-------|---------|-------------|
| **PAUSE-Coder-01** | Helper `pullOrdersForFeeAggregate` duplicate giữa `analytics.service.ts` + `kpi.service.ts` + `sparkline.service.ts` — abstract shared trong `FinanceModule` helper? | **KHÔNG** abstract. Giữ duplicate có chủ ý (conventions.md "duplication trumps premature abstraction"). 3 service có scope khác (analytics support filter tenant/race; dashboard không cần filter). Refactor sau F-060 khi có 4th use case. |
| **PAUSE-Coder-02** | Nếu sparkline cold > 4s budget sau optimization → fallback strategy? | **Option A:** giảm sparkline xuống 14-day (UX trade-off). **Option B:** denormalize daily fee snapshot vào MongoDB collection `dashboard_daily_snapshot` (extra cron 1h write). **BA recommend A** trước (low complexity). Escalate Danny nếu A vẫn vượt. |
| **PAUSE-Coder-03** | MerchantConfig N+30N Mongo query in sparkline loop — memoize per request? | **YES — memoize**. Coder ADD `Map<tenantId, MerchantConfig>` cache trong `compute()` scope, pass vào FeeService qua optional 4th param `_configCache?` (extend method signature backward compat) HOẶC keep FeeService unchanged + pre-load all tenant configs trong sparkline.service trước loop. **BA recommend pre-load approach** (KHÔNG modify F-058 FeeService). |
| **PAUSE-Coder-04** | Route prefix actual `/api/admin/dashboard/*` (NOT `/api/dashboard/*` như Manager init viết) — confirm impact endpoint test? | **NO impact** — đã verify dashboard.controller.ts:41 `@Controller('admin/dashboard')`. PRD + Manager init typo nhỏ, không ảnh hưởng code. |

---

## 🧪 Testing Mandates

### Backend Unit Tests — TC-59-XX

#### TC-59-01 — Regression baseline: tenant no override + no MANUAL → unchanged (BR-59-11, PAUSE-59-06 scenario 1)

| Element | Value |
|---------|-------|
| Method | `kpiService.getMtdKpis()` direct call (mock `feeService.computeFeeForOrdersAggregate` proxy real impl) |
| Pre-condition | Tenant 100: `MerchantConfig {service_fee_rate: 5.5, event_fee_overrides: []}`. 10 paid orders ORDINARY, total `total_price = 100,000,000`, no discount, no MANUAL. |
| Expected | `kpis[3] = { key: 'platform_fee', value: 5500000, ... }` (= 100M × 5.5%) |
| Assert | Mathematical equivalence với pre-F059 baseline. Tolerance ±1 VND (Math.round). |
| Side effect | NONE. Cache `dashboard:kpi:mtd` written. |

#### TC-59-02 — Tier 0 override rate (PAUSE-59-06 scenario 2)

| Element | Value |
|---------|-------|
| Pre-condition | Tenant 101: default 5%, override race 12345 `service_fee_rate=7, effective_from='2026-05-01'`. 5 orders ORDINARY race 12345 (payment_on `2026-05-15`), `total_price = 50,000,000`. |
| Method | `kpiService.getMtdKpis()` cho month '2026-05' |
| Expected | `platform_fee = 3500000` (= 50M × 7%). |
| MUST NOT | apply 5.5% flat (would be 2.75M). |
| Side effect | NONE. |

#### TC-59-03 — MANUAL fee include (PAUSE-59-02 = B critical)

| Element | Value |
|---------|-------|
| Pre-condition | Tenant 102: default `service_fee_rate=5.5, manual_fee_per_ticket=5000`. 0 ORDINARY orders. 100 MANUAL orders với `total_quantity` tổng = 100 vé (qua oli_agg join). |
| Method | Same |
| Expected | `gmv = 0` (exclude MANUAL), `net = 0`, `athletes = 0`. `platform_fee = 500000` (= 100 vé × 5000đ/ticket). |
| MUST | `gmv ≠ platform_fee` semantic — phí > GMV vì MANUAL fee VND-based. |

#### TC-59-04 — Mix tenant (ORDINARY 6% + MANUAL 5000đ/ticket × 100 vé) — PAUSE-59-06 scenario 4

| Element | Value |
|---------|-------|
| Pre-condition | Tenant 103: `MerchantConfig {service_fee_rate: 6, manual_fee_per_ticket: 5000}`. 10 ORDINARY orders net_gmv 30M. 5 MANUAL orders tổng 100 vé. |
| Expected | `gmv = 30M` (exclude MANUAL). `platform_fee = 30M × 6% + 100 × 5000 = 1800000 + 500000 = 2300000`. |
| MUST | source breakdown internal: `merchant_default` cho 10 ORDINARY + `merchant_default` cho 5 MANUAL. |

#### TC-59-05 — Sparkline 30-day per-day cascade (BR-59-03)

| Method | `sparklineService.compute(30)` direct call |
| Pre-condition | Tenant 104: override race A `7%` effective `2026-05-10`. 30 days orders mix: day 1-9 default 5.5%, day 10-30 override 7%. Each day 10M net_gmv. |
| Expected | `feePoints[0..8].value = 550000` each (5.5%). `feePoints[9..29].value = 700000` each (7%). |
| Assert | Per-day cascade correctness — KHÔNG flat 5.5% × 30 days. |

#### TC-59-06 — Cache flush trigger 9 patterns (BR-59-06)

| Method | E2E: POST `/api/merchants/configs/105/event-fee-overrides` body `{raceId:600, service_fee_rate:8, effective_from:'2026-05-01'}` |
| Pre-condition | Redis seed: `merchant:fee-overrides:105`, all 6 analytics keys, `dashboard:kpi:mtd`, `dashboard:sparklines:30d`. **Total 9 keys.** |
| Expected status | 201 |
| Side effect verify | All 9 Redis keys DELETED post-mutation. `redis.keys('dashboard:*')` returns `[]`. `redis.keys('analytics:*')` returns `[]`. |

#### TC-59-07 — Cron race condition × POST override (BR-59-05)

| Method | `Promise.all([cron.aggregate(), POST event-fee-override])` |
| Pre-condition | Mock Redis `SETNX dashboard:cron-lock:sparkline` succeed first. Mock Mongo `MerchantConfig.findOne` return fresh config mỗi call. |
| Expected | (1) Cron complete normally, write `dashboard:sparklines:30d` với override applied. (2) POST override trigger flush ngay. (3) Subsequent `/sparklines` request → cache MISS → rebuild fresh. |
| MUST NOT | Cron serve stale (lock acquired BEFORE config fetch → stale). |
| Verify | FeeService `findOne` re-fetch override mỗi tick = Option γ. |

#### TC-59-08 — Performance benchmark ⭐ MANDATORY (BR-59-10)

| Method | autocannon `-d 30 -c 5` cho 2 endpoint: `/api/admin/dashboard/kpi` + `/api/admin/dashboard/sparklines` |
| Pre-condition | DB seeded: 58 tenants × avg 3 races × avg 100 orders × 30 days = ~17,400 orders. Cache empty (cold start) AND cache warm (subsequent). |
| Expected | p95 budgets per BR-59-10 table. |
| Output paste | Raw autocannon output (p50/p95/p99 before+after F-059) vào `03-coder-implementation.md` section "Performance". |
| Fail action | Nếu cold sparkline > 4s → implement optimization BR-59-03 hint. Vẫn vượt → escalate PAUSE-Coder-02. |

#### TC-59-09 — Edge case zero orders period (BR-59-14)

| Pre-condition | Tenant 106: 0 paid orders trong period. |
| Method | `kpiService.getMtdKpis()` |
| Expected | `platform_fee = 0`. No FeeService call (ordersByTenant empty). No warn log. |

#### TC-59-10 — Backward compat shape (BR-59-08) ⭐ CRITICAL

| Method | Compare response shape `/api/admin/dashboard/kpi` pre-F059 vs post-F059 |
| Expected | Identical JSON shape: `{ kpis: [{key, label, value, prevValue, deltaPercent, unit}], period, periodStart, prevPeriodStart }`. NO new fields. NO removed fields. |
| Assert | Frontend Recharts không break. |

#### TC-59-11 — Per-order pro-rate within sparkline day boundary (edge)

| Pre-condition | Tenant 107: override `7%` effective_from `2026-05-15`. 2 orders cùng day 2026-05-15: order A payment_on `00:30:00`, order B payment_on `23:30:00`. Both net 10M. |
| Expected | `feePoints['2026-05-15'].value = 2 × 10M × 7% = 1400000` (BR-58-05 inclusive boundary — F-058 reuse). |
| MUST NOT | Apply 5.5% cho order A (assume incorrect "before effective"). |

#### TC-59-12 — Legacy tenant no MerchantConfig → Tier 3 5.5% (BR-58-15 reuse)

| Pre-condition | Tenant 108: KHÔNG có MerchantConfig doc. 1 order net 10M. |
| Expected | `platform_fee = 550000` (5.5% Tier 3 platform default). `logger.warn` fire 1× per request. |

#### TC-59-13 — KPI cache TTL 60s (BR-59-09)

| Method | Call `getMtdKpis()` 2 lần liên tiếp trong 30s |
| Expected | Lần 2 HIT cache (no DB query, no FeeService call). Lần 3 sau 65s MISS (cache expired). |
| Assert | `db.query` spy được called 1× cho 2 invocations trong TTL window. |

### Frontend E2E (Playwright)

- ❌ KHÔNG E2E mới (response shape unchanged).
- ✅ Regression smoke: open `/admin` post-deploy, verify 4 KPI cards render + sparkline chart không break visually + KPI "Phí 5BIB" value match cùng tháng `/admin/analytics`.

### Security Checks

- [ ] Dashboard endpoints `LogtoStaffGuard` existing — F-059 KHÔNG modify auth.
- [ ] Response KHÔNG leak: MongoDB `_id`, MerchantConfig raw, FeeService internal warnings, appliedOverrides[].
- [ ] No new endpoint — no new attack surface.
- [ ] Input validation: existing pattern unchanged.

### Coverage target

- Backend unit test: ≥ 10 new (TC-59-01..13). Final coverage `kpi.service.ts` + `sparkline.service.ts` ≥ 80%.
- Cron + race condition: TC-59-07.
- Performance benchmark output mandatory paste TC-59-08.

---

## ✅ Answers to Manager's PAUSE Conditions

| PAUSE | Decision (Danny chốt) | Encoded BR |
|-------|----------------------|------------|
| **PAUSE-59-01** | ✅ **A — Per-order pro-rate** reuse `FeeService.computeFeeForOrdersAggregate` zero modification. Cascade Tier 0 → 1 → 2 → 3 per-order, consistency với F-058 Analytics. | BR-59-01, BR-59-02, BR-59-12 |
| **PAUSE-59-02** | ✅ **B — INCLUDE MANUAL fee**. GMV display GIỮ exclude MANUAL (UX hiện tại), nhưng platform fee aggregate INCLUDE MANUAL với `manual_fee_per_ticket × manual_ticket_count` cascade. → Phí 5BIB có thể > GMV × 5.5%. UI legend đề xuất disclaimer (out of scope frontend F-060). | BR-59-04, TC-59-03/04 |
| **PAUSE-59-03** | ✅ **A — Giữ cron EVERY_HOUR**. KHÔNG đổi interval. Lock `dashboard:cron-lock:sparkline` TTL 3300s unchanged. | BR-59-05, 6.6 |
| **PAUSE-59-04** | ✅ **B — Skip 3-way discrepancy check**. Sau F-059 Dashboard ≡ Analytics by design (cùng FeeService source + cùng `payment_on` field). F-058 `/discrepancy-check` Analytics vs Reconciliation đủ. | BR-59-12, Goal |
| **PAUSE-59-05** | ✅ **B — Admin manual trigger** post-deploy / cron 1h auto-refresh. KHÔNG backfill historical. Cache TTL natural expire 1h. | BR-59-06, 6.7 |
| **PAUSE-59-06** | ✅ **4 test scenarios confirmed** — TC-59-01 (clean baseline) + TC-59-02 (Tier 0 override rate) + TC-59-03 (MANUAL only) + TC-59-04 (mix override + MANUAL). | TC-59-01..04 |

### PAUSE BA mới phát hiện (Manager `/5bib-plan` chốt trước Coder)

| PAUSE BA | Câu hỏi | BA recommend |
|----------|---------|-------------|
| **PAUSE-Coder-01** | `pullOrdersForFeeAggregate` helper duplicate giữa Analytics + Dashboard KPI + Sparkline → abstract shared? | **KHÔNG** abstract. Duplicate có chủ ý (conventions.md). Refactor F-060+ khi có 4th use case. |
| **PAUSE-Coder-02** | Sparkline cold > 4s budget sau optimization → fallback strategy A (giảm 14-day) hay B (denormalize MongoDB snapshot)? | **A trước** (low complexity). Escalate Danny nếu A vẫn vượt. |
| **PAUSE-Coder-03** | MerchantConfig N+30N Mongo query in sparkline loop → memoize per request? | **YES — pre-load all tenant configs trong sparkline.service trước loop** (KHÔNG modify FeeService F-058). |
| **PAUSE-Coder-04** | Route prefix actual `/api/admin/dashboard/*` confirm? | YES verified. Manager init typo `/api/dashboard/*` không ảnh hưởng code. |

---

## 📊 Files Coder cần đụng (impact summary)

| File | Action | LoC delta est |
|------|--------|---------------|
| `backend/src/modules/dashboard/services/kpi.service.ts` | REFACTOR aggregateOrders + ADD KPI cache wrapper + ADD pullOrdersForFeeAggregate helper | +100 / -15 |
| `backend/src/modules/dashboard/services/sparkline.service.ts` | REFACTOR compute + ADD pullOrdersForFeeAggregate + ADD pre-load configs | +120 / -10 |
| `backend/src/modules/dashboard/dashboard.module.ts` | IMPORT FinanceModule | +2 |
| `backend/src/modules/merchant/merchant.service.ts:flushEventOverrideCache` | EXTEND 2 dashboard pattern | +12 |
| `backend/src/modules/dashboard/services/__tests__/kpi.service.f059.spec.ts` | NEW spec — 8 tests | +320 |
| `backend/src/modules/dashboard/services/__tests__/sparkline.service.f059.spec.ts` | NEW spec — 5 tests | +220 |
| `backend/src/modules/merchant/__tests__/merchant.service.f043.spec.ts` | EXTEND assert 9 patterns | +20 |
| `CLAUDE.md` | UPDATE Redis Keys Registry +2 rows | +4 |
| **Total** | | **~800 LoC** |

---

## 📌 Status

**Status:** 🔵 READY

**Next step:** Danny chạy `/5bib-plan FEATURE-059-dashboard-cascade-fix` để Manager review PRD + phát hành kế hoạch implementation. Manager MUST chốt 4 PAUSE-Coder (01/02/03/04) trước khi Coder bắt đầu — đặc biệt PAUSE-Coder-03 (memoize MerchantConfig pre-load) impact directly perf budget TC-59-08.
