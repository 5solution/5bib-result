# FEATURE-071: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC
**Started / Finished:** 2026-06-08
**Author:** 5bib-fullstack-engineer
**Linked:** `00`, `01`, `02`

---

## 📌 Pre-flight check
- [x] Đọc `00-manager-init.md`
- [x] Đọc `01-ba-prd.md` đầy đủ (12 BR + Appendix A 130+ chuỗi)
- [x] Đọc `02-manager-plan.md` — verdict ✅ APPROVED (DECISION-1 vitest + DECISION-2 next/font)
- [x] Đọc `memory/conventions.md` + `codebase-map.md`
- [x] Đọc code thật toàn bộ Scope Lock (i18n/lang-context/fmt/ui/settings/dashboard/races/fonts/layout/globals)

---

## 🔍 Impact Assessment (Phase 1)
- **Frontend-only `merchant/`.** 0 backend, 0 SDK regen, 0 DB/Redis/migration.
- **i18n core:** `Lang` 2→5; `Entry` `{vi,en}`→`{vi}&Partial<Record<Exclude<Lang,'vi'>,string>>`. tsc ép mọi entry có `vi`. `t()`/`lab()` fallback `e[lang]||e.vi`.
- **Next.js cache:** không đụng (client state ngôn ngữ, no server fetch). Không cần revalidate.
- **Font:** Noto Khmer/Lao qua `next/font/google` (built-in, no install) → CSS var nối vào `--font-body`/`--font-display` stack ở globals.css; Latin/VN không đổi (chỉ fallback glyph thiếu).
- **Switcher:** Topbar pill toggle → `LangDropdown` self-contained (useLang). Bỏ prop `onLang` khỏi AppShell/Topbar → 3 call site (dashboard/settings/races) cập nhật.

## ⚠️ Edge Cases Covered (Phase 2)
- [x] Ngôn ngữ thiếu bản dịch → fallback `vi` (BR-03), KHÔNG rỗng — TC-02.
- [x] Key thiếu hẳn → raw key (dev) — TC-03.
- [x] localStorage giá trị lạ/legacy ('zz') → `isLang` reject → dùng `vi` (BR-04) — TC-08.
- [x] SSR hydration: server+first paint = `vi`, hydrate localStorage trong effect (BR-05, giữ pattern F-069).
- [x] Currency: `vnd` giữ `" đ"` mọi ngôn ngữ (BR-07) — TC-10.
- [x] Intl locale lỗi → try/catch fallback `vi-VN` (`nf()` trong fmt).
- [x] Chart axis: `monthShort` km/lo dùng `M{m}` ASCII compact (không vỡ axis).

