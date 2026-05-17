# FEATURE-040: Finance Real Fee Compute (replace gross GMV)

**Status:** 🟡 INITIATED
**Created:** 2026-05-17
**Owner:** Danny
**Type:** BUGFIX + EXTEND_EXISTING (F-028 BR-PNL-04 semantic correction + cross-domain integration F-016 Reconciliation)
**Created by:** 5bib-manager

---

## 🎯 Why this feature

Hiện tại field **"Doanh thu"** trong P&L Dashboard (F-028) + Contracts List (F-038) + Contract Detail summary hiển thị **gross GMV** (`SUM(order.total_price)`) cho TICKET_SALES contracts — **sai bản chất nghiệp vụ tài chính**.

Doanh thu 5BIB thực = **fee 5BIB thu được**, KHÔNG phải tổng tiền khách hàng pay merchant. Repro contract `6a095d81e7c717e8fc1c2da1` (race 194 SC Marathon Di sản Hà Nội 2026): UI hiện **18,284,000** (gross GMV của 34 đơn ORDINARY) thay vì fee thật **~1,279,880** (7% × GMV theo `revenueShare.feePercentage`).

Danny request 2026-05-17: chuyển compute logic sang **fee thật**, với 2 source priority:

1. **Reconciliation actual** (BBNT đối soát đã ký, từ tháng 5/2026 mới có)
2. **Self-compute từ MerchantConfig rate** (fallback cho race trước tháng 5 + race chưa có recon)

Đây là blocker để Danny có bức tranh tài chính tổng thể đáng tin cho 58 merchant + 195 races.

---

## ⚠️ Numbering conflict note (housekeeping)

Memory counter trước đó nói "Next FEATURE-XXX: FEATURE-040". Hôm nay 2026-05-17 đã có 2 hot-fix commits sử dụng số:
- Commit `8c4c33d` label `fix(F-039): checkpoint discovery...` → **CONFLICT** với existing in-flight `FEATURE-039-analytics-per-event-per-day` (INITIATED 2026-05-15). Checkpoint fix thực ra là hot-fix patch ≤150 dòng, KHÔNG nên có F-number.
- Commit `cd15fcd` `fix(contracts): race-picker...` — KHÔNG label F-number trong git (tao chỉ nói "F-040" trong chat), nên KHÔNG conflict git side.

**Decision:** Feature MỚI này nhận **F-040** theo counter. Sẽ note vào `known-issues.md` về numbering conflict commit `8c4c33d`. Sau ship F-040, counter advance to F-041.

---

## 📂 Impact Map (theo memory + spot-check code thật 2026-05-17)

### Module sẽ chạm

**Backend:**
- `backend/src/modules/finance/services/fee.service.ts` — **core rewrite** `getActualRevenueForRace()` (line 203) + bulk `getActualRevenueForRaces()` (line 305). Đổi từ `SUM(order.total_price)` → `SUM(order_fee_amount)` per category formula.
- `backend/src/modules/finance/services/pnl.service.ts` — semantic update `resolveRevenue()` + `resolveRevenueSync()` (line 108, 140). Revenue → fee 5BIB. Có thể thêm `grossGMV` field song song cho display dual.
- `backend/src/modules/reconciliation/services/reconciliation-query.service.ts` — **NEW method** `getReconciledFeeForContract(raceId, tenantId, periodFrom, periodTo)` query MongoDB `reconciliations` collection theo (mysql_race_id, tenant_id, period overlap). Return `{ fee_amount, manual_fee_amount, source: 'reconciliation' }` hoặc null.
- `backend/src/modules/finance/dto/pnl-response.dto.ts` — extend `DashboardContractItemDto` với optional fields: `feeSource: 'RECONCILIATION' | 'SELF_COMPUTE' | 'ESTIMATED'`, `grossGMV?: number` (transparency)
- Cross-module DI: FinanceModule cần import ReconciliationModule (hoặc inject MerchantConfig+Reconciliation models trực tiếp)

