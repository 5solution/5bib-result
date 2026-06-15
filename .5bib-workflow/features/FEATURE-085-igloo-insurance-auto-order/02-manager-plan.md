# FEATURE-085: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-06-15
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check

- [x] Đã đọc `00-manager-init.md`
- [x] Đã đọc `01-ba-prd.md` toàn bộ + block "DANNY ĐÃ CHỐT 2026-06-15 AUTHORITATIVE OVERRIDES" + BR-IGL-01..19
- [x] Đã đọc memory: `codebase-map.md` (promo-hub/landing/race-master-data) + `known-issues.md` (TD-RUNNERS-PRIVACY-CONSENT, F-015 no-log-CMND, TD-F083-SDK-REGEN)
- [x] **Spot-check code thật (session này):** xem section dưới

---

## 🔬 Spot-check code thật (MANDATORY)

| File PRD reference | Verify | Kết quả |
|---|---|---|
| `promo-hub/entities/race-readonly.entity.ts` | `@Entity('races')` có title/eventStartDate/eventEndDate/location/province/district/raceType? | ✅ ĐÚNG — đủ field, reuse, KHÔNG entity mới |
| `race-master-data/entities/athlete-readonly.entity.ts` | `@Entity('athletes')` có name/email/dob/race_id/bib_number/subinfo_id; thiếu `created_on`? | ✅ ĐÚNG — thiếu `created_on`, cần thêm 1 cột. Verify DB thật: cột `created_on datetime(6)` tồn tại + query được + grant OK (đã `SELECT created_on` thành công từ readonly user) |
| `athlete-subinfo-readonly.entity.ts` | gender/contact_phone/id_number? | ✅ ĐÚNG |
| `race-master-data/jobs/ended-race-master-sync.cron.ts` | precedent `@Cron` + Redis SETNX `acquireLock/releaseLock`? | ✅ ĐÚNG — port pattern cho 3 cron mới |
| `races/races.module.ts` | precedent `HttpModule` (`@nestjs/axios`)? | ✅ ĐÚNG — dùng cho Igloo client |
| `app.module.ts` forRoot 'platform' `entities[]` | AthleteReadonly/AthleteSubinfoReadonly/RaceReadonly đã đăng ký? | ✅ ĐÚNG — thêm cột `created_on` KHÔNG cần entity mới (khác F-033/F-037 vì không phải entity mới) |
| Admin guard | `LogtoAdminGuard` chuẩn? | ✅ ĐÚNG (analytics/landing/bug-reports) |
| Igloo API key | active? | ✅ verified 2026-06-15 (POST `{}` → 400 validation, qua auth) |

**KHÔNG có hallucination** — mọi file/field PRD reference khớp code thật.

---

## ✓ PRD Validation Checklist

### Completeness
- [x] User Stories đầy đủ + Persona chuẩn (Back-Office Admin + Tech Lead)
- [x] Business Rules có ID (BR-IGL-01..19) + block OVERRIDES authoritative
- [x] Tất cả PAUSE conditions (11 ở file 00 + 8 ở PRD) đã được Danny trả lời 2026-06-15
- [x] UI states đầy đủ (loading/empty/filtered-empty/error/submitting/success/validation/confirm/submit-disabled banner)

### Technical correctness vs codebase
- [x] DB change: collection Mongo mới `igloo_insurance_requests` (additive, KHÔNG migration) + thêm 1 cột readonly entity (KHÔNG migration)
- [x] Endpoint REST convention OK (7 admin endpoints)
- [x] Named connection `'platform'` dùng đúng cho legacy MySQL
- [x] `generate:api` sau đổi DTO (hoặc hand-typed wrapper landing-precedent — TD)
- [x] Idempotency design (unique `partnerRefId`) race-safe

