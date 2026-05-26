# FEATURE-064 — BA PRD (Restored Stub)

**Status:** RESTORED post-hoc (race condition — original BA output lost on branch checkout)
**Restored:** 2026-05-26 (QC P0-PROCESS-01 rework)
**Branch:** `feat/F-064-docx-phase-4-hardcoded-cleanup`

---

## 1. Lý do restore

PRD gốc của BA agent đã được generate trong session F-064 init nhưng KHÔNG được commit
lên branch. QC re-audit 2026-05-26 dùng `03-coder-implementation.md` Section 3 +
Section 7-9 làm proxy → flag P0-PROCESS-01.

Stub này KHÔNG re-create 24 BR + 15 TC chi tiết để tránh drift. Source of truth:
- `03-coder-implementation.md` Section 3 (PAUSE encoded → tương đương BR locked)
- `03-coder-implementation.md` Section 7 (`buildRenderContext` keys spec)
- Test files (15+ TC tổng cộng):
  - `backend/src/modules/contracts/utils/event-date-derive.spec.ts` (22 unit tests cho helper)
  - `backend/src/modules/contracts/services/contracts.service.f064-context.spec.ts` (16 context tests = TC-64-CTX-01..06)
  - `backend/src/modules/contracts/services/f064-hardcoded-cleanup.spec.ts` (11 render-verify tests = TC-64-01..10)
  - `backend/src/modules/contracts/services/audit-script.f064.spec.ts` (audit gate cho 5 templates)

## 2. Business Requirements (high-level recap)

| ID | Yêu cầu | Verify ở |
|----|---------|----------|
| BR-64-A | 5 templates DOCX KHÔNG được chứa date stamp legacy (01/02/29/05, 11/14/04/2026) | audit-script.f064 |
| BR-64-B | KHÔNG chứa địa danh legacy (Nghệ An, Phường Vinh, Phường Cầu Giấy, 23 Duy Tân, Quảng trường HCM) | audit-script.f064 |
| BR-64-C | 8 keys flat trong render context: eventStart/End/Date, setup/expo, eventLocation, athleteCount, contract/acceptanceSignDate | f064-context.spec |
| BR-64-D | Wizard admin step 3 — 6 optional override fields | manual UI test |
| BR-64-E | Phụ lục `contract-operations` 8-cell header với Chiết khấu mới | f064-hardcoded-cleanup TC-64-02 |
| BR-64-F | Anti-leak rule: free-form raceDate → setup/expo NULL (NO hardcoded fallback) | f064-context TC-64-CTX-03 + f064-hardcoded-cleanup TC-64-10 |
| BR-64-G | 2 separate sign date `contractSignDate` vs `acceptanceSignDate` | f064-hardcoded TC-64-04 + TC-64-05 |
| BR-64-H | Tất cả 3 acceptance templates có `{acceptanceSignDate}` (NO literal `…….`) | audit-script.f064 (extended QC rework) |

## 3. Test Cases (recap từ implemented spec files)

- **TC-64-01..10** trong `f064-hardcoded-cleanup.spec.ts` — render verify happy path + edge.
- **TC-64-CTX-01..06** trong `contracts.service.f064-context.spec.ts` — buildRenderContext orchestrator.
- **Audit gate** trong `audit-script.f064.spec.ts` — forbidden pattern scan cho 5 templates +
  `{acceptanceSignDate}` + `{contractSignDate}` placeholder existence check.

Tổng cộng **64 tests** (sau QC rework P2-TEST-01 + P2-TEST-02 extend).

## 4. Acceptance criteria

1. 5 DOCX templates audit-clean 11 forbidden patterns.
2. 3 acceptance templates đều có `{acceptanceSignDate}` placeholder (post-rework PAUSE-64-11 fix).
3. Render verify 0 hardcoded leak (FORBIDDEN_REGEX).
4. Wizard step 3 UI render đúng + payload format chuẩn (empty string → undefined).
5. Regression F-044 + F-045 + toàn bộ contracts module: 100% PASS.

---

**Restored by:** 5BIB Elite Senior Fullstack Engineer (rework agent)
**Caveat:** BR list ở đây là REVERSE-ENGINEERED từ code + test, KHÔNG phải BA agent
output gốc. Dùng để Manager `/5bib-deploy` không bị missing artifact, nhưng nếu cần
lookback rationale chi tiết → đọc `IMPLEMENTATION_NOTES.md` + `03-coder-implementation.md`.
