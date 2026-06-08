# FEATURE-076: MISA Meinvoice Daily Reconcile & Alert System

**Status:** 🟡 INITIATED
**Created:** 2026-06-08
**Owner:** Danny
**Type:** NEW_MODULE (monitoring only — không tự publish invoice)
**Created by:** 5bib-manager

---

## 🎯 Why this feature

5BIB đang dùng **MISA Meinvoice** để xuất hóa đơn điện tử cho đơn hàng race-by-race (mỗi race có flag bật/tắt e-invoice). Việc xuất hóa đơn xảy ra ở **hệ thống legacy** (PHP/5bib_platform_live MySQL) và ghi mã invoice MISA vào cột `order_metadata.vat_ref`.

**Rủi ro pháp lý cứng:** NĐ 125/2020 + TT 78/2021 phạt **6.000.000 VNĐ/hóa đơn nếu xuất trễ > 1 ngày làm việc**. Hiện tại 0 cơ chế phát hiện đơn `paid` thiếu `vat_ref` trong ngày — nếu queue stuck / MISA API down / dev quên bật flag → hôm sau bị phạt cứng.

**Scope khởi điểm — RẤT HẸP, CRITICAL deadline:**
- `race_id = 140` — race **test** đang chạy
- `race_id = 220` — race **LIVE bắt đầu bán vé mai 2026-06-09**

→ MVP (reconcile + alert) **PHẢI ship trước/ngay 2026-06-09** trước khi race 220 mở bán.

**Mục tiêu hệ thống:** Cuối mỗi giờ (giờ làm việc) tự đối chiếu (a) số đơn 5BIB `paid` thuộc race-có-flag-on, vs (b) số đơn có `vat_ref` non-null trong cùng MySQL. Nếu lệch → alert Danny + finance team **trong ngày** để xử lý, tránh phạt.

> **Quan trọng — F-076 KHÔNG tự xuất hóa đơn**. Việc publish invoice vẫn ở legacy. F-076 chỉ MONITOR + ALERT. Future Phase 2 mới có thể proxy publish/retry.

---

## 📂 Impact Map

> Manager đã grep repo: **ZERO file hiện hữu** chứa keyword `meinvoice|misa|vat_ref` trong `backend/src/` → đây là **GREENFIELD module** trong 5bib-result. `order_metadata` đã reachable qua MySQL `'platform'` connection (dùng bởi `reconciliation`, `merchant-portal`, `finance`, `dashboard`).

### Module mới (đề xuất path)
- ➕ `backend/src/modules/invoice-reconcile/` — module mới hoàn toàn
  - `invoice-reconcile.module.ts` — register cron + service + controller + TypeORM entity
  - `invoice-reconcile.service.ts` — core reconcile logic (đọc MySQL `order_metadata` đối soát)
  - `invoice-reconcile.cron.ts` — `@Cron(CronExpression.EVERY_HOUR)` pattern (port từ `dashboard-aggregator.cron.ts`)
  - `services/misa-meinvoice.client.ts` — MISA API client (auth token cache + list/status endpoints) — **Phase 2 optional** cho cross-check Layer 2
  - `services/invoice-alert.service.ts` — abstract notification (Slack webhook trước, email fallback)
  - `invoice-reconcile.controller.ts` — admin endpoint: manual trigger reconcile + read latest report (LogtoAdminGuard)
  - `entities/order-metadata-readonly.entity.ts` — TypeORM readonly entity table `order_metadata` (named conn `'platform'`) — chỉ SELECT cột cần (`id`, `race_id`, `internal_status`, `financial_status`, `vat_ref`, `paid_at`, `total_price`, `order_category`)
  - `dto/`: `reconcile-report.dto.ts`, `missing-invoice-row.dto.ts`, `trigger-reconcile.dto.ts`
  - `__tests__/invoice-reconcile.service.spec.ts` — unit test

### Module sửa
- ✏️ `backend/src/modules/app.module.ts` — register `InvoiceReconcileModule` + verify `ScheduleModule.forRoot()` đã có (dashboard cron đang dùng nên chắc có)

### Config layer
- ✏️ `backend/src/config/index.ts` — thêm namespace `env.misa` (8 field: appId, taxCode, account, password, baseUrl prod/test, signCertSerial?, …) — pattern reuse `env.provider` từ F-030
- ✏️ `backend/.env` + docker-compose env — Danny add MISA secrets

