# FEATURE-043: Reconciliation Per-Event Fee Rate Override

**Status:** 🟡 INITIATED
**Created:** 2026-05-19
**Owner:** Danny
**Type:** EXTEND_EXISTING (MerchantConfig schema + reconciliation calc + fee.service finance + admin UI)
**Created by:** 5bib-manager
**Branch:** `5bib_recon_upgrade_v1` (current)

---

## 🎯 Why this feature

Danny report 2026-05-19: nâng cấp tính năng đối soát cho phép **cấu hình override mức phí theo sự kiện của merchant**.

> Thực tế: cùng 1 merchant có thể có nhiều sự kiện với mức phí khác nhau (vd merchant "Cát Tiên Adventure" tổ chức Cát Tiên Jungle Paths fee 7% + Cát Tiên Trail Mini fee 5% — không thể dùng 1 mức phí áp cho cả 2 events).

**Hiện trạng:** `MerchantConfig.service_fee_rate` (MongoDB) là 1 mức cố định per merchant — áp dụng cho TẤT CẢ events của merchant đó. Không có override per-race.

→ Feature F-043 = add per-event fee override mechanism cho MerchantConfig + cập nhật fee computation 3-tier (event override → merchant default → contract revenueShare → 5.5% default).

---

## 📂 Impact Map (theo memory + spot-check 2026-05-19)

### Module sẽ chạm

**Backend (`backend/src/modules/`):**

1. **`merchant/`** — Schema + service extend:
   - `merchant/schemas/merchant-config.schema.ts` — Add NEW field `event_fee_overrides: Array<{raceId, service_fee_rate, manual_fee_per_ticket?, effective_from?, note?}>` (Mongoose sub-document)
   - `merchant/services/merchant.service.ts` — Add CRUD methods cho event override (add/update/remove/list per merchant)
   - `merchant/dto/` — NEW `event-fee-override.dto.ts`
   - `merchant/merchant.controller.ts` — NEW endpoints: `GET/POST/PUT/DELETE /api/merchants/:tenantId/event-fee-overrides[/:raceId]`

2. **`reconciliation/`** — Fee lookup logic update:
   - `reconciliation/services/reconciliation-calc.service.ts` — `feeRate` parameter resolved trước qua override check (raceId lookup), fallback merchant default
   - `reconciliation/reconciliation.service.ts` — Pass `raceId` vào calc service
   - `reconciliation/services/reconciliation-preflight.service.ts` — Display effective fee rate in preview (override flag)

3. **`finance/services/fee.service.ts`** — Same override priority chain:
   - Current cascade: `merchant_configs.service_fee_rate → contract.revenueShare.feePercentage → 5.5% default`
   - NEW cascade: `event_fee_overrides[raceId] → merchant_configs.service_fee_rate → contract.revenueShare.feePercentage → 5.5% default` (4-tier)
   - Cache invalidation: extend existing `pnl:ticket-sales-fee:*` flush

4. **Admin (`admin/src/app/(dashboard)/merchants/[id]/`):**
   - Merchant detail page — Add new section "Cấu hình phí theo sự kiện"
   - NEW component `EventFeeOverrideManager.tsx` — list/add/edit/delete overrides
   - Race picker (reuse F-040 MySQL race-picker)
   - Effective rate display + history (audit-like view)

5. **(Optional)** — Reconciliation page UI:
   - Show "Phí áp dụng: X% (override theo sự kiện)" badge nếu fee came from override
   - Tooltip linking to merchant override config

### File then chốt cần Coder đọc trước khi code

- `backend/src/modules/merchant/schemas/merchant-config.schema.ts` — extend schema (line 1-80 đã đọc)
- `backend/src/modules/reconciliation/services/reconciliation-calc.service.ts:21` — `feeRate` parameter passes through, need add raceId context
- `backend/src/modules/finance/services/fee.service.ts:90-91` — `merchantConfigModel` injection + `computeSelfFee()` cascade logic line 595-625 (F-040 fee resolution)
- `backend/src/modules/reconciliation/reconciliation.service.ts` — `createReconciliation()` + `previewReconciliation()` — caller of feeRate
- `admin/src/app/(dashboard)/merchants/[id]/page.tsx` — Merchant detail page UI
- F-040 `04-qc-report.md` — fee.service 4-tier cascade test pattern reference

### Endpoint liên quan

