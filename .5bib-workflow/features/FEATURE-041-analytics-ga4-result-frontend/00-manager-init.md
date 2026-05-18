# FEATURE-041: GA4 Analytics + User Journey Tracking cho result.5bib.com

**Status:** 🟡 INITIATED
**Created:** 2026-05-17
**Owner:** Danny
**Type:** EXTEND_EXISTING (component `GoogleAnalytics` đã sẵn nhưng chưa được mount/integrate; thêm custom event tracking layer)
**Created by:** 5bib-manager

---

## 🎯 Why this feature

Danny request 2026-05-17: cài đặt **Google Analytics 4** (`G-PNVB69YRL2`) cho trang public `result.5bib.com` với mục đích **track standard user journey steps** để phân tích flow + tìm điểm cải tiến UX.

Hiện trạng phát hiện qua memory + spot-check:
- ✅ Component `frontend/components/analytics/google-analytics.tsx` ĐÃ tồn tại (dual-tracker pattern via `NEXT_PUBLIC_GA_ID` + `NEXT_PUBLIC_GA_SOLUTION_ID`)
- ❌ **Chưa mount vào layout nào** (`grep usage` rỗng — Coder cũ viết component nhưng quên integrate)
- ❌ Chưa có custom event tracking — chỉ default `gtag('config', ...)` mặc định fire pageview qua Enhanced Measurement

→ Feature F-041 = **wire existing component + add custom event taxonomy** cho user journey points then chốt + analytics insights cho team.

---

## 📂 Impact Map (theo memory + spot-check 2026-05-17)

### Module sẽ chạm

**Frontend (Next.js 16 App Router — `frontend/`):**

- `frontend/app/layout.tsx` (root layout) — **MOUNT** `<GoogleAnalytics />` component vào `<body>` (per comment line 13 component file)
- `frontend/.env.local` + `frontend/.env.production` (hoặc env config docker) — set `NEXT_PUBLIC_GA_ID=G-PNVB69YRL2`
- `frontend/components/analytics/google-analytics.tsx` — đã sẵn, **có thể extend** thêm Consent Mode v2 default state nếu cần (PAUSE)
- `frontend/lib/analytics/` (NEW folder) — custom hook + event helpers:
  - `useGAEvent.ts` — type-safe event emitter wrapper around `window.gtag(...)`
  - `events.ts` — event taxonomy const (event names + param shapes) — single source of truth
  - `pageview-tracker.tsx` — Client Component listen `usePathname()` + emit `page_view` on SPA route change (Next.js App Router KHÔNG auto fire)

**Touch points cần wire events (per user journey discovery):**

| Route | Event(s) | Touch point file |
|-------|----------|------------------|
| `/` (homepage) | `page_view`, `select_promo_section` (click featured race) | `frontend/app/(main)/page.tsx` |
| `/calendar` | `page_view`, `view_race_calendar`, `filter_calendar` (date/location filter) | `frontend/app/(main)/calendar/page.tsx` |
| `/search` | `page_view`, `search` (query) | `frontend/app/(main)/search/page.tsx` |
| `/races/[slug]` | `page_view`, `view_race` (race_slug param), `select_course_tab`, `share_race` | `frontend/app/(main)/races/[slug]/page.tsx` |
| `/races/[slug]/ranking/[courseId]` | `page_view`, `view_ranking`, `search_bib`, `sort_ranking`, `filter_ranking` | (course ranking page) |
| `/races/[slug]/[bib]` (athlete profile) | `page_view`, `view_athlete`, `scroll_splits`, `share_athlete`, `download_certificate`, `generate_result_image`, `compare_open` | `frontend/app/(main)/races/[slug]/[bib]/page.tsx` |
| `/hub/[slug]` | `page_view`, `view_hub` | `frontend/app/(main)/hub/[slug]/page.tsx` |
| `/giai-chay/*` | `page_view`, `view_race_directory` | `frontend/app/(main)/giai-chay/...` |
| `/calendar` → race click | `select_race` (outbound to race detail) | calendar component |
| Sponsor card click | `select_sponsor` (outbound link) | sponsor sidebar component |
| Result image generator | `generate_result_image`, `share_result_image` (preset bg, custom upload) | `frontend/components/result-image/ResultImageCreator.tsx` |
| Floating action bar | `click_floating_action` (back to top, share, etc.) | `frontend/components/FloatingActionBar.tsx` |

