# FEATURE-041: GA4 Admin Configuration Guide — Pre-Code Setup cho Danny

**Status:** 📘 OPERATIONS RUNBOOK
**Created:** 2026-05-18
**Author:** 5bib-po-ba (supplementary doc)
**Linked:** `00-manager-init.md`, `01-ba-prd.md`, `02-manager-plan.md`

---

## 🎯 Mục đích document này

Coder sắp implement 24 events + 24 custom dimensions + 4 conversion goals + Consent Mode v2 ở **frontend code**. Để event fire đúng nhưng dashboard KHÔNG hiển thị data → cần **GA4 property side** config matching schema PRD.

**Workflow song song:**
- Coder branch implement code (4-6h ETA per Manager plan)
- Danny (mày) parallel config GA4 admin UI theo guide này (~30-45 phút)
- Sau Coder ship → DebugView verify immediately, KHÔNG phải đợi 24-48h data backfill

**Output sau guide:** GA4 property `G-PNVB69YRL2` ready receive 24 events + 24 custom dimensions với đúng name + 4 conversions marked + DebugView accessible cho QC.

> ⚠️ **Convention quan trọng:** PRD chốt **English event names + English param keys** (BR-41-04). Khi config GA4 admin, **tên Custom Dimension PHẢI match exact** với param key trong code (case-sensitive). Sai 1 ký tự → dimension không bind được data.

---

## 📋 Pre-requisites (mày check trước)

- [ ] Mày có **Admin access** vào GA4 property `G-PNVB69YRL2` (analytics.google.com)
- [ ] Property đã được tạo và liên kết với domain `result.5bib.com` (hoặc tạo mới nếu chưa)
- [ ] Browser Chrome có cài extension **"Google Analytics Debugger"** (https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna) — dùng DebugView test sau ship
- [ ] (Optional) Nếu muốn dùng Tag Manager thay vì direct gtag → tạo container GTM-XXXXX và linh hoạt hơn. Per PRD F-041 v1.0 dùng **direct gtag** (đơn giản hơn) — section "Option B: GTM" cuối guide cho future migration.

---

## 🗺️ Cấu trúc guide — 10 bước

| # | Bước | ETA | Bắt buộc cho v1.0? |
|---|------|-----|---------------------|
| 1 | Verify GA4 property + data stream | 2 phút | ✅ |
| 2 | Configure Consent Mode v2 settings | 3 phút | ✅ |
| 3 | Register 24 Custom Dimensions | 15 phút | ✅ |
| 4 | Register 4 Conversion events | 5 phút | ✅ |
| 5 | Data Retention + IP Filter | 3 phút | ✅ |
| 6 | Enable DebugView access | 2 phút | ✅ |
| 7 | Setup internal team filter (exclude QC traffic) | 3 phút | ⚪ Recommended |
| 8 | Setup Funnel Exploration template | 5 phút | ⚪ Recommended (Phase 1) |
| 9 | Setup Audiences (Marketing remarketing) | 5 phút | ⚪ Phase 2 |
| 10 | Verify post-Coder deploy | 10 phút | ✅ (sau ship) |

**Total ETA Phase 1 mandatory:** ~30 phút | **Total full (incl. recommended):** ~45 phút

---

## ✅ BƯỚC 1: Verify GA4 Property + Data Stream

### Vị trí UI
`analytics.google.com` → Admin (⚙️ bottom-left) → Property `G-PNVB69YRL2` → **Data Streams**

### Action
1. Confirm property tên hiện tại (vd: "5BIB Result Production")
2. Click data stream → verify **Measurement ID = `G-PNVB69YRL2`**
3. Stream URL: `https://result.5bib.com` (nếu chưa set, edit + save)
4. Enable **Enhanced Measurement** — toggle ON cho:
   - ✅ Page views
   - ✅ Scrolls
   - ✅ Outbound clicks (cho `select_sponsor` auto-track)
   - ✅ Site search
   - ✅ Video engagement (KHÔNG dùng F-041 nhưng OK enable)
   - ✅ File downloads (cho `download_certificate` PDF — fire auto + custom kèm)
   - ⚪ Form interactions (OFF — Coder sẽ wire custom search/filter events)

### Acceptance
- ✅ Stream status hiện "Receiving traffic" (hoặc "No traffic yet" nếu chưa deploy)
- ✅ Measurement ID copy-paste khớp với `NEXT_PUBLIC_GA_ID=G-PNVB69YRL2` env Coder sẽ set

