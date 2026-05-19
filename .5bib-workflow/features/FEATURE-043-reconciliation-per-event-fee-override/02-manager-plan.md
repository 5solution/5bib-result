# FEATURE-043: Plan Review

**Status:** ✅ APPROVED
**Reviewed:** 2026-05-19
**Reviewer:** 5bib-manager
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check (Manager)

- [x] Đã đọc `00-manager-init.md` + `01-ba-prd.md` đầy đủ
- [x] Đã đọc memory: `architecture.md` (Order domain — fee cascade impacts) + `conventions.md` (audit log + named connection + cache invalidation patterns) + `known-issues.md` (TD-F016/F029/F040 relevant)
- [x] **Spot-check code thật (skill 2026-05-17 mandate):**
  - `merchant-config.schema.ts` — verified shape, ready cho `event_fee_overrides` nested array (lazy default `[]` no migration)
  - `fee.service.ts:585-625` — F-040 3-tier cascade structure clear, Tier 0 insertion point identified (line 600 area)
  - `reconciliation.service.ts:127-156` — feeRate computation flow verified (single source `configModel.findOne({tenantId})`)
  - `merchant.service.ts:196-279` — `updateFee()` audit-history pattern reuse OK (`MerchantFeeHistory` collection)
  - `promo-hub/entities/race-readonly.entity.ts` + `promo-hub/promo-hub.module.ts:27` — `RaceReadonly` entity registered in `'platform'` named connection, ready cho cross-DB raceId validation

---

## ✓ PRD Validation Checklist

### Completeness
- [x] User Stories đầy đủ (5 personas + multi-stakeholder)
- [x] 17 BR-43-01..17 testable
- [x] 8 PAUSE conditions all answered (Danny Option A toàn bộ)
- [x] UI states đầy đủ: Loading / Empty / Data / Filtered / Error / Add dialog / Submitting / Success / Validation error / 409 Conflict / 403 Forbidden
- [x] 17 TC-43-XX backend + 6 E2E-43-XX Playwright

### Technical correctness vs codebase
- [x] MongoDB schema extension lazy `[]` default → no migration (BR-43-02 verified)
- [x] Compound index `{tenantId: 1, 'event_fee_overrides.raceId': 1}` matches Mongoose nested array indexing convention
- [x] 4 NEW endpoint paths follow REST + existing merchant.controller pattern
- [x] DTO validation chặt (Min/Max/regex/MaxLength) — class-validator decorators correct
- [x] Cross-DB validation `RaceReadonly` named connection `'platform'` correct
- [x] Cache key pattern `merchant:fee-overrides:<tenantId>` follows `[resource]:[id]:[variant]` convention
- [x] Cache invalidation chain: `pnl:*:tenant=<tenantId>` + `pnl:contracts-list:*` + new `merchant:fee-overrides:*` correctly scoped
- [x] Audit log pattern reuse `MerchantFeeHistory` với `fee_field='event_override.<raceId>.<field>'` naming convention
- [x] Generate SDK refresh sau backend DTO change

### Security
- [x] LogtoAdminGuard trên 4 NEW endpoints (BR-43-09)
- [x] Backend validate raceId via RaceReadonly (defense-in-depth — không trust client UI race picker, BR-43-10)
- [x] Response DTO không leak `_id` sub-document raw
- [x] Validation tight cho fee fields (0-100% range + integer constraints)

### Performance
- [x] SLA cụ thể: GET list p95 < 100ms cached, POST/PUT/DELETE < 300ms
- [x] Cache strategy có TTL 3600s + invalidate on mutation
- [x] Cascade lookup overhead < 5ms (in-document sub-array scan)
- [x] 10x flaky test concurrent POST + cache flush

### Testability
- [x] 17 TC-43-XX cụ thể (status + body + side effect verify)
- [x] All 4 cascade tiers covered (TC-43-08/09/10/11/12)
- [x] Concurrent race condition test (TC-43-15)
- [x] Backward compat verify (TC-43-16 existing recons preserved)

---

## 📊 Cross-check với memory