- (NEW) `GET /api/merchants/:tenantId/event-fee-overrides` — list all overrides for merchant
- (NEW) `POST /api/merchants/:tenantId/event-fee-overrides` — create override `{raceId, service_fee_rate, manual_fee_per_ticket?, fee_vat_rate?, effective_from?, note?}`
- (NEW) `PUT /api/merchants/:tenantId/event-fee-overrides/:raceId` — update override
- (NEW) `DELETE /api/merchants/:tenantId/event-fee-overrides/:raceId` — remove override (fallback to merchant default)
- (EXISTING modify) `GET /api/merchants/:tenantId` — response include `event_fee_overrides[]` array
- (EXISTING modify) reconciliation preview endpoint — display effective fee + override source
- (EXISTING modify) `GET /api/finance/contracts/:id/fee-breakdown` (F-040) — show event-override source attribution

### Schema/DB

- **MongoDB:** `merchant_configs` collection — add nested array field `event_fee_overrides[]`
  - Sub-schema: `{ raceId: number (required, MySQL platform race.id), service_fee_rate: number | null, manual_fee_per_ticket: number | null, fee_vat_rate: number | null, effective_from: string | null, note: string | null, createdBy: number | null, createdAt: Date, updatedAt: Date }`
  - **NO migration needed** — Mongoose lazy default `[]` empty array
  - Index: compound `{tenantId: 1, 'event_fee_overrides.raceId': 1}` for fast override lookup
  
- **MySQL platform:** KHÔNG đụng (raceId references `races.id` via named connection `'platform'`)

- **Redis cache:** Extend existing flush patterns:
  - `pnl:ticket-sales-fee:<contractId>:tenant=<tenantId>` (F-040) — invalidate khi override update
  - `pnl:dashboard:*` + `pnl:contracts-list:*` (F-038) — flush khi fee rate change affects revenue
  - NEW key pattern `merchant:fee-overrides:<tenantId>` TTL 3600s (cached overrides list)

---

## ⚠️ Risk Flags

> Cross-reference với `known-issues.md`:

- 🔴 **HIGH financial logic change** — Fee calculation cascade modification → affects PROD reconciliation cho 58 merchant tenants. Per F-040 PROD verification, cascade was 3-tier; F-043 makes it 4-tier. ALL existing recon flows need regression test.
- 🔴 **HIGH backward compat** — Existing merchant configs có `service_fee_rate` set (active production data). F-043 must NOT change existing behavior — overrides are OPT-IN per race only. Default behavior `merchant.service_fee_rate` unchanged.
- 🟡 **MED audit trail** — Per F-024 audit pattern, override CUD must emit `audit_logs` events for finance team traceability.
- 🟡 **MED MySQL race ID validation** — When admin creates override, must verify `raceId` exists in MySQL `races` table (cross-DB check). Pattern reuse F-033 `RaceReadonly` entity.
- 🟡 **MED cache stampede risk** — F-040 PROD ran into rate-limit log explosion when MerchantConfig updated. Extend rate-limit log Set tracker để cover event override updates.
- 🟢 **LOW admin UI** — Merchant detail page already has multiple sections, adding new card is mechanical.
- 🟢 **LOW MongoDB schema** — Lazy default `[]` array → no migration, no downtime.

### Known issues impact

- **TD-F016-FINANCE-01** 🚨 (CRITICAL legacy) — Pre-F-016 recon shipped với wrong data. F-043 NOT touching this — pure forward-compatible.
- **TD-F029-INHERITED-CTRL-SPEC** — `reconciliation.controller.spec.ts` mock issue. F-043 may need to update controller spec if adding new endpoint → flag PAUSE if encountered.
- **F-040 cascade test pattern** — 19 TC-FE tests cover 3-tier fee compute. F-043 adds 4th tier → extend test matrix.
- **F-016 GROUP_BUY/CODE_TRANSFER** edge cases — F-043 fee logic must preserve these enum handlings.

---

## 🚧 PAUSE Conditions cần BA xác nhận khi viết PRD

> Manager liệt kê các câu hỏi nghiệp vụ chưa rõ. BA phải trả lời TỪNG cái trong `01-ba-prd.md`.

- [ ] **PAUSE-43-01 (Override scope — fields):** Override field chỉ `service_fee_rate` (%) hay full set `{service_fee_rate, manual_fee_per_ticket, fee_vat_rate}`? Manager đề xuất full set (atomic per-event control), nullable each field — null = fallback merchant default field.

- [ ] **PAUSE-43-02 (Effective date semantics):** `effective_from` ngày để versioning historical recon? Vd: merchant cập nhật override từ 1/6/2026, recon tháng 5 vẫn dùng old rate. Manager đề xuất:
   - Option A: Effective_from required, recon dùng latest override với effective_from <= recon.dateRange.from
   - Option B: Effective_from optional, override apply immediately (current behavior, no time travel)
   - Option C: Effective date range `effective_from/effective_to` (full versioning)
   Manager khuyến nghị **Option A** cho preview accuracy + audit history.

