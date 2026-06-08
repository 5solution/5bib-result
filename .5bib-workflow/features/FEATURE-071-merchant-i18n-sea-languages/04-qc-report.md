# FEATURE-071: QC Report — Merchant Portal +3 ngôn ngữ ĐNA (Khmer/Lào/Mã Lai)

**Status:** ✅ APPROVED (with 2 documented post-deploy conditions — publish-gate, không block merge)
**Tested:** 2026-06-08
**Author:** 5bib-qc-gatekeeper
**Linked:** `01-ba-prd.md`, `03-coder-implementation.md`, `IMPLEMENTATION_NOTES.md`

---

## 📌 Pre-flight check
- [x] Đọc `01-ba-prd.md` (12 BR + Appendix A)
- [x] Đọc `03-coder-implementation.md` + `IMPLEMENTATION_NOTES.md` (4 sections đủ)
- [x] Đọc `memory/conventions.md`
- [x] Chạy unit test LOCAL độc lập → **13/13 PASS** (confirm, không tin claim suông)

---

## 🔍 Phase 1 — Impact & Regression Audit

### Coder got right
- **Frontend-only** xác nhận: grep 0 thay đổi backend/SDK/DB/Redis/migration. `git diff --stat` chỉ chạm `merchant/`.
- `Entry` base-required type ép `vi` ở tsc; `t()`/`lab()` fallback `e[lang]||e.vi` đúng BR-03.
- `LANGS`/`LANG_CODES`/`isLang` single-source — switcher + Settings + localStorage validate cùng nguồn, không drift.
- next/font/google Noto (no install) — `next build` PASS xác nhận subset `khmer`/`lao` hợp lệ.
- Bỏ prop `onLang` sạch — grep `onLang` = 0 sót; 3 call site cập nhật.

