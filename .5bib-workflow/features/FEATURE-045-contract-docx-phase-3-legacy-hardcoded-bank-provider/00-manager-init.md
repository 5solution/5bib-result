# FEATURE-045: Contract DOCX Phase 3 — Legacy Hardcoded Bank Account + Provider Name Fix

**Status:** 🟡 INITIATED — ACTIVE (Danny chốt Option B 2026-05-19: ship combined F-044+F-045 single release)
**Created:** 2026-05-19
**Owner:** Danny
**Type:** BUGFIX (MED severity — provider data leak for non-5BIB providers)
**Created by:** 5bib-manager (post F-044 content review)
**Strategy:** Combined F-044+F-045 single shot push. F-044 code-level DONE. F-045 sẽ ship CÙNG release branch (1 merchant communication cycle, 1 regen batch combined F-042+F-044+F-045).

---

## 🎯 Why this feature

Trong F-044 Manager content review 2026-05-19, render verify với fixture realistic phát hiện **5 lớp hardcoded data** trong template — KHÔNG thuộc F-044 scope (F-044 chỉ fix contract number + in-words + placeholder typo), nhưng cần track để fix sớm.

### Legacy hardcoded inventory (from F-044 content review)

| Template | Hardcoded data | Phải đổi thành |
|----------|---------------|----------------|
| `acceptance-racekit.docx` + `acceptance-timing.docx` | `Tài khoản: 110398986 - tại MB chi nhánh Thụy Khuê` (3 vị trí) | `{provider.bankAccount}` + `{provider.bankName}` |
| `acceptance-racekit.docx` + `acceptance-timing.docx` | `ĐẠI DIỆN BÊN B CÔNG TY CỔ PHẦN 5BIB` + footer + "Đề nghị thanh toán" | `{provider.entityName}` |
| `acceptance-timing.docx` | Câu mở đầu BBNT "giữa [merchant] và **Công ty Cổ phần 5BIB** về **dịch vụ tính giờ**" | `{provider.entityName}` + dynamic service label |
| `acceptance-operations.docx` | `Tài khoản: 111213998 - tại MB chi nhánh Hai Bà Trưng` | Same as above |
| `contract-ticket-sales.docx` | `Tài khoản số : 110398986 tại Ngân hàng TMCP Quân Đội (MB) – Chi nhánh Thụy Khuê – Chủ tài khoản: CONG TY CO PHAN 5BIB` | Same |

### Severity

🟡 **MED** — Cho 5BIB-provider contracts, các hardcoded value tình cờ đúng (vì 5BIB thật sự dùng tài khoản này). Bug exposed khi:
- Provider = 5SOLUTION (multi-provider design F-024) → DOCX hiển thị 5BIB info sai
- Số tài khoản 5BIB đổi → mọi DOCX in cũ vẫn hiển thị số cũ
- Tên chi nhánh ngân hàng thay đổi → giống case trên

Không invalid pháp lý ngay như F-044 bug #1, nhưng làm mất uy tín + risk data leak.

---

## 📂 Impact Map

### Files sẽ chạm (5 templates)
- `backend/assets/contract-templates/contract-ticket-sales.docx`
- `backend/assets/contract-templates/acceptance-timing.docx`
- `backend/assets/contract-templates/acceptance-racekit.docx`
- `backend/assets/contract-templates/acceptance-operations.docx`
- (Verify) `backend/assets/contract-templates/contract-timing.docx` — có thể cũng có hardcoded similar

### Audit script extension
- `backend/scripts/audit-template-placeholders.ts` — add regex pattern:
  - Bank account hardcoded: `\b1[0-9]{8}\b` (9-digit account number pattern matching 5BIB samples)
  - Bank branch hardcoded: `Chi nhánh (Thụy Khuê|Hai Bà Trưng|Cầu Giấy|...)` 
  - Provider name hardcoded: `CÔNG TY CỔ PHẦN 5BIB` / `CONG TY CO PHAN 5BIB`

### NO DB schema change, NO migration

---

## ⚠️ Risk Flags

- 🟡 **MED — multi-provider regression** Provider = 5SOLUTION đang in DOCX với 5BIB info sai
- 🟡 **MED — bank info update sync** Khi 5BIB đổi tài khoản, template phải re-render lại (giờ hardcoded → manual edit + redeploy)
- 🟢 **LOW — backward compat** Sau fix, fixture realistic Provider data đảm bảo render đúng

---

## 🚧 PAUSE Conditions cần BA xác nhận

- [ ] Service label dynamic: `dịch vụ tính giờ` / `vận hành racekit` / etc cho câu mở đầu BBNT — có muốn placeholder hay vẫn hardcode per template? Đề xuất: keep hardcoded per template (TIMING template = "dịch vụ tính giờ" hardcode), vì template name đã xác định service.
- [ ] Audit regex để catch hardcoded entity name — pattern phải chính xác để KHÔNG false-positive với placeholder default articles (admin có thể edit và lưu entity name).

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] **YES** — Danny chốt Option B 2026-05-19: combined F-044+F-045 single shot push. BA bắt đầu PRD.
- 📝 **Note for BA:**
  - Pattern reuse F-044 fix_templates_f044.py (XML manipulation extract → replace → repack)
  - Backup convention: `.backup/<type>-20260519-pre-f045.docx`
  - Reuse F-044 Manager render verify spec pattern — extend `f044-manager-render-verify.spec.ts` để cover F-045 cases (provider=5BIB vs 5SOLUTION variants for multi-provider verification)
  - Reuse F-044 audit script regex pattern extension protocol — add Class 5 (bank account hardcoded pattern) + Class 6 (provider name "CÔNG TY CỔ PHẦN 5BIB" exact match)
  - DOCX Content Review Protocol (F-044 lesson) MANDATORY — render verify với asymmetric data + multi-provider fixture

---

## 🎯 Combined deploy strategy (Option B chốt 2026-05-19)

1. **F-044** code-level DONE (worktree `funny-kirch-90e777`, branch `feat/F-044-contract-docx-phase-2`)
2. **F-045 sẽ implement TIẾP TỤC trên cùng branch** (rename branch → `feat/F-044-F-045-contract-docx-phase-2-3` hoặc giữ tên cũ + amend)
3. **Single push → single release** branch `release/v1.8.8` cover cả 2 features
4. **Single regen batch** = combined F-042 + F-044 + F-045 audit script catches superset → 1 merchant communication cycle
5. **Finance team coordination** — F-044 deploy + F-045 ship đồng thời, merchant nhận corrected DOCX 1 lần duy nhất

---

## 🔗 Next step

Danny chạy: `/5bib-prd FEATURE-045-contract-docx-phase-3-legacy-hardcoded-bank-provider`

BA agent sẽ:
1. Đọc 00-manager-init.md đầy đủ
2. Extract document.xml × 5 templates (acceptance-racekit, acceptance-timing, acceptance-operations, contract-ticket-sales, + verify contract-timing) → exact position mapping cho 5 hardcoded inventory items
3. Output `01-ba-prd.md` với:
   - 6 PAUSE answers (service label dynamic, audit regex precision)
   - Mapping Tables for 5 templates
   - 10+ TC-45-XX (5BIB provider + 5SOLUTION provider variants)
   - Audit script extension spec (Class 5+6)
   - Test fixture matrix với multi-provider
4. Estimate Coder workload: ~2-3h (pattern reuse F-044 fast)

ETA F-045 total: ~4-5h từ /5bib-prd → /5bib-deploy.
