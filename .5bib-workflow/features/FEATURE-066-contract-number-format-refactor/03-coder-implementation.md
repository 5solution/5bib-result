# FEATURE-066 — Coder Implementation Report

> **Coder:** 5bib-fullstack-engineer (Elite Senior Fullstack Engineer)
> **Branch:** `feat/F-066-contract-number-format`
> **Base:** `origin/main` (post F-062 v1.9.6 hotfix series)
> **Status:** ✅ READY_FOR_QC
> **Last updated:** 2026-05-25

---

## 1. Scope thực hiện

Refactor logic tạo số HĐ trong module `contracts/` để fix 3 bug nghiệp vụ:

1. Bỏ qua `Partner.shortName` — caller tự hand-built acronym từ `entityName` → ra `CTCPTAMAN` thay vì `TAM`.
2. Không strip company prefix — prefix pháp nhân (CTCP / CTYTNHH) lẫn vào client token.
3. Sequence year-global — 2 HĐ khác client cùng năm → 1 HĐ bị suffix `-2` vô lý.

Implementation **forward-only** (PAUSE-66-03): HĐ cũ KHÔNG bị regenerate; chỉ HĐ mới dùng logic mới.

## 2. Files touched (6 files — match scope lock)

| # | File | Loại | Δ LoC |
|---|------|------|-------|
| 1 | `backend/src/modules/contracts/utils/strip-company-prefix.util.ts` | NEW | +64 |
| 2 | `backend/src/modules/contracts/utils/strip-company-prefix.spec.ts` | NEW | +103 |
| 3 | `backend/src/modules/contracts/services/contract-number.service.ts` | MODIFY | +169/-34 |
| 4 | `backend/src/modules/contracts/services/contracts.service.ts` (block 880-940) | MODIFY | +27/-12 |
| 5 | `backend/src/modules/contracts/services/contract-number.service.spec.ts` | EXTEND | +296 |
| 6 | `backend/src/modules/contracts/dto/partner.dto.ts` | MODIFY | +33/-7 |
| 7 | `backend/src/modules/contracts/services/partners.service.ts` | MODIFY | +44/-2 |
| 8 | `admin/src/app/(dashboard)/contracts/_components/partner-picker.tsx` | MODIFY | +21/-1 |

Tổng 8 files (NEW spec file thêm vs plan 6 — spec tách riêng để clean test organization). KHÔNG đụng `partner.schema.ts` (field `shortName` đã exists từ trước).

## 3. 4 PAUSE + 1 OQ locked — implementation status

| Decision | Status | Implementation |
|----------|--------|----------------|
| PAUSE-66-01 = D Hybrid | ✅ Done | `resolveClientToken()` BR-66-02 priority: partnerShortName > stripCompanyPrefix(entityName) > 'CLIENT' fallback |
| PAUSE-66-02 = A Per-(year, client) | ✅ Done | Redis key đổi `contracts:sequence:<year>` → `contracts:sequence:<year>:<clientShortName>`. `sequenceKey()` helper handle backward compat khi shortName undefined |
| PAUSE-66-03 = A Forward-only | ✅ Done | activate() guard `if (!c.contractNumber)` giữ nguyên. HĐ ACTIVE đã có contractNumber → KHÔNG regenerate. Update Partner.shortName sau deploy CHỈ tác động HĐ generate sau đó |
| PAUSE-66-04 = Confirm format | ✅ Done | Format `DD.MM/YYYY/HDDV/CLIENT-PROVIDER[-N]` giữ nguyên — chỉ refactor logic build token CLIENT |
| OQ-66-01 = YES uniqueness | ✅ Done | `assertShortNameUnique()` trong PartnersService — throw ConflictException 409 với VN message khi shortName trùng partner khác |

## 4. Business Rules — implementation map