### Admin UI (Phase 1 — minimal, defer Phase 2 nếu kẹt deadline)
- ➕ `admin/src/app/(dashboard)/invoice-reconcile/page.tsx` — dashboard 1 trang:
  - Card "Đơn cần xuất hôm nay" / "Đã xuất" / "Còn thiếu" / "Trễ >1 ngày"
  - Bảng danh sách đơn thiếu (race / bib / amount / paid_at / age in hours)
  - Button "Chạy reconcile ngay"
  - Toggle flag e-invoice per race (race 140 / 220) — nếu enable flag không có sẵn UI khác
- ➕ `admin/src/lib/api-hooks/use-invoice-reconcile.ts` — TanStack Query wrapper

### Frontend public: **KHÔNG đụng** — internal admin tool.

### File then chốt cần Coder + BA đọc trước
- `backend/src/modules/reconciliation/services/reconciliation-query.service.ts` — pattern query `order_metadata` cross-DB chuẩn nhất (F-016)
- `backend/src/modules/finance/services/fee.service.ts` — pattern named conn `'platform'` + raw SQL parameterized
- `backend/src/modules/dashboard/services/dashboard-aggregator.cron.ts:27` — pattern `@Cron(EVERY_HOUR)` + SETNX lock (nếu có)
- `backend/src/modules/finance/entities/order-readonly.entity.ts` — pattern readonly TypeORM entity cho table legacy

### Endpoints (sơ bộ — BA finalize)
- `GET /api/admin/invoice-reconcile/today` — báo cáo hôm nay
- `GET /api/admin/invoice-reconcile/range?from=&to=` — báo cáo khoảng thời gian
- `POST /api/admin/invoice-reconcile/trigger` — manual re-run (idempotent)
- `GET /api/admin/invoice-reconcile/races/:raceId/missing` — list đơn thiếu của 1 race
- (Phase 2) `PATCH /api/admin/invoice-reconcile/races/:raceId/toggle` — bật/tắt flag (nếu không có UI khác)

### Schema / DB
- **MySQL `'platform'` (legacy READ ONLY)**:
  - SELECT `order_metadata`: `id, race_id, internal_status, vat_ref, paid_at, total_price, order_category, deleted`
  - **Cần BA confirm**: race-level e-invoice flag nằm bảng nào — `races.e_invoice_enabled`? `race_course.invoice_config`? Hay hardcoded list trong env? Phase 1 MVP có thể hardcode `[140, 220]` trong env nếu chưa có column.
- **MongoDB**: thêm collection mới (optional, BA quyết)
  - `invoice_reconcile_runs` — audit log mỗi lần reconcile chạy (`runAt`, `mode: cron|manual`, `raceIdsScanned`, `totalExpected`, `totalIssued`, `totalMissing`, `alertEmitted`)
- **Redis keys** (đề xuất):
  - `invoice-reconcile:lock` — SETNX TTL 5min anti-stampede cron (pattern F-019 awards:lock)
  - `invoice-reconcile:last-run:<date>` — TTL 24h, cache report
  - `invoice-reconcile:alert-dedup:<raceId>:<date>` — TTL 6h, không spam Slack mỗi tick
  - `misa:token` — TTL theo MISA token expiry, refresh khi 401 (Phase 1.1)

### Integration mới
- **MISA Meinvoice REST API** — base `https://api.meinvoice.vn` (prod) / `https://testapi.meinvoice.vn` (test)
- **Slack incoming webhook** — channel TBD (Danny chốt, vd `#5bib-finance-alert`)
- **Email fallback** — qua Mailchimp transactional có sẵn (memory đã ghi)

---

## 📊 Context MISA Meinvoice (parsed từ Excel "Theo dõi tích hợp Meinvoice")

> Manager đã parse Excel — đây là tóm tắt critical cho BA viết PRD, KHÔNG lặp lại trong PRD trừ điểm BA cần làm rõ.

### Loại tích hợp (Danny đã chốt trong khảo sát Excel "Thông tin dự án")
- **"Tích hợp sâu (AIO)"** ✅
- **Hóa đơn có mã CQT** ✅ (Cơ quan Thuế)
- **HĐ GTGT MTT** (Máy tính tiền)
- **ESIGN nâng cao** (signing) — MISA tự ký HSM, 5BIB KHÔNG cần tự ký XML
- Không ngoại tệ, không chiết khấu thương mại (đơn giản hoá)

### Credentials test (Excel "Thông tin dự án" R21-R24) — KHÔNG commit vào code
- `AppID = 78a5995d-b43c-4dfb-afe9-5425676f30f5` (test+prod cùng AppID)
- `Mã số thuế = 6868686868-769`
- `Tài khoản = testmisa@yahoo.com`
- `Mật khẩu = 123456Aa`

