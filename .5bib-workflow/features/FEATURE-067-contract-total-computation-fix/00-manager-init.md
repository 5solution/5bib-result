# FEATURE-067 — Manager Init (Restored Stub)

**Status:** RESTORED post-hoc (race condition — original Manager init lost on branch checkout)
**Restored:** 2026-05-26 (QC Item 1 deferred Manager close-loop)
**Branch:** `feat/F-067-stale-docx-auto-regen`

---

## 1. Lý do restore

Manager init gốc đã generate trong session F-067 init (2026-05-25) NHƯNG KHÔNG commit lên branch do race condition giữa 5 parallel Coder agents trên main worktree (cùng pattern F-064 + F-065). QC re-audit 2026-05-26 flag Item 1 → restore stub này.

Source of truth thực tế cho scope + decisions:
- `03-coder-implementation.md` — Coder implementation report đầy đủ
- `04-qc-report.md` — QC verdict (APPROVED post-rework Items 3+4)
- `IMPLEMENTATION_NOTES.md` — Coder retrospective

---

## 2. Why this feature

Re-scoped 2026-05-25 sau Danny challenge "VCB KID RUN 2026 contract DOCX lệch 297K":

**Initial hypothesis:** `calcTotals()` math bug.
**Reality:** Math ĐÚNG. Bug ở **stale DOCX snapshot** — DOCX file generated lúc 15:14:01 với data CŨ (qty=1850), admin update lên 1900 lúc 15:33:07, DB correct (totalAmount=230.382.900), nhưng DOCX file CHƯA re-generate → admin download stale file (qty=1850, total=230.085.900).

---

## 3. Scope (D Hybrid post-decision)

| Group | Mục đích |
|-------|----------|
| X — Auto-regen DOCX on mutation | Post-update hook `void Promise.resolve()...` trigger renderDocx async, S3 upload new version |
| Y — Stale warning UI fallback | Admin badge polling 2s × 7 attempts + manual "Re-generate" button |
| Z — Audit log line items edits | `ContractAuditService` wrapper + `contract_histories` collection (was empty) |
| W — Contract detail page versioning | Version list latest highlighted + history tab timeline |

---

## 4. PAUSE locked (Danny 2026-05-25)

| # | Quyết định |
|---|------------|
| PAUSE-67-01 | A current — Management fee line item explicit (calcTotals math KHÔNG đổi) |
| PAUSE-67-02 | DONE — DB verified correct |
| PAUSE-67-03 | A current — Per-line round preserved |
| PAUSE-67-04 | A — Forward-only (no historical re-render) |
| PAUSE-67-05 | Auto-correct via D fix |
| PAUSE-67-06 | **D Hybrid** — auto-regen + stale warning + audit log |

3 PAUSE-Coder Manager chốt:
- ACCEPT TD-CONTRACTS-ACTOR-001 carry-forward (`actorId='admin'` hardcoded)
- APPROVE diff cap 100 line items (perf protection)
- ACCEPT fire-and-forget Phase 1 (errors via Logger.warn)

---

## 5. Definition of Done

1. F-067 spec 14/14 PASS
2. Contracts module regression 273+ PASS
3. F-058 + F-043 NOT broken (parallel features)
4. Stale DOCX issue resolved on PROD (smoke test với contract update line items)

---

**Restored by:** 5bib-manager
**Verify:** `git ls-tree -r origin/feat/F-067-stale-docx-auto-regen .5bib-workflow/features/FEATURE-067-*/`
