# FEATURE-033: PRD — Promo Hub race_calendar sync từ MySQL platform (phase bán vé)

**Status:** 🔵 READY
**Last updated:** 2026-05-14
**Author:** 5bib-po-ba
**Linked init:** `00-manager-init.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` đầy đủ
- [x] Đã đọc memory `codebase-map.md` (race-master-data entities pattern + reconciliation MySQL access)
- [x] Đã đọc memory `known-issues.md` (TD-F027-PHASE2-13 race_calendar group-by-month — out of scope F-033)

---

## 📝 Promo Hub race_calendar — phase bán vé data source fix

**Goal:** F-027 Promo Hub section `race_calendar` hiển thị đúng race đang phase BÁN VÉ (MySQL platform, `status = 'GENERATED_CODE'`) thay vì race phase vận hành (MongoDB 5bib-result).

**Scope:**
- ✅ In: BE new entity `RaceReadonly` + service + endpoint, FE switch fetch source, admin section config + form, Redis cache + invalidation, backward-compat existing hub
- ❌ Out: Race detail page trên 5bib-result (race phase bán vé chưa có), 5Ticket coordination (link CTA dùng pattern `5ticket.vn/event/<url_name>` — assume sẵn), TD-F027-PHASE2-13 group-by-month (defer Phase 2 sau)

---

## 👤 User Stories & Business Rules

### User Stories

- As a **5BIB Back-Office Admin (MKT)**, I want to create promo hub với section `race_calendar` hiển thị race đang bán vé so that user truy cập landing page click qua 5Ticket mua vé.
- As an **Anonymous Visitor**, I want to see danh sách race đang mở bán so that I biết race nào còn vé, ngày diễn ra + click sang trang vé.
- As a **5BIB Back-Office Admin**, I want toggle giữa source `platform_on_sale` (bán vé) và `result_active` (vận hành) on each section so that flexibility cho từng hub use case.

### Business Rules

- **BR-PH33-01:** Source data mặc định `platform_on_sale` — MySQL `5bib_platform_live.races` filter `status = 'GENERATED_CODE' AND is_delete = 0 AND is_show = 1`
- **BR-PH33-02:** Field `source` trong section config 3 values: `platform_on_sale` (default cho hub mới), `result_active` (legacy F-027 — fetch MongoDB races collection), không có field `source` = `result_active` (backward-compat existing hub)
- **BR-PH33-03:** Race với `url_name IS NULL` → SKIP (KHÔNG hiển thị) để tránh broken link
- **BR-PH33-04:** Sort default `registration_start_time ASC` (race sắp mở bán hiển thị trước) — admin có thể override Phase 2
- **BR-PH33-05:** Race CTA click → redirect `https://5ticket.vn/event/<url_name>` (5Ticket = nơi bán vé)
- **BR-PH33-06:** Multi-tenant — hiển thị TẤT CẢ race đang bán vé từ MỌI tenant (Promo Hub là MKT chung 5BIB). Admin có thể filter `tenantId` optional trong section config Phase 2 (KHÔNG required Phase 1)
- **BR-PH33-07:** Field display tối thiểu: `title`, `logo_url`, `event_start_date`, `location` (4 field). Fields optional: `registration_end_time` (countdown), `brand`
- **BR-PH33-08:** Limit max 20 race per section (admin chọn 1-20, default 6 — match F-027 baseline)
- **BR-PH33-09:** Cache Redis `promo-hub:races-on-sale:<limit>:<sort>` TTL 60s — invalidate manual KHÔNG do 5bib-result tạo race (race lifecycle ở 5Ticket platform); rely on TTL only
- **BR-PH33-10:** Performance SLA p95 ≤500ms cached, ≤800ms cold (50% relaxed vs F-027 ≤500ms cold cho phép MySQL cross-DC latency)
- **BR-PH33-11:** Security — endpoint public NO auth (Promo Hub là public landing). Rate-limit by ThrottlerGuard default tier
- **BR-PH33-12:** Backward-compat — existing F-027 hub đã published với section `race_calendar` (chưa có field `source`) → backend coerce `source = 'result_active'` (giữ behavior cũ MongoDB fetch). NO migration script needed (defensive default).

