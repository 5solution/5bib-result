# FEATURE-080: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-06-09
**Reviewer:** 5bib-manager

---

## 🔬 Spot-check
- [x] `invoice-reconcile.service.ts:514-528` `resolveRaceTitlesSafe()` — extend point verified
- [x] `orderRepo.manager.query` pattern raw SQL `?` placeholder — existing same file line 367 (`queryDbOrders`)
- [x] `this.redis` Optional inject existing — setex available
- [x] MySQL platform `races` table có `race_id` + `title` — PROD verified hôm nay

## ✓ PRD Validation — PASS toàn bộ
5 BR testable, 7 TC explicit, SEC SQL placeholder, defensive contract BR-79-23 giữ nguyên.

## 📋 Scope Lock (2 file)
- ✏️ `backend/src/modules/invoice-reconcile/services/invoice-reconcile.service.ts` — extend `resolveRaceTitlesSafe()` only
- ✏️ `backend/src/modules/invoice-reconcile/__tests__/invoice-reconcile.service.spec.ts` — extend TC-80-01..07

## 🔧 Tech approach
Refactor `resolveRaceTitlesSafe` thành 2 phase: Phase A gọi F-049 (try/catch giữ nguyên), Phase B Layer 3 MySQL cho missing. Helper private `queryRaceTitlesMysql(missing)` riêng cho testability.

## 🛑 PAUSE points cho Coder
- 🛑 KHÔNG đụng file khác ngoài Scope Lock 2 file
- 🛑 Method signature `resolveRaceTitlesSafe(raceIds): Promise<Map<number,string>>` GIỮ NGUYÊN (caller không đổi)

## 🧪 Unit test bắt buộc: TC-80-01..07 (7 test)

## 📊 Verdict: ✅ APPROVED → `/5bib-code`
