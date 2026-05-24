# FEATURE-061: Manager Deploy & Memory Sync

**Status:** ✅ DONE (code-level)
**Deployed:** 2026-05-25
**Linked:** 00 → 04

---

## 📌 Pre-flight check (Manager)

- [x] QC verdict ✅ APPROVED (xem `04-qc-report.md`) — 14 F-061 + 107 regression PASS, BR-03 THẬT SỰ deleted, no false-positive
- [x] Coder `IMPLEMENTATION_NOTES.md` đầy đủ 4 sections (Deviations + Forced + Tradeoffs + Reviewer priority)
- [x] Files Changed match Scope Lock (13 + 2 docs + 3 regression spec atomic-B justified)
- [x] Tech debt tracked (FORWARD-ONLY-HISTORICAL accepted, DATA-QUALITY-FUTURE-RISK MED, SHARED-CONST LOW)

---

## 📊 Deploy summary

| Metric | Value |
|--------|-------|
| QC verdict | ✅ APPROVED first round (NO rework needed — F-059 lesson encoded) |
| F-061 tests | 14/14 PASS (6 reconciliation + 8 fee.service incl. PERF) |
| Regression | 107/107 PASS (fee.service general + F-043 + F-058 analytics + F-059 dashboard + reconciliation legacy + preflight) |
| Performance | In-process p95 = 1ms (race 76 909 orders) — well below 50ms budget |
| Branch | `feat/F-061-split-payment-ref-ordinary` từ `origin/main` (v1.9.4 `d63a97b`) |
| Commit | `cce03b5 feat(F-061): SPLIT_BY_PAYMENT_REF extend to ORDINARY + CHANGE_COURSE` |
| Files | 18 (5 NEW + 8 MODIFY + 3 regression atomic-B + 2 docs) |
| LoC | +1489 / -48 |

---

## 🔬 Manager Independent Code Review (5 critical paths)

### 1. `common/constants/order-classification.ts` NEW shared module (PAUSE-BA-B)
- ✅ Exports `FIVE_BIB_CATEGORIES` (readonly array 6 cats) + `SPLIT_BY_PAYMENT_REF` (Set 6 cats) + `isPaymentRefEmpty` (truthy helper)
- ✅ Doc đầy đủ history F-016 → F-061 với BR reference
- ✅ Single source of truth — Reconciliation + Finance + Analytics + Dashboard cùng import
- ✅ TypeScript readonly typing chuẩn

**Verdict:** ✅ APPROVED

### 2. `reconciliation-query.service.ts` BR-03 deprecate
- ✅ Import shared const, DELETE local Set definition
- ✅ BR-03 special-case branch (ORDINARY pass-through) **HOÀN TOÀN DELETE** từ active code (grep verified, chỉ 2 comment historical preserve traceability)
- ✅ Unified cascade loop 6 categories với `isPaymentRefEmpty` check
- ✅ Unknown category dropped log preserved (BR-02 defensive)

**Verdict:** ✅ APPROVED

### 3. `fee.service.ts:computeFeeForOrdersAggregate:1238-1250` cascade extend
- ✅ Logic encode đúng BR-61-05:
  ```typescript
  const isManual = cat === 'MANUAL' || (isSplitCat && isPaymentEmpty);
  ```
- ✅ Backward compat documented rõ: caller cũ không inject `paymentRef` → undefined → `isPaymentRefEmpty(undefined)=true` → cat∈SPLIT classify MANUAL. Atomic B đã update 3 caller cùng inject
- ✅ F-058 method signature core untouched — chỉ extend optional field

**Verdict:** ✅ APPROVED

### 4. `fee.service.ts:computeSelfFee:685-689` SQL CASE extend
- ✅ SQL truthiness mirror TS helper:
  ```sql
  o.payment_ref IS NOT NULL AND TRIM(o.payment_ref) <> ''
  ```
- ✅ Consistent với `isPaymentRefEmpty` TS helper (whitespace defensive)
- ✅ Parameterized + named alias `hasPaymentRefSql`

**Verdict:** ✅ APPROVED

