# FEATURE-079: PRD — F-076 Heartbeat Recap 2h/lần

**Status:** 🔵 READY
**Last updated:** 2026-06-09
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` đầy đủ (5 PAUSE-79-* + 3 risk flag + impact map backend-only)
- [x] Đã đọc `memory/codebase-map.md` phần `invoice-reconcile/` (vừa golive F-076 sáng nay)
- [x] Đã đọc `memory/known-issues.md` — KHÔNG có issue trên invoice-reconcile (mới ship)
- [x] Đã spot-check code thật:
  - `invoice-alert.service.ts:104-114` `sendHourlyRecap` skip condition BR-25
  - `alert-composer.ts:84-131` `composeHourlyRecap` Telegram HTML template hiện tại
  - `hourly-recap.cron.ts:22-25` cron schedule `'0 0 8-20 * * *'`
  - `invoice-reconcile.service.ts:223-249` `runHourlyRecap` orchestrator
  - PROD log: 47 tick chạy đều từ 10:00 ICT, tất cả `missing=0 sent=false` → confirm BR-25 skip đang hoạt động đúng spec

---

## 📝 F-076 Heartbeat Recap — đảm bảo Telegram bot visibility 2 tiếng/lần

**Goal:** Relax F-076 BR-25 "skip-when-OK" condition để bot `@invoice_5bib_daily_bot` gửi tin định kỳ 2 tiếng/lần kể cả khi tất cả đơn đã xuất hóa đơn OK. Mục đích: Danny + Hiền có visibility cron vẫn alive + race 220 đang bán vé invoice flow healthy, KHÔNG phải đoán "im lặng = OK hay im lặng = chết".

**Scope:**

✅ **In scope:**
- Backend `invoice-reconcile` module: relax skip condition trong `sendHourlyRecap` + augment `composeHourlyRecap` để render "✅ All OK" section khi `missing=0` + đổi cron schedule từ `'0 0 8-20 * * *'` (13 tick/ngày) → `'0 0 8,10,12,14,16,18,20,22 * * *'` (8 tick/ngày — tròn giờ chẵn).
- **Race title resolution (Danny update 2026-06-09 14:15):** Thay vì hiện "race 220" trong tin Telegram, hiện `{tên giải} - {race_id}` (vd: `LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG - 220`). Reuse Redis cache pattern F-049 `races:title:byMysqlId:<mysql_race_id>` TTL 3600s (1h).
- Update spec tests cho composer + cron + service + race title resolver.
- Smoke test mandatory post-deploy: trigger manual + verify 1 cron tick gửi tin "All OK" với race title hiển thị đúng + verify 7 loại alert existing không regress.

❌ **Out of scope:**
- Frontend UI change (KHÔNG có UI mới — admin dashboard `/invoice-reconcile` F-076 vẫn render data, không liên quan).
- Endpoint API mới (KHÔNG thêm endpoint).
- Schema DB mới (KHÔNG đụng). MySQL `races.title` chỉ READ, KHÔNG đụng cấu trúc.
- Telegram bot/chat config mới (reuse `@invoice_5bib_daily_bot` + chat hiện tại).
- Fix TZ boundary bug `TD-F079-TZ-BOUNDARY-FILTER` (DB 23 ORDINARY today vs F-076 expected=22 lệch 1 đơn cross-midnight ICT 04:14) — defer feature riêng sau, non-critical.
- Per-race heartbeat split (giữ semantic recap gộp toàn cục như BR-25, NHƯNG có hiển thị race title — BR-79-20).
- Notification channel mới (KHÔNG email / KHÔNG SMS — chỉ Telegram như F-076).
- Dedup logic cho heartbeat (KHÔNG cần — cron schedule chính xác, mỗi tick = mỗi 2h, đảm bảo no duplicate).
- Logto/RBAC change (zero impact, không động).
- `sendWarn` / `sendCritical` / `sendBreached` / `sendDuplicate` / `sendMisaHealth` / `sendEodRecap` (6 loại alert khác F-076 — giữ NGUYÊN logic). Race title resolver KHÔNG áp dụng cho 6 loại này trong F-079 (defer feature riêng nếu cần consistency).

---

## 👤 User Stories & Business Rules

### User Stories

- **US-01.** As a **5BIB Back-Office Admin (Danny)**, I want to **nhận tin Telegram từ `@invoice_5bib_daily_bot` mỗi 2 tiếng trong khung 8h-22h ICT kể cả khi tất cả đơn OK** so that **tôi yên tâm cron F-076 vẫn alive + race 220 đang bán vé invoice flow healthy**.

- **US-02.** As a **5BIB Back-Office Admin (Hiền — kế toán)**, I want to **đọc nội dung tin heartbeat thấy số đơn expected + issued + missing + skipped** so that **tôi nắm tình hình thanh toán hàng giờ + biết khi nào cần kiểm tra thủ công**.

- **US-03.** As a **5BIB Back-Office Admin (Danny)**, I want to **khi có `missing > 0` hoặc có diff event so với 2h trước thì tin heartbeat tự động chuyển sang format alert chi tiết** so that **tôi nhận thông tin actionable thay vì chỉ "All OK" generic**.

- **US-04.** As a **5BIB Back-Office Admin**, I want to **6 loại alert F-076 còn lại (WARN/CRITICAL/BREACHED/DUPLICATE/MISA Health/EOD Daily) tiếp tục hoạt động bình thường** so that **F-079 không gây regression cho F-076 vừa golive sáng nay**.

### Business Rules

#### Cron schedule

- **BR-79-01.** Cron `hourly-recap.cron.ts` đổi expression từ `'0 0 8-20 * * *'` (13 tick: 08,09,...,20) → `'0 0 8,10,12,14,16,18,20,22 * * *'` (8 tick: 08, 10, 12, 14, 16, 18, 20, 22 ICT). Timezone `Asia/Ho_Chi_Minh` giữ NGUYÊN.
- **BR-79-02.** Tick 22:00 ICT giữ NGUYÊN trong list mặc dù sau EOD 21:00 — nội dung khác (heartbeat = current snapshot; EOD = full-day counters). Mỗi 2 tiếng đầy đủ, nhất quán.
- **BR-79-03.** Cron name + TZ giữ NGUYÊN: `name: 'invoice-reconcile-hourly-recap'`, `timeZone: 'Asia/Ho_Chi_Minh'`. Đổi rename = break ScheduleRegistry, KHÔNG được phép.

#### Send-always semantics (relax BR-25 skip)

- **BR-79-04.** Trong `invoice-alert.service.ts` method `sendHourlyRecap()`, BỎ điều kiện skip:
  ```
  Cũ: if (report.missingCount === 0 && diffEvents.length === 0) return false;
  Mới: (xóa toàn bộ block skip — luôn gửi)
  ```
- **BR-79-05.** Sau relax skip: hàm trả `true` nếu Telegram dispatch thành công, `false` nếu Telegram fail (network / rate limit). Semantic `sent` field trong log giữ NGUYÊN ý nghĩa "đã gửi Telegram?".
- **BR-79-06.** KHÔNG dùng Redis dedup cho heartbeat (Manager đề xuất PAUSE-79-04). Cron schedule đảm bảo 2h/lần không trùng — không cần defense.

#### Composer template

- **BR-79-07.** `composeHourlyRecap()` trong `alert-composer.ts` THÊM nhánh render khi `missingCount === 0 && diffEvents.length === 0` (state "All OK"):
  - Header: `📊 <b>5BIB Invoice Heartbeat — HH:MM ICT YYYY-MM-DD</b>` (đổi "Recap" → "Heartbeat" cho phân biệt với case có issue)
  - Status line: `✅ <b>All OK</b> — N/N đơn ORDINARY đã xuất hóa đơn MISA` (N = issuedCount)
  - Stats block:
    ```
    Expected:  N đơn
    Issued:    N đơn (vat_ref đầy đủ)
    Missing:   0 đơn
    Duplicate: 0 đơn
    Skipped (INSURANCE/MANUAL): N đơn
    ```
  - Footer: `🕐 Next heartbeat: HH:MM ICT` + link dashboard
- **BR-79-08.** `composeHourlyRecap()` THÊM nhánh render khi `missingCount === 0 && diffEvents.length > 0` (state "All OK + có diff"):
  - Header dùng "Heartbeat" như BR-79-07
  - Status `✅ All OK` như BR-79-07
  - Stats block như BR-79-07
  - Thêm block `<b>Diff vs 2h trước:</b>` + render `formatDiffEvent` như logic hiện tại (line 111-122 alert-composer.ts)
  - Footer như BR-79-07
- **BR-79-09.** `composeHourlyRecap()` khi `missingCount > 0` (state "Có issue") — giữ NGUYÊN logic hiện tại line 91-130 alert-composer.ts với 1 đổi nhỏ:
  - Header có thể đổi "Recap" → "Heartbeat + Alert" để consistent branding, HOẶC giữ "Recap" — Coder quyết định khi implement (cosmetic, không phải BR cứng).
- **BR-79-10.** Header time format dùng `formatTimeIct(report.runAt)` existing — KHÔNG đổi helper.
- **BR-79-11.** "Next heartbeat" footer compute: nếu hour hiện tại ∈ {8,10,12,14,16,18,20}, next = hour + 2; nếu hour = 22, next = `08:00 (ngày hôm sau)`. Hardcode mapping đơn giản — không cần lib date.
- **BR-79-12.** `Skipped (INSURANCE/MANUAL)` count = `expectedCount` (post-filter) trừ `issuedCount`? KHÔNG — cần expose riêng. Đề xuất Coder: thêm field `skippedCount` vào `ReconcileReportDto` HOẶC compute inline trong composer từ raw data. **Manager confirm khi `/5bib-plan`:** nếu phải đổi DTO `ReconcileReportDto` → BREAKING SDK change → cần regen `pnpm generate:api`. **Đề xuất BA:** giữ DTO, compute inline trong composer (Coder pass raw count vào).
  - Edit clarification: classifier-output đã có `expectedCount` (after filter) + `issuedCount`. `skippedCount` = trước filter - sau filter = `dbOrders.length - expectedCount`. Classifier line 301-303 `expectedCount: dbOrders.filter(o => !SKIP_CATEGORIES.has(o.orderCategory)).length`. Coder cần expose `dbOrders.length` riêng HOẶC tính `skippedCount = dbOrders.length - expectedCount`. Đề xuất: thêm field `skippedCount: number` vào `ReconcileReportDto` (BACKWARD COMPAT — field optional cho old report).

#### Service orchestration

- **BR-79-13.** `runHourlyRecap()` trong `invoice-reconcile.service.ts` line 223-249 giữ NGUYÊN logic compute diff + cache snapshot. Chỉ thay đổi: `sendHourlyRecap` call (sub-method) sẽ luôn return true khi Telegram OK (không skip).
- **BR-79-14.** Snapshot cache key `master:rr-snapshot:<raceId>` (15s TTL) giữ NGUYÊN — heartbeat compare diff vs snapshot mới nhất như existing.

#### Race title resolution (NEW — Danny update 2026-06-09 14:15)

- **BR-79-20.** Tin Telegram (cả 3 state — All OK / All OK + diff / Có issue) MUST hiển thị race title thay vì chỉ race_id. Format: `{title} - {race_id}` (vd: `LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG - 220`). Áp dụng tại:
  - Status line "All OK" (BR-79-07): `✅ <b>All OK</b> — Giải <b>{title} - {race_id}</b> — N/N đơn ORDINARY đã xuất hóa đơn MISA`
  - Block "Diff vs 2h trước" (BR-79-08): mỗi line diff event với race-scoped vẫn hiển thị title compact, vd `+ Đơn mới <code>#5B...IB</code> (Giải LÀO CAI MARATHON 2026... - 220, 500.000đ)`. Vẫn truncate ≤ 10 events như BR-25 hiện tại.
  - State "Có issue" (BR-79-09): hiển thị title trong header HOẶC trong từng missing row (Coder tinh chỉnh khi implement — KHÔNG đụng layout 4 line stats hiện tại).
