# FEATURE-064 — Manager Init (Restored Stub)

**Status:** RESTORED post-hoc (race condition — original lost on branch checkout)
**Restored:** 2026-05-26 (QC P0-PROCESS-01 rework)
**Branch:** `feat/F-064-docx-phase-4-hardcoded-cleanup`

---

## 1. Lý do restore

`00-manager-init.md` gốc đã exist trong workflow Manager nhưng KHÔNG được commit lên
branch trước khi Coder kick off (race condition — gap F-067 lesson). QC re-audit
2026-05-26 flag P0-PROCESS-01 → restore stub này để Manager `/5bib-deploy` không bị
block bởi missing artifact.

Source of truth thực tế cho rationale F-064:
- `03-coder-implementation.md` Section 3 (12 PAUSE-Coder encoded)
- `03-coder-implementation.md` Section 7 (buildRenderContext keys)
- `03-coder-implementation.md` Section 8 (phụ lục restructure)
- `IMPLEMENTATION_NOTES.md` (Coder retrospective)

## 2. Scope F-064 (recap từ branch diff)

- **Mục tiêu:** Phase 4 hardcoded cleanup — scrub 18+ legacy date/location/provider
  fragments trong 5 DOCX templates, extend `buildRenderContext` 8 keys, restructure
  phụ lục `contract-operations.docx` 7→8 cells (thêm Chiết khấu column).
- **Touch points:** 10 backend + 2 admin + 3 docs (Scope Lock 13 files).
- **Risk:** Hardcoded leak in render → unprofessional contract document → legal exposure.

## 3. 12 PAUSE locked

Tham chiếu trực tiếp `03-coder-implementation.md` Section 3 (PAUSE-64-01 ... PAUSE-64-12).
Stub này KHÔNG re-document từng PAUSE để tránh drift.

## 4. Cảnh báo F-067 lesson

LỖI process: Manager hand-off → Coder ko commit 00/01/02 lên branch ngay. QC sau đó
không có spec to verify against. Pattern này repeated ở F-067 và bây giờ F-064.

**Action item Manager skill:** enforce "before-first-commit" hook check 4 docs exist
trên branch (00/01/02/03) trước khi cho phép push.

---

**Restored by:** 5BIB Elite Senior Fullstack Engineer (rework agent)
**Verify:** `git log --all --diff-filter=A -- .5bib-workflow/features/FEATURE-064-*/00-manager-init.md`
