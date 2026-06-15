# FEATURE-085: QC Report

**Status:** ✅ APPROVED (với 2 pre-golive gate tracked — xem Verdict)
**Tested:** 2026-06-15
**Author:** 5bib-qc-gatekeeper
**Linked:** `01-ba-prd.md`, `03-coder-implementation.md`, `IMPLEMENTATION_NOTES.md`

---

## 📌 Pre-flight check
- [x] Đọc `01-ba-prd.md` (OVERRIDES + BR-IGL-01..19 + TC tables)
- [x] Đọc `03-coder-implementation.md` (status READY_FOR_QC + Tests Written PASS)
- [x] Đọc `IMPLEMENTATION_NOTES.md` Section 4 (priority files)
- [x] Đọc `memory/conventions.md` (anti-patterns)
- [x] Chạy lại unit test Coder LOCAL → **32 PASS**, sau đó +23 QC test → **55 PASS**

---

## 🔍 Phase 1: Impact & Regression Audit

### Coder got right
- **Idempotency 2 lớp**: Mongo `existingActivePartnerRefIds` check + unique index `partnerRefId` + catch `E11000` → race-safe (verified test IDEMP-1).
- **Mongo indexes** đầy đủ: unique `partnerRefId`, `{status,lastPolledAt}` (poll-worker query hit index), `{mysqlRaceId,status}` (list). KHÔNG full-scan.
- **Named connection 'platform'** đúng (`@InjectDataSource('platform')`), module load trong `platformDbModules` conditional → không boot fail khi platform DB unset.
- **2 kill-switch** gating đúng (verified workers spec + source assertion).
- **Hàng đợi nội bộ** tách selection/submit/poll → submit-worker mới là điểm egress duy nhất, gated `IGLOO_SUBMIT_ENABLED`.
- tsc clean cho toàn bộ file igloo (4 lỗi backend + 8 lỗi admin còn lại = PRE-EXISTING `upload/*.spec` + `result-kiosk/__tests__` JSX-in-.ts, KHÔNG do F-085).

### Coder MISSED — không có lỗi blocking
- ⚠️ (MINOR) `eligible-athletes.total` xấp xỉ (SQL hard-filter count vs Node isEligible phone). Coder đã flag TD-F085-ELIGIBLE-COUNT-APPROX. Non-blocking (UI list dùng để chọn, không phải báo cáo tài chính).
- ⚠️ (MINOR) `tournament.distance` có thể null (chưa JOIN race_course đầy đủ). Igloo field optional → OK. Tracked TD-F085-COURSE-DISTANCE.
- ✅ Scope match: mọi file trong `03 Files Changed` khớp Scope Lock `02`. KHÔNG scope creep.

---

## 🛡️ Phase 2: Security Threat Model

| Threat | Vector | Risk | Status |
|---|---|---|---|
| Auth bypass | Endpoint thiếu guard | CRITICAL | ✅ `@UseGuards(LogtoAdminGuard)` **class-level** (verified SEC-2 Reflect metadata) → cả 7 route 401 unauth / 403 non-admin |
| SQL injection | `raceId`/`q`/`athleteId` vào SQL legacy | CRITICAL | ✅ 100% `?` placeholder; `q` chỉ thành GIÁ TRỊ LIKE `%${q}%` đẩy qua params; dynamic value (raceId/pageSize/offset) qua mảng params (verified SEC-3 source assertion) |
| Mass-assign / over-post | Body field thừa | MED | ✅ DTO `CreateIglooRequestsDto` validate `ArrayMinSize(1)/MaxSize(50)/IsInt/Min(1)` (verified SEC-1) |
| Info disclosure (internal) | Response leak `_id`/`partnerRefId`/`payloadSnapshot` | HIGH | ✅ `toDto` map `id=String(_id)`, KHÔNG trả partnerRefId/payloadSnapshot/__v |
| PII exposure | CCCD/phone/dob trong response | — | ⚠️ INTENTIONAL — Danny chốt KHÔNG mask (BR-IGL-14 OVERRIDES). Admin-only (LogtoAdminGuard). Chấp nhận theo quyết định owner. App log dùng athletesId (verified — không spam CCCD) |
| Race condition (đơn trùng) | 2 cron/admin tạo cùng (VĐV,giải) | HIGH | ✅ unique `partnerRefId` + catch E11000 → 1 thắng (verified IDEMP-1) |
| Runaway money (cron double-fire) | Multi-instance/overlap tick | HIGH | ✅ 3 SETNX lock + `IGLOO_DAILY_COUNT` cap + kill-switch + idempotency |
| Egress khi dev | Vô tình gửi đơn thật | HIGH | ✅ `IGLOO_SUBMIT_ENABLED=false` default → submit-worker return sớm (verified workers spec) |
| Money tampering | Path nào ra phí ≠ 10k | MED | ✅ `computePremium` hằng 10000, `derivePackageCode` luôn ROAD, coverage 1-day — 6 race_type đều ra 10k/ROAD (verified MONEY-1) |

