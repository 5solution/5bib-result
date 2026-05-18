# FEATURE-041: PRD — GA4 Analytics + User Journey Tracking cho result.5bib.com

**Status:** 🔵 READY
**Last updated:** 2026-05-17
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check (BA bắt buộc làm trước khi viết)

- [x] Đã đọc `00-manager-init.md` đầy đủ (Manager đã spot-check codebase, phát hiện `GoogleAnalytics` component đã có nhưng chưa mount, 7 PAUSE-41-* conditions, 8 UX improvement opportunities)
- [x] Đã trả lời tất cả 7 PAUSE-41-* conditions — xem section cuối file
- [x] Đã đọc `memory/codebase-map.md` — `frontend/` Next.js 16 App Router structure (route group `(main)/` chứa toàn bộ public routes)
- [x] Đã đọc `memory/known-issues.md` — KHÔNG có TD existing đụng vùng `frontend/components/analytics`
- [x] Đã spot-check `frontend/app/layout.tsx` (root layout 82 dòng) — confirm mount point cho `<GoogleAnalytics />` + `<CookieConsentBanner />` + `<PageViewTracker />`

---

## 📝 GA4 Analytics + User Journey Tracking — result.5bib.com Public Frontend

**Goal:** Cài đặt Google Analytics 4 (`G-PNVB69YRL2`) cho public site `result.5bib.com` với **event taxonomy chuẩn** track user journey 8 routes critical + 18+ touch point events. Mục đích: marketing team + product owner đo được flow + identify UX friction để propose data-driven improvements (F-042+).

**Scope:**

- ✅ **In scope:**
  - Mount `<GoogleAnalytics />` component đã có (existing) vào `frontend/app/layout.tsx` `<body>`
  - Set env `NEXT_PUBLIC_GA_ID=G-PNVB69YRL2` cho PROD + DEV
  - NEW Cookie Consent Banner (Vietnam PDPA Decree 13/2023/NĐ-CP compliance) với Consent Mode v2 default `analytics_storage: denied`
  - NEW `frontend/lib/analytics/` folder:
    - `events.ts` — event taxonomy const + type-safe wrapper
    - `useGAEvent.ts` — custom hook emit type-safe events
    - `page-view-tracker.tsx` — Client Component listen `usePathname()` + emit context page_view trên SPA route change
    - `consent-manager.ts` — Consent Mode v2 state management (persist localStorage 365 days)
  - NEW Component `CookieConsentBanner.tsx` — bottom-fixed banner first visit + persist choice
  - Wire **18 events** at touch points across 8 routes (xem Event Taxonomy Table + Touch Point Wiring Table)
  - Custom dimensions: `race_slug`, `course_id`, `bib`, `lang`, `user_role`, `from_route` (referrer context)
  - Privacy: zero PII push (athlete name / email / phone explicitly blacklisted)
  - SPA pageview hybrid — Enhanced Measurement ON + manual context emit
  - 800ms debounce cho search/filter events (avoid keystroke noise)

- ❌ **Out of scope:**
  - Backend `/api/analytics/server-event` server-side track — defer Phase 2 nếu needed (vd: conversion attribution server-side)
  - Solution-specific GA property — single property `G-PNVB69YRL2` cho v1.0
  - GA4 dashboard configuration (Custom Reports, Audiences, Conversions setup) — Manager+BA làm trong GA4 UI POST-deploy, KHÔNG trong codebase
  - A/B testing infrastructure (Google Optimize retired 2026, dùng GA4 Audiences thay)
  - Backend tracking khi mutation finished (vd: certificate generated server-side) — defer
  - Vietnamese event names (English convention per GA4 best practice)
  - Outbound link tracking custom (Enhanced Measurement auto handle)
  - Server-side rendering metrics (Vercel Analytics / Sentry — out of scope)

---

## 👤 User Stories & Business Rules

### User Stories

> Format strict: As a **[Persona]**, I want to **[Action]** so that **[Benefit]**.

- As a **Marketing Lead (Danny / external)**, I want to see GA4 dashboard reflecting visitor counts + top races + conversion funnels so that I can identify high-traffic touch points + allocate ad budget.
- As a **Product Owner (Danny)**, I want to track funnel drop-off rates Homepage → Race → Ranking → Athlete → Share so that I can prioritize UX improvements with data-driven evidence.
- As an **Anonymous Visitor**, I want to be informed about cookie tracking + opt-out option so that my privacy is respected per Vietnam PDPA + GDPR international standards.
- As a **Race Athlete (Runner)**, I want my profile view + share interactions to be tracked anonymously (BIB only, no name/email) so that 5BIB measures engagement without leaking my PII.
- As a **5BIB Back-Office Admin**, I want to see realtime user activity in GA4 during race day so that I can detect issues (sudden bounce rate spike, mobile crash) early.

### Business Rules

> BR-41-01..21 — Coder + QC tham chiếu encode + verify.