### Architecture impact
- ✅ No new service decomposition. F-043 = extend MerchantConfig schema + extend fee.service cascade + extend merchant.controller endpoints + 1 new admin UI component.
- ✅ Existing Order/Recon/Finance data flows preserved (only fee resolution logic extended).
- ✏️ Manager sẽ update `architecture.md` post-deploy: thêm "Event override lookup" step vào Order/Reconciliation flow diagram.

### Convention impact
- ✅ Pattern reuse F-024 audit log + F-040 cascade + F-033 RaceReadonly + F-038 dual-pattern cache flush.
- ✏️ NEW pattern minted (sẽ add vào conventions.md post-deploy):
  - **N-tier cascade resolution pattern** — generic template cho fee/rate/config resolution với fallback chain + source attribution

### Known issues impact
- **TD-F016-FINANCE-01** — F-043 KHÔNG touch legacy data, pure forward-compatible. Preserved.
- **TD-F029-INHERITED-CTRL-SPEC** — F-043 thêm endpoints có thể trigger spec issue. Coder PHẢI handle nếu encountered (PAUSE flag).
- **TD-F040-CASCADE-LOG-EXPLOSION** — Coder reuse F-040 rate-limited Logger.warn pattern, KHÔNG log per request.

---

## 📋 Files được phép thay đổi (Scope Lock)

> Coder CHỈ được thay đổi các file/folder sau.

### Backend modify (6 files)

- ✏️ `backend/src/modules/merchant/schemas/merchant-config.schema.ts` — Add `EventFeeOverride` sub-schema + `event_fee_overrides[]` field + compound index
- ✏️ `backend/src/modules/merchant/merchant.service.ts` — Add 4 methods (list/create/update/delete) + RaceReadonly injection
- ✏️ `backend/src/modules/merchant/merchant.controller.ts` — Add 4 endpoints (`@Get/@Post/@Put/@Delete .../:id/event-fee-overrides[/:raceId]`)
- ✏️ `backend/src/modules/merchant/merchant.module.ts` — Register `RaceReadonly` via `TypeOrmModule.forFeature([RaceReadonly], 'platform')`
- ✏️ `backend/src/modules/finance/services/fee.service.ts` — Extend `computeSelfFee()` cascade Tier 0 (event override lookup) + return `feeSource` enum
- ✏️ `backend/src/modules/reconciliation/reconciliation.service.ts` — `previewReconciliation()` + `createReconciliation()` propagate `feeSource` to response

### Backend NEW (3 files)

- ➕ `backend/src/modules/merchant/dto/event-fee-override.dto.ts` — `CreateEventFeeOverrideDto` + `UpdateEventFeeOverrideDto` + `EventFeeOverrideResponseDto`
- ➕ `backend/src/modules/merchant/dto/index.ts` (if needed for barrel export — verify existing structure)
- ➕ `backend/src/modules/reconciliation/dto/preview-reconciliation-response.dto.ts` — Add `fee_source` field (or extend existing DTO if found)

### Backend test NEW (3 spec files)

- ➕ `backend/src/modules/merchant/merchant.service.f043.spec.ts` — TC-43-01..07, 13, 14, 15 (CRUD + audit + cache flush + concurrent)
- ➕ `backend/src/modules/finance/services/fee.service.f043.spec.ts` — TC-43-08..12 (4-tier cascade + feeSource enum)
- ➕ `backend/src/modules/reconciliation/reconciliation.service.f043.spec.ts` — TC-43-16, 17 (backward compat + fee_source in preview response)

### Admin modify (2 files)

- ✏️ `admin/src/app/(dashboard)/merchants/[id]/page.tsx` — Thêm accordion section "Cấu hình phí theo sự kiện"
- ✏️ `admin/src/lib/merchants-api.ts` (verify path — may be different name) — Add 4 helpers (list/create/update/delete) + RaceReadonly fetch helper

### Admin NEW (1 file)

- ➕ `admin/src/app/(dashboard)/merchants/_components/event-fee-override-manager.tsx` — Component manage list + add dialog + edit + delete

### SDK regen (auto)

- 🔄 `packages/sdk/...` (if applicable in admin generate:api flow) OR admin uses raw fetch helpers — verify existing pattern

### Workflow docs

