# FEATURE-069: PRD Revision R3 — Data Layer Schema Correction (CRITICAL)

**Status:** 🔵 READY (re-submit cho Manager `/5bib-plan`)
**Last updated:** 2026-06-05
**Author:** 5bib-po-ba
**Supersedes data layer:** `01-ba-prd.md` (R1) BR-MP-05/06/07/08/09/10/11/12 + Field Source Table + `01-ba-prd-revision-r2.md` (R2) BR-MP-21b/c data assumptions
**Trigger:** Danny challenge 2026-06-05 "đã đọc structure DB chưa?" → Manager `TD-F069-PRD-DATALAYER-SCHEMA-MISMATCH` (known-issues.md, BLOCKING M2b)

---

## 🙏 BA Acknowledgment — Lỗi gốc rễ của tao

Tao (BA) viết R1/R2 data layer dựa trên **giả định** MySQL schema, KHÔNG đọc 3 nguồn proven active code. Đây là vi phạm chính nguyên tắc của tao: *"Mơ hồ ở PRD = bug ở prod."* Tao đã đẻ ra 10 discrepancy schema sẽ làm M2b query fail toàn bộ nếu Coder code theo PRD as-is. Manager APPROVE là gate miss thứ 2, nhưng **người đẻ ra spec sai là tao.**

R3 này fix bằng cách đọc THẬT (3 source of truth) + đối chiếu column-by-column. Chỗ nào codebase chưa proven → tao **PAUSE flag yêu cầu query DISTINCT thật**, KHÔNG bịa thêm.

---

## 📚 SOURCE OF TRUTH (proven active production code)

R3 + M2b SQL PHẢI bám 3 file này. KHÔNG được assume ngoài đây:

| Source | File | Proven |
|---|---|---|
| **A. Fee/Revenue aggregate** | `analytics/services/fee-aggregate.helpers.ts` | `om.race_id`, `om.financial_status='paid'`, `om.payment_on`, `om.total_discounts`, `om.order_category`, `om.payment_ref`, `JOIN races r ON r.race_id=om.race_id` (tenant via `r.tenant_id`), `order_line_item.order_id=om.id` |
| **B. Course/Ticket breakdown chain** | `reconciliation/services/reconciliation-query.service.ts:103-123` | `order_line_item oli → order_metadata o ON oli.order_id=o.id → ticket_type tt ON oli.ticket_type_id=tt.id → race_course rc ON tt.race_course_id=rc.id WHERE rc.race_id=?`. Cols: `o.internal_status='COMPLETE'`, `o.processed_on`, `tt.type_name`, `rc.name AS distance`, `oli.quantity`, `o.total_discounts`, `o.total_price` |
| **C. Tenant-scoped paid revenue** | `analytics/analytics.service.ts:353-354, 764-765` + `dashboard/services/kpi.service.ts:217` | Canonical: `FROM order_metadata om JOIN races r ON r.race_id=om.race_id WHERE om.financial_status='paid' AND r.tenant_id=?` |

Entities (read-only, minimum-mapped): `finance/entities/order-readonly.entity.ts`, `race-master-data/entities/{order-line-item,ticket-type,race-course}-readonly.entity.ts`, `promo-hub/entities/race-readonly.entity.ts`.

---

## 🔴 10 Discrepancies — Corrected

### DISC-1 🔴 `order_metadata` KHÔNG có `race_course_id` (BR-MP-07 course breakdown)

**R1 sai:** "Vé bán theo course = COUNT `order_metadata` GROUP BY `race_course_id`".

**Thật:** order_metadata KHÔNG biết course. Course linkage đi qua chain (Source B):
```sql
order_line_item oli
  JOIN order_metadata o   ON oli.order_id = o.id
  JOIN ticket_type tt     ON oli.ticket_type_id = tt.id
  JOIN race_course rc     ON tt.race_course_id = rc.id
WHERE rc.race_id = ?
```

**R3 fix BR-MP-07 — Ticket Sales data source (replace):**

