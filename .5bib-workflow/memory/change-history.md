# 5BIB Result — Change History

> **Owner:** 5bib-manager
> **Append-only, mới nhất ở TOP.**
>

## 2026-06-15 FEATURE-085: Igloo Insurance — Daily Auto-Order + Admin Manual-Create

**Type:** NEW_MODULE (backend `igloo-insurance` + admin page) + EXTEND (athlete-readonly +created_on).
**Branch:** `5bib_igloo_insurance_v1` → main (CI→DEV). QC ✅ 55 test PASS. Manager review 0 red flag.

**Why:** Danny ký HĐ Igloo nhưng KHÔNG bán bảo hiểm — tự phát sinh đơn cho VĐV thật để **giữ volume hợp đồng**. 5Solution chịu phí. PRODUCTION + PII thật.

### Files changed
- ➕ `backend/src/modules/igloo-insurance/` (NEW module): `utils/igloo-helpers.ts`(+spec) · `igloo-insurance.constants.ts` · `schemas/igloo-insurance-request.schema.ts` · `dto/{create-igloo-requests,igloo-response}.dto.ts` · `services/{igloo-http,igloo-selection,igloo-request}.service.ts`(+request spec) · `igloo-insurance.controller.ts` (7 endpoint LogtoAdminGuard) · `crons/{igloo-daily,igloo-submit-worker,igloo-poll-worker}.cron.ts` · `__qc__/{igloo-insurance,igloo-workers}.qc.spec.ts`
- ✏️ `race-master-data/entities/athlete-readonly.entity.ts` (+`created_on`) · `config/index.ts` (+`env.igloo` 6 var) · `app.module.ts` (register trong platformDbModules) · `.env.example`
- ➕ `admin/src/app/(dashboard)/insurance/page.tsx` + `components/insurance/{InsuranceCreateTab,InsuranceOrdersTab}.tsx` + `lib/{insurance-api,insurance-hooks,insurance-labels}.ts` · ✏️ `lib/nav-groups.ts`

### Architecture impact
- NEW external integration: Igloo partner API (`api-igloo-insurance.5solution.vn`, X-API-Key) → đứng trước GIC. Hàng đợi nội bộ `QUEUED→submit-worker→PENDING→poll-worker→SUCCESS|FAILED` + 3 cron + 2 kill-switch ENV (`IGLOO_DAILY_ENABLED` + `IGLOO_SUBMIT_ENABLED`, default false).
- Nguồn data = legacy MySQL `'platform'` trực tiếp (athletes+athlete_subinfo+races), KHÔNG dùng Mongo cache.

### DB / Cache impact
- MongoDB: collection mới `igloo_insurance_requests` (unique `partnerRefId`=`igloo:<athletesId>:<raceId>` idempotency + index status/mysqlRaceId/athletesId + `{status,lastPolledAt}`).
- MySQL platform: +map cột `athletes.created_on` (readonly, no migration).
- Redis: `igloo:daily-lock:<ymd>`(23h) / `igloo:submit-lock`(110s) / `igloo:poll-lock`(110s) SETNX.
- ENV: `IGLOO_BASE_URL/API_KEY/DAILY_COUNT=10/CRON_HOUR=9/DAILY_ENABLED=false/SUBMIT_ENABLED=false`.

### Business rules khoá
- Phí **CỐ ĐỊNH 10.000đ/đơn**, **packageCode=ROAD luôn**, **coverage 1 ngày** từ event_start_date (Danny chốt — KHÔNG nhân ngày, KHÔNG đổi gói). 10 đơn/ngày. CCCD 9/12 số, KHÔNG VĐV nước ngoài, gender MALE/FEMALE. KHÔNG mask PII (Danny chốt).

### Tech debt (→ known-issues)
- TD-F085-IGLOO-LIVE-VERIFY 🔴 pre-golive (POST 1 đơn thật sau bật flag) · SDK-REGEN · LIVE-E2E · ELIGIBLE-COUNT-APPROX · COURSE-DISTANCE · PERF-SLA.

### Lessons learned
- Pattern "external async integration: queue nội bộ + 2-tier kill-switch + idempotency unique key" → tái dùng cho tích hợp bên thứ ba tương lai.
- Money-critical: ép const + test mọi nhánh ra đúng 1 con số (MONEY-1 it.each).

---

## 2026-06-14 FEATURE-083: Race Landing Page Builder (F-LP) Phase 1 MVP

**Branch/Commit:** `5bib_landing_v1` (9 commit) → merge `main` → CI `build-and-deploy.yml` → DEV.
**Type:** NEW_MODULE (lean-fork F-027 Promo Hub — copy plumbing, KHÔNG import module).

### Files changed
**Backend (➕ NEW module `backend/src/modules/landing/`):**
- ➕ `landing.constants.ts` — `LANDING_SECTION_TYPES` (10), `VARIANTS_BY_TYPE`, `RESERVED_SUBDOMAINS`, `SUBDOMAIN_REGEX`, `HEX_COLOR_REGEX`, `LANDING_CACHE` keys, `TICKETING_BASE_URL`.
- ➕ `schemas/race-landing.schema.ts` — collection `race_landings`, unique `raceRef.raceId`, sparse-unique `domain.subdomain`, section subdoc array, `publish.liveSnapshot`.
- ➕ `dto/{section,landing-parts,create-landing,update-landing,reorder-sections,landing-response}.dto.ts`.
- ➕ `landing.service.ts` — create-seed + publish atomic version-guarded snapshot + `toPublicResponse` allowlist strip (BR-83-20) + subdomain validate (reserved/unique) + SETNX cache + `invalidate()` mọi mutation + CTA mysql_race_id fallback.
- ➕ `landing.controller.ts` — 10 endpoint; route-order `slug/:slug` + `resolve` (public) TRƯỚC `:id`; 8 admin `@UseGuards(LogtoAdminGuard)` + `@ApiResponse`.
- ➕ `landing.module.ts` — Mongoose(RaceLanding+Race) + LogtoAuthModule; registered `app.module.ts` sau PromoHubAnalyticsModule.
- ➕ `landing.service.spec.ts` — 15 unit tests PASS (mocked model + redis-null graceful).
- ✏️ `upload/upload.service.ts` + `upload.controller.ts` — optional sanitized `folder` param (ADJUSTMENT #1, path-traversal-safe, backward-compat date prefix).
- ➕ `backend/test/landing.e2e-spec.ts` — Supertest 401/404/route-order + gated full flow (`LANDING_E2E_ADMIN_TOKEN`).

**Frontend (➕ `app/(landing)` + `components/landing/`):**
- ➕ `app/(landing)/layout.tsx` (no 5BIB chrome) + `landing.css` (tokens scoped `.landing-root`) + `l/[slug]/page.tsx` (SSR fetch `${BACKEND_URL}/api/landings/slug/:slug` ISR 60s + generateMetadata + `notFound()`) + `landing-preview/page.tsx` (DEV harness prod-guarded — renamed từ `__preview` private-folder bug QC fix).
- ➕ `components/landing/`: `types.ts` + `RaceLandingRenderer.tsx` (switch dispatch unknown→null) + `LandingNav.tsx` + `LandingFooter.tsx` + `sections/registry.ts` + **10 section** (Hero/About/Course/Schedule/Pricing/ResultsEmbed/PhotosEmbed/Gallery/Sponsors/ContactSocial) + `*.module.css` — theme `var(--main)`/`var(--sec)`, mobile-responsive, **built via 10-agent workflow fan-out**.
- ✏️ `middleware.ts` — landing subdomain branch `<slug>.5bib.com → /l/<slug>` (`LANDING_RESERVED` set, single-label, no `.5bib.com` cookie R-9).

**Admin (➕ `(dashboard)/landing/`):**
- ➕ `lib/landing-{api,hooks,labels}.ts` (hand-typed `/api/*` proxy wrappers + TanStack hooks + VN dicts; SDK regen deferred TD-F083-SDK-REGEN).
- ➕ `(dashboard)/landing/page.tsx` (list + create dialog raceId + delete) + `[id]/builder/page.tsx` + `components/landing/LandingBuilder.tsx` (tabs Section/Giao diện theme picker/Tên miền/SEO).
- ✏️ `nav-groups.ts` — entry "Trang giải chạy" (Globe, requireRole admin).

**Docs:** ✏️ `CLAUDE.md` — Redis registry 4 key + S3 Lifecycle rule 7 (`landing-assets/` no-expire).

### Architecture impact
- NEW public flow: subdomain middleware rewrite → `/l/[slug]` SSR → backend `GET /api/landings/slug/:slug` (cache 60s + SETNX) → strip `liveSnapshot` → render. Zero-cross-module-DI (auto-data at frontend SSR — Phase 2 enricher TD-F083-AUTODATA). architecture.md updated.

### Conventions impact
- 4 patterns minted: F-083.1 lean-fork plumbing without import, F-083.2 publish snapshot = public source-of-truth, F-083.3 subdomain catch-all middleware + reserved-set, F-083.4 allowlist-literal public strip > spread-delete.

### DB / Cache impact
- MongoDB: NEW collection `race_landings` (unique `raceRef.raceId` + sparse-unique `domain.subdomain`). NO migration.
- Redis: `landing:slug:<sub>` (60s, stripped DTO) / `landing:resolve:<host>` (300s) / `landing-lock:<sub>` (5s SETNX) / `ratelimit:landing-view:` (reserved Phase 2).
- S3: `landing-assets/<landingId>/...` no-expire (rule 7); upload.service `folder` param.

### Tech debt còn lại (→ known-issues.md)
- TD-F083-AUTODATA (HIGH Phase 2) · SECTIONFORMS · RACEPICKER · PREVIEWPANE · RESULTS-IFRAME-PHASE2 · SDK-REGEN · C2-ADMIN-AUTH-WALKTHROUGH-PRE-PROD.

### Lessons learned
- **Lean-fork > extend:** copy a proven module's plumbing WITHOUT importing it → zero coupling + free to build NEW premium UI without inheriting the source's UX debt (Danny's Promo Hub UX complaint).
- **Allowlist-literal strip an toàn hơn spread-delete:** miss-field = absent, không leak (vs `delete obj.x` dễ quên field mới).
- **Next.js `_`-prefix = private folder** (non-routable) → `__preview` 404; caught chỉ bằng LIVE testing, không bằng tsc. Manual E2E > static check cho routing.
- **10-agent workflow fan-out** dựng 10 section premium song song + strict contract → tsc-clean, wall-clock thắng.

---

## 2026-06-16 FEATURE-086: Invoice Visibility Counters (tổng/hôm nay/lỗi vào Telegram)

**Branch:** `5bib_invoice_v2` off `2e3f993` (PROD v1.18.0) → release/v1.19.0
**Type:** EXTEND_EXISTING (F-076 invoice-reconcile visibility layer)
**Trigger:** Danny sau mấy ngày vận hành: "không biết tổng hóa đơn xuất / hôm nay / lỗi bao nhiêu, tin nhắn cũng đếch biết".
**QC:** ✅ APPROVED — 145/145 + adversarial verify 7/7, 0 bug blocking.

**Files (5 service + 2 test):**
- ✏️ `invoice-reconcile/services/misa-meinvoice.client.ts` — `countInvoicesInRange(from,to)` 1-page take=1 → TotalCount
- ✏️ `invoice-reconcile/services/daily-counters.service.ts` — `CUMULATIVE_ISSUED_KEY` no-TTL + set/get (idempotent SET)
- ✏️ `invoice-reconcile/services/alert-composer.ts` — `RecapExtras` + `computeErrorBreakdown` + 3-dòng summary heartbeat (2 state) + EOD 2 dòng
- ✏️ `invoice-reconcile/services/invoice-alert.service.ts` — sendHourly/EodRecap +extras
- ✏️ `invoice-reconcile/services/invoice-reconcile.service.ts` — CUMULATIVE_START_DATE='2026-06-08' + refreshCumulativeIssued + buildRecapExtras (2-tầng throw-safe)
- ➕ `__tests__/f086-visibility-counters.spec.ts` (18) + ✏️ misa spec (+2) + mock 3 method mới

**Design lessons:**
- Cumulative = MISA TotalCount SET (KHÔNG INCR snapshot ×288/ngày, KHÔNG diff-ISSUED undercount). Authoritative + idempotent.
- Error = snapshot ("đang có N"), KHÔNG tích lũy (UNISSUED resolved → hết lỗi). breached ⊂ unissued.
- Heartbeat MUST send (BR-86-06) — buildRecapExtras 2-tầng catch → {0,0} dù MISA+Redis throw.
- +TD-F086-01-MISA-TOTALCOUNT-RAW (gồm HĐ hủy/thay thế).

## 2026-06-10 FEATURE-082: Reconciliation TZ Cutover — ICT boundary từ kỳ T6/2026

**PR/Commit:** push main + release/v1.16.0 (commit F-082)
**Type:** BUGFIX (financial — Tier A2 từ F-081 audit, Danny chốt PAUSE-81-01 "Ừm từ kì Tháng 6 thôi")
**QC verdict:** ✅ APPROVED (23 util + 4 QC param-assert + 646/647 sweep, 2 pre-existing)

**Files:**
- ✏️ `backend/src/common/utils/ict-date.util.ts` — +`ICT_PERIOD_CUTOVER='2026-06'` + `prevPeriod`/`endOfPeriodMs` + `periodRangeUtc()` (seam continuity invariant `startOf(P)=endOf(P-1)+1s`)
- ✏️ `backend/src/common/utils/ict-date.util.spec.ts` — +11 cutover matrix test (chain T4→T8 1000ms gap, seam single-count `inT6=false`, straddle, year boundary)
- ✏️ `reconciliation/services/reconciliation-query.service.ts` — `queryOrders` boundary qua helper (preflight share → count nhất quán create())
- ✏️ `reconciliation/services/reconciliation-preflight.service.ts` — `checkFeeChanged` cùng rule
- ✏️ `finance/services/fee.service.ts` — periodClause đồng bộ (chống F-058 MAJOR_DRIFT giả)
- ✏️ `analytics/analytics.service.ts` — buildDateFilter month branch qua helper (clause exclusive → inclusive)
- ✏️ `reconciliation/services/reconciliation.cron.ts` — `timeZone: 'Asia/Ho_Chi_Minh'` + prev-month derive ICT
- ✏️ `finance/services/pnl.service.ts` — presets `monthStartIctOffset()` ICT trực tiếp (rolling, KHÔNG cutover; custom branch đã ICT-aware)
- ➕ `reconciliation/services/__qc__/f082-period-boundary.spec.ts` — 4 param-assert regression gate (T4 UTC / T6 seam / T7 ICT / re-create-T5 determinism)

**KHÔNG đổi (altitude verdict):** parsePeriod ×2, Mongo overlap queries, schema period_start/end, admin period-helpers, regenerate(), period.validator.

**Lesson:** ultracode workflow map (4 readers + adversarial verify) chặn 3 blocking gaps TRƯỚC code — minted convention F-082.1. +4 TD mới (xlsx processed_on display cần Danny chốt / parsePeriod dup / pnl isoMonth / effective_from lexico).

## 2026-06-09→10 FEATURE-080 + FEATURE-081: Race Title MySQL Fallback + Systemic TZ Audit (ghi bù)

**PR/Commit:** `37e0a6d` (F-080) + `58f0826` (F-081) — đã DEPLOYED PROD, entry ghi bù vào change-history (feature-log đã sync trước).
**F-080:** `invoice-reconcile.service.ts` `resolveRaceTitlesSafe` 2-phase + `queryRaceTitlesMysql` ('platform' connection, `?` placeholder) + warm-back Redis F-049 key 3600s. Chain 4 layer: Redis → Mongo → MySQL → `Race {id}`. Resolves TD-F079-MONGODB-RACE-SYNC-MISSING. +7 TC.
**F-081 (scope A1+B):** NEW `common/utils/ict-date.util.ts` 6 helper + 12 boundary test. Fixed: kpi.service MTD ICT + sparkline ICT labels/SQL `DATE(DATE_ADD(payment_on, INTERVAL 7 HOUR))` + analytics default from/to + docx/xlsx/podium-pdf ngày ký. Tier A2 financial deferred → F-082. Convention F-081.1.

## 2026-06-09 FEATURE-079: F-076 Heartbeat Recap 2h + Race Title Resolver (incident response)

**PR/Commit:** TBD — branch decision pending Danny (suggest commit straight to PROD release nhanh do incident-driven F-076 visibility gap, hoặc branch riêng nếu group với F-078)
**Type:** BUGFIX (extend F-076 BR-25 noise control + add race title resolver)
**Trigger:** Sáng 2026-06-09 10:00 ICT F-076 vừa golive race 220 bán vé. Đến 13:54 bot `@invoice_5bib_daily_bot` im lặng — Danny báo. Manager triage: 47 cron tick PASS từ 10:00→13:50, tất cả `missing=0 maxSeverity=INFO`. BR-25 `if (missingCount === 0 && diffEvents.length === 0) return false` — đúng spec nhưng KHÔNG match Danny intent "tổng hợp theo tiếng cho kế toán nắm thông tin". Danny chốt heartbeat 2h/lần.
**QC verdict:** ✅ APPROVED (189/189 tests + 6 phase complete + 4 QC structural assertions)
**Manager Code Review:** ✅ ALL 5 priority files PASS (zero red flag, zero BR conflict)

### Files changed (12 total)

**Backend modified (8):**
- ✏️ `backend/src/modules/invoice-reconcile/crons/hourly-recap.cron.ts` — cron expression `'0 0 8-20 * * *'` (13 tick/ngày) → `'0 0 8,10,12,14,16,18,20,22 * * *'` (8 tick/ngày 2h tròn) + comment update
- ✏️ `backend/src/modules/invoice-reconcile/services/invoice-alert.service.ts` — Remove skip block (BR-79-04) + signature mở rộng `raceTitlesByid` param + doc update heartbeat semantics
- ✏️ `backend/src/modules/invoice-reconcile/services/alert-composer.ts` — Add `composeRaceTag()` helper (BR-79-20/23/24/25) + `computeNextHeartbeatHour()` helper (BR-79-11) + 3-state branch render (All OK Heartbeat header / All OK + diff / Có issue Recap header BR-25 intact) + `formatDiffEvent()` race tag context
- ✏️ `backend/src/modules/invoice-reconcile/services/invoice-reconcile.service.ts` — Inject `AthleteIdentityClusteringService` Optional + `resolveRaceTitlesSafe()` defensive 3-path wrapper (BR-79-23) + wire to `sendHourlyRecap`. Constructor `raceTitleResolver` APPENDED END (sau redis) cho backward compat F-076 spec 8 existing positional calls (Deviation #1)
- ✏️ `backend/src/modules/invoice-reconcile/services/reconcile-classifier.ts` — Add `skippedCount: number` field (BR-79-12) + compute `dbOrders.length - expectedCount`
- ✏️ `backend/src/modules/invoice-reconcile/dto/reconcile-report.dto.ts` — Add `@ApiPropertyOptional() skippedCount?` field optional backward compat cached old reports
- ✏️ `backend/src/modules/invoice-reconcile/invoice-reconcile.module.ts` — Import `RaceMasterDataModule` cross-module DI
- ✏️ `backend/src/modules/race-master-data/race-master-data.module.ts` — **FORCED CASCADE** add `AthleteIdentityClusteringService` to exports[] (Manager Plan đọc nhầm providers thành exports — F-079 IMPLEMENTATION_NOTES Section 2 Forced #1)

**Backend tests (3):**
- ✏️ `backend/src/modules/invoice-reconcile/__tests__/alert-composer.spec.ts` — extend +14 NEW F-079 tests (TC-79-01/02/03 3-state + TC-79-04 computeNextHeartbeatHour 10-row truth table + TC-79-15 truncate + TC-79-16 multi-race + TC-79-17 XSS escape)
- ✏️ `backend/src/modules/invoice-reconcile/__tests__/invoice-reconcile.service.spec.ts` — extend +8 NEW F-079 tests (TC-79-05 skip removed + TC-79-06 dispatch fail graceful + TC-79-08 resolver wire + TC-79-10 concurrent + TC-79-11/12 resolver call + TC-79-13 defensive fallback + TC-79-14 partial Map + Resolver-not-wired)
- ➕ `backend/src/modules/invoice-reconcile/__tests__/hourly-recap.cron.spec.ts` (NEW) — 6 tests (TC-79-07 source assertion via readFileSync + Reflect metadata + math verification + regression OLD `'0 0 8-20'` 13 ticks → NEW 8 ticks)
- ➕ `backend/src/modules/invoice-reconcile/__qc__/f079-module-wiring.spec.ts` (NEW QC) — 4 structural assertions Reflect.getMetadata Nest module inspection + Test.createTestingModule().compile() boot integration

**Frontend:** ZERO change. SDK regen NOT needed (DTO field optional, zero endpoint shape change).

### Architecture impact

- **No structural change to high-level architecture.** Heartbeat = internal alert-flow widen (relax skip + add race title), KHÔNG thêm node mới vào sơ đồ.
- **Cross-module DI: `InvoiceReconcileModule` → `RaceMasterDataModule`** consume `AthleteIdentityClusteringService.getRaceTitlesByMysqlIds()`. F-049 cache pattern `races:title:byMysqlId:<id>` 3600s + Mongo fallback shared namespace.
- **No new endpoints, no new database collection, no new Redis key, no new S3 prefix.**

### Conventions impact

4 patterns minted (F-079.1 → F-079.4):

1. **F-079.1 Cross-module exports[] explicit checklist** — Pattern grep `grep -n "exports:" [target].module.ts` BEFORE claiming "service exported". Phân biệt `providers[]` (DI-internal) vs `exports[]` (cross-module). F-079 Forced Cascade #1 lesson.
2. **F-079.2 Heartbeat 3-state composer pattern** — Branch theo state `report.missingCount === 0`: "Heartbeat" header (All OK) vs "Recap" header (Có issue). Visual cue cho recipient glance. Reusable cho future periodic alert.
3. **F-079.3 Resource resolver reuse via cross-module DI** — Khi cần data từ module khác (vd race title), reuse existing battle-tested service thay vì viết direct query. F-049 `AthleteIdentityClusteringService.getRaceTitlesByMysqlIds()` production-hardened (Redis mget batch + Mongo fallback + graceful Redis fail).
4. **F-079.4 Optional inject + defensive wrapper pattern** — `@Optional() resolver?` cho cross-module DI + try/catch wrapper return safe default. Heartbeat MUST NOT block on dependency failure (BR-79-23). Pattern reusable cho future feature có "nice-to-have" dependency.

### DB / Cache impact

- **MongoDB:** ZERO change. F-079 chỉ READ `race` collection qua F-049 method.
- **MySQL platform:** ZERO change.
- **Redis:** ZERO new key. SHARE F-049 cache namespace `races:title:byMysqlId:<id>` 3600s.
- **S3:** ZERO change.

### Tech debt còn lại (moved to known-issues.md)

5 entries — all non-blocking deploy:

- **TD-F079-EXTRACT-RACE-TITLE-RESOLVER** — Future extract `getRaceTitlesByMysqlIds()` thành shared `RaceTitleResolverService` trong `common/` (LOW priority)
- **TD-F079-TZ-BOUNDARY-FILTER** (Manager Init carry-forward) — DB 23 ORDINARY today vs F-076 expected=22 lệch 1 đơn cross-midnight ICT 04:14 (MEDIUM, defer feature riêng)
- **TD-F079-CRON-PARSER-NOT-INSTALLED** — Cron spec source assertion thay vì cron-parser lib (LOW, non-blocking)
- **TD-F079-SMOKE-TEST-PRE-MERGE** — PRD BR-79-18 5-step smoke (cron tick + Telegram dispatch + race 220 verify) — Danny execute PRE-MERGE (CRITICAL pre-merge, NOT blocking QC)
- **TD-F079-MODULE-EXPORTS-CONVENTION** — Manager Plan template update phân biệt providers vs exports[] cho cross-module DI (process improvement)

### Lessons learned

1. **F-076 BR-25 design intent gap** — Coder hiểu "skip-when-OK" để tránh noise; Danny hiểu "gửi đều cho visibility". Future PRD nên explicit "noise vs visibility" tradeoff khi design alert system. Incident response F-079 fixes this in 1 cron + 1 service + 1 composer change.
2. **Pattern reuse F-049 worked beautifully** — Cross-module DI consume battle-tested service + Optional inject defensive wrapper = ship faster + lower risk than viết riêng MySQL direct query.
3. **Forced cascade `RaceMasterDataModule.exports[]`** — Manager Plan template gap. Future Plan spot-check rule: grep `exports:` explicit khi claim "service exported". Tracked TD-F079-MODULE-EXPORTS-CONVENTION.
4. **Constructor positional backward compat** — Append Optional dependencies to END of constructor instead of inserting middle. Avoid forced cascade tất cả existing test factories. Coder Deviation #1 chuẩn pattern.
5. **Cron lib version drift** — `@nestjs/schedule` v3+ uses `cron` lib internally; `cron-parser` lib KHÔNG bundled. Source assertion + math verification pattern = robust test without external dep.

### Branch decision

F-076 vừa golive sáng nay 2026-06-09 (race 220 bán vé) + F-078 Finance Role + F-079 incident response — 3 features cùng ngày. Manager đề xuất Danny:
- Option A: Branch riêng `5bib_invoice_heartbeat_v1` off main, port F-079, smoke test, merge → main → release tag bao gồm cả F-076 fix + F-079 incident response
- Option B: Cherry-pick vào release branch nếu release window cho phép
- Option C (recommended): Group F-078 + F-079 cùng release branch `5bib_q2_compliance_v1` (cả 2 feature đụng admin + RBAC + invoice flow)
Danny chốt khi sẵn sàng commit + smoke.

---

## 2026-06-09 FEATURE-078: Finance Role RBAC — Logto role `finance` cho kế toán nội bộ

**PR/Commit:** TBD (branch decision pending Danny — suggest `5bib_finance_role_v1` off main per F-076 precedent vì `release/v1.16.0` đang stabilize)
**Type:** EXTEND_EXISTING
**QC verdict:** ✅ APPROVED (769/769 tests + 6 phase complete)
**Manager Code Review:** ✅ ALL 5 priority files PASS (zero red flag, zero BR conflict, zero type bypass)

### Files changed (37 total)

**Backend (22):**
- ➕ Added: `backend/src/modules/logto-auth/logto-finance.guard.ts` — Internal Finance tier guard (finance + admin inheritance dual-check + VN error message). Pattern reuse F-069 LogtoMerchantFinanceGuard.
- ➕ Added: `backend/src/modules/logto-auth/logto-staff-or-finance.guard.ts` — Loosened union guard cho contracts (staff∪finance∪admin per PAUSE-78-01 — staff Tâm/Hằng giữ quyền)
- ➕ Added: `backend/src/modules/logto-auth/logto-finance.guard.spec.ts` — 17 test (TC-01..04 + TC-08..10 + edge case)
- ➕ Added: `backend/src/modules/logto-auth/logto-staff-or-finance.guard.spec.ts` — 20 test (TC-05..07 + union matrix)
- ➕ Added: `backend/src/modules/logto-auth/permissions.helper.spec.ts` — 47 test (TC-12 isFinanceOrAdmin truth table + isStaffOrFinanceOrHigher parity)
- ➕ Added: `backend/src/modules/logto-auth/__qc__/f078-rbac-controller-wiring.spec.ts` — 44 test QC structural assertion (Reflect.getMetadata verify mỗi 13 controller decorated đúng guard)
- ✏️ Modified: `backend/src/modules/logto-auth/permissions.helper.ts` — append `isFinanceOrAdmin` + `isStaffOrFinanceOrHigher` helpers (mirror guards verbatim per F-029 convention)
- ✏️ Modified: `backend/src/modules/logto-auth/index.ts` — export 2 guard + 2 helper new
- ✏️ Modified: `backend/src/modules/logto-auth/logto-auth.module.ts` — register 2 guard mới vào providers + exports (PAUSE-Coder-05 Manager spot-check catch)
- ✏️ Modified: 9 controller LogtoAdminGuard → LogtoFinanceGuard:
  - `finance/controllers/{pnl,pnl-dashboard,pnl-contracts-list,pnl-export,cost-items,cost-suggestions,fee-breakdown,mysql-lookup}.controller.ts`
  - `invoice-reconcile/invoice-reconcile.controller.ts`
- ✏️ Modified: 4 controller LogtoStaffGuard → LogtoStaffOrFinanceGuard:
  - `contracts/{contracts,contract-templates,partners,service-catalog}.controller.ts`
- ✏️ Modified: `backend/src/modules/invoice-reconcile/__tests__/invoice-reconcile.controller.spec.ts` — **FORCED CASCADE** override `LogtoAdminGuard` → `LogtoFinanceGuard` (4 vị trí: import + overrideGuard + 2 doc comment). KHÔNG trong Scope Lock plan — Coder honest disclose IMPLEMENTATION_NOTES Section 2 + Manager accept.

**Frontend (14):**
- ✏️ Modified: `admin/src/lib/auth-context.tsx` — add `isFinance` flag (mirror backend dual-check verbatim line 99-105)
- ✏️ Modified: `admin/src/lib/nav-groups.ts` — widen `requireRole?: "admin" | "finance"` type + đổi 3 Tài chính items từ "admin" → "finance" + giữ Hợp đồng items KHÔNG có requireRole (BR-78-26 loosened nav)
- ✏️ Modified: `admin/src/components/admin-shell/Sidebar.tsx` — filter logic 3-branch ternary (admin/finance/default) BR-78-11
- ✏️ Modified: 4 finance pages gate `!isAdmin && !isFinance` (BR-78-21): `(dashboard)/finance/page.tsx`, `(dashboard)/finance/contracts/page.tsx`, `(dashboard)/finance/contracts/[id]/page.tsx`, `(dashboard)/invoice-reconcile/page.tsx`
- ✏️ Modified: 7 contracts pages gate `!isStaff && !isFinance` (BR-78-22): `(dashboard)/contracts/{page,[id]/page,create/page,services/page,templates/page,partners/page,partners/[id]/page}.tsx`

**Tests (1 NEW QC):**
- ➕ Added: `backend/src/modules/logto-auth/__qc__/` directory với QC structural test

### Architecture impact

- **Security Boundaries (architecture.md):** new tier `finance` giữa `staff` và `admin` cho internal routes. Defense layers:
  - Layer 1 (Logto Dashboard): permission `finance` + role `finance` + admin inherits `finance`
  - Layer 2 (Backend Guard): `LogtoFinanceGuard` + `LogtoStaffOrFinanceGuard` extends LogtoAuthGuard JWT verify
  - Layer 3 (Frontend page gate): `!isAdmin && !isFinance` (finance pages) hoặc `!isStaff && !isFinance` (contracts pages)
  - Layer 4 (Sidebar UX hide): `requireRole="finance"` filter
- KHÔNG đổi data flow (RBAC pure gate widen, không touch DB/cache/integration).

### Conventions impact

3 conventions mới được mint:
1. **Internal RBAC tier — Finance role pattern** — `LogtoFinanceGuard extends LogtoAuthGuard` (root, KHÔNG nested admin/staff). Defense-in-depth dual-layer Logto + Guard fallback. Mirror frontend `isFinance` flag derivation.
2. **Loosened union guard pattern** — `LogtoStaffOrFinanceGuard` union staff∪finance∪admin cho trường hợp mở role mới mà KHÔNG được làm tier cũ regress. Anti-pattern: strict replace (sẽ break existing user).
3. **Forced spec cascade rule** — Khi đổi `@UseGuards()` controller, MUST audit `__tests__/[controller].spec.ts` xem có `overrideGuard()` reference không + include vào Scope Lock. F-078 forced cascade lesson: F-076 invoice-reconcile.controller.spec.ts dùng `overrideGuard(LogtoAdminGuard)` → 10 test fail 401 sau rename → buộc fix ngoài Scope Lock. Manager Plan template cần thêm rule này.

### DB / Cache impact

- **MongoDB:** ZERO change
- **MySQL platform:** ZERO change
- **Redis:** ZERO change
- **S3:** ZERO change
- **Logto Dashboard:** Danny manual setup 5 step (permission `finance` + role `finance` + admin inherit + Hiền assign + sign-out/in)

### Tech debt còn lại (moved to known-issues.md)

5 entries — all non-blocking deploy:
- **TD-F078-DOCS-CONVENTIONS-INTERNAL-FINANCE-TIER** — `docs/conventions.md` section append (LOW)
- **TD-F078-SMOKE-TEST-PROD-DEFERRED** — F-076 BR-18 6-step + Telegram BR-19 verify PRE-MERGE (CRITICAL pre-merge, NOT blocking QC/Manager review)
- **TD-F078-FORCED-SPEC-PATTERN** — Manager Scope Lock template addendum cho future @UseGuards rename (MEDIUM, process improvement)
- **TD-F078-F026-E2E-FINANCE-FORBID-REGRESSION** — Future E2E: finance token → /analytics (F-026 admin-only) → expect 403 (LOW, defer-able)
- **TD-F078-E2E-PLAYWRIGHT-4-PERSONA** — Full Playwright 4 persona × 13 controller (MEDIUM, post-deploy)

### Lessons learned

1. **Pattern reuse precedent works** — F-069 LogtoMerchantFinanceGuard → F-078 LogtoFinanceGuard 80%+ identical structure. Convention mature đủ để clone confidently.
2. **Forced cascade là failure mode lặp lại** — Scope Lock đã miss F-076 spec mock. Coder hand-disclose nhờ IMPLEMENTATION_NOTES Section 2 trust check. Future: Manager Plan add "controller spec audit" step.
3. **Defense-in-depth dual-layer Logto + Guard** valuable — admin user KHÔNG bị 403 bất ngờ nếu Danny quên tick permission. TC-10 explicit verify.
4. **Manager Code Review Priority order từ IMPLEMENTATION_NOTES Section 4 hiệu quả** — Coder chỉ ra 5 hotspot, Manager spot-check theo order, all PASS. Trust pattern Danny 2026-05-19 directive worth it.

### Branch decision

`release/v1.16.0` đang stabilize cho PROD release. Manager đề xuất Danny:
- Option A: Tạo branch mới `5bib_finance_role_v1` off main, port F-078 changes, smoke test, merge → main → next release tag bao gồm F-078
- Option B: Cherry-pick / commit F-078 trực tiếp vào `release/v1.16.0` nếu release v1.16.0 chấp nhận RBAC addition
Danny chốt khi run smoke test + push commit.


> Lịch sử chi tiết per-feature (chỉ qua workflow). Đọc khi cần hiểu **tại sao** một file/module đang ở trạng thái hiện tại.

---

## [2026-06-08] QC-ROUND (browser UAT): fix 3 lỗi data-thực F-072/F-073
Danny challenge "đã QC FE chưa?". Browser-UAT thật trên merchant-dev (giải Mẫu Sơn 452 vé) → bắt 3 lỗi compile/unit không thấy:
1. **F-073 capacity sold**: dùng quota−remained_ticket → lệch by-course paid (253 vs 261 cùng trang). FIX: sold=PAID count (LEFT JOIN paid oli SUM quantity), remaining=quota−sold. → verified 261/125/66 khớp.
2. **F-072 size canonical**: SIZE_ORDER thiếu XXS/2XS/3XS → race có size thật rơi "Khác". FIX: thêm 3XS/2XS + map XXS→2XS/XXXS→3XS.
3. **F-072 size empty-state**: race không thu size (tshirt_size NULL toàn bộ, BTC bán áo tại sự kiện) → bar "Khác 100%" vô nghĩa. FIX: empty-state "Giải này chưa thu dữ liệu size áo".
169 backend jest + FE tsc/vitest/build. commit 9c3344e. **LESSON: browser-QC bắt lỗi data-thực mà unit/compile KHÔNG thấy — KHÔNG defer DEV-smoke cho Danny, QC FE là việc của agent.**

## [2026-06-08] FEATURE-074: YoY So với mùa trước — ✅ DEV
**Type:** EXTEND_EXISTING. BE+FE 1 push. Danny chốt BTC tự chọn giải so sánh (dropdown).
### Files: BE ➕utils/yoy.util.ts(+spec 7) +dto/yoy.dto.ts; ✏️service (getRaceMeta+getYoyComparable+buildYoySeries+getYoyCurve) +controller (GET yoy/comparable + yoy/curve). FE ✏️races/[raceId]/page.tsx (YoYCard MKT section: dropdown + MultiLineChart overlay theo days-before) +i18n(5 key×5) +SDK hand-add.
### Data: races(tenant_id/event_start_date/title) + order_metadata.payment_on. daysBefore align (0=ngày đua), cumulativeCurve Node. comparable = cùng tenant + earlier + ACCESSIBLE (IDOR-safe). curve IDOR assertRaceForUser CẢ 2 race. cache 300s. no-PII.
### Tests: 7 util + 168 merchant-portal jest + FE tsc0/vitest13/build/no-Thai.
### TD: 180DAY-CAP, SDK-HANDADD. Lesson: align days-before để overlay 2 giải khác lịch.

## [2026-06-08] BUGFIX: Ẩn fee-warning leak khỏi merchant portal
FeeService warnings ("MerchantConfig không tồn tại cho tenantId=X — fallback Tier 3 platform default 5.5%...") đẩy thẳng ra merchant qua `revSummary.warnings` → **leak tenantId + cơ cấu phí nội bộ** cho BTC.
Fix: `merchant-portal.service.ts` 4 site (revenue summary/by-category/aggregate/trend) → `logFeeWarningsInternal()` log server-side, KHÔNG đẩy ra merchant (warnings=[] → FE banner tự ẩn via `!warnings.length` guard). Backend-only. Test cũ "propagates Tier-3" → đảo thành "HIDDEN (no tenantId/tier leak)". 161 jest PASS.

## [2026-06-08] FEATURE-073: Capacity/Quota (Sức chứa từng cự ly) — ✅ DEV
**Type:** EXTEND_EXISTING. BE+FE gộp 1 push (né concurrency-cancel F-072 lesson).
### Files: BE ➕utils/capacity.util.ts(+spec 7) +dto/capacity.dto.ts; ✏️services/merchant-portal.service.ts (getCapacity) +merchant-portal.controller.ts (GET /capacity). FE ✏️races/[raceId]/page.tsx (CapacityCard section tab Vé + loadCore fetch additive) +i18n.ts (6 key×5) +SDK hand-add.
### Data: ticket_type.max_participate (quota) + remained_ticket (sold=quota-remaining). race_course.max_participate BỎ (placeholder=1). scope rc.race_id+deleted. aggregate-in-Node per course, sort %filled DESC. cache 300s. IDOR + no-PII + ticket-scope.
### Tests: 7 util + 161 merchant-portal jest + FE tsc0/vitest13/build/no-Thai.
### TD: SOLD-SEMANTICS (remained vs paid), DEFAULT-1000, SDK-HANDADD.
### Lesson: race_course quota = rác → luôn sample data thật trước khi tin field (memory-first). Gộp BE+FE 1 push tránh CI concurrency cancel.

## [2026-06-08] FEATURE-072: Merchant Participant Insights (size áo + giới/AG/quốc tịch) — ✅ DEV (pending CI)

**Type:** EXTEND_EXISTING. BE `be9a634` + FE `2f32f50`.
### Files
- BE ➕ utils/participant-insights.util.ts(+spec 17) + dto/participant-insights.dto.ts; ✏️ services/merchant-portal.service.ts (pullParticipantRows/getRaceDay/getParticipantInsights/getParticipantInsightsExport) + merchant-portal.controller.ts (2 GET: participants/insights + /export)
- FE ✏️ races/[raceId]/page.tsx (tab "Cơ cấu VĐV" + ParticipantsTab) + lib/mp/i18n.ts (10 key×5) + SDK hand-add (types.gen+sdk.gen)
### Data: athlete_subinfo join oli.id=asi.order_line_item_id → om (paid, om.race_id scope). Pull-then-aggregate-in-Node (robust messy varchar dob/nationality/size). AG WA 5-năm. Excel export size×cự ly.
### Tests: 17 util + 154 merchant-portal jest + FE tsc 0/vitest 13/build 15 routes. IDOR assertRaceForUser, no-PII aggregate.
### TD: LABEL-I18N, IS-REPRESENT (verify guardian), SDK-HANDADD (reconcile generate:api).
### Lesson: DEV CI backend deploy chậm/không đáng tin → hand-add SDK để unblock; reconcile sau. Verify schema TRƯỚC (athlete_subinfo goldmine: size+dob+gender+nat+province 1 bảng).

## [2026-06-08] FEATURE-071: Merchant Portal +3 ngôn ngữ ĐNA (Khmer/Lào/Mã Lai) — ✅ DEPLOYED (DEV pending push)

**Type:** EXTEND_EXISTING (refactor merchant i18n core + content dịch). Frontend-only `merchant/`, 0 backend/SDK/DB/migration.

### Files changed (9 + 2 new test/config, all `merchant/`)
- ✏️ `src/lib/mp/i18n.ts` — `Lang` 2→5 (vi/en/km/lo/ms); `Entry` `{vi,en}`→`{vi}&Partial<Record<Exclude<Lang,'vi'>,string>>` (vi base-required, fallback); `t()`/`lab()` fallback `e[lang]||e.vi` + raw-key on miss; +`LANGS`/`LANG_CODES`/`isLang` registry; đổ 131 entry × km/lo/ms + key mới `lang_save_note`.
- ✏️ `src/lib/mp/lang-context.tsx` — localStorage validate qua `isLang` (BR-04); `toggleLang`→cycle 5 lang.
- ✏️ `src/lib/mp/fmt.ts` — `NF_LOCALE` map 5 locale (km-KH/lo-LA/ms-MY) + `nf()` try/catch; `vnd` giữ `" đ"` mọi lang (BR-07); `monthShort` 5-lang (km/lo dùng "M{m}" ASCII axis-safe).
- ✏️ `src/components/mp/ui.tsx` — NEW `LangDropdown` (cờ+tên, click-outside+Esc, active ✓); Topbar pill→`<LangDropdown/>`; bỏ prop `onLang` khỏi Topbar+AppShell.
- ✏️ `src/lib/fonts.ts` — Noto_Sans_Khmer + Noto_Sans_Lao (next/font/google, subset khmer/lao, no install).
- ✏️ `src/app/layout.tsx` — 2 font variable vào html className.
- ✏️ `src/app/globals.css` — nối `var(--font-khmer)`,`var(--font-lao)` vào `--font-body`/`--font-display` stacks (chỉ fallback glyph thiếu, Latin/VN không đổi).
- ✏️ `src/app/settings/page.tsx` — `langOptions` từ LANGS (5); bỏ onLang; note song ngữ → `t('lang_save_note')`.
- ✏️ `src/app/dashboard/page.tsx` — bỏ onLang/toggleLang; RaceCard prop `"vi"|"en"`→`Lang` (Forced #1, tsc bắt).
- ✏️ `src/app/races/[raceId]/page.tsx` — bỏ onLang/toggleLang.
- ➕ `src/lib/mp/i18n.spec.ts` — 13 test (TC-01..12).
- ➕ `vitest.config.ts` + ✏️ `package.json`+`pnpm-lock.yaml` — devDep `vitest` 4.1.8 + script `test` (Manager DECISION-1).

### Architecture impact
- Không thêm node backend/integration. Thuần frontend i18n. architecture.md không đổi.

### Conventions impact
- **NEW pattern minted:** (1) "i18n fallback-to-base-locale" — `Entry` base-required (`vi`) + `Partial` rest + `t()` fallback + coverage-test ép đủ runtime; (2) "next/font multi-script stacking" — append CSS var Noto vào font stack cho glyph phi-Latin, primary font không đổi. → conventions.md updated.

### DB / Cache impact
- KHÔNG có. localStorage chỉ lưu `mp_lang` (2 ký tự, không PII).

### Tech debt còn lại (→ known-issues)
- TD-F071-GLYPH-UAT: live screenshot Khmer/Lào trên DEV (Logto-gated, không UAT local) — verify gián tiếp 2 lớp (script-range + build font-load).
- TD-F071-TRANSLATION-NATIVE-REVIEW: km/lo provisional (Claude), cần native review nghĩa trước PROD (chuỗi tài chính kpi_net/kpi_fee/kpi_gmv).
- TD-F071-MONTHSHORT-KM-LO: axis tháng km/lo "M{m}" ASCII thay tên bản địa (axis-safety).

### QC/verify
- vitest 13/13 PASS + adversarial coverage-net proven (xoá 1 km → đỏ đúng key) + script-range 130/131 đúng khối Unicode km/lo + XSS 0 (no dangerouslySetInnerHTML) + tsc 0 + next build 15 routes.

### Lessons learned
- **i18n nên dùng `Record<Lang,string>` từ đầu**, KHÔNG `{vi,en}` cứng — F-069 build binary toggle → F-071 phải refactor core + toggle→dropdown. Danny phản hồi "sai từ đầu" → đúng.
- **Coverage-as-test** (loop ép đủ N lang non-empty) biến "dịch đủ" thành assertion tự động — pattern tái dùng cho mọi i18n đa-ngôn-ngữ.
- **Script-range validation** (codepoint block check) = QC tool mạnh cho ngôn ngữ phi-Latin (bắt lẫn Thái/Latin/copy-vi mà mắt thường khó thấy).

---

## [2026-06-08] Merchant Portal — UAT fixes + Admin per-race access (post F-070)

**Type:** BUGFIX + EXTEND_EXISTING (merchant-portal). Branch main → DEV. Danny UAT browser phát hiện.

### ⚠️ CORRECTION cho entry F-070 bên dưới (timezone)
- F-070 entry ghi "payment_on lưu UTC → +7h" → **SAI**. UAT 2026-06-08 chứng minh `order_metadata.payment_on` **lưu sẵn giờ VN (GMT+7)**: order mới nhất payment_on='2026-06-07 23:06' > dbnow UTC ~15:2x ⇒ nếu UTC là tương lai 7h (bất khả). DB session tz=UTC **KHÔNG** đồng nghĩa column lưu UTC. → Heatmap **BỎ `DATE_ADD(+7h)`**, dùng raw `DAYOFWEEK/HOUR(payment_on)`. **LESSON: timezone phải verify bằng UAT render thật, không suy từ session tz.**

### Fixes (commits 4755251, ba31d0c, aebab15)
- ✏️ `merchant-portal.service.ts` getTicketHeatmap — bỏ +7h (raw payment_on, VN-local). getRaces — thêm `r.images`→`coverUrl`.
- ✏️ `dto/race-list.dto.ts` — +coverUrl (ảnh bìa thật từ races.images).
- ✏️ merchant `components/mp/ui.tsx` Sidebar — bỏ height:100% (fix "ngắn tủn", flex-stretch full); bỏ nav 'Bán vé'/'Doanh thu' (là tab theo-giải, không global → dead-link). `app/dashboard/page.tsx` — dùng race.coverUrl fallback placeholder. `races/[raceId]` active='races'.

### Admin per-race access (commit dad9170)
- ➕ `GET admin/merchant-portal/tenants/search` (BTC CÓ tổ chức giải, join races, full+search, MST=cột `vat`) + `races/search` (per-race picker). +`dto/admin-search.dto.ts` + tests (137 PASS).
- ✏️ admin dialog: radio "Phạm vi quyền" Theo BTC (tenantIds) | Chọn giải cụ thể (raceOverrides.include). +`race-picker.tsx`. Tenant picker đổi nguồn (bỏ contracts finance-api). → minhnb9897=tenant cả giải; danny=chỉ giải A. resolveAccessibleRaces (tenant∪include−exclude) đã hỗ trợ sẵn từ F-069.

### QC (04-qc-report-FULL-PORTAL.md) ✅ APPROVED
- 137 merchant-portal test, 0 regression (14 full-suite fail đều PRE-EXISTING unrelated). 17 endpoint live DEV 401-gated. IDOR/SQL/no-money clean. Browser UAT 2 persona (BTC + admin) verified.

### Tech debt → known-issues
- Forecast linear projection; heatmap GMT+7 hardcoded (toàn giải VN OK); target no audit-log; exclude-mode UI defer; **7 suite test PRE-EXISTING hỏng** (upload `vi`, dashboard sparkline F-059, admin.service, race-result, reconciliation, chip concurrency) — task BUGFIX riêng.

## [2026-06-07] FEATURE-070: Merchant Portal Advanced MKT Analytics — ✅ DEPLOYED (DEV)

**Type:** EXTEND_EXISTING (merchant-portal module + merchant frontend). Branch `5bib_merchant_v1` → main.

### Files changed
- ➕ `backend/src/modules/merchant-portal/schemas/merchant-race-target.schema.ts` — Mongo collection `merchant_race_target` (unique raceId, target, updatedBy, timestamps). BTC-editable forecast target.
- ✏️ `backend/src/modules/merchant-portal/dto/ticket-charts.dto.ts` — +TicketForecastDto/Point, TicketHeatmapDto, SetTicketTargetDto, TicketTargetDto.
- ✏️ `backend/src/modules/merchant-portal/services/merchant-portal.service.ts` — +getTicketForecast (cumsum+projection rate7d×daysToRace, raceEnded null, target from Mongo), +getTicketHeatmap (DOW×HOUR +7h UTC→VN, grid 7×7), +setTicketTarget (assertRaceForUser→upsert→cache del), +readJsonCache/toYmd/mysqlDowToMonFirst/hourToBucketIndex helpers.
- ✏️ `backend/src/modules/merchant-portal/merchant-portal.controller.ts` — +GET forecast, +GET heatmap, +PUT target (LogtoMerchantGuard ticket-scope, @CurrentUser).
- ✏️ `backend/src/modules/merchant-portal/merchant-portal.module.ts` — register MerchantRaceTarget.
- ✏️ service.spec + adversarial.spec — +20 test (TC-01..10).
- ✏️ `merchant/src/components/mp/charts.tsx` — +PaceChart, Heatmap, Funnel (hand-rolled SVG, port mockup mp-analytics.jsx).
- ✏️ `merchant/src/app/races/[raceId]/page.tsx` — wire 3 chart vào tab Vé + ô nhập target + Lưu.
- ✏️ `merchant/src/lib/mp/i18n.ts` — +label VI/EN.
- 🔄 SDK regen (admin + merchant): +3 fn GetTicketForecast/GetTicketHeatmap/SetTicketTarget.

### Architecture / DB / Cache
- MongoDB: NEW collection `merchant_race_target`. MySQL: READ-ONLY aggregate order_metadata (race_id, payment_on). Redis: `merchant-portal:forecast:<raceId>` + `:heatmap:<raceId>` TTL 300s; PUT target DEL forecast key.
- **WRITE đầu tiên** cho merchant user (portal vốn read-only) — bảo vệ bằng assertRaceForUser trước upsert.

### Manager Code Review
- Đọc thật `getTicketForecast` (BR-70-05/06 encode đúng: rate cần ≥8 điểm, projectedValue null khi raceEnded||<8, target null khi 0/absent, assertRaceForUser first, cache read-through), `setTicketTarget` (IDOR before upsert). Grep verify: assertRaceForUser 3/3 method, SQL 0 `${}` interpolation, 0 money field leak, INTERVAL 7 HOUR present. 0 red flag.

### Lessons learned
- **races PK = `race_id` (bigint), KHÔNG phải `id`** — PRD assume sai, Coder catch (silent-break risk). PRD/codebase-map lần sau note rõ.
- Funnel derivable frontend từ summary → tiết kiệm 1 endpoint.
- Timezone: order_metadata.payment_on lưu UTC (DB tz=SYSTEM=UTC) → analytics theo giờ VN phải +7h.

### Tech debt (→ known-issues)
- Forecast linear projection (no seasonal curve-fit). Heatmap GMT+7 hardcoded (no per-tenant TZ). Target no audit log.

## [2026-06-07] FEATURE-069: Merchant Reporting Portal — ✅ COMPLETE + RECOVERED (branch, chưa push/merge/deploy)

**Branch:** `5bib_merchant_v1`. Recovery commits `ea64c97` (backend module + M1/M3b tracked edits) → `1ca38ba` (authentic backend source từ transcript + 5 specs + admin M3 UI + 45 docs) → `199713c` (merchant M4 standalone + SDK regen) → `488be7a` (guard specs + merchant configs/deploy) → `d15e0f6` (CI merchant job) → `2b632a6` (merchant pnpm-lock) → `bee0008` (trim test/e2e baggage → next build PASS).
**Type:** NEW_MODULE (backend merchant-portal + 2 Logto guards) + NEW_APP (merchant.5bib.com standalone) + EXTEND (logto.service, config, period-resolver, app.module, nav-groups, docker-compose, CI workflow).

### Files (backend)
- NEW `backend/src/modules/merchant-portal/` (19 file): `merchant-portal.controller.ts` (13 read endpoints, class `@UseGuards(LogtoMerchantGuard)`, revenue methods thêm `LogtoMerchantFinanceGuard`), `merchant-portal-admin.controller.ts` (7 admin CRUD endpoints `@UseGuards(LogtoAdminGuard)`), `merchant-portal.module.ts` (imports MongooseModule.forFeature + TypeOrmModule.forFeature([Tenant],'platform') + LogtoAuthModule + AuditModule + FinanceModule + NotificationModule), services `merchant-portal.service.ts` (data reads MySQL 'platform' + Redis cache + FeeService.computeFeeForOrdersAggregate + exceljs export) + `merchant-portal-access.service.ts` (CRUD + SETNX lock + M3b resolveOrProvisionUser email→createUser+assignRoles+invite), schema `merchant-portal-access.schema.ts`, 9 DTO, 4 spec (128 tests).
- NEW `backend/src/modules/logto-auth/logto-merchant.guard.ts` + `logto-merchant-finance.guard.ts` + 2 spec (24 tests).
- EXTEND `logto-auth/logto.service.ts` (lookupByEmail/lookupByIdWithCache cache 300s + createUser/resolveRoleIdsByNames/assignUserRoles M2M, management token resource = `env.logto.managementResource`), `logto-auth/{index.ts,logto-auth.module.ts}` (export guards + LogtoService), `config/index.ts` (LOGTO_MANAGEMENT_RESOURCE default `https://default.logto.app/api` + MERCHANT_PORTAL_LOGIN_URL), `analytics/services/period-resolver.ts` ('90d' additive), `modules/app.module.ts` (register MerchantPortalModule).

### Files (admin / merchant / infra)
- NEW admin `(dashboard)/merchant-portal/` (page.tsx gate+list+filter+pagination + 6 _components: access-form-dialog email-first, tenant-multi-picker, logto-lookup-field, access-list-table, permission-badge, empty-state) + `lib/merchant-portal-labels.ts` + spec. EXTEND `lib/nav-groups.ts` (merchant nav item, admin-only). SDK regen (17 merchant functions).
- NEW `merchant/` standalone Next.js app (port 3006): src/app/dashboard + races/[raceId] (ticket + revenue tabs, CSS bar charts) + login/callback/sign-in + api/[...proxy] (Logto session → backend bearer) + src/lib/{logto.ts merchant scopes, merchant-labels.ts} + Dockerfile + deploy/ (nginx dev+prod + DEPLOY.md). Clone admin scaffold (test/e2e baggage trimmed cho next build).
- EXTEND `docker-compose.yml` (5bib-result-merchant service) + `.github/workflows/build-and-deploy.yml` (paths-filter merchant + build-merchant job + deploy block).

### Business rules / patterns
- 2-tier guard: viewer (ticket reports) vs finance (revenue). M3b auto-provision = magic-link invite, KHÔNG plaintext password (admin chỉ cần EMAIL của BTC, system tự match/create + assign role). Independent fee calc qua FeeService cascade (MANUAL fixed VNĐ/vé, others %). VN labels qua `*-labels.ts` (KHÔNG raw enum). Tenant 31 no MerchantConfig → Tier 3 default 5.5% warning.

### Verification
- Backend 152 tests PASS (128 merchant-portal + 24 guard), tsc 0 lỗi F-069, `nest build` clean, swagger 17 endpoints. Admin merchant-portal tsc clean. Merchant 4 file F-069 tsc clean + `next build` PASS 14 routes.

### Data-loss + recovery note
- 2026-06-07 `git clean -fd` từ session khác xoá toàn bộ untracked F-069 (chưa từng commit lên git). Recover: backend từ `backend/dist` compiled + bản gốc transcript replay; tracked edits từ stash patch; admin/merchant/docs từ transcript; SDK regen từ running swagger. **CHƯA push/merge/deploy — chờ Danny duyệt.** M5 ops (DNS/Logto redirect/backend .env M2M/nginx+certbot/VPS compose) còn lại Danny — xem `merchant/deploy/DEPLOY.md`.

## [2026-06-01] FEATURE-068: Course Data Ops UX — ✅ DEPLOYED (branch awaiting main merge + PROD)

**Branch:** `feat/F-068-course-data-ops-ux` 8 commits (`b075f49` docs → `1de23f0` Phase 1 → `6eb1971` Phase 2-7 → `ed35b0b` Phase 8-11 → `8ba9405` 03 + IMPLEMENTATION_NOTES → `125f4d0` feature-log → `14b3346` QC report + Manager 05)
**Type:** EXTEND_EXISTING + pre-existing bug fix (signature refactor)

### Files changed

**Backend NEW (4):**
- ➕ `backend/src/modules/admin/services/course-data-ops.service.ts` (~370 LoC) — 4 admin ops (data-stats + clear-apiUrl + disable-and-reset + reset-data EXTEND)
- ➕ `backend/src/modules/admin/services/course-data-ops.service.spec.ts` (~400 LoC, 24 TC covering TC-68-01..16 + edges)
- ➕ `backend/src/modules/admin/dto/course-data-ops.dto.ts` (~170 LoC, 6 DTOs: stats response + 3 mutation request + 2 mutation response)
- ➕ `backend/src/modules/race-result/services/race-sync.cron.spec.ts` (~95 LoC, 9 TC for isCurrentlySync + getNextScheduledRunAt + UTC math edges)

**Backend MODIFY (6):**
- ✏️ `backend/src/modules/race-result/services/race-result.service.ts` — `purgeCache(raceId, courseId)` signature (L332-383, 11 patterns including NEW athlete/badge) + `deleteResultsByCourse(raceId, courseId)` signature (L1829-1833) + 5 internal call sites updated (L441/L482/L1901/L1977/L2110)
- ✏️ `backend/src/modules/race-result/services/race-result.service.spec.ts` — 3 NEW F-068 tests (BR-68-11 patterns + TC-68-14 cross-race + TC-68-15 actual deletion)
- ✏️ `backend/src/modules/race-result/services/race-sync.cron.ts` — 2 NEW public methods (`isCurrentlySync` + `getNextScheduledRunAt`) + `RACE_SYNC_CRON_INTERVAL_MINUTES` constant export
- ✏️ `backend/src/modules/race-result/race-result.module.ts` — export `RaceSyncCron` (was internal-only)
- ✏️ `backend/src/modules/admin/admin.controller.ts` — 3 NEW endpoint (GET data-stats + PATCH clear-api-url + POST disable-and-reset) + 1 EXTEND (reset-data response DTO) + path change `cache/purge/:courseId` → `:raceId/:courseId` + import 6 DTOs + inject CourseDataOpsService
- ✏️ `backend/src/modules/admin/admin.service.ts` — `resetData(raceId, courseId)` + `purgeCache(raceId, courseId)` signature update
- ✏️ `backend/src/modules/admin/admin.service.spec.ts` — 5 mock signature update + TD-F029-05 PARTIAL fix (added TelegramService + MailService DI mocks)
- ✏️ `backend/src/modules/admin/admin.module.ts` — import AuditModule + MongooseModule.forFeature for RaceResult/SyncLog + register CourseDataOpsService

**Admin NEW (6):**
- ➕ `admin/src/lib/course-data-ops-api.ts` (~140 LoC) — fetch wrappers + 7 types + CourseDataOpsApiError class
- ➕ `admin/src/lib/course-data-ops-hooks.ts` (~90 LoC) — useCourseDataStats poll 5s + 3 mutation hooks
- ➕ `admin/src/components/course-data-ops/CourseDataStatsBadge.tsx` (~150 LoC) — 3-stack badge + 30s tick for relative time
- ➕ `admin/src/components/course-data-ops/ResetDataConfirmDialog.tsx` (~245 LoC) — cron-aware + race-live typed confirm + toast routing 2 error codes
- ➕ `admin/src/components/course-data-ops/ClearApiUrlConfirmDialog.tsx` (~165 LoC) — apiUrlMasked display + race-live gate
- ➕ `admin/src/components/course-data-ops/index.ts` — barrel export

**Admin MODIFY (2):**
- ✏️ `admin/src/app/(dashboard)/races/[id]/settings/sections/CourseSection/CourseTable.tsx` — NEW `raceId` prop + NEW `onClearApiUrl` + `pollProgressByCourse` props + NEW "Tình trạng" column with `useCourseDataStats` per row + NEW PlugZap button conditional render + dynamic Reset tooltip
- ✏️ `admin/src/app/(dashboard)/races/[id]/settings/sections/CourseSection/CourseSection.tsx` — replaced direct `adminControllerResetData` SDK call with dialog state machine + NEW startPostResetPoll (combo forever / non-combo 5×2s with AbortController) + render 2 dialogs

### Architecture impact

- NEW service `CourseDataOpsService` under `AdminModule` — composes RaceResultService + RacesService + RaceSyncCron + AuditLogService
- NEW Redis keys (CLAUDE.md registry update):
  - `admin:course-stats:<raceId>:<courseId>` TTL 5s (multi-admin poll cost bound)
  - `reset-lock:<raceId>:<courseId>` TTL 30s (SETNX serialize concurrent reset)
- Cron lifecycle expose: `RaceSyncCron.isCurrentlySync()` + `getNextScheduledRunAt()` — pattern reusable for future cron-aware UI features
- Architecture diagram updated: `AdminModule → CourseDataOpsService` node

### Conventions impact

3 NEW patterns minted (added to conventions.md):
1. **Redis SETNX lock pattern for concurrent mutation** — port from F-018/F-019 awards/medical. Key `<domain>-lock:<resourceId>` TTL 5-30s.
2. **Cron lifecycle expose for UI feedback** — public `isCurrentlySync()` + `getNextScheduledRunAt()` getters without exposing private `isSyncing` field.
3. **Admin polling endpoint with short TTL Redis cache wrap** — bound multi-admin polling cost via 5s cache, DEL on mutation.

### DB / Cache impact

- MongoDB: NO schema change (signature refactor only). `course.apiUrl?` already optional. Compound index `{raceId, courseId, bib}` UNIQUE on `race_results` already exists. `sync_logs` collection no schema change (uses existing `timestamps: { createdAt: 'created_at' }`).
- MySQL platform: NO change
- Redis: 2 NEW keys above. Pattern rename via `purgeCache` 11 patterns (race-namespaced). Backward-compat: 1 lần cache miss spike when deploy (acceptable per Danny chốt #9 — deploy non-race-day).

### Tech debt còn lại (moved to known-issues.md)

8 NEW TD logged — see `known-issues.md` "F-068 (2026-06-01)" section for full list.

### Lessons learned

- **Pre-existing bug catching in scope** worked well — Manager catch 2026-05-31 audit during ops debugging led to F-068 in-scope fixes (BR-68-10 + BR-68-11). Pattern: when Manager surfaces a bug while investigating new feature, IN-SCOPE the fix to feature so regression tests come bundled.
- **Hand-typed fetch wrappers acceptable** when SDK regen impractical (no local backend). Document Deviation #2 + deploy mandate to reconcile.
- **Plan-as-mandate Phase 1 order** (refactor signature TRƯỚC) avoided spec cascade break — confirmed when 5 call sites + spec mocks all updated together in single commit.
- **Audit actor TD chain** continues — TD-CONTRACTS-ACTOR-001 carry-forward F-066/F-067/F-068. F-069 must finally fix to break cycle (~30 min effort).
- **Redis SETNX lock port** from F-018/F-019 medical/awards — pattern proven, lower implementation risk.

---

## [2026-05-25] FEATURE-062: Sales Analytics Dashboard Multi-Tab Redesign — ✅ FULLY DEPLOYED

**Branch:** `5bib_analytics_v2` merged main + `release/v1.9.0` deployed PROD
**Type:** EXTEND_EXISTING (analytics module major expansion — 5 new services + 17 endpoints + admin multi-tab UI)
**Commits:** 8 F-062 commits (`fa77fbe`→`f41f53e`) + wave history MANAGER_WAVE*_REVIEW.md checkpoints

### Backend files changed (analytics module)

**NEW services:**
- `backend/src/modules/analytics/services/merchant-comparison.service.ts` — BR-SA-22 (scatter/health/comparison table)
- `backend/src/modules/analytics/services/race-performance.service.ts` — BR-SA-21 (type distribution/spotlight/list)
- `backend/src/modules/analytics/services/runner-analytics.service.ts` — BR-SA-20 a-f (heatmap/lead-time/cohort/demographics/geographic/kpi)
- `backend/src/modules/analytics/services/ga4.service.ts` — BR-SA-11 (GA4 Data API wrapper, requires service account JSON)
- `backend/src/modules/analytics/services/export.service.ts` — BR-SA-10 (CSV + XLSX export)
- `backend/src/modules/analytics/services/fee-aggregate.helpers.ts` — NEW shared MySQL pull helper (extracted Wave 2C-1 at 3rd consumer threshold)
- `backend/src/modules/analytics/services/bucket-helpers.ts` — ISO 8601 week bucketing helpers
- `backend/src/modules/analytics/services/period-resolver.ts` — EXTENDED: CompareKind +wow/mom, resolveBucketSize(), shiftMonthClamped(), buildMetricCacheKey scoped variants, resolveQueryScope/buildPeriodKey/applyDefaultPeriod helpers

**NEW DTOs (17):**
- `dto/weekly-revenue.dto.ts`, `dto/monthly-revenue.dto.ts`, `dto/comparison.dto.ts`
- `dto/merchant-scatter.dto.ts`, `dto/merchant-health-distribution.dto.ts`, `dto/merchant-comparison-table.dto.ts`
- `dto/race-type-distribution.dto.ts`, `dto/race-spotlight.dto.ts`, `dto/race-performance-list.dto.ts`
- `dto/runner-booking-heatmap.dto.ts`, `dto/runner-lead-time.dto.ts`, `dto/runner-repeat-cohort.dto.ts`
- `dto/runner-demographics.dto.ts`, `dto/runner-geographic.dto.ts`, `dto/runner-summary-kpi.dto.ts`
- `dto/ga4-overview.dto.ts`, `dto/export-analytics.dto.ts`

**MODIFIED:**
- `backend/src/modules/analytics/analytics.controller.ts` — EXTENDED: 19 endpoints registered, `@UseGuards(LogtoAdminGuard)` class-level, all with `@ApiResponse` 200/400/401/403
- `backend/src/modules/analytics/analytics.service.ts` — EXTENDED: thin wrapper methods + buildDateFilter() shared + getWeeklyRevenue/getMonthlyRevenue/getComparison Wave 2B-1 + 3 period helpers
- `backend/src/modules/analytics/analytics.module.ts` — EXTENDED: register 5 new services + shared helpers
- `backend/src/modules/analytics/dto/analytics-query.dto.ts` — EXTENDED: BUG-010 @Matches month/from/to + BUG-011 @Min(1) tenantId
- `backend/src/modules/analytics/dto/repeat-athlete-rate.dto.ts` — EXTENDED: CompareKind enum +wow/mom (Wave 2A fix)
- `backend/src/common/constants/order-classification.ts` — NEW constants for category classification
- `backend/src/modules/finance/services/fee.service.ts` + `.f061.spec.ts` — F-061 BR-61-08 paymentRef semantics
- `backend/src/modules/reconciliation/services/reconciliation-query.service.ts` + `.f061.spec.ts` — F-061 companion fix

**NEW test files (7):**
- `analytics/__tests__/bucket-helpers.spec.ts`
- `analytics/__tests__/period-resolver.f062.spec.ts`
- `analytics/__tests__/revenue-endpoints.f062.spec.ts`
- `analytics/__tests__/merchant-comparison.f062.spec.ts`
- `analytics/__tests__/race-performance.f062.spec.ts`
- `analytics/__tests__/runner-analytics.f062.spec.ts`
- `analytics/__tests__/ga4-export.f062.spec.ts`

### Admin files changed

**NEW layout/nav:**
- `admin/src/app/(dashboard)/analytics/layout.tsx` — NEW: 5-tab navigation layout
- `admin/src/app/(dashboard)/analytics/components/AnalyticsTabsNav.tsx` — 5-tab nav with active state
- `admin/src/app/(dashboard)/analytics/components/AnalyticsFilterBar.tsx` — URL-driven filter bar (granularity/period/compare/from/to persists across tab nav)

**NEW components (14 total under analytics/components/):**
- `CompareSelector.tsx`, `GranularityToggle.tsx`, `PeriodSelector.tsx` (Adj #3 split selector components)
- `PeriodCompareSelector.tsx` (@deprecated wrapper for backward compat)
- `ComparisonRow.tsx` — BR-SA-04 side-by-side comparison metric row
- `MerchantHealthDistribution.tsx` — BR-SA-22b health score distribution bars
- `RaceSpotlightCard.tsx` — BR-SA-21b top race card with metrics
- `RaceTypeDistributionChart.tsx` — BR-SA-21a donut chart race types
- `RunnerSummaryKpiStrip.tsx` — BR-SA-20f 4 KPI strip
- `Ga4OverviewSection.tsx` — BR-SA-11 GA4 metrics with graceful fallback
- `ExportButtonV2.tsx` — BR-SA-10 CSV + XLSX export button

**NEW pages:**
- `admin/src/app/(dashboard)/analytics/merchants/page.tsx` — Tab 2 merchant comparison
- `admin/src/app/(dashboard)/analytics/races/page.tsx` — Tab 3 race performance
- `admin/src/app/(dashboard)/analytics/runners/page.tsx` — Tab 4 runner behavior

**MODIFIED:**
- `admin/src/app/(dashboard)/analytics/page.tsx` — Tab 1 ARCH-001 fix (duplicate removed, Wave 2 sections at top, F-026 accordion below) + BUG-009 granularity switch
- `admin/src/app/globals.css` — `--5s-blue` CSS alias token (Adj #5)
- `admin/src/lib/analytics-labels.ts` — NEW: 15 label maps + ERROR_MESSAGE + labelOr helper (BR-SA-17 VN label dict)
- `admin/src/lib/analytics-hooks.ts` — NEW: 17 TanStack Query wrappers for analytics SDK
- `admin/src/lib/api-generated/index.ts`, `sdk.gen.ts`, `types.gen.ts` — SDK regen 17 NEW Wave 2 functions

### Patterns added (see conventions.md)
- Analytics filter bar URL state sync
- Shared MySQL pull helper extraction threshold (3rd consumer)
- ISO 8601 week bucketing via `bucket-helpers.ts`
- `buildDateFilter()` SQL safety pattern

### Tech debts post-ship
- TD-F062-BUG-005: label density for 90d daily view (BUG-005 deferred, axis cramped)
- TD-F062-BUG-008: legacy Manual % > 100% guard missing (pre-F-062 era, BUG-008)
- TD-F062-GA4-SERVICE-ACCOUNT 🔴 HIGH: Tab 5 placeholder until `GOOGLE_APPLICATION_CREDENTIALS` env set on VPS
- TD-F062-TOPRACE-INMEMORY: TopRaces in-memory sort (<200 races currently, acceptable)

---

## [2026-05-25] FEATURE-062 Wave 2C-1: Race Performance Service + Shared Helper Extract — PRD Compliance 18/18 PERFECT (PARTIAL DEPLOY)

**Branch:** `5bib_analytics_v2` 10 cumulative commits — Wave 2C-1 `add014f` + Manager checkpoint
**Type:** EXTEND_EXISTING (NEW service file per Manager Plan v2 line 67) + EXTRACTION milestone
**Wave scope:** Wave 2C-1 of Wave 2C (~1,008 LoC, 1 of 2+ slices)

### Files changed (Wave 2C-1)

- ➕ Added: `backend/src/modules/analytics/services/race-performance.service.ts` (380 LoC) — RacePerformanceService 3 public methods + `_buildRaceAggregates` shared internal
- ➕ Added: `backend/src/modules/analytics/services/fee-aggregate.helpers.ts` (88 LoC) — EXTRACT shared `pullOrdersForFeeAggregate` standalone function (3rd consumer threshold met)
- ➕ Added: `backend/src/modules/analytics/dto/race-type-distribution.dto.ts` (BR-SA-21a)
- ➕ Added: `backend/src/modules/analytics/dto/race-spotlight.dto.ts` (BR-SA-21b)
- ➕ Added: `backend/src/modules/analytics/dto/race-performance-list.dto.ts` (BR-SA-21c — paginated + filtered DTOs)
- ✏️ Modified: `backend/src/modules/analytics/analytics.service.ts` — private `pullOrdersForFeeAggregate` thin wrapper delegate (backward compat 18+ call sites)
- ✏️ Modified: `backend/src/modules/analytics/services/merchant-comparison.service.ts` — direct shared import, removed private duplicate + unused OrderForFeeAggregate import
- ✏️ Modified: `backend/src/modules/analytics/analytics.module.ts` — RacePerformanceService provider register
- ✏️ Modified: `backend/src/modules/analytics/analytics.controller.ts` — 3 NEW endpoints + DI inject
- ➕ Added: `backend/src/modules/analytics/__tests__/race-performance.f062.spec.ts` (320 LoC) — 33 invariant tests

### Architecture impact
- NEW NestJS service `RacePerformanceService` registered + 3 NEW endpoints
- EXTRACTION milestone: shared `fee-aggregate.helpers.ts` hosts FeeService pre-aggregate helper used by 3 services (analytics + merchant-comparison + race-performance)
- period-resolver.ts continues hosting cache key + period helpers
- 9 NEW endpoints accumulated trong Wave 2 (3 Wave 2B-1 + 3 Wave 2B-2 + 3 Wave 2C-1)

### Conventions impact
- EXTRACTION pattern continues: Wave 2B-2 documented "defer until 3rd consumer", Wave 2C-1 executed extraction. Pattern: 1st consumer = inline; 2nd consumer = DRY violation acceptable (defer); 3rd consumer = extract to shared.
- filtersHash pattern (SHA-256 truncated 12-char) for pagination cache keys với extra axis composition
- Race type normalization với defensive OTHER fallback
- Auto-generated VN insight text via toLocaleString('vi-VN')
- Wave 5 codify trong conventions.md "Helper Extraction Threshold" + "filtersHash Cache Key Pattern"

### DB / Cache impact
- MySQL: no schema change (existing races.race_type + order_metadata + tenant)
- MongoDB: no schema change
- Redis: 3 NEW key patterns
  - `analytics:metric:race-perf-type:platform:range:2026-01-01~2026-05-25`
  - `analytics:metric:race-perf-spotlight:tenant:42:month:2026-05`
  - `analytics:metric:race-perf-list:platform:range:...:<sha256hash12>` (extra axis)

### Test results
```
Test Suites: 15 passed, 15 total
Tests:       230 passed, 230 total (197 Wave 2B-2 + 33 NEW Wave 2C-1)
Time:        7.079 s
```

### Tech debt RESOLVED (moved to known-issues.md RESOLVED status)
- ✅ TD-F062-WAVE2B2-PULLORDERS-DUPLICATE 🟢 LOW → RESOLVED via Wave 2C-1 extraction (3rd consumer threshold). Net -62 LoC saving.

### Tech debt NEW (added to known-issues.md)
- TD-F062-WAVE2C1-IN-MEMORY-SORT-LIMIT 🟢 LOW (Wave 5 k6 if >10K races)
- TD-F062-WAVE2C1-DATE-PROXY-VS-RACE-EVENT-DATE 🟢 LOW (Wave 2C-2 if BA confirms)
- TD-F062-WAVE2C1-COLD-CACHE-3X 🟡 LOW-MED (same pattern Wave 2B-2 TD)

### Lessons learned (defense-in-depth pattern continues maturing)
1. **PRD Compliance Score evolution**: Wave 2B-1 v1 13/19 → v2 19/19 → Wave 2B-2 22/23 → **Wave 2C-1 18/18 PERFECT**. Defense-in-depth lessons internalized across waves. Anti-regression invariant tests work as designed.
2. **Extraction threshold pattern proved sustainable**: Wave 2B-2 documented "defer until 3rd consumer", Wave 2C-1 executed cleanly. Avoids premature abstraction + achieves DRY when confirmed need.
3. **Backward compat strategy via thin wrapper**: analytics.service.ts kept private wrapper (delegates to shared) instead of refactoring all 18+ internal call sites. Acceptable transition pattern for large diff avoidance — Wave 5 cleanup task if desired.
4. **filtersHash via SHA-256 truncated 12-char** = 2^48 unique combos. Acceptable security + length. Pattern reusable cho future paginated cache scenarios.
5. **In-memory sort acceptable cho small dataset** (~50-200 races/year). SQL-side dynamic sort needs whitelist validation. Trade-off OK at current scale.

### Coder Honest Reporting Pattern (continued from Wave 2A + 2B-1 v2 + 2B-2)
- Section 1 Deviation #15-#17 + Forced #10 + Tradeoffs 17-21 documented transparently
- Wave 2C-1 reached PRD Compliance 18/18 perfect score by APPLYING all 5 codified lessons

---

## [2026-05-25] FEATURE-062 Wave 2B-2: Merchant Comparison Service — Wave 2B-1 v2 lesson APPLIED (PARTIAL DEPLOY)

**Branch:** `5bib_analytics_v2` 8 cumulative commits — Wave 2B-2 `053d050` + Manager checkpoint (this commit)
**Type:** EXTEND_EXISTING (NEW service file per Manager Plan v2 line 68 — additive, legacy `/analytics/merchants` endpoint preserved)
**Wave scope:** Wave 2B-2 of Wave 2B (~1,504 LoC, 1 of 2+ slices)

### Files changed (Wave 2B-2)

- ➕ Added: `backend/src/modules/analytics/services/merchant-comparison.service.ts` (420 LoC) — NEW MerchantComparisonService với 3 public methods + `_buildMerchantAggregates` internal helper + `computeHealthScore` RFM + `classifyStatus` (4 status types per BR-SA-07) + Health Score 5-tier constants module-level
- ➕ Added: `backend/src/modules/analytics/dto/merchant-scatter.dto.ts` — MerchantScatterPointDto (BR-SA-22a)
- ➕ Added: `backend/src/modules/analytics/dto/merchant-health-distribution.dto.ts` — MerchantHealthDistributionTierDto (BR-SA-22b)
- ➕ Added: `backend/src/modules/analytics/dto/merchant-comparison-table.dto.ts` — MerchantComparisonItemDto + MerchantComparisonTotalsDto + MerchantComparisonResponseDto (BR-SA-22c)
- ✏️ Modified: `backend/src/modules/analytics/services/period-resolver.ts` (+42 LoC) — EXTRACT `resolveScopeFromTenant` + `periodKeyFromInputs` cho shared reuse (Wave 1 helper extension pattern continues)
- ✏️ Modified: `backend/src/modules/analytics/analytics.service.ts` (+6/-15 LoC) — REFACTOR `resolveQueryScope` + `buildPeriodKey` to thin delegate wrappers calling shared helpers
- ✏️ Modified: `backend/src/modules/analytics/analytics.module.ts` (+5 LoC) — register MerchantComparisonService provider
- ✏️ Modified: `backend/src/modules/analytics/analytics.controller.ts` (+60 LoC) — 3 NEW endpoints `@Get('merchants/{scatter,health-distribution,comparison}')` với full @ApiResponse 200/400/401/403 + constructor DI inject + legacy `/merchants` description tag updated noting NEW endpoints location
- ➕ Added: `backend/src/modules/analytics/__tests__/merchant-comparison.f062.spec.ts` (285 LoC) — 25 invariant tests (Module + DI + SQL + FeeService + cache + default period + Health Score + controller wiring) + 3 pure-unit tests for extracted shared helpers

### Architecture impact
- NEW NestJS service `MerchantComparisonService` registered in AnalyticsModule providers
- 3 NEW endpoints at `/analytics/merchants/scatter`, `/analytics/merchants/health-distribution`, `/analytics/merchants/comparison`
- Legacy `/analytics/merchants` endpoint preserved (backward compat F-026 era consumers)
- period-resolver.ts now hosts shared cache key + period helpers used by analytics.service.ts + merchant-comparison.service.ts (future Wave 2C services will reuse)
- FeeService Tier 0 cascade per tenant — same pattern as Wave 1+2B-1 services

### Conventions impact
- Helper extraction continues evolution: Wave 1 buildMetricCacheKey → Wave 2A shiftMonthClamped extend → Wave 2B-1 v2 buildMetricCacheKey tenant scope + extra axis → Wave 2B-2 resolveScopeFromTenant + periodKeyFromInputs extract
- Health Score RFM formula pattern: module-level `HEALTH_TIERS` + `HEALTH_WEIGHTS` constants (cho easy update if business revises thresholds)
- Status classification with NEW (tenant ≤30d + 0 orders) special case
- Wave 5 codify trong conventions.md "Cache Key Helper Composition Pattern" + "Health Score RFM Constants Pattern" + "MySQL Platform Audit Columns (created_on)"

### DB / Cache impact
- MongoDB: no schema change (uses existing MerchantConfig lean query)
- MySQL platform: no schema change (uses existing `tenant.created_on` + `tenant.name` + `order_metadata` + `races` indexed columns)
- Redis: 3 NEW key patterns
  - `analytics:metric:merchant-comp-scatter:tenant:42:month:2026-05` (TTL 900s current / 86400s historical)
  - `analytics:metric:merchant-comp-dist:platform:range:2026-01-01~2026-05-25`
  - `analytics:metric:merchant-comp-table:platform:default`

### Test results
```
Test Suites: 14 passed, 14 total
Tests:       197 passed, 197 total (169 Wave 2B-1 v2 baseline + 28 NEW Wave 2B-2)
Time:        7.279 s
```

### Tech debt NEW (added to known-issues.md)
- TD-F062-WAVE2B2-STATUS-GAP-CLARIFY 🟡 MED — PRD silent on 60 < lastOrderDays ≤ 90 status classification. Coder lenient interp = CHURNED. BA clarify next cycle (3 options A/B/C). Affects merchant status badge UX.
- TD-F062-WAVE2B2-PULLORDERS-DUPLICATE 🟢 LOW — pullOrdersForFeeAggregate duplicated. Defer extraction until 3rd consumer Wave 2C.
- TD-F062-WAVE2B2-COLD-CACHE-3X 🟡 LOW-MED — 3 concurrent endpoint cold-cache redundant aggregate. Wave 5 k6 benchmark; mitigation candidate internal Map cache.
- TD-F062-WAVE2B2-RFM-EXTERNAL-NOW 🟢 LOW — Date.now() inside helpers. Defer Wave 5 fuzz testing if needed.

### Lessons learned (Wave 2B-1 v2 LESSON APPLIED success)
1. **Defense-in-depth invariant tests proved effective** — Wave 2B-1 v2 added 8 NEW anti-regression invariants (cache helper usage, raw string anti-pattern guard, endpoint URL guard, default period). Wave 2B-2 Coder followed same patterns naturally — 0 PRD drifts caught by QC Phase 5. Lesson loop closed successfully.
2. **Helper extraction pattern is sustainable** — Wave 1 buildMetricCacheKey + Wave 2A shiftMonthClamped + Wave 2B-1 v2 extend + Wave 2B-2 extract = period-resolver.ts grew from 250 LoC → ~430 LoC across 4 waves without conflicting changes. Pattern: extract when 2nd consumer surfaces, post-3rd consumer extract is more authoritative.
3. **PRD ambiguity ≠ Coder bug** — TD-WAVE2B2-STATUS-GAP-CLARIFY surfaced by QC Phase 5 PRD line-by-line walk. Coder lenient interp acceptable; QC flagged for BA clarification track. Defense-in-depth catches PRD spec gaps not just Coder mistakes.
4. **Wave 1 helper REUSE mandate enforced** — Coder USED buildMetricCacheKey from start, applied applyDefaultPeriod pattern from Wave 2B-1 v2, used extracted helpers proactively. Anti-regression tests guard against backsliding.
5. **`r: any` SQL row convention** — Coder preserved existing convention (matches getDailyRevenue + getMerchantComparison legacy). Asserted by invariant test no `as unknown as`. Consistent với surrounding service file style.

### Coder Honest Reporting Pattern (continued from Wave 2A + 2B-1 v2)
- IMPLEMENTATION_NOTES Section 1 Deviation #12-#14 + Forced #8-#9 + Tradeoffs 11-16 = 11 design decisions documented transparently
- tenant.created_on column name (not _at) Forced discovery → Wave 5 memory codification action item
- Lesson APPLIED success documented for Wave 5 conventions.md codification

---

## [2026-05-25] FEATURE-062 Wave 2B-1 v2: Revenue Endpoints — 4 QC findings resolved (PARTIAL DEPLOY)

**Branch:** `5bib_analytics_v2` 7 cumulative commits — Wave 2B-1 trilogy `d5e31b5` (v1 ship) + `a36d3b6` (v2 fix) + `cdac268` (QC v2 APPROVED doc) pushed origin
**Type:** EXTEND_EXISTING + defense-in-depth fix cycle (Coder v1 ship → QC REJECT 4 findings → Coder v2 fix → QC APPROVED → Manager spot-check)
**Wave scope:** Wave 2B-1 of larger F-062 feature (5 waves total)

### Files changed (Wave 2B-1 trilogy)

**Wave 2B-1 v1 (commit `d5e31b5`):**
- ➕ Added: `backend/src/modules/analytics/dto/weekly-revenue.dto.ts` — `WeeklyRevenuePointDto` ISO 8601 week bucket (BR-SA-02 line 184 shape)
- ➕ Added: `backend/src/modules/analytics/dto/monthly-revenue.dto.ts` — `MonthlyRevenuePointDto` calendar month bucket (BR-SA-03 line 193)
- ➕ Added: `backend/src/modules/analytics/dto/comparison.dto.ts` — `ComparisonQueryDto` (extends AnalyticsQueryDto + `@IsIn(['wow','mom','yoy'])` compareWith) + `ComparisonMetricsDto` + `ComparisonDeltaDto` (nullable when base=0) + `ComparisonResponseDto` per BR-SA-04 lines 206-213
- ➕ Added: `backend/src/modules/analytics/services/bucket-helpers.ts` — ISO 8601 week algorithm (Thursday rule), month range helpers, MySQL YEARWEEK conversion, VN labels (137 LoC)
- ✏️ Modified: `backend/src/modules/analytics/analytics.service.ts` (+260 LoC) — 3 public methods `getWeeklyRevenue/getMonthlyRevenue/getComparison` + 3 private helpers `computeFeePerBucket/computePeriodSummary/formatComparisonLabel`
- ✏️ Modified: `backend/src/modules/analytics/analytics.controller.ts` (+56 LoC) — 3 endpoints với full Swagger spec (BUT v1 had endpoint URL drift `/revenue/comparison` fixed v2)
- ➕ Added: `backend/src/modules/analytics/__tests__/bucket-helpers.spec.ts` — 32 ISO 8601 boundary edge case tests (week 53, leap year, year boundary)
- ➕ Added: `backend/src/modules/analytics/__tests__/revenue-endpoints.f062.spec.ts` — 25 invariant tests (SQL pattern + BR-SA + FeeService delegation + controller wiring)

**Wave 2B-1 v2 fix (commit `a36d3b6`):**
- ✏️ Modified: `backend/src/modules/analytics/services/period-resolver.ts` (+28 LoC) — EXTEND `buildMetricCacheKey` Wave 1 helper với `{ tenantId }` scope variant + optional `extra` 4th arg inserted GIỮA scope và periodKey per BR-SA-04 line 216
- ✏️ Modified: `backend/src/modules/analytics/analytics.service.ts` (+52/-3 LoC) — 3 NEW private helpers (`resolveQueryScope` + `buildPeriodKey` + `applyDefaultPeriod`); 3 inline cache key strings replaced với `buildMetricCacheKey` composition; default 12 weeks/12 months pattern via spread (no mutation)
- ✏️ Modified: `backend/src/modules/analytics/analytics.controller.ts` (+1/-1 LoC) — `@Get('revenue/comparison')` → `@Get('comparison')` per BR-SA-04 line 200 + description tag baked-in anti-regression hint
- ✏️ Modified: `backend/src/modules/analytics/__tests__/revenue-endpoints.f062.spec.ts` (+60/-12 LoC) — update existing cache key assertions + add 5 NEW invariants (cache helper usage + default period + endpoint URL anti-pattern guard + extractMethodBody generalized for non-async)
- ✏️ Modified: `backend/src/modules/analytics/__tests__/period-resolver.f062.spec.ts` (+28 LoC) — NEW 3 tests cho tenant scope + extra axis + backward compat

**Wave 2B-1 v2 QC APPROVED docs (commit `cdac268`):**
- ✏️ Modified: `.5bib-workflow/features/FEATURE-062-sales-analytics-dashboard/04-qc-report.md` (+445 LoC) — Wave 2B-1 v2 re-verify section, PRD Compliance 19/19, all 4 findings closed

### Architecture impact
- 3 NEW endpoints add to existing `AnalyticsController` (mounted `/analytics/revenue/weekly`, `/analytics/revenue/monthly`, `/analytics/comparison`)
- `buildMetricCacheKey` Wave 1 helper signature extended (backward compat preserved — existing 3-arg + race scope calls unaffected)
- New cache key namespaces: `analytics:metric:weekly-revenue:*`, `analytics:metric:monthly-revenue:*`, `analytics:metric:comparison:*` — BR-SA-18 invalidation hook ready
- New bucket-helpers.ts as separate utility from period-resolver.ts (extracted for ISO 8601 math isolation)
- FeeService Tier 0 cascade per-bucket: ≈700 calls/year worst-case (12 weeks × 58 tenants), cache TTL bảo vệ throughput

### Conventions impact
- `buildMetricCacheKey` scope variants WIDENED: `'platform' | { raceId } | { tenantId }` (was only `'platform' | { raceId }`)
- Optional `extra` axis pattern for comparison-style endpoints inserted between scope và periodKey
- Default period helper pattern (`applyDefaultPeriod`) returns NEW query (spread, no mutation) — set BEFORE validateDateRange to ensure cap applies on default-fill
- `extractMethodBody` test util generalized to support non-async private methods (anticipate future helpers as utilities grow)
- Wave 5 codify trong conventions.md "Cache Key Pattern" section + "Self-Review Bước 2" PRD adherence pattern

### DB / Cache impact
- MongoDB: no change
- MySQL platform: no schema change (uses existing indexed `payment_on`)
- Redis: 3 NEW key patterns (cache keys conform PRD spec)
  - `analytics:metric:weekly-revenue:tenant:42:range:2026-01-01~2026-05-25` (TTL 900s current / 86400s historical via cachedQuery auto-detect)
  - `analytics:metric:monthly-revenue:platform:month:2026-05`
  - `analytics:metric:comparison:platform:mom:range:2026-04-25~2026-05-25`

### Test results
```
Test Suites: 13 passed, 13 total
Tests:       169 passed, 169 total (104 Wave 1+2A + 57 v1 Wave 2B-1 + 8 NEW v2 anti-regression)
Time:        7.151 s
```

### Tech debt RESOLVED này wave (moved to known-issues.md history)
- ✅ TD-F062-WAVE2B1-CACHE-KEY-DRIFT 🔴 BLOCKING → RESOLVED commit `a36d3b6` (cache keys conform PRD via buildMetricCacheKey helper composition)
- ✅ TD-F062-WAVE2B1-ENDPOINT-URL-DRIFT 🔴 BLOCKING → RESOLVED commit `a36d3b6` (`@Get('comparison')` per BR-SA-04 line 200)
- ✅ TD-F062-WAVE2B1-DEFAULT-PERIOD-MISSING 🟡 MED → RESOLVED commit `a36d3b6` (applyDefaultPeriod 84/365 days + DoS risk closed)
- ✅ TD-F062-WAVE2B1-BUILDMETRICCACHEKEY-EXTEND 🟡 MED → RESOLVED commit `a36d3b6` (helper extended với tenant scope + extra axis backward compat)

### Tech debt NEW (added to known-issues.md)
- TD-F062-WAVE2B1-FEE-PERF 🟢 LOW — per-bucket fee aggregation cold cache ~3-5s p95 estimated (Wave 5 k6 benchmark; mitigation: redis pipeline OR cron pre-aggregate)
- TD-F062-WAVE2B1-COMPARISON-LABEL-EDGE 🟢 LOW — YoY label same string for current/previous (UI side prop disambiguates)
- TD-F062-WAVE2B1-RACE-FILTER-DEFER 🟡 MED — raceId filter Wave 2B-2/2C nếu BA confirm scope
- TD-F062-WAVE2B1-LESSON-PRD-BULLET-GREP 🟢 INFORMATIONAL — lesson codified: Coder Bước 2 PRD adherence pattern check ALL bullet keywords (Endpoint / Response / Phí / Default / Cache) per BR-XX

### Lessons learned (cho Wave 2B-2 + future waves)
1. **Defense-in-depth value justified** — v1 had 161 tests PASS (Coder confident) BUT 4 PRD spec drifts; QC Phase 5 line-by-line PRD walk caught all 4; v2 + 8 NEW anti-regression invariants prevent re-introduction. Pattern continues Wave 1 (Manager caught MoM bug Coder+QC missed) reinforcing 4-gate workflow design.
2. **Self-Review Bước 2 must grep ALL BR bullet keywords**, không chỉ Response shape. PRD section typically has Endpoint + Response + Phí + Default + Cache bullets — all spec-compliance items.
3. **Wave 1 helpers must be USED FIRST** before writing inline equivalent. Coder had imported `buildMetricCacheKey` but forgot to USE for cache keys — would catch immediately if helper-first habit.
4. **Endpoint URL is one-line spec — quick to verify but easy to miss because feels obvious.** Should be grep-checked explicitly (`grep "Endpoint" PRD-section`).
5. **Helper extension pattern** (Wave 1 `buildMetricCacheKey` extended Wave 2B-1) is acceptable when backward-compat preserved + scope expansion makes sense semantically (revenue is tenant-scoped, not race-scoped).
6. **Anti-regression invariants added at fix time** (8 NEW tests in v2) prevent re-introduction across future refactors. Cheaper than full E2E + catches semantic drift.
7. **IMPLEMENTATION_NOTES Section 1 honest miss reporting** (Deviation #10 + #11) maintains psychological safety + codifies lessons for memory. Per Danny 2026-05-19 mandate.

### Coder Honest Discovery Pattern (continued from Wave 2A)
- IMPLEMENTATION_NOTES Section 1 Deviation #10 explicitly admits 4 PRD drifts initial miss + root-cause analysis ("pattern-matched Response shape only, didn't grep PRD bullet keywords"). Same level of transparency as Wave 2A Deviation #6 (QC TD scope refinement 6→1 endpoint).
- This reinforces 4-gate workflow defense-in-depth: each agent (Coder + QC + Manager) catches different layer of issues. Coder catches type/logic; QC catches PRD compliance + security; Manager catches business semantics + cross-feature consistency.

---

## [2026-05-22] FEATURE-062 Wave 2A: Foundation Fixes — 2 BLOCKING TDs resolved (PARTIAL DEPLOY)

**Branch:** `5bib_analytics_v2` off main `e7284b0` — commits `0d1669a` (code) + `275ce81` (QC docs) pushed origin
**Type:** BUGFIX (Manager BLOCKING TD resolutions) — Wave 2A of 5 (focused fix scope before Wave 2B backend services)
**Status:** ⚠️ PARTIAL DEPLOY — `05-manager-deploy.md` slot reserved for Wave 5 full close. This entry = Wave 2A mini-deploy via `MANAGER_WAVE2A_REVIEW.md` checkpoint.
**Linked:** `.5bib-workflow/features/FEATURE-062-sales-analytics-dashboard/{03-coder-implementation,IMPLEMENTATION_NOTES,04-qc-report,MANAGER_WAVE2A_REVIEW}.md` (all Wave 2A sections appended to existing Wave 1 files)

### Why this fix
Manager Wave 1 Independent Code Review (MANAGER_WAVE1_REVIEW.md) caught **TD-F062-MOM-BOUNDARY-ROLLOVER** 🟡 MED bug latent in Wave 1 period-resolver.ts mom branch. Coder + QC both missed (Coder claim "boundary handled correctly" only tested day=22 safe case). Manager Node REPL verify: `2026-05-31 setUTCMonth(-1)` → `2026-05-01` (BUG — rolls to current month) instead of `2026-04-30` (expected last day of April). Latent because Wave 1 has no consumer của 'mom' yet, but BLOCKING Wave 2 when wire CompareSelector → backend endpoints.

Per Manager BLOCKING directive + Danny approve "Fix MoM FIRST" 2026-05-22, Wave 2A scope = focused fix 2 TDs before Wave 2B backend services start.

### Files changed (3 files / 160 LoC delta)
- ✏️ Modified: `backend/src/modules/analytics/services/period-resolver.ts` (+55 LoC):
  - NEW exported `shiftMonthClamped(date, months)` helper (lines 99-123) clamps day to last-day-of-target-month via `Date.UTC(year, month+1, 0)` day-0 trick + Math.min(sourceDay, lastDayOfTargetMonth)
  - Refactored `resolveCompare('mom')` branch (lines 225-238) to use shiftMonthClamped instead of buggy `setUTCMonth(-1)`
  - Doc comments explain TD-F062-MOM-BOUNDARY-ROLLOVER fix rationale
- ➕ Extended: `backend/src/modules/analytics/__tests__/period-resolver.f062.spec.ts` (+104 LoC, +13 tests):
  - NEW Section 1B `shiftMonthClamped()` standalone tests (8 cases): day=22 safe / day=31 clamp May 31 → April 30 / Jan 31 cross-year no clamp / Mar 29 leap no clamp / Mar 29 non-leap clamp to 28 / +1 month positive / time preservation HH/MM/SS/MS / 0 month no-op
  - NEW Section 2 mom boundary regression tests (5 cases): May 31 → April 30 Manager bug / Jan 31 → Dec 31 / Mar 29 → Feb 29 leap / Mar 29 → Feb 28 non-leap / Mar 31 → Feb 29 leap (clamp from 31 to 29)
- ✏️ Modified: `backend/src/modules/analytics/dto/repeat-athlete-rate.dto.ts` (+9 LoC):
  - `@IsIn` array extend từ 4 → 6 values: +`'wow'` +`'mom'` (parity với Wave 1 CompareKind type extension)
  - `@ApiProperty.enum` array updated + description extended với F-062 Wave 2A note

### Architecture impact (Wave 2A only)
- NEW exported helper `shiftMonthClamped` (joins existing `addDaysUtc`/`addYearsUtc`/`startOfDayUtc` family). Reusable cho future date arithmetic (WoY, QoQ).
- KHÔNG schema change, KHÔNG endpoint change, KHÔNG cache change

### Conventions impact (DEFER formal codification Wave 5)
- NEW pattern minted (will codify Wave 5): "Day-clamp month shift" helper pattern for avoiding `setUTCMonth` rollover

### DB / Cache impact
- ZERO — Wave 2A pure helper + DTO validation extension

### Tech debt status post-Wave 2A
- ✅ **TD-F062-MOM-BOUNDARY-ROLLOVER** RESOLVED commit `0d1669a` (defense-in-depth gate cleared)
- ✅ **TD-F062-VALIDATION-COMPAREKIND** RESOLVED commit `0d1669a` (DTO @IsIn already existed — Wave 2A discovery refined from QC's original "accept any string" claim)
- 🔄 **TD-F062-F026-SILENT-CAPABILITY-EXPANSION** REFINED scope "6 → 1 endpoint" (Coder Wave 2A grep verified only `repeat-athlete-rate.dto.ts` has compareWith field). Wave 5 decide market as feature.
- ⏭️ TD-F062-PRD-SECTION-3.4-DTO-IMPORT-OVERLAP — UNCHANGED (Wave 3 scope)

### Lessons learned
- **Manager Independent Code Review caught real bug** Coder + QC both missed. Defense-in-depth justified — reinforces Manager 2026-05-17 directive (F-040 Danny challenge "mày review code chưa?").
- **Visual scan ≠ semantic verify**: Coder claim "boundary handled correctly" was visual scan only (tested day=22 safe case). Boundary cases day=29/30/31 untested → bug latent. Always test exact-boundary cases cho date arithmetic.
- **TD scope refinement via Coder audit**: Coder Wave 2A grep `compareWith` field discovered QC's original "6 endpoints" claim was theoretical (type extension affects ANY consumer). Reality: only 1 endpoint has compareWith. Healthy honest engineering — refined understanding documented IMPLEMENTATION_NOTES Section 1 Deviation #6.
- **Wave 2A delivers exact Manager directive**: Fix MoM bug FIRST → 13 tests (8 standalone + 5 boundary) + 8 QC adversarial probes = 21 cases total cover comprehensively. Pattern works for partial wave deploy.
- **DTO @IsIn extend cleaner than full @IsEnum migration**: Existing F-026 5 DTOs use `@IsIn` convention. Wave 2A extend array thay vì refactor to TypeScript enum maintains consistency.

### Wave 2B roadmap (next Coder session)
- Backend 5 NEW services (runner-analytics + race-performance + merchant-comparison + ga4 + export)
- 16 NEW DTOs + 12 NEW endpoints
- `flushEventOverrideCache()` extend +13 patterns
- PAUSE `pnpm install @google-analytics/data` Danny confirm before install
- Verify MySQL `races.type` column existence PAUSE-SA-07
- Foundation Wave 1+2A complete — safe to wire CompareSelector → backend (MoM rollover bug fixed)

---

## [2026-05-22] FEATURE-062 Wave 1 Foundation: Sales Analytics Dashboard infrastructure (PARTIAL DEPLOY)

**Branch:** `5bib_analytics_v2` off main `e7284b0` — commit `53d2ec1` local only (push pending Danny approve)
**Type:** EXTEND_EXISTING — Wave 1 of 5 (Foundation slice only, full F-062 pending Wave 2-5)
**Status:** ⚠️ PARTIAL DEPLOY — `05-manager-deploy.md` slot reserved for Wave 5 full close. This entry = Wave 1 mini-deploy via `MANAGER_WAVE1_REVIEW.md` checkpoint.
**Linked:** `.5bib-workflow/features/FEATURE-062-sales-analytics-dashboard/{00-manager-init,01-ba-prd,02-manager-plan,03-coder-implementation,IMPLEMENTATION_NOTES,04-qc-report,MANAGER_WAVE1_REVIEW}.md`

### Why this feature
Danny request 2026-05-22 nâng cấp toàn diện Sales Analytics Dashboard cho 5bib.com management. PRD v3 (2278 dòng) với 28 BR-SA + Acceptance Criteria 26 items spanning 5 sub-tabs (Tổng quan / Hiệu suất Race / Merchant / Runner / Funnel) + 20 NEW endpoints + GA4 integration + Export CSV/Excel + Multi-tab architecture + Persistence URL params + 5Solution brand tokens lock. Full scope ~8,405 LoC — Wave 1 ships Foundation infrastructure (~600 LoC actual + 4064 LoC including PRD/Plan/QC docs).

### Files changed Wave 1 (13 files / 4064 LoC delta)
- ✏️ Modified: `backend/src/modules/analytics/services/period-resolver.ts` — Adj #1 GranularityKind split (NEW enum 3 values daily/weekly/monthly) + CompareKind extend với 'wow' | 'mom' (giữ prev/yoy/custom/none backward compat F-026) + resolveBucketSize() helper returning SQL GROUP BY expr + label format + bucket key format
- ➕ Added: `backend/src/modules/analytics/__tests__/period-resolver.f062.spec.ts` — 21 NEW tests (resolveBucketSize 4 + resolveCompare wow/mom 5 + PeriodKind regression 6 + helpers 4 + CompareKind completeness 5)
- ✏️ Modified: `admin/src/app/globals.css` — Adj #5 5Solution brand token alias block lines 115-125 (`--5s-blue: var(--5bib-info)` + `--5s-magenta: var(--5bib-magenta)` + variants — alias chain pattern, no hex duplicate)
- ➕ Added: `admin/src/lib/analytics-labels.ts` — BR-SA-17 Vietnamese dictionary (15 label maps: ORDER_TYPE, MERCHANT_STATUS, HEALTH_TIER, ALERT_TYPE/SEVERITY, RACE_TYPE, PERIOD/GRANULARITY/COMPARE, FUNNEL_STAGE, LEAD_TIME_BUCKET, DAY_OF_WEEK, GENDER, REPEAT_COHORT_TIER + HEALTH_TIER_COLOR map binding `var(--5s-blue)` + ERROR_MESSAGE constants + `labelOr()` type-safe lookup helper)
- ➕ Added: `admin/src/app/(dashboard)/analytics/components/GranularityToggle.tsx` — Adj #3 BR-SA-13 SegmentedControl Ngày/Tuần/Tháng
- ➕ Added: `admin/src/app/(dashboard)/analytics/components/PeriodSelector.tsx` — Adj #3 BR-SA-14b Select 6 PeriodKind values + custom date range picker inline
- ➕ Added: `admin/src/app/(dashboard)/analytics/components/CompareSelector.tsx` — Adj #3 BR-SA-14 Select 5 CompareKind values (skip 'custom' per PRD)
- ✏️ Modified: `admin/src/app/(dashboard)/analytics/components/PeriodCompareSelector.tsx` — BR-SA-14c @deprecated F-062 v3 header (KHÔNG xoá, backward compat in-flight `analytics/page.tsx` import)

### Architecture impact (Wave 1 only)
- NEW types `GranularityKind` + extended `CompareKind` in analytics module (KHÔNG break F-026 6 endpoint — backward compat verified 77/77 tests PASS)
- NEW helper `resolveBucketSize()` cho chart aggregation (3 GranularityKind → SQL expr + label format)
- 5Solution brand token alias layer added globals.css (delegate to existing `--5bib-info`/`--5bib-magenta`)

### Conventions impact (DEFER formal codification to Wave 5 — drift risk if incremental)
- NEW pattern minted (will codify Wave 5): "3-enum separation cho time-series query" (Period / Granularity / Compare distinct concerns)
- NEW pattern minted (will codify Wave 5): "Brand token alias chain via CSS custom properties" (`--5s-blue: var(--5bib-info)` single source of truth)
- NEW pattern minted (will codify Wave 5): "Backward compat selector deprecation" (mark `@deprecated` keep export, gradual migration via shared layout.tsx)
- NEW pattern minted (will codify Wave 5): "Partial wave deploy" — feature-log In-flight status `🟠 CODING (Wave N of M)`, change-history partial entry, defer codebase-map/conventions/architecture full update until final ship

### DB / Cache impact
- ZERO — Wave 1 pure infrastructure (helpers + UI components + types). No SQL query, no cache read/write, no Redis key changes.

### Tech debt added (4 NEW in known-issues.md)
- **TD-F062-MOM-BOUNDARY-ROLLOVER** 🟡 MED 🔴 BLOCKING Wave 2 (Manager spot-check finding — Coder + QC both missed): `setUTCMonth(-1)` rolls over khi day > target month days (verified bug: May 31 → May 1 instead of April 30). Latent Wave 1 (no consumer), MUST fix Wave 2 trước khi wire CompareSelector → backend endpoints accept `?compare=mom`. Fix: replace với `shiftMonthClamped(date, months)` pattern + add boundary test. ~30 min.
- TD-F062-VALIDATION-COMPAREKIND 🟢 LOW (QC finding): controller cast `as CompareKind` accept any string → fall through switch default. Wave 2 add `@IsEnum` decorator.
- TD-F062-F026-SILENT-CAPABILITY-EXPANSION 🟢 INFORMATIONAL (QC finding): Adj #1 CompareKind extend silently adds wow/mom capability cho 6 F-026 endpoint cũ. Cache key namespace separate (no collision). Wave 5 decide market as feature OR add explicit guard.
- TD-F062-PRD-SECTION-3.4-DTO-IMPORT-OVERLAP 🟢 LOW (Coder Forced Change #1): PRD claim 4 tab pages NEW nhưng codebase đã có 1530 LoC raw-fetch implementations từ F-026/F-058 era. Wave 3 REFACTOR (NOT NEW).

### Lessons learned
- **Coder honest documentation worked**: IMPLEMENTATION_NOTES.md Section 4 priority list (6 files) enabled Manager spot-check focused + efficient. Defense-in-depth justified: Coder + QC both missed MoM boundary rollover, Manager Independent Code Review + Node REPL verify caught (reinforces 2026-05-17 directive "mày review code chưa?" — F-040 Danny challenge precedent).
- **Visual scan ≠ semantic verify**: Coder claimed "boundary 28/29/30/31-day month xử lý đúng" but only tested day=22 (safe case). Manager grep `setUTCMonth` + Node REPL `2026-05-31 setUTCMonth(3)` → confirmed rollover bug. Anti-pattern "Đọc file nhưng skip business logic check" applied.
- **Partial wave deploy pattern minted**: When full feature ~8K LoC + ~5 sprint weeks → split into Wave 1-5 mini-deploys với:
  - feature-log In-flight status `🟠 CODING (Wave N of M)`
  - change-history partial entry per wave
  - known-issues TD updates per wave
  - codebase-map/conventions/architecture DEFER full ship (drift risk if incremental update)
  - `05-manager-deploy.md` slot reserved for final ship
  - Per-wave `MANAGER_WAVE_REVIEW.md` checkpoint files (not numbered 05+)
  - Counter NOT bumped until final ship (full feature still in-flight)

### Wave 2-5 roadmap
- Wave 2 (~1800 LoC): Backend 5 NEW services (runner-analytics, race-performance, merchant-comparison, ga4, export) + 16 NEW DTOs + 12 NEW endpoints + cache invalidation extend `flushEventOverrideCache()` +13 patterns. **FIRST commit Wave 2 = fix TD-F062-MOM-BOUNDARY-ROLLOVER** trước khi backend services. PAUSE `pnpm install @google-analytics/data` (Danny defer 2026-05-22).
- Wave 3 (~2500 LoC): Frontend `analytics/layout.tsx` NEW (multi-tab wrapper với 3 NEW selectors) + Tab 1/2/3 REFACTOR (TanStack Query migration + integrate selectors via layout) + 14 NEW components (KPI cards, charts, tables, panels) + SDK regen `pnpm --filter admin generate:api`.
- Wave 4 (~1400 LoC): Tab 4 Runner Behavior (heatmap 7×24, lead time histogram, repeat cohort, demographics, geographic) + Tab 5 Funnel detail + GA4 section + Accordion F-026.
- Wave 5 (~200 LoC + final ship): Polish + k6 performance benchmarks per Section 4.4 PRD + Manual UAT 5 tabs end-to-end persona walkthrough + BR coverage final audit. **Wave 5 = `/5bib-deploy` full F-062**: counter bump (F-062 → F-063+), move Shipped table, codebase-map/conventions/architecture formal update.

---

## [2026-05-18] FEATURE-037 V2: On-Sale Race Detail Page (Promo Hub SEO Internal)

**Branch:** worktree `condescending-dewdney-757430`, branch `feat/F-037-on-sale-race-detail-page` — NOT YET pushed
**Commits:** pending Danny approve push (local only)
**Type:** EXTEND_EXISTING (F-027/F-033/F-036 Promo Hub on-sale phase)
**Number collision note:** F-037 reused — V1 = DOCX colspan widths deployed 2026-05-15 release/v1.8.1, V2 = this feature. Same as F-036 collision precedent. Both kept in feature-log distinguished by "(V2 *)" label. Hardening note: /5bib-init should bump counter immediately on init.
**Linked:** `.5bib-workflow/features/FEATURE-037-on-sale-race-detail-page/{00,01,02,03,04,05}.md`

### Why this feature
TD-F036-09 HIGH "on-sale races link external direct → missing SEO juice" — F-033 ship được 17 on-sale races vào homepage carousel + race-calendar section nhưng card click external → `5bib.com/vi/events/<slug>_<raceId>` thay vì internal SEO detail page. SEO miss: external destination KHÔNG có Velocity design + race description rich content + breadcrumb + JSON-LD. F-037 V2 creates internal `/giai-chay/[urlName]` SEO detail page render rich content từ MySQL platform + CTA "Đăng ký ngay" to selling-web với UTM tracking. Pipeline: discovery (SEO) → conversion (selling-web).

### Files changed (13 Scope: 9 BE + 4 FE)

**Backend (9):**
- ➕ `backend/src/modules/promo-hub/entities/on-sale-course-readonly.entity.ts` — 16 cols mapping table `race_course` (id, raceId FK, prefix, name, distance, description, price, maxParticipate, min/max_age, open/closeForSaleDateTime, routeImageUrl, routeMapImageUrl, medalUrl, courseType, gain, deleted Buffer). Renamed from initial `race-course-readonly.entity.ts` / class `RaceCourseReadonly` to avoid TS identifier collision with existing race-master-data/RaceCourseReadonly 3-col entity. TypeORM supports multi-entity-per-table via different class names. `@Entity({ name: 'race_course' })` + `export class OnSaleCourseReadonly`.
- ✏️ `backend/src/modules/promo-hub/entities/race-readonly.entity.ts` — extended +8 cols (description, images, eventType, raceType, district, season, locationUrl, province) for detail rendering. Existing 12 cols from F-033 preserved.
- ➕ `backend/src/modules/promo-hub/dto/race-on-sale-detail.dto.ts` — `RaceCourseDto` (17 fields) + `RaceOnSaleDetailDto` (22 fields). All `@ApiProperty`/`@ApiPropertyOptional` decorators complete. `sellingWebUrl` pre-built per BR-37-09. `source: 'on-sale'` literal marker.
- ✏️ `backend/src/modules/promo-hub/promo-hub.service.ts` — added 4 static constants (SELLING_WEB_BASE_URL, SELLING_WEB_UTM_PARAMS, RACE_DETAIL_CACHE_PREFIX, RACE_DETAIL_CACHE_TTL=600s) + `findRaceOnSaleByUrlName(urlName)` method (~70 lines, OR `url_name=:urlName OR race_id=:raceId`, `^\d+$` numeric regex safe parse, parameterized TypeORM, bit field CAST pattern, Redis cache try/catch graceful) + `toRaceOnSaleDetailDto()` + `toRaceCourseDto()` helpers
- ✏️ `backend/src/modules/promo-hub/promo-hub.controller.ts` — added `@Get('races-on-sale/by-url-name/:urlName')` endpoint (public no auth, same F-033 pattern, NotFoundException 404 with VN message, route literal BEFORE catch-all `:id`)
- ✏️ `backend/src/modules/promo-hub/promo-hub.module.ts` — register `OnSaleCourseReadonly` in `forFeature([..., OnSaleCourseReadonly], 'platform')` (raceReadonlyRepo @Optional + raceCourseRepo @Optional injection pattern from F-033)
- ✏️ `backend/src/modules/app.module.ts` — register `OnSaleCourseReadonly` in `forRoot({entities: [..., OnSaleCourseReadonly]})` 'platform' DataSource — F-033 CRITICAL lesson (forFeature alone insufficient → "No metadata found" runtime)
- ✏️ `backend/src/modules/promo-hub/promo-hub.service.spec.ts` — appended 10 TC-37-XX tests. All PASS.
- ✏️ `backend/src/modules/promo-hub/promo-hub.controller.spec.ts` — added integration tests for new endpoint

**Frontend (4):**
- ✏️ `frontend/lib/seo-api.ts` — REWRITE `getRaceBySlug()` dual-source resolution: Step 1 MongoDB-first → if hit + status !== 'draft' → return with `source: 'mongodb'`; Step 2 MySQL fallback `getRaceOnSaleByUrlName()` → return with `source: 'on-sale'`; Step 3 null cascade → Next.js notFound() prevents flicker during race transition BÁN VÉ→VẬN HÀNH. Added `ApiOnSaleCourseDto` + `ApiOnSaleDetailDto` types + `mapOnSaleDetailToRace()` helper.
- ✏️ `frontend/components/giai-chay/RaceCard.tsx` — REVERT: removed `buildSellingWebUrl` import + removed on-sale external `<a href>` branch + all sources now link internal `<Link href="/giai-chay/${slug}">`. F-036 listing regression risk verified intact via live localhost preview: 73 cards listing, 17 on-sale internal links, 0 forms.
- ✏️ `frontend/components/giai-chay/RaceCTA.tsx` — added BR-37-11 `regClosed` conditional render: disabled visual `bg-stone-300 cursor-not-allowed` "Đã hết hạn đăng ký" when registrationEndTime < Date.now(). Still external `<a>` to selling-web (some races allow late buy).
- ✏️ `frontend/app/sitemap-races.xml/route.ts` — REMOVED `if (race.source === 'on-sale') continue;` skip filter. Added `isOnSale` flag + priority 0.9 for active types (matches MongoDB pre_race/live per BR-37-12). Results URL `/ket-qua` still skip for on-sale (no /ket-qua page).

### Key design decisions

1. **OnSaleCourseReadonly naming variant** — Plan originally specced `RaceCourseReadonly` class. During Coder phase, TS compiler caught duplicate identifier with existing `race-master-data/RaceCourseReadonly` (3-col kiosk entity). Renamed F-037 class to `OnSaleCourseReadonly` (same table `race_course`, different TypeScript identifier). Documented in file header. Manager verified TypeORM multi-entity-per-table convention. NOT scope creep, documented variant.
2. **Dual-source MongoDB precedence** — When race transitions BÁN VÉ → VẬN HÀNH, 5BIB ops admin creates MongoDB `races` doc. `getRaceBySlug()` next ISR tick (~1h) automatically picks MongoDB version. Prevents flicker (BR-37-07). Source marker `'mongodb' | 'on-sale'` enables future UI conditional rendering.
3. **TTL-only invalidation** — Cache key `promo-hub:race-on-sale-detail:<urlName>` TTL 600s + ISR 3600s. NO mutation site (read-only MySQL platform external-controlled). Max 1h staleness acceptable per race lifecycle. F-036 admin/seo trigger does NOT invalidate F-037 cache (different namespace) — tracked TD-F037-02 LOW.
4. **Selling-web URL with UTM tracking (BR-12)** — Format: `5bib.com/vi/events/{slug}_{raceId}?ref=seo-giai-chay&utm_source=5bib&utm_medium=organic&utm_campaign=race-detail`. Built server-side with `encodeURIComponent` defense. Anti-pattern enforcement: ZERO `<form>` mua vé, ZERO `<button onClick>` purchase.
5. **Bit field CAST pattern** — MySQL `bit(1)` fields (`is_delete`, `is_show`, `race_course.deleted`) typed as `Buffer` in TypeORM but filter via `CAST(col AS UNSIGNED) = 0/1` in QueryBuilder. Reuse F-033 pattern.

### Tests
- 10 new TC-37-XX backend unit tests PASS (Coder-written, QC re-verified)
- 25 F-027/F-033 regression PASS
- Total: 35/35 PASS
- TypeScript `pnpm tsc --noEmit` exit 0 both backend + frontend
- F-036 listing regression verified intact via live localhost preview

### QC verdict
✅ APPROVED WITH CAVEATS — 6 phases pass, 0 CRITICAL/HIGH security threats (10 vectors reviewed), 2 MEDIUM deferred (T2 XSS sanitization frontend-side, T9 perf SLA measure post-deploy).

### Manager Code Review (skill MANDATE 2026-05-17)
5 critical files spot-checked: promo-hub.service.ts (lines 730-810), promo-hub.controller.ts (lines 94-128), on-sale-course-readonly.entity.ts, seo-api.ts (lines 318-355), RaceCard.tsx (lines 105-128). 3 minor concerns tracked, 0 red flags. Independent grep verify SQL injection clean (0 `${...}` matches in QueryBuilder strings).

### TD remaining (11 items)
- 6 Coder flags: TD-F037-01..06 (1 MED live verify deferred + 5 LOW)
- 5 QC additions: TD-F037-QC-01..05 (1 MED frontend XSS verify + 4 LOW)
- **TD-F036-09 ✅ RESOLVED** by this feature

### Patterns minted
1. **Dual-source race resolution** — MongoDB precedence over MySQL fallback for race transition handling. Reusable for any future feature with overlapping data sources.
2. **Multi-entity-per-table TypeORM** — when 2 modules need different col subsets from same table, name TypeScript classes differently (RaceCourseReadonly vs OnSaleCourseReadonly), same `@Entity({ name: 'race_course' })`. TypeORM supports multi-entity-per-table.

### Post-deploy chain
NOT YET pushed to remote. Danny next: push `feat/F-037-on-sale-race-detail-page` → PR main → CI auto-deploy DEV → cherry-pick `release/v1.8.8` → CI auto-deploy PROD → 6-item curl checklist (endpoint live + page render + CTA href + sitemap + XSS defensive + p95 measure).

---

## [2026-05-16] FEATURE-038: Finance Contracts List with P&L Per Row

**Branch:** worktree `funny-kirch-90e777` off `release/v1.8.1` — NOT YET pushed
**Commits:** Pending Danny approve push (local only — anti-cowboy workflow per memory 2026-05-14 rule)
**Type:** BUGFIX + EXTEND_EXISTING (F-028 Phase 2 follow-up)
**Linked:** `.5bib-workflow/features/FEATURE-038-finance-contracts-list-pnl/{00,01,02,03,04,05}.md`

### Why this feature
Danny audit 2026-05-15 phát hiện `/finance/contracts` admin nav entry "P&L theo HĐ" trỏ tới **placeholder page** từ F-028 Phase 1 era (2026-05-12) — chỉ hiển thị hướng dẫn text "vào contract detail rồi click section Lãi/Lỗ", KHÔNG có data thật. Inconsistency: `/finance` đã có aggregated dashboard nhưng KHÔNG show full list HĐ với P&L per row. F-038 thay placeholder bằng list table với KPI inline để admin scan toàn bộ deals + drill-down detail.

### Files changed (15 Scope + 1 regression)

**Backend (8):**
- ➕ `backend/src/modules/finance/dto/pnl-contracts-list-filter.dto.ts` — `PnLContractsListFilterDto extends PnLDashboardFilterDto` + 5 list fields (page/limit/sortBy/sortDir/q) với class-validator + @ApiPropertyOptional + VN error messages
- ➕ `backend/src/modules/finance/dto/pnl-contracts-list-response.dto.ts` — `PnLContractsListResponseDto` reusing `DashboardContractItemDto[]` + `DashboardTotalsDto`
- ➕ `backend/src/modules/finance/controllers/pnl-contracts-list.controller.ts` — `@Controller('finance/pnl')` + `@UseGuards(LogtoAdminGuard)` + `@Get('/contracts')` + Swagger 200/400/401/403
- ✏️ `backend/src/modules/finance/services/pnl.service.ts` — added 5 private methods: `hashContractsListFilter()`, `computeContractRows()`, `filterBySearch()`, `sortItems()`, `getContractsList()`. `getDashboardData()` + `getSummary()` body UNCHANGED (regression safety).
- ✏️ `backend/src/modules/finance/services/pnl.service.spec.ts` — appended `describe('FEATURE-038 getContractsList')` with 14 tests TC-CL-01..14
- ✏️ `backend/src/modules/finance/finance.module.ts` — register `PnLContractsListController` (+ import)
- ✏️ `backend/src/modules/finance/services/cost-items.service.ts` — `flushDashboardCache()` extended to iterate BOTH `pnl:dashboard:*` + `pnl:contracts-list:*` patterns
- ✏️ `backend/src/modules/contracts/services/contracts.service.ts` — `flushPnlDashboardCache()` extended to iterate BOTH patterns

**Admin (7):**
- ➕ `admin/src/app/(dashboard)/finance/contracts/_components/contracts-list-client.tsx` — `'use client'` main wrapper, filter state machine, fetch on filter change, URL sync via useSearchParams + router.replace, search debounce 400ms
- ➕ `admin/src/app/(dashboard)/finance/contracts/_components/contracts-list-table.tsx` — 9-col table with sortable headers (Số HĐ/Doanh thu/Lãi/Lỗ/Margin), row click → detail, margin tier icons 🟢🟡🔴⚪
- ➕ `admin/src/app/(dashboard)/finance/contracts/_components/contracts-list-footer-summary.tsx` — aggregate totals row + pagination (Prev/page#/Next + page-size selector)
- ➕ `admin/src/app/(dashboard)/finance/contracts/_components/margin-legend-banner.tsx` — header legend banner
- ➕ `admin/src/app/(dashboard)/finance/contracts/_components/contracts-list-empty-state.tsx` — 3 variants empty/filtered-empty/error với CTAs
- ✏️ `admin/src/lib/finance-api.ts` — added types `ContractsListSortBy`, `SortDir`, `ContractsListPageSize`, `PnLContractsListFilter`, `PnLContractsListResponse`, `CONTRACTS_LIST_PAGE_SIZES`, helper `getContractsList()`
- ✏️ `admin/src/app/(dashboard)/finance/contracts/page.tsx` — REWRITE from F-028 Phase 1 placeholder (67 lines) → `isAdmin` gate + `<ContractsListClient />` mount with Suspense

**Regression test update (necessary consequence of BR-38-09 dual-pattern flush):**
- ✏️ `backend/src/modules/finance/services/cost-items.concurrency.spec.ts` UP-08 — assertion `scanStreamCalls 2 → 4` (2 mutations × 2 patterns). Annotated với F-038 BR-38-09 comment. NOT scope creep — direct & necessary consequence of in-scope cache flush change.

### Architecture impact
- **NEW endpoint** `GET /api/finance/pnl/contracts` (additive — KHÔNG break `/api/finance/dashboard`)
- **NEW Redis cache pattern** `pnl:contracts-list:<sha256-16char>` TTL 60s
- **EXISTING cache invalidation flow** extended: 2 flush helpers (`cost-items.service.ts#flushDashboardCache` + `contracts.service.ts#flushPnlDashboardCache`) now iterate BOTH `pnl:dashboard:*` + `pnl:contracts-list:*` patterns in series
- Architecture diagram update: Finance domain data flow adds parallel `pnl:contracts-list:*` cache node under PnLService

### Conventions impact

**3 NEW patterns minted (added to `conventions.md`):**

1. **Dual-pattern cache flush helper** — single helper iterates `['pattern-A:*', 'pattern-B:*']` array of patterns trong series để invalidate atomic both. Avoid forgetting any site when adding new related cache pattern.

   ```typescript
   private async flushDashboardCache(): Promise<void> {
     if (!this.redis) return;
     for (const pattern of ['pnl:dashboard:*', 'pnl:contracts-list:*']) {
       try {
         const stream = this.redis.scanStream({ match: pattern, count: 200 });
         // ...DEL pipeline...
       } catch (e) { this.logger.warn(`flush ${pattern} fail`); }
     }
   }
   ```

2. **URL deep-link 2-level debounce** — local input state immediate (UX) + applied state debounced (URL push + fetch trigger). Pattern via `useRef<setTimeout>` 400ms timer cleared on next keystroke.

   ```typescript
   const [searchInput, setSearchInput] = useState(initial); // immediate UX
   const [appliedQ, setAppliedQ] = useState(initial); // debounced
   useEffect(() => {
     const t = setTimeout(() => { setAppliedQ(searchInput.trim()); setPage(1); }, 400);
     return () => clearTimeout(t);
   }, [searchInput]);
   ```

3. **Defense-in-depth admin gate** — Backend `@UseGuards(LogtoAdminGuard)` + Admin page-level `useAuth().isAdmin` check renders `<RestrictedAccess />` BEFORE mounting client → non-admin doesn't fire fetch (no wasted backend call, no UX confusion via 403 toast).

### DB / Cache impact
- MongoDB: KHÔNG schema change. Reuse `Contract` model existing.
- MySQL platform: KHÔNG schema change. TICKET_SALES revenue compute reuses F-029 bulk method `feeService.getActualRevenueForRaces()`.
- Redis: NEW key pattern `pnl:contracts-list:<sha256-16char>` TTL 60s. Invalidate on mutation `contract.*` + `cost-items.*` (BR-38-09 dual-pattern flush).

### Tech debt còn lại (8 — moved to `known-issues.md`)

- TD-F038-SDK-REGEN (LOW): Admin uses hand-typed wrapper instead of generated SDK — consistent F-028/F-031/F-032 precedent
- TD-F038-REFACTOR-EXTRACT (LOW): ~80 LoC duplicate `computeContractRows()` ↔ `getDashboardData()` body — deliberate copy zero regression
- TD-F038-MONGO-SORT (LOW): In-memory sort+paginate acceptable <1K contracts; future scale needs Mongo aggregation pipeline
- TD-F038-EXPORT-LIST (DEFERRED Phase 2): CSV/Excel export defer per PAUSE-38-06
- TD-F038-FILTERED-COST-CATEGORY (LOW): `filteredTotals.costByCategory` dataset-wide (unused on list page currently)
- TD-F038-PAGE-CLAMP (LOW): `?page=99` not clamped to `totalPages` — minor UX
- TD-F038-AUTH-INTEGRATION-TEST (LOW): HTTP-level 401/403 not unit-tested (substituted service-level Redis tests) — verify in walkthrough
- TD-F038-PERF-SLA-MEASURE (MED): p95 < 500ms cold / < 100ms warm NOT empirically measured (mocks only) — must verify in walkthrough phase

### Lessons learned
- **Naming mismatch in PRD vs codebase** — BA wrote `pnl-dashboard.service.ts` / `DashboardFilterDto` / period `all_time` but real code uses `pnl.service.ts` / `PnLDashboardFilterDto` / no `all_time`. Manager Plan caught + flagged for Coder in 02. Lesson: BA should spot-check file names at least once before writing PRD; OR Manager Plan must always verify before APPROVE.
- **Cache flush dual-pattern test assertion fragility** — adding new cache pattern caused existing `cost-items.concurrency.spec UP-08` to break (`scanStreamCalls 2 → 4` because flush now iterates 2 patterns). Acceptable + necessary — but test was tightly coupled to implementation detail (call count) rather than semantic outcome. Future tests should assert "keys matching pattern X were deleted" instead of "scanStream called N times".
- **Compute path duplication trade-off** — extracting `getDashboardData()` body into shared `computeContractRows()` would reduce duplication BUT risk breaking 32 existing regression tests. Chose deliberate copy. Lesson: regression safety > DRY when scope is single-feature; refactor later when stable.
- **Empirical perf SLA cannot be measured at unit level** — mocks fast by definition. Walkthrough phase deferred for live measurement. Defer documented.

---

## [2026-05-13] FEATURE-027: Promo Hub Configurable Landing Page (19 section types)

**Branch:** `5bib_promo_hub_v1` off main `a638b28` (post-F-029 fix) — **5 commits LOCAL, pending Danny approve push+merge main**
**Commits:** `0d8d1fa` A1 backend → `3baef65` A2 admin → `be3f469` A3 frontend SSR → `ac13c51` A4+A5 analytics+SEO+revalidate → `84564d6` Phase B 10 sections
**Type:** NEW_MODULE
**Linked:** `.5bib-workflow/features/FEATURE-027-promo-hub/{00,01,02,03,04,05,OPS-NOTES}.md`

### Files changed (~66 files)

**Backend (20 NEW + 2 MODIFY):**
- ➕ `backend/src/modules/promo-hub/` (11 files): module + controller + service + 1 schema + 5 DTOs + 2 spec files (controller.spec 5 TC + service.spec 17 TC)
- ➕ `backend/src/modules/promo-hub-analytics/` (9 files): module + controller + service + 2 schemas + 3 DTOs + 1 spec (6 TC)
- ✏️ `backend/src/modules/app.module.ts` — register `PromoHubModule` + `PromoHubAnalyticsModule`
- ✏️ `backend/src/modules/promo-hub/schemas/promo-hub.schema.ts` (Phase B) — SectionType union 9→19, SECTION_TYPES const append 10. DTO/Swagger inherits via SECTION_TYPES import → zero controller/service code changes for Phase B enum extension.

**Admin (10 NEW + 3 MODIFY + SDK regen):**
- ➕ `admin/src/app/(dashboard)/promo-hub/` (3 pages): `page.tsx` list (RBAC Tier 2 `isAdmin` gate F-029 pattern), `new/page.tsx` defensive redirect to list (canonical create flow = list-page "Tạo mới" button), `[id]/page.tsx` edit w/ 4 tabs (Nội dung / Thiết kế / SEO / Analytics)
- ➕ `admin/src/components/promo-hub/` (7 files): `section-types.ts` (SECTION_TYPE_META 19 entries: icon + label + description + defaultConfig), `PromoHubEditor.tsx` (DnD orchestrator via @dnd-kit/sortable, 19-card add panel), `SectionCard.tsx` (sortable card w/ inline `translate3d()` — avoid `@dnd-kit/utilities` dep), `SectionConfigDialog.tsx` (596 LOC, switch over 19 type cases for form rendering), `PromoHubPreview.tsx` (lightweight mock card preview), `ThemeConfigurator.tsx` (exports Theme + Seo configurators), `PromoHubAnalytics.tsx` (Phase A4 dedicated component reusing `admin/src/components/charts/AreaChart.tsx` SVG-based — no Recharts dep)
- ➕ `admin/src/app/api/revalidate-hub/route.ts` (52 LOC) — server-side proxy attaches REVALIDATE_TOKEN, POSTs to FRONTEND_REVALIDATE_URL. Fail-closed graceful skip if env unset.
- ✏️ `admin/src/lib/nav-groups.ts` — import `Sparkles` icon + add `{ id: "promo-hub", href: "/promo-hub", label: "Trang quảng bá", icon: Sparkles, badge: "NEW", requireRole: "admin" }` in "Nội dung" group
- ✏️ `admin/package.json` + `pnpm-lock.yaml` — install 5 deps: `@dnd-kit/core`, `@dnd-kit/sortable`, `@tiptap/react`, `@tiptap/starter-kit`, `sanitize-html` (PAUSE-CODER-01 Danny approved "A")
- 🔄 `admin/src/lib/api-generated/*.gen.ts` — auto-regen 19 SectionType enum values + 10 promoHub*ControllerXxx SDK functions

**Frontend (13 NEW + 2 MODIFY + SDK regen):**
- ➕ `frontend/app/(main)/hub/[slug]/page.tsx` (151 LOC) — Server Component, `export const revalidate = 60` ISR, server-side `fetch(BACKEND_URL/api/promo-hubs/slug/<slug>, { next: { revalidate: 60, tags: [<slug>] } })`, `generateMetadata` (title/description/canonical/OG/Twitter from hub.seo), JSON-LD `<script type="application/ld+json">` inject if seo.structuredData present, theme as CSS custom properties (`--promo-primary`, `--promo-secondary`, `--promo-font`, `--promo-max-width`) + customCss inline `<style>`
- ➕ `frontend/app/(main)/hub/[slug]/not-found.tsx` (32 LOC) — Vietnamese 404 fallback (also for draft/archived to prevent existence leak)
- ➕ `frontend/components/hub/PromoHubRenderer.tsx` (54 LOC) — Server Component dispatcher switch over 19 section.type cases, forward-compat (unknown type → null silent skip)
- ➕ `frontend/components/hub/PromoHubTracker.tsx` (85 LOC, Client Component) — useEffect fires view event on mount + attaches document-level capture-phase click listener for `[data-promo-cta]` data-attr delegation. Uses `keepalive: true` fetch so navigation doesn't cancel analytics POST.
- ➕ `frontend/components/hub/sections/` (19 section components):
  - **Phase A (9):** `HeroSection.tsx` (full-bleed bg w/ gradient fallback + CTA), `RaceCalendarSection.tsx` (async fetch `/api/races?status=`, 3-col grid), `FeaturedRacesSection.tsx` (async parallel fetch by raceIds, 2-col w/ overlay text), `PromoBannerSection.tsx` (conditional anchor wrap), `CtaButtonsSection.tsx` (primary/secondary/outline variants using theme CSS vars), `SponsorsSection.tsx` (async fetch `/api/sponsors`, level filter diamond/gold/silver, sorted by LEVEL_ORDER, grayscale → color hover), `StatsSection.tsx` (4-col number cards using theme primary), `RichTextSection.tsx` (`dangerouslySetInnerHTML` pre-sanitized + Tailwind prose), `RecentResultsSection.tsx` (async parallel fetch race + race-results, table top N + "Xem toàn bộ" link)
  - **Phase B (10):** `LinkGridSection.tsx` (62 LOC, clickable card grid w/ `data-promo-cta`), `SocialLinksSection.tsx` (162 LOC, inline SVG for 10 platforms: Facebook/Instagram/TikTok/YouTube/Twitter-X/LinkedIn/Telegram/Zalo/Email/custom w/ brand-color backgrounds), `FaqSection.tsx` (46 LOC, native `<details>/<summary>` accordion zero-JS), `CountdownSection.tsx` (78 LOC, `'use client'` second-by-second tick using setInterval, gradient bg, expired message fallback), `VideoEmbedSection.tsx` (68 LOC, YouTube via `youtube-nocookie.com` + Vimeo with regex `extractYouTubeId/extractVimeoId` accepting both raw ID and full URL), `ImageGallerySection.tsx` (47 LOC, square aspect grid, click → new tab, lazy loading), `TestimonialSection.tsx` (75 LOC, quote cards w/ author/role/avatar with initial fallback), `MapEmbedSection.tsx` (62 LOC, Google Maps iframe with HOST whitelist `google.com`/`maps.google.com`/`www.openstreetmap.org`, HTTPS-only, falls back to address text), `ScheduleTimelineSection.tsx` (49 LOC, vertical timeline w/ primary-color rail + dot markers), `FormEmbedSection.tsx` (84 LOC, iframe mode w/ `ALLOWED_FORM_HOSTS` whitelist `docs.google.com`/`forms.gle`/`tally.so`/`form.5bib.com`/`forms.office.com` OR link CTA fallback)
- ➕ `frontend/app/api/revalidate-hub/route.ts` (45 LOC) — POST endpoint w/ Bearer token auth (`REVALIDATE_TOKEN` env), calls `revalidateTag('promo-hub:<slug>', 'default')` + `revalidateTag('promo-hubs-sitemap', 'default')`. Next.js 16 2-arg signature `revalidateTag(tag, profile)`.
- ✏️ `frontend/app/sitemap.ts` — fetch published hubs from `BACKEND_URL/api/promo-hubs?status=published&pageSize=200`, map to `MetadataRoute.Sitemap` entries w/ `lastModified` from `updatedAt`, priority 0.8, changeFrequency weekly. Cached w/ `next: { revalidate: 3600, tags: ['promo-hubs-sitemap'] }` for on-demand revalidate.
- 🔄 `frontend/lib/api-generated/*.gen.ts` — auto-regen

**Workflow docs (3 NEW + 2 MODIFY):**
- ✏️ `.5bib-workflow/features/FEATURE-027-promo-hub/03-coder-implementation.md` — Phase A1-A5 + Phase B addendum complete
- ✏️ `.5bib-workflow/features/FEATURE-027-promo-hub/04-qc-report.md` — Phase A1 partial QC + Phase A5 full QC + Phase B final QC verdicts
- ➕ `.5bib-workflow/features/FEATURE-027-promo-hub/OPS-NOTES.md` — env vars + nginx routing + deploy checklist (10 items) + rollback per-service + observability metrics + security notes
- ➕ `.5bib-workflow/features/FEATURE-027-promo-hub/05-manager-deploy.md` — this Manager close artifact

### Architecture impact

**New module domain:** "Promo Hub" — independent from existing 33 modules.

- 3 new MongoDB collections: `promo_hubs` (main + sections subdoc array), `promo_hub_clicks` (analytics events w/ TTL 90d), `promo_hub_views` (analytics views w/ TTL 90d)
- New Redis key namespace: `promo-hub:*`, `promo-hub-lock:*`, `promo-hub-view-rl:*`
- Public route: `/hub/<slug>` on 5bib.com (Server Component SSR + ISR 60s + tag-based revalidation)
- Admin route: `/admin/promo-hub/*` (RBAC Tier 2 `isAdmin` gate F-029 pattern at top of component)
- Section components KHÔNG cross-module Nest DI — frontend Server Components fetch races/sponsors/race-results trực tiếp qua `/api/races`, `/api/sponsors`, `/api/race-results` tại SSR layer (not via `RacesService` injection)

**Cross-app revalidation flow (NEW pattern):**
```
Admin saves promo hub
   │
   ▼
[PATCH /api/promo-hubs/:id] → backend updates Mongo + DEL Redis cache
   │
   ▼ (fire-and-forget from admin client)
[POST /api/revalidate-hub] on admin Next.js → server-side proxy attaches REVALIDATE_TOKEN
   │
   ▼
[POST /api/revalidate-hub] on frontend Next.js → validates Bearer token
   │
   ▼
revalidateTag('promo-hub:<slug>', 'default')
revalidateTag('promo-hubs-sitemap', 'default')
   │
   ▼
Next public hit → ISR re-fetches from backend → fresh data <1s
```

Without REVALIDATE_TOKEN: frontend returns 401, admin gracefully skips → falls back to ISR 60s window (acceptable).

### Conventions impact (8 NEW patterns minted — added to conventions.md)

1. **Anti-stampede SETNX lock** (port từ F-004 RaceMasterDataService) — used in `PromoHubService.findBySlugPublic()`:
   - Lock key `promo-hub-lock:<slug>` TTL 5s via Redis `SET key 1 EX 5 NX`
   - Lock retry 3 lần với 200ms sleep, fallback DB direct if all retries fail
   - Prevents 100 concurrent cold-cache requests from hitting Mongo

2. **Section-as-subdoc array** (vs separate `sections` collection):
   - `promo_hubs.sections[]` as Mongoose subdoc array
   - Read-heavy pattern (admin edit + public render đều load toàn document), atomic save toàn document
   - Trade-off: doc growth limit 16MB MongoDB — acceptable cho ~30 sections × 5KB config = 150KB max

3. **DOM event delegation tracker** (Client+Server hybrid for analytics):
   - Sections render server-side (no React event handlers possible)
   - `PromoHubTracker` Client Component attaches document-level capture-phase click listener via `useEffect`
   - Reads `data-promo-cta`, `data-promo-section-id`, `data-promo-cta-label`, `data-promo-cta-url` data attributes from closest CTA ancestor
   - `keepalive: true` fetch ensures navigation doesn't cancel analytics POST

4. **HOST whitelist iframe defense** (NEW security pattern):
   - `map_embed`: `google.com`, `maps.google.com`, `www.openstreetmap.org` only, HTTPS-only via `new URL(...).host` + `protocol === 'https:'` check
   - `form_embed`: `docs.google.com`, `forms.gle`, `tally.so`, `form.5bib.com`, `forms.office.com` only
   - Fallback to text/link CTA mode for non-whitelisted (no hard fail UX)
   - Pattern reusable for any future iframe-embedding feature (FB embed, Twitter card, podcast, etc.)

5. **Inline SVG brand icons** (when lucide-react gap):
   - lucide-react v1.7 missing Vietnamese platforms (Zalo correct), TikTok brand-correct icon, Telegram correct
   - Inline SVG with `viewBox` 24×24 + `currentColor` + platform brand-color backgrounds (Tailwind class)
   - Acceptable trade-off vs adding 3-5 new icon deps

6. **Cross-app cache invalidation via server-side proxy + Bearer token**:
   - Admin Next.js can't import `revalidateTag` directly (different Next.js app instance)
   - Admin server-side proxy attaches `REVALIDATE_TOKEN` (never sent to browser — server-only env)
   - Frontend route validates token + calls `revalidateTag`
   - Fail-closed if env unset (frontend 401, admin `{ ok: true, skipped: 'no-token' }` graceful fallback to ISR 60s)
   - Reusable pattern for any future cross-app cache coordination

7. **Next.js 16 `revalidateTag(tag, profile)` 2-arg signature**:
   - `revalidateTag('promo-hub:<slug>', 'default')` — second arg = `'default'` preset string OR `CacheLifeConfig` object
   - Old 1-arg signature deprecated in Next.js 16
   - Documented for future Next.js features migrating

8. **Switch-over-registry for type-dispatching components**:
   - `SectionConfigDialog.tsx` uses `switch(section.type)` over 19 cases
   - `PromoHubRenderer.tsx` uses `switch(section.type)` over 19 cases
   - Pragmatic MVP — simpler reading order, fewer files, easier debugging
   - Refactor to plugin registry when section types >25 OR content team adds custom types
   - Anti-pattern: don't do dynamic component import per type for small N

### DB / Cache impact

**MongoDB (NEW collections):**
- `promo_hubs`: indexes `{slug: 1}` sparse unique, `{status: 1, createdAt: -1}` compound. Document size: typically ~50-150KB (max 30 sections × 5KB config).
- `promo_hub_clicks`: indexes `{hubId: 1, clickedAt: -1}` compound, `{clickedAt: 1}` with `expireAfterSeconds: 7776000` (90-day auto-delete TTL)
- `promo_hub_views`: same as clicks
- All indexes auto-create on first Mongoose connection (no manual migration script needed)
- **NO impact** on existing 42K orders, 94K athletes, 195 races, 58 tenants

**Redis (NEW key namespace):**
- `promo-hub:<slug>` — cached `PromoHubResponseDto` JSON (filtered for public — visible sections + within schedule), TTL 60s. Invalidated on admin write via `RedisService.del()`.
- `promo-hub-lock:<slug>` — SETNX anti-stampede lock, TTL 5s
- `promo-hub-view-rl:<slug>:<ipHash>` — view rate-limit per IP per slug, TTL 300s (5 min)
- **NO impact** on existing cache keys (results, race summaries, leaderboards, etc.)

**Next.js cache tags (NEW):**
- `promo-hub:<slug>` — page-level ISR tag for `/hub/<slug>` route
- `promo-hubs-sitemap` — bulk revalidate when hub list changes (publish/unpublish/delete operations)

**MySQL platform DB:** **NO change** — Promo Hub không touch MySQL platform DB.

**AWS S3:** **NO change** — Phase 1 uses raw image URLs (admin pastes S3 URLs from existing buckets). Phase 2 (TD-F027-PHASE2-02) will integrate UploadModule.

### Tech debt còn lại (15 TD-F027-PHASE2-* entries → known-issues.md)

**HIGH priority (Phase 2 backlog):**
1. TD-F027-PHASE2-01 — `featured_races` + `recent_results` need race picker UI
2. TD-F027-PHASE2-02 — Image picker integration with UploadModule

**MEDIUM priority:**
3. TD-F027-PHASE2-03 — TipTap WYSIWYG (deps installed, not wired)
4. TD-F027-PHASE2-04 — Preview pane mock, no full SSR preview iframe
5. TD-F027-PHASE2-05 — No autosave
6. TD-F027-PHASE2-06 — No "duplicate hub" action
7. TD-F027-PHASE2-07 — `next/image` migration
8. TD-F027-PHASE2-08 — Playwright e2e tests for 19 section types

**LOW priority:**
9. TD-F027-PHASE2-09 — `social_links` icons hardcoded inline SVG
10. TD-F027-PHASE2-10 — `countdown` 1s polling battery drain
11. TD-F027-PHASE2-11 — `map_embed` auto-extract from share URL
12. TD-F027-PHASE2-12 — `form_embed` HOST whitelist move to env
13. TD-F027-PHASE2-13 — `race_calendar` group-by-month
14. TD-F027-PHASE2-14 — Public page `loading.tsx` skeleton
15. TD-F027-PHASE2-15 — Sitemap admin-gated endpoint via docker network (needs `X-Internal-Token` if split deploy)

### Lessons learned (CRITICAL — Manager workflow process gaps)

**1. BA-to-PRD competitor cross-check gap (ROOT CAUSE of Phase B addendum):**
- `01-ba-prd.md` BR-PH-04 chốt 9 section types based on Manager `00-manager-init.md` impact map
- BA + Manager BOTH missed verifying against real-world competitor (iRaceticket on addme.vn pattern)
- Manager `/5bib-plan` 2026-05-11 APPROVED PRD without competitor analysis
- Result: After QC ✅ APPROVED (2026-05-13) + Danny UI review → Danny flagged "thiếu nhiều cái section để đáp ứng là 1 trang quảng cáo"
- Manager downgrade verdict (post-APPROVED is unusual), Option B chosen (full 10 section addendum)
- **Manager process fix going forward (added to conventions.md):** For `NEW_MODULE` features competing with existing market products (Linktree clones, race platforms, ticket platforms), `/5bib-init` MUST require BA list 2-3 competitor URLs + cross-check section/feature parity BEFORE APPROVE plan. Failure to do so = Plan REJECTED back to `/5bib-prd` competitor analysis section.

**2. Manager process exception — Phase B without re-running `/5bib-prd`:**
- Scope addendum (10 new section types) shipped without formal BA `01-ba-prd.md` update
- Justification: Pattern is "append enum + 10 components" — identical structure as Phase A1 9 components. No new business logic, just visual variants. New BR added: BR-PH-17 ("Hub support 19 section types").
- Acceptable as ONE-OFF — but if Phase B had introduced new BR with state machines or new auth requirements (e.g., form submission rate limit, payment integration), would have needed formal `/5bib-prd` re-run.
- **Documented in feature-log note + this entry for future Manager reference.**

**3. PROD env config dependency (NEW pattern):**
- `REVALIDATE_TOKEN` + `FRONTEND_REVALIDATE_URL` are NEW env vars needed on VPS for full cross-app cache invalidation
- Without set: feature works, propagation falls back to ISR 60s (graceful fallback)
- Code uses fail-closed pattern (admin returns `{ skipped: 'no-token' }` graceful, frontend returns 401)
- Pattern reusable for any future cross-app coordination

**4. SDK regen flow when Coder bumps backend enum:**
- After enum extension (Phase B 9→19 types), MUST `pnpm generate:api` ở cả admin AND frontend (2 separate apps)
- Backend hot-reload picks up enum change → Swagger JSON updated → both SDKs regen-ed via `@hey-api/openapi-ts`
- Pattern works smoothly — documented in OPS-NOTES.md

**5. Workspace branch hygiene (carryover F-029 lesson):**
- Pre-flight `git branch --show-current` at session start avoided F-029-like worktree confusion
- Mandatory check before code work

**6. Frontend dev server cache invalidation gotcha:**
- After SDK regen, Next.js dev server (`next dev`) cached old SDK imports → caused build error mid-session
- Fix: kill dev server + `rm -rf .next` + restart
- Pattern: when SDK regen happens during active dev session, always restart Next dev to pick fresh imports

**7. lucide-react version gap (Phase B icon hunt):**
- lucide-react v1.7 missing `Youtube` icon name (used `PlayCircle` instead)
- Inline SVG approach for brand-correct platforms (TikTok, Zalo) avoided dep churn

### Manager workflow note (process documentation)

**Phase B reopen of QC verdict was UNUSUAL workflow event:**
- Standard flow: `/5bib-qc` APPROVED → `/5bib-deploy` close
- This case: `/5bib-qc` APPROVED → Danny UI review → flagged competitor gap → Manager DOWNGRADE verdict to `🟡 NEEDS_REVISION` → Option B addendum → re-run Phase B implementation → Phase B QC final → DEPLOY
- **Documented as exception, NOT new standard pattern.** Future Phase B-style addenda should still trigger formal `/5bib-prd` if scope >5 new business rules.

---

## [2026-05-13] FEATURE-030: Reconciliation Add-on Visual + 5BIB Provider Config

**PR/Commit:** `f980228` on `main` → `release/v1.7.8` (CI `deploy-production.yml` auto-deploy PROD)
**Type:** BUGFIX + EXTEND_EXISTING
**Status:** ✅ DONE

### Why
Danny PROD report 2026-05-13 đối soát Zaha Hai Phong Legacy Marathon tháng 4 phát hiện 2 bugs đồng thời:

1. **ADD-ON VISUAL** — XLSX Section 1 (gross 18,422,200) vs Section 3 line items breakdown (18,123,200) vênh 299K = giá trị áo (add-on) bị orphan trong render. Col 4/5/6 hardcode 0 thay vì đọc `li.add_on_price` đã aggregate đúng trong calc.service.
2. **5BIB PROVIDER INFO HARDCODE SAI** — `docx.service.ts:533-543` từ legacy commit `205a1c1` ghi địa chỉ cũ "Tôn Thất Thuyết, Mỹ Đình 2, Nam Từ Liêm" thay vì trụ sở thực "Tầng 9, Hồ Gươm Plaza, 102 Trần Phú, Hà Đông". Manager đã ngu kế thừa nguyên si từ legacy, không hỏi Danny.

Sub-bug discovered during trace: `calc.service.ts:106` cộng `total_add_on_price` (order-level field từ MySQL) cho mọi row line-item → over-count khi 1 order có ≥2 line items. XLSX render col 6 trước F-030 hardcode 0 nên bug invisible.

### Files changed (8 file = 5 Scope Lock + 3 test artifacts justified)

- ✏️ Modified: `backend/src/config/index.ts` — Joi schema 8 `PROVIDER_*` vars với `.default()` fail-soft + `env.provider` namespace export (companyName, address, taxCode, phone, representativeName, representativeTitle, bankAccount, bankName)
- ✏️ Modified: `backend/src/modules/reconciliation/services/reconciliation-calc.service.ts` — Move `add_on_price` aggregation INTO `_seenOrderIds` dedup block, áp dụng cho cả ORDINARY và CHANGE_COURSE branch
- ➕ Added: `backend/src/modules/reconciliation/services/reconciliation-calc.service.spec.ts` — 5 TC-AO-* (TC-AO-01 CRITICAL dedup bug fix + TC-AO-02 Zaha fixture + TC-AO-03..05 edge cases)
- ✏️ Modified: `backend/src/modules/reconciliation/services/xlsx.service.ts` — Render `li.add_on_price` col 6 per-line + col 4/5 '—' indicator khi có add-on + bottom Tổng include totalAddOnPrice
- ➕ Added: `backend/src/modules/reconciliation/services/xlsx.service.spec.ts` — TC-AO-06 visual render verify (col 6 + bottom Tổng + per-line '—' indicator)
- ✏️ Modified: `backend/src/modules/reconciliation/services/docx.service.ts` — Import `env`, replace 6 hardcoded `infoRow(...)` + 2 signature paragraphs với `env.provider.*`, add conditional bottom row "Vật phẩm bổ sung (áo, ...)" khi `totalAddOnPrice > 0`
- ➕ Added: `backend/src/modules/reconciliation/services/docx.service.spec.ts` — 4 TC-AO-07..10 (env.provider verify + legacy strings ABSENT + bottom row conditional + signature uppercase)
- ✏️ Modified: `backend/.env.example` — F-030 section với 8 `PROVIDER_*` current values + comment

### Architecture impact
ZERO — pure additive env namespace + render layer fix. No schema change, no new module, no new endpoint, no API contract change.

### Conventions impact (3 NEW patterns minted)

1. **"Fail-soft env defaults" cho business legal info** — Joi `.default()` thay vì `.required()` để KHÔNG outage container restart khi env partial set. Defaults từ trusted source (Danny confirmed). Reuse: company info, default page sizes, microcopy fallbacks.
2. **"Bottom summary row conditional pattern"** (DOCX/PDF) — `const optionalRow: TableRow | null = totalOptional > 0 ? new TableRow(...) : null;` + spread `...(optionalRow ? [optionalRow] : [])`. Avoids redesign table for optional data. Reuse: add-on, discount aggregate, tax row, surcharge.
3. **"Order-level field dedup pattern via Set<string>"** — Reuse same `_seenOrderIds` Set với multiple order-level fields trong cùng aggregation block. Heuristic: `total_*` prefix thường order-level. Reuse: aggregate field từ JOIN trong reconciliation, analytics, P&L modules.

### DB / Cache / S3 impact
- MongoDB: ZERO change. `LineItem.add_on_price` schema field đã tồn tại từ trước.
- MySQL platform: ZERO (read-only `o.total_add_on_price` đã có sẵn từ JOIN).
- Redis: ZERO (module không có cache layer).
- AWS S3: ZERO change.

### Tests
- `reconciliation-calc.service.spec.ts` NEW: 5 TC-AO-* (TC-AO-01 CRITICAL dedup + TC-AO-02 Zaha fixture math + TC-AO-03 zero-addon + TC-AO-04 multi-order + TC-AO-05 CHANGE_COURSE defensive)
- `xlsx.service.spec.ts` NEW: TC-AO-06 (col 6 + bottom Tổng + per-line indicator)
- `docx.service.spec.ts` NEW: 4 TC-AO-07..10 (env.provider verify + legacy absent + bottom row conditional + signature uppercase)
- **Total NEW: 10 tests** ALL PASS
- **Reconciliation domain: 71/71 + 8 of 9 suites PASS** (controller.spec failure pre-existing F-029 regression, flagged TD-F029-INHERITED-CTRL-SPEC)

### Tech debt added (5 items, all LOW)
- TD-F030-ADDON-MULTI-TICKET-TYPE — add-on attached ticket-type group đầu tiên khi 1 order multi-type (real-world hiếm)
- TD-F030-XLSX-DASH-CELL — cosmetic '—' mixed dtype col 4/5
- TD-F030-OLD-RECON-VISUAL — recon cũ thiếu add-on rows (per PAUSE-30-02 KHÔNG migrate)
- TD-F030-XLSX-DTYPE-MISMATCH — future aggregate col 4 risk
- TD-F030-DOCX-PROVIDER-MOBILE — long address có thể wrap ugly

### Tech debt flagged inherited
- TD-F029-INHERITED-CTRL-SPEC — `reconciliation.controller.spec.ts` fail load post F-029 `LogtoStaffGuard` refactor (NOT introduced by F-030, separate cleanup)

### Deploy
- 2026-05-13: commit `f980228` on `main` → push `origin/main` → CI auto-deploy DEV
- 2026-05-13: branch `release/v1.7.8` from main HEAD → push `origin/release/v1.7.8` → CI `deploy-production.yml` auto-deploy PROD
- ⏳ Pending: Danny PROD smoke test — re-download recon Zaha tháng 4 → verify add-on row 299K + 5BIB info "Hồ Gươm Plaza"
- ⏳ PROD env vars `PROVIDER_*` — KHÔNG cần set (defaults trong code match Danny chốt info). Override sau khi business info đổi.

### Lessons learned
1. **"Đừng tự quyết định" — hỏi Danny business info chính xác trước hardcode default.** Tao kế thừa legacy hardcoded address "Tôn Thất Thuyết" qua 4 features (F-003/F-004/F-016/F-025) mà KHÔNG verify với Danny. Lesson: bất kỳ business legal info / company data trong code → MUST verify với Danny / business owner trước khi commit, kể cả khi inherit từ legacy. Mint convention: "Defensive review legacy hardcoded business strings" trong Manager `/5bib-init` impact map.
2. **Sub-bug discovery during trace** — F-030 visual fix trace ra add_on_price dedup bug pre-existing trong calc.service. XLSX render hardcode 0 hide bug ~6 months. Lesson: render layer fix có thể expose backend aggregation bugs. Manager Plan must include "trace data flow end-to-end" để catch hidden bugs.
3. **Skip BA gate pattern proven** — F-025 + F-030 cả 2 skip BA → Manager Plan thay PRD. Saved ~2-3h per feature. Pattern: scope ≤ 5-8 files + tất cả PAUSE chốt + reuse có sẵn → BA gate overkill. Manager phải explicit document "BA gate SKIPPED" trong Plan.
4. **Fail-soft env defaults pattern** — `.default()` cho business legal info preventing PROD outage container restart. Apply mọi env var không phải secret.
5. **Memory-first protocol stash conflict** — Manager mode session 3-times stash/checkout/pop để sync với origin/main đã F-029. Lost `.5bib-workflow/` folder mid-session (stash với `-u` flag KHÔNG include nó until untracked → need explicit stash`-u`). Lesson: trước switch branch trong worktree với memory updates pending → backup `.5bib-workflow/` separate. Tao đã recover bằng `git stash pop stash@{0}` (pre-F-030 leftover stash chứa folder).
6. **Pattern reuse `_seenOrderIds`** — F-030 sub-bug fix dedup add_on_price áp dụng cùng Set với `discount_amount` pattern. Multiple order-level fields share single dedup Set — clean idiom.

---

## [2026-05-13] FEATURE-029: Hardening Phase 1 + Phase 1.1 — HIGH non-CRIT batch

**PR/Commit:** Branch `5bib_hardening_phase_1_v1` off main `01c2950` (uncommitted at deploy time — Danny + DevOps merge → cut `release/v1.8.0`)
**Type:** REFACTOR + BUGFIX (security defense-in-depth + perf + UX polish)
**Status:** ✅ DONE (workflow deploy — physical merge pending Danny timing)

### Why
ULTRAREVIEW TOÀN PROJECT 2026-05-12 (111 findings) phát hiện 4 HIGH non-CRIT cần fix trước cut `release/v1.8.0`:
- HIGH-RR-01: race-result public list endpoint leak draft race
- HIGH-PERF-01: P&L dashboard N+1 cross-DB MySQL (50 contracts = 50 RTT, ~2-5s)
- HIGH-RBAC-01: 87/92 admin pages thiếu RestrictedAccess gate
- Display Convention violations (raw enum + ObjectId slice + plain "Đang tải..." text)

Plus 5 CRIT findings Danny defer ("dev có lý do"). F-029 Phase 1 closes 4 HIGH scope-locked. Phase 1.1 extension (post-QC v1) closes MISS-01 sibling endpoint leak (TD-F029-NEW-01).

### Files changed

**Phase 1 — Backend (10 files):**
- ➕ Added: `backend/src/modules/logto-auth/permissions.helper.ts` — NEW `hasUser` + `isAdminOrHigher` + `isStaffOrHigher` dual-check (roles[] ∪ scopes[]) mirror backend guards verbatim
- ✏️ Modified: `backend/src/modules/logto-auth/index.ts` — export helpers
- ✏️ Modified: `backend/src/modules/race-result/services/race-result.service.ts` — `getRaceResults(dto, user?)` + isPrivileged check
- ✏️ Modified: `backend/src/modules/race-result/race-result.controller.ts` — `@UseGuards(OptionalLogtoAuthGuard) + @CurrentUser()` on `GET /race-results`
- ✏️ Modified: `backend/src/modules/race-result/race-result.module.ts` — import `LogtoAuthModule`
- ✏️ Modified: `backend/src/modules/finance/services/fee.service.ts` — add `getActualRevenueForRaces(raceIds, options)` bulk (HIGH-PERF-01 fix, chunked 100/query, DISTINCT subquery preserve F-016 semantic)
- ✏️ Modified: `backend/src/modules/finance/services/pnl.service.ts` — refactor `getDashboardData()` N+1 → batch pre-fetch + sync `resolveRevenueSync`
- ✏️ 3 spec files extend: race-result (+8), pnl (+6 incl snapshot equivalence), fee (+8 bulk/chunk/dedup/error)

**Phase 1 — Frontend (47 files):**
- 37 admin pages RBAC wrap (3 Server→Client conversions, 2 redirect-only skipped):
  - Tier 1 `isStaff` (33): contracts/* (7) + reconciliations/* (3) + team-management/* (23)
  - Tier 2 `isAdmin` (4): sponsors, sponsored, bug-reports, api-keys
- 9 display sweep:
  - ➕ Added: `admin/src/lib/timing-labels.ts` — NEW central VN dictionary
  - ✏️ Modified: `reconciliations/new/page.tsx:445` — Skeleton swap
  - ✏️ Modified: `timing-alert-simulator/page.tsx:103` + `AlertDetailDialog.tsx:397` — raw enum → label maps
  - ✏️ Modified: `contracts/partners/[id]/page.tsx:145` + `reconciliations/audit/page.tsx:122` — ObjectId slice fixes
- 🔄 SDK regen auto (6 files)

**Phase 1.1 extension — Backend (3 files modify + 1 spec extend):**
- ✏️ Extended `race-result.service.ts`:
  - ➕ 3 helpers: `enforceRaceVisibility(raceId, user?)` **public** + `resolveRaceIdFromCourseId(courseId)` private + `enforceCourseVisibility(courseId, user?)` private composite
  - Refactored `getRaceResults` Phase 1 inline → call helper (DRY)
  - 9 service methods accept `user?: LogtoUser` + call helper: getFilterOptions, getLeaderboard, getAthleteDetail, compareAthletes, getCourseStats, getTimeDistribution, getCountryStats, getCountryRank, getPercentile
- ✏️ Extended `race-result.controller.ts`: 12 endpoint `@UseGuards(OptionalLogtoAuthGuard) + @CurrentUser()` (1 already Phase 1)
- ✏️ Extended `race-result.service.spec.ts`: +16 test cases (4 helper + 12 endpoint scenarios)

**Total ~65 files** within Plan Scope Lock + Manager Override + Phase 1.1 extension scope.

### Test results

```
PASS race-result.service.spec.ts (24/24 F-029 cases — 8 Phase 1 + 16 Phase 1.1)
PASS pnl.service.spec.ts (6/6 F-029 batch + snapshot equivalence)
PASS fee.service.spec.ts (8/8 F-029 bulk SQL)

F-029 unit tests: 38/38 PASS
Backend typecheck: 4 errors (pre-existing Vitest upload spec, UNRELATED) / 0 new
Admin typecheck: 8 errors (pre-existing TD-F013-TESTSTACK, UNRELATED) / 0 new
```

QC v2 verdict ✅ APPROVED — no PROD BLOCKER. TD-F029-NEW-01 RESOLVED.

### Architecture impact

- NO new node added — F-029 chỉ refactor + guard layer thêm vào existing modules
- `race-result` module giờ depends on `LogtoAuthModule` (was missing)
- HIGH-PERF-01 bulk method `getActualRevenueForRaces` reuses existing F-016 cross-DB pattern
- F-029 race-status check reuses `RacesService.getRaceById(id, isPrivileged)` existing 5min cache — KHÔNG tạo `race-status:<raceId>` key mới (Coder optimization, acceptable design trade-off)

### Conventions impact

3 new patterns to add to `conventions.md`:
1. **Dual-check permission helpers** — pure functions mirror backend guards for state-branching service logic
2. **`enforceRaceVisibility(raceId, user?)` public helper pattern** — service helper public scope when controller bypasses standard public methods
3. **RBAC page-level gate** — 3-layer defense-in-depth (sidebar hide + backend guard + page-level `<RestrictedAccess />`)

### DB / Cache impact

- MongoDB: NO schema change. Read-only race.status existing collection.
- MySQL platform: NO schema change. Bulk query uses existing F-016 tables (order_metadata + order_line_item + ticket_type + race_course).
- Redis: NO new key pattern. F-029 reuse `race:id:<id>` 5min existing. `pnl:*` unchanged.

### Tech debt còn lại (moved to known-issues.md)

**RESOLVED by F-029:**
- 🟢 RESOLVED: TD-F029-NEW-01 (was QC v1 PROD BLOCKER, Phase 1.1 fixed — 13 sibling endpoints gated)

**New TDs for FEATURE-030 Wave 2 hardening:**
- 🟡 TD-F029-NEW-02 — POST `/result-image/:raceId/:bib` ungated (Plan listed GET only)
- 🟡 TD-F029-NEW-03 — GET `/race-results/search?q=` global search leaks draft race athletes (service-level filter needed)
- 🟡 TD-F029-01..05 — EXPLAIN ANALYZE, Skeleton screenshot, redirect TM pages, merchants raw enum, pre-existing race-result spec failures

**5 CRIT defers remain unchanged** (TD-2026-05-12-CRIT-01..04 + CI-01) — Danny "dev có lý do".

### Lessons learned

1. **PRD scope blind spot**: ULTRAREVIEW listed 1 endpoint HIGH-RR-01 → PRD BR-HD-01 narrowed → Phase 1 fix incomplete (13 sibling leak). QC v1 adversarial Phase 2 caught. Future hardening init MUST BFS enumerate attack surfaces với same param, không trust ULTRAREVIEW finding scope literally.
2. **Workflow exception works**: Phase 1.1 extended PRD BR-HD-01 implicit via Manager Plan extension (BA artifact untouched). Saved bounce loop ~30 phút. Reserved for pure technical defense-in-depth, no business intent change.
3. **Helper extraction trade-off**: `enforceRaceVisibility` private → public to support 3 controller endpoints bypass standard service. Pattern: service helper public scope OK với clear docstring when cross-service controller composition.
4. **Coder workspace branch confusion (PAUSE-MGR-03)**: Worktree on `release/v1.7.7` (F-025) thiếu F-024/F-028. Coder initially edited main repo wrong filesystem. Resolved checkout new branch off main IN WORKTREE. Lesson: verify worktree branch state before edit; absolute paths matter with co-existing worktrees.
5. **Subagent delegation worked Phase B+C**: 37 page wraps + 9 display swap delegated general-purpose subagent. ~10x faster than serial. Pattern reusable for mechanical UI work batches. KHÔNG delegate core logic (Phase A backend).

---

## [2026-05-11] FEATURE-025: Reconciliation Bulk Delete

**PR/Commit:** `84155aa` on `main` → `release/v1.7.7` (CI `deploy-production.yml` auto-deploy PROD)
**Type:** BUGFIX + EXTEND_EXISTING
**Status:** ✅ DONE

### Why
Danny PROD report 2026-05-11: admin reconciliations page — "chọn vài đối soát ấn xóa → lỗi 500 lần đầu, lần 2 chỉ xóa 1". Trace ra 2 layer separate:

1. **ROOT 500 (hot patch out-of-band):** Admin Next.js proxy `new NextResponse(arrayBuffer, {status:204})` ném `TypeError: Response constructor: Invalid response status code 204` vì Web Fetch spec không cho body với null-body status. Fixed via commit `bab4c44` v1.7.5 sweep 3 proxy (admin + frontend + crew).
2. **FEATURE GAP (F-025 scope):** KHÔNG có bulk delete UI/endpoint. `selectedIds` Set chỉ wired vào Export ZIP. Mỗi click trash icon xóa 1 row → confusing UX khi admin dọn 11 recon test.

### Files changed (6 files = 5 Scope Lock + 1 QC artifact)

#### Backend (5)
- ➕ Added: `backend/src/modules/reconciliation/dto/delete-batch.dto.ts` (NEW) — `DeleteBatchDto` với `@IsArray() @ArrayMinSize(1) @ArrayMaxSize(50) @IsMongoId({each:true}) ids: string[]` + `DeleteBatchResponseDto { deleted: number; not_found: number }`
- ➕ Added: `backend/src/modules/reconciliation/dto/delete-batch.dto.spec.ts` (NEW QC artifact) — 9 TC-DT validation tests (boundary 1/50, types isArray/object/string, IsMongoId hex/non-hex)
- ✏️ Modified: `backend/src/modules/reconciliation/reconciliation.controller.ts` — `@Post('delete-batch') @HttpCode(200)` endpoint placed after `export/zip/by-period`, BEFORE `@Delete(':id')`. Import DTO. Class-level `LogtoAdminGuard` inherited.
- ✏️ Modified: `backend/src/modules/reconciliation/reconciliation.service.ts` — Added `private readonly logger = new Logger(ReconciliationService.name)` + `async deleteMany(ids: string[]): Promise<DeleteBatchResponseDto>` method using `this.reconciliationModel.deleteMany({_id: {$in: ids}})` (1 RTT). Logger.warn structured `{event: 'reconciliation_bulk_delete', ids_count, deleted_count, not_found_count}`. Idempotent — NO throw NotFoundException (khác `delete(id)` single).
- ✏️ Modified: `backend/src/modules/reconciliation/reconciliation.service.spec.ts` — 8 NEW tests for `deleteMany`: TC-DM-01..05 (Coder mandatory) + TC-QC-DM-06 10x stability concurrent + TC-QC-DM-07 idempotent retry + TC-QC-DM-08 log payload privacy.

#### Admin Frontend (1)
- ✏️ Modified: `admin/src/app/(dashboard)/reconciliations/page.tsx` — State `bulkDeleteOpen` + `bulkDeleteLoading`, function `handleBulkDelete()` (POST + toast success/error/secondary not_found + clear selectedIds + fetchItems), Button "Xóa hàng loạt (N)" header destructive variant, Dialog 2-button modal NO typing/checkbox per PAUSE-25-01.

### Architecture impact
- NO new MongoDB collection, NO new index, NO new Redis key, NO new endpoint pattern type — reuse F-004 `export/zip/by-ids` bulk-by-ids idiom.

### Conventions impact (1 NEW pattern minted)

**"Bulk delete idempotent return shape"** appended vào `conventions.md`:
- Mongoose `deleteMany({_id:{$in:ids}})` atomic 1 RTT thay vì loop N x delete(id)
- Return `{deleted: number, not_found: number}` counts thay vì throw NotFoundException
- Frontend handle both branches via primary toast (deleted) + secondary toast (not_found)
- Consistent với F-016 v1.6.5 idempotent UX single-delete

Reuse candidates: bulk delete admin actions (athletes, sponsors, contracts), bulk cancel orders, bulk archive races.

### DB / Cache / S3 impact
- MongoDB: ZERO change. Deletions atomic per-doc, idempotent.
- MySQL platform: ZERO
- Redis: ZERO (module không có cache)
- S3: ZERO. Pre-existing TD per PAUSE-25-04: XLSX/DOCX orphan files trong S3 — lifecycle 24h dọn (chưa cấu hình rule chính thức, open TD).

### Tech debt added (5 items)
- **TD-F025-SDK-REGEN** (🟡 MED) — re-run `pnpm --filter admin generate:api` post-deploy
- TD-F025-RAW-FETCH (🟢) — handleBulkDelete raw fetch consistent với 13+ pre-existing
- TD-F025-FE-UNIT-TEST (🟢) — block TD-F013-TESTSTACK
- TD-F025-AUDIT-LOG-COLLECTION (🟢) — future compliance feature riêng
- TD-F025-SERVICE-LOGGER-INCONSISTENCY (🟢) — pre-existing service methods không dùng Logger

### Tests
- Backend `reconciliation.service.spec.ts` extend: 8 NEW tests (5 TC-DM Coder + 3 TC-QC-DM QC)
- Backend `delete-batch.dto.spec.ts` NEW: 9 TC-DT QC validation
- **Total NEW F-025: 17 tests** + 7 pre-existing regression = 24 TC-related
- **Reconciliation domain: 82/82 PASS** (0 regression F-003/F-004/F-016)

### Deploy timeline
- 2026-05-11 ~16:00 GMT+7: commit `84155aa` push `origin/main` → CI auto-deploy DEV
- 2026-05-11 ~16:00 GMT+7: branch `release/v1.7.7` push `origin/release/v1.7.7` → CI `deploy-production.yml` auto-deploy PROD
- ⏳ Pending Danny PROD smoke test
- ⏳ Pending re-run `generate:api` separate commit (TD-F025-SDK-REGEN)

### Lessons learned
1. **5 PAUSE-25-* simplified scope dramatically** — Danny chốt "ZERO friction" + "admin làm đéo gì chả được" reduce confirm complexity 50%. Pattern proven F-016 BR-08 + F-025: always ask Danny business reality trước over-engineering.
2. **BA gate skip justified khi scope hẹp + PAUSE chốt rõ** — F-025 không có ambiguity, Manager plan thay PRD đủ. Saved 2-3h. Pattern: skip BA only khi BUGFIX/EXTEND_EXISTING ≤ 5 file + tất cả PAUSE answered + reuse có sẵn.
3. **Idempotent bulk delete return shape mới mint** — `{deleted, not_found}` counts pattern cho domain bulk. Reusable mọi future bulk admin action.
4. **Manager scope discipline trên auto-generated files** — Coder SDK regen revealed F-023/F-026 backlog unrelated tới F-025. Revert SDK regen, flag TD-F025-SDK-REGEN. Lesson: Scope Lock applies cả generated files.
5. **Hot patch out-of-band pattern proven** — 500 root cause (proxy 204) fix shipped v1.7.5 trước F-025 implementation, không block workflow. Sequence: Danny report → trace → hot patch → continue feature flow. Reusable cho future PROD incident discovery during in-flight.

---

## [2026-05-09] FEATURE-019: Awards Age Group Podium + Anomaly Warnings (v1 → v2 → v2.1)

**PR/Commit:** `3f65c31032b974116c552743b591dcfba7fa8969` on `5bib_racemonitor_v1` (push synced `origin/5bib_racemonitor_v1`)
**Type:** NEW_MODULE (extends F-008v2 Awards tab placeholder)
**QC verdict:** 🟢 APPROVED WITH CAVEATS (`04-qc-report-final.md`)
**Tests:** 79/79 backend awards PASS + 22/22 admin (5 skipped integration probes — auth-required)
**Stats:** 80 files changed (68 A + 12 M), 9139 insertions, 149 deletions
**Cluster:** Race Ops Cluster #9 #2 (sau F-018 Medical Incident #9 #1)
**Workflow journey:** v1 (53 files initial — UAT fail vendor Category whitespace, 0 podium silent false negative) → v2 (29 files: strategic pivot 5BIB independent calc + Pattern H VENDOR_MISMATCH, 72 tests) → v2.1 (6 files: VN amateur convention default flip, 79 tests)

### Files changed

#### Backend — Awards module (NEW, full module)
- ➕ Added: `backend/src/modules/awards/awards.module.ts` — module DI registration
- ➕ Added: `backend/src/modules/awards/awards.controller.ts` — full CRUD + state transition + PDF export, Swagger DTO complete
- ➕ Added: `backend/src/modules/awards/services/awards.service.ts` — orchestrator, race-level `awardsCompoundingMode` read pattern (v2.1)
- ➕ Added: `backend/src/modules/awards/services/ag-bracket-calc.service.ts` — pure function AG calc + 2 modes (mutually_exclusive default + compounding opt-in)
- ➕ Added: `backend/src/modules/awards/services/age-computer.service.ts` — DOB → ageOnRaceDay compute (Option B isolation, no PII persist)
- ➕ Added: `backend/src/modules/awards/services/independent-ranking.service.ts` — 5BIB primary calc Path A
- ➕ Added: `backend/src/modules/awards/services/vendor-mismatch-detector.service.ts` — Pattern H VENDOR_MISMATCH cross-check (NEW v2)
- ➕ Added: `backend/src/modules/awards/services/anomaly-detector.service.ts` — 7 patterns A-G + Pattern H
- ➕ Added: `backend/src/modules/awards/services/podium-state-machine.service.ts` — 8-state forward-only enforce + APPEND-ONLY audit log (reuse F-018 incidentTransitions[] pattern)
- ➕ Added: `backend/src/modules/awards/services/predicted-rank.service.ts` — top-3 only display
- ➕ Added: `backend/src/modules/awards/services/podium-pdf.service.ts` — @napi-rs/canvas reuse F-013 pattern
- ➕ Added: `backend/src/modules/awards/services/normalize-vendor-quirks.service.ts` — whitespace trim guard (Giải Công An bug fix)
- ➕ Added: `backend/src/modules/awards/services/awards-auto-final.cron.ts` — auto-finalize cron
- ➕ Added: `backend/src/modules/awards/services/awards-sse.service.ts` — SSE for real-time admin updates
- ➕ Added: `backend/src/modules/awards/services/ag-eligibility-report.service.ts` — pre-race readiness report (NEW v2)
- ➕ Added: `backend/src/modules/awards/services/confidence-scorer.service.ts` — MAX-not-sum scoring per BR-D
- ➕ Added: `backend/src/modules/awards/schemas/podium.schema.ts` — `podiums` collection schema
- ➕ Added: `backend/src/modules/awards/schemas/anomaly-warning.schema.ts` — `anomaly_warnings` collection
- ➕ Added: `backend/src/modules/awards/dto/` — 7 DTOs: ag-config, ag-eligibility-response, anomaly-warning-response, pdf-export-options, podium-response, podium-state-update, predicted-rank-response
- ➕ Added: `backend/src/modules/awards/constants/` — ag-presets.ts (5 presets) + awards-thresholds.ts (confidence cutoffs 0.8/0.5)
- ➕ Added: `backend/src/modules/awards/__tests__/` — 8 spec files: ag-bracket-calc, age-computer, anomaly-detector, awards.integration, independent-ranking, podium-state-machine, predicted-rank, vendor-mismatch-detector

#### Backend — Cross-module modify
- ✏️ Modified: `backend/src/modules/app.module.ts` — register AwardsModule + TypeOrmModule platform DB cho `AthleteDobReadonly`
- ✏️ Modified: `backend/src/modules/race-master-data/entities/athlete-readonly.entity.ts` — thêm `dob` column readonly (Option B isolation, BR-03 strict allowlist preserved bằng entity riêng)
- ✏️ Modified: `backend/src/modules/race-master-data/schemas/race-athlete.schema.ts` — thêm `ageOnRaceDay: number | null` (computed value, no DOB raw)
- ✏️ Modified: `backend/src/modules/races/schemas/race.schema.ts` — thêm 5 fields: `awardsCompoundingMode` (race-level v2.1), `bracketSource` + `ageGroupPreset` + `ageGroupOverride` + `paceThresholdOverride` (course-level v2)
- ✏️ Modified: `backend/src/modules/races/dto/create-race.dto.ts` — `@ApiPropertyOptional + @IsIn` validators cho 2 fields config

#### Admin — Awards UI (NEW, full feature folder)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/awards/page.tsx` — orchestrator (replace F-008v2 placeholder)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/awards/components/AGPodiumGrid.tsx` + `AGPodiumCard.tsx`
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/awards/components/AGPresetPicker.tsx` — 5 preset radio + custom override modal
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/awards/components/AnomalyInbox.tsx` + `AnomalyWarningRow.tsx` + `AnomalyWarningsBanner.tsx`
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/awards/components/BracketSourceBanner.tsx` (v2)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/awards/components/CompoundingModeSelector.tsx` (NEW v2.1) — UI radio 2 modes + tooltip + warn text + PATCH integration với optimistic rollback
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/awards/components/ConfidenceScore.tsx` + `FilterBar.tsx`
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/awards/components/PodiumPdfExportButton.tsx` + `PodiumStateMachineControls.tsx` + `StateBadge.tsx` + `StateMachineTimeline.tsx`
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/awards/components/PredictedRankInline.tsx` + `PredictedRankList.tsx`
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/awards/hooks/` — 6 hooks: useAgPodium, useAnomalyWarnings, usePodiumPdfExport, usePodiumStateMachine, usePredictedRank, useRecompute
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/awards/awards-api.ts` + `awards.constant.ts` + `awards.microcopy.ts` + `awards.types.ts`
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/awards/awards.types.spec.ts` — runtime guard tests
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/awards/__tests__/` — 4 spec files: AGPodiumCard, AGPresetPicker, AnomalyInbox, useAnomalyWarnings (RTL specs deferred TD-F019-RTL-DEFERRED)

#### Admin — Readiness integration
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/readiness/components/AGEligibilityCard.tsx` — pre-race DOB readiness card
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/readiness/hooks/useAgEligibility.ts`
- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/readiness/page.tsx` — mount AGEligibilityCard

#### Admin — SDK regen
- ✏️ Modified: `admin/src/lib/api-generated/index.ts` + `sdk.gen.ts` + `types.gen.ts` — regen via `pnpm generate:api` (v2 + v2.1)

#### Admin — Test config
- ✏️ Modified: `admin/jest.kiosk.config.cjs` — extend testRegex cho awards/__tests__

#### Project context
- ✏️ Modified: `CLAUDE.md` — Redis Keys Registry +4 keys + S3 Lifecycle Rule 5 awards-pdf/

### Architecture impact

- **NEW module backend:** `awards/` full module — controller + 11 services + 2 schemas + 7 DTOs + 8 specs
- **Cross-module DI:** awards reads từ `race-master-data` (DOB → ageOnRaceDay) + `races` (compounding config + bracketSource) + `race-result` (chipTime ranking) + `timing-alert` (PHANTOM/MIDDLE_GAP heuristic)
- **NEW Redis keys:** 4 keys mới (`awards:race:*`, `awards:lock:*`, `awards:state-lock:*`, `awards:eligibility:*`)
- **NEW S3 prefix:** `awards-pdf/` với Lifecycle Rule 5 (NO expiration — legal audit trail)
- **NEW MongoDB collections:** `podiums` + `anomaly_warnings` với compound unique indexes
- **MODIFY MongoDB schemas:** `race.courses[]` +4 fields, `race` race-level +1 field (`awardsCompoundingMode`), `race_athletes` +1 field (`ageOnRaceDay`)
- **NO migration needed:** All optional fields với Mongoose lazy default, race cũ + podium cũ vẫn work

### Conventions impact (3 NEW conventions, đã update conventions.md)

1. **Independent calc + 2-layer verify** — pattern bắt buộc cho mọi metric phụ thuộc vendor (RaceResult, MyLaps, ...). Lý do: F-019 v1 trust vendor `Category` field 100% → UAT fail 100% races.
2. **PII compute-and-drop** — Option B isolation pattern. Compute derived value từ PII (DOB → age), persist CHỈ derived number (`ageOnRaceDay`), KHÔNG persist PII raw vào MongoDB. Giữ tinh thần BR-03 strict allowlist.
3. **VN amateur convention default** — `awardsCompoundingMode='mutually_exclusive'` default (top 3 overall EXCLUDED khỏi AG buckets). WA TR9 `'compounding'` chỉ kích hoạt khi race opt-in.

### DB / Cache impact

- **MongoDB NEW:** `podiums` collection (1 doc per race × course × AG × gender; 8-state machine + APPEND-ONLY stateHistory[]); `anomaly_warnings` collection (7 patterns + Pattern H, tier 1/2/3, confidence 0.0-1.0)
- **MongoDB MODIFY:** `race.awardsCompoundingMode` enum default `'mutually_exclusive'`; `race.courses[]` +4 fields v2; `race_athletes.ageOnRaceDay` number nullable
- **Redis:** 4 keys mới namespaced `awards:*` (60s TTL + SETNX locks)
- **S3:** Lifecycle Rule 5 — `awards-pdf/{raceId}/{courseId}/{ageGroup}_{gender}.pdf` NO expiration (legal trail)

### Tech debt còn lại (đã move sang known-issues.md)

- TD-F019-MULTITENANT (HIGH PRE-EXISTING từ F-018) — LogtoAdminGuard không enforce per-race tenant
- TD-F019-LOCK-KEY (MED) — compute lock key string literal `*` cho full-race recompute
- TD-F019-PERF-PERF-02 (MED) — race-day load test 5K athletes deferred
- TD-F019-V2-MYSQLLINK (MED) — chip_race_configs MySQL bridge legacy
- TD-F019-V2.1-PATTERN-H-CARDINALITY (MED) — VendorMismatchDetector worst-case 5K × 100 categories
- TD-F019-V2.1-INFO-LEAK (LOW NEW) — `awardsCompoundingMode` + `bracketSource` leak public API
- TD-F019-V2.1-NO-TOGGLE-LIVE-TEST (LOW NEW) — toggle 2 chiều cần Danny smoke
- TD-F019-V2-AGE-CRON-COVERAGE (LOW) — cron `EVERY_DAY_AT_MIDNIGHT` lazy populate first run
- TD-F019-V2.1-BRACKETSOURCE-PLACEMENT (LOW) — RaceCourse vs Race-level inconsistency
- TD-F019-V2.1-CACHE-INVALIDATE (LOW NEW) — updateRace không invalidate awards:eligibility
- TD-F019-V2.1-AUDIT (LOW NEW) — updateRace không có per-field audit
- TD-F019-V2-DB-COLUMN (LOW) — verify `dob` field name với 5sport DBA
- TD-F019-RTL-DEFERRED (LOW) — 4 admin RTL specs + CompoundingModeSelector chưa có RTL test

### Lessons learned

1. **Vendor field KHÔNG được trust làm source-of-truth.** F-019 v1 fail UAT 100% races vì Category whitespace/inconsistent. Convention "Independent calc + 2-layer verify" áp dụng cho ranking/AG/podium/awards/timing — bất cứ metric nào phụ thuộc vendor.
2. **Silent false negative tệ hơn visible bug.** v1 trả 200 OK + 0 podium → BTC tưởng OK đến race-day mới phát hiện. Block ship + revise tốt hơn ship workaround.
3. **Defer PII allowlist mở là rủi ro tích lũy.** TD-F019-DOB-WIRING flagged Phase 2 deferred → Phase 1 BLOCKING ngay khi có Path A primary. Option B isolation (compute-and-drop) giải quyết được mà giữ BR-03.
4. **VN amateur convention KHÁC WA TR9.** Top 3 overall không được tính top AG bucket (mỗi BIB chỉ 1 giải) — phải clarify trước race-day, không chỉ implement WA chuẩn quốc tế.
5. **Triple-safe backward compat:** Mongoose `default` + `??` fallback + lazy schema → race cũ + podium cũ vẫn work, không cần migration script.
6. **Reuse F-018 audit pattern:** `incidentTransitions[]` APPEND-ONLY → port verbatim sang `stateHistory[]`. Cluster #9 features sharing pattern accelerate cả 2.

---

## Format mỗi entry

```markdown
## [YYYY-MM-DD] FEATURE-XXX: [Title]

**PR/Commit:** [link nếu có]
**Type:** NEW_MODULE | EXTEND_EXISTING | BUGFIX | REFACTOR

### Files changed
- ➕ Added: `path/to/new-file.ts` — purpose
- ✏️ Modified: `path/to/existing.ts` — what changed
- ❌ Removed: `path/to/old.ts` — replaced by ...
- 🔄 Renamed: `old.ts` → `new.ts` — reason

### Architecture impact
[Có thay đổi flow/integration không?]

### Conventions impact
[Pattern mới được team confirm? → đã update conventions.md]

### DB / Cache impact
- MongoDB: [collection thay đổi, field thêm, index thêm]
- Redis: [key pattern mới, TTL thay đổi]
- S3: [prefix mới, lifecycle policy mới]

### Tech debt còn lại (đã move sang known-issues.md)
- [Cái gì chưa hoàn hảo, tại sao chưa fix]

### Lessons learned
- [Bài học cho feature kế tiếp đụng vùng này]
```

---

## Entries

## 2026-05-19 FEATURE-043: Reconciliation per-event fee rate override

**Branch:** `feat/F-043-reconciliation-fee-override` từ origin/main (post F-044+F-045 merge)
**Type:** EXTEND_EXISTING (Merchant + Finance + Reconciliation modules)

### Files changed
- ✏️ Modified: `backend/src/modules/merchant/schemas/merchant-config.schema.ts` (+~60 LoC) — Sub-schema `EventFeeOverride` + nested array field + compound index
- ✏️ Modified: `backend/src/modules/merchant/merchant.module.ts` — Register RaceReadonly in 'platform' connection
- ✏️ Modified: `backend/src/modules/merchant/merchant.service.ts` (+~280 LoC) — 4 CRUD methods + 3 helpers (validateRaceExists, logEventOverrideAudit, formatOverrideResponse, flushEventOverrideCache)
- ✏️ Modified: `backend/src/modules/merchant/merchant.controller.ts` — 4 NEW endpoints với full Swagger
- ✏️ Modified: `backend/src/modules/finance/services/fee.service.ts` — Tier 0 cascade lookup + feeSource enum return
- ✏️ Modified: `backend/src/modules/finance/dto/pnl-response.dto.ts` — Add feeSource field on SelfComputeSliceDto
- ✏️ Modified: `backend/src/modules/reconciliation/reconciliation.service.ts` — Preview cascade + fee_source + event_override_meta response
- ➕ Added: `backend/src/modules/merchant/dto/event-fee-override.dto.ts` — 3 DTOs (Create + Update Partial + Response)
- ➕ Added: `backend/src/modules/merchant/merchant.service.f043.spec.ts` — 13 tests (TC-43-01..06, 13-16)
- ➕ Added: `backend/src/modules/finance/services/fee.service.f043.spec.ts` — 7 tests (TC-43-08..12 + 2 bonus)
- ✏️ Modified: `admin/src/app/(dashboard)/merchants/[id]/page.tsx` — Import + inject EventFeeOverrideManager
- ➕ Added: `admin/src/app/(dashboard)/merchants/_components/event-fee-override-manager.tsx` (~450 LoC) — Full CRUD component với dialog + table + delete confirm

### Architecture impact
- No new module. Extends MerchantConfig schema + fee.service cascade + reconciliation preview.
- Cross-DB integration: MerchantModule reuses promo-hub RaceReadonly entity via `TypeOrmModule.forFeature([RaceReadonly], 'platform')`.

### Conventions impact
NEW pattern minted (add to conventions.md):
- **N-tier cascade resolution với feeSource enum attribution** — generic template cho future config/rate/preference cascade chains. Returns `{value, source: 'tier_0' | 'tier_1' | 'tier_2' | 'tier_3'}` cho UI badge rendering + audit trail.

### DB / Cache impact
- MongoDB: `merchant_configs.event_fee_overrides[]` nested array (lazy default `[]`, no migration). Compound index `{tenantId, event_fee_overrides.raceId}`.
- MySQL platform: no schema change (reuse existing `races` table read-only).
- Redis: NEW key `merchant:fee-overrides:<tenantId>` TTL 3600s + extends F-040 `pnl:*:tenant=*` flush pattern.

### Tech debt còn lại (moved to known-issues.md)
- TD-F043-CONCURRENT-POST-RACE (LOW) — Sequential test verify 409 enforce; real concurrent atomic test (Promise.all 10 calls) defer
- TD-F043-ADMIN-UI-BADGE (LOW) — Reconciliation preview UI badge `fee_source` render defer
- TD-F043-FE-CASCADE-LOGGER-TIER0 (LOW) — Tier 0 hit không log; only Tier 2/3 fallback log

### Lessons learned
1. **Cascade extension pattern reusable**: Inject new tier BEFORE existing tiers preserves backward compat + zero regression. Test với mocked config matrix giúp catch logic errors trước integration.
2. **Sub-schema `_id: false` clean**: Avoid `_id` leak trong response + simpler array operations.
3. **TypeORM cross-module entity sharing**: Re-import + register cùng entity trong nhiều modules via same connection token. Documented trong promo-hub + merchant.

## 2026-05-19 FEATURE-045: Contract DOCX Phase 3 — Legacy hardcoded bank account + provider name + taxId fix

**PR/Commit:** Same branch `feat/F-044-contract-docx-phase-2` extended (combined Option B với F-044), pending Danny push + release branch decision
**Type:** BUGFIX (MED severity multi-provider data leak risk)

### Files changed
- ✏️ Modified: `backend/scripts/audit-template-placeholders.ts` (+24 LoC)
  - Class 5: `\b110398986\b` + `\b111213998\b` exact-match bank account regex (F-030 values)
  - Class 6: bank branch + provider name 4 variants (CÔNG TY CỔ PHẦN 5BIB UPPER/proper/no-diacritic + CÔNG TY CỔ PHẦN CÔNG NGHỆ 5SOLUTION)
- ✏️ Modified: `backend/assets/contract-templates/acceptance-racekit.docx` — 10 replacements (5 provider + 2 bank acct + 2 branch + 1 service label BR-45-10 "vận hành racekit")
- ✏️ Modified: `backend/assets/contract-templates/acceptance-timing.docx` — 9 replacements (TIMING preserves "dịch vụ tính giờ" per BR-45-11)
- ✏️ Modified: `backend/assets/contract-templates/acceptance-operations.docx` — 13 replacements incl Adjustment #1 taxId `Mã số thuế: 0111213998` → `{provider.taxId}` + service label BR-45-09 "vận hành"
- ✏️ Modified: `backend/assets/contract-templates/contract-ticket-sales.docx` — 1 complex line rewrite (bank acct + branch + entity)
- ✏️ Modified: `backend/assets/contract-templates/contract-operations.docx` (Manager scope extension 2026-05-19) — 7 replacements (2 provider + 2 bank acct + 1 branch + 2 taxId)
- ➕ Added: 5 backup `.backup/<type>-20260519-pre-f045.docx`
- ➕ Added: `backend/src/modules/contracts/services/document-generator.service.f045.spec.ts` — TC-45-01..07 (multi-provider 5BIB + 5SOLUTION variants incl OVERRIDE scenarios) + TC-45-09/10 (F-042/F-044 regression)
- ➕ Added: `backend/src/modules/contracts/services/audit-script.f045.spec.ts` — TC-45-08 audit zero hardcoded per template + 6 regex source patterns verify
- ➕ Added: `backend/src/modules/contracts/services/f045-multi-provider-render-verify.spec.ts` — Manager content review tool: render 5 × 2 = 10 outputs to /tmp
- ➕ Added: `.5bib-workflow/features/FEATURE-045-contract-docx-phase-3-legacy-hardcoded-bank-provider/` (00-init + 01-prd + 02-plan + 03-impl + 04-qc + 05-deploy)

### Architecture impact
- ZERO change to service decomposition, ZERO new module
- F-045 = template binary fix + audit regex extension only

### Conventions impact
NEW patterns added to `conventions.md` (post-deploy update):
1. **Multi-provider DOCX render verify spec** — Asymmetric provider override scenarios MANDATORY for every template-affecting feature. Pattern: render N templates × 2 providers = 2N outputs to `/tmp/.../output/`. Manager eyeball read.
2. **Audit script Class 5+6 reusable regex set** — Class 5 bank account exact match (NOT generic `\d{9}`) + Class 6 bank branch + provider name 4 variants. Future feature classes extend Class 7+.
3. **XML run-split workarounds — 3 patterns** (3rd application):
   - Unique-suffix pattern (F-044 BUGFIX#1 `{advancePaid} VNĐ`)
   - Within-run `</w:t>` boundary (F-044/F-045 service label "về dịch vụ tính giờ</w:t>")
   - Drop-prefix when prefix in upstream run (F-045 contract-ticket-sales line)

### DB / Cache impact
- ❌ MongoDB: NO change
- ❌ MySQL platform: NO change
- ❌ Redis: NO change
- ❌ F-030 provider-entities.ts: NO change (registry unchanged)
- ✅ DOCX templates binary: 5 modify + 5 backup
- ✅ AWS S3: new DOCX uploads via existing flow

### Tech debt còn lại (moved to known-issues.md)
- TD-F045-PROD-AUDIT-REGEN-DEFERRED (MED) — Combined F-042+F-044+F-045 regen batch + Finance sign-off
- TD-F045-MULTI-VIEWER-VERIFY-DEFERRED (LOW) — MS Word + LibreOffice + Google Docs verify
- TD-F045-PYTHON-FIX-SCRIPT-NOT-COMMITTED (INFO) — `/tmp/docx-extract/fix_templates_f045.py`
- TD-F045-CONTRACT-OPERATIONS-ROW-FORMAT (LOW) — Trailing-space cosmetic
- ✅ RESOLVED: TD-F044-LEGACY-HARDCODED-BANK-PROVIDER (F-045 closes)
- ✏️ Extended: TD-F044-COMM-STRATEGY-PHASE2-COMBINED → covers F-042+F-044+F-045 single comm cycle

### Lessons learned
1. **Manager audit catches BA gaps** — Manager spot-check during Plan phase phát hiện `contract-operations.docx` cũng có 5SOLUTION hardcoded (out of BA inventory of 4 templates). Scope extended +1 template via Manager Adjustment without rewrite cycle.
2. **Order critical for regex with substring collision** — Adjustment #2: taxId `0111213998` contains bank `111213998` substring. Fix order: taxId regex FIRST (specific match `Mã số thuế: 0111213998`), then bank account regex (context-anchored `Tài khoản: 111213998`). Reverse order would collapse both fields into bankAccount placeholder.
3. **XML run-split is recurring issue** — 3rd application in template fixes (F-044 typo + F-044 service label + F-045 multiple positions). Establish 3 workaround patterns as conventions. Future template features should expect run-split + use within-run boundary patterns.
4. **Multi-provider override is critical test** — Default provider per contract type per BR-CM-01 hides bug. Override scenarios (RACEKIT + 5SOLUTION, OPERATIONS + 5BIB) expose latent hardcoded. TC-45-03/04 are non-negotiable for any template change.
5. **DOCX Content Review Protocol (F-044 lesson) WORKS** — F-045 demonstrates Manager render review caught contract-operations scope extension via render audit grep. Workflow validated.

## 2026-05-19 FEATURE-044: Contract DOCX Phase 2 — TEXT hardcoded fix + filename HYBRID + BUGFIX#1 số ≠ chữ

**PR/Commit:** Branch `feat/F-044-contract-docx-phase-2` (worktree `funny-kirch-90e777`), pending Danny decision on release branch strategy
**Type:** BUGFIX (HIGH severity legal/finance — follow-up F-042 missed TEXT scope)

### Files changed
- ✏️ Modified: `backend/src/modules/contracts/services/contracts.service.ts` (+14 LoC)
  - Line 1281-1289: flatten extension `remainingBalanceInWords: vndAmountInWords(contract.acceptanceReport.remainingBalance ?? 0)` (BR-44-05). vndAmountInWords(0)="Không đồng", null/undefined→''.
  - Line 1462-1471: `downloadDocument()` pass `contractNumber: c.contractNumber ?? null` + `raceName: c.raceName ?? null` to `buildDocumentFilename` (BR-44-12 HYBRID Option C trigger).
- ✏️ Modified: `backend/src/modules/contracts/utils/build-filename.ts` (+101 LoC)
  - Extended `BuildFilenameInput` interface với 2 new fields (BR-44-08/10/12)
  - Added `MAX_CONTRACT_NUMBER_LENGTH=80` + `MAX_RACE_NAME_LENGTH=80` constants + fallback labels `(chưa cấp số)` / `(chưa gắn sự kiện)`
  - Added `sanitizeContractNumber()` helper: `/` → `.` (filesystem safe), strip `\<>:|?*"` + control chars, collapse whitespace, truncate 80 + ellipsis (BR-44-09)
  - Added `sanitizeRaceName()` helper similar to `sanitizePartnerName` nhưng MAX=80 (BR-44-10)
  - HYBRID branch in `buildDocumentFilename`: activate when BOTH `contractNumber` + `raceName` truthy → `[CN sanitized] - [Race sanitized] - [DocType].ext`; else F-024 fallback preserved (backward compat Quotation/Pre-contract flows)
- ✏️ Modified: `backend/scripts/audit-template-placeholders.ts` (+37 LoC)
  - Extended HARDCODED_LEAK_PATTERNS với 4 pattern classes (BR-44-13): Class 1 legacy F-024 + Class 2 F-042 vi-VN currency + Class 3 F-044 CN slash format + Class 3 F-044 CN dash format + Class 4 F-044 VN amount-in-words sentence prefix
  - Extended CONTEXT_KEYS Set với 11 F-042 flatten keys + 1 F-044 NEW `remainingBalanceInWords` (BR-44-14) — closes TD-F042-TEMPLATE-PLACEHOLDER-STATIC-AUDIT
- ✏️ Modified: `backend/assets/contract-templates/contract-racekit.docx` — Mapping Table A: 1 CN `10.04/2026/HĐDV/TAM-5BIB` → `{contractNumber}` + 1 in-words → `{totalAmountInWords}` + BUGFIX#1 `{subtotal}` → `{totalAmount}` (1 occurrence) in "Tổng giá trị Hợp đồng (đã bao gồm 8% VAT)" — số 50M → 54M để khớp chữ "Năm mươi tư triệu"
- ✏️ Modified: `backend/assets/contract-templates/contract-operations.docx` — Mapping Table B: 1 in-words → `{totalAmountInWords}` + BUGFIX#1 `{subtotal}` → `{totalAmount}` (1 occurrence) — số 100M → 108M để khớp chữ "Một trăm lẻ tám triệu"
- ✏️ Modified: `backend/assets/contract-templates/contract-ticket-sales.docx` — Mapping Table C: 2 CN `25.02-HDDV-5BIB-TAM` + `17.01-HDDV-5BIB-VUD` → `{contractNumber}` (header + Phụ lục 1)
- ✏️ Modified: `backend/assets/contract-templates/acceptance-timing.docx` — Mapping Table D: 3 in-words `Tám mươi lăm triệu...` → `{remainingBalanceInWords}` (PRD says 2 but actual was 3 — `count=0` absorbs)
- ✏️ Modified: `backend/assets/contract-templates/acceptance-racekit.docx` — Mapping Table E + Adjustment #1 typo fix: 6 CN → `{contractNumber}` + 1 totalAmount in-words → `{totalAmountInWords}` + 3 remainingBalance in-words → `{remainingBalanceInWords}` + 3× `{advancePaid}` → `{remainingBalance}` in "còn lại" sentences (KEEP 1 `{advancePaid}` in "tạm ứng" line). Position #3 fix required unique-suffix `{advancePaid} VNĐ` workaround due to XML run split.
- ✏️ Modified: `backend/assets/contract-templates/acceptance-operations.docx` — Mapping Table F: 3 in-words `Một trăm ba mươi ba triệu...` → `{remainingBalanceInWords}`
- ✏️ Modified: `admin/src/lib/contracts-api.ts` (+60 LoC)
  - Added `parseFilenameFromContentDisposition()` helper with RFC 5987 `filename*=UTF-8''<encoded>` priority + plain `filename="..."` fallback + null final fallback. Wrapped `decodeURIComponent` in try/catch (malformed %ZZ falls through gracefully).
  - Refactored `streamDownloadBlob()` return type: `Promise<Blob>` → `Promise<{ blob: Blob; filename: string | null }>` (BR-44-11 + Adjustment #2). Parse header BEFORE `res.blob()` (blob consume closes stream).
- ✏️ Modified: `admin/src/app/(dashboard)/contracts/_components/document-download-btn.tsx:71-77` (4 LoC change)
  - Destructure `{ blob, filename }` from `streamDownloadBlob` return
  - `a.download = filename ?? <legacy fallback pattern>` — preserves backward compat khi backend không emit header
- ✏️ Modified: `backend/src/modules/contracts/services/document-generator.service.f042.spec.ts` (TC-42-03/04 assertion update post BUGFIX#1)
  - Updated assertion: assert `54.000.000` / `108.000.000` (totalAmount) thay vì `50.000.000` / `100.000.000` (subtotal) ở câu "Tổng giá trị (đã bao gồm 8% VAT)"
- ✏️ Modified: `admin/jest.kiosk.config.cjs` (+3 LoC) — testRegex extension include `contracts-api.f044.spec.ts` (CI test discovery cho admin F-044 spec)
- ➕ Added: `backend/src/modules/contracts/services/document-generator.service.f044.spec.ts` — TC-44-01..06 (DOCX render content per Mapping Tables A-F + asymmetric split verification for Adjustment #1)
- ➕ Added: `backend/src/modules/contracts/services/contracts.service.f044-context.spec.ts` — TC-44-12..15 (flatten extension + remainingBalance=0 edge + acceptanceReport null edge + 30/70 asymmetric split surfaces typo)
- ➕ Added: `backend/src/modules/contracts/services/audit-script.f044.spec.ts` — TC-44-10..11 (post-fix audit zero hardcoded per 4 pattern classes + CONTEXT_KEYS contains F-042 11 + F-044 1 flatten keys)
- ➕ Added: `backend/src/modules/contracts/utils/build-filename.f044.spec.ts` — TC-44-07..09 (HYBRID happy path + backward compat F-024 fallback + sanitize edge cases: slash/backslash/control chars/truncate/diacritics/whitespace)
- ➕ Added: `admin/src/lib/contracts-api.f044.spec.ts` — TC-44-16 (streamDownloadBlob returns `{blob, filename}` shape + RFC 5987 priority + plain fallback + null fallback + malformed encoding graceful)
- ➕ Added: `backend/src/modules/contracts/services/document-generator.service.f044-bugfix1.spec.ts` — 5 regression cases for BUGFIX#1 (số khớp chữ semantic match for contract-racekit + contract-operations + 1B+ scale + 2 regression guards `{subtotal}` placeholder gone)
- ➕ Added: `backend/src/modules/contracts/services/f044-manager-render-verify.spec.ts` — Manager content review one-shot tool: render 6 templates với realistic fixture + write `.txt` to /tmp for eyeball read
- ➕ Added: `backend/src/modules/contracts/services/f044-cn-coverage-verify.spec.ts` — 22 tests across 8 contract×doc combinations: contractNumber DB resolved + zero hardcoded sample + appears after "Số:" prefix
- ➕ Added: `backend/scripts/f044-render-verify.ts` — one-shot Manager ops script (optional, used during content review)
- ➕ Added: 6 backup files `.backup/<type>-20260519-pre-f044.docx` (per F-024 BACKUP_DIRNAME convention)
- ➕ Added: `.5bib-workflow/features/FEATURE-044-contract-docx-phase-2-text-hardcoded-fix/` workflow folder (00-init, 01-prd, 02-plan, 03-impl, 04-qc, 05-deploy, MANAGER-CONTENT-REVIEW.md)
- ➕ Added: `.5bib-workflow/features/FEATURE-045-contract-docx-phase-3-legacy-hardcoded-bank-provider/00-manager-init.md` — deferred follow-up cho legacy bank account + provider name hardcoded data trong 5 templates

### Architecture impact
- ZERO change to service decomposition, ZERO new module, ZERO API contract field change
- F-044 = pure template binary fix + minor service/utility extension + 1 frontend line + new helpers

### Conventions impact
NEW patterns added to `conventions.md`:
1. **HYBRID Option C filename pattern** — `[ContractNumber sanitized] - [RaceName sanitized] - [DocType].ext` with F-024 legacy fallback when either field missing. Activated only when BOTH inputs truthy. Sanitizers strip Windows-reserved chars + truncate 80 + ellipsis.
2. **RFC 5987 Content-Disposition filename parsing helper** — priority `filename*=UTF-8''<encoded>` (Unicode VN diacritics) → plain `filename="..."` → null. `decodeURIComponent` wrapped in try/catch for graceful degradation on malformed encoding.
3. **DOCX Template Content Review Protocol (F-044 lesson)** — for every feature touching templates: MUST have `*-manager-render-verify.spec.ts` rendering với realistic fixture (asymmetric splits + VAT non-zero + 1B+ scale + multi-provider). MANDATORY Manager eyeball read output `.txt` files. Every "số + Bằng chữ" pair must have dedicated unit test verifying `vndAmountInWords(X) === <chữ rendered>`. Automation gates không catch semantic inconsistency — Manager render-and-eyeball is final defense for legal/finance documents.

### DB / Cache impact
- ❌ MongoDB: no schema change, no migration
- ❌ MySQL platform: no change
- ❌ Redis: no key pattern change
- ✅ AWS S3: new DOCX renders upload (existing flow), old buggy versions preserved via 5y retention
- ✅ DOCX templates binary: 6 modified + 6 backup `.backup/<type>-20260519-pre-f044.docx`

### Tech debt còn lại (moved to known-issues.md)
- TD-F044-MULTI-VIEWER-VERIFY-DEFERRED (MED) — Manual MS Word + LibreOffice + Google Docs verify post-deploy
- TD-F044-CONTENT-DISPOSITION-NETWORK-VERIFY (LOW) — Real browser Network tab end-to-end (unit tests cover parsing logic)
- TD-F044-RFC5987-CROSS-BROWSER (LOW) — Safari + Firefox + Edge verify VN diacritics
- TD-F044-PROD-AUDIT-REGEN-DEFERRED (MED) — Combined F-042+F-044 regen batch on PROD (Danny + Finance sign-off mandatory)
- **TD-F044-COMM-STRATEGY-PHASE2-COMBINED (HIGH business)** — Finance team chốt re-send strategy trong 1 tuần
- TD-F044-AUDIT-AGGREGATE-FIRST-MATCH-ONLY (INFO) — Audit script uses non-global `text.match()` → only first match per regex. Doesn't affect zero-gate semantics. Future: `matchAll()`.
- TD-F044-PYTHON-FIX-SCRIPT-NOT-COMMITTED (INFO) — `/tmp/docx-extract/fix_templates_f044.py` + `/tmp/f044-bugfix1.py` per F-042 ops convention
- → F-045 INITIATED — legacy hardcoded bank/provider data trong 5 templates (acceptance-racekit, acceptance-timing, acceptance-operations, contract-ticket-sales bank account 110398986 + branch Thụy Khuê / Hai Bà Trưng + provider name CÔNG TY CỔ PHẦN 5BIB)
- ✅ RESOLVED: TD-F042-TEMPLATE-PLACEHOLDER-STATIC-AUDIT — F-044 closes via BR-44-13/14 (audit script extended regex + CONTEXT_KEYS sync)

### Lessons learned
1. **Manager render-and-eyeball IS THE FINAL GATE for legal/finance DOCX** — 238 tests PASS + audit zero hardcoded + QC ✅ APPROVED initial — NHƯNG render with realistic fixture phát hiện bug #1 (số `50M` ≠ chữ `Năm mươi tư triệu`). Automation `assertDocxContains(['50.000.000'])` không assert "số bên cạnh chữ phải khớp".
2. **F-042 latent bugs amplified by F-044** — F-042 `{subtotal}` mapping at "đã bao gồm VAT" position semantically incorrect (should be `{totalAmount}`). Bug hidden because F-042 fixture had `subtotal ≈ totalAmount` AND in-words was still hardcoded sample. F-044 added `{totalAmountInWords}` exposing inconsistency. → Future template work: render with realistic + asymmetric data, KHÔNG dùng symmetric/round-number fixture.
3. **XML run split workaround** — Word splits text across `<w:r>` runs unpredictably. Context-aware prefix regex `(prefix)\{placeholder\}` may fail if prefix and placeholder cross run boundary. Workaround: unique-suffix pattern (verify uniqueness via grep first). Used in Adjustment #1 position #3 fix.
4. **PRD count discrepancy benign with `count=0`** — PRD Mapping Tables D/E/F said 2 in-words occurrences but actual XML had 3. `re.subn(..., count=0)` replaces all → no fix needed. Coder didn't need to escalate.
5. **3 Critical Adjustments from Manager Code Review post BA PRD valuable** — BA missed (1) 3× typo vs 1, (2) streamDownloadBlob impl detail (Option 1 invalid). Manager spot-check pre-APPROVED Plan caught both → no NEEDS_REVISION cycle.

## 2026-05-08 ROLLBACK FEATURE-015: Check-In Kiosk SCRAPPED — duplicate of ORG.5bib.com

**Reason:** Strategic Scout failed to discover existing pickup module on ORG.5bib.com (Vietnamese organizer admin platform — separate codebase from 5bib-result). F-015 shipped 50 files of duplicate functionality. Danny called it out: "cái phát bib là bên ORG.5bib.com có r mày làm làm gì thừa ra".

**Type:** ROLLBACK (surgical — F-013/F-014/F-017 preserved)

### Files removed
- ❌ `admin/src/app/(dashboard)/races/[id]/check-in-kiosk/` (22 files: page + 13 components + 4 hooks + 3 modules + 1 test folder)
- ❌ `backend/src/modules/race-result/check-in/` (8 files: controller + service + sse-service + module + log schema + 2 DTO + spec)
- ❌ `backend/migrations/2026-05-08-add-check-in-window.ts` (PAUSED migration, never ran)

### Files modified (revert F-015 changes)
- ✏️ `admin/src/components/race-ops-shell/RaceTabsNav.tsx` — removed tab #10 "Check-In", removed `checkInPickupRate` dot logic. Back to 9 tabs (post F-008v2).
- ✏️ `backend/src/modules/app.module.ts` — removed `CheckInModule` import + register
- ✏️ `admin/jest.kiosk.config.cjs` — removed `|checkin` from testRegex (kept F-013 kiosk + F-017 result-display-config)
- ✏️ `backend/src/modules/races/schemas/race.schema.ts:135-142` — `checkInWindow` field LEFT in schema (Danny option B "least impact, no migration") + added DEPRECATED comment header

### Files KEPT (still in use)
- ✅ `admin/src/lib/kiosk/` shared hooks (useFullscreen / useKioskIdle / useKioskSound / kiosk.constant / types / index) — used by F-013 Result Kiosk + F-017 chip scan
- ✅ `@zxing/browser@0.2.0` package — F-017 may use for QR scan Phase 2
- ✅ Conventions minted by F-015 — KEPT in conventions.md (multi-station SSE pattern, Redis SETNX two-tier guard, etc. — reusable for future features)
- ✅ SDK regen — re-run, swagger no longer has check-in routes, sdk.gen.ts clean

### Architecture impact
- Race Ops shell back to 9 tabs (was 10 since F-015)
- `check_in_logs` MongoDB collection: orphaned, no writers/readers (left in DB, no migration)
- Redis keys `checkin:lock:*` + `checkin:race:*:stats`: orphaned, will TTL-expire naturally
- NestJS SSE pattern documented (still valid as reusable convention from F-005 origin)

### Tech debt status changes
- TD-F005-01 (`racekit_received = 0` placeholder F-005 dashboard-snapshot) — **REVERTED to OPEN**. Was claimed RESOLVED by F-015, but ORG.5bib.com is actual source of truth. 5bib-result needs to READ this field from ORG-managed data, not write. Future feature: sync `racekit_received` from ORG → 5bib-result MongoDB.
- TD-F015-01..09 — all RETIRED with feature scrap (no longer relevant). KEEP as historical reference in known-issues.md "Retired TD" section.

### Lessons learned (CRITICAL)
1. **Strategic Scout MUST scope ALL 5Solution platforms** — not just current repo. 5bib + ORG + 5sport + 5pix + 5tech all coexist. Failure to research full ecosystem = duplicate feature waste. **Process change:** Scout prompt must explicitly require check of ORG.5bib.com / 5sport.vn / 5pix / 5tech before proposing new features.
2. **chip-verification overlap WAS already flagged in init** but Danny chose option B (new standalone) — the deeper miss was overlap with ORG.5bib.com (different platform), not chip-verification (same repo).
3. **Surgical rollback pattern works** — F-013/F-014/F-017 preserved, only F-015 deleted. Process: delete files → revert specific imports/registers → KEEP shared libs that other features use → leave orphan schema fields if no migration easier → SDK regen → verify build/tests.
4. **Don't fall in love with cluster theme** — "Race-Day Chaos Killer" cluster #9 was Strategic Scout's framing. When #1 invalidated, don't force #2/#3/#4 to fill — re-evaluate ecosystem fit.

---

## [2026-05-08] FEATURE-016: Reconciliation Include GROUP_BUY + GROUP_BUY_FIXED + CODE_TRANSFER — v1.6.5 PATCH (Phase 1 of 2)

**PR/Commit:** `d4b66a3` on `main` → `release/v1.6.5` (CI `deploy-production.yml` auto-deploy PROD)
**Type:** BUGFIX (CRITICAL Financial)
**Status:** 🟠 v1.6.5 SHIPPED, v1.7.0 PENDING (feature KHÔNG close — Phase 2 recompute migration chờ Danny UAT v1.6.5 PROD)

### Why
Race 117 Cat Tien Jungle Paths April 2026 — recon `69f9488ab13b71f5c5f970ec` thiếu **10,366,400 VND** vs manual employee calculation. Root cause: `FIVE_BIB_CATEGORIES` whitelist trong `reconciliation-query.service.ts` chỉ có 3/6 enum values:
- ✅ Có: `ORDINARY`, `PERSONAL_GROUP`, `CHANGE_COURSE`
- ❌ Thiếu: `GROUP_BUY`, `GROUP_BUY_FIXED`, `CODE_TRANSFER`

Prod-verified scope: **613 đơn 5BIB-eligible bị silent drop** (82 GROUP_BUY + 517 GROUP_BUY_FIXED + 14 CODE_TRANSFER) khỏi mọi reconciliation đã chạy trước F-016. 15 reconciliations cũ shipped với data sai (TD-F016-FINANCE-01 BLOCKER).

### Files changed (v1.6.5 scope — 4 files = 3 modify + 1 new spec)
- ✏️ Modified: `backend/src/modules/reconciliation/services/reconciliation-query.service.ts`
  - Line 6: extend `FIVE_BIB_CATEGORIES` từ 3 → 6 enum values (`Set<string>` thay `Array`)
  - Line 11-15: NEW `SPLIT_BY_PAYMENT_REF` Set (4 categories áp split rule)
  - Line 17-22: NEW `QueryOrdersResult` interface với `unknownCategoryCount: number` additive field
  - Refactor: tách private `categorize()` method single-pass loop với defensive null/unknown guard
  - Logger.warn structured (NestJS Logger, KHÔNG console.log) khi `unknownRows.length > 0`
- ✏️ Modified: `backend/src/modules/reconciliation/services/reconciliation-preflight.service.ts`
  - Destructure `unknownCategoryCount` từ queryService result
  - Emit warning `UNKNOWN_CATEGORY_DROPPED` severity ERROR trong cả `run()` + `runRange()` paths
  - Inline string literal cho warning type (KHÔNG có file `preflight-flag.types.ts` — Plan giả định sai về file structure, Coder fix correctly)
- ➕ Added: `backend/src/modules/reconciliation/services/reconciliation-query.service.spec.ts` — NEW 18 unit tests
  - 15 PRD baseline tests cover BR-02/BR-03/BR-04 (categorization rules)
  - 3 extra defensive tests (null/'CORPORATE'/mixed dirty data)
  - TC-CAT-01 race 117 fixture: gross 32,962,400 = 22,596,000 ORDINARY + 10,366,400 GROUP_BUY ✓
- ✏️ Modified: `backend/src/modules/reconciliation/services/reconciliation-preflight.service.spec.ts`
  - +4 QC adversarial tests (TC-QC-PRE-01..04): warning emit / suppress / dirty-data race-rỗng / backward-compat undefined field

### KHÔNG đụng (out of Scope Lock — verified)
- ❌ `reconciliation-calc.service.ts` — line 76+90 hardcode `'CHANGE_COURSE' ? a : 'ORDINARY'`. GROUP_BUY/GROUP_BUY_FIXED/CODE_TRANSFER tự rơi vào nhánh default → label `'ORDINARY'` đúng theo BR-05 (gộp). Compatible without modify.
- ❌ `analytics.service.ts` — line 173-205 dùng `order_category != 'MANUAL'` negation, đếm GMV ĐÚNG đã. Discrepancy với recon cũ là cố hữu — TD-F016-FINANCE-01.
- ❌ `reconciliation.cron.ts` — fix tự lan tỏa qua query.service shared.
- ❌ `batch-export.service.ts` — KHÔNG đụng (filename + render đã đúng từ F-003).
- ❌ MySQL platform schema — read-only.

### Architecture impact
- KHÔNG đổi flow / integration. Backend internal logic patch only.
- `QueryOrdersResult` interface thêm 1 additive field (`unknownCategoryCount`) — backward-compat verified TC-QC-PRE-04.

### Conventions impact (1 NEW pattern minted)
- ✅ **Defensive enum guard với Set lookup + structured Logger.warn** (đã append vào `conventions.md`):
  - `Set<string>` O(1) lookup thay `Array.includes` O(n)
  - 2-tier categorization (whitelist + sub-rule)
  - Defensive guard 2 lớp (`typeof !== 'string'` + `!Set.has()`)
  - Backward-compat additive return field
  - Caller emit downstream warning severity `ERROR` (financial integrity)

### DB / Cache / S3 impact
- ZERO schema migration (v1.6.5 PATCH chỉ fix forward).
- ZERO Redis key change.
- ZERO S3 change.
- ⚠️ 15 reconciliations cũ vẫn có data sai trong MongoDB cho tới khi v1.7.0 recompute migration chạy.

### Tests written
- `reconciliation-query.service.spec.ts`: 18 NEW tests (PASS)
- `reconciliation-preflight.service.spec.ts`: +4 NEW tests (PASS)
- Tổng v1.6.5: 22/22 NEW PASS
- Regression: 106/106 reconciliation domain PASS, 0 break F-003+F-004 behavior

### Tech debt added
- 🚨 **TD-F016-FINANCE-01 BLOCKER** (Critical): 15 recon cũ shipped sai data — accounting cần biết trước v1.7.0 recompute migration
- TD-F016-01: Phase 2 v1.7.0 PENDING (recompute service + audit endpoint + admin UI)
- TD-F016-02: `reconciliation-calc.service.ts` không có unit test verify pattern label `'ORDINARY'` cho GROUP_BUY*/CODE_TRANSFER
- TD-F016-03: `PreflightFlag.type` inline string literal — future hardening tạo enum file riêng
- TD-F016-04: Vendor enum future-proof alerting (Datadog/Sentry wire khi có infra)
- TD-F016-05: Spec backward-compat caller pattern (object destructure subset safe, spread không safe)

### Deploy
- 2026-05-08: commit `d4b66a3` on `main` → push → DEV auto-deploy via GitHub Actions
- 2026-05-08: branch `release/v1.6.5` created from main HEAD → push → PROD auto-deploy via `deploy-production.yml`
- ⏳ Pending: Danny UAT trên `result-admin.5bib.com` (run preflight cho race 117 Cat Tien April 2026 → verify gross 32,962,400 thay vì 22,596,000)
- ⏳ Pending: Phase 2 v1.7.0 (separate workflow gate) — Coder resume sau Danny UAT pass

### Lessons learned
1. **Hardcoded enum whitelist là silent-drop trap** — F-016 root cause là 3/6 categories thiếu, KHÔNG có defensive guard nên 613 đơn drop silently suốt 15 reconciliations. Pattern "defensive enum guard + emit count" giờ là default cho mọi vendor enum read.
2. **Analytics vs reconciliation duplicate logic** — analytics dùng `!= 'MANUAL'` (negation, an toàn future-proof) trong khi recon hardcode whitelist (positive list, dễ silent drop). Đây là code smell — consolidate sau khi có time refactor.
3. **Workflow simplification từ Danny insight** — BR-08 ban đầu phức tạp (force override gate + signed gate + version conflict) nhưng Danny confirm "chưa gửi recon nào cho BTC" → simplify thành "ALLOW recompute mọi status". Saved ~30% Coder + QC effort. Lesson: hỏi business reality trước khi over-engineer technical solution.
4. **2-release split (PATCH then MINOR)** — v1.6.5 PATCH ship code fix 24h (ngừng bleed), v1.7.0 MINOR sau với recompute migration + admin UI. KHÔNG ship cùng release vì recompute migration cần Danny UAT cẩn thận trên PROD trước khi chạy mass migration.
5. **Manager Scope Lock cứu khỏi contamination** — package.json + pnpm-lock có deps GIS từ FEATURE-006 work khác leak vào working tree. Manager phát hiện trước commit → `git restore` exclude khỏi v1.6.5 release. Lesson: ALWAYS verify `git diff` vs Scope Lock trước commit, đặc biệt khi worktree shared với feature khác.

---

## 2026-05-08 FEATURE-015: Check-In Kiosk standalone (BIB pickup)

**PR/Commit:** branch `5bib_racemonitor_v1` (Race Ops Cluster #9 #1 — uncommitted, Danny option C "commit hết một cục" pending)
**Type:** NEW_MODULE
**Branch:** `5bib_racemonitor_v1` (KHÔNG merge main per cluster policy)

### Files changed

- ➕ Added: `admin/src/app/(dashboard)/races/[id]/check-in-kiosk/` (22 files: page.tsx + 13 components + 4 hooks + 3 modules + 1 test folder)
- ➕ Added: `admin/src/lib/kiosk/` (6 files: `useFullscreen.ts` / `useKioskIdle.ts` / `useKioskSound.ts` / `kiosk.constant.ts` / `types.ts` / `index.ts`) — NEW shared lib pattern; F-013 retrofit deferred TD-F015-01
- ➕ Added: `backend/src/modules/race-result/check-in.controller.ts`, `check-in.service.ts`, `check-in-sse.service.ts`, `check-in.module.ts`, `check-in-log.schema.ts`, `dto/check-in.dto.ts`, `dto/check-in-stats.dto.ts`, `check-in.service.spec.ts`
- ➕ Added: `backend/migrations/2026-05-08-add-check-in-window.ts` (idempotent dry-run mode; PAUSED awaiting Danny prod sign-off — TD-F015-03)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/check-in-kiosk/checkin.types.spec.ts` (executable runtime guard — 23 cases EXECUTED PASS)
- ➕ Added: 11 deferred Jest+RTL specs with `@ts-nocheck` F-013/F-014 pattern (`useAthleteLookup.spec.ts` / `useCheckInMutation.spec.ts` / `useStationSync.spec.ts` / `useQRScanner.spec.ts` / `MultiInputLookup.spec.tsx` / `AthleteCheckInCard.spec.tsx` / `ConfirmPickupButton.spec.tsx` / `CMNDLastFourInput.spec.tsx` / `useFullscreen.spec.ts` / `useKioskIdle.spec.ts` / `useKioskSound.spec.ts`)
- ✏️ Modified: `admin/jest.kiosk.config.cjs` — extend testRegex to match `checkin.types.spec.ts` (regression-safe; F-013 `kiosk.types.spec.ts` 14 cases preserved)
- ✏️ Modified: `backend/src/app.module.ts` — register `CheckInModule`
- ✏️ Modified: `backend/src/modules/races/schemas/race.schema.ts` — add `checkInWindow: { start: Date, end: Date }` field (optional, sparse — default null until migration runs)
- ✏️ Modified: `admin/src/components/race-ops-shell/RaceTabsNav.tsx` — add tab #10 "Check-In Kiosk"
- ➕ NPM install: `@zxing/browser@0.2.0` (pinned, peer deps verified <50KB)
- 📦 SDK regen: `admin/src/lib/api-generated/sdk.gen.ts` (auto-regen via `pnpm --filter admin generate:api`)

### Architecture impact

- NEW shared admin kiosk lib at `admin/src/lib/kiosk/` (Option 3 — generalized hooks for cross-feature reuse). Second consumer of `admin/src/lib/` shared root (F-014 `deriveAthleteStatus.ts` first). F-013 retrofit candidate TD-F015-01.
- NEW SSE pattern formalized in race-result module — multi-station realtime sync via NestJS `@Sse()` decorator + RxJS Subject + 25s heartbeat (mirrors F-005 timing-alert SSE pattern; per-race filter via Subject filter)
- NEW: Multi-station race condition mitigation — Redis SETNX `checkin:lock:{raceId}:{bib}` 5s TTL distributed lock + atomic `findOneAndUpdate({raceId, bib, racekit_received: false})` two-tier guard. SETNX returns 0 → 409 `CHECKIN_LOCK_HELD`; matchedCount=0 + athlete exists → 409 `CHECKIN_ALREADY_PICKED_UP`.
- NEW: `check_in_logs` MongoDB collection — audit trail for BIB pickup events (PII boundary: ObjectId only, NO CMND/name stored). Index `{ raceId: 1, checkedInAt: -1 }`.
- NEW: Race Ops 10-tab shell (was 9 since F-008v2; F-015 makes it 10). Tab precedent: overflow-later policy (option A — refactor "More" dropdown when shell exceeds 12 tabs).
- chip-verification module boundary preserved — F-015 zero imports verified by grep audit (BR-CK-20). Module overlap (chip-verification = chip↔BIB tech check; check-in-kiosk = BIB pickup workflow) without coupling.
- TD-F005-01 RESOLVED — `racekit_received` field now actually written to MongoDB by F-015 atomic mutation (was placeholder always-0 in F-005 dashboard-snapshot, lived ~3 weeks).

### Conventions impact

5 NEW patterns minted:

1. **Shared admin lib pattern at `admin/src/lib/`** — first established by F-014 `lib/deriveAthleteStatus.ts`; F-015 expands with `lib/kiosk/` sub-folder. Convention: cross-feature shared utilities live here, NOT in feature folders.
2. **Multi-station SSE realtime sync via `@Sse()` decorator + RxJS Subject** — broadcast pattern for multi-tablet kiosks. Reusable for future Volunteer Hub, Medical Incident realtime features.
3. **Redis SETNX distributed lock + MongoDB atomic update (two-tier guard)** — prevents race condition in multi-client mutation. Pattern: SETNX returns 0 → 409 conflict; findOneAndUpdate condition mismatch → null result → 409 conflict.
4. **CMND PII boundary** — last-4-digit visual match by BTC, NEVER stored. Schema audits MUST verify no PII fields written. Anchored regex `^[0-9]{4}$` validation.
5. **F-013 hook extraction to shared lib (Option 3)** — generalize hook (drop "Kiosk" prefix from name when extracting), F-013 retrofit deferred to import-swap pass.

Reused: F-013 BR-AF-23 verbatim port mandate (F-015 hook port — accepted with TD as not strictly byte-for-byte due to renaming, logic equivalence preserved per Manager plan Option 3 approval), F-013 runtime guard pattern, F-013 multi-input + tap target standards, F-013 idle reset + Web Audio sound, F-013 fullscreen API user-gesture trigger, F-014 9-status enum reuse pattern, F-014 dirty form/save indicator pattern.

### DB / Cache impact

- MongoDB: NEW collection `check_in_logs` (raceId, bib, athleteId, checkedInAt, checkedInBy, stationId, source: qr/bib/cmnd, syncStatus). Index: `{ raceId: 1, checkedInAt: -1 }` for query. NO PII (ObjectId only).
- MongoDB: race schema add field `checkInWindow: { start: Date, end: Date }` (sparse — default null until migration runs)
- MySQL platform: NO change
- Redis: NEW keys `checkin:lock:{raceId}:{bib}` (SETNX 5s TTL — distributed lock) + `checkin:race:{raceId}:stats` (60s TTL — aggregate cache)
- AWS S3: NO change

### Tech debt remaining (moved to known-issues.md)

- TD-F015-01: F-013 result-kiosk hooks not yet retrofitted to use shared lib (1-line `import { useFullscreen } from '@/lib/kiosk'` swap × 3 files; convenience, not blocking)
- TD-F015-02: 11 deferred Jest+RTL specs (admin RTL stack TD-F013-TESTSTACK still open; bundle install in next cluster feature recommended)
- TD-F015-03: Migration `2026-05-08-add-check-in-window.ts` PAUSED awaiting Danny prod sign-off + staging run
- TD-F015-04: Offline mode (IndexedDB queue + SSE reconnect) deferred to Phase 2 — Phase 1 ships "online required" banner
- TD-F015-05: Bulk pickup (đoàn merchant) deferred to Phase 2
- TD-F015-06: Backend `assertWindowOpen()` server-side enforcement (currently no-op, frontend-enforced)
- TD-F015-07: Per-volunteer auth (waits for Volunteer Hub Cluster #9 #2) — F-015 uses shared BTC admin login MVP
- TD-F015-08: Per-item kit checklist (T-shirt size, drop bag, etc.) deferred to Phase 2 — Phase 1 single boolean racekit_received
- TD-F015-09: Load test 50 concurrent check-in per minute × 10 min — pre-deploy operational gate, NOT yet executed (PAUSED for staging environment)

### Lessons learned

- **Coder agent crash mid-task recovery pattern proved viable** — finisher Coder picked up where prior Coder stopped (50% files), wrote remaining 30% (tests + DTOs + migration + RaceTabsNav) + 03 doc. Lesson: when API errors interrupt agent, file inventory + resume mode work; don't restart from scratch.
- **Worktree path discipline matters** — F-015 Coder initially confused main-repo (`release/v1.6.4`) vs worktree (`5bib_racemonitor_v1`). Lesson: every Coder/QC prompt MUST include explicit worktree path + `cd` instructions to prevent branch confusion.
- **F-013 hook extraction Option 3 (generalized shared lib) succeeded over Option 1 (path-import)** — name change required (`useKioskFullscreen` → `useFullscreen`) but logic equivalence preserved. Future cross-feature kiosk patterns benefit. F-013 retrofit deferred (TD) acceptable trade-off.
- **TD-F005-01 placeholder finally RESOLVED** — `racekit_received` field actually written to MongoDB by F-015 atomic mutation. Cluster #4 placeholder lived ~3 weeks; pattern: always track placeholder TDs to closure feature.
- **chip-verification boundary discipline worked** — explicit BR-CK-20 grep audit + Coder + QC both verified zero matches. Lesson: when 2 modules cover overlapping problem domain (chip-verification = chip↔BIB tech check; check-in-kiosk = BIB pickup workflow), explicit boundary BR + grep audit prevents accidental coupling.
- **Multi-station race condition design pattern**: Redis SETNX + MongoDB atomic findOneAndUpdate two-tier guard is reusable for any feature where multiple admin clients can mutate same resource. Future candidates: Volunteer Hub assignment conflicts, Medical Incident dispatch, etc.
- **Race Ops 10-tab precedent set** (was 9 since F-008v2). Tab overflow-later policy (option A) accepted; refactor "More" dropdown when shell exceeds 12 tabs.

---

## 2026-05-08 FEATURE-014: Athletes tab + Settings full redesign

**PR/Commit:** branch `5bib_racemonitor_v1` (Race Ops Cluster #8 feature #2 — uncommitted, Danny option C "commit hết một cục" pending)
**Type:** NEW_MODULE + REFACTOR
**Branch:** `5bib_racemonitor_v1` (KHÔNG merge main per cluster policy)
**Trigger:** F-007 placeholder REPLACE (athletes) + 1692-LOC legacy settings editor REFACTOR — sectioned IA + 6 sections + 9-status admin roster, Race Ops Cluster #8 second feature

### Files changed

- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/athletes/page.tsx` — replaced F-007 41 LOC placeholder with orchestrator (race meta fetch + AthletesTabBody compose)
- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/settings/page.tsx` — REWRITE 1692 LOC → 268 LOC composer; orchestrates 6 sections + header + dirty map; verbatim editForm seeding mirrors legacy lines 269–295 per BR-AF-23
- ➕ Added: `admin/src/lib/deriveAthleteStatus.ts` — NEW Option C client-derive 9-status function (REG/PICKED/DNS/LIVE/FIN/DNF/CUT/DSQ/MED) with editHistory[] precedence (manual override always wins). FIRST FILE in `admin/src/lib/` shared lib root. PascalCase + lowercase vendor field tolerance; vendor sentinels rejected (`'-'`/`'00:00:00'`/`'0'`); DSQ via 3 paths; DNF via 3 paths; DNS gated on `raceStatus === 'ended'`; MED + CUT manual-only per Race Ops Expert advisory §2
- ➕ Added: `admin/.../athletes/athletes.constant.ts` — 9-status enum, STATUS_TONES (WCAG AA contrast), VIEW_LABELS, BULK_ACTION_CAP=500, debounce=300ms, reason min=10/max=500, REASON_REQUIRED_STATUSES=['DSQ','DNF','CUT','MED']
- ➕ Added: `admin/.../athletes/athletes.microcopy.ts` — scope-local VN strings (F-013 pattern reused)
- ➕ Added: `admin/.../athletes/athletes.types.ts` — AthleteRow + AthleteWithStatus + AthleteFilters + runtime guards (`isAthletesListEnvelope`, `isAthleteRow` — F-013 pattern reused)
- ➕ Added: 9 athletes components — `StatusBadge.tsx` (9-status renderer + pulse on LIVE) / `AthleteRow.tsx` (5 quick actions + selection checkbox) / `AthletesTable.tsx` (paginated 50/page + priority-sort) / `AthletesFilterBar.tsx` (search + view-toggle + status chips + course pills + dropdowns + reset) / `BulkActionBar.tsx` (sticky-bottom F-014.5 placeholder per BR-AS-18 — disabled buttons + tooltip "Endpoint chưa sẵn sàng — F-014.5") / `AthleteEditDrawer.tsx` (shadcn Sheet 480px desktop / fullscreen mobile + edit/profile tabs) / `AthleteProfileDrawer.tsx` (thin wrapper opening merged drawer in profile mode) / `ChangeStatusDialog.tsx` (status-change with reason validation BR-AS-03 ≥10 chars for DSQ/DNF/CUT/MED) / `AuditLogTimeline.tsx` (editHistory[] reader, last 5 entries chronologically reverse) / `AthletesEmptyState.tsx` (3 variants: zero-data/zero-match/draft-guard) / `AthletesTabBody.tsx` (orchestrator pulling all hooks + components)
- ➕ Added: 5 athletes hooks — `useAthletesList.ts` (TanStack Query paginated + post-fetch derivation + client-side filter compose, query key `['athletes', raceId, { q, statuses, courseIds, gender, ag, paid, view, page }]`) / `useAthleteFilters.ts` (URL-synced filter/view/page state via useSearchParams, validates against constant arrays — unknown values filtered out) / `useAthletesSearch.ts` (300ms debounce + flush + cleanup) / `useAthletesBulkActions.ts` (selection state + 500-cap + deferred mutation placeholder, ZERO backend calls) / `useAthletesExport.ts` (CSV blob with legacy header + 3 F-014 columns appended + BOM `﻿`)
- ➕ Added: 8 athletes specs — `__tests__/deriveAthleteStatus.spec.ts` (20 cases EXECUTED 20/20 PASS) + 7 deferred (useAthletesSearch/useAthleteFilters/useAthletesBulkActions/StatusBadge/AthletesFilterBar/ChangeStatusDialog/BR-AF-23-audit) — well-formed Jest+RTL with `@ts-nocheck` header per F-013 pattern; activation = 1-line `testRegex` flip
- ➕ Added: `admin/.../settings/SettingsLayout.tsx` — sticky left rail (desktop, lg≥1024px) / horizontal scroll (mobile) + dirty dot indicator per nav item driven by `useDirtyFormPerSection.dirtyMap`; collapses responsively
- ➕ Added: `admin/.../settings/hooks/useDirtyFormPerSection.ts` — per-section dirty map (BR-AS-28); no autosave block, no leave-confirm
- ➕ Added: `admin/.../settings/hooks/useUrlHashScroll.ts` — deep-link `#section-id` + IntersectionObserver active highlight (BR-AS-25/26); respects `prefers-reduced-motion`
- ➕ Added: `admin/.../settings/sections/section-shared.types.ts` — Race / Course / Sponsor / EditForm / SECTION_IDS shared types
- ➕ Added: 6 section composers — `RaceMetaSection/` (12 fields verbatim port + LifecycleStepper sub-component 4-button forward-only stepper + history list + OverrideStatusDialog reason ≥10 chars + audit log call) / `CourseSection/` (9 fields verbatim port + F-009 link card re-import + 7-action CourseTable sub-component CSV/sync/reset/clone/edit/delete + add + loading state) / `TimingSection/` (hosts F-008v2 link cards + F-010 form re-imported nesting F-012 ×3 hints internally) / `PublishingSection/` (8 fields + 2 conditional reveals `pixEventUrl` iff `enable5pix` + `privateListLimit` iff `enablePrivateList`) / `IntegrationsSection/` (1 field `cacheTtlSeconds` MOVED here per BR-AS-39 + cross-link to Course) / `AdvancedSection/` (composes BrandingForm 5 image upload composites + brand color picker + sponsor banners + SponsorsTable race-sponsor CRUD + SponsorDialog 6-field form with Select cleanup proper SelectContent children + RaceCertificateConfigPanel)
- ➕ Added: 2 settings specs — `__tests__/useDirtyFormPerSection.spec.ts` (6 cases) + `useUrlHashScroll.spec.ts` (4 cases) — DEFERRED with `@ts-nocheck`
- ✅ PRESERVED untouched (verified ZERO diff via `git diff --stat HEAD -- "settings/components/"`): `TimingDetectionConfigSection.tsx` (349 LOC F-010), `TimingFormulaTooltipContent.tsx` (132 LOC F-012), `TimingPresetComparisonTable.tsx` (191 LOC F-012), `TimingPresetRationalePanel.tsx` (107 LOC F-012), `timing-presets.constant.ts` (56 LOC F-012). Plus F-008v2 `SettingsLinkCardsSection.tsx` + F-009 `CourseMapFullpageLinkCard.tsx` re-imported source untouched.
- 📦 NO backend modification (Option C frontend-only — `backend/**` ZERO touched)
- 📦 NO SDK regen (`admin/src/lib/api-generated/types.gen.ts` ZERO touched — no `pnpm generate:api`)
- 📦 NO `RaceTabsNav.tsx` change (race-ops shell tabs untouched)
- 📦 NO `globals.css` change (F-013 cluster owned)
- 📦 NO `result-kiosk/`, `chip-verification/` change

### Architecture impact

- NEW: client-derive status pattern at `admin/src/lib/deriveAthleteStatus.ts` — 9-status enum (REG/PICKED/DNS/LIVE/FIN/DNF/CUT/DSQ/MED) derived from existing race-result fields + `editHistory[]` subdoc. Status persists via existing `editHistory[]` PATCH `adminControllerEditResult` (server-side append actor + timestamp). ZERO schema migration.
- NEW: `admin/src/lib/` admin shared lib root established (single file currently — `deriveAthleteStatus.ts` — first feature to use this pattern in admin). Future shared admin utilities adopt same root.
- NEW: settings sectioned-scroll IA pattern with sticky left nav + hash deep-link + IntersectionObserver active highlight + reduced-motion respect — first applied to settings (>40 fields); reusable for future settings/admin pages with high field count. URL preserved (no migration); HTML5 hash anchor `#section-id` enables bookmark + section discovery.
- NEW: `editHistory[]` subdoc reuse pattern for audit trail (DSQ/DNF/CUT/MED status changes) — alternative to dedicated audit-log module per Manager Option A. AuditLogTimeline read-only display (last 5 entries reverse chronological).
- NEW: 6-section IA established (Race Meta / Course / Timing / Publishing / Integrations / Advanced). Formula & Fees DROPPED per audit empty (BR-AS-54). `cacheTtlSeconds` MOVED to Integrations per BR-AS-39.
- F-011 status-aware guard pattern reused on both tabs (Athletes draft-guard + Settings LifecycleStepper forward-only + Timing/Publishing race.status guards).
- F-005..F-012 stack components RE-IMPORTED into refactored TimingSection / CourseSection ZERO diff (BR-AS-31..35 stack reroute mandate honored).
- Race Ops 9-tab navigation occupies athletes (slot 7) + settings (slot 9) tabs without modifying RaceTabsNav (RaceTabsNav.tsx mtime 2026-05-07 unchanged).

### Conventions impact

5 NEW patterns minted:
1. **Client-derive status with editHistory precedence** (Option C) — 9-status enum mapped from `dnf`/`dnsChipFail`/`finishTime`/`editHistory[]`; manual override in editHistory takes precedence over vendor signal. Race Ops Expert 9-status standard (REG/PICKED/DNS/LIVE/FIN/DNF/CUT/DSQ/MED). MED + CUT manual-only (no vendor signal). PascalCase + lowercase vendor field tolerance. Vendor sentinels (`'-'`, `'00:00:00'`, `'0'`) rejected — falls through to LIVE/REG instead of FIN.
2. **Sectioned-scroll IA with sticky left nav + hash deep-link** — for settings/admin pages with >40 fields. URL preserved (no migration). HTML5 hash anchor `#section-id` enables bookmark + section discovery. IntersectionObserver active highlight + reduced-motion respect.
3. **Per-section save state with chấm cam dirty indicator** (preserves existing 4 per-tab save buttons from legacy — BR-AS-42). No autosave block, no leave-confirm — admin trust philosophy.
4. **Side drawer for edit + profile** (preserves list context — alternative to modal/inline). shadcn Sheet 480px desktop / fullscreen mobile. Drawer state machine `mode: 'edit'\|'profile'\|'closed'` prevents two drawers stacking.
5. **Server-side pagination with URL-synced filters** (50/page + load-more, debounce 300ms search + flush). useSearchParams validates against constant arrays — unknown values filtered out. `router.replace` keeps history clean (no back-button pollution). Page resets to 1 on filter change.

Reused: F-013 runtime guard pattern (BR-RK-11 `isXxxResponse(x): x is XxxResponse`), F-013 BR-AF-23 verbatim port mandate (9th successful port through cluster), F-011 status-aware guard pattern, F-012 shared-constant module pattern, F-013 scope-local microcopy module pattern, F-013 `@ts-nocheck` deferred-spec header.

### DB / Cache impact

- MongoDB: NO change (Option C frontend-only — defer status field schema migration to FEATURE-016+)
- MySQL platform: NO change (project doesn't use MySQL anyway)
- Redis: NO change (no new keys; existing endpoints + caches reused)
- AWS S3: NO change

### Tech debt remaining (moved to known-issues.md)

- **TD-F014-01** (Medium): Bulk action UI placeholder until F-014.5 backend bulk-action endpoint ships (`POST /api/admin/races/:id/athletes/bulk-action`). UI ships disabled buttons + tooltip "Endpoint chưa sẵn sàng — F-014.5" satisfying BR-AS-18.
- **TD-F014-02** (Low): Status derivation duplication (F-013 5-status `deriveKioskStatus` + F-014 9-status `deriveAthleteStatus`) — refactor to shared util when backend `status` field added to race-result schema.
- **TD-F014-03** (Low): 9-10 deferred specs awaiting RTL stack install — TD-F013-TESTSTACK linked. Activation = 1-line `testRegex` flip.
- **TD-F014-04** (Medium): Search diacritics-folding unverified at fixture level (Vietnamese queries "Nguyen" → "Nguyễn") — depends on backend MongoDB collation `locale='vi'`. MUST run real-world VN query test against staging 2K-athlete fixture before deploy claims green.
- **TD-F014-05** (Low): Settings page.tsx 268 LOC vs Manager target ~200 — verbatim editForm seeding per BR-AF-23 demand (legacy lines 269–295). Could extract to `useRaceEditForm()` hook in follow-up. Acceptable cosmetic.
- **TD-F014-06** (Low): Contact action (`onContact` callback in AthleteRow) is toast stub — Mailchimp/SMS deferred Phase 2 (F-014.5).
- **TD-F014-07** (Low, NEW QC raised): Offline banner not implemented in Athletes tab — PRD §State table mentions; out of MVP scope. Defer F-015 rich profile cluster.
- **TD-F014-08** (Medium, NEW QC raised): Excel `.xlsx` export per BR-AS-19 currently CSV-only — `useAthletesExport.ts` outputs CSV blob; BR-AS-19 says "Excel MVP, CSV optional". F-014 ships reverse: CSV ships, Excel deferred. Not a regression (legacy was CSV); just mis-labeled in PRD vs implementation. F-014.5 should add `.xlsx` writer OR BA re-LOCK CSV-only.

### Lessons learned

- (1) **Option C client-derive pattern proven viable for status enum without schema migration** — saves 1 cluster of work; trade-off (status logic duplicate F-013/F-014, refactor when schema ready) acceptable. When backend `status` field lands, refactor to single shared util — pattern documented for migration trigger.
- (2) **Manager pre-flight FALSE FLAG on tab count** — BA initial claim "actual = 8" was wrong (actual = 9 per F-008v2). Lesson: verify with `git show HEAD:path` + actual array count, not memory grep. Pre-flight MUST trace authoritative source (component file) not assertion in another doc.
- (3) **F-013 working-tree-only state caused confusion** — Coder + QC needed to verify F-013 paths exist in working tree (yes) before importing. Lesson: when worktree pattern in play, document branch state explicitly in init (which features are committed vs uncommitted in working tree).
- (4) **1692 LOC settings refactor doable in 1 cluster feature** when (a) BR-AF-23 audit checklist is THE planning artifact (PAUSE-AS-02 field map saved 6+ ambiguous decisions — single pre-flight artifact pays back many over implementation), (b) preserve untouched components verbatim (5 components ZERO diff via re-import), (c) client-derive avoids backend rework (Option C frontend-only).
- (5) **BR-AF-23 audit programmatic spec + spot-check is reliable** — Manager + QC both verified 64/64 fields + 7/7 stack pieces present without missing. Programmatic source-grep test asserting all field state-paths/tokens present + independent manual concat-grep on random spot-check sample (24/64 fields verified) catches regressions a typed code review would miss.
- (6) **Manager Option B placeholder pattern (disabled UI + tooltip naming next-feature gate)** reusable for any "backend gap blocks UI feature" scenario — UI ships, BE follows in dot-release (F-014 ships UI; F-014.5 ships backend bulk endpoint). Tooltip wording "Endpoint chưa sẵn sàng — F-014.5" sets expectation explicitly.
- (7) **Side drawer for edit + profile** (single drawer with `mode='edit' | 'profile' | 'closed'` state machine) preserves list context better than modal/inline form for high-frequency edit flows. Pattern reusable for other admin entity-edit pages.

## 2026-05-08 FEATURE-013: Result Kiosk standalone (BTC tent BIB lookup)

**PR/Commit:** branch `5bib_racemonitor_v1` (Race Ops Cluster #8 OPENS — first feature)
**Type:** NEW_MODULE + EXTEND_EXISTING
**Branch:** `5bib_racemonitor_v1` (KHÔNG merge main per cluster policy)
**Trigger:** F-007 placeholder REPLACE — race-day BTC tent BIB lookup surface for athlete result self-service, opens Race Ops Cluster #8

### Files changed

- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/result-kiosk/page.tsx` — replaced F-007 PlaceholderPage stub with `KioskTabBody` orchestrator (admin shell surface 1 + KioskModeProvider state machine + race-title fetch + status-aware empty state for `draft` race per BR-RK-07)
- ✏️ Modified: `admin/src/app/globals.css` — APPEND +8 LOC `body[data-fullscreen="true"] { overflow:hidden; height:100vh }` containment rule (NEW reusable fullscreen primitive — F-011 race-ops shell will adopt later; pre-existing F-008v2 + F-011 `body[data-fullscreen]` rules untouched; ≤20 LOC mandate honored)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/components/KioskModeProvider.tsx` — `'use client'` React Context state machine `{ mode, bib, result, soundEnabled, idleSeconds, enterKiosk(), exitKiosk(), submitBib(), reset() }` + 4 hook composition; pure transition methods, DOM-free, independently testable
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/components/BibNumberPad.tsx` — 4×3 touchscreen grid pad (digits + Clear + Backspace) ≥80×80px buttons, `tabIndex=0` + `onKeyDown` capturing 0-9/Backspace/Delete/Enter for bluetooth-keyboard fallback, `touchAction: manipulation` instant tap feedback, `active:scale-95` <100ms visual feedback (BR-RK-01)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/components/KioskResultCard.tsx` — 5-status renderer (FIN/DNS/DNF/DSQ/LIVE) + **BR-AF-23 verbatim port** of `parseSplitsFromData` byte-for-byte from `frontend/app/(main)/races/[slug]/[bib]/page.tsx::178-256` (drift = drop unused `CheckpointConfig[]` arg + `services` field). DSQ public reason rendered HTML-stripped via `/<[^>]*>/g` regex; never reads `dsqInternalNote`/`editHistory`/`isManuallyEdited`/`_id` (BR-RK-05 client allowlist + server strip double defense). aria-live polite region announces `ariaLine` (US-RK-05). `motion-reduce:animate-none` honored (BR-RK-13 `prefers-reduced-motion`)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/components/KioskIdleOverlay.tsx` — last-10s countdown overlay, dismissible by tap (BR-RK-06)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/components/KioskExitButton.tsx` — magenta-bordered "Thoát Kiosk" button ≥60×60px touch target
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/components/KioskTabBody.tsx` — Surface 1 admin shell (PageHero + settings card + status-aware empty state for `draft` race + "Bật chế độ Kiosk" CTA — single user-gesture activation point for both Web Audio AudioContext + native Fullscreen API, BR-RK-07)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/components/KioskBibInputScreen.tsx` — Surface 2 wrapper (race line + sound toggle + BIB readout + pad + Submit + Exit)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/components/KioskResultScreen.tsx` — Surface 3 wrapper (KioskResultCard + "Tìm BIB khác" + idle 60s integration + 5s not-found auto-reset + aria-live region)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/hooks/useKioskFullscreen.ts` — F-013 OWNS `body[data-fullscreen="true"]` primitive: toggles attribute + Escape keydown listener + cleanup + native `requestFullscreen()` best-effort (user gesture required — anchored at `enterKiosk` click handler)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/hooks/useKioskIdle.ts` — 60s idle timer + last-10s countdown emission + activity reset on touch/mouse/keyboard + cleanup (BR-RK-06)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/hooks/useKioskSound.ts` — Web Audio API beep success 800Hz/100ms + error 300Hz×2/200ms gap, lazy AudioContext under user gesture, localStorage `5bib:kiosk-sound` boolean-only persist (no JSON parse, no prototype pollution surface), graceful no-op when AudioContext unavailable (SSR/locked iframe)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/hooks/useResultLookup.ts` — TanStack `useMutation` wrapping SDK `raceResultControllerGetAthleteDetail({ raceId, bib })` + `isAthleteDetailResponse` runtime guard + outcome discriminated union (`found | not-found | network-error | data-error`) (BR-RK-09 + BR-RK-11 boundary)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/kiosk.constant.ts` — single source of truth: `BIB_MAX_LEN=6`, `IDLE_MS=60000`, `IDLE_COUNTDOWN_MS=10000`, `NOT_FOUND_AUTO_RESET_MS=5000`, beep specs, `TAP_TARGET_MIN_PX=60`, `DIGIT_BUTTON_PX=80`, `LS_KEY_SOUND='5bib:kiosk-sound'` (per F-012 shared-constant pattern)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/kiosk.microcopy.ts` — scope-local Vietnamese strings (Phase 1 PAUSE-RK-09 default; F-013 OWNS, NOT shared — minted as new pattern alternative to shared `vn-microcopy.ts` which doesn't exist on branch)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/kiosk.types.ts` — `AthleteDetailEnvelope`/`AthleteDetailData` interfaces built from OBSERVED `backend/src/modules/race-result/race-result.controller.ts:139-155` response shape `{ data: PublicAthleteData | null, success: boolean, message?: string }` + `isAthleteDetailResponse(x): x is AthleteDetailEnvelope` runtime guard (BR-RK-11) validates object + success:boolean + data ∈ {null, plain object} + bib type + JSON-string field types + tolerates extras + `deriveKioskStatus(data): 'FIN'|'DNS'|'DNF'|'DSQ'|'LIVE'|null` derivation + `FORBIDDEN_INTERNAL_KEYS` constant
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/__tests__/kiosk.types.spec.ts` — **20/20 PASS executed** (BR-RK-11 `isAthleteDetailResponse` 13 cases + `deriveKioskStatus` 7 cases). Most security-critical rule covered.
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/__tests__/useKioskIdle.spec.ts` — Jest+RTL 6 cases (timer / activity reset / countdown emit / cleanup / disabled / manual reset). **DEFERRED** via Manager STOP #5 (NO npm install — admin lacks RTL stack); 1-line `testRegex` flip activates when test stack added.
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/__tests__/useKioskSound.spec.ts` — Jest+RTL 7 cases (default ON / persistence / 800Hz success / 300Hz×2 error / disabled / AudioContext unavailable / toggle round-trip). DEFERRED.
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/__tests__/BibNumberPad.spec.tsx` — Jest+RTL 9 cases (digits / max-6 cap / clear / backspace / submit / kbd fallback). DEFERRED.
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/__tests__/KioskResultCard.spec.tsx` — Jest+RTL 6 cases (FIN renders chip+gun+ranks; DNS hides times BR-RK-03; DNF shows last CP BR-RK-04; **DSQ shows public reason but NEVER internal note BR-RK-05** — asserts `container.textContent` does not contain "Đối thủ tố cáo"/"fixed bib"; LIVE partial BR-RK-08; parser edge). DEFERRED.
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/result-kiosk/__tests__/KioskIdleOverlay.spec.tsx` — Jest+RTL 5 cases (render / null / decrement / dismiss / motion-reduce). DEFERRED.
- ➕ Added: `admin/jest.kiosk.config.cjs` (helper, NOT in scope-lock count) — minimal Jest config running `kiosk.types.spec.ts` via `backend/node_modules/.bin/jest` + ts-jest reuse (NO npm install needed); `testRegex: '.*kiosk\\.types\\.spec\\.ts$'` — 1-line flip to `result-kiosk/.*\\.spec\\.(ts|tsx)$` activates all 33 deferred tests when admin gains RTL stack.

### Architecture impact

- **NEW: `body[data-fullscreen="true"]` CSS primitive** — first kiosk-mode/fullscreen pattern in admin shell with explicit containment (`overflow:hidden + height:100vh`). Future features (F-011 race ops shell, others) can adopt this primitive instead of reinventing. Pre-existing F-008v2 + F-011 `body[data-fullscreen]` rules (admin shell hide via `[data-admin-sidebar]`/`[data-admin-topbar]` + race-ops shell `[data-race-ops-shell-header]` translateY) preserved verbatim — F-013 EXTENDS the primitive scoped to truthy attribute value.
- **NEW: scope-local microcopy module pattern** (`kiosk.microcopy.ts`) — alternative to shared `vn-microcopy.ts` (which doesn't exist on branch). Each feature owns its strings under feature folder; promote to shared if 3+ features need same string.
- **NEW: SDK unknown-response runtime guard pattern** (`isAthleteDetailResponse(x): x is AthleteDetailEnvelope` in `kiosk.types.ts`) — first feature to defensively type-check SDK output where backend marks return type `unknown` in generated SDK. Throws/rejects malformed → caller renders `data-error` UI variant.
- **Reuse `getAthleteDetail` endpoint** — F-013 is consume-only on backend (BR-RK-09); no new endpoint, no DTO modify, no SDK regen. Existing `master:athlete:*` Redis cache reused via F-005-era cache hit path — likely meets <1s p95 BIB→result perf target.

### Conventions impact

- ➕ New pattern: **Scope-local microcopy module** — for features with rich Vietnamese strings. Feature owns its strings under feature folder. Promote to shared if 3+ features need same string. F-013 mints `kiosk.microcopy.ts`. Reusable for any future feature with VN-locale rich strings.
- ➕ New pattern: **SDK unknown-response runtime guard** — when generated SDK function returns `unknown`, write `isXxxResponse(x): x is XxxResponse` guard validating shape (object + null/object data + scalar field types) before render. Reject malformed → throw → caller renders error UI variant. Tolerates extras for forward-compat. F-013 mints `isAthleteDetailResponse` (20/20 unit tests PASS).
- ➕ New pattern: **Web Audio + Fullscreen activation co-location** — both APIs require user gesture in call stack; co-locate activation at single trigger button to satisfy both browser policies. F-013 anchors at `KioskTabBody` "Bật chế độ Kiosk" click → `KioskModeProvider.enterKiosk()` calls `sound.ensureAudioContext()` + `fullscreen.enterFullscreen()` synchronously inside handler. Both APIs swallow errors silently — fallback to soft state (DOM attribute fullscreen + audio-disabled beep no-ops) keeps surface usable if browser blocks one.
- ✅ Reused: BR-AF-23 verbatim port mandate (8th successful port through cluster — frontend `[bib]/page.tsx::parseSplitsFromData` byte-for-byte to admin `KioskResultCard`; single-import-fix drift = drop unused `CheckpointConfig` arg + `services` field).
- ✅ Reused: F-012 shared-constant module pattern (`kiosk.constant.ts` as single source of truth for timeouts/sizes/keys).

### DB / Cache impact

- MongoDB: **NO change** — no schema modify, no new collection, no new index.
- MySQL platform: **NO change**.
- Redis: **NO change** — reuses existing `master:athlete:*` keys via existing `getAthleteDetail` cache hit path (F-005-era cache).
- AWS S3: **NO change** — no upload, no lifecycle change.

### Tech debt còn lại (đã move sang known-issues.md)

- **TD-F013-TESTSTACK** (medium) — admin lacks `@testing-library/react` + `jest-environment-jsdom` + `@types/jest` + `ts-jest`; 5 F-013 specs cannot execute today. Install requires Manager approval (Manager STOP #5 forbids `npm install` in F-013 scope). 1-line `testRegex` flip when test stack added activates all 33 tests.
- **TD-F013-RL** (low) — BIB enumeration rate limit absent on `getAthleteDetail` endpoint. Pre-existing F-005-era endpoint risk; low actual impact (BIB are public race numbers). Future hardening: `@Throttle({ default: { limit: 30, ttl: 60_000 } })`.
- **TD-F013-SUBMITHEIGHT** (trivial) — submit button minHeight=60px (`TAP_TARGET_MIN_PX`) instead of PRD-aspirational 80px. Width far exceeds 120 via `w-full`. Trivial CSS bump on next polish pass.
- **TD-F013-IDLE-WIRING** (low) — 60s idle auto-reset and 5s not-found auto-reset wiring not directly executed-tested by QC (claimed in Coder §3, spec for `useKioskIdle` deferred per TESTSTACK). Bundle with TESTSTACK fix.
- **TD-F013-TABLET-UAT** (medium ⚠️ MUST-DO) — real iPad 10.9" + Android 10" tablet manual UAT not executed (Coder checklist last 2 boxes unchecked). Block kiosk activation on production until UAT signoff.
- **TD-F013-CERT-PRINT** (Phase 2) — cert print/PDF/email flow deferred per PAUSE-RK-04. Phase 2 separate feature post-BTC field-test feedback.
- **TD-F013-EN-LANG** (Phase 2) — EN language toggle deferred per PAUSE-RK-09. Phase 2 with full i18n module (next-i18next or react-i18next).
- **TD-F013-MULTI-BIB** (Phase 2) — multi-BIB compare deferred per PAUSE-RK-06. Phase 2 separate surface.

### Lessons learned

- **Manager pre-flight branch check critical:** F-011 fullscreen claim was phantom in PRD R1 (BA assumed `body[data-fullscreen="true"]` rule not yet on branch). Caught at /5bib-plan via Manager `git ls-tree`. BA patched in R2 (P1). Lesson: Manager MUST `git ls-tree` target branch before approving "REUSE F-XXX pattern" claims in PRD.
- **PRD must cite SDK function from actual `sdk.gen.ts` line number, not memory:** BA initially named function `raceResultControllerFindAthleteByBib` (wrong) — actual is `raceResultControllerGetAthleteDetail` at sdk.gen.ts:878. Caught at /5bib-plan. Patched in R2 P3a. Lesson: PRD R1 → Manager spot-check SDK references against actual `sdk.gen.ts` before approving.
- **"NO npm install" Manager STOP forces creative solution:** Coder deferred 5 specs to TD instead of breaking scope discipline (would have required adding `@testing-library/react` + 3 other devDeps). QC accepted as judgment call. Trade-off scope discipline vs test coverage acceptable when 1 critical spec (BR-RK-11 runtime guard, the highest-security rule) executes 20/20 + 5 specs static-reviewed sound.
- **8th successful BR-AF-23 verbatim port through cluster:** pattern is now battle-tested. Single import drift (drop unused `CheckpointConfig` arg + drop unused `services` field) is the only acceptable delta. Kiosk port byte-for-byte from `frontend/[bib]/page.tsx::parseSplitsFromData::178-256`. Future cluster features should treat BR-AF-23 verbatim port as the default approach for reusing frontend logic in admin (preserves vendor edge cases handled in legacy code).

---

## [2026-05-07] FEATURE-012: TimingDetectionConfigSection UX Hints & Formula Explanation (Race Ops Cluster #7 — hints CLOSED)

**PR/Commit:** pending — code in worktree branch `5bib_racemonitor_v1`, push when Danny ready
**Type:** EXTEND_EXISTING (presentation layer only — UI hints/explanation surfaces ABOVE F-010 form, ZERO backend modify, ZERO schema modify, ZERO API contract change)
**Branch:** `5bib_racemonitor_v1` (KHÔNG merge main per cluster policy)
**Trigger:** Post-F-010 deploy + BTC UAT screenshot feedback "BTC khó hiểu vì sao Trail paceBuffer 1.35 vs Road 1.10" → init hints feature small-scope ship trong 1 sprint
**QC history:** Round 1 REJECTED 2 P0 BLOCKERs + 4 MINORs → Round 2 APPROVED via root-cause shared module pattern (10/10 BR-FH verified)

### Files changed (5 total — Round 2 final Scope Lock)

**Admin frontend NEW (4 — 1 shared module + 3 components):**
- ➕ `admin/src/app/(dashboard)/races/[id]/settings/components/timing-presets.constant.ts` (56 LOC) — single source of truth `TIMING_PRESETS: Record<CourseType, TimingPreset>` + `PRESET_LABELS_VI` + `CourseType` literal union (`'ROAD' | 'TRAIL' | 'ULTRA'`). Imported by both form section + comparison table → prevents cross-component data drift (root-cause fix for QC Round 1 BLOCKER #2). Values verbatim PRD BR-FH-06: ROAD `1.10/0.80/30/0.20`, TRAIL `1.35/0.45/60/0.15`, ULTRA `1.50/0.40/120/0.10`.
- ➕ `TimingFormulaTooltipContent.tsx` (132 LOC, Round 1 127 → Round 2 132) — Surface 1: 4 inline tooltips (BR-FH-01..04) with custom click-to-toggle popover (no shadcn Tooltip in repo per PAUSE-FH-01) + 3-layer content (formula `<code>` + VN explanation + 1 example) + a11y triple (aria-expanded `:80-95` + Escape keydown listener `:105` + outside-click). Round 2 reconfirmed verbatim PRD content for all 4 BR-FH-01..04 + ROAD example for BR-FH-04 confidence multiplier per task spec.
- ➕ `TimingPresetComparisonTable.tsx` (191 LOC, Round 1 154 → Round 2 191) — Surface 2: 4 rows × 3 cols comparison table + 2 footer rows + current preset column highlight ring. Round 2 imports values from shared `timing-presets.constant.ts` (zero drift); legend footnote `:178-185` carries "Danny chốt" provenance + citation "Nguồn giá trị: F-010 expert review consolidated (Race Operation Expert + Sports Domain Expert)" verbatim PRD.
- ➕ `TimingPresetRationalePanel.tsx` (107 LOC, Round 1 63 → Round 2 107 REWRITE) — Surface 3: "Tại sao preset này?" expandable panel rendering ALL 3 paragraphs (ROAD/TRAIL/ULTRA) when open via `PRESET_ORDER.map(...)` unconditional iteration `:63`. Current preset highlighted via `border-l-4 border-amber-500 bg-amber-50/70` accent `:70` + `(đang chọn)` annotation `:84 ml-1.5 text-[10px] text-amber-700`. Trigger ALWAYS visible (no `null` short-circuit, no early return) `:50`. Citation footer verbatim PRD `:99-102 "Nguồn: Race Ops Expert + Sports Domain Expert F-010 advisory (2026-05-07)"`. Icons per PRD UI mockup `:25-29 🛣️ ROAD / 🥾 TRAIL / 🏔️ ULTRA`.

**Admin frontend MODIFY (1):**
- ✏️ `TimingDetectionConfigSection.tsx` (363 → 349 LOC, -14 net) — DEDUPED inline `TIMING_PRESETS` constants → `import { TIMING_PRESETS, PRESET_LABELS_VI, CourseType } from './timing-presets.constant'` `:42-46`. Wired 4 tooltip triggers (BR-FH-01..04 next to each `<Input>`) + comparison table block + rationale panel block. **F-010 form behavior preserved BYTE-FOR-BYTE:** `applyPreset()`, `updateField()`, `handleSave()`, `validateRange()`, save mutation `timingAlertAdminControllerUpsertConfig`, 4 `<Input>` IDs/onChange — all UNCHANGED. Call site `:120 const values = TIMING_PRESETS[preset]` byte-identical (only source moved to shared module).

**Total diff:** 5 files, ~580 LOC net (Round 2 added shared module 56 LOC + grew Surface 3 by +44 LOC for 3-paragraph rewrite + grew Surface 2 by +37 LOC for footnote/legend).

### Architecture impact

- **Settings tab additive multi-feature composition CONTINUED** — F-012 hints additions render INSIDE `TimingDetectionConfigSection` (NOT a new link card slot). Multi-feature composition pattern reaffirmed: F-008 v2 `SettingsLinkCardsSection` + F-009 `CourseMapFullpageLinkCard` + F-010 `TimingDetectionConfigSection` + F-012 hints (3 surfaces inside that section) all coexist additively above legacy 1678-line settings/page.tsx editor. Settings parent `settings/page.tsx` PRESERVED byte-for-byte (BR-AF-23) by F-012 — ZERO line touch.
- **Shared constant module pattern NEW** — `timing-presets.constant.ts` extracts `TIMING_PRESETS` from inline `TimingDetectionConfigSection.tsx` to dedicated module imported by ≥2 consumers (form + comparison table). Single source of truth prevents cross-component data drift forever. Future cluster features touching same data → import from same module.
- **Custom click-to-toggle popover pattern NEW** — when shadcn `<Tooltip>` not in repo + NO new npm install policy strict, custom implementation acceptable IF a11y triple (aria-expanded + Escape keydown listener + outside-click) covered. Pattern reusable cho future inline hint surfaces.

### Conventions impact

3 NEW patterns minted (added to `conventions.md`):

1. **Inline tooltip surface pattern (F-012 BR-FH-01..05)** — `<Info />` icon + custom click-to-toggle popover + 3-layer content (formula `<code>` + VN explanation + 1 example) + a11y triple (aria-expanded + Escape + outside-click). Reusable cho any inline hint UI.
2. **Multi-paragraph rationale với current selection highlight pattern (F-012 BR-FH-07)** — render ALL options always (no conditional skip), highlight current via accent border-left + bg + annotation. Citation footer with expert advisory references. Reusable cho any "compare options side-by-side" UI.
3. **Shared constant module to prevent cross-component data drift pattern (F-012 BR-FH-09 root-cause via TD-F012-02)** — extract shared values to dedicated `*.constant.ts` module when same data needed by ≥2 components. Single source of truth prevents QC failure mode "values mismatch between consumers". Reusable cho any cross-component data sync need.

### DB / Cache impact

- MongoDB: NONE (presentation layer only, zero schema modify, zero index modify)
- Redis: NONE (no new keys, no TTL change, no flush needed)
- S3: NONE
- API contract: NONE (zero endpoint add, zero DTO modify)
- SDK regen: NOT performed (DTO unchanged)

### Tech debt diff

**RESOLVED:**
- TD-F012-02 (P2) — `TIMING_PRESETS` extracted to shared module `timing-presets.constant.ts` (root-cause fix Round 2). Previously: inline `TIMING_PRESETS` in form risked drift with display table. Now: single source of truth imported by both consumers.

**NEW:**
- TD-F012-01 (P3, optional) — promote click-to-toggle popover to reusable `<InlineHintPopover />` shared primitive if pattern reused trong feature kế tiếp. Currently component-local in `TimingFormulaTooltipContent.tsx`. Promote when ≥2nd consumer emerges.

**Carry-forward unchanged:**
- TD-F008-01 — frontend Vitest harness deferred (F-012 manual UAT smoke + QC code-read verification only)
- TD-F008-V2-02 — sound default OFF
- TD-F009-01/02 — inactive course status badge + AutoSnap not rendered
- TD-F010-V1-tuning — paceBuffer field-test mandate (untouched)
- TD-F010-V1-photo-evidence + TD-F010-V1-vendor-quality + TD-F010-V1-test-gap (all carry-forward)

### Lessons learned

- **Root-cause fix via shared constant module > spot-fix individual values** — QC Round 1 caught a P0 race-day risk: comparison table (PRD verbatim TRAIL=60/0.15, ULTRA=120/0.10) contradicted form's `TIMING_PRESETS` (Danny-locked TRAIL=45/0.20, ULTRA=60/0.15). BTC clicking TRAIL preset would see input=45 but table claim=60 — internal contradiction misleading race-day decisions. Coder Round 2 chose **Option A (preferred) — extract shared module** over Option B (PRD-canon override Danny-locked, violates PAUSE-FH-03) or Option C (disclaimer footnote acknowledging mismatch). Result: zero drift forever, also resolves TD-F012-02 P2 from Round 1. Lesson: when same data needs two consumers (form + display table), extract first; spot-fix shipping divergent values is a Race Ops domain failure mode QC gate must catch.
- **Surface 3 spec drift (1 vs 3 paragraphs) caught by Phase 5 careful PRD compliance check against UAT testable assertions** — Round 1 Coder rendered ONLY current preset paragraph in `TimingPresetRationalePanel`, defeating "compare side-by-side" purpose BR-FH-07 explicitly mandates. Also returned `null` if `currentPreset === null`, hiding trigger entirely (PRD specifies always visible). UAT-FH-04 testable assertion "3 paragraphs render, current paragraph có `bg-primary/5` border-left highlight" → would fail UAT in production. Lesson: UAT testable assertions in PRD are not optional — careful Phase 5 compliance read against UAT exact wording catches subtle defeats-the-purpose drifts before deploy. Multi-paragraph "always render all + highlight current" pattern minted as conventions entry for future reuse.
- **Custom click-to-toggle popover acceptable when shadcn Tooltip not in repo + NO new npm install policy** — PAUSE-FH-01 deviation: PRD specified shadcn `<Tooltip>` trigger pattern but shadcn Tooltip not installed in admin repo. Coder shipped custom click-to-toggle popover with full a11y (aria-expanded + Escape keydown listener + outside-click) — works universal touch + desktop, no install needed. QC Phase 2 a11y verification: all 3 patterns implemented in `TimingFormulaTooltipContent.tsx:80-95, 105`. Lesson: when off-the-shelf primitive not in repo + install policy strict, custom implementation acceptable IF a11y triple covered. Future feature reusing pattern → consider promoting `<InlineHintPopover />` shared primitive (TD-F012-01 P3 open).
- **Race Ops Cluster #7 closure** — F-012 closes hints/explanation slot after Cluster #6 (F-010 + F-011) closure. Pattern: post-deploy BTC UAT feedback → small-scope hints/explanation feature ship-in-1-sprint → cluster polish slot ACCEPTABLE precedent (similar to F-011 post-deploy UX feedback loop pattern, but for explanation/learnability surface instead of bugfix). Cluster polish slot extension: NOT just bugfix, ALSO hints/explanation ship-in-1-sprint pattern reproducible.

---

## [2026-05-07] FEATURE-011: Race Ops UI Polish Bugfix (Race Ops Cluster #6 — POST-DEPLOY POLISH)

**PR/Commit:** pending — code in worktree branch `5bib_racemonitor_v1`, push when Danny ready
**Type:** BUGFIX (presentation layer only — UI polish + status-aware guard, ZERO backend modify)
**Branch:** `5bib_racemonitor_v1` (KHÔNG merge main per cluster policy)
**Trigger:** Post-F-009 deploy → BTC UAT trên `/races/[id]/command-center` (race "Giải Công An" pre-race state) phát hiện 5 polish bugs

### Files changed (5 total — 5/5 exact Scope Lock)

**Admin frontend MODIFY (5):**
- ✏️ `admin/src/app/(dashboard)/layout.tsx` — ADD `data-admin-sidebar` attribute on `<aside>` line 251 + `data-admin-topbar` attribute on `<header>` line 273. ZERO class change, ZERO markup restructure (BR-AF-23 byte-for-byte preserve honored cho shared admin layout used by ALL admin routes).
- ✏️ `admin/src/app/globals.css` — EXTEND `body[data-fullscreen]` block additive: `body[data-fullscreen] [data-admin-sidebar], [data-admin-topbar] { display: none !important }`. `!important` justified per F-008 v2 BR-CC2-09 precedent (overrides Tailwind `lg:flex` on `<aside>`). Existing `[data-race-ops-shell-header]` translateY rule preserved verbatim.
- ✏️ `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/command-center/AthleteFlowChart.tsx` — Atomic fold Bugs #2 + #3 + #4: (a) ADD optional `raceStatus?: RaceStatus` prop (literal union `'draft' | 'pre_race' | 'live' | 'ended'`); (b) Pre-race guard ABOVE existing 3-tier empty-state ladder — `raceStatus === 'draft' || 'pre_race'` → return CardShell with single neutral grey div "⏱ Race chưa khởi động — chờ start gun" (FlowRows skipped); (c) Ghost dashed track full-width fallback `width: expPct > 0 ? '${expPct}%' : '100%'`; (d) Right column flex-col vertical stacking (was horizontal); (e) Expected label `~{expectedCount}` right-pinned `right:0` when `expPct < 5` to avoid collision. Grid `'130px 1fr 110px'` PRESERVED. F-005 health() calc preserved verbatim (lines 105-106 → now lines 144-145 after guard insertion above).
- ✏️ `admin/src/app/(dashboard)/races/[id]/command-center/components/CommandCenterLayout.tsx` — ADD `raceStatus={raceStatus}` prop pass-through to `<AthleteFlowChart>` at line 301. F-010 DnsBreakdownCard import (line 49) + render block (lines 286-293) PRESERVED verbatim. Both orderings safe (F-010 lands first OR F-011 lands first — additive diff).
- ✏️ `admin/src/app/(dashboard)/races/[id]/command-center/page.tsx` — UPDATE PageHero `meta` ternary lines 81-86: `'Race-day operations cockpit'` → `'Race Command Center'` (live: `'RACE LIVE — Race Command Center'`). VN microcopy 100% mandate honored.

**Total diff:** ~92 LOC additive (within 40-60 estimate band, slight overshoot due to atomic 3-bug fold + F-011 BR-PB inline documentation comments).

### Architecture impact

- **F-008 v2 fullscreen pattern EXTENDED scope** (race-ops shell only → admin shell + race-ops shell dual-layer hide). Mechanism preserved verbatim (`body[data-fullscreen]` CSS attribute toggle, NOT F11 native). Scope expanded only via parallel selector additive.
- **F-005 AthleteFlowChart status-aware UI guard pattern NEW** — race lifecycle state-aware render path. Frontend interprets `race.status` per-state via early-return guard ABOVE existing render ladders. Backend logic preserved (F-005 health() calc lines 144-145 verbatim).
- **PageHero subtitle VN microcopy enforcement** — "Race Command Center" canonical brand term established as cluster precedent. F-009 Course Map subtitle "Quản lý route & checkpoints" untouched (per-page context, NOT global brand replace).

### Conventions impact

3 NEW patterns minted (added to `conventions.md`):

1. **Status-aware UI guard pattern (BR-PB-04)** — race.status discriminator → conditional render bypass logic-correct-but-UX-misleading states. Backend logic preserved, frontend interprets per-state via early-return guard ABOVE existing render ladders. Reusable cho any race-lifecycle-dependent component (Awards / Result Kiosk / Athletes future).
2. **Fullscreen scope dual-layer pattern (BR-PB-02)** — admin shell + route-specific shell both hide via separate data-attribute selectors. Route-agnostic admin layout shared via attrs additive (zero class change per BR-AF-23). Reusable cho future fullscreen-aware features touching shared admin layout boundary.
3. **Post-deploy UX feedback loop pattern (F-011 precedent)** — BTC UAT discovery → BUGFIX init → small-scope polish ship in 1 sprint. Cluster polish slot acceptable parallel với feature pipeline (F-011 + F-010 parallel coexistence proven). Reusable cho future post-deploy UAT cycles.

**BR-AF-23 byte-for-byte preserve mandate honored** cho shared `(dashboard)/layout.tsx` admin layout (used by ALL admin routes, NOT just race-ops). F-011 only adds 2 data-attributes additive — ZERO class change, ZERO markup restructure. Same pattern as F-007 v2 shell extension (`data-race-ops-shell-header`).

### DB / Cache impact

- MongoDB: NONE (presentation layer only, zero schema modify)
- Redis: NONE (no new keys, no TTL change, no flush needed)
- S3: NONE
- SDK regen: NOT performed (DTO unchanged)

### Tech debt còn lại

**No new tech debt introduced by F-011.**

Carry-forward items (unchanged):
- TD-F008-01 — frontend Vitest harness deferred (F-011 manual UAT smoke only — pre-existing)
- TD-F008-V2-02 — sound default OFF (untouched)
- TD-F009-01/02 — inactive course status badge + AutoSnap not rendered (Course Map territory, untouched)
- TD-F010-V1-tuning — paceBuffer field-test mandate (untouched)

### Lessons learned

- **Post-deploy UX feedback loop ship-in-1-sprint precedent reproducible** — F-009 deploy → BTC UAT → F-011 polish init/PRD/plan/code/QC/deploy in 1 sprint. Pattern viable cho future post-deploy cycles where small-scope UX bugs surface during BTC race-day prep.
- **Risk-profile UX hierarchy reaffirmed** — lightweight CSS attr extension (additive selectors + 2 data-attributes) acceptable cho fullscreen scope expansion. Same risk tier as F-009 lightweight 3s toast (drag = reversible). NOT MEDIUM-weight modal cho status guard (read-only render path, no destructive action).
- **F-010 + F-011 parallel coexistence successful** — additive CommandCenterLayout shared file (DnsBreakdownCard render block from F-010 + raceStatus prop from F-011) proves cluster features can land in parallel when both honor ADDITIVE-only mandate. Reusable precedent cho F-013/F-014 cluster features.
- **Status-aware UI guard pattern reusable** — backend logic agnostic, frontend interprets per-state via early-return ABOVE existing render ladders. Reusable cho any race-lifecycle-dependent component (Awards pre-race "chưa có podium", Result Kiosk pre-race "chưa có kết quả", Athletes filter status-dependent view).
- **Pre-deploy UAT smoke test mandate cho ALL race statuses** — F-011 establishes precedent: draft / pre_race / live / ended must all be smoke-tested before deploy. Status-aware UI guard pattern is now a checklist item for any race-status-dependent UI.
- **VN microcopy 100% mandate sustained across cluster** — F-007 BR-AF-29 → F-011 Bug #5 closure. "Race Command Center" canonical brand term acceptable English (precedent: "Athlete Flow Monitor" F-005, "Race Day Command Center" F-005).

---

## [2026-05-07] FEATURE-010: Formula Correction & Config Upgrade — Timing Intelligence (Race Ops Cluster #6)

**PR/Commit:** pending — code in worktree branch `5bib_racemonitor_v1`, push when Danny ready
**Type:** EXTEND_EXISTING (timing-alert config schema + race-result cross-module DI + dashboard-snapshot DNS breakdown + CUTOFF_RISK alert type)
**Branch:** `5bib_racemonitor_v1` (KHÔNG merge main)
**Expert advisory collaboration:** Race Operation Expert + Sports Domain Expert + Strategic Scout (3-skill consultation precedent F-009 → F-010 reproducible)

### Files changed (24 total)

**Backend MODIFY (14):**
- ✏️ `backend/src/modules/timing-alert/schemas/timing-alert-config.schema.ts` — ADD 4 OPTIONAL fields: `course_type` (enum ROAD/TRAIL/ULTRA, nullable), `pace_buffer` (default 1.10), `pace_alert_threshold` (default 0.80), `confidence_multiplier` (default 0.20)
- ✏️ `backend/src/modules/timing-alert/schemas/timing-alert.schema.ts` — extend `detection_type` enum ADDITIVELY: `'PHANTOM' | 'MIDDLE_GAP' | 'CUTOFF_RISK'` (default still `'PHANTOM'`)
- ✏️ `backend/src/modules/race-result/schemas/race-result.schema.ts` — ADD `dnsChipFail: boolean` OPTIONAL field, default false (no migration needed for 94K race_results)
- ✏️ `backend/src/modules/timing-alert/dto/create-config.dto.ts` — ADD 4 ApiProperty fields with class-validator @IsNumber/@Min/@Max/@IsIn (paceBuffer @Min(1.01) @Max(2.0); paceAlertThreshold @Min(0.2) @Max(0.95); confidenceMultiplier @Min(0.05) @Max(1.0); course_type @IsIn(['ROAD','TRAIL','ULTRA']))
- ✏️ `backend/src/modules/timing-alert/dto/dashboard-snapshot.dto.ts` — ADD `dnsBreakdown: DnsBreakdownDto` additive nested field
- ✏️ `backend/src/modules/timing-alert/services/miss-detector.service.ts` — Signature change `detect()` accepts `options.{paceBuffer, lastPollAt, totalRegistered, confidenceMultiplier}`; CUTOFF_RISK detection logic (projectedFinish > cutoffTime → emit CUTOFF_RISK; else PHANTOM); OBS-1 wall-clock overdue (gapMs + max(0, now - lastPollAt) when lastPollAt set, fallback static gap when null); OBS-2 MIDDLE_GAP severity escalation (single → WARNING, 2+ consecutive → HIGH, TopN → CRITICAL)
- ✏️ `backend/src/modules/timing-alert/services/projected-rank.service.ts` — Signature change `calculate()` accepts `(totalRegistered, confidenceMultiplier)`; percentage-based confidence formula `MIN(1, totalFinishers / max(totalRegistered × multiplier, 1))` with totalRegistered=0 fallback to absolute threshold 50
- ✏️ `backend/src/modules/timing-alert/services/timing-alert-poll.service.ts` — Pass new config values to detect() + calculate(); add `getTotalRegistered()` helper; CUTOFF_RISK auto-resolve in `autoResolveOpen()` dual-trigger (athlete now has time at original missing CP OR Finish chiptime); preserves `last_checked_at` on no-evidence path
- ✏️ `backend/src/modules/timing-alert/services/dashboard-snapshot.service.ts` — ADD `computeDnsBreakdown()` method computing 3-state derivation (DNS_CHIP_FAIL / DNS_NOT_PICKED / DNS_NO_START) at query time (NO persisted dnsSubState field); integrated into Promise.all parallel chain L143
- ✏️ `backend/src/modules/race-result/race-result.service.ts` — ADD `getPaceAlertThreshold(raceId)` helper reading from TimingAlertConfig (fallback 0.80 default); ADD `updateDnsChipFail(id, value)` service method; isPaceAlert calculation reads custom threshold
- ✏️ `backend/src/modules/timing-alert/services/timing-alert-config.service.ts` — `upsert()` handles new 4 fields conditionally (preserves existing on partial PATCH); `toResponse()` includes F-010 fields
- ✏️ `backend/src/modules/race-result/race-result.module.ts` — ADD `MongooseModule.forFeature([{ name: TimingAlertConfig.name, schema: TimingAlertConfigSchema }])` cross-module DI (read-only access; no circular import — TimingAlertModule does NOT import RaceResultModule)
- ✏️ `backend/src/modules/race-result/race-result.controller.ts` — ADD `PATCH /:id/dns-chip-fail` endpoint with @UseGuards(LogtoAdminGuard) + full @ApiOperation + @ApiResponse decorators
- ✏️ 3 spec files updated: `miss-detector.service.spec.ts` (+13 NEW F-010 tests), `projected-rank.service.spec.ts` (+6 NEW F-010 tests), `race-result.service.spec.ts` (TimingAlertConfigModel mock added)

**Backend NEW (2):**
- ➕ `backend/src/modules/race-result/dto/update-dns-chip-fail.dto.ts` — DTO for PATCH endpoint with @IsBoolean validator + paired ResponseDto
- ➕ `backend/src/modules/timing-alert/dto/dashboard-snapshot-dns-breakdown.dto.ts` — DnsBreakdownDto with 4 numbers (total / notPicked / noStart / chipFail)

**Admin Frontend MODIFY (4):**
- ✏️ `admin/src/app/(dashboard)/races/[id]/settings/page.tsx` — ADD `<TimingDetectionConfigSection />` import + render ABOVE legacy 1687-line `<Tabs>` block, immediately after `<SettingsLinkCardsSection />` (3rd link card slot after F-008 v2 + F-009). Zero changes to lines below verified by diff.
- ✏️ `admin/src/app/(dashboard)/races/[id]/command-center/components/CommandCenterLayout.tsx` — ADD `<DnsBreakdownCard />` render between `SummaryCardsRow` and `lg:grid-cols-5` grid (additive only; F-011 merge-safe)
- ✏️ `admin/src/app/(dashboard)/races/[id]/command-center/components/AlertsListView.tsx` — ADD `case 'CUTOFF_RISK'` block + amber badge + filter option (additive only per BR-AF-23 verbatim port preservation)
- ✏️ `admin/src/lib/api-generated/types.gen.ts` — manual augment cho 4 new types (DnsBreakdownDto + UpdateDnsChipFailDto + UpdateDnsChipFailResponseDto + extend CreateTimingAlertConfigDto + TimingAlertConfigResponseDto + DashboardSnapshotResponseDto). Live swagger byte-for-byte equal verified post-deploy by QC Phase 5 smoke

**Admin Frontend NEW (3):**
- ➕ `admin/src/app/(dashboard)/races/[id]/settings/components/TimingDetectionConfigSection.tsx` — `'use client'` preset selector (Road/Trail/Ultra) + 4 number inputs + react-hook-form + Danny preset constants (TRAIL paceBuffer 1.35, TRAIL isPaceAlert 0.45, ULTRA paceBuffer 1.50)
- ➕ `admin/src/app/(dashboard)/races/[id]/command-center/components/DnsBreakdownCard.tsx` — DNS sub-state breakdown display (3-state visual)
- ➕ `admin/src/components/race-results/DnsChipFailToggle.tsx` — `'use client'` inline mutation button for DNS flag with optimistic update

**Admin type augmentation (1, additive over 23-file plan):**
- ✏️ `admin/src/lib/timing-alert-api.ts` — extend local `DashboardSnapshot` interface + `TimingAlertDetectionType` union to include `dnsBreakdown` and `'CUTOFF_RISK'`. Pure type addition, no runtime change. QC accepted as type-safety necessity.

### Architecture impact

- **Race Ops 9-tab shell unchanged** — Settings tab gains 3rd link card slot for `TimingDetectionConfigSection` ABOVE legacy editor (additive only; legacy 1687-line markup preserved byte-for-byte)
- **Cross-module data flow NEW** — RaceResultModule reads TimingAlertConfigModel via `MongooseModule.forFeature()` (option (a) per Manager plan PAUSE #4). No circular DI risk; tsc clean.
- **DashboardSnapshot extended** — `dnsBreakdown` nested object additive in summary cards section; F-005 sub-page parallel preserve 30-day window unaffected (JSON spec ignore extra fields)
- **detection_type enum 3 values** — `'PHANTOM' | 'MIDDLE_GAP' | 'CUTOFF_RISK'` (additive only; default still `'PHANTOM'`; existing alerts preserved)
- **New endpoint** — `PATCH /api/race-results/:id/dns-chip-fail` (LogtoAdminGuard, validator IsBoolean, paired ResponseDto, full @ApiOperation + @ApiResponse decorators)
- **CUTOFF_RISK alert lifecycle** — Poll detects projectedFinish > cutoff → CUTOFF_RISK alert (severity WARNING or HIGH for TopN). Next poll auto-resolve dual-trigger: (a) athlete now has time at original missing CP, (b) athlete has Finish chiptime. Otherwise alert stays OPEN until Race Director manual resolve/false-alarm (same as PHANTOM).
- **DNS 3-state derivation** — query-time only (no persisted `dnsSubState` field). For each athlete with no Start chiptime: `dnsChipFail===true → DNS_CHIP_FAIL`, else `racekitPickedUp===false → DNS_NOT_PICKED`, else `DNS_NO_START`.

### Conventions impact

**4 NEW patterns documented + 1 EVOLVED pattern reaffirmed:**

- **Per-course timing presets pattern** — `TIMING_PRESETS` constant table for Road/Trail/Ultra with Danny adjusted values (TRAIL paceBuffer 1.35 = Sports lower bound compromise; TRAIL isPaceAlert 0.45 = Sports recommended; ULTRA paceBuffer 1.50 = Sports upper bound; ROAD all values PRD original). Sports Domain Expert + Race Operation Expert dual-validation precedent.
- **MIDDLE_GAP severity escalation pattern (BR-FC-19)** — single MIDDLE_GAP → WARNING (was INFO pre-F-010); 2+ consecutive same athlete → HIGH; TopN athlete → CRITICAL; TopN + consecutive → CRITICAL. Multi-detection result counting pattern reusable.
- **Percentage-based confidence formula (OBS-2)** — `threshold = totalRegistered > 0 ? totalRegistered × multiplier : 50` then `confidence = MIN(1, totalFinishers / max(threshold, 1))`. Replaces absolute-threshold formula (was 50 finishers → 100% confidence regardless of race size). Reusable for any confidence-by-progress feature.
- **Wall-clock overdue via lastPollAt (OBS-1)** — `overdueMs = max(0, expectedSecondsAtNext - lastSeenSeconds) × 1000 + max(0, now - lastPollAt)` when `lastPollAt` set; fallback static gap when null (backward compat). Source: `existingAlert?.last_checked_at` pre-fetched batch via `.select({ bib_number, last_checked_at }).lean()` for poll service context.
- **Cross-module Mongoose DI pattern (EVOLVED)** — `MongooseModule.forFeature([{ name: 'X', schema: XSchema }])` in consumer module's `imports` for read-only cross-module access. Precedent: F-005 (TimingAlertModule reading RaceResultModel) + F-010 (RaceResultModule reading TimingAlertConfigModel). NO circular DI guard: opposite module must NOT import consumer module's services. tsc --noEmit verifies.
- **Expert advisory collaboration model (NEW precedent)** — F-009 introduced Race Operation Expert; F-010 added Sports Domain Expert + Strategic Scout for 3-skill consultation. Pattern: PRD draft → expert review consolidated artifact → Manager incorporate into plan v2 (Danny adjusted presets + risk flags + roadmap). Reproducible for any race-day-operations cluster feature.

### DB / Cache impact

- MongoDB: 3 schemas extended additively, ALL new fields OPTIONAL with defaults — NO migration script needed
  - `timing_alert_configs` +4 fields (course_type, pace_buffer, pace_alert_threshold, confidence_multiplier)
  - `timing_alerts` enum extend `detection_type` to include `'CUTOFF_RISK'`
  - `race_results` +1 field `dnsChipFail: boolean` default false
- MySQL platform: NO change
- Redis: NO new keys (DNS breakdown computed in cached `master:rr-snapshot:` 15s TTL naturally; no migration)
- S3: NO change

### Tech debt mới (moved to known-issues.md)

- **TD-F010-V1-tuning** Field-test mandate paceBuffer/paceAlertThreshold/confidenceMultiplier on next VN trail/ultra race Q2/Q3 2026 (Sports Domain Expert + Manager mandate; Owner Danny + race-day BTC feedback loop)
- **TD-F010-V1-photo-evidence** DNS_CHIP_FAIL admin flag race-day error-prone — Race Ops Expert recommend "Photo evidence?" checkbox companion. Defer to F-XXX polish post field-test
- **TD-F010-V1-vendor-quality** Surface DNS_CHIP_FAIL ratio per race as timing-vendor quality metric. Defer to F-013 Athletes tab OR F-014 Settings full redesign
- **TD-F010-V1-test-gap** computeDnsBreakdown() direct unit tests (impl exists, only contract-level verification today via swagger Phase 5 smoke). Low risk — recommend coverage in next polish pass

### Tech debt RESOLVED

- ✅ **F-005 forbidden services formal UNLOCK precedent** — Manager Scope Lock §rows 4-9 explicitly unlocked `miss-detector.service.ts`, `projected-rank.service.ts`, `timing-alert-poll.service.ts` for F-010 (CUTOFF_RISK + OBS-1 + OBS-2 + confidence formula + paceBuffer per course_type). Cluster reservation flexible per Manager plan + scope-lock explicit unlock pattern established (NOT permanent forbidden — gated on Manager plan approval per cluster feature).

### Lessons learned

- **Expert advisory collaboration model F-009 → F-010 reproducible** — Race Operation Expert + Sports Domain Expert + Strategic Scout 3-skill consultation precedent for cluster features. Pattern: PRD draft → consolidated review artifact → Manager incorporate into plan v2 with explicit Danny adjustments + risk flags + post-deploy roadmap. Reusable cho future race-day-operations cluster features (F-012/F-013/F-014).
- **Danny preset compromise pattern** — Sports recommended TRAIL paceBuffer 1.40-1.50 max conservative; Danny chốt 1.35 lower bound compromise. Document compromise reasoning trong plan v2 (Sports Expert + Race Ops Expert dual-validation) → field-test mandate logged as TD post-deploy. Pattern: when expert recommendations span range, Danny picks lower-bound conservative starting point + field-test mandate to A/B adjust.
- **Cross-module Mongoose DI proven safe** — `MongooseModule.forFeature()` cross-module pattern verified clean in 2 distinct features (F-005 reverse direction; F-010 forward direction). No circular DI when opposite module does NOT import consumer's services. Reusable for any read-only cross-module data access.
- **Field-test mandate post-deploy** — When feature ships values that depend on race-day empirical validation (per-course timing presets), explicit TD-F010-V1-tuning entry with owner + timeline + A/B adjust criteria. Avoids "ship and forget" trap.
- **Forbidden file boundary flexibility** — F-005 service services were originally locked post-F-005. F-010 needed signature changes for CUTOFF_RISK + OBS-1 + OBS-2. Manager plan formally UNLOCKED via §Scope Lock rows 4-9 (NOT silent override). Pattern: cluster reservation reviewable per cluster feature with explicit Manager-approved scope unlock.

---

## [2026-05-07] FEATURE-009: Course Map Standalone Tab (Race Ops Cluster #5)

**PR/Commit:** pending — code in worktree branch `5bib_racemonitor_v1`, push when Danny ready
**Type:** REFACTOR + EXTEND_EXISTING (F-006 modal → 9-tab shell standalone tab body)
**Branch:** `5bib_racemonitor_v1` (KHÔNG merge main suốt cluster)
**Race Ops Expert collaboration:** 56 citations integrated, 5 personas including 3 Race Ops-specific

### Files changed (12 total)

**Backend: 0 modify** (F-006 ZERO modify mandate per BR-CM2-21 — all 4 endpoints + DTOs + cache namespace `master:course-map:` + S3 prefix `courses/` UNCHANGED)

**Admin Frontend NEW (9):**
- ➕ `admin/src/app/(dashboard)/races/[id]/course-map/page.tsx` — Server Component shell, REPLACE F-007 placeholder, read `searchParams.course`
- ➕ `admin/src/app/(dashboard)/races/[id]/course-map/components/CourseMapLayout.tsx` — Client orchestrator wiring 6 sections (disclaimer + pills + upload + map + grid + drag mode)
- ➕ `admin/src/app/(dashboard)/races/[id]/course-map/components/CourseDistancePicker.tsx` — Client pills + 4-state status badge (✅ ⚠ ❌ 🔴) + URL query param sync via `useRouter` + `useSearchParams`
- ➕ `admin/src/app/(dashboard)/races/[id]/course-map/components/CourseMapFullView.tsx` — Client **VERBATIM PORT `CourseMapTabInner.tsx` 466 lines** (BR-AF-23 7th port, 23 lines diff / 3 hunks names-only — ZERO logic drift verified)
- ➕ `admin/src/app/(dashboard)/races/[id]/course-map/components/GpxUploadSection.tsx` — Client upload UI port from CourseDialog Map tab (states: Empty/Uploading/Parsing/MapReady/ParseError)
- ➕ `admin/src/app/(dashboard)/races/[id]/course-map/components/CheckpointConfigGrid.tsx` — Client port checkpoints tab + Distance field READ-ONLY (preserve F-008 v2 Health Matrix dependency on `cp.distanceKm`)
- ➕ `admin/src/app/(dashboard)/races/[id]/course-map/components/ManualDragModeButton.tsx` — Client toggle + lightweight 3s toast confirm (drag = reversible per Race Ops Expert; NOT 2-step modal)
- ➕ `admin/src/app/(dashboard)/races/[id]/course-map/components/AimsItraDisclaimerBanner.tsx` — Client disclaimer "GPX là tham khảo. Course measurement chính thức cần Jones Counter (AIMS) hoặc GPS multi-device average (ITRA)" + 7-day localStorage dismiss persist
- ➕ `admin/src/app/(dashboard)/races/[id]/course-map/components/CourseMapFullpageLinkCard.tsx` — Client link card cho Settings tab additive integration

**Admin Frontend MODIFY (3 — additive ONLY, BR-AF-23 byte-for-byte preserve):**
- ✏️ `admin/src/app/(dashboard)/races/[id]/components/CourseDialog.tsx` (606 lines) — ADD `<CourseDialogDeprecationBanner />` slot top of DialogContent (BR-CM2-19); existing 5-tab markup byte-for-byte preserved
- ✏️ `admin/src/app/(dashboard)/races/[id]/settings/page.tsx` (1678 lines legacy) — ADD `<CourseMapFullpageLinkCard raceId={raceId} />` ABOVE existing CourseDialog trigger line 1145; NO touch existing markup
- ✏️ `admin/src/app/(dashboard)/races/[id]/components/CourseMapTab.tsx` — KEPT alive (next/dynamic SSR wrapper still used by CourseDialog Map tab) for 30-day window

**F-006 lib reuse (CONSUME only — verified mtimes pre-F-009 session):**
- ✅ `admin/src/lib/course-map-api.ts` — generated SDK functions
- ✅ `admin/src/lib/course-map-hooks.ts` — TanStack Query hooks (useCourseMapData, useUploadCourseGpx, useDeleteCourseGpx, useUpdateCheckpointPosition)
- ✅ `admin/src/components/course-map/ElevationChart.tsx` — pure SVG chart shared
- ✅ `admin/src/components/course-map/SnapToPolyline.helper.ts` — snap helper

**F-008 v2 wrapper reuse (CONSUME only):**
- ✅ `admin/src/app/(dashboard)/races/[id]/command-center/components/CheckpointDiscoveryDialogWrapper.tsx` — direct path import (BR-CM2-25 closes TD-F008-V2-01 via `?course=` pre-fill)

### Architecture impact

- 9-tab race-ops shell unchanged (NO partial unlock needed F-009)
- Course Map slot 3 standalone tab body REPLACES F-007 placeholder (TD-F007-07 PARTIAL further: 6 → 5 placeholders remaining)
- Multi-distance navigation: course pills + URL `?course=courseId` deep-link (NEW pattern, alternative với separate route per course)
- F-006 modal `CourseDialog` parallel preserve 30-day deprecation window (hard-delete sync 2026-06-07 với F-005 sub-page)
- Backend course-map flow unchanged — F-006 service + cache namespace `master:course-map:` + S3 prefix `courses/` reused 100%
- F-008 v2 `CheckpointDiscoveryDialogWrapper` wrapper re-export pattern proves cross-feature DRY value

### Conventions impact

4 NEW patterns documented:
- **Lightweight toast confirm cho reversible actions** — drag = edit position (3s `sonner` toast "Drag mode bật/tắt") VS F-008 v2 Reset 2-step typing (destructive). Risk-profile divergence explicit.
- **MEDIUM-weight confirm modal** for "override prior work" actions — auto-snap erases manual drag → MEDIUM modal "Sẽ ghi đè drag thủ công?". Middle ground giữa toast và 2-step typing.
- **Multi-resource pill picker với 4-state status badge** — pattern cho any multi-resource navigation (Course Map / future Athletes filter / future Results filter): `✅ complete / ⚠ partial / ❌ no-data / 🔴 error` + URL query param sync.
- **AIMS/ITRA compliance disclaimer pattern** — race standards transparency với 7-day localStorage dismiss persist (timestamp-based check, re-show after 1 week). Applicable cho any feature touching certifiable race data.

### DB / Cache impact

- MongoDB: NO schema change, NO migration
- MySQL platform: NO change
- Redis: NO new keys (existing F-006 `master:course-map:<raceId>:<courseId>` TTL 600s + lock SETNX TTL 30s reused)
- S3: NO new prefix (existing `courses/{raceId}/{courseId}/` reused)

### Tech debt mới (moved to known-issues.md)

- **TD-F009-01** Inactive course pill status accuracy (only active course gets authoritative `useCourseMapData`; inactive default `no-gpx` until clicked) — defer bulk-status endpoint
- **TD-F009-02** AutoSnapButton component shipped but not wired in F-009 layout (no server endpoint yet; pattern + warning copy ready, intentionally not rendered to avoid no-op)
- TD-F008-01 carryover (frontend Vitest infra deferred — manual UAT substitute per F-008 v2 precedent)

### Tech debt RESOLVED

- ✅ **TD-F008-V2-01** Discovery dialog course selector — RESOLVED via BR-CM2-25 (`?course=` query param pre-fills CheckpointDiscoveryDialog course selector)
- ✅ **TD-F007-07 PARTIAL further** — course-map placeholder fully replaced (6 → 5 remaining: Overview/Readiness/Result Kiosk/Athletes/Results)

### Lessons learned

- **7th BR-AF-23 verbatim port SUCCESS** — pattern proven robust across 4 cluster features (F-007 + F-008 v2 × 6 + F-009). Mandate: single import-path + interface name + function name fix only. ZERO logic drift.
- **Race Ops Expert collaboration model** valuable for cluster features touching race-day operations — 56 citations integrated, 3 Race Ops-specific personas (Race Director / Race Marshal / Course Designer) added depth not capturable from PO/BA alone. Establish precedent: future race-ops features should consult skill upfront.
- **Risk-profile-based confirm UX hierarchy** crystallized: lightweight toast (reversible) → MEDIUM modal (override warning) → 2-step typing (destructive). Avoid one-size-fits-all confirm pattern.
- **Multi-resource pill picker với status badge** = cleaner UX than dropdown for 3-5 resources. Reusable pattern cho future filter/picker UIs.
- **Backend ZERO modify mandate** = highest-confidence cluster feature deploy. F-006 baseline 53/53 unchanged because Coder physically NOT touched. Verify via mtimes + `git diff --name-only`.
- **Settings tab BR-AF-23 byte-for-byte preserve** continues working — F-009 adds 2nd link card (after F-008 v2's SettingsLinkCardsSection), both ABOVE existing CourseDialog trigger line 1145. Pattern stable.
- **CourseDialog deprecation banner** smaller diff target estimate (+5 lines) vs actual (+20 lines incl. layout) acceptable scope semantics — Coder report attribution vs git diff stat reconciliation noted by QC for future reports.
- **Race-day drag mode all statuses** (live/ended) explicit BR-CM2 commitment honors Race Ops reality: BTC needs radio-call CP position fix during live race. Don't gate by status.
- **F-006 modal hard-delete window 2026-06-07 sync với F-005** consolidates 2 hard-delete tasks into 1 cleanup feature post-window.

---

## [2026-05-07] FEATURE-008 v2: Command Center Refactor + Full F-005 Migration (Race Ops Cluster #4 RESCOPE)

**PR/Commit:** pending — code in worktree branch `5bib_racemonitor_v1`, push when Danny ready
**Type:** REFACTOR + EXTEND_EXISTING (full F-005 sub-page migration → 9-tab shell)
**Branch:** `5bib_racemonitor_v1` (KHÔNG merge main suốt cluster)
**v1 status:** ✅ QC APPROVED archived `_archive/v1-canvas-fidelity/` (5 files, code in-tree, v2 builds upon — NOT reverted)

### Files changed (27 total)

**Backend (3 MODIFY):**
- ✏️ `backend/src/modules/timing-alert/dto/dashboard-snapshot.dto.ts` — additive `lastPollAt: Date | null` với `@ApiProperty({ nullable: true })` (BR-CC2-26)
- ✏️ `backend/src/modules/timing-alert/services/dashboard-snapshot.service.ts` — extend `getSnapshot()` inject `config?.last_polled_at ?? null` via `computeLastPollAt()` + DI inject `TimingAlertConfigService` (BR-CC2-27)
- ✏️ `backend/src/modules/timing-alert/services/dashboard-snapshot.service.spec.ts` — +2 NEW tests + 3 describe blocks for `computeLastPollAt` (BR-CC2-28)

**Admin Frontend NEW (11):**
- ➕ `admin/src/app/(dashboard)/races/[id]/awards/page.tsx` — Awards tab Server Component (port `PodiumTab.tsx` body 146 lines)
- ➕ `admin/src/app/(dashboard)/races/[id]/command-center/components/AlertsListView.tsx` — drill-in panel (verbatim port `AlertsTab.tsx` 491 lines, single import-path fix only per BR-AF-23)
- ➕ `admin/src/app/(dashboard)/races/[id]/command-center/components/AlertDetailDialogWrapper.tsx` — verbatim re-export wrapper
- ➕ `admin/src/app/(dashboard)/races/[id]/command-center/components/CheckpointDiscoveryDialogWrapper.tsx` — verbatim re-export wrapper
- ➕ `admin/src/app/(dashboard)/races/[id]/command-center/components/CommandCenterFullscreenButton.tsx` — `'use client'` toggle button + Esc keydown listener cleanup
- ➕ `admin/src/app/(dashboard)/races/[id]/command-center/components/SoundToggleButton.tsx` — `'use client'` localStorage persist + 880Hz Web Audio API bridge
- ➕ `admin/src/app/(dashboard)/races/[id]/command-center/components/ResetConfirmModal.tsx` — `'use client'` 2-step typing race name modal (BR-CC2-14 race-day safety)
- ➕ `admin/src/app/(dashboard)/races/[id]/command-center/components/RaceStatusPill.tsx` — Server Component status badge inline body (BR-CC2-19, distinct from F-007 RaceLiveTimer clock)
- ➕ `admin/src/app/(dashboard)/races/[id]/command-center/components/SettingsLinkCardsSection.tsx` — Server Component 2 link cards (Cấu hình Timing Alert + Poll logs)
- ➕ `admin/src/lib/use-timing-alert-sse.ts` — SSE hook body-scoped, debounce 1500ms invalidate, reconnect on error, useEffect cleanup robust (BR-CC2-17)
- ➕ `admin/src/lib/sound-alarm.ts` — extract `play880Hz()` + AudioContext helper từ F-005 inline page.tsx; browser autoplay policy silent fail

**Admin Frontend MODIFY (10):**
- ✏️ `admin/src/app/(dashboard)/races/[id]/command-center/page.tsx` — read `?view` query param + pass to Layout
- ✏️ `admin/src/app/(dashboard)/races/[id]/command-center/components/CommandCenterLayout.tsx` — wire AlertsListView drill-in conditional render, mount SSE hook, render RaceStatusPill above SummaryCardsRow
- ✏️ `admin/src/app/(dashboard)/races/[id]/command-center/components/CommandCenterTopBar.tsx` — add SoundToggleButton + ResetConfirmModal trigger + CommandCenterFullscreenButton + Discovery dialog trigger (4 NEW elements)
- ✏️ `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/command-center/AlertFeedPanel.tsx` — add "Xem tất cả {N} alerts →" drill-in link button (BR-CC2-36)
- ✏️ `admin/src/app/(dashboard)/races/[id]/settings/page.tsx` — INSERT `<SettingsLinkCardsSection />` ABOVE legacy 1678-line editor (BR-CC2-29 BR-AF-23 byte-for-byte preserve, NO touch existing markup)
- ✏️ `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/AlertsTab.tsx` — ADD deprecation banner top "Trang này sắp ngừng hoạt động → Chuyển ngay → /command-center?view=alerts"
- ✏️ `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/PodiumTab.tsx` — ADD deprecation banner top "→ Chuyển ngay → /awards"
- ✏️ `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/CockpitTab.tsx` — UPDATE deprecation banner v1→v2 wording
- ✏️ `admin/src/lib/timing-alert-api.ts` — add `lastPollAt: Date | null` field to `DashboardSnapshot` TS interface (manual sync per TD-F005-02)
- ✏️ `admin/src/app/globals.css` — add `body[data-fullscreen]` selector + transform animation (200ms ease-out hide RaceOpsHeader)

**F-007 PARTIAL UNLOCK (3 — Manager pre-approved):**
- ✏️ `admin/src/components/race-ops-shell/RaceTabsNav.tsx` — 8→9 tabs (BR-CC2-33), insert Awards spec slot 6 với `enabledIn:["live","ended"]`
- ✏️ `admin/src/components/race-ops-shell/RaceOpsHeader.tsx` — add `data-race-ops-shell-header` attribute for fullscreen CSS selector (BR-CC2-34)
- ✏️ `admin/src/middleware.ts` — extend redirect mapping: `/timing-alerts/alerts` → `/command-center?view=alerts` + `/timing-alerts/podium` → `/awards` (BR-CC2-32, 301 status, 30-day window)

### Architecture impact

- 9-tab race-ops shell expansion (8→9, Awards inserted slot 6 between Result Kiosk + Athletes — same group "post-race output")
- Command Center sub-views drill-in via `?view=alerts` query param (NEW B3 hybrid pattern, alternative với nested route)
- Awards standalone tab `/awards` (NEW route, `enabledIn:["live","ended"]`)
- SSE realtime listener body-scoped hook (move from F-005 cross-tab page-level → tab-scoped per BR-CC2-17)
- Backend additive `lastPollAt` field — DTO backward compat (extra field ignored bởi old consumer)

### Conventions impact

6 NEW patterns documented:
- **B3 hybrid drill-in** — shell tab + sub-view via query param (alternative với nested route)
- **Verbatim port pattern (BR-AF-23 formal)** — single import-path fix only, ZERO logic drift, used cho 6 F-005 features migrated successful
- **Fullscreen CSS attr** — `body[data-fullscreen]` + `transform: translateY(-100%)` smooth animation, hide shell `RaceOpsHeader` + `RaceTabsNav`, NO F11 browser API (conflicts state)
- **2-step typing-confirmation modal** — race-day safety pattern (Step 1 warning + Step 2 typing exact race name), audit log entry on submit
- **SSE listener body-scoped hook** — `useTimingAlertSse(raceId)` mounted in CommandCenterLayout, debounce 1500ms invalidate, reconnect on error, `useEffect` cleanup robust
- **DTO additive backward compat** — extra fields ignored bởi old consumer per JSON spec; safe pattern cho cross-feature DTO evolution

### DB / Cache impact

- MongoDB: NO schema change, NO migration
- MySQL platform: NO change
- Redis: existing `master:rr-snapshot:` reuse, NO new keys
- Cache TTL unchanged (15s F-005 baseline)

### Tech debt mới (moved to known-issues.md)

- **TD-F008-V2-01** Discovery dialog course selector (defaults first course; multi-course UX defer to F-009)
- **TD-F008-V2-02** Sound default-ON localStorage policy (currently OFF default; consider settings panel toggle)
- TD-F005-02 carryover (manual SDK sync — needs `pnpm generate:api` post-deploy)
- TD-F008-01 carryover (Frontend Vitest/RTL infra deferred — backend 150/150 + verbatim port semantic equivalence mitigates)

### Tech debt RESOLVED

- ✅ **TD-F007-01** placeholder "Tới F-005 cockpit" loop — F-008 v2 replaced with full Command Center body
- ✅ **TD-F007-07** PARTIAL — 2 of 8 placeholder pages replaced (Command Center + Awards); 6 remaining track until F-014

### Lessons learned

- **B3 hybrid drill-in** balances flat shell navigation với sub-view depth; query param simpler than nested route, semantic enough cho deep-link
- **Verbatim port BR-AF-23 chính thức**: 6 features migrated 2364 lines với ZERO logic drift via single-import-path-fix-only pattern; wrapper re-export approach for dialogs avoid file duplication
- **F-007 partial unlock works**: 3 shell files modified (RaceTabsNav 8→9, RaceOpsHeader data-attr, middleware redirect) under explicit Manager pre-approval — pattern repeatable for future cluster expansion
- **Fullscreen CSS attr > F11**: browser F11 conflicts state, custom CSS preserves React control flow + animation smooth
- **Reset 4-layer defense** (LogtoAdminGuard + confirmToken + status throw + 2-step typing modal) acceptable for race-day visible button risk per Danny accept
- **SSE body-scoped hook** robust cleanup pattern: `EventSource.close()` + `clearTimeout` in useEffect cleanup; React strict mode dev double-mount safe
- **DTO additive backward compat** = safe upgrade path; F-008 v1 sub-page consumers ignore `lastPollAt` extra field per JSON spec

---

## [2026-05-06] FEATURE-007: Race Ops Architectural Foundation (v2 rescope)

**Branch:** `5bib_racemonitor_v1` (KHÔNG merge main per Danny cluster policy)
**Type:** REFACTOR (race detail page architecture)
**Rounds:** 5 — v1 UX Polish DISCARDED → v2 PRD rewrite → v2 Plan APPROVED → v2 Code 1 sprint day → v2 QC APPROVED 9/10.

### Why
v1 (UX Polish 10 items + 53 tests PASS) DISCARDED vì Danny xác nhận design canvas (3 screenshots 01-Readiness / 02-Course-Map / 03-Command-Center) là CURRENT intent từ đầu cluster Race Ops, KHÔNG phải future target. Manager + PO/BA dual-audit phát hiện F-005/F-006 implementation fidelity ~50-60% vs canvas (NOT 94-98% như claim) — gap ở architectural level (8-tab shell missing) + workflow + microcopy. F-007 v1 polish layer SAI architecture, ship sẽ commit debt. Race deadline 17/05 Cát Tiên trượt OK per Danny → strict refactor. v2 scope = build 8-tab race-ops shell foundation cho cluster F-008..F-014.

### Files changed (22 in-scope, within 27 Scope Lock)

**NEW (16):**
- ➕ `admin/src/app/(dashboard)/races/[id]/layout.tsx` — 8-tab shell wrapper (RaceOpsHeader sticky + main content)
- ➕ `admin/src/app/(dashboard)/races/[id]/{overview,readiness,course-map,command-center,result-kiosk,athletes,settings}/page.tsx` — 7 NEW tab pages (results/page.tsx existing preserved)
- ➕ `admin/src/components/race-ops-shell/RaceOpsHeader.tsx` — sticky header composition
- ➕ `admin/src/components/race-ops-shell/RaceLiveTimer.tsx` — 'use client' setInterval 1Hz, 4 states, pure-exported `computeTimerDisplay()`
- ➕ `admin/src/components/race-ops-shell/RaceTabsNav.tsx` — 'use client' usePathname active state, fail-pill folded inline
- ➕ `admin/src/components/race-ops-shell/PageHero.tsx` — 3 variants (pink / red-live / white)
- ➕ `admin/src/components/race-ops-shell/Breadcrumb.tsx` — chevron + truncate >40 chars
- ➕ `admin/src/components/race-ops-shell/PlaceholderPage.tsx` — F-XXX badge + ETA + description (replaces TabBadge slot, Coder pragmatic addition)
- ➕ `admin/src/middleware.ts` — 301 redirect `/timing-alerts/cockpit` → `/command-center` (30-day deprecation window)

**MODIFY (7):**
- ✏️ `admin/src/app/(dashboard)/races/[id]/page.tsx` — REWRITTEN: 1678-line legacy editor → 222-line Overview (PAUSE-MGR-01 no redirect flash)
- ✏️ `admin/src/app/globals.css` — brand tokens migration: `--5s-blue` rename → `--5s-info` (data viz role), `--5s-primary: #FF0E65` magenta added, `--5s-live: #FF0E65` RACE LIVE; back-compat aliases retained
- ✏️ `frontend/app/globals.css` — parallel admin migration
- ✏️ 5 hex literal swap files trong F-005/F-006 components (#1D49FF → #FF0E65): `CourseMapTab.tsx`, `CourseMapTabInner.tsx`, `SummaryCardsRow.tsx`, `ElevationChart.tsx`, frontend `CourseMapInner.tsx`. Out-of-scope `article-categories` + `solution-5solution` + `5bib-info` data-viz tokens preserved per PAUSE-MGR-02.
- ✏️ `backend/src/modules/races/races.service.spec.ts` — TD-F006-04 4 fixes (`{ new: true }` → `{ returnDocument: 'after' }`, strip `_id`/`cacheTtlSeconds` expected mock). 28/28 PASS (was 24/28).

**Settings tab strategy:** Legacy 1678-line editor MOVED VERBATIM via single import-path fix (`./components/...` → `../components/...`). BR-AF-23 byte-for-byte preservation satisfied with minimal risk + zero refactor.

### Architecture impact
- NEW 8-tab race-ops shell pattern (Next.js 16 nested route segments) — first time codebase. Reusable cho future merchant detail / event detail entities.
- NEW sticky RACE LIVE timer global header với 4 states matrix (`draft` / `pre_race` / `live` / `ended`).
- NEW page hero 3 variants pattern (pink / red-live / white).
- NEW breadcrumb component với truncate >40 chars.
- NEW middleware 301 redirect pattern (first time codebase).
- F-005 sub-page tree `(dashboard)/races/[id]/timing-alerts/` STILL ALIVE during 30-day deprecation window (only `cockpit` leaf 301-redirected; `alerts`/`podium` working).
- F-006 `CourseDialog` modal STILL ALIVE parallel until F-009.

### Conventions impact (6 NEW patterns + 1 critical mandate)
1. **8-tab race-ops shell layout** (Next.js 16 nested route segments) — `(dashboard)/races/[id]/layout.tsx` shell + nested `[tab]/page.tsx` per tab.
2. **RaceLiveTimer setInterval 1Hz pattern** — 'use client' boundary, pure-exported `computeTimerDisplay()` for unit testability.
3. **Design Canvas Reference MANDATORY GATE** (CRITICAL retroactive lesson) — `/5bib-init` MUST require canvas reference; visual fidelity audit pre-QC = side-by-side diff, NOT self-rate.
4. **Architectural Shape P0 trong PRD Section 1** — modal/page/drawer/sheet declared explicit Section 1, NOT Section 6.
5. **3 Fidelity Scores Post-Implementation** — Component ≥95%, Workflow ≥90%, Architectural = 100% (gate).
6. **Brand Token Migration với fallback role** — existing token rename (`--5s-blue` → `--5s-info` data viz), new token (`--5s-primary` magenta brand primary).

### DB / Cache impact
- MongoDB: ZERO change (refactor only)
- Redis: ZERO change
- S3: ZERO change

### Tech debt còn lại (đã move sang known-issues.md)
- TD-F007-01..07 (7 items) — Command Center placeholder dead link, pulse keyframe drift, doc URL canonical drift, deferred 22 component unit tests, layout.tsx 'use client' (KHÔNG Server Component), TabBadge folded inline, 8 placeholder pages.

### Lessons learned (CRITICAL — must apply for future cluster)
1. **Design canvas reference MUST be GATE in `/5bib-init`** — without canvas, scope marked "logic-only".
2. **Architectural shape (modal/page/drawer/sheet) MUST be P0 trong PRD Section 1 Goal/Scope** — KHÔNG bury Section 6 Technical Mandates.
3. **Visual fidelity self-rate vô nghĩa** — replace với 3 separate scores Component / Workflow / Architectural measured post-implementation.
4. **v1 polish layer SAI architecture = waste** — refactor cost = 1 sprint architectural rebuild vs canvas-strict from start.
5. **Settings tab byte-for-byte preservation pattern reusable** cho future legacy migrations (single import-path fix only, KHÔNG rewrite).

### Cluster context
F-007 unblocks F-008 (Command Center refactor + Health Matrix + 6 cards + Export CSV), F-009 (Course Map standalone page + magenta + page-level controls), F-010 (Readiness Checklist canvas 01), F-011 (Result Kiosk), F-012 (Athletes), F-013 (Results), F-014 (Settings full redesign). Branch `5bib_racemonitor_v1` KHÔNG merge main suốt cluster.

---

## [2026-05-06] FEATURE-006: Course Map Visualization (Race Ops Cluster #2)

**Branch:** `5bib_racemonitor_v1` (KHÔNG merge main per Danny)
**Type:** EXTEND_EXISTING (RacesModule + admin Course dialog + frontend public race detail)
**Rounds:** 4 — initial Phase 1-3 → QC REJECT (XSS BLOCKER + cache invalidation gap) → Coder rework (escapeHtml + removeCourse cache) → QC re-run targeted APPROVED.

### Why
Race Ops cluster feature #2 (sau F-005 Command Center). BTC race day cần upload GPX/KML cho mỗi course → render Leaflet map (admin preview + public race page) hiển thị route polyline, checkpoint markers, aid stations, elevation profile. 3 mục tiêu: (1) Athletes plan race trước race day với route + CP distances + elevation; (2) BTC giảm thao tác tay 8-12 markers/course bằng auto-match waypoint↔checkpoint name; (3) BTC communicate difficulty `↑850m / ↓850m` public stats.

Reference design: `5BIB Race Ops Canvas.html` Artboard 2 (race-ops-coursemap.jsx).

### Files changed (~28 files across rework rounds)

**Backend (13 — 4 new DTO + 1 service + 1 spec + 7 modify):**
- ➕ Added: `backend/src/modules/races/dto/gpx-parsed.dto.ts` — `GpxParsedDto` + `GpxBoundsDto`
- ➕ Added: `backend/src/modules/races/dto/course-map-data.dto.ts` — public response DTO + `CheckpointWithPositionDto`
- ➕ Added: `backend/src/modules/races/dto/course-map-upload-result.dto.ts` — admin upload response + `WaypointMatchDto`
- ➕ Added: `backend/src/modules/races/dto/update-checkpoint-position.dto.ts` — body DTO with WGS84 bounds validation
- ➕ Added: `backend/src/modules/races/services/course-map.service.ts` — core service (parseGpxOrKml + matchWaypoints + uploadGpxToS3 + deleteGpxFromS3 + getCachedMapData with SETNX anti-stampede + invalidateMapDataCache)
- ➕ Added: `backend/src/modules/races/services/course-map.service.spec.ts` — 23 unit tests
- ➕ Added: `backend/src/modules/races/services/course-map.adversarial.spec.ts` (QC artifact) — 18 adversarial tests (malformed XML, NaN/Infinity coords, empty waypoint names, unicode path traversal, corrupt cached JSON, public response leak)
- ➕ Added: `backend/test/__mocks__/jose.ts` — no-op stub (jest infra fix, unblocks pre-existing controller spec bootstrap)
- ✏️ Modified: `backend/src/modules/races/schemas/race.schema.ts` — `RaceCourse.gpxParsed` + `gpxSimplifiedUrl` + `CourseCheckpoint.lat/lng` (additive, no migration)
- ✏️ Modified: `backend/src/modules/races/dto/add-course.dto.ts` — DTO sync MANDATORY (quirk hotfix `804f707`). UpdateCourseDto inherits via PartialType.
- ✏️ Modified: `backend/src/modules/races/races.controller.ts` — 4 new endpoints with full Swagger + LogtoAdminGuard
- ✏️ Modified: `backend/src/modules/races/races.controller.spec.ts` — 11 new F-006 tests (22 total = 11 baseline + 11 F-006)
- ✏️ Modified: `backend/src/modules/races/races.service.ts` — `updateCourse()` $unset semantics + direct `redis.del('master:course-map:...')` (Clarification 3, no circular DI). `removeCourse()` rework: same direct DEL after `$pull`.
- ✏️ Modified: `backend/src/modules/races/races.service.spec.ts` — Redis DI mock (improves baseline 0/24 → 21/25) + 2 new F-006 cache invalidate tests (update + remove)
- ✏️ Modified: `backend/src/modules/races/races.module.ts` — register CourseMapService
- ✏️ Modified: `backend/package.json` — add `@tmcw/togeojson`, `@turf/turf` (PAUSE confirmed) + transitive `@xmldom/xmldom`, `@types/geojson` + jest config `moduleNameMapper` for `jose` ESM

**Admin (12 — 5 components + 2 lib + 3 SDK + 1 e2e + fixtures):**
- ➕ Added: `admin/src/lib/course-map-api.ts` — typed wrapper (multipart upload via raw fetch, others via SDK; `CourseMapApiError` discriminator)
- ➕ Added: `admin/src/lib/course-map-hooks.ts` — 4 TanStack Query hooks (`useCourseMapData`, `useUploadCourseGpx`, `useDeleteCourseGpx`, `useUpdateCheckpointPosition`)
- ➕ Added: `admin/src/components/course-map/ElevationChart.tsx` — pure SVG (gradient `#1D49FF` 0.3→0, dotted CP lines, max 200 sample points)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/components/CourseDialog.tsx` — extracted dialog 5 tabs (Cơ bản/Thông tin/Hình ảnh/Checkpoints/**Map**), preserves 4 baseline tabs byte-for-byte (Manager Clarification 1)
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/components/CourseMapTab.tsx` — `'use client'`, drag-drop + uploading/ready/error states + design tokens
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/components/CourseMapTabInner.tsx` — `'use client'` Leaflet, custom DivIcons, manual drag mode, `dynamic({ ssr: false })`. **escapeHtml inline helper** (XSS rework round) for cpIcon HTML interpolation.
- ➕ Added: `admin/e2e/course-map-upload.spec.ts` — 8 Playwright tests (UAT-deferred, env vars + Logto storageState, same TD-F005-06 pattern)
- ➕ Added: `admin/e2e/fixtures/sample.gpx` (10 wpts + 12 trkpts) + `sample.kml` + `corrupted.gpx` + `README.md` (large-15mb.gpx generation script)
- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/page.tsx` — replace inline 293-line dialog (lines 1144-1436) with `<CourseDialog ...props />`. State + handlers preserved at parent.
- ✏️ Modified: `admin/package.json` + `pnpm-lock.yaml` — add `react-leaflet ^5.0.0`, `leaflet ^1.9.4`, dev `@types/leaflet ^1.9.21`
- 🔄 Auto: `admin/src/lib/api-generated/{sdk,types,index}.gen.ts` — SDK regen via `pnpm generate:api`

**Frontend public (5 — 3 components + escapeHtml inline + SDK + race detail integration):**
- ➕ Added: `frontend/components/course-map/ElevationChart.tsx` — byte-identical copy from admin (Phase 3 Option A small-duplicate pattern)
- ➕ Added: `frontend/app/(main)/races/[slug]/components/CourseMapSection.tsx` — `'use client'` wrapper (TanStack Query, course pills with ARIA, stats line, dynamic-imported map, lazy GeoJSON fetch + haversine elevation profile derive, checkpoint flow with service emojis)
- ➕ Added: `frontend/app/(main)/races/[slug]/components/CourseMapInner.tsx` — `'use client'` Leaflet read-only (no drag, `scrollWheelZoom: false`, `touchZoom + keyboard: true`, `h-[300px] md:h-[400px]`). **escapeHtml inline helper** (XSS rework round) — same fix admin.
- ✏️ Modified: `frontend/app/(main)/races/[slug]/page.tsx` — import `CourseMapSection` + render after course cards (section-based, not tabbed)
- 🔄 Auto: `frontend/lib/api-generated/{sdk,types,index}.gen.ts` — SDK regen

**Docs (1):**
- ✏️ Modified: `CLAUDE.md` Redis Keys Registry — append 2 F-006 keys (`master:course-map:`, `master:course-map-lock:`)
- ✏️ Modified: `CLAUDE.md` S3 Lifecycle — Lifecycle rule 2 prefix `courses/` no expiration (distinct from `result-images/` 24h TTL)

### Architecture impact
- New aggregator service `CourseMapService` registered trong `RacesModule`. Module DI graph KHÔNG đổi.
- 4 new endpoints lên `RacesController` (3 admin LogtoAdminGuard + 1 public).
- 2 new Redis keys: `master:course-map:<raceId>:<courseId>` TTL 600s + `master:course-map-lock:<raceId>:<courseId>` TTL 30s (anti-stampede SETNX).
- New S3 prefix `courses/` no expiration (distinguish khỏi `result-images/` 24h TTL).
- Direct `redis.del()` trong `RacesService.updateCourse()` + `removeCourse()` (Clarification 3, avoid circular DI vs CourseMapService).

### Conventions impact
- ➕ Pattern mới: **GPX/KML server-side parse + Douglas-Peucker simplify** (`@tmcw/togeojson` + `@turf/turf`). Reusable cho future feature route visualization (5pix elevation chart, athlete actual track heatmap).
- ➕ Pattern mới: **Leaflet wrapped `next/dynamic({ ssr: false })`** — Next.js 16 SSR-safe map render. Server Component wrapper → Client Component inner. Reusable cho F-007 Readiness, F-008 Kiosk nếu cần map.
- ➕ Pattern mới: **escapeHtml() inline helper for divIcon HTML interpolation** — XSS prevention khi user-controlled string vào Leaflet `divIcon({ html })`. Pattern: define inline trong component file, escape `&`, `<`, `>`, `"`, `'`. NEVER raw interpolate user data vào innerHTML.
- ➕ Pattern mới: **Targeted QC re-run** — KHÔNG full 5 phases lại cho narrow Coder rework. Verify only specific items (XSS escape both files, cache invalidation, regression maintained, build clean). Tiết kiệm ~10 min vs full re-run. F-005 lesson reaffirmed.
- ➕ Pattern mới: **Strict 3-level fuzzy match (no substring/Levenshtein)** — exact / case-insensitive / no-match. CRITICAL false-positive guard: `TM10` ↔ `TM1` MUST not match. Reusable cho any string-matching pattern domain.
- ➕ Pattern mới: **Section-based integration as drop-in tab body** — frontend race detail không có tab system trong MVP, F-006 inserted as section. Khi F-007/F-008 implement tab structure → drop-in tab body, không cần refactor.
- Reaffirm F-005 patterns: BR-CC-10 dead code prevention (every public method `CourseMapService` reachable via endpoint), `master:` cache namespace, design canvas fidelity audit, dedicated entity query > generic activity feed, pure CSS chart over recharts (admin no recharts install), 2-layer rate-limit anti-stampede SETNX.

### DB / Cache impact
- **MongoDB:** additive schema fields trên `races.courses[]` subdocument (`gpxParsed`, `gpxSimplifiedUrl`) + `races.courses[].checkpoints[]` subdocument (`lat`, `lng`). KHÔNG migration cần (Mongoose flexible schema). KHÔNG index mới.
- **Redis:** 2 keys mới `master:course-map:<raceId>:<courseId>` TTL 600s + `master:course-map-lock:<raceId>:<courseId>` SETNX TTL 30s. Invalidation: 4 trigger points (POST upload / DELETE / PATCH checkpoint-position / RacesService.updateCourse + removeCourse).
- **S3:** new prefix `courses/{raceId}/{courseId}/{original.gpx|simplified.geojson}`. Bucket policy public-read (codebase pattern, NOT per-object ACL — Block Public Access aware). Lifecycle: NO expiration (race history archive).

### Tech debt còn lại (đã chuyển vào known-issues.md)
- TD-F006-01: Admin Playwright e2e UAT-deferred (env vars + Logto storageState pending — same TD-F005-06 pattern)
- TD-F006-02: Admin ElevationChart 2-point min/max summary (acceptable for preview, accepts full array for upgrade)
- TD-F006-03: Frontend `globals.css` lacks `--5s-*` design tokens (hex literals inlined; admin có đủ tokens F-005 setup)
- TD-F006-04: 5 pre-existing `races.service.spec` failures (assertions vs `{returnDocument:'after'}` semantic + `_id`/`cacheTtlSeconds` stripping). NOT introduced by F-006. Coder improved baseline 0/24 → 21/25 PASS.
- TD-F006-05: S3 ACL public-read bucket policy (no presigned URL signing) — original.gpx URL technically accessible if path known, no PII acceptable
- TD-F006-06: Section-based integration in frontend (drop-in tab body when F-007/F-008 implement tabs)
- TD-F006-07: ✅ **RESOLVED** — XSS escape applied via inline `escapeHtml()` both admin + frontend cpIcon (rework commit pending)
- TD-F006-08: ✅ **RESOLVED** — `removeCourse()` cache invalidation added (direct `redis.del()` after `$pull`)
- TD-F006-09: `removeCourse()` does NOT call `deleteGpxFromS3` → orphaned S3 objects khi remove course (LOW priority, deferred to follow-up feature)
- TD-F006-10: Missing "no-elevation" e2e fixture (LOW, 8/8 admin states covered structurally, 1 missing fixture)
- TD-F006-11: Add explicit billion-laughs XML attack fixture to verify @xmldom/xmldom defaults safe (LOW)
- TD-F006-12: 10MB-exact boundary test (LOW, current test only verifies 11MB rejection)

### Test results
- **66 NEW F-006 tests PASS** (23 service + 18 QC adversarial + 11 controller + 4 service cache invalidate update/remove + others)
- **135/135 timing-alert regression PASS** (F-005 baseline maintained)
- Backend `npm run build` clean
- Admin `pnpm tsc --noEmit + next build` clean (no Leaflet SSR error)
- Frontend `pnpm tsc --noEmit + next build` clean

### Lessons learned
1. **DTO sync hotfix `804f707` quirk reaffirmed** — every Mongoose schema field MUST mirror in AddCourseDto + CourseCheckpointDto + UpdateCourseDto whitelist. Coder pre-flight check: POST payload với new fields returns 200 not 400.
2. **DOM XSS via Leaflet `divIcon({ html })`** — common attack vector when user data interpolated raw vào innerHTML. **MUST escape** even if data source is admin-controlled (admin can be compromised, race organizer can be malicious). Pattern logged trong conventions.
3. **Targeted QC re-run efficiency** — F-005 BR-CC-10 lesson reapplied successfully. F-006 XSS rework verified via 4 items only (escape both files, cache invalidation, regression, build) → ~10 min vs full 5-phase. Lesson now documented.
4. **Course Dialog extract pattern** — extract 286-line inline dialog từ page.tsx (~1500 lines) thành controlled component. State ownership KHÔNG đổi (parent giữ open/form/editing). Props in / events out. Smoke verify: existing 4 tabs preserved byte-for-byte. Useful template for future page.tsx splits.
5. **Section-based integration drop-in pattern** — frontend race detail KHÔNG có tab system trong MVP. F-006 inserted as section, future-proof: khi F-007/F-008 implement tab structure → drop-in tab body, không refactor.
6. **Branch isolation Race Ops cluster** — branch `5bib_racemonitor_v1` chứa F-001 + F-002 + F-005 + F-006 chưa merge main. Manager KHÔNG tự open PR — Danny click manual khi sẵn sàng merge cluster.

---

## [2026-05-05] FEATURE-005: Race Day Command Center (Race Ops Cluster #1)

**Branch:** `5bib_racemonitor_v1` (KHÔNG merge main per Danny request)
**Type:** EXTEND_EXISTING (timing-alert + dashboard-snapshot)
**Commits (3):** `1dab534` (initial + BR-CC-10 rework) → `1b81a2d` (visual polish) → `c63ee8a` (AlertFeedPanel data source fix)

### Why
Race Day Command Center là feature đầu tiên trong Race Ops cluster (4 features: F-005..008). Mục tiêu: BTC race day cần single-screen tactical view — live leaderboard per course + summary cards (race elapsed, athletes finished, alerts open, racekit picked) + Force Refresh button override TTL cache. Extend F-002 `dashboard-snapshot` thay vì tạo module mới (reuse poll service + miss detector + dialog). UI phải match design canvas `5BIB Race Ops Canvas.html` Artboard 3 (race-ops-command.jsx).

### Files changed (~22 files across 3 commits)

**Backend (9 — 5 modify + 4 create):**
- ➕ Added: `backend/src/modules/timing-alert/services/command-center.service.ts` — aggregator service: `getLiveLeaderboard()`, `getSummaryCards()`, `forceRefresh()` 2-layer rate-limit (per-user UX 30s + per-race anti-stampede reuse F-001 `master:discover-lock`).
- ➕ Added: `backend/src/modules/timing-alert/dto/live-leaderboard-course.dto.ts`
- ➕ Added: `backend/src/modules/timing-alert/dto/summary-cards.dto.ts`
- ➕ Added: `backend/src/modules/timing-alert/dto/force-refresh-response.dto.ts` (rework round)
- ✏️ Modified: `backend/src/modules/timing-alert/services/dashboard-snapshot.service.ts` — call `commandCenterService.aggregateLeaderboardForAllCourses()` + `getSummaryCards()`. Cache key migrate `dashboard-snapshot:` → `master:rr-snapshot:`.
- ✏️ Modified: `backend/src/modules/timing-alert/dto/dashboard-snapshot.dto.ts` — additive: `liveLeaderboard: LiveLeaderboardCourseDto[]` + `summary: SummaryCardsDto` (backward compat F-002 consumers).
- ✏️ Modified: `backend/src/modules/timing-alert/controllers/timing-alert-admin.controller.ts` — `GET .../leaderboard/:courseId?limit=10|20|50` + `POST .../command-center/force-refresh` (rework BR-CC-10).
- ✏️ Modified: `backend/src/modules/timing-alert/timing-alert.module.ts` — register CommandCenterService.
- ➕ Added: `backend/src/modules/timing-alert/services/command-center.service.spec.ts` — 12 unit tests.

**Frontend admin (13 — 6 modify + 6 create + 1 e2e):**
- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/CockpitTab.tsx` — major refactor: removed Hero Stats grid (duplicate of SummaryCardsRow), consolidated 3 header strips → 1 CommandHeader, deferred course breakdown grid, drop `recentActivity` destructure, pass `<AlertFeedPanel raceId={raceId} />` directly.
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/command-center/CommandHeader.tsx` — race name + elapsed clock + status badge + Force Refresh button + last sync timestamp.
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/command-center/SummaryCardsRow.tsx` — 4 cards (Athletes Finished / Athletes In Course / Alerts Open / Racekit Picked).
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/command-center/LiveLeaderboardPanel.tsx` — course tabs + AthleteFlowChart dual-bar overlay (ghost expected dashed + actual filled gradient + pctOfExp label).
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/command-center/AthleteFlowChart.tsx` — dual-bar overlay chart per checkpoint.
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/command-center/AlertFeedPanel.tsx` — **(round 3 c63ee8a)** dedicated query `listTimingAlerts(raceId, {status:'OPEN', pageSize:50})` via TanStack Query. Filter tabs (All/Critical/High/Med/Low). Per-item layout: severity bar + BIB mono + contest pill + "Missing X" + Last seen + Projected Top N AG (magenta) + Investigate (opens AlertDetailDialog) + Dismiss × (patchTimingAlert FALSE_ALARM).
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/command-center/CommandFooter.tsx` — last refresh timestamp + Force Refresh remaining cooldown.
- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/timing-alerts/page.tsx` — tab label "Cockpit" → "Command Center" (route + query key giữ).
- ✏️ Modified: `admin/src/lib/timing-alert-api.ts` — add `forceRefreshCommandCenter()` + `getLeaderboard()` typed helpers.
- ✏️ Modified: `admin/src/app/globals.css` — added `--5s-*` design tokens (9 vars) + `--font-display` mapping + `ro-blink` + `ro-pulse` keyframes.
- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/AlertDetailDialog.tsx` — props relax to accept either bib or alertId (reused by AlertFeedPanel).
- ✏️ Modified: `admin/src/app/layout.tsx` — load Plus Jakarta Sans display font.
- ➕ Added: `admin/e2e/command-center.spec.ts` — 10 Playwright tests (UAT-deferred, env vars + Logto storage state pending).

### Architecture impact
- New aggregator service `CommandCenterService` registered trong `TimingAlertModule`. NO new DI cycle.
- Cache key namespace migration: `dashboard-snapshot:<raceId>` → `master:rr-snapshot:<raceId>` (consistent with F-001 `master:` prefix).
- 2-layer rate-limit pattern (BR-CC-10):
  - Tier 1: per-user UX guard `master:cc-refresh-lock-user:<userId>` SETNX TTL 30s → 429 "Đợi {N}s".
  - Tier 2: per-race anti-stampede reuse F-001 `master:discover-lock:<raceId>` SETNX TTL 30s → 409 "Race đang refresh".
- Tab rename "Cockpit" → "Command Center" UI ONLY — route `/races/:id/timing-alerts/cockpit` + query key `['cockpit-snapshot', raceId]` giữ nguyên cho backward compat.

### Conventions impact
- ➕ Pattern mới: **Service exists but unreachable = dead code** (BR-CC-10 lesson) — every new service public method MUST có HTTP endpoint hoặc clear "internal-only" doc. QC Phase 1 reject ban đầu chính vì gap này.
- ➕ Pattern mới: **2-layer rate-limit** (per-user UX + per-race anti-stampede) — reusable cho F-006 (Course Map upload) + F-008 (Kiosk lookup) nếu cần anti-stampede + per-user UX guard.
- ➕ Pattern mới: **Design canvas fidelity** — khi feature có design canvas reference (HTML mockup), Coder phải audit duplicate sections + design tokens + typography pre-deploy. Visual polish round là acceptable nếu canvas cụ thể; KHÔNG nên skip với "code works = ship".
- ➕ Pattern mới: **Dedicated alert query > generic snapshot field** — `AlertFeedPanel` ban đầu dùng `snapshot.recentActivity` mix `poll.completed` events + `alert.created` events. Fix: dùng `listTimingAlerts(raceId, {status:'OPEN'})` direct. Lesson: list view của domain entity (alerts) phải query domain endpoint, KHÔNG reuse activity feed generic.
- ➕ Pattern mới: **Cache namespace migration via additive write+read** — old keys với pattern cũ TTL tự expire; new code dùng `master:` prefix; KHÔNG cần manual flush nếu TTL ngắn (15s).

### DB / Cache impact
- **MongoDB:** KHÔNG schema migration. KHÔNG index mới.
- **Redis:** 3 keys mới (đã add vào CLAUDE.md Redis Keys Registry):
  - `master:rr-snapshot:<raceId>` — replace `dashboard-snapshot:<raceId>` (TTL 15s).
  - `master:cc-leaderboard:<raceId>:<courseId>:<limit>` — leaderboard per course (TTL 15s).
  - `master:cc-refresh-lock-user:<userId>` — per-user UX rate-limit (TTL 30s).
- **S3:** NO change.

### Tech debt còn lại (đã chuyển vào known-issues.md)
- TD-F005-01: `racekitPickedUp = 0` placeholder (mysql_race_id mapping pending).
- TD-F005-02: SDK regen pending backend up.
- TD-F005-03: ~~AthleteFlowChart Tailwind bars~~ → ✅ **RESOLVED** commit `1b81a2d` — dual-bar overlay (ghost expected + actual gradient) implemented per design canvas.
- TD-F005-04: Cache key migration `dashboard-snapshot:` → `master:rr-snapshot:` chưa flush manual (TTL 15s tự expire).
- TD-F005-05: Force Refresh BR-CC-10 rework SAU QC reject lần 1.
- TD-F005-06: e2e spec UAT-deferred.
- TD-F005-07: `CourseStatsDto.apiUrl` leak (pre-existing F-002 inherited).

### Test results
- **135/135 PASS** (109 baseline F-001+F-002 + 12 new F-005 + 14 QC adversarial).
- Backend `npm run build` clean.
- Admin `tsc --noEmit` zero errors trong scope.

### Lessons learned
1. **QC catch dead code BR-CC-10** — service forceRefresh đầy đủ logic + 3 unit tests PASS, NHƯNG controller không expose endpoint → frontend button không bấm được. Pattern phải apply: **mỗi service method PUBLIC → cần HTTP route hoặc internal-only doc**.
2. **Targeted QC re-run hiệu quả** — KHÔNG full 5 phases lại, chỉ verify 4 items targeted (endpoint exists / DTO + client / button render / regression maintained). Tiết kiệm ~8 phút vs full re-run.
3. **2-layer rate-limit pattern reusable** — F-006 (Course Map upload) + F-008 (Kiosk lookup) có thể reuse pattern này nếu cần anti-stampede + per-user UX guard.
4. **Design canvas fidelity audit BẮT BUỘC khi có HTML mockup reference** — Coder ban đầu code function-correct nhưng visual ~70% match canvas (3 duplicate sections + missing tokens + Inter thay Plus Jakarta Sans). User feedback: "tao khá kì vọng vào cái design đó". Fix: Manager + PO/BA audit duplicate detection + Coder visual polish round → fidelity ~98%. Lesson: pre-QC checklist MUST include "audit duplicate sections + verify design tokens + typography stack".
5. **Generic snapshot field ≠ dedicated entity list** — `AlertFeedPanel` ban đầu dùng `snapshot.recentActivity` (mix poll events + alert events) → user thấy "poll.completed completed" spam thay vì miss chip alerts. Fix: switch sang `listTimingAlerts(status:OPEN)` query trực tiếp. Lesson: list view của entity X phải query endpoint của X, KHÔNG reuse generic activity feed.
6. **Branch isolation trong cluster (Race Ops F-005..008)** — branch `5bib_racemonitor_v1` chứa CẢ F-001 + F-002 + F-005 chưa merge main. Manager KHÔNG tự open PR — Danny click manual khi sẵn sàng merge cluster.

---

## [2026-05-05] FEATURE-004: Reconciliation Download via Backend (Fix S3 Direct Link)

**Branch:** `5bib_admin_recon_bugs_v1` (cùng branch với F-003)
**Type:** BUGFIX

### Why
Danny report bug prod: curl S3 URL `https://5sport-media.s3.../reconciliation.xlsx` với `Authorization: Bearer logto-session` → 403 AccessDenied. Root cause: admin UI render S3 URL trực tiếp (`data.xlsx_url || /api/...` short-circuit) — khi backend upload S3 thành công, UI ưu tiên S3 URL → S3 không hiểu Bearer Logto auth scheme (chỉ accept SigV4 signed) → 403.

Fix hướng A: Admin UI luôn gọi backend endpoint `/api/reconciliations/:id/download/{xlsx|docx}` (đã có sẵn từ trước, hoạt động đúng với LogtoAdminGuard). Bucket S3 giữ private (file đối soát chứa data tài chính).

### Files changed (3)

**Frontend admin (2 modify):**
- ✏️ `admin/src/app/(dashboard)/reconciliations/[id]/page.tsx` — line 127-132 JSDoc cảnh báo `xlsx_url`/`docx_url` field; line 536+546 drop `data.xlsx_url \|\|` / `data.docx_url \|\|` short-circuit.
- ✏️ `admin/src/app/(dashboard)/reconciliations/new/page.tsx` — line 132-137 JSDoc tương tự cho type `CreateResult`; line 1035+1050 drop short-circuit.

**Tests (1 new — QC-authored):**
- ➕ `admin/e2e/reconciliation-download.spec.ts` — 11 Playwright tests (Detail page × 6, Create flow skip, Security × 3, 10x stability × 1).

### Architecture impact

KHÔNG đổi. Backend endpoint `/api/reconciliations/:id/download/{xlsx|docx}` đã tồn tại từ trước, hoạt động đúng với LogtoAdminGuard. KHÔNG đổi S3 bucket policy.

### Conventions impact

- ➕ Anti-pattern mới: "Render S3 URL trực tiếp ở admin UI khi bucket private" — sai vì Bearer auth của app != AWS SigV4. Fix: backend stream endpoint với app-level auth, hoặc presigned URL.
- ➕ Pattern mới: "JSDoc comment cảnh báo field internal-use-only trong response DTO" — chuẩn cho field như S3 URL field mà UI client KHÔNG được render trực tiếp.

### DB / Cache impact

KHÔNG đụng MongoDB / MySQL / Redis. Schema `reconciliations.xlsx_url`/`docx_url` field GIỮ (batch-export.service.ts:157+172 vẫn pipe S3 → ZIP server-side với AWS SDK signed request — path đúng).

### Tech debt còn lại (đã chuyển vào known-issues.md)

- TD-F004-01: JSDoc cảnh báo chỉ là comment, không lint enforce.
- TD-F004-02: Backend re-generate buffer mỗi request, không cache.
- TD-F004-03 ↔ TD-F003-03 GỘP: Frontend Playwright UAT chưa chạy.
- TD-F004-04: Spec cần env vars + Logto storage state setup.

### Lessons learned

1. **Bucket private + UI render URL trực tiếp = bug 100%** — bất kỳ field response nào là S3 URL của bucket private đều phải có JSDoc cảnh báo + endpoint thay thế.
2. **Pattern fallback `data.url || /api/...`** — tưởng defensive nhưng thực ra bug magnet vì khi `url` populate sẽ override path đúng. Tốt hơn: 1 path duy nhất.
3. **Field internal-use only nên có JSDoc** — pattern reusable cho domain khác có S3 URL field.
4. **Backend re-generate per-request** — đảm bảo data fresh + tenant_metadata real-time. Trade-off với cache: với volume admin thấp, simpler hơn cache invalidate logic.
5. **Branch chung F-003 + F-004** — hợp lý vì cùng module reconciliation, cùng UAT session.

---

## [2026-05-05] FEATURE-003: Reconciliation Period Bugs + Multi-Month Range Support

**Branch:** `5bib_admin_recon_bugs_v1` (từ `release/v1.6.3`)
**Type:** BUGFIX (2 bug Danny report) + EXTEND_EXISTING (multi-month range business model)

### Why
Danny report 2 bug user-visible:
1. Modal "Tạo đối soát hàng loạt": chọn Tháng 4 → "Kỳ được chọn: Tháng 5" (off-by-one giữa 0-indexed state và 1-indexed display label).
2. Form "Tạo đối soát mới": chọn 22/03 → 30/04 → frontend `period = periodStart.slice(0,7)` collapse range về single tháng → bỏ qua tháng 4.

Đồng thời mở rộng business model theo Q1+Q2 Danny chốt: BTC có case đối soát theo "giai đoạn vé" >1 tháng (vd: early-bird Q1) → 1 reconciliation cover N tháng tròn liên tiếp (1≤N≤12).

### Files changed (22 file)

**Backend (12 modify + new + tests):**
- ✏️ `backend/src/modules/reconciliation/dto/batch-create-reconciliation.dto.ts` — `@IsPeriodString` cho period.
- ✏️ `backend/src/modules/reconciliation/dto/preview-reconciliation.dto.ts` — `@IsPeriodBoundaryDate('start'/'end')` + `@IsValidPeriodRange` cho period_start/end. CreateDto inherits.
- ✏️ `backend/src/modules/reconciliation/schemas/reconciliation.schema.ts` — thêm compound index `{tenant_id: 1, mysql_race_id: 1, period_start: 1, period_end: 1}`.
- ✏️ `backend/src/modules/reconciliation/reconciliation.service.ts` — thêm `auditPeriodBoundary()` + `diffDays()`.
- ✏️ `backend/src/modules/reconciliation/services/reconciliation-preflight.service.ts` — thêm `runRange()` (BR-11 overlap detection, status `$ne: 'draft'` Caveat-01).
- ✏️ `backend/src/modules/reconciliation/services/docx.service.ts` — render kỳ qua `renderPeriodLabel()`.
- ✏️ `backend/src/modules/reconciliation/services/xlsx.service.ts` — render kỳ qua `renderPeriodLabel()`.
- ✏️ `backend/src/modules/reconciliation/reconciliation.controller.ts` — 2 endpoint mới + dùng PreflightBatchDto class.
- ✏️ `backend/src/modules/reconciliation/export/batch-export.service.ts` — filename qua `filenamePeriodSegment()`.
- ➕ `backend/src/common/validators/period.validator.ts` — 3 custom decorator + 2 helper (lastDayOfMonthUTC, monthsBetweenInclusive).
- ➕ `backend/src/common/validators/period.validator.spec.ts` — 45 tests.
- ➕ `backend/src/modules/reconciliation/services/period-label.helper.ts` — DRY `renderPeriodLabel()` + `filenamePeriodSegment()`.
- ➕ `backend/src/modules/reconciliation/services/period-label.helper.spec.ts` — 8 tests.
- ➕ `backend/src/modules/reconciliation/dto/preflight-batch.dto.ts` — class DTO mới (thay inline type).
- ➕ `backend/src/modules/reconciliation/dto/preflight-range.dto.ts` — DTO endpoint range.
- ➕ `backend/src/modules/reconciliation/dto/audit-period-boundary.dto.ts` — response DTO audit.
- ➕ `backend/src/modules/reconciliation/reconciliation.service.spec.ts` — 7 tests audit BR-10.
- ➕ `backend/src/modules/reconciliation/services/reconciliation-preflight.service.spec.ts` — 7 tests runRange BR-11.
- ➕ `backend/src/modules/reconciliation/reconciliation.controller.spec.ts` (QC-authored) — 21 tests (validation + 10x stability + route ordering).

**Frontend admin (5):**
- ✏️ `admin/src/app/(dashboard)/reconciliations/page.tsx` — modal off-by-one fix (state 1-indexed, default tháng trước cross-year, `formatPeriod` BR-12).
- ✏️ `admin/src/app/(dashboard)/reconciliations/new/page.tsx` — thay date-range UI bằng `<MonthRangePicker />`, gọi `POST /preflight/range`, fix `getTodayStr()` UTC+7-safe (xóa `getMonthStart/getMonthEnd`).
- ➕ `admin/src/app/(dashboard)/reconciliations/audit/page.tsx` — Screen 3 audit page.
- ➕ `admin/src/components/reconciliation/MonthRangePicker.tsx` — controlled component, 4 preset (Tháng này / Tháng trước / 3 tháng / Quý trước).
- ➕ `admin/src/lib/period-helpers.ts` — VN-tz-safe helpers: `currentVnYearMonth`, `monthRangeToPeriod`, `lastDayOfMonth`, `formatPeriodLabel`, presets.

### Architecture impact

- 2 endpoint mới trên ReconciliationModule:
  - `POST /reconciliations/preflight/range` — multi-month preflight + BR-11 overlap detection.
  - `GET /reconciliations/audit/period-boundary` — read-only audit cho period_start/end snap month-boundary (BR-10).
- Compound index 4-field trên `reconciliations` collection — phục vụ overlap query.
- Business invariant updated: 1 recon = 1 race × N (1≤N≤12) tròn tháng liên tiếp. period_start luôn `YYYY-MM-01`, period_end luôn `YYYY-MM-{lastDay}`.

### Conventions impact

- ➕ Pattern mới **"Custom class-validator decorator"** — `backend/src/common/validators/[name].validator.ts`. Cross-field decorator dùng `unknown` + property access (NEVER `any`).
- ➕ Pattern mới **"Frontend timezone-safe date helpers"** — UTC math + string template, **NEVER** `toISOString().slice(0,10)`.
- Reaffirm: ValidationPipe global `whitelist + forbidNonWhitelisted` — DTO field PHẢI có validator (`@IsOptional` cho field optional) nếu không sẽ bị strip silently.

### DB / Cache impact

- **MongoDB:** thêm compound index `{tenant_id: 1, mysql_race_id: 1, period_start: 1, period_end: 1}`. AutoIndex foreground build < 1s với 18 docs. Schema field KHÔNG đổi.
- **MySQL platform:** không đụng. Order query `BETWEEN` đã hỗ trợ range natively.
- **Redis:** không thêm cache mới.

### Tech debt còn lại (đã chuyển vào known-issues.md)

- TD-F003-01 → 06 (xem `known-issues.md`).
- **TD-F003-03 BLOCKER cho production:** Frontend Playwright UAT chưa chạy. PM/QA phải verify thủ công 2 bug Danny trước khi merge prod.

### Test results

- 84/84 PASS (5 suites).
- Regression: 7 pre-existing fail (jose ESM trong logto-auth) — không liên quan F-003.

### Lessons learned

1. **ValidationPipe `whitelist: true` strip field thiếu validator** — DTO optional field PHẢI có `@IsOptional()`. QC bắt issue trong cùng review pass (PreflightBatchDto.merchant_ids).
2. **NestJS route ordering** — route literal (`audit/period-boundary`) PHẢI declare TRƯỚC `:id` route trong cùng controller, nếu không sẽ shadowed. QC viết test pin behavior.
3. **Multi-month business model** mở ra cần update HẾT: schema invariant, query, render label DOCX/XLSX, filename ZIP, frontend UI. DRY helper (`period-label.helper.ts`) là pattern đáng tái sử dụng.
4. **Custom class-validator cross-field**: dùng `args.object as Record<string, unknown>` thay `any` — type safety preserved, pattern reusable.
5. **Frontend `toISOString().slice(0,10)` là anti-pattern** — bỏ luôn ra khỏi codebase admin trong feature này (BR-06). Pattern thay thế: UTC math + string template.
6. **Schema enum constraint** — overlap query định loại 'cancelled' nhưng schema thực không có enum đó. Phải check schema source code trước khi query state filter (Caveat-01 — Manager fixed thành `$ne: 'draft'`).

---

## [2026-05-04] FEATURE-002 Round 3: TD-008 31 unit tests + TD-010 fix

**Commit:** `31cc698`
**Type:** TEST + BUGFIX

### Files changed (4)
- ➕ Added: `backend/src/modules/timing-alert/services/simulator-helpers.spec.ts` — 22 tests cho safeParseMap (4), extractVisibleKeysFromJson (3), filterMapField (3), filterTimesField visibleKeys (3), deriveScalarsFromTimes (4), filterAthlete (5)
- ➕ Added: `backend/src/modules/timing-alert/services/reset-exceptions.spec.ts` — 9 tests cho 4 exception branches của resetRaceData (BR-A1 NotFoundException, BR-A2 ConflictException race-status, BR-A4 BadRequestException confirmToken, BR-A3 ConflictException lock-held)
- ✏️ Modified: `backend/src/modules/timing-alert/services/simulator.service.ts` — add `export const __test__` namespace với 6 helper references để spec test access file-local pure functions
- ✏️ Modified: `backend/src/modules/timing-alert/utils/parsed-athlete.spec.ts` — fix line 93 expectation `checkpointTimes.Finish` to `toBeUndefined()` match mergeTimes filter-empty behavior

### Test results
- Before: 77/78 pass (1 pre-existing fail in parsed-athlete.spec)
- After: **109/109 pass** (+31 F-002 new + 1 fixed pre-existing)

### Lessons learned
- File-local pure functions cần test → expose qua `export const __test__ = {...}` namespace, KHÔNG cần refactor sang public API
- Pre-existing failing tests phải fix sớm để unmask regression visibility cho feature mới — nếu để tồn tại, mỗi `npm run test` sẽ có noise, dễ miss regression mới

---

## [2026-05-04] FEATURE-002 Round 2: Race elapsed clock + toast discrimination + empty state

**Commit:** `a9969cb`
**Type:** EXTEND_EXISTING + BUGFIX

### Files changed (6)
- ✏️ Modified: `backend/src/modules/timing-alert/services/dashboard-snapshot.service.ts` — `computeRaceStartedAt(race)` 3-tier fallback chain (statusHistory `to=live` → race.startDate+earliest course.startTime → most recent statusHistory.changedAt). Wired vào `RaceMetaDto` response.
- ✏️ Modified: `backend/src/modules/timing-alert/dto/dashboard-snapshot.dto.ts` — extend `RaceMetaDto` với `startedAt: string|null` + `startedAtSource: 'status_history'|'course_start_time'|'recent_history'|null`
- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/CockpitTab.tsx` — NEW `RaceElapsedClock` component (1Hz client-side ticker, 3 modes: race-pre-start gray, race-live emerald with pulse, race-ended gray static + warning UI khi status=live but startedAt=null)
- ✏️ Modified: `admin/src/lib/timing-alert-api.ts` — sync `RaceMeta` interface với DTO + NEW `HttpError` class extends Error retains status code (clientGet/Post/Patch throw HttpError instead of plain Error)
- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/timing-alerts/config/page.tsx` — reset mutation onError discriminate err.status (404/409/400/500) với 4 distinct toast handlers per PRD F-002 BR-A spec
- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/AlertDetailDialog.tsx` — empty state message "Course chưa config checkpoints" → "Chưa có data trajectory" với hint giải thích 2 nguyên nhân (BR-C2)

### Architecture impact
- Add `Race elapsed time computation` flow trong dashboard-snapshot service (data source priority chain)

### Conventions impact
- ➕ Pattern: **Custom Error subclass retains status code** (frontend `err instanceof HttpError && err.status === 404` để discriminate UX)

### Lessons learned
- Race data quality issues (`Giải CA` race với `startDate=undefined` + history thiếu `to=live` entry) cần Tier 3 fallback graceful — đừng để clock null + force user fix DB

---

## [2026-05-04] FEATURE-002 Round 1: UX & Robustness Polish (Post-FEATURE-001)

**Branch:** `5bib_racemonitor_v1` (KHÔNG merge main per Danny request)
**Type:** EXTEND_EXISTING + BUGFIX (mixed)
**Note:** Retroactive feature — code shipped trong session debug post-FEATURE-001 pilot

### Files changed (8 code + 1 doc + 1 DB op)

**Backend (4)**
- ✏️ Modified: `backend/src/modules/timing-alert/services/timing-alert-poll.service.ts` — `resetRaceData()` dùng NestJS exception classes (NotFoundException/ConflictException/BadRequestException) thay vì plain Error → HTTP 404/409/400 với message rõ thay vì 500 generic. Parser fallback `athlete.contest = course.name` khi vendor RR API không emit Contest field. `getAlertDetail()` thêm course lookup fallback by checkpoint set khi name match fail.
- ✏️ Modified: `backend/src/modules/timing-alert/services/simulator.service.ts` — `filterAthlete()` extend filter cho 5 map fields (Paces/TODs/Sectors/OverallRanks/GenderRanks) + 11 scalar fields (ChipTime/GunTime/Pace/OverallRank/GenderRank/CatRank/OverrankLive/Gap/Certi/Certificate/Finished). Add helpers `filterMapField`/`extractVisibleKeysFromJson`/`safeParseMap`. `filterTimesField` return thêm `visibleKeys: Set<string>`. New `deriveScalarsFromTimes()` re-derive scalars POST-scenarios (vì scenarios drop chip keys nhưng không touch scalars → inconsistent). `isFreshReset` detection (status='created' && accumulated=0 → cutoff=-1) cho semantic "race chưa start".
- ✏️ Modified: `backend/src/modules/timing-alert/dto/dashboard-snapshot.dto.ts` — add `RaceMetaDto.startedAt: string|null` + `startedAtSource: 'status_history'|'course_start_time'|null` (placeholder cho race-elapsed feature, parked).
- ✏️ Modified: `backend/src/modules/timing-alert/services/dashboard-snapshot.service.ts` — emit `startedAt: null, startedAtSource: null` (placeholder).

**Admin frontend (3)**
- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/timing-alerts/page.tsx` — SSE invalidation debounce 1500ms (chống storm khi race day 1000+ alerts/cycle), extend invalidate scope to `timing-alerts-stats` query key.
- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/AlertsTab.tsx` — refactor major: 4 `useInfiniteQuery` per severity (CRITICAL/HIGH/WARNING/INFO) + 1 `useQuery` stats. PageSize 100→20. Drop `refetchInterval=30s` (rely on SSE). Per-severity Load more button (BTC chỉ load thêm sev họ care). Search filter in-memory chỉ filter loaded items với label "Showing X match".
- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/AlertDetailDialog.tsx` — popup width `max-w-6xl` (1152px) → `sm:!max-w-[760px]` (vuông hơn cho race day).

**Docs (1 new)**
- ➕ Added: `docs/HDSD-timing-alert.md` — Hướng dẫn sử dụng cho ops, 9 sections + FAQ. Cover 3 alert states, 2 detection types (MIDDLE_GAP cứng vs PHANTOM dự đoán), 4 severity levels, workflow xử lý alert, 3 config knobs (Poll interval / Overdue threshold / Top N → CRITICAL), tình huống thường gặp.

**DB backfill (1-time op, manual script)**
- 🔧 5213 timing_alerts updated với `contest = course.name` (5Km: 383, 10Km: 2151, 21KM: 1775, 42Km: 904) — fix legacy alerts có `contest=null` (vendor RR không emit Contest field).

### Architecture impact
- KHÔNG service mới
- Add semantic: SSE invalidation debounce 1500ms cho `timing-alerts/page.tsx`
- Race elapsed time DTO field placeholder (parked feature)

### Conventions impact
- ➕ Pattern: **NestJS exception class > generic Error** (reinforce existing anti-pattern)
- ➕ Pattern: **Per-severity infinite query > 1 big paginated query** với manual Load more
- ➕ Pattern: **SSE invalidation debounce coalesce** (1500ms) chống storm
- ➕ Pattern: **Re-derive scalar fields post-mutation** (filterAthlete pre + deriveScalarsFromTimes post-scenarios)
- ➕ Pattern: **Vendor field nullable → server-side fallback** (parser sets contest = course.name khi vendor null)

### DB / Cache impact
- MongoDB: KHÔNG schema migration. 1-time data backfill 5213 alerts
- Redis: KHÔNG đụng key registry
- S3: NO change

### Tech debt còn lại (moved to known-issues.md)
- TD-008: 8 unit tests deferred (4 simulator helpers + 4 exception branches)
- TD-009: DB backfill ambiguous course (252 alerts có thể assigned 5K thay vì 10K/21K/42K)
- TD-010: Pre-existing `parsed-athlete.spec.ts` failure (commit 880ec54) — masks regression visibility
- TD-011: Race elapsed time feature parked
- TD-012: Frontend search filter chỉ filter loaded items

### Lessons learned
- **NestJS Error → 500 generic** là common trap. Mỗi business validation phải dùng đúng exception class. Generic `throw new Error(...)` lost message + stack trace exposure risk.
- **Filter logic 2 pass** (pre-scenario time-based + post-scenario scalar re-derive) is cleaner than 1 monster pass. Each pass có invariant rõ ràng.
- **Frontend pagination per-severity > 1 big paginated** cho dashboard có severity grouping. BTC ưu tiên CRITICAL — không nên kéo qua 299 CRITICAL mới đến WARNING.
- **SSE invalidation needs debounce** trên cao tần. Without debounce, race day 1000+ alerts → 1000+ refetches → API quota burn + UI flicker.
- **Vendor field nullable** (Contest field RR API) phải có server-side fallback. Frontend không thể tự derive course từ alert vì alert ID không carry course info.

---

## [2026-05-04] FEATURE-001: Timing Alert Discovery + Simulator Completion (Phase A+B+C)

**PR/Commit:** branch `condescending-dewdney-757430`; hotfix `CourseCheckpointDto.distanceKm` = 804f707
**Type:** EXTEND_EXISTING

### Files changed (11 in scope + 1 hotfix)

**Phase A — Simulator + Scenarios fix (4)**
- ✏️ Modified: `backend/src/modules/timing-alert/services/simulator.service.ts` — `filterTimesField` keeps all keys with value="" beyond cutoff (match real RR vendor schema). Apply same filter to Guntimes.
- ✏️ Modified: `backend/src/modules/timing-alert/services/scenario-engine.ts` — `dropKeyFromItem` sets value="" in BOTH Chiptimes + Guntimes (symmetric drop) instead of deleting key.
- ➕ Added: `backend/src/modules/timing-alert/services/simulator-filter.spec.ts` — 9 unit tests for BR-01.
- ➕ Added: `backend/src/modules/timing-alert/services/scenario-engine.spec.ts` — 9 unit tests for BR-02.

**Phase C — Discover algorithm simplify (3)**
- ✏️ Modified: `backend/src/modules/timing-alert/services/checkpoint-discovery.service.ts` — `discover()` rewritten with schema-from-1-athlete (sample 10, ≥80% consistency threshold) + fallback aggregate. Drop coverage% + median columns from response.
- ➕ Added: `backend/src/modules/timing-alert/services/checkpoint-discovery.service.spec.ts` — 5 unit tests covering vendor consistent + fallback paths + empty race.
- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/timing-alerts/components/CheckpointDiscoveryDialog.tsx` — drop 2 columns, simplify mini editable table.

**Phase B — Auto-trigger preview (5)**
- ✏️ Modified: `backend/src/modules/timing-alert/services/checkpoint-discovery.service.ts` — added `discoverAndCachePreview()` + `getCachedPreview()` with Redis SETNX lock TTL 30s + JSON cache TTL 1h (60s on error).
- ✏️ Modified: `backend/src/modules/timing-alert/controllers/timing-alert-admin.controller.ts` — `GET /discover-preview/:courseId` endpoint.
- ✏️ Modified: `admin/src/lib/timing-alert-api.ts` — `discoverPreview()` helper.
- ✏️ Modified: `admin/src/app/(dashboard)/races/[id]/edit/page.tsx` — wire `<DiscoverPreviewPanel>`.
- ➕ Added: `admin/src/app/(dashboard)/races/[id]/edit/components/DiscoverPreviewPanel.tsx` — frontend-driven debounce 800ms apiUrl change → trigger discover; BR-09 MERGE preserve names via existingByKey map; 5-col mini editable table.

**Hotfix (post-QC, related-scope, commit 804f707)**
- ✏️ Modified: `backend/src/modules/races/dto/add-course.dto.ts` — added `@IsOptional() @IsNumber() distanceKm?: number` to `CourseCheckpointDto`. Without this, `PATCH /races/:id/courses/:courseId` returned 400 because NestJS `whitelist:true, forbidNonWhitelisted:true` rejected unknown field. Required because DiscoverPreviewPanel emits checkpoints with numeric `distanceKm`.

**QC adversarial tests (added in QC phase, +10)**
- ➕ Added: `backend/src/modules/timing-alert/services/checkpoint-discovery-lock.spec.ts` — 10 tests covering BR-06 Redis SETNX lock (acquire / skip / release / 10x concurrency stability).

### Architecture impact
- **Discover Preview Cache Flow** added in timing-alert module:
  ```
  Admin paste apiUrl in race edit form
     ↓ (frontend debounce 800ms)
  POST /discover-checkpoints (existing) → render preview client-side
     │
     │  parallel: backend background path (future cron pre-warm)
     ↓
  CheckpointDiscoveryService.discoverAndCachePreview(raceId, courseId)
     ↓
  Redis SETNX `master:discover-lock:{race}:{course}` (TTL 30s)
     ├─ acquired → fetchRaceResults → run schema-from-1 → cache `discover-preview:{race}:{course}` (TTL 1h, 60s on error) → DEL lock
     └─ lock-held → skip + log warn (10x concurrent calls → only 1 fetches RR API, verified by adversarial test)
     ↓
  GET /discover-preview/:courseId reads cache or returns null
  ```
- Module DI graph unchanged. No new MongoDB collection. No event-emitter dependency added (deferred to avoid circular DI between RacesModule ↔ TimingAlertModule).

### Conventions impact
- ➕ New pattern documented: **Schema-from-1-athlete with fallback** (sample N, threshold consistency, else fallback aggregate)
- ➕ New anti-pattern documented: **Set `value=""` instead of delete keys** when filtering vendor JSON (Chiptimes/Guntimes) — must match real RR vendor schema (always full keys, value="" for unreached checkpoints)
- ➕ Reinforces existing **Redis SETNX lock with TTL** pattern (now 3rd usage in codebase: render-lock, master:sync-lock, master:discover-lock)

### DB / Cache impact
- MongoDB: NO schema migration. Mixed-type fields `Chiptimes`/`Guntimes` raw RR JSON strings unchanged.
- Redis: 2 NEW keys
  - `master:discover-lock:<raceId>:<courseId>` — SETNX TTL 30s (BR-06 concurrent guard)
  - `discover-preview:<raceId>:<courseId>` — JSON cache TTL 1h (60s on error)
- S3: NO change.

### Tech debt còn lại (đã move sang known-issues.md)
1. E2E API + Playwright UI tests deferred — manual UAT plan needed
2. `pnpm --filter admin generate:api` chưa chạy — endpoint `GET /discover-preview/:courseId` chưa expose qua SDK
3. Cache key namespace inconsistency — `discover-preview:` không có `master:` prefix
4. Event hook auto-trigger DEFERRED — frontend-driven equivalent
5. DiscoverPreviewPanel chỉ trigger trong edit mode — add new course không thấy preview
6. BR-09 MERGE preserve names — frontend logic, không có unit test
7. SSRF risk pre-existing — apiUrl admin trust

### Lessons learned
- **Verify vendor data before assuming schema.** Trước feature này 2 lần đã giả định nhầm: (1) 42K Chiptimes không có Finish (sai — Guntimes có), (2) 42K dùng TM5 implicit Finish (sai — có cả TM5 + Finish riêng). Real curl API confirmed luôn full schema, value="" cho unreached. Bài học: `curl` real API trước khi viết test fixture.
- **Circular DI là dấu hiệu over-coupling.** Phase B event hook trong RacesService.update gây circular import với TimingAlertModule. Workaround: frontend-driven debounce → cleaner architecture, không cần event-emitter dep.
- **DTO whitelist phải sync với Mongoose schema.** `CourseCheckpointDto` thiếu `distanceKm` → 400 silent (admin form blank error). Quy tắc: mỗi field trong Mongoose `Course` subschema phải có decorator tương ứng trong DTO `CourseCheckpointDto` + `AddCourseDto`.
- **Test fixture sai có thể "rescue" bug.** Phase A scenario-engine bug suýt thoát QC: `mergeTimes(Chiptimes, Guntimes)` ở downstream "rescue" Chiptimes drops vì Guntimes vẫn có. Fix: scenario phải drop CẢ HAI fields symmetric. Bài học: test fixture nên reflect downstream real consumer logic.

---

## 📚 Pre-workflow history (TẠM THỜI — context only, NOT in scope)

> Repo có lịch sử git từ April 2026. Workflow này bắt đầu áp dụng từ 2026-05-03.
> Trước đó, history nằm trong git log + các báo cáo manual: `PROGRESS_REPORT.md`, `UAT_Report_TeamManagement.md`.
>
> Manager KHÔNG cần đọc git log mỗi lần — chỉ đọc khi feature mới đụng module có lịch sử "ổn định" (vd: race-result, articles cache, image generation) để hiểu pattern hiện tại.

Major modules đã có trong codebase tính đến bootstrap (2026-05-03):
- 24 NestJS modules trong `backend/src/modules/`
- Logto auth integrated
- Result Image Creator v1.0 (canvas-based, S3 lifecycle 24h)
- Articles cache system (4-5 key prefix, complex invalidation)
- Race master data sync (Redis HSET cache, MySQL fallback — wait, dù CLAUDE.md đề cập MySQL, project repo này KHÔNG có MySQL platform DB; có thể fallback dùng external service hoặc deprecated)
- "Velocity" frontend design system
- VPS deployment via GitHub Actions → GHCR

## [2026-06-08] PROD GO-LIVE — Merchant Portal (F-069 + F-070) release/v1.13.0
- Cut release/v1.13.0 từ main (prod đang v1.12.2 `b6382f0`, delta = 18 commit 100% merchant) → deploy-production.yml.
- Prod ops (/opt/5bib-result-production, VPS same as dev 157.10.42.171): backend.env M2M + MANAGEMENT_RESOURCE + MERCHANT_PORTAL_LOGIN_URL=merchant.5bib.com; merchant.env (BASE_URL prod, cookie riêng); compose +service 5bib-result-merchant **port 3090:3006** container_name **5bib-production-merchant**; nginx merchant.5bib.com + certbot SSL; Logto redirect URI prod đã có.
- deploy-production.yml: +build-merchant job + guarded deploy (non-blocking).
- **LESSON container_name collision:** prod merchant ban đầu để container_name `5bib-result-merchant` TRÙNG container DEV (docker name global-unique) → up fail "name in use". Prod convention = `5bib-production-X`. Fix → `5bib-production-merchant`. Mọi service prod PHẢI dùng prefix `5bib-production-` cho container_name.
- Verified PROD: result.5bib.com merchant endpoints 401-gated; merchant.5bib.com 307→sign-in 200 + SSL; admin.5bib.com 200.
- **Còn lại:** PROD Mongo (27019) chưa có access record → BTC dùng được sau khi gán quyền qua admin PROD (M2M đã set, dialog đã chạy). Platform MySQL dùng chung → data thật sẵn.

## [2026-06-08] FEATURE-077 — Merchant báo cáo: đếm vé IMPORT (codes-based) + 2 follow-up

**Trigger:** Danny — "vé import cần tính vào mới ra số tổng" + PROD review bắt 2 lỗi.

**Root cause:** báo cáo bán vé đếm từ `order_metadata` (đơn 5BIB) → bỏ sót vé import
(`codes.order_id NULL`, import_tracking_id). Race 209: 402→644; race 124: undercount→7176.

**Files (backend/src/modules/merchant-portal):**
- `services/merchant-portal.service.ts`: +CODE_SOLD_FILTER, +NO_DATA_LABEL, +pullIssuedCodeTotals
  (total/5bib/import/cancelled trong 1 query). getTicketSalesSummary +totalIssued/issued5bib/
  issuedImport/cancelledIssued. getTicketSalesByCourse/ByType → codes-based + source split.
  getCapacity sold → codes correlated subquery. getParticipantInsights +totalIssued/
  participantsWithData/issuedImport + gap bucket "Chưa có dữ liệu" cho 4 chart nhân khẩu.
- `dto/ticket-sales.dto.ts` (+5 field), `dto/participant-insights.dto.ts` (+3 field).
- `services/*.spec.ts`: codes-based mocks + gap-bucket tests. 172 jest PASS.
- merchant FE `app/races/[raceId]/page.tsx`: Tổng vé=totalIssued + source sub, KPI "Vé import",
  "Vé đã huỷ"=cancelledIssued (was voided-order qty), participant total+coverage note.
  `lib/api-generated/types.gen.ts` (+fields), `lib/mp/i18n.ts` (+6 key ×5 lang).

**2 follow-up (PROD review):**
- "Vé đã huỷ" = SUM voided-order qty (thổi phồng: race 124=2202) → codes INACTIVE (=15).
- Cơ cấu VĐV charts không cộng ra tổng → bucket "Chưa có dữ liệu"=(totalIssued−withData).

**Releases:** v1.15.0 (f9eda42: F-072/073/074 + fee-fix + import counting) → v1.15.1 (21bcae3:
+đã-huỷ INACTIVE + cơ cấu gap bucket). Cả 2 trên PROD.