#### Event Tracking Core
- **BR-41-01** (Mount layer): `<GoogleAnalytics />` MUST mount in `frontend/app/layout.tsx` `<body>` AFTER `<I18nProvider>` opening, BEFORE `<Toaster>` closing. Đảm bảo script load cho TOÀN BỘ pages (main + solution + giai-chay + landing).
- **BR-41-02** (Env config): Frontend `.env.production` + docker-compose env section set `NEXT_PUBLIC_GA_ID=G-PNVB69YRL2`. DEV environment optional (`.env.local` có thể empty để dev không pollute PROD data — when empty, component returns null gracefully).
- **BR-41-03** (Consent Mode v2 default — Vietnam PDPA): TRƯỚC khi user accept consent banner, `analytics_storage: 'denied'`, `ad_storage: 'denied'`, `ad_user_data: 'denied'`, `ad_personalization: 'denied'`. Sau user click "Đồng ý" → update all 4 → `granted`. Sau click "Từ chối" → stay denied. Persist choice in `localStorage` key `5bib_consent_v1` 365 days.
- **BR-41-04** (English event names — GA4 best practice): MỌI event name MUST English snake_case (vd: `view_race`, `share_athlete`). Custom dimensions cũng English (`race_slug`, `course_id`).
- **BR-41-05** (PII whitelist/blacklist strict):
  - ✅ **Whitelist params** (non-PII, OK to push): `bib` (race participant ID), `race_slug`, `course_id`, `lang` (vi/en), `device_type` (auto), `user_role` (anonymous/authenticated), `from_route`, `search_term` (vẫn được vì không phải user info), `result_count`, `share_method` (link/native/screenshot), `download_format` (pdf/png), `preset_bg` (image generator preset name)
  - ❌ **Blacklist params** (PII — NEVER push): `athlete_name`, `email`, `phone`, `user_id_logto`, full Vietnamese diacritic name, `ip`, `device_fingerprint`
  - **Encoded in code:** `frontend/lib/analytics/events.ts` MUST có TypeScript types reject PII fields tại compile time. Coder define `EventParams` type union strict.
- **BR-41-06** (Debounce strategy): Events fired qua user typing input MUST debounce 800ms (search, filter):
  - `search` (homepage search), `search_bib` (ranking), `filter_calendar` (date/location)
  - Implementation: `useDebouncedCallback` from `use-debounce` package (or inline `setTimeout` 800ms cleanup)
- **BR-41-07** (SPA pageview hybrid): Next.js Enhanced Measurement auto fires `page_view` trên history change. ADDITIONALLY, custom hook `PageViewTracker` emits CONTEXT events (`view_race`, `view_athlete`, `view_ranking`) WITH params (`race_slug`, `course_id`, `bib`) cho dashboard segmentation. Tránh duplicate — context events fire ngoài `page_view` (different event name).

#### Cookie Consent (Vietnam PDPA — PAUSE-41-01 Option A)
- **BR-41-08** (Banner first visit): Khi user lần đầu visit (no `5bib_consent_v1` in localStorage), banner hiển thị bottom-fixed sau 1500ms (avoid LCP impact). Position: fixed bottom-0, full-width, z-50, max-h 200px.
- **BR-41-09** (Banner content + buttons):
  - Text: "🍪 5BIB sử dụng cookie để phân tích lưu lượng và cải thiện trải nghiệm. Bạn có đồng ý không?"
  - Button "Đồng ý" (primary): grant all → emit GA `consent_accept` event → hide banner permanently
  - Button "Từ chối" (outline): deny all → hide banner permanently (GA KHÔNG emit thêm events sau)
  - Link "Tìm hiểu thêm" (text-link): navigate `/privacy-policy` (existing route hoặc placeholder OK Phase 1)
- **BR-41-10** (Persist 365 days): localStorage key `5bib_consent_v1` JSON `{ accepted: true|false, timestamp: ISO, version: 1 }`. Sau 365 days expire → re-show banner.
- **BR-41-11** (Re-consent trigger): Nếu version bump (vd: privacy policy update), set `5bib_consent_v1.version = 2` → banner re-show. Phase 1 hardcode version 1.

#### Performance
- **BR-41-12** (Async load): `<Script strategy="afterInteractive">` đã có sẵn trong existing component. KHÔNG đổi sang `beforeInteractive` (block FCP).
- **BR-41-13** (LCP impact threshold): Core Web Vitals KHÔNG được degrade > 5% post-deploy. QC verify Lighthouse score before/after.
- **BR-41-14** (Bundle size): `frontend/lib/analytics/` total bundle gzipped < 5KB (events.ts + useGAEvent.ts + page-view-tracker.tsx + consent-manager.ts).

#### Privacy & Compliance
- **BR-41-15** (IP anonymization): GA4 auto anonymizes IP by default — KHÔNG cần custom config.
- **BR-41-16** (Vietnam PDPA compliance markers): Banner hiển thị **before** any GA event fires (Consent Mode v2 ensures this). QC verify GA4 Realtime KHÔNG có active users từ Vietnam pre-consent.
- **BR-41-17** (Right to opt-out): User có thể revoke consent qua `/privacy-policy` page (Phase 1 placeholder OK, Phase 2 implement revoke button). Khi revoke → clear localStorage + reload page.

#### Convention
- **BR-41-18** (Event taxonomy single source of truth): TẤT CẢ event names + param shapes define trong `events.ts` const + TypeScript types. KHÔNG được hardcode string event names elsewhere.
- **BR-41-19** (Custom dimensions schema lock): Schema xem Custom Dimensions Table — Coder KHÔNG được add ad-hoc dimensions ngoài table này. Future feature thêm dimension → update PRD trước.
- **BR-41-20** (i18n labels English event, VN tooltip OK): Internal code English. Marketing dashboard có thể VN label sau qua GA4 Custom Definition UI.
- **BR-41-21** (Sponsor click tracking): Outbound to sponsor website — Enhanced Measurement auto fire `click` event với `link_domain`. ADDITIONALLY emit custom `select_sponsor` với `sponsor_name` + `sponsor_id` (KHÔNG `sponsor_url` — tránh duplicate với Enhanced).