---

## 🖥️ UI/UX Flow

### Screen 1: Admin Edit Hub — Section Config Dialog (case `race_calendar`)

**Route:** `https://admin.5bib.com/promo-hub/<hubId>` → click section "Lịch giải đấu" → modal config opens

**Visible data:**
- Field "Tiêu đề khối" (text input) — source: `section.config.title`
- Field "Nguồn dữ liệu" (NEW select) — values:
  - `📊 Race đang bán vé (5Ticket platform)` → `platform_on_sale`
  - `🏃 Race đang vận hành (5BIB Result)` → `result_active`
- Field "Số giải hiển thị" (number input 1-20) — source: `section.config.limit`
- (Conditional khi `source = 'result_active'`) Field "Lọc theo trạng thái" — current behavior preserved (pre_race/live/ended)
- (Conditional khi `source = 'platform_on_sale'`) Field "Sắp xếp" — values: `Ngày mở bán` (default) / `Ngày diễn ra`

**Actions:**
- Change source → preview re-render real-time với data từ source mới
- Save → backend PATCH update section config
- Cancel → discard changes

**States:**
- Loading: Skeleton trong preview pane khi switch source (async fetch)
- Empty: Nếu 0 race match → preview show "Chưa có race đang bán vé"
- Error: Toast "Không tải được danh sách race" khi backend fail
- Success: Preview show 6 race cards real
- Submitting: Save button → "Đang lưu..." + disable

### Screen 2: Public Hub `/hub/<slug>` — Race Calendar Section (phase bán vé)

**Route:** `https://5bib.com/hub/<slug>` (sau khi 5Ticket merge rewrite)

**Visible data per race card:**
- `title` (lớn, font-black)
- `logo_url` (ảnh card top, aspect 16:9)
- `event_start_date` (formatted "DD/MM/YYYY")
- `location` (icon 📍 + text)
- (Optional) Badge "Còn N ngày bán vé" nếu `registration_end_time` < 30 days

**Actions:**
- Click race card → redirect `https://5ticket.vn/event/<url_name>` (new tab)
- Fire analytics `track-click` event với label = race title (existing F-027 tracker)

**States:**
- Loading: Server Component SSR → no client loading state
- Empty: Section returns null (KHÔNG hiển thị nếu 0 race match)
- Error: Section returns null + log server-side (defensive, không break hub render)

---

## 🛠️ Technical Mandates (For Coder)

### Backend (NestJS)

**NEW entity** `backend/src/modules/promo-hub/entities/race-readonly.entity.ts`:

```typescript
@Entity('races')
export class RaceReadonly {
  @PrimaryColumn({ type: 'bigint', name: 'race_id' })
  raceId: string;  // bigint → string

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'url_name', type: 'varchar', length: 255, nullable: true })
  urlName: string | null;

  @Column({ type: 'varchar', length: 32 })
  status: string;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  @Column({ name: 'event_start_date', type: 'datetime', nullable: true })
  eventStartDate: Date | null;

  @Column({ name: 'event_end_date', type: 'datetime', nullable: true })
  eventEndDate: Date | null;

  @Column({ name: 'registration_start_time', type: 'datetime', nullable: true })
  registrationStartTime: Date | null;

  @Column({ name: 'registration_end_time', type: 'datetime', nullable: true })
  registrationEndTime: Date | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  brand: string | null;

  @Column({ name: 'tenant_id', type: 'bigint' })
  tenantId: string;

  @Column({ name: 'is_show', type: 'bit' })
  isShow: Buffer;  // TypeORM bit → Buffer; check via `.readUInt8(0) === 1`

  @Column({ name: 'is_delete', type: 'bit' })
  isDelete: Buffer;
}
```

**Registration:** `TypeOrmModule.forFeature([RaceReadonly], 'platform')` trong `PromoHubModule`.

