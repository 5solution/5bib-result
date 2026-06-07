# FEATURE-069 M3 — Implementation Notes (Reviewer's Guide)

Admin UI gán quyền Merchant Portal. Pure frontend, consume 7 endpoint M2a. Không đụng backend.

---

## Section 1: 🚧 Deviations from Spec (intentional)

- **[Deviation #1] tenantId filter UI deferred** — list chỉ có 3 filter (q + permission + status), KHÔNG có tenantId filter
  - **Plan said:** "Filter: q (search), tenantId, permissionFilter, statusFilter"
  - **I did:** Build q + permissionFilter + statusFilter. Bỏ tenantId filter UI.
  - **Why:** tenantId filter cần 1 tenant picker riêng → hoặc import single `TenantPicker` từ `contracts/_components` (couple cross-feature) hoặc dựng thêm component. Giá trị thấp vì: (1) cột "BTC được xem" đã hiện `tenantNames`, (2) q search theo userName/email đủ cho admin tìm. Backend vẫn support `tenantId` query param nếu sau cần.
  - **Reviewer should check:** Chấp nhận v1 không có tenantId filter? Nếu cần → mở M3b nhỏ (reuse TenantPicker single).

- **[Deviation #2] raceOverrides UI bỏ hoàn toàn v1** — form chỉ gán `tenantIds`
  - **Plan/PAUSE #3 said:** Danny chốt "v1 CHỈ tenantIds, defer race-override M3b" → đây là theo plan, không phải lệch. Ghi lại để rõ: form KHÔNG gửi `raceOverrides` (backend default empty include/exclude).
  - **Reviewer should check:** Edit 1 config có sẵn raceOverrides (tạo từ API trực tiếp) → UI hiện đúng tenantIds, KHÔNG xóa mất raceOverrides? **CẦN QC verify:** UpdateAccessConfigDto KHÔNG gửi raceOverrides → backend giữ nguyên giá trị cũ (PATCH partial) hay reset? Nếu backend reset → data loss risk. (Tao đọc DTO: raceOverrides optional → PATCH bỏ field = giữ nguyên, nhưng QC confirm behavior thật.)

## Section 2: ⚙️ Forced Changes (reality ≠ spec)

- **[Forced #1] House style = direct SDK fn + useState, KHÔNG TanStack hooks**
  - **Plan assumed:** "TanStack Query qua generated SDK"
  - **Reality:** Admin list pages (races/page.tsx, finance) dùng pattern `const {data,error} = await xxxController({...}); useState/useEffect`. Generated SDK của hey-api KHÔNG sinh TanStack hooks ở repo này.
  - **Workaround:** Follow house style (direct fn + useState + useCallback fetch + debounce). Mutation onSuccess → local refetch (`fetchList`).
  - **Manager/BA action:** Update conventions.md note "admin list pages = direct SDK fn pattern, không TanStack hooks" để plan sau không assume.

- **[Forced #2] TenantPicker single-select → tự build multi**
  - **Plan assumed:** reuse `contracts/_components/tenant-picker.tsx`
  - **Reality:** TenantPicker là single (`value: number|null`). Manager đã note ở plan.
  - **Workaround:** `tenant-multi-picker.tsx` mới — reuse `searchMysqlTenants` data source, UI chips multi-select + name cache.

- **[Forced #3] Generated `raceCount` type = object, không phải `number | '__all'`**
  - **Plan/DTO assumed:** `raceCount: number | '__all'`
  - **Reality:** `@hey-api/openapi-ts` emit union literal `number|'__all'` thành `{ [key: string]: unknown }` (OpenAPI quirk).
  - **Workaround:** `formatRaceCount(count: unknown)` narrow tại chỗ (`'__all'` / number / numeric-string / else dash) — tránh `as unknown as` (hard-rule).
  - **Manager/BA action:** Cosmetic — backend OpenAPI có thể annotate `oneOf` rõ hơn, nhưng narrow-on-read đủ an toàn.

## Section 3: ⚖️ Tradeoffs Considered

| Decision | Chosen | Alternative | Why | Cost paid |
|----------|--------|-------------|-----|-----------|
| Data fetch | Direct SDK fn + useState | TanStack Query hooks | Match house style (races/finance), SDK không sinh hooks | Manual refetch + debounce tự viết; no cache dedupe |
| Unit test surface | Pure labels fn (jest.kiosk) | Full RTL component test | RTL/jsdom KHÔNG có trong admin (TD-F013-TESTSTACK) | UI behavior coverage dời sang QC Playwright |
| raceCount type | narrow `unknown` | cast `as unknown as` | Hard-rule cấm `as unknown as` | +vài dòng narrow |
| tenantId filter | bỏ v1 | reuse single TenantPicker cross-feature | Tránh coupling + low value (tenantNames visible) | Mất 1 filter (deviation #1) |
| Form prefill name | zip tenantIds↔tenantNames by index | extra API call lấy names | tenantNames đã denormalized trong list item | Giả định 2 mảng cùng order (multi-picker re-fetch names khi search nên chip sai chỉ thoáng qua) |

## Section 4: 🔬 Reviewer Notes (Manager + QC focus)

### Files cần review kỹ (priority)
1. **`_components/access-form-dialog.tsx`** — business logic core: ticket_report locked, permissions array build, edit prefill reset (useEffect dep `open`+`editingItem`), PATCH body KHÔNG gửi raceOverrides (Deviation #2 — verify không reset backend).
2. **`page.tsx:handleDelete` + pagination** — delete item cuối trang>1 lùi trang; confirm destructive.
3. **`_components/logto-lookup-field.tsx`** — 503/not-found đều graceful (catch → unavailable, không throw lên form).
4. **`merchant-portal-labels.ts:formatRaceCount`** — narrow unknown (Forced #3).
5. **`_components/tenant-multi-picker.tsx`** — multi toggle + name cache.

### Concurrency hotspots
- Không có (pure read UI + single mutation). Backend M2a đã có SETNX lock cho concurrent same-userId.

### Edge cases tested vs DEFERRED
- ✅ Tested (unit): label mapping + raceCount sentinel/number/string/invalid.
- ⚠️ Deferred → QC: full UI states (loading/empty/filtered-empty/error/submitting/success), 409 dup keep-form, edit-no-raceOverrides-reset, Logto 503 manual entry. **Auth-through-flow (token → /me) KHÔNG test được local.**

### Type safety narrowed casts
- ZERO `as unknown as` (đã loại). `formatRaceCount(unknown)` narrow bằng typeof.

### Security checklist self-applied
- [x] Admin gate `isAdmin` page-level + backend LogtoAdminGuard (defense-in-depth)
- [x] Không leak field nhạy cảm — render từ AccessConfigListItemDto (đã strip `_id`→`id` ở backend)
- [x] Display Convention: 0 raw enum trong JSX text (grep clean)

### ⚠️ CRITICAL gap cho reviewer
- **TD-F069-M3-AUTH-SMOKE:** PAUSE #4 (Danny "Có") yêu cầu smoke luồng auth merchant thật. Local KHÔNG có Logto merchant JWT → chỉ verify được route mounted + 401. Gap "backend chưa verified-through-auth" VẪN MỞ. Cần: Danny cấp Logto merchant test account hoặc chạy staging. **KHÔNG được coi M3 đóng gap này.**
