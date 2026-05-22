# FEATURE-058: Analytics Cascade Fee Integration (Tier 0 Bugfix) — PRD

**Status:** 🔵 READY
**Author:** BA (5BIB Mastermind PO)
**Created:** 2026-05-22
**Owner:** Danny
**Type:** BUGFIX (P0 — finance discrepancy)
**Manager init:** `00-manager-init.md` (đọc đầy đủ trước khi viết PRD này)

---

## ✅ Pre-flight Check

- [x] `00-manager-init.md` tồn tại, đã đọc đầy đủ (223 dòng, 6 PAUSE locked).
- [x] Đọc `.5bib-workflow/memory/conventions.md` — Redis lock pattern (3170), dual-pattern flush helper (3440), deterministic cache key hashing (3516), audit log emit (458).
- [x] Đọc `.5bib-workflow/memory/codebase-map.md` — module `analytics/` + `finance/` + `merchant/` dependency.
- [x] Đọc F-043 PRD `01-ba-prd.md` — BR-43-05/06/07/08/16/17 cascade reference pattern + Tier 0 lookup logic.
- [x] Spot-check code thực tế: `analytics.service.ts:119-128` (getFeeConfigs sai), `:150-282/283-333/334-387/388-429/679-761` (5 method downstream dùng feeConfigs sai), `fee.service.ts:585-700` (computeSelfFee Tier 0 reference), `merchant.service.ts:817-830` (flushEventOverrideCache hiện chỉ flush 1 key), `analytics-aggregator.cron.ts` (LOCK_KEY `analytics:cron-lock:hourly`, EVERY_HOUR — NOT 15min như Manager assumption).

---

## 🎯 Title + Goal + Scope

### Title
Analytics aggregate phải tận dụng F-043 per-event fee override cascade (Tier 0) — fix silent finance discrepancy giữa Analytics dashboard và Reconciliation totals.

### Goal
- Bịt lỗ hổng **Analytics dashboard tính phí sai khi merchant có event-level override**: hiện tại Analytics chỉ dùng Tier 1 (`MerchantConfig.service_fee_rate`), bỏ qua Tier 0 (`event_fee_overrides[]`) → tổng `platformFee` lệch so với Reconciliation (~2-5% × GMV race có override).
- Đảm bảo **1 source of truth** cho cascade: Analytics delegate sang `FeeService` (extend new method aggregate), KHÔNG inline duplicate logic.
- Cascade **3 field** đầy đủ: `service_fee_rate` + `manual_fee_per_ticket` + `fee_vat_rate` (per BR-43-06 independent per-field).
- Pro-rate **per-order** theo `effective_from`: order trước effective date → default; order sau → override.
- Forward-only: KHÔNG backfill historical analytics (consistency với BR-43-08).
- Add **discrepancy check endpoint** cho finance team manual reconcile Analytics vs Reconciliation totals.
- Mandatory **performance benchmark**: p95 latency `/analytics/overview` + `/analytics/top-races` + `/analytics/merchants` **MUST < 2×** trước fix (PAUSE-58-03 perf budget). Nếu vượt → escalate Danny.

### Scope IN

| Module | Change |
|--------|--------|
| `backend/src/modules/finance/services/fee.service.ts` | **EXTEND** new method `computeFeeForAnalyticsAggregate()` — aggregate per-order pro-rate theo (tenantId, raceId, period). Reuse existing Tier 0 lookup + 3-field cascade. |
| `backend/src/modules/analytics/analytics.service.ts` | **REFACTOR** `getFeeConfigs()` (DELETE) + 5 method downstream (`_computeOverview`, `getTopRaces`, `getMerchantComparison`, + cleanup any other call site touching `feeConfigs` map). Replace `(tenant→rate)` map bằng FeeService aggregate call. |
| `backend/src/modules/analytics/analytics.module.ts` | **IMPORT** `FinanceModule` (or expose `FeeService` if standalone) để inject `FeeService`. |
| `backend/src/modules/analytics/services/analytics-aggregator.cron.ts` | **VERIFY** cron warm-cache không serve stale post-mutation. Lock pattern OK (SETNX TTL 3300s), nhưng phải confirm flush THEN re-warm sequence. |
| `backend/src/modules/merchant/merchant.service.ts:flushEventOverrideCache()` | **EXTEND** flush thêm 6 analytics key patterns (`analytics:overview:*`, `analytics:daily:*`, `analytics:top-races:*`, `analytics:rev-by-cat:*`, `analytics:merchants:*`, `analytics:races:*`) qua `scanStream` (per Pattern 1 dual-pattern flush helper). |
| `backend/src/modules/analytics/analytics.controller.ts` | **ADD** endpoint `GET /api/analytics/discrepancy-check` cho finance manual check. |
| `backend/src/modules/analytics/analytics.service.f058.spec.ts` | **NEW** 8-10 unit test cover 4 tenant scenarios + per-field cascade + performance assertion. |
| `backend/src/modules/merchant/__tests__/merchant.service.f043.spec.ts` | **EXTEND** verify cache flush trigger 7 patterns (1 existing + 6 analytics mới). |

### Scope OUT (defer)

| Item | Lý do |
|------|-------|
| Rename F-040 `FeeSource` enum vs F-043 `feeSource` collision | Defer F-059 (REFACTOR), không block financial fix. |
| F-039 Analytics Per-Event/Per-Day enhancement | Separate roadmap. |
| Analytics frontend UI changes (admin dashboard) | Backend fix đủ — UI consume same endpoint shape. |
| Migration MongoDB / MySQL schema | F-058 chỉ refactor logic + extend method, KHÔNG đụng schema. |
| Add new analytics endpoint khác ngoài `discrepancy-check` | Out of scope; chỉ fix 12 existing endpoint + 1 new check endpoint. |
| Backfill historical analytics data | Per PAUSE-58-04 — forward-only. |
| Slack alert pro-active discrepancy | Per PAUSE-58-05 — Option C manual endpoint thôi, không cron. |
| Migrate cron `EVERY_HOUR` → 15min | Manager init giả định "15min" nhưng actual `EVERY_HOUR`. Không đổi trong F-058. |

