# FEATURE-071: PRD — Merchant Portal +3 ngôn ngữ ĐNA (Khmer / Lào / Mã Lai)

**Status:** 🔵 READY
**Last updated:** 2026-06-08
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` (impact map + 2 quyết định đã chốt)
- [x] Đã đọc code thật: `merchant/src/lib/mp/i18n.ts` (130 key), `lang-context.tsx`, `fmt.ts`, `components/mp/ui.tsx` (Topbar switcher), `app/settings/page.tsx`
- [x] Đã đọc memory codebase-map (merchant i18n UI-chrome-only) + known-issues (không có quirk liên quan)
- [x] Đã trả lời PAUSE của Manager (cuối file)

---

## 🎯 Title + Goal + Scope

**Title:** Bổ sung Khmer / Lào / Mã Lai cho merchant.5bib.com + refactor i18n core để scale ≥N ngôn ngữ.

**Goal:** BTC/đối tác ĐNA dùng Merchant Portal bằng ngôn ngữ bản địa; đồng thời trả nợ kiến trúc i18n (xây cứng cho đúng 2 ngôn ngữ).

**Scope:**
- ✅ **In scope:**
  - Refactor i18n core: `Lang` thêm `km`/`lo`/`ms`; `Entry` đổi `{vi,en}` → `Partial<Record<Lang,string>>` với **fallback bắt buộc về `vi`**.
  - Switcher Topbar: pill toggle nhị phân → **dropdown cờ + tên ngôn ngữ** (5 mục).
  - Settings: `Segmented` 5 mục.
  - `fmt.ts`: locale map km-KH/lo-LA/ms-MY (số/ngày). Tiền **GIỮ VND + " đ"**.
  - localStorage persist 5 giá trị.
  - **Dịch toàn bộ ~130 chuỗi UI chrome** (DICT + label maps `L`) sang km/lo/ms — bảng dịch đầy đủ ở Appendix A (Coder paste verbatim).
  - Font: đảm bảo glyph Khmer (ភាសាខ្មែរ) + Lào (ລາວ) render đúng (Noto Sans Khmer/Lao).
- ❌ **Out of scope:**
  - KHÔNG dịch data backend (tên giải/BTC/người mua/cự ly/loại vé) — luôn giữ nguyên từ MySQL.
  - KHÔNG đụng backend / SDK / DB / Redis / migration.
  - KHÔNG đổi currency sang KHR/LAK/MYR (giải là VND).
  - KHÔNG thêm ngôn ngữ vào admin (`admin/`) hay public frontend (`frontend/`) — chỉ `merchant/`.
  - KHÔNG dịch brand/acronym: 5BIB, GMV, BIB, SSO, Excel, MKT, auth.5bib.com.

---

## 👤 User Stories & Business Rules

### User Stories
- As a **Race Organizer (BTC Campuchia)**, I want to xem Merchant Portal bằng tiếng Khmer so that tôi đọc báo cáo vé/doanh thu mà không cần biết tiếng Việt/Anh.
- As a **Race Organizer (BTC Lào)**, I want chọn tiếng Lào và lựa chọn được ghi nhớ qua các lần đăng nhập so that không phải đổi lại mỗi lần.
- As a **Race Organizer (BTC Malaysia)**, I want xem bằng Bahasa Melayu so that nhân sự địa phương dùng được.
- As a **5BIB Back-Office Admin**, I want chuỗi chưa kịp dịch tự fallback về tiếng Việt so that UI không bao giờ vỡ hay hiện raw key.

### Business Rules
- **BR-01:** `Lang` = union `'vi' | 'en' | 'km' | 'lo' | 'ms'`. Mặc định (default + SSR + first client render) = `'vi'`.
- **BR-02:** `Entry` = `{ vi: string } & Partial<Record<Exclude<Lang,'vi'>, string>>` — **`vi` BẮT BUỘC** (fallback gốc), km/lo/ms/en optional.
- **BR-03 (Fallback chain):** `t(key, lang)` trả `DICT[key]?.[lang]` → nếu rỗng/undefined → `DICT[key].vi` → nếu thiếu cả key → trả chính `key` (dev nhận biết). `lab(map,key,lang)` cùng quy tắc. **KHÔNG bao giờ render chuỗi rỗng.**
- **BR-04:** localStorage key `mp_lang` chỉ nhận giá trị ∈ `LANGS` (5 mã). Giá trị lạ/cũ → bỏ qua, dùng `'vi'`.
- **BR-05 (No hydration mismatch):** Server + first client paint LUÔN render `'vi'`; chỉ sau `useEffect` mới đọc localStorage và re-render sang ngôn ngữ đã lưu. (Giữ nguyên cơ chế F-069 hiện có.)
- **BR-06 (Data không dịch):** Mọi giá trị đến từ backend (tên giải, BTC, người mua, cự ly, loại vé, mã đơn) render nguyên văn — KHÔNG qua `t()`. Chỉ UI chrome + label maps enum (`L`) được dịch.
- **BR-07 (Currency invariant):** `fmt.vnd()` luôn hậu tố `" đ"` + grouping theo locale hiển thị; KHÔNG đổi ký hiệu/đơn vị tiền theo ngôn ngữ.
- **BR-08 (Locale formatting):** `fmt.num`/`fmt.vnd` dùng `Intl.NumberFormat` với map: vi→`vi-VN`, en→`en-US`, km→`km-KH`, lo→`lo-LA`, ms→`ms-MY`. `fmt.date`/`dateTime` giữ format `dd/mm/yyyy` (số) cho mọi ngôn ngữ (đơn giản, nhất quán).
- **BR-09 (Switcher mọi nơi):** Dropdown ngôn ngữ hiển thị trên Topbar mọi trang đã đăng nhập (dashboard, race detail, settings). Trang **login** (chưa có shell) giữ cơ chế hiện tại (nếu login có toggle → cũng nâng dropdown; nếu không có → bỏ qua, mặc định vi).
- **BR-10 (Translation review gate):** Bản dịch km/lo do Claude tạo, **CHƯA được coi là "đã duyệt"** cho đến khi Danny/native review. Coder + QC KHÔNG tự ý sửa nghĩa; nếu phát hiện sai → flag, không tự dịch lại.
- **BR-11 (Brand/acronym giữ nguyên):** Không dịch: `5BIB`, `GMV`, `BIB`, `SSO`, `Excel`, `MKT`, `auth.5bib.com`, `% GMV`. Trong các chuỗi chứa các token này (vd `kpi_fee` "Phí 5BIB"), giữ token nguyên, chỉ dịch phần còn lại.
- **BR-12 (Coverage 100%):** MỌI key trong `DICT` + `L` phải có đủ 5 ngôn ngữ sau feature (km/lo/ms không được để trống — đó là lý do feature này tồn tại). Trường hợp duy nhất để trống = chuỗi chỉ là acronym thuần (vd `th_pct_gmv` "% GMV" giống nhau mọi ngôn ngữ → vẫn điền cho nhất quán).

---

## 🖥️ UI/UX Flow

### Route structure
- KHÔNG thêm route. Mọi route hiện có (`/dashboard`, `/races/[raceId]`, `/settings`, `/sign-in`) giữ nguyên. Chỉ đổi component switcher + nguồn label.

### Screen 1: Topbar (mọi trang đã đăng nhập) — component `merchant/src/components/mp/ui.tsx` `Topbar`

**Visible data:**
- Nút ngôn ngữ hiện tại: cờ + mã viết tắt (vd `🇻🇳 VI`), thay cho pill `VI/EN` cũ.
- Khi mở: menu 5 dòng — cờ + native name + check ✓ ở dòng đang chọn.

**Layout:**
- **Header (Topbar):** breadcrumb (trái) · [center optional] · nút Refresh (nếu có) · **nút Ngôn ngữ (dropdown)** · avatar/logout. Vị trí nút ngôn ngữ: ngay trước cụm user, đúng chỗ pill cũ.
- **Dropdown menu (popover):** width ≥ 200px, anchor phải, 5 dòng, mỗi dòng cao ~40px, hover highlight, dòng active có nền nhạt + ✓.

**States:**
- **Default:** nút hiện cờ+mã ngôn ngữ active.
- **Open:** menu xổ xuống, click ngoài → đóng; phím Esc → đóng.
- **Select:** click 1 dòng → `setLang(code)` → toàn UI re-render ngay (no reload) → menu đóng → localStorage lưu.
- **Active highlight:** dòng đang chọn có ✓ + nền `--mp-accent` nhạt.

#### UI Step-by-Step (Journey 1 — đổi ngôn ngữ ở Topbar)
| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Click nút ngôn ngữ (vd `🇻🇳 VI`) trên Topbar | Popover menu 5 dòng xổ xuống, dòng VI có ✓ | onClick toggle open | menu open |
| 2 | Di chuột dòng `🇰🇭 ភាសាខ្មែរ` | Dòng highlight nền nhạt | hover | — |
| 3 | Click `🇰🇭 ភាសាខ្មែរ` | TOÀN bộ UI chrome đổi sang Khmer tức thì (nav, KPI, bảng header, nút); data giải giữ nguyên; menu đóng; nút Topbar đổi `🇰🇭 KM` | `setLang('km')` → context update → re-render | lang=km, menu closed, localStorage `mp_lang=km` |
| 4 | Reload trang (F5) | Server render VI (BR-05) → sau hydrate đọc `mp_lang=km` → re-render Khmer (1 frame VI thoáng qua, chấp nhận được) | useEffect đọc localStorage | lang=km persisted |
| 5 | Click nút ngôn ngữ → chọn `🇲🇾 Bahasa Melayu` | UI đổi Mã Lai tức thì | `setLang('ms')` | lang=ms |

### Screen 2: Settings — `merchant/src/app/settings/page.tsx`

**Visible data:** block "Ngôn ngữ" (label `t('language')`) với `Segmented` 5 nút.

**Layout:**
- **Header:** breadcrumb "Cài đặt".
- **Body:** card "Ngôn ngữ" → `Segmented<Lang>` 5 nút (VI / EN / ខ្មែរ / ລາວ / Melayu — hiển thị mã/native ngắn để vừa). Card "Tài khoản" (tên/email/quyền/giải được xem) giữ nguyên.

#### UI Step-by-Step (Journey 2 — đổi ngôn ngữ ở Settings)
| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Vào `/settings` | Card Ngôn ngữ hiện 5 nút Segmented, nút active highlighted | render | — |
| 2 | Click nút `ລາວ` | Segmented active đổi sang Lào; toàn UI đổi Lào tức thì; Topbar nút cũng đổi `🇱🇦 LO` | `setLang('lo')` | lang=lo, localStorage lo |

### Buttons Specification
| Button | Position | Default state | Disabled | Loading | Action | Confirm? |
|--------|----------|---------------|----------|---------|--------|----------|
| Nút ngôn ngữ (dropdown trigger) | Topbar phải, trước user | Hiện `<cờ> <MÃ>` của lang active | KHÔNG | N/A | Toggle popover | NO |
| Dòng ngôn ngữ trong menu (×5) | Trong popover | Dòng active có ✓ + nền nhạt | Dòng active **không disable** (cho phép click lại, no-op) | N/A | `setLang(code)` + đóng menu | NO |
| Segmented item (×5) ở Settings | Card Ngôn ngữ | Item active highlighted | KHÔNG | N/A | `setLang(code)` | NO |

> ⚠️ KHÔNG có nút "Lưu" cho ngôn ngữ — đổi là áp dụng + persist ngay (giống hành vi toggle hiện tại). Nút "Lưu cài đặt" (nếu có) chỉ cho phần account, không liên quan ngôn ngữ.

### Form Fields Specification
**N/A** — feature không có form input. Lựa chọn ngôn ngữ là chọn 1-trong-5 (enum cố định), không có text field/validation người dùng nhập.

### Field source table (dữ liệu hiển thị)
| Field UI | Data source | Format | Empty state |
|----------|-------------|--------|-------------|
| Nhãn UI chrome (nav/KPI/bảng/nút) | `DICT[key][lang]` (frontend i18n) | text theo ngôn ngữ, fallback vi | fallback vi → nếu thiếu hẳn → raw key (dev only) |
| Nhãn enum (trạng thái đơn/race/loại phí) | `L[map][value][lang]` (frontend) | text theo ngôn ngữ, fallback vi | fallback vi |
| Tên giải / BTC / người mua / cự ly / loại vé | backend MySQL (response) | nguyên văn, KHÔNG dịch | "—" (đã có sẵn) |
| Số / vé / GMV | `fmt.num`/`fmt.vnd` Intl locale | grouping theo locale, tiền " đ" | "0" / "0 đ" |
| Ngày | `fmt.date` | `dd/mm/yyyy` mọi ngôn ngữ | "—" |

### UI States (đối chiếu mandatory)
- **Loading:** giữ skeleton/spinner hiện có; label "Đang tải…" `t('loading')` đổi theo ngôn ngữ.
- **Empty:** "Chưa có giải nào" `t('no_races_title')` + body đổi theo ngôn ngữ.
- **Data:** mọi nhãn chrome đổi ngôn ngữ; data giữ nguyên.
- **Error fetch:** "Không tải được dữ liệu" `t('load_failed')` + nút "Thử lại" `t('retry')` đổi ngôn ngữ.
- **Switcher open/close/select:** như Journey 1.
- **Fallback state (key thiếu km/lo/ms):** hiển thị tiếng Việt — KHÔNG raw key, KHÔNG rỗng (BR-03).
- **Glyph-missing state:** nếu font không có glyph Khmer/Lào → hiện tofu □ → đây là BUG, phải fix font (BR risk). QC verify bằng browser thật.

---

## 🛠️ Technical Mandates

### 3.1 DB / Cache / SDK
- **KHÔNG đụng gì.** Không MongoDB, không MySQL, không Redis, không S3, không SDK regen, không migration. Thuần frontend `merchant/`.

### 3.2 Backend Endpoint
- **N/A** — không có endpoint mới/sửa.

### 3.3 Type & core i18n (file `merchant/src/lib/mp/i18n.ts`)

> KHÔNG phải DTO backend — đây là type frontend. Coder áp dụng shape sau, đổ bản dịch Appendix A:

```typescript
export type Lang = "vi" | "en" | "km" | "lo" | "ms";

