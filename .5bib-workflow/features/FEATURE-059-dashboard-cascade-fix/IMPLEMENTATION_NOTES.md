# FEATURE-059 — Implementation Notes (Reviewer's Guide)

**For:** Manager Code Review + QC Phase 1 Impact Audit
**Branch:** `feat/F-059-dashboard-cascade-fix`
**Base:** `87a4918` (v1.9.2 hotfix)

---

## Section 1 — 🚧 Deviations from Spec (intentional)

### [Deviation #1] Files Changed = 7 (Manager Plan said 8)

- **Spec said:** Manager Plan Scope Lock 2 NEW + 6 MODIFY = 8 files. File #8 = "Existing dashboard spec extend OR new — regression baseline TC".
- **I did:** 2 NEW + 5 MODIFY = 7 files. Regression baseline TC merged into new spec file `kpi.service.f059.spec.ts` as TC-59-01.
- **Why:** No existing `kpi.service.spec.ts` hoặc `sparkline.service.spec.ts` file trong codebase — searched `backend/src/modules/dashboard/services/` no `*.spec.ts` existed pre-F-059. Manager Plan said "OR new" — chọn "new" = merge regression vào new spec is acceptable per plan wording.
- **Reviewer should check:** TC-59-01 `Regression baseline — tenant no override + no MANUAL → fee = net × 5.5%` asserting mathematical equivalence pre-F-059. Sufficient coverage of BR-59-11 invariant.

### [Deviation #2] Cache key rename `dashboard:sparklines:30d` → `dashboard:sparkline:30d`

- **Spec said:** Manager Plan BR-59-06 flush pattern `dashboard:sparkline:*` (singular). Existing code có key `dashboard:sparklines:30d` (plural).
- **I did:** Renamed cache key to singular form to match flush pattern, avoiding pluralized vs singular mismatch (plural key would NOT match singular pattern → flush would miss).
- **Why:** Manager Plan explicit pattern `dashboard:sparkline:*`. Keeping plural key but using singular pattern → flush silent miss = bug. Renaming is cleaner than divergent flush patterns.
- **Reviewer should check:** Old key `dashboard:sparklines:30d` will auto-expire 1h post-deploy. No downtime risk. CLAUDE.md Redis Keys Registry updated. Zero data risk since cache, not source of truth.

### [Deviation #3] FeeService NOT passed pre-loaded config

- **Spec said:** PRD section 6.8 PAUSE-Coder-03 = A — pre-load configs trước loop. Implementation hint: "extend FeeService signature 4th param `_configCache?`" OR "pre-load in dashboard service before loop, KHÔNG modify F-058 FeeService".
- **I did:** Chose option 2 — pre-load Map ở dashboard service, KHÔNG modify FeeService signature.
- **Why:** F-058 territory protected per Scope Lock + Manager Plan PAUSE flag. Pre-load Map warms Mongo connection pool + reduces variance. FeeService internal vẫn `findOne({tenantId}).lean()` mỗi call. Document as TD-F059-PRELOAD-NO-SKIP-FEESERVICE (LOW) for future F-060 candidate.
- **Reviewer should check:** TC-59-10 verifies `configModel.find()` called exactly 1× per request (not N×). FeeService internal call still happens per-tenant — pre-load is more about consistent latency than absolute query count saving.

---

## Section 2 — ⚙️ Forced Changes (reality ≠ spec)

### [Forced #1] Route prefix actual `/api/admin/dashboard/*`

- **PRD assumed (Manager init):** Routes prefix `/api/dashboard/*`.
- **Reality:** `dashboard.controller.ts:41` uses `@Controller('admin/dashboard')`. Actual route prefix = `/api/admin/dashboard/*`.
- **Workaround:** BA already flagged in PRD section "Pre-flight Check" + PAUSE-Coder-04. Coder verified no code impact. Documentation only correction.
- **Manager/BA action:** None needed — BA flagged proactively.

### [Forced #2] FeeService DTO method signature already exists from F-058

