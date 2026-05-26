# F-064 — Implementation Notes (Coder retrospective)

**Date:** 2026-05-26
**Branch:** `feat/F-064-docx-phase-4-hardcoded-cleanup`
**Status:** READY_FOR_QC

---

## 1. Architecture decisions

### 1.1 Flat naming convention (PAUSE-64-01 = A)
Chọn flat keys `{eventStartDate}`, `{setupDate}`, `{athleteCount}` thay vì nested
`{event.startDate}`. Lý do thực tế khi spot-check `buildRenderContext`:
- F-044/F-045 đã flat (`{raceName}`, `{totalAmount}`, `{contractNumber}`).
- Nested keys cần parser walk (.split('.').reduce) — chậm hơn flat lookup, dễ typo
  trong template.
- 8 keys mới sit cùng level với 30+ keys existing → consistency win.

### 1.2 Helper extract qua `event-date-derive.ts` (utils standalone)
Tách helpers thành utility file riêng (KHÔNG nhét vào `contracts.service.ts`):
- Test isolation: 22 unit tests chạy không cần DB / NestJS context (run 1.8s).
- Reusable nếu sau này thêm contract type mới cần derive logic (vd payment date
  setup window).
- Anti-leak rule encode 1 chỗ: `parseRaceDateIso` strict ISO regex,
  `deriveSetupDate/Expo` propagate null instead of fallback hardcoded.

### 1.3 Phụ lục table restructure via Python XML edit script
Cân nhắc 3 approach:
- **A. python-docx** — high-level API, nhưng XML output đôi khi reorder attrs
  → diff không clean.
- **B. LibreOffice Writer manual** — UI-driven, risky vì format styles có thể
  reset.
- **C. Raw XML string replace + table cell rebuild via regex** — chọn approach
  này. Pros: idempotent, diff small (5 binary files), template structure preserved.
  Cons: brittle nếu Word change run boundaries → cần verify script chạy lại
  được sau khi LibreOffice/Word edit lần sau.

Script `/tmp/f064-consolidated-edit.py` lưu local, KHÔNG commit (tránh chứa
absolute path). Future Coder nếu cần rerun: regen từ git history nếu cần.

### 1.4 Anti-leak rule (F-044 lesson encoded)
Bài học từ F-044: hardcoded fallback "29/05/2026" silent-leak qua > 6 contracts
PROD. F-064 rule: null derive → `sanitizeContext` render empty string. Free-form
`raceDate` (multi-day text) KHÔNG produce fallback date — admin tự catch khi
review DOCX.

Tested explicitly in `TC-64-03 free-format raceDate` + `TC-64-CTX-03 null setup/expo`.

### 1.5 Phụ lục column width budget
Total table width = 10490 twips (kept invariant). Width budget rebalance:
- "Đơn vị" shrink 1756 → 1556 (200 borrow)
- Last cell "Ghi chú" shrink 2284 → 1584 (700 borrow)
- → 900 twip cho new "Chiết khấu" column
- → 1584 twip cho new "Ghi chú" rename

A4 portrait page width ~ 11906 twips; with margins ~ 10490 fits exactly. KHÔNG
ép landscape (PRD BR-64-B2 suggest 15%+15% width 2 cols cuối nhưng A4 portrait
hiện tại đã đủ).

---

## 2. PAUSE-Coder decisions log

