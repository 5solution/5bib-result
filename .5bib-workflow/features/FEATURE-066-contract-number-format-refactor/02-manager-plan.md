# FEATURE-066: Manager Plan Review

**Reviewed:** 2026-05-25
**Reviewer:** 5bib-manager
**Verdict:** ✅ **APPROVED**
**Linked:** `00-manager-init.md`, `01-ba-prd.md`

---

## 📌 Pre-flight check

- [x] Đọc `00-manager-init.md` (4 PAUSE locked + Danny "Theo Manager đề xuất tất cả")
- [x] Đọc `01-ba-prd.md` (18 BR + 15 TC + 1 OQ)
- [x] Spot-check:
  - ✅ `partner.schema.ts:18` đã có `shortName` field (no migration needed)
  - ✅ `contracts.service.ts:890-897` confirmed root cause — acronym hand-built bỏ qua partner.shortName
  - ✅ `contract-number.service.ts:70` global sequence key

---

## ✓ PRD Validation Checklist

12/12 items PASS. PRD comprehensive với 18 BR + 15 TC.

## 🔧 OQ-66-01 — Pre-check uniqueness shortName?

**Decision: ✅ YES** — Add backend validation:
- Khi admin create/update Partner với `shortName`, verify uniqueness trong `Partner` collection
- Throw 409 Conflict nếu duplicate
- Reason: prevent contract number collision giữa 2 client cùng shortName

---

## 📋 Scope Lock (DỨT KHOÁT)

### ✏️ MODIFY (5 files)

| # | File | Thay đổi | Δ LoC |
|---|------|----------|-------|
| 1 | `backend/src/modules/contracts/services/contract-number.service.ts` | Refactor `generateNumber()`: accept `shortName` param + strip prefix helper. `nextSequence(year, clientShortName?)` per-(year, client) Redis key | +60 / -10 |
| 2 | `backend/src/modules/contracts/services/contracts.service.ts:890-897` | Replace acronym hand-built logic → use `partner.shortName ?? stripCompanyPrefix(partner.entityName)` | +15 / -8 |
| 3 | `backend/src/modules/contracts/services/contract-number.service.spec.ts` | Extend tests cover 15 TC-66-* | +250 |
| 4 | `backend/src/modules/contracts/services/partners.service.ts` (hoặc tương đương) | Add uniqueness check shortName on create/update Partner (OQ-66-01 = YES) | +30 |
| 5 | `admin/src/app/(dashboard)/contracts/partners/_components/partner-form.tsx` (hoặc tương đương) | Input field "Tên viết tắt cho HĐ" với placeholder hint + max 16 char + uppercase auto-transform | +40 |

### 🆕 NEW (1 helper file)

| # | File | Mục đích | LoC |
|---|------|----------|-----|
| 6 | `backend/src/modules/contracts/utils/strip-company-prefix.util.ts` | Helper strip CTCP/CTYTNHH/CTYTNHHMTV/CTCPHH prefixes | ~40 |

**Tổng:** 1 NEW + 5 MODIFY = **6 files** (~435 LoC).

**KHÔNG được đụng:**
- ❌ Historical contracts data (forward-only)
- ❌ Contract render templates (F-064/F-065 territory)
- ❌ F-067 audit log (separate)
- ❌ Partner schema migration (shortName đã exist)

---

## 🔧 Tech Approach

### 1. Strip prefix helper

```typescript
// utils/strip-company-prefix.util.ts
const COMPANY_PREFIXES = [
  'CÔNG TY CỔ PHẦN',
  'CTCP',
  'CÔNG TY TNHH MỘT THÀNH VIÊN',
  'CTYTNHHMTV',
  'CÔNG TY TNHH',
  'CTYTNHH',
  'CTY TNHH',
  'CTY CP',
  'CÔNG TY',
];

export function stripCompanyPrefix(name: string): string {
  if (!name) return '';
  const upper = name.toUpperCase().trim();
  for (const prefix of COMPANY_PREFIXES) {
    if (upper.startsWith(prefix)) {
      return upper.slice(prefix.length).trim();
    }
  }
  return upper;
}
```