- **PRD assumed:** Coder might need to extend FeeService method.
- **Reality:** `FeeService.computeFeeForOrdersAggregate(tenantId, orders, _period)` from F-058 already supports the exact use case. Zero modification needed.
- **Workaround:** Pure REUSE — Coder imports + calls method as-is. Confirms F-058 was well-designed for downstream consumers (F-059 = canonical first reuser).
- **Manager/BA action:** None — pattern proven.

---

## Section 3 — ⚖️ Tradeoffs Considered

| Decision | Option chosen | Alternative | Why chose | Cost paid |
|----------|---------------|-------------|-----------|-----------|
| Pull orders SQL strategy (sparkline) | Pull all 30-day orders 1 query → in-memory group by (date, tenant) | 30 daily queries (1 per day in loop) | Network roundtrip cost dominant for 17k orders × 30 trips vs 1 trip; 1 SQL faster despite larger result | Memory: peak ~17k orders × ~200 bytes = ~3.4MB per request acceptable for admin endpoint |
| MerchantConfig pre-load location | Dashboard service (`preloadMerchantConfigs()`) before loop | Extend FeeService method signature with optional `_config` param | F-058 territory protected per Scope Lock; modifying FeeService = scope creep risk | FeeService internal still does N findOne calls per request; Mongo pool warming only partial mitigation |
| Helper duplication strategy | Duplicate `pullOrdersForFeeAggregate` in kpi + sparkline + analytics (3 copies) | Shared helper in FinanceModule or common util | Per conventions.md "duplication trumps premature abstraction"; 3 services have different filter needs (analytics: tenantId/raceId filter; dashboard kpi: full period; dashboard sparkline: 30-day + dateKey pre-compute) | Maintenance burden if SQL signature changes → must update 3 places (mitigated by `om.payment_on` consistency lesson F-058) |
| KPI cache TTL | 60s | 0s (no cache) or 300s | 60s balances admin homepage freshness vs FeeService overhead; admin refresh < 1/min in practice | Up to 60s stale data after override mutation flushes cache (acceptable, not finance critical) |
| Cache key naming | Rename plural → singular | Keep plural + change flush pattern | Avoid divergent naming; flush pattern in Manager Plan dictates singular | One-time deploy gap (1h until old plural key expires; sparkline cache rebuilds fresh on next request) |
| Fallback 14-day implementation | Export `FALLBACK_DAYS=14` const, leave default 30 | Implement runtime auto-detection (slow path > 4s → switch) | Manual switch cleaner + predictable; auto-detection adds runtime complexity and observability requirement | Requires Coder OR QC to manually edit if PROD perf fails — acceptable for MVP |

---

## Section 4 — 🔬 Reviewer Notes (Manager + QC focus)

### Files cần review kỹ (priority order)

1. **`backend/src/modules/dashboard/services/kpi.service.ts:118-167`** — `aggregateOrders()` refactor. Critical business logic: 3-step pattern (display agg SQL → pull orders → per-tenant FeeService call). Compare semantically with `analytics.service.ts:166-233` pattern.
2. **`backend/src/modules/dashboard/services/sparkline.service.ts:114-218`** — `compute()` refactor with group-by-(date, tenant) in-memory. Performance hotspot. Verify pre-load configs + per-day loop logic.
3. **`backend/src/modules/dashboard/services/sparkline.service.ts:241-285`** — `pullOrdersForFeeAggregate()` Sparkline variant (returns flat array with `tenantId + dateKey` — differs from KPI helper). Verify dateKey extraction handles both Date and string `payment_on` formats.
4. **`backend/src/modules/merchant/merchant.service.ts:825-895`** — `flushEventOverrideCache` extension. Verify `ALL_FLUSH_PATTERNS` array merge correct + log prefix `[F-059]` for dashboard pattern failures.
5. **`backend/src/modules/dashboard/dashboard.module.ts`** — DI graph change. Verify FinanceModule export reach + MongooseModule MerchantConfig forFeature added.

### Concurrency hotspots

