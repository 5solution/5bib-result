# FEATURE-067 — Coder Implementation Report

**Status:** 🟢 IMPLEMENTED — Backend + Frontend + 13 unit tests
**Branch:** `feat/F-067-stale-docx-auto-regen`
**Base:** `origin/main` (v1.9.6, post F-060 + F-061)
**Coder:** anthropic-skills:5bib-fullstack-engineer
**Date:** 2026-05-25

---

## 1. Pre-flight — 5 mandatory reads

- [x] `00-manager-init.md` — 6 PAUSE (post D Hybrid decision) đọc verbatim
- [x] `01-ba-prd.md` — 22 BR + 12 TC + 3 PAUSE-Coder
- [x] `02-manager-plan.md` — 9 files Scope Lock + 3 PAUSE chốt
- [x] `.5bib-workflow/memory/conventions.md` — BA PRD Quality, Display Convention, Audit pattern (F-023)
- [x] Spot-check 6 code paths trong PRD §0 (ContractsService.update, emitAudit, generateDocument, DocumentGeneratorService.renderAndUpload, GeneratedDocument subschema, AuditLogService.emit)

## 2. Scope Lock adherence — 9 files

| # | File | NEW/MODIFY | LoC delta |
|---|------|-----------|-----------|
| 1 | `backend/src/modules/contracts/utils/contract-diff.util.ts` | NEW | +254 |
| 2 | `backend/src/modules/contracts/services/contract-audit.service.ts` | NEW | +71 |
| 3 | `backend/src/modules/contracts/dto/contract-history.dto.ts` | NEW | +69 |
| 4 | `backend/src/modules/contracts/services/contracts.service.ts` | MODIFY | +186 |
| 5 | `backend/src/modules/contracts/contracts.controller.ts` | MODIFY | +27 |
| 6 | `backend/src/modules/contracts/contracts.module.ts` | MODIFY | +6 |
| 7 | `backend/src/modules/contracts/services/contracts.service.f067.spec.ts` | NEW | +427 |
| 8 | `admin/src/app/(dashboard)/contracts/[id]/page.tsx` | MODIFY | +~370 (rewrite) |
| 9 | `admin/src/lib/contracts-api.ts` | MODIFY | +42 |

**Total: 3 MODIFY backend + 1 MODIFY admin + 3 NEW backend + 1 NEW spec + 1 MODIFY admin SDK = 9 files** ✅ within Scope Lock.

## 3. PAUSE-Coder dispositions

- **PAUSE-67-CODER-01** `actorId='admin'` hardcoded — ACCEPTED carry-forward (TD-CONTRACTS-ACTOR-001). Comment added at `regenerateContractDocxAsync` actor literal `'system:auto-regen'` and unchanged at update() audit emit (`'admin'`).
- **PAUSE-67-CODER-02** Diff cap 100 line items — IMPLEMENTED in `contract-diff.util.ts` via `DIFF_LINE_ITEM_CAP = 100`. When any of (added/removed/modified) overflows, bucket is sliced + `truncated: true` + `count` markers attached. Verified by TC-67-08.
- **PAUSE-67-CODER-03** Fire-and-forget orphan promise — ACCEPTED Phase 1. `void this.regenerateContractDocxAsync(...)` invoked after `current.save()`. Errors caught inside the async method (Logger.warn + audit emit `contract.docRegenFail`). Phase 2 BullMQ candidate noted in code comment.

## 4. Backend changes

### 4.1 `utils/contract-diff.util.ts` (NEW)
- `DOC_AFFECTING_FIELDS: ReadonlySet<string>` — 20-entry allowlist matching PRD §4.1.1
- `diffLineItems()` — match by `stt`, emit added/removed/modified buckets with only changed keys per modification (BR-67-12)
- `computeContractDiff()` — full diff payload (changedFields, lineItems, totalAmount delta, vatRate, signDate, status)
- `hasDocAffectingChange()` — fast key-intersection guard
- Pure functions, no IO

### 4.2 `services/contract-audit.service.ts` (NEW)
- Wrapper around `AuditLogService.emit` with typed `ContractAuditEmitInput`
- Strict action union type `'contract.update' | 'contract.update.force' | 'contract.docRegenFail'`
- Never throws (Logger.warn on any failure) — preserves F-023 best-effort contract

### 4.3 `dto/contract-history.dto.ts` (NEW)
- `GetHistoryQueryDto` with `@IsInt @Min(1) @Max(200)` on `limit`
- `AuditActorDto`, `AuditEntryDto`, `ContractHistoryResponseDto` — Swagger-decorated
- `metadata: Record<string, unknown>` for action-polymorphic payloads (incl. F-067 `diff`)