| Metric | Real SQL source | Note |
|---|---|---|
| Tổng vé bán | `SUM(oli.quantity)` qua chain, filter status (xem DISC-2) | Vé = line item quantity, KHÔNG phải order count |
| Vé theo cự ly (course) | `SUM(oli.quantity) GROUP BY rc.id` (chain B) | rc.name = distance label ('21KM'/'42KM') |
| Vé theo loại vé | `SUM(oli.quantity) GROUP BY tt.id` (chain B) | tt.type_name = ticket type name |
| Tổng đơn | `COUNT(DISTINCT om.id)` filter status | order count khác ticket count |
| Xu hướng đăng ký | `GROUP BY DATE(om.payment_on)` (paid) hoặc `DATE(om.processed_on)` (all status) — xem DISC-8 | bucket theo granularity |

### DISC-2 🔴 Status column thật (BR-MP-08 — 6-enum tao BỊA)

**R1 sai:** BR-MP-08 liệt kê 6 status `completed/paid/pending/cancelled/refunded/voided` + "COUNT GROUP BY `order_status`". **`order_status` column KHÔNG tồn tại. 6-enum hoàn toàn fabricated.**

**Thật (proven codebase grep):**
- `om.financial_status` values proven: **`'paid'`, `'voided'`** (analytics.service.ts:240/258). KHÔNG có pending/cancelled/refunded/completed.
- `om.internal_status` values proven: **`'COMPLETE'`** (reconciliation + fee.service).
- KHÔNG có column `order_status`.

**R3 fix BR-MP-08 — 🛑 PAUSE-R3-01 (Danny/Manager query thật):**

BA KHÔNG được bịa status set lần 2. Cần Danny chạy trên MySQL `5bib_platform_live`:
```sql
SELECT financial_status, COUNT(*) FROM order_metadata GROUP BY financial_status;
SELECT internal_status, COUNT(*) FROM order_metadata GROUP BY internal_status;
```
→ Lấy FULL distinct value set + count thực tế. Sau đó BA finalize:
- **Ticket Sales KPI cards (BR-MP-07 Phase 2.2.3):** map theo status THẬT (proven tối thiểu: "Đã thanh toán" = `financial_status='paid'`, "Đã hủy" = `financial_status='voided'`). 4 KPI cards (paid/pending/cancelled) chỉ giữ những cái DB support. Nếu DB chỉ có paid+voided → KPI row = 2-3 cards (Tổng vé / Đã thanh toán / Đã hủy), BỎ "Chờ xử lý" nếu không có 'pending'.
- **Revenue (BR-MP-10):** GMV = `financial_status='paid'` ONLY (aligned Source A/C). Đây là invariant business: chỉ paid mới tính revenue.

**Interim R3 default (nếu PAUSE chưa giải quyết):** Ticket Sales status breakdown CHỈ dùng `financial_status IN ('paid', 'voided')` — 2 trạng thái proven. Trend/total dùng `internal_status='COMPLETE'` cho "đơn hoàn tất" semantic (Source B pattern).

### DISC-3 🔴 Race identity + status badge (BR-MP-05)

**R1 mơ hồ:** Field Source "Status badge = `races.status` → pre_race/live/ended" + "draft races KHÔNG hiện".

**Thật:**
- Merchant portal data = MySQL `order_metadata` → `JOIN races r ON r.race_id=om.race_id`. "Giải" = **MySQL races** (bán vé context), KHÔNG phải MongoDB races (vận hành).
- MySQL `races.status` values proven: **`'draft'`, `'GENERATED_CODE'`, `'COMPLETE'`** (time-to-fill.service.ts:125 `r.status != 'draft'`; promo-hub `'GENERATED_CODE'`; analytics dto `'COMPLETE'`). KHÔNG có `pre_race/live/ended` (đó là MongoDB races collection).
- Draft filter ĐÚNG nhưng dùng MySQL value: `WHERE r.status != 'draft'`.

