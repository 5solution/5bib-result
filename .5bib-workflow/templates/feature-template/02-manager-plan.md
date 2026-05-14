# FEATURE-XXX: Plan Review

**Status:** 🟡 REVIEWING → ✅ APPROVED / 🟡 NEEDS_REVISION / ❌ REJECTED
**Reviewed:** YYYY-MM-DD
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check (Manager)

- [ ] Đã đọc `00-manager-init.md`
- [ ] Đã đọc `01-ba-prd.md` toàn bộ
- [ ] Đã đọc memory: `architecture.md`, `conventions.md`, `known-issues.md`
- [ ] Đã spot-check code thật cho file then chốt (nếu cần)

---

## ✓ PRD Validation Checklist

> Bất kỳ unchecked = block APPROVED.

### Completeness
- [ ] User Stories đầy đủ với Persona chuẩn
- [ ] Business Rules có ID (BR-01, BR-02, ...)
- [ ] Tất cả PAUSE conditions của Manager (file 00) đã được BA trả lời
- [ ] UI states đầy đủ (loading, empty, error, success, submitting)

### UI Detail — MANDATORY (Manager 2026-05-14 directive)
> Danny instruction: "PRD phải mô tả CHI TIẾT Step UI, các nút, các trường dữ liệu và quy định step by step". Bất kỳ unchecked = REJECT verdict.

- [ ] **UI Step-by-Step table** — mỗi journey có numbered steps với (Action / UI behavior / Trigger / Next state)
- [ ] **Buttons spec table** — mọi button có (Label / Position / Default state / Disabled / Loading / Action / Confirm dialog)
- [ ] **Form Fields Specification** — mọi input có (Name / Label / Type / Required / Validation / Error message / Default)
- [ ] **Layout description** per screen — header/body/footer cụ thể, KHÔNG vague
- [ ] **Field source table** — mỗi UI field map tới data source (MongoDB collection.field / Redis key / computed)
- [ ] **Empty state spec** — icon + heading + description + CTA cho mọi list/table

### Backend Detail — MANDATORY (Manager 2026-05-14 directive)
> Test case structured với INPUT/OUTPUT cụ thể, KHÔNG vague "happy path".

- [ ] **Endpoint spec table** — mỗi endpoint có (Method / Path / Auth / Guard / Request DTO / Response DTO / Status codes / Side effects)
- [ ] **DTO field-level spec** — mỗi field có `@ApiProperty` description + `class-validator` decorators + sample value
- [ ] **Test cases TC-XX numbered** — mỗi test case có Method / URL / Headers / Body input → Expected status / Expected body shape / MUST NOT leak / Side effect verify
- [ ] **Minimum test cases**: 1 happy + 1 validation + 1 auth + 1 IDOR + 1 conflict (409) + 1 concurrent (race) + 1 boundary (max/min)
- [ ] **Side effect verification per TC** — DB write, Redis invalidate, Audit log emit

### Personas affected — MANDATORY (Manager 2026-05-14)
> Force Manager declare personas → QC test theo. Section "Personas affected" trong file này phải fill đầy đủ.

- [ ] Primary personas list (≥1)
- [ ] Cross-cutting personas considered (end-user / acceptance / payment / bulk / edge)
- [ ] Test priority tagged 🔴/🟡/🟢

### Technical correctness vs codebase
- [ ] DB change phù hợp current schema
- [ ] Endpoint design phù hợp REST convention hiện tại
- [ ] Cache key pattern khớp Redis Keys Registry
- [ ] DTO có `@ApiProperty()` + `class-validator` đầy đủ
- [ ] Response DTO inject `id` alias TRƯỚC khi strip `_id` (nếu có)
- [ ] `pnpm generate:api` được nhắc nếu DTO đổi
- [ ] Base UI Select.Value render prop pattern nếu có dropdown (VN labels)
- [ ] Dialog override `sm:max-w-sm` nếu có modal table
- [ ] Picker collapse pattern nếu có inline picker với list

