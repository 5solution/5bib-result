# FEATURE-065 — Implementation Notes (Coder)

**Owner:** 5BIB Elite Senior Fullstack Engineer
**Created:** 2026-05-26
**Branch:** `feat/F-065-contract-legal-text-correctness`

> Tài liệu phụ trợ theo Danny mandate 2026-05-19 — 4 sections: deviations from plan, surprises, technical debt introduced, follow-up actions.

---

## 1. Deviations from Manager Plan

### 1.1. Commit consolidation: C4 (Bug #12) merged into C3

Manager Plan đề xuất tách Bug #12 (dispute paragraph delete) sang commit riêng để keep history granular cho rollback. Trong thực tế:

- One-shot fix script process toàn bộ REPLACEMENTS table atomically (Bug #3..#12). Tách Bug #12 phải nhân đôi script logic hoặc dùng feature flag → over-engineering cho one-shot tool.
- Bug #12 verify đầy đủ trong C5 audit spec (TC-65-09 × 3 templates).
- Commit message C3 explicit list 8 bugs (B3, B6, B7, B8, B9, B10, B11, B12) → audit trail rõ ràng tại commit log granular.

Trade-off accepted: 1 commit ít hơn nhưng atomicity rõ + verification đầy đủ.

### 1.2. Script `--dry-run` + apply mode integrated trong cùng C1 commit

Manager Plan suggest C1 = skeleton + backups, C2 = verify-only mode separate. Trong implementation, REPLACEMENTS table + verify mode + apply mode đều trong 1 file `fix-f065-templates.ts` → tách thành 2 commits sẽ tạo dead code at C1 (script without verify mode không runnable, không có value standalone). Mọi logic core ship trong C1; C2 chỉ chứa DEFLATE compression hotfix (discovered post-first-apply).

### 1.3. FR-65-5 admin UI version signal: DEFERRED

PRD §4.5 cho phép defer if effort > 2h. Implementation đánh giá:
- Admin Contract list UI cần column "Template version" + tooltip ngày generate.
- Backend cần persist `templateVersion` trên Contract schema (NEW field).
- Migration backfill existing contracts với version "pre-F065".
- Frontend column sort + filter.

→ Total effort ~4-6h. Defer sang F-068 per PRD. Backup directory đủ cho admin manual rollback nhu cầu cấp bách hiện tại.

---

## 2. Surprises / non-obvious findings

### 2.1. Concurrent agent on F-064 silently flipped HEAD

Repo `/Users/dannynguyen/Desktop/Claude/5bib-result` đang được agent khác commit lên branch `feat/F-064-docx-phase-4-hardcoded-cleanup` parallel. Mỗi lần Bash tool chạy fresh shell, HEAD reset về whatever `.git/HEAD` last pointed to — và parallel agent commits keep flipping HEAD về F-064.

**Detection:** `git reflog HEAD` revealed F-064 commits interspersed với F-065 checkouts.

**Mitigation:** Switched to dedicated worktree `/tmp/5bib-f065` từ C2 trở đi. Symlinked `node_modules` để tránh duplicate install. Sau F-065 merge, worktree có thể `git worktree remove`.

**Lesson learned:** Khi có khả năng multi-agent đụng cùng repo, ALWAYS use worktree từ commit đầu tiên (C1). Đối với F-065 nó may mắn vì C1 chỉ là binary backup + script file mới (không conflict). Nhưng nếu C1 phải touch service code chia sẻ với F-064, có nguy cơ silent overwrite.

### 2.2. pizzip default compression = STORE (no compression)

Lần đầu apply REPLACEMENTS, output DOCX size ballooned từ 33KB → 247KB (~7.4x). Word default = DEFLATE level 6. NFR-65-1 yêu cầu ≤ 5% delta → fail.

**Fix:** Explicit `compression: 'DEFLATE'` trong `zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })`.

Đã thử pre-fix với pizzip nhưng KHÔNG ai trong codebase set explicit compression. F-044 + F-064 scripts (cũng dùng pizzip) cũng dùng STORE — họ may mắn vì chỉ edit very few bytes nên user không complain. F-065 lần này edit nhiều text dài (Bug #10 + #11 + #12 multi-sentence) → STORE bloat rất rõ.

**Action item:** Có thể là tech-debt latent trong F-044 + F-064 — check sau xem output templates đó có bị bloat không. (Spawn task suggestion below.)

### 2.3. contract-racekit.docx ĐÃ có "theo Điều 3 của Hợp đồng"

BA pre-flight đúng — Bug #6 chỉ ở contract-operations. Racekit + timing pre-existed correct wording "Điều 3" trong cùng position (Trách nhiệm Bên A). Đây có thể là evidence của lịch sử template — operations là phiên bản cũ chưa fix, racekit + timing đã được manual fix tại 1 thời điểm trước F-065. Script REPLACEMENTS xử lý đúng (Bug #6 chỉ apply cho operations).

### 2.4. Bug #12 paragraph numbering tự reflow OK

Pre-fix DOCX có "Điều 11.5" duplicate dispute → "Điều 11.6" final clause. Sau xóa, paragraph numbering trong word/document.xml KHÔNG hard-code "11.5" → Word auto-numbering (`<w:numPr>`) tự reflow: final clause now becomes Điều 11.5. Visual diff sẽ confirm trong QC.

---

## 3. Technical debt introduced (none new), latent debt surfaced

### 3.1. NO new debt introduced bởi F-065

- KHÔNG đụng service code, KHÔNG thêm cron, KHÔNG migration.
- KHÔNG thay đổi API contract, KHÔNG thay đổi schema.
- Script `fix-f065-templates.ts` là one-shot dev tool, không ship runtime.

### 3.2. Latent debt surfaced (pre-existing, F-065 made visible)

| ID | Description | Severity |
|---|---|---|
| TD-PIZZIP-STORE | F-044, F-064, và bất kỳ script nào dùng `zip.generate({ type: 'nodebuffer' })` mà không set `compression: 'DEFLATE'` đều emit STORE → DOCX bloat. Confirmed F-065 hit this; F-044 + F-064 templates may have similar (smaller) bloat. | LOW-MED |
| TD-HEAD-RACE | Multi-agent same-repo workflow risks silent HEAD flip. KHÔNG có guard rail (worktree-only convention) trong project. | LOW |
| TD-NO-BOLD-VERIFY | E2E render test chỉ check leftover placeholder + render time. KHÔNG check bold/italic/indent format preserved → cần Word/LibreOffice manual visual diff (TC-65-15). | LOW |

---

## 4. Follow-up actions

### 4.1. QC must-do

1. **Visual diff Word + LibreOffice (TC-65-15):** Open 3 templates pre/post-fix side-by-side. Verify font, bold, indent, list bullets, table layout identical except 21 text segments.
2. **Render 3 sample contracts production-like:** Real race + merchant context. Confirm zero placeholder leftover, render time ≤ 5s P95.
3. **Bug #12 numbering spot-check:** Verify Điều 11.5 final clause "Hợp Đồng này được điều chỉnh và giải thích phù hợp với pháp luật Việt Nam" còn nguyên sau reflow.
4. **F-024 → F-042 → F-044 → F-045 → F-064 → F-065 full regression test suite** PASS 100%.

### 4.2. Manager must-do

1. Review diff `git diff` cho 3 DOCX qua `unzip -p ... word/document.xml | diff -y` so sánh pre/post.
2. Coordinate sequencing F-065 → F-066 → F-067 sao cho không conflict trên `word/document.xml`.

### 4.3. BA must-do

1. Notify BTC Finance: HĐ ký từ deploy date F-065 trở đi mới có version corrected. HĐ mid-flight (đã print giấy) → BTC tự quyết ký bản cũ hay re-print.
2. Prepare merchant FAQ phòng case merchant Legal push back về wording Bug #9 generic lãi suất → reply with Bộ luật Dân sự 2015 Art. 357 + Luật Thương mại 2005 Art. 306 reference.

### 4.4. Spawn task suggestions (for parent session)

Tôi recommend spawn 2 task standalone tránh bloat F-065 PR:

1. **Audit F-044 + F-064 DOCX output for STORE-compression bloat.** Check production VPS S3 bucket xem rendered contract PDFs có lớn bất thường không. Nếu yes → backfill DEFLATE compression fix vào F-044/F-064 scripts. (Severity: LOW-MED, effort: 2-3h)
2. **Document multi-agent worktree convention.** Add note vào `CLAUDE.md` khuyến cáo Coder agent ALWAYS use dedicated worktree khi multi-feature parallel work. (Effort: 30min)

---

**END IMPLEMENTATION NOTES**