**R3 fix BR-MP-05 — Race resolution (replace):**
```
assignedRaces(user) =
  (MySQL races WHERE r.tenant_id IN tenantIds[] AND r.status != 'draft' AND r.is_delete = 0)
  ∪ raceOverrides.include[]  MINUS raceOverrides.exclude[]
```
- Race identity = MySQL `races.race_id` (bigint PK). Tenant scope = `races.tenant_id`.
- Draft filter = `r.status != 'draft'` (BR-MP-05 strict, proven value).
- **Status badge UI:** map MySQL races.status THẬT → VN label dictionary:
  - `'GENERATED_CODE'` → "Đang bán vé" (selling)
  - `'COMPLETE'` → "Đã kết thúc"
  - `'draft'` → (không hiện — filtered out)
  - 🛑 **PAUSE-R3-02:** Danny query `SELECT DISTINCT status FROM races WHERE tenant_id IN (active tenants)` để confirm full status set + map đủ VN label. KHÔNG bịa pre_race/live/ended.
- **Race title:** `races.title` (VARCHAR). **Race date:** `races.event_start_date` (KHÔNG có `races.date` — DISC-6).
- Bridge MongoDB (nếu cần title humanize): pattern `races:title:byMysqlId:<mysql_race_id>` (F-049) — nhưng MySQL `races.title` đã có sẵn, KHÔNG cần bridge cho merchant portal.

### DISC-4 🟡 `ticket_type.type_name` (không `ticket_types.name`)
Bảng `ticket_type` (số ít). Column display name = **`type_name`** (Source B: `tt.type_name`). KHÔNG phải `name`.

### DISC-5 🟡 `race_course` (không `race_courses`)
Bảng `race_course` (số ít). `rc.name` = distance label ('21KM'). `rc.race_id` = link tới race (proven Source B `rc.race_id=?`). `rc.distance` cũng có (entity).

### DISC-6 🟡 `races` table — PK + date columns
- PK = **`race_id`** (bigint), KHÔNG phải `id`.
- KHÔNG có `races.date`. Có **`event_start_date`** + **`event_end_date`** (datetime).
- **R3 fix Field Source (Race List page):** "Ngày tổ chức" = `races.event_start_date` format DD/MM/YYYY.

### DISC-7 🟡 Tenant scope via `races.tenant_id` (không `om.tenant_id`)
`order_metadata` KHÔNG có `tenant_id` (F-028 verified "Unknown column 'o.tenant_id'").

**R3 fix BR-MP-06 — Mandatory scoping (replace SQL pattern):**
```sql
-- Lớp 2 SQL: tenant scope LUÔN qua JOIN races, KHÔNG filter om trực tiếp
FROM order_metadata om
JOIN races r ON r.race_id = om.race_id
WHERE r.tenant_id IN (?)        -- tenant scope (Source C canonical)
  AND om.race_id IN (?)         -- race scope (accessibleRaces Set)
  AND om.financial_status = 'paid'  -- revenue only (Source A/C)
```
- Lớp 1 service: `resolveAccessibleRaces(userId)` → `Set<number>` MySQL race_id (DISC-3 resolution).
- KHÔNG BAO GIỜ query thiếu `r.tenant_id IN (?) AND om.race_id IN (?)`.

### DISC-8 🟡 `payment_on` vs `processed_on` (2 date semantic)
- `om.payment_on` = thời điểm tiền vào (Source A — fee/dashboard/analytics dùng cho **paid orders**). Dùng cho **Revenue trend** + **paid ticket trend**.
- `om.processed_on` = thời điểm order xử lý (Source B — reconciliation dùng với `internal_status='COMPLETE'`). Dùng cho **all-status order processing**.

**R3 fix BR-MP-07/BR-MP-25:** Revenue/paid metrics → `payment_on` (filter `financial_status='paid'`). Ticket count all-status → `processed_on` (filter `internal_status='COMPLETE'`) — confirm sau PAUSE-R3-01.

### DISC-9 🟡 `order_category` — nhiều hơn 3 values (BR-MP-12)
**R1 under-spec:** BR-MP-12 Level 2 = 3 categories (ORDINARY/GROUP_BUY/MANUAL).