- **BR-79-21.** Resolve race title qua **Redis cache reuse F-049 pattern**: key `races:title:byMysqlId:<mysql_race_id>` TTL 3600s (1h). Cache miss → query MySQL platform `SELECT race_id, title FROM races WHERE race_id = ?` (parameterized, named connection `'platform'`) → SET Redis → return.
- **BR-79-22.** Title compute thực hiện trong service layer (`InvoiceReconcileService` hoặc helper riêng `RaceTitleResolver`), **KHÔNG** trong composer pure function. Composer receive `raceTitlesByid: Map<number, string>` từ caller. Lý do: giữ composer pure, không inject deps DB/Redis.
- **BR-79-23.** Defensive fallback: nếu race title không resolve được (DB drop, Redis fail, race_id không tồn tại) → fallback hiển thị `Race {race_id}` (vd `Race 220`). KHÔNG block alert flow — heartbeat MUST gửi đều mỗi 2h kể cả khi DB/Redis hiccup.
- **BR-79-24.** Title escape HTML qua `escapeHtml()` existing helper trong `alert-composer.ts`. Race title chứa diacritics + dấu gạch ngang + đôi khi dấu `<>` → MUST escape để Telegram render HTML không lỗi.
- **BR-79-25.** Title max length render: nếu `title.length > 80` → truncate `title.slice(0, 77) + '...'` trước khi thêm `- {race_id}`. Tránh tin Telegram quá dài, race title PROD verified `"LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG"` = 47 ký tự — under threshold, OK. Defensive cho future giải dài hơn.