### Security
- [x] `LogtoAdminGuard` mọi endpoint → 401/403
- [x] Response strip `_id` raw / `partnerRefId` / `__v`
- [x] Audit log mỗi lần tạo đơn (actor + athletesId + raceId + amount)
- [x] SQL legacy parameterized (`?` placeholder — search `q` KHÔNG interpolate)
- [x] PII: Danny chốt KHÔNG mask hiển thị/lưu; hygiene log dùng athletesId (good practice)

### Performance
- [x] SLA cụ thể: eligible-athletes p95 < 800ms · POST batch p95 < 500ms · submit-worker pool ≤5
- [x] 10× concurrent create stability test

### An toàn vận hành (đặc thù feature tiền thật)
- [x] **2 kill-switch** `IGLOO_DAILY_ENABLED` + `IGLOO_SUBMIT_ENABLED` default `false` → dev KHÔNG egress
- [x] Idempotency chống tạo trùng/đốt tiền
- [x] Redis SETNX 3 lock chống cron double-fire

---

## 📊 Cross-check với memory

**Architecture impact:** Module mới `igloo-insurance` — integration point NGOÀI mới (Igloo/GIC qua HTTPS). Thêm node vào architecture.md sau deploy: `IglooInsuranceModule` (3 cron + HTTP client) đọc legacy 'platform' + ghi Mongo `igloo_insurance_requests`. KHÔNG phá flow hiện tại.

**Convention impact:** Pattern mới đáng ghi sau ship — "hàng đợi nội bộ QUEUED→submit→poll cho external async API + 2-tier kill-switch". Tái sử dụng được cho integration bên thứ ba tương lai.

