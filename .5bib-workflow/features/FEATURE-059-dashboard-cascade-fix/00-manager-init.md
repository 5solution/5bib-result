# FEATURE-059: Dashboard Cascade Fee Integration (Hardcode 5.5% → FeeService delegation)

**Status:** 🟡 INITIATED
**Created:** 2026-05-22
**Owner:** Danny
**Type:** BUGFIX (financial discrepancy Dashboard ≠ Analytics ≠ Reconciliation)
**Severity:** 🔴 P0 — admin homepage Dashboard hiển thị PHÍ 5BIB SAI ~11%

---

## 🎯 Why this feature

Audit 2026-05-22 post F-058 deployment (Danny phát hiện): **Dashboard "Tổng quan" admin homepage vs Analytics Dashboard hiển thị 2 số khác nhau cho cùng tháng 2026-05:**

| Page | GMV | PHÍ 5BIB | Effective rate | Verdict |
|------|-----|----------|----------------|---------|
| `/dashboard` (Tổng quan) | 515.126.000đ | **28.331.930đ** | 5.5% flat (hardcode) | 🔴 SAI |
| `/analytics` (Analytics Dashboard) | 514.540.000đ | **31.739.002đ** | ~6.17% cascade-aware | ✅ ĐÚNG |

→ Δ PHÍ 5BIB = **3.407.072đ (~11%)** — Dashboard hiển thị thấp hơn thực tế ~3.4M/tháng.

### Root cause

```typescript
// backend/src/modules/dashboard/services/kpi.service.ts:108
const platformFee = Math.round(net * 0.055);  // 🔴 HARDCODE 5.5%

// backend/src/modules/dashboard/services/sparkline.service.ts:123
feePoints.push({ date, value: Math.round(v.net * 0.055) });  // 🔴 SAME bug
```

Dashboard tính phí = `net × 5.5%` flat, KHÔNG cascade:
- ❌ Per-tenant `service_fee_rate` (F-040 Tier 1 — tenants ≠ 5.5%)
- ❌ Per-race `event_fee_overrides[]` (F-043 Tier 0)
- ❌ MANUAL orders dùng `manual_fee_per_ticket` VND/vé (Dashboard hiện exclude MANUAL trong GMV — đúng spec nhưng vẫn miss fee)

→ Cùng pattern bug F-058 (Analytics chưa cascade), nhưng ở Dashboard module. F-058 đã ship FeeService.computeFeeForOrdersAggregate() làm 1 source of truth — F-059 reuse method này cho Dashboard.

---

## 📂 Impact Map

### Backend (3 service modify + module DI + tests)

- ✏️ `backend/src/modules/dashboard/services/kpi.service.ts` — refactor `aggregate()` từ inline SQL + 5.5% hardcode → delegate `feeService.computeFeeForOrdersAggregate()` per-tenant per-period
- ✏️ `backend/src/modules/dashboard/services/sparkline.service.ts` — refactor daily aggregate loop tương tự, per-tenant fee compute per day
- ✏️ `backend/src/modules/dashboard/services/dashboard-aggregator.cron.ts` — verify cron warm cache không serve stale (pattern F-058 PAUSE-Coder-02)
- ✏️ `backend/src/modules/dashboard/dashboard.module.ts` — import FinanceModule (export FeeService) cho DI
- ✏️ `backend/src/modules/merchant/merchant.service.ts` — extend `flushEventOverrideCache()` thêm 3 dashboard pattern flush: `dashboard:kpi:*`, `dashboard:sparkline:*`, `dashboard:cron-lock:*` (đã có lock pattern existing)

### Tests
- ➕ NEW `backend/src/modules/dashboard/services/kpi.service.f059.spec.ts` — 6-8 tests cover 4 tenant scenarios + cascade
- ➕ NEW `backend/src/modules/dashboard/services/sparkline.service.f059.spec.ts` — 4-6 tests cover daily aggregate cascade per tenant
- ✏️ EXTEND existing kpi.service.spec / sparkline.service.spec — regression baseline (tenant no override → number unchanged vs pre-F-059)

### File then chốt cần đọc

- `backend/src/modules/dashboard/services/kpi.service.ts` (~110 LoC)
- `backend/src/modules/dashboard/services/sparkline.service.ts` (~150 LoC)
- `backend/src/modules/dashboard/services/dashboard-aggregator.cron.ts` (cron pattern reference)
- `backend/src/modules/dashboard/dashboard.module.ts` (DI graph)
- `backend/src/modules/finance/services/fee.service.ts:1000-1150` — `computeFeeForOrdersAggregate()` method (F-058 reference, REUSE)
- `backend/src/modules/finance/dto/fee-aggregate.dto.ts` (F-058 DTO reuse)
- `backend/src/modules/analytics/analytics.service.ts:170-230` — F-058 SQL query pattern (đã verify `om.payment_on` hotfix v1.9.2)

### Endpoint affected (2 endpoint)

