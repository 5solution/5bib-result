# FEATURE-071: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-06-08
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check
- [x] Đã đọc `00-manager-init.md`
- [x] Đã đọc `01-ba-prd.md` toàn bộ (12 BR + 2 journey + Appendix A 130 chuỗi × 3)
- [x] Đã đọc memory: codebase-map (merchant i18n UI-chrome-only), conventions, known-issues
- [x] **Spot-check code thật** — xác nhận từng file PRD reference (chi tiết dưới)

---

## 🔬 Spot-check code thật (MANDATORY)

| PRD claim | Verify | Kết quả |
|-----------|--------|---------|
| `i18n.ts` `Lang='vi'\|'en'`, `Entry={vi,en}`, 130 key DICT+L | Đọc full 206 dòng | ✅ ĐÚNG. `t()` line 167, `lab()` line 202, DICT 13–165, L 173–200 |
| `ui.tsx:248` pill toggle `{lang==="vi"?"VI":"EN"}` + `onLang:()=>void` | Đọc 180–250 | ✅ ĐÚNG. TopbarProps `onLang: () => void`; pill + `Icons.Globe` |
| `settings/page.tsx` `Segmented<Lang>` scale được | Đọc grep | ✅ ĐÚNG. line 72 `langOptions: SegOption<Lang>[]`, line 91 `Segmented<Lang> ... onChange={setLang}` |
| `Segmented` generic component tồn tại | grep | ✅ `charts.tsx:424 export function Segmented<T extends string>` |
| `fmt.ts` ternary `en?en-US:vi-VN` | Đọc full | ✅ ĐÚNG, cần map locale |
| **Test runner cho unit test** | package.json + devDeps | ❌ **KHÔNG có jest/vitest/ts-jest** → cần sanction (xem dưới) |
| **next/font cho Noto Khmer/Lao** | grep next/font | ✅ ĐÃ dùng sẵn `src/lib/fonts.ts` (Be_Vietnam_Pro/Plus_Jakarta_Sans/JetBrains_Mono từ `next/font/google`) → thêm Noto theo pattern, KHÔNG `pnpm install` |

→ PRD KHÔNG hallucinate file/method nào. 2 điểm cần Manager quyết: test runner + font (resolve dưới).

---

## ✓ PRD Validation Checklist

### Completeness
- [x] User Stories đủ 4 persona (BTC Khmer/Lào/Malaysia + Back-Office Admin)
- [x] 12 Business Rules có ID, **testable** (đặc biệt BR-03 fallback + BR-12 coverage → TC-02/03/06)
- [x] UI states đủ: loading/empty/data/error/switcher-open-close-select/**fallback**/glyph-missing
- [x] Mọi PAUSE file 00 đã trả lời trong PRD

### Technical correctness vs codebase
- [x] Type refactor `Entry` → `{vi}&Partial<Record<...>>` hợp lý, fallback an toàn (BR-02/03)
- [x] `fmt` locale map đúng convention Intl
- [x] Switcher LangDropdown ↔ ui.tsx hiện tại khớp
- [x] **KHÔNG đụng backend/SDK/DB/Redis/migration** — confirmed thuần `merchant/`
- [x] Data backend KHÔNG dịch (BR-06) — đúng design F-069

### Security
- [x] N/A đúng — không endpoint, không auth change, không data backend, localStorage chỉ chứa mã ngôn ngữ (không PII)

### Performance
- [x] Đổi ngôn ngữ <100ms (client state) — số cụ thể
- [x] Note bundle/font subset để không phình first load

### Testability
- [x] TC-01..12 input/output cụ thể; **TC-06 coverage = assertion tự động chặn ship nếu sót bản dịch** (đòn bẩy tốt)
- [x] E2E-01..05 có glyph-render check + layout-không-vỡ

→ Mọi mục checked. KHÔNG có block condition (không OrderService, không schema mới, không bỏ state error/loading).

---

## 📊 Cross-check memory
- **Architecture:** Feature thuần frontend merchant, KHÔNG thêm node backend/integration. architecture.md KHÔNG cần update (trừ ghi nhận i18n đa-ngôn-ngữ).
- **Convention:** Pattern mới đáng ghi sau ship → "i18n fallback-to-base-locale" (`Entry` base-required + `Partial` rest) + "next/font multi-script stacking". Manager sẽ thêm vào conventions.md ở `/5bib-deploy`.
- **Known-issues:** Resolve tech debt ngầm "i18n binary-only" (F-069). Không đụng quirk nào hiện có.

