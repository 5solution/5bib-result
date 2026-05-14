# FEATURE-XXX: QC Report

**Status:** 🟢 TESTING → ✅ APPROVED / ❌ REJECTED — NEEDS_REWRITE
**Tested:** YYYY-MM-DD
**Author:** 5bib-qc-gatekeeper
**Linked:** `01-ba-prd.md`, `03-coder-implementation.md`

---

## 📌 Pre-flight check (QC)

- [ ] Đã đọc `01-ba-prd.md` để hiểu requirement gốc
- [ ] Đã đọc `03-coder-implementation.md` đầy đủ
- [ ] Đã đọc `memory/conventions.md` để biết anti-patterns
- [ ] Đã chạy unit test của Coder LOCAL → confirm PASS

---

## 🔍 Phase 1: Impact & Regression Audit

### What the Coder got right
- ...

### What the Coder MISSED (nếu có)
- ❌ [Issue] — Risk: [LOW/MEDIUM/HIGH/CRITICAL]
  Reproduce: [cách trigger]
  Fix required: [Coder phải làm gì]

---

## 🛡️ Phase 2: Security Threat Model

| Threat | Vector | Risk | Status |
|--------|--------|------|--------|
| IDOR | Manipulate :id | CRITICAL | ✅ / ❌ |
| Race condition | Concurrent POST | HIGH | ✅ / ❌ |
| Auth bypass | Logto missing | CRITICAL | ✅ / ❌ |
| Info disclosure | Sensitive field lộ | MEDIUM | ✅ / ❌ |
| Strip `_id` không alias | Frontend mất ref | HIGH | ✅ / ❌ |

---

## 🧪 Phase 3: Test Scripts (CODE THẬT)

### Backend — Jest + Supertest
File: `backend/test/[name].e2e-spec.ts`

```typescript
describe('[Feature] — E2E', () => {
  // Happy + 401/403/400/404/409/500 + IDOR + concurrency
});
```

### Frontend — Playwright
File: `admin/e2e/[name].spec.ts` hoặc `frontend/e2e/[name].spec.ts`

```typescript
test.describe('[Feature] UI', () => {
  // Happy + loading + empty + error + success states
});
```

### 10x Stability Test
```typescript
it('handles 10 concurrent — exactly N succeed', async () => {
  // Promise.all 10 requests → assert deterministic outcome
});
```

---

## 📊 Phase 4: Test execution results

```
PASS backend/test/[name].e2e-spec.ts
PASS admin/e2e/[name].spec.ts (Playwright)

Backend E2E: N/N passed
Frontend E2E: M/M passed
Concurrency 10x: PASS
```

### Performance results
| Endpoint | Target | Actual p95 | Status |
|----------|--------|-----------|--------|
| `[METHOD] /api/...` | < Xms | Yms | ✅ / ❌ |

### Cache hit ratio (nếu áp dụng)
- After warm-up: X% (target > Y%) → ✅ / ❌

---

## 🔁 Đối chiếu PRD (BR coverage)

> Tick từng Business Rule trong PRD đã được test cover.

- [ ] BR-01: ... — verified by [test name]
- [ ] BR-02: ... — verified
- [ ] ...

UI states (đối chiếu PRD Screen):
- [ ] Loading / Empty / Error / Success / ...

---

## 👤 Phase 5: Persona Journey Walkthrough — MANDATORY cho mọi feature có UI

> **Quy định Manager (2026-05-14, Danny instruction):** từ FEATURE-036 trở đi, QC report PHẢI có section này. KHÔNG được skip với lý do "feature nhỏ" — feature dù nhỏ vẫn touched user journey thực tế.
>
> Lấy danh sách personas từ `02-manager-plan.md` section "Personas affected" + bổ sung edge cases.

### Setup test prerequisites
- Test data: [list fixtures cần có để run journey — e.g. 1 partner đầy đủ, 1 partner minimal, 1 dup taxId]
- Browser/Device: [Chrome desktop ≥1280px / Safari mobile / etc — declare nếu UI-sensitive]
- Auth role: [admin / staff / public — declare per persona]