- ➕ `.5bib-workflow/features/FEATURE-043-reconciliation-per-event-fee-override/03-coder-implementation.md`
- ➕ `.../04-qc-report.md`
- ➕ `.../05-manager-deploy.md`

**Estimated total: 6 modify + 7 NEW = 13 files + 3 deploy docs**

### ABSOLUTELY OUT OF SCOPE

- ❌ Migration script cho 58 existing merchant configs (lazy default `[]` handles automatically)
- ❌ Retroactive recompute existing recons (BR-43-08 snapshot preserved)
- ❌ Staff role permission (BR-43-09 admin only)
- ❌ `effective_to` end date field (Option A only `effective_from`)
- ❌ TIMING/RACEKIT/OPERATIONS contract types (BR-43-17 TICKET_SALES only)
- ❌ Multi-merchant batch override
- ❌ `MerchantFeeHistory` schema change (reuse existing)
- ❌ `RaceReadonly` entity new field
- ❌ Order/OrderService code (only fee.service cascade affected, not order processing)

---

## 🔧 Tech approach (Coder refine)

### Schema design
```typescript
// merchant-config.schema.ts
@Schema({ _id: false })  // sub-document KHÔNG cần own _id
export class EventFeeOverride {
  @Prop({ type: Number, required: true })
  raceId: number;

  @Prop({ type: Number, default: null })
  service_fee_rate: number | null;

  @Prop({ type: Number, default: null })
  manual_fee_per_ticket: number | null;

  @Prop({ type: Number, default: null })
  fee_vat_rate: number | null;

  @Prop({ type: String, required: true })  // YYYY-MM-DD
  effective_from: string;

  @Prop({ type: String, default: null })
  note: string | null;

  @Prop({ type: Number, default: null })
  createdBy: number | null;

  // timestamps: true at sub-document level
}
export const EventFeeOverrideSchema = SchemaFactory.createForClass(EventFeeOverride);
EventFeeOverrideSchema.set('timestamps', true);

// In MerchantConfig class:
@Prop({ type: [EventFeeOverrideSchema], default: [] })
event_fee_overrides: EventFeeOverride[];

// Post-init (after SchemaFactory):
MerchantConfigSchema.index({ tenantId: 1, 'event_fee_overrides.raceId': 1 });
```

### Cascade extension
- Inject Tier 0 BEFORE Tier 1 in `computeSelfFee()` (line 600 area).
- Return `feeSource` enum to caller.
- Reuse F-040 rate-limited Logger pattern (no log per request, only warn when fallback hit).
- Same cascade applied independently per field: `service_fee_rate` (4-tier including contract), `manual_fee_per_ticket` (3-tier no contract), `fee_vat_rate` (3-tier no contract).