---

## 🟢 Manager Decisions (2 điểm spot-check phát hiện)

### DECISION-1 — Sanction **vitest** (dev-dependency) cho unit test
Merchant chưa có test runner. Unit test (đặc biệt **TC-06 coverage**) là yêu cầu workflow + là chốt chặn quan trọng nhất của feature này.
- ✅ **Manager APPROVE thêm `vitest` + `@vitest/...` (dev-only)** — đây là exception có kiểm soát cho PAUSE "pnpm install". Lý do: dev-dep chuẩn cho Vite/Next, không vào prod bundle, rủi ro thấp. Coder KHÔNG cần hỏi lại cho riêng vitest.
- Cấu hình tối thiểu: `vitest.config.ts` + script `"test": "vitest run"` trong `merchant/package.json`.
- **Phương án thay thế chấp nhận được:** nếu Coder muốn tránh dep, dùng script `tsx` thuần (`scripts/i18n-coverage-check.ts`) chạy bằng tooling có sẵn để cover ÍT NHẤT TC-06 (coverage) + TC-02/03 (fallback). Nhưng ƯU TIÊN vitest cho đủ TC-01..12.
- 🛑 Mọi dep KHÁC ngoài vitest → vẫn PAUSE hỏi Manager.

### DECISION-2 — Font Khmer/Lào qua **next/font/google** (KHÔNG pnpm install)
- ✅ Thêm `Noto_Sans_Khmer` + `Noto_Sans_Lao` vào `merchant/src/lib/fonts.ts` (đúng pattern Be_Vietnam_Pro hiện có) → expose CSS var → nối vào font stack ở `globals.css`/`layout.tsx` để browser fallback glyph Khmer/Lào.
- `next/font/google` built-in Next → KHÔNG cần `pnpm install`. PAUSE-Coder-01 (file 01) → **RESOLVED bằng cách này**.
- Subset: dùng `subset: ['khmer']` / `['lao']` để không phình bundle (BR perf).

---

## 📋 Files được phép thay đổi (Scope Lock)

> Toàn bộ trong `merchant/`. Đụng ngoài (backend/admin/frontend/SDK/DB) = scope creep → DỪNG hỏi Manager.

**i18n core:**
- ✏️ `merchant/src/lib/mp/i18n.ts` — `Lang` +km/lo/ms; `Entry`→`{vi}&Partial<Record<Exclude<Lang,'vi'>,string>>`; `t()`/`lab()` fallback (BR-03); thêm `LANGS` registry; đổ **toàn bộ Appendix A** vào DICT + L (BR-12 coverage 100%)
- ✏️ `merchant/src/lib/mp/lang-context.tsx` — `setLang(l:Lang)` validate ∈ LANGS; localStorage validate 5 giá trị (BR-04); `toggleLang` giữ hoặc cycle (Coder grep call site quyết)
- ✏️ `merchant/src/lib/mp/fmt.ts` — `NF_LOCALE` map 5 ngôn ngữ; `num`/`vnd` Intl theo locale; `vnd` GIỮ " đ" (BR-07); `monthShort` đa ngôn ngữ (fallback không vỡ chart axis)

**Switcher UI:**
- ✏️ `merchant/src/components/mp/ui.tsx` — Topbar pill → `LangDropdown` (cờ+short trigger + popover 5 dòng `LANGS`, click-outside + Esc); `AppShell`/`Topbar` prop `onLang:()=>void` → `onSelectLang:(l:Lang)=>void` + `lang`. **KHÔNG thêm dep popover** — dùng primitive sẵn có hoặc `<details>`/click-outside thuần
- ✏️ `merchant/src/app/settings/page.tsx` — `langOptions` 5 phần tử; `onLang` truyền AppShell → `onSelectLang={setLang}`
- ✏️ **Mọi page render AppShell truyền `onLang`** → đổi `onSelectLang` (Coder grep `onLang=` trong `merchant/src/app/` — dự kiến `dashboard/page.tsx`, `races/[raceId]/page.tsx`, `settings/page.tsx`)

**Font:**
- ✏️ `merchant/src/lib/fonts.ts` — thêm Noto Sans Khmer + Noto Sans Lao (subset)
- ✏️ `merchant/src/app/globals.css` và/hoặc `merchant/src/app/layout.tsx` — nối font var vào stack cho glyph Khmer/Lào