**Admin (read-only consume — backend changes propagate):**
- `admin/src/app/(dashboard)/finance/contracts/_components/contracts-list-table.tsx` — column "Doanh thu" semantic đổi. Có thể add tooltip + source badge ("BBNT" / "Tự tính" / "Ước tính") + optional GMV in detail.
- `admin/src/app/(dashboard)/finance/_components/dashboard-client.tsx` — same semantic update + KPI labels.
- `admin/src/app/(dashboard)/contracts/[id]/page.tsx` (Contract Detail Lãi/Lỗ section) — show fee source attribution.

### File then chốt cần Coder đọc trước khi code

- `backend/src/modules/finance/services/fee.service.ts:14-48` — class header comment giải thích "5BIB-share GMV trừ MANUAL" + FIVE_BIB_CATEGORIES const. Cần update header comment để phản ánh semantic mới.
- `backend/src/modules/finance/services/fee.service.ts:200-298` — current `getActualRevenueForRace()` SQL pattern + Redis cache key `pnl:ticket-sales-fee:<contractId>`. Coder rewrite SQL: cần SUM theo formula (% × total_price cho 5BIB categories + VNĐ/vé × quantity cho MANUAL).
- `backend/src/modules/finance/services/fee.service.ts:300-410` — bulk variant `getActualRevenueForRaces()` chunked F-029 HIGH-PERF-01 pattern. Cần preserve bulk + N+1-free khi compute fee thay revenue.
- `backend/src/modules/finance/services/pnl.service.ts:100-170` — `resolveRevenueSync()` + `resolveRevenue()` semantic. Sau update, revenue field = fee thật, `source: 'RECONCILIATION' | 'SELF_COMPUTE' | 'ESTIMATED'`.
- `backend/src/modules/finance/services/pnl.service.ts:417-441` — `getDashboardData()` bulk pre-fetch path (F-029 HIGH-PERF-01). Cần thêm bulk pre-fetch reconciliation data song song với revenue prefetch.
- `backend/src/modules/merchant/schemas/merchant-config.schema.ts` — **MongoDB collection `merchant_configs`** (KHÔNG phải MySQL Tenant entity per CLAUDE.md ghi nhầm). Fields: `service_fee_rate` (% cho 5BIB categories), `manual_fee_per_ticket` (VNĐ/vé cho MANUAL), `fee_vat_rate`, `fee_effective_date`. Keyed bằng `tenantId`. → Source of truth cho self-compute.
- `backend/src/modules/reconciliation/schemas/reconciliation.schema.ts:62-114` — Reconciliation document fields: `tenant_id`, `mysql_race_id`, `period_start`, `period_end`, `fee_rate_applied`, `manual_fee_per_ticket` (snapshot), `gross_revenue`, `fee_amount`, `manual_fee_amount`, `fee_vat_amount`. → Source of truth cho recon override.
- `backend/src/modules/reconciliation/services/reconciliation.service.ts:65-110` — pattern current dùng `config?.service_fee_rate ?? 5.5` default. Reuse helper pattern.
- `backend/src/modules/reconciliation/services/reconciliation-calc.service.ts` — existing compute logic per recon (5BIB orders fee + MANUAL orders fee). Có thể extract shared util cho self-compute path.
- `backend/src/modules/finance/services/fee.service.spec.ts` (~18KB existing) — extend với fee compute test scenarios cho 5BIB + MANUAL categories.
- `backend/src/modules/finance/services/pnl.service.spec.ts` (~30KB existing) — extend với recon-override scenarios.

### Endpoint liên quan