**KHÔNG có lỗ hổng CRITICAL/HIGH chưa mitigate.**

---

## 🧪 Phase 3: Test Scripts (QC viết — code thật)

| File | Nội dung | Chạy được? |
|---|---|---|
| `__qc__/igloo-insurance.qc.spec.ts` | SEC-1 DTO validation (5) · SEC-2 guard structural Reflect (1) · SEC-3 SQL-safety source assertion (2) · MONEY-1 phí bất biến (7) · IDEMP-1 E11000 race-safe (1) | ✅ chạy không cần infra |
| `__qc__/igloo-workers.qc.spec.ts` | submit-worker success→PENDING / fail→FAILED / lock-held skip · poll-worker SUCCESS→applyStatus / status lạ→PROCESSING · kill-switch source assertion (7) | ✅ mock HTTP+redis+req, không cần infra |
| (Coder) `utils/igloo-helpers.spec.ts` | 22 — money/eligibility/payload | ✅ |
| (Coder) `services/igloo-request.service.spec.ts` | 10 — idempotency/top-up/retry/config | ✅ |

### Live E2E plan (DEFER — cần infra + Logto token; `nock` chưa cài, PAUSE-Coder cấm install)
Chạy khi backend live (Mongo/Redis/MySQL up) — Danny/QC thực thi sau deploy:
```bash
BASE=https://result-dev.5bib.com/api/igloo-insurance
# 1. Auth — 401 không token
curl -s -o /dev/null -w "%{http_code}" $BASE/requests            # expect 401
# 2. Admin token (Logto) — list eligible (PII đầy đủ, không leak partnerRefId)
curl -s -H "Authorization: Bearer $ADMIN" "$BASE/eligible-athletes?raceId=220" | jq '.items[0]'
# 3. Tạo 1 đơn (IGLOO_SUBMIT_ENABLED vẫn false → QUEUED, KHÔNG gửi)
curl -s -X POST -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' \
  -d '{"raceId":220,"athleteIds":[<id>]}' $BASE/requests            # expect created:1
# 4. Tạo lại cùng VĐV → idempotency skip
#    expect created:0, skipped:[ALREADY_HAS_ORDER]
# 5. List → đơn ở trạng thái QUEUED ("Chờ gửi")
```

---

## 📊 Phase 4: Test execution results

```
PASS src/modules/igloo-insurance/utils/igloo-helpers.spec.ts            (22)
PASS src/modules/igloo-insurance/services/igloo-request.service.spec.ts (10)
PASS src/modules/igloo-insurance/__qc__/igloo-insurance.qc.spec.ts      (16)
PASS src/modules/igloo-insurance/__qc__/igloo-workers.qc.spec.ts        (7)

Test Suites: 4 passed, 4 total
Tests:       55 passed, 55 total
```
- **Performance SLA**: không đo được live trong session (backend chưa boot). SQL eligibility query có index hỗ trợ + LIMIT pagination; selection LIMIT buffer cho cron. Đo p95 thực ở DEV (TD).
- **10× stability**: idempotency đã chứng minh race-safe qua unique index + E11000 (IDEMP-1). 10× concurrent create live → defer E2E plan bước 4.

---

## 🔁 Phase 5: PRD Compliance (BR-IGL coverage)

| BR | Nội dung | Verified by |
|---|---|---|
| BR-IGL-02 | count 10/ngày, cron giờ VN | getConfig test + daily cron `@Cron` timeZone Asia/Ho_Chi_Minh |
| BR-IGL-03 | 2 kill-switch default false | getConfig + workers gating + source assertion |
| BR-IGL-04 | eligibility đủ KYC + upcoming | isEligible TC-06/07 |
| BR-IGL-05 | created_on hôm nay + top-up | selectAndQueueDaily TC-11 |
| BR-IGL-06/06b | idempotency 1 VĐV/giải | TC-10 + IDEMP-1 |
| BR-IGL-07 | coverage 1-day từ event_start | computeCoverage TC-04 + MONEY-1 |
| BR-IGL-08/08b | ROAD always + flat 10k + CCCD 9/12 | TC-03/05 + MONEY-1 + isValidIdCard TC-02 |
| BR-IGL-09 | payload mapping + address ghép | buildIglooPayload TC-09 |
| BR-IGL-10 | state machine submit/poll | workers spec |
| BR-IGL-11 | retry guard FAILED/max/re-poll | TC-14 |
| BR-IGL-12 | manual create batch | createBatch TC-10 |
| BR-IGL-13 | concurrency lock + race-safe | SETNX (workers) + IDEMP-1 |
| BR-IGL-14 | PII no-mask (intentional) | toDto + EligibleAthleteDto full idCard |
| BR-IGL-15 | Display Convention VN labels | insurance-labels.ts (verified grep: 0 raw enum JSX text) |
| BR-IGL-16 | LogtoAdminGuard mọi endpoint | SEC-2 |
| BR-IGL-17/18 | gender MALE/FEMALE + phone normalize | normalizeGender/normalizePhone TC-01/06 |
| BR-IGL-19 | dev safety no egress | submit gating |

