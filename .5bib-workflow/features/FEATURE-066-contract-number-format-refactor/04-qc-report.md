# FEATURE-066 — QC Report (NO MERCY)

> **QC:** 5bib-qc-gatekeeper
> **Reviewed:** 2026-05-26
> **Branch:** `feat/F-066-contract-number-format` @ `db30850`
> **Base:** `origin/main`
> **Verdict:** ⚠️ **APPROVED WITH MINOR REWORK**

---

## 1. Tóm tắt

QC độc lập 5 phases trên 8 files (12 nếu tính 4 docs) — diff `+1693 / -51 LoC`. Test runs:

| Suite | Pass/Total | Note |
|-------|-----------|------|
| `strip-company-prefix.spec.ts` | **21/21** ✅ | 14 prefix variants + 7 edge cases |
| `contract-number.service.spec.ts` | **25/25** ✅ | 10 F-024 backward compat + 15 TC-66 |
| `partners.service.spec.ts` | **5/5** ✅ | KHÔNG có test cho `assertShortNameUnique()` — gap |
| **`contracts` full module** | **295/295** ✅ | Zero regression F-024/F-028/F-044/F-064 |

Coder claim 295/295 PASS — **CONFIRMED**. Re-run independent.

---

## 2. Phase 1 — Impact & Regression

### 2.1 stripCompanyPrefix (14 + 1 variants)

✅ **PASS.** Helper handle `CTCP / CTY CP / CONG TY CO PHAN` + diacritics + `CTYTNHHMTV` (longest-match-first) + `DNTN / HOP TAC XA / HTX`. Edge `CTCP CTCP ABC` → NOT recursive (`CTCP ABC` — đúng BR-66-04 strip 1 lần). Boundary `(\s+|$)` ngăn false-strip `CTCPLAB` (chữ liền).

🟡 **Minor — pattern count drift:** PRD spec 14 patterns, util impl 15 (thêm `CTY CP`). Acceptable scope creep — tăng coverage VN names thực tế. KHÔNG block.

### 2.2 Per-(year, client) Redis key isolation

✅ **PASS.** TC-66-04 verify 2 partners cùng năm → 2 distinct keys `contracts:sequence:2026:TAM` + `:ABC` — cả 2 đều `seq=1` (no `-N` suffix). `sequenceKey()` helper handle backward compat khi `clientShortName=undefined` → fallback legacy `contracts:sequence:<year>` (giữ F-024 nextSequence 1-arg call site).

### 2.3 Partner.shortName 2-tier priority

✅ **PASS.** `resolveClientToken()` priority: (1) `partnerShortName` non-empty + sanitize → tier-1, (2) `stripCompanyPrefix(entityName)` → tier-2, (3) `'CLIENT'` fallback → tier-3. TC-66-03 + TC-66-09 + TC-66-10 cover all 3 tiers + `source` label đúng cho audit log.

### 2.4 F-024 backward compat (3-arg legacy signature)

✅ **PASS.** Overload resolution chuẩn TypeScript. 10 F-024 tests cũ pass với 3-positional `(date, 'TAM', '5BIB')`. F-044/F-064 render tests trong `f045-multi-provider-render-verify.spec.ts` ZERO regression (verified qua full module run 295/295).

### 2.5 409 Conflict uniqueness check shortName

⚠️ **FAIL — code-level PASS, test-level GAP.**

- `PartnersService.assertShortNameUnique()` đã implement đúng: throw `ConflictException` với VN message + `_id: { $ne: ... }` exclude self.
- BUT `partners.service.spec.ts` ZERO test verify behavior này — không có TC-66-16 covering: (a) create với shortName trùng → 409, (b) update self với shortName chính nó → PASS (no false-positive), (c) update với shortName partner khác → 409.
- Coder claim trong commit `d4993b6 "feat(F-066): Partner shortName uniqueness validation 409"` nhưng test coverage absent. Manager Plan ghi rõ "Validation reject 400 (invalid format), 409 (duplicate shortName)" trong "Unit test bắt buộc" section line 184.

**RW-01:** Bổ sung tối thiểu 3 test cases trong `partners.service.spec.ts` cover OQ-66-01 (create dup → 409, update self → OK, update với dup khác → 409).

---

## 3. Phase 2 — Security

| Check | Status | Note |
|-------|--------|------|
| Validation regex `^[A-Z0-9]+$` + max 16 | ✅ | DTO L2 + service L3 sanitize (defense-in-depth). UI L1 transform on every keystroke |
| `LogtoStaffGuard` preserved | ✅ | Class-level `@UseGuards(LogtoStaffGuard)` ở `partners.controller.ts:44` — apply cho POST/PATCH/DELETE |
| NoSQL injection partner shortName | ✅ | `findOne({shortName, deletedAt: null})` value passed as data — Mongoose driver parameterized. Regex `^[A-Z0-9]+$` ngăn operator injection nếu somehow bypass |
| ReDoS | ✅ | Patterns ngắn anchored `^`, không backtracking risk |
| Logger.warn không leak PII | ✅ | Object structured `{event, year, clientToken, sequence, source, providerId}` — chỉ clean token, KHÔNG raw entityName/email |