---

## ✅ BƯỚC 2: Configure Consent Mode v2 Settings

### Vị trí UI
Admin → Property → **Data Settings** → **Data Collection** → tab **Consent Settings**

### Action
1. Find "Google signals data collection" — **OFF** cho Vietnam PDPA (BR-41-15 IP anonymization)
2. Find "Granular location and device data collection" — Vietnam region → **OFF** (giảm risk PII)
3. Tab "Behavioral data" trong reports — **ON** (cho phép Behavior model khi consent denied user >>10%)
4. Tab "Consent Mode v2 setup":
   - Region settings: **Vietnam** add explicit (giúp GA4 auto-respect Vietnam PDPA)
   - Verify "Consent Mode" status = **Active** (sẽ active sau Coder ship gtag consent default block)

### Acceptance
- ✅ Consent Mode v2 status "Pending implementation" (sẽ thành "Active" sau Coder ship)
- ✅ Vietnam region tagged trong consent settings

---

## ✅ BƯỚC 3: Register 24 Custom Dimensions — CRITICAL

### Vị trí UI
Admin → Property → **Custom Definitions** → **Custom Dimensions** tab → **Create custom dimension** button

### ⚠️ Warning quan trọng
- **Dimension name = parameter key trong code** (case-sensitive, snake_case)
- **Display name** dùng cho marketing dashboard (tiếng Việt OK)
- Sai 1 ký tự ở **Event parameter** field → dimension không bind data
- GA4 free tier limit: **50 Event-scoped + 25 User-scoped dimensions** — F-041 dùng 22 Event + 2 User → OK

### Action — Register table dưới đây từng row (15 phút total)

> **Format khi tạo:** Mở dialog "Create custom dimension" → fill 4 fields → Save → repeat 24 lần.

| # | Display name (VN, cho marketing) | Event parameter (exact match code) | Scope | Description |
|---|----------------------------------|------------------------------------|-------|-------------|
| 1 | Slug giải đấu | `race_slug` | **Event** | Race identifier slug từ URL — vd `cat-tien-jungle-paths-2026` |
| 2 | Cự ly | `course_id` | **Event** | Course identifier — vd `trail-70km` |
| 3 | Số BIB | `bib` | **Event** | Race participant BIB number (non-PII) — vd `7055` |
| 4 | Ngôn ngữ | `lang` | **User** | UI language — `vi` hoặc `en` |
| 5 | Vai trò user | `user_role` | **User** | Auth state — `anonymous` hoặc `authenticated` |
| 6 | Route nguồn | `from_route` | **Event** | Referrer context — `ranking` / `search` / `homepage` / `directory` / `direct` |
| 7 | Phương thức share | `share_method` | **Event** | Share UX path — `native` / `link` / `screenshot` / `download` / `copy_link` |
| 8 | Định dạng tải | `download_format` | **Event** | Certificate/image format — `pdf` / `png` |
| 9 | Preset nền ảnh | `preset_bg` | **Event** | Result image bg — `blue` / `dark` / `sunset` / `forest` / `purple` / `custom` |
| 10 | Tên nhà tài trợ | `sponsor_name` | **Event** | Sponsor display name — `5BIB` / `5Sport` / etc |
| 11 | ID nhà tài trợ | `sponsor_id` | **Event** | Sponsor MongoDB `_id` string |
| 12 | Vị trí UI | `position` | **Event** | UI position — `sidebar` / `footer` / `race_page` / `result_card` |
| 13 | Loại action floating bar | `action_type` | **Event** | `back_to_top` / `share` / `scroll_splits` |
| 14 | Loại filter | `filter_type` | **Event** | `date` / `location` / `gender` / `age_group` / `status` |
| 15 | Giá trị filter | `filter_value` | **Event** | Filter value post-debounce — `2026-05` / `da-lat` / `male` |
| 16 | Trường sort ranking | `sort_field` | **Event** | `chip_time` / `gun_time` / `overall_rank` / `gender_rank` |
| 17 | Hướng sort | `sort_direction` | **Event** | `asc` / `desc` |
| 18 | Từ khóa search | `search_term` | **Event** | Raw search query (non-PII assumed) — vd `Nguyen`, `7055` |
| 19 | Số kết quả | `result_count` | **Event** | Search/filter result count — vd `42`, `0`, `1523` |
| 20 | Index tab | `tab_index` | **Event** | Tab numerical — `0` / `1` / `2` |
| 21 | Slug promo hub | `hub_slug` | **Event** | Promo hub slug |
| 22 | ID section homepage | `section_id` | **Event** | `featured-races` / `hub-promo` / `sponsor-strip` |
| 23 | Slug thành phố | `city_slug` | **Event** | Race directory city — `ha-noi` / `tp-hcm` / `da-nang` |
| 24 | Số BIB so sánh | `bib_count` | **Event** | Number of BIBs in compare — `2` / `3` / `4` |

