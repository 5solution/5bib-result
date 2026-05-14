# FEATURE-XXX: Coder Implementation Log

**Status:** 🟠 IN_PROGRESS → 🟠 READY_FOR_QC khi xong
**Started:** YYYY-MM-DD
**Author:** 5bib-fullstack-engineer
**Linked:** `00`, `01`, `02`

---

## 📌 Pre-flight check (Coder)

- [ ] Đã đọc `00-manager-init.md`
- [ ] Đã đọc `01-ba-prd.md` đầy đủ
- [ ] Đã đọc `02-manager-plan.md` — verdict APPROVED
- [ ] Đã đọc `memory/conventions.md`
- [ ] Đã đọc `memory/codebase-map.md` cho module liên quan
- [ ] Đã đọc code thật của file then chốt trong Scope Lock

---

## 🔍 Impact Assessment (Think First)

### Backend
- MongoDB: ...
- Redis: ...
- NestJS module/DI: ...

### Frontend / Admin
- Next.js cache: revalidatePath/revalidateTag?
- TanStack Query: invalidateQueries key?
- Server vs Client Component boundary?

### API Contract
- Endpoint mới → cần `pnpm generate:api`?
- DTO field rename/remove → break frontend?

---

## ⚠️ Edge Cases Covered

- [ ] [Resource not found → 404]
- [ ] [IDOR / permission missing → 403]
- [ ] [Concurrent → atomic op đảm bảo]
- [ ] [Boundary case — exact limit]
- [ ] [Failed state không có side effect]

---

## 🧠 Logic & Architecture

[Pattern chọn, trade-offs, tại sao không dùng cách khác]

---

## 💻 Files Changed

> LIỆT KÊ ĐẦY ĐỦ. Manager check ở `/5bib-deploy` xem có khớp Scope Lock không.

### Backend
- ✏️ `backend/src/modules/[...].service.ts`
- ➕ `backend/src/modules/[...].dto.ts`
- ...

### Frontend / Admin
- ➕ `admin/src/app/[...]/page.tsx`
- ✏️ `admin/src/lib/api-hooks.ts`

### SDK regenerated
- 🔄 `admin/src/lib/api-generated/types.gen.ts` (auto)
- 🔄 `admin/src/lib/api-generated/services.gen.ts` (auto)

---

## 🧪 Tests Written (BẮT BUỘC — không có = QC reject)

### Unit tests — Backend
File: `backend/src/modules/[module]/[name].service.spec.ts`

```typescript
describe('[ServiceName]', () => {
  // ... tests
});
```

**Test results:**
```
PASS backend/src/modules/[module]/[name].service.spec.ts
  ...
Tests: N passed, N total
```

### Component tests — Frontend (nếu có)

[Optional, QC sẽ làm Playwright]

---

## 🛑 PAUSE/Confirmation log

| Date | What | Danny's answer |
|------|------|----------------|
| | | |

---

## 🚧 Scope creep / Out-of-Scope changes

- [ ] Không có scope creep
- [ ] CÓ — file: `path/to/file.ts` — lý do: [...] — Manager approval: [...]

---

## 🐛 Known limitations / Tech debt còn lại

- [Cái gì chưa hoàn hảo, lý do hoãn]

---

## 🔬 Self-Review Pipeline — MANDATORY 10 bước (Manager 2026-05-14 directive)

> Coder PHẢI tự chạy đủ 10 bước self-review TRƯỚC khi mark `READY_FOR_QC`. QC giờ assume code đã pass — skip = REJECT toàn bộ implementation.
>
> Reference: Coder SKILL.md section "🔬 SELF-REVIEW CODE — MANDATORY trước khi bàn giao QC"

### Bước 1: Static Analysis Check
- [ ] `pnpm tsc --noEmit` backend exit 0 cho Scope Lock files
- [ ] `pnpm lint` clean (errors)
- [ ] `npx tsc --noEmit` admin exit 0 cho Scope Lock files

### Bước 2: PRD Strict Adherence Audit (đối chiếu code vs 01-ba-prd.md)
- [ ] Form Fields Specification table → mọi field implement đúng DTO + validation decorators
- [ ] Buttons Specification table → mọi button đúng state + action + confirm dialog
- [ ] UI Step-by-Step table → component flow match numbered steps
- [ ] Endpoint Specification table → Method/Path/Guard/Status codes implement đúng
- [ ] TC-XX Test Cases → mỗi TC có 1 `it()` block tương ứng với MUST NOT leak + Side effect verify

### Bước 3: Anti-pattern Scan
- [ ] `grep -rn 'console.log' [scope-lock-files]` → empty (trừ tests)
- [ ] `grep -rn ': any' [scope-lock-files]` → empty
- [ ] `grep -rn 'as unknown as' [scope-lock-files]` → empty
- [ ] `grep -rn 'TODO\|FIXME\|XXX' [scope-lock-files]` → empty hoặc justified

