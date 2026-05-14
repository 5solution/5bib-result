# FEATURE-033: Promo Hub — Race Calendar sync từ MySQL platform (phase bán vé)

**Status:** 🟡 INITIATED
**Created:** 2026-05-14
**Owner:** Danny
**Type:** EXTEND_EXISTING (F-027 Promo Hub)
**Created by:** 5bib-manager

---

## 🎯 Why this feature

F-027 Promo Hub section `race_calendar` hiện tại fetch từ MongoDB `races` collection (5bib-result DB) — **CHỈ chứa race đã chuyển sang giai đoạn vận hành** (post sale, post setup).

**Mục đích Promo Hub:** Marketing landing page → cần show race **đang bán vé** để drive đăng ký. Source data đúng phải là **MySQL `5bib_platform_live`.races** với `status = 'GENERATED_CODE'` (25 race đang bán vé hiện tại trên PROD).

Danny PROD feedback 2026-05-14:
> *"Race ở các bảng races của 5BIB result chỉ được tạo khi nó đã chuyển sang giai đoạn vận hành thôi. Còn ở giai đoạn bán vé chúng tao k lấy data từ đây"*
>
> *"Bảng nó là bảng races, column xác nhận đang có bán vé thì trạng thái nó sẽ ở GENERATED_CODE"*

Sai data source → landing promo show race đã end thay vì race đang bán → KHÔNG drive được conversion vé.

---

## 📂 Impact Map (theo memory hiện tại)

### Module sẽ chạm

**Backend:**
- `backend/src/modules/promo-hub/` — extend service để fetch from platform DB OR add new sub-service
- `backend/src/modules/race-master-data/entities/` — ADD new entity `RaceReadonly` (qua named connection `'platform'`)
- HOẶC tạo module mới `backend/src/modules/promo-hub/entities/race-readonly.entity.ts` (depends on Coder design choice)

**Frontend (public):**
- `frontend/components/hub/sections/RaceCalendarSection.tsx` — switch fetch URL từ `/api/races?status=` sang new endpoint `/api/promo-hub/races-on-sale`
- Field mapping update: schema khác (MySQL `title` vs MongoDB `name`, `logo_url` vs `imageUrl`, `event_start_date` vs `date`)

**Admin:**
- `admin/src/components/promo-hub/SectionConfigDialog.tsx` — update `race_calendar` form: thay vì filter status (pre_race/live/ended) → filter source (đang bán vé / đã vận hành / cả 2)
- `admin/src/components/promo-hub/section-types.ts` — update `race_calendar` `defaultConfig` + description

**Optional:**
- `admin/src/components/promo-hub/PromoHubPreview.tsx` — update preview skeleton cho race_calendar nếu cần show real fetched data

### File then chốt cần Coder đọc

- `backend/src/modules/race-master-data/services/race-athlete-sync.service.ts:33-40` — pattern `@InjectRepository(AthleteReadonly, 'platform')`
- `backend/src/modules/race-master-data/entities/race-course-readonly.entity.ts` — entity readonly template pattern (`@Entity('race_course')` simple decorator)
- `backend/src/modules/promo-hub/promo-hub.service.ts` — current service architecture, sanitize pattern
- `frontend/components/hub/sections/RaceCalendarSection.tsx` — current async fetch + render flow
- `admin/src/components/promo-hub/SectionConfigDialog.tsx` case `"race_calendar"` (line ~234) — current form

### Endpoint liên quan

- **NEW:** `GET /api/promo-hub/races-on-sale?status=GENERATED_CODE&limit=6&tenantId=<optional>` — public endpoint cho frontend SSR fetch
- (Có thể nest dưới promo-hub controller hoặc tạo controller riêng)

### Schema/DB

**MySQL `5bib_platform_live`.races (READ-ONLY):**

Verified schema (2026-05-14 inspect):
```
race_id (bigint, PK)
title (varchar 255)
url_name (varchar 255) — slug? cần verify (sample row NULL)
status (varchar 32) — GENERATED_CODE (25) / DRAFT (22) / COMPLETE (147) / CANCEL (5)
logo_url (text)
event_start_date (datetime)
event_end_date (datetime)
registration_start_time (datetime)
registration_end_time (datetime)
location (varchar 1024)
brand (varchar 255)
tenant_id (bigint)
is_show (bit) — boolean
is_delete (bit) — boolean
description (text)
```

Filter for "đang bán vé":
- `is_delete = 0`
- `status = 'GENERATED_CODE'`
- `is_show = 1` (hide ẩn?)
- Optional: `registration_end_time > NOW()` (chưa hết hạn đăng ký)

**MongoDB 5bib-result `races` collection:** NO change — chỉ cập nhật `RaceCalendarSection` ngừng fetch từ đây cho promo use case.

**Redis:** NEW cache key `promo-hub:races-on-sale:<filterHash>` TTL 60s (consistent với F-027 anti-stampede pattern)

---

## ⚠️ Risk Flags

- 🔴 **HIGH** — Đụng MySQL platform DB read-only. Phải dùng named connection `'platform'` (KHÔNG dùng default — sẽ silent-fail query MongoDB). Pattern reuse F-016, F-019, F-028 known-good.

- 🟡 **MED** — Schema MySQL có field `url_name` nhưng sample data có 2 row NULL. Cần BA chốt fallback strategy nếu `url_name` null:
  - Skip race khỏi list?
  - Fallback dùng `race_id` làm slug?
  - Generate slug from title?

- 🟡 **MED** — Cross-tenant data exposure: table `races` chứa race của 58 tenant. Public promo hub render → có cần filter `tenant_id`? Multi-tenancy boundary chưa rõ.
  - Option: chỉ show race tenant=5BIB (tenant_id=?)
  - Option: show all (per Danny intent — promo hub là MKT chung)