---

## 🖥️ UI/UX Flow — STEP-BY-STEP CHI TIẾT

### Route structure (touch points)

| Route | Access | Page file |
|-------|--------|-----------|
| `/` | public | `frontend/app/(main)/page.tsx` |
| `/calendar` | public | `frontend/app/(main)/calendar/page.tsx` |
| `/search` | public | `frontend/app/(main)/search/page.tsx` |
| `/races/[slug]` | public | `frontend/app/(main)/races/[slug]/page.tsx` |
| `/races/[slug]/ranking/[courseId]` | public | (course ranking page) |
| `/races/[slug]/[bib]` | public | `frontend/app/(main)/races/[slug]/[bib]/page.tsx` |
| `/hub/[slug]` | public | `frontend/app/(main)/hub/[slug]/page.tsx` |
| `/giai-chay/*` | public | `frontend/app/(main)/giai-chay/...` |

### Screen 1: Cookie Consent Banner (NEW Component) — Mount toàn bộ pages via root layout

**Layout:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ... page content ...                                                    │
│                                                                         │
│                                                                         │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ 🍪 5BIB sử dụng cookie để phân tích lưu lượng và cải thiện trải nghiệm. │
│ Bạn có đồng ý không?                                                    │
│                          [Tìm hiểu thêm]  [ Từ chối ]  [ Đồng ý ]      │
└─────────────────────────────────────────────────────────────────────────┘
                                              ↑ fixed bottom-0 z-50
```

**Trigger:** Component mount → check `localStorage['5bib_consent_v1']`. If missing/expired/version-mismatch → setTimeout 1500ms → setState `visible: true` → banner fade-in 200ms.

**Field source:**

| Field UI label | Data source | Format hiển thị | Empty state |
|----------------|-------------|-----------------|-------------|
| Banner text VN | i18n key `cookie.consent.message` (or hardcoded fallback) | text VN | always shown |
| Button "Đồng ý" | i18n key `cookie.consent.accept` | text VN | always shown |
| Button "Từ chối" | i18n key `cookie.consent.reject` | text VN | always shown |
| Link "Tìm hiểu thêm" | i18n key `cookie.consent.learn_more` → href `/privacy-policy` | text-link blue | always shown |

### UI Step-by-Step Journey: Anonymous Visitor first visit + accept consent

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Open `https://result.5bib.com/` | Homepage render. GA script load `afterInteractive` strategy. Consent Mode default `denied` — GA KHÔNG fire bất kỳ event nào | `<GoogleAnalytics />` mount + `gtag('consent', 'default', {...denied})` | Cookie banner pending check localStorage |
| 2 | 1500ms after page load | Cookie banner fade-in từ bottom 200ms ease-out | `setTimeout` in `CookieConsentBanner` component | Banner visible |
| 3 | Click "Đồng ý" | Banner fade-out 200ms. `gtag('consent', 'update', {analytics_storage: 'granted', ...})`. Emit GA event `consent_accept`. Persist `localStorage['5bib_consent_v1'] = {accepted: true, timestamp, version: 1}` | onClick handler | Banner hidden permanently. GA tracking active |
| 4 | GA Realtime dashboard | User session shown in GA4 Realtime > Last 30 min. `page_view` event fires (Enhanced Measurement) | Auto | User tracked |
| 5 | Navigate to `/races/cat-tien-jungle-paths-2026` (race detail) | Page render. `<PageViewTracker>` fire `view_race` event với `race_slug: 'cat-tien-jungle-paths-2026'` | Custom hook `useGAEvent` | GA event recorded |
| 6 | Click course tab "Trail 70Km" | UI re-render ranking. Fire `select_course_tab` với `race_slug + course_id: 'trail-70km'` | Tab click handler | GA event recorded |
| 7 | Click row athlete BIB 7055 | Navigate `/races/.../7055`. Fire `view_athlete` với `bib: '7055', race_slug, from_route: 'ranking'` | Next.js Link onClick | GA event recorded |
| 8 | Click share button on athlete page | Native share dialog open. Fire `share_athlete` với `bib, race_slug, share_method: 'native'\|'link'` | onClick share | GA event recorded |
| 9 | Click "Tải chứng nhận" (PDF) | Download starts. Fire `download_certificate` với `bib, race_slug, download_format: 'pdf'` | onClick download | GA event recorded |

### UI Step-by-Step Journey 2: Anonymous Visitor reject consent

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Open homepage | Banner appear after 1500ms | Same as J1 step 1-2 | Banner visible |
| 2 | Click "Từ chối" | Banner fade-out. `gtag('consent', 'update', {...denied})`. NO event emit (Consent Mode v2 ensures). Persist `localStorage['5bib_consent_v1'] = {accepted: false, timestamp, version: 1}` | onClick handler | Banner hidden. GA tracking DISABLED |
| 3 | Navigate anywhere | Pages still functional. NO `page_view` / `view_race` / etc events fire | Consent denied | User KHÔNG tracked trong GA4 |
| 4 | (Optional Phase 2) Go to `/privacy-policy` → click "Đổi ý — Đồng ý track" | Clear localStorage → reload → banner re-show | revoke handler | Re-consent flow |

### Buttons Specification Table — CookieConsentBanner

