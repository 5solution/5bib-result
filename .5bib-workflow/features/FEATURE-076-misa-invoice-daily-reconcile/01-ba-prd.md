# FEATURE-076: PRD — MISA Meinvoice Daily Reconcile & Alert System

**Status:** 🔵 READY
**Last updated:** 2026-06-08
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` đầy đủ
- [x] Đã verify Manager session với data thực:
  - MISA `/invoice/paging` PROD test PASS (255 invoices all-time, 7 today, mapping rule confirmed)
  - DB schema 3 query trên VPS (order_metadata 48 col, order_line_item, insurance child orders)
- [x] Đã đọc `memory/codebase-map.md` — `reconciliation/` cross-DB pattern + `dashboard-aggregator.cron.ts` cron pattern
- [x] Đã đọc `memory/known-issues.md` — TD-F016-FINANCE-01 whitelist lesson + named connection `'platform'` quirk + TD-CRIT-04 SSRF deferred

---

## 📝 Hệ thống đối soát hóa đơn MISA Meinvoice hàng ngày

**Goal:** Mỗi giờ trong giờ làm việc, đối chiếu chéo (cross-check) số đơn `paid` 5BIB cần xuất hóa đơn vs số hóa đơn MISA đã thực sự xuất trong cùng ngày → phát hiện sớm các trường hợp **chưa xuất / xuất trễ / sync lag / duplicate** → alert Slack + email cho Finance team xử lý **trong ngày**, tránh phạt 6 triệu/hóa đơn theo NĐ 125/2020 + TT 78/2021.

**Scope:**
- ✅ **In scope:**
  - Monitor + alert (KHÔNG tự xuất hóa đơn)
  - 2 race: `140` (test) + `220` (live mở bán mai 2026-06-09)
  - Layer 1 — đếm `order_metadata.vat_ref IS NULL` MySQL platform
  - Layer 2 — cross-check `MISA /invoice/paging` (verify MISA-side reality)
  - 4 severity bucket: OK / SYNC_LAG / UNISSUED / DUPLICATE
  - Alert escalation theo **AGE giờ** của đơn missing (KHÔNG theo count)
  - **Alert kênh chính: Telegram bot** → group chat Finance + Danny
  - Admin dashboard read-only + button "Chạy reconcile ngay" — đặt trong **`admin/` Next.js app** route `/admin/invoice-reconcile` (chung cluster với /reconciliations + /finance/pnl)
  - **2-tier cron:**
    - **Scan tick `*/5 * 8-22 * * *` ICT** (mỗi 5 phút giờ làm việc 08:00-22:00) — match tần suất legacy 5BIB publish, cập nhật Redis cache cho dashboard real-time
    - **Hourly recap `0 0 8-22 * * *` ICT** (đúng tiếng tròn, 15 tick/ngày) — INFO recap gộp diff tiếng qua
    - **EOD recap `0 0 21 * * *` ICT** (21:00 hằng ngày) — Daily summary cho cả ngày
  - **7 loại alert** cover full case: INFO Hourly Recap / WARN Bucket Escalation / CRITICAL Bucket Escalation / BREACHED / DUPLICATE / MISA Health / EOD Daily Recap (chi tiết BR-25 đến BR-31)
- ❌ **Out of scope (Phase 2+):**
  - Tự publish invoice (legacy giữ)
  - Adjustment/replacement invoice flow (`ReferenceType` thay thế/điều chỉnh)
  - Refund/void invoice flow
  - Backfill cron data cũ > 90 ngày
  - SMS alert
  - Per-merchant routing alert
  - Migration legacy DB schema (add column `races.invoice_enabled`)
  - UI bật/tắt e-invoice per race (Phase 2 nếu cần)
  - Excel/PDF export missing report (Phase 1.1 nếu cần)
  - Audit log Mongo collection (Phase 1.1 — tạm dùng Slack history + Redis last-run)

---

## 👤 User Stories & Business Rules

### User Stories

- **As a 5BIB Back-Office Admin**, I want to **xem dashboard real-time số đơn paid cần xuất hóa đơn + số chưa xuất** so that **tao biết hôm nay finance team có việc gì cần xử lý trong ngày**.
- **As a 5BIB Back-Office Admin**, I want to **nhận alert Telegram ngay khi có đơn paid > 12h chưa có vat_ref** so that **tao kịp xử lý trước cut-off 24h tránh phạt 6tr**.
- **As a 5BIB Back-Office Admin**, I want to **chạy manual reconcile bất kỳ lúc nào** so that **sau khi finance fix data tao verify lại không cần chờ cron tick**.
- **As a 5BIB Back-Office Admin**, I want to **xem chi tiết từng đơn missing với race / orderId / amount / age / lý do** so that **tao biết liên hệ DEV hay finance để xử lý cụ thể**.
- **As a 5BIB Back-Office Admin**, I want to **receive alert "DUPLICATE INVOICE"** khi MISA có >1 hóa đơn gốc cùng orderId so that **tao phát hiện DEV leak test local sang PROD hoặc legacy retry bug**.
- **As Finance Team Lead**, I want to **không bị spam mỗi giờ cùng nội dung** so that **chỉ alert khi severity tăng hoặc đơn mới phát sinh**.

### Personas
- **5BIB Back-Office Admin** = Danny + Finance Team Lead (role Logto `admin`)
- **Finance Team Lead** = thành viên Telegram group "5BIB Finance Alert" (subset of Back-Office Admin)
- KHÔNG có persona merchant, KHÔNG có athlete (internal tool 100%)

### Business Rules

#### Scope đơn cần xuất hóa đơn

- **BR-01 — Filter đơn requires-invoice:**
  ```sql
  WHERE race_id IN (:enabled_race_ids)
    AND internal_status = 'COMPLETE'
    AND financial_status = 'paid'
    AND deleted = 0
    AND order_category NOT IN ('INSURANCE', 'MANUAL')
  ```
  - `INSURANCE` = child order — MISA gộp invoice với order chính (verified DB: order 200029417 có `note="Insurance order for 200029416"`)
  - `MANUAL` = offline entry, không qua flow MISA (theo TD-F016 lesson)
  - Tất cả category khác (`ORDINARY`, `CODE_TRANSFER`, `GROUP_BUY`, `GROUP_BUY_FIXED`, `PERSONAL_GROUP`, `CHANGE_COURSE`) đều CẦN xuất hóa đơn

- **BR-02 — Race enable flag:** Hardcode env `INVOICE_RECONCILE_ENABLED_RACES="140,220"` (CSV). Reload cần restart backend. Manager đã chốt (Option A MVP) — Phase 2 mới add column DB.

- **BR-03 — `CODE_TRANSFER` cũng cần xuất hóa đơn riêng:** verified DB — 17/17 đơn `CODE_TRANSFER` paid all-time có `total_price > 0`, đại diện cho phí chuyển nhượng/đổi cự ly (phát sinh doanh thu mới). Race 140 có 1 đơn pending: `id=200025061`, paid `2026-03-02`, `total_price=100000`, **chưa từng trigger** (test race, không phạt).

#### Mapping cross-DB

- **BR-04 — Mapping rule `vat_ref ↔ MISA InvNo`:**
  ```
  order_metadata.vat_ref (varchar(64))  ==  MISA Invoice.InvNo  (8-digit zero-pad string, vd "00000023")
  ```
  Verified với 3 sample (200029420 vat_ref="00000023" matches MISA InvNo=00000023; 200029458 vat_ref="00000024" matches).

- **BR-05 — Mapping rule `order.id ↔ MISA RefID`:**
  ```
  order_metadata.id  ==  Integer(MISA Invoice.RefID.split('-')[0])
  ```
  RefID format = `<orderId>-<timestamp>` cho B2C (vd `200029416-20260608172739`). RefID format GUID (vd `90d6eb31-a652-...`) là B2B contracts (out of scope F-076).

- **BR-06 — B2C filter regex (loại B2B contracts khỏi reconcile):**
  ```regex
  ^\d+-(\d{14}|\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}Z)$
  ```
  Áp dụng trên `MISA Invoice.RefID`. Match = B2C ticket; không match = B2B HĐ dịch vụ (skip).

#### Severity bucket

- **BR-07 — 4 severity buckets:**

  | Bucket | Condition | Severity | Risk |
  |--------|-----------|----------|------|
  | `OK` | DB `vat_ref` set + MISA có invoice gốc match InvNo + 1-1 unique | 🟢 INFO (không alert) | none |
  | `SYNC_LAG` | DB `vat_ref` NULL nhưng MISA có invoice gốc cho cùng `orderId` | 🟡 WARN | KHÔNG bị phạt thật (MISA đã xuất), nhưng DB lệch CQT audit Q |
  | `UNISSUED` | DB paid + age > threshold + MISA KHÔNG có invoice gốc cho `orderId` | 🔴 CRITICAL | **Bị phạt 6tr/HĐ nếu age > 24h** |
  | `DUPLICATE` | MISA có ≥2 invoice gốc (`ReferenceType=null OR 0`) cùng `orderId` | 🔥 CRITICAL | Vi phạm nghiệp vụ kế toán + audit thuế flag |

- **BR-08 — Age threshold cho `UNISSUED`:** tính `now - payment_on` theo giờ ICT.
  | Age hours | Severity escalation |
  |-----------|---------------------|
  | < 12h | INFO (chưa alert) |
  | 12-20h | 🟡 WARN |
  | 20-24h | 🔴 CRITICAL |
  | ≥ 24h | 🔥 CRITICAL **(đã phạt)** |

- **BR-09 — Severity ƯU TIÊN theo TUỔI đơn lâu nhất, KHÔNG theo COUNT:**
  Luật phạt tính per-hóa-đơn theo "trễ > 1 ngày làm việc". 1 đơn 25h vẫn phạt 6tr. 100 đơn mới paid 1h chưa cần panic.
  → Severity tổng cron tick = max severity của all bucket. Slack message tổng hợp tất cả bucket trong 1 message.

- **BR-10 — Dedup alert anti-spam:**
  Redis key `invoice-reconcile:alert-dedup:<date>:<maxAgeBucket>` TTL 90 phút.
  Bucket = `Math.floor(maxAgeHours / 4) * 4` (gom thành nhóm 4h: 0/4/8/12/16/20/24/28+).
  SETNX trước khi gửi Telegram: acquired → gửi; held → skip (tick trước đã alert cùng severity).
  Severity ESCALATE khi bucket nhảy (vd 19h → 21h sang bucket 20) → key mới, alert mới.

#### Cron + manual trigger

- **BR-11 — 3-tier cron schedule:**
  - **Scan tick:** `@Cron('*/5 * 8-22 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })` — mỗi 5 phút trong giờ làm việc 08:00-22:00 ICT (180 tick/ngày)
    - Mục đích: pull Layer 1 + Layer 2 → cập nhật Redis cache dashboard + detect change events → emit URGENT alert (Loại 2/3/4/5/6) ngay khi có
    - **KHÔNG gửi INFO recap** (Loại 1) — chờ tiếng tròn
  - **Hourly recap:** `@Cron('0 0 8-22 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })` — đúng tiếng tròn (08:00, 09:00, …, 22:00), 15 tick/ngày
    - Mục đích: gửi Loại 1 INFO Hourly Recap gộp diff tiếng qua
    - Reuse data từ scan tick gần nhất (đọc Redis cache), KHÔNG re-scan
  - **EOD recap:** `@Cron('0 0 21 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })` — 21:00 ICT hằng ngày
    - Mục đích: gửi Loại 7 EOD Daily Recap tổng kết cả ngày (08:00-21:00)
    - Replace luôn tiếng tròn 21:00 (chỉ gửi 1 message EOD, không gửi cả 2)
  - **KHÔNG chạy 22:01-07:59 ICT** (legacy batch chưa xuất xong, tránh false positive)
  - SETNX `invoice-reconcile:lock` TTL 4 phút anti-stampede cho scan tick (pattern F-019 awards:lock, 4min < 5min cron interval)
  - Hourly recap + EOD recap KHÔNG cần lock (chỉ đọc Redis, không scan DB/MISA)
  - Nếu scan lock held → skip tick + log warn (scan tick trước chưa xong)

- **BR-12 — Manual trigger:**
  - `POST /api/admin/invoice-reconcile/trigger` — chạy ngay 1 lần
  - Bypass dedup Redis (Finance vừa fix xong muốn verify)
  - Vẫn dùng cùng SETNX lock 5 phút — nếu cron đang chạy thì manual chờ + 409 message "Đang có cron khác chạy, thử lại sau 5 phút"

- **BR-13 — Idempotent:** chạy 2 lần liên tiếp cùng date phải ra cùng kết quả (không có side effect tới DB legacy, chỉ ghi Redis cache + Slack alert nếu severity ESCALATE).

#### MISA API integration

- **BR-14 — Token cache:** Redis key `misa:token` TTL = MISA expiry - 5 phút (token 14 ngày per spec).
  - Refresh khi MISA trả `TokenExpiredCode` 401 hoặc TTL < 5 phút
  - Single-tenant cron → không cần concurrent auth pool
  - PROD URL `https://api.meinvoice.vn/api/integration`, sandbox `https://testapi.meinvoice.vn/api/integration`

- **BR-15 — Paging pull strategy:**
  - `POST /invoice/paging?InvoiceWithCode=true` với body `{FromDate, ToDate, Skip, Take: 100, ListInvTemplate: []}`
  - Loop `Skip += 100` cho đến khi `Skip >= TotalCount`
  - Mỗi tick pull `today-1 → today` (2 ngày để cover edge case cron chạy 8AM còn đơn paid hôm qua trễ)
  - Filter B2C qua BR-06 regex
  - Timeout 10s/call, retry 3× exponential backoff (1s/2s/4s)

- **BR-16 — Error handling MISA API:**
  | Error | Action |
  |-------|--------|
  | Network timeout / 5xx | Retry 3× exp backoff |
  | 401 + `TokenExpiredCode` | Refresh token + retry 1× |
  | 401 khác | Alert CRITICAL "MISA AUTH FAIL" + skip tick |
  | 4xx khác | Log error + skip tick, KHÔNG alert (transient) |
  | All retry exhausted | Alert CRITICAL "MISA UNREACHABLE" |
  | Success nhưng Layer 1 vẫn chạy được | Báo trong report `layer2Status=DEGRADED`, alert WARN |

- **BR-17 — Graceful degradation:** Nếu Layer 2 MISA call fail toàn bộ → vẫn ship report Layer 1 với flag `layer2Status="UNAVAILABLE"`. KHÔNG block alert UNISSUED dựa trên Layer 1.

#### Timezone

- **BR-18 — Timezone reference:** TẤT CẢ tính toán date/age theo `Asia/Ho_Chi_Minh` (ICT, UTC+7).
  - `today` = `dayjs().tz('Asia/Ho_Chi_Minh').startOf('day')`
  - `payment_on` lưu DB là UTC → convert sang ICT trước khi compute age
  - MISA `InvDate` trả về `"2026-06-08T00:00:00+07:00"` — đã +07 sẵn

#### Alert channel

- **BR-19 — Alert channel priority:**
  1. **Telegram bot** (primary) — gửi vào group chat Finance + Danny.
     - Bot: BotFather tạo, lấy `bot_token` đặt env `TELEGRAM_BOT_TOKEN`
     - Group chat: thêm bot làm member admin, lấy `chat_id` (negative integer cho group) đặt env `TELEGRAM_INVOICE_ALERT_CHAT_ID`
     - API endpoint: `POST https://api.telegram.org/bot<token>/sendMessage`
     - Mention user: dùng Telegram `@username` (vd `@dannynguyen`) inline trong message body — Telegram tự highlight + push notify thành viên có @username matching.
  2. **Email** (fallback) — qua Mailchimp transactional, recipient list env `INVOICE_ALERT_EMAILS="danny@5bib.com,ketoan@5bib.com"`
  3. Nếu Telegram env unset → log warn + chỉ send email
  4. Nếu cả 2 unset → log warn + KHÔNG fail cron (alert tới `Logger.warn` đủ)

#### 7 loại Telegram alert (BR-25 → BR-31)

- **BR-25 — Loại 1: INFO Hourly Recap** (gửi đúng tiếng tròn 08:00-20:00, KHÔNG gửi 21:00 vì EOD thay)
  - **Trigger:** Hourly recap cron tick đúng tiếng tròn
  - **Dedup:** KHÔNG dedup (luôn gửi 1 lần/giờ nếu match condition)
  - **Skip condition:** KHÔNG có đơn pending (`UNISSUED + SYNC_LAG + DUPLICATE = 0`) AND KHÔNG có diff vs tiếng trước → bỏ qua tick để tránh noise
  - **Format:**
    ```
    📊 5BIB Invoice Recap — 14:00 ICT 2026-06-09
    
    🟢 OK:        45 đơn (đã xuất + match MISA)
    🟡 SYNC_LAG:  1 đơn (DB chưa update vat_ref)
    🔴 UNISSUED:  3 đơn (max age 16h, sắp WARN)
    🔥 DUPLICATE: 0 đơn
    
    Diff vs 1h trước:
      + 2 đơn paid mới
      + 1 đơn xuất xong (#200029420 → InvNo 00000023) ✅
      + 1 đơn UNISSUED age tăng 15h → 16h
    
    📌 Cần action: 0 critical
    🔗 Dashboard
    ```

- **BR-26 — Loại 2: WARN Bucket Escalation** (đơn vừa chạm 12h)
  - **Trigger:** Scan tick phát hiện đơn `UNISSUED` mới chạm `ageHours >= 12` lần đầu
  - **Dedup:** Redis `invoice-reconcile:alert:warn:<date>:<orderId>` TTL 24h — 1 alert/đơn/ngày
  - **Mục đích:** Cảnh báo sớm trước khi sát deadline 24h
  - **Format:**
    ```
    🟡 WARN — Đơn sắp đến deadline xuất hóa đơn
    
    Race 220 — order #200030145 — 1.200.000 đ
      • Paid: 2026-06-08 22:00 ICT
      • Age:  12h (còn 12h trước phạt)
      • Status: Chưa có vat_ref + MISA chưa thấy
      • Last MISA scan: 10:00 ICT (5p trước)
    
    → Báo DEV check legacy webhook MISA
    🔗 Order detail
    ```

- **BR-27 — Loại 3: CRITICAL Bucket Escalation** (đơn vừa chạm 20h, sắp phạt)
  - **Trigger:** Scan tick phát hiện đơn `UNISSUED` mới chạm `ageHours >= 20` lần đầu
  - **Dedup:** Redis `invoice-reconcile:alert:critical:<date>:<orderId>` TTL 24h
  - **Mục đích:** Cảnh báo còn <4h trước phạt — Finance + DEV phải XỬ LÝ NGAY
  - **Format:**
    ```
    🔴 CRITICAL — Còn <4h trước khi bị phạt 6tr
    
    Race 220 — order #200030145 — 1.200.000 đ
      • Paid: 2026-06-08 14:00 ICT
      • Age:  20h
      • Deadline xuất: 2026-06-09 14:00 ICT (còn ~4h)
    
    → XỬ LÝ NGAY: DEV trigger publish thủ công hoặc Finance liên hệ MISA support
    🔗 Order detail
    ```

- **BR-28 — Loại 4: BREACHED** (đơn vượt 24h, đã phạt)
  - **Trigger:** Scan tick phát hiện đơn `UNISSUED` mới chạm `ageHours >= 24` lần đầu
  - **Dedup:** Redis `invoice-reconcile:alert:breached:<orderId>` TTL 7 ngày — 1 alert/đơn/tuần (tránh spam khi đơn không được xuất nhiều ngày)
  - **Mục đích:** Ghi nhận case đã phạt để Finance document cho audit Q
  - **Format:**
    ```
    🔥 BREACHED — Đã quá deadline, dự kiến phạt 6.000.000 đ
    
    Race 220 — order #200030145 — 1.200.000 đ
      • Paid: 2026-06-08 09:00 ICT
      • Age:  25h (đã quá 1h)
      • Phí phạt dự kiến: 6.000.000 đ (NĐ 125/2020 Art. 24)
    
    → Finance team document case + báo Danny cho audit Q
    🔗 Order detail
    ```

- **BR-29 — Loại 5: DUPLICATE Detected** (MISA có ≥2 invoice gốc cùng orderId)
  - **Trigger:** Scan tick Layer 2 phát hiện duplicate mới (đơn chưa từng có DUPLICATE trong ngày)
  - **Dedup:** Redis `invoice-reconcile:alert:duplicate:<date>:<orderId>` TTL 24h
  - **Mục đích:** Phát hiện DEV leak test local sang PROD HOẶC legacy retry bug
  - **Format:**
    ```
    🔥 DUPLICATE INVOICE — MISA có nhiều hóa đơn gốc cùng order
    
    Order #200029416 — race 140 — 12.000 đ
      • 5 hóa đơn gốc trong MISA (InvNo 00000018-22)
      • Cùng buyer "Hiền Nghiêm", cùng InvSeries 1C26MBB
      • Phát hiện lúc: 14:23 ICT
    
    Khả năng: DEV test local push thẳng PROD, hoặc legacy retry bug
    → Báo DEV check NGAY + xuất hóa đơn HỦY (EInvoiceStatus=2) cho 4 cái dư
    🔗 Order detail
    ```

- **BR-30 — Loại 6: MISA System Health**
  - **Sub-case DEGRADED** (retry 3× mới success): KHÔNG alert riêng, mention banner trong Loại 1 recap "Layer 2 chậm"
  - **Sub-case UNAVAILABLE** (3 scan tick liên tiếp fail toàn bộ = 15p):
    - Dedup: Redis `invoice-reconcile:alert:misa-down:<date>:<hour>` TTL 1h — 1 alert/giờ
    - Format:
      ```
      ⚠️ CRITICAL — MISA Meinvoice API không kết nối được
      
        • 3 lần retry liên tiếp fail trong 15p qua
        • Last error: ECONNREFUSED https://api.meinvoice.vn
        • Impact: Layer 2 cross-check OFFLINE, có thể miss SYNC_LAG case
      
      → DEV check VPS network/MISA status (https://meinvoice.vn/status)
      → Dashboard hiển thị banner "MISA UNREACHABLE"
      🔗 Health endpoint
      ```
  - **Sub-case AUTH_FAIL** (401 không phải TokenExpiredCode):
    - Dedup: Redis `invoice-reconcile:alert:misa-auth:<date>` TTL 24h — 1 alert/ngày
    - Format tương tự UNAVAILABLE nhưng message: "MISA token bị reject — kiểm tra credentials env (`MISA_USERNAME`, `MISA_PASSWORD`, `MISA_TAX_CODE`)"

- **BR-31 — Loại 7: EOD Daily Recap** (21:00 hằng ngày)
  - **Trigger:** EOD recap cron tick 21:00 ICT
  - **Dedup:** KHÔNG dedup (1 lần/ngày)
  - **Skip condition:** KHÔNG skip (luôn gửi, kể cả khi 0 đơn pending — kế toán cần biết "ngày hôm nay không có vấn đề gì")
  - **Replace tiếng tròn 21:00:** Khi EOD cron fire, Hourly Recap cron 21:00 KHÔNG gửi (gating qua flag hoặc skip condition)
  - **Mục đích:** Kế toán end-of-day biết tổng kết cả ngày — base data cho daily check
  - **Format:**
    ```
    🌙 5BIB Invoice EOD Recap — 2026-06-09 (21:00 ICT)
    
    📊 Tổng kết ngày:
      • Đơn cần xuất:   48 đơn / 3.840.000 đ
      • Đã xuất thành công:  45 đơn / 3.500.000 đ (94%)
      • Còn pending:    3 đơn / 340.000 đ
        - 🟡 SYNC_LAG:  1 đơn (#200029416, InvNo 00000022)
        - 🔴 UNISSUED:  2 đơn (max age 18h)
        - 🔥 DUPLICATE: 0 đơn
      • 🔥 BREACHED:    0 đơn ✅ (KHÔNG đơn nào trễ >24h)
    
    📈 Trend so với hôm qua:
      • Đơn paid:       +12 đơn (+33%)
      • Đơn đã xuất:    +10 đơn (+29%)
      • Pending:        -2 đơn ✅
    
    🔧 MISA Health:
      • Layer 2 calls:   180 (OK 179, DEGRADED 1)
      • Token refresh:   0 (vẫn dùng token 13 ngày trước)
    
    🚨 Alert đã gửi hôm nay:
      • WARN:     2 lần
      • CRITICAL: 1 lần
      • DUPLICATE: 0 lần
      • MISA Health: 0 lần
    
    📌 Action cho ngày mai:
      • 2 đơn UNISSUED chưa xử lý — sáng mai 08:00 sẽ alert CRITICAL nếu vẫn pending
      • #200029416 SYNC_LAG kéo dài → DEV check sync bug
    
    🔗 Dashboard
    ```

- **BR-20 — Telegram message format (Vietnamese, parse_mode `HTML`):**
  ```
  🔴 <b>CRITICAL — Hóa đơn MISA chưa xuất</b>
  📅 Ngày: 2026-06-09
  ⏱ Cron: 14:00 ICT (manual trigger)
  
  ⚠️ <b>UNISSUED: 3 đơn</b>, đơn lâu nhất <b>22h</b> (sắp phạt!)
    • Race 220 — order <code>#200030145</code> — 1.200.000 đ — paid 22h trước
    • Race 220 — order <code>#200030148</code> — 800.000 đ — paid 21h trước
    • Race 140 — order <code>#200030200</code> — 50.000 đ — paid 20h trước
  
  🟡 <b>SYNC_LAG: 1 đơn</b> (MISA xuất rồi, DB chưa update)
    • Race 140 — order <code>#200029416</code> — InvNo 00000022 — báo DEV check sync
  
  🔥 <b>DUPLICATE: 0 đơn</b>
  
  📊 Tổng: 1 race-day pending (Race 220), 1 sync lag (Race 140)
  🔗 <a href="https://admin.5bib.com/admin/invoice-reconcile">Mở dashboard</a>
  
  @dannynguyen @ketoan_5bib — cần xử lý trong 4h
  ```
  - **KHÔNG mention `@username`** (Danny chốt 2026-06-08 — chỉ gửi vào group, không ping cá nhân)
  - Body length cap 4096 chars (Telegram limit) — nếu missing list > 20 đơn, truncate + suffix "... và N đơn nữa, xem dashboard"
  - HTTP request: `parse_mode=HTML`, `disable_web_page_preview=true`

- **BR-21 — Email format:** plain text Vietnamese (KHÔNG HTML tags Telegram), content tương tự. Subject: `[5BIB Invoice Alert] {ALERT_TYPE} - {SUMMARY} - {DATE}` (vd `[5BIB Invoice Alert] CRITICAL - Order #200030145 còn 4h trước phạt - 2026-06-09`).
  Email **CHỈ gửi khi Telegram fail** (kicked/network down) — KHÔNG gửi song song để tránh inbox spam.

#### Performance & Reliability

- **BR-22 — SLA reconcile run:**
  - Race ≤ 5K đơn/ngày: scan tick hoàn thành < 30s p95
  - Race ≤ 100 đơn/ngày (race 220 ngày đầu): scan tick hoàn thành < 5s p95
  - MISA API call: timeout 10s/call, total budget 60s (cron tick — 5min interval cho lock 4min)
  - Hourly recap + EOD recap: chỉ đọc Redis cache, < 1s p95

- **BR-23 — Cron miss recovery:**
  Nếu VPS down giữa ngày → scan tick tiếp theo khi up lại sẽ tự pull data `today-1 → today`. Cron không skip ngày (BR-15 đã cover edge case 2-day window).
  Nếu VPS down đúng lúc EOD 21:00 → EOD recap miss luôn (không catch-up). Hôm sau Hourly Recap 08:00 sẽ cover diff đêm qua.

- **BR-24 — Compliance SLA:**
  - 0 hóa đơn trễ > 24h cho race 140 + 220 trong tháng đầu (2026-06-09 → 2026-07-09)
  - Nếu CRITICAL alert phát đi mà Finance không xử lý trong 4h → escalate email Danny direct

---

## 🖥️ UI/UX Flow

### 2.1 Route structure

| Route | Type | Access |
|-------|------|--------|
| `/admin/invoice-reconcile` | Server Component shell + Client interactive | Logto admin role |

### 2.2 Layout — Admin Dashboard `/admin/invoice-reconcile`

**Header:**
- Breadcrumb: `Trang chủ › Đối soát hóa đơn MISA`
- Title h1: "Đối soát hóa đơn MISA Meinvoice"
- Subtitle: "Cập nhật lần cuối: {lastRunAt} (cron mỗi giờ 08-22h)"
- Action button (top-right): "Chạy reconcile ngay" — primary blue

**Body (3 sections):**

**Section A — KPI Strip (4 cards inline row):**
| Card | Color | Value | Subtitle |
|------|-------|-------|----------|
| "Đơn cần xuất hôm nay" | neutral | `{expected}` | "Race 140 + 220" |
| "Đã xuất" | green | `{issued}` | "DB vat_ref set" |
| "Còn thiếu" | red nếu >0, neutral nếu 0 | `{missing}` | "UNISSUED + SYNC_LAG" |
| "Đơn sắp phạt (>20h)" | red blink nếu >0 | `{atRisk}` | "Cần xử lý trong 4h" |

**Section B — Danh sách đơn missing (table):**
- Header: "Đơn missing — chi tiết"
- Filter pills (multiselect): `[UNISSUED] [SYNC_LAG] [DUPLICATE]` — default all selected
- Filter dropdown race: `Tất cả | Race 140 | Race 220`
- Table 8 cột:
  1. Severity badge (🔴/🟡/🔥)
  2. Race ID
  3. Order ID (mono font, clickable copy)
  4. Email người mua
  5. Total price (vi-VN locale, "1.200.000 đ")
  6. Paid at (relative time vi-VN, "3 giờ trước")
  7. Age hours (number, red if >20)
  8. Reason (VN label theo `BUCKET_LABEL[bucket]`)
- Sort default: severity DESC → age DESC
- Pagination 20/page

**Section C — MISA orphan (nếu có):**
- Collapse panel, default closed (vì rare case)
- Header: "MISA orphan: {count} hóa đơn MISA xuất nhưng KHÔNG match orderId nào trong DB"
- Body: list 8 cột (RefID, InvNo, InvDate, TotalAmount, BuyerName, ItemName, ItemCode, Action "Copy RefID")

### 2.3 UI Step-by-Step Numbered Table

#### Journey J1: Admin xem dashboard buổi sáng

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Open `/admin/invoice-reconcile` | Server Component fetch initial report từ cache Redis | Next.js SSR | Page hydrate với data |
| 2 | Page render | 4 KPI cards + Section B table + Section C collapse | TanStack Query `useGetReconcileReport()` | Data state |
| 3 | Click filter pill "UNISSUED" off | Table re-filter client-side (no refetch) | useState filter | Table show SYNC_LAG + DUPLICATE only |
| 4 | Click row order ID | Copy to clipboard + toast "Đã copy order #200030145" | onClick + navigator.clipboard | Toast 2s |

#### Journey J2: Admin chạy manual trigger sau khi Finance fix data

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Click "Chạy reconcile ngay" header right | Button loading state spinner + "Đang đối soát..." | onClick | Disabled |
| 2 | POST `/api/admin/invoice-reconcile/trigger` | Backend acquire lock + run + return new report | Mutation | Pending |
| 3a | Success 200 | Toast green "Đối soát xong, found {missing} đơn missing" + Section B refresh | onSuccess | Updated state |
| 3b | Conflict 409 (cron đang chạy) | Toast yellow "Đang có cron khác chạy, thử lại sau 5 phút" | onError | Re-enable button sau 5s |
| 3c | Error 500 | Toast red "Lỗi đối soát: {message}" + nút "Thử lại" | onError | Re-enable button |

#### Journey J3: Telegram alert tới Finance group

| # | Event | Behavior | Next |
|---|-------|----------|------|
| 1 | Cron tick 14:00 ICT detect 3 UNISSUED + 1 SYNC_LAG, max age 22h → CRITICAL | Service compose Telegram HTML message (BR-20 format) + mention `@dannynguyen @ketoan_5bib` | Send POST to Telegram Bot API |
| 2 | Redis SETNX dedup key `invoice-reconcile:alert-dedup:2026-06-09:20` (bucket 20-23h) | Acquired (first time at this bucket) | Continue send |
| 3 | `POST https://api.telegram.org/bot<token>/sendMessage` success (HTTP 200, body `{ ok: true, result: {...} }`) | Log info "Telegram alert sent: 3 UNISSUED + 1 SYNC_LAG, msg_id={N}" | Done |
| 4 | Cron tick 15:00 ICT, age vẫn 22h, bucket 20 unchanged | SETNX dedup same key → already held → skip Telegram | Quiet tick |
| 5 | Cron tick 16:00 ICT, age tăng lên 24h → bucket 24 mới | SETNX new dedup key `:24` → acquired → send escalate alert "🔥 BREACHED" | Re-alert |
| 6 | Telegram API error (rate limit 429 / bot kicked from group 403) | Retry 1× sau 1s; nếu fail → fallback email + log error | Fallback path |

### 2.4 Buttons Specification Table

| Button label | Position | Default state | Disabled state | Loading state | Action | Confirm dialog? |
|--------------|----------|---------------|----------------|---------------|--------|-----------------|
| "Chạy reconcile ngay" | Header right | Primary blue | KHÔNG | Spinner + "Đang đối soát..." (disable 5s after click min) | POST `/api/admin/invoice-reconcile/trigger` | NO |
| Filter pill `[UNISSUED]` etc | Section B top | Active (filled) | KHÔNG | N/A | Client filter toggle | NO |
| Filter dropdown "Race" | Section B top | "Tất cả" | KHÔNG | N/A | Client filter | NO |
| "Copy order ID" (row click) | Section B row | Cursor pointer | KHÔNG | N/A | navigator.clipboard.writeText + toast | NO |
| Section C "Xem MISA orphan" | Section C collapse trigger | Collapsed icon ▶ | Hide nếu count=0 | N/A | Expand panel | NO |

### 2.5 Form Fields Specification Table

(Không có form input — F-076 read-only + 1 button trigger. Race enable flag qua env, không qua UI MVP.)

### 2.6 Field source table

| Field UI label | Data source | Format hiển thị | Empty state |
|----------------|-------------|-----------------|-------------|
| KPI "Đơn cần xuất hôm nay" | `report.expectedCount` | integer | "0" |
| KPI "Đã xuất" | `report.issuedCount` | integer + "%" subtitle | "0 (0%)" |
| KPI "Còn thiếu" | `report.missingCount` (UNISSUED+SYNC_LAG total) | integer red if >0 | "0" |
| KPI "Đơn sắp phạt" | `report.atRiskCount` (age > 20h) | integer red blink if >0 | "0" |
| KPI footer "Next alert" | computed: next hourly tick OR 21:00 EOD | "Hourly recap lúc 15:00 ICT" | — |
| Table "Severity" | `row.severity` (enum) | Badge BUCKET_LABEL[severity] | — |
| Table "Race ID" | `row.raceId` | "Race {id}" | — |
| Table "Order ID" | `row.orderId` | "#{id}" mono | — |
| Table "Email" | `row.email` | text | "—" |
| Table "Total price" | `row.totalPrice` | `new Intl.NumberFormat('vi-VN').format(v) + ' đ'` | "0 đ" |
| Table "Paid at" | `row.paymentOn` | relative VN ("3 giờ trước") via dayjs.fromNow vi locale | "—" |
| Table "Age" | `row.ageHours` | `{n}h` red if >20 | "0h" |
| Table "Reason" | `row.bucket` (enum) | VN label theo BUCKET_REASON[bucket] | — |
| "Cập nhật lần cuối" | `report.runAt` | "HH:mm:ss DD/MM/YYYY" | "Chưa chạy" |

**Dictionary VN (centralized `invoice-reconcile-labels.ts`):**
```typescript
export const BUCKET_LABEL = {
  OK: '🟢 Đã xuất',
  SYNC_LAG: '🟡 DB chưa sync',
  UNISSUED: '🔴 Chưa xuất',
  DUPLICATE: '🔥 Trùng hóa đơn',
} as const;

export const BUCKET_REASON = {
  OK: 'Đã có hóa đơn MISA + DB match',
  SYNC_LAG: 'MISA đã xuất rồi nhưng vat_ref bên DB chưa update',
  UNISSUED: 'DB paid quá lâu nhưng MISA chưa thấy hóa đơn',
  DUPLICATE: 'MISA có ≥2 hóa đơn gốc cùng order — kiểm tra DEV test local hoặc retry bug',
} as const;

export const LAYER2_STATUS_LABEL = {
  OK: 'MISA verify OK',
  DEGRADED: 'MISA chậm (retry success)',
  UNAVAILABLE: 'MISA không kết nối được — chỉ có Layer 1',
} as const;
```

### 2.7 UI States — full coverage

| State | Behavior |
|-------|----------|
| **Loading initial** | Skeleton 4 KPI cards + skeleton 5 rows table |
| **Empty (0 missing all bucket)** | 4 KPI cards với green check "Hôm nay không có đơn nào cần xử lý" + table replace với illustration "Tất cả hóa đơn đã xuất ✅" |
| **Data normal** | 4 KPI cards + table full |
| **Filtered + empty (filter pill exclude all)** | Table message "Không có đơn nào khớp filter — clear filter để xem tất cả" + button "Xoá filter" |
| **Error fetch report** | Toast đỏ "Không tải được báo cáo — kiểm tra log backend" + button "Thử lại" |
| **Submitting manual trigger** | Button "Chạy reconcile ngay" loading + disable 5s min |
| **Success manual** | Toast green + KPI + table refresh từ response mới |
| **409 manual (cron đang chạy)** | Toast yellow "Đang có cron khác chạy, thử lại sau 5 phút" + button re-enable sau 5s |
| **Layer2 DEGRADED** | Banner yellow above KPI: "⚠️ MISA API chậm — số liệu có thể thiếu MISA verify (chỉ dựa DB)" |
| **Layer2 UNAVAILABLE** | Banner red above KPI: "🔴 MISA API không kết nối được — chỉ có Layer 1 (DB). Verify Layer 2 khi MISA back lên." + button "Thử lại MISA" |
| **No race enabled (env empty)** | Empty state với explainer "Chưa có race nào bật e-invoice. Set env INVOICE_RECONCILE_ENABLED_RACES rồi restart backend." |

---

## 🛠️ Technical Mandates

### 3.1 DB / Cache changes

**MongoDB:** KHÔNG đổi schema. Phase 1.1 thêm collection audit nếu cần.

**MySQL `'platform'` (READ-ONLY):**
- KHÔNG đụng schema legacy. Chỉ SELECT.
- New TypeORM entity `OrderMetadataReadonly` (named connection `'platform'`) chỉ map cột cần (BR-01) — pattern reuse F-028 `OrderReadonly`.

**Redis keys mới (extend Registry CLAUDE.md):**

| Key | Purpose | TTL |
|-----|---------|-----|
| `invoice-reconcile:lock` | SETNX anti-stampede scan cron + manual trigger | 4min (< 5min scan interval) |
| `invoice-reconcile:last-scan` | JSON snapshot scan tick gần nhất (hourly recap reuse) | 10min |
| `invoice-reconcile:last-run:<YYYY-MM-DD>` | Cache report JSON cho admin UI fast load | 24h |
| `invoice-reconcile:hourly-snapshot:<YYYY-MM-DD-HH>` | Snapshot tiếng đó để diff với tiếng kế tiếp | 24h |
| `invoice-reconcile:eod-alert-sent:<YYYY-MM-DD>` | Đánh dấu EOD recap đã gửi (gate skip Hourly 21:00) | 6h |
| `invoice-reconcile:alert:warn:<date>:<orderId>` | Dedup Loại 2 WARN per đơn per ngày | 24h |
| `invoice-reconcile:alert:critical:<date>:<orderId>` | Dedup Loại 3 CRITICAL per đơn per ngày | 24h |
| `invoice-reconcile:alert:breached:<orderId>` | Dedup Loại 4 BREACHED per đơn (week-long, đơn không xuất nhiều ngày) | 7 ngày |
| `invoice-reconcile:alert:duplicate:<date>:<orderId>` | Dedup Loại 5 DUPLICATE per đơn per ngày | 24h |
| `invoice-reconcile:alert:misa-down:<date>:<hour>` | Dedup Loại 6 UNAVAILABLE per giờ | 1h |
| `invoice-reconcile:alert:misa-auth:<date>` | Dedup Loại 6 AUTH_FAIL per ngày | 24h |
| `invoice-reconcile:daily-counters:<YYYY-MM-DD>` | Hash counter EOD recap: total scan ticks, MISA calls OK/degraded/fail, alert sent per loại | 48h |
| `misa:token` | Cache MISA OAuth token | MISA expiry - 5min (14 ngày - 5min default) |

**S3:** KHÔNG dùng.

**PAUSE flag:** KHÔNG có migration. KHÔNG có `pnpm install` mới (axios + dayjs + nodemailer/Mailchimp client đã có sẵn — Coder verify trước khi bắt đầu).

### 3.2 Backend Endpoint Specification

#### Endpoint #1: GET /api/admin/invoice-reconcile/today

| Element | Spec |
|---------|------|
| Method | GET |
| Path | `/api/admin/invoice-reconcile/today` |
| Auth | `@UseGuards(LogtoAdminGuard)` class-level |
| Guard role | admin |
| Request | Query param `date?: string` (yyyy-MM-dd, default today ICT) |
| Response DTO | `ReconcileReportDto` |
| Status codes | 200 success / 400 invalid date / 401 no auth / 403 not admin / 500 server |
| Side effects | KHÔNG (read-only, đọc từ Redis cache hoặc trigger 1 reconcile nếu cache miss) |
| Cache | Redis `invoice-reconcile:last-run:<date>` TTL 24h — cache hit return ngay, miss thì trigger reconcile inline (1 lần) |

#### Endpoint #2: POST /api/admin/invoice-reconcile/trigger

| Element | Spec |
|---------|------|
| Method | POST |
| Path | `/api/admin/invoice-reconcile/trigger` |
| Auth | `@UseGuards(LogtoAdminGuard)` |
| Guard role | admin |
| Request body | empty `{}` hoặc optional `{date?: string}` (default today ICT) |
| Response DTO | `ReconcileReportDto` (same as #1) |
| Status codes | 200 / 400 invalid date / 401 / 403 / **409 lock held** / 500 |
| Side effects | Acquire SETNX `invoice-reconcile:lock` 5min → run reconcile → release lock → update Redis cache → emit alert nếu severity ESCALATE (cùng dedup logic cron) |
| Special | KHÔNG bypass alert dedup (manual cũng dedup) |

#### Endpoint #3: GET /api/admin/invoice-reconcile/health

| Element | Spec |
|---------|------|
| Method | GET |
| Path | `/api/admin/invoice-reconcile/health` |
| Auth | `@UseGuards(LogtoAdminGuard)` |
| Request | none |
| Response DTO | `ReconcileHealthDto` |
| Status codes | 200 / 401 / 403 |
| Purpose | Admin biết: lastCronTickAt, MISA token expiry, layer2 status last call, enabled races list |
| Side effects | KHÔNG |

### 3.3 DTO Field-Level Spec

```typescript
// dto/reconcile-report.dto.ts
export class MissingInvoiceRowDto {
  @ApiProperty({ description: 'order_metadata.id', example: 200029416 })
  orderId!: number;

  @ApiProperty({ description: 'race_id', example: 140 })
  raceId!: number;

  @ApiProperty({ description: 'Email người mua', example: 'nghiemthuhien1221@gmail.com', required: false })
  email?: string | null;

  @ApiProperty({ description: 'Tổng tiền VND', example: 12000 })
  totalPrice!: number;

  @ApiProperty({ description: 'Thời gian paid (ISO 8601)', example: '2026-06-05T09:45:44.000Z' })
  paymentOn!: string;

  @ApiProperty({ description: 'order_category', example: 'ORDINARY' })
  orderCategory!: string;

  @ApiProperty({ description: 'Tuổi đơn tính theo giờ ICT', example: 76 })
  ageHours!: number;

  @ApiProperty({ enum: ['OK', 'SYNC_LAG', 'UNISSUED', 'DUPLICATE'], example: 'SYNC_LAG' })
  bucket!: 'OK' | 'SYNC_LAG' | 'UNISSUED' | 'DUPLICATE';

  @ApiProperty({ description: 'MISA InvNo đã match (nếu SYNC_LAG)', example: '00000022', required: false, nullable: true })
  misaInvNo?: string | null;

  @ApiProperty({ description: 'Số hóa đơn MISA duplicate (nếu DUPLICATE)', example: 5, required: false })
  duplicateCount?: number;
}

export class MisaOrphanRowDto {
  @ApiProperty({ description: 'MISA RefID', example: '200029999-20260608183000' })
  refId!: string;

  @ApiProperty({ description: 'MISA InvNo', example: '00000050' })
  invNo!: string;

  @ApiProperty({ description: 'MISA InvDate', example: '2026-06-08T00:00:00+07:00' })
  invDate!: string;

  @ApiProperty({ description: 'Tổng tiền', example: 12000 })
  totalAmount!: number;

  @ApiProperty({ description: 'Buyer full name từ MISA', example: 'Hiền Nghiêm', required: false })
  buyerFullName?: string;

  @ApiProperty({ description: 'Item name dòng đầu', example: '5BIB x COROS 5KM Priority 2434', required: false })
  itemName?: string;
}

export class ReconcileReportDto {
  @ApiProperty({ description: 'Ngày báo cáo (yyyy-MM-dd ICT)', example: '2026-06-09' })
  date!: string;

  @ApiProperty({ description: 'Thời điểm reconcile chạy (ISO 8601)', example: '2026-06-09T07:00:00.000Z' })
  runAt!: string;

  @ApiProperty({ description: 'Mode chạy', enum: ['cron', 'manual'], example: 'cron' })
  mode!: 'cron' | 'manual';

  @ApiProperty({ description: 'Race IDs scanned', example: [140, 220] })
  raceIdsScanned!: number[];

  @ApiProperty({ description: 'Tổng đơn paid cần xuất hóa đơn hôm nay', example: 48 })
  expectedCount!: number;

  @ApiProperty({ description: 'Đơn đã có vat_ref + MISA match', example: 44 })
  issuedCount!: number;

  @ApiProperty({ description: 'Đơn UNISSUED + SYNC_LAG (cần action)', example: 4 })
  missingCount!: number;

  @ApiProperty({ description: 'Đơn age > 20h (sắp phạt)', example: 1 })
  atRiskCount!: number;

  @ApiProperty({ description: 'Đơn duplicate', example: 1 })
  duplicateCount!: number;

  @ApiProperty({ description: 'Danh sách chi tiết missing rows', type: [MissingInvoiceRowDto] })
  missing!: MissingInvoiceRowDto[];

  @ApiProperty({ description: 'MISA orphan (xuất rồi nhưng DB không có orderId match)', type: [MisaOrphanRowDto] })
  misaOrphan!: MisaOrphanRowDto[];

  @ApiProperty({ description: 'Trạng thái Layer 2 MISA call', enum: ['OK', 'DEGRADED', 'UNAVAILABLE'], example: 'OK' })
  layer2Status!: 'OK' | 'DEGRADED' | 'UNAVAILABLE';

  @ApiProperty({ description: 'Max severity bucket tick này', enum: ['INFO', 'WARN', 'CRITICAL'], example: 'CRITICAL' })
  maxSeverity!: 'INFO' | 'WARN' | 'CRITICAL';

  @ApiProperty({ description: 'Có gửi alert lần chạy này không (do dedup)', example: true })
  alertSent!: boolean;
}

export class ReconcileHealthDto {
  @ApiProperty({ description: 'Lần cron tick cuối', example: '2026-06-09T07:00:00.000Z' })
  lastCronTickAt!: string | null;

  @ApiProperty({ description: 'Race IDs enabled (từ env)', example: [140, 220] })
  enabledRaceIds!: number[];

  @ApiProperty({ description: 'MISA token expires at', example: '2026-06-23T07:00:00.000Z' })
  misaTokenExpiresAt!: string | null;

  @ApiProperty({ description: 'Last MISA API call status', enum: ['OK', 'DEGRADED', 'UNAVAILABLE'], example: 'OK' })
  lastMisaStatus!: 'OK' | 'DEGRADED' | 'UNAVAILABLE';

  @ApiProperty({ description: 'Telegram bot configured', example: true })
  telegramConfigured!: boolean;

  @ApiProperty({ description: 'Telegram chat_id masked', example: '-100***7890', required: false, nullable: true })
  telegramChatIdMasked?: string | null;

  @ApiProperty({ description: 'Email alert recipients (masked)', example: ['da***@5bib.com', 'ke***@5bib.com'] })
  emailRecipientsMasked!: string[];
}
```

### 3.4 Frontend / Admin (Next.js)

- `app/(dashboard)/invoice-reconcile/page.tsx` — **Server Component** shell + initial fetch SSR
- `components/InvoiceReconcileClient.tsx` — `'use client'` — TanStack Query refetch + manual trigger mutation
- `components/MissingRowsTable.tsx` — `'use client'` — filter pills + sort
- `components/MisaOrphanCollapse.tsx` — `'use client'` — collapse panel
- `components/Layer2StatusBanner.tsx` — `'use client'` — banner conditional render
- `lib/invoice-reconcile-labels.ts` — VN dictionary (BR display convention CLAUDE.md)

**TanStack Query:**
- Query key: `['invoice-reconcile', 'today', date]` — staleTime 30s (cron mỗi giờ + Redis cache)
- Mutation: `useTriggerReconcile()` — onSuccess invalidate query + refetch

**SDK regen:** SAU khi backend đổi DTO, chạy:
```bash
pnpm --filter admin generate:api
```

**Revalidation:** KHÔNG dùng `revalidatePath/Tag` (admin tool, không có public cache).

**Display Convention** (CLAUDE.md): Backend trả enum raw `bucket: 'UNISSUED'` → frontend `BUCKET_LABEL[row.bucket]` map sang `'🔴 Chưa xuất'`. KHÔNG render raw enum.

### 3.5 Service architecture (high-level for Coder)

```
backend/src/modules/invoice-reconcile/
├── invoice-reconcile.module.ts
├── invoice-reconcile.controller.ts        # 3 endpoint trên
├── crons/
│   ├── scan-tick.cron.ts                  # @Cron('*/5 * 8-22 * * *') — 5p scan + URGENT alert
│   ├── hourly-recap.cron.ts               # @Cron('0 0 8-20 * * *') — 13 tick (skip 21h vì EOD thay)
│   └── eod-recap.cron.ts                  # @Cron('0 0 21 * * *') — daily summary
├── services/
│   ├── invoice-reconcile.service.ts       # core scan() — Layer 1 + Layer 2 + bucket classify
│   ├── misa-meinvoice.client.ts           # axios wrapper + token cache + retry
│   ├── invoice-alert.service.ts           # orchestrator 7 loại alert + Telegram + email fallback
│   ├── telegram-bot.client.ts             # POST sendMessage + HTML escape + 4096 truncate
│   ├── reconcile-classifier.ts            # pure function bucket classify (testable)
│   ├── alert-composer.ts                  # pure functions render 7 loại Telegram HTML message
│   ├── diff-computer.ts                   # pure function compute diff (current vs previous snapshot)
│   └── daily-counters.service.ts          # increment counters Redis hash for EOD recap
├── entities/
│   └── order-metadata-readonly.entity.ts  # TypeORM named conn 'platform'
├── dto/
│   ├── reconcile-report.dto.ts
│   ├── missing-invoice-row.dto.ts
│   ├── misa-orphan-row.dto.ts
│   └── reconcile-health.dto.ts
└── __tests__/
    ├── reconcile-classifier.spec.ts       # pure function tests (~15 cases)
    ├── invoice-reconcile.service.spec.ts  # mock MISA + mock TypeORM
    └── misa-meinvoice.client.spec.ts      # axios mock retry
```

**Module wiring:**
- `imports: [TypeOrmModule.forFeature([OrderMetadataReadonly], 'platform'), HttpModule, ScheduleModule.forFeature(...)]`
- `providers: [InvoiceReconcileService, MisaMeinvoiceClient, InvoiceAlertService, ReconcileCron]`
- Register `InvoiceReconcileModule` trong `app.module.ts`

### 3.6 PAUSE flags

- 🛑 **Coder PAUSE trước khi đẩy lên DEV:** Danny xác nhận đã hoàn thành 3 bước Telegram setup (1) BotFather tạo bot + lấy token, (2) tạo group "5BIB Finance Alert" + thêm bot làm admin, (3) lấy `chat_id` qua `getUpdates` API → đặt env `TELEGRAM_BOT_TOKEN` + `TELEGRAM_INVOICE_ALERT_CHAT_ID`. Nếu chưa → log warn + email-only fallback acceptable cho MVP.
- 🛑 **Coder PAUSE nếu phát hiện package mới cần install** (axios + dayjs đã có, KHÔNG nên thêm). Verify trước, nếu cần `pnpm install` thì hỏi Manager.
- 🛑 **Coder PAUSE nếu MISA paging response shape khác BR-15** (Manager đã verify PROD `data` là JSON string nested cần `JSON.parse(outer.data).PageData` rồi `JSON.parse` lần nữa) — implement parse defensive.

### 3.7 Env vars (Coder add to `backend/.env.example` + docker-compose)

```bash
# F-076 MISA Meinvoice integration
MISA_AIO_BASE_URL=https://api.meinvoice.vn/api/integration       # PROD
# MISA_AIO_BASE_URL=https://testapi.meinvoice.vn/api/integration # SANDBOX
MISA_APP_ID=78a5995d-b43c-4dfb-afe9-5425676f30f5
MISA_TAX_CODE=0110398986
MISA_USERNAME=ketoan@5bib.com
MISA_PASSWORD=<provided by Danny via 1Password>

# F-076 reconcile config
INVOICE_RECONCILE_ENABLED_RACES=140,220
INVOICE_RECONCILE_AGE_WARN_HOURS=12
INVOICE_RECONCILE_AGE_CRITICAL_HOURS=20
INVOICE_RECONCILE_AGE_BREACHED_HOURS=24

# F-076 alert channels — Telegram primary
TELEGRAM_BOT_TOKEN=<Danny tạo bot qua @BotFather và paste token>
TELEGRAM_INVOICE_ALERT_CHAT_ID=<chat_id của group "5BIB Finance Alert", negative integer e.g. -1001234567890>
TELEGRAM_MENTION_USERNAMES=dannynguyen,ketoan_5bib  # CSV, KHÔNG có @ prefix
INVOICE_ALERT_EMAILS=danny@5bib.com,ketoan@5bib.com  # email fallback
```

---

## 🛡️ Testing Mandates

### 4.1 Backend Test Cases

#### Pure classifier tests (reconcile-classifier.spec.ts) — KHÔNG mock DB/HTTP

**TC-01 — Classify OK**
| Element | Value |
|---------|-------|
| Input DB row | `{ id: 200029420, vat_ref: '00000023', payment_on: '2026-06-05T09:45:00Z' }` |
| Input MISA invoices for orderId | `[{ RefID: '200029420-...', InvNo: '00000023', ReferenceType: null }]` |
| now (ICT) | `2026-06-08T14:00:00+07:00` |
| Expected bucket | `'OK'` |
| Expected ageHours | `76` |

**TC-02 — Classify SYNC_LAG (DB NULL, MISA có invoice gốc)**
| Element | Value |
|---------|-------|
| Input DB row | `{ id: 200029416, vat_ref: null, payment_on: '2026-06-05T09:45:00Z' }` |
| Input MISA invoices | `[{ RefID: '200029416-20260608110754', InvNo: '00000018', ReferenceType: null }]` |
| Expected bucket | `'SYNC_LAG'` |
| Expected misaInvNo | `'00000018'` (first invoice gốc) |

**TC-03 — Classify UNISSUED + WARN (DB NULL, MISA không có, age 13h)**
| Element | Value |
|---------|-------|
| Input DB row | `{ id: 999, vat_ref: null, payment_on: now - 13h }` |
| Input MISA invoices for orderId | `[]` |
| Expected bucket | `'UNISSUED'` |
| Expected severity | `'WARN'` |
| Expected ageHours | `13` |

**TC-04 — Classify UNISSUED + CRITICAL (age 22h)**
| Input | age 22h |
| Expected severity | `'CRITICAL'` |
| Expected atRisk | `true` |

**TC-05 — Classify UNISSUED + BREACHED (age 25h)**
| Input | age 25h |
| Expected severity | `'CRITICAL'` |
| Expected breached | `true` (UI red blink) |

**TC-06 — Classify DUPLICATE (≥2 invoice gốc cùng orderId)**
| Element | Value |
|---------|-------|
| Input DB row | `{ id: 200029416, vat_ref: '00000022', ... }` |
| Input MISA invoices | 5 invoices same orderId all `ReferenceType=null` |
| Expected bucket | `'DUPLICATE'` |
| Expected duplicateCount | `5` |
| Expected severity | `'CRITICAL'` |

**TC-07 — DUPLICATE EXCLUDE replacement/adjustment**
| Input MISA invoices | 1 invoice `ReferenceType=null` + 1 `ReferenceType=1` (thay thế) + 1 `ReferenceType=2` (điều chỉnh) |
| Expected bucket | `'OK'` (chỉ 1 gốc) |

**TC-08 — RefID B2C filter regex**
- `'200029416-20260608172739'` → match B2C ✅
- `'200029416-06/05/2026 15:49:19Z'` → match B2C ✅ (legacy format)
- `'90d6eb31-a652-4ffd-82ab-5e1b451fcd7a'` → KHÔNG match (B2B GUID) ❌
- `'200029999'` → KHÔNG match (no timestamp segment) ❌

**TC-09 — Filter INSURANCE + MANUAL khỏi expected**
| Input | DB rows includes `order_category: 'INSURANCE'` + `'MANUAL'` |
| Expected | Cả 2 KHÔNG có trong `expectedCount` + `missing` |

**TC-10 — MISA orphan detection**
| Input MISA invoices | 1 invoice RefID `'200030555-...'` |
| Input DB rows | KHÔNG có orderId 200030555 |
| Expected | Vào `misaOrphan` array, KHÔNG vào `missing` |

#### Service integration tests (invoice-reconcile.service.spec.ts) — mock MySQL + MISA client

**TC-11 — Happy path full flow**
| Method | `service.run({ date: '2026-06-09', mode: 'manual' })` |
| Mock MySQL | Return 5 rows (3 OK + 1 SYNC_LAG + 1 UNISSUED 22h) |
| Mock MISA | Return paging response với 3 invoices match + 1 invoice cho SYNC_LAG orderId + 0 cho UNISSUED |
| Expected return | `ReconcileReportDto` với `expectedCount=5, issuedCount=3, missingCount=2, atRiskCount=1, maxSeverity='CRITICAL', layer2Status='OK'` |
| Side effect verify | Redis `invoice-reconcile:last-run:2026-06-09` SET; Telegram `InvoiceAlertService.send()` called 1× với severity CRITICAL |

**TC-12 — Layer 2 MISA timeout → DEGRADED**
| Mock MISA | First 2 calls throw timeout, 3rd success |
| Expected | `layer2Status='DEGRADED'`, report vẫn ship |

**TC-13 — Layer 2 MISA all retries exhaust → UNAVAILABLE**
| Mock MISA | All 3 retries throw |
| Expected | `layer2Status='UNAVAILABLE'`, report dựa Layer 1 only, `InvoiceAlertService.send()` called với "MISA UNREACHABLE" WARN, Telegram message sent |

**TC-14 — Alert dedup**
| Setup | Run 1× với CRITICAL → Redis dedup key SET |
| Run 2nd | Cùng date + cùng maxAgeBucket (4h-window) |
| Expected | `alertSent=false`, Telegram KHÔNG được gọi |

**TC-14b — Alert escalate khi bucket nhảy**
| Setup | Run 1× với age 19h → bucket 16 SET |
| Run 2nd | age 21h → bucket 20 |
| Expected | `alertSent=true`, Telegram được gọi với escalate message |

**TC-15 — Manual trigger bypass dedup OFF (BR-12 chốt: KHÔNG bypass)**
| Method | `POST /trigger` lần 2 trong 5 phút |
| Expected | Status 409 "Lock held", body `{ code: 'RECONCILE_IN_PROGRESS' }` |

**TC-16 — Lock acquired by cron, manual race**
| Setup | Cron đang chạy (lock held) |
| Manual call | 409 ngay |
| Expected response | `{ code: 'RECONCILE_IN_PROGRESS', message: 'Đang có cron khác chạy, thử lại sau 5 phút' }` |

#### MISA client tests (misa-meinvoice.client.spec.ts)

**TC-17 — Token cache hit**
| Setup | Redis `misa:token` SET với valid token |
| Call | `client.getToken()` |
| Expected | Return cached token, KHÔNG gọi POST /auth/token |

**TC-18 — Token expired refresh**
| Setup | Redis token TTL < 5min |
| Call | Auto refresh via POST /auth/token |
| Expected | New token cached, request retry |

**TC-19 — 401 TokenExpiredCode retry**
| Mock first call | 401 + body `{ errorCode: 'TokenExpiredCode' }` |
| Mock 2nd call | 200 success |
| Expected | Refresh token + retry → success |

**TC-20 — Paging pagination loop**
| Mock paging | Skip=0 returns 100 + TotalCount=250; Skip=100 returns 100; Skip=200 returns 50 |
| Call | `client.listInvoicesByDateRange('2026-06-09', '2026-06-09')` |
| Expected | Return 250 invoices total, 3 paging calls |

**TC-21 — Response shape defensive parse**
| Mock response | `{ data: '"[json string]"' }` (double-encoded) |
| Expected | Parse correctly, không crash |

**TC-22 — Network timeout retry 3× exp backoff**
| Mock | timeout, timeout, success |
| Expected | 3 calls, total delay ~3s (1s + 2s), return success |

**TC-23 — All retry exhaust**
| Mock | timeout × 3 |
| Expected | Throw `MisaUnavailableError` |

#### Telegram bot client tests (telegram-bot.client.spec.ts)

**TC-23a — Send message happy path**
| Mock POST `https://api.telegram.org/bot.../sendMessage` | 200 `{ ok: true, result: { message_id: 42 } }` |
| Call | `telegramBot.send({ html: '<b>test</b>', mentions: ['dannynguyen'] })` |
| Expected | Body params `chat_id`, `text`, `parse_mode='HTML'`, `disable_web_page_preview=true`; mention appended as `@dannynguyen` at end of text; returns `42` |

**TC-23b — HTML escape ngăn injection**
| Input order email | `'evil<script>alert(1)</script>@x.com'` |
| Expected | Email escaped trong `<code>` block: `&lt;script&gt;alert(1)&lt;/script&gt;` |

**TC-23c — Truncate khi vượt 4096 chars**
| Input | 50 missing rows render = 6000 chars |
| Expected | Truncate ở 4000 chars + suffix `\n... và N đơn nữa, xem dashboard` |

**TC-23d — Telegram 429 rate limit**
| Mock | First call 429 `{ ok: false, error_code: 429, parameters: { retry_after: 1 } }`; 2nd call 200 |
| Expected | Wait 1s + retry 1× → success |

**TC-23e — Telegram 403 bot kicked**
| Mock | 403 `{ ok: false, error_code: 403 }` |
| Expected | Throw `TelegramKickedError`; InvoiceAlertService catch → fallback email |

#### Endpoint integration test (controller)

**TC-24 — GET /today happy path**
| Method | GET |
| URL | `/api/admin/invoice-reconcile/today` |
| Headers | `Authorization: Bearer <admin_token>` |
| Setup | Redis cache hit |
| Expected status | 200 |
| Expected body shape | `ReconcileReportDto` |
| MUST NOT leak | password fields, MISA token raw, internal stack traces |

**TC-25 — GET /today no auth**
| Headers | (empty) |
| Expected status | 401 |

**TC-26 — GET /today non-admin (staff role)**
| Token | staff |
| Expected status | 403 |

**TC-27 — POST /trigger happy path**
| Method | POST |
| URL | `/api/admin/invoice-reconcile/trigger` |
| Body | `{}` |
| Setup | Lock not held |
| Expected status | 200 |
| Expected body | `ReconcileReportDto` |
| Side effect | Redis cache updated, lock released after |

**TC-28 — POST /trigger 409 lock held**
| Setup | Set lock manually |
| Expected status | 409 |
| Expected body | `{ code: 'RECONCILE_IN_PROGRESS', message: 'Đang có cron khác chạy, thử lại sau 5 phút' }` |

**TC-29 — Concurrent POST /trigger 10×**
| Method | 10× parallel via Promise.all |
| Expected | Exactly 1× returns 200, 9× return 409 |
| Verify | Lock works |

**TC-30 — GET /health**
| Expected status | 200 |
| Expected body | `ReconcileHealthDto` với `enabledRaceIds: [140, 220]`, `telegramConfigured: true`, `emailRecipientsMasked: ['da***@5bib.com']` |
| MUST NOT leak | MISA password, full Telegram bot token, full chat_id, full email addresses raw |

### 4.2 Frontend E2E Test Cases (Playwright)

| TC | Persona | Journey | Steps | Expected |
|----|---------|---------|-------|----------|
| E2E-01 | Admin | Xem dashboard sáng | 1. Login admin 2. Go `/admin/invoice-reconcile` | 4 KPI cards render + table render với data hoặc empty state |
| E2E-02 | Admin | Empty state (0 missing) | 1. Mock backend 0 missing 2. Reload | "Tất cả hóa đơn đã xuất ✅" illustration |
| E2E-03 | Admin | Manual trigger success | 1. Click "Chạy reconcile ngay" 2. Wait response | Button loading → toast green + table refresh |
| E2E-04 | Admin | Manual trigger 409 | 1. Backend lock held 2. Click trigger | Toast yellow "Đang có cron khác..." + button re-enable sau 5s |
| E2E-05 | Admin | Filter pill | 1. Default all 3 pills active 2. Click "UNISSUED" off | Table re-filter client-side, count update |
| E2E-06 | Admin | Click row order ID | 1. Click row 2. Verify clipboard | `navigator.clipboard` write + toast "Đã copy" |
| E2E-07 | Admin | Layer 2 DEGRADED banner | 1. Mock backend `layer2Status='DEGRADED'` | Yellow banner render above KPI |
| E2E-08 | Admin | Layer 2 UNAVAILABLE banner | 1. Mock `layer2Status='UNAVAILABLE'` | Red banner + "Thử lại MISA" button |
| E2E-09 | Admin | Layer2 MISA orphan collapse | 1. Mock 2 orphan rows | Section C visible với count "2", click expand → table |
| E2E-10 | Admin | No race enabled (empty env) | 1. Mock backend `enabledRaceIds=[]` | Empty state "Chưa có race nào bật e-invoice..." |

### 4.3 Security Checks

- [ ] Endpoint protected by `LogtoAdminGuard` — verify TC-25 + TC-26
- [ ] **NO MISA credentials in response** — TC-30 mask email, KHÔNG return password/full token/full Telegram bot token/full chat_id
- [ ] Response KHÔNG leak: `_id` raw MongoDB, internal stack traces, MISA AppID full, MISA password
- [ ] **Telegram bot token + chat_id KHÔNG log ra `Logger.log`** (Coder MUST `Logger.log('Sending Telegram alert chat_id=-100***7890')` mask)
- [ ] Telegram message body HTML escape mọi user-controlled string (buyer email, order ID) — TC-23b verify ngăn injection `<script>`
- [ ] MISA API call hardcode `MISA_AIO_BASE_URL` env-only, **KHÔNG cho user-controlled URL** (TD-CRIT-04 SSRF defense)
- [ ] Telegram API URL hardcode `https://api.telegram.org/bot<token>/sendMessage`, KHÔNG cho user-controlled URL
- [ ] Rate limit `POST /trigger` 6 lần/phút/user (qua ThrottlerGuard) — tránh accidentally DDoS MISA + Telegram
- [ ] Audit log emit `invoice_reconcile.triggered` mỗi manual trigger (qua AuditModule Optional inject)

### 4.4 Performance SLA

| Endpoint | Target p95 | Cache hit ratio | 10x flaky |
|----------|-----------|-----------------|-----------|
| `GET /today` (cache hit) | < 100ms | > 95% trong giờ làm việc | PASS 10/10 |
| `GET /today` (cache miss → trigger inline) | < 5s race 220 ngày đầu (≤100 đơn), < 30s race 5K đơn | n/a first call | PASS 10/10 |
| `POST /trigger` happy path | < 30s race ≤5K đơn | n/a | PASS 10/10 |
| `POST /trigger` concurrent 10× | Exactly 1 success + 9× 409 | n/a | PASS 10/10 |
| Cron tick | < 30s race ≤5K đơn | n/a | PASS 10/10 |

### 4.5 Smoke test PROD post-deploy (MANDATORY checklist Danny + Manager)

- [ ] Cron tick first run 08:00 ICT 2026-06-09 → log success
- [ ] `GET /api/admin/invoice-reconcile/today` returns valid `ReconcileReportDto` với `raceIdsScanned: [140, 220]`
- [ ] `POST /trigger` returns 200 + report
- [ ] Telegram group "5BIB Finance Alert" nhận test message (Manager send qua admin trigger) — verify mention `@dannynguyen` highlighted + push notify
- [ ] MISA `misa:token` Redis key SET với TTL ~14 ngày
- [ ] Health endpoint trả `layer2Status: 'OK'` + `telegramConfigured: true` + `telegramChatIdMasked: '-100***7890'`
- [ ] Verify race 140 đơn `200029416` xuất hiện trong bucket `SYNC_LAG` (đây là case real đã verify Manager session)
- [ ] Verify race 140 đơn `200025061` (CODE_TRANSFER 98 ngày) xuất hiện UNISSUED với severity CRITICAL — Finance team handle thủ công nếu cần

---

## 📌 Answers to Manager's PAUSE conditions (từ file 00)

### Tier A — BLOCK MVP

#### #1 — Race enable flag nằm đâu?
**Trả lời:** Hardcode env `INVOICE_RECONCILE_ENABLED_RACES="140,220"` (CSV). Pattern reuse F-030 `env.provider`. Reload cần restart backend (~30s).
**Lý do:** MVP deadline mai. Add column DB legacy schema cần coord với legacy team — defer Phase 2.

#### #2 — Đơn nào REQUIRES invoice?
**Trả lời:** BR-01 SQL filter:
```
internal_status = 'COMPLETE'
AND financial_status = 'paid'
AND deleted = 0
AND order_category NOT IN ('INSURANCE', 'MANUAL')
```
- INSURANCE = child order MISA gộp với parent (verified DB)
- MANUAL = offline không qua flow MISA (F-016 lesson)
- Tất cả category còn lại CẦN xuất (verified `CODE_TRANSFER` 17/17 paid all-time có `total_price > 0`)
- **KHÔNG ngưỡng tiền** (luật VN: hóa đơn bắt buộc cho mọi giao dịch ≥ 200k, nhưng F-076 conservative — flag tất cả paid)

#### #3 — Cut-off time mỗi ngày?
**Trả lời:** KHÔNG có cut-off cứng wall-clock. Threshold severity dựa `now - payment_on` ICT theo BR-08:
- 12h → WARN
- 20h → CRITICAL
- 24h → BREACHED (đã phạt)

Cron chạy 08-22h ICT. Cuối tuần + lễ tết KHÔNG ân hạn (luật VN tính theo ngày làm việc nhưng F-076 conservative — alert tất cả ngày).

#### #4 — Kênh alert + recipient?
**Trả lời:** **Telegram bot** (Danny chốt 2026-06-08):
- Bot tạo qua @BotFather: `@invoice_5bib_daily_bot`, token `TELEGRAM_BOT_TOKEN=8804367165:AAG...` (Manager đã verify live)
- Group supergroup "5BIB Invoice Arlert" — `TELEGRAM_INVOICE_ALERT_CHAT_ID=-1003743947167` (supergroup chat_id, stable)
- **KHÔNG mention `@username`** — chỉ gửi vào group, ai check thì thấy (Danny chốt — đơn giản)
- Email fallback `danny@5bib.com, ketoan@5bib.com` (env `INVOICE_ALERT_EMAILS`) — CHỈ gửi khi Telegram API fail (kicked/network down)
- SMS KHÔNG dùng MVP (defer)

#### #5 — Escalation rule?
**Trả lời:** Theo TUỔI đơn lâu nhất (BR-08 + BR-09), KHÔNG theo count:
- max age < 12h → INFO (KHÔNG alert)
- max age 12-20h → WARN Telegram group, KHÔNG mention
- max age 20-24h → CRITICAL Telegram group + mention `@dannynguyen @ketoan_5bib` + email
- max age ≥ 24h → CRITICAL Telegram group + mention + email + log Logger.error "BREACHED"

**Lý do:** Luật phạt per-hóa-đơn theo "trễ > 1 ngày". 1 đơn 25h vẫn phạt 6tr. 100 đơn mới paid 1h chưa cần panic.

### Tier B — defer Phase 1.1

#### #6 — Đơn refund/void sau xuất hóa đơn?
**Defer Phase 2.** F-076 v1 chỉ care đơn `financial_status='paid'` hiện tại. Adjustment/replacement invoice (`EInvoiceStatus=3/5`) handle Phase 2.

#### #7 — Backfill race 140?
**Đã verify:** race 140 có 1 đơn ORDINARY pending (`200029416` SYNC_LAG) + 1 đơn CODE_TRANSFER 98 ngày (`200025061` UNISSUED CRITICAL). F-076 v1 sẽ tự surface cả 2 trong cron tick đầu tiên — Finance handle thủ công.

#### #8 — Cron frequency?
**Đã chốt 2026-06-08 (Danny update):** 3-tier cron:
1. **Scan tick** `*/5 * 8-22 * * *` ICT (mỗi 5 phút, 180 tick/ngày) — pull data + URGENT alert
2. **Hourly recap** `0 0 8-20 * * *` ICT (đúng tiếng tròn 08:00-20:00, 13 tick — skip 21:00 vì EOD thay)
3. **EOD recap** `0 0 21 * * *` ICT (21:00 hằng ngày)

Lý do: legacy 5BIB publish hóa đơn theo job 5p, F-076 scan cùng tần suất để dashboard real-time + URGENT escalation event-based (không đợi 1 tiếng để biết CRITICAL). Hourly recap gộp diff để kế toán không bị spam. EOD recap cuối ngày Finance check trước khi off.

#### #9 — Layer 2 MISA API verify?
**Ship trong MVP.** Manager session đã verify PROD `/invoice/paging` 100% feasible. Lesson F-019 v2 — không trust 1 source. Layer 2 catch SYNC_LAG (200029416 case verify) + DUPLICATE bug.

#### #10 — `vat_ref` format?
**Đã verify:** `vat_ref varchar(64)` lưu **MISA InvNo** (8-digit zero-pad string, vd `"00000023"`). Confirmed via cross-DB query order 200029420 + 200029458.

#### #11 — Server backend container TZ?
**TBD verify pre-deploy.** Assume UTC (Docker default). Service code MUST convert sang `Asia/Ho_Chi_Minh` cho mọi date/age computation (BR-18). Coder include test với TZ env `TZ=UTC`.

#### #12 — Audit log retention?
**Defer Phase 1.1.** MVP dùng Slack history + Redis last-run 24h. Phase 1.1 add Mongo collection `invoice_reconcile_runs` nếu Finance audit cần lookup history > 24h.

#### #13 — Scale forecast?
**Q3 2026:** dự kiến 5-10 race enable e-invoice. F-076 architecture (cron + per-race scan) đủ. Nếu >50 race cần extend BullMQ Phase 2.

---

## ✅ Status

- [ ] DRAFT
- [x] **READY** — sẵn sàng cho Manager `/5bib-plan` review

---

## 🔗 Next step

Danny chạy: `/5bib-plan FEATURE-076-misa-invoice-daily-reconcile`

Manager sẽ:
1. Đối chiếu PRD vs `00-manager-init.md` impact map
2. Spot-check code thật (3 file): `reconciliation-query.service.ts` (cross-DB pattern), `dashboard-aggregator.cron.ts` (cron pattern), `app.module.ts` (verify ScheduleModule.forRoot có sẵn)
3. Validate Scope Lock + PAUSE points cho Coder
4. Verdict: `✅ APPROVED` → Coder bắt đầu, hoặc `🟡 NEEDS_REVISION` → BA fix