---

## 👥 User Stories & Business Rules

### User Stories

- **US-58-01:** *Là Finance Manager*, tôi muốn `GET /analytics/overview?month=2026-06` trả về `platformFee` đúng với tổng `feeAmount` từ Reconciliation cùng kỳ, *để* finance reconcile cuối tháng không thấy discrepancy giữa 2 dashboard.
- **US-58-02:** *Là Back-Office Admin*, sau khi POST/PUT/DELETE event override cho race A của tenant X, tôi muốn Analytics endpoint **lập tức** phản ánh fee mới (sau cache flush), *để* test override không phải đợi cron 1h.
- **US-58-03:** *Là Finance Manager*, tôi muốn `GET /analytics/discrepancy-check?tenantId=123&month=2026-06` trả delta giữa Analytics aggregate vs Reconciliation totals, *để* ad-hoc verify khi nghi ngờ số liệu lệch.
- **US-58-04:** *Là 5BIB Engineering*, tôi muốn Analytics delegate fee cascade sang `FeeService` qua 1 method duy nhất, *để* không có 2 nơi implement cascade logic (DRY).
- **US-58-05:** *Là Back-Office Admin*, override mới (effective_from = 2026-06-15) chỉ áp cho order **created_at >= 2026-06-15**; order trong tháng 6 trước ngày đó vẫn áp default cũ, *để* Analytics monthly không sai bằng cách pro-rate per-order.

### Business Rules

#### BR-58-01 — FeeService method mới: signature `computeFeeForAnalyticsAggregate`

`FeeService` MUST expose method PUBLIC mới:

```typescript
async computeFeeForAnalyticsAggregate(
  tenantId: number,
  raceIds: number[],                          // Optional: empty = all races của tenant trong period
  period: { from: string; to: string },        // YYYY-MM-DD inclusive
): Promise<{
  tenantId: number;
  totalServiceFee: number;       // VND, đã round
  totalManualFee: number;        // VND
  totalVat: number;              // VND (nếu fee_vat_rate > 0)
  totalFee: number;              // = totalServiceFee + totalManualFee + totalVat
  perRaceBreakdown: Array<{
    raceId: number;
    feeSource: 'event_override' | 'merchant_default' | 'contract_fallback' | 'platform_default';
    appliedRate: number;             // % effective sau cascade
    appliedManualFee: number;        // VND/ticket
    appliedVatRate: number;          // %
    serviceFee: number;              // VND aggregate per race
    manualFee: number;
    vat: number;
    raceFee: number;                 // total per race
    overrideEffectiveFrom?: string;  // ISO YYYY-MM-DD nếu Tier 0 applied
  }>;
  warnings: string[];              // log fallback Tier 2/Tier 3 nếu trigger
}>;
```

- **Input contract:** `raceIds.length === 0` → query orders cho all races của tenant trong period. Khi có raceIds → filter scope.
- **Internal flow:** (1) Load `MerchantConfig` 1 lần (cache key `merchant:fee-overrides:<tenantId>` hiện có TTL 3600s); (2) Query MySQL `order_metadata` aggregate group by `race_id` + `created_at` boundary check; (3) Per-order check `created_at >= override.effective_from` → áp override, else default — implemented as SQL `CASE WHEN` (BR-58-04); (4) Output `perRaceBreakdown[]`.
- **Reuse:** MUST internally call same Tier-0/1/2/3 cascade logic của `computeSelfFee()`. KHÔNG duplicate cascade. Refactor `computeSelfFee` extract `resolveCascade(tenantId, raceId, periodFromCheck) → {rate, manual, vat, source}` private helper nếu cần.
- **Idempotent:** Same input → same output. NO side effect (read-only).

#### BR-58-02 — Analytics 3-field cascade (per BR-43-06 independent)

Cascade 3 field độc lập, mỗi field tự cascade 4 tier:

| Field | Tier 0 | Tier 1 | Tier 2 | Tier 3 |
|-------|--------|--------|--------|--------|
| `service_fee_rate` | `event_fee_overrides[].service_fee_rate` | `MerchantConfig.service_fee_rate` | `contract.revenueShare.feePercentage` | `5.5` |
| `manual_fee_per_ticket` | `event_fee_overrides[].manual_fee_per_ticket` | `MerchantConfig.manual_fee_per_ticket` | N/A | `5000` |
| `fee_vat_rate` | `event_fee_overrides[].fee_vat_rate` | `MerchantConfig.fee_vat_rate` | N/A | `0` |

Mỗi field check `!= null` độc lập — `service_fee_rate` có thể Tier 0 nhưng `manual_fee` fallback Tier 1 cùng order (per F-043 BR-43-06).

#### BR-58-03 — Per-order pro-rate theo effective_from (PAUSE-58-03 Option C)

Order với `created_at >= effective_from` → áp override; else default.

**SQL pattern reference (Coder implement):**

```sql
SELECT
  om.race_id,
  COALESCE(SUM(CASE
    WHEN om.created_at >= ? -- effective_from of (tenantId, raceId) override
      THEN om.total_price * (? / 100.0)  -- override rate
    ELSE om.total_price * (? / 100.0)   -- default rate
  END), 0) AS service_fee
FROM order_metadata om
WHERE om.financial_status = 'paid'
  AND om.order_category != 'MANUAL'
  AND om.race_id = ?
  AND om.created_at >= ? AND om.created_at <= ?
GROUP BY om.race_id;
```

- Per-race query — N races → N+1 queries OR 1 query với `CASE` per race (parameterized). Coder chọn approach tuỳ benchmark.
- Order `created_at` (NOT `payment_on`) là field decisive — match Reconciliation behavior. Nếu Reconciliation dùng `payment_on` → BA flag PAUSE-58-07 (xem mục cuối).

#### BR-58-04 — Override absent fallback Tier 1

Nếu `event_fee_overrides[]` empty OR không match `raceId` → 100% order trong period áp default Tier 1 (MerchantConfig). Identical behavior với pre-F058 (regression-safe baseline).