- 🟡 **MED** — Race click navigation: hiện `RaceCalendarSection` link `/races/<slug>` → frontend race detail. Race phase bán vé chưa có page trên 5bib-result frontend. Click race → đi đâu?
  - 5Ticket page `5ticket.vn/event/<slug>`?
  - 5bib.com landing page?
  - Modal info chỉ chứa title + ngày + CTA "Đăng ký" link sang 5Ticket?

- 🟢 **LOW** — Performance: 25 race active hiện tại, query simple. Cache 60s đủ. Không lo N+1.

- 🟢 **LOW** — Backward-compat: F-027 hub đã publish có section `race_calendar` đang work với MongoDB fetch. Nếu switch endpoint → existing hub có thể break. Cần migration plan OR keep both endpoints (admin chọn data source).

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

- [ ] **PAUSE-PH33-01** — `url_name` NULL fallback strategy: skip / use race_id / generate from title?

- [ ] **PAUSE-PH33-02** — Multi-tenant boundary: filter `tenant_id` cụ thể nào? Hay show all race đang bán vé?

- [ ] **PAUSE-PH33-03** — Race CTA click navigation: link đâu? (5ticket.vn / 5bib.com landing / inline modal)?

- [ ] **PAUSE-PH33-04** — Có cần thêm filter `is_show = 1` không? (Tenant có thể tạm ẩn race bán vé khỏi promo)

- [ ] **PAUSE-PH33-05** — Backward-compat F-027 `race_calendar` section đã publish:
  - **Option A:** Hard switch — tất cả `race_calendar` section bây giờ fetch platform DB
  - **Option B:** Admin chọn data source — extend section config với field `source: 'platform_on_sale' | 'result_active'`
  - **Option C:** Tạo SECTION TYPE MỚI `race_calendar_on_sale` — giữ `race_calendar` legacy cho phase vận hành

- [ ] **PAUSE-PH33-06** — Sort order race trong list: theo `registration_start_time` ASC (race sắp mở bán)? `event_start_date` ASC (race sắp diễn ra)? Custom admin sort?

- [ ] **PAUSE-PH33-07** — Field display: title + logo + date đủ chưa? Có cần location? brand? registration window (còn N ngày bán vé)?

- [ ] **PAUSE-PH33-08** — Performance SLA: hub có 1 race_calendar section + 25 race trên platform. p95 target ≤500ms (PRD F-027 baseline). Phù hợp không?

---

## 🎯 Success criteria (gợi ý cho BA cụ thể hoá thành test scenario)

- MKT tạo hub mới với section `race_calendar` (or `race_calendar_on_sale` tùy Option) → render 6 race đang bán vé từ platform DB
- Click race card → redirect đúng URL (per PAUSE-PH33-03)
- Race CANCEL / DRAFT / COMPLETE → KHÔNG xuất hiện trong promo
- Race với `is_show = 0` → ẩn (per PAUSE-PH33-04)
- Performance: 25 race fetch from MySQL + JSON parse + render → ≤500ms p95 (cached) / ≤1500ms cold
- Cache invalidation: tenant edit race trên 5Ticket → promo hub reflect trong ≤60s
- Existing F-027 hub published với `race_calendar` cũ → KHÔNG break (per Option A/B/C chốt PAUSE-PH33-05)

---

## 📌 Memory check — không có conflict in-flight

- F-031 SHIPPED Service Catalog Excel Import (commit `6e30ef9`)
- F-032 SHIPPED Partner Excel Import (commit `46563e3`)
- F-027 SHIPPED Promo Hub đầy đủ 19 section types + TipTap WYSIWYG + live preview (commit `61e64de`)
- F-033 sẽ extend F-027 only — KHÔNG đụng F-024 contracts / F-028 finance / F-029 hardening

Known issues warning:
- TD-F027-PHASE2-01 (race picker UI cho featured_races) — F-033 không scope, defer
- TD-F027-PHASE2-13 (race_calendar group-by-month) — F-033 không scope, defer
- TD-2026-05-12-CRIT-* (5 deferred CRIT) — F-033 không đụng vùng CRIT

---

## 🛡️ Workflow lesson reminder

F-033 sẽ chạy ĐẦY ĐỦ workflow chính quy (KHÔNG hotfix shortcut như F-027 TipTap+preview incident):

```
/5bib-init → 00-manager-init.md  (THIS doc)
   ▼
/5bib-prd  → 01-ba-prd.md
   ▼
/5bib-plan → 02-manager-plan.md
   ▼
/5bib-code → 03-coder-implementation.md
   ▼
/5bib-qc   → 04-qc-report.md
   ▼
/5bib-deploy → 05-manager-deploy.md
```

Tránh repeat workflow violation từ F-027 UX HOTFIX-03 — feature ~6h work phải qua đủ 5 gate, KHÔNG push thẳng main.

---

## ✅ Sẵn sàng cho `/5bib-prd`?

Có — BA chạy tiếp `/5bib-prd FEATURE-033-promo-hub-platform-race-sync`.

BA cần trả lời 8 PAUSE-PH33-* conditions trong section dưới của file `01-ba-prd.md`. Manager sẽ review trong `/5bib-plan`.

---

## 🔗 Next step

Danny chạy: `/5bib-po-ba FEATURE-033-promo-hub-platform-race-sync`

(Hoặc nếu Danny muốn skip BA gate per F-030/F-031/F-032 pattern khi scope hẹp → confirm explicit với Manager để cut PRD via Plan directly).