**19/19 BR covered.**

---

## 🎭 Phase 6: Persona Journey Walkthrough

> Feature admin-only → 1 persona chính: **5BIB Back-Office Admin**. UI verify ở mức ĐỌC CODE component (admin chưa boot trong session — live browser walkthrough DEFER pre-golive, precedent F-078 Playwright deferred).

### Persona: Back-Office Admin — tạo bảo hiểm thủ công

| # | Action | UI behavior (verified code) | Next state |
|---|---|---|---|
| 1 | Vào `/insurance` | Tab "Tạo bảo hiểm" active; banner vàng nếu `submitEnabled=false`; badge "Chế độ gửi: TẮT/BẬT" | dropdown giải load |
| 2 | Chọn giải | `useEligibleAthletes(raceId)` → bảng VĐV; skeleton khi loading | danh sách |
| 3 | Gõ search | debounce 300ms → query `q` | lọc |
| 4 | Tick VĐV (hasOrder→disabled) | footer "Đã chọn N — Tổng phí 10k×N" | selected set |
| 5 | "Tạo bảo hiểm (N)" | confirm modal `sm:max-w-md` preview phí + cảnh báo "đơn thật, 5Solution chịu phí" | modal |
| 6 | "Xác nhận" | button loading; POST; toast "Đã tạo N đơn (M bỏ qua)"; clear selection | success |

### 6.4 UI/UX Scrutiny (verified qua code component)
- [x] Modal `sm:max-w-md` (KHÔNG `sm:max-w-sm` 384px default — F-032 lesson tránh)
- [x] Table cell truncate + `title` (email, raceTitle) hover full
- [x] VN labels: status/package/source qua `*Label()` — grep 0 raw enum trong JSX text
- [x] Empty state: "Chọn một giải..." / "Giải này chưa có VĐV đủ điều kiện" / "Chưa có đơn nào"
- [x] Loading: Skeleton 5 dòng
- [x] Error: text đỏ "Lỗi tải..." + toast error VN
- [x] Success: toast xanh + clear selection + invalidate query
- [x] Confirm dialog: destructive-aware (nút cam, cảnh báo tiền thật)
- [x] Footer sticky (`sticky bottom-0`) — nút tạo không bị đẩy
- [x] Retry: AlertDialog confirm "Gửi lại đơn cho {tên}?" + chỉ hiện khi FAILED & retryCount<3
- [⚠️] Live browser walkthrough (click thật) → DEFER pre-golive (admin chưa boot)

### 6.5 Real-world data
- [x] Tên VN dấu (Nguyễn Văn A), CCCD 12 số `092124584349`, race Lào Cai thật trong fixture
- [x] Money vi-VN `formatVnd` → "10.000 đ"
- [⚠️] 1000+ VĐV scroll perf → DEFER live (pagination 50/trang đã có)

---

## 🚧 Tech debt còn lại (Manager append known-issues)
- **TD-F085-SDK-REGEN** — hand-typed admin wrapper; `pnpm --filter admin generate:api` vs backend live → swap generated SDK.
- **TD-F085-IGLOO-LIVE-VERIFY** 🔴 PRE-GOLIVE — chưa POST đơn thật. Bật flag prod → tạo 1 đơn → verify `gicContractNo`+`certificateUrl`. Rủi ro: Igloo server-side có validate ROAD×1ngày==10k không (submit-worker bắt FAILED nếu lệch, không silent).
- **TD-F085-LIVE-E2E** — Supertest E2E cần infra + Logto token + (cài `nock` hoặc overrideProvider IglooHttpService). Chạy curl plan Phase 3 sau deploy.
- **TD-F085-ELIGIBLE-COUNT-APPROX** / **TD-F085-COURSE-DISTANCE** — non-blocking (Coder flagged).
- **TD-F085-PERF-SLA** — đo p95 eligible-athletes ở DEV.

---

## 📊 Final Verdict

> ### ✅ APPROVED

55/55 unit+QC test PASS · tsc clean · security threat model 0 CRITICAL/HIGH chưa mitigate · 19/19 BR covered · UI states verified code-level · idempotency race-safe · 2 kill-switch đảm bảo dev 0 egress.

**2 PRE-GOLIVE gate (KHÔNG block QC — block golive, precedent F-076/F-078/F-079 PROD smoke deferred Danny pre-merge):**
1. **TD-F085-IGLOO-LIVE-VERIFY** — sau deploy + set `IGLOO_API_KEY` prod + bật `IGLOO_SUBMIT_ENABLED`: tạo 1 đơn thật → verify ra contractNo + certificate. Đây là kiểm chứng tích hợp Igloo thật DUY NHẤT chưa làm được (an toàn không POST trong dev).
2. **TD-F085-LIVE-E2E** — chạy curl plan Phase 3 trên DEV.

## 🔗 Next step
Danny chạy: `/5bib-deploy FEATURE-085-igloo-insurance-auto-order`
