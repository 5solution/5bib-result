# FEATURE-069 M3: Plan Review — Admin UI Gán quyền Merchant Portal

**Status:** ✅ APPROVED (Danny chốt 4 PAUSE 2026-06-05, skip BA — Manager init→plan trực tiếp như các slice trước)
**Reviewed:** 2026-06-05
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init-m3.md`

---

## ✅ Danny's PAUSE decisions (chốt)
| # | Quyết định |
|---|-----------|
| #1 | Menu: nhóm **"Vận hành"** trong `nav-groups.ts`, cạnh `merchants`, **`requireRole: "admin"`** |
| #2 | Tenant picker: **reuse nguồn data + UI search của `contracts/_components/tenant-picker.tsx`** |
| #3 | `raceOverrides`: **v1 CHỈ gán theo `tenantIds`** — defer include/exclude race-override sang M3b |
| #4 | **CÓ** smoke-test luồng auth merchant thật cuối M3 (đóng gap "backend chưa verified-through-auth") |

---

## ✓ Validation checklist
- [x] 7 endpoint M2a tồn tại đúng path/guard (Manager đọc `merchant-portal-admin.controller.ts` L57-211)
- [x] DTO field khớp (đọc `access-config.dto.ts` + `logto-lookup.dto.ts`) — `id` alias, `raceCount`/`tenantNames` denormalized, error VN sẵn
- [x] Nav convention khớp (`nav-groups.ts` — NavItem type có `requireRole: "admin"`)
- [x] Display Convention: enum → `merchant-portal-labels.ts` (bắt buộc)
- [x] KHÔNG đụng backend / KHÔNG breaking change
- [x] SDK regenerate cần thiết (`pnpm generate:api`)

### ⚠️ Manager spot-check phát hiện
- **`TenantPicker` hiện là SINGLE-select** (`value: number | null`, `onChange(id, tenant)`). M3 cần **MULTI** (`tenantIds: number[]`). → Coder **KHÔNG** dùng trực tiếp; build `tenant-multi-picker.tsx` mới TÁI SỬ DỤNG cùng **nguồn data + endpoint search tenant** mà `TenantPicker` đang gọi (chips + remove). Đây là cách hiểu đúng PAUSE #2 ("reuse nguồn", không phải "reuse component as-is").

---

## 📋 Scope Lock — Coder CHỈ được đụng các file sau

**Admin frontend:**
- ➕ `admin/src/app/(dashboard)/merchant-portal/page.tsx` — list page (Client Component, TanStack Query qua SDK)
- ➕ `admin/src/app/(dashboard)/merchant-portal/_components/access-list-table.tsx`
- ➕ `admin/src/app/(dashboard)/merchant-portal/_components/access-form-dialog.tsx` — create+edit (1 dialog 2 mode)
- ➕ `admin/src/app/(dashboard)/merchant-portal/_components/tenant-multi-picker.tsx` — multi-select chips (reuse data source của TenantPicker)
- ➕ `admin/src/app/(dashboard)/merchant-portal/_components/logto-lookup-field.tsx` — tra Logto + prefill, graceful 503 → nhập tay
- ➕ `admin/src/app/(dashboard)/merchant-portal/_components/permission-badge.tsx`
- ➕ `admin/src/app/(dashboard)/merchant-portal/_components/empty-state.tsx`
- ➕ `admin/src/lib/merchant-portal-labels.ts` — dict VN
- ✏️ `admin/src/lib/nav-groups.ts` — +1 NavItem (nhóm "Vận hành", `requireRole: "admin"`)
- 🔄 `admin/src/lib/api-generated/*` — regenerate (auto, KHÔNG sửa tay)

**KHÔNG đụng:** mọi file `backend/`, module admin khác, các route F-069 khác.

---

## 🔧 Tech approach

### merchant-portal-labels.ts (Display Convention)
```ts
export const MP_PERMISSION_LABEL = { ticket_report: 'Báo cáo vé', revenue_report: 'Báo cáo doanh thu' } as const;
export const MP_PERMISSION_TIER_LABEL = { ticket_only: 'Chỉ báo cáo vé', ticket_and_revenue: 'Vé + Doanh thu' } as const;
export const MP_STATUS_LABEL = { active: 'Đang hoạt động', inactive: 'Đã khóa' } as const;
```
Render: `{MP_PERMISSION_LABEL[p] ?? p}`. Sau code: grep `\b[a-z]+_report\b` + `active|inactive` trong JSX text phải rỗng.

### Form dialog (create/edit)
- **Logto lookup field:** nhập email/userId → debounce 300ms → GET `/logto-lookup` → found → prefill `userName`+`email` readonly-ish (cho sửa); 503/not-found → cho nhập tay (KHÔNG block submit).
- **Permission toggle:** `ticket_report` mặc định ON + **disabled** (luôn bắt buộc, BR-MP-33); `revenue_report` checkbox optional. UI gửi `permissions: ['ticket_report'(, 'revenue_report')]`.
- **Tenant multi-picker:** chips; submit `tenantIds: number[]`.
- **Client-side validate trước submit:** `tenantIds.length ≥ 1` (v1 bỏ raceOverrides nên đây là điều kiện scope duy nhất) — nếu rỗng disable nút + helper "Chọn ít nhất 1 BTC". Backend vẫn validate lại (defense-in-depth).
- **isActive:** Switch, default true.
- Edit mode: GET `/access/:id` prefill; `userId` readonly (immutable key).

### List page
- Table cột: Tên user / Email / BTC (badge `tenantNames`) / Số giải (`raceCount`, `'__all'`→"Tất cả giải") / Quyền (badge) / Trạng thái / Actions (Sửa, Xóa).
- Filter: q (search), tenantId, permissionFilter, statusFilter. Pagination (page/pageSize).
- States bắt buộc: loading skeleton / empty (CTA "Gán quyền mới") / filtered-empty / error toast / submitting / success toast.
- Delete: `useConfirm()` destructive — "Gỡ quyền của {userName}?".

### Data fetching
- TanStack Query qua **generated SDK** (KHÔNG raw fetch). Mutation onSuccess → `invalidateQueries` list key.

---

## 🛑 PAUSE points cho Coder
- 🛑 **Chạy `pnpm generate:api` ĐẦU TIÊN** — verify 7 endpoint M2a có trong `api-generated/sdk.gen.ts`. Nếu thiếu → backend chưa expose Swagger đúng → báo Manager, KHÔNG tự fetch tay.
- 🛑 KHÔNG `pnpm install` dep mới (multi-picker/chips dùng shadcn/ui sẵn có).
- 🛑 Đụng file ngoài Scope Lock → dừng hỏi Manager.

## 🧪 Test mandate (QC sẽ check)
**Component/E2E (Playwright):**
- Tạo happy-path (Logto prefill + chọn ≥1 tenant + submit → success toast + list refresh)
- Validation: submit thiếu tenant → nút disabled / không gọi API
- Duplicate userId → backend 409 → toast VN, form giữ data
- Logto lookup 503 → field cho nhập tay, submit vẫn được
- Edit prefill + update; Delete confirm
- States: loading/empty/filtered-empty/error/submitting/success
**Smoke auth (PAUSE #4 — BẮT BUỘC, đóng feature M3):**
- Gán quyền 1 user Logto thật (hoặc seed) → mint token merchant → `GET /api/merchant-portal/me` 200 + `/api/merchant-portal/races` trả đúng scope tenant vừa gán. Ghi kết quả vào `03`/`IMPLEMENTATION_NOTES-m3.md`. Đây là lần đầu backend F-069 chạy qua luồng auth merchant thật.

## 🧪 Display Convention grep (Self-Review Bước 3 mở rộng)
Coder grep `\b[A-Z_]{3,}\b` + `_report` + `active|inactive` trong JSX text của các file M3 — phải nằm trong `value=`/type/comparison, KHÔNG trong JSX text.

---

## ✅ Sẵn sàng cho `/5bib-code`?
- [x] **Yes** — Scope Lock chốt, 4 PAUSE Danny đã quyết, tech approach rõ. Coder bắt đầu với `pnpm generate:api` trước.

## 🔗 Next step
Danny chạy: `/5bib-fullstack-engineer FEATURE-069 M3`