### Personas covered

> Tối thiểu 4 personas cho feature module-level (vd Contract Management). Feature nhỏ scope-locked có thể 1-2 personas — Manager Plan quyết.

#### Persona A: [Tên Persona] — [Job context]
**Journey: [Mục tiêu, vd "Tạo HĐ mới TIMING với cost ước tính"]**

| Step | User action | Expected behavior | Risk / Verify |
|------|-------------|-------------------|---------------|
| 1 | [Action concrete: click button X, type Y, navigate Z] | [What UI should show + state] | [⚠️ Specific check: dialog width ≥1280px? Cell truncate with title tooltip? Button KHÔNG bị đẩy off-screen?] |
| 2 | ... | ... | ... |

**Acceptance:** [Khi nào journey coi là PASS — concrete criteria]

#### Persona B: [Tên Persona] — [Job context]
**Journey: [Mục tiêu]**
[Same table structure]

#### Persona C: ... (repeat per persona)

### UI/UX scrutiny checklist per journey (Manager 2026-05-14)

QC PHẢI verify từng item dưới đây cho mỗi persona journey có UI:

- [ ] **Dialog/Modal width responsive** — không bị `sm:max-w-sm` shadcn default (~384px) trên desktop. Verify với real-world VN long names (≥30 ký tự + diacritics).
- [ ] **Table cell truncation + tooltip** — long content (entity names, error messages) cần `truncate` + `title` attribute (native tooltip). Verify hover hiện full content.
- [ ] **Sticky header + footer** trong scrollable dialog — buttons KHÔNG bị đẩy off-screen khi content dài.
- [ ] **VN labels** trong dropdowns (`<Select.Value>`) — KHÔNG raw enum `TIMING` / `CONTRACT` / `DRAFT`. Verify Base UI render prop pattern dùng đúng.
- [ ] **Empty state** message + CTA — khi list rỗng phải có icon + heading + description + suggest action.
- [ ] **Loading state** — skeleton hoặc spinner khi fetch, KHÔNG flash empty.
- [ ] **Error state** — toast hoặc inline error với message tiếng Việt clear, không leak stack trace.
- [ ] **Success state** — toast confirmation + redirect/refresh next state correctly.
- [ ] **Form validation feedback** — field-level error + scroll-to-error nếu validation fail.
- [ ] **Picker/Selector collapse pattern** — sau khi user select 1 item, panel ẩn → compact card + "Đổi" button. Không waste vertical space.

### Real-world data scenario verification (Manager 2026-05-14)

> Test fixture phải dùng **tên VN dài thực tế ≥30 ký tự + diacritics** + edge data (nếu module liên quan financial: số tiền lớn 1B+, quantity 1000+, margin negative).

- [ ] Tên công ty test: `CÔNG TY CỔ PHẦN ĐẦU TƯ THƯƠNG MẠI DỊCH VỤ XYZ VIỆT NAM` (≥45 ký tự)
- [ ] Email test: VN diacritic local-part nếu hợp lệ
- [ ] Money values: 1B+ VND, sử dụng `vi-VN` locale format
- [ ] Quantity edge: 1000+ items (BIB scenarios)
- [ ] Negative margin scenarios (cost > price) — verify UI affordance (red highlight, warning icon)
- [ ] Long error messages từ backend (>200 ký tự) — verify line-clamp / scroll trong cell

---

## 🚧 Tech debt còn lại sau ship

> Manager sẽ append vào `known-issues.md` ở `/5bib-deploy`.

- [Item 1]
- [Item 2]

---

## 📊 Final Verdict

> ### ✅ APPROVED — Sẵn sàng deploy

**Hoặc:**

> ### ❌ REJECTED — NEEDS_REWRITE
> Coder phải fix:
> 1. [ ] [Specific fix]
> 2. [ ] [Specific fix]

---

## 🔗 Next step

APPROVED → Danny chạy: `/5bib-deploy FEATURE-XXX-[slug]`
REJECTED → Coder fix → re-run `/5bib-qc`
