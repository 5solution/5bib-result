# FEATURE-041: Plan Review

**Status:** ✅ APPROVED (với 2 clarifications mandatory cho Coder — xem section "Critical Adjustments")
**Reviewed:** 2026-05-17
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check (Manager)

- [x] Đã đọc `00-manager-init.md` (7 PAUSE-41-* + 8 UX opportunities + dual-tracker context)
- [x] Đã đọc `01-ba-prd.md` toàn bộ (21 BR-41-* + 24 events + 24 dimensions + 24-row Touch Point Wiring + 15 E2E TCs)
- [x] Đã đọc memory: `feature-log.md` (3 entries gần nhất F-040/F-038/F-037), `known-issues.md` (consent grep), `conventions.md` (Logger.warn audit pattern)
- [x] **Đã spot-check code thật (MANDATORY per skill update 2026-05-17):**
  - `frontend/components/analytics/google-analytics.tsx` (40 dòng) — ✅ signature confirm exact match PRD (dual-tracker `NEXT_PUBLIC_GA_ID` + `NEXT_PUBLIC_GA_SOLUTION_ID`, `<Script strategy="afterInteractive">`, returns null if both missing)
  - `frontend/app/layout.tsx` (82 dòng) — ✅ structure xác nhận: `<I18nProvider>` wrap `<QueryProvider>{children}</QueryProvider>` + `<Toaster />` sibling
  - `frontend/app/(main)/layout.tsx` (12 dòng) — ✅ existing wraps Header/main/Footer
  - `frontend/locales/{vi,en}.json` — ✅ exists, BA can add 4 keys
  - Route group `(main)/` structure — ✅ confirm tất cả 8 routes PRD list tồn tại (page.tsx/calendar/search/races/[slug]/[bib]/ranking/[courseId]/hub/[slug]/giai-chay)
  - Components inventory — ✅ `FloatingActionBar.tsx`, `ResultImageEditor.tsx`, `components/result-image/` đã có
  - **DISCOVERY: GA conflict** — `app/solution/layout.tsx`, `app/solution-5sport/layout.tsx`, `app/solution-5solution/layout.tsx`, `app/_solution-legacy/layout.tsx` ĐÃ có gtag/GTM riêng (G-ND6VCY2B57 + GTM-WNJV5PD9 + GTM-PLR9LHLZ + GTM-TGL3KFCS) → BR-41-01 mount root SẼ conflict (chi tiết Critical Adjustment #1)

---

## ✓ PRD Validation Checklist

### Completeness — ✅ PASS
- [x] User Stories đầy đủ với Personas (Marketing Lead, Product Owner, Anonymous Visitor, Race Athlete, Back-Office Admin) — 5/5 chuẩn format
- [x] Business Rules có ID (BR-41-01..21) — testable, có acceptance criteria
- [x] Tất cả 7 PAUSE-41-* Manager đã có answer BA trong section "Answers to Manager's PAUSE"
- [x] **24 events Event Taxonomy Table** đầy đủ columns (trigger / params / purpose / conversion goal / debounce)
- [x] **24 Custom Dimensions Table** scope + sample values + source
- [x] **24-row Touch Point Wiring Table** file path + handler + implementation hint
- [x] UI states đầy đủ Cookie Consent Banner (6 states: Hidden / Pending / Visible / Submitting / Hidden post-action / Error localStorage)
- [x] 2 numbered Step-by-Step User Journeys (accept consent + reject consent)
- [x] Buttons Specification Table cho CookieConsentBanner (3 buttons với Label/Position/State/Action)
- [x] 15 E2E test cases (Playwright)

### Technical correctness vs codebase — ✅ PASS với 2 clarifications
- [x] KHÔNG đụng MongoDB / MySQL platform / Redis / S3 / backend → ZERO breaking change SDK
- [x] Existing `GoogleAnalytics` component reusable (KHÔNG cần modify, chỉ mount)
- [x] Next.js 16 App Router `usePathname()` hook cho SPA pageview hybrid — chuẩn pattern
- [x] Consent Mode v2 default denied → granted approach đúng GA4 spec
- [x] localStorage key `5bib_consent_v1` versioned JSON — future-proof cho re-consent (BR-41-11)
- [x] TypeScript types reject PII at compile time — strict approach phù hợp `conventions.md` anti-pattern table
- [ ] ⚠️ **MOUNT POINT CONFLICT** — xem Critical Adjustment #1
- [ ] ⚠️ **CONSENT MODE v2 default chưa apply trên solution layouts** — xem Critical Adjustment #2

### Security & Privacy — ✅ PASS
- [x] PII whitelist/blacklist strict (BR-41-05) — TypeScript compile-time reject `athlete_name`/`email`/`phone`
- [x] Consent Mode v2 default `denied` (BR-41-03) trước user accept → Vietnam PDPA Decree 13/2023/NĐ-CP compliant
- [x] Opt-out mechanism qua localStorage clear (Phase 1 manual via /privacy-policy placeholder, Phase 2 revoke button)
- [x] `G-PNVB69YRL2` public measurement ID — KHÔNG phải secret, OK env public
- [x] GA4 auto IP anonymization (BR-41-15) — no custom config needed
- [x] XSS via event params — GA4 SDK sanitizes, KHÔNG inject DOM (E2E-09 verify PII filter)

### Performance — ✅ PASS
- [x] SLA cụ thể: LCP +5% max, FID +10ms max, CLS +0.1 max, bundle gzipped < 5KB, time-to-first-event < 3s
- [x] `<Script strategy="afterInteractive">` đã có sẵn, KHÔNG đổi sang `beforeInteractive`
- [x] 800ms debounce search/filter (BR-41-06) — tránh noise data
- [x] Cookie banner mount 1500ms post-load → avoid LCP impact

### Testability — ✅ PASS
- [x] 15 E2E test cases cụ thể (TC steps + expected dataLayer state)
- [x] GA4 DebugView manual verification checklist 24 events
- [x] PII filter E2E verify (E2E-09 grep production HTML/JS)
- [x] Lighthouse audit before/after for Core Web Vitals

---

## 📊 Cross-check với memory

### Architecture impact
- ✅ KHÔNG thêm service/integration mới ở backend layer
- ⚠️ FE topology change: thêm 1 dependency external (Google Analytics gtag.js CDN ~50KB gzip async) — đã có sẵn tại solution pages, F-041 chỉ wire vào `(main)/` route group
- ✅ KHÔNG break Order/Result/Race domain
- KHÔNG cần update `architecture.md` post-ship — Manager note: chỉ thêm FE analytics layer client-side, KHÔNG đụng backend nodes

### Convention impact
- ⚠️ Pattern mới: **"Type-safe analytics events const + TypeScript reject PII"** — KHÔNG có trong `conventions.md` hiện tại. Post-ship Manager sẽ append section "Analytics event taxonomy convention".
- ⚠️ Pattern mới: **"Consent Mode v2 + localStorage versioned schema"** — append vào conventions section "Privacy & consent management".
- ⚠️ Pattern mới: **"SPA pageview hybrid (Enhanced Measurement + custom context events)"** — Next.js 16 App Router specific, append conventions.
- ✅ Reuse existing convention: `<Script strategy="afterInteractive">` (next/script), `usePathname()` hook (Next.js standard)

### Known issues impact
- ✅ KHÔNG đụng vùng có TD-* hiện tại (analytics layer chưa từng exist)
- ✅ Defer 2026-05-12 CRIT list không liên quan (no upload, no auth, no JWT change)
- ⚠️ Phát sinh tech debt mới sau ship (xem section "Tech debt to track post-deploy" cuối file)

---

## 🚨 Critical Adjustments — Coder PHẢI follow (NOT optional)

### Adjustment #1 (MANDATORY): Mount point change — `(main)/layout.tsx` thay vì root `app/layout.tsx`

> ⚠️ **Lý do:** Spot-check phát hiện solution sub-layouts đã có gtag/GTM riêng:
> - `app/solution/layout.tsx:108` — `<Script src="...gtag/js?id=G-ND6VCY2B57">` + GTM-WNJV5PD9
> - `app/solution-5sport/layout.tsx:110` — GTM-PLR9LHLZ
> - `app/solution-5solution/layout.tsx:158` — G-ND6VCY2B57 + GTM-WNJV5PD9
> - `app/_solution-legacy/layout.tsx:126` — GTM-TGL3KFCS
> - `app/solution/page.tsx:32-33` — uses `(window as any).gtag` already
>
> **BR-41-01 trong PRD nói "mount in `frontend/app/layout.tsx` for TOÀN BỘ pages (main + solution + giai-chay + landing)" → SẼ CONFLICT:**
> 1. Solution pages sẽ có DOUBLE gtag init (root G-PNVB69YRL2 + solution G-ND6VCY2B57) → noise dataLayer, confusion DebugView
> 2. Solution layouts call `gtag('config', 'G-ND6VCY2B57', { send_page_view: true })` IMMEDIATELY KHÔNG check consent → **violate Vietnam PDPA BR-41-03 nếu user reject consent** (root sets denied nhưng solution config bypass)
> 3. F-041 scope explicit Danny: **"result.5bib.com"** = `(main)/` route group. Solution = marketing landing, separate concern.

**Coder PHẢI:**
- ✅ Mount `<GoogleAnalytics />` + `<CookieConsentBanner />` + `<PageViewTracker />` trong `frontend/app/(main)/layout.tsx`, KHÔNG mount root `app/layout.tsx`
- ✅ Consent Mode v2 default `denied` set trong `<GoogleAnalytics />` BEFORE `gtag('config', ...)` — Coder MAY extend existing component để inject consent default (file `google-analytics.tsx` cần update thêm consent init block) OR tạo separate `<ConsentInit />` mount BEFORE `<GoogleAnalytics />`
- ✅ Solution layouts KHÔNG đụng (out of scope F-041) — giữ nguyên tracking hiện tại với G-ND6VCY2B57
- ✅ Update BR-41-01 mental model: scope = `(main)/` routes only (8 routes PRD list), NOT root layout

**Phạm vi áp dụng F-041:** `/` + `/calendar` + `/search` + `/races/[slug]/*` + `/hub/[slug]` + `/giai-chay/*` + `/account` + `/sign-in` + `/timing` (tất cả routes dưới `(main)/`)

**Phạm vi KHÔNG áp dụng F-041:** `/solution*` + `/chip-verify` + `/callback` + `/_solution-legacy` (giữ existing tracking hoặc no tracking riêng)

### Adjustment #2 (MANDATORY): Extend `google-analytics.tsx` để inject Consent Mode v2 default

> Component existing 40 dòng KHÔNG có Consent Mode v2 init. Để satisfy BR-41-03 (consent default denied trước user accept), Coder MUST extend component.

**Coder PHẢI add vào `<Script id="ga-init">` block, BEFORE `gtag('config', ...)` lines:**

```typescript
gtag('consent', 'default', {
  'analytics_storage': 'denied',
  'ad_storage': 'denied',
  'ad_user_data': 'denied',
  'ad_personalization': 'denied',
  'wait_for_update': 500,  // 500ms grace cho banner trigger
});
gtag('js', new Date());
gtag('config', ...);
```

Khi user click "Đồng ý" trong banner → `consent-manager.ts` emit `gtag('consent', 'update', { analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' })`.

Khi user click "Từ chối" → stay denied (no emit needed, since default).

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ được thay đổi các file/folder dưới đây. Đụng ngoài = scope creep, dừng + hỏi Manager.

### Frontend (`frontend/`)

**MODIFY (5 files):**
- ✏️ `frontend/app/(main)/layout.tsx` — mount `<GoogleAnalytics />` + `<CookieConsentBanner />` + `<PageViewTracker />` (12 → ~25 dòng)
- ✏️ `frontend/components/analytics/google-analytics.tsx` — extend với Consent Mode v2 default block (40 → ~55 dòng) per Adjustment #2
- ✏️ `frontend/locales/vi.json` — add 4 keys `cookie.consent.*`
- ✏️ `frontend/locales/en.json` — add 4 keys `cookie.consent.*`
- ✏️ `frontend/.env.production` — add `NEXT_PUBLIC_GA_ID=G-PNVB69YRL2` (Coder check existing `.env*` files cấu trúc trước — nếu đã có entry khác cần coordinate)

**MODIFY (touch points wire — 8-10 files per Touch Point Wiring Table):**
- ✏️ `frontend/app/(main)/page.tsx` — wire `select_promo_section`, `select_race`
- ✏️ `frontend/app/(main)/calendar/page.tsx` — wire `view_race_calendar`, `filter_calendar`, `select_race`
- ✏️ `frontend/app/(main)/search/page.tsx` — wire `search` (debounced)
- ✏️ `frontend/app/(main)/races/[slug]/page.tsx` — wire `view_race`, `select_course_tab`, `share_race`
- ✏️ `frontend/app/(main)/races/[slug]/ranking/[courseId]/page.tsx` — wire `view_ranking`, `search_bib`, `sort_ranking`, `filter_ranking`
- ✏️ `frontend/app/(main)/races/[slug]/[bib]/page.tsx` — wire `view_athlete`, `share_athlete`, `download_certificate`, `compare_open`
- ✏️ `frontend/app/(main)/hub/[slug]/page.tsx` — wire `view_hub`
- ✏️ `frontend/app/(main)/giai-chay/page.tsx` — wire `view_race_directory`
- ✏️ `frontend/components/SponsorSidebar.tsx` (or equivalent — Coder grep tìm sponsor click handler) — wire `select_sponsor`
- ✏️ `frontend/components/FloatingActionBar.tsx` — wire `click_floating_action`
- ✏️ `frontend/components/result-image/ResultImageCreator.tsx` — wire `generate_result_image`
- ✏️ `frontend/components/ResultImageEditor.tsx` — wire `share_result_image`

**ADD (5 NEW files):**
- ➕ `frontend/lib/analytics/events.ts` — Event taxonomy const + TypeScript strict types reject PII
- ➕ `frontend/lib/analytics/useGAEvent.ts` — Type-safe event emitter hook
- ➕ `frontend/lib/analytics/page-view-tracker.tsx` — `<PageViewTracker />` Client Component listen `usePathname()`
- ➕ `frontend/lib/analytics/consent-manager.ts` — localStorage helpers + gtag consent update wrapper
- ➕ `frontend/components/CookieConsentBanner.tsx` — Bottom-fixed banner Client Component

**ADD optional (1 NEW file nếu Coder muốn extract):**
- ➕ `frontend/components/analytics/__tests__/` — unit test setup nếu Coder dùng vitest/jest

**Docker-compose / env (1 file):**
- ✏️ `docker-compose.yml` — frontend service add `NEXT_PUBLIC_GA_ID=G-PNVB69YRL2` build-time env (verify với Coder current docker-compose pattern — Next.js public env phải build-time NOT runtime)

**ABSOLUTELY OUT OF SCOPE — KHÔNG được đụng:**
- ❌ `frontend/app/layout.tsx` (root) — KEEP existing, KHÔNG mount F-041 here per Adjustment #1
- ❌ `frontend/app/solution*/layout.tsx` (all 4 solution variants) — KEEP existing tracking
- ❌ `frontend/app/chip-verify/`, `frontend/app/callback/` — không trong scope result.5bib.com user journey
- ❌ Any backend file (`backend/**`) — F-041 thuần FE
- ❌ Any admin file (`admin/**`) — F-041 chỉ result.5bib.com public

**Estimated total files: 13-15 files (5 NEW + 8-10 modify) + 2 config (env + docker-compose)**

---

## 🔧 Tech approach (đề xuất, Coder có thể tinh chỉnh nếu vẫn đạt BR-41-*)

### Pattern 1: Type-safe events const
```typescript
// frontend/lib/analytics/events.ts
type NonPIIParam = 'race_slug' | 'course_id' | 'bib' | 'lang' | 'user_role' | 'from_route' /* ... 24 dims */;
type PIIParam = 'athlete_name' | 'email' | 'phone'; // BLOCKED at compile time

type EventParams<T extends Record<string, unknown>> = {
  [K in keyof T]: K extends PIIParam ? never : T[K];
};

export const EVENTS = {
  view_race: 'view_race',
  view_athlete: 'view_athlete',
  // ... 24 events
} as const;
```

### Pattern 2: `useGAEvent` hook with consent gate
```typescript
// frontend/lib/analytics/useGAEvent.ts
export function useGAEvent() {
  return useCallback(<E extends EventName>(event: E, params: EventParams<E>) => {
    if (typeof window === 'undefined') return;
    if (!hasConsent()) return; // consent-manager check
    window.gtag?.('event', event, params);
  }, []);
}
```

### Pattern 3: SPA pageview hybrid via `<PageViewTracker />`
```typescript
'use client';
// frontend/lib/analytics/page-view-tracker.tsx
export default function PageViewTracker() {
  const pathname = usePathname();
  const params = useParams();
  useEffect(() => {
    // Enhanced Measurement auto fires page_view. THIS emits CONTEXT event:
    if (pathname.startsWith('/races/') && params.slug && params.bib) {
      gaEvent('view_athlete', { race_slug: params.slug, bib: params.bib, from_route: 'direct' });
    }
    // ... handle other route patterns
  }, [pathname]);
  return null;
}
```

### Pattern 4: Cookie consent localStorage versioned schema
```typescript
const CONSENT_KEY = '5bib_consent_v1';
const TTL_DAYS = 365;
const VERSION = 1;
type ConsentRecord = { accepted: boolean; timestamp: string; version: number };

export function loadConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    const ageMs = Date.now() - new Date(parsed.timestamp).getTime();
    if (parsed.version !== VERSION) return null; // version bump → re-prompt
    if (ageMs > TTL_DAYS * 86400000) return null; // expired
    return parsed;
  } catch { return null; }
}
```

### Pattern 5: Debounce search events (use existing `use-debounce` or inline)
```typescript
const debouncedSearch = useDebouncedCallback((term: string, count: number) => {
  gaEvent('search', { search_term: term, result_count: count });
}, 800);
```

---

## 🛑 PAUSE points cho Coder

Trước khi làm các bước sau, Coder DỪNG và confirm với Danny:

- 🛑 **Trước khi `pnpm install`** thêm dep mới (vd: `use-debounce` nếu chưa có). Check `frontend/package.json` first — có thể dùng inline `setTimeout` thay thế.
- 🛑 **Nếu phát hiện cần đụng file ngoài Scope Lock** (vd: muốn refactor solution layouts để dùng chung consent state) → DỪNG, hỏi Manager update plan, KHÔNG silent expand scope.
- 🛑 **Nếu phát hiện `docker-compose.yml` env mechanic khác PRD assumption** (vd: build args vs runtime env) → DỪNG, confirm với Danny pattern hiện tại. Next.js `NEXT_PUBLIC_*` phải build-time available.
- 🛑 **Nếu `process.env.NEXT_PUBLIC_GA_ID` empty trên DEV** → component returns null (BR-41-02), test E2E set env explicit.

---

## 🧪 Unit/Integration test BẮT BUỘC (Coder phải viết, QC sẽ check)

Coder không được mark feature `READY_FOR_QC` nếu thiếu:

### Unit tests (Vitest/Jest tùy stack frontend đang dùng — Coder verify):

- [ ] `consent-manager.test.ts` — `loadConsent()` returns null khi missing/expired/version-mismatch
- [ ] `consent-manager.test.ts` — `saveConsent(true)` writes JSON with timestamp + version 1
- [ ] `consent-manager.test.ts` — `saveConsent` graceful handles localStorage quota exceeded (try/catch)
- [ ] `events.test.ts` — TypeScript compile fails khi event params include PII field (`athlete_name`, `email`, `phone`) — verify với `@ts-expect-error` test
- [ ] `useGAEvent.test.ts` — KHÔNG emit khi consent denied
- [ ] `useGAEvent.test.ts` — emit gtag('event', ...) khi consent granted
- [ ] `CookieConsentBanner.test.tsx` — render null khi localStorage has accepted record (within TTL + version match)
- [ ] `CookieConsentBanner.test.tsx` — render banner khi first visit (no localStorage)
- [ ] `CookieConsentBanner.test.tsx` — click "Đồng ý" → gtag consent update granted + persist localStorage + setState hidden

### E2E tests (Playwright — BA đã list 15 cases trong PRD):

QC ownership, Coder không cần viết E2E. Nhưng Coder MUST verify dataLayer behavior locally trước hand-off (manual Chrome DevTools Network + Console).

### Manual GA4 DebugView (post-deploy QC):

QC mở GA4 Admin > DebugView, visit result.5bib.com với consent accepted, tick từng 24 events theo Event Taxonomy Table verify fire đúng params.

---

## 📊 Verdict

> ### ✅ APPROVED — Coder có thể bắt đầu với 2 Critical Adjustments mandatory

**Lý do APPROVE:**
- PRD structured tables đầy đủ (24 events / 24 dimensions / 24-row wiring + 15 E2E TCs + 21 BR-41-*)
- ZERO backend impact → low risk
- Vietnam PDPA compliance đã encode (consent banner + Consent Mode v2 default denied)
- PII filter compile-time TypeScript reject — strict approach
- Performance SLA cụ thể (LCP +5% max, bundle <5KB)

**Lý do KHÔNG là NEEDS_REVISION:**
- 2 critical issues (mount point + consent init) là **clarifications** Manager có authority quyết định post-spot-check, KHÔNG phải PRD gap fundamental
- BA's intent rõ ràng = "result.5bib.com user journey" → adjustment scope match intent
- Re-loop BA gate sẽ delay 1 cycle, marginal value vì PRD essence intact

**Coder PHẢI follow:**
- Critical Adjustment #1: mount in `(main)/layout.tsx` NOT root `app/layout.tsx`
- Critical Adjustment #2: extend `google-analytics.tsx` Consent Mode v2 default denied block
- Scope Lock 13-15 files list trên
- 4 PAUSE points trước thực hiện

---

## 🧷 Tech debt to track post-deploy (Manager note)

> Sau deploy, append vào `known-issues.md`:

- **TD-F041-MULTI-GA-PROPERTIES** — Solution pages có separate G-ND6VCY2B57 tracker chưa migrate sang single property. Phase 2 nếu Marketing thống nhất → migrate hoặc add separate property cho 5BIB result tracking.
- **TD-F041-SOLUTION-CONSENT-BYPASS** — Solution layouts (4 files) call `gtag('config', ...)` immediately KHÔNG check consent. Vietnam PDPA risk LOW (solution pages = marketing landing, less personal interaction) nhưng Phase 2 nên unify consent across all routes.
- **TD-F041-REVOKE-CONSENT-UI** — Phase 1 opt-out qua manual localStorage clear. Phase 2 implement revoke button trong `/privacy-policy` page.
- **TD-F041-PRIVACY-POLICY-PLACEHOLDER** — `/privacy-policy` route currently không tồn tại (banner "Tìm hiểu thêm" link). Phase 2 implement actual policy page.
- **TD-F041-SDK-DUAL-TRACKER** — `NEXT_PUBLIC_GA_SOLUTION_ID` env support trong existing component không dùng cho v1.0. Giữ code, defer activation.
- **TD-F041-CONSENT-COMPONENT-EXTRACT** — Nếu future feature cần consent gate (vd: heatmap tracking, ad pixels), extract `<ConsentInit />` separate component để reuse.

---

## 🆕 Patterns sẽ mint vào `conventions.md` post-deploy

1. **Analytics event taxonomy convention**: single source of truth trong `lib/analytics/events.ts` const + TypeScript strict types reject PII at compile time
2. **Consent Mode v2 + localStorage versioned schema**: pattern `{accepted, timestamp, version}` JSON với TTL check + version bump trigger re-prompt
3. **SPA pageview hybrid Next.js App Router**: Enhanced Measurement ON + custom `<PageViewTracker />` hook listen `usePathname()` emit CONTEXT events (`view_race`, `view_athlete`) ngoài auto `page_view`
4. **Mount scope per route group**: Khi FE feature chỉ apply cho subset routes (vd: result.5bib.com `(main)/` only) → mount trong route-group layout NOT root layout

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] **Yes** — Coder có thể bắt đầu với Scope Lock + Critical Adjustments #1, #2 + 4 PAUSE points
- 📝 **Note cho Coder:** Self-Review Pipeline 10 bước (Manager 2026-05-14 directive) MANDATORY trước khi mark `READY_FOR_QC`. Đặc biệt:
  - Bước 6 UI/UX self-inspection — verify cookie banner KHÔNG cause layout shift CLS > 0.1
  - Bước 7 Real-world data — test với VN long race names `cat-tien-jungle-paths-2026` + BIB Vietnamese diacritic names verify KHÔNG leak vào dataLayer
  - Bước 8 Files Changed vs Scope Lock — 0 scope creep, đặc biệt solution layouts KHÔNG được đụng

---

## 🔗 Next step

Danny chạy: `/5bib-code FEATURE-041-analytics-ga4-result-frontend`

Coder (5bib-fullstack-engineer) sẽ:
1. Đọc 00 + 01 + 02 (file này) + memory conventions + codebase-map
2. Implement 13-15 files theo Scope Lock + 2 Critical Adjustments
3. Write 9+ unit tests (consent-manager + events PII reject + useGAEvent + CookieConsentBanner)
4. Self-Review Pipeline 10 bước + paste checklist vào `03-coder-implementation.md`
5. Output `03-coder-implementation.md` status `🟠 READY_FOR_QC`

**Estimated Coder workload:** ~4-6 hours (5 NEW lib files + 1 NEW banner component + 10 touch point wires + unit tests + i18n keys + env config + browser smoke test).

**Manager checkpoint sau Coder hand-off:** verify Scope Lock compliance + 2 Critical Adjustments implemented đúng + Consent Mode v2 default denied block hiển thị trong `google-analytics.tsx` modified version.
