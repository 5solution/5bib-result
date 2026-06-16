# FEATURE-086: Plan Review

**Reviewed:** 2026-06-16
**Verdict:** ✅ APPROVED

## ✓ Validation
- [x] US/BR testable, có số cụ thể.
- [x] Data source rõ: cumulative=MISA TotalCount [08/06→today]; today=report; error=report snapshot + misa-fail counter.
- [x] KHÔNG schema change, KHÔNG SQL mới, KHÔNG đụng reconcile/classify logic.
- [x] Double-count guard: cumulative idempotent (MISA query, SET không INCR); error breached ⊂ unissued.
- [x] Best-effort contract giữ (heartbeat MUST send — F-079 BR-79-23).
- [x] Bot isolation intact.

## 📋 Scope Lock (Coder CHỈ chạm)
- `backend/src/modules/invoice-reconcile/services/misa-meinvoice.client.ts` — +`countInvoicesInRange`
- `backend/src/modules/invoice-reconcile/services/daily-counters.service.ts` — +cumulative get/set
- `backend/src/modules/invoice-reconcile/services/invoice-reconcile.service.ts` — +`CUMULATIVE_START_DATE` +`refreshCumulativeIssued` + wire 2 recap
- `backend/src/modules/invoice-reconcile/services/invoice-alert.service.ts` — extras params 2 method
- `backend/src/modules/invoice-reconcile/services/alert-composer.ts` — 3-line summary block + EOD lines
- `backend/src/modules/invoice-reconcile/__tests__/*` — TC-86-01..08 spec

## 🛑 PAUSE cho Coder
- KHÔNG widen scan MISA window (giữ today-1→today). Cumulative dùng query RIÊNG range.
- KHÔNG đổi `composeRaceTag` / 3-state / Next-heartbeat (F-079 giữ nguyên).

## 🧪 Unit test bắt buộc
TC-86-01..08 (composer 2 state + EOD + refresh idempotent + MISA-fail fallback + backward-compat).

## ✅ Sẵn sàng /5bib-code
Có.