### What Coder MISSED
- **Không có miss chặn-ship.** Regression check: `tsc 0`, `next build` 15 routes, 0 component nào còn truyền `onLang`. RaceCard prop widen `Lang` (Forced #1) đúng + cần thiết (tsc đã bắt).
- Minor (non-blocking): lint 27 lỗi pre-existing F-069 (xác nhận qua `git show HEAD` — lang-context set-state-in-effect y hệt bản gốc). Build là gate, PASS.

---

## 🛡️ Phase 2 — Security Threat Model

| Threat | Vector | Risk | Status |
|--------|--------|------|--------|
| XSS qua chuỗi dịch | translated string → DOM | HIGH | ✅ Mitigated — grep `dangerouslySetInnerHTML` = 0; mọi `t()`/`lab()` render như text node React (auto-escape) |
| localStorage injection | `mp_lang` giá trị độc | LOW | ✅ `isLang()` whitelist 5 code; giá trị lạ → bỏ, dùng `vi` (TC-08) |
| Backend data leak qua i18n | dịch nhầm data | N/A | ✅ BR-06: chỉ UI chrome dịch, data backend render nguyên văn (không qua `t()`) |
| Auth/IDOR/SQL | — | N/A | ✅ Không endpoint, không auth change, không DB query — thuần frontend |
| PII trong localStorage | — | LOW | ✅ Chỉ lưu mã ngôn ngữ (2 ký tự), không PII |

→ Threat surface tối thiểu (frontend i18n). Clean.

---

## 🧪 Phase 3 — Test Scripts (đã có + QC adversarial bổ sung)

**Coder unit (`src/lib/mp/i18n.spec.ts`)** — 13 test TC-01..12. QC chạy lại độc lập:
```
 Test Files  1 passed (1)
      Tests  13 passed (13)   (149ms)
```

**QC adversarial #1 — Coverage net có THỰC SỰ chặn không?**
Tạm xoá `nav_revenue.km=""` → chạy test:
```
❯ src/lib/mp/i18n.spec.ts (13 tests | 2 failed)
AssertionError: expected [ 'nav_revenue.km' ] to deeply equal []
+   "nav_revenue.km"
```
✅ **Net hoạt động** — sót 1 bản dịch là đỏ ngay, chỉ đích danh key. (Đã restore.)

**QC adversarial #2 — Script-range validation (proxy glyph đúng):**
Script quét toàn dict: mọi `km` value phải chứa ≥1 codepoint Khmer (U+1780–17FF), mọi `lo` value ≥1 Lào (U+0E80–0EFF).
```
km values KHÔNG có ký tự Khmer (1):  th_pct_gmv => "% GMV"
lo values KHÔNG có ký tự Lào   (1):  th_pct_gmv => "% GMV"
```
✅ **130/131 entry đúng script**; ngoại lệ duy nhất `th_pct_gmv` ("% GMV") là acronym thuần (BR-11 cho phép). → Chứng minh: KHÔNG lẫn ký tự Thái (class bug đã bắt+fix `th_status`), KHÔNG copy nhầm vi/Latin, KHÔNG rỗng. Dịch nằm đúng khối Unicode km/lo.

---

## 📊 Phase 4 — Execution results + performance
```
vitest run         → 13/13 PASS (149ms)
tsc --noEmit       → EXIT 0 (clean)
next build         → ✓ 15 routes, Noto khmer/lao subset OK
adversarial net    → đỏ đúng key khi sót (PASS)
script-range km/lo → 130/131 đúng script (1 acronym legit)
XSS scan           → 0 dangerouslySetInnerHTML
```
**Performance:** đổi ngôn ngữ = client state (no network) <100ms (BR Perf). Bundle: +2 Noto subset (swap, lazy) — `next build` không cảnh báo size. Đạt SLA PRD.

---

## 🔁 Phase 5 — PRD Compliance (BR-01..12)

| BR | Nội dung | Verified by |
|----|----------|-------------|
| BR-01 | Lang 5 code, default vi | LANGS test ("exactly 5 codes in order") + default test TC-04 |
| BR-02 | Entry vi bắt buộc | TC-07 (loop assert vi non-empty) + tsc base-required type |
| BR-03 | Fallback lang→vi, key→raw | TC-02 (fallback vi) + TC-03 (raw key) |
| BR-04 | localStorage validate 5, lạ→vi | TC-08 (isLang reject 'zz'/null) + TC-09 (accept all) |
| BR-05 | SSR no hydration mismatch | Code: server+first paint='vi', hydrate trong useEffect (giữ pattern F-069 đã chứng minh prod) |
| BR-06 | Data backend không dịch | Phase 2 — chỉ DICT/L qua t()/lab(); data render nguyên văn |
| BR-07 | Currency VND " đ" mọi lang | TC-10 (vnd endsWith " đ" ×5) |
| BR-08 | Locale formatting; date dd/mm/yyyy | TC-11 (num locale) + TC-12 (date ×5 = 08/06/2026) |
| BR-09 | Switcher mọi trang authed | Code: LangDropdown trong Topbar (AppShell mọi page); login N/A (no shell) |
| BR-10 | km/lo provisional, review gate | ✅ FLAGGED — xem Condition #2 |
| BR-11 | Brand/acronym giữ nguyên | Script-range: th_pct_gmv "% GMV" giữ; spot-check kpi_fee "ថ្លៃសេវា 5BIB" giữ "5BIB" |
| BR-12 | Coverage 100% (đủ 5 lang) | TC-06 (loop mọi DICT+L key × 5 non-empty) + adversarial net chứng minh chặn |

→ **12/12 BR covered.** Không BR nào NOT-COVERED.

**UI states (PRD Screen 1+2):**
- [x] Default switcher (flag+short) — code Topbar trigger
- [x] Open/close (click-outside + Esc) — code LangDropdown useEffect
- [x] Select → re-render + persist — setLang via useLang + localStorage
- [x] Active ✓ highlight — code (`on` flag + Icons.Check)
- [x] Fallback state (không rỗng/raw) — TC-02/03
- [⚠️] Glyph-missing (tofu) state — xem Condition #1 (live screenshot defer)

---

## 🎭 Phase 6 — Persona Journey Walkthrough

> Feature UI = chỉ language switcher. Code-traced journey (live browser screenshot defer DEV — Condition #1).

### Persona A — BTC Campuchia (Khmer)
| # | Action | UI behavior | Verification |
|---|--------|-------------|--------------|
| 1 | Login → dashboard, click nút ngôn ngữ Topbar (🇻🇳 VI) | Popover 5 dòng xổ, VI có ✓ | Code: `setOpen(v=>!v)`, LANGS map, active ✓ |
| 2 | Click `🇰🇭 ភាសាខ្មែរ` | UI chrome đổi Khmer tức thì; data giải nguyên; menu đóng; nút→🇰🇭 KM | `setLang('km')` → context re-render; BR-06 data nguyên; `setOpen(false)` |
| 3 | Chuỗi hiển thị | nav/KPI/bảng = Khmer script đúng | Script-range: 130 km value đúng khối Khmer |
| 4 | Reload F5 | Vẫn Khmer | localStorage `mp_lang=km` + isLang hydrate (TC-08/09) |

### Persona B — BTC Lào (Lào) + Persona C — BTC Malaysia (Mã Lai)
- B: chọn `🇱🇦 ລາວ` → script Lào đúng (130 lo value đúng khối Lào). ms (Latin) tin cậy cao.
- C: vào `/settings` → Segmented 5 nút (cờ+short) → chọn 🇲🇾 → UI Mã Lai + Topbar đồng bộ. Code: `langOptions=LANGS.map(...)`, `onChange={setLang}`.

### Persona D — Back-Office Admin (fallback)
- Key thiếu km/lo (giả lập) → hiện vi, không raw/rỗng (TC-02/03). ✅

### 6.4 UI/UX Scrutiny (10 items)
- [x] Dropdown width 208px (không bị thu) — code style minWidth 208
- [x] Truncation — N/A (nhãn ngắn cờ+native)
- [x] Sticky/scroll — N/A (popover 5 dòng ngắn)
- [x] **VN/native labels không raw enum** — switcher dùng native name (Tiếng Việt/English/ភាសាខ្មែរ/ລາວ/Bahasa Melayu), KHÔNG mã thô
- [x] Empty state — N/A (switcher luôn 5 option)
- [x] Loading — `t('loading')` đổi theo lang
- [x] Error — `t('load_failed')`+`t('retry')` đổi theo lang
- [x] Success — đổi ngôn ngữ áp dụng tức thì (no toast cần, đúng UX hiện tại)
- [x] Validation — N/A (chọn enum, không nhập)
- [x] Picker collapse — dropdown đóng sau chọn (setOpen false)

### 6.5 Real-world data (6 items)
- [x] Chuỗi diacritics VN + script Khmer/Lào THẬT (không synthetic) — dict thật 131 entry
- [x] Tên giải dài/diacritics — data backend render nguyên (BR-06)
- [x] Money 1B+ — `fmt.vnd` Intl ×5 lang (TC-10/11) giữ " đ"
- [x] Quantity 1000+ — `fmt.num` grouping locale (TC-11 digit-preserve)
- [N/A] Negative margin — không áp dụng feature này
- [N/A] Long error >200 ký tự — error dùng dict key, không backend stack

---

## 🚧 Tech debt / Conditions (→ known-issues)

**Condition #1 (post-deploy, publish-gate) — Live glyph screenshot:**
Shell merchant cần Logto auth → không UAT local; merchant-dev chạy code cũ (chưa F-071). Glyph Khmer/Lào **đã verify gián tiếp 2 lớp**: (a) script-range chứng minh chuỗi đúng khối Unicode, (b) `next build` load Noto subset OK. **CẦN** screenshot thật trên DEV sau deploy (Manager/Danny smoke) xác nhận không tofu □ + layout không vỡ. Risk: LOW (Noto là font chuẩn render Khmer/Lào).

**Condition #2 (trước PROD, BR-10) — Native review nghĩa km/lo:**
km/lo do Claude tạo = **provisional**. QC chỉ verify coverage + script đúng, **KHÔNG verify nghĩa**. Danny/native review trước khi BTC Campuchia/Lào dùng PROD — ưu tiên: `kpi_net`, `kpi_fee`, `kpi_gmv`, `target_invalid`, `rev_gate_body`, `unauth_body`.

**Tech debt khác:**
- monthShort km/lo dùng "M{m}" ASCII (axis-safety) thay tên tháng bản địa — chấp nhận.
- Lint 27 lỗi pre-existing F-069 (không thuộc scope F-071).

---

## 📊 FINAL VERDICT: ✅ APPROVED

12/12 BR covered · security clean (XSS/localStorage/no-backend) · coverage net adversarially proven · script-range 130/131 đúng Unicode · tsc 0 + build 15 routes + 13/13 unit. 2 condition là **publish-gate (DEV screenshot + native review nghĩa), KHÔNG phải code defect** — nhất quán với Manager plan ("translation review là publish-gate, không block code"). Sẵn sàng `/5bib-deploy` (deploy DEV → Danny smoke glyph → native review → PROD).

## 🔗 Next step
Danny chạy: `/5bib-deploy FEATURE-071-merchant-i18n-sea-languages`