| Button label | Position | Default state | Disabled state | Loading state | Action | Confirm dialog? |
|--------------|----------|---------------|----------------|---------------|--------|-----------------|
| "Đồng ý" | Banner right, primary | Filled blue/green, font-semibold | Disabled if `localStorage` write fail (rare) | N/A | onClick → `gtag('consent','update',{...granted})` + persist localStorage + setState visible=false | NO |
| "Từ chối" | Banner right, before primary | Outline grey, font-medium | KHÔNG | N/A | onClick → `gtag('consent','update',{...denied})` + persist localStorage + setState visible=false | NO |
| "Tìm hiểu thêm" | Banner left, before reject | Text-link blue underline | KHÔNG | N/A | Navigate `/privacy-policy` (Next.js Link) | NO |

### UI States — Cookie Consent Banner

| State | Trigger | UI |
|-------|---------|-----|
| **Hidden (default)** | `localStorage['5bib_consent_v1']` exists + accepted=true/false + version match + not expired | Component returns null, no DOM |
| **Pending check** | Component mount, before localStorage read complete | Returns null (1ms SSR safe) |
| **Visible (post 1500ms)** | First visit OR expired OR version mismatch | Bottom-fixed banner fade-in 200ms |
| **Submitting** | User click button | Button disabled, prevent double-click race condition |
| **Hidden post-action** | User clicked accept/reject | Fade-out 200ms → DOM removed |
| **Error localStorage write** | Browser private mode / quota exceeded | Banner stays visible với fallback toast "Cookie disabled — KHÔNG thể lưu lựa chọn" — page works but banner re-shows every visit |

---

## 📊 Event Taxonomy Table (MANDATORY)

> **CONVENTION:** English snake_case event names. Param values: snake_case strings. Numeric/Boolean OK. NEVER PII.

| # | Event name | Trigger | Required params | Optional params | Purpose | Conversion goal? | Debounce |
|---|-----------|---------|-----------------|-----------------|---------|------------------|----------|
| 1 | `page_view` | Auto via Enhanced Measurement + SPA history change | (auto: `page_location`, `page_title`, `page_referrer`) | `lang` | Baseline visitor tracking | NO | 0ms (immediate) |
| 2 | `consent_accept` | User click "Đồng ý" cookie banner | (none) | `lang` | Cookie banner conversion rate | NO | 0ms |
| 3 | `view_race` | Page mount `/races/[slug]` | `race_slug` | `lang`, `from_route` | Track race interest | NO | 0ms |
| 4 | `view_ranking` | Page mount `/races/[slug]/ranking/[courseId]` | `race_slug`, `course_id` | `lang`, `from_route` | Track ranking page visits | NO | 0ms |
| 5 | `view_athlete` | Page mount `/races/[slug]/[bib]` | `race_slug`, `bib` | `lang`, `from_route` (ranking/search/direct) | Track athlete profile views | NO | 0ms |
| 6 | `view_hub` | Page mount `/hub/[slug]` | `hub_slug` | `lang` | Promo hub engagement | NO | 0ms |
| 7 | `view_race_calendar` | Page mount `/calendar` | (none) | `lang` | Calendar baseline | NO | 0ms |
| 8 | `view_race_directory` | Page mount `/giai-chay/*` | (none) | `lang`, `city_slug` (if filter) | Race directory baseline | NO | 0ms |
| 9 | `select_course_tab` | User click course tab on race detail | `race_slug`, `course_id` | `lang`, `tab_index` | Course tab discovery analysis | NO | 0ms |
| 10 | `select_race` | User click race card từ homepage/calendar/directory | `race_slug` | `from_route` (homepage/calendar/directory/search) | Race card CTR | YES (engagement) | 0ms |
| 11 | `select_promo_section` | User click featured promo section on homepage | `section_id` | `lang` | Homepage promo CTR | NO | 0ms |
| 12 | `search` | Homepage search submit | `search_term` (raw query string) | `result_count` (post-fetch) | Search behavior + zero-result detection | NO | 800ms |
| 13 | `search_bib` | Ranking page search input | `race_slug`, `course_id`, `search_term` | `result_count` | BIB discovery analysis | NO | 800ms |
| 14 | `filter_calendar` | Calendar page filter change | `filter_type` (date/location), `filter_value` | (none) | Calendar filter usage | NO | 800ms |
| 15 | `filter_ranking` | Ranking page filter change | `race_slug`, `course_id`, `filter_type` (gender/age_group/status), `filter_value` | (none) | Ranking filter usage | NO | 800ms |
| 16 | `sort_ranking` | Ranking column header click | `race_slug`, `course_id`, `sort_field`, `sort_direction` (asc/desc) | (none) | Sort preference analysis | NO | 0ms (click-driven) |
| 17 | `share_athlete` | Athlete page share button click | `race_slug`, `bib`, `share_method` (native/link/screenshot) | `lang` | Athlete share conversion | YES (primary KPI) | 0ms |
| 18 | `share_race` | Race detail share button click | `race_slug`, `share_method` | `lang` | Race share conversion | NO | 0ms |
| 19 | `download_certificate` | Athlete page "Tải chứng nhận" click | `race_slug`, `bib`, `download_format` (pdf/png) | `lang` | Certificate engagement | YES (engagement KPI) | 0ms |
| 20 | `generate_result_image` | Result image generator complete | `race_slug`, `bib`, `preset_bg` (preset name OR "custom"), `status` (success/fail) | `lang` | Image generator usage | YES (engagement) | 0ms |
| 21 | `share_result_image` | Result image post-generate share click | `race_slug`, `bib`, `share_method` (native/download/copy_link) | `lang` | Image share follow-through | YES (primary KPI) | 0ms |
| 22 | `compare_open` | Compare athletes feature opened | `race_slug`, `bib_count` (number of bibs in compare) | `lang` | Compare feature usage | NO | 0ms |
| 23 | `select_sponsor` | Sponsor logo click outbound | `sponsor_name`, `sponsor_id`, `position` (sidebar/footer/race_page) | `lang` | Sponsor value tracking cho marketing | NO | 0ms |
| 24 | `click_floating_action` | Floating action bar item click | `action_type` (back_to_top/share/scroll_splits) | `race_slug`, `bib`, `lang` | Floating bar effectiveness | NO | 0ms |

