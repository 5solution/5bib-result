# FEATURE-085: Igloo Insurance — Daily Auto-Order + Admin Manual-Create

**Status:** 🟡 INITIATED
**Created:** 2026-06-15
**Owner:** Danny
**Type:** NEW_MODULE (backend module `igloo-insurance` + admin page) + EXTEND_EXISTING (add `created_on` to `AthleteReadonly`)
**Created by:** 5bib-manager

---

## 🎯 Why this feature

Danny đã ký hợp đồng với **Igloo** (insurtech, portal `api-igloo-insurance.5solution.vn` đứng trước nhà bảo hiểm **GIC**) nhưng **KHÔNG muốn bán bảo hiểm trên 5BIB cho khách**. Để **duy trì volume hợp đồng + giữ vị thế với Igloo** cho các sản phẩm hợp tác sau, 5BIB chủ động phát sinh đơn bảo hiểm cho VĐV thật (5Solution tự chịu phí — coi như chi phí duy trì quan hệ).

Hai phần:
- **A) Cron tự động:** mỗi ngày đẩy **7 VĐV thật** ("phát sinh trong ngày", bù từ kho nếu thiếu) sang Igloo tạo đơn.
- **B) Admin thủ công (admin.5bib.com):** trang cho admin tự **chọn VĐV** tạo bảo hiểm + xem **danh sách đơn** + trạng thái + **retry** đơn FAILED.

> ⚠️ Bản chất: tạo policy GIC **thật** trên **production** với **PII thật** của VĐV (CCCD/DOB/email/phone) — VĐV không tự mua (5Solution "tặng"). Danny đã chấp nhận hướng này; rủi ro PII/consent được flag để xử lý (xem Risk + PAUSE).

---

## 📂 Impact Map (đã đọc code thật + verify DB legacy)

### Module sẽ chạm

**Backend — `backend/` (NestJS):**
- ➕ `src/modules/igloo-insurance/` — **module mới**: HTTP client gọi Igloo + cron auto-7 + poller reconcile + service tuyển chọn VĐV (legacy MySQL) + Mongo schema lưu request + admin controller.
- ✏️ `src/modules/race-master-data/entities/athlete-readonly.entity.ts` — **thêm 1 cột `created_on` (datetime)** (đã verify tồn tại trên `5bib_platform_live.athletes`; cần dùng để lọc "phát sinh trong ngày").
- ✏️ `src/modules/app.module.ts` — đăng ký module mới; nếu igloo-insurance dùng entity riêng cho 'platform' thì `TypeOrmModule.forFeature([...], 'platform')` trong module (KHÔNG cần thêm vào forRoot entities nếu reuse entity đã đăng ký).

**Admin — `admin/` (Next.js 16):**
- ➕ `src/app/(dashboard)/insurance/` (tên đề xuất — BA chốt) — page chọn VĐV + danh sách đơn.
- ➕ `src/lib/insurance-api.ts` + `src/lib/insurance-hooks.ts` — wrapper TanStack Query (pattern như `landing-api.ts`/`landing-hooks.ts`, `course-data-ops-*`).
- 🔄 `src/lib/api-generated/` — regenerate SDK sau khi backend thêm endpoint (`pnpm generate:api`).

### File then chốt cần đọc trước khi code (precedent reuse)
- `src/modules/promo-hub/entities/race-readonly.entity.ts` — **`RaceReadonly` ĐÃ map đủ** `title/eventStartDate/eventEndDate/location/province/district/raceType` → reuse, KHÔNG cần entity races mới.
- `src/modules/race-master-data/entities/athlete-readonly.entity.ts` + `athlete-subinfo-readonly.entity.ts` — nguồn KYC (name/dob/email + gender/contact_phone/id_number).
- `src/modules/race-master-data/jobs/ended-race-master-sync.cron.ts` — **precedent @Cron + Redis SETNX lock** (port y nguyên pattern acquireLock/releaseLock).
- `src/modules/races/races.service.ts` + `races.module.ts` — **precedent HttpService/HttpModule** (`@nestjs/axios` đã có) cho Igloo client.
- `src/modules/race-master-data/services/race-athlete-lookup.service.ts` — pattern `.select('+email +contact_phone +id_number')` đọc PII (tham chiếu, nhưng feature này query legacy trực tiếp).
- Một module admin có controller + DTO + `@ApiResponse` đầy đủ (vd `landing`, `course-data-ops`) — precedent guard + Swagger để SDK generate đúng.

