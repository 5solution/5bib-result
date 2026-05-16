# 5BIB Result — Codebase Map

> **Owner:** 5bib-manager
> **Last updated:** 2026-05-12 — Memory Sync Batch 1 post-ULTRAREVIEW (33 modules synced, F-016→F-028 reflected)
>
> Bản đồ codebase 5bib-result. Đọc TRƯỚC khi đưa ra phán quyết về feature mới.

---

## 🌐 Repo top-level (THỰC TẾ)

```
5bib-result/
├── backend/                    # NestJS 10 backend (port 8081)
├── admin/                      # Next.js 16 admin dashboard (port 3000)
├── frontend/                   # Next.js 16 public frontend (port 3002)
├── content-web/                # (xem riêng — content/article web)
├── crew/                       # (xem riêng — crew app)
├── docs/                       # Documentation
├── scripts/                    # Deploy scripts
├── docker-compose.yml          # Local dev
├── docker-compose.production.yml
├── docker-compose.resource.yaml
├── package.json                # Workspace root
├── pnpm-lock.yaml
├── CLAUDE.md                   # ⭐ Project context (must-read)
├── FRONTEND_QUICKSTART.md
├── PROGRESS_REPORT.md
├── TODO.md
├── prd-*.md                    # PRD files (manual, pre-workflow)
├── research-*.md               # Research docs
└── strategy-5bib-brand-*.md
```

> **Lưu ý:** Đây là project 5bib-result — chỉ là 1 phần của 5Solution ecosystem. Không có `apps/api`, `apps/admin` — 3 service nằm flat ở root.

---

## 🔧 backend/ — NestJS 10 Backend (port 8081)

