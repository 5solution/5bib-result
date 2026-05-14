# FEATURE-032: Deploy & Memory Sync — Partner Excel Import

**Deployed:** 2026-05-13 (initial) → 2026-05-14 (2-step UX hotfix)
**Status:** ✅ DONE (post-UX hotfix Danny verified OK)
**Commit chain:**
- `46563e3` — F-032 initial code ship (2026-05-13)
- `e57340f` — memory sync (feature-log + 05)
- `6c6ce8a` — UX hotfix v1: flex layout + truncate + table-fixed (2026-05-14 morning)
- `7f4b962` — memory: Visual QC mandatory pre-merge convention
- `9c6df03` — UX hotfix v2: `!important` + `sm:` variant override for shadcn `sm:max-w-sm` default
- `bb3c059` — memory: shadcn responsive-variant override anti-pattern

**Branches updated:** `release/v1.8.0` then `release/v1.8.1` (PROD trigger) + `main` (DEV trigger)

---

## 📊 Deploy summary

- **Commit:** `46563e3 feat(contracts): partner Excel import (FEATURE-032)`
- **Branches pushed:**
  - `release/v1.8.0` ← fast-forwarded from origin/main first (caught F-030 + F-031) → then commit appended → push triggers PROD `deploy-production.yml`
  - `main` ← fast-forwarded to commit `46563e3` directly (same commit, triggers DEV `build-and-deploy.yml`)
- **QC verdict:** ✅ APPROVED (see `04-qc-report.md`)
- **Unit tests:** 9/9 NEW TC-IM-* PASS, 14/14 partners domain (zero regression)
- **PRD compliance:** 7/7 PAUSE-32-* defaults covered (BA gate intentionally skipped per F-031 pattern)
- **Scope creep:** ZERO — all 9 Scope Lock files match 02-manager-plan.md

---

## 📝 Memory diff (apply this session)

### `codebase-map.md`
No change — partners module structure unchanged from F-031 paradigm. New service follows F-031 spec naming so no map update needed.

### `feature-log.md`
- ➕ Counter advanced: `FEATURE-033` next free
- ➕ Appended Shipped row for FEATURE-032 with full implementation summary
- ➕ Removed In-flight row for FEATURE-032 (replaced with SHIPPED marker)

### `change-history.md`
- _(NOT yet appended in this session — Manager note: append entry in next session per change-history convention since this file exceeds Read tool token cap; entry should reference commit `46563e3` and the 13 files changed.)_

### `architecture.md`
No change — Partners domain unchanged. New endpoints follow existing `@Controller('partners')` cluster.

### `conventions.md`
No NEW pattern minted (F-031 "2-step Excel Import UX" already documented). However, lesson learned worth tracking:

**LESSON minted: "Release branch maintenance pre-commit"** — Before appending a new feature to a release branch (e.g. `release/v1.8.0`), Manager MUST verify the release branch is at-or-ahead of `origin/main`. If behind: fast-forward merge `origin/main` into release branch first, then commit feature.

Reason: F-032 caught the symptom — release/v1.8.0 was 2 commits behind main (missing F-030 `f980228` + F-031 `6e30ef9`). Pushing F-032 directly without merge would have deployed PROD with F-032 but WITHOUT F-030/F-031 (silent regression of 5BIB provider config + service catalog import button).

Mitigation: fast-forward merge `origin/main` into release branch before staging F-032 commit. Verify `git log release/v1.8.0..origin/main` is empty before commit.

**Pattern: "Pre-commit release branch parity check"**
```bash
git fetch origin main
git log release/vX.Y.Z..origin/main  # MUST be empty
# If not empty:
git merge --ff-only origin/main      # safe, only succeeds if pure ancestor
# Then commit feature
```

### `known-issues.md`
- ➕ TD-F032-SDK-REGEN (LOW) — admin uses raw fetch via `contracts-api.ts` helpers, not generated SDK. Same as TD-F031-SDK-REGEN. Regen at next SDK rev batch.
- ➕ TD-F032-VN-DIACRITIC (LOW) — entityName dedup is case-sensitive + trim only. No Unicode NFD normalize. Real-world risk LOW (admin copy-paste names verbatim).