**KHÔNG breaking change** — additive semantic update:
- `GET /api/finance/dashboard` (F-028) — response unchanged shape, `revenue` field semantic đổi gross GMV → fee thật
- `GET /api/finance/pnl/contracts` (F-038) — same
- `GET /api/finance/contracts/:id/pnl` (F-028 detail) — same
- (Optional new) `GET /api/finance/contracts/:id/fee-breakdown` — endpoint phụ trả về breakdown chi tiết (5BIB orders count + fee + MANUAL orders count + fee + recon source) cho admin debug

### Schema/DB

- **MongoDB**: KHÔNG đổi schema. Query thêm `merchant_configs` (existing) + `reconciliations` (existing).
- **MySQL platform**: KHÔNG đổi schema. SQL query refactor:
  - **CURRENT** (Phase 1): `SELECT SUM(o.total_price) FROM order_metadata o WHERE o.internal_status='COMPLETE' AND o.order_category IN (5BIB) AND o.id IN (subquery race=X)`
  - **NEW** (Phase 2): cần TWO queries OR ONE query với CASE:
    ```sql
    SELECT
      SUM(CASE WHEN o.order_category != 'MANUAL'
               THEN o.total_price * (:service_fee_rate / 100)
               ELSE 0 END) AS fee_5bib_pct,
      SUM(CASE WHEN o.order_category = 'MANUAL'
               THEN (SELECT SUM(oli.quantity) FROM order_line_item oli WHERE oli.order_id = o.id) * :manual_fee_per_ticket
               ELSE 0 END) AS fee_manual
    FROM order_metadata o WHERE ...
    ```
    Hoặc 2 query rạch ròi (1 cho 5BIB %, 1 cho MANUAL VNĐ/vé). Coder quyết tùy benchmark.
- **Redis**: 
  - REUSE key `pnl:ticket-sales-fee:<contractId>` (existing) — đổi semantic value (fee thay revenue). TTL 5min hiện tại có thể tăng lên 60min vì rate ít đổi (PAUSE-40-05).
  - NEW invalidation hook: khi merchant config rate đổi (MerchantService.updateFeeConfig) → DEL `pnl:ticket-sales-fee:*:tenant=<id>` (cần expand cache key để include tenant).
  - NEW invalidation hook: khi reconciliation create/update/sign (ReconciliationService mutations) → DEL `pnl:ticket-sales-fee:*` matching race+tenant.

---

## ⚠️ Risk Flags

> Cross-reference với `known-issues.md`:
> - 🟡 Tech debt "analytics/reconciliation fee rate inconsistency" (testcases_reconciliation memory): vấn đề này CHÍNH XÁC là nguyên do của F-040.
> - 🟡 Tech debt "parsePeriod timezone bug F-003 + triggerByIds 500 F-004 + reviewed_by never set" — reconciliation service có sẵn bug. Tránh đụng vào compute path nếu không cần.

- 🔴 **HIGH financial accuracy** — Đây là feature semantic-changing. Bug ở đây = số tài chính sai báo cáo cho 58 merchant + 195 races. Test scenarios phải cover happy/edge/null-config/missing-recon paths chặt chẽ. Manager YÊU CẦU 100% BR coverage trước APPROVE plan.
- 🔴 **HIGH semantic shift** — Field `revenue` đang được dùng làm GMV → đổi sang fee thật. Nếu admin nào đang export Excel từ F-028 dashboard và compare với MySQL platform query trực tiếp → number mismatch. CẦN add `grossGMV` parallel field + tooltip "Đã đổi cách tính từ FEATURE-040, xem source badge" để minimize confusion.
- 🟡 **MED cross-DB perf** — Compute fee per contract cần JOIN order × line_item (cho MANUAL ticket_quantity) + merchant_config lookup + reconciliation lookup. F-029 HIGH-PERF-01 bulk pattern PHẢI áp dụng cho dashboard batch (N+1 = death).
- 🟡 **MED reconciliation cross-domain** — Lần đầu FinanceModule import từ ReconciliationModule. Cần avoid circular dependency. Đề xuất: extract `MerchantConfig` + `Reconciliation` model providers ra shared `merchant.module.ts` đã có, FinanceModule import shared models trực tiếp (KHÔNG import ReconciliationService).
- 🟡 **MED cache invalidation** — Mutation merchant config rate (admin) HOẶC reconciliation sign (admin) PHẢI invalidate `pnl:ticket-sales-fee:*` keys. Thiếu = stale fee hiển thị sai cho tới TTL expire. Coder phải grep all mutation sites của MerchantService + ReconciliationService → add flush hook.
- 🟢 **LOW migration** — Additive logic, KHÔNG cần DB schema change. Race trước tháng 5 / contract chưa link tenantId → graceful fallback estimatedFee.
- 🟢 **LOW UI** — Admin frontend chỉ tooltip + source badge thêm. Backend output shape unchanged (chỉ semantic).

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