**Total: 24 events** (Manager đã đề xuất 18, BA bổ sung thêm 6 sau analysis: `consent_accept`, `view_race_calendar`, `view_race_directory`, `select_promo_section`, `share_race`, `compare_open` — đầy đủ funnel + side-tracking).

**4 Conversion goals đề xuất (primary KPIs):**
- `share_athlete` — main viral loop metric
- `share_result_image` — visual share viral
- `download_certificate` — completion engagement
- `generate_result_image` — creator engagement

---

## 📊 Custom Dimensions Table (MANDATORY)

> Define ở GA4 Admin > Custom Definitions > Custom Dimensions (dashboard config). Code chỉ push values qua event params.

| Dimension name | Scope | Description | Sample values | Source |
|----------------|-------|-------------|---------------|--------|
| `race_slug` | Event | Race identifier slug | `cat-tien-jungle-paths-2026`, `vietnam-mountain-marathon-2026` | URL param |
| `course_id` | Event | Course identifier within race | `trail-5km`, `trail-70km`, `21km` | URL param |
| `bib` | Event | Race participant BIB number (non-PII, race-scoped) | `7055`, `1023` | URL param athlete page |
| `lang` | User | UI language preference | `vi`, `en` | i18next state |
| `user_role` | User | User authentication state | `anonymous`, `authenticated` | Session check |
| `from_route` | Event | Referrer route context (NOT URL) | `ranking`, `search`, `homepage`, `directory`, `direct` | Navigation state / referrer |
| `share_method` | Event | Share UX path | `native` (Web Share API), `link` (copy URL), `screenshot`, `download`, `copy_link` | Component state |
| `download_format` | Event | Certificate/image format | `pdf`, `png` | Click handler |
| `preset_bg` | Event | Result image preset background | `blue`, `dark`, `sunset`, `forest`, `purple`, `custom` | Image generator state |
| `sponsor_name` | Event | Sponsor display name | `5BIB`, `5Sport`, `5Ticket` | Sponsor object |
| `sponsor_id` | Event | Sponsor MongoDB `_id` (string) | `69ce9118a10427a3b08c63d8` | Sponsor data |
| `position` | Event | UI position context | `sidebar`, `footer`, `race_page`, `result_card` | Component prop |
| `action_type` | Event | Floating action type | `back_to_top`, `share`, `scroll_splits` | Action handler |
| `filter_type` | Event | Filter axis | `date`, `location`, `gender`, `age_group`, `status` | Filter state |
| `filter_value` | Event | Filter value (post-debounce) | `2026-05`, `da-lat`, `male`, `M30-39` | Filter state |
| `sort_field` | Event | Sort axis ranking | `chip_time`, `gun_time`, `overall_rank`, `gender_rank` | Sort state |
| `sort_direction` | Event | Sort order | `asc`, `desc` | Sort state |
| `search_term` | Event | Raw search query (non-PII assumed) | `Nguyen`, `7055`, `Cat Tien` | Search input post-debounce |
| `result_count` | Event | Search/filter result count | `42`, `0`, `1523` | Post-fetch state |
| `tab_index` | Event | Tab numerical index for fallback | `0`, `1`, `2` | Tab component state |
| `hub_slug` | Event | Promo hub slug | `khuyen-mai-thang-5` | URL param |
| `section_id` | Event | Homepage promo section ID | `featured-races`, `hub-promo`, `sponsor-strip` | Component prop |
| `city_slug` | Event | Race directory city filter | `ha-noi`, `tp-hcm`, `da-nang` | URL param |
| `bib_count` | Event | Number of BIBs in compare | `2`, `3`, `4` | Compare state |
| `status` | Event | Action outcome | `success`, `fail`, `cancel` | Async result |

**Total: 24 custom dimensions.** Coder MUST register names trong `events.ts` const + TypeScript types reject ad-hoc dimensions.

---

## 🗂️ Touch Point Wiring Table (MANDATORY for Coder)

> File path + component + event_name + approximate line range cho Coder không lan man.