> **Note:** Dimension 25 `status` (action outcome) bị bỏ vì collision với GA4 built-in. Coder sẽ rename event param trong code thành `action_status` để tránh conflict — nếu cần register, dùng `action_status` thay `status` (xem table dimension nâng cấp Phase 2 nếu cần thiết).

### Acceptance
- ✅ Tất cả 24 dimensions hiển thị trong Custom Dimensions list
- ✅ Event parameter field copy verbatim từ code (NOT camelCase, NOT space)
- ✅ Scope (Event vs User) đúng theo table
- ⚠️ Nếu thấy "Quota nearly exceeded" warning → review xem có dimensions cũ không dùng → archive

---

## ✅ BƯỚC 4: Register 4 Conversion Events

### Vị trí UI
Admin → Property → **Events** → **Mark as conversion** toggle

### Cách thức
GA4 tự discover event tên sau khi data start flowing. Hai cách:

**Cách A (recommended — POST-DEPLOY):**
1. Sau Coder ship + Danny ACCEPT consent + fire vài events test → GA4 sẽ tự list events
2. Vào Admin → Events → list ra → toggle "Mark as conversion" cho 4 event dưới

**Cách B (PRE-DEPLOY — proactive create):**
1. Admin → Events → **Create event** button → tạo placeholder
2. Mỗi event:
   - Custom event name: copy exact từ table dưới
   - Matching condition: leave empty (sẽ auto-match khi data arrive)
3. Sau tạo → toggle "Mark as conversion"

### 4 Conversion events cần mark

| # | Event name (exact) | Mô tả KPI | Owner metric |
|---|-------------------|-----------|--------------|
| 1 | `share_athlete` | Athlete chia sẻ kết quả của họ → viral loop chính | Marketing |
| 2 | `share_result_image` | Result image post-generate share → visual viral | Marketing |
| 3 | `download_certificate` | Athlete tải certificate PDF → completion engagement | Product |
| 4 | `generate_result_image` | Athlete tạo image (preset/custom) → creator engagement | Product |

### Acceptance
- ✅ 4 events có icon ⭐ "Mark as conversion" enabled
- ✅ Sau ship, conversion column hiển thị count trong Reports > Engagement > Conversions

---

## ✅ BƯỚC 5: Data Retention + IP Filter

### Vị trí UI
Admin → Property → **Data Settings** → **Data Retention**

### Action
1. **Event data retention:** Chọn **14 months** (max cho free tier — đủ cho year-over-year analysis)
2. **Reset user data on new activity:** ON (giảm risk store stale user data)
3. **IP filtering** (sub-section):
   - Click "+ Create" → add filter "Internal traffic"
   - Filter name: `5BIB Internal Team`
   - Traffic type: `internal`
   - IP addresses: list IP văn phòng + IP nhà Danny + VPS IP `157.10.42.171` (avoid QC noise)
   - Save

### Acceptance
- ✅ Data retention = 14 months
- ✅ Internal IP filter status = Active (sẽ tag traffic là `traffic_type=internal` → filterable trong reports)

---

## ✅ BƯỚC 6: Enable DebugView Access

### Vị trí UI
Admin → Property → **DebugView** (left nav, dưới Reports)

### Action
1. Open DebugView page → bookmark URL (sẽ dùng nhiều cho QC + post-deploy verify)
2. Bookmark URL pattern:
   ```
   https://analytics.google.com/analytics/web/#/p<PROPERTY_NUMERIC_ID>/admin/debugview
   ```
3. Grant access cho QC member nếu cần (Admin > Property Access Management > Add user → role "Analyst")

### Cách dùng DebugView (post-deploy)
1. QC mở Chrome có GA Debugger extension enabled
2. Visit `result.5bib.com` → ACCEPT consent banner
3. Mỗi event fire → DebugView hiển thị real-time với event name + params
4. QC tick 24 events theo Event Taxonomy Table (BR-41 verification)