### File then chốt cần Coder đọc trước khi code

- `frontend/components/analytics/google-analytics.tsx` (40 dòng existing) — pattern dual-tracker reuse, có thể extend Consent Mode
- `frontend/app/layout.tsx` — root layout, mount point cho `<GoogleAnalytics />` (sau `<body>` opening)
- `frontend/app/(main)/races/[slug]/[bib]/page.tsx` (~1500 dòng) — athlete profile page, nhiều touch points (share, certificate download, compare, result image)
- `frontend/components/result-image/ResultImageCreator.tsx` — result image generator
- `frontend/components/FloatingActionBar.tsx` — floating share/scroll actions
- `frontend/components/ResultImageEditor.tsx` — image editor
- `frontend/locales/{vi,en}.json` — KHÔNG đụng, chỉ reference để tránh event label hardcode

### Endpoint liên quan

- ❌ KHÔNG có endpoint mới — F-041 thuần client-side analytics
- (Optional Phase 2) Backend `/api/analytics/server-event` để server-side track conversion (defer if needed)

### Schema/DB

- ❌ KHÔNG đụng MongoDB / MySQL platform
- ❌ KHÔNG đụng Redis
- ✅ External: GA4 property `G-PNVB69YRL2` (Google Analytics dashboard, KHÔNG trong codebase)

### Environment variables

- ➕ `NEXT_PUBLIC_GA_ID=G-PNVB69YRL2` — Frontend `.env.production` + docker-compose env section
- ❓ `NEXT_PUBLIC_GA_SOLUTION_ID=...` — separate property cho solution landing pages (PAUSE BA confirm nếu cần)

---

## ⚠️ Risk Flags

> Cross-reference với `known-issues.md`:
> - KHÔNG có TD existing đụng vùng `frontend/components/analytics`

- 🟢 **LOW infrastructure** — Client-side script load qua `<Script strategy="afterInteractive">` Next.js. Async, không block FCP/LCP. Existing GA component đã correct.
- 🟡 **MED privacy + PDPA compliance** — Vietnam PDPA (Personal Data Protection Decree 13/2023/NĐ-CP) đã hiệu lực từ 1/7/2026. Cookie consent banner CÓ THỂ cần implement nếu BTC chưa có cơ chế consent. **PAUSE BA decide** (xem PAUSE-41-01 dưới).
- 🟡 **MED PII leak risk** — Athlete name, email, phone là PII. Event params KHÔNG được push các field này. Phải filter/whitelist params. **PAUSE BA define schema** (PAUSE-41-02).
- 🟢 **LOW performance** — Google Analytics gtag.js bundle ~50KB gzipped, load async. Core Web Vitals impact <1 point LCP nếu mount đúng cách.
- 🟢 **LOW security** — `G-PNVB69YRL2` là measurement ID public (KHÔNG phải secret). Không leak gì.
- 🟢 **LOW backend** — KHÔNG đụng backend, KHÔNG breaking SDK contract.
- 🟡 **MED UX** — Nếu Coder không debounce events properly → noise data (vd: search input fire mỗi keystroke). PAUSE-41-04 quy định debounce strategy.

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

> Manager liệt kê 7 câu hỏi nghiệp vụ chưa rõ. BA phải trả lời TỪNG cái trong `01-ba-prd.md`.

- [ ] **PAUSE-41-01 (Cookie Consent Banner — Vietnam PDPA):**
   Vietnam Personal Data Protection Decree 13/2023/NĐ-CP đã hiệu lực 1/7/2026 yêu cầu **explicit consent** trước khi tracking cookies. F-041 cần implement consent banner ngay (Manager đề xuất Option A "implement minimal cookie consent + Consent Mode v2 default state denied") HAY defer Phase 2 (Option B — accept compliance risk)?
   **Manager đề xuất:** **Option A** — minimal cookie banner (Accept / Reject) với Consent Mode v2 default `analytics_storage: denied`. Trang sẽ track sau khi user Accept. Giảm risk pháp lý.