✅ **PASS.** Zero security finding.

---

## 4. Phase 3 — Test Coverage

### 4.1 Independent re-run kết quả

```
contract-number: 25/25 PASS (1.84s)
strip-company-prefix: 21/21 PASS (1.68s)
partners.service: 5/5 PASS (1.82s)
contracts module full: 295/295 PASS (5.98s, 27 suites)
```

Coder claim **CONFIRMED 295/295**.

### 4.2 TC-66-* matrix mapping

| TC | Status | Where verified |
|----|--------|---------------|
| TC-66-01 strip CTCP happy path | ✅ | contract-number.service.spec.ts:149 — token = `TAMANMEDIA` (compact form chốt) |
| TC-66-02 longest-match CTY TNHH MTV | ✅ | L166 — strip MTV trước TNHH |
| TC-66-03 partnerShortName override | ✅ | L178 — CUSTOM thắng entityName strip + source='partnerShortName' |
| TC-66-04 per-(year, client) isolation | ✅ | L191 — 2 partners both seq=1, 2 distinct Redis keys |
| TC-66-05 same client increment 1→2→3 | ✅ | L219 — suffix -2 / -3 |
| TC-66-06 year reset Dec 31→Jan 1 | ✅ | L236 |
| TC-66-07 backdate signDate.year | ✅ | L260 — KHÔNG touch 2027 key |
| TC-66-08 lowercase service sanitize | ✅ | L282 — defense-in-depth uppercase |
| TC-66-09 empty fallback strip | ✅ | L295 — DNTN HOÀNG GIA → HOANGGIA |
| TC-66-10 prefix-only → CLIENT fallback | ✅ | L307 |
| TC-66-11 slice ≤16 chars | ✅ | L320 |
| TC-66-12 forward-only proxy | ⚠️ | L340 — TC này lẽ ra verify activate() guard không regenerate. Test là "proxy" check 2 distinct numbers. Behavior thực được cover ở `contracts.lifecycle.spec.ts` "keeps existing contractNumber on activate (no regen)" (mentioned by Coder, not verified by QC inline) |
| TC-66-13 concurrent Promise.all | ✅ | L356 |
| TC-66-14 collision retry → 409 | ⚠️ | L380 — proxy stub. Service-level no retry. Behavior thực ở contracts.service.activate() L918 retry-5x loop. **BUT** thực tế throws `BadRequestException` (400) — KHÔNG match PRD spec **409 ConflictException**. Xem RW-02. |
| TC-66-15 Logger.warn structured | ✅ | L394 — verify event/year/clientToken/sequence/source |

**TC-66-16 MISSING:** OQ-66-01 uniqueness backend reject 409 — RW-01.

### 4.3 Strip-prefix unit coverage

Tốt — 21/21 cover full VN legal entity matrix. **Bonus** test recursive non-strip + collapse whitespace edge.

---

## 5. Phase 4 — Performance

| Hot path | Complexity | Verdict |
|---------|-----------|---------|
| Redis INCR per-(year, client) | O(1) atomic | ✅ <5ms — Redis local |
| `stripCompanyPrefix()` | O(n × 15) regex check, n=entityName length ≤255 | ✅ <1ms — anchored `^`, early return |
| `sanitizeToken()` | O(n) NFD normalize + replace | ✅ Negligible |
| Mongo `findOne({shortName})` uniqueness | O(scan trừ index) | ⚠️ Xem RW-03 |

⚠️ **RW-03 (low priority):** `partner.schema.ts` field `shortName` KHÔNG có sparse unique index. Mỗi create/update trigger collection scan O(N). Với ~58 tenants + ~hundreds partners eventual → acceptable now nhưng nên add `@Prop({ index: true, sparse: true })` để query findOne stay O(log n). Out-of-scope nếu Manager chốt deferred.

**Memory impact Redis:** ~58 tenants × avg 10 partners × 5 years = 2900 keys. Mỗi key string +1 int = ~50 bytes → 145KB. Trivial.

---

## 6. Phase 5 — PRD Compliance

### 6.1 Business Rules (18 BR-66-*)