> Manager liệt kê 7 câu hỏi nghiệp vụ chưa rõ. BA phải trả lời TỪNG cái trong `01-ba-prd.md` section "Answers to Manager's PAUSE conditions".

- [ ] **PAUSE-40-01 (Race trước tháng 5/2026 — pre-recon era):**
   Race không có reconciliation record → self-compute từ MerchantConfig rate là default? Hay show warning "Estimated — chưa có BBNT" tag để admin biết số chưa final?
   **Manager đề xuất:** Self-compute = default, attach `feeSource: 'SELF_COMPUTE'` field. UI hiện badge "🧮 Tự tính" subtle nếu admin care. KHÔNG block hoặc warning intrusive.

- [ ] **PAUSE-40-02 (Race có recon partial period):**
   Vd contract period = [2026-01-01, 2026-06-30] nhưng recon chỉ có cho [2026-05-01, 2026-05-31] (1 tháng). Cách tính cho period [2026-01-01, 2026-04-30] (pre-recon) + [2026-06-01, 2026-06-30] (chưa recon)?
   **Manager đề xuất:** Split-compute: dùng recon `fee_amount + manual_fee_amount` cho [period_start, period_end] của mỗi recon doc match → SUM. Phần còn lại (gap months) → self-compute. Final fee = SUM(recon parts) + SUM(self-compute parts). `feeSource: 'MIXED'` nếu cả 2 source góp.

- [ ] **PAUSE-40-03 (Mixed-category race ORDINARY + MANUAL):**
   Race có cả đơn ORDINARY (% fee) lẫn MANUAL (VNĐ/vé). Tính theo từng category rồi sum?
   **Manager đề xuất:** YES — fee = (5BIB-category orders × service_fee_rate%) + (MANUAL orders × manual_fee_per_ticket VNĐ × ticket_quantity). Apply per category, sum total.

- [ ] **PAUSE-40-04 (Edge case — MerchantConfig rate null/0):**
   Tenant chưa có `merchant_configs` doc OR `service_fee_rate = null` (lưu là chưa duyệt) → tính fee thế nào?
   **Manager đề xuất:** Fallback cascade:
   1. `merchant_config.service_fee_rate` (primary)
   2. `contract.revenueShare.feePercentage` (BTC nhập trong contract — secondary)
   3. Hardcoded default `5.5%` (per reconciliation.service.ts:406 existing fallback) — tertiary với warning log
   Manual fee fallback: `5000 VNĐ/vé` (per merchant-config schema default).

- [ ] **PAUSE-40-05 (Cache TTL strategy):**
   Hiện key `pnl:ticket-sales-fee:<contractId>` TTL 5min. Sau khi compute thành fee thật (ít đổi hơn GMV vì merchant rate stable, recon BBNT immutable sau sign):
   - Giữ TTL 5min cho responsive (race day mutation tick).
   - HOẶC tăng lên 60min (rate ít đổi) — phụ thuộc invalidation hooks chặt chẽ.
   **Manager đề xuất:** TTL 60 phút (vì source data ít đổi) + EAGER invalidation hooks 2 trigger:
   - Merchant config update → DEL pattern `pnl:ticket-sales-fee:*` (broad)
   - Reconciliation status change (draft → approved → signed) → DEL pattern matching `tenant_id + mysql_race_id`

