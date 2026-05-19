# FEATURE-044: Deploy & Memory Sync

**Status:** ✅ DONE
**Deployed:** 2026-05-19 (code-level — push/release branch decision pending Danny)
**Author:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`, `02-manager-plan.md`, `03-coder-implementation.md`, `04-qc-report.md`, `MANAGER-CONTENT-REVIEW.md`

---

## 📌 Pre-flight check (Manager bắt buộc làm)

- [x] `04-qc-report.md` verdict = ✅ APPROVED v2 (post Manager content review + BUGFIX #1)
- [x] Đã check unit test trong `03` đều PASS — 51 NEW F-044 tests + bug #1 + CN coverage + zero regression
- [x] File thay đổi khớp với Scope Lock + 6 justified additions (CI config + 3 spec + 1 helper split) declared trong 03 — KHÔNG scope creep production code
- [x] Đã đọc Tech debt còn lại trong `03` + `04` — 8 TDs tracked + F-045 init created cho legacy hardcoded
- [x] **Manager content review** đã chạy với render verify spec — phát hiện bug #1 → fixed → 238/238 tests PASS

---

## 📊 Deploy summary

| Metric | Value |
|--------|-------|
| **QC verdict** | ✅ APPROVED v2 (xem `04-qc-report.md`) |
| **Unit tests** | 238/238 PASS across 23 contracts module suites (51 NEW F-044 + 5 F-044 BUGFIX#1 + 22 CN coverage + 160 F-024/F-042 regression) |
| **Audit script** | `Hardcoded leaks (unique): 0` across 4 pattern classes (vi-VN currency + CN slash + CN dash + VN in-words) |
| **Content review** | All 8 templates render verify with realistic fixture — số khớp chữ everywhere, 6 contractNumber rendered correctly across all contractTypes |
| **Branch** | `feat/F-044-contract-docx-phase-2` |
| **Commit/PR** | Pending — Danny decision (commit local first, then release branch strategy) |
| **PROD deploy** | Pending — combined F-042+F-044 regen batch chốt strategy với Finance team |

---

## 🔬 Manager Independent Code Review (skill MANDATE 2026-05-17)

> Manager spot-check 5 critical paths độc lập — KHÔNG rubber-stamp Coder/QC claims.

### 1. `backend/src/modules/contracts/services/contracts.service.ts:1284-1289 + 1465-1471`

**Reviewed:** flatten extension + downloadDocument call

```typescript
// Line 1284-1289 (BR-44-05)
remainingBalanceInWords: vndAmountInWords(
  contract.acceptanceReport.remainingBalance ?? 0,
),

// Line 1465-1471 (BR-44-12)
contractNumber: c.contractNumber ?? null,
raceName: c.raceName ?? null,
```

**Findings:**
- ✅ Null safety đúng: `?? 0` cho numeric → vndAmountInWords(0) returns `"Không đồng"`; `?? null` cho string fields → buildDocumentFilename HYBRID branch chỉ activate khi BOTH truthy.
- ✅ Comment encode BR-44-05 + BR-44-12 verbatim, future maintainer hiểu rõ semantic.
- ✅ Spread `... ? {...} : {}` pattern preserved (BR-44-06) — flatten keys absent khi acceptanceReport null.
- ✅ KHÔNG có `any` cast, KHÔNG có `as unknown as`.
- ✅ Backward compat: existing F-042 flatten keys unchanged.

**Verdict:** ✅ APPROVED — clean implementation, semantic alignment với BR.

### 2. `backend/src/modules/contracts/utils/build-filename.ts`

**Reviewed:** +101 LoC added: 2 new interface fields, HYBRID branch, 2 sanitizer helpers

**Findings:**
- ✅ `sanitizeContractNumber` strip Windows-reserved chars `\<>:|?*"` + control chars + collapse whitespace + truncate 80 + ellipsis. Path traversal vector mitigated.
- ✅ `sanitizeRaceName` reuse same pattern as existing `sanitizePartnerName` nhưng với MAX_RACE_NAME_LENGTH=80 (BR-44-10 spec). Reasonable separation vì sanitizePartnerName MAX=100.
- ✅ HYBRID branch placed BEFORE F-024 fallback path — short-circuit logic clean, không double-compute.
- ✅ Fallback labels `(chưa cấp số)` / `(chưa gắn sự kiện)` đảm bảo filename KHÔNG empty.
- ✅ Pure function (no DB, no side effects) — unit testable.
- ✅ TypeScript strict: `string | null | undefined` input handle đầy đủ với `if (!cn || typeof cn !== 'string')`.

**Verdict:** ✅ APPROVED — defensive coding, well-documented.

### 3. `backend/scripts/audit-template-placeholders.ts`

**Reviewed:** +37 LoC: 3 new regex patterns (Class 2/3/4) + 12 CONTEXT_KEYS additions