- [ ] **PAUSE-43-03 (Backward compat — recompute old recons):** Sau F-043 deploy, có cần re-compute fee cho existing recons với new override logic? Manager đề xuất KHÔNG (old recons giữ snapshot fee tại thời điểm tạo), nhưng cần re-compute cho FUTURE recons + dashboard P&L aggregate. BA xác nhận.

- [ ] **PAUSE-43-04 (RACEKIT/OPERATIONS contracts):** Fee override chỉ áp dụng TICKET_SALES (% based fee) HAY mở rộng cho TIMING/RACEKIT/OPERATIONS (fixed-price contracts)? Manager đề xuất chỉ TICKET_SALES vì TIMING/RACEKIT/OPERATIONS là contract fixed-price (đã có acceptance report), không có concept "% fee per event".

- [ ] **PAUSE-43-05 (Admin role permission):** Override CUD chỉ admin role HAY staff cũng được? Manager đề xuất chỉ ADMIN (LogtoAdminGuard) vì fee config impact financial — không cho staff override.

- [ ] **PAUSE-43-06 (Display effective rate trong recon preview):** Khi admin tạo recon mới, preview page hiển thị "Phí áp dụng: 7% (override)" với indicator badge nguồn? Manager đề xuất Yes + tooltip explain "from event override" vs "from merchant default" vs "fallback default 5.5%".

- [ ] **PAUSE-43-07 (UI flow trong merchant detail page):** Tab riêng "Phí theo sự kiện" hay accordion section trong tab Tổng quan? Manager đề xuất accordion in Tổng quan (giữ nguyên IA, less navigation friction).

- [ ] **PAUSE-43-08 (Validation cross-DB):** Khi tạo override với `raceId`, validate raceId tồn tại trong MySQL `races` table (named connection `'platform'`)? Hay trust client UI race picker? Manager đề xuất backend validate (DTO level + service layer double-check via existing F-033 `RaceReadonly`).

---

## 🎯 Success criteria (gợi ý cho BA)

- Merchant detail page có UI quản lý fee overrides per event với race picker
- Reconciliation calc dùng override khi exists, fallback merchant default → contract → 5.5%
- Cache invalidate đúng khi override update (no stale fee data)
- Audit log emit cho create/update/delete override
- Existing 58 merchant configs KHÔNG bị break (override empty array default)
- Existing recons fee snapshot preserved (no retroactive change)
- F-040 fee-breakdown endpoint show override source attribution
- 4-tier cascade: event override → merchant default → contract revenueShare → 5.5% default
- Test coverage: unit + integration covers all 4 cascade paths + concurrent update race

---

## 📊 Manager observations & strategic notes

### Architecture decision recommended

- **Storage:** Inline nested array trong MerchantConfig (Option A from spot-check) — simpler than separate collection. Tradeoff: max ~20 overrides per merchant before MongoDB document size concern (acceptable for 58 merchants × few events each).
- **Lookup priority:** `find override WHERE tenantId=X AND raceId=Y AND (effective_from <= now OR null)` ORDER BY effective_from DESC LIMIT 1 — latest applicable override
- **Cache key:** `merchant:fee-overrides:<tenantId>` array cached 3600s, invalidate on any override CUD
- **Cross-DB:** raceId stored as `number` (MySQL platform), KHÔNG ObjectId. Validation via existing F-033 `RaceReadonly` entity in named connection.

### Pattern reuse

- **F-040 cascade pattern** — extend 3-tier → 4-tier, same Logger.warn rate-limited pattern
- **F-024 audit log** — emit `merchant.event-fee-override.create/update/delete`
- **F-033 RaceReadonly** — cross-DB validation race id
- **F-038 dual-pattern cache flush** — extend trigger sites khi override update

---

## 🚨 CRITICAL Manager flag — F-042 Phase 2 follow-up needed (SEPARATE feature)

> Danny report 2026-05-19 ngoài recon upgrade còn báo CONTRACT DOCX bugs vẫn còn. Manager spot-check confirmed F-042 Phase 1 MISSED multiple hardcoded TEXT (non-numeric) values.

### F-042 missed bugs CONFIRMED via grep audit 2026-05-19

**Hardcoded contract number TEXT trong templates:**
- `contract-racekit.docx`: `10.04/2026/HĐDV/TAM-5BIB`
- `acceptance-racekit.docx`: `10.04/2026/HĐDV/TAM-5BIB` (4 occurrences!)
- `contract-ticket-sales.docx`: `HDDV` text fragment