### Acceptance
- ✅ DebugView page accessible
- ✅ QC member có Analyst access (nếu phân quyền team)

---

## ⚪ BƯỚC 7: Internal Team Filter (Recommended)

### Mục đích
Tránh QC traffic + Danny dev traffic làm noise GA4 reports khi marketing review data.

### Vị trí UI
Admin → Data Settings → Data Filters

### Action
1. Click "Create Filter"
2. Filter name: `Exclude Internal Traffic`
3. Filter type: `Internal Traffic` (sẽ sử dụng tag từ Bước 5)
4. Parameter: `traffic_type` equals `internal`
5. Filter state: **TESTING** (initially) → đảm bảo không filter nhầm trước khi switch ACTIVE
6. After 24h verify reports KHÔNG mất real user data → switch to **ACTIVE**

### Acceptance
- ✅ Filter trạng thái TESTING active
- ✅ Sau verify → switch ACTIVE

---

## ⚪ BƯỚC 8: Funnel Exploration Template (Recommended Phase 1)

### Mục đích
Track funnel critical: Homepage → Race → Ranking → Athlete → Share

### Vị trí UI
**Reports** menu → **Explore** → "+ Create new exploration" → choose template **Funnel exploration**

### Action — Create template "5BIB Result Public Funnel"

**Funnel steps definition:**

| Step | Event matching | Description |
|------|---------------|-------------|
| 1. Landing | `page_view` where `page_location` contains `result.5bib.com/` AND NOT contains `/races/` | Homepage hit |
| 2. View race | `view_race` (any race_slug) | User clicked into a race |
| 3. View ranking | `view_ranking` (any) | User opened course ranking |
| 4. View athlete | `view_athlete` (any) | User clicked into athlete profile |
| 5. Share | `share_athlete` OR `share_result_image` | User shared (viral conversion) |

**Settings:**
- Show elapsed time: ON
- Make open funnel: ON (cho user join giữa funnel cũng đếm)
- Breakdown dimension: `lang` (split VN vs EN funnel)
- Date range: Last 28 days (default)

### Acceptance
- ✅ Funnel saved trong Explore tab
- ✅ Marketing team có thể access funnel template

### Bonus funnel templates đề xuất (defer Phase 2 nếu busy)
- **Result image creator funnel:** `view_athlete` → `generate_result_image` → `share_result_image`
- **Certificate funnel:** `view_athlete` → `download_certificate`
- **Search → conversion:** `search` → `view_athlete` → `share_athlete`

---

## ⚪ BƯỚC 9: Audiences (Phase 2 — Marketing remarketing)

### Mục đích
Tạo audience segments cho Google Ads remarketing (Phase 2 nếu marketing chạy ads).

### Đề xuất audience templates (defer Phase 2)

| Audience name | Definition | Use case |
|---------------|-----------|----------|
| **Athlete sharers** | Users fired `share_athlete` ≥1 lần last 30d | Remarketing thank-you campaign |
| **Cert downloaders** | Users fired `download_certificate` ≥1 last 30d | Upsell next race campaign |
| **Race browsers no-action** | Users fired `view_race` ≥3 BUT NOT `view_athlete` last 14d | Engagement re-activation |
| **Mobile dropoff** | `device_category=mobile` AND `bounce` event AND session duration <30s | Mobile UX investigation segment |

### Vị trí UI
Admin → Audiences → "+ New audience"

> **Defer Phase 2** unless Marketing explicit request now.

---

## ✅ BƯỚC 10: Post-Coder Deploy Verification (10 phút)

### Pre-condition
- Coder đã ship F-041 → PROD `result.5bib.com`
- DEV deploy OK (release/v1.8.6 hoặc tương đương)
- Mày có Chrome + GA Debugger extension enabled

### Action checklist

1. **Visit result.5bib.com** trong Chrome
   - ✅ Page loads, NO console errors
   - ✅ Cookie banner appears after 1500ms
   - ✅ Browser DevTools → Application → Local Storage → `5bib_consent_v1` KHÔNG có (chưa accept)

2. **Click "Đồng ý"** banner
   - ✅ Banner fade-out
   - ✅ localStorage `5bib_consent_v1` = `{accepted: true, timestamp: ISO, version: 1}`
   - ✅ DevTools Network tab → request to `google-analytics.com/g/collect` fires
   - ✅ GA4 DebugView (separate tab) → user device hiển thị trong list
   - ✅ DebugView events: `consent_accept` + `page_view` (Enhanced Measurement auto)

