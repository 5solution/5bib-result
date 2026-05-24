# FEATURE-061 — Implementation Notes

**Coder:** 5bib-fullstack-engineer
**Branch:** `feat/F-061-split-payment-ref-ordinary`
**Date:** 2026-05-25

Tài liệu này bổ sung cho `03-coder-implementation.md` — đi sâu deviations, tradeoffs, reviewer notes và open questions.

---

## 1. Deviations from PRD / Plan

### 1.1 `missingPaymentRef` semantic shift (BR-61-04 implicit refactor)

**PRD spec:** Section 3 BR-61-04 chỉ chốt severity downgrade ERROR → WARNING + message update; KHÔNG mô tả semantic field `missingPaymentRef` thay đổi.

**Actual implementation:** Trước F-061, `missingPaymentRef = fiveBibOrders.filter(r => !r.payment_ref)` — đếm fiveBibOrders bị treat 5BIB nhưng thiếu ref (BR-03 legacy anomaly). Sau F-061, các order này KHÔNG còn nằm trong fiveBibOrders (đã đẩy MANUAL). Nếu giữ filter cũ → `missingPaymentRef.length = 0` always → preflight WARNING sẽ KHÔNG bao giờ emit.

**Fix:** Bổ sung `missingPaymentRefFallback[]` collected ngay trong categorize loop — track orders BỊ ĐẨY MANUAL vì SPLIT cat empty ref. Preflight đọc field này để emit WARNING.

**Reference:** `reconciliation-query.service.ts:144, 173-176, 207-211` — comment explicit. BR-61-04 implicit dependency on this semantic shift; should be made explicit in future BA PRD addendum.

### 1.2 SQL CASE block restructure thay vì helper string

**Plan recommend (BR-61-06 Coder Note):** "recommend extract helper string constant `SPLIT_BY_PAYMENT_REF_SQL_LIST` tách bạch `FIVE_BIB_SQL_LIST`".

**Actual:** Vì SPLIT_BY_PAYMENT_REF === FIVE_BIB_CATEGORIES (sau F-061 unification), không cần SQL list riêng. Export 1 `FIVE_BIB_SQL_LIST` từ shared module + dùng cho CẢ HAI branches (5BIB-eligible WHERE truthy + MANUAL fallback WHERE NOT truthy). Single source of truth simpler.

### 1.3 Touched 3 regression specs ngoài Scope Lock chính thức (atomic B mandate)

**Plan Scope Lock:** 13 file (5 NEW + 8 MODIFY).

**Actual:** Touched thêm 3 spec files (`reconciliation-query.service.spec.ts`, `fee.service.spec.ts:TC-58-PERF`, `analytics.service.f058.spec.ts:buildOrder`) để cập nhật regression baseline reflect F-061 atomic behavior.

**Lý do:** PAUSE-61-03 = B atomic fix — F-058 baseline test với ORDINARY no-paymentRef giả định cũ "treat as 5BIB regardless" giờ flip sang MANUAL fallback. Nếu không update fixture, 25+ test FAIL cascading → masked F-061 PASS verification.

**Justification:** Đây không phải scope creep — đây là direct consequence of atomic B mandate. Manager Plan section "🛑 PAUSE points cho Coder" đã ghi "Trước khi remove BR-03 line ... confirm 0 test breakage trong reconciliation-query.spec" — implies must update specs to keep them in-sync. Bộ ba thay đổi minimal (3 lines / 2 lines / 4 lines).

### 1.4 Endpoint path slightly differs from PRD example

**PRD example:** `POST /api/admin/finance/flush-fee-cache-f061` (Section 4 endpoint spec).

**Actual:** `POST /api/admin/internal/flush-fee-cache-f061` (Manager Plan PAUSE-BA-C example).

**Reason:** Followed Manager Plan over PRD example (Manager Plan owns final endpoint shape per workflow). `admin/internal/` namespace cleaner cho post-deploy ops (cross-domain — not tied to finance module exclusively).

---

## 2. Forced changes / Tradeoffs

### 2.1 SQL TRIM() check for whitespace defensive

**Decision:** SQL `payment_ref IS NOT NULL AND TRIM(payment_ref) <> ''` (parallel to TS `isPaymentRefEmpty`).