**Test:**
- ➕ `merchant/src/lib/mp/i18n.spec.ts` — TC-01..09 (+ fmt TC-10..12 gộp đây hoặc `fmt.spec.ts`)
- ➕ `merchant/vitest.config.ts` + ✏️ `merchant/package.json` (script `test` + devDep vitest) — DECISION-1
- (tuỳ chọn) ➕ `merchant/scripts/i18n-coverage-check.ts` nếu chọn phương án tsx thay vitest

---

## 🔧 Tech approach (đề xuất)
- **Fallback chain (BR-03):** `e[lang] || e.vi` — đơn giản, đã có trong PRD code block, giữ nguyên.
- **`Entry` base-required type:** `{ vi: string } & Partial<Record<Exclude<Lang,'vi'>,string>>` → tsc ép mọi entry có `vi`, km/lo/ms optional ở type nhưng BR-12+TC-06 ép phải đủ ở runtime. Hay: vừa an toàn type vừa cho phép ship dần.
- **LangDropdown:** ưu tiên không thêm dep — `<button>` + popover thuần (state open + `useEffect` click-outside + keydown Esc). Render từ `LANGS`.
- **Translation review (BR-10):** km/lo do Claude tạo — **publish-gate, KHÔNG code-gate.** Coder paste verbatim; QC verify coverage + glyph render (KHÔNG verify nghĩa); Danny/native review nghĩa SAU. Manager note ở deploy: km/lo "provisional translation, pending native review".

---

## 🛑 PAUSE points cho Coder
- ✅ vitest dev-dep: **đã được Manager duyệt** (DECISION-1) — KHÔNG cần hỏi lại.
- ✅ Noto font qua next/font/google: **đã duyệt** (DECISION-2) — KHÔNG cần hỏi lại.
- 🛑 Bất kỳ dep nào KHÁC (popover lib, i18n framework như next-intl/i18next…) → DỪNG hỏi Manager. (Feature này KHÔNG cần framework — dict thuần là đủ.)
- 🛑 Nếu phải đụng file ngoài `merchant/` → scope creep, DỪNG.
- 🛑 Nếu `monthShort` Intl cho ra glyph làm vỡ chart axis → dừng, báo, dùng fallback số.

---

## 🧪 Unit test BẮT BUỘC (Coder phải viết, QC check)
- [ ] TC-01 `t` happy (km có bản dịch)
- [ ] TC-02 `t` fallback ngôn ngữ thiếu → vi
- [ ] TC-03 `t` thiếu key → raw key
- [ ] TC-04 `t` default vi
- [ ] TC-05 `lab` happy + fallback
- [ ] **TC-06 coverage 100%** — loop mọi DICT + L key, assert đủ `vi/en/km/lo/ms` non-empty (CHẶN ship nếu sót)
- [ ] TC-07 `Entry` vi bắt buộc
- [ ] TC-08 localStorage giá trị lạ → vi
- [ ] TC-09 localStorage hợp lệ → set
- [ ] TC-10 `fmt.vnd` giữ " đ" mọi ngôn ngữ
- [ ] TC-11 `fmt.num` locale không lỗi Intl
- [ ] TC-12 `fmt.date` `dd/mm/yyyy` nhất quán

Mỗi test có assertion cụ thể (không `toBeDefined()` suông).

---

## 📊 Verdict

> ### ✅ APPROVED — Coder có thể bắt đầu

Lý do: PRD đầy đủ, testable, KHÔNG đụng vùng risk (backend/auth/fee/DB). 2 gap spot-check phát hiện (test runner + font) đã được Manager resolve sẵn (DECISION-1/2) để Coder không stall. Translation review là publish-gate, không block code.

⚠️ **Lưu ý publish (không block code):** bản dịch km/lo do Claude tạo — trước khi cho BTC Campuchia/Lào dùng PROD thật, Danny/native PHẢI review nghĩa (nhất là `kpi_net`/`kpi_fee`/`target_invalid`). Ship DEV trước, gắn nhãn "provisional".

## ✅ Sẵn sàng cho `/5bib-code`?
- [x] Yes — theo Scope Lock + DECISION-1/2 + 12 unit test trên.

## 🔗 Next step
Danny chạy: `/5bib-code FEATURE-071-merchant-i18n-sea-languages`