**Findings:**
- ✅ Regex patterns scoped đúng (CN slash separate từ CN dash separate từ VN in-words) — granular detection cho future debugging.
- ✅ CONTEXT_KEYS additions cover all F-042 11 flatten keys + F-044 1 new key (`remainingBalanceInWords`) — đóng TD-F042-TEMPLATE-PLACEHOLDER-STATIC-AUDIT.
- ⚠️ MINOR (TD-tracked): `text.match(pat)` non-global → captures first match per pattern only. Doesn't affect zero-gate semantics (0 vs >0), but post-edit aggregate could miss multi-occurrence patterns within same template. Future enhancement: `matchAll()`. Manager already tracked as TD-F044-AUDIT-AGGREGATE-FIRST-MATCH-ONLY (INFO level).
- ✅ Output format unchanged → backward compat với existing F-042 audit consumers.
- ✅ Existing console.log lines preserved — intentional CLI output pattern, not new code smell.

**Verdict:** ✅ APPROVED with TD logged.

### 4. `admin/src/lib/contracts-api.ts`

**Reviewed:** +60 LoC: new helper `parseFilenameFromContentDisposition` + refactor `streamDownloadBlob` return shape

**Findings:**
- ✅ RFC 5987 parsing priority correct: `filename*=UTF-8''<encoded>` first (Unicode) → plain `filename="..."` → null fallback.
- ✅ `decodeURIComponent` wrapped trong try/catch — malformed `%ZZ` falls through gracefully thay vì throw.
- ✅ Parse Content-Disposition BEFORE `res.blob()` (vì blob consume stream + close response).
- ✅ Type-safe: `Promise<{ blob: Blob; filename: string | null }>` explicit — caller MUST handle null fallback.
- ✅ Error path preserved: `ContractsApiError` throw với same shape as F-024 — backward compat caller code that catches it.
- ⚠️ MINOR: regex `filename\*=UTF-8''([^;]+)` greedy đến next `;` — nếu filename có `;` literal trong RFC 5987-encoded form sẽ truncate. Edge case rare (filename `;` thường được percent-encoded), acceptable.

**Verdict:** ✅ APPROVED — defensive parsing, graceful degradation.

### 5. `admin/src/app/(dashboard)/contracts/_components/document-download-btn.tsx:71-77`

**Reviewed:** 4-line change applying filename from header

```typescript
const { blob, filename } = await streamDownloadBlob(contractId, key);
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = filename ?? `${DOCTYPE_LABEL[docType]}-${contractId}.${format.toLowerCase()}`;
```