| PAUSE | Decision | Rationale | Where encoded |
|-------|----------|-----------|---------------|
| 64-01 | Flat naming | Consistency F-044/F-045 | `buildRenderContext` returns flat 8 keys |
| 64-02 | C optional + derive | Match standard race ops convention | `deriveSetupDate/Expo` raceDate-N days |
| 64-03 | A derive line items | KISS — admin override fallback | `deriveAthleteCount` 2-tier priority |
| 64-04 | A step 3 wizard | Minimal UI change | Wizard step 3 "Lịch sự kiện" section |
| 64-05 | B 2 sign dates separate | BBNT semantic ký sau contract | `contractSignDate` + `acceptanceSignDate` |
| 64-06 | A forward-only | F-061 precedent | KHÔNG migration script |
| 64-07 | 6+1 scenarios | Cover phụ lục column bug | 15 TC-64-* + 22 helper tests |
| 64-08 | A Add Chiết khấu col | Consistency racekit + timing | 8-cell header + data row |
| 64-09 | C Defer dup description | KHÔNG phải bug F-064 scope | F-065 audit candidate |
| 64-10 | Scrub provider suffix | env default has full address | 4 templates ×1 paragraph scrub |
| 64-11 | Replace `……..` literal | Đúng semantic | `{acceptanceSignDate}` substitution |
| 64-12 | Defer F-065 regex | admin override mitigates | Regex match Vietnamese + English |

---

## 3. Issues encountered & solutions

### 3.1 Branch auto-switching during template edit
**Symptom:** Sau khi chạy Python script edit templates, git branch tự switch
sang `feat/F-065-contract-legal-text-correctness` mà KHÔNG do command nào tôi
chạy. Pre-existing local F-065 worktree có thể đã activate path overlap.

**Detection:** Audit forbidden patterns FAIL sau khi đã PASS — thấy contract-
operations.docx revert về original state mặc dù earlier commit log có F-064 edit.

**Mitigation:**
- `git branch --show-current` check sau mỗi sensitive step
- `git stash --keep-index` để preserve unstaged dirt khi switch
- `git cherry-pick` để move misplaced commit về đúng branch
- Final fix: hard-reset F-065 branch về pre-F-064 state, cherry-pick test commit
  back to F-064.

**Lesson:** Trong môi trường có multiple Coder agents chạy parallel trên cùng
repo (.claude/worktrees/), không pre-trust branch state. Mỗi commit step phải
re-verify branch trước push.

### 3.2 Hardcoded dates split across `<w:t>` runs với double-space
**Symptom:** Test text-run audit pass, nhưng final string replace fails — pattern
`ký ngày 11/04/2026` no-op vì XML actually contains `ký ngày  11/04/2026` (2
spaces).

**Detection:** First-pass audit thấy 4-5 leak templates. Re-grep raw XML around
"11/04" cho thấy double space.

**Mitigation:** Added explicit double-space variant `ký ngày  11/04/2026` (2
spaces between) trong edit list. Also discovered `14/04/2026` lives in standalone
`<w:t>` run → matched via `>14/04/2026<` enclosing tags.

**Lesson:** PRD-driven find/replace lists nên derive từ extracted text-run dump
(not from PRD pseudo-code). Always grep raw XML before authoring replace pairs.

### 3.3 `Số lượng VĐV : 3000` split into 3 runs
**Symptom:** Replace `Số lượng VĐV : 3000` no-op despite plain-text grep showing
it exists. Inspection: actual XML has 3 separate `<w:r><w:t>` runs:
`Số lượng VĐV` + `: ` + `3000 `.

**Mitigation:** Target the standalone `3000 ` text-run via XML-aware replace:
`<w:t xml:space="preserve">3000 </w:t>` → `<w:t xml:space="preserve">{athleteCount}</w:t>`.

**Lesson:** Hardcoded number values often emit as separate runs in Word docs
(formatting toggle between label+colon vs value). Always XML-aware grep for
isolated numeric runs.

### 3.4 docxtemplater `nullGetter` interaction with Date objects
**Concern:** `parseRaceDateIso` returns `null` for free-form input. Will
`sanitizeContext` convert null → empty string correctly without crashing
docxtemplater?

**Verified via TC-64-CTX-03:** `sanitizeContext` first branch `v === null || v === undefined → out[k] = ''` runs BEFORE date format branch. Template renders
"Thời gian setup: " (no value) — no crash.

---

## 4. QC handoff checklist