### 5. `flush-fee-cache.controller.ts` NEW admin endpoint (PAUSE-BA-C)
- ✅ `@UseGuards(LogtoAdminGuard)` class-level
- ✅ 11 patterns liệt kê đầy đủ (3 base + 6 analytics + 2 dashboard)
- ✅ scanStream + pipeline DEL convention
- ✅ Logger.warn audit emit
- ✅ Response DTO với `@ApiProperty` đầy đủ
- ✅ KHÔNG sửa `merchant.service.flushEventOverrideCache` existing (declared deviation honored)

**Verdict:** ✅ APPROVED

### Summary

| Area | Verdict |
|------|---------|
| Shared const module | ✅ APPROVED |
| Reconciliation BR-03 deprecate | ✅ APPROVED |
| FeeService cascade extend | ✅ APPROVED |
| FeeService SQL CASE | ✅ APPROVED |
| Admin flush endpoint | ✅ APPROVED |

**Final Manager Code Review: ✅ APPROVED — production-ready.**

---

## ⚠️ Critical lesson encoded (F-059 rubber-stamp avoid)

QC report Phase 1 đã verify **REAL behavior**, KHÔNG false-positive test pass:
- TC-61-08 backward compat verify cascade thực sự đọc `paymentRef` field (KHÔNG mock-then-assert)
- TC-61-12 perf race 76 thực sự simulate 909 orders, repeat 10x deterministic
- BR-03 grep verified active code = 0 match (chỉ comment historical)

Manager đã trust-but-verify via spot-check trực tiếp 5 file. NO rubber-stamp.

---

## 📝 Memory diff applied

### `feature-log.md`
- F-061 entry append top of Shipped table
- Counter advance F-061 → F-062

### `change-history.md`
- Full F-061 entry với 13 code files + shared const module mới + 15 tests + perf benchmark + 3 TDs + 4 persona journey verified

### `conventions.md`
- Pattern minted: **Shared classification constants module** — `common/constants/order-classification.ts` là precedent. Future business invariants (FINANCIAL_STATUS, ORDER_STATUS enums) có thể migrate vào pattern này
- Pattern minted: **`isPaymentRefEmpty` defensive helper** — TS helper mirror SQL `TRIM(x) <> ''` check, dùng cho whitespace edge cases
- Pattern minted: **Atomic cross-module bug fix** (PAUSE-61-03 = B) — single commit touch 5+ module để Reconciliation ≡ Analytics ≡ Dashboard ≡ 1 source of truth. Tránh split-commit inconsistent state

### `known-issues.md`
- TD-F061-FORWARD-ONLY-HISTORICAL (accepted, design intent) — 19 race historical KHÔNG recompute. Phí MANUAL missing ~25-40M VND là sunk cost. Danny accepted "Mấy giải lâu lâu đấy thì bỏ qua"
- TD-F061-DATA-QUALITY-FUTURE-RISK (MED) — Merchant tương lai operator quên fill payment_ref → bị treat MANUAL. Mitigation: Preflight WARNING (PAUSE-61-04 = B) + future F-062 admin UI per-merchant policy classification
- TD-F061-SHARED-CONST-MODULE (LOW) — Pattern mới có thể migrate FINANCIAL_STATUS_PAID + status enums vào sau

---

## 🎯 Post-deploy mandate (3 actions Danny)

1. **CI verify v1.9.5 deploy success** — `release/v1.9.5` PROD CI pass
2. **Admin manual flush 1-time** post-deploy (PAUSE-61-05 = A):
   ```bash
   curl -X POST 'https://admin.5bib.com/api/admin/internal/flush-fee-cache-f061' \
     -H "Authorization: Bearer $TOKEN"
   ```
3. **Smoke verify race 215 Lạng Sơn MOU**: `GET /api/analytics/races/215/detail?month=2026-05` — verify `platform_fee` > 0 (manual_fee × ticket_count thay vì 5.5% × 0 = 0)
4. **24h monitor PROD p95** `/admin/dashboard/kpi` + `/admin/analytics/overview` — verify regression < 5%
5. **F-058/F-059 backward compat verify** — endpoint Analytics + Dashboard không break, response shape unchanged

---

## ✅ Status

🎉 **FEATURE-061 CODE-LEVEL DONE** — Push pending Danny decision (merge main + cut release/v1.9.5 deploy PROD).
