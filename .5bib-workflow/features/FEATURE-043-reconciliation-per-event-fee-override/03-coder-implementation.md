# FEATURE-043: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC
**Completed:** 2026-05-19
**Author:** 5bib-fullstack-engineer (run by Manager orchestrator)
**Linked:** `00`, `01`, `02`

---

## 📌 Pre-flight check (Coder)

- [x] Đọc 00 + 01 + 02 + memory `conventions.md` + `codebase-map.md`
- [x] Spot-check code thật: MerchantConfig schema, fee.service cascade, reconciliation.service preview, merchant.service updateFee audit pattern, RaceReadonly entity registration

---

## 🔍 Impact Assessment

### Backend
- **MongoDB**: Lazy default `[]` cho `event_fee_overrides` — KHÔNG migration cần. Existing 58 merchant_configs vẫn work without break.
- **Redis**: Reuse F-040 `pnl:*:tenant=<id>` pattern + NEW `merchant:fee-overrides:<tenantId>` cache key.
- **NestJS**: Module extension only — register `RaceReadonly` cho cross-DB validation. No new module.
- **Named connection**: `'platform'` reused.

### Frontend
- Single new component (`EventFeeOverrideManager.tsx`) + 4-line injection vào merchant detail page tab "fee".
- Raw fetch + authHeaders pattern (consistent với page.tsx).

### API Contract
- 4 NEW endpoints (`/api/merchants/:id/event-fee-overrides[/:raceId]`) — additive, no break.
- `previewReconciliation` response thêm field `fee_source` + `event_override_meta` — optional consumers ignore safely.
- `SelfComputeSliceDto` thêm field `feeSource` — backward compat.

---

## ⚠️ Edge Cases Covered

1. ✅ Lazy default `[]` cho legacy configs (BR-43-02 backward compat)
2. ✅ Override null per-field → fallback cascade per-field (BR-43-06)
3. ✅ `effective_from > periodFrom` → SKIP tier 0 (BR-43-07 versioning)
4. ✅ Cross-DB raceId validation throws 400 nếu invalid (BR-43-10)
5. ✅ Duplicate (tenantId, raceId) throws 409 (BR-43-04)
6. ✅ PUT 404 nếu override không tồn tại
7. ✅ Audit chỉ log changed fields (oldVal===newVal skip với `??` null coalesce)
8. ✅ DELETE emit 3 audit docs (per field) với new_value=null
9. ✅ Cache flush invoked sau POST/PUT/DELETE
10. ✅ `raceName` join graceful nếu RaceReadonly unavailable

---

## 🧠 Logic & Architecture

- **Cascade order critical**: Tier 0 lookup BEFORE Tier 1 — preserve F-040 existing logic, just inject new check upfront.
- **Independent per-field cascade**: `service_fee_rate` 4-tier (with contract), `manual_fee_per_ticket` + `fee_vat_rate` 3-tier (no contract).
- **Storage choice**: Inline nested array (Option A from Manager init) thay vì separate collection — simpler queries, document-size acceptable (58 merchants × few events).
- **Sub-document `_id: false` + `timestamps: true`** — auto createdAt/updatedAt for each override, no extra `_id` clutter.
- **PartialType cho UpdateDto**: PUT semantic = partial update (admin có thể chỉ đổi 1 field).
- **Audit naming convention**: `fee_field = 'event_override.<raceId>.<field>'` — phân biệt với regular merchant-level fee history; UI sẽ render conditional.

---

## 💻 Files Changed

### Backend modify (4 files)
- ✏️ `backend/src/modules/merchant/schemas/merchant-config.schema.ts` — Add `EventFeeOverride` sub-schema + `event_fee_overrides[]` field + compound index
- ✏️ `backend/src/modules/merchant/merchant.module.ts` — Register `RaceReadonly` in `'platform'` connection
- ✏️ `backend/src/modules/merchant/merchant.service.ts` — Add `raceRepo` injection + 4 CRUD methods + 3 helper methods (~280 LoC)
- ✏️ `backend/src/modules/merchant/merchant.controller.ts` — Add 4 endpoints (Get/Post/Put/Delete) với full Swagger annotations
- ✏️ `backend/src/modules/finance/services/fee.service.ts` — Inject Tier 0 cascade lookup + `feeSource` return
- ✏️ `backend/src/modules/finance/dto/pnl-response.dto.ts` — Add `feeSource` field
- ✏️ `backend/src/modules/reconciliation/reconciliation.service.ts` — Preview cascade with `fee_source` + `event_override_meta` response