- [ ] **PAUSE-41-02 (PII filter cho event params):**
   Danh sách field **KHÔNG được** push GA event:
   - Athlete name (PII) — Manager đề xuất whitelist chỉ `bib` + `race_slug` + `course_id` (non-PII)
   - Email / phone (PII, never on public frontend anyway)
   - Custom dimensions cần define: `race_slug`, `course_id`, `lang` (vi/en), `device_type` (auto), `user_role` (anonymous/authenticated)
   **BA confirm danh sách dimensions + tự verify code KHÔNG push PII** trong helper `events.ts`.

- [ ] **PAUSE-41-03 (Event taxonomy final list):**
   Danh sách event tracking final — Manager đề xuất ~18 events (xem Impact Map table). BA review + bổ sung nếu thiếu. Đặc biệt:
   - Conversion goals: `download_certificate`, `share_athlete`, `generate_result_image` (Danny coi đây = conversion?)
   - Funnel critical: Homepage → Race detail → Ranking → Athlete profile → Share (full funnel completion = primary KPI?)
   - `select_sponsor` cần track outbound URL? (yes per default Enhanced Measurement)

- [ ] **PAUSE-41-04 (Debounce strategy):**
   Search input + filter ranking — fire event mỗi keystroke hay debounced?
   **Manager đề xuất:** Debounce 800ms cho `search_bib` / `search` / `filter_calendar`. Tránh noise data (1 search = 5-10 keystrokes = 5-10 events).

- [ ] **PAUSE-41-05 (SPA pageview tracking):**
   Next.js 16 App Router KHÔNG auto fire `page_view` trên client-side route change. Cần custom hook listen `usePathname()` + manual emit. Hoặc dùng GA4 Enhanced Measurement `pageview based on browser history events`?
   **Manager đề xuất:** Hybrid — Enhanced Measurement on (auto track history change) + custom hook để emit thêm `view_race` / `view_athlete` custom events với param `race_slug` / `bib` (Enhanced Measurement chỉ track URL, không track entity context).

- [ ] **PAUSE-41-06 (Solution-specific GA property?):**
   `frontend/components/analytics/google-analytics.tsx:17` có pattern dual-tracker via `NEXT_PUBLIC_GA_SOLUTION_ID`. Marketing có thể muốn separate property cho landing pages `/solution`, `/solution-5sport`, `/solution-5solution`. Danny có muốn separate property không hay 1 property duy nhất `G-PNVB69YRL2`?
   **Manager đề xuất:** Single property `G-PNVB69YRL2` cho v1.0. Marketing nâng cấp sau qua GA4 Audiences thay vì separate property.

- [ ] **PAUSE-41-07 (Vietnamese hay English event names + i18n labels?):**
   Convention GA4 best practice: **English event names + English param names** (vd: `view_race` NOT `xem_giai_dau`). Lý do: GA reports dashboard, query language, alert config đều English. Labels hiển thị trong dashboard BA có thể đặt VN sau qua GA4 Custom Dimensions UI.
   **Manager đề xuất:** Confirm English event names. UI tooltip/help cho marketing team có thể VN sau ở dashboard configuration layer (ngoài codebase).

---

## 🎯 Success criteria (gợi ý cho BA cụ thể hoá thành BR)

- GA4 Realtime report hiển thị active users + page_view streams within 60 phút sau deploy
- Cookie consent banner hiển thị first visit, persist choice 365 days (Vietnam PDPA Option A)
- 18+ custom events fire đúng tại touch points (manual QC verify via GA4 DebugView)
- ZERO PII pushed vào event params (athlete name / email / phone) — QC grep + scan code
- Funnel report: Homepage → Race → Ranking → Athlete → Share — completion rate baseline ≥ 5% week 1 (Danny review)
- Core Web Vitals KHÔNG degrade > 5% sau deploy (LCP / FID / CLS measured via Lighthouse)
- GTM/GA4 schema documented trong `change-history.md` để future feature reference

---

## 🤔 Improvement opportunities (Manager observation cho BA + Danny)

> Manager đã spot-check codebase trong impact map. Sau đây là **gợi ý cải tiến UX** đi kèm GA4 setup, dùng GA data để validate/prioritize:

### Funnel critical points (suspected UX friction)

