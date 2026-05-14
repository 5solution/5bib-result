# FEATURE-033: Manager Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-05-14
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md` đầy đủ
- [x] Đã đọc `01-ba-prd.md` toàn bộ — 12 BR-PH33-* + 8 PAUSE answered + Tech mandates clean
- [x] Đã cross-check memory `conventions.md` (named connection pattern + anti-pattern Buffer bit type)
- [x] Đã spot-check `backend/src/modules/race-master-data/entities/race-course-readonly.entity.ts` (pattern template) + `reconciliation.service.ts` (cross-DB query pattern)

---

## ✓ PRD Validation Checklist

### Completeness
- [x] 3 User Stories (Admin MKT / Visitor / Admin toggle) + Personas chuẩn
- [x] 12 Business Rules có ID (BR-PH33-01 → 12)
- [x] All 8 PAUSE-PH33-* answered explicit

### Technical correctness vs codebase
- [x] DTO shape proper (strip tenant_id, isShow, isDelete) ✓
- [x] Entity `@Entity('races')` qua named connection `'platform'` ✓ (pattern F-016/F-019/F-028)
- [x] Cache key `promo-hub:races-on-sale:<...>` conform `[resource]:[id]:[variant]` ✓
- [x] TypeORM bit type → Buffer handling explicit (PRD note `.readUInt8(0) === 1`) ✓
- [x] SDK regen flagged post-DTO change ✓

### Security
- [x] Public endpoint NO `LogtoAdminGuard` (Promo Hub public — correct per F-027 baseline)
- [x] No sensitive field leak (`tenant_id`, `metadata`, `created_by_id` stripped)
- [x] SQL injection vector → enum whitelist for `sort` query param
- [x] ThrottlerGuard default tier inherit

### Performance
- [x] SLA p95 cached ≤500ms / cold ≤800ms — measurable
- [x] Cache TTL 60s + invalidation strategy (TTL only — race lifecycle ở 5Ticket, không control)
- [x] Limit max 20 → bound query

### Testability
- [x] Happy paths 4 scenarios
- [x] Unhappy 8+ scenarios (status DRAFT/CANCEL, is_delete, is_show, url_name NULL, limit OOB, sort invalid, MySQL drop, Redis throw)
- [x] Concurrency: 10x fetch
- [x] Security: tenant_id leak check

---

## 📊 Cross-check với memory

### Architecture impact
- F-033 extend F-027 PromoHubModule với 1 entity + 1 service method + 1 controller endpoint
- ZERO ảnh hưởng F-024 contracts / F-028 finance / F-029 hardening / F-027 base 19 section types
- Pattern reuse F-016/F-019/F-028 named connection `'platform'` — no new arch precedent

### Conventions impact
- 1 NEW pattern minted (small):
  - **Backward-compat field via defensive default**: BR-PH33-12 — service coerce missing `source` field → `result_active`. Reusable for future schema migrations on subdoc array fields.
- KHÔNG vi phạm convention nào hiện có

### Known issues impact
- F-033 KHÔNG đụng 5 CRIT defer (dump.rdb / JWT / upload / SSRF / CI PAT)
- F-033 KHÔNG fix TD-F027-PHASE2-13 group-by-month (out of scope, defer Phase 2)
- TD-F027-PHASE2-01 (race picker UI) — F-033 không scope, vẫn defer
- Backward-compat F-027 hub existing — handled per BR-PH33-12 (no break)

---

## 📋 Files được phép thay đổi (Scope Lock)

Coder CHỈ được thay đổi files dưới — đụng ngoài = scope creep, phải hỏi Manager.

### Backend (3 NEW + 3 MODIFY)

**NEW:**
- `backend/src/modules/promo-hub/entities/race-readonly.entity.ts` — TypeORM entity `@Entity('races')` qua `'platform'` connection
- `backend/src/modules/promo-hub/dto/race-on-sale-response.dto.ts` — public response DTO + `RacesOnSaleQueryDto` (limit + sort enum)
- `backend/src/modules/promo-hub/services/races-on-sale.service.ts` — service riêng (tách khỏi `promo-hub.service.ts` cho clean SRP) HOẶC inline thành method `PromoHubService.findRacesOnSale()` (Coder chọn — không scope creep nếu inline)

**MODIFY:**
- `backend/src/modules/promo-hub/promo-hub.module.ts` — register `TypeOrmModule.forFeature([RaceReadonly], 'platform')` + provider RacesOnSaleService (nếu tách)
- `backend/src/modules/promo-hub/promo-hub.controller.ts` — add `@Get('races-on-sale')` endpoint
- `backend/src/modules/promo-hub/promo-hub.service.spec.ts` — add 6 new tests per PRD Testing Mandates

### Frontend (1 MODIFY + 1 NEW helper)

**MODIFY:**
- `frontend/components/hub/sections/RaceCalendarSection.tsx` — branch by `source` config field, add platform fetch path + new field render

**NEW (small helper):**
- `frontend/components/hub/internal-urls.ts` — extend với `getTicketUrl(urlName)` (file đã exist từ F-027 cross-app rewrite — reuse pattern)

### Admin (2 MODIFY + SDK regen)

**MODIFY:**
- `admin/src/components/promo-hub/section-types.ts` — update `race_calendar` description + defaultConfig
- `admin/src/components/promo-hub/SectionConfigDialog.tsx` — case `'race_calendar'` add Source select + conditional fields

**Auto regen:**
- `admin/src/lib/api-generated/*.gen.ts` (run `pnpm --filter admin generate:api`)
- `frontend/lib/api-generated/*.gen.ts` (run `pnpm --filter frontend generate:api`)

---

## 🔧 Tech approach

**Service architecture choice (Coder discretion):**
- **Option A (recommended):** Inline `findRacesOnSale()` method trong `PromoHubService` — keeps file count low, share cache prefix infra
- **Option B:** Tách `RacesOnSaleService` riêng — better SRP nếu future thêm logic complex (vd analytics on sale rate)

→ Manager prefers **A** (pragmatic MVP). Coder có thể đề xuất B nếu thấy clean hơn.

**Bit type handling:** TypeORM với MySQL `bit(1)` returns Buffer. Pattern verified F-019 awards (`is_show`-like fields). Coder MUST use `CAST(... AS UNSIGNED) = 0/1` trong raw query path, hoặc check `.readUInt8(0) === 1` sau entity load.

**Cache invalidation:** TTL-only (60s) — KHÔNG cross-write invalidation vì backend KHÔNG own race lifecycle. Acceptable lag 60s cho promo use case.

**Anti-stampede:** Reuse F-027 SETNX lock pattern (`promo-hub-lock:` prefix) nếu Coder thấy traffic spike likely. Optional cho MVP (limit 20 race × 60s cache = light load).

---

## 🛑 PAUSE points cho Coder

KHÔNG có PAUSE blocking nào cho Coder. Tech approach clear, BR cover hết edge cases, pattern reuse.

Soft check trước khi mark READY_FOR_QC:
- 🛑 Nếu `RaceReadonly` entity bit type Buffer trả về `{type: 'Buffer', data: [0]}` trong query result instead of boolean → fix bằng `CAST(... AS UNSIGNED)` trong QueryBuilder
- 🛑 Nếu MySQL platform read-only user thiếu quyền SELECT trên column nào → adjust entity, KHÔNG request DB privilege escalation
- 🛑 Frontend SDK regen sau backend DTO ready — đừng quên (F-029 lesson)

---

## 🧪 Unit test BẮT BUỘC

Coder PHẢI viết trong `promo-hub.service.spec.ts`:

- [ ] `findRacesOnSale() returns races filtered by status=GENERATED_CODE + is_delete=0 + is_show=1 + url_name NOT NULL`
- [ ] `findRacesOnSale() respects limit + sort param`
- [ ] `findRacesOnSale() Redis cache hit on 2nd call (mock Redis get returns cached value)`
- [ ] `findRacesOnSale() Redis throw → fallback DB direct (graceful degrade)`
- [ ] `findRacesOnSale() transforms RaceReadonly → DTO (strip tenant_id, isShow, isDelete)`
- [ ] `findRacesOnSale() pre-computes ticketUrl = https://5ticket.vn/event/<urlName>`
- [ ] DTO validation: `RacesOnSaleQueryDto` rejects sort = "DROP TABLE" (enum whitelist)
- [ ] DTO validation: `RacesOnSaleQueryDto` rejects limit > 20 / limit < 1

→ Minimum 8 tests. Paste output PASS trong `03-coder-implementation.md`.

---

## 📊 Verdict

> ### ✅ APPROVED — Coder có thể bắt đầu

PRD covers all 12 BR + 8 PAUSE explicitly. Scope Lock 6 files (3 NEW + 3 MODIFY backend, 1 MODIFY + 1 NEW helper frontend, 2 MODIFY admin). Pattern reuse known-good. Zero conflict với in-flight feature.

Manager pre-approve service architecture Option A (inline method) — Coder có thể chọn B nếu thấy clean hơn.

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] Yes — Coder có thể bắt đầu

## 🔗 Next step

`/5bib-code FEATURE-033-promo-hub-platform-race-sync`