### Module structure (35 modules verified 2026-05-13 — added: promo-hub + promo-hub-analytics F-027. Prior: awards F-019, medical-incidents F-018, contracts F-024, finance F-028, dashboard F-023, audit F-024, result-kiosk-display F-017, course-map service under races F-006)
```
backend/src/
├── main.ts                     # Bootstrap, port 8081
├── cli.ts                      # CLI entry
├── common/                     # Shared (guards, decorators, filters, etc.)
├── config/                     # Env config
├── migrations/                 # MongoDB migration scripts
├── utils/                      # Helpers
└── modules/
    ├── app.module.ts           # Root module — F-019: + AwardsModule + TypeOrmModule platform DB cho AthleteDobReadonly
    ├── aws.config.ts           # S3 config
    │
    ├── # Auth & Users
    ├── logto-auth/             # ⭐ Logto-based JWT auth (KHÔNG phải custom JWT)
    ├── users/                  # User management
    ├── api-keys/               # API key management
    │
    ├── # Race Domain (core)
    ├── races/                  # Race CRUD, course, checkpoints. ⭐ DTO sync Mongoose schema (CourseCheckpointDto.distanceKm hotfix FEATURE-001 + gpxParsed/gpxSimplifiedUrl/lat/lng FEATURE-006). ⭐ FEATURE-006: CourseMapService GPX/KML parse + Douglas-Peucker simplify + Leaflet integration. 4 endpoints (3 admin + 1 public). Cache: master:course-map: + master:course-map-lock: anti-stampede. ⭐ FEATURE-019: race.schema +5 fields — race-level `awardsCompoundingMode` (v2.1, enum mutually_exclusive default + compounding opt-in), course-level `bracketSource`/`ageGroupPreset`/`ageGroupOverride`/`paceThresholdOverride` (v2). create-race.dto +2 validators. NO migration (Mongoose lazy default).
    ├── race-result/            # Athlete results, split times, ⭐ Result Image Creator v1.0. F-010 added: dnsChipFail boolean field (default false, no migration), PATCH /:id/dns-chip-fail endpoint (LogtoAdminGuard), getPaceAlertThreshold() helper reads TimingAlertConfig (fallback 0.80), MongooseModule.forFeature TimingAlertConfig cross-module DI (read-only access; no circular import — TimingAlertModule does NOT import RaceResultModule).
    ├── race-master-data/       # Master data sync (Redis cache, MySQL fallback). ⭐ FEATURE-019 v2: athlete-readonly.entity +`dob` column (Option B isolation entity riêng, NOT in athlete-subinfo-readonly to preserve BR-03 strict allowlist); race-athlete.schema +`ageOnRaceDay: number | null` (computed value, no DOB raw persist). Cron `EVERY_DAY_AT_MIDNIGHT` lazy populate (TD-F019-V2-AGE-CRON-COVERAGE first run needs manual trigger).
    ├── awards/                 # ⭐ FEATURE-019 NEW MODULE (Race Ops Cluster #9 #2). 11 services + 2 schemas + 7 DTOs + 8 specs. Path A 5BIB independent calc (DOB → ageOnRaceDay) primary + Path B Pattern H VENDOR_MISMATCH cross-check. 7 anomaly patterns A-G + Pattern H. 8-state forward-only state machine + APPEND-ONLY stateHistory[] (reuse F-018 incidentTransitions[] pattern). 5 AG presets (vn_road_default + road_5_year + trail_itra + trail_lite + open_only). 2 compounding modes (mutually_exclusive default VN amateur + compounding WA TR9 opt-in, v2.1). Endpoints: GET/POST/PATCH /admin/races/:id/awards/* + ag-podium + ag-eligibility + recompute + state-update + pdf-export. PDF reuse @napi-rs/canvas pattern F-013. Cache: awards:race:* + awards:lock:* + awards:state-lock:* + awards:eligibility:*. S3 prefix awards-pdf/ Lifecycle Rule 5 NO expiration (legal trail).
    ├── timing/                 # Timing system (vendor RR poll)
    ├── timing-alert/           # ⭐ FEATURE-001+002+010: simulator + scenarios + checkpoint discovery + miss detector + reset/poll. F-002 added: NestJS exception classes for reset, deriveScalarsFromTimes post-scenario consistency, contest backfill from course.name when vendor RR null. F-010 added: TimingAlertConfig +4 fields (course_type ROAD/TRAIL/ULTRA enum + pace_buffer + pace_alert_threshold + confidence_multiplier; all OPTIONAL with defaults), detection_type enum extend `'CUTOFF_RISK'` ADDITIVE, miss-detector signature `detect(options.{paceBuffer,lastPollAt,totalRegistered,confidenceMultiplier})` + CUTOFF_RISK detection + OBS-1 wall-clock + OBS-2 MIDDLE_GAP severity escalation INFO→WARNING→HIGH→CRITICAL, projected-rank percentage-based confidence formula (totalRegistered × multiplier with totalRegistered=0 fallback to 50), poll service CUTOFF_RISK auto-resolve dual-trigger (next CP time OR Finish chiptime) + getTotalRegistered() helper, dashboard-snapshot computeDnsBreakdown() 3-state derivation (DNS_CHIP_FAIL / DNS_NOT_PICKED / DNS_NO_START) at query time. Redis: master:discover-lock + discover-preview cache
    ├── certificates/           # Certificate generation
    │
    ├── # Athletes
    ├── athlete-stars/          # Featured athletes
    ├── chip-verification/      # ⭐ TTS chip verify (PRD: prd-chip-verify-tts-read-name.md)
    │
    ├── # Merchant / Admin
    ├── admin/                  # Admin-specific endpoints
    ├── merchant/               # Merchant management
    ├── reconciliation/         # Đối soát
    ├── notification/           # Notifications
    │
    ├── # Public-facing
    ├── homepage/               # 5bib.com homepage. ⚠ FEATURE-029 finding HIGH-RBAC ambiguity (0 @ApiResponse + 0 @Public marker — verify intended public)
    ├── articles/               # Articles (news.5bib.com, hotro.5bib.com). Sanitize-html backend + dangerouslySetInnerHTML frontend SAFE.
    ├── search/                 # Search. ⚠ same RBAC ambiguity homepage
    ├── sponsors/               # Sponsor CRUD (silver/gold/diamond). 0 unit tests (HIGH ultrareview).
    ├── sponsored/              # Sponsored content. find-then-save 4 callsites + sponsored-slot.schema 24 props 0 index.
    │
    ├── # Operations & Analytics
    ├── dashboard/              # ⭐ FEATURE-023 NEW: Admin Dashboard Redesign — homepage stats, recent-activity, KPIs (`dashboard.service.ts`). TD-F023-* tracked. N+1 fix `a7346d2` pipeline 2N+N→2 RTT.
    ├── analytics/              # ⭐ FEATURE-026: Admin Analytics Redesign — revenue trend chart, repeat customer, period compare. TD-F026-REPEAT-TREND-FORMULA fixed (SQL subquery thật). TD-F026-CACHE-INVALIDATE pre-existing.
    ├── audit/                  # ⭐ FEATURE-024 NEW: Audit log service (Optional inject pattern). Used by contracts, dashboard recent-activity, articles. ⚠ MED-AUDIT-01 gap: sponsored/sponsors/race-settings/awards mutations chưa emit audit log.
    ├── event-tracking/         # Event tracking. Throttle 100/sec ✅.
    ├── bug-reports/            # Bug reports. LogtoAdminGuard + ThrottlerGuard ✅. find-then-save 3 sites.
    ├── team-management/        # Team management — biggest module (17 controllers + ~6000 LOC service). ⚠ 0 unit tests (HIGH ultrareview). Magic token crypto.randomBytes(16) 128-bit OK. No rate-limit per IP on :token/* endpoints (HIGH-RL-01).
    │
    ├── # Medical & Awards (F-018/F-019 cluster)
    ├── medical-incidents/      # ⭐ FEATURE-018 NEW: Medical Incident Tracker. 10 endpoints LogtoStaffGuard. State machine TRIAGED→TRANSPORTED→RESOLVED + severity 1-5. Redis `medical:race:<raceId>:active-count` 60s + `medical:incident-lock:<incidentId>` SETNX 5s. S3 lifecycle rule 4 (7y legal). EXIF strip + MIME allowlist + 10MB cap. PII anonymization cron strip athleteName/bib/description sau 7y.
    ├── awards/                 # ⭐ FEATURE-019 NEW: AG Podium + Anomaly. 11 services + 2 schemas + 7 DTOs + 8 specs. Path A (5BIB DOB→ageOnRaceDay primary) + Path B (Pattern H vendor cross-check). 7 anomaly A-G + Pattern H. 8-state forward-only state machine. 5 AG presets. 2 compounding modes. Redis `awards:race:*` + `awards:lock:*` + `awards:state-lock:*` + `awards:eligibility:*`. S3 `awards-pdf/` Lifecycle Rule 5 NO expire. ⚠ HIGH-AW-01 TD-F019-MULTITENANT pre-existing (no per-race tenant guard).
    │
    ├── # Contract & Finance (F-024/F-028 cluster)
    ├── contracts/              # ⭐ FEATURE-024 NEW MODULE biggest sau team-management. Controllers: contracts + partners + service-catalog + contract-templates + lifecycle-events. Schemas: contract (with linkedTenantId/linkedMysqlRaceId sparse-indexed F-028 ref, LineItem.catalogItemId F-028 ref), partner, service-catalog, contract-template, contract-lifecycle-event. DOCX gen docxtemplater+pizzip+libreoffice-convert PDF. RBAC Logto 3 permissions (all/admin/staff) + LogtoStaffGuard. Cross-DB MySQL Tenant/Race picker. ⚠ HIGH-CON-01 find-then-save 11 callsites (worst offender). ⚠ HIGH-CON-02 @Req() req: any 6+ endpoints (CurrentUser decorator có sẵn). ⚠ HIGH-CON-03 no page-level RBAC gate /contracts/*. S3 lifecycle rule 6 (5y retention Luật quản lý thuế 38/2019).
    ├── finance/                # ⭐ FEATURE-028 NEW MODULE: Deal P&L Tracking 3 phases. Services: pnl.service (compute per contract + **F-038 getContractsList() paginated list** reuse compute path) + cost-items.service (CRUD COGS, **F-038 flush dual-pattern**) + fee.service (cross-DB MySQL F-016 pattern via order_metadata→order_line_item→ticket_type→race_course JOIN — KHÔNG `o.tenant_id` col not exists) + pnl-dashboard.service (aggregated BR-PNL-08 strict whitelist ACTIVE+COMPLETED) + pnl-excel.service. Controllers: pnl + pnl-export + pnl-dashboard + **pnl-contracts-list (F-038 NEW `@Controller('finance/pnl')` `@Get('/contracts')` URL `/api/finance/pnl/contracts`)** + cost-items + cost-suggestions + mysql-lookup. DTOs: pnl-* + dashboard-* + **pnl-contracts-list-filter (F-038 NEW extends PnLDashboardFilterDto +page/limit/sortBy/sortDir/q)** + **pnl-contracts-list-response (F-038 NEW reuses DashboardContractItemDto[] + DashboardTotalsDto)**. Redis `pnl:contract:<id>` + `pnl:dashboard:<...>` + **`pnl:contracts-list:<sha256-16char>` TTL 60s (F-038 NEW — invalidated dual-pattern via cost-items + contracts flush helpers iterating BOTH patterns in series)**. ⚠ HIGH-PERF-01 N+1 MySQL pnl.service:336-340 (F-029 resolved bulk). ⚠ HIGH-PERF-02 Excel in-memory >500 OOM.
    │
    ├── # Promo Hub (F-027 cluster — independent, ZERO cross-module DI)
    ├── promo-hub/              # ⭐ FEATURE-027 NEW: Configurable Landing Page main module. 1 schema (`promo-hubs` w/ sections subdoc array 19 type enum: hero, race_calendar, featured_races, promo_banner, cta_buttons, sponsors, stats, rich_text, recent_results, link_grid, social_links, faq, countdown, video_embed, image_gallery, testimonial, map_embed, schedule_timeline, form_embed) + 5 DTOs + service + controller + 2 spec files (5 controller TC + 17 service TC). 7 endpoints: list, create, findById, findBySlug (PUBLIC, rate-limit by IP), update, reorderSections, delete. ANTI-STAMPEDE SETNX lock pattern port từ F-004 RaceMasterDataService (`promo-hub-lock:<slug>` TTL 5s + retry 3×200ms). sanitize-html backend strip <script>/event handlers/javascript: URIs trên rich_text + customCss write path. RBAC LogtoAdminGuard cho admin endpoints. Section-as-subdoc array pattern (read-heavy, atomic save).
    ├── promo-hub-analytics/    # ⭐ FEATURE-027 NEW: Analytics events separate module. 2 schemas (`promo_hub_clicks` + `promo_hub_views` w/ TTL `expireAfterSeconds: 7776000` 90d auto-delete) + 3 DTOs + service + controller + 1 spec (6 TC). 3 endpoints: track-click (public, ThrottlerGuard), track-view (public + Redis SETNX rate-limit `promo-hub-view-rl:<slug>:<ipHash>` TTL 5min), summary (admin). IP SHA-256 hash GDPR-compat (`hashIp()` no salt — 1-way enough for unique-IP counting). Aggregation: viewsByDay/clicksByDay/topSections/topLabels last 30d. ZERO cross-module Nest DI from existing — sections fetch races/sponsors/results trực tiếp tại frontend SSR layer.
    │
    └── upload/                 # AWS S3 file uploads. ⚠ CRIT-03 ZERO validation (Danny defer 2026-05-12 — dev có lý do, có WAF/CloudFront cover). dùng `file.originalname` raw + ContentType from client header (XSS risk via S3 URL).
```

