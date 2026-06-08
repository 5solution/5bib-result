# FEATURE-071: Merchant Portal — bổ sung 3 ngôn ngữ Đông Nam Á (Khmer / Lào / Mã Lai)

**Status:** 🟡 INITIATED
**Created:** 2026-06-08
**Owner:** Danny
**Type:** EXTEND_EXISTING (refactor i18n core merchant + thêm content dịch)
**Created by:** 5bib-manager

---

## 🎯 Why this feature

Danny yêu cầu merchant.5bib.com hỗ trợ thêm **Khmer (Campuchia), Lào, Mã Lai** ngoài VI/EN hiện có — phục vụ BTC/đối tác ở thị trường Đông Nam Á.

**Manager tự nhận thiếu sót:** i18n F-069 xây theo kiểu "đúng 2 ngôn ngữ" (`Entry = {vi, en}` shape cứng + switcher pill toggle nhị phân). Thêm ngôn ngữ thứ 3+ buộc refactor core, KHÔNG plug-and-play. Đây là tech debt thiết kế từ F-069 — feature này vừa thêm tính năng vừa trả nợ kiến trúc.

---

## 📂 Impact Map (đã đọc code thật 2026-06-08)

### Module chạm — CHỈ app `merchant/` (backend KHÔNG đụng — data không dịch)

Toàn bộ i18n là **UI chrome only**; tên giải/BTC/data luôn giữ nguyên từ backend. → 0 thay đổi backend, 0 thay đổi SDK, 0 migration DB.

### File then chốt + thay đổi

| File | Thay đổi | Ghi chú |
|------|----------|---------|
| `merchant/src/lib/mp/i18n.ts` | 🔴 CORE: `type Lang = "vi"\|"en"` → `+ "km"\|"lo"\|"ms"`. `type Entry = {vi,en}` → `Partial<Record<Lang,string>>` (vi bắt buộc làm fallback). `t()` + `lab()` fallback về `vi` khi thiếu key. Thêm 3 bản dịch vào ~120 DICT entry + ~20 label-map entry. Thêm `LANGS` registry (code + nhãn + cờ) | Quyết định fallback→VI giúp ship dần, key chưa dịch không vỡ UI |
| `merchant/src/lib/mp/lang-context.tsx` | `toggleLang` (lật nhị phân) → giữ tương thích nhưng thêm flow `setLang(any Lang)`. localStorage validate `['vi','en','km','lo','ms'].includes()` thay vì `=== 'vi'\|'en'` | SSR-safe giữ nguyên (default 'vi') |
| `merchant/src/lib/mp/fmt.ts` | `lang === "en" ? "en-US" : "vi-VN"` → map locale: `{vi:'vi-VN', en:'en-US', km:'km-KH', lo:'lo-LA', ms:'ms-MY'}`. `monthShort` thêm nhãn 3 ngôn ngữ (hoặc dùng `Intl` cho gọn) | Tiền tệ giữ VND (giải VN) — KHÔNG đổi currency |
| `merchant/src/components/mp/ui.tsx` | 🔴 Topbar switcher: pill `{lang==="vi"?"VI":"EN"}` (dòng ~248) → **dropdown menu cờ + tên** (5 dòng). `onLang: () => void` → `onSelectLang: (l: Lang) => void` | Danny chốt dropdown cờ |
| `merchant/src/app/settings/page.tsx` | `Segmented<Lang>` đã scale sẵn — chỉ cần truyền `langOptions` 5 phần tử + `onLang={toggleLang}` ở AppShell → `onSelectLang={setLang}` | Phần dễ nhất |

**Số file consume i18n: chỉ 5** → bề mặt nhỏ, refactor an toàn.

### Endpoint / Schema / DB / Redis / SDK
- **KHÔNG đụng gì.** Thuần frontend merchant.

---

## ⚠️ Risk Flags