- [ ] **PAUSE-40-06 (UI display — dual columns or single semantic shift?):**
   - **Option A:** Single column "Doanh thu" semantic đổi gross → fee. Thêm tooltip + source badge.
   - **Option B:** Add separate column "GMV" (gross) + "Phí 5BIB" (fee thật). Admin thấy cả 2 cho transparent comparison.
   - **Option C:** Single column "Doanh thu" = fee, expose `grossGMV` trong row drill-down expand only.
   **Manager đề xuất:** Option C — keep list clean, drill-down detail page show full breakdown. Reduces visual noise + reduces migration confusion vì column name "Doanh thu" KHÔNG đổi (semantic đổi, không phải columns đổi).

- [ ] **PAUSE-40-07 (Migration cho F-038 cached data + F-028 dashboard):**
   Sau deploy F-040, Redis có thể có cached values từ F-028+F-038 (gross GMV). Strategy?
   - **Eager flush** all `pnl:ticket-sales-fee:*` + `pnl:dashboard:*` + `pnl:contracts-list:*` sau deploy → forced fresh compute trên hit đầu tiên.
   - **Lazy flush** TTL natural expire (5min cũ) → 5 phút stale value tới admin first hour.
   **Manager đề xuất:** EAGER flush trong post-deploy script (manual command) HOẶC trong service startup hook detect F-040 first-deploy marker. Add to `05-manager-deploy.md` checklist.

---

## 🎯 Success criteria (gợi ý cho BA cụ thể hóa thành BR)

- TICKET_SALES contract `6a095d81e7c717e8fc1c2da1` UI hiện **~1,279,880 VND** (fee thật) thay vì 18,284,000 (gross GMV). Source badge: 🧮 "Tự tính" (vì pre-recon era).
- TICKET_SALES contract có recon đã sign (May 2026) → UI hiện `recon.fee_amount + recon.manual_fee_amount`. Source badge: ✅ "BBNT".
- Mixed-period contract → UI hiện SUM(recon parts) + SUM(self-compute parts). Source badge: 🔀 "Kết hợp" (Mixed).
- Performance: Dashboard 100 contracts compute < 800ms p95 (preserve F-029 SLA). Detail per-contract < 400ms p95.
- Cache hit ratio sau 60 phút operation > 80% (per PAUSE-40-05 TTL 60min strategy).
- Regression: existing F-028 dashboard + F-038 list + F-016 reconciliation tests vẫn 100% PASS sau refactor.
- Tooltip + source badge present trên UI: admin có thể identify source mọi row.

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] **Yes** — Manager đã verify codebase structure + memory checked + 7 PAUSE conditions liệt kê đầy đủ. BA proceed với context complete.
- 📝 **Note for BA:** PRD MUST include structured tables MANDATORY (per Manager 2026-05-14 directive): UI Step-by-step / Buttons spec / Form Fields / Endpoint spec / DTO field-level TypeScript / TC-XX backend test cases / Frontend E2E Playwright. Manager sẽ REJECT plan nếu PRD thiếu structured tables.

---

## 🔗 Next step

Danny chạy: `/5bib-prd FEATURE-040-finance-real-fee-compute`

BA agent (5bib-po-ba) sẽ:
1. Đọc file này + memory codebase-map + known-issues vùng finance/reconciliation/merchant
2. Output `01-ba-prd.md` với structured tables + 7 PAUSE-40-* answers + 11+ BR-40-XX (status whitelist, period overlap algo, fee fallback cascade, source badge enum, cache strategy, etc.)
3. Estimate 14+ unit tests (fee compute 5BIB %, fee compute MANUAL VNĐ/vé, recon override, mixed period split-compute, null config fallback) + 8+ E2E
