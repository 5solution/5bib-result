# Design Brief — 5BIB Programmatic SEO Pages

**Status:** 🎨 OPEN FOR DESIGN
**Created:** 2026-05-21
**Author:** 5bib-po-ba
**Target designer:** Claude Design (frontend-design skill) hoặc human designer
**Owner:** Danny

---

## 🎯 Why this brief

5BIB đã ship **F-046 + F-047 + F-051** programmatic SEO pages — đã có data đầy đủ, JSON-LD schema chuẩn, lead paragraph cho AI search. Foundation kỹ thuật xong.

**Khoảng trống còn lại:**
1. Một số trang đã ship nhưng **visual aesthetic không đồng nhất** với Velocity theme + athletic editorial direction (race recap còn generic, athlete profile vừa polish 21/05 nhưng cần review)
2. **F-052 Search & Discovery chưa có UI** — Google là path duy nhất user vào được athlete profile pages. Nội bộ 5bib.com KHÔNG có search/browse UI cho VĐV → **chặn moat SEO** (Google ranks pages có internal traffic cao hơn)
3. **Trang `/runners` index browse A-Z** chưa tồn tại — lost discovery for crawler + user

**Design brief này là HỢP ĐỒNG cho Designer:** vẽ visual mockups cho 8 page trong scope, theo design system Velocity + athletic editorial direction. KHÔNG yêu cầu code — chỉ Figma / image / HTML mockup output.

---

## 📦 Scope — 8 pages

### Đã ship (4 pages — design review + polish)

| # | Route | Feature | Status visual | Designer task |
|---|-------|---------|---------------|---------------|
| 1 | `/giai-chay/[raceSlug]/recap` | F-046 Race Recap | 🟡 Generic — needs upgrade | **Full redesign** athletic editorial |
| 2 | `/runners/[slug]` | F-047 Athlete Profile | 🟢 Vừa polished 21/05 | **Review + iterate** nếu mày thấy cần |
| 3 | `/giai-chay/thanh-pho/[citySlug]` | F-036 City Aggregator | 🟡 Stub | **Polish** dùng RaceCard hero treatment |
| 4 | `/giai-chay` | F-027 Race Calendar | 🟡 Functional | **Polish** filter UX + card grid |

### Chuẩn bị ship (4 pages — design from scratch)

| # | Route | Feature | Designer task |
|---|-------|---------|---------------|
| 5 | Header search bar + autocomplete dropdown | F-052 Quick Win | **Design** typeahead component + interactions |
| 6 | `/search?q=...` results page | F-052 Phase 1 | **Redesign** từ scratch — 3 sections (VĐV / Races / Recaps) |
| 7 | `/runners` browse index (A-Z, filter) | F-052 Phase 2 | **Design** browse + filter UX |
| 8 | Homepage "VĐV nổi bật" widget | F-052 Phase 2 | **Design** widget block cho homepage `/` |

---

## 🎨 Design System Reference (Velocity Theme — đang dùng)

### Brand identity — "Athletic Editorial"

**Tone:** Strava ⊕ The Athletic magazine ⊕ Vietnamese race day badge

**Voice:**
- Data-prominence (numbers oversized, mono tabular)
- Editorial typography (display font for headings, italic accents cho lead paragraphs)
- Sport badge aesthetic (medal treatments, classification color codes — Road/Trail/Ultra)
- Race-day energy (orange highlights, motion subtle but present)

### Tokens — already in `frontend/app/globals.css` (DO NOT INVENT NEW TOKENS)

```css
/* Colors */
--5bib-bg: #faf8f5        /* warm stone background */
--5bib-surface: #f3f0eb   /* card surfaces */
--5bib-accent: #0066FF    /* primary blue */
--5bib-text: #1c1917      /* high contrast text */
--5bib-text-muted: #78716c
--5bib-success: #166534   /* trail/positive */
--5bib-energy: #c2410c    /* orange — highlights */
--5bib-live: #dc2626      /* live race red */
--5bib-gold: #92400e      /* medal gold */
--5bib-trail: #166534

/* Typography */
--font-display: "Be Vietnam Pro", "Plus Jakarta Sans"  /* headings */
--font-body: "Plus Jakarta Sans", "Be Vietnam Pro"     /* body */
--font-mono: "JetBrains Mono", "SF Mono"               /* numbers, times */

/* Shadows */
--shadow-xs to --shadow-xl

/* Existing utility classes (use these, không tạo mới) */
.ap-avatar-ring     /* conic ambient ring spin */
.ap-time-shimmer    /* chip time shimmer sweep */
.ap-card-rise       /* card mount animation */
.ap-cert-frame      /* certificate frame border */
.fab                /* floating action bar */
```