**Thật (known-issues TD-F016-FINANCE-01):** `FIVE_BIB_CATEGORIES` có 6 enum: GROUP_BUY + GROUP_BUY_FIXED + CODE_TRANSFER + ORDINARY + (+2). Plus MANUAL semantic (payment_ref empty). order_category proven value: `'ORDINARY'`.

**R3 fix BR-MP-12 — 🛑 PAUSE-R3-03:** Danny query `SELECT order_category, COUNT(*) FROM order_metadata GROUP BY order_category`. Sau đó BA quyết grouping:
- **Option A (recommend):** Revenue breakdown group thật theo FeeService category logic — % orders (ORDINARY/GROUP_BUY/GROUP_BUY_FIXED/CODE_TRANSFER) vs MANUAL (VNĐ/vé). Map 6 raw → 2 display group "Phí %" vs "Phí cố định" (aligned BR-MP-11 dual fee).
- **Option B:** Giữ raw 6 category breakdown (verbose nhưng chính xác).
- MANUAL detection = `order_category='MANUAL'` OR (`payment_ref` empty/null) per Source A `paymentRef` logic + FeeService. KHÔNG đơn thuần group by category string.

### DISC-10 🟢 `order_line_item` FK = `order_id`
Link order: `oli.order_id = om.id` (Source A+B). KHÔNG phải `order_metadata_id`. `oli.quantity` (số vé), `oli.ticket_type_id`, `oli.price`.

---

## 🔧 R3 Corrected Field Source Table (replace R1 Phase 2.6)

### Race List page
| UI field | Real source | Transform |
|---|---|---|
| Tên giải | `races.title` (MySQL, JOIN via om.race_id) | — |
| Ngày tổ chức | `races.event_start_date` | DD/MM/YYYY |
| Tổng vé đã bán | `SUM(oli.quantity)` chain B WHERE `om.financial_status='paid'` (revenue) hoặc `internal_status='COMPLETE'` (all) — PAUSE-R3-01 | format number |
| Status badge | `races.status` → VN dict (GENERATED_CODE→"Đang bán vé", COMPLETE→"Đã kết thúc") — PAUSE-R3-02 | filter `!= 'draft'` |

### Ticket Sales — Breakdowns (chain B)
| UI field | Real source SQL |
|---|---|
| Vé theo cự ly | `SUM(oli.quantity) GROUP BY rc.id` qua `oli→om→tt→rc`, display `rc.name` |
| Vé theo loại vé | `SUM(oli.quantity) GROUP BY tt.id`, display `tt.type_name` |
| Order detail table — Mã đơn | `om.id` hoặc `om.order_code` (PAUSE-R3-04 verify column tên mã đơn) |
| — Ngày | `om.payment_on` (paid) | DD/MM/YYYY HH:mm |
| — Course | `rc.name` via chain | |
| — Loại vé | `tt.type_name` via chain | |
| — Số lượng | `oli.quantity` | |
| — Trạng thái | `om.financial_status` → VN dict (paid/voided) — PAUSE-R3-01 | |

### Revenue — KPI (Source A/C)
| UI field | Real source |
|---|---|
| GMV | `SUM(om.total_price - COALESCE(om.total_discounts,0))` WHERE `financial_status='paid'` AND `r.tenant_id=?` AND `om.race_id IN (?)` |
| Phí 5BIB | `FeeService.computeFeeForOrdersAggregate(tenantId, orders, period, config)` — orders pulled via `pullOrdersForFeeAggregate(db, clause, params, {tenantId, raceId})` (Source A, REUSE) |
| Net | GMV − Phí | computed |
| Fee rate (dual) | `feeRatePercent` + `manualFeePerTicket` từ FeeService result (R2 BR-MP-11 dual) | |

---

## 🛑 PAUSE Conditions R3 (Danny/Manager phải giải quyết TRƯỚC /5bib-code M2b)