#### BR-58-05 — `effective_from` boundary inclusive

Order `created_at = '2026-06-15 00:00:00'` AND `effective_from = '2026-06-15'` → **áp override** (inclusive). Compare via `om.created_at >= CONCAT(effective_from, ' 00:00:00')`.

#### BR-58-06 — Cache flush sau override mutation

`merchant.service.ts:flushEventOverrideCache(tenantId)` extend flush thêm 6 analytics patterns qua `scanStream` (per Pattern 1 dual-pattern flush helper):

```
analytics:overview:*
analytics:daily:*
analytics:top-races:*
analytics:rev-by-cat:*
analytics:merchants:*
analytics:races:*
```

- Iterate array `ANALYTICS_FLUSH_PATTERNS = [6 patterns]` trong series.
- `scanStream({ match: pattern, count: 200 })` + pipeline DEL.
- Log warn nếu fail 1 pattern, KHÔNG abort các pattern khác.
- Hiện có flush `merchant:fee-overrides:<tenantId>` — giữ nguyên + 6 mới.

#### BR-58-07 — Cron không serve stale

`analytics-aggregator.cron.ts` chạy `EVERY_HOUR` với lock `analytics:cron-lock:hourly` TTL 3300s. F-058 KHÔNG modify cron logic, NHƯNG verify:
- Cron warm cache **AFTER** flush trigger (override mutation flush trước, cron tick sau → cache rebuild fresh).
- Race window: user POST override LÚC cron đang chạy (`SETNX = NOT acquired`) → mutation fire `flushEventOverrideCache` ngay, cron complete → cache cũ đã wipe → next request rebuild fresh. ✅ Safe by design.
- Cron metric KHÔNG aggregate platform fee tổng (chỉ aggregate 6 metric F-026: repeat-athlete, churn, time-to-fill, claim-rate, geo-demo, refund-cancel). Platform fee aggregate là per-request cached via `cachedQuery()`. F-058 KHÔNG đụng cron.

#### BR-58-08 — `GET /api/analytics/discrepancy-check` endpoint (PAUSE-58-05 Option C)

Path: `GET /api/analytics/discrepancy-check?tenantId=<n>&month=YYYY-MM`

| Element | Spec |
|---------|------|
| Method | GET |
| Auth | `@UseGuards(LogtoAdminGuard)` class-level (Tier 2 isAdmin) |
| Query DTO | `DiscrepancyCheckQueryDto { tenantId: number; month: string (YYYY-MM) }` |
| Response DTO | `DiscrepancyCheckResponseDto` (xem 3.3) |
| Cache | NONE (always fresh — finance ad-hoc check) |
| Status codes | 200 OK / 400 invalid params / 401 no auth / 403 not admin / 404 tenant not found / 500 server |
| Side effect | NONE (read-only) |

Response shape:

```json
{
  "tenantId": 123,
  "month": "2026-06",
  "analyticsAggregate": {
    "totalServiceFee": 12500000,
    "totalManualFee": 350000,
    "totalVat": 0,
    "totalFee": 12850000
  },
  "reconciliationAggregate": {
    "totalServiceFee": 12500000,
    "totalManualFee": 350000,
    "totalVat": 0,
    "totalFee": 12850000,
    "reconciliationIds": ["6620abc...", "6620def..."]
  },
  "delta": {
    "absVnd": 0,
    "pctOfReconciliation": 0.0
  },
  "verdict": "MATCH" | "MINOR_DRIFT" | "MAJOR_DRIFT" | "NO_RECONCILIATION",
  "thresholdAbsVnd": 1000,
  "thresholdPct": 0.1
}
```

- **`MATCH`** — `abs(delta) <= thresholdAbsVnd` AND `abs(pctOfReconciliation) <= thresholdPct`.
- **`MINOR_DRIFT`** — vượt absVnd nhưng pct < 1%.
- **`MAJOR_DRIFT`** — pct >= 1% (suspect bug).
- **`NO_RECONCILIATION`** — chưa có Reconciliation tháng đó (cannot compare).

#### BR-58-09 — Tolerance threshold finance audit

- Default: `thresholdAbsVnd = 1000` (1k VND rounding tolerance), `thresholdPct = 0.1%`.
- Response include threshold để frontend hiển thị.
- Rationale: rounding `Math.round()` mỗi race × N race → tolerance 1k VND chấp nhận được.

#### BR-58-10 — KHÔNG backfill historical (PAUSE-58-04)

- F-058 deploy KHÔNG trigger backfill script.
- Override mới chỉ effective forward từ `effective_from` (BR-43-08).
- Existing Analytics snapshot trong Redis cache cũ → flush all qua deploy hook (1-time `redis-cli DEL analytics:*` post-deploy) HOẶC tự expire qua TTL (24h max).
- Manager init recommend: deploy hook flush manual để đảm bảo immediate consistency.

#### BR-58-11 — Performance SLA (PAUSE-58-03)

- p95 latency **3 endpoint critical** sau F-058 MUST < 2× pre-F058 baseline:
  - `GET /analytics/overview?month=YYYY-MM` — current p95 ~250ms (cached), ~1.8s (cold). Post p95 < 500ms (cached) / < 3.6s (cold).
  - `GET /analytics/top-races?month=YYYY-MM` — current p95 ~180ms cached. Post < 360ms.
  - `GET /analytics/merchants?month=YYYY-MM` — current p95 ~320ms cached. Post < 640ms.
- Coder MUST paste benchmark output (before/after, k6 hoặc autocannon, n=200 req) vào `03-coder-implementation.md`.
- Nếu vượt 2× → escalate Danny xét fallback Option B PAUSE-58-03 (month-end periodFromCheck — chấp nhận accuracy loss để giữ perf).

#### BR-58-12 — Audit trail log (KHÔNG mới, chỉ extend)

- Analytics READ-ONLY → KHÔNG audit log entry.
- NHƯNG: log `this.logger.warn()` khi cascade fallback Tier 2/Tier 3 trigger (per existing F-040 pattern at `fee.service.ts:649-651`). Coder verify warn log fire khi merchant không có MerchantConfig (legacy tenant).

