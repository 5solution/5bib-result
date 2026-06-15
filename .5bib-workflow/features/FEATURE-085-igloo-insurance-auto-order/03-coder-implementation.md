# FEATURE-085: Coder Implementation Log

**Status:** 🟠 READY_FOR_QC
**Started:** 2026-06-15
**Author:** 5bib-fullstack-engineer
**Linked:** `00`, `01`, `02`, `IMPLEMENTATION_NOTES.md`

---

## 📌 Pre-flight check
- [x] Đọc `00-manager-init.md`
- [x] Đọc `01-ba-prd.md` (block OVERRIDES + BR-IGL-01..19)
- [x] Đọc `02-manager-plan.md` — verdict ✅ APPROVED
- [x] Đọc `memory/conventions.md` + `codebase-map.md`
- [x] Đọc code thật Scope Lock (config, landing controller/module, race-athlete-lookup platform pattern, ended-race cron, nav-groups, landing-api/hooks)

## 🔍 Impact Assessment (Think First)
- **Backend:** module mới `igloo-insurance` (12 file). Mongo collection mới `igloo_insurance_requests` (additive, KHÔNG migration). MySQL 'platform' read-only +1 cột map `created_on` (KHÔNG migration). Redis +3 SETNX key prefix mới. DI: inject `DataSource('platform')` → module load trong `platformDbModules` conditional. ScheduleModule/RedisModule/HttpModule đã global.
- **Frontend:** admin page mới `(dashboard)/insurance` + 2 client component + 3 lib + nav item. Hand-typed wrapper (landing precedent) — generate:api defer (TD-F085-SDK-REGEN).
- **API contract:** 7 endpoint mới `/api/igloo-insurance/*` (LogtoAdminGuard). Không break SDK hiện tại.

## ⚠️ Edge Cases Covered
- [x] VĐV gender OTHER/null → loại. dob null → loại. CCCD passport/sai length → loại (≡ loại VĐV nước ngoài). phone không chuẩn hoá được → loại. event_start quá khứ/null → loại.
- [x] created_on hôm nay < count → top-up random từ kho; kho < count → đẩy hết + log (không alert).
- [x] Idempotency: 1 VĐV/giải = 1 đơn (Mongo check + unique index catch E11000) → 2 cron/admin đồng thời = 1 thắng.
- [x] retry: chỉ FAILED + retryCount<3; đã có iglooRequestId → re-poll (PENDING) thay vì re-queue (tránh tạo trùng GIC).
- [x] kill-switch: daily off → 0 select; submit off → 0 egress.
- [x] Igloo POST lỗi → FAILED + errorMessage (KHÔNG silent).

## 🧠 Logic & Architecture
Hàng đợi nội bộ `QUEUED → submit-worker(gated) → PENDING(+iglooRequestId) → poll-worker → SUCCESS|FAILED`. Tách selection / submission / reconcile thành 3 cron độc lập + 2 kill-switch → dev tuyệt đối không egress đơn thật. premium FLAT 10k, packageCode=ROAD, coverage 1-day (Danny OVERRIDES). Chi tiết trade-off: xem `IMPLEMENTATION_NOTES.md`.

## 💻 Files Changed

### Backend NEW (`backend/src/modules/igloo-insurance/`)
- ➕ `igloo-insurance.module.ts`
- ➕ `igloo-insurance.controller.ts` (7 endpoint, LogtoAdminGuard)
- ➕ `igloo-insurance.constants.ts`
- ➕ `schemas/igloo-insurance-request.schema.ts`
- ➕ `dto/create-igloo-requests.dto.ts`
- ➕ `dto/igloo-response.dto.ts`
- ➕ `services/igloo-http.service.ts`
- ➕ `services/igloo-selection.service.ts`
- ➕ `services/igloo-request.service.ts`
- ➕ `services/igloo-request.service.spec.ts` (10 test)
- ➕ `crons/igloo-daily.cron.ts`
- ➕ `crons/igloo-submit-worker.cron.ts`
- ➕ `crons/igloo-poll-worker.cron.ts`
- ➕ `utils/igloo-helpers.ts`
- ➕ `utils/igloo-helpers.spec.ts` (22 test)

### Backend MODIFY
- ✏️ `race-master-data/entities/athlete-readonly.entity.ts` — +cột `created_on`
- ✏️ `config/index.ts` — +6 `IGLOO_*` env (Joi + export `env.igloo`)
- ✏️ `app.module.ts` — import + register `IglooInsuranceModule` trong `platformDbModules`
- ✏️ `.env` + `.env.example` — +IGLOO_* (Manager đã set, `IGLOO_DAILY_COUNT=10`, 2 kill-switch=false)