### Endpoint liên quan (mới — admin, JWT-guarded)
- `GET  /api/igloo-insurance/eligible-athletes?raceId=&q=&page=` — list VĐV đủ KYC theo giải (manual select).
- `GET  /api/igloo-insurance/races` — list giải sắp diễn ra (24 giải) cho dropdown.
- `POST /api/igloo-insurance/requests` — tạo đơn (batch danh sách athletes_id đã chọn). Preview phí trước.
- `GET  /api/igloo-insurance/requests?status=&page=` — danh sách đơn đã tạo + trạng thái.
- `POST /api/igloo-insurance/requests/:id/retry` — retry đơn FAILED.
- (internal, KHÔNG expose) cron daily + poller reconcile.

### External integration (Igloo partner API — production)
- `POST https://api-igloo-insurance.5solution.vn/api/v1/partner/insurance/requests` (header `X-API-Key`) → 202 + `requestId` (async qua queue GIC).
- `GET  …/partner/insurance/requests/{id}` → poll status `PENDING→PROCESSING→GET_CERTI_PROCESSING→SUCCESS|FAILED|CANCELLED`; SUCCESS → `gicContractNo` + `certificateUrl`.
- Body `CreateInsuranceRequestDto`: `insured{name,dateOfBirth(YYYY-MM-DD),gender(MALE|FEMALE),idCard,email,phone(VN 10 số),address}` + `coverage{from,to,packageCode(ROAD|TRAIL),premium,premiumVat}` + `requester(=insured, relationCode INSURED)` + `tournament{name,bibNumber,distance}` + `partnerRefId` (idempotency).
- Phí: ROAD 10.000đ/người/ngày · TRAIL 15.000đ/người/ngày = rate × số ngày.

### Schema/DB
- **MongoDB (5bib-result):** ➕ collection **mới** `igloo_insurance_requests` — lưu `partnerRefId` (unique), `iglooRequestId`, `status`, `athletesId`, `mysqlRaceId`, `bib`, snapshot payload đã gửi (KHÔNG log CCCD thô — cân nhắc mask), `packageCode`, `premium`, `coverageFrom/To`, `gicContractNo`, `certificateUrl`, `source('cron'|'manual')`, `errorMessage`, `retryCount`, timestamps. Index unique `partnerRefId`, index `status`, `mysqlRaceId`.
- **MySQL platform (`5bib_platform_live`, readonly conn 'platform'):** đọc `athletes` (+ thêm map `created_on`), `athlete_subinfo`, `races` (RaceReadonly). KHÔNG ghi. Join `athletes a → athlete_subinfo s ON a.subinfo_id=s.id → races r ON a.race_id=r.race_id`.
- **Redis:** ➕ `igloo:daily-lock:<YYYY-MM-DD>` (SETNX chống double-fire cron, TTL ~23h) · ➕ `igloo:poller-lock` (SETNX poller). KHÔNG đụng key hiện có.
- **ENV mới:** `IGLOO_BASE_URL`, `IGLOO_API_KEY`, `IGLOO_DAILY_COUNT=7`, `IGLOO_DAILY_ENABLED` (kill-switch), `IGLOO_CRON_HOUR` (VN time). Thêm vào `.env.example` + config schema.

### Eligibility (verify số thật trên production replica 2026-06-15)
- Tổng 99.350 athletes · đủ KYC (dob+email+CCCD 9–12 số+phone VN `^0xxxxxxxxx`+gender MALE/FEMALE) = **59.725** · đủ KYC + giải sắp diễn ra (`event_start_date>=today`) = **6.233** qua **24 giải** → dư sức 7/ngày. "Mới-trong-ngày" hôm nay = 3 → **bù từ kho bắt buộc**.

---

## ⚠️ Risk Flags

- 🔴 **HIGH — External irreversible money + real policies.** Mỗi POST tạo hợp đồng GIC **thật + phí thật** trên **production**. Bug idempotency/dedup hoặc cron double-fire = phát sinh đơn trùng/đốt tiền không kiểm soát. BẮT BUỘC: `partnerRefId` idempotency + Redis SETNX lock + kill-switch ENV `IGLOO_DAILY_ENABLED` + cron cap đúng `IGLOO_DAILY_COUNT`.
- 🔴 **HIGH — PII egress (NĐ13/2023).** CCCD/DOB/email/phone VĐV đẩy sang bên thứ ba (GIC). Logging PHẢI sanitize (KHÔNG log CCCD/dob thô; theo PII-defense pattern hiện có `[emailHash:...]`). Cân nhắc mask CCCD khi lưu snapshot Mongo. VĐV không tự mua → cờ consent/loại trừ (Phase 1 có thể skip nhưng phải Danny chốt).
- 🟡 **MED — Admin endpoints = hành động tốn tiền.** Tạo policy thật từ UI → cần admin guard mạnh + audit log ai tạo đơn nào + xác nhận (confirm modal + preview phí) chống bấm nhầm.
- 🟡 **MED — Extend `AthleteReadonly.created_on`.** Cần verify SELECT grant cho cột `created_on` trên readonly user (đã query được từ local nên khả năng OK, nhưng grant production cần confirm ở /5bib-plan). RaceReadonly đã đủ field → không thêm.
- 🟡 **MED — API key chưa có.** `IGLOO_API_KEY` Danny đang xin. Build + test mọi phần không cần key; mock/feature-flag POST Igloo cho tới khi có key (cron để `IGLOO_DAILY_ENABLED=false` mặc định).
- 🟢 **LOW — Mongo collection mới** (`igloo_insurance_requests`) additive, không đụng schema cũ. Redis key prefix mới không xung đột.