### Athletic Editorial — Aesthetic principles

1. **Asymmetric hero layouts** — đừng center mọi thứ. Hero của athlete profile vừa làm = avatar left + name center + oversized number right (mặc dù chưa hoàn hảo). Apply same vibe to race recap.

2. **Oversized display numbers** — race count, podium rank, finisher count → font-display + tabular-nums + tracking tight (-0.04em) + text-7xl+

3. **Mono tabular for ALL times** — `font-mono tabular-nums` cho mọi chip time, gun time, pace, percentile. NEVER `font-sans` for numeric data.

4. **Color-coded vertical accent bars** — left edge của card. 1px bar tells category at a glance. (Strava-style precedent)

5. **Status pills with rings** — colored ring + bg pastel. KHÔNG plain colored text. Vẫn rõ DNF/DNS/DSQ tách biệt.

6. **Topographic SVG overlays** — subtle white opacity-7 SVG mountain/contour lines on dark gradients. Trail vibe. Reference: athlete profile hero pattern just added.

7. **Editorial italic for AI-friendly lead paragraphs** — display font, italic, left border accent bar, drop bullet decoration. (F-051 pattern)

8. **Underline-reveal hover** — race title links use `bg-gradient-to-r ... bg-[length:0%_1px] ... group-hover:bg-[length:100%_1px]`. Subtle, no JS, satisfying.

9. **Medal/ribbon treatments** for podium + best AG cards — gold gradient circle + inset shadow + warm wash background.

10. **Hover lift micro-interaction** — `-translate-y-0.5` + shadow upgrade. Universal across cards.

### Anti-patterns — REJECT khi Designer review

| Anti-pattern | Tại sao tránh |
|--------------|---------------|
| Generic shadcn/ui aesthetic (rounded-lg + bg-white + border-stone-200) — mọi card looks same | "AI slop" — lose brand identity |
| Solid color backgrounds without depth (flat blue hero) | Boring, no atmospheric depth — sport pages cần motion+texture |
| Centered everything (center align name + button + image vertical stack) | Magazine layouts thrive on asymmetry + diagonal flow |
| Generic Inter/Roboto fonts | We have Be Vietnam Pro display — USE IT cho headings |
| Bare-minimum spacing (gap-2 everywhere) | Athletic editorial needs GENEROUS negative space (gap-6+ for primary, gap-12 cho sections) |
| Sans-serif numbers on body text scale | Numbers ALWAYS mono tabular for scannability |
| Purple gradient (generic 2023 AI aesthetic) | Stay in 5BIB blue / orange / trail green palette |

---

## 📄 Per-Page Design Briefs

### Page 1: `/giai-chay/[raceSlug]/recap` — F-046 Race Recap (FULL REDESIGN)

**Purpose:** post-race editorial recap. SEO target = "[Race Name] kết quả 2026". AI search target = factual race summary.

**Existing data per recap (from backend):**
- Race meta: title, slug, date, location (province), distance courses, total finishers, total registered
- **Podium block:** Top 3 Nam + Top 3 Nữ overall (per course)
- **Pace stats block:** median pace, p10/p90 pace per course
- **NegSplit block:** % finishers who ran negative split (faster second half)
- **AG breakdown block:** age group buckets (e.g., Nam 30-39, Nữ 40-44) + Top 5 each
- **5BIB Insight block:** editorial markdown (70% auto data + 30% admin manual override) — story angle, weather note, notable moments

**Designer brief:**

#### Layout

- **Hero** (full-bleed, h-[60vh]):
  - Background = race banner image (existing field), darkened
  - Topographic SVG overlay
  - Editorial title block bottom-left: oversized race title (text-6xl display font) + date (mono) + location chip
  - Right side: stat ticker — "1,247 FINISHERS · 8 HOURS · 25KM" oversized mono numbers
  - Diagonal accent strip bottom (blue → orange gradient)

- **Sticky section nav** (below hero): pill navigation [Podium · Pace · Split · AG · Insight] — auto-scroll-spy active state