3. **Navigate `/races/cat-tien-jungle-paths-2026`**
   - ✅ DebugView event `view_race` với param `race_slug: cat-tien-jungle-paths-2026`

4. **Click course tab "Trail 70Km"**
   - ✅ DebugView event `select_course_tab` với `race_slug + course_id: trail-70km`

5. **Click athlete BIB 7055 row**
   - ✅ DebugView event `view_athlete` với `bib: 7055, race_slug, from_route: ranking`
   - ✅ KHÔNG có event param `athlete_name` (PII whitelist verify)

6. **Click share button on athlete page**
   - ✅ DebugView event `share_athlete` với `share_method` filled

7. **Click "Tải chứng nhận" PDF**
   - ✅ DebugView event `download_certificate` với `download_format: pdf`
   - ✅ Also: Enhanced Measurement auto `file_download` fires

8. **Verify Conversion column populated**
   - GA4 Reports > Engagement > Conversions → 4 events list (`share_athlete`, `share_result_image`, `download_certificate`, `generate_result_image`) hiển thị count > 0 (sau ~30 phút data delay)

9. **PII filter QC (CRITICAL)**
   - DevTools Console: `JSON.stringify(window.dataLayer)`
   - Grep output: NO occurrence của `athlete_name`, `email`, `phone`, full VN name (vd "NGUYỄN HUỲNH ANH")
   - Nếu thấy PII → STOP, báo Coder hotfix

10. **Reject consent flow (separate browser/incognito)**
    - Open incognito → visit `result.5bib.com`
    - Click "Từ chối"
    - Navigate `/races/...`
    - ✅ DebugView KHÔNG hiển thị user device (consent denied = no tracking)

### Acceptance overall
- ✅ Tất cả 10 checks PASS
- ✅ DebugView confirm event taxonomy fire đúng
- ✅ PII zero leak
- ✅ Consent reject blocks tracking

---

## 📊 Map giữa code Coder ↔ GA4 admin config

### Cách Coder code wire vào GA4 schema mày vừa config

**File `frontend/lib/analytics/events.ts` (Coder sẽ tạo):**

```typescript
// Event names (24) — match BƯỚC 4 conversion candidates + 20 non-conversion
export const EVENTS = {
  // Auto + Consent
  PAGE_VIEW: 'page_view',
  CONSENT_ACCEPT: 'consent_accept',
  
  // View events (8)
  VIEW_RACE: 'view_race',
  VIEW_RANKING: 'view_ranking',
  VIEW_ATHLETE: 'view_athlete',
  VIEW_HUB: 'view_hub',
  VIEW_RACE_CALENDAR: 'view_race_calendar',
  VIEW_RACE_DIRECTORY: 'view_race_directory',
  
  // Selection events
  SELECT_COURSE_TAB: 'select_course_tab',
  SELECT_RACE: 'select_race',
  SELECT_PROMO_SECTION: 'select_promo_section',
  SELECT_SPONSOR: 'select_sponsor',
  
  // Search & filter
  SEARCH: 'search',
  SEARCH_BIB: 'search_bib',
  FILTER_CALENDAR: 'filter_calendar',
  FILTER_RANKING: 'filter_ranking',
  SORT_RANKING: 'sort_ranking',
  
  // Conversions (4) — toggle "Mark as conversion" trong GA4 admin Bước 4
  SHARE_ATHLETE: 'share_athlete',        // ⭐ conversion
  SHARE_RACE: 'share_race',
  DOWNLOAD_CERTIFICATE: 'download_certificate',  // ⭐ conversion
  GENERATE_RESULT_IMAGE: 'generate_result_image', // ⭐ conversion
  SHARE_RESULT_IMAGE: 'share_result_image',      // ⭐ conversion
  COMPARE_OPEN: 'compare_open',
  CLICK_FLOATING_ACTION: 'click_floating_action',
} as const;

// Param keys (24) — MATCH dimensions registered trong Bước 3 EXACTLY
type EventParam =
  | 'race_slug' | 'course_id' | 'bib' | 'lang' | 'user_role'
  | 'from_route' | 'share_method' | 'download_format' | 'preset_bg'
  | 'sponsor_name' | 'sponsor_id' | 'position' | 'action_type'
  | 'filter_type' | 'filter_value' | 'sort_field' | 'sort_direction'
  | 'search_term' | 'result_count' | 'tab_index'
  | 'hub_slug' | 'section_id' | 'city_slug' | 'bib_count';

// PII blacklist — TypeScript compile-time reject
type PIIParam = 'athlete_name' | 'email' | 'phone' | 'user_id_logto' | 'ip';
```

