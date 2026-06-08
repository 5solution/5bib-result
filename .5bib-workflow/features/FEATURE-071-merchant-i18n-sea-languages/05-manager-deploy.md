# FEATURE-071: Deploy & Memory Sync

**Status:** ✅ DONE (memory synced + committed) — DEV deploy chờ Danny duyệt push (git policy)
**Deployed:** 2026-06-08
**Author:** 5bib-manager
**Linked:** `00`, `01`, `02`, `03`, `04`, `IMPLEMENTATION_NOTES`

---

## 📌 Pre-flight check
- [x] `04-qc-report.md` = ✅ APPROVED (2 condition = publish-gate, không block code)
- [x] Unit test 13/13 PASS (QC chạy lại độc lập confirm)
- [x] File `03` khớp Scope Lock `02` — 0 scope creep (RaceCard widen nằm trong dashboard scope)
- [x] `IMPLEMENTATION_NOTES.md` đủ 4 sections (Deviations 2 + Forced 3 + Tradeoffs 5 + Reviewer Notes)

## 📊 Deploy summary
- QC verdict: ✅ APPROVED
- Unit: 13/13 vitest · tsc 0 · next build 15 routes · adversarial coverage-net + script-range 130/131 + XSS 0
- Migration: N/A (frontend-only)
- Scope: 9 file `merchant/` + i18n.spec.ts + vitest.config + package.json

---

## 🔬 Manager Independent Code Review (đọc code thật 5 hotspot)

| # | File + range | Verify | Verdict |
|---|--------------|--------|---------|
| 1 | `i18n.ts:16` Entry + `:214-253` t()/lab() | `Entry={vi}&Partial<Record<Exclude<Lang,'vi'>,string>>` base-required; `t`/`lab` `e[lang]\|\|e.vi` + raw-key on miss (BR-03); LANGS 5 code đúng thứ tự | ✅ CLEAN |
| 2 | `ui.tsx:186-290` LangDropdown | useLang(); click-outside (mousedown+ref.contains) + Esc; **cleanup removeEventListener** (no leak); setLang+setOpen(false); active ✓ Icons.Check | ✅ CLEAN |
| 3 | `fmt.ts:9-32` NF_LOCALE + nf()+vnd | map 5 locale + `nf()` try/catch fallback vi-VN; `vnd` `+ " đ"` giữ mọi lang (BR-07) | ✅ CLEAN |
| 4 | `settings/page.tsx:72,91` | langOptions = LANGS.map; Segmented onChange={setLang}; KHÔNG còn onLang | ✅ CLEAN |
| 5 | `fonts.ts:46-55` + `globals.css:546-547` | Noto Khmer/Lao subset khmer/lao; stack append `var(--font-khmer/lao)` cuối (Latin/VN không đổi) | ✅ CLEAN |

**Deviations đối chiếu BR (Section 1 IMPLEMENTATION_NOTES):**
- Deviation #1 (LangDropdown self-contained useLang, bỏ onLang) — KHÔNG đụng BR tài chính/auth/fee. Plan cho phép "Coder tinh chỉnh". ✅ Accept.
- Deviation #2 (lang_save_note dict key) — cải thiện coverage (đủ 5 lang), đúng convention. ✅ Accept.
- Forced #1 (RaceCard prop widen `Lang`) — cần thiết, tsc bắt. ✅ Accept.

**Findings:** Green hết. KHÔNG red flag (0 logic sai BR, 0 type bypass nguy hiểm, 0 SQL/auth — N/A frontend, 0 cache hook miss — N/A). Type safety: 0 `any`/`as unknown as` mới; `isLang(v:unknown):v is Lang` type guard chuẩn.

**Verdict per-feature:** ✅ APPROVED FOR DEPLOY.

---

## 📝 Memory diff (đã apply)

### `feature-log.md`
- ✏️ Counter blurb FEATURE-071 🟡 INITIATED → ✅ DEPLOYED
- ➕ Shipped table row F-071 (full detail)

### `change-history.md`
- ➕ Entry [2026-06-08] FEATURE-071 full (files + 2 pattern minted + 3 TD + lessons) ở TOP

### `conventions.md`
- ➕ Section "i18n patterns (F-071)": (1) fallback-to-base-locale + coverage-as-test; (2) next/font multi-script stacking; (3) script-range validation (QC tool). + anti-pattern `{vi,en}` cứng.

### `known-issues.md`
- ➕ TD-F071-GLYPH-UAT (publish-gate), TD-F071-TRANSLATION-NATIVE-REVIEW (publish-gate BR-10), TD-F071-MONTHSHORT-KM-LO (LOW)
- ➕ Quirk: merchant 27 lint pre-existing + i18n data-không-dịch rule

### `architecture.md` / `codebase-map.md`
- (No change) — feature thuần frontend i18n, không thêm node/integration/file-then-chốt backend.

---

## 🚀 Deploy plan (CHỜ DANNY DUYỆT PUSH — git policy)

Feature frontend-only `merchant/`. Deploy DEV = push `main` → CI `build-and-deploy.yml` build merchant image → VPS DEV `5bib-result-merchant` (port 3089).

**Theo git-push policy (memory): KHÔNG push main khi chưa có Danny duyệt rõ ràng.**
→ Manager đã commit local main, chờ Danny "ok push" rồi mới đẩy.

**Sau push + CI deploy DEV:**
1. Danny smoke `merchant-dev.5bib.com`: đổi 🇰🇭/🇱🇦/🇲🇾 → verify glyph render (không tofu □) + layout không vỡ (close TD-F071-GLYPH-UAT).
2. Native review nghĩa km/lo (close TD-F071-TRANSLATION-NATIVE-REVIEW) trước PROD.
3. PROD: cut `release/v*` (cùng cơ chế F-070) khi Danny duyệt.

---

## 🔮 Follow-up
- i18n core giờ scale N-ngôn-ngữ — thêm ngôn ngữ mới chỉ cần +entry `LANGS` + đổ bản dịch + (nếu phi-Latin) +Noto font. Không refactor nữa.
- Pattern coverage-as-test + script-range nên port sang admin/frontend nếu các app đó đa-ngôn-ngữ hoá sau này.

## ✅ Status
🎉 **FEATURE-071 DONE** — memory synced, code committed. Chờ Danny duyệt push → DEV.