### 2. Contract number refactor

```typescript
// contract-number.service.ts
async generateNumber(
  signDate: Date,
  clientShortNameOrEntity: string,  // can be shortName override OR raw entity name
  providerId: string,
): Promise<{ contractNumber: string; sequence: number }> {
  const dd = String(signDate.getDate()).padStart(2, '0');
  const mm = String(signDate.getMonth() + 1).padStart(2, '0');
  const yyyy = signDate.getFullYear();
  
  // Strip prefix if appears to be raw entity name (KHÔNG strip nếu admin override với shortName)
  const looksLikeEntity = /CÔNG\s+TY|CTCP|CTYTNHH|CTY/i.test(clientShortNameOrEntity);
  const cleanName = looksLikeEntity
    ? stripCompanyPrefix(clientShortNameOrEntity)
    : clientShortNameOrEntity.toUpperCase();
  
  const finalShort = cleanName
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 16) || 'CLIENT';
  
  const sequence = await this.nextSequence(yyyy, finalShort);  // per-(year, client) key
  const provider = providerId === '5SOLUTION' ? '5SOLUTION' : '5BIB';
  const seqSuffix = sequence > 1 ? `-${sequence}` : '';
  
  return {
    contractNumber: `${dd}.${mm}/${yyyy}/HDDV/${finalShort}-${provider}${seqSuffix}`,
    sequence,
  };
}

async nextSequence(year: number, clientShortName: string = ''): Promise<number> {
  if (!this.redis) return Math.floor(Math.random() * 1_000_000);
  // Per-(year, client) key — fallback global key if shortName empty
  const key = clientShortName
    ? `contracts:sequence:${year}:${clientShortName}`
    : `contracts:sequence:${year}`;
  return this.redis.incr(key);
}
```

### 3. Caller invocation in contracts.service.ts

```typescript
// contracts.service.ts (replace acronym hand-built)
const shortName = partner?.shortName ?? stripCompanyPrefix(partner?.entityName ?? dto.client.entityName);
const { contractNumber, sequence } = await this.contractNumberService.generateNumber(
  signDate,
  shortName,
  providerId,
);
```

### 4. Partner uniqueness validation

```typescript
// partners.service.ts:create/update
if (dto.shortName) {
  const upper = dto.shortName.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (upper.length === 0 || upper.length > 16) {
    throw new BadRequestException('shortName phải 1-16 ký tự alphanumeric');
  }
  const existing = await this.partnerModel.findOne({
    shortName: upper,
    _id: { $ne: id },  // exclude self on update
  });
  if (existing) {
    throw new ConflictException(`shortName "${upper}" đã tồn tại cho partner khác`);
  }
  dto.shortName = upper;
}
```

---

## 🛑 PAUSE Coder

- 🛑 Trước commit verify: F-024 contract-number existing tests vẫn PASS
- 🛑 Backward compat: existing partners KHÔNG có shortName → fallback `stripCompanyPrefix(entityName)`. Existing HĐ KHÔNG re-generate
- 🛑 Test edge: empty shortName "" → fallback "CLIENT" constant

---

## 🧪 Unit test bắt buộc

15 TC-66-01..15 từ PRD. Highlight:
- Happy path strip CTCP → THANHANMEDIA
- Partner.shortName override → custom name (priority highest)
- Per-(year, client) sequence isolation — 2 client same date, both start seq=1
- Year reset Dec 31 vs Jan 1
- Validation reject 400 (invalid format), 409 (duplicate shortName)
- Backward compat existing HĐ immutable

---

## ✅ Sẵn sàng cho `/5bib-code`

**Manager verdict:** ✅ **APPROVED — Coder bắt đầu.**

### Branch strategy

- F-066 base `origin/main` (v1.9.6 post F-060+F-061)
- Cut release/v1.9.9 (sau F-064 v1.9.7 + F-067 v1.9.8)
- Independent của F-064/F-065/F-067 — không conflict scope

**Estimate:** 2.5 ngày dev + 1 QC + 0.5 deploy = **~4 ngày**.