#### Zero regression promise

- **BR-79-15.** 6 loại alert khác F-076 GIỮ NGUYÊN 100%:
  - WARN bucket escalation (12h ≤ age < 20h)
  - CRITICAL (20h ≤ age < 24h)
  - BREACHED (age ≥ 24h)
  - DUPLICATE
  - MISA Health
  - EOD Daily Recap (21:00 ICT)
- **BR-79-16.** Cron `scan-tick.cron.ts` (5 phút/lần) KHÔNG đụng.
- **BR-79-17.** Cron `eod-recap.cron.ts` (21:00 ICT) KHÔNG đụng.

#### Race-day operational

- **BR-79-18.** Smoke test post-deploy MUST verify trong vòng 5 phút sau deploy:
  - 1 cron tick `scan-tick` chạy log OK
  - Trigger manual `POST /api/admin/invoice-reconcile/trigger` (test-only) — verify Telegram nhận alert flow normal
  - Verify next scheduled hourly-recap tick (nếu trong khung 8-22) gửi tin "All OK" với format mới
- **BR-79-19.** Race 220 đang bán vé hôm nay 2026-06-09 — deploy WINDOW nên tránh giờ peak transaction. Manager + Danny chốt window khi `/5bib-deploy` (đề xuất sau 20:00 ICT — sau khung peak ICT 19:00-20:00 evening sales).