→ Khi Coder push event `view_athlete` với `bib: '7055'` → GA4 dashboard sẽ resolve `bib` dimension name → display "Số BIB" column. **Nếu Coder dùng param key `bibNumber` (camelCase) → KHÔNG match dimension `bib` (snake_case) → data orphan, KHÔNG xuất hiện reports.**

### Critical: Naming contract giữa Code ↔ GA4 Admin

| Layer | Convention | Example |
|-------|-----------|---------|
| Code event name | English snake_case | `view_athlete` |
| Code param key | English snake_case | `race_slug` |
| GA4 Custom Dimension "Event parameter" field | EXACT match code param (case-sensitive) | `race_slug` |
| GA4 Custom Dimension "Display name" | VN OK cho marketing | "Slug giải đấu" |
| GA4 Conversion event | EXACT match code event name | `share_athlete` |

---

## 📦 Option B: Tag Manager (GTM) — Defer Phase 2

PRD v1.0 dùng **direct gtag** vì:
- Đơn giản hơn (1 component existing `google-analytics.tsx` chỉ load script)
- KHÔNG cần Marketing team có GTM access
- Performance tốt hơn (KHÔNG GTM container ~25KB extra)
- Vietnam PDPA compliance trực tiếp với Consent Mode v2 gtag API

### Khi nào nên migrate sang GTM Phase 2?

- ✅ Marketing team muốn add events MỚI không cần dev push code (vd: thêm 1 button track mới)
- ✅ Multi-property setup (5BIB + 5Sport + 5Ticket cùng 1 GTM container fire ra n properties)
- ✅ Trigger advanced (vd: scroll depth 50%, dwell time >30s)
- ✅ Server-side tracking (GTM server container — Phase 3)

### Khi đó workflow:
1. Tạo GTM container (vd: `GTM-XXXXXXX`)
2. Add tag: "GA4 Configuration" with measurement ID `G-PNVB69YRL2`
3. Move 24 events từ direct gtag → GTM tag triggers (vd: trigger `share_athlete` event on dataLayer push)
4. Coder code chỉ push `dataLayer.push({event: 'share_athlete', race_slug, bib, share_method})` → GTM intercept + forward to GA4
5. Re-register 24 dimensions trong GTM "User-Defined Variables" thay vì GA4 Admin

### Defer reason
- F-041 v1.0 focus tốc độ ship — GTM thêm complexity
- Migration sau khi v1.0 stable data > 4 tuần (analytics-driven decision)
- TD-F041-GTM-MIGRATION track trong known-issues post-deploy

---

## 🛠️ Troubleshooting common issues

### Issue 1: DebugView không hiển thị user device sau Accept consent

**Causes:**
- Browser KHÔNG có GA Debugger extension enabled
- Browser KHÔNG enable cookies (incognito → tracking limited)
- Network blocking `google-analytics.com/g/collect` (ad blocker, corporate firewall)

**Fix:**
1. Open DevTools → Network tab → filter "collect" → verify request fires
2. Disable ad blocker temporarily
3. Use clean Chrome profile (no extensions)
4. Verify GA Debugger extension shows icon green

### Issue 2: Events fire nhưng Custom Dimensions empty trong reports

**Causes:**
- Dimension Event parameter field SAI tên (vd: `raceSlug` thay vì `race_slug`)
- Dimension scope SAI (User vs Event)
- Data delay 24-48h cho new dimensions trước khi appear trong Reports (DebugView real-time OK, Reports delayed)

**Fix:**
1. Check Custom Dimensions list — verify Event parameter field exact match code
2. Wait 24-48h for first data backfill in Reports
3. Use Reports > Realtime cho immediate verify (delay 30s)

### Issue 3: Consent denied user vẫn appear trong GA4 Realtime