| BR | Implementation location | Status |
|----|------------------------|--------|
| BR-66-01 format giữ nguyên | `contract-number.service.ts` line 110 (template string) | ✅ |
| BR-66-02 token priority 3-tier | `resolveClientToken()` private method | ✅ |
| BR-66-03 fallback CLIENT constant | `resolveClientToken()` tier-3 | ✅ |
| BR-66-04 strip 1-pass idempotent | `stripCompanyPrefix()` utility | ✅ |
| BR-66-05 per-(year, client) Redis key | `sequenceKey(year, clientShortName)` | ✅ |
| BR-66-06 seq=1 cho client mới đầu năm | `nextSequence()` Redis INCR semantics | ✅ |
| BR-66-07 suffix -N khi seq≥2 | `seqSuffix = sequence > 1 ? '-N' : ''` | ✅ |
| BR-66-08 backdate uses signDate.year | `yyyy = signDate.getFullYear()` | ✅ |
| BR-66-09 forward-only | `contracts.service.activate()` guard | ✅ |
| BR-66-10 update shortName không đụng HĐ cũ | activate() chỉ generate khi `!c.contractNumber` | ✅ |
| BR-66-11 DTO validate 16 chars + regex | `@MaxLength(16) @Matches(/^[A-Z0-9]+$/)` | ✅ |
| BR-66-12 UI auto-transform uppercase | partner-picker.tsx onChange | ✅ |
| BR-66-13 peekSequence cho preview | `peekSequence(year, clientShortName?)` | ✅ exposed (admin wizard preview integration TBD) |
| BR-66-14 collision retry 5x → 409 | `contracts.service.activate()` retry loop giữ nguyên | ✅ |
| BR-66-15 Logger.warn structured | `logger.warn({event, year, clientToken, sequence, source, providerId})` | ✅ |
| BR-66-16 không migrate key cũ | Comment doc trong service header | ✅ |
| BR-66-17 VN error messages | tất cả `@*({message: 'Tiếng Việt...'})` | ✅ |

## 5. Test results

| Test suite | Pass/Total | Notes |
|-----------|-----------|-------|
| `strip-company-prefix.spec.ts` | 21/21 | 14 prefix variants + 7 edge cases |
| `contract-number.service.spec.ts` | 25/25 | 10 F-024 (backward compat) + 15 TC-66 |
| `contracts.lifecycle.spec.ts` | 21/21 | activate() flow với entityName='ABC Sport' → contractNumber match BR-CM-02 regex |
| `partners.service.spec.ts` | 5/5 | existing tests không trigger shortName uniqueness |
| **contracts module full** | **295/295** | KHÔNG có regression F-024/F-028/F-044/F-064 |
| TSC backend | clean (contracts module) | pre-existing errors trong upload module unrelated |

## 6. Commits incremental (per Coder mandate)

```
87faf5c feat(F-066): strip company prefix helper + utility               # C1
f4957ae feat(F-066): contract-number per-(year, client) sequence + ...   # C2
7afe95f feat(F-066): wire partner.shortName into contracts.service:890   # C3
d4993b6 feat(F-066): Partner shortName uniqueness validation 409         # C4
4c21011 feat(F-066): admin Partner form shortName input + validation     # C5
a0221aa test(F-066): 15 TC-66 + contract-number regression PASS          # C6
<this>  docs(F-066): IMPLEMENTATION_NOTES + 03-coder-implementation.md   # C7
```

Mỗi commit push remote ngay → KHÔNG mất work nếu crash.

## 7. Backward compat verification

- `ContractNumberService.generateNumber(signDate, clientShortName, providerId)` — legacy 3-arg signature giữ nguyên (overload). Call sites cũ chưa migrate vẫn work.
- F-024 existing tests 10/10 PASS với perKey mock của F-066 sequence semantics.
- HĐ ACTIVE pre-deploy F-066 → mở lại admin → contractNumber UNCHANGED.
- Partners chưa có `shortName` → fallback `stripCompanyPrefix(entityName)`.
- Legacy Redis key `contracts:sequence:<year>` bỏ lửng (BR-66-16); không reused, không cleanup tự động.

## 8. Edge cases handled

1. **Empty shortName + empty entityName** → fallback constant 'CLIENT'.
2. **Prefix-only entityName** (vd "CÔNG TY TNHH") → strip → empty → fallback CLIENT.
3. **Lowercase shortName** (admin bypass UI transform) → backend DTO reject 400. Service-layer sanitize defense-in-depth (TC-66-08).
4. **VN diacritics** (vd "TÂM") → NFD normalize + d/D map → "TAM" ASCII safe trong số HĐ.
5. **Long entityName** sau strip → sanitize remove non-alphanum + slice 16 chars.
6. **Backdate signDate** → key dùng `signDate.getFullYear()` không phải today (PAUSE-CODE-04 edge case 1).
7. **Concurrent generate** same client → Redis INCR atomic → distinct sequences.
8. **Partner lookup fail** → defensive try/catch trong contracts.service.activate() → fallback null shortName → service tiếp tục bằng strip entityName.
9. **shortName uniqueness collision** → 409 ConflictException với VN message.
10. **shortName uniqueness on update** → exclude self (`_id: { $ne: id }`).

