# 5BIB Result — Frontend Conventions

> Tổng hợp rule áp dụng toàn bộ admin + frontend. Mọi feature mới PHẢI tuân thủ.

---

## Display Convention — KHÔNG render raw enum/snake_case cho user

**Rule:** Mọi value technical (enum status, snake_case key, English label, contract type code,
provider code, …) PHẢI map qua dictionary tiếng Việt trước khi render UI.

**Pattern dùng:**

```ts
// Backend trả enum value gốc — KHÔNG đổi (đã chuẩn hoá BR-*)
//   { status: 'DRAFT', contractType: 'TIMING', period: 'last_3_months' }

// Frontend dictionary tập trung (vd admin/src/lib/finance-labels.ts):
export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang hiệu lực',
  COMPLETED: 'Hoàn thành',
  // …
};

// Render với fallback raw để dev nhận biết khi miss dictionary:
<Badge>{STATUS_LABEL[status] ?? status}</Badge>
```

**Trường hợp đặc biệt (cho phép giữ English):**

- Tên field code hiển thị trong `<code>` block (vd `<code>estimatedFee</code>` trong banner
  giải thích kỹ thuật) — đó là tham chiếu code, không phải label.
- Mã JWT scope / role permission (vd `'admin'`) — dev/admin-only string.
- Acronym đã thông dụng: YTD, MTD, P&L, BIB, MST, HĐ.
- Brand name: 5BIB, 5Solution, 5Ticket, 5Pix, UTMB, ITRA — giữ nguyên branding.

**Anti-pattern (KHÔNG được):**

- `<span>{status}</span>` render raw enum `DRAFT`.
- `<option value="last_3_months">last_3_months</option>` (label = value snake_case).
- Mixed VN + English trong UI: `"Chọn loại: TICKET_SALES"`.
- Dictionary inline duplicate ở từng component (gây drift) — phải đưa vào `*-labels.ts` chung.

**Enforcement (Coder MUST grep sau mỗi feature mới có UI):**

```bash
# UPPERCASE enum render
grep -rE "\b(DRAFT|SENT|ACTIVE|COMPLETED|CANCELLED|REJECTED|ACCEPTED|CONVERTED_TO_CONTRACT)\b" \
  admin/src/app/<feature>/ --include="*.tsx" | grep -vE "type |interface |=== |!== |status:|: \""

# snake_case key in JSX text
grep -rE "(last_|_months|_days|_year|_week|current_month)" \
  admin/src/app/<feature>/ --include="*.tsx" | grep -v ": \"\|= \"\|=== \"\|!== \""

# Cost category raw
grep -rE "\b(LABOR|MATERIAL|VENDOR|OUTSOURCE|OTHER)\b" \
  admin/src/app/<feature>/ --include="*.tsx" | grep -vE "type |: \"\|=== |!== "

# Contract type raw
grep -rE "\b(TIMING|RACEKIT|OPERATIONS|TICKET_SALES)\b" \
  admin/src/app/<feature>/ --include="*.tsx" | grep -vE "type |: \"\|=== |!== |filter:"

# Provider raw (5BIB / 5SOLUTION không kèm label)
grep -rE "\b5SOLUTION\b" admin/src/app/<feature>/ --include="*.tsx"

# English label common
grep -rE "\b(Estimated|Actual|Healthy|Draft|Active|Cancelled|Rejected|Sent|Accepted|Pending|Paid)\b" \
  admin/src/app/<feature>/ --include="*.tsx" | grep -vE "//|interface |type "
```

Toàn bộ matches **phải** nằm trong `value=` attribute, type/interface declaration, hoặc comparison
operator (`===` / `!==`) — TUYỆT ĐỐI không nằm trong JSX text content.

---

## Existing dictionary (reference)

| Module | File | Coverage |
|---|---|---|
| F-024 Contract | `admin/src/app/(dashboard)/contracts/_components/contract-status-badge.tsx` | Contract status (DRAFT/SENT/.../CANCELLED) |
| F-024 Payment | `admin/src/app/(dashboard)/contracts/_components/payment-status-badge.tsx` | Payment request (DRAFT/SENT/PENDING/PAID) |
| F-028 Finance | `admin/src/lib/finance-labels.ts` | Period preset / cost category / contract status + type / provider / revenue source / margin tier / dashboard groupBy |
| F-028 Finance API | `admin/src/lib/finance-api.ts` | `COST_CATEGORY_LABELS` (sẽ dần được proxy sang `finance-labels.ts`) |

**Khi thêm feature mới có enum mới:**

1. Tạo `admin/src/lib/<feature>-labels.ts` (hoặc append vào file chung nếu cùng domain).
2. Export `<NAME>_LABEL: Record<EnumKey, string>` + helper `format<Name>(key)`.
3. Import vào component thay vì hard-code dictionary.
4. Grep verify (xem block trên).

---

## Bài học pattern bug đã phát hiện

- **F-024 UX-15** — Payment status raw `DRAFT/PENDING` hiển thị English → fix bằng
  `PaymentStatusBadge` dictionary tone-mapped.
- **F-028 Dashboard period filter** — `<SelectValue />` không có forced children làm
  shadcn Select hiện thị raw value `last_3_months` khi hydration không re-trigger. Fix:
  truyền children `{PERIOD_LABEL[period]}` vào `<SelectValue>` để guarantee VN label.
- **F-028 Revenue badge** — "Actual" / "Estimated" English render trực tiếp → fix
  dùng `REVENUE_SOURCE_LABEL`.
- **F-028 Margin tier** — "Healthy" English mixed với "Lỗ / Mỏng" VN → unify qua
  `MARGIN_TIER_LABEL`.
- **F-028 Contract detail banner** — text "(TIMING/RACEKIT/OPERATIONS)" → dùng helper
  `joinNonTicketContractTypes()` trả "Tính giờ / Racekit / Vận hành".
- **F-028 Cost category** — `OUTSOURCE: "Outsource"` (English) → đổi "Thuê ngoài".