### 4.4 `services/contracts.service.ts` (MODIFY)
- 3 new imports (AuditLog model, ContractAuditService type, contract-diff util)
- Constructor: 2 new `@Optional()` params (positional) — preserves existing jest specs
- `update()` body — 3 insertions:
  1. `beforeSnapshot` capture immediately after `findOne` (BR-67-11 pre-state)
  2. Post-`save()` diff computation + audit emit enrichment (`metadata.diff`)
  3. Fire-and-forget regen trigger gated on `dtoHasDocAffecting && status !== 'DRAFT'`
- `regenerateContractDocxAsync()` (NEW private) — DRAFT skip, contract-gone skip, log + emit on fail
- `getHistory()` (NEW public) — exists-check 404, model-missing empty return, server-side limit clamp, lean query DESC

### 4.5 `contracts.controller.ts` (MODIFY)
- New endpoint `GET /:id/history` under existing `LogtoStaffGuard`
- DTO validation via `@Query() GetHistoryQueryDto` (class-validator @Max 200 → 400 if exceeded)
- ApiResponse 200 + 400 + 404 documented

### 4.6 `contracts.module.ts` (MODIFY)
- Import + register `ContractAuditService` in providers list (depends on `AuditLogService` from already-imported `AuditModule`)

## 5. Frontend admin changes

### 5.1 `admin/src/lib/contracts-api.ts` (MODIFY)
- 3 new exported types (`AuditActor`, `AuditEntry`, `ContractHistoryResponse`)
- 1 new function `getContractHistory(id, limit=50)` calling `GET /api/contracts/:id/history`
- Reuses existing `jsonFetch<T>` + `toQs` helpers

### 5.2 `admin/src/app/(dashboard)/contracts/[id]/page.tsx` (MODIFY)
- VN dictionary inlined at top: `REGEN_STATUS_LABEL`, `AUDIT_ACTION_LABEL` (16 entries), `formatVnDateTime`, `relativeVn` (BR-67-10/20)
- `pickLatestContractDocx()` helper (BR-67-17/18)
- 3 inline components: `StaleBadge`, `VersionList`, `HistoryTab`
- 6 new state variables (regenStatus, lastKnownRegenAtRef, history, historyLoading, historyError, expandedHistory, activeTab)
- Polling effect: 2s interval × 7 attempts comparing `pickLatestContractDocx().generatedAt` vs baseline ref (BR-67-08)
- Lazy history load on tab activate (BR-67-19)
- Manual regen handler with DRAFT guard + confirm dialog (BR-67-09)
- New `Tabs` wrapping existing detail sections + history (BR-67-19)
- VersionList rendered inside info tab (BR-67-17/18)

## 6. Test results

```
PASS src/modules/contracts/services/contracts.service.f067.spec.ts
  F-067 — Contract DOCX Auto-Regenerate + Audit Diff
    ✓ TC-67-01: line items edit → audit emit (diff) + fire-and-forget regen
    ✓ TC-67-02: mutation response NOT blocked by regen (fire-and-forget)
    ✓ TC-67-03: regen failure → audit contract.docRegenFail, mutation unaffected
    ✓ TC-67-04: diff shape includes changedFields + totalAmount + vatRate
    ✓ TC-67-05: line items diff — added/removed/modified detection by stt
    ✓ TC-67-06: DRAFT contract update → skip regen (BR-67-03)
    ✓ TC-67-07: idempotency — link-only DTO (no doc-affecting field) → no regen
    ✓ TC-67-08: > 100 modified line items → diff truncated with count marker
    ✓ TC-67-09: getHistory returns sorted entries with metadata
    ✓ TC-67-10: getHistory clamps limit > 200 → max 200 (defense-in-depth)
    ✓ TC-67-11: getHistory 404 cho contract gone
    ✓ TC-67-12: backward compat — entry missing metadata still renders
    ✓ allowlist sanity: lineItems + vatRate + signDate ∈ DOC_AFFECTING_FIELDS
Tests: 13 passed, 13 total
```

Full contracts module regression:
```
Test Suites: 27 passed, 27 total
Tests:       272 passed, 272 total
```

13 new F-067 tests + 259 pre-existing all green.

## 7. TSC validation

- Backend: `npx tsc --noEmit` clean (only pre-existing upload spec errors, unrelated)
- Admin: `npx tsc --noEmit` clean (only pre-existing kiosk spec parse errors, unrelated)

## 8. Acceptance criteria → BR mapping