### RaceReadonly cross-DB validation
```typescript
// merchant.service.ts inject
@InjectRepository(RaceReadonly, 'platform')
private readonly raceRepo?: Repository<RaceReadonly>;

// In create method
const race = await this.raceRepo?.findOne({ where: { id: dto.raceId } });
if (!race) {
  throw new BadRequestException({
    message: `Race #${dto.raceId} không tồn tại`,
    code: 'RACE_NOT_FOUND',
  });
}
```

### Audit log
```typescript
// Helper method in merchant.service
private async logEventOverrideAudit(
  tenantId: number,
  raceId: number,
  field: 'service_fee_rate' | 'manual_fee_per_ticket' | 'fee_vat_rate',
  oldVal: number | null,
  newVal: number | null,
  adminId: number,
  note?: string,
) {
  await this.feeHistoryModel.create({
    tenantId,
    fee_field: `event_override.${raceId}.${field}`,
    old_value: oldVal != null ? String(oldVal) : null,
    new_value: newVal != null ? String(newVal) : null,
    changed_by: adminId,
    note,
  });
}
```

### Cache flush extension
```typescript
private async flushAllCachesForOverride(tenantId: number) {
  // F-040 pattern
  await this.flushPnLCacheForTenant(tenantId);
  // F-038 contracts-list pattern (if applicable)
  if (this.redis) {
    const keys = await this.redis.keys(`merchant:fee-overrides:${tenantId}`);
    if (keys.length) await this.redis.del(...keys);
  }
}
```

---

## 🛑 PAUSE points cho Coder

- 🛑 **Trước khi insert Tier 0 vào fee.service**, verify hiện tại 3-tier cascade pass all F-040 19 TC-FE tests. Run baseline test trước edit.
- 🛑 **Khi update reconciliation.service** để return `feeSource`, verify backward compat — existing consumers (admin UI, dashboard) KHÔNG break nếu field optional.
- 🛑 **Nếu RaceReadonly entity DI fail** trong merchant module (cross-module DI), STOP và confirm module registration. F-033 đã làm trong promo-hub module, có thể cần export.
- 🛑 **Trước khi commit**, run FULL test suite `npx jest --testPathPattern="modules/(merchant|finance|reconciliation)"` — verify ZERO regression (F-040 + F-016 + F-024 existing tests).

---

## 🧪 Unit test BẮT BUỘC

### `merchant.service.f043.spec.ts` (CRUD + audit + cache)
- [ ] TC-43-01: GET list happy path
- [ ] TC-43-02: POST happy path
- [ ] TC-43-03: POST duplicate → 409
- [ ] TC-43-04: POST invalid raceId → 400
- [ ] TC-43-05: PUT happy path
- [ ] TC-43-06: DELETE happy path
- [ ] TC-43-07: Non-admin → 403 (via guard mock)
- [ ] TC-43-13: Audit log per field on POST/PUT/DELETE
- [ ] TC-43-14: Cache flush on mutation
- [ ] TC-43-15: Concurrent POST → 1 success 1 fail 409

### `fee.service.f043.spec.ts` (4-tier cascade)
- [ ] TC-43-08: Tier 0 applied (override match + effective_from <= periodFrom)
- [ ] TC-43-09: Tier 0 SKIPPED (effective_from > periodFrom)
- [ ] TC-43-10: Tier 1 (no override match, merchant default)
- [ ] TC-43-11: Tier 2 (merchant null, contract revenueShare)
- [ ] TC-43-12: Tier 3 (all null → 5.5%)
- [ ] Bonus: Test feeSource enum value cho mỗi tier
- [ ] Bonus: Test manual_fee + vat_rate independent cascade

### `reconciliation.service.f043.spec.ts` (preview + backward compat)
- [ ] TC-43-16: Existing recon fee_rate_applied preserved post-override CUD
- [ ] TC-43-17: Preview response includes fee_source field

### F-040 regression
- [ ] Run existing `fee.service.spec.ts` — 19 TC-FE + extended must PASS

---

## 📊 Verdict

> ### ✅ APPROVED — Coder bắt đầu

**Lý do:**
- ✅ Comprehensive PRD với 17 BR + 17 TC + 6 E2E + 4 endpoint specs + DTO code blocks
- ✅ Cross-check memory + spot-check code thật all passed
- ✅ Pattern reuse (F-024 + F-033 + F-040 + F-038) — fast Coder execution
- ✅ Backward compat verified (no migration, lazy default `[]`)
- ✅ 8 PAUSE conditions all answered Option A — no business ambiguity
- ✅ Security boundary clear (LogtoAdminGuard + cross-DB validation + DTO validation)

**No NEEDS_REVISION required** — BA PRD comprehensive, all critical aspects covered.

---

## ✅ Sẵn sàng cho `/5bib-code`?

- [x] **Yes** — Coder bắt đầu với 13 files Scope Lock + 17 TC mandatory + 4 PAUSE points

**Estimated Coder workload:** ~3-4 hours
- ~30 min: Schema extension + DTOs
- ~45 min: merchant.service CRUD methods + RaceReadonly DI
- ~30 min: merchant.controller 4 endpoints
- ~45 min: fee.service Tier 0 cascade + feeSource enum
- ~30 min: reconciliation.service preview response extension
- ~45 min: Admin UI EventFeeOverrideManager + accordion + API helpers
- ~1h: 3 spec files (17 TC + bonus tests)
- ~15 min: Self-Review Pipeline

---

## 🔗 Next step

Danny chạy: `/5bib-code FEATURE-043-reconciliation-per-event-fee-override`