| Event | File | Component / Handler | Approx implementation |
|-------|------|---------------------|------------------------|
| `page_view` (custom hook hybrid) | `frontend/lib/analytics/page-view-tracker.tsx` (NEW) | `<PageViewTracker />` Client Component listen `usePathname()` | useEffect on pathname change |
| `consent_accept` | `frontend/components/CookieConsentBanner.tsx` (NEW) | `<CookieConsentBanner />` onClick "Đồng ý" | onClick handler |
| `view_race` | `frontend/app/(main)/races/[slug]/page.tsx` (~existing) | Page component | useEffect on mount với `race_slug` param |
| `view_ranking` | course ranking page (find by route `/races/[slug]/ranking/[courseId]`) | Page component | useEffect on mount |
| `view_athlete` | `frontend/app/(main)/races/[slug]/[bib]/page.tsx:~280-316` (existing) | Page component | useEffect on mount with bib + slug |
| `view_hub` | `frontend/app/(main)/hub/[slug]/page.tsx` | Page component | useEffect on mount |
| `view_race_calendar` | `frontend/app/(main)/calendar/page.tsx` | Page component | useEffect on mount |
| `view_race_directory` | `frontend/app/(main)/giai-chay/page.tsx` | Page component | useEffect on mount |
| `select_course_tab` | course tabs component (search by "course tab" in race detail page) | Tab onClick handler | Wire useGAEvent |
| `select_race` | race card component (search `RaceCard.tsx` or similar) | Card onClick (Next.js Link wrapped) | Wire useGAEvent before navigate |
| `select_promo_section` | homepage promo sections | Section card onClick | Wire useGAEvent |
| `search` | homepage search input | Search submit handler | Debounced 800ms useGAEvent |
| `search_bib` | ranking page search input | Search input change handler | Debounced 800ms useGAEvent |
| `filter_calendar` | calendar page filter component | Filter onChange | Debounced 800ms useGAEvent |
| `filter_ranking` | ranking page filter | Filter onChange | Debounced 800ms useGAEvent |
| `sort_ranking` | ranking column header | Column click handler | Wire useGAEvent (no debounce) |
| `share_athlete` | `frontend/app/(main)/races/[slug]/[bib]/page.tsx` | Share button onClick | Wire useGAEvent in handler |
| `share_race` | `frontend/app/(main)/races/[slug]/page.tsx` | Race share button | Wire useGAEvent |
| `download_certificate` | athlete page certificate button | Download onClick | Wire useGAEvent before navigation |
| `generate_result_image` | `frontend/components/result-image/ResultImageCreator.tsx` | Generate success/fail callback | Wire useGAEvent với status |
| `share_result_image` | `frontend/components/ResultImageEditor.tsx` | Share onClick post-generate | Wire useGAEvent |
| `compare_open` | compare athletes feature (search "compare" component) | Compare modal open | Wire useGAEvent |
| `select_sponsor` | sponsor sidebar component | Sponsor logo onClick (outbound link) | Wire useGAEvent before navigation |
| `click_floating_action` | `frontend/components/FloatingActionBar.tsx` | Each action button onClick | Wire useGAEvent với action_type param |

**Estimated Coder workload:** ~12-15 file modifications (3-4 NEW lib files + 1 NEW component + 8-10 page/component wire) + tests + manual GA4 DebugView verify.

---

## 🛠️ Technical Mandates (For Coder Agent)

### DB / Cache changes

- ❌ **MongoDB:** KHÔNG đụng
- ❌ **Redis:** KHÔNG đụng
- ❌ **S3:** KHÔNG đụng
- ❌ **MySQL platform:** KHÔNG đụng
- ✅ **localStorage** (client-side): NEW key `5bib_consent_v1` JSON `{accepted: boolean, timestamp: ISO, version: 1}` TTL 365 days (manual check in code, not browser-enforced)

### Backend Endpoint Specification

❌ **KHÔNG có endpoint backend mới.** F-041 thuần client-side analytics.

### Frontend / Public (Next.js)

**Root layout mount (`frontend/app/layout.tsx`):**
- Mount `<GoogleAnalytics />` inside `<body>` AFTER `<I18nProvider>` opening, BEFORE `<Toaster>`
- Mount `<CookieConsentBanner />` after `<Toaster>` (Client Component, fixed position bottom)
- Mount `<PageViewTracker />` inside `<I18nProvider>` (Client Component, listens pathname change)

**Component types:**
- `<GoogleAnalytics />` — EXISTING `'use client'` (no change)
- `<CookieConsentBanner />` — NEW `'use client'` (state + localStorage)
- `<PageViewTracker />` — NEW `'use client'` (uses `usePathname()` hook)
- `frontend/lib/analytics/events.ts` — pure TS module (no React)
- `frontend/lib/analytics/useGAEvent.ts` — NEW custom hook
- `frontend/lib/analytics/consent-manager.ts` — pure TS module (localStorage helpers)

**TanStack Query:**
- ❌ N/A — KHÔNG fetch backend
- Page mount events use `useEffect` directly

**Revalidate:**
- ❌ N/A — KHÔNG có mutation

**Generated SDK:**
- ❌ N/A — KHÔNG đụng backend DTO

**Base UI / shadcn:**
- Cookie banner: dùng shadcn `<Button>` (primary + outline variants). NEW `<CookieConsentBanner.tsx>` chỉ wrap div + 2 buttons + link, KHÔNG dùng Dialog (banner inline bottom-fixed, dialog quá nặng cho use case này).

**i18n:**
- Add 3 keys cho Vietnamese cookie consent vào `frontend/locales/vi.json`:
  - `cookie.consent.message`: "🍪 5BIB sử dụng cookie để phân tích lưu lượng và cải thiện trải nghiệm. Bạn có đồng ý không?"
  - `cookie.consent.accept`: "Đồng ý"
  - `cookie.consent.reject`: "Từ chối"
  - `cookie.consent.learn_more`: "Tìm hiểu thêm"