- **Podium block** (3-column for desktop):
  - Each podium = oversized rank number (text-8xl) + athlete name + chip time mono + country flag
  - Gold/silver/bronze treatment (medal gradient)
  - Stagger entrance animation on scroll-into-view
  - Per-course tab switcher (5K / 10K / HM / FM)

- **Pace stats block** (2-column data viz):
  - Bell curve SVG showing pace distribution
  - Median pace highlighted as anchor line
  - p10 (fast) + p90 (slow) markers
  - Below: 4 stat cards (median / your bracket / fastest split / slowest split)

- **NegSplit block** (full-width data story):
  - Big % number (e.g., "23%") of finishers who negative-split
  - Comparison chart vs typical race (40% benchmark)
  - Editorial caption: "Race này đa số chạy positive split — có thể do elevation profile..."

- **AG breakdown** (accordion or scroll-list):
  - Per bracket: header + Top 5 mini table (rank · name · time)
  - Color-coded per gender (Nam blue / Nữ orange)
  - Expand/collapse with smooth height transition

- **5BIB Insight** (editorial closer):
  - Magazine-style typography: drop cap first letter, italic display font, generous leading
  - Author byline "5BIB Editorial Team"
  - "Đọc thêm" CTA → link to race results full page

#### Interactions
- Hero parallax on scroll (subtle, max 10% offset)
- Podium cards stagger fade-in
- Sticky nav highlights active section
- Tab switcher cross-fade content

#### States
- Loading: skeleton blocks per section
- Empty (no recap insight yet): show data sections, hide Insight block + show admin CTA "Tạo insight"
- Error fetch: page-level error with retry

---

### Page 2: `/runners/[slug]` — F-047 Athlete Profile (REVIEW + ITERATE)

**Existing visual state (post-polish 2026-05-21):** Editorial magazine direction applied — topographic hero, oversized "12" race count, color-coded PR cards, mono tabular times, status pills, hover row accent, medal-style Best AG card, sculpted segmented badges, italic lead paragraph.

**Designer task:** review the polish vừa làm, iterate nếu chưa đủ "xịn". Possible upgrades:

- **Race history timeline visualization** — chart showing race count by year (sparkline)
- **Personal Records progression chart** — line chart PR improvement over time per distance
- **Geographic map** — Vietnam map highlighting tỉnh athlete đã chạy
- **Comparison badge** — "Top 12% trong AG" vs other athletes same bracket
- **Share-as-image** CTA — generate athlete profile card 1080×1080 cho Instagram (reuse F-013 canvas)
- **"Sắp tới" upcoming races** — section bottom showing races athlete đã đăng ký (data via 5Ticket integration future)

#### Out of scope (KEEP from polish 21/05)
- Hero topo SVG overlay + oversized 12
- 5-stats card row
- PR 4-card grid color-coded
- Race history table with hover accent + status pills
- 3 JSON-LD scripts (F-051 SEO foundation)
- Lead paragraph editorial italic
- Gun Time toggle

---

### Page 3: `/giai-chay/thanh-pho/[citySlug]` — F-036 City Aggregator (POLISH)

**Purpose:** SEO target "giải chạy [tỉnh]" — Hà Nội, HCMC, Đà Nẵng, etc. 10 cities supported.

**Existing data:** city display name + list races in that province.

**Designer brief:**
- **Hero**: city display name oversized + count races ("47 GIẢI CHẠY") + city flag/landmark SVG icon
- **Filter bar**: distance / month / status (upcoming/recent)
- **Race grid**: reuse RaceCard component (existing) — polish nếu cần
- **Pagination**: infinite scroll OR numbered (Coder choice)
- **"Cũng có thể quan tâm"** section bottom: link to other cities

---

### Page 4: `/giai-chay` — F-027 Race Calendar (POLISH)

**Existing:** functional calendar with filter. Polish for visual consistency với athletic editorial direction.

- **Hero**: bigger headline + month selector prominent
- **Filter chips** instead of dropdown (provinces + distance + month)
- **Race cards** standardized typography (display font for race name, mono for date)
- **Empty state** with icon + CTA "Đăng ký giải gần nhất"

---

### Page 5: **Header Search Bar + Autocomplete Dropdown** (F-052 NEW)

**Purpose:** entry point để user tìm VĐV / race / recap từ MỌI trang trên 5bib.com.

**Component spec:**