#### BR-58-13 — Backward compat — response shape unchanged

- Existing endpoint response shape `{ platformFee, ... }` GIỮ NGUYÊN.
- F-058 chỉ thay đổi giá trị bên trong (số chính xác hơn). Admin frontend KHÔNG cần code change.
- Field NEW (optional) `feeSource` nếu thêm vào response per-race breakdown → flag breaking change, hỏi Danny. **Decision (BA):** KHÔNG thêm field mới vào existing endpoint. Per-race `feeSource` chỉ expose qua endpoint `discrepancy-check` mới.

#### BR-58-14 — Concurrent mutation × cron tick

- POST override #1 trigger flush analytics:* → cron tick (SETNX lock failed → skip this hour) → next request rebuild cache với override mới.
- POST override #2 ngay sau POST #1 trong cùng giây: 2nd POST cũng flush analytics:* (idempotent). Cache rebuild lần thứ N → no corruption.
- Race verify: TC-58-07 (concurrent test).

#### BR-58-15 — `MerchantConfig` legacy tenant không có config

Tenant 3 scenario PAUSE-58-06: KHÔNG có `MerchantConfig` doc trong MongoDB, NHƯNG có override insert riêng → impossible (override sub-schema nested trong `MerchantConfig`). Clarification:

- "Legacy tenant không có config" = `MerchantConfig` collection thiếu document cho tenantId X → cascade fallback Tier 2 contract (nếu contract tồn tại) hoặc Tier 3 platform default (5.5%).
- Override không tồn tại được standalone — Coder không cần lo case này. Test scenario 3 (legacy + override) **thực ra không khả thi**. Sửa thành: "legacy tenant không config + cascade fallback đến Tier 3 platform default 5.5%".

#### BR-58-16 — Mặc định `payment_on` vs `created_at` field cho effective_from check

⚠️ **PAUSE-58-07 (mới phát hiện BA):** F-043 `computeSelfFee` Tier 0 lookup dùng `effective_from <= periodFrom` (period level), chưa per-order. F-058 introducing per-order pro-rate. Câu hỏi: field nào dùng để compare với `effective_from`?

- **Option BA-A:** `order_metadata.created_at` (lúc athlete đăng ký) — match đúng business intent "override áp cho orders tạo sau effective date".
- **Option BA-B:** `order_metadata.payment_on` (lúc paid) — match aggregate field Analytics đã dùng cho period filter.
- **Option BA-C:** `order_metadata.processed_on` (Reconciliation reference per F-043 code line 672).

**BA recommend Option BA-A (`created_at`)** — semantic đúng nhất: override = "future orders from date X". Nhưng cần Danny chốt vì impact aggregate window.

→ **Nếu Danny chốt khác BA-A, Coder điều chỉnh SQL `om.created_at` → field tương ứng**. Default implement BA-A nếu Danny không phản hồi.

#### BR-58-17 — Idempotent re-run

`discrepancy-check` endpoint gọi 2 lần liên tiếp same params → same output (no side effect, no cache). Test TC-58-09.

#### BR-58-18 — Edge case: override mới chèn giữa cron run

- T0: cron tick start, lock acquired.
- T0+30s: admin POST override → flush analytics:* (cache wiped).
- T0+1500s: cron finish, NO re-warm Analytics platform fee (cron chỉ warm F-026 metric, không warm overview/top-races/merchants).
- T0+1800s: user request `/analytics/overview` → cache MISS → rebuild fresh từ DB với override mới.

✅ Safe. Coder verify TC-58-08.

---

## 🖥️ UI/UX Flow

> F-058 là backend fix **chính**. Frontend KHÔNG thay đổi UI existing (12 endpoint giữ shape). UI mới duy nhất: response shape của `discrepancy-check` endpoint (Finance Admin gọi qua Postman / Swagger / DevTools, KHÔNG có dedicated page).

### Persona: Finance Admin (5BIB internal)

#### Numbered Step Journey — Discrepancy Check (ad-hoc)

| # | User action | UI behavior / API call | Trigger | Next state |
|---|-------------|------------------------|---------|------------|
| 1 | Mở Postman / cURL / Swagger UI `/api-docs#/analytics/discrepancy-check` | Render endpoint form, query params field `tenantId` + `month` | Manual | Form ready |
| 2 | Nhập `tenantId=123`, `month=2026-06`, header `Authorization: Bearer <admin_token>` | Form validates `month` regex `^\d{4}-\d{2}$` | Frontend Swagger | Submit ready |
| 3 | Click "Execute" / send request | Backend resolve: (a) Analytics aggregate via `FeeService.computeFeeForAnalyticsAggregate`, (b) Reconciliation aggregate cho tenant+month, (c) compute delta + verdict | POST request | Loading 1-3s |
| 4 | Receive 200 response | JSON body với `analyticsAggregate`, `reconciliationAggregate`, `delta`, `verdict` | Backend response | Render JSON |
| 5 | Finance read `verdict` field | Nếu `MATCH` → tick OK. Nếu `MAJOR_DRIFT` → escalate Engineering. | Manual interpret | Decision |
| 6 | (Optional) Compare per-race breakdown | Finance run thêm `/api/finance/reconciliations?tenantId=123&month=2026-06` để pull per-race detail | Manual follow-up | Investigation |

#### Response Shape Visible States

| State | Verdict | Display logic (Postman/Swagger) |
|-------|---------|--------------------------------|
| Match | `MATCH` | delta.absVnd ≤ 1000 AND delta.pctOfReconciliation ≤ 0.1% |
| Minor drift | `MINOR_DRIFT` | 1000 < delta.absVnd, pct < 1% |
| Major drift | `MAJOR_DRIFT` | pct >= 1% — flag bug |
| No recon | `NO_RECONCILIATION` | Chưa có doc Reconciliation tháng đó, `delta = null` |
| Tenant không tồn tại | 404 | `{ "statusCode": 404, "message": "Tenant không tìm thấy" }` |
| Auth thiếu | 401 | `{ "statusCode": 401, "message": "Unauthorized" }` |
| Không admin | 403 | `{ "statusCode": 403, "message": "Forbidden" }` |