| ID | Query cần chạy trên `5bib_platform_live` | Dùng để |
|---|---|---|
| **PAUSE-R3-01** | `SELECT financial_status, internal_status, COUNT(*) FROM order_metadata GROUP BY financial_status, internal_status` | Finalize BR-MP-08 ticket status breakdown + KPI cards thật (bỏ status không tồn tại) |
| **PAUSE-R3-02** | `SELECT DISTINCT status FROM races WHERE is_delete=0` | Finalize BR-MP-05 status badge VN dict (map đủ value thật) |
| **PAUSE-R3-03** | `SELECT order_category, COUNT(*) FROM order_metadata GROUP BY order_category` | Finalize BR-MP-12 revenue category grouping (6 raw → display group) |
| **PAUSE-R3-04** | `DESCRIBE order_metadata` (hoặc check column mã đơn hiển thị: order_code? code?) | Field Source order detail "Mã đơn" |

> BA KHÔNG finalize 4 BR trên bằng cách đoán. Cần DISTINCT/DESCRIBE thật. Đây là bài học từ chính lỗi R1/R2.

---

## ✅ Discrepancies KHÔNG sai (R1 đúng — giữ nguyên)
- ✅ `om.race_id` TỒN TẠI trên order_metadata (Source A `om.race_id`) — race linkage trực tiếp OK. (Manager over-flag điểm này một phần — đã confirm đúng.)
- ✅ `financial_status='paid'` cho revenue — đúng invariant (Source A/C).
- ✅ `om.total_price`, `om.total_discounts` tồn tại (Source A).
- ✅ FeeService dual fee (R2 BR-MP-11) — reuse pattern đúng.
- ✅ Cross-tenant per-tenant loop (R2 BR-MP-21b) — đúng (FeeService single-tenant signature).

---

## 📊 Updated TC reference (data layer)
TC-MP-04/05/15/19/22/22c (ticket sales) + TC-MP-08/08b/10/16/28/29 (revenue) — Coder/QC PHẢI dùng corrected schema:
- Course breakdown assertions → verify chain `oli→om→tt→rc`, KHÔNG `om.race_course_id`.
- Status assertions → CHỈ status proven (post PAUSE-R3-01), KHÔNG 6-enum.
- Tenant scope → `r.tenant_id`, KHÔNG `om.tenant_id`.
- Race filter → MySQL `races.status != 'draft'`.

---

---

## ✅ VERIFIED — DB Query Results (2026-06-05, Danny cấp quyền MySQL `5bib_platform_live` readonly)

**4 PAUSE RESOLVED bằng query thật.** Schema + value sets confirmed against production data (44K orders, 207 races). KHÔNG còn đoán.

### PAUSE-R3-01 RESOLVED — Status values THẬT

**`financial_status`** (3 values, 45,024 orders):
| Value | Count | VN label | EN label |
|---|---|---|---|
| `paid` | 35,618 | Đã thanh toán | Paid |
| `voided` | 9,405 | Đã hủy | Voided |
| `pending` | 1 | Chờ thanh toán | Pending |

**`internal_status`** (5 values — order lifecycle):
| Value | Count | VN label | EN label |
|---|---|---|---|
| `COMPLETE` | 35,581 | Hoàn thành | Completed |
| `CLOSE` | 9,010 | Đã đóng | Closed |
| `CANCELLED` | 395 | Đã hủy | Cancelled |
| `PROCESSED` | 37 | Đã xử lý | Processed |
| `WAIT_FOR_PAYMENT` | 1 | Chờ thanh toán | Awaiting payment |

→ **6-enum R1 (completed/paid/pending/cancelled/refunded/voided) CONFIRMED FABRICATED.** `refunded`/`completed` không tồn tại. KHÔNG có column `order_status`.

**FINAL BR-MP-08 (replace):** Ticket Sales status breakdown dùng **`financial_status`** (3 values: paid/voided/pending) cho KPI cards + status column — đây là trạng thái TIỀN, đúng business cho merchant. KPI row:
- Card 1 "Tổng vé" = SUM(oli.quantity) all
- Card 2 "Đã thanh toán" = `financial_status='paid'`
- Card 3 "Đã hủy" = `financial_status='voided'`
- Card 4 "Chờ thanh toán" = `financial_status='pending'` (chỉ 1 đơn thực tế — UI vẫn render card, hiện 0 nếu không có trong scope)