- Add same keys English `en.json`:
  - `cookie.consent.message`: "🍪 5BIB uses cookies to analyze traffic and improve your experience. Do you agree?"
  - `cookie.consent.accept`: "Accept"
  - `cookie.consent.reject`: "Reject"
  - `cookie.consent.learn_more`: "Learn more"

**Env config:**
- `frontend/.env.production`: `NEXT_PUBLIC_GA_ID=G-PNVB69YRL2`
- `docker-compose.yml` PROD `frontend` service: add env `NEXT_PUBLIC_GA_ID=G-PNVB69YRL2` (build-time variable cho Next.js)
- DEV environment optional empty (component returns null gracefully)

### PAUSE flags

- ❌ KHÔNG cần migration MongoDB/MySQL
- ❌ KHÔNG cần `pnpm install` dep mới (Next.js `next/script` đã có, no extra lib needed for Consent Mode v2 — pure gtag API)
- ❌ KHÔNG breaking API change
- ❌ KHÔNG auth/security logic
- ❌ KHÔNG financial logic
- ✅ **CAN PROCEED** without PAUSE — straightforward client-side integration

---

## 🛡️ Testing Mandates (For QC Agent)

### Frontend E2E Test Cases (Playwright)

| TC | Persona | Journey | Steps | Expected |
|----|---------|---------|-------|----------|
| E2E-01 | Anonymous Visitor first visit | Cookie banner appear + accept | 1. Open `/` 2. Wait 2s 3. Verify banner visible 4. Click "Đồng ý" | Banner disappear, localStorage has `5bib_consent_v1` with accepted=true |
| E2E-02 | Anonymous Visitor first visit | Cookie banner reject | 1. Open `/` 2. Wait 2s 3. Click "Từ chối" | Banner disappear, localStorage accepted=false, GA dataLayer KHÔNG có events |
| E2E-03 | Returning Visitor accepted | NO banner re-show | 1. Pre-seed localStorage `5bib_consent_v1` accepted=true 2. Open `/` | Banner KHÔNG hiển thị. GA fires immediately on page_view |
| E2E-04 | Returning Visitor rejected | NO banner re-show, NO tracking | 1. Pre-seed localStorage accepted=false 2. Open `/` 3. Navigate `/calendar` | Banner KHÔNG show, dataLayer KHÔNG có view_race_calendar event |
| E2E-05 | Marketing | Verify view_race event fires | 1. Accept consent 2. Navigate `/races/cat-tien-jungle-paths-2026` 3. Check `window.dataLayer` | dataLayer contains object `{event: 'view_race', race_slug: 'cat-tien-jungle-paths-2026'}` |
| E2E-06 | Marketing | Verify view_athlete event with bib param | 1. Accept consent 2. Navigate `/races/cat-tien-jungle-paths-2026/7055` 3. Check dataLayer | Contains `{event: 'view_athlete', race_slug, bib: '7055', from_route: 'direct'}` |
| E2E-07 | Athlete share | Verify share_athlete event | 1. Accept consent 2. Open athlete page 3. Click share button 4. Check dataLayer | Contains `{event: 'share_athlete', race_slug, bib, share_method: 'native'}` |
| E2E-08 | Search debounce | Verify search debounce 800ms | 1. Open `/search` 2. Type "Nguyen" letter-by-letter (100ms between keys) 3. Wait 1s 4. Check dataLayer | EXACTLY 1 event `search` with `search_term: 'Nguyen'` (not 6) |
| E2E-09 | PII filter verify | Verify athlete name KHÔNG push | 1. Open athlete page BIB 7055 NGUYỄN HUỲNH ANH 2. Check dataLayer JSON.stringify | NO occurrence of "NGUYỄN" or "HUỲNH ANH" trong any event params |
| E2E-10 | Cookie consent persistence | Verify 365-day persistence | 1. Accept consent 2. localStorage timestamp = 364 days ago 3. Reload | Banner KHÔNG re-show (still within 365 days) |
| E2E-11 | Cookie consent expiry | Verify re-show after 365 days | 1. Pre-seed localStorage timestamp = 366 days ago 2. Open `/` | Banner re-show |
| E2E-12 | Multi-language event | Verify lang dimension | 1. Switch UI to English 2. Accept consent 3. Navigate `/races/.../` 4. Check dataLayer | view_race event has `lang: 'en'` |
| E2E-13 | Mobile native share | Verify share_method = native | 1. Open athlete page mobile UA 2. Click share 3. Mock Web Share API success | Event has `share_method: 'native'` |
| E2E-14 | Sponsor outbound | Verify select_sponsor + Enhanced auto click | 1. Accept consent 2. Click sponsor logo 3. Check dataLayer | Contains BOTH custom `select_sponsor` event AND auto `click` event (Enhanced Measurement) |
| E2E-15 | Result image generator | Verify generate_result_image with preset_bg | 1. Open athlete page 2. Open image generator 3. Select preset "sunset" 4. Click generate | Contains `{event: 'generate_result_image', race_slug, bib, preset_bg: 'sunset', status: 'success'}` |

### GA4 DebugView Manual Verification (QC mandatory)

> Sau deploy, QC mở GA4 Admin > DebugView (real-time event stream từ tester device) + verify từng event.

**Setup DebugView:**
1. Install Chrome extension "Google Analytics Debugger" — enable on result.5bib.com
2. Mở `https://analytics.google.com/analytics/web/#/p<property>/admin/debugview` (Danny grant access)
3. Visit result.5bib.com, accept consent
4. Each user action → verify event hiển thị trong DebugView với đúng params

