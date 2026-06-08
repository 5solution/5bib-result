# FEATURE-076: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC
**Started:** 2026-06-08
**Completed:** 2026-06-09
**Author:** 5bib-fullstack-engineer
**Linked:** `00`, `01`, `02`
**Branch:** `5bib_invoice_v1`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md`
- [x] Đã đọc `01-ba-prd.md` đầy đủ (~1100 dòng, 31 BR, 30 TC, 7 loại alert)
- [x] Đã đọc `02-manager-plan.md` — verdict ✅ APPROVED + 3 Manager Adjustments + 7 PAUSE points
- [x] Đã đọc `memory/conventions.md` (anti-patterns, Swagger requirements)
- [x] Đã đọc `memory/codebase-map.md` cho `reconciliation/` + `finance/` + `notification/` modules
- [x] Đã đọc code thật 6 file Manager spot-check:
  - `reconciliation/services/reconciliation-query.service.ts:100-131` — cross-DB raw SQL pattern
  - `dashboard/services/dashboard-aggregator.cron.ts` — cron + SETNX lock pattern
  - `app.module.ts:4,187` — ScheduleModule.forRoot() có sẵn ✅
  - `app.module.ts:86,129` — named connection `'platform'` wired ✅
  - `config/index.ts` — Joi env pattern + namespaced config object
  - `notification/telegram.service.ts` — pre-existing claim bot (KHÔNG reuse per Manager Adjustment #1)

---

## 🔍 Impact Assessment (Phase 1)

### Backend
- **MongoDB:** KHÔNG đổi schema. Không add collection mới (audit log emit qua existing AuditLogService).
- **MySQL platform (READ-ONLY):** thêm entity `OrderMetadataReadonly` (`@Entity({ name: 'order_metadata' })`, distinct class name với F-028 `OrderReadonly` per F-037 multi-entity lesson). Map cột: id/race_id/name/email/first_name/last_name/financial_status/internal_status/order_category/payment_on/total_price/vat_ref/vat_create_on. KHÔNG ALTER TABLE.
- **Redis:** 13 new keys (lock + last-run + snapshot + 6 alert dedup + counters + misa token). Namespace `invoice-reconcile:*` clean.
- **NestJS modules:** 1 NEW module `InvoiceReconcileModule`. Conditional load theo platform DB (giống FinanceModule pattern line 132-136). Inject AuditLogService Optional (via explicit AuditModule import), MailService Optional (via @Global NotificationModule).
- **Cron registration:** 3 crons (`scan-tick`, `hourly-recap`, `eod-recap`). `ScheduleModule.forRoot()` already at app.module.ts:187, no additional config needed.

### Frontend
- **Next.js cache:** N/A (admin tool, no public ISR).
- **TanStack Query:** Pattern N/A — `InvoiceReconcileClient` uses native `useState` + `useEffect` + 60s `setInterval` poll (clone Finance F-028 dashboard-client pattern).
- **Boundary:** Page-level `'use client'` gate (RBAC). All sub-components `'use client'` (interactive).

### API Contract
- 3 NEW endpoints under `/api/admin/invoice-reconcile/*`. Hand-typed wrapper `invoice-reconcile-api.ts` (F-028 precedent — `pnpm generate:api` defer post-deploy).
- DTO new fields (`severity`, `breached`, `buyerName`) — additive, no break.

---

## ⚠️ Edge Cases Covered (Phase 2)

- [x] Empty `enabledRaceIds` → return empty report, KHÔNG scan DB (defensive)
- [x] MISA token cached vs expired vs 401 + TokenExpiredCode (TC-17/18/19)
- [x] MISA paging defensive parse double-encoded JSON (TC-21) — verified PROD shape
- [x] MISA all retries exhaust → MisaUnavailableError → alert + layer2Status=UNAVAILABLE (TC-23 + TC-13)
- [x] MISA auth fail (non-TokenExpired 401) → MisaAuthFailError → alert (separate dedup)
- [x] Layer 2 graceful degradation: continue scan with layer2Status flag, Layer 1 always runs
- [x] B2C/B2B RefID regex filter (TC-08) — verified PROD has both 14-digit + legacy slash formats
- [x] INSURANCE/MANUAL category skip (TC-09) — verified DB has INSURANCE child orders
- [x] DUPLICATE excludes replacement/adjustment ReferenceType=1/2 (TC-07)
- [x] Concurrent lock: tryAcquireLock returns false on 2nd call (TC-15) — defensive cron + manual race
- [x] Telegram 429 rate limit → 1× retry (TC-23d)
- [x] Telegram 403 bot kicked → fallback email (TC-23e)
- [x] Empty MISA orphan list → admin UI hides collapse section
- [x] BUCKET_ESCALATED diff only when severity rank increases (test diff-computer)
- [x] EOD recap replaces Hourly Recap 21:00 (eod-alert-sent flag Redis)

---

## 🧠 Logic & Architecture (Phase 3)

**Why 2-tier classifier + diff pure functions:**
- Pure functions = 100% testable không mock. 67/67 tests PASS in ~10s.
- Classifier separate từ scan service: business logic 4 buckets (BR-07) can be reused in future features (vd: Layer 3 RefID-by-RefID verify).
- Diff computer pure: snapshot diff không cần Redis trong unit test.

**Why bot + channel isolation (REVERTED Manager Adjustment #1, Option A):**
- Original plan: REUSE notification/TelegramService. Manager verified PROD env: 2 BOT KHÁC NHAU (claim 8568954265 vs F-076 8804367165).
- Implement: standalone `InvoiceTelegramClient` (axios POST tới api.telegram.org). 80 LoC, no telegraf dependency.
- Security benefit: F-076 token leak → claim bot vẫn safe.

**Why 3-tier cron (scan 5p + hourly tròn + EOD 21:00):**
- Match legacy 5BIB publish 5p cycle (BR-11). Scan tick = source of truth for cache.
- Hourly recap reads cache only (no DB/MISA) → fast (< 1s) + no extra load.
- EOD recap = daily summary cho Finance team end-of-day check, replaces 21:00 Hourly tick via Redis flag.

**Why hand-typed admin API wrapper:**
- F-028 precedent (`finance-api.ts`). `pnpm generate:api` requires backend running locally on full PROD-like env (Logto + MongoDB + Redis + MySQL all up). Defer regen to post-deploy.

---

## 💻 Files Changed

### Backend (`backend/src/`)

**Modify:**
- ✏️ `config/index.ts` — add 11 env keys + namespaced `invoiceReconcile` config object
- ✏️ `modules/app.module.ts` — register `InvoiceReconcileModule` + add `OrderMetadataReadonly` entity

**NEW module (24 files):**

`modules/invoice-reconcile/`:
- ➕ `invoice-reconcile.module.ts`
- ➕ `invoice-reconcile.controller.ts`
- ➕ `crons/scan-tick.cron.ts`
- ➕ `crons/hourly-recap.cron.ts`
- ➕ `crons/eod-recap.cron.ts`
- ➕ `services/invoice-reconcile.service.ts` (core)
- ➕ `services/misa-meinvoice.client.ts`
- ➕ `services/invoice-telegram.client.ts` (BOT RIÊNG)
- ➕ `services/invoice-alert.service.ts` (orchestrator)
- ➕ `services/reconcile-classifier.ts` (pure)
- ➕ `services/alert-composer.ts` (pure HTML)
- ➕ `services/diff-computer.ts` (pure)
- ➕ `services/daily-counters.service.ts`
- ➕ `entities/order-metadata-readonly.entity.ts`
- ➕ `dto/missing-invoice-row.dto.ts`
- ➕ `dto/misa-orphan-row.dto.ts`
- ➕ `dto/reconcile-report.dto.ts`
- ➕ `dto/reconcile-health.dto.ts`
- ➕ `__tests__/reconcile-classifier.spec.ts`
- ➕ `__tests__/diff-computer.spec.ts`
- ➕ `__tests__/alert-composer.spec.ts`
- ➕ `__tests__/invoice-telegram.client.spec.ts`
- ➕ `__tests__/misa-meinvoice.client.spec.ts`
- ➕ `__tests__/invoice-reconcile.service.spec.ts`

### Admin Frontend (`admin/src/`)

**Modify:**
- ✏️ `lib/nav-groups.ts` — add `invoice-reconcile` entry under "Tài chính" group

**NEW:**
- ➕ `lib/invoice-reconcile-api.ts` (hand-typed wrapper)
- ➕ `lib/invoice-reconcile-labels.ts` (VN dictionary)
- ➕ `app/(dashboard)/invoice-reconcile/page.tsx` (page gate)
- ➕ `app/(dashboard)/invoice-reconcile/_components/invoice-reconcile-client.tsx`
- ➕ `app/(dashboard)/invoice-reconcile/_components/kpi-strip.tsx`
- ➕ `app/(dashboard)/invoice-reconcile/_components/missing-rows-table.tsx`
- ➕ `app/(dashboard)/invoice-reconcile/_components/misa-orphan-collapse.tsx`
- ➕ `app/(dashboard)/invoice-reconcile/_components/layer2-status-banner.tsx`

### Env

- ✏️ `backend/.env.example` — add F-076 section (11 keys with PROD values placeholders)

**Total: 33 NEW files + 4 modified files (all within Scope Lock 02-manager-plan.md).**

---

## 🧪 Tests Written

### Unit tests — Backend

**Run command:** `cd backend && npx jest src/modules/invoice-reconcile/__tests__ --no-coverage`

**Test results:**
```
Test Suites: 6 passed, 6 total
Tests:       67 passed, 67 total
Snapshots:   0 total
Time:        10.616 s
```

Per file:

| Spec file | TC count | Coverage |
|-----------|----------|----------|
| `reconcile-classifier.spec.ts` | 24 | TC-01..10 (PRD) + helpers (isB2cRefId, ageBucket4h, deriveSeverity) + stable sort |
| `diff-computer.spec.ts` | 7 | PAID_NEW + ISSUED + BUCKET_ESCALATED + DUPLICATE_NEW + NO_CHANGE + edge cases |
| `alert-composer.spec.ts` | 11 | BR-25..31 (7 loại render) + escapeHtml + formatVnd + truncate (TC-23b/c) |
| `invoice-telegram.client.spec.ts` | 6 | TC-23a + 429 retry + 403 kicked + masking + not-configured |
| `misa-meinvoice.client.spec.ts` | 11 | TC-17 cache hit + TC-18 forced refresh + TC-19 401 retry + TC-20 paging + TC-21 defensive parse + TC-23 exhaust |
| `invoice-reconcile.service.spec.ts` | 8 | TC-11 happy + TC-12/13 layer2 degraded/unavail + TC-15 lock + empty config + auth fail |

**TC coverage vs PRD section 4.1:**
- TC-01 through TC-23 (inclusive 23a-e): ✅ implemented
- TC-14b (alert escalate bucket nhảy): ✅ covered in classifier ageBucket4h + diff-computer BUCKET_ESCALATED
- TC-15/16 lock 409: ✅ covered in service spec
- TC-24..30 controller integration (Nest test bed): ⚠️ DEFERRED — pattern requires full module compile + Logto stub, defer to QC integration phase

### Frontend E2E

DEFERRED — admin doesn't have Playwright stack (pre-existing TD-F041-NO-TEST-RUNNER). 10 E2E test cases documented in PRD 4.2 — QC implement via Playwright when stack added Phase 1.1.

---

## 🛑 PAUSE/Confirmation log

| Date | What | Result |
|------|------|--------|
| 2026-06-09 | Verify deps installed: axios + dayjs + nestjs/schedule + nestjs/typeorm + ioredis + telegraf | ✅ All present in package.json (no install needed) |
| 2026-06-09 | Verify ScheduleModule.forRoot() in app.module.ts:187 | ✅ Present |
| 2026-06-09 | Verify named conn 'platform' wired app.module.ts:86 | ✅ Present |
| 2026-06-09 | Self-rejected: original plan to reuse TelegramService | Manager Adjustment #1 REVERTED — created RIÊNG invoice-telegram.client.ts |

PAUSE point #1-#7 (Scope Lock + Manager Adjustments):
- ✅ No `pnpm install` mới
- ✅ No DB column add to legacy
- ✅ Bot + channel isolation tuyệt đối (env riêng INVOICE_RECONCILE_TELEGRAM_*)
- ✅ Render order_metadata.name not id (DTO field `orderCode`)
- ✅ MISA defensive parse double-encoded JSON (TC-21)
- ✅ No hardcoded sample data in production code

---

## 🚧 Scope creep / Out-of-Scope changes

- [x] **Không có scope creep**
- All 4 modified files + 33 NEW files within Scope Lock per `02-manager-plan.md`

---

## 🐛 Known limitations / Tech debt còn lại

- **TD-F076-SDK-REGEN**: `pnpm --filter admin generate:api` deferred — pattern F-028 precedent. Re-run post backend deploy to PROD.
- **TD-F076-E2E-PLAYWRIGHT**: 10 E2E tests deferred per pre-existing TD-F041-NO-TEST-RUNNER. Document only.
- **TD-F076-CONCURRENT-10X-NEST-TESTBED**: TC-29 (concurrent 10× POST /trigger) deferred — needs Nest test bed full compile, QC integration phase.
- **TD-F076-PERF-SLA-MEASURE**: p95 SLAs in PRD 4.4 not empirically measured — QC measure post-deploy với curl `-w` or k6.
- **TD-F076-MISA-STATUS-PHASE11**: BR-21 MISA `/invoice/status` per-RefID verification (Phase 1.1) — Layer 2 dùng `/invoice/paging` only for v1.
- **TD-F076-EOD-VPS-DOWN-RECOVERY**: nếu VPS down 21:00 → EOD miss, Hourly 08:00 hôm sau cover diff đêm qua (BR-23). Defer cron miss state machine Phase 2.
- **TD-F076-RACE-220-MORNING**: race 220 mở bán sáng 2026-06-09 — Manager smoke test mandatory before broadcast.

---

## ✅ Status

- [ ] IN_PROGRESS
- [x] **READY_FOR_QC** 🟠

### Self-Review Pipeline 11 bước

- [x] **Bước 1**: `npx tsc --noEmit` exit 0 cho `backend/src/modules/invoice-reconcile/` (pre-existing upload.spec out of scope)
- [x] **Bước 2**: PRD strict adherence audit — all 5 PRD tables matched (form/buttons/UI steps/endpoints/TC-XX)
- [x] **Bước 3**: Anti-pattern scan clean (0 console.log, 0 `: any`, 1 `as unknown as` documented in IMPLEMENTATION_NOTES, 0 TODO/FIXME)
- [x] **Bước 4**: Hand-pick field mapping audit clean (single mapDbRow, all fields preserved)
- [x] **Bước 5**: PROD-readiness smoke test deferred to Manager (admin not local)
- [x] **Bước 6**: UI/UX self-inspection — VN labels, sticky filter, empty/error/loading states
- [x] **Bước 7**: Real-world data sanity — real PROD orderIds verified Manager session (200029420/200029416 race 140)
- [x] **Bước 8**: Files Changed vs Scope Lock — 0 scope creep
- [x] **Bước 9**: Generated SDK regen DEFERRED (hand-typed wrapper per F-028 precedent)
- [x] **Bước 10**: Unit tests PASS (67/67)
- [x] **Bước 11**: `IMPLEMENTATION_NOTES.md` written with 4 sections

→ Status: 🟠 **READY_FOR_QC**

---

## 🔗 Next step

Danny chạy: `/5bib-qc FEATURE-076-misa-invoice-daily-reconcile`

QC sẽ:
1. Đọc `01-ba-prd.md` để compare với code thật
2. Đọc `IMPLEMENTATION_NOTES.md` Section 4 first (reviewer's guide)
3. Phase 1: Impact & Regression Audit (verify no break to F-028 OrderReadonly, no break claim TelegramService)
4. Phase 2: Security Threat Model (verify SSRF + token leak + HTML injection mitigations)
5. Phase 3: Write E2E tests (TC-24..30 controller, TC-29 concurrent 10×)
6. Phase 4: Execute tests + measure performance
7. Phase 5: BR-coverage audit (31 BR verified)
8. Phase 6: Persona walkthrough (Back-Office Admin + Finance Lead via Telegram preview)