Tất cả `/api/dashboard/*` endpoint touch platform fee:
- `GET /dashboard/kpi` — MTD aggregate per period (current + prev)
- `GET /dashboard/sparklines` — 30-day daily series per metric

5 endpoint khác KHÔNG touch fee → skip (live-races, upcoming-races, pending-tasks, recent-activity, system-status).

### Schema/DB

- **MongoDB:** KHÔNG đụng
- **MySQL platform:** KHÔNG đụng (chỉ thay SELECT field từ inline sum → return rows + delegate FeeService)
- **Redis:** Cache invalidate mở rộng:
  - F-058 hiện flush 9 patterns (3 base + 6 analytics)
  - **F-059 THÊM:** `dashboard:kpi:*`, `dashboard:sparkline:*` (2 patterns mới)

---

## ⚠️ Risk Flags

- 🟡 **MED — Performance regression** Dashboard KPI + Sparkline gọi mỗi page-load admin home. Hiện 1 SQL aggregate flat (no FeeService overhead). Sau F-059: per-tenant FeeService call. **MANDATORY perf benchmark** — p95 < 2× baseline. Sparkline 30-day × N tenant có thể cost cao hơn KPI MTD
- 🟡 **MED — Cron warm cache 1h race condition** giống F-058 — override mutation flush dashboard keys, cron có thể overwrite stale. Mitigate Option γ F-058 pattern (cron re-fetch override AFTER query)
- 🟢 **LOW — Response shape backward compat** — `kpis[].current` + `kpis[].previous` shape unchanged. Số bên trong đúng cascade
- 🟢 **LOW — F-058 untouched** — FeeService.computeFeeForOrdersAggregate() existing, F-059 chỉ CALL method (zero modification)
- 🟢 **LOW — MANUAL category** — Dashboard hiện exclude MANUAL trong GMV (đúng spec). F-059 follow same exclusion để response shape match

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

### PAUSE-59-01 — Per-order pro-rate vs simpler approximation