### Endpoints MISA chính cần biết
| Endpoint | Method | Purpose | Phase |
|----------|--------|---------|-------|
| `/api/integration/auth/token` | POST | Get token (60min expiry typical) | 1.1 |
| `/api/integration/invoice/status?inputType=...&data=<refIDs>` | GET | **Lấy trạng thái hóa đơn theo RefID** | **1.1 — CỐT LÕI cho Layer 2 verify** |
| `/api/integration/invoice/publishview...` | GET | Xem hóa đơn đã phát hành | 2 |
| `/api/integration/invoice/Download?invID=...` | GET | Tải PDF hóa đơn | 2 |
| `/api/integration/invoice/templates?invSeries=...` | GET | List mẫu hóa đơn | KHÔNG cần |
| `/api/integration/invoice` (POST publish) | POST | Phát hành — **legacy đã làm, F-076 KHÔNG đụng** | OUT_OF_SCOPE |

### Object key (Excel "Mô tả đối tượng" R3-R57)
- `RefID` (GUID) — **mã tham chiếu hóa đơn**, do client gen, idempotent. Đây là field nối invoice MISA ↔ `order_metadata.vat_ref` likely.
- `InvDate` yyyy-MM-dd — ngày phát hành (so sánh với `paid_at`)
- `BuyerLegalName`, `BuyerTaxCode`, `BuyerAddress`, `BuyerEmail` — info người mua
- `TotalAmount` (decimal) — tổng tiền (so sánh với `order_metadata.total_price`)
- `IsTaxReduction43` boolean — flag thuế 8% (TT43)

### Error codes critical (Excel "Mã lỗi thường gặp")
- `TokenExpiredCode` → refresh token
- `DuplicateInvoiceRefID` → retry get status (đơn có thể đã publish thành công nhưng client mất response)
- `InvoiceDuplicated` → query status lấy số đã publish (race condition)
- `InvoiceNumberNotCotinuous` → retry publish (transient)
- `Exception` → liên hệ MISA support, alert ESCALATION

---

## ⚠️ Risk Flags

> Đối chiếu `known-issues.md`:

- 🔴 **CRITICAL** — **Deadline 2026-06-09 (mai)**: Race 220 bán vé từ mai. Mỗi ngày trễ ship = rủi ro phạt 6tr/hóa đơn × N đơn. MVP **tối thiểu** (Layer 1 self-reconcile MySQL-only, alert Slack thủ công) PHẢI có trước EOD 2026-06-09. Layer 2 MISA API cross-check có thể ship Phase 1.1 tuần sau.
- 🔴 **HIGH** — **Đụng financial path + legal compliance**: hóa đơn = chứng từ kế toán pháp lý. Sai số / false-positive alert → spam noise; false-negative → phạt tiền + audit thuế. Test bắt buộc cover edge case: timezone (UTC vs `Asia/Ho_Chi_Minh`), end-of-day boundary, payment void/refund sau khi xuất hóa đơn.
- 🔴 **HIGH** — **Lesson F-019 v2 (CLAUDE.md "Independent Calc + 2-Layer Verify")**: KHÔNG trust 1 source duy nhất. Layer 1 = đếm `order_metadata.vat_ref IS NULL` trong MySQL (primary). Layer 2 = call MISA `GET /invoice/status?refID=...` cross-check (Phase 1.1+ verify legacy ghi `vat_ref` đúng).
- 🟡 **MED** — **Named connection `'platform'` quirk** (known-issues.md: "Default connection sẽ silent-fail vì là MongoDB"). Coder PHẢI dùng `@InjectRepository(OrderMetadataReadonly, 'platform')` — sai = silent empty array → false "0 missing" → CRITICAL bug.
- 🟡 **MED** — **TD-F016-FINANCE-01 cảnh báo**: F-016 đã từng drop 613 đơn (GROUP_BUY + GROUP_BUY_FIXED + CODE_TRANSFER) khỏi reconcile vì whitelist sai. F-076 phải INCLUDE đầy đủ enum `order_category` cần xuất hóa đơn (BA confirm — tất cả `paid` non-MANUAL? hay chỉ ORDINARY?).
- 🟡 **MED** — **Alert fatigue**: cron mỗi giờ + 100 đơn pending = 100 message → noise. Dedup `invoice-reconcile:alert-dedup:<raceId>:<date>` 6h + 1 alert summary/tick.
- 🟢 **LOW** — Admin UI read-only + 1 manual trigger → ít risk regression module khác.