**NEW service method** `PromoHubService.findRacesOnSale({ limit, sort })`:
- Repository query với filter:
  ```typescript
  this.raceRepo
    .createQueryBuilder('r')
    .where('r.status = :status', { status: 'GENERATED_CODE' })
    .andWhere("CAST(r.is_delete AS UNSIGNED) = 0")
    .andWhere("CAST(r.is_show AS UNSIGNED) = 1")
    .andWhere('r.url_name IS NOT NULL')   // BR-PH33-03 skip null slug
    .orderBy(
      sort === 'event_date' ? 'r.event_start_date' : 'r.registration_start_time',
      'ASC',
    )
    .limit(limit)
    .getMany();
  ```
- Cache key `promo-hub:races-on-sale:${limit}:${sort}` Redis TTL 60s
- Transform `RaceReadonly[]` → public DTO (strip tenant_id, isShow Buffer, etc.)

**NEW DTO** `RaceOnSaleResponseDto`:
```typescript
{
  raceId: string;
  title: string;
  urlName: string;       // already filtered NOT NULL
  logoUrl: string | null;
  eventStartDate: string | null;  // ISO
  registrationEndTime: string | null;
  location: string | null;
  brand: string | null;
  ticketUrl: string;     // pre-computed: https://5ticket.vn/event/<urlName>
}
```

**NEW endpoint** `GET /api/promo-hub/races-on-sale`:
- Public (NO `LogtoAdminGuard`), `@SkipThrottle()` removed (use default tier)
- Query params: `limit` (1-20, default 6), `sort` (`registration_start_time` | `event_date`, default `registration_start_time`)
- Response: `{ data: RaceOnSaleResponseDto[] }`
- ApiTags `promo-hub`, ApiOperation, ApiResponse (status 200 type)

**NO PAUSE flags:** không migration, không install dep mới (typeorm + mysql2 đã có).

### Frontend (Next.js public)

**MODIFY** `frontend/components/hub/sections/RaceCalendarSection.tsx`:
- Read `section.config.source` — default `'result_active'` if absent (backward-compat BR-PH33-12)
- Branch:
  - `source === 'platform_on_sale'` → fetch `${BACKEND_URL}/api/promo-hub/races-on-sale?limit=${limit}&sort=${sort}` → render with new field shape
  - `source === 'result_active'` (default) → existing code (fetch `/api/races?status=...`)
- New helper `getTicketUrl(urlName)` → return `https://5ticket.vn/event/${urlName}` (use `data-promo-cta-url` for analytics)
- Field mapping for platform mode: `title`, `logoUrl`, `eventStartDate`, `location` (+ optional countdown badge if `registrationEndTime` < 30 days from now)

### Admin (Next.js admin)

**MODIFY** `admin/src/components/promo-hub/section-types.ts`:
- Update `SECTION_TYPE_META.race_calendar.description` → "Lịch giải đấu — bán vé hoặc vận hành"
- Update `SECTION_TYPE_META.race_calendar.defaultConfig` → add `source: 'platform_on_sale'`, `sort: 'registration_start_time'`

**MODIFY** `admin/src/components/promo-hub/SectionConfigDialog.tsx` case `'race_calendar'`:
- Add Field "Nguồn dữ liệu" (Select)
- Conditional render: nếu `source === 'platform_on_sale'` → show field "Sắp xếp"; nếu `source === 'result_active'` → show field "Lọc theo trạng thái" (existing behavior preserved)

### SDK regen

- Run `pnpm --filter admin generate:api` + frontend after backend DTO ready
- Verify `promoHubControllerFindRacesOnSale` exported

### Unit tests (Coder bắt buộc)