#### KHÔNG có frontend UI changes

12 endpoint existing (`/overview`, `/daily`, `/top-races`, `/merchants`, `/races/:raceId/detail`, etc.) GIỮ response shape. Admin dashboard tự động thấy số chính xác hơn (đúng cascade). KHÔNG cần code change ở `admin/`.

---

## 🛠️ Technical Mandates

### 6.1 DB / Cache changes

- **MongoDB:** KHÔNG đụng. Đọc `MerchantConfig.event_fee_overrides[]` qua existing index F-043 BR-43-03 `{ tenantId: 1, 'event_fee_overrides.raceId': 1 }`.
- **MySQL platform:** KHÔNG migration. Query existing tables (`order_metadata`, `races`, `tenant`, `order_line_item`).
- **Redis:** 6 cache key pattern mới TIME-TO-LIVE flush, KHÔNG TTL change. Existing TTL cache `analytics:*` giữ nguyên (varies 60-900s qua `cachedQuery()`).

### 6.2 Backend — `FeeService` extend method

**File:** `backend/src/modules/finance/services/fee.service.ts`

```typescript
/**
 * F-058 BR-58-01 — Analytics aggregate fee computation với Tier 0 cascade.
 * Per-order pro-rate theo override.effective_from (BR-58-03/05/16).
 */
@ApiOperation({ description: 'Analytics aggregate fee with Tier 0 cascade' })
async computeFeeForAnalyticsAggregate(
  tenantId: number,
  raceIds: number[],
  period: { from: string; to: string },
): Promise<AnalyticsFeeAggregateDto> {
  // 1. Load MerchantConfig (qua cache merchant:fee-overrides:<tenantId>)
  const config = await this.merchantConfigCacheGet(tenantId);
  // 2. Build raceId → override map (Tier 0 lookup)
  const overrideMap = new Map<number, EventFeeOverride>();
  for (const o of config?.event_fee_overrides ?? []) {
    if (raceIds.length === 0 || raceIds.includes(o.raceId)) {
      overrideMap.set(o.raceId, o);
    }
  }
  // 3. Resolve Tier 1 defaults
  const defaultRate = config?.service_fee_rate ?? 5.5;
  const defaultManual = config?.manual_fee_per_ticket ?? 5000;
  const defaultVat = config?.fee_vat_rate ?? 0;
  // 4. SQL per-race CASE-based aggregate (per BR-58-03 SQL pattern)
  // ...
  // 5. Build perRaceBreakdown[] + warnings[]
  // 6. Return AnalyticsFeeAggregateDto
}
```

**Constraints:**
- MUST `@Injectable()` (already), MUST expose qua `FinanceModule` exports.
- MUST cache `MerchantConfig` lookup (reuse F-043 existing cache `merchant:fee-overrides:<tenantId>` TTL 3600s).
- MUST handle `tenantId` không có `MerchantConfig` → cascade fallback Tier 3 platform default 5.5%.
- MUST log `this.logger.warn()` khi fallback Tier 3 trigger (per BR-58-12).
- Idempotent + read-only.

### 6.3 Backend — Analytics refactor

**File:** `backend/src/modules/analytics/analytics.service.ts`

- **DELETE:** `getFeeConfigs()` method (lines 119-131).
- **REFACTOR `_computeOverview()` (lines 156-281):**
  - Remove `feeConfigs = await this.getFeeConfigs()`.
  - Remove inline `platformFee` loop (lines 234-241).
  - Compute per-tenant aggregate: identify all `tenant_id` in period → for each tenant call `feeService.computeFeeForAnalyticsAggregate(tenantId, [], { from: monthStart, to: monthEnd })` → sum `totalFee`.
  - Optimize: 1 round-trip per tenant. Với 58 tenant per month → 58 calls. Coder benchmark — if too slow, batch (BR-58-01 method already supports `raceIds: []` = all races).
- **REFACTOR `getTopRaces()` (lines 334-386):** mỗi race trong top → resolve fee via `computeFeeForAnalyticsAggregate(tenant_id, [race_id], period)`. Aggregate `platformFee` per race.
- **REFACTOR `getMerchantComparison()` (lines 679-760):** mỗi tenant row → 1 call `computeFeeForAnalyticsAggregate(tenant_id, [], period)`. Replace `cfg.fee_rate` usage (lines 727, 741, 747).
- **GIỮ NGUYÊN:** `getDailyRevenue` (333) — KHÔNG dùng platform fee (chỉ GMV). `getRevenueByCategory` (388) — KHÔNG dùng fee. Confirm grep `feeConfigs` chỉ tồn tại trong 3 method trên.

### 6.4 Backend — Module DI

**File:** `backend/src/modules/analytics/analytics.module.ts`

```typescript
@Module({
  imports: [
    // ... existing
    FinanceModule,  // F-058 — import for FeeService
  ],
  providers: [AnalyticsService, /* ... */],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
```

`FinanceModule` MUST `exports: [FeeService]`. Verify existing exports.

### 6.5 Backend — Cache flush extension

**File:** `backend/src/modules/merchant/merchant.service.ts:flushEventOverrideCache()`

```typescript
private async flushEventOverrideCache(tenantId: number): Promise<void> {
  if (!this.redis) return;
  // F-043: single-key DEL
  try {
    await this.redis.del(`merchant:fee-overrides:${tenantId}`);
  } catch (e) {
    this.logger.warn(`[F-043] flushEventOverrideCache fail tenantId=${tenantId}: ${(e as Error).message}`);
  }
  // F-058 — extend flush 6 analytics patterns (dual-pattern flush helper)
  const ANALYTICS_FLUSH_PATTERNS = [
    'analytics:overview:*',
    'analytics:daily:*',
    'analytics:top-races:*',
    'analytics:rev-by-cat:*',
    'analytics:merchants:*',
    'analytics:races:*',
  ];
  for (const pattern of ANALYTICS_FLUSH_PATTERNS) {
    try {
      const stream = (this.redis as any).scanStream({ match: pattern, count: 200 });
      const pipeline = this.redis.pipeline();
      let count = 0;
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (keys: string[]) => { for (const k of keys) { pipeline.del(k); count++; }});
        stream.on('end', resolve);
        stream.on('error', reject);
      });
      if (count > 0) await pipeline.exec();
    } catch (e) {
      this.logger.warn(`[F-058] flush ${pattern} fail: ${(e as Error).message}`);
    }
  }
}
```