**Findings:**
- ✅ Nullish coalescing `??` correctly handles `filename = null` (header missing) → fallback to legacy ID-based pattern.
- ✅ KHÔNG remove `a.download` line entirely (BA's invalid Option 1) — preserves explicit filename intent.
- ✅ Single consumer of `streamDownloadBlob` — no other callers needed update (verified via grep).
- ✅ React component pattern unchanged: `'use client'` already declared, no boundary regression.

**Verdict:** ✅ APPROVED — minimal, surgical change.

### 6. DOCX templates (binary, via XML grep)

Manager đã run independent grep + render verify spec:

| Template | CN occurrences (render) | F-044 hardcoded leak | Adjustment #1 typo |
|----------|------------------------:|----------------------|---------------------|
| contract-timing.docx | 3 (post BUGFIX#1 verified) | 0 | N/A |
| contract-racekit.docx | 1 (BUGFIX#1: số khớp chữ) | 0 | N/A |
| contract-operations.docx | 2 (BUGFIX#1: số khớp chữ) | 0 | N/A |
| contract-ticket-sales.docx | 2 (header + Phụ lục) | 0 | N/A |
| acceptance-timing.docx | 6 (all 6 positions resolved) | 0 | N/A |
| **acceptance-racekit.docx** | **6** | **0** | **✅ FIXED (1 tạm ứng + 3 còn lại)** |
| acceptance-operations.docx | 6 (all 6 positions resolved) | 0 | N/A |
| payment-request.docx | 2 (CN render) | 0 | N/A |

**Verdict:** ✅ APPROVED — 8 templates verified end-to-end via render output, không trust automation alone.

### Manager Code Review Summary

| File | LoC delta | Verdict |
|------|----------:|---------|
| contracts.service.ts | +14 | ✅ APPROVED |
| build-filename.ts | +101 | ✅ APPROVED |
| audit-template-placeholders.ts | +37 | ✅ APPROVED (1 minor TD logged) |
| contracts-api.ts | +60 | ✅ APPROVED (1 minor edge case noted) |
| document-download-btn.tsx | +4 | ✅ APPROVED |
| 6 DOCX templates | binary | ✅ APPROVED (render verified) |

**Final Manager Code Review verdict:** ✅ APPROVED — code production-ready. 2 minor TDs logged (audit script first-match, RFC 5987 edge case) không block deploy.

---

## 📝 Memory diff (applied)

### `feature-log.md`
- ✏️ Counter: `FEATURE-043` → `FEATURE-046` (F-043 INITIATED stashed; F-044 deployed code-level; F-045 INITIATED for legacy hardcoded)
- ➕ Appended to Shipped (top): F-044 entry với 17+6 files, 238/238 tests, 8 TDs

### `change-history.md`
- ➕ Appended: full entry with files + architecture + conventions + DB/Cache + Tech debt + Lessons learned

### `codebase-map.md`
- ✏️ Updated `contracts/utils/` section: + `sanitizeContractNumber` + `sanitizeRaceName` helpers
- ✏️ Updated `contracts/services/` section: + 4 NEW spec files (f044, f044-context, f044-bugfix1, f044-manager-render-verify, audit-script.f044, f044-cn-coverage-verify)
- ✏️ Updated `backend/scripts/` section: f044-render-verify.ts (one-shot ops, optional)

### `architecture.md`
- (No change) — F-044 KHÔNG đụng service decomposition, KHÔNG thêm flow node

### `conventions.md`
- ✏️ Section "DOCX Template Content Review Protocol (F-044 lesson — 2026-05-19)" — đã added trước (during content review)
- ✏️ NEW pattern: HYBRID Option C filename pattern (template fallback to F-024 legacy)
- ✏️ NEW pattern: RFC 5987 Content-Disposition filename parsing helper

### `known-issues.md`
- ✏️ Section "Manager workflow lesson — DOCX/Template content review MANDATORY render-and-eyeball (F-044 post-mortem 2026-05-19)" — đã added
- ➕ 8 TDs tracked: TD-F044-MULTI-VIEWER-VERIFY-DEFERRED, TD-F044-CONTENT-DISPOSITION-NETWORK-VERIFY, TD-F044-RFC5987-CROSS-BROWSER, TD-F044-PROD-AUDIT-REGEN-DEFERRED, TD-F044-COMM-STRATEGY-PHASE2-COMBINED (HIGH biz), TD-F044-AUDIT-AGGREGATE-FIRST-MATCH-ONLY, TD-F044-PYTHON-FIX-SCRIPT-NOT-COMMITTED, TD-F044-LEGACY-HARDCODED-BANK-PROVIDER (→ F-045 init)
- ✅ RESOLVED: TD-F042-TEMPLATE-PLACEHOLDER-STATIC-AUDIT (closed via BR-44-13/14)

---

## 🔮 Follow-up cho feature kế tiếp

### F-045 (already initialized, deferred)
Legacy hardcoded bank/provider data trong 5 templates. Mở `/5bib-prd FEATURE-045-...` sau khi:
1. F-044 push branch + release strategy chốt
2. Combined F-042+F-044 regen batch chạy PROD
3. Finance team confirm template communication strategy

### Combined F-042+F-044 regen batch (HIGH priority — Finance team)
- Tận dụng F-044 extended audit script catch superset of F-042+F-044 affected contracts
- 1 communication cycle merchant nhận corrected DOCX đồng bộ
- PAID safeguard từ F-042 PRESERVED — WARN log + audit event

### Manager protocol enhancement (đã encode trong conventions + known-issues)
- Mọi feature đụng template/DOCX → MANDATORY render verify spec + Manager eyeball read
- Bài học F-044: 238 tests PASS + audit zero + QC ✅ APPROVED initial — NHƯNG render verify phát hiện bug #1
- Automation gates không catch semantic số ↔ chữ inconsistency → defense-in-depth Manager review LAST LINE

### F-043 Reconciliation upgrade (still stashed)
Resume sau khi F-044 + F-045 ship. `git stash list` để retrieve init.

---

## 📋 Pre-push checklist (Danny decision)

Trước khi push `feat/F-044-contract-docx-phase-2` lên remote + merge:

- [ ] Verify git status clean (chỉ Scope Lock + 6 justified additions)
- [ ] Run final `pnpm --filter backend test` toàn module để regression confirm
- [ ] Decide release branch strategy:
  - Option A: Merge into `main` → push → CI deploy DEV → cherry-pick to `release/v1.8.8` for PROD
  - Option B: Push F-044 + F-045 together sau khi F-045 done (combined regen makes sense single shot)
- [ ] Coordinate với Finance team cho combined F-042+F-044 regen batch + merchant comm strategy
- [ ] Backup `.backup/<type>-20260519-pre-f044.docx` ×6 preserved cho rollback

---

## ✅ Status

🎉 **FEATURE-044 CODE-LEVEL DONE** — Memory đã sync. Render verify all 8 templates × all contractTypes PASS. 238/238 tests PASS. Manager Code Review APPROVED.

PROD push pending Danny decision on release branch strategy + combined regen với F-045.