**Known-issues impact:**
- TD-RUNNERS-PRIVACY-CONSENT (NĐ13/2023) — feature này CŨNG đẩy PII ra ngoài. Danny đã chấp nhận rủi ro (BR-IGL OVERRIDES #7 không cần consent). Manager ghi nhận, KHÔNG block (business decision của owner). → thêm 1 known-issue tracking sau deploy.
- F-015 "never log full CMND" — áp dụng: app log KHÔNG spam CCCD (hygiene, dù Danny không yêu cầu mask hiển thị).
- TD-F083-SDK-REGEN — admin dùng hand-typed wrapper được (precedent landing), generate:api defer.

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ được đụng các file/folder sau. Ngoài scope = scope creep → hỏi Manager.

**Backend NEW — `backend/src/modules/igloo-insurance/`:**
- ➕ `igloo-insurance.module.ts`
- ➕ `services/igloo-http.service.ts` — HTTP client (`@nestjs/axios`): `createRequest()` POST + `getStatus()` GET, header `X-API-Key`, base `IGLOO_BASE_URL`
- ➕ `services/igloo-selection.service.ts` — legacy MySQL eligibility query + "created_on hôm nay" + top-up từ kho (inject `@InjectRepository(..., 'platform')`)
- ➕ `services/igloo-request.service.ts` — Mongo CRUD + idempotency + state machine + audit log
- ➕ `igloo-insurance.controller.ts` — 7 endpoints `@UseGuards(LogtoAdminGuard)` + `@ApiResponse` đủ codes
- ➕ `crons/igloo-daily.cron.ts` — `@Cron` `IGLOO_CRON_HOUR`, gated `IGLOO_DAILY_ENABLED`, SETNX `igloo:daily-lock:<date>`
- ➕ `crons/igloo-submit-worker.cron.ts` — `@Cron` mỗi 1 phút, gated `IGLOO_SUBMIT_ENABLED`, SETNX `igloo:submit-lock`
- ➕ `crons/igloo-poll-worker.cron.ts` — `@Cron` mỗi 2 phút, SETNX `igloo:poll-lock`
- ➕ `schemas/igloo-insurance-request.schema.ts` — collection `igloo_insurance_requests` (unique `partnerRefId` + index status/mysqlRaceId/athletesId)
- ➕ `dto/*.dto.ts` — CreateIglooRequestsDto, CreateIglooRequestsResultDto, EligibleAthleteDto, IglooRequestDto, IglooRaceDto, IglooConfigDto, paginated wrappers
- ➕ `utils/igloo-helpers.ts` — `normalizePhone` · `derivePackageCode`(→ROAD always per OVERRIDES) · `computeCoverage`(1 ngày) · `computePremium`(flat 10000) · `isEligible` · `buildPartnerRefId` · `buildIglooPayload`
- ➕ `*.spec.ts` — unit tests (helpers + service + cron gating)

**Backend MODIFY:**
- ✏️ `race-master-data/entities/athlete-readonly.entity.ts` — **THÊM cột `created_on: Date`** (`@Column({ type: 'datetime', nullable: true }) created_on`). KHÔNG đổi field khác.
- ✏️ `app.module.ts` — import + register `IglooInsuranceModule` (sau RaceMasterDataModule). KHÔNG đụng forRoot entities (reuse entity đã có).
- ✏️ `src/config/index.ts` — thêm validate `IGLOO_*` env (baseUrl/apiKey/dailyCount/cronHour/dailyEnabled/submitEnabled).
- ✏️ `.env.example` — đã thêm IGLOO_* (Manager đã làm); thêm `IGLOO_SUBMIT_ENABLED=false`.

**Admin NEW — `admin/src/`:**
- ➕ `app/(dashboard)/insurance/page.tsx` — Server shell
- ➕ `components/insurance/InsuranceCreateTab.tsx` + `InsuranceOrdersTab.tsx` (Client)
- ➕ `lib/insurance-api.ts` + `lib/insurance-hooks.ts` (hand-typed wrapper, landing precedent)
- ➕ `lib/insurance-labels.ts` — dictionary VN (status/packageCode/relationCode/source)
- ✏️ `lib/nav-groups.ts` (hoặc Sidebar) — thêm mục "Bảo hiểm Igloo", `requireRole: admin`

**⛔ NGOÀI scope (cần Manager duyệt nếu đụng):** OrderService/fee logic, race-master-data sync services, bất kỳ collection/entity khác, Logto guard internals, frontend public.

---

## 🔧 Tech approach (đề xuất)

- **HTTP client:** `HttpModule` (`@nestjs/axios`) + `firstValueFrom`, timeout 15s, retry KHÔNG tự động ở submit (FAILED → admin retry). Header `X-API-Key` từ ConfigService.
- **Eligibility query:** 1 SQL JOIN `athletes a` + `athlete_subinfo s ON a.subinfo_id=s.id` + `races r ON a.race_id=r.race_id`, WHERE đủ KYC + `r.event_start_date >= CURDATE()` + `(a.deleted IS NULL OR a.deleted=0)`; phone/CCCD/gender filter ở SQL hoặc Node (chấp nhận cả 2 — Node dễ test helper). LEFT JOIN Mongo dedup ở app layer (loại đã có đơn).
- **State machine:** local enum thêm `QUEUED` trước `PENDING`. submit-worker: `QUEUED`→POST→`PENDING`(+iglooRequestId)/`FAILED`. poll-worker: non-terminal + iglooRequestId → GET → cập nhật.
- **Idempotency:** check Mongo trước insert + unique index `partnerRefId` làm chốt cuối (catch E11000 → skip).
- **Cron lock:** port `ended-race-master-sync.cron.ts` acquireLock/releaseLock pattern.
- **PII:** lưu `insuredIdCard` đầy đủ (Danny chốt KHÔNG mask); app log dùng `athletesId`.

---

## 🛑 PAUSE points cho Coder

- 🛑 **PAUSE-Coder-01** — Verify SELECT grant `created_on` (Manager đã verify query được từ local; Coder confirm lại trong môi trường backend trước khi map).
- 🛑 **PAUSE-Coder-02** — KHÔNG `pnpm install` dep mới (`axios`/`@nestjs/axios`/`@nestjs/schedule`/`@nestjs-modules/ioredis` đã có). Cần dep → dừng hỏi Manager.
- 🛑 **PAUSE-Coder-03** — **KHÔNG bật `IGLOO_DAILY_ENABLED`/`IGLOO_SUBMIT_ENABLED` khi dev/test. KHÔNG POST tạo đơn thật lên production.** Test submit/poll bằng mock (nock). Tạo đơn thật chỉ khi Danny duyệt + bật flag trên prod.
- 🛑 **PAUSE-Coder-04** — Thêm endpoint → `pnpm --filter admin generate:api` sau khi backend live (hoặc hand-typed wrapper landing-precedent, track TD-F085-SDK-REGEN).
- 🛑 **PAUSE-Coder-05** — Scope creep block: đụng file ngoài Scope Lock → dừng hỏi Manager.

---

## 🧪 Unit test BẮT BUỘC (Coder phải viết, QC check)

KHÔNG mark READY_FOR_QC nếu thiếu (đối chiếu PRD §4.1 TC-01..14):
- [ ] `normalizePhone()` — `+84`/`84`/space/dash → `0xxxxxxxxx`; không chuẩn hoá được → null (TC-01)
- [ ] `derivePackageCode()` — **luôn trả `ROAD`** (per OVERRIDES) — test xác nhận ROAD bất kể race_type
- [ ] `computeCoverage()` — from=event_start_date, **to=from, totalDays=1** (TC-04)
- [ ] `computePremium()` — **flat 10000** (premium=premiumVat=totalPayment=10000) (TC-05)
- [ ] `isEligible()` — loại gender OTHER/null, dob null, id_number non-9/12-digit, phone fail, event_start quá khứ; happy=true (TC-06/07)
- [ ] `buildPartnerRefId()` — `igloo:<athletesId>:<raceId>` (TC-08)
- [ ] `buildIglooPayload()` — shape đúng: insured(name/dob `YYYY-MM-DD`/gender/idCard FULL/email/phone/address ghép)+coverage(ROAD,1 ngày,10k)+requester(=insured INSURED)+tournament (TC-09)
- [ ] idempotency skip — đã có đơn (id,race) non-FAILED → skipped ALREADY_HAS_ORDER, KHÔNG insert (TC-10)
- [ ] top-up — created_on hôm nay < count → bù từ kho cho đủ `IGLOO_DAILY_COUNT` (TC-11)
- [ ] kill-switch — `IGLOO_DAILY_ENABLED=false` daily cron return sớm (TC-12); `IGLOO_SUBMIT_ENABLED=false` submit-worker 0 HTTP call (TC-13)
- [ ] retry guard — status≠FAILED hoặc retryCount=3 → throw BadRequest (TC-14)

E2E (QC): mock Igloo qua **nock** — KHÔNG gọi production thật.

---

## 📊 Verdict

> ### ✅ APPROVED — Coder có thể bắt đầu `/5bib-code`

PRD đầy đủ (19 BR + OVERRIDES authoritative + UI step/button/field/states + 7 endpoint spec + DTO code blocks + 14 unit TC + 11 E2E + security + SLA). Kiến trúc an toàn 2 kill-switch + idempotency đạt chuẩn cho feature production tiền thật. Không có file/field hallucination. Scope rõ.

**1 lưu ý Manager (không block, đã ghi cho Coder):** packageCode bị **ép ROAD always + coverage 1 ngày** để đạt phí cố định 10k (Danny chốt). Nếu Igloo/GIC server-side validate packageCode×days ≠ premium gửi lên → Coder bắt error ở submit-worker, lưu FAILED + errorMessage để Danny thấy (KHÔNG silent). Đây là rủi ro tích hợp duy nhất chưa verify được vì chưa POST đơn thật (PAUSE-Coder-03).

---

## ✅ Sẵn sàng cho `/5bib-code`?
- [x] **Yes** — theo Scope Lock + 5 PAUSE points + unit test list trên.

## 🔗 Next step
Danny chạy: `/5bib-code FEATURE-085-igloo-insurance-auto-order`