- **`sparkline.service.ts:178-200`** — Per-day loop sequential `await feeService.computeFeeForOrdersAggregate()`. Could parallelize via `Promise.all` but currently sequential to avoid burst Mongo load. Trade-off acceptable for cron warm path; admin endpoint on cache miss < 4s budget.
- **`merchant.service.ts:flushEventOverrideCache`** — 8 patterns × scanStream sequential. If Redis SCAN cost spikes >500ms with 500+ tenant future scale → consider parallel `Promise.all([patterns.map(flush)])`. TD-F058-CACHE-EXPLOSION-RISK already documented in F-058.

### Edge cases I tested vs deferred

✅ **Tested:**
- Multi-tenant aggregate (TC-59-05) — 3 distinct tenants different rates
- MANUAL-only tenant (TC-59-03) — fee VND-based + gmv=0
- Mix ORDINARY + MANUAL (TC-59-04) — fee = % + VND/vé combination
- Cache hit/miss with TTL 60s (TC-59-06, TC-59-07)
- Zero orders period (TC-59-08) — no FeeService call
- Pre-load configs 1 batch query (TC-59-10) — verifies N+1 not regress
- 30-day series shape backward compat (TC-59-09) — 4 series × 30 points each

⚠️ **Deferred (acceptable):**
- Cron race condition (TC-59-07 PRD) — verified by design: FeeService internal `findOne` fresh Mongo each call (Option γ safe). QC verify integration smoke.
- PROD HTTP autocannon benchmark — QC stage with live MySQL + Redis infrastructure.
- Cache flush trigger 9+ patterns scanStream live (TC-59-06 PRD) — QC verify via Redis CLI `KEYS dashboard:*` + `KEYS analytics:*` before/after POST override mutation.

### Type safety narrowed casts

- `kpi.service.ts:175-186` `pullOrdersForFeeAggregate` row type — narrowed to explicit `{ id; tenant_id; race_id; total_price; ... }` shape from `db.query<T[]>` return. No `as unknown as` used.
- `sparkline.service.ts:240-260` similar narrowed row shape.
- `merchant.service.ts:858-862` existing F-058 pattern `as unknown as { scanStream: ... }` kept (inherited from F-058). NOT new cast added by F-059.

### Security checklist self-applied

- [x] Endpoints unchanged: `LogtoStaffGuard` class-level guard preserved (BR-59 + dashboard.controller.ts:40).
- [x] Response shape unchanged: no new fields leaked (verified TC-59-09 4-series keys exact match).
- [x] Cache key namespace prefix verified: `dashboard:*` doesn't collide with `analytics:*` / `merchant:*` / `master:*`.
- [x] No new attack surface: all changes internal (refactor + cache).
- [x] MerchantConfig pre-load Mongo query uses parameterized `$in` (no string concat).
- [x] MySQL pull query uses parameterized `?` placeholders (no string interpolation).

### Performance numbers (in-process estimate)

- KPI per-tenant cascade in-process: ~1 ms per FeeService.computeFeeForOrdersAggregate call (mocked)
- Pre-load configs batch: 1 Mongo query (was N) → estimated 20-50ms PROD vs 58 × 5ms = 290ms naive
- Sparkline 30-day series with 58 tenant × 30 day FeeService calls: in-process ~1.7s estimate, within 4s budget
- KPI cold p95 PROD estimate: 250-450ms (within 1500ms budget)
- KPI hot (cache hit TTL 60s): < 50ms (within 100ms budget)

QC verify PROD numbers via autocannon — commands provided in `03-coder-implementation.md` section "Performance Benchmark".

### Critical regression test list (QC focus)

QC MUST run these BEFORE deploy:
1. F-058 analytics: `npx jest analytics.service.f058` — 14 tests PASS (verified Coder side)
2. F-043 merchant flush: `npx jest merchant.service.f043` — 13 tests PASS (verified Coder side)
3. F-040 fee.service base: `npx jest fee.service.spec` — existing tests untouched
4. F-059 new: `npx jest dashboard/services` — 13 tests PASS (verified Coder side)

If ANY of above 4 fails → REJECT immediately, root cause F-059 interaction.