### Security
- [ ] Logto auth guard trên route protected
- [ ] IDOR check rõ (ai access được cái gì)
- [ ] Sensitive field KHÔNG lộ trong public response (draft data, internal IDs)

### Performance
- [ ] SLA có số cụ thể (p95 < Xms)
- [ ] Cache strategy có TTL + invalidate logic
- [ ] Migration plan cho data lớn (nếu có)

### Testability
- [ ] Unhappy paths cụ thể (status code + body)
- [ ] Concurrency test scenario
- [ ] 10x flaky test plan cho critical path

---

## 📊 Cross-check với memory

### Architecture impact
[Feature có tạo node mới? Break integration nào không?]

### Convention impact
[Pattern mới chưa có trong `conventions.md`?]

### Known issues impact
[Đụng vùng có Known issue? Có resolve được không?]

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ được đụng các file/folder dưới đây. Đụng ngoài = scope creep, hỏi Manager.

**Backend:**
- ✏️ `backend/src/modules/[module]/[file].ts` — [lý do]
- ➕ `backend/src/modules/[module]/[new-file].ts` — file mới

**Admin / Frontend:**
- ➕ `admin/src/app/[route]/page.tsx`
- ➕ `admin/src/components/[name].tsx`

**Tests:**
- ➕ `backend/src/modules/[module]/[name].service.spec.ts` — unit tests

---

## 🔧 Tech approach (đề xuất, Coder có thể tinh chỉnh)

- [Pattern, lib, lý do]
- [Atomic op? Lock? Cache invalidation?]

---

## 🛑 PAUSE points cho Coder

- 🛑 Trước khi chạy migration trên prod
- 🛑 Trước khi `pnpm install` package mới
- 🛑 Nếu cần đụng file ngoài Scope Lock → hỏi Manager update plan

---

## 🧪 Unit test BẮT BUỘC

Coder không được mark `READY_FOR_QC` nếu thiếu:

- [ ] [Method] — happy path
- [ ] [Method] — edge case 1
- [ ] [Method] — edge case 2
- [ ] [Method] — edge case 3
- [ ] DTO validation: rejects [invalid input]

---

## 👤 Personas affected — MANDATORY (Manager 2026-05-14 rule)

> **Manager PHẢI declare personas list để QC test theo.** Quy định ban hành theo Danny instruction sau session 2026-05-14 (cowboy workflow + UI bugs missed QC). Bất cứ feature có UI nào KHÔNG declare personas → REJECT verdict.

### Primary personas (ai sẽ chạm feature này)

- **[Persona 1 name]** — [Job context, vd "Sales Admin (Hằng)"] — journey: [primary use case]
- **[Persona 2 name]** — [Job context] — journey: [secondary use case]
- **[Persona 3 name]** — [Job context, optional nếu feature module-wide]

### Cross-cutting personas (luôn phải xem xét)

- **End-user impact** — [Persona 4 nếu feature touched public-facing endpoint]
- **Acceptance/Payment lifecycle** — [nếu feature đụng contract/order state machine]
- **Bulk operations** — [nếu data scale 100+ records]
- **Edge cases owner** — [admin override, force-edit, deletion flows]

### Manager's persona test priority

> QC `04-qc-report.md` Phase 5 sẽ verify từng persona journey numbered step-by-step. Mỗi step có UI/UX scrutiny per checklist (dialog width, table truncation, sticky header/footer, VN labels, empty/loading/error/success states).

- 🔴 **Critical persona** (must test exhaustive): [list]
- 🟡 **Important persona** (must test happy path + 2 edge cases): [list]
- 🟢 **Optional persona** (smoke test): [list]

---

## 📊 Verdict

> ### ✅ APPROVED — Coder có thể bắt đầu

**Hoặc:**

> ### 🟡 NEEDS_REVISION — BA fix:
> 1. [Specific gap]
> 2. [Specific gap]

> ### ❌ REJECTED — Lý do nghiêm trọng: [...]

---

## 🔗 Next step

APPROVED → Danny chạy: `/5bib-code FEATURE-XXX-[slug]`
NEEDS_REVISION → BA chạy lại `/5bib-prd` với fix
