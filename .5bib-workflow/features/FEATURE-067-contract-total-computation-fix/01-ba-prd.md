# FEATURE-067 — BA PRD (Restored Stub)

**Status:** RESTORED post-hoc (race condition — original BA PRD lost on branch checkout)
**Restored:** 2026-05-26 (QC Item 1 deferred Manager close-loop)
**Branch:** `feat/F-067-stale-docx-auto-regen`

---

## 1. Lý do restore

BA PRD gốc (22 BR + 12 TC, ~5000 từ) đã generate trong session F-067 PRD (2026-05-25) NHƯNG KHÔNG commit lên branch do race condition. QC re-audit 2026-05-26 Item 1 → restore stub này.

Source of truth thực tế cho BR/TC + implementation details:
- `03-coder-implementation.md` — Coder implementation report
- `04-qc-report.md` — QC verdict + re-audit 2026-05-26 verified Items 3+4 FIXED
- Test files: `contracts.service.f067.spec.ts` (14 TC) + `contracts.update.spec.ts` (19 TC)

---

## 2. Business Rules (recap — 22 BR-67-*)

### Group X — Auto-regenerate DOCX (BR-67-01..07)
- Post-update hook `void Promise.resolve()...` trigger renderDocx async
- DOC_AFFECTING_FIELDS allowlist 19 fields
- S3 upload new version với `version: N+1` increment trong `generatedDocuments[]`
- Skip DRAFT contract update (BR-67-03)
- Mutation response KHÔNG block (async fire-and-forget)
- Regen fail → log warn + audit `contract.docRegenFail`, KHÔNG rollback mutation

### Group Y — Stale warning UI (BR-67-08..10)
- Admin badge polling 2s × 7 attempts = 14s timeout
- Manual "🔄 Tạo lại tài liệu" button
- VN labels REGEN_STATUS_LABEL dictionary

### Group Z — Audit log diff (BR-67-11..16)
- `emitAudit()` thêm `diff: ContractUpdateDiff`
- Line items match by `stt`, added/removed/modified shape, cap 100 items
- Reuse `AuditLogService.emit()` từ F-023
- NEW endpoint `GET /api/admin/contracts/:id/history` sorted DESC limit 50/max 200

### Group W — UI versioning (BR-67-17..22)
- Version list latest highlighted
- "Tải xuống mới nhất" primary button
- NEW tab "Lịch sử chỉnh sửa" timeline với expandable JSON diff
- AUDIT_ACTION_LABEL dictionary 16 actions VN

---

## 3. Test Cases (recap — 14 TC-67-*)

- TC-67-01 ACTIVE raceName update → fires regen
- TC-67-02 Async non-blocking (mutation response < regen complete)
- TC-67-03 DRAFT skip regen
- TC-67-04 MySQL link-only no fire (non DOC_AFFECTING_FIELD)
- TC-67-05 Regen S3 fail → log warn, NO mutation rollback
- TC-67-06..09 Diff util: added/removed/modified/cap 100
- TC-67-10 History endpoint shape + auth
- TC-67-11 Backward compat pre-F-067 contracts
- TC-67-12 Skip non-doc fields update
- TC-67-13 (rework) ContractAuditService wrapper delegation correctness

---

## 4. Files Coder cần đụng (9 Scope Lock + 2 docs)

### Backend (7)
- NEW `utils/contract-diff.util.ts` (cap 100, match by stt)
- NEW `services/contract-audit.service.ts` (wrapper AuditLogService)
- NEW `dto/contract-history.dto.ts` (@Max 200)
- MOD `services/contracts.service.ts` (beforeSnapshot + post-update hook + regenerateContractDocxAsync + getHistory)
- MOD `contracts.controller.ts` (NEW endpoint `GET :id/history`)
- MOD `contracts.module.ts` (register ContractAuditService)
- NEW `services/contracts.service.f067.spec.ts` (13 TC + sanity)

### Admin (2)
- MOD `lib/contracts-api.ts` (+3 types + getContractHistory)
- MOD `app/(dashboard)/contracts/[id]/page.tsx` (rewrite — StaleBadge + VersionList + HistoryTab + 2s polling × 7 attempts)

---

## 5. Status

**🔵 READY** (legacy — locked 2026-05-25, ship 2026-05-26).

---

**Restored by:** 5bib-po-ba (BA agent — recreate from session memory + Coder report)