### Known-issues hot zones liên quan
- **TD-F016-FINANCE-01** (🚨 Critical accounting) — `FIVE_BIB_CATEGORIES` whitelist bug. F-076 phải code danh sách `order_category` requires-invoice rõ ràng, KHÔNG copy from F-016 silently.
- **TD-2026-05-12-CRIT-04** (SSRF deferred) — MISA API call là OUTBOUND đến domain whitelist `*.meinvoice.vn`, NOT user-controlled URL → KHÔNG SSRF risk như TD-007. Nhưng vẫn nên hardcode `MISA_BASE_URL` env-only, không cho admin paste URL.

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

> BA PHẢI trả lời TỐI THIỂU **#1-#5 (critical path)** trước khi Manager APPROVE plan. #6-#13 có thể defer Phase 1.1.

### Tier A — BLOCK MVP nếu chưa rõ
- [ ] **#1 — Race-level enable flag nằm đâu?** Manager đoán 3 khả năng:
  - (a) Column mới trong `races` table → cần Danny/legacy team thêm column
  - (b) Column có sẵn (vd `races.invoice_enabled`/`races.export_invoice`) — BA grep DB schema
  - (c) Chưa có → MVP **hardcode env** `INVOICE_RECONCILE_ENABLED_RACES=140,220` (đề xuất Manager cho deadline mai)
- [ ] **#2 — Đơn nào REQUIRES invoice?** BR phải cụ thể:
  - Tất cả `order_metadata.internal_status = COMPLETE` AND `financial_status = 'paid'`?
  - Loại trừ `order_category = 'MANUAL'`? (F-016 đã loại — likely yes)
  - Loại trừ đơn `deleted = 1`? (likely yes)
  - Có ngưỡng tiền không (vd `total_price >= 200000` VNĐ)?
- [ ] **#3 — Cut-off time mỗi ngày?** 23:59 ICT? 17:00 (giờ làm việc)? Cuối tuần / lễ tết có ân hạn không (luật VN ngày làm việc)?
- [ ] **#4 — Kênh alert + recipient:** Slack channel cụ thể? Email list (tên người)? CRITICAL có cần SMS không?
- [ ] **#5 — Escalation rule by count vs amount:**
  - Đề xuất Manager: 1-5 đơn → INFO Slack | 6-20 → WARN @here | >20 OR tổng tiền >100M → CRITICAL @channel + email
  - BA chốt threshold cụ thể

### Tier B — Có thể defer Phase 1.1
- [ ] **#6 — Đơn refund/void SAU khi xuất hóa đơn → behavior?** Cần xuất hóa đơn điều chỉnh? Hay reconcile chỉ care đơn `paid` hiện tại?
- [ ] **#7 — Backfill cho race 140 (test):** đã có đơn nào chưa xuất chưa? Cần 1-time migrate không?
- [ ] **#8 — Cron frequency:** Manager đề xuất `@Cron(EVERY_HOUR)` 8h-22h ICT + 1 tick 17:00 EOD recap. BA chốt.
- [ ] **#9 — Layer 2 MISA API verify**: ship Phase 1.1 (cross-check vendor) hay defer hẳn? Lesson F-019 v2 nói "MUST có 2 layer" — Manager khuyến nghị ship Phase 1.1 trong tuần.
- [ ] **#10 — `vat_ref` format:** là invoice number MISA (string 8 ký tự) hay RefID GUID hay composite? Cần BA grep mẫu dữ liệu thực 5-10 row legacy.
- [ ] **#11 — Timezone**: cron schedule + `paid_at` so sánh phải cùng `Asia/Ho_Chi_Minh`. Server backend container TZ hiện gì? (Manager đoán UTC → cần convert).
- [ ] **#12 — Audit log retention:** `invoice_reconcile_runs` collection cần index TTL không? Hay giữ vô thời hạn (audit trail kế toán)?
- [ ] **#13 — Scale forecast:** sau race 220, dự kiến bao nhiêu race enable trong Q3 2026? Để quyết định cần queue (BullMQ) hay cron đủ.

---

## 🎯 Success criteria (gợi ý cho BA)

- **Functional MVP (ship trước 2026-06-09):**
  - Mọi đơn `paid` của race 140/220 mà `vat_ref IS NULL` sau cut-off → alert phát đi trong vòng 1h.
  - 0 false positive trong test với race 140 (test data).
  - Manual trigger reconcile chạy bất kỳ lúc nào, idempotent.
- **Performance:**
  - Reconcile 1 race ≤ 5K đơn hoàn thành < 30s.
  - MISA API call (Phase 1.1) timeout 10s + retry 3× exponential backoff.
- **Reliability:**
  - Cron miss tick (VPS reboot) → recover khi up, không skip ngày.
  - MISA API down → alert "MISA UNREACHABLE" thay vì silent.