---

## 🚧 PAUSE Conditions cần BA + Danny chốt khi viết PRD

- [ ] **Phí & thanh toán với Igloo:** Igloo bill thế nào (prepaid deposit / invoice cuối kỳ)? Có ngân sách trần/ngày để cron tự dừng khi vượt không? (business)
- [ ] **Coverage dates:** `coverage.from = event_start_date`, `coverage.to = event_end_date`; số ngày = `(to - from) + 1`, nếu `event_end_date` null → 1 ngày? Igloo có yêu cầu `from >= hôm nay` không (đơn bảo hiểm không thể bắt đầu quá khứ)? → eligibility lọc `event_start_date >= today` (hay `>= tomorrow`?).
- [ ] **packageCode mapping:** `race_type` chứa `TRAIL|RAIL` → TRAIL (15k), còn lại (`ROAD_*`, `HILLROAD`, `EKIDEN`, `ULTRA_LOOP`, `UNKNOWN`) → ROAD (10k). Confirm + xử lý `UNKNOWN`.
- [ ] **Dedup/idempotency policy:** `partnerRefId = igloo:<athletes_id>:<raceId>`? (1 VĐV/giải chỉ 1 đơn — tránh tặng trùng) hay `:<date>` (cho phép lặp ngày khác)? VĐV đã có đơn SUCCESS có loại khỏi pool cron không?
- [ ] **Chọn 7 — định nghĩa "phát sinh trong ngày":** `athletes.created_on = hôm nay` (đề xuất) hay `register_time`? Bù từ kho = random trong 6.233 đủ KYC + giải upcoming, loại VĐV đã có đơn.
- [ ] **Cron lịch:** chạy mấy giờ (VN UTC+7)? `IGLOO_DAILY_COUNT` cố định 7 hay config? Khi <7 eligible (hiếm) → đẩy ít hơn + log, hay alert?
- [ ] **Consent/loại trừ VĐV:** Phase 1 có cần loại nhóm nào (VIP, staff, VĐV nước ngoài không CCCD VN, đã tự mua bảo hiểm)? Có cần lưu cờ consent không?
- [ ] **Phone/CCCD normalize:** chuẩn hoá `+84`/khoảng trắng → `0xxxxxxxxx`; nếu không chuẩn hoá được → loại VĐV. CCCD 9 (CMND cũ) có chấp nhận không hay chỉ 12 số?
- [ ] **Admin UI scope:** chọn theo giải (dropdown) + search tên/BIB/CCCD; có cho admin sửa tay field thiếu (vd address) không? (đề xuất: KHÔNG — chỉ chọn VĐV đủ KYC). Tab "Đơn đã tạo" hiển thị cột gì.
- [ ] **Alerting khi lỗi:** Igloo down / FAILED nhiều → báo qua đâu (log/Slack/none)?
- [ ] **Gender OTHER/null → loại** (Igloo chỉ nhận MALE/FEMALE). Confirm.

---

## 🎯 Success criteria (gợi ý cho BA cụ thể hoá)

- Cron mỗi ngày tạo đúng `IGLOO_DAILY_COUNT` đơn (khi đủ eligible), idempotent — chạy lại KHÔNG tạo trùng.
- Admin chọn N VĐV → tạo N đơn, thấy phí preview trước khi gửi, có audit ai tạo.
- Đơn reconcile đúng trạng thái cuối (SUCCESS có `gicContractNo`+`certificateUrl`, FAILED có lý do + retry được).
- KHÔNG có CCCD/dob thô trong log. Kill-switch tắt được toàn bộ auto-push.
- Unit test bắt buộc: tuyển chọn eligibility (filter KYC + upcoming + dedup), top-up logic, premium calc (ROAD/TRAIL × days), payload mapping (gender/phone/CCCD/date format), idempotency.

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] **Yes** — BA có thể bắt đầu. Toàn bộ nguồn data + API contract + eligibility đã verify thật. BA cần chốt 11 PAUSE conditions ở trên với Danny trong PRD.
- ⏳ Lưu ý: `IGLOO_API_KEY` chưa có (Danny đang xin) — không block PRD/code phần lớn; chỉ block bật cron production + E2E thật với Igloo.

---

## 🔗 Next step

Danny chạy: `/5bib-prd FEATURE-085-igloo-insurance-auto-order`