**Tradeoff:** MySQL TRIM() per-row adds cost. For race 76 (909 rows) negligible (~<1ms). For 100K+ row queries có thể impact — but Analytics/Dashboard queries luôn period-bound (≤30 ngày × N tenants) → max ~5K rows typical → fine.

**Alternative considered:** Skip TRIM() in SQL → relying on TS check downstream. Rejected: `computeSelfFee` is per-period aggregate ALL in SQL (no per-order TS loop) → must include TRIM() for SQL CASE accuracy.

### 2.2 Backward compat `paymentRef: undefined` = MANUAL fallback

**Decision:** `isPaymentRefEmpty(undefined) === true` → caller pre-F-061 không inject paymentRef sẽ FLIP behavior (ORDINARY → MANUAL).

**Tradeoff:** Pre-F-061 callers KHÔNG ngoài 3 mục atomic-fixed (Analytics + 2 Dashboard). Tất cả 3 ĐÃ update concurrent trong same commit → atomic. Risk: future caller mới của `computeFeeForOrdersAggregate` quên inject paymentRef → bug data drift (silent under-thu phí 5BIB).

**Mitigation:** JSDoc explicit trong DTO `OrderForFeeAggregate.paymentRef`: "F-061 — undefined treat as MANUAL nếu cat ∈ SPLIT_BY_PAYMENT_REF". + TC-61-09 backward compat test explicitly documents this behavior.

**Alternative considered:** Throw error nếu undefined (PRD Option C). Rejected: high break risk for unknown future callers, error noise.

### 2.3 Dedicated controller module thay vì append to existing admin module

**Decision:** NEW `admin-internal/` module thay vì append controller vào `admin/admin.module.ts` existing.

**Tradeoff:** Extra module file overhead (admin-internal.module.ts ~21 LoC). Nhưng:
- `admin/admin.module.ts` hiện scope hẹp (race/raceResult admin operations), không phải catch-all
- `admin-internal/` semantic rõ hơn cho "internal ops trigger" cross-domain (future endpoints khác — flush specific cache, trigger jobs, etc.)
- LogtoAdminGuard guard centralized tại module level (DRY).

---

## 3. Reviewer Notes priority list

Manager spot-check theo thứ tự critical (highest first):

### Priority 1 — `reconciliation-query.service.ts:139-211`

**File:** `backend/src/modules/reconciliation/services/reconciliation-query.service.ts`

**Why critical:** Core categorize() logic — drop BR-03 special-case + missingPaymentRef semantic shift. Bug bug magnet nếu logic không đúng → 19 race recon mới classify sai.

**Verify:**
- [ ] `manualOrders` accept BOTH native MANUAL + SPLIT-cat empty-ref fallback (line 155-156, 173)
- [ ] `missingPaymentRefFallback` collect đúng các SPLIT-cat fallback (line 173-174)
- [ ] Comment block giải thích BR-03 deprecate rõ + reference Manager Plan (line 12-32)

### Priority 2 — `fee.service.ts:1213-1217` cascade extend

**File:** `backend/src/modules/finance/services/fee.service.ts`

**Why critical:** `isManual` cascade extended — backward compat semantic. Pre-F-061 caller untouched will flip ORDINARY no-ref → MANUAL → atomic B mandate require all caller cập nhật concurrent.

**Verify:**
- [ ] `isManual = cat === 'MANUAL' OR (SPLIT.has(cat) AND isPaymentRefEmpty(order.paymentRef))` line 1224-1225
- [ ] `is5bib = fiveBibCats.includes(cat) && !isManual` line 1227 (extra guard cho safety — KHÔNG redundant)
- [ ] Comment block reference BR-61-05/07 + atomic B mandate (line 1213-1222)

### Priority 3 — `fee.service.ts:670-730` SQL CASE block

**File:** `backend/src/modules/finance/services/fee.service.ts`

**Why critical:** SQL raw query — typo / logic bug sẽ silently drift recon production data per-period.

