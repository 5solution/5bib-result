# 5BIB Result — Claude Code Context

## Đọc ngay trước khi làm bất kỳ điều gì

- Đọc file này toàn bộ
- Đọc `TODO.md` để biết task hiện tại
- Đọc `admin/AGENTS.md` trước khi viết code cho admin frontend
- Đọc `backend/` module liên quan trước khi viết backend code

---

## Project Overview

Platform quản lý kết quả chạy bộ & admin 5BIB.

| Layer | Path | Stack |
|---|---|---|
| Admin Frontend | `admin/` | Next.js 16.2.1, React 19, TypeScript, shadcn/ui, pnpm |
| Backend API | `backend/` | NestJS, MongoDB (Mongoose), Redis, JWT auth |
| Frontend (public) | `frontend/` | React/Vite (race result website) |

Backend chạy ở port `8081`. Admin frontend proxy mọi `/api/*` request → `BACKEND_URL`.

---

## Active Feature Specs (đọc trước khi code P3 hoặc P2)

- **P3 Merchant Management**: `~/Desktop/Claude/5BIB_Spec_MerchantManagement.md`
- **P2 Đối soát tự động**: `~/Desktop/Claude/5BIB_Spec_DoiSoat.md`
- **Mockup P3**: `~/Desktop/Claude/5BIB_Merchant_Mockup.html`
- **Mockup P2**: `~/Desktop/Claude/5BIB_DoiSoat_Mockup.html`

---

## Database Architecture

### Backend DB (MongoDB — `5bib_result`)
Dùng cho race results, claims, sync logs, admin users, sponsors, races.
Schemas ở `backend/src/modules/*/schemas/*.schema.ts`.

### 5BIB Platform DB (PostgreSQL — `5bib_platform_live`)
**Database riêng** của hệ thống 5BIB. Backend cần kết nối qua TypeORM/pg để đọc/ghi.
Connection string lấy từ env var `PLATFORM_DB_URL` (cần add vào `.env`).

#### Tables hiện có trên Platform DB:
- `tenant` — merchant; cần add: `service_fee_rate`, `manual_fee_per_ticket`, `fee_vat_rate`
- `order_line_item` — dòng đơn hàng
- `order_metadata` — đơn hàng (order_category: ORDINARY/PERSONAL_GROUP/CHANGE_COURSE/MANUAL)
- `ticket_type`, `race_course`, `discount_code`, `races`

#### Tables cần tạo mới (migration SQL):
- `tenant_fee_history` — audit log thay đổi phí (fee_field VARCHAR để phân biệt 3 loại phí)
- `reconciliation` — bản đối soát doanh thu
- `reconciliation_line_item` — chi tiết đơn 5BIB (ORDINARY/GROUP/CHANGE_COURSE)
- `reconciliation_manual_order` — chi tiết đơn thủ công (MANUAL)

---

## Key Business Logic (P2/P3)

```
order_category = MANUAL       → phí cố định manual_fee_per_ticket VNĐ/vé
order_category = ORDINARY     → phí % service_fee_rate; không có payment_ref = LỖI
order_category = PERSONAL_GROUP / CHANGE_COURSE → phí % service_fee_rate (bình thường)
fee_vat_rate                  → VAT trên tiền phí (không phải doanh thu); 0% hoặc 8%
fee snapshot                  → snapshot tất cả 3 fee fields khi tạo đối soát
```

---

## Admin Frontend Conventions

### Pattern chuẩn cho mỗi page mới

```
admin/src/app/(dashboard)/<feature>/page.tsx   ← page chính
admin/src/app/(dashboard)/<feature>/[id]/page.tsx  ← detail page (nếu cần)
```

**Imports bắt buộc:**
```ts
"use client";
import { useAuth } from "@/lib/auth-context";          // lấy token
import { authHeaders } from "@/lib/api";               // { headers: { Authorization: ... } }
import { featureControllerXxx } from "@/lib/api-generated";  // generated SDK
import { toast } from "sonner";                         // notifications
```

**Auth pattern:**
```ts
const { token } = useAuth();
const { data, error } = await someControllerMethod({
  query: { ... },
  ...authHeaders(token!),
});
```

**Thêm nav item** vào `admin/src/app/(dashboard)/layout.tsx` trong mảng `navItems`.

### Sau khi backend thêm endpoint mới
```bash
cd admin && pnpm run generate:api
# → regenerate src/lib/api-generated/ từ http://localhost:8081/swagger/json
```

---

## Backend Conventions (NestJS)

### Module structure chuẩn
```
backend/src/modules/<feature>/
  <feature>.module.ts
  <feature>.controller.ts
  <feature>.service.ts
  dto/
    create-<feature>.dto.ts
    response-<feature>.dto.ts
  schemas/           ← nếu có MongoDB schema
```

### Auth guard
```ts
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
@UseGuards(JwtAuthGuard)
```

### Swagger decorators bắt buộc (để generate:api hoạt động)
```ts
@ApiTags('feature-name')
@ApiBearerAuth()
@ApiOperation({ summary: '...' })
@ApiResponse({ status: 200, type: ResponseDto })
```

---

## Build & Test Order cho P3 + P2

1. **P3 trước** (Merchant Management) — vì P2 phụ thuộc vào `service_fee_rate` và `manual_fee_per_ticket`
2. Backend P3 → Admin Frontend P3 → Verify → P2 backend → P2 frontend

### PAUSE trước khi:
- Chạy migration SQL trên Platform DB
- Thêm dependency mới (TypeORM, pg, xlsx)
- Thay đổi auth hay security