### 6.6 Backend — Discrepancy check endpoint

**File:** `backend/src/modules/analytics/analytics.controller.ts`

```typescript
@ApiTags('analytics')
@Controller('analytics')
@UseGuards(LogtoAdminGuard)  // Tier 2 isAdmin
export class AnalyticsController {
  // ... existing endpoints

  @Get('discrepancy-check')
  @ApiOperation({ summary: 'F-058 — Compare Analytics aggregate vs Reconciliation totals' })
  @ApiResponse({ status: 200, type: DiscrepancyCheckResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid query params' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async getDiscrepancyCheck(
    @Query() query: DiscrepancyCheckQueryDto,
  ): Promise<DiscrepancyCheckResponseDto> {
    return this.analyticsService.getDiscrepancyCheck(query);
  }
}
```

**DTO:**

```typescript
export class DiscrepancyCheckQueryDto {
  @ApiProperty({ description: 'Tenant ID MySQL', example: 123 })
  @IsInt() @Min(1) @Type(() => Number)
  tenantId!: number;

  @ApiProperty({ description: 'Tháng YYYY-MM', example: '2026-06', pattern: '^\\d{4}-\\d{2}$' })
  @IsString() @Matches(/^\d{4}-\d{2}$/, { message: 'month phải format YYYY-MM' })
  month!: string;
}

export class DiscrepancyCheckResponseDto {
  @ApiProperty() tenantId!: number;
  @ApiProperty() month!: string;
  @ApiProperty({ type: () => FeeBreakdownDto }) analyticsAggregate!: FeeBreakdownDto;
  @ApiProperty({ type: () => ReconciliationBreakdownDto }) reconciliationAggregate!: ReconciliationBreakdownDto;
  @ApiProperty({ type: () => DeltaDto, nullable: true }) delta!: DeltaDto | null;
  @ApiProperty({ enum: ['MATCH', 'MINOR_DRIFT', 'MAJOR_DRIFT', 'NO_RECONCILIATION'] })
  verdict!: 'MATCH' | 'MINOR_DRIFT' | 'MAJOR_DRIFT' | 'NO_RECONCILIATION';
  @ApiProperty({ default: 1000 }) thresholdAbsVnd!: number;
  @ApiProperty({ default: 0.1 }) thresholdPct!: number;
}
```

### 6.7 Frontend / Admin

- ❌ KHÔNG code change frontend/admin existing pages (per Scope OUT).
- ❌ KHÔNG dedicated UI cho `discrepancy-check` (per PAUSE-58-05 Option C — finance team dùng Swagger / Postman direct).
- ⚠️ Sau backend deploy: Coder MUST chạy `pnpm generate:api` trong `admin/` để SDK include `discrepancyCheck` function (defensive — finance team có thể request UI sau).

### 6.8 PAUSE flags (BA mới phát hiện)

- ⚠️ **PAUSE-58-07 — field decisive cho effective_from check:** `created_at` vs `payment_on` vs `processed_on`. BA recommend `created_at` (Option BA-A). Danny chốt trước khi Coder implement BR-58-03 SQL.
- ⚠️ **PAUSE-58-08 — Reconciliation aggregate source cho discrepancy-check:** Endpoint gọi `ReconciliationService` method gì để pull aggregate per-tenant-month? Existing service có method bulk hoặc cần extend? Manager `/5bib-plan` clarify.
- ⚠️ **PAUSE-58-09 — Performance fallback strategy:** Nếu benchmark vượt 2× → fallback Option B (PAUSE-58-03) cụ thể: `periodFromCheck = monthEnd` thay vì per-order. BA confirm Danny rule: chấp nhận `~5%` accuracy loss đổi lấy `<1.5×` perf? Hoặc keep Option C + denormalize override map in-memory (Option γ Manager init)?

---

## 🧪 Testing Mandates

### Backend Test Cases — TC-58-XX

#### TC-58-01 — Happy path: tenant không override → output unchanged (regression baseline, PAUSE-58-06 scenario 1)

| Element | Value |
|---------|-------|
| Method | Direct service call `analyticsService._computeOverview('2026-06')` |
| Pre-condition | Tenant 100: `MerchantConfig { service_fee_rate: 5, manual_fee: 5000, event_fee_overrides: [] }`. 10 orders paid trong tháng, total `net_gmv = 100,000,000`. |
| Expected | `platformFee = 5,000,000` (= 100M × 5%) |
| Assert | Exact match với pre-F058 baseline. NO Tier 0 lookup. |
| Side effect | NONE |

#### TC-58-02 — Tier 0 service_fee_rate override applied (PAUSE-58-06 scenario 2)

| Element | Value |
|---------|-------|
| Pre-condition | Tenant 101: default 5%, override race 12345 `service_fee_rate=7%, effective_from='2026-06-01'`. 5 orders paid race 12345 (created 2026-06-15), net_gmv 50M. |
| Method | `feeService.computeFeeForAnalyticsAggregate(101, [12345], {from:'2026-06-01', to:'2026-06-30'})` |
| Expected | `perRaceBreakdown[0].appliedRate = 7`, `serviceFee = 3,500,000` (= 50M × 7%), `feeSource = 'event_override'` |
| MUST NOT | apply 5% (Tier 1) |
| Side effect | NONE |

#### TC-58-03 — Per-order pro-rate theo created_at (BR-58-03/05/16)

