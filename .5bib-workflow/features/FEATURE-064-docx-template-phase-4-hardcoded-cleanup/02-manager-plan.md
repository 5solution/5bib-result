# FEATURE-064 — Manager Plan (Restored Stub)

**Status:** RESTORED post-hoc (race condition — original Manager plan lost on branch checkout)
**Restored:** 2026-05-26 (QC P0-PROCESS-01 rework)
**Branch:** `feat/F-064-docx-phase-4-hardcoded-cleanup`

---

## 1. Lý do restore

Manager plan gốc đã được generate trong session F-064 init nhưng KHÔNG được commit lên
branch. QC re-audit 2026-05-26 flag P0-PROCESS-01 → restore stub này.

Source of truth thực tế cho Scope Lock:
- `03-coder-implementation.md` Section 2 (Scope Lock 13 files với +/- counts)
- Git diff `origin/main..origin/feat/F-064-docx-phase-4-hardcoded-cleanup` (17 files = 13 prod + 4 spec/docs)

## 2. Scope Lock — 13 files (verified từ git diff)

### Backend (10 files)

| Path | Type |
|------|------|
| `backend/src/modules/contracts/utils/event-date-derive.ts` | NEW helper |
| `backend/src/modules/contracts/utils/event-date-derive.spec.ts` | NEW spec |
| `backend/src/modules/contracts/schemas/contract.schema.ts` | MODIFY (6 optional fields) |
| `backend/src/modules/contracts/dto/create-contract.dto.ts` | MODIFY (6 optional fields) |
| `backend/src/modules/contracts/services/contracts.service.ts` | MODIFY (buildRenderContext extend) |
| `backend/src/modules/contracts/services/contracts.service.f064-context.spec.ts` | NEW spec |
| `backend/src/modules/contracts/services/f064-hardcoded-cleanup.spec.ts` | NEW spec |
| `backend/src/modules/contracts/services/audit-script.f064.spec.ts` | NEW spec |
| `backend/assets/contract-templates/*.docx` | MODIFY 5 templates |
| `backend/...` (other minor) | — |

### Admin (2 files)

| Path | Type |
|------|------|
| `admin/src/app/(dashboard)/contracts/components/contract-wizard.tsx` | MODIFY (step 3 UI) |
| `admin/src/lib/contracts-api.ts` | MODIFY (DTO payload) |

### Docs (3 files — including this restoration)

| Path | Type |
|------|------|
| `.5bib-workflow/features/FEATURE-064-.../00-manager-init.md` | RESTORED stub |
| `.5bib-workflow/features/FEATURE-064-.../01-ba-prd.md` | RESTORED stub |
| `.5bib-workflow/features/FEATURE-064-.../02-manager-plan.md` | RESTORED stub (this file) |
| `.5bib-workflow/features/FEATURE-064-.../03-coder-implementation.md` | PRESENT (source of truth) |
| `.5bib-workflow/features/FEATURE-064-.../IMPLEMENTATION_NOTES.md` | PRESENT (Coder retrospective) |
| `.5bib-workflow/features/FEATURE-064-.../04-qc-report.md` | PRESENT (QC verdict + rework) |

## 3. Sequencing (recap từ Coder commits)

| # | Commit | Group | Files |
|---|--------|-------|-------|
| 1 | `23a4a82` | Group C helpers | event-date-derive + 22 unit tests |
| 2 | `8b04527` | Group E schema/DTO | 6 optional fields |
| 3 | `de58625` | Group C buildRenderContext | 8 keys + 16 context tests |
| 4 | `2a74515` | Group A+B+I templates | 5 DOCX XML edit |
| 5 | `a722896` | Group F render-verify | 20 tests |
| 6 | `483df80` | Group D admin wizard | step 3 UI |
| 7 | `3f674dd` | Group docs | implementation report |

Plus QC rework commits 2026-05-26 (3 commits — P0/P1/P2).

## 4. Risk register

- **R1 (mitigated):** Race condition mất 00/01/02 docs trên branch — **happened**, restored qua rework.
- **R2 (mitigated):** Hardcoded leak trong DOCX render → unprofessional contract → legal exposure. Mitigated qua audit-script.f064 gate + render-verify spec.
- **R3 (mitigated):** F-067 parallel feature collision ở `buildRenderContext`. Manager resolve manually khi merge sequence (F-064 → main → F-067 rebase).
- **R4 (deferred):** PAUSE-64-09 dup description fields → F-065 candidate.
- **R5 (deferred):** PAUSE-64-12 regex Vietnamese → F-065 candidate.

## 5. Definition of Done

1. 13 files scope lock — Coder không touch ngoài scope (verified `git diff --stat`).
2. 64 test pass (F-064 specs) + 323 contracts regression pass.
3. F-044 + F-045 regression 93/93 pass.
4. 5 templates audit-clean (0 forbidden pattern).
5. QC verdict APPROVED (post-rework P0/P1/P2).
6. Manager `/5bib-deploy` sau khi QC re-sign.

---

**Restored by:** 5BIB Elite Senior Fullstack Engineer (rework agent)
**Verify:** `git ls-tree -r origin/feat/F-064-docx-phase-4-hardcoded-cleanup .5bib-workflow/features/FEATURE-064-*/`