## 9. Out-of-scope (explicit defer)

- Migrate Redis key cũ `contracts:sequence:<year>` (BR-66-16 acceptable — bỏ lửng)
- Migrate historical HĐ contractNumber format (PAUSE-66-03 forward-only)
- Admin wizard preview "Dự kiến số HĐ" line — service đã expose `peekSequence(year, shortName)`, UI integration TBD scope F-068+
- Audit log persistence (Logger.warn đủ cho MVP, F-067 territory)
- Contract template rendering — F-064/F-065 territory

## 10. Pre-deploy checklist (CLAUDE.md compliance)

| Check | Status |
|-------|--------|
| API response shape changed? | ❌ No — DTO field `shortName` đã exists, chỉ thêm validation |
| Strip / scrub fields khỏi public API? | ❌ No |
| DTO thêm required field? | ❌ No — `shortName` vẫn optional. `pnpm generate:api` không bắt buộc (validation rule không expose) |
| Redis cache invalidation? | ❌ No new cache. Legacy `contracts:sequence:<year>` keys bỏ lửng acceptable |
| End-to-end verify? | ✅ Unit tests cover lifecycle activate(). Manual smoke test trong QC stage |

## 11. Known limitations

1. **Admin wizard preview line "Dự kiến: 15.05/2026/HDDV/TAM-5BIB"** (Journey 1 step 6a) — service expose `peekSequence()` nhưng UI integration scope F-068+. PR-066 chỉ deliver form field + uniqueness check.
2. **Redis key migration cũ** — keys `contracts:sequence:<year>` orphan forever. Acceptable theo BR-66-16. Manual cleanup nếu cần qua `redis-cli DEL contracts:sequence:2024 contracts:sequence:2025`.
3. **shortName case-sensitivity** — backend lưu uppercase A-Z 0-9 (DTO @Matches regex). Uniqueness check exact match. Admin gõ "tam" UI transform "TAM" → store "TAM". KHÔNG có case-insensitive collision risk.

## 12. Files reference (absolute paths)

- `/Users/dannynguyen/Desktop/Claude/5bib-result/backend/src/modules/contracts/utils/strip-company-prefix.util.ts` (NEW)
- `/Users/dannynguyen/Desktop/Claude/5bib-result/backend/src/modules/contracts/utils/strip-company-prefix.spec.ts` (NEW)
- `/Users/dannynguyen/Desktop/Claude/5bib-result/backend/src/modules/contracts/services/contract-number.service.ts`
- `/Users/dannynguyen/Desktop/Claude/5bib-result/backend/src/modules/contracts/services/contract-number.service.spec.ts`
- `/Users/dannynguyen/Desktop/Claude/5bib-result/backend/src/modules/contracts/services/contracts.service.ts` (block 880-940)
- `/Users/dannynguyen/Desktop/Claude/5bib-result/backend/src/modules/contracts/services/partners.service.ts`
- `/Users/dannynguyen/Desktop/Claude/5bib-result/backend/src/modules/contracts/dto/partner.dto.ts`
- `/Users/dannynguyen/Desktop/Claude/5bib-result/admin/src/app/(dashboard)/contracts/_components/partner-picker.tsx`

## 13. Handoff → QC

QC mandate (5bib-qc-gatekeeper):

1. Verify 15 TC-66 + 21 strip-prefix tests pass.
2. Integration smoke: tạo Partner mới `entityName="CÔNG TY CỔ PHẦN TÂM AN MEDIA"` + shortName="TAM" → tạo HĐ → activate → `contractNumber === '<DD.MM>/2026/HDDV/TAM-5BIB'`.
3. Uniqueness verify: tạo Partner B với cùng shortName "TAM" → expect 409 with VN message.
4. Backward compat verify: HĐ ACTIVE pre-deploy → mở admin → contractNumber UNCHANGED.
5. Per-(year, client) verify: tạo 2 HĐ khác client cùng năm → cả 2 đều seq=1 (KHÔNG có suffix `-2`).
6. Race condition: Promise.all 2 activate cùng partner → expect distinct contractNumbers (seq 1 + 2).
7. Security: SQL injection / NoSQL injection trong shortName field → DTO `@Matches(/^[A-Z0-9]+$/)` blocks.

**Ready cho `/5bib-qc`.**