- **Position:** Header desktop right side (between nav + language switcher). Mobile: full-width below header bar.
- **Default state**: subtle outline input với placeholder "Tìm VĐV, race..." (16px font-mono optional?)
- **Focused state**: expand width (desktop), elevated shadow, ring accent blue
- **Typing state**: 400ms debounce → autocomplete dropdown appears below

**Autocomplete dropdown design:**

- Max-height 480px, scroll if more
- 3 sections (collapse if empty):

```
┌─────────────────────────────────────┐
│ 🏃 VĐV (3)                          │
│   #5114 NGHIÊM THỊ ANH THƯ          │
│   • Nữ · 12 giải · Trail 50K        │
│   ──                                │
│   #9897 NGUYỄN BÌNH MINH            │
│   • Nam · 23 giải · HM specialist   │
├─────────────────────────────────────┤
│ 🏁 Races (2)                        │
│   CAT TIEN JUNGLE PATHS 2026        │
│   • 17/5/2026 · Đồng Nai · 50KM     │
├─────────────────────────────────────┤
│ 📰 Recap (1)                        │
│   Ha Giang Discovery Marathon 2026  │
│   • Recap · 1,247 finishers         │
├─────────────────────────────────────┤
│ Xem tất cả "anh thu" →              │
└─────────────────────────────────────┘
```

- Each row: clickable (full row hover state)
- Keyboard nav: ↑↓ to highlight, Enter to navigate, Esc to close
- Click "Xem tất cả" → navigate `/search?q=...`