Dictionary `merchant-labels.ts` ORDER_FINANCIAL_STATUS map 3 value. KHÔNG dùng internal_status cho merchant UI (lifecycle phức tạp, không cần thiết).

### PAUSE-R3-02 RESOLVED — `races.status` values THẬT

**`races.status`** (5 values, 207 non-deleted races):
| Value | Count | VN label | EN label | Hiện cho merchant? |
|---|---|---|---|---|
| `COMPLETE` | 151 | Đã kết thúc | Ended | ✅ |
| `GENERATED_CODE` | 28 | Đang bán vé | On sale | ✅ |
| `DRAFT` | 22 | (nháp) | Draft | ❌ filtered out |
| `CANCEL` | 5 | Đã hủy | Cancelled | ✅ (hiện, badge xám) |
| `ONGOING` | 1 | Đang diễn ra | Ongoing | ✅ |

→ **`pre_race/live/ended` R1 CONFIRMED SAI.** Value thật UPPERCASE.

**FINAL BR-MP-05 (replace):**
- Draft filter: `WHERE r.status != 'DRAFT'` (UPPERCASE — DB value, KHÔNG lowercase). Combine `r.is_delete = 0`.
- Status badge dictionary `RACE_STATUS` map 4 visible values (COMPLETE/GENERATED_CODE/CANCEL/ONGOING) → VN label trên.
- `merchant-labels.ts` fallback raw value nếu xuất hiện value mới ngoài 5.

### PAUSE-R3-03 RESOLVED — `order_category` values THẬT

**`order_category`** (8 values + null, 45,024 orders):
| Value | Count | Fee type (FeeService) | Display group |
|---|---|---|---|
| `ORDINARY` | 34,951 | % (service_fee_rate) | Đơn thường |
| `MANUAL` | 6,993 | VNĐ/vé (manual_fee_per_ticket) | Thu công |
| `null` | 1,457 | → treat ORDINARY (% default) | Đơn thường |
| `GROUP_BUY_FIXED` | 675 | % | Mua nhóm |
| `PERSONAL_GROUP` | 411 | % | Mua nhóm |
| `CHANGE_COURSE` | 242 | % | Đổi cự ly |
| `GROUP_BUY` | 229 | % | Mua nhóm |
| `INSURANCE` | 40 | % | Bảo hiểm |
| `CODE_TRANSFER` | 26 | % | Chuyển nhượng |

→ **R1 3-value (ORDINARY/GROUP_BUY/MANUAL) under-spec.** Thật 8 + null.

**FINAL BR-MP-12 (replace) — Option A grouping (Danny chốt sau):** Revenue breakdown 2 cách:
- **Group hiển thị (recommend):** 2 nhóm theo fee semantic — "Phí %" (gộp ORDINARY+null+GROUP_BUY+GROUP_BUY_FIXED+PERSONAL_GROUP+CHANGE_COURSE+INSURANCE+CODE_TRANSFER) vs "Phí cố định" (MANUAL). Aligned BR-MP-11 dual fee display. Đơn giản, chính xác.
- **Raw breakdown (optional toggle):** group by 8 category thật + null→"Đơn thường". `merchant-labels.ts` ORDER_CATEGORY map 8 value.
- **MANUAL detection:** `order_category='MANUAL'` (KHÔNG cần payment_ref check — DB có category column rõ). FeeService tự xử lý cascade.
- **null handling:** `COALESCE(order_category, 'ORDINARY')` — treat null = ORDINARY (% default).

### PAUSE-R3-04 RESOLVED — order_metadata columns + mã đơn

**`order_metadata` actual columns (verified):** `id` (bigint PK), `race_id` (bigint), `financial_status`, `internal_status` (varchar), `payment_on` + `processed_on` (datetime), `payment_ref` (varchar), `total_price` + `total_discounts` + `subtotal_price` + `total_add_on_price` (float), `order_category` (varchar), `deleted` (bit). **KHÔNG có `order_code`/`code`, KHÔNG có `tenant_id`, KHÔNG có `race_course_id`, KHÔNG có `order_status`.**