F-058 Analytics dùng per-order pro-rate (each order's `payment_on >= override.effective_from` → áp override). Dashboard có 2 option:

- **Option A** — Per-order pro-rate (giống F-058) — chính xác max
- **Option B** — Per-tenant average rate per period — Dashboard tính fee = `sum(gmv × tenant_effective_rate)` per tenant, rate = average của period (đơn giản hơn, sai ~0.5% nếu period dài)

Manager đề xuất **Option A** — consistent với F-058 + reuse method existing. Đảm bảo Dashboard ≡ Analytics ≡ Reconciliation chính xác.

### PAUSE-59-02 — MANUAL orders fee handling

Dashboard hiện exclude MANUAL trong `GMV/Net` calculation (`WHERE order_category != 'MANUAL'`). Câu hỏi: fee MANUAL có include không?

- **Option A** — Exclude MANUAL trong cả fee (consistent với GMV display) — Phí 5BIB chỉ tính cho ORDINARY/GROUP_BUY
- **Option B** — Include MANUAL fee dùng `manual_fee_per_ticket` × ticket_count (đúng business — MANUAL cũng phải tính phí 5BIB)
- **Option C** — Hiển thị riêng 2 dòng "Phí 5BIB (online)" + "Phí 5BIB (MANUAL)" — không gộp

Manager đề xuất **Option B** — đúng business invariant CLAUDE.md ("MANUAL order: phí = ticket_quantity × manual_fee_per_ticket"). Dashboard hiện sai vì exclude MANUAL fee.

### PAUSE-59-03 — Sparkline cache TTL

Sparkline 30-day per metric, gọi mỗi page-load admin. Cron warm cache mỗi giờ (`EVERY_HOUR`). Câu hỏi:

- **Option A** — Giữ cron 1h (existing pattern) + override mutation flush key
- **Option B** — Giảm cron xuống 15min (real-time hơn cho admin) — cost cao
- **Option C** — Sparkline KHÔNG cache, query realtime mỗi page-load — UI sluggish

Manager đề xuất **Option A** — minimal change, cron 1h đủ cho admin homepage (không phải real-time finance).

### PAUSE-59-04 — Discrepancy alert mechanism

F-058 đã add admin endpoint `/api/analytics/discrepancy-check` so sánh Analytics vs Reconciliation. F-059 có cần thêm Dashboard vào discrepancy check không?

- **Option A** — Extend `/discrepancy-check` thành 3-way: Dashboard vs Analytics vs Reconciliation. Verdict per pair
- **Option B** — Skip — sau F-059 Dashboard = Analytics theo design (cùng FeeService source), KHÔNG cần check
- **Option C** — Thêm separate endpoint `/api/dashboard/discrepancy-check`

Manager đề xuất **Option B** — sau F-059 Dashboard ≡ Analytics theo design. Discrepancy check cho 2 source khác (Analytics vs Reconciliation) đủ.

### PAUSE-59-05 — Backfill historical sparkline data

Sparkline 30-day series hiện cache với hardcode 5.5%. Sau F-059 deploy, sparkline cũ vẫn 5.5%. Câu hỏi:

- **Option A** — KHÔNG backfill — đợi cron next tick refresh tự nhiên (max 1h delay)
- **Option B** — Trigger force refresh ngay sau deploy (admin click "Refresh Dashboard" hoặc cron run manual)
- **Option C** — Auto-trigger cache flush trong deploy script

Manager đề xuất **Option B** — admin chủ động trigger sau deploy. Hoặc đơn giản, sau deploy v1.9.x, Redis cache dashboard tự expire trong 1h → đúng tự nhiên.

### PAUSE-59-06 — Test data scope

Test fixture cho F-059:
- Tenant 1: 5.5% default no override → Dashboard = Analytics (regression baseline, số KHÔNG đổi vì equivalent)
- Tenant 2: 7% override race A → Dashboard fee > 5.5% × net (vì có override)
- Tenant 3: MANUAL orders với manual_fee 5000đ × 100 vé = 500.000đ fee → verify include hay exclude per PAUSE-59-02
- Tenant 4: Mix ORDINARY 6% + MANUAL 5000đ → fee aggregate đúng

Confirm test scope đủ?

---

## ✅ Sẵn sàng cho `/5bib-prd`

**Manager verdict:** ✅ READY — feature scope rõ, bug confirmed bằng curl PROD + grep code, 6 PAUSE locked.

### 📌 Danny answers 2026-05-22

| # | Quyết định | Implication |
|---|------------|-------------|
| **PAUSE-59-01** | ✅ **A — Per-order pro-rate** | Reuse `FeeService.computeFeeForOrdersAggregate()` từ F-058 (zero modification) |
| **PAUSE-59-02** | ✅ **B — Include MANUAL fee** | Dashboard SQL refactor: KHÔNG filter `order_category != 'MANUAL'` cho fee compute (GMV display vẫn exclude MANUAL UX). Fee aggregate include MANUAL → dùng `manual_fee_per_ticket × ticket_count` per CLAUDE.md business invariant |
| **PAUSE-59-03** | ✅ **A — Cron 1h existing** | KHÔNG sửa cron interval, chỉ extend warm cache để dùng FeeService delegation |
| **PAUSE-59-04** | ✅ **B — Skip discrepancy 3-way** | Sau F-059 Dashboard ≡ Analytics by design. F-058 `/discrepancy-check` Analytics vs Reconciliation đủ |
| **PAUSE-59-05** | ✅ **B — Admin manual trigger** | Post-deploy admin chủ động hoặc đợi cron 1h auto-refresh |
| **PAUSE-59-06** | ✅ **YES test scope đủ** | 4 scenarios confirmed (no override / override / MANUAL only / mix) |

### ⚠️ Critical implication PAUSE-59-02 = B

Dashboard hiện **EXCLUDE MANUAL** trong GMV calculation (`WHERE order_category != 'MANUAL'`). Sau F-059:
- **GMV display:** GIỮ exclude MANUAL (UX hiện tại — MANUAL orders không phải doanh thu online qua platform)
- **Platform fee:** **INCLUDE MANUAL fee** = `manual_fee_per_ticket × ticket_count` per merchant cascade
- Implication: Phí 5BIB có thể > GMV × 5.5% (vì có thêm MANUAL fee VND-based)
- → Dashboard hiện SAI 2 lớp: (1) hardcode 5.5% no cascade + (2) exclude MANUAL fee

**Next step:** BA chạy `/5bib-prd FEATURE-059-dashboard-cascade-fix` viết PRD đầy đủ.

---

## 📋 Scope ngoài tầm (out of scope)

- ❌ Frontend admin Dashboard UI changes — backend fix đủ (response shape unchanged)
- ❌ Dashboard 5 endpoint khác (live-races, upcoming-races, pending-tasks, recent-activity, system-status) — KHÔNG touch fee
- ❌ Rename F-040 vs F-043 `feeSource` collision — defer (refactor riêng)
- ❌ Sparkline UI redesign / metric thêm
- ❌ MongoDB/MySQL schema migration
- ❌ Backfill historical analytics data (Danny chốt KHÔNG ở F-058, same nguyên tắc)

---

## 📊 Estimated effort

| Layer | Files | Days |
|-------|-------|------|
| Dashboard kpi.service refactor | 1 modify | 1 |
| Dashboard sparkline.service refactor | 1 modify | 1 |
| Dashboard module DI + cache flush | 2 modify (module + merchant.service) | 0.5 |
| Unit tests | 2 spec file NEW (10-14 tests) | 1 |
| Performance benchmark | Manual + paste output | 0.5 |
| QC E2E + regression | — | 1.5 |
| **Total dev + QC** | | **~5-6 ngày** |

Sprint estimate: **~1 tuần** end-to-end (dev + QC + deploy).
