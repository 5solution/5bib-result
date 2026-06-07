# FEATURE-069 M3: Admin UI — Gán quyền Merchant Portal

**Status:** 🟡 INITIATED
**Created:** 2026-06-05
**Owner:** Danny
**Type:** EXTEND_EXISTING (admin frontend — first UI slice of F-069; backend reporting layer đã COMPLETE 100%)
**Created by:** 5bib-manager

---

## 🎯 Why this milestone

Backend F-069 đã xong 20 endpoint (7 admin M2a + 13 merchant M2b/M2c) nhưng **chưa có UI nào** ⇒ chưa admin nào gán nổi quyền cho 1 merchant thật ⇒ toàn bộ backend mới verify qua SQL + 401-guard, **chưa chạy qua luồng auth merchant thật**. M3 dựng màn `/admin/merchant-portal` để 5BIB Back-Office gán/sửa/gỡ quyền xem report cho user BTC. Đây là tiền đề **bắt buộc** để M4 (merchant frontend) test E2E được.

---

## 📂 Impact Map (theo memory + code thật đã spot-check)

### Module sẽ chạm — CHỈ admin frontend, KHÔNG đụng backend
- `admin/src/app/(dashboard)/merchant-portal/` — NEW route group (list + dialog create/edit)
- `admin/src/lib/nav-groups.ts` — thêm 1 NavItem vào nhóm phù hợp (xem PAUSE #1)
- `admin/src/lib/api-generated/` — regenerate SDK (`pnpm generate:api`) để có 7 endpoint admin
- `admin/src/lib/merchant-portal-labels.ts` — NEW dictionary VN (permission tier, status) — Display Convention

### Backend = READ-ONLY (KHÔNG sửa)
7 endpoint M2a (đã verified, prefix `/api/admin/merchant-portal`, guard `LogtoAdminGuard`):
| Method | Path | Dùng cho |
|--------|------|----------|
| GET | `/access` | List (paginated, filter q/tenantId/permissionFilter/statusFilter) |
| GET | `/access/:id` | Detail (prefill edit dialog) |
| POST | `/access` | Tạo config mới |
| PATCH | `/access/:id` | Sửa config |
| DELETE | `/access/:id` | Xoá cứng (có confirm) |
| GET | `/logto-lookup?q=` | Tra user Logto theo email/userId → prefill userName+email |
| GET | `/audit-log` | M2b stub (trả empty) — M3 **KHÔNG** render tab này (chờ backend thật) |

### DTO contract (đã đọc `access-config.dto.ts` + `logto-lookup.dto.ts`)
- **Create body:** `userId` (req, ≥3), `userName` (req), `email` (req, valid), `tenantIds?: number[]`, `raceOverrides?: {include?: number[], exclude?: number[]}`, `permissions: ('ticket_report'|'revenue_report')[]` (req, ≥1, **phải có `ticket_report`**), `isActive?` (default true).
- **Ràng buộc nghiệp vụ (BR-MP-33):** `tenantIds[]` HOẶC `raceOverrides.include[]` phải có ≥1 (không được rỗng cả hai). `revenue_report` đứng một mình KHÔNG hợp lệ — luôn kèm `ticket_report`.
- **List item:** thêm `raceCount: number | '__all'` (sentinel `'__all'` → label "Tất cả giải") + `tenantNames: string[]` (đã denormalized — render badge KHÔNG cần roundtrip).
- **Response strip pattern:** `_id` → alias `id` (BR-MP-23). KHÔNG có `_id` raw.
- Error message backend đã tiếng Việt sẵn — frontend hiển thị trực tiếp `error.message`.

### Schema/DB/Redis
- KHÔNG đụng. M3 thuần frontend consume SDK.

---

## ⚠️ Risk Flags

- 🟡 **MED — Display Convention:** `permissions` (`ticket_report`/`revenue_report`) + `statusFilter` (`active`/`inactive`) + `permissionFilter` (`ticket_only`/`ticket_and_revenue`) là enum English. PHẢI map qua `merchant-portal-labels.ts`, KHÔNG render raw trong JSX text (grep enforcement sau code).
- 🟡 **MED — tenantIds là MySQL platform ID (number), KHÔNG phải Mongo race id.** Picker phải lấy đúng nguồn tenant (xem PAUSE #2). Nhầm nguồn = gán sai BTC = leak data cross-tenant — nguy hiểm nhất milestone này.
- 🟡 **MED — `raceOverrides` (include/exclude race id) là UX phức tạp.** Cần quyết mức độ làm ở v1 (xem PAUSE #3) để Coder không over-engineer.
- 🟢 **LOW — `pnpm generate:api`** phải chạy trước khi code (SDK chưa chắc có 7 endpoint M2a). Nếu thiếu → 404 silent.
- 🟢 **LOW — `logto-lookup` có thể trả 503** khi Logto Management API unreachable → UI phải cho nhập tay userName+email (graceful), KHÔNG block form.

---

## 🚧 PAUSE Conditions — cần Danny chốt TRƯỚC khi Coder code

- [ ] **#1 — Vị trí menu sidebar:** thêm NavItem vào nhóm nào trong `nav-groups.ts`? Đề xuất nhóm **"Vận hành"** (cạnh `merchants`) hoặc tạo nhóm con. `requireRole: "admin"`? (gán quyền là hành động nhạy cảm → tao đề xuất YES).
- [ ] **#2 — Nguồn tenant picker:** reuse component nào? Codebase đã có `contracts/_components/tenant-picker.tsx` + `race-mysql-picker.tsx` (đều query MySQL platform). Tao đề xuất **reuse `tenant-picker.tsx`** cho `tenantIds` để khỏi dựng mới. Confirm?
- [ ] **#3 — Mức độ `raceOverrides` ở v1:** (a) Làm đầy đủ include+exclude race picker ngay M3, hay (b) v1 chỉ gán theo `tenantIds` (toàn bộ giải của tenant), defer race-override sang M3b? Tao đề xuất **(b)** — đa số BTC chỉ cần full tenant; override là edge case agency cross-tenant.
- [ ] **#4 — Có cần test luồng auth merchant thật trong M3 không?** Tức sau khi gán quyền, có mint 1 Logto merchant token rồi gọi thử 13 endpoint merchant để đóng cái "chưa test auth thật" tao tự nhận lúc nãy? (Khuyến nghị: CÓ, ít nhất 1 smoke E2E — biến "backend complete" thành "backend verified-through-auth").

---

## 📋 Scope Lock (dự kiến — chốt chính thức ở 02-manager-plan sau khi Danny trả lời PAUSE)

**Admin frontend (chỉ trong scope):**
- ➕ `admin/src/app/(dashboard)/merchant-portal/page.tsx` — list (table + filter + pagination + empty/loading/error states)
- ➕ `admin/src/app/(dashboard)/merchant-portal/_components/access-form-dialog.tsx` — create/edit (Logto lookup + tenant picker + permission toggle + status)
- ➕ `admin/src/app/(dashboard)/merchant-portal/_components/access-list-table.tsx`
- ➕ `admin/src/app/(dashboard)/merchant-portal/_components/permission-badge.tsx` + empty-state
- ➕ `admin/src/lib/merchant-portal-labels.ts` — dict VN
- ✏️ `admin/src/lib/nav-groups.ts` — +1 NavItem (theo PAUSE #1)
- 🔄 `admin/src/lib/api-generated/*` — regenerate (auto)

**KHÔNG đụng:** bất kỳ file `backend/`, các module admin khác, SDK thủ công.

---

## 🧪 Test mandate (sơ bộ — chi tiết hoá ở plan)
- E2E Playwright: tạo config happy-path / validation fail (thiếu tenant + thiếu ticket_report) / duplicate userId 409 / edit / delete confirm / Logto lookup prefill + lookup-fail nhập tay.
- States: loading skeleton / empty / filtered-empty / error toast / submitting / success toast.
- (Nếu PAUSE #4 = CÓ) 1 smoke: gán quyền → token merchant → GET `/api/merchant-portal/me` 200 + `/races` đúng scope.

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [ ] **Chưa** — cần Danny trả lời 4 PAUSE ở trên (đặc biệt #2 nguồn tenant + #3 phạm vi raceOverrides). Trả lời xong → BA viết `01-ba-prd-m3.md` với Form Fields + Buttons + UI Step tables.
- Nếu Danny muốn skip BA (như các slice trước) → tao chuyển thẳng init này thành `02-manager-plan-m3.md` với Scope Lock chốt + giao Coder.

---

## 🔗 Next step
Danny chốt 4 PAUSE → tao mở plan/PRD M3.