---

## 🖥️ UI/UX Flow

**KHÔNG CÓ UI MỚI.** Feature backend-only.

### Telegram message format (output spec)

Mặc dù không phải UI web, Telegram message là user-facing output → spec chi tiết:

#### State 1: "All OK" (missing=0, no diff) — Heartbeat thuần

```html
📊 <b>5BIB Invoice Heartbeat — 14:00 ICT 2026-06-09</b>

✅ <b>All OK</b> — Giải <b>LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG - 220</b>
23/23 đơn ORDINARY đã xuất hóa đơn MISA

Expected:  23 đơn
Issued:    23 đơn (vat_ref đầy đủ)
Missing:   0 đơn
Duplicate: 0 đơn
Skipped (INSURANCE/MANUAL): 2 đơn

🕐 Next heartbeat: 16:00 ICT
🔗 <a href="https://result.5bib.com/invoice-reconcile">Mở dashboard</a>
```

#### State 2: "All OK + có diff" (missing=0, có PAID_NEW / ISSUED event)

```html
📊 <b>5BIB Invoice Heartbeat — 14:00 ICT 2026-06-09</b>

✅ <b>All OK</b> — Giải <b>LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG - 220</b>
25/25 đơn ORDINARY đã xuất hóa đơn MISA

Expected:  25 đơn
Issued:    25 đơn (vat_ref đầy đủ)
Missing:   0 đơn
Duplicate: 0 đơn
Skipped (INSURANCE/MANUAL): 2 đơn

<b>Diff vs 2h trước:</b>
  + Đơn mới <code>#5B200029534IB</code> (LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG - 220, 500.000đ)
  + Đơn mới <code>#5B200029535IB</code> (LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG - 220, 350.000đ)
  ✅ Đã xuất <code>#5B200029530IB</code> (InvNo 00000043)

🕐 Next heartbeat: 16:00 ICT
🔗 <a href="https://result.5bib.com/invoice-reconcile">Mở dashboard</a>
```

#### State 3: "Có issue" (missing > 0) — GIỮ NGUYÊN BR-25 4-line stats, THÊM giải title

```html
📊 <b>5BIB Invoice Recap — 14:00 ICT 2026-06-09</b>
Giải: <b>LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG - 220</b>

🟢 OK:        <b>23</b> đơn (đã xuất + match MISA)
🟡 SYNC_LAG:  <b>1</b> đơn (DB chưa update vat_ref)
🔴 UNISSUED:  <b>2</b> đơn (max age 18h)
🔥 DUPLICATE: <b>0</b> đơn

<b>Diff vs 2h trước:</b>
  + Đơn mới <code>#5B...IB</code> (LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG - 220, ...)
  ⚠️ Quá hạn <code>#5B...IB</code> ...

📌 Cần action: <b>1</b> critical (age ≥ 20h)
🔗 <a href="https://result.5bib.com/invoice-reconcile">Mở dashboard</a>
```

> **Multi-race note:** Hiện F-076 scope MVP enable race_id 140 (test) + 220 (live). Khi 1 tick có cả 2 race active, header "Giải" repeat per race OR gộp 1 line "Giải: X (race_id), Y (race_id)". Coder chọn layout đẹp khi implement — đảm bảo cả 2 race title hiện rõ KHÔNG ngầm bỏ.

### UI States (cho output Telegram, KHÔNG phải web)

- **State Loading:** N/A (cron-driven, no user trigger)
- **State Empty:** N/A (heartbeat luôn có data — KHÔNG bao giờ render empty)
- **State Data → 3 variant:** All OK / All OK + diff / Có issue (3 spec trên)
- **State Error fetch:** Nếu MISA timeout hoặc Redis fail trong `runHourlyRecap()` → cron log `[hourly-recap] fail date=X: <error>` + KHÔNG gửi Telegram (existing behavior). Manager + Danny check log nếu 2h liên tiếp không nhận tin.
- **State Submitting:** N/A
- **State Success:** Telegram nhận tin (visible)
- **State Validation error:** N/A (no input)
- **State Confirm dialog:** N/A

---

## 🛠️ Technical Mandates

### 3.1 DB / Cache changes

- **MongoDB:** ZERO change
- **MySQL platform:** **READ-ONLY query mới** — `SELECT race_id, title FROM races WHERE race_id = ?` qua named connection `'platform'`. Reuse TypeORM entity `RaceReadonly` nếu existing (verify F-049 / F-068), HOẶC `manager.query()` raw với `?` placeholder. ZERO schema change.
- **Redis:** **Reuse cache key F-049 pattern** `races:title:byMysqlId:<mysql_race_id>` TTL 3600s (1h). KHÔNG conflict (F-049 dùng cho identity cluster admin endpoint enrichment, F-079 chỉ READ — share cache với F-049 = OK).
- **S3:** ZERO change
- **Migration:** KHÔNG cần