---

## 🚀 Next steps after merge

1. **PROD container verify (per TD-CI-001 rule):** Once `deploy-production.yml` finishes (~3-4 min from push), SSH PROD and verify ALL 5 containers updated to `46563e3`:
   - `5bib-result-backend`
   - `5bib-result-admin`
   - `5bib-result-frontend`
   - `5bib-result-crew` (if running)
   - reverse proxy nginx (no container update needed; conf untouched)
2. **Smoke test PROD admin:** Open https://admin.5bib.com/contracts/partners → confirm "Import Excel" button visible in header.
3. **Smoke test backend:** `curl https://result.5bib.com/api/partners/import-template` → expect 200 + xlsx binary or 401 (auth header required).

---

## 🔮 Follow-up cho feature kế tiếp

- Pattern "2-step Excel Import UX" now proven 3x (F-031 services + F-032 partners + earlier F-025 dialog skeleton). Reusable for:
  - Athletes bulk import (future)
  - Sponsors bulk import (future)
  - Race courses checkpoints bulk import (future)
- "Pre-commit release branch parity check" lesson should be added to conventions.md by next Manager session that touches conventions.md.

---

## 🔥 Post-deploy UX hotfix retrospective (2026-05-14)

**Symptom (Danny screenshot):** Dialog preview Import Excel hẹp ~380px trên desktop → table 6-col tràn ngang → cột Phone/Email cut khỏi viewport → "19 hợp lệ" badge wrap 2 dòng.

**2-step hotfix:**

### v1 hotfix `6c6ce8a` (failed)
- Fix flex layout: sticky header/footer + scrollable body
- `<DialogContent className="max-w-6xl w-[min(95vw,1200px)] ...">` + `table-fixed` + truncate cells
- **Vẫn hỏng** — Danny screenshot lại sau deploy, dialog vẫn hẹp.

### v2 hotfix `9c6df03` (success)
- Root cause discovery: admin shadcn `DialogContent` default có `sm:max-w-sm` (384px @ ≥640px). Override `max-w-6xl` (no variant) KHÔNG override `sm:max-w-sm` vì tailwind-merge thấy 2 scope khác → variant class thắng trên desktop.
- Fix: explicit `!` important + matching `sm:` variant: `!max-w-6xl sm:!max-w-6xl !w-[min(95vw,1200px)] sm:!w-[min(95vw,1200px)] !p-0`
- Danny verified OK 2026-05-14.

**3 lessons hardened (recorded in memory):**

1. **Visual QC mandatory pre-merge cho UI feature** — `conventions.md` rule + `known-issues.md` incident log entry 2026-05-14. QC phải mở browser + paste screenshot/DOM snapshot vào `04-qc-report.md` Phase 5. Backend-only feature exempt.

2. **shadcn responsive-variant override anti-pattern** — `conventions.md` anti-pattern row. Khi override shadcn primitive default có `sm:`/`md:`/`lg:` variant trong className, MUST match variant prefix HOẶC use `!important`. Đọc `components/ui/[primitive].tsx` để biết default trước khi override.

3. **Pattern reuse KHÔNG miễn QC** — F-031 dialog đã có sẵn cùng bug (chỉ chưa được phát hiện vì 7-col service-catalog table không tràn dữ liệu test). F-032 copy pattern → double-shipped bug. Mỗi feature có UI vẫn phải visual QC độc lập, không trust pattern reuse.

**Test fixture standard (new):** Mọi spec/manual UAT cho admin form/table phải test với tên VN dài thực tế ≥30 ký tự + diacritics (vd "CÔNG TY TNHH ĐẦU TƯ THƯƠNG MẠI DỊCH VỤ XYZ"), KHÔNG dùng "Co A" / "Item 1" / "Name 1".