**Verify:**
- [ ] `hasPaymentRefSql = "o.payment_ref IS NOT NULL AND TRIM(o.payment_ref) <> ''"` line 681
- [ ] 5BIB CASE branches (fee_5bib, gross_5bib, count_5bib) tất cả include `AND (${hasPaymentRefSql})` line 690-705
- [ ] MANUAL extended CASE branches (count_manual, manual_ticket_count) include `OR (cat IN (FIVE_BIB) AND NOT hasPaymentRefSql)` line 712-722
- [ ] `gross_gmv_all` KHÔNG split — đếm tất cả orders (semantic preserve display GMV) line 729

### Priority 4 — `admin-internal/flush-fee-cache.controller.ts`

**File:** `backend/src/modules/admin-internal/flush-fee-cache.controller.ts`

**Why critical:** New endpoint admin-only — auth + flush logic cần đúng pattern existing (port từ MerchantService scanStream).

**Verify:**
- [ ] LogtoAdminGuard class-level (line 77-79)
- [ ] 10 patterns enumerate đúng (line 50-65)
- [ ] scanStream + pipeline DEL pattern match `merchant.service.flushEventOverrideCache` (line 110-130)
- [ ] Idempotent — repeat call returns deletedKeys: 0 (no state mutation aside Redis DEL)
- [ ] Logger.warn structured audit emit (line 138-140)

### Priority 5 — `common/constants/order-classification.ts`

**File:** `backend/src/common/constants/order-classification.ts`

**Why critical:** Shared module — bug propagate 4 module dependencies.

**Verify:**
- [ ] `SPLIT_BY_PAYMENT_REF === FIVE_BIB_CATEGORIES` (set unify per BR-61-01)
- [ ] `isPaymentRefEmpty` covers null/undefined/empty/whitespace
- [ ] `FIVE_BIB_SQL_LIST` properly escaped (single-quote literals, no SQL injection vector vì hardcoded enum)

---

## 4. Open questions / Future TDs

### 4.1 PROD HTTP perf benchmark deferred QC

- In-process micro-benchmark p95 = 1ms ≪ 50ms budget — strong PASS.
- BUT PRD BR-61-14 mandate "Coder MUST benchmark trước/sau với race 76 (909 đơn)" — interpret "benchmark" as in-process is acceptable hay cần full HTTP autocannon?
- QC suggested to clarify với Danny + run autocannon DEV environment trước deploy PROD.

### 4.2 Data quality monitoring alert (defer F-062)

- TD-F061-DATA-QUALITY-FUTURE-RISK MED: Sau ship F-061, monitor merchant pattern shift.
- Suggest cron alert: tenant historically có ratio no_ref < 5% bỗng spike > 90% → Logger.warn rate-limited.
- Out of scope F-061, defer F-062.

### 4.3 Cache flush automation post-deploy

- Hiện admin manual curl (PAUSE-61-05 = A). Future improvement: deploy script auto-call endpoint sau docker compose up (Option B in PAUSE-61-05).
- Defer separate DevOps task.

### 4.4 Frontend display label adjustment

- Frontend Reconciliation preview UI hiển thị `manual_fee_amount` — sau F-061, race MOU sẽ có manual_fee_amount > 0 (trước = 0). Có cần UX hint "Phí MANUAL (MOU intentional)" badge?
- Out of scope F-061 (backend only per PRD). UX/PM evaluate post-deploy persona feedback.

### 4.5 Reconciliation document tag `bug_classification_version` (Option C deferred)

- PRD Manager init Option C: per-recon flag `v1 = BR-03` vs `v2 = F-061`. Defer — forward-only mandate makes flag unnecessary cho new recon (luôn v2). Historical recon v1 không recompute.
- Future: nếu cần audit show recon historical với badge "Outdated BR-03" trong admin UI → reopen.

---

## 5. Pre-merge verification

- [x] `tsc --noEmit` zero error (chỉ pre-existing upload.spec `vi` errors not in scope)
- [x] 14 F-061 specs PASS (6 reconciliation + 8 fee service)
- [x] 107 regression specs PASS (analytics F-058 + dashboard F-059 + reconciliation legacy + fee F-043 + fee general)
- [x] No `om.created_at` matches (F-058 hotfix lesson)
- [x] No active "BR-03 ORDINARY pass-through" logic (only historical comment context)
- [x] No `0.055` hardcode in production code
- [x] 9 PAUSE locks encoded verbatim
- [x] Scope Lock 13 files + 3 regression spec compatibility updates

Sẵn sàng QC.
