# FEATURE-066: Manager Deploy & Memory Sync

**Status:** ✅ DONE (PROD verified)
**Deployed:** 2026-05-26
**Release:** `release/v1.9.8` (superseded by v1.10.0)
**PROD image:** `f7f6c5d`

## 📊 Deploy summary

| Metric | Value |
|--------|-------|
| QC final | ✅ APPROVED (post-rework RW-01 + RW-02) |
| F-066 tests | 25/25 contract-number + 21 strip-prefix + 8 partners = 54 PASS |
| Module regression | 295/295 PASS |
| Files | 8 (1 NEW util + 1 NEW spec + 5 MODIFY + 1 admin UI) |
| Branch | `feat/F-066-contract-number-format` (9 commits + 1 merge) |

## 🔬 Manager Code Review

### 1. `utils/strip-company-prefix.util.ts` NEW
- ✅ Strip 14 VN prefix variants + diacritics-aware longest-match-first
- ✅ 21 unit tests cover edges

### 2. `contract-number.service.ts:generateNumber()` refactor
- ✅ Args-object overload backward compat (3-arg legacy preserved)
- ✅ Per-(year, client) Redis key: `contracts:sequence:<year>:<clientShortName>`
- ✅ 2-tier priority: shortName > stripped entityName > 'CLIENT' fallback

### 3. `partners.service.ts:assertShortNameUnique()` NEW (OQ-66-01 = YES)
- ✅ 409 Conflict + VN message
- ✅ Exclude self on update via `_id.$ne`
- ✅ 3 unit tests POST-REWORK (TC-66-PARTNER-01/02/03)

### 4. `contracts.service.ts:946` BR-66-14 fix (POST-REWORK RW-02)
- ✅ `ConflictException` (HTTP 409) thay vì `BadRequestException` (400)
- ✅ Message PRD literal: `"Số HĐ bị trùng — vui lòng đổi tên viết tắt đối tác và thử lại"`

**Final: ✅ APPROVED.**

## ✅ Status

🎉 **FEATURE-066 DONE** — Contract number format `DD.MM/YYYY/HDDV/CLIENT-PROVIDER[-N]` với strip prefix + admin override + per-(year, client) sequence shipped.
