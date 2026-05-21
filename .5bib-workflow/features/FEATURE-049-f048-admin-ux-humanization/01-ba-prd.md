# FEATURE-049 PRD: F-048 Admin UX Humanization

**Status:** 🔵 READY
**Created:** 2026-05-20 23:50 ICT
**Author:** 5bib-po-ba
**Parent:** F-048 Athlete Identity Foundation (engineer-speak admin UI gap)
**Parallel ship:** F-047 resume (option C Danny chốt)
**Ship target:** release/v1.9.0

---

## ✅ Pre-flight check

- [x] Đã đọc `00-manager-init.md` đầy đủ (impact map + 8 PAUSE confirmed)
- [x] Đã đọc `.5bib-workflow/memory/codebase-map.md` (race-master-data module + admin structure)
- [x] Đã đọc `.5bib-workflow/memory/known-issues.md` (xác nhận không có blocker mới)
- [x] Đã đọc F-048 admin pages source (verify current engineer-speak baseline)
- [x] Đã đọc F-048 cluster service + DTO shape (verify enrich injection point)

---

## 🎯 Title / Goal / Scope

### Title
**F-048 Admin UX Humanization — engineer-speak labels → Vietnamese business language**

### Goal
Sau khi F-048 ship Phase 3 admin UI cho moderation identity clusters, Danny review phát hiện UI toàn engineer-speak (UUID đầy đủ, T1/T2/T3 code, MYSQL RACE ID, ObjectId reference, "cluster" terminology). Admin staff (Hằng Sales / Hiền Finance / Tùng Ops không phải engineer) **không hiểu được UI → không moderate được → F-048 ROI = 0%**.

F-049 humanize toàn bộ admin UI cho F-048 mà KHÔNG đụng backend algorithm/domain logic. Sau F-049, admin staff:
- Đọc được tier labels tiếng Việt
- Recognize cluster bằng race name + bib (không phải MYSQL RACE ID raw)
- Hiểu được confidence qua traffic light (không phải raw number 0.85)
- Action merge/split bằng business language "Phân tách hồ sơ" / "Hợp nhất với hồ sơ khác"

### Scope IN

**Admin UI (3 files):**
1. `admin/src/app/(dashboard)/athletes/identity-clusters/page.tsx` — rewrite list columns + filter labels + KPI cards
2. `admin/src/app/(dashboard)/athletes/identity-clusters/[clusterId]/page.tsx` — rewrite detail page sections + action buttons + merge/split forms
3. `admin/src/lib/identity-cluster-labels.ts` (NEW) — centralized VN dictionary (TIER_LABEL, CONFIDENCE_VARIANT, ACTION_LABEL)

**Backend extension (2 files):**
4. `backend/src/modules/race-master-data/controllers/identity-cluster-admin.controller.ts` — EXTEND response DTO add `raceName` + `bibNumber` per linkedAthleteRecord
5. `backend/src/modules/race-master-data/services/athlete-identity-clustering.service.ts` — ADD `enrichClusterWithRaceContext(cluster)` private method (single `$in` aggregation query để mitigate N+1)

### Scope OUT (giữ nguyên KHÔNG đụng)

- ❌ Identity clustering algorithm logic (T1/T2/T3/T4 tiering logic unchanged)
- ❌ Bulk sync orchestrator state machine
- ❌ Cron jobs (identity clustering 24h + bulk sync 24h)
- ❌ MongoDB schema `athlete_identity_clusters` (collection structure unchanged)
- ❌ Public API (cluster lookup không expose public)
- ❌ Backend merge/split write logic (endpoint URLs + side effects unchanged, chỉ response DTO add fields)

---

## 👥 User Stories & Business Rules

### Personas affected

1. **5BIB Back-Office Admin (Hằng Sales / Hiền Finance / Tùng Ops)** — primary user. Moderate identity clusters daily. KHÔNG phải engineer, KHÔNG biết MongoDB/MySQL structure.
2. **5BIB Engineer (Danny / future hires)** — secondary user. Cần debug option qua "Hiển thị thông tin kỹ thuật" toggle để see ObjectId + raw confidence number.

### User Stories

> **US-49-01:** As a **Back-Office Admin**, I want to **see identity clusters with Vietnamese tier labels and traffic-light confidence indicators** so that **I can scan the review queue and prioritize work without engineer assistance**.

> **US-49-02:** As a **Back-Office Admin**, I want to **see race name + bib number per linked record (instead of MYSQL RACE ID + ATHLETES ID)** so that **I can recognize which athlete from which race is in the cluster**.

> **US-49-03:** As a **Back-Office Admin**, I want to **merge or split clusters with business-language action buttons ("Phân tách hồ sơ" / "Hợp nhất với hồ sơ khác")** so that **I don't accidentally break clusters by misunderstanding "cluster" terminology**.

> **US-49-04:** As a **Back-Office Admin**, I want to **filter clusters by tier (Tin cậy cao / Trung bình / Cần xem xét) + search by email**, so that **I can focus on review queue (T3 tier) which needs human judgment**.

> **US-49-05:** As an **Engineer**, I want to **toggle "Hiển thị thông tin kỹ thuật" to see raw Cluster UUID + ObjectId + confidence number** so that **I can debug data integrity issues without losing admin-friendly default UX**.

### Business Rules (BR-49-XX)

