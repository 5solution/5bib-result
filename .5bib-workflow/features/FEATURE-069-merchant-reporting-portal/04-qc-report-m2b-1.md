# FEATURE-069 M2b-1: QC Report — Merchant Portal Core

**Status:** ✅ APPROVED
**QC:** 5bib-qc-gatekeeper (No Mercy Protocol)
**Date:** 2026-06-05
**Milestone:** M2b-1 (resolveAccessibleRaces + GET /me + GET /races + M2b-1.1 race fix)
**Scope note:** Backend-only milestone → **Phase 6 Persona Walkthrough N/A** (no UI). Frontend deferred to M4.

---

## Gate Check
- [x] `03-coder-implementation-m2b-1.md` status `🟠 READY_FOR_QC`
- [x] "Tests Written" section present + PASS output (19 service tests)
- [x] Read `01-ba-prd.md` + `01-ba-prd-revision-r3.md` (data-layer source of truth)
- [x] Read `conventions.md` (MySQL Platform DB schema section, Redis mock, negative cache, try/catch business-exception rule)
- [x] Unit tests exist + pass → proceed

---

## Phase 1: Impact & Regression Audit

**Coder got right:**
- `@InjectDataSource('platform')` resolves via M2a's `TypeOrmModule.forFeature([Tenant], 'platform')` — no new module wiring bug.
- Service + controller registered + exported (M2b-2/3 can depend on `resolveAccessibleRaces`).
- Additive API — no SDK break. `pnpm generate:api` correctly deferred to M4 (no consumer yet).
- 2 NEW Redis keys (`merchant-portal:access:*`, `merchant-portal:races:*`) TTL 300s, both per-user namespaced.

**Probed for regressions — none found:**
- M2a access service untouched except declared M2b-1.1 race fix. Its 25 tests still green.
- No shared cache key collision with M2a admin endpoints.

## Phase 2: Security Threat Model