## 🧠 Logic & Architecture (Phase 3)
- `Entry = { vi } & Partial<Record<Exclude<Lang,'vi'>, string>>` — base-required type: ship dần an toàn (km/lo/ms optional ở type) nhưng **TC-06 coverage** ép đủ 5 ngôn ngữ ở runtime (chốt chặn).
- `LANGS` registry single-source cho switcher + Settings Segmented + localStorage validation (`isLang`/`LANG_CODES`) → không drift.
- `LangDropdown` self-contained qua `useLang()` → bỏ prop drilling `onLang` (xem Deviation #1), encapsulation tốt hơn, ít ripple hơn threading `onSelectLang`.

## 💻 Files Changed
**i18n core:**
- ✏️ `merchant/src/lib/mp/i18n.ts` — Lang 5; Entry base-required; LANGS/LANG_CODES/isLang; t()/lab() fallback; +131 entry × km/lo/ms (Appendix A) + `lang_save_note`.
- ✏️ `merchant/src/lib/mp/lang-context.tsx` — setLang+localStorage validate via isLang; toggleLang→cycle.
- ✏️ `merchant/src/lib/mp/fmt.ts` — NF_LOCALE map 5 + `nf()` try/catch; vnd giữ " đ"; monthShort 5-lang.

**Switcher + font:**
- ✏️ `merchant/src/components/mp/ui.tsx` — `LangDropdown` mới (click-outside+Esc); Topbar pill→<LangDropdown/>; bỏ `onLang` khỏi Topbar+AppShell.
- ✏️ `merchant/src/lib/fonts.ts` — Noto_Sans_Khmer + Noto_Sans_Lao (subset khmer/lao).
- ✏️ `merchant/src/app/layout.tsx` — 2 font variable vào html className.
- ✏️ `merchant/src/app/globals.css` — nối `var(--font-khmer)`,`var(--font-lao)` vào font stacks.

**Call sites:**
- ✏️ `merchant/src/app/settings/page.tsx` — langOptions từ LANGS (5); bỏ onLang; note → `t('lang_save_note')`.
- ✏️ `merchant/src/app/dashboard/page.tsx` — bỏ onLang/toggleLang; RaceCard prop `lang: "vi"|"en"`→`Lang` (Forced #1).
- ✏️ `merchant/src/app/races/[raceId]/page.tsx` — bỏ onLang/toggleLang.

**Test:**
- ➕ `merchant/src/lib/mp/i18n.spec.ts` — 13 test (TC-01..12).
- ➕ `merchant/vitest.config.ts` — node env, alias @.
- ✏️ `merchant/package.json` — devDep `vitest`, script `test`/`test:watch` (DECISION-1).

## 🧪 Tests Written
```
> vitest run
 RUN  v4.1.8
 Test Files  1 passed (1)
      Tests  13 passed (13)
   Duration  135ms
```
TC-06 coverage loop (mọi DICT + L key × 5 lang non-empty) PASS → đảm bảo không sót bản dịch.

**Build / typecheck:**
```
tsc --noEmit → EXIT 0 (clean)
next build → ✓ Compiled successfully, 15 routes, Noto khmer/lao subsets hợp lệ
```

## 🛑 PAUSE/Confirmation log
| Date | What | Answer |
|------|------|--------|
| 2026-06-08 | vitest dev-dep | ✅ Manager DECISION-1 (đã duyệt trước, không hỏi lại) |
| 2026-06-08 | Noto font next/font/google | ✅ Manager DECISION-2 (đã duyệt) |
KHÔNG `pnpm install` dep nào khác ngoài vitest. KHÔNG đụng file ngoài `merchant/`.

## 🚧 Scope creep
- [x] Không có scope creep — mọi file trong Scope Lock plan (i18n core + switcher + font + call sites + test). RaceCard prop widen nằm trong dashboard/page.tsx (đã trong scope).

## 🐛 Known limitations / Tech debt
- **Bản dịch km/lo provisional** (Claude tạo) — cần native review trước PROD (BR-10). ms (Latin) tin cậy cao hơn.
- **Browser glyph UAT defer DEV** — shell merchant cần Logto auth, không UAT local được. Glyph Khmer/Lào render đúng đã được gián tiếp verify qua `next build` thành công (Noto subset load OK) nhưng QC PHẢI screenshot thật trên DEV (E2E-01/E2E-05).
- **Lint pre-existing:** merchant codebase có 27 lỗi eslint pre-existing F-069 (any/set-state-in-effect/`<a>`-link rải khắp login/dashboard/races/charts). `next build` (gate thật) PASS. Thay đổi của tao KHÔNG thêm category lỗi mới (lang-context set-state-in-effect y hệt bản gốc git HEAD).

## ✅ Self-Review Pipeline
- [x] Bước 1: tsc 0 (Scope Lock clean). Lint: errors pre-existing F-069, build PASS.
- [x] Bước 2: PRD adherence — 12 BR mapped; Appendix A 131 chuỗi paste verbatim; switcher journey 1+2; KHÔNG form (N/A).
- [x] Bước 3: Anti-pattern scan — 0 console.log mới, 0 `any` mới, 0 `as unknown as` trong file mình.
- [x] Bước 4: Field mapping audit — grep `.vi/.en` chỉ ra extractMsg backend-error (F-070, không liên quan Entry) + `p.ms` mili-giây (charts) → false positives, OK.
- [x] Bước 5: PROD-readiness — `next build` 15 routes OK, không MODULE_NOT_FOUND.
- [⚠️] Bước 6: UI self-inspection — DEFER browser glyph UAT to DEV (Logto-gated). Build-verified font wiring.
- [x] Bước 7: Real-world data — coverage test dùng dict thật (VN diacritics + Khmer/Lào script thật).
- [x] Bước 8: Files vs Scope Lock — 0 creep.
- [x] Bước 9: SDK regen — N/A (không đổi backend DTO).
- [x] Bước 10: Unit tests PASS (13/13 paste trên).
- [x] Bước 11: IMPLEMENTATION_NOTES.md written (4 sections).

→ Status: 🟠 READY_FOR_QC

## 🔗 Next step
Danny chạy: `/5bib-qc FEATURE-071-merchant-i18n-sea-languages`