| ID | Rule | Source |
|----|------|--------|
| **BR-49-01** | Cluster ID display: truncate to first 8 hex chars prefixed with `#` (vd `f47ac10b-58cc-4372-a567-0e02b2c3d479` → `#f47ac10b`). Render adjacent copy-to-clipboard icon → click copy full UUID to clipboard + toast "Đã sao chép ID hồ sơ" | PAUSE-49-01 |
| **BR-49-02** | Email display: render FULL email (`daohaian@gmail.com`) in admin UI — NO semi-redact. Defense: relies on `LogtoAdminGuard` route protection + MongoDB `select:false` schema default. Log output STILL uses hash proxy `[emailHash:abc12345]` (unchanged from F-048). | PAUSE-49-02 OVERRIDE |
| **BR-49-03** | Confidence score → shadcn Badge variant traffic light: confidence ≥0.9 → `success` "Tin cậy cao" / 0.6-0.9 → `warning` "Tin cậy trung bình" / <0.6 → `destructive` "Cần xem xét". Raw number hidden from primary UI, shown only via tooltip on hover. | PAUSE-49-03, PAUSE-49-08 |
| **BR-49-04** | Tier code → VN business label dictionary: `T1` → "Định danh qua email — Tin cậy cao" / `T2` → "Định danh qua Tên + Năm sinh + Giới tính — Tin cậy trung bình" / `T3` → "Cần xem xét lại — Tin cậy thấp" / `T4` → "Không định danh được". Dictionary lives in `admin/src/lib/identity-cluster-labels.ts`. | PAUSE-49-04 |
| **BR-49-05** | Action button labels rename: "Tách cluster" → "Phân tách hồ sơ"; "Gộp cluster khác" → "Hợp nhất với hồ sơ khác". Backend endpoint URLs unchanged (`/merge`, `/split`). | PAUSE-49-05 |
| **BR-49-06** | "MONGO REF" column: hide by default. Show ONLY when user toggles "Hiển thị thông tin kỹ thuật" switch (default OFF, state persists in localStorage key `identity-clusters:tech-mode` per browser). | PAUSE-49-06 |
| **BR-49-07** | Race name display: backend join `races.title` from `mysql_race_id`. Frontend renders truncate to 40 char + ellipsis + `title` HTML attr containing full text (tooltip on hover). Empty state "—" if race not found (orphan record). | PAUSE-49-07 |
| **BR-49-08** | Bib number display: backend join `race_athletes.bib_number` from `(mysql_race_id, athletes_id)` composite. Render as `font-mono text-xs` for engineer-style precision. Empty state "—" if race_athlete record missing. | New BR derived from BR-49-07 |
| **BR-49-09** | List page columns (default order): Cluster ID (#abc12345 + copy) / Tier badge / Email / Linked races count (badge with race count) / Last update (relative time vi-VN) / Actions (View / Merge candidates). Total 6 cols. | PRD UI spec |
| **BR-49-10** | Detail page sections: (1) Cluster header with ID + tier badge + confidence traffic light + email; (2) Linked Athletes Records table 5 cols (Race name truncate 40 / Bib number font-mono / Athlete name / Synced at / Actions: separate); (3) Merge form (search target cluster by email/name); (4) Split form (select records to split off); (5) Audit log (cluster.created / cluster.merged / cluster.split events). | PRD UI spec |
| **BR-49-11** | Filter options on list page: Tier dropdown (Tất cả / Tin cậy cao / Trung bình / Cần xem xét / Không định danh), Status dropdown (Hoạt động / Đã hợp nhất / Đã phân tách), Search input by email substring (min 3 chars, debounce 400ms). | PRD UI spec |
| **BR-49-12** | Pagination: default 20 per page, max 100. Sort default: `lastUpdatedAt DESC` (mới nhất ở trên). Sort options: Last update / Linked records count / Tier. | PRD UI spec |
| **BR-49-13** | Performance SLA: GET `/api/admin/identity-clusters` p95 < 400ms cold / <80ms warm (cache hit). Race name lookup MUST use single `$in` aggregation per page (NOT N+1 per cluster). | Plan ADDENDUM |
| **BR-49-14** | Cache strategy: Redis key `races:title:byMysqlId:<mysql_race_id>` TTL 3600s (1h) — race title rarely changes. Invalidation on race UPDATE not required (1h staleness acceptable). | Plan ADDENDUM |
| **BR-49-15** | PII boundary documentation: UI render full email for admin (BR-49-02). Log output uses hash proxy (unchanged F-048). Auditable separation: code reviewers MUST grep `logger.log` calls to verify NO raw email in logs. | Manager init risk flag MED |
| **BR-49-16** | Backward compatibility: F-048 endpoints unchanged URL + method. Response DTO ONLY ADD optional fields (`raceName?`, `bibNumber?`) — no field rename/remove. F-048 generated SDK clients work unchanged (TanStack Query optional chain `.raceName ?? '—'`). | Plan ADDENDUM |
| **BR-49-17** | Empty state messages: Empty cluster list → icon + "Chưa có hồ sơ identity nào — chạy đồng bộ giải mới hoặc kích hoạt phân cụm thủ công" + CTA button link to `/race-master-data/sync-control`. Filtered empty → "Không có hồ sơ khớp bộ lọc — thử xóa bộ lọc" + clear filter button. | PRD UI states |
| **BR-49-18** | Copy-to-clipboard interaction: click copy icon → navigator.clipboard.writeText(fullClusterId) → toast 2s "Đã sao chép ID hồ sơ: f47ac10b-58cc-..." with full UUID visible. Fallback if clipboard API unavailable → select text. | PRD UI spec |
| **BR-49-19** | Loading state: list page → 8 skeleton rows with shimmer effect (NOT spinner — table layout). Detail page → header skeleton + table skeleton. | PRD UI states |
| **BR-49-20** | Confidence Badge tooltip content: `Độ tin cậy: 0.85 (T2 - Tên + DOB + Giới tính match). Click vào hồ sơ để xem chi tiết phân cụm.` — gives engineer raw value + tier explanation in single hover. | PAUSE-49-08 expansion |

---

## 🎨 UI/UX Flow

### Route structure

| Route | Access | Layout | Notes |
|-------|--------|--------|-------|
| `/athletes/identity-clusters` | Admin (LogtoAdminGuard via middleware) | Dashboard layout | F-048 existing, F-049 rewrite content |
| `/athletes/identity-clusters/[clusterId]` | Admin | Dashboard layout | F-048 existing, F-049 rewrite content |

### Screen 1: List Page `/athletes/identity-clusters`

#### Layout

- **Header:**
  - Breadcrumb: `Quản trị / Vận hành / Hồ sơ identity`
  - Title: "Hồ sơ identity vận động viên"
  - Subtitle: "Quản lý và moderate các hồ sơ định danh xuyên giải"
  - Right buttons: "Hiển thị thông tin kỹ thuật" toggle switch + "Refresh" icon button
- **KPI Cards row (4 cards):**
  - Card 1: "Tổng hồ sơ" — count of all clusters (excluded merged/split)
  - Card 2: "Tin cậy cao (T1)" — count of T1 clusters
  - Card 3: "Cần xem xét (T3)" — count of T3 clusters with red badge
  - Card 4: "Định danh tổng" — % athletes with cluster vs total race_athletes
- **Filter bar:**
  - Tier dropdown: "Tất cả tier" / T1 / T2 / T3 / T4
  - Status dropdown: "Hoạt động" / "Đã hợp nhất" / "Đã phân tách"
  - Search input: placeholder "Tìm theo email..." (debounce 400ms, min 3 chars)
- **Body table (6 columns):** see Buttons spec
- **Footer pagination:** Previous / Next + page indicator (e.g., "Trang 2 / 47, hiển thị 21-40 / 941")

#### UI Step-by-Step Numbered Table

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Navigate `/athletes/identity-clusters` từ nav menu | Render page with 4 KPI cards (skeleton ~200ms) + filter bar + table skeleton 8 rows | TanStack Query `useIdentityClustersList()` | Loading state |
| 2 | KPI cards populate from `/api/admin/identity-clusters/coverage-stats` | 4 cards show counts with animation count-up | API response 200 | KPI cards data |
| 3 | Table populates 20 rows | Table renders with default sort `lastUpdatedAt DESC` | API response 200 | List data |
| 4 | Click "Hiển thị thông tin kỹ thuật" toggle switch | Toggle ON → show extra columns "Cluster UUID đầy đủ" + "MONGO REF" appended right side. Persists in localStorage `identity-clusters:tech-mode`. | onChange handler | techMode=true |
| 5 | Click Tier dropdown → select "Cần xem xét (T3)" | Filter applies, table reloads with `?tier=T3`, URL updates `?tier=T3` | onValueChange + router.push | Filtered state |
| 6 | Type "daohaian" in search input | After 400ms debounce → API call `?search=daohaian` → table reloads | onChange + setTimeout | Search results |
| 7 | Click copy icon next to `#f47ac10b` in row | navigator.clipboard.writeText → toast 2s "Đã sao chép ID hồ sơ: f47ac10b-58cc-4372-a567-0e02b2c3d479" | onClick handler | Clipboard copied |
| 8 | Click "Xem chi tiết" button on row | Navigate `/athletes/identity-clusters/{fullClusterId}` | Next.js Link | Detail page route |
| 9 | Click pagination "Next" | URL updates `?page=2`, table reloads, scroll-to-top | router.push + scrollTo | Page 2 state |
| 10 | Empty filter result (vd tier=T1 + search=zzz) | Table replaced with empty state icon + message + "Xoá bộ lọc" button | Conditional render | Filtered empty |

#### Buttons Specification — Screen 1

| Button label | Position | Default state | Disabled state | Loading state | Action | Confirm dialog? |
|--------------|----------|---------------|----------------|---------------|--------|-----------------|
| Toggle "Hiển thị thông tin kỹ thuật" | Header right | Switch OFF | KHÔNG | N/A | Toggle techMode localStorage + UI re-render | NO |
| "Refresh" icon | Header right | Outline icon button | KHÔNG | Spinner replace icon | refetch TanStack Query | NO |
| Copy icon `<Copy/>` | Row col 1 sau `#abc12345` | Ghost icon button | KHÔNG | N/A | navigator.clipboard.writeText + toast | NO |
| "Xem chi tiết" | Row col 6 (Actions) | Outline | KHÔNG | N/A | Navigate detail page | NO |
| "Phân tích merge" | Row col 6 (Actions) — only show if `mergeCandidatesCount > 0` | Primary blue | Disabled if status != active | N/A | Open merge candidate sheet/dialog showing N candidates | NO |
| "Trang trước" | Footer pagination | Outline | Disabled if `page = 1` | N/A | router.push `?page=N-1` | NO |
| "Trang sau" | Footer pagination | Outline | Disabled if `page = lastPage` | N/A | router.push `?page=N+1` | NO |
| "Xoá bộ lọc" | Empty state body | Primary blue | KHÔNG | N/A | router.push without query params | NO |

#### Form Fields Specification — Screen 1 (Filter bar)

| Field name | UI label | Type | Required | Validation | Error message | Default |
|------------|----------|------|----------|------------|---------------|---------|
| `tier` | Tier | select | ⚪ | enum: 'all' / 'T1' / 'T2' / 'T3' / 'T4' | — (select-only no error) | 'all' |
| `status` | Trạng thái | select | ⚪ | enum: 'active' / 'merged' / 'split' / 'all' | — | 'active' |
| `search` | Tìm theo email | text | ⚪ | min 3 chars OR empty, max 100, trim, no SQL special chars | "Cần tối thiểu 3 ký tự" (inline below input) | "" |
| `page` | (URL only) | number | ⚪ | min 1, max 99999, integer | — (auto-clamp) | 1 |
| `limit` | (URL only) | number | ⚪ | enum: 20/50/100 | — (auto-clamp to 20) | 20 |

#### Field Source Table — Screen 1

| Field UI label | Data source | Format hiển thị | Empty state |
|----------------|-------------|-----------------|-------------|
| ID hồ sơ | `cluster.clusterId` slice(0,8) + copy icon | `#${slice(0,8)}` + `<Copy size={14}/>` | N/A (always present) |
| Tier badge | `cluster.tier` via `TIER_LABEL[tier]` | shadcn Badge VN label | "Không xác định" if null |
| Email | `cluster.primaryEmail` raw | text VN font-sans | "—" |
| Số giải | `cluster.linkedAthleteRecords.length` | Badge variant: ≥10 success / 5-9 default / <5 outline | "0" |
| Cập nhật | `cluster.lastUpdatedAt` | `formatDistanceToNow(date, { locale: vi })` (e.g., "2 giờ trước") | "Chưa cập nhật" |
| Confidence (tooltip on tier badge) | `cluster.confidence` | `Độ tin cậy: ${conf} (${tierLabel})` | "Chưa tính" |
| Cluster UUID đầy đủ (techMode only) | `cluster.clusterId` raw | text font-mono text-xs | — |
| MONGO REF (techMode only) | `cluster._id.toString()` | text font-mono text-xs | — |

#### UI States — Screen 1

- **Loading:** 4 KPI cards skeleton + table 8 row skeleton with shimmer
- **Empty (no data ever):** icon `<UsersIcon/>` + heading "Chưa có hồ sơ identity nào" + description "Hồ sơ identity được tự động tạo sau khi đồng bộ giải. Bạn có thể kích hoạt phân cụm thủ công." + CTA "Đi tới đồng bộ giải" link to `/race-master-data/sync-control`
- **Data:** 6-col table populated
- **Filtered empty:** icon `<SearchX/>` + "Không có hồ sơ khớp bộ lọc" + "Thử xóa bộ lọc hoặc thay đổi điều kiện" + "Xoá bộ lọc" button
- **Error fetch:** toast destructive + retry banner above table + "Thử lại" button
- **Search debouncing:** input border highlight subtle + small spinner inside input right side

---

### Screen 2: Detail Page `/athletes/identity-clusters/[clusterId]`

#### Layout

- **Header:**
  - Breadcrumb: `Quản trị / Vận hành / Hồ sơ identity / Chi tiết`
  - Title: `Hồ sơ identity #${clusterId.slice(0,8)}` + copy icon
  - Right: "Quay lại danh sách" outline button
- **Cluster Summary Card:**
  - Email: `daohaian@gmail.com` (full)
  - Tier badge: shadcn Badge "Định danh qua email — Tin cậy cao"
  - Confidence: traffic light Badge with tooltip "Độ tin cậy: 1.0 (T1)"
  - Linked records count: "5 giải đã liên kết"
  - Created: `formatDistanceToNow` Vietnamese
  - Toggle "Hiển thị thông tin kỹ thuật" (per-page state from localStorage)
  - Tech-mode shows: full Cluster UUID + MongoDB ObjectId + emailHash + nameSlug + dobYear + raw confidence number
- **Linked Athletes Records Section:**
  - Heading: "Bản ghi đã liên kết (5)"
  - Table 5 cols: Tên giải / Số BIB / Tên VĐV / Đồng bộ lúc / Hành động
  - Row action: "Phân tách bản ghi này" button (separates single record from cluster)
- **Actions Section:**
  - "Hợp nhất với hồ sơ khác" button → opens dialog with search target cluster
  - "Phân tách hồ sơ" button → opens dialog to select records to split
- **Audit Log Section:**
  - Heading: "Lịch sử hoạt động"
  - Timeline list: cluster.created event / merge events / split events with timestamp + actor

#### UI Step-by-Step Numbered Table — Screen 2

| # | User action | UI behavior | Trigger | Next state |
|---|-------------|-------------|---------|------------|
| 1 | Navigate `/athletes/identity-clusters/{clusterId}` | Render header skeleton + cluster summary card skeleton + table skeleton (~300ms) | TanStack Query `useIdentityClusterDetail(clusterId)` | Loading |
| 2 | API response populates summary card | Email + tier badge + confidence badge + record count animate-in | API 200 | Data state |
| 3 | Linked records table populates | 5 rows render with race name truncate 40 + bib font-mono + athlete name | Same API call | Records data |
| 4 | Click "Phân tách bản ghi này" on row | Confirm dialog "Phân tách bản ghi {bibNumber} - {athleteName} khỏi hồ sơ này? Bản ghi sẽ tạo hồ sơ mới." | onClick | Confirm dialog |
| 5 | Click "Xác nhận phân tách" | POST `/api/admin/identity-clusters/{clusterId}/split` body `{recordIds: [recordId]}` → toast success → refetch | onClick | Split processing |
| 6 | Click "Hợp nhất với hồ sơ khác" button | Dialog opens with search input "Tìm hồ sơ target theo email..." | onClick | Merge dialog open |
| 7 | Type "athlete@example.com" in merge dialog search | Debounced API call → autocomplete dropdown shows top 5 matching clusters with tier badges | onChange + debounce 400ms | Search results |
| 8 | Click target cluster in dropdown | Selected card highlighted in dialog body, "Xác nhận hợp nhất" button enabled | onClick | Target selected |
| 9 | Click "Xác nhận hợp nhất" | POST `/api/admin/identity-clusters/{clusterId}/merge` body `{targetClusterId}` → toast success → navigate to target cluster (merged cluster ID) | onClick | Merge processing |
| 10 | Click copy icon next to cluster ID in header | navigator.clipboard.writeText fullClusterId → toast 2s | onClick | Clipboard copied |
| 11 | Toggle "Hiển thị thông tin kỹ thuật" | Tech-mode section expands showing 6 raw fields | onChange | techMode=true |
| 12 | Click "Quay lại danh sách" | Navigate `/athletes/identity-clusters` preserving filter state from URL params | Next.js Link | List route |

#### Buttons Specification — Screen 2

| Button label | Position | Default state | Disabled state | Loading state | Action | Confirm dialog? |
|--------------|----------|---------------|----------------|---------------|--------|-----------------|
| "Quay lại danh sách" | Header right | Outline | KHÔNG | N/A | Next.js back nav | NO |
| Copy icon | Header next to cluster ID | Ghost icon | KHÔNG | N/A | clipboard.writeText + toast | NO |
| Toggle "Hiển thị thông tin kỹ thuật" | Summary card | Switch OFF | KHÔNG | N/A | localStorage toggle + UI re-render | NO |
| "Hợp nhất với hồ sơ khác" | Actions section | Primary blue | Disabled if cluster.status != active | Spinner + "Đang xử lý..." | Open merge dialog | NO (confirm in dialog) |
| "Phân tách hồ sơ" | Actions section | Outline orange (warning variant) | Disabled if recordsCount ≤ 1 | Spinner + "Đang xử lý..." | Open split dialog | NO (confirm in dialog) |
| "Phân tách bản ghi này" | Linked records table row | Ghost destructive | Disabled if recordsCount ≤ 1 | N/A | Confirm dialog → POST split | YES — "Phân tách bản ghi này khỏi hồ sơ?" |
| "Xác nhận hợp nhất" | Merge dialog footer | Primary blue | Disabled until target selected | Spinner + "Đang hợp nhất..." | POST /merge endpoint | NO (dialog itself IS confirm step) |
| "Xác nhận phân tách" | Split dialog footer | Destructive red | Disabled until records selected | Spinner + "Đang phân tách..." | POST /split endpoint | NO (dialog IS confirm) |
| "Huỷ" | Merge/Split dialog footer | Outline | KHÔNG | N/A | Close dialog | NO |

#### Form Fields Specification — Screen 2 (Merge dialog)

| Field name | UI label | Type | Required | Validation | Error message | Default |
|------------|----------|------|----------|------------|---------------|---------|
| `targetSearch` | Tìm hồ sơ target | text | ⚪ | min 3 chars, max 100, trim | "Cần tối thiểu 3 ký tự" | "" |
| `targetClusterId` | (selected from dropdown) | string | ✅ on submit | UUID v4 format, MUST NOT equal current clusterId | "Không thể hợp nhất với chính nó" | null |

#### Form Fields Specification — Screen 2 (Split dialog)

| Field name | UI label | Type | Required | Validation | Error message | Default |
|------------|----------|------|----------|------------|---------------|---------|
| `recordIds` | Bản ghi cần phân tách | checkbox group | ✅ | min 1 item selected, max (recordsCount - 1) — phải để lại ≥1 bản ghi gốc | "Chọn ít nhất 1 bản ghi" / "Không thể phân tách tất cả — phải giữ ≥1 bản ghi gốc" | [] |

#### Field Source Table — Screen 2

| Field UI label | Data source | Format hiển thị | Empty state |
|----------------|-------------|-----------------|-------------|
| Cluster ID header | `cluster.clusterId` slice(0,8) | `#${slice(0,8)}` font-mono | N/A always present |
| Email | `cluster.primaryEmail` raw | full email font-sans | "Không có email" if T4 anonymous |
| Tier badge | `TIER_LABEL[cluster.tier]` | shadcn Badge | "Chưa phân loại" if null |
| Confidence Badge | `CONFIDENCE_VARIANT(cluster.confidence)` | Badge with tooltip | "Chưa tính" |
| Linked records count | `cluster.linkedAthleteRecords.length` | "{n} giải đã liên kết" | "Chưa liên kết giải nào" |
| Created at | `cluster.createdAt` | `formatDistanceToNow + vi` (e.g., "2 ngày trước") | "Vừa tạo" if <1 min |
| Tên giải (table) | `record.raceName` (NEW from F-049 enrich) | truncate 40 + title attr tooltip | "—" |
| Số BIB (table) | `record.bibNumber` (NEW from F-049 enrich) | font-mono text-sm | "—" |
| Tên VĐV (table) | `record.athleteName` (from existing master cache) | text font-sans | "—" |
| Đồng bộ lúc (table) | `record.syncedAt` | datetime vi-VN locale | "Chưa đồng bộ" |
| Cluster UUID đầy đủ (techMode) | `cluster.clusterId` | font-mono text-xs | — |
| MongoDB ObjectId (techMode) | `cluster._id.toString()` | font-mono text-xs | — |
| emailHash (techMode) | `cluster.emailHash.slice(0,12)` + "..." | font-mono text-xs | "—" T4 |
| nameSlug (techMode) | `cluster.nameSlug` | font-mono text-xs | "—" |
| dobYear (techMode) | `cluster.dobYear` | number | "—" |
| Raw confidence (techMode) | `cluster.confidence` | number 4 decimals | "—" |

#### UI States — Screen 2

- **Loading:** header skeleton + summary card skeleton + table skeleton
- **Data:** all sections populated
- **Error fetch:** toast destructive + retry button in header
- **404 cluster not found:** redirect to `/athletes/identity-clusters` with toast "Không tìm thấy hồ sơ identity"
- **Merge dialog states:** Initial (empty search) → Searching (input has 3+ chars, dropdown loading) → Results (dropdown populated) → Selected (target card highlighted) → Submitting (spinner) → Success (toast + redirect)
- **Split dialog states:** Initial (checkboxes empty) → Selecting (1+ checked, "Xác nhận" enabled) → Submitting (spinner) → Success (toast + refetch detail page)
- **Validation error (split all records):** inline error message + "Xác nhận" disabled

---

## ⚙️ Technical Mandates

### 3.1 DB / Cache changes

- **MongoDB:** ZERO schema change. Collection `athlete_identity_clusters` unchanged.
- **Redis:** ONE new cache key pattern:
  - Key: `races:title:byMysqlId:<mysql_race_id>` (string)
  - Value: `{ title: string, mongoRaceId: string }` JSON stringified
  - TTL: 3600s (1h)
  - Invalidation: NOT required (1h staleness acceptable since race title rarely changes; document trong CLAUDE.md Redis Keys Registry)
- **S3:** ZERO change
- **Migration:** NONE — backward compat per BR-49-16

### 3.2 Backend Endpoint Specification

#### Endpoint 1: GET `/api/admin/identity-clusters` (EXTEND response DTO)

| Element | Spec |
|---------|------|
| Method | GET (unchanged from F-048) |
| Path | `/api/admin/identity-clusters` (unchanged) |
| Auth | `@UseGuards(LogtoAdminGuard)` class-level (unchanged) |
| Guard role | admin (unchanged) |
| Query params | `tier?` / `status?` / `search?` / `page?` / `limit?` / `sortBy?` / `sortDir?` (unchanged) |
| Response DTO | `IdentityClusterListResponseDto` — EXTEND each `linkedAthleteRecords[i]` to ADD `raceName?: string` + `bibNumber?: string` (optional fields, undefined if lookup miss) |
| Status codes | 200 success / 400 validation / 401 no auth / 403 not admin / 500 server (unchanged) |
| Side effects | NONE (read-only) |
| Performance | p95 < 400ms cold / <80ms warm (BR-49-13) |

#### Endpoint 2: GET `/api/admin/identity-clusters/:clusterId` (EXTEND response DTO)

| Element | Spec |
|---------|------|
| Method | GET (unchanged) |
| Path | `/api/admin/identity-clusters/:clusterId` (unchanged) |
| Auth | `@UseGuards(LogtoAdminGuard)` class-level (unchanged) |
| Guard role | admin |
| Path params | `clusterId` UUID v4 (validated by class-validator) |
| Response DTO | `IdentityClusterDetailResponseDto` — EXTEND each `linkedAthleteRecords[i]` to ADD `raceName?: string` + `bibNumber?: string` |
| Status codes | 200 / 400 invalid UUID / 401 / 403 / 404 cluster not found / 500 |
| Side effects | NONE |
| Performance | p95 < 200ms warm |

#### Endpoint 3 + 4 + 5: NO CHANGE

`POST /merge` / `POST /split` / `GET /coverage-stats` — unchanged in F-049 scope.

### 3.3 DTO Field-Level Spec

#### IdentityClusterLinkedRecordDto (EXTEND in F-049)

```typescript
class IdentityClusterLinkedRecordDto {
  @ApiProperty({ description: 'MongoDB ObjectId của race_athletes record' })
  @IsString()
  @IsMongoId()
  mongoRecordId!: string;

  @ApiProperty({ description: 'MySQL race_id (platform DB)' })
  @IsInt()
  @Min(1)
  mysqlRaceId!: number;

  @ApiProperty({ description: 'MySQL athletes_id (platform DB)' })
  @IsInt()
  @Min(1)
  athletesId!: number;

  @ApiPropertyOptional({
    description: 'F-049: Race title joined from races.title (via mysql_race_id lookup, cached 1h)',
    example: 'Vietnam Mountain Marathon Mu Cang Chai 2026',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  raceName?: string;

  @ApiPropertyOptional({
    description: 'F-049: Bib number joined from race_athletes.bib_number (via mysql_race_id + athletes_id)',
    example: '88043',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  bibNumber?: string;

  @ApiPropertyOptional({ description: 'Athlete full name from race_athletes master cache' })
  @IsOptional()
  @IsString()
  athleteName?: string;

  @ApiProperty({ description: 'Sync timestamp from race-master-data' })
  @IsDateString()
  syncedAt!: string;
}
```

#### IdentityClusterDetailResponseDto (EXTEND in F-049)

```typescript
class IdentityClusterDetailResponseDto {
  // All existing F-048 fields unchanged

  @ApiProperty({ description: 'Cluster UUID v4' })
  clusterId!: string;

  @ApiProperty({ description: 'Confidence score 0.0-1.0' })
  confidence!: number;

  @ApiProperty({ enum: ['T1', 'T2', 'T3', 'T4'] })
  tier!: 'T1' | 'T2' | 'T3' | 'T4';

  @ApiPropertyOptional({ description: 'Primary email (full, no redact for admin)' })
  primaryEmail?: string;

  @ApiPropertyOptional({ description: 'SHA256 hash of email (used for log proxy, NOT for UI)' })
  emailHash?: string;

  @ApiProperty({ enum: ['active', 'merged', 'split'] })
  status!: 'active' | 'merged' | 'split';

  @ApiProperty({ type: [IdentityClusterLinkedRecordDto], description: 'F-049: Enriched with raceName + bibNumber' })
  linkedAthleteRecords!: IdentityClusterLinkedRecordDto[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  lastUpdatedAt!: string;
}
```

### 3.4 Frontend / Admin (Next.js)

#### Architecture

- **Route group:** `(dashboard)` — existing protected
- **Component boundaries:**
  - `page.tsx` (list) — Server Component shell + Client Component table
  - `[clusterId]/page.tsx` — Server Component shell + Client Component summary/table/dialogs
- **SDK regen:** YES — after DTO field add, run `pnpm --filter admin generate:api`
- **TanStack Query keys:** `['identity-clusters', { tier, status, search, page, limit, sortBy, sortDir }]` + `['identity-cluster', clusterId]`
- **Cache invalidation post-mutation:** `queryClient.invalidateQueries({ queryKey: ['identity-clusters'] })` + `['identity-cluster', clusterId]` + `['identity-cluster-coverage']` after merge/split
- **No `revalidatePath`** (client-side TanStack handles re-fetch)

#### Required dictionary file `admin/src/lib/identity-cluster-labels.ts` (NEW)

```typescript
import { ReactNode } from 'react';

export const TIER_LABEL: Record<'T1' | 'T2' | 'T3' | 'T4', string> = {
  T1: 'Định danh qua email — Tin cậy cao',
  T2: 'Định danh qua Tên + Năm sinh + Giới tính — Tin cậy trung bình',
  T3: 'Cần xem xét lại — Tin cậy thấp',
  T4: 'Không định danh được',
};

export const TIER_SHORT_LABEL: Record<'T1' | 'T2' | 'T3' | 'T4', string> = {
  T1: 'Tin cậy cao',
  T2: 'Trung bình',
  T3: 'Cần xem xét',
  T4: 'Không định danh',
};

export const CONFIDENCE_VARIANT = (conf: number): 'success' | 'warning' | 'destructive' | 'secondary' => {
  if (conf >= 0.9) return 'success';
  if (conf >= 0.6) return 'warning';
  if (conf >= 0.1) return 'destructive';
  return 'secondary';
};

export const CONFIDENCE_LABEL = (conf: number): string => {
  if (conf >= 0.9) return 'Tin cậy cao';
  if (conf >= 0.6) return 'Tin cậy trung bình';
  if (conf >= 0.1) return 'Cần xem xét';
  return 'Không xác định';
};

export const STATUS_LABEL: Record<'active' | 'merged' | 'split', string> = {
  active: 'Hoạt động',
  merged: 'Đã hợp nhất',
  split: 'Đã phân tách',
};

export const ACTION_LABEL = {
  split: 'Phân tách hồ sơ',
  merge: 'Hợp nhất với hồ sơ khác',
  splitOneRecord: 'Phân tách bản ghi này',
  viewDetail: 'Xem chi tiết',
  copyId: 'Sao chép ID',
} as const;
```

#### Components to create / modify

| File | Role | Action |
|------|------|--------|
| `admin/src/lib/identity-cluster-labels.ts` | Dictionary VN | CREATE |
| `admin/src/app/(dashboard)/athletes/identity-clusters/page.tsx` | List page | REWRITE |
| `admin/src/app/(dashboard)/athletes/identity-clusters/[clusterId]/page.tsx` | Detail page | REWRITE |
| `admin/src/components/identity-clusters/IdentityClusterTable.tsx` | List table component | CREATE (extract from page.tsx) |
| `admin/src/components/identity-clusters/ClusterSummaryCard.tsx` | Detail summary card | CREATE |
| `admin/src/components/identity-clusters/LinkedRecordsTable.tsx` | Records table | CREATE |
| `admin/src/components/identity-clusters/MergeClusterDialog.tsx` | Merge dialog | CREATE |
| `admin/src/components/identity-clusters/SplitClusterDialog.tsx` | Split dialog | CREATE |
| `admin/src/components/identity-clusters/TechModeToggle.tsx` | Toggle + localStorage hook | CREATE |
| `admin/src/components/identity-clusters/CopyClusterIdButton.tsx` | Copy icon + toast | CREATE |
| `admin/src/lib/api-hooks.ts` | Add `useIdentityClustersList()` + `useIdentityClusterDetail(id)` + mutations | EXTEND |

### 3.5 PAUSE flags

- ❌ NO MongoDB schema migration
- ❌ NO `pnpm install` new dep (uses existing shadcn/ui Badge + Switch + Dialog + Toast)
- ❌ NO auth/security logic change
- ✅ Response DTO ADDS optional fields ONLY (`raceName?`, `bibNumber?`) — NOT a breaking change per BR-49-16, but Manager VERIFY:
  - `pnpm --filter admin generate:api` regen success
  - Existing F-048 admin code uses `optional chain` so unchanged usage works (graceful)

---

## 🧪 Testing Mandates

### 4.1 Backend Test Cases (TC-49-XX)

#### TC-49-01 Happy path — GET cluster list with raceName/bibNumber enriched

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/identity-clusters?tier=T1&limit=2` |
| Headers | `Authorization: Bearer <admin_token>` |
| Body | (none) |
| Expected status | 200 |
| Expected body shape | `{ data: [{ clusterId, tier: 'T1', linkedAthleteRecords: [{ mongoRecordId, mysqlRaceId, athletesId, raceName: 'Vietnam Mountain Marathon Mu Cang Chai 2026', bibNumber: '88043', athleteName, syncedAt }] }], total, page, limit }` |
| MUST NOT leak | `_id` raw, `__v`, `emailHash` SHA256 full (only first 12 chars in techMode), internal `mongoose` internals |
| Side effect verify | Redis `races:title:byMysqlId:192` SET (TTL 3600s). NO database write. |

#### TC-49-02 Happy path — GET cluster detail with linked records enriched

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/identity-clusters/f47ac10b-58cc-4372-a567-0e02b2c3d479` |
| Headers | `Authorization: Bearer <admin_token>` |
| Expected status | 200 |
| Expected body shape | `{ clusterId, tier, primaryEmail: 'daohaian@gmail.com', confidence: 1.0, linkedAthleteRecords: [{ raceName, bibNumber }], status: 'active', createdAt, lastUpdatedAt }` |
| MUST NOT leak | `__v`, internal Mongoose `_id` (use clusterId UUID instead) |

#### TC-49-03 Race not found (orphan record) — graceful degrade

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/identity-clusters/{clusterId}` where cluster has record with `mysql_race_id=999999` (race not in MongoDB) |
| Expected status | 200 |
| Expected body shape | `linkedAthleteRecords[0].raceName === undefined` (NOT throw), `bibNumber === undefined` |
| Side effect verify | NO 500 error. Logger.warn `Race not found for mysql_race_id=999999` |

#### TC-49-04 Race name cache hit — performance

| Element | Value |
|---------|-------|
| Setup | Pre-seed Redis `races:title:byMysqlId:192` = `{title: 'VMM 2026', mongoRaceId: '...'}` |
| Method | GET |
| URL | `/api/admin/identity-clusters?limit=20` (all 20 clusters link to race 192) |
| Expected status | 200 |
| Expected response time | <80ms (warm cache) |
| Side effect verify | MongoDB `races` collection query NOT executed (Redis hit) |

#### TC-49-05 Auth missing — 401

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/identity-clusters` |
| Headers | (no Authorization) |
| Expected status | 401 |
| Expected body shape | `{ statusCode: 401, message: 'Unauthorized' }` |

#### TC-49-06 Non-admin role — 403

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/identity-clusters` |
| Headers | `Authorization: Bearer <staff_token>` (staff, not admin) |
| Expected status | 403 |
| Expected body shape | `{ statusCode: 403, message: 'Forbidden — admin role required' }` |

#### TC-49-07 Invalid UUID — 400

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/identity-clusters/not-a-uuid` |
| Headers | `Authorization: Bearer <admin_token>` |
| Expected status | 400 |
| Expected body shape | `{ statusCode: 400, message: ['clusterId must be a UUID'] }` |

#### TC-49-08 N+1 query prevention — single $in aggregation

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/identity-clusters?limit=100` (100 clusters × avg 5 linked records = 500 records) |
| Setup | Spy on `racesService.findMany()` calls (mock or jest spy) |
| Expected status | 200 |
| Side effect verify | `racesService.findMany()` called EXACTLY 1 time (single `$in` for all unique mysql_race_ids). NOT called 100 or 500 times. |
| Performance | <400ms cold (BR-49-13) |

#### TC-49-09 Tier filter — only T3 returned

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/identity-clusters?tier=T3` |
| Expected status | 200 |
| Expected body shape | `data` array contains only clusters where `tier === 'T3'` |
| Side effect verify | MongoDB query has `{tier: 'T3'}` in filter |

#### TC-49-10 Search by email substring — partial match

| Element | Value |
|---------|-------|
| Method | GET |
| URL | `/api/admin/identity-clusters?search=daoh` |
| Expected status | 200 |
| Expected body shape | Returns clusters with `primaryEmail` matching `/daoh/i` regex (case-insensitive substring) |
| Side effect verify | Regex used `escapeRegex(search)` defense against ReDoS |

### 4.2 Frontend E2E Test Cases (Playwright)

| TC | Persona | Journey | Steps | Expected |
|----|---------|---------|-------|----------|
| E2E-49-01 | Back-Office Admin | List page navigate + filter T3 | 1. Login admin 2. Navigate `/athletes/identity-clusters` 3. Select Tier "Cần xem xét" 4. Verify table reload | Table shows only T3 clusters with destructive badge "Cần xem xét" |
| E2E-49-02 | Back-Office Admin | Copy cluster ID | 1. List page 2. Click copy icon next to `#f47ac10b` 3. Verify toast | Toast 2s "Đã sao chép ID hồ sơ: f47ac10b-58cc-4372-a567-0e02b2c3d479". Clipboard contains full UUID. |
| E2E-49-03 | Back-Office Admin | Detail page race name + bib display | 1. List page 2. Click "Xem chi tiết" on cluster with 5 linked records 3. Verify table | Table 5 cols populated: Race name truncate ("Vietnam Mountain Marathon Mu Cang...") with tooltip showing full title on hover. Bib font-mono "88043". |
| E2E-49-04 | Back-Office Admin | Merge clusters | 1. Detail page cluster A 2. Click "Hợp nhất với hồ sơ khác" 3. Search "athlete@example" 4. Click target B 5. Click "Xác nhận hợp nhất" | Toast success "Hợp nhất thành công". Navigate to cluster B detail. Cluster A status: merged. |
| E2E-49-05 | Back-Office Admin | Split single record | 1. Detail page cluster with 3 records 2. Click "Phân tách bản ghi này" on row 1 3. Confirm dialog 4. Verify | Toast success "Phân tách thành công". Cluster A now has 2 records. New cluster with 1 record created. |
| E2E-49-06 | Engineer | Toggle tech mode | 1. List page 2. Click "Hiển thị thông tin kỹ thuật" toggle 3. Verify | Extra columns appear: "Cluster UUID đầy đủ" + "MONGO REF". localStorage `identity-clusters:tech-mode = true`. |
| E2E-49-07 | Back-Office Admin | Empty filter result | 1. List page 2. Filter Tier=T1 + Search="zzz999nonexistent" 3. Verify | Empty state icon + "Không có hồ sơ khớp bộ lọc" + "Xoá bộ lọc" button. Click clear → reset filters, see all clusters. |
| E2E-49-08 | Back-Office Admin | Validation prevent split-all | 1. Detail page cluster 3 records 2. Click "Phân tách hồ sơ" 3. Select all 3 records 4. Try click "Xác nhận phân tách" | "Xác nhận phân tách" disabled. Inline error "Không thể phân tách tất cả — phải giữ ≥1 bản ghi gốc". |
| E2E-49-09 | Back-Office Admin | Empty cluster list (no data) | 1. Fresh MongoDB (zero clusters) 2. Navigate list page | Empty state with link CTA "Đi tới đồng bộ giải" → click navigates to `/race-master-data/sync-control`. |
| E2E-49-10 | Back-Office Admin | Pagination + sort persistence | 1. List page 2. Click Next page (page=2) 3. Refresh browser | URL `?page=2` preserved. Sort default `lastUpdatedAt DESC` retained. Table re-renders page 2 correctly. |
| E2E-49-11 | Back-Office Admin | Stability 10x rapid filter clicks | 1. List page 2. Click tier filter 10x rapid back-and-forth T1/T2/T3 3. Verify final state | Final filter renders correctly. NO race condition where stale data shows. TanStack Query cancellation works. |
| E2E-49-12 | Back-Office Admin | Race name tooltip on hover | 1. Detail page 2. Hover mouse over truncated race name cell | After 500ms, browser tooltip appears showing full race title "Vietnam Mountain Marathon Mu Cang Chai 2026". |

### 4.3 Security Checks

- [x] Endpoints `/api/admin/identity-clusters` + `/:clusterId` protected by `LogtoAdminGuard` — verify 401 unauth + 403 non-admin
- [x] IDOR: no `:tenantId` scope (cluster collection is internal admin domain, not per-tenant)
- [x] Response KHÔNG leak: `_id` raw (use `clusterId` UUID), `__v`, internal `mongoose` props, `emailHash` SHA256 full (only first 12 chars in techMode)
- [x] Email full display in admin UI is GATED by `LogtoAdminGuard` (BR-49-15) — verify guard works correctly
- [x] Search input sanitization: `escapeRegex()` defense against ReDoS, max 100 chars input
- [x] Copy-to-clipboard uses `navigator.clipboard.writeText` (HTTPS-only, no fallback document.execCommand for security)
- [x] Race name cache key `races:title:byMysqlId:<id>` uses `parseInt()` validation, no string injection

### 4.4 Performance SLA

- p95 GET `/api/admin/identity-clusters?limit=20` < **400ms** cold cache / <**80ms** warm cache (BR-49-13)
- p95 GET `/api/admin/identity-clusters/:clusterId` < **200ms** warm
- Cache hit ratio for `races:title:byMysqlId:*` expected >**95%** after 1h steady state (race title rarely changes, 1h TTL is generous)
- 10x flaky test: TC-49-08 rapid 10 consecutive calls — verify NO N+1 regression (`findMany()` called exactly 10 times total across 10 calls, NOT 10 × N)
- Frontend list page Time-to-Interactive (TTI): <**1.5s** on 4G simulated
- Frontend detail page TTI: <**1.0s**

---

## 🛡️ Answers to Manager's PAUSE Conditions

All 8 PAUSE-49-* confirmed (see `00-manager-init.md`):

| ID | Status | Final answer |
|----|--------|--------------|
| PAUSE-49-01 | ✅ ACCEPTED | Cluster ID truncate 8 char + copy icon |
| PAUSE-49-02 | ⚠️ OVERRIDE | Full email display (no redact for admin). PII defense via guard + select:false + log hash proxy. **PRD document boundary BR-49-02 + BR-49-15.** |
| PAUSE-49-03 | ✅ ACCEPTED | shadcn Badge variant traffic light |
| PAUSE-49-04 | ✅ ACCEPTED | Tier VN business labels (4 strings dictionary) |
| PAUSE-49-05 | ✅ ACCEPTED | "Phân tách hồ sơ" / "Hợp nhất với hồ sơ khác" |
| PAUSE-49-06 | ✅ ACCEPTED | MONGO REF behind "Hiển thị thông tin kỹ thuật" toggle |
| PAUSE-49-07 | ✅ ACCEPTED | Race name truncate 40 + tooltip |
| PAUSE-49-08 | ✅ ACCEPTED | Confidence raw number in tooltip on Badge hover |

---

## ✅ Status & Next step

**Status:** 🔵 READY

**Danny next step:** `/5bib-manager FEATURE-049-f048-admin-ux-humanization` để Manager review plan + Scope Lock cho Coder.

**Parallel track:** F-047 resume Coder trigger trong session riêng (đọc `07-resume-kickoff.md`).

---

## 🔗 References

- Parent F-048: `.5bib-workflow/features/FEATURE-048-athlete-identity-foundation/03-coder-implementation.md`
- F-049 init: `00-manager-init.md` (this folder)
- F-047 parallel resume: `.5bib-workflow/features/FEATURE-047-athlete-profile-pages/07-resume-kickoff.md`
- Display Convention rule: `CLAUDE.md` "KHÔNG render raw enum/snake_case cho user"
- Dictionary pattern reference: `admin/src/lib/finance-labels.ts`
- shadcn Badge variants: `admin/src/components/ui/badge.tsx`
- Redis Keys Registry update needed: `CLAUDE.md` — add `races:title:byMysqlId:<mysql_race_id>` row