### Admin NEW
- ➕ `app/(dashboard)/insurance/page.tsx`
- ➕ `components/insurance/InsuranceCreateTab.tsx`
- ➕ `components/insurance/InsuranceOrdersTab.tsx`
- ➕ `lib/insurance-api.ts`
- ➕ `lib/insurance-hooks.ts`
- ➕ `lib/insurance-labels.ts`
- ✏️ `lib/nav-groups.ts` — +mục "Bảo hiểm Igloo" (requireRole admin)

## 🧪 Tests Written — PASS

```
PASS src/modules/igloo-insurance/utils/igloo-helpers.spec.ts
PASS src/modules/igloo-insurance/services/igloo-request.service.spec.ts

Test Suites: 2 passed, 2 total
Tests:       32 passed, 32 total
```

Phủ: TC-01 normalizePhone · TC-02 isValidIdCard (9/12, loại passport) · TC-03 derivePackageCode ROAD-always · TC-04 computeCoverage 1-day · TC-05 computePremium flat 10k · TC-06/07 isEligible loại+happy · TC-08 buildPartnerRefId · TC-09 buildIglooPayload shape full-PII + address fallback + throw · TC-10 idempotency skip (ALREADY_HAS_ORDER) + NOT_ELIGIBLE + create QUEUED · TC-11 top-up từ kho + không vượt count · TC-14 retry guard (non-FAILED/max/re-poll/QUEUED) · getConfig kill-switch flags.

## 🛑 PAUSE/Confirmation log
| Date | What | Danny |
|---|---|---|
| 2026-06-15 | Phí 10k flat / 10 đơn ngày / no-mask / ROAD-1-ngày / CCCD 9+12 / không VĐV nước ngoài | Đã chốt (8 PAUSE) |
| 2026-06-15 | Gói ROAD + 1 ngày = 10k mọi đơn | Confirmed |
| 2026-06-15 | API key | Đã cấp + verified active |

## 🚧 Scope creep
- [x] KHÔNG có scope creep — mọi file nằm trong Scope Lock `02-manager-plan.md`.

## 🐛 Known limitations / Tech debt
- **TD-F085-SDK-REGEN** — admin dùng hand-typed wrapper (landing precedent); chạy `pnpm --filter admin generate:api` vs backend :8081 ở QC để swap generated SDK.
- **TD-F085-IGLOO-LIVE-VERIFY** — chưa POST đơn thật (an toàn). Cần Danny bật flag trên prod + verify 1 đơn thật ra `gicContractNo`/`certificateUrl` (rủi ro tích hợp ROAD/1-day vs Igloo server-side validate — submit-worker đã bắt FAILED+errorMessage nếu lệch).
- **TD-F085-ELIGIBLE-COUNT-APPROX** — `eligible-athletes.total` xấp xỉ (SQL hard-filter; phone lọc ở Node). Non-blocking.
- **TD-F085-COURSE-DISTANCE** — `tournament.distance` Phase 1 lấy `course_distance` (chưa JOIN race_course path đầy đủ) → có thể null. Igloo field optional, OK.

## ✅ Self-Review Pipeline (Manager 2026-05-14 mandatory)
- [x] Bước 1: `tsc --noEmit` — igloo backend + admin insurance files CLEAN (4 backend + 8 admin lỗi đều PRE-EXISTING ở upload/result-kiosk spec, không liên quan)
- [x] Bước 2: PRD strict adherence (DTO/endpoint/TC tables matched; OVERRIDES bake đúng)
- [x] Bước 3: Anti-pattern scan — 0 `console.log` / `: any` / `as unknown as` (re-grep clean)
- [x] Bước 4: Hand-pick field mapping — payload build qua 1 helper `buildIglooPayload` (single source, không drop field đa-layer)
- [⚠️] Bước 5: PROD smoke (backend start) — **DEFERRED QC**: backend chưa boot trong session (cần Mongo/Redis/MySQL live + flags off PAUSE-Coder-03). Thay bằng tsc clean + unit tests.
- [⚠️] Bước 6: UI browser inspection — **DEFERRED QC**: admin chưa boot. UI bám component shadcn hiện có + VN labels.
- [x] Bước 7: Real-world data — fixture dùng tên VN dấu + CCCD 12 số + race Lào Cai thật
- [x] Bước 8: Files vs Scope Lock — 0 scope creep
- [x] Bước 9: SDK regen — DEFER (hand-typed wrapper, TD-F085-SDK-REGEN)
- [x] Bước 10: Unit tests PASS (output paste trên)
- [x] Bước 11: `IMPLEMENTATION_NOTES.md` 4 sections đầy đủ

→ Status: 🟠 READY_FOR_QC

## 🔗 Next step
Danny chạy: `/5bib-qc FEATURE-085-igloo-insurance-auto-order`