- **Compliance:**
  - **0 hóa đơn trễ > 1 ngày làm việc** cho race 140 + 220 trong tháng đầu.

---

## 📋 Architecture đề xuất (sơ bộ — BA + Coder finalize)

```
┌─────────────────────────────────────────────────────────────┐
│  InvoiceReconcileCron                                       │
│  @Cron('0 0 8-22 * * *')  ← mỗi giờ 8h-22h ICT             │
│  + @Cron('0 0 17 * * *')  ← EOD recap 17:00 ICT            │
└─────────────────────┬───────────────────────────────────────┘
                      │ SETNX invoice-reconcile:lock TTL 5min
                      ▼
       ┌──────────────────────────────────┐
       │ InvoiceReconcileService.run()    │
       └──┬───────────────────────────────┘
          │
          ├─[LAYER 1 — primary, MVP ship]
          │   MySQL 'platform': SELECT FROM order_metadata
          │   WHERE race_id IN (enabledRaces[])
          │     AND internal_status='COMPLETE'
          │     AND deleted=0
          │     AND order_category IN (...whitelist BA confirm)
          │     AND paid_at >= today 00:00 ICT
          │   →  expected[] (all paid orders today)
          │   →  missing[] = expected WHERE vat_ref IS NULL OR vat_ref=''
          │
          ├─[LAYER 2 — Phase 1.1+ Pattern H vendor cross-check]
          │   GET MISA /invoice/status?refIDs=<RefIDs of vat_ref present>
          │   → vendorIssued[] vs DB-recorded → emit VENDOR_MISMATCH warn
          │
          ├─ Compute KPI: expectedCount, issuedCount, missingCount,
          │   ageHoursMax, totalAmountAtRisk
          │
          ├─ DEDUP: SETNX invoice-reconcile:alert-dedup:<raceId>:<date>
          │
          └─[ALERT BY THRESHOLD]
              missing == 0           → SKIP alert (no noise)
              missing 1-5            → INFO   Slack #5bib-finance
              missing 6-20           → WARN   Slack @here + email
              missing >20 OR >100M   → CRITICAL Slack @channel + email
              MISA API down          → CRITICAL "VENDOR UNREACHABLE"
```

**Cron tick rationale:**
- Mỗi giờ 8h-22h ICT → kịp xử lý trong ngày làm việc
- 17:00 ICT tick là EOD recap chính
- KHÔNG chạy 0h-7h ICT → tránh noise khi legacy batch chưa xuất xong

**MISA auth strategy (Phase 1.1):**
- Cache token Redis `misa:token` TTL theo MISA expiry
- Refresh khi <5min hết hạn hoặc gặp 401/`TokenExpiredCode`
- 1 connection pool — KHÔNG cần concurrent auth (cron là single-tenant)

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [ ] **Yes — sau khi Danny trả lời 4 điểm dưới + BA giải PAUSE #1, #2, #3, #4, #5** (Tier A)
- [x] **No, cần Danny xác nhận trước khi BA bắt đầu:**

### Danny chốt 4 điểm
1. **Số feature `FEATURE-076` đúng không?** Manager bump counter từ feature-log.md "Next FEATURE-XXX: FEATURE-075" → F-076 là số tiếp theo. (Folder đã tạo `FEATURE-076-misa-invoice-daily-reconcile/`)
2. **Phasing chốt:**
   - **Option A — MVP Layer 1 only ship trước 2026-06-09** (chỉ đếm `vat_ref IS NULL` trong MySQL, alert Slack), Layer 2 MISA cross-check ship Phase 1.1 tuần sau ← **Manager đề xuất**
   - Option B — Full Layer 1 + 2 ship cùng (deadline cứng hơn, risk cao hơn)
3. **Race enable flag — chốt cách lưu cho MVP:**
   - **Hardcode env `INVOICE_RECONCILE_ENABLED_RACES=140,220`** (đơn giản, đổi cần redeploy) ← Manager đề xuất cho MVP
   - Hay add column `races.invoice_enabled` mới (phải migrate legacy DB schema) ← Phase 2
4. **Race 220 bán vé giờ nào mai 2026-06-09?** → xác định cụ thể deadline ship MVP (sáng / chiều / EOD).

---

## 🔗 Next step

1. Danny chốt 4 điểm trên ⬆️
2. Danny chạy: `/5bib-prd FEATURE-076-misa-invoice-daily-reconcile`
3. BA đọc Excel + memory + grep `order_metadata` schema + trả lời PAUSE Tier A (#1-#5) trong `01-ba-prd.md`