- 🔴 **HIGH (content, KHÔNG phải code)** — Bản dịch Khmer (ភាសាខ្មែរ) + Lào (ລາວ) là **chữ phi-Latin**, dễ sai. **Danny chốt: Claude dịch hết, Danny review sau.** Chuỗi tài chính nhạy cảm (`kpi_net` "Doanh thu ròng", `kpi_fee` "Phí 5BIB", `kpi_gmv`) PHẢI được Danny/native review trước khi tin tưởng publish — flag rõ trong PRD để QC không "pass" bản dịch mà không ai đọc.
- 🟡 **MED** — `Entry` đổi shape `{vi,en}` → `Partial<Record<Lang,string>>`: tsc sẽ bắt mọi nơi destructure `e.en` cứng. Coder PHẢI grep `\.en\b` + `\.vi\b` trong app merchant, đảm bảo qua `t()`/`lab()` (đã có fallback) chứ không truy cập field trực tiếp.
- 🟡 **MED** — Font: Khmer/Lào cần font hỗ trợ glyph. Kiểm tra `merchant` global CSS có `system-ui`/web font render được script này không (Noto Sans Khmer/Lao). Nếu thiếu → thêm `@font-face` hoặc Google Fonts. Coder verify render thật bằng browser (đừng tin tsc pass = render đúng).
- 🟢 **LOW** — Backend/SDK/DB: 0 thay đổi.
- 🟢 **LOW** — Surface nhỏ (5 file), fallback→VI nên rollout an toàn.

---

## 🚧 PAUSE Conditions cho BA (trả lời khi viết PRD)

- [x] **Nguồn dịch** → CHỐT: Claude dịch hết ~140 chuỗi sang km/lo/ms, Danny review sau.
- [x] **Switcher UI** → CHỐT: dropdown cờ + tên ngôn ngữ trên Topbar.
- [ ] **Phạm vi dịch** = chỉ UI chrome (DICT + label maps L), KHÔNG dịch data backend (tên giải/BTC/người mua). → BA confirm (đây là design hiện tại, giữ nguyên).
- [ ] **Currency/number** = giữ VND + locale-aware grouping (km-KH/lo-LA/ms-MY). Có cần đổi ký hiệu tiền không hay luôn " đ"? → đề xuất giữ " đ" (giải VN). BA confirm.
- [ ] **Font** Khmer/Lào: dùng web font (Noto) hay tin system font? → BA + Coder verify render.
- [ ] **Thứ tự + nhãn** trong dropdown: Tiếng Việt / English / ភាសាខ្មែរ / ລາວ / Bahasa Melayu (nhãn theo native name). Cờ 🇻🇳🇬🇧🇰🇭🇱🇦🇲🇾. BA confirm.

---

## 🎯 Success criteria (gợi ý BA)

- Đổi sang Khmer/Lào/Mã Lai → toàn bộ UI chrome (nav, KPI, bảng, login, settings, MKT analytics labels) đổi theo, KHÔNG còn chuỗi VI/EN lẫn (trừ data backend + brand 5BIB/GMV/BIB).
- Key chưa dịch → fallback hiển thị VI (không vỡ, không hiện raw key).
- Số/ngày format đúng locale; tiền giữ VND.
- localStorage nhớ lựa chọn qua reload; SSR không hydration-mismatch (default vi → hydrate).
- Render glyph Khmer/Lào đúng trên Chrome (browser UAT thật, không chỉ tsc).

---

## 📋 Scope Lock dự kiến (Manager khoá ở /5bib-plan)

CHỈ 5 file trên trong `merchant/`. Bất kỳ đụng backend/SDK/DB = scope creep → dừng hỏi Manager.

---

## ✅ Sẵn sàng cho /5bib-prd?

- [x] Yes — 2 quyết định nghiệp vụ lớn đã chốt. BA viết PRD với bảng chuỗi dịch + UI switcher spec + font check.

## 🔗 Next step

Danny chạy: `/5bib-prd FEATURE-071-merchant-i18n-sea-languages`
(hoặc nếu muốn nhanh: BA + Coder chạy liền vì scope nhỏ, đã chốt quyết định.)