### 3.2 Backend Endpoint Specification

**KHÔNG có endpoint mới.** Feature pure cron-driven background job.

3 endpoint F-076 existing GIỮ NGUYÊN:
- `GET /api/admin/invoice-reconcile/today` (cached report)
- `POST /api/admin/invoice-reconcile/trigger` (manual scan)
- `GET /api/admin/invoice-reconcile/health` (env masked)

Smoke test post-deploy gọi 3 endpoint này — KHÔNG đổi behavior.

### 3.3 DTO Field-Level Spec

**Đổi DTO:** `ReconcileReportDto` thêm field `skippedCount`:

```typescript
// backend/src/modules/invoice-reconcile/dto/reconcile-report.dto.ts

export class ReconcileReportDto {
  // ... existing fields giữ NGUYÊN: date, runAt, expectedCount, issuedCount,
  //     atRiskCount, breachedCount, duplicateCount, missingCount,
  //     missing, orphan, healthy ...

  @ApiPropertyOptional({
    description:
      'F-079 BR-79-12 — Số đơn skip khỏi expected pool (INSURANCE/MANUAL category).' +
      ' = dbOrders.length - expectedCount. Default 0 nếu old report chưa expose.',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  skippedCount?: number;
}
```

Backward compat: field `optional` để old cached report (Redis) trước F-079 không break parse. Composer dùng `report.skippedCount ?? 0` defensive.

**Classifier output** (`reconcile-classifier.ts:74-89`) cũng thêm field tương ứng:

```typescript
export interface ClassifierOutput {
  // ... existing ...
  /** F-079 — Số đơn skip BR-01 (INSURANCE/MANUAL) trong dbOrders input. */
  skippedCount: number;
}
```

`classify()` line 274 set `skippedCount = dbOrders.length - expectedCount` (compute từ input vs filtered).

### 3.4 Frontend / Admin (Next.js)

**ZERO change.** Admin dashboard `/invoice-reconcile` page F-076 KHÔNG đụng. Frontend render data từ `GET /today` qua generated SDK — DTO mới có thêm `skippedCount` optional → existing UI ignore safely. KHÔNG cần `pnpm generate:api`.

**Edit clarification:** Nếu Manager `/5bib-plan` chốt cần expose `skippedCount` trong dashboard UI → mở feature riêng (out of scope F-079). F-079 chỉ ship backend.

### 3.5 PAUSE flags

- 🛑 **PAUSE-Coder-79-01:** TRƯỚC khi đổi `ReconcileReportDto` (BR-79-12), confirm với Manager xem có break frontend rendering không. Mặc dù field optional, Coder verify SDK regen không gây vỡ build admin.
- 🛑 **PAUSE-Coder-79-02:** TRƯỚC khi deploy PROD → smoke test BR-79-18 đầy đủ + verify cron tick mới `'0 0 8,10,12,14,16,18,20,22 * * *'` parse đúng (cron expression comma-list syntax — Coder test local trước).
- 🛑 **PAUSE-Coder-79-03:** Deploy WINDOW — Danny + Manager chốt khi `/5bib-deploy`. Đề xuất sau 20:00 ICT tránh peak transaction race 220 đang bán.
- 🛑 **PAUSE-Coder-79-04:** KHÔNG đụng 6 loại alert khác F-076 + 2 cron khác (scan-tick + eod-recap). Scope chỉ hourly-recap.
- 🛑 **PAUSE-Coder-79-05 (NEW Danny update 14:15):** Race title resolver — TRƯỚC khi viết, check codebase existing F-049 / F-068 xem đã có helper `RaceTitleResolver` hoặc service tương đương chưa (grep `races:title:byMysqlId`). Nếu CÓ → reuse, KHÔNG tạo trùng. Nếu CHƯA → tạo mới trong `invoice-reconcile/services/` hoặc `common/services/` (Coder chọn vị trí phù hợp pattern existing).

---

## 🛡️ Testing Mandates

### 4.1 Backend Test Cases TC-XX

#### TC-79-01 Composer "All OK" state

| Element | Value |
|---------|-------|
| Method | Unit test |
| Function | `composeHourlyRecap(report, diffEvents=[], dashboardUrl)` |
| Input | `report = { missingCount: 0, issuedCount: 23, expectedCount: 23, duplicateCount: 0, skippedCount: 2, runAt: <Date 14:00 ICT>, date: '2026-06-09', missing: [] }` + `diffEvents = []` |
| Expected output | HTML string chứa: `📊 <b>5BIB Invoice Heartbeat — 14:00 ICT 2026-06-09</b>`, `✅ <b>All OK</b> — 23/23 đơn ORDINARY`, `Expected:  23 đơn`, `Issued:    23 đơn`, `Missing:   0 đơn`, `Skipped (INSURANCE/MANUAL): 2 đơn`, `🕐 Next heartbeat: 16:00 ICT` |
| MUST NOT contain | `🔴 UNISSUED`, `🟡 SYNC_LAG` (no issue section) |
| Side effect | None (pure function) |

