# FEATURE-071 — Implementation Notes (Reviewer's Guide)

> Merchant Portal +3 ngôn ngữ ĐNA (Khmer/Lào/Mã Lai). Frontend-only `merchant/`.

## Section 1 — 🚧 Deviations from Spec (intentional)

- **[Deviation #1] LangDropdown self-contained qua `useLang()` thay vì prop `onSelectLang`**
  - **Spec said:** Plan Scope Lock: "AppShell/Topbar prop `onLang:()=>void` → `onSelectLang:(l:Lang)=>void`".
  - **I did:** Bỏ HẲN prop `onLang`. Tạo `<LangDropdown/>` tự đọc/ghi qua `useLang()` (component nằm trong LangProvider). Topbar chỉ render `<LangDropdown/>`.
  - **Why:** Ít ripple hơn (không thread setLang qua AppShell→Topbar + 3 page), encapsulation tốt hơn, đúng tinh thần "Coder có thể tinh chỉnh tech approach". Plan cho phép.
  - **Reviewer should check:** AppShell/Topbar không còn `onLang`; 3 page (dashboard/settings/races) không truyền onLang; dropdown đổi ngôn ngữ tức thì.

- **[Deviation #2] `lang_save_note` thành dict key thay vì ternary inline**
  - **Spec said:** PRD Screen 2 mô tả note song ngữ; settings cũ dùng `lang==="en"?EN:VI` inline.
  - **I did:** Thêm key `lang_save_note` (đủ 5 ngôn ngữ) vào DICT, settings dùng `t('lang_save_note', lang)`.
  - **Why:** Ternary chỉ EN/VI → km/lo/ms sẽ thấy tiếng Việt (đúng fallback nhưng không dịch). Đưa vào dict = dịch đủ + nhất quán convention "không chuỗi inline".
  - **Reviewer should check:** key có trong TC-06 coverage (đã đủ 5 lang).

## Section 2 — ⚙️ Forced Changes (reality ≠ spec)

- **[Forced #1] RaceCard prop `lang: "vi" | "en"` → `Lang`**
  - **PRD assumed:** chỉ liệt 5 file core; không lường component con hardcode union hẹp.
  - **Reality:** `dashboard/page.tsx:57` `RaceCard` khai báo `lang: "vi" | "en"` → tsc fail khi truyền `Lang` (5-union).
  - **Workaround:** widen prop sang `Lang` (import type). Nằm trong file scope (dashboard).
  - **Manager/BA action:** lần sau khi đổi union type, grep component con hardcode union cũ. Note codebase-map: merchant lang prop dùng `Lang` từ i18n, không hardcode.

- **[Forced #2] `Icons.ChevronDown` không tồn tại → `Icons.ChevD`**
  - **Reality:** icons.tsx export `ChevD`/`ChevR` (không phải ChevronDown). Đã dùng `Icons.ChevD` + `Icons.Check` (có sẵn).

- **[Forced #3] Merchant chưa có test runner → vitest (DECISION-1 Manager đã duyệt)**
  - Cài `vitest@4.1.8` dev-dep + `vitest.config.ts` (node env). Không cần jsdom (test thuần pure-function; TC-08/09 test `isLang()` thay vì render provider).

## Section 3 — ⚖️ Tradeoffs Considered

| Decision | Chosen | Alternative | Why | Cost paid |
|----------|--------|-------------|-----|-----------|
| Switcher state | self-contained `useLang()` trong LangDropdown | prop `onSelectLang` thread qua AppShell | ít ripple, encapsulate | LangDropdown buộc là client + phải nằm trong LangProvider (đã thoả) |
| Entry type | `{vi}&Partial<Record<...>>` base-required | `Record<Lang,string>` full-required | ship dần an toàn, tsc ép vi | km/lo/ms optional ở type → cần TC-06 runtime ép đủ (đã có) |
| Font Khmer/Lào | next/font/google subset + CSS var fallback | literal @font-face / CDN link | no install, no FOIT, hashed-safe | first load +2 font subset (~vài chục KB, swap) |
| monthShort km/lo | `M{m}` ASCII | Intl non-Latin month short | không vỡ chart axis (Khmer/Lào month name dài) | km/lo axis hiện "M6" thay tên tháng bản địa (chấp nhận, axis-only) |
| Test runner | vitest node env | jsdom + render provider | test pure-function nhanh, không cần DOM | TC-08/09 test `isLang()` thay vì render LangProvider (logic tương đương) |

## Section 4 — 🔬 Reviewer Notes (Manager + QC focus)

### Files review kỹ (priority)
1. **`merchant/src/lib/mp/i18n.ts`** — core: Entry type + t()/lab() fallback (line ~190/280) + 131 entry × 5 lang. **QC trọng tâm: TC-06 coverage + glyph đúng script.**
2. **`merchant/src/components/mp/ui.tsx`** (`LangDropdown` ~ trước Topbar) — click-outside/Esc + setLang + active ✓.
3. **`merchant/src/lib/mp/fmt.ts`** — NF_LOCALE + vnd " đ" giữ (BR-07).
4. **`merchant/src/app/settings/page.tsx`** — langOptions 5 + Segmented + note dict.
5. **`merchant/src/lib/fonts.ts` + `globals.css`** — font wiring Khmer/Lào.

### Concurrency hotspots
- Không có (client UI state, no async race).

### Edge cases tested vs DEFERRED
- ✅ Tested (unit): fallback lang/key, coverage 5-lang, isLang validate, vnd suffix, num locale, date format.
- ⚠️ DEFERRED to DEV (Logto-gated, QC owns): **browser glyph render Khmer/Lào (không tofu □)** + layout không vỡ khi chuỗi dài (E2E-01/05) + persist reload (E2E-02). Build-verified font subset load nhưng CHƯA screenshot render thật.

### Type safety
- 0 `any`/`as unknown as` mới. `isLang(v: unknown): v is Lang` type guard chuẩn.

### Translation quality flag (BR-10 — QUAN TRỌNG)
- **km + lo do Claude tạo = PROVISIONAL.** QC verify coverage (đủ + non-empty) + glyph render, **KHÔNG verify nghĩa**. Danny/native PHẢI review nghĩa trước khi BTC Campuchia/Lào dùng PROD — đặc biệt chuỗi tài chính: `kpi_net`, `kpi_fee`, `kpi_gmv`, `target_invalid`, `rev_gate_body`.

### Build/lint status
- tsc 0 ✅ · next build 15 routes ✅ · vitest 13/13 ✅
- Lint: 27 lỗi **pre-existing F-069** (any/set-state-in-effect/`<a>`-link toàn codebase merchant) — build PASS, không phải gate. Thay đổi của tao không thêm category lỗi mới (lang-context set-state-in-effect y hệt bản gốc).
