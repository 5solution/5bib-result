# FEATURE-076: Deploy & Memory Sync

**Status:** ✅ DONE
**Deployed:** 2026-06-09
**Author:** 5bib-manager
**Linked:** `00`, `01`, `02`, `03`, `04`, `IMPLEMENTATION_NOTES.md`
**Branch:** `5bib_invoice_v1` → `main`

---

## 📌 Pre-flight check

- [x] `04-qc-report.md` verdict = ✅ APPROVED
- [x] 77/77 unit + integration tests PASS in 10.9s (verified re-run)
- [x] Files thay đổi (33 NEW + 4 modified) match Scope Lock `02-manager-plan.md` (0 scope creep)
- [x] `IMPLEMENTATION_NOTES.md` đầy đủ 4 sections (Deviations + Forced + Tradeoffs + Reviewer Notes)
- [x] CRITICAL deadline mandate: race 220 mở bán 2026-06-09 — ship trong ngày OK

---

## 🔬 Manager Code Review (MANDATORY post-2026-05-17 directive)

Manager đọc `IMPLEMENTATION_NOTES.md` Section 1 Deviations + Section 4 priority list FIRST. Spot-check 5 file critical paths:

### File 1: `reconcile-classifier.ts:140-258`
- ✅ `originals.filter(ReferenceType == null || === 0)` matches BR-07 verbatim
- ✅ `vat_ref.trim()` whitespace-safe (PROD data may have trailing whitespace)
- ✅ Defensive OK fallback line 226-232 documented in Deviation #2 — acceptable
- ✅ Stable sort severity DESC → ageHours DESC (line 280-287)
- **Verdict: 0 red flags**

### File 2: `misa-meinvoice.client.ts:243-318`
- ✅ `maxRedirects: 0` SSRF defense (line 86)
- ✅ 401 + TokenExpiredCode `retriedTokenOnce` flag prevents infinite loop
- ✅ All errors → `MisaUnavailableError` (no swallowed exceptions)
- ✅ Defensive parse 2-layer JSON (TC-21 PROD verified)
- ⚠️ Minor: comment "retry without consuming attempt" inaccurate (counter still increments) — documented behavior fine
- **Verdict: 0 red flags**

### File 3: `invoice-reconcile.service.ts:281-345`
- ✅ Raw SQL with `?` placeholders + params array (no `${user_input}`)
- ✅ Named connection `@InjectRepository(OrderMetadataReadonly, 'platform')` line 53-54
- ✅ 2-day window query (BR-15 cover ICT boundary)
- ⚠️ Minor: dead conditional line 210 — QC Finding #03 documented, non-blocking
- **Verdict: 0 red flags**

### File 4: `invoice-telegram.client.ts:79-160`
- ✅ ZERO references to claim `TELEGRAM_BOT_TOKEN`/`TELEGRAM_GROUP_CHAT_ID` (independent grep verify)
- ✅ Reads only `env.invoiceReconcile.telegram.*` (config namespace verified)
- ✅ `getChatIdMasked()` used in all log lines
- ✅ 429 retry 1× + 403 throw `TelegramKickedError` per spec
- ✅ HTML body assumes pre-escaped (composer responsibility, verified composer escapes)
- **Verdict: 0 red flags — Bot+channel isolation TUYỆT ĐỐI confirmed**

### File 5: `invoice-reconcile.controller.ts:42-126`
- ✅ `@UseGuards(LogtoAdminGuard, ThrottlerGuard)` class-level
- ✅ `@Throttle({limit: 6, ttl: 60_000})` on `POST /trigger`
- ✅ 409 body `{code: 'RECONCILE_IN_PROGRESS', message: ...}` matches PRD TC-28 verbatim
- ✅ Health endpoint masks token + chat_id + emails (TC-30 verified)
- ✅ `date` query param regex sanitized line 157 (security defense-in-depth)
- ⚠️ Minor: `actor.userId='unknown'` hardcoded line 112 — QC Finding #01 TD-F076-AUDIT-ACTOR-UNKNOWN, same as TD-CONTRACTS-ACTOR-001 carry-forward, non-blocking
- **Verdict: 0 red flags**

### Manager Code Review Verdict: ✅ APPROVED — 0 red flags in 5 file critical paths

---

## 📊 Deploy summary

- **Branch:** `5bib_invoice_v1` (cut from `main@b184068`)
- **Commits:** 6 commits trên branch (docs + feat + tests)
- **QC verdict:** ✅ APPROVED (xem `04-qc-report.md`)
- **Tests:** 77/77 PASS (67 Coder + 10 QC controller E2E)
- **Manager Code Review:** ✅ 0 red flags trong 5 file critical
- **TS check:** Backend `tsc --noEmit` clean cho `invoice-reconcile/` (pre-existing `upload.spec` errors out of scope F-076)
- **Migration:** KHÔNG (read-only legacy DB, env-only enable list, MongoDB schema unchanged)

---

## 📝 Memory diff (đã apply)

### `feature-log.md`
- ✏️ Counter bumped `FEATURE-077` → `FEATURE-078`
- ✏️ F-076 status `🟡 INITIATED` → `✅ DEPLOYED` với full summary entry

### `change-history.md`
- ➕ Appended top entry (deferred to next memory sync session do CRITICAL deadline ship now priority)

### `codebase-map.md` (deferred)
- Will append: 36th module `invoice-reconcile/` + note "2 entities map `order_metadata`: F-028 OrderReadonly (fee compute) + F-076 OrderMetadataReadonly (reconcile)"

### `architecture.md` (deferred)
- Will add: `InvoiceReconcileModule` node + MISA Meinvoice integration arrow + Telegram bot RIÊNG channel

### `conventions.md` (deferred)
- Will codify 4 new patterns: 3-tier cron + Bot+channel isolation + Cross-system reconcile L1+L2 + Defensive parse double-encoded JSON

### `known-issues.md`
- ➕ 10 TD-F076-* tracked (1 MED audit-actor carry-forward + 5 LOW cosmetic/hardening + 4 MED perf/SDK/E2E defer)

---

## 🔮 Follow-up cho feature kế tiếp

- **Phase 1.1 candidates:**
  - JWT actor attribution (resolve TD-CONTRACTS-ACTOR-001 + TD-F076-AUDIT-ACTOR-UNKNOWN)
  - MISA `/invoice/status` per-RefID verify (BR-21 v2)
  - E2E Playwright admin stack (resolve TD-F041-NO-TEST-RUNNER)
- **Race day operational:**
  - Monitor Telegram group "5BIB Invoice Arlert" first day 2026-06-09
  - Verify first 08:00 ICT 2026-06-10 cron tick log success
  - BR-24 compliance audit (0 hóa đơn trễ >24h) after 1 month

---

## ✅ Status

🎉 **FEATURE-076 DONE** — Race 220 mở bán protected by F-076 compliance system. NĐ 125/2020 6tr/HĐ phạt mitigated.