#### TC-79-02 Composer "All OK + diff" state

| Element | Value |
|---------|-------|
| Method | Unit test |
| Function | `composeHourlyRecap(report, diffEvents, dashboardUrl)` |
| Input | `report = { missingCount: 0, issuedCount: 25, ... }` + `diffEvents = [{ type: 'PAID_NEW', orderCode: '#5B200029534IB', raceId: 220, totalPrice: 500000 }]` |
| Expected output | Same as TC-79-01 + thêm block `<b>Diff vs 2h trước:</b>` + line `+ Đơn mới <code>#5B200029534IB</code> (race 220, 500.000đ)` |
| MUST NOT contain | `🔴 UNISSUED` |

#### TC-79-03 Composer "Có issue" state (regression check)

| Element | Value |
|---------|-------|
| Method | Unit test |
| Function | `composeHourlyRecap(report, diffEvents, dashboardUrl)` |
| Input | `report = { missingCount: 3, issuedCount: 20, atRiskCount: 1, duplicateCount: 0, missing: [{ bucket: 'UNISSUED', ageHours: 18 }, { bucket: 'SYNC_LAG' }, { bucket: 'UNISSUED', ageHours: 22 }], ... }` |
| Expected output | Format GIỮ NGUYÊN BR-25 hiện tại: `🟢 OK: 20`, `🟡 SYNC_LAG: 1`, `🔴 UNISSUED: 2 (max age 22h)`, `📌 Cần action: 1 critical` |
| MUST NOT regress | Existing 4 line stats (OK/SYNC_LAG/UNISSUED/DUPLICATE) |
| Side effect | None |

#### TC-79-04 Next heartbeat compute

| Element | Value |
|---------|-------|
| Method | Unit test |
| Helper | Inline trong `composeHourlyRecap` (hoặc tách helper) |
| Test cases | hour 8 → next "10:00 ICT"; hour 10 → next "12:00 ICT"; hour 20 → next "22:00 ICT"; hour 22 → next "08:00 ICT (ngày hôm sau)" |
| Expected | Match table verbatim |

#### TC-79-05 Skip removed in sendHourlyRecap

| Element | Value |
|---------|-------|
| Method | Unit test (mock TelegramClient) |
| Service | `InvoiceAlertService.sendHourlyRecap(report, diffEvents=[])` |
| Input | `report.missingCount = 0`, `diffEvents = []` (TRƯỚC F-079 sẽ skip return false) |
| Expected behavior | Telegram client `sendMessage()` ĐƯỢC GỌI (verify mock.calls.length === 1) — KHÔNG skip |
| Return value | `true` (Telegram OK) |

#### TC-79-06 Telegram dispatch fail → return false

| Element | Value |
|---------|-------|
| Method | Unit test (mock TelegramClient throw) |
| Service | `InvoiceAlertService.sendHourlyRecap(report, diffEvents=[])` |
| Setup | Mock `telegram.sendMessage()` throw network error |
| Expected behavior | `sendHourlyRecap` return `false` (KHÔNG throw). Logger.error đã được gọi. |
| Side effect | KHÔNG retry trong cùng tick (next tick 2h sau sẽ retry tự nhiên) |

#### TC-79-07 Cron expression parse

| Element | Value |
|---------|-------|
| Method | Unit test |
| Tool | `@nestjs/schedule` parse `'0 0 8,10,12,14,16,18,20,22 * * *'` |
| Expected | Cron parser accept không throw + next 8 fire times next 24h = 08, 10, 12, 14, 16, 18, 20, 22 hôm nay/mai |
| Test approach | Có thể dùng `cron-parser` lib hoặc instantiate Nest scheduler trong test bed |

#### TC-79-08 runHourlyRecap end-to-end (mock cache + classifier)

| Element | Value |
|---------|-------|
| Method | Unit test (mock layer 1 MySQL + layer 2 MISA) |
| Service | `InvoiceReconcileService.runHourlyRecap('2026-06-09')` |
| Setup | Mock `getCachedReport` return `{ missingCount: 0, issuedCount: 23, skippedCount: 2 }` + `diffEvents = []` |
| Expected | Telegram dispatch called once + return `{ sent: true, report }` |

#### TC-79-09 Smoke test post-deploy (integration — manual run)

| Element | Value |
|---------|-------|
| Method | Curl + manual Telegram check |
| Step 1 | `curl https://result-dev.5bib.com/api/admin/invoice-reconcile/health` với admin token → 200 + healthy=true |
| Step 2 | `curl POST /trigger` admin → 200 hoặc 409 lock-aware |
| Step 3 | Đợi cron tick `scan-tick` mới nhất → check log `[scan-tick] OK ms=... missing=0` |
| Step 4 | Đợi cron tick `hourly-recap` mới nhất (tròn giờ chẵn 8/10/12/14/16/18/20/22) → check log `[hourly-recap] sent=true` |
| Step 5 | Mở Telegram group `@invoice_5bib_daily_bot` → verify tin "✅ All OK" hoặc "Có issue" gửi |
| Pass criteria | Tất cả 5 step PASS trong 5 phút |