**Cause:**
- Solution layouts (`/solution`, `/solution-5sport`, etc.) có separate gtag init KHÔNG check consent (TD-F041-SOLUTION-CONSENT-BYPASS — Manager đã flag)
- F-041 scope chỉ `(main)/` routes (per Manager Adjustment #1)

**Fix:**
- Phase 1: Acceptable risk LOW (solution = marketing landing, less PII)
- Phase 2: Unify consent across all route groups → refactor solution layouts call shared consent-manager

### Issue 4: Custom event name collision với GA4 reserved

**Reserved events GA4 KHÔNG cho phép custom:**
- `app_remove`, `app_store_refund`, `app_store_subscription_*`
- `click` (Enhanced Measurement auto, OK coexist nhưng KHÔNG override)
- `error`, `first_open`, `first_visit`, `session_start`
- `user_engagement`

**F-041 events check:** Tất cả 24 events có prefix descriptive (`view_*`, `share_*`, `select_*`, etc.) → ZERO collision với GA4 reserved. Safe.

### Issue 5: Param `status` dimension không bind data

**Cause:**
- `status` collision với GA4 built-in param (audit/error events)

**Fix:**
- Coder rename param trong code thành `action_status` (xem note Bước 3 dimension 25)
- Re-register dimension `action_status` thay `status`
- Document trong known-issues post-deploy

---

## 📝 Checklist tổng — Mày tick từng bước trước Coder ship

```
[ ] BƯỚC 1: Verify GA4 property + Data Stream ✅
[ ] BƯỚC 2: Configure Consent Mode v2 settings ✅
[ ] BƯỚC 3: Register 24 Custom Dimensions ✅ (CRITICAL — match code naming)
[ ] BƯỚC 4: Register 4 Conversion events (mark as conversion) ✅
[ ] BƯỚC 5: Data Retention 14 months + IP filter internal ✅
[ ] BƯỚC 6: DebugView accessible + QC team access ✅
[ ] BƯỚC 7: Internal traffic filter TESTING → ACTIVE sau 24h ⚪
[ ] BƯỚC 8: Funnel exploration template saved ⚪
[ ] BƯỚC 9: Audiences (defer Phase 2 nếu busy) ⚪
[ ] BƯỚC 10: Post-deploy verification (run sau Coder ship) ✅
```

---

## 🔗 Mapping back to PRD references

| PRD section | GA4 admin equivalent |
|-------------|---------------------|
| BR-41-01 mount layer | Bước 1 Data Stream config |
| BR-41-03 Consent Mode v2 | Bước 2 Consent Settings |
| BR-41-04 English event names | Bước 3 + 4 naming convention |
| BR-41-05 PII filter | Bước 3 dimensions ONLY non-PII registered + Bước 10 verify |
| BR-41-15 IP anonymization | Bước 2 Google signals OFF |
| BR-41-19 Custom dimensions schema lock | Bước 3 — 24 dimensions exact match code |
| BR-41-20 i18n labels | Bước 3 Display name VN + Event parameter EN |
| Event Taxonomy Table 24 events | Bước 4 + auto-discovery sau ship |
| Custom Dimensions Table 24 dims | Bước 3 register one-by-one |
| 4 Conversion goals | Bước 4 mark-as-conversion |
| E2E TC verification | Bước 10 DebugView walkthrough |

---

## 🔄 Workflow note

**Document này là supplementary operations runbook, KHÔNG phải code artifact F-041.**

- ✅ Document này = BA-adjacent (mày làm trong GA4 admin UI)
- ✅ Code implementation = Coder runs `/5bib-code FEATURE-041-analytics-ga4-result-frontend` separately
- ✅ Code và GA4 admin config PHẢI match exact (Custom Dimension name = code param key)
- ✅ Sau cả 2 xong → `/5bib-qc` verify end-to-end qua DebugView

**Mày làm theo guide này song song với Coder coding — KHÔNG block workflow.** ETA Phase 1 mandatory ~30 phút mày làm xong trong khi Coder code 4-6h.

---

## 📅 Next steps

1. **Mày (Danny):** Follow Bước 1-6 (mandatory ~30 phút) trong GA4 admin UI — có thể bắt đầu NGAY, không cần đợi Coder
2. **Coder:** `/5bib-code FEATURE-041-analytics-ga4-result-frontend` → implement 13-15 files
3. **QC:** Sau Coder ship → `/5bib-qc` → run Bước 10 DebugView verification
4. **Manager:** `/5bib-deploy` close feature, append patterns vào conventions.md

---

**Estimate total Danny effort:** Phase 1 mandatory ~30 phút + recommended +15 phút = **~45 phút total GA4 admin config**.