### Bước 4: Hand-pick Field Mapping Audit (F-035 LESSON)
> Khi thêm field MỚI vào schema, audit toàn codebase `.map((li) =>` để tránh field drop silent.
- [ ] `grep -rn '\.map((li) =>' backend/src/ admin/src/` — verify mọi transform bao gồm field mới
- [ ] Hoặc dùng spread pattern `{...li, ...computed_fields}` thay vì hand-pick

### Bước 5: PROD-readiness Smoke Self-Test
**Backend local:**
- [ ] Start `pnpm dev` hoặc `node dist/main` — Nest application successfully started
- [ ] curl test endpoint MỚI với fake Bearer → 401 (route mounted, KHÔNG 404)
- [ ] curl với invalid body → 400 validation
- [ ] Swagger UI `localhost:8081/swagger` → endpoint MỚI hiển thị + DTO fields đủ

**Admin local:**
- [ ] Start `pnpm dev` — Next.js Ready
- [ ] Navigate URL feature mới — render OK, KHÔNG console.error DevTools
- [ ] Trigger form/button — verify network tab request đúng method/path

### Bước 6: UI/UX Self-Inspection (browser thật)
> Mở browser navigate đến page, click qua từng state. Đối chiếu PRD UI Step-by-Step.

- [ ] Dialog/Modal width KHÔNG bị `sm:max-w-sm` 384px desktop (F-032 lesson) — test với VN long names ≥30 ký tự
- [ ] Table cell truncate + title tooltip (hover hiện full)
- [ ] Sticky header + footer trong dialog scroll — buttons KHÔNG đẩy off-screen
- [ ] VN labels Select trigger — KHÔNG raw enum `TIMING` / `CONTRACT` (Base UI render prop)
- [ ] Empty state với icon + heading + description + CTA
- [ ] Loading state skeleton/spinner, KHÔNG flash empty
- [ ] Error state toast tiếng Việt, no stack trace leak
- [ ] Success state toast + redirect/refresh
- [ ] Form validation field-level red + scroll-to-error
- [ ] Picker collapse pattern (UX-PICKER-COLLAPSE) sau pick

### Bước 7: Real-world Data Sanity
- [ ] VN long name ≥30 ký tự + diacritics: "CÔNG TY CỔ PHẦN ĐẦU TƯ THƯƠNG MẠI DỊCH VỤ XYZ VIỆT NAM"
- [ ] Money 1B+ vi-VN locale: "1.000.000.000 ₫"
- [ ] Quantity 1000+ (BIB scenarios)
- [ ] Negative margin (cost > price) — UI affordance red/warning
- [ ] Long error >200 ký tự — line-clamp/scroll cell

### Bước 8: Files Changed vs Scope Lock
```bash
git status --short | head -30
git diff --stat HEAD
```
- [ ] Mọi file modified/added HAS trong `02-manager-plan.md` Scope Lock
- [ ] KHÔNG có file ngoài Scope Lock (scope creep = dừng + hỏi Manager)
- [ ] Mọi file trong Scope Lock đã touch (KHÔNG skip declared file)

### Bước 9: Generated SDK Sync (nếu đổi backend DTO)
- [ ] `pnpm --filter admin generate:api` đã chạy
- [ ] `admin/src/lib/api-generated/` có file mới/updated
- [ ] Admin code dùng generated SDK function (KHÔNG raw fetch trừ edge cases)

### Bước 10: Unit Tests Output
- [ ] Mọi method/function logic chính có unit test
- [ ] Test output PASS paste vào section "Tests Written" ở trên
- [ ] Happy path + 3 edge case minimum + validation/error case
- [ ] Real-world data trong fixture (KHÔNG synthetic "Co A")

---

## ✅ Status

- [ ] IN_PROGRESS
- [ ] READY_FOR_QC

**Required to mark READY_FOR_QC (Manager 2026-05-14 enforcement):**
- [ ] Tất cả file trong Scope Lock đã code xong
- [ ] Unit test PASS (paste output ở trên)
- [ ] `pnpm generate:api` đã chạy nếu DTO đổi
- [ ] Không còn `console.log`, `any`, `as unknown as X`
- [ ] Lint + typecheck pass
- [ ] **Self-Review Pipeline 10 bước ABOVE — tất cả ticked** ⬆️

QC sẽ REJECT toàn bộ implementation nếu thấy self-review checklist không hoàn chỉnh hoặc rubber-stamp.

---

## 🔗 Next step

Danny chạy: `/5bib-qc FEATURE-XXX-[slug]`