### 4.2 Frontend E2E Test Cases

**KHÔNG CÓ.** Feature backend-only, không có UI mới.

### 4.3 Security Checks

- [ ] **SEC-79-01** — Telegram bot token + chat ID vẫn dùng env vars `INVOICE_RECONCILE_TELEGRAM_BOT_TOKEN` + `INVOICE_RECONCILE_TELEGRAM_CHAT_ID` existing (KHÔNG hardcode trong code). Verified F-076 BR-14a bot isolation pattern.
- [ ] **SEC-79-02** — `composeHourlyRecap` output gọi `escapeHtml()` cho mọi user-controlled string (orderCode, race ID, money values, **race title**). Verify regression test TC-79-17 input chứa `<script>` → output escape thành `&lt;script&gt;`.
- [ ] **SEC-79-03** — Heartbeat tin Telegram KHÔNG leak PII (email, phone). Spec chỉ render: time, count, orderCode (`#5B...IB`), raceId, race title (public name), money. ZERO PII field.
- [ ] **SEC-79-04** — Cron endpoint KHÔNG public — cron-driven background job, không có HTTP trigger.
- [ ] **SEC-79-05** — Smoke test (`POST /trigger`) gated `LogtoFinanceGuard` post-F-078 deploy (HOẶC `LogtoAdminGuard` nếu F-078 chưa merge) — verify 403 với staff token.
- [ ] **SEC-79-06** — Race title MySQL query MUST dùng `?` placeholder + params array (`manager.query('SELECT ... WHERE race_id = ?', [raceId])`). ZERO `${}` interpolation. Verify Coder spot-check khi `/5bib-plan`.

### 4.4 Performance SLA

- Cron tick `hourly-recap` runtime **p95 < 2s** (inherit F-076 SLA — không tăng vì heartbeat KHÔNG thêm DB query, chỉ render template + Telegram dispatch).
- Telegram dispatch retry: KHÔNG cần (next tick 2h sau sẽ retry tự nhiên — BR-79-06).
- Memory footprint: composer pure function ~1KB string output per tick. Negligible.

### 4.5 10x Stability Test

- **TC-79-10** — 10 lần concurrent `runHourlyRecap()` call (giả lập cron edge case multi-instance) → expected: chỉ 1 lần gửi Telegram (Redis lock `master:rr-snapshot:<raceId>` 15s TTL bảo vệ — existing F-076 pattern). Verify mock `telegram.sendMessage().mock.calls.length === 1`.

### 4.6 Race title resolver test cases (NEW — Danny update 14:15)

#### TC-79-11 Race title resolver — cache hit

| Element | Value |
|---------|-------|
| Method | Unit test (mock Redis + MySQL) |
| Function | `RaceTitleResolver.resolve(220)` (hoặc tên Coder chọn) |
| Setup | Mock Redis `GET races:title:byMysqlId:220` return `"LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG"` |
| Expected return | `"LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG"` |
| Side effect verify | MySQL query KHÔNG được gọi (cache hit short-circuit) |

#### TC-79-12 Race title resolver — cache miss → MySQL fallback

| Element | Value |
|---------|-------|
| Method | Unit test (mock Redis miss + MySQL hit) |
| Function | `resolve(220)` |
| Setup | Mock Redis `GET` return `null`. Mock MySQL `query('SELECT race_id, title FROM races WHERE race_id = ?', [220])` return `[{race_id: 220, title: 'LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG'}]` |
| Expected return | `"LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG"` |
| Side effect verify | Redis `SET races:title:byMysqlId:220 "..." EX 3600` được gọi sau MySQL hit |

#### TC-79-13 Race title resolver — defensive fallback khi DB/Redis fail (BR-79-23)

| Element | Value |
|---------|-------|
| Method | Unit test (mock Redis throw + MySQL throw) |
| Function | `resolve(220)` |
| Setup | Mock Redis throw network error. Mock MySQL throw connection refused. |
| Expected return | `"Race 220"` (fallback per BR-79-23) — KHÔNG throw exception |
| Side effect verify | Logger.warn được gọi với context "race title resolve fail" |

#### TC-79-14 Race title resolver — race_id không tồn tại trong DB

| Element | Value |
|---------|-------|
| Method | Unit test |
| Function | `resolve(99999)` |
| Setup | Redis miss. MySQL query return `[]` empty rows. |
| Expected return | `"Race 99999"` (fallback per BR-79-23) |
| Side effect verify | Coder chọn: cache fallback TTL ngắn (60s) HOẶC skip SET (KHÔNG cache vĩnh viễn race không tồn tại). Document trong implementation. |

#### TC-79-15 Race title resolver — title > 80 ký tự (BR-79-25 truncate)