| Vector | Probe | Verdict |
|--------|-------|---------|
| **SQL injection** | All `${}` in query strings are placeholder-only (`?,?,?` from `.map(()=>'?')`) + constant `tenantClause`; values pass via params array. Grep confirmed no value interpolation. | ✅ SAFE |
| **IDOR (cross-user)** | `getRaces`/`getMe` take `userId` from `@CurrentUser` (JWT), never from query/body. Cache keys namespaced per-userId (Attack #3 proves no bleed). | ✅ SAFE |
| **IDOR (cross-tenant)** | `getRaces(tenantId)` rejects tenantId ∉ `cfg.tenantIds` with 403 BEFORE any SQL (Attack #5b). Metadata SQL carries `AND r.tenant_id = ?` (Attack #5). | ✅ SAFE |
| **Privilege via include override** | Admin include-override pointing to DRAFT race → NOT granted (include query has `status != 'DRAFT'`, Attack #2). | ✅ SAFE |
| **Exclude bypass** | raceId in both include & exclude → excluded (exclude applied last, Attack #1). | ✅ SAFE |
| **Auth bypass** | Class-level `@UseGuards(LogtoMerchantGuard)` covers both routes. Inactive account → 403 on cache AND DB path (Forced #1 fix verified by "inactive from cache" test). | ✅ SAFE |
| **Info disclosure** | `/me` + `/races` return explicit object literals — no doc spread, no `_id`/`__v`/`createdBy`/financial fields. Negative assertions in tests. | ✅ SAFE |
| **Cache poisoning** | Corrupt Redis JSON → parse throws → caught → fallback to source-of-truth (Attack #4). | ✅ SAFE |
| **Enumeration** | `assertRaceAccessible` returns identical 403 for not-exist vs no-permission (BR-MP-06 SEC-14). | ✅ SAFE |

## Phase 3: Adversarial Test Scripts (QC-authored)

NEW file `merchant-portal.adversarial.spec.ts` — 6 tests Coder did NOT cover:
- Attack #1 exclude-wins-over-include precedence
- Attack #2 include→draft rejection (security)
- Attack #3 per-user cache-key isolation (IDOR)
- Attack #4 corrupt-Redis graceful fallback
- Attack #5 / #5b getRaces tenant isolation + pre-SQL 403 short-circuit

## Phase 4: Execution Results + 10x Flaky

```
Full module: Test Suites: 4 passed, Tests: 50 passed, 50 total
  - merchant-portal.service.spec.ts ......... 19
  - merchant-portal.adversarial.spec.ts (QC)  6
  - merchant-portal-access.service.spec.ts .. (M2a) 
  - merchant-portal-access.adversarial.spec.ts (M2a)
10x flaky (full module): 50/50 passed × 10 — 100% deterministic
tsc --noEmit: clean for merchant-portal (independent QC run)
```

**Performance:** No live-DB perf test at unit layer. SQL is index-bounded (`race_id IN (set)`, `tenant_id IN (set)`) — set cardinality small (≤207 races platform-wide). Per-user cache 300s. Race-day p95 to be validated at M5 integration. **Not a blocker for M2b-1** (no endpoint serving production traffic yet).

## Phase 5: PRD / R3 Compliance

| BR / R3 rule | Code | Verified by |
|--------------|------|-------------|
| BR-MP-05 draft filter `status != 'DRAFT'` UPPERCASE | ✅ exact (R3 line 263) | resolveAccessibleRaces test + Attack #2 |
| BR-MP-05 CANCEL races SHOW (not filtered) | ✅ `!= 'DRAFT'` keeps CANCEL (R3 line 257) | by-design, R3 confirmed |
| BR-MP-05 `r.is_delete = 0` | ✅ both queries | grep |
| BR-MP-05 include ∪ tenant − exclude | ✅ | Attack #1, include/exclude tests |
| BR-MP-06 IDOR `assertRaceAccessible` enumeration-safe | ✅ | assertRaceAccessible test |
| BR-MP-21/22 cross-tenant filter scope | ✅ | Attack #5/#5b |
| BR-MP-26 `/me` + `/races` shape, no financial leak | ✅ | getMe/getRaces no-leak tests |
| R3 ticket aggregate `financial_status='paid'`, `om.deleted=0`, LEFT JOIN oli, GROUP BY | ✅ exact (R3 line 226 'paid' lowercase) | grep + getRaces tests |
| R3 `event_start_date` (not `races.date`) | ✅ | DTO + metadata SQL |

**Minor note (non-blocking):** Race-list "Tổng vé đã bán" uses `financial_status='paid'` (sold=paid semantic). M2b-2 Ticket-Sales page "Tổng vé" card uses all-status (R3 line 242). Labels differ ("đã bán" vs "Tổng vé") so divergence is intentional, not a bug — flag for M2b-2 to keep the distinction explicit in UI copy.

## Tech Debt (carry to Manager known-issues)
- **TD-F069-M2b-RACECOUNT-ADMINLIST** 🟢 LOW — admin-list `raceCount` sentinel `'__all'` (Coder Deviation #1, accepted — avoids N+1). Merchant-facing real count DONE.
- **TD-F069-M2b-BIGINT-RACEID** 🟢 LOW — `Number(race_id)` precision loss if race_id > 2^53. Current max ~207 races, no risk. Revisit only if IDs approach 2^53.
- **TD-F069-M2b-GENERATE-API** — `pnpm generate:api` deferred to M4 (frontend milestone).
- **Race-day perf SLA** — validate p95 at M5 integration (no production endpoint yet).

## Final Verdict: ✅ APPROVED

M2b-1 stands up under adversarial probing: SQL injection-safe, IDOR-safe (cross-user + cross-tenant + draft-via-include), graceful cache degradation, R3 schema-exact. 50 tests 100% deterministic ×10. No blockers.

→ Ready for `/5bib-deploy` (M2b-1 partial) OR proceed `/5bib-code FEATURE-069 M2b-2`.
