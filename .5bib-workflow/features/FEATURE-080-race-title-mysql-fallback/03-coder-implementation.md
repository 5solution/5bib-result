# FEATURE-080: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC
**Started:** 2026-06-09
**Author:** 5bib-fullstack-engineer

## 🔍 Impact Assessment
- Single method extend `resolveRaceTitlesSafe` 2-phase + helper `queryRaceTitlesMysql` mới. Signature KHÔNG đổi — caller untouched.
- MySQL READ-ONLY `?` placeholder. Redis warm-back F-049 key existing namespace. ZERO schema/endpoint change.

## ⚠️ Edge Cases Covered
TC-80-01..07: F-049 đủ (skip MySQL) / empty (fill + warm) / partial (query missing only) / MySQL throw (partial giữ) / title rỗng (skip) / double-throw (empty + heartbeat sent) / Redis warm throw (best-effort).

## 💻 Files Changed (2 — match Scope Lock exact)
- ✏️ `backend/src/modules/invoice-reconcile/services/invoice-reconcile.service.ts` — `resolveRaceTitlesSafe` 2-phase + `queryRaceTitlesMysql` helper
- ✏️ `backend/src/modules/invoice-reconcile/__tests__/invoice-reconcile.service.spec.ts` — +7 TC F-080

## 🧪 Tests
```
PASS invoice-reconcile.service.spec.ts — 21/21 (14 F-079 + 7 F-080)
Full module sweep: 9 suites / 124 tests PASS — zero regression
```

## ✅ Self-Review (compact BUGFIX)
- [x] tsc clean + anti-pattern scan clean (zero any/console.log/as unknown as)
- [x] SQL `?` placeholder verified (SEC-80-01)
- [x] BR-79-23 contract giữ nguyên (TC-80-06 heartbeat sent=true under double-fail)
- [x] Scope Lock 2 file exact — zero creep
- [x] IMPLEMENTATION_NOTES: KHÔNG có deviation — implement verbatim per Plan tech approach. Forced: none. Tradeoff: warm-back sequential await per row (đơn giản, missing list ≤ vài race) vs Promise.all batch — cost negligible với 2 races.

→ `/5bib-qc`