**Designer brief:**
- Athletic editorial: section labels uppercase tracking [0.18em] tiny font
- Mono cho BIB numbers (#5114)
- Display font cho athlete name
- VN labels chips (Nữ / Nam / Trail 50K specialist)
- Subtle row hover (left-edge accent bar?)
- Loading state: pulsing skeleton 3 rows
- Empty state: "Không tìm thấy kết quả nào cho 'xxx'" + suggest "Thử tìm theo BIB hoặc tên Tiếng Việt không dấu"

---

### Page 6: `/search?q=...` Results Page (F-052 REDESIGN)

**Purpose:** full search results — dedicated page khi user click "Xem tất cả" hoặc Enter trong header search.

**Layout:**

- **Hero strip** (compact): search input echoed top (editable, refines query) + result count summary
- **3-section layout** (similar to autocomplete but expanded):

#### Section A: VĐV results

- **Card grid** 2-col mobile / 4-col desktop
- Per card:
  - Avatar (initials fallback) — 64×64 circle
  - Name (display font, truncate 2 lines)
  - Stats chip row: BIB · gender · totalRaces · best discipline
  - Hover lift + link to `/runners/[slug]`

#### Section B: Race results

- **List style** (not card grid — denser):
  - Race title link (display font)
  - Date + location + distance options
  - "Xem ranking" + "Xem recap" CTAs right side
  - Link to `/giai-chay/[slug]` or `/giai-chay/[slug]/recap`

#### Section C: Recap results

- **Card grid 2-col**:
  - Race banner thumbnail
  - Title + date
  - "5BIB Insight preview..." 2 lines truncate
  - Link to recap page

#### States
- Loading: skeleton sections (3 sections each with placeholder rows)
- Empty: icon + "Không tìm thấy '{query}'" + suggested broader queries
- Partial empty (1 section empty): hide that section, "Không có {section name} khớp"
- Error: toast + retry

---

### Page 7: `/runners` Browse Index (F-052 NEW)

**Purpose:** discovery page — user browse athletes A-Z, filter by tỉnh / AG / distance specialist.

**Layout:**

- **Hero strip**: "Vận động viên 5BIB" oversized + total athlete count "2,470 VĐV"
- **Filter sidebar** (desktop) / **Filter drawer** (mobile):
  - Tỉnh dropdown (multi-select)
  - Gender (Nam / Nữ / Khác)
  - AG bracket (M30-39 / Nữ 40-44 / etc.)
  - Distance specialist (Trail 50K+, Marathon, etc.)
  - Provinces visited count slider
- **A-Z alphabet nav** (sticky top): jump to letter
- **Athlete card grid**:
  - 3-col desktop, 2-col mobile
  - Each card: avatar + name + stats chips + link
- **Pagination**: numbered 50 per page (10 pages max → 500 visible, sitemap covers rest)
- **Sort dropdown**: A-Z / Recent activity / Most races / Most provinces

---

### Page 8: Homepage "VĐV nổi bật" Widget (F-052 NEW)

**Purpose:** discovery surface — featured athletes block on `/` (homepage).

**Layout:**

- **Section block** trên homepage giữa "Giải sắp tới" và "Featured recaps":
  - **Heading:** "VĐV nổi bật" + uppercase subheading "Featured Athletes"
  - **Carousel** (horizontal scroll on mobile, 5-card row on desktop):
    - Per card: avatar 80×80 + name + stats chip "12 giải · Trail" + click → `/runners/[slug]`
  - **CTA**: "Xem tất cả VĐV →" link to `/runners` browse

**Backend data source:** top 10 athletes by total finished races trong 90 ngày qua. Cache 1h.

---

## 🌈 Cross-page consistency requirements

| Element | Spec |
|---------|------|
| All chip times | `font-mono tabular-nums` |
| All ranks/counts | tabular-nums + display font for hero numbers |
| Status pills (DNF/DNS/DSQ) | colored ring + pastel bg + uppercase tracking [10px] |
| Race classification badges | 🛣️ Road · 🌲 Trail · 🏔️ Ultra (consistent icons) |
| AG bracket pill | Gold gradient treatment (medal aesthetic) |
| Status dots | small colored circle với glow shadow (orange = live, red = closed, green = upcoming) |
| Underline-reveal links | `bg-gradient-to-r ... transition-[background-size]` |
| Card hover | `-translate-y-0.5` + shadow upgrade |
| Section headings | Display font + tracking -0.02em + subtitle uppercase tracking [0.22em] right-aligned |
| Empty states | Icon emoji 40-48px + heading + description + CTA button |
| Loading states | skeleton (NOT spinner) for cards/lists |

---

## 🎯 Mockup priorities

**Phase 1 (urgent — design first):**
1. **F-052 Header search + autocomplete** (HIGH — chặn moat SEO)
2. **F-052 /search results page** (HIGH — partner với #1)
3. **F-046 race recap full redesign** (HIGH — most-trafficked SEO page, current generic look)

**Phase 2 (medium):**
4. **F-047 athlete profile iterate** (MED — vừa polish, có thể bổ sung timeline chart + map)
5. **F-052 Homepage VĐV widget** (MED — discovery surface)

**Phase 3 (nice to have):**
6. **F-027 calendar polish** (LOW — functional already)
7. **F-036 city aggregator polish** (LOW)
8. **F-052 /runners browse index** (LOW — long-tail SEO, can defer)

---

## 📐 Mockup format expected

Designer output options (Designer chọn 1):
- **Figma file** (preferred) — with components + auto-layout + interactive prototype
- **Static images** — 1440px desktop + 375px mobile + 768px tablet per page
- **HTML/CSS mockup** — actual rendered page (no functional JS, dummy data inline)

**Per page deliver:**
1. Desktop layout (1440px)
2. Mobile layout (375px)
3. Tablet (768px) — only nếu layout cần adaptation đặc biệt
4. Key interaction states: hover / focus / loading / empty
5. Annotation cho color tokens + font tokens dùng

---

## 🚧 Out of scope cho Designer brief này

- ❌ Admin UI (F-049 identity clusters page) — separate brief if needed
- ❌ Authentication / login pages
- ❌ Email templates
- ❌ Mobile app native UI (5BIB web only)
- ❌ Email/notification UI
- ❌ Backend logic / business rules — chỉ Designer brief, không phải PRD code

---

## 🔗 Reference materials

- **Current implementation:**
  - F-047 athlete profile polished: `frontend/app/(main)/runners/[slug]/page.tsx` (commit `e44c847` branch `5bib_seo_v1`)
  - F-046 race recap: `frontend/app/(main)/giai-chay/[raceSlug]/recap/page.tsx`
  - Velocity theme tokens: `frontend/app/globals.css`
- **Aesthetic inspiration:**
  - Strava athlete profile (data prominence)
  - The Athletic magazine layouts (editorial typography)
  - Race recap pages: VnExpress Marathon, BUMP Vietnam, Topas Adventures
- **Brand precedent:**
  - 5BIB Velocity design system (existing)
  - 5Solution brand DNA (blue + magenta — see `design_5solution_system.md`)

---

## ✅ Status

**Status:** 🎨 OPEN FOR DESIGN — ready for Claude Design / human designer

**Next step:** Danny brief Claude Design hoặc human designer → designer outputs mockups → Danny review → handoff về `/5bib-init` để tạo feature F-052 (Coder implement based on approved mockups).