### Backend NEW (1 file)
- ➕ `backend/src/modules/merchant/dto/event-fee-override.dto.ts` — 3 DTOs (Create + Update Partial + Response)

### Backend tests NEW (2 spec files)
- ➕ `backend/src/modules/merchant/merchant.service.f043.spec.ts` — 13 tests (TC-43-01..06, 13, 14, 15, 16)
- ➕ `backend/src/modules/finance/services/fee.service.f043.spec.ts` — 7 tests (TC-43-08..12 + 2 bonus)

### Admin modify (1 file)
- ✏️ `admin/src/app/(dashboard)/merchants/[id]/page.tsx` — Import + inject EventFeeOverrideManager vào tab "Phí dịch vụ"

### Admin NEW (1 file)
- ➕ `admin/src/app/(dashboard)/merchants/_components/event-fee-override-manager.tsx` — Full CRUD component (~450 LoC) với dialog + table + delete confirm

**Total: 7 modify + 4 NEW = 11 files** (vs plan 13 — combined backend file list slightly different)

---

## 🧪 Tests Written + PASS

```
=== F-043 specs ===
PASS src/modules/merchant/merchant.service.f043.spec.ts (13 tests)
PASS src/modules/finance/services/fee.service.f043.spec.ts (7 tests)
Test Suites: 2 passed, 2 total
Tests:       20 passed, 20 total

=== Full regression merchant + finance + reconciliation ===
Test Suites: 1 failed (pre-existing TD-F029), 16 passed, 17 total
Tests:       225 passed, 225 total
```

**225 tests PASS** + zero F-040/F-024/F-016 regression. 1 suite fail = `reconciliation.controller.spec.ts` pre-existing TD-F029-INHERITED-CTRL-SPEC (Manager init đã track).

---

## 🛑 PAUSE/Confirmation log

| Phase | Outcome |
|-------|---------|
| Manager Adjustment cascade order | ✅ Tier 0 BEFORE Tier 1, KHÔNG break F-040 19 TC-FE |
| Manager Adjustment regex collision | ✅ N/A (F-043 không có regex template like F-044/F-045) |
| RaceReadonly DI cross-module | ✅ Re-import + register trong `MerchantModule.imports` |
| F-040 regression run | ✅ 19 TC-FE + fee.service.spec PASS post cascade extension |

---

## 🐛 Known limitations / Tech debt

- TD-F043-FE-CASCADE-LOGGER (LOW) — Tier 0 hit không log; chỉ Tier 2/3 fallback log. Future: rate-limited "override hit" log nếu cần debug.
- TD-F043-MULTI-PROVIDER-CONTRACT-TYPE (INFO) — Only TICKET_SALES context affected (per BR-43-17). TIMING/RACEKIT/OPS contracts không touch cascade — fee.service path different.
- TD-F029-INHERITED-CTRL-SPEC — Pre-existing reconciliation.controller.spec failure (not F-043).

---

## ✅ Self-Review Pipeline (Manager 2026-05-14)

- [x] Bước 1: tsc clean cho Scope Lock files
- [x] Bước 2: PRD strict adherence (17 BR matched, 4 endpoints + DTOs verbatim)
- [x] Bước 3: Anti-pattern scan — KHÔNG `console.log`/`any`/`as unknown` mới
- [x] Bước 4: Hand-pick mapping (N/A — no schema field across multiple sites)
- [x] Bước 5: PROD-readiness — 225 tests PASS, zero regression
- [x] Bước 6: UI/UX self-inspection — dialog `sm:max-w-lg` (NOT default sm), VN labels, all states (loading/empty/error/success/validation), confirm dialog for delete
- [x] Bước 7: Real-world data — fixtures use Cát Tiên contract semantic + asymmetric provider scenarios
- [x] Bước 8: Files Changed vs Scope Lock — 11 files, within plan estimate
- [x] Bước 9: Generated SDK regen — NO need (admin uses raw fetch)
- [x] Bước 10: Unit tests PASS output paste — DONE

→ Status: 🟠 READY_FOR_QC