**Hardcoded "Bằng chữ" (VN amount in words) sample text:**
- `contract-racekit.docx`: `Ba mươi sáu triệu một trăm tám mươi nghìn đồng` (= 36.180.000 sample)
- `contract-operations.docx`: `Hai trăm sáu mươi tư triệu tám trăm tám tám ngàn ba trăm sáu mươi đồng` (= 264.888.360 sample)
- `acceptance-timing.docx`: `Tám mươi lăm triệu bốn trăm hai mươi chín ngàn không trăm tám mươi đồng` (= 85.429.080 sample × 3 occurrences)
- `acceptance-racekit.docx`: `Ba mươi sáu triệu...` + `Mười tám triệu...` (× 3 occurrences each)
- `acceptance-operations.docx`: `Một trăm ba mươi ba triệu...` (× 3 occurrences)

**Danny's reproduction case verified:**
- Contract `6a0bcab66042f47bde4eb9d7`
- DB contractNumber: `10.05/2026/HDDV/CTTFA-5BIB-6`
- DOCX (BBNT + Contract) hiển thị: `10.04/2026/HĐDV/TAM-5BIB` ❌ (matches `acceptance-racekit.docx` hardcoded value exactly)
- Plus 10.000.000 + 10.800.000 financial values in DOCX → may be DB values OR sample hardcoded (TBD verify)

**File naming convention bug:**
- Current: filename uses contract ID (`6a0bcab66042f47bde4eb9d7.docx`)
- Expected per Danny: `[Mã hợp đồng] - [Tên sự kiện].docx` (vd: `10.05.2026.HDDV.CTTFA-5BIB-6 - Cát Tiên Trail Family Adventure.docx`)
- Logic: `backend/src/modules/contracts/utils/build-filename.ts` exists but apparently not invoked OR signature wrong
- Need verify why pattern documented but not applied

### Recommended action

**Open F-044 separately:** `/5bib-init FEATURE-044-contract-docx-phase-2-text-hardcoded-fix`
- Scope: Fix 5 templates với hardcoded TEXT (contract number + Bằng chữ + ticket-sales HDDV fragment)
- File naming convention enforcement (verify build-filename invoked correctly)
- Backend `payment-request.docx` may also need verification (in-words placeholder OK but full content audit needed)
- **HIGH severity** — same legal/finance risk class as F-042
- Pattern reuse F-042: XML manipulation + audit + regenerate scripts (likely can extend F-042's scripts)
- **Branch:** Separate branch (vd `5bib_contract_docx_phase2_v1`) OR Danny chốt merge into current `5bib_recon_upgrade_v1`

### F-042 audit script gap

F-042 `audit-template-placeholders.ts` reports "Hardcoded leaks: NONE" because pattern only checks vi-VN financial format `[0-9]{1,3}\.[0-9]{3}\.[0-9]{3}`. **Update audit script** to ALSO detect:
- Contract number pattern `\d{2}\.\d{2}/\d{4}/H[DĐ]+/`
- VN amount-in-words pattern `(Một|Hai|Ba|Bốn|Năm|Sáu|Bảy|Tám|Chín)\s+(trăm|mươi|triệu|tỷ)\s+`
- Sample race name fragments

---

## ✅ Sẵn sàng cho `/5bib-prd`?

- [x] **Yes** for F-043 reconciliation per-event fee override — BA proceed với 8 PAUSE conditions
- 📝 **Note cho BA:** PRD MUST include:
  - Sub-schema spec cho `EventFeeOverride` (Form Fields Table)
  - 4-tier cascade priority logic (decision matrix)
  - 4 NEW endpoint specifications (Backend Endpoint Spec Tables)
  - Admin UI flow diagrams (UI Step-by-Step Numbered Tables)
  - Test cases per cascade path (TC-43-XX) + concurrent update test (cache race)

- 🚨 **CRITICAL parallel:** F-044 (contract DOCX phase 2) cần open separate. Manager recommends:
  - Either Danny invokes `/5bib-init FEATURE-044-contract-docx-phase-2-text-hardcoded-fix` NOW
  - Or commit to defer F-044 until F-043 ships first
  - Don't bundle 2 features into 1 BA PRD (workflow protocol violation)

---

## 🔗 Next step

**Danny chốt scope split + run:**

```bash
# F-043 recon upgrade (continue current branch 5bib_recon_upgrade_v1)
/5bib-prd FEATURE-043-reconciliation-per-event-fee-override

# F-044 contract DOCX phase 2 (separate workflow, ưu tiên HIGH per legal risk)
/5bib-init FEATURE-044-contract-docx-phase-2-text-hardcoded-fix
```

Recommend timing:
1. F-044 ưu tiên ship trước (HIGH severity legal/finance, scope tương tự F-042 với pattern reuse — ETA ~3-4h)
2. F-043 ship sau (MED scope reconciliation upgrade — ETA ~6-8h including admin UI)
3. Both can use same `5bib_recon_upgrade_v1` branch OR separate (Danny chốt)