| BR | Verdict | Note |
|----|---------|------|
| BR-66-01..13 | ✅ | All implemented |
| BR-66-14 collision retry → **409 ConflictException** với VN message | ❌ **FAIL** | Implemented as **`BadRequestException` (HTTP 400)** ở `contracts.service.ts:946` với message `"Không tạo được số HĐ unique sau 5 lần thử — vui lòng thử lại"`. PRD Journey 2 step 4b + Section 5.3 spec rõ `409` + VN message `"Số HĐ bị trùng — vui lòng đổi tên viết tắt đối tác và thử lại"`. Coder claim ✅ trong section 4 BR table — **SAI**. |
| BR-66-15..17 | ✅ | All implemented |
| OQ-66-01 (= BR-66-18 effective) uniqueness 409 | ⚠️ | Code OK, test ZERO coverage — RW-01 |

### 6.2 Test Cases (15 TC-66-*)

15/15 implemented. TC-66-16 missing (cấp duplicate uniqueness). TC-66-12 + TC-66-14 là proxy stubs — KHÔNG verify activate() guard + 409 contract response. **RW-04 (nice-to-have):** add integration test `contracts.lifecycle.spec.ts` cho activate() 409 path (cần update khi RW-02 fix BadRequest→Conflict).

### 6.3 Files Touched

Match Scope Lock 6 → 8 files (acceptable drift):
- Coder thêm `strip-company-prefix.spec.ts` (NEW test file) — OK best practice
- Coder thay đổi `partner-picker.tsx` thay vì `partner-form.tsx` (file plan đặt sai tên, picker đã có embedded form) — OK
- Coder KHÔNG đụng `contract-wizard.tsx` cho "Dự kiến số HĐ" preview line — Coder admit defer F-068+ (BR-66-13 service expose `peekSequence()` ready) — acceptable

### 6.4 Journey gap

❌ **Journey 3 admin EDIT Partner.shortName** — UI cho admin sửa shortName của partner đã tồn tại KHÔNG tồn tại trong `partner-picker.tsx` (form chỉ render cho "Tạo mới"). PATCH endpoint backend OK + spec cover update, NHƯNG không có entry point UI. Admin phải dùng raw API/curl để update shortName. **RW-05.**

### 6.5 Display Convention KHÔNG render raw enum

✅ PASS. KHÔNG có enum/snake_case render JSX. Token CLIENT là string đã sanitize ASCII uppercase — bản chất identifier, không phải status/enum.

---

## 7. Findings & Required Rework

### Critical (BLOCK merge nếu strict)

❌ **RW-02:** BR-66-14 vi phạm — `contracts.service.activate()` L946 throw `BadRequestException` (400) thay vì `ConflictException` (409). Fix:
```typescript
import { ConflictException } from '@nestjs/common';
// L946
throw new ConflictException(
  'Số HĐ bị trùng — vui lòng đổi tên viết tắt đối tác và thử lại',
);
```
Đồng thời update message để match PRD Section 5.3 wording.

### Minor (recommended trước deploy)

⚠️ **RW-01:** Bổ sung partners.service.spec.ts test cho `assertShortNameUnique()` — 3 cases minimum: create dup→409, update self ok, update với dup khác→409.

⚠️ **RW-04:** Update TC-66-14 proxy stub → integration test thật vào `contracts.lifecycle.spec.ts` verify 409 sau RW-02 fix.

### Low / Defer

🟡 **RW-03:** Add Mongo sparse index `{shortName: 1}` trên Partner schema cho future performance (defer OK nếu PM chốt).

🟡 **RW-05:** Admin UI EDIT shortName cho existing partner — Journey 3 gap. Defer F-068 OK nhưng phải document trong release note.

🟡 **RW-06 (cosmetic):** Coder section 4 BR-66-14 mark ✅ — claim không trung thực (BadRequest ≠ ConflictException). Update IMPLEMENTATION_NOTES + 03-coder-implementation status table sau khi fix RW-02.

---

## 8. Verdict

⚠️ **APPROVED WITH MINOR REWORK** — branch chưa sẵn sàng deploy PROD; cần fix **RW-02** (status code 400→409 — vi phạm PRD compliance trực tiếp ảnh hưởng frontend error handling Journey 2 step 4b) + **RW-01** (test gap cho OQ-66-01).

Sau khi RW-02 + RW-01 close, re-run jest verify 295+3 tests pass → APPROVED FOR DEPLOY.

Implementation chất lượng tổng thể TỐT: overload signature backward-compat F-024 elegant, per-key Redis isolation clean, defense-in-depth 3-layer validate (UI/DTO/service), VN diacritics handle đúng, audit log structured cho future BI. Coder commit pacing tốt (7 incremental commits). Documentation 4 files đầy đủ.

NHƯNG **NO MERCY mode** không thể bỏ qua: (a) một BR mark ✅ sai (BR-66-14 status 400 vs 409 spec), (b) test coverage gap OQ-66-01 dù feature deliverable. 2 issues này phải close trước merge.