/** vi bắt buộc (fallback gốc); các ngôn ngữ khác optional. */
export type Entry = { vi: string } & Partial<Record<Exclude<Lang, "vi">, string>>;
type Dict = Record<string, Entry>;

/** Registry cho switcher: thứ tự hiển thị + nhãn native + cờ. */
export const LANGS: ReadonlyArray<{ code: Lang; native: string; short: string; flag: string }> = [
  { code: "vi", native: "Tiếng Việt",    short: "VI", flag: "🇻🇳" },
  { code: "en", native: "English",       short: "EN", flag: "🇬🇧" },
  { code: "km", native: "ភាសាខ្មែរ",      short: "KM", flag: "🇰🇭" },
  { code: "lo", native: "ລາວ",           short: "LO", flag: "🇱🇦" },
  { code: "ms", native: "Bahasa Melayu", short: "MS", flag: "🇲🇾" },
];

export function t(key: string, lang: Lang = "vi"): string {
  const e = DICT[key];
  if (!e) return key;             // BR-03: thiếu key → raw key
  return e[lang] || e.vi;         // BR-03: thiếu ngôn ngữ → fallback vi
}

export function lab(map: Dict, key: string, lang: Lang = "vi"): string {
  const e = map[key];
  if (!e) return key;
  return e[lang] || e.vi;
}
```

### 3.4 lang-context (file `merchant/src/lib/mp/lang-context.tsx`)
- `setLang(l: Lang)` — validate `l` ∈ `LANGS.map(x=>x.code)` trước khi set + persist `localStorage.mp_lang`.
- localStorage read: `const valid = LANGS.some(x => x.code === stored); if (valid) setLangState(stored)`. (Thay `=== 'vi' || === 'en'`.)
- `toggleLang` — **giữ lại** (backward compat) nhưng đổi nghĩa: cycle qua `LANGS` theo vòng (vi→en→km→lo→ms→vi). HOẶC deprecate nếu không còn call site (Coder grep verify; AppShell sẽ chuyển sang `onSelectLang`).

### 3.5 fmt (file `merchant/src/lib/mp/fmt.ts`)
- Thêm map: `const NF_LOCALE: Record<Lang,string> = { vi:'vi-VN', en:'en-US', km:'km-KH', lo:'lo-LA', ms:'ms-MY' }`.
- `num`/`vnd` dùng `new Intl.NumberFormat(NF_LOCALE[lang])`. `vnd` giữ `+ " đ"` (BR-07).
- `monthShort`: thay vì ternary en/vi, dùng `new Intl.DateTimeFormat(NF_LOCALE[lang], { month:'short' }).format(d)` cho gọn + đúng mọi ngôn ngữ. (Nếu lo/km cho ra chữ dài → fallback số "Th{m}" cho vi, "M{m}" cho khác — Coder cân nhắc, ưu tiên không vỡ layout chart axis.)

### 3.6 Switcher UI (file `merchant/src/components/mp/ui.tsx`)
- `Topbar`/`AppShell` prop `onLang: () => void` → đổi thành `onSelectLang: (l: Lang) => void` + `lang: Lang`.
- Pill `{lang === "vi" ? "VI" : "EN"}` (dòng ~248) → component **`LangDropdown`**: trigger (cờ+short) + popover map `LANGS`. Render bằng Base UI/headless popover sẵn có trong merchant (KHÔNG thêm dep mới — nếu chưa có popover primitive, dùng `<details>`/click-outside thuần). Click outside + Esc đóng.
- Component là **Client Component** (`'use client'`) — có state open + dùng `useLang()`.
- Tất cả call site `onLang={toggleLang}` (dashboard/race/settings page truyền vào AppShell) → `onSelectLang={setLang}`.

### 3.7 Font Khmer/Lào (PAUSE-Coder)
- 🛑 **PAUSE-Coder-01:** Verify font. Kiểm tra `merchant` global CSS / layout có font render glyph Khmer (U+1780–17FF) + Lào (U+0E80–0EFF) không. Nếu `system-ui` không cover → thêm **Noto Sans Khmer + Noto Sans Lao** (Google Fonts `next/font` hoặc `<link>`), scope cho text. KHÔNG `pnpm install` nếu dùng `next/font/google` (built-in). Nếu cần package font → 🛑 hỏi Manager.

### 3.8 PAUSE flags
- 🛑 **PAUSE-Coder-01** (font, trên).
- 🛑 KHÔNG `pnpm install` dep mới (popover/font) mà không hỏi Manager.
- 🟢 Không auth change, không API change, không fee logic, không financial data backend.

### 3.9 Frontend conventions
- KHÔNG hardcode chuỗi mới trong JSX — mọi nhãn qua `t()`/`lab()` (giữ đúng convention F-069).
- `Entry` đổi shape → Coder grep `\.en\b`/`\.vi\b` toàn `merchant/src` đảm bảo không truy cập field trực tiếp (chỉ qua `t`/`lab`). tsc sẽ bắt phần lớn.

---

## 🛡️ Testing Mandates

> Feature frontend-only → trọng tâm unit test cho i18n core + render/UAT browser. KHÔNG có E2E backend.

### 4.1 Unit tests — i18n core (file `merchant/src/lib/mp/i18n.spec.ts` — MỚI; nếu merchant chưa có jest, dùng vitest/tsx test runner sẵn có hoặc Coder note PAUSE)

| TC | Mô tả | Input | Expected |
|----|-------|-------|----------|
| TC-01 | `t` happy — ngôn ngữ có bản dịch | `t('nav_revenue','km')` | trả chuỗi Khmer của `nav_revenue` (≠ vi, ≠ rỗng) |
| TC-02 | `t` fallback ngôn ngữ thiếu | key giả chỉ có `{vi}` + gọi `lang='km'` | trả đúng chuỗi `vi` |
| TC-03 | `t` thiếu key hẳn | `t('khong_ton_tai','en')` | trả `'khong_ton_tai'` (raw key) |
| TC-04 | `t` mặc định vi | `t('nav_revenue')` (no lang) | trả chuỗi vi |
| TC-05 | `lab` happy + fallback | `lab(L.orderStatus,'paid','lo')` & `lab(L.category,'MANUAL','km')` | trả bản dịch tương ứng, fallback vi nếu thiếu |
| TC-06 | **Coverage 100% (BR-12)** | loop mọi key trong `DICT` + mọi `L[map]` | mỗi entry có ĐỦ `vi,en,km,lo,ms` đều là string non-empty (test này CHẶN ship nếu sót bản dịch) |
| TC-07 | `Entry` shape — vi bắt buộc | type-level + runtime: mọi entry có `vi` | không entry nào thiếu `vi` |
| TC-08 | localStorage validate | set `mp_lang='zz'` (lạ) → init | lang = `'vi'` (bỏ giá trị lạ, BR-04) |
| TC-09 | localStorage hợp lệ | set `mp_lang='ms'` → init | lang = `'ms'` |

> **TC-06 là test quan trọng nhất** — biến yêu cầu "dịch đủ" thành assertion tự động: nếu Coder/translator sót 1 key km/lo/ms → test đỏ, không ship được. QC dựa vào đây.

### 4.2 fmt tests (bổ sung vào `fmt.spec.ts` nếu có, hoặc gộp i18n.spec)
| TC | Mô tả | Input | Expected |
|----|-------|-------|----------|
| TC-10 | `vnd` giữ " đ" mọi ngôn ngữ | `fmt.vnd(1234567,'km')` | chuỗi kết thúc `" đ"` + grouping (BR-07) |
| TC-11 | `num` locale | `fmt.num(1234567,'ms')` | nhóm hàng nghìn đúng `ms-MY` (không lỗi Intl) |
| TC-12 | `date` nhất quán | `fmt.date(new Date('2026-06-08'),'lo')` | `08/06/2026` (BR-08) |

### 4.3 Frontend UAT (Playwright HOẶC browser thật — QC bắt buộc)
| TC | Persona | Journey | Steps | Expected |
|----|---------|---------|-------|----------|
| E2E-01 | BTC Khmer | Đổi sang Khmer | Login → Topbar → chọn 🇰🇭 | Nav/KPI/bảng đổi Khmer; **glyph render đúng (không tofu □)**; data giải giữ nguyên |
| E2E-02 | BTC Lào | Persist | Chọn Lào → F5 | Sau reload vẫn Lào (localStorage) |
| E2E-03 | BTC Malaysia | Settings | `/settings` → Segmented → Melayu | UI Mã Lai + Topbar đồng bộ `🇲🇾 MS` |
| E2E-04 | Admin | Fallback | (nếu có key cố tình thiếu) | hiện vi, không raw key/rỗng |
| E2E-05 | Mọi | Layout không vỡ | Đổi qua 5 ngôn ngữ ở dashboard + race detail | Không tràn/đè chữ ở KPI card, nav, chart axis (chuỗi Khmer/Lào dài hơn) |

### 4.4 Security
- N/A (không endpoint, không auth change, không data backend). Confirm: không log/leak gì mới. localStorage chỉ chứa mã ngôn ngữ (không PII).

### 4.5 Performance
- Đổi ngôn ngữ < 100ms (client state, no network).
- Bundle: thêm ~130×3 chuỗi (~vài KB) — không đáng kể. Font Khmer/Lào: lazy/subset nếu dùng `next/font` (note Coder để không phình first load).

---

## 📌 Answers to Manager's PAUSE conditions (từ file 00)
- **Nguồn dịch** → Claude dịch toàn bộ km/lo/ms (Appendix A), Danny review sau (BR-10).
- **Switcher UI** → Dropdown cờ + tên native trên Topbar (BR-09) + Segmented 5 ở Settings.
- **Phạm vi dịch** → CHỈ UI chrome (DICT + L), data backend KHÔNG dịch (BR-06).
- **Currency/number** → GIỮ VND + " đ", grouping locale-aware (BR-07/BR-08). Confirm.
- **Font** → Verify + thêm Noto Sans Khmer/Lao nếu thiếu (PAUSE-Coder-01).
- **Thứ tự + nhãn dropdown** → Tiếng Việt / English / ភាសាខ្មែរ / ລາວ / Bahasa Melayu + cờ 🇻🇳🇬🇧🇰🇭🇱🇦🇲🇾 (LANGS registry).

---

## 📎 Appendix A — Bảng dịch đầy đủ (Coder paste vào `DICT` + `L`)

> ⚠️ **BR-10:** km + lo do Claude tạo, CẦN Danny/native review. ms (Latin) độ tin cao hơn. Giữ token brand nguyên (5BIB/GMV/Excel/SSO/auth.5bib.com).
> Format mỗi dòng: `key | km | lo | ms` (vi/en đã có sẵn trong file, KHÔNG đổi).

### A.1 DICT — brand / chrome
| key | km (ភាសាខ្មែរ) | lo (ລາວ) | ms |
|-----|------|------|------|
| portal | ផតថលដៃគូ | ປະຕູຄູ່ຮ່ວມ | Portal Rakan Niaga |
| nav_races | ការប្រណាំង | ການແຂ່ງຂັນ | Perlumbaan |
| nav_tickets | ការលក់សំបុត្រ | ການຂາຍປີ້ | Jualan Tiket |
| nav_revenue | ចំណូល | ລາຍຮັບ | Hasil |
| nav_settings | ការកំណត់ | ການຕັ້ງຄ່າ | Tetapan |
| logout | ចាកចេញ | ອອກຈາກລະບົບ | Log keluar |
| refresh | ផ្ទុកឡើងវិញ | ໂຫຼດຄືນ | Muat semula |
| export_excel | នាំចេញ Excel | ສົ່ງອອກ Excel | Eksport Excel |
| all_merchants | អ្នករៀបចំទាំងអស់ | ຜູ້ຈັດທັງໝົດ | Semua penganjur |
| select_merchant | ជ្រើសរើសអ្នករៀបចំ | ເລືອກຜູ້ຈັດ | Pilih penganjur |
| select_race | ជ្រើសរើសការប្រណាំង | ເລືອກການແຂ່ງຂັນ | Pilih perlumbaan |
| updated_at | បានធ្វើបច្ចុប្បន្នភាពនៅ | ອັບເດດເມື່ອ | Dikemas kini pada |

### A.2 DICT — periods + granularity
| key | km | lo | ms |
|-----|------|------|------|
| period | ចន្លោះពេល | ໄລຍະເວລາ | Tempoh masa |
| last_7 | ៧ ថ្ងៃចុងក្រោយ | 7 ມື້ຜ່ານມາ | 7 hari lepas |
| last_30 | ៣០ ថ្ងៃចុងក្រោយ | 30 ມື້ຜ່ານມາ | 30 hari lepas |
| last_90 | ៩០ ថ្ងៃចុងក្រោយ | 90 ມື້ຜ່ານມາ | 90 hari lepas |
| custom | ផ្ទាល់ខ្លួន | ກຳນົດເອງ | Tersuai |
| daily | ប្រចាំថ្ងៃ | ລາຍວັນ | Harian |
| weekly | ប្រចាំសប្តាហ៍ | ລາຍອາທິດ | Mingguan |
| monthly | ប្រចាំខែ | ລາຍເດືອນ | Bulanan |
| vs_prev | ធៀបនឹងរយៈពេលមុន | ທຽບກັບໄລຍະກ່ອນ | berbanding tempoh sebelumnya |

### A.3 DICT — login
| key | km | lo | ms |
|-----|------|------|------|
| login_title | ចូលទៅផតថលដៃគូ | ເຂົ້າສູ່ປະຕູຄູ່ຮ່ວມ | Log masuk ke Portal Rakan Niaga |
| login_sub | តាមដានការលក់សំបុត្រ និងចំណូលនៃការប្រណាំងរបស់អ្នក។ | ຕິດຕາມການຂາຍປີ້ ແລະ ລາຍຮັບຂອງການແຂ່ງຂັນຂອງທ່ານ. | Pantau jualan tiket & hasil acara anda. |
| email | អ៊ីមែល | ອີເມວ | E-mel |
| password | ពាក្យសម្ងាត់ | ລະຫັດຜ່ານ | Kata laluan |
| remember | ចងចាំការចូល | ຈື່ການເຂົ້າສູ່ລະບົບ | Ingat saya |
| forgot | ភ្លេចពាក្យសម្ងាត់? | ລືມລະຫັດຜ່ານ? | Lupa kata laluan? |
| signin | ចូល | ເຂົ້າສູ່ລະບົບ | Log masuk |
| signin_sso | ចូលដោយគណនី 5BIB (SSO) | ເຂົ້າສູ່ລະບົບດ້ວຍບັນຊີ 5BIB (SSO) | Teruskan dengan 5BIB SSO |
| or | ឬ | ຫຼື | atau |
| secured_by | សុវត្ថិភាពដោយ auth.5bib.com | ຮັບປະກັນໂດຍ auth.5bib.com | Dilindungi oleh auth.5bib.com |
| authenticating | កំពុងផ្ទៀងផ្ទាត់… | ກຳລັງຢືນຢັນ… | Mengesahkan… |
| loading | កំពុងផ្ទុក… | ກຳລັງໂຫຼດ… | Memuatkan… |
| retry | ព្យាយាមម្តងទៀត | ລອງໃໝ່ | Cuba lagi |

### A.4 DICT — race list
| key | km | lo | ms |
|-----|------|------|------|
| your_races | ការប្រណាំងរបស់អ្នក | ການແຂ່ງຂັນຂອງທ່ານ | Perlumbaan anda |
| races_count | ការប្រណាំង | ການແຂ່ງຂັນ | perlumbaan |
| tickets_sold | សំបុត្រលក់ហើយ | ປີ້ທີ່ຂາຍແລ້ວ | tiket dijual |
| showing | កំពុងបង្ហាញ | ກຳລັງສະແດງ | Memaparkan |
| view_report | មើលរបាយការណ៍ | ເບິ່ງລາຍງານ | Lihat laporan |
| no_races_title | មិនទាន់មានការប្រណាំង | ຍັງບໍ່ມີການແຂ່ງຂັນ | Tiada perlumbaan lagi |
| no_races_body | គណនីរបស់អ្នកមិនទាន់ត្រូវបានកំណត់ការប្រណាំងណាមួយឡើយ។ សូមទាក់ទងអ្នករៀបចំ/5BIB ដើម្បីទទួលសិទ្ធិ។ | ບັນຊີຂອງທ່ານຍັງບໍ່ໄດ້ຮັບການກຳນົດການແຂ່ງຂັນໃດໆ. ກະລຸນາຕິດຕໍ່ຜູ້ຈັດ/5BIB ເພື່ອຂໍສິດ. | Akaun anda belum ditugaskan sebarang perlumbaan. Sila hubungi penganjur / pentadbir 5BIB. |
| load_failed | មិនអាចផ្ទុកទិន្នន័យបានទេ | ບໍ່ສາມາດໂຫຼດຂໍ້ມູນໄດ້ | Gagal memuatkan data |
| all_races_link | ការប្រណាំងទាំងអស់ | ການແຂ່ງຂັນທັງໝົດ | Semua perlumbaan |

### A.5 DICT — ticket sales
| key | km | lo | ms |
|-----|------|------|------|
| ticket_report | របាយការណ៍លក់សំបុត្រ | ລາຍງານການຂາຍປີ້ | Laporan Jualan Tiket |
| all_races | ការប្រណាំងទាំងអស់ | ການແຂ່ງຂັນທັງໝົດ | Semua perlumbaan |
| kpi_total | សំបុត្រសរុប | ປີ້ທັງໝົດ | Jumlah tiket |
| kpi_paid | សំបុត្របានបង់ប្រាក់ | ປີ້ທີ່ຈ່າຍແລ້ວ | Tiket dibayar |
| kpi_pending | សំបុត្ររង់ចាំ | ປີ້ລໍຖ້າ | Tiket belum selesai |
| kpi_cancelled | សំបុត្របានលុបចោល | ປີ້ທີ່ຍົກເລີກ | Tiket dibatalkan |
| trend_reg | និន្នាការចុះឈ្មោះ | ແນວໂນ້ມການລົງທະບຽນ | Trend pendaftaran |
| by_course | តាមចម្ងាយ | ຕາມໄລຍະທາງ | Mengikut kategori |
| by_ticket_type | តាមប្រភេទសំបុត្រ | ຕາມປະເພດປີ້ | Mengikut jenis tiket |
| order_detail | ព័ត៌មានលម្អិតការបញ្ជាទិញ | ລາຍລະອຽດການສັ່ງຊື້ | Butiran pesanan |
| search_order | ស្វែងរកលេខការបញ្ជាទិញ… | ຄົ້ນຫາລະຫັດສັ່ງຊື້… | Cari kod pesanan… |
| th_no | ល.រ | ລ/ດ | No. |
| th_code | លេខការបញ្ជាទិញ | ລະຫັດສັ່ງຊື້ | Kod pesanan |
| th_buyer | អ្នកទិញ | ຜູ້ຊື້ | Pembeli |
| th_date | កាលបរិច្ឆេទ | ວັນທີ | Tarikh |
| th_course | ចម្ងាយ | ໄລຍະທາງ | Kategori |
| th_ticket | ប្រភេទសំបុត្រ | ປະເພດປີ້ | Jenis tiket |
| th_qty | ចំនួន | ຈຳນວນ | Kuantiti |
| th_status | ស្ថានភាព | ສະຖານະ | Status |
| of_total | នៃសរុប | ຂອງທັງໝົດ | daripada jumlah |
| page_word | ទំព័រ | ໜ້າ | Halaman |
| prev_page | មុន | ກ່ອນ | Sebelum |
| next_page | បន្ទាប់ | ຕໍ່ໄປ | Seterusnya |
| no_orders | មិនទាន់មានការបញ្ជាទិញ | ຍັງບໍ່ມີການສັ່ງຊື້ | Tiada pesanan lagi |
| no_data | មិនទាន់មានទិន្នន័យ | ຍັງບໍ່ມີຂໍ້ມູນ | Tiada data |

### A.6 DICT — MKT analytics
| key | km | lo | ms |
|-----|------|------|------|
| mkt_analytics | ការវិភាគទីផ្សារ | ການວິເຄາະການຕະຫຼາດ | Analitik MKT |
| forecast_title | សន្សំ និងការព្យាករណ៍ដល់ថ្ងៃប្រណាំង | ສະສົມ ແລະ ການຄາດຄະເນຮອດວັນແຂ່ງ | Kumulatif & unjuran ke hari perlumbaan |
| heatmap_title | ម៉ោងមាសនៃការចុះឈ្មោះ | ຊົ່ວໂມງທອງຄຳຂອງການລົງທະບຽນ | Peta haba waktu pendaftaran |
| funnel_title | ចីវលលនៃការបំប្លែងការបញ្ជាទិញ | ກວຍການແປງການສັ່ງຊື້ | Corong penukaran pesanan |
| ticket_target | គោលដៅសំបុត្រ | ເປົ້າໝາຍປີ້ | Sasaran tiket |
| save | រក្សាទុក | ບັນທຶກ | Simpan |
| saving | កំពុងរក្សាទុក… | ກຳລັງບັນທຶກ… | Menyimpan… |
| target_saved | បានរក្សាទុកគោលដៅ | ບັນທຶກເປົ້າໝາຍແລ້ວ | Sasaran disimpan |
| target_invalid | គោលដៅត្រូវតែជាចំនួនគត់ 0–10.000.000 | ເປົ້າໝາຍຕ້ອງເປັນຈຳນວນເຕັມ 0–10.000.000 | Sasaran mesti integer 0–10,000,000 |
| vn_hours | ម៉ោងវៀតណាម | ເວລາຫວຽດນາມ | Waktu Vietnam |
| race_ended_note | ការប្រណាំងបានបញ្ចប់ — បង្ហាញតែការសន្សំជាក់ស្តែង | ການແຂ່ງຂັນສິ້ນສຸດ — ສະແດງສະເພາະຍອດສະສົມຕົວຈິງ | Perlumbaan tamat — paparkan kumulatif sebenar sahaja |
| conversion | អត្រាបំប្លែង | ອັດຕາການແປງ | Kadar penukaran |
| pending_rate | ការបញ្ជាទិញរង់ចាំ | ການສັ່ງຊື້ຄ້າງ | Tertangguh |
| cancel_rate | លុបចោល / សងវិញ | ຍົກເລີກ / ຄືນເງິນ | Batal / bayar balik |
| orders_created | ការបញ្ជាទិញសរុបដែលបានបង្កើត | ການສັ່ງຊື້ທີ່ສ້າງທັງໝົດ | Jumlah pesanan dibuat |
| paid_confirmed | បានបង់ប្រាក់ | ຈ່າຍແລ້ວ | Dibayar / disahkan |
| insight | ការយល់ដឹងទីផ្សារ | ຄວາມເຂົ້າໃຈການຕະຫຼາດ | Wawasan MKT |
| not_enough_data | ទិន្នន័យមិនគ្រប់គ្រាន់ | ຂໍ້ມູນບໍ່ພຽງພໍ | Data tidak mencukupi |
| no_reg_data | មិនទាន់មានទិន្នន័យចុះឈ្មោះសម្រាប់ការប្រណាំងនេះ | ຍັງບໍ່ມີຂໍ້ມູນການລົງທະບຽນສຳລັບການແຂ່ງຂັນນີ້ | Tiada data pendaftaran untuk perlumbaan ini |
| target_label | គោលដៅ | ເປົ້າໝາຍ | Sasaran |
| race_day | ថ្ងៃប្រណាំង | ວັນແຂ່ງ | Hari perlumbaan |
| cumulative_tickets | សំបុត្រសន្សំ | ປີ້ສະສົມ | kumulatif |
| legend_low | តិច | ໜ້ອຍ | Rendah |
| legend_high | ច្រើន | ຫຼາຍ | Tinggi |

### A.7 DICT — revenue
| key | km | lo | ms |
|-----|------|------|------|
| revenue_report | របាយការណ៍ចំណូល | ລາຍງານລາຍຮັບ | Laporan Hasil |
| fee_rate_now | អត្រាថ្លៃសេវាបច្ចុប្បន្ន | ອັດຕາຄ່າທຳນຽມປັດຈຸບັນ | Kadar yuran semasa |
| kpi_gmv | GMV (ចំណូលសរុបសរុប) | GMV (ລາຍຮັບລວມ) | GMV (Hasil kasar) |
| kpi_fee | ថ្លៃសេវា 5BIB | ຄ່າທຳນຽມ 5BIB | Yuran platform 5BIB |
| kpi_net | ចំណូលសុទ្ធ | ລາຍຮັບສຸດທິ | Hasil bersih |
| kpi_orders | ការបញ្ជាទិញ (បានបង់ប្រាក់) | ການສັ່ງຊື້ (ຈ່າຍແລ້ວ) | Pesanan (dibayar) |
| trend_rev | និន្នាការចំណូល | ແນວໂນ້ມລາຍຮັບ | Trend hasil |
| breakdown_cat | ការបែងចែកតាមប្រភេទថ្លៃសេវា | ການແບ່ງຕາມປະເພດຄ່າທຳນຽມ | Pecahan mengikut jenis yuran |
| order_type | ប្រភេទថ្លៃសេវា | ປະເພດຄ່າທຳນຽມ | Jenis yuran |
| th_orders | ការបញ្ជាទិញ | ການສັ່ງຊື້ | Pesanan |
| th_pct_gmv | % GMV | % GMV | % GMV |
| total_row | សរុប | ລວມທັງໝົດ | Jumlah |
| computing_fee | កំពុងគណនាថ្លៃសេវា… | ກຳລັງຄຳນວນຄ່າທຳນຽມ… | Mengira yuran… |

### A.8 DICT — settings
| key | km | lo | ms |
|-----|------|------|------|
| settings_title | ការកំណត់ | ການຕັ້ງຄ່າ | Tetapan |
| language | ភាសា | ພາສາ | Bahasa |
| account | គណនី | ບັນຊີ | Akaun |
| your_name | ឈ្មោះ | ຊື່ | Nama |
| role_label | សិទ្ធិ | ສິດ | Peranan |
| assigned_races | ការប្រណាំងដែលអាចមើលបាន | ການແຂ່ງຂັນທີ່ເບິ່ງໄດ້ | Perlumbaan yang ditugaskan |
| save_settings | រក្សាទុកការកំណត់ | ບັນທຶກການຕັ້ງຄ່າ | Simpan tetapan |
| f_email | អ៊ីមែល | ອີເມວ | E-mel |

### A.9 DICT — permission / error
| key | km | lo | ms |
|-----|------|------|------|
| unauth_title | គ្មានសិទ្ធិចូលប្រើ | ບໍ່ມີສິດເຂົ້າເຖິງ | Akses ditolak |
| unauth_body | គណនីរបស់អ្នកមិនទាន់ត្រូវបានផ្តល់សិទ្ធិចូលប្រើ Merchant Portal ទេ។ សូមទាក់ទងអ្នកគ្រប់គ្រង 5BIB។ | ບັນຊີຂອງທ່ານຍັງບໍ່ໄດ້ຮັບສິດເຂົ້າເຖິງ Merchant Portal. ກະລຸນາຕິດຕໍ່ຜູ້ດູແລ 5BIB. | Akaun anda tidak dibenarkan mengakses Merchant Portal. Sila hubungi pentadbir 5BIB anda. |
| rev_gate_title | ត្រូវការសិទ្ធិមើលចំណូល | ຕ້ອງການສິດເບິ່ງລາຍຮັບ | Akses hasil diperlukan |
| rev_gate_body | អ្នកមានសិទ្ធិមើលតែរបាយការណ៍លក់សំបុត្រប៉ុណ្ណោះ។ ទាក់ទងអ្នកគ្រប់គ្រង 5BIB ដើម្បីដំឡើងសិទ្ធិមើលចំណូល។ | ທ່ານມີສິດເບິ່ງສະເພາະລາຍງານການຂາຍປີ້ເທົ່ານັ້ນ. ຕິດຕໍ່ຜູ້ດູແລ 5BIB ເພື່ອຍົກລະດັບສິດເບິ່ງລາຍຮັບ. | Anda hanya mempunyai akses laporan tiket. Hubungi pentadbir 5BIB untuk menaik taraf ke akses hasil. |
| go_tickets | ត្រឡប់ទៅរបាយការណ៍លក់សំបុត្រ | ກັບໄປລາຍງານການຂາຍປີ້ | Ke laporan tiket |

### A.10 DICT — roles
| key | km | lo | ms |
|-----|------|------|------|
| role_viewer | របាយការណ៍លក់សំបុត្រ | ລາຍງານການຂາຍປີ້ | Laporan tiket |
| role_finance | សំបុត្រ + ចំណូល | ປີ້ + ລາຍຮັບ | Tiket + Hasil |

### A.11 L.orderStatus
| key | km | lo | ms |
|-----|------|------|------|
| completed | បានបញ្ចប់ | ສຳເລັດແລ້ວ | Selesai |
| paid | បានបង់ប្រាក់ | ຈ່າຍແລ້ວ | Dibayar |
| pending | រង់ចាំ | ລໍຖ້າ | Belum selesai |
| cancelled | បានលុបចោល | ຍົກເລີກແລ້ວ | Dibatalkan |
| refunded | បានសងប្រាក់វិញ | ຄືນເງິນແລ້ວ | Dibayar balik |
| voided | បានលុបចោល | ຍົກເລີກ | Dibatalkan |

### A.12 L.category
| key | km | lo | ms |
|-----|------|------|------|
| ORDINARY | ការបញ្ជាទិញធម្មតា | ການສັ່ງຊື້ປົກກະຕິ | Biasa |
| GROUP_BUY | ការទិញជាក្រុម | ການຊື້ເປັນກຸ່ມ | Belian Kumpulan |
| MANUAL | បញ្ចូលដោយដៃ | ປ້ອນດ້ວຍມື | Kemasukan Manual |

### A.13 L.raceStatus
| key | km | lo | ms |
|-----|------|------|------|
| COMPLETE | បានបញ្ចប់ | ສິ້ນສຸດແລ້ວ | Tamat |
| ONGOING | កំពុងប្រព្រឹត្តទៅ | ກຳລັງດຳເນີນ | Langsung |
| GENERATED_CODE | នឹងប្រព្រឹត្តទៅ | ກຳລັງຈະມາເຖິງ | Akan datang |
| CANCEL | បានលុបចោល | ຍົກເລີກແລ້ວ | Dibatalkan |

### A.14 L.feeGroup
| key | km | lo | ms |
|-----|------|------|------|
| fee_percent | ថ្លៃសេវា % | ຄ່າທຳນຽມ % | Yuran peratusan |
| fee_fixed | ថ្លៃសេវាថេរ (MANUAL) | ຄ່າທຳນຽມຄົງທີ່ (MANUAL) | Yuran tetap |

---

## ✅ Status
- [x] READY — sẵn sàng cho Manager review (`/5bib-plan`)

## 🔗 Next step
Danny chạy: `/5bib-plan FEATURE-071-merchant-i18n-sea-languages`
