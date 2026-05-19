# FEATURE-043: Deploy & Memory Sync

**Status:** ✅ DONE (code-level)
**Deployed:** 2026-05-19
**Linked:** 00–04

---

## 📌 Pre-flight check (Manager)

- [x] QC verdict ✅ APPROVED
- [x] 20 F-043 tests PASS + 225 module regression PASS
- [x] Files changed match Scope Lock (11 files vs 13 plan estimate)
- [x] Tech debt tracked

---

## 📊 Deploy summary

| Metric | Value |
|--------|-------|
| QC verdict | ✅ APPROVED |
| F-043 tests | 20/20 PASS (13 merchant + 7 fee cascade) |
| Module regression | 225/225 PASS (zero F-040/F-024/F-016 regression) |
| Pre-existing fail | 1 suite (TD-F029 reconciliation.controller.spec — not F-043) |
| Branch | `feat/F-043-reconciliation-fee-override` từ origin/main (post F-044+F-045 merge) |

---

## 🔬 Manager Independent Code Review

> Skill MANDATE 2026-05-17 — 5 critical paths reviewed.

### 1. `merchant-config.schema.ts` (+~60 LoC)
- ✅ Sub-schema `EventFeeOverride` với `_id: false` + `timestamps: true` → clean response (no _id leak)
- ✅ Lazy default `[]` cho field array → legacy 58 configs lazy-default, no migration
- ✅ Compound index `{tenantId, event_fee_overrides.raceId}` cho fast lookup

**Verdict:** ✅ APPROVED

### 2. `merchant.service.ts` 4 CRUD methods (+~280 LoC)
- ✅ `validateRaceExists()` cross-DB check (BR-43-10) — throws 400 nếu invalid
- ✅ `logEventOverrideAudit()` skip helper với null-coalesce (`?? null === ?? null`)
- ✅ `createEventFeeOverride` enforce unique constraint trong service layer (409)
- ✅ `updateEventFeeOverride` mutates sub-doc + markModified('event_fee_overrides') Mongoose required
- ✅ `deleteEventFeeOverride` emit 3 audit docs với new_value=null (per field)
- ✅ All methods invoke cache flush (F-040 + F-043 new key)

**Verdict:** ✅ APPROVED

### 3. `fee.service.ts:computeSelfFee()` cascade Tier 0 (~+30 LoC)
- ✅ Tier 0 lookup BEFORE Tier 1 — preserve F-040 fallback chain
- ✅ `feeSource` enum returned per tier (4 distinct values)
- ✅ `manual_fee_per_ticket` + `fee_vat_rate` independent cascade (3-tier, no contract fallback)
- ✅ Effective_from string lexicographic compare with periodFromCheck — correct for YYYY-MM-DD format

**Verdict:** ✅ APPROVED

### 4. `reconciliation.service.ts:preview()` (+~45 LoC)
- ✅ Cascade adapted cho preview semantic (4 sources: `admin_preview_override` / `event_override` / `merchant_default` / `unconfigured`)
- ✅ Response includes `fee_source` + `event_override_meta` (nullable nếu KHÔNG match)
- ✅ Backward compat — existing consumers ignore optional new fields

**Verdict:** ✅ APPROVED

### 5. `EventFeeOverrideManager.tsx` admin UI (~450 LoC)
- ✅ Vietnamese labels throughout (Cấu hình phí theo sự kiện / Thêm override / Sửa / Xoá / Hiệu lực từ)
- ✅ Dialog `sm:max-w-lg` (F-032 lesson — NOT default sm)
- ✅ Race picker dropdown, raceId disabled on edit
- ✅ All 9 UI states: loading skeleton / empty state với CTA / data table / error AlertCircle / dialog submitting / 409 toast / 400 toast / 403 toast / delete confirm
- ✅ Raw fetch + authHeaders (consistent với page.tsx pattern)

**Verdict:** ✅ APPROVED

### Summary

| Area | Verdict |
|------|---------|
| Schema | ✅ APPROVED |
| Service CRUD | ✅ APPROVED |
| Fee cascade | ✅ APPROVED |
| Preview response | ✅ APPROVED |
| Admin UI | ✅ APPROVED |

**Final Manager Code Review: ✅ APPROVED — production-ready.**

---

## 📝 Memory diff applied

### `feature-log.md`
- F-043 entry appended TOP of Shipped table
- Counter advance

### `change-history.md`
- Full F-043 entry với files + tests + lessons

### `conventions.md`
- New pattern minted: **N-tier cascade resolution pattern** với `feeSource` enum attribution

### `known-issues.md`
- TD-F043-CONCURRENT-POST-RACE (LOW) — sequential test only
- TD-F043-ADMIN-UI-BADGE (LOW) — preview source UI defer
- TD-F043-FE-CASCADE-LOGGER-TIER0 (LOW) — tier 0 hit không log

---

## ✅ Status

🎉 **FEATURE-043 CODE-LEVEL DONE** — Push pending Danny next decision.