| Touch point | Suspected friction | GA event để measure | Cải tiến tiềm năng |
|-------------|-------------------|---------------------|--------------------|
| Homepage → Race detail | Race card click rate | `select_promo_section` / `select_race` | Nếu CTR <5% → cải redesign race card (image bigger, CTA explicit) |
| Race detail → Ranking | Course tab discovery | `select_course_tab` | Nếu user chỉ stay course[0] → highlight other courses better |
| Ranking → Athlete profile | BIB click rate | `view_athlete` w/ `from=ranking` | Nếu drop-off cao → optimize ranking row click affordance |
| Athlete profile bottom | Share + Certificate engagement | `share_athlete`, `download_certificate` | Nếu thấp → reposition CTA, A/B test color/wording |
| Result image generator | Generate completion vs abandonment | `generate_result_image` w/ status param | Nếu generate-but-not-share rate cao → simplify share flow |
| Search BIB | Search-no-results rate | `search_bib` w/ `result_count` param | Nếu no-result >30% → fuzzy match / suggestion UX |
| Floating action bar | Action discoverability | `click_floating_action` | Nếu CTR <2% → reposition or rethink |
| Mobile vs desktop | Bounce rate divergence | Auto from `device_category` dimension | Nếu mobile bounce >>desktop → mobile UX dedicated audit |

### Specific UX improvement candidates đi kèm GA4 deploy

1. **Race card "View more" indicator** — nếu `select_race` CTR thấp, có thể card cần affordance rõ ràng hơn (chevron icon, hover state)
2. **Course tab pre-selection logic** — nếu `select_course_tab` luôn click course[0] đầu, suggest pre-select course mặc định = most-popular trong race (analytics-driven default)
3. **Athlete profile share button placement** — nếu `share_athlete` rate <10%, button có thể bị scroll off-screen → sticky share bar (consider mobile)
4. **Certificate download CTA visibility** — nếu `download_certificate` <5% finishers → button placement need review
5. **Search BIB error state** — nếu `search_bib` no-result rate cao → suggest "nearby BIBs" or "did you mean BIB 7055?"
6. **Result image generator preset usage** — track preset bg select event → identify popular preset → promote in default UI
7. **Outbound link tracking** — `select_sponsor` outbound to verify sponsor value → marketing report
8. **Multi-language usage split** — track `lang` dimension (vi/en) → decide if EN translation expand worth investment

→ **BA encode trong PRD:** events này thành conversion goals + custom dimensions. Coder implement event taxonomy. QC verify trong GA4 DebugView post-deploy. Manager+BA sau 1 tuần data → propose specific UX improvements F-042 trở đi.

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] **Yes** — Manager đã spot-check existing component + memory + 7 PAUSE conditions liệt kê đầy đủ. BA proceed với context complete.
- 📝 **Note for BA:** PRD MUST include structured tables MANDATORY:
  - **Event Taxonomy Table** — list 18+ events với columns: `event_name` / `trigger` / `params` / `purpose` / `conversion_goal_yes_no` / `debounce_ms`
  - **Custom Dimensions Table** — list per-event params (race_slug, course_id, bib, lang, etc.)
  - **Touch Point Wiring Table** — file path / component / event_name / line approx (cho Coder không lan man)
  - **Cookie Consent UI spec** (nếu PAUSE-41-01 chọn Option A) — banner layout, button labels VN, persistence strategy
  - **PII Whitelist/Blacklist** — define strict
  - **QC verification checklist** — GA4 DebugView verify per event, Core Web Vitals baseline

---

## 🔗 Next step

Danny chạy: `/5bib-prd FEATURE-041-analytics-ga4-result-frontend`

BA agent (5bib-po-ba) sẽ:
1. Đọc file này + memory codebase-map + known-issues (privacy vùng)
2. Output `01-ba-prd.md` với structured tables (Event Taxonomy + Touch Points + PII filter + Cookie Consent UI nếu chọn Option A)
3. Trả lời 7 PAUSE-41-* conditions với business logic precise
4. Estimate Coder workload: ~6-8 files frontend (root layout mount + lib/analytics/ NEW folder + ~5-6 touch points wire) + manual QC GA4 DebugView verify