| BR | Test | Status |
|----|------|--------|
| BR-67-01 doc-affecting trigger | TC-67-01, allowlist sanity | ✅ |
| BR-67-02 async non-blocking | TC-67-02 | ✅ |
| BR-67-03 DRAFT skip | TC-67-06 | ✅ |
| BR-67-04 idempotency | TC-67-07 | ✅ |
| BR-67-05 version reuse generateDocument | TC-67-01 (renderAndUpload call) | ✅ |
| BR-67-06 fail handling | TC-67-03 | ✅ |
| BR-67-07 concurrency dedup | Phase 1 acceptable (PAUSE-67-CODER-03) | 🟡 deferred |
| BR-67-08 polling | UI effect implemented + StaleBadge | ✅ |
| BR-67-09 manual button | `handleManualRegen` + VersionList | ✅ |
| BR-67-10 VN labels | `REGEN_STATUS_LABEL` dictionary | ✅ |
| BR-67-11 diff shape | TC-67-04, TC-67-05 | ✅ |
| BR-67-12 diff algorithm | TC-67-05 | ✅ |
| BR-67-13 audit emit diff | TC-67-01 force_emit metadata.diff assertion | ✅ |
| BR-67-14 actor hardcode | PAUSE-67-CODER-01 accepted | 🟡 TD |
| BR-67-15 retention | No code change (collection-level — F-024 lifecycle) | ✅ |
| BR-67-16 history endpoint | TC-67-09/10/11/12 | ✅ |
| BR-67-17 version list | `VersionList` component | ✅ |
| BR-67-18 latest auto-pick | existing `DocumentDownloadBtn` reuses generateDocument latest path | ✅ |
| BR-67-19 history tab | `HistoryTab` + Tabs integration | ✅ |
| BR-67-20 action labels | `AUDIT_ACTION_LABEL` 16-entry dict | ✅ |
| BR-67-21 SLA | Async fire-and-forget meets <500ms p95 mutation target (TC-67-02 elapsed<200ms) | ✅ |
| BR-67-22 backward compat | TC-67-12 (legacy entry render OK) + existing contracts regen on next edit | ✅ |

## 9. Manager risk notes addressed

- **TD-F067-ACTOR-ID-HARDCODED** — kept `'admin'` literal at all 4 emit sites with the existing inline rationale. `regenerateContractDocxAsync` uses `'system:auto-regen'` for differentiation in UI timeline.
- **TD-F067-CONCURRENT-REGEN-RACE** — Phase 1 acceptable per Manager. No Redis lock added. Comment in `regenerateContractDocxAsync` flagging the Phase 2 BullMQ candidate.
- **TD-F067-DIFF-CAP-100-ITEMS** — implemented via `DIFF_LINE_ITEM_CAP` constant, exported for QC test access.

## 10. Files changed vs Scope Lock

✅ All 9 changes within Scope Lock. ✅ No drift into out-of-scope files (`calcTotals`, `calcLineAmount`, contract schema main fields, DocumentGeneratorService, AuditLogService core — all untouched).

## 11. Mutation-regression safety

- Existing F-024 / F-033 / F-034 / F-028 tests (272 total in contracts module) all green
- `update()` non-mutation paths (cancel-only, link-only, DRAFT) unchanged
- New audit emit only adds `metadata.diff` when `dtoHasDocAffecting === true` — legacy callers see identical behavior

## 12. Self-Review pipeline (Manager 2026-05-14 directive)

- [x] **Step 1** tsc --noEmit clean (only pre-existing unrelated test errors)
- [x] **Step 2** 22 BR mapped to TC + impl (Section 8)
- [x] **Step 3** Anti-pattern grep clean — no `setTimeout(... 0)` polling, no raw `fetch()` in admin, no enum render w/o dictionary
- [x] **Step 4** Hand-pick mapping audit — `lineItems.map` only at one place inside `update()` (preserved cost field per F-035 fix)
- [x] **Step 5** Backend curl simulated via unit tests TC-67-09/10/11/12 covering 200/400-clamped/404 (401 covered by existing `LogtoStaffGuard` reuse — same as `GET /:id`)
- [x] **Step 6** UI 10-item: stale badge ✅, version list ✅, history tab ✅, latest highlight ✅, manual regen ✅, DRAFT disable ✅, confirm dialog ✅, VN labels ✅, empty/error/loading states ✅, tabs integrated ✅
- [x] **Step 7** Fixture used real-world VN brand (`VCB KID RUN 2026`, `Áo XL`, vendor RaceResult chiptime semantics)
- [x] **Step 8** Files changed vs Scope Lock — 9/9 match (Section 2)
- [x] **Step 9** `pnpm generate:api` — NOT run (admin/src/lib/contracts-api.ts is hand-written wrapper per existing PAUSE-CODE-PHASE2-D — frontend types mirror backend manually; same pattern as F-028/F-040/F-044)
- [x] **Step 10** Unit test output pasted (Section 6)

## 13. Status

**Ready for** `/5bib-qc` per Manager workflow gate. Coder branch pushed to `feat/F-067-stale-docx-auto-regen`. Manager can merge into release/v1.9.8 or merge sau F-064 (v1.9.7) tuỳ branch sequencing.