| Element | Value |
|---------|-------|
| Pre-condition | Tenant 102: default 5%, override race 200 `service_fee_rate=10%, effective_from='2026-06-15'`. 4 orders: 2 orders created 2026-06-10 (25M each), 2 orders created 2026-06-20 (25M each). Total 100M net_gmv. |
| Method | Same as TC-58-02 |
| Expected | `serviceFee = 50M × 5% + 50M × 10% = 2,500,000 + 5,000,000 = 7,500,000`. `feeSource = 'event_override'` (kept; pro-rate at SQL level). |
| MUST NOT | apply 5% cho all (= 5M flat) OR 10% cho all (= 10M flat) |
| Side effect | NONE |

#### TC-58-04 — Per-field cascade independent (BR-58-02, PAUSE-58-06 scenario 4)

| Element | Value |
|---------|-------|
| Pre-condition | Tenant 103: default `service_fee_rate=5, manual_fee=5000, fee_vat_rate=10`. Override race 300 chỉ set `service_fee_rate=7` (manual_fee + vat null trong override). Orders mix: 10 paid ORDINARY (net_gmv 30M), 5 MANUAL (10 tickets). |
| Expected | service_fee Tier 0: 30M × 7% = 2,100,000. manual_fee Tier 1: 10 × 5000 = 50,000. vat Tier 1: 2.1M × 10% = 210,000. Total fee = 2,360,000. |
| MUST | mixed source — rate Tier 0 BUT manual + vat Tier 1 |

#### TC-58-05 — Override absent → Tier 1 fallback (BR-58-04)

| Pre-condition | Tenant 104: default 5%, override race 400 EXISTS nhưng query race 500 (no override). |
| Expected | Tier 1 applied: 100M × 5% = 5M. `feeSource = 'merchant_default'` |

#### TC-58-06 — Legacy tenant no MerchantConfig → Tier 3 platform default (BR-58-15, PAUSE-58-06 scenario 3)

| Pre-condition | Tenant 105: KHÔNG có MerchantConfig doc trong MongoDB. 1 order net_gmv 10M. |
| Expected | Tier 3: 10M × 5.5% = 550,000. `warnings: ['MerchantConfig + contract feePercentage cả 2 null - dùng default 5.5%']` |
| MUST | Logger warn fire 1 lần |

#### TC-58-07 — Cache flush trigger 7 patterns sau POST override (BR-58-06)

| Method | E2E: POST `/api/merchant/configs/106/event-fee-overrides` body `{raceId:600, service_fee_rate:8, effective_from:'2026-06-01'}` |
| Pre-condition | Redis seed keys: `merchant:fee-overrides:106`, `analytics:overview:2026-06`, `analytics:daily:2026-06::106`, `analytics:top-races:2026-06:::5`, `analytics:rev-by-cat:2026-06::`, `analytics:merchants:2026-06::grossGmv:desc`, `analytics:races:106:600`. |
| Expected status | 201 |
| Side effect verify | All 7 Redis keys DELETED post-mutation. `redis.keys('analytics:*')` returns `[]` for matched patterns. Logger NOT emit warn (success). |

#### TC-58-08 — Cron lock race condition (BR-58-07/14/18)

| Method | Promise.all([cronTick(), postOverride()]) |
| Pre-condition | Mock Redis `set(LOCK_KEY, '1', 'EX', 3300, 'NX')` → first call succeed, second skip. |
| Expected | (1) Cron complete its run normally. (2) POST override fire flush. (3) Subsequent `/analytics/overview` request → cache MISS → rebuild với override applied. |
| MUST NOT | Cron block POST mutation; both fire independently. |

#### TC-58-09 — Discrepancy check MATCH (BR-58-08/17)

| Method | GET `/api/analytics/discrepancy-check?tenantId=107&month=2026-06` |
| Pre-condition | Tenant 107: analytics aggregate `totalFee = 5,000,000`. Reconciliation totals tháng 6 = 5,000,000 (delta = 0). |
| Headers | `Authorization: Bearer <admin_token>` |
| Expected status | 200 |
| Expected body | `{ tenantId:107, month:'2026-06', analyticsAggregate:{totalFee:5000000}, reconciliationAggregate:{totalFee:5000000}, delta:{absVnd:0,pctOfReconciliation:0}, verdict:'MATCH', thresholdAbsVnd:1000, thresholdPct:0.1 }` |
| MUST NOT leak | internal `_id`, MongoDB stack, raw config |
| Idempotent | Run lần 2 same params → same response (no cache, no side effect) |

#### TC-58-10 — Discrepancy MAJOR_DRIFT (verdict trigger)

| Pre-condition | Analytics aggregate = 5M; Reconciliation = 6M (delta = -1M, pct = -16.67%) |
| Expected | `verdict: 'MAJOR_DRIFT'`, `delta: { absVnd: -1000000, pctOfReconciliation: -16.67 }` |

#### TC-58-11 — Discrepancy NO_RECONCILIATION

| Pre-condition | Tenant chưa có Reconciliation doc cho tháng |
| Expected | `verdict: 'NO_RECONCILIATION'`, `delta: null`, `reconciliationAggregate.reconciliationIds: []` |

#### TC-58-12 — Auth 401/403

| TC-12a | GET `/discrepancy-check` không header → 401 |
| TC-12b | GET `/discrepancy-check` với staff (không admin) token → 403 |

#### TC-58-13 — Boundary: `effective_from` inclusive (BR-58-05)

| Pre-condition | Override effective_from='2026-06-15'. Order A created `2026-06-15 00:00:00`, Order B created `2026-06-14 23:59:59`. |
| Expected | Order A áp override; Order B áp default. |

#### TC-58-14 — Performance benchmark assertion (BR-58-11) ⭐ MANDATORY

| Method | k6 / autocannon: 200 sequential req `GET /analytics/overview?month=2026-06`, cache cold start. |
| Pre-condition | DB seeded: 58 tenants × avg 3 races × avg 100 orders = ~17,400 orders. |
| Expected | p95 < 2× baseline. Baseline from current main branch tagged `pre-F058`. |
| Output paste | Coder MUST paste raw benchmark log (p50/p95/p99 before+after) vào `03-coder-implementation.md` section "Performance" |
| Fail action | Nếu p95 > 2× → STOP, escalate PAUSE-58-09 |