**QC checklist 24 events:** Mỗi event trong Event Taxonomy Table phải fire đúng trong DebugView. Tick từng cái.

### Performance SLA

- **LCP impact:** Lighthouse audit `result.5bib.com/` desktop + mobile BEFORE deploy + AFTER deploy. LCP KHÔNG được tăng > 5% (vd: pre 2.1s → post 2.2s acceptable, post 2.5s → FAIL).
- **FID impact:** First Input Delay KHÔNG được tăng > 10ms.
- **CLS impact:** Cookie banner mount KHÔNG được cause layout shift > 0.1 (banner fixed bottom, không push content).
- **Bundle size:** `frontend/lib/analytics/` total gzipped < 5KB (Coder report via `pnpm build` analyze).
- **Time to first event:** From page load → first `page_view` event fires < 3 seconds.

### Security Checks

- [ ] **NO PII in any event param** — QC grep `dataLayer.push.*athlete_name|email|phone` in production HTML/JS bundle → MUST be empty
- [ ] **Consent Mode v2 default denied** — pre-consent NO events fire (verify GA4 DebugView empty)
- [ ] **localStorage key isolated** — KHÔNG conflict với existing keys
- [ ] **No XSS via event params** — `search_term` raw string nhưng GA4 SDK sanitizes; KHÔNG inject into DOM
- [ ] **`G-PNVB69YRL2` public ID** — confirm KHÔNG có secret env leaked

### Privacy & Compliance Checks

- [ ] Vietnam PDPA Decree 13/2023/NĐ-CP — banner shown before tracking ✅
- [ ] GDPR-compliant — Consent Mode v2 default denied ✅
- [ ] IP anonymization — GA4 default, no custom config needed ✅
- [ ] Opt-out mechanism — Phase 1 via clear localStorage (manual), Phase 2 button trong `/privacy-policy`
- [ ] Cookie lifetime — 365 days max, then re-prompt

---

## 📌 Answers to Manager's PAUSE conditions (từ file 00)

> BA giải quyết 7 PAUSE-41-* Manager đã đặt.

- **PAUSE-41-01 (Vietnam PDPA Cookie Consent):** ✅ **Option A** — implement minimal cookie consent banner + Consent Mode v2 default `denied`. Banner appear after 1500ms first visit, persist 365 days. Encoded as **BR-41-03 / BR-41-08..11**.

- **PAUSE-41-02 (PII filter):** ✅ Confirmed whitelist + blacklist strict. Encoded as **BR-41-05** với 24 custom dimensions table verified zero PII. Coder MUST implement TypeScript types reject PII tại compile time.

- **PAUSE-41-03 (Event taxonomy final):** ✅ **24 events** finalized (Manager đề xuất 18 + BA bổ sung 6: `consent_accept`, `view_race_calendar`, `view_race_directory`, `select_promo_section`, `share_race`, `compare_open`). 4 conversion goals đề xuất: `share_athlete`, `share_result_image`, `download_certificate`, `generate_result_image`. Funnel critical: Homepage → Race → Ranking → Athlete → Share. Encoded as Event Taxonomy Table.

- **PAUSE-41-04 (Debounce strategy):** ✅ 800ms debounce cho 4 events: `search`, `search_bib`, `filter_calendar`, `filter_ranking`. Sort events KHÔNG debounce (click-driven). Encoded as **BR-41-06**.

- **PAUSE-41-05 (SPA pageview tracking):** ✅ **Hybrid** — Enhanced Measurement ON (auto track URL change) + custom hook `<PageViewTracker />` emit context events (`view_race` / `view_athlete` / etc) với entity params. Encoded as **BR-41-07**.

- **PAUSE-41-06 (Solution-specific GA property):** ✅ **Single property** `G-PNVB69YRL2` cho v1.0. Component existing `google-analytics.tsx` đã support dual-tracker pattern qua `NEXT_PUBLIC_GA_SOLUTION_ID` env (nếu marketing cần separate sau, chỉ cần set env, NO code change). Encoded implicitly — env config single ID Phase 1.

- **PAUSE-41-07 (Event names EN vs VN):** ✅ **English event names + English param keys**. VN labels chỉ trong i18n cho cookie banner UI text + Custom Dimension display name trong GA4 Admin dashboard (post-deploy config layer). Encoded as **BR-41-04 / BR-41-20**.

---

## ✅ Status

- [x] **READY** — sẵn sàng cho Manager review (`/5bib-plan`)

---

## 🔗 Next step

Danny chạy: `/5bib-plan FEATURE-041-analytics-ga4-result-frontend`

Manager sẽ:
1. Validate checklist (User Stories + 21 BR-41-XX testable + UI states đủ + Tech / Security / Performance / Testability)
2. Cross-check memory architecture + conventions + known-issues
3. **Spot-check code thật** (mandatory per skill update 2026-05-17): verify `frontend/components/analytics/google-analytics.tsx` exists + signature match PRD; verify root layout structure + i18n keys path
4. Output `02-manager-plan.md` với Scope Lock + verdict APPROVED hoặc NEEDS_REVISION

**Estimate Coder workload:** ~12-15 files (4 NEW lib + 1 NEW component + 8-10 wire points) + 0 backend + i18n keys + env config + 15 E2E tests + manual GA4 DebugView verify post-deploy.