`backend/src/modules/promo-hub/promo-hub.service.spec.ts` extend với:
- `findRacesOnSale() returns races filtered by status=GENERATED_CODE + is_delete=0 + is_show=1 + url_name NOT NULL`
- `findRacesOnSale() respects limit + sort param`
- `findRacesOnSale() returns cached result on 2nd call (Redis hit)`
- `findRacesOnSale() falls back to DB direct nếu Redis throws`
- `findRacesOnSale() transforms RaceReadonly → DTO (strip tenant_id, isShow, isDelete)`
- DTO field shape: `ticketUrl` pre-computed = `https://5ticket.vn/event/${urlName}`

---

## 🛡️ Testing Mandates (For QC)

### Happy path
1. Admin tạo hub mới + add section race_calendar + source `platform_on_sale` + Save → public hub render 6 race đang bán vé (status GENERATED_CODE)
2. Click race card → redirect `5ticket.vn/event/<url_name>` (new tab)
3. Admin switch source `result_active` → preview hiện race phase vận hành (existing behavior)
4. Existing F-027 hub published trước F-033 (no `source` field) → render race phase vận hành (backward-compat BR-PH33-12)

### Unhappy paths (QC MUST write)
- Race với `status = 'DRAFT'` → KHÔNG xuất hiện
- Race với `is_delete = 1` → KHÔNG xuất hiện
- Race với `is_show = 0` → KHÔNG xuất hiện
- Race với `url_name = NULL` → SKIP (KHÔNG xuất hiện)
- Limit > 20 → reject 400 validation
- Sort invalid value → reject 400 validation
- MySQL platform connection drop → backend returns `[]` (defensive, no 500)
- Redis throws → fallback DB direct, log warning
- 10 concurrent same-cache-key fetch → all return same data (anti-stampede SETNX inherit từ F-027 base nếu reuse pattern; OR acceptable miss-and-fill cho first batch)

### Security checks
- GET `/api/promo-hub/races-on-sale` no auth → 200 (public OK)
- Response KHÔNG leak: `tenant_id`, `is_delete`, `is_show` raw Buffer, `created_by_id`, `metadata`, internal IDs khác
- SQL injection via query param `sort` → must validate enum (whitelist `registration_start_time` | `event_date`)
- ThrottlerGuard 100req/min IP (default tier) — verify

### Performance SLA
- `GET /api/promo-hub/races-on-sale?limit=6` cached p95 ≤500ms — measure
- Cold cache (DEL key + fetch) p95 ≤800ms — measure
- 10x concurrent fetch → all <1000ms total

---

## 📌 Answers to Manager's PAUSE conditions

- **PAUSE-PH33-01 `url_name` NULL fallback:** SKIP race (BR-PH33-03). Rationale: race_id unfriendly, generated slug từ title unstable (rename → broken link).
- **PAUSE-PH33-02 Multi-tenant boundary:** Show ALL tenants (BR-PH33-06). Promo Hub là MKT chung. Filter tenantId defer Phase 2.
- **PAUSE-PH33-03 Race CTA click target:** `https://5ticket.vn/event/<url_name>` (BR-PH33-05). 5Ticket là nơi bán vé.
- **PAUSE-PH33-04 `is_show` filter:** YES (BR-PH33-01). Respect tenant intent ẩn race khỏi promo.
- **PAUSE-PH33-05 Backward-compat:** **Option B** — admin chọn source field, default `platform_on_sale` cho hub mới, existing hub fallback `result_active` (BR-PH33-02, BR-PH33-12).
- **PAUSE-PH33-06 Sort order:** `registration_start_time ASC` default (BR-PH33-04). Admin override Phase 2.
- **PAUSE-PH33-07 Fields display:** `title + logo + event_start_date + location` tối thiểu, optional `registration_end_time` countdown + `brand` (BR-PH33-07).
- **PAUSE-PH33-08 Performance SLA:** p95 cached ≤500ms / cold ≤800ms (BR-PH33-10). 50% relaxed cold vs F-027 baseline để chịu MySQL cross-DC.

---

## ✅ Status

- [x] READY — sẵn sàng cho `/5bib-plan`

## 🔗 Next step

`/5bib-plan FEATURE-033-promo-hub-platform-race-sync`
