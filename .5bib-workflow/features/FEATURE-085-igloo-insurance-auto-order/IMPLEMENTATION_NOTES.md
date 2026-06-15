# FEATURE-085 — IMPLEMENTATION_NOTES (Reviewer's Guide)

> Cho Manager `/5bib-deploy` Code Review + QC Phase 1. Tập trung DEVIATION + TRADEOFFS + HOTSPOTS.

## Section 1: 🚧 Deviations from Spec (intentional)

- **[Deviation #1] `derivePackageCode()` luôn trả `ROAD`**
  - **Spec said:** BR-IGL-08 OVERRIDES — Danny chốt phí 10k cố định, gói ROAD luôn.
  - **I did:** Giữ param `raceType` (rõ ý đồ + future-proof) nhưng return cứng `ROAD`. premium = flat 10000, coverage 1 ngày.
  - **Why:** Để mỗi đơn đúng 10k (ROAD 10k/ngày × 1 ngày). TRAIL = 15k sẽ phá "10k/cái".
  - **Reviewer check:** `utils/igloo-helpers.ts` `derivePackageCode/computePremium/computeCoverage` + spec TC-03/04/05.

- **[Deviation #2] Thêm field `payloadSnapshot` (ngoài bảng schema PRD §3.1)**
  - **Spec said:** PRD liệt kê field display, KHÔNG có payloadSnapshot.
  - **I did:** Lưu nguyên payload Igloo (frozen lúc chọn) trong doc → submit-worker POST trực tiếp.
  - **Why:** Tách selection khỏi submission; data VĐV không đổi giữa chừng; submit-worker không cần re-query MySQL. Chứa PII đầy đủ (Danny chốt no-mask → chấp nhận).
  - **Reviewer check:** `schemas/igloo-insurance-request.schema.ts` + `igloo-submit-worker.cron.ts`.

- **[Deviation #3] poll-worker KHÔNG gated kill-switch**
  - **Spec said:** PRD mô tả 2 kill-switch.
  - **I did:** `IGLOO_DAILY_ENABLED` gate daily-select, `IGLOO_SUBMIT_ENABLED` gate submit (egress tạo đơn). poll-worker chỉ GET (không tạo đơn mới) → không gate.
  - **Why:** Poll chỉ reconcile trạng thái đơn đã gửi; không phát sinh tiền/đơn. An toàn.
  - **Reviewer check:** `crons/igloo-poll-worker.cron.ts`.

- **[Deviation #4] `eligible-athletes.total` là xấp xỉ**
  - **Spec said:** paginated total.
  - **I did:** SQL COUNT theo hard-filter (deleted/dob/email/gender/CCCD/event); `isEligible()` Node lọc thêm phone → items page có thể < total một chút.
  - **Why:** Chuẩn hoá phone (`+84`) khó/đắt trong SQL; giữ `isEligible()` Node làm source-of-truth duy nhất.
  - **Reviewer check:** `igloo-selection.service.ts` `findEligibleForRace`.

## Section 2: ⚙️ Forced Changes (reality ≠ spec)

- **[Forced #1] IglooInsuranceModule đăng ký trong `platformDbModules` (conditional)**
  - **PRD assumed:** register IglooInsuranceModule ở app.module.
  - **Reality:** Module inject `DataSource('platform')` → nếu PLATFORM_DB_* unset, 'platform' connection không tồn tại → boot fail.
  - **Workaround:** Đặt trong block `platformDbModules` (cùng nhóm RaceMasterDataModule) → chỉ load khi platform DB configured.
  - **Manager/BA action:** Không. Đúng pattern hiện có.

- **[Forced #2] `payloadSnapshot` type = `CreateIglooRequestPayload` (không `Record<string,unknown>`)**
  - **Reality:** `payload as Record<string,unknown>` + `as CreateIglooRequestPayload` báo TS2352 (cần `as unknown as` — bị skill cấm).
  - **Workaround:** Type field schema đúng `CreateIglooRequestPayload` → bỏ cast hoàn toàn (0 `as unknown as`).
  - **Manager/BA action:** Không.

## Section 3: ⚖️ Tradeoffs Considered

| Decision | Chọn | Alternative | Why | Cost paid |
|---|---|---|---|---|
| Submit flow | Hàng đợi nội bộ QUEUED→submit-worker→poll | POST đồng bộ trong request handler | Tách kill-switch + rate-limit + retry; dev không egress | +1–2 phút latency tới khi đơn lên Igloo + 2 cron |
| Legacy query | `DataSource.query` raw SQL parameterized | TypeORM QueryBuilder | JOIN 3 bảng rõ ràng, dễ đọc | Mất typing compile-time trên row (dùng interface `LegacyAthleteRow` bù) |
| Snapshot payload | Lưu full payload Mongo | Re-query MySQL lúc submit | Data frozen, robust, đơn giản worker | PII trùng lặp trong Mongo (Danny no-mask → OK) |
| Top-up | `ORDER BY RAND()` | Deterministic/cursor | Bù ngẫu nhiên đúng yêu cầu | RAND() trên ~6k row filtered — chấp nhận cho cron 1×/ngày |
| Idempotency | Mongo check + unique index `partnerRefId` (catch E11000) | Chỉ check trước insert | Race-safe tuyệt đối | 1 query exists/đơn + dựa DB unique |

## Section 4: 🔬 Reviewer Notes

### Files cần review kỹ (priority order)
1. **`utils/igloo-helpers.ts`** — toàn bộ logic tiền/eligibility/payload (BR-IGL-04/06/07/08/09/17/18). 22 unit test phủ.
2. **`services/igloo-request.service.ts`** — idempotency (`existingActivePartnerRefIds` + `queueOne` catch E11000), top-up (`selectAndQueueDaily`), retry guard (`retry`), state transitions. 10 unit test phủ.
3. **`services/igloo-selection.service.ts`** — SQL parameterized (`?`), eligibility hard-filter. KIỂM TRA: 0 string interpolation từ input (q đi qua LIKE param).
4. **`crons/igloo-submit-worker.cron.ts`** — gated `IGLOO_SUBMIT_ENABLED` (chốt an toàn egress). SETNX lock + try/finally release.
5. **`igloo-insurance.controller.ts`** — `@UseGuards(LogtoAdminGuard)` class-level + `@ApiResponse` đủ codes.

### Concurrency hotspots
- `igloo-request.service.ts queueOne` — unique `partnerRefId` + catch `code===11000` → race-safe (2 cron/2 admin tạo cùng VĐV→giải = 1 thắng).
- 3 cron đều SETNX lock (`igloo:daily-lock:<ymd>` / `igloo:submit-lock` / `igloo:poll-lock`) chống chồng tick.

### Edge cases tested vs DEFERRED
- ✅ Tested (unit): phone normalize, CCCD 9/12, gender OTHER loại, past-event loại, ROAD-always, flat-10k, 1-day coverage, payload shape full-PII, idempotency skip, top-up, retry guard, kill-switch flag read.
- ⚠️ Deferred (QC, lý do an toàn): **gọi Igloo thật** (PAUSE-Coder-03 — KHÔNG POST production; QC mock bằng nock), backend boot smoke (cần Mongo/Redis/MySQL chạy + flags), browser UI walkthrough (admin chưa boot trong session này). Đã thay bằng `tsc --noEmit` clean + 32 unit test PASS.

### Type safety
- 0 `any`, 0 `as unknown as` (re-grep clean). Cast còn lại: chuẩn hoá Date trong helpers + Mongoose lean generic (an toàn).

### Security checklist self-applied
- [x] Mọi endpoint admin: `@UseGuards(LogtoAdminGuard)` class-level.
- [x] SQL legacy: 100% `?` placeholder, KHÔNG `${...}` interpolation (grep clean).
- [x] Response DTO KHÔNG leak `_id` raw (map `id`), KHÔNG `partnerRefId`/`payloadSnapshot`.
- [x] PII: Danny chốt KHÔNG mask → lưu/hiển thị đầy đủ idCard/phone/dob (CÓ CHỦ Ý). App log dùng `athletesId`, không spam CCCD.
- [x] Kill-switch: `IGLOO_DAILY_ENABLED`=false + `IGLOO_SUBMIT_ENABLED`=false default → dev 0 egress.