#### TC-58-15 — Backward compat regression (no override tenant unchanged) ⭐ CRITICAL

| Method | Compare `_computeOverview('2026-06')` output pre-F058 vs post-F058 cho ALL 58 tenants không có override. |
| Expected | Mỗi `platformFee` per tenant identical (rounding tolerance 1 VND). |
| Side effect | NONE. |

### Frontend E2E (Playwright)

- ❌ KHÔNG E2E mới vì không có UI changes. QC chỉ regression: open existing admin dashboard `/admin/analytics`, verify số `platformFee` displays và không break visually.

### Security Checks

- [ ] `discrepancy-check` endpoint protected `LogtoAdminGuard` — verify 401/403 (TC-58-12).
- [ ] Response KHÔNG leak: MongoDB `_id`, `__v`, internal error stack, MerchantConfig raw, contract internal.
- [ ] No IDOR: admin scope vs tenant scope OK (admin xem all tenant).
- [ ] Input validation: `tenantId` integer positive, `month` regex strict — reject other format.

### Performance SLA (BR-58-11 expanded)

| Endpoint | Pre-F058 p95 (cached) | Post p95 budget |
|----------|----------------------|------------------|
| `/analytics/overview?month=YYYY-MM` | ~250ms | < 500ms |
| `/analytics/top-races?month=YYYY-MM` | ~180ms | < 360ms |
| `/analytics/merchants?month=YYYY-MM` | ~320ms | < 640ms |
| `/analytics/discrepancy-check?tenantId=&month=` | NEW | < 2000ms (uncached, finance ad-hoc) |

Coder run benchmark 10× flaky cho mỗi endpoint, document p95 trong implementation file.

### Coverage target

- Backend unit test: ≥ 8 new + 2 extended (existing merchant.service.f043.spec). Final coverage `analytics.service.ts` ≥ 80%.
- Cron + race condition: TC-58-08 (concurrent Promise.all assertion).

---

## ✅ Answers to Manager's PAUSE Conditions

| PAUSE | Decision | Encoded BR |
|-------|----------|------------|
| **PAUSE-58-01** | ✅ **Option A — Delegate FeeService**. Extend `FeeService.computeFeeForAnalyticsAggregate(tenantId, raceIds, period)`. 1 source of truth cascade. | BR-58-01, 6.2 |
| **PAUSE-58-02** | ✅ **Option A — 3-field cascade** (`service_fee_rate` + `manual_fee_per_ticket` + `fee_vat_rate`) per BR-43-06. Per-field independent. | BR-58-02 |
| **PAUSE-58-03** | ✅ **Option C — Per-order pro-rate** theo `order.created_at >= effective_from`. MANDATORY benchmark < 2× baseline; fail → escalate Danny PAUSE-58-09. | BR-58-03/05/11 |
| **PAUSE-58-04** | ✅ **KHÔNG backfill**. Forward-only. Cache flush post-deploy (manual hook) + TTL natural expire. | BR-58-10 |
| **PAUSE-58-05** | ✅ **Option C — Manual endpoint** `GET /api/analytics/discrepancy-check`. KHÔNG cron alert. Threshold default 1k VND / 0.1%. | BR-58-08/09, 6.6 |
| **PAUSE-58-06** | ✅ **4 test scenarios** confirmed: TC-58-01 (clean) + TC-58-02/03 (override-only-rate) + TC-58-06 (legacy no config Tier 3) + TC-58-04 (multi-field override). Lưu ý BA: scenario 3 "legacy + override" không khả thi (override nested trong MerchantConfig) — đã sửa thành "legacy no config → Tier 3 fallback". | BR-58-15, TC-58-01..06 |

### PAUSE BA mới phát hiện (Manager `/5bib-plan` chốt trước Coder)

| PAUSE BA | Câu hỏi | BA recommend |
|----------|---------|-------------|
| **PAUSE-58-07** | Field decisive cho `effective_from` check: `created_at` vs `payment_on` vs `processed_on`? | `created_at` (Option BA-A) — match business intent "override áp cho order tạo sau date". |
| **PAUSE-58-08** | `ReconciliationService` cần method gì để pull aggregate per-tenant-month cho discrepancy-check? Có method bulk sẵn? | Manager review service — nếu thiếu, extend new helper. |
| **PAUSE-58-09** | Fallback nếu perf > 2×: Option B (month-end check, accept ~5% accuracy loss) vs Option γ (denormalize override map)? | Option B trước (low complexity). Option γ defer F-059. |

---

## 📊 Files Coder cần đụng (impact summary)

| File | Action | LoC delta est |
|------|--------|---------------|
| `backend/src/modules/finance/services/fee.service.ts` | EXTEND new method | +120 |
| `backend/src/modules/finance/dto/analytics-fee-aggregate.dto.ts` | NEW DTO | +60 |
| `backend/src/modules/finance/finance.module.ts` | exports FeeService verify | +1 |
| `backend/src/modules/analytics/analytics.service.ts` | REFACTOR 3 methods, DELETE getFeeConfigs | -50 / +80 |
| `backend/src/modules/analytics/analytics.module.ts` | import FinanceModule | +2 |
| `backend/src/modules/analytics/analytics.controller.ts` | ADD discrepancy-check endpoint | +30 |
| `backend/src/modules/analytics/dto/discrepancy-check.dto.ts` | NEW DTO | +80 |
| `backend/src/modules/merchant/merchant.service.ts:flushEventOverrideCache` | EXTEND 6 patterns flush | +40 |
| `backend/src/modules/analytics/__tests__/analytics.service.f058.spec.ts` | NEW spec | +400 |
| `backend/src/modules/merchant/__tests__/merchant.service.f043.spec.ts` | EXTEND assert 7 patterns | +30 |
| **Total** | | **~790 LoC** |

---

## 📌 Status

**Status:** 🔵 READY

**Next step:** Danny chạy `/5bib-plan FEATURE-058-analytics-cascade-fix` để Manager review PRD + phát hành kế hoạch implementation. Manager MUST chốt 3 PAUSE BA phụ (58-07/08/09) trước khi Coder bắt đầu.