### File then chốt (đọc trước khi code các vùng dưới)
- `backend/src/modules/race-result/services/result-image.service.ts` — ⭐ canvas-based image gen (1080×1350)
- `backend/src/modules/races/` — race lifecycle (`draft → pre_race → live → ended`)
- `backend/src/modules/races/dto/add-course.dto.ts` — ⭐ `AddCourseDto` + `CourseCheckpointDto`. PHẢI sync field set với Mongoose Course subschema (NestJS whitelist strict). FEATURE-001 hotfix thêm `distanceKm`. FEATURE-006 thêm `gpxParsed` + `gpxSimplifiedUrl` + `lat`/`lng`. UpdateCourseDto inherits via PartialType.
- `backend/src/modules/races/services/course-map.service.ts` — ⭐ FEATURE-006: GPX/KML parse + Douglas-Peucker simplify + S3 upload + fuzzy match waypoint↔checkpoint 3 levels strict + cache với SETNX anti-stampede
- `backend/src/modules/races/services/course-map.service.spec.ts` — 23 unit tests (parseGpx 9 + matchWaypoints 5 false-positive guard + S3 2 + cache 5 + invalidate 2)
- `backend/src/modules/races/services/course-map.adversarial.spec.ts` — ⭐ FEATURE-006 QC artifact: 18 adversarial tests (malformed XML, NaN/Infinity coords, empty waypoint, unicode path traversal, corrupt cached JSON, public response leak)
- `admin/src/app/(dashboard)/layout.tsx` — ⭐ FEATURE-011: ADD `data-admin-sidebar` attribute on `<aside>` (line 251) + `data-admin-topbar` attribute on `<header>` (line 273) — additive only, ZERO class change, ZERO markup restructure (BR-AF-23 byte-for-byte preserve honored cho shared admin layout used by ALL admin routes). Consumed by `globals.css` `body[data-fullscreen]` extension to hide admin shell when fullscreen toggled (BR-PB-01). Other admin routes unaffected (they don't toggle `body[data-fullscreen]`).
- `admin/src/app/globals.css` — ⭐ FEATURE-011: EXTEND `body[data-fullscreen]` block additive — `body[data-fullscreen] [data-admin-sidebar], [data-admin-topbar] { display:none !important }` (BR-PB-02). `!important` justified per F-008 v2 BR-CC2-09 precedent (overrides Tailwind `lg:flex` on `<aside>`). Existing `[data-race-ops-shell-header]` translateY rule preserved verbatim. Fullscreen scope NOW dual-layer (admin shell + race-ops shell both hide).
- `admin/src/app/(dashboard)/races/[id]/layout.tsx` — ⭐ FEATURE-007: 8-tab race-ops shell wrapper (sticky RaceOpsHeader + main content area). 'use client' (browser-only SDK pipeline; future SSR migration TD-F007-05).
- `admin/src/app/(dashboard)/races/[id]/page.tsx` — ⭐ FEATURE-007: REWROTE from 1678-line legacy editor → 222-line Overview render at root (PAUSE-MGR-01, no redirect flash).
- `admin/src/app/(dashboard)/races/[id]/settings/page.tsx` — ⭐ FEATURE-007: 1678-line legacy editor MOVED VERBATIM (BR-AF-23 byte-for-byte preservation, single relative-import fix only). FEATURE-010: ADD `<TimingDetectionConfigSection />` ABOVE legacy editor (3rd link card slot after F-008 v2 SettingsLinkCardsSection + F-009 CourseMapFullpageLinkCard); legacy markup byte-for-byte preserved. FEATURE-012 ZERO touch (settings parent BR-AF-23 preserve mandate honored).
- `admin/src/app/(dashboard)/races/[id]/settings/components/timing-presets.constant.ts` — ⭐ FEATURE-012 NEW shared module (56 LOC): single source of truth `TIMING_PRESETS: Record<CourseType, TimingPreset>` + `PRESET_LABELS_VI` + `CourseType` literal union (`'ROAD' | 'TRAIL' | 'ULTRA'`). Imported by both `TimingDetectionConfigSection.tsx` form + `TimingPresetComparisonTable.tsx` display table → single source of truth prevents cross-component data drift (root-cause resolution of QC Round 1 BLOCKER #2 + closes TD-F012-02 P2). Values verbatim PRD BR-FH-06: ROAD `1.10/0.80/30/0.20`, TRAIL `1.35/0.45/60/0.15`, ULTRA `1.50/0.40/120/0.10`.
- `admin/src/app/(dashboard)/races/[id]/settings/components/TimingDetectionConfigSection.tsx` — ⭐ FEATURE-010 NEW + FEATURE-012 MODIFY (363 → 349 LOC, -14 net): 'use client' preset selector (Road/Trail/Ultra) + 4 number inputs + react-hook-form. F-012 DEDUPED inline `TIMING_PRESETS` constants → import from shared `./timing-presets.constant` module + wired 4 tooltip triggers (BR-FH-01..04 next to each `<Input>`) + comparison table block + rationale panel block. F-010 form behavior preserved BYTE-FOR-BYTE: `applyPreset()`, `updateField()`, `handleSave()`, `validateRange()`, save mutation `timingAlertAdminControllerUpsertConfig`, 4 `<Input>` IDs/onChange — all UNCHANGED. Call site `:120 const values = TIMING_PRESETS[preset]` byte-identical (only source moved to shared module).
- `admin/src/app/(dashboard)/races/[id]/settings/components/TimingFormulaTooltipContent.tsx` — ⭐ FEATURE-012 NEW (132 LOC): Surface 1 — 4 inline tooltips (BR-FH-01 paceBuffer formula `pace_threshold = expected_pace × pace_buffer` + BR-FH-02 paceAlertThreshold formula `pace_drop_ratio = current_split_pace / previous_split_pace; flag IF ratio < threshold` + BR-FH-03 overdueMinutes formula 3-derivation + BR-FH-04 confidence multiplier formula + ROAD 0.20/1000 athletes example per task spec). Custom click-to-toggle popover (no shadcn Tooltip in repo per PAUSE-FH-01) + 3-layer content (formula `<code>` + VN explanation + 1 example) + a11y triple (aria-expanded `:80-95` + Escape keydown listener `:105` + outside-click). VN microcopy 100% — English confined to math identifiers in `<code>` per BR-FH-08 acceptable.
- `admin/src/app/(dashboard)/races/[id]/settings/components/TimingPresetComparisonTable.tsx` — ⭐ FEATURE-012 NEW (191 LOC): Surface 2 — toggleable preset comparison table 4 rows (paceBuffer / paceAlertThreshold / overdueMinutes / confidenceMultiplier) × 3 cols (ROAD / TRAIL / ULTRA) + 2 footer rows + current preset column accent ring (BR-FH-06). Imports values from shared `./timing-presets.constant` module (zero drift with form). Legend footnote `:178-185` carries "Danny chốt" provenance + citation "Nguồn giá trị: F-010 expert review consolidated (Race Operation Expert + Sports Domain Expert)" verbatim PRD.
- `admin/src/app/(dashboard)/races/[id]/settings/components/TimingPresetRationalePanel.tsx` — ⭐ FEATURE-012 NEW (107 LOC): Surface 3 — "Tại sao preset này?" expandable panel rendering ALL 3 paragraphs (ROAD/TRAIL/ULTRA) when open via `PRESET_ORDER.map(...)` unconditional iteration `:63` (BR-FH-07). Current preset highlighted via `border-l-4 border-amber-500 bg-amber-50/70` accent `:70` + `(đang chọn)` annotation `:84 ml-1.5 text-[10px] text-amber-700`. Trigger ALWAYS visible (no `null` short-circuit, no early return) `:50`. Citation footer verbatim PRD `:99-102 "Nguồn: Race Ops Expert + Sports Domain Expert F-010 advisory (2026-05-07)"`. Icons per PRD UI mockup `:25-29 🛣️ ROAD / 🥾 TRAIL / 🏔️ ULTRA`.
- `admin/src/app/(dashboard)/races/[id]/command-center/components/DnsBreakdownCard.tsx` — ⭐ FEATURE-010 NEW: DNS sub-state breakdown display (3-state visual: DNS_CHIP_FAIL / DNS_NOT_PICKED / DNS_NO_START), rendered between SummaryCardsRow and lg:grid-cols-5 grid in CommandCenterLayout (additive only; F-011 merge-safe).
- `admin/src/components/race-results/DnsChipFailToggle.tsx` — ⭐ FEATURE-010 NEW: 'use client' inline mutation button for DNS chip fail flag with optimistic update.
- `admin/src/app/(dashboard)/races/[id]/command-center/components/AlertsListView.tsx` — FEATURE-010 ADDITIVE: `case 'CUTOFF_RISK'` block + amber badge + filter option (BR-AF-23 verbatim port preservation; line count parity preserved).
- `admin/src/app/(dashboard)/races/[id]/{overview,readiness,athletes}/page.tsx` — ⭐ FEATURE-007: 3 placeholder tab pages remaining (Overview/Readiness/Athletes — F-014). FEATURE-008 v2 replaced command-center + awards. FEATURE-009 replaced course-map. **FEATURE-013 replaced result-kiosk** (see entry below).
- `admin/src/app/(dashboard)/races/[id]/result-kiosk/` — ⭐ **FEATURE-013 FULL implementation** (replaces F-007 placeholder; Race Ops Cluster #8 first feature):
  - `page.tsx` — REPLACE F-007 PlaceholderPage stub → KioskTabBody orchestrator (admin shell surface 1 + KioskModeProvider state machine + race-title fetch + status-aware empty state for `draft` race per BR-RK-07)
  - `components/` (8): `KioskModeProvider.tsx` Context state machine `{ mode, bib, result, soundEnabled, idleSeconds, ... }` + 4 hook composition + pure transitions; `BibNumberPad.tsx` 4×3 touchscreen pad ≥80×80px + bluetooth-keyboard fallback (BR-RK-01); `KioskResultCard.tsx` 5-status renderer (FIN/DNS/DNF/DSQ/LIVE) + **BR-AF-23 verbatim port** of `parseSplitsFromData` byte-for-byte from `frontend/app/(main)/races/[slug]/[bib]/page.tsx::178-256` (drift = drop unused `CheckpointConfig` arg + `services` field) + DSQ HTML strip via `/<[^>]*>/g` + aria-live polite (BR-RK-03/04/05/08); `KioskIdleOverlay.tsx` last-10s countdown overlay (BR-RK-06); `KioskExitButton.tsx` magenta-bordered "Thoát Kiosk"; `KioskTabBody.tsx` Surface 1 admin shell + status-aware empty + "Bật chế độ Kiosk" CTA single-gesture activation; `KioskBibInputScreen.tsx` Surface 2; `KioskResultScreen.tsx` Surface 3 wrapper + idle integration + 5s not-found auto-reset
  - `hooks/` (4): `useKioskFullscreen.ts` toggles `body[data-fullscreen="true"]` attr + Escape + native Fullscreen best-effort (user-gesture); `useKioskIdle.ts` 60s timer + last-10s countdown + activity reset; `useKioskSound.ts` Web Audio beep success 800Hz/error 300Hz×2 + localStorage `5bib:kiosk-sound` boolean-only persist + lazy AudioContext under user gesture; `useResultLookup.ts` TanStack mutation + `isAthleteDetailResponse` runtime guard + outcome discriminated union (BR-RK-09 + BR-RK-11)
  - root modules (3): `kiosk.constant.ts` single source of truth (BIB_MAX_LEN=6, IDLE_MS=60000, IDLE_COUNTDOWN_MS=10000, NOT_FOUND_AUTO_RESET_MS=5000, beep specs, ≥60×60 ≥80×80 sizes); `kiosk.microcopy.ts` scope-local Vietnamese strings (Phase 1 PAUSE-RK-09 default; F-013 OWNS, NOT shared — minted as new pattern alternative to non-existent shared `vn-microcopy.ts`); `kiosk.types.ts` `AthleteDetailEnvelope`/`AthleteDetailData` interfaces built from OBSERVED `backend/src/modules/race-result/race-result.controller.ts:139-155` shape + `isAthleteDetailResponse(x): x is AthleteDetailEnvelope` runtime guard (BR-RK-11) + `deriveKioskStatus(data): 'FIN'|'DNS'|'DNF'|'DSQ'|'LIVE'|null` + `FORBIDDEN_INTERNAL_KEYS`
  - `__tests__/` (6): `kiosk.types.spec.ts` **20/20 PASS executed** (`isAthleteDetailResponse` 13 cases + `deriveKioskStatus` 7 cases — most security-critical rule); `useKioskIdle.spec.ts` (6 cases) + `useKioskSound.spec.ts` (7 cases) + `BibNumberPad.spec.tsx` (9 cases) + `KioskResultCard.spec.tsx` (6 cases incl DSQ NEVER internal note assertion BR-RK-05) + `KioskIdleOverlay.spec.tsx` (5 cases) — **DEFERRED** via Manager STOP #5 (NO npm install — admin lacks `@testing-library/react`+jsdom+@types/jest+ts-jest); 1-line `testRegex` flip in `jest.kiosk.config.cjs` activates all 33 (TD-F013-TESTSTACK)
  - **DSQ privacy double defense (BR-RK-05):** server strips `_id`/`editHistory`/`isManuallyEdited` (controller line 148) + client KioskResultCard reads only public allowlist `bib/name/distance/dsqReason` (HTML-stripped via regex, never `dsqInternalNote`)
  - **Reuse `getAthleteDetail` endpoint** (BR-RK-09); F-013 is consume-only — ZERO backend modify, ZERO new endpoint, ZERO SDK regen, ZERO new Redis key
  - Brand audit: 4 files use magenta `#FF0E65` (BibNumberPad/KioskResultScreen/KioskExitButton/KioskTabBody); ZERO `#1D49FF` legacy
- `admin/jest.kiosk.config.cjs` — ⭐ FEATURE-013 helper config (NOT in scope-lock count): minimal Jest config running `kiosk.types.spec.ts` via `backend/node_modules/.bin/jest` + ts-jest path-reuse (NO npm install needed in admin); 1-line `testRegex` flip activates 33 deferred tests when admin gains RTL stack
- `admin/src/app/globals.css` — FEATURE-013 EXTEND: APPEND +8 LOC `body[data-fullscreen="true"] { overflow:hidden; height:100vh }` containment rule (NEW reusable fullscreen primitive — F-011 race-ops shell will adopt later; pre-existing F-008v2 + F-011 `body[data-fullscreen]` rules untouched; ≤20 LOC mandate honored). Rule scoped to truthy attribute value, complements existing rules without overriding.
- `admin/src/app/(dashboard)/races/[id]/course-map/` — ⭐ FEATURE-009 FULL implementation (replaces F-007 placeholder):
  - `page.tsx` — Server Component shell, reads `searchParams.course`
  - `components/CourseMapLayout.tsx` — Client orchestrator wiring 6 sections
  - `components/CourseDistancePicker.tsx` — Client pills + 4-state status badge (✅ ⚠ ❌ 🔴) + URL query param sync
  - `components/CourseMapFullView.tsx` — Client **VERBATIM PORT** `CourseMapTabInner.tsx` 466 lines (BR-AF-23 7th port, 23 lines diff names-only)
  - `components/GpxUploadSection.tsx` — Client upload UI port from CourseDialog Map tab
  - `components/CheckpointConfigGrid.tsx` — Client checkpoints grid + Distance field READ-ONLY (preserve F-008 v2 Health Matrix dependency)
  - `components/ManualDragModeButton.tsx` — Client toggle + lightweight 3s toast (drag = reversible)
  - `components/AimsItraDisclaimerBanner.tsx` — Client AIMS/ITRA disclaimer + 7-day localStorage dismiss
  - `components/CourseMapFullpageLinkCard.tsx` — Client link card consumed by Settings tab
- `admin/src/app/(dashboard)/races/[id]/command-center/` — ⭐ FEATURE-008 v2 FULL implementation:
  - `page.tsx` — reads `?view` query param, conditional drill-in render via CommandCenterLayout
  - `components/CommandCenterLayout.tsx` — orchestrator: 7-section dashboard default + AlertsListView drill-in + SSE hook mount + RaceStatusPill render. ⭐ FEATURE-011: ADD `raceStatus={raceStatus}` prop pass-through to `<AthleteFlowChart>` at line 301 (BR-PB additive 1-line); F-010 DnsBreakdownCard import (line 49) + render block (lines 286-293) PRESERVED verbatim.
  - `components/AthleteFlowChart.tsx` (lives under `timing-alerts/components/command-center/`, consumed here) — ⭐ FEATURE-011: optional `raceStatus?: RaceStatus` prop (literal union) + pre-race guard ABOVE existing 3-tier empty-state ladder ("⏱ Race chưa khởi động — chờ start gun" neutral grey card when `raceStatus ∈ ['draft','pre_race']`) + ghost dashed track full-width fallback (`width: expPct > 0 ? '${expPct}%' : '100%'`) + right column flex-col vertical stacking + expected-label `~{expectedCount}` right-pin when `expPct < 5`. F-005 health() calc preserved verbatim (lines 144-145 after pre-race guard insertion above): `c >= e * 0.9 ? 'good' : c >= e * 0.7 ? 'warn' : 'fail'`. Backward-compat: `undefined` raceStatus → guard does NOT fire → fallback to existing empty-state ladder (BR-PB-03).
  - `page.tsx` — ⭐ FEATURE-011: PageHero `meta` ternary updated to "Race Command Center" canonical brand term (live: "RACE LIVE — Race Command Center"). VN microcopy 100% mandate honored (BR-PB-08); grep `cockpit` → 0 results in command-center/.
  - `components/CommandCenterTopBar.tsx` — 8 elements (Last sync + Poll + Force Refresh + Export CSV + Sound + Reset + Fullscreen + Discovery)
  - `components/AlertsListView.tsx` — F-005 AlertsTab verbatim port (491 lines, single import-fix per BR-AF-23)
  - `components/AlertDetailDialogWrapper.tsx` + `CheckpointDiscoveryDialogWrapper.tsx` — verbatim re-export wrappers
  - `components/CommandCenterFullscreenButton.tsx` — `'use client'` toggle + Esc keydown listener cleanup
  - `components/SoundToggleButton.tsx` — `'use client'` localStorage persist + 880Hz audio bridge
  - `components/ResetConfirmModal.tsx` — `'use client'` 2-step typing race name modal (BR-CC2-14)
  - `components/RaceStatusPill.tsx` — Server Component status badge inline body (distinct from RaceLiveTimer clock)
  - `components/SettingsLinkCardsSection.tsx` — Server Component 2 link cards consumed by settings tab
  - `components/{ThroughputSparkline,DnsCounterCard,CheckpointHealthMatrix}.tsx` — F-008 v1 inherit unchanged
- `admin/src/app/(dashboard)/races/[id]/awards/` — ⭐ **FEATURE-019 FULL implementation** (replaces F-008v2 placeholder; Race Ops Cluster #9 #2):
  - `page.tsx` — Orchestrator (replace F-008v2 PodiumTab port). Composes: BracketSourceBanner (v2) + CompoundingModeSelector (v2.1) + AGPresetPicker + AnomalyWarningsBanner + AGPodiumGrid + AnomalyInbox + PredictedRankList + PodiumPdfExportButton + PodiumStateMachineControls
  - `components/` (15): AGPodiumGrid + AGPodiumCard + AGPresetPicker + AnomalyInbox + AnomalyWarningRow + AnomalyWarningsBanner + BracketSourceBanner (v2) + **CompoundingModeSelector** (v2.1 NEW radio 2 modes + tooltip + warn + PATCH optimistic rollback) + ConfidenceScore + FilterBar + PodiumPdfExportButton + PodiumStateMachineControls + PredictedRankInline + PredictedRankList + StateBadge + StateMachineTimeline
  - `hooks/` (6): useAgPodium + useAnomalyWarnings + usePodiumPdfExport + usePodiumStateMachine + usePredictedRank + useRecompute (TanStack Query)
  - root modules: awards-api.ts (SDK wrappers) + awards.constant.ts (5 presets + thresholds) + awards.microcopy.ts (VN labels) + awards.types.ts + awards.types.spec.ts (runtime guards)
  - `__tests__/` (4): AGPodiumCard + AGPresetPicker + AnomalyInbox + useAnomalyWarnings RTL specs (deferred TD-F019-RTL-DEFERRED, activate khi unblock TD-F013-TESTSTACK)
- `admin/src/app/(dashboard)/races/[id]/readiness/` — ⭐ FEATURE-019 v2 EXTEND: `components/AGEligibilityCard.tsx` (NEW pre-race DOB readiness card) + `hooks/useAgEligibility.ts` (NEW). `page.tsx` MODIFY mount AGEligibilityCard. Surface DOB coverage % + missing BIBs drilldown để admin pre-race flag BTC nhập bù qua import CSV (Option C fallback).
- `admin/src/lib/use-timing-alert-sse.ts` — ⭐ FEATURE-008 v2: SSE listener body-scoped hook, debounce 1500ms invalidate, reconnect on error
- `admin/src/lib/sound-alarm.ts` — ⭐ FEATURE-008 v2: 880Hz Web Audio API helper extracted from F-005 inline page.tsx
- `admin/src/components/race-ops-shell/` — ⭐ FEATURE-007: 6 NEW shared shell components:
  - `RaceOpsHeader.tsx` — sticky header composition (Server-friendly)
  - `RaceLiveTimer.tsx` — 'use client' setInterval 1Hz, 4 race states matrix (BR-AF-07), pure-exported `computeTimerDisplay()` for unit testability (14/14 adversarial PASS)
  - `RaceTabsNav.tsx` — 'use client' usePathname active state (BR-AF-04 disabled matrix + BR-AF-17 dot rule + BR-AF-18 fail badge folded inline)
  - `PageHero.tsx` — 3 variants (pink / red-live / white) per BR-AF-11
  - `Breadcrumb.tsx` — chevron + truncate >40 chars per BR-AF-19, hidden < 640px sm: per BR-AF-20
  - `PlaceholderPage.tsx` — F-XXX badge + ETA + description (replaces TabBadge slot, Coder pragmatic addition)
- `admin/src/middleware.ts` — ⭐ FEATURE-007 + FEATURE-008 v2: 301 redirect 30-day window — `/races/:id/timing-alerts/cockpit` → `/races/:id/command-center` (F-007) + `/timing-alerts/alerts` → `/command-center?view=alerts` + `/timing-alerts/podium` → `/awards` (F-008 v2 BR-CC2-32). NOTE: app has NO `basePath`, canonical URLs are `/races/[id]/...` not `/admin/races/[id]/...`.
- `admin/src/components/race-ops-shell/RaceTabsNav.tsx` — ⭐ FEATURE-008 v2 PARTIAL UNLOCK: 8→9 tabs (insert Awards slot 6 between Result Kiosk + Athletes, `enabledIn:["live","ended"]`)
- `admin/src/components/race-ops-shell/RaceOpsHeader.tsx` — ⭐ FEATURE-008 v2 PARTIAL UNLOCK: add `data-race-ops-shell-header` attribute for fullscreen CSS selector (BR-CC2-34)
- `backend/src/modules/timing-alert/services/checkpoint-discovery.service.ts` — ⭐ FEATURE-001: schema-from-1-athlete + Redis lock + preview cache
- `backend/src/modules/timing-alert/services/simulator.service.ts` — ⭐ FEATURE-001: filter Chiptimes/Guntimes giữ keys với value=""
- `backend/src/modules/timing-alert/services/scenario-engine.ts` — ⭐ FEATURE-001: scenarios drop set value="" symmetric
- `backend/src/modules/reconciliation/services/period-label.helper.ts` — ⭐ FEATURE-003: DRY render kỳ + filename segment cho DOCX/XLSX/batch-export (single vs multi-month)
- `backend/src/modules/reconciliation/services/reconciliation-calc.service.ts` — ⭐ FEATURE-030: `buildLineItems()` dedup `add_on_price` + `discount_amount` by `_seenOrderIds` Set (order-level fields). `gross_revenue` logic UNCHANGED — F-030 visual fix only
- `backend/src/modules/reconciliation/services/xlsx.service.ts` — ⭐ FEATURE-030: Section 3 render `li.add_on_price` col 6 + col 4/5 '—' indicator + bottom Tổng include
- `backend/src/modules/reconciliation/services/docx.service.ts` — ⭐ FEATURE-030: Import `env` từ `src/config`, BÊN B info từ `env.provider.*` (8 fields, fail-soft `.default()`), conditional bottom row "Vật phẩm bổ sung" trong Section 3 khi `totalAddOnPrice > 0`
- `backend/src/config/index.ts` — ⭐ FEATURE-030: `env.provider` namespace 8 fields (companyName, address, taxCode, phone, representativeName, representativeTitle, bankAccount, bankName). Pattern reuse cho future business legal config
- `backend/src/common/validators/period.validator.ts` — ⭐ FEATURE-003: 3 custom decorator (`@IsPeriodString`, `@IsPeriodBoundaryDate`, `@IsValidPeriodRange`) — pattern reusable cho domain khác có period concept
- `backend/src/modules/logto-auth/` — auth (Logto, KHÔNG phải tự build)
- `backend/src/modules/articles/` — cache invalidation pattern phức tạp (xem Redis Keys Registry)
- `backend/assets/fonts/` — Inter + Be Vietnam Pro TTFs cho image generation
- `backend/assets/logo_5BIB_white.png`

### reconciliation/ module structure (post FEATURE-003)
```
backend/src/modules/reconciliation/
├── reconciliation.controller.ts        # 4 endpoint chính + audit + preflight/range
├── reconciliation.service.ts            # CRUD + batchCreate + auditPeriodBoundary (BR-10)
├── schemas/reconciliation.schema.ts     # status enum (KHÔNG có 'cancelled') + compound index 4-field
├── services/
│   ├── reconciliation-preflight.service.ts  # run() single-month + runRange() multi-month + overlap (BR-11)
│   ├── reconciliation.cron.ts               # monthly cron (BR-09 không đụng)
│   ├── docx.service.ts / xlsx.service.ts    # render kỳ qua period-label.helper
│   └── period-label.helper.ts               # ⭐ shared helper FEATURE-003
├── export/batch-export.service.ts       # filename qua filenamePeriodSegment (BR-12)
└── dto/
    ├── batch-create-reconciliation.dto.ts   # @IsPeriodString
    ├── preview-reconciliation.dto.ts        # @IsPeriodBoundaryDate + @IsValidPeriodRange (CreateDto extends)
    ├── preflight-batch.dto.ts               # @IsPeriodString + @IsOptional cho merchant_ids
    ├── preflight-range.dto.ts               # FEATURE-003: range path
    ├── audit-period-boundary.dto.ts         # FEATURE-003: response DTO
    ├── delete-batch.dto.ts                  # ⭐ FEATURE-025: DeleteBatchDto (1-50 IsMongoId) + DeleteBatchResponseDto {deleted, not_found}
    └── delete-batch.dto.spec.ts             # FEATURE-025 QC artifact: 9 TC-DT validation tests

reconciliation/services/  (post FEATURE-030)
├── reconciliation-calc.service.spec.ts      # ⭐ FEATURE-030: 5 TC-AO-* (TC-AO-01 CRITICAL dedup + TC-AO-02 Zaha fixture + edge cases)
├── xlsx.service.spec.ts                     # ⭐ FEATURE-030: TC-AO-06 render add-on col 6 + bottom Tổng
└── docx.service.spec.ts                     # ⭐ FEATURE-030: TC-AO-07..10 env.provider verify + legacy absent + bottom row + signature uppercase

backend/src/common/validators/
├── period.validator.ts                  # @IsPeriodString, @IsPeriodBoundaryDate('start'|'end'), @IsValidPeriodRange
└── period.validator.spec.ts             # 45 tests

admin/src/components/reconciliation/
└── MonthRangePicker.tsx                 # FEATURE-003: 4 preset + 2 dropdown range, controlled

admin/src/lib/period-helpers.ts          # FEATURE-003: VN-tz-safe (UTC math, NEVER toISOString slice)
admin/src/app/(dashboard)/reconciliations/
├── page.tsx                             # list + modal hàng loạt (state 1-indexed)
├── [id]/page.tsx                        # detail + download buttons (FEATURE-004: gọi backend, KHÔNG S3)
├── new/page.tsx                         # form tạo single (MonthRangePicker) + download buttons sau create
└── audit/page.tsx                       # FEATURE-003: BR-10 audit page

admin/e2e/
└── reconciliation-download.spec.ts      # FEATURE-004: 11 Playwright tests cho download flow
```

**Quirk reconciliation download (post FEATURE-004):**
- Cả 2 page download button dùng `\`/api/reconciliations/${id}/download/{xlsx|docx}\`` (backend stream với Logto Bearer auth).
- KHÔNG render `data.xlsx_url`/`data.docx_url` trực tiếp — bucket S3 private, Bearer Logto sai auth scheme cho S3.
- Field `xlsx_url`/`docx_url` GIỮ trong response cho `batch-export.service.ts` pipe S3→ZIP server-side (AWS SDK signed request).

### timing-alert/ module structure (FEATURE-001 — bootstrap)
```
backend/src/modules/timing-alert/
├── controllers/
│   └── timing-alert-admin.controller.ts    # Admin endpoints (incl. GET /discover-preview/:courseId)
└── services/
    ├── checkpoint-discovery.service.ts     # discover() schema-from-1 + discoverAndCachePreview() + getCachedPreview()
    ├── checkpoint-discovery.service.spec.ts (5 tests)
    ├── checkpoint-discovery-lock.spec.ts   (10 QC adversarial tests — BR-06 lock)
    ├── simulator.service.ts                # filterTimesField keep-keys-empty + getRawSnapshot
    ├── simulator-filter.spec.ts            (9 tests — BR-01)
    ├── scenario-engine.ts                  # dropKeyFromItem set value="" symmetric (BR-02)
    ├── scenario-engine.spec.ts             (9 tests)
    ├── miss-detector.service.ts            # Phase 3 multi-detection (existing, regression untouched)
    └── miss-detector.service.spec.ts       (18 regression tests)
```

### Build/run
- Dev: `cd backend && npm run dev` → port 8081
- Build: `cd backend && npm run build`
- Sau đổi DTO: chạy `pnpm generate:api` ở `admin/` và/hoặc `frontend/`

---

## 🎨 admin/ — Next.js 16 Admin Dashboard (port 3000)

### Route structure (App Router)
```
admin/src/app/
├── layout.tsx                  # Root layout
├── page.tsx                    # Landing
├── globals.css
├── apple-icon.png, icon.png, favicon.ico
│
├── login/                      # Login page
├── sign-in/                    # Sign-in flow (Logto)
├── callback/                   # OAuth callback
│
├── (dashboard)/                # Route group — authenticated dashboard
│   ├── races/                  # Race management + course + checkpoints
│   │   └── [id]/               # ⭐ FEATURE-007 v2 race-ops shell — 10-tab (post-F-015): Overview / Readiness / Course Map / Command Center / Result Kiosk / Awards / Athletes / Results / **Check-In Kiosk** / Settings
│   │       ├── athletes/       # ⭐ FEATURE-014 NEW_MODULE — replaces F-007 placeholder (slot 7)
│   │       │   ├── page.tsx    # orchestrator (race meta + AthletesTabBody compose)
│   │       │   ├── athletes.constant.ts  # 9-status enum + STATUS_TONES + BULK_ACTION_CAP=500
│   │       │   ├── athletes.microcopy.ts # scope-local VN strings (F-013 pattern reused)
│   │       │   ├── athletes.types.ts     # AthleteRow + runtime guards
│   │       │   ├── components/ # 14 components: AthletesTabBody / AthletesFilterBar / AthletesTable / AthleteRow / BulkActionBar / AthleteEditDrawer / AthleteProfileDrawer / ChangeStatusDialog / AuditLogTimeline / AthletesEmptyState / StatusBadge + sub
│   │       │   ├── hooks/      # 5 hooks: useAthletesList / useAthleteFilters / useAthletesSearch / useAthletesBulkActions / useAthletesExport
│   │       │   └── __tests__/  # 8 specs (1 EXECUTED PASS deriveAthleteStatus 20/20 + 7 deferred RTL)
│   │       ├── settings/       # ⭐ FEATURE-014 REFACTOR — page.tsx 1692→268 LOC composer (slot 9)
│   │       │   ├── page.tsx    # composer orchestrating 6 sections + header + dirty map
│   │       │   ├── SettingsLayout.tsx   # sticky left rail (desktop) / horizontal scroll (mobile <1024px) + dirty-dot indicator
│   │       │   ├── hooks/      # useDirtyFormPerSection (per-section dirty map BR-AS-28) + useUrlHashScroll (deep-link + IntersectionObserver active highlight + reduced-motion)
│   │       │   ├── sections/   # 6 sections: RaceMetaSection (12 fields + LifecycleStepper + OverrideStatusDialog) / CourseSection (9 fields + F-009 link card + CourseTable 7-action) / TimingSection (hosts F-008v2 link cards + F-010 form nesting F-012 hints) / PublishingSection (8 fields + 2 conditional reveals) / IntegrationsSection (cacheTtlSeconds moved here per BR-AS-39) / AdvancedSection (BrandingForm + SponsorsTable + SponsorDialog + RaceCertificateConfigPanel)
│   │       │   ├── components/ # PRESERVED ZERO DIFF: TimingDetectionConfigSection 349 (F-010) + TimingFormulaTooltipContent 132 + TimingPresetComparisonTable 191 + TimingPresetRationalePanel 107 + timing-presets.constant 56 (F-012)
│   │       │   └── __tests__/  # 2 deferred specs (useDirtyFormPerSection + useUrlHashScroll)
│   │       ├── check-in-kiosk/ # ⭐ FEATURE-015 NEW_MODULE — BIB pickup kiosk (slot 9 — Race Ops Cluster #9 #1)
│   │       │   ├── page.tsx    # orchestrator + KioskModeProvider + race-title fetch + status guard
│   │       │   ├── checkin.constant.ts  # BIB_MAX_LEN, IDLE_MS, SETNX_LOCK_TTL_S=5, source enum (qr/bib/cmnd)
│   │       │   ├── checkin.microcopy.ts # scope-local VN strings (Phase 1 PAUSE-CK-01 default; F-013 pattern reused)
│   │       │   ├── checkin.types.ts     # AthleteCheckInResponse runtime guard `isAthleteCheckInResponse(x)`
│   │       │   ├── components/ # 13 components: CheckInTabBody / CheckInBibInputScreen / CheckInResultScreen / MultiInputLookup / AthleteCheckInCard / ConfirmPickupButton / CMNDLastFourInput / MultiStationStatusBar / QRScannerOverlay / CheckInIdleOverlay / CheckInExitButton / CheckInModeProvider / CheckInWindowGuard
│   │       │   ├── hooks/      # 4 hooks: useAthleteLookup / useCheckInMutation / useStationSync / useQRScanner
│   │       │   └── __tests__/  # checkin.types.spec.ts (23 cases EXECUTED PASS) + 11 deferred specs (`@ts-nocheck` Jest+RTL — TD-F015-02)
│   │       ├── result-kiosk/   # ⭐ FEATURE-013 NEW_MODULE — kiosk surface (slot 5)
│   │       ├── command-center/ # ⭐ FEATURE-008 v2 — race-day cockpit (slot 4)
│   │       ├── awards/         # ⭐ FEATURE-008 v2 — podium (slot 6)
│   │       ├── course-map/     # ⭐ FEATURE-009 — standalone course map (slot 3)
│   │       ├── edit/           # Race edit form
│   │       │   └── components/
│   │       │       └── DiscoverPreviewPanel.tsx  # ⭐ FEATURE-001 — frontend-driven debounce 800ms apiUrl → trigger discover, BR-09 MERGE preserve names
│   │       └── timing-alerts/
│   │           └── components/
│   │               └── CheckpointDiscoveryDialog.tsx  # ⭐ FEATURE-001 — simplified mini editable table (drop coverage% + median cols)
│   ├── sponsors/               # Sponsor management (logo S3 upload)
│   ├── claims/                 # Result claims
│   ├── sync-logs/              # Data sync logs
│   └── promo-hub/              # ⭐ FEATURE-027 NEW — Trang quảng bá (slot trong sidebar nav "Nội dung" w/ Sparkles icon + NEW badge, requireRole: admin)
│       ├── page.tsx            # List page w/ filter (status all/draft/published/archived) + pagination + create button (auto-redirect to edit) + Tier 2 isAdmin RBAC gate at component top (F-029 pattern)
│       ├── new/page.tsx        # Defensive redirect to /promo-hub (canonical create flow = list-page "Tạo mới" button POST /api/promo-hubs)
│       └── [id]/page.tsx       # Edit page w/ 4 tabs (Nội dung / Thiết kế / SEO / Analytics). Sticky preview pane (desktop). Save → fire-and-forget POST /api/revalidate-hub
│
└── api/
    ├── [...proxy]/             # ⭐ RUNTIME proxy → BACKEND_URL (NOT build-time rewrites)
    │   └── route.ts
    └── revalidate-hub/         # ⭐ FEATURE-027 NEW: server-side proxy attaches REVALIDATE_TOKEN, POSTs to FRONTEND_REVALIDATE_URL. Fail-closed graceful skip if env unset.
        └── route.ts
```

### File then chốt
- `admin/src/app/api/[...proxy]/route.ts` — ⭐ proxy mọi `/api/*` về backend tại runtime
- `admin/src/lib/api-generated/` — generated SDK từ `@hey-api/openapi-ts`
- `admin/src/lib/api-hooks.ts` — TanStack Query hooks wrap SDK
- `admin/src/lib/timing-alert-api.ts` — ⭐ FEATURE-001 — `discoverPreview()` helper (call backend `GET /discover-preview/:courseId`)
- `admin/src/lib/deriveAthleteStatus.ts` — ⭐ FEATURE-014 NEW shared lib root — Option C client-derive 9-status function (REG/PICKED/DNS/LIVE/FIN/DNF/CUT/DSQ/MED) with editHistory[] precedence. First file in `admin/src/lib/` admin shared lib root.
- `admin/src/lib/kiosk/` — ⭐ FEATURE-015 NEW shared lib (6 files: `useFullscreen.ts` + `useKioskIdle.ts` + `useKioskSound.ts` + `kiosk.constant.ts` + `types.ts` + `index.ts`). Second consumer of `admin/src/lib/` shared root after F-014. F-015 mints generalized hooks (Option 3 — drop "Kiosk" prefix when extracting: `useKioskFullscreen` → `useFullscreen`; `KIOSK_CONFIG` → `SHARED_KIOSK_CONFIG`). F-013 retrofit deferred TD-F015-01 (1-line `import { useFullscreen } from '@/lib/kiosk'` swap × 3 files in `result-kiosk/hooks/`). Logic equivalence preserved with F-013 source (same Fullscreen API + body data attr primitive, same idle setInterval 1Hz countdown, same Web Audio OscillatorNode beep, same localStorage SOUND_LS_KEY persistence). Reusable for any future kiosk-mode admin features.
- `admin/src/lib/nav-groups.ts` — ⭐ FEATURE-022 + FEATURE-027 MODIFY: shared sidebar nav definition. F-027 added `Sparkles` import + `{ id: "promo-hub", href: "/promo-hub", label: "Trang quảng bá", icon: Sparkles, badge: "NEW", requireRole: "admin" }` entry in "Nội dung" group (filter via `Sidebar.tsx` SidebarNav `visibleGroups.filter(item.requireRole === "admin" && isAdmin)`).
- `admin/src/components/promo-hub/` — ⭐ FEATURE-027 NEW components (7 files):
  - `section-types.ts` — SECTION_TYPE_META 19 entries registry (icon from lucide-react + label + description + defaultConfig). Single source of truth for admin form rendering.
  - `PromoHubEditor.tsx` — DnD orchestrator via `@dnd-kit/sortable`, add-section panel (19 type cards), modal hook integration.
  - `SectionCard.tsx` — Sortable card with inline `translate3d()` CSS transform (avoid `@dnd-kit/utilities` dep). Eye/Pencil/Trash buttons on hover.
  - `SectionConfigDialog.tsx` — 596 LOC modal w/ switch over 19 type cases for type-specific form rendering + universal schedule fieldset + visibility toggle.
  - `PromoHubPreview.tsx` — Lightweight mock card preview (admin-only). Full SSR preview Phase 2 (TD-F027-PHASE2-04).
  - `ThemeConfigurator.tsx` — Exports `ThemeConfigurator` (color pickers + font + layout + customCss) + `SeoConfigurator` (metaTitle char counter + metaDescription + OG image + canonical).
  - `PromoHubAnalytics.tsx` — Phase A4 dedicated analytics tab reusing `admin/src/components/charts/AreaChart.tsx` (SVG-based, no Recharts dep). 3 summary cards + 2 charts (views/clicks per day 30d) + top sections list + top labels list.
- `admin/src/app/api/revalidate-hub/route.ts` — ⭐ FEATURE-027 NEW: server-side proxy for cross-app cache invalidation. Reads `REVALIDATE_TOKEN` env (never sent to browser), forwards to `FRONTEND_REVALIDATE_URL` with `Authorization: Bearer <token>` header. Fail-closed graceful skip `{ ok: true, skipped: 'no-token' }` if env unset.
- `backend/src/modules/race-result/check-in.controller.ts` — ⭐ FEATURE-015 NEW: 4 endpoints (`POST /race-results/check-in/:raceId/:bib` confirmPickup + `GET /race-results/check-in/:raceId/lookup` lookupAthlete + `GET /race-results/check-in/:raceId/sse` SSE stream + `GET /race-results/check-in/:raceId/stats` stats aggregation). All gated by `LogtoAdminGuard` (BR-CK-11). CMND PII boundary verified — never log full CMND value (BR-CK-08/10).
- `backend/src/modules/race-result/check-in.service.ts` — ⭐ FEATURE-015 NEW: confirmPickup pattern (Redis SETNX `checkin:lock:{raceId}:{bib}` 5s TTL distributed lock + atomic `findOneAndUpdate({raceId, bib, racekit_received: false}, {$set: {racekit_received: true, racekit_received_at}})` two-tier guard + check_in_logs insert + SSE broadcast + cache invalidation `master:rr-snapshot:{raceId}`). Resolves TD-F005-01 placeholder. lookupByCmndLastFour uses anchored regex `^[0-9]{4}$` against `RaceMasterData.cmnd_last_4` master-data layer.
- `backend/src/modules/race-result/check-in-sse.service.ts` — ⭐ FEATURE-015 NEW: NestJS `@Sse()` endpoint pattern + RxJS Subject per-race filter + 25s heartbeat (BR-CK-08). Mirrors F-005 timing-alert SSE for multi-station broadcast.
- `backend/src/modules/race-result/check-in-log.schema.ts` — ⭐ FEATURE-015 NEW: `check_in_logs` collection (raceId, bib, athleteId, checkedInAt, checkedInBy, stationId, source: qr/bib/cmnd, syncStatus). Index `{ raceId: 1, checkedInAt: -1 }`. **NO PII** — ObjectId only (BR-CK-15).
- `backend/migrations/2026-05-08-add-check-in-window.ts` — ⭐ FEATURE-015 NEW (PAUSED): idempotent migration adding `checkInWindow: { start: Date, end: Date }` to existing races. DRY_RUN env-flag mode for staging dry-run. Formula: `start = startDate - 3 days`, `end = startDate - 1 hour` per BR-CK-06. PAUSE awaiting Danny prod sign-off (TD-F015-03).
- `admin/src/components/race-ops-shell/RaceTabsNav.tsx` — ⭐ FEATURE-015 MODIFY: 9 → 10 tabs (added "Check-In Kiosk" entry, `enabledIn:["pre_race","live","ended"]` per BR-CK-19; race draft excluded — BR-CK-07).
- `admin/src/components/ui/` — shadcn/ui components
- `admin/next.config.*`

### Build/run
- Dev: `cd admin && npm run dev` → port 3000
- Build: `cd admin && npx next build`
- Generate SDK: `cd admin && pnpm generate:api` (chạy SAU khi backend đổi DTO)

---

## 🌍 frontend/ — Next.js 16 Public Frontend (port 3002)

### Route structure (App Router)
```
frontend/app/
├── layout.tsx
├── globals.css
├── sw.ts                       # Service worker
├── sitemap.ts                  # ⭐ FEATURE-027 EXTEND: fetch published hubs from BACKEND_URL/api/promo-hubs?status=published&pageSize=200 → append /hub/<slug> MetadataRoute entries (priority 0.8 + weekly + lastModified from updatedAt). Cached w/ next: { revalidate: 3600, tags: ['promo-hubs-sitemap'] }
├── robots.ts                   # SEO robots
│
├── callback/                   # OAuth callback
├── chip-verify/                # ⭐ Chip verification flow (TTS feature)
│
├── solution/                   # /solution
├── solution-5solution/         # /solution-5solution (5Solution branding)
├── solution-5sport/            # /solution-5sport (5Sport branding)
│
├── (main)/                     # Main public routes
│   ├── page.tsx                # Homepage (UTMB-inspired design)
│   ├── races/[slug]/           # Race results listing
│   │   ├── page.tsx
│   │   ├── [bib]/              # Athlete detail page
│   │   └── ranking/[courseId]/ # Course ranking
│   ├── calendar/               # Race calendar
│   ├── landing/                # Landing pages
│   └── hub/                    # ⭐ FEATURE-027 NEW public hub route
│       └── [slug]/
│           ├── page.tsx        # Server Component SSR, ISR `revalidate=60`, server-side fetch backend, generateMetadata (title/desc/canonical/OG/Twitter), JSON-LD inject, theme as CSS custom properties + customCss inline <style>
│           └── not-found.tsx   # VN 404 fallback (also for draft/archived to prevent existence leak)
│
└── api/
    ├── [...proxy]/             # Runtime proxy → BACKEND_URL
    └── revalidate-hub/         # ⭐ FEATURE-027 NEW: POST endpoint w/ Bearer token auth (REVALIDATE_TOKEN env). Calls revalidateTag('promo-hub:<slug>', 'default') + revalidateTag('promo-hubs-sitemap', 'default'). Next.js 16 2-arg signature.
    └── [...proxy]/             # Runtime proxy to backend
```

### File then chốt
- `frontend/app/api/[...proxy]/route.ts` — runtime proxy
- `frontend/app/globals.css` — ⭐ "Velocity" design system (Athletic Editorial theme)
- Service worker: `frontend/app/sw.ts`
- `frontend/components/hub/` — ⭐ FEATURE-027 NEW (21 files):
  - `PromoHubRenderer.tsx` — Server Component dispatcher, switch over 19 section.type cases (forward-compat unknown → null silent skip)
  - `PromoHubTracker.tsx` — Client Component, useEffect fires view event on mount + attaches document-level capture-phase click listener for `[data-promo-cta]` data-attr delegation. Uses `keepalive: true` fetch.
  - `sections/` (19 components, all Server Components except CountdownSection):
    - **Phase A (9):** HeroSection / RaceCalendarSection (async) / FeaturedRacesSection (async parallel by raceIds) / PromoBannerSection / CtaButtonsSection / SponsorsSection (async) / StatsSection / RichTextSection (dangerouslySetInnerHTML pre-sanitized) / RecentResultsSection (async)
    - **Phase B (10):** LinkGridSection / SocialLinksSection (inline SVG 10 platforms) / FaqSection (native `<details>/<summary>` zero-JS) / **CountdownSection** (`'use client'` 1s tick) / VideoEmbedSection (YouTube + Vimeo regex extract, `youtube-nocookie.com`) / ImageGallerySection / TestimonialSection / MapEmbedSection (HOST whitelist `google.com`/`openstreetmap.org`) / ScheduleTimelineSection / FormEmbedSection (ALLOWED_FORM_HOSTS whitelist + link CTA fallback)

### Build/run
- Dev: `cd frontend && npm run dev` → port 3002
- Build: `cd frontend && npx next build`

---

## 📦 Generated SDK

Generated từ OpenAPI bởi `@hey-api/openapi-ts`. **Không sửa thủ công.**

- Admin SDK: `admin/src/lib/api-generated/`
- Frontend SDK: `frontend/lib/api-generated/` (nếu có)
- Wrapper: `admin/src/lib/api-hooks.ts`

Chạy `pnpm generate:api` sau khi backend đổi DTO/endpoint.

---

## 🚀 Deployment (VPS: 5solution-vps, IP 157.10.42.171)

```
SSH: port 6060 (alias: ssh 5solution-vps)
Deploy path: /opt/5bib-result/
Docker images: ghcr.io/5solution/5bib-result/{backend,frontend,admin}:latest
```

| Service | Dev URL | VPS Port |
|---------|---------|----------|
| Backend | https://result-dev.5bib.com | 8081 |
| Frontend | https://result-fe-dev.5bib.com | 3082 → 3002 |
| Admin | https://result-admin-dev.5bib.com | 3083 → 3000 |

MongoDB chạy trên host (port 27018), containers access via `host.docker.internal:27018`.

CI/CD: GitHub Actions trigger trên push `main` (xem `.github/workflows/build-and-deploy.yml`).

---

## 🗂️ Convention nhanh

- **Folder modules**: `kebab-case` (vd: `chip-verification/`, `race-master-data/`)
- **Auth**: Logto (KHÔNG phải custom JWT) — module `logto-auth/`
- **Database**: MongoDB chính (Mongoose), KHÔNG có MySQL platform DB ở project này
- **Cache**: Redis dày đặc (xem `architecture.md` Redis Keys Registry)
- **API proxy**: runtime via `app/api/[...proxy]/route.ts` — `BACKEND_URL` set trong docker-compose

Xem chi tiết trong `conventions.md`.
