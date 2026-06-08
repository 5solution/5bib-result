# 5BIB Result — Known Issues & Tech Debt

> **Owner:** 5bib-manager
> **Bootstrap source:** CLAUDE.md "Common Issues & Solutions" + "Pre-Deploy Checklist" + "Fields Nguy Hiểm"
>
> DANH SÁCH "vùng cẩn thận" — Manager đọc khi `/5bib-init` để cảnh báo Coder/QC về risk có sẵn.

---

## 🔴 Critical (cần fix sớm)

| ID | Module | Issue | Phát hiện | Owner |
|----|--------|-------|-----------|-------|
| **TD-F016-FINANCE-01** 🚨 | reconciliation / accounting | **15 reconciliations cũ shipped với data SAI** trước F-016 v1.6.5 — `FIVE_BIB_CATEGORIES` whitelist chỉ có 3/6 enum nên drop 613 đơn 5BIB-eligible (82 GROUP_BUY + 517 GROUP_BUY_FIXED + 14 CODE_TRANSFER) khỏi reconciliation gross/fee. Race 117 Cat Tien April 2026 (recon `69f9488ab13b71f5c5f970ec`) thiếu 10,366,400 VND. Analytics dashboard đếm GMV ĐÚNG (filter `!= 'MANUAL'`) → discrepancy với recon cũ là cố hữu. **Accounting MUST biết trước khi v1.7.0 recompute migration chạy** để giải thích delta cho 58 merchant tenants. | 2026-05-08 (FEATURE-016 QC + Manager deploy v1.6.5) | Danny + Finance |
| **TD-2026-05-12-CRIT-01** ⏸️ DEFERRED | repo root | `dump.rdb` Redis dump (120 byte empty) commit trong repo + **KHÔNG có root `.gitignore`**, chỉ có per-workspace. Future Redis save có data thật → leak risk. | 2026-05-12 ULTRAREVIEW | **Danny defer 2026-05-12 — "dev làm là có lý do"** (test file intentional). Track: nếu file size grow >120 byte → reassess. Fix cost 5 phút (`rm dump.rdb && cat > .gitignore`). |
| **TD-2026-05-12-CRIT-02** ⏸️ DEFERRED | docker-compose.yml:14 | `JWT_SECRET=${JWT_SECRET:-5bib-secret-key-change-in-production}` hardcoded fallback. Dev quên set env → secret bake (string nằm trong git). Worst case admin forge JWT bypass auth = data wipe 195 races + 94K athletes + 42K orders. | 2026-05-12 ULTRAREVIEW | **Danny defer 2026-05-12 — dev intentional cho local dev convenience (assume prod VPS `/opt/5bib-result/.env` đã override).** Track: verify VPS env có `JWT_SECRET=<random>` override. Nếu thiếu → rotate ngay (sẽ logout admin). Fix cost 15 phút. |
| **TD-2026-05-12-CRIT-03** ⏸️ DEFERRED | upload.service.ts | ZERO validation: không MIME, không magic-bytes, không size limit, dùng `file.originalname` raw vào S3 key. Exploit path: (1) stored XSS qua S3 URL (upload `.html` với Content-Type image/png → browser sniff render HTML XSS in 5bib.com cookie context); (2) path traversal `../../etc/passwd`; (3) DOS upload 5GB. | 2026-05-12 ULTRAREVIEW | **Danny defer 2026-05-12 — dev có lý do (WAF/CloudFront cover hoặc bucket policy hạn chế).** Track: nếu plan tắt WAF / chuyển CDN → reassess. Fix cost ~3-4h (port pattern `team-contract.service.ts:205`). REF-07 centralize file-upload security helper future. |
| **TD-2026-05-12-CRIT-04** ⏸️ DEFERRED | timing-alert / race-result-api / checkpoint-discovery / timing-alert-poll | SSRF: admin paste `apiUrl=http://169.254.169.254/...` → AWS metadata; `http://localhost:9229` → Node inspector; `http://5bib-result-backend:8081/api/admin/*` → bypass FW container. Original TD-007 từ F-001 vẫn OPEN 6 tháng. | 2026-05-12 ULTRAREVIEW (TD-007 inherited from F-001) | **Danny defer 2026-05-12 — dev có lý do (VPS bare metal không phải EC2 → AWS metadata không exist; vendor RaceResult IP whitelist FW level cover external; internal admin trust assumed).** Track: nếu migrate AWS EC2/EKS → URGENT fix. Fix cost 2h (URL hostname whitelist `*.raceresult.com` + reject private CIDR). |
| **TD-2026-05-12-CRIT-CI-01** ⏸️ DEFERRED | .github/workflows/deploy-production.yml | PAT plaintext disk `/opt/.github_token` + hardcoded user `0xaldric` (legacy pre-org migration sang `5solution`). Ai SSH 5solution-vps đều đọc PAT. Nếu PAT expire → next prod deploy fail thầm lặng. | 2026-05-12 ULTRAREVIEW | **Danny defer 2026-05-12 — dev workflow stable, PAT chưa expire.** Track: monitor next prod deploy success. Nếu fail → PAT expired → phải refactor OIDC. Fix cost 2-3h (GitHub Actions OIDC + `${{ secrets.GITHUB_TOKEN }}` + `permissions: packages: read`). |

> **Manager note 2026-05-12:** 5 CRIT trên được Danny chính thức defer với justification cụ thể. Mỗi entry có "Track:" trigger condition — nếu trigger fire → reassess không phải fix vô tội vạ. PROD `release/v*` **VẪN BLOCKED** theo verdict ultrareview cho đến khi defer note này được Danny gỡ. **DO NOT** auto-fix các CRIT này khi `/5bib-init` feature mới — chỉ fix khi Danny explicit request hoặc trigger condition fire.

> **Manager note 2026-05-13 post F-029:** F-029 Hardening Phase 1 + Phase 1.1 đã ship — closes 4 HIGH non-CRIT từ ultrareview (HIGH-RR-01 + HIGH-PERF-01 + HIGH-RBAC-01 + Display sweep). 5 CRIT defer trên VẪN giữ — không fix trong F-029 scope. PROD `release/v1.8.0` cut sẽ chứa F-024 + F-028 + F-029 (3 features) — vẫn block bởi 5 CRIT defer note trên cho đến Danny rotate trigger conditions.

