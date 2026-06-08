# FEATURE-076: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-06-08
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md` (🔵 READY)
**Branch:** `5bib_invoice_v1` (cut from `main@b184068`)

---

## 📌 Pre-flight check (Manager đã làm)

- [x] Đọc `00-manager-init.md` đầy đủ
- [x] Đọc `01-ba-prd.md` đầy đủ (~1000 dòng, 31 BR, 30 TC, 7 loại alert)
- [x] Đọc memory: `architecture.md` + `conventions.md` + `known-issues.md` + `codebase-map.md`
- [x] Spot-check code thật **6 file** trước khi APPROVE:
  1. `backend/src/modules/reconciliation/services/reconciliation-query.service.ts:100-131` — cross-DB pattern raw SQL với `?` placeholder + `tenantRepo.manager.query` (named conn `'platform'`)
  2. `backend/src/modules/dashboard/services/dashboard-aggregator.cron.ts` (72 dòng) — cron pattern `@Cron(EVERY_HOUR)` + SETNX lock + try/catch/finally + Logger
  3. `backend/src/modules/app.module.ts:4,187` — `ScheduleModule.forRoot()` đã có ✅ (KHÔNG cần Coder install)
  4. `backend/src/modules/app.module.ts:86,129` — named connection `'platform'` đã wired ✅
  5. `backend/src/config/index.ts:23-29,79,173` — env pattern: PLATFORM_DB_* đã có, TELEGRAM_BOT_TOKEN existing key, TIMING_ALERT_TELEGRAM_CHAT_ID precedent
  6. **`backend/src/modules/notification/telegram.service.ts` (85 dòng) — PRE-EXISTING TelegramService dùng `telegraf` ^4.16.3, `@Global()` module exported** ⭐ **KHÔNG được tạo file mới `telegram-bot.client.ts`**

---

## ✓ PRD Validation Checklist

### Completeness
- [x] **User Stories đầy đủ** với Persona chuẩn (Back-Office Admin + Finance Team Lead, internal-only)
- [x] **Business Rules có ID** (BR-01 → BR-31, 31 rules đánh số rõ ràng)
- [x] **Tất cả PAUSE conditions của Manager (file 00) đã được BA trả lời** (13 PAUSE Tier A #1-5 + Tier B #6-13)
- [x] **UI states đầy đủ** — 10 states (loading/empty/data/filtered/error/submitting/success/409/DEGRADED/UNAVAILABLE)
- [x] **7 loại alert** define rõ trigger/dedup/format từng loại (BR-25 → BR-31)

### Technical correctness vs codebase
- [x] **Cross-DB pattern khớp F-016/F-028**: BR-04 dùng `@InjectRepository(OrderMetadataReadonly, 'platform')` + raw SQL với `?` placeholder
- [x] **Endpoint design phù hợp REST convention hiện tại**: `/api/admin/invoice-reconcile/*` (port `/api/admin/dashboard/*` pattern)
- [x] **Cache key pattern khớp `[resource]:[id]:[variant]`**: `invoice-reconcile:*` namespace clean
- [x] **Named connection `'platform'`** used correctly
- [x] **Generated SDK refresh được gọi sau đổi DTO**: `pnpm --filter admin generate:api` (BR PRD section 3.4)
- [x] **ScheduleModule.forRoot() đã có** — không cần Coder add (verify line 187)
- [x] **`telegraf` package đã install** — không cần Coder `pnpm install`

### ⚠️ Manager Adjustment #1 — REVERTED 2026-06-08 (Option A — Danny chốt)

**Phiên bản cũ:** "REUSE TelegramService" → **SAI**, retract.
**Lý do retract:** Manager đoán nhầm "chung 1 bot". Danny verify PROD env confirm:
- PROD `TELEGRAM_BOT_TOKEN=8568954265:AAE8i...` (bot CLAIM, đang chạy production)
- F-076 dùng bot RIÊNG `8804367165:AAGJx...` (`@invoice_5bib_daily_bot`, Danny tạo riêng chiều 2026-06-08)
- → **2 BOT KHÁC NHAU**, KHÔNG share token được

**Phiên bản mới (Option A — Channel + Bot isolation tuyệt đối):**
- Coder PHẢI tạo file mới `services/invoice-telegram.client.ts` trong module F-076
- HTTP client RIÊNG: axios POST tới `https://api.telegram.org/bot<INVOICE_RECONCILE_TELEGRAM_BOT_TOKEN>/sendMessage`
- Body: `chat_id=INVOICE_RECONCILE_TELEGRAM_CHAT_ID`, `text`, `parse_mode='HTML'`, `disable_web_page_preview=true`
- KHÔNG inject `TelegramService` từ NotificationModule (vì TelegramService hardcode `process.env.TELEGRAM_BOT_TOKEN` — claim bot, KHÔNG phải F-076 bot)
- KHÔNG modify `notification/telegram.service.ts` — giữ nguyên cho claim
- Implement HTML escape + 4096 truncate + 429 retry 1× + 403 throw `TelegramKickedError` → fallback email
- ~80-100 LoC tổng, đơn giản hơn dự kiến vì không cần wrap telegraf SDK

### ⚠️ Manager Adjustment #2 — Env naming + BOT + CHANNEL ISOLATION (Option A final)

PROD VPS env verified 2026-06-08:
| Env hiện hữu | Value | Owner | Status |
|--------------|-------|-------|--------|
| `TELEGRAM_BOT_TOKEN` | `8568954265:AAE8i...` | Claim bot | ✅ PROD running, **KHÔNG ĐỤNG** |
| `TELEGRAM_GROUP_CHAT_ID` | `-5178735117` | Claim group | ✅ PROD running, **KHÔNG ĐỤNG** |
| `TIMING_ALERT_TELEGRAM_CHAT_ID` | (existing nếu set) | Timing alert group | ✅ PROD running, **KHÔNG ĐỤNG** |

F-076 env mới hoàn toàn (Coder add vào `config/index.ts` + `.env.example` + docker-compose):
| Env mới | Value | Purpose |
|---------|-------|---------|
| **`INVOICE_RECONCILE_TELEGRAM_BOT_TOKEN`** | `8804367165:AAGJxs0iGII1znpAw_LUKYM1RXbQ_QrDYbM` | F-076 bot riêng `@invoice_5bib_daily_bot` |
| **`INVOICE_RECONCILE_TELEGRAM_CHAT_ID`** | `-1003743947167` | F-076 supergroup "5BIB Invoice Arlert" |

**⚠️⚠️ CRITICAL — BOT + CHANNEL ISOLATION (Danny mandate 2026-06-08, Option A):**
- F-076 alert MUST gửi từ bot `@invoice_5bib_daily_bot` (token `8804367165`) vào group `-1003743947167` ONLY
- F-076 PHẢI tạo `invoice-telegram.client.ts` mới đọc env `INVOICE_RECONCILE_TELEGRAM_*`
- TUYỆT ĐỐI KHÔNG được:
  - Đụng env `TELEGRAM_BOT_TOKEN` (claim bot, PROD running)
  - Đụng `TELEGRAM_GROUP_CHAT_ID` (claim group, PROD running)
  - Reuse `notification/telegram.service.ts` (vì service hardcode `TELEGRAM_BOT_TOKEN` claim bot)
  - Route F-076 alert sang group claim hoặc timing-alert
  - Modify `notifyClaimSubmitted()`, `notifyClaimResolved()` hoặc bất kỳ logic claim existing
- Coder MUST verify trước smoke test: F-076 env values khác hoàn toàn claim/timing env (grep từng env trên VPS xác nhận)

### ⚠️ Manager Adjustment #3 — Order code display (Danny 2026-06-08)
Mọi alert + UI render `order_metadata.name` (format `#5B<id>IB`, vd `#5B200029416IB`) thay vì `order_metadata.id` raw.
- Backend service logic vẫn dùng `id` cho mapping BR-05 (RefID split, JOIN orderId)
- Response DTO `MissingInvoiceRowDto` thêm field `orderCode: string` mapping từ `order_metadata.name`
- Alert composer + admin UI table render `orderCode`
- SQL filter F-076 SELECT phải bao gồm `o.name AS orderCode` ngoài `o.id`
- BR-05b trong PRD đã được BA add

### Security
- [x] **LogtoAdminGuard** trên tất cả 3 endpoint admin
- [x] **MISA credentials KHÔNG leak** trong response (TC-30 mask)
- [x] **Telegram token + chat_id KHÔNG log** raw (BR security checks)
- [x] **HTML escape user-controlled string** (TC-23b)
- [x] **MISA + Telegram URL hardcode env-only** (TD-CRIT-04 SSRF defense)
- [x] **Rate limit POST /trigger 6/min** qua ThrottlerGuard
- [x] **Audit log emit** `invoice_reconcile.triggered` qua AuditModule

### Performance
- [x] SLA cụ thể: scan tick < 30s race 5K đơn, < 5s race 100 đơn, cache hit < 100ms
- [x] Cache strategy đầy đủ TTL + invalidate rule
- [x] Migration: KHÔNG có (read-only legacy DB)

### Testability
- [x] **30 TC-XX** đánh số rõ + Method/URL/Body/Expected status/Expected shape
- [x] **Concurrency test** TC-29 (Promise.all 10x)
- [x] **10x flaky test** plan có
- [x] **5 TC mới cho Telegram client** (TC-23a-e: happy/HTML escape/truncate/429/403)

---

## 📊 Cross-check với memory

### Architecture impact
- ➕ **NEW module `invoice-reconcile/`** trong `backend/src/modules/` — module 36 (sau F-027 promo-hub-analytics)
- **Cross-DB dependency** MySQL platform `order_metadata` (READ ONLY) — pattern F-016/F-028 reuse
- **Integration mới**: MISA Meinvoice REST API outbound (PROD `api.meinvoice.vn` / sandbox `testapi.meinvoice.vn`)
- **NotificationModule reuse** (`@Global()`) — KHÔNG circular DI
- Architecture diagram sẽ update sau deploy: thêm node `InvoiceReconcileService` + arrow đến MISA API + Telegram

### Convention impact
- **Pattern mới #1 — 3-tier cron**: Scan tick (mỗi 5p) + Hourly recap (tiếng tròn) + EOD recap (21:00). Manager sẽ codify vào `conventions.md` sau deploy nếu pattern shipped clean.
- **Pattern mới #2 — Cross-system reconcile**: Layer 1 DB-side + Layer 2 vendor API-side với 4 bucket classifier (OK/SYNC_LAG/UNISSUED/DUPLICATE). Có thể reuse cho payment gateway reconcile tương lai.
- **Pattern mới #3 — Snapshot diff cho recap**: Hourly recap reuse Redis snapshot tiếng trước để compute diff. Pure function `diff-computer.ts`.

### Known issues impact
- **TD-CRIT-04 SSRF deferred**: MISA URL hardcode env-only — KHÔNG cho admin paste URL. **MITIGATED** by design.
- **TD-F016-FINANCE-01 whitelist lesson**: BR-01 INCLUDE all `order_category NOT IN ('INSURANCE', 'MANUAL')` thay vì 3 hardcoded whitelist như F-016 cũ. **AVOIDED** repeat mistake.
- **Named connection `'platform'` quirk** (known-issues.md): Coder PHẢI `@InjectRepository(OrderMetadataReadonly, 'platform')`. Reinforced in Scope Lock + PAUSE.

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ được thay đổi các file/folder dưới đây. Đụng ngoài = scope creep, phải hỏi Manager.

### Backend (`backend/src/`)

**NEW module:**
- ➕ `modules/invoice-reconcile/invoice-reconcile.module.ts`
- ➕ `modules/invoice-reconcile/invoice-reconcile.controller.ts`
- ➕ `modules/invoice-reconcile/crons/scan-tick.cron.ts`
- ➕ `modules/invoice-reconcile/crons/hourly-recap.cron.ts`
- ➕ `modules/invoice-reconcile/crons/eod-recap.cron.ts`
- ➕ `modules/invoice-reconcile/services/invoice-reconcile.service.ts`
- ➕ `modules/invoice-reconcile/services/misa-meinvoice.client.ts`
- ➕ `modules/invoice-reconcile/services/invoice-alert.service.ts`
- ➕ `modules/invoice-reconcile/services/invoice-telegram.client.ts` ⭐ NEW (Option A) — axios POST tới api.telegram.org dùng `INVOICE_RECONCILE_TELEGRAM_BOT_TOKEN` riêng
- ➕ `modules/invoice-reconcile/services/reconcile-classifier.ts`
- ➕ `modules/invoice-reconcile/services/alert-composer.ts`
- ➕ `modules/invoice-reconcile/services/diff-computer.ts`
- ➕ `modules/invoice-reconcile/services/daily-counters.service.ts`
- ➕ `modules/invoice-reconcile/entities/order-metadata-readonly.entity.ts` (TypeORM `'platform'` connection)
- ➕ `modules/invoice-reconcile/dto/reconcile-report.dto.ts`
- ➕ `modules/invoice-reconcile/dto/missing-invoice-row.dto.ts`
- ➕ `modules/invoice-reconcile/dto/misa-orphan-row.dto.ts`
- ➕ `modules/invoice-reconcile/dto/reconcile-health.dto.ts`
- ➕ `modules/invoice-reconcile/__tests__/reconcile-classifier.spec.ts`
- ➕ `modules/invoice-reconcile/__tests__/invoice-reconcile.service.spec.ts`
- ➕ `modules/invoice-reconcile/__tests__/misa-meinvoice.client.spec.ts`
- ➕ `modules/invoice-reconcile/__tests__/invoice-telegram.client.spec.ts` (5 TC: happy/HTML escape/truncate/429/403)
- ➕ `modules/invoice-reconcile/__tests__/alert-composer.spec.ts`
- ➕ `modules/invoice-reconcile/__tests__/diff-computer.spec.ts`

**Modify (limited scope):**
- ✏️ `modules/app.module.ts` — register `InvoiceReconcileModule` (1 import + 1 entry trong array imports). KHÔNG đụng ScheduleModule (đã có) hoặc TypeOrmModule platform (đã có).
- ❌ `modules/notification/telegram.service.ts` — **REVERTED Manager Adjustment #1**: KHÔNG ĐỤNG. F-076 dùng bot riêng + client riêng (xem `invoice-telegram.client.ts` trong NEW files trên).
- ✏️ `config/index.ts` — thêm env keys:
  ```
  MISA_AIO_BASE_URL, MISA_APP_ID, MISA_TAX_CODE, MISA_USERNAME, MISA_PASSWORD
  INVOICE_RECONCILE_ENABLED_RACES, INVOICE_RECONCILE_AGE_WARN_HOURS, INVOICE_RECONCILE_AGE_CRITICAL_HOURS, INVOICE_RECONCILE_AGE_BREACHED_HOURS
  INVOICE_RECONCILE_TELEGRAM_BOT_TOKEN  ← Manager Adjustment #2 (BOT riêng F-076, KHÔNG dùng TELEGRAM_BOT_TOKEN claim PROD)
  INVOICE_RECONCILE_TELEGRAM_CHAT_ID    ← Manager Adjustment #2 (group riêng F-076)
  INVOICE_ALERT_EMAILS
  ```

### Admin Frontend (`admin/src/`)

**NEW page + components:**
- ➕ `app/(dashboard)/invoice-reconcile/page.tsx` (Server Component shell)
- ➕ `app/(dashboard)/invoice-reconcile/components/InvoiceReconcileClient.tsx`
- ➕ `app/(dashboard)/invoice-reconcile/components/KpiStrip.tsx`
- ➕ `app/(dashboard)/invoice-reconcile/components/MissingRowsTable.tsx`
- ➕ `app/(dashboard)/invoice-reconcile/components/MisaOrphanCollapse.tsx`
- ➕ `app/(dashboard)/invoice-reconcile/components/Layer2StatusBanner.tsx`
- ➕ `app/(dashboard)/invoice-reconcile/components/TriggerButton.tsx`
- ➕ `lib/invoice-reconcile-labels.ts` (BUCKET_LABEL + BUCKET_REASON + LAYER2_STATUS_LABEL)

**Sidebar nav (extend):**
- ✏️ `lib/nav-groups.ts` — thêm entry `invoice-reconcile` vào group "Tài chính" hoặc "Vận hành" (Coder chọn group phù hợp — Manager khuyến nghị nhóm chung với `/reconciliations` + `/finance/pnl`)

**SDK regen (auto):**
- 🔄 `lib/api-generated/types.gen.ts` (auto after `pnpm --filter admin generate:api`)
- 🔄 `lib/api-generated/services.gen.ts` (auto)
- ➕ `lib/api-hooks/use-invoice-reconcile.ts` (TanStack Query wrapper)

### Env files
- ✏️ `backend/.env.example` (DEV reference)
- ✏️ `docker-compose.yml` (env mapping cho backend service nếu Coder cần test local)

### **OUT OF SCOPE — KHÔNG ĐỤNG:**
- ❌ `backend/src/modules/reconciliation/*` (F-016 module — KHÔNG đụng)
- ❌ `backend/src/modules/finance/*` (F-028 module — KHÔNG đụng)
- ❌ `backend/src/modules/notification/notification.module.ts` (chỉ extend `telegram.service.ts`, KHÔNG đụng module wire)
- ❌ `backend/src/modules/notification/mail.service.ts` (email fallback dùng existing API, KHÔNG modify)
- ❌ Bất kỳ migration script MongoDB nào (KHÔNG đụng schema)
- ❌ Bất kỳ schema MongoDB hiện hữu nào
- ❌ MySQL legacy DB schema (READ ONLY, KHÔNG ALTER TABLE)
- ❌ Slack code (PRD bản đầu có, đã override sang Telegram)

---

## 🔧 Tech approach (đề xuất, Coder có thể tinh chỉnh)

### Backend

- **Cron pattern**: port y hệt `dashboard-aggregator.cron.ts` (SETNX lock TTL 4min < 5min cron interval cho scan tick; hourly recap + EOD recap KHÔNG cần lock vì chỉ đọc Redis).
- **MISA client**: dùng `axios` (đã có trong package.json — verify trước implement). Token cache Redis `misa:token` TTL = MISA expiry - 5min. Refresh khi 401 + `TokenExpiredCode`. Retry 3× exp backoff (1s/2s/4s).
- **Cross-DB query**: pattern F-016/F-028 — `this.repo.manager.query(sql, [params])` với `?` placeholder. KHÔNG raw string interpolation từ env.
- **Classifier**: pure function `services/reconcile-classifier.ts` — input `(dbRows, misaInvoices, now)`, output `MissingRow[]`. Pure → 15+ unit test dễ.
- **Diff computer**: pure function reuse Redis snapshot. Compute change events `{type: 'PAID_NEW' | 'ISSUED' | 'AGE_INCREASED', ...}`.
- **Alert composer**: 7 functions pure render HTML (1 per loại). Snapshot test dễ.
- **Alert service**: orchestrator inject `TelegramService` (NotificationModule `@Global()` — không cần import) + retry 429 1× → fallback email.
- **Telegram chat_id**: dùng env `INVOICE_RECONCILE_TELEGRAM_CHAT_ID` (NEW, không dùng global `TELEGRAM_GROUP_CHAT_ID` để tách group F-076 vs claim).

### Frontend

- **Server Component shell** fetch initial từ `GET /today` (Redis cache fast). Hydrate sang Client cho interactive.
- **TanStack Query** poll every 60s (cron 5p nên 60s polling đủ realtime).
- **Display Convention** (CLAUDE.md): backend trả enum raw `bucket: 'UNISSUED'`, frontend map qua dictionary VN.
- **shadcn/ui**: dùng Card + Table + Badge + Button + Alert + Skeleton có sẵn.
- **Date formatting**: `dayjs` với `relativeTime` + `vi` locale — đã có (verify package.json).

### Performance

- Scan tick 5p mỗi tick query MySQL ~5K rows max (race 220 + 140 mỗi ngày) + MISA `/invoice/paging` paginate 100/page → <30s budget OK.
- Hourly recap chỉ đọc Redis snapshot → <1s.
- EOD recap counters aggregate Redis hash → <1s.

---

## 🛑 PAUSE points cho Coder

Trước khi làm các bước sau, Coder DỪNG và confirm với Danny + Manager:

1. **🛑 Trước khi `pnpm install` package mới** — KHÔNG nên cần. Verify `axios` + `dayjs` + `telegraf` đã có. Nếu thiếu lib retry (vd `axios-retry`) → implement manual hoặc hỏi Manager. KHÔNG được install lib mới mà không hỏi.

2. **🛑 Trước khi thêm column DB legacy** — KHÔNG nên cần (BR-02 hardcode env). Nếu Coder muốn add column `races.invoice_enabled` → DỪNG, đây là Phase 2.

3. **🛑 Trước khi đụng file ngoài Scope Lock** — Manager Adjustment #1 đã chốt reuse `TelegramService`. KHÔNG được tạo file mới `telegram-bot.client.ts`. Nếu Coder thấy `TelegramService` không đủ flexible → MUST hỏi Manager update Scope Lock trước.

4. **🛑 Trước khi smoke test PROD lần đầu** — Verify env đã set đầy đủ trên VPS:
   - `MISA_USERNAME=ketoan@5bib.com`
   - `MISA_PASSWORD=<từ 1Password>`
   - `MISA_TAX_CODE=0110398986`
   - `MISA_AIO_BASE_URL=https://api.meinvoice.vn/api/integration` (PROD)
   - `TELEGRAM_BOT_TOKEN=8804367165:AAGJxs0iGII1znpAw_LUKYM1RXbQ_QrDYbM` (đã verify live)
   - `INVOICE_RECONCILE_TELEGRAM_CHAT_ID=-1003743947167` (đã verify live supergroup)
   - `INVOICE_RECONCILE_ENABLED_RACES=140,220`

5. **🛑 Trước khi merge `5bib_invoice_v1` → `main`** — DỪNG, báo Danny + Manager review. CI/CD pipeline DEV deploy tự động sau merge `main` → race 220 mai mở bán cần verify trong giờ ICT.

6. **🛑 Trước khi viết test integration** — Verify Coder hiểu `data` của MISA response là **double-encoded JSON string** (Manager đã verify session). Parse defensive: `JSON.parse(outer.data).PageData` rồi `JSON.parse(...)` lần nữa nếu `PageData` cũng là string. KHÔNG hardcode shape mà không có defensive check.

7. **🛑 Production code KHÔNG hardcode sample data** — Manager đã vi phạm 2026-06-08 khi bịa 3 fake orderId (#200030145/#200030148/#200030200) trong Telegram setup verify message. Danny đã catch và challenge. Coder PHẢI:
   - Mọi MissingRow/MisaOrphan trả về từ classifier MUST derive từ real DB/MISA query result
   - Test fixture trong `*.spec.ts` được phép hardcode orderId (e.g. `200029416`) NHƯNG phải dùng orderId TỒN TẠI THẬT từ verified PROD data (Manager session đã verify race 140 có 200029416/200029420/200029458, race 220 có 200029393/200029396/200029493)
   - KHÔNG được copy demo sample data từ doc/Telegram message vào production constants
   - Snapshot test cho `alert-composer.spec.ts` được phép dùng fixture orderId, NHƯNG comment rõ `// FIXTURE — NOT real data`

---

## 🧪 Unit test BẮT BUỘC (Coder phải viết, QC sẽ check)

Coder không được mark feature `READY_FOR_QC` nếu thiếu các test sau:

### `reconcile-classifier.spec.ts` (pure function, dễ test) — TC-01 → TC-10
- [ ] TC-01: OK bucket — vat_ref set + MISA match
- [ ] TC-02: SYNC_LAG — DB NULL + MISA có invoice gốc
- [ ] TC-03: UNISSUED WARN — age 13h, MISA orphan
- [ ] TC-04: UNISSUED CRITICAL — age 22h
- [ ] TC-05: UNISSUED BREACHED — age 25h
- [ ] TC-06: DUPLICATE — ≥2 invoice gốc cùng orderId
- [ ] TC-07: DUPLICATE EXCLUDE adjustment (ReferenceType=1/2)
- [ ] TC-08: RefID B2C regex filter (B2B GUID excluded)
- [ ] TC-09: Filter INSURANCE + MANUAL khỏi expected
- [ ] TC-10: MISA orphan detection

### `invoice-reconcile.service.spec.ts` — TC-11 → TC-16
- [ ] TC-11: Happy path full flow với mock MySQL + MISA
- [ ] TC-12: Layer 2 timeout → DEGRADED
- [ ] TC-13: Layer 2 all retry exhaust → UNAVAILABLE + alert
- [ ] TC-14: Alert dedup same bucket
- [ ] TC-14b: Alert escalate khi bucket nhảy
- [ ] TC-15: Manual trigger 409 lock held

### `misa-meinvoice.client.spec.ts` — TC-17 → TC-23
- [ ] TC-17: Token cache hit
- [ ] TC-18: Token expired refresh
- [ ] TC-19: 401 TokenExpiredCode retry
- [ ] TC-20: Paging pagination loop
- [ ] TC-21: Defensive parse double-encoded JSON
- [ ] TC-22: Network timeout retry exp backoff
- [ ] TC-23: All retry exhaust throws

### `alert-composer.spec.ts` — TC-23a, TC-23b, TC-23c + 7 snapshot
- [ ] TC-23a: Telegram send happy path
- [ ] TC-23b: HTML escape ngăn injection
- [ ] TC-23c: Truncate 4096 chars
- [ ] TC-23d: Telegram 429 rate limit retry
- [ ] TC-23e: Telegram 403 bot kicked fallback
- [ ] Snapshot test 7 loại alert (BR-25 → BR-31) HTML output

### `diff-computer.spec.ts` — pure diff tests
- [ ] PAID_NEW: đơn mới xuất hiện
- [ ] ISSUED: đơn từ SYNC_LAG → OK
- [ ] AGE_INCREASED: bucket WARN → CRITICAL
- [ ] DUPLICATE_NEW: phát hiện duplicate lần đầu
- [ ] NO_CHANGE: skip alert

### Controller integration — TC-24 → TC-30
- [ ] TC-24: GET /today happy path
- [ ] TC-25: GET /today no auth → 401
- [ ] TC-26: GET /today non-admin → 403
- [ ] TC-27: POST /trigger happy path
- [ ] TC-28: POST /trigger 409 lock held
- [ ] TC-29: Concurrent 10× POST /trigger
- [ ] TC-30: GET /health (mask sensitive)

**Total: ~40 unit/integration tests bắt buộc.**

---

## 📊 Verdict

### ✅ APPROVED — Coder có thể bắt đầu

PRD chi tiết, technical mandates đầy đủ, test plan rõ ràng. Manager đã verify:
- ✅ MISA PROD API live test (255 invoices, mapping rule confirmed)
- ✅ Telegram bot live test (bot `@invoice_5bib_daily_bot`, supergroup `-1003743947167` đã send test message)
- ✅ DB schema 3 query VPS (order_metadata vat_ref column, insurance child orders, CODE_TRANSFER)
- ✅ Pre-existing `TelegramService` (telegraf) — Manager Adjustment #1 reuse
- ✅ Cross-DB pattern F-016/F-028 precedent ready
- ✅ ScheduleModule.forRoot() đã có (line 187)

**3 Manager Adjustments bắt buộc Coder follow:**
1. **(REVERTED Option A)** Tạo `services/invoice-telegram.client.ts` RIÊNG (axios POST sendMessage) — KHÔNG reuse `TelegramService` notification module (vì hardcode `TELEGRAM_BOT_TOKEN` claim bot khác hoàn toàn)
2. Env mới hoàn toàn `INVOICE_RECONCILE_TELEGRAM_BOT_TOKEN` + `INVOICE_RECONCILE_TELEGRAM_CHAT_ID` + BOT + CHANNEL ISOLATION tuyệt đối (KHÔNG đụng `TELEGRAM_BOT_TOKEN` / `TELEGRAM_GROUP_CHAT_ID` claim PROD running)
3. Render `order_metadata.name` (format `#5B<id>IB`) thay vì `id` raw — DTO thêm `orderCode` field

**Branch:** `5bib_invoice_v1` đã cut từ `main@b184068`, untracked file `01-ba-prd.md` đã carry forward.

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] **Yes** — Coder có thể bắt đầu trên branch `5bib_invoice_v1`, theo Scope Lock + 6 PAUSE points + 2 Manager Adjustments trên.

---

## 🔗 Next step

Danny chạy: `/5bib-code FEATURE-076-misa-invoice-daily-reconcile`

Coder phải:
1. Verify đang ở branch `5bib_invoice_v1` (`git branch --show-current`)
2. Đọc 00-manager-init + 01-ba-prd + 02-manager-plan đầy đủ
3. Đọc 6 file Manager spot-check (reconciliation-query, dashboard-aggregator cron, app.module, config/index, telegram.service) — port pattern
4. Follow 6 PAUSE points + 2 Manager Adjustments
5. Implement theo Scope Lock — tuyệt đối không scope creep
6. Viết ~40 unit/integration test trước khi mark READY_FOR_QC
7. Self-Review: grep ALL BR-XX trong PRD verify implementation khớp từng BR (lesson F-062 Wave 2B-1)