→ **FINAL Field Source "Mã đơn" = `om.id`** (không có order_code column riêng). Format: `#{id}` hoặc raw bigint.

### Other tables confirmed
- **`races`:** PK `race_id` (bigint), `title` (varchar), `status` (varchar), `tenant_id` (bigint), `event_start_date`/`event_end_date` (datetime), `is_delete`/`is_show` (bit), `url_name`. **KHÔNG có `date`.**
- **`race_course`:** `id` (PK), `race_id` (bigint), `name` (varchar — distance label), `distance` (varchar).
- **`ticket_type`:** `id` (PK), `race_course_id` (bigint), `type_name` (varchar), `price` (float). **KHÔNG có `name`.**
- **`order_line_item`:** `id` (PK), `order_id` (bigint = om.id), `ticket_type_id` (bigint), `quantity` (int), `price` (decimal).
- **`total_price`/`total_discounts` đều là `float`** (không decimal — VND rounding: round khi display).

### Canonical SQL templates cho M2b (copy-ready, schema-verified)

**Ticket Sales summary (status breakdown):**
```sql
SELECT om.financial_status, COUNT(DISTINCT om.id) AS order_count, COALESCE(SUM(oli.quantity),0) AS ticket_count
FROM order_metadata om
JOIN races r ON r.race_id = om.race_id
LEFT JOIN order_line_item oli ON oli.order_id = om.id
WHERE r.tenant_id IN (?) AND om.race_id IN (?) AND om.deleted = 0
  AND om.payment_on BETWEEN ? AND ?
GROUP BY om.financial_status;
```

**Course breakdown (chain):**
```sql
SELECT rc.id AS course_id, rc.name AS course_name, COALESCE(SUM(oli.quantity),0) AS ticket_count
FROM order_line_item oli
JOIN order_metadata om ON oli.order_id = om.id
JOIN ticket_type tt    ON oli.ticket_type_id = tt.id
JOIN race_course rc    ON tt.race_course_id = rc.id
JOIN races r           ON rc.race_id = r.race_id
WHERE r.tenant_id IN (?) AND rc.race_id IN (?) AND om.deleted = 0
  AND om.financial_status = 'paid' AND om.payment_on BETWEEN ? AND ?
GROUP BY rc.id, rc.name;
```

**Revenue GMV (paid only, tenant-scoped):**
```sql
SELECT SUM(om.total_price - COALESCE(om.total_discounts,0)) AS gmv, COUNT(DISTINCT om.id) AS order_count
FROM order_metadata om
JOIN races r ON r.race_id = om.race_id
WHERE r.tenant_id IN (?) AND om.race_id IN (?) AND om.deleted = 0
  AND om.financial_status = 'paid' AND om.payment_on BETWEEN ? AND ?;
```
(Phí 5BIB qua `FeeService.computeFeeForOrdersAggregate` — reuse Source A `pullOrdersForFeeAggregate`.)

**Race list (tenant-scoped, draft filtered):**
```sql
SELECT r.race_id, r.title, r.status, r.event_start_date
FROM races r
WHERE r.tenant_id IN (?) AND r.status != 'DRAFT' AND r.is_delete = 0;
```

---

## ✅ Status & Re-submit

R3 fix 10 discrepancy + **4 PAUSE RESOLVED bằng query DB thật** (Danny cấp quyền 2026-06-05). Data layer giờ 100% bám production schema — canonical SQL templates copy-ready cho M2b.

**Status:** 🔵 READY cho `/5bib-plan` re-review. KHÔNG còn PAUSE blocking.

**Next:** Danny chạy `/5bib-plan FEATURE-069-merchant-reporting-portal`. Manager đối chiếu R3 vs schema verified → APPROVE → unblock M2b. M2b Coder dùng canonical SQL templates trên (đã verify column-by-column).

Đọc thứ tự: `01-ba-prd.md` (R1) + `01-ba-prd-revision-r2.md` (R2 auth/UX/aggregate) + **`01-ba-prd-revision-r3.md` (R3 data layer VERIFIED — file này, OVERRIDE R1/R2 data assumptions)**.