| Element | Value |
|---------|-------|
| Method | Unit test |
| Function | `composeRaceTag(title, raceId)` (helper format `{title} - {raceId}`) |
| Input | `title = "A".repeat(100)`, `raceId = 220` |
| Expected return | `"AAA...AA... - 220"` — title slice 0,77 + "..." + " - 220" |
| Edge | title = 47 ký tự "LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG" → KHÔNG truncate, full hiển thị |

#### TC-79-16 Composer integration race title (BR-79-20)

| Element | Value |
|---------|-------|
| Method | Unit test |
| Function | `composeHourlyRecap(report, diffEvents, dashboardUrl, raceTitlesByid)` |
| Input | `report.missingCount = 0`, `report.issuedCount = 23`, `report.enabledRaceIds = [140, 220]`, `raceTitlesByid = new Map([[140, '5BIB x COROS'], [220, 'LÀO CAI MARATHON 2026 - DÒNG CHẢY BIÊN CƯƠNG']])` |
| Expected output | HTML chứa "Giải" line render cả 2 race title + race_id format `{title} - {race_id}` |
| MUST NOT regress | TC-79-01/02/03 với raceTitlesByid empty Map → fallback `Race {raceId}` per BR-79-23 |

#### TC-79-17 escape HTML trong race title (BR-79-24)

| Element | Value |
|---------|-------|
| Method | Unit test |
| Function | `composeHourlyRecap(...)` với `raceTitlesByid.get(220) = '<script>alert(1)</script> Marathon'` |
| Expected output | HTML chứa `&lt;script&gt;alert(1)&lt;/script&gt; Marathon - 220` — escape đúng, KHÔNG raw `<script>` |

---

## 📌 Answers to Manager's PAUSE conditions (từ file 00)

> BA trả lời 5 PAUSE-79-* tại đây.

- **PAUSE-79-01:** Heartbeat cron gửi mỗi giờ chẵn `8,10,12,14,16,18,20,22` ICT?
  → **BA confirm YES.** 8 tick/ngày. Bao gồm 22:00 sau EOD 21:00 vì content khác (heartbeat = snapshot, EOD = full-day counters). BR-79-01 + BR-79-02 lock.

- **PAUSE-79-02:** Khi có `missing > 0` hoặc có diff → gửi cả 2 tin (heartbeat tổng quát + alert chi tiết) hay 1 tin gộp?
  → **BA chốt 1 TIN GỘP.** Composer logic 3-state (All OK / All OK + diff / Có issue) — Coder switch theo state trong `composeHourlyRecap()`. KHÔNG dispatch 2 message riêng (tránh confusion + double-count). Spec BR-79-07/08/09 + TC-79-01/02/03.

- **PAUSE-79-03:** Format heartbeat khi `missing=0`?
  → **BA chốt template "All OK" 3 state đã spec ở section UI/UX Flow.** Header "📊 5BIB Invoice Heartbeat" + status line "✅ All OK — N/N" + stats block (Expected/Issued/Missing/Duplicate/Skipped) + footer "🕐 Next heartbeat: HH:MM ICT" + dashboard link. Form gọn nhưng đủ thông tin Hiền kiểm tra.

- **PAUSE-79-04:** Dùng Redis dedup cho heartbeat?
  → **BA confirm NO.** Cron schedule 2h/lần chính xác, mỗi tick = mỗi 2h, ZERO trùng. Thêm dedup = thêm complexity không cần. BR-79-06 lock.

- **PAUSE-79-05:** Touching F-076 vừa golive — test mandate đặc biệt?
  → **BA confirm YES.** TC-79-03 regression check "Có issue" format giữ nguyên BR-25 existing. TC-79-09 smoke test 5-step post-deploy. BR-79-15 promise 6 loại alert khác không đụng. BR-79-19 deploy window đề xuất sau 20:00 ICT tránh peak race 220.

### Bonus PAUSE-Coder-79-05 (Danny update 2026-06-09 14:15)

- **PAUSE-Coder-79-05:** Race title resolver implementation
  → **BA spec rõ:** BR-79-20..25 lock format `{title} - {race_id}` + Redis cache F-049 pattern reuse + defensive fallback `Race {race_id}` + truncate 80 char + escape HTML. TC-79-11..17 cover 7 case (cache hit/miss/fail/not-found/truncate/integration/escape). Coder check trước khi viết: codebase có `RaceTitleResolver` existing chưa (grep `races:title:byMysqlId`) — reuse nếu có.

### Bonus — TD-F079-TZ-BOUNDARY-FILTER tracked separately

Manager init đã note: DB raw 23 ORDINARY today vs F-076 expected=22 lệch 1 đơn id=200029493 paidAt UTC 21:14 = ICT 04:14 cross-midnight. Có thể filter dùng UTC date thay ICT. **F-079 KHÔNG fix bug này** — defer feature riêng F-080+. Out of scope explicit.

---

## ✅ Status

- [x] **READY** — sẵn sàng cho Manager review (`/5bib-plan`)

---

## 🔗 Next step

Danny chạy: `/5bib-plan FEATURE-079-invoice-heartbeat-recap`
