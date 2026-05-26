# FEATURE-067 — Manager Plan (Restored Stub)

**Status:** RESTORED post-hoc (race condition — original Manager plan lost on branch checkout)
**Restored:** 2026-05-26 (QC Item 1 deferred Manager close-loop)
**Branch:** `feat/F-067-stale-docx-auto-regen`

---

## 1. Lý do restore

Manager Plan gốc đã generate trong session 2026-05-25 NHƯNG KHÔNG commit lên branch do race condition giữa parallel Coder agents. QC re-audit 2026-05-26 Item 1 → restore stub này.

Source of truth thực tế cho Scope Lock + decisions:
- `03-coder-implementation.md` — Files Changed section
- Git diff `origin/main..origin/feat/F-067-stale-docx-auto-regen` (11 files = 9 prod + 2 docs)

---

## 2. Scope Lock — 9 files (verified từ git diff)

### Backend (7)
- NEW `utils/contract-diff.util.ts`
- NEW `services/contract-audit.service.ts`
- NEW `dto/contract-history.dto.ts`
- MODIFY `services/contracts.service.ts`
- MODIFY `contracts.controller.ts`
- MODIFY `contracts.module.ts`
- NEW `services/contracts.service.f067.spec.ts`

### Admin (2)
- MODIFY `lib/contracts-api.ts`
- MODIFY `app/(dashboard)/contracts/[id]/page.tsx`

### Docs (5)
- RESTORED `00-manager-init.md`, `01-ba-prd.md`, `02-manager-plan.md` (this rework)
- PRESENT `03-coder-implementation.md` (source of truth)
- PRESENT `IMPLEMENTATION_NOTES.md`
- PRESENT `04-qc-report.md` (with re-audit section)

---

## 3. PAUSE decisions (Danny 2026-05-25)

| # | Quyết định |
|---|------------|
| PAUSE-67-01 | A current (math KHÔNG đổi) |
| PAUSE-67-02 | DONE (DB verified) |
| PAUSE-67-03 | A per-line round (KHÔNG đổi) |
| PAUSE-67-04 | A Forward-only |
| PAUSE-67-05 | Auto-correct via D |
| PAUSE-67-06 | **D Hybrid** auto-regen + warning + audit |

3 PAUSE-Coder Manager chốt: TD-actor carry-forward + diff cap 100 + fire-and-forget Phase 1.

---

## 4. Sequencing (Coder commits)

| # | Commit | Group |
|---|--------|-------|
| 1 | `2a70859` | rework Items 3+4: ContractAuditService integration + test bench mocked |
| 2 | `ef29954` | docs append |
| Earlier | `29c41d1` | initial F-067 feature commit (all 9 files) |

---

## 5. Risk register

- **R1 (mitigated):** Race condition mất 00/01/02 docs — happened, restored qua rework.
- **R2 (mitigated):** F-064 parallel feature collision ở `contracts.service.ts:update()` — Coder integrate ContractAuditService làm single integration point, KHÔNG conflict downstream.
- **R3 (deferred):** TD-CONTRACTS-ACTOR-001 — `actorId='admin'` hardcoded, future F-068 JWT extraction.
- **R4 (deferred):** Concurrent regen race — Phase 2 BullMQ queue.

---

## 6. Definition of Done

1. F-067 spec 14/14 PASS (post-rework +TC-67-13)
2. Update spec 19/19 PASS (post-rework +3 regenSpy assertions)
3. Contracts module 273+ PASS
4. F-058 + F-043 NOT broken
5. QC re-audit Items 3+4 ✅ APPROVED FINAL
6. Manager Items 1+2: Item 1 fixed (this restore), Item 2 ACCEPT LogtoStaffGuard (existing pattern)

---

**Restored by:** 5bib-manager
**Verify:** `git ls-tree -r origin/feat/F-067-stale-docx-auto-regen .5bib-workflow/features/FEATURE-067-*/`