| **TD-F029-NEW-02** 🟡 NEW (post F-029 QC v2) | race-result/race-result.controller.ts:635 | POST `/result-image/:raceId/:bib` (full-res image gen) ungated. Plan Phase 1.1 matrix entry 11 listed GET version only (preview lowres) — Coder gated GET correctly. POST endpoint generates 1080×1350 PNG + S3 cache, identical leak vector. | 2026-05-13 QC v2 adversarial probe | Defer FEATURE-030 Wave 2 |
| **TD-F029-NEW-03** 🟡 NEW (post F-029 QC v2) | race-result/services/race-result.service.ts:812 `globalSearch` | GET `/race-results/search?q=` global search across ALL races returns athletes from draft races (name + bib + raceId leak via name enumeration). Requires service-level filter `race.status != 'draft'` for non-privileged callers, not just controller guard. | 2026-05-13 QC v2 adversarial probe | Defer FEATURE-030 Wave 2 (~30-45 phút Coder + 2 tests) |
| **TD-F029-01** 🟡 LOW | finance/services/fee.service.ts | EXPLAIN ANALYZE bulk SQL `getActualRevenueForRaces` deferred — backend cached binary cần restart từ F-029 worktree để verify MySQL plan optimizer chose index. SQL pattern visually identical F-016 ReconciliationQueryService (in-use prod). | 2026-05-13 PAUSE-MGR-02 | Manager restart backend post-deploy + manual smoke verify EXPLAIN |
| **TD-F029-02** 🟢 LOW | admin/src/app/(dashboard)/reconciliations/new/page.tsx:445 | Skeleton swap screenshot diff deferred — only 1 affected site, LOW visual risk. | 2026-05-13 PAUSE-MGR-03 | Visual smoke during cut release |
| **TD-F029-03** 🟢 LOW | admin/src/app/(dashboard)/team-management/[eventId]/page.tsx + acceptance-templates/page.tsx | 2 redirect-only pages skipped from RBAC wrap (no UI to gate, backend `LogtoStaffGuard` enforces). Theoretical defense-in-depth gap. | 2026-05-13 F-029 Phase B subagent | Acceptable — backend guard enforces real access |
| **TD-F029-04** 🟢 LOW | admin/src/app/(dashboard)/merchants/[id]/page.tsx:735 | Raw enum render `{merchant.contract_status}` capitalize — discovered Phase C subagent but NOT in BR-HD-31 explicit 2-site requirement. Need `CONTRACT_STATUS_LABEL` dict. | 2026-05-13 F-029 Phase C subagent | Defer FEATURE-030 polish |
| **TD-F029-05** 🟢 LOW | race-result.service.spec.ts pre-existing | 5 race-result.service.spec failures NOT addressed by F-029: `syncAllRaceResults > should handle upsert correctly via bulkWrite`, `syncAllRaceResults > should log failure on sync error`, `submitClaim > should create a claim document`, `purgeCache > should delete cache keys matching course patterns`, `getRaceResults > should filter by name search` — all pre-existing test infra debt (mocks missing methods, regex behavior changes). | Pre-F-029 baseline | Defer test infra refactor batch (FEATURE-030+) |
| **TD-F029-INCIDENT-CI-2026-05-13** ✅ RESOLVED | admin/src/app/(dashboard)/team-management/ 4 page files | Subagent Phase B v3 regex script (NOT AST-aware) inserted `if (!isStaff) return <RestrictedAccess />` gate INSIDE useEffect callbacks (or regular function body) in 4 team-management pages — JSX return from `() => void` callback. CI `deploy-production.yml` build-admin FAILED at `pnpm build` step → PROD release/v1.8.0 deploy blocked ~30 phút. 5 verify layers (subagent + Coder Phase D + QC v1 + QC v2 + Manager pre-flight) ALL passed `tsc --noEmit` but missed bug. Local `pnpm build` would have caught immediately. | 2026-05-13 CI build fail post `release/v1.8.0` push | RESOLVED commit `a638b28` (move gate top-level component). Memory updates: conventions.md added CHECK 7 + subagent delegation rule. Full RCA: `.5bib-workflow/features/FEATURE-029-hardening-phase-1/INCIDENT-2026-05-13-CI-BUILD-FAIL-RCA.md`. **Lesson:** Diversity of verify methods needed (tsc + pnpm build + jest + eslint react-hooks). 5 layers same-tool not diverse defense-in-depth. |
| **TD-CI-001** 🔴 CRITICAL | .github/workflows/deploy-production.yml | **PROD compose tag race condition + workflow_dispatch trigger gap.** Phát hiện 2026-05-13 post-F-031 deploy: PROD `/opt/5bib-result-production/docker-compose.yml` pinned ALL 5 services về `4372773` (main commit F-027 docs, KHÔNG có trong release/** branch) thay vì `6e30ef9` (F-031 expected). Backend container running `6e30ef9` (no restart) → Manager verify lần đầu thấy OK → false positive. Admin container restart → pulled `4372773` per compose → mất F-031 button "Import Excel" trên PROD ~2h. **Root cause likely:** Concurrent `deploy-production.yml` runs race — Run A (F-031 release/v1.7.9 `6e30ef9`) và Run B (workflow_dispatch hoặc cross-trigger với main `4372773`) chạy đồng thời, Run B finish SAU Run A → sed compose ends `4372773`. Containers pull tag mới (Run A) nhưng compose pin tag cũ (Run B) → restart inconsistency. | 2026-05-13 Danny báo "vẫn chưa có nút import" → Manager forensics confirms Danny hint "merge 2 cái cùng 1 lúc" | **Recovery 2026-05-13:** Manager SSH PROD → sed update compose ALL 5 services → `6e30ef9` → docker compose pull + up -d --force-recreate → admin live với F-031. **Fix CI workflow (separate TD):** (1) Add `concurrency: { group: deploy-production, cancel-in-progress: false }` → serialize. (2) `workflow_dispatch` handler validate `github.ref` startswith `refs/heads/release/` → reject main triggers. (3) Post-deploy verify: `docker ps` image tags == compose pins → fail workflow nếu mismatch. (4) Backup compose `cp docker-compose.yml{,.bak.$(date +%s)}` trước sed. (5) Manager `/5bib-deploy` verify checklist: BẮT BUỘC check tất cả 5 PROD containers image tag, KHÔNG chỉ backend. |

---

## 🟡 Tech debt (đã biết, chưa ưu tiên)

| ID | Module | Debt | Lý do hoãn | Cảnh báo cho feature đụng vào |
|----|--------|------|-----------|------------------------------|
| **TD-F062-MOM-BOUNDARY-ROLLOVER** ✅ **RESOLVED 2026-05-22 commit `0d1669a`** | analytics / period-resolver | (Was 🟡 MED 🔴 BLOCKING Wave 2) `resolveCompare('mom')` dùng `setUTCMonth(-1)` rolls over khi source day > target month days. Verified bug: `2026-05-31 setUTCMonth(3)` (April) → JS rolls to `2026-05-01` instead of `2026-04-30`. **RESOLUTION:** Wave 2A replaced `setUTCMonth(-1)` with NEW exported `shiftMonthClamped(date, months)` helper (period-resolver.ts:99-123) that clamps day to last-day-of-target-month. 13 NEW unit tests (8 standalone helper + 5 mom boundary regression) + 8 Manager+QC Node REPL adversarial probes ALL PASS. Manager bug case `2026-05-31 → 2026-04-30` test verified `✓ mom: May 31 → April 30 WITHOUT rollover (Manager bug case)`. | Manager spot-check 2026-05-22 caught (defense-in-depth justified). Coder + QC both missed Wave 1, Manager Independent Code Review caught via Node REPL verify. | **RESOLVED — no further action.** Lessons: visual scan ≠ semantic verify (anti-pattern); always test boundary cases day=29/30/31 cho date arithmetic features. |
| **TD-F062-VALIDATION-COMPAREKIND** ✅ **RESOLVED 2026-05-22 commit `0d1669a`** | analytics / DTO | (Was 🟢 LOW) `analytics.controller.ts:157` casts `q.compareWith as CompareKind`. **RESOLUTION:** Wave 2A discovered `repeat-athlete-rate.dto.ts:35` already had `@IsIn(['prev', 'yoy', 'custom', 'none'])` validation (NOT silent fallback as QC originally claimed). Wave 2A extended array to 6 values `['prev', 'yoy', 'custom', 'none', 'wow', 'mom']` aligning with CompareKind type union from Wave 1. Class-validator runtime rejects invalid values → 400 at DTO level. | Discovery via Coder Wave 2A grep audit. QC original claim "accept any string" was inaccurate. | **RESOLVED — no further action.** |
| **TD-F062-F026-SILENT-CAPABILITY-EXPANSION** 🟢 INFORMATIONAL (REFINED 2026-05-22) | analytics / **1 F-026 endpoint** (was claimed "6") | Adj #1 CompareKind extend silently adds `wow/mom` capability cho **only 1 F-026 endpoint** (`repeat-athlete-rate`). **REFINED Wave 2A discovery:** QC original claim "6 endpoints" was theoretical (type extension affects ANY consumer). Reality verified via grep: only `repeat-athlete-rate.dto.ts` has `compareWith` field declared. Other 5 F-026 endpoints (merchant-churn, time-to-fill, claim-rate, geographic-demographic, refund-cancel-rate) don't accept compareWith → no capability expansion there. Cache key namespace separate (no collision). Pure capability gift cho repeat-athlete-rate only, no degradation. | QC Wave 1 finding REFINED by Coder Wave 2A discovery (IMPLEMENTATION_NOTES Section 1 Deviation #6). | Wave 5 decision: market as feature (free UX upgrade for repeat-athlete-rate endpoint to support wow/mom comparison). Smaller scope than originally feared. |
| **TD-F062-PRD-SECTION-3.4-DTO-IMPORT-OVERLAP** 🟢 LOW | docs / PRD v3 + memory codebase-map | PRD Section 3.4.2 list 4 tab pages NEW (`races/page.tsx` + `runners/page.tsx`) nhưng codebase đã có 1530 LoC raw-fetch implementations từ F-026/F-058 series không document trong codebase-map. | Coder Forced Change #1 surface. Wave 1 KHÔNG touch tab pages (defer Wave 3 REFACTOR). | Wave 3 (khi REFACTOR pages): update PRD addendum + codebase-map.md analytics section note "4 tab pages exist từ F-026 era, Wave 3 REFACTOR sang multi-tab layout với TanStack Query migration". |
| **TD-F062-WAVE2B1-CACHE-KEY-DRIFT** ✅ **RESOLVED 2026-05-25 commit `a36d3b6`** | analytics / cache keys | (Was 🔴 BLOCKING Wave 2B-1 v1) 3 NEW revenue endpoint cache keys missed PRD spec: `analytics:weekly-revenue:*` instead of `analytics:metric:weekly-revenue:*` (missing `:metric:` infix → BR-SA-18 invalidation hook would NOT match → STALE CACHE BUG). Also raw `from:to:month` segments instead of stable `periodKey` format → cache miss inflation. Comparison endpoint axis order wrong (compareWith first instead of between scope và periodKey). **RESOLUTION:** EXTENDED Wave 1 `buildMetricCacheKey` helper (period-resolver.ts:337-388) to support `{ tenantId }` scope variant + optional `extra` 4th arg inserted between scope và periodKey per BR-SA-04 line 216. Service refactored to use helper composition: `buildMetricCacheKey(metric, this.resolveQueryScope(query), this.buildPeriodKey(query) [, extra])`. 3 NEW unit tests cho extension + 5 NEW invariant anti-regression tests guard raw cache key re-introduction. | QC Phase 5 PRD line-by-line walk caught (defense-in-depth justified). Coder v1 missed because Self-Review Bước 2 pattern-matched Response shape only, không grep PRD Cache: keyword. | **RESOLVED — no further action.** Lessons: (a) self-review Bước 2 PRD adherence pattern check ALL bullet keywords (Endpoint / Response / Phí / Default / Cache) per BR-XX; (b) Wave 1 helpers (`buildMetricCacheKey`) USE first, không inline equivalent. |
| **TD-F062-WAVE2B1-ENDPOINT-URL-DRIFT** ✅ **RESOLVED 2026-05-25 commit `a36d3b6`** | analytics / controller | (Was 🔴 BLOCKING Wave 2B-1 v1) Comparison endpoint mounted `@Get('revenue/comparison')` instead of `@Get('comparison')` per BR-SA-04 line 200. Wave 3 frontend Tab 1 Comparison Row sẽ 404 because PRD journey table line 749 calls `/analytics/comparison?compareWith=mom`. **RESOLUTION:** controller decorator changed + description tag includes "Mounted at /analytics/comparison per BR-SA-04 line 200 (NOT /revenue/comparison)" baked-in anti-regression hint. Invariant test `not.toMatch(/@Get\('revenue\/comparison'\)/)` guards re-introduction. | QC Phase 5 caught. Coder v1 assumed `/revenue/` namespace correct by symmetry với weekly/monthly. | **RESOLVED — no further action.** Lesson: endpoint URL is one-line spec — quick to verify but easy to miss because feels obvious. |
| **TD-F062-WAVE2B1-DEFAULT-PERIOD-MISSING** ✅ **RESOLVED 2026-05-25 commit `a36d3b6`** | analytics / service | (Was 🟡 MED Wave 2B-1 v1) BR-SA-02/03 spec "Default 12 tuần / 12 tháng gần nhất nếu không truyền from/to" KHÔNG implement → full historical scan when no params (DoS risk + chart 200+ data points unreadable). `validateDateRange` 366-day cap KHÔNG apply on no-param case. **RESOLUTION:** NEW `applyDefaultPeriod(query, granularity)` helper returns NEW query (spread, no mutation) với from = today - 84/365 days. Called FIRST line trong getWeeklyRevenue + getMonthlyRevenue BEFORE validateDateRange → cap NOW applies on default-period. | QC Phase 5 caught. Coder v1 self-review skipped Default behavior spec line. | **RESOLVED — no further action.** Side benefit: DoS risk closed. |
| **TD-F062-WAVE2B1-BUILDMETRICCACHEKEY-EXTEND** ✅ **RESOLVED 2026-05-25 commit `a36d3b6`** | analytics / period-resolver Wave 1 helper | (Was 🟡 MED Wave 2B-1 v1) Wave 1 `buildMetricCacheKey` only supported `'platform' | { raceId }` scope union. F-062 Wave 2B-1 needs `{ tenantId }` variant + optional `extra` axis cho comparison. **RESOLUTION:** Extended helper signature backward-compatible (scope union widened, extra optional 4th arg) — existing 3-arg calls + race scope unaffected, period-resolver.spec.ts:80-86 still pass. | Forced #7 Coder discovery during BLOCKING #2 fix. | **RESOLVED — no further action.** Wave 5: update conventions.md cache key section note "scope variants: platform | race:<id> | tenant:<id>" + 3-axis variant for comparison-style endpoints. |
| **TD-F062-WAVE2B1-FEE-PERF** 🟢 LOW | analytics / FeeService aggregation | Per-(tenant × bucket) `FeeService.computeFeeForOrdersAggregate` calls ≈700/year worst-case (12 weeks × 58 tenants). First-load cold cache estimated p95 3-5s. Cache TTL 15min/24h bảo vệ subsequent loads. | Coder pre-flagged acknowledged tradeoff per IMPLEMENTATION_NOTES Wave 2B-1 Section 4. | Wave 5 k6 PROD-like load test. If p95 > 5s consider redis pipeline batching tenant queries OR pre-aggregate fee via cron extend AnalyticsAggregator. |
| **TD-F062-WAVE2B1-COMPARISON-LABEL-EDGE** 🟢 LOW | analytics / frontend integration | `formatComparisonLabel('yoy', _side)` returns "Năm YYYY" same string cho current vs previous (UI relies on side prop để disambiguate). | Coder pre-flagged tradeoff. | Wave 3 frontend CompareDelta component renders both labels side-by-side, ambiguity resolved at view layer. |
| **TD-F062-WAVE2B1-RACE-FILTER-DEFER** 🟡 MED | analytics / endpoints | 3 NEW revenue endpoints chỉ accept `tenantId` filter, KHÔNG `raceId` (PRD BR-SA-02/03/04 scope = platform/tenant only). | Coder pre-flagged. Race-level revenue scope thuộc về race-performance endpoint Wave 2C. | Wave 2B-2 / Wave 2C nếu BA confirm raceId filter scope cần thiết cho revenue chart at race level (vd: race detail drill-down). |
| **TD-F062-WAVE2B1-LESSON-PRD-BULLET-GREP** 🟢 INFORMATIONAL | process / Coder self-review | Lesson codified Wave 2B-1 v2 IMPLEMENTATION_NOTES Section 1 Deviation #10: Coder Self-Review Bước 2 (PRD strict adherence) pattern-matched Response shape only, missed Endpoint/Default/Cache bullets per BR. 4 PRD drifts surfaced ở QC Phase 5 line-by-line walk. | Defense-in-depth value: v1 had 161 tests PASS (Coder confident) BUT 4 drifts; QC caught all 4; v2 + 8 NEW anti-regression invariants prevent re-introduction. | Wave 5 codify trong conventions.md "Self-Review Bước 2 Pattern" section: grep ALL BR bullet keywords (Endpoint / Response / Phí / Default / Cache) per BR-XX, không chỉ Response shape. Reinforce Wave 1 helper REUSE mandate. |
| **TD-F062-WAVE2B2-STATUS-GAP-CLARIFY** 🟡 MED | analytics / merchant-comparison classifyStatus | PRD BR-SA-07 lines 248-252 phân loại merchant status: `ACTIVE` (đơn ≤30d) / `AT_RISK` (đơn 30-60d) / `CHURNED` (không đơn ≥90d) / `NEW` (tenant ≤30d + 0 orders). **Gap unspecified:** `60 < lastOrderDays ≤ 90` — Coder lenient interp returns CHURNED, strict PRD reading would need AT_RISK extension OR new INACTIVE 4th tier. | QC Wave 2B-2 Phase 5 PRD line-by-line walk caught ambiguity (PRD silent, NOT Coder bug). | BA clarify Wave 2B-3 / Wave 5. 3 options: (A Recommended) extend AT_RISK threshold from `<= 60` → `<= 90` (1-char fix); (B) add INACTIVE 4th tier; (C) accept current lenient + update PRD spec text. Affects merchant status badge displayed to Back-Office Admin (could mislead 60-90d gap merchant outreach decisions). |
| **TD-F062-WAVE2B2-PULLORDERS-DUPLICATE** ✅ **RESOLVED 2026-05-25 commit `add014f`** | analytics / fee aggregation | (Was 🟢 LOW) `pullOrdersForFeeAggregate` private duplicated 2 services. **RESOLUTION:** Wave 2C-1 race-performance.service.ts = 3rd consumer threshold met → extracted to NEW `services/fee-aggregate.helpers.ts` standalone function (88 LoC). 3 consumers refactored: analytics.service.ts thin wrapper (backward compat 18+ call sites), merchant-comparison.service.ts direct import (private duplicate removed), race-performance.service.ts direct import (NEW). Net -62 LoC saving + better DRY. 5 NEW invariant tests verify extraction completeness. | Wave 2B-2 plan executed at Wave 2C-1 per documented 3rd-consumer threshold. | **RESOLVED — no further action.** Wave 5 if want full cleanup: refactor analytics.service.ts 18+ internal call sites to direct import + remove private wrapper. |
| **TD-F062-WAVE2C1-IN-MEMORY-SORT-LIMIT** 🟢 LOW | analytics / race-performance pagination | `getPerformanceList` sorts + paginates in-memory after full SQL aggregate. Acceptable cho ~50-200 races/year; would scale issue at 10K+ races. | Coder pre-flagged tradeoff acceptable cho current dataset size. | Wave 5 k6 benchmark — switch to SQL-side ORDER BY (with sortBy whitelist) + LIMIT/OFFSET if perf issue. |
| **TD-F062-WAVE2C1-DATE-PROXY-VS-RACE-EVENT-DATE** 🟢 LOW | analytics / race-performance date field | `RaceSpotlight.date` + `RacePerformanceItem.date` proxy = MAX(payment_on) thay vì actual race event date (races.event_date column). | Coder Deviation #17 documented tradeoff — avoids extra JOIN. | Wave 2C-2 hoặc Wave 5 if frontend needs exact race date — add `r.event_date` to SELECT + map field. Defer until BA confirms. |
| **TD-F062-WAVE2C1-COLD-CACHE-3X** 🟡 LOW-MED | analytics / race-performance cache | 3 concurrent endpoint cold-cache requests redundantly run `_buildRaceAggregates` 3× (same pattern Wave 2B-2 TD-COLD-CACHE-3X). | Coder acknowledged tradeoff. | Wave 5 k6 benchmark. Same mitigation candidates as Wave 2B-2: internal Map cache OR per-request memoization. |
| **TD-F062-WAVE2B2-COLD-CACHE-3X** 🟡 LOW-MED | analytics / merchant-comparison cache | 3 concurrent endpoint cold-cache requests (scatter + dist + table called by Tab 3 UI in parallel) redundantly run `_buildMerchantAggregates` 3× (each ~58 tenants × FeeService call). Estimated p95 cold ~3s. | Coder acknowledged tradeoff IMPLEMENTATION_NOTES Wave 2B-2 Section 1 Deviation #14. Cache TTL 15min current / 24h historical means redundancy only on cold-cache opening (rare). | Wave 5 k6 benchmark. Mitigation candidates: (a) internal Map cache during single request lifecycle; (b) internal cache key `merchant-comp-base` cached separately + flushed by 3 endpoint keys composite. |
| **TD-F062-WAVE2B2-RFM-EXTERNAL-NOW** 🟢 LOW | analytics / merchant-comparison testability | `computeHealthScore` + `classifyStatus` use `Date.now()` internally → tests must mock global Date for deterministic boundary fuzz testing. Pure source-scan invariants OK (current Wave 2B-2 28 NEW tests). | Coder pre-flagged. Property-based fuzz tests deferred Wave 5. | Wave 5 if property-based fuzz needed — inject `nowProvider` like F-058 pattern (already established convention). |
| **TD-F062-GA4-SERVICE-ACCOUNT** 🔴 HIGH | analytics / ga4.service.ts | Tab 5 GA4 Overview placeholder — ga4.service.ts returns graceful empty (BR-SA-11 fallback) until `GOOGLE_APPLICATION_CREDENTIALS` env var set on VPS pointing to service account JSON key. Without it, GA4 tab shows "Đang cập nhật" empty state. | QC Phase 5 (Tab 5 graceful empty confirmed). Manager deploy 2026-05-25. | **ACTION Danny:** Upload service account JSON to VPS (e.g. `/opt/5bib-result/ga4-service-account.json`) + add `GOOGLE_APPLICATION_CREDENTIALS=/opt/5bib-result/ga4-service-account.json` to docker-compose environment → restart backend container. After restart Tab 5 will show real GA4 session data per BR-SA-11. |
| **TD-F062-BUG-005-LABEL-DENSITY** 🟡 MED | analytics / frontend AreaChart | Daily granularity over 90-day range shows ~90 x-axis labels → crowded/unreadable. Axis label formatting/thinning not implemented. | QC BUG-005 deferred (label sliding window fix) — not blocking deploy. | When daily AreaChart > 30 points, thin labels to show only every N-th tick (e.g., every 7 days). `AnalyticsFilterBar` default period `last_30_days` mitigates for common case. |
| **TD-F062-BUG-008-MANUAL-PCT-OVERFLOW** 🟡 MED | analytics / legacy F-026 | Legacy repeat-athlete-rate endpoint: `manual_fee_per_ticket` as % (MANUAL % > 100%) guard missing in fee.service.ts for edge case merchants. Pre-F-062 era bug surfaced by QC BUG-008. | QC Wave 5 full audit BUG-008 finding. Deferred (F-026 era, affects legacy endpoint only). | Fix fee.service.ts: add guard `if (feePercentage > 100) { Logger.warn(...); feePercentage = 0; }` for MANUAL category % calculation path. |
| **TD-F062-OLD-RUNNER-BEHAVIOR-OVERLAP** 🟢 LOW | analytics / Wave 2C-2 vs F-026 legacy | legacy geographic-demographic service (F-026 era) + NEW runner-analytics (Wave 2C-2) both serve demographic/geographic data. Endpoints coexist. | Coder Wave 2C-2 IMPLEMENTATION_NOTES Forced #4. Preserved for backward compat. | Wave 6 / F-063+: unify under runner-analytics endpoints, deprecate legacy geographic-demographic if no external consumers. |
| **TD-F042-COMM-STRATEGY-PHASE2** 🔴 HIGH business | contracts / finance | Danny + Finance team chốt strategy re-send DOCX cho merchants đã nhận wrong files. Legal exposure window. | Phase 1 ship code fix first. Outreach business decision. | **Deadline 1 tuần post-deploy 2026-05-25.** Track legal exposure. Finance team decide whether to re-send corrected DOCX OR internal-only fix + regen. |
| **TD-F042-MULTI-VIEWER-VERIFY-DEFERRED** 🟡 MED | contracts / DOCX templates | Coder chose XML manipulation over LibreOffice edit. Multi-viewer (MS Word + LibreOffice + Google Docs) render fidelity NOT programmatically verifiable in test env. | XML approach preserves formatting bit-perfect (lower drift risk than LibreOffice save-as per F-037 lesson). | Post-deploy Manager/Danny manual verify sample DOCX. If visual issue → revert via `.backup/` restore + alternative approach. |
| **TD-F042-CODER-LOCAL-AUDIT-NOT-RUN** 🟡 TRACK | contracts / scripts | `scripts/audit-contract-docx-templates.ts` NOT executed against DB during Coder phase per Manager PAUSE point. | Audit script PROD run needs Danny + Manager coordination. | Post-deploy: SSH backend → `npx ts-node scripts/audit-contract-docx-templates.ts` → review `audit-f042-report.json` blast radius. |
| **TD-F042-PAID-CONTRACT-AUDIT-EVENT-NAMING** 🟡 MED | contracts / audit | Coder safeguard: regen script uses actor=`f042-regenerate-script`. Finance team needs filter pattern documentation. | Coder added Manager Adjustment beyond PRD. | When regen batch runs, Finance team filter AuditLog where actor=`f042-regenerate-script` + paidContract flag to identify PAID contracts re-generated. |
| **TD-F042-REGEN-SCRIPT-CROSS-FEATURE-REUSE** 🟢 LOW | scripts / shared lib | Audit + regen scripts pattern may be reusable cho future data-fix features. | F-042 v1 scope-bound. | Phase 2 extract `backend/scripts/lib/audit-regen-base.ts` if pattern proves out với 2+ feature cases. |
| **TD-F042-TEMPLATE-PLACEHOLDER-STATIC-AUDIT** 🟢 LOW | scripts / F-024 audit-template-placeholders.ts | CONTEXT_KEYS hardcoded Set doesn't include F-042 flatten keys (actualSubtotal/actualVatAmount/etc.) → false positive "Missing in context". Runtime OK, static analysis stale. | Coder pre-flagged. Static-only issue, NOT runtime. | Update CONTEXT_KEYS Set in next contracts feature touching buildRenderContext. ~5 line fix. |
| **TD-F042-AUDIT-OUTPUT-GITIGNORE** 🟢 LOW | backend / .gitignore | `backend/scripts/audit-f042-report.json` + `regenerate-f042-log.json` NOT in .gitignore. Internal IDs not user-facing but defense-in-depth. | Low sensitivity. | Add `backend/scripts/*-f0??-*.json` pattern to backend/.gitignore. |
| **TD-F042-1000-ITEMS-STRETCH-TEST** 🟢 LOW | contracts / DOCX render | 1000+ lineItem qty không direct tested. F-024 existing scale tests cover similar lineItems loop path. | F-042 fix scope = template static content, not render performance. | PROD smoke verify if contract with race 1000 VĐV encountered. F-024 BR-CM existing scale guarantees suffice for v1. |
| **TD-F041-NO-TEST-RUNNER** 🟡 MED | `frontend/` test infra | Vitest/Jest KHÔNG installed. `*.spec.ts` files (province-normalize, selling-web-url, chip-verify-kiosk, ga4-consent-flow) all docs-only KHÔNG runnable | Danny PAUSE 2026-05-18 approved Option 1 — strict TS + runtime sanitizer + manual smoke đủ v1.0. Pre-existing convention. | Phase 2: `pnpm add -D vitest @vitest/ui @testing-library/react @playwright/test` + config files |
| **TD-RUNNERS-PRIVACY-CONSENT** 🔴 HIGH BLOCKER | `frontend/app/(main)/runners/` + `backend/race-result/services/athlete-profile.service.ts` | F-056 Phase 5 hard-paused 2026-05-21 — public /runners discover của 53K athlete profiles vi phạm VN Nghị định 13/2023 (aggregate cross-race profile exceeds race-day implicit consent scope). Brand risk + data moat leakage. | Danny + biz-strategist consult Path 2: pause until opt-in claim flow ready. | **F-057 PRD MUST address:** (1) Logto athlete-tier signup (lightweight, KHÔNG fork merchant tier), (2) Claim profile UI: BIB search + ID-verify + toggle public/private, (3) AthleteProfile.publicDiscoverConsent: Date \| null field + filter, (4) Strip avatar/gender/province for non-claimed, (5) Re-enable controller endpoints, (6) Restore frontend page.tsx from git revert commit 97fd9bf, (7) Industry benchmark check biz-strategist trước launch (Strava/Garmin defaults). |
| **TD-F056-PRD-ADDENDUM** 🟡 MED | `.5bib-workflow/features/FEATURE-056-race-recap-ui-upgrade/01-ba-prd.md` | BR-56-26..31 (Phase 1-4 scope expansion: 4-tile hero, elevationGain, finisherDistribution, auto-articles, section restructure, header nav) implicit — chưa update PRD formal addendum. | Scope expansion 4 phases bundled vào F-056 không re-init formally. | Manager-spawn future feature touching recap: read commit message + 05-manager-deploy.md doc for actual BR set, KHÔNG rely chỉ on 01-ba-prd.md baseline. |
| **TD-F056-CLAUDE-S3-RULE-7** 🟢 LOW | `CLAUDE.md` S3 lifecycle section | `recap-articles/{raceId}/{slug}.md` prefix introduced F-056 P4 (NestJS `RecapArticleStorage`). CLAUDE.md S3 lifecycle rules 1-6 documented; rule 7 for recap-articles prefix NOT yet added. | Cosmetic — articles persisted OK, no expiration needed. | Next CLAUDE.md edit: add rule 7 cho `recap-articles/{raceId}/{slug}.md` prefix — no expiration, public read OK, frontmatter YAML + markdown body convention. |
| **TD-F056-STAMPEDE-LOCK** 🟢 LOW | `backend/race-result/services/race-recap.service.ts:assembleArticles` | Cold-path article generation has no SETNX stampede lock — concurrent requests cho race uncached sẽ duplicate compute + S3 PUT. Idempotent (last-write-wins) nhưng wasteful. | Low traffic on recap endpoints (single-digit RPS per race), not worth dedicated lock infra. | If recap traffic grows (e.g., during race-day batch hit) → add `redis.set('recap:articles:lock:<raceId>', NX, EX=30)` wrap around generator + storage put. |
| **TD-F056-MOBILE-TABLE-OVERFLOW** 🟢 LOW | `frontend/components/recap/RecapStoryCard.tsx` (.recap-story-body CSS) | Story body markdown may render table (course-difficulty template emits pipe table). Mobile <640px width risk horizontal overflow with default styling. | Tables rendered correctly desktop. Mobile UX acceptable v1 (rare render path). | Wrap `.recap-story-body table` in `overflow-x-auto` container OR set `display:block; overflow-x:auto` on table. ~10 LOC CSS in globals.css. |
| **TD-ATHLETE-PROFILES-GARBAGE-DELETE** 🟢 LOW | MongoDB `athlete_profiles` collection | F-056 P5 data quality audit found 1,225 garbage profiles (BIB-as-name "16661", "#VALUE!" Excel errors, leading dash/digit names). Currently filtered at query layer (regex + totalRaces>=1) — DB rows retain. | Query filter sufficient cho v1 — backend doesn't expose garbage to public. | Cron cleanup task (Q3 2026): identify + delete profiles where canonicalName fails `^[A-Za-zĐĂÂÊÔƠƯ][^\d#].{2,}\s.+` regex AND totalRaces=0. Audit logs first. |
| **TD-AUTH-LOGTO-SCOPE-GRANT** 🟡 MED | Logto admin `https://auth.5bib.com` resource scopes | Logto users authenticated session but missing "5BIB Result API" resource scope grant → frontend proxy `getAccessToken()` returns null → backend `LogtoAuthGuard` returns 401 on /athlete-stars. Currently graceful localStorage fallback shipped (commit 1bf80d3) — no UX impact but root needs fix. | Logto admin config issue, not codebase. | Logto admin dashboard: audit which users granted "5BIB Result API" scope. Likely default policy missing for athlete tier. After grant fix, frontend hooks resume normal behavior (no code change needed). |
| **TD-F041-SEARCH-PII** 🟡 MED | `search/page.tsx` + `calendar/page.tsx` | Raw `search_term` passed to GA — user CÓ THỂ type email/phone vào search field | LOW likelihood (race results search dùng BIB/name) nhưng MED severity (PII leak risk). | Phase 2 ~10 LoC: regex strip `\S+@\S+\|0\d{9,10}` trước emit gtag event |
| **TD-F041-SOLUTION-CONSENT-BYPASS** 🟡 MED | `/solution*/layout.tsx` 4 files | Solution layouts call `gtag('config', ...)` immediately KHÔNG check consent | Vietnam PDPA risk LOW (marketing landing = less PII interaction). Solution scope decoupled F-041 v1.0 | Phase 2 refactor solution layouts dùng shared `consent-manager.ts` để unified PDPA toàn site |
| **TD-F041-MULTI-GA-PROPERTIES** 🟢 LOW | Solution vs result properties | Solution pages có separate G-ND6VCY2B57. Result/solution dùng different properties | Marketing decision — separate intentional | Phase 2 unified analytics → reconfigure GA4 admin OR keep separate per route group |
| **TD-F041-REVOKE-CONSENT-UI** 🟢 LOW | `/privacy-policy` page | Phase 1 opt-out qua manual localStorage clear (no UI button) | Phase 1 ưu tiên ship Vietnam PDPA core (banner + Consent Mode v2) | Phase 2 implement revoke button calling `clearConsent()` + reload + emit consent_revoke event |
| **TD-F041-PRIVACY-POLICY-PLACEHOLDER** 🟢 LOW | `/privacy-policy` route | Route 404 hiện tại. Banner "Tìm hiểu thêm" link broken | UX gap NOT PDPA compliance issue. Phase 1 accept manual opt-out | Phase 2 implement actual privacy policy markdown page với GDPR + PDPA content |
| **TD-F041-SDK-DUAL-TRACKER** 🟢 LOW | `google-analytics.tsx` | `NEXT_PUBLIC_GA_SOLUTION_ID` env support unused v1.0 | Single property G-PNVB69YRL2 đủ launch | Activate when Marketing cần separate solution property — chỉ set env, NO code change |
| **TD-F041-CONSENT-COMPONENT-EXTRACT** 🟢 LOW | Future feature | Nếu future cần consent gate khác (heatmap, ad pixels) → extract `<ConsentInit />` separate | F-041 scope chỉ cookie banner consent — single component đủ | Phase 2 nếu add tracking layer mới → formalize pattern trước |
| **TD-F041-PARTIAL-WIRING-RANKING** 🟢 LOW | `ranking/[courseId]/page.tsx` | 3 events NOT wired: `search_bib`, `sort_ranking`, `filter_ranking`. Page ~1500 dòng complex | Ưu tiên 4 conversion goals (Marketing KPIs) trước. Ranking interactions = secondary metrics | Phase 2 wire 3 events ~30 phút work |
| **TD-F041-PARTIAL-WIRING-HOME** 🟢 LOW | `(main)/page.tsx` | `select_race` + `select_promo_section` NOT wired | PageViewTracker auto fire `page_view` cho homepage — base coverage đủ v1.0 | Phase 2 wire 2 events khi cần CTR analysis cho race card + promo sections |
| **TD-F041-PARTIAL-WIRING-COMPARE** 🟢 LOW | Compare athletes modal | `compare_open` event NOT wired | Low-traffic feature, defer | Phase 2 wire khi cần measure compare feature engagement |
| **TD-F041-PARTIAL-WIRING-SHARE-RACE** 🟢 LOW | `races/[slug]/page.tsx` | `share_race` event NOT wired (race-level share button) | `share_athlete` (athlete profile share) = primary share conversion. Race-level less critical | Phase 2 wire khi cần distinct race share vs athlete share funnel |
| **TD-F041-LCP-MEASURE-PENDING** 🟢 LOW | BR-41-13 compliance | Lighthouse audit before/after NOT run pre-deploy | F-041 async script + fixed banner expected low impact | Danny run Chrome DevTools / PageSpeed Insights post-deploy verify LCP delta <5%, CLS <0.1, FID +10ms max |
| **TD-F041-STALE-COMMENT-BANNER** 🟢 NIT | `CookieConsentBanner.tsx:11` | Comment mentions "emit pending page_view" nhưng code relies on Enhanced Measurement auto-fire | Docs drift, doesn't affect behavior | Phase 2 clean comment khi touching file |
| TD-F038-SDK-REGEN | finance / pnl-contracts-list | Admin uses hand-typed wrapper `finance-api.ts#getContractsList` instead of generated SDK | Consistent F-028/F-031/F-032 precedent; SDK regen batch deferred | Next batch SDK refresh — swap wrapper |
| TD-F038-REFACTOR-EXTRACT | finance / pnl.service | `computeContractRows()` ~80 LoC duplicates `getDashboardData()` body items+totals compute | Deliberate copy: zero regression risk to 32 existing F-028+F-029+F-036 tests | Future feature consolidate: extract shared `computeBaseContractItems()` private helper |
| TD-F038-MONGO-SORT | finance / pnl-contracts-list | In-memory sort+paginate on `items[]` array (not Mongo aggregation pipeline) | Acceptable for current scale ~100 contracts | Khi scale >1K contracts → migrate to Mongo `$sort` + `$skip` + `$limit` in aggregation pipeline (note: sort by computed `margin` needs `$addFields` first) |
| TD-F038-EXPORT-LIST | finance / pnl-contracts-list | NO CSV/Excel export button on list page | Defer per PAUSE-38-06 (accepted by Danny 2026-05-15) | Phase 2 add `POST /api/finance/pnl/contracts/export/excel` (mirror dashboard export pattern) |
| TD-F038-FILTERED-COST-CATEGORY | finance / pnl-contracts-list | `filteredTotals.costByCategory` reflects dataset-wide breakdown (NOT filtered subset) | UI doesn't render donut on list page currently → zero user impact | Phase 2 if donut added on list page → compute filtered breakdown |
| TD-F038-PAGE-CLAMP | finance / pnl-contracts-list | Deep-link `?page=99&limit=20` with only 3 pages returns empty array (NOT clamped to totalPages) | Minor UX confusion edge case — pagination footer shows correct totalPages | v1.1 enhancement: clamp `page = Math.min(page, totalPages)` in service before slice |
| TD-F038-AUTH-INTEGRATION-TEST | finance / pnl-contracts-list | HTTP-level 401/403 tests NOT at unit level (substituted with service-level Redis graceful tests) | Standard NestJS guard pattern + same LogtoAdminGuard used by 6 other finance controllers proven on prod | Verify empirically in Manager+BA UI walkthrough phase via curl `Authorization` header probes |
| TD-F038-PERF-SLA-MEASURE | finance / pnl-contracts-list | p95 < 500ms cold / < 100ms warm / cache hit >80% NOT empirically measured | Cannot measure with unit mocks | MUST verify in walkthrough phase (curl with `-w '%{time_total}'` or browser dev tools timing). If breach → loop back Coder with specific perf data |
| TD-F023-SDK-REGEN | dashboard | dashboard-sdk-shim.ts placeholder thay generated SDK | Backend đổi DTO chưa regen SDK admin | Trước PROD push: chạy `pnpm --filter admin generate:api` + retire shim |
| TD-F023-CLICK-NAVIGATE | dashboard | RecentActivityTimeline click chưa navigate (BR-DASH-18) | Coder defer | Fix link href trước PROD |
| TD-F023-LINK-STRATEGY | dashboard | Pending task link href khác PRD (BR-DASH-15) | Cần Manager confirm strategy | Manager grill href chuẩn trước PROD |
| TD-F023-PERF-SLA | dashboard | Performance SLA chưa đo (page <1.5s cached, cron <30s, cache hit >95%) | Coder không lên được backend local | Đo trên DEV trước race-day |
| TD-F023-REDIS-SCAN | dashboard | `redis.keys()` blocking call thay `scanStream` | Convenience trong sprint | Patch trước race-day vì impact perf khi key tăng |
| TD-F026-EXPORT-STUB | analytics | Export PDF/Excel chỉ stub UI click ra toast "phase 2" (BR-22/23) | MVP scope | PRD US-06 chưa thoả mãn — implement file gen trước PROD |
| TD-F026-REPEAT-TREND-FORMULA | analytics | RepeatAthleteService.computeTrend() trả `rate=100 if total>0` thay tỷ lệ repeat thật (BR-12) | Logic sai trong code | Fix formula trước PROD — Marketing đọc nhầm chart |
| TD-F026-CACHE-INVALIDATE | analytics | Cache invalidate trên admin write chưa implement (BR-09) | Cron 1h tự refresh nên impact thấp | Defer-able — implement nếu user feedback "data lag" |
| TD-001 | timing-alert | E2E API + Playwright UI tests deferred (DiscoverPreviewPanel auto-trigger + MERGE preserve) | Pilot ship priority; manual UAT plan documented in QC report | Khi đụng DiscoverPreviewPanel → tự verify BR-09 manual hoặc viết Playwright |
| TD-002 | timing-alert | `pnpm --filter admin generate:api` chưa chạy cho endpoint `GET /discover-preview/:courseId` | Endpoint hiện tại chưa được consumer dùng (DiscoverPreviewPanel call POST /discover-checkpoints existing) | Khi expose endpoint này tới SDK consumer → run generate:api ngay |
| TD-003 | timing-alert | Cache key `discover-preview:` không namespace `master:` (inconsistent với master:discover-lock cùng service) | Coder defer normalization tới post-pilot | Khi migrate, nhớ update cả get/set + flush logic |
| TD-004 | timing-alert / races | Event hook auto-trigger DEFERRED (RacesService.update → discoverAndCachePreview) | Circular DI risk RacesModule ↔ TimingAlertModule. Frontend-driven debounce thay thế. | Nếu cần backend-driven (cron pre-warm), dùng `@nestjs/event-emitter` + `pnpm install` PAUSE |
| TD-005 | admin / DiscoverPreviewPanel | Chỉ trigger trong edit mode (`editingCourse && courseForm.apiUrl`) — add new course không thấy preview | UX limitation acceptable cho MVP | Khi extend tới create flow → handle race chưa có _id (cache key cần placeholder) |
| TD-006 | admin / DiscoverPreviewPanel | BR-09 MERGE preserve names (existingByKey map) — frontend logic, không có unit test | Frontend logic đơn giản, manual UAT đủ | Khi sửa MERGE logic → write Playwright test scenario "BTC đặt tên 'Đèo Bưởi' → re-paste → tên giữ" |
| TD-007 | timing-alert / discover | SSRF risk pre-existing — admin paste apiUrl trust 100% | Pre-existing, không introduce by FEATURE-001 | Future hardening: whitelist domain `*.raceresult.com` hoặc validate URL pattern |
| TD-008 | timing-alert / simulator + poll | ~~8 unit tests deferred~~ ✅ **RESOLVED** commit 31cc698 — 31 tests added (22 simulator-helpers + 9 reset-exceptions), tổng regression 109/109 pass | Done | — |
| TD-009 | timing-alert | DB backfill ambiguous course assignment — 252 alerts có chip set match nhiều course → assigned course đầu tiên (5K) thay vì có thể là 10K/21K/42K | Acceptable cho pilot — trajectory render OK, chỉ filter "Course=10K" tab có thể miss alerts | Re-backfill bằng `rr_api_snapshot.Bib` lookup → race_results.courseId nếu cần precision |
| TD-010 | timing-alert / parsed-athlete | ~~Pre-existing test fail~~ ✅ **RESOLVED** commit 31cc698 — fix expectation `checkpointTimes.Finish` to `toBeUndefined()` (mergeTimes filter-empty behavior) | Done | — |
| TD-011 | timing-alert / dashboard-snapshot | ~~Race elapsed time feature parked~~ ✅ **RESOLVED** commit a9969cb — `computeRaceStartedAt(race)` 3-tier fallback + frontend `RaceElapsedClock` ticker | Done | — |
| TD-012 | admin / AlertsTab | Frontend search filter chỉ filter loaded items, không scan toàn bộ DB | UX limitation acceptable — BTC phải Load more để thấy hết match | Backend search endpoint (GET /alerts/search?q=...) nếu user complain |
| TD-F003-01 | reconciliation / DTO | BR-08 `PERIOD_TOO_FAR_FUTURE` chưa hardcode bound (current+1 month) — chỉ chặn year < 2020 | Admin-only access, typo year hiếm | Khi cần siết → thêm cross-field check trên `@IsValidPeriodRange` |
| TD-F003-02 | reconciliation / preflight | Race condition overlap-check ↔ create không atomic — 2 admin tạo cùng race × range trong 1s → 2 doc tồn tại | Admin nghiệp vụ hiếm gặp | Nếu cần cứng → thêm unique index `{tenant_id, mysql_race_id, period_start, period_end}` (unique:true) hoặc transaction |
| TD-F003-03 | reconciliation / FE | ~~🔴 BLOCKER cho production deploy~~ ✅ **RESOLVED** 2026-05-05 — Danny smoke test thủ công trên DEV (`result-admin-dev.5bib.com`) sau merge main + CI auto-deploy: 3 priority bug (modal off-by-one, multi-month range, S3 download) + 4 secondary test all PASS | Done | Có thể xóa khỏi tracking |
| TD-F003-04 | reconciliation / SDK | `pnpm --filter admin generate:api` pending backend up | FE dùng raw `fetch()` consistent với pattern hiện tại của reconciliations pages | Khi backend deploy → run regen để future SDK consumer có types `PreflightRangeDto`, `AuditPeriodBoundaryDto` |
| TD-F003-05 | reconciliation / create flow | `reconciliation.service.create()` post-flag preflight vẫn gọi `preflightService.run(period_start.slice(0,7))` single-month → flags cho multi-month doc chỉ cover tháng đầu range | Minor visibility gap, không ảnh hưởng `can_create` (Step 1 form đã dùng `runRange`) | Nếu BTC complain flags không đầy đủ → integrate `runRange` flags vào `create()` flow |
| TD-F003-06 | backend / logto-auth | Pre-existing: `jose` ESM trong `logto-auth.guard.ts:8` → 7 test suite fail full backend test (out of F-003 scope) | Out of F-003 | Cần config jest `transformIgnorePatterns` cho `jose` package |
| TD-F004-01 | admin / reconciliations | JSDoc cảnh báo `xlsx_url`/`docx_url` field chỉ là comment, không lint enforce | Low priority — dev tương lai đọc JSDoc đủ tránh bug | Long-term: ESLint custom rule check `<a href={data.[name]_url}>` + `data.[name]_url \|\|` pattern |
| TD-F004-02 | reconciliation / download | Backend re-generate buffer mỗi request (XLSX ~2s, DOCX ~3s p95 cho 100 line items) — không cache | Acceptable cho admin volume thấp (~300 download/tháng) | Nếu volume tăng → cache layer Redis ETag/304 hoặc presigned URL flow |
| TD-F004-03 ↔ TD-F003-03 | reconciliation / FE | ~~🔴 BLOCKER cho production deploy~~ ✅ **RESOLVED** 2026-05-05 — Danny smoke test thủ công DEV pass cả F-003 + F-004 (3 priority + 4 secondary). TC-DOWNLOAD-08 (URL pattern) + TC-DOWNLOAD-SEC-01 (S3 vẫn 403/400) đều verified qua Network tab + curl | Done | — |
| TD-F004-04 | admin / e2e | Spec `admin/e2e/reconciliation-download.spec.ts` cần env vars (`E2E_RECONCILIATION_ID`, `E2E_TEST_TENANT_ID`, `E2E_TEST_RACE_ID`) + Logto storage state | UAT setup script chưa document | Document trong `admin/e2e/README.md` (out of scope F-004) |
| TD-F005-01 | timing-alert / command-center | 🔴 **OPEN (REVERTED 2026-05-08)** — `racekitPickedUp = 0` placeholder. Originally claimed RESOLVED by F-015 (2026-05-08) but F-015 ROLLED BACK same day — duplicate of ORG.5bib.com. Field still placeholder until 5bib-result syncs from ORG. ORG.5bib.com is source of truth; 5bib-result needs to READ this field from ORG-managed data, not write. | Future feature: sync `racekit_received` from ORG.5bib.com → 5bib-result MongoDB. | Khi đụng dashboard-snapshot.service.ts → đừng giả định F-015 đã wire `racekit_received`. Wait for ORG sync feature. |
| TD-F005-02 | admin / SDK | `pnpm --filter admin generate:api` pending backend up | F-005 ship before SDK regen | Khi backend deploy → run regen để future SDK consumer có types `LiveLeaderboardCourseDto`, `SummaryCardsDto`, `ForceRefreshResponseDto` |
| TD-F005-03 | admin / AthleteFlowChart | ~~Dùng Tailwind bars thay vì recharts BarChart vertical~~ ✅ **RESOLVED** commit `1b81a2d` — dual-bar overlay (ghost expected dashed + actual filled gradient + pctOfExp label) implemented thuần CSS per design canvas Artboard 3. Không cần recharts. | Done | — |
| TD-F005-04 | timing-alert / cache | Cache key migration `dashboard-snapshot:` → `master:rr-snapshot:` chưa flush manual | TTL 15s tự expire trong race day | Acceptable; nếu cần flush sớm → manual `redis.del('dashboard-snapshot:*')` post-deploy |
| TD-F005-05 | timing-alert / Force Refresh BR-CC-10 | Rework add endpoint + button SAU QC reject lần 1 (dead code gap) | QC catch issue, Coder fix narrow scope | Lesson learned: mỗi service method PUBLIC → cần HTTP endpoint hoặc internal-only doc rõ |
| TD-F005-06 | admin / e2e | Spec `admin/e2e/command-center.spec.ts` (10 Playwright tests UAT-deferred) cần env vars + Logto storage state | UAT setup pending (same TD-F004-04 pattern) | Document chung trong `admin/e2e/README.md` |
| TD-F005-07 | dashboard-snapshot / DTO | `CourseStatsDto.apiUrl` leak (pre-existing F-002 inherited, NOT introduced by F-005) — admin-only via LogtoAdminGuard nên acceptable | Pre-existing, low priority | Khi cần strict cleanup → strip apiUrl khỏi response trước return |
| TD-F005-08 | admin / AlertFeedPanel | Round 3 commit `c63ee8a` — switch data source `recentActivity` → `listTimingAlerts(status:'OPEN')`. Initial impl mix poll.completed events + alert.created events trong cùng feed → user thấy spam | UI bug bắt qua user manual review screenshot; QC test pass vì list endpoint đúng nhưng feed source sai | Lesson: list view của entity X → query endpoint của X, KHÔNG reuse generic activity feed |
| TD-F006-01 | admin / e2e | Spec `admin/e2e/course-map-upload.spec.ts` (8 Playwright tests) UAT-deferred — env vars + Logto storageState pending | Same TD-F005-06 pattern | Document chung trong `admin/e2e/README.md` |
| **TD-F019-MULTITENANT** 🔴 | logto-auth / awards / medical-incident | LogtoAdminGuard không enforce per-race tenant — chỉ check global `admin` role. PRE-EXISTING inherited từ F-018, áp dụng cả F-019 v1/v2/v2.1. Admin race A có thể PATCH/DELETE awards của race B. | Codebase-wide TD, defer Phase 2 cần thiết kế tenant model toàn codebase trước multi-BTC hosting | Khi build feature Awards/Medical/Race-level config mới → KHÔNG fix trong scope feature, ghi nhận ở Manager init. Phase 2: thiết kế `RaceTenantGuard` decorator check `req.user.tenantId === race.tenantId`. |
| TD-F019-LOCK-KEY | awards / cache | Compute lock key dùng literal `awards:lock:${raceId}:*` (string `*`, KHÔNG phải Redis pattern) cho full-race recompute. Race condition giữa full-race recompute vs per-course concurrent vẫn không bị block. | Out-of-scope v2 + v2.1 — pattern ship trước khi phát hiện | Khi đụng `awards.service.recompute()` → fix bằng cách dùng key cụ thể `awards:lock:full:${raceId}` cho full-race + tách từ per-course locks |
| TD-F019-PERF-PERF-02 | awards / anomaly-detector | Anomaly detect 7 patterns × 5K athletes potentially hit SLA hotspot (PRD <2s). Hiện chỉ test với 866 athletes (Cong An). | Race chip-verify pilot 2026-05-02/03 (3500 athletes) là first stress test thật | Chạy load test trước UAT race lớn. Profile từng pattern A-H xem pattern nào bottleneck (likely Pattern G PACE_IMPOSSIBLE + Pattern H VENDOR_MISMATCH với cardinality cao) |
| TD-F019-V2-MYSQLLINK | awards / chip-verification | Awards depends on `chip_race_configs.mongo_race_id ↔ mysql_race_id` legacy bridge. Race chưa link → silent fallback `bracketSource='5bib'` = 0 podium (vendor cross-check không chạy). | Future: merge `mysql_race_id` thẳng vào `Race.schema` (eliminate bridge table) | Khi đụng awards/chip-verification → kiểm tra race đã có MySQL link chưa. Empty result không phải bug awards mà là missing config. |
| TD-F019-V2-AGE-CRON-COVERAGE | race-master-data / awards | Cron `RaceAthleteSyncService.syncAges` `EVERY_DAY_AT_MIDNIGHT` chỉ scan races status `pre_race`/`live`. Race transition draft → publish phải đợi T+1 day để có `ageOnRaceDay` populate. | LOW — admin manual trigger `POST /awards/:raceId/recompute-ages` workaround có sẵn | Khi build new feature publish race → optional: trigger manual recompute-ages ngay sau publish |
| TD-F019-V2-DB-COLUMN | race-master-data / 5sport DBA | `AthleteDobReadonly.dob` column name cần verify với 5sport platform DBA — đã code blind theo schema giả định. | LOW — production live confirmed working trên Cong An race | Khi connect DBA: verify field name + type (datetime vs date vs varchar). Nếu drift → adjust entity decorator. |
| TD-F019-V2.1-INFO-LEAK | races / public API | `STRIPPED_RACE_FIELDS` không bao gồm `awardsCompoundingMode` + `bracketSource` (v2 cũng leak cùng pattern) → leak ra public API. Tác động minor (config flag không phải PII). | LOW — config setting, không lộ user data | Phase 2 cleanup: thêm cả 2 fields vào `STRIPPED_RACE_FIELDS` cùng lúc với việc dọn `bracketSource` placement (TD-F019-V2.1-BRACKETSOURCE-PLACEMENT) |
| TD-F019-V2.1-NO-TOGGLE-LIVE-TEST | awards / QC gap | QC chỉ smoke test 1 chiều `mutually_exclusive` default qua mongo verify. Toggle 2 chiều `mutually_exclusive ↔ compounding` chỉ unit-test cover (2 specs). | LOW — unit test cover logic core; UI selector qua optimistic rollback pattern | Recommend Danny smoke test 2 chiều với admin token post-deploy: PATCH `awardsCompoundingMode='compounding'` → recompute → verify top 3 overall vẫn xuất hiện AG. Nếu pass → close TD. |
| TD-F019-V2.1-PATTERN-H-CARDINALITY | awards / vendor-mismatch-detector | VendorMismatchDetector worst-case 5K × 100 categories = 500K iterations. Threshold 1/2 BIB top-3 mismatch → emit Pattern H — cần monitor production xem có quá nhiều false-positive trigger Pattern H không. | MED — chưa stress test với cardinality cao | Race chip-verify pilot 2026-05-02/03: monitor số lượng Pattern H emit. Nếu >50 warnings/race = false-positive cao, cần tune threshold. |
| TD-F019-V2.1-BRACKETSOURCE-PLACEMENT | races / awards | `bracketSource` declared trong RaceCourse subdoc nhưng đọc race-level. v2.1 placement `awardsCompoundingMode` race-level đúng pattern read. Inconsistency tồn tại nhưng harmless (lazy default `?? '5bib'` works). | LOW — out-of-scope v2.1 | v3 cleanup: dọn cả 2 fields về race-level. Nếu cần rạch ròi per-course bracket → thiết kế lại bracketSource thành nested object `{ default: 'mutually_exclusive', perCourse: { courseId: 'compounding' } }` |
| TD-F019-V2.1-CACHE-INVALIDATE | races / awards | `racesService.updateRace` flush race cache nhưng KHÔNG invalidate `awards:eligibility:<raceId>` hoặc `master:rr-snapshot:<raceId>`. Đổi mode → admin phải bấm "Recompute" lại để apply (UI có warning sẵn). Không phá correctness. | LOW NEW v2.1 — UI có warning text "Đổi mode → cần recompute lại podium đã DRAFT" | Phase 2 doc: thêm `racesService.updateRace` invalidate `awards:*` keys khi `awardsCompoundingMode` hoặc `bracketSource` thay đổi (so sánh before/after) |
| TD-F019-V2.1-AUDIT | races / audit | races.service.ts updateRace() không có audit trail per-field cho config thay đổi. Đổi `awardsCompoundingMode` lưu thẳng race doc, không có statusHistory. | LOW NEW v2.1 — pattern toàn codebase, MVP acceptable | Long-term: thiết kế `RaceConfigAuditLog` collection nếu compliance audit yêu cầu (vd ITRA certification trail) |
| TD-F019-RTL-DEFERRED | admin / awards / tests | 4 admin RTL specs deferred (AGPodiumCard + AGPresetPicker + AnomalyInbox + useAnomalyWarnings) + v2.1 CompoundingModeSelector chưa có RTL test. Inherited TD-F013-TESTSTACK lock — admin chưa có `@testing-library/react`+jsdom+@types/jest+ts-jest. | LOW | Activate khi unblock TD-F013-TESTSTACK (npm install RTL stack ở admin). 1-line testRegex flip activate cả 5 specs. |
| TD-F006-02 | admin / ElevationChart | Backend response `gpxParsed.{min,max}Elevation` 2-point summary → admin chart 2-point preview | Acceptable for admin preview, frontend public lazy-fetches simplified GeoJSON for richer curve | Component accepts full `ElevationPoint[]` API → upgrade admin sau nếu BTC complain |
| TD-F006-03 | frontend / globals.css | `--5s-*` design tokens chưa migrate sang frontend (chỉ có `--5bib-*` legacy). Hex literals inlined `style={{}}` cho F-006 | Out of F-006 scope per Manager Plan (admin có đủ tokens F-005 setup) | Tách feature riêng migrate `--5s-*` tokens vào frontend globals + replace hex literals trong existing components |
| TD-F006-04 | races.service.spec | 5 pre-existing failures (assertions vs `{returnDocument:'after'}` semantic + `_id`/`cacheTtlSeconds` stripping). NOT introduced by F-006 | Coder Phase 1 improved baseline 0/24 → 21/25 PASS by adding Redis DI mock + repairing 1 removeCourse test | Track for cleanup feature riêng |
| TD-F006-05 | races / S3 ACL | `courses/*` files dùng bucket policy public-read (codebase pattern), KHÔNG presigned URL signing | original.gpx URL technically accessible if path known, no PII acceptable cho race data | Future feature riêng nếu cần private + presigned URL flow |
| TD-F006-06 | frontend / race detail | F-006 inserted as section (KHÔNG tab system) trong race detail page. Drop-in tab body khi F-007/F-008 implement tabs | Race detail hiện tại không có tab system — F-007 Readiness + F-008 Kiosk sẽ implement | Acceptable bridge cho cluster |
| TD-F006-07 | admin + frontend / cpIcon | ~~DOM XSS via Leaflet `divIcon({ html })`: `cp.key` interpolated raw → admin-controlled malicious key triggers stored XSS public~~ ✅ **RESOLVED** by Coder rework — added `escapeHtml()` inline helper trong cả 2 files, `safeLabel = escapeHtml(String(label))` interpolated `${safeLabel}` | QC catch issue, narrow scope rework | — |
| TD-F006-08 | races.service / removeCourse | ~~`removeCourse()` does NOT invalidate `master:course-map:` cache → 600s stale window after BTC removes course~~ ✅ **RESOLVED** by Coder rework — direct `redis.del()` after `$pull`, mirrors `updateCourse()` pattern | QC catch MEDIUM gap | — |
| TD-F006-09 | races.service / removeCourse | `removeCourse()` does NOT call `deleteGpxFromS3` → orphaned S3 objects when BTC removes course | LOW priority, scope deferral | Open follow-up feature: cleanup orphaned `courses/{raceId}/{removedCourseId}/*` keys |
| TD-F006-10 | admin / e2e fixture | Missing "no-elevation" GPX e2e fixture (8/8 admin states covered structurally, 1 fixture missing) | LOW priority | Add `admin/e2e/fixtures/no-elevation.gpx` (GPX without `<ele>` tags) |
| TD-F006-11 | course-map / billion-laughs | No explicit billion-laughs XML attack fixture to verify @xmldom/xmldom defaults safe | LOW — @xmldom/xmldom defaults disable entity expansion by default | Add fixture for explicit verification |
| TD-F006-12 | course-map / boundary | 10MB-exact boundary test missing (current test only verifies 11MB rejection) | LOW — boundary edge case | Add test: `expect(uploadGpx(buffer_10mb)).resolves.toBeDefined()` |
| TD-F007-01 | admin / Command Center placeholder | "Tới F-005 cockpit" button → middleware 301 → loops back same placeholder | F-008 sẽ replace placeholder | F-008 drop button hoặc retarget `/timing-alerts/alerts` |
| TD-F007-02 | admin / RaceLiveTimer | `pulse-live` keyframe 1.8s, BR-AF-08 spec 1.2s (cosmetic drift) | Low priority cosmetic | Adjust keyframe duration trong globals.css |
| TD-F007-03 | docs / memory | PRD/Plan/init refer `/admin/races/...` but app no `basePath` — canonical `/races/...` | Memory drift acceptable trong session | Update `00-manager-init.md` references trong future cluster docs |
| TD-F007-04 | admin / shell components | Unit tests deferred ~22 (Manager target). Timer pure-function covered (14 adversarial). RaceTabsNav/PageHero/Breadcrumb/PlaceholderPage uncovered at unit level | Acceptable cho presentational shell | Add Vitest harness future feature, write 22 tests |
| TD-F007-05 | admin / layout.tsx | 'use client' (KHÔNG Server Component) — Coder cite browser-only SDK pipeline | Future SSR migration item | Migrate sang Server Component khi SDK supports SSR |
| TD-F007-06 | admin / TabBadge | Folded inline into RaceTabsNav (acceptable simplification, BR-AF-18 still met) | Pragmatic refactor | Extract nếu reuse trong future feature |
| TD-F007-07 | admin / placeholder pages | ~~8 pages render "Coming soon — F-XXX"~~ 🟡 **PARTIAL RESOLVED** F-008 v2 + F-009 2026-05-07 — Command Center + Awards (F-008 v2) + Course Map (F-009) replaced với full implementation; 5 placeholder pages còn (Overview/Readiness/Result Kiosk/Athletes/Results) | F-010..F-014 | Track until F-014 ships |
| TD-F008-V2-01 | admin / CheckpointDiscoveryDialog | ~~Course selector defaults to first course only~~ ✅ **RESOLVED** F-009 2026-05-07 — `?course=` query param sync pre-fills course selector via BR-CM2-25 | Done | — |
| TD-F008-V2-02 | admin / SoundToggleButton | Default sound state OFF when localStorage empty; race-day MC must enable manually | Conservative default for muted environments | Consider Settings panel toggle "Default sound state per user" |
| TD-F009-01 | admin / CourseDistancePicker | Inactive course pill status accuracy — only active course gets authoritative `useCourseMapData`, inactive default `no-gpx` until clicked | F-009 ship priority — bulk-status endpoint defer | Add backend bulk endpoint OR parallel queries for accurate badge state pre-click |
| TD-F009-02 | admin / course-map AutoSnapButton | Component shipped (pattern + warning copy ready) but NOT rendered in F-009 layout — no server endpoint yet | Avoid no-op UI per Race Ops Expert | Wire up khi backend bulk auto-snap endpoint ready (future feature) |
| TD-F006-04 | races.service.spec | ~~5 pre-existing failures~~ ✅ **RESOLVED** F-007 salvage 2026-05-06 — 28/28 PASS via `{ returnDocument: 'after' }` + strip `_id`/`cacheTtlSeconds` expected mock | Done | — |
| TD-F006-03 | frontend / globals.css | ~~`--5s-*` design tokens chưa migrate~~ 🟡 **PARTIAL RESOLVED** F-007 — token migration done both admin + frontend; some legacy hex literals trong out-of-scope components vẫn còn (article-categories + solution-5solution preserved per PAUSE-MGR-02) | Foundation done, F-009 sẽ clean tiếp | F-009 finish hex literal cleanup remaining files |
| TD-F010-V1-tuning | timing-alert / config | Field-test mandate cho paceBuffer / paceAlertThreshold / confidenceMultiplier per course_type — Sports Domain Expert recommended TRAIL paceBuffer 1.40-1.50, Danny chốt 1.35 lower bound compromise; ULTRA Sports recommend 1.40-1.50, Danny chốt 1.50 upper bound | F-010 ship priority; A/B adjust based on alert accuracy + false-positive rate — needs real race-day data | Owner Danny + race-day BTC feedback loop. Field-test on next VN trail/ultra race Q2/Q3 2026. If false-positive rate >15% → adjust toward Sports Expert recommendation values |
| TD-F010-V1-photo-evidence | race-result / DnsChipFailToggle | Race Operation Expert recommend "Photo evidence?" checkbox companion to DNS_CHIP_FAIL admin flag — race-day error-prone under pressure (admin might toggle wrong athlete) | Cosmetic enhancement, not correctness; F-010 ship priority MVP | Khi đụng DnsChipFailToggle → consider adding optional photo upload alongside flag toggle. Defer F-XXX polish post field-test. Pattern: paired evidence checkbox for admin-override actions touching downstream metrics |
| TD-F010-V1-vendor-quality | timing-alert / metrics | Surface DNS_CHIP_FAIL ratio per race as timing vendor quality metric — Race Operation Expert recommendation. Currently `dnsBreakdown` exposed but no vendor-level aggregate dashboard | Defer to F-013 Athletes tab OR F-014 Settings full redesign | Khi build F-013/F-014 → aggregate `dnsBreakdown.chipFail / total` per race + per vendor (RR/ChronoTrack) → vendor quality scorecard. Pattern reusable cho any vendor-quality metric (timing accuracy, sync lag, error rate) |
| TD-F010-V1-test-gap | timing-alert / dashboard-snapshot | `computeDnsBreakdown()` helper in `dashboard-snapshot.service.ts` lacks direct unit tests — implementation present + integrated into Promise.all chain L143 + verified via swagger contract Phase 5 smoke + DnsBreakdownDto verified, but no spec test for the count aggregation logic itself | Logic is straightforward count aggregation per athlete state; QC threshold ≥17/19 BR-FC met (verified 18/19) | Add direct unit tests in `dashboard-snapshot.service.spec.ts` covering: 0 DNS athletes edge, all DNS_CHIP_FAIL flags, mixed dnsChipFail / racekitPickedUp combinations, totals match individual counts. Recommended in next polish pass |
| TD-F005-cluster-reservation | timing-alert / forbidden-services | F-005 cluster reservation locks (miss-detector + projected-rank + timing-alert-poll) → ✅ **PRECEDENT ESTABLISHED** F-010 2026-05-07 — Manager Scope Lock §rows 4-9 explicitly UNLOCKED these services for F-010 (CUTOFF_RISK + OBS-1 + OBS-2 + confidence formula + paceBuffer per course_type changes). Cluster reservation IS flexible per cluster feature with explicit Manager-approved scope unlock — NOT permanent forbidden. Pattern: cluster reservation reviewable per cluster feature; raise PAUSE if outside Manager Scope Lock | Done — precedent documented | Future cluster features touching F-005 services → request Manager Scope Lock unlock with explicit row table; no silent override |
| TD-F008-01 (carryover confirmed F-011 + F-012 2026-05-07) | admin / frontend tests | Frontend Vitest harness deferred — F-011 + F-012 manual UAT smoke + QC code-read verification only. No automated regression for: status-aware UI guard, fullscreen scope dual-layer, F-010 DnsBreakdownCard, F-012 inline tooltip a11y triple, F-012 multi-paragraph rationale highlight, F-012 shared TIMING_PRESETS module. F-012 introduced NO new automated tests (presentation layer only); carryover unchanged | Acceptable for presentation-layer-only scope; backend regression 168/168 still preserved automatically | Future feature backlog: scaffold Vitest + write 22-test target (F-007 shell + F-008 v2 fullscreen + F-011 status guard + F-010 DnsBreakdownCard + F-012 popover a11y + F-012 rationale panel + F-012 shared module import). Multi-feature regression need scaffolds with Vitest harness once available |
| TD-F012-01 | admin / settings / TimingFormulaTooltipContent | Click-to-toggle popover component-local trong `TimingFormulaTooltipContent.tsx` — pattern reusable nhưng chưa promote to shared `<InlineHintPopover />` primitive | F-012 ship priority — promote khi ≥2nd consumer emerges (YAGNI). Currently only F-012 uses pattern | Khi feature kế tiếp cần inline hint popover → extract `<InlineHintPopover />` shared primitive trong `admin/src/components/ui/` với props: `trigger`, `content`, `aria-label`. Reference impl: `admin/src/app/(dashboard)/races/[id]/settings/components/TimingFormulaTooltipContent.tsx:80-105` (a11y triple — aria-expanded + Escape + outside-click) |
| TD-F012-02 | admin / settings / TIMING_PRESETS | ~~Inline `TIMING_PRESETS` constants in `TimingDetectionConfigSection.tsx` risked drift with display table values~~ ✅ **RESOLVED** F-012 Round 2 2026-05-07 — extracted to shared module `admin/src/app/(dashboard)/races/[id]/settings/components/timing-presets.constant.ts` (56 LOC leaf module). Both form (`TimingDetectionConfigSection.tsx:42-46` import) + table (`TimingPresetComparisonTable.tsx:21-24` import) consume single source of truth. Click-each preset alignment ROAD/TRAIL/ULTRA verified zero drift. Pattern minted as conventions entry "Shared constant module to prevent cross-component data drift" | Done — root-cause fix for QC Round 1 BLOCKER #2 | — |
| TD-F013-TESTSTACK | admin (Next.js) | `@testing-library/react` + `jest-environment-jsdom` + `@types/jest` + `ts-jest` not installed → 5 F-013 specs (33 tests) cannot execute. Only `kiosk.types.spec.ts` runnable via `backend/node_modules/.bin/jest` path-reuse (20/20 PASS executed) | Manager STOP #5 NO npm install in F-013 scope; Coder followed correctly. Install requires Manager approval, scoped to next test-infra feature | When admin gains RTL stack → 1-line `testRegex` flip in `admin/jest.kiosk.config.cjs` (from `'.*kiosk\\.types\\.spec\\.ts$'` to `'result-kiosk/.*\\.spec\\.(ts\|tsx)$'`) activates all 33 tests. Bundle with F-014 if F-014 needs spec coverage. |
| TD-F013-RL | backend / race-result | `getAthleteDetail` endpoint at `/api/race-results/athlete/{raceId}/{bib}` lacks `@Throttle({ default: { limit: 30, ttl: 60_000 } })` → BIB enumeration risk | pre-existing F-005-era endpoint risk, NOT introduced by F-013; low actual impact (BIB are public race numbers) | Any BIB-input feature should consider IP rate limit decorator. Backend hardening pass post-cluster. |
| TD-F013-SUBMITHEIGHT | admin / result-kiosk | Submit button `minHeight: ctrlSize` = 60px (PRD aspirational ≥80px for digit-pad-style; width far exceeds 120 via `w-full`) | Trivial CSS bump, ship as-is per Coder + QC | Optional polish — bump constant `KIOSK_CONFIG.SUBMIT_HEIGHT_PX` if BTC field-test reports tap difficulty. |
| TD-F013-IDLE-WIRING | admin / result-kiosk | 60s idle auto-reset (`useKioskIdle`) + 5s not-found auto-reset (`KioskResultScreen`) wiring not directly executed-tested by QC; static-reviewed sound but spec for `useKioskIdle` deferred per TD-F013-TESTSTACK | TESTSTACK absent — see above | Bundle with TESTSTACK fix once admin gains RTL — `useKioskIdle.spec.ts` (6 cases) covers timer / activity reset / countdown emit / cleanup / disabled / manual reset. |
| TD-F013-TABLET-UAT | admin / result-kiosk | ⚠️ **MUST-DO** real iPad 10.9" + Android 10" tablet manual UAT not executed (Coder checklist last 2 boxes unchecked) before race-day flip-on | Pre-deploy operational gate — NOT a code blocker | Block kiosk activation on production until UAT signoff. Manager schedule before BTC race-day deployment. Walkthrough 3-surface flow (admin → BIB input → result + idle 60s reset + 5s not-found auto-reset + sound toggle + bluetooth-keyboard fallback). |
| TD-F013-CERT-PRINT | admin / result-kiosk | Cert print/PDF/email flow Phase 2 (PAUSE-RK-04 deferred) | Race-day operational complexity (printer driver / PDF / email choice TBD post-BTC field-test) | Future Phase 2 spec post-BTC field-test feedback. |
| TD-F013-EN-LANG | admin / result-kiosk | EN language toggle Phase 2 (PAUSE-RK-09 deferred) | VN-only Phase 1 mandate; full i18n module not in F-013 scope | Phase 2 with full i18n module (next-i18next or react-i18next). i18n hook scaffolded in `kiosk.microcopy.ts` structure. |
| TD-F013-MULTI-BIB | admin / result-kiosk | Multi-BIB compare Phase 2 (PAUSE-RK-06 deferred) | Single-BIB MVP per PRD scope | Future Phase 2 separate surface. |
| TD-F014-01 | admin / athletes / BulkActionBar | Bulk action UI placeholder until F-014.5 backend bulk-action endpoint ships (`POST /api/admin/races/:id/athletes/bulk-action`) — UI ships disabled buttons + tooltip "Endpoint chưa sẵn sàng — F-014.5" satisfying BR-AS-18 | Manager Option B applied — backend gate bulk-action MISSING (only mongo `bulkWrite` internal helpers exist) | F-014.5 must ship `POST /api/admin/races/:id/athletes/bulk-action` before bulk feature claims green. `useAthletesBulkActions.ts` currently has no `mutateAsync`/`useMutation`/`fetch` calls (verified ZERO backend trigger). |
| TD-F014-02 | admin / status derivation | Status derivation duplicated (F-013 5-status `deriveKioskStatus` at `result-kiosk/kiosk.types.ts` + F-014 9-status `deriveAthleteStatus` at `admin/src/lib/`) | F-013 + F-014 ship priority; refactor when backend `status` field added to race-result schema | When backend `status` field schema migration lands → refactor to single shared util (`deriveAthleteStatus` superset). Both files coexist for now per Option C client-derive pattern. |
| TD-F014-03 | admin / tests | 9-10 deferred specs awaiting RTL stack install (TD-F013-TESTSTACK linked) — well-formed Jest+RTL with `@ts-nocheck` header per F-013 pattern; 1 spec EXECUTED PASS (`deriveAthleteStatus.spec.ts` 20/20) | Manager PAUSE #6 NO npm install in F-014 scope; Coder followed correctly | When admin gains RTL stack (TD-F013-TESTSTACK closes) → 1-line `testRegex` flip in `admin/jest.kiosk.config.cjs` activates all 9-10 deferred specs. Bundle with TESTSTACK fix. |
| TD-F014-04 | admin / search | Search diacritics-folding unverified at fixture level (Vietnamese queries "Nguyen" → "Nguyễn") — depends on backend MongoDB collation `locale='vi'` | Backend Gate 3 search endpoint EXISTS at `race-result.controller.ts:99`; collation NOT verified | MUST run real-world VN query test against staging 2K-athlete fixture before deploy claims green. If failing → backend MongoDB collation `locale='vi'` add OR client-side strip-folding fallback (perf risk @2K rows). |
| TD-F014-05 | admin / settings / page.tsx LOC | Settings page.tsx is 268 LOC (Manager target ~200) — verbatim editForm seeding mirrors legacy lines 269–295 per BR-AF-23 demand | Acceptable cosmetic — verbatim port mandate honored | Could extract to `useRaceEditForm()` hook in follow-up. Nice-to-have; not blocking. |
| TD-F014-06 | admin / athletes / contact action | Contact action (`onContact` callback in AthleteRow) is toast stub — Mailchimp/SMS deferred Phase 2 | F-014.5 Phase 2 — integration scope not yet locked | When BTC requests email/SMS contact → wire to existing Mailchimp module + SMS gateway. Pattern: existing F-005 alert notifications module reusable. |
| TD-F014-07 | admin / athletes / offline | Offline banner not implemented in Athletes tab — PRD §State table mentions; out of MVP scope | Out of F-014 MVP scope; defer F-015 rich profile cluster | F-015 rich athlete profile cluster — add offline detection via `navigator.onLine` + Service Worker. Pattern reusable for other tabs. |
| TD-F014-08 | admin / athletes / export format | Excel `.xlsx` export per BR-AS-19 currently CSV-only (`useAthletesExport.ts` outputs CSV blob); BR-AS-19 says "Excel MVP, CSV optional" — F-014 ships reverse: CSV ships, Excel deferred | Not a regression (legacy was CSV); just mis-labeled in PRD vs implementation. F-014.5 should add `.xlsx` writer OR BA re-LOCK CSV-only | F-014.5 either: (a) add SheetJS / xlsx-populate library + `.xlsx` writer, OR (b) BA revise BR-AS-19 to lock CSV-only as final spec. |
| TD-F016-01 | reconciliation / v1.7.0 PENDING | Phase 2 v1.7.0 MINOR (recompute service + audit endpoint `GET /audit/category-coverage` + admin UI banner + 18 recon retry migration) chưa ship. v1.6.5 PATCH chỉ fix forward (đối soát mới đúng) — recon cũ vẫn sai cho tới khi v1.7.0 chạy migration recompute. | Split 2-release để v1.6.5 PATCH ship 24h; v1.7.0 sau Danny UAT PROD pass | Resume Coder Phase 2 sau Danny UAT v1.6.5 PROD signoff. Plan + Scope Lock đã có trong `02-manager-plan.md` v1.7.0 section. KHÔNG bắt đầu trước UAT pass. |
| TD-F016-02 | reconciliation / calc.service | `reconciliation-calc.service.ts` line 76+90 dùng pattern `category === 'CHANGE_COURSE' ? label_a : 'ORDINARY'` để gộp non-CHANGE_COURSE thành label `'ORDINARY'`. GROUP_BUY/GROUP_BUY_FIXED/CODE_TRANSFER tự rơi vào nhánh default → label `'ORDINARY'` đúng theo BR-05 (gộp). KHÔNG break sau F-016 nhưng KHÔNG có unit test verify pattern này. | F-016 scope KHÔNG đụng calc.service (Manager Plan §"KHÔNG được đụng") | Khi BA mới đề xuất tách label per category (vd: hiển thị "GROUP_BUY" thay vì gộp "ORDINARY") → cần spec test cover 6 categories x 2 has-payment-ref states. |
| TD-F016-03 | reconciliation / preflight enum | `PreflightFlag.type` là string union (không có file enum riêng) — Plan v1.6.5 giả định có `preflight-flag.types.ts` nhưng thực tế dùng inline string literal `'UNKNOWN_CATEGORY_DROPPED'`. Acceptable nhưng dễ typo + không có IDE autocomplete enforce. | Inline string literal đủ cho v1.6.5 scope; refactor riêng | Future hardening: tạo `backend/src/modules/reconciliation/dto/preflight-flag.enum.ts` với `enum PreflightFlagType { ... UNKNOWN_CATEGORY_DROPPED, ... }` rồi update consumer. |
| TD-F016-04 | reconciliation / vendor enum future-proof | MySQL platform có thể thêm `order_category` enum mới (vd: `'AGENT_BOOKING'`, `'PARTNER'`) → defensive guard sẽ log warn + emit ERROR warning `UNKNOWN_CATEGORY_DROPPED` nhưng KHÔNG có alerting/Slack notify. Engineering chỉ thấy nếu có ai đó kiểm tra preflight result hoặc đọc backend log. | Defensive guard đủ cho fail-soft; alerting nâng cao là TD | Khi có infra alerting (Datadog/Sentry) → wire `Logger.warn` cho `UNKNOWN_CATEGORY_DROPPED` event → escalate Slack ngay nếu count > 10/race. |
| TD-F016-05 | reconciliation / spec backward-compat | TC-QC-PRE-04 verify `unknownCategoryCount` undefined backward-compat — nhưng KHÔNG có spec verify caller pre-F-016 destructure pattern (`const { fiveBibOrders } = await queryService.queryOrders(...)`). Nếu future caller dùng object destructure thay vì property access → vẫn safe vì additive field. | Acceptable — additive return field đã được type-safe via interface | Khi có new consumer của `queryOrders()` → đảm bảo dùng pattern `result.fiveBibOrders` hoặc destructure subset, KHÔNG dùng spread `{ ...result, custom: 1 }` (sẽ inherit `unknownCategoryCount` ngoài ý định). |
| TD-INCIDENT-2026-05-11 | race-result controller | **Controller spec chưa pin route ordering — gap an toàn cho future regression.** `race-result.controller.ts` hiện có 25+ route, mix literal + 1-param + 2-param. Reorder fix 2026-05-11 đúng nhưng KHÔNG có Jest test pin "GET stats/:courseId/distribution route handler getTimeDistribution (NOT getCourseStats)". Future Coder thêm route mới có thể accidentally re-introduce shadowing. | Manager đang trong incident response, ship fix trước. Test pin defer separate task. | Mở `/5bib-init FEATURE-XXX-race-result-route-spec-pin` BUGFIX (~30 min) — extend `race-result.controller.spec.ts` với routing test: assert mỗi route literal-suffix call đúng handler. Pattern reuse F-003 `reconciliation.controller.spec.ts` đã làm cho `audit/period-boundary BEFORE :id`. |
| TD-F025-SDK-REGEN | reconciliation / admin SDK | Backend dev `:8081` đang chạy code CŨ pre-F-025 lúc Coder regen SDK, picked up F-023/F-026 backlog 879 LOC unrelated → revert SDK regen để giữ Scope clean. Post-deploy F-025 PROD `release/v1.7.7` → backend container restart với F-025 code → re-run `pnpm --filter admin generate:api` separate commit. | Block bởi backend deploy F-025 first | Sau Danny confirm PROD smoke test pass → backend container Up với image `84155aa` → SSH check `curl https://result-api.5bib.com/swagger/json` có `reconciliationControllerDeleteBatch` path → chạy `pnpm --filter admin generate:api` → commit cleanup `chore(sdk): regen post F-025 deploy`. Capture cả F-025 endpoint + backlog F-023/F-026/F-024 types. |
| TD-F025-RAW-FETCH | admin / reconciliations page | `handleBulkDelete` dùng raw `fetch()` thay vì TanStack Query hook từ SDK | Page `reconciliations/page.tsx` 1268 LOC có 13+ raw fetch pre-existing (lines 232/250/272/299/328/350/398/429/462/etc). Mix style mid-file harm hơn benefit. Refactor toàn page sang TanStack Query là separate work. | Cosmetic. Khi mở feature refactor toàn page → wire tất cả 14+ fetch calls (bao gồm F-025 handleBulkDelete) sang generated SDK + TanStack Query mutation pattern. |
| TD-F025-FE-UNIT-TEST | admin / reconciliations / handleBulkDelete | `handleBulkDelete` FE chưa có unit test | Block bởi TD-F013-TESTSTACK (admin RTL stack chưa có) | Khi admin RTL stack ready (`@testing-library/react` + `jest-environment-jsdom` + `ts-jest` install) → viết test cho disabled state, button count realtime, modal mở/đóng, success path 200 → toast + clear selectedIds, error path 5xx → toast error, not_found > 0 → secondary toast. |
| TD-F025-AUDIT-LOG-COLLECTION | reconciliation / audit | Logger.warn chỉ stdout (Docker logs), KHÔNG persist MongoDB. Compliance/GDPR trail need MongoDB audit collection. | Per PAUSE-25-03 scope MVP, audit collection là future feature riêng | Future feature: tạo `reconciliation_audit_logs` MongoDB collection schema `{actorId, action: 'bulk_delete', ids: ObjectId[], at: Date, request_meta?}`. Cluster với F-014 audit timeline pattern (`editHistory[]` subdoc) hoặc separate cross-domain audit module. |
| TD-F025-SERVICE-LOGGER-INCONSISTENCY | reconciliation / service | Pre-existing service methods (`create`, `delete`, `updateStatus`, `regenerate`, etc.) KHÔNG dùng `this.logger`. Coder thêm Logger declaration solely cho `deleteMany` → inconsistency tồn tại. | Refactor toàn service Logger pattern là separate work, KHÔNG block F-025 ship | Optional cleanup: wrap critical mutations (create/delete/updateStatus) với Logger.warn audit. Hoặc accept as-is — `deleteMany` là first mutation cần audit trail vì bulk impact lớn hơn single. |
| TD-S3-RECONCILIATION-LIFECYCLE | reconciliation / S3 | XLSX/DOCX files của reconciliation đã xóa orphan trong S3 — chưa có lifecycle rule chính thức. PAUSE-25-04 chốt "S3 lifecycle 24h dọn" nhưng thực tế KHÔNG có rule cấu hình. | Pre-existing TD trước F-025, exposed by F-025 bulk delete. Single delete cũng orphan nhưng volume thấp ít notice. | Cấu hình S3 lifecycle rule trên bucket `5sport-media` (hoặc bucket recon-specific): prefix `reconciliation/` → expire after 24h (hoặc 7 days để admin có thể re-download trong window). Verify via AWS Console hoặc Terraform. Cluster với existing TD-F004-* về S3 download nếu có. |
| TD-F030-ADDON-MULTI-TICKET-TYPE | reconciliation / calc | Nếu 1 order có line items thuộc 2 ticket types khác nhau (vd: 1 BIB 10KM + 1 BIB 21KM cùng cart), add-on attached ở ticket-type group ĐẦU TIÊN gặp trong loop (qua map key `typeName\|distance`). | Real-world Shopify cart hiếm có cross-ticket-type 1 order. Backend chỉ track tổng add-on per order. Tổng vẫn match Section 1. | Future: nếu Danny báo case này → tách add-on thành 1 line "Vật phẩm bổ sung" riêng trong calc.service, render section 3 thêm 1 row per order có add-on. Cluster với analytics aggregate cross-ticket-type. |
| TD-F030-XLSX-DASH-CELL | reconciliation / xlsx | Col 4/5 (qty/đơn giá áo) hiển thị '—' string khi row có add-on. ExcelJS render OK nhưng KHÔNG numerical → Excel auto-format có thể không recognize as currency cell. | Cosmetic. BTC đọc thấy '—' hiểu "unknown". | Future: nếu Danny muốn hiển thị qty thực, cần extend MySQL query JOIN với `add_on_items` table (nếu exist) — major refactor. Defer. |
| TD-F030-OLD-RECON-VISUAL | reconciliation / render layer | Recon cũ ship trước F-030 vẫn render được nhưng line items breakdown thiếu add-on rows (vì `LineItem.add_on_price` schema field đã có sẵn — chỉ render layer fix). | Danny chốt PAUSE-30-02 KHÔNG migrate, F-025 bulk delete xóa thủ công. | Recon mới create sau F-030 deploy sẽ có add-on rows đầy đủ. |
| TD-F030-XLSX-DTYPE-MISMATCH | reconciliation / xlsx | XLSX col 4 vừa có thể là number 0 (row không add-on) vừa có thể là string '—' (row có add-on). Mixed dtype có thể break ExcelJS sum formula nếu future feature aggregate col 4 ở client. | Hiện tại không có aggregate col 4 client-side. | Future: nếu cần aggregate, replace '—' bằng 0 cho row có add-on (lose semantic but consistent dtype). |
| TD-F030-DOCX-PROVIDER-MOBILE | reconciliation / docx | Address line "Tầng 9, Hồ Gươm Plaza..." khá dài (>80 chars). Có thể wrap ugly trong table cell width fixed. | Visual issue cosmetic only. | Test với real PROD render → nếu wrap xấu, consider abbreviate hoặc multi-line in code. |
| TD-F029-INHERITED-CTRL-SPEC | reconciliation / controller spec | `reconciliation.controller.spec.ts` fail to load post F-029 (`Invalid guard passed to @UseGuards() — LogtoStaffGuard`). Pre-existing F-029 regression, KHÔNG do F-030. | F-029 refactored controller guards but spec mock didn't update. | Update `reconciliation.controller.spec.ts` mock import `LogtoStaffGuard` (NEW from F-029) thay vì `LogtoAdminGuard`. Pattern reuse F-024 controller spec adjustments. Low priority — spec only, runtime OK. |

---

## 🔥 Incident log

### 2026-05-11 — PROD public ranking page crash (Đại hội FUYU race)

**Discovery URL:** `https://result.5bib.com/races/dai-hoi-the-thao-fuyu-lan-thu-II/ranking/5km`
**Symptom:** Toàn bộ page render "Application error: a client-side exception" sau hydration. SSR HTTP 200 nhưng client JS crash.
**Detected by:** Danny manual UAT trên PROD ~14:30 GMT+7.
**Resolved:** commit `1b3ccb5` push `release/v1.7.6` ~14:55 GMT+7 (≈25 phút từ phát hiện đến deploy).

**Root cause:** NestJS route ordering regression introduced bởi F-021 BR-DISPLAY-07 (cross-race isolation).
- F-021 thêm `@Get('stats/:raceId/:courseId')` để scope stats theo race
- Route declared TRƯỚC `@Get('stats/:courseId/distribution')` và `@Get('stats/:courseId/countries')` đã tồn tại từ F-03
- First-match wins → 2-param generic catch hết tất cả 2-segment URL `stats/X/Y` → 2 literal-suffix routes bị shadow → unreachable
- URL `/stats/5km/distribution`: backend trả course-stats shape `{totalFinishers,...}` (NO buckets) thay vì time-distribution shape `{buckets[],...}`
- Frontend `TimeDistributionChart.tsx:76` đọc `data.buckets.length` → undefined.length → TypeError → React render crash

**Fix 2-layer:**
1. **Backend `race-result.controller.ts`** — reorder routes: `stats/:courseId/distribution` + `stats/:courseId/countries` declared BEFORE `stats/:raceId/:courseId`
2. **Frontend `TimeDistributionChart.tsx`** — defensive guard `!Array.isArray(data.buckets)` trước khi `.length` (belt-and-suspenders)

**Manager self-audit — tại sao Manager miss?**
- Sau F-021 deploy 2026-05-09, Manager updated memory với BR-DISPLAY-07 (cross-race scoping rule) nhưng KHÔNG verify route declaration order trong controller có sẵn route literal-suffix.
- Convention "literal BEFORE param" tại thời điểm đó chỉ cover case "literal vs `:id`" (single-segment). 2-param generic shadowing chưa được mint thành rule.
- Plan review F-021 KHÔNG có line `grep controller cho route 2-segment khác trước khi merge`.

**Memory update (đã apply post-mortem):**
- ✅ `conventions.md` — extend "NestJS route ordering" với 2 trường hợp mới: literal-suffix vs 2-param generic + general principle "sort theo độ cụ thể giảm dần"
- ✅ `known-issues.md` — TD-INCIDENT-2026-05-11 (route spec pin chưa có)
- ✅ Manager `/5bib-plan` checklist sẽ include: route declaration order audit khi feature thêm route mới trong controller có route param

**Lesson hardened:** Mọi feature thêm `@Get/@Post/@Patch/@Delete` mới trong controller đã có route param phải:
1. Manager `/5bib-plan` audit declaration order
2. Coder pin behavior với controller spec test
3. QC verify URL hit đúng handler trong integration test

---

### 2026-05-14 — F-033 P&L "actual REPLACE estimated" semantic bug + Cowboy workflow (Danny instruction)

**Discovery:** HĐ `11.05/2026/HDDV/CTTXT5-5BIB-20` Danny screenshot — nhập 1 chi phí phát sinh "Đút lót chính quyền" 1M → P&L card hiện chi phí 1M + margin 99.5%. Thực ra phải 186M (185M ước tính + 1M phát sinh) + margin 11%.

**Symptom progression (3 bugs nested):**
1. F-035a (dialog narrow): edit dialog `max-w-3xl` (768px) chật → 9-col table sau F-033 add "Giá vốn" → inputs nén "Th"/"67:"/"Nhập số (v..."
2. F-035b (cost field drop): nhập "Giá vốn" save xong reload thấy rỗng → tưởng "k lưu được" (illusion — backend mất, admin state mismatch)
3. F-036 (semantic): khi cost_items có data, F-033 design priority chain → actual override estimated → 1M phát sinh = total cost 1M (sai)

**Root causes:**

**F-035a:** Pattern shadcn override variant prefix (cùng pattern F-032 hotfix 6c6ce8a/9c6df03). Dialog `max-w-3xl` không có `!important` + matching variant prefix → sm:max-w-sm default thắng trên desktop.

**F-035b:** Hand-pick field mapping bug triple-quên:
- `contracts.service.create()` line 399 `lineItems.map` — quên cost
- `contracts.service.update()` line 732 `lineItems.map` — quên cost
- `contract-edit-dialog.tsx` `buildInitialState()` line 93 — quên cost trong admin state
- Field "lậu" giữa schema (F-033 added) + DTO (F-033 added) + 3 transform layers
- Backend save OK với cost — chỉ admin display lỗi → user nhìn empty cell → tưởng "không lưu" → 1 vòng debug rồi mới catch

**F-036:** F-033 designed priority chain semantic (actual REPLACE estimated). Đúng nếu cost flow là "estimate at quote → finalize when actual numbers come in" (như order pricing). Sai nếu cost flow là "base + incremental extras" (như contracts business reality). Cost_items = "Đút lót chính quyền" rõ ràng là CHI PHÍ PHÁT SINH THÊM, không thay thế base estimate.

**Detected by:** Danny manual UAT localhost (after Danny instruction "tạo nhánh ra để fix chứ đừng golive liên tục như này nữa").

**Resolved:** Branch `fix/F-035-edit-dialog-line-items-width` 4 commits (`9f4cb64` + `797fa85` + `7bc1050` + `a8ad737`) merged main + release/v1.8.1 = HEAD `a8ad737` 2026-05-14.

**Cowboy workflow violation (Danny called out same day):**

Trong session 2026-05-14, tao push 11 commits liên tiếp lên `release/v1.8.1` (Excel dialog 2-step hotfix, wizard UX, recon DOCX, contracts SelectValue sweep, F-033, F-034). Mỗi commit = CI auto-deploy PROD. KHÔNG có DEV staging UAT. Danny phải catch bug trên PROD từng cái. Đây là cowboy ops — user làm guinea pig.

Danny instruction: "Con này hơi nhiều bugs nên chắc mày tạo nhánh ra để fix chứ đừng golive liên tục như này nữa, nó k đúng."

**Workflow chuẩn (memory hardened):**
```
feature/fix branch off main → push branch only (CI build, KHÔNG deploy)
                              → merge main → DEV deploy (admin-dev.5bib.com)
                              → user UAT trên DEV
                              → cherry-pick/merge to release/v* → PROD deploy
```

Branch `fix/F-035-edit-dialog-line-items-width` là first example đúng workflow trong session. Push thẳng `release/v*` CHỈ cho critical incident (security, data corruption, complete PROD outage).

**Memory hardening:**
- ✅ `conventions.md` — 4 anti-patterns new:
  1. Hand-pick field mapping trong service create/update/init (audit grep `.map((li) =>` khi thêm field)
  2. "Actual overrides Estimated" semantic mà không hỏi business intent (additive vs replace)
  3. Push commit thẳng `release/v*` mỗi hotfix (cowboy workflow)
  4. Multi-source data field — explicit priority chain documented
- ✅ `known-issues.md` — entry này
- ✅ Backend pnl.service.spec 6 TC-LIC-* test cases include Danny screenshot scenario reproduction

**Lessons hardened:**
1. Thêm field mới vào schema → GREP `.map((field) =>` toàn codebase backend + admin để audit từng transform layer. Hoặc dùng spread `{...field, computed_only}` thay vì hand-pick.
2. Manager `/5bib-plan` checklist: "Multi-source cost/revenue → hỏi business REPLACE hay INCREMENTAL trước khi design priority chain."
3. Workflow guard: push thẳng `release/v*` CHỈ cho critical incident. Bug fix bình thường = branch + UAT.
4. Test fixture phải dùng real-world scenario reproduction (TC-LIC-06 reproduce Danny screenshot exactly — 185M+1M=186M, margin 11.1%). Synthetic data dễ miss semantic bugs.

---

### 2026-05-14 — Reconciliation DOCX dùng wrong merchant info source (PROD report Danny)

**Discovery:** Reconciliation #6a054f08e3b84f1a9c6e35cb (Zaha tenant #46 Hai Phong Legacy Marathon 2026 04/2026). Danny screenshot trang merchant detail show 2 sources:
1. Tab "Thông tin" (5BIB Platform sync, readonly): Tên công ty "Việt Nam Tôi đó - My Vietnam 2025", MST "0193762", contact "VinGroup / hienhm@5bib.com / Hà Nội"
2. Tab "Công ty đối tác" (admin-entered): admin đã nhập riêng tên pháp nhân + MST + địa chỉ + người đại diện + bank info chính xác

**Symptom:** DOCX export Zaha April 2026 dùng data từ tab "Thông tin" (platform sync) — sai. Đáng lẽ phải dùng tab "Công ty đối tác" admin-entered (single source of truth pháp lý).

**Detected by:** Danny manual UAT screenshot 2026-05-14 ~15:30 GMT+7.
**Resolved:** commit `b218a53` push `release/v1.8.1` ~15:55 GMT+7.

**Root cause:** `docx.service.ts` line 169-178 chỉ đọc `(rec as any).tenant_metadata` (sync readonly từ MySQL platform tenant table). KHÔNG check `MerchantConfig` collection trên MongoDB 5bib-result.

`MerchantConfig` schema từ F-024 era đã có sẵn 8 field admin-entered đúng cho purpose này:
- `legal_name`, `tax_code`, `business_address`, `representative_name`, `representative_title`, `bank_account`, `bank_name`, `bank_branch`

F-030 (commit `f980228` 2026-05-13) fix `env.provider.*` cho 5BIB BÊN B (provider info), nhưng KHÔNG audit BÊN A merchant info source — chỉ touched provider config. Bug merchant info source là pre-existing từ F-001 reconciliation original, masked vì lúc đó không có admin-entered tab.

**Fix:**
- Inject `Model<MerchantConfigDocument>` vào DocxService (module đã register sẵn)
- Priority chain: MerchantConfig admin-entered > tenant_metadata sync > rec.tenant_name
- Áp dụng 7 field: legal_name, tax_code, business_address, representative_name, representative_title, bank_account, bank_name (phone giữ tenant_metadata — MerchantConfig schema chưa có field phone admin-entered)
- Fail-soft: Mongo error → log warn + fallback tenant_metadata (KHÔNG crash export)
- Audit log per generate call: `docx_merchant_source tenant=N mc=yes/no companyName=mc/meta/tenant_name`

**Manager self-audit — tại sao bug pre-existing F-001 mà sau ~5 features touched recon vẫn không phát hiện?**

1. **F-030 scope was provider, not merchant.** Manager `02-manager-plan.md` F-030 chốt fix 5BIB BÊN B `env.provider.*` (commit `f980228`). KHÔNG audit BÊN A merchant info source — chỉ touched provider config. Convention scope-lock chính xác nhưng cùng module dùng cùng pattern.
2. **MerchantConfig schema có sẵn từ era F-001 nhưng KHÔNG bao giờ được wire vào docx.** Bug original từ ngày đầu. F-001 docx có thể dùng tenant_metadata vì lúc đó admin chưa có UI "Công ty đối tác". Sau khi UI có (F-024 era?), backend không update để consume.
3. **`tenant_metadata` field là `(rec as any).tenant_metadata` — KHÔNG declared trong schema.** Field "rò rỉ" qua any-cast. Lúc Coder/Manager review code không thấy field, cũng không thấy reference đến MerchantConfig → bug invisible.
4. **0 test coverage merchant info priority pre-existing.** F-030 thêm TC-AO-07..10 cho provider info, KHÔNG có test merchant info source.
5. **DOCX không show source attribution trong UI.** User không có cách biết doc đang lấy info từ đâu cho đến khi compare manually.

**Memory hardening:**
- ✅ `conventions.md` — add anti-pattern "`(x as any).field_not_in_schema` reading" + "Multi-source data field — luôn document priority chain in service comment"
- ✅ `known-issues.md` — entry này
- ✅ Pattern minted: "Admin-entered field > Platform sync field > Schema fallback" — apply to all docs/exports that use merchant/tenant info
- ✅ F-030 schema gap flagged: MerchantConfig thiếu `phone` admin-entered field — schedule TD-MERCHANT-PHONE-FIELD

**Lesson hardened:**
1. Khi service đọc field qua `(x as any).field` cast → audit schema có declare field đó không. Nếu không → field "lậu", flag risk.
2. Multi-source data (platform sync + admin override) phải có explicit priority chain documented in service code comment.
3. Service writes that consume merchant/tenant info phải QC against admin-entered override scenario, không chỉ default-sync scenario.
4. Manager `/5bib-plan` F-030 type feature touching reconciliation services nên đính kèm "audit BÊN A merchant info source" trong checklist — sister fix opportunity.

---

### 2026-05-14 — F-024 Contract Wizard 2 UX bugs (PROD report Danny)

**Discovery URL:** `https://admin.5bib.com/contracts/create` (wizard step 1 + 2)
**Symptom:**
1. Step 1 "Loại hợp đồng" + "Loại tài liệu" Select trigger hiển thị raw enum `TIMING` / `CONTRACT` thay vì VN labels "Dịch vụ tính giờ" / "Hợp đồng"
2. Step 2 "Đối tác" — list panel 19 partners + scroll KHÔNG tự đóng sau khi user click chọn 1 partner. List vẫn chiếm vertical space lớn, user phải scroll qua mới thấy form auto-fill bên dưới.

**Detected by:** Danny manual UAT screenshot 2026-05-14 (~14:00 GMT+7).
**Resolved:** commit `e166970` push `release/v1.8.1` ~14:30 GMT+7.

**Root cause:**

**Bug 1 (Select enum display):** Admin migrate sang `@base-ui/react/select` v1.3.0 (Base UI, NOT classic Radix). Trong Base UI, `<Select.Value />` empty children KHÔNG auto-lookup matched `<SelectItem>` children theo value. Mặc định render raw value string. Code F-024 cũ pattern `<SelectValue />` đã viết theo Radix mindset → broken sau migration. Vi phạm Display Convention F-028 (`f18da46`).

**Bug 2 (Partner picker no-collapse):** `partner-picker.tsx` always render list panel. State `value` set chỉ highlight selected item, KHÔNG hide list. Vertical space lost = list + form đè nhau visually. UX rule "selection collapses list" không được apply.

**Fix 2-bug:**
1. Add `CONTRACT_TYPE_LABEL` + `DOCUMENT_TYPE_LABEL` Record maps tại đầu `contract-wizard.tsx` + change `<SelectValue />` → `<SelectValue>{(v) => LABEL[v] ?? v}</SelectValue>` (Base UI render prop pattern)
2. Add `browsing` state trong `PartnerPicker`. Conditional render:
   - `value && !browsing` → collapsed compact card (entityName + MST + "Đổi đối tác" button)
   - else → search input + list panel
   - Sau pick / sau tạo mới → setBrowsing(false) auto

**Manager self-audit — tại sao bug pre-existing F-024 không detect?**
- F-024 ship 2026-05-11 commit `c41feb3` — Coder QC khi đó chỉ test logic (create contract, wizard navigation) — KHÔNG test visual UX với data thực tế
- Sau F-024 ship đã có 3 features khác (F-028 finance, F-029 hardening, F-032 partner import) chạm Contracts module — KHÔNG ai mở wizard `/contracts/create` để test
- Bug 1 specific quirk: `@base-ui/react/select` Base UI vs `@radix-ui/react-select` Radix differ behavior. Admin migration `@base-ui` lúc nào KHÔNG có grep audit `<SelectValue />` usage check render-prop pattern compatibility
- Bug 2 specific quirk: Designer/Manager khi review PRD không call-out "selected state → collapse selector". UX implicit assumption.

**Memory hardening:**
- ✅ `conventions.md` — add anti-pattern "`<SelectValue />` empty children với @base-ui/react/select Base UI" + Display Convention restatement
- ✅ `known-issues.md` — this entry + TD-ADMIN-SELECTVALUE-SWEEP flagged
- ✅ Pattern minted: "Picker/Selector with list → collapse to compact card after selection + Reopen button" (UX-PICKER-COLLAPSE)

**TD-ADMIN-SELECTVALUE-SWEEP (MED priority):** `grep -rn "SelectValue />" admin/src --include="*.tsx" | wc -l` = 57 instances. Mọi instance render enum/status đều có thể display raw. Need sweep audit:
- timing-leads list/detail status
- result-image-stats filters
- contract-edit-dialog (status + provider)
- service-catalog-table (category + filter)
- acceptance-report-form (verdict)
- contract-list-table (filter status + contract type)
- contract-wizard step 4+5 (catalog picker, payment terms)

Sweep approach: tạo `admin/src/lib/select-labels.ts` central dictionary + helper component `<EnumSelectValue map={...} />` wrap pattern. Apply progressively per page khi Danny report tiếp.

**Lesson hardened:**
1. UI primitive lib migration (Radix → Base UI hoặc tương tự) → audit downstream usage pattern, KHÔNG assume API parity
2. Picker/selector với always-visible list → mặc định collapse-after-select (UX rule)
3. Manager Plan checklist add: "Select trigger render VN label or raw enum?"

---

### 2026-05-14 — F-031 + F-032 Excel Import dialog overflow UX (PROD UX bug)

**Discovery URL:** `https://admin.5bib.com/contracts/partners` (Import Excel button → preview step)
**Symptom:** Long VN entity names (e.g. "CÔNG TY TNHH ĐẦU TƯ THƯƠNG MẠI DỊCH VỤ XYZ...") tràn ngang ra ngoài DialogContent → cột MST/Đại diện/Điện thoại/Email bị cut khỏi viewport → footer buttons "Quay lại / Hủy / Xác nhận" bị đẩy off-screen. Empty space giả ở đáy dialog (footer ở dưới fold).
**Detected by:** Danny manual UAT trên PROD ~22:30 GMT+7 2026-05-13 (screenshot evidence).
**Resolved:** commit `6c6ce8a` push `release/v1.8.1` ~10:15 GMT+7 2026-05-14 (~12 giờ từ phát hiện đến deploy — Danny ngủ qua đêm, sáng dậy báo).

**Root cause:**
- DialogContent `max-w-5xl max-h-[85vh] overflow-y-auto` — width quá hẹp cho table 5-col với VN long names
- Table wrapper `max-h-64 overflow-y-auto` — chỉ scroll Y, X tràn ra ngoài
- Không có `table-fixed` + column widths → first column (entityName) chiếm > 90% width
- Cells không có `truncate` + `title` tooltip
- DialogFooter inline trong body scrollable → bị đẩy off-screen khi content dài
- BUG SHARED giữa F-031 service-catalog-import-dialog + F-032 partner-import-dialog (cùng pattern copy)

**Fix 2-layer (both dialogs):**
1. **DialogContent flex layout:** `flex flex-col p-0 gap-0 max-h-[90vh] overflow-hidden w-[min(95vw,1200px)]`
2. **Sticky header/footer:** `<DialogHeader className="shrink-0 border-b">` + `<DialogFooter className="shrink-0 border-t">` (outside body)
3. **Scrollable body:** `<div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">`
4. **Table fixed + col widths:** `<Table className="table-fixed w-full">` + explicit `min-w-[200px]` / `w-[120px]` per `<TableHead>`
5. **Cell truncate + tooltip:** `<TableCell className="truncate" title={value}>`
6. **Sticky table header:** `<TableHeader className="sticky top-0 bg-background z-10">`
7. **Invalid error cell:** `line-clamp-2` thay vì 1-line cut

**Manager self-audit — tại sao Manager + QC miss?**
- QC report claim "5 phases PASS" nhưng Phase 5 (UI compliance) chỉ tick `[x] Loading / Empty / Error / Success` mà không mở dialog thật trong browser
- "10x flaky test rule" marked N/A — không có integration test với real-world VN data
- Unit test fixture dùng tên ngắn ("Co A", "Co B No Tax") → KHÔNG reproduce overflow case
- Pattern "2-step Excel Import UX" mint từ F-031 đã có sẵn bug — F-032 copy y nguyên → bug double-shipped
- Manager `/5bib-deploy` chỉ check backend route registered + container image tag, KHÔNG visual smoke test dialog

**Memory update (apply hotfix):**
- ✅ `conventions.md` — thêm anti-pattern "Dialog với table dài + variable-width content KHÔNG `table-fixed` + truncate" → reject
- ✅ `conventions.md` — thêm pattern "Dialog với table — sticky Header/Footer flex layout + table-fixed + truncate + line-clamp"
- ✅ `conventions.md` — thêm rule "Visual QC mandatory pre-merge cho UI feature" — QC phải mở browser test với real-world long VN data, paste DOM snapshot vào `04-qc-report.md` Phase 5
- ✅ `known-issues.md` — entry này (incident log)
- ✅ Manager `/5bib-deploy` gate addition: reject deploy nếu QC report thiếu visual evidence cho UI feature có dialog/modal/table

**Lesson hardened (Manager mandatory cho mọi UI feature):**
1. Manager `/5bib-plan` Scope Lock phải call out "Dialog/Modal width budget + column widths"
2. QC phải có Phase 5.UI: open browser → screenshot → paste evidence
3. Coder unit tests cho service logic KHÔNG đủ — admin team phải có ít nhất 1 manual UAT screenshot trước khi mark READY_FOR_QC
4. Pattern reuse từ proven feature KHÔNG miễn QC — visual bug có thể double-ship nếu source pattern có sẵn bug (case này F-031 → F-032)
5. Test fixture phải dùng tên VN dài thực tế (≥30 ký tự, có diacritics) — không phải "Co A" / "Item 1"

---

## 🧊 Known quirks (BẮT BUỘC nhớ — từ CLAUDE.md)

| Module / Vùng | Quirk | Lý do / Hậu quả |
|---------------|-------|------------------|
| **`stripRacePrivateFields`** | Phải inject `id = _id.toString()` TRƯỚC khi filter `_id` | Frontend dùng `race.id` để gọi `/api/race-results?raceId=` — quên inject = empty array âm thầm (KHÔNG có 4xx) |
| **MongoDB connection in Docker** | Dùng `host.docker.internal:27018` + `extra_hosts` | MongoDB chạy trên host, container access qua host network |
| **nginx 502** | Check escaped `$http_upgrade` trong nginx config | Common bug khi setup websocket / SSE |
| **CI deploy SSH refused** | VPS dùng port 6060, KHÔNG default 22 | Cần `VPS_PORT` secret = 6060 |
| **Frontend build errors về `@/lib/api`** | Legacy exports đã removed | Không import từ `@/lib/api` nữa, chỉ dùng `@/lib/api-generated/` + `@/lib/api-hooks` |
| **Admin race creation form** | Cần đủ booleans: `enableEcert`, `enableClaim`, `enableLiveTracking`, `enable5pix` | Thiếu = build error |
| **Generated SDK out-of-sync** | Phải chạy `pnpm generate:api` ở admin/frontend SAU mỗi backend DTO change | Quên = type sai trong frontend, có thể runtime error |
| **`revalidatePath` vs `revalidateTag`** | Path: revalidate route cụ thể; Tag: revalidate mọi fetch có tag | Chọn sai = cache không refresh hoặc refresh quá nhiều |
| **Athlete result data format** | `Chiptimes`/`Paces`/`OverallRanks` là **JSON strings** trong API response | Frontend phải JSON.parse, dùng course checkpoint config để map keys → display names |
| **Race status `draft`** | Auto-excluded từ public API (frontend homepage) | Admin có thể thấy mọi status, nhưng public endpoint phải filter `status !== 'draft'` |
| **Result Image** | Background custom upload dùng multipart/form-data, NOT JSON | Tránh nhầm khi viết client |
| **Articles cache flush** | Pattern `articles:*` flush global qua `scanStream` + pipeline. Rate-limit `ratelimit:*` SURVIVES flush | Đảm bảo cache không bị clear nhầm rate-limit state |
| **`AddCourseDto` ↔ Mongoose Course schema sync** | NestJS ValidationPipe `whitelist:true, forbidNonWhitelisted:true` REJECT field không khai trong DTO → 400 silent | Mỗi khi thêm field vào Mongoose `Course` subschema (vd: `distanceKm`, `services`) PHẢI thêm decorator tương ứng vào `AddCourseDto` + `CourseCheckpointDto` trong `backend/src/modules/races/dto/add-course.dto.ts` |
| **Vendor RaceResult API schema** | RR API LUÔN return full timing keys với `value=""` cho checkpoint athlete chưa qua. Schema không thay đổi giữa race chưa start vs đã chạy | KHÔNG drop keys khi filter Chiptimes/Guntimes — set `value=""` để khớp vendor. Nếu test fixture drop keys → bug khi merge với Guntimes (Phase A regression FEATURE-001) |
| **Frontend-driven debounce vs backend event-emitter** | RacesModule ↔ TimingAlertModule có circular DI risk. FEATURE-001 chọn frontend debounce 800ms thay vì backend event hook | Nếu cần backend-driven trigger (cron pre-warm, etc.) → dùng `@nestjs/event-emitter` (pnpm install PAUSE) hoặc Kafka/queue, KHÔNG inject service direct |
| **Reconciliation status enum KHÔNG có `'cancelled'`** | Schema enum: `draft, flagged, ready, approved, sent, reviewed, signed, completed`. Overlap query exclude state dùng `$ne: 'draft'` (Caveat-01 FEATURE-003) | Nếu logic tương lai cần loại doc đã hủy → thêm enum value mới qua schema migration trước, KHÔNG dùng status không tồn tại |
| **Reconciliation period invariant (post FEATURE-003)** | 1 reconciliation = 1 race × N (1≤N≤12) tròn tháng liên tiếp. `period_start` LUÔN `YYYY-MM-01`, `period_end` LUÔN `YYYY-MM-{lastDay}`. Cron + modal hàng loạt vẫn N=1; form tạo single hỗ trợ N≥1 | Mọi caller path mới TUÂN THỦ invariant. DTO validators (`@IsPeriodBoundaryDate`, `@IsValidPeriodRange`) ép buộc tại API boundary |
| **`parsePeriod()` UTC bug đã FIX trong release/v1.6.3** | Service + preflight đều dùng `Date.UTC(year, month, 0).getUTCDate()` + string template. KHÔNG còn `toISOString().slice(0, 10)` | KHÔNG re-fix. Nếu cần extend → reuse cùng pattern UTC math |
| **NestJS route ordering `audit/period-boundary` BEFORE `:id`** | Nếu declare sau `:id` → NestJS match `:id` cho 'audit' → call `findOne('audit')` shadow handler | Mọi controller có cả route literal + `:id` → declare literal TRƯỚC. QC test trong `reconciliation.controller.spec.ts` pin behavior |
| **Compound index `{tenant_id, mysql_race_id, period_start, period_end}` trên `reconciliations`** | Phục vụ overlap query BR-11 (`$lte/$gte` predicate). AutoIndex foreground build ≤ 1s với 18 docs hiện tại | Khi DB lên 100K+ docs → consider `background: true` hoặc separate offline migration |
| **Reconciliation S3 download anti-pattern (post FEATURE-004)** | Bucket `5sport-media` PRIVATE; admin UI download dùng backend `/api/reconciliations/:id/download/{xlsx\|docx}` với Logto Bearer; KHÔNG render S3 URL trực tiếp ở `<a href>` hoặc fetch | Đã encounter ở `[id]/page.tsx:536+546`, `new/page.tsx:1035+1050`. Pattern khác bucket private nên áp dụng cùng logic — JSDoc cảnh báo + backend stream endpoint |
| **`xlsx_url`/`docx_url` field internal-use only** | Field giữ trong response DTO cho `batch-export.service.ts:157+172` consumer (pipe S3→ZIP server-side qua AWS SDK signed request). UI client KHÔNG được render trực tiếp | Khi expose field tương tự ở response DTO khác → JSDoc cảnh báo "INTERNAL USE ONLY" + chỉ dẫn endpoint download thay thế |
| **Leaflet SSR-unsafe trong Next.js 16** | Leaflet uses `window` directly → SSR build fail. Pattern: wrap inner Client Component qua `dynamic({ ssr: false, loading: ... })` từ Server-safe wrapper | F-006 áp dụng cả admin (`CourseMapTabInner`) + frontend public (`CourseMapInner`). Reusable pattern cho future map features (athlete tracking, course certification visualization) |
| **`divIcon({ html })` user-data interpolation = XSS vector** | Leaflet `divIcon({ html: ... })` raw interpolates strings into innerHTML. User-controlled data (waypoint name, checkpoint key, athlete name) MUST be escaped via inline `escapeHtml()` helper before interpolation. F-006 QC catch BLOCKER round 1 rework | Pattern: define inline `escapeHtml(s: string)` escape `&`, `<`, `>`, `"`, `'`. NEVER raw interpolate user data into `divIcon({ html })` |
| **AddCourseDto + CourseCheckpointDto schema sync (post FEATURE-006)** | F-006 added: `RaceCourse.gpxParsed`, `gpxSimplifiedUrl`, `CourseCheckpoint.lat`, `CourseCheckpoint.lng`. Quirk hotfix `804f707` reaffirmed | Mỗi field trong `RaceCourse`/`CourseCheckpoint` Mongoose subschema PHẢI có decorator tương ứng trong `AddCourseDto` + `CourseCheckpointDto` + `GpxParsedDto`. Update DTO sync test PASS sau mỗi schema change |
| **Kiosk Web Audio + Fullscreen co-location (post FEATURE-013)** | `result-kiosk/` requires user-gesture to activate Web Audio AudioContext + native Fullscreen API → both APIs co-located on "Bật chế độ Kiosk" button click handler (NOT initial page load). AudioContext is LAZY (`ensureAudioContext()` on first beep, NOT at hook init). `requestFullscreen()` MUST be called inside click handler call stack (NOT setTimeout/Promise.then deferred) — browser tracks user activation status synchronously | Browsers reject AudioContext / `requestFullscreen` if call stack didn't originate from user gesture. Multiple separate gesture-required calls = multiple user clicks (bad UX) → co-locate at ONE button. Both APIs swallow errors silently (CSS attribute fullscreen + audio-disabled beep no-ops) keeps surface usable if browser blocks one. See conventions.md "Web Audio + Fullscreen API user-gesture co-location" pattern |
| **Athlete client-derive 9-status with editHistory precedence (post FEATURE-014)** | `admin/src/lib/deriveAthleteStatus.ts` derives 9-status enum (REG/PICKED/DNS/LIVE/FIN/DNF/CUT/DSQ/MED) purely client-side from existing race-result fields (`dnf`/`dnsChipFail`/`chipTime`/`OverallRanks`/`timingPoint`/`editHistory[]`). Manual override via `editHistory[]` field=`status` ALWAYS WINS over vendor signal (BR-AS-02 trust-admin) — prevents auto-undo when admin DSQs an athlete who later pings a chip. MED + CUT have NO vendor signal — only manual override (BTC race-day judgment per Race Ops Expert advisory §2). DSQ via 3 paths (editHistory + timingPoint sentinel "DSQ-CP3" + dsqReason); DNF via 3 paths (numeric `dnf>0` + boolean `dnf===true` + timingPoint='DNF'); FIN gates on hasFinishMarker AND hasTimeData AND hasFiniteRank (rejects vendor sentinels `'-'`/`'00:00:00'`/`'0'`); DNS gated on `raceStatus === 'ended'` (prevents pre-race no-show mis-classification); LIVE recognizes partial split via timingPoint not FINISH/DNS/DNF; PICKED via `racekitReceived` (camelCase + snake_case both); REG fallback default never returns null. F-013 result-kiosk uses similar client-derive pattern but only 5 statuses (FIN/DNS/DNF/DSQ/LIVE) — duplication tracked TD-F014-02. PascalCase + lowercase vendor field tolerance honored throughout (vendor APIs may return `Bib` or `bib`, `ChipTime` or `chipTime`). Refactor to single shared util when backend `status` field schema migration lands (FEATURE-016+). |
| **F-015 Check-In Kiosk SCRAPPED 2026-05-08** | Duplicate of ORG.5bib.com pickup module. `race.checkInWindow` schema field LEFT in DB (deprecated, no migration). `check_in_logs` collection ORPHANED (no writers/readers, will TTL-expire naturally for Redis keys `checkin:lock:*` + `checkin:race:*:stats`). `admin/src/lib/kiosk/` shared lib KEPT (F-013 + F-017 still consume). `@zxing/browser@0.2.0` package KEPT (F-017 may use Phase 2). | Future feature touching `Race.checkInWindow` field → safely remove on next breaking schema change. Don't re-introduce check-in module — sync from ORG.5bib.com instead. |
| **Settings sectioned-scroll IA + 6-section pattern (post FEATURE-014)** | F-014 refactored 1692-LOC legacy editor `admin/.../settings/page.tsx` → 268-LOC composer + `SettingsLayout` sticky nav + 6 sections (Race Meta / Course / Timing / Publishing / Integrations / Advanced). Formula & Fees DROPPED per audit empty (BR-AS-54). `cacheTtlSeconds` MOVED to Integrations per BR-AS-39. URL preserved (no migration); HTML5 hash anchor `#section-id` enables bookmark; IntersectionObserver active highlight; `prefers-reduced-motion` respected. Each section is self-contained (own form state + save mutation via react-hook-form); 4 per-section save buttons preserved per BR-AS-42. No autosave block, no leave-confirm — admin trust philosophy. **5 PRESERVED stack components ZERO diff** verified via `git diff --stat HEAD -- "settings/components/"`: TimingDetectionConfigSection (F-010) + TimingFormulaTooltipContent + TimingPresetComparisonTable + TimingPresetRationalePanel + timing-presets.constant (all F-012); F-008v2 SettingsLinkCardsSection + F-009 CourseMapFullpageLinkCard re-imported untouched. BR-AF-23 byte-for-byte preserve mandate honored — 9th successful verbatim port through cluster (64/64 logical fields + 7/7 stack pieces verified). PAUSE-AS-02 field-mapping checklist was THE planning artifact (saved 6+ ambiguous decisions during refactor). |

---

## 🚨 Fields Nguy Hiểm (CLAUDE.md — must read trước khi đụng)

| Field | Dùng ở đâu | Downstream call sẽ broken nếu thiếu/đổi |
|-------|-----------|------------------------------------------|
| `race.id` / `race._id` | `races/[slug]/page.tsx`, `[bib]/page.tsx`, `ranking/page.tsx`, `compare/page.tsx` | `/api/race-results?raceId=` |
| `course.courseId` | tất cả result pages | `/api/race-results?course_id=` + stats endpoints |
| `result._id` | admin `results/page.tsx` | `PATCH /api/race-results/:id` |

**Quy tắc khi đụng response shape:**
1. Grep toàn frontend + admin tìm consumer của field
2. Nếu field dùng làm key cho API call → KHÔNG strip mà không alias
3. Verify end-to-end downstream sau deploy (xem `conventions.md` Pre-Deploy Checklist)

---

## 🧊 Quirk được Danny chốt 2026-05-10 — Upload ảnh phải ASCII

**Vấn đề:** Dịch vụ upload admin (race banner / sponsor logo / course image) lưu RAW filename lên S3. Khi tên file có dấu tiếng Việt + dấu cách (vd `FII_Đại Hội Thể Thao OFFICIAL KV.png`) → URL S3 trong DB chứa raw Unicode → browser CSS `background-image: url(...)` từ chối load → ảnh không hiện trên public site.

**Quyết định Danny 2026-05-10:** **KHÔNG sửa backend slugify** (rủi ro phải migrate S3 keys + test 3 luồng admin upload + sự cố production). Thay vào đó:

✅ **Workaround vĩnh viễn:** Admin/BTC tự đổi tên ảnh thành ASCII (không dấu, không space, dùng dash) **TRƯỚC khi upload** lên admin.

Ví dụ:
- ❌ KHÔNG đặt: `Đại Hội Thể Thao FUYU 2026.png`
- ✅ Đặt: `dai-hoi-the-thao-fuyu-2026.png` hoặc `fuyu-2026-banner.png`

**Cảnh báo cho feature mới đụng upload:**
- KHÔNG cần sửa upload service slugify — Danny đã từ chối
- Nếu phát hiện ảnh khác không hiện → check filename trong DB, hỏi BTC đổi tên

**F-021 Bug #4 (frontend `encodeURI`)** đã ship — race detail page đã wrap. Frontend các page khác nếu hiển thị ảnh từ S3 với tên file Việt → sẽ không hiện trừ khi đổi tên.

---

## 🌍 Vùng cẩn thận khi `/5bib-init` đụng vào

### `race-result/` (Result Image Creator v1.0)
- Canvas-based render với `@napi-rs/canvas`
- Có lock pattern (`render-lock:*` 60s TTL) để dedupe concurrent renders
- S3 lifecycle 24h cho prefix `result-images/`
- Fonts trong `backend/assets/fonts/` (Inter + Be Vietnam Pro TTFs)
- `RESULT_PUBLIC_URL` env phải đúng cho QR + share link
- `RENDER_MAX_CONCURRENT` semaphore — tune theo CPU

### `articles/` (cache phức tạp)
- 4 key prefix khác nhau: `articles:latest:*`, `articles:list:*`, `articles:detail:*`, `articles:categories:*`
- Cache invalidation: admin write → flush ALL `articles:*` qua `scanStream` + pipeline
- Rate-limit (`ratelimit:article-view:*`, `ratelimit:article-helpful:*`) phải SURVIVE flush
- Test cẩn thận khi đổi cache logic — dễ break SEO/UX

### `logto-auth/` (auth)
- 🔴 KHÔNG được tự build JWT, KHÔNG bypass Logto
- Mọi protected route đi qua Logto session/guard
- Đụng auth → cần Danny duyệt

### `race-master-data/` (sync với external)
- Có 3 lock keys: `master:sync-lock:*`, `master:cron-lock:*`, `master:lookup-lock:*`
- HSET cache trong Redis: `master:athlete:bib:*` (NO PII), `master:athlete:byid:*`
- Stats cache TTL chỉ 60s
- Đụng module này → check sync flow + lock contention

### Race lifecycle
- 4 status: `draft → pre_race → live → ended`
- `draft` excluded from public API (auto)
- Transitions có thể cần atomic op (tránh race condition khi 2 admin đồng thời update)

### Sponsors
- 3 levels: `silver`, `gold`, `diamond` (priority sort: diamond first)
- Custom order field
- Public endpoint `/api/sponsors`, admin endpoint `/api/sponsors/all`
- Admin upload logo qua S3
- Cache: `homepage:sponsored` (300s)

---

## 📌 Cách Manager dùng file này

**Khi `/5bib-init`:**
- Đọc Critical + Tech debt — feature đụng module nào trong bảng → flag RISK trong `00-manager-init.md`
- Đọc Known quirks — copy quirk liên quan vào `00-manager-init.md` để Coder không quên
- Đọc Fields Nguy Hiểm — flag nếu feature đụng response shape

**Khi `/5bib-deploy`:**
- Nếu QC report có `Tech debt còn lại` → thêm vào bảng "Tech debt"
- Nếu fix được issue trong "Critical" → đánh dấu RESOLVED + ngày + feature ID
- Nếu phát hiện quirk mới → thêm vào "Known quirks"

---

## 🚨 Workflow violations log (Manager self-audit)

> Manager TỰ ghi vào đây mỗi khi vi phạm protocol. Mục đích: tránh repeat + làm rõ lessons learned.

### 2026-05-09 — F-019 deploy mismanaged

| Vi phạm | Hậu quả | Bài học |
|---------|---------|---------|
| `/5bib-deploy F-019` chỉ close F-019 dù branch có 8 features cluster #1-8 chưa close (F-005..F-018) | Memory `feature-log.md` chỉ ship F-019 → 8 features kia ở state bất hợp pháp (code ship nhưng không có 05-manager-deploy.md) | Khi merge branch có MULTIPLE features chưa close → Manager phải tạo deploy entry CHO TỪNG feature trước khi push prod, hoặc tạo "batch deploy entry" `05-manager-batch-deploy-cluster-N.md` |
| Push `release/v1.7.0` mà không verify build Docker local | 3 round CI fail liên tiếp (lockfile / pnpm version / missing deps + TS error) — production deploy delay 2h | Pre-push gate BẮT BUỘC: chạy `docker build .` cho 5 apps trên branch trước `git push` |
| `/5bib-init F-020` mở khi prod chưa green (still in-flight: prod deploy fail round 3) | Vi phạm rule "no in-flight feature mới khi prod chưa stable" | Manager refuse `/5bib-init` nếu có active prod incident |
| Build local PASS nhưng CI FAIL (F-006 missing deps + F-018 aria-pressed) | Local có cached `node_modules` từ session dev — không catch missing dep. Local pnpm v10 vs CI pnpm v11 latest — không catch breaking validation | Manager ghi convention: "local build verify" KHÔNG đủ, phải `rm -rf node_modules && pnpm install --frozen-lockfile && pnpm build` để mô phỏng CI |

### Resolution applied (4 round prod fix):
- Round 1: regen `admin/pnpm-lock.yaml` (commit `fbde095` / `d4c0283`)
- Round 2: pin `pnpm@10` trong 5 Dockerfiles (commit `f4a038b` / `00a7b2e`)
- Round 3: add 4 F-006 deps + Boolean() wrap aria-pressed (commit `0cc0885` / `0954b6c`)
- **Round 4 (POST-DEPLOY INCIDENT):** sau Round 3 CI build PASS + container deploy → backend crash loop `Cannot find module '/app/dist/main'`. Root cause: F-005 ship folder `backend/scripts/timing-alert-simulator/*.ts`, `tsconfig.build.json` không exclude → TypeScript include scripts/ → output `dist/src/main.js` thay vì `dist/main.js` → Dockerfile CMD `node dist/main` MODULE_NOT_FOUND. Fix: add `scripts` vào tsconfig.build.json exclude (commit `af67673` / `9febaf7`). **Live downtime ~15 phút.** Latent bug từ F-005 ship, không trigger trên dev environment vì admin/frontend không proxy backend qua docker (host pnpm dev) → chỉ phát ra khi prod docker build + run. v1.6.5 không bị vì F-005 chưa ship.

### Critical lesson (Round 4):
- **`tsconfig.build.json` exclude pattern là single point of failure** — bất kỳ folder `.ts` mới (vd `scripts/`, `tools/`, `e2e-helpers/`) ở backend root level mà không thêm exclude → flatten output break Dockerfile CMD path.
- **Convention bổ sung:** Khi feature mới add folder `.ts` ngoài `src/` → Manager `/5bib-init` phải flag risk + Coder `/5bib-code` phải update `tsconfig.build.json exclude` cùng PR. Nếu không add exclude → QC reject với rule "non-src TS folders must be excluded from build".
- **Convention bổ sung 2:** Production deploy verify gate phải bao gồm `docker run <backend-image> sh -c "ls dist/main.js"` để smoke test entry point exists trước khi mark deploy success.

---

## 🪦 Retired TD (feature scrapped)

> Historical reference only — these TD items belong to features that were rolled back. They are NO LONGER ACTIONABLE but kept here for context (in case future similar work crosses the same territory).

| ID | Module | Original Debt | Retirement Reason |
|----|--------|---------------|-------------------|
| TD-F015-01 | admin / result-kiosk + lib/kiosk | F-013 result-kiosk hooks NOT yet retrofitted to shared `admin/src/lib/kiosk/` (1-line `import { useFullscreen } from '@/lib/kiosk'` swap × 3 files in `result-kiosk/hooks/`). F-013 hooks STILL EXIST verbatim and work standalone | Retired 2026-05-08 — F-015 ROLLED BACK (duplicate ORG.5bib.com). Note: shared lib `admin/src/lib/kiosk/` KEPT (F-013 + F-017 consume), so the retrofit consideration may still surface organically in future cluster work |
| TD-F015-02 | admin / check-in-kiosk / tests | 11 deferred frontend specs (`@ts-nocheck` Jest+RTL) — `useAthleteLookup` / `useCheckInMutation` / `useStationSync` / `useQRScanner` / `MultiInputLookup` / `AthleteCheckInCard` / `ConfirmPickupButton` / `CMNDLastFourInput` / `useFullscreen` / `useKioskIdle` / `useKioskSound` | Retired 2026-05-08 — F-015 specs deleted with feature scrap |
| TD-F015-03 | backend / migrations | Migration `2026-05-08-add-check-in-window.ts` PAUSED — idempotent + DRY_RUN env-flag mode + formula `start = startDate - 3 days`, `end = startDate - 1 hour` per BR-CK-06 | Retired 2026-05-08 — migration DELETED (never ran) with feature scrap |
| TD-F015-04 | admin / check-in-kiosk / offline | Offline mode (IndexedDB queue + SSE reconnect) deferred to Phase 2; Phase 1 ships "online required" banner | Retired 2026-05-08 — feature scrapped |
| TD-F015-05 | admin / check-in-kiosk / bulk | Bulk pickup (đoàn merchant) deferred to Phase 2 — Phase 1 single-BIB confirm only | Retired 2026-05-08 — feature scrapped |
| TD-F015-06 | backend / check-in / window enforcement | Backend `assertWindowOpen()` server-side enforcement currently no-op; window check was frontend-enforced via `CheckInWindowGuard.tsx` reading `Race.checkInWindow` | Retired 2026-05-08 — backend check-in module DELETED |
| TD-F015-07 | backend + admin / per-volunteer auth | Per-volunteer auth deferred to Volunteer Hub Cluster #9 #2 — F-015 used shared BTC admin login MVP (`LogtoAdminGuard` only, no per-volunteer attribution beyond `checkedInBy: userId`) | Retired 2026-05-08 — feature scrapped. Per-volunteer auth concern may resurface for Volunteer Hub feature, track separately |
| TD-F015-08 | backend + admin / check-in / kit checklist | Per-item kit checklist (T-shirt size, drop bag, race shirt, etc.) deferred Phase 2 — Phase 1 single boolean `racekit_received` | Retired 2026-05-08 — feature scrapped |
| TD-F015-09 | backend / check-in / load test | Load test 50 concurrent check-in per minute × 10 min sustained NOT yet executed — pre-deploy operational gate per Cluster #9 success criterion #5 | Retired 2026-05-08 — feature scrapped (no production deploy ever happened) |
| TD-F027-PHASE2-01 | admin / promo-hub / featured_races + recent_results | `featured_races.raceIds` + `recent_results.raceId` admin paste raw ObjectId (no validation feedback if wrong/deleted ID) | HIGH — UX friction admin. Reuse RaceSearchCombobox from F-024 contracts. ~2h effort. |
| TD-F027-PHASE2-02 | admin / promo-hub / image pickers | `hero.backgroundImage`, `promo_banner.imageUrl`, `seo.ogImage`, `link_grid.items[].imageUrl`, `image_gallery.images[].url` admin paste raw S3 URL (no UploadModule integration) | HIGH — UX friction. Reuse upload pattern from F-024 DOCX template upload. ~3h effort. |
| TD-F027-PHASE2-03 | admin / promo-hub / rich_text WYSIWYG | TipTap WYSIWYG cho rich_text section — deps `@tiptap/react` + starter-kit installed nhưng admin form vẫn dùng plain Textarea | MED — MKT team non-tech UX. ~2-3h effort. |
| TD-F027-PHASE2-04 | admin / promo-hub / preview pane | Preview pane = mock card. Phase 2: iframe `<slug>?preview=draft` query để render full SSR layout | MED. ~1-2h effort. |
| TD-F027-PHASE2-05 | admin / promo-hub / autosave | No autosave — admin phải bấm "Lưu" thủ công. Standard SaaS pattern autosave 5s sau mỗi edit | MED. ~2-3h effort. |
| TD-F027-PHASE2-06 | admin / promo-hub / list | No "Nhân bản hub" action — admin phải tạo mới + paste sections thủ công | MED. ~1h effort. |
| TD-F027-PHASE2-07 | frontend / hub / next-image | Sections use raw `<img>` tags. Migrate to `next/image` requires `next.config.js` domain whitelist (S3 + Unsplash + sponsor logos). Impact: LCP +200ms cho hero | MED. ~1h effort. |
| TD-F027-PHASE2-08 | both / promo-hub / e2e tests | Code review + smoke test only for MVP. Phase 2 cần Playwright cover 19 section types end-to-end (admin edit → save → public render → click track → analytics chart update) | MED. ~6-8h effort. |
| TD-F027-PHASE2-09 | frontend / hub / social_links icons | Hardcoded inline SVG cho 10 platforms — thêm platform mới (Threads, Mastodon, BlueSky) requires code change. Acceptable trade-off vs lucide gap on Vietnamese platforms (Zalo) | LOW. |
| TD-F027-PHASE2-10 | frontend / hub / countdown | `CountdownSection` polls every 1s via `setInterval` — battery drain on 8h-open tab. Acceptable for MKT use case. Phase 2: `requestAnimationFrame` throttle | LOW. |
| TD-F027-PHASE2-11 | admin / promo-hub / map_embed UX | Admin manually generates Google Maps embed URL from "Share → Embed". Auto-extract from share URL (`https://maps.google.com/?q=...`) defer | LOW. |
| TD-F027-PHASE2-12 | frontend / hub / form_embed hosts | `ALLOWED_FORM_HOSTS` whitelist 5 providers hardcoded (`docs.google.com`, `forms.gle`, `tally.so`, `form.5bib.com`, `forms.office.com`). Move to env config future khi cần thêm providers | LOW. |
| TD-F027-PHASE2-13 | frontend / hub / race_calendar grouping | iRaceticket pattern `race_calendar` grouped-by-month NOT implemented (current section là flat grid only). Workaround: admin tạo multiple `race_calendar` sections riêng cho từng tháng | LOW. |
| TD-F027-PHASE2-14 | frontend / hub / loading skeleton | Public page no `loading.tsx` skeleton. Server Component renders fast enough (TTFB 37-59ms). UX polish only | LOW. |
| TD-F027-PHASE2-15 | both / promo-hub / sitemap auth | `sitemap.ts` calls admin-gated endpoint `/api/promo-hubs?status=published` via internal docker network — works for current docker-compose but cần `X-Internal-Token` shared header nếu tách deploy frontend-only future | LOW. |
| TD-F027-PHASE2-16 | external / 5Ticket repo / domain rewrite | F-027 ship target SEO trên `5bib.com/hub/<slug>` nhưng PROD initial deploy chỉ trên `result.5bib.com/hub/<slug>` (5Ticket app deploy Vercel domain 5bib.com là codebase RIÊNG — không phải 5bib-result repo). Cần team 5Ticket add 1 rewrite `next.config.*` rules forward `/hub/*` → `result.5bib.com/hub/*`. Tài liệu hướng dẫn tại `docs/INTEGRATION-5ticket-promo-hub-rewrite.md`. **PENDING:** Danny forward team 5Ticket → merge PR vào 5Ticket repo → verify `5bib.com/hub/<slug>` render. Until then: hub URL = `result.5bib.com/hub/<slug>` (technically works but SEO juice không đổ vào `5bib.com` domain authority). **2026-05-14 update:** Frontend side đã fix asset prefix + internal links cho cross-app compatibility (commit `c895b03`). Team 5Ticket chỉ cần add rewrite rule. | HIGH — SEO impact. Effort 5min from 5Ticket team. |

## Manager workflow lesson — Cross-app Next.js rewrite gotchas (HOTFIX-F027-02 post-mortem)

**Failure mode:** Manager đề xuất Vercel rewrite cross-app `5bib.com/hub/*` → `result.5bib.com/hub/*` mà KHÔNG nghĩ tới:
1. Asset paths in HTML sẽ relative → 404 trên 5bib.com domain
2. Internal Next.js `<a href>` links sẽ resolve theo current browser host → broken cross-app

**Detection:** Dev 5Ticket caught the gotcha trước khi merge rewrite — saved a broken PROD deploy.

**Manager process fix (BR-MAN-F027-CROSS-APP):**

For ANY cross-app/cross-domain rewrite or proxy proposal, MUST verify upstream app's:

1. **Asset prefix config** — set `assetPrefix` to upstream's canonical URL
2. **Internal link policy** — hardcode absolute URLs OR use full router paths
3. **API call paths** — `process.env.NEXT_PUBLIC_API_BASE_URL` instead of relative
4. **Cookie/auth scope** — domain mismatch breaks session cookies (consider `domain=.5bib.com` if shared auth needed)

**Re-usable checklist for cross-app rewrites:**
- [ ] Upstream app has `assetPrefix` configured to canonical URL
- [ ] All internal `<a href>` and `<Link>` use absolute URLs (NOT relative)
- [ ] Client-side fetch/XHR uses full URLs (NOT path-only)
- [ ] No cross-domain cookie dependency
- [ ] No client-side router-based navigation (or accept full reload UX)
- [ ] CSS/font/image references absolute (or in same path-scope)

**Re-usable for:** any future cross-app integration (5sport.vn → 5bib.com, 5pix.com → 5bib.com, etc.)

---

## F-037 V2 (on-sale-race-detail-page) — Tech Debt + Resolved (2026-05-18)

### ✅ RESOLVED in F-037 V2

| ID | Status | Note |
|----|--------|------|
| **TD-F036-09** | ✅ RESOLVED 2026-05-18 | "On-sale races link external direct → missing SEO juice" — resolved by F-037 V2 creating internal SEO detail page `/giai-chay/[urlName]` with rich race content + courses + CTA to selling-web. Verified live preview: 17 on-sale cards now link internal `<Link>`, F-036 listing regression intact. |

### 🟡 NEW tracked from F-037 V2

| ID | Risk | Module | Item | Note |
|----|------|--------|------|------|
| TD-F037-01 | ✅ RESOLVED 2026-05-18 | backend/promo-hub | release/v1.8.8 deployed PROD 2026-05-18 15:34 ICT. Live verified: raceId 104/172/174/179 all return 200 + valid DTO, p95 124ms (target <500ms cold ✅, median 39ms warm exceeds <100ms target ✅), FE page render 200 OK with SEO `<title>` + CTA embedded. | Resolved by deploy ec3cd07 release/v1.8.8 |
| **TD-F037-SITEMAP-ISR-COLD** | LOW | frontend/sitemap-races.xml | Post-deploy DEV/PROD `/sitemap-races.xml` returns only root URL (1 entry) instead of full race list. Likely cause: ISR 24h cache returned `getAllRaces() = []` on first request during deploy when backend was restarting. Cache holds for 24h. | Will self-heal at 24h tick OR force via admin redeploy OR call REVALIDATE_TOKEN endpoint. Track: verify sitemap regen 2026-05-19 16:30 ICT. |
| **TD-F037-VERCEL-REWRITE-5TICKET** | MED SEO | 5Ticket external repo Vercel | `5bib.com/giai-chay/104` returns 404 — 5Ticket team needs to add Vercel rewrite forward `/giai-chay/*` → `result.5bib.com/giai-chay/*` (same pattern as TD-F027-PHASE2-16 for `/hub/*`). Until then, SEO juice goes to `result.5bib.com/giai-chay/*` direct URL (works) instead of `5bib.com/giai-chay/*` domain authority. | Forward integration doc to 5Ticket team — reuse `docs/INTEGRATION-5ticket-promo-hub-rewrite.md` pattern. ~5 min effort on 5Ticket side. |
| TD-F037-02 | LOW | backend/promo-hub cache | F-036 admin/seo trigger không invalidate F-037 cache tag (different namespace `promo-hub:race-on-sale-detail:`) — max 1h delay race admin update → user sees | Acceptable per BR-37-19 TTL-only design + race lifecycle external-controlled |
| TD-F037-03 | LOW | backend/promo-hub entity | `wave` + `add_ons` cols of `race_course` deferred (operational, not SEO) | Future feature can extend `OnSaleCourseReadonly` |
| TD-F037-04 | LOW | frontend/giai-chay | `CourseCard.tsx` component deferred (inline grid sufficient) | Phase 2 UX polish |
| TD-F037-05 | LOW | frontend/giai-chay | `RouteImageLightbox.tsx` deferred — route_image_url + route_map_image_url not lightbox-clickable | Phase 2 UX polish |
| TD-F037-06 | LOW | frontend/giai-chay | No conditional layout for on-sale vs MongoDB sources (uniform render) | Acceptable — same `Race` shape after dual-source map |
| **TD-F037-QC-01** | MED | frontend/giai-chay XSS | HTML XSS sanitization for `race.description` — backend returns raw HTML, frontend MUST sanitize on render. Verify post-deploy with curl + DOM inspection. Reuse F-027 hub `sanitize-html` pattern if missing | Manager post-deploy verify required |
| TD-F037-QC-02 | LOW | backend/promo-hub | Backend E2E Supertest tests deferred — local MongoDB+Redis setup not configured. Live curl verification post-deploy | Pre-existing F-027 convention |
| TD-F037-QC-03 | LOW | frontend/giai-chay | Frontend Playwright tests deferred — frontend has no Playwright infra (F-036 precedent) | Pre-existing convention, no test runner installed |
| TD-F037-QC-04 | LOW | backend/promo-hub perf | Performance SLA BR-37-21,22 (p95 < 500ms cold / <100ms warm) measure deferred until PROD deploy | k6/autocannon measure post-deploy |
| TD-F037-QC-05 | LOW | qc/persona walkthrough | Persona walkthrough Phase 6 UI scrutiny code-level only — live render verification requires backend deploy | Manager + Danny walk through 5 personas on `result-fe-dev.5bib.com` post-deploy |

### 🔧 Workflow hardening from F-037 V2

| ID | Risk | Item |
|----|------|------|
| **TD-MAN-NUMBER-COLLISION** | LOW workflow | F-037 number REUSED — V1 = DOCX colspan widths 2026-05-15, V2 = on-sale-race-detail-page 2026-05-18. Same as F-036 collision precedent. Both kept in log distinguished by "(V2 *)" label. **Hardening:** `/5bib-init` skill should bump counter immediately on init (not at deploy) + grep existing folder names before assigning. |



---

## 🚨 Manager workflow lesson — DOCX/Template content review MANDATORY render-and-eyeball (F-044 post-mortem 2026-05-19)

### Issue captured
F-044 (Contract DOCX Phase 2) đã pass:
- ✅ Coder 10-step Self-Review pipeline
- ✅ Coder 51 unit tests PASS + 210 regression PASS
- ✅ QC 6-phase walkthrough with Adjustment #1/#2/#3 verification
- ✅ Audit script extended regex reports `Hardcoded leaks (unique): 0` across 4 pattern classes
- ✅ QC verdict `✅ APPROVED`

**NHƯNG** Manager render verify với fixture realistic (Danny case 30/70 asymmetric) phát hiện:

🔴 **CRITICAL BUG #1** — `contract-racekit.docx` + `contract-operations.docx`:
> "Tổng giá trị Hợp đồng (đã bao gồm 8% VAT): **50.000.000 VND** (Bằng chữ: **Năm mươi tư triệu đồng**)"
>
> Số ≠ chữ → **hợp đồng vô hiệu pháp lý**

Root cause: F-042 đặt `{subtotal}` ở vị trí "đã bao gồm VAT" (semantic phải `{totalAmount}`). F-044 thêm `{totalAmountInWords}` expose latent inconsistency.

### Why automation didn't catch
- `assertDocxContains(['50.000.000'])` không assert "số bên cạnh chữ phải khớp"
- Unit tests dùng symmetric fixture (subtotal ≈ totalAmount) hide bug
- Audit grep hardcoded number/text patterns nhưng KHÔNG check placeholder semantic placement
- Coder Self-Review Step 6 "UI/UX self-inspection" marked N/A vì "no UI" — nhưng DOCX content IS a form of UI inspection
- QC Phase 5 PRD Compliance check BR exists, không cross-check số/chữ pair

### New Manager mandate (cho mọi feature đụng template/DOCX/PDF)

`/5bib-deploy` BLOCK conditions extended:

1. Phải có file `*-manager-render-verify.spec.ts` render mọi template đã đụng với fixture realistic
2. Output `.txt` files phải được Manager eyeball read sentence-by-sentence
3. Mọi cặp "số + Bằng chữ" phải có dedicated unit test verify `vndAmountInWords(X) === <chữ rendered>`
4. Fixture mandatory: asymmetric splits (30/70 hoặc 70/30) + VAT non-zero + 1B+ scale + multi-provider variation

### Severity classification new
- **🔴 LEGAL/FINANCE invalidity** (số ≠ chữ): MUST block deploy + QC re-review
- **🟡 Template hardcoded entity data** (bank account, provider name): track as separate feature (F-045 case), không block hiện tại nhưng phải fix sớm

### Detailed protocol
Xem `conventions.md` section "DOCX Template Content Review Protocol (F-044 lesson)".

### Reference
- F-044 Manager Content Review: `.5bib-workflow/features/FEATURE-044-contract-docx-phase-2-text-hardcoded-fix/MANAGER-CONTENT-REVIEW.md`
- F-044 BUGFIX #1 regression spec: `backend/src/modules/contracts/services/document-generator.service.f044-bugfix1.spec.ts`
- Render verify spec template: `backend/src/modules/contracts/services/f044-manager-render-verify.spec.ts`

---

## F-068 (2026-06-01) Course Data Ops UX

### ✅ RESOLVED by F-068

- **Pre-existing `deleteResultsByCourse(courseId)` cross-race wipe** (Manager catch 2026-05-31 PROD audit `lets-run-2026`) — F-068 BR-68-10 fix `(raceId, courseId)` signature + `deleteMany({raceId, courseId})` filter. Regression TC-68-14 in `race-result.service.spec.ts`.
- **Pre-existing `purgeCache(courseId)` pattern mismatch** (Manager catch 2026-05-31) — F-068 BR-68-11 fix race-namespaced patterns + NEW `athlete:<raceId>:*` + `badge:<raceId>:*` invalidation. Regression TC-68-15 in `race-result.service.spec.ts`.
- **TD-F029-05 admin.service.spec.ts DI setup PARTIAL** — F-068 added TelegramService + MailService mocks. 12/14 PASS now (vs 0/14 before). 2 remaining resolveClaim spec failures still pre-existing unrelated.

### 🟡 Tech Debt logged by F-068

| ID | Severity | Module | Issue | Plan |
|----|----------|--------|-------|------|
| **TD-F068-LEADERBOARD-CACHE-NAMESPACE** 🟡 LOW | race-result.service | `leaderboard:<courseId>` + `time-distribution:<courseId>` + `country-stats:<courseId>` WRITE keys NOT raceId-namespaced (READ methods don't carry raceId — API shape change required to fix). F-068 scope kept legacy single-courseId. | Q3 2026 — REFACTOR controller path to `/leaderboard/:raceId/:courseId` etc. |
| **TD-F068-COURSE-ACTOR-CARRY-FORWARD** 🟡 LOW | admin / audit | All 3 audit actions (`course.apiUrl.cleared`, `course.disabled_and_reset`, `course.data_reset`) log `actor: { userId: 'admin' }` hardcode. Cannot attribute race-day forensics to specific admin. Carry-forward TD-CONTRACTS-ACTOR-001 (F-066/F-067/F-068 all share). | F-069 mandate — extract JWT user from Logto guard, thread `@CurrentUser()` through 3 admin emit + F-066 + F-067 contract emit sites. ~30 min total effort. |
| **TD-F068-CRON-STUCK-DETECT** 🟢 LOW | race-sync.cron + admin | BR-68-15 ">60s log warn if isSyncing continuous" not implemented — stateless endpoint cannot track continuous duration without server-side state (Redis counter or in-memory `Date` tracking). | Defer until ops surfaces concrete need (race-day cron hanging report). |
| **TD-F068-SDK-REGEN-PENDING** 🟡 LOW | admin / api-generated | Hand-typed fetch wrappers in `course-data-ops-api.ts` (Deviation #2). QC declined to run regen without local backend. | **DEPLOY DAY MANDATE** — Manager run `pnpm --filter admin generate:api` against running backend AFTER merge + verify DTO shape parity vs hand-typed. Optional refactor admin code to use generated SDK functions. |
| **TD-F068-PERF-NOT-MEASURED** 🟢 LOW | course-data-ops.service | Cold/warm p95 + reset 10K rows not benchmarked locally (no backend up during QC). | Staging smoke mandate — autocannon 60s GET data-stats (cold + warm) + k6 100 iter POST disable-and-reset 10K rows. |
| **TD-F068-ORPHAN-PERCENTILE** 🟢 LOW | race-result.service.purgeCache | Kept `percentile:*:*` + `percentile:v2:*:*` legacy patterns (orphaned post-F-029) "for housekeeping" — wastes Redis KEYS scan per purge call (typically 0 results). | Q3 2026 housekeeping batch — verify orphan keys truly absent + remove patterns. |
| **TD-F068-LOCK-TOKEN-LITERAL** 🟢 LOW | course-data-ops.service.acquireResetLock | Lock value `'1'` literal. No safe-release Lua script — crash recovery relies on 30s TTL. Single-process backend acceptable. | F-070+ if multi-instance backend deployment introduced. Pattern: UUID lock token + Lua DEL-if-matches script. |
| **TD-F068-CRON-MID-FLIGHT-RACE** 🟢 LOW | course-data-ops.service.disableAndReset | Cron `getRacesWithApiUrls()` may snapshot race.courses BEFORE Step 1 clear apiUrl + write rows AFTER Step 3 deleteMany. Mitigated by 5s `waitForCronIdle`; residual race window. | Acceptable per BR-68-08 timeout-and-continue contract. Documented for future awareness if ops surface "data quay lại sau reset" complaint. |

---

## Q2 Contract Revamp 2026-05-26 (F-064 + F-065 + F-066 + F-067 BUNDLE)

### 🔴 TD-RACE-CONDITION-PARALLEL-AGENTS (HIGH process)

**Symptom:** 3 features (F-064 + F-065 + F-067) lost 00/01/02 docs on branch despite being committed earlier. F-064 Coder fail mid-run lần 1.

**Root cause:** Parallel Coder agents `git checkout` xung đột trên main worktree — agent A checkout branch X, agent B checkout branch Y, agent A's working file deletes overwritten by B's branch state.

**Mitigation (enforced post-Q2):**
1. Manager + Coder MUST use isolated worktree pattern `/private/tmp/5bib-fXXX/` cho parallel feature work
2. Coder pre-flight check: `git ls-tree` instead of `ls` (verify files committed, not just local present)
3. Manager Plan: workflow docs (00/01/02) MUST be committed in first commit C0 BEFORE Coder starts code commits
4. Multiple agents same-repo HEAD race risk = ALWAYS isolate worktree

### 🟡 TD-PIZZIP-STORE-DEFAULT (MED — possible regression)

pizzip default STORE compression có thể affect F-044 + F-064 rendered output size + integrity. F-065 phát hiện + applied DEFLATE manual override. Need verify F-042/F-044/F-045 outputs compression mode.

**Action:** Audit existing DOCX render outputs compression. If STORE → migrate to DEFLATE consistent.

### 🟢 TD-NO-BOLD-VERIFY (LOW — manual QC required)

Audit scripts F-064/F-065/F-067 verify TEXT content but KHÔNG verify visual style preservation (bold/italic/font/color). DOCX XML edit có thể break style accidentally.

**Mitigation:** Danny manual visual diff Word/LibreOffice rendered outputs sample contract sau mỗi F-XXX DOCX edit.

### 🟢 TD-F067-CONCURRENT-REGEN-RACE (LOW — Phase 2 BullMQ)

Concurrent mutations cùng contract → 2 regen jobs spawn → version conflict possible. Phase 1 accept last-write-wins. Phase 2 add BullMQ queue + Redis lock per contractId.

### 🟢 TD-CONTRACTS-ACTOR-001 (carry-forward F-067)

`actorId='admin'` hardcoded across contract mutations. Future F-068 implement proper JWT extraction.

### 🟢 TD-F067-DIFF-CAP-100-ITEMS (LOW)

Line items > 100 → diff truncated. Edge case rare. Accept Phase 1.

### 🟢 TD-F064-HISTORICAL-CONTRACTS (accepted forward-only)

N historical contracts với hardcoded SAI KHÔNG auto re-render (consistent F-061 forward-only). Sales Admin manual re-issue per contract nếu cần.

### 🟡 TD-F064-ATHLETE-COUNT-REGEX-FALSE-POSITIVE (MED — F-068+ improve)

Regex `/\b(athlete|VĐV|runner|BIB|vận động viên)\b/i` có thể match "Banner BIB sponsor" hoặc "Race kit" → over-count. Mitigation: admin override `expectedAthleteCount` explicit field exist. F-068+ audit + improve regex.

### 🟢 TD-F066-MONGO-SPARSE-INDEX (LOW — perf future)

Partner.shortName field cần sparse index `{shortName:1}` future perf. F-068+ defer.

### 🟢 TD-F066-ADMIN-EDIT-SHORTNAME-UI (LOW — F-068 Journey 3)

Admin Partner EDIT form chỉ render "Tạo mới" path. EDIT shortName flow defer F-068+.

### CI Infrastructure Pattern (lesson Q2 Contract Revamp)

**Symptom:** Sequential push 4 release branches `v1.9.7 → v1.9.8 → v1.9.9 → v1.10.0` trong vài phút cause Deploy SSH VPS step race conditions → CI failure pattern (build PASS but deploy fail).

**Mitigation next sequential deploys:**
1. Stagger ≥5 phút giữa 4 releases
2. Hoặc bundle thành 1 release branch single deploy (1 super-release thay vì 4 sub-releases)
3. CI deploy script should ALWAYS update both backend + admin SHA in docker-compose.yml (paths-filter occasionally skip admin nếu commit chỉ touch backend file)
4. Post-deploy verify VPS image SHA vs expected — manual `sed + docker compose pull + up -d` fallback nếu stale

---

## F-071 Merchant i18n (DEPLOYED 2026-06-08) — tech debt

| ID | Module | Debt | Lý do hoãn | Cảnh báo |
|----|--------|------|-----------|----------|
| **TD-F071-GLYPH-UAT** 🟡 publish-gate | merchant i18n | Live browser screenshot render Khmer/Lào (không tofu □) + layout không vỡ — CHƯA chạy. Verify gián tiếp 2 lớp: script-range (chuỗi đúng khối Unicode) + next build (Noto subset load OK). | Shell merchant cần Logto auth → không UAT local; merchant-dev chạy code cũ trước deploy | Sau deploy DEV, Danny/Manager screenshot merchant-dev đổi Khmer/Lào xác nhận render OK trước khi coi feature "live thật". Risk LOW (Noto chuẩn). |
| **TD-F071-TRANSLATION-NATIVE-REVIEW** 🟡 publish-gate (BR-10) | merchant i18n DICT km/lo | Bản dịch Khmer + Lào do Claude tạo = **provisional**. Coverage + script đúng nhưng nghĩa CHƯA native-review. | Danny chốt "Claude dịch, review sau" | Trước khi BTC Campuchia/Lào dùng PROD: native review nghĩa, ưu tiên chuỗi tài chính `kpi_net`/`kpi_fee`/`kpi_gmv`/`target_invalid`/`rev_gate_body`/`unauth_body`. ms (Latin) tin cậy cao hơn. |
| **TD-F071-MONTHSHORT-KM-LO** 🟢 LOW | merchant fmt.ts | `monthShort` km/lo render "M{m}" ASCII thay tên tháng bản địa (tránh vỡ chart axis vì tên Khmer/Lào dài). | Axis-safety ưu tiên | Nếu cần tên tháng bản địa trên axis → cần axis rộng hơn hoặc xoay nhãn. Chấp nhận MVP. |

## F-069/F-071 Merchant — known quirk

| Module | Quirk | Lý do |
|--------|-------|-------|
| `merchant/` eslint | 27 lỗi lint pre-existing (any/set-state-in-effect/`<a>`-link) rải khắp login/dashboard/races/charts từ F-069 | `next build` (gate thật) PASS — lint không trong CI gate merchant. F-071 không thêm category mới. Dọn = feature riêng nếu cần. |
| `merchant` i18n | Mọi nhãn UI qua `t()`/`lab()`; data backend (tên giải/BTC/người mua) render nguyên văn KHÔNG dịch (BR-06) | i18n chỉ UI chrome — đổi nguyên tắc này = sai scope |

## F-072 Participant Insights (DEV 2026-06-08) — tech debt
| ID | Debt | Cảnh báo |
|----|------|----------|
| **TD-F072-LABEL-I18N** 🟢 | gender "Nam/Nữ", "Không rõ", "Khác" backend trả tiếng Việt — non-VN user thấy VN (số liệu+size+AG universal) | BTC thường VN, chấp nhận v1. Map L.gender dict nếu cần |
| **TD-F072-IS-REPRESENT** 🟡 | Đếm mọi athlete_subinfo row join paid oli; CHƯA lọc is_represent (giám hộ) | QC verify trên DEV data: nếu total > tổng vé paid → thêm `AND is_represent=0` |
| **TD-F072-SDK-HANDADD** 🟢 | SDK merchant (sdk.gen/types.gen) hand-add cho participants insights vì DEV backend chậm deploy | Khi generate:api chạy được (DEV backend up) → regen reconcile, xoá block hand-add |

## F-073 Capacity/Quota (DEV 2026-06-08) — tech debt
| ID | Debt | Cảnh báo |
|----|------|----------|
| ~~TD-F073-SOLD-SEMANTICS~~ ✅ **RESOLVED 2026-06-08 (9c3344e)** | (was) sold=quota−remained lệch paid | FIXED: sold=PAID count, đồng bộ by-course. Browser-verified 261/125/66 |
| **TD-F073-DEFAULT-1000** 🟢 | Nhiều ticket_type max_participate=1000 default → pctFilled thấp giả | BTC chưa set quota thật sẽ thấy % thấp. Data thật, không phải bug |
| **TD-F073-SDK-HANDADD** 🟢 | SDK capacity hand-add (DEV backend deploy chậm) | Reconcile khi generate:api chạy được |

## F-074 YoY (DEV 2026-06-08) — tech debt
| ID | Debt | Cảnh báo |
|----|------|----------|
| **TD-F074-180DAY-CAP** 🟢 | Đơn đặt >180 ngày trước đua gộp tại mốc D-180 | Hầu hết giải mở bán <180 ngày. Nâng YOY_MAX_DAYS nếu cần |
| **TD-F074-SDK-HANDADD** 🟢 | SDK yoy hand-add | Reconcile khi generate:api chạy được |