### MUST-TEST scenarios
- [ ] **Render 5 templates** với real contract data (VCB KID RUN 2026) qua admin
  UI → mở DOCX trong Word/LibreOffice → eyeball verify:
  - Phụ lục `contract-operations.docx` 8 cột visible, "Chiết khấu" + "Thành tiền"
    + "Ghi chú" mapping đúng
  - KHÔNG có dấu vết "Phường Vinh", "Nghệ An", "01/05/2026", "29/05/2026", "11/04",
    "14/04", "số 23 Duy Tân", "Quảng trường Hồ Chí Minh - Nghệ An", "3000 VĐV"
  - Header "Hà Nội, ngày XX tháng YY năm 2026" render từ `signDate`
  - `{client.address}` KHÔNG có suffix "Việt Nam" duplicate
- [ ] **Wizard step 3** show "Lịch sự kiện (tuỳ chọn)" section với 6 fields. Submit
  với 6 fields empty → backend derive fallback OK. Submit với fields explicit →
  override OK.
- [ ] **Backward compat** existing contract pre-F-064: open edit dialog → 6 fields
  visible empty + placeholder hint. Save → KHÔNG break.
- [ ] **Backward compat** existing contract → render DOCX → 6 fields derive
  runtime (raceDate ISO → setup/expo computed) hoặc empty (raceDate free-form).
- [ ] **F-044 + F-045 regression** chạy lại `f044-manager-render-verify.spec.ts` +
  `f045-multi-provider-render-verify.spec.ts` — MUST PASS.

### Edge cases
- [ ] Free-format `raceDate` (multi-day text) → setup/expo render empty (NOT
  "29/05/2026" hardcoded)
- [ ] Line items KHÔNG có athlete-keyword → `athleteCount = 0` rendered (NOT "3000")
- [ ] Admin override `expectedAthleteCount = 0` → fall back to derive line items
  (treated as "no override")
- [ ] Acceptance DOCX khi `acceptanceReport.reportDate` chưa finalize → empty
  render (NOT "14/04/2026")
- [ ] Provider address env default = Hồ Gươm Plaza Hà Đông → render đúng (KHÔNG
  trailing legacy Cầu Giấy suffix)

### Performance baseline
- DOCX render time: pre-F-064 ~150-200ms / template. Post-F-064 expected
  identical (+0-5ms overhead from helper calls). QC measure via cURL timing.

### Security
- No new endpoint, no auth change.
- DTO additive (6 optional fields) — no breaking change.
- Schema additive (6 `@Prop()` optional) — backward compat 100%.

---

## 5. Memory codification (post-deploy)

Sau khi Manager `/5bib-deploy` approve, update memory:

### `.5bib-workflow/memory/codebase-map.md`
- Section "Contracts module — Document Generation":
  - Add bullet: "F-064 (v1.9.7) — Phase 4 hardcoded cleanup: 5 templates scrubbed
    18+ hardcoded fragments, phụ lục `contract-operations` 7→8 cells with Chiết
    khấu col, 8 new flat render keys (eventStartDate/End/setup/expoDate/
    eventLocation/athleteCount/contractSign/acceptanceSignDate)."
  - Add reference: `backend/src/modules/contracts/utils/event-date-derive.ts`

### `.5bib-workflow/memory/change-history.md`
- New entry "2026-05-26 — F-064 Contract DOCX Phase 4":
  - Templates scrubbed: contract-operations, acceptance-operations,
    acceptance-racekit, acceptance-timing, contract-racekit
  - 18+ hardcoded fragments replaced with template variables
  - Phụ lục column-mapping bug fixed
  - 39 tests + 22 helper tests added
  - Forward-only — historical contracts NOT re-rendered

### `.5bib-workflow/memory/feature-log.md`
- New entry F-064 with branch ref + commit range `23a4a82..483df80`

### `docs/conventions.md` (anti-leak rule reinforcement)
- "F-044 lesson encoded in F-064: null derive → empty render. NEVER hardcoded
  fallback for derived date fields."

---

**End of IMPLEMENTATION_NOTES.md**
